// Backstop detector for narrated-active buffs/debuffs. The bug: "Randiezel has
// Shillelagh active" showed no icon on the card. Run: node scripts/test-active-effects.ts
import { detectActiveEffects } from "../src/lib/activeEffects.ts";

const PARTY = ["Shmang", "Randiezel", "Vi", "Ekko", "Barnabus"];
let pass = 0;
const fails: string[] = [];
const has = (name: string, text: string, who: string, effect: string) => {
  const got = detectActiveEffects(text, PARTY);
  if ((got[who] ?? []).includes(effect)) pass++;
  else fails.push(`  ✗ ${name}: expected ${who} → ${effect}; got ${JSON.stringify(got)}`);
};
const none = (name: string, text: string, who?: string) => {
  const got = detectActiveEffects(text, PARTY);
  const empty = who ? !(got[who]?.length) : Object.keys(got).length === 0;
  if (empty) pass++;
  else fails.push(`  ✗ ${name}: expected no effect${who ? ` for ${who}` : ""}; got ${JSON.stringify(got)}`);
};

// ── The reported case + variants ──
has("has X active", "Randiezel has Shillelagh active, staff humming.", "Randiezel", "Shillelagh");
has("possessive", "Randiezel's Shillelagh wreaths the staff in green light.", "Randiezel", "Shillelagh");
has("maintains", "Randiezel maintains Shillelagh as the figures close in.", "Randiezel", "Shillelagh");
has("X active … name", "Guidance active on Vi steadies her hand.", "Vi", "Guidance");
has("adjective buff", "Shmang has Mage Armor active, shimmering faintly.", "Shmang", "Mage Armor");
has("still has", "Vi still has Barkskin protecting her.", "Vi", "Barkskin");
has("two-word effect", "Ekko has Shield of Faith active.", "Ekko", "Shield of Faith");

// ── Removal contexts must NOT re-add ──
none("fades", "Randiezel's Shillelagh fades as the minute ends.", "Randiezel");
none("no longer", "Shillelagh is no longer active for Randiezel.", "Randiezel");
none("wears off", "Vi's Barkskin wears off, her skin softening.", "Vi");

// ── Flavor / non-active mentions must NOT trigger ──
none("flavor blessed", "Randiezel watches the blessed altar pulse red.");
none("name + effect far apart", "Randiezel steps back. Across the clearing, a Blessed relic glints.", "Randiezel");
none("no effect named", "Randiezel raises the humming staff and braces.");

// ── Recipient (bearer) wins over the possessive caster ──
has("possessive caster, recipient after", "Vi's Guidance settles over Barnabus, sharpening him for what comes next.", "Barnabus", "Guidance");
none("…and the caster does NOT also get it", "Vi's Guidance settles over Barnabus, sharpening him.", "Vi");
has("recipient via 'on'", "Resistance active on Ekko as he braces.", "Ekko", "Resistance");

// ── Correct attribution: effect tied to the right character ──
const multi = detectActiveEffects("Randiezel has Shillelagh active; Vi has Guidance active.", PARTY);
if ((multi["Randiezel"] ?? []).includes("Shillelagh") && (multi["Vi"] ?? []).includes("Guidance")
    && !(multi["Randiezel"] ?? []).includes("Guidance")) pass++;
else fails.push(`  ✗ multi-attribution wrong: ${JSON.stringify(multi)}`);

console.log(`\nActive-effects backstop battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Narrated-active buffs are detected per character; removals and flavor are ignored.");
