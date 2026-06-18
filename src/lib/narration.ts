// Narration (TTS) text preparation. The DISPLAYED chat text keeps full detail
// (roll formulas, *emphasis*, quotes); the SPOKEN text is sanitized so ElevenLabs
// never tries to vocalize markdown/symbols/leftover tokens — which produce hisses
// ("sssss"), slurs, or "speaking in tongues" garble. sanitizeForTts() is the one
// place every narration entry point should run through.
import { isTurnPromptSentence } from "./turnPrompt.ts";

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
  // Normalize exotic quotes/dashes to plain forms first.
  out = out.replace(CURLY_SINGLE, "'").replace(CURLY_DOUBLE, '"').replace(FANCY_DASH, "—");
  // Remove DOUBLE-quote marks from speech entirely. They are never vocalized, and
  // an isolated quote-wrapped line ("That was a demonstration.") is a known
  // ElevenLabs trigger for yells / hisses / "speaking in tongues". Apostrophes (')
  // are kept so contractions (he's, doesn't) survive. (Only the SPOKEN text is
  // affected — the chat display still shows the quotes.)
  out = out.replace(/"/g, "");
  // Collapse punctuation runs that confuse prosody, and tidy spacing.
  out = out
    .replace(/\.{3,}/g, "…")          // ... -> ellipsis
    .replace(/([!?])\1+/g, "$1")            // !!! -> !   ??? -> ?
    .replace(/,{2,}/g, ",")
    .replace(/—{2,}/g, "—")
    .replace(/''+/g, "'")                   // any single-quote run -> one
    .replace(/\s*—\s*/g, " — ")  // even spacing around em dash
    .replace(/\s+([,.!?;:…])/g, "$1") // no space before punctuation
    .replace(/\s{2,}/g, " ")
    .trim();
  // Drop leading clutter that isn't a letter/digit/opening apostrophe/paren — a
  // chunk that starts with stray punctuation is a common hiss trigger.
  out = out.replace(/^[^\p{L}\p{N}'(]+/u, "").trim();
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

const ROLL_REQUEST_RE = /\broll\s+a\s+d\d+[^.!?\n]*[.!?]?/i;

/**
 * Returns the substring of `text` up to AND INCLUDING the first "roll a dN"
 * request, or the whole `text` if there is none. The DM is told to stop at the
 * roll request but sometimes writes past it; narrating this slice lets the player
 * HEAR "Shmang, roll a d20." while the text the DM wrongly added after it is
 * dropped from speech (and the display is truncated to match).
 */
export function sliceThroughRollRequest(text: string): string {
  const m = ROLL_REQUEST_RE.exec(text);
  return m ? text.slice(0, m.index + m[0].length) : text;
}

/**
 * A bare, short roll request like "Roll a d20." (11 chars) is below the TTS
 * engine's minimum prosody window — it gets rejected/garbled, so the player
 * never hears the call to roll. Expand ONLY a short, essentially-bare roll
 * request into a fuller natural utterance so it's spoken clearly. Longer or
 * named requests ("Shmang, roll a d20." = 19 chars) already clear the threshold
 * and are returned unchanged.
 */
export function expandRollRequestForSpeech(text: string): string {
  const t = text.trim();
  if (t.length >= 16) return t; // already long enough for clean prosody
  const m = /^(?:[A-Za-z][\w'-]*,?\s*)?roll\s+(?:a|an)\s+d(\d+)\b[^.!?]*[.!?]?$/i.exec(t);
  if (!m) return t;
  return `Go ahead — roll a d${m[1]}.`;
}

const ROLL_MENTION_RE = /\broll\s+(?:a|an)\s+d\d+\b/i;

/**
 * Decide whether a TRAILING narration chunk (the short tail left after streaming —
 * typically the last sentence/paragraph of a DM turn) should be spoken.
 *
 * The streaming path already voices full sentences as they complete. What lands
 * in the tail is whatever is too short to have been pulled mid-stream. A blanket
 * "drop anything under 24 chars" tail guard (added to kill garbled stubs) was
 * silently eating the two MOST important short lines a turn can end on:
 *   • the turn prompt — "Shmang, what do you do?" (23 chars)
 *   • a bare roll request — "Roll a d20." (11 chars)
 * Both MUST be heard. So speak the tail when it is a real sentence (>= 24 chars),
 * a turn prompt, or a roll request; skip only the genuinely tiny non-meaningful
 * stubs that make ElevenLabs garble. (Roll requests are expanded for length by
 * expandRollRequestForSpeech before they reach the engine's 16-char floor.)
 */
export function shouldSpeakTailChunk(chunk: string): boolean {
  const t = chunk.trim();
  if (!hasSpeakableContent(t)) return false;        // pure punctuation/hiss — never
  if (t.length >= 24) return true;                  // a real sentence
  if (isTurnPromptSentence(t)) return true;         // "X, what do you do?" — must hear
  if (ROLL_MENTION_RE.test(t)) return true;         // "Roll a d20." — must hear
  return false;                                     // tiny stub that would garble
}

// Pull as many TTS-ready chunks as possible from a streaming narration buffer.
// Returns the chunks plus the leftover buffer.
//
// Three failure modes this handles:
//   1. Multiple complete sentences in one chunk — loop until none match.
//   2. Smart/curly quotes after the sentence-ender (DM models love " " ' ') —
//      character class accepts them alongside straight quotes.
//   3. A genuinely long clause (DM writes a 600-char run-on or quotes block) —
//      force-split at the nearest clause boundary so no TTS clip exceeds the
//      45s watchdog limit. Worst-case forces a hard cut.
//
// When `isFinal=true` (end of stream), accept sentences without trailing
// whitespace and dump anything left over as a final fragment.
export function pullNarrationChunks(buf: string, isFinal: boolean): { chunks: string[]; remaining: string } {
  const chunks: string[] = [];
  const MAX_CHUNK = 280;   // ~20s of speech — safely under the 45s watchdog
  const MIN_FORCED = 60;   // never force-split shorter than this
  // Quote characters allowed after a sentence-ender: straight ' " plus all curly variants
  const QUOTE_CLASS = "[\\u2018\\u2019\\u201C\\u201D'\"]";
  // Streaming match: 40+ chars then sentence-ender + optional quote + whitespace
  const SENT_RE_STREAM = new RegExp(`^([\\s\\S]{40,}?[.!?…]${QUOTE_CLASS}?)\\s+`);
  // Final match: shorter min, trailing whitespace OR end-of-buffer
  const SENT_RE_FINAL  = new RegExp(`^([\\s\\S]{8,}?[.!?…]${QUOTE_CLASS}?)(?:\\s+|$)`);

  while (true) {
    const m = buf.match(isFinal ? SENT_RE_FINAL : SENT_RE_STREAM);
    if (m) {
      chunks.push(m[1].trim());
      buf = buf.slice(m[0].length);
      continue;
    }
    // No sentence-ender found — force-split if the buffer has grown past MAX_CHUNK
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
      // Last resort: hard cut at MAX_CHUNK
      chunks.push(buf.slice(0, MAX_CHUNK).trim());
      buf = buf.slice(MAX_CHUNK);
      continue;
    }
    break;
  }
  // At end of stream, anything still in the buffer is the final fragment
  if (isFinal && buf.trim().length > 0) {
    chunks.push(buf.trim());
    buf = "";
  }

  // Merge tiny chunks (< MIN_TTS_CHARS) with the next chunk. ElevenLabs given a
  // ~25-char fragment in isolation (e.g. `"Where did you get those?"`) rushes
  // the prosody and drops syllables — the resulting clip sounds like nonsense
  // or a foreign language. Concatenating short sentences with the next sentence
  // gives the model enough context to voice them naturally.
  //
  // The merge only fires when there IS a next chunk. The final chunk is left
  // untouched (even if short) — the alternative would be losing it entirely.
  const MIN_TTS_CHARS = 40;
  const merged: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let cur = chunks[i];
    // Merge forward — combined with subsequent chunks until length meets the floor
    while (cur.length < MIN_TTS_CHARS && i + 1 < chunks.length && cur.length + chunks[i + 1].length + 1 <= MAX_CHUNK) {
      cur = cur + " " + chunks[i + 1];
      i++;
    }
    merged.push(cur);
  }
  return { chunks: merged, remaining: buf };
}
