// Pure, dependency-free enemy-defeat detection — shared by the /api/enemies/state
// route AND the backfill script (no next/supabase imports, so it loads anywhere).
//
// Why this exists: enemy roster labels carry a "#N" suffix ("Corrupted Miner #3",
// "Goblin #2"), but the DM narrates kills with the bare type or head noun ("the
// miner collapses", "you cut down the goblins", "the last soldier falls"). The old
// guard demanded the EXACT label near a kill word, so real deaths were demoted to
// "critical" and the enemy card lingered on screen. These matchers fix that.

// Defeat-phrase vocabulary — death-specific only. Bare "drops"/"falls" are excluded
// because "drops to one knee" / "falls back" are NOT deaths (they need a death/ground
// context). Erring toward leaving a card up one extra turn beats removing a live foe.
export const DEFEAT_WORDS =
  "die[sd]?|dying|dead|slain|slay[s]?|kill(?:s|ed)?|fell(?!\\s+back)|" +
  "falls?\\s+(?:dead|lifeless|limp|silent|still|to\\s+the\\s+(?:ground|floor|dirt))|" +
  "drops?\\s+(?:dead|lifeless|limp|to\\s+the\\s+(?:ground|floor))|collapse[sd]?|crumple[sd]?|" +
  "perish\\w*|destroy(?:s|ed)?|defeat\\w*|vanquish\\w*|cut\\s+down|struck\\s+down|lifeless|" +
  "motionless|stops?\\s+moving|breathes?\\s+(?:its|his|her|their)\\s+last|flee[sd]?|flees|fled|" +
  "rout(?:s|ed)?|surrender(?:s|ed)?|yield[sd]?|goes\\s+down|out\\s+of\\s+the\\s+fight";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Builds the defeat-proximity regex SOURCE for one enemy name. Matches, near a defeat
// word (within 120 chars, either order):
//   • the FULL roster label            — "Corrupted Miner #3"
//   • the base type (+ optional plural) — "corrupted miner" / "corrupted miners"
//   • the head noun (+ optional plural) — "miner" / "miners"  (≥ 4 chars, distinctive)
// The base strips a trailing "#N"/number and a leading article.
export function defeatNamePattern(name: string, DEFEAT: string = DEFEAT_WORDS): string {
  const base = name.replace(/\s*#?\d+\s*$/, "").replace(/^\s*(?:the|a|an)\s+/i, "").trim();
  const alts = [escapeRe(name)];
  if (base && base.toLowerCase() !== name.toLowerCase()) alts.push(`${escapeRe(base)}s?`);
  const head = base.split(/\s+/).pop() ?? "";
  if (head.length >= 4 && head.toLowerCase() !== base.toLowerCase()) alts.push(`${escapeRe(head)}s?`);
  const nameAlt = alts.join("|");
  return `\\b(?:${nameAlt})\\b[^.!?]{0,120}\\b(?:${DEFEAT})\\b|\\b(?:${DEFEAT})\\b[^.!?]{0,120}\\b(?:${nameAlt})\\b`;
}

// IDENTITY-specific matcher for the BACKFILL — which, unlike the live route, has no
// per-enemy classifier to say WHICH foe died. It therefore must not use the loose
// base/head match (that flags every "Miner" when only "Miner #7" fell, and lets a
// RECAP's stray words remove living foes). For a numbered enemy it requires the
// SPECIFIC "#N" (as the full label, "<base> #N", or "<head> #N") near a defeat word,
// so "Miner #7 crumples" marks ONLY #7. A unique (un-numbered) name has just one
// bearer, so the base/head matcher is safe there.
export function defeatIdentityPattern(name: string, DEFEAT: string = DEFEAT_WORDS): string {
  const numMatch = name.match(/#?\s*(\d+)\s*$/);
  if (!numMatch) return defeatNamePattern(name, DEFEAT);
  const n = numMatch[1];
  const base = name.replace(/\s*#?\d+\s*$/, "").replace(/^\s*(?:the|a|an)\s+/i, "").trim();
  const head = base.split(/\s+/).pop() ?? base;
  const alts = [
    escapeRe(name),
    `${escapeRe(base)}\\s*#?\\s*${n}`,
    `${escapeRe(head)}\\s*#?\\s*${n}`,
  ];
  const nameAlt = [...new Set(alts)].join("|");
  return `\\b(?:${nameAlt})(?![\\d])[^.!?]{0,120}\\b(?:${DEFEAT})\\b|\\b(?:${DEFEAT})\\b[^.!?]{0,120}\\b(?:${nameAlt})(?![\\d])`;
}
