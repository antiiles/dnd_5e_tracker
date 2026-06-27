import { describe, it, expect } from "vitest";
import { spellToAttack, computeSpellCard, spellSummary, isSpellActive } from "./spells.js";

// Level 5 caster, prof +3, CHA mod +4.
const ctx = {
  spellAbility: "cha",
  spellAbilityKey: "cha",
  mods: { str: 3, dex: 2, con: 1, int: 0, wis: 0, cha: 4 },
  charLevel: 5,
  pb: 3,
  invocations: [],
  isPrepareCaster: false,
  preparedSpellIds: [],
};

const fireball = { id: "fireball", name: "Fireball", level: 3, description: "Boom", action: { type: "save", save: "dex", damage: "8d6", damageType: "fire", higherLevel: "1d6" } };
const cure = { id: "cure", name: "Cure Wounds", level: 1, description: "Heal", action: { type: "heal", damage: "1d8", addSpellMod: true, higherLevel: "1d8" } };
const magicMissile = { id: "mm", name: "Magic Missile", level: 1, action: { type: "auto", instances: 3, damage: "1d4", instanceBonus: 1, higherLevelInstances: 1 } };
const scorchingRay = { id: "sr", name: "Scorching Ray", level: 2, action: { type: "attack", instances: 3, higherLevelInstances: 1, damage: "2d6", damageType: "fire" } };

describe("spellToAttack", () => {
  it("maps a save spell at its base level", () => {
    const a = spellToAttack(fireball, undefined, ctx);
    expect(a).toMatchObject({ kind: "spell", mode: "save", saveAbility: "dex", dice: "8d6", damageType: "fire" });
  });
  it("upcasts flat dice when cast above base", () => {
    expect(spellToAttack(fireball, 5, ctx).dice).toBe("10d6"); // +2 slots × 1d6
  });
  it("special-cases eldritch blast", () => {
    const a = spellToAttack({ id: "eldritch-blast", name: "Eldritch Blast", level: 0 }, undefined, ctx);
    expect(a.eldritchBlast).toBe(true);
  });
});

describe("computeSpellCard", () => {
  it("heal spell adds the spell mod and upcasts", () => {
    expect(computeSpellCard(cure, undefined, ctx).heal).toBe("1d8+4");
    expect(computeSpellCard(cure, 3, ctx).heal).toBe("3d8+4"); // +2 slots × 1d8
  });
  it("auto spell (Magic Missile) multiplies instances and bonus", () => {
    expect(computeSpellCard(magicMissile, undefined, ctx)).toMatchObject({ toHit: "Auto", damage: "3d4+3" });
    expect(computeSpellCard(magicMissile, 3, ctx).damage).toBe("5d4+5"); // 5 darts
  });
  it("multi-attack spell (Scorching Ray) renders per-beam", () => {
    const r = computeSpellCard(scorchingRay, undefined, ctx);
    expect(r).toMatchObject({ perBeam: true, beams: 3, toHit: "+7", damage: "2d6 fire" });
  });
  it("falls back to the attack engine for plain save spells", () => {
    const r = computeSpellCard(fireball, undefined, ctx);
    expect(r.save).toBe("DC 15 DEX");
    expect(r.effects).toContain("Boom");
  });
});

describe("spellSummary", () => {
  it("summarizes by action type", () => {
    expect(spellSummary(cure, ctx)).toBe("Heals 1d8+4");
    expect(spellSummary(magicMissile, ctx)).toBe("Auto · 3d4+3");
    expect(spellSummary(fireball, ctx)).toBe("DC 15 DEX · 8d6 fire");
  });
  it("returns null for non-actionable spells", () => {
    expect(spellSummary({ id: "x", name: "X", level: 1, action: null }, ctx)).toBeNull();
  });
});

describe("isSpellActive", () => {
  it("cantrips are always active", () => {
    expect(isSpellActive({ id: "c", level: 0 }, ctx)).toBe(true);
  });
  it("known casters can cast any known spell", () => {
    expect(isSpellActive({ id: "fireball", level: 3 }, ctx)).toBe(true);
  });
  it("prepare casters need the spell prepared", () => {
    const prep = { ...ctx, isPrepareCaster: true, preparedSpellIds: ["fireball"] };
    expect(isSpellActive({ id: "fireball", level: 3 }, prep)).toBe(true);
    expect(isSpellActive({ id: "other", level: 3 }, prep)).toBe(false);
  });
});
