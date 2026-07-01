// Enemy-defeat detection battery. Regression guard for the "killed enemies stay on
// screen" bug: roster labels carry a "#N" suffix but the DM narrates kills with the
// bare type / head noun, so the old exact-label match demoted real kills to "critical".
// Run: node scripts/test-enemy-defeat.mjs
import { defeatNamePattern, defeatIdentityPattern, DEFEAT_WORDS } from "../src/lib/enemyDefeat.ts";

let pass = 0; const fails = [];
const chk = (fn, name, narrative, want) => {
  const got = new RegExp(fn(name, DEFEAT_WORDS), "i").test(narrative);
  if (got === want) pass++;
  else fails.push(`  ✗ ${fn === defeatNamePattern ? "live" : "backfill"} name=${JSON.stringify(name)} want=${want} got=${got} :: ${JSON.stringify(narrative)}`);
};

// ── LIVE guard (loose base/head match; the classifier has already scoped the kill) ──
chk(defeatNamePattern, "Corrupted Miner #3", "The corrupted miner collapses in a heap.", true);
chk(defeatNamePattern, "Goblin #2", "You cut down the goblins in a whirl of steel.", true);
chk(defeatNamePattern, "Sundered Banner Soldier #10", "The last soldier falls dead to the floor.", true);
chk(defeatNamePattern, "Corrupted Miner #5", "Another miner crumples, lifeless.", true);
chk(defeatNamePattern, "Goblin #1", "Your arrow takes the goblin through the eye — it dies.", true);
chk(defeatNamePattern, "Cultist Leader", "The leader is slain where he stands.", true);
// Not deaths
chk(defeatNamePattern, "Goblin #2", "The goblin drops to one knee, reeling but still up.", false);
chk(defeatNamePattern, "Goblin #3", "The goblins press forward, blades raised.", false);
chk(defeatNamePattern, "Wolf #1", "The wolf snarls and lunges again.", false);
chk(defeatNamePattern, "Corrupted Miner #2", "The miner staggers back, badly wounded.", false);
chk(defeatNamePattern, "Sundered Banner Soldier #4", "The soldiers hold formation, shields locked.", false);

// ── BACKFILL matcher (identity-specific: only the exact "#N" dies) ──
chk(defeatIdentityPattern, "Corrupted Miner #7", "Miner #7 crumples to the tunnel floor as he falls.", true);
chk(defeatIdentityPattern, "Corrupted Miner #2", "Miner #2 seizes up and collapses. [XP:25]", true);
// A sibling must NOT be flagged by another's death
chk(defeatIdentityPattern, "Corrupted Miner #1", "Miner #7 crumples to the tunnel floor as he falls.", false);
chk(defeatIdentityPattern, "Corrupted Miner #5", "Miner #2 seizes up and collapses.", false);
// "#1" must not match "#10"
chk(defeatIdentityPattern, "Goblin #1", "Goblin #10 is cut down.", false);
chk(defeatIdentityPattern, "Goblin #10", "Goblin #10 is cut down.", true);
// Bare-type kill does NOT flag a specific numbered enemy in the backfill (needs the #N)
chk(defeatIdentityPattern, "Corrupted Miner #3", "A miner dies.", false);
// Un-numbered unique name → base/head match is safe (only one bearer)
chk(defeatIdentityPattern, "Cultist Leader", "The cult leader is slain.", true);

console.log(`\nEnemy-defeat battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exit(1); }
console.log("✓ Kills register via base/head; siblings & recaps never remove living foes.");
