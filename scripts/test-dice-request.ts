// Dice-type detection battery. The bug: "roll a d20" fell through the primary
// regex to a broad fallback that grabbed the FIRST "dN" anywhere in the prose —
// so a stray "d6" earlier in the message made the dice screen show a d6 instead
// of the requested d20. Run: node scripts/test-dice-request.ts
import { detectRequiredDieFromText } from "../src/lib/diceRequest.ts";

let pass = 0;
const fails: string[] = [];
const eq = (action: string, want: number | null) => {
  const got = detectRequiredDieFromText(action);
  if (got === want) pass++;
  else fails.push(`  ✗ ${JSON.stringify(action)} → expected ${want}, got ${got}`);
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

console.log(`\nDice-request detection battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ The die in the roll phrase wins; a stray earlier dN never overrides it.");
