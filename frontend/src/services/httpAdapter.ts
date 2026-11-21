/** Production adapter: talks to the FastAPI backend. Endpoint shapes mirror ../types. */
import type { DataSource } from "./dataSource";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8010";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

async function getOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

export const httpAdapter: DataSource = {
  getStats: () => get("/stats"),
  getTaxonomy: () => get("/taxonomy"),
  getDomains: () => get("/domains"),
  getTopics: () => get("/topics"),
  getTopicLinks: (limit = 40) => get(`/graph/topics?limit=${limit}`),
  getEmerging: (limit = 6) => get(`/trends/emerging?limit=${limit}`),
  getCountries: () => get("/countries"),
  getRecentPapers: (limit = 6) => get(`/papers/recent?limit=${limit}`),
  getPaper: (id) => getOrNull(`/papers/${encodeURIComponent(id)}`),
  search: (query, limit = 20) => get(`/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  queryPapers: (q) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
      else if (v !== undefined && v !== "") p.set(k, String(v));
    });
    return get(`/papers?${p}`);
  },
  getFacets: () => get("/papers/facets"),
  getMissions: () => get("/missions"),
  ask: async (req) => {
    const res = await fetch(`${BASE}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
    if (!res.ok) throw new Error(res.status === 404 ? "Paper not found" : `API ${res.status} on /ask`);
    return res.json();
  },
  getOpportunities: (q) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    return get(`/opportunities?${p}`);
  },
  getTrends: (recentYears = 3) => get(`/trends?recent_years=${recentYears}`),
  getGraph: (id) => getOrNull(`/graph/entity/${encodeURIComponent(id)}`),
  getRecommendations: (id) => getOrNull(`/recommendations/${encodeURIComponent(id)}`),
  getProfile: async (kind, id) => {
    const res = await fetch(`${BASE}/${kind === "country" ? "countries" : `${kind}s`}/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  },
};
