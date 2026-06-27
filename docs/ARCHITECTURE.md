# Architecture

Locked architectural decisions for the D&D 5e tracker. These were agreed before scaffolding to
prevent drift — **check this before adding new content types, class features, or character state
fields.**

> This describes the **target** design. Not all of it is implemented yet — see [TODO.md](../TODO.md)
> for what is real today vs. still aspirational.

## Stack

Vite + React (plain JSX, no TypeScript). Deployed as a static site to **GitHub Pages** (repo public —
Pages on the free plan requires it), served from the subpath `/dnd_5e_tracker/`. Continuous deploy
from `main` via GitHub Actions. No backend. User content stored in IndexedDB.

## Deployment & base path

- Served from a **subpath** (`/dnd_5e_tracker/`), not domain root. Any reference to a bundled asset or
  content file must resolve through `import.meta.env.BASE_URL` (as the content loader already does) —
  **never hardcode a root-absolute `/...` path**, it will 404 in production.
- `vite.config.js` sets `base` to `/dnd_5e_tracker/` for `build` and `/` for `dev`, so `npm run dev`
  stays at root.
- `npm run preview` serves at the real subpath — use it to catch base-path regressions before pushing.
  (Note: `vite preview`'s SPA fallback returns `index.html` for missing files; GitHub Pages serves raw
  files with real 404s, so preview is stricter-looking than prod for missing-file cases.)
- No client-side router, so no `404.html` SPA fallback needed.

## Content system

- One folder per content type under `public/content/`
  (`races/`, `classes/`, `spells/`, `feats/`, `weapons/`, `skills/`, `invocations/`, `patrons/`, `pacts/`).
- Each folder has an `index.json` listing its files, and `srd.json` for all developer-managed content.
- User uploads are separate named JSON files in the same folder, tracked in IndexedDB.
- Every file in a folder is a plain array — the folder name declares the type, so no wrapper/type
  field is needed.
- Same ID = override, new ID = addition.

## Class schema

- `"mechanics": ["invocations", "patrons", "pacts"]` — declares which extra content-type folders the
  class uses; the app loads and shows those sections dynamically.
- `"resources": [{ "id", "name", "recharge", "max", "displayType" }]` — trackable class resources.
  - `max` is either `{ "scalingType": "level" }`, `{ "scalingTable": [20-value array] }`, or a fixed number.
  - `displayType`: `"counter"` (ki, sorcery points), `"pips"` (rage, channel divinity), `"toggle"` (single-use).
- `"spellcasting": { "type": "full"|"half"|"warlock"|"third"|null, "ability": "int", "learningType": "prepare"|"known" }`
  - Slot progression tables (full/half/warlock/third) live in app mechanics, not content.
- `"subclasses"` array mirrors the race → subrace pattern.

## Character schema

- `"classes": [{ "id": "fighter", "level": 5 }]` — always an array, even for single-class, so
  multiclassing is additive later.
- `"hitDice": { "total": 5, "remaining": 3, "dieType": 10 }` — universal character state, not a class resource.
- `"concentration": { "spellId": "...", "spellName": "..." } | null` — first-class character state,
  cleared on damage/rest.
- `"spells": ["fireball", ...]` — the character's repertoire (built in the Spellbook). Cleared on
  class change.
- `"preparedSpells": ["fireball", ...]` — subset of `spells` marked prepared in Spellcasting.
  Only meaningful for `learningType: "prepare"` classes; cantrips are always castable and never
  counted. A spell is castable (and surfaces under Attacks) when it's a cantrip, or known by a
  non-prepare caster, or prepared by a prepare caster.
- Conditions and temp HP tracked in character state.

## Spell schema

Fields per entry in `public/content/spells/`:
- `"id"`, `"name"` — required identifiers.
- `"level"` — integer; `0` = cantrip.
- `"school"` — e.g. `"evocation"`, `"illusion"`.
- `"castingTime"`, `"range"`, `"duration"` — display strings.
- `"concentration"` — boolean.
- `"ritual"` — boolean.
- `"classes": ["wizard", "sorcerer"]` — an empty array means available to all classes
  (safe default for incomplete data).
- `"description"` — short plain-text summary.
- `"action"` (optional) — combat mechanics that make a spell actionable. When present and
  `type` is not `"none"`, the chosen spell renders as a computed card in the Attacks panel.
  - `"type": "attack" | "save" | "heal" | "auto" | "none"`.
  - `"damage"` — base dice (e.g. `"8d6"`); `"damageType"` — e.g. `"fire"`.
  - `"save"` — ability for save spells (e.g. `"dex"`).
  - `"auto"` — automatic damage with no attack roll or save (e.g. Magic Missile). Deals
    `"instances"` × `"damage"`, each with an optional flat `"instanceBonus"`; upcast adds
    `"higherLevelInstances"` per slot above base. Magic Missile = `instances:3, damage:"1d4",
    instanceBonus:1, higherLevelInstances:1` → `3d4+3`, `5d4+5` at level 3. Renders in the
    standard attack card with the "to hit" box reading **Auto**.
  - `"instances"` / `"higherLevelInstances"` on a `type:"attack"` spell make it a **multi-attack**
    (one roll per ray/dart), rendered per-beam like Eldritch Blast — shared to-hit, `Damage (×N)`,
    and a "roll a separate attack for each" note. Scorching Ray = `instances:3,
    higherLevelInstances:1, damage:"2d6"`.
  - `"addSpellMod"` — add the caster's spell mod to damage/healing (e.g. Cure Wounds).
  - `"cantripScaling": "dice" | "beams"` — cantrips only; scales at character level 5/11/17.
  - `"higherLevel"` — leveled spells only; dice added **per slot level above base** when upcast
    (e.g. Fireball `"1d6"`, Cure Wounds `"1d8"`). The Attacks card shows a slot selector and
    recomputes damage; warlocks default to their pact slot. Same-die scaling merges counts
    (`8d6` → `10d6`); mixed dice append a term.
  - `"higherLevelNote"` — leveled spells only; free-text for non-dice upcasting (extra targets,
    etc.) that the auto-math can't express; shown in the card's effects.
  - Spells with no `action` (or `type: "none"`) stay reference-only in the Spellbook.

## Mechanic expandability principle

- Adding a new class = write JSON only, no app code changes, as long as the `displayType` and
  `spellcastingType` already exist.
- A new `displayType` or `spellcastingType` = one new app component/table, then reusable by any class.
- The warlock familiar tracker is class-specific; custom freeform trackers are deferred until a
  concrete second use case.

## Scope

- Targeting levels 1–12 primarily.
- Multiclassing UI not at launch, but the schema supports it from day one.
