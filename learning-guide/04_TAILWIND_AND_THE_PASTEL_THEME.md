# Lesson 04 — Tailwind and the Pastel Theme

**Time:** 20 minutes | **You need:** Lesson 03 finished

## Goal

By the end of this lesson:

- **Tailwind CSS** is installed,
- COSMOS has its own **pastel colours** (lavender, dusty blue, blush, mint, cream, navy),
- you have a reusable **glass** card style,
- your page says "Hello, COSMOS" on a soft cream background.

## Understand

### What is CSS?

**CSS** decides how things look: colours, sizes, spacing, fonts. Normal CSS lives in separate files:

```css
.title { font-size: 48px; font-weight: bold; color: #1d2140; }
```

### What is Tailwind?

**Tailwind** gives you thousands of tiny ready-made classes. You style things right in the HTML:

```tsx
<h1 className="text-5xl font-bold text-navy-900">Hello</h1>
```

| Class | Means |
|---|---|
| `text-5xl` | big text |
| `font-bold` | bold |
| `text-navy-900` | our dark navy colour |
| `p-6` | padding on all sides (6 × 4 px = 24 px) |
| `mt-8` | margin on top |
| `rounded-2xl` | rounded corners |
| `sm:` `lg:` prefixes | only on small / large screens and up |

In React the HTML `class` attribute is written `className`.

### Design tokens

Instead of typing colour codes everywhere, we give each colour a **name** once, in `tailwind.config.js`. These named colours are called **design tokens**. If we ever change "lavender", it changes everywhere.

COSMOS's spec asks for *"a cute futuristic space laboratory"*: pastel colours, dark text on light surfaces for readability, no neon, no pure black.

### What is "glassmorphism"?

A card that looks like frosted glass: slightly see-through white, blurred background, soft shadow. We make one class, `.glass`, and use it everywhere.

## Do it now

**Check first:** terminal ends with `frontend>`. If not: `cd my_cosmos\frontend`. Stop the dev server if it's running (Ctrl + C).

### Step 1 — Install Tailwind (version 3)

```powershell
npm install -D tailwindcss@3.4.13 postcss@8.4.47 autoprefixer@10.4.20
```

`-D` means "only needed while building", not by visitors.

### Step 2 — Create the config files

```powershell
npx tailwindcss init -p
```

This creates `tailwind.config.js` and `postcss.config.js`.

### Step 3 — Add the COSMOS colours and animations

**File:** `my_cosmos/frontend/tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  // Which files Tailwind scans for class names
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#fbf8f3",
        lavender: { 50: "#f6f3fd", 100: "#ece6fb", 200: "#d9cef5", 300: "#bfaeea", 400: "#a08dd9" },
        dusty: { 100: "#e4ecf6", 200: "#c7d6ea", 300: "#9fb7d6", 400: "#7895bf" },
        blush: { 100: "#fbe8ee", 200: "#f5cfdb", 300: "#eaa9be" },
        mint: { 100: "#e3f5ee", 200: "#c4eadb", 300: "#94d5bc" },
        violet: { 500: "#7a68b8", 600: "#5f4f9c" },
        navy: { 500: "#4a5378", 700: "#2d3354", 900: "#1d2140" },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', "sans-serif"],
      },
      boxShadow: { glass: "0 8px 32px -12px rgba(77, 72, 140, 0.18)" },
      keyframes: {
        orbit: { to: { transform: "rotate(360deg)" } },
        twinkle: { "0%,100%": { opacity: "0.25" }, "50%": { opacity: "0.9" } },
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        orbit: "orbit 18s linear infinite",
        "orbit-fast": "orbit 1.6s linear infinite",
        twinkle: "twinkle 4s ease-in-out infinite",
        rise: "rise .5s ease-out both",
      },
    },
  },
  plugins: [],
};
```

### Step 4 — Replace the global CSS

**File:** `my_cosmos/frontend/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { @apply bg-cream text-navy-900 antialiased; }
  body { @apply font-sans min-h-screen; }
  h1, h2, h3 { @apply font-display tracking-tight; }
  /* A clear outline when you move around with the Tab key (accessibility) */
  :focus-visible { @apply outline-none ring-2 ring-violet-500 ring-offset-2 ring-offset-cream rounded-md; }
}

@layer components {
  .glass { @apply bg-white/60 backdrop-blur-md border border-white/70 shadow-glass rounded-2xl; }
  .container-cosmos { @apply mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8; }
  .eyebrow { @apply text-xs font-semibold uppercase tracking-[0.18em] text-violet-500; }
}

/* Respect people who ask their computer for less animation */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

### Step 5 — Load the fonts

**File:** `my_cosmos/frontend/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My COSMOS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Step 6 — Use the theme

**File:** `my_cosmos/frontend/src/App.tsx`

```tsx
export default function App() {
  return (
    <main className="container-cosmos py-16">
      <p className="eyebrow">Space Research Intelligence</p>
      <h1 className="mt-2 text-5xl font-bold">
        Hello, <span className="text-violet-500">COSMOS</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg text-navy-500">Explore humanity's knowledge beyond Earth.</p>

      <div className="glass mt-10 max-w-md p-6">
        <p className="font-semibold">This is a glass card</p>
        <p className="mt-1 text-sm text-navy-500">Frosted white, soft shadow, rounded corners.</p>
      </div>

      <div className="mt-6 flex gap-3">
        <span className="h-12 w-12 rounded-full bg-lavender-200" title="lavender" />
        <span className="h-12 w-12 rounded-full bg-dusty-200" title="dusty blue" />
        <span className="h-12 w-12 rounded-full bg-blush-200" title="blush" />
        <span className="h-12 w-12 rounded-full bg-mint-200" title="mint" />
      </div>
    </main>
  );
}
```

### Step 7 — Delete the old styles

Delete the file `my_cosmos/frontend/src/App.css` (right-click → Delete). We don't use it any more.

### Step 8 — Look at it

```powershell
npm run dev
```

Open the address it prints.

## Check

- [ ] The background is a soft cream, not white.
- [ ] "COSMOS" is lavender-violet and the heading uses a rounder, futuristic font.
- [ ] You see a frosted card and four pastel circles.

## What just happened?

- `tailwind.config.js` taught Tailwind our colour names, so classes like `bg-lavender-200` and `text-navy-500` now exist.
- `@tailwind base/components/utilities` in `index.css` pulls in all of Tailwind.
- `@layer components { .glass {...} }` made our own class from Tailwind pieces (`@apply`).
- `index.html` loaded two Google Fonts. `font-display` (headings) is Space Grotesk; everything else is Plus Jakarta Sans.

## Try it yourself

1. Change the card's `p-6` to `p-10`. What changed?
2. Add `animate-twinkle` to one of the circles. Then turn on "reduce motion" in your operating system's settings (Windows: Settings → Accessibility → Visual effects → Animation effects **off**) and reload. The twinkling stops — that's the `prefers-reduced-motion` rule.
3. Make a fifth circle using `bg-violet-500`.

## If it does not work

| Problem | Fix |
|---|---|
| No colours at all | `content` in `tailwind.config.js` is wrong, or `index.css` doesn't start with the three `@tailwind` lines. |
| `Cannot find module './App.css'` | You deleted `App.css` but your `App.tsx` still imports it. Replace `App.tsx` exactly as in Step 6. |
| Fonts look plain | No internet, or a typo in the `<link>`. The site still works with system fonts. |
| VS Code underlines `@tailwind` / `@apply` | Harmless. The Tailwind extension removes the warning. |

---

**Next:** [05_COMPONENTS_AND_THE_DESIGN_SYSTEM.md](05_COMPONENTS_AND_THE_DESIGN_SYSTEM.md)
