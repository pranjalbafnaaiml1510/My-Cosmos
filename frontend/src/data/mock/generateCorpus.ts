/**
 * SYNTHETIC DEMO CORPUS — not real research.
 * Every record is flagged `is_synthetic`, titled "[Demo record …]", has no DOI and
 * uses placeholder authors/organizations. It exists only so pages render meaningfully
 * before the real 10,000+ paper corpus is connected (VITE_DATA_MODE=production).
 */
import type { Paper } from "../../types";
import { COUNTRIES, DOMAINS, METHODS, MISSION_CLASSES, TECHNOLOGIES } from "./taxonomy";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Topics skewed toward recent years so trend views have visible shape in demo mode. */
const RECENT_SKEW = new Set(["Onboard AI", "Computer Vision", "Autonomous Spacecraft", "Swarm Robotics", "In-Space Manufacturing", "Fault Detection"]);

const ALL_TOPICS = DOMAINS.flatMap((d) => d.topics);
export const YEAR_MIN = 2015;
export const YEAR_MAX = 2026;

export function generateCorpus(n = 1500): Paper[] {
  const r = rng(42);
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  const totalW = COUNTRIES.reduce((s, c) => s + c.weight, 0);
  const pickCountry = () => {
    let x = r() * totalW;
    for (const c of COUNTRIES) if ((x -= c.weight) <= 0) return c;
    return COUNTRIES[0];
  };

  const papers: Paper[] = [];
  for (let i = 0; i < n; i++) {
    const primary = pick(ALL_TOPICS);
    const domain = DOMAINS.find((d) => d.topics.includes(primary))!;
    const secondary = r() < 0.6 ? pick(domain.topics) : pick(ALL_TOPICS);
    const topics = Array.from(new Set([primary, secondary]));
    const skew = topics.some((t) => RECENT_SKEW.has(t));
    const span = YEAR_MAX - YEAR_MIN;
    const year = YEAR_MIN + Math.min(span, Math.floor((skew ? Math.sqrt(r()) : r()) * (span + 1)));
    const country = pickCountry();
    const method = pick(METHODS);
    const tech = pick(TECHNOLOGIES);
    const missions = r() < 0.5 ? [pick(MISSION_CLASSES)] : [];
    const isJournal = r() < 0.65;

    papers.push({
      paper_id: `demo-${String(i + 1).padStart(5, "0")}`,
      title: `[Demo record ${i + 1}] ${method} applied to ${primary.toLowerCase()}`,
      abstract: `Synthetic placeholder abstract for development. This demo record is tagged with ${topics.join(" and ")}, method "${method}" and technology "${tech}". It does not describe real research and will be replaced by the production corpus.`,
      authors: ["Demo Author A", "Demo Author B"],
      publication_date: `${year}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-01`,
      publication_year: year,
      journal: isJournal ? "Demo Journal (synthetic)" : null,
      conference: isJournal ? null : "Demo Conference (synthetic)",
      publisher: null,
      doi: null,
      source_url: null,
      open_access_url: null,
      country: country.name,
      organizations: [`Demo Institute ${country.id.toUpperCase()}-${1 + Math.floor(r() * 6)}`],
      citation_count: null,
      reference_count: null,
      research_type: isJournal ? "journal-article" : "conference-paper",
      derived: {
        topics,
        subtopics: [],
        missions,
        spacecraft: [],
        technologies: [tech],
        methods: [method],
        entities: [...missions, tech],
        keywords: [...topics, method, tech].map((s) => s.toLowerCase()),
        embedding_reference: null,
      },
      is_synthetic: true,
    });
  }
  return papers;
}
