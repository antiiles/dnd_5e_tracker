// Content loading: fetch JSON from public/content/<type>/ and adapt into the
// constant shapes the UI consumes. Reads BASE_URL so it resolves at the deploy subpath.
import { getUserFiles } from "./userContent.js";
import {
  adaptRaces,
  adaptClasses,
  adaptSkills,
  adaptFeats,
  adaptWeapons,
  adaptSpells,
  MECHANIC_ADAPTERS,
} from "./adapters.js";

// Fetch one content type's files from public/content/<type>/, merging by id
// in index order (later files — user overrides — win on collision).
export async function loadContentType(type) {
  const base = `${import.meta.env.BASE_URL}content/${type}`;
  const files = await fetch(`${base}/index.json`).then((r) => r.json());
  const arrays = await Promise.all(files.map((f) => fetch(`${base}/${f}`).then((r) => r.json())));
  const userFiles = await getUserFiles(type);
  const byId = new Map();
  arrays.forEach((arr) => arr.forEach((item) => byId.set(item.id, item)));
  // User content is applied last, so a homebrew id overrides the SRD id.
  userFiles.forEach((f) => (f.items || []).forEach((item) => byId.set(item.id, item)));
  return [...byId.values()];
}

// Load every content type and adapt into the constant shapes used in render.
export async function loadContent() {
  const [races, classes, skills, feats, weapons, spells] = await Promise.all(
    ["races", "classes", "skills", "feats", "weapons", "spells"].map(loadContentType)
  );

  // Only fetch mechanic folders declared by at least one class
  const neededMechanics = [...new Set(classes.flatMap((c) => c.mechanics || []))];
  const mechanicData = Object.fromEntries(
    await Promise.all(
      neededMechanics.map(async (type) => [type, await loadContentType(type)])
    )
  );

  return {
    RACES: adaptRaces(races),
    CLASSES: adaptClasses(classes),
    SKILLS: adaptSkills(skills),
    FEATS: adaptFeats(feats),
    WEAPONS: adaptWeapons(weapons),
    SPELLS: adaptSpells(spells),
    INVOCATIONS: MECHANIC_ADAPTERS.invocations(mechanicData.invocations || []),
    PATRONS: MECHANIC_ADAPTERS.patrons(mechanicData.patrons || []),
    PACTS: MECHANIC_ADAPTERS.pacts(mechanicData.pacts || []),
  };
}
