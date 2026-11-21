"""Corpus aggregations: stats, topics, countries, missions, trends, facets and paper queries.

Results that never change for a fixed corpus are cached with lru_cache.
"""
from __future__ import annotations

from collections import Counter
from functools import lru_cache
from typing import Callable, Iterable, Optional

from .corpus import Corpus, slug
from .schemas import (
    CorpusStats, CountrySummary, Domain, EmergingSignal, EntityProfile, FacetValue, Facets,
    MissionSummary, Page, Paper, PaperRow, Ranked, TopicLink, TopicSummary, YearCount,
)

RECENT_YEARS = 3
FACET_FIELDS: dict[str, Callable[[Paper], list[str]]] = {
    "country": lambda p: [p.country] if p.country else [],
    "topic": lambda p: p.derived.topics,
    "mission": lambda p: p.derived.missions,
    "organization": lambda p: p.organizations,
    "technology": lambda p: p.derived.technologies,
    "method": lambda p: p.derived.methods,
}


class Analytics:
    def __init__(self, corpus: Corpus):
        self.c = corpus

    # ---------- helpers ----------
    def yearly(self, papers: Iterable[Paper]) -> list[YearCount]:
        counts = Counter(p.publication_year for p in papers)
        return [YearCount(year=y, count=counts.get(y, 0)) for y in self.c.years]

    @staticmethod
    def rank(values: Iterable[str], to_id: Callable[[str], str] = slug) -> list[Ranked]:
        return [Ranked(id=to_id(v), value=v, count=n) for v, n in Counter(values).most_common()]

    def with_topic(self, topic: str) -> list[Paper]:
        return [p for p in self.c.papers if topic in p.derived.topics]

    def emerging_within(self, papers: list[Paper], min_papers: int = 8) -> list[EmergingSignal]:
        """Growth of each topic's share within `papers`: (topic recent/baseline rate) ÷ (subset recent/baseline rate).
        A corpus signal, not a judgement of importance."""
        span_base = len(self.c.years) - RECENT_YEARS
        all_yearly = self.yearly(papers)
        sub_base = sum(y.count for y in all_yearly[:-RECENT_YEARS]) / span_base
        sub_growth = (sum(y.count for y in all_yearly[-RECENT_YEARS:]) / RECENT_YEARS) / sub_base if sub_base else 1.0
        out = []
        for name in self.c.all_topics:
            tp = [p for p in papers if name in p.derived.topics]
            if len(tp) < min_papers:
                continue
            yearly = self.yearly(tp)
            recent = sum(y.count for y in yearly[-RECENT_YEARS:])
            base_rate = (sum(y.count for y in yearly[:-RECENT_YEARS]) / span_base) or 0.5
            out.append(EmergingSignal(topic_id=slug(name), topic=name, paper_count=len(tp), recent_count=recent,
                                      growth_ratio=(recent / RECENT_YEARS / base_rate) / (sub_growth or 1.0), yearly=yearly))
        return sorted(out, key=lambda s: -s.growth_ratio)

    # ---------- endpoints ----------
    @lru_cache(maxsize=1)
    def stats(self) -> CorpusStats:
        ps = self.c.papers
        return CorpusStats(
            papers=len(ps), countries=len({p.country for p in ps if p.country}), topics=len(self.c.all_topics),
            organizations=len({o for p in ps for o in p.organizations}), missions=len(self.c.all_missions),
            year_range=(self.c.years[0], self.c.years[-1]),
            synthetic=any(p.is_synthetic for p in ps),
        )

    @lru_cache(maxsize=1)
    def domains(self) -> list[Domain]:
        return [Domain(id=d["id"], name=d["name"], topics=d["topics"],
                       paper_count=sum(1 for p in self.c.papers if set(p.derived.topics) & set(d["topics"])))
                for d in self.c.domains]

    @lru_cache(maxsize=1)
    def topics(self) -> list[TopicSummary]:
        n = len(self.c.papers)
        out = []
        for d in self.c.domains:
            for name in d["topics"]:
                ps = self.with_topic(name)
                out.append(TopicSummary(id=slug(name), name=name, domain_id=d["id"], paper_count=len(ps),
                                        share=len(ps) / n, yearly=self.yearly(ps)))
        return out

    @lru_cache(maxsize=8)
    def topic_links(self, limit: int = 40) -> list[TopicLink]:
        pairs = Counter()
        for p in self.c.papers:
            ts = sorted({slug(t) for t in p.derived.topics})
            for i, a in enumerate(ts):
                for b in ts[i + 1:]:
                    pairs[(a, b)] += 1
        return [TopicLink(source=a, target=b, weight=w) for (a, b), w in pairs.most_common(limit)]

    @lru_cache(maxsize=1)
    def countries(self) -> list[CountrySummary]:
        out = []
        for c in self.c.countries:
            ps = [p for p in self.c.papers if p.country == c["name"]]
            top = Counter(t for p in ps for t in p.derived.topics).most_common(3)
            out.append(CountrySummary(id=c["id"], name=c["name"], flag=c["flag"], paper_count=len(ps),
                                      top_topics=[t for t, _ in top],
                                      organizations=len({o for p in ps for o in p.organizations})))
        return sorted(out, key=lambda x: -x.paper_count)

    @lru_cache(maxsize=1)
    def missions(self) -> list[MissionSummary]:
        out = []
        for m in self.c.all_missions:
            ps = [p for p in self.c.papers if m in p.derived.missions]
            out.append(MissionSummary(id=slug(m), name=m, paper_count=len(ps), countries=len({p.country for p in ps}),
                                      top_topics=[r.value for r in self.rank(t for p in ps for t in p.derived.topics)[:3]]))
        return sorted(out, key=lambda x: -x.paper_count)

    def recent(self, limit: int) -> list[Paper]:
        return sorted(self.c.papers, key=lambda p: p.publication_date, reverse=True)[:limit]

    def profile(self, kind: str, id: str) -> Optional[EntityProfile]:
        name, badge, ps = None, None, []
        if kind == "topic":
            name = next((t for t in self.c.all_topics if slug(t) == id), None)
            if name:
                badge = (self.c.topic_domain(name) or {}).get("name")
                ps = self.with_topic(name)
        elif kind == "country":
            c = next((c for c in self.c.countries if c["id"] == id), None)
            if c:
                name, badge = c["name"], c["flag"]
                ps = [p for p in self.c.papers if p.country == name]
        elif kind == "mission":
            name = next((m for m in self.c.all_missions if slug(m) == id), None)
            if name:
                ps = [p for p in self.c.papers if name in p.derived.missions]
        if not name:
            return None
        topics = [r for r in self.rank(t for p in ps for t in p.derived.topics) if kind != "topic" or r.value != name]
        return EntityProfile(
            kind=kind, id=id, name=name, badge=badge, paper_count=len(ps), share=len(ps) / len(self.c.papers),
            country_count=len({p.country for p in ps}), organization_count=len({o for p in ps for o in p.organizations}),
            yearly=self.yearly(ps), top_topics=topics[:8],
            top_countries=self.rank((p.country for p in ps if p.country), self.c.country_id)[:8],
            top_organizations=self.rank(o for p in ps for o in p.organizations)[:6],
            top_missions=self.rank(m for p in ps for m in p.derived.missions)[:6],
            top_technologies=self.rank(t for p in ps for t in p.derived.technologies)[:6],
            top_methods=self.rank(m for p in ps for m in p.derived.methods)[:6],
            emerging=[] if kind == "topic" else self.emerging_within(ps)[:3],
        )

    @lru_cache(maxsize=1)
    def facets(self) -> Facets:
        vals = {k: [FacetValue(value=v, count=n) for v, n in Counter(x for p in self.c.papers for x in fn(p)).most_common()]
                for k, fn in FACET_FIELDS.items()}
        return Facets(**vals, years=(self.c.years[0], self.c.years[-1]))

    def filter(self, papers: Iterable[Paper], year_from: Optional[int] = None, year_to: Optional[int] = None,
               **facets: Optional[list[str]]) -> list[Paper]:
        out = []
        for p in papers:
            if year_from and p.publication_year < year_from:
                continue
            if year_to and p.publication_year > year_to:
                continue
            if all(not want or set(FACET_FIELDS[k](p)) & set(want) for k, want in facets.items()):
                out.append(p)
        return out

    def query_papers(self, rows: list[PaperRow], sort: Optional[str], order: Optional[str], page: int, page_size: int,
                     has_query: bool) -> Page[PaperRow]:
        sort = sort or ("relevance" if has_query else "publication_year")
        asc = (order or ("asc" if sort in ("title", "country") else "desc")) == "asc"
        keys = {
            "relevance": lambda r: r.relevance or 0,
            "title": lambda r: r.paper.title,
            "country": lambda r: r.paper.country or "",
            "publication_year": lambda r: r.paper.publication_date,
        }
        rows = sorted(rows, key=keys.get(sort, keys["publication_year"]), reverse=not asc)
        page = max(1, page)
        return Page[PaperRow](items=rows[(page - 1) * page_size: page * page_size], total=len(rows),
                              page=page, page_size=page_size)
