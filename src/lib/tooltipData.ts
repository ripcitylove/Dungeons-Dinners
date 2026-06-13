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
  // Simple melee
  "Club":             { title: "Club", body: "1d4 bludgeoning · Light. The most basic melee weapon. Any class can wield it, but it deals minimal damage." },
  "Dagger":           { title: "Dagger", body: "1d4 piercing · Light, finesse, thrown 20/60 ft. Ideal for Rogues and backup sidearms. Finesse means STR or DEX for attack rolls." },
  "Daggers (x2)":     { title: "Daggers x2", body: "1d4 piercing each · Light, finesse, thrown 20/60 ft. Two daggers enable two-weapon fighting as a bonus action with no feat required. Excellent for Rogues." },
  "Greatclub":        { title: "Greatclub", body: "1d8 bludgeoning · Two-handed. A massive simple weapon. Deals more damage than a club, but requires both hands." },
  "Handaxe":          { title: "Handaxe", body: "1d6 slashing · Light, thrown 20/60 ft. A simple one-handed weapon that doubles as a thrown option. Works well with two-weapon fighting." },
  "Javelin":          { title: "Javelin", body: "1d6 piercing · Thrown 30/120 ft. A versatile simple weapon — useful melee or as a thrown ranged attack. Common starting weapon for Fighters." },
  "Light Hammer":     { title: "Light Hammer", body: "1d4 bludgeoning · Light, thrown 20/60 ft. A blacksmith's tool and a weapon. Light property allows two-weapon fighting." },
  "Mace":             { title: "Mace", body: "1d6 bludgeoning · A simple weapon favored by Clerics for bypassing some damage resistances. No proficiency requirement for any class." },
  "Quarterstaff":     { title: "Quarterstaff", body: "1d6 bludgeoning · Versatile (1d8 two-handed). A simple weapon any class can wield. Favored by Wizards and Druids who lack martial proficiency." },
  "Staff":            { title: "Quarterstaff", body: "1d6 bludgeoning · Versatile (1d8 two-handed). A simple weapon any class can wield. Favored by Wizards and Druids who lack martial proficiency." },
  "Sickle":           { title: "Sickle", body: "1d4 slashing · Light. A curved farming tool repurposed as a weapon. Druids can wield it without losing armor benefits." },
  "Spear":            { title: "Spear", body: "1d6 piercing · Versatile (1d8), thrown 20/60 ft. A simple weapon with excellent range options. Reach (10 ft) when used two-handed." },
  // Simple ranged
  "Shortbow":         { title: "Shortbow", body: "1d6 piercing · Range 80/320 ft. A simple weapon most classes can use without penalty. Ideal for DEX-based characters who need a ranged option." },
  "Sling":            { title: "Sling", body: "1d4 bludgeoning · Range 30/120 ft. Cheap and simple. Ammunition (stones) is plentiful. Good for characters who need a ranged option cheaply." },
  "Dart":             { title: "Dart", body: "1d4 piercing · Finesse, thrown 20/60 ft. A light thrown weapon with finesse — roll STR or DEX. Often used for Monk's bonus attack options." },
  "Hand Crossbow":    { title: "Hand Crossbow", body: "1d6 piercing · Range 30/120 ft, Light. One-handed crossbow for off-hand use. Requires Crossbow Expert feat to ignore loading for multiple attacks." },
  "Light Crossbow":   { title: "Light Crossbow", body: "1d8 piercing · Range 80/320 ft, Two-handed, Loading. Strong ranged damage with the Loading property limiting it to one shot per action without the Crossbow Expert feat." },
  // Martial melee
  "Battleaxe":        { title: "Battleaxe", body: "1d8 slashing · Versatile (1d10 two-handed). A standard martial weapon for STR-based combatants. Good damage for a one-handed weapon." },
  "Flail":            { title: "Flail", body: "1d8 bludgeoning · A martial melee weapon with a weighted ball on a chain. Bypasses shield bonuses to AC in some DM rulings." },
  "Glaive":           { title: "Glaive", body: "1d10 slashing · Two-handed, Reach (10 ft), Heavy. A pole weapon that keeps enemies at arm's length. Excellent for Polearm Master builds." },
  "Greataxe":         { title: "Greataxe", body: "1d12 slashing · Two-handed, Heavy. The highest single damage die in the game. The Barbarian's favorite — Brutal Critical makes natural 20s deal devastating damage." },
  "Greatsword":       { title: "Greatsword", body: "2d6 slashing · Two-handed, Heavy. The highest average damage of any weapon. Slightly more consistent than the greataxe's 1d12. Great Weapon Fighting style increases it further." },
  "Halberd":          { title: "Halberd", body: "1d10 slashing · Two-handed, Reach (10 ft), Heavy. A poleaxe combining reach and power. Pairs well with Polearm Master and Sentinel feats." },
  "Lance":            { title: "Lance", body: "1d12 piercing · Reach (10 ft). The premier mounted weapon. Disadvantage on attack rolls against adjacent targets unless mounted. Special: charge deals double damage dice if you moved 20+ feet." },
  "Longsword":        { title: "Longsword", body: "1d8 slashing · Versatile (1d10 two-handed). A martial weapon for trained combatants. Balanced for Fighters, Paladins, and any STR-based character." },
  "Maul":             { title: "Maul", body: "2d6 bludgeoning · Two-handed, Heavy. A massive hammer. Same average damage as a greatsword but deals bludgeoning — better vs. skeletons and armored foes." },
  "Morningstar":      { title: "Morningstar", body: "1d8 piercing · A spiked mace. Good one-handed martial damage that deals piercing — useful when enemies resist bludgeoning." },
  "Pike":             { title: "Pike", body: "1d10 piercing · Two-handed, Reach (10 ft), Heavy. A long thrusting spear. Grants a free reaction attack when enemies approach within 10 feet (Sentinel feat synergy)." },
  "Rapier":           { title: "Rapier", body: "1d8 piercing · Finesse. The premier one-handed weapon for DEX builds. Use DEX or STR for attack and damage. Favored by Rogues and DEX-based Fighters." },
  "Scimitar":         { title: "Scimitar", body: "1d6 slashing · Light, Finesse. A curved blade light enough for two-weapon fighting. Common choice for DEX Rangers and Rogues who need a slashing option." },
  "Shortsword":       { title: "Shortsword", body: "1d6 piercing · Light, Finesse. Rogues' default blade — small enough to dual wield, finesse for DEX attacks. Also the starting weapon for Monks." },
  "Trident":          { title: "Trident", body: "1d6 piercing · Versatile (1d8), Thrown 20/60 ft. A three-pronged spear favored in coastal campaigns. Functions like a versatile spear with throwing range." },
  "War Pick":         { title: "War Pick", body: "1d8 piercing · A pick-headed war tool. One-handed martial weapon with piercing damage — relevant against some armored enemies that have slashing/bludgeoning resistance." },
  "Warhammer":        { title: "Warhammer", body: "1d8 bludgeoning · Versatile (1d10 two-handed). A martial weapon favored by divine warriors. Common choice for Clerics and STR-based characters." },
  "Whip":             { title: "Whip", body: "1d4 slashing · Finesse, Reach (10 ft). Unique: the only one-handed finesse weapon with 10 ft reach. Useful for hit-and-run tactics and disarming maneuvers." },
  // Martial ranged
  "Longbow":          { title: "Longbow", body: "1d8 piercing · Range 150/600 ft, Two-handed. The best ranged weapon for sustained fire. Long range keeps you far from melee. Fighter and Ranger staple." },
  "Crossbow":         { title: "Crossbow", body: "1d8 piercing · Range 80/320 ft, Loading. Strong ranged damage. Loading limits you to one attack per action unless you have the Crossbow Expert feat." },
  "Heavy Crossbow":   { title: "Heavy Crossbow", body: "1d10 piercing · Range 100/400 ft, Two-handed, Heavy, Loading. The highest damage crossbow. Penalty: Disadvantage on all attack rolls if you have STR below 15." },
  "Net":              { title: "Net", body: "No damage · Range 5/15 ft. Hit restrains a Large or smaller creature (Strength DC 10 to escape). Only one net attack per action. Often used to set up a kill." },
};

// ── Adventuring items ─────────────────────────────────────────────────────────
export const ITEM_TIPS: Record<string, TipEntry> = {
  // Consumables
  "Healing Potion":       { title: "Healing Potion", body: "Drink as an action to restore 2d4+2 HP. The most common consumable in D&D. Always worth keeping one on hand for emergencies." },
  "Greater Healing Potion": { title: "Greater Healing Potion", body: "Drink as an action to restore 4d4+4 HP. Twice as effective as a standard healing potion. Valuable in mid-level play." },
  "Superior Healing Potion": { title: "Superior Healing Potion", body: "Drink as an action to restore 8d4+8 HP. A powerful healing item for high-level characters in serious danger." },
  "Potion of Speed":      { title: "Potion of Speed", body: "Drink as an action. For 1 minute: gain the Haste condition — double speed, +2 AC, advantage on DEX saves, and one extra action per turn." },
  "Potion of Invisibility": { title: "Potion of Invisibility", body: "Drink as an action to become invisible for 1 hour or until you attack or cast a spell. Attacks against you have Disadvantage; your attacks have Advantage." },
  "Potion of Fire Resistance": { title: "Potion of Fire Resistance", body: "Drink as an action. Gain resistance to fire damage for 1 hour. Damage from fire sources is halved." },
  "Antitoxin":            { title: "Antitoxin", body: "Drink as an action. Advantage on Constitution saving throws against poison for 1 hour. Does not cure an existing poisoned condition." },
  "Oil Flask":            { title: "Oil Flask", body: "Splash on a creature or surface. Ignited oil deals 5 fire damage per round. Useful for creating fire hazards or coating weapons." },
  "Acid Flask":           { title: "Acid Flask", body: "Throw as an improvised weapon (range 20 ft). Deals 2d6 acid damage on a hit; splash deals 1 acid to adjacent creatures." },
  "Alchemist's Fire":     { title: "Alchemist's Fire", body: "Throw at a target (range 20 ft, attack roll). Deals 1d4 fire damage on a hit and continues burning until extinguished (DC 10 DEX action). Sticky — can't be wiped off." },
  "Torch":                { title: "Torch", body: "Burns for 1 hour, illuminating a 20 ft radius with bright light and 20 ft dim light beyond. Can be used as an improvised weapon for 1 fire damage." },
  "Tinderbox":            { title: "Tinderbox", body: "Used to start fires with flint and steel. Lighting a torch takes an action. Lighting a larger fire takes 1 minute. Essential for dungeon survival." },
  "Rations":              { title: "Rations (1 day)", body: "Preserved trail food — dried meat, jerky, hardtack. One ration feeds one character for a day. Required during travel to avoid Exhaustion from starvation." },
  // Tools
  "Thieves' Tools":       { title: "Thieves' Tools", body: "Used to pick locks and disarm traps. Requires DEX proficiency to use effectively. Rogues start with proficiency. Picking a lock requires a DEX check against the lock's DC." },
  "Herbalism Kit":        { title: "Herbalism Kit", body: "Used to identify plants and create herbal remedies. Crafting a Potion of Healing takes 1 day of work and 25 gp in materials (requires proficiency)." },
  "Healer's Kit":         { title: "Healer's Kit", body: "10 uses. Action to stabilize a dying creature without making a Medicine check. With the Healer feat, also restore 1d6+4 HP to a stable creature once per short rest." },
  "Poisoner's Kit":       { title: "Poisoner's Kit", body: "Craft contact and injury poisons during a long rest. Requires proficiency. Basic Poison deals 1d4 poison + Poisoned (DC 10 CON save) for 1 minute." },
  "Climber's Kit":        { title: "Climber's Kit", body: "Pitons, hammer, and rope. Use to anchor yourself to a surface — cannot fall more than 25 ft. Advantage on Athletics checks to climb when kit is deployed." },
  "Component Pouch":      { title: "Component Pouch", body: "A belt pouch with material spell components. Replaces the need to track individual material components (except those with a gold cost). Required for most spells." },
  "Arcane Focus":         { title: "Arcane Focus", body: "A crystal, orb, rod, staff, or wand. Wizards, Sorcerers, and Warlocks use it as their spellcasting focus — replaces most material components (except those with a gold cost)." },
  "Holy Symbol":          { title: "Holy Symbol", body: "Amulet, shield emblem, or reliquary. Clerics and Paladins use it as their divine spellcasting focus — replaces most material components (except those with a gold cost)." },
  "Druidic Focus":        { title: "Druidic Focus", body: "A sprig of mistletoe, totem, wooden staff, or yew wand. Druids use it as their spellcasting focus — replaces most material components (except those with a gold cost)." },
  "Rope (50 ft)":         { title: "Rope (50 ft)", body: "Hempen or silk rope. Has 2 hit points and can be burst with a DC 17 STR check. Essential for climbing, binding prisoners, crossing chasms, and dozens of creative uses." },
  "Grappling Hook":       { title: "Grappling Hook", body: "Throw to anchor to a surface (range 20 ft). Use with rope for climbing without Athletics checks (if surface is solid). Attach to 50 ft of rope to ascend walls or cliffs." },
  "Lantern":              { title: "Lantern (Bullseye)", body: "Burns for 6 hours per flask of oil. Casts a 60 ft cone of bright light and 60 ft dim beyond. Better than a torch for illuminating a specific direction." },
  "Ball Bearings":        { title: "Ball Bearings", body: "Scatter 2,000 bearings from the bag. Anyone moving through the area must succeed on DC 10 DEX or fall prone. Covers a 10 ft square. Excellent dungeon trap." },
  "Caltrops":             { title: "Caltrops", body: "Scatter to cover a 5 ft square. Any creature moving through must succeed on DC 15 DEX or stop and take 1 piercing damage. Speed is reduced to 0 on failure." },
  "Crowbar":              { title: "Crowbar", body: "Advantage on STR checks to force open doors and containers. An indispensable dungeon-delving tool for non-magical entry. Also works as an improvised club." },
  "Magnifying Glass":     { title: "Magnifying Glass", body: "Grants Advantage on appraise checks for small details. Can start a fire when used to focus sunlight (1 minute). Required for some Investigation checks." },
  "Mirror (steel)":       { title: "Steel Mirror", body: "Useful for seeing around corners, checking reflections, and detecting creatures that don't cast reflections (vampires, some illusions). Practical utility item." },
  "Spyglass":             { title: "Spyglass", body: "Magnifies objects up to 30× at a distance. Useful for scouting enemy positions, reading distant signs, and naval combat. Range: any visible distance." },
  "Ink & Quill":          { title: "Ink & Quill", body: "Used for writing, forging documents, and copying spell scrolls (requires proficiency and the right materials). Also useful for leaving messages." },
  "Disguise Kit":         { title: "Disguise Kit", body: "Cosmetics, hair dye, wigs, and props to change your appearance. Requires proficiency for full effect. Creating a disguise takes 30 minutes. Opposed by Insight." },
  // Bags & containers
  "Backpack":             { title: "Backpack", body: "Holds 30 lbs or 1 cubic foot of gear. Straps distribute weight for comfortable carry. Standard container for all adventuring gear." },
  "Bag of Holding":       { title: "Bag of Holding", body: "A magic item. Holds up to 500 lbs (64 cubic feet) despite weighing only 15 lbs. Extradimensional space — putting another extradimensional item inside causes a catastrophic implosion." },
  "Pouch":                { title: "Belt Pouch", body: "Holds 1/5 lb or 1/4 cubic foot. Typically used to carry coins. Easily accessed without opening a full pack." },
  "Sack":                 { title: "Sack", body: "Holds 30 lbs or 1 cubic foot. Cheap, flexible container. Unlike a backpack, must be held or set down — not worn." },
  // Other common items
  "Map":                  { title: "Map", body: "A drawn or printed guide to a region, dungeon, or city. Provides context for navigation and may reveal hidden areas the DM can reference." },
  "Spellbook":            { title: "Spellbook", body: "Wizards require this to prepare spells each day. Holds all known spells. A replacement takes 1 day and 50 gp per spell level to recreate. Guard it with your life." },
  "Prayer Book":          { title: "Prayer Book", body: "A Cleric's devotional text. Used in roleplay and ritual. Some DMs require it during long rests to recharge divine spell slots." },
  "Scroll":               { title: "Spell Scroll", body: "A single-use rolled parchment bearing a spell. Anyone can attempt to cast it — spellcasters automatically succeed; others must pass an Arcana check equal to 10 + spell level." },
  "Spell Scroll":         { title: "Spell Scroll", body: "A single-use rolled parchment bearing a spell. Anyone can attempt to cast it — spellcasters automatically succeed; others must pass an Arcana check equal to 10 + spell level." },
  "Manacles":             { title: "Manacles", body: "Restrains a Medium or Small creature. STR DC 20 to break, DEX DC 15 to escape with Thieves' Tools. They require the same key. Often used to bind captives." },
  "Hourglass":            { title: "Hourglass", body: "Measures one hour when flipped. Useful for timing short rests, rituals, and patrol rotations. Fragile — handle with care in combat." },
  "Vial":                 { title: "Vial", body: "A small glass container for liquids (blood, poison, holy water, etc.). Used to store and transport alchemical or magical substances without contamination." },
  "Holy Water":           { title: "Holy Water", body: "Throw at undead or fiends (range 20 ft, attack roll). Deals 2d6 radiant damage on a hit. Ineffective against non-evil outsiders. Consecrated by a Cleric of good alignment." },
  "Perfume":              { title: "Perfume", body: "A vial of scented oil. Useful in social encounters and roleplay — wearing it may grant Advantage on Charisma checks with NPCs who appreciate refinement." },
  "Candle":               { title: "Candle", body: "Burns 1 hour, casting 5 ft bright light and 5 ft dim light. Much weaker than a torch or lantern, but quiet and cheap for short-duration lighting." },
  "Chalk":                { title: "Chalk (1 piece)", body: "Mark surfaces to create trail indicators, dungeon maps on walls, or magical diagrams. Cheap and surprisingly useful for dungeon navigation." },
  "Chain (10 ft)":        { title: "Chain (10 ft)", body: "Iron links with 10 hit points that resist fire. Burst with DC 26 STR check. Used to bind doors, restrain prisoners, or build makeshift traps and barricades." },
  // Camping & survival gear (typically in starting equipment packs)
  "Bedroll":              { title: "Bedroll", body: "A padded sleeping mat that lets you sleep comfortably outdoors. Required for a full long rest in the wilderness — without one, the DM may rule you only gain a short rest's benefits." },
  "Mess Kit":             { title: "Mess Kit", body: "A tin box with cup, plate, fork, knife, and spoon. Lets you prepare and eat trail meals hygienically. Required to properly cook foraged or hunted food." },
  "Waterskin":            { title: "Waterskin", body: "Holds 4 pints of liquid (about 2 days of drinking water for one person). Refill at any clean water source. Going without water for a day causes Exhaustion." },
  "Hempen Rope (50 ft)":  { title: "Hempen Rope (50 ft)", body: "Coarse-fibered rope. 2 HP, burst with DC 17 STR check. Workhorse for climbing, binding, securing gear, and creative dungeon tricks." },
  "Silk Rope (50 ft)":    { title: "Silk Rope (50 ft)", body: "Thinner and stronger than hemp. 2 HP, burst with DC 17 STR check. Lighter to carry and less obvious — preferred by Rogues and stealth-focused parties." },
  "Iron Pot":             { title: "Iron Pot", body: "A small camp pot for cooking stews and boiling water over an open fire. Heavy but durable — useful for camp life and creative improvised weapons." },
  "Shovel":               { title: "Shovel", body: "Dig graves, search for buried treasure, fortify a campsite, or excavate collapsed dungeon passages. Slow work but indispensable when the situation calls for it." },
  "Whetstone":            { title: "Whetstone", body: "Sharpens blades during a short rest. Roleplay tool — many DMs grant a small narrative bonus when a player describes maintaining their weapons between fights." },
  "Common Clothes":       { title: "Common Clothes", body: "A simple peasant's outfit — tunic, trousers, soft cap. Useful for blending in among commoners or as a clean change after hard travel." },
  "Traveler's Clothes":   { title: "Traveler's Clothes", body: "Durable layered garments built for the road — boots, cloak, padded coat. Standard adventuring wear; resists weather better than common clothes." },
  "Fine Clothes":         { title: "Fine Clothes", body: "Tailored noble's attire. Often required to attend formal gatherings, parlay with nobility, or impersonate someone of station. May grant Advantage on social checks in court." },
  "Costume":              { title: "Costume", body: "Themed clothing or disguise outfit. Pair with a Disguise Kit to impersonate someone, or use to perform for crowds (Bards love these)." },
  "Signal Whistle":       { title: "Signal Whistle", body: "A piercing whistle audible up to 600 ft. Alert allies, scare off small creatures, or coordinate scout movements over open terrain." },
  "Soap":                 { title: "Soap", body: "Wash off blood, grime, and pungent monster ichor. Roleplay item — and a surprisingly common bargaining chip with cleanliness-conscious NPCs." },
  "Quiver":               { title: "Quiver", body: "Holds 20 arrows or bolts. Worn on the back or hip for quick draw. Required to wield a bow effectively without one-handed fumbling." },
  "Arrows (20)":          { title: "Arrows (20)", body: "Standard ammunition for shortbows and longbows. Each shot consumes one — recover half on a battlefield search. Special arrows (silvered, poisoned) may exist in your inventory separately." },
  "Crossbow Bolts (20)":  { title: "Crossbow Bolts (20)", body: "Standard ammunition for crossbows. Heavier and shorter than arrows, with more punch. Each shot consumes one — recover half after combat." },
  "Sling Bullets (20)":   { title: "Sling Bullets (20)", body: "Lead pellets sized for a sling. Cheap, plentiful, and reusable — sling bullets can usually be recovered after a fight." },
  "Blowgun Needles (50)": { title: "Blowgun Needles (50)", body: "Tiny darts for a blowgun. Low damage but easily poisoned — Rogues and assassins favor them for silent strikes." },
  "Holy Symbol (Amulet)": { title: "Holy Symbol (Amulet)", body: "A divine focus worn around the neck. Replaces material spell components (except those with a gp cost) for Clerics and Paladins. Often invoked when turning undead." },
  "Holy Symbol (Emblem)": { title: "Holy Symbol (Emblem)", body: "A divine focus emblazoned on a shield or worn openly. Replaces material spell components (except those with a gp cost) for Clerics and Paladins." },
  "Spell Component Pouch": { title: "Spell Component Pouch", body: "A belt pouch of common spell materials. Removes the need to track individual components (except those with a gp cost). Required for most spells." },
  "Mysterious Coin":      { title: "Mysterious Coin", body: "An unusual coin of unknown origin — bearing strange markings, an unfamiliar face, or made of an unrecognisable metal. The DM placed it in your pack for a reason; show it to scholars, merchants, or priests to learn more." },
  "Mysterious Note":      { title: "Mysterious Note", body: "A scrap of paper with cryptic writing. Read it aloud or hand it to the DM to investigate its meaning — clues, prophecies, and quest hooks often arrive this way." },
  "Mysterious Key":       { title: "Mysterious Key", body: "A key of unknown origin. Carries a hidden meaning — try it on locks you encounter, or describe it to NPCs who might recognise the make." },
  "Mysterious Letter":    { title: "Mysterious Letter", body: "A sealed letter with no obvious recipient or sender. The contents may be a quest hook, a confession, a warning, or a plant — break the seal in-character to read it aloud to the party." },
  "Mysterious Map":       { title: "Mysterious Map", body: "A hand-drawn or aged map of an unknown region. Show it to the DM to learn what it depicts — and where it might lead." },
};

// Generic fallback used when an item has no specific tooltip data — keeps every
// inventory entry hover-discoverable instead of silent.
export const GENERIC_ITEM_TIP: TipEntry = {
  title: "Inventory Item",
  body: "An item the DM placed in your pack. Click 'Use' to attempt to use it in the story — the DM will narrate what happens. Trade items between party members or drop them with the buttons on the right.",
};

// Fuzzy resolver for inventory tooltips. Tries:
//   1. Exact match in ITEM_TIPS or WEAPON_TIPS.
//   2. Trailing-qualifier strip — e.g. "Rations (5 days)" → "Rations".
//   3. "Mysterious X" → known mystery-item entry if present.
//   4. Generic fallback.
export function resolveItemTip(name: string, weaponTips: Record<string, TipEntry>, itemTips: Record<string, TipEntry>): TipEntry {
  if (itemTips[name])   return itemTips[name];
  if (weaponTips[name]) return weaponTips[name];
  // Strip trailing parenthesised qualifier: "Rations (5 days)" → "Rations"
  const stripped = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (stripped !== name) {
    if (itemTips[stripped])   return itemTips[stripped];
    if (weaponTips[stripped]) return weaponTips[stripped];
  }
  // Fall back to a leading prefix match (e.g. "Bedroll (worn)" → "Bedroll")
  for (const key of Object.keys(itemTips)) {
    if (name.startsWith(key + " ") || name.startsWith(key + ",")) return itemTips[key];
  }
  return GENERIC_ITEM_TIP;
}

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
