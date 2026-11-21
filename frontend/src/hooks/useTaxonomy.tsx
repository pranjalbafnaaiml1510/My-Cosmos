import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../services";
import type { Taxonomy } from "../types";

interface TaxonomyApi extends Taxonomy {
  ready: boolean;
  /** Country id for a country name as stored on papers (undefined if unknown). */
  countryId: (name: string | null | undefined) => string | undefined;
  countryFlag: (name: string | null | undefined) => string;
  domainIcon: (domainId: string) => string;
}

const EMPTY: Taxonomy = { domains: [], countries: [] };
const Ctx = createContext<TaxonomyApi | null>(null);

/** Loads the corpus taxonomy once from the active data source and shares it app-wide. */
export function TaxonomyProvider({ children }: { children: ReactNode }) {
  const [tax, setTax] = useState<Taxonomy | null>(null);
  useEffect(() => {
    // Retry with backoff: the API may still be starting, and a failed load must not stick for the session.
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    const load = (attempt: number) => api.getTaxonomy().then(
      (t) => alive && setTax(t),
      () => { if (alive) timer = setTimeout(() => load(attempt + 1), Math.min(30_000, 1000 * 2 ** attempt)); },
    );
    void load(0);
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  const value = useMemo<TaxonomyApi>(() => {
    const t = tax ?? EMPTY;
    const byName = new Map(t.countries.map((c) => [c.name, c]));
    const icons = new Map(t.domains.map((d) => [d.id, d.icon ?? "🔭"]));
    return {
      ...t,
      ready: tax !== null,
      countryId: (n) => (n ? byName.get(n)?.id : undefined),
      countryFlag: (n) => (n ? byName.get(n)?.flag ?? "" : ""),
      domainIcon: (id) => icons.get(id) ?? "🔭",
    };
  }, [tax]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTaxonomy(): TaxonomyApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTaxonomy must be used inside <TaxonomyProvider>");
  return v;
}
