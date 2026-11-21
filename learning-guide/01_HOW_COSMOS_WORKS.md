# Lesson 01 — How COSMOS Works

**Time:** 15 minutes | **You need:** nothing yet — this lesson is reading only

## Goal

By the end of this lesson you can explain:

- what happens when someone opens COSMOS in their browser,
- the difference between the **frontend** and the **backend (API)**,
- what **NLP** does in COSMOS,
- why we start with **demo data** and switch to real data later.

## Understand

### The big picture

```
 You (browser)
     │  1. "show me papers about autonomous navigation"
     ▼
 Frontend  (React website — runs IN your browser)
     │  2. asks for data:  GET /search?q=autonomous navigation
     ▼
 API  (FastAPI — a Python program on a server)
     │  3. does the clever work: search, ranking, statistics
     ▼
 Data + NLP  (papers.json, embeddings, search index)
     │  4. sends back JSON (data as text)
     ▼
 Frontend draws the results as nice cards and tables
```

### Frontend vs backend

| | Frontend | Backend (API) |
|---|---|---|
| Language | TypeScript (JavaScript with types) | Python |
| Tool | React + Vite + Tailwind | FastAPI |
| Runs | In the visitor's browser | On a server (your computer while learning) |
| Job | Show things, react to clicks | Store data, compute, answer questions |
| Port while learning | `5173` / `5174` | `8020` |

A restaurant is a good picture: the **frontend is the dining room** (menus, tables, nice decoration), the **API is the kitchen** (where the cooking happens), and **JSON is the plate** that carries food between them.

### What is an API?

An **API** is a list of addresses the frontend can call to get data. Each address is an **endpoint**:

| Endpoint | Answers |
|---|---|
| `GET /stats` | "How many papers, countries, topics?" |
| `GET /papers?topic=Computer Vision` | "Give me those papers" |
| `GET /search?q=...` | "Find papers about this" |
| `POST /ask` | "Answer this question using the papers" |

`GET` = "give me something". `POST` = "here is something, please process it".

### What is NLP?

**NLP (Natural Language Processing)** is teaching computers to work with human language. COSMOS uses it to:

| Feature | NLP idea | Lesson |
|---|---|---|
| Search that understands meaning | Turn text into numbers (**embeddings**), compare them | 12 |
| "Papers like this one" | Similarity between papers | 13 |
| Map of connections | Count which topics appear together | 14 |
| Emerging topics | Statistics over time | 15 |
| Research opportunities | Topics that are "close" but rarely combined | 16 |
| Research assistant | Find papers, then answer **only** from them, with citations | 17 |

### Demo data first, real data later

The real corpus is 10,000+ papers that someone has already collected, cleaned and processed. While building, we use **1,500 synthetic (made-up) demo records** that follow the exact same format. Every demo record is clearly labelled `[Demo record N]`.

Because the format is the same, switching to real data later (Lesson 18) needs **no changes** to the website code. This is called the **data source pattern** (Lesson 08).

### The finished COSMOS and your COSMOS

| Your `my_cosmos` (this course) | The finished COSMOS (reference) |
|---|---|
| All the main ideas, written simply | The same ideas, plus extra polish |
| ~40 files | ~80 files |
| LSA embeddings | LSA or neural embeddings |
| Extractive assistant (+ optional Claude) | Same |

Whenever you're curious, open the matching file in the finished project and compare.

## Do it now

There's no code in this lesson. Instead:

**Step 1 — See the finished COSMOS running.** If you haven't yet, follow the README in the project root to start it (`npm run dev` inside `frontend/`), then open http://localhost:5173.

**Step 2 — Find each feature.** Click through: Explore → Papers → Search (type a question) → open a paper → Research Map → Trends → Opportunities → Assistant.

**Step 3 — Watch the API calls.** In the browser press **F12 → Network**, refresh a page, and look at the requests. (In demo mode most of them are `papers.json` — the data loads into your browser.)

## Check

- [ ] You can say in one sentence what the frontend does and what the API does.
- [ ] You can name three NLP features of COSMOS.
- [ ] You know why demo data is labelled `[Demo record N]`.

## What just happened?

You saw the whole system from the outside. In the next lessons you build it from the inside: first the website (Lessons 03–10), then the API (11), then one NLP feature per lesson (12–17).

## Try it yourself

1. In the finished COSMOS, open a paper page. Which parts look like plain **data** (title, year) and which look like **NLP output** (topics, related research)?
2. On the Opportunities page, find the sentence that appears on every card. Why do you think it's there?

---

**Next:** [02_SET_UP_YOUR_COMPUTER.md](02_SET_UP_YOUR_COMPUTER.md)
