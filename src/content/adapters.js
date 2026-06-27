// Adapters: normalize loaded JSON into the shapes the component already consumes. Pure.

export const adaptRaces = (rows) =>
  Object.fromEntries(
    rows.map((r) => [
      r.name,
      {
        asi: r.abilityBonuses || {},
        speed: r.speed,
        size: r.size,
        traits: (r.traits || []).map((t) => [t.name, t.description]),
        subraces: Object.fromEntries(
          (r.subraces || []).map((s) => {
            const sub = { asi: s.abilityBonuses || {}, traits: (s.traits || []).map((t) => [t.name, t.description]) };
            if (s.speed != null) sub.speed = s.speed;
            return [s.name, sub];
          })
        ),
      },
    ])
  );

export const adaptClasses = (rows) =>
  Object.fromEntries(
    rows.map((c) => [
      c.id,
      {
        name: c.name,
        hitDie: c.hitDie,
        saves: c.savingThrows || [],
        spellAbility: (c.spellcasting && c.spellcasting.ability) || "",
        caster: (c.spellcasting && c.spellcasting.type) || null,
        learning: (c.spellcasting && c.spellcasting.learningType) || null,
        features: (c.features || []).map((f) => ({ level: f.level, name: f.name, desc: f.description })),
        resources: c.resources || [],
        mechanics: c.mechanics || [],
      },
    ])
  );

export const adaptSkills = (rows) => rows.map((s) => [s.id, s.name, s.ability]);
export const adaptFeats = (rows) => Object.fromEntries(rows.map((f) => [f.name, f.description]));
export const adaptWeapons = (rows) =>
  rows.map((w) => ({ name: w.name, dice: w.damage, type: w.damageType, versatile: w.versatileDamage, props: w.properties || [] }));
export const adaptInvocations = (rows) =>
  rows.map((i) => ({ name: i.name, level: i.prerequisiteLevel, prereq: i.prerequisite || "", desc: i.description }));
export const adaptPatrons = (rows) => Object.fromEntries(rows.map((p) => [p.name, p.description]));
export const adaptPacts = (rows) => Object.fromEntries(rows.map((p) => [p.name, p.description]));
export const adaptSpells = (rows) =>
  rows.map((s) => ({
    id: s.id,
    name: s.name,
    level: s.level ?? 0,
    school: s.school || "",
    castingTime: s.castingTime || "",
    range: s.range || "",
    duration: s.duration || "",
    concentration: !!s.concentration,
    ritual: !!s.ritual,
    classes: Array.isArray(s.classes) ? s.classes : [],
    description: s.description || "",
    action: s.action || null,
  }));

export const MECHANIC_ADAPTERS = {
  invocations: adaptInvocations,
  patrons: adaptPatrons,
  pacts: adaptPacts,
};
