export type ClassProficiencies = {
  savingThrows: string[];
  skillChoices: { count: number; skills: string[] };
  armorProficiencies: string;
  weaponProficiencies: string;
};

export const CLASS_PROFICIENCIES: Record<string, ClassProficiencies> = {
  Barbarian: {
    savingThrows: ["STR", "CON"],
    skillChoices: { count: 2, skills: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"] },
    armorProficiencies: "Light and Medium armor; Shields",
    weaponProficiencies: "Simple and Martial weapons",
  },
  Bard: {
    savingThrows: ["DEX", "CHA"],
    skillChoices: {
      count: 3,
      skills: ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"],
    },
    armorProficiencies: "Light armor",
    weaponProficiencies: "Simple weapons, hand crossbows, longswords, rapiers, shortswords",
  },
  Cleric: {
    savingThrows: ["WIS", "CHA"],
    skillChoices: { count: 2, skills: ["History", "Insight", "Medicine", "Persuasion", "Religion"] },
    armorProficiencies: "Light and Medium armor; Shields",
    weaponProficiencies: "Simple weapons",
  },
  Druid: {
    savingThrows: ["INT", "WIS"],
    skillChoices: { count: 2, skills: ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"] },
    armorProficiencies: "Light and Medium armor (non-metal); Shields (non-metal)",
    weaponProficiencies: "Clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears",
  },
  Fighter: {
    savingThrows: ["STR", "CON"],
    skillChoices: { count: 2, skills: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"] },
    armorProficiencies: "All armor; Shields",
    weaponProficiencies: "Simple and Martial weapons",
  },
  Monk: {
    savingThrows: ["STR", "DEX"],
    skillChoices: { count: 2, skills: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"] },
    armorProficiencies: "None",
    weaponProficiencies: "Simple weapons, shortswords",
  },
  Paladin: {
    savingThrows: ["WIS", "CHA"],
    skillChoices: { count: 2, skills: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"] },
    armorProficiencies: "All armor; Shields",
    weaponProficiencies: "Simple and Martial weapons",
  },
  Ranger: {
    savingThrows: ["STR", "DEX"],
    skillChoices: { count: 3, skills: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"] },
    armorProficiencies: "Light and Medium armor; Shields",
    weaponProficiencies: "Simple and Martial weapons",
  },
  Rogue: {
    savingThrows: ["DEX", "INT"],
    skillChoices: {
      count: 4,
      skills: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"],
    },
    armorProficiencies: "Light armor",
    weaponProficiencies: "Simple weapons, hand crossbows, longswords, rapiers, shortswords",
  },
  Sorcerer: {
    savingThrows: ["CON", "CHA"],
    skillChoices: { count: 2, skills: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"] },
    armorProficiencies: "None",
    weaponProficiencies: "Daggers, darts, slings, quarterstaffs, light crossbows",
  },
  Warlock: {
    savingThrows: ["WIS", "CHA"],
    skillChoices: { count: 2, skills: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"] },
    armorProficiencies: "Light armor",
    weaponProficiencies: "Simple weapons",
  },
  Wizard: {
    savingThrows: ["INT", "WIS"],
    skillChoices: { count: 2, skills: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"] },
    armorProficiencies: "None",
    weaponProficiencies: "Daggers, darts, slings, quarterstaffs, light crossbows",
  },
};

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
export const POINT_BUY_BUDGET = 27;

export function calcPointBuyCost(scores: Record<string, number>): number {
  return Object.values(scores).reduce((total, val) => total + (POINT_BUY_COST[val] ?? 0), 0);
}
