// End-of-round prompt de-duplication.
//
// At the end of a D&D round the engine emits TWO DM messages: a round-completing
// message (resolving the last action / roll) and then a reconciliation message
// that resolves the round and prompts the next round's leader. Only the
// reconciliation message may prompt a player. But the round-completing message
// frequently ends with its own "…what do you do, X?" — either because the model
// ignored the "bridge: never prompt" instruction, or because the round ended on
// a dice roll (whose response template always prompts). The result is the
// long-standing bug where a player is asked for an action twice in a row.
//
// stripTrailingTurnPrompt() removes that trailing call-to-action so the
// reconciliation is the single source of the next prompt. It only strips a
// final sentence that is unambiguously a turn prompt; ordinary narration (even
// narration that happens to ask a rhetorical question) is left untouched.

// Distinctive turn-prompt closers the DM is instructed to rotate through.
// Deliberately specific — e.g. we match "what's your move" but NOT a bare
// "your move" that could appear in prose ("the enemy anticipates your move").
const TURN_CLOSER =
  /\b(?:what do you do|what will you do|what would you do|what do you want to do|what'?s your next move|what'?s your move|how do you respond|how will you respond|how do you proceed|the choice is yours|make your move|you'?re up|what now|what'?s it going to be|what'?s it to be|your move now)\b/i;

/**
 * If the final sentence/line of `text` is a turn prompt, return `text` with that
 * sentence removed (trailing whitespace trimmed). Otherwise return `text`
 * unchanged. Never returns an empty string — if stripping would remove
 * everything, the original is kept.
 */
export function stripTrailingTurnPrompt(text: string): string {
  if (!text) return text;
  const body = text.replace(/\s+$/, "");

  // Find where the final sentence/line begins: after the last sentence
  // terminator (with trailing space) or the last run of newlines.
  const boundary = /[.!?…]["')\]]?\s+|\n+/g;
  let lastStart = 0;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(body)) !== null) lastStart = m.index + m[0].length;

  const tail = body.slice(lastStart).trim();
  if (!tail || !TURN_CLOSER.test(tail)) return text;

  // Guard: only strip a short closer sentence (turn prompts are brief). This
  // prevents nuking a long narrative sentence that merely contains a closer
  // phrase mid-clause.
  if (tail.length > 90) return text;

  const head = body.slice(0, lastStart).replace(/\s+$/, "");
  return head.length ? head : text;
}
