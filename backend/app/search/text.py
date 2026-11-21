"""Shared text normalisation for sparse and LSA vectorizers."""
import re

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

_TOKEN = re.compile(r"[a-z0-9]+")
# Ordered longest-first; a light suffix stripper (fault/faults, detect/detecting/detection).
_SUFFIXES = ("ations", "ation", "ions", "ion", "ings", "ing", "ers", "er", "ies", "es", "ed", "s")


def stem(w: str) -> str:
    for suf in _SUFFIXES:
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def analyze(text: str) -> list[str]:
    """Lowercase, tokenise, drop stop words, stem; adds bigrams of the stemmed tokens."""
    toks = [stem(t) for t in _TOKEN.findall(text.lower()) if t not in ENGLISH_STOP_WORDS and (len(t) > 1)]
    return toks + [f"{a} {b}" for a, b in zip(toks, toks[1:])]
