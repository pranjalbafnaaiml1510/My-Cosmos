"""Research evolution: per-topic growth statistics and activity series.

Status rules (corpus signals, not judgements of scientific importance):
  emerging  – growth_ratio ≥ 1.5, z ≥ 2 and at least 5 recent papers
  growing   – growth_ratio ≥ 1.15 and z ≥ 1
  declining – growth_ratio ≤ 0.75 and z ≤ −1.5
  stable    – everything else
Growth is measured relative to the whole corpus, so a topic only shows a signal when its *share*
of papers rises (the corpus itself may grow every year). growth_ratio = topic's recent/baseline
rate ÷ corpus's recent/baseline rate. z compares the recent count with the count the topic's
baseline share predicts, using a Poisson approximation.
"""
import math
from collections import Counter
from functools import lru_cache
from typing import Callable

from .corpus import Corpus, slug
from .schemas import Paper, SeriesRow, TopicTrend, TrendReport, YearCount


def classify(ratio: float, z: float, recent: int) -> str:
    if ratio >= 1.5 and z >= 2 and recent >= 5:
        return "emerging"
    if ratio >= 1.15 and z >= 1:
        return "growing"
    if ratio <= 0.75 and z <= -1.5:
        return "declining"
    return "stable"


def slope(xs: list[int], ys: list[int]) -> float:
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den if den else 0.0


class Trends:
    def __init__(self, corpus: Corpus):
        self.c = corpus

    def _yearly(self, papers: list[Paper]) -> list[YearCount]:
        counts = Counter(p.publication_year for p in papers)
        return [YearCount(year=y, count=counts.get(y, 0)) for y in self.c.years]

    def _series(self, values: Callable[[Paper], list[str]], to_id: Callable[[str], str], limit: int) -> list[SeriesRow]:
        groups: dict[str, list[Paper]] = {}
        for p in self.c.papers:
            for v in values(p):
                groups.setdefault(v, []).append(p)
        rows = [SeriesRow(id=to_id(k), label=k, yearly=self._yearly(ps), total=len(ps)) for k, ps in groups.items()]
        return sorted(rows, key=lambda r: -r.total)[:limit]

    @lru_cache(maxsize=8)  # the corpus is fixed, so a report never changes for a given window
    def report(self, recent_years: int = 3) -> TrendReport:
        years = self.c.years
        recent_years = max(1, min(recent_years, len(years) - 2))
        n_base = len(years) - recent_years
        totals = self._yearly(self.c.papers)
        c_base = sum(y.count for y in totals[:n_base])
        c_recent = sum(y.count for y in totals[n_base:])
        corpus_growth = (c_recent / recent_years) / (c_base / n_base) if c_base else 1.0
        topics = []
        for d in self.c.domains:
            for name in d["topics"]:
                yearly = self._yearly([p for p in self.c.papers if name in p.derived.topics])
                counts = [y.count for y in yearly]
                base, recent = sum(counts[:n_base]), sum(counts[n_base:])
                base_rate = base / n_base
                expected = base_rate * recent_years * corpus_growth  # what the topic's baseline share predicts
                raw = (recent / recent_years) / base_rate if base_rate else (float("inf") if recent else 1.0)
                ratio = raw / corpus_growth
                z = (recent - expected) / math.sqrt(max(expected, 1.0))
                topics.append(TopicTrend(
                    topic_id=slug(name), topic=name, domain_id=d["id"], yearly=yearly, total=base + recent, recent=recent,
                    baseline_rate=round(base_rate, 2), recent_rate=round(recent / recent_years, 2),
                    growth_ratio=round(min(ratio, 99.0), 2), slope=round(slope(years, counts), 2), z=round(z, 2),
                    status=classify(ratio, z, recent),
                ))
        topics.sort(key=lambda t: -t.z)
        return TrendReport(
            years=years, recent_years=recent_years, corpus_growth=round(corpus_growth, 2), totals=totals, topics=topics,
            countries=self._series(lambda p: [p.country] if p.country else [], self.c.country_id, 12),
            technologies=self._series(lambda p: p.derived.technologies, slug, 12),
            methods=self._series(lambda p: p.derived.methods, slug, 12),
        )
