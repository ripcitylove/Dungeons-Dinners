// Regression test: the chat container leaves room under the last line so the
// Suggested Actions panel never visually covers narration. Two mechanisms:
//   1. The chat container's bottom padding grows when suggestions are visible
//      (so the last line floats above them with a buffer).
//   2. The RAF auto-scroll snaps instantly when far behind (large layout shift,
//      like suggestions appearing during streaming), then drifts gently.

import { readFileSync } from "node:fs";

const src = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── Bottom buffer on the message container ──────────────────────────────────
check(
  "msgContainer padding scales bottom when suggestions are present",
  /padding: `0 16px \$\{suggestions\.length > 0 \? 64 : 8\}px`/.test(src),
  "container should switch between 8px and 64px bottom padding based on suggestions",
);

// ── Adaptive RAF scroll (instant snap on big layout shift) ───────────────────
check(
  "RAF snaps to bottom when remaining > 100px",
  /if \(remaining > 100\)\s*\{[\s\S]*?el\.scrollTop = el\.scrollHeight - el\.clientHeight/.test(src),
  "missing instant-snap branch — suggestion-appearance lag will linger",
);
check(
  "RAF still drifts gently when close to the bottom",
  /\} else if \(remaining > 1\)\s*\{[\s\S]*?el\.scrollTop \+= Math\.max\(0\.8, Math\.min\(remaining \* 0\.055, 7\)\)/.test(src),
  "gentle drift branch missing — text reveal will feel jerky",
);

// ── User-interrupt protection still holds for both branches ──────────────────
const tickFn = src.match(/const tick = \(\) => \{[\s\S]*?\};/);
check(
  "tick still respects userInterruptedScrollRef before any scroll write",
  tickFn && /if \(!userInterruptedScrollRef\.current\)\s*\{[\s\S]*remaining > 100[\s\S]*remaining > 1/.test(tickFn[0]),
  "user scrolling up could be overridden by either branch",
);

// ── Idle snap path is still present (one-shot snap when not streaming) ───────
check(
  "idle snap path still uses scrollHeight target",
  /scrollTop = msgContainerRef\.current\.scrollHeight/.test(src),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
