// LIGHT history summarization (token saver for very long campaigns). The recent
// window is always sent to the DM verbatim; only turns OLDER than the window are
// compressed into a single running recap. With prompt caching (#3) already making
// in-session history cheap, this exists to cap the cache-WRITE cost of huge
// campaigns and to stay well under the context limit — without touching the
// recent turns the DM relies on for callbacks.
//
// The recap is regenerated only every REGEN_EVERY messages (not per turn), so the
// summarized prefix stays stable and keeps cache-hitting between regenerations.

export const KEEP_RECENT = 50;                          // most recent messages always sent verbatim
export const REGEN_EVERY = 30;                          // re-summarize only after this many more messages age out
export const MIN_TO_SUMMARIZE = KEEP_RECENT + REGEN_EVERY; // 80 — below this, never summarize

export type HistorySummary = { summary: string; throughCount: number };

export type WindowPlan =
  | { mode: "full" }                                                            // send everything verbatim
  | { mode: "summarized"; throughCount: number; needsRegen: boolean; regenFrom: number };

/**
 * Decide how to window the DM message history.
 * @param messageCount total stored messages (player + dm)
 * @param cached the persisted running recap, or null if none yet
 *
 * `throughCount` = number of oldest messages the recap covers; messages from
 * `throughCount` onward are sent verbatim. When `needsRegen`, the caller should
 * summarize messages[regenFrom .. throughCount) (folding into any prior recap)
 * and persist { summary, throughCount }.
 */
export function planHistoryWindow(messageCount: number, cached: HistorySummary | null): WindowPlan {
  if (messageCount <= MIN_TO_SUMMARIZE) return { mode: "full" };
  const desiredThrough = messageCount - KEEP_RECENT;     // compress everything older than the recent window
  const have = cached?.throughCount ?? 0;
  // Regenerate when there is no recap yet, or the verbatim tail has grown
  // REGEN_EVERY past what the recap already covers. Otherwise reuse the recap as-is
  // (the verbatim tail simply runs a little longer, which is fine and keeps caching).
  const needsRegen = !cached || cached.summary.trim() === "" || (desiredThrough - have) >= REGEN_EVERY;
  const throughCount = needsRegen ? desiredThrough : have;
  return { mode: "summarized", throughCount, needsRegen, regenFrom: have };
}
