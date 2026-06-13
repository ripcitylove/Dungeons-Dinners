// Regression test for the two bugs:
//   1. After a self-cast spell (False Life, Mage Armor, etc.) the DM kept
//      addressing the same player and the turn never advanced.
//   2. Temp HP granted by False Life never appeared on the character card
//      because (a) the DM sometimes narrated it without a specific number
//      and (b) only the chat-state async path applied it — leaving the card
//      blank during the streaming window.

import { readFileSync } from "node:fs";

const page       = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");
const chatRoute  = readFileSync("src/app/api/chat/route.ts", "utf8");
const stateRoute = readFileSync("src/app/api/chat-state/route.ts", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── parseThpTag helper exists on the client ──────────────────────────────────
check(
  "parseThpTag helper declared",
  /function parseThpTag\(text: string, firstName: string\): number/.test(page),
);
check(
  "parseThpTag uses the [THP:Name:+N] format",
  /new RegExp\(`\\\\\[THP:\$\{n\}:\\\\\+\?\(\\\\d\+\)\\\\\]`, "gi"\)/.test(page),
);
check(
  "parseThpTag keeps the HIGHEST grant (5e: temp HP doesn't stack)",
  /maxGrant = Math\.max\(maxGrant, parseInt\(m\[1\], 10\)\)/.test(page),
);

// ── Client-side fast THP application iterates the entire party ───────────────
check(
  "fast THP detection runs against every party member, not just the actor",
  /for \(const partyMember of campaignPartyRef\.current\)/.test(page)
  && /const thpGrant = parseThpTag\(full, firstName\)/.test(page),
);
check(
  "fast THP write respects 'doesn't stack' rule (skip when current >= grant)",
  /if \(thpGrant <= currentThp\) continue;/.test(page),
);
check(
  "fast THP path writes class_resources.temp_hp",
  /const newRes = \{ \.\.\.\(partyMember\.class_resources \?\? \{\}\), temp_hp: thpGrant \};/.test(page),
);
check(
  "fast THP path broadcasts character_sync to peers",
  /event: "character_sync",\s*payload: \{ charId: partyMember\.id, class_resources: newRes \}/.test(page),
);

// ── Display strips [THP:Name:N] tags from chat ──────────────────────────────
check(
  "stripSystemLeaks removes [THP:...] tags so they don't show in chat",
  /\.replace\(\/\\\[THP:\[\^\\\]\]\+\\\]\/gi, ""\)/.test(page),
);

// ── chat-state extractor honors [THP:Name:N] as authoritative ───────────────
check(
  "chat-state prompt has explicit THP TAG PRIORITY rule",
  /THP TAG PRIORITY/.test(stateRoute),
);
check(
  "chat-state prompt shows the exact [THP:Name:+N] form (e.g. [THP:Mira:+7])",
  /\[THP:[A-Z][a-z]+:\+\d+\]/.test(stateRoute),
);

// ── DM prompt now requires the [THP:Name:+N] tag whenever temp HP is granted ─
check(
  "chat route has TEMP HP TAGS rule",
  /TEMP HP TAGS — mandatory/.test(chatRoute),
);
check(
  "DM prompt names False Life by example",
  /False Life \(1d4\+4\)/.test(chatRoute),
);
check(
  "DM prompt requires a SPECIFIC INTEGER in every THP tag",
  /roll the dice yourself to a specific integer/.test(chatRoute),
);

// ── DM prompt enforces turn pass after self-cast / self-buff actions ────────
check(
  "chat route has ACTION CONSUMES THE TURN rule",
  /ACTION CONSUMES THE TURN — NO EXCEPTIONS/.test(chatRoute),
);
check(
  "rule explicitly names spells-on-self as consuming the turn",
  /False Life, Mage Armor, Shield of Faith, Bless/.test(chatRoute),
);
check(
  "rule calls 'address same player twice' a CRITICAL VIOLATION",
  /CRITICAL VIOLATION of turn order/.test(chatRoute),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
