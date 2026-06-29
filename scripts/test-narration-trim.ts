// Verifies the mid-sentence truncation guard: a response cut off at the token
// ceiling must never be shown/spoken with a dangling, unfinished sentence.
// Run: `npx tsx scripts/test-narration-trim.ts`
import { endsOnCompleteSentence, lastCompleteSentence, trimSavedDangling } from "../src/lib/narrationTrim.ts";

type Case = { text: string; expect: string; note?: string };

const CASES: Case[] = [
  // THE BUG: cut off mid-thought → trim to last complete sentence.
  { text: "The water is rising. Sera hasn't stopped moving toward", expect: "The water is rising.", note: "reported screenshot" },
  { text: "The orc roars and charges. Its axe comes down hard and", expect: "The orc roars and charges.", note: "trailing conjunction" },
  { text: "She steps back, eyes narrowing. \"You shouldn't have", expect: "She steps back, eyes narrowing.", note: "cut inside a quote" },
  // Already complete → unchanged (whitespace trimmed).
  { text: "You enter the hall. Torches gutter low.", expect: "You enter the hall. Torches gutter low.", note: "ends clean" },
  { text: "What do you do, Minny?", expect: "What do you do, Minny?", note: "question end" },
  { text: "The blade sings — and bites deep!", expect: "The blade sings — and bites deep!", note: "exclamation" },
  { text: "It trails off into the dark…", expect: "It trails off into the dark…", note: "ellipsis is a complete end" },
  { text: "He whispers, \"Run.\"", expect: "He whispers, \"Run.\"", note: "closing quote after period" },
  { text: "Narration line.   ", expect: "Narration line.", note: "trailing whitespace trimmed" },
  // No complete sentence at all → "" (caller treats as degenerate / retry).
  { text: "Sera hasn't stopped moving toward", expect: "", note: "single unfinished fragment" },
];

let pass = 0;
const failures: string[] = [];
for (const c of CASES) {
  // The page keeps the original (for the degenerate-retry path) only when there's NO
  // complete sentence; otherwise it commits lastCompleteSentence(). We assert the trim.
  const got = endsOnCompleteSentence(c.text) ? c.text.replace(/\s+$/, "") : lastCompleteSentence(c.text);
  if (got === c.expect) pass++;
  else failures.push(`  expected ${JSON.stringify(c.expect)} got ${JSON.stringify(got)}${c.note ? `  (${c.note})` : ""}`);
}

// ── trimSavedDangling: healing already-saved history messages on resume ──
let savedPass = 0;
const savedFail: string[] = [];
const sCheck = (input: string, expect: string, note?: string) => {
  const got = trimSavedDangling(input);
  if (got === expect) savedPass++;
  else savedFail.push(`  expected ${JSON.stringify(expect)} got ${JSON.stringify(got)}${note ? `  (${note})` : ""}`);
};
sCheck("The water is rising. Sera hasn't stopped moving toward", "The water is rising.", "reported truncation");
sCheck("[RECAP]\n\nThe room is cold. He turns toward", "[RECAP]\n\nThe room is cold.", "recap truncation");
sCheck("You enter the hall. Torches gutter.", "You enter the hall. Torches gutter.", "complete → unchanged");
sCheck("What do you do, Kael?", "What do you do, Kael?", "question → unchanged");
sCheck("She smiles warmly. [NPC:Mira:a kind innkeeper]", "She smiles warmly. [NPC:Mira:a kind innkeeper]", "ends in tag → unchanged");
sCheck("He vanishes into the mist…", "He vanishes into the mist…", "ellipsis → unchanged");
sCheck("Bound Woman tugs at her ropes", "Bound Woman tugs at her ropes", "no complete sentence → leave as-is");

console.log(`\nNarration-trim battery: ${pass}/${CASES.length} passed.`);
console.log(`Saved-message heal battery: ${savedPass}/${savedPass + savedFail.length} passed.`);
if (failures.length || savedFail.length) {
  console.log(`\nFAILURES:`);
  console.log([...failures, ...savedFail].join("\n"));
  process.exitCode = 1;
} else {
  console.log("✓ Mid-sentence truncations are trimmed (new responses + resumed saved history).");
}
