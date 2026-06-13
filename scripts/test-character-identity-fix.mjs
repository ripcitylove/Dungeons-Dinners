// Static regression test for three fixes:
//   1. `character` (game-logic identity) follows `currentTurnIndex` — not `activeCharIdx`
//      so clicking another player's card never hijacks the user's identity
//      (which previously caused the "DM skips Shmang" bug).
//   2. "Acting" pill follows the actual turn, not the clicked-card index.
//   3. Auto-scroll respects user manual scroll-up.

import { readFileSync } from "node:fs";

const src = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── Fix 1: identity sync via currentTurnIndex, not activeCharIdx ─────────────
// The OLD bug effect synced character from activeCharIdx (driven by clicks).
// The NEW effect must depend on currentTurnIndex + turnOrder.
// Find the useEffect that sets characterRef.current = c (identity sync)
// Body has nested braces (if blocks) — use a forgiving span match
const identityEffect = src.match(/useEffect\(\(\) => \{[\s\S]*?characterRef\.current = c;[\s\S]*?\}, \[([^\]]+)\]\);/);
check(
  "character-identity effect exists",
  !!identityEffect,
  "couldn't locate the effect that sets characterRef.current",
);
if (identityEffect) {
  const deps = identityEffect[1];
  check(
    "identity effect depends on currentTurnIndex",
    /currentTurnIndex/.test(deps),
    `deps = [${deps}]`,
  );
  check(
    "identity effect depends on turnOrder",
    /turnOrder/.test(deps),
    `deps = [${deps}]`,
  );
  check(
    "identity effect does NOT depend on activeCharIdx",
    !/activeCharIdx/.test(deps),
    `deps = [${deps}] — clicking a card would still hijack character identity!`,
  );
}

// ── Fix 2: "Acting" badge uses isCurrentTurn ─────────────────────────────────
const actingRe = /const isActive\s*=\s*([^;]+);/;
const actingMatch = src.match(actingRe);
check(
  "isActive assignment found",
  !!actingMatch,
);
if (actingMatch) {
  const rhs = actingMatch[1];
  check(
    "isActive follows turn order, not clicks",
    /isCurrentTurn/.test(rhs) && !/activeCharIdx/.test(rhs),
    `isActive = ${rhs} — clicking still flips the Acting badge`,
  );
}

// ── Fix 3: user-scroll detection ─────────────────────────────────────────────
check(
  "userInterruptedScrollRef exists",
  /userInterruptedScrollRef/.test(src),
  "no scroll-interrupt tracker — auto-scroll will still fight the user",
);
check(
  "auto-scroll respects interrupt flag",
  /if \(!userInterruptedScrollRef\.current\)/.test(src) || /if \(userInterruptedScrollRef\.current\)\s*return/.test(src),
  "the ref is declared but no scroll site reads it",
);
check(
  "old triple-effect-scroll setup is gone (consolidated)",
  // There used to be three separate useEffects scrolling; the new code has one auto-scroll effect.
  (src.match(/msgContainerRef\.current/g) || []).length < 12,
  "still many msgContainerRef references — could indicate the old competing effects survive",
);

// ── Fix 4 (defensive): click handler still opens the sheet ───────────────────
// We don't want to break the "click → open sheet" behavior — only the identity hijack.
check(
  "click handler still opens the sheet tab",
  /onClick=\{\(\) => \{ if \(campaignParty\.length > 1\) \{ setActiveCharIdx\(idx\); .*setSidebarTab\("sheet"\)/.test(src),
  "click no longer opens the sheet — UX broken",
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
