"""Entity co-occurrence graph with progressive expansion.

Every paper contributes a set of entity ids (domain, topic, country, mission, technology, method,
organization). Two entities are linked by the number of papers they share. `neighborhood` returns
only the strongest few links per kind, so the UI can expand one node at a time instead of drawing
a hairball.
"""
from collections import Counter, defaultdict
from typing import Optional

from .corpus import Corpus, slug
from .schemas import GraphEdge, GraphNeighborhood, GraphNode, Paper, YearCount

PER_KIND = 4
ROOT = GraphNode(id="root", kind="root", label="Space Research", paper_count=0)


def entity_ids(p: Paper, corpus: Corpus) -> dict[str, tuple[str, str]]:
    """id -> (kind, label) for every entity on a paper."""
    out: dict[str, tuple[str, str]] = {}
    for t in p.derived.topics:
        out[f"topic:{slug(t)}"] = ("topic", t)
        d = corpus.topic_domain(t)
        if d:
            out[f"domain:{d['id']}"] = ("domain", d["name"])
    if p.country:
        out[f"country:{corpus.country_id(p.country)}"] = ("country", p.country)
    for kind, values in (("mission", p.derived.missions), ("technology", p.derived.technologies),
                         ("method", p.derived.methods), ("organization", p.organizations)):
        for v in values:
            out[f"{kind}:{slug(v)}"] = (kind, v)
    return out


class KnowledgeGraph:
    def __init__(self, corpus: Corpus):
        self.c = corpus
        self.paper_entities = [entity_ids(p, corpus) for p in corpus.papers]
        self.meta: dict[str, tuple[str, str]] = {}
        self.papers_of: dict[str, list[int]] = defaultdict(list)
        for i, ents in enumerate(self.paper_entities):
            for eid, m in ents.items():
                self.meta[eid] = m
                self.papers_of[eid].append(i)
        self.years = corpus.years

    def node(self, eid: str) -> Optional[GraphNode]:
        if eid == "root":
            return ROOT.model_copy(update={"paper_count": len(self.c.papers)})
        if eid not in self.meta:
            return None
        kind, label = self.meta[eid]
        return GraphNode(id=eid, kind=kind, label=label, paper_count=len(self.papers_of[eid]))

    def neighborhood(self, eid: str, per_kind: int = PER_KIND) -> Optional[GraphNeighborhood]:
        center = self.node(eid)
        if center is None:
            return None
        if eid == "root":
            # The map's starting view: every domain branching from the centre.
            domains = [self.node(f"domain:{d['id']}") for d in self.c.domains]
            nodes = [n for n in domains if n]
            edges = [GraphEdge(source="root", target=n.id, weight=n.paper_count) for n in nodes]
            idx = range(len(self.c.papers))
        else:
            idx = self.papers_of[eid]
            co: Counter = Counter(x for i in idx for x in self.paper_entities[i] if x != eid)
            by_kind: dict[str, list[tuple[str, int]]] = defaultdict(list)
            for x, n in co.most_common():
                by_kind[self.meta[x][0]].append((x, n))
            kind = center.kind
            picked: list[tuple[str, int]] = []
            own_topics = set()
            if kind == "domain":
                d = next(d for d in self.c.domains if f"domain:{d['id']}" == eid)
                own_topics = {f"topic:{slug(t)}" for t in d["topics"]}
            for k, items in by_kind.items():
                if kind == "domain" and k == "topic":
                    picked += [x for x in items if x[0] in own_topics]  # a domain expands into exactly its own topics
                elif kind == "domain" and k == "domain":
                    continue  # sibling domains are already on the map via the root
                else:
                    picked += items[:per_kind]  # otherwise keep only the strongest few per kind
            picked.sort(key=lambda x: -x[1])
            nodes = [self.node(x) for x, _ in picked]
            edges = [GraphEdge(source=eid, target=x, weight=n) for x, n in picked]
        years = Counter(self.c.papers[i].publication_year for i in idx)
        return GraphNeighborhood(
            center=center, nodes=nodes, edges=edges,
            yearly=[YearCount(year=y, count=years.get(y, 0)) for y in self.years],
        )
