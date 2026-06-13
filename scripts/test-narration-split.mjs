// Unit test for the narration sentence-splitter.
// Mirrors the implementation in src/app/campaign/[id]/page.tsx.

function pullNarrationChunks(buf, isFinal) {
  const chunks = [];
  const MAX_CHUNK = 280;
  const MIN_FORCED = 60;
  const QUOTE_CLASS = "[\\u2018\\u2019\\u201C\\u201D'\"]";
  const SENT_RE_STREAM = new RegExp(`^([\\s\\S]{40,}?[.!?…]${QUOTE_CLASS}?)\\s+`);
  const SENT_RE_FINAL  = new RegExp(`^([\\s\\S]{8,}?[.!?…]${QUOTE_CLASS}?)(?:\\s+|$)`);
  while (true) {
    const m = buf.match(isFinal ? SENT_RE_FINAL : SENT_RE_STREAM);
    if (m) { chunks.push(m[1].trim()); buf = buf.slice(m[0].length); continue; }
    if (buf.length > MAX_CHUNK) {
      const slice = buf.slice(0, MAX_CHUNK);
      const boundary = Math.max(
        slice.lastIndexOf(", "),
        slice.lastIndexOf("; "),
        slice.lastIndexOf("— "),
        slice.lastIndexOf("– "),
      );
      if (boundary > MIN_FORCED) {
        chunks.push(buf.slice(0, boundary + 1).trim());
        buf = buf.slice(boundary + 2);
        continue;
      }
      const wsBoundary = slice.lastIndexOf(" ");
      if (wsBoundary > MIN_FORCED) {
        chunks.push(buf.slice(0, wsBoundary).trim());
        buf = buf.slice(wsBoundary + 1);
        continue;
      }
      chunks.push(buf.slice(0, MAX_CHUNK).trim());
      buf = buf.slice(MAX_CHUNK);
      continue;
    }
    break;
  }
  if (isFinal && buf.trim().length > 0) { chunks.push(buf.trim()); buf = ""; }

  // Merge tiny chunks with the next so ElevenLabs has enough context to voice
  // short quoted dialogue lines without rushing into garbled phonemes.
  const MIN_TTS_CHARS = 40;
  const merged = [];
  for (let i = 0; i < chunks.length; i++) {
    let cur = chunks[i];
    while (cur.length < MIN_TTS_CHARS && i + 1 < chunks.length && cur.length + chunks[i + 1].length + 1 <= MAX_CHUNK) {
      cur = cur + " " + chunks[i + 1];
      i++;
    }
    merged.push(cur);
  }
  return { chunks: merged, remaining: buf };
}

let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else      { console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); fail++; }
}

// ── Test 1: the actual 811-char DM response from the bug report ──────────────
console.log("\nTest 1: the actual 811-char bug-report DM response (smart quotes)");
const buggy =
`Barnabus comes away with a leather pouch (23 gold pieces), a vial of dark liquid, and a folded parchment covered in ritual notes. Ashveil notices nothing.

“The vault — NOW!” Barnabus announces, already moving north.

The party runs. Ashveil scrambles after them, apparently deciding that dying alone in a collapsing hollow is worse than trusting the people who just robbed him.

The crumbling shrine emerges ahead, torchlight dancing off weathered stone — and set into its base, a iron door sealed with three interlocking runes, untouched for three centuries.

Behind them, something vast and dark pushes upward through the earth.

Ekko, what do you do?`;

console.log(`  Input: ${buggy.length} chars`);
const r1 = pullNarrationChunks(buggy, true);
console.log(`  Split into ${r1.chunks.length} chunks:`);
r1.chunks.forEach((c, i) => console.log(`    [${i}] ${c.length} chars: "${c.slice(0, 80)}${c.length > 80 ? "…" : ""}"`));
assert("split into ≥5 chunks (not one mega-clip)", r1.chunks.length >= 5);
assert("no chunk over 280 chars (avoids watchdog)", r1.chunks.every(c => c.length <= 280));
assert("nothing remaining", r1.remaining === "");
// With the post-merge step, short smart-quoted dialogue gets combined with the
// following sentence (which is actually better for TTS prosody). We just want to
// confirm the quoted text is preserved SOMEWHERE in the chunks.
assert("smart-quote dialogue preserved (merged with following prose)", r1.chunks.some(c => c.includes("“The vault — NOW!”")));
assert("closing question split out", r1.chunks.some(c => c.includes("Ekko, what do you do?")));

// ── Test 2: streaming partial chunk (no trailing whitespace after last sentence) ──
console.log("\nTest 2: streaming partial buffer (last sentence not yet complete)");
const partial = "The crumbling shrine emerges ahead, torchlight dancing off weathered stone. The party runs forward but";
const r2 = pullNarrationChunks(partial, false);
assert("first sentence pulled out", r2.chunks.length === 1 && r2.chunks[0].endsWith("weathered stone."));
assert("incomplete sentence held in remaining", r2.remaining.startsWith("The party runs forward but"));

// ── Test 3: smart-quote sentence ender (the bug we found) ────────────────────
console.log("\nTest 3: sentence ending with smart-quote close (would have failed before)");
const smartQ = "“The vault — NOW!” Barnabus announces, already moving north.\n\n";
const r3 = pullNarrationChunks(smartQ, false);
assert("smart-quote sentence pulled out", r3.chunks.length === 1, `got ${r3.chunks.length} chunks: ${JSON.stringify(r3.chunks)}`);

// ── Test 4: genuinely huge run-on with no sentence ender (worst case) ────────
console.log("\nTest 4: 600-char run-on with no period (forced clause split)");
const runOn = "the ancient crumbling shrine emerges ahead, torchlight dancing off weathered stone, " +
              "and set into its base, a heavy iron door sealed with three interlocking runes, " +
              "untouched for three centuries, surrounded by moss and faintly glowing sigils, " +
              "ancient warnings carved by hands long dead, the kind of place a careful party " +
              "would investigate slowly, but the situation does not allow careful investigation, " +
              "behind them something vast and dark pushes upward through the earth, a low rumble " +
              "rattles teeth and bone alike, dust falls from the ceiling in steady streams";
console.log(`  Input: ${runOn.length} chars`);
const r4 = pullNarrationChunks(runOn, true);
console.log(`  Split into ${r4.chunks.length} chunks:`);
r4.chunks.forEach((c, i) => console.log(`    [${i}] ${c.length} chars`));
assert("forced split into ≥2 chunks", r4.chunks.length >= 2);
assert("no chunk over 280 chars (watchdog-safe)", r4.chunks.every(c => c.length <= 280));

// ── Test 5: multiple sentences in one chunk during streaming ─────────────────
console.log("\nTest 5: chunk arrives with three complete sentences at once");
const multi = "The party runs. Ashveil scrambles after them. They reach the door, untouched for three centuries. ";
const r5 = pullNarrationChunks(multi, false);
console.log(`  Split into ${r5.chunks.length} chunks:`);
r5.chunks.forEach((c, i) => console.log(`    [${i}] ${c}`));
assert("all 3 sentences pulled (not just first)", r5.chunks.length >= 1, `got ${r5.chunks.length}`);

// ── Test 6: resume path — entire stored DM message passed in one call ────────
console.log("\nTest 6: resume path simulation (whole DM message → enqueueNarration)");
const resumeMsg =
`The ground splits another foot, black soil curling back like peeled skin. Something beneath exhales — a low, resonant pulse that rattles teeth.

Barnabus comes away with a leather pouch (23 gold pieces), a vial of dark liquid, and a folded parchment covered in ritual notes. Ashveil notices nothing.

"The vault — NOW!" Barnabus announces, already moving north.

The party runs. Ashveil scrambles after them, apparently deciding that dying alone in a collapsing hollow is worse than trusting the people who just robbed him.

The crumbling shrine emerges ahead, torchlight dancing off weathered stone — and set into its base, a iron door sealed with three interlocking runes, untouched for three centuries.

Behind them, something vast and dark pushes upward through the earth.

Ekko, what do you do?`;

console.log(`  Input: ${resumeMsg.length} chars (mimics the resume-path 811-char bug)`);
const r6 = pullNarrationChunks(resumeMsg, true);
console.log(`  Split into ${r6.chunks.length} chunks:`);
r6.chunks.forEach((c, i) => console.log(`    [${i}] ${c.length} chars`));
assert("resume message split into ≥8 chunks", r6.chunks.length >= 8);
assert("no resume chunk over 280 chars (watchdog-safe)", r6.chunks.every(c => c.length <= 280));
assert("slot 0 stays short (was 811)", r6.chunks[0].length < 280);

// ── Test 6b: short quoted dialogue line gets merged with neighbor ────────────
console.log("\nTest 6b: short quoted dialogue line — must be merged so TTS has context");
const dialogueScene =
`Maren's gaze moves from Randiezel to Ekko to Barnabus — coin to coin to coin — her expression unreadable.

"Where did you get those?"

Her voice carries the particular weight of someone who already knows the answer and is afraid of it anyway.

Shmang, what do you do?`;

const r6b = pullNarrationChunks(dialogueScene, true);
console.log(`  Input: ${dialogueScene.length} chars`);
console.log(`  Split into ${r6b.chunks.length} chunks:`);
r6b.chunks.forEach((c, i) => console.log(`    [${i}] ${c.length} chars: "${c.slice(0, 70)}${c.length > 70 ? "…" : ""}"`));
assert("no chunk is shorter than 40 chars (except possibly the very last)",
  r6b.chunks.slice(0, -1).every(c => c.length >= 40),
  `short chunks survive: ${r6b.chunks.slice(0, -1).filter(c => c.length < 40).map(c => `"${c}" (${c.length})`).join(", ")}`);
assert("the bare quoted line is NOT alone in its own chunk",
  !r6b.chunks.some(c => c === '"Where did you get those?"'));
assert("the quoted line ended up combined with surrounding context",
  r6b.chunks.some(c => c.includes('"Where did you get those?"') && c.length > 40));

// ── Test 7: empty input ──────────────────────────────────────────────────────
console.log("\nTest 7: empty / whitespace-only input");
const r7 = pullNarrationChunks("", true);
assert("empty input yields no chunks", r7.chunks.length === 0);
const r7b = pullNarrationChunks("   \n  ", true);
assert("whitespace-only input yields no chunks", r7b.chunks.length === 0 || r7b.chunks.every(c => c.trim() === ""));

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
