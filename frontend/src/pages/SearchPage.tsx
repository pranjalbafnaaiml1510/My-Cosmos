import { useSearchParams } from "react-router-dom";
import { PaperCard } from "../components/research/cards";
import { SearchBar } from "../components/ui/SearchBar";
import { AsyncView, Chip, EmptyState } from "../components/ui/primitives";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services";
import type { SearchResponse } from "../types";

const RETRIEVAL_NOTE: Record<SearchResponse["retrieval"], string> = {
  lexical: "Demo mode: in-browser term overlap over synthetic records. Run the backend for semantic retrieval.",
  lsa: "Hybrid retrieval: latent semantic embeddings + TF-IDF keywords, reranked with topic and entity matches.",
  neural: "Hybrid retrieval: neural sentence embeddings + TF-IDF keywords, reranked with topic and entity matches.",
};

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const s = useAsync(() => api.search(q), [q]);
  return (
    <div className="container-cosmos py-10">
      <div className="max-w-2xl"><SearchBar key={q} initial={q} size="md" /></div>
      <AsyncView state={s} loading="Searching the research universe…">
        {(r) => (
          <>
            <p className="mt-3 text-xs text-navy-500">{RETRIEVAL_NOTE[r.retrieval]}</p>
            <div className="mt-8">
              <p className="eyebrow">Search results</p>
              <h1 className="mt-1 text-2xl font-semibold">“{r.query}”</h1>
              {r.interpretation.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-navy-500">Interpreted as: {r.interpretation.map((t) => <Chip key={t}>{t}</Chip>)}</p>
              )}
              <p className="mt-2 text-sm tabular-nums text-navy-500">{r.total.toLocaleString()} matching papers</p>
            </div>
            <div className="mt-6 space-y-4">
              {r.results.length
                ? r.results.map((x) => <PaperCard key={x.paper.paper_id} paper={x.paper} relevance={x.relevance} lexical={r.retrieval === "lexical"} />)
                : <EmptyState title="No strong semantic connection found." hint="Try broader wording, or a topic like “electric propulsion”." />}
            </div>
          </>
        )}
      </AsyncView>
    </div>
  );
}
