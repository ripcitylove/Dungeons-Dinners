// Maps a player's free-text action to the D&D 5e skill/ability the check should
// use, so the DM stops mis-assigning checks (e.g. an "investigate the glyph"
// action being resolved as an Acrobatics check). Used to pass a SUGGESTED CHECK
// hint to the DM; unit-tested in scripts/test-skill-check.ts.

export const SKILL_ABILITY: Record<string, string> = {
  Athletics: "STR",
  Acrobatics: "DEX", "Sleight of Hand": "DEX", Stealth: "DEX",
  Arcana: "INT", History: "INT", Investigation: "INT", Nature: "INT", Religion: "INT",
  "Animal Handling": "WIS", Insight: "WIS", Medicine: "WIS", Perception: "WIS", Survival: "WIS",
  Deception: "CHA", Intimidation: "CHA", Performance: "CHA", Persuasion: "CHA",
};

// Ordered keyword → skill rules. FIRST match wins, so more specific / physical
// rules are listed before generic ones. Word-boundary matched, case-insensitive.
// Anything not matched returns null → the DM chooses, guided by the prompt's
// action→skill rules.
const RULES: { skill: string; re: RegExp }[] = [
  // Physical (must come before social/mental so "force the door" → Athletics, etc.)
  { skill: "Athletics",       re: /\b(climb(?:ing|s)?|swim(?:ming|s)?|jump(?:ing|s)?|leap(?:ing|s|t)?|force\s+(?:open|the|it|a)|pry\s+open|shove(?:s|d)?|lift(?:s|ing)?|haul(?:s|ing)?|drag(?:s|ging)?|break\s+(?:down|open)|smash\s+(?:open|through)|push\s+(?:open|through)|hoist|wrestle|grapple(?:s|d)?)\b/i },
  { skill: "Acrobatics",      re: /\b(balanc(?:e|ing)|tumbl(?:e|ing)|somersault|flip(?:s|ping)?|vault(?:s|ing)?|cartwheel|tightrope|squeeze\s+through|slip\s+free|wriggle|dodge\s+(?:past|through|under)|roll\s+(?:under|past|aside))\b/i },
  { skill: "Stealth",         re: /\b(sneak(?:s|ing)?|stealth|hide(?:s|)?|hiding|creep(?:s|ing)?|slip\s+(?:past|by|behind)|skulk|prowl|tiptoe|stay\s+hidden|move\s+silently|conceal\s+(?:myself|himself|herself|themselves))\b/i },
  { skill: "Sleight of Hand", re: /\b(pickpocket|pick\s+(?:his|her|their|the)\s+pocket|palm(?:s|ing)?|sleight|filch|snatch\s+(?:the|a|his|her)|swipe\s+(?:the|a)|plant\s+(?:the|a)|conceal\s+the\s+\w+\s+(?:on|in))\b/i },
  // Mental
  { skill: "Investigation",   re: /\b(investigat(?:e|ing|es)|examin(?:e|ing|es)|inspect(?:s|ing)?|search(?:es|ing)?|study(?:ing)?|studies|scrutin(?:ize|ise|izing)|decipher(?:s|ing)?|analyz(?:e|ing|es)|look\s+for\s+(?:clues|traps|tracks)|comb\s+through|pore\s+over|figure\s+out\s+how)\b/i },
  { skill: "Arcana",          re: /\b(arcana|identif(?:y|ying)\s+(?:the\s+)?(?:spell|magic|enchantment|rune|glyph|sigil)|recall\s+(?:arcane|magic)|what\s+magic|magical\s+(?:theory|knowledge)|detect\s+magic\s+lore)\b/i },
  { skill: "History",         re: /\b(history|recall\s+(?:what\s+i\s+know|lore|the\s+legend)|remember\s+(?:the|any)\s+(?:tale|legend|story|event)|recogniz(?:e|ing)\s+the\s+(?:crest|heraldry|symbol))\b/i },
  { skill: "Religion",        re: /\b(religion|holy\s+symbol|recall\s+.*\b(?:god|deity|divine|undead|ritual)|identif(?:y|ying)\s+the\s+(?:deity|god|undead))\b/i },
  { skill: "Nature",          re: /\b(identify\s+the\s+(?:plant|animal|beast|tracks|terrain)|recall\s+.*\b(?:plant|animal|weather|terrain)|forage|naturalist)\b/i },
  { skill: "Medicine",        re: /\b(diagnos(?:e|ing)|treat\s+(?:the\s+)?(?:wound(?:ed)?|injur(?:y|ed|ies)|sick|patient)|stabiliz(?:e|ing)|first\s+aid|tend\s+(?:to\s+)?(?:the|his|her|their)\s+(?:wound|injur)|check\s+(?:for\s+)?(?:a\s+)?pulse)\b/i },
  { skill: "Survival",        re: /\b(track(?:s|ing)?\b|follow\s+the\s+(?:tracks|trail)|navigat(?:e|ing)|forage|hunt(?:s|ing)?|find\s+(?:the\s+)?way|read\s+the\s+(?:weather|terrain))\b/i },
  { skill: "Perception",      re: /\b(perceiv(?:e|ing)|notice|spot(?:s|ting)?|listen(?:s|ing)?\b|spy|peek|peer\s+(?:into|through|around)|scan\s+(?:the|for)|look\s+around|keep\s+watch|glance\s+(?:around|about)|watch\s+for|smell|sniff|check\s+(?:the\s+|this\s+|that\s+|my\s+|our\s+|around\s+)?(?:area|ground|surroundings|room|chamber|floor|perimeter|clearing|site|scene)|footprints?|boot\s*prints?|paw\s*prints?|hoof\s*prints?|signs?\s+of\s+(?:passage|struggle|activity|movement|someone|something|recent|disturbance|life)|recent\s+activity|look\s+for\s+(?:footprints|prints|signs|disturbance|movement))\b/i },
  { skill: "Insight",         re: /\b(insight|read\s+(?:his|her|their|the)\s+(?:face|expression|intent|mood)|sense\s+(?:his|her|their)?\s*motive|gauge\s+(?:his|her|their)|tell\s+if\s+(?:he|she|they)\s+(?:is|are)\s+lying|judge\s+(?:his|her|their)\s+sincerity)\b/i },
  { skill: "Animal Handling", re: /\b(calm\s+(?:the\s+)?(?:beast|animal|horse|dog|creature)|soothe\s+the\s+(?:beast|animal|horse)|tame|handle\s+the\s+(?:beast|animal)|ride\s+the|spur\s+(?:the|my)\s+(?:horse|mount))\b/i },
  // Social
  { skill: "Persuasion",      re: /\b(persuad(?:e|ing)|convinc(?:e|ing)|plead(?:s|ing)?|negotiat(?:e|ing)|reason\s+with|appeal\s+to|talk\s+(?:him|her|them)\s+(?:into|down)|win\s+(?:him|her|them)\s+over)\b/i },
  { skill: "Deception",       re: /\b(deceiv(?:e|ing)|\blie\b|lying|bluff(?:s|ing)?|trick(?:s|ing)?|mislead|feint(?:s|ing)?|disguise\s+my|pretend(?:s|ing)?|fake(?:s|ing)?\s+|con\s+(?:him|her|them))\b/i },
  { skill: "Intimidation",    re: /\b(intimidat(?:e|ing)|threaten(?:s|ing)?|menac(?:e|ing)|scare(?:s|)?|coerce|browbeat|bully|loom\s+over|demand\s+(?:answers|that))\b/i },
  { skill: "Performance",     re: /\b(perform(?:s|ing)?\b|\bsing(?:s|ing)?\b|\bdance(?:s|d)?\b|play\s+(?:a|the|my)\s+(?:lute|song|tune|instrument)|recite|entertain|juggl)\b/i },
];

export type SkillCheck = { skill: string; ability: string };

/** Infers the 5e skill/ability for a free-text action, or null if ambiguous. */
export function inferSkillCheck(action: string): SkillCheck | null {
  if (!action) return null;
  for (const { skill, re } of RULES) {
    if (re.test(action)) return { skill, ability: SKILL_ABILITY[skill] };
  }
  return null;
}
