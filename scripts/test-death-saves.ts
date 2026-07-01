// Death-save adjudication (D&D 5e + revive twist). Run:
//   node scripts/test-death-saves.ts
import { adjudicateDeathSave, DEATH_FAIL_CAP, REVIVE_HP, skullsRemaining, isOutOfBattle, failsFromDamageWhileDown } from "../src/lib/deathSaves.ts";

let pass = 0; const fails: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

// Successes (10+) → revive at REVIVE_HP, fails reset.
for (const r of [10, 12, 15, 19, 20]) {
  const o = adjudicateDeathSave(r, 1);
  eq(`roll ${r} succeeds`, [o.success, o.dead, o.newHp, o.newFails], [true, false, REVIVE_HP, 0]);
}
// Nat 20 revives even with 2 prior failures.
eq("nat 20 revives from 2 fails", adjudicateDeathSave(20, 2).success, true);

// Failures (<10) → +1 fail, no revive.
for (const r of [2, 5, 9]) {
  const o = adjudicateDeathSave(r, 0);
  eq(`roll ${r} fails once`, [o.success, o.addedFails, o.newFails, o.newHp], [false, 1, 1, 0]);
}
// Natural 1 counts as two failures.
eq("nat 1 = two failures", adjudicateDeathSave(1, 0).newFails, 2);

// Death at the cap.
eq("2 fails + a failure = dead", adjudicateDeathSave(5, 2).dead, true);
eq("1 fail + nat 1 (=2) = dead", adjudicateDeathSave(1, 1).dead, true);
eq("failures never exceed the cap", adjudicateDeathSave(1, 2).newFails, DEATH_FAIL_CAP);
eq("a single fail from 0 is NOT dead", adjudicateDeathSave(5, 0).dead, false);

// Boundary: 9 fails, 10 succeeds.
eq("9 is a failure", adjudicateDeathSave(9, 0).success, false);
eq("10 is a success", adjudicateDeathSave(10, 0).success, true);

// Out-of-range rolls are clamped safely.
eq("roll 25 clamps to a success", adjudicateDeathSave(25, 0).success, true);
eq("roll 0 clamps to a failure", adjudicateDeathSave(0, 0).success, false);

// ── Skull tally (3 that deplete; nat 1 removes two) ──
eq("skulls: 0 fails → 3", skullsRemaining(0), 3);
eq("skulls: 1 fail → 2", skullsRemaining(1), 2);
eq("skulls: 2 fails → 1", skullsRemaining(2), 1);
eq("skulls: 3 fails → 0", skullsRemaining(3), 0);
eq("skulls: over-cap → 0 (never negative)", skullsRemaining(5), 0);
// nat 1 accounting: from 0 fails a nat 1 → 2 fails → 1 skull left.
eq("nat 1 from full → 1 skull remains", skullsRemaining(adjudicateDeathSave(1, 0).newFails), 1);
// nat 1 at 2 skulls remaining (1 fail) → 3 fails → 0 skulls → OUT (nat 1 as killing blow).
{
  const o = adjudicateDeathSave(1, 1);
  eq("nat 1 at 2 skulls → 0 skulls + dead", [skullsRemaining(o.newFails), o.dead], [0, true]);
}

// ── Out-of-battle detection ──
eq("out: 3 fails → out", isOutOfBattle([], 3), true);
eq("out: Dead status → out", isOutOfBattle(["Dead"], 0), true);
eq("out: 2 fails, alive → not out", isOutOfBattle(["Unconscious"], 2), false);

// ── Damage while down (5e) ──
eq("hit while down = 1 fail", failsFromDamageWhileDown(-6, 30), 1);
eq("massive damage (>= max HP) = instant death (cap)", failsFromDamageWhileDown(-30, 30), DEATH_FAIL_CAP);
eq("overkill also instant death", failsFromDamageWhileDown(-45, 30), DEATH_FAIL_CAP);
eq("no damage = 0 fails", failsFromDamageWhileDown(0, 30), 0);
eq("chip damage below max = 1 fail", failsFromDamageWhileDown(-1, 30), 1);

console.log(`\nDeath-save battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ 10+ revives at 2 HP; <10 fails; nat 1 = 2 fails; 3 fails = death.");
