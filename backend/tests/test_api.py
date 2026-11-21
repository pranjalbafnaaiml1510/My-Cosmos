"""API contract + search behaviour tests against the demo corpus (forced LSA for speed/determinism)."""
import os
from collections import Counter

os.environ.setdefault("EMBEDDER", "lsa")

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_and_stats(client):
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["retrieval"] == "lsa"
    s = client.get("/stats").json()
    assert s["papers"] == h["papers"] > 0
    assert s["year_range"][0] <= s["year_range"][1]


@pytest.mark.parametrize("path", ["/domains", "/topics", "/graph/topics", "/trends/emerging", "/countries",
                                  "/missions", "/papers/facets", "/papers/recent"])
def test_collection_endpoints(client, path):
    r = client.get(path)
    assert r.status_code == 200 and r.json()


def test_profiles_and_404(client):
    assert client.get("/countries/in").json()["name"] == "India"
    assert client.get("/topics/autonomous-spacecraft").json()["kind"] == "topic"
    assert client.get("/topics/does-not-exist").status_code == 404
    assert client.get("/papers/nope").status_code == 404


def test_paper_filters_and_paging(client):
    r = client.get("/papers", params={"country": "India", "topic": "Computer Vision", "page_size": 5}).json()
    assert r["total"] > 0 and len(r["items"]) <= 5
    for row in r["items"]:
        assert row["paper"]["country"] == "India"
        assert "Computer Vision" in row["paper"]["derived"]["topics"]


def test_search_interprets_and_explains(client):
    r = client.get("/search", params={"q": "AI techniques for detecting spacecraft faults"}).json()
    assert "Fault Detection" in r["interpretation"]
    assert r["results"], "expected matches"
    top = r["results"][0]
    assert {"overall", "semantic", "keyword", "topic", "entity", "matched_concepts"} <= top["relevance"].keys()
    scores = [x["relevance"]["overall"] for x in r["results"]]
    assert scores == sorted(scores, reverse=True)
    hits = sum("Fault Detection" in x["paper"]["derived"]["topics"] for x in r["results"][:10])
    assert hits >= 7, f"only {hits}/10 top results tagged Fault Detection"


def test_search_respects_filters(client):
    r = client.get("/search", params={"q": "electric propulsion thrusters", "country": "Japan"}).json()
    assert all(x["paper"]["country"] == "Japan" for x in r["results"])


def test_search_no_match(client):
    r = client.get("/search", params={"q": "zzzz qqqq"}).json()
    assert r["total"] == 0


def test_recommendations_groups(client):
    pid = client.get("/papers", params={"topic": "Computer Vision", "page_size": 1}).json()["items"][0]["paper"]["paper_id"]
    src = client.get(f"/papers/{pid}").json()
    r = client.get(f"/recommendations/{pid}").json()
    groups = r["very_similar"] + r["related"] + r["adjacent"]
    ids = [x["paper"]["paper_id"] for x in groups]
    assert pid not in ids and len(ids) == len(set(ids)), "self excluded, groups disjoint"
    assert r["very_similar"] and r["related"] and r["adjacent"]
    t = set(src["derived"]["topics"])
    for x in r["very_similar"]:
        assert t & set(x["paper"]["derived"]["topics"])
    for x in r["related"]:
        assert not set(src["derived"]["methods"]) & set(x["paper"]["derived"]["methods"])
    for x in r["adjacent"]:
        assert not t & set(x["paper"]["derived"]["topics"])
    assert all(x["reasons"] for x in groups)
    assert client.get("/recommendations/nope").status_code == 404


def test_graph_progressive_expansion(client):
    root = client.get("/graph/entity/root").json()
    assert root["center"]["id"] == "root" and {n["kind"] for n in root["nodes"]} == {"domain"}
    dom = client.get(f"/graph/entity/{root['nodes'][0]['id']}").json()
    assert any(n["kind"] == "topic" for n in dom["nodes"])
    topic = client.get("/graph/entity/topic:computer-vision").json()
    kinds = Counter(n["kind"] for n in topic["nodes"])
    assert all(v <= 4 for v in kinds.values()), "neighbours capped per kind"
    assert all(e["source"] == "topic:computer-vision" and e["weight"] > 0 for e in topic["edges"])
    assert sum(y["count"] for y in topic["yearly"]) == topic["center"]["paper_count"]
    assert client.get("/graph/entity/topic:nope").status_code == 404


def test_domain_expands_to_own_topics_only(client):
    dom = client.get("/graph/entity/domain:ai").json()
    topics = {n["label"] for n in dom["nodes"] if n["kind"] == "topic"}
    assert topics == {"Machine Learning", "Computer Vision", "Fault Detection", "Mission Planning", "Onboard AI"}
    assert len(dom["nodes"]) <= 5 + 4 * 5


def test_trend_report(client):
    r = client.get("/trends", params={"recent_years": 3}).json()
    assert r["recent_years"] == 3 and len(r["totals"]) == len(r["years"])
    statuses = {t["status"] for t in r["topics"]}
    assert statuses <= {"emerging", "growing", "stable", "declining"}
    by = {t["topic"]: t for t in r["topics"]}
    # The demo generator deliberately skews these topics toward recent years.
    assert by["Onboard AI"]["status"] in {"emerging", "growing"} and by["Onboard AI"]["slope"] > 0
    for t in r["topics"]:
        assert t["total"] == sum(y["count"] for y in t["yearly"])
        assert t["recent"] == sum(y["count"] for y in t["yearly"][-3:])
    assert [t["z"] for t in r["topics"]] == sorted((t["z"] for t in r["topics"]), reverse=True)
    assert r["countries"] and r["technologies"] and r["methods"]


def test_classify_rules():
    from app.trends import classify
    assert classify(2.0, 3.0, 10) == "emerging"
    assert classify(2.0, 3.0, 2) == "growing"   # too few papers to call it emerging
    assert classify(1.0, 0.0, 10) == "stable"
    assert classify(0.5, -2.0, 3) == "declining"


def test_opportunities(client):
    r = client.get("/opportunities", params={"limit": 50}).json()
    items = r["items"]
    assert r["lens"] == "underexplored" and items and r["total_pairs"] >= len(items)
    assert [o["score"] for o in items] == sorted((o["score"] for o in items), reverse=True)
    for o in items:
        assert o["papers"] >= 1 and o["topic_a"] != o["topic_b"]
        assert o["components"]["gap"] > 0, "underexplored = overlap below typical for its closeness"
        assert o["papers"] == sum(y["count"] for y in o["yearly"])
        assert all(0 <= v <= 100 for v in o["components"].values())
        assert len(o["sample_paper_ids"]) == min(5, o["papers"])
        if o["papers"] < 3:
            assert o["momentum"] == "none" and o["components"]["momentum"] == 0
    p = client.get(f"/papers/{items[0]['sample_paper_ids'][0]}").json()
    assert {items[0]["topic_a"], items[0]["topic_b"]} <= set(p["derived"]["topics"])
    cross = client.get("/opportunities", params={"cross_domain_only": True}).json()["items"]
    assert all(x["cross_domain"] for x in cross)
    grow = client.get("/opportunities", params={"lens": "growing"}).json()["items"]
    assert grow and all(x["papers"] >= 3 and x["momentum"] in ("increasing", "new") for x in grow)


# ---------- Research Assistant ----------

def test_ask_extractive_is_grounded(client):
    r = client.post("/ask", json={"question": "How is computer vision used for spacecraft navigation?"}).json()
    assert r["status"] == "answered" and r["provider"] == "extractive"
    assert r["cited"] and set(r["cited"]) <= {s["n"] for s in r["sources"]}
    assert r["grounding"]["cited_sentences"] == r["grounding"]["sentences"] > 0
    # extractive answers only contain sentences copied from the cited abstracts
    abstracts = " ".join(s["passage"] for s in r["sources"])
    import re
    for sent in re.split(r"(?<=\])\.\s*", r["answer"]):
        body = re.sub(r"\s*\[\d+\]\.?$", "", sent).strip()
        if body:
            assert body in abstracts


def test_ask_insufficient_evidence(client):
    r = client.post("/ask", json={"question": "zzzz qqqq xxyyzz"}).json()
    assert r["status"] == "insufficient_evidence" and r["cited"] == []
    assert "not contain enough evidence" in r["answer"]


def test_ask_about_one_paper(client):
    pid = client.get("/papers", params={"page_size": 1}).json()["items"][0]["paper"]["paper_id"]
    r = client.post("/ask", json={"question": "What method does this paper use?", "paper_id": pid}).json()
    assert [s["paper"]["paper_id"] for s in r["sources"]] == [pid]
    assert client.post("/ask", json={"question": "x", "paper_id": "nope"}).status_code == 404
    assert client.post("/ask", json={"question": "   "}).status_code == 422


def test_verify_citations_strips_invalid_and_counts():
    from app.rag.assistant import verify_citations
    text, cited, g = verify_citations("A is used [1]. B is reported [7]. C has no source.", n_sources=2)
    assert "[7]" not in text and cited == [1] and g.invalid_citations == [7]
    assert g.sentences == 3 and g.cited_sentences == 1


class _Stub:
    name = "stub"
    def __init__(self, out): self.out = out
    def generate(self, question, passages): return self.out


def test_uncited_llm_answer_is_rejected(client):
    from app.rag.assistant import ResearchAssistant
    s = client.app.state.cosmos
    bot = ResearchAssistant(s.engine, s.corpus.papers, _Stub("Spacecraft use cameras. Trust me [99]."))
    r = bot.ask("How is computer vision used for spacecraft navigation?")
    assert r.status == "insufficient_evidence" and r.grounding.invalid_citations == [99]


def test_provider_failure_is_reported(client):
    from app.rag.assistant import ResearchAssistant
    class Boom:
        name = "boom"
        def generate(self, q, p): raise TimeoutError()
    s = client.app.state.cosmos
    r = ResearchAssistant(s.engine, s.corpus.papers, Boom()).ask("computer vision navigation")
    assert r.status == "error" and "TimeoutError" in r.answer


def test_vectors_saved_embeddings_without_model_fall_back(tmp_path):
    """Saved embeddings from an uninstalled model: LSA search, saved vectors for similarity."""
    import json as _json
    import numpy as _np
    from app.corpus import Corpus
    from app.config import ROOT
    from app.vectors import setup_vectors
    c = Corpus.load(ROOT / "data" / "mock")
    papers = c.papers[:50]
    _np.save(tmp_path / "embeddings.npy", _np.eye(50, 8, dtype="float32"))
    (tmp_path / "embeddings.json").write_text(_json.dumps({"model": "not-installed/model"}))
    v = setup_vectors(papers, tmp_path, "lsa", "x", [p.abstract for p in papers])
    assert v.search_embedder.name == "lsa" and v.search_doc_vectors is None
    assert v.similarity_vectors.shape == (50, 8) and v.similarity_method == "neural"
    (tmp_path / "embeddings.npy").unlink()
    _np.save(tmp_path / "embeddings.npy", _np.eye(49, 8, dtype="float32"))
    import pytest as _pt
    with _pt.raises(RuntimeError, match="rows"):
        setup_vectors(papers, tmp_path, "lsa", "x", [p.abstract for p in papers])
