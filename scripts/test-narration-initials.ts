// TTS initials sanitization. "L.V.," used to reach ElevenLabs with the periods
// intact and the narrator stumbled. sanitizeForTts now spells initialisms as
// letters. Run: node scripts/test-narration-initials.ts
import { sanitizeForTts } from "../src/lib/narration.ts";

let pass = 0;
const fails: string[] = [];
// The sanitized speech must (a) contain no "X." initial-dot pattern, (b) keep the
// letters as spaced tokens so the engine voices them, (c) not mangle ordinary text.
const has = (out: string, sub: string) => out.includes(sub);
const t = (name: string, input: string, mustContain: string, mustNotMatch: RegExp) => {
  const out = sanitizeForTts(input);
  const ok = has(out, mustContain) && !mustNotMatch.test(out);
  if (ok) pass++; else fails.push(`  ✗ ${name}\n      in:  ${JSON.stringify(input)}\n      out: ${JSON.stringify(out)}\n      want contains ${JSON.stringify(mustContain)} and NOT ${mustNotMatch}`);
};

// initial-dot pattern: a single letter immediately followed by a period
const INITIAL_DOT = /\b[A-Za-z]\.[A-Za-z]?/;

t("two-initial L.V.",        "The sign read L.V. above the door.",        "L V", INITIAL_DOT);
t("L.V. with trailing comma","He muttered L.V., then left.",              "L V", INITIAL_DOT);
t("three-initial U.S.A.",    "She saluted the U.S.A. flag.",              "U S A", INITIAL_DOT);
t("lowercase a.m.",          "Meet me at 5 a.m. sharp.",                  "a m", INITIAL_DOT);
t("initials mid-name R.J.",  "R.J. drew his blade.",                      "R J", INITIAL_DOT);

// Regression: ordinary sentence-ending periods must NOT be touched / mangled.
{
  const out = sanitizeForTts("He drew his blade. She ran.");
  if (out.includes("blade. She") || out.includes("blade.She")) pass++;
  else fails.push(`  ✗ ordinary sentence periods preserved\n      out: ${JSON.stringify(out)}`);
}
// Regression: a single trailing initial / abbreviation is left alone (no false merge).
{
  const out = sanitizeForTts("They earned grade A. Bob nodded.");
  // must NOT merge the two sentences into "grade A Bob"
  if (!/grade A Bob/.test(out)) pass++;
  else fails.push(`  ✗ single capital + period at sentence end must NOT merge\n      out: ${JSON.stringify(out)}`);
}

console.log(`\nTTS initials battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Initialisms voiced as letters; ordinary periods untouched.");
