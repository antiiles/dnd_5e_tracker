// Pure math/format/dice helpers. No framework, no app state.

export const uid = () => Math.random().toString(36).slice(2, 9);

export const num = (v, d = 0) => {
  if (v === "" || v === null || v === undefined) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export const abilityMod = (score) => Math.floor((num(score, 10) - 10) / 2);
export const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (level) => Math.ceil(num(level, 1) / 4) + 1; // 1–4:+2, 5–8:+3 ... 17–20:+6
export const fmtFlat = (n) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "");

// Cantrip damage/beams scale at character levels 5/11/17.
export const cantripMult = (lvl) => (lvl >= 17 ? 4 : lvl >= 11 ? 3 : lvl >= 5 ? 2 : 1);

export const scaleDice = (dice, factor) => {
  const m = /^(\d+)d(\d+)$/.exec(String(dice || "").trim());
  if (!m || factor <= 1) return dice || "";
  return `${parseInt(m[1], 10) * factor}d${m[2]}`;
};

// Upcasting: add `perLevel` dice for each slot level a leveled spell is cast above its base.
export const addDicePerLevel = (base, perLevel, extraLevels) => {
  if (extraLevels <= 0 || !perLevel) return base || "";
  const b = /^(\d+)d(\d+)$/.exec(String(base || "").trim());
  const h = /^(\d+)d(\d+)$/.exec(String(perLevel).trim());
  if (!b || !h) return base || "";
  const addN = parseInt(h[1], 10) * extraLevels;
  if (h[2] === b[2]) return `${parseInt(b[1], 10) + addN}d${b[2]}`; // same die: merge counts
  return `${base} + ${addN}d${h[2]}`; // mixed dice: append as a second term
};
