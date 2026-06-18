export type SpellEntry = { name: string; school: string; desc: string };

export const CANTRIPS: Partial<Record<string, SpellEntry[]>> = {
  Bard: [
    { name: "Blade Ward",       school: "Abjuration",   desc: "Resistance to B/P/S damage until end of next turn" },
    { name: "Dancing Lights",   school: "Evocation",    desc: "4 floating lights within 60ft for 1 min" },
    { name: "Friends",          school: "Enchantment",  desc: "Advantage on CHA checks vs one non-hostile creature" },
    { name: "Light",            school: "Evocation",    desc: "Object sheds bright light 20ft, dim 40ft" },
    { name: "Mage Hand",        school: "Conjuration",  desc: "Spectral hand performs simple tasks up to 30ft" },
    { name: "Mending",          school: "Transmutation",desc: "Repair a single break or tear in an object" },
    { name: "Message",          school: "Transmutation",desc: "Whisper a message to a creature you point at" },
    { name: "Minor Illusion",   school: "Illusion",     desc: "Create a 5ft sound or image for 1 minute" },
    { name: "Prestidigitation", school: "Transmutation",desc: "Minor magical tricks — ignite, soil, chill, etc." },
    { name: "True Strike",      school: "Divination",   desc: "Advantage on your next attack roll against one target" },
    { name: "Vicious Mockery",  school: "Enchantment",  desc: "1d4 psychic + disadvantage on target's next attack" },
  ],
  Cleric: [
    { name: "Guidance",         school: "Divination",   desc: "+1d4 to one ability check (concentration)" },
    { name: "Light",            school: "Evocation",    desc: "Object sheds bright light 20ft, dim 40ft" },
    { name: "Mending",          school: "Transmutation",desc: "Repair a single break or tear in an object" },
    { name: "Resistance",       school: "Abjuration",   desc: "+1d4 to one saving throw (concentration)" },
    { name: "Sacred Flame",     school: "Evocation",    desc: "1d8 radiant — DEX save or take damage" },
    { name: "Spare the Dying",  school: "Necromancy",   desc: "Stabilize a dying creature at 0 HP" },
    { name: "Thaumaturgy",      school: "Transmutation",desc: "Minor divine manifestations — tremors, booming voice" },
  ],
  Druid: [
    { name: "Druidcraft",       school: "Transmutation",desc: "Minor nature effects — predict weather, bloom flower" },
    { name: "Guidance",         school: "Divination",   desc: "+1d4 to one ability check (concentration)" },
    { name: "Mending",          school: "Transmutation",desc: "Repair a single break or tear in an object" },
    { name: "Poison Spray",     school: "Conjuration",  desc: "1d12 poison — CON save or take full damage" },
    { name: "Produce Flame",    school: "Conjuration",  desc: "Flame sheds light or hurled for 1d8 fire" },
    { name: "Resistance",       school: "Abjuration",   desc: "+1d4 to one saving throw (concentration)" },
    { name: "Shillelagh",       school: "Transmutation",desc: "Club uses WIS for attacks, deals 1d8" },
    { name: "Thorn Whip",       school: "Transmutation",desc: "1d6 piercing + pull target 10ft closer" },
  ],
  Sorcerer: [
    { name: "Acid Splash",      school: "Conjuration",  desc: "1d6 acid targeting 1-2 creatures (DEX save)" },
    { name: "Blade Ward",       school: "Abjuration",   desc: "Resistance to B/P/S damage until end of next turn" },
    { name: "Chill Touch",      school: "Necromancy",   desc: "1d8 necrotic + target can't regain HP for 1 round" },
    { name: "Dancing Lights",   school: "Evocation",    desc: "4 floating lights within 60ft for 1 min" },
    { name: "Fire Bolt",        school: "Evocation",    desc: "1d10 fire ranged spell attack" },
    { name: "Friends",          school: "Enchantment",  desc: "Advantage on CHA checks vs one non-hostile creature" },
    { name: "Light",            school: "Evocation",    desc: "Object sheds bright light 20ft, dim 40ft" },
    { name: "Mage Hand",        school: "Conjuration",  desc: "Spectral hand performs simple tasks up to 30ft" },
    { name: "Mending",          school: "Transmutation",desc: "Repair a single break or tear in an object" },
    { name: "Message",          school: "Transmutation",desc: "Whisper a message to a creature you point at" },
    { name: "Minor Illusion",   school: "Illusion",     desc: "Create a 5ft sound or image for 1 minute" },
    { name: "Poison Spray",     school: "Conjuration",  desc: "1d12 poison — CON save or take full damage" },
    { name: "Prestidigitation", school: "Transmutation",desc: "Minor magical tricks — ignite, soil, chill, etc." },
    { name: "Ray of Frost",     school: "Evocation",    desc: "1d8 cold damage + reduce speed by 10ft" },
    { name: "Shocking Grasp",   school: "Evocation",    desc: "1d8 lightning + target can't take reactions" },
    { name: "True Strike",      school: "Divination",   desc: "Advantage on your next attack roll against one target" },
  ],
  Warlock: [
    { name: "Blade Ward",       school: "Abjuration",   desc: "Resistance to B/P/S damage until end of next turn" },
    { name: "Chill Touch",      school: "Necromancy",   desc: "1d8 necrotic + target can't regain HP for 1 round" },
    { name: "Eldritch Blast",   school: "Evocation",    desc: "1d10 force ranged spell attack (Warlock signature)" },
    { name: "Friends",          school: "Enchantment",  desc: "Advantage on CHA checks vs one non-hostile creature" },
    { name: "Mage Hand",        school: "Conjuration",  desc: "Spectral hand performs simple tasks up to 30ft" },
    { name: "Minor Illusion",   school: "Illusion",     desc: "Create a 5ft sound or image for 1 minute" },
    { name: "Poison Spray",     school: "Conjuration",  desc: "1d12 poison — CON save or take full damage" },
    { name: "Prestidigitation", school: "Transmutation",desc: "Minor magical tricks — ignite, soil, chill, etc." },
    { name: "True Strike",      school: "Divination",   desc: "Advantage on your next attack roll against one target" },
  ],
  Wizard: [
    { name: "Acid Splash",      school: "Conjuration",  desc: "1d6 acid targeting 1-2 creatures (DEX save)" },
    { name: "Blade Ward",       school: "Abjuration",   desc: "Resistance to B/P/S damage until end of next turn" },
    { name: "Chill Touch",      school: "Necromancy",   desc: "1d8 necrotic + target can't regain HP for 1 round" },
    { name: "Dancing Lights",   school: "Evocation",    desc: "4 floating lights within 60ft for 1 min" },
    { name: "Fire Bolt",        school: "Evocation",    desc: "1d10 fire ranged spell attack" },
    { name: "Friends",          school: "Enchantment",  desc: "Advantage on CHA checks vs one non-hostile" },
    { name: "Light",            school: "Evocation",    desc: "Object sheds bright light 20ft, dim 40ft" },
    { name: "Mage Hand",        school: "Conjuration",  desc: "Spectral hand performs simple tasks up to 30ft" },
    { name: "Mending",          school: "Transmutation",desc: "Repair a single break or tear in an object" },
    { name: "Message",          school: "Transmutation",desc: "Whisper a message to a creature you point at" },
    { name: "Minor Illusion",   school: "Illusion",     desc: "Create a 5ft sound or image for 1 minute" },
    { name: "Poison Spray",     school: "Conjuration",  desc: "1d12 poison — CON save or take full damage" },
    { name: "Prestidigitation", school: "Transmutation",desc: "Minor magical tricks — ignite, soil, chill, etc." },
    { name: "Ray of Frost",     school: "Evocation",    desc: "1d8 cold damage + reduce speed by 10ft" },
    { name: "Shocking Grasp",   school: "Evocation",    desc: "1d8 lightning + target can't take reactions" },
    { name: "True Strike",      school: "Divination",   desc: "Advantage on your next attack roll against one target" },
  ],
};

export const LEVEL1_SPELLS: Partial<Record<string, SpellEntry[]>> = {
  Bard: [
    { name: "Animal Friendship",        school: "Enchantment",  desc: "Charm a beast that understands you for 24h" },
    { name: "Bane",                     school: "Enchantment",  desc: "3 creatures: -1d4 to attacks & saves (CON save)" },
    { name: "Charm Person",             school: "Enchantment",  desc: "Charm a humanoid as a friendly acquaintance" },
    { name: "Comprehend Languages",     school: "Divination",   desc: "Understand any spoken or written language for 1h" },
    { name: "Cure Wounds",              school: "Evocation",    desc: "Restore 1d8 + modifier HP on touch" },
    { name: "Detect Magic",             school: "Divination",   desc: "Sense magic auras within 30ft for 10 min" },
    { name: "Disguise Self",            school: "Illusion",     desc: "Change appearance (clothing, features) for 1h" },
    { name: "Dissonant Whispers",       school: "Enchantment",  desc: "3d6 psychic + must use reaction to flee (WIS save)" },
    { name: "Faerie Fire",              school: "Evocation",    desc: "Outline creatures; attacks vs them have advantage" },
    { name: "Feather Fall",             school: "Transmutation",desc: "Slow fall to 60ft/round for up to 5 creatures" },
    { name: "Healing Word",             school: "Evocation",    desc: "Bonus action: restore 1d4 + modifier HP at range" },
    { name: "Heroism",                  school: "Enchantment",  desc: "Immune to fear; gain temp HP = modifier each round" },
    { name: "Identify",                 school: "Divination",   desc: "Learn properties, attunement, and spells of an item" },
    { name: "Longstrider",              school: "Transmutation",desc: "+10ft speed for 1 hour" },
    { name: "Silent Image",             school: "Illusion",     desc: "Create a static visual illusion up to 15ft cube" },
    { name: "Sleep",                    school: "Enchantment",  desc: "Put creatures to sleep based on remaining HP total" },
    { name: "Speak with Animals",       school: "Divination",   desc: "Comprehend and communicate with beasts for 10 min" },
    { name: "Tasha's Hideous Laughter", school: "Enchantment",  desc: "Target falls prone, incapacitated laughing (WIS save)" },
    { name: "Thunderwave",              school: "Evocation",    desc: "2d8 thunder in 15ft cube; push 10ft (CON save halves)" },
    { name: "Unseen Servant",           school: "Conjuration",  desc: "Invisible force performs simple tasks for 1h" },
  ],
  Cleric: [
    { name: "Bane",                        school: "Enchantment",  desc: "3 creatures: -1d4 to attacks & saves (CON save)" },
    { name: "Bless",                       school: "Enchantment",  desc: "3 creatures: +1d4 to attacks & saves for 1 min" },
    { name: "Command",                     school: "Enchantment",  desc: "One-word command a creature obeys (WIS save)" },
    { name: "Create or Destroy Water",     school: "Transmutation",desc: "Create 10 gallons or destroy water in container" },
    { name: "Cure Wounds",                 school: "Evocation",    desc: "Restore 1d8 + modifier HP on touch" },
    { name: "Detect Evil and Good",        school: "Divination",   desc: "Sense aberrations, fiends, undead, etc. within 30ft" },
    { name: "Detect Magic",                school: "Divination",   desc: "Sense magic auras within 30ft for 10 min" },
    { name: "Detect Poison and Disease",   school: "Divination",   desc: "Sense poisons and diseases within 30ft" },
    { name: "Guiding Bolt",                school: "Evocation",    desc: "4d6 radiant; next attack vs target has advantage" },
    { name: "Healing Word",                school: "Evocation",    desc: "Bonus action: restore 1d4 + modifier HP at range" },
    { name: "Inflict Wounds",              school: "Necromancy",   desc: "3d10 necrotic on melee spell attack" },
    { name: "Protection from Evil & Good", school: "Abjuration",   desc: "Protection vs aberrations, fiends, undead, etc." },
    { name: "Purify Food and Drink",       school: "Transmutation",desc: "Remove poison and disease from food/water in 5ft" },
    { name: "Sanctuary",                   school: "Abjuration",   desc: "Attackers must save (WIS) or choose a new target" },
    { name: "Shield of Faith",             school: "Abjuration",   desc: "+2 AC to one creature for 10 min (concentration)" },
  ],
  Druid: [
    { name: "Absorb Elements",          school: "Abjuration",   desc: "Absorb elemental damage; add to next melee attack" },
    { name: "Animal Friendship",        school: "Enchantment",  desc: "Charm a beast that understands you for 24h" },
    { name: "Charm Person",             school: "Enchantment",  desc: "Charm a humanoid as a friendly acquaintance" },
    { name: "Create or Destroy Water",  school: "Transmutation",desc: "Create 10 gallons or destroy water in container" },
    { name: "Cure Wounds",              school: "Evocation",    desc: "Restore 1d8 + modifier HP on touch" },
    { name: "Detect Magic",             school: "Divination",   desc: "Sense magic auras within 30ft for 10 min" },
    { name: "Detect Poison and Disease",school: "Divination",   desc: "Sense poisons and diseases within 30ft" },
    { name: "Entangle",                 school: "Conjuration",  desc: "Restrain creatures in a 20ft square (STR save)" },
    { name: "Faerie Fire",              school: "Evocation",    desc: "Outline creatures; attacks vs them have advantage" },
    { name: "Fog Cloud",                school: "Conjuration",  desc: "20ft radius sphere of heavily obscuring fog" },
    { name: "Goodberry",                school: "Transmutation",desc: "10 magical berries, each restores 1 HP" },
    { name: "Healing Word",             school: "Evocation",    desc: "Bonus action: restore 1d4 + modifier HP at range" },
    { name: "Ice Knife",                school: "Conjuration",  desc: "1d10 pierce on hit + 2d6 cold in 5ft burst" },
    { name: "Jump",                     school: "Transmutation",desc: "Triple creature's jumping distance for 1 minute" },
    { name: "Longstrider",              school: "Transmutation",desc: "+10ft speed for 1 hour" },
    { name: "Speak with Animals",       school: "Divination",   desc: "Comprehend and communicate with beasts for 10 min" },
    { name: "Thunderwave",              school: "Evocation",    desc: "2d8 thunder in 15ft cube; push 10ft (CON save halves)" },
  ],
  Paladin: [
    { name: "Bless",                       school: "Enchantment",  desc: "3 creatures: +1d4 to attacks & saves for 1 min" },
    { name: "Command",                     school: "Enchantment",  desc: "One-word command a creature obeys (WIS save)" },
    { name: "Compelled Duel",              school: "Enchantment",  desc: "Force a creature to only attack you (WIS save)" },
    { name: "Cure Wounds",                 school: "Evocation",    desc: "Restore 1d8 + modifier HP on touch" },
    { name: "Detect Evil and Good",        school: "Divination",   desc: "Sense aberrations, fiends, undead, etc. within 30ft" },
    { name: "Detect Magic",                school: "Divination",   desc: "Sense magic auras within 30ft for 10 min" },
    { name: "Detect Poison and Disease",   school: "Divination",   desc: "Sense poisons and diseases within 30ft" },
    { name: "Divine Favor",                school: "Evocation",    desc: "+1d4 radiant to weapon attacks for 1 min" },
    { name: "Heroism",                     school: "Enchantment",  desc: "Immune to fear; gain temp HP = modifier each round" },
    { name: "Protection from Evil & Good", school: "Abjuration",   desc: "Protection vs aberrations, celestials, fiends, undead" },
    { name: "Purify Food and Drink",       school: "Transmutation",desc: "Remove poison and disease from food/water in 5ft" },
    { name: "Searing Smite",              school: "Evocation",    desc: "+1d6 fire on hit + target burns 1d6/round (CON save)" },
    { name: "Shield of Faith",             school: "Abjuration",   desc: "+2 AC to one creature for 10 min (concentration)" },
    { name: "Thunderous Smite",            school: "Evocation",    desc: "+2d6 thunder on next hit + push 10ft (STR save)" },
    { name: "Wrathful Smite",             school: "Evocation",    desc: "+1d6 psychic + target is frightened (WIS save)" },
  ],
  Ranger: [
    { name: "Absorb Elements",           school: "Abjuration",   desc: "Absorb elemental damage; add to next melee attack" },
    { name: "Alarm",                     school: "Abjuration",   desc: "Alert you when a creature enters a warded area" },
    { name: "Animal Friendship",         school: "Enchantment",  desc: "Charm a beast that understands you for 24h" },
    { name: "Cure Wounds",               school: "Evocation",    desc: "Restore 1d8 + modifier HP on touch" },
    { name: "Detect Magic",              school: "Divination",   desc: "Sense magic auras within 30ft for 10 min" },
    { name: "Detect Poison and Disease", school: "Divination",   desc: "Sense poisons and diseases within 30ft" },
    { name: "Ensnaring Strike",          school: "Conjuration",  desc: "Magical vines restrain target on hit (STR save)" },
    { name: "Entangle",                  school: "Conjuration",  desc: "Restrain creatures in a 20ft square (STR save)" },
    { name: "Fog Cloud",                 school: "Conjuration",  desc: "20ft radius sphere of heavily obscuring fog" },
    { name: "Goodberry",                 school: "Transmutation",desc: "10 magical berries, each restores 1 HP" },
    { name: "Hail of Thorns",            school: "Conjuration",  desc: "+1d10 piercing burst on ranged hit (DEX save)" },
    { name: "Hunter's Mark",             school: "Divination",   desc: "+1d6 to attacks on designated target; track them" },
    { name: "Jump",                      school: "Transmutation",desc: "Triple creature's jumping distance for 1 minute" },
    { name: "Longstrider",               school: "Transmutation",desc: "+10ft speed for 1 hour" },
    { name: "Speak with Animals",        school: "Divination",   desc: "Comprehend and communicate with beasts for 10 min" },
  ],
  Sorcerer: [
    { name: "Burning Hands",            school: "Evocation",    desc: "3d6 fire in 15ft cone (DEX save halves)" },
    { name: "Charm Person",             school: "Enchantment",  desc: "Charm a humanoid as a friendly acquaintance" },
    { name: "Chromatic Orb",            school: "Evocation",    desc: "3d8 of a chosen element type (ranged attack)" },
    { name: "Color Spray",              school: "Illusion",     desc: "Blind creatures within a cone based on HP" },
    { name: "Comprehend Languages",     school: "Divination",   desc: "Understand any spoken or written language for 1h" },
    { name: "Detect Magic",             school: "Divination",   desc: "Sense magic auras within 30ft for 10 min" },
    { name: "Disguise Self",            school: "Illusion",     desc: "Change appearance (clothing, features) for 1h" },
    { name: "Expeditious Retreat",      school: "Transmutation",desc: "Dash as bonus action each round for 10 min" },
    { name: "False Life",               school: "Necromancy",   desc: "Gain 1d4+4 temporary HP" },
    { name: "Feather Fall",             school: "Transmutation",desc: "Slow fall to 60ft/round for up to 5 creatures" },
    { name: "Fog Cloud",                school: "Conjuration",  desc: "20ft radius sphere of heavily obscuring fog" },
    { name: "Jump",                     school: "Transmutation",desc: "Triple creature's jumping distance for 1 minute" },
    { name: "Mage Armor",               school: "Abjuration",   desc: "AC = 13 + DEX mod while unarmored" },
    { name: "Magic Missile",            school: "Evocation",    desc: "3 darts, each dealing 1d4+1 force (auto-hit)" },
    { name: "Ray of Sickness",          school: "Necromancy",   desc: "2d8 poison + poisoned condition (CON save)" },
    { name: "Shield",                   school: "Abjuration",   desc: "+5 AC reaction until start of your next turn" },
    { name: "Silent Image",             school: "Illusion",     desc: "Create a static visual illusion up to 15ft cube" },
    { name: "Sleep",                    school: "Enchantment",  desc: "Put creatures to sleep based on remaining HP total" },
    { name: "Thunderwave",              school: "Evocation",    desc: "2d8 thunder in 15ft cube; push 10ft (CON save halves)" },
    { name: "Witch Bolt",               school: "Evocation",    desc: "1d12 lightning on hit; reapply each round" },
  ],
  Warlock: [
    { name: "Armor of Agathys",            school: "Abjuration",   desc: "5 temp HP; deal 5 cold to any attacker who hits you" },
    { name: "Arms of Hadar",              school: "Conjuration",  desc: "2d6 necrotic to all creatures within 10ft (STR save)" },
    { name: "Charm Person",               school: "Enchantment",  desc: "Charm a humanoid as a friendly acquaintance" },
    { name: "Comprehend Languages",       school: "Divination",   desc: "Understand any spoken or written language for 1h" },
    { name: "Expeditious Retreat",        school: "Transmutation",desc: "Dash as bonus action each round for 10 min" },
    { name: "Hellish Rebuke",             school: "Evocation",    desc: "2d10 fire reaction when you're damaged (DEX save)" },
    { name: "Hex",                        school: "Enchantment",  desc: "+1d6 necrotic on attacks; disadvantage on chosen check" },
    { name: "Illusory Script",            school: "Illusion",     desc: "Write a secret message only certain creatures can read" },
    { name: "Protection from Evil & Good",school: "Abjuration",   desc: "Protection vs aberrations, celestials, fiends, undead" },
    { name: "Unseen Servant",             school: "Conjuration",  desc: "Invisible force performs simple tasks for 1h" },
    { name: "Witch Bolt",                 school: "Evocation",    desc: "1d12 lightning on hit; reapply each round" },
  ],
  Wizard: [
    { name: "Absorb Elements",          school: "Abjuration",   desc: "Absorb elemental damage; add to next melee attack" },
    { name: "Burning Hands",            school: "Evocation",    desc: "3d6 fire in 15ft cone (DEX save halves)" },
    { name: "Charm Person",             school: "Enchantment",  desc: "Charm a humanoid as a friendly acquaintance" },
    { name: "Chromatic Orb",            school: "Evocation",    desc: "3d8 of a chosen element type (ranged attack)" },
    { name: "Color Spray",              school: "Illusion",     desc: "Blind creatures within a cone based on HP" },
    { name: "Comprehend Languages",     school: "Divination",   desc: "Understand any spoken or written language for 1h" },
    { name: "Detect Magic",             school: "Divination",   desc: "Sense magic auras within 30ft for 10 min" },
    { name: "Disguise Self",            school: "Illusion",     desc: "Change appearance (clothing, features) for 1h" },
    { name: "Expeditious Retreat",      school: "Transmutation",desc: "Dash as bonus action each round for 10 min" },
    { name: "False Life",               school: "Necromancy",   desc: "Gain 1d4+4 temporary HP" },
    { name: "Feather Fall",             school: "Transmutation",desc: "Slow fall to 60ft/round for up to 5 creatures" },
    { name: "Find Familiar",            school: "Conjuration",  desc: "Summon a spirit familiar (owl, cat, raven…)" },
    { name: "Fog Cloud",                school: "Conjuration",  desc: "20ft radius sphere of heavily obscuring fog" },
    { name: "Grease",                   school: "Conjuration",  desc: "10ft square becomes slick; DEX save or fall prone" },
    { name: "Identify",                 school: "Divination",   desc: "Learn properties, attunement, and spells of an item" },
    { name: "Illusory Script",          school: "Illusion",     desc: "Write a secret message only certain creatures can read" },
    { name: "Jump",                     school: "Transmutation",desc: "Triple creature's jumping distance for 1 minute" },
    { name: "Longstrider",              school: "Transmutation",desc: "+10ft speed for 1 hour" },
    { name: "Mage Armor",               school: "Abjuration",   desc: "AC = 13 + DEX mod while unarmored" },
    { name: "Magic Missile",            school: "Evocation",    desc: "3 darts, each dealing 1d4+1 force (auto-hit)" },
    { name: "Protection from Evil & Good",school:"Abjuration",  desc: "Protection vs aberrations, celestials, fiends, undead" },
    { name: "Ray of Sickness",          school: "Necromancy",   desc: "2d8 poison + poisoned condition (CON save)" },
    { name: "Shield",                   school: "Abjuration",   desc: "+5 AC reaction until start of your next turn" },
    { name: "Silent Image",             school: "Illusion",     desc: "Create a static visual illusion up to 15ft cube" },
    { name: "Sleep",                    school: "Enchantment",  desc: "Put creatures to sleep based on remaining HP total" },
    { name: "Tasha's Hideous Laughter", school: "Enchantment",  desc: "Target falls prone, incapacitated laughing (WIS save)" },
    { name: "Thunderwave",              school: "Evocation",    desc: "2d8 thunder in 15ft cube; push 10ft (CON save halves)" },
    { name: "Unseen Servant",           school: "Conjuration",  desc: "Invisible force performs simple tasks for 1h" },
    { name: "Witch Bolt",               school: "Evocation",    desc: "1d12 lightning on hit; reapply each round" },
  ],
};

// ── Higher-level spell lists (game caps at character level 10) ──────────────────
// Full casters (Bard/Cleric/Druid/Sorcerer/Wizard) reach 5th-level slots; half
// casters (Paladin/Ranger) reach 3rd; Warlock pact slots reach 5th. Curated,
// iconic selections per class per level — enough for play without exhaustion.

export const LEVEL2_SPELLS: Partial<Record<string, SpellEntry[]>> = {
  Bard: [
    { name: "Invisibility",        school: "Illusion",     desc: "A creature you touch turns invisible for 1h (ends on attack/cast)" },
    { name: "Suggestion",          school: "Enchantment",  desc: "Suggest a reasonable course of action (WIS save)" },
    { name: "Hold Person",         school: "Enchantment",  desc: "Paralyze a humanoid (WIS save each turn)" },
    { name: "Heat Metal",          school: "Transmutation",desc: "2d8 fire to a holder of a metal object each turn" },
    { name: "Shatter",             school: "Evocation",    desc: "3d8 thunder in a 10ft sphere (CON save halves)" },
    { name: "Lesser Restoration",  school: "Abjuration",   desc: "End one disease or the blinded/deafened/paralyzed/poisoned condition" },
    { name: "Enhance Ability",     school: "Transmutation",desc: "Advantage on checks with one ability for 1h" },
    { name: "Calm Emotions",       school: "Enchantment",  desc: "Suppress fear/charm or make hostiles indifferent (CHA save)" },
    { name: "Detect Thoughts",     school: "Divination",   desc: "Read surface thoughts of creatures within 30ft" },
    { name: "Knock",               school: "Transmutation",desc: "Unlock a locked or stuck object" },
    { name: "See Invisibility",    school: "Divination",   desc: "See invisible creatures and into the Ethereal for 1h" },
    { name: "Blindness/Deafness",  school: "Necromancy",   desc: "Blind or deafen a creature for 1 min (CON save)" },
  ],
  Cleric: [
    { name: "Aid",                 school: "Abjuration",   desc: "Raise max & current HP by 5 for 3 allies (8h)" },
    { name: "Spiritual Weapon",    school: "Evocation",    desc: "Bonus action: spectral weapon strikes for 1d8 + mod force" },
    { name: "Lesser Restoration",  school: "Abjuration",   desc: "End a disease or a debilitating condition" },
    { name: "Hold Person",         school: "Enchantment",  desc: "Paralyze a humanoid (WIS save each turn)" },
    { name: "Prayer of Healing",   school: "Evocation",    desc: "Heal up to 6 creatures 2d8 + mod (not in combat)" },
    { name: "Silence",             school: "Illusion",     desc: "No sound in a 20ft sphere; blocks verbal spells" },
    { name: "Zone of Truth",       school: "Enchantment",  desc: "Creatures in a 15ft sphere can't lie (CHA save)" },
    { name: "Warding Bond",        school: "Abjuration",   desc: "Ally gains +1 AC & saves, resistance, shares your damage" },
    { name: "Blindness/Deafness",  school: "Necromancy",   desc: "Blind or deafen a creature for 1 min (CON save)" },
    { name: "Augury",              school: "Divination",   desc: "Learn weal/woe of a plan within the next 30 min" },
  ],
  Druid: [
    { name: "Moonbeam",            school: "Evocation",    desc: "2d10 radiant beam you move each turn (CON save halves)" },
    { name: "Flaming Sphere",      school: "Conjuration",  desc: "Rolling 5ft fire sphere; 2d6 fire (DEX save halves)" },
    { name: "Spike Growth",        school: "Transmutation",desc: "20ft of difficult terrain; 2d4 piercing per 5ft moved" },
    { name: "Pass without Trace",  school: "Abjuration",   desc: "+10 to Stealth for your whole group; no tracks" },
    { name: "Barkskin",            school: "Transmutation",desc: "Target's AC can't be less than 16 for 1h" },
    { name: "Heat Metal",          school: "Transmutation",desc: "2d8 fire to a holder of a metal object each turn" },
    { name: "Lesser Restoration",  school: "Abjuration",   desc: "End a disease or a debilitating condition" },
    { name: "Hold Person",         school: "Enchantment",  desc: "Paralyze a humanoid (WIS save each turn)" },
    { name: "Enhance Ability",     school: "Transmutation",desc: "Advantage on checks with one ability for 1h" },
    { name: "Gust of Wind",        school: "Evocation",    desc: "60ft line of strong wind; push creatures 15ft" },
  ],
  Sorcerer: [
    { name: "Scorching Ray",       school: "Evocation",    desc: "Three rays, each 2d6 fire on a ranged spell attack" },
    { name: "Misty Step",          school: "Conjuration",  desc: "Bonus action: teleport 30ft to a seen space" },
    { name: "Mirror Image",        school: "Illusion",     desc: "Three illusory duplicates that misdirect attacks" },
    { name: "Hold Person",         school: "Enchantment",  desc: "Paralyze a humanoid (WIS save each turn)" },
    { name: "Invisibility",        school: "Illusion",     desc: "A creature you touch turns invisible for 1h" },
    { name: "Blur",                school: "Illusion",     desc: "Attackers have disadvantage against you for 1 min" },
    { name: "Shatter",             school: "Evocation",    desc: "3d8 thunder in a 10ft sphere (CON save halves)" },
    { name: "Darkness",            school: "Evocation",    desc: "15ft sphere of magical darkness for 10 min" },
    { name: "Suggestion",          school: "Enchantment",  desc: "Suggest a reasonable course of action (WIS save)" },
    { name: "Enlarge/Reduce",      school: "Transmutation",desc: "Grow or shrink a creature/object one size" },
  ],
  Wizard: [
    { name: "Misty Step",          school: "Conjuration",  desc: "Bonus action: teleport 30ft to a seen space" },
    { name: "Scorching Ray",       school: "Evocation",    desc: "Three rays, each 2d6 fire on a ranged spell attack" },
    { name: "Mirror Image",        school: "Illusion",     desc: "Three illusory duplicates that misdirect attacks" },
    { name: "Web",                 school: "Conjuration",  desc: "20ft cube of webs; restrains creatures (DEX save)" },
    { name: "Hold Person",         school: "Enchantment",  desc: "Paralyze a humanoid (WIS save each turn)" },
    { name: "Invisibility",        school: "Illusion",     desc: "A creature you touch turns invisible for 1h" },
    { name: "Suggestion",          school: "Enchantment",  desc: "Suggest a reasonable course of action (WIS save)" },
    { name: "Blur",                school: "Illusion",     desc: "Attackers have disadvantage against you for 1 min" },
    { name: "Levitate",            school: "Transmutation",desc: "Raise a creature/object up to 20ft, vertical only" },
    { name: "Detect Thoughts",     school: "Divination",   desc: "Read surface thoughts of creatures within 30ft" },
    { name: "Knock",               school: "Transmutation",desc: "Unlock a locked or stuck object" },
  ],
  Paladin: [
    { name: "Aid",                 school: "Abjuration",   desc: "Raise max & current HP by 5 for 3 allies (8h)" },
    { name: "Lesser Restoration",  school: "Abjuration",   desc: "End a disease or a debilitating condition" },
    { name: "Branding Smite",      school: "Evocation",    desc: "Next hit deals +2d6 radiant; target glows, no invisibility" },
    { name: "Magic Weapon",        school: "Transmutation",desc: "A nonmagical weapon becomes +1 for 1h" },
    { name: "Find Steed",          school: "Conjuration",  desc: "Summon a loyal spirit steed bonded to you" },
    { name: "Zone of Truth",       school: "Enchantment",  desc: "Creatures in a 15ft sphere can't lie (CHA save)" },
    { name: "Protection from Poison", school: "Abjuration",desc: "End one poison; advantage on saves vs poison, resistance" },
  ],
  Ranger: [
    { name: "Pass without Trace",  school: "Abjuration",   desc: "+10 to Stealth for your whole group; no tracks" },
    { name: "Spike Growth",        school: "Transmutation",desc: "20ft of difficult terrain; 2d4 piercing per 5ft moved" },
    { name: "Lesser Restoration",  school: "Abjuration",   desc: "End a disease or a debilitating condition" },
    { name: "Silence",             school: "Illusion",     desc: "No sound in a 20ft sphere; blocks verbal spells" },
    { name: "Cordon of Arrows",    school: "Transmutation",desc: "Four arrows guard an area; 1d6 to passers (DEX save)" },
    { name: "Darkvision",          school: "Transmutation",desc: "Grant 60ft darkvision for 8h" },
    { name: "Beast Sense",         school: "Divination",   desc: "See and hear through a beast you touch" },
  ],
  Warlock: [
    { name: "Hold Person",         school: "Enchantment",  desc: "Paralyze a humanoid (WIS save each turn)" },
    { name: "Misty Step",          school: "Conjuration",  desc: "Bonus action: teleport 30ft to a seen space" },
    { name: "Invisibility",        school: "Illusion",     desc: "A creature you touch turns invisible for 1h" },
    { name: "Mirror Image",        school: "Illusion",     desc: "Three illusory duplicates that misdirect attacks" },
    { name: "Darkness",            school: "Evocation",    desc: "15ft sphere of magical darkness (see with Devil's Sight)" },
    { name: "Suggestion",          school: "Enchantment",  desc: "Suggest a reasonable course of action (WIS save)" },
    { name: "Shatter",             school: "Evocation",    desc: "3d8 thunder in a 10ft sphere (CON save halves)" },
    { name: "Cloud of Daggers",    school: "Conjuration",  desc: "4d4 slashing in a 5ft cube each turn" },
    { name: "Crown of Madness",    school: "Enchantment",  desc: "Force a charmed creature to attack your choice (WIS save)" },
    { name: "Spider Climb",        school: "Transmutation",desc: "Climb walls and ceilings with a climb speed for 1h" },
  ],
};

export const LEVEL3_SPELLS: Partial<Record<string, SpellEntry[]>> = {
  Bard: [
    { name: "Hypnotic Pattern",    school: "Illusion",     desc: "Charm & incapacitate creatures in a 30ft cube (WIS save)" },
    { name: "Dispel Magic",        school: "Abjuration",   desc: "End spells on a target (auto for ≤3rd level)" },
    { name: "Fear",                school: "Illusion",     desc: "Creatures in a 30ft cone drop items and flee (WIS save)" },
    { name: "Major Image",         school: "Illusion",     desc: "Create a 20ft sound/sight/smell illusion you control" },
    { name: "Sending",             school: "Evocation",    desc: "Send a 25-word message to a known creature anywhere" },
    { name: "Tongues",             school: "Divination",   desc: "Understand and be understood in any language for 1h" },
    { name: "Leomund's Tiny Hut",  school: "Evocation",    desc: "10ft dome shelters up to 9 creatures for 8h" },
    { name: "Bestow Curse",        school: "Necromancy",   desc: "Curse a creature: disadvantage, extra damage, or more" },
    { name: "Clairvoyance",        school: "Divination",   desc: "See or hear a distant location for 10 min" },
    { name: "Speak with Dead",     school: "Necromancy",   desc: "Ask a corpse up to five questions" },
  ],
  Cleric: [
    { name: "Spirit Guardians",    school: "Conjuration",  desc: "15ft aura: 3d8 radiant/necrotic & half speed (WIS save)" },
    { name: "Mass Healing Word",   school: "Evocation",    desc: "Bonus action: heal up to 6 creatures 1d4 + mod" },
    { name: "Revivify",            school: "Necromancy",   desc: "Return a creature dead ≤1 min to life with 1 HP" },
    { name: "Dispel Magic",        school: "Abjuration",   desc: "End spells on a target (auto for ≤3rd level)" },
    { name: "Beacon of Hope",      school: "Abjuration",   desc: "Allies gain advantage on WIS saves & death saves, max heals" },
    { name: "Remove Curse",        school: "Abjuration",   desc: "End all curses on a creature or object" },
    { name: "Protection from Energy", school: "Abjuration",desc: "Resistance to one damage type (acid/cold/fire/etc.)" },
    { name: "Sending",             school: "Evocation",    desc: "Send a 25-word message to a known creature anywhere" },
    { name: "Daylight",            school: "Evocation",    desc: "60ft sphere of bright sunlight; dispels darkness" },
  ],
  Druid: [
    { name: "Call Lightning",      school: "Conjuration",  desc: "Summon a storm; 3d10 lightning bolt each turn" },
    { name: "Conjure Animals",     school: "Conjuration",  desc: "Summon fey spirits in beast form to fight for you" },
    { name: "Sleet Storm",         school: "Conjuration",  desc: "20ft icy area: prone, dropped concentration, blocked sight" },
    { name: "Plant Growth",        school: "Transmutation",desc: "Overgrow an area into difficult terrain (or enrich crops)" },
    { name: "Wind Wall",           school: "Evocation",    desc: "Wall of wind deflects arrows; 3d8 to those passing" },
    { name: "Dispel Magic",        school: "Abjuration",   desc: "End spells on a target (auto for ≤3rd level)" },
    { name: "Protection from Energy", school: "Abjuration",desc: "Resistance to one damage type for 1h" },
    { name: "Water Breathing",     school: "Transmutation",desc: "Up to 10 creatures breathe underwater for 24h" },
    { name: "Daylight",            school: "Evocation",    desc: "60ft sphere of bright sunlight; dispels darkness" },
  ],
  Sorcerer: [
    { name: "Fireball",            school: "Evocation",    desc: "8d6 fire in a 20ft sphere (DEX save halves)" },
    { name: "Lightning Bolt",      school: "Evocation",    desc: "8d6 lightning in a 100ft line (DEX save halves)" },
    { name: "Counterspell",        school: "Abjuration",   desc: "Reaction: interrupt a creature casting a spell" },
    { name: "Haste",               school: "Transmutation",desc: "Target gains +2 AC, double speed, an extra action" },
    { name: "Fly",                 school: "Transmutation",desc: "Grant a 60ft flying speed for 10 min" },
    { name: "Slow",                school: "Transmutation",desc: "Halve speed & actions of up to 6 creatures (WIS save)" },
    { name: "Dispel Magic",        school: "Abjuration",   desc: "End spells on a target (auto for ≤3rd level)" },
    { name: "Hypnotic Pattern",    school: "Illusion",     desc: "Charm & incapacitate creatures in a 30ft cube (WIS save)" },
    { name: "Fear",                school: "Illusion",     desc: "Creatures in a 30ft cone drop items and flee (WIS save)" },
  ],
  Wizard: [
    { name: "Fireball",            school: "Evocation",    desc: "8d6 fire in a 20ft sphere (DEX save halves)" },
    { name: "Counterspell",        school: "Abjuration",   desc: "Reaction: interrupt a creature casting a spell" },
    { name: "Lightning Bolt",      school: "Evocation",    desc: "8d6 lightning in a 100ft line (DEX save halves)" },
    { name: "Fly",                 school: "Transmutation",desc: "Grant a 60ft flying speed for 10 min" },
    { name: "Haste",               school: "Transmutation",desc: "Target gains +2 AC, double speed, an extra action" },
    { name: "Dispel Magic",        school: "Abjuration",   desc: "End spells on a target (auto for ≤3rd level)" },
    { name: "Hypnotic Pattern",    school: "Illusion",     desc: "Charm & incapacitate creatures in a 30ft cube (WIS save)" },
    { name: "Slow",                school: "Transmutation",desc: "Halve speed & actions of up to 6 creatures (WIS save)" },
    { name: "Animate Dead",        school: "Necromancy",   desc: "Raise a skeleton or zombie under your command" },
    { name: "Vampiric Touch",      school: "Necromancy",   desc: "3d6 necrotic; heal half the damage dealt" },
  ],
  Paladin: [
    { name: "Crusader's Mantle",   school: "Evocation",    desc: "Allies in 30ft deal +1d4 radiant on weapon hits" },
    { name: "Aura of Vitality",    school: "Evocation",    desc: "Bonus action: heal 2d6 to a creature in 30ft each turn" },
    { name: "Dispel Magic",        school: "Abjuration",   desc: "End spells on a target (auto for ≤3rd level)" },
    { name: "Revivify",            school: "Necromancy",   desc: "Return a creature dead ≤1 min to life with 1 HP" },
    { name: "Blinding Smite",      school: "Evocation",    desc: "Next hit deals +3d8 radiant and blinds the target" },
    { name: "Elemental Weapon",    school: "Transmutation",desc: "Weapon becomes +1 and deals +1d4 elemental damage" },
    { name: "Magic Circle",        school: "Abjuration",   desc: "Ward against (or trap) a chosen creature type" },
  ],
  Ranger: [
    { name: "Conjure Animals",     school: "Conjuration",  desc: "Summon fey spirits in beast form to fight for you" },
    { name: "Lightning Arrow",     school: "Transmutation",desc: "An arrow becomes a 4d8 lightning bolt; 2d8 nearby" },
    { name: "Conjure Barrage",     school: "Conjuration",  desc: "60ft cone of weapons; 3d8 to all (DEX save halves)" },
    { name: "Plant Growth",        school: "Transmutation",desc: "Overgrow an area into difficult terrain" },
    { name: "Wind Wall",           school: "Evocation",    desc: "Wall of wind deflects arrows; 3d8 to those passing" },
    { name: "Protection from Energy", school: "Abjuration",desc: "Resistance to one damage type for 1h" },
    { name: "Water Breathing",     school: "Transmutation",desc: "Up to 10 creatures breathe underwater for 24h" },
  ],
  Warlock: [
    { name: "Counterspell",        school: "Abjuration",   desc: "Reaction: interrupt a creature casting a spell" },
    { name: "Dispel Magic",        school: "Abjuration",   desc: "End spells on a target (auto for ≤3rd level)" },
    { name: "Fly",                 school: "Transmutation",desc: "Grant a 60ft flying speed for 10 min" },
    { name: "Fear",                school: "Illusion",     desc: "Creatures in a 30ft cone drop items and flee (WIS save)" },
    { name: "Hypnotic Pattern",    school: "Illusion",     desc: "Charm & incapacitate creatures in a 30ft cube (WIS save)" },
    { name: "Hunger of Hadar",     school: "Conjuration",  desc: "20ft void: 2d6 cold then 2d6 acid; blinds & traps" },
    { name: "Vampiric Touch",      school: "Necromancy",   desc: "3d6 necrotic; heal half the damage dealt" },
    { name: "Gaseous Form",        school: "Transmutation",desc: "Turn a willing creature into a misty cloud for 1h" },
    { name: "Summon Lesser Demons", school: "Conjuration", desc: "Summon hostile demons that attack the nearest creatures" },
  ],
};

export const LEVEL4_SPELLS: Partial<Record<string, SpellEntry[]>> = {
  Bard: [
    { name: "Dimension Door",      school: "Conjuration",  desc: "Teleport yourself (and one ally) up to 500ft" },
    { name: "Polymorph",           school: "Transmutation",desc: "Turn a creature into a beast (WIS save)" },
    { name: "Greater Invisibility",school: "Illusion",     desc: "A creature is invisible for 1 min — even while attacking" },
    { name: "Confusion",           school: "Enchantment",  desc: "Creatures in a 10ft sphere act randomly (WIS save)" },
    { name: "Freedom of Movement", school: "Abjuration",   desc: "Ignore difficult terrain, restraints, and grapples for 1h" },
    { name: "Compulsion",          school: "Enchantment",  desc: "Force creatures to move a chosen direction (WIS save)" },
    { name: "Locate Creature",     school: "Divination",   desc: "Sense the direction to a known creature within 1000ft" },
  ],
  Cleric: [
    { name: "Banishment",          school: "Abjuration",   desc: "Banish a creature to another plane (CHA save)" },
    { name: "Death Ward",          school: "Abjuration",   desc: "First time target hits 0 HP, drop to 1 instead" },
    { name: "Guardian of Faith",   school: "Conjuration",  desc: "Spectral guardian deals 20 radiant to foes within 10ft" },
    { name: "Freedom of Movement", school: "Abjuration",   desc: "Ignore difficult terrain, restraints, and grapples for 1h" },
    { name: "Divination",          school: "Divination",   desc: "A truthful answer about a goal within 7 days" },
    { name: "Control Water",       school: "Transmutation",desc: "Raise, part, redirect, or whirl a body of water" },
  ],
  Druid: [
    { name: "Polymorph",           school: "Transmutation",desc: "Turn a creature into a beast (WIS save)" },
    { name: "Ice Storm",           school: "Evocation",    desc: "2d8 bludgeon + 4d6 cold in a 20ft cylinder" },
    { name: "Stoneskin",           school: "Abjuration",   desc: "Resistance to nonmagical bludgeon/pierce/slash for 1h" },
    { name: "Wall of Fire",        school: "Evocation",    desc: "60ft wall; 5d8 fire to those on the hot side" },
    { name: "Conjure Woodland Beings", school: "Conjuration", desc: "Summon fey creatures to aid you" },
    { name: "Freedom of Movement", school: "Abjuration",   desc: "Ignore difficult terrain, restraints, and grapples for 1h" },
    { name: "Dominate Beast",      school: "Enchantment",  desc: "Command a beast you can see (WIS save)" },
  ],
  Sorcerer: [
    { name: "Greater Invisibility",school: "Illusion",     desc: "A creature is invisible for 1 min — even while attacking" },
    { name: "Dimension Door",      school: "Conjuration",  desc: "Teleport yourself (and one ally) up to 500ft" },
    { name: "Polymorph",           school: "Transmutation",desc: "Turn a creature into a beast (WIS save)" },
    { name: "Banishment",          school: "Abjuration",   desc: "Banish a creature to another plane (CHA save)" },
    { name: "Ice Storm",           school: "Evocation",    desc: "2d8 bludgeon + 4d6 cold in a 20ft cylinder" },
    { name: "Wall of Fire",        school: "Evocation",    desc: "60ft wall; 5d8 fire to those on the hot side" },
    { name: "Stoneskin",           school: "Abjuration",   desc: "Resistance to nonmagical physical damage for 1h" },
    { name: "Blight",              school: "Necromancy",   desc: "8d8 necrotic to one creature (CON save halves)" },
  ],
  Wizard: [
    { name: "Polymorph",           school: "Transmutation",desc: "Turn a creature into a beast (WIS save)" },
    { name: "Greater Invisibility",school: "Illusion",     desc: "A creature is invisible for 1 min — even while attacking" },
    { name: "Dimension Door",      school: "Conjuration",  desc: "Teleport yourself (and one ally) up to 500ft" },
    { name: "Banishment",          school: "Abjuration",   desc: "Banish a creature to another plane (CHA save)" },
    { name: "Ice Storm",           school: "Evocation",    desc: "2d8 bludgeon + 4d6 cold in a 20ft cylinder" },
    { name: "Wall of Fire",        school: "Evocation",    desc: "60ft wall; 5d8 fire to those on the hot side" },
    { name: "Evard's Black Tentacles", school: "Conjuration", desc: "20ft of grasping tentacles; restrain & 3d6/turn" },
    { name: "Stoneskin",           school: "Abjuration",   desc: "Resistance to nonmagical physical damage for 1h" },
    { name: "Phantasmal Killer",   school: "Illusion",     desc: "A nightmare deals 4d10 psychic over time (WIS save)" },
  ],
  Warlock: [
    { name: "Banishment",          school: "Abjuration",   desc: "Banish a creature to another plane (CHA save)" },
    { name: "Dimension Door",      school: "Conjuration",  desc: "Teleport yourself (and one ally) up to 500ft" },
    { name: "Charm Monster",       school: "Enchantment",  desc: "Charm a creature of any type as a friend (WIS save)" },
    { name: "Hallucinatory Terrain", school: "Illusion",   desc: "Disguise terrain over a large area for 24h" },
    { name: "Summon Greater Demon",school: "Conjuration",  desc: "Summon a demon to serve while you concentrate" },
  ],
};

export const LEVEL5_SPELLS: Partial<Record<string, SpellEntry[]>> = {
  Bard: [
    { name: "Mass Cure Wounds",    school: "Evocation",    desc: "Heal up to 6 creatures 3d8 + mod within 30ft" },
    { name: "Greater Restoration", school: "Abjuration",   desc: "End exhaustion, charm, petrification, or a curse" },
    { name: "Hold Monster",        school: "Enchantment",  desc: "Paralyze any creature (WIS save each turn)" },
    { name: "Dominate Person",     school: "Enchantment",  desc: "Control a humanoid you can see (WIS save)" },
    { name: "Animate Objects",     school: "Transmutation",desc: "Up to 10 objects spring to life and fight for you" },
    { name: "Seeming",             school: "Illusion",     desc: "Change the appearance of many creatures for 8h" },
    { name: "Mislead",             school: "Illusion",     desc: "Turn invisible and project an illusory double" },
  ],
  Cleric: [
    { name: "Mass Cure Wounds",    school: "Evocation",    desc: "Heal up to 6 creatures 3d8 + mod within 30ft" },
    { name: "Raise Dead",          school: "Necromancy",   desc: "Return a creature dead ≤10 days to life" },
    { name: "Greater Restoration", school: "Abjuration",   desc: "End exhaustion, charm, petrification, or a curse" },
    { name: "Flame Strike",        school: "Evocation",    desc: "4d6 fire + 4d6 radiant in a 10ft column (DEX save)" },
    { name: "Dispel Evil and Good",school: "Abjuration",   desc: "Protect against and banish fiends, undead, fey, etc." },
    { name: "Geas",                school: "Enchantment",  desc: "Command a creature; 5d10 psychic if it disobeys" },
    { name: "Insect Plague",       school: "Conjuration",  desc: "20ft swarm: 4d10 piercing, difficult terrain (CON save)" },
  ],
  Druid: [
    { name: "Mass Cure Wounds",    school: "Evocation",    desc: "Heal up to 6 creatures 3d8 + mod within 30ft" },
    { name: "Greater Restoration", school: "Abjuration",   desc: "End exhaustion, charm, petrification, or a curse" },
    { name: "Conjure Elemental",   school: "Conjuration",  desc: "Summon an elemental to fight at your command" },
    { name: "Wall of Stone",       school: "Evocation",    desc: "Conjure a wall of stone to block or bridge" },
    { name: "Tree Stride",         school: "Conjuration",  desc: "Step between trees, traveling up to 500ft each turn" },
    { name: "Insect Plague",       school: "Conjuration",  desc: "20ft swarm: 4d10 piercing, difficult terrain (CON save)" },
    { name: "Commune with Nature", school: "Divination",   desc: "Learn facts about the land within 3 miles" },
  ],
  Sorcerer: [
    { name: "Cone of Cold",        school: "Evocation",    desc: "8d8 cold in a 60ft cone (CON save halves)" },
    { name: "Hold Monster",        school: "Enchantment",  desc: "Paralyze any creature (WIS save each turn)" },
    { name: "Dominate Person",     school: "Enchantment",  desc: "Control a humanoid you can see (WIS save)" },
    { name: "Telekinesis",         school: "Transmutation",desc: "Move or restrain creatures and objects by thought" },
    { name: "Wall of Stone",       school: "Evocation",    desc: "Conjure a wall of stone to block or bridge" },
    { name: "Cloudkill",           school: "Conjuration",  desc: "20ft moving poison cloud; 5d8 (CON save halves)" },
    { name: "Animate Objects",     school: "Transmutation",desc: "Up to 10 objects spring to life and fight for you" },
  ],
  Wizard: [
    { name: "Cone of Cold",        school: "Evocation",    desc: "8d8 cold in a 60ft cone (CON save halves)" },
    { name: "Wall of Force",       school: "Evocation",    desc: "An invisible, near-indestructible wall for 10 min" },
    { name: "Hold Monster",        school: "Enchantment",  desc: "Paralyze any creature (WIS save each turn)" },
    { name: "Dominate Person",     school: "Enchantment",  desc: "Control a humanoid you can see (WIS save)" },
    { name: "Telekinesis",         school: "Transmutation",desc: "Move or restrain creatures and objects by thought" },
    { name: "Cloudkill",           school: "Conjuration",  desc: "20ft moving poison cloud; 5d8 (CON save halves)" },
    { name: "Animate Objects",     school: "Transmutation",desc: "Up to 10 objects spring to life and fight for you" },
    { name: "Scrying",             school: "Divination",   desc: "Spy on a creature you know via an invisible sensor" },
  ],
  Warlock: [
    { name: "Hold Monster",        school: "Enchantment",  desc: "Paralyze any creature (WIS save each turn)" },
    { name: "Dominate Person",     school: "Enchantment",  desc: "Control a humanoid you can see (WIS save)" },
    { name: "Synaptic Static",     school: "Enchantment",  desc: "8d6 psychic in a 20ft sphere; muddles minds (INT save)" },
    { name: "Scrying",             school: "Divination",   desc: "Spy on a creature you know via an invisible sensor" },
    { name: "Far Step",            school: "Conjuration",  desc: "Bonus action: teleport 60ft each turn for 1 min" },
  ],
};

// How many cantrips/spells each class gets at level 1
export type SpellLimits = {
  cantrips: number;
  spells: number;
  spellFormula?: "INT" | "WIS" | "CHA"; // stat-derived prepared spell count
};

export const SPELL_LIMITS: Record<string, SpellLimits> = {
  Bard:     { cantrips: 2, spells: 4 },
  Cleric:   { cantrips: 3, spells: 2, spellFormula: "WIS" },
  Druid:    { cantrips: 2, spells: 2, spellFormula: "WIS" },
  // Half-casters: NO spellcasting at level 1 — they gain spells (and slots) at
  // level 2. So 0 cantrips / 0 spells at creation. (At higher levels their spells
  // are available via the in-game spellbook once they have slots.)
  Paladin:  { cantrips: 0, spells: 0 },
  Ranger:   { cantrips: 0, spells: 0 },
  Sorcerer: { cantrips: 4, spells: 2 },
  Warlock:  { cantrips: 2, spells: 2 },
  Wizard:   { cantrips: 3, spells: 2, spellFormula: "INT" },
};

export const SPELLCASTING_CLASSES = new Set(Object.keys(SPELL_LIMITS));

// Official D&D 5e cumulative XP thresholds. XP_THRESHOLDS[n] = total XP required
// to advance from level n to level n+1. Progression is capped at level 10 (spell
// slots, hit dice, and class features are all balanced for levels 1–10), so the
// table stops at the 10→11 boundary.
export const XP_THRESHOLDS: Record<number, number> = {
  1: 300, 2: 900, 3: 2700, 4: 6500, 5: 14000,
  6: 23000, 7: 34000, 8: 48000, 9: 64000, 10: 85000,
};

export function getXpToNextLevel(level: number): number {
  return XP_THRESHOLDS[level] ?? 999999;
}

export function getSpellCounts(
  cls: string,
  scores: { intelligence: number; wisdom: number; charisma: number }
): { cantrips: number; spells: number } {
  const lim = SPELL_LIMITS[cls];
  if (!lim) return { cantrips: 0, spells: 0 };

  let spells = lim.spells;
  if (lim.spellFormula === "INT") {
    const mod = Math.floor((scores.intelligence - 10) / 2);
    spells = Math.max(1, mod + 1);
  } else if (lim.spellFormula === "WIS") {
    const mod = Math.floor((scores.wisdom - 10) / 2);
    spells = Math.max(1, mod + 1);
  } else if (lim.spellFormula === "CHA") {
    const mod = Math.floor((scores.charisma - 10) / 2);
    spells = Math.max(1, mod + 1);
  }

  return { cantrips: lim.cantrips, spells };
}

// D&D 5e spell slots per character level (index = charLevel-1)
// Each entry: [1st-level, 2nd-level, 3rd-level, 4th-level, 5th-level] slots
const FULL_CASTER_SLOTS: number[][] = [
  [2,0,0,0,0],[3,0,0,0,0],[4,2,0,0,0],[4,3,0,0,0],
  [4,3,2,0,0],[4,3,3,0,0],[4,3,3,1,0],[4,3,3,2,0],
  [4,3,3,3,1],[4,3,3,3,2],
];
const HALF_CASTER_SLOTS: number[][] = [
  [0,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],
  [4,2,0,0,0],[4,2,0,0,0],[4,3,0,0,0],[4,3,0,0,0],
  [4,3,2,0,0],[4,3,2,0,0],
];
const WARLOCK_SLOTS: number[][] = [
  [1,0,0,0,0],[2,0,0,0,0],[0,2,0,0,0],[0,2,0,0,0],
  [0,0,2,0,0],[0,0,2,0,0],[0,0,0,2,0],[0,0,0,2,0],
  [0,0,0,0,2],[0,0,0,0,2],
];

export const SPELL_SLOT_TABLE: Partial<Record<string, number[][]>> = {
  Bard: FULL_CASTER_SLOTS, Cleric: FULL_CASTER_SLOTS, Druid: FULL_CASTER_SLOTS,
  Sorcerer: FULL_CASTER_SLOTS, Wizard: FULL_CASTER_SLOTS,
  Paladin: HALF_CASTER_SLOTS, Ranger: HALF_CASTER_SLOTS,
  Warlock: WARLOCK_SLOTS,
};

/**
 * Canonical minimum slot level for common D&D 5e spells.
 * Cantrips are absent (they use no slot). Used to determine which slot to consume
 * when the DM narrates a spell being cast.
 */
export const SPELL_LEVEL_MAP: Record<string, number> = {
  // Level 1
  "Absorb Elements": 1, "Alarm": 1, "Animal Friendship": 1,
  "Armor of Agathys": 1, "Arms of Hadar": 1,
  "Bane": 1, "Bless": 1, "Burning Hands": 1, "Charm Person": 1, "Chromatic Orb": 1,
  "Color Spray": 1, "Command": 1, "Compelled Duel": 1, "Comprehend Languages": 1,
  "Create or Destroy Water": 1, "Cure Wounds": 1,
  "Detect Evil and Good": 1, "Detect Magic": 1, "Detect Poison and Disease": 1,
  "Dissonant Whispers": 1, "Disguise Self": 1, "Divine Favor": 1, "Entangle": 1,
  "Ensnaring Strike": 1, "Expeditious Retreat": 1, "Faerie Fire": 1, "False Life": 1,
  "Feather Fall": 1, "Find Familiar": 1, "Fog Cloud": 1, "Goodberry": 1,
  "Grease": 1, "Guiding Bolt": 1, "Hail of Thorns": 1, "Healing Word": 1,
  "Hellish Rebuke": 1, "Heroism": 1, "Hex": 1, "Hunter's Mark": 1,
  "Ice Knife": 1, "Identify": 1, "Illusory Script": 1, "Inflict Wounds": 1, "Jump": 1,
  "Longstrider": 1, "Mage Armor": 1, "Magic Missile": 1,
  "Protection from Evil and Good": 1, "Protection from Evil & Good": 1,
  "Purify Food and Drink": 1, "Ray of Sickness": 1, "Sanctuary": 1, "Searing Smite": 1,
  "Shield": 1, "Shield of Faith": 1, "Silent Image": 1, "Sleep": 1, "Speak with Animals": 1,
  "Tasha's Hideous Laughter": 1, "Thunderous Smite": 1, "Thunderwave": 1,
  "Unseen Servant": 1, "Witch Bolt": 1, "Wrathful Smite": 1,
  // Level 2
  "Aid": 2, "Alter Self": 2, "Arcane Lock": 2, "Blindness/Deafness": 2, "Blur": 2,
  "Branding Smite": 2, "Calm Emotions": 2, "Continual Flame": 2, "Crown of Madness": 2,
  "Darkness": 2, "Darkvision": 2, "Detect Thoughts": 2, "Enlarge/Reduce": 2, "Enthrall": 2,
  "Find Traps": 2, "Flame Blade": 2, "Flaming Sphere": 2, "Gentle Repose": 2,
  "Heat Metal": 2, "Hold Person": 2, "Invisibility": 2, "Knock": 2, "Lesser Restoration": 2,
  "Levitate": 2, "Locate Animals or Plants": 2, "Locate Object": 2, "Magic Mouth": 2,
  "Magic Weapon": 2, "Mirror Image": 2, "Misty Step": 2, "Moonbeam": 2,
  "Pass without Trace": 2, "Prayer of Healing": 2, "Protection from Poison": 2,
  "Ray of Enfeeblement": 2, "Rope Trick": 2, "Scorching Ray": 2, "See Invisibility": 2,
  "Shatter": 2, "Silence": 2, "Spider Climb": 2, "Spiritual Weapon": 2, "Suggestion": 2,
  "Warding Bond": 2, "Web": 2, "Zone of Truth": 2,
  // Level 3
  "Animate Dead": 3, "Bestow Curse": 3, "Blink": 3, "Call Lightning": 3,
  "Clairvoyance": 3, "Conjure Animals": 3, "Counterspell": 3, "Daylight": 3,
  "Dispel Magic": 3, "Fear": 3, "Fireball": 3, "Fly": 3, "Gaseous Form": 3,
  "Glyph of Warding": 3, "Haste": 3, "Hunger of Hadar": 3, "Hypnotic Pattern": 3,
  "Lightning Bolt": 3, "Magic Circle": 3, "Major Image": 3, "Mass Healing Word": 3,
  "Nondetection": 3, "Plant Growth": 3, "Protection from Energy": 3, "Remove Curse": 3,
  "Sending": 3, "Sleet Storm": 3, "Slow": 3, "Speak with Dead": 3, "Speak with Plants": 3,
  "Spirit Guardians": 3, "Stinking Cloud": 3, "Tongues": 3, "Vampiric Touch": 3,
  "Water Breathing": 3, "Water Walk": 3, "Wind Wall": 3,
  // Level 4
  "Arcane Eye": 4, "Banishment": 4, "Blight": 4, "Compulsion": 4, "Confusion": 4,
  "Conjure Minor Elementals": 4, "Conjure Woodland Beings": 4, "Control Water": 4,
  "Death Ward": 4, "Dimension Door": 4, "Divination": 4, "Dominate Beast": 4,
  "Evard's Black Tentacles": 4, "Fabricate": 4, "Fire Shield": 4, "Freedom of Movement": 4,
  "Giant Insect": 4, "Greater Invisibility": 4, "Guardian of Faith": 4, "Ice Storm": 4,
  "Locate Creature": 4, "Phantasmal Killer": 4, "Polymorph": 4, "Stone Shape": 4,
  "Stoneskin": 4, "Wall of Fire": 4,
  // Level 5
  "Animate Objects": 5, "Bigby's Hand": 5, "Circle of Power": 5, "Cloudkill": 5,
  "Commune": 5, "Commune with Nature": 5, "Cone of Cold": 5, "Conjure Elemental": 5,
  "Conjure Volley": 5, "Contact Other Plane": 5, "Contagion": 5, "Creation": 5,
  "Dominate Person": 5, "Dream": 5, "Geas": 5, "Greater Restoration": 5,
  "Hold Monster": 5, "Insect Plague": 5, "Legend Lore": 5, "Mass Cure Wounds": 5,
  "Modify Memory": 5, "Passwall": 5, "Planar Binding": 5, "Raise Dead": 5,
  "Scrying": 5, "Seeming": 5, "Skill Empowerment": 5, "Swift Quiver": 5,
  "Synaptic Static": 5, "Telekinesis": 5, "Teleportation Circle": 5,
  "Tree Stride": 5, "Wall of Force": 5, "Wall of Stone": 5,
};

/** Returns the minimum slot level for a spell name, or 0 if it's a cantrip / unknown. */
export function getSpellLevel(spellName: string): number {
  return SPELL_LEVEL_MAP[spellName] ?? 0;
}

// ── Combined spell lookups across all spell levels ──────────────────────────────
export const SPELL_LISTS_BY_LEVEL: Record<number, Partial<Record<string, SpellEntry[]>>> = {
  1: LEVEL1_SPELLS, 2: LEVEL2_SPELLS, 3: LEVEL3_SPELLS, 4: LEVEL4_SPELLS, 5: LEVEL5_SPELLS,
};

// Auto-register every higher-level spell into SPELL_LEVEL_MAP so a typed cast
// ("I cast Fireball") consumes the correct slot even when not listed manually.
// Hand-tuned entries always win (never downgrade an existing level).
for (const [lvl, lists] of Object.entries(SPELL_LISTS_BY_LEVEL)) {
  for (const cls of Object.keys(lists)) {
    for (const sp of lists[cls] ?? []) {
      if (SPELL_LEVEL_MAP[sp.name] === undefined) SPELL_LEVEL_MAP[sp.name] = Number(lvl);
    }
  }
}

/** Spells a class can cast at a given spell level (1–5). */
export function getClassSpellsAtLevel(cls: string, spellLevel: number): SpellEntry[] {
  return SPELL_LISTS_BY_LEVEL[spellLevel]?.[cls] ?? [];
}

/** Find a spell's entry (school/description) across cantrips and all spell levels. */
export function getSpellEntry(cls: string, name: string): SpellEntry | undefined {
  const c = CANTRIPS[cls]?.find(e => e.name === name);
  if (c) return c;
  for (let l = 1; l <= 5; l++) { const e = SPELL_LISTS_BY_LEVEL[l]?.[cls]?.find(x => x.name === name); if (e) return e; }
  return undefined;
}

/** Returns { [slotLevel]: maxSlots } for a class at the given character level */
export function getSpellSlots(cls: string, charLevel: number): Record<number, number> {
  const table = SPELL_SLOT_TABLE[cls];
  if (!table) return {};
  const row = table[Math.min(charLevel, 10) - 1] ?? [];
  const result: Record<number, number> = {};
  row.forEach((n, i) => { if (n > 0) result[i + 1] = n; });
  return result;
}

/**
 * Remaining spell slots per level = class-table max minus used. Used to tell the DM
 * exactly how many slots are LEFT (not just how many were used) so it can't wrongly
 * refuse a valid cast. `used` keys may be strings (JSON) or numbers. e.g. a level-1
 * Druid with 1 first-level slot spent → { 1: 1 } (still castable).
 */
export function spellSlotsRemaining(
  cls: string,
  charLevel: number,
  used: Record<string, number> | Record<number, number> | undefined | null,
): Record<number, number> {
  const max = getSpellSlots(cls, charLevel);
  const u = (used ?? {}) as Record<string, number>;
  const out: Record<number, number> = {};
  for (const [lvl, m] of Object.entries(max)) {
    const spent = Number(u[lvl]) || 0;
    out[Number(lvl)] = Math.max(0, m - spent);
  }
  return out;
}

export type StatTier = "primary" | "secondary" | "useful" | "dump";
export type StatGuide = { tier: StatTier; reason: string };

export const CLASS_STAT_GUIDES: Record<string, Record<string, StatGuide>> = {
  Barbarian: {
    STR: { tier: "primary",   reason: "Melee attack rolls, damage, and Athletics all scale with STR — your bread and butter." },
    DEX: { tier: "secondary", reason: "Boosts AC and Dex saves when unarmored. Useful, but STR comes first." },
    CON: { tier: "primary",   reason: "Adds directly to AC via Unarmored Defense and fuels your Rage-powered survivability." },
    INT: { tier: "dump",      reason: "No Barbarian class features use INT. Safe to keep low." },
    WIS: { tier: "useful",    reason: "Improves Perception (your most common check) and WIS saves." },
    CHA: { tier: "dump",      reason: "No Barbarian class features rely on CHA." },
  },
  Bard: {
    STR: { tier: "dump",      reason: "Bards rarely enter melee; virtually no class features use STR." },
    DEX: { tier: "secondary", reason: "Initiative, light armor AC, and many Dex-based skills you'll want high." },
    CON: { tier: "secondary", reason: "Keeps Concentration spells alive and boosts HP for this often-squishy caster." },
    INT: { tier: "useful",    reason: "Helpful for knowledge skills, but not mechanically tied to your spells." },
    WIS: { tier: "useful",    reason: "Improves Perception and WIS saves, which come up frequently." },
    CHA: { tier: "primary",   reason: "Your spellcasting modifier for all spells, Bardic Inspiration DCs, and social skills." },
  },
  Cleric: {
    STR: { tier: "useful",    reason: "Melee Clerics (War domain etc.) benefit from STR for weapon attacks." },
    DEX: { tier: "useful",    reason: "Boosts AC with medium armor and helps Dex saves." },
    CON: { tier: "secondary", reason: "More HP and holding Concentration on powerful spells — crucial in combat." },
    INT: { tier: "dump",      reason: "No core Cleric features use INT. Safe to dump." },
    WIS: { tier: "primary",   reason: "Controls all spell DCs, spell attack rolls, and healing potency." },
    CHA: { tier: "dump",      reason: "Very few Cleric features rely on CHA." },
  },
  Druid: {
    STR: { tier: "dump",      reason: "Wild Shape handles melee; spell attacks never use STR." },
    DEX: { tier: "secondary", reason: "Medium armor caps DEX bonus at +2, but still helps Dex saves and initiative." },
    CON: { tier: "secondary", reason: "Survivability and Concentration — vital for spells like Entangle." },
    INT: { tier: "useful",    reason: "Arcana and Nature skills, but not mechanically tied to your magic." },
    WIS: { tier: "primary",   reason: "Your spellcasting ability — controls all spell DCs and spell attack rolls." },
    CHA: { tier: "dump",      reason: "Almost no Druid class features use CHA." },
  },
  Fighter: {
    STR: { tier: "primary",   reason: "Melee attack rolls, damage, and grappling all use STR. Core for sword-and-board." },
    DEX: { tier: "secondary", reason: "Ranged/finesse builds prioritize DEX instead; also helps Dex saves and AC." },
    CON: { tier: "secondary", reason: "More HP, better CON saves, and resistance to exhaustion all come from CON." },
    INT: { tier: "dump",      reason: "No core Fighter features use INT (unless playing Eldritch Knight)." },
    WIS: { tier: "useful",    reason: "Passive Perception and WIS saves — common and often dangerous to fail." },
    CHA: { tier: "dump",      reason: "Social situations rarely depend on CHA mechanically for a Fighter." },
  },
  Monk: {
    STR: { tier: "dump",      reason: "DEX fully replaces STR for Monk attacks. STR provides almost no benefit." },
    DEX: { tier: "primary",   reason: "Attack rolls, AC (Unarmored Defense), Dex saves, and nearly all Monk skills scale with DEX." },
    CON: { tier: "useful",    reason: "More HP matters when you're a front-line fighter without armor." },
    INT: { tier: "dump",      reason: "No core Monk features use INT." },
    WIS: { tier: "primary",   reason: "Adds to AC via Unarmored Defense and improves Stunning Strike save DCs." },
    CHA: { tier: "dump",      reason: "No Monk class features depend on CHA." },
  },
  Paladin: {
    STR: { tier: "primary",   reason: "Melee attack rolls and damage; heavy armor means DEX is largely irrelevant." },
    DEX: { tier: "dump",      reason: "Paladins wear heavy armor and rarely use DEX for attacks — mainly just Dex saves." },
    CON: { tier: "secondary", reason: "HP, CON saves, and holding Concentration on combat spells like Bless." },
    INT: { tier: "dump",      reason: "No Paladin class features use INT." },
    WIS: { tier: "useful",    reason: "Perception and WIS saves; Aura of Protection covers saves at higher levels." },
    CHA: { tier: "primary",   reason: "Spell DCs, Aura of Protection (adds to all allies' saves), and Turn Undead all scale with CHA." },
  },
  Ranger: {
    STR: { tier: "useful",    reason: "Only helpful for melee Rangers; most builds use DEX for everything." },
    DEX: { tier: "primary",   reason: "Attack rolls, AC, initiative, and core Ranger skills (Stealth, Acrobatics) all use DEX." },
    CON: { tier: "secondary", reason: "Survivability and Concentration — vital for spells like Hunter's Mark." },
    INT: { tier: "dump",      reason: "No core Ranger features use INT." },
    WIS: { tier: "secondary", reason: "Spellcasting modifier for Ranger spells; also improves Perception and Survival." },
    CHA: { tier: "dump",      reason: "No Ranger class features rely on CHA." },
  },
  Rogue: {
    STR: { tier: "dump",      reason: "Rogues attack with DEX via finesse or ranged weapons. STR is nearly useless." },
    DEX: { tier: "primary",   reason: "Attack rolls, Sneak Attack, AC, Initiative, and Rogue skills (Stealth, Thieves' Tools) all use DEX." },
    CON: { tier: "secondary", reason: "More HP helps you survive hits taken in dangerous flanking positions." },
    INT: { tier: "useful",    reason: "Arcane Trickster spellcasting and Investigation; helpful for some builds." },
    WIS: { tier: "useful",    reason: "Perception and Insight — two of your most-used skills in tricky situations." },
    CHA: { tier: "useful",    reason: "Deception, Persuasion, and Intimidation are classic Rogue social tools." },
  },
  Sorcerer: {
    STR: { tier: "dump",      reason: "No Sorcerer class features or spells use STR." },
    DEX: { tier: "secondary", reason: "AC (with Mage Armor), initiative, and Dex saves — common and often deadly to fail." },
    CON: { tier: "secondary", reason: "HP, CON saves, and holding Concentration on high-value spells." },
    INT: { tier: "dump",      reason: "No Sorcerer features use INT; your power comes from CHA." },
    WIS: { tier: "useful",    reason: "WIS saves are common; Perception helps you notice threats early." },
    CHA: { tier: "primary",   reason: "Your spellcasting modifier for all spell DCs, attack rolls, and Metamagic options." },
  },
  Warlock: {
    STR: { tier: "dump",      reason: "No Warlock features or Eldritch Blast use STR." },
    DEX: { tier: "secondary", reason: "AC, initiative, and Dex saves — essential for a lightly-armored caster." },
    CON: { tier: "secondary", reason: "HP, CON saves (for Concentration), and surviving up-close Eldritch Blast range." },
    INT: { tier: "dump",      reason: "No Warlock features use INT." },
    WIS: { tier: "useful",    reason: "WIS saves and Perception — Warlocks are prime targets, so saves matter." },
    CHA: { tier: "primary",   reason: "All spell DCs, Eldritch Blast attack rolls (Agonizing Blast), and features like Dark One's Blessing." },
  },
  Wizard: {
    STR: { tier: "dump",      reason: "No Wizard features or spells use STR." },
    DEX: { tier: "secondary", reason: "AC (with Mage Armor), initiative, and Dex saves." },
    CON: { tier: "secondary", reason: "HP and CON saves — failing a CON save breaks Concentration on a key spell." },
    INT: { tier: "primary",   reason: "Your spellcasting modifier for all spell DCs, spell attack rolls, and the Arcana skill." },
    WIS: { tier: "useful",    reason: "WIS saves are very common; Perception is vital in dangerous dungeons." },
    CHA: { tier: "dump",      reason: "No Wizard class features rely on CHA." },
  },
};

export function getTierStyle(tier: StatTier): { color: string; label: string } {
  switch (tier) {
    case "primary":   return { color: "#f59e0b", label: "Primary" };
    case "secondary": return { color: "#8b5cf6", label: "Strong" };
    case "useful":    return { color: "#3b82f6", label: "Useful" };
    case "dump":      return { color: "#475569", label: "Low" };
  }
}

/** Compute armor class from class, stats, and gear */
export function computeAC(
  cls: string, dex: number, con: number, wis: number,
  items?: string[], weapons?: string[]
): number {
  const dexMod = Math.floor((dex  - 10) / 2);
  const conMod = Math.floor((con  - 10) / 2);
  const wisMod = Math.floor((wis  - 10) / 2);
  const gear   = [...(items ?? []), ...(weapons ?? [])].join(" ").toLowerCase();
  const shield = /\bshield\b/.test(gear) ? 2 : 0;
  if (/plate mail|full plate/.test(gear))   return 18 + shield;
  if (/chain mail/.test(gear))              return 16 + shield;
  if (/scale mail|breastplate/.test(gear))  return 14 + Math.min(dexMod, 2) + shield;
  if (/leather|studded/.test(gear))         return 11 + dexMod + shield;
  if (cls === "Barbarian")                  return 10 + dexMod + conMod;
  if (cls === "Monk")                       return 10 + dexMod + wisMod;
  if (["Fighter","Paladin"].includes(cls))  return 16 + shield; // chain mail default
  if (["Cleric","Ranger","Druid"].includes(cls)) return 14 + Math.min(dexMod, 2) + shield;
  return 11 + dexMod + shield; // leather default (Rogue, Bard, Warlock, Sorcerer, Wizard)
}
