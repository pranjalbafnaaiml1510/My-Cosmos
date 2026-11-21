import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { CosmicBackground } from "../components/cosmic/CosmicBackground";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services";

const NAV = [
  { to: "/", label: "Explore", end: true },
  { to: "/map", label: "Research Map" },
  { to: "/topics", label: "Topics" },
  { to: "/trends", label: "Trends" },
  { to: "/countries", label: "Countries" },
  { to: "/missions", label: "Missions" },
  { to: "/papers", label: "Papers" },
  { to: "/opportunities", label: "Opportunities" },
  { to: "/assistant", label: "Assistant" },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-[0.2em] text-navy-900">
      <span aria-hidden className="relative inline-block h-6 w-6">
        <span className="absolute inset-1 rounded-full bg-gradient-to-br from-lavender-300 to-blush-200" />
        <span className="absolute inset-0 rotate-[-20deg] rounded-[50%] border border-violet-500/60 [transform:rotate(-20deg)_scaleY(0.4)]" />
      </span>
      COSMOS
    </Link>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const stats = useAsync(() => api.getStats(), []);
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${isActive ? "bg-lavender-100 font-semibold text-violet-600" : "text-navy-500 hover:bg-white/70 hover:text-navy-900"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <CosmicBackground />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 glass px-4 py-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-white/60 bg-cream/70 backdrop-blur-lg">
        <div className="container-cosmos flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-1 xl:flex">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>{n.label}</NavLink>)}
          </nav>
          <div className="flex items-center gap-2">
            {stats.status === "ready" && stats.data.synthetic && (
              <span title="Synthetic demo records — not real research" className="rounded-full bg-blush-100 px-2.5 py-1 text-xs font-semibold text-navy-700">Demo data</span>
            )}
            <button className="rounded-full p-2 text-navy-700 hover:bg-white/70 xl:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
              <span className="sr-only">Toggle navigation</span>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Primary mobile" className="container-cosmos flex flex-wrap gap-1 pb-3 xl:hidden">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkCls} onClick={() => setOpen(false)}>{n.label}</NavLink>)}
          </nav>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="mt-24 border-t border-white/60 bg-white/40 py-10 text-sm text-navy-500">
        <div className="container-cosmos flex flex-wrap items-center justify-between gap-4">
          <p><span className="font-display font-semibold tracking-[0.2em] text-navy-700">COSMOS</span> · Explore humanity's knowledge beyond Earth.</p>
          <p>Signals are derived from the corpus and are not validated scientific conclusions.</p>
        </div>
      </footer>
    </div>
  );
}
