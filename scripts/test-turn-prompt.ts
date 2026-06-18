// Round-end double-prompt regression battery. Simulates many round-completing
// DM messages (the "Msg1" that precedes reconciliation) and asserts the trailing
// turn-prompt is removed — so reconciliation becomes the SOLE next-turn prompt —
// while ordinary narration is preserved untouched. This is the deterministic
// stand-in for "playing through many rounds": it covers the message shapes that
// produce the bug regardless of which player/closer the model picks.
import { stripTrailingTurnPrompt, isTurnPromptSentence } from "../src/lib/turnPrompt.ts";

let pass = 0;
const fails: string[] = [];
const eq = (name: string, got: string, want: string) => {
  if (got === want) pass++;
  else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};
const unchanged = (name: string, text: string) => eq(name + " (unchanged)", stripTrailingTurnPrompt(text), text);

// ── The exact shapes from the bug screenshot ──
eq("screenshot: trailing 'What do you do, Barnabus?'",
  stripTrailingTurnPrompt("The golden light pulses again — and this time the harbor goes completely silent. A dockworker nearby drops his crate and runs.\n\nWhat do you do, Barnabus?"),
  "The golden light pulses again — and this time the harbor goes completely silent. A dockworker nearby drops his crate and runs.");
eq("screenshot: trailing 'Barnabus, what do you do?'",
  stripTrailingTurnPrompt("The shadow she casts is more observant than she is tonight.\n\nBarnabus, what do you do?"),
  "The shadow she casts is more observant than she is tonight.");

// ── Closer-phrase rotation the DM uses ──
eq("how do you respond",  stripTrailingTurnPrompt("The orc collapses in a heap. How do you respond, Aria?"), "The orc collapses in a heap.");
eq("what's your next move", stripTrailingTurnPrompt("Silence falls over the clearing. What's your next move, Kael?"), "Silence falls over the clearing.");
eq("the choice is yours", stripTrailingTurnPrompt("The door groans open to darkness. The choice is yours, Vex."), "The door groans open to darkness.");
eq("make your move",      stripTrailingTurnPrompt("Torches gutter in the sudden draft. Make your move, Bjorn."), "Torches gutter in the sudden draft.");
eq("you're up",           stripTrailingTurnPrompt("The bridge holds — barely. You're up, Aria."), "The bridge holds — barely.");
eq("what now",            stripTrailingTurnPrompt("Both bandits lie still. What now, Tiegan?"), "Both bandits lie still.");
eq("single-line + prompt", stripTrailingTurnPrompt("The lock clicks open. What do you do, Pookie?"), "The lock clicks open.");
eq("prompt then no trailing punctuation", stripTrailingTurnPrompt("Smoke curls toward the rafters. What will you do, Aria?"), "Smoke curls toward the rafters.");

// ── Must NOT strip: ordinary narration / non-prompts ──
unchanged("plain narration, no prompt", "The goblin crumples and the chamber falls quiet.");
unchanged("rhetorical prose with 'your move'", "The enemy general anticipates your move and shifts his line.");
unchanged("ends with a roll request", "Aria lunges at the cultist. Roll a d20.");
unchanged("narrative question, not a turn closer", "Was that a footstep echoing in the dark, or just the wind?");
unchanged("ends mid-scene description", "Rain hammers the deck as the ship lists hard to port.");

// ── Edge cases ──
eq("multi-paragraph body preserved", stripTrailingTurnPrompt("Paragraph one of the outcome.\n\nParagraph two with more detail.\n\nWhat do you do, Aria?"),
  "Paragraph one of the outcome.\n\nParagraph two with more detail.");
eq("trailing whitespace tolerated", stripTrailingTurnPrompt("The vault seals shut. You're up, Kael.   \n"), "The vault seals shut.");
// A message that is ONLY a prompt would strip to empty → keep original (never blank the message).
unchanged("prompt-only message kept", "What do you do, Aria?");

// isTurnPromptSentence — used to skip NARRATING a prompt that's stripped from text
const isPrompt = (name: string, s: string) => { if (isTurnPromptSentence(s)) pass++; else fails.push(`  ✗ expected turn-prompt: ${name} — ${JSON.stringify(s)}`); };
const notPrompt = (name: string, s: string) => { if (!isTurnPromptSentence(s)) pass++; else fails.push(`  ✗ expected NOT a turn-prompt: ${name} — ${JSON.stringify(s)}`); };
isPrompt("name-first prompt", "Barnabus, what do you do?");
isPrompt("name-last prompt", "What do you do, Aria?");
isPrompt("varied closer", "You're up, Kael.");
notPrompt("plain narration sentence", "The monument knocks back seven times, then falls still.");
notPrompt("narrative with 'your move' mid-clause", "The enemy general anticipates your move and repositions his line.");
notPrompt("dialogue, not a prompt", "\"Are you going to open the door, or shall we do this forever?\"");

// ── Coupling invariant (the held-narration fix depends on this) ──
// Narration HOLDS a trailing turn prompt and DROPS it iff this message becomes the
// bridge (reconciliation strips the prompt from the display). For that to be
// correct, the sentence the DISPLAY strips must be exactly what the narration layer
// classifies as a turn prompt — otherwise the voice and the screen disagree (the
// reported "spoke a prompt the green box doesn't show" bug). Verify they match: for
// each bridge message, the removed tail IS an isTurnPromptSentence.
const BRIDGE_MESSAGES = [
  "The crack splits wide. A black root tears free of the earth, sweeping across the clearing.\n\nBarnabus, what do you do?",
  "The young woman grabs Vi's arm. \"The seals are failing.\"\n\nWhat do you do, Barnabus?",
  "Both bandits lie still in the mud. What now, Tiegan?",
  "The vault seals shut behind you. You're up, Kael.",
  "Silence falls over the ruined hall. What's your next move, Aria?",
];
for (const msg of BRIDGE_MESSAGES) {
  const body = stripTrailingTurnPrompt(msg);
  if (body === msg) { fails.push(`  ✗ bridge tail not stripped: ${JSON.stringify(msg)}`); continue; }
  // The removed tail = everything after the kept body, cleaned of leading punctuation/space.
  const removed = msg.slice(body.length).replace(/^[\s.!?…"')\]]+/, "").trim();
  if (isTurnPromptSentence(removed)) pass++;
  else fails.push(`  ✗ stripped tail is NOT a turn-prompt sentence (display/narration would disagree): ${JSON.stringify(removed)}`);
}

console.log(`\nRound-end prompt de-dup battery: ${pass} checks passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Trailing turn-prompts stripped from round-completing messages; narration preserved.");
