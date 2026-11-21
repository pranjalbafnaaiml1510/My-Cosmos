"""Importer tests on a deliberately messy export."""
import csv
import json

import numpy as np
import pytest

from app.ingest.__main__ import main
from app.ingest.countries import flag, normalize_country

ROWS = [
    # id, title, abstract, year, date, doi, country, orgs, topics, methods
    ["p1", "Optical navigation for small bodies", "We study optical navigation. Results are reported.", "2021", "", "10.1/ABC", "USA", "JPL; Caltech", '["Spacecraft Navigation", "Computer Vision"]', "Deep Learning"],
    ["p2", "Optical Navigation for Small Bodies!", "Same paper, different punctuation.", "2021", "", "", "U.S.", "JPL", "Spacecraft Navigation", ""],  # title dupe
    ["p3", "Hall thruster erosion", "Erosion of Hall thrusters is measured.", "", "2019-05-02", "https://doi.org/10.1/abc", "Germany", "DLR", "Electric Propulsion", "Monte Carlo Simulation"],  # doi dupe of p1
    ["p4", "No abstract here", "", "2020", "", "", "India", "ISRO", "Lunar Exploration", ""],
    ["p5", "Plasma wakes", "Plasma wakes behind probes are simulated.", "2022", "", "10.2/x", "Atlantis", "", "Plasma Wake Physics|Space Weather", ""],
    ["p6", "Lunar regolith sintering", "Sintering of regolith is tested.", "2018", "", "", "", "ESA", "In-Space Manufacturing", ""],
]
HEADER = ["id", "title", "abstract", "year", "date", "doi", "affiliation_country", "institutions", "topics", "methods"]


@pytest.fixture()
def export(tmp_path):
    path = tmp_path / "papers.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(ROWS)
    return path


def run(tmp_path, *args):
    out = tmp_path / "processed"
    assert main([*map(str, args), "--out", str(out)]) == 0
    return out


def test_import_cleans_dedupes_and_reports(export, tmp_path):
    out = run(tmp_path, export)
    papers = {p["paper_id"]: p for p in json.loads((out / "papers.json").read_text(encoding="utf-8"))}
    assert set(papers) == {"p1", "p5", "p6"}  # p2 title-dupe, p3 doi-dupe, p4 no abstract
    p1 = papers["p1"]
    assert p1["country"] == "United States" and p1["organizations"] == ["JPL", "Caltech"]
    assert p1["derived"]["topics"] == ["Spacecraft Navigation", "Computer Vision"] and p1["doi"] == "10.1/abc"
    assert p1["is_synthetic"] is False
    assert papers["p6"]["country"] is None, "missing country stays missing, never inferred"

    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    rep = manifest["report"]
    assert rep["rows_in"] == 6 and rep["papers_out"] == 3 and rep["duplicates_removed"] == 2
    assert rep["skipped"] == {"no abstract": 1}
    assert rep["countries_without_iso_code"] == {"Atlantis": 1}
    assert rep["topics_outside_taxonomy"] == {"Plasma Wake Physics": 1}

    tax = json.loads((out / "taxonomy.json").read_text(encoding="utf-8"))
    other = next(d for d in tax["domains"] if d["id"] == "other")
    assert other["topics"] == ["Plasma Wake Physics"]
    assert {c["name"]: c["flag"] for c in tax["countries"]} == {"Atlantis": "", "United States": "🇺🇸"}


def test_dry_run_writes_nothing(export, tmp_path):
    out = tmp_path / "processed"
    assert main([str(export), "--dry-run", "--out", str(out)]) == 0
    assert not out.exists()


def test_bad_map_column_fails_clearly(export, tmp_path):
    with pytest.raises(SystemExit, match="no such column"):
        main([str(export), "--map", '{"country": "nope"}', "--out", str(tmp_path / "o")])


def test_embeddings_aligned_to_paper_order(export, tmp_path):
    ids = ["p6", "p5", "p1", "p3"]  # different order, includes a dropped paper
    vecs = np.array([[6, 0], [5, 0], [1, 0], [3, 0]], dtype="float32")
    np.save(tmp_path / "e.npy", vecs)
    (tmp_path / "ids.json").write_text(json.dumps(ids))
    out = run(tmp_path, export, "--embeddings", tmp_path / "e.npy", "--embedding-ids", tmp_path / "ids.json", "--embedding-model", "m")
    order = [p["paper_id"] for p in json.loads((out / "papers.json").read_text(encoding="utf-8"))]
    saved = np.load(out / "embeddings.npy")
    assert saved.shape == (3, 2) and np.allclose(np.linalg.norm(saved, axis=1), 1)
    assert json.loads((out / "embeddings.json").read_text())["model"] == "m"
    assert order == ["p1", "p5", "p6"]


def test_embeddings_missing_rows_fail(export, tmp_path):
    np.save(tmp_path / "e.npy", np.ones((1, 2), dtype="float32"))
    (tmp_path / "ids.json").write_text(json.dumps(["p1"]))
    with pytest.raises(SystemExit, match="have no embedding"):
        main([str(export), "--embeddings", str(tmp_path / "e.npy"), "--embedding-ids", str(tmp_path / "ids.json"),
              "--embedding-model", "m", "--out", str(tmp_path / "o")])


def test_country_normalisation():
    assert normalize_country("U.S.A.") == ("United States", "US")
    assert normalize_country("People's Republic of China") == ("China", "CN")
    assert normalize_country("  ") == (None, None)
    assert flag("IN") == "🇮🇳" and flag(None) == ""


def test_synthetic_flag_marks_records(export, tmp_path):
    out = run(tmp_path, export, "--synthetic")
    papers = json.loads((out / "papers.json").read_text(encoding="utf-8"))
    assert papers and all(p["is_synthetic"] for p in papers)
    assert json.loads((out / "manifest.json").read_text(encoding="utf-8"))["synthetic"] is True
