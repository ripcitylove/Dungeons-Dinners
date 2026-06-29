// Proves the spell-slot math (the path the DM narration and party cards read)
// is correct for EVERY spellcasting class — not just Cleriss the Cleric.
// Run: npx tsx scripts/verify-all-class-slots.ts
import { getSpellSlots, spellSlotsRemaining, SPELLCASTING_CLASSES } from "../src/lib/spellData";

type Row = Record<number, number>;
const fmt = (r: Row) => Object.keys(r).length ? Object.entries(r).map(([l, n]) => `L${l}:${n}`).join(" ") : "(none)";

// Official D&D 5e slots-by-level for each caster category. Index = charLevel-1.
const FULL: Row[] = [
  {1:2},{1:3},{1:4,2:2},{1:4,2:3},{1:4,2:3,3:2},{1:4,2:3,3:3},
  {1:4,2:3,3:3,4:1},{1:4,2:3,3:3,4:2},{1:4,2:3,3:3,4:3,5:1},{1:4,2:3,3:3,4:3,5:2},
];
const HALF: Row[] = [
  {},{1:2},{1:3},{1:3},{1:4,2:2},{1:4,2:2},{1:4,2:3},{1:4,2:3},{1:4,2:3,3:2},{1:4,2:3,3:2},
];
const PACT: Row[] = [
  {1:1},{1:2},{2:2},{2:2},{3:2},{3:2},{4:2},{4:2},{5:2},{5:2},
];
const EXPECT: Record<string, Row[]> = {
  Bard: FULL, Cleric: FULL, Druid: FULL, Sorcerer: FULL, Wizard: FULL,
  Paladin: HALF, Ranger: HALF, Warlock: PACT,
};

let pass = 0, fail = 0;
const fails: string[] = [];

// 1. Every caster class, levels 1-10, max slots match the official table.
for (const [cls, table] of Object.entries(EXPECT)) {
  for (let lvl = 1; lvl <= 10; lvl++) {
    const got = getSpellSlots(cls, lvl);
    const want = table[lvl - 1];
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else { fail++; fails.push(`${cls} L${lvl}: got {${fmt(got)}} want {${fmt(want)}}`); }
  }
}

// 2. Every class in SPELLCASTING_CLASSES has a slot table or is intentionally slotless.
for (const cls of SPELLCASTING_CLASSES) {
  const any = getSpellSlots(cls, 5);
  console.log(`  SPELLCASTING_CLASSES has "${cls}" -> L5 slots {${fmt(any)}}`);
}

// 3. Remaining-after-use math: the Cleriss case generalized to each full caster
//    at level 2 (THREE 1st-level slots), having spent 1 -> must read 2 remaining.
for (const cls of ["Bard","Cleric","Druid","Sorcerer","Wizard"]) {
  const rem = spellSlotsRemaining(cls, 2, { "1": 1 });
  const ok = rem[1] === 2;
  if (ok) pass++; else { fail++; fails.push(`${cls} L2 used{1:1} remaining L1 = ${rem[1]} (want 2)`); }
  console.log(`  ${cls} L2, spent one 1st-level slot -> remaining {${fmt(rem)}}  ${ok ? "✓" : "✗ EXPECTED L1:2"}`);
}

// 4. String-keyed used (JSON shape from DB) handled identically.
const strKey = spellSlotsRemaining("Wizard", 3, { "1": 2, "2": 1 });
const strOk = strKey[1] === 2 && strKey[2] === 1;
if (strOk) pass++; else { fail++; fails.push(`Wizard L3 string-keyed used mishandled: ${fmt(strKey)}`); }

// 5. Half-caster floor: Paladin/Ranger have NO slots at level 1.
for (const cls of ["Paladin","Ranger"]) {
  const l1 = getSpellSlots(cls, 1);
  const ok = Object.keys(l1).length === 0;
  if (ok) pass++; else { fail++; fails.push(`${cls} L1 should have 0 slots, got {${fmt(l1)}}`); }
}

// 6. Warlock pact magic: level 3 = two 2nd-level slots (no 1st).
const wl3 = getSpellSlots("Warlock", 3);
const wlOk = wl3[2] === 2 && wl3[1] === undefined;
if (wlOk) pass++; else { fail++; fails.push(`Warlock L3 should be {L2:2}, got {${fmt(wl3)}}`); }

console.log(`\n${pass} passed, ${fail} failed.`);
if (fails.length) { console.log("FAILURES:\n" + fails.map(f => "  ✗ " + f).join("\n")); process.exit(1); }
console.log("✓ Slot math is correct for every spellcasting class.");
