"""Text embedders behind one interface.

- NeuralEmbedder: sentence-transformers (install requirements-ml.txt). Best semantic quality.
- LsaEmbedder: TF-IDF + truncated SVD (latent semantic analysis). No extra dependencies; captures
  term co-occurrence so related wording can match without exact overlap.
"""
from __future__ import annotations

import logging
from typing import Protocol

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from .text import analyze

log = logging.getLogger(__name__)


class Embedder(Protocol):
    name: str  # "lsa" | "neural"

    def fit(self, docs: list[str]) -> np.ndarray:
        """Fit on the corpus (if needed) and return L2-normalised document vectors."""

    def encode(self, texts: list[str]) -> np.ndarray:
        """Return L2-normalised vectors for new texts."""


class LsaEmbedder:
    name = "lsa"

    def __init__(self, dims: int = 128, seed: int = 0):
        self.dims, self.seed = dims, seed
        self.vec = TfidfVectorizer(analyzer=analyze, sublinear_tf=True)

    def fit(self, docs: list[str]) -> np.ndarray:
        x = self.vec.fit_transform(docs)
        k = max(2, min(self.dims, x.shape[1] - 1, x.shape[0] - 1))
        self.svd = TruncatedSVD(n_components=k, random_state=self.seed)
        return normalize(self.svd.fit_transform(x))

    def encode(self, texts: list[str]) -> np.ndarray:
        return normalize(self.svd.transform(self.vec.transform(texts)))


class NeuralEmbedder:
    name = "neural"

    def __init__(self, model: str):
        from sentence_transformers import SentenceTransformer  # optional dependency
        self.model = SentenceTransformer(model)

    def fit(self, docs: list[str]) -> np.ndarray:
        return self.encode(docs)

    def encode(self, texts: list[str]) -> np.ndarray:
        return np.asarray(self.model.encode(texts, normalize_embeddings=True, batch_size=64, show_progress_bar=False))


def make_embedder(kind: str, st_model: str) -> Embedder:
    if kind in ("auto", "sentence-transformers"):
        try:
            return NeuralEmbedder(st_model)
        except ImportError:
            if kind != "auto":
                raise
            log.info("sentence-transformers not installed; falling back to LSA embeddings")
    return LsaEmbedder()
