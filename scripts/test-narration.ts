// Verifies the narrator speaks only the roll TOTAL, not the arithmetic formula.
import { collapseRollMath } from "../src/lib/narration.ts";

let pass = 0;
const fails: string[] = [];
const eq = (name: string, got: string, want: string) => {
  if (got === want) pass++;
  else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};

// The screenshot + common roll-narration shapes
eq("screenshot",        collapseRollMath("12 + 2 [Perception] = 14 — clear enough."), "14 — clear enough.");
eq("attack w/ STR+Prof", collapseRollMath("8 + 3 [STR] + 2 [Prof] = 13 — hits AC 14!"), "13 — hits AC 14!");
eq("arcana check",      collapseRollMath("9 + 4 [Arcana] = 13 — the letters hum faintly."), "13 — the letters hum faintly.");
eq("no labels",         collapseRollMath("14 + 5 = 19 — hits AC 15!"), "19 — hits AC 15!");
eq("save vs DC",        collapseRollMath("9 + 2 [WIS] + 2 [Prof] = 13 — fails DC 14."), "13 — fails DC 14.");
eq("low roll",          collapseRollMath("1 + 2 [Perception] = 3 — she stares at the crack."), "3 — she stares at the crack.");
eq("labels already stripped (TTS order)", collapseRollMath("12 + 2  = 14 — clear enough."), "14 — clear enough.");

// Must NOT alter ordinary numbers
eq("gold unchanged",    collapseRollMath("You find 47 gold pieces in the chest."), "You find 47 gold pieces in the chest.");
eq("roll request",      collapseRollMath("The lock looks tricky. Roll a d20."), "The lock looks tricky. Roll a d20.");
eq("DC mention",        collapseRollMath("That would be a DC 15 check."), "That would be a DC 15 check.");
eq("numbers in prose",  collapseRollMath("Three guards, maybe 20 feet away, turn toward you."), "Three guards, maybe 20 feet away, turn toward you.");
eq("non-contiguous nums", collapseRollMath("You deal 12 damage, then 3 more for 15 total."), "You deal 12 damage, then 3 more for 15 total.");

console.log(`\nNarration roll-math battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Narrator speaks the roll total only; formulas collapsed, prose numbers untouched.");
