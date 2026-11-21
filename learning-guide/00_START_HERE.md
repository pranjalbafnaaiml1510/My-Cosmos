# COSMOS — Build a Space Research Intelligence Platform

**Start here.** This course teaches you to build your own version of COSMOS, step by step.

---

## What you will build

A website where people explore space-science research papers:

- a **pastel space-themed** website built with **React**,
- a **Python API** built with **FastAPI**,
- **NLP features**: semantic search, paper recommendations, a knowledge graph, research trends, research opportunities, and a research assistant that answers questions **only** from the papers and cites them.

You build it in a new folder called `my_cosmos`. The finished COSMOS (the folders `frontend/` and `backend/` next to this guide) stays untouched, so you can always open it and compare.

## Who this is for

You know a little Python (variables, functions, lists, dictionaries). You have never used React, TypeScript, FastAPI or NLP? Perfect — every lesson explains them from zero.

## How every lesson works

Each lesson has the same parts:

| Part | What it is |
|---|---|
| **Goal** | What works at the end |
| **Understand** | The idea, explained simply, before any code |
| **Do it now** | Numbered steps. Type the commands, create the files |
| **Check** | Tick boxes. All must be true before you move on |
| **What just happened?** | The steps explained again, now that you have seen them |
| **Try it yourself** | Small exercises. Do them — this is where you really learn |
| **If it does not work** | The common problems and their fixes |

**Rule for code:** when a step says **File:** `some/path`, create that file (or replace **everything** in it) with the code shown. You never have to guess where a line goes.

## The lessons

| # | Lesson | Time | You learn |
|---|---|---|---|
| 01 | How COSMOS works | 15 min | The big picture: browser, frontend, API, NLP |
| 02 | Set up your computer | 25 min | Node.js, Python, VS Code, terminal |
| 03 | Your first React project | 15 min | Vite, React, running a dev server |
| 04 | Tailwind and the pastel theme | 20 min | CSS utility classes, colour tokens |
| 05 | Components and the design system | 25 min | Components, props, TypeScript types |
| 06 | Pages and navigation | 25 min | React Router, layouts |
| 07 | The research data | 20 min | The paper schema, honest demo data, `fetch` |
| 08 | The data source pattern | 30 min | Interfaces, async/await, loading states |
| 09 | The Explore page | 30 min | Building a real page from components |
| 10 | The research table | 35 min | Tables, filters, sorting, pagination, URL state |
| 11 | Your first API with FastAPI | 40 min | Python web APIs, CORS, pytest |
| 12 | Semantic search | 45 min | TF-IDF, LSA embeddings, cosine similarity, ranking |
| 13 | Paper page and recommendations | 35 min | Similarity beyond "same words" |
| 14 | The knowledge graph | 35 min | Co-occurrence graphs, progressive expansion |
| 15 | Trends and emerging topics | 35 min | Growth rates, z-scores, honest wording |
| 16 | Research opportunities | 40 min | Topic pairs, regression, evidence thresholds |
| 17 | The research assistant | 45 min | Retrieval-augmented generation, citations, grounding |
| 18 | Connect real data | 25 min | Importing and validating a real paper export |
| 19 | Final checklist and what's next | 15 min | Review, and what the finished COSMOS adds |
| 20 | Deploy your COSMOS | 45–60 min | Production builds, hosting, environment variables, CORS, going live |

About **10–11 hours** in total. Do one or two lessons per sitting.

### Companion notebook: NLP basics

[`notebooks/NLP_BASICS.ipynb`](notebooks/NLP_BASICS.ipynb) teaches the NLP ideas behind Lessons 12–17 hands-on, first on five toy sentences, then on the 1,500 demo papers: tokens and stemming, TF-IDF, cosine similarity, LSA embeddings, hybrid ranking, Jaccard, co-occurrence, growth and z-scores, and grounded answers. Open it in VS Code (pick a Python kernel) before or alongside Lesson 12. It needs `numpy`, `scikit-learn`, `matplotlib` and `ipykernel`, and its first cells say how to install them.

## The folders

```
space-research-/            ← open THIS folder in VS Code
├── learning-guide/         ← these lessons
├── frontend/               ← the finished COSMOS website (reference)
├── backend/                ← the finished COSMOS API (reference)
├── data/mock/              ← the demo papers you will copy in Lesson 07
└── my_cosmos/              ← YOUR project (you create it in Lesson 03)
    ├── frontend/
    └── backend/
```

## One important promise

COSMOS is about **scientific honesty**. Throughout the course you will see rules like:

- never invent papers, results or countries,
- label demo data clearly as demo data,
- say "growing in this corpus", never "this is the future",
- if the papers don't answer a question, say so.

These rules are part of the code, not just good manners. You will build them in.

---

**Next:** [01_HOW_COSMOS_WORKS.md](01_HOW_COSMOS_WORKS.md)
