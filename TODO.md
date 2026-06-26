# D&D 5e Tracker — outstanding work

Architecture decisions are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); code layout
in [docs/CODEMAP.md](docs/CODEMAP.md). Each item below is a self-contained session.

## Current state vs. target

Item 1 is done: content loads from JSON. **But the rest of the app is still the pre-JSON shape**, so
don't assume ARCHITECTURE.md reflects the running code yet:

- **Character schema is still legacy** (`cls` + `level`, `hitDice: { cur, max, die }`, no
  `concentration`). The target `classes: [{ id, level }]` array and friends are item 2.
- **Adapters flatten content to legacy shapes.** `adaptClasses` only extracts `hitDie`, `saves`,
  `spellAbility`, `caster`, `features` — it drops `resources`, `mechanics`, and `subclasses` from the
  JSON. Those fields exist in the data but aren't consumed yet (items 3–5).
- Content is keyed by `name` in the adapted maps even though files are keyed by `id`.

---

## 1. Wire content loading from JSON ✅ done
Replace all hardcoded constants in `src/App.jsx` (`RACES`, `CLASSES`, `SKILLS`, `FEATS`, `WEAPONS`, `INVOCATIONS`, `PATRONS`, `PACTS`) with `fetch()` calls to `public/content/` using the `index.json` manifests. App should load each type's files on startup and merge them in ID order (SRD first, user overrides win on collision).

## 2. Update character schema
Migrate character state in `makeCharacter()` and `hydrateCharacter()` to the agreed shape:
- `cls` + `level` → `classes: [{ id, level }]` (array from day one for future multiclass)
- Add `concentration: { spellId, spellName } | null`
- Ensure `hitDice` uses `{ total, remaining, dieType }` (already partially there, verify shape)
- Update all read sites in the component accordingly

## 3. Dynamic resource tracking UI
Read the `resources` array from the loaded class data and render the right component per `displayType`:
- `counter` — current / max with +/− buttons
- `pips` — row of checkboxes
- `toggle` — single used/available button
Replace any hardcoded class-specific resource UI (warlock slots aside — that's spellcasting).

## 4. Class mechanics dynamic loading
Read the `mechanics` array from the active class (`["invocations", "patrons", "pacts"]` etc.) and conditionally fetch and display the matching content sections. Sections that aren't in the class's `mechanics` list should not appear.

## 5. Spell system
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

## 7. Mobile UI audit
Run the app on a real mobile viewport (or DevTools). Fix layout issues: tap targets too small, horizontal overflow, inputs hard to use on touch. The existing CSS was not designed for mobile.

## 8. Deploy to static host
Set up continuous deployment from `main` to Netlify (or Vercel/GitHub Pages). Add a `build` step and configure the publish directory (`dist/`). Test that content JSON files are served correctly.
