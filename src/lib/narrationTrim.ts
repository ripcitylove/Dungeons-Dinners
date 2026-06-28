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
