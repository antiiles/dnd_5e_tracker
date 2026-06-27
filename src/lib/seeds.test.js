import { describe, it, expect } from "vitest";
import { seedCharacters } from "./seeds.js";
import spellsData from "../../public/content/spells/srd.json";
import classesData from "../../public/content/classes/srd.json";
import racesData from "../../public/content/races/srd.json";

const spellIds = new Set(spellsData.map((s) => s.id));
const classIds = new Set(classesData.map((c) => c.id));
const racesByName = Object.fromEntries(racesData.map((r) => [r.name, r]));

const seeds = seedCharacters();
const byClass = Object.fromEntries(seeds.map((c) => [c.classes[0].id, c]));

describe("seedCharacters", () => {
  it("returns a warlock, a wizard, and a bard at level 5", () => {
    expect(seeds).toHaveLength(3);
    expect(Object.keys(byClass).sort()).toEqual(["bard", "warlock", "wizard"]);
    seeds.forEach((c) => expect(c.classes[0].level).toBe(5));
  });

  it("gives every seed a unique id and a name", () => {
    const ids = seeds.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
    seeds.forEach((c) => expect(c.name.trim().length).toBeGreaterThan(0));
  });

  it("references only real class ids", () => {
    seeds.forEach((c) => expect(classIds.has(c.classes[0].id)).toBe(true));
  });

  it("references only real race/subrace names", () => {
    seeds.forEach((c) => {
      const race = racesByName[c.race];
      expect(race, `unknown race ${c.race}`).toBeTruthy();
      if (c.subrace) {
        const subNames = (race.subraces || []).map((s) => s.name);
        expect(subNames, `unknown subrace ${c.subrace} for ${c.race}`).toContain(c.subrace);
      }
    });
  });

  it("references only real spell ids, and prepared ⊆ known", () => {
    seeds.forEach((c) => {
      expect(c.spells.length).toBeGreaterThan(0);
      c.spells.forEach((id) => expect(spellIds.has(id), `unknown spell ${id}`).toBe(true));
      (c.preparedSpells || []).forEach((id) => expect(c.spells.includes(id), `prepared ${id} not in spellbook`).toBe(true));
    });
  });

  it("sets the spellcasting ability that matches the class", () => {
    expect(byClass.warlock.spellAbility).toBe("cha");
    expect(byClass.wizard.spellAbility).toBe("int");
    expect(byClass.bard.spellAbility).toBe("cha");
  });

  it("only the prepare caster (wizard) carries a prepared list", () => {
    expect(byClass.wizard.preparedSpells.length).toBeGreaterThan(0);
    expect(byClass.bard.preparedSpells).toEqual([]);
    expect(byClass.warlock.preparedSpells).toEqual([]);
  });
});
