// Regression test for two intertwined fixes:
//   1. Wild Shape — Druid feature, gated by level/CR/speed per 5e rules.
//   2. [NO-TURN] tag — DM signals that a player's submission was a failed or
//      pending action (invalid spell, missing class feature, exhausted resource,
//      parameter clarification). The engine then:
//        - blocks the deferred turn advance
//        - removes the player from roundActions
//        - strips the tag from chat display
//      so the player still gets to take a real action.

import { readFileSync } from "node:fs";

const page     = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");
const chat     = readFileSync("src/app/api/chat/route.ts", "utf8");
const features = readFileSync("src/lib/classFeatures.ts", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── Wild Shape data (classFeatures.ts) ───────────────────────────────────────
check("Wild Shape resource still defined for Druid", /key:\s*"wild_shape"[\s\S]*?name:\s*"Wild Shape"/.test(features));
check("Wild Shape minLevel === 2", /key:\s*"wild_shape"[\s\S]*?minLevel:\s*2/.test(features));
check("Wild Shape uses recover on shortRest", /key:\s*"wild_shape"[\s\S]*?resetOn:\s*"shortRest"/.test(features));
check(
  "Wild Shape description names L2-3 / L4-7 / L8+ CR tiers explicitly",
  /L2[–-]3 = CR ¼/.test(features) && /L4[–-]7 = CR ½/.test(features) && /L8\+ = CR 1/.test(features),
);
check(
  "Wild Shape description forbids fly/swim at L2-3 and fly at L4-7",
  /NO flying or swimming speed/.test(features) && /swimming OK, no flying/.test(features),
);
check(
  "Wild Shape has a no-cost Revert sub-ability (bonus action, free)",
  /name:\s*"Revert"[\s\S]*?cost:\s*0/.test(features),
);

// ── DM prompt: Wild Shape rules block ────────────────────────────────────────
check("chat prompt has 'WILD SHAPE — DRUID FEATURE RULES' block", /WILD SHAPE — DRUID FEATURE RULES/.test(chat));
check("Wild Shape rule states it's gated to Druids level ≥ 2", /class "Druid" AND level ≥ 2/.test(chat));
check("Wild Shape rule cites the L2-3 CR ¼ no fly/swim restriction", /L2[–-]3:\s*CR ¼[\s\S]*?NO flying speed, NO swimming speed/.test(chat));
check("Wild Shape rule cites the L4-7 CR ½ swimming-but-no-flying restriction", /L4[–-]7:\s*CR ½[\s\S]*?swimming OK, NO flying/.test(chat));
check("Wild Shape rule cites the L8+ CR 1 any-speed-including-flying limit", /L8\+:\s*CR 1[\s\S]*?any speed including flying/.test(chat));
check("Wild Shape rule notes uses tracked under wild_shape resource (max 2, short-rest recovery)", /wild_shape[\s\S]*?max 2[\s\S]*?Short or Long Rest/.test(chat));
check("Wild Shape rule prohibits casting spells while transformed", /cannot cast spells while Wild Shaped/.test(chat));
check(
  "Wild Shape rule directs DM to refuse with [NO-TURN] when form exceeds CR cap",
  /CR cap[\s\S]*?\[NO-TURN\]|too powerful for your level[\s\S]*?\[NO-TURN\]/.test(chat),
);

// ── DM prompt: INVALID ACTION block instructing the DM to emit [NO-TURN] ─────
check("chat prompt has 'INVALID / IMPOSSIBLE / OUT-OF-RESOURCE ACTIONS' block", /INVALID \/ IMPOSSIBLE \/ OUT-OF-RESOURCE ACTIONS/.test(chat));
check("invalid-action block says DO NOT CONSUME THE TURN", /DO NOT CONSUME THE TURN/.test(chat));
check("invalid-action block requires [NO-TURN] tag", /APPEND THE TAG \[NO-TURN\]/.test(chat));
check("invalid-action block requires the response to end with a redirect question", /End your response with a redirect question/.test(chat));
check(
  "trigger list covers non-prepared spells, exhausted slots, missing class features, exhausted resources, missing items, OOC questions",
  /NOT in their Cantrips or Prepared spells/.test(chat)
  && /spell slots for that level are exhausted/.test(chat)
  && /class feature their class doesn't have, or that their level doesn't yet grant/.test(chat)
  && /class resource that's already exhausted/.test(chat)
  && /item the character doesn't have in their inventory/.test(chat)
  && /OOC \/ meta question/.test(chat),
);
check(
  "examples include Wild Shape at level 1, exhausted uses, and CR violations",
  /Wild Shape isn't yet a feature at level 1/.test(chat)
  && /your last Wild Shape use was at/i.test(chat)
  && /at level 3 your form cap is CR ¼/.test(chat),
);

// ── Spell parameter clarification now also uses [NO-TURN] ────────────────────
check(
  "spell parameter clarification block appends [NO-TURN] to clarifying responses",
  /Append \[NO-TURN\] \(engine tag, stripped from display\) to your response so the engine knows this clarification does NOT consume the player's turn/.test(chat),
);
check(
  "parameter examples include [NO-TURN] suffix on Chromatic Orb / Wild Shape / etc.",
  /Chromatic Orb[\s\S]*?\[NO-TURN\]/.test(chat)
  && /Wild Shape \(Druid feature\)[\s\S]*?\[NO-TURN\]/.test(chat),
);

// ── Client: stripSystemLeaks strips the tag from display ────────────────────
check(
  "stripSystemLeaks removes [NO-TURN] (and the NOTURN variant) from chat",
  /\.replace\(\/\\\[NO-\?TURN\\\]\/gi, ""\)/.test(page),
);

// ── Client: sendToAI detects the tag and rolls back roundActions + blocks advance ─
// Use the entire page string — sendToAI is too large to extract cleanly via regex.
check(
  "[NO-TURN] tag detected in the streamed response",
  /\/\\\[NO-\?TURN\\\]\/i\.test\(full\)/.test(page),
);
const noTurnBlock = page.match(/\/\\\[NO-\?TURN\\\]\/i\.test\(full\)[\s\S]*?\n {6}\}/);
check("[NO-TURN] handler block located", !!noTurnBlock);
if (noTurnBlock) {
  const body = noTurnBlock[0];
  check(
    "[NO-TURN] sets dmFollowUpBlockAdvanceRef so the deferred advance never fires",
    /dmFollowUpBlockAdvanceRef\.current = true/.test(body),
  );
  check(
    "[NO-TURN] removes the failed actor from roundActions",
    /roundActionsRef\.current\.filter\(a => a\.characterId !== prevChar\.id\)/.test(body),
  );
  check(
    "[NO-TURN] re-syncs setRoundActions when an entry was actually removed",
    /setRoundActions\(trimmed\)/.test(body),
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
