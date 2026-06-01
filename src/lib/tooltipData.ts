// Shared D&D tooltip data — used site-wide for player education
// All descriptions follow D&D 5e SRD rules.

export type TipEntry = { title: string; body: string };

// ── Ability scores ────────────────────────────────────────────────────────────
export const STAT_TIPS: Record<string, TipEntry> = {
  STR: { title: "Strength", body: "Physical power — melee attack rolls, damage, Athletics checks, and how much you can carry. Key stat for Barbarians, Fighters, and Paladins." },
  DEX: { title: "Dexterity", body: "Agility and reflexes — ranged attack rolls, AC when wearing light or no armor, Stealth, Acrobatics, and Initiative. Key stat for Rogues and Rangers." },
  CON: { title: "Constitution", body: "Toughness and endurance — your maximum HP (each level adds your CON modifier), and Concentration saving throws when taking damage while sustaining a spell." },
  INT: { title: "Intelligence", body: "Reasoning and memory — Arcana, History, Nature, Religion, and Investigation checks. Determines the power of Wizard spells." },
  WIS: { title: "Wisdom", body: "Perception and intuition — Perception, Insight, Medicine, Survival, and Animal Handling checks. Powers Cleric and Druid spells." },
  CHA: { title: "Charisma", body: "Force of personality — Persuasion, Deception, Performance, and Intimidation checks. Powers Bard, Sorcerer, and Warlock spells." },
};

// ── Modifier helper description ───────────────────────────────────────────────
export const MODIFIER_TIP = "Your modifier = (score − 10) ÷ 2, rounded down. Added to all rolls made with this ability.";

// ── Races ─────────────────────────────────────────────────────────────────────
export const RACE_TIPS: Record<string, TipEntry> = {
  Human:      { title: "Human", body: "+1 to all ability scores. Extra skill proficiency and a feat at level 1. The most adaptable and ambitious of races." },
  Elf:        { title: "Elf", body: "+2 DEX. Darkvision 60 ft. Advantage on saving throws against charm. Immune to magical sleep. Keen Senses (Perception proficiency)." },
  Dwarf:      { title: "Dwarf", body: "+2 CON. Darkvision 60 ft. Resistance to poison damage. Advantage on saving throws against poison. Tool proficiency." },
  Halfling:   { title: "Halfling", body: "+2 DEX. Lucky — reroll any 1 on attack rolls, ability checks, or saving throws. Brave — advantage on saves against being frightened." },
  Dragonborn: { title: "Dragonborn", body: "+2 STR, +1 CHA. Breath weapon based on your draconic ancestry (fire, ice, lightning, etc.) and resistance to that damage type." },
  Tiefling:   { title: "Tiefling", body: "+1 INT, +2 CHA. Darkvision 60 ft. Resistance to fire damage. Thaumaturgy cantrip, Hellish Rebuke (2nd level), Darkness (3rd level)." },
  Gnome:      { title: "Gnome", body: "+2 INT. Darkvision 60 ft. Gnome Cunning — advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." },
  "Half-Elf": { title: "Half-Elf", body: "+2 CHA, +1 to two other stats of your choice. Darkvision 60 ft. Two extra skill proficiencies. Advantage on charm saving throws." },
  "Half-Orc": { title: "Half-Orc", body: "+2 STR, +1 CON. Darkvision 60 ft. Relentless Endurance — drop to 1 HP instead of 0 once per long rest. Savage Attacks on critical hits." },
};

// ── Classes ───────────────────────────────────────────────────────────────────
export const CLASS_TIPS: Record<string, TipEntry & { hitDie: string; primaryStat: string }> = {
  Fighter:   { title: "Fighter",   hitDie: "d10", primaryStat: "STR or DEX", body: "Master of all weapons and armor. Action Surge for an extra action, Second Wind to self-heal, and Fighting Style bonuses. Extra Attack at level 5." },
  Wizard:    { title: "Wizard",    hitDie: "d6",  primaryStat: "INT",        body: "Arcane scholar with the widest spell selection. Spellbook grows every level. Arcane Recovery restores spell slots on a short rest. Subclass at level 2." },
  Rogue:     { title: "Rogue",     hitDie: "d8",  primaryStat: "DEX",        body: "Cunning striker. Sneak Attack deals extra dice when you have Advantage or an ally is adjacent. Cunning Action: Dash, Disengage, or Hide as a bonus action." },
  Cleric:    { title: "Cleric",    hitDie: "d8",  primaryStat: "WIS",        body: "Divine spellcaster with healing and support magic. Turn Undead, heavy armor proficiency, and a powerful Domain ability depending on your chosen deity." },
  Paladin:   { title: "Paladin",   hitDie: "d10", primaryStat: "STR & CHA",  body: "Holy warrior. Divine Smite expends a spell slot to add radiant damage on any hit. Lay on Hands heals HP from a pool. Aura of Protection at level 6." },
  Ranger:    { title: "Ranger",    hitDie: "d10", primaryStat: "DEX & WIS",  body: "Wilderness hunter. Hunter's Mark adds bonus damage and helps track prey. Favored Enemy and Favored Terrain grant exploration advantages. Spells from level 2." },
  Bard:      { title: "Bard",      hitDie: "d8",  primaryStat: "CHA",        body: "Magical performer and jack of all trades. Bardic Inspiration gives allies a bonus die for rolls. Jack of All Trades adds half proficiency to all skill checks." },
  Warlock:   { title: "Warlock",   hitDie: "d8",  primaryStat: "CHA",        body: "Power from an otherworldly patron. Fewer spell slots but they restore on a SHORT rest. Eldritch Blast is the signature cantrip. Invocations customize your kit." },
  Barbarian: { title: "Barbarian", hitDie: "d12", primaryStat: "STR",        body: "Primal rage warrior with the highest hit die. Rage grants bonus damage and resistance to physical damage. Reckless Attack gives advantage at the cost of defense." },
  Druid:     { title: "Druid",     hitDie: "d8",  primaryStat: "WIS",        body: "Nature's conduit. Wild Shape transforms you into beasts for scouting or combat. Full spellcasting list focused on summoning, healing, and elemental magic." },
  Monk:      { title: "Monk",      hitDie: "d8",  primaryStat: "DEX & WIS",  body: "Unarmed martial artist. Ki points power Stunning Strike, Flurry of Blows, and Step of the Wind. Unarmored Defense uses WIS for AC. Speed bonus scales with level." },
  Sorcerer:  { title: "Sorcerer",  hitDie: "d6",  primaryStat: "CHA",        body: "Innate spellcaster. Metamagic lets you alter spells (twin, quicken, empower, etc.). Sorcery Points are a flexible resource convertible to spell slots." },
};

// ── Game mechanics ─────────────────────────────────────────────────────────────
export const MECHANIC_TIPS: Record<string, TipEntry> = {
  HP:             { title: "Hit Points (HP)", body: "Your life total. Reach 0 and you fall unconscious and begin making Death Saving Throws (3 successes = stable, 3 failures = dead). Healed by spells and rest." },
  AC:             { title: "Armor Class (AC)", body: "How hard you are to hit. Attackers must meet or beat your AC on a d20 attack roll. Base 10 + DEX mod when unarmored (Monks and Barbarians add more)." },
  GOLD:           { title: "Gold Pieces (GP)", body: "The standard currency. 1 GP = 10 SP = 100 CP. Used to buy equipment, services, and magical goods at shops and markets." },
  XP:             { title: "Experience Points (XP)", body: "Earned by defeating enemies and overcoming challenges. Accumulate enough to level up your character and gain new abilities." },
  SPELL_SLOTS:    { title: "Spell Slots", body: "The fuel for your magic. Each spell cast expends a slot of that spell's level or higher. Fully restored on a Long Rest (Warlocks recover on Short Rest)." },
  SHORT_REST:     { title: "Short Rest (1 hour)", body: "Spend Hit Dice to recover HP: roll your hit die + CON modifier per die spent. Warlocks recover all spell slots. Fighters recover Action Surge. Monks recover Ki points." },
  LONG_REST:      { title: "Long Rest (8 hours)", body: "Fully restore all HP, all spell slots, and most class abilities. Requires at least 6 hours of sleep. Limited to once per 24 hours in-game." },
  PROFICIENCY:    { title: "Proficiency Bonus", body: "Added to attack rolls, saving throws, and skill checks you are trained in. Starts at +2 at level 1 and increases at levels 5 (+3), 9 (+4), 13 (+5), and 17 (+6)." },
  INITIATIVE:     { title: "Initiative", body: "Rolled at the start of combat: d20 + DEX modifier. Higher result = earlier in the turn order. Determines who acts first when swords are drawn." },
  SAVING_THROW:   { title: "Saving Throw", body: "A d20 roll to resist an effect — a spell, a trap, a poison. You add proficiency to your two class saving throws. DC is set by the attacker's ability score." },
  ADVANTAGE:      { title: "Advantage", body: "Roll two d20s and take the higher result. Gained from helpful conditions (Bless, Reckless Attack, flanking), spells, or special abilities." },
  DISADVANTAGE:   { title: "Disadvantage", body: "Roll two d20s and take the lower result. Imposed by harmful conditions (Poisoned, Restrained), ranged attacks while adjacent to an enemy, or specific spells." },
  PASS_TURN:      { title: "Pass Turn", body: "Swap your position in the turn order with another player. You will still act later in the round at their original slot — your turn is not skipped." },
  DEATH_SAVE:     { title: "Death Saving Throw", body: "Made at the start of each turn when unconscious. Roll a d20: 10+ is a success, 9 or lower is a failure. 3 successes = stable, 3 failures = dead. A 20 restores 1 HP." },
  CRIT:           { title: "Critical Hit", body: "Roll a natural 20 on an attack roll. Double all damage dice rolled (not modifiers). Some abilities (Savage Attacks, Champion Fighter) improve crit range or add dice." },
  CONCENTRATION:  { title: "Concentration", body: "Some spells require Concentration to maintain. You can only concentrate on one spell at a time. Taking damage forces a CON saving throw (DC 10 or half damage) to keep it." },
  CR:             { title: "Challenge Rating (CR)", body: "A rough measure of a monster's danger. CR ½ = easy for level-1 heroes. CR 1–4 = standard threats. CR 5+ = elite dangers. CR 20+ = legendary threats that reshape history." },
  HIT_DIE:        { title: "Hit Die", body: "Your class's healing die. Rolled on level-up for HP gained. During a Short Rest, spend Hit Dice to recover HP: roll the die and add your CON modifier per die spent." },
  CANTRIP:        { title: "Cantrip (at-will)", body: "A spell you can cast infinitely — no spell slot required. Cantrips scale in power at levels 5, 11, and 17. Less powerful than slotted spells, but they never run out." },
  PREPARED_SPELL: { title: "Prepared Spell", body: "A spell you've memorized for the day. Each cast expends a spell slot of that spell's level or higher. Slots restore on a Long Rest (Warlocks restore on Short Rest)." },
  LEVEL:          { title: "Character Level", body: "Ranges 1–20. Each level adds HP (hit die + CON mod), increases power, and unlocks class features. Proficiency Bonus increases at levels 5, 9, 13, and 17." },
  ATTUNEMENT:     { title: "Attunement", body: "Some magic items require a short rest to bond with before their magic activates. You can attune to at most 3 items at once. Breaking attunement takes another short rest." },
  CURSED:         { title: "Cursed Item", body: "This item carries a hidden negative effect. Once attuned or equipped, it often cannot be removed without a Remove Curse spell or similar magic. Handle with caution." },
  SPELLBOOK:      { title: "Spellbook", body: "Your character's known spells. Cantrips are free and infinite — no slot required. Prepared spells each consume a spell slot when cast. Click any spell to cast it in the story." },
  TRINKET:        { title: "Starting Trinket", body: "A small personal item with no combat stats — a locket, a coin, a carved figurine. The DM may reference it in story moments to add personality to your character." },
  BACKGROUND_STORY: { title: "Character Background", body: "Optional backstory the DM uses to tailor encounters, add story hooks, and generate your portrait. The more detail, the more personalized your adventure." },
  PARTY_LEADER:   { title: "Party Leader", body: "The party leader helps set the group's direction. Leadership can be transferred to another character at any time from the Party panel." },
  ACTIVE_TURN:    { title: "Active Turn", body: "It's this character's turn to act. Type an action, cast a spell, or pick a suggestion chip below. The DM will advance to the next player when the turn resolves." },
  TARGET_ENEMY:   { title: "Targeted Enemy", body: "Your attacks and offensive spells default to this enemy. Click another enemy to switch targets, or click the same one to deselect." },
  FONT_SIZE:      { title: "Text Size", body: "Adjust the font size of the story and chat panel. Changes are saved for future sessions." },
};

// ── Status conditions ─────────────────────────────────────────────────────────
export const CONDITION_TIPS: Record<string, string> = {
  Blinded:      "Cannot see. Auto-fail checks that require sight. Attack rolls against you have Advantage. Your attack rolls have Disadvantage.",
  Charmed:      "Cannot attack or target the charmer with harmful effects. The charmer has Advantage on social checks against you.",
  Deafened:     "Cannot hear. Auto-fail checks that require hearing. Spells with verbal components can still be cast.",
  Frightened:   "Disadvantage on attack rolls and ability checks while source of fear is in sight. Cannot willingly move closer to it.",
  Grappled:     "Speed becomes 0. Can be dragged by grappler. Escape with an Athletics or Acrobatics check (DC = grappler's Athletics).",
  Incapacitated:"Cannot take Actions or Reactions.",
  Invisible:    "Cannot be seen without special senses. Attacks against you have Disadvantage. Your attacks have Advantage. Can still be heard or tracked.",
  Paralyzed:    "Incapacitated, can't move or speak. Auto-fail STR/DEX saves. Attack rolls against you have Advantage. Hits within 5 ft are critical hits.",
  Petrified:    "Turned to stone. Incapacitated, weight × 10, resistance to all damage, immune to poison and disease.",
  Poisoned:     "Disadvantage on all attack rolls and ability checks.",
  Prone:        "Disadvantage on attack rolls. Melee attacks against you have Advantage; ranged attacks have Disadvantage. Costs half movement to stand up.",
  Restrained:   "Speed 0. Attack rolls against you have Advantage. Your attack rolls have Disadvantage. Disadvantage on DEX saving throws.",
  Stunned:      "Incapacitated, can't move, and can only speak falteringly. Auto-fail STR/DEX saves. Attacks against you have Advantage.",
  Unconscious:  "Incapacitated, can't move or speak, unaware of surroundings. Auto-fail STR/DEX saves. Critical hits within 5 ft. Drop anything held.",
  Burning:      "Taking fire damage at the start of each turn. Use an action or drop prone to extinguish the flames.",
  Blessed:      "Add a d4 bonus to attack rolls and saving throws. Granted by the Bless spell.",
  Hasted:       "Double speed, +2 AC, advantage on DEX saves, and an extra Action each turn. When it ends, suffer one turn of Lethargy (no action or reaction).",
  Raging:       "+2 bonus to melee damage, resistance to bludgeoning/piercing/slashing damage. Cannot cast or concentrate on spells while raging.",
  Hexed:        "Target has disadvantage on one ability check type of your choice. Takes bonus necrotic damage from your attacks.",
  Marked:       "Hunter's Mark: you deal an extra d6 damage when you hit, and have advantage on Perception/Survival checks to find the target.",
};

// ── Alignment ─────────────────────────────────────────────────────────────────
export const ALIGNMENT_TIPS: Record<string, string> = {
  "Lawful Good":    "Honor-bound champion. Follows a strict moral code, protects the innocent, upholds law when it serves the greater good.",
  "Neutral Good":   "Pragmatic altruist. Does what is good wherever possible — rules matter when they help, not when they don't.",
  "Chaotic Good":   "Free-spirited hero. Fights for what is right and just, ignores laws that restrict freedom or harm the innocent.",
  "Lawful Neutral": "Principled follower. Upholds law, order, and tradition without personal moral agenda.",
  "True Neutral":   "Balanced observer. Avoids taking strong sides; believes the natural balance of forces must be maintained.",
  "Chaotic Neutral": "Wild card. Acts on whim and personal freedom above all else. Unpredictable, but not malicious.",
  "Lawful Evil":    "Ruthless ruler. Uses law, order, and hierarchy to dominate and control others for personal gain.",
  "Neutral Evil":   "Self-serving schemer. Does whatever advances their goals without remorse — no loyalty, no code.",
  "Chaotic Evil":   "Destructive force. Acts with arbitrary violence and malice, driven purely by cruelty and chaos.",
};

// ── Skills ────────────────────────────────────────────────────────────────────
export const SKILL_TIPS: Record<string, TipEntry> = {
  Athletics:       { title: "Athletics (STR)", body: "Climbing, jumping, swimming, grappling, and sheer feats of strength." },
  Acrobatics:      { title: "Acrobatics (DEX)", body: "Balance, tumbling, staying upright in difficult terrain, and escaping a grapple." },
  "Sleight of Hand": { title: "Sleight of Hand (DEX)", body: "Pickpocketing, palming objects, planting items on someone without being noticed." },
  Stealth:         { title: "Stealth (DEX)", body: "Moving silently and unseen past guards or creatures. Opposed by Perception." },
  Arcana:          { title: "Arcana (INT)", body: "Knowledge of spells, magic items, eldritch symbols, and magical traditions." },
  History:         { title: "History (INT)", body: "Recall lore about historical events, legendary people, and ancient kingdoms." },
  Investigation:   { title: "Investigation (INT)", body: "Search for clues, piece together evidence, find hidden compartments and objects." },
  Nature:          { title: "Nature (INT)", body: "Knowledge of terrain, plants, animals, weather, and natural cycles." },
  Religion:        { title: "Religion (INT)", body: "Knowledge of deities, divine magic, religious rites, cults, and sacred symbols." },
  "Animal Handling": { title: "Animal Handling (WIS)", body: "Calm, control, or intuit the intentions of animals. Handle mounts under stress." },
  Insight:         { title: "Insight (WIS)", body: "Read body language and tone to determine if someone is lying or has hidden motives." },
  Medicine:        { title: "Medicine (WIS)", body: "Stabilize a dying creature, diagnose illness, and treat wounds without magic." },
  Perception:      { title: "Perception (WIS)", body: "Notice details in your environment — spot hidden enemies, hear approaching footsteps." },
  Survival:        { title: "Survival (WIS)", body: "Track creatures, find food and water in the wild, navigate, and endure harsh conditions." },
  Deception:       { title: "Deception (CHA)", body: "Convincingly lie, mislead, and maintain a false identity or cover story." },
  Intimidation:    { title: "Intimidation (CHA)", body: "Influence others through threats, hostile actions, or a show of force." },
  Performance:     { title: "Performance (CHA)", body: "Entertain audiences with music, acting, storytelling, or dance." },
  Persuasion:      { title: "Persuasion (CHA)", body: "Diplomatically influence others through tact, flattery, goodwill, or appeals to reason." },
};

// ── Dice ─────────────────────────────────────────────────────────────────────
export const DICE_TIPS: Record<string, string> = {
  d4:   "4-sided die. Used for small weapons (dagger, handaxe), some spells, and low-level Bardic Inspiration.",
  d6:   "6-sided die. Used for common weapons (shortsword, rapier), Wizard/Sorcerer hit dice, and many damage spells.",
  d8:   "8-sided die. Used for versatile weapons (longsword), most class hit dice, and mid-level spells.",
  d10:  "10-sided die. Used for heavy weapons (halberd, rapier wielded in two hands), Fighter/Paladin/Ranger hit dice.",
  d12:  "12-sided die. Used for greataxes, mauls, and Barbarian hit dice — the biggest hit die in the game.",
  d20:  "20-sided die. The heart of D&D. All attack rolls, ability checks, and saving throws use the d20.",
  d100: "Percentile die (two d10s). Used for Wild Magic tables, treasure rolls, and random event tables.",
};

// ── Stat methods ─────────────────────────────────────────────────────────────
export const STAT_METHOD_TIPS: Record<string, TipEntry> = {
  roll:     { title: "Roll (4d6 drop lowest)", body: "Roll 4 six-sided dice and drop the lowest result for each stat. High variance — you might get exceptional stats or mediocre ones. Re-roll as often as you like." },
  array:    { title: "Standard Array", body: "Assign the fixed values 15, 14, 13, 12, 10, 8 to your six stats. Everyone starts with the same total power — a balanced, fair choice." },
  pointbuy: { title: "Point Buy", body: "Spend 27 points to set stats between 8 and 15. Every stat starts at 8. Higher values cost more points (14 costs 7 total, 15 costs 9 total). Maximum flexibility." },
};

// ── Proficiency labels ────────────────────────────────────────────────────────
export const PROF_TIPS: Record<string, TipEntry> = {
  saves:   { title: "Saving Throw Proficiency", body: "Your class grants proficiency in two saving throw types. Add your Proficiency Bonus when rolling those saves. Saving throws resist spells, traps, poisons, and other hazards." },
  armor:   { title: "Armor Proficiency", body: "The armor types your class can wear effectively. Wearing non-proficient armor imposes Disadvantage on all STR/DEX checks, saves, and attack rolls — and prevents spellcasting." },
  weapons: { title: "Weapon Proficiency", body: "Weapon types you're trained with. Attacks with non-proficient weapons don't add your Proficiency Bonus to the attack roll — a significant penalty to hit." },
};

// ── Weapons ───────────────────────────────────────────────────────────────────
export const WEAPON_TIPS: Record<string, TipEntry> = {
  "Longsword":    { title: "Longsword", body: "1d8 slashing · Versatile (1d10 two-handed). A martial weapon for trained combatants. Balanced for Fighters, Paladins, and any STR-based character." },
  "Shortbow":     { title: "Shortbow", body: "1d6 piercing · Range 80/320 ft. A simple weapon most classes can use without penalty. Ideal for DEX-based characters who need a ranged option." },
  "Staff":        { title: "Quarterstaff", body: "1d6 bludgeoning · Versatile (1d8 two-handed). A simple weapon any class can wield. Favored by Wizards and Druids who lack martial proficiency." },
  "Daggers (x2)": { title: "Daggers x2", body: "1d4 piercing · Light, finesse, thrown 20/60 ft. Two daggers enable two-weapon fighting as a bonus action with no feat required. Excellent for Rogues." },
  "Warhammer":    { title: "Warhammer", body: "1d8 bludgeoning · Versatile (1d10 two-handed). A martial weapon favored by divine warriors. Common choice for Clerics and STR-based characters." },
  "Crossbow":     { title: "Crossbow", body: "1d8 piercing · Range 80/320 ft. Loading: one attack per action without Crossbow Expert feat. Strong ranged damage for non-DEX builds." },
};

// ── Spell schools ─────────────────────────────────────────────────────────────
export const SPELL_SCHOOL_TIPS: Record<string, TipEntry> = {
  Evocation:     { title: "Evocation", body: "Raw magical energy shaped into elemental effects — fire, lightning, cold, force, thunder. The most offensive magic school." },
  Abjuration:    { title: "Abjuration", body: "Protective and defensive magic — barriers, counterspells, dispelling effects, and banishment." },
  Conjuration:   { title: "Conjuration", body: "Teleportation, summoning creatures or objects, and creating matter from thin air. Creates allies and tactical options." },
  Illusion:      { title: "Illusion", body: "Deceives the senses with false images, sounds, and sensations. Effects only last while believed — disbelieved with a WIS or Investigation check." },
  Enchantment:   { title: "Enchantment", body: "Controls and manipulates minds — charm, sleep, fear, and compulsion. Targets must fail a WIS save. Has no effect on constructs or undead." },
  Necromancy:    { title: "Necromancy", body: "Harnesses life force and death — healing, draining life, raising undead, and speaking with the dead. Powerful but feared by many civilizations." },
  Transmutation: { title: "Transmutation", body: "Alters physical properties — change shape, enhance strength, adjust speed, or polymorph. Highly versatile utility school." },
  Divination:    { title: "Divination", body: "Reveals hidden information — detect magic, identify items, read thoughts, or glimpse the future. Less combat-focused but invaluable for planning." },
};

// ── Standard Array value hints ─────────────────────────────────────────────────
export const ARRAY_VALUE_TIPS: Record<number, string> = {
  15: "+2 modifier · Best score available. Assign to your class's primary ability.",
  14: "+2 modifier · Second-best. Good for a key secondary stat.",
  13: "+1 modifier · Above average. Cover a stat you'll use often.",
  12: "+1 modifier · Solid. Good for saving throws or backup skills.",
  10: "+0 modifier · Average. For stats you'll rely on less.",
   8: "-1 modifier · Dump stat. Weakest score — for abilities you rarely use.",
};

// ── Enemy health conditions ───────────────────────────────────────────────────
export const ENEMY_CONDITION_TIPS: Record<string, string> = {
  Healthy:  "Full health — no visible injuries. This enemy is at peak fighting condition.",
  Wounded:  "Lightly hurt — past 75% HP. Showing signs of injury but still fully capable.",
  Bloodied: "Badly hurt — below 50% HP. Bleeding, movement impaired. Press the attack.",
  Critical: "Near death — below 25% HP. Staggering and desperate. One or two hits should finish it.",
  Defeated: "Slain or incapacitated — no longer a threat in this encounter.",
};
