// First-run seed characters. Pure: builds fully-specified level-5 examples that exercise
// the different caster shapes (warlock pact magic, wizard prepare, bard known) so the app
// has something realistic to render and test against. All race/class/spell ids match the
// SRD content under public/content/.
import { makeCharacter } from "./character.js";
import { slotsFor } from "./slots.js";
import { uid } from "./helpers.js";

function warlockSeed() {
  const c = makeCharacter("Hilda Coalhand");
  c.race = "Dwarf";
  c.subrace = "Hill Dwarf";
  c.classes = [{ id: "warlock", level: 5 }];
  c.abilities = { str: 10, dex: 10, con: 8, int: 8, wis: 10, cha: 18 };
  c.savingProfs = { str: false, dex: false, con: false, int: false, wis: true, cha: true };
  c.skillProfs = { ...c.skillProfs, arcana: 1, deception: 1, investigation: 1 };
  c.spellAbility = "cha";
  c.patron = "Great Old One";
  c.pact = "Pact of the Chain";
  c.ac = 13;
  c.speed = 25;
  c.hp = { current: 28, max: 28, temp: 0 };
  c.hitDice = { total: 5, remaining: 5, dieType: 8 };
  c.spellSlots = slotsFor("warlock", 5);
  c.invocations = ["Agonizing Blast", "Investment of the Chain Master"];
  c.spells = ["eldritch-blast", "hex", "toll-the-dead"];
  c.attacks = [
    { id: uid(), kind: "weapon", name: "Light Crossbow", dice: "1d8", versatile: null, damageType: "piercing", props: ["ranged", "loading", "two-handed"], ability: "dex", proficient: true, twoHanded: false, addMod: true, magic: 0, bonusDmg: 0, effect: "" },
  ];
  c.familiar = {
    enabled: true, name: "Pipsqueak", form: "Imp", ac: 13,
    hp: { current: 10, max: 10, temp: 0 }, speed: "20 ft, fly 40 ft", notes: "",
    attacks: [
      { id: uid(), name: "Sting", toHit: 5, dice: "1d4", bonusDmg: 3, damageType: "piercing", hasSave: true, saveAbility: "con", useMyDC: true, fixedDC: 11, magical: true, effect: "On a failed save, 3d6 poison damage (half on success)." },
    ],
  };
  return c;
}

function wizardSeed() {
  const c = makeCharacter("Alaric Vance");
  c.race = "Elf";
  c.subrace = "High Elf";
  c.classes = [{ id: "wizard", level: 5 }];
  c.abilities = { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 };
  c.savingProfs = { str: false, dex: false, con: false, int: true, wis: true, cha: false };
  c.skillProfs = { ...c.skillProfs, arcana: 1, investigation: 1, history: 1, perception: 1 };
  c.spellAbility = "int";
  c.ac = 12;
  c.speed = 30;
  c.hp = { current: 27, max: 27, temp: 0 };
  c.hitDice = { total: 5, remaining: 5, dieType: 6 };
  c.spellSlots = slotsFor("full", 5);
  // Wizard is a prepare caster: spells = spellbook, preparedSpells = today's prepared subset.
  c.spells = [
    "fire-bolt", "mage-hand", "light", "toll-the-dead", "prestidigitation",
    "magic-missile", "burning-hands", "shield", "detect-magic",
    "misty-step", "scorching-ray", "invisibility",
    "fireball", "counterspell",
  ];
  c.preparedSpells = ["magic-missile", "burning-hands", "shield", "detect-magic", "misty-step", "scorching-ray", "fireball", "counterspell"];
  c.attacks = [
    { id: uid(), kind: "weapon", name: "Dagger", dice: "1d4", versatile: null, damageType: "piercing", props: ["finesse", "light", "thrown"], ability: "dex", proficient: true, twoHanded: false, addMod: true, magic: 0, bonusDmg: 0, effect: "" },
  ];
  return c;
}

function bardSeed() {
  const c = makeCharacter("Lyra Quill");
  c.race = "Half-Elf";
  c.subrace = "";
  c.classes = [{ id: "bard", level: 5 }];
  c.abilities = { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 };
  c.savingProfs = { str: false, dex: true, con: false, int: false, wis: false, cha: true };
  c.skillProfs = { ...c.skillProfs, persuasion: 1, performance: 1, deception: 1, perception: 1, acrobatics: 1 };
  c.spellAbility = "cha";
  c.ac = 14;
  c.speed = 30;
  c.hp = { current: 33, max: 33, temp: 0 };
  c.hitDice = { total: 5, remaining: 5, dieType: 8 };
  c.spellSlots = slotsFor("full", 5);
  // Bard is a known caster: everything in `spells` is castable, so no preparedSpells.
  c.spells = [
    "vicious-mockery", "mage-hand", "minor-illusion", "prestidigitation", "light",
    "cure-wounds", "healing-word", "thunderwave", "charm-person", "sleep",
    "shatter", "invisibility", "hold-person",
    "hypnotic-pattern", "dispel-magic",
  ];
  c.attacks = [
    { id: uid(), kind: "weapon", name: "Rapier", dice: "1d8", versatile: null, damageType: "piercing", props: ["finesse"], ability: "dex", proficient: true, twoHanded: false, addMod: true, magic: 0, bonusDmg: 0, effect: "" },
  ];
  return c;
}

// The party shown on first run; the first entry is selected as the active character.
export function seedCharacters() {
  return [warlockSeed(), wizardSeed(), bardSeed()];
}
