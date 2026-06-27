import { describe, it, expect } from "vitest";
import { slotsFor, emptySlots } from "./slots.js";

describe("emptySlots", () => {
  it("has all 9 levels zeroed", () => {
    const s = emptySlots();
    expect(Object.keys(s)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(s[1]).toEqual({ cur: 0, max: 0 });
    expect(s[9]).toEqual({ cur: 0, max: 0 });
  });
});

describe("slotsFor", () => {
  it("full caster level 1 → one 1st-level slot pair, refilled", () => {
    const s = slotsFor("full", 1);
    expect(s[1]).toEqual({ cur: 2, max: 2 });
    expect(s[2]).toEqual({ cur: 0, max: 0 });
  });
  it("full caster level 5 → 4/3/2", () => {
    const s = slotsFor("full", 5);
    expect(s[1]).toEqual({ cur: 4, max: 4 });
    expect(s[2]).toEqual({ cur: 3, max: 3 });
    expect(s[3]).toEqual({ cur: 2, max: 2 });
    expect(s[4]).toEqual({ cur: 0, max: 0 });
  });
  it("half caster has no slots at level 1, gains them at 2", () => {
    expect(slotsFor("half", 1)[1]).toEqual({ cur: 0, max: 0 });
    expect(slotsFor("half", 2)[1]).toEqual({ cur: 2, max: 2 });
  });
  it("warlock pact magic puts count at the pact slot level", () => {
    expect(slotsFor("warlock", 1)[1]).toEqual({ cur: 1, max: 1 });
    const s5 = slotsFor("warlock", 5);
    expect(s5[3]).toEqual({ cur: 2, max: 2 });
    expect(s5[1]).toEqual({ cur: 0, max: 0 });
  });
  it("third caster starts at level 3", () => {
    expect(slotsFor("third", 3)[1]).toEqual({ cur: 2, max: 2 });
  });
  it("non-caster gets no slots", () => {
    const s = slotsFor(null, 5);
    expect(s[1]).toEqual({ cur: 0, max: 0 });
  });
  it("clamps level into 1..20", () => {
    expect(slotsFor("full", 99)[1]).toEqual(slotsFor("full", 20)[1]);
    expect(slotsFor("full", 0)[1]).toEqual(slotsFor("full", 1)[1]);
  });
});
