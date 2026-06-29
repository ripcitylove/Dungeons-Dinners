// Verifies the history-window planner: never summarizes short campaigns, keeps the
// recent window verbatim, and regenerates the recap only every REGEN_EVERY messages.
// Run: npx tsx scripts/test-history-window.ts
import { planHistoryWindow, KEEP_RECENT, REGEN_EVERY, MIN_TO_SUMMARIZE } from "../src/lib/historyWindow";

let pass = 0, fail = 0;
const check = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.log(`  ✗ ${name}`); } };

// Short campaigns: always full verbatim.
check("0 msgs → full", planHistoryWindow(0, null).mode === "full");
check("exactly MIN → full", planHistoryWindow(MIN_TO_SUMMARIZE, null).mode === "full");

// Just over threshold, no cache → summarize and regen, covering all-but-recent.
const p1 = planHistoryWindow(MIN_TO_SUMMARIZE + 1, null);
check("MIN+1, no cache → summarized", p1.mode === "summarized");
if (p1.mode === "summarized") {
  check("throughCount = count - KEEP_RECENT", p1.throughCount === (MIN_TO_SUMMARIZE + 1) - KEEP_RECENT);
  check("needsRegen with no cache", p1.needsRegen === true);
  check("regenFrom = 0 with no cache", p1.regenFrom === 0);
  // Verbatim tail is exactly the recent window.
  check("verbatim tail == KEEP_RECENT", (MIN_TO_SUMMARIZE + 1) - p1.throughCount === KEEP_RECENT);
}

// With a fresh cache covering the all-but-recent point, a few more messages should
// NOT trigger a regen (reuse recap; verbatim tail grows a little).
const cachedAt = (MIN_TO_SUMMARIZE + 1) - KEEP_RECENT;
const p2 = planHistoryWindow(MIN_TO_SUMMARIZE + 1 + (REGEN_EVERY - 1), { summary: "recap text", throughCount: cachedAt });
check("within REGEN_EVERY → no regen", p2.mode === "summarized" && !p2.needsRegen);
check("no-regen reuses cached throughCount", p2.mode === "summarized" && p2.throughCount === cachedAt);

// Once REGEN_EVERY messages have aged out past the recap, regenerate incrementally.
const p3 = planHistoryWindow(MIN_TO_SUMMARIZE + 1 + REGEN_EVERY, { summary: "recap text", throughCount: cachedAt });
check("at REGEN_EVERY boundary → regen", p3.mode === "summarized" && p3.needsRegen);
check("regen folds from prior throughCount", p3.mode === "summarized" && p3.regenFrom === cachedAt);

// Empty cached summary string forces a regen even if throughCount looks set.
const p4 = planHistoryWindow(MIN_TO_SUMMARIZE + 5, { summary: "   ", throughCount: 3 });
check("blank cached summary → regen", p4.mode === "summarized" && p4.needsRegen);

// Recent window is always preserved verbatim regardless of size.
const big = 500;
const p5 = planHistoryWindow(big, { summary: "recap", throughCount: big - KEEP_RECENT });
check("huge campaign keeps recent window verbatim", p5.mode === "summarized" && (big - p5.throughCount) === KEEP_RECENT);

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exit(1);
console.log("✓ History-window planner is correct (recent window always verbatim; recap regenerated rarely).");
