// Live integration test: when the DM narrates a specific gold/HP/XP amount,
// chat-state must extract that EXACT integer with no rounding. And the
// in-component math (currency add, HP subtract) must preserve exactness.

const CHAT_STATE = "http://localhost:3000/api/chat-state";

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

async function extract(narrative) {
  const res = await fetch(CHAT_STATE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ narrative }),
  });
  return res.json();
}

// ── 1. Explicit gold amounts must be preserved bit-for-bit ───────────────────
const stated = [
  ["Randiezel finds 47 gold pieces in the pouch.",          47],
  ["Thorin claims exactly 23 gp from the merchant.",        23],
  ["Aria recovers 81 gold coins from the chest.",           81],
  ["Vasha is rewarded 113 gold pieces by the lord.",       113],
  ["Ekko scoops up 7 gold coins.",                          7 ],
  ["Shmang earns 199 gold pieces from selling the staff.", 199],
];
console.log("=== Stated gold amounts — must be exact ===");
for (const [narrative, expected] of stated) {
  const out = await extract(narrative);
  const got = out.gold_delta;
  check(
    `"${narrative.slice(0, 50)}…" → gold=${expected}`,
    got === expected,
    `extractor returned ${got}, expected ${expected}`,
  );
}

// ── 2. The in-component math chain (50 + 47 = 97) ────────────────────────────
console.log("\n=== Component math: 50 + 47 must equal 97 ===");
{
  const existingGold = 50;
  const out = await extract("Randiezel finds 47 gold pieces.");
  const newGold = Math.max(0, existingGold + out.gold_delta);
  check(
    "50 + 47 = 97 (NOT 100, no rounding)",
    newGold === 97,
    `actual ${newGold}`,
  );
}

// ── 3. Damage / healing numbers must also be exact ───────────────────────────
console.log("\n=== Damage and healing — must be exact ===");
const damageNarratives = [
  ["The orc strikes Aria for 13 slashing damage. [HP:Aria:-13]",   -13],
  ["The fireball hits Thorin for 27 fire damage. [HP:Thorin:-27]", -27],
  ["Cure Wounds restores 7 HP to Vasha. [HP:Vasha:+7]",              7],
];
for (const [narrative, expected] of damageNarratives) {
  const out = await extract(narrative);
  check(
    `"${narrative.slice(0, 50)}…" → hp_delta=${expected}`,
    out.hp_delta === expected,
    `extractor returned ${out.hp_delta}, expected ${expected}`,
  );
}

// ── 4. Vague amounts use non-round estimates (not "always 50") ───────────────
console.log("\n=== Vague amounts — estimates should vary (not all be round) ===");
{
  const samples = [];
  // Run 4 fresh estimations — they should not all return the same round number
  for (let i = 0; i < 4; i++) {
    const out = await extract("The party finds a handful of gold coins.");
    samples.push(out.gold_delta);
  }
  console.log(`  Sampled estimates: ${samples.join(", ")}`);
  const allRound = samples.every(v => v % 5 === 0);
  check(
    "vague-handful estimates should NOT all be multiples of 5",
    !allRound,
    `samples were ${samples.join(", ")} — model is biased to round numbers`,
  );
  const allInRange = samples.every(v => v >= 5 && v <= 50);
  check(
    "vague-handful estimates land in the expected 8-37 range (some tolerance)",
    allInRange,
    `samples were ${samples.join(", ")} — out of range`,
  );
}

// ── 5. XP awards must be exact when stated ───────────────────────────────────
console.log("\n=== Stated XP amounts — must be exact ===");
const xpNarratives = [
  ["Randiezel gains 75 XP for sneaking past the guard.", 75],
  ["You earn 123 XP for defeating the troll.",          123],
];
for (const [narrative, expected] of xpNarratives) {
  const out = await extract(narrative);
  check(
    `"${narrative.slice(0, 50)}…" → xp_award≈${expected}`,
    // XP can be inferred lower than stated (the model has inference rules), so allow ≥ expected
    out.xp_award === expected,
    `extractor returned ${out.xp_award}, expected ${expected}`,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
