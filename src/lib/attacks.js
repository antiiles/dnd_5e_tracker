// Attack to-hit / damage engine. Pure: all character-derived inputs arrive via `ctx`.
//
// ctx shape (built once per render from the active character):
//   { spellAbility, mods, charLevel, pb, invocations }
import { num, fmtMod, fmtFlat } from "./helpers.js";

// Compute to-hit / damage breakdown for an attack.
export function computeAttack(a, ctx) {
  const { mods, charLevel, pb, invocations = [] } = ctx;
  const sp = ctx.spellAbility || "cha";
  if (a.kind === "manual") {
    return { manual: true, toHit: a.toHit || "—", damage: a.damage || "—", effects: a.effect ? [a.effect] : [] };
  }
  if (a.kind === "spell") {
    const smod = mods[sp];
    const magic = num(a.magic);
    if (a.eldritchBlast) {
      const beams = charLevel >= 17 ? 4 : charLevel >= 11 ? 3 : charLevel >= 5 ? 2 : 1;
      const ag = invocations.includes("Agonizing Blast");
      const rep = invocations.includes("Repelling Blast");
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
}
