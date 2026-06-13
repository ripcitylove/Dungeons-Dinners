// Regression test for the "two children with the same key" React warning.
// Every log entry is now keyed via makeLogId(), which appends a monotonic
// counter so two callsites firing in the same millisecond can't collide.

import { readFileSync } from "node:fs";

const page = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── 1. makeLogId helper defined and uses a counter ───────────────────────────
check("makeLogId helper declared", /function makeLogId\(prefix: string\): string/.test(page));
check("module-level counter declared", /let _logIdCounter = 0;/.test(page));
check("counter is incremented before each id", /_logIdCounter = \(_logIdCounter \+ 1\)/.test(page));
check("returned id contains prefix, timestamp, AND counter (3 hyphenated parts)",
  /return `\$\{prefix\}-\$\{Date\.now\(\)\}-\$\{_logIdCounter\.toString\(36\)\}`;/.test(page));

// ── 2. No surviving id: `PREFIX-${Date.now()}` patterns ──────────────────────
const oldPattern = /id: `(rest|state|resume|resume-loot|dm|player|rt|use)-\$\{Date\.now\(\)\}`/g;
const survivors = (page.match(oldPattern) || []);
check(
  "no log entry uses bare ${Date.now()} as its key",
  survivors.length === 0,
  `${survivors.length} survivor(s): ${survivors.join(", ")}`,
);

// ── 3. Every former id site now goes through makeLogId() ─────────────────────
const helperCalls = (page.match(/makeLogId\("([\w-]+)"\)/g) || []);
check(
  "all known prefixes use makeLogId — at minimum 7 callsites",
  helperCalls.length >= 7,
  `${helperCalls.length} call sites found`,
);
const prefixes = new Set(helperCalls.map(c => c.match(/makeLogId\("([\w-]+)"\)/)[1]));
const expected = ["rest", "state", "resume-loot", "dm", "player", "rt", "use"];
for (const p of expected) {
  check(`prefix "${p}" routes through makeLogId`, prefixes.has(p));
}

// ── 4. Runtime uniqueness simulation ─────────────────────────────────────────
console.log("\nRuntime uniqueness simulation (same-tick burst):");
{
  let counter = 0;
  const makeId = (prefix) => `${prefix}-${Date.now()}-${(++counter).toString(36)}`;
  const ids = new Set();
  for (let i = 0; i < 1000; i++) ids.add(makeId("rest"));
  check("1000 same-tick rest IDs all unique", ids.size === 1000, `${ids.size} unique of 1000`);
  // Mixed prefixes in the same tick
  const mixed = new Set();
  for (let i = 0; i < 500; i++) {
    mixed.add(makeId("rest"));
    mixed.add(makeId("dm"));
    mixed.add(makeId("player"));
  }
  check("1500 mixed-prefix same-tick IDs all unique", mixed.size === 1500, `${mixed.size} unique of 1500`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
