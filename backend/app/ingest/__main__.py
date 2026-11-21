"""Import a processed paper export into COSMOS (writes data/processed/).

  python -m app.ingest papers.parquet
  python -m app.ingest papers.csv --map '{"country": "first_affiliation_country"}' --taxonomy my_taxonomy.json
  python -m app.ingest papers.jsonl --embeddings emb.npy --embedding-ids ids.json --embedding-model sentence-transformers/all-MiniLM-L6-v2
  python -m app.ingest papers.csv --dry-run          # report only, write nothing

Then start the API with DATA_MODE=production.
"""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from ..config import ROOT
from .normalize import build, read_rows

DEFAULT_TAXONOMY = ROOT / "data" / "mock" / "taxonomy.json"


def load_embeddings(path: Path, ids_path: Path, paper_ids: list[str]) -> tuple[np.ndarray, list[str]]:
    vecs = np.load(path).astype("float32")
    raw = ids_path.read_text(encoding="utf-8")
    ids = json.loads(raw) if ids_path.suffix == ".json" else [l.strip() for l in raw.splitlines() if l.strip()]
    if vecs.ndim != 2 or len(ids) != vecs.shape[0]:
        raise SystemExit(f"Embeddings shape {vecs.shape} doesn't match {len(ids)} ids.")
    if not np.isfinite(vecs).all():
        raise SystemExit("Embeddings contain NaN or infinite values.")
    pos = {pid: i for i, pid in enumerate(ids)}
    missing = [pid for pid in paper_ids if pid not in pos]
    if missing:
        raise SystemExit(f"{len(missing)} imported papers have no embedding (e.g. {missing[:3]}). Ids must match paper_id.")
    aligned = vecs[[pos[pid] for pid in paper_ids]]
    norms = np.linalg.norm(aligned, axis=1, keepdims=True)
    return aligned / np.where(norms == 0, 1, norms), paper_ids


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.ingest", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", type=Path)
    ap.add_argument("--map", default="{}", help='JSON mapping COSMOS field -> your column, e.g. \'{"country": "aff_country"}\'')
    ap.add_argument("--taxonomy", type=Path, default=DEFAULT_TAXONOMY, help="taxonomy.json with domains[{id,name,topics[]}]")
    ap.add_argument("--embeddings", type=Path, help=".npy matrix of paper embeddings")
    ap.add_argument("--embedding-ids", type=Path, help="paper ids for each embedding row (.json list or one per line)")
    ap.add_argument("--embedding-model", help="sentence-transformers model that produced the embeddings (needed to embed queries)")
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "processed")
    ap.add_argument("--synthetic", action="store_true", help="mark every record as synthetic/test data (shows the demo-data notices in the UI)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)

    if bool(a.embeddings) != bool(a.embedding_ids):
        ap.error("--embeddings and --embedding-ids go together")
    if a.embeddings and not a.embedding_model:
        ap.error("--embedding-model is required with --embeddings: queries must be embedded with the same model")

    taxonomy = json.loads(a.taxonomy.read_text(encoding="utf-8"))
    papers, tax, report = build(read_rows(a.input), taxonomy, json.loads(a.map), a.synthetic)
    emb = load_embeddings(a.embeddings, a.embedding_ids, [p.paper_id for p in papers]) if a.embeddings else None

    print(json.dumps(report.to_dict(), indent=2, ensure_ascii=False))
    if a.dry_run:
        print("\nDry run: nothing written.", file=sys.stderr)
        return 0

    a.out.mkdir(parents=True, exist_ok=True)
    papers_json = json.dumps([p.model_dump() for p in papers], ensure_ascii=False)
    (a.out / "papers.json").write_text(papers_json, encoding="utf-8")
    (a.out / "taxonomy.json").write_text(json.dumps(tax, indent=2, ensure_ascii=False), encoding="utf-8")
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_file": a.input.name, "papers": len(papers), "synthetic": a.synthetic,
        "papers_sha256": hashlib.sha256(papers_json.encode("utf-8")).hexdigest(),
        "embeddings": None, "report": report.to_dict(),
    }
    for stale in ("embeddings.npy", "embeddings.json"):
        (a.out / stale).unlink(missing_ok=True)
    if emb is not None:
        np.save(a.out / "embeddings.npy", emb[0])
        meta = {"model": a.embedding_model, "dims": int(emb[0].shape[1]), "rows": int(emb[0].shape[0]), "paper_ids_sha256": manifest["papers_sha256"]}
        (a.out / "embeddings.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        manifest["embeddings"] = meta
    (a.out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {len(papers)} papers to {a.out}. Start the API with DATA_MODE=production.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
