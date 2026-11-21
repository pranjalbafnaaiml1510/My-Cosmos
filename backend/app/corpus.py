"""Loads the fixed research corpus once at startup. No scraping, no daily ingestion."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path

from .schemas import Paper


def slug(s: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))


@dataclass
class Corpus:
    papers: list[Paper]
    domains: list[dict]    # {id, name, icon?, topics[]}
    countries: list[dict]  # {id, name, flag}

    @classmethod
    def load(cls, data_dir: Path) -> "Corpus":
        papers_path, tax_path = data_dir / "papers.json", data_dir / "taxonomy.json"
        if not papers_path.exists():
            raise FileNotFoundError(
                f"{papers_path} not found. For demo data run `npm run export:mock` in frontend/; "
                "for production place the processed corpus in data/processed/."
            )
        papers = [Paper.model_validate(p) for p in json.loads(papers_path.read_text(encoding="utf-8"))]
        tax = json.loads(tax_path.read_text(encoding="utf-8"))
        return cls(papers=papers, domains=tax["domains"], countries=tax["countries"])

    @cached_property
    def by_id(self) -> dict[str, Paper]:
        return {p.paper_id: p for p in self.papers}

    @cached_property
    def years(self) -> list[int]:
        ys = [p.publication_year for p in self.papers]
        return list(range(min(ys), max(ys) + 1))

    @cached_property
    def all_topics(self) -> list[str]:
        return [t for d in self.domains for t in d["topics"]]

    @cached_property
    def all_missions(self) -> list[str]:
        return sorted({m for p in self.papers for m in p.derived.missions})

    def topic_domain(self, topic: str) -> dict | None:
        return next((d for d in self.domains if topic in d["topics"]), None)

    def country_id(self, name: str) -> str:
        return next((c["id"] for c in self.countries if c["name"] == name), slug(name))
