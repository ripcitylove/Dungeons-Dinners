// Regression battery for the spell-slot double-charge bug: a DECLINED or merely
// MENTIONED spell must NOT register as a cast (no [SPELL:] tag → no slot), while
// a genuine cast (with the tag) does. Mirrors the adventure-log sequence where
// Barnabus's declined Identify wrongly consumed a slot.
import { findFastSpellCast } from "../src/lib/spellCast.ts";

const PREPARED = ["Identify", "Cure Wounds", "Bless", "Chromatic Orb"]; // leveled (cantrips excluded by caller)

let pass = 0;
const fails: string[] = [];
const expect = (name: string, got: string | null, want: string | null) => {
  if (got === want) pass++;
  else fails.push(`  ✗ ${name}: expected ${want ?? "null"}, got ${got ?? "null"}`);
};

// THE BUG: declined cast — DM mentions "Identify" but emits NO [SPELL:] tag (it
// would emit [NO-TURN] instead). Must NOT count as a cast.
expect("declined cast (name mentioned, no tag)",
  findFastSpellCast("Identify doesn't work on ambient light or environmental phenomena — it reads objects and spells. What would you like to do instead, Barnabus? [NO-TURN]", "Barnabus", PREPARED),
  null);

// Genuine cast — DM narrates it AND emits the tag.
expect("real cast with [SPELL:] tag",
  findFastSpellCast("Barnabus presses his palm against the stone and casts. That uses your one 1st-level slot. [SPELL:Barnabus:identify]", "Barnabus", PREPARED),
  "Identify");

// Spell merely referenced in flavor / by an NPC — no tag → no slot.
expect("flavor mention, no tag",
  findFastSpellCast("The old wizard mutters something about a Bless he once cast in the war.", "Barnabus", PREPARED),
  null);

// Key ↔ name normalization (multi-word spell).
expect("multi-word spell key normalizes",
  findFastSpellCast("Healing light pours over Thorin. [SPELL:Barnabus:cure_wounds:Thorin]", "Barnabus", PREPARED),
  "Cure Wounds");

// Tag for a DIFFERENT caster must not charge this caster.
expect("tag for another caster",
  findFastSpellCast("[SPELL:Shmang:identify]", "Barnabus", PREPARED),
  null);

// Tag for a spell NOT in the caster's leveled prepared list (e.g. a cantrip,
// which the caller excludes) → no slot.
expect("cantrip / non-leveled tag excluded",
  findFastSpellCast("[SPELL:Barnabus:fire_bolt]", "Barnabus", PREPARED),
  null);

// First-name match when the tag/caster carries a full name.
expect("first-name match",
  findFastSpellCast("[SPELL:Barnabus:bless:Vi]", "Barnabus Popplebottom", PREPARED),
  "Bless");

// Two tags in one response — return the leveled prepared one.
expect("picks the leveled prepared spell among multiple tags",
  findFastSpellCast("[SPELL:Barnabus:light] then [SPELL:Barnabus:chromatic_orb]", "Barnabus", PREPARED),
  "Chromatic Orb");

console.log(`\nFast spell-cast detection battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Only genuine [SPELL:] casts consume a slot; declined/mentioned spells do not.");
