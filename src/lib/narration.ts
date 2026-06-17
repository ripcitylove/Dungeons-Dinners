// Narration (TTS) text preparation. The DISPLAYED chat text keeps full detail
// (roll formulas, *emphasis*, quotes); the SPOKEN text is sanitized so ElevenLabs
// never tries to vocalize markdown/symbols/leftover tokens — which produce hisses
// ("sssss"), slurs, or "speaking in tongues" garble. sanitizeForTts() is the one
// place every narration entry point should run through.

/**
 * Collapse a roll-math expression to just its total:
 *   "12 + 2 [Perception] = 14"      -> "14"
 *   "8 + 3 [STR] + 2 [Prof] = 13"   -> "13"
 * Only contiguous "N (+- N [label]?)... = TOTAL" arithmetic is collapsed; ordinary
 * numbers ("47 gold pieces", "DC 14", "Roll a d20") are left untouched.
 */
export function collapseRollMath(text: string): string {
  if (!text) return text;
  return text.replace(
    /\b\d+\s*(?:[+\-]\s*\d+\s*(?:\[[^\]]+\]\s*)?)+=\s*(\d+)\b/g,
    "$1",
  );
}

// Markdown / styling characters the model emits that must never be vocalized
// (*bold*, _italic_, `code`, ~strike~, #, >, |, ^, =).
const STRIP_MARKDOWN  = /[*_`~#>|^=]+/g;
// Emoji & pictographs.
const STRIP_EMOJI     = new RegExp("[\\u{1F000}-\\u{1FFFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE00}-\\u{FE0F}]", "gu");
// Zero-width / directional / invisible separators.
const STRIP_INVISIBLE = new RegExp("[\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]", "g");
// C0 / C1 control characters.
const STRIP_CONTROL   = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]", "g");
// Anything outside letters / numbers / punctuation / spacing / marks.
const STRIP_NONTEXT   = new RegExp("[^\\p{L}\\p{N}\\p{P}\\p{Zs}\\p{M}\\n\\r\\t]", "gu");
// Curly quote / dash normalizers.
const CURLY_SINGLE    = new RegExp("[\\u2018\\u2019\\u201A\\u201B]", "g");
const CURLY_DOUBLE    = new RegExp("[\\u201C\\u201D\\u201E\\u201F]", "g");
const FANCY_DASH      = new RegExp("[\\u2013\\u2014\\u2015]", "g");

/**
 * Produce TTS-safe speech text. Strips engine tags, markdown, emoji, invisibles,
 * and exotic glyphs; collapses roll math and punctuation runs that distort
 * prosody; and trims leading clutter. Returns "" when nothing speakable remains.
 * Pair with hasSpeakableContent() to decide whether to send a clip at all.
 */
export function sanitizeForTts(text: string): string {
  if (!text) return "";
  let out = collapseRollMath(text);
  out = out
    .replace(/\[[^\]]*\]/g, " ")   // engine tags / bonus labels [HP:..], [Perception]
    .replace(STRIP_MARKDOWN, "")
    .replace(STRIP_EMOJI, "")
    .replace(STRIP_INVISIBLE, "")
    .replace(STRIP_CONTROL, "")
    .replace(STRIP_NONTEXT, "");
  // Normalize exotic quotes/dashes to plain forms the engine reads cleanly.
  out = out.replace(CURLY_SINGLE, "'").replace(CURLY_DOUBLE, '"').replace(FANCY_DASH, "—");
  // Collapse punctuation runs that confuse prosody, and tidy spacing.
  out = out
    .replace(/\.{3,}/g, "…")          // ... -> ellipsis
    .replace(/([!?])\1+/g, "$1")            // !!! -> !   ??? -> ?
    .replace(/,{2,}/g, ",")
    .replace(/—{2,}/g, "—")
    .replace(/(["'])\s*\1/g, " ")           // empty quote pair "" / '' -> gone
    .replace(/(["'])\1+/g, "$1")            // any leftover run -> single
    .replace(/\s*—\s*/g, " — ")  // even spacing around em dash
    .replace(/\s+([,.!?;:…])/g, "$1") // no space before punctuation
    .replace(/\s{2,}/g, " ")
    .trim();
  // Drop leading clutter that isn't a letter/digit/opening quote/paren — a chunk
  // that starts with stray punctuation is a common hiss trigger.
  out = out.replace(/^[^\p{L}\p{N}"'(]+/u, "").trim();
  return out;
}

/**
 * True only when `text` has something worth speaking — at least one letter or
 * digit. A chunk that is just punctuation/quotes/dashes (e.g. a lone `"` left
 * after stripping the `*` from `*"`) makes the TTS engine emit a hiss/garble, so
 * those must be skipped rather than sent to narration.
 */
export function hasSpeakableContent(text: string): boolean {
  return /[a-zA-Z0-9]/.test(text);
}
