// Regression test: the Suggested Actions panel has a collapse toggle so the
// player can reclaim narration-reading real estate. State persists to
// localStorage and hydrates SSR-safely.

import { readFileSync } from "node:fs";

const page = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── State + toggle defined ───────────────────────────────────────────────────
check(
  "suggestionsCollapsed state declared (defaults to false)",
  /const \[suggestionsCollapsed, setSuggestionsCollapsed\] = useState<boolean>\(false\)/.test(page),
);
check(
  "toggle helper declared",
  /const toggleSuggestionsCollapsed = useCallback/.test(page),
);

// ── SSR-safe hydration (NOT in the useState initializer) ─────────────────────
check(
  "localStorage hydration happens in useEffect (SSR-safe)",
  /useEffect\(\(\) => \{\s*try \{ setSuggestionsCollapsed\(localStorage\.getItem\("dnd_suggestions_collapsed"\) === "1"\)/.test(page),
);
check(
  "toggle writes new state to localStorage under same key",
  /localStorage\.setItem\("dnd_suggestions_collapsed"/.test(page),
);

// ── UI wiring ─────────────────────────────────────────────────────────────────
check(
  "header button calls toggleSuggestionsCollapsed",
  /onClick=\{toggleSuggestionsCollapsed\}/.test(page),
);
check(
  "list of buttons hidden when collapsed",
  /\{!suggestionsCollapsed && \([\s\S]*?suggestions\.map\(\(s, i\)/.test(page),
);
check(
  "collapsed header shows hidden-count badge",
  /suggestions\.length\} hidden/.test(page),
);
check(
  "chevron rotates on toggle (visual affordance)",
  /transform: suggestionsCollapsed \? "rotate\(0deg\)" : "rotate\(180deg\)"/.test(page),
);
check(
  "panel padding shrinks when collapsed (fewer pixels for header-only)",
  /padding: suggestionsCollapsed \? "6px 16px" : "10px 16px"/.test(page),
);

// ── Existing behavior preserved ──────────────────────────────────────────────
check(
  "still gated on suggestions.length > 0 && !dmBusy && isMyTurn && !showDice && !pendingDiceShow",
  /suggestions\.length > 0 && !dmBusy && isMyTurn && !showDice && !pendingDiceShow/.test(page),
);
check(
  "individual suggestion buttons still call handleSend(s)",
  /<button key=\{i\} onClick=\{\(\) => handleSend\(s\)\} disabled=\{narrating\}/.test(page),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
