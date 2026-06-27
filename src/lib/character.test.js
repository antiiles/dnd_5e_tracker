import { describe, it, expect } from "vitest";
import { makeCharacter, normalizeAttack, hydrateCharacter, charactersFromImport } from "./character.js";

describe("makeCharacter", () => {
  it("builds the agreed default shape", () => {
    const c = makeCharacter("Bob");
    expect(c.name).toBe("Bob");
    expect(typeof c.id).toBe("string");
    expect(c.classes).toEqual([{ id: "", level: 1 }]);
    expect(c.abilities).toEqual({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    expect(c.hp).toEqual({ current: 10, max: 10, temp: 0 });
    expect(c.hitDice).toEqual({ total: 1, remaining: 1, dieType: 8 });
    expect(c.concentration).toBeNull();
    expect(c.spells).toEqual([]);
    expect(c.preparedSpells).toEqual([]);
  });
});

describe("normalizeAttack", () => {
  it("migrates the legacy {name,bonus,dmg,notes} shape to a manual attack", () => {
    const a = normalizeAttack({ name: "Club", bonus: "+3", dmg: "1d4", notes: "x" });
    expect(a).toMatchObject({ kind: "manual", name: "Club", toHit: "+3", damage: "1d4", effect: "x" });
    expect(typeof a.id).toBe("string");
  });
  it("passes through an already-structured attack untouched", () => {
    const structured = { id: "z", kind: "weapon", name: "Sword" };
    expect(normalizeAttack(structured)).toBe(structured);
  });
  it("returns null for junk", () => {
    expect(normalizeAttack(null)).toBeNull();
    expect(normalizeAttack(42)).toBeNull();
  });
});

describe("hydrateCharacter", () => {
  it("still merges abilities from a legacy character", () => {
    const c = hydrateCharacter({ cls: "Wizard", level: 3, abilities: { int: 16 } });
    expect(c.abilities.int).toBe(16);
    expect(c.abilities.str).toBe(10); // filled from defaults
  });
  // KNOWN LATENT BUG (pre-existing, preserved here as characterization): the legacy
  // cls/level → classes migration never fires, because makeCharacter() seeds a non-empty
  // `classes` array that the {...base, ...raw} spread keeps, so the length===0 guard is
  // false. A legacy import therefore loses its class. Fixing this is out of scope for the
  // extraction refactor — see the conversation notes.
  it("does NOT currently migrate legacy cls/level (documents the latent bug)", () => {
    const c = hydrateCharacter({ cls: "Wizard", level: 3 });
    expect(c.classes).toEqual([{ id: "", level: 1 }]);
  });
  it("migrates legacy hitDice {cur,max,die} into {total,remaining,dieType}", () => {
    const c = hydrateCharacter({ name: "X", hitDice: { cur: 2, max: 5, die: "d10" } });
    expect(c.hitDice).toEqual({ total: 5, remaining: 2, dieType: 10 });
  });
  it("preserves a modern classes array", () => {
    const c = hydrateCharacter({ classes: [{ id: "fighter", level: 5 }] });
    expect(c.classes).toEqual([{ id: "fighter", level: 5 }]);
  });
  it("returns null for junk", () => {
    expect(hydrateCharacter(null)).toBeNull();
  });
});

describe("charactersFromImport", () => {
  it("accepts a bare array", () => {
    expect(charactersFromImport([{ abilities: {} }])).toHaveLength(1);
  });
  it("accepts a { characters: [...] } wrapper", () => {
    expect(charactersFromImport({ characters: [{ abilities: {} }, { abilities: {} }] })).toHaveLength(2);
  });
  it("accepts a single character object (has abilities)", () => {
    expect(charactersFromImport({ abilities: {}, name: "Solo" })).toHaveLength(1);
  });
  it("returns [] for unsupported shapes", () => {
    expect(charactersFromImport(null)).toEqual([]);
    expect(charactersFromImport({ nope: true })).toEqual([]);
  });
});
