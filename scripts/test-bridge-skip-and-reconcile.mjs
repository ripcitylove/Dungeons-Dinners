// Regression test for the "Vi was skipped" bug.
//
// Root cause: when the player submitted the LAST action of a round, the system
// fired TWO sendToAI calls back-to-back at the same timestamp:
//   1. A "bridge" message — the DM was supposed to narrate ONLY the last
//      player's outcome in 1-2 sentences and stop. In practice the DM often
//      ignored that rule and asked the next-in-line player a question.
//   2. The reconciliation message that narrated everyone's round.
// Visually this looked like the next-in-line player's turn was skipped.
//
// Fix: when allActedForDM is true, handleSend skips the bridge entirely and
// calls triggerReconciliation directly. The chat prompt's pendingReconcileBlock
// is also tightened as defense-in-depth (multi-client races could still hit it).

import { readFileSync } from "node:fs";

const page      = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");
const chatRoute = readFileSync("src/app/api/chat/route.ts", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── Bridge flow: the previous "skip bridge entirely" short-circuit was
//    intentionally removed because it prevented [NO-TURN] from firing when
//    the failed action happened to be the last submission of a round. The
//    strengthened bridge prompt + [NO-TURN] tag now defend together.
const handleSendBody = page.match(/const handleSend = async[\s\S]*?\n {2}\};/);
check("handleSend located", !!handleSendBody);
if (handleSendBody) {
  const body = handleSendBody[0];

  check(
    "old short-circuit 'if (allActedForDM) { await triggerReconciliation; return }' is removed",
    !/if \(allActedForDM\) \{[\s\S]{0,400}?await triggerReconciliation\(updatedMessages, summary\);[\s\S]{0,200}?return;/.test(body),
    "short-circuit still present — would prevent [NO-TURN] from working on last action",
  );

  check(
    "sendToAI bridge call still happens for every action including allActed",
    /await sendToAI\(updatedMessages, false, \{[\s\S]*?allActed:\s*allActedForDM/.test(body),
    "bridge call missing — [NO-TURN] can't fire if sendToAI isn't called",
  );

  check(
    "pendingReconciliation is still picked up after sendToAI returns",
    /const pending = pendingReconciliationRef\.current[\s\S]*?if \(pending\)[\s\S]*?await triggerReconciliation\(pending\.messages, pending\.summary\)/.test(body),
  );
}

// ── Bridge prompt defense-in-depth ──────────────────────────────────────────
check(
  "pendingReconcileBlock labels the response as BRIDGE RESPONSE ONLY",
  /BRIDGE RESPONSE ONLY/.test(chatRoute),
);
check(
  "pendingReconcileBlock has ABSOLUTE RULES with numbered violations",
  /ABSOLUTE RULES FOR THIS RESPONSE — VIOLATING ANY OF THESE IS A CRITICAL ERROR/.test(chatRoute),
);
check(
  "rule explicitly forbids ending with a question",
  /NEVER end with a question/.test(chatRoute),
);
check(
  "rule explicitly forbids 'what do you do?' phrasings",
  /what do you do\?/.test(chatRoute) && /what now\?/.test(chatRoute) && /how do you respond\?/.test(chatRoute),
);
check(
  "rule explicitly forbids naming any other player",
  /NEVER name any other player/.test(chatRoute),
);
check(
  "rule includes Good and Bad examples for the bridge format",
  /Good examples \(correct bridge format\):/.test(chatRoute)
  && /Bad examples \(any of these is a critical error\):/.test(chatRoute),
);

// ── Reconciliation flow still works ──────────────────────────────────────────
const reconcileBlockBody = chatRoute.match(/const reconcileBlock = roundSummary\?\.length[\s\S]*?: "";/);
check("reconcileBlock still defined", !!reconcileBlockBody);
if (reconcileBlockBody) {
  const body = reconcileBlockBody[0];
  check(
    "reconcileBlock still enforces 'only listed names can be subjects of action verbs'",
    /ONLY these names[\s\S]*?may be the subject of an action verb in your response/.test(body),
  );
  check(
    "reconcileBlock still forbids ending with '[Name], what do you do?'",
    /Do NOT end with "\[Name\], what do you do\?"/.test(body),
  );
}

// ── triggerReconciliation still resets round state ──────────────────────────
const triggerReconcileBody = page.match(/const triggerReconciliation = async[\s\S]*?\};/);
check(
  "triggerReconciliation still clears roundActions",
  !!triggerReconcileBody && /roundActionsRef\.current = \[\];[\s\S]*?setRoundActions\(\[\]\)/.test(triggerReconcileBody[0]),
);
check(
  "triggerReconciliation still resets currentTurnIndex to 0 (round restart)",
  !!triggerReconcileBody && /setCurrentTurnIndex\(0\);[\s\S]*?currentTurnIndexRef\.current = 0/.test(triggerReconcileBody[0]),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
