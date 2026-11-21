# Lesson 02 — Set Up Your Computer

**Time:** 25 minutes | **You need:** internet, permission to install programs

## Goal

By the end of this lesson:

- **Node.js** works in your terminal (for the website),
- **Python** works in your terminal (for the API),
- **VS Code** is open on the course folder, with the right extensions.

## Understand

### What is a terminal?

A **terminal** is a window where you type commands instead of clicking. VS Code has one built in. On Windows it runs **PowerShell** by default.

### What is Node.js? What is npm?

Browsers run JavaScript. **Node.js** lets JavaScript also run on your computer, which the website's build tools need.

**npm** comes with Node.js. It is the "app store" for JavaScript packages — like `pip` for Python. React is an npm package.

### What is Python's virtual environment?

You will create one in Lesson 11 for the API. Think of it as a private bag of Python packages for just this project, so they never mix with other projects.

## Do it now

### Step 1 — Install the tools (skip what you already have)

1. **Node.js** — https://nodejs.org → install the **LTS** version (20 or 22).
2. **Python** — https://www.python.org/downloads/ → install **3.11 or 3.12**.
   - **Windows:** on the first installer screen tick **"Add python.exe to PATH"**. Very important.
   - Avoid 3.13 for this course: one package we use (`numpy 1.26`) has no ready-made version for it.
3. **VS Code** — https://code.visualstudio.com/

### Step 2 — Open the course folder in VS Code

**File → Open Folder…** → select `space-research-` (the folder that contains `learning-guide`, `frontend` and `backend`) → **Select Folder**. If VS Code asks *"Do you trust the authors?"*, click **Yes**.

### Step 3 — Install the extensions

Open the **Extensions** panel (the four-squares icon on the left) and install:

| Extension | Why |
|---|---|
| **Python** (Microsoft) | Runs and checks Python |
| **Python Debugger** (Microsoft) | Breakpoints in the API |
| **Tailwind CSS IntelliSense** | Suggests Tailwind classes as you type |
| **ESLint** | Spots JavaScript mistakes |

VS Code may also show a pop-up **"This workspace has extension recommendations"** — clicking **Install** does the same thing.

### Step 4 — Open a terminal

**Terminal → New Terminal.** The line should end with `space-research->`.

### Step 5 — Check Node.js and npm

```powershell
node --version
```

You should see `v20.something` or `v22.something`.

```powershell
npm --version
```

You should see `10.something`.

### Step 6 — Check Python

```powershell
python --version
```

You should see `Python 3.11.x` or `Python 3.12.x`.

**Didn't work?** On Windows try `py --version`. If that works, use `py` wherever the lessons say `python` when creating the virtual environment in Lesson 11.

## Check

- [ ] `node --version` prints v20 or newer.
- [ ] `npm --version` prints a number.
- [ ] `python --version` prints 3.11 or 3.12.
- [ ] VS Code's Explorer shows `learning-guide`, `frontend` and `backend`.

## What just happened?

You installed two "engines":

- **Node.js** runs the website's tools: the dev server, the TypeScript checker, the bundler.
- **Python** runs the API and all the NLP.

VS Code ties them together with an editor, a terminal and a debugger.

## Try it yourself

1. Close the terminal (the bin icon) and open a new one. Run `node --version` again. Everything still works — Node has no "activate" step.
2. Type `npm help` and skim the list of commands.

## If it does not work

| Problem | Fix |
|---|---|
| `node` is not recognized | Restart VS Code after installing Node. Still failing? Restart the computer (PATH updates need it). |
| `python` is not recognized | Re-run the Python installer, tick **Add python.exe to PATH**, restart VS Code. Or use `py`. |
| `python` opens the Microsoft Store | Windows has a fake "python" shortcut. Search Windows settings for **App execution aliases** and turn off the two Python entries. |
| You have Python 3.13 only | Install 3.12 as well. Then in Lesson 11 use `py -3.12 -m venv .venv`. |

---

**Next:** [03_YOUR_FIRST_REACT_PROJECT.md](03_YOUR_FIRST_REACT_PROJECT.md)
