import { describe, it, expect } from "vitest";
import { computeAttack } from "./attacks.js";

// Level 5 caster, prof +3, CHA mod +4, STR mod +3, DEX mod +2.
const ctx = {
  spellAbility: "cha",
  spellAbilityKey: "cha",
  mods: { str: 3, dex: 2, con: 1, int: 0, wis: 0, cha: 4 },
  charLevel: 5,
  pb: 3,
  invocations: [],
};

describe("computeAttack — weapons", () => {
  it("adds ability + proficiency to hit and ability to damage", () => {
    const r = computeAttack(
      { kind: "weapon", name: "Longsword", dice: "1d8", damageType: "slashing", ability: "str", proficient: true, addMod: true, magic: 0, bonusDmg: 0, props: [] },
      ctx
    );
    expect(r.toHit).toBe("+6"); // STR 3 + prof 3
    expect(r.damage).toBe("1d8+3 slashing");
  });
  it("uses versatile dice when two-handed", () => {
    const r = computeAttack(
      { kind: "weapon", name: "Longsword", dice: "1d8", versatile: "1d10", twoHanded: true, damageType: "slashing", ability: "str", proficient: true, addMod: true, props: [] },
      ctx
    );
    expect(r.damage).toBe("1d10+3 slashing");
  });
});

describe("computeAttack — spells", () => {
  it("attack-roll spell uses spell ability + proficiency", () => {
    const r = computeAttack({ kind: "spell", mode: "attack", dice: "3d6", damageType: "fire", addMod: false, magic: 0, bonusDmg: 0 }, ctx);
    expect(r.toHit).toBe("+7"); // CHA 4 + prof 3
    expect(r.damage).toBe("3d6 fire");
  });
  it("save spell computes a DC", () => {
    const r = computeAttack({ kind: "spell", mode: "save", saveAbility: "dex", dice: "8d6", damageType: "fire" }, ctx);
    expect(r.save).toBe("DC 15 DEX"); // 8 + prof 3 + CHA 4
    expect(r.damage).toBe("8d6 fire");
  });
});

describe("computeAttack — eldritch blast", () => {
  it("scales beams by character level, no Agonizing damage by default", () => {
    const r = computeAttack({ kind: "spell", eldritchBlast: true, dice: "1d10", damageType: "force", addMod: false, bonusDmg: 0 }, ctx);
    expect(r.beams).toBe(2); // level 5
    expect(r.perBeam).toBe(true);
    expect(r.damage).toBe("1d10 force");
  });
  it("Agonizing Blast adds the spell mod to each beam", () => {
    const r = computeAttack(
      { kind: "spell", eldritchBlast: true, dice: "1d10", damageType: "force", addMod: false, bonusDmg: 0 },
      { ...ctx, invocations: ["Agonizing Blast"] }
    );
    expect(r.damage).toBe("1d10+4 force");
  });
});

describe("computeAttack — manual", () => {
  it("passes the raw fields straight through", () => {
    const r = computeAttack({ kind: "manual", toHit: "+5", damage: "2d6", effect: "burns" }, ctx);
    expect(r).toMatchObject({ manual: true, toHit: "+5", damage: "2d6", effects: ["burns"] });
  });
});
