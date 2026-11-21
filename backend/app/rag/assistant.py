"""Grounded question answering over the corpus.

1. interpret  – map the question to taxonomy topics (same as search)
2. retrieve   – hybrid dense + sparse retrieval with reranking (SearchEngine)
3. gate       – refuse to answer when the best evidence is weak
4. generate   – the provider writes an answer citing numbered sources [n]
5. verify     – every [n] must point at a provided source; invalid ones are removed and reported,
                and the share of sentences carrying a citation is measured
"""
import logging
import re

from ..schemas import AskResponse, Grounding, Paper, Source
from ..search.engine import SearchEngine
from .providers import INSUFFICIENT, Passage, Provider

log = logging.getLogger(__name__)

MIN_TOP_RELEVANCE = 35  # best source below this → not enough evidence
MIN_SOURCE_RELEVANCE = 20
_CITE = re.compile(r"\[(\d+)\]")


def verify_citations(answer: str, n_sources: int) -> tuple[str, list[int], Grounding]:
    """Strip citations to non-existent sources and measure how much of the answer is cited."""
    invalid = sorted({int(m) for m in _CITE.findall(answer) if not 1 <= int(m) <= n_sources})
    clean = _CITE.sub(lambda m: m.group(0) if 1 <= int(m.group(1)) <= n_sources else "", answer)
    clean = re.sub(r"\s+([.,;])", r"\1", clean).strip()
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", clean) if s.strip()]
    cited = sorted({int(m) for m in _CITE.findall(clean)})
    grounding = Grounding(
        sentences=len(sentences),
        cited_sentences=sum(1 for s in sentences if _CITE.search(s)),
        invalid_citations=invalid,
    )
    return clean, cited, grounding


class ResearchAssistant:
    def __init__(self, engine: SearchEngine, papers: list[Paper], provider: Provider):
        self.engine, self.papers, self.provider = engine, papers, provider
        self.index = {p.paper_id: i for i, p in enumerate(papers)}

    def ask(self, question: str, paper_id: str | None = None, top_k: int = 6) -> AskResponse:
        allowed = None
        if paper_id is not None:
            if paper_id not in self.index:
                raise KeyError(paper_id)
            allowed = {self.index[paper_id]}
        interpretation, scored = self.engine.search(question, allowed)

        if paper_id is not None:
            # A paper-scoped question always uses that paper as its single source.
            i = self.index[paper_id]
            rel = scored[0].relevance.overall if scored else 0
            picked = [(i, rel)]
        else:
            picked = [(s.index, s.relevance.overall) for s in scored[:top_k] if s.relevance.overall >= MIN_SOURCE_RELEVANCE]

        sources = [Source(n=k + 1, paper=self.papers[i], relevance=r, passage=self.papers[i].abstract)
                   for k, (i, r) in enumerate(picked)]
        base = dict(question=question, interpretation=interpretation, sources=sources,
                    provider=self.provider.name, retrieval=self.engine.retrieval)

        weak = not sources or (paper_id is None and sources[0].relevance < MIN_TOP_RELEVANCE)
        if weak:
            return AskResponse(**base, status="insufficient_evidence", answer=INSUFFICIENT, cited=[],
                               grounding=Grounding(sentences=0, cited_sentences=0, invalid_citations=[]))

        passages = [Passage(n=s.n, title=s.paper.title, year=s.paper.publication_year, text=s.passage) for s in sources]
        try:
            raw = self.provider.generate(question, passages)
        except Exception as e:  # provider/network failure must not crash the endpoint
            log.exception("answer generation failed")
            return AskResponse(**base, status="error", answer=f"The answer generator failed: {type(e).__name__}.", cited=[],
                               grounding=Grounding(sentences=0, cited_sentences=0, invalid_citations=[]))

        if INSUFFICIENT in raw:
            return AskResponse(**base, status="insufficient_evidence", answer=INSUFFICIENT, cited=[],
                               grounding=Grounding(sentences=0, cited_sentences=0, invalid_citations=[]))
        answer, cited, grounding = verify_citations(raw, len(sources))
        if not cited:
            # An answer with no valid citation is not grounded; don't present it as one.
            return AskResponse(**base, status="insufficient_evidence", answer=INSUFFICIENT, cited=[], grounding=grounding)
        return AskResponse(**base, status="answered", answer=answer, cited=cited, grounding=grounding)
