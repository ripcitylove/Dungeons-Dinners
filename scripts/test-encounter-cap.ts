// Low-level swarm guard. Run:  node scripts/test-encounter-cap.ts
import { maxEnemiesForParty, boardCapForParty, capToToughest } from "../src/lib/encounterScaling.ts";

let pass = 0; const fails: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

// ── boardCapForParty: low level caps to party+1; higher level keeps the 12 ceiling ──
eq("L1 party of 4 → cap 5", boardCapForParty(4, 1), 5);
eq("L2 party of 4 → cap 5", boardCapForParty(4, 2), 5);
eq("L1 solo → cap 2 (floor)", boardCapForParty(1, 1), 2);
eq("L1 party of 2 → cap 3", boardCapForParty(2, 1), 3);
eq("L1 party of 8 → cap 9", boardCapForParty(8, 1), 9);
// The low cap never exceeds the soft ceiling maxEnemiesForParty.
eq("cap never exceeds soft max (p3,L1)", boardCapForParty(3, 1) <= maxEnemiesForParty(3), true);
// Level 3+ is unaffected — full 12 ceiling for leader+minion armies.
eq("L3 party of 4 → 12", boardCapForParty(4, 3), 12);
eq("L5 party of 8 → 12", boardCapForParty(8, 5), 12);

// ── maxEnemiesForParty sanity ──
eq("maxEnemies p4", maxEnemiesForParty(4), 6);
eq("maxEnemies p1 (floor 2)", maxEnemiesForParty(1), 2);
eq("maxEnemies p10 (ceiling 12)", maxEnemiesForParty(10), 12);

// ── capToToughest: keeps toughest N, preserves prose order among kept ──
const swarm = [
  { name: "Miner #1", cr: 0.125, max_hp: 5 },
  { name: "Miner #2", cr: 0.125, max_hp: 5 },
  { name: "Miner #3", cr: 0.125, max_hp: 5 },
  { name: "Miner #4", cr: 0.125, max_hp: 5 },
  { name: "Miner #5", cr: 0.125, max_hp: 5 },
  { name: "Miner #6", cr: 0.125, max_hp: 5 },
  { name: "Miner #7", cr: 0.125, max_hp: 5 },
  { name: "Miner #8", cr: 0.125, max_hp: 5 },
];
eq("8 equal miners capped to 5 keeps first 5 in order",
   capToToughest(swarm, 5).map(x => x.name), ["Miner #1", "Miner #2", "Miner #3", "Miner #4", "Miner #5"]);
eq("cap >= length is a no-op", capToToughest(swarm, 10).length, 8);

// A leader + minions: the leader (high CR) must survive the cull even if listed last.
const withLeader = [
  { name: "Minion A", cr: 0.25, max_hp: 7 },
  { name: "Minion B", cr: 0.25, max_hp: 7 },
  { name: "Minion C", cr: 0.25, max_hp: 7 },
  { name: "Warchief", cr: 3,    max_hp: 60 },
];
eq("leader is never dropped by the cap", capToToughest(withLeader, 2).map(x => x.name), ["Minion A", "Warchief"]);
// Tie-break by HP when CR is equal.
const hpTie = [
  { name: "Weak",  cr: 1, max_hp: 10 },
  { name: "Tough", cr: 1, max_hp: 40 },
  { name: "Mid",   cr: 1, max_hp: 25 },
];
eq("equal CR → keep higher HP", capToToughest(hpTie, 1).map(x => x.name), ["Tough"]);
eq("cap to 0 → empty", capToToughest(swarm, 0), []);

// End-to-end shape: an 8-body prose swarm for a L1 party of 4 lands at 5 cards.
eq("L1 party-of-4 swarm of 8 → 5 cards", capToToughest(swarm, boardCapForParty(4, 1)).length, 5);

console.log(`\nEncounter-cap battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ low-level parties cap at party+1; leaders survive the cull; L3+ keeps the 12 ceiling.");
