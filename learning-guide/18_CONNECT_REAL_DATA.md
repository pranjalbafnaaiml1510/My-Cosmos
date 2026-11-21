# Lesson 18 — Connect Real Data

**Time:** 25 minutes | **You need:** Lesson 17 finished

## Goal

By the end of this lesson you will:

- understand what has to happen before **real** papers can replace the demo data,
- run the finished COSMOS **importer** on a small, deliberately messy export,
- read its **validation report** and know what each line means,
- know the exact steps to switch your API to a real corpus.

## Understand

### Real data is messy

The demo records are perfectly tidy. A real export from a paper database never is:

| Mess | Example |
|---|---|
| Different column names | `uid` instead of `paper_id`, `summary` instead of `abstract` |
| Duplicates | the same paper twice, once with a DOI and once without |
| Missing values | no abstract, no year, no country |
| Different spellings | `USA`, `U.S.A.`, `United States of America` |
| Lists packed into text | `"JPL; Caltech"` or `'["Navigation", "Vision"]'` |
| Topics outside the taxonomy | the NLP pipeline found "Plasma Wake Physics" |

### Import, don't patch

COSMOS **never** fixes data while serving it. Instead, a separate step, the **importer**, runs **once**:

```
export.csv ──► importer ──► papers.json + taxonomy.json + manifest.json + report
                  │
                  ├─ maps column names
                  ├─ removes duplicates (same DOI, or same title)
                  ├─ skips rows with no title / abstract / year
                  ├─ normalises countries (USA → United States)
                  ├─ country ONLY from the affiliation column, never guessed from text
                  └─ topics not in the taxonomy → "Other topics" (and reported)
```

The API then just loads the clean files, exactly like the demo files. The spec: *"The deployed application must NOT require a daily news feed or daily data collection."*

### The validation report

The importer prints a report so a human can check the data before trusting it: how many rows came in and went out, which columns it used, the percentage of missing values per field, unknown countries, and topics outside the taxonomy.

**Read it every time.** If "abstract" is 40% missing, search and the assistant will be weak, and you'd want to know *before* showing the site to anyone.

### Why use the finished importer?

The finished COSMOS already has a tested importer (`backend/app/ingest/`, with its own tests). Writing one is a good exercise (see *Try it yourself*), but here you'll **use** it, as you would in a real team.

## Do it now

### Step 1 — A small, messy export

**File:** `my_cosmos/sample_export.csv`

```text
id,title,abstract,year,date,doi,affiliation_country,institutions,topics,methods
p1,Optical navigation for small bodies,We study optical navigation near asteroids. Results are reported for two cameras.,2021,,10.1/ABC,USA,JPL; Caltech,"[""Spacecraft Navigation"", ""Computer Vision""]",Deep Learning
p2,Optical Navigation for Small Bodies!,Same paper with different punctuation.,2021,,,U.S.,JPL,Spacecraft Navigation,
p3,Hall thruster erosion,Erosion of Hall thrusters is measured over long firings.,,2019-05-02,https://doi.org/10.1/abc,Germany,DLR,Electric Propulsion,Monte Carlo Simulation
p4,No abstract here,,2020,,,India,ISRO,Lunar Exploration,
p5,Plasma wakes behind probes,Plasma wakes behind small probes are simulated.,2022,,10.2/x,Atlantis,,Plasma Wake Physics|Space Weather,
p6,Lunar regolith sintering,Sintering of lunar regolith is tested in a vacuum chamber.,2018,,,,ESA,In-Space Manufacturing,
```

Before running anything, predict: which rows survive?

### Step 2 — Prepare the finished backend (once)

The importer lives in the finished COSMOS backend. In a new terminal (starting in `space-research->`):

```powershell
cd backend
```

If there is **no** `.venv` folder inside `backend`, create it once:

```powershell
python -m venv .venv
```

```powershell
.venv\Scripts\python -m pip install -r requirements.txt
```

### Step 3 — Dry run: read the report, write nothing

```powershell
.venv\Scripts\python -m app.ingest ..\my_cosmos\sample_export.csv --dry-run
```

You should see a report like this (shortened):

```json
{
  "rows_in": 6,
  "papers_out": 3,
  "skipped": { "no abstract": 1 },
  "duplicates_removed": 2,
  "columns_used": { "paper_id": "id", "title": "title", "abstract": "abstract", "country": "affiliation_country", ... },
  "countries_without_iso_code": { "Atlantis": 1 },
  "topics_outside_taxonomy": { "Plasma Wake Physics": 1 }
}
```

and at the end: `Dry run: nothing written.`

### Step 4 — Explain every line

| Row | What happened | Why |
|---|---|---|
| p1 | kept | `USA` → **United States**, `JPL; Caltech` → two organizations, the JSON list → two topics |
| p2 | **duplicate** of p1 | same title once punctuation and case are ignored |
| p3 | **duplicate** of p1 | `https://doi.org/10.1/abc` is the same DOI as `10.1/ABC` |
| p4 | **skipped** | no abstract: nothing to search or quote |
| p5 | kept | `Atlantis` is kept as written, but reported (not a known country); `Plasma Wake Physics` goes to "Other topics" |
| p6 | kept | no country: it **stays empty**. Never guessed. |

## Check

- [ ] The report says `rows_in: 6` and `papers_out: 3`.
- [ ] You can explain why p2, p3 and p4 were removed.
- [ ] You can explain why p6 has no country and why that is correct.

## What just happened?

The importer found the right columns by itself (`id` → `paper_id`, `affiliation_country` → `country`), cleaned every row, and reported everything it changed or doubted, without writing a single file (`--dry-run`).

### Connecting a real corpus, step by step

When you have a real processed export (CSV, JSONL, JSON or Parquet), with columns for title, abstract and year, plus the NLP fields (topics, methods, …):

1. **Dry run** and read the report: `python -m app.ingest your_export.csv --dry-run`
2. If a column wasn't found, map it: `--map '{"country": "first_affiliation_country"}'`
3. **Import** into a folder for your API:

```powershell
.venv\Scripts\python -m app.ingest your_export.csv --out ..\my_cosmos\backend\data_real
```

4. Start **your** API on it. In your `my_cosmos\backend` terminal (with `(.venv)` active):

```powershell
$env:COSMOS_DATA_DIR = "data_real"; uvicorn app.main:app --reload --port 8020
```

Your `corpus.py` reads `COSMOS_DATA_DIR` (you wrote that line in Lesson 11). **No other code changes**: same API, same website, real papers. And because no real record is `is_synthetic`, the demo-data notices disappear by themselves.

> Your simplified API expects a corpus big enough for its statistics: several years of papers and topics with 20+ papers each. A 3-paper sample like Step 1 is only for practising the import, not for running the API.

## Try it yourself

1. Add a row `p7` to the CSV with the year `1850`. Predict the report, then run the dry run. (Years outside 1950–2100 are skipped as invalid.)
2. Rename the `abstract` column to `text` and run again. Read the error, then fix it with `--map '{"abstract": "text"}'`.
3. Read `backend/app/ingest/normalize.py` in the finished project. Find the line that turns `U.S.A.` into `United States`.
4. Challenge: write your own `my_cosmos/backend/app/importer.py` that reads the CSV with Python's `csv` module, removes duplicate titles, and writes `papers.json`. Compare it with the finished one.

## If it does not work

| Problem | Fix |
|---|---|
| `No module named app.ingest` | You're not in `space-research-\backend`, or that folder isn't the finished COSMOS backend. |
| `No module named fastapi` / `numpy` | Step 2 wasn't done for the finished backend's `.venv`. |
| `No column found for required field 'abstract'` | Your file has no recognisable abstract column. Map it with `--map`. |
| Parquet file fails | Install `pyarrow` into that `.venv`: `.venv\Scripts\python -m pip install pyarrow`. |

---

**Next:** [19_FINAL_CHECKLIST_AND_WHATS_NEXT.md](19_FINAL_CHECKLIST_AND_WHATS_NEXT.md)
