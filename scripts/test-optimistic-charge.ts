// Refund of an optimistic button-click charge when the DM rejects the action
// ([NO-TURN]). The bug: a failed/declined spell or ability still spent the slot/
// resource. computeRefund() reverses exactly what the click spent so resources are
// only spent on SUCCESS. Run: node scripts/test-optimistic-charge.ts
import { computeRefund } from "../src/lib/optimisticCharge.ts";

let pass = 0;
const fails: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};

// ── The reported case: Second Wind clicked at full HP → DM refuses → resource is
//    restored (Fighter's second_wind use is given back). ──
{
  const r = computeRefund({ class_resources: { second_wind: 1 } }, { abilityKey: "second_wind", abilityCost: 1 });
  eq("Second Wind refunded → resource cleared", r.class_resources, {});
  eq("Second Wind refund marks changed", r.changed, true);
}

// ── Spell slot refund (rejected button cast). ──
{
  const r = computeRefund({ spell_slots_used: { "1": 1 } }, { spellLevel: 1 });
  eq("1st-level slot refunded → back to 0/used cleared", r.spell_slots_used, {});
  eq("slot refund changed", r.changed, true);
}
{
  const r = computeRefund({ spell_slots_used: { "1": 2 } }, { spellLevel: 1 });
  eq("one of two refunded → 1 remains used", r.spell_slots_used, { "1": 1 });
}

// ── Rage clicked then refused → resource AND Raging status reverted. ──
{
  const r = computeRefund({ class_resources: { rage: 1 }, status_effects: ["Raging", "Blessed"] },
                          { abilityKey: "rage", abilityCost: 1, rageApplied: true });
  eq("rage resource refunded", r.class_resources, {});
  eq("Raging removed, other effects kept", r.status_effects, ["Blessed"]);
}

// ── Only the named charge is touched; other resources/levels untouched. ──
{
  const r = computeRefund({ class_resources: { second_wind: 1, ki: 2 } }, { abilityKey: "second_wind", abilityCost: 1 });
  eq("other resource (ki) untouched", r.class_resources, { ki: 2 });
}
{
  const r = computeRefund({ spell_slots_used: { "1": 1, "2": 1 } }, { spellLevel: 2 });
  eq("only the spent level refunded", r.spell_slots_used, { "1": 1 });
}

// ── Safety: nothing to refund → changed=false (no needless write). ──
eq("no charge present → unchanged", computeRefund({ class_resources: {} }, { abilityKey: "second_wind", abilityCost: 1 }).changed, false);
eq("never goes negative", computeRefund({ class_resources: { second_wind: 0 } }, { abilityKey: "second_wind", abilityCost: 1 }).class_resources, { second_wind: 0 });
eq("empty state, empty charge → unchanged", computeRefund({}, {}).changed, false);

console.log(`\nOptimistic-charge refund battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ A rejected spell/ability refunds exactly its charge; successful uses are untouched.");
