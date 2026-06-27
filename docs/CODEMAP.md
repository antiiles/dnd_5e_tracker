# Code map

Orientation for the codebase so you can jump to the right place instead of reading everything.
Line numbers are hints from when this was written and **will drift** — grep the function/constant
name (in `code` below) to find the current location.

## Layout

```
index.html              Vite entry
src/main.jsx            React mount (9 lines)
src/App.jsx             The React UI — state, effects, handlers, all render*() helpers (see breakdown below)
src/lib/                Pure, framework-free logic (unit-tested). See below.
src/content/            Content data layer (loading, adapters, IndexedDB homebrew). See below.
src/theme.css           Theme tokens (CSS custom properties) + all global styles; imported in main.jsx
vite.config.js          Vite config; base = /dnd_5e_tracker/ on build (subpath deploy)
public/content/<type>/  Content data: index.json (manifest) + srd.json (data) per type
.github/workflows/deploy.yml  CI: build → deploy to GitHub Pages on push to main
docs/                   ARCHITECTURE.md, CODEMAP.md
TODO.md                 Remaining work, each item a self-contained session
*.test.js               Vitest characterization tests, co-located next to the module they cover

## Pure logic — `src/lib/` and `src/content/`

Extracted from `App.jsx` so it's testable in isolation and editable without loading the whole UI.
All of `lib/` is framework-free; `App.jsx` imports from here.

| Module | Exports | Notes |
|--------|---------|-------|
| `lib/constants.js` | `ABILITIES`, `SPELL_LEVELS` | Reference data. |
| `lib/helpers.js` | `uid`, `num`, `abilityMod`, `fmtMod`, `profBonus`, `fmtFlat`, `cantripMult`, `scaleDice`, `addDicePerLevel` | Pure math/format/dice helpers. |
| `lib/slots.js` | `FULL/HALF/WARLOCK/THIRD_SLOTS`, `WARLOCK_INV_KNOWN`, `isPactPrereq`, `FAMILIAR_FORMS`, `emptySlots`, `slotsFor` | Rules-as-data + slot builder. |
| `lib/character.js` | `makeCharacter`, `normalizeAttack`, `hydrateCharacter`, `charactersFromImport` | Character model + import/migration. |
| `lib/seeds.js` | `seedCharacters()` | First-run example party: Warlock (Hilda), Wizard (Alaric, prepare), Bard (Lyra, known), all level 5. Cross-checked against SRD content in its test. |
| `lib/attacks.js` | `computeAttack(a, ctx)` | To-hit/damage engine. **Pure** — takes a character-derived `ctx`. |
| `lib/spells.js` | `spellToAttack`, `computeSpellCard`, `spellSummary`, `isSpellActive` (all `(…, ctx)`) | Spell→action integration; reuses `computeAttack`. |
| `content/adapters.js` | `adapt*`, `MECHANIC_ADAPTERS` | Flatten loaded JSON into UI shapes. |
| `content/loader.js` | `loadContentType`, `loadContent` | Fetch from `public/content/` (uses `BASE_URL`). |
| `content/userContent.js` | `CONTENT_TYPES`, `validateUserContent`, `getUserFiles`, `putUserFile`, `deleteUserFile` | IndexedDB homebrew persistence. |

`App.jsx` builds `engineCtx` once per render from the active character (`spellAbility`, `mods`, `charLevel`,
`pb`, `invocations`, `isPrepareCaster`, `preparedSpellIds`) and wraps the engines as thin `computeAttack`/
`computeSpellCard`/`spellSummary`/`isSpellActive` closures, so render call sites are unchanged. To change
combat math, edit `lib/attacks.js`/`lib/spells.js` and their tests — you don't need to open `App.jsx`.
```

Content types under `public/content/`: `races`, `classes`, `skills`, `feats`, `weapons`, `spells`,
`invocations`, `patrons`, `pacts`.

## Inside `src/App.jsx`

`App.jsx` is now the **React layer only** — state, effects, handlers, and all `render*()` helpers.
Pure logic (constants, helpers, slot tables, character model, content loading/adapters, IndexedDB, the
attack/spell engines) was extracted into `src/lib/` and `src/content/` — see the table above. The notes
below describe what remains here, top to bottom:

| Region | Anchors | Notes |
|--------|---------|-------|
| Imports | top of file | Pulls pure logic from `./lib/*` and `./content/*`; the engines are aliased (`computeAttackEngine`, etc.). |
| UI | `export default function App()` | The component: state, effects, handlers, derived accessors (`activeClassId`, `charLevel`, `classDef`, `classMechanics`, `spellById`, `classResources`, `resourceMax`), and all render helpers. Three spell surfaces in the Combat & Magic tab: **Spellbook** (`renderSpellbook()`) is repertoire/reference — browse available spells, add/remove (`active.spells`), expand descriptions (`openSpell` state); the whole panel folds via a chevron header (`spellbookOpen` state). **Spellcasting** (`renderSpellcasting()` + `spellLine()`) lists the repertoire per spell level alongside slot pips/max; prepare casters get a Prepare toggle per leveled spell + a "Prepared N/max" badge. Each `spellLine()` row also expands to show meta + full `description` (multi-open `openCastSpells` Set), independent of the Prepare toggle. Both fold/expand states are ephemeral (not persisted), like `openSpell`/`castLevels`. **Attacks** (`renderAttacks()`) shows only *castable* actionable spells. Patron & Pact / Eldritch Invocations panels (`renderNotes()`) gated on `classMechanics.includes(...)`. |
| Engine wrappers | `engineCtx`, `computeAttack`, `computeSpellCard`, `spellSummary`, `isSpellActive` (after the derived accessors) | `engineCtx` packs the character-derived inputs (`spellAbility`, `mods`, `charLevel`, `pb`, `invocations`, `isPrepareCaster`, `preparedSpellIds`); the wrappers forward it to the pure engines in `lib/attacks.js`/`lib/spells.js`. The *math* — to-hit/save/damage, Eldritch Blast beams + invocations, `heal`/`auto`/multi-attack spells, and upcasting via `castLevel`/`addDicePerLevel` — lives in those modules (and their tests), not here. |

> If you only need to change rendering or state, go straight to `App()`. For content/data behavior,
> stay in the loading + adapter region and don't read the UI.

## Running it

```sh
npm install      # first time
npm run dev      # dev server (Vite)
npm test         # run the Vitest suite once (pure lib/ + content/ logic)
npm run test:watch  # Vitest in watch mode
npm run build    # production build → dist/
npm run preview  # serve the built dist/ locally
```

No backend, no env vars. Content is served statically from `public/content/`.

## Deploying

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) builds and publishes `dist/` to
GitHub Pages. Live at https://antiiles.github.io/dnd_5e_tracker/. No manual step. To verify a build
locally at the real base path first: `npm run build && npm run preview`.
