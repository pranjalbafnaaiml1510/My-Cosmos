"""Exact inner-product vector index. Uses FAISS when installed, NumPy otherwise.

At ~10k documents exact search is fast either way; FAISS matters as the corpus grows.
"""
from __future__ import annotations

import numpy as np


class VectorIndex:
    def __init__(self, vectors: np.ndarray):
        self.vectors = vectors.astype("float32")
        try:
            import faiss  # optional
            self._faiss = faiss.IndexFlatIP(self.vectors.shape[1])
            self._faiss.add(self.vectors)
        except ImportError:
            self._faiss = None

    def scores(self, q: np.ndarray) -> np.ndarray:
        """Cosine similarity of q against every document (vectors are pre-normalised)."""
        return self.vectors @ q.astype("float32").ravel()

    def top_k(self, q: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
        k = min(k, len(self.vectors))
        if self._faiss is not None:
            d, i = self._faiss.search(q.astype("float32").reshape(1, -1), k)
            return i[0], d[0]
        s = self.scores(q)
        idx = np.argpartition(-s, k - 1)[:k]
        idx = idx[np.argsort(-s[idx])]
        return idx, s[idx]
