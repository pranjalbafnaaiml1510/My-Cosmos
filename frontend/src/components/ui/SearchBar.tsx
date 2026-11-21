import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function SearchBar({ initial = "", size = "lg", autoFocus = false }: { initial?: string; size?: "lg" | "md"; autoFocus?: boolean }) {
  const [q, setQ] = useState(initial);
  const nav = useNavigate();
  const big = size === "lg";
  return (
    <form role="search" className="relative w-full"
      onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`); }}>
      <label htmlFor="cosmos-search" className="sr-only">Search the research corpus</label>
      <input id="cosmos-search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus}
        placeholder="Ask the research universe…"
        className={`glass w-full rounded-full pl-6 pr-28 text-navy-900 placeholder:text-navy-500/60 focus:border-lavender-300 focus:outline-none focus:ring-4 focus:ring-lavender-200/70 ${big ? "h-16 text-lg" : "h-12 text-base"}`} />
      <button type="submit"
        className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-violet-500 px-5 font-medium text-white transition hover:bg-violet-600 ${big ? "h-12" : "h-9 text-sm"}`}>
        Search
      </button>
    </form>
  );
}
