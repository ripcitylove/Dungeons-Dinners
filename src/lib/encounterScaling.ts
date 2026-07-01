// Deterministic encounter-size guards, shared by the enemy builder and its tests.
//
// The key insight from 5e's encounter math: being OUTNUMBERED is far deadlier than
// raw CR suggests (the group multiplier), and it's brutal at levels 1–2 where heroes
// have single-digit HP. So we hard-cap the number of enemy CARDS on the board at low
// levels, regardless of how many the DM's prose names — surplus foes simply aren't
// spawned (the story can bring them back as a later wave).

// The soft ceiling used for prompt guidance / token budgeting: scales with party size
// but never exceeds 12 (a leader + a full band of minions).
export function maxEnemiesForParty(partySize: number): number {
  return Math.min(12, Math.max(2, Math.ceil(partySize * 1.5)));
}

// The HARD cap on simultaneous enemy cards. At avg level 1–2, cap to ~one-per-hero
// (partySize + 1); above that, the normal 12 ceiling stands so larger armies work.
export function boardCapForParty(partySize: number, avgLevel: number): number {
  const max = maxEnemiesForParty(partySize);
  return avgLevel <= 2 ? Math.max(2, Math.min(max, partySize + 1)) : 12;
}

// Keep the toughest `n` foes (a leader/boss — higher CR, then HP — is never dropped),
// preserving the original prose order among those kept. Pure: returns a new array.
export function capToToughest<T extends { cr: number; max_hp: number }>(rows: T[], n: number): T[] {
  if (rows.length <= n) return rows.slice();
  const ranked = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.cr - a.r.cr) || (b.r.max_hp - a.r.max_hp) || (a.i - b.i));
  return ranked.slice(0, Math.max(0, n)).sort((a, b) => a.i - b.i).map(x => x.r);
}
