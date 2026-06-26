# D&D 5e Tracker — outstanding work

Architecture decisions are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); code layout
in [docs/CODEMAP.md](docs/CODEMAP.md). Each item below is a self-contained session.

## Current state vs. target

Items 1–5 are done. **Remaining gaps vs ARCHITECTURE.md:**

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

## 6. User content loading UI
Build the interface for users to add their own content:
- File picker + paste textarea per content type
- Validate incoming JSON against the type's expected schema (basic check: array of objects with `id` and `name`)
- Store in IndexedDB under a key per type
- Merge with SRD content at load time (user IDs override SRD IDs)
- Show loaded user files with option to remove

## 5c. Retire legacy Eldritch Blast attack path ✅ done
The `+ Eldritch Blast` button and `addEldritchBlast` were removed; the spellbook is now the single
source (Eldritch Blast is a normal spell with an `action` block). `computeAttack`'s `eldritchBlast`
branch is retained because `spellToAttack` reuses it for the spell-driven beam/invocation math. The
load migration converts any stored `eldritchBlast` attack row into a `spells` entry.

## 5b. Warlock Mystic Arcanum
At level 11+ warlocks gain once-per-long-rest castings of 6th–9th-level spells (one spell per tier, gained at levels 11/13/15/17) that don't use spell slots. The spellbook's pool filter caps at the highest slot level (`max > 0`), so Mystic Arcanum spells would be invisible. Model as a set of per-spell `toggle` resources keyed by level (e.g. `arcanum-6`, `arcanum-7`) rather than slots — closest to the existing class-resource `toggle` displayType. Separate from item 5 to keep scope bounded.

## 7. Mobile UI audit
Run the app on a real mobile viewport (or DevTools). Fix layout issues: tap targets too small, horizontal overflow, inputs hard to use on touch. The existing CSS was not designed for mobile.

## 8. Deploy to static host
Set up continuous deployment from `main` to Netlify (or Vercel/GitHub Pages). Add a `build` step and configure the publish directory (`dist/`). Test that content JSON files are served correctly.
