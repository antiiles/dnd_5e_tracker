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
| Content loading | `loadContentType`, `loadContent` (~29–115) | Fetches `index.json` then each file; dedupes by `id` (override pattern). Base types always loaded; mechanic folders (`invocations`, `patrons`, `pacts`) fetched only when at least one class declares them in its `mechanics` array. |
| Content adapters | `adaptRaces`, `adaptClasses`, `adaptSkills`, `adaptSpells`, … (~38–100) | **Flatten** loaded JSON into the shapes the UI consumes. `adaptClasses` keys by `id` and includes `name`, `resources`, `mechanics`, `learning` (spellcasting learningType). `adaptSpells` normalises the spell schema. Still drops `subclasses` — see TODO item 5b. |
| Spell-slot tables | `FULL_SLOTS`, `HALF_SLOTS`, `WARLOCK_SLOTS`, `THIRD_SLOTS`, `slotsFor`, `emptySlots` (~101–185) | Rules-as-data, lives in app not content. `slotsFor` handles `full`/`half`/`third`/`warlock`. |
| Familiar data | `FAMILIAR_FORMS` (~145) | Warlock-specific. |
| Character model | `makeCharacter`, `normalizeAttack`, `hydrateCharacter`, `charactersFromImport` (~190–285) | Current shape: `classes:[{id,level}]`, `hitDice:{total,remaining,dieType}`, `concentration:null`, `resources:{}`, `spells:[]` (chosen spell ids). `hydrateCharacter` migrates legacy `cls`/`level` and `hitDice:{cur,max,die}` on import. |
| Theme & styles | `T` (labels/theme), `CSS` (style blob) (~290–530) | |
| UI | `export default function App()` (~535 → end) | One large component holding all render + state. Derived accessors `activeClassId`, `charLevel`, `classDef`, `classMechanics`, `spellById`, `classResources`, `resourceMax` sit just before the JSX return. `renderResources()` renders the Class resources panel. `renderSpellbook()` renders the known/prepared spell selector (Combat & Magic tab) — gated on `classDef.caster`; uses `classDef.learning` for prepared vs. known mode; filters pool by class id and highest non-zero slot level; each row shows a computed mechanics summary and expands to its description (`openSpell` state). Patron & Pact and Eldritch Invocations panels (in `renderNotes()`) are gated on `classMechanics.includes(...)`. |
| Spell → attack integration | `cantripMult`, `scaleDice`, `spellToAttack`, `computeSpellCard`, `spellSummary` (just after `computeAttack`) | A chosen spell with an `action` block is mapped into the shape `computeAttack` consumes (reusing the whole to-hit/save/damage engine, incl. Eldritch Blast's beam + invocation logic); healing handled directly. `renderAttacks()` appends these as read-only "From spellbook" cards. `handleClassChange` clears `spells:[]` so the spellbook resets per class. |

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
