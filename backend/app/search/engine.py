"""Hybrid retrieval + reranking.

1. Interpret the query: map it to taxonomy topics by embedding similarity and term overlap.
2. Retrieve candidates from the union of dense (embedding) and sparse (TF-IDF) top-k.
3. Rerank with transparent features, each reported back to the UI:
     semantic  – cosine similarity of query and document embeddings
     keyword   – TF-IDF cosine, scaled against the best candidate
     topic     – share of interpreted topics the paper is tagged with
     entity    – query terms matching the paper's methods / technologies / missions
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from ..schemas import Paper, RelevanceBreakdown
from .embedders import Embedder
from .index import VectorIndex
from .text import analyze

WEIGHTS = {"semantic": 0.5, "keyword": 0.2, "topic": 0.2, "entity": 0.1}
MIN_OVERALL = 18  # below this a candidate is not considered a match
_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = {"what", "are", "the", "how", "being", "used", "which", "for", "and", "with", "researchers", "working",
         "research", "that", "techniques", "make", "capable", "connects", "into", "from", "about", "is", "of",
         "in", "on", "to", "a", "an", "becoming", "spacecraft", "space"}


def terms(text: str) -> set[str]:
    return {w for w in _TOKEN.findall(text.lower()) if len(w) > 2 and w not in _STOP}


def stem_match(a: set[str], b: set[str]) -> set[str]:
    """Terms of `a` sharing a 5-char prefix with a term of `b` (cheap stemming: fault/faults, detect/detection)."""
    pb = {w[:5] for w in b}
    return {w for w in a if w[:5] in pb}


def doc_text(p: Paper) -> str:
    d = p.derived
    return " ".join([p.title, p.abstract, *d.topics, *d.methods, *d.technologies, *d.missions, *d.keywords])


@dataclass
class Scored:
    index: int
    relevance: RelevanceBreakdown


class SearchEngine:
    def __init__(self, papers: list[Paper], topics: list[str], embedder: Embedder, doc_vectors=None):
        """doc_vectors: precomputed, L2-normalised document embeddings in `embedder`'s space (optional)."""
        self.papers, self.topics, self.embedder = papers, topics, embedder
        docs = [doc_text(p) for p in papers]
        self.dense = VectorIndex(doc_vectors if doc_vectors is not None else embedder.fit(docs))
        self.topic_vecs = embedder.encode(topics)
        self.tfidf = TfidfVectorizer(analyzer=analyze, sublinear_tf=True)
        self.sparse = normalize(self.tfidf.fit_transform(docs))
        self.entity_terms = [terms(" ".join(p.derived.methods + p.derived.technologies + p.derived.missions + p.derived.entities))
                             for p in papers]

    @property
    def retrieval(self) -> str:
        return self.embedder.name

    def interpret(self, query: str, qv: np.ndarray, k: int = 4) -> list[str]:
        sims = self.topic_vecs @ qv.ravel()
        qt = terms(query)
        scored = []
        for t, s in zip(self.topics, sims):
            lex = len(stem_match(terms(t), qt)) / max(1, len(terms(t)))
            scored.append((0.6 * float(s) + 0.4 * lex, t))
        scored.sort(reverse=True)
        best = scored[0][0] if scored else 0
        return [t for s, t in scored[:k] if s >= 0.3 and s >= 0.6 * best]

    def search(self, query: str, allowed: set[int] | None = None, candidates: int = 300) -> tuple[list[str], list[Scored]]:
        qv = self.embedder.encode([query])[0]
        interpretation = self.interpret(query, qv)
        qterms = terms(query)

        dense_ids, _ = self.dense.top_k(qv, candidates)
        kw_all = (self.sparse @ normalize(self.tfidf.transform([query])).T).toarray().ravel()
        sparse_ids = np.argsort(-kw_all)[:candidates]
        pool = {int(i) for i in dense_ids} | {int(i) for i in sparse_ids if kw_all[i] > 0}
        if allowed is not None:
            pool &= allowed
        if not pool:
            return interpretation, []

        ids = np.fromiter(pool, dtype=int)
        sem = np.clip(self.dense.scores(qv)[ids], 0, 1)
        kw = kw_all[ids] / (kw_all[ids].max() or 1)
        out: list[Scored] = []
        for j, i in enumerate(ids):
            p = self.papers[i]
            on_topics = [t for t in interpretation if t in p.derived.topics]
            topic = len(on_topics) / len(interpretation) if interpretation else 0.0
            ent_hits = stem_match(qterms, self.entity_terms[i])
            entity = min(1.0, len(ent_hits) / max(1, len(qterms)))
            parts = {"semantic": float(sem[j]), "keyword": float(kw[j]), "topic": topic, "entity": entity}
            overall = round(100 * sum(WEIGHTS[k] * v for k, v in parts.items()))
            if overall < MIN_OVERALL:
                continue
            concepts = on_topics + [x for x in p.derived.methods + p.derived.technologies + p.derived.missions
                                    if stem_match(terms(x), qterms)]
            out.append(Scored(int(i), RelevanceBreakdown(
                overall=overall, **{k: round(100 * v) for k, v in parts.items()},
                matched_concepts=list(dict.fromkeys(concepts))[:4],
            )))
        out.sort(key=lambda s: -s.relevance.overall)
        return interpretation, out
