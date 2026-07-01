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
const MAX_COUNT = 12;   // safety clamp — no legit prompt rolls more than 12 like dice at once

// "roll" / "rolls" then up to 3 connector words (a, an, me, your, for, with…)
// then an optional dice COUNT and "dN". The {0,3} words let "roll a d20" and
// "roll me a perception d20" match while keeping the die tied to the roll verb.
// Group 1 = optional count (e.g. the "3" in "roll 3d6"), group 2 = die sides.
const ROLL_PHRASE = /\broll(?:s)?\s+(?:[a-z]+\s+){0,3}?(\d+)?d(\d+)\b/i;
const BARE_DIE    = /\b(\d+)?d(\d+)\b/i;

const CHECK_D20: RegExp[] = [
  /\broll\s+(?:a\s+)?(?:\w[\w\s]{0,20})?\b(?:check|save|saving throw|attack roll|attack|initiative)\b/i,
  /\bmake\s+(?:a\s+)?(?:\w[\w\s]{0,20})?\b(?:check|save|saving throw|roll)\b/i,
  /\bgive me\s+(?:a\s+)?(?:\w[\w\s]{0,20})?\b(?:check|save|saving throw|roll)\b/i,
  /\broll\s+(?:for\s+)?(?:initiative|stealth|perception|athletics|acrobatics|persuasion|deception|insight|investigation|arcana|history|nature|religion|survival|medicine|performance|intimidation)\b/i,
  // BARE NOUN-PHRASE saves/checks with NO leading verb — the DM often calls for a
  // save this way ("Constitution save.", "Wisdom saving throw.", "DEX saving throw
  // to catch yourself"). Without these the die type never resolves and the roller
  // opens empty / force-closes, so the player can't roll their save (the reported bug).
  // "saving throw" is unambiguously a d20; a bare "save"/"check" must be qualified by
  // an ability or a named skill so ordinary prose ("save the villagers", "check the
  // door") never trips it. Death saves are excluded earlier — the engine's dedicated
  // death-save button owns those, not this generic roller.
  /\bsaving throw\b/i,
  /\b(?:str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma)\s+save\b/i,
  /\b(?:ability|skill)\s+check\b/i,
  /\b(?:str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma|perception|stealth|athletics|acrobatics|persuasion|deception|insight|investigation|arcana|history|nature|religion|survival|medicine|performance|intimidation|sleight of hand|animal handling)\s+check\b/i,
];

export type RequiredRoll = { sides: number; count: number };

const clampCount = (raw: string | undefined): number => {
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_COUNT, n);
};

// Detects the full roll the DM is asking for: the die SIDES and how MANY of them
// (e.g. "roll 3d6 for your Sneak Attack" → { sides: 6, count: 3 }). A plain
// "roll a d20" (attack, save, check) is always count 1. Bonus-damage dice and
// multi-die heals are the reason count exists — the roller throws them together.
export function detectRequiredRoll(narrative: string): RequiredRoll | null {
  if (!narrative) return null;
  // 0. DEATH saving throws are NOT a generic roll — the engine's dedicated
  //    death-save button (deterministic adjudication) owns them. Never let a
  //    "death saving throw" announcement open the ordinary dice roller, or the
  //    player would roll a plain d20 that bypasses the death-save logic.
  if (/\bdeath\s+sav(?:e|es|ing)?\b/i.test(narrative)) return null;
  // 1. The die named in the roll phrase wins — carry its count too.
  const phrase = ROLL_PHRASE.exec(narrative);
  if (phrase) {
    const sides = parseInt(phrase[2], 10);
    if (ALLOWED.includes(sides)) return { sides, count: clampCount(phrase[1]) };
  }
  // 2. A check/save/attack/initiative phrased without an explicit die → single d20.
  if (CHECK_D20.some(p => p.test(narrative))) return { sides: 20, count: 1 };
  // 3. Last resort: any bare "NdN" in the text.
  const bare = BARE_DIE.exec(narrative);
  if (bare) {
    const sides = parseInt(bare[2], 10);
    if (ALLOWED.includes(sides)) return { sides, count: clampCount(bare[1]) };
  }
  return null;
}

// Back-compat helper — the die sides only (count ignored). Kept for callers/tests
// that only care which die face is required.
export function detectRequiredDieFromText(narrative: string): number | null {
  return detectRequiredRoll(narrative)?.sides ?? null;
}
