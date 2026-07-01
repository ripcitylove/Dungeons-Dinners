// Death-saving-throw adjudication (D&D 5e + a house revive twist).
//
// A character at 0 HP is Unconscious and rolls a straight d20 death save on each of
// their turns (no modifier). House rule: a SUCCESS (10+) doesn't just stabilize —
// the hero regains 2 HP, wakes, and rejoins the turn rotation. Failures accumulate;
// three failures = death. Per RAW, a natural 1 counts as two failures and a natural
// 20 succeeds (here: revives).
//
// The engine tracks failures on class_resources.death_fails; successes need no
// tracking because a single success revives.

export const DEATH_SAVE_DC = 10;      // d20 >= 10 succeeds
export const DEATH_FAIL_CAP = 3;      // 3 failures = dead
export const REVIVE_HP = 2;           // HP restored on a successful save

export type DeathSaveOutcome = {
  roll: number;
  success: boolean;   // revived this save
  dead: boolean;      // hit the failure cap
  addedFails: number; // failures added by this roll (0 on success)
  newFails: number;   // total failures after this roll (0 on success)
  newHp: number;      // HP after this roll (REVIVE_HP on success, else 0)
};

/** Adjudicate a single death save. `roll` is a raw d20 (1-20); `currentFails` the
 *  character's accumulated death-save failures. Pure + deterministic. */
export function adjudicateDeathSave(roll: number, currentFails: number): DeathSaveOutcome {
  const r = Math.max(1, Math.min(20, Math.floor(roll)));
  const fails = Math.max(0, currentFails);
  if (r >= DEATH_SAVE_DC) {
    // 10+ (natural 20 included) — the hero rallies, waking with REVIVE_HP.
    return { roll: r, success: true, dead: false, addedFails: 0, newFails: 0, newHp: REVIVE_HP };
  }
  const addedFails = r === 1 ? 2 : 1;  // natural 1 = two failures
  const newFails = Math.min(DEATH_FAIL_CAP, fails + addedFails);
  return { roll: r, success: false, dead: newFails >= DEATH_FAIL_CAP, addedFails, newFails, newHp: 0 };
}

/** A fresh d20 (1-20) for a death save. */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/** Skulls remaining on the card = starting saves minus failures (never negative).
 *  A natural 1 already counts as two failures, so this stays exact. */
export function skullsRemaining(fails: number): number {
  return Math.max(0, DEATH_FAIL_CAP - Math.max(0, fails | 0));
}

/** A character is OUT of the battle when they carry the Dead status OR have hit the
 *  failure cap. Out characters are skipped in the turn order until revived. */
export function isOutOfBattle(statusEffects: string[] | undefined, fails: number): boolean {
  return (statusEffects ?? []).includes("Dead") || (fails | 0) >= DEATH_FAIL_CAP;
}

// Damage taken while at 0 HP (unconscious) is a failed death save in 5e — a normal
// hit costs one, and a hit whose damage meets/exceeds the character's HP maximum is
// instant death (massive damage). Returns the failures to ADD for a hit of `damage`
// against a character with `maxHp`.
export function failsFromDamageWhileDown(damage: number, maxHp: number): number {
  const d = Math.abs(damage | 0);
  if (d <= 0) return 0;
  if (maxHp > 0 && d >= maxHp) return DEATH_FAIL_CAP; // massive damage → instant death
  return 1;
}
