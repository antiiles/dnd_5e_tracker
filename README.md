# D&D 5e Tracker

A browser-based character tracker for D&D 5e. Static single-page app — no backend, no accounts.
Character data lives in the browser (IndexedDB); game content (races, classes, spells, …) is loaded
from JSON so new content can be added without code changes.

## Stack

Vite + React (plain JSX, no TypeScript).

## Getting started

```sh
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```sh
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## How content works

Each content type is a folder under `public/content/` (e.g. `classes/`, `spells/`). A folder has an
`index.json` manifest listing its files and `srd.json` with the developer-managed data. Every file is
a plain array of objects keyed by `id`; loading the same `id` again overrides it, a new `id` adds.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — locked design decisions (the target schema and content model).
- [docs/CODEMAP.md](docs/CODEMAP.md) — where things live in the code, and how to run it.
- [TODO.md](TODO.md) — outstanding work, current state vs. target.
