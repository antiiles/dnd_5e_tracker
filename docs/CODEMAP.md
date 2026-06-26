# Code map

Orientation for the codebase so you can jump to the right place instead of reading everything.
Line numbers are hints from when this was written and **will drift** — grep the function/constant
name (in `code` below) to find the current location.

## Layout

```
index.html              Vite entry
src/main.jsx            React mount (9 lines)
src/App.jsx             The entire app — ~2,300 lines, one file (see breakdown below)
vite.config.js          Vite + React plugin config
public/content/<type>/  Content data: index.json (manifest) + srd.json (data) per type
docs/                   ARCHITECTURE.md, CODEMAP.md
TODO.md                 Remaining work, each item a self-contained session
```

Content types under `public/content/`: `races`, `classes`, `skills`, `feats`, `weapons`, `spells`,
`invocations`, `patrons`, `pacts`.

## Inside `src/App.jsx`

Almost everything lives in this one file. Regions, top to bottom:

| Region | Anchors | Notes |
|--------|---------|-------|
| Constants & helpers | `ABILITIES`, `SPELL_LEVELS`, `uid`, `abilityMod`, `profBonus` (~4–27) | Pure math/util. |
| Content loading | `loadContentType`, `loadContent` (~29–98) | Fetches `index.json` then each file; dedupes by `id` (override pattern). |
| Content adapters | `adaptRaces`, `adaptClasses`, `adaptSkills`, … (~38–80) | **Flatten** loaded JSON into the shapes the UI consumes. `adaptClasses` keys by `id` and includes `name`, `resources`. Still drops `mechanics`/`subclasses` — see TODO items 4–5. |
| Spell-slot tables | `FULL_SLOTS`, `HALF_SLOTS`, `WARLOCK_SLOTS`, `slotsFor`, `emptySlots` (~101–171) | Rules-as-data, lives in app not content. |
| Familiar data | `FAMILIAR_FORMS` (~129) | Warlock-specific. |
| Character model | `makeCharacter`, `normalizeAttack`, `hydrateCharacter`, `charactersFromImport` (~173–252) | Current shape: `classes:[{id,level}]`, `hitDice:{total,remaining,dieType}`, `concentration:null`, `resources:{}`. `hydrateCharacter` migrates legacy `cls`/`level` and `hitDice:{cur,max,die}` on import. |
| Theme & styles | `T` (labels/theme), `CSS` (style blob) (~254–512) | |
| UI | `export default function App()` (~513 → end) | One ~1,850-line component holding all render + state. Derived accessors `activeClassId`, `charLevel`, `classDef`, `isWarlock`, `classResources`, `resourceMax` sit just before the JSX return. `renderResources()` renders the Class resources panel (counter/pips/toggle) at the top of the Combat & Magic tab. |

> If you only need to change rendering or state, go straight to `App()`. For content/data behavior,
> stay in the loading + adapter region and don't read the UI.

## Running it

```sh
npm install      # first time
npm run dev      # dev server (Vite)
npm run build    # production build → dist/
npm run preview  # serve the built dist/ locally
```

No backend, no env vars. Content is served statically from `public/content/`.
