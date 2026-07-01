// Backfill: enemies the DM narrated as killed but that got stuck on-screen because
// the old defeat guard required the EXACT roster label ("Corrupted Miner #3") near a
// kill word, while the DM narrates kills with the bare type ("the miner collapses").
// Uses the SAME defeatNamePattern the live route now uses. SAFE: only marks an enemy
// defeated when a defeat phrase for its name appears in a DM message written AFTER that
// enemy spawned — so a living enemy is never removed, and an old kill of a same-named
// foe from an earlier fight never bleeds onto a newer one.
// Run:  node scripts/backfill-enemy-defeats.mjs         (dry run — reports only)
//       node scripts/backfill-enemy-defeats.mjs --apply (writes is_defeated=true)
import { readFileSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { createClient } = await import("@supabase/supabase-js");
const { defeatIdentityPattern, DEFEAT_WORDS } = await import("../src/lib/enemyDefeat.ts");

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: allActive, error } = await sb
  .from("campaign_enemies")
  .select("id, campaign_id, name, condition, is_defeated, created_at")
  .eq("is_defeated", false);
if (error) { console.error(error.message); process.exit(1); }
// A demoted kill always lands on condition "critical" (the classifier's "defeated"
// gets knocked down), NEVER "healthy". So a healthy active enemy was never flagged
// dead — excluding them removes a whole class of false positives (a same-named foe
// wrongly matched by a recap of a past fight).
const enemies = allActive.filter(e => e.condition !== "healthy");
console.log(`Active enemies to check (excluding healthy): ${enemies.length} of ${allActive.length}\n`);

// Group by campaign; fetch each campaign's DM messages once.
const byCampaign = {};
for (const e of enemies) (byCampaign[e.campaign_id] ??= []).push(e);

const toDefeat = [];
for (const [campId, list] of Object.entries(byCampaign)) {
  const { data: msgs } = await sb
    .from("campaign_messages")
    .select("content, created_at")
    .eq("campaign_id", campId).eq("role", "dm")
    .order("created_at", { ascending: true });
  // Skip [RECAP] messages — resume-recaps re-narrate PAST events (including old
  // kills of same-named foes) and are not live combat resolution.
  const dm = (msgs ?? []).filter(m => !/\[RECAP\]/i.test(m.content));
  for (const e of list) {
    const re = new RegExp(defeatIdentityPattern(e.name, DEFEAT_WORDS), "i");
    // Only DM messages written AFTER this specific enemy spawned.
    const killMsg = dm.find(m => (!e.created_at || m.created_at >= e.created_at) && re.test(m.content));
    if (killMsg) toDefeat.push({ ...e, evidence: killMsg.content.replace(/\s+/g, " ").slice(0, 120) });
  }
}

console.log(`Enemies with narrative evidence of death (stuck-dead): ${toDefeat.length}\n`);
for (const e of toDefeat) {
  console.log(`  ${e.condition.padEnd(9)} ${e.name}  (camp ${e.campaign_id.slice(0, 8)})`);
  console.log(`     ↳ "${e.evidence}"`);
}

if (!toDefeat.length) { console.log("\nNothing to backfill."); process.exit(0); }
if (!APPLY) { console.log(`\nDRY RUN — re-run with --apply to mark these ${toDefeat.length} enemies defeated.`); process.exit(0); }

let done = 0;
for (const e of toDefeat) {
  const { error: uErr } = await sb.from("campaign_enemies")
    .update({ is_defeated: true, condition: "defeated" }).eq("id", e.id);
  if (uErr) console.error(`  ✗ ${e.name}: ${uErr.message}`); else done++;
}
console.log(`\n✅ Marked ${done}/${toDefeat.length} enemies defeated. Their cards will drop on the next load/broadcast.`);
