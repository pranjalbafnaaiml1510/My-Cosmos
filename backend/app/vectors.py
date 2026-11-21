"""Choose document vectors and a query encoder at startup.

Order of preference:
1. Saved embeddings from the NLP pipeline (data/<mode>/embeddings.npy + embeddings.json).
   - Paper-to-paper features (recommendations, opportunity closeness) always use them.
   - Search uses them only if the producing model is installed to embed queries in the same space;
     otherwise search falls back to LSA (two embedding spaces are never mixed).
2. Otherwise embed the corpus here (EMBEDDER=auto|lsa|sentence-transformers). Neural embeddings are
   cached in data/<mode>/.cache/ keyed by model and corpus checksum, so restarts are fast.
"""
import hashlib
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .schemas import Paper
from .search.embedders import Embedder, LsaEmbedder, NeuralEmbedder, make_embedder

log = logging.getLogger("cosmos.vectors")


@dataclass
class VectorSetup:
    search_embedder: Embedder
    search_doc_vectors: np.ndarray | None  # None → SearchEngine fits the embedder itself
    similarity_vectors: np.ndarray | None  # None → reuse the search vectors
    similarity_method: str                 # "lsa" | "neural", reported to the UI
    note: str


def corpus_checksum(papers: list[Paper]) -> str:
    h = hashlib.sha256()
    for p in papers:
        h.update(p.paper_id.encode())
        h.update(p.abstract.encode())
    return h.hexdigest()[:16]


def _load_saved(data_dir: Path, papers: list[Paper]) -> tuple[np.ndarray, dict] | None:
    meta_path, vec_path = data_dir / "embeddings.json", data_dir / "embeddings.npy"
    if not (meta_path.exists() and vec_path.exists()):
        return None
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    vecs = np.load(vec_path).astype("float32")
    if vecs.shape[0] != len(papers):
        raise RuntimeError(f"embeddings.npy has {vecs.shape[0]} rows but the corpus has {len(papers)} papers. Re-run the importer.")
    manifest = data_dir / "manifest.json"
    if manifest.exists() and meta.get("paper_ids_sha256") != json.loads(manifest.read_text(encoding="utf-8")).get("papers_sha256"):
        raise RuntimeError("embeddings.npy was written for a different papers.json. Re-run the importer.")
    return vecs, meta


def setup_vectors(papers: list[Paper], data_dir: Path, embedder_kind: str, st_model: str, docs: list[str]) -> VectorSetup:
    saved = _load_saved(data_dir, papers)
    if saved:
        vecs, meta = saved
        try:
            enc = NeuralEmbedder(meta["model"])
            return VectorSetup(enc, vecs, None, "neural", f"saved embeddings ({meta['model']}) for search and similarity")
        except Exception as e:  # not installed (ImportError) or the model can't be loaded (bad name, offline)
            log.warning("Can't load %s to embed queries (%s): search falls back to LSA; "
                        "similarity features still use the saved embeddings.", meta["model"], type(e).__name__)
            return VectorSetup(LsaEmbedder(), None, vecs, "neural", "LSA search; saved embeddings for similarity")

    emb = make_embedder(embedder_kind, st_model)
    if emb.name != "neural":
        return VectorSetup(emb, None, None, "lsa", "LSA embeddings computed at startup")
    cache = data_dir / ".cache" / f"neural-{re.sub(r'[^a-z0-9]+', '-', st_model.lower())}-{corpus_checksum(papers)}.npy"
    if cache.exists():
        log.info("Using cached embeddings %s", cache.name)
        return VectorSetup(emb, np.load(cache), None, "neural", "cached neural embeddings")
    vecs = emb.fit(docs)
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.save(cache, vecs)
    return VectorSetup(emb, vecs, None, "neural", "neural embeddings computed and cached")
