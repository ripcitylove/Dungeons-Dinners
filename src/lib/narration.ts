// Narration (TTS) text transforms. The DISPLAYED chat text keeps full roll detail
// ("12 + 2 [Perception] = 14 — clear enough."); the SPOKEN text should be only the
// result, not the arithmetic — players don't need to hear the formula read aloud.

/**
 * Collapse a roll-math expression to just its total:
 *   "12 + 2 [Perception] = 14"      → "14"
 *   "8 + 3 [STR] + 2 [Prof] = 13"   → "13"
 *   "14 + 5 = 19"                   → "19"
 * Only contiguous "N (± N [label]?)… = TOTAL" arithmetic is collapsed; ordinary
 * numbers ("47 gold pieces", "DC 14", "Roll a d20") are left untouched. Works
 * whether or not the bracketed bonus labels are still present.
 */
export function collapseRollMath(text: string): string {
  if (!text) return text;
  return text.replace(
    /\b\d+\s*(?:[+\-]\s*\d+\s*(?:\[[^\]]+\]\s*)?)+=\s*(\d+)\b/g,
    "$1",
  );
}
