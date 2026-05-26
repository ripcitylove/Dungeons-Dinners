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
    { name: "Color Spray",              school: "Illusion",     desc: "Blind creatures within a cone based on HP" },
    { name: "Command",                  school: "Enchantment",  desc: "One-word command a creature obeys (WIS save)" },
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
  Paladin:  { cantrips: 0, spells: 2, spellFormula: "CHA" },
  Ranger:   { cantrips: 0, spells: 2 },
  Sorcerer: { cantrips: 4, spells: 2 },
  Warlock:  { cantrips: 2, spells: 2 },
  Wizard:   { cantrips: 3, spells: 2, spellFormula: "INT" },
};

export const SPELLCASTING_CLASSES = new Set(Object.keys(SPELL_LIMITS));

// D&D 5e XP thresholds per level
export const XP_THRESHOLDS: Record<number, number> = {
  1: 300, 2: 600, 3: 1800, 4: 3800, 5: 7500,
  6: 9000, 7: 11000, 8: 14000, 9: 16000, 10: 21000,
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
