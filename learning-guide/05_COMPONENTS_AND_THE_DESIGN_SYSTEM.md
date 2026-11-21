# Lesson 05 — Components and the Design System

**Time:** 25 minutes | **You need:** Lesson 04 finished

## Goal

By the end of this lesson you will have a small **design system**: reusable components that every COSMOS page will use.

| Component | What it shows |
|---|---|
| `GlassCard` | A frosted card around anything |
| `SectionHeader` | A small label + big title + description |
| `StatCard` | A big number with a label ("1,500 Research papers") |
| `Chip` | A small rounded tag ("Computer Vision") |
| `EmptyState` | A friendly message when there's nothing to show |
| `CosmicLoader` | A tiny orbiting planet while data loads |

## Understand

### Props: giving a component information

A component is a function. **Props** are its inputs, like function arguments:

```tsx
function StatCard({ value, label }: { value: number; label: string }) {
  return <div>{value} {label}</div>;
}

<StatCard value={1500} label="Research papers" />
```

- `{ value, label }` takes the props out of the object.
- `: { value: number; label: string }` is the TypeScript **type**: `value` must be a number, `label` must be text.
- In JSX, `{ ... }` means "put a JavaScript value here".

### `children`: what goes between the tags

```tsx
<GlassCard>Anything here is the children</GlassCard>
```

The type for "anything React can show" is `ReactNode`.

### Optional props and defaults

```tsx
function Chip({ children, tone = "topic" }: { children: ReactNode; tone?: "topic" | "method" }) { ... }
```

The `?` means "optional". `= "topic"` is the value used when nobody passes one. `"topic" | "method"` means "only these exact words are allowed" — TypeScript will refuse `tone="purple"`.

### Why a design system?

The spec says: *"Do not duplicate UI code. Create a coherent design system."* If ten pages each draw their own chips, they slowly end up looking different. One `Chip` component keeps every chip identical, and one change updates them all.

## Do it now

**Check first:** terminal ends with `frontend>`. Start `npm run dev` if it isn't running.

### Step 1 — Create the components folder and file

In the Explorer, right-click `src` → **New Folder** → `components`.

**File:** `my_cosmos/frontend/src/components/ui.tsx`

```tsx
import type { ReactNode } from "react";

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
  topic: "bg-lavender-100 text-violet-600",
  entity: "bg-dusty-100 text-navy-700",
  method: "bg-mint-100 text-navy-700",
  signal: "bg-blush-100 text-navy-700",
} as const;

/** A small rounded tag. The tone says what kind of thing it is. */
export function Chip({ children, tone = "topic" }: { children: ReactNode; tone?: keyof typeof CHIP_TONES }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CHIP_TONES[tone]}`}>{children}</span>;
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

### Step 2 — Show all components on one page

This page is a **showcase** — a place to see every component at once.

**File:** `my_cosmos/frontend/src/App.tsx`

```tsx
import { Chip, CosmicLoader, EmptyState, GlassCard, SectionHeader, StatCard } from "./components/ui";

export default function App() {
  return (
    <main className="container-cosmos space-y-12 py-16">
      <SectionHeader eyebrow="Design system" title="COSMOS components" description="Every page is built from these pieces." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={1500} label="Research papers" />
        <StatCard value={14} label="Countries" />
        <StatCard value={38} label="Research topics" />
        <StatCard value={84} label="Organizations" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip>Computer Vision</Chip>
        <Chip tone="method">Deep Learning</Chip>
        <Chip tone="entity">Star Trackers</Chip>
        <Chip tone="signal">Emerging topic signal</Chip>
      </div>

      <GlassCard className="p-6">
        <p className="font-semibold">A glass card</p>
        <p className="mt-1 text-sm text-navy-500">Put anything inside.</p>
      </GlassCard>

      <GlassCard>
        <CosmicLoader label="Searching the research universe…" />
      </GlassCard>

      <GlassCard>
        <EmptyState title="No papers match these filters." hint="Try removing a filter." />
      </GlassCard>
    </main>
  );
}
```

### Step 3 — Look at it

Save, and look at the browser. Every component appears once.

## Check

- [ ] You see four stat cards with commas in big numbers (`1,500`).
- [ ] You see four chips in four different pastel colours.
- [ ] The little planet orbits around the dot.
- [ ] `npm run build` (in a second terminal, or after Ctrl + C) finishes with `✓ built`.

## What just happened?

- `export function ...` makes a component usable in other files. `import { ... } from "./components/ui"` brings it in.
- `{description && <p>...</p>}` means "only show the paragraph if there is a description".
- `value.toLocaleString()` turns `1500` into `1,500`.
- `keyof typeof CHIP_TONES` means "one of the keys of CHIP_TONES": `"topic" | "entity" | "method" | "signal"`. Add a new tone to the object and TypeScript automatically allows it.
- `role="status"` tells screen readers "this text is a live status message".

## Try it yourself

1. In `App.tsx`, write `<Chip tone="purple">Test</Chip>`. What does VS Code say? (A red underline: `"purple"` is not allowed.) Undo it.
2. Add a fifth tone `warning: "bg-blush-200 text-navy-900"` to `CHIP_TONES` and use it.
3. Give `StatCard` an optional `suffix` prop (for example `"+"`) and show it after the number.

## If it does not work

| Problem | Fix |
|---|---|
| `Module has no exported member 'StatCard'` | Missing `export` in front of `function StatCard`, or a typo in the name. |
| Red underline under `ReactNode` | The first line must be `import type { ReactNode } from "react";` |
| Planet doesn't move | `animate-orbit-fast` comes from `tailwind.config.js` (Lesson 04 Step 3). Check it's there, then restart `npm run dev`. |
| `npm run build` fails with `'x' is declared but never used` | TypeScript is strict about unused variables. Delete the unused line. |

---

**Next:** [06_PAGES_AND_NAVIGATION.md](06_PAGES_AND_NAVIGATION.md)
