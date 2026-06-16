// D&D 5e loot catalog and helpers

export type ItemEffectType =
  | "stat_add"   // adds a fixed value to a stat
  | "stat_set"   // sets stat to a minimum (e.g. Gauntlets of Ogre Power)
  | "ac_add"     // bonus to AC
  | "save_add"   // bonus to all saving throws
  | "attack_add" // bonus to attack rolls
  | "hp_heal"    // heals HP when consumed
  | "hp_max_add" // increases max HP
  | "special";   // descriptive / narrative effect only

export type ItemEffect = {
  type: ItemEffectType;
  stat?: string;         // "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma"
  value?: number;
  diceFormula?: string;  // e.g. "2d4+2" for potions
  description?: string;  // shown in tooltip
};

export type ItemType =
  | "potion" | "scroll" | "weapon" | "armor" | "shield"
  | "ring"   | "amulet" | "cloak"  | "boots" | "gloves"
  | "headgear" | "wondrous" | "rod" | "staff" | "currency";

export type ItemRarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary" | "cursed";

export type LootItem = {
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  description: string;
  effects: ItemEffect[];
  consumable: boolean;
  requiresAttunement?: boolean;
  cursed?: boolean;
};

export type ItemBonuses = {
  statAdd: Partial<Record<string, number>>;
  statSet: Partial<Record<string, number>>;
  acAdd: number;
  saveAdd: number;
  attackAdd: number;
  hpMaxAdd: number;
  activeEffects: Array<{ itemName: string; text: string }>;
};

// ── Display constants ─────────────────────────────────────────────────────────

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common:    "#9ca3af",
  uncommon:  "#22c55e",
  rare:      "#3b82f6",
  very_rare: "#8b5cf6",
  legendary: "#f59e0b",
  cursed:    "#ef4444",
};

export const RARITY_LABELS: Record<ItemRarity, string> = {
  common:    "Common",
  uncommon:  "Uncommon",
  rare:      "Rare",
  very_rare: "Very Rare",
  legendary: "Legendary",
  cursed:    "Cursed",
};

export const ITEM_ICONS: Record<ItemType, string> = {
  potion:   "🧪",
  scroll:   "📜",
  weapon:   "⚔",
  armor:    "🛡",
  shield:   "🛡",
  ring:     "💍",
  amulet:   "📿",
  cloak:    "🧥",
  boots:    "👢",
  gloves:   "🧤",
  headgear: "👑",
  wondrous: "✨",
  rod:      "🪄",
  staff:    "🌟",
  currency: "🪙",
};

// ── Item catalog ──────────────────────────────────────────────────────────────

const CATALOG: LootItem[] = [
  // POTIONS
  {
    name: "Potion of Healing",
    type: "potion", rarity: "common", consumable: true,
    description: "A vial of rose-red liquid that shimmers when shaken. The color of fresh blood, the taste of honey.",
    effects: [
      { type: "hp_heal", diceFormula: "2d4+2", description: "Restores 2d4+2 HP." },
    ],
  },
  {
    name: "Potion of Greater Healing",
    type: "potion", rarity: "uncommon", consumable: true,
    description: "A deeper crimson draught, thicker than water. The warmth spreads immediately.",
    effects: [
      { type: "hp_heal", diceFormula: "4d4+4", description: "Restores 4d4+4 HP." },
    ],
  },
  {
    name: "Potion of Superior Healing",
    type: "potion", rarity: "rare", consumable: true,
    description: "A glowing amber liquid that smells of wildflowers and ozone.",
    effects: [
      { type: "hp_heal", diceFormula: "8d4+8", description: "Restores 8d4+8 HP." },
    ],
  },
  {
    name: "Potion of Supreme Healing",
    type: "potion", rarity: "very_rare", consumable: true,
    description: "A shimmering gold draught — near-legendary in potency.",
    effects: [
      { type: "hp_heal", diceFormula: "10d4+20", description: "Restores 10d4+20 HP." },
    ],
  },
  {
    name: "Antitoxin",
    type: "potion", rarity: "common", consumable: true,
    description: "A bitter, acrid liquid that neutralizes mundane poisons. Smells like burnt copper.",
    effects: [
      { type: "special", description: "Advantage on Constitution saving throws against poison for 1 hour." },
    ],
  },
  {
    name: "Potion of Strength",
    type: "potion", rarity: "rare", consumable: true,
    description: "Tastes of iron and lightning. Your muscles swell painfully after drinking.",
    effects: [
      { type: "special", description: "Strength score becomes 25 (if lower) for 1 hour." },
    ],
  },
  {
    name: "Potion of Speed",
    type: "potion", rarity: "very_rare", consumable: true,
    description: "Quicksilver in a vial. After drinking, the world slows around you.",
    effects: [
      { type: "special", description: "Haste for 1 minute: double speed, +2 AC, advantage on DEX saves, extra action each turn." },
    ],
  },
  {
    name: "Potion of Invisibility",
    type: "potion", rarity: "very_rare", consumable: true,
    description: "Clear as water. You vanish the moment you drain it.",
    effects: [
      { type: "special", description: "Invisible for 1 hour. Effect ends if you attack or cast a spell." },
    ],
  },
  {
    name: "Potion of Flying",
    type: "potion", rarity: "very_rare", consumable: true,
    description: "Tastes of open sky. You feel inexplicably lighter after drinking.",
    effects: [
      { type: "special", description: "Gain a flying speed equal to your walking speed for 1 hour." },
    ],
  },
  {
    name: "Potion of Fire Breath",
    type: "potion", rarity: "uncommon", consumable: true,
    description: "An orange-red potion that warms your throat. Your breath smells of smoke after.",
    effects: [
      { type: "special", description: "Exhale fire as a bonus action: 30ft cone, 4d6 fire (DEX save DC 13 halves). Up to 3 times within 1 hour." },
    ],
  },

  // SCROLLS
  {
    name: "Scroll of Magic Missile",
    type: "scroll", rarity: "common", consumable: true,
    description: "Parchment inscribed with runes of force. Hums faintly when touched.",
    effects: [
      { type: "special", description: "Cast Magic Missile: 3 darts (1d4+1 force each), auto-hit up to 3 targets. Consumed." },
    ],
  },
  {
    name: "Scroll of Fireball",
    type: "scroll", rarity: "uncommon", consumable: true,
    description: "The parchment is warm. Small ember-like sparks drift from the ink.",
    effects: [
      { type: "special", description: "Cast Fireball: 8d6 fire in 20ft radius, DEX save DC 13 halves. Consumed." },
    ],
  },
  {
    name: "Scroll of Cure Wounds",
    type: "scroll", rarity: "common", consumable: true,
    description: "Scripture from a healer's temple, faintly glowing gold.",
    effects: [
      { type: "hp_heal", diceFormula: "1d8+3", description: "Heals 1d8+3 HP on a touched creature. Consumed." },
    ],
  },
  {
    name: "Scroll of Invisibility",
    type: "scroll", rarity: "uncommon", consumable: true,
    description: "The ink seems to fade and reappear as you look at it.",
    effects: [
      { type: "special", description: "Cast Invisibility on yourself or a touched creature for 1 hour. Consumed." },
    ],
  },

  // RINGS
  {
    name: "Ring of Protection",
    type: "ring", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "A plain silver band that hums with faint protective magic.",
    effects: [
      { type: "ac_add",   value: 1, description: "+1 to AC." },
      { type: "save_add", value: 1, description: "+1 to all saving throws." },
    ],
  },
  {
    name: "Ring of Strength",
    type: "ring", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "A thick iron band engraved with a flexed arm. Unnaturally heavy.",
    effects: [
      { type: "stat_add", stat: "strength", value: 2, description: "+2 Strength." },
    ],
  },
  {
    name: "Ring of Dexterity",
    type: "ring", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "A thin silver band that seems to move when you're not looking at it.",
    effects: [
      { type: "stat_add", stat: "dexterity", value: 2, description: "+2 Dexterity." },
    ],
  },
  {
    name: "Ring of Feather Falling",
    type: "ring", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "Engraved with a falling feather. Gravity feels kinder with it on.",
    effects: [
      { type: "special", description: "Fall at 60ft/round. Take no falling damage." },
    ],
  },
  {
    name: "Ring of Darkvision",
    type: "ring", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "A black onyx ring. The gem seems to drink in light.",
    effects: [
      { type: "special", description: "Darkvision out to 60ft in darkness." },
    ],
  },
  {
    name: "Ring of Mind Shielding",
    type: "ring", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "A copper ring with a mirrorlike gem.",
    effects: [
      { type: "special", description: "Immune to magic detecting emotions or reading thoughts. Resistance to psychic damage." },
    ],
  },
  {
    name: "Ring of Regeneration",
    type: "ring", rarity: "very_rare", consumable: false, requiresAttunement: true,
    description: "A vine-wrapped ring that pulses gently with life energy.",
    effects: [
      { type: "special", description: "Regain 1d6 HP every 10 minutes (while above 0 HP)." },
    ],
  },
  {
    name: "Ring of Spell Storing",
    type: "ring", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "A faceted sapphire ring. You can feel it holding something inside.",
    effects: [
      { type: "special", description: "Stores up to 5 levels of spells cast into it. Ring holder can cast stored spells using stored slots." },
    ],
  },

  // AMULETS
  {
    name: "Amulet of Health",
    type: "amulet", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "A jade amulet carved in the shape of a heart. Warm to the touch.",
    effects: [
      { type: "stat_set", stat: "constitution", value: 19, description: "Constitution set to 19 (if lower)." },
    ],
  },
  {
    name: "Amulet of Natural Armor",
    type: "amulet", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "A dragon-scale amulet. Your skin hardens slightly while worn.",
    effects: [
      { type: "ac_add", value: 1, description: "+1 to AC (natural armor bonus)." },
    ],
  },
  {
    name: "Periapt of Wound Closure",
    type: "amulet", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "A ruby-red gem on a golden chain. Wounds begin to close when you touch it.",
    effects: [
      { type: "special", description: "Stabilize automatically at 0 HP. Double HP regained from spending Hit Dice." },
    ],
  },
  {
    name: "Amulet of Proof Against Detection",
    type: "amulet", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "An amber amulet carved with a closed eye. It feels like being watched — then not.",
    effects: [
      { type: "special", description: "Hidden from divination magic. Cannot be targeted by such spells or perceived through crystal balls." },
    ],
  },

  // CLOAKS
  {
    name: "Cloak of Protection",
    type: "cloak", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "A deep blue cloak that seems to deflect harm.",
    effects: [
      { type: "ac_add",   value: 1, description: "+1 to AC." },
      { type: "save_add", value: 1, description: "+1 to all saving throws." },
    ],
  },
  {
    name: "Cloak of Elvenkind",
    type: "cloak", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "A mottled green cloak that shifts color to match surroundings.",
    effects: [
      { type: "special", description: "Advantage on Stealth checks. Disadvantage on Perception checks against you." },
    ],
  },
  {
    name: "Cloak of Displacement",
    type: "cloak", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "Your form flickers and shifts. Difficult to pin down exactly where you are.",
    effects: [
      { type: "special", description: "Attackers have disadvantage on the first attack roll against you each round." },
    ],
  },
  {
    name: "Cloak of the Bat",
    type: "cloak", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "Black as midnight. The hem seems to move on its own.",
    effects: [
      { type: "special", description: "Advantage on Stealth checks in dim light or darkness. Can fly 40ft (bat form) at night." },
    ],
  },

  // GLOVES / GAUNTLETS
  {
    name: "Gauntlets of Ogre Power",
    type: "gloves", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "Heavy iron gauntlets crested with a tusked face. Your grip crushes iron.",
    effects: [
      { type: "stat_set", stat: "strength", value: 19, description: "Strength set to 19 (if lower)." },
    ],
  },
  {
    name: "Gloves of Missile Snaring",
    type: "gloves", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "Sleek leather gloves reinforced at the palms.",
    effects: [
      { type: "special", description: "Reaction: catch a ranged weapon attack; reduce damage by 1d10 + DEX modifier." },
    ],
  },
  {
    name: "Gloves of Thievery",
    type: "gloves", rarity: "uncommon", consumable: false,
    description: "Thin leather gloves that make your fingers inexplicably precise.",
    effects: [
      { type: "special", description: "+5 to Sleight of Hand checks and thieves' tools checks." },
    ],
  },

  // HEADGEAR
  {
    name: "Headband of Intellect",
    type: "headgear", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "A polished copper band with a glittering gem that seems to sharpen thought.",
    effects: [
      { type: "stat_set", stat: "intelligence", value: 19, description: "Intelligence set to 19 (if lower)." },
    ],
  },
  {
    name: "Circlet of Blasting",
    type: "headgear", rarity: "uncommon", consumable: false,
    description: "A gold circlet with a fire opal that blazes with inner heat.",
    effects: [
      { type: "special", description: "Cast Scorching Ray (3 rays, 2d6 fire each) up to 3 times per day." },
    ],
  },
  {
    name: "Cap of Water Breathing",
    type: "headgear", rarity: "uncommon", consumable: false,
    description: "A woven cap threaded with kelp and sea glass.",
    effects: [
      { type: "special", description: "Breathe underwater while worn." },
    ],
  },

  // BOOTS
  {
    name: "Boots of Speed",
    type: "boots", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "Enchanted boots that blur at the heel when you run.",
    effects: [
      { type: "special", description: "Bonus action: double walking speed for 10 min. Opportunity attacks against you have disadvantage." },
    ],
  },
  {
    name: "Boots of Elvenkind",
    type: "boots", rarity: "uncommon", consumable: false,
    description: "Soft leather boots that make no sound, even on gravel.",
    effects: [
      { type: "special", description: "Your movement makes no sound. Advantage on Stealth checks involving movement." },
    ],
  },
  {
    name: "Boots of Striding and Springing",
    type: "boots", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "Sturdy boots with spring-loaded heels that somehow never wear out.",
    effects: [
      { type: "special", description: "Walking speed minimum 30ft regardless of encumbrance. Jump distance tripled." },
    ],
  },
  {
    name: "Winged Boots",
    type: "boots", rarity: "uncommon", consumable: false, requiresAttunement: true,
    description: "Fine leather boots with small feathered wings at the ankle.",
    effects: [
      { type: "special", description: "Flying speed equal to walking speed, up to 4 hours/day (recharges at dawn)." },
    ],
  },

  // ARMOR
  {
    name: "Shield +1",
    type: "shield", rarity: "uncommon", consumable: false,
    description: "A well-balanced shield that deflects blows unnaturally well.",
    effects: [
      { type: "ac_add", value: 1, description: "+1 AC (stacks with normal shield bonus)." },
    ],
  },
  {
    name: "Leather Armor +1",
    type: "armor", rarity: "uncommon", consumable: false,
    description: "Supple leather reinforced with magical threading.",
    effects: [
      { type: "ac_add", value: 1, description: "+1 AC." },
    ],
  },
  {
    name: "Chain Mail +1",
    type: "armor", rarity: "uncommon", consumable: false,
    description: "Rings of exceptional quality, interlinked with unusual precision.",
    effects: [
      { type: "ac_add", value: 1, description: "+1 AC." },
    ],
  },
  {
    name: "Breastplate +1",
    type: "armor", rarity: "uncommon", consumable: false,
    description: "A gleaming breastplate with engraved defensive runes.",
    effects: [
      { type: "ac_add", value: 1, description: "+1 AC." },
    ],
  },
  {
    name: "Plate Armor +1",
    type: "armor", rarity: "rare", consumable: false,
    description: "Full plate that moves with you like a second skin.",
    effects: [
      { type: "ac_add", value: 1, description: "+1 AC." },
    ],
  },
  {
    name: "Mithral Armor",
    type: "armor", rarity: "uncommon", consumable: false,
    description: "Gleaming silver mail spun from rare mithral ore. Light as cloth.",
    effects: [
      { type: "special", description: "No Stealth disadvantage, no Strength requirement. Medium armor qualifies as light." },
    ],
  },
  {
    name: "Adamantine Armor",
    type: "armor", rarity: "uncommon", consumable: false,
    description: "Black-veined plate of unyielding adamantine. Near-impervious.",
    effects: [
      { type: "special", description: "Any critical hit against you becomes a normal hit." },
    ],
  },
  {
    name: "Dragon Scale Mail",
    type: "armor", rarity: "very_rare", consumable: false, requiresAttunement: true,
    description: "Crafted from the scales of a slain dragon. Heavy, ancient, magnificent.",
    effects: [
      { type: "ac_add",   value: 1,  description: "+1 AC." },
      { type: "save_add", value: 1,  description: "+1 to saving throws." },
      { type: "special",             description: "Advantage on saving throws against the breath weapon of the dragon type whose scales formed the armor." },
    ],
  },

  // WEAPONS
  {
    name: "Longsword +1",
    type: "weapon", rarity: "uncommon", consumable: false,
    description: "A perfectly balanced longsword with a faint magical edge.",
    effects: [
      { type: "attack_add", value: 1, description: "+1 to attack and damage rolls." },
    ],
  },
  {
    name: "Longsword +2",
    type: "weapon", rarity: "rare", consumable: false,
    description: "A longsword that hums with stronger enchantment.",
    effects: [
      { type: "attack_add", value: 2, description: "+2 to attack and damage rolls." },
    ],
  },
  {
    name: "Shortsword +1",
    type: "weapon", rarity: "uncommon", consumable: false,
    description: "A nimble blade that strikes with uncanny precision.",
    effects: [
      { type: "attack_add", value: 1, description: "+1 to attack and damage rolls." },
    ],
  },
  {
    name: "Rapier +1",
    type: "weapon", rarity: "uncommon", consumable: false,
    description: "A slender dueling blade with a subtle violet glow.",
    effects: [
      { type: "attack_add", value: 1, description: "+1 to attack and damage rolls." },
    ],
  },
  {
    name: "Dagger +2",
    type: "weapon", rarity: "rare", consumable: false,
    description: "A keen throwing knife etched with runes of speed.",
    effects: [
      { type: "attack_add", value: 2, description: "+2 to attack and damage rolls." },
    ],
  },
  {
    name: "Handaxe +1",
    type: "weapon", rarity: "uncommon", consumable: false,
    description: "A throwing axe with a rune of returning on its head.",
    effects: [
      { type: "attack_add", value: 1, description: "+1 to attack and damage rolls." },
    ],
  },
  {
    name: "Warhammer +1",
    type: "weapon", rarity: "uncommon", consumable: false,
    description: "A heavy hammer that rings with a low resonant hum on impact.",
    effects: [
      { type: "attack_add", value: 1, description: "+1 to attack and damage rolls." },
    ],
  },
  {
    name: "Flame Tongue",
    type: "weapon", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "A blade that erupts in fire on command. Lights up a 40ft radius.",
    effects: [
      { type: "special",      description: "While ignited: +2d6 fire damage on hits, sheds bright light 40ft. Bonus action to ignite/extinguish." },
      { type: "attack_add", value: 1, description: "+1 to attack rolls." },
    ],
  },
  {
    name: "Frost Brand",
    type: "weapon", rarity: "very_rare", consumable: false, requiresAttunement: true,
    description: "A blade of pale ice that never melts. The air cools around it.",
    effects: [
      { type: "attack_add", value: 1, description: "+1 to attack rolls." },
      { type: "special",      description: "+1d6 cold damage on hits. Resistance to fire damage. Extinguishes non-magical flames within 30ft." },
    ],
  },
  {
    name: "Staff of Striking",
    type: "staff", rarity: "very_rare", consumable: false, requiresAttunement: true,
    description: "A gnarled staff with crackling energy at its tip.",
    effects: [
      { type: "attack_add", value: 3, description: "+3 to attack and damage rolls." },
      { type: "special",      description: "10 charges. Spend 1–3 charges on a hit to deal extra 1d6 force per charge. Regain 1d6+4 charges at dawn." },
    ],
  },
  {
    name: "Sword of Life Stealing",
    type: "weapon", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "A black blade that drinks the life of those it wounds.",
    effects: [
      { type: "attack_add", value: 1, description: "+1 to attack and damage rolls." },
      { type: "special",      description: "On a critical hit: deal extra 10 necrotic damage and gain 10 temporary HP." },
    ],
  },
  {
    name: "Dragon Slayer",
    type: "weapon", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "Forged with dragon-bane alloys. The blade vibrates near draconic creatures.",
    effects: [
      { type: "attack_add", value: 1, description: "+1 to attack and damage rolls." },
      { type: "special",      description: "Against dragons and dragonkind: +3d6 extra damage per hit." },
    ],
  },

  // WONDROUS ITEMS
  {
    name: "Bag of Holding",
    type: "wondrous", rarity: "uncommon", consumable: false,
    description: "A plain cloth bag. The interior is a pocket dimension — far larger than it appears.",
    effects: [
      { type: "special", description: "Holds 64 cubic feet / 500 lbs without adding weight. Items retrievable in 1 action." },
    ],
  },
  {
    name: "Rope of Climbing",
    type: "wondrous", rarity: "uncommon", consumable: false,
    description: "A 60ft silk rope that ties itself and climbs on command.",
    effects: [
      { type: "special", description: "Animates on command: ties knots, attaches to surfaces, climbs. DC 17 STR to break." },
    ],
  },
  {
    name: "Immovable Rod",
    type: "rod", rarity: "uncommon", consumable: false,
    description: "A plain iron rod with a button on one end. Pressing it locks the rod in place mid-air.",
    effects: [
      { type: "special", description: "Rod fixes itself in space when button pressed. Holds 8,000 lbs. DC 30 STR to move it." },
    ],
  },
  {
    name: "Sending Stones",
    type: "wondrous", rarity: "uncommon", consumable: false,
    description: "Paired smooth stones linked by magic. Each transmits 25-word messages once per day.",
    effects: [
      { type: "special", description: "Once per day: send a 25-word message to the paired stone holder, anywhere on this plane." },
    ],
  },
  {
    name: "Lantern of Revealing",
    type: "wondrous", rarity: "uncommon", consumable: false,
    description: "An ornate hooded lantern burning with golden flame. Reveals what shouldn't be visible.",
    effects: [
      { type: "special", description: "Reveals invisible creatures and objects within 30ft. Burns 1 hour per flask of oil." },
    ],
  },
  {
    name: "Gem of Seeing",
    type: "wondrous", rarity: "rare", consumable: false, requiresAttunement: true,
    description: "A faceted gem that reveals the truth when gazed through.",
    effects: [
      { type: "special", description: "3 charges/day: truesight 120ft for 10 min. See invisible things, true forms, magical illusions." },
    ],
  },
  {
    name: "Decanter of Endless Water",
    type: "wondrous", rarity: "uncommon", consumable: false,
    description: "A stoppered flask that produces water on command. Never runs dry.",
    effects: [
      { type: "special", description: "Produces fresh, salt, or geysering water on command (up to 30 gallons per minute)." },
    ],
  },

  // CURSED ITEMS
  {
    name: "Berserker Axe",
    type: "weapon", rarity: "rare", consumable: false, requiresAttunement: true, cursed: true,
    description: "A beautifully balanced axe. It wants blood. Even yours.",
    effects: [
      { type: "attack_add", value: 2,      description: "+2 to attack and damage rolls." },
      { type: "special",                   description: "⚠️ CURSED: When you take damage, DC 15 WIS save or use all movement attacking the nearest creature." },
    ],
  },
  {
    name: "Ring of Clumsiness",
    type: "ring", rarity: "uncommon", consumable: false, cursed: true,
    description: "A pretty gold ring. You feel oddly uncoordinated after slipping it on.",
    effects: [
      { type: "stat_add", stat: "dexterity", value: -4, description: "⚠️ CURSED: −4 Dexterity." },
      { type: "special",                               description: "⚠️ Cannot be removed without Remove Curse." },
    ],
  },
  {
    name: "Armor of Vulnerability",
    type: "armor", rarity: "rare", consumable: false, cursed: true,
    description: "Polished plate that looks magnificent. It's thin in all the wrong places.",
    effects: [
      { type: "ac_add", value: -2, description: "⚠️ CURSED: −2 to AC while wearing." },
      { type: "special",           description: "⚠️ Disadvantage on STR saving throws. Cannot be removed without Remove Curse." },
    ],
  },
  {
    name: "Medallion of Thought Projection",
    type: "amulet", rarity: "uncommon", consumable: false, cursed: true,
    description: "An ornate silver medallion. Your thoughts feel strangely louder.",
    effects: [
      { type: "special", description: "⚠️ CURSED: Your surface thoughts are audible to creatures within 30ft. Cannot lie while worn. Remove Curse required to remove." },
    ],
  },
];

// ── Lookup map ────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

const CATALOG_MAP = new Map<string, LootItem>();
for (const item of CATALOG) {
  CATALOG_MAP.set(normalizeName(item.name), item);
}

export function getItemByName(name: string): LootItem | undefined {
  return CATALOG_MAP.get(normalizeName(name));
}

// Read-only view of every item in the catalog. Used by narrative renderers that
// want to scan DM text for known item names and add tooltips/rarity colors.
export function getAllCatalogItems(): readonly LootItem[] {
  return CATALOG;
}

// ── Bonus computation ─────────────────────────────────────────────────────────

export function computeInventoryBonuses(items: string[], weapons: string[]): ItemBonuses {
  const bonuses: ItemBonuses = {
    statAdd: {}, statSet: {}, acAdd: 0, saveAdd: 0,
    attackAdd: 0, hpMaxAdd: 0, activeEffects: [],
  };
  // Defensive: legacy/malformed character rows may carry a non-array inventory
  // (e.g. inventory === []). Coerce so the spread can never throw and crash the
  // entire campaign page ("items is not iterable").
  const safeItems   = Array.isArray(items)   ? items   : [];
  const safeWeapons = Array.isArray(weapons) ? weapons : [];
  for (const name of [...safeItems, ...safeWeapons]) {
    const item = getItemByName(name);
    if (!item) continue;
    for (const e of item.effects) {
      switch (e.type) {
        case "stat_add":
          if (e.stat && e.value !== undefined)
            bonuses.statAdd[e.stat] = (bonuses.statAdd[e.stat] ?? 0) + e.value;
          break;
        case "stat_set":
          if (e.stat && e.value !== undefined)
            bonuses.statSet[e.stat] = Math.max(bonuses.statSet[e.stat] ?? 0, e.value);
          break;
        case "ac_add":
          bonuses.acAdd += e.value ?? 0;
          break;
        case "save_add":
          bonuses.saveAdd += e.value ?? 0;
          break;
        case "attack_add":
          bonuses.attackAdd += e.value ?? 0;
          break;
        case "hp_max_add":
          bonuses.hpMaxAdd += e.value ?? 0;
          break;
        case "special":
          if (e.description) bonuses.activeEffects.push({ itemName: item.name, text: e.description });
          break;
      }
    }
  }
  return bonuses;
}

export function getEffectiveStat(base: number, statKey: string, bonuses: ItemBonuses): number {
  const added = bonuses.statAdd[statKey] ?? 0;
  const setTo = bonuses.statSet[statKey] ?? 0;
  const fromAdd = base + added;
  return setTo > 0 ? Math.max(fromAdd, setTo) : fromAdd;
}

// ── Dice roller ───────────────────────────────────────────────────────────────

export function rollDiceFormula(formula: string): { total: number; rolls: number[] } {
  const m = formula.match(/^(\d+)d(\d+)(?:\+(\d+))?$/i);
  if (!m) return { total: 0, rolls: [] };
  const count = parseInt(m[1]);
  const sides = parseInt(m[2]);
  const mod   = parseInt(m[3] ?? "0");
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
  return { total: rolls.reduce((a, b) => a + b, 0) + mod, rolls };
}

// ── DM prompt helpers ─────────────────────────────────────────────────────────

export function buildItemEffectsSummary(items: string[], weapons: string[]): string {
  const lines: string[] = [];
  for (const name of [...items, ...weapons]) {
    const item = getItemByName(name);
    if (!item) continue;
    const fx = item.effects.map(e => e.description ?? "").filter(Boolean).join("; ");
    if (fx) lines.push(`${name}: ${fx}`);
  }
  return lines.join("\n") || "none";
}

// Summary for DM system prompt — loot guidelines
export const DM_LOOT_GUIDE = `
LOOT & TREASURE
- Name items explicitly using standard D&D 5e names: "Potion of Healing", "Longsword +1", "Ring of Protection", etc. — this allows the system to track them.
- When players search a body, chest, or room: narrate what they find item by item. Don't hedge with "various trinkets."
- Award loot appropriate to the threat:
  • Goblins / bandits: 0–20gp, chance of Dagger +1, Antitoxin, Potion of Healing, Leather Armor +1
  • Orcs / hobgoblins: 5–40gp, chance of Handaxe +1, Warhammer +1, Chain Mail +1, Potion of Healing
  • Cultists / mages: 5–50gp, scrolls, rings, potions, dark artifacts
  • Named villains / captains: 30–150gp, magic weapons, armor +1, Ring of Protection, Cloak of Protection
  • Dragon hoards / major bosses: 200–2000gp, legendary items, Flame Tongue, Staff of Striking, very rare potions
  • Treasure chests / hidden stashes: 20–300gp, Bag of Holding, Rope of Climbing, Potions, Scrolls, Wondrous Items
- NPC rewards: state gold as a number ("rewards you with 50 gold pieces") or name items explicitly.
- A "pouch of coins" or "purse of gold" should have a stated amount.
- Not every enemy has loot — a wounded guard might have 3gp and nothing else. Don't force it.
- Cursed items may be beautiful and powerful but have a dark cost the player discovers in play.`.trim();
