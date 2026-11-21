"""Paper recommendations in three intellectually distinct groups.

Signals (each 0–1, all reported to the UI):
  semantic – embedding cosine similarity
  topic    – Jaccard overlap of topic tags
  entity   – Jaccard overlap of methods + technologies + missions
  temporal – 1 at the same year, falling to 0 at ±5 years

Groups (a paper appears in at most one):
  very_similar – shares ≥ half its topics; ranked mostly by semantic similarity
  related      – shares a topic or entity but uses a different research method (different approach)
  adjacent     – shares no topic, but sits in a topic that frequently co-occurs with this paper's topics
"""
from collections import Counter, defaultdict

import numpy as np

from .schemas import Paper, Recommendation, RecommendationSet, RecommendationSignals

TEMPORAL_SPAN = 5
PER_GROUP = 6
NEIGHBORS_PER_TOPIC = 5


def jaccard(a: set[str], b: set[str]) -> float:
    return len(a & b) / len(a | b) if a or b else 0.0


def entity_set(p: Paper) -> set[str]:
    d = p.derived
    return set(d.methods) | set(d.technologies) | set(d.missions)


class Recommender:
    def __init__(self, papers: list[Paper], vectors: np.ndarray, method: str):
        self.papers, self.vectors, self.method = papers, vectors, method
        pairs: Counter = Counter()
        for p in papers:
            ts = sorted(set(p.derived.topics))
            for i, a in enumerate(ts):
                for b in ts[i + 1:]:
                    pairs[(a, b)] += 1
        by_topic: dict[str, Counter] = defaultdict(Counter)
        for (a, b), n in pairs.items():
            by_topic[a][b] += n
            by_topic[b][a] += n
        self.neighbors = {t: {x for x, _ in c.most_common(NEIGHBORS_PER_TOPIC)} for t, c in by_topic.items()}
        self.index = {p.paper_id: i for i, p in enumerate(papers)}

    def recommend(self, paper_id: str) -> RecommendationSet | None:
        i = self.index.get(paper_id)
        if i is None:
            return None
        p = self.papers[i]
        sims = np.clip(self.vectors @ self.vectors[i], 0, 1)
        topics, ents, methods = set(p.derived.topics), entity_set(p), set(p.derived.methods)
        neighbor_topics = set().union(*(self.neighbors.get(t, set()) for t in topics)) - topics

        very, related, adjacent = [], [], []
        for j, c in enumerate(self.papers):
            if j == i:
                continue
            ct, ce = set(c.derived.topics), entity_set(c)
            sig = {
                "semantic": float(sims[j]),
                "topic": jaccard(topics, ct),
                "entity": jaccard(ents, ce),
                "temporal": max(0.0, 1 - abs(p.publication_year - c.publication_year) / TEMPORAL_SPAN),
            }
            shared_t = topics & ct
            if len(shared_t) >= max(1, len(topics) / 2):
                score = 0.6 * sig["semantic"] + 0.25 * sig["topic"] + 0.1 * sig["entity"] + 0.05 * sig["temporal"]
                very.append((score, j, sig))
            elif (shared_t or ents & ce) and not (methods & set(c.derived.methods)):
                score = 0.35 * sig["semantic"] + 0.3 * sig["topic"] + 0.3 * sig["entity"] + 0.05 * sig["temporal"]
                related.append((score, j, sig))
            elif not shared_t and ct & neighbor_topics:
                score = 0.5 * sig["semantic"] + 0.3 * len(ct & neighbor_topics) / len(ct) + 0.2 * sig["entity"]
                adjacent.append((score, j, sig))

        # "Very similar" may also catch same-topic papers with a different method; keep groups disjoint.
        def top(items, kind, taken: set[int]):
            out = []
            for score, j, sig in sorted(items, key=lambda x: -x[0]):
                if j in taken:
                    continue
                taken.add(j)
                out.append(self._rec(p, self.papers[j], kind, score, sig, neighbor_topics))
                if len(out) == PER_GROUP:
                    break
            return out

        taken: set[int] = set()
        return RecommendationSet(
            paper_id=paper_id, method=self.method,
            very_similar=top(very, "very_similar", taken),
            related=top(related, "related", taken),
            adjacent=top(adjacent, "adjacent", taken),
        )

    @staticmethod
    def _rec(p: Paper, c: Paper, kind: str, score: float, sig: dict, neighbor_topics: set[str]) -> Recommendation:
        reasons = [f"Shares topic: {t}" for t in sorted(set(p.derived.topics) & set(c.derived.topics))]
        if kind == "adjacent":
            reasons += [f"Neighboring field: {t}" for t in sorted(set(c.derived.topics) & neighbor_topics)]
        reasons += [f"Same mission: {m}" for m in sorted(set(p.derived.missions) & set(c.derived.missions))]
        reasons += [f"Also uses {t}" for t in sorted(set(p.derived.technologies) & set(c.derived.technologies))]
        pm, cm = set(p.derived.methods), set(c.derived.methods)
        if cm and pm and not (pm & cm):
            reasons.append(f"Different approach: {', '.join(sorted(cm))}")
        elif pm & cm:
            reasons.append(f"Same method: {', '.join(sorted(pm & cm))}")
        if abs(p.publication_year - c.publication_year) <= 1:
            reasons.append("Published within a year")
        return Recommendation(
            paper=c, kind=kind, score=round(score * 100),
            signals=RecommendationSignals(**{k: round(v * 100) for k, v in sig.items()}),
            reasons=reasons[:4],
        )
