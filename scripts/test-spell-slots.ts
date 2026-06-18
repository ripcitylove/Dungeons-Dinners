// Spell-slot remaining math. The bug: the DM was told only how many slots were
// USED (not the max), so it couldn't compute remaining and wrongly refused a valid
// cast ("Vi has no 1st-level slots" when 1 of 2 remained). spellSlotsRemaining()
// gives the DM the authoritative remaining count. Run: node scripts/test-spell-slots.ts
import { getSpellSlots, spellSlotsRemaining } from "../src/lib/spellData.ts";

let pass = 0;
const fails: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};

// A level-1 Druid has two 1st-level slots.
eq("druid L1 max slots", getSpellSlots("Druid", 1), { 1: 2 });

// ── The exact screenshot case: Vi (Druid L1) has spent 1 of 2 → 1 still remains,
//    so Cure Wounds is castable. ──
eq("Vi: 1 of 2 spent → 1 remaining", spellSlotsRemaining("Druid", 1, { "1": 1 }), { 1: 1 });
const viRemaining = spellSlotsRemaining("Druid", 1, { "1": 1 });
if ((viRemaining[1] ?? 0) > 0) pass++; else fails.push("  ✗ Vi should still be able to cast a 1st-level spell");

// Truly exhausted → 0 remaining (the only time a cast is refused for slots).
eq("both spent → 0 remaining", spellSlotsRemaining("Druid", 1, { "1": 2 }), { 1: 0 });
eq("over-spent clamps to 0 (never negative)", spellSlotsRemaining("Druid", 1, { "1": 5 }), { 1: 0 });
eq("none spent → full", spellSlotsRemaining("Druid", 1, {}), { 1: 2 });
eq("undefined used → full", spellSlotsRemaining("Druid", 1, undefined), { 1: 2 });

// Numeric keys work too (not just JSON string keys).
eq("numeric used keys", spellSlotsRemaining("Druid", 1, { 1: 1 } as Record<number, number>), { 1: 1 });

// Higher level / multiple slot levels (Wizard L3: 4 first, 2 second).
eq("wizard L3 max", getSpellSlots("Wizard", 3), { 1: 4, 2: 2 });
eq("wizard L3 with mixed usage", spellSlotsRemaining("Wizard", 3, { "1": 2, "2": 2 }), { 1: 2, 2: 0 });

// Non-caster / unknown class → no slots.
eq("fighter has no slots", spellSlotsRemaining("Fighter", 5, { "1": 0 }), {});

console.log(`\nSpell-slot remaining battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Remaining = max − used; a player with a slot left can always cast.");
