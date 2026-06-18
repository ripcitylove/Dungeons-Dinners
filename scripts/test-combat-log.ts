// "What happened to me?" combat-log parsing. Run: node scripts/test-combat-log.ts
import { parseHpEvents, summarizeHpCause, combatLogTotals } from "../src/lib/combatLog.ts";

let pass = 0;
const fails: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};

// ── parseHpEvents ──
eq("single damage tag", parseHpEvents("The blade bites. [HP:Aria:-7]"), [{ firstName: "Aria", delta: -7 }]);
eq("heal tag", parseHpEvents("Light pours over Thorin. [HP:Thorin:+9]"), [{ firstName: "Thorin", delta: 9 }]);
eq("multiple tags", parseHpEvents("[HP:Aria:-5] [HP:Vi:+3]"), [{ firstName: "Aria", delta: -5 }, { firstName: "Vi", delta: 3 }]);
eq("no tags", parseHpEvents("The door creaks open."), []);
eq("zero ignored", parseHpEvents("[HP:Aria:+0]"), []);

// ── summarizeHpCause: the sentence before the tag is the cause ──
eq("cause from prose before tag",
  summarizeHpCause("The goblin's blade catches Aria's flank — 7 piercing! [HP:Aria:-7]", "Aria", -7),
  "The goblin's blade catches Aria's flank — 7 piercing!");
eq("heal cause (full sentence, names the healer)",
  summarizeHpCause("Lyra's hand glows; Thorin breathes easier. [HP:Thorin:+9]", "Thorin", 9),
  "Lyra's hand glows; Thorin breathes easier.");
eq("picks the right char's tag when several",
  summarizeHpCause("Fire washes the room. [HP:Aria:-12] Ash chokes Vi. [HP:Vi:-4]", "Vi", -4),
  "Ash chokes Vi.");
eq("strips tags + markdown from cause",
  summarizeHpCause("The **acid** sprays Aria [LOOT:vial]. [HP:Aria:-6]", "Aria", -6),
  "The acid sprays Aria .");
eq("fallback when no prose", summarizeHpCause("[HP:Aria:-8]", "Aria", -8), "Took 8 damage");
eq("fallback heal", summarizeHpCause("[HP:Aria:+5]", "Aria", 5), "Recovered 5 HP");

// ── totals ──
eq("running totals", combatLogTotals([
  { id: 1, ts: 1, delta: -7, note: "" },
  { id: 2, ts: 2, delta: +9, note: "" },
  { id: 3, ts: 3, delta: -4, note: "" },
]), { damage: 11, healing: 9 });

console.log(`\nCombat-log battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ HP tags parse, causes summarize from the prose, totals add up.");
