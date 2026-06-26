import React, { useState, useEffect } from "react";

// ───────────────────────── Reference data ─────────────────────────
const ABILITIES = [
  ["str", "Strength", "STR"],
  ["dex", "Dexterity", "DEX"],
  ["con", "Constitution", "CON"],
  ["int", "Intelligence", "INT"],
  ["wis", "Wisdom", "WIS"],
  ["cha", "Charisma", "CHA"],
];

const SKILLS = [
  ["acrobatics", "Acrobatics", "dex"],
  ["animal", "Animal Handling", "wis"],
  ["arcana", "Arcana", "int"],
  ["athletics", "Athletics", "str"],
  ["deception", "Deception", "cha"],
  ["history", "History", "int"],
  ["insight", "Insight", "wis"],
  ["intimidation", "Intimidation", "cha"],
  ["investigation", "Investigation", "int"],
  ["medicine", "Medicine", "wis"],
  ["nature", "Nature", "int"],
  ["perception", "Perception", "wis"],
  ["performance", "Performance", "cha"],
  ["persuasion", "Persuasion", "cha"],
  ["religion", "Religion", "int"],
  ["sleight", "Sleight of Hand", "dex"],
  ["stealth", "Stealth", "dex"],
  ["survival", "Survival", "wis"],
];

const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// ───────────────────────── Helpers ─────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v, d = 0) => {
  if (v === "" || v === null || v === undefined) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const abilityMod = (score) => Math.floor((num(score, 10) - 10) / 2);
const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);
const profBonus = (level) => Math.ceil(num(level, 1) / 4) + 1; // 1–4:+2, 5–8:+3 ... 17–20:+6

// ───────────────────────── SRD races ─────────────────────────
// Mechanical data is open game content (SRD 5.1). Trait text is summarized.
const RACES = {
  Dwarf: {
    asi: { con: 2 }, speed: 25, size: "Medium",
    traits: [
      ["Darkvision", "See in dim light within 60 ft as if bright, and darkness as dim (grayscale)."],
      ["Dwarven Resilience", "Advantage on saves vs poison; resistance to poison damage."],
      ["Dwarven Combat Training", "Proficiency with battleaxe, handaxe, light hammer, warhammer."],
      ["Stonecunning", "Double proficiency on History checks about stonework."],
      ["Tool Proficiency", "Proficiency with one set of artisan's tools (smith, brewer, or mason)."],
    ],
    subraces: {
      "Hill Dwarf": { asi: { wis: 1 }, traits: [["Dwarven Toughness", "Max HP increases by 1 per level."]] },
      "Mountain Dwarf": { asi: { str: 2 }, traits: [["Dwarven Armor Training", "Proficiency with light and medium armor."]] },
    },
  },
  Elf: {
    asi: { dex: 2 }, speed: 30, size: "Medium",
    traits: [
      ["Darkvision", "See 60 ft in dim light as bright, darkness as dim."],
      ["Keen Senses", "Proficiency in the Perception skill."],
      ["Fey Ancestry", "Advantage vs being charmed; magic can't put you to sleep."],
      ["Trance", "Meditate 4 hours for the benefit of an 8-hour rest."],
    ],
    subraces: {
      "High Elf": { asi: { int: 1 }, traits: [["Cantrip", "Know one wizard cantrip (Intelligence)."], ["Elf Weapon Training", "Longsword, shortsword, shortbow, longbow."], ["Extra Language", "Learn one extra language."]] },
      "Wood Elf": { asi: { wis: 1 }, speed: 35, traits: [["Elf Weapon Training", "Longsword, shortsword, shortbow, longbow."], ["Fleet of Foot", "Base walking speed 35 ft."], ["Mask of the Wild", "Hide when lightly obscured by nature."]] },
      "Drow": { asi: { cha: 1 }, traits: [["Superior Darkvision", "Darkvision out to 120 ft."], ["Sunlight Sensitivity", "Disadvantage on attacks & Perception (sight) in sunlight."], ["Drow Magic", "Dancing lights; faerie fire at 3rd, darkness at 5th (Charisma)."], ["Drow Weapon Training", "Rapier, shortsword, hand crossbow."]] },
    },
  },
  Halfling: {
    asi: { dex: 2 }, speed: 25, size: "Small",
    traits: [
      ["Lucky", "Reroll a natural 1 on an attack, check, or save (use the new roll)."],
      ["Brave", "Advantage on saves vs being frightened."],
      ["Halfling Nimbleness", "Move through the space of any creature larger than you."],
    ],
    subraces: {
      "Lightfoot": { asi: { cha: 1 }, traits: [["Naturally Stealthy", "Hide when obscured by a creature at least one size larger."]] },
      "Stout": { asi: { con: 1 }, traits: [["Stout Resilience", "Advantage vs poison; resistance to poison damage."]] },
    },
  },
  Human: {
    asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, size: "Medium",
    traits: [["Extra Language", "Learn one extra language of your choice."]],
    subraces: {},
  },
  Dragonborn: {
    asi: { str: 2, cha: 1 }, speed: 30, size: "Medium",
    traits: [
      ["Draconic Ancestry", "Choose a dragon type; sets your breath and resistance."],
      ["Breath Weapon", "Exhale energy in a line/cone; DC 8 + CON + prof, scales with level."],
      ["Damage Resistance", "Resistance to the damage type of your ancestry."],
    ],
    subraces: {},
  },
  Gnome: {
    asi: { int: 2 }, speed: 25, size: "Small",
    traits: [
      ["Darkvision", "See 60 ft in dim light as bright, darkness as dim."],
      ["Gnome Cunning", "Advantage on INT, WIS, CHA saves against magic."],
    ],
    subraces: {
      "Rock Gnome": { asi: { con: 1 }, traits: [["Artificer's Lore", "Add double proficiency on History checks about magic items / devices."], ["Tinker", "Construct tiny clockwork devices."]] },
      "Forest Gnome": { asi: { dex: 1 }, traits: [["Natural Illusionist", "Know the minor illusion cantrip (Intelligence)."], ["Speak with Small Beasts", "Communicate simple ideas to Small or smaller beasts."]] },
    },
  },
  "Half-Elf": {
    asi: { cha: 2 }, speed: 30, size: "Medium",
    traits: [
      ["Darkvision", "See 60 ft in dim light as bright, darkness as dim."],
      ["Fey Ancestry", "Advantage vs charm; magic can't put you to sleep."],
      ["Ability Choice", "+1 to two other abilities of your choice (set those manually)."],
      ["Skill Versatility", "Proficiency in two skills of your choice."],
    ],
    subraces: {},
  },
  "Half-Orc": {
    asi: { str: 2, con: 1 }, speed: 30, size: "Medium",
    traits: [
      ["Darkvision", "See 60 ft in dim light as bright, darkness as dim."],
      ["Menacing", "Proficiency in Intimidation."],
      ["Relentless Endurance", "Drop to 1 HP instead of 0 once per long rest."],
      ["Savage Attacks", "Roll one extra weapon die on a melee critical hit."],
    ],
    subraces: {},
  },
  Tiefling: {
    asi: { cha: 2, int: 1 }, speed: 30, size: "Medium",
    traits: [
      ["Darkvision", "See 60 ft in dim light as bright, darkness as dim."],
      ["Hellish Resistance", "Resistance to fire damage."],
      ["Infernal Legacy", "Thaumaturgy; hellish rebuke at 3rd, darkness at 5th (Charisma)."],
    ],
    subraces: {},
  },
};

// ───────────────────────── SRD classes ─────────────────────────
const F = (level, name, desc) => ({ level, name, desc });
const CLASSES = {
  Barbarian: {
    hitDie: "d12", saves: ["str", "con"], spellAbility: "", caster: null,
    features: [
      F(1, "Rage", "Bonus action: bonus melee damage, advantage on STR checks/saves, resistance to bludgeoning/piercing/slashing."),
      F(1, "Unarmored Defense", "While unarmored, AC = 10 + DEX mod + CON mod."),
      F(2, "Reckless Attack", "Gain advantage on STR melee attacks; attacks against you gain advantage until your next turn."),
      F(2, "Danger Sense", "Advantage on DEX saves against effects you can see."),
      F(3, "Primal Path", "Choose your barbarian subclass."),
      F(5, "Extra Attack", "Attack twice when you take the Attack action."),
      F(5, "Fast Movement", "+10 ft speed while not in heavy armor."),
      F(7, "Feral Instinct", "Advantage on initiative."),
      F(9, "Brutal Critical", "Roll extra weapon damage dice on a critical hit."),
      F(11, "Relentless Rage", "Drop to 1 HP instead of 0 with a CON save while raging."),
    ],
  },
  Bard: {
    hitDie: "d8", saves: ["dex", "cha"], spellAbility: "cha", caster: "full",
    features: [
      F(1, "Spellcasting", "Cast bard spells using Charisma."),
      F(1, "Bardic Inspiration", "Bonus action: give a creature a d6 to add to a roll (scales with level)."),
      F(2, "Jack of All Trades", "Add half proficiency to checks you aren't proficient in."),
      F(2, "Song of Rest", "Allies regain extra HP on a short rest."),
      F(3, "Bard College", "Choose your subclass."),
      F(3, "Expertise", "Double proficiency on two chosen skills."),
      F(5, "Font of Inspiration", "Regain Bardic Inspiration on a short or long rest."),
      F(6, "Countercharm", "Performance grants allies advantage vs frightened/charmed."),
      F(10, "Magical Secrets", "Learn spells from any class's list."),
    ],
  },
  Cleric: {
    hitDie: "d8", saves: ["wis", "cha"], spellAbility: "wis", caster: "full",
    features: [
      F(1, "Spellcasting", "Cast cleric spells using Wisdom."),
      F(1, "Divine Domain", "Choose your domain; grants extra spells and features."),
      F(2, "Channel Divinity", "Turn Undead plus a domain option (recharge on rest)."),
      F(5, "Destroy Undead", "Channel Divinity can destroy low-CR undead."),
      F(10, "Divine Intervention", "Call on your deity for aid."),
    ],
  },
  Druid: {
    hitDie: "d8", saves: ["int", "wis"], spellAbility: "wis", caster: "full",
    features: [
      F(1, "Druidic", "You know the secret druid language."),
      F(1, "Spellcasting", "Cast druid spells using Wisdom."),
      F(2, "Wild Shape", "Transform into beasts you've seen (limits by level)."),
      F(2, "Druid Circle", "Choose your subclass."),
      F(18, "Beast Spells", "Cast with verbal/somatic components while in Wild Shape."),
      F(20, "Archdruid", "Unlimited Wild Shape uses."),
    ],
  },
  Fighter: {
    hitDie: "d10", saves: ["str", "con"], spellAbility: "", caster: null,
    features: [
      F(1, "Fighting Style", "Adopt a combat specialty (e.g. Defense, Dueling, Archery)."),
      F(1, "Second Wind", "Bonus action: regain 1d10 + level HP (once per rest)."),
      F(2, "Action Surge", "Take one additional action on your turn (once per rest)."),
      F(3, "Martial Archetype", "Choose your subclass."),
      F(5, "Extra Attack", "Attack twice when you take the Attack action."),
      F(9, "Indomitable", "Reroll a failed saving throw (once per rest)."),
      F(11, "Extra Attack (2)", "Attack three times when you take the Attack action."),
    ],
  },
  Monk: {
    hitDie: "d8", saves: ["str", "dex"], spellAbility: "", caster: null,
    features: [
      F(1, "Unarmored Defense", "While unarmored, AC = 10 + DEX mod + WIS mod."),
      F(1, "Martial Arts", "Use DEX for unarmed strikes; bonus unarmed strike."),
      F(2, "Ki", "Spend ki points on Flurry of Blows, Patient Defense, Step of the Wind."),
      F(2, "Unarmored Movement", "+10 ft speed while unarmored (scales)."),
      F(3, "Monastic Tradition", "Choose your subclass; Deflect Missiles."),
      F(4, "Slow Fall", "Reduce falling damage as a reaction."),
      F(5, "Extra Attack", "Attack twice; Stunning Strike with ki."),
      F(7, "Evasion", "Take no damage on a successful DEX save (half on fail)."),
    ],
  },
  Paladin: {
    hitDie: "d10", saves: ["wis", "cha"], spellAbility: "cha", caster: "half",
    features: [
      F(1, "Divine Sense", "Detect celestials, fiends, undead nearby."),
      F(1, "Lay on Hands", "Healing pool of 5 × paladin level HP."),
      F(2, "Fighting Style", "Adopt a combat specialty."),
      F(2, "Spellcasting", "Cast paladin spells using Charisma."),
      F(2, "Divine Smite", "Expend a spell slot to deal extra radiant damage on a hit."),
      F(3, "Sacred Oath", "Choose your oath (subclass); Channel Divinity; Divine Health."),
      F(5, "Extra Attack", "Attack twice when you take the Attack action."),
      F(6, "Aura of Protection", "You and nearby allies add your CHA mod to saves."),
    ],
  },
  Ranger: {
    hitDie: "d10", saves: ["str", "dex"], spellAbility: "wis", caster: "half",
    features: [
      F(1, "Favored Enemy", "Advantage to track and recall info about chosen foes."),
      F(1, "Natural Explorer", "Bonuses while traveling in favored terrain."),
      F(2, "Fighting Style", "Adopt a combat specialty."),
      F(2, "Spellcasting", "Cast ranger spells using Wisdom."),
      F(3, "Ranger Archetype", "Choose your subclass; Primeval Awareness."),
      F(5, "Extra Attack", "Attack twice when you take the Attack action."),
      F(8, "Land's Stride", "Move through nonmagical difficult terrain freely."),
    ],
  },
  Rogue: {
    hitDie: "d8", saves: ["dex", "int"], spellAbility: "", caster: null,
    features: [
      F(1, "Expertise", "Double proficiency on two chosen skills (or one + thieves' tools)."),
      F(1, "Sneak Attack", "Extra damage once per turn with advantage or a flanking ally (scales)."),
      F(1, "Thieves' Cant", "Secret coded language of rogues."),
      F(2, "Cunning Action", "Bonus action to Dash, Disengage, or Hide."),
      F(3, "Roguish Archetype", "Choose your subclass."),
      F(5, "Uncanny Dodge", "Reaction to halve damage from one attack."),
      F(7, "Evasion", "Take no damage on a successful DEX save (half on fail)."),
      F(11, "Reliable Talent", "Treat a d20 of 9 or lower as 10 on proficient checks."),
    ],
  },
  Sorcerer: {
    hitDie: "d6", saves: ["con", "cha"], spellAbility: "cha", caster: "full",
    features: [
      F(1, "Spellcasting", "Cast sorcerer spells using Charisma."),
      F(1, "Sorcerous Origin", "Choose your subclass; grants extra features."),
      F(2, "Font of Magic", "Gain sorcery points to fuel your magic."),
      F(3, "Metamagic", "Bend spells with options like Twin, Quicken, Subtle."),
    ],
  },
  Warlock: {
    hitDie: "d8", saves: ["wis", "cha"], spellAbility: "cha", caster: "warlock",
    features: [
      F(1, "Otherworldly Patron", "Choose your patron (subclass); grants expanded spells and features."),
      F(1, "Pact Magic", "A few spell slots that all rise to your highest level and recharge on a short rest."),
      F(2, "Eldritch Invocations", "Learn fragments of forbidden knowledge that grant lasting magical abilities (see the panel below)."),
      F(3, "Pact Boon", "Choose Pact of the Blade, Chain, or Tome."),
      F(4, "Ability Score Improvement", "Increase one ability by 2 or two abilities by 1 (or take a feat)."),
      F(8, "Ability Score Improvement", "Increase one ability by 2 or two abilities by 1 (or take a feat)."),
      F(11, "Mystic Arcanum (6th level)", "Choose one 6th-level spell to cast once per long rest, without a slot."),
      F(12, "Ability Score Improvement", "Increase one ability by 2 or two abilities by 1 (or take a feat)."),
      F(13, "Mystic Arcanum (7th level)", "Choose one 7th-level spell to cast once per long rest."),
      F(15, "Mystic Arcanum (8th level)", "Choose one 8th-level spell to cast once per long rest."),
      F(16, "Ability Score Improvement", "Increase one ability by 2 or two abilities by 1 (or take a feat)."),
      F(17, "Mystic Arcanum (9th level)", "Choose one 9th-level spell to cast once per long rest."),
      F(19, "Ability Score Improvement", "Increase one ability by 2 or two abilities by 1 (or take a feat)."),
      F(20, "Eldritch Master", "Spend 1 minute entreating your patron to regain all expended Pact Magic slots, once per long rest."),
    ],
  },
  Wizard: {
    hitDie: "d6", saves: ["int", "wis"], spellAbility: "int", caster: "full",
    features: [
      F(1, "Spellcasting", "Cast wizard spells using Intelligence; keep a spellbook."),
      F(1, "Arcane Recovery", "Recover some spell slots on a short rest (once per day)."),
      F(2, "Arcane Tradition", "Choose your school of magic (subclass)."),
      F(18, "Spell Mastery", "Cast a chosen 1st- and 2nd-level spell at will."),
    ],
  },
};

// Spell slot progressions (index by character level → [1st..9th])
const FULL_SLOTS = {
  1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1],
  8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1], 19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};
const HALF_SLOTS = {
  2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3], 9: [4, 3, 2], 10: [4, 3, 2],
  11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1], 14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2],
  17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
};
// Warlock pact magic: [slotLevel, count]
const WARLOCK_SLOTS = {
  1: [1, 1], 2: [1, 2], 3: [2, 2], 4: [2, 2], 5: [3, 2], 6: [3, 2], 7: [4, 2], 8: [4, 2],
  9: [5, 2], 10: [5, 2], 11: [5, 3], 12: [5, 3], 13: [5, 3], 14: [5, 3], 15: [5, 3], 16: [5, 3],
  17: [5, 4], 18: [5, 4], 19: [5, 4], 20: [5, 4],
};

// How many Eldritch Invocations a warlock knows at each level
const WARLOCK_INV_KNOWN = {
  1: 0, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5,
  11: 5, 12: 6, 13: 6, 14: 6, 15: 7, 16: 7, 17: 7, 18: 8, 19: 8, 20: 8,
};

// Eldritch Invocations (SRD 5.1). `level` is the warlock-level prerequisite;
// `prereq` is any other requirement (pact boon or cantrip). Descriptions paraphrased.
const INVOCATIONS = [
  { name: "Agonizing Blast", level: 1, prereq: "eldritch blast", desc: "Add your Charisma modifier to the damage of your eldritch blast." },
  { name: "Armor of Shadows", level: 1, prereq: "", desc: "Cast mage armor on yourself at will, without using a spell slot." },
  { name: "Beast Speech", level: 1, prereq: "", desc: "Cast speak with animals at will." },
  { name: "Beguiling Influence", level: 1, prereq: "", desc: "Gain proficiency in Deception and Persuasion." },
  { name: "Book of Ancient Secrets", level: 1, prereq: "Pact of the Tome", desc: "Inscribe and cast ritual spells from your Book of Shadows." },
  { name: "Devil's Sight", level: 1, prereq: "", desc: "See normally in magical and nonmagical darkness out to 120 ft." },
  { name: "Eldritch Sight", level: 1, prereq: "", desc: "Cast detect magic at will, without a spell slot." },
  { name: "Eldritch Spear", level: 1, prereq: "eldritch blast", desc: "Your eldritch blast's range becomes 300 ft." },
  { name: "Eyes of the Rune Keeper", level: 1, prereq: "", desc: "You can read all writing." },
  { name: "Fiendish Vigor", level: 1, prereq: "", desc: "Cast false life on yourself at will as a 1st-level spell." },
  { name: "Gaze of Two Minds", level: 1, prereq: "", desc: "Touch a willing humanoid to perceive through its senses until the end of your next turn." },
  { name: "Mask of Many Faces", level: 1, prereq: "", desc: "Cast disguise self at will." },
  { name: "Misty Visions", level: 1, prereq: "", desc: "Cast silent image at will." },
  { name: "Repelling Blast", level: 1, prereq: "eldritch blast", desc: "When you hit a creature with eldritch blast, push it up to 10 ft away." },
  { name: "Thief of Five Fates", level: 1, prereq: "", desc: "Cast bane once using a warlock spell slot; regain on a long rest." },
  { name: "Voice of the Chain Master", level: 1, prereq: "Pact of the Chain", desc: "Communicate with and perceive through your familiar at any distance." },
  { name: "Mire the Mind", level: 5, prereq: "", desc: "Cast slow once using a warlock spell slot; regain on a long rest." },
  { name: "One with Shadows", level: 5, prereq: "", desc: "In dim light or darkness, become invisible until you move or take an action." },
  { name: "Sign of Ill Omen", level: 5, prereq: "", desc: "Cast bestow curse once using a warlock spell slot; regain on a long rest." },
  { name: "Thirsting Blade", level: 5, prereq: "Pact of the Blade", desc: "Attack twice with your pact weapon when you take the Attack action." },
  { name: "Investment of the Chain Master", level: 5, prereq: "Pact of the Chain", desc: "Your familiar gains a flying or swimming speed, can attack as a bonus action with magical strikes, uses your spell save DC, and you can take damage in its place." },
  { name: "Bewitching Whispers", level: 7, prereq: "", desc: "Cast compulsion once using a warlock spell slot; regain on a long rest." },
  { name: "Dreadful Word", level: 7, prereq: "", desc: "Cast confusion once using a warlock spell slot; regain on a long rest." },
  { name: "Sculptor of Flesh", level: 7, prereq: "", desc: "Cast polymorph once using a warlock spell slot; regain on a long rest." },
  { name: "Ascendant Step", level: 9, prereq: "", desc: "Cast levitate on yourself at will, without a spell slot." },
  { name: "Minions of Chaos", level: 9, prereq: "", desc: "Cast conjure elemental once using a warlock spell slot; regain on a long rest." },
  { name: "Otherworldly Leap", level: 9, prereq: "", desc: "Cast jump on yourself at will, without a spell slot." },
  { name: "Whispers of the Grave", level: 9, prereq: "", desc: "Cast speak with dead at will." },
  { name: "Lifedrinker", level: 12, prereq: "Pact of the Blade", desc: "Your pact weapon deals extra necrotic damage equal to your Charisma modifier." },
  { name: "Chains of Carceri", level: 15, prereq: "Pact of the Chain", desc: "Cast hold monster at will on celestials, elementals, and fiends without a slot." },
  { name: "Master of Myriad Forms", level: 15, prereq: "", desc: "Cast alter self at will." },
  { name: "Visions of Distant Realms", level: 15, prereq: "", desc: "Cast arcane eye at will." },
  { name: "Witch Sight", level: 15, prereq: "", desc: "See the true form of shapechangers or creatures concealed by illusion within 30 ft." },
];

// Otherworldly Patrons (short, paraphrased flavor). Great Old One is the default below.
const PATRONS = {
  "Archfey": "A lord or lady of the Feywild; charm, illusion, and fey teleportation.",
  "The Fiend": "A devil or demon; temporary HP on kills, fire, and dark resilience.",
  "Great Old One": "An alien intelligence; telepathy, psychic spells, and creeping madness.",
  "The Celestial": "A being of the upper planes; radiant power and healing light.",
  "The Hexblade": "A sentient weapon of the Shadowfell; curses and martial might.",
  "The Fathomless": "A power of the deep; grasping tentacles, cold, and aquatic magic.",
  "The Genie": "A noble genie; elemental damage and a sheltering magical vessel.",
  "The Undead": "An undead horror; frightening presence and necrotic endurance.",
};

// Pact Boons (gained at level 3).
const PACTS = {
  "Pact of the Blade": "Conjure a magical pact weapon you're proficient with; bond magic weapons to it.",
  "Pact of the Chain": "Learn find familiar; your familiar can take special forms (imp, pseudodragon, quasit, sprite).",
  "Pact of the Tome": "Gain a Book of Shadows holding three extra cantrips from any class.",
};
const isPactPrereq = (p) => typeof p === "string" && p.startsWith("Pact of");

// Pact of the Chain familiar forms (standard stat blocks; values are editable).
const FAMILIAR_FORMS = {
  Imp: {
    ac: 13, hp: 10, speed: "20 ft, fly 40 ft",
    attacks: [{ name: "Sting", toHit: 5, dice: "1d4", bonusDmg: 3, damageType: "piercing", hasSave: true, saveAbility: "con", fixedDC: 11, effect: "On a failed save, 3d6 poison damage (half on success)." }],
  },
  Pseudodragon: {
    ac: 13, hp: 7, speed: "15 ft, fly 60 ft",
    attacks: [
      { name: "Bite", toHit: 4, dice: "1d4", bonusDmg: 2, damageType: "piercing" },
      { name: "Sting", toHit: 4, dice: "1d4", bonusDmg: 2, damageType: "piercing", hasSave: true, saveAbility: "con", fixedDC: 11, effect: "On a fail, poisoned 1 hour; if it fails by 5+, unconscious for the same time." },
    ],
  },
  Quasit: {
    ac: 13, hp: 7, speed: "40 ft",
    attacks: [{ name: "Claws", toHit: 4, dice: "1d4", bonusDmg: 3, damageType: "slashing", hasSave: true, saveAbility: "con", fixedDC: 10, effect: "On a fail, 2d4 poison damage and poisoned for 1 minute." }],
  },
  Sprite: {
    ac: 15, hp: 2, speed: "10 ft, fly 40 ft",
    attacks: [
      { name: "Shortsword", toHit: 2, dice: "1", bonusDmg: 0, damageType: "slashing" },
      { name: "Longbow", toHit: 6, dice: "1", bonusDmg: 0, damageType: "piercing", hasSave: true, saveAbility: "con", fixedDC: 10, effect: "On a fail, poisoned 1 minute; if it fails by 5+, unconscious until it takes damage." },
    ],
  },
  Custom: { ac: 12, hp: 1, speed: "", attacks: [] },
};

function emptySlots() {
  const s = {};
  SPELL_LEVELS.forEach((l) => (s[l] = { cur: 0, max: 0 }));
  return s;
}
// Build a fresh slot object for a class + level, fully rested
function slotsFor(caster, level) {
  const s = emptySlots();
  const lv = Math.max(1, Math.min(20, num(level, 1)));
  if (caster === "full" || caster === "half") {
    const row = (caster === "full" ? FULL_SLOTS : HALF_SLOTS)[lv] || [];
    row.forEach((n, i) => (s[i + 1] = { cur: n, max: n }));
  } else if (caster === "warlock") {
    const [slvl, count] = WARLOCK_SLOTS[lv] || [0, 0];
    if (slvl) s[slvl] = { cur: count, max: count };
  }
  return s;
}
// Combine race + subrace ability bonuses
function raceBonuses(raceName, subraceName) {
  const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  const r = RACES[raceName];
  if (!r) return out;
  Object.entries(r.asi || {}).forEach(([k, v]) => (out[k] += v));
  const sub = r.subraces && r.subraces[subraceName];
  if (sub) Object.entries(sub.asi || {}).forEach(([k, v]) => (out[k] += v));
  return out;
}
// Combine race + subrace trait lists
function raceTraitList(raceName, subraceName) {
  const r = RACES[raceName];
  if (!r) return [];
  const sub = r.subraces && r.subraces[subraceName];
  return [...(r.traits || []), ...((sub && sub.traits) || [])];
}

// Common 5e feats with short, paraphrased mechanical summaries.
const FEATS = {
  Alert: "+5 to initiative. You can't be surprised while conscious, and hidden attackers don't gain advantage on you.",
  Actor: "+1 CHA. Advantage on Deception/Performance when impersonating; mimic speech or sounds you've heard.",
  Athlete: "+1 STR or DEX. Stand from prone using 5 ft of movement; climb at full speed; running jump after only 5 ft.",
  "Charger": "After a Dash, use a bonus action to make one melee attack with +5 damage, or shove a creature 10 ft.",
  "Crossbow Expert": "Ignore loading on crossbows; no disadvantage firing in melee; bonus-action hand-crossbow shot after attacking.",
  "Defensive Duelist": "With a finesse weapon, use a reaction to add your proficiency bonus to AC against one melee attack.",
  "Dual Wielder": "+1 AC while wielding two melee weapons; two-weapon fight with non-light weapons; draw or stow two at once.",
  Durable: "+1 CON. When you spend a Hit Die to heal, the minimum you regain is twice your CON modifier.",
  "Elemental Adept": "Your spells ignore resistance to a chosen damage type, and treat 1s on damage dice as 2s.",
  Grappler: "Advantage on attacks against a creature you're grappling; you can attempt to pin a grappled creature.",
  "Great Weapon Master": "Bonus attack on a crit or kill; before a heavy-weapon attack, take -5 to hit for +10 damage.",
  Healer: "Use a healer's kit to restore 1d6 + 4 + Hit Dice HP to a creature; stabilizing also restores 1 HP.",
  "Heavy Armor Master": "+1 STR. Reduce nonmagical bludgeoning, piercing, and slashing damage by 3 while in heavy armor.",
  "Inspiring Leader": "Spend 10 minutes to grant up to six allies temporary HP equal to your level + CHA modifier.",
  "Keen Mind": "+1 INT. Always know which way is north and hours until sunrise/sunset; recall anything seen or heard in the past month.",
  Lucky: "Gain 3 luck points; spend one to roll an extra d20 on an attack, check, or save (or an attack against you).",
  "Mage Slayer": "Reaction attack when a creature within 5 ft casts; advantage on saves vs their spells; disadvantage on their concentration.",
  "Magic Initiate": "Learn two cantrips and one 1st-level spell from a chosen class; cast the spell once per long rest.",
  "Martial Adept": "Learn two combat maneuvers and gain one superiority die (d6) to fuel them.",
  "Medium Armor Master": "Medium armor no longer imposes Stealth disadvantage; add up to +3 DEX to AC if your DEX is 16+.",
  Mobile: "+10 ft speed; Dash ignores difficult terrain; no opportunity attacks from a creature you made a melee attack against.",
  "Mounted Combatant": "Advantage vs unmounted creatures smaller than your mount; redirect attacks to yourself; mount dodges area effects.",
  Observant: "+1 INT or WIS. Read lips; +5 to passive Perception and passive Investigation.",
  "Polearm Master": "Bonus-action butt-end strike (1d4); opportunity attack when a creature enters your reach with a glaive, halberd, pike, quarterstaff, or spear.",
  Resilient: "+1 to one ability score and gain proficiency in that ability's saving throws.",
  "Ritual Caster": "Cast ritual spells from a chosen class's spell list using a ritual book.",
  "Savage Attacker": "Once per turn, reroll the damage of a melee weapon attack and use either total.",
  Sentinel: "Opportunity hits reduce a target's speed to 0; attack creatures even if they Disengage; reaction strike when a foe attacks an ally near you.",
  Sharpshooter: "No disadvantage at long range; ignore half and three-quarters cover; take -5 to hit for +10 damage with ranged weapons.",
  "Shield Master": "Bonus-action shove with your shield; add shield AC to DEX saves vs targeted effects; take no damage on a successful one.",
  Skilled: "Gain proficiency in any combination of three skills or tools.",
  Skulker: "Hide when lightly obscured; a missed ranged attack doesn't reveal you; no Perception disadvantage in dim light.",
  "Spell Sniper": "Double the range of your attack-roll spells; ignore cover; learn one attack cantrip.",
  "Tavern Brawler": "+1 STR or CON. Proficient with improvised weapons; unarmed strikes deal 1d4; bonus-action grapple after a hit.",
  Tough: "Your maximum HP increases by twice your level (and by 2 each level after).",
  "War Caster": "Advantage on concentration saves; cast with hands full; cast a spell as an opportunity attack instead of a weapon strike.",
  "Artificer Initiate": "Learn one artificer cantrip and one 1st-level artificer spell (cast once per long rest free, or with slots); proficiency with one artisan's tools.",
  "Chef": "+1 CON or WIS. On a rest, cook food that heals extra HP; make treats that grant temporary HP.",
  "Crusher": "+1 STR or CON. Once per turn, move a creature 5 ft when you deal bludgeoning damage; a crit gives attackers advantage against it.",
  "Eldritch Adept": "Prerequisite: Spellcasting or Pact Magic. Learn one Eldritch Invocation you qualify for; you can swap it when you gain a level.",
  "Fey Touched": "+1 INT, WIS, or CHA. Learn misty step plus a 1st-level divination or enchantment spell; cast each once per long rest free (or with slots).",
  "Fighting Initiate": "Prerequisite: a martial weapon proficiency. Learn one Fighting Style from the fighter list.",
  "Gunner": "+1 DEX. Proficiency with firearms, ignore their loading property, and no disadvantage firing in melee.",
  "Metamagic Adept": "Prerequisite: Spellcasting or Pact Magic. Learn two Metamagic options and gain 2 sorcery points to fuel them.",
  "Piercer": "+1 STR or DEX. Once per turn reroll a piercing damage die; on a crit, add one extra piercing damage die.",
  "Poisoner": "Your poison ignores resistance; coat a weapon to add poison damage and the poisoned condition (your DC); brew poison quickly.",
  "Shadow Touched": "+1 INT, WIS, or CHA. Learn invisibility plus a 1st-level illusion or necromancy spell; cast each once per long rest free (or with slots).",
  "Skill Expert": "+1 to one ability. Gain one skill proficiency and turn one proficiency you have into expertise.",
  "Slasher": "+1 STR or DEX. Once per turn reduce a creature's speed by 10 ft when you deal slashing damage; a crit gives it disadvantage on attacks.",
  "Telekinetic": "+1 INT, WIS, or CHA. Learn an improved mage hand; as a bonus action, shove a creature 5 ft (Strength save against your DC).",
  "Telepathic": "+1 INT, WIS, or CHA. Speak telepathically to creatures within 60 ft; cast detect thoughts once per long rest free (or with slots).",
};

function makeCharacter(name = "New Adventurer") {
  const abilities = {};
  ABILITIES.forEach(([k]) => (abilities[k] = 10));
  const savingProfs = {};
  ABILITIES.forEach(([k]) => (savingProfs[k] = false));
  const skillProfs = {};
  SKILLS.forEach(([k]) => (skillProfs[k] = 0)); // 0 none, 1 proficient, 2 expertise
  const spellSlots = {};
  SPELL_LEVELS.forEach((l) => (spellSlots[l] = { cur: 0, max: 0 }));
  return {
    id: uid(),
    name,
    cls: "",
    level: 1,
    race: "",
    subrace: "",
    background: "",
    alignment: "",
    xp: 0,
    inspiration: false,
    abilities,
    savingProfs,
    skillProfs,
    ac: 10,
    speed: 30,
    initMisc: 0,
    hp: { current: 10, max: 10, temp: 0 },
    hitDice: { cur: 1, max: 1, die: "d8" },
    deathSaves: { s: 0, f: 0 },
    spellAbility: "",
    spellSlots,
    patron: "",
    pact: "",
    attacks: [],
    feats: [],
    invocations: [],
    familiar: { enabled: false, name: "", form: "", ac: 12, hp: { current: 1, max: 1, temp: 0 }, speed: "", notes: "", attacks: [] },
    features: "",
    equipment: "",
    bio: "",
  };
}

// SRD weapons: dice, damage type, versatile dice (or null), and properties.
const WEAPONS = [
  { name: "Club", dice: "1d4", type: "bludgeoning", versatile: null, props: ["light"] },
  { name: "Dagger", dice: "1d4", type: "piercing", versatile: null, props: ["finesse", "light", "thrown"] },
  { name: "Greatclub", dice: "1d8", type: "bludgeoning", versatile: null, props: ["two-handed"] },
  { name: "Handaxe", dice: "1d6", type: "slashing", versatile: null, props: ["light", "thrown"] },
  { name: "Javelin", dice: "1d6", type: "piercing", versatile: null, props: ["thrown"] },
  { name: "Light Hammer", dice: "1d4", type: "bludgeoning", versatile: null, props: ["light", "thrown"] },
  { name: "Mace", dice: "1d6", type: "bludgeoning", versatile: null, props: [] },
  { name: "Quarterstaff", dice: "1d6", type: "bludgeoning", versatile: "1d8", props: ["versatile"] },
  { name: "Sickle", dice: "1d4", type: "slashing", versatile: null, props: ["light"] },
  { name: "Spear", dice: "1d6", type: "piercing", versatile: "1d8", props: ["thrown", "versatile"] },
  { name: "Light Crossbow", dice: "1d8", type: "piercing", versatile: null, props: ["ranged", "loading", "two-handed"] },
  { name: "Dart", dice: "1d4", type: "piercing", versatile: null, props: ["finesse", "thrown"] },
  { name: "Shortbow", dice: "1d6", type: "piercing", versatile: null, props: ["ranged", "two-handed"] },
  { name: "Sling", dice: "1d4", type: "bludgeoning", versatile: null, props: ["ranged"] },
  { name: "Battleaxe", dice: "1d8", type: "slashing", versatile: "1d10", props: ["versatile"] },
  { name: "Flail", dice: "1d8", type: "bludgeoning", versatile: null, props: [] },
  { name: "Glaive", dice: "1d10", type: "slashing", versatile: null, props: ["heavy", "reach", "two-handed"] },
  { name: "Greataxe", dice: "1d12", type: "slashing", versatile: null, props: ["heavy", "two-handed"] },
  { name: "Greatsword", dice: "2d6", type: "slashing", versatile: null, props: ["heavy", "two-handed"] },
  { name: "Halberd", dice: "1d10", type: "slashing", versatile: null, props: ["heavy", "reach", "two-handed"] },
  { name: "Longsword", dice: "1d8", type: "slashing", versatile: "1d10", props: ["versatile"] },
  { name: "Maul", dice: "2d6", type: "bludgeoning", versatile: null, props: ["heavy", "two-handed"] },
  { name: "Morningstar", dice: "1d8", type: "piercing", versatile: null, props: [] },
  { name: "Pike", dice: "1d10", type: "piercing", versatile: null, props: ["heavy", "reach", "two-handed"] },
  { name: "Rapier", dice: "1d8", type: "piercing", versatile: null, props: ["finesse"] },
  { name: "Scimitar", dice: "1d6", type: "slashing", versatile: null, props: ["finesse", "light"] },
  { name: "Shortsword", dice: "1d6", type: "piercing", versatile: null, props: ["finesse", "light"] },
  { name: "Trident", dice: "1d6", type: "piercing", versatile: "1d8", props: ["thrown", "versatile"] },
  { name: "War Pick", dice: "1d8", type: "piercing", versatile: null, props: [] },
  { name: "Warhammer", dice: "1d8", type: "bludgeoning", versatile: "1d10", props: ["versatile"] },
  { name: "Hand Crossbow", dice: "1d6", type: "piercing", versatile: null, props: ["ranged", "light", "loading"] },
  { name: "Heavy Crossbow", dice: "1d10", type: "piercing", versatile: null, props: ["ranged", "heavy", "loading", "two-handed"] },
  { name: "Longbow", dice: "1d8", type: "piercing", versatile: null, props: ["ranged", "heavy", "two-handed"] },
];
const WEAPON_BY_NAME = Object.fromEntries(WEAPONS.map((w) => [w.name, w]));

// Bring any attack (including legacy {name,bonus,dmg}) into the structured shape.
function normalizeAttack(a) {
  if (!a || typeof a !== "object") return null;
  if (a.kind) return a;
  return { id: a.id || uid(), kind: "manual", name: a.name || "", toHit: a.bonus || "", damage: a.dmg || "", effect: a.notes || "" };
}

// Merge an imported/raw character onto current defaults so no field is missing.
function hydrateCharacter(raw) {
  if (!raw || typeof raw !== "object") return null;
  const base = makeCharacter(raw.name || "Imported");
  const c = { ...base, ...raw, id: uid() };
  c.abilities = { ...base.abilities, ...(raw.abilities || {}) };
  c.savingProfs = { ...base.savingProfs, ...(raw.savingProfs || {}) };
  c.skillProfs = { ...base.skillProfs, ...(raw.skillProfs || {}) };
  c.spellSlots = { ...base.spellSlots, ...(raw.spellSlots || {}) };
  c.hp = { ...base.hp, ...(raw.hp || {}) };
  c.hitDice = { ...base.hitDice, ...(raw.hitDice || {}) };
  c.deathSaves = { ...base.deathSaves, ...(raw.deathSaves || {}) };
  c.attacks = (Array.isArray(raw.attacks) ? raw.attacks : []).map(normalizeAttack).filter(Boolean);
  c.feats = Array.isArray(raw.feats) ? raw.feats : [];
  c.invocations = Array.isArray(raw.invocations) ? raw.invocations : [];
  c.familiar = { ...base.familiar, ...(raw.familiar || {}) };
  c.familiar.hp = { ...base.familiar.hp, ...((raw.familiar && raw.familiar.hp) || {}) };
  c.familiar.attacks = Array.isArray(raw.familiar && raw.familiar.attacks) ? raw.familiar.attacks : [];
  return c;
}

// Pull an array of characters out of any supported export shape.
function charactersFromImport(data) {
  let arr = null;
  if (Array.isArray(data)) arr = data;
  else if (data && Array.isArray(data.characters)) arr = data.characters;
  else if (data && data.abilities) arr = [data];
  if (!arr) return [];
  return arr.map(hydrateCharacter).filter(Boolean);
}

// ───────────────────────── Theme ─────────────────────────
const T = {
  ink: "#14121C",
  ink2: "#0E0C14",
  panel: "#201B2E",
  panel2: "#2A2440",
  line: "#3A3354",
  lineSoft: "#2E2842",
  gold: "#D8B45A",
  goldDim: "#8C7434",
  violet: "#9A7BE0",
  violetDim: "#5E4A99",
  crimson: "#CF5450",
  green: "#74B36F",
  text: "#ECE6D8",
  dim: "#A89FB8",
  faint: "#766E8A",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap');

.ds-root *{box-sizing:border-box;}
.ds-root{
  font-family:'Spectral',Georgia,serif;
  color:${T.text};
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(154,123,224,0.10), transparent 60%),
    radial-gradient(900px 500px at -10% 110%, rgba(216,180,90,0.07), transparent 55%),
    ${T.ink};
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
}
.ds-wrap{max-width:1080px;margin:0 auto;padding:0 14px 96px;}

/* top bar */
.ds-top{
  position:sticky;top:0;z-index:20;
  background:linear-gradient(${T.ink2}, ${T.ink2}f2);
  border-bottom:1px solid ${T.line};
  backdrop-filter:blur(6px);
}
.ds-top-inner{max-width:1080px;margin:0 auto;padding:10px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.ds-brand{font-family:'Cinzel',serif;font-weight:700;letter-spacing:2px;color:${T.gold};font-size:18px;line-height:1;}
.ds-brand small{display:block;font-family:'Spectral',serif;font-weight:400;letter-spacing:3px;
  color:${T.faint};font-size:9px;text-transform:uppercase;margin-top:3px;}
.ds-spacer{flex:1;}

.ds-select, .ds-input, .ds-textarea{
  font-family:'Spectral',serif;color:${T.text};background:${T.panel};
  border:1px solid ${T.line};border-radius:8px;padding:8px 10px;font-size:15px;outline:none;
}
.ds-select{min-width:150px;}
.ds-input:focus,.ds-textarea:focus,.ds-select:focus{border-color:${T.gold};box-shadow:0 0 0 2px rgba(216,180,90,0.25);}
.ds-input::placeholder,.ds-textarea::placeholder{color:${T.faint};}

.ds-btn{
  font-family:'Cinzel',serif;font-size:12px;letter-spacing:1px;cursor:pointer;
  background:${T.panel};color:${T.text};border:1px solid ${T.line};
  border-radius:8px;padding:8px 12px;transition:border-color .15s,background .15s;
}
.ds-btn:hover{border-color:${T.gold};}
.ds-btn-gold{background:linear-gradient(${T.goldDim},#6f5a26);border-color:${T.gold};color:#1a160c;font-weight:600;}
.ds-btn-ghost{background:transparent;}
.ds-btn-danger:hover{border-color:${T.crimson};color:${T.crimson};}
.ds-icon-btn{cursor:pointer;background:transparent;border:1px solid transparent;color:${T.faint};
  border-radius:6px;padding:4px 7px;font-size:14px;line-height:1;}
.ds-icon-btn:hover{color:${T.crimson};border-color:${T.lineSoft};}

/* tabs */
.ds-tabs{position:sticky;top:53px;z-index:15;display:flex;gap:6px;overflow-x:auto;
  background:${T.ink}; padding:10px 0 8px; border-bottom:1px solid ${T.lineSoft};}
.ds-tab{flex:0 0 auto;font-family:'Cinzel',serif;letter-spacing:1px;font-size:12px;cursor:pointer;
  background:transparent;border:1px solid ${T.lineSoft};color:${T.dim};
  border-radius:999px;padding:7px 16px;transition:all .15s;}
.ds-tab:hover{color:${T.text};}
.ds-tab[data-on="1"]{color:${T.gold};border-color:${T.gold};background:rgba(216,180,90,0.08);}

/* layout */
.ds-grid{display:grid;gap:14px;margin-top:16px;}
.ds-panel{background:linear-gradient(${T.panel}, ${T.panel}e8);border:1px solid ${T.line};
  border-radius:14px;padding:16px;}
.ds-panel-title{font-family:'Cinzel',serif;letter-spacing:2px;font-size:12px;text-transform:uppercase;
  color:${T.gold};margin:0 0 12px;display:flex;align-items:center;gap:8px;}
.ds-panel-title::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,${T.goldDim},transparent);}

/* identity header */
.ds-id-name{font-family:'Cinzel',serif;font-weight:700;font-size:26px;color:${T.text};
  background:transparent;border:none;border-bottom:1px solid ${T.lineSoft};width:100%;padding:2px 0 6px;outline:none;}
.ds-id-name:focus{border-color:${T.gold};}
.ds-id-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:14px;}
.ds-field label{display:block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${T.faint};margin-bottom:3px;}
.ds-field .ds-input{width:100%;padding:6px 9px;font-size:14px;}

/* stat tiles row */
.ds-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:10px;}
.ds-stat{background:${T.ink2};border:1px solid ${T.line};border-radius:12px;padding:10px 6px;text-align:center;}
.ds-stat .lab{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${T.faint};}
.ds-stat .big{font-family:'Cinzel',serif;font-size:26px;color:${T.gold};line-height:1.1;margin-top:4px;}
.ds-stat .ds-input{width:100%;text-align:center;background:transparent;border:none;
  font-family:'Cinzel',serif;font-size:26px;color:${T.gold};padding:2px 0;}
.ds-stat .ds-input:focus{box-shadow:none;}

/* ability runestones */
.ds-abil-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:12px;}
.ds-rune{position:relative;background:
   radial-gradient(120% 90% at 50% 0%, rgba(154,123,224,0.12), transparent 70%), ${T.ink2};
  border:1px solid ${T.line};border-radius:14px;padding:12px 8px 10px;text-align:center;
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 14px rgba(0,0,0,0.35);}
.ds-rune .ab{font-family:'Cinzel',serif;letter-spacing:2px;font-size:11px;color:${T.dim};}
.ds-rune .mod{font-family:'Cinzel',serif;font-size:34px;font-weight:700;color:${T.gold};line-height:1;margin:6px 0 8px;}
.ds-rune .score{display:inline-flex;align-items:center;justify-content:center;gap:4px;}
.ds-rune .score input{width:46px;text-align:center;background:${T.panel};border:1px solid ${T.line};
  border-radius:8px;color:${T.text};font-family:'Spectral',serif;font-size:15px;padding:3px 0;}
.ds-rune .score input:focus{border-color:${T.gold};outline:none;}
.ds-rune .rbonus{font-size:11px;color:${T.violet};background:rgba(154,123,224,0.14);
  border:1px solid ${T.violetDim};border-radius:6px;padding:1px 5px;font-family:'Spectral',serif;}
.ds-rune .total{font-size:10px;color:${T.faint};margin-top:6px;letter-spacing:.5px;text-transform:uppercase;}

/* rows: saves & skills */
.ds-rowlist{display:grid;gap:4px;}
.ds-row{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;}
.ds-row:hover{background:rgba(255,255,255,0.02);}
.ds-row .rname{flex:1;font-size:15px;}
.ds-row .rabb{font-size:10px;color:${T.faint};text-transform:uppercase;letter-spacing:1px;width:30px;}
.ds-row .rbonus{font-family:'Cinzel',serif;font-size:16px;color:${T.text};min-width:34px;text-align:right;}

.ds-pip{width:22px;height:22px;border-radius:6px;border:1px solid ${T.line};cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:11px;color:${T.faint};
  background:${T.ink2};flex:0 0 auto;user-select:none;transition:all .12s;}
.ds-pip[data-s="1"]{border-color:${T.violet};color:${T.violet};background:rgba(154,123,224,0.12);}
.ds-pip[data-s="2"]{border-color:${T.gold};color:${T.gold};background:rgba(216,180,90,0.14);}

/* hp */
.ds-hp-main{display:flex;align-items:flex-end;gap:8px;justify-content:center;}
.ds-hp-main .cur{font-family:'Cinzel',serif;font-size:46px;color:${T.text};line-height:1;}
.ds-hp-main .sep{font-size:26px;color:${T.faint};padding-bottom:4px;}
.ds-hp-main input{width:88px;text-align:center;background:transparent;border:none;
  font-family:'Cinzel',serif;font-size:46px;color:${T.text};}
.ds-hp-main .maxin{width:60px;font-size:26px;color:${T.dim};text-align:left;padding-bottom:2px;}
.ds-hp-main input:focus{outline:none;}
.ds-hp-bar{height:10px;border-radius:6px;background:${T.ink2};border:1px solid ${T.line};margin:12px 0;overflow:hidden;}
.ds-hp-fill{height:100%;background:linear-gradient(90deg,${T.crimson},#e07a5f);transition:width .25s;}
.ds-hp-tools{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap;justify-content:center;}
.ds-hp-tools .ds-input{width:88px;text-align:center;}

.ds-dots{display:flex;gap:6px;}
.ds-dot{width:18px;height:18px;border-radius:50%;border:1px solid ${T.line};cursor:pointer;background:${T.ink2};transition:all .12s;}
.ds-dot[data-on="1"][data-kind="s"]{background:${T.green};border-color:${T.green};}
.ds-dot[data-on="1"][data-kind="f"]{background:${T.crimson};border-color:${T.crimson};}

/* attacks & slots */
.ds-attack{display:grid;grid-template-columns:1fr 64px 1fr 30px;gap:8px;align-items:center;margin-bottom:8px;}
.ds-attack .ds-input{width:100%;padding:6px 8px;font-size:14px;}
@media(max-width:560px){.ds-attack{grid-template-columns:1fr 56px 30px;}.ds-attack .dmg{grid-column:1 / 3;}}

.ds-slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;}
.ds-slot{background:${T.ink2};border:1px solid ${T.line};border-radius:10px;padding:10px;}
.ds-slot .lv{font-family:'Cinzel',serif;font-size:11px;letter-spacing:1px;color:${T.violet};margin-bottom:8px;}
.ds-slot .sl-pips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;min-height:18px;}
.ds-sp{width:16px;height:16px;border-radius:50%;border:1px solid ${T.violetDim};cursor:pointer;background:transparent;}
.ds-sp[data-on="1"]{background:${T.violet};border-color:${T.violet};}
.ds-slot .sl-max{display:flex;align-items:center;gap:6px;font-size:12px;color:${T.faint};}
.ds-slot .sl-max input{width:46px;text-align:center;background:${T.panel};border:1px solid ${T.line};
  border-radius:6px;color:${T.text};padding:3px;}

.ds-textarea{width:100%;min-height:150px;resize:vertical;line-height:1.6;font-size:15px;}
.ds-muted{color:${T.dim};font-size:13px;}
.ds-empty{color:${T.faint};font-style:italic;font-size:14px;padding:6px 0;}
.ds-feat{padding:9px 0;border-bottom:1px solid ${T.lineSoft};}
.ds-feat:last-child{border-bottom:none;}
.ds-feat .fn{font-family:'Cinzel',serif;font-size:13px;color:${T.text};letter-spacing:.4px;}
.ds-feat .flv{font-size:10px;color:${T.violet};margin-left:8px;letter-spacing:1px;text-transform:uppercase;}
.ds-feat .fd{font-size:13px;color:${T.dim};margin-top:3px;line-height:1.5;}
.ds-auto-note{font-size:11px;color:${T.faint};font-style:italic;margin:-4px 0 12px;}
.ds-rest-row{display:flex;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid ${T.lineSoft};}
.ds-rest-row .ds-btn{flex:1;padding:11px;}
.ds-feat-add{margin-bottom:12px;}
.ds-feat-add .ds-input{width:100%;}
.ds-feat-item{border:1px solid ${T.lineSoft};border-radius:10px;padding:10px;margin-bottom:10px;background:${T.ink2};}
.ds-feat-head{display:flex;gap:8px;align-items:center;}
.ds-feat-item .fname{flex:1;font-family:'Cinzel',serif;font-size:14px;}
.ds-feat-item .fdesc{width:100%;min-height:64px;margin-top:8px;font-size:14px;}
.ds-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:50;
  background:${T.panel2};border:1px solid ${T.gold};color:${T.text};padding:11px 16px;
  border-radius:10px;font-size:13px;max-width:90%;text-align:center;
  box-shadow:0 8px 24px rgba(0,0,0,0.5);animation:dsfade .2s ease;}
.ds-inv{display:flex;gap:10px;padding:10px;border:1px solid ${T.lineSoft};border-radius:10px;
  margin-bottom:8px;cursor:pointer;background:${T.ink2};transition:border-color .12s,background .12s;}
.ds-inv:hover{border-color:${T.violetDim};}
.ds-inv[data-on="1"]{border-color:${T.violet};background:rgba(154,123,224,0.10);}
.ds-inv-check{flex:0 0 auto;width:22px;height:22px;border-radius:6px;border:1px solid ${T.line};
  display:flex;align-items:center;justify-content:center;color:${T.violet};font-size:13px;}
.ds-inv[data-on="1"] .ds-inv-check{border-color:${T.violet};background:rgba(154,123,224,0.18);}
.ds-inv-name{font-family:'Cinzel',serif;font-size:14px;color:${T.text};
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ds-inv-tag,.ds-inv-lv{font-size:9px;letter-spacing:.5px;text-transform:uppercase;
  border-radius:5px;padding:1px 6px;font-family:'Spectral',serif;}
.ds-inv-tag{color:${T.gold};border:1px solid ${T.goldDim};}
.ds-inv-lv{color:${T.violet};border:1px solid ${T.violetDim};}
.ds-inv-desc{font-size:13px;color:${T.dim};margin-top:4px;line-height:1.5;}
.ds-pp-desc{font-size:13px;color:${T.dim};margin:10px 0 0;line-height:1.5;}
.ds-pp-desc b{color:${T.text};font-family:'Cinzel',serif;font-weight:600;}
.ds-count{font-family:'Cinzel',serif;}
.ds-count[data-over="1"]{color:${T.crimson};}
.ds-modal-bg{position:fixed;inset:0;z-index:60;background:rgba(8,6,12,0.72);
  display:flex;align-items:flex-start;justify-content:center;padding:36px 14px;
  overflow:auto;animation:dsfade .18s ease;}
.ds-modal{background:linear-gradient(${T.panel}, ${T.panel}f0);border:1px solid ${T.line};
  border-radius:16px;padding:20px;max-width:520px;width:100%;
  box-shadow:0 24px 70px rgba(0,0,0,0.6);}
.ds-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.ds-modal-sec{margin-top:16px;padding-top:16px;border-top:1px solid ${T.lineSoft};}
.ds-sec-label{font-family:'Cinzel',serif;letter-spacing:1.5px;font-size:11px;
  text-transform:uppercase;color:${T.gold};margin-bottom:10px;}
.ds-btn-row{display:flex;gap:8px;flex-wrap:wrap;}
.ds-modal label.ds-btn{cursor:pointer;display:inline-block;}
.ds-add-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px;}
.ds-add-row .ds-input{flex:0 0 auto;}
.ds-atk{border:1px solid ${T.line};border-radius:12px;padding:12px;margin-bottom:12px;
  background:linear-gradient(${T.panel}, ${T.panel}e8);}
.ds-atk-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.ds-atk-name{flex:1;font-family:'Cinzel',serif;font-size:15px;}
.ds-atk-kind{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${T.faint};
  border:1px solid ${T.lineSoft};border-radius:5px;padding:2px 6px;}
.ds-atk-result{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;}
@media(max-width:480px){.ds-atk-result{grid-template-columns:1fr;}}
.ds-atk-stat{background:${T.ink2};border:1px solid ${T.line};border-radius:10px;padding:10px;}
.ds-atk-stat .lab{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${T.faint};}
.ds-atk-stat .val{font-family:'Cinzel',serif;font-size:22px;color:${T.gold};margin-top:3px;line-height:1.15;}
.ds-atk-stat .src{font-size:11px;color:${T.dim};margin-top:6px;line-height:1.5;}
.ds-atk-fx{list-style:none;padding:0;margin:0 0 6px;}
.ds-atk-fx li{font-size:12px;color:${T.violet};padding:2px 0 2px 15px;position:relative;line-height:1.45;}
.ds-atk-fx li::before{content:"◆";position:absolute;left:0;color:${T.violetDim};font-size:8px;top:5px;}
.ds-atk-ctl{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;
  border-top:1px solid ${T.lineSoft};padding-top:10px;}
.ds-mini{display:flex;flex-direction:column;gap:3px;}
.ds-mini label{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${T.faint};}
.ds-mini input,.ds-mini select{background:${T.ink2};border:1px solid ${T.line};border-radius:7px;
  color:${T.text};padding:6px 8px;font-family:'Spectral',serif;font-size:14px;}
.ds-mini input{width:62px;text-align:center;}
.ds-mini input:focus,.ds-mini select:focus{border-color:${T.gold};outline:none;}
.ds-chip{cursor:pointer;user-select:none;border:1px solid ${T.line};border-radius:7px;
  padding:8px 11px;font-size:12px;color:${T.dim};background:${T.ink2};align-self:flex-end;}
.ds-chip[data-on="1"]{border-color:${T.gold};color:${T.gold};background:rgba(216,180,90,0.12);}

a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{
  outline:2px solid ${T.gold};outline-offset:2px;}

.ds-fade{animation:dsfade .25s ease;}
@keyframes dsfade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}
@media(prefers-reduced-motion:reduce){.ds-fade{animation:none;}.ds-hp-fill{transition:none;}}

.ds-chk{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font-size:14px;}
.ds-chkbox{width:20px;height:20px;border-radius:6px;border:1px solid ${T.line};background:${T.ink2};
  display:flex;align-items:center;justify-content:center;color:${T.gold};font-size:13px;}
.ds-chkbox[data-on="1"]{border-color:${T.gold};background:rgba(216,180,90,0.14);}
`;

// ───────────────────────── App ─────────────────────────
export default function App() {
  const [characters, setCharacters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("core");
  const [delta, setDelta] = useState("");
  const [toast, setToast] = useState(null); // { text, id }
  const [showData, setShowData] = useState(false);
  const [importBuf, setImportBuf] = useState("");

  const flash = (text) => setToast({ text, id: Math.random() });

  const hasStorage = typeof window !== "undefined" && window.storage;

  // Load once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (hasStorage) {
          const res = await window.storage.get("dnd:data");
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            if (!cancelled && parsed.characters && parsed.characters.length) {
              const migrated = parsed.characters.map((c) => ({
                ...c,
                attacks: (Array.isArray(c.attacks) ? c.attacks : []).map(normalizeAttack).filter(Boolean),
                invocations: Array.isArray(c.invocations) ? c.invocations : [],
                feats: Array.isArray(c.feats) ? c.feats : [],
                patron: c.patron || "",
                pact: c.pact || "",
                familiar:
                  c.familiar && typeof c.familiar === "object"
                    ? {
                        enabled: !!c.familiar.enabled,
                        name: c.familiar.name || "",
                        form: c.familiar.form || "",
                        ac: c.familiar.ac != null ? c.familiar.ac : 12,
                        hp: { current: 1, max: 1, temp: 0, ...(c.familiar.hp || {}) },
                        speed: c.familiar.speed || "",
                        notes: c.familiar.notes || "",
                        attacks: Array.isArray(c.familiar.attacks) ? c.familiar.attacks : [],
                      }
                    : { enabled: false, name: "", form: "", ac: 12, hp: { current: 1, max: 1, temp: 0 }, speed: "", notes: "", attacks: [] },
              }));
              setCharacters(migrated);
              const valid = migrated.find((c) => c.id === parsed.activeId);
              setActiveId(valid ? parsed.activeId : migrated[0].id);
              setLoaded(true);
              return;
            }
          }
        }
      } catch (e) {
        /* nothing saved yet */
      }
      if (!cancelled) {
        const c = makeCharacter("Hilda Coalhand");
        c.race = "Dwarf";
        c.subrace = "Hill Dwarf";
        c.cls = "Warlock";
        c.level = 5;
        c.abilities = { str: 10, dex: 10, con: 8, int: 8, wis: 10, cha: 18 };
        c.savingProfs = { str: false, dex: false, con: false, int: false, wis: true, cha: true };
        c.skillProfs = { ...c.skillProfs, arcana: 1, deception: 1, investigation: 1 };
        c.spellAbility = "cha";
        c.patron = "Great Old One";
        c.pact = "Pact of the Chain";
        c.ac = 13;
        c.speed = 25;
        c.hp = { current: 28, max: 28, temp: 0 };
        c.hitDice = { cur: 5, max: 5, die: "d8" };
        c.spellSlots = slotsFor("warlock", 5);
        c.invocations = ["Agonizing Blast", "Investment of the Chain Master"];
        c.attacks = [
          { id: uid(), kind: "spell", name: "Eldritch Blast", eldritchBlast: true, mode: "attack", dice: "1d10", damageType: "force", addMod: false, magic: 0, bonusDmg: 0, effect: "" },
          { id: uid(), kind: "weapon", name: "Light Crossbow", dice: "1d8", versatile: null, damageType: "piercing", props: ["ranged", "loading", "two-handed"], ability: "dex", proficient: true, twoHanded: false, addMod: true, magic: 0, bonusDmg: 0, effect: "" },
        ];
        c.familiar = {
          enabled: true, name: "Pipsqueak", form: "Imp", ac: 13,
          hp: { current: 10, max: 10, temp: 0 }, speed: "20 ft, fly 40 ft", notes: "",
          attacks: [
            { id: uid(), name: "Sting", toHit: 5, dice: "1d4", bonusDmg: 3, damageType: "piercing", hasSave: true, saveAbility: "con", useMyDC: true, fixedDC: 11, magical: true, effect: "On a failed save, 3d6 poison damage (half on success)." },
          ],
        };
        setCharacters([c]);
        setActiveId(c.id);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line

  // Save (debounced)
  useEffect(() => {
    if (!loaded || !hasStorage) return;
    const t = setTimeout(async () => {
      try {
        await window.storage.set("dnd:data", JSON.stringify({ characters, activeId }));
      } catch (e) {
        console.error("Save failed", e);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [characters, activeId, loaded, hasStorage]);

  // Auto-dismiss the toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const active = characters.find((c) => c.id === activeId) || null;

  // ── mutators ──
  const patch = (p) =>
    setCharacters((cs) =>
      cs.map((c) => (c.id === activeId ? { ...c, ...(typeof p === "function" ? p(c) : p) } : c))
    );
  const patchObj = (field, key, value) =>
    setCharacters((cs) =>
      cs.map((c) => (c.id === activeId ? { ...c, [field]: { ...c[field], [key]: value } } : c))
    );

  const addCharacter = () => {
    const c = makeCharacter();
    setCharacters((cs) => [...cs, c]);
    setActiveId(c.id);
    setTab("core");
  };
  const duplicateCharacter = () => {
    if (!active) return;
    const copy = { ...JSON.parse(JSON.stringify(active)), id: uid(), name: active.name + " (copy)" };
    setCharacters((cs) => [...cs, copy]);
    setActiveId(copy.id);
  };
  const deleteCharacter = () => {
    if (!active) return;
    if (!window.confirm(`Delete "${active.name}"? This can't be undone.`)) return;
    setCharacters((cs) => {
      const next = cs.filter((c) => c.id !== active.id);
      if (next.length === 0) {
        const fresh = makeCharacter("New Adventurer");
        setActiveId(fresh.id);
        return [fresh];
      }
      setActiveId(next[0].id);
      return next;
    });
  };

  if (!loaded || !active) {
    return (
      <div className="ds-root">
        <style>{CSS}</style>
        <div style={{ padding: 40, textAlign: "center", color: T.dim }}>Opening the codex…</div>
      </div>
    );
  }

  // ── derived ──
  const pb = profBonus(active.level);
  const raceMods = raceBonuses(active.race, active.subrace);
  const totalScore = {};
  const mods = {};
  ABILITIES.forEach(([k]) => {
    totalScore[k] = num(active.abilities[k], 10) + raceMods[k];
    mods[k] = abilityMod(totalScore[k]);
  });
  const raceDef = RACES[active.race] || null;
  const classDef = CLASSES[active.cls] || null;
  const traitList = raceTraitList(active.race, active.subrace);
  const classFeatures = classDef
    ? classDef.features.filter((f) => f.level <= num(active.level, 1))
    : [];
  const isWarlock = active.cls === "Warlock";
  const lvlClamped = Math.max(1, Math.min(20, num(active.level, 1)));
  const hasEldritchAdept = (active.feats || []).some((f) => (f.name || "").trim().toLowerCase() === "eldritch adept");
  const invKnownAllowed = (WARLOCK_INV_KNOWN[lvlClamped] || 0) + (hasEldritchAdept ? 1 : 0);
  const availableInvocations = INVOCATIONS.filter(
    (inv) => inv.level <= lvlClamped && (!isPactPrereq(inv.prereq) || inv.prereq === active.pact)
  );
  const lockedInvCount = INVOCATIONS.length - availableInvocations.length;
  const chosenInv = active.invocations || [];
  const invChosen = chosenInv.length;
  const orphanInvocations = chosenInv.filter((n) => !availableInvocations.some((i) => i.name === n));
  const initiative = mods.dex + num(active.initMisc);
  const perceptionTotal =
    10 +
    mods.wis +
    (active.skillProfs.perception === 1 ? pb : 0) +
    (active.skillProfs.perception === 2 ? pb * 2 : 0);
  const spellMod = active.spellAbility ? mods[active.spellAbility] : null;
  const spellDC = spellMod === null ? null : 8 + pb + spellMod;
  const spellAtk = spellMod === null ? null : pb + spellMod;
  const hpPct = active.hp.max > 0 ? Math.max(0, Math.min(100, (active.hp.current / active.hp.max) * 100)) : 0;

  const cycleSkill = (key) => patchObj("skillProfs", key, (active.skillProfs[key] + 1) % 3);
  const toggleSave = (key) => patchObj("savingProfs", key, !active.savingProfs[key]);

  const applyHP = (sign) => {
    const amt = Math.abs(num(delta));
    if (!amt) return;
    let { current, max, temp } = active.hp;
    if (sign < 0) {
      let dmg = amt;
      if (temp > 0) {
        const left = Math.max(0, temp - dmg);
        dmg -= temp - left;
        temp = left;
      }
      current = Math.max(0, current - dmg);
    } else {
      current = Math.min(max, current + amt);
    }
    patchObj("hp", "current", current);
    patchObj("hp", "temp", temp);
    setDelta("");
  };

  const setAttack = (id, key, value) =>
    patch((c) => ({ attacks: (c.attacks || []).map((a) => (a.id === id ? { ...a, [key]: value } : a)) }));
  const removeAttack = (id) => patch((c) => ({ attacks: (c.attacks || []).filter((a) => a.id !== id) }));
  const pushAttack = (atk) => patch((c) => ({ attacks: [...(c.attacks || []), atk] }));

  const defaultAbilityFor = (w) => {
    if (w.props.includes("ranged") && !w.props.includes("thrown")) return "dex";
    if (w.props.includes("finesse")) return mods.dex >= mods.str ? "dex" : "str";
    return "str";
  };
  const addWeapon = (name) => {
    const w = WEAPON_BY_NAME[name];
    if (!w) return;
    pushAttack({
      id: uid(), kind: "weapon", name: w.name, dice: w.dice, versatile: w.versatile,
      damageType: w.type, props: w.props, ability: defaultAbilityFor(w),
      proficient: true, twoHanded: false, addMod: true, magic: 0, bonusDmg: 0, effect: "",
    });
  };
  const addEldritchBlast = () =>
    pushAttack({
      id: uid(), kind: "spell", name: "Eldritch Blast", eldritchBlast: true, mode: "attack",
      dice: "1d10", damageType: "force", addMod: false, magic: 0, bonusDmg: 0, effect: "",
    });
  const addSpell = () =>
    pushAttack({
      id: uid(), kind: "spell", name: "", mode: "attack", saveAbility: "dex",
      dice: "", damageType: "", addMod: false, magic: 0, bonusDmg: 0, effect: "",
    });
  const addCustom = () =>
    pushAttack({
      id: uid(), kind: "custom", name: "", ability: "str", proficient: true,
      dice: "", damageType: "", addMod: true, magic: 0, bonusDmg: 0, effect: "",
    });
  const addManual = () => pushAttack({ id: uid(), kind: "manual", name: "", toHit: "", damage: "", effect: "" });

  // Compute to-hit / damage breakdown for an attack.
  const fmtFlat = (n) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "");
  const computeAttack = (a) => {
    const sp = active.spellAbility || "cha";
    if (a.kind === "manual") {
      return { manual: true, toHit: a.toHit || "—", damage: a.damage || "—", effects: a.effect ? [a.effect] : [] };
    }
    if (a.kind === "spell") {
      const smod = mods[sp];
      const magic = num(a.magic);
      if (a.eldritchBlast) {
        const lvl = num(active.level, 1);
        const beams = lvl >= 17 ? 4 : lvl >= 11 ? 3 : lvl >= 5 ? 2 : 1;
        const ag = (active.invocations || []).includes("Agonizing Blast");
        const rep = (active.invocations || []).includes("Repelling Blast");
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
  };

  const toggleSlot = (lvl, idx) => {
    const slot = active.spellSlots[lvl];
    // pips represent used; clicking the nth pip sets cur so that 'idx+1' are used
    const usedNow = slot.max - slot.cur;
    const targetUsed = idx + 1 === usedNow ? idx : idx + 1; // click filled pip to free it
    patchObj("spellSlots", lvl, { ...slot, cur: Math.max(0, slot.max - targetUsed) });
  };
  const setSlotMax = (lvl, v) => {
    const m = Math.max(0, num(v));
    patchObj("spellSlots", lvl, { max: m, cur: m }); // refill to full when adjusting capacity
  };

  // ── auto-fill handlers ──
  const handleRaceChange = (name) => {
    const def = RACES[name];
    patch(() => {
      const out = { race: name, subrace: "" };
      if (def) out.speed = def.speed; // subrace speed applied on subrace pick
      return out;
    });
  };
  const handleSubraceChange = (name) => {
    patch((c) => {
      const r = RACES[c.race];
      const sub = r && r.subraces[name];
      const out = { subrace: name };
      if (sub && sub.speed) out.speed = sub.speed;
      else if (r) out.speed = r.speed;
      return out;
    });
  };
  const handleClassChange = (name) => {
    const def = CLASSES[name];
    if (!def) {
      patch({ cls: name });
      return;
    }
    const savingProfs = {};
    ABILITIES.forEach(([k]) => (savingProfs[k] = def.saves.includes(k)));
    patch((c) => {
      const out = {
        cls: name,
        savingProfs,
        spellAbility: def.spellAbility || "",
        hitDice: { ...c.hitDice, die: def.hitDie, max: num(c.level, 1), cur: num(c.level, 1) },
        spellSlots: slotsFor(def.caster, c.level),
      };
      if (name === "Warlock") {
        const lvl = num(c.level, 1);
        out.patron = c.patron || "Great Old One";
        out.pact = c.pact || (lvl >= 3 ? "Pact of the Chain" : "");
        if (!(c.invocations && c.invocations.length)) {
          const inv = [];
          if (lvl >= 2) inv.push("Agonizing Blast");
          if (lvl >= 5 && out.pact === "Pact of the Chain") inv.push("Investment of the Chain Master");
          out.invocations = inv;
        }
      }
      return out;
    });
  };
  const handleLevelChange = (v) => {
    const level = Math.max(1, Math.min(20, num(v, 1)));
    patch((c) => {
      const def = CLASSES[c.cls];
      const out = { level, hitDice: { ...c.hitDice, max: level, cur: Math.min(num(c.hitDice.cur, level), level) } };
      if (def && def.caster) out.spellSlots = slotsFor(def.caster, level);
      return out;
    });
  };

  // ── rests & hit dice ──
  const longRest = () => {
    patch((c) => {
      const spellSlots = {};
      SPELL_LEVELS.forEach((l) => {
        const s = c.spellSlots[l];
        spellSlots[l] = { max: s.max, cur: s.max };
      });
      const maxHD = num(c.hitDice.max, 0);
      const regain = Math.max(1, Math.floor(maxHD / 2));
      const cur = Math.min(maxHD, num(c.hitDice.cur, 0) + regain);
      return {
        hp: { ...c.hp, current: num(c.hp.max, 0), temp: 0 },
        spellSlots,
        hitDice: { ...c.hitDice, cur },
        deathSaves: { s: 0, f: 0 },
      };
    });
    flash("Long rest — HP and spell slots restored; hit dice and death saves recovered.");
  };
  const shortRest = () => {
    const isWarlock = classDef && classDef.caster === "warlock";
    patch((c) => {
      const def = CLASSES[c.cls];
      if (!(def && def.caster === "warlock")) return {};
      const spellSlots = {};
      SPELL_LEVELS.forEach((l) => {
        const s = c.spellSlots[l];
        spellSlots[l] = { max: s.max, cur: s.max };
      });
      return { spellSlots };
    });
    flash(
      isWarlock
        ? "Short rest — pact magic slots restored. Spend Hit Dice below to heal."
        : "Short rest — spend Hit Dice below to heal and recharge short-rest abilities."
    );
  };
  const spendHitDie = () => {
    if (num(active.hitDice.cur, 0) <= 0) {
      flash("No Hit Dice remaining.");
      return;
    }
    if (num(active.hp.current, 0) >= num(active.hp.max, 0)) {
      flash("Already at full HP.");
      return;
    }
    const sides = parseInt(String(active.hitDice.die).replace(/[^0-9]/g, ""), 10) || 8;
    const roll = Math.floor(Math.random() * sides) + 1;
    const heal = Math.max(0, roll + mods.con);
    patch((c) => ({
      hitDice: { ...c.hitDice, cur: num(c.hitDice.cur, 0) - 1 },
      hp: { ...c.hp, current: Math.min(num(c.hp.max, 0), num(c.hp.current, 0) + heal) },
    }));
    flash(`Spent a ${active.hitDice.die}: rolled ${roll} ${fmtMod(mods.con)} CON = ${heal} HP healed.`);
  };

  // ── feats ──
  const addFeat = (name) => {
    if (!name) return;
    const isCustom = name === "__custom";
    patch((c) => ({
      feats: [...(c.feats || []), { id: uid(), name: isCustom ? "" : name, desc: isCustom ? "" : FEATS[name] || "" }],
    }));
  };
  const setFeat = (id, key, value) =>
    patch((c) => ({ feats: (c.feats || []).map((f) => (f.id === id ? { ...f, [key]: value } : f)) }));
  const removeFeat = (id) => patch((c) => ({ feats: (c.feats || []).filter((f) => f.id !== id) }));

  // ── invocations ──
  const toggleInvocation = (name) =>
    patch((c) => {
      const cur = c.invocations || [];
      return { invocations: cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name] };
    });
  const setPatron = (v) => patch({ patron: v });
  const setPact = (v) =>
    patch((c) => {
      const kept = (c.invocations || []).filter((n) => {
        const inv = INVOCATIONS.find((i) => i.name === n);
        return !(inv && isPactPrereq(inv.prereq) && inv.prereq !== v);
      });
      return { pact: v, invocations: kept };
    });

  // ── shared mini inputs (used by attacks & familiar) ──
  const miniText = (label, val, onChange, style = {}) => (
    <div className="ds-mini" key={label}>
      <label>{label}</label>
      <input value={val || ""} style={{ width: 96, textAlign: "left", ...style }} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
  const miniNum = (label, val, onChange) => (
    <div className="ds-mini" key={label}>
      <label>{label}</label>
      <input value={val} inputMode="numeric" onChange={(e) => onChange(num(e.target.value))} />
    </div>
  );
  const miniSel = (label, val, onChange, options) => (
    <div className="ds-mini" key={label}>
      <label>{label}</label>
      <select value={val} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
  const chip = (label, on, onClick) => (
    <div
      className="ds-chip"
      key={label}
      data-on={on ? "1" : "0"}
      role="checkbox"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {label}
    </div>
  );
  const fxField = (val, onChange) => (
    <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
      <label>Effect / notes</label>
      <input value={val || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  // ── familiar ──
  const fam = active.familiar || { enabled: false, attacks: [] };
  const hasInvestment = (active.invocations || []).includes("Investment of the Chain Master");
  const setFam = (key, value) => patch((c) => ({ familiar: { ...c.familiar, [key]: value } }));
  const setFamHP = (key, value) => patch((c) => ({ familiar: { ...c.familiar, hp: { ...c.familiar.hp, [key]: value } } }));
  const summonForm = (form) => {
    const f = FAMILIAR_FORMS[form];
    if (!f) return;
    const attacks = f.attacks.map((a) => ({
      id: uid(), name: "", toHit: 0, dice: "", bonusDmg: 0, damageType: "", hasSave: false,
      saveAbility: "con", fixedDC: 10, useMyDC: false, magical: false, effect: "",
      ...a,
      magical: hasInvestment,
      useMyDC: hasInvestment && !!a.hasSave,
    }));
    patch((c) => ({
      familiar: {
        enabled: true,
        name: c.familiar && c.familiar.name ? c.familiar.name : form === "Custom" ? "" : form,
        form,
        ac: f.ac,
        hp: { current: f.hp, max: f.hp, temp: 0 },
        speed: f.speed,
        notes: (c.familiar && c.familiar.notes) || "",
        attacks,
      },
    }));
    setTab("familiar");
  };
  const dismissFamiliar = () => setFam("enabled", false);
  const resummonFamiliar = () => setFam("enabled", true);
  const addFamAttack = () =>
    patch((c) => ({
      familiar: {
        ...c.familiar,
        attacks: [...(c.familiar.attacks || []), { id: uid(), name: "", toHit: 0, dice: "", bonusDmg: 0, damageType: "", hasSave: false, saveAbility: "con", fixedDC: 10, useMyDC: hasInvestment, magical: hasInvestment, effect: "" }],
      },
    }));
  const setFamAttack = (id, key, value) =>
    patch((c) => ({ familiar: { ...c.familiar, attacks: (c.familiar.attacks || []).map((a) => (a.id === id ? { ...a, [key]: value } : a)) } }));
  const removeFamAttack = (id) =>
    patch((c) => ({ familiar: { ...c.familiar, attacks: (c.familiar.attacks || []).filter((a) => a.id !== id) } }));
  const computeFamiliarAttack = (a) => {
    const charDC = spellDC != null ? spellDC : 8 + pb;
    const damage = a.dice ? `${a.dice}${fmtFlat(num(a.bonusDmg))} ${a.damageType || ""}`.trim() : "—";
    const save = a.hasSave ? `DC ${a.useMyDC ? charDC : num(a.fixedDC)} ${(a.saveAbility || "con").toUpperCase()}` : null;
    const effects = [];
    if (a.magical) effects.push("Counts as magical.");
    if (a.hasSave && a.useMyDC) effects.push("Save DC uses your spell save DC.");
    if (a.effect) effects.push(a.effect);
    return { toHit: fmtMod(num(a.toHit)), damage, save, effects };
  };

  // ── save / export / import ──
  const download = (filename, text) => {
    try {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash("Saved " + filename);
    } catch (e) {
      flash("Download isn't allowed here — use Copy instead.");
    }
  };
  const slug = (s) => (s || "character").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "character";
  const exportOne = () => download(slug(active.name) + ".json", JSON.stringify(active, null, 2));
  const exportAll = () => download("codex-backup.json", JSON.stringify({ version: 1, characters }, null, 2));
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Copied to clipboard.");
    } catch (e) {
      flash("Couldn't copy automatically — select the text and copy it manually.");
    }
  };
  const importText = (text) => {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      flash("That doesn't look like valid JSON.");
      return;
    }
    const hydrated = charactersFromImport(data);
    if (hydrated.length === 0) {
      flash("No characters found in that data.");
      return;
    }
    setCharacters((cs) => [...cs, ...hydrated]);
    setActiveId(hydrated[0].id);
    setShowData(false);
    setImportBuf("");
    setTab("core");
    flash(`Imported ${hydrated.length} character${hydrated.length > 1 ? "s" : ""}.`);
  };
  const onImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importText(String(reader.result));
    reader.onerror = () => flash("Couldn't read that file.");
    reader.readAsText(file);
    e.target.value = ""; // allow re-importing the same file
  };

  // ── render helpers ──
  const Field = (label, value, onChange, props = {}) => (
    <div className="ds-field" key={label}>
      <label>{label}</label>
      <input
        className="ds-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </div>
  );

  const renderTop = () => (
    <div className="ds-top">
      <div className="ds-top-inner">
        <div className="ds-brand">
          CODEX
          <small>5e character sheet</small>
        </div>
        <div className="ds-spacer" />
        <select
          className="ds-select"
          value={activeId}
          onChange={(e) => {
            setActiveId(e.target.value);
            setTab("core");
          }}
        >
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || "Unnamed"}
              {c.cls ? ` · ${c.cls} ${c.level}` : ` · Lv ${c.level}`}
            </option>
          ))}
        </select>
        <button className="ds-btn ds-btn-gold" onClick={addCharacter}>
          + New
        </button>
        <button className="ds-btn ds-btn-ghost" onClick={duplicateCharacter} title="Duplicate">
          Copy
        </button>
        <button className="ds-btn ds-btn-ghost" onClick={() => setShowData(true)} title="Save, export & import">
          Backup
        </button>
        <button className="ds-btn ds-btn-ghost ds-btn-danger" onClick={deleteCharacter} title="Delete">
          Delete
        </button>
      </div>
    </div>
  );

  const TABS = [
    ["core", "Core"],
    ["skills", "Skills"],
    ["magic", "Combat & Magic"],
    ["familiar", "Familiar"],
    ["notes", "Notes & Gear"],
  ];

  const renderTabs = () => (
    <div className="ds-tabs">
      {TABS.map(([k, label]) => (
        <button key={k} className="ds-tab" data-on={tab === k ? "1" : "0"} onClick={() => setTab(k)}>
          {label}
        </button>
      ))}
    </div>
  );

  const renderIdentity = () => {
    const subraceNames = raceDef ? Object.keys(raceDef.subraces || {}) : [];
    return (
      <div className="ds-panel">
        <input
          className="ds-id-name"
          value={active.name}
          placeholder="Character name"
          onChange={(e) => patch({ name: e.target.value })}
        />
        <div className="ds-id-row">
          <div className="ds-field">
            <label>Class</label>
            <select className="ds-input" value={active.cls} onChange={(e) => handleClassChange(e.target.value)}>
              <option value="">— choose —</option>
              {Object.keys(CLASSES).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="ds-field">
            <label>Level</label>
            <input
              className="ds-input"
              value={active.level}
              inputMode="numeric"
              onChange={(e) => handleLevelChange(e.target.value)}
            />
          </div>
          <div className="ds-field">
            <label>Race</label>
            <select className="ds-input" value={active.race} onChange={(e) => handleRaceChange(e.target.value)}>
              <option value="">— choose —</option>
              {Object.keys(RACES).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {subraceNames.length > 0 && (
            <div className="ds-field">
              <label>Subrace</label>
              <select className="ds-input" value={active.subrace} onChange={(e) => handleSubraceChange(e.target.value)}>
                <option value="">— choose —</option>
                {subraceNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          {Field("Background", active.background, (v) => patch({ background: v }), { placeholder: "Sage" })}
          {Field("Alignment", active.alignment, (v) => patch({ alignment: v }), { placeholder: "CG" })}
          {Field("XP", active.xp, (v) => patch({ xp: num(v) }), { inputMode: "numeric" })}
        </div>
        {(raceDef || classDef) && (
          <div className="ds-muted" style={{ marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {raceDef && <span>Size · {raceDef.size}</span>}
            {classDef && <span>Hit die · {classDef.hitDie}</span>}
            {classDef && classDef.caster && (
              <span>Casting · {classDef.caster === "warlock" ? "pact magic" : classDef.caster + " caster"}</span>
            )}
          </div>
        )}
        <label className="ds-chk" style={{ marginTop: 14 }} onClick={() => patch({ inspiration: !active.inspiration })}>
          <span className="ds-chkbox" data-on={active.inspiration ? "1" : "0"}>
            {active.inspiration ? "★" : ""}
          </span>
          Inspiration
        </label>
      </div>
    );
  };

  const renderCombatStats = () => (
    <div className="ds-panel">
      <div className="ds-panel-title">At a glance</div>
      <div className="ds-stats">
        <div className="ds-stat">
          <div className="lab">Armor Class</div>
          <input
            className="ds-input"
            value={active.ac}
            inputMode="numeric"
            onChange={(e) => patch({ ac: num(e.target.value) })}
          />
        </div>
        <div className="ds-stat">
          <div className="lab">Initiative</div>
          <div className="big">{fmtMod(initiative)}</div>
        </div>
        <div className="ds-stat">
          <div className="lab">Speed</div>
          <input
            className="ds-input"
            value={active.speed}
            inputMode="numeric"
            onChange={(e) => patch({ speed: num(e.target.value) })}
          />
        </div>
        <div className="ds-stat">
          <div className="lab">Prof. Bonus</div>
          <div className="big">{fmtMod(pb)}</div>
        </div>
        <div className="ds-stat">
          <div className="lab">Passive Perc.</div>
          <div className="big">{perceptionTotal}</div>
        </div>
      </div>
    </div>
  );

  const renderHP = () => (
    <div className="ds-panel">
      <div className="ds-panel-title">Hit points</div>
      <div className="ds-hp-main">
        <input
          value={active.hp.current}
          inputMode="numeric"
          onChange={(e) => patchObj("hp", "current", num(e.target.value))}
          aria-label="Current hit points"
        />
        <span className="sep">/</span>
        <input
          className="maxin"
          value={active.hp.max}
          inputMode="numeric"
          onChange={(e) => patchObj("hp", "max", num(e.target.value))}
          aria-label="Maximum hit points"
        />
      </div>
      <div className="ds-hp-bar">
        <div className="ds-hp-fill" style={{ width: hpPct + "%" }} />
      </div>
      <div className="ds-hp-tools">
        <input
          className="ds-input"
          placeholder="0"
          inputMode="numeric"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
        />
        <button className="ds-btn" style={{ borderColor: T.crimson, color: T.crimson }} onClick={() => applyHP(-1)}>
          Damage
        </button>
        <button className="ds-btn" style={{ borderColor: T.green, color: T.green }} onClick={() => applyHP(1)}>
          Heal
        </button>
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div className="ds-field" style={{ minWidth: 120 }}>
          <label>Temporary HP</label>
          <input
            className="ds-input"
            style={{ width: 80 }}
            value={active.hp.temp}
            inputMode="numeric"
            onChange={(e) => patchObj("hp", "temp", num(e.target.value))}
          />
        </div>
        <div className="ds-field" style={{ minWidth: 160 }}>
          <label>Hit Dice</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="ds-input"
              style={{ width: 46 }}
              value={active.hitDice.cur}
              inputMode="numeric"
              onChange={(e) => patchObj("hitDice", "cur", num(e.target.value))}
            />
            <span className="ds-muted">/</span>
            <input
              className="ds-input"
              style={{ width: 46 }}
              value={active.hitDice.max}
              inputMode="numeric"
              onChange={(e) => patchObj("hitDice", "max", num(e.target.value))}
            />
            <input
              className="ds-input"
              style={{ width: 58 }}
              value={active.hitDice.die}
              onChange={(e) => patchObj("hitDice", "die", e.target.value)}
            />
            <button className="ds-btn" style={{ padding: "6px 10px" }} onClick={spendHitDie} title="Roll a Hit Die to heal">
              Spend
            </button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: T.faint }}>
          Death saves
        </label>
        <div style={{ display: "flex", gap: 22, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ds-muted" style={{ color: T.green }}>
              Successes
            </span>
            <div className="ds-dots">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="ds-dot"
                  data-kind="s"
                  data-on={active.deathSaves.s > i ? "1" : "0"}
                  onClick={() => patchObj("deathSaves", "s", active.deathSaves.s === i + 1 ? i : i + 1)}
                />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ds-muted" style={{ color: T.crimson }}>
              Failures
            </span>
            <div className="ds-dots">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="ds-dot"
                  data-kind="f"
                  data-on={active.deathSaves.f > i ? "1" : "0"}
                  onClick={() => patchObj("deathSaves", "f", active.deathSaves.f === i + 1 ? i : i + 1)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="ds-rest-row">
        <button className="ds-btn" onClick={shortRest}>
          Short Rest
        </button>
        <button className="ds-btn ds-btn-gold" onClick={longRest}>
          Long Rest
        </button>
      </div>
    </div>
  );

  const renderAbilities = () => (
    <div className="ds-panel">
      <div className="ds-panel-title">Ability scores</div>
      <div className="ds-abil-grid">
        {ABILITIES.map(([k, full, abbr]) => (
          <div className="ds-rune" key={k} title={full}>
            <div className="ab">{abbr}</div>
            <div className="mod">{fmtMod(mods[k])}</div>
            <div className="score">
              <input
                value={active.abilities[k]}
                inputMode="numeric"
                aria-label={full + " base score"}
                onChange={(e) => patchObj("abilities", k, e.target.value === "" ? "" : num(e.target.value))}
              />
              {raceMods[k] !== 0 && <span className="rbonus">{fmtMod(raceMods[k])}</span>}
            </div>
            {raceMods[k] !== 0 && <div className="total">total {totalScore[k]}</div>}
          </div>
        ))}
      </div>
      {raceDef && (
        <p className="ds-muted" style={{ marginTop: 10 }}>
          The box is your base score; the chip is your {active.race} bonus. The modifier uses the total.
        </p>
      )}
    </div>
  );

  const renderSaves = () => (
    <div className="ds-panel">
      <div className="ds-panel-title">Saving throws</div>
      <div className="ds-rowlist">
        {ABILITIES.map(([k, full, abbr]) => {
          const prof = active.savingProfs[k];
          const bonus = mods[k] + (prof ? pb : 0);
          return (
            <div className="ds-row" key={k}>
              <div
                className="ds-pip"
                data-s={prof ? "1" : "0"}
                onClick={() => toggleSave(k)}
                role="checkbox"
                aria-checked={prof}
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleSave(k)}
              >
                {prof ? "●" : ""}
              </div>
              <span className="rabb">{abbr}</span>
              <span className="rname">{full}</span>
              <span className="rbonus">{fmtMod(bonus)}</span>
            </div>
          );
        })}
      </div>
      <p className="ds-muted" style={{ marginTop: 10 }}>
        Tap the marker to toggle proficiency.
      </p>
    </div>
  );

  const renderSkills = () => (
    <div className="ds-panel ds-fade">
      <div className="ds-panel-title">Skills</div>
      <div className="ds-rowlist">
        {SKILLS.map(([k, label, ab]) => {
          const lvl = active.skillProfs[k];
          const bonus = mods[ab] + (lvl === 1 ? pb : 0) + (lvl === 2 ? pb * 2 : 0);
          return (
            <div className="ds-row" key={k}>
              <div
                className="ds-pip"
                data-s={String(lvl)}
                onClick={() => cycleSkill(k)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && cycleSkill(k)}
                title={lvl === 0 ? "Not proficient" : lvl === 1 ? "Proficient" : "Expertise"}
              >
                {lvl === 0 ? "" : lvl === 1 ? "●" : "★"}
              </div>
              <span className="rabb">{ab}</span>
              <span className="rname">{label}</span>
              <span className="rbonus">{fmtMod(bonus)}</span>
            </div>
          );
        })}
      </div>
      <p className="ds-muted" style={{ marginTop: 10 }}>
        Tap once for proficiency (●), twice for expertise (★).
      </p>
    </div>
  );

  const renderAttacks = () => {
    const controls = (a) => {
      if (a.kind === "weapon") {
        return [
          miniSel("Ability", a.ability, (v) => setAttack(a.id, "ability", v), [["str", "STR"], ["dex", "DEX"]]),
          chip("Proficient", a.proficient, () => setAttack(a.id, "proficient", !a.proficient)),
          a.versatile ? chip("Two-handed", a.twoHanded, () => setAttack(a.id, "twoHanded", !a.twoHanded)) : null,
          chip("+mod to dmg", a.addMod, () => setAttack(a.id, "addMod", !a.addMod)),
          miniNum("Magic ±", a.magic, (v) => setAttack(a.id, "magic", v)),
          miniNum("Bonus dmg", a.bonusDmg, (v) => setAttack(a.id, "bonusDmg", v)),
          <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
            <label>Effect / notes</label>
            <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
          </div>,
        ];
      }
      if (a.kind === "custom") {
        return [
          miniSel("Ability", a.ability, (v) => setAttack(a.id, "ability", v), ABILITIES.map(([k, , ab]) => [k, ab])),
          chip("Proficient", a.proficient, () => setAttack(a.id, "proficient", !a.proficient)),
          miniText("Dice", a.dice, (v) => setAttack(a.id, "dice", v), { width: 70, textAlign: "center" }),
          miniText("Type", a.damageType, (v) => setAttack(a.id, "damageType", v)),
          chip("+mod to dmg", a.addMod, () => setAttack(a.id, "addMod", !a.addMod)),
          miniNum("Magic ±", a.magic, (v) => setAttack(a.id, "magic", v)),
          miniNum("Bonus dmg", a.bonusDmg, (v) => setAttack(a.id, "bonusDmg", v)),
          <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
            <label>Effect / notes</label>
            <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
          </div>,
        ];
      }
      if (a.kind === "spell") {
        if (a.eldritchBlast) {
          return [
            miniNum("Magic ±", a.magic, (v) => setAttack(a.id, "magic", v)),
            miniNum("Bonus dmg", a.bonusDmg, (v) => setAttack(a.id, "bonusDmg", v)),
            <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
              <label>Effect / notes</label>
              <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
            </div>,
          ];
        }
        return [
          miniSel("Mode", a.mode, (v) => setAttack(a.id, "mode", v), [["attack", "Attack roll"], ["save", "Saving throw"]]),
          a.mode === "save"
            ? miniSel("Save", a.saveAbility || "dex", (v) => setAttack(a.id, "saveAbility", v), ABILITIES.map(([k, , ab]) => [k, ab]))
            : null,
          miniText("Dice", a.dice, (v) => setAttack(a.id, "dice", v), { width: 70, textAlign: "center" }),
          miniText("Type", a.damageType, (v) => setAttack(a.id, "damageType", v)),
          chip("+mod to dmg", a.addMod, () => setAttack(a.id, "addMod", !a.addMod)),
          miniNum(a.mode === "save" ? "DC ±" : "Magic ±", a.magic, (v) => setAttack(a.id, "magic", v)),
          miniNum("Bonus dmg", a.bonusDmg, (v) => setAttack(a.id, "bonusDmg", v)),
          <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
            <label>Effect / notes</label>
            <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
          </div>,
        ];
      }
      // manual
      return [
        miniText("To hit", a.toHit, (v) => setAttack(a.id, "toHit", v), { width: 90 }),
        miniText("Damage", a.damage, (v) => setAttack(a.id, "damage", v), { width: 140 }),
        <div className="ds-mini" key="fx" style={{ flex: "1 1 100%" }}>
          <label>Effect / notes</label>
          <input value={a.effect || ""} style={{ width: "100%", textAlign: "left" }} onChange={(e) => setAttack(a.id, "effect", e.target.value)} />
        </div>,
      ];
    };

    const kindLabel = { weapon: "weapon", spell: "spell", custom: "custom", manual: "manual" };
    const attacks = active.attacks || [];

    return (
      <div className="ds-panel">
        <div className="ds-panel-title">Attacks</div>
        <div className="ds-add-row">
          <select className="ds-input" value="" onChange={(e) => addWeapon(e.target.value)}>
            <option value="">+ Add weapon…</option>
            {WEAPONS.map((w) => (
              <option key={w.name} value={w.name}>
                {w.name} ({w.dice} {w.type})
              </option>
            ))}
          </select>
          <button className="ds-btn" onClick={addEldritchBlast}>
            + Eldritch Blast
          </button>
          <button className="ds-btn" onClick={addSpell}>
            + Spell
          </button>
          <button className="ds-btn" onClick={addCustom}>
            + Custom
          </button>
          <button className="ds-btn ds-btn-ghost" onClick={addManual}>
            + Manual
          </button>
        </div>

        {attacks.length === 0 && (
          <div className="ds-empty">No attacks yet — add a weapon, Eldritch Blast, or a custom attack above.</div>
        )}

        {attacks.map((a) => {
          const r = computeAttack(a);
          return (
            <div className="ds-atk" key={a.id}>
              <div className="ds-atk-top">
                <input
                  className="ds-input ds-atk-name"
                  placeholder="Name"
                  value={a.name}
                  onChange={(e) => setAttack(a.id, "name", e.target.value)}
                />
                <span className="ds-atk-kind">{kindLabel[a.kind] || "attack"}</span>
                <button className="ds-icon-btn" onClick={() => removeAttack(a.id)} aria-label="Remove attack">
                  ✕
                </button>
              </div>

              <div className="ds-atk-result">
                <div className="ds-atk-stat">
                  <div className="lab">{r.save ? "Spell save DC" : r.perBeam ? "To hit (each beam)" : "To hit"}</div>
                  <div className="val">{r.save ? r.save : r.toHit}</div>
                  {r.toHitParts && <div className="src">{r.toHitParts.join(" · ")}</div>}
                </div>
                <div className="ds-atk-stat">
                  <div className="lab">{r.perBeam ? `Damage (×${r.beams})` : "Damage"}</div>
                  <div className="val">{r.damage}</div>
                  {r.damageParts && r.damageParts.length > 0 && <div className="src">{r.damageParts.join(" · ")}</div>}
                </div>
              </div>

              {r.effects && r.effects.length > 0 && (
                <ul className="ds-atk-fx">
                  {r.effects.map((fx, i) => (
                    <li key={i}>{fx}</li>
                  ))}
                </ul>
              )}

              <div className="ds-atk-ctl">{controls(a)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSpellcasting = () => (
    <div className="ds-panel">
      <div className="ds-panel-title">Spellcasting</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <div className="ds-field">
          <label>Casting ability</label>
          <select
            className="ds-select"
            value={active.spellAbility}
            onChange={(e) => patch({ spellAbility: e.target.value })}
          >
            <option value="">— none —</option>
            {ABILITIES.map(([k, full]) => (
              <option key={k} value={k}>
                {full}
              </option>
            ))}
          </select>
        </div>
        {spellDC !== null && (
          <>
            <div className="ds-stat" style={{ minWidth: 90 }}>
              <div className="lab">Save DC</div>
              <div className="big" style={{ color: T.violet }}>
                {spellDC}
              </div>
            </div>
            <div className="ds-stat" style={{ minWidth: 90 }}>
              <div className="lab">Spell Atk</div>
              <div className="big" style={{ color: T.violet }}>
                {fmtMod(spellAtk)}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="ds-slots">
        {SPELL_LEVELS.map((lvl) => {
          const slot = active.spellSlots[lvl];
          const used = slot.max - slot.cur;
          return (
            <div className="ds-slot" key={lvl}>
              <div className="lv">LEVEL {lvl}</div>
              <div className="sl-pips">
                {Array.from({ length: slot.max }).map((_, i) => (
                  <div
                    key={i}
                    className="ds-sp"
                    data-on={i < used ? "1" : "0"}
                    onClick={() => toggleSlot(lvl, i)}
                    title={i < used ? "Used — tap to restore" : "Available — tap to spend"}
                  />
                ))}
                {slot.max === 0 && <span className="ds-muted">—</span>}
              </div>
              <div className="sl-max">
                slots
                <input
                  value={slot.max}
                  inputMode="numeric"
                  onChange={(e) => setSlotMax(lvl, e.target.value)}
                  aria-label={`Level ${lvl} max slots`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="ds-muted" style={{ marginTop: 12 }}>
        Set the number of slots per level, then tap a circle to spend or restore one.
      </p>
    </div>
  );

  const renderFamiliar = () => {
    const charDC = spellDC != null ? spellDC : 8 + pb;
    if (!fam.enabled) {
      const hasData = (fam.attacks && fam.attacks.length) || fam.name || fam.form;
      return (
        <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
          <div className="ds-panel">
            <div className="ds-panel-title">Familiar</div>
            <p className="ds-muted" style={{ marginBottom: 14 }}>
              No active familiar. With Pact of the Chain you can summon one of the special forms below; any caster with find familiar can also use these.
            </p>
            <div className="ds-add-row">
              {Object.keys(FAMILIAR_FORMS).map((form) => (
                <button key={form} className="ds-btn" onClick={() => summonForm(form)}>
                  {form === "Custom" ? "+ Custom" : `+ ${form}`}
                </button>
              ))}
              {hasData && (
                <button className="ds-btn ds-btn-gold" onClick={resummonFamiliar}>
                  Resummon {fam.name || fam.form}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    const famHpPct = fam.hp.max > 0 ? Math.max(0, Math.min(100, (fam.hp.current / fam.hp.max) * 100)) : 0;
    return (
      <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
        <div className="ds-panel">
          <div className="ds-atk-top">
            <input className="ds-input ds-atk-name" placeholder="Familiar name" value={fam.name} onChange={(e) => setFam("name", e.target.value)} />
            <span className="ds-atk-kind">{fam.form || "familiar"}</span>
            <button className="ds-btn ds-btn-ghost" onClick={dismissFamiliar} style={{ padding: "6px 10px" }}>
              Dismiss
            </button>
          </div>
          <div className="ds-stats" style={{ marginBottom: 12 }}>
            <div className="ds-stat">
              <div className="lab">Armor Class</div>
              <input className="ds-input" value={fam.ac} inputMode="numeric" onChange={(e) => setFam("ac", num(e.target.value))} />
            </div>
            <div className="ds-stat" style={{ gridColumn: "span 2" }}>
              <div className="lab">Hit points</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 }}>
                <input className="ds-input" style={{ width: 56 }} value={fam.hp.current} inputMode="numeric" onChange={(e) => setFamHP("current", num(e.target.value))} />
                <span className="ds-muted">/</span>
                <input className="ds-input" style={{ width: 56 }} value={fam.hp.max} inputMode="numeric" onChange={(e) => setFamHP("max", num(e.target.value))} />
              </div>
            </div>
          </div>
          <div className="ds-hp-bar">
            <div className="ds-hp-fill" style={{ width: famHpPct + "%" }} />
          </div>
          <div className="ds-field" style={{ marginTop: 6 }}>
            <label>Speed</label>
            <input className="ds-input" value={fam.speed} placeholder="e.g. 20 ft, fly 40 ft" onChange={(e) => setFam("speed", e.target.value)} />
          </div>
          <p className="ds-pp-desc">
            Linked to you — proficiency <b>{fmtMod(pb)}</b>, your spell save DC <b>{charDC}</b>.
            {hasInvestment
              ? " Investment of the Chain Master: its attacks are magical and its saves use your DC (already applied below)."
              : " Take Investment of the Chain Master to make its attacks magical and use your save DC."}
          </p>
        </div>

        <div className="ds-panel">
          <div className="ds-panel-title">Familiar attacks</div>
          {(fam.attacks || []).length === 0 && <div className="ds-empty">No attacks yet — add one below.</div>}
          {(fam.attacks || []).map((a) => {
            const r = computeFamiliarAttack(a);
            return (
              <div className="ds-atk" key={a.id}>
                <div className="ds-atk-top">
                  <input className="ds-input ds-atk-name" placeholder="Attack name" value={a.name} onChange={(e) => setFamAttack(a.id, "name", e.target.value)} />
                  <button className="ds-icon-btn" onClick={() => removeFamAttack(a.id)} aria-label="Remove attack">
                    ✕
                  </button>
                </div>
                <div className="ds-atk-result">
                  <div className="ds-atk-stat">
                    <div className="lab">To hit</div>
                    <div className="val">{r.toHit}</div>
                  </div>
                  <div className="ds-atk-stat">
                    <div className="lab">Damage{r.save ? " + save" : ""}</div>
                    <div className="val">{r.damage}</div>
                    {r.save && <div className="src">{r.save} save</div>}
                  </div>
                </div>
                {r.effects.length > 0 && (
                  <ul className="ds-atk-fx">
                    {r.effects.map((fx, i) => (
                      <li key={i}>{fx}</li>
                    ))}
                  </ul>
                )}
                <div className="ds-atk-ctl">
                  {miniNum("To hit ±", a.toHit, (v) => setFamAttack(a.id, "toHit", v))}
                  {miniText("Dice", a.dice, (v) => setFamAttack(a.id, "dice", v), { width: 70, textAlign: "center" })}
                  {miniNum("Bonus dmg", a.bonusDmg, (v) => setFamAttack(a.id, "bonusDmg", v))}
                  {miniText("Type", a.damageType, (v) => setFamAttack(a.id, "damageType", v))}
                  {chip("Magical", a.magical, () => setFamAttack(a.id, "magical", !a.magical))}
                  {chip("Has save", a.hasSave, () => setFamAttack(a.id, "hasSave", !a.hasSave))}
                  {a.hasSave ? miniSel("Save", a.saveAbility || "con", (v) => setFamAttack(a.id, "saveAbility", v), ABILITIES.map(([k, , ab]) => [k, ab])) : null}
                  {a.hasSave ? chip("Use my DC", a.useMyDC, () => setFamAttack(a.id, "useMyDC", !a.useMyDC)) : null}
                  {a.hasSave && !a.useMyDC ? miniNum("Fixed DC", a.fixedDC, (v) => setFamAttack(a.id, "fixedDC", v)) : null}
                  {fxField(a.effect, (v) => setFamAttack(a.id, "effect", v))}
                </div>
              </div>
            );
          })}
          <button className="ds-btn" style={{ marginTop: 6 }} onClick={addFamAttack}>
            + Add familiar attack
          </button>
        </div>

        <div className="ds-panel">
          <div className="ds-panel-title">Familiar notes</div>
          <textarea className="ds-textarea" placeholder="Senses, special abilities, conditions…" value={fam.notes} onChange={(e) => setFam("notes", e.target.value)} />
        </div>
      </div>
    );
  };

  const renderNotes = () => (
    <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
      {traitList.length > 0 && (
        <div className="ds-panel">
          <div className="ds-panel-title">
            {active.race}
            {active.subrace ? ` · ${active.subrace}` : ""} traits
          </div>
          <p className="ds-auto-note">Filled in automatically from your race. Summaries — check your sourcebook for full rules.</p>
          {traitList.map(([name, desc], i) => (
            <div className="ds-feat" key={i}>
              <span className="fn">{name}</span>
              <div className="fd">{desc}</div>
            </div>
          ))}
        </div>
      )}
      {classFeatures.length > 0 && (
        <div className="ds-panel">
          <div className="ds-panel-title">
            {active.cls} features · level {num(active.level, 1)}
          </div>
          <p className="ds-auto-note">Shows the features you've gained so far. Summaries — check your sourcebook for full rules.</p>
          {classFeatures.map((f, i) => (
            <div className="ds-feat" key={i}>
              <span className="fn">{f.name}</span>
              <span className="flv">Lv {f.level}</span>
              <div className="fd">{f.desc}</div>
            </div>
          ))}
        </div>
      )}
      {isWarlock && (
        <div className="ds-panel">
          <div className="ds-panel-title">Patron & Pact</div>
          <div className="ds-id-row" style={{ marginTop: 0 }}>
            <div className="ds-field">
              <label>Otherworldly Patron</label>
              <select className="ds-input" value={active.patron || ""} onChange={(e) => setPatron(e.target.value)}>
                <option value="">— choose —</option>
                {Object.keys(PATRONS).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="ds-field">
              <label>Pact Boon{lvlClamped < 3 ? " (level 3+)" : ""}</label>
              <select
                className="ds-input"
                value={active.pact || ""}
                disabled={lvlClamped < 3}
                onChange={(e) => setPact(e.target.value)}
              >
                <option value="">— choose —</option>
                {Object.keys(PACTS).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {active.patron && PATRONS[active.patron] && (
            <p className="ds-pp-desc">
              <b>{active.patron}:</b> {PATRONS[active.patron]}
            </p>
          )}
          {lvlClamped >= 3 && active.pact && PACTS[active.pact] && (
            <p className="ds-pp-desc">
              <b>{active.pact}:</b> {PACTS[active.pact]}
            </p>
          )}
        </div>
      )}
      {isWarlock && (
        <div className="ds-panel">
          <div className="ds-panel-title">Eldritch Invocations</div>
          <p className="ds-auto-note">
            Chosen{" "}
            <span className="ds-count" data-over={invChosen > invKnownAllowed ? "1" : "0"}>
              {invChosen} / {invKnownAllowed}
            </span>{" "}
            known at level {lvlClamped}. Shows invocations available at your level
            {active.pact ? `, matching ${active.pact}` : ""}.
            {hasEldritchAdept ? " Includes +1 from Eldritch Adept." : ""}
          </p>
          {availableInvocations.map((inv) => {
            const on = (active.invocations || []).includes(inv.name);
            return (
              <div
                key={inv.name}
                className="ds-inv"
                data-on={on ? "1" : "0"}
                role="checkbox"
                aria-checked={on}
                tabIndex={0}
                onClick={() => toggleInvocation(inv.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleInvocation(inv.name);
                  }
                }}
              >
                <div className="ds-inv-check">{on ? "✓" : ""}</div>
                <div>
                  <div className="ds-inv-name">
                    {inv.name}
                    {inv.level > 1 && <span className="ds-inv-lv">Lv {inv.level}</span>}
                    {inv.prereq && <span className="ds-inv-tag">{inv.prereq}</span>}
                  </div>
                  <div className="ds-inv-desc">{inv.desc}</div>
                </div>
              </div>
            );
          })}
          {orphanInvocations.length > 0 && (
            <>
              <p className="ds-muted" style={{ marginTop: 10 }}>
                Selected but unavailable now (level or pact changed) — tap to remove:
              </p>
              {orphanInvocations.map((name) => (
                <div
                  key={name}
                  className="ds-inv"
                  data-on="1"
                  style={{ opacity: 0.7 }}
                  role="checkbox"
                  aria-checked={true}
                  tabIndex={0}
                  onClick={() => toggleInvocation(name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleInvocation(name);
                    }
                  }}
                >
                  <div className="ds-inv-check">✓</div>
                  <div>
                    <div className="ds-inv-name">
                      {name}
                      <span className="ds-inv-lv">unavailable</span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          {lockedInvCount > 0 && (
            <p className="ds-muted" style={{ marginTop: 4 }}>
              {lockedInvCount} more become available at higher levels or with a different pact.
            </p>
          )}
        </div>
      )}
      <div className="ds-panel">
        <div className="ds-panel-title">Feats</div>
        <div className="ds-feat-add">
          <select className="ds-input" value="" onChange={(e) => addFeat(e.target.value)}>
            <option value="">+ Add a feat…</option>
            <option value="__custom">Custom feat (blank)</option>
            {Object.keys(FEATS).sort().map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {(active.feats || []).length === 0 && (
          <div className="ds-empty">No feats yet — pick one above, or add a custom entry.</div>
        )}
        {(active.feats || []).map((f) => (
          <div className="ds-feat-item" key={f.id}>
            <div className="ds-feat-head">
              <input
                className="ds-input fname"
                value={f.name}
                placeholder="Feat name"
                onChange={(e) => setFeat(f.id, "name", e.target.value)}
              />
              <button className="ds-icon-btn" onClick={() => removeFeat(f.id)} aria-label="Remove feat">
                ✕
              </button>
            </div>
            <textarea
              className="ds-textarea fdesc"
              value={f.desc}
              placeholder="What it does…"
              onChange={(e) => setFeat(f.id, "desc", e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="ds-panel">
        <div className="ds-panel-title">Other features & notes</div>
        <textarea
          className="ds-textarea"
          placeholder="Feats, subclass features, anything to track yourself…"
          value={active.features}
          onChange={(e) => patch({ features: e.target.value })}
        />
      </div>
      <div className="ds-panel">
        <div className="ds-panel-title">Equipment & treasure</div>
        <textarea
          className="ds-textarea"
          placeholder="Weapons, armor, gear, coin…"
          value={active.equipment}
          onChange={(e) => patch({ equipment: e.target.value })}
        />
      </div>
      <div className="ds-panel">
        <div className="ds-panel-title">Backstory & notes</div>
        <textarea
          className="ds-textarea"
          placeholder="Personality, bonds, ideals, flaws, session notes…"
          value={active.bio}
          onChange={(e) => patch({ bio: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className="ds-root">
      <style>{CSS}</style>
      {renderTop()}
      <div className="ds-wrap">
        {renderTabs()}

        {tab === "core" && (
          <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
            {renderIdentity()}
            {renderCombatStats()}
            <div
              className="ds-grid"
              style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", marginTop: 0 }}
            >
              {renderHP()}
              {renderAbilities()}
            </div>
            {renderSaves()}
          </div>
        )}

        {tab === "skills" && <div className="ds-grid" style={{ gridTemplateColumns: "1fr" }}>{renderSkills()}</div>}

        {tab === "magic" && (
          <div className="ds-grid ds-fade" style={{ gridTemplateColumns: "1fr" }}>
            {renderAttacks()}
            {renderSpellcasting()}
          </div>
        )}

        {tab === "familiar" && renderFamiliar()}

        {tab === "notes" && renderNotes()}

        {!hasStorage && (
          <p className="ds-muted" style={{ textAlign: "center", marginTop: 24 }}>
            Note: persistent saving isn't available here, so changes last only for this session.
          </p>
        )}
      </div>
      {showData && (
        <div className="ds-modal-bg" onClick={() => setShowData(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-head">
              <div className="ds-panel-title" style={{ margin: 0 }}>
                Save · Export · Import
              </div>
              <button className="ds-icon-btn" onClick={() => setShowData(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="ds-muted">
              Characters save automatically on this device. Export to keep a backup or move them to another device.
            </p>

            <div className="ds-modal-sec">
              <div className="ds-sec-label">Export</div>
              <div className="ds-btn-row">
                <button className="ds-btn ds-btn-gold" onClick={exportOne}>
                  Download this character
                </button>
                <button className="ds-btn" onClick={exportAll}>
                  Download all ({characters.length})
                </button>
                <button className="ds-btn ds-btn-ghost" onClick={() => copyText(JSON.stringify(active, null, 2))}>
                  Copy
                </button>
              </div>
              <textarea
                className="ds-textarea"
                readOnly
                style={{ minHeight: 90, marginTop: 10, fontSize: 12 }}
                value={JSON.stringify(active, null, 2)}
                onClick={(e) => e.target.select()}
              />
            </div>

            <div className="ds-modal-sec">
              <div className="ds-sec-label">Import</div>
              <label className="ds-btn ds-btn-gold">
                Choose a .json file
                <input
                  type="file"
                  accept="application/json,.json"
                  style={{ display: "none" }}
                  onChange={onImportFile}
                />
              </label>
              <p className="ds-muted" style={{ margin: "12px 0 6px" }}>
                …or paste exported text:
              </p>
              <textarea
                className="ds-textarea"
                style={{ minHeight: 90, fontSize: 12 }}
                value={importBuf}
                placeholder='Paste a character or backup, e.g. {"name":"Hilda", ...}'
                onChange={(e) => setImportBuf(e.target.value)}
              />
              <button className="ds-btn ds-btn-gold" style={{ marginTop: 8 }} onClick={() => importText(importBuf)}>
                Import from text
              </button>
              <p className="ds-muted" style={{ marginTop: 8 }}>
                Imports are added as new characters — they never overwrite your existing ones.
              </p>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="ds-toast">{toast.text}</div>}
    </div>
  );
}
