"""Turn rows from a processed export into validated COSMOS papers + a taxonomy, with a report.

Nothing here fabricates data: missing values stay missing, the country comes only from the
affiliation field you map, and NLP fields come only from your pipeline's columns.
"""
import csv
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from ..corpus import slug
from ..schemas import Paper
from .countries import flag, normalize_country

# COSMOS field -> source column names tried in order (first one present wins). Override with --map.
DEFAULT_MAP: dict[str, list[str]] = {
    "paper_id": ["paper_id", "id", "openalex_id", "arxiv_id", "uid"],
    "title": ["title", "paper_title"],
    "abstract": ["abstract", "summary", "abstract_text"],
    "authors": ["authors", "author_names", "author"],
    "publication_date": ["publication_date", "date", "published", "pub_date"],
    "publication_year": ["publication_year", "year", "pub_year"],
    "journal": ["journal", "journal_name", "source"],
    "conference": ["conference", "venue_conference"],
    "publisher": ["publisher"],
    "doi": ["doi"],
    "source_url": ["source_url", "url", "landing_page_url"],
    "open_access_url": ["open_access_url", "oa_url", "pdf_url"],
    "country": ["country", "affiliation_country", "first_author_country", "countries"],
    "organizations": ["organizations", "institutions", "affiliations", "organization"],
    "citation_count": ["citation_count", "cited_by_count", "citations"],
    "reference_count": ["reference_count", "references_count"],
    "research_type": ["research_type", "type", "document_type"],
    "topics": ["topics", "topic_labels", "topic"],
    "subtopics": ["subtopics"],
    "missions": ["missions", "mission"],
    "spacecraft": ["spacecraft"],
    "technologies": ["technologies", "technology"],
    "methods": ["methods", "method"],
    "entities": ["entities", "named_entities"],
    "keywords": ["keywords", "keyphrases"],
    "embedding_reference": ["embedding_reference", "embedding_id"],
}
LIST_FIELDS = {"authors", "organizations", "topics", "subtopics", "missions", "spacecraft", "technologies", "methods", "entities", "keywords"}
DERIVED = {"topics", "subtopics", "missions", "spacecraft", "technologies", "methods", "entities", "keywords", "embedding_reference"}
TYPE_MAP = {"article": "journal-article", "journal-article": "journal-article", "journal article": "journal-article",
            "proceedings-article": "conference-paper", "conference": "conference-paper", "conference-paper": "conference-paper",
            "inproceedings": "conference-paper", "preprint": "preprint", "posted-content": "preprint", "review": "review"}


def read_rows(path: Path) -> list[dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        csv.field_size_limit(10_000_000)
        with path.open(encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))
    if suffix in (".jsonl", ".ndjson"):
        with path.open(encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]
    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else data.get("papers", [])
    if suffix == ".parquet":
        try:
            import pyarrow.parquet as pq
        except ImportError as e:
            raise SystemExit("Reading Parquet needs pyarrow: .venv\\Scripts\\python -m pip install pyarrow") from e
        return pq.read_table(path).to_pylist()
    raise SystemExit(f"Unsupported file type {suffix!r}. Use .csv, .jsonl, .json or .parquet.")


def as_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, (list, tuple)):
        return [str(x).strip() for x in v if x is not None and str(x).strip()]
    s = str(v).strip()
    if not s or s.lower() in ("nan", "none", "null", "[]"):
        return []
    if s.startswith("["):
        try:
            return as_list(json.loads(s))
        except json.JSONDecodeError:
            pass
    return [x.strip() for x in re.split(r"[;|]", s) if x.strip()]


def as_text(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return None if not s or s.lower() in ("nan", "none", "null") else s


def as_int(v: Any) -> int | None:
    s = as_text(v)
    try:
        return int(float(s)) if s is not None else None
    except ValueError:
        return None


def norm_doi(v: Any) -> str | None:
    s = as_text(v)
    return re.sub(r"^(https?://(dx\.)?doi\.org/|doi:)", "", s, flags=re.I).lower() if s else None


@dataclass
class Report:
    rows_in: int = 0
    papers_out: int = 0
    skipped: Counter = field(default_factory=Counter)
    duplicates: int = 0
    missing: Counter = field(default_factory=Counter)
    unknown_countries: Counter = field(default_factory=Counter)
    topics_outside_taxonomy: Counter = field(default_factory=Counter)
    columns_used: dict[str, str] = field(default_factory=dict)
    year_range: tuple[int, int] | None = None

    def to_dict(self) -> dict:
        n = max(1, self.papers_out)
        return {
            "rows_in": self.rows_in, "papers_out": self.papers_out, "skipped": dict(self.skipped),
            "duplicates_removed": self.duplicates, "year_range": self.year_range, "columns_used": self.columns_used,
            "missing_pct": {k: round(100 * v / n, 1) for k, v in sorted(self.missing.items())},
            "countries_without_iso_code": dict(self.unknown_countries.most_common(20)),
            "topics_outside_taxonomy": dict(self.topics_outside_taxonomy.most_common(30)),
        }


def resolve_columns(header: Iterable[str], overrides: dict[str, str]) -> dict[str, str]:
    cols = {c.lower(): c for c in header}
    out = {}
    for f, names in DEFAULT_MAP.items():
        if f in overrides:
            if overrides[f] not in set(header):
                raise SystemExit(f"--map says {f} -> {overrides[f]!r}, but the file has no such column.")
            out[f] = overrides[f]
            continue
        hit = next((cols[n] for n in names if n in cols), None)
        if hit:
            out[f] = hit
    for required in ("title", "abstract"):
        if required not in out:
            raise SystemExit(f"No column found for required field {required!r}. Map it with --map '{{\"{required}\": \"<column>\"}}'.")
    return out


def build(rows: list[dict], taxonomy: dict, overrides: dict[str, str], synthetic: bool = False) -> tuple[list[Paper], dict, Report]:
    rep = Report(rows_in=len(rows))
    if not rows:
        raise SystemExit("The input file has no rows.")
    colmap = resolve_columns(rows[0].keys(), overrides)
    rep.columns_used = colmap
    known_topics = {t for d in taxonomy["domains"] for t in d["topics"]}
    countries: dict[str, dict] = {}
    seen_doi, seen_title, papers = set(), set(), []

    for k, row in enumerate(rows):
        g = lambda f: row.get(colmap[f]) if f in colmap else None  # noqa: E731
        title, abstract = as_text(g("title")), as_text(g("abstract"))
        if not title:
            rep.skipped["no title"] += 1
            continue
        if not abstract:
            rep.skipped["no abstract"] += 1
            continue
        date = as_text(g("publication_date"))
        year = as_int(g("publication_year")) or (int(date[:4]) if date and re.match(r"^\d{4}", date) else None)
        if not year or not 1950 <= year <= 2100:
            rep.skipped["no valid year"] += 1
            continue
        doi = norm_doi(g("doi"))
        tkey = re.sub(r"\W+", " ", title.lower()).strip()
        if (doi and doi in seen_doi) or tkey in seen_title:
            rep.duplicates += 1
            continue
        seen_title.add(tkey)
        if doi:
            seen_doi.add(doi)

        country_raw = as_list(g("country"))
        country, code = normalize_country(country_raw[0] if country_raw else None)
        if country:
            countries.setdefault(country, {"id": (code or slug(country)).lower(), "name": country, "flag": flag(code)})
            if not code:
                rep.unknown_countries[country] += 1

        topics = as_list(g("topics"))
        for t in topics:
            if t not in known_topics:
                rep.topics_outside_taxonomy[t] += 1
        rtype = TYPE_MAP.get((as_text(g("research_type")) or "").lower(), "journal-article" if as_text(g("journal")) else "conference-paper" if as_text(g("conference")) else "journal-article")
        pid = as_text(g("paper_id")) or (f"doi:{doi}" if doi else f"row-{k + 1}")

        data = {
            "paper_id": pid, "title": title, "abstract": abstract, "authors": as_list(g("authors")),
            "publication_date": date or f"{year}-01-01", "publication_year": year,
            "journal": as_text(g("journal")), "conference": as_text(g("conference")), "publisher": as_text(g("publisher")),
            "doi": doi, "source_url": as_text(g("source_url")), "open_access_url": as_text(g("open_access_url")),
            "country": country, "organizations": as_list(g("organizations")),
            "citation_count": as_int(g("citation_count")), "reference_count": as_int(g("reference_count")),
            "research_type": rtype, "is_synthetic": synthetic,
            "derived": {f: (as_list(g(f)) if f in LIST_FIELDS else as_text(g(f))) for f in DERIVED},
        }
        for f in ("authors", "doi", "country", "organizations", "topics", "missions", "technologies", "methods", "citation_count"):
            v = data["derived"].get(f) if f in DERIVED else data.get(f)
            if v in (None, [], ""):
                rep.missing[f] += 1
        papers.append(Paper.model_validate(data))

    ids = Counter(p.paper_id for p in papers)
    if dupes := [i for i, n in ids.items() if n > 1]:
        raise SystemExit(f"paper_id is not unique ({len(dupes)} repeated, e.g. {dupes[:3]}). Map a unique id column.")

    # Topics the pipeline produced that the taxonomy doesn't list go under "Other topics" (reported).
    extra = sorted(rep.topics_outside_taxonomy)
    domains = [dict(d) for d in taxonomy["domains"]]
    if extra:
        domains.append({"id": "other", "name": "Other topics", "icon": "🔭", "topics": extra})
    used = {t for p in papers for t in p.derived.topics}
    domains = [{**d, "topics": [t for t in d["topics"] if t in used]} for d in domains]
    domains = [d for d in domains if d["topics"]]

    rep.papers_out = len(papers)
    ys = [p.publication_year for p in papers]
    rep.year_range = (min(ys), max(ys)) if ys else None
    tax = {"domains": domains, "countries": sorted(countries.values(), key=lambda c: c["name"])}
    return papers, tax, rep
