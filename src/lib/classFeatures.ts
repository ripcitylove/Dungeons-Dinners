// D&D 5e class resource definitions — level-accurate per PHB rules

export type ClassSubAbility = {
  name: string;
  cost: number;
  minLevel: number;
  description: string;
};

export type ClassResourceDef = {
  key: string;
  name: string;
  emoji: string;
  color: string;
  /** "uses" | "points" | "HP" | "passive" */
  unit: string;
  minLevel: number;
  /** Returns maximum resource available. Stats in order: cha, wis, con, str, int, dex */
  getMax: (level: number, cha: number, wis: number, con: number, str: number, int: number, dex: number) => number;
  /** "shortRest" — recovers on short or long rest; "longRest" — only long rest; "bardic" — long L1-4, short L5+ */
  resetOn: "shortRest" | "longRest" | "bardic";
  description: string;
  subAbilities?: ClassSubAbility[];
};

const mod = (stat: number) => Math.floor((stat - 10) / 2);

export const CLASS_RESOURCES: Partial<Record<string, ClassResourceDef[]>> = {

  Barbarian: [
    {
      key: "rage",
      name: "Rage",
      emoji: "🔥",
      color: "#ef4444",
      unit: "uses",
      minLevel: 1,
      getMax: (level) => level >= 20 ? 99 : level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2,
      resetOn: "longRest",
      description: "Bonus action: enter a Rage lasting up to 1 minute. While raging you have advantage on STR checks and saves, resistance to bludgeoning/piercing/slashing damage, and a bonus to melee damage (+2 at L1, +3 at L9, +4 at L16). Rage ends if you end a turn without attacking or being attacked.",
      subAbilities: [
        { name: "Enter Rage", cost: 1, minLevel: 1, description: "Bonus action — enter rage for up to 1 minute (10 rounds)." },
      ],
    },
  ],

  Bard: [
    {
      key: "bardic_inspiration",
      name: "Bardic Inspiration",
      emoji: "🎵",
      color: "#f59e0b",
      unit: "uses",
      minLevel: 1,
      getMax: (_level, cha) => Math.max(1, mod(cha)),
      resetOn: "bardic",
      description: "Bonus action: choose a creature within 60 ft. They gain a Bardic Inspiration die for 10 min — add it to one ability check, attack roll, or saving throw. Die size: d6 (L1), d8 (L5), d10 (L10), d12 (L15). Recovers on Long Rest (L1–4) or Short Rest (L5+).",
      subAbilities: [
        { name: "Inspire Ally", cost: 1, minLevel: 1, description: "Bonus action — grant a Bardic Inspiration die to one creature within 60 ft." },
      ],
    },
  ],

  Cleric: [
    {
      key: "channel_divinity",
      name: "Channel Divinity",
      emoji: "✝️",
      color: "#fbbf24",
      unit: "uses",
      minLevel: 2,
      getMax: (level) => level >= 18 ? 3 : level >= 6 ? 2 : 1,
      resetOn: "shortRest",
      description: "Channel divine energy to fuel magical effects. Turn Undead: undead within 30 ft must succeed on a WIS save or flee for 1 minute. At L5, undead with CR ≤ half your level are destroyed on a failed save. Uses recover on Short Rest.",
      subAbilities: [
        { name: "Turn Undead", cost: 1, minLevel: 2, description: "Action — undead within 30 ft must make a WIS save or be turned for 1 minute." },
        { name: "Sacred Weapon", cost: 1, minLevel: 2, description: "Action — imbue your weapon with divine energy for 1 minute: counts as magical, add CHA modifier to attack rolls." },
      ],
    },
  ],

  Druid: [
    {
      key: "wild_shape",
      name: "Wild Shape",
      emoji: "🐺",
      color: "#22c55e",
      unit: "uses",
      minLevel: 2,
      getMax: () => 2,
      resetOn: "shortRest",
      description: "Bonus action: transform into a beast you have seen. Duration: half your Druid level in hours. Max CR: ¼ at L2–3 (no fly/swim speed), ½ at L4–7 (no fly), 1 at L8+. You revert if you drop to 0 HP or fall unconscious. Your mental stats remain.",
      subAbilities: [
        { name: "Transform", cost: 1, minLevel: 2, description: "Bonus action — transform into a beast form appropriate to your level's CR limit." },
      ],
    },
  ],

  Fighter: [
    {
      key: "second_wind",
      name: "Second Wind",
      emoji: "💪",
      color: "#3b82f6",
      unit: "uses",
      minLevel: 1,
      getMax: () => 1,
      resetOn: "shortRest",
      description: "Bonus action: regain HP equal to 1d10 + your Fighter level. Recovers on Short or Long Rest.",
      subAbilities: [
        { name: "Second Wind", cost: 1, minLevel: 1, description: "Bonus action — recover 1d10 + Fighter level HP." },
      ],
    },
    {
      key: "action_surge",
      name: "Action Surge",
      emoji: "⚡",
      color: "#8b5cf6",
      unit: "uses",
      minLevel: 2,
      getMax: (level) => level >= 17 ? 2 : 1,
      resetOn: "shortRest",
      description: "On your turn, take one additional action on top of your regular action. Recovers on Short or Long Rest. You may not use this feature twice in the same turn.",
      subAbilities: [
        { name: "Action Surge", cost: 1, minLevel: 2, description: "Take one additional action on your turn." },
      ],
    },
  ],

  Monk: [
    {
      key: "ki",
      name: "Ki Points",
      emoji: "☯️",
      color: "#06b6d4",
      unit: "ki",
      minLevel: 2,
      getMax: (level) => level,
      resetOn: "shortRest",
      description: "Harness the mystic energy of ki to fuel special techniques. Ki points = your Monk level. Recover all on a Short or Long Rest.",
      subAbilities: [
        { name: "Flurry of Blows",  cost: 1, minLevel: 2, description: "After the Attack action, make 2 additional unarmed strikes as a bonus action." },
        { name: "Patient Defense",   cost: 1, minLevel: 2, description: "Bonus action — take the Dodge action." },
        { name: "Step of the Wind", cost: 1, minLevel: 2, description: "Bonus action — Disengage or Dash, and your jump distance is doubled until end of turn." },
        { name: "Stunning Strike",  cost: 1, minLevel: 5, description: "After hitting with a weapon attack, spend 1 ki: target must make a CON save (DC 8 + prof + WIS mod) or be Stunned until the end of your next turn." },
        { name: "Ki-Empowered Strikes", cost: 0, minLevel: 6, description: "Passive (L6): your unarmed strikes count as magical for overcoming resistance and immunity." },
        { name: "Evasion",          cost: 0, minLevel: 7, description: "Passive (L7): when you fail a DEX save vs an area-of-effect, you take no damage on success and half on failure." },
      ],
    },
  ],

  Paladin: [
    {
      key: "lay_on_hands",
      name: "Lay on Hands",
      emoji: "🤲",
      color: "#f59e0b",
      unit: "HP",
      minLevel: 1,
      getMax: (level) => level * 5,
      resetOn: "longRest",
      description: "A pool of healing power equal to 5 × Paladin level. Action: touch a creature and restore any amount of HP from the pool. Alternatively spend 5 HP from the pool to cure one disease or poison (no HP restored). Recovers fully on Long Rest.",
      subAbilities: [
        { name: "Heal 5 HP",  cost: 5,  minLevel: 1, description: "Restore 5 HP to a touched creature from your pool." },
        { name: "Heal 10 HP", cost: 10, minLevel: 1, description: "Restore 10 HP to a touched creature from your pool." },
        { name: "Heal 15 HP", cost: 15, minLevel: 1, description: "Restore 15 HP to a touched creature from your pool." },
        { name: "Cure Disease/Poison", cost: 5, minLevel: 1, description: "Cure one disease or neutralize one poison affecting a touched creature." },
      ],
    },
    {
      key: "paladin_channel",
      name: "Channel Divinity",
      emoji: "🛡️",
      color: "#fbbf24",
      unit: "uses",
      minLevel: 3,
      getMax: () => 1,
      resetOn: "shortRest",
      description: "Channel divine power into one of two effects:\n• Sacred Weapon: your weapon is magical and you add CHA mod to attack rolls for 1 min.\n• Turn the Unholy: fiends and undead within 30 ft must make a WIS save or flee for 1 min. Recovers on Short Rest.",
      subAbilities: [
        { name: "Sacred Weapon",   cost: 1, minLevel: 3, description: "Weapon counts as magical; add CHA modifier to attack rolls for 1 minute." },
        { name: "Turn the Unholy", cost: 1, minLevel: 3, description: "Fiends and undead within 30 ft must make WIS save or flee for 1 minute." },
      ],
    },
  ],

  Ranger: [
    {
      key: "hunters_mark",
      name: "Hunter's Mark",
      emoji: "🎯",
      color: "#84cc16",
      unit: "uses",
      minLevel: 1,
      getMax: (level) => level >= 17 ? 3 : level >= 9 ? 2 : 1,
      resetOn: "longRest",
      description: "Bonus action: mark a target as your quarry. Deal +1d6 damage to it with weapon attacks and have advantage on Perception and Survival checks to track it. Lasts 1 hour. If the quarry dies you can use a bonus action to move the mark.",
      subAbilities: [
        { name: "Mark Target", cost: 1, minLevel: 1, description: "Bonus action — mark a target. Gain +1d6 weapon damage and tracking advantage against it for 1 hour." },
      ],
    },
  ],

  Rogue: [
    {
      key: "sneak_attack",
      name: "Sneak Attack",
      emoji: "🗡️",
      color: "#a78bfa",
      unit: "passive",
      minLevel: 1,
      getMax: () => 0,
      resetOn: "shortRest",
      description: "Once per turn, deal extra damage when you attack with advantage, or when an ally is adjacent to your target: 1d6 (L1–2), 2d6 (L3–4), 3d6 (L5–6), 4d6 (L7–8), 5d6 (L9–10), 6d6 (L11+). Requires a finesse or ranged weapon.",
    },
    {
      key: "cunning_action",
      name: "Cunning Action",
      emoji: "💨",
      color: "#a78bfa",
      unit: "passive",
      minLevel: 2,
      getMax: () => 0,
      resetOn: "shortRest",
      description: "On each of your turns you can use a bonus action to Dash, Disengage, or Hide.",
    },
    {
      key: "uncanny_dodge",
      name: "Uncanny Dodge",
      emoji: "🌀",
      color: "#a78bfa",
      unit: "passive",
      minLevel: 5,
      getMax: () => 0,
      resetOn: "shortRest",
      description: "Reaction: when an attacker you can see hits you, halve the attack's damage.",
    },
    {
      key: "evasion_rogue",
      name: "Evasion",
      emoji: "💨",
      color: "#a78bfa",
      unit: "passive",
      minLevel: 7,
      getMax: () => 0,
      resetOn: "shortRest",
      description: "When subjected to an area effect requiring a DEX save: take no damage on success, half damage on failure.",
    },
  ],

  Sorcerer: [
    {
      key: "sorcery_points",
      name: "Sorcery Points",
      emoji: "✨",
      color: "#ec4899",
      unit: "points",
      minLevel: 2,
      getMax: (level) => level,
      resetOn: "longRest",
      description: "Innate magical energy stored within you (= Sorcerer level). Spend points to create spell slots or activate Metamagic. Convert slots to points: 1st = 2pts, 2nd = 3pts, 3rd = 5pts, 4th = 6pts, 5th = 7pts (and vice versa). Recover on Long Rest.",
      subAbilities: [
        { name: "Create Slot (1st)", cost: 2, minLevel: 2,  description: "Spend 2 Sorcery Points to create a 1st-level spell slot." },
        { name: "Create Slot (2nd)", cost: 3, minLevel: 3,  description: "Spend 3 Sorcery Points to create a 2nd-level spell slot." },
        { name: "Create Slot (3rd)", cost: 5, minLevel: 5,  description: "Spend 5 Sorcery Points to create a 3rd-level spell slot." },
        { name: "Twinned Spell",    cost: 1, minLevel: 3,  description: "Target a second creature with a single-target spell (1pt per spell level, min 1)." },
        { name: "Quickened Spell",  cost: 2, minLevel: 3,  description: "Change the casting time of a spell requiring 1 action to a bonus action." },
        { name: "Subtle Spell",     cost: 1, minLevel: 3,  description: "Cast a spell without verbal or somatic components." },
        { name: "Empowered Spell",  cost: 1, minLevel: 3,  description: "Re-roll up to CHA modifier damage dice; you must use the new results." },
      ],
    },
  ],

  Warlock: [
    {
      key: "eldritch_invocations",
      name: "Eldritch Invocations",
      emoji: "🔮",
      color: "#7c3aed",
      unit: "passive",
      minLevel: 2,
      getMax: () => 0,
      resetOn: "shortRest",
      description: "Passive (L2): you have learned fragments of forbidden lore granting you special abilities. Common invocations: Agonizing Blast (add CHA mod to Eldritch Blast), Devil's Sight (see in magical darkness), Mask of Many Faces (cast Disguise Self at will).",
    },
    {
      key: "pact_boon",
      name: "Pact Boon",
      emoji: "📜",
      color: "#7c3aed",
      unit: "passive",
      minLevel: 3,
      getMax: () => 0,
      resetOn: "shortRest",
      description: "Passive (L3): your patron gifts you a permanent boon. Pact of the Blade: summon a magical pact weapon. Pact of the Chain: familiar with special forms. Pact of the Tome: Book of Shadows with 3 cantrips from any class.",
    },
  ],

  Wizard: [
    {
      key: "arcane_recovery",
      name: "Arcane Recovery",
      emoji: "📖",
      color: "#818cf8",
      unit: "uses",
      minLevel: 1,
      getMax: () => 1,
      resetOn: "longRest",
      description: "Once per day during a Short Rest, recover expended spell slots totaling up to half your Wizard level (rounded up). Cannot recover slots of 6th level or higher. Replenishes on Long Rest.",
      subAbilities: [
        { name: "Recover Slots", cost: 1, minLevel: 1, description: "During a Short Rest, recover spell slots totaling up to ½ Wizard level (max 5th level slots)." },
      ],
    },
  ],
};

/** Keys of resources that reset on Short Rest (per class) */
export const SHORT_REST_RESET_KEYS: Partial<Record<string, string[]>> = {
  Cleric:    ["channel_divinity"],
  Druid:     ["wild_shape"],
  Fighter:   ["second_wind", "action_surge"],
  Monk:      ["ki"],
  Paladin:   ["paladin_channel"],
  Warlock:   [], // pact magic handled separately via spell_slots_used
};

/** Returns Bardic Inspiration die label for the given level */
export function getBardicInspirationDie(level: number): string {
  if (level >= 15) return "d12";
  if (level >= 10) return "d10";
  if (level >= 5)  return "d8";
  return "d6";
}

/** Returns Sneak Attack dice for a rogue at the given level */
export function getSneakAttackDice(level: number): string {
  const dice = Math.ceil(level / 2);
  return `${dice}d6`;
}

/** Returns Wild Shape max CR for a druid at the given level */
export function getWildShapeCR(level: number): string {
  if (level >= 8) return "1";
  if (level >= 4) return "½";
  return "¼";
}

/** Returns Rage damage bonus for a barbarian at the given level */
export function getRageDamageBonus(level: number): number {
  if (level >= 16) return 4;
  if (level >= 9)  return 3;
  return 2;
}
