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

console.log(`\nSkill-check inference battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Actions map to the correct 5e skill (investigate → Investigation, never Acrobatics).");
