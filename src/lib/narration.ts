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
  // ── Quotation marks — the #1 source of TTS "funny noises" ──
  // The engine never speaks quote characters, and a quote-wrapped line is a known
  // ElevenLabs trigger for yells / hisses / "speaking in tongues". Remove EVERY
  // kind of quotation mark from the SPOKEN text (the chat display keeps them):
  //   • double quotes  • guillemets « » ‹ ›  • SINGLE quotes used as quotation marks.
  // Contraction/possessive apostrophes (a single quote with a letter on BOTH sides
  // — he's, don't, dog's, o'clock) are preserved so words still sound natural.
  out = out
    .replace(/"/g, "")
    .replace(/[«»‹›]/g, "")
    // Drop a single quote UNLESS it sits between two letters (he's, dog's,
    // o'clock): a quote with a non-letter on either side is a quotation mark,
    // not an apostrophe.
    .replace(/'(?![A-Za-z])|(?<![A-Za-z])'/g, "");
  // ── Other symbols the engine reads literally or garbles ──
  out = out
    .replace(/[()[\]{}]/g, " ")     // brackets/parens → a pause, never "open paren"
    .replace(/\s*&\s*/g, " and ")   // ampersand → spoken "and"
    .replace(/\s*\/\s*/g, " ")       // slash → space, never "slash" or a garble
    .replace(/\\+/g, " ");           // stray backslashes
  // Collapse punctuation runs that confuse prosody, and tidy spacing.
  out = out
    .replace(/\.{3,}/g, "…")          // ... -> ellipsis
    .replace(/[!?]{2,}/g, m => m[0])        // !!!, ?!, ?? -> single terminal mark
    .replace(/,{2,}/g, ",")
    .replace(/[;:]{2,}/g, m => m[0])
    .replace(/—{2,}/g, "—")
    .replace(/\s*—\s*/g, " — ")  // even spacing around em dash
    .replace(/\s+([,.!?;:…])/g, "$1") // no space before punctuation
    .replace(/([,.!?;:…])(?=[A-Za-z])/g, "$1 ") // ensure a space AFTER sentence punctuation
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

// Any dice-roll request the DM may voice. Covers the article forms ("roll a
// d20"), bare and multi-die damage rolls ("roll 2d6", "roll d6", "roll 3d8 + 2"),
// and die-less damage asks ("roll your damage", "roll for damage", "roll damage").
const ROLL_DICE_FRAG  = "(?:(?:a|an|your|the|for)\\s+)?(?:\\d*d\\d+|damage)\\b";
const ROLL_REQUEST_RE = new RegExp(`\\broll\\s+${ROLL_DICE_FRAG}[^.!?\\n]*[.!?]?`, "i");
const ROLL_MENTION_RE = new RegExp(`\\broll\\s+${ROLL_DICE_FRAG}`, "i");

/** True when `text` contains a dice-roll request (any die count, or a damage ask). */
export function looksLikeRollRequest(text: string): boolean {
  return ROLL_MENTION_RE.test(text);
}

/**
 * True when a roll request is for DAMAGE rather than an attack/check/save. Damage
 * rolls use damage dice (any multi-die roll like 2d6, or any single non-d20 die),
 * or mention "damage". A lone d20 is an attack/check/save — never damage.
 */
export function isDamageRollRequest(text: string): boolean {
  if (/\bdamage\b/i.test(text)) return true;
  const m = /\broll\s+(?:(?:a|an|your|the|for)\s+)?(\d*)d(\d+)\b/i.exec(text);
  if (!m) return false;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  return count > 1 || sides !== 20;
}

/**
 * Returns the substring of `text` up to AND INCLUDING the first roll request,
 * or the whole `text` if there is none. The DM is told to stop at the roll
 * request but sometimes writes past it; narrating this slice lets the player
 * HEAR "Shmang, roll a d20." / "Roll 2d6." while the text the DM wrongly added
 * after it is dropped from speech (and the display is truncated to match).
 */
export function sliceThroughRollRequest(text: string): string {
  const m = ROLL_REQUEST_RE.exec(text);
  return m ? text.slice(0, m.index + m[0].length) : text;
}

/**
 * Prepare a roll request for clean speech.
 *
 * DAMAGE rolls are ALWAYS voiced as "Roll <dice> for damage." so the player
 * hears WHY they're rolling — this covers single-die ("Roll a d6"), multi-die
 * ("Roll 2d6", "Roll 3d8 + 2"), and longer lines that END on a damage roll
 * ("The axe bites deep. Roll 2d6." → "…Roll 2d6 for damage."). A die-less
 * "roll your damage" already names the reason and is left intact.
 *
 * Non-damage (d20) requests keep the prior behavior: a bare, short request like
 * "Roll a d20." (11 chars) is below the TTS engine's prosody floor and gets
 * garbled, so it's expanded with a throwaway trailing beat ("— go ahead.") so
 * the clipped tail lands there instead of on the die. Longer requests are
 * returned unchanged.
 */
export function expandRollRequestForSpeech(text: string): string {
  const t = text.trim();

  // Whole-string roll request with an explicit die (optionally name-prefixed).
  const m = /^(?:[A-Za-z][\w'-]*,?\s*)?roll\s+(?:(?:a|an|your|the|for)\s+)?(\d*)d(\d+)\b([^.!?]*)[.!?]?$/i.exec(t);
  if (m) {
    const count = m[1] ? parseInt(m[1], 10) : 1;
    const sides = parseInt(m[2], 10);
    if (count > 1 || sides !== 20) {
      const dice    = count > 1 ? `${count}d${sides}` : `a d${sides}`;
      const mod     = (m[3] || "").trim();
      const modPart = /^[+\-]\s*\d+/.test(mod) ? ` ${mod.replace(/\s+/g, " ")}` : "";
      return `Roll ${dice}${modPart} for damage.`;
    }
    // d20 attack/check/save — expand only when too short for clean prosody.
    return t.length >= 16 ? t : `Roll a d${sides} — go ahead.`;
  }

  // Die-less damage request as the whole string ("roll your damage").
  if (/^(?:[A-Za-z][\w'-]*,?\s*)?roll\s+(?:your\s+|the\s+|for\s+)?damage\b/i.test(t)) {
    return t.length >= 16 ? t : "Roll your damage — go ahead.";
  }

  // Longer chunk that ENDS on a damage roll — append "for damage" so the reason
  // is always voiced (unless the line already says "damage").
  if (!/\bdamage\b/i.test(t)) {
    const tail = /\broll\s+(?:(?:a|an|your|the|for)\s+)?(\d*)d(\d+)(?:\s*[+\-]\s*\d+)?\s*([.!?]?)\s*$/i.exec(t);
    if (tail) {
      const count = tail[1] ? parseInt(tail[1], 10) : 1;
      const sides = parseInt(tail[2], 10);
      if (count > 1 || sides !== 20) {
        const end = tail[3] || ".";
        return `${t.replace(/\s*[.!?]?\s*$/, "")} for damage${end}`;
      }
    }
  }

  return t;
}

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
