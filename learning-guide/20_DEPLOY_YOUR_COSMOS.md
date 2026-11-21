# Lesson 20 — Deploy Your COSMOS

**Time:** 45–60 minutes | **You need:** Lesson 19 finished, a GitHub account, accounts on one static-site host and one Python host (free tiers are fine)

## Goal

By the end of this lesson your COSMOS is **on the internet** with a real address you can share:

- **Path A — demo site (easiest):** only the website, with the demo data in the browser. NLP pages explain they need the API.
- **Path B — full site:** the website **and** the API, so search, recommendations, the map, trends, opportunities and the assistant all work.

Before going online you will run a **production rehearsal** on your own computer, so most surprises happen at home, not in public.

## Understand

### Development vs production

| | Development (what you did so far) | Production (the internet) |
|---|---|---|
| Website | `npm run dev`: a dev server that rebuilds on every save | `npm run build`: plain, optimised files in `dist/`, served by a **static host** |
| API | `uvicorn --reload` on `localhost` | `uvicorn --host 0.0.0.0 --port $PORT` on a **Python host** |
| Addresses | `localhost:5174` and `localhost:8020` | `https://my-cosmos.example` and `https://my-cosmos-api.example` |
| Settings | `.env.api` on your disk | **environment variables** set in each host's dashboard |

### The deployment flow

```
 your computer                    GitHub                         hosts
 ─────────────                    ──────                         ─────
 1. rehearse locally   ──push──►  my_cosmos repo  ──deploy──►   Python host:  API     https://…-api…
                                                  ──deploy──►   static host:  website https://…
                                                                       │
 2. set environment variables on each host ◄───────────────────────────┘
 3. check the live site with the checklist
```

Most hosts **redeploy automatically** every time you push to GitHub.

### Static hosts and the "refresh" problem

A static host serves files. Ask for `/papers/demo-00100` and it looks for a **file** with that name, finds none, and returns 404. But that address only exists inside React Router!

The fix is a **rewrite rule**: "for any address, serve `index.html`, and let React Router decide". Every static host has a setting or file for this. If you skip it, links work while you click around, then **break when someone refreshes or shares a link**.

### Environment variables: public vs secret

- Vite variables starting with `VITE_` are **baked into the JavaScript** at build time. Anyone can read them in the browser. Only put **public** things there, like the API address.
- **Secrets** (an `ANTHROPIC_API_KEY`) belong **only** on the API host, never in the frontend, never in GitHub.

### CORS, again

In Lesson 11 the API allowed only `localhost` websites. Online, your website has a new address, so the API must allow **it**. We'll read the allowed addresses from an environment variable, `COSMOS_CORS_ORIGINS`, so the same code works at home and online.

### `0.0.0.0` and `$PORT`

`localhost` only accepts connections from **the same computer**. On a server the API must listen on `0.0.0.0` ("every network card"). Hosts also decide the **port** and pass it in an environment variable called `PORT`.

## Do it now

### Step 1 — Make the API configurable

The only code change: CORS origins now come from `COSMOS_CORS_ORIGINS`. Port `4173` is added for Step 4's rehearsal.

**File:** `my_cosmos/backend/app/main.py`

```python
"""My COSMOS API.
Local:   uvicorn app.main:app --reload --port 8020
Server:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import assistant, graph, opportunities, papers_api, recommend, search, trends

# Websites allowed to call this API. On a server, set COSMOS_CORS_ORIGINS to your site's
# address(es), comma-separated, e.g. "https://my-cosmos.example".
DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:5174,http://localhost:4173"
ORIGINS = [o.strip().rstrip("/") for o in os.getenv("COSMOS_CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]

app = FastAPI(title="My COSMOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(papers_api.router)
app.include_router(search.router)
app.include_router(recommend.router)
app.include_router(graph.router)
app.include_router(trends.router)
app.include_router(opportunities.router)
app.include_router(assistant.router)


@app.get("/health")
def health():
    """Hosts call this to check the API is alive."""
    return {"status": "ok", "answer_provider": assistant.PROVIDER.name}
```

### Step 2 — Test the deployment rules

**File:** `my_cosmos/backend/tests/test_deploy.py`

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_for_the_host():
    assert client.get("/health").json()["status"] == "ok"


def test_cors_allows_our_site_only():
    ok = client.get("/stats", headers={"Origin": "http://localhost:5174"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5174"
    other = client.get("/stats", headers={"Origin": "https://someone-else.example"})
    assert "access-control-allow-origin" not in other.headers
```

In the API terminal (with `(.venv)` active):

```powershell
python -m pytest -q
```

You should see `26 passed`.

### Step 3 — The rewrite rule for refreshes

Many static hosts (Netlify, Cloudflare Pages) read a file called `_redirects`. Files in `public/` are copied into `dist/` as they are.

**File:** `my_cosmos/frontend/public/_redirects`

```text
/*    /index.html   200
```

It means: for **any** address (`/*`), serve `/index.html` with status `200` (OK), and let React Router choose the page. Other hosts have the same idea under another name (see the table in Step 7).

### Step 4 — Production rehearsal on your computer

**4a. Start the API the way a server will** (in the API terminal):

```powershell
$env:COSMOS_CORS_ORIGINS = "http://localhost:4173"; uvicorn app.main:app --host 0.0.0.0 --port 8020
```

**4b. Tell the production build where the API is.** `.local` files are for your computer only; they're ignored by Git.

**File:** `my_cosmos/frontend/.env.production.local`

```text
VITE_DATA_MODE=api
VITE_API_URL=http://localhost:8020
```

**4c. Build and preview the real production files** (in the frontend terminal):

```powershell
npm run build
```

```powershell
npm run preview
```

`npm run preview` serves the `dist/` folder at **http://localhost:4173**, like a static host would.

**4d. Try it:** open http://localhost:4173/papers/demo-00100 directly and press **F5**. The paper page must load, which proves the refresh rule works. Then try Search and the Assistant.

When you're done, **delete** `.env.production.local`. The real hosts will provide these values.

### Step 5 — Put `my_cosmos` on GitHub

First make sure secrets and generated folders can never be committed.

**File:** `my_cosmos/.gitignore`

```text
# dependencies and builds
node_modules/
dist/
.venv/
__pycache__/
.pytest_cache/

# local settings and secrets
.env.local
.env.*.local
*.local
.env
```

Then, in a terminal inside `my_cosmos`:

```powershell
git init
```

```powershell
git add .
```

```powershell
git commit -m "My COSMOS"
```

Create an **empty** repository on GitHub (no README), then run the two commands GitHub shows you (`git remote add origin …` and `git push -u origin main`).

Check on GitHub: you should see `frontend/` and `backend/`, but **no** `node_modules`, `.venv` or `.env.production.local`.

### Step 6 — Deploy the API (Path B only)

On your **Python host** (for example Render, Railway or Fly.io), create a **web service** from your GitHub repository and fill in:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Runtime | Python **3.12** |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` |
| Environment variable | `COSMOS_CORS_ORIGINS` = your website's address (you get it in Step 7; put `http://localhost:4173` for now) |

Deploy, wait for "live", and open `https://YOUR-API-ADDRESS/health`. You should see `{"status":"ok",...}`. Then try `/docs`.

> **The data travels with the code.** `backend/data/papers.json` is in your repository, so the API loads the same 1,500 demo papers online. No database is needed for a fixed corpus.

### Step 7 — Deploy the website

On your **static host** (for example Netlify, Cloudflare Pages or Vercel), create a site from the same repository:

| Setting | Value |
|---|---|
| Base / root directory | `frontend` |
| Build command | `npm run build` |
| Publish / output directory | `dist` |
| Node version | 20 or 22 |

Then set the **environment variables** for the build:

| Path | Variables |
|---|---|
| **A — demo site** | none (the site uses the demo data in the browser) |
| **B — full site** | `VITE_DATA_MODE` = `api` and `VITE_API_URL` = `https://YOUR-API-ADDRESS` (no `/` at the end) |

**Rewrite rule:** Netlify and Cloudflare Pages use `public/_redirects` from Step 3 automatically. On Vercel, add a `vercel.json` rewrite of `/(.*)` to `/index.html`. On any host, search its docs for "SPA fallback" or "single-page app rewrite".

### Step 8 — Connect the two (Path B)

1. Copy your website's address, for example `https://my-cosmos.example`.
2. On the **API host**, set `COSMOS_CORS_ORIGINS` to exactly that (with `https://`, no `/` at the end) and redeploy the API.
3. Open your website. Press **F12 → Network** and check that requests go to your API address with status 200.

### Step 9 (optional) — Claude on the server

Only if you want the Claude answer writer from Lesson 17. On the **API host**:

- add `anthropic` to `backend/requirements.txt` and push,
- add the environment variables `LLM_PROVIDER` = `anthropic` and `ANTHROPIC_API_KEY` = your key, as a **secret**.

Never put the key in the frontend, in a `VITE_` variable, or in GitHub. A public site can be used by anyone, and each answer costs money, so watch your usage dashboard and set a spending limit.

### Step 10 (optional) — The same API in a container

Some hosts prefer a **Docker image**: a sealed box with Python, your code and your data inside, which runs the same everywhere.

**File:** `my_cosmos/backend/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY data ./data
ENV PORT=8020
EXPOSE 8020
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
```

**File:** `my_cosmos/backend/.dockerignore`

```text
.venv/
__pycache__/
.pytest_cache/
tests/
```

If you have Docker installed, try it locally (from `my_cosmos\backend`):

```powershell
docker build -t my-cosmos-api .
```

```powershell
docker run -p 8020:8020 my-cosmos-api
```

Then open http://localhost:8020/health. On a host that supports Docker, choose "deploy from Dockerfile" instead of the build and start commands in Step 6.

## Check

**Rehearsal (Step 4)**

- [ ] `python -m pytest -q` prints `26 passed`.
- [ ] http://localhost:4173/papers/demo-00100 loads, **and still loads after F5**.
- [ ] Search and the Assistant work on port 4173.

**Live site**

- [ ] `https://YOUR-API/health` shows `"status": "ok"` (Path B).
- [ ] Your website opens on its `https://` address.
- [ ] Refreshing a deep link (a paper page, `/papers?topic=Computer%20Vision`) works.
- [ ] Path B: Search, a paper's recommendations, the Map, Trends, Opportunities and the Assistant all work.
- [ ] Path A: NLP pages show the friendly "runs on the API" message instead of errors.
- [ ] The "Demo data: synthetic records" notice is visible on the live site.
- [ ] GitHub contains no `.env*.local` file and no API key.

## What just happened?

- `npm run build` ran the TypeScript check and turned your React code into a few static files in `dist/`. **Those files are your whole website.**
- The static host's rewrite rule sent every address to `index.html`, so React Router could pick the page, even on refresh.
- `VITE_API_URL` was **baked into** the built JavaScript. That's why changing it on the host needs a **new build**, not just a restart.
- The API host installed `requirements.txt`, started Uvicorn on `0.0.0.0:$PORT`, and used `/health` to know when it was ready.
- `COSMOS_CORS_ORIGINS` let the same code allow `localhost` at home and your real address online, with no code change. That's **configuration, not code**.

## Try it yourself

1. Change a heading in `ExplorePage.tsx`, commit and push. Watch the static host rebuild by itself.
2. Set `COSMOS_CORS_ORIGINS` to a wrong address and reload your site. Read the CORS error in the console, then fix it.
3. Free API hosts often **sleep** after some quiet time; the first request then takes a while and the site shows "Couldn't reach the research universe". Add a **Retry** button to `AsyncView`'s error state.
4. Open your live site on your phone. Go back to Lesson 19's "It's usable" checklist.

## If it does not work

| Problem | Fix |
|---|---|
| Static build fails: `tsc` errors | Run `npm run build` locally first and fix the errors there. Production builds are strict. |
| Live site loads but every page says "Couldn't reach the research universe" | `VITE_API_URL` is missing or wrong (check F12 → Network), or the API is asleep or down (open `/health`). After changing a `VITE_` variable, **rebuild** the site. |
| Console: `blocked by CORS policy` | `COSMOS_CORS_ORIGINS` doesn't exactly match the site's address: `https://` vs `http://`, `www.` or not, or a trailing `/`. Redeploy the API after changing it. |
| 404 when refreshing a page | The rewrite rule is missing (Step 3 / Step 7). |
| Console: `Mixed Content` | Your site is `https://` but `VITE_API_URL` is `http://`. Use the API's `https://` address. |
| API host: `ModuleNotFoundError: No module named 'app'` | Root directory isn't `backend`, or the start command runs from the wrong folder. |
| API host: `FileNotFoundError: …papers.json` | `backend/data/` wasn't pushed. Check it's on GitHub (it's not in `.gitignore`). |
| API host: build fails on `numpy` | The host picked Python 3.13. Set Python 3.12 in the host's settings. |
| API runs out of memory on the free tier | The NLP indexes are built at startup. 1,500 papers is fine; for the real 10,000+ corpus choose a plan with more memory. |

---

**Back to:** [00_START_HERE.md](00_START_HERE.md)
