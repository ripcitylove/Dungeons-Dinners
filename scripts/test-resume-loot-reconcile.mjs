// Regression test for the resume-loot reconciliation:
//   • A `reconcileResumeLoot` function exists and is idempotent.
//   • It runs ONLY on the resume path (Begin Adventure when resumeNarrationRef is set).
//   • It dedups items / weapons against current inventory.
//   • It gates gold restoration behind "items were also missing".
//   • It SKIPS HP / XP / spell slots (re-applying would double-count).

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

const src = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");
const agents = readFileSync("AGENTS.md", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── AGENTS.md updated with the user's safety rule ────────────────────────────
check(
  "AGENTS.md contains the 'never fix a bug in a way that creates new bugs' rule",
  /Never fix a bug in a way that could create other issues or create new bugs\. Always test and re-test fixes to ensure integrity is upheld and fixes are solid\./.test(agents),
);

// ── Reconcile function present and exported via useCallback ──────────────────
const fnMatch = src.match(/const reconcileResumeLoot = useCallback\(async \(\) => \{[\s\S]*?\}, \[charWrite, charNameMatches\]\);/);
check("reconcileResumeLoot defined", !!fnMatch);

const fnBody = fnMatch ? fnMatch[0] : "";

// ── Idempotency: marks ref BEFORE awaiting, returns early on second call ─────
check(
  "resumeLootReconciledRef declared",
  /const resumeLootReconciledRef\s*=\s*useRef<boolean>\(false\)/.test(src),
);
check(
  "reconcile bails immediately if already run",
  /if \(resumeLootReconciledRef\.current\) return;/.test(fnBody),
  "must short-circuit on subsequent calls",
);
check(
  "reconcile marks ref BEFORE any await (prevents concurrent re-entry)",
  /resumeLootReconciledRef\.current = true;[\s\S]*?await/.test(fnBody),
);

// ── Pulls the latest DM message from messagesRef ─────────────────────────────
check(
  "pulls last DM message from messagesRef",
  /messagesRef\.current[\s\S]*?\.reverse\(\)\.find\(m => m\.role === "dm"\)/.test(fnBody),
);

// ── Uses /api/chat-state to extract state from that message ──────────────────
check(
  "calls /api/chat-state for state extraction",
  /fetch\("\/api\/chat-state"/.test(fnBody),
);

// ── Resolves recipient by name → actor → no fallback to local user ───────────
check(
  "target resolved from change.target_name first",
  /change\.target_name[\s\S]*?campaignPartyRef\.current\.find\([^)]*charNameMatches/.test(fnBody),
);
check(
  "target falls back to prevActingCharIdRef",
  /prevActingCharIdRef\.current[\s\S]*?campaignPartyRef\.current\.find/.test(fnBody),
);
check(
  "if no target resolved, function returns (no blind apply)",
  /if \(!target\) return;/.test(fnBody),
);

// ── Idempotent dedup for items / weapons / status effects ────────────────────
check(
  "items deduped against existing inventory (lowercase compare)",
  /itemsLower\s*=\s*new Set\([\s\S]*?\.toLowerCase\(\)\)/.test(fnBody)
  && /change\.items_gained\.filter\(i => !itemsLower\.has/.test(fnBody),
);
check(
  "weapons deduped against existing inventory",
  /weaponsLower\s*=\s*new Set\([\s\S]*?\.toLowerCase\(\)\)/.test(fnBody)
  && /change\.weapons_gained\.filter\(w => !weaponsLower\.has/.test(fnBody),
);
check(
  "status effects gained added only when not already present",
  /statusesLower\s*=\s*new Set/.test(fnBody)
  && /change\.status_effects_gained\.filter\(s => !statusesLower\.has/.test(fnBody),
);

// ── Gold gated on "items were missing" heuristic ─────────────────────────────
check(
  "gold restoration gated on lootWasMissing heuristic",
  /lootWasMissing\s*=\s*missingItems\.length > 0 \|\| missingWeapons\.length > 0/.test(fnBody)
  && /goldDelta\s*=\s*lootWasMissing && change\.gold_delta/.test(fnBody),
);

// ── HP / XP / spell slots NOT re-applied on resume ───────────────────────────
check(
  "HP delta NOT applied on resume reconciliation",
  !/hp_delta/.test(fnBody) || !/newHp/.test(fnBody),
  "found hp_delta application — could double-deduct damage",
);
check(
  "XP NOT re-awarded on resume reconciliation",
  !/xp_award/.test(fnBody) || !/newXp/.test(fnBody),
  "found xp_award application — could inflate XP",
);
check(
  "spell slots NOT re-consumed on resume reconciliation",
  !/spell_slots_used/.test(fnBody) || !/setSlotsUsed/.test(fnBody),
);

// ── Updates persist + broadcast ──────────────────────────────────────────────
check(
  "campaign party state + ref both updated",
  /setCampaignParty\(prev => prev\.map\(c => c\.id === target!\.id \? updated : c\)\)/.test(fnBody)
  && /campaignPartyRef\.current = campaignPartyRef\.current\.map\(c => c\.id === target!\.id \? updated : c\)/.test(fnBody),
);
check(
  "DB write fires via charWrite",
  /await charWrite\(target\.id, \{ inventory: newInventory, status_effects: newStatuses \}\)/.test(fnBody),
);
check(
  "broadcast character_sync to peers",
  /channelRef\.current\?\.send\(\{[\s\S]*?event: "character_sync"[\s\S]*?inventory: newInventory[\s\S]*?status_effects: newStatuses/.test(fnBody),
);
check(
  "user sees a notice describing the recovered loot",
  /Recovered loot for/.test(fnBody) && /setStateNotice/.test(fnBody),
);

// ── Item-detail enrichment fired for recovered DM-invented items ─────────────
check(
  "non-catalog items get queued for /api/item-details enrichment",
  /\/api\/item-details/.test(fnBody)
  && /!getItemByName\(name\)[\s\S]*?!WEAPON_TIPS\[name\][\s\S]*?!ITEM_TIPS\[name\]/.test(fnBody),
);

// ── Only triggered from the Begin-Adventure-Resume path ──────────────────────
check(
  "reconcileResumeLoot fired ONLY when resumeNarrationRef is set (resume path)",
  /if \(resumeNarrationRef\.current\) \{[\s\S]*?reconcileResumeLoot\(\)/.test(src),
);
check(
  "NOT fired from the new-campaign opening flow",
  // We only invoke reconcileResumeLoot at one call site
  (src.match(/reconcileResumeLoot\(\)/g) ?? []).length === 1,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
