// Proves the chat-state extractor skip never drops state. SKIP = safe to bypass
// the Haiku extractor (turn fully covered by deterministic tags). RUN = extractor
// must execute (a condition / forgotten-HP / untagged spell could be in play).
// Run: npx tsx scripts/test-extractor-gate.ts
import { isFullyTagCovered } from "../src/lib/extractorGate";

type Case = { name: string; text: string; inCombat: boolean; expectSkip: boolean };
const cases: Case[] = [
  // --- SAFE TO SKIP: fully tag-covered, no extractor-only state ---
  { name: "gold only (tagged)", text: "You pocket the merchant's pouch. [GOLD:+15]", inCombat: false, expectSkip: true },
  { name: "loot only (tagged)", text: "A vial glints among the rubble. [LOOT:Potion of Healing]", inCombat: false, expectSkip: true },
  { name: "tagged HP + nothing else", text: "The trap nicks you as you pass. [HP:Tharin:-3]", inCombat: false, expectSkip: true },
  { name: "milestone xp (tagged)", text: "The council marks your deed. [XP:200]", inCombat: false, expectSkip: true },
  { name: "tagged cast, no concentration words", text: "Light blooms from your fingertips. [CAST:Mara:Light] [SPELL:Mara:light]", inCombat: false, expectSkip: true },
  { name: "weapon pickup (tagged)", text: "You claim the fallen guard's blade. [WEAPON:Longsword]", inCombat: false, expectSkip: true },

  // --- MUST RUN: status effect present (no [STATUS] tag exists) ---
  { name: "poisoned (untagged status)", text: "The blade was coated — you feel poison seep in. [HP:Tharin:-4]", inCombat: false, expectSkip: false },
  { name: "frightened", text: "Its gaze locks yours and terror takes hold; you are frightened. [GOLD:+0]", inCombat: false, expectSkip: false },
  { name: "blessed buff", text: "Warm light settles over you, blessed by the shrine. [LOOT:Holy Symbol]", inCombat: false, expectSkip: false },
  { name: "prone", text: "The shove knocks you prone. [HP:Tharin:-2]", inCombat: false, expectSkip: false },

  // --- MUST RUN: damage wording WITHOUT an HP tag (forgotten tag) ---
  { name: "damage words, no HP tag", text: "The ogre's club strikes true and the wound is deep. [GOLD:+5]", inCombat: false, expectSkip: false },
  { name: "bleeding out, no HP tag", text: "Blood pours from the gash in your side.", inCombat: false, expectSkip: false },

  // --- MUST RUN: spell wording WITHOUT a cast tag (forgotten tag) ---
  { name: "spell words, no cast tag", text: "You cast a spell and a slot is spent. [GOLD:+0]", inCombat: false, expectSkip: false },

  // --- MUST RUN: in combat (HP/conditions can land untagged) ---
  { name: "combat is always run", text: "You grab the dropped coins. [GOLD:+8]", inCombat: true, expectSkip: false },

  // --- MUST RUN: no tags at all (extractor is the only source) ---
  { name: "pure narration, no tags", text: "The wind howls across the empty moor.", inCombat: false, expectSkip: false },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const got = isFullyTagCovered(c.text, c.inCombat);
  const ok = got === c.expectSkip;
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? "✓" : "✗"} [${c.expectSkip ? "SKIP" : "RUN "}] ${c.name}${ok ? "" : `  (got ${got ? "SKIP" : "RUN"})`}`);
}
console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) { console.log("✗ Gate would drop state — fix before shipping."); process.exit(1); }
console.log("✓ Extractor skip is safe: never bypasses a turn that carries untagged state.");
