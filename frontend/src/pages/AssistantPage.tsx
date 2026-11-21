import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnswerCard } from "../components/assistant/AnswerCard";
import { CosmicLoader } from "../components/cosmic/OrbitalDecoration";
import { GlassCard } from "../components/ui/primitives";
import { api } from "../services";
import type { AskResponse } from "../types";

const EXAMPLES = [
  "How is computer vision being used for autonomous spacecraft navigation?",
  "What techniques are used to detect spacecraft faults?",
  "How are spacecraft becoming autonomous?",
  "What research connects robotics and in-space manufacturing?",
];

type Turn = { id: string; question: string } & ({ state: "loading" } | { state: "done"; r: AskResponse } | { state: "error"; message: string });

export function AssistantPage() {
  const [params, setParams] = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const counter = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.state === "loading");

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const id = `t${++counter.current}`;
    setTurns((ts) => [...ts, { id, question: q, state: "loading" }]);
    setText("");
    setParams({ q }, { replace: true });
    try {
      const r = await api.ask({ question: q });
      setTurns((ts) => ts.map((t) => (t.id === id ? { id, question: q, state: "done", r } : t)));
    } catch (e) {
      setTurns((ts) => ts.map((t) => (t.id === id ? { id, question: q, state: "error", message: (e as Error).message } : t)));
    }
  };

  // Deep link: /assistant?q=... (guarded so React's dev double-invoke doesn't ask twice)
  const deepLinked = useRef(false);
  useEffect(() => {
    const q = params.get("q");
    if (q && !deepLinked.current) { deepLinked.current = true; void ask(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns.length]);

  return (
    <div className="container-cosmos max-w-4xl py-10">
      <p className="eyebrow">Research assistant</p>
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Ask the research corpus</h1>
      <p className="mt-2 max-w-2xl text-navy-500">
        Answers are built only from papers retrieved from the corpus, and every claim cites its source. If the corpus doesn't hold enough evidence, the assistant says so.
      </p>

      {turns.length === 0 && (
        <GlassCard className="mt-8 p-6">
          <p className="text-sm font-semibold text-navy-700">Try asking</p>
          <div className="mt-3 flex flex-col gap-2">
            {EXAMPLES.map((q) => (
              <button key={q} type="button" onClick={() => void ask(q)} className="rounded-xl bg-white/60 px-4 py-2.5 text-left text-sm text-navy-700 transition hover:bg-white">{q}</button>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="mt-8 space-y-8" aria-live="polite">
        {turns.map((t) => (
          <section key={t.id} aria-label={`Question: ${t.question}`}>
            <p className="mb-3 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-violet-500 px-4 py-2.5 text-white">{t.question}</p>
            {t.state === "loading" && <CosmicLoader label="Retrieving papers and checking the evidence…" />}
            {t.state === "error" && <GlassCard className="p-4 text-sm text-navy-700">Couldn't reach the research assistant: {t.message}</GlassCard>}
            {t.state === "done" && <AnswerCard r={t.r} id={t.id} />}
          </section>
        ))}
        <div ref={bottom} />
      </div>

      <form className="sticky bottom-4 mt-8" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <label htmlFor="assistant-q" className="sr-only">Your question</label>
        <div className="glass flex items-end gap-2 rounded-2xl p-2">
          <textarea id="assistant-q" value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(text); } }}
            placeholder="Ask a question about space research…"
            className="max-h-40 min-h-[2.75rem] flex-1 resize-y bg-transparent px-3 py-2.5 text-navy-900 placeholder:text-navy-500/60 focus:outline-none" />
          <button type="submit" disabled={busy || !text.trim()} className="h-11 rounded-xl bg-violet-500 px-5 font-medium text-white transition hover:bg-violet-600 disabled:opacity-40">Ask</button>
        </div>
        <p className="mt-1.5 px-2 text-xs text-navy-500">Each question is answered on its own from freshly retrieved papers; earlier answers aren't used as evidence.</p>
      </form>
    </div>
  );
}
