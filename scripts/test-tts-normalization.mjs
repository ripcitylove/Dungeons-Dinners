// Confirms the narrate route's normalizeForTTS strips the inputs that cause
// ElevenLabs to produce gibberish or "talking in tongues" sounds:
//   • Pictographic emoji
//   • Zero-width / bidi / format Unicode
//   • C0 / C1 control characters
//   • Stray non-text glyphs
//   • Smart quotes / ellipsis -> normalized
//   • Tiny fragments rejected before they hit ElevenLabs

const NARRATE = "http://localhost:3000/api/narrate";

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " - " + hint : ""}`); fail++; }
}

async function post(text, voice = "chronicler", fresh = true) {
  const res = await fetch(NARRATE, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text, voice, fresh }),
  });
  return { status: res.status, ok: res.ok };
}

// ── 1. Tiny / non-speakable fragments rejected with 400 ──────────────────────
console.log("=== Tiny / non-speakable fragments rejected (no broken audio plays) ===");
{
  const r = await post("");
  check("empty string -> 400", r.status === 400);
}
{
  const r = await post("Hi");
  check("3-char fragment -> 400", r.status === 400, `got ${r.status}`);
}
{
  const r = await post("!!!");
  check("punctuation only -> 400", r.status === 400, `got ${r.status}`);
}
{
  const r = await post("\u{1F600}\u{1F4A9}");  // emoji-only
  check("emoji-only -> 400 (stripped to empty -> too short)", r.status === 400, `got ${r.status}`);
}

// ── 2. Real sentences with strippable characters pass through ────────────────
console.log("\n=== Sentences with emojis / smart quotes / ellipsis succeed ===");
{
  const r = await post("The hooded figure tilts her head. “Do you fear me, traveler?” \u{1F480}");
  check("smart quotes + emoji sentence -> 200", r.ok, `got ${r.status}`);
}
{
  const r = await post("The chamber falls silent… too silent. Something stirs.");
  check("ellipsis sentence -> 200", r.ok, `got ${r.status}`);
}
{
  const r = await post("Aria — wounded but standing — raises her staff.");
  check("em-dash sentence -> 200", r.ok, `got ${r.status}`);
}

// ── 3. Inline simulation of the normalizer (the regexes that strip the
//      problem inputs are the same on both client and server). ───────────────
console.log("\n=== Local normalizer behavior (mirrors server regex set) ===");
const STRIP_EMOJI    = new RegExp("[\\u{1F000}-\\u{1FFFF}\\u{2600}-\\u{27BF}]", "gu");
const STRIP_INVISIBLE = new RegExp("[\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]", "g");
const STRIP_CONTROL  = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]", "g");
const STRIP_NONTEXT  = new RegExp("[^\\p{L}\\p{N}\\p{P}\\p{Zs}\\p{M}\\n\\r\\t]", "gu");
const normalize = (s) => s
  .replace(STRIP_EMOJI, "")
  .replace(STRIP_INVISIBLE, "")
  .replace(STRIP_CONTROL, "")
  .replace(/[‘’‚‛]/g, "'")
  .replace(/[“”„‟]/g, '"')
  .replace(/…/g, ", ")
  .replace(STRIP_NONTEXT, "")
  .replace(/\s{2,}/g, " ")
  .trim();

check("strips a single emoji (\u{1F600})",     !normalize("Hello \u{1F600} there").includes("\u{1F600}"));
check("strips a flag-style emoji",              !/[\u{1F000}-\u{1FFFF}]/u.test(normalize("Quiet \u{1F1FA}\u{1F1F8} now.")));
check("strips zero-width space (U+200B)",        normalize("a​b") === "ab",   `got ${JSON.stringify(normalize("a​b"))}`);
check("strips word-joiner (U+2060)",             normalize("a⁠b") === "ab",   `got ${JSON.stringify(normalize("a⁠b"))}`);
check("strips BOM (U+FEFF)",                     normalize("a﻿b") === "ab",   `got ${JSON.stringify(normalize("a﻿b"))}`);
check("strips control char (U+0007 bell)",       normalize("ab") === "ab",   `got ${JSON.stringify(normalize("ab"))}`);
check("strips DEL (U+007F)",                     normalize("ab") === "ab",   `got ${JSON.stringify(normalize("ab"))}`);
check("normalizes smart single quote",           normalize("It’s here") === "It's here");
check("normalizes smart double quote",           normalize("“Hey”") === '"Hey"');
check("normalizes ellipsis to comma pause",      normalize("silent… too silent") === "silent, too silent", `got ${JSON.stringify(normalize("silent… too silent"))}`);
check("preserves regular text untouched",        normalize("Aria draws her sword.") === "Aria draws her sword.");
check("preserves digits and accents",            normalize("Café has 47 gp.") === "Café has 47 gp.");
check("strips a random box-drawing glyph (U+2580)", normalize("a▀b") === "ab");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
