// D&D 5e starting-equipment rules: armor, weapons, class proficiencies, and the
// curated starter loadouts surfaced during character creation.
//
// AC is computed live from a character's inventory (see computeAC in spellData.ts),
// so anything chosen here that lands in inventory is automatically reflected on the
// party cards and in the game. This module is the single source of truth for what a
// class is *allowed* to start with and how each piece of gear behaves.

// ── Armor ───────────────────────────────────────────────────────────────────────
export type ArmorCategory = "light" | "medium" | "heavy";

export type ArmorItem = {
  name: string;
  category: ArmorCategory;
  baseAC: number;
  /** medium armor caps the DEX bonus (2). light = full DEX, heavy = no DEX. */
  dexCap?: number;
  strReq?: number;
  stealthDisadvantage?: boolean;
  metal: boolean;            // Druids will not wear metal armor
};

// Sentinel inventory entry meaning "explicitly chose no armor" — lets computeAC
// tell a deliberately-unarmored new character (10 + DEX) apart from a legacy
// character that simply has no armor data (class-default AC). Never shown to the
// player as a real item; it is plain traveling clothes.
export const UNARMORED_MARKER = "Traveler's Clothes";

export const ARMOR_CATALOG: ArmorItem[] = [
  // Light — AC = base + full DEX
  { name: "Padded",          category: "light",  baseAC: 11, stealthDisadvantage: true, metal: false },
  { name: "Leather",         category: "light",  baseAC: 11, metal: false },
  { name: "Studded Leather", category: "light",  baseAC: 12, metal: true  },
  // Medium — AC = base + min(DEX, 2)
  { name: "Hide",            category: "medium", baseAC: 12, dexCap: 2, metal: false },
  { name: "Chain Shirt",     category: "medium", baseAC: 13, dexCap: 2, metal: true  },
  { name: "Scale Mail",      category: "medium", baseAC: 14, dexCap: 2, stealthDisadvantage: true, metal: true },
  { name: "Breastplate",     category: "medium", baseAC: 14, dexCap: 2, metal: true  },
  { name: "Half Plate",      category: "medium", baseAC: 15, dexCap: 2, stealthDisadvantage: true, metal: true },
  // Heavy — AC = base (no DEX)
  { name: "Ring Mail",       category: "heavy",  baseAC: 14, stealthDisadvantage: true, metal: true },
  { name: "Chain Mail",      category: "heavy",  baseAC: 16, strReq: 13, stealthDisadvantage: true, metal: true },
  { name: "Splint",          category: "heavy",  baseAC: 17, strReq: 15, stealthDisadvantage: true, metal: true },
  { name: "Plate",           category: "heavy",  baseAC: 18, strReq: 15, stealthDisadvantage: true, metal: true },
];

const ARMOR_BY_NAME = new Map(ARMOR_CATALOG.map(a => [a.name.toLowerCase(), a]));
// Longest names first so "Half Plate" wins over "Plate", "Studded Leather" over "Leather".
const ARMOR_BY_LENGTH = [...ARMOR_CATALOG].sort((a, b) => b.name.length - a.name.length);
// Legacy / alternate spellings the DM or older saves may use.
const ARMOR_ALIASES: Record<string, string> = {
  "plate mail": "Plate", "full plate": "Plate", "platemail": "Plate",
  "studded":    "Studded Leather", "chainmail": "Chain Mail",
};

export function armorByName(name: string): ArmorItem | undefined {
  return ARMOR_BY_NAME.get(name.trim().toLowerCase());
}

/** Find the (highest-AC) real armor referenced anywhere in a gear string. Ignores
 *  the unarmored marker. Used by computeAC and by the loot/AC plumbing. */
export function findEquippedArmor(gear: string): ArmorItem | null {
  const g = gear.toLowerCase();
  for (const [alias, canonical] of Object.entries(ARMOR_ALIASES)) {
    if (g.includes(alias)) return armorByName(canonical) ?? null;
  }
  for (const armor of ARMOR_BY_LENGTH) {
    if (g.includes(armor.name.toLowerCase())) return armor;
  }
  return null;
}

/** Base AC granted by a worn armor at a given DEX modifier (no shield). */
export function armorBaseAC(armor: ArmorItem, dexMod: number): number {
  if (armor.category === "light")  return armor.baseAC + dexMod;
  if (armor.category === "medium") return armor.baseAC + Math.min(dexMod, armor.dexCap ?? 2);
  return armor.baseAC; // heavy
}

// ── Weapons ─────────────────────────────────────────────────────────────────────
// Hands: how the weapon occupies your hands.
//  "1h"        — one-handed; leaves a hand free for a shield or an off-hand weapon
//  "versatile" — usable one- OR two-handed (bigger die in two hands); a shield is
//                fine because you simply wield it one-handed
//  "2h"        — needs both hands; no shield, no off-hand weapon
export type WeaponHands = "1h" | "versatile" | "2h";

export type WeaponItem = {
  name: string;
  category: "simple" | "martial";
  kind: "melee" | "ranged";
  damage: string;            // one-handed damage, e.g. "1d8 slashing"
  icon: string;
  hands: WeaponHands;
  versatileDamage?: string;  // two-handed die for versatile weapons, e.g. "1d10"
  light?: boolean;           // eligible for two-weapon fighting (dual wield) if also melee
  finesse?: boolean;         // may use DEX instead of STR
  thrown?: boolean;
  ammunition?: boolean;      // needs ammo (bows / crossbows / slings)
};

export const WEAPON_CATALOG: WeaponItem[] = [
  // Simple melee
  { name: "Dagger",         category: "simple",  kind: "melee",  damage: "1d4 piercing",    icon: "🗡️", hands: "1h", light: true, finesse: true, thrown: true },
  { name: "Quarterstaff",   category: "simple",  kind: "melee",  damage: "1d6 bludgeoning", icon: "🪵", hands: "versatile", versatileDamage: "1d8" },
  { name: "Mace",           category: "simple",  kind: "melee",  damage: "1d6 bludgeoning", icon: "🔨", hands: "1h" },
  { name: "Handaxe",        category: "simple",  kind: "melee",  damage: "1d6 slashing",    icon: "🪓", hands: "1h", light: true, thrown: true },
  { name: "Spear",          category: "simple",  kind: "melee",  damage: "1d6 piercing",    icon: "🔱", hands: "versatile", versatileDamage: "1d8", thrown: true },
  { name: "Javelin",        category: "simple",  kind: "melee",  damage: "1d6 piercing",    icon: "🔱", hands: "1h", thrown: true },
  { name: "Sickle",         category: "simple",  kind: "melee",  damage: "1d4 slashing",    icon: "🪝", hands: "1h", light: true },
  { name: "Club",           category: "simple",  kind: "melee",  damage: "1d4 bludgeoning", icon: "🏏", hands: "1h", light: true },
  // Simple ranged
  { name: "Light Crossbow", category: "simple",  kind: "ranged", damage: "1d8 piercing",    icon: "🎯", hands: "2h", ammunition: true },
  { name: "Shortbow",       category: "simple",  kind: "ranged", damage: "1d6 piercing",    icon: "🏹", hands: "2h", ammunition: true },
  { name: "Sling",          category: "simple",  kind: "ranged", damage: "1d4 bludgeoning", icon: "➰", hands: "1h", ammunition: true },
  { name: "Dart",           category: "simple",  kind: "ranged", damage: "1d4 piercing",    icon: "📌", hands: "1h", finesse: true, thrown: true },
  // Martial melee
  { name: "Longsword",      category: "martial", kind: "melee",  damage: "1d8 slashing",    icon: "⚔️", hands: "versatile", versatileDamage: "1d10" },
  { name: "Shortsword",     category: "martial", kind: "melee",  damage: "1d6 piercing",    icon: "🗡️", hands: "1h", light: true, finesse: true },
  { name: "Rapier",         category: "martial", kind: "melee",  damage: "1d8 piercing",    icon: "🤺", hands: "1h", finesse: true },
  { name: "Scimitar",       category: "martial", kind: "melee",  damage: "1d6 slashing",    icon: "⚔️", hands: "1h", light: true, finesse: true },
  { name: "Warhammer",      category: "martial", kind: "melee",  damage: "1d8 bludgeoning", icon: "⚒️", hands: "versatile", versatileDamage: "1d10" },
  { name: "Battleaxe",      category: "martial", kind: "melee",  damage: "1d8 slashing",    icon: "🪓", hands: "versatile", versatileDamage: "1d10" },
  { name: "Maul",           category: "martial", kind: "melee",  damage: "2d6 bludgeoning", icon: "🔨", hands: "2h" },
  { name: "Greatsword",     category: "martial", kind: "melee",  damage: "2d6 slashing",    icon: "⚔️", hands: "2h" },
  { name: "Greataxe",       category: "martial", kind: "melee",  damage: "1d12 slashing",   icon: "🪓", hands: "2h" },
  // Martial ranged
  { name: "Longbow",        category: "martial", kind: "ranged", damage: "1d8 piercing",    icon: "🏹", hands: "2h", ammunition: true },
  { name: "Hand Crossbow",  category: "martial", kind: "ranged", damage: "1d6 piercing",    icon: "🎯", hands: "1h", light: true, ammunition: true },
];

const WEAPON_BY_NAME = new Map(WEAPON_CATALOG.map(w => [w.name.toLowerCase(), w]));
export function weaponByName(name: string): WeaponItem | undefined {
  return WEAPON_BY_NAME.get(name.trim().toLowerCase());
}
export function isTwoHanded(name: string): boolean {
  return weaponByName(name)?.hands === "2h";
}
export function isVersatile(name: string): boolean {
  return weaponByName(name)?.hands === "versatile";
}
/** A free hand is available for a shield or off-hand weapon (anything but 2H). */
export function leavesHandFree(name: string): boolean {
  const w = weaponByName(name);
  return !!w && w.hands !== "2h";
}
/** Eligible for two-weapon fighting in the off hand: a light *melee* weapon. */
export function isLightMelee(name: string): boolean {
  const w = weaponByName(name);
  return !!w && w.kind === "melee" && !!w.light;
}
/** Light melee weapons this class is proficient with — valid off-hand (dual-wield) picks. */
export function classOffhandWeapons(cls: string): WeaponItem[] {
  return WEAPON_CATALOG.filter(w => w.kind === "melee" && w.light && classCanUseWeapon(cls, w.name));
}
/** Short tag for the picker: "2H" / "Versatile" / "Light" / "" (one-handed). */
export function weaponTag(name: string): string {
  const w = weaponByName(name);
  if (!w) return "";
  if (w.hands === "2h") return "2H";
  if (w.hands === "versatile") return "Versatile";
  if (w.light) return "Light";
  return "";
}

// ── Class proficiencies ─────────────────────────────────────────────────────────
type WeaponProf =
  | "simple-martial"                                   // all simple + martial
  | "simple"                                           // all simple
  | { simple?: boolean; named: string[] };             // restricted list (+ optionally all simple)

export type ClassEquip = {
  armor: ArmorCategory[];      // [] = not proficient with any armor
  shields: boolean;
  nonMetalOnly?: boolean;      // Druid
  weapons: WeaponProf;
  unarmoredDefense?: "con" | "wis"; // Barbarian / Monk
};

export const CLASS_EQUIP: Record<string, ClassEquip> = {
  Barbarian: { armor: ["light", "medium"],          shields: true,  weapons: "simple-martial", unarmoredDefense: "con" },
  Bard:      { armor: ["light"],                    shields: false, weapons: { simple: true, named: ["Hand Crossbow", "Longsword", "Rapier", "Shortsword"] } },
  Cleric:    { armor: ["light", "medium"],          shields: true,  weapons: "simple" },
  Druid:     { armor: ["light", "medium"],          shields: true,  nonMetalOnly: true, weapons: { named: ["Club", "Dagger", "Dart", "Javelin", "Mace", "Quarterstaff", "Scimitar", "Sickle", "Sling", "Spear"] } },
  Fighter:   { armor: ["light", "medium", "heavy"], shields: true,  weapons: "simple-martial" },
  Monk:      { armor: [],                           shields: false, weapons: { simple: true, named: ["Shortsword"] }, unarmoredDefense: "wis" },
  Paladin:   { armor: ["light", "medium", "heavy"], shields: true,  weapons: "simple-martial" },
  Ranger:    { armor: ["light", "medium"],          shields: true,  weapons: "simple-martial" },
  Rogue:     { armor: ["light"],                    shields: false, weapons: { simple: true, named: ["Hand Crossbow", "Longsword", "Rapier", "Shortsword"] } },
  Sorcerer:  { armor: [],                           shields: false, weapons: { named: ["Dagger", "Dart", "Sling", "Quarterstaff", "Light Crossbow"] } },
  Warlock:   { armor: ["light"],                    shields: false, weapons: "simple" },
  Wizard:    { armor: [],                           shields: false, weapons: { named: ["Dagger", "Dart", "Sling", "Quarterstaff", "Light Crossbow"] } },
};

export function classCanUseArmor(cls: string, armor: ArmorItem): boolean {
  const p = CLASS_EQUIP[cls];
  if (!p) return true;
  if (!p.armor.includes(armor.category)) return false;
  if (p.nonMetalOnly && armor.metal) return false;
  return true;
}
export function classCanUseShield(cls: string): boolean {
  return CLASS_EQUIP[cls]?.shields ?? false;
}
export function classCanUseWeapon(cls: string, weaponName: string): boolean {
  const p = CLASS_EQUIP[cls];
  const w = weaponByName(weaponName);
  if (!p || !w) return true;
  if (p.weapons === "simple-martial") return true;
  if (p.weapons === "simple") return w.category === "simple";
  return (!!p.weapons.simple && w.category === "simple") || p.weapons.named.includes(w.name);
}
export function classUnarmoredDefense(cls: string): "con" | "wis" | undefined {
  return CLASS_EQUIP[cls]?.unarmoredDefense;
}

// ── Curated starter loadouts (per class) ────────────────────────────────────────
// The equipment step shows these — a tight, proficiency-legal, on-theme shortlist —
// rather than the full tables. Unarmored is always offered separately in the UI.
export const STARTER_WEAPONS: Record<string, string[]> = {
  Barbarian: ["Greataxe", "Battleaxe", "Warhammer", "Handaxe", "Spear", "Javelin"],
  Bard:      ["Rapier", "Longsword", "Shortsword", "Dagger", "Hand Crossbow", "Quarterstaff"],
  Cleric:    ["Mace", "Quarterstaff", "Spear", "Light Crossbow", "Sling", "Dagger"],
  Druid:     ["Scimitar", "Quarterstaff", "Mace", "Spear", "Sling", "Dagger"],
  Fighter:   ["Longsword", "Greatsword", "Battleaxe", "Shortsword", "Longbow", "Light Crossbow"],
  Monk:      ["Quarterstaff", "Shortsword", "Spear", "Handaxe", "Dagger", "Dart"],
  Paladin:   ["Longsword", "Warhammer", "Greatsword", "Shortsword", "Javelin", "Light Crossbow"],
  Ranger:    ["Longbow", "Shortsword", "Scimitar", "Handaxe", "Spear", "Light Crossbow"],
  Rogue:     ["Rapier", "Shortsword", "Dagger", "Hand Crossbow", "Shortbow", "Sling"],
  Sorcerer:  ["Dagger", "Quarterstaff", "Light Crossbow", "Dart", "Sling"],
  Warlock:   ["Quarterstaff", "Mace", "Spear", "Light Crossbow", "Dagger", "Sling"],
  Wizard:    ["Dagger", "Quarterstaff", "Light Crossbow", "Dart", "Sling"],
};

// Armor shortlist per class (real armors only — Unarmored is added by the UI).
const STARTER_ARMOR: Record<string, string[]> = {
  Barbarian: ["Hide", "Leather"],
  Bard:      ["Leather", "Studded Leather"],
  Cleric:    ["Chain Shirt", "Scale Mail", "Leather"],
  Druid:     ["Leather", "Hide", "Padded"],
  Fighter:   ["Chain Mail", "Scale Mail", "Leather"],
  Monk:      [],
  Paladin:   ["Chain Mail", "Scale Mail"],
  Ranger:    ["Scale Mail", "Leather", "Hide"],
  Rogue:     ["Leather", "Studded Leather"],
  Sorcerer:  [],
  Warlock:   ["Leather", "Studded Leather"],
  Wizard:    [],
};

export function starterWeaponsFor(cls: string): WeaponItem[] {
  const names = STARTER_WEAPONS[cls] ?? WEAPON_CATALOG.filter(w => classCanUseWeapon(cls, w.name)).map(w => w.name);
  return names.map(n => weaponByName(n)).filter((w): w is WeaponItem => !!w);
}
export function starterArmorFor(cls: string): ArmorItem[] {
  const names = STARTER_ARMOR[cls] ?? [];
  return names.map(n => armorByName(n)).filter((a): a is ArmorItem => !!a && classCanUseArmor(cls, a));
}

// ── Tooltip / description helpers ────────────────────────────────────────────────
export function describeWeapon(name: string): { title: string; body: string } {
  const w = weaponByName(name);
  if (!w) return { title: name, body: "A weapon." };
  const cat = w.category === "simple" ? "Simple weapon" : "Martial weapon";
  const handLine =
    w.hands === "2h"        ? "Two-handed — needs both hands, so no shield or off-hand weapon." :
    w.hands === "versatile" ? `Versatile — ${w.damage} one-handed (shield-friendly) or ${w.versatileDamage} with both hands.` :
                              "One-handed — leaves a hand free for a shield or off-hand weapon.";
  const props: string[] = [];
  if (w.light)      props.push("Light (can be dual-wielded)");
  if (w.finesse)    props.push("Finesse (use DEX or STR)");
  if (w.thrown)     props.push("Thrown");
  if (w.ammunition) props.push("Needs ammunition");
  const damageNote = w.hands === "versatile"
    ? ""
    : `Damage: ${w.damage}. `;
  const abilityNote = `Attack adds your ${w.kind === "ranged" || w.finesse ? "DEX" : "STR"}${w.finesse && w.kind === "melee" ? "/STR" : ""} modifier + proficiency bonus.`;
  return {
    title: name,
    body: `${cat} · ${w.kind === "melee" ? "Melee" : "Ranged"}\n${handLine}\n${damageNote}${abilityNote}${props.length ? `\n${props.join(" · ")}` : ""}`,
  };
}
export function describeArmor(armor: ArmorItem): { title: string; body: string } {
  const dexRule =
    armor.category === "light"  ? "AC = base + your full DEX modifier" :
    armor.category === "medium" ? "AC = base + DEX modifier (max +2)"  :
                                  "AC = base (no DEX bonus)";
  const notes = [
    `${armor.category[0].toUpperCase() + armor.category.slice(1)} armor`,
    `Base AC ${armor.baseAC}`,
    dexRule,
    armor.strReq ? `Requires STR ${armor.strReq}` : "",
    armor.stealthDisadvantage ? "Disadvantage on Stealth" : "",
    armor.metal ? "Metal (Druids won't wear it)" : "Non-metal",
  ].filter(Boolean);
  return { title: armor.name, body: notes.join(" · ") };
}

/** Returns the inventory armor entry to persist for a chosen armor name.
 *  Empty / "Unarmored" → the unarmored marker so AC stays explicit. */
export function armorInventoryEntry(armorName: string): string {
  return armorName && armorByName(armorName) ? armorName : UNARMORED_MARKER;
}
