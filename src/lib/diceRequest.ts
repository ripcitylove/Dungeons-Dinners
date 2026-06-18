// Detects which die the DM's narrative is asking the player to roll.
//
// The bug this fixes: a message like "...the d6 vial shatters. Vi, roll a d20."
// was resolving to a d6 because detection grabbed the FIRST "dN" appearing
// anywhere in the prose. The die named in the actual ROLL PHRASE ("roll a d20")
// must win over any incidental "dN" mentioned earlier in the sentence.
//
// Priority:
//   1. The die in an explicit roll phrase: "roll a d20", "roll 2d8", "roll a d6 check".
//   2. A check/save/attack/initiative phrased without a die → d20.
//   3. Last resort: a bare "dN" anywhere in the text.

const ALLOWED = [4, 6, 8, 10, 12, 20, 100];

// "roll" / "rolls" then up to 3 connector words (a, an, me, your, for, with…)
// then an optional dice count and "dN". The {0,3} words let "roll a d20" and
// "roll me a perception d20" match while keeping the die tied to the roll verb.
const ROLL_PHRASE = /\broll(?:s)?\s+(?:[a-z]+\s+){0,3}?(?:\d+)?d(\d+)\b/i;
const BARE_DIE    = /\bd(\d+)\b/i;

const CHECK_D20: RegExp[] = [
  /\broll\s+(?:a\s+)?(?:\w[\w\s]{0,20})?\b(?:check|save|saving throw|attack roll|attack|initiative)\b/i,
  /\bmake\s+(?:a\s+)?(?:\w[\w\s]{0,20})?\b(?:check|save|saving throw|roll)\b/i,
  /\bgive me\s+(?:a\s+)?(?:\w[\w\s]{0,20})?\b(?:check|save|saving throw|roll)\b/i,
  /\broll\s+(?:for\s+)?(?:initiative|stealth|perception|athletics|acrobatics|persuasion|deception|insight|investigation|arcana|history|nature|religion|survival|medicine|performance|intimidation)\b/i,
];

export function detectRequiredDieFromText(narrative: string): number | null {
  if (!narrative) return null;
  // 1. The die named in the roll phrase wins.
  const phrase = ROLL_PHRASE.exec(narrative);
  if (phrase) {
    const n = parseInt(phrase[1], 10);
    if (ALLOWED.includes(n)) return n;
  }
  // 2. A check/save/attack/initiative phrased without an explicit die → d20.
  if (CHECK_D20.some(p => p.test(narrative))) return 20;
  // 3. Last resort: any bare "dN" in the text.
  const bare = BARE_DIE.exec(narrative);
  if (bare) {
    const n = parseInt(bare[1], 10);
    if (ALLOWED.includes(n)) return n;
  }
  return null;
}
