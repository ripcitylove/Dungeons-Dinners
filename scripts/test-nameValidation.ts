// Character-name validation battery. A name with a digit or symbol silently breaks
// the economy/spell tag parsers (which only accept [A-Za-z'\- ]); these tests lock
// the creation-time guard that keeps every name inside that charset.
// Run: node scripts/test-nameValidation.ts
import { sanitizeCharacterName, characterNameError, NAME_MAX } from "../src/lib/nameValidation.ts";

let pass = 0;
const fails: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => {
  if (got === want) pass++;
  else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};

// ── sanitizeCharacterName — strips invalid chars as typed ──
eq("digits stripped (the bug)", sanitizeCharacterName("Aria2"), "Aria");
eq("digit run stripped", sanitizeCharacterName("Randiezel123"), "Randiezel");
eq("symbols stripped", sanitizeCharacterName("X Æ A-12"), "X A-"); // Æ + digits gone, double space collapsed, hyphen kept
eq("underscore stripped", sanitizeCharacterName("Bob_the_Brave"), "BobtheBrave");
eq("colon stripped (tag-breaker)", sanitizeCharacterName("Aria:Light"), "AriaLight");
eq("bracket stripped (tag-breaker)", sanitizeCharacterName("Aria[2]"), "Aria");
eq("apostrophe kept", sanitizeCharacterName("D'arzz"), "D'arzz");
eq("hyphen kept", sanitizeCharacterName("Mary-Jane"), "Mary-Jane");
eq("internal space kept", sanitizeCharacterName("Aria Windwalker"), "Aria Windwalker");
eq("double space collapsed", sanitizeCharacterName("Aria   Windwalker"), "Aria Windwalker");
eq("leading junk dropped to first letter", sanitizeCharacterName("123Bob"), "Bob");
eq("leading space/quote/hyphen dropped", sanitizeCharacterName("  'Bob"), "Bob");
eq("plain name untouched", sanitizeCharacterName("Shmang"), "Shmang");
eq("capped at NAME_MAX", sanitizeCharacterName("A".repeat(60)).length, NAME_MAX);

// ── characterNameError — gate on advance/save ──
eq("empty rejected", characterNameError("   "), "Your character needs a name.");
eq("digit name rejected", characterNameError("Aria2"), "Names can use letters, spaces, apostrophes, and hyphens only — no numbers or symbols.");
eq("symbol name rejected", characterNameError("Bob_the_Brave"), "Names can use letters, spaces, apostrophes, and hyphens only — no numbers or symbols.");
eq("plain name ok", characterNameError("Shmang"), null);
eq("apostrophe name ok", characterNameError("D'arzz"), null);
eq("hyphen name ok", characterNameError("Mary-Jane"), null);
eq("two-word name ok", characterNameError("Aria Windwalker"), null);
eq("over-long rejected", characterNameError("A".repeat(41)), `Names must be ${NAME_MAX} characters or fewer.`);

// ── round-trip: a sanitized name always passes the validator ──
const messy = ["Aria2", "Randiezel123", "Bob_the_Brave", "Aria:Light", "  'Bob", "X4+2"];
for (const m of messy) {
  const clean = sanitizeCharacterName(m);
  if (clean) eq(`round-trip "${m}" -> valid`, characterNameError(clean), null);
}

console.log(`\nName-validation battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Names are constrained to the [A-Za-z'\\- ] charset the tag parsers require.");
