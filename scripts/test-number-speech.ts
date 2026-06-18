// Numbers → words for clean TTS pronunciation (the "5 sounds like feev" bug).
// Run: node scripts/test-number-speech.ts
import { numberToWords, numbersToWords } from "../src/lib/numberSpeech.ts";

let pass = 0;
const fails: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => {
  if (got === want) pass++;
  else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};

// ── numberToWords ──
eq("0", numberToWords(0), "zero");
eq("5 (the reported case)", numberToWords(5), "five");
eq("17", numberToWords(17), "seventeen");
eq("20", numberToWords(20), "twenty");
eq("47", numberToWords(47), "forty-seven");
eq("100", numberToWords(100), "one hundred");
eq("113", numberToWords(113), "one hundred thirteen");
eq("300", numberToWords(300), "three hundred");
eq("1250", numberToWords(1250), "one thousand two hundred fifty");

// ── numbersToWords in sentences ──
eq("damage total", numbersToWords("She takes 5 slashing."), "She takes five slashing.");
eq("the bug phrase", numbersToWords("17 bludgeoning."), "seventeen bludgeoning.");
eq("gold", numbersToWords("You find 47 gold pieces."), "You find forty-seven gold pieces.");
eq("dice notation", numbersToWords("Roll a d20 — go ahead."), "Roll a d twenty — go ahead.");
eq("dice with count", numbersToWords("Roll 2d8 for damage."), "Roll two d eight for damage.");
eq("d6", numbersToWords("Add 1d4 to your check."), "Add one d four to your check.");
eq("multiple numbers", numbersToWords("8 plus 3 equals 11."), "eight plus three equals eleven.");

// ── Must NOT mangle: decimals, words containing digits ──
eq("decimal untouched", numbersToWords("about 1.5 seconds"), "about 1.5 seconds");
eq("no digits unchanged", numbersToWords("The bear lurches sideways."), "The bear lurches sideways.");

console.log(`\nNumber-speech battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Numbers and dice notation are spoken as clean words (no 'feev' for 5).");
