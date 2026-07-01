// Dice-type detection battery. The bug: "roll a d20" fell through the primary
// regex to a broad fallback that grabbed the FIRST "dN" anywhere in the prose —
// so a stray "d6" earlier in the message made the dice screen show a d6 instead
// of the requested d20. Run: node scripts/test-dice-request.ts
import { detectRequiredDieFromText, detectRequiredRoll } from "../src/lib/diceRequest.ts";

let pass = 0;
const fails: string[] = [];
const eq = (action: string, want: number | null) => {
  const got = detectRequiredDieFromText(action);
  if (got === want) pass++;
  else fails.push(`  ✗ ${JSON.stringify(action)} → expected ${want}, got ${got}`);
};
// Full roll (sides + count) — the multi-die path for Sneak Attack, Divine Smite,
// multi-die heals/weapons/crits.
const eqRoll = (action: string, sides: number | null, count: number) => {
  const got = detectRequiredRoll(action);
  const okSides = (got?.sides ?? null) === sides;
  const okCount = sides === null ? true : (got?.count ?? 1) === count;
  if (okSides && okCount) pass++;
  else fails.push(`  ✗ ${JSON.stringify(action)} → expected ${sides === null ? "null" : `${count}d${sides}`}, got ${got ? `${got.count}d${got.sides}` : "null"}`);
};

// ── The reported bug: a stray earlier dN must NOT override the roll-phrase die ──
eq("The seal resists, wood burning hot. Vi, simultaneously — roll a d20.", 20);
eq("She drinks the 1d6 healing draught earlier. Now roll a d20.", 20);
eq("The d6 vial shatters at his feet. Barnabus, roll a d20!", 20);
eq("Guidance adds a d4. Make a Perception check — roll a d20.", 20);

// ── Explicit roll phrases (with the article 'a'/'an') ──
eq("Roll a d20.", 20);
eq("Roll a d6.", 6);
eq("Roll an d8.", 8);
eq("Aria, roll a d12 for me.", 12);
eq("roll 2d8", 8);
eq("roll d100", 100);
eq("Roll a d20 — make it count.", 20);

// ── Check/save/attack phrased without an explicit die → d20 ──
eq("Make a Strength check.", 20);
eq("Give me a Dexterity saving throw.", 20);
eq("Roll for initiative!", 20);
eq("Roll a stealth check.", 20);
eq("Make an attack roll against the goblin.", 20);

// ── Bare die mention with no roll phrase → that die (last resort) ──
eq("The damage is a d8 of fire.", 8);

// ── No roll requested → null ──
eq("The door creaks open and the room falls silent.", null);
eq("Barnabus, what do you do?", null);
eq("", null);

// ── Invalid die numbers are ignored ──
eq("roll a d7", null);      // d7 isn't a real die; no other phrase → null
eq("roll a d3 check", 20);  // d3 invalid, but "check" → d20

// ── Multi-die counts (sides + count together) ──
eqRoll("Roll a d20.", 20, 1);                              // to-hit stays single
eqRoll("Roll a d8.", 8, 1);                                // single-die damage
eqRoll("Roll 3d6 for your Sneak Attack.", 6, 3);           // rogue L5-6
eqRoll("Roll 6d6 for your Sneak Attack.", 6, 6);           // rogue L11+
eqRoll("Now roll 2d8 for your Divine Smite.", 8, 2);       // paladin 1st-level slot
eqRoll("Roll a d6 for your Hunter's Mark.", 6, 1);         // ranger +1d6
eqRoll("Roll 2d8.", 8, 2);                                 // crit longsword / upcast Cure Wounds
eqRoll("Roll 4d6.", 6, 4);                                 // crit greatsword
eqRoll("Roll a d10.", 10, 1);                              // Second Wind
eqRoll("Make a Strength check.", 20, 1);                   // check → single d20
eqRoll("The door creaks open.", null, 1);                  // no roll
eqRoll("Roll 99d6.", 6, 12);                               // clamp runaway counts to 12

// ── Saving throws — including BARE noun-phrase saves with no leading verb ──
// (the reported bug: clicking the dice button showed nothing because these
// resolved to no die type). All are d20; death saves are EXCLUDED (engine owns them).
eq("The poison courses through you — Constitution save.", 20);
eq("The ground gives way — DEX saving throw to catch yourself.", 20);
eq("A wave of fear washes over you. Wisdom saving throw.", 20);
eq("The trap triggers — saving throw!", 20);
eq("Perception check to spot the ambush.", 20);
eq("Aria, make a Wisdom save.", 20);
eq("Roll a d20 for your DEX save.", 20);
eq("You must save the villagers from the fire.", null);  // ordinary prose must NOT trip
eq("Kael, make a death saving throw.", null);             // death save → engine button, not the roller
eq("You're dying — death save.", null);

console.log(`\nDice-request detection battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ The die in the roll phrase wins; a stray earlier dN never overrides it.");
