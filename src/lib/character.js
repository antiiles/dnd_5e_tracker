// Character model: construction, normalization, hydration/migration, import parsing. Pure.
import { ABILITIES, SPELL_LEVELS } from "./constants.js";
import { uid, num } from "./helpers.js";

export function makeCharacter(name = "New Adventurer") {
  const abilities = {};
  ABILITIES.forEach(([k]) => (abilities[k] = 10));
  const savingProfs = {};
  ABILITIES.forEach(([k]) => (savingProfs[k] = false));
  const skillProfs = {}; // keyed by skill id as the user toggles proficiency
  const spellSlots = {};
  SPELL_LEVELS.forEach((l) => (spellSlots[l] = { cur: 0, max: 0 }));
  return {
    id: uid(),
    name,
    classes: [{ id: "", level: 1 }],
    race: "",
    subrace: "",
    background: "",
    alignment: "",
    xp: 0,
    inspiration: false,
    abilities,
    savingProfs,
    skillProfs,
    ac: 10,
    speed: 30,
    initMisc: 0,
    hp: { current: 10, max: 10, temp: 0 },
    hitDice: { total: 1, remaining: 1, dieType: 8 },
    concentration: null,
    deathSaves: { s: 0, f: 0 },
    spellAbility: "",
    spellSlots,
    patron: "",
    pact: "",
    attacks: [],
    feats: [],
    invocations: [],
    familiar: { enabled: false, name: "", form: "", ac: 12, hp: { current: 1, max: 1, temp: 0 }, speed: "", notes: "", attacks: [] },
    resources: {},
    spells: [],
    preparedSpells: [],
    features: "",
    equipment: "",
    bio: "",
  };
}

// Bring any attack (including legacy {name,bonus,dmg}) into the structured shape.
export function normalizeAttack(a) {
  if (!a || typeof a !== "object") return null;
  if (a.kind) return a;
  return { id: a.id || uid(), kind: "manual", name: a.name || "", toHit: a.bonus || "", damage: a.dmg || "", effect: a.notes || "" };
}

// Merge an imported/raw character onto current defaults so no field is missing.
export function hydrateCharacter(raw) {
  if (!raw || typeof raw !== "object") return null;
  const base = makeCharacter(raw.name || "Imported");
  const c = { ...base, ...raw, id: uid() };
  c.abilities = { ...base.abilities, ...(raw.abilities || {}) };
  c.savingProfs = { ...base.savingProfs, ...(raw.savingProfs || {}) };
  c.skillProfs = { ...base.skillProfs, ...(raw.skillProfs || {}) };
  c.spellSlots = { ...base.spellSlots, ...(raw.spellSlots || {}) };
  c.hp = { ...base.hp, ...(raw.hp || {}) };
  // migrate legacy cls/level → classes array
  if (!Array.isArray(c.classes) || c.classes.length === 0) {
    c.classes = raw.cls ? [{ id: raw.cls.toLowerCase(), level: num(raw.level, 1) }] : base.classes;
  }
  // migrate legacy hitDice {cur,max,die} → {total,remaining,dieType}
  if (raw.hitDice && ("cur" in raw.hitDice || "max" in raw.hitDice)) {
    const dieType = parseInt(String(raw.hitDice.die || "d8").replace(/[^0-9]/g, ""), 10) || 8;
    c.hitDice = { total: num(raw.hitDice.max, 1), remaining: num(raw.hitDice.cur, 1), dieType };
  } else {
    c.hitDice = { ...base.hitDice, ...(raw.hitDice || {}) };
  }
  if (c.concentration === undefined) c.concentration = null;
  c.resources = (raw.resources && typeof raw.resources === "object" && !Array.isArray(raw.resources)) ? { ...raw.resources } : {};
  c.deathSaves = { ...base.deathSaves, ...(raw.deathSaves || {}) };
  c.attacks = (Array.isArray(raw.attacks) ? raw.attacks : []).map(normalizeAttack).filter(Boolean);
  c.feats = Array.isArray(raw.feats) ? raw.feats : [];
  c.invocations = Array.isArray(raw.invocations) ? raw.invocations : [];
  c.spells = Array.isArray(raw.spells) ? raw.spells : [];
  c.preparedSpells = Array.isArray(raw.preparedSpells) ? raw.preparedSpells : [];
  c.familiar = { ...base.familiar, ...(raw.familiar || {}) };
  c.familiar.hp = { ...base.familiar.hp, ...((raw.familiar && raw.familiar.hp) || {}) };
  c.familiar.attacks = Array.isArray(raw.familiar && raw.familiar.attacks) ? raw.familiar.attacks : [];
  return c;
}

// Pull an array of characters out of any supported export shape.
export function charactersFromImport(data) {
  let arr = null;
  if (Array.isArray(data)) arr = data;
  else if (data && Array.isArray(data.characters)) arr = data.characters;
  else if (data && data.abilities) arr = [data];
  if (!arr) return [];
  return arr.map(hydrateCharacter).filter(Boolean);
}
