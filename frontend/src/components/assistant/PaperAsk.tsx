import { useState } from "react";
import { api } from "../../services";
import type { AskResponse } from "../../types";
import { CosmicLoader } from "../cosmic/OrbitalDecoration";
import { GlassCard } from "../ui/primitives";
import { AnswerCard } from "./AnswerCard";

const SUGGESTIONS = ["What method does this paper use?", "Which technology does it rely on?", "What is this paper about?"];

/** Grounded Q&A scoped to a single paper: the paper is the only source. */
export function PaperAsk({ paperId }: { paperId: string }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ s: "idle" } | { s: "loading" } | { s: "done"; r: AskResponse } | { s: "error"; m: string }>({ s: "idle" });
  const ask = async (question: string) => {
    if (!question.trim() || state.s === "loading") return;
    setQ(question);
    setState({ s: "loading" });
    try { setState({ s: "done", r: await api.ask({ question, paper_id: paperId }) }); }
    catch (e) { setState({ s: "error", m: (e as Error).message }); }
  };
  return (
    <GlassCard className="p-6">
      <p className="eyebrow">Ask about this paper</p>
      <p className="mt-1 text-sm text-navy-500">Answers use this paper's abstract as the only source.</p>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
        <label htmlFor="paper-q" className="sr-only">Question about this paper</label>
        <input id="paper-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={1000} placeholder="Ask a question about this paper…"
          className="h-11 flex-1 rounded-full border border-lavender-100 bg-white/70 px-4 text-sm focus:outline-none focus:ring-4 focus:ring-lavender-200/70" />
        <button type="submit" disabled={!q.trim() || state.s === "loading"} className="h-11 rounded-full bg-violet-500 px-5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-40">Ask</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full bg-white/60 px-3 py-1 text-xs text-navy-700 hover:bg-white">{s}</button>)}
      </div>
      <div className="mt-4" aria-live="polite">
        {state.s === "loading" && <CosmicLoader label="Reading the paper…" />}
        {state.s === "error" && <p className="text-sm text-navy-700">Couldn't answer: {state.m}</p>}
        {state.s === "done" && <AnswerCard r={state.r} id={`paper-${paperId}`} compact />}
      </div>
    </GlassCard>
  );
}
