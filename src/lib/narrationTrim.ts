// Guards against the model hitting its max_tokens ceiling and ending a response
// mid-thought ("…Sera hasn't stopped moving toward" with nothing after). We never
// want the player to see or hear a sentence that just stops, so the campaign page
// trims any dangling, unterminated final sentence down to the last COMPLETE one.

// A sentence is "complete" when it ends in . ! ? or … (optionally followed by a
// closing quote/bracket). Trailing whitespace is ignored.
const ENDS_CLEAN = /[.!?…]["'')\]]*$/;

/** True when the text ends on a complete, punctuated sentence. */
export function endsOnCompleteSentence(text: string): boolean {
  return ENDS_CLEAN.test((text || "").replace(/\s+$/, ""));
}

/**
 * Returns the text trimmed to its last COMPLETE sentence. If it already ends clean,
 * returns it unchanged (sans trailing whitespace). If there is NO complete sentence
 * at all, returns "" — the caller decides whether that means "drop it" (narration
 * buffer) or "retry as degenerate" (the displayed response).
 */
export function lastCompleteSentence(text: string): string {
  const s = (text || "").replace(/\s+$/, "");
  if (!s) return "";
  if (ENDS_CLEAN.test(s)) return s;
  let last = -1;
  const re = /[.!?…]["'')\]]*(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) last = m.index + m[0].length;
  return last > 0 ? s.slice(0, last).replace(/\s+$/, "") : "";
}

// A saved DM message can legitimately END in a bracketed system tag ([NPC:…],
// [HP:…]) rather than punctuation — that is NOT a truncation, so treat a trailing
// "]" as a clean ending and leave the content untouched.
const ENDS_CLEAN_OR_TAG = /[.!?…)"'\]]$/;

/**
 * Heal a STORED DM message (loaded from history) that an earlier session left
 * truncated mid-sentence — the generation-time guard only protects new responses,
 * so a resumed campaign would otherwise display/speak the dangling fragment. Leaves
 * the message untouched when it ends on punctuation OR a system tag, and only trims
 * a genuine dangling prose fragment ("…moving toward") back to its last complete
 * sentence. Returns the original content when there is no complete sentence to fall
 * back to (rare) so nothing is ever blanked.
 */
export function trimSavedDangling(content: string): string {
  const s = (content || "").replace(/\s+$/, "");
  if (!s || ENDS_CLEAN_OR_TAG.test(s)) return content;
  const trimmed = lastCompleteSentence(s);
  return trimmed || content;
}
