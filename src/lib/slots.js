// Spell-slot progressions and warlock-specific rules-as-data. Pure.
import { SPELL_LEVELS } from "./constants.js";
import { num } from "./helpers.js";

// Spell slot progressions (index by character level → [1st..9th])
export const FULL_SLOTS = {
  1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1],
  8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1], 19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};
export const HALF_SLOTS = {
  2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3], 9: [4, 3, 2], 10: [4, 3, 2],
  11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1], 14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2],
  17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
};
// Warlock pact magic: [slotLevel, count]
export const WARLOCK_SLOTS = {
  1: [1, 1], 2: [1, 2], 3: [2, 2], 4: [2, 2], 5: [3, 2], 6: [3, 2], 7: [4, 2], 8: [4, 2],
  9: [5, 2], 10: [5, 2], 11: [5, 3], 12: [5, 3], 13: [5, 3], 14: [5, 3], 15: [5, 3], 16: [5, 3],
  17: [5, 4], 18: [5, 4], 19: [5, 4], 20: [5, 4],
};
// Third-caster (Eldritch Knight / Arcane Trickster subclasses); slots start at class level 3
export const THIRD_SLOTS = {
  3: [2], 4: [3], 5: [3], 6: [3], 7: [4, 2], 8: [4, 2], 9: [4, 2],
  10: [4, 3], 11: [4, 3], 12: [4, 3], 13: [4, 3, 2], 14: [4, 3, 2],
  15: [4, 3, 2], 16: [4, 3, 3], 17: [4, 3, 3], 18: [4, 3, 3],
  19: [4, 3, 3, 1], 20: [4, 3, 3, 1],
};

// How many Eldritch Invocations a warlock knows at each level
export const WARLOCK_INV_KNOWN = {
  1: 0, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5,
  11: 5, 12: 6, 13: 6, 14: 6, 15: 7, 16: 7, 17: 7, 18: 8, 19: 8, 20: 8,
};

export const isPactPrereq = (p) => typeof p === "string" && p.startsWith("Pact of");

// Pact of the Chain familiar forms (standard stat blocks; values are editable).
export const FAMILIAR_FORMS = {
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

export function emptySlots() {
  const s = {};
  SPELL_LEVELS.forEach((l) => (s[l] = { cur: 0, max: 0 }));
  return s;
}

// Build a fresh slot object for a class + level, fully rested
export function slotsFor(caster, level) {
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
