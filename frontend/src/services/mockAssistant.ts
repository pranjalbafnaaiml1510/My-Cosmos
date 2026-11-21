/**
 * In-browser port of the backend's extractive assistant (backend/app/rag). Same gate, same
 * sentence selection and citation checks; retrieval is the mock adapter's lexical search.
 */
import type { AskRequest, AskResponse, Paper, SearchResponse } from "../types";

export const INSUFFICIENT = "The corpus does not contain enough evidence to answer this.";
const MIN_TOP_RELEVANCE = 35, MIN_SOURCE_RELEVANCE = 20, MAX_SENTENCES = 4;
const STOP = new Set(["what", "are", "the", "how", "being", "used", "which", "for", "and", "with", "this", "that", "does", "paper", "into", "from", "about", "these", "their"]);
const SUFFIXES = ["ations", "ation", "ions", "ion", "ings", "ing", "ers", "er", "ies", "es", "ed", "s"];
const stem = (w: string) => { for (const s of SUFFIXES) if (w.endsWith(s) && w.length - s.length >= 3) return w.slice(0, -s.length) + (s === "ies" ? "y" : ""); return w; };
const terms = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem));
const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);

function extractive(question: string, sources: { n: number; text: string }[]): string {
  const q = terms(question);
  const scored: [number, number, number, string, number][] = [];
  for (const s of sources) sentences(s.text).forEach((sent, rank) => {
    let overlap = 0; terms(sent).forEach((t) => q.has(t) && overlap++);
    if (overlap) scored.push([overlap, -s.n, -rank, sent, s.n]);
  });
  if (!scored.length) return INSUFFICIENT;
  scored.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
  const picked: string[] = [], seen = new Set<string>();
  for (const [, , , sent, n] of scored) {
    if (seen.has(sent)) continue;
    seen.add(sent);
    picked.push(`${sent.replace(/\.$/, "")} [${n}].`);
    if (picked.length === MAX_SENTENCES) break;
  }
  return picked.join(" ");
}

export function buildAssistant(papers: Paper[], search: (q: string, limit: number) => Promise<SearchResponse>) {
  const byId = new Map(papers.map((p) => [p.paper_id, p]));
  return async (req: AskRequest): Promise<AskResponse> => {
    const question = req.question.trim();
    if (!question) throw new Error("Question must not be empty");
    const r = await search(question, 50);
    let picked: { paper: Paper; relevance: number }[];
    if (req.paper_id) {
      const p = byId.get(req.paper_id);
      if (!p) throw new Error("Paper not found");
      picked = [{ paper: p, relevance: r.results.find((x) => x.paper.paper_id === p.paper_id)?.relevance.overall ?? 0 }];
    } else {
      picked = r.results.filter((x) => x.relevance.overall >= MIN_SOURCE_RELEVANCE).slice(0, req.top_k ?? 6).map((x) => ({ paper: x.paper, relevance: x.relevance.overall }));
    }
    const sources = picked.map((x, k) => ({ n: k + 1, paper: x.paper, relevance: x.relevance, passage: x.paper.abstract }));
    const base = { question, interpretation: r.interpretation, sources, provider: "extractive", retrieval: "lexical" as const };
    const none = { sentences: 0, cited_sentences: 0, invalid_citations: [] as number[] };
    if (!sources.length || (!req.paper_id && sources[0].relevance < MIN_TOP_RELEVANCE)) {
      return { ...base, status: "insufficient_evidence", answer: INSUFFICIENT, cited: [], grounding: none };
    }
    const answer = extractive(question, sources.map((s) => ({ n: s.n, text: s.passage })));
    if (answer === INSUFFICIENT) return { ...base, status: "insufficient_evidence", answer, cited: [], grounding: none };
    const sents = answer.split(/(?<=[.!?])\s+/).filter(Boolean);
    const cited = [...new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    return { ...base, status: "answered", answer, cited, grounding: { sentences: sents.length, cited_sentences: sents.filter((s) => /\[\d+\]/.test(s)).length, invalid_citations: [] } };
  };
}
