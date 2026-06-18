// Narration (TTS) sanitization battery. Ensures the SPOKEN text never contains
// markdown/symbols/tokens that make ElevenLabs hiss ("sssss"), slur, or garble —
// while real speech is preserved. Run: node scripts/test-narration.ts
import { collapseRollMath, sanitizeForTts, hasSpeakableContent, sliceThroughRollRequest, expandRollRequestForSpeech, shouldSpeakTailChunk, pullNarrationChunks } from "../src/lib/narration.ts";
import { isTurnPromptSentence } from "../src/lib/turnPrompt.ts";

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

// ── shouldSpeakTailChunk — turn prompts & rolls always spoken; garble stubs dropped ──
truthy("tail: turn prompt (the bug) spoken", shouldSpeakTailChunk("Shmang, what do you do?"), true);
truthy("tail: short named prompt spoken", shouldSpeakTailChunk("Aria, what do you do?"), true);
truthy("tail: what's your move spoken", shouldSpeakTailChunk("Barnabus, what's your move?"), true);
truthy("tail: bare roll request spoken", shouldSpeakTailChunk("Roll a d20."), true);
truthy("tail: long sentence spoken", shouldSpeakTailChunk("The torch gutters and goes out."), true);
truthy("tail: tiny non-prompt stub dropped", shouldSpeakTailChunk("He left."), false);
truthy("tail: pure punctuation dropped", shouldSpeakTailChunk("..."), false);

// ── Round simulation — replays the ACTUAL sendToAI narration flow (streaming pull
//    → roll truncation → final flush) over many round-shaped DM responses, across
//    several streaming-chunk boundaries, and asserts the closing line (turn prompt
//    or roll request) is always voiced while the body is narrated and stubs drop.
//    This mirrors playing the campaign for many rounds without needing live auth. ──
const stripSystemLeaks = (s: string) => s.replace(/\[[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();

function simulateTurnNarration(full: string, feed: string[], suppress = false): string[] {
  const spoken: string[] = [];
  const enqueue = (t: string) => { const c = stripSystemLeaks(t || "").trim(); if (c) spoken.push(c); };
  let narBuf = "", narDone = false;
  for (const chunk of feed) {
    narBuf += chunk;
    if (narDone) continue;
    const { chunks: sents, remaining } = pullNarrationChunks(narBuf, false);
    let broke = false;
    for (const s of sents) {
      if (/\broll\s+a\s+d\d+\b/i.test(s)) {
        const rollClean = expandRollRequestForSpeech(sliceThroughRollRequest(s));
        if (rollClean && !(suppress && isTurnPromptSentence(rollClean))) enqueue(rollClean);
        narBuf = ""; narDone = true; broke = true; break;
      }
      if (suppress && isTurnPromptSentence(s)) continue;
      enqueue(s);
    }
    if (!narDone && !broke) narBuf = remaining;
  }
  // roll-truncation block
  const rollSentRe = /\broll\s+a\s+d\d+[^.!?\n]*[.!?]/gi;
  let lastRollEnd = -1, rm: RegExpExecArray | null;
  while ((rm = rollSentRe.exec(full)) !== null) lastRollEnd = rm.index + rm[0].length;
  if (lastRollEnd > 0) {
    if (!narDone) {
      const speakTail = expandRollRequestForSpeech(sliceThroughRollRequest(narBuf).trim());
      if (speakTail.length > 4 && !(suppress && isTurnPromptSentence(speakTail))) enqueue(speakTail);
    }
    narBuf = ""; narDone = true;
  }
  // final flush
  if (!narDone && narBuf.trim().length > 0) {
    const { chunks: tail } = pullNarrationChunks(narBuf, true);
    for (const s of tail) {
      if (suppress && isTurnPromptSentence(s)) continue;
      if (!shouldSpeakTailChunk(s)) continue;
      enqueue(expandRollRequestForSpeech(s));
    }
  }
  return spoken;
}

// Feed strategies: each must concatenate back to `full`, mimicking how the network
// stream can break a response at any boundary.
const feeds = (full: string): { name: string; feed: string[] }[] => [
  { name: "whole", feed: [full] },
  { name: "by-paragraph", feed: full.split(/(\n\n)/).filter(Boolean) },
  { name: "by-word", feed: full.split(/(\s+)/).filter(Boolean) },
  { name: "char-by-char", feed: [...full] },
  { name: "32-char", feed: full.match(/[\s\S]{1,32}/g) ?? [full] },
];

type Round = { name: string; text: string; expect: "prompt" | "roll"; bodyMustSpeak?: string };
const ROUNDS: Round[] = [
  { name: "screenshot: trunks → turn prompt", expect: "prompt", bodyMustSpeak: "weeps sap",
    text: "Cruder. And fresh — the exposed wood still weeps sap.\n\nThere are more. Three other trunks visible from here, each marked the same way, arranged in a rough circle.\n\nShmang, what do you do?" },
  { name: "standalone bare roll", expect: "roll",
    text: "Roll a d20." },
  { name: "narration + bare roll", expect: "roll", bodyMustSpeak: "lock clicks",
    text: "The lock clicks under your probe as the tumblers shift. Roll a d20." },
  { name: "narration + named roll", expect: "roll", bodyMustSpeak: "rune flares",
    text: "The rune flares hot against your open palm, light bleeding between your fingers. Shmang, roll a d20." },
  { name: "roll with trailing text DM shouldn't add", expect: "roll", bodyMustSpeak: "blade arcs",
    text: "The blade arcs toward the goblin's throat. Shmang, roll a d20. The strike lands for nine damage." },
  { name: "two paragraphs → what's your move", expect: "prompt", bodyMustSpeak: "corridor splits",
    text: "The corridor splits ahead, torchlight guttering against wet stone.\n\nSomething skitters in the dark beyond the left passage. Barnabus, what's your move?" },
  { name: "long narrative → turn prompt", expect: "prompt", bodyMustSpeak: "harbor",
    text: "The harbor falls quiet as the last gull wheels away over the gray water, and the smell of salt and rot rises off the pilings.\n\nAria, what do you do?" },
  { name: "single sentence + prompt", expect: "prompt", bodyMustSpeak: "door groans",
    text: "The iron door groans open onto a black stairwell. What do you do, Shmang?" },
];

let simChecks = 0;
for (const r of ROUNDS) {
  for (const { name: fname, feed } of feeds(r.text)) {
    const spoken = simulateTurnNarration(r.text, feed);
    const joined = spoken.join("  ⟂  ");
    const tag = `round "${r.name}" [${fname}]`;
    // 1. concatenation sanity — feed really reconstructs the response
    eq(`${tag}: feed reconstructs text`, feed.join(""), r.text);
    // 2. the closing line is voiced
    if (r.expect === "prompt") {
      truthy(`${tag}: turn prompt is voiced`, spoken.some(s => isTurnPromptSentence(s)), true);
    } else {
      truthy(`${tag}: roll request is voiced`, spoken.some(s => /\broll\s+a\s+d\d+/i.test(s)), true);
    }
    // 3. the body narration is voiced (no regression — we still speak the scene)
    if (r.bodyMustSpeak) {
      truthy(`${tag}: body "${r.bodyMustSpeak}" voiced`, joined.toLowerCase().includes(r.bodyMustSpeak), true);
    }
    // 4. nothing voiced is an empty/garbled stub
    truthy(`${tag}: no empty clips`, spoken.every(s => hasSpeakableContent(s) && s.length >= 4), true);
    simChecks++;
  }
}

// Bridge/round-completing responses (suppress=true) must NOT voice the trailing
// prompt — that prompt is stripped from the displayed text by reconciliation.
for (const { name: fname, feed } of feeds("The goblin crumples into the mud, its blade ringing against stone. Aria, what do you do?")) {
  const spoken = simulateTurnNarration("The goblin crumples into the mud, its blade ringing against stone. Aria, what do you do?", feed, true);
  truthy(`bridge [${fname}]: prompt suppressed`, spoken.some(s => isTurnPromptSentence(s)), false);
  truthy(`bridge [${fname}]: body still voiced`, spoken.join(" ").toLowerCase().includes("goblin crumples"), true);
}

console.log(`Round-narration simulation: ${simChecks} round/feed combinations exercised.`);

console.log(`\nNarration sanitization battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Spoken text is sanitized (no markdown/symbols/hiss triggers); real speech preserved.");
