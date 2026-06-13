// Regression test for the campaign-resume recap.
//
// When a player clicks "Begin Adventure" on a campaign that already has prior
// messages, the engine should generate a brief, atmospheric AI recap that
// catches everyone up to where the party left off. Before the recap feature
// the resume branch just replayed the last DM message via TTS, which left
// returning players without context.
//
// The change touches two files:
//
//   src/app/api/chat/route.ts
//     - Accept a `resumeRecap` flag on the request.
//     - Build a [CAMPAIGN RESUME — RECAP MODE] system-prompt block that
//       instructs the DM to write a 2–3 paragraph recap, open with [RECAP],
//       and end by addressing currentTurnPlayerName.
//     - Replace "Continue the story." synthetic-user fallback with a recap
//       trigger string when resumeRecap is set.
//     - Bump max_tokens to 360 for recap mode.
//
//   src/app/campaign/[id]/page.tsx
//     - stripSystemLeaks strips the hidden [RECAP] tag from display.
//     - sendToAI opts accept isResumeRecap and forward it as resumeRecap.
//     - A new resumeRecapTriggeredRef guards re-triggering per page load.
//     - The resume branch checks the last DM message for a [RECAP] prefix
//       (so a freshly-generated recap isn't double-generated) and otherwise
//       triggers sendToAI({ isResumeRecap: true }) instead of just replaying
//       the last narration.

import { readFileSync } from "node:fs";

const page      = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");
const chatRoute = readFileSync("src/app/api/chat/route.ts", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`OK  ${name}`); pass++; }
  else      { console.log(`FAIL ${name}${hint ? " -- " + hint : ""}`); fail++; }
}

// ── chat/route.ts ────────────────────────────────────────────────────────────

check(
  "chat route declares resumeRecap on the buildSystemPrompt signature",
  /function buildSystemPrompt\([^)]*resumeRecap\?: boolean\)/.test(chatRoute),
  "buildSystemPrompt must accept resumeRecap?: boolean",
);

check(
  "chat route destructures resumeRecap from the POST body",
  /const \{[^}]*\bresumeRecap\b[^}]*\}\s*=\s*\(await req\.json\(\)\)/s.test(chatRoute),
  "POST handler must destructure resumeRecap",
);

check(
  "chat route declares resumeRecap?: boolean in the body type",
  /resumeRecap\?: boolean;/.test(chatRoute),
  "request body type must include resumeRecap",
);

check(
  "chat route builds a resumeRecapBlock",
  /const resumeRecapBlock\s*=\s*resumeRecap\s*&&\s*currentTurnPlayerName/.test(chatRoute),
  "resumeRecapBlock must be defined and guarded by both flags",
);

check(
  "resume recap block contains the [CAMPAIGN RESUME -- RECAP MODE] header",
  /\[CAMPAIGN RESUME .{0,3} RECAP MODE\]/.test(chatRoute),
  "missing recap mode header",
);

check(
  "resume recap block instructs the DM to emit [RECAP] on its own line",
  /\[RECAP\] on its own line/i.test(chatRoute),
  "missing [RECAP] tag instruction",
);

check(
  "resume recap block tells the DM to address currentTurnPlayerName at the end",
  /End your response by addressing \$\{currentTurnPlayerName\}/.test(chatRoute),
  "recap must end by addressing the active turn player",
);

check(
  "resume recap block forbids inventing NPCs / events / dice rolls",
  /Do NOT invent NPCs[\s\S]{0,200}Do NOT call for any dice roll/.test(chatRoute),
  "recap must stay faithful to history and not advance combat",
);

check(
  "resumeRecapBlock has highest precedence in multi-player prompt assembly",
  /\$\{resumeRecapBlock \|\| reconcileBlock \|\| turnSkipBlock \|\| turnBlock \|\| pendingReconcileBlock\}/.test(chatRoute),
  "the multi-player return must short-circuit to resumeRecapBlock first",
);

check(
  "resumeRecapBlock has highest precedence in solo-mode prompt assembly",
  /\$\{resumeRecapBlock \|\| reconcileBlock \|\| turnSkipBlock \|\| turnBlock\}/.test(chatRoute),
  "the solo return must short-circuit to resumeRecapBlock first",
);

check(
  "buildSystemPrompt is invoked with resumeRecap as the last argument",
  /buildSystemPrompt\([^)]*isQuestion,\s*resumeRecap\)/.test(chatRoute),
  "buildSystemPrompt call site must forward resumeRecap",
);

check(
  "synthetic-user fallback emits a recap trigger when resumeRecap is set",
  /resumeRecap\s*\?\s*"\[Resume the campaign.{0,80}\]"\s*:\s*"Continue the story\."/.test(chatRoute),
  "fallback push must branch on resumeRecap",
);

check(
  "max_tokens for recap mode is 360 (larger than normal turn budget)",
  /resumeRecap\s*\?\s*360\s*:/.test(chatRoute),
  "max_tokens should give the recap enough room",
);

// ── campaign/[id]/page.tsx ───────────────────────────────────────────────────

check(
  "stripSystemLeaks strips the hidden [RECAP] tag from display",
  /\.replace\(\/\\\[RECAP\\\]\\s\*\/gi, ""\)/.test(page),
  "the [RECAP] marker must not appear in user-facing display",
);

check(
  "sendToAI opts accept isResumeRecap?: boolean",
  /isResumeRecap\?: boolean;/.test(page),
  "sendToAI signature must expose isResumeRecap",
);

check(
  "sendToAI forwards resumeRecap to the chat API body",
  /\.\.\.\(opts\?\.isResumeRecap && \{ resumeRecap: true \}\)/.test(page),
  "the recap flag must be marshaled through to /api/chat",
);

check(
  "client has a resumeRecapTriggeredRef guard",
  /const resumeRecapTriggeredRef\s*=\s*useRef\(false\)/.test(page),
  "the re-trigger guard must exist",
);

check(
  "resume branch checks whether the last DM message already starts with [RECAP]",
  /const lastDmIsRecap\s*=\s*[!]+resumeNarrationRef\.current\s*&&\s*\/\^\\s\*\\\[RECAP\\\]\/i\.test\(resumeNarrationRef\.current\)/.test(page),
  "must detect an existing recap so we don't generate a duplicate",
);

check(
  "resume branch triggers sendToAI({ isResumeRecap: true }) when no prior recap",
  /resumeRecapTriggeredRef\.current\s*=\s*true;[\s\S]{0,300}sendToAI\(messagesRef\.current, false, \{ isResumeRecap: true \}\)/.test(page),
  "the resume branch must call sendToAI with the recap flag",
);

check(
  "resume branch still calls reconcileResumeLoot",
  /void reconcileResumeLoot\(\);/.test(page),
  "loot reconciliation must still run on resume",
);

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
