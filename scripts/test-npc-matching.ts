// NPC identity-resolution battery. Verifies sameNpcName() merges the SAME
// character referred to by different labels (the duplicate-card bug) while
// keeping genuinely distinct same-role NPCs separate.
// Run: `npx tsx scripts/test-npc-matching.ts`
import { sameNpcName, dedupeEnteredNpcs, mergeNpcRoster, resetNpcRoster } from "../src/lib/npcTags.ts";

type Case = { a: string; b: string; expect: boolean; note?: string };

const CASES: Case[] = [
  // ── SAME character, different label → must MERGE (true) ──
  { a: "Eldrin", b: "Captain Eldrin", expect: true, note: "title added later" },
  { a: "the Innkeeper", b: "Innkeeper", expect: true, note: "leading article" },
  { a: "Mira", b: "Mira the Innkeeper", expect: true, note: "name + role suffix" },
  { a: "Eldrin", b: "Eldrin Hollowvoice", expect: true, note: "first vs full name" },
  { a: "Captain Reyes", b: "Reyes", expect: true, note: "title dropped" },
  { a: "the old man", b: "Old Man", expect: true, note: "article only differs (same descriptor)" },
  { a: "Sir Aldric", b: "Aldric", expect: true, note: "honorific" },
  { a: "GUARD", b: "guard", expect: true, note: "case-insensitive exact" },
  { a: "Lady Seraphine", b: "Seraphine", expect: true },
  { a: "Brother Tomas", b: "Tomas", expect: true },
  { a: "Mira", b: "mira", expect: true, note: "exact case-insensitive" },

  // ── DISTINCT characters → must stay SEPARATE (false) ──
  { a: "Tom the Guard", b: "Bob the Guard", expect: false, note: "two guards, shared token is generic" },
  { a: "the old man", b: "Eldrin", expect: false, note: "descriptor vs name (safe policy: no merge)" },
  { a: "the Innkeeper", b: "Mira", expect: false, note: "role vs name — DM-prompt fixes this, client stays safe" },
  { a: "Mira", b: "Reyes", expect: false, note: "two different names" },
  { a: "Captain Reyes", b: "Captain Mira", expect: false, note: "shared title only" },
  { a: "the guard", b: "the merchant", expect: false, note: "two different generic roles" },
  { a: "Eldrin", b: "Aldric", expect: false, note: "similar but different names" },
  { a: "the soldier", b: "the soldier on the left", expect: false, note: "shared token generic only" },
  { a: "Young Pip", b: "Old Pip", expect: true, note: "same name Pip, ages are titles → merge (one Pip)" },
];

let pass = 0;
const failures: string[] = [];
for (const c of CASES) {
  const got = sameNpcName(c.a, c.b);
  if (got === c.expect) pass++;
  else failures.push(`  [expected ${c.expect}, got ${got}] "${c.a}" vs "${c.b}"${c.note ? `  (${c.note})` : ""}`);
}

// ── Roster-merge integration (the exact helpers the campaign page calls) ──
const n = (name: string, desc = "") => ({ name, desc });
let rosterPass = 0;
const rosterFail: string[] = [];
const check = (label: string, got: { name: string }[], expectNames: string[]) => {
  const gotNames = got.map(g => g.name);
  const ok = gotNames.length === expectNames.length && gotNames.every((x, i) => x === expectNames[i]);
  if (ok) rosterPass++;
  else rosterFail.push(`  [${label}] expected [${expectNames.join(", ")}] got [${gotNames.join(", ")}]`);
};

// THE BUG: same character re-tagged under a shorter/variant name must NOT duplicate.
check("variant re-entry merges",
  mergeNpcRoster([n("Bram Hollowcask", "innkeeper")], [n("Bram", "wiping a mug")], []),
  ["Bram Hollowcask"]);
// Distinct same-role NPCs must both remain.
check("two guards stay separate",
  mergeNpcRoster([n("Tom the Guard")], [n("Bob the Guard")], []),
  ["Tom the Guard", "Bob the Guard"]);
// Two variant labels for one person in ONE response collapse to a single card.
check("intra-response dedupe",
  dedupeEnteredNpcs([n("Captain Eldrin", "stern"), n("Eldrin", "scarred")]),
  ["Captain Eldrin"]);
// A genuinely new NPC is added alongside existing.
check("new npc added",
  mergeNpcRoster([n("Bram Hollowcask")], [n("Sella", "fiddler")], []),
  ["Bram Hollowcask", "Sella"]);
// [NPC-GONE] by a variant name removes the right card.
check("gone by variant name",
  mergeNpcRoster([n("Bram Hollowcask"), n("Sella")], [], ["Bram"]),
  ["Sella"]);
// Scene reset reuses the existing card (keeps portrait) for a relabeled traveler.
const withFace = [{ name: "Bram Hollowcask", desc: "innkeeper", portrait_url: "x.png" }];
const reset = resetNpcRoster(withFace, [n("Bram", "carrying a lantern")], 6);
check("scene reset keeps identity", reset, ["Bram Hollowcask"]);
if (reset[0] && (reset[0] as { portrait_url?: string }).portrait_url !== "x.png") {
  rosterFail.push("  [scene reset keeps portrait] portrait_url was lost on relabel");
} else rosterPass++;

console.log(`\nNPC matching battery: ${pass}/${CASES.length} passed.`);
console.log(`NPC roster-merge battery: ${rosterPass}/${rosterPass + rosterFail.length} passed.`);
if (failures.length || rosterFail.length) {
  console.log(`\nFAILURES:`);
  console.log([...failures, ...rosterFail].join("\n"));
  process.exitCode = 1;
} else {
  console.log("✓ All NPC identity + roster-merge cases resolve correctly.");
}
