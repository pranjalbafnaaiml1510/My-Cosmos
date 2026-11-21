# Lesson 07 — The Research Data

**Time:** 20 minutes | **You need:** Lesson 06 finished

## Goal

By the end of this lesson you will:

- copy the 1,500 **demo papers** and the **taxonomy** into your project,
- describe a paper in TypeScript (the **schema**),
- load the papers in the browser with `fetch` and show how many there are.

## Understand

### What does a paper look like?

Open `data/mock/papers.json` in VS Code (in the course folder, not in `my_cosmos`). It is one long list. Here is one paper, tidied up:

```json
{
  "paper_id": "demo-00100",
  "title": "[Demo record 100] Deep Learning applied to computer vision",
  "abstract": "Synthetic placeholder abstract for development. ...",
  "authors": ["Demo Author A", "Demo Author B"],
  "publication_date": "2022-01-01",
  "publication_year": 2022,
  "journal": null,
  "conference": "Demo Conference (synthetic)",
  "doi": null,
  "country": "India",
  "organizations": ["Demo Institute IN-1"],
  "research_type": "conference-paper",
  "derived": {
    "topics": ["Computer Vision"],
    "methods": ["Deep Learning"],
    "technologies": ["Star Trackers"],
    "missions": ["Deep-Space Probe (demo)"],
    "keywords": ["computer vision", "deep learning", "star trackers"]
  },
  "is_synthetic": true
}
```

### Original metadata vs derived fields

The spec says: *"Derived fields should remain clearly separated from original metadata."*

| Original metadata | Derived (NLP output) |
|---|---|
| Comes from the publisher: title, authors, year, DOI, country of affiliation | Produced by our NLP pipeline: topics, methods, technologies, missions, keywords |
| Fact about the paper | Our *interpretation* of the paper |

Keeping `derived` in its own box means nobody confuses "the paper says" with "our model thinks".

### Honest demo data

The real 10,000+ paper corpus isn't connected yet. The spec forbids fake papers, so the demo records are **obviously** synthetic:

- every title starts with `[Demo record N]`,
- authors are "Demo Author A/B", institutes are "Demo Institute",
- no DOI,
- `is_synthetic: true`.

The **topics and country names are real labels**, but every count you will see is made up. We'll always show a "demo data" notice while these records are in use.

### What is the taxonomy?

`data/mock/taxonomy.json` lists the **domains** (big areas like "AI for Space"), each with its **topics** ("Computer Vision", "Fault Detection"…), plus the **countries** with their flag and short id (`in` = India).

### The `public/` folder and `fetch`

Files in `frontend/public/` are served exactly as they are. Put `papers.json` in `public/data/` and the browser can download it from `http://localhost:5173/data/papers.json`.

`fetch(address)` downloads something. It's **asynchronous**: the answer arrives later, so you say what to do *when* it arrives, with `.then(...)`.

### `useEffect`: "do this after showing the page"

Components must draw quickly. Slow work, like downloading data, goes in `useEffect`:

```tsx
useEffect(() => { /* runs once, after the first draw */ }, []);
```

The empty `[]` at the end means "only once".

## Do it now

**Check first:** terminal ends with `frontend>`.

### Step 1 — Copy the data into your project

```powershell
mkdir public\data
```

```powershell
Copy-Item ..\..\data\mock\papers.json public\data\
```

```powershell
Copy-Item ..\..\data\mock\taxonomy.json public\data\
```

`..\..` means "two folders up" (from `my_cosmos\frontend` back to `space-research-`).

### Step 2 — Describe the data in TypeScript

These **types** are a contract. Every part of the website, and later the API, agrees on these shapes.

**File:** `my_cosmos/frontend/src/types.ts`

```ts
/** One research paper. Original metadata first; NLP-derived fields live in `derived`. */
export interface Paper {
  paper_id: string;
  title: string;
  abstract: string;
  authors: string[];
  publication_date: string;
  publication_year: number;
  journal: string | null;
  conference: string | null;
  doi: string | null;
  /** Country of the authors' affiliation. Never guessed from the text. */
  country: string | null;
  organizations: string[];
  research_type: string;
  /** Output of the NLP pipeline, kept apart from the original metadata. */
  derived: {
    topics: string[];
    methods: string[];
    technologies: string[];
    missions: string[];
    keywords: string[];
  };
  /** true for demo records: these are not real research. */
  is_synthetic: boolean;
}

export interface TaxonomyDomain { id: string; name: string; icon?: string | null; topics: string[] }
export interface TaxonomyCountry { id: string; name: string; flag: string }
export interface Taxonomy { domains: TaxonomyDomain[]; countries: TaxonomyCountry[] }

/** Headline numbers about the whole corpus. */
export interface CorpusStats {
  papers: number;
  countries: number;
  topics: number;
  organizations: number;
  year_from: number;
  year_to: number;
  synthetic: boolean;
}

export interface DomainSummary extends TaxonomyDomain { paper_count: number }
export interface CountrySummary extends TaxonomyCountry { paper_count: number; top_topics: string[] }

/** A value and how many papers have it, e.g. { value: "India", count: 122 }. */
export interface CountValue { value: string; count: number }
export interface Facets { topics: CountValue[]; countries: CountValue[] }

export type PaperSort = "newest" | "oldest" | "title";

/** What the research table asks for. Every field is optional. */
export interface PaperQuery {
  q?: string;
  topic?: string;
  country?: string;
  sort?: PaperSort;
  page?: number;
  page_size?: number;
}

/** One page of results. */
export interface PaperPage { items: Paper[]; total: number; page: number; page_size: number }
```

### Step 3 — Load the papers on the Explore page

A quick test that the data arrives. In the next lesson we organise this properly.

**File:** `my_cosmos/frontend/src/pages/ExplorePage.tsx`

```tsx
import { useEffect, useState } from "react";
import type { Paper } from "../types";

export function ExplorePage() {
  // null = "not loaded yet"
  const [papers, setPapers] = useState<Paper[] | null>(null);

  useEffect(() => {
    fetch("/data/papers.json")
      .then((response) => response.json())
      .then((data: Paper[]) => setPapers(data));
  }, []);

  return (
    <section className="container-cosmos py-20">
      <p className="eyebrow">Space Research Intelligence</p>
      <h1 className="mt-3 text-4xl font-bold sm:text-6xl">
        Explore humanity's knowledge <span className="text-violet-500">beyond Earth.</span>
      </h1>
      {papers === null ? (
        <p className="mt-6 text-navy-500">Loading papers…</p>
      ) : (
        <div className="glass mt-8 max-w-xl p-6">
          <p className="text-2xl font-semibold">{papers.length.toLocaleString()} papers loaded</p>
          <p className="mt-2 text-sm text-navy-500">First paper: {papers[0].title}</p>
          <p className="mt-1 text-sm text-navy-500">Synthetic demo data: {papers[0].is_synthetic ? "yes" : "no"}</p>
        </div>
      )}
    </section>
  );
}
```

### Step 4 — Look at it

Start `npm run dev` if needed and open the Explore page.

## Check

- [ ] The page says **1,500 papers loaded**.
- [ ] The first paper's title starts with `[Demo record 1]`.
- [ ] It says "Synthetic demo data: yes".
- [ ] http://localhost:5173/data/taxonomy.json shows the taxonomy in the browser.

## What just happened?

1. The page was drawn with `papers === null`, so it said "Loading papers…".
2. After drawing, `useEffect` started `fetch("/data/papers.json")`.
3. When the file arrived, `.json()` turned the text into a JavaScript list.
4. `setPapers(data)` stored it. React **re-drew** the page, and this time `papers` held 1,500 items.

`useState<Paper[] | null>(null)` tells TypeScript the state is either a list of `Paper` or `null`, so it knows `papers[0].title` is a string.

## Try it yourself

1. Show the **last** paper's title as well (`papers[papers.length - 1]`).
2. Count how many papers are from India: `papers.filter((p) => p.country === "India").length`.
3. Count how many papers have the topic "Computer Vision". Hint: `p.derived.topics.includes(...)`.

## If it does not work

| Problem | Fix |
|---|---|
| "Loading papers…" forever | F12 → Console. A 404 for `/data/papers.json` means the file isn't in `public/data/`. Redo Step 1 from `my_cosmos\frontend`. |
| `Copy-Item : Cannot find path` | Wrong folder. The terminal must end with `frontend>`, and `space-research-\data\mock\papers.json` must exist. |
| `Unexpected token '<'` in the console | The address returned an HTML page instead of JSON: the file path is wrong. |

---

**Next:** [08_THE_DATA_SOURCE_PATTERN.md](08_THE_DATA_SOURCE_PATTERN.md)
