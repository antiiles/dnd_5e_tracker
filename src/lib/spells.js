// Spell → action integration. Pure: character-derived inputs arrive via `ctx`.
//
// ctx shape (built once per render from the active character):
//   { spellAbilityKey, mods, charLevel, pb, isPrepareCaster, preparedSpellIds, ...computeAttack ctx }
import { num, fmtMod, fmtFlat, cantripMult, scaleDice, addDicePerLevel } from "./helpers.js";
import { computeAttack } from "./attacks.js";

// Map a chosen spell into the attack shape computeAttack consumes (attack/save only).
export function spellToAttack(spell, castLevel, ctx) {
  const { charLevel } = ctx;
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
}

// Result object (same shape as computeAttack) for any actionable spell, incl. healing.
export function computeSpellCard(spell, castLevel, ctx) {
  const { mods, spellAbilityKey, charLevel, pb } = ctx;
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
  const r = computeAttack(spellToAttack(spell, lvl, ctx), ctx);
  return { ...r, effects };
}

// Short one-line summary of a spell's mechanics (for the spellbook list).
export function spellSummary(spell, ctx) {
  const act = spell.action;
  if (!act || !act.type || act.type === "none") return null;
  const r = computeSpellCard(spell, undefined, ctx);
  if (act.type === "heal") return `Heals ${r.heal}`;
  if (act.type === "auto") return `Auto · ${r.damage}`;
  if (r.save) return r.damage && r.damage !== "—" ? `${r.save} · ${r.damage}` : r.save;
  const hit = r.perBeam ? `${r.toHit} ea. beam` : `${r.toHit} to hit`;
  return `${hit} · ${r.damage}`;
}

// A spell is castable now: cantrips always; prepared casters need it prepared; known casters always.
export function isSpellActive(sp, ctx) {
  const { isPrepareCaster, preparedSpellIds } = ctx;
  if (!sp) return false;
  if (sp.level === 0) return true;
  if (isPrepareCaster) return preparedSpellIds.includes(sp.id);
  return true;
}
