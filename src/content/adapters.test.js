import { describe, it, expect } from "vitest";
import { adaptClasses, adaptSpells, adaptRaces } from "./adapters.js";

describe("adaptClasses", () => {
  it("flattens spellcasting and keys by id", () => {
    const out = adaptClasses([
      { id: "wizard", name: "Wizard", hitDie: 6, savingThrows: ["int", "wis"], spellcasting: { ability: "int", type: "full", learningType: "prepare" }, features: [{ level: 1, name: "Spellcasting", description: "..." }], resources: [], mechanics: [] },
    ]);
    expect(out.wizard).toMatchObject({
      name: "Wizard", hitDie: 6, saves: ["int", "wis"],
      spellAbility: "int", caster: "full", learning: "prepare",
      features: [{ level: 1, name: "Spellcasting", desc: "..." }],
    });
  });
  it("defaults non-casters to null caster/learning and empty ability", () => {
    const out = adaptClasses([{ id: "fighter", name: "Fighter", hitDie: 10 }]);
    expect(out.fighter).toMatchObject({ caster: null, learning: null, spellAbility: "" });
  });
});

describe("adaptSpells", () => {
  it("fills defaults and passes action through verbatim", () => {
    const [s] = adaptSpells([{ id: "x", name: "X", action: { type: "save", damage: "8d6" } }]);
    expect(s).toMatchObject({ id: "x", name: "X", level: 0, school: "", concentration: false, classes: [] });
    expect(s.action).toEqual({ type: "save", damage: "8d6" });
  });
  it("normalizes a spell with no action to action:null", () => {
    expect(adaptSpells([{ id: "y", name: "Y" }])[0].action).toBeNull();
  });
});

describe("adaptRaces", () => {
  it("keys by name and folds subraces", () => {
    const out = adaptRaces([
      { name: "Elf", abilityBonuses: { dex: 2 }, speed: 30, size: "Medium", traits: [{ name: "Keen Senses", description: "d" }], subraces: [{ name: "High Elf", abilityBonuses: { int: 1 }, traits: [] }] },
    ]);
    expect(out.Elf.asi).toEqual({ dex: 2 });
    expect(out.Elf.traits).toEqual([["Keen Senses", "d"]]);
    expect(out.Elf.subraces["High Elf"].asi).toEqual({ int: 1 });
  });
});
