import React, { useState, useEffect } from "react";

// ───────────────────────── Reference data ─────────────────────────
const ABILITIES = [
  ["str", "Strength", "STR"],
  ["dex", "Dexterity", "DEX"],
  ["con", "Constitution", "CON"],
  ["int", "Intelligence", "INT"],
  ["wis", "Wisdom", "WIS"],
  ["cha", "Charisma", "CHA"],
];

const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// ───────────────────────── Helpers ─────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v, d = 0) => {
  if (v === "" || v === null || v === undefined) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const abilityMod = (score) => Math.floor((num(score, 10) - 10) / 2);
const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);
const profBonus = (level) => Math.ceil(num(level, 1) / 4) + 1; // 1–4:+2, 5–8:+3 ... 17–20:+6

// Content types a user can extend, with display labels (for the homebrew UI).
const CONTENT_TYPES = [
  ["races", "Races"],
  ["classes", "Classes"],
  ["skills", "Skills"],
  ["feats", "Feats"],
  ["weapons", "Weapons"],
  ["spells", "Spells"],
  ["invocations", "Invocations"],
  ["patrons", "Patrons"],
  ["pacts", "Pacts"],
];

// ───────────────────────── User content (IndexedDB) ─────────────────────────
// Homebrew lives in IndexedDB (db "dnd-content", store "userContent"), one record
// per content type: { type, files: [{ name, addedAt, items: [...] }] }. It's merged
// after SRD at load time, so a user id overrides the matching SRD id.
const IDB_NAME = "dnd-content";
const IDB_STORE = "userContent";

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: "type" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const idbReq = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// All user files for one type ([] when none, or IndexedDB is unavailable).
async function getUserFiles(type) {
  try {
    const db = await idbOpen();
    const rec = await idbReq(db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(type));
    db.close();
    return rec && Array.isArray(rec.files) ? rec.files : [];
  } catch (e) {
    return [];
  }
}

// Add or replace (by name) one user file under a type. Read and write use separate
// transactions so we never touch a transaction that has gone inactive across an await.
async function putUserFile(type, name, items) {
  const files = (await getUserFiles(type)).filter((f) => f.name !== name);
  files.push({ name, addedAt: Date.now(), items });
  const db = await idbOpen();
  await idbReq(db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put({ type, files }));
  db.close();
}

// Remove one user file (by name) from a type.
async function deleteUserFile(type, name) {
  const files = (await getUserFiles(type)).filter((f) => f.name !== name);
  const db = await idbOpen();
  await idbReq(db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put({ type, files }));
  db.close();
}

// Basic schema check: a non-empty array of objects, each with a string id + name.
function validateUserContent(parsed) {
  if (!Array.isArray(parsed)) return { ok: false, error: "Expected a JSON array of entries." };
  if (parsed.length === 0) return { ok: false, error: "That array is empty." };
  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item))
      return { ok: false, error: "Every entry must be an object." };
    if (typeof item.id !== "string" || !item.id.trim())
      return { ok: false, error: 'Every entry needs a non-empty "id".' };
    if (typeof item.name !== "string" || !item.name.trim())
      return { ok: false, error: 'Every entry needs a non-empty "name".' };
  }
  return { ok: true, count: parsed.length };
}

// ───────────────────────── Content loading ─────────────────────────
// Fetch one content type's files from public/content/<type>/, merging by id
// in index order (later files — user overrides — win on collision).
async function loadContentType(type) {
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

// Adapters: normalize loaded JSON into the shapes the component already consumes.
const adaptRaces = (rows) =>
  Object.fromEntries(
    rows.map((r) => [
      r.name,
      {
        asi: r.abilityBonuses || {},
        speed: r.speed,
        size: r.size,
        traits: (r.traits || []).map((t) => [t.name, t.description]),
        subraces: Object.fromEntries(
          (r.subraces || []).map((s) => {
            const sub = { asi: s.abilityBonuses || {}, traits: (s.traits || []).map((t) => [t.name, t.description]) };
            if (s.speed != null) sub.speed = s.speed;
            return [s.name, sub];
          })
        ),
      },
    ])
  );

const adaptClasses = (rows) =>
  Object.fromEntries(
    rows.map((c) => [
      c.id,
      {
        name: c.name,
        hitDie: c.hitDie,
        saves: c.savingThrows || [],
        spellAbility: (c.spellcasting && c.spellcasting.ability) || "",
        caster: (c.spellcasting && c.spellcasting.type) || null,
        learning: (c.spellcasting && c.spellcasting.learningType) || null,
        features: (c.features || []).map((f) => ({ level: f.level, name: f.name, desc: f.description })),
        resources: c.resources || [],
        mechanics: c.mechanics || [],
      },
    ])
  );

const adaptSkills = (rows) => rows.map((s) => [s.id, s.name, s.ability]);
const adaptFeats = (rows) => Object.fromEntries(rows.map((f) => [f.name, f.description]));
const adaptWeapons = (rows) =>
  rows.map((w) => ({ name: w.name, dice: w.damage, type: w.damageType, versatile: w.versatileDamage, props: w.properties || [] }));
const adaptInvocations = (rows) =>
  rows.map((i) => ({ name: i.name, level: i.prerequisiteLevel, prereq: i.prerequisite || "", desc: i.description }));
const adaptPatrons = (rows) => Object.fromEntries(rows.map((p) => [p.name, p.description]));
const adaptPacts = (rows) => Object.fromEntries(rows.map((p) => [p.name, p.description]));
const adaptSpells = (rows) =>
  rows.map((s) => ({
    id: s.id,
    name: s.name,
    level: s.level ?? 0,
    school: s.school || "",
    castingTime: s.castingTime || "",
    range: s.range || "",
    duration: s.duration || "",
    concentration: !!s.concentration,
    ritual: !!s.ritual,
    classes: Array.isArray(s.classes) ? s.classes : [],
    description: s.description || "",
    action: s.action || null,
  }));

const MECHANIC_ADAPTERS = {
  invocations: adaptInvocations,
  patrons: adaptPatrons,
  pacts: adaptPacts,
};

// Load every content type and adapt into the constant shapes used in render.
async function loadContent() {
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

// Spell slot progressions (index by character level → [1st..9th])
const FULL_SLOTS = {
  1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1],
  8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1], 19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};
const HALF_SLOTS = {
  2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3], 9: [4, 3, 2], 10: [4, 3, 2],
  11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1], 14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2],
  17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
};
// Warlock pact magic: [slotLevel, count]
const WARLOCK_SLOTS = {
  1: [1, 1], 2: [1, 2], 3: [2, 2], 4: [2, 2], 5: [3, 2], 6: [3, 2], 7: [4, 2], 8: [4, 2],
  9: [5, 2], 10: [5, 2], 11: [5, 3], 12: [5, 3], 13: [5, 3], 14: [5, 3], 15: [5, 3], 16: [5, 3],
  17: [5, 4], 18: [5, 4], 19: [5, 4], 20: [5, 4],
};
// Third-caster (Eldritch Knight / Arcane Trickster subclasses); slots start at class level 3
const THIRD_SLOTS = {
  3: [2], 4: [3], 5: [3], 6: [3], 7: [4, 2], 8: [4, 2], 9: [4, 2],
  10: [4, 3], 11: [4, 3], 12: [4, 3], 13: [4, 3, 2], 14: [4, 3, 2],
  15: [4, 3, 2], 16: [4, 3, 3], 17: [4, 3, 3], 18: [4, 3, 3],
  19: [4, 3, 3, 1], 20: [4, 3, 3, 1],
};

// How many Eldritch Invocations a warlock knows at each level
const WARLOCK_INV_KNOWN = {
  1: 0, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5,
  11: 5, 12: 6, 13: 6, 14: 6, 15: 7, 16: 7, 17: 7, 18: 8, 19: 8, 20: 8,
};

const isPactPrereq = (p) => typeof p === "string" && p.startsWith("Pact of");

// Pact of the Chain familiar forms (standard stat blocks; values are editable).
const FAMILIAR_FORMS = {
  Imp: {
    ac: 13, hp: 10, speed: "20 ft, fly 40 ft",
    attacks: [{ name: "Sting", toHit: 5, dice: "1d4", bonusDmg: 3, damageType: "piercing", hasSave: true, saveAbility: "con", fixedDC: 11, effect: "On a failed save, 3d6 poison damage (half on success)." }],
  },
  Pseudodragon: {
    ac: 13, hp: 7, speed: "15 ft, fly 60 ft",
    attacks: [
      { name: "Bite", toHit: 4, dice: "1d4", bonusDmg: 2, damageType: "piercing" },
      { name: "Sting", toHit: 4, dice: "1d4", bonusDmg: 2, damageType: "piercing", hasSave: true, saveAbility: "con", fixedDC: 11, effect: "On a fail, poisoned 1 hour; if it fails by 5+, unconscious for the same time." },
    ],
  },
  Quasit: {
    ac: 13, hp: 7, speed: "40 ft",
    attacks: [{ name: "Claws", toHit: 4, dice: "1d4", bonusDmg: 3, damageType: "slashing", hasSave: true, saveAbility: "con", fixedDC: 10, effect: "On a fail, 2d4 poison damage and poisoned for 1 minute." }],
  },
  Sprite: {
    ac: 15, hp: 2, speed: "10 ft, fly 40 ft",
    attacks: [
      { name: "Shortsword", toHit: 2, dice: "1", bonusDmg: 0, damageType: "slashing" },
      { name: "Longbow", toHit: 6, dice: "1", bonusDmg: 0, damageType: "piercing", hasSave: true, saveAbility: "con", fixedDC: 10, effect: "On a fail, poisoned 1 minute; if it fails by 5+, unconscious until it takes damage." },
    ],
  },
  Custom: { ac: 12, hp: 1, speed: "", attacks: [] },
};

function emptySlots() {
  const s = {};
  SPELL_LEVELS.forEach((l) => (s[l] = { cur: 0, max: 0 }));
  return s;
}
// Build a fresh slot object for a class + level, fully rested
function slotsFor(caster, level) {
  const s = emptySlots();
  const lv = Math.max(1, Math.min(20, num(level, 1)));
  if (caster === "full" || caster === "half" || caster === "third") {
    const table = caster === "full" ? FULL_SLOTS : caster === "half" ? HALF_SLOTS : THIRD_SLOTS;
    const row = table[lv] || [];
    row.forEach((n, i) => (s[i + 1] = { cur: n, max: n }));
  } else if (caster === "warlock") {
    const [slvl, count] = WARLOCK_SLOTS[lv] || [0, 0];
    if (slvl) s[slvl] = { cur: count, max: count };
  }
  return s;
}
function makeCharacter(name = "New Adventurer") {
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
function normalizeAttack(a) {
  if (!a || typeof a !== "object") return null;
  if (a.kind) return a;
  return { id: a.id || uid(), kind: "manual", name: a.name || "", toHit: a.bonus || "", damage: a.dmg || "", effect: a.notes || "" };
}

// Merge an imported/raw character onto current defaults so no field is missing.
function hydrateCharacter(raw) {
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
function charactersFromImport(data) {
  let arr = null;
  if (Array.isArray(data)) arr = data;
  else if (data && Array.isArray(data.characters)) arr = data.characters;
  else if (data && data.abilities) arr = [data];
  if (!arr) return [];
  return arr.map(hydrateCharacter).filter(Boolean);
}

// ───────────────────────── Theme ─────────────────────────
const T = {
  ink: "#14121C",
  ink2: "#0E0C14",
  panel: "#201B2E",
  panel2: "#2A2440",
  line: "#3A3354",
  lineSoft: "#2E2842",
  gold: "#D8B45A",
  goldDim: "#8C7434",
  violet: "#9A7BE0",
  violetDim: "#5E4A99",
  crimson: "#CF5450",
  green: "#74B36F",
  text: "#ECE6D8",
  dim: "#A89FB8",
  faint: "#766E8A",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap');

.ds-root *{box-sizing:border-box;}
.ds-root{
  font-family:'Spectral',Georgia,serif;
  color:${T.text};
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(154,123,224,0.10), transparent 60%),
    radial-gradient(900px 500px at -10% 110%, rgba(216,180,90,0.07), transparent 55%),
    ${T.ink};
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
}
.ds-wrap{max-width:1080px;margin:0 auto;padding:0 14px 96px;}

/* top bar */
.ds-top{
  position:sticky;top:0;z-index:20;
  background:linear-gradient(${T.ink2}, ${T.ink2}f2);
  border-bottom:1px solid ${T.line};
  backdrop-filter:blur(6px);
}
.ds-top-inner{max-width:1080px;margin:0 auto;padding:10px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.ds-brand{font-family:'Cinzel',serif;font-weight:700;letter-spacing:2px;color:${T.gold};font-size:18px;line-height:1;}
.ds-brand small{display:block;font-family:'Spectral',serif;font-weight:400;letter-spacing:3px;
  color:${T.faint};font-size:9px;text-transform:uppercase;margin-top:3px;}
.ds-spacer{flex:1;}

.ds-select, .ds-input, .ds-textarea{
  font-family:'Spectral',serif;color:${T.text};background:${T.panel};
  border:1px solid ${T.line};border-radius:8px;padding:8px 10px;font-size:15px;outline:none;
}
.ds-select{min-width:150px;}
.ds-input:focus,.ds-textarea:focus,.ds-select:focus{border-color:${T.gold};box-shadow:0 0 0 2px rgba(216,180,90,0.25);}
.ds-input::placeholder,.ds-textarea::placeholder{color:${T.faint};}

.ds-btn{
  font-family:'Cinzel',serif;font-size:12px;letter-spacing:1px;cursor:pointer;
  background:${T.panel};color:${T.text};border:1px solid ${T.line};
  border-radius:8px;padding:8px 12px;transition:border-color .15s,background .15s;
}
.ds-btn:hover{border-color:${T.gold};}
.ds-btn-gold{background:linear-gradient(${T.goldDim},#6f5a26);border-color:${T.gold};color:#1a160c;font-weight:600;}
.ds-btn-ghost{background:transparent;}
.ds-btn-danger:hover{border-color:${T.crimson};color:${T.crimson};}
.ds-icon-btn{cursor:pointer;background:transparent;border:1px solid transparent;color:${T.faint};
  border-radius:6px;padding:4px 7px;font-size:14px;line-height:1;}
.ds-icon-btn:hover{color:${T.crimson};border-color:${T.lineSoft};}

/* tabs */
.ds-tabs{position:sticky;top:53px;z-index:15;display:flex;gap:6px;overflow-x:auto;
  background:${T.ink}; padding:10px 0 8px; border-bottom:1px solid ${T.lineSoft};}
.ds-tab{flex:0 0 auto;font-family:'Cinzel',serif;letter-spacing:1px;font-size:12px;cursor:pointer;
  background:transparent;border:1px solid ${T.lineSoft};color:${T.dim};
  border-radius:999px;padding:7px 16px;transition:all .15s;}
.ds-tab:hover{color:${T.text};}
.ds-tab[data-on="1"]{color:${T.gold};border-color:${T.gold};background:rgba(216,180,90,0.08);}

/* layout */
.ds-grid{display:grid;gap:14px;margin-top:16px;}
.ds-panel{background:linear-gradient(${T.panel}, ${T.panel}e8);border:1px solid ${T.line};
  border-radius:14px;padding:16px;}
.ds-panel-title{font-family:'Cinzel',serif;letter-spacing:2px;font-size:12px;text-transform:uppercase;
  color:${T.gold};margin:0 0 12px;display:flex;align-items:center;gap:8px;}
.ds-panel-title::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,${T.goldDim},transparent);}

/* identity header */
.ds-id-name{font-family:'Cinzel',serif;font-weight:700;font-size:26px;color:${T.text};
  background:transparent;border:none;border-bottom:1px solid ${T.lineSoft};width:100%;padding:2px 0 6px;outline:none;}
.ds-id-name:focus{border-color:${T.gold};}
.ds-id-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:14px;}
.ds-field label{display:block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${T.faint};margin-bottom:3px;}
.ds-field .ds-input{width:100%;padding:6px 9px;font-size:14px;}

/* stat tiles row */
.ds-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:10px;}
.ds-stat{background:${T.ink2};border:1px solid ${T.line};border-radius:12px;padding:10px 6px;text-align:center;}
.ds-stat .lab{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${T.faint};}
.ds-stat .big{font-family:'Cinzel',serif;font-size:26px;color:${T.gold};line-height:1.1;margin-top:4px;}
.ds-stat .ds-input{width:100%;text-align:center;background:transparent;border:none;
  font-family:'Cinzel',serif;font-size:26px;color:${T.gold};padding:2px 0;}
.ds-stat .ds-input:focus{box-shadow:none;}

/* ability runestones */
.ds-abil-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:12px;}
.ds-rune{position:relative;background:
   radial-gradient(120% 90% at 50% 0%, rgba(154,123,224,0.12), transparent 70%), ${T.ink2};
  border:1px solid ${T.line};border-radius:14px;padding:12px 8px 10px;text-align:center;
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 14px rgba(0,0,0,0.35);}
.ds-rune .ab{font-family:'Cinzel',serif;letter-spacing:2px;font-size:11px;color:${T.dim};}
.ds-rune .mod{font-family:'Cinzel',serif;font-size:34px;font-weight:700;color:${T.gold};line-height:1;margin:6px 0 8px;}
.ds-rune .score{display:inline-flex;align-items:center;justify-content:center;gap:4px;}
.ds-rune .score input{width:46px;text-align:center;background:${T.panel};border:1px solid ${T.line};
  border-radius:8px;color:${T.text};font-family:'Spectral',serif;font-size:15px;padding:3px 0;}
.ds-rune .score input:focus{border-color:${T.gold};outline:none;}
.ds-rune .rbonus{font-size:11px;color:${T.violet};background:rgba(154,123,224,0.14);
  border:1px solid ${T.violetDim};border-radius:6px;padding:1px 5px;font-family:'Spectral',serif;}
.ds-rune .total{font-size:10px;color:${T.faint};margin-top:6px;letter-spacing:.5px;text-transform:uppercase;}

/* rows: saves & skills */
.ds-rowlist{display:grid;gap:4px;}
.ds-row{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;}
.ds-row:hover{background:rgba(255,255,255,0.02);}
.ds-row .rname{flex:1;font-size:15px;}
.ds-row .rabb{font-size:10px;color:${T.faint};text-transform:uppercase;letter-spacing:1px;width:30px;}
.ds-row .rbonus{font-family:'Cinzel',serif;font-size:16px;color:${T.text};min-width:34px;text-align:right;}

.ds-pip{width:22px;height:22px;border-radius:6px;border:1px solid ${T.line};cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:11px;color:${T.faint};
  background:${T.ink2};flex:0 0 auto;user-select:none;transition:all .12s;}
.ds-pip[data-s="1"]{border-color:${T.violet};color:${T.violet};background:rgba(154,123,224,0.12);}
.ds-pip[data-s="2"]{border-color:${T.gold};color:${T.gold};background:rgba(216,180,90,0.14);}

/* hp */
.ds-hp-main{display:flex;align-items:flex-end;gap:8px;justify-content:center;}
.ds-hp-main .cur{font-family:'Cinzel',serif;font-size:46px;color:${T.text};line-height:1;}
.ds-hp-main .sep{font-size:26px;color:${T.faint};padding-bottom:4px;}
.ds-hp-main input{width:88px;text-align:center;background:transparent;border:none;
  font-family:'Cinzel',serif;font-size:46px;color:${T.text};}
.ds-hp-main .maxin{width:60px;font-size:26px;color:${T.dim};text-align:left;padding-bottom:2px;}
.ds-hp-main input:focus{outline:none;}
.ds-hp-bar{height:10px;border-radius:6px;background:${T.ink2};border:1px solid ${T.line};margin:12px 0;overflow:hidden;}
.ds-hp-fill{height:100%;background:linear-gradient(90deg,${T.crimson},#e07a5f);transition:width .25s;}
.ds-hp-tools{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap;justify-content:center;}
.ds-hp-tools .ds-input{width:88px;text-align:center;}

.ds-dots{display:flex;gap:6px;}
.ds-dot{width:18px;height:18px;border-radius:50%;border:1px solid ${T.line};cursor:pointer;background:${T.ink2};transition:all .12s;}
.ds-dot[data-on="1"][data-kind="s"]{background:${T.green};border-color:${T.green};}
.ds-dot[data-on="1"][data-kind="f"]{background:${T.crimson};border-color:${T.crimson};}

/* attacks & slots */
.sl-pips{display:flex;flex-wrap:wrap;gap:5px;min-height:18px;}
.ds-sp{width:16px;height:16px;border-radius:50%;border:1px solid ${T.violetDim};cursor:pointer;background:transparent;}
.ds-sp[data-on="1"]{background:${T.violet};border-color:${T.violet};}

.ds-res-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;}
.ds-res-item{background:${T.ink2};border:1px solid ${T.line};border-radius:10px;padding:10px;}
.ds-res-name{font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;color:${T.gold};margin-bottom:8px;}
.ds-res-recharge{font-size:11px;color:${T.faint};margin-top:6px;}
.ds-res-counter{display:flex;align-items:center;gap:8px;}
.ds-res-val{min-width:50px;text-align:center;font-size:18px;font-weight:600;color:${T.text};}
.ds-res-btn{width:28px;height:28px;border-radius:6px;border:1px solid ${T.line};background:${T.panel2};color:${T.text};cursor:pointer;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;}
.ds-res-btn:disabled{opacity:.35;cursor:default;}
.ds-res-toggle{width:100%;padding:7px 0;font-size:13px;}
.ds-res-used{background:${T.panel}!important;color:${T.faint}!important;border-color:${T.line}!important;}
.ds-textarea{width:100%;min-height:150px;resize:vertical;line-height:1.6;font-size:15px;}
.ds-muted{color:${T.dim};font-size:13px;}

/* spellbook */
.ds-sb-section{margin-bottom:14px;}
.ds-sb-lvl-head{font-family:'Cinzel',serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${T.violet};margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid ${T.lineSoft};}
.ds-sb-row{display:flex;align-items:flex-start;gap:9px;padding:6px 4px;border-bottom:1px solid ${T.lineSoft};}
.ds-sb-row.ds-sb-on{background:rgba(154,123,224,0.06);}
.ds-sb-add{flex:0 0 auto;width:26px;height:26px;border-radius:7px;border:1px solid ${T.violetDim};background:transparent;color:${T.violet};cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;}
.ds-sb-add.on{background:${T.violet};border-color:${T.violet};color:${T.ink};}
.ds-sb-body{flex:1 1 auto;cursor:pointer;min-width:0;}
.ds-sb-line{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.ds-sb-name{font-size:14px;font-weight:500;color:${T.text};}
.ds-sb-tags{font-size:10px;color:${T.faint};text-transform:capitalize;}
.ds-sb-summary{font-size:11px;color:${T.violet};margin-left:auto;white-space:nowrap;}
.ds-sb-detail{margin-top:5px;font-size:13px;color:${T.dim};line-height:1.5;}
.ds-sb-detail p{margin:2px 0 0;}
.ds-sb-meta{font-size:11px;color:${T.faint};text-transform:capitalize;}

/* derived spell attacks */
.ds-sub-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${T.gold};margin:14px 0 8px;}
.ds-atk-derived{border-style:dashed;}
.ds-atk-name-static{flex:1 1 auto;font-family:'Cinzel',serif;font-size:15px;color:${T.text};}

/* spellcasting: per-level blocks */
.ds-cast-level{border:1px solid ${T.line};border-radius:10px;padding:9px 11px;margin-bottom:9px;background:${T.ink2};}
.ds-cast-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.ds-cast-head .lv{font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;color:${T.violet};min-width:64px;}
.ds-cast-head .sl-pips{flex:1 1 auto;}
.ds-cast-head .sl-max{display:flex;align-items:center;gap:6px;font-size:12px;color:${T.faint};}
.ds-cast-head .sl-max input{width:46px;text-align:center;background:${T.panel};border:1px solid ${T.line};border-radius:6px;color:${T.text};padding:3px;}
.ds-cast-spells{margin-top:8px;padding-top:8px;border-top:1px solid ${T.lineSoft};display:flex;flex-direction:column;gap:7px;}
.ds-cast-spell{display:flex;flex-direction:column;gap:5px;}
.ds-cast-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
.ds-cast-body{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:9px;flex-wrap:wrap;
  background:transparent;border:none;padding:0;margin:0;cursor:pointer;text-align:left;font:inherit;color:inherit;}
.ds-cast-name{font-size:14px;color:${T.text};}
.ds-cast-summary{font-size:11px;color:${T.violet};}
.ds-cast-tag{font-size:10px;color:${T.gold};border:1px solid ${T.goldDim};border-radius:5px;padding:1px 5px;}
.ds-cast-chev{margin-left:auto;color:${T.faint};font-size:10px;transition:transform .15s;}
.ds-cast-chev.open{transform:rotate(180deg);}
.ds-cast-detail{margin-left:2px;border-left:2px solid ${T.violetDim};padding-left:11px;}
.ds-cast-detail p{margin:3px 0 0;font-size:13px;color:${T.dim};line-height:1.5;}
.ds-prep-toggle{font-size:11px;border:1px solid ${T.violetDim};background:transparent;color:${T.dim};border-radius:6px;padding:2px 9px;cursor:pointer;min-width:74px;}
.ds-prep-toggle.on{background:${T.violet};border-color:${T.violet};color:${T.ink};font-weight:600;}
.ds-panel-toggle{width:100%;background:transparent;border:none;cursor:pointer;}
.ds-fold-chev{display:inline-block;color:${T.violet};font-size:10px;transition:transform .15s;}
.ds-fold-chev.open{transform:rotate(90deg);}
.ds-fold-count{margin-left:6px;font-size:11px;color:${T.violet};font-weight:600;letter-spacing:0;}
.ds-empty{color:${T.faint};font-style:italic;font-size:14px;padding:6px 0;}
.ds-feat{padding:9px 0;border-bottom:1px solid ${T.lineSoft};}
.ds-feat:last-child{border-bottom:none;}
.ds-feat .fn{font-family:'Cinzel',serif;font-size:13px;color:${T.text};letter-spacing:.4px;}
.ds-feat .flv{font-size:10px;color:${T.violet};margin-left:8px;letter-spacing:1px;text-transform:uppercase;}
.ds-feat .fd{font-size:13px;color:${T.dim};margin-top:3px;line-height:1.5;}
.ds-auto-note{font-size:11px;color:${T.faint};font-style:italic;margin:-4px 0 12px;}
.ds-rest-row{display:flex;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid ${T.lineSoft};}
.ds-rest-row .ds-btn{flex:1;padding:11px;}
.ds-feat-add{margin-bottom:12px;}
.ds-feat-add .ds-input{width:100%;}
.ds-feat-item{border:1px solid ${T.lineSoft};border-radius:10px;padding:10px;margin-bottom:10px;background:${T.ink2};}
.ds-feat-head{display:flex;gap:8px;align-items:center;}
.ds-feat-item .fname{flex:1;font-family:'Cinzel',serif;font-size:14px;}
.ds-feat-item .fdesc{width:100%;min-height:64px;margin-top:8px;font-size:14px;}
.ds-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:50;
  background:${T.panel2};border:1px solid ${T.gold};color:${T.text};padding:11px 16px;
  border-radius:10px;font-size:13px;max-width:90%;text-align:center;
  box-shadow:0 8px 24px rgba(0,0,0,0.5);animation:dsfade .2s ease;}
.ds-inv{display:flex;gap:10px;padding:10px;border:1px solid ${T.lineSoft};border-radius:10px;
  margin-bottom:8px;cursor:pointer;background:${T.ink2};transition:border-color .12s,background .12s;}
.ds-inv:hover{border-color:${T.violetDim};}
.ds-inv[data-on="1"]{border-color:${T.violet};background:rgba(154,123,224,0.10);}
.ds-inv-check{flex:0 0 auto;width:22px;height:22px;border-radius:6px;border:1px solid ${T.line};
  display:flex;align-items:center;justify-content:center;color:${T.violet};font-size:13px;}
.ds-inv[data-on="1"] .ds-inv-check{border-color:${T.violet};background:rgba(154,123,224,0.18);}
.ds-inv-name{font-family:'Cinzel',serif;font-size:14px;color:${T.text};
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ds-inv-tag,.ds-inv-lv{font-size:9px;letter-spacing:.5px;text-transform:uppercase;
  border-radius:5px;padding:1px 6px;font-family:'Spectral',serif;}
.ds-inv-tag{color:${T.gold};border:1px solid ${T.goldDim};}
.ds-inv-lv{color:${T.violet};border:1px solid ${T.violetDim};}
.ds-inv-desc{font-size:13px;color:${T.dim};margin-top:4px;line-height:1.5;}
.ds-pp-desc{font-size:13px;color:${T.dim};margin:10px 0 0;line-height:1.5;}
.ds-pp-desc b{color:${T.text};font-family:'Cinzel',serif;font-weight:600;}
.ds-count{font-family:'Cinzel',serif;}
.ds-count[data-over="1"]{color:${T.crimson};}
.ds-modal-bg{position:fixed;inset:0;z-index:60;background:rgba(8,6,12,0.72);
  display:flex;align-items:flex-start;justify-content:center;padding:36px 14px;
  overflow:auto;animation:dsfade .18s ease;}
.ds-modal{background:linear-gradient(${T.panel}, ${T.panel}f0);border:1px solid ${T.line};
  border-radius:16px;padding:20px;max-width:520px;width:100%;
  box-shadow:0 24px 70px rgba(0,0,0,0.6);}
.ds-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.ds-modal-sec{margin-top:16px;padding-top:16px;border-top:1px solid ${T.lineSoft};}
.ds-sec-label{font-family:'Cinzel',serif;letter-spacing:1.5px;font-size:11px;
  text-transform:uppercase;color:${T.gold};margin-bottom:10px;}
.ds-btn-row{display:flex;gap:8px;flex-wrap:wrap;}
.ds-modal label.ds-btn{cursor:pointer;display:inline-block;}
.ds-add-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px;}
.ds-add-row .ds-input{flex:0 0 auto;}
.ds-atk{border:1px solid ${T.line};border-radius:12px;padding:12px;margin-bottom:12px;
  background:linear-gradient(${T.panel}, ${T.panel}e8);}
.ds-atk-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.ds-atk-name{flex:1;font-family:'Cinzel',serif;font-size:15px;}
.ds-atk-kind{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${T.faint};
  border:1px solid ${T.lineSoft};border-radius:5px;padding:2px 6px;}
.ds-atk-result{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;}
@media(max-width:480px){.ds-atk-result{grid-template-columns:1fr;}}
.ds-atk-stat{background:${T.ink2};border:1px solid ${T.line};border-radius:10px;padding:10px;}
.ds-atk-stat .lab{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${T.faint};}
.ds-atk-stat .val{font-family:'Cinzel',serif;font-size:22px;color:${T.gold};margin-top:3px;line-height:1.15;}
.ds-atk-stat .src{font-size:11px;color:${T.dim};margin-top:6px;line-height:1.5;}
.ds-atk-fx{list-style:none;padding:0;margin:0 0 6px;}
.ds-atk-fx li{font-size:12px;color:${T.violet};padding:2px 0 2px 15px;position:relative;line-height:1.45;}
.ds-atk-fx li::before{content:"◆";position:absolute;left:0;color:${T.violetDim};font-size:8px;top:5px;}
.ds-atk-ctl{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;
  border-top:1px solid ${T.lineSoft};padding-top:10px;}
.ds-mini{display:flex;flex-direction:column;gap:3px;}
.ds-mini label{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${T.faint};}
.ds-mini input,.ds-mini select{background:${T.ink2};border:1px solid ${T.line};border-radius:7px;
  color:${T.text};padding:6px 8px;font-family:'Spectral',serif;font-size:14px;}
.ds-mini input{width:62px;text-align:center;}
.ds-mini input:focus,.ds-mini select:focus{border-color:${T.gold};outline:none;}
.ds-chip{cursor:pointer;user-select:none;border:1px solid ${T.line};border-radius:7px;
  padding:8px 11px;font-size:12px;color:${T.dim};background:${T.ink2};align-self:flex-end;}
.ds-chip[data-on="1"]{border-color:${T.gold};color:${T.gold};background:rgba(216,180,90,0.12);}

a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{
  outline:2px solid ${T.gold};outline-offset:2px;}

.ds-fade{animation:dsfade .25s ease;}
@keyframes dsfade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}
@media(prefers-reduced-motion:reduce){.ds-fade{animation:none;}.ds-hp-fill{transition:none;}}

.ds-chk{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font-size:14px;}
.ds-chkbox{width:20px;height:20px;border-radius:6px;border:1px solid ${T.line};background:${T.ink2};
  display:flex;align-items:center;justify-content:center;color:${T.gold};font-size:13px;}
.ds-chkbox[data-on="1"]{border-color:${T.gold};background:rgba(216,180,90,0.14);}

.ds-userfile{display:flex;align-items:center;gap:8px;border:1px solid ${T.line};border-radius:8px;
  padding:7px 10px;margin-bottom:6px;background:${T.ink2};}
.ds-userfile-name{flex:1;font-size:13px;word-break:break-all;}
.ds-userfile-count{font-size:11px;color:${T.faint};white-space:nowrap;}
`;

// ───────────────────────── App ─────────────────────────
export default function App() {
  const [characters, setCharacters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("core");
  const [delta, setDelta] = useState("");
  const [toast, setToast] = useState(null); // { text, id }
  const [showData, setShowData] = useState(false);
  const [importBuf, setImportBuf] = useState("");
  const [content, setContent] = useState(null); // SRD content loaded from public/content/
  const [openSpell, setOpenSpell] = useState(null); // spellbook row expanded for details
  const [spellbookOpen, setSpellbookOpen] = useState(true); // Spellbook panel collapsed/expanded
  const [openCastSpells, setOpenCastSpells] = useState(() => new Set()); // Spellcasting rows with description shown (multi-open)
  const [castLevels, setCastLevels] = useState({}); // { [spellId]: chosen upcast slot level } (ephemeral)
  const [showContent, setShowContent] = useState(false); // homebrew content modal
  const [contentType, setContentType] = useState("spells"); // selected type in that modal
  const [contentBuf, setContentBuf] = useState(""); // paste buffer for homebrew JSON
  const [userFiles, setUserFiles] = useState({}); // { [type]: files[] } shown in the modal

  const flash = (text) => setToast({ text, id: Math.random() });

  // Load SRD content from public/content/ on mount
  useEffect(() => {
    let cancelled = false;
    loadContent()
      .then((c) => { if (!cancelled) setContent(c); })
      .catch((e) => console.error("Content load failed", e));
    return () => { cancelled = true; };
  }, []);

  const hasStorage = typeof window !== "undefined" && window.storage;

  // Load once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (hasStorage) {
          const res = await window.storage.get("dnd:data");
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            if (!cancelled && parsed.characters && parsed.characters.length) {
              const migrated = parsed.characters.map((c) => {
                // Legacy hardcoded Eldritch Blast attack rows → spellbook entry (single source).
                const rawAttacks = (Array.isArray(c.attacks) ? c.attacks : []).map(normalizeAttack).filter(Boolean);
                const attacks = rawAttacks.filter((a) => !a.eldritchBlast);
                const spells = Array.isArray(c.spells) ? [...c.spells] : [];
                if (rawAttacks.some((a) => a.eldritchBlast) && !spells.includes("eldritch-blast")) {
                  spells.push("eldritch-blast");
                }
                return {
                ...c,
                attacks,
                spells,
                preparedSpells: Array.isArray(c.preparedSpells) ? c.preparedSpells : [],
                invocations: Array.isArray(c.invocations) ? c.invocations : [],
                feats: Array.isArray(c.feats) ? c.feats : [],
                patron: c.patron || "",
                pact: c.pact || "",
                familiar:
                  c.familiar && typeof c.familiar === "object"
                    ? {
                        enabled: !!c.familiar.enabled,
                        name: c.familiar.name || "",
                        form: c.familiar.form || "",
                        ac: c.familiar.ac != null ? c.familiar.ac : 12,
                        hp: { current: 1, max: 1, temp: 0, ...(c.familiar.hp || {}) },
                        speed: c.familiar.speed || "",
                        notes: c.familiar.notes || "",
                        attacks: Array.isArray(c.familiar.attacks) ? c.familiar.attacks : [],
                      }
                    : { enabled: false, name: "", form: "", ac: 12, hp: { current: 1, max: 1, temp: 0 }, speed: "", notes: "", attacks: [] },
                };
              });
              setCharacters(migrated);
              const valid = migrated.find((c) => c.id === parsed.activeId);
              setActiveId(valid ? parsed.activeId : migrated[0].id);
              setLoaded(true);
              return;
            }
          }
        }
      } catch (e) {
        /* nothing saved yet */
      }
      if (!cancelled) {
        const c = makeCharacter("Hilda Coalhand");
        c.race = "Dwarf";
        c.subrace = "Hill Dwarf";
        c.classes = [{ id: "warlock", level: 5 }];
        c.abilities = { str: 10, dex: 10, con: 8, int: 8, wis: 10, cha: 18 };
        c.savingProfs = { str: false, dex: false, con: false, int: false, wis: true, cha: true };
        c.skillProfs = { ...c.skillProfs, arcana: 1, deception: 1, investigation: 1 };
        c.spellAbility = "cha";
        c.patron = "Great Old One";
        c.pact = "Pact of the Chain";
        c.ac = 13;
        c.speed = 25;
        c.hp = { current: 28, max: 28, temp: 0 };
        c.hitDice = { total: 5, remaining: 5, dieType: 8 };
        c.spellSlots = slotsFor("warlock", 5);
        c.invocations = ["Agonizing Blast", "Investment of the Chain Master"];
        c.spells = ["eldritch-blast", "hex", "toll-the-dead"];
        c.attacks = [
          { id: uid(), kind: "weapon", name: "Light Crossbow", dice: "1d8", versatile: null, damageType: "piercing", props: ["ranged", "loading", "two-handed"], ability: "dex", proficient: true, twoHanded: false, addMod: true, magic: 0, bonusDmg: 0, effect: "" },
        ];
        c.familiar = {
          enabled: true, name: "Pipsqueak", form: "Imp", ac: 13,
          hp: { current: 10, max: 10, temp: 0 }, speed: "20 ft, fly 40 ft", notes: "",
          attacks: [
            { id: uid(), name: "Sting", toHit: 5, dice: "1d4", bonusDmg: 3, damageType: "piercing", hasSave: true, saveAbility: "con", useMyDC: true, fixedDC: 11, magical: true, effect: "On a failed save, 3d6 poison damage (half on success)." },
          ],
        };
        setCharacters([c]);
        setActiveId(c.id);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line

  // Save (debounced)
  useEffect(() => {
    if (!loaded || !hasStorage) return;
    const t = setTimeout(async () => {
      try {
        await window.storage.set("dnd:data", JSON.stringify({ characters, activeId }));
      } catch (e) {
        console.error("Save failed", e);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [characters, activeId, loaded, hasStorage]);

  // Auto-dismiss the toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const active = characters.find((c) => c.id === activeId) || null;

  // ── mutators ──
  const patch = (p) =>
    setCharacters((cs) =>
      cs.map((c) => (c.id === activeId ? { ...c, ...(typeof p === "function" ? p(c) : p) } : c))
    );
  const patchObj = (field, key, value) =>
    setCharacters((cs) =>
      cs.map((c) => (c.id === activeId ? { ...c, [field]: { ...c[field], [key]: value } } : c))
    );

  const addCharacter = () => {
    const c = makeCharacter();
    setCharacters((cs) => [...cs, c]);
    setActiveId(c.id);
    setTab("core");
  };
  const duplicateCharacter = () => {
    if (!active) return;
    const copy = { ...JSON.parse(JSON.stringify(active)), id: uid(), name: active.name + " (copy)" };
    setCharacters((cs) => [...cs, copy]);
    setActiveId(copy.id);
  };
  const deleteCharacter = () => {
    if (!active) return;
    if (!window.confirm(`Delete "${active.name}"? This can't be undone.`)) return;
    setCharacters((cs) => {
      const next = cs.filter((c) => c.id !== active.id);
      if (next.length === 0) {
        const fresh = makeCharacter("New Adventurer");
        setActiveId(fresh.id);
        return [fresh];
      }
      setActiveId(next[0].id);
      return next;
    });
  };

  if (!loaded || !content || !active) {
    return (
      <div className="ds-root">
        <style>{CSS}</style>
        <div style={{ padding: 40, textAlign: "center", color: T.dim }}>Opening the codex…</div>
      </div>
    );
  }

  const { RACES, CLASSES, SKILLS, FEATS, WEAPONS, SPELLS, INVOCATIONS, PATRONS, PACTS } = content;
  const WEAPON_BY_NAME = Object.fromEntries(WEAPONS.map((w) => [w.name, w]));
  // Combine race + subrace ability bonuses
  const raceBonuses = (raceName, subraceName) => {
    const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const r = RACES[raceName];
    if (!r) return out;
    Object.entries(r.asi || {}).forEach(([k, v]) => (out[k] += v));
    const sub = r.subraces && r.subraces[subraceName];
    if (sub) Object.entries(sub.asi || {}).forEach(([k, v]) => (out[k] += v));
    return out;
  };
  // Combine race + subrace trait lists
  const raceTraitList = (raceName, subraceName) => {
    const r = RACES[raceName];
    if (!r) return [];
    const sub = r.subraces && r.subraces[subraceName];
    return [...(r.traits || []), ...((sub && sub.traits) || [])];
  };

  // ── derived ──
  const activeClass = active.classes[0] || { id: "", level: 1 };
  const activeClassId = activeClass.id;
  const charLevel = num(activeClass.level, 1);
  const pb = profBonus(charLevel);
  const raceMods = raceBonuses(active.race, active.subrace);
  const totalScore = {};
  const mods = {};
  ABILITIES.forEach(([k]) => {
    totalScore[k] = num(active.abilities[k], 10) + raceMods[k];
    mods[k] = abilityMod(totalScore[k]);
  });
  const raceDef = RACES[active.race] || null;
  const classDef = CLASSES[activeClassId] || null;
  const traitList = raceTraitList(active.race, active.subrace);
  const classFeatures = classDef
    ? classDef.features.filter((f) => f.level <= charLevel)
    : [];
  const classMechanics = classDef?.mechanics || [];
  const spellById = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
  const lvlClamped = Math.max(1, Math.min(20, charLevel));
  const resourceMax = (r) => {
    const m = r.max;
    if (typeof m === "number") return m;
    if (m?.scalingTable) return num(m.scalingTable[lvlClamped - 1], 0);
    if (m?.scalingType === "level") return lvlClamped;
    if (m?.scalingType === "cha-mod") return Math.max(1, mods.cha);
    return 0;
  };
  const classResources = classDef ? classDef.resources.filter((r) => resourceMax(r) > 0) : [];
  const resCur = (id, max) => {
    const v = active.resources?.[id];
    return v === undefined ? max : Math.max(0, Math.min(num(v, 0), max));
  };
  const setResource = (id, value) => patch((c) => ({ resources: { ...c.resources, [id]: value } }));
  const hasEldritchAdept = (active.feats || []).some((f) => (f.name || "").trim().toLowerCase() === "eldritch adept");
  const invKnownAllowed = (WARLOCK_INV_KNOWN[lvlClamped] || 0) + (hasEldritchAdept ? 1 : 0);
  const availableInvocations = INVOCATIONS.filter(
    (inv) => inv.level <= lvlClamped && (!isPactPrereq(inv.prereq) || inv.prereq === active.pact)
  );
  const lockedInvCount = INVOCATIONS.length - availableInvocations.length;
  const chosenInv = active.invocations || [];
  const invChosen = chosenInv.length;
  const orphanInvocations = chosenInv.filter((n) => !availableInvocations.some((i) => i.name === n));
  const initiative = mods.dex + num(active.initMisc);
  const perceptionTotal =
    10 +
    mods.wis +
    (active.skillProfs.perception === 1 ? pb : 0) +
    (active.skillProfs.perception === 2 ? pb * 2 : 0);
  const spellMod = active.spellAbility ? mods[active.spellAbility] : null;
  const spellDC = spellMod === null ? null : 8 + pb + spellMod;
  const spellAtk = spellMod === null ? null : pb + spellMod;
  const hpPct = active.hp.max > 0 ? Math.max(0, Math.min(100, (active.hp.current / active.hp.max) * 100)) : 0;

  const cycleSkill = (key) => patchObj("skillProfs", key, (num(active.skillProfs[key]) + 1) % 3);
  const toggleSave = (key) => patchObj("savingProfs", key, !active.savingProfs[key]);

  const applyHP = (sign) => {
    const amt = Math.abs(num(delta));
    if (!amt) return;
    let { current, max, temp } = active.hp;
    if (sign < 0) {
      let dmg = amt;
      if (temp > 0) {
        const left = Math.max(0, temp - dmg);
        dmg -= temp - left;
        temp = left;
      }
      current = Math.max(0, current - dmg);
    } else {
      current = Math.min(max, current + amt);
    }
    patchObj("hp", "current", current);
    patchObj("hp", "temp", temp);
    setDelta("");
  };

  const setAttack = (id, key, value) =>
    patch((c) => ({ attacks: (c.attacks || []).map((a) => (a.id === id ? { ...a, [key]: value } : a)) }));
  const removeAttack = (id) => patch((c) => ({ attacks: (c.attacks || []).filter((a) => a.id !== id) }));
  const pushAttack = (atk) => patch((c) => ({ attacks: [...(c.attacks || []), atk] }));

  const defaultAbilityFor = (w) => {
    if (w.props.includes("ranged") && !w.props.includes("thrown")) return "dex";
    if (w.props.includes("finesse")) return mods.dex >= mods.str ? "dex" : "str";
    return "str";
  };
  const addWeapon = (name) => {
    const w = WEAPON_BY_NAME[name];
    if (!w) return;
    pushAttack({
      id: uid(), kind: "weapon", name: w.name, dice: w.dice, versatile: w.versatile,
      damageType: w.type, props: w.props, ability: defaultAbilityFor(w),
      proficient: true, twoHanded: false, addMod: true, magic: 0, bonusDmg: 0, effect: "",
    });
  };
  const addSpell = () =>
    pushAttack({
      id: uid(), kind: "spell", name: "", mode: "attack", saveAbility: "dex",
      dice: "", damageType: "", addMod: false, magic: 0, bonusDmg: 0, effect: "",
    });
  const addCustom = () =>
    pushAttack({
      id: uid(), kind: "custom", name: "", ability: "str", proficient: true,
      dice: "", damageType: "", addMod: true, magic: 0, bonusDmg: 0, effect: "",
    });
  const addManual = () => pushAttack({ id: uid(), kind: "manual", name: "", toHit: "", damage: "", effect: "" });

  // Compute to-hit / damage breakdown for an attack.
  const fmtFlat = (n) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "");
  const computeAttack = (a) => {
    const sp = active.spellAbility || "cha";
    if (a.kind === "manual") {
      return { manual: true, toHit: a.toHit || "—", damage: a.damage || "—", effects: a.effect ? [a.effect] : [] };
    }
    if (a.kind === "spell") {
      const smod = mods[sp];
      const magic = num(a.magic);
      if (a.eldritchBlast) {
        const beams = charLevel >= 17 ? 4 : charLevel >= 11 ? 3 : charLevel >= 5 ? 2 : 1;
        const ag = (active.invocations || []).includes("Agonizing Blast");
        const rep = (active.invocations || []).includes("Repelling Blast");
        const dmgFlat = (ag ? smod : 0) + num(a.bonusDmg);
        const hitParts = [`${sp.toUpperCase()} ${fmtMod(smod)}`, `proficiency +${pb}`];
        if (magic) hitParts.push(`magic ${fmtMod(magic)}`);
        const dmgParts = ["1d10"];
        if (ag) dmgParts.push(`${sp.toUpperCase()} ${fmtMod(smod)} (Agonizing Blast)`);
        if (num(a.bonusDmg)) dmgParts.push(`bonus ${fmtMod(num(a.bonusDmg))}`);
        const effects = [
          `${beams} beam${beams > 1 ? "s" : ""}, each a separate attack roll.`,
          ag ? "Agonizing Blast adds your spellcasting modifier to each beam (included)." : "Take Agonizing Blast to add your modifier to damage.",
          rep ? "Repelling Blast: push the target up to 10 ft on a hit." : null,
          a.effect,
        ].filter(Boolean);
        return { beams, perBeam: true, toHit: fmtMod(smod + pb + magic), toHitParts: hitParts, damage: `1d10${fmtFlat(dmgFlat)} ${a.damageType}`, damageParts: dmgParts, effects };
      }
      const dmgFlat = (a.addMod ? smod : 0) + num(a.bonusDmg);
      const dmgParts = a.dice ? [a.dice] : [];
      if (a.addMod) dmgParts.push(`${sp.toUpperCase()} ${fmtMod(smod)}`);
      if (num(a.bonusDmg)) dmgParts.push(`bonus ${fmtMod(num(a.bonusDmg))}`);
      const damage = a.dice ? `${a.dice}${fmtFlat(dmgFlat)} ${a.damageType || ""}`.trim() : "—";
      if (a.mode === "save") {
        const dc = 8 + pb + smod + magic;
        const parts = ["base 8", `proficiency +${pb}`, `${sp.toUpperCase()} ${fmtMod(smod)}`];
        if (magic) parts.push(`magic ${fmtMod(magic)}`);
        return { save: `DC ${dc} ${(a.saveAbility || "dex").toUpperCase()}`, toHitParts: parts, damage, damageParts: dmgParts, effects: a.effect ? [a.effect] : [] };
      }
      const hitParts = [`${sp.toUpperCase()} ${fmtMod(smod)}`, `proficiency +${pb}`];
      if (magic) hitParts.push(`magic ${fmtMod(magic)}`);
      return { toHit: fmtMod(smod + pb + magic), toHitParts: hitParts, damage, damageParts: dmgParts, effects: a.effect ? [a.effect] : [] };
    }
    // weapon or custom
    const abil = a.ability || "str";
    const amod = mods[abil];
    const magic = num(a.magic);
    const prof = a.proficient ? pb : 0;
    const hitParts = [`${abil.toUpperCase()} ${fmtMod(amod)}`];
    if (a.proficient) hitParts.push(`proficiency +${pb}`);
    if (magic) hitParts.push(`magic ${fmtMod(magic)}`);
    const dice = a.kind === "weapon" && a.twoHanded && a.versatile ? a.versatile : a.dice;
    const dmgFlat = (a.addMod ? amod : 0) + magic + num(a.bonusDmg);
    const dmgParts = dice ? [dice] : [];
    if (a.addMod) dmgParts.push(`${abil.toUpperCase()} ${fmtMod(amod)}`);
    if (magic) dmgParts.push(`magic ${fmtMod(magic)}`);
    if (num(a.bonusDmg)) dmgParts.push(`bonus ${fmtMod(num(a.bonusDmg))}`);
    const effects = [];
    const props = a.props || [];
    if (props.includes("reach")) effects.push("Reach: +5 ft.");
    if (props.includes("thrown")) effects.push("Can be thrown.");
    if (props.includes("loading")) effects.push("Loading: one shot per action.");
    if (props.includes("light")) effects.push("Light: eligible for two-weapon fighting.");
    if (props.includes("heavy")) effects.push("Heavy: Small creatures have disadvantage.");
    if (a.effect) effects.push(a.effect);
    return { toHit: fmtMod(amod + prof + magic), toHitParts: hitParts, damage: dice ? `${dice}${fmtFlat(dmgFlat)} ${a.damageType || ""}`.trim() : "—", damageParts: dmgParts, effects };
  };

  // ── spell → action integration ──
  // Cantrip damage/beams scale at character levels 5/11/17.
  const cantripMult = (lvl) => (lvl >= 17 ? 4 : lvl >= 11 ? 3 : lvl >= 5 ? 2 : 1);
  const scaleDice = (dice, factor) => {
    const m = /^(\d+)d(\d+)$/.exec(String(dice || "").trim());
    if (!m || factor <= 1) return dice || "";
    return `${parseInt(m[1], 10) * factor}d${m[2]}`;
  };
  // Upcasting: add `perLevel` dice for each slot level a leveled spell is cast above its base.
  const addDicePerLevel = (base, perLevel, extraLevels) => {
    if (extraLevels <= 0 || !perLevel) return base || "";
    const b = /^(\d+)d(\d+)$/.exec(String(base || "").trim());
    const h = /^(\d+)d(\d+)$/.exec(String(perLevel).trim());
    if (!b || !h) return base || "";
    const addN = parseInt(h[1], 10) * extraLevels;
    if (h[2] === b[2]) return `${parseInt(b[1], 10) + addN}d${b[2]}`; // same die: merge counts
    return `${base} + ${addN}d${h[2]}`; // mixed dice: append as a second term
  };
  const spellAbilityKey = active.spellAbility || (classDef && classDef.spellAbility) || "cha";
  // Map a chosen spell into the attack shape computeAttack consumes (attack/save only).
  const spellToAttack = (spell, castLevel) => {
    if (spell.id === "eldritch-blast") {
      return { id: spell.id, kind: "spell", name: spell.name, eldritchBlast: true,
        dice: "1d10", damageType: "force", addMod: false, magic: 0, bonusDmg: 0, effect: "" };
    }
    const act = spell.action || {};
    const factor = spell.level === 0 && act.cantripScaling === "dice" ? cantripMult(charLevel) : 1;
    const lvl = castLevel || spell.level;
    const extra = spell.level >= 1 && lvl > spell.level ? lvl - spell.level : 0;
    return {
      id: spell.id, kind: "spell", name: spell.name,
      mode: act.type === "save" ? "save" : "attack",
      saveAbility: act.save || "dex",
      dice: addDicePerLevel(scaleDice(act.damage, factor), act.higherLevel, extra),
      damageType: act.damageType || "",
      addMod: !!act.addSpellMod, magic: 0, bonusDmg: 0, effect: "",
    };
  };
  // Result object (same shape as computeAttack) for any actionable spell, incl. healing.
  const computeSpellCard = (spell, castLevel) => {
    const act = spell.action || {};
    const lvl = castLevel || spell.level;
    const extra = spell.level >= 1 && lvl > spell.level ? lvl - spell.level : 0;
    const effects = spell.description ? [spell.description] : [];
    if (act.higherLevelNote) effects.push(act.higherLevelNote);
    if (act.type === "heal") {
      const smod = mods[spellAbilityKey];
      const factor = spell.level === 0 && act.cantripScaling === "dice" ? cantripMult(charLevel) : 1;
      const dice = addDicePerLevel(scaleDice(act.damage, factor), act.higherLevel, extra);
      const flat = act.addSpellMod ? smod : 0;
      const parts = dice ? [dice] : [];
      if (act.addSpellMod) parts.push(`${spellAbilityKey.toUpperCase()} ${fmtMod(smod)}`);
      const amount = `${dice}${flat ? fmtFlat(flat) : ""}`.trim() || "—";
      return { heal: amount, healParts: parts, effects };
    }
    if (act.type === "auto") {
      // Automatic damage, no attack roll: N instances of `damage` (+ optional flat bonus each).
      // Reuses the standard attack card; the "to hit" box reads "Auto" instead of a bonus.
      const count = (act.instances || 1) + (act.higherLevelInstances || 0) * extra;
      const dice = scaleDice(act.damage, count); // "1d4" × 3 → "3d4"
      const perBonus = num(act.instanceBonus);
      const flat = perBonus * count;
      const damage = `${dice}${flat ? fmtFlat(flat) : ""} ${act.damageType || ""}`.trim() || "—";
      const damageParts = act.damage ? [`${count} × ${act.damage}${perBonus ? fmtFlat(perBonus) : ""}`] : [];
      return { toHit: "Auto", toHitParts: ["always hits — no attack roll"], damage, damageParts, effects };
    }
    if (act.type === "attack" && (act.instances || act.higherLevelInstances)) {
      // Multi-attack spell (rays/darts), each its own attack roll — same display as Eldritch Blast.
      const count = (act.instances || 1) + (act.higherLevelInstances || 0) * extra;
      const smod = mods[spellAbilityKey];
      const toHitParts = [`${spellAbilityKey.toUpperCase()} ${fmtMod(smod)}`, `proficiency +${pb}`];
      const dmgFlat = act.addSpellMod ? smod : 0;
      const dmgParts = act.damage ? [act.damage] : [];
      if (act.addSpellMod) dmgParts.push(`${spellAbilityKey.toUpperCase()} ${fmtMod(smod)}`);
      const damage = act.damage ? `${act.damage}${dmgFlat ? fmtFlat(dmgFlat) : ""} ${act.damageType || ""}`.trim() : "—";
      return {
        perBeam: true, beams: count, toHit: fmtMod(smod + pb), toHitParts, damage, damageParts: dmgParts,
        effects: [...effects, `${count} ray${count > 1 ? "s" : ""} — roll a separate attack for each.`],
      };
    }
    const r = computeAttack(spellToAttack(spell, lvl));
    return { ...r, effects };
  };
  // Short one-line summary of a spell's mechanics (for the spellbook list).
  const spellSummary = (spell) => {
    const act = spell.action;
    if (!act || !act.type || act.type === "none") return null;
    const r = computeSpellCard(spell);
    if (act.type === "heal") return `Heals ${r.heal}`;
    if (act.type === "auto") return `Auto · ${r.damage}`;
    if (r.save) return r.damage && r.damage !== "—" ? `${r.save} · ${r.damage}` : r.save;
    const hit = r.perBeam ? `${r.toHit} ea. beam` : `${r.toHit} to hit`;
    return `${hit} · ${r.damage}`;
  };

  // Repertoire (from Spellbook) and prepared subset (from Spellcasting).
  const chosenSpellIds = active.spells || [];
  const preparedSpellIds = active.preparedSpells || [];
  const isPrepareCaster = !!(classDef && classDef.learning === "prepare");
  // A spell is castable now: cantrips always; prepared casters need it prepared; known casters always.
  const isSpellActive = (sp) => {
    if (!sp) return false;
    if (sp.level === 0) return true;
    if (isPrepareCaster) return preparedSpellIds.includes(sp.id);
    return true;
  };
  const togglePrepared = (id) =>
    patch((c) => ({
      preparedSpells: (c.preparedSpells || []).includes(id)
        ? (c.preparedSpells || []).filter((s) => s !== id)
        : [...(c.preparedSpells || []), id],
    }));
  const toggleCastSpell = (id) =>
    setOpenCastSpells((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSlot = (lvl, idx) => {
    const slot = active.spellSlots[lvl];
    // pips represent used; clicking the nth pip sets cur so that 'idx+1' are used
    const usedNow = slot.max - slot.cur;
    const targetUsed = idx + 1 === usedNow ? idx : idx + 1; // click filled pip to free it
    patchObj("spellSlots", lvl, { ...slot, cur: Math.max(0, slot.max - targetUsed) });
  };
  const setSlotMax = (lvl, v) => {
    const m = Math.max(0, num(v));
    patchObj("spellSlots", lvl, { max: m, cur: m }); // refill to full when adjusting capacity
  };

  // ── auto-fill handlers ──
  const handleRaceChange = (name) => {
    const def = RACES[name];
    patch(() => {
      const out = { race: name, subrace: "" };
      if (def) out.speed = def.speed; // subrace speed applied on subrace pick
      return out;
    });
  };
  const handleSubraceChange = (name) => {
    patch((c) => {
      const r = RACES[c.race];
      const sub = r && r.subraces[name];
      const out = { subrace: name };
      if (sub && sub.speed) out.speed = sub.speed;
      else if (r) out.speed = r.speed;
      return out;
    });
  };
  const handleClassChange = (id) => {
    const def = CLASSES[id];
    if (!def) {
      patch((c) => ({ classes: [{ ...c.classes[0], id }] }));
      return;
    }
    const savingProfs = {};
    ABILITIES.forEach(([k]) => (savingProfs[k] = def.saves.includes(k)));
    patch((c) => {
      const lvl = num(c.classes[0].level, 1);
      const out = {
        classes: [{ id, level: lvl }],
        savingProfs,
        spellAbility: def.spellAbility || "",
        hitDice: { total: lvl, remaining: lvl, dieType: def.hitDie },
        spellSlots: slotsFor(def.caster, lvl),
        resources: {},
        spells: [],
        preparedSpells: [],
      };
      if (id === "warlock") {
        out.patron = c.patron || "Great Old One";
        out.pact = c.pact || (lvl >= 3 ? "Pact of the Chain" : "");
        if (!(c.invocations && c.invocations.length)) {
          const inv = [];
          if (lvl >= 2) inv.push("Agonizing Blast");
          if (lvl >= 5 && out.pact === "Pact of the Chain") inv.push("Investment of the Chain Master");
          out.invocations = inv;
        }
      }
      return out;
    });
  };
  const handleLevelChange = (v) => {
    const level = Math.max(1, Math.min(20, num(v, 1)));
    patch((c) => {
      const def = CLASSES[c.classes[0].id];
      const out = {
        classes: [{ ...c.classes[0], level }],
        hitDice: { ...c.hitDice, total: level, remaining: Math.min(num(c.hitDice.remaining, level), level) },
      };
      if (def && def.caster) out.spellSlots = slotsFor(def.caster, level);
      return out;
    });
  };

  // ── rests & hit dice ──
  const longRest = () => {
    const resRefill = {};
    classResources.forEach((r) => { resRefill[r.id] = resourceMax(r); });
    patch((c) => {
      const spellSlots = {};
      SPELL_LEVELS.forEach((l) => {
        const s = c.spellSlots[l];
        spellSlots[l] = { max: s.max, cur: s.max };
      });
      const maxHD = num(c.hitDice.total, 0);
      const regain = Math.max(1, Math.floor(maxHD / 2));
      const remaining = Math.min(maxHD, num(c.hitDice.remaining, 0) + regain);
      return {
        hp: { ...c.hp, current: num(c.hp.max, 0), temp: 0 },
        spellSlots,
        hitDice: { ...c.hitDice, remaining },
        deathSaves: { s: 0, f: 0 },
        resources: { ...c.resources, ...resRefill },
      };
    });
    flash("Long rest — HP and spell slots restored; hit dice and death saves recovered.");
  };
  const shortRest = () => {
    const isWarlock = classDef && classDef.caster === "warlock";
    const resRefill = {};
    classResources.filter((r) => r.recharge === "short-rest").forEach((r) => { resRefill[r.id] = resourceMax(r); });
    patch((c) => {
      const out = { resources: { ...c.resources, ...resRefill } };
      const def = CLASSES[c.classes[0].id];
      if (def && def.caster === "warlock") {
        const spellSlots = {};
        SPELL_LEVELS.forEach((l) => {
          const s = c.spellSlots[l];
          spellSlots[l] = { max: s.max, cur: s.max };
        });
        out.spellSlots = spellSlots;
      }
      return out;
    });
    flash(
      isWarlock
        ? "Short rest — pact magic slots restored. Spend Hit Dice below to heal."
        : "Short rest — spend Hit Dice below to heal and recharge short-rest abilities."
    );
  };
  const spendHitDie = () => {
    if (num(active.hitDice.remaining, 0) <= 0) {
      flash("No Hit Dice remaining.");
      return;
    }
    if (num(active.hp.current, 0) >= num(active.hp.max, 0)) {
      flash("Already at full HP.");
      return;
    }
    const sides = num(active.hitDice.dieType, 8);
    const roll = Math.floor(Math.random() * sides) + 1;
    const heal = Math.max(0, roll + mods.con);
    patch((c) => ({
      hitDice: { ...c.hitDice, remaining: num(c.hitDice.remaining, 0) - 1 },
      hp: { ...c.hp, current: Math.min(num(c.hp.max, 0), num(c.hp.current, 0) + heal) },
    }));
    flash(`Spent a d${active.hitDice.dieType}: rolled ${roll} ${fmtMod(mods.con)} CON = ${heal} HP healed.`);
  };

  // ── feats ──
  const addFeat = (name) => {
    if (!name) return;
    const isCustom = name === "__custom";
    patch((c) => ({
      feats: [...(c.feats || []), { id: uid(), name: isCustom ? "" : name, desc: isCustom ? "" : FEATS[name] || "" }],
    }));
  };
  const setFeat = (id, key, value) =>
    patch((c) => ({ feats: (c.feats || []).map((f) => (f.id === id ? { ...f, [key]: value } : f)) }));
  const removeFeat = (id) => patch((c) => ({ feats: (c.feats || []).filter((f) => f.id !== id) }));

  // ── invocations ──
  const toggleInvocation = (name) =>
    patch((c) => {
      const cur = c.invocations || [];
      return { invocations: cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name] };
    });
  const setPatron = (v) => patch({ patron: v });
  const setPact = (v) =>
    patch((c) => {
      const kept = (c.invocations || []).filter((n) => {
        const inv = INVOCATIONS.find((i) => i.name === n);
        return !(inv && isPactPrereq(inv.prereq) && inv.prereq !== v);
      });
      return { pact: v, invocations: kept };
    });

  // ── shared mini inputs (used by attacks & familiar) ──
  const miniText = (label, val, onChange, style = {}) => (
    <div className="ds-mini" key={label}>
      <label>{label}</label>
      <input value={val || ""} style={{ width: 96, textAlign: "left", ...style }} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
  const miniNum = (label, val, onChange) => (
    <div className="ds-mini" key={label}>
      <label>{label}</label>
      <input value={val} inputMode="numeric" onChange={(e) => onChange(num(e.target.value))} />
    </div>
  );
  const miniSel = (label, val, onChange, options) => (
    <div className="ds-mini" key={label}>
      <label>{label}</label>
      <select value={val} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
  const chip = (label, on, onClick) => (
    <div
      className="ds-chip"
      key={label}
      data-on={on ? "1" : "0"}
      role="checkbox"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {label}
    </div>
  );
  const fxField = (val, onChange) => (
    <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
      <label>Effect / notes</label>
      <input value={val || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  // ── familiar ──
  const fam = active.familiar || { enabled: false, attacks: [] };
  const hasInvestment = (active.invocations || []).includes("Investment of the Chain Master");
  const setFam = (key, value) => patch((c) => ({ familiar: { ...c.familiar, [key]: value } }));
  const setFamHP = (key, value) => patch((c) => ({ familiar: { ...c.familiar, hp: { ...c.familiar.hp, [key]: value } } }));
  const summonForm = (form) => {
    const f = FAMILIAR_FORMS[form];
    if (!f) return;
    const attacks = f.attacks.map((a) => ({
      id: uid(), name: "", toHit: 0, dice: "", bonusDmg: 0, damageType: "", hasSave: false,
      saveAbility: "con", fixedDC: 10, useMyDC: false, magical: false, effect: "",
      ...a,
      magical: hasInvestment,
      useMyDC: hasInvestment && !!a.hasSave,
    }));
    patch((c) => ({
      familiar: {
        enabled: true,
        name: c.familiar && c.familiar.name ? c.familiar.name : form === "Custom" ? "" : form,
        form,
        ac: f.ac,
        hp: { current: f.hp, max: f.hp, temp: 0 },
        speed: f.speed,
        notes: (c.familiar && c.familiar.notes) || "",
        attacks,
      },
    }));
    setTab("familiar");
  };
  const dismissFamiliar = () => setFam("enabled", false);
  const resummonFamiliar = () => setFam("enabled", true);
  const addFamAttack = () =>
    patch((c) => ({
      familiar: {
        ...c.familiar,
        attacks: [...(c.familiar.attacks || []), { id: uid(), name: "", toHit: 0, dice: "", bonusDmg: 0, damageType: "", hasSave: false, saveAbility: "con", fixedDC: 10, useMyDC: hasInvestment, magical: hasInvestment, effect: "" }],
      },
    }));
  const setFamAttack = (id, key, value) =>
    patch((c) => ({ familiar: { ...c.familiar, attacks: (c.familiar.attacks || []).map((a) => (a.id === id ? { ...a, [key]: value } : a)) } }));
  const removeFamAttack = (id) =>
    patch((c) => ({ familiar: { ...c.familiar, attacks: (c.familiar.attacks || []).filter((a) => a.id !== id) } }));
  const computeFamiliarAttack = (a) => {
    const charDC = spellDC != null ? spellDC : 8 + pb;
    const damage = a.dice ? `${a.dice}${fmtFlat(num(a.bonusDmg))} ${a.damageType || ""}`.trim() : "—";
    const save = a.hasSave ? `DC ${a.useMyDC ? charDC : num(a.fixedDC)} ${(a.saveAbility || "con").toUpperCase()}` : null;
    const effects = [];
    if (a.magical) effects.push("Counts as magical.");
    if (a.hasSave && a.useMyDC) effects.push("Save DC uses your spell save DC.");
    if (a.effect) effects.push(a.effect);
    return { toHit: fmtMod(num(a.toHit)), damage, save, effects };
  };

  // ── save / export / import ──
  const download = (filename, text) => {
    try {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash("Saved " + filename);
    } catch (e) {
      flash("Download isn't allowed here — use Copy instead.");
    }
  };
  const slug = (s) => (s || "character").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "character";
  const exportOne = () => download(slug(active.name) + ".json", JSON.stringify(active, null, 2));
  const exportAll = () => download("codex-backup.json", JSON.stringify({ version: 1, characters }, null, 2));
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Copied to clipboard.");
    } catch (e) {
      flash("Couldn't copy automatically — select the text and copy it manually.");
    }
  };
  const importText = (text) => {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      flash("That doesn't look like valid JSON.");
      return;
    }
    const hydrated = charactersFromImport(data);
    if (hydrated.length === 0) {
      flash("No characters found in that data.");
      return;
    }
    setCharacters((cs) => [...cs, ...hydrated]);
    setActiveId(hydrated[0].id);
    setShowData(false);
    setImportBuf("");
    setTab("core");
    flash(`Imported ${hydrated.length} character${hydrated.length > 1 ? "s" : ""}.`);
  };
  const onImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importText(String(reader.result));
    reader.onerror = () => flash("Couldn't read that file.");
    reader.readAsText(file);
    e.target.value = ""; // allow re-importing the same file
  };

  // ── homebrew content ──
  const contentLabel = (type) => (CONTENT_TYPES.find(([t]) => t === type) || [, type])[1];
  const reloadContent = async () => {
    try {
      setContent(await loadContent());
    } catch (e) {
      console.error("Content reload failed", e);
    }
  };
  const refreshUserFiles = async () => {
    const entries = await Promise.all(CONTENT_TYPES.map(async ([t]) => [t, await getUserFiles(t)]));
    setUserFiles(Object.fromEntries(entries));
  };
  const openContent = () => {
    setShowContent(true);
    refreshUserFiles();
  };
  const addUserContent = async (name, text) => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      flash("That doesn't look like valid JSON.");
      return;
    }
    const res = validateUserContent(parsed);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    try {
      await putUserFile(contentType, name, parsed);
      await reloadContent();
      await refreshUserFiles();
      setContentBuf("");
      flash(`Added ${res.count} entr${res.count === 1 ? "y" : "ies"} to ${contentLabel(contentType)}.`);
    } catch (e) {
      flash("Couldn't save — storage isn't available here.");
    }
  };
  const onContentFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addUserContent(file.name, String(reader.result));
    reader.onerror = () => flash("Couldn't read that file.");
    reader.readAsText(file);
    e.target.value = ""; // allow re-adding the same file
  };
  const removeUserContent = async (type, name) => {
    try {
      await deleteUserFile(type, name);
      await reloadContent();
      await refreshUserFiles();
      flash(`Removed ${name}.`);
    } catch (e) {
      flash("Couldn't remove that file.");
    }
  };

  // ── render helpers ──
  const Field = (label, value, onChange, props = {}) => (
    <div className="ds-field" key={label}>
      <label>{label}</label>
      <input
        className="ds-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </div>
  );

  const renderTop = () => (
    <div className="ds-top">
      <div className="ds-top-inner">
        <div className="ds-brand">
          CODEX
          <small>5e character sheet</small>
        </div>
        <div className="ds-spacer" />
        <select
          className="ds-select"
          value={activeId}
          onChange={(e) => {
            setActiveId(e.target.value);
            setTab("core");
          }}
        >
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || "Unnamed"}
              {c.classes?.[0]?.id ? ` · ${CLASSES[c.classes[0].id]?.name || c.classes[0].id} ${c.classes[0].level}` : ` · Lv ${c.classes?.[0]?.level || 1}`}
            </option>
          ))}
        </select>
        <button className="ds-btn ds-btn-gold" onClick={addCharacter}>
          + New
        </button>
        <button className="ds-btn ds-btn-ghost" onClick={duplicateCharacter} title="Duplicate">
          Copy
        </button>
        <button className="ds-btn ds-btn-ghost" onClick={() => setShowData(true)} title="Save, export & import">
          Backup
        </button>
        <button className="ds-btn ds-btn-ghost" onClick={openContent} title="Add your own content">
          Content
        </button>
        <button className="ds-btn ds-btn-ghost ds-btn-danger" onClick={deleteCharacter} title="Delete">
          Delete
        </button>
      </div>
    </div>
  );

  const TABS = [
    ["core", "Core"],
    ["skills", "Skills"],
    ["magic", "Combat & Magic"],
    ["familiar", "Familiar"],
    ["notes", "Notes & Gear"],
  ];

  const renderTabs = () => (
    <div className="ds-tabs">
      {TABS.map(([k, label]) => (
        <button key={k} className="ds-tab" data-on={tab === k ? "1" : "0"} onClick={() => setTab(k)}>
          {label}
        </button>
      ))}
    </div>
  );

  const renderIdentity = () => {
    const subraceNames = raceDef ? Object.keys(raceDef.subraces || {}) : [];
    return (
      <div className="ds-panel">
        <input
          className="ds-id-name"
          value={active.name}
          placeholder="Character name"
          onChange={(e) => patch({ name: e.target.value })}
        />
        <div className="ds-id-row">
          <div className="ds-field">
            <label>Class</label>
            <select className="ds-input" value={activeClassId} onChange={(e) => handleClassChange(e.target.value)}>
              <option value="">— choose —</option>
              {Object.entries(CLASSES).map(([id, def]) => (
                <option key={id} value={id}>
                  {def.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ds-field">
            <label>Level</label>
            <input
              className="ds-input"
              value={charLevel}
              inputMode="numeric"
              onChange={(e) => handleLevelChange(e.target.value)}
            />
          </div>
          <div className="ds-field">
            <label>Race</label>
            <select className="ds-input" value={active.race} onChange={(e) => handleRaceChange(e.target.value)}>
              <option value="">— choose —</option>
              {Object.keys(RACES).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {subraceNames.length > 0 && (
            <div className="ds-field">
              <label>Subrace</label>
              <select className="ds-input" value={active.subrace} onChange={(e) => handleSubraceChange(e.target.value)}>
                <option value="">— choose —</option>
                {subraceNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          {Field("Background", active.background, (v) => patch({ background: v }), { placeholder: "Sage" })}
          {Field("Alignment", active.alignment, (v) => patch({ alignment: v }), { placeholder: "CG" })}
          {Field("XP", active.xp, (v) => patch({ xp: num(v) }), { inputMode: "numeric" })}
        </div>
        {(raceDef || classDef) && (
          <div className="ds-muted" style={{ marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {raceDef && <span>Size · {raceDef.size}</span>}
            {classDef && <span>Hit die · {classDef.hitDie}</span>}
            {classDef && classDef.caster && (
              <span>Casting · {classDef.caster === "warlock" ? "pact magic" : classDef.caster + " caster"}</span>
            )}
          </div>
        )}
        <label className="ds-chk" style={{ marginTop: 14 }} onClick={() => patch({ inspiration: !active.inspiration })}>
          <span className="ds-chkbox" data-on={active.inspiration ? "1" : "0"}>
            {active.inspiration ? "★" : ""}
          </span>
          Inspiration
        </label>
      </div>
    );
  };

  const renderCombatStats = () => (
    <div className="ds-panel">
      <div className="ds-panel-title">At a glance</div>
      <div className="ds-stats">
        <div className="ds-stat">
          <div className="lab">Armor Class</div>
          <input
            className="ds-input"
            value={active.ac}
            inputMode="numeric"
            onChange={(e) => patch({ ac: num(e.target.value) })}
          />
        </div>
        <div className="ds-stat">
          <div className="lab">Initiative</div>
          <div className="big">{fmtMod(initiative)}</div>
        </div>
        <div className="ds-stat">
          <div className="lab">Speed</div>
          <input
            className="ds-input"
            value={active.speed}
            inputMode="numeric"
            onChange={(e) => patch({ speed: num(e.target.value) })}
          />
        </div>
        <div className="ds-stat">
          <div className="lab">Prof. Bonus</div>
          <div className="big">{fmtMod(pb)}</div>
        </div>
        <div className="ds-stat">
          <div className="lab">Passive Perc.</div>
          <div className="big">{perceptionTotal}</div>
        </div>
      </div>
    </div>
  );

  const renderHP = () => (
    <div className="ds-panel">
      <div className="ds-panel-title">Hit points</div>
      <div className="ds-hp-main">
        <input
          value={active.hp.current}
          inputMode="numeric"
          onChange={(e) => patchObj("hp", "current", num(e.target.value))}
          aria-label="Current hit points"
        />
        <span className="sep">/</span>
        <input
          className="maxin"
          value={active.hp.max}
          inputMode="numeric"
          onChange={(e) => patchObj("hp", "max", num(e.target.value))}
          aria-label="Maximum hit points"
        />
      </div>
      <div className="ds-hp-bar">
        <div className="ds-hp-fill" style={{ width: hpPct + "%" }} />
      </div>
      <div className="ds-hp-tools">
        <input
          className="ds-input"
          placeholder="0"
          inputMode="numeric"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
        />
        <button className="ds-btn" style={{ borderColor: T.crimson, color: T.crimson }} onClick={() => applyHP(-1)}>
          Damage
        </button>
        <button className="ds-btn" style={{ borderColor: T.green, color: T.green }} onClick={() => applyHP(1)}>
          Heal
        </button>
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div className="ds-field" style={{ minWidth: 120 }}>
          <label>Temporary HP</label>
          <input
            className="ds-input"
            style={{ width: 80 }}
            value={active.hp.temp}
            inputMode="numeric"
            onChange={(e) => patchObj("hp", "temp", num(e.target.value))}
          />
        </div>
        <div className="ds-field" style={{ minWidth: 160 }}>
          <label>Hit Dice</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="ds-input"
              style={{ width: 46 }}
              value={active.hitDice.remaining}
              inputMode="numeric"
              onChange={(e) => patchObj("hitDice", "remaining", num(e.target.value))}
            />
            <span className="ds-muted">/</span>
            <input
              className="ds-input"
              style={{ width: 46 }}
              value={active.hitDice.total}
              inputMode="numeric"
              onChange={(e) => patchObj("hitDice", "total", num(e.target.value))}
            />
            <input
              className="ds-input"
              style={{ width: 58 }}
              value={`d${active.hitDice.dieType}`}
              onChange={(e) => patchObj("hitDice", "dieType", parseInt(String(e.target.value).replace(/[^0-9]/g, ""), 10) || 8)}
            />
            <button className="ds-btn" style={{ padding: "6px 10px" }} onClick={spendHitDie} title="Roll a Hit Die to heal">
              Spend
            </button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: T.faint }}>
          Death saves
        </label>
        <div style={{ display: "flex", gap: 22, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ds-muted" style={{ color: T.green }}>
              Successes
            </span>
            <div className="ds-dots">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="ds-dot"
                  data-kind="s"
                  data-on={active.deathSaves.s > i ? "1" : "0"}
                  onClick={() => patchObj("deathSaves", "s", active.deathSaves.s === i + 1 ? i : i + 1)}
                />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ds-muted" style={{ color: T.crimson }}>
              Failures
            </span>
            <div className="ds-dots">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="ds-dot"
                  data-kind="f"
                  data-on={active.deathSaves.f > i ? "1" : "0"}
                  onClick={() => patchObj("deathSaves", "f", active.deathSaves.f === i + 1 ? i : i + 1)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="ds-rest-row">
        <button className="ds-btn" onClick={shortRest}>
          Short Rest
        </button>
        <button className="ds-btn ds-btn-gold" onClick={longRest}>
          Long Rest
        </button>
      </div>
    </div>
  );

  const renderAbilities = () => (
    <div className="ds-panel">
      <div className="ds-panel-title">Ability scores</div>
      <div className="ds-abil-grid">
        {ABILITIES.map(([k, full, abbr]) => (
          <div className="ds-rune" key={k} title={full}>
            <div className="ab">{abbr}</div>
            <div className="mod">{fmtMod(mods[k])}</div>
            <div className="score">
              <input
                value={active.abilities[k]}
                inputMode="numeric"
                aria-label={full + " base score"}
                onChange={(e) => patchObj("abilities", k, e.target.value === "" ? "" : num(e.target.value))}
              />
              {raceMods[k] !== 0 && <span className="rbonus">{fmtMod(raceMods[k])}</span>}
            </div>
            {raceMods[k] !== 0 && <div className="total">total {totalScore[k]}</div>}
          </div>
        ))}
      </div>
      {raceDef && (
        <p className="ds-muted" style={{ marginTop: 10 }}>
          The box is your base score; the chip is your {active.race} bonus. The modifier uses the total.
        </p>
      )}
    </div>
  );

  const renderSaves = () => (
    <div className="ds-panel">
      <div className="ds-panel-title">Saving throws</div>
      <div className="ds-rowlist">
        {ABILITIES.map(([k, full, abbr]) => {
          const prof = active.savingProfs[k];
          const bonus = mods[k] + (prof ? pb : 0);
          return (
            <div className="ds-row" key={k}>
              <div
                className="ds-pip"
                data-s={prof ? "1" : "0"}
                onClick={() => toggleSave(k)}
                role="checkbox"
                aria-checked={prof}
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleSave(k)}
              >
                {prof ? "●" : ""}
              </div>
              <span className="rabb">{abbr}</span>
              <span className="rname">{full}</span>
              <span className="rbonus">{fmtMod(bonus)}</span>
            </div>
          );
        })}
      </div>
      <p className="ds-muted" style={{ marginTop: 10 }}>
        Tap the marker to toggle proficiency.
      </p>
    </div>
  );

  const renderSkills = () => (
    <div className="ds-panel ds-fade">
      <div className="ds-panel-title">Skills</div>
      <div className="ds-rowlist">
        {SKILLS.map(([k, label, ab]) => {
          const lvl = active.skillProfs[k];
          const bonus = mods[ab] + (lvl === 1 ? pb : 0) + (lvl === 2 ? pb * 2 : 0);
          return (
            <div className="ds-row" key={k}>
              <div
                className="ds-pip"
                data-s={String(lvl)}
                onClick={() => cycleSkill(k)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && cycleSkill(k)}
                title={lvl === 0 ? "Not proficient" : lvl === 1 ? "Proficient" : "Expertise"}
              >
                {lvl === 0 ? "" : lvl === 1 ? "●" : "★"}
              </div>
              <span className="rabb">{ab}</span>
              <span className="rname">{label}</span>
              <span className="rbonus">{fmtMod(bonus)}</span>
            </div>
          );
        })}
      </div>
      <p className="ds-muted" style={{ marginTop: 10 }}>
        Tap once for proficiency (●), twice for expertise (★).
      </p>
    </div>
  );

  const renderAttacks = () => {
    const controls = (a) => {
      if (a.kind === "weapon") {
        return [
          miniSel("Ability", a.ability, (v) => setAttack(a.id, "ability", v), [["str", "STR"], ["dex", "DEX"]]),
          chip("Proficient", a.proficient, () => setAttack(a.id, "proficient", !a.proficient)),
          a.versatile ? chip("Two-handed", a.twoHanded, () => setAttack(a.id, "twoHanded", !a.twoHanded)) : null,
          chip("+mod to dmg", a.addMod, () => setAttack(a.id, "addMod", !a.addMod)),
          miniNum("Magic ±", a.magic, (v) => setAttack(a.id, "magic", v)),
          miniNum("Bonus dmg", a.bonusDmg, (v) => setAttack(a.id, "bonusDmg", v)),
          <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
            <label>Effect / notes</label>
            <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
          </div>,
        ];
      }
      if (a.kind === "custom") {
        return [
          miniSel("Ability", a.ability, (v) => setAttack(a.id, "ability", v), ABILITIES.map(([k, , ab]) => [k, ab])),
          chip("Proficient", a.proficient, () => setAttack(a.id, "proficient", !a.proficient)),
          miniText("Dice", a.dice, (v) => setAttack(a.id, "dice", v), { width: 70, textAlign: "center" }),
          miniText("Type", a.damageType, (v) => setAttack(a.id, "damageType", v)),
          chip("+mod to dmg", a.addMod, () => setAttack(a.id, "addMod", !a.addMod)),
          miniNum("Magic ±", a.magic, (v) => setAttack(a.id, "magic", v)),
          miniNum("Bonus dmg", a.bonusDmg, (v) => setAttack(a.id, "bonusDmg", v)),
          <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
            <label>Effect / notes</label>
            <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
          </div>,
        ];
      }
      if (a.kind === "spell") {
        if (a.eldritchBlast) {
          return [
            miniNum("Magic ±", a.magic, (v) => setAttack(a.id, "magic", v)),
            miniNum("Bonus dmg", a.bonusDmg, (v) => setAttack(a.id, "bonusDmg", v)),
            <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
              <label>Effect / notes</label>
              <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
            </div>,
          ];
        }
        return [
          miniSel("Mode", a.mode, (v) => setAttack(a.id, "mode", v), [["attack", "Attack roll"], ["save", "Saving throw"]]),
          a.mode === "save"
            ? miniSel("Save", a.saveAbility || "dex", (v) => setAttack(a.id, "saveAbility", v), ABILITIES.map(([k, , ab]) => [k, ab]))
            : null,
          miniText("Dice", a.dice, (v) => setAttack(a.id, "dice", v), { width: 70, textAlign: "center" }),
          miniText("Type", a.damageType, (v) => setAttack(a.id, "damageType", v)),
          chip("+mod to dmg", a.addMod, () => setAttack(a.id, "addMod", !a.addMod)),
          miniNum(a.mode === "save" ? "DC ±" : "Magic ±", a.magic, (v) => setAttack(a.id, "magic", v)),
          miniNum("Bonus dmg", a.bonusDmg, (v) => setAttack(a.id, "bonusDmg", v)),
          <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
            <label>Effect / notes</label>
            <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
          </div>,
        ];
      }
      // manual
      return [
        miniText("To hit", a.toHit, (v) => setAttack(a.id, "toHit", v), { width: 90 }),
        miniText("Damage", a.damage, (v) => setAttack(a.id, "damage", v), { width: 140 }),
        <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
          <label>Effect / notes</label>
          <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
        </div>,
      ];
    };

    const kindLabel = { weapon: "weapon", spell: "spell", custom: "custom", manual: "manual" };
    const attacks = active.attacks || [];
    const spellActions = chosenSpellIds
      .map((id) => spellById[id])
      .filter((s) => s && s.action && s.action.type && s.action.type !== "none" && isSpellActive(s));

    return (
      <div className="ds-panel">
        <div className="ds-panel-title">Attacks</div>
        <div className="ds-add-row">
          <select className="ds-input" value="" onChange={(e) => addWeapon(e.target.value)}>
            <option value="">+ Add weapon…</option>
            {WEAPONS.map((w) => (
              <option key={w.name} value={w.name}>
                {w.name} ({w.dice} {w.type})
              </option>
            ))}
          </select>
          <button className="ds-btn" onClick={addSpell}>
            + Spell
          </button>
          <button className="ds-btn" onClick={addCustom}>
            + Custom
          </button>
          <button className="ds-btn ds-btn-ghost" onClick={addManual}>
            + Manual
          </button>
        </div>

        {attacks.length === 0 && (
          <div className="ds-empty">No attacks yet — add a weapon or custom attack above, or add spells in the Spellbook.</div>
        )}

        {attacks.map((a) => {
          const r = computeAttack(a);
          return (
            <div className="ds-atk" key={a.id}>
              <div className="ds-atk-top">
                <input
                  className="ds-input ds-atk-name"
                  placeholder="Name"
                  value={a.name}
                  onChange={(e) => setAttack(a.id, "name", e.target.value)}
                />
                <span className="ds-atk-kind">{kindLabel[a.kind] || "attack"}</span>
                <button className="ds-icon-btn" onClick={() => removeAttack(a.id)} aria-label="Remove attack">
                  ✕
                </button>
              </div>

              <div className="ds-atk-result">
                <div className="ds-atk-stat">
                  <div className="lab">{r.save ? "Spell save DC" : r.perBeam ? "To hit (each beam)" : "To hit"}</div>
                  <div className="val">{r.save ? r.save : r.toHit}</div>
                  {r.toHitParts && <div className="src">{r.toHitParts.join(" · ")}</div>}
                </div>
                <div className="ds-atk-stat">
                  <div className="lab">{r.perBeam ? `Damage (×${r.beams})` : "Damage"}</div>
                  <div className="val">{r.damage}</div>
                  {r.damageParts && r.damageParts.length > 0 && <div className="src">{r.damageParts.join(" · ")}</div>}
                </div>
              </div>

              {r.effects && r.effects.length > 0 && (
                <ul className="ds-atk-fx">
                  {r.effects.map((fx, i) => (
                    <li key={i}>{fx}</li>
                  ))}
                </ul>
              )}

              <div className="ds-atk-ctl">{controls(a)}</div>
            </div>
          );
        })}

        {spellActions.length > 0 && (
          <div className="ds-spell-actions">
            <div className="ds-sub-label">From spellbook</div>
            {spellActions.map((spell) => {
              const act = spell.action || {};
              const baseLvl = spell.level;
              // Slot levels at or above the spell's base level that the character actually has.
              const slotOptions = baseLvl >= 1
                ? SPELL_LEVELS.filter((l) => l >= baseLvl && active.spellSlots[l] && active.spellSlots[l].max > 0)
                : [];
              // Warlocks always cast at their (single) pact slot; everyone else defaults to base.
              const defaultLvl = activeClassId === "warlock" && slotOptions.length
                ? slotOptions[slotOptions.length - 1]
                : baseLvl;
              const picked = castLevels[spell.id];
              const castLevel = picked != null && slotOptions.includes(picked) ? picked : defaultLvl;
              const showSelector = (act.higherLevel || act.higherLevelNote || act.higherLevelInstances) && slotOptions.length > 1;
              const r = computeSpellCard(spell, castLevel);
              const lvl = baseLvl === 0 ? "cantrip" : castLevel > baseLvl ? `cast at level ${castLevel}` : `level ${baseLvl}`;
              return (
                <div className="ds-atk ds-atk-derived" key={`sp-${spell.id}`}>
                  <div className="ds-atk-top">
                    <span className="ds-atk-name-static">{spell.name}</span>
                    <span className="ds-atk-kind">spell · {lvl}</span>
                  </div>
                  {showSelector && (
                    <div className="ds-atk-ctl">
                      <div className="ds-mini">
                        <label>Cast at slot</label>
                        <select value={castLevel} onChange={(e) => setCastLevels((m) => ({ ...m, [spell.id]: num(e.target.value) }))}>
                          {slotOptions.map((l) => (
                            <option key={l} value={l}>Level {l}{l === baseLvl ? " (base)" : ""}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="ds-atk-result">
                    <div className="ds-atk-stat">
                      <div className="lab">{r.heal ? "Healing" : r.save ? "Spell save DC" : r.perBeam ? "To hit (each beam)" : "To hit"}</div>
                      <div className="val">{r.heal ? r.heal : r.save ? r.save : r.toHit}</div>
                      {!r.heal && r.toHitParts && <div className="src">{r.toHitParts.join(" · ")}</div>}
                      {r.heal && r.healParts && r.healParts.length > 0 && <div className="src">{r.healParts.join(" · ")}</div>}
                    </div>
                    {!r.heal && (
                      <div className="ds-atk-stat">
                        <div className="lab">{r.perBeam ? `Damage (×${r.beams})` : "Damage"}</div>
                        <div className="val">{r.damage}</div>
                        {r.damageParts && r.damageParts.length > 0 && <div className="src">{r.damageParts.join(" · ")}</div>}
                      </div>
                    )}
                  </div>
                  {r.effects && r.effects.length > 0 && (
                    <ul className="ds-atk-fx">
                      {r.effects.map((fx, i) => (
                        <li key={i}>{fx}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <p className="ds-muted" style={{ marginTop: 6 }}>Add or remove these in the Spellbook below.</p>
          </div>
        )}
      </div>
    );
  };

  const renderResources = () => {
    if (classResources.length === 0) return null;
    return (
      <div className="ds-panel">
        <div className="ds-panel-title">Class resources</div>
        <div className="ds-res-grid">
          {classResources.map((r) => {
            const max = resourceMax(r);
            const cur = resCur(r.id, max);
            const rechargeLabel = r.recharge === "short-rest" ? "short rest" : "long rest";
            if (r.displayType === "counter") {
              return (
                <div className="ds-res-item" key={r.id}>
                  <div className="ds-res-name">{r.name}</div>
                  <div className="ds-res-counter">
                    <button className="ds-res-btn" onClick={() => setResource(r.id, Math.max(0, cur - 1))} disabled={cur === 0}>−</button>
                    <span className="ds-res-val">{cur} / {max}</span>
                    <button className="ds-res-btn" onClick={() => setResource(r.id, Math.min(max, cur + 1))} disabled={cur === max}>+</button>
                  </div>
                  <div className="ds-res-recharge">{rechargeLabel}</div>
                </div>
              );
            }
            if (r.displayType === "pips") {
              const used = max - cur;
              return (
                <div className="ds-res-item" key={r.id}>
                  <div className="ds-res-name">{r.name}</div>
                  <div className="sl-pips" style={{ margin: "6px 0" }}>
                    {Array.from({ length: max }).map((_, i) => (
                      <div
                        key={i}
                        className="ds-sp"
                        data-on={i < used ? "1" : "0"}
                        onClick={() => {
                          const targetUsed = i + 1 === used ? i : i + 1;
                          setResource(r.id, max - targetUsed);
                        }}
                        title={i < used ? "Used — tap to restore" : "Available — tap to spend"}
                      />
                    ))}
                  </div>
                  <div className="ds-res-recharge">{rechargeLabel}</div>
                </div>
              );
            }
            if (r.displayType === "toggle") {
              return (
                <div className="ds-res-item" key={r.id}>
                  <div className="ds-res-name">{r.name}</div>
                  <button
                    className={`ds-btn ds-res-toggle${cur === 0 ? " ds-res-used" : ""}`}
                    onClick={() => setResource(r.id, cur === 0 ? 1 : 0)}
                  >
                    {cur === 0 ? "Used" : "Available"}
                  </button>
                  <div className="ds-res-recharge">{rechargeLabel}</div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  const spellLine = (sp, showPrepare) => {
    const summary = spellSummary(sp);
    const prepared = preparedSpellIds.includes(sp.id);
    const actionable = sp.action && sp.action.type && sp.action.type !== "none";
    const open = openCastSpells.has(sp.id);
    const meta = [sp.castingTime, sp.range, sp.duration].filter(Boolean).join(" · ");
    return (
      <div className="ds-cast-spell" key={sp.id}>
        <div className="ds-cast-row">
          {showPrepare && (
            <button
              className={`ds-prep-toggle${prepared ? " on" : ""}`}
              onClick={() => togglePrepared(sp.id)}
              aria-pressed={prepared}
              title={prepared ? "Prepared — tap to unprepare" : "Tap to prepare"}
            >
              {prepared ? "Prepared" : "Prepare"}
            </button>
          )}
          <button
            className="ds-cast-body"
            onClick={() => toggleCastSpell(sp.id)}
            aria-expanded={open}
            title={open ? "Hide description" : "Show description"}
          >
            <span className="ds-cast-name">{sp.name}</span>
            {summary && <span className="ds-cast-summary">{summary}</span>}
            {actionable && isSpellActive(sp) && <span className="ds-cast-tag">in attacks</span>}
            <span className={`ds-cast-chev${open ? " open" : ""}`} aria-hidden="true">▾</span>
          </button>
        </div>
        {open && (
          <div className="ds-cast-detail">
            {meta && <div className="ds-sb-meta">{meta}</div>}
            <p>{sp.description}</p>
          </div>
        )}
      </div>
    );
  };

  const renderSpellcasting = () => {
    const known = chosenSpellIds.map((id) => spellById[id]).filter(Boolean);
    const knownByLevel = {};
    known.forEach((sp) => { (knownByLevel[sp.level] = knownByLevel[sp.level] || []).push(sp); });
    const cantrips = knownByLevel[0] || [];
    const prepMax = isPrepareCaster ? Math.max(1, mods[spellAbilityKey] + charLevel) : 0;
    const prepCount = preparedSpellIds.filter((id) => (spellById[id]?.level || 0) > 0).length;
    const isWarlock = classDef && classDef.caster === "warlock";
    const pactLevel = isWarlock ? (WARLOCK_SLOTS[lvlClamped] || [0])[0] : 0;
    const levelsToShow = SPELL_LEVELS.filter(
      (l) => (active.spellSlots[l]?.max || 0) > 0 || (knownByLevel[l]?.length)
    );
    return (
      <div className="ds-panel">
        <div className="ds-panel-title">Spellcasting</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <div className="ds-field">
            <label>Casting ability</label>
            <select
              className="ds-select"
              value={active.spellAbility}
              onChange={(e) => patch({ spellAbility: e.target.value })}
            >
              <option value="">— none —</option>
              {ABILITIES.map(([k, full]) => (
                <option key={k} value={k}>{full}</option>
              ))}
            </select>
          </div>
          {spellDC !== null && (
            <>
              <div className="ds-stat" style={{ minWidth: 90 }}>
                <div className="lab">Save DC</div>
                <div className="big" style={{ color: T.violet }}>{spellDC}</div>
              </div>
              <div className="ds-stat" style={{ minWidth: 90 }}>
                <div className="lab">Spell Atk</div>
                <div className="big" style={{ color: T.violet }}>{fmtMod(spellAtk)}</div>
              </div>
            </>
          )}
          {isPrepareCaster && (
            <div className="ds-stat" style={{ minWidth: 90 }}>
              <div className="lab">Prepared</div>
              <div className="big" style={{ color: T.gold }}>{prepCount} / {prepMax}</div>
            </div>
          )}
        </div>

        {isWarlock && (
          <p className="ds-muted" style={{ marginBottom: 12 }}>
            Pact Magic — leveled spells are cast using your level-{pactLevel} pact slot.
          </p>
        )}

        {cantrips.length > 0 && (
          <div className="ds-cast-level">
            <div className="ds-cast-head"><span className="lv">Cantrips</span></div>
            <div className="ds-cast-spells">{cantrips.map((sp) => spellLine(sp, false))}</div>
          </div>
        )}

        {levelsToShow.map((lvl) => {
          const slot = active.spellSlots[lvl];
          const used = slot.max - slot.cur;
          const here = knownByLevel[lvl] || [];
          return (
            <div className="ds-cast-level" key={lvl}>
              <div className="ds-cast-head">
                <span className="lv">Level {lvl}</span>
                <div className="sl-pips">
                  {Array.from({ length: slot.max }).map((_, i) => (
                    <div
                      key={i}
                      className="ds-sp"
                      data-on={i < used ? "1" : "0"}
                      onClick={() => toggleSlot(lvl, i)}
                      title={i < used ? "Used — tap to restore" : "Available — tap to spend"}
                    />
                  ))}
                  {slot.max === 0 && <span className="ds-muted">no slots</span>}
                </div>
                <div className="sl-max">
                  slots
                  <input
                    value={slot.max}
                    inputMode="numeric"
                    onChange={(e) => setSlotMax(lvl, e.target.value)}
                    aria-label={`Level ${lvl} max slots`}
                  />
                </div>
              </div>
              {here.length > 0 && <div className="ds-cast-spells">{here.map((sp) => spellLine(sp, isPrepareCaster))}</div>}
            </div>
          );
        })}

        {known.length === 0 ? (
          <p className="ds-muted" style={{ marginTop: 12 }}>
            Add spells in the Spellbook below — they appear here by level for slot tracking
            {isPrepareCaster ? " and preparation" : ""}.
          </p>
        ) : (
          <p className="ds-muted" style={{ marginTop: 12 }}>
            Tap a circle to spend or restore a slot.{isPrepareCaster ? " Mark spells Prepared to make them castable (they then appear under Attacks)." : " Attack and save spells appear under Attacks above."}
          </p>
        )}
      </div>
    );
  };

  const renderSpellbook = () => {
    if (!classDef || !classDef.caster) return null;
    if (SPELLS.length === 0) {
      return (
        <div className="ds-panel">
          <div className="ds-panel-title">Spellbook</div>
          <p className="ds-muted">No spells loaded. Add entries to <code>public/content/spells/srd.json</code>.</p>
        </div>
      );
    }

    const filledLevels = SPELL_LEVELS.filter(l => (active.spellSlots[l]?.max || 0) > 0);
    const highestSlotLevel = filledLevels.length ? Math.max(...filledLevels) : 0;

    const classSpells = SPELLS.filter(sp =>
      (sp.classes.length === 0 || sp.classes.includes(activeClassId)) &&
      (sp.level === 0 || sp.level <= highestSlotLevel)
    );

    if (classSpells.length === 0) {
      return (
        <div className="ds-panel">
          <div className="ds-panel-title">Spellbook</div>
          <p className="ds-muted">
            {highestSlotLevel === 0
              ? "No spell slots yet — level up or set slot counts above to see available spells."
              : "No spells in the loaded data match this class."}
          </p>
        </div>
      );
    }

    const byLevel = {};
    classSpells.forEach(sp => { (byLevel[sp.level] = byLevel[sp.level] || []).push(sp); });

    const chosenSpells = active.spells || [];
    const toggleSpell = (id) =>
      patch(c => ({
        spells: (c.spells || []).includes(id)
          ? (c.spells || []).filter(s => s !== id)
          : [...(c.spells || []), id],
      }));

    const isPrepare = classDef.learning === "prepare";

    const orderedLevels = [0, ...SPELL_LEVELS].filter(l => byLevel[l]?.length);

    return (
      <div className="ds-panel">
        <button
          type="button"
          className="ds-panel-title ds-panel-toggle"
          style={{ marginBottom: spellbookOpen ? 12 : 0 }}
          onClick={() => setSpellbookOpen(o => !o)}
          aria-expanded={spellbookOpen}
        >
          <span className={`ds-fold-chev${spellbookOpen ? " open" : ""}`} aria-hidden="true">▸</span>
          Spellbook
          <span className="ds-fold-count">{chosenSpells.length}</span>
        </button>
        {spellbookOpen && (<>
        <div style={{ marginBottom: 14, marginTop: -4 }}>
          <span className="ds-muted">{isPrepare ? "Spells in your book" : "Known spells"}</span>
        </div>
        {orderedLevels.map(lvl => (
          <div key={lvl} className="ds-sb-section">
            <div className="ds-sb-lvl-head">{lvl === 0 ? "Cantrips" : `Level ${lvl}`}</div>
            {(byLevel[lvl] || []).map(sp => {
              const chosen = chosenSpells.includes(sp.id);
              const open = openSpell === sp.id;
              const tags = [sp.school];
              if (sp.concentration) tags.push("conc.");
              if (sp.ritual) tags.push("ritual");
              const summary = spellSummary(sp);
              const meta = [sp.castingTime, sp.range, sp.duration].filter(Boolean).join(" · ");
              return (
                <div key={sp.id} className={`ds-sb-row${chosen ? " ds-sb-on" : ""}`}>
                  <button
                    className={`ds-sb-add${chosen ? " on" : ""}`}
                    onClick={() => toggleSpell(sp.id)}
                    aria-pressed={chosen}
                    aria-label={chosen ? `Remove ${sp.name}` : `Add ${sp.name}`}
                    title={chosen ? "Remove from spellbook" : "Add to spellbook"}
                  >
                    {chosen ? "✓" : "+"}
                  </button>
                  <div className="ds-sb-body" onClick={() => setOpenSpell(open ? null : sp.id)}>
                    <div className="ds-sb-line">
                      <span className="ds-sb-name">{sp.name}</span>
                      <span className="ds-sb-tags">{tags.join(" · ")}</span>
                      {summary && <span className="ds-sb-summary">{summary}</span>}
                    </div>
                    {open && (
                      <div className="ds-sb-detail">
                        {meta && <div className="ds-sb-meta">{meta}</div>}
                        <p>{sp.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <p className="ds-muted" style={{ marginTop: 12 }}>
          Tap + to add a spell to your book; tap a row to see what it does. Added spells appear in
          Spellcasting by level{isPrepare ? ", where you prepare them for combat" : ""}.
        </p>
        </>)}
      </div>
    );
  };

  const renderFamiliar = () => {
    const charDC = spellDC != null ? spellDC : 8 + pb;
    if (!fam.enabled) {
      const hasData = (fam.attacks && fam.attacks.length) || fam.name || fam.form;
      return (
        <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
          <div className="ds-panel">
            <div className="ds-panel-title">Familiar</div>
            <p className="ds-muted" style={{ marginBottom: 14 }}>
              No active familiar. With Pact of the Chain you can summon one of the special forms below; any caster with find familiar can also use these.
            </p>
            <div className="ds-add-row">
              {Object.keys(FAMILIAR_FORMS).map((form) => (
                <button key={form} className="ds-btn" onClick={() => summonForm(form)}>
                  {form === "Custom" ? "+ Custom" : `+ ${form}`}
                </button>
              ))}
              {hasData && (
                <button className="ds-btn ds-btn-gold" onClick={resummonFamiliar}>
                  Resummon {fam.name || fam.form}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    const famHpPct = fam.hp.max > 0 ? Math.max(0, Math.min(100, (fam.hp.current / fam.hp.max) * 100)) : 0;
    return (
      <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
        <div className="ds-panel">
          <div className="ds-atk-top">
            <input className="ds-input ds-atk-name" placeholder="Familiar name" value={fam.name} onChange={(e) => setFam("name", e.target.value)} />
            <span className="ds-atk-kind">{fam.form || "familiar"}</span>
            <button className="ds-btn ds-btn-ghost" onClick={dismissFamiliar} style={{ padding: "6px 10px" }}>
              Dismiss
            </button>
          </div>
          <div className="ds-stats" style={{ marginBottom: 12 }}>
            <div className="ds-stat">
              <div className="lab">Armor Class</div>
              <input className="ds-input" value={fam.ac} inputMode="numeric" onChange={(e) => setFam("ac", num(e.target.value))} />
            </div>
            <div className="ds-stat" style={{ gridColumn: "span 2" }}>
              <div className="lab">Hit points</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 }}>
                <input className="ds-input" style={{ width: 56 }} value={fam.hp.current} inputMode="numeric" onChange={(e) => setFamHP("current", num(e.target.value))} />
                <span className="ds-muted">/</span>
                <input className="ds-input" style={{ width: 56 }} value={fam.hp.max} inputMode="numeric" onChange={(e) => setFamHP("max", num(e.target.value))} />
              </div>
            </div>
          </div>
          <div className="ds-hp-bar">
            <div className="ds-hp-fill" style={{ width: famHpPct + "%" }} />
          </div>
          <div className="ds-field" style={{ marginTop: 6 }}>
            <label>Speed</label>
            <input className="ds-input" value={fam.speed} placeholder="e.g. 20 ft, fly 40 ft" onChange={(e) => setFam("speed", e.target.value)} />
          </div>
          <p className="ds-pp-desc">
            Linked to you — proficiency <b>{fmtMod(pb)}</b>, your spell save DC <b>{charDC}</b>.
            {hasInvestment
              ? " Investment of the Chain Master: its attacks are magical and its saves use your DC (already applied below)."
              : " Take Investment of the Chain Master to make its attacks magical and use your save DC."}
          </p>
        </div>

        <div className="ds-panel">
          <div className="ds-panel-title">Familiar attacks</div>
          {(fam.attacks || []).length === 0 && <div className="ds-empty">No attacks yet — add one below.</div>}
          {(fam.attacks || []).map((a) => {
            const r = computeFamiliarAttack(a);
            return (
              <div className="ds-atk" key={a.id}>
                <div className="ds-atk-top">
                  <input className="ds-input ds-atk-name" placeholder="Attack name" value={a.name} onChange={(e) => setFamAttack(a.id, "name", e.target.value)} />
                  <button className="ds-icon-btn" onClick={() => removeFamAttack(a.id)} aria-label="Remove attack">
                    ✕
                  </button>
                </div>
                <div className="ds-atk-result">
                  <div className="ds-atk-stat">
                    <div className="lab">To hit</div>
                    <div className="val">{r.toHit}</div>
                  </div>
                  <div className="ds-atk-stat">
                    <div className="lab">Damage{r.save ? " + save" : ""}</div>
                    <div className="val">{r.damage}</div>
                    {r.save && <div className="src">{r.save} save</div>}
                  </div>
                </div>
                {r.effects.length > 0 && (
                  <ul className="ds-atk-fx">
                    {r.effects.map((fx, i) => (
                      <li key={i}>{fx}</li>
                    ))}
                  </ul>
                )}
                <div className="ds-atk-ctl">
                  {miniNum("To hit ±", a.toHit, (v) => setFamAttack(a.id, "toHit", v))}
                  {miniText("Dice", a.dice, (v) => setFamAttack(a.id, "dice", v), { width: 70, textAlign: "center" })}
                  {miniNum("Bonus dmg", a.bonusDmg, (v) => setFamAttack(a.id, "bonusDmg", v))}
                  {miniText("Type", a.damageType, (v) => setFamAttack(a.id, "damageType", v))}
                  {chip("Magical", a.magical, () => setFamAttack(a.id, "magical", !a.magical))}
                  {chip("Has save", a.hasSave, () => setFamAttack(a.id, "hasSave", !a.hasSave))}
                  {a.hasSave ? miniSel("Save", a.saveAbility || "con", (v) => setFamAttack(a.id, "saveAbility", v), ABILITIES.map(([k, , ab]) => [k, ab])) : null}
                  {a.hasSave ? chip("Use my DC", a.useMyDC, () => setFamAttack(a.id, "useMyDC", !a.useMyDC)) : null}
                  {a.hasSave && !a.useMyDC ? miniNum("Fixed DC", a.fixedDC, (v) => setFamAttack(a.id, "fixedDC", v)) : null}
                  {fxField(a.effect, (v) => setFamAttack(a.id, "effect", v))}
                </div>
              </div>
            );
          })}
          <button className="ds-btn" style={{ marginTop: 6 }} onClick={addFamAttack}>
            + Add familiar attack
          </button>
        </div>

        <div className="ds-panel">
          <div className="ds-panel-title">Familiar notes</div>
          <textarea className="ds-textarea" placeholder="Senses, special abilities, conditions…" value={fam.notes} onChange={(e) => setFam("notes", e.target.value)} />
        </div>
      </div>
    );
  };

  const renderNotes = () => (
    <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
      {traitList.length > 0 && (
        <div className="ds-panel">
          <div className="ds-panel-title">
            {active.race}
            {active.subrace ? ` · ${active.subrace}` : ""} traits
          </div>
          <p className="ds-auto-note">Filled in automatically from your race. Summaries — check your sourcebook for full rules.</p>
          {traitList.map(([name, desc], i) => (
            <div className="ds-feat" key={i}>
              <span className="fn">{name}</span>
              <div className="fd">{desc}</div>
            </div>
          ))}
        </div>
      )}
      {classFeatures.length > 0 && (
        <div className="ds-panel">
          <div className="ds-panel-title">
            {classDef?.name} features · level {charLevel}
          </div>
          <p className="ds-auto-note">Shows the features you've gained so far. Summaries — check your sourcebook for full rules.</p>
          {classFeatures.map((f, i) => (
            <div className="ds-feat" key={i}>
              <span className="fn">{f.name}</span>
              <span className="flv">Lv {f.level}</span>
              <div className="fd">{f.desc}</div>
            </div>
          ))}
        </div>
      )}
      {(classMechanics.includes("patrons") || classMechanics.includes("pacts")) && (
        <div className="ds-panel">
          <div className="ds-panel-title">Patron & Pact</div>
          <div className="ds-id-row" style={{ marginTop: 0 }}>
            <div className="ds-field">
              <label>Otherworldly Patron</label>
              <select className="ds-input" value={active.patron || ""} onChange={(e) => setPatron(e.target.value)}>
                <option value="">— choose —</option>
                {Object.keys(PATRONS).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="ds-field">
              <label>Pact Boon{lvlClamped < 3 ? " (level 3+)" : ""}</label>
              <select
                className="ds-input"
                value={active.pact || ""}
                disabled={lvlClamped < 3}
                onChange={(e) => setPact(e.target.value)}
              >
                <option value="">— choose —</option>
                {Object.keys(PACTS).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {active.patron && PATRONS[active.patron] && (
            <p className="ds-pp-desc">
              <b>{active.patron}:</b> {PATRONS[active.patron]}
            </p>
          )}
          {lvlClamped >= 3 && active.pact && PACTS[active.pact] && (
            <p className="ds-pp-desc">
              <b>{active.pact}:</b> {PACTS[active.pact]}
            </p>
          )}
        </div>
      )}
      {classMechanics.includes("invocations") && (
        <div className="ds-panel">
          <div className="ds-panel-title">Eldritch Invocations</div>
          <p className="ds-auto-note">
            Chosen{" "}
            <span className="ds-count" data-over={invChosen > invKnownAllowed ? "1" : "0"}>
              {invChosen} / {invKnownAllowed}
            </span>{" "}
            known at level {lvlClamped}. Shows invocations available at your level
            {active.pact ? `, matching ${active.pact}` : ""}.
            {hasEldritchAdept ? " Includes +1 from Eldritch Adept." : ""}
          </p>
          {availableInvocations.map((inv) => {
            const on = (active.invocations || []).includes(inv.name);
            return (
              <div
                key={inv.name}
                className="ds-inv"
                data-on={on ? "1" : "0"}
                role="checkbox"
                aria-checked={on}
                tabIndex={0}
                onClick={() => toggleInvocation(inv.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleInvocation(inv.name);
                  }
                }}
              >
                <div className="ds-inv-check">{on ? "✓" : ""}</div>
                <div>
                  <div className="ds-inv-name">
                    {inv.name}
                    {inv.level > 1 && <span className="ds-inv-lv">Lv {inv.level}</span>}
                    {inv.prereq && <span className="ds-inv-tag">{inv.prereq}</span>}
                  </div>
                  <div className="ds-inv-desc">{inv.desc}</div>
                </div>
              </div>
            );
          })}
          {orphanInvocations.length > 0 && (
            <>
              <p className="ds-muted" style={{ marginTop: 10 }}>
                Selected but unavailable now (level or pact changed) — tap to remove:
              </p>
              {orphanInvocations.map((name) => (
                <div
                  key={name}
                  className="ds-inv"
                  data-on="1"
                  style={{ opacity: 0.7 }}
                  role="checkbox"
                  aria-checked={true}
                  tabIndex={0}
                  onClick={() => toggleInvocation(name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleInvocation(name);
                    }
                  }}
                >
                  <div className="ds-inv-check">✓</div>
                  <div>
                    <div className="ds-inv-name">
                      {name}
                      <span className="ds-inv-lv">unavailable</span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          {lockedInvCount > 0 && (
            <p className="ds-muted" style={{ marginTop: 4 }}>
              {lockedInvCount} more become available at higher levels or with a different pact.
            </p>
          )}
        </div>
      )}
      <div className="ds-panel">
        <div className="ds-panel-title">Feats</div>
        <div className="ds-feat-add">
          <select className="ds-input" value="" onChange={(e) => addFeat(e.target.value)}>
            <option value="">+ Add a feat…</option>
            <option value="__custom">Custom feat (blank)</option>
            {Object.keys(FEATS).sort().map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {(active.feats || []).length === 0 && (
          <div className="ds-empty">No feats yet — pick one above, or add a custom entry.</div>
        )}
        {(active.feats || []).map((f) => (
          <div className="ds-feat-item" key={f.id}>
            <div className="ds-feat-head">
              <input
                className="ds-input fname"
                value={f.name}
                placeholder="Feat name"
                onChange={(e) => setFeat(f.id, "name", e.target.value)}
              />
              <button className="ds-icon-btn" onClick={() => removeFeat(f.id)} aria-label="Remove feat">
                ✕
              </button>
            </div>
            <textarea
              className="ds-textarea fdesc"
              value={f.desc}
              placeholder="What it does…"
              onChange={(e) => setFeat(f.id, "desc", e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="ds-panel">
        <div className="ds-panel-title">Other features & notes</div>
        <textarea
          className="ds-textarea"
          placeholder="Feats, subclass features, anything to track yourself…"
          value={active.features}
          onChange={(e) => patch({ features: e.target.value })}
        />
      </div>
      <div className="ds-panel">
        <div className="ds-panel-title">Equipment & treasure</div>
        <textarea
          className="ds-textarea"
          placeholder="Weapons, armor, gear, coin…"
          value={active.equipment}
          onChange={(e) => patch({ equipment: e.target.value })}
        />
      </div>
      <div className="ds-panel">
        <div className="ds-panel-title">Backstory & notes</div>
        <textarea
          className="ds-textarea"
          placeholder="Personality, bonds, ideals, flaws, session notes…"
          value={active.bio}
          onChange={(e) => patch({ bio: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className="ds-root">
      <style>{CSS}</style>
      {renderTop()}
      <div className="ds-wrap">
        {renderTabs()}

        {tab === "core" && (
          <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
            {renderIdentity()}
            {renderCombatStats()}
            <div
              className="ds-grid"
              style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", marginTop: 0 }}
            >
              {renderHP()}
              {renderAbilities()}
            </div>
            {renderSaves()}
          </div>
        )}

        {tab === "skills" && <div className="ds-grid" style={{ gridTemplateColumns: "1fr" }}>{renderSkills()}</div>}

        {tab === "magic" && (
          <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
            {renderResources()}
            {renderAttacks()}
            {renderSpellcasting()}
            {renderSpellbook()}
          </div>
        )}

        {tab === "familiar" && renderFamiliar()}

        {tab === "notes" && renderNotes()}

        {!hasStorage && (
          <p className="ds-muted" style={{ textAlign: "center", marginTop: 24 }}>
            Note: persistent saving isn't available here, so changes last only for this session.
          </p>
        )}
      </div>
      {showData && (
        <div className="ds-modal-bg" onClick={() => setShowData(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-head">
              <div className="ds-panel-title" style={{ margin: 0 }}>
                Save · Export · Import
              </div>
              <button className="ds-icon-btn" onClick={() => setShowData(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="ds-muted">
              Characters save automatically on this device. Export to keep a backup or move them to another device.
            </p>

            <div className="ds-modal-sec">
              <div className="ds-sec-label">Export</div>
              <div className="ds-btn-row">
                <button className="ds-btn ds-btn-gold" onClick={exportOne}>
                  Download this character
                </button>
                <button className="ds-btn" onClick={exportAll}>
                  Download all ({characters.length})
                </button>
                <button className="ds-btn ds-btn-ghost" onClick={() => copyText(JSON.stringify(active, null, 2))}>
                  Copy
                </button>
              </div>
              <textarea
                className="ds-textarea"
                readOnly
                style={{ minHeight: 90, marginTop: 10, fontSize: 12 }}
                value={JSON.stringify(active, null, 2)}
                onClick={(e) => e.target.select()}
              />
            </div>

            <div className="ds-modal-sec">
              <div className="ds-sec-label">Import</div>
              <label className="ds-btn ds-btn-gold">
                Choose a .json file
                <input
                  type="file"
                  accept="application/json,.json"
                  style={{ display: "none" }}
                  onChange={onImportFile}
                />
              </label>
              <p className="ds-muted" style={{ margin: "12px 0 6px" }}>
                …or paste exported text:
              </p>
              <textarea
                className="ds-textarea"
                style={{ minHeight: 90, fontSize: 12 }}
                value={importBuf}
                placeholder='Paste a character or backup, e.g. {"name":"Hilda", ...}'
                onChange={(e) => setImportBuf(e.target.value)}
              />
              <button className="ds-btn ds-btn-gold" style={{ marginTop: 8 }} onClick={() => importText(importBuf)}>
                Import from text
              </button>
              <p className="ds-muted" style={{ marginTop: 8 }}>
                Imports are added as new characters — they never overwrite your existing ones.
              </p>
            </div>
          </div>
        </div>
      )}
      {showContent && (
        <div className="ds-modal-bg" onClick={() => setShowContent(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-head">
              <div className="ds-panel-title" style={{ margin: 0 }}>
                Your content
              </div>
              <button className="ds-icon-btn" onClick={() => setShowContent(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="ds-muted">
              Add homebrew as JSON — an array of entries, each with an <code>id</code> and{" "}
              <code>name</code>. An entry overrides built-in content when it shares an id. Stored in this
              browser only.
            </p>
            {typeof indexedDB === "undefined" && (
              <p className="ds-muted" style={{ color: T.violet }}>
                Storage isn't available here, so additions will only last for this session.
              </p>
            )}

            <div className="ds-modal-sec">
              <div className="ds-sec-label">Add content</div>
              <div className="ds-field">
                <label>Content type</label>
                <select className="ds-select" value={contentType} onChange={(e) => setContentType(e.target.value)}>
                  {CONTENT_TYPES.map(([t, label]) => (
                    <option key={t} value={t}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="ds-btn ds-btn-gold" style={{ marginTop: 10 }}>
                Choose a .json file
                <input
                  type="file"
                  accept="application/json,.json"
                  style={{ display: "none" }}
                  onChange={onContentFile}
                />
              </label>
              <p className="ds-muted" style={{ margin: "12px 0 6px" }}>
                …or paste JSON:
              </p>
              <textarea
                className="ds-textarea"
                style={{ minHeight: 110, fontSize: 12 }}
                value={contentBuf}
                placeholder={'[{"id":"my-spell","name":"My Spell", ...}]'}
                onChange={(e) => setContentBuf(e.target.value)}
              />
              <button
                className="ds-btn ds-btn-gold"
                style={{ marginTop: 8 }}
                onClick={() => addUserContent(`pasted-${uid()}.json`, contentBuf)}
              >
                Add from text
              </button>
            </div>

            <div className="ds-modal-sec">
              <div className="ds-sec-label">Loaded files</div>
              {CONTENT_TYPES.every(([t]) => !(userFiles[t] && userFiles[t].length)) ? (
                <p className="ds-muted">No homebrew loaded yet.</p>
              ) : (
                CONTENT_TYPES.map(([t, label]) => {
                  const files = userFiles[t] || [];
                  if (!files.length) return null;
                  return (
                    <div key={t} style={{ marginBottom: 10 }}>
                      <div className="ds-muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        {label}
                      </div>
                      {files.map((f) => (
                        <div className="ds-userfile" key={f.name}>
                          <span className="ds-userfile-name">{f.name}</span>
                          <span className="ds-userfile-count">
                            {(f.items || []).length} entr{(f.items || []).length === 1 ? "y" : "ies"}
                          </span>
                          <button className="ds-icon-btn" onClick={() => removeUserContent(t, f.name)} aria-label="Remove">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {toast && <div className="ds-toast">{toast.text}</div>}
    </div>
  );
}
