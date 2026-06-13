// Regression test: suggest-actions now receives party + enemy context, the prompt
// includes party-awareness rules, and every call site uses the shared helper.

import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/suggest-actions/route.ts", "utf8");
const page  = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── API accepts party + enemies ──────────────────────────────────────────────
check("API destructures `party` from request body", /const \{[\s\S]*?party,[\s\S]*?\} = \(await req\.json\(\)\)/.test(route));
check("API destructures `enemies` from request body", /const \{[\s\S]*?enemies,[\s\S]*?\} = \(await req\.json\(\)\)/.test(route));
check("API has PartyMemberCtx type", /type PartyMemberCtx = \{/.test(route));
check("API builds a PARTY block listing names + HP + status", /PARTY \(other characters present in the scene\)/.test(route));
check("API lists each member's status as DEAD / Unconscious / alive and standing", /DEAD/.test(route) && /Unconscious/.test(route) && /alive and standing/.test(route));

// ── Prompt enforces party awareness ──────────────────────────────────────────
check("Prompt names the bug case explicitly (Ekko alive at 9/9)", /Ekko/.test(route) && /9\/9/.test(route));
check("Prompt forbids 'is X alive' suggestions for alive members", /NEVER suggest asking whether a party member who is currently alive/.test(route));
check("Prompt allows mourning/searching ONLY for actually dead/absent members", /Only suggest mourning, searching for, or asking about the fate of party members who are actually DEAD or absent/.test(route));
check("Prompt mentions PARTY block as ground truth", /Trust this block as ground truth/.test(route));

// ── Client builds and passes party context ──────────────────────────────────
check("page.tsx has buildSuggestActionsBody helper", /const buildSuggestActionsBody = useCallback/.test(page));
check("helper passes party from campaignPartyRef.current", /campaignPartyRef\.current\.map\(c => \(\{[\s\S]*?name: c\.name[\s\S]*?status_effects: c\.status_effects/.test(page));
check("helper flags isMe so the suggester ignores self in PARTY block", /isMe: char \? c\.id === char\.id : false/.test(page));
check("helper passes live enemies", /enemiesRef\.current[\s\S]*?\.filter\(e => !e\.is_defeated\)/.test(page));

// ── No old call site survives with the bare { dmResponse, character } shape ──
const oldBodyPattern = /JSON\.stringify\(\{\s*dmResponse[^}]*character[^}]*\}\)/g;
const oldOccurrences = (page.match(oldBodyPattern) || []);
check(
  "no /api/suggest-actions call still uses the old bare body shape",
  oldOccurrences.length === 0,
  `still ${oldOccurrences.length} call site(s) sending the old shape`,
);

// ── Every call site uses the helper ──────────────────────────────────────────
// Only count fetch invocations (skips the helper's own doc comment)
const suggestFetchCalls = (page.match(/fetch\("\/api\/suggest-actions"/g) || []).length;
const helperCalls       = (page.match(/buildSuggestActionsBody\(/g) || []).length;
check(
  "every suggest-actions fetch call uses buildSuggestActionsBody",
  helperCalls === suggestFetchCalls && suggestFetchCalls >= 5,
  `helper called ${helperCalls}x but ${suggestFetchCalls} fetch site(s) found`,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
