# Architecture

Locked architectural decisions for the D&D 5e tracker. These were agreed before scaffolding to
prevent drift — **check this before adding new content types, class features, or character state
fields.**

> This describes the **target** design. Not all of it is implemented yet — see [TODO.md](../TODO.md)
> for what is real today vs. still aspirational.

## Stack

Vite + React (plain JSX, no TypeScript). Deployed as a static site (Netlify/Vercel/GitHub Pages).
No backend. User content stored in IndexedDB.

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
  - `"type": "attack" | "save" | "heal" | "none"`.
  - `"damage"` — base dice (e.g. `"8d6"`); `"damageType"` — e.g. `"fire"`.
  - `"save"` — ability for save spells (e.g. `"dex"`).
  - `"addSpellMod"` — add the caster's spell mod to damage/healing (e.g. Cure Wounds).
  - `"cantripScaling": "dice" | "beams"` — cantrips only; scales at character level 5/11/17.
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
