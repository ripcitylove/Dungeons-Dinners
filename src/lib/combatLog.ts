// "What happened to me?" — a per-character damage/healing history (like WoW's combat
// log). HP changes to player characters are always driven by the DM's mandatory
// [HP:FirstName:±N] tags, so parsing those from each DM narrative is the single,
// deterministic source of truth. Each event captures the amount and a concise cause
// pulled from the prose the DM wrote right before the tag.

export type HpEvent = { firstName: string; delta: number };
export type CombatLogEntry = { id: number; ts: number; delta: number; note: string };

const HP_TAG_RE = /\[HP:([A-Za-z][A-Za-z'\-]*):([+-]\d+)\]/gi;

/** Extract every [HP:Name:±N] tag from a DM narrative as {firstName, delta}. */
export function parseHpEvents(narrative: string): HpEvent[] {
  if (!narrative) return [];
  const out: HpEvent[] = [];
  let m: RegExpExecArray | null;
  HP_TAG_RE.lastIndex = 0;
  while ((m = HP_TAG_RE.exec(narrative)) !== null) {
    const delta = parseInt(m[2], 10);
    if (Number.isFinite(delta) && delta !== 0) out.push({ firstName: m[1], delta });
  }
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A short human cause for a character's HP change: the sentence the DM wrote
 * immediately before that character's [HP:] tag (tags/markdown stripped). Falls back
 * to a generic "Took N damage" / "Healed N HP" when no descriptive prose precedes it.
 */
export function summarizeHpCause(narrative: string, firstName: string, delta: number): string {
  const generic = delta < 0 ? `Took ${Math.abs(delta)} damage` : `Recovered ${delta} HP`;
  if (!narrative) return generic;
  const tagRe = new RegExp(`\\[HP:${esc(firstName)}:[+-]?\\d+\\]`, "i");
  const m = tagRe.exec(narrative);
  let before = m ? narrative.slice(0, m.index) : narrative;
  before = before
    .replace(/\[[^\]]*\]/g, " ")          // strip engine tags / bracketed labels
    .replace(/[*_`~#>|^]/g, "")            // strip markdown
    .replace(/\s+/g, " ")
    .trim();
  const sentences = before.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean);
  let cause = sentences.length ? sentences[sentences.length - 1] : "";
  if (cause.length < 4) cause = generic;
  if (cause.length > 120) cause = cause.slice(0, 117).trimEnd() + "…";
  return cause;
}

/** Totals for the log header: lifetime damage taken and healing received. */
export function combatLogTotals(entries: CombatLogEntry[]): { damage: number; healing: number } {
  let damage = 0, healing = 0;
  for (const e of entries) { if (e.delta < 0) damage += -e.delta; else healing += e.delta; }
  return { damage, healing };
}
