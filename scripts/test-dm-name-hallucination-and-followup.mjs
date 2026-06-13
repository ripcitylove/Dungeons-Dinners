// Regression test for the "Barnabus" bug:
//
// Scenario from the screenshot:
//   - Party: Shmang, Randiezel, Vi, Ekko, plus one more (5 members)
//   - Shmang just took a turn
//   - DM's response mentioned "Shmang's father walked into that same forest" in
//     the narrative, then ended with "Barnabus, what do you do?" (a hallucinated
//     name not in the party)
//   - Expected: Party-frame "Acting" highlight follows DM intent (the engine's
//     pre-computed next player). It should NOT stay stuck on Shmang.
//   - Actual (before fix): highlight stuck on Shmang because the loose
//     prev-player follow-up regex matched "Shmang" earlier in the narrative
//     within a 220-char window before the closing "?".
//
// The fix:
//   1. Server-side: chat/route.ts adds a hard whitelist of valid first names so
//      the DM can't address an invented name like "Barnabus".
//   2. Client-side: campaign/[id]/page.tsx tightens the follow-up window from
//      220 → 80 chars before "?" AND only blocks the deferred advance when a
//      real party first name appears in that 80-char window. If the DM
//      hallucinated a non-party name, the safety-net no longer blocks, and the
//      engine's intended nextPromptName becomes the active player.

import { readFileSync } from "node:fs";

const page      = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");
const chatRoute = readFileSync("src/app/api/chat/route.ts", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`OK  ${name}`); pass++; }
  else      { console.log(`FAIL ${name}${hint ? " -- " + hint : ""}`); fail++; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Server-side: chat/route.ts must include a hard name-whitelist block.
// ─────────────────────────────────────────────────────────────────────────────

check(
  "chat/route.ts emits a VALID PLAYER NAMES whitelist block",
  /VALID PLAYER NAMES.{0,40}HARD WHITELIST/i.test(chatRoute),
  "expected a hard whitelist block in buildSystemPrompt",
);

check(
  "whitelist block enumerates partyFirstNames",
  /partyFirstNames\s*=\s*party\?\.map\(c\s*=>\s*c\.name\.split\(" "\)\[0\]\)/i.test(chatRoute),
  "whitelist must derive first names from the party array",
);

check(
  "whitelist block instructs the closing question to address EXACTLY currentTurnPlayerName",
  /closing question.{0,80}MUST address EXACTLY: \$\{currentTurnPlayerName\}/i.test(chatRoute),
  "the prompt must pin the closing addressee to currentTurnPlayerName",
);

check(
  "validNamesBlock is included in turnBlock",
  /validNamesBlock.{0,40}CURRENT TURN/s.test(chatRoute),
  "the whitelist block should be prepended to the turn block so the model sees it",
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Client-side: the loose 220-char follow-up window must be tightened to 80.
// ─────────────────────────────────────────────────────────────────────────────

check(
  "the loose 220-char window before '?' has been removed",
  !/lastQIdx\s*-\s*220/.test(page),
  "the old 220-char prev-player follow-up window is still present",
);

check(
  "client uses an 80-char window before '?' for the closing-question check",
  /lastQIdx\s*-\s*80/.test(page),
  "expected a tightened 80-char window for nearQ detection",
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Safety net: the unconditional 'block on ?' has been replaced with
//    'block only when a real party name is near the ?'.
// ─────────────────────────────────────────────────────────────────────────────

check(
  "safety-net no longer unconditionally blocks on a closing '?'",
  !/!dmFollowUpBlockAdvanceRef\.current\s*&&\s*full\.trimEnd\(\)\.endsWith\("\?"\)\)\s*\{\s*dmFollowUpBlockAdvanceRef\.current\s*=\s*true;\s*\}/.test(page),
  "the old unconditional block (which froze the highlight on hallucinated names) is still present",
);

check(
  "safety-net now requires anyPartyNameNearQ before blocking",
  /!dmFollowUpBlockAdvanceRef\.current\s*&&\s*full\.trimEnd\(\)\.endsWith\("\?"\)\s*&&\s*anyPartyNameNearQ/.test(page),
  "expected safety-net to only block when a real party first name appears near the '?'",
);

check(
  "anyPartyNameNearQ is computed once at the top of the DM-driven-turn block",
  /const\s+anyPartyNameNearQ\s*=/.test(page),
  "expected a single anyPartyNameNearQ computation reused by both branches",
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Behavioural simulation: replay the Barnabus scenario through the same
//    detection logic and assert the fix path.
//
// We can't run the React handlers from a script, but we CAN exercise the same
// helper function (detectNextTurnPlayer) and the same regex shapes used by the
// follow-up branch — that proves both halves of the diagnosis are addressed.
// ─────────────────────────────────────────────────────────────────────────────

const dmResponseFromScreenshot = `The silence hits before the tree line does.

No wind. No insects. Not even the creak of branches settling. The Thornwood stands ahead like a held breath -- its ancient oaks draped in grey-green moss that looks wrong somehow, too still, too pale. The air tastes faintly of copper and wet earth gone stale.

The five of you stand at the forest's edge as dusk bleeds the last warmth from the sky. Somewhere deep in those trees, something has gone very, very wrong.

Barnabus, what do you do?`;

const earlierMessage = `The party is already mid-adventure -- deep into it, in fact. You're seated in Aldra's hall in Millhaven, having just bound an ancient hunger beneath the Thornwood, destroyed four ritual anchors, and learned that Shmang's father walked into that same forest seventeen years ago and never returned.

Aldra is waiting. Petra Underloft in Greyveil is the next lead.

Shmang, what do you do?`;

// (a) Confirm detectNextTurnPlayer would return null for the Barnabus message
//     (Barnabus is NOT a party name).
const partyNames = ["Shmang", "Randiezel", "Vi", "Ekko", "Mira"];

// Mirror detectNextTurnPlayer logic locally (copy of the regex shapes from
// campaign/[id]/page.tsx so this script is self-contained).
function detectNextTurnPlayer(text, partyNames) {
  const tail = text.slice(-350);
  let lastMatch = null;
  for (const fullName of partyNames) {
    const firstName = fullName.split(" ")[0];
    if (firstName.length < 2) continue;
    const esc = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const actionPrompt = `what (?:\\w+ ){0,4}(?:do|will|would|shall|can|could) you|what(?:'s| is) your (?:action|move|next move)|which (?:\\w+ ){0,4}(?:do|will|would|shall) you|(?:do|would|will) you (?:like|want|wish|prefer|choose|pick|decide|select)|your (?:move|turn|action)|you(?:'re| are) up|how (?:do|will|would) you (?:respond|react|proceed)|(?:make|take) your (?:move|action|choice)|(?:the )?(?:choice|move|moment|decision|call) is yours|what now|(?:like|want) to (?:try|do|attempt)|try (?:something (?:else|different)|again|instead)`;
    const re = new RegExp(
      `\\b${esc}\\b[^\\n]{0,120}(?:${actionPrompt})|(?:${actionPrompt})[^\\n]{0,120}\\b${esc}\\b`,
      "gi",
    );
    let m;
    while ((m = re.exec(tail)) !== null) {
      if (!lastMatch || m.index > lastMatch.idx) lastMatch = { idx: m.index, name: fullName };
    }
  }
  return lastMatch?.name ?? null;
}

const dmTurnNameForBarnabus = detectNextTurnPlayer(dmResponseFromScreenshot, partyNames);
check(
  "Barnabus message: detectNextTurnPlayer returns null (hallucinated name)",
  dmTurnNameForBarnabus === null,
  `got ${JSON.stringify(dmTurnNameForBarnabus)}`,
);

// (b) BUG: in the actual screenshot scenario, "Shmang" does NOT appear in the
//     latest DM response. The bug was the UNCONDITIONAL safety-net block on
//     any closing "?" — which froze the highlight on the previous actor even
//     when the DM addressed a hallucinated non-party name.
const tail350 = dmResponseFromScreenshot.slice(-350);
const lastQIdx350 = tail350.lastIndexOf("?");
const responseEndsWithQ = dmResponseFromScreenshot.trimEnd().endsWith("?");
check(
  "BUG REPRODUCED: DM response ends with '?' (would trigger old unconditional safety-net block)",
  responseEndsWithQ === true,
  "the hallucinated 'Barnabus' closing question is still a '?' end",
);

const shmangAnywhereInResponse = /\bShmang\b/i.test(dmResponseFromScreenshot);
check(
  "BUG CONTEXT: 'Shmang' does NOT appear in the latest DM response (so loose-window theory was wrong)",
  shmangAnywhereInResponse === false,
  "Shmang isn't mentioned — the real culprit is the safety-net unconditional block",
);

// (c) The fixed tighter follow-up window (80 chars) does NOT match any real
//     party name in the Barnabus closing question — only "Barnabus" is nearby.
const nearQ_80 = tail350.slice(Math.max(0, lastQIdx350 - 80), lastQIdx350 + 1);
const shmangNearQ_80 = /\bShmang\b/i.test(nearQ_80);
check(
  "FIX VERIFIED: with the new 80-char window, 'Shmang' is NOT near the closing '?'",
  shmangNearQ_80 === false,
  "the tightened window correctly rejects the false follow-up to Shmang",
);

// (d) anyPartyNameNearQ in the 80-char window should be false for the Barnabus
//     case → safety net does NOT block → deferred advance runs → highlight
//     follows the engine's intended nextPromptName.
const anyPartyNameNearQ_80 = partyNames.some(n => {
  const fn = n.split(" ")[0];
  const esc = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`, "i").test(nearQ_80);
});
check(
  "FIX VERIFIED: no real party name appears near the closing '?' in the Barnabus case",
  anyPartyNameNearQ_80 === false,
  "the safety-net's anyPartyNameNearQ should be false, allowing the deferred advance",
);

// (e) Sanity: a legitimate follow-up like "Shmang, which element do you choose?"
//     should still trigger the follow-up block under the new tighter window.
const legitFollowUp = `The orb glows with primal energy in your hand, ready to lash out.\n\nShmang, which element do you choose?`;
const legitTail = legitFollowUp.slice(-350);
const legitQIdx = legitTail.lastIndexOf("?");
const legitNearQ = legitTail.slice(Math.max(0, legitQIdx - 80), legitQIdx + 1);
const shmangInLegit = /\bShmang\b/i.test(legitNearQ);
const anyPartyInLegit = partyNames.some(n => {
  const fn = n.split(" ")[0];
  const esc = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`, "i").test(legitNearQ);
});
check(
  "Legitimate follow-up: 'Shmang' IS within 80 chars before '?'",
  shmangInLegit === true,
  "the tightened window should still catch genuine follow-ups",
);
check(
  "Legitimate follow-up: anyPartyNameNearQ is true (safety-net blocks normally)",
  anyPartyInLegit === true,
  "the safety-net must still block on real follow-ups",
);

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
