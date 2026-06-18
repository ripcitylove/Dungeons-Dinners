// Narration (TTS) sanitization battery. Ensures the SPOKEN text never contains
// markdown/symbols/tokens that make ElevenLabs hiss ("sssss"), slur, or garble —
// while real speech is preserved. Run: node scripts/test-narration.ts
import { collapseRollMath, sanitizeForTts, hasSpeakableContent, sliceThroughRollRequest, expandRollRequestForSpeech } from "../src/lib/narration.ts";

let pass = 0;
const fails: string[] = [];
const eq = (name: string, got: string, want: string) => {
  if (got === want) pass++;
  else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};
const truthy = (name: string, v: boolean, want: boolean) => {
  if (v === want) pass++; else fails.push(`  ✗ ${name}: expected ${want}, got ${v}`);
};

// ── Roll math collapses to the total ──
eq("roll math screenshot", collapseRollMath("12 + 2 [Perception] = 14 — clear enough."), "14 — clear enough.");
eq("roll math no labels",  collapseRollMath("14 + 5 = 19 — hits AC 15!"), "19 — hits AC 15!");
eq("gold untouched",       collapseRollMath("You find 47 gold pieces."), "You find 47 gold pieces.");

// ── The reported bugs: *"…"* / **"…"** dialogue must lose BOTH the asterisks AND
//    the quote marks (quote-wrapped short lines trigger ElevenLabs yells/hiss). ──
eq("asterisk-wrapped dialogue",
  sanitizeForTts('*"He doesn\'t know what he\'s sitting on,"* Draeventhos adds. *"Or perhaps he does."*'),
  "He doesn't know what he's sitting on, Draeventhos adds. Or perhaps he does.");
eq("double-asterisk quoted line (yell bug)",
  sanitizeForTts('**"That was a demonstration."**'),
  "That was a demonstration.");
eq("double-asterisk quoted line 2",
  sanitizeForTts('**"I can hear you, you know."**'),
  "I can hear you, you know.");
eq("bold + italic markdown removed",
  sanitizeForTts("The **harbor** goes _completely_ silent."),
  "The harbor goes completely silent.");
eq("roll math inside narration spoken as total",
  sanitizeForTts("12 + 2 [Perception] = 14 — clear enough."),
  "14 — clear enough.");

// ── Artifacts that cause hiss/garble are removed ──
eq("emoji stripped", sanitizeForTts("You found a sword ⚔️!"), "You found a sword!");
eq("engine tag stripped", sanitizeForTts("The blade bites deep. [HP:Goblin:-9] The goblin reels."), "The blade bites deep. The goblin reels.");
eq("repeated bang collapsed", sanitizeForTts("Look out!!!"), "Look out!");
eq("ellipsis normalized", sanitizeForTts("Wait...... something moves."), "Wait… something moves.");
eq("curly quotes removed for speech", sanitizeForTts("“Hello,” she said."), "Hello, she said.");
eq("backticks/pipes/carets removed", sanitizeForTts("The rune reads `vex` | ^old^ magic."), "The rune reads vex old magic.");
eq("leading stray punctuation trimmed", sanitizeForTts("— and then the door creaks open."), "and then the door creaks open.");
eq("empty quote pair gone", sanitizeForTts('She nods. "" The silence holds.'), "She nods. The silence holds.");

// ── Real speech preserved (quotes dropped, words + apostrophes intact) ──
eq("plain narration unchanged", sanitizeForTts("The harbor noise fills the silence Draeventhos leaves behind."), "The harbor noise fills the silence Draeventhos leaves behind.");
eq("dialogue words kept, quotes dropped", sanitizeForTts('"Are you going to open the door, or shall we do this forever?"'), "Are you going to open the door, or shall we do this forever?");
eq("apostrophes kept", sanitizeForTts("He doesn't know what he's sitting on."), "He doesn't know what he's sitting on.");

// ── hasSpeakableContent gates out hiss-only chunks ──
truthy("lone quote not speakable", hasSpeakableContent(sanitizeForTts('*"')), false);
truthy("lone dash not speakable",  hasSpeakableContent(sanitizeForTts("—")), false);
truthy("punctuation-only not speakable", hasSpeakableContent(sanitizeForTts('..."')), false);
truthy("real sentence is speakable", hasSpeakableContent(sanitizeForTts("Or perhaps he does.")), true);
truthy("number-only is speakable", hasSpeakableContent(sanitizeForTts("14.")), true);

// ── sliceThroughRollRequest — narrate the roll request, drop post-roll text ──
eq("roll request alone is kept (the bug)", sliceThroughRollRequest("Shmang, roll a d20."), "Shmang, roll a d20.");
eq("narrate up to & including the roll, drop trailing", sliceThroughRollRequest("The symbol burns deep. Shmang, roll a d20. The blade then bites for 9."), "The symbol burns deep. Shmang, roll a d20.");
eq("roll with no trailing punctuation", sliceThroughRollRequest("Aria, roll a d20"), "Aria, roll a d20");
eq("no roll request -> unchanged", sliceThroughRollRequest("The door creaks open and the room falls silent."), "The door creaks open and the room falls silent.");

// ── expandRollRequestForSpeech — short bare roll requests get a fuller utterance ──
eq("bare short roll expanded (the bug)", expandRollRequestForSpeech("Roll a d20."), "Go ahead — roll a d20.");
eq("bare short roll, no period", expandRollRequestForSpeech("Roll a d6"), "Go ahead — roll a d6.");
eq("named roll already long -> unchanged", expandRollRequestForSpeech("Shmang, roll a d20."), "Shmang, roll a d20.");
eq("long narration -> unchanged", expandRollRequestForSpeech("The symbol burns deep. Shmang, roll a d20."), "The symbol burns deep. Shmang, roll a d20.");
eq("non-roll short text -> unchanged", expandRollRequestForSpeech("She nods."), "She nods.");
const expanded = expandRollRequestForSpeech("Roll a d100.");
truthy("expanded clears the 16-char narrate floor", expanded.length >= 16, true);

console.log(`\nNarration sanitization battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Spoken text is sanitized (no markdown/symbols/hiss triggers); real speech preserved.");
