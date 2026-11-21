"""Answer generators behind one interface, so the LLM is swappable.

- ExtractiveProvider (default): no LLM, no cost. Quotes the sentences from the retrieved
  passages that best match the question, each with its [n] citation. It cannot state anything
  the sources don't say.
- AnthropicProvider: Claude via the official SDK (pip install -r requirements-llm.txt,
  LLM_PROVIDER=anthropic). The model is set with LLM_MODEL.

Adding another provider means implementing `generate(question, passages) -> str`.
"""
import logging
import re
from dataclasses import dataclass
from typing import Protocol

from ..search.text import analyze

log = logging.getLogger(__name__)

INSUFFICIENT = "The corpus does not contain enough evidence to answer this."

SYSTEM_PROMPT = f"""You answer questions about space-science research using ONLY the numbered sources provided.

Rules:
- Every factual sentence must end with one or more citations like [1] or [2][3] that point to the sources supporting it.
- Use only information stated in the sources. Do not add background knowledge, numbers, names or claims that are not in them.
- If the sources only partly answer the question, answer that part and say plainly what they do not cover.
- If the sources do not address the question at all, reply with exactly: {INSUFFICIENT}
- Describe what the papers report ("Paper [2] reports..."), not what is true in general. Do not judge which research is most important.
- Plain prose, no headings, at most about 150 words."""


@dataclass
class Passage:
    n: int
    title: str
    year: int
    text: str


class Provider(Protocol):
    name: str

    def generate(self, question: str, passages: list[Passage]) -> str: ...


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 20]


class ExtractiveProvider:
    name = "extractive"

    def __init__(self, max_sentences: int = 4):
        self.max_sentences = max_sentences

    def generate(self, question: str, passages: list[Passage]) -> str:
        q = set(analyze(question))
        scored = []
        for p in passages:
            for rank, s in enumerate(_sentences(p.text)):
                overlap = len(q & set(analyze(s)))
                if overlap:
                    # Prefer overlap, then higher-ranked sources, then earlier sentences.
                    scored.append((overlap, -p.n, -rank, s, p.n))
        if not scored:
            return INSUFFICIENT
        scored.sort(reverse=True)
        picked, seen = [], set()
        for _, _, _, s, n in scored:
            if s in seen:
                continue
            seen.add(s)
            picked.append(f"{s.rstrip('.')} [{n}].")
            if len(picked) == self.max_sentences:
                break
        return " ".join(picked)


class AnthropicProvider:
    def __init__(self, model: str):
        import anthropic  # optional dependency, imported only when this provider is chosen

        self.anthropic = anthropic
        self.client = anthropic.Anthropic()  # credentials from ANTHROPIC_API_KEY / `ant auth login`
        self.model = model
        self.name = f"anthropic:{model}"

    def generate(self, question: str, passages: list[Passage]) -> str:
        sources = "\n\n".join(f"[{p.n}] {p.title} ({p.year})\n{p.text}" for p in passages)
        response = self.client.beta.messages.create(
            model=self.model,
            max_tokens=16000,
            output_config={"effort": "medium"},
            # Server-side refusal fallback: on a safety decline the API retries on a suitable model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Sources:\n\n{sources}\n\nQuestion: {question}"}],
        )
        if response.stop_reason == "refusal":
            log.warning("LLM declined the request: %s", getattr(response.stop_details, "category", None))
            return INSUFFICIENT
        return "".join(b.text for b in response.content if b.type == "text").strip()


def make_provider(kind: str, model: str) -> Provider:
    if kind == "anthropic":
        return AnthropicProvider(model)
    return ExtractiveProvider()
