// Verifies action → skill/ability inference so the DM gets a correct SUGGESTED
// CHECK hint (the bug: "investigate glyph" resolved as an Acrobatics check).
import { inferSkillCheck } from "../src/lib/skillCheck.ts";

let pass = 0;
const fails: string[] = [];
const expect = (action: string, skill: string | null) => {
  const got = inferSkillCheck(action);
  const gotSkill = got?.skill ?? null;
  if (gotSkill === skill) pass++;
  else fails.push(`  ✗ "${action}" → expected ${skill ?? "null"}, got ${gotSkill ?? "null"}`);
};

// The reported bug + close variants
expect("investigate glyph", "Investigation");
expect("investigate the glyph", "Investigation");
expect("examine the strange markings", "Investigation");
expect("search the room for traps", "Investigation");
expect("study the ancient inscription", "Investigation");

// Physical — must NOT be confused with mental/social
expect("climb the wall", "Athletics");
expect("force open the door", "Athletics");
expect("swim across the river", "Athletics");
expect("balance across the narrow beam", "Acrobatics");
expect("tumble past the guard", "Acrobatics");
expect("squeeze through the gap", "Acrobatics");

// Stealth / sleight
expect("sneak past the sleeping ogre", "Stealth");
expect("hide behind the crates", "Stealth");
expect("pickpocket the merchant", "Sleight of Hand");

// Perception / insight / survival
expect("listen at the door", "Perception");
expect("look around the chamber", "Perception");
expect("read his expression to sense his motive", "Insight");
expect("track the wolf through the snow", "Survival");

// The reported bug: "check the area for footprints/recent activity" was resolved
// as a STEALTH check (the DM defaulted to the rogue's signature skill). These
// environmental sign-detection actions must classify as Perception, never Stealth.
expect("Check the area for footprints or recent activity.", "Perception");
expect("check the area for footprints", "Perception");
expect("check the ground for tracks or recent activity", "Survival"); // "tracks" → Survival (owns it), still NOT Stealth
expect("look for footprints in the mud", "Perception");
expect("scan the area for any signs of movement", "Perception");
expect("check the room for anything out of place", "Perception");
expect("look for signs of a struggle", "Perception");
expect("inspect the ground for footprints", "Investigation"); // "inspect" → Investigation (owns it), not Stealth
// And confirm these never collapse to Stealth even though a rogue might be acting
for (const a of ["check the area for footprints", "look for signs of recent activity", "scan the clearing for prints"]) {
  const got = inferSkillCheck(a)?.skill ?? null;
  if (got !== "Stealth") pass++;
  else fails.push(`  ✗ "${a}" → must NOT be Stealth, got Stealth`);
}

// Knowledge
expect("recall what I know about the legend", "History");
expect("identify the spell woven into the rune", "Arcana");
expect("identify the plant species", "Nature");
expect("what god does this holy symbol honor", "Religion");

// Remaining skills — full 5e coverage
expect("calm the horse before it bolts", "Animal Handling");
expect("sing a ballad to the tavern crowd", "Performance");
expect("pickpocket the drunk noble", "Sleight of Hand");

// Social
expect("persuade the guard to let us pass", "Persuasion");
expect("lie to the innkeeper about our names", "Deception");
expect("intimidate the bandit into talking", "Intimidation");
expect("treat the wounded soldier", "Medicine");

// Ambiguous / no clear skill → null (let the DM decide)
expect("attack the goblin", null);
expect("walk into the tavern", null);
expect("say hello to the barkeep", null);
expect("wait and see what happens", null);

// ── Robustness sweep: realistic investigative phrasings a player actually types.
//    Each must resolve to a sensible "look/search/know" skill and NEVER to Stealth
//    or a physical skill (the class of error in the screenshot). ──
const INVESTIGATIVE = [
  "check the area for footprints or recent activity",
  "I check the ground around the trees for tracks",
  "look for any signs of recent activity here",
  "scan the clearing for movement",
  "search the campsite for clues",
  "examine the dead trees for markings",
  "inspect the area for anything unusual",
  "look around for footprints",
  "study the disturbed earth",
  "check the perimeter for signs of someone passing",
  "look for boot prints in the snow",
  "scan the room for hidden compartments",
];
const SENSIBLE = new Set(["Perception", "Investigation", "Survival", "Nature"]);
const FORBIDDEN = new Set(["Stealth", "Acrobatics", "Athletics", "Sleight of Hand"]);
for (const a of INVESTIGATIVE) {
  const got = inferSkillCheck(a)?.skill ?? null;
  // Must classify (not null) AND be a sensible look/search skill AND never a forbidden one.
  if (got && SENSIBLE.has(got) && !FORBIDDEN.has(got)) pass++;
  else fails.push(`  ✗ investigative "${a}" → got ${got ?? "null"} (want a look/search skill, never Stealth/physical)`);
}

console.log(`\nSkill-check inference battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Actions map to the correct 5e skill (investigate → Investigation, never Acrobatics).");
