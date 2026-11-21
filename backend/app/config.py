"""Runtime configuration, read from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    # "mock" serves the synthetic demo corpus; "production" serves data/processed.
    data_mode: str = os.getenv("DATA_MODE", "mock")
    # "auto" uses sentence-transformers when installed, else LSA. Or force "lsa" / "sentence-transformers".
    embedder: str = os.getenv("EMBEDDER", "auto")
    st_model: str = os.getenv("ST_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    # Answer generator: "extractive" (no LLM, default) or "anthropic" (needs requirements-llm.txt + credentials).
    llm_provider: str = os.getenv("LLM_PROVIDER", "extractive")
    llm_model: str = os.getenv("LLM_MODEL", "claude-opus-5-5")
    cors_origins: tuple[str, ...] = tuple(os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(","))

    @property
    def data_dir(self) -> Path:
        if os.getenv("DATA_DIR"):  # explicit override, e.g. a staging copy of the corpus
            return Path(os.environ["DATA_DIR"])
        return ROOT / "data" / ("processed" if self.data_mode == "production" else "mock")


settings = Settings()
