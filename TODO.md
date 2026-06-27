# D&D 5e Tracker — outstanding work

Architecture decisions are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); code layout
in [docs/CODEMAP.md](docs/CODEMAP.md). Each item below is a self-contained session.

## Current state vs. target

Items 1–6 are done. **Remaining gaps vs ARCHITECTURE.md:**

- **Adapters still partially flatten content.** `adaptClasses` drops `subclasses` — deferred (no subclass UI yet).
- Classes are now keyed by `id` in the adapted map (matching the JSON files). Races/feats/etc. are
  still keyed by `name` (no change needed yet).
- Warlock Mystic Arcanum (levels 11+) not yet modelled — see item 5b.

---

## 1. Wire content loading from JSON ✅ done
Replace all hardcoded constants in `src/App.jsx` (`RACES`, `CLASSES`, `SKILLS`, `FEATS`, `WEAPONS`, `INVOCATIONS`, `PATRONS`, `PACTS`) with `fetch()` calls to `public/content/` using the `index.json` manifests. App should load each type's files on startup and merge them in ID order (SRD first, user overrides win on collision).

## 2. Update character schema ✅ done
Migrate character state in `makeCharacter()` and `hydrateCharacter()` to the agreed shape:
- `cls` + `level` → `classes: [{ id, level }]` (array from day one for future multiclass)
- Add `concentration: { spellId, spellName } | null`
- Ensure `hitDice` uses `{ total, remaining, dieType }` (already partially there, verify shape)
- Update all read sites in the component accordingly

## 3. Dynamic resource tracking UI ✅ done
Read the `resources` array from the loaded class data and render the right component per `displayType`:
- `counter` — current / max with +/− buttons
- `pips` — row of checkboxes
- `toggle` — single used/available button
Replace any hardcoded class-specific resource UI (warlock slots aside — that's spellcasting).

## 4. Class mechanics dynamic loading ✅ done
Read the `mechanics` array from the active class (`["invocations", "patrons", "pacts"]` etc.) and conditionally fetch and display the matching content sections. Sections that aren't in the class's `mechanics` list should not appear.

## 5. Spell system ✅ done
- Drive spell slot display from class `spellcasting.type` (`full` / `half` / `warlock` / `third`) using the slot tables already in the app
- Support `learningType: "prepare" | "known"` — prepared casters get a daily prep UI, known casters get a fixed known list
- When spells content is populated, filter the available list by `classes` field (`[]` = all classes)

## 6. User content loading UI ✅ done
Built the "Content" modal (header button) for users to add their own content:
- File picker + paste textarea, with a content-type selector covering all 9 folders.
- `validateUserContent` checks for a non-empty array of objects each with a string `id` + `name`.
- Stored in IndexedDB (db `dnd-content`, store `userContent`, one record per type holding named files)
  via `getUserFiles`/`putUserFile`/`deleteUserFile`.
- `loadContentType` merges user files after SRD, so a homebrew `id` overrides the SRD `id`; adding or
  removing a file calls `reloadContent()` to re-run `loadContent()`.
- Loaded files are listed per type with a remove (✕) button.

## 5c. Retire legacy Eldritch Blast attack path ✅ done
The `+ Eldritch Blast` button and `addEldritchBlast` were removed; the spellbook is now the single
source (Eldritch Blast is a normal spell with an `action` block). `computeAttack`'s `eldritchBlast`
branch is retained because `spellToAttack` reuses it for the spell-driven beam/invocation math. The
load migration converts any stored `eldritchBlast` attack row into a `spells` entry.

## 5b. Warlock Mystic Arcanum
At level 11+ warlocks gain once-per-long-rest castings of 6th–9th-level spells (one spell per tier, gained at levels 11/13/15/17) that don't use spell slots. The spellbook's pool filter caps at the highest slot level (`max > 0`), so Mystic Arcanum spells would be invisible. Model as a set of per-spell `toggle` resources keyed by level (e.g. `arcanum-6`, `arcanum-7`) rather than slots — closest to the existing class-resource `toggle` displayType. Separate from item 5 to keep scope bounded.

## 5d. Leveled-spell upcasting ✅ done
Cantrip scaling (by character level, at 5/11/17) was already done; this added **upcasting** of *leveled*
spells (Fireball in a 5th-level slot = 10d6, etc.).
- Spell `action` gained `higherLevel` (dice per slot above base) + `higherLevelNote` (free-text for
  target/other scaling the math can't express). Adapter passes `action` through verbatim — JSON-only.
- `addDicePerLevel` helper + a `castLevel` param threaded through `spellToAttack`/`computeSpellCard`.
- The derived Attacks card shows a "Cast at slot" selector (levels ≥ base with `max > 0`); the choice
  is ephemeral (`castLevels` state, not persisted). Warlocks default to their pact slot.
- Per-level *flat dice* scaling via `higherLevel`. Target/instance-count scaling is handled by the
  `auto` action type (`higherLevelInstances`) for no-roll spells like Magic Missile (3d4+3 →
  5d4+5 at level 3). Per-ray *attack-roll* scaling (Scorching Ray) is still note/description only.
- Seeded `higherLevel` on the flat-scaling SRD damage/heal spells (Fireball, Cure Wounds, Burning
  Hands, Thunderwave, Shatter, Moonbeam, Lightning Bolt, Spirit Guardians, Healing/Mass Healing Word,
  Flame Strike).

## 7. Mobile UI audit
Run the app on a real mobile viewport (or DevTools). Fix layout issues: tap targets too small, horizontal overflow, inputs hard to use on touch. The existing CSS was not designed for mobile.

## 8. Deploy to static host
Set up continuous deployment from `main` to Netlify (or Vercel/GitHub Pages). Add a `build` step and configure the publish directory (`dist/`). Test that content JSON files are served correctly.
