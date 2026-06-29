// NPC identity-resolution battery. Verifies sameNpcName() merges the SAME
// character referred to by different labels (the duplicate-card bug) while
// keeping genuinely distinct same-role NPCs separate.
// Run: `npx tsx scripts/test-npc-matching.ts`
import { sameNpcName, dedupeEnteredNpcs, mergeNpcRoster, resetNpcRoster, isPlayerName, dropPlayerNpcs,
  parseNpcTags, applyNpcRenames, inferRenameFromGoneEnter, inferRevealRenames, isAnonymousDescriptor, hasProperName,
  looksLikeNameReveal } from "../src/lib/npcTags.ts";

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

// ── Player-vs-NPC guard (players must never become NPC cards) ──
const party = ["Lyra Quickwit", "Grimm Hollowvoice"];
let playerPass = 0;
const playerFail: string[] = [];
const pCheck = (label: string, got: boolean, expect: boolean) => {
  if (got === expect) playerPass++;
  else playerFail.push(`  [${label}] expected ${expect} got ${got}`);
};
pCheck("first name matches player", isPlayerName("Lyra", party), true);
pCheck("full name matches player", isPlayerName("Lyra Quickwit", party), true);
pCheck("player + epithet matches", isPlayerName("Lyra the Bard", party), true);
pCheck("other player first name", isPlayerName("Grimm", party), true);
pCheck("real NPC not a player", isPlayerName("Bram Hollowcask", party), false);
pCheck("real NPC first name not a player", isPlayerName("Bram", party), false);
pCheck("no party = nothing is a player", isPlayerName("Lyra", []), false);
// Roster filter strips the mis-tagged player while keeping real NPCs.
{
  const filtered = dropPlayerNpcs([n("Lyra"), n("Bram Hollowcask"), n("Grimm the Warlock"), n("Sella")], party);
  const names = filtered.map(x => x.name);
  const ok = names.length === 2 && names[0] === "Bram Hollowcask" && names[1] === "Sella";
  if (ok) playerPass++; else playerFail.push(`  [dropPlayerNpcs] expected [Bram Hollowcask, Sella] got [${names.join(", ")}]`);
}

// ── Identity reveal (descriptor -> proper name) ──
let renamePass = 0;
const renameFail: string[] = [];
const rCheck = (label: string, cond: boolean) => { if (cond) renamePass++; else renameFail.push(`  [${label}]`); };

// parse the explicit tag
{
  const { renamed } = parseNpcTags("He lowers his hood. [NPC-RENAME:Hooded Stranger:Garrick Vane]");
  rCheck("parses [NPC-RENAME]", renamed.length === 1 && renamed[0].from === "Hooded Stranger" && renamed[0].to === "Garrick Vane");
}
// rename keeps the SAME portrait, only the name changes
{
  const prev = [{ name: "Hooded Stranger", desc: "a figure in a dark hood", portrait_url: "face.png" }];
  const out = applyNpcRenames(prev, [{ from: "Hooded Stranger", to: "Garrick Vane" }]);
  rCheck("rename updates name", out.length === 1 && out[0].name === "Garrick Vane");
  rCheck("rename keeps portrait", (out[0] as { portrait_url?: string }).portrait_url === "face.png");
}
// renaming onto an existing card collapses the two (no duplicate)
{
  const prev = [{ name: "Hooded Stranger", desc: "", portrait_url: "face.png" }, { name: "Garrick", desc: "scarred" }];
  const out = applyNpcRenames(prev, [{ from: "Hooded Stranger", to: "Garrick Vane" }]);
  rCheck("rename collapses onto existing", out.length === 1 && out[0].name === "Garrick Vane");
}
// anonymous-descriptor / proper-name classification
rCheck("hooded stranger is anon", isAnonymousDescriptor("Hooded Stranger") && !hasProperName("Hooded Stranger"));
rCheck("the old man is anon", isAnonymousDescriptor("the old man"));
rCheck("Garrick Vane is proper", hasProperName("Garrick Vane") && !isAnonymousDescriptor("Garrick Vane"));
rCheck("the guard is NOT anon-descriptor", !isAnonymousDescriptor("the guard"));
// captive/condition descriptors now count as anonymous (the "Bound Woman" -> "Sera" bug)
rCheck("Bound Woman is anon", isAnonymousDescriptor("Bound Woman") && !hasProperName("Bound Woman"));
rCheck("Wounded Soldier is anon", isAnonymousDescriptor("Wounded Soldier"));
rCheck("Sera is proper", hasProperName("Sera") && !isAnonymousDescriptor("Sera"));
{
  const prev = [{ name: "Bound Woman", desc: "a captive bound to a chair", portrait_url: "f.png" }];
  const inf = inferRenameFromGoneEnter(prev, [n("Sera", "young woman, ropes cut")], ["Bound Woman"]);
  rCheck("Bound Woman renames to Sera (gone+enter)", !!inf && inf.from === "Bound Woman" && inf.to === "Sera");
}
// gone+enter backstop fires for an anon card replaced by one named NPC
{
  const prev = [{ name: "Hooded Stranger", desc: "", portrait_url: "f.png" }];
  const inf = inferRenameFromGoneEnter(prev, [n("Garrick Vane", "tall swordsman")], ["Hooded Stranger"]);
  rCheck("backstop infers reveal", !!inf && inf.from === "Hooded Stranger" && inf.to === "Garrick Vane");
}
// backstop does NOT fire when a real/role NPC leaves and a named NPC arrives (genuine swap)
{
  const prev = [{ name: "Bram Hollowcask", desc: "", portrait_url: "f.png" }];
  const inf = inferRenameFromGoneEnter(prev, [n("Garrick Vane")], ["Bram Hollowcask"]);
  rCheck("backstop ignores named departure", inf === null);
}
{
  const prev = [{ name: "the guard", desc: "", portrait_url: "f.png" }];
  const inf = inferRenameFromGoneEnter(prev, [n("Mira")], ["the guard"]);
  rCheck("backstop ignores role departure", inf === null);
}
// feature-overlap reveal: new named NPC whose desc restates the anon card's feature
{
  const prev = [{ name: "Hooded Stranger", desc: "a figure in a dark hood, motionless", portrait_url: "f.png" }];
  const inf = inferRevealRenames(prev, [n("Mira", "lean woman, scar through one brow, hood pushed back")]);
  rCheck("feature reveal links by 'hood'", inf.length === 1 && inf[0].from === "Hooded Stranger" && inf[0].to === "Mira");
  // end-to-end: applying it renames + keeps the portrait
  const after = applyNpcRenames(prev, inf);
  rCheck("feature reveal keeps portrait", after.length === 1 && after[0].name === "Mira" && (after[0] as { portrait_url?: string }).portrait_url === "f.png");
}
// feature reveal does NOT fire without a shared feature (could be a genuinely new NPC)
{
  const prev = [{ name: "Hooded Stranger", desc: "a figure in a dark hood", portrait_url: "f.png" }];
  const inf = inferRevealRenames(prev, [n("Bram", "a barrel-chested innkeeper with a grey moustache")]);
  rCheck("feature reveal needs shared feature", inf.length === 0);
}
// feature reveal does NOT fire against a NAMED card (only anonymous descriptors)
{
  const prev = [{ name: "Bram Hollowcask", desc: "wears a hooded cloak", portrait_url: "f.png" }];
  const inf = inferRevealRenames(prev, [n("Mira", "hood up")]);
  rCheck("feature reveal ignores named card", inf.length === 0);
}
// prose name-reveal cue detection (the "Daveth" bug — DM names in prose, no tag)
rCheck("cue: quoted name + says", looksLikeNameReveal('He glances at her. "Daveth," he says quietly.') === true);
rCheck("cue: my name is", looksLikeNameReveal('The woman rasps, "My name is Sera."') === true);
rCheck("cue: call me", looksLikeNameReveal('"Call me Garrick," he offers.') === true);
rCheck("cue: introduces himself", looksLikeNameReveal("She introduces herself as Mira.") === true);
rCheck("cue: plain narration has no reveal", looksLikeNameReveal("The stranger watches from the corner, silent.") === false);
rCheck("cue: quoted command is not a name", looksLikeNameReveal('"Run!" he shouts, drawing his blade.') === false);

console.log(`\nNPC matching battery: ${pass}/${CASES.length} passed.`);
console.log(`NPC roster-merge battery: ${rosterPass}/${rosterPass + rosterFail.length} passed.`);
console.log(`NPC player-guard battery: ${playerPass}/${playerPass + playerFail.length} passed.`);
console.log(`NPC identity-reveal battery: ${renamePass}/${renamePass + renameFail.length} passed.`);
if (failures.length || rosterFail.length || playerFail.length || renameFail.length) {
  console.log(`\nFAILURES:`);
  console.log([...failures, ...rosterFail, ...playerFail, ...renameFail].join("\n"));
  process.exitCode = 1;
} else {
  console.log("✓ All NPC identity + roster-merge + player-guard + identity-reveal cases resolve correctly.");
}
