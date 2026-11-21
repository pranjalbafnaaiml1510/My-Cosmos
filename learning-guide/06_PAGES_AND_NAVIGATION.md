# Lesson 06 — Pages and Navigation

**Time:** 25 minutes | **You need:** Lesson 05 finished

## Goal

By the end of this lesson COSMOS will have:

- a **navigation bar** with all seven sections,
- a starry **cosmic background** on every page,
- real **addresses** (`/`, `/papers`, `/search`…) that change without reloading the page,
- a friendly "coming soon" page for sections you build later.

## Understand

### One page, many addresses

COSMOS is a **single-page application (SPA)**: the browser loads `index.html` once, and React swaps what's on screen when the address changes. That's why clicking around feels instant.

**React Router** connects addresses to components:

| Address | Component |
|---|---|
| `/` | `ExplorePage` |
| `/papers` | `PapersPage` (Lesson 10) |
| `/papers/demo-00100` | `PaperPage` — `:id` is a variable part (Lesson 13) |
| anything else | the "lost in space" page |

### Layouts and `<Outlet />`

Every page needs the same header, background and footer. Instead of copying them into each page, we make one **layout** component, `AppShell`. It draws the header and footer and puts an `<Outlet />` in the middle, which is where the current page appears.

### `<Link>` instead of `<a>`

A normal `<a href>` reloads the whole website. `<Link to>` from React Router changes the address **without** reloading. Use `<Link>` for addresses inside COSMOS and `<a>` only for outside websites.

### `NavLink`

`NavLink` is a `Link` that knows when it is "active" (when you're on that page), so the current section can be highlighted.

## Do it now

**Check first:** terminal ends with `frontend>`. Stop the dev server (Ctrl + C) before installing.

### Step 1 — Install React Router

```powershell
npm install react-router-dom@6.26.2
```

### Step 2 — Let chips be links

Chips will often lead somewhere (a chip "Computer Vision" opens that topic). Replace `ui.tsx` with this version. The only change: `Chip` gets an optional `to` prop.

**File:** `my_cosmos/frontend/src/components/ui.tsx`

```tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** A frosted-glass card around any content. */
export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass ${className}`}>{children}</div>;
}

/** Small label + big title (+ optional description) at the top of a section. */
export function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-6 max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 text-navy-500">{description}</p>}
    </div>
  );
}

/** A big number with a label underneath. */
export function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <GlassCard className="px-5 py-4">
      <p className="font-display text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm text-navy-500">{label}</p>
    </GlassCard>
  );
}

const CHIP_TONES = {
  topic: "bg-lavender-100 text-violet-600 hover:bg-lavender-200",
  entity: "bg-dusty-100 text-navy-700 hover:bg-dusty-200",
  method: "bg-mint-100 text-navy-700 hover:bg-mint-200",
  signal: "bg-blush-100 text-navy-700 hover:bg-blush-200",
} as const;

/** A small rounded tag. With `to`, it becomes a link inside COSMOS. */
export function Chip({ children, tone = "topic", to }: { children: ReactNode; tone?: keyof typeof CHIP_TONES; to?: string }) {
  const cls = `inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${CHIP_TONES[tone]}`;
  return to ? <Link to={to} className={cls}>{children}</Link> : <span className={cls}>{children}</span>;
}

/** Shown when there is nothing to display. Never leave a blank space. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <span aria-hidden className="mb-3 text-3xl">🔭</span>
      <p className="font-medium text-navy-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-navy-500">{hint}</p>}
    </div>
  );
}

/** A tiny planet orbiting a dot, with honest text about what's happening. */
export function CosmicLoader({ label = "Mapping research…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-sm text-navy-500">
      <span className="relative inline-block h-6 w-6">
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500" />
        <span className="absolute inset-0 animate-orbit-fast">
          <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-blush-300" />
        </span>
      </span>
      {label}
    </div>
  );
}
```

### Step 3 — The cosmic background

Soft nebula blobs and twinkling stars, fixed behind every page. `aria-hidden` tells screen readers to skip it: it's decoration only.

**File:** `my_cosmos/frontend/src/components/CosmicBackground.tsx`

```tsx
// Star positions are calculated once, from the star's number, so they never jump around.
const STARS = Array.from({ length: 60 }, (_, i) => ({
  x: (i * 73.13) % 100,
  y: (i * 41.71) % 100,
  size: (i % 3) + 1,
  delay: (i % 7) * 0.6,
}));

export function CosmicBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-32 -top-40 h-[36rem] w-[36rem] rounded-full bg-lavender-200/50 blur-3xl" />
      <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-blush-100/70 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-[28rem] w-[28rem] rounded-full bg-mint-100/60 blur-3xl" />
      {STARS.map((s, i) => (
        <span key={i} className="absolute animate-twinkle rounded-full bg-violet-500/40"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}
    </div>
  );
}
```

### Step 4 — The layout with navigation

Create the folder `src/layouts`.

**File:** `my_cosmos/frontend/src/layouts/AppShell.tsx`

```tsx
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { CosmicBackground } from "../components/CosmicBackground";

const NAV = [
  { to: "/", label: "Explore", end: true },
  { to: "/papers", label: "Papers" },
  { to: "/search", label: "Search" },
  { to: "/map", label: "Research Map" },
  { to: "/trends", label: "Trends" },
  { to: "/opportunities", label: "Opportunities" },
  { to: "/assistant", label: "Assistant" },
];

export function AppShell() {
  const [open, setOpen] = useState(false); // is the mobile menu open?
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
      isActive ? "bg-lavender-100 font-semibold text-violet-600" : "text-navy-500 hover:bg-white/70 hover:text-navy-900"
    }`;

  return (
    <div className="flex min-h-screen flex-col">
      <CosmicBackground />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">Skip to content</a>

      <header className="sticky top-0 z-40 border-b border-white/60 bg-cream/70 backdrop-blur-lg">
        <div className="container-cosmos flex h-16 items-center justify-between gap-4">
          <Link to="/" className="font-display text-lg font-bold tracking-[0.2em]">COSMOS</Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 xl:flex">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>{n.label}</NavLink>)}
          </nav>
          <button type="button" className="rounded-full p-2 xl:hidden" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className="sr-only">Toggle navigation</span>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {open && (
          <nav aria-label="Primary mobile" className="container-cosmos flex flex-wrap gap-1 pb-3 xl:hidden">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkClass} onClick={() => setOpen(false)}>{n.label}</NavLink>)}
          </nav>
        )}
      </header>

      <main id="main" className="flex-1"><Outlet /></main>

      <footer className="mt-24 border-t border-white/60 bg-white/40 py-10 text-sm text-navy-500">
        <div className="container-cosmos">
          <span className="font-display font-semibold tracking-[0.2em] text-navy-700">COSMOS</span> · Explore humanity's knowledge beyond Earth.
        </div>
      </footer>
    </div>
  );
}
```

### Step 5 — Two simple pages

Create the folder `src/pages`.

**File:** `my_cosmos/frontend/src/pages/ComingSoonPage.tsx`

```tsx
import { Link } from "react-router-dom";
import { GlassCard } from "../components/ui";

/** Placeholder for sections you build in later lessons. */
export function ComingSoonPage({ title, lesson }: { title: string; lesson: string }) {
  return (
    <div className="container-cosmos py-20">
      <GlassCard className="mx-auto max-w-xl p-10 text-center">
        <p className="eyebrow">{lesson}</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-navy-500">This part of the observatory is still being charted.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-violet-500 px-5 py-2 text-white hover:bg-violet-600">Back to Explore</Link>
      </GlassCard>
    </div>
  );
}
```

**File:** `my_cosmos/frontend/src/pages/ExplorePage.tsx`

```tsx
export function ExplorePage() {
  return (
    <section className="container-cosmos py-20">
      <p className="eyebrow">Space Research Intelligence</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
        Explore humanity's knowledge <span className="text-violet-500">beyond Earth.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-navy-500">The real Explore page arrives in Lesson 09.</p>
    </section>
  );
}
```

### Step 6 — Connect addresses to pages

**File:** `my_cosmos/frontend/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { AppShell } from "./layouts/AppShell";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { ExplorePage } from "./pages/ExplorePage";

const soon = (title: string, lesson: string) => <ComingSoonPage title={title} lesson={lesson} />;

const router = createBrowserRouter([
  {
    element: <AppShell />, // the layout around every page
    children: [
      { path: "/", element: <ExplorePage /> },
      { path: "/papers", element: soon("Research explorer", "Lesson 10") },
      { path: "/papers/:id", element: soon("Paper page", "Lesson 13") },
      { path: "/search", element: soon("Semantic search", "Lesson 12") },
      { path: "/map", element: soon("Research map", "Lesson 14") },
      { path: "/trends", element: soon("Trends", "Lesson 15") },
      { path: "/opportunities", element: soon("Research opportunities", "Lesson 16") },
      { path: "/assistant", element: soon("Research assistant", "Lesson 17") },
      { path: "*", element: soon("Lost in space", "404") },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

### Step 7 — Delete `App.tsx`

Delete `my_cosmos/frontend/src/App.tsx`. Nothing uses it now — `main.tsx` shows pages through the router.

### Step 8 — Try it

```powershell
npm run dev
```

## Check

- [ ] The header shows COSMOS and seven links (make the window wide to see them all).
- [ ] Clicking **Trends** shows "Trends — Lesson 15" and the address bar shows `/trends`.
- [ ] The current section is highlighted in lavender.
- [ ] Going to http://localhost:5173/nowhere shows "Lost in space".
- [ ] Narrow the window: a ☰ menu button appears and opens the links.

## What just happened?

- `createBrowserRouter([...])` is the list of routes. Children of `AppShell` all appear inside its `<Outlet />`.
- `path: "*"` catches every address that matched nothing else.
- `useState(false)` gives `AppShell` a piece of **state**: a value React remembers and re-draws the screen for when it changes. `setOpen(!open)` flips it.
- `xl:flex` / `xl:hidden` show the full nav only on wide screens and the ☰ button only on narrow ones.
- The "Skip to content" link is invisible until you press **Tab**. It lets keyboard users jump past the menu.

## Try it yourself

1. Press **Tab** right after the page loads. The "Skip to content" link appears.
2. Add an eighth nav item `{ to: "/about", label: "About" }` and a matching route using `soon("About", "Extra")`.
3. Remove it again before Lesson 07.

## If it does not work

| Problem | Fix |
|---|---|
| `Cannot find module 'react-router-dom'` | Step 1 wasn't run inside `my_cosmos\frontend`. Run it there and restart `npm run dev`. |
| Blank page, console says `useRoutes() may be used only in the context of a <Router>` | `main.tsx` doesn't use `RouterProvider`. Replace it exactly as in Step 6. |
| `Cannot find module './App'` | `main.tsx` still imports `App`. Use the Step 6 version. |
| Links reload the whole page (screen flashes white) | You used `<a href>` instead of `<Link to>` for an address inside COSMOS. |

---

**Next:** [07_THE_RESEARCH_DATA.md](07_THE_RESEARCH_DATA.md)
