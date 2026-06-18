// Turn-addressee detection battery. The bug: "Randiezel, Ekko is bleeding out at
// your feet — what do you do?" handed the turn to Ekko (latest name before the
// prompt) instead of the vocative addressee Randiezel — so on resume the "Acting"
// highlight was on the wrong player. Run: node scripts/test-turn-addressee.ts
import { detectTurnAddressee } from "../src/lib/turnAddressee.ts";

const PARTY = ["Ekko", "Randiezel", "Vi"];
let pass = 0;
const fails: string[] = [];
const eq = (text: string, want: string | null, party = PARTY) => {
  const got = detectTurnAddressee(text, party);
  if (got === want) pass++;
  else fails.push(`  ✗ ${JSON.stringify(text)}\n      expected ${want}, got ${got}`);
};

// ── The reported bug + close variants: vocative addressee wins over a non-vocative
//    name sitting closer to the prompt ──
eq("Randiezel, Ekko is bleeding out at your feet — what do you do?", "Randiezel");
eq("Vi, Randiezel slumps against the tree — what do you do?", "Vi");
eq("Randiezel, the seal cracks as Ekko collapses. What do you do?", "Randiezel");
eq("Ekko, Vi screams as the root lashes out — what's your move?", "Ekko");

// ── Standard leading vocative ──
eq("The chamber falls silent. Randiezel, what do you do?", "Randiezel");
eq("Ekko, what will you do?", "Ekko");

// ── Trailing vocative ──
eq("The bridge groans under the weight. What do you do, Vi?", "Vi");
eq("You're up, Randiezel.", "Randiezel");

// ── Third-person / yes-no ──
eq("What does Ekko do as the smoke clears?", "Ekko");
eq("Does Randiezel press the attack?", "Randiezel");

// ── No prompt → null ──
eq("Ekko and Randiezel stare at the ruined altar in silence.", null);
eq("The forest god stirs beneath the seal.", null);

// ── Only one party name present + prompt ──
eq("Smoke fills the clearing. Randiezel, what's your next move?", "Randiezel");

// ── Mentioned-but-not-addressed: a name in prose, the addressee elsewhere ──
eq("Ekko lies unconscious. Vi, what do you do?", "Vi");
eq("The cultist eyes Randiezel warily. Vi, how do you respond?", "Vi");

console.log(`\nTurn-addressee detection battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ The vocative addressee wins; a nearer non-addressed name never steals the turn.");
