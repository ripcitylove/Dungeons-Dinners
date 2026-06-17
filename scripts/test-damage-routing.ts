// Combat damage-routing test battery. Runs realistic DM narration lines + the
// [HP:Name:±N] tag the DM emitted through the routing logic and asserts who
// actually takes the damage. Run: `node scripts/test-damage-routing.ts`
//
// The core invariant under test: when a PLAYER deals damage to an enemy, the
// player must NOT lose HP, even if the DM mis-emits a [HP:Player:-N] tag.
import { parseHpTag, damageTagShouldBeSuppressed } from "../src/lib/damageRouting.ts";

type Case = {
  name: string;          // player first name in the tag
  text: string;          // DM narration (includes the emitted tag)
  // What SHOULD happen to the player from this line:
  //   "apply"    = the player legitimately loses HP (enemy hit them)
  //   "suppress" = the tag is a misroute; player must NOT lose HP (they attacked)
  expect: "apply" | "suppress";
  note?: string;
};

// effective routing: the tag is applied to the player only if NOT suppressed.
function route(c: Case): "apply" | "suppress" {
  const delta = parseHpTag(c.text, c.name);
  if (delta === 0) return "apply"; // no tag for player → nothing misrouted (n/a)
  return damageTagShouldBeSuppressed(c.text, c.name, delta) ? "suppress" : "apply";
}

const CASES: Case[] = [
  // ── PLAYER ATTACKS ENEMY — misdirected self-tag must be SUPPRESSED ──
  { name: "Aria",   expect: "suppress", text: "Aria's blade bites deep into the goblin — 9 slashing damage. [HP:Aria:-9]" },
  { name: "Aria",   expect: "suppress", text: "Aria strikes the orc for 12 damage. [HP:Aria:-12]" },
  { name: "Aria",   expect: "suppress", text: "Aria slashes the goblin, dealing 9 slashing. [HP:Aria:-9]" },
  { name: "Aria",   expect: "suppress", text: "Aria's arrow pierces the wolf — 7 piercing! [HP:Aria:-7]" },
  { name: "Aria",   expect: "suppress", text: "Aria unleashes a firebolt; the kobold takes 8 fire damage. [HP:Aria:-8]", note: "enemy 'takes' near player name" },
  { name: "Aria",   expect: "suppress", text: "Aria casts Fire Bolt and the goblin takes 10 damage. [HP:Aria:-10]", note: "enemy 'takes' near player name" },
  { name: "Aria",   expect: "suppress", text: "Aria swings her axe and the bandit reels, taking 11. [HP:Aria:-11]", note: "enemy receiver verb near player" },
  { name: "Aria",   expect: "suppress", text: "With a mighty blow, Aria crushes the skeleton for 14. [HP:Aria:-14]" },
  { name: "Aria",   expect: "suppress", text: "Aria's greatsword cleaves into the ogre — the ogre suffers 15 slashing. [HP:Aria:-15]", note: "uncommon attack verb + enemy 'suffers'" },
  { name: "Aria",   expect: "suppress", text: "Aria hits! The goblin drops, taking 6 damage. [HP:Aria:-6]", note: "enemy 'drops/taking' near player" },
  { name: "Tiegan", expect: "suppress", text: "Tiegan hurls eldritch fire and the cultist takes 13 force damage. [HP:Tiegan:-13]" },
  { name: "Bjorn",  expect: "suppress", text: "Bjorn's warhammer smashes the troll for 18 bludgeoning. [HP:Bjorn:-18]" },

  // ── ENEMY ATTACKS PLAYER — tag is correct, must be APPLIED ──
  { name: "Aria",   expect: "apply", text: "The goblin's blade catches Aria — 7 piercing! [HP:Aria:-7]" },
  { name: "Aria",   expect: "apply", text: "The orc smashes Aria for 10 bludgeoning. [HP:Aria:-10]" },
  { name: "Aria",   expect: "apply", text: "Aria takes 8 slashing damage from the wolf's bite. [HP:Aria:-8]" },
  { name: "Aria",   expect: "apply", text: "The dragon's claws rake Aria, dealing 18 damage. [HP:Aria:-18]", note: "'dealing' attack verb but enemy is subject" },
  { name: "Aria",   expect: "apply", text: "Aria suffers 5 fire damage as the flames wash over her. [HP:Aria:-5]" },
  { name: "Aria",   expect: "apply", text: "The bandit stabs Aria in the shoulder — 6 piercing. [HP:Aria:-6]" },
  { name: "Aria",   expect: "apply", text: "Caught off guard, Aria reels from the blow and loses 9 HP. [HP:Aria:-9]" },
  { name: "Aria",   expect: "apply", text: "The skeleton's rusty blade bites into Aria's arm for 4. [HP:Aria:-4]", note: "enemy weapon, player possessive nearby" },
  { name: "Aria",   expect: "apply", text: "The troll grabs Aria and squeezes — 12 bludgeoning. [HP:Aria:-12]" },
  { name: "Aria",   expect: "apply", text: "Aria is hit hard by the ogre's club and takes 8. [HP:Aria:-8]", note: "passive voice" },
  { name: "Tiegan", expect: "apply", text: "The wraith's chill touch drains Tiegan for 9 necrotic. [HP:Tiegan:-9]" },

  // ── BOTH IN ONE LINE — player attacks AND takes damage; tag is the damage taken ──
  { name: "Aria",   expect: "apply", text: "Aria slashes the orc but takes 6 in return. [HP:Aria:-6]", note: "carried subject 'but takes'" },
  { name: "Aria",   expect: "apply", text: "Aria and the goblin trade blows; Aria takes 5, the goblin takes 8. [HP:Aria:-5]" },
];

let pass = 0;
const failures: string[] = [];
for (const c of CASES) {
  const got = route(c);
  if (got === c.expect) pass++;
  else failures.push(`  [${c.expect.toUpperCase()} expected, got ${got.toUpperCase()}] ${c.name}: "${c.text.replace(/\s*\[HP:[^\]]+\]/, "")}"${c.note ? `  (${c.note})` : ""}`);
}

console.log(`\nDamage-routing battery: ${pass}/${CASES.length} passed.`);
if (failures.length) {
  console.log(`\n${failures.length} FAILURES (these are misrouted damage):`);
  console.log(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("✓ All combat scenarios route damage to the correct target.");
}
