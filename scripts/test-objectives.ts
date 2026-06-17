// Objectives ("quest spine") logic battery. Run: node scripts/test-objectives.ts
import {
  initObjectives, normalizeObjectives, parseObjectiveTags, applyObjectiveTags,
  visibleObjectives, currentObjectiveId, hasNewlyRevealed,
} from "../src/lib/objectives.ts";

let pass = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean, detail = "") => { if (cond) pass++; else fails.push(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); };
const eqArr = (name: string, got: unknown[], want: unknown[]) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}`);

// init: first active, rest hidden
{
  const o = initObjectives(["Reach Saltmere", "Investigate the monument", "Stop the seal from breaking"]);
  eqArr("init statuses", o.map(x => x.status), ["active", "hidden", "hidden"]);
  ok("init first is the opening objective", o[0].text === "Reach Saltmere");
  ok("current is the first active", currentObjectiveId(o) === o[0].id);
  eqArr("only the opening objective is visible at start", visibleObjectives(o).map(x => x.text), ["Reach Saltmere"]);
}

// parse tags
{
  const t = parseObjectiveTags("The crack is a binding seal. [OBJECTIVE-NEW:2] You sense it failing. [OBJECTIVE-DONE:1]");
  eqArr("parse reveal", t.reveal, [2]);
  eqArr("parse done", t.done, [1]);
  const none = parseObjectiveTags("Nothing tagged here.");
  ok("no tags -> empty", none.reveal.length === 0 && none.done.length === 0);
  const bad = parseObjectiveTags("[OBJECTIVE-NEW:0] [OBJECTIVE-DONE:abc]");
  ok("invalid indices ignored", bad.reveal.length === 0 && bad.done.length === 0);
}

// reveal next
{
  const o = initObjectives(["A", "B", "C"]);
  const o2 = applyObjectiveTags(o, { reveal: [2], done: [] });
  eqArr("reveal 2 -> A,B active", o2.map(x => x.status), ["active", "active", "hidden"]);
  eqArr("now A,B visible", visibleObjectives(o2).map(x => x.text), ["A", "B"]);
  ok("current still A (first active)", currentObjectiveId(o2) === o2[0].id);
}

// complete current -> done + auto-reveal next, current advances
{
  const o = initObjectives(["A", "B", "C"]);
  const o2 = applyObjectiveTags(o, { reveal: [], done: [1] });
  eqArr("done 1 -> A done, B auto-revealed", o2.map(x => x.status), ["done", "active", "hidden"]);
  ok("current advances to B", o2[currentObjectiveId(o2) === o2[1].id ? 1 : -1]?.text === "B");
}

// completing a later objective reveals everything up to it (can't skip discovery)
{
  const o = initObjectives(["A", "B", "C", "D"]);
  const o2 = applyObjectiveTags(o, { reveal: [], done: [3] });
  eqArr("done 3 -> A,B active, C done, D auto-revealed", o2.map(x => x.status), ["active", "active", "done", "active"]);
}

// idempotency + no-op returns same reference
{
  const o = initObjectives(["A", "B"]);
  const same = applyObjectiveTags(o, { reveal: [1], done: [] }); // obj1 already active
  ok("no change -> same reference", same === o);
  const oob = applyObjectiveTags(o, { reveal: [9], done: [9] }); // out of range
  ok("out-of-range -> no change", oob === o);
}

// normalize stored jsonb (null-safe)
{
  ok("normalize null -> []", normalizeObjectives(null).length === 0);
  const n = normalizeObjectives([{ id: "x", text: "Do thing", status: "done" }, { text: "", status: "active" }, { text: "Keep", status: "weird" }]);
  eqArr("normalize drops blank, coerces bad status", n.map(x => `${x.text}:${x.status}`), ["Do thing:done", "Keep:hidden"]);
}

// hasNewlyRevealed — drives the tracker chime
{
  const a = initObjectives(["A", "B", "C"]);
  ok("reveal -> newly revealed true", hasNewlyRevealed(a, applyObjectiveTags(a, { reveal: [2], done: [] })));
  ok("complete with auto-reveal next -> true", hasNewlyRevealed(a, applyObjectiveTags(a, { reveal: [], done: [1] })));
  const b = applyObjectiveTags(a, { reveal: [], done: [2] }); // A,B active(->), C revealed... wait: done 2 reveals A,B,C
  ok("completing the LAST objective -> false (nothing new revealed)", !hasNewlyRevealed(b, applyObjectiveTags(b, { reveal: [], done: [3] })));
  ok("no change -> false", !hasNewlyRevealed(a, a));
}

console.log(`\nObjectives battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Quest-spine reveal/complete logic is correct and order-safe.");
