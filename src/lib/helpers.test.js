import { describe, it, expect } from "vitest";
import { num, abilityMod, fmtMod, profBonus, fmtFlat, cantripMult, scaleDice, addDicePerLevel } from "./helpers.js";

describe("num", () => {
  it("returns default for empty/null/undefined", () => {
    expect(num("", 5)).toBe(5);
    expect(num(null, 7)).toBe(7);
    expect(num(undefined, 9)).toBe(9);
  });
  it("parses finite numbers, falls back otherwise", () => {
    expect(num("3")).toBe(3);
    expect(num(4)).toBe(4);
    expect(num("abc", 2)).toBe(2);
  });
});

describe("abilityMod", () => {
  it("matches 5e modifier math", () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(14)).toBe(2);
    expect(abilityMod(7)).toBe(-2);
    expect(abilityMod(20)).toBe(5);
    expect(abilityMod(8)).toBe(-1);
  });
});

describe("fmtMod / fmtFlat", () => {
  it("fmtMod always shows a sign, including +0", () => {
    expect(fmtMod(3)).toBe("+3");
    expect(fmtMod(0)).toBe("+0");
    expect(fmtMod(-2)).toBe("-2");
  });
  it("fmtFlat hides zero", () => {
    expect(fmtFlat(3)).toBe("+3");
    expect(fmtFlat(0)).toBe("");
    expect(fmtFlat(-1)).toBe("-1");
  });
});

describe("profBonus", () => {
  it("steps every 4 levels", () => {
    expect(profBonus(1)).toBe(2);
    expect(profBonus(4)).toBe(2);
    expect(profBonus(5)).toBe(3);
    expect(profBonus(17)).toBe(6);
    expect(profBonus(20)).toBe(6);
  });
});

describe("cantripMult", () => {
  it("scales at 5/11/17", () => {
    expect(cantripMult(1)).toBe(1);
    expect(cantripMult(4)).toBe(1);
    expect(cantripMult(5)).toBe(2);
    expect(cantripMult(11)).toBe(3);
    expect(cantripMult(17)).toBe(4);
  });
});

describe("scaleDice", () => {
  it("multiplies the dice count", () => {
    expect(scaleDice("1d10", 2)).toBe("2d10");
    expect(scaleDice("2d6", 3)).toBe("6d6");
  });
  it("returns input unchanged for factor<=1 or non-matching strings", () => {
    expect(scaleDice("1d10", 1)).toBe("1d10");
    expect(scaleDice("1d4+1", 2)).toBe("1d4+1");
    expect(scaleDice("", 2)).toBe("");
  });
});

describe("addDicePerLevel", () => {
  it("merges counts for same die size", () => {
    expect(addDicePerLevel("8d6", "1d6", 2)).toBe("10d6");
  });
  it("appends a term for mixed dice", () => {
    expect(addDicePerLevel("2d6", "1d8", 1)).toBe("2d6 + 1d8");
  });
  it("returns base when nothing to add", () => {
    expect(addDicePerLevel("8d6", "1d6", 0)).toBe("8d6");
    expect(addDicePerLevel("1d8", null, 2)).toBe("1d8");
  });
});
