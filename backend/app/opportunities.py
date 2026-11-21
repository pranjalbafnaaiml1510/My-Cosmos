"""Research Opportunity Explorer: corpus-derived discovery signals for topic intersections.

For every pair of established topics (A, B) we measure:
  closeness  – cosine similarity of the two topics' embedding centroids, computed from papers
               *outside* their overlap, so closeness isn't just a restatement of co-tagging
  gap        – how far the overlap falls below what pairs *this close* typically share. Across all
               pairs we fit  log((overlap + ½) / indep) = α + β·closeness,  with indep = |A|·|B|/N
               (independence, which adjusts for parent sizes). The fitted value gives a "typical"
               overlap for the pair; gap scales the shortfall in residual standard deviations.
  momentum   – growth of the overlap's share in the recent window, relative to corpus growth,
               weighted by evidence (0 below 3 papers, full weight from 8)
  foundation – size of the smaller parent topic relative to the largest topic

score = 0.4·closeness + 0.35·gap + 0.15·momentum + 0.1·foundation (each scaled 0–1).

Two lenses:
  underexplored – overlap below what's typical for its closeness (gap > 0), ranked by score
  growing       – ≥ 3 overlap papers, momentum "increasing" or "new", overlap no larger than the
                  75th percentile of such overlaps; ranked by momentum

These are signals for human investigation, not validated research gaps.
"""
from collections import Counter
from itertools import combinations

import numpy as np

from .corpus import Corpus, slug
from .schemas import Opportunity, OpportunityComponents, OpportunityReport, YearCount

MIN_PARENT = 20
MIN_MOMENTUM_PAPERS = 3   # below this, a trend in the overlap is indistinguishable from noise
FULL_EVIDENCE_PAPERS = 8  # momentum counts fully only once the overlap has this many papers
RECENT_YEARS = 3
W = {"closeness": 0.4, "gap": 0.35, "momentum": 0.15, "foundation": 0.1}


class OpportunityFinder:
    def __init__(self, corpus: Corpus, vectors: np.ndarray, method: str):
        self.c, self.method = corpus, method
        self.vectors = vectors
        self.members = {t: {i for i, p in enumerate(corpus.papers) if t in p.derived.topics} for t in corpus.all_topics}
        self._cache: list[Opportunity] | None = None

    def _centroid(self, idx: set[int]) -> np.ndarray | None:
        if not idx:
            return None
        v = self.vectors[sorted(idx)].mean(axis=0)
        n = np.linalg.norm(v)
        return v / n if n else None

    def _compute(self) -> list[Opportunity]:
        papers, years = self.c.papers, self.c.years
        N, n_base = len(papers), len(years) - RECENT_YEARS
        totals = Counter(p.publication_year for p in papers)
        c_base = sum(totals.get(y, 0) for y in years[:n_base])
        c_recent = sum(totals.get(y, 0) for y in years[n_base:])
        corpus_growth = (c_recent / RECENT_YEARS) / (c_base / n_base) if c_base else 1.0
        topics = [t for t in self.c.all_topics if len(self.members[t]) >= MIN_PARENT]
        biggest = max((len(self.members[t]) for t in topics), default=1)

        raw = []
        for a, b in combinations(topics, 2):
            A, B = self.members[a], self.members[b]
            both = A & B
            ca, cb = self._centroid(A - both), self._centroid(B - both)
            close = float(ca @ cb) if ca is not None and cb is not None else 0.0
            expected = len(A) * len(B) / N
            yc = Counter(papers[i].publication_year for i in both)
            yearly = [YearCount(year=y, count=yc.get(y, 0)) for y in years]
            base = sum(y.count for y in yearly[:n_base])
            recent = sum(y.count for y in yearly[n_base:])
            if len(both) < MIN_MOMENTUM_PAPERS:
                mom_label, mom = "none", 0.0
            elif base == 0:
                mom_label, mom = "new", 1.0
            else:
                ratio = ((recent / RECENT_YEARS) / (base / n_base)) / corpus_growth
                mom_label = "increasing" if ratio >= 1.25 else "decreasing" if ratio <= 0.8 else "steady"
                mom = min(1.0, max(0.0, (ratio - 0.5) / 1.5))
            mom *= min(1.0, len(both) / FULL_EVIDENCE_PAPERS)
            raw.append((a, b, both, close, expected, yearly, recent, mom_label, mom, min(len(A), len(B)) / biggest))

        closes = np.array([r[3] for r in raw])
        lo, hi = (closes.min(), closes.max()) if len(raw) else (0.0, 1.0)
        # Overlap relative to independence, regressed on closeness.
        y = np.array([np.log((len(r[2]) + 0.5) / r[4]) for r in raw])
        beta, alpha = np.polyfit(closes, y, 1) if len(raw) > 2 else (0.0, float(y.mean()) if len(raw) else 0.0)
        fitted = alpha + beta * closes
        sd = float(np.std(y - fitted)) or 1.0
        out = []
        for k, (a, b, both, close, indep, yearly, recent, mom_label, mom, found) in enumerate(raw):
            typical = float(np.exp(fitted[k]) * indep - 0.5)
            comp = {
                "closeness": float((close - lo) / (hi - lo)) if hi > lo else 0.0,
                "gap": float(min(1.0, max(0.0, -(y[k] - fitted[k]) / (2 * sd)))),
                "momentum": mom,
                "foundation": found,
            }
            out.append(self._build(a, b, both, max(0.0, typical), yearly, recent, mom_label, comp))
        return sorted(out, key=lambda o: -o.score)

    def _build(self, a, b, both, expected, yearly, recent, mom_label, comp) -> Opportunity:
        papers = self.c.papers
        A, B = self.members[a], self.members[b]

        def top_shared(values, k=4):
            ca = Counter(v for i in A for v in values(papers[i]))
            cb = Counter(v for i in B for v in values(papers[i]))
            return [v for v, _ in sorted(((v, min(ca[v], cb[v])) for v in set(ca) & set(cb)), key=lambda x: -x[1])[:k]]

        connected = top_shared(lambda p: [t for t in p.derived.topics if t not in (a, b)])
        recent_ids = sorted(both, key=lambda i: papers[i].publication_date, reverse=True)[:5]
        da, db = self.c.topic_domain(a), self.c.topic_domain(b)
        return Opportunity(
            id=f"{slug(a)}|{slug(b)}", topic_a=a, topic_a_id=slug(a), topic_b=b, topic_b_id=slug(b),
            cross_domain=(da or {}).get("id") != (db or {}).get("id"),
            papers=len(both), expected=round(expected, 1), recent=recent, momentum=mom_label,
            score=round(100 * sum(W[k] * v for k, v in comp.items())),
            components=OpportunityComponents(**{k: round(100 * v) for k, v in comp.items()}),
            connected_topics=connected,
            shared_technologies=top_shared(lambda p: p.derived.technologies, 3),
            shared_methods=top_shared(lambda p: p.derived.methods, 3),
            yearly=yearly, sample_paper_ids=[papers[i].paper_id for i in recent_ids],
        )

    def all(self) -> list[Opportunity]:
        if self._cache is None:
            self._cache = self._compute()
        return self._cache

    def report(self, lens: str, limit: int, min_papers: int, cross_domain_only: bool, domain: str | None) -> OpportunityReport:
        items = [o for o in self.all() if o.papers >= min_papers and (not cross_domain_only or o.cross_domain)]
        if domain:
            dom = next((d for d in self.c.domains if d["id"] == domain), None)
            names = set(dom["topics"]) if dom else set()
            items = [o for o in items if o.topic_a in names or o.topic_b in names]
        if lens == "growing":
            pool = [o for o in self.all() if o.papers >= MIN_MOMENTUM_PAPERS]
            cap = float(np.percentile([o.papers for o in pool], 75)) if pool else 0
            items = [o for o in items if o.papers >= MIN_MOMENTUM_PAPERS and o.momentum in ("increasing", "new") and o.papers <= cap]
            items.sort(key=lambda o: (-o.components.momentum, -o.score))
        else:
            items = [o for o in items if o.components.gap > 0]
            items.sort(key=lambda o: -o.score)
        return OpportunityReport(method=self.method, recent_years=RECENT_YEARS, lens=lens, total_pairs=len(items), items=items[:limit])
