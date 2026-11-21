# Lesson 03 — Your First React Project

**Time:** 15 minutes | **You need:** Lesson 02 finished (`node --version` works)

## Goal

By the end of this lesson you will:

- create the folder `my_cosmos` with a React website inside it,
- start the **dev server**,
- change some text and watch the browser update by itself.

## Understand

### What is React?

A web page is made of HTML: headings, paragraphs, buttons. Writing a big website as one huge HTML file gets messy fast.

**React** lets you build the page from small reusable pieces called **components**, like LEGO bricks: a `PaperCard` brick, a `SearchBar` brick, a `Chip` brick. You build a brick once and use it a hundred times.

A component is a function that returns what to show:

```tsx
function Hello() {
  return <h1>Hello, COSMOS</h1>;
}
```

That `<h1>` inside JavaScript is called **JSX**. It looks like HTML, but it's JavaScript underneath.

### What is TypeScript?

**TypeScript** is JavaScript with **types**. You write down what kind of data you expect, and mistakes are caught before the code runs:

```ts
function yearsAgo(year: number) { return 2026 - year; }
yearsAgo("2015");   // ❌ TypeScript stops you: "2015" is text, not a number
```

Files that contain JSX end in `.tsx`; plain TypeScript files end in `.ts`.

### What is Vite?

**Vite** is the tool that:

1. creates a starter project for you,
2. runs a **dev server** that shows your site and reloads it instantly when you save,
3. later **builds** the final optimised files for the internet.

## Do it now

**Check first:** your terminal line ends with `space-research->`.

### Step 1 — Create your project folder

```powershell
mkdir my_cosmos
```

```powershell
cd my_cosmos
```

The terminal line now ends with `my_cosmos>`.

### Step 2 — Ask Vite to create the website

```powershell
npm create vite@5.5.2 frontend -- --template react-ts
```

If npm asks *"Ok to proceed? (y)"*, type `y` and press Enter.

`frontend` is the folder name. `react-ts` means "React with TypeScript". The `@5.5.2` pins the version so your files match this course exactly.

### Step 3 — Install the packages

```powershell
cd frontend
```

```powershell
npm install
```

This downloads React and the tools into a folder called `node_modules`. It takes 1–2 minutes.

### Step 4 — Look at what was created

```
my_cosmos/frontend/
├── index.html          ← the single HTML page; React fills it in
├── package.json        ← the project's name, scripts and packages ("shopping list")
├── vite.config.ts      ← Vite settings
├── tsconfig*.json      ← TypeScript settings
├── node_modules/       ← downloaded packages (never edit, never share)
├── public/             ← files served as-is (images, data)
└── src/
    ├── main.tsx        ← the starting point: puts <App /> on the page
    ├── App.tsx         ← the first component
    ├── App.css, index.css
    └── assets/
```

### Step 5 — Start the dev server

```powershell
npm run dev
```

You should see:

```
  VITE v5.4.x  ready in 400 ms
  ➜  Local:   http://localhost:5173/
```

### Step 6 — Open your website

Open **http://localhost:5173/** in your browser. You see the Vite and React logos and a **count** button. Click it — the number goes up.

### Step 7 — Change something

Open `my_cosmos/frontend/src/App.tsx`. Find the line:

```tsx
<h1>Vite + React</h1>
```

Change it to:

```tsx
<h1>Hello, COSMOS</h1>
```

Save (**Ctrl + S**). Look at the browser: it changed **without** refreshing. This is called **hot reload**.

### Step 8 — Stop the server

Click inside the terminal and press **Ctrl + C**.

## Check

- [ ] The folder `my_cosmos/frontend` exists and contains `node_modules`.
- [ ] You saw "Hello, COSMOS" in the browser after saving.
- [ ] After Ctrl + C, refreshing the browser shows "This site can't be reached".

## What just happened?

- `npm create vite` copied a ready-made React + TypeScript project into `frontend/`.
- `npm install` read `package.json` and downloaded everything into `node_modules`.
- `npm run dev` ran the `"dev"` script from `package.json`, which starts Vite.
- `localhost` means "this computer", and `5173` is the **port** — a door number on your computer.
- When you saved `App.tsx`, Vite noticed and sent only the changed component to the browser.

### npm commands you will use

Always run these from `my_cosmos/frontend`:

| Command | What it does |
|---|---|
| `npm install` | Install the packages in `package.json` |
| `npm install name@version` | Add a new package |
| `npm run dev` | Start the dev server |
| `npm run build` | Check all types and build the final site |

## Try it yourself

1. Start the server again. In `App.tsx`, change `useState(0)` to `useState(100)`. What does the button start at now?
2. Run `npm run build`. It should finish with `✓ built`. A `dist/` folder appears: that is the final website.
3. Stop the server.

## If it does not work

| Problem | Fix |
|---|---|
| `npm` is not recognized | Node.js isn't installed or VS Code was open during install. Restart VS Code. |
| `npm create` asks questions | You missed `-- --template react-ts`. Answer: framework **React**, variant **TypeScript**. |
| `Port 5173 is in use, trying another one...` | The finished COSMOS is still running. That's fine: Vite picks 5174. Use the address it prints. |
| PowerShell says *"running scripts is disabled"* for `npm` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, type `Y`, then try again. |
| White page in browser | Look at the terminal and press **F12 → Console** in the browser. Read the first red error. |

## Every time you come back to work

```powershell
cd my_cosmos\frontend
```

```powershell
npm run dev
```

---

**Next:** [04_TAILWIND_AND_THE_PASTEL_THEME.md](04_TAILWIND_AND_THE_PASTEL_THEME.md)
