export type EffectType = "condition" | "disease" | "debuff" | "enchantment" | "buff";

export interface StatusEffect {
  icon: string;
  type: EffectType;
  description: string;
  defaultDuration: string;
  cardGlow: string;
  badgeBg: string;
  badgeColor: string;
  bonusLabel?: string;
}

export const STATUS_EFFECTS: Record<string, StatusEffect> = {
  // === CONDITIONS ===
  Unconscious: {
    icon: "💀", type: "condition",
    description: "Incapacitated, can't move or speak. Fails all STR/DEX saves. Attacks have advantage; hits within 5ft are automatic crits. Making death saving throws.",
    defaultDuration: "Until stabilized or healed",
    cardGlow: "rgba(239,68,68,0.7)", badgeBg: "rgba(239,68,68,0.2)", badgeColor: "#ef4444",
  },
  Dead: {
    icon: "☠️", type: "condition",
    description: "The character has died. Only Revivify, Raise Dead, or Resurrection can bring them back.",
    defaultDuration: "Permanent",
    cardGlow: "rgba(30,30,30,0.9)", badgeBg: "rgba(30,30,30,0.5)", badgeColor: "#6b7280",
  },
  Poisoned: {
    icon: "🟢", type: "condition",
    description: "Disadvantage on attack rolls and ability checks. Caused by venom, toxic substances, or the Poisoned condition.",
    defaultDuration: "Until cured",
    cardGlow: "rgba(168,85,247,0.6)", badgeBg: "rgba(168,85,247,0.2)", badgeColor: "#a855f7",
  },
  Blinded: {
    icon: "🙈", type: "condition",
    description: "Can't see. Attack rolls have disadvantage; attacks against you have advantage. Auto-fails any check requiring sight.",
    defaultDuration: "Until cured",
    cardGlow: "rgba(100,116,139,0.5)", badgeBg: "rgba(100,116,139,0.2)", badgeColor: "#94a3b8",
  },
  Frightened: {
    icon: "😱", type: "condition",
    description: "Disadvantage on ability checks and attack rolls while the source of fear is visible. Can't willingly move closer to it.",
    defaultDuration: "Until save succeeds or source gone",
    cardGlow: "rgba(249,115,22,0.6)", badgeBg: "rgba(249,115,22,0.2)", badgeColor: "#f97316",
  },
  Paralyzed: {
    icon: "⚡", type: "condition",
    description: "Incapacitated, can't move or speak. Fails STR/DEX saves automatically. Attacks within 5ft are automatic critical hits.",
    defaultDuration: "Until save succeeds",
    cardGlow: "rgba(139,92,246,0.7)", badgeBg: "rgba(139,92,246,0.2)", badgeColor: "#8b5cf6",
  },
  Stunned: {
    icon: "💫", type: "condition",
    description: "Incapacitated, can't move, and can only speak falteringly. Fails STR/DEX saves. Attacks against you have advantage.",
    defaultDuration: "Until end of next turn",
    cardGlow: "rgba(234,179,8,0.6)", badgeBg: "rgba(234,179,8,0.2)", badgeColor: "#eab308",
  },
  Prone: {
    icon: "⬇️", type: "condition",
    description: "Must crawl to move; standing costs half your speed. Melee attacks against you have advantage; ranged attacks have disadvantage.",
    defaultDuration: "Until you stand up",
    cardGlow: "rgba(148,163,184,0.4)", badgeBg: "rgba(148,163,184,0.15)", badgeColor: "#94a3b8",
  },
  Charmed: {
    icon: "💕", type: "condition",
    description: "Can't attack the charmer. The charmer has advantage on social ability checks against you.",
    defaultDuration: "Until save succeeds or source ends it",
    cardGlow: "rgba(236,72,153,0.6)", badgeBg: "rgba(236,72,153,0.2)", badgeColor: "#ec4899",
  },
  Exhausted: {
    icon: "😓", type: "condition",
    description: "Stacking levels: 1=disadvantage on checks, 2=halved speed, 3=disadvantage on attacks & saves, 5=max HP halved, 6=death. Each long rest removes one level.",
    defaultDuration: "Until long rest (per level)",
    cardGlow: "rgba(245,158,11,0.5)", badgeBg: "rgba(245,158,11,0.2)", badgeColor: "#f59e0b",
  },
  Restrained: {
    icon: "🔗", type: "condition",
    description: "Speed becomes 0. Attack rolls have disadvantage; attacks against you have advantage. Disadvantage on DEX saves.",
    defaultDuration: "Until escaped or freed",
    cardGlow: "rgba(132,204,22,0.5)", badgeBg: "rgba(132,204,22,0.15)", badgeColor: "#84cc16",
  },
  Petrified: {
    icon: "🪨", type: "condition",
    description: "Transformed to stone. Incapacitated, immune to poison & disease, resistance to all damage. Weight increases 10×.",
    defaultDuration: "Until Greater Restoration or similar",
    cardGlow: "rgba(163,163,163,0.5)", badgeBg: "rgba(163,163,163,0.15)", badgeColor: "#a3a3a3",
  },
  Deafened: {
    icon: "🔇", type: "condition",
    description: "Can't hear. Automatically fails any check requiring hearing. Certain verbal spell components may fail.",
    defaultDuration: "Until cured",
    cardGlow: "rgba(100,116,139,0.4)", badgeBg: "rgba(100,116,139,0.15)", badgeColor: "#64748b",
  },
  Grappled: {
    icon: "🤛", type: "condition",
    description: "Speed becomes 0. Ends if the grappler is incapacitated or if you escape with Athletics or Acrobatics (DC = their Athletics roll).",
    defaultDuration: "Until escaped",
    cardGlow: "rgba(180,83,9,0.5)", badgeBg: "rgba(180,83,9,0.2)", badgeColor: "#b45309",
  },
  Invisible: {
    icon: "👻", type: "condition",
    description: "Impossible to see without special senses. Attack rolls against you have disadvantage; your attacks have advantage.",
    defaultDuration: "Until end of effect or you attack/cast",
    cardGlow: "rgba(147,197,253,0.5)", badgeBg: "rgba(147,197,253,0.12)", badgeColor: "#93c5fd",
  },
  Incapacitated: {
    icon: "🫥", type: "condition",
    description: "Can't take actions or reactions. Spells requiring concentration end immediately.",
    defaultDuration: "Until end of next turn",
    cardGlow: "rgba(239,68,68,0.4)", badgeBg: "rgba(239,68,68,0.12)", badgeColor: "#f87171",
  },
  Burning: {
    icon: "🔥", type: "condition",
    description: "On fire. Takes fire damage at the start of each of your turns until the flames are put out (an action to extinguish, or dropping prone and rolling).",
    defaultDuration: "Until extinguished",
    cardGlow: "rgba(249,115,22,0.6)", badgeBg: "rgba(249,115,22,0.2)", badgeColor: "#f97316",
    bonusLabel: "dmg/turn",
  },

  // === BUFFS ===
  Blessed: {
    icon: "✨", type: "buff",
    description: "Add a d4 to attack rolls and saving throws. Divine magic infuses your every action.",
    defaultDuration: "1 minute (concentration)",
    cardGlow: "rgba(251,191,36,0.5)", badgeBg: "rgba(251,191,36,0.15)", badgeColor: "#fbbf24",
    bonusLabel: "+1d4",
  },
  Hasted: {
    icon: "💨", type: "buff",
    description: "Speed doubled, +2 AC, advantage on DEX saves, and an extra action each turn. Lethargy hits when the effect ends.",
    defaultDuration: "1 minute (concentration)",
    cardGlow: "rgba(6,182,212,0.5)", badgeBg: "rgba(6,182,212,0.15)", badgeColor: "#06b6d4",
    bonusLabel: "+2 AC",
  },
  Raging: {
    icon: "🔥", type: "buff",
    description: "Advantage on STR checks and saves. +2 melee damage. Resistance to bludgeoning, piercing, and slashing damage. Can't cast or concentrate on spells.",
    defaultDuration: "1 minute or until incapacitated",
    cardGlow: "rgba(239,68,68,0.5)", badgeBg: "rgba(239,68,68,0.15)", badgeColor: "#ef4444",
    bonusLabel: "+2 dmg",
  },
  Inspired: {
    icon: "🎵", type: "buff",
    description: "Holding a Bardic Inspiration die. Add it to one ability check, attack roll, or saving throw before the result is known.",
    defaultDuration: "10 minutes",
    cardGlow: "rgba(59,130,246,0.5)", badgeBg: "rgba(59,130,246,0.15)", badgeColor: "#3b82f6",
    bonusLabel: "+1d6",
  },
  Shielded: {
    icon: "🛡️", type: "buff",
    description: "+5 bonus to AC until the start of your next turn. Granted by the Shield reaction spell.",
    defaultDuration: "Until start of next turn",
    cardGlow: "rgba(59,130,246,0.4)", badgeBg: "rgba(59,130,246,0.12)", badgeColor: "#60a5fa",
    bonusLabel: "+5 AC",
  },
  Concentrating: {
    icon: "🧿", type: "buff",
    description: "Maintaining concentration on an active spell. Taking damage forces a CON save (DC 10 or half damage) to hold concentration. Only one at a time.",
    defaultDuration: "Until spell ends or concentration broken",
    cardGlow: "rgba(99,102,241,0.4)", badgeBg: "rgba(99,102,241,0.12)", badgeColor: "#818cf8",
  },
  Flying: {
    icon: "🦅", type: "buff",
    description: "Airborne and moving in three dimensions at full fly speed. Falling occurs if the effect is dispelled while aloft.",
    defaultDuration: "Until spell ends",
    cardGlow: "rgba(14,165,233,0.4)", badgeBg: "rgba(14,165,233,0.12)", badgeColor: "#38bdf8",
  },
  Regenerating: {
    icon: "💚", type: "buff",
    description: "Recovering HP at the start of each turn from a magical regeneration effect, healing item, or troll-like ability.",
    defaultDuration: "Until condition ends",
    cardGlow: "rgba(34,197,94,0.4)", badgeBg: "rgba(34,197,94,0.12)", badgeColor: "#22c55e",
    bonusLabel: "+HP/turn",
  },
  "Wild Shaped": {
    icon: "🐺", type: "buff",
    description: "Transformed into a beast form. Using the beast's physical stats while retaining your personality, mental scores, and proficiencies.",
    defaultDuration: "Until reverted or knocked to 0 HP",
    cardGlow: "rgba(34,197,94,0.5)", badgeBg: "rgba(34,197,94,0.15)", badgeColor: "#4ade80",
  },
  "Bardic Inspiration": {
    icon: "🎶", type: "buff",
    description: "Granted a Bardic Inspiration die by a Bard ally. Add it to one ability check, attack roll, or saving throw before the result.",
    defaultDuration: "10 minutes",
    cardGlow: "rgba(59,130,246,0.4)", badgeBg: "rgba(59,130,246,0.12)", badgeColor: "#3b82f6",
    bonusLabel: "+1d6",
  },
  "Death Ward": {
    icon: "🕊️", type: "buff",
    description: "Protected from death. The first time you would drop to 0 HP, you drop to 1 HP instead. The ward is consumed on trigger.",
    defaultDuration: "8 hours",
    cardGlow: "rgba(251,191,36,0.45)", badgeBg: "rgba(251,191,36,0.12)", badgeColor: "#fde68a",
    bonusLabel: "1 save",
  },
  Sanctuary: {
    icon: "⛪", type: "buff",
    description: "Warded against attack. Any creature wishing to harm you must make a WIS save (DC = your spell save). Ends if you attack or cast a harmful spell.",
    defaultDuration: "1 minute",
    cardGlow: "rgba(251,191,36,0.35)", badgeBg: "rgba(251,191,36,0.1)", badgeColor: "#fcd34d",
  },
  Guidance: {
    icon: "🔆", type: "buff",
    description: "A divine cantrip steadies you. Add 1d4 to ONE ability check of your choice before you know the result. Requires the caster's concentration.",
    defaultDuration: "Concentration, up to 1 minute",
    cardGlow: "rgba(252,211,77,0.5)", badgeBg: "rgba(252,211,77,0.15)", badgeColor: "#fcd34d",
    bonusLabel: "+1d4",
  },
  Resistance: {
    icon: "🪬", type: "buff",
    description: "A protective cantrip. Add 1d4 to ONE saving throw of your choice before you know the result. Requires the caster's concentration.",
    defaultDuration: "Concentration, up to 1 minute",
    cardGlow: "rgba(96,165,250,0.45)", badgeBg: "rgba(96,165,250,0.12)", badgeColor: "#60a5fa",
    bonusLabel: "+1d4",
  },
  Aided: {
    icon: "💗", type: "buff",
    description: "The Aid spell bolsters your vitality — your hit point maximum and current HP are increased for the duration.",
    defaultDuration: "8 hours",
    cardGlow: "rgba(244,114,182,0.45)", badgeBg: "rgba(244,114,182,0.12)", badgeColor: "#f472b6",
    bonusLabel: "+HP",
  },
  Heroism: {
    icon: "🦁", type: "buff",
    description: "Immune to the Frightened condition, and you gain temporary HP at the start of each of your turns equal to the caster's spellcasting modifier.",
    defaultDuration: "Concentration, up to 1 minute",
    cardGlow: "rgba(251,146,60,0.5)", badgeBg: "rgba(251,146,60,0.15)", badgeColor: "#fb923c",
    bonusLabel: "temp HP",
  },
  "Shield of Faith": {
    icon: "🔰", type: "buff",
    description: "A shimmering field of protection grants a +2 bonus to your AC for the duration. Requires the caster's concentration.",
    defaultDuration: "Concentration, up to 10 minutes",
    cardGlow: "rgba(252,211,77,0.45)", badgeBg: "rgba(252,211,77,0.12)", badgeColor: "#fcd34d",
    bonusLabel: "+2 AC",
  },
  Protected: {
    icon: "🛐", type: "buff",
    description: "Protection from Evil and Good: aberrations, celestials, elementals, fey, fiends, and undead have disadvantage on attacks against you, and you can't be charmed, frightened, or possessed by them.",
    defaultDuration: "Concentration, up to 10 minutes",
    cardGlow: "rgba(167,139,250,0.45)", badgeBg: "rgba(167,139,250,0.12)", badgeColor: "#a78bfa",
  },
  Barkskin: {
    icon: "🌳", type: "buff",
    description: "Your skin turns rough and bark-like. Your AC can't be lower than 16, regardless of the armor you wear. Requires concentration.",
    defaultDuration: "Concentration, up to 1 hour",
    cardGlow: "rgba(101,163,13,0.45)", badgeBg: "rgba(101,163,13,0.15)", badgeColor: "#84cc16",
    bonusLabel: "AC 16",
  },
  Longstrider: {
    icon: "👟", type: "buff",
    description: "Your speed increases by 10 feet for the duration.",
    defaultDuration: "1 hour",
    cardGlow: "rgba(45,212,191,0.45)", badgeBg: "rgba(45,212,191,0.12)", badgeColor: "#2dd4bf",
    bonusLabel: "+10 ft",
  },
  Enlarged: {
    icon: "🔺", type: "buff",
    description: "Enlarge: your size doubles. Advantage on STR checks and STR saves, and your weapon attacks deal an extra 1d4 damage. Requires concentration.",
    defaultDuration: "Concentration, up to 1 minute",
    cardGlow: "rgba(248,113,113,0.45)", badgeBg: "rgba(248,113,113,0.12)", badgeColor: "#f87171",
    bonusLabel: "+1d4 dmg",
  },

  // === DEBUFFS ===
  Cursed: {
    icon: "💢", type: "debuff",
    description: "Under a magical curse. Effects vary: disadvantage on rolls, reduced max HP, or compelled behavior. Remove Curse ends it.",
    defaultDuration: "Until Remove Curse",
    cardGlow: "rgba(153,27,27,0.7)", badgeBg: "rgba(153,27,27,0.25)", badgeColor: "#dc2626",
  },
  Hexed: {
    icon: "🔮", type: "debuff",
    description: "Target of the Hex spell. Takes +1d6 necrotic damage from the caster's attacks. Disadvantage on one chosen ability type.",
    defaultDuration: "1 hour (concentration)",
    cardGlow: "rgba(91,33,182,0.6)", badgeBg: "rgba(91,33,182,0.2)", badgeColor: "#7c3aed",
    bonusLabel: "+1d6 dmg",
  },
  Marked: {
    icon: "🎯", type: "debuff",
    description: "Singled out by Hunter's Mark, Divine Smite, or a similar effect. Takes extra damage from the marker's attacks.",
    defaultDuration: "Until condition ends",
    cardGlow: "rgba(234,88,12,0.5)", badgeBg: "rgba(234,88,12,0.15)", badgeColor: "#f97316",
  },
  Silenced: {
    icon: "🤐", type: "debuff",
    description: "Can't speak or cast spells with verbal components. Caught in a Silence spell or a magical muting effect.",
    defaultDuration: "While in affected area",
    cardGlow: "rgba(71,85,105,0.5)", badgeBg: "rgba(71,85,105,0.2)", badgeColor: "#94a3b8",
  },
  Weakened: {
    icon: "💔", type: "debuff",
    description: "Strength or vitality sapped. Disadvantage on STR checks and saving throws, or reduced damage output.",
    defaultDuration: "Until cured",
    cardGlow: "rgba(239,68,68,0.35)", badgeBg: "rgba(239,68,68,0.12)", badgeColor: "#f87171",
    bonusLabel: "-1d4",
  },
  "Hunter's Mark": {
    icon: "🏹", type: "debuff",
    description: "Marked by a Ranger. The Ranger deals +1d6 damage to you and has advantage on Perception/Survival checks to track you.",
    defaultDuration: "1 hour (concentration)",
    cardGlow: "rgba(180,83,9,0.45)", badgeBg: "rgba(180,83,9,0.15)", badgeColor: "#d97706",
    bonusLabel: "+1d6 dmg",
  },
  Baned: {
    icon: "🌑", type: "debuff",
    description: "The Bane spell saps you — subtract 1d4 from each attack roll and saving throw you make. Requires the caster's concentration.",
    defaultDuration: "Concentration, up to 1 minute",
    cardGlow: "rgba(124,58,237,0.5)", badgeBg: "rgba(124,58,237,0.18)", badgeColor: "#7c3aed",
    bonusLabel: "-1d4",
  },
  Slowed: {
    icon: "🐌", type: "debuff",
    description: "The Slow spell: speed halved, -2 to AC and DEX saves, no reactions, and only one action OR bonus action each turn. Requires concentration.",
    defaultDuration: "Concentration, up to 1 minute",
    cardGlow: "rgba(100,116,139,0.5)", badgeBg: "rgba(100,116,139,0.18)", badgeColor: "#94a3b8",
    bonusLabel: "-2 AC",
  },
  Reduced: {
    icon: "🔻", type: "debuff",
    description: "Reduce: your size halves. Disadvantage on STR checks and STR saves, and your weapon attacks deal 1d4 less damage. Requires concentration.",
    defaultDuration: "Concentration, up to 1 minute",
    cardGlow: "rgba(148,163,184,0.4)", badgeBg: "rgba(148,163,184,0.12)", badgeColor: "#cbd5e1",
    bonusLabel: "-1d4 dmg",
  },

  // === DISEASES ===
  Diseased: {
    icon: "🦠", type: "disease",
    description: "Afflicted by a magical or mundane disease. Effects vary. Lesser Restoration or greater magic is required to cure.",
    defaultDuration: "Until cured",
    cardGlow: "rgba(22,101,52,0.6)", badgeBg: "rgba(22,101,52,0.25)", badgeColor: "#16a34a",
  },
  Infected: {
    icon: "🩸", type: "disease",
    description: "Carrying an active infection that worsens over time. Each day without treatment may cause a CON save or ability score loss.",
    defaultDuration: "Until treated",
    cardGlow: "rgba(185,28,28,0.5)", badgeBg: "rgba(185,28,28,0.2)", badgeColor: "#ef4444",
  },
  Fevered: {
    icon: "🌡️", type: "disease",
    description: "Wracked with fever. Disadvantage on CON saves, speed reduced by 10 ft, and short rests provide no benefit.",
    defaultDuration: "Until treated",
    cardGlow: "rgba(234,88,12,0.45)", badgeBg: "rgba(234,88,12,0.15)", badgeColor: "#fb923c",
  },
  "Sewer Plague": {
    icon: "🐀", type: "disease",
    description: "Contracted sewer plague. After 1d4 days: fatigue and 1d6 STR and CON damage daily. DC 11 CON save each day to recover.",
    defaultDuration: "Until DC 11 CON save (daily)",
    cardGlow: "rgba(101,163,13,0.45)", badgeBg: "rgba(101,163,13,0.15)", badgeColor: "#84cc16",
  },

  // === ENCHANTMENTS ===
  Attuned: {
    icon: "💎", type: "enchantment",
    description: "Attuned to a magical item, unlocking its full properties and command words. Maximum 3 attunements allowed at once.",
    defaultDuration: "Until unattuned",
    cardGlow: "rgba(6,182,212,0.4)", badgeBg: "rgba(6,182,212,0.12)", badgeColor: "#22d3ee",
  },
  Empowered: {
    icon: "💪", type: "enchantment",
    description: "Magically empowered — a magical effect boosts damage, accuracy, or ability scores temporarily.",
    defaultDuration: "Until effect ends",
    cardGlow: "rgba(251,191,36,0.45)", badgeBg: "rgba(251,191,36,0.12)", badgeColor: "#fbbf24",
  },
  Enchanted: {
    icon: "🌟", type: "enchantment",
    description: "Under an active magical enchantment. A visible aura surrounds you, granting or altering abilities.",
    defaultDuration: "Until dispelled",
    cardGlow: "rgba(139,92,246,0.45)", badgeBg: "rgba(139,92,246,0.12)", badgeColor: "#a78bfa",
  },
  "Mage Armor": {
    icon: "🔵", type: "enchantment",
    description: "Protected by Mage Armor. Your AC = 13 + DEX modifier while not wearing armor. Magical force surrounds you.",
    defaultDuration: "8 hours",
    cardGlow: "rgba(59,130,246,0.4)", badgeBg: "rgba(59,130,246,0.12)", badgeColor: "#60a5fa",
    bonusLabel: "AC 13+",
  },
  "Mirror Image": {
    icon: "👥", type: "enchantment",
    description: "Three illusory duplicates orbit you. When hit, roll to see if the attacker hits a duplicate instead. Each duplicate is destroyed on a hit.",
    defaultDuration: "1 minute",
    cardGlow: "rgba(99,102,241,0.4)", badgeBg: "rgba(99,102,241,0.12)", badgeColor: "#818cf8",
    bonusLabel: "3 imgs",
  },
};

const TYPE_PRIORITY: EffectType[] = ["condition", "disease", "debuff", "enchantment", "buff"];

// The DM/extraction LLM does not always write the exact canonical key — it may use
// the spell's name ("Bless", "Bane", "Haste") instead of the effect form
// ("Blessed", "Baned", "Hasted"), or a near-synonym. These aliases map those common
// variants onto a canonical STATUS_EFFECTS key so the card still shows the right
// icon. Keys are normalized: lowercased, apostrophes removed, whitespace collapsed.
const EFFECT_ALIASES: Record<string, string> = {
  bless: "Blessed", blessing: "Blessed",
  haste: "Hasted",
  rage: "Raging", enraged: "Raging",
  bane: "Baned",
  slow: "Slowed",
  enlarge: "Enlarged",
  reduce: "Reduced",
  hex: "Hexed",
  curse: "Cursed",
  guided: "Guidance", guidance: "Guidance",
  aid: "Aided",
  concentration: "Concentrating", concentrate: "Concentrating",
  invisibility: "Invisible",
  poison: "Poisoned",
  fly: "Flying", flight: "Flying",
  inspiration: "Inspired",
  "protection from evil and good": "Protected", "protection from evil": "Protected", protection: "Protected",
  "hunters mark": "Hunter's Mark",
  "wild shape": "Wild Shaped", wildshape: "Wild Shaped",
  paralysis: "Paralyzed",
  burned: "Burning", "on fire": "Burning", ablaze: "Burning", aflame: "Burning",
};

const normEffectKey = (s: string) => s.trim().toLowerCase().replace(/['']/g, "").replace(/\s+/g, " ");

/**
 * Resolve an effect name (canonical key, case variant, or known alias / spell name)
 * to its StatusEffect, or null if truly unknown. Pass the bare NAME (strip any
 * "(duration)" with parseStatusEffect first).
 */
export function resolveStatusEffect(rawName: string): StatusEffect | null {
  if (!rawName) return null;
  const name = rawName.trim();
  if (STATUS_EFFECTS[name]) return STATUS_EFFECTS[name];
  const norm = normEffectKey(name);
  // case-insensitive exact key match
  for (const k of Object.keys(STATUS_EFFECTS)) {
    if (normEffectKey(k) === norm) return STATUS_EFFECTS[k];
  }
  const alias = EFFECT_ALIASES[norm];
  if (alias && STATUS_EFFECTS[alias]) return STATUS_EFFECTS[alias];
  return null;
}

export function parseStatusEffect(raw: string): { name: string; duration: string | null } {
  const m = raw.match(/^(.+?)\s+\(([^)]+)\)\s*$/);
  if (m) return { name: m[1].trim(), duration: m[2].trim() };
  return { name: raw.trim(), duration: null };
}

export function getDominantEffect(effects: string[]): StatusEffect | null {
  if (!effects.length) return null;
  let best: StatusEffect | null = null;
  let bestPriority = TYPE_PRIORITY.length;
  for (const raw of effects) {
    const { name } = parseStatusEffect(raw);
    const effect = resolveStatusEffect(name);
    if (!effect) continue;
    const p = TYPE_PRIORITY.indexOf(effect.type);
    if (p < bestPriority) { bestPriority = p; best = effect; }
  }
  return best;
}

export function getCardEffectGlow(effects: string[]): string | null {
  const best = getDominantEffect(effects);
  if (!best) return null;
  return `0 0 0 2px ${best.cardGlow}, 0 0 18px ${best.cardGlow}`;
}
