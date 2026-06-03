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
  "Animal Friendship": 1, "Bane": 1, "Bless": 1, "Burning Hands": 1, "Charm Person": 1,
  "Color Spray": 1, "Command": 1, "Comprehend Languages": 1, "Create or Destroy Water": 1,
  "Cure Wounds": 1, "Detect Evil and Good": 1, "Detect Magic": 1, "Detect Poison and Disease": 1,
  "Dissonant Whispers": 1, "Disguise Self": 1, "Entangle": 1, "Expeditious Retreat": 1,
  "Faerie Fire": 1, "False Life": 1, "Feather Fall": 1, "Fog Cloud": 1, "Goodberry": 1,
  "Grease": 1, "Guiding Bolt": 1, "Healing Word": 1, "Heroism": 1, "Hex": 1,
  "Hunter's Mark": 1, "Ice Knife": 1, "Identify": 1, "Inflict Wounds": 1, "Jump": 1,
  "Longstrider": 1, "Mage Armor": 1, "Magic Missile": 1, "Protection from Evil and Good": 1,
  "Purify Food and Drink": 1, "Ray of Sickness": 1, "Sanctuary": 1, "Shield": 1,
  "Shield of Faith": 1, "Silent Image": 1, "Sleep": 1, "Speak with Animals": 1,
  "Tasha's Hideous Laughter": 1, "Thunderwave": 1, "Unseen Servant": 1, "Witch Bolt": 1,
  "Wrathful Smite": 1, "Divine Favor": 1, "Searing Smite": 1, "Thunderous Smite": 1,
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

/** Returns { [slotLevel]: maxSlots } for a class at the given character level */
export function getSpellSlots(cls: string, charLevel: number): Record<number, number> {
  const table = SPELL_SLOT_TABLE[cls];
  if (!table) return {};
  const row = table[Math.min(charLevel, 10) - 1] ?? [];
  const result: Record<number, number> = {};
  row.forEach((n, i) => { if (n > 0) result[i + 1] = n; });
  return result;
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
