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
| Content loading | `loadContentType`, `loadContent` (~29–115) | Fetches `index.json` then each file; dedupes by `id` (override pattern). Base types always loaded; mechanic folders (`invocations`, `patrons`, `pacts`) fetched only when at least one class declares them in its `mechanics` array. `loadContentType` also merges the user's homebrew (see below) *after* SRD, so a user `id` overrides the SRD one. |
| User content (IndexedDB) | `idbOpen`, `getUserFiles`, `putUserFile`, `deleteUserFile`, `validateUserContent`, `CONTENT_TYPES` (just before Content loading) | Homebrew persistence: db `dnd-content`, store `userContent`, one record per content type holding named files. The "Content" header button opens a modal (`showContent`) to add (file/paste) and remove files; `reloadContent()` re-runs `loadContent()` after each change. |
| Content adapters | `adaptRaces`, `adaptClasses`, `adaptSkills`, `adaptSpells`, … (~38–100) | **Flatten** loaded JSON into the shapes the UI consumes. `adaptClasses` keys by `id` and includes `name`, `resources`, `mechanics`, `learning` (spellcasting learningType). `adaptSpells` normalises the spell schema. Still drops `subclasses` — see TODO item 5b. |
| Spell-slot tables | `FULL_SLOTS`, `HALF_SLOTS`, `WARLOCK_SLOTS`, `THIRD_SLOTS`, `slotsFor`, `emptySlots` (~101–185) | Rules-as-data, lives in app not content. `slotsFor` handles `full`/`half`/`third`/`warlock`. |
| Familiar data | `FAMILIAR_FORMS` (~145) | Warlock-specific. |
| Character model | `makeCharacter`, `normalizeAttack`, `hydrateCharacter`, `charactersFromImport` (~190–285) | Current shape: `classes:[{id,level}]`, `hitDice:{total,remaining,dieType}`, `concentration:null`, `resources:{}`, `spells:[]` (repertoire), `preparedSpells:[]`. `hydrateCharacter` migrates legacy `cls`/`level` and `hitDice:{cur,max,die}`; the storage-load path migrates legacy hardcoded `eldritchBlast` attack rows into `spells`. |
| Theme & styles | `T` (labels/theme), `CSS` (style blob) (~290–530) | |
| UI | `export default function App()` (~535 → end) | One large component holding all render + state. Derived accessors `activeClassId`, `charLevel`, `classDef`, `classMechanics`, `spellById`, `classResources`, `resourceMax` sit just before the JSX return. Three spell surfaces in the Combat & Magic tab: **Spellbook** (`renderSpellbook()`) is repertoire/reference — browse available spells, add/remove (`active.spells`), expand descriptions (`openSpell` state). **Spellcasting** (`renderSpellcasting()` + `spellLine()`) lists the repertoire per spell level alongside slot pips/max; prepare casters get a Prepare toggle per leveled spell + a "Prepared N/max" badge. **Attacks** (`renderAttacks()`) shows only *castable* actionable spells. Patron & Pact / Eldritch Invocations panels (`renderNotes()`) gated on `classMechanics.includes(...)`. |
| Spell → attack integration | `cantripMult`, `scaleDice`, `addDicePerLevel`, `spellToAttack`, `computeSpellCard`, `spellSummary`, `isSpellActive`, `togglePrepared` (just after `computeAttack`) | A chosen spell with an `action` block maps into the shape `computeAttack` consumes (reusing the to-hit/save/damage engine, incl. Eldritch Blast's beam + invocation logic); healing handled directly. `isSpellActive(sp)` = cantrip ∨ (prepare-caster ? prepared : known). `renderAttacks()` appends castable actionable spells as read-only "From spellbook" cards. **Upcasting:** `spellToAttack`/`computeSpellCard` take a `castLevel`; `addDicePerLevel` adds `action.higherLevel` dice per slot above base. The derived card renders a "Cast at slot" selector (levels ≥ base with `spellSlots[l].max > 0`); chosen level lives in the ephemeral `castLevels` state map (not persisted), defaulting to base or, for warlocks, the pact slot. `handleClassChange` clears `spells`/`preparedSpells` so the spellbook resets per class. |

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
