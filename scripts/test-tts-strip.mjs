// Verify the TTS normalizer strips all bracketed system tokens

function normalizeForTTS(raw) {
  return raw
    .replace(/\*/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/=/g, " equals ")
    .replace(/^[-*_]{2,}\s*$/gm, "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/^-+\s*/gm, "")
    .replace(/-+\s*$/gm, "")
    .replace(/(?<![a-zA-Z0-9])-+(?![a-zA-Z0-9])/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripTtsArtifacts(text) {
  return text
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\*+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const cases = [
  ["Aria takes [HP:Aria:-9] damage from the blow.",            "Aria takes damage from the blow."],
  ["She rolls a d20 and adds [1d8+3] to her attack.",          "She rolls a d20 and adds to her attack."],
  ["The strike lands — [12 + 3 STR + 2 Prof = 17] hits AC 14!","The strike lands, hits AC 14!"],
  ["Thorin casts a spell [Spell ATK +5] at the goblin.",       "Thorin casts a spell at the goblin."],
  ["The damage deals 11 + 3 [STR] + 2 [Prof] = 16 to the orc.","The damage deals 11 + 3 + 2 equals 16 to the orc."],
  ["It's a +1 weapon [+1 weapon] of magical bite.",            "It's a +1 weapon of magical bite."],
  ["Roll a [d20: 14 + 3 = 17] to hit.",                        "Roll a to hit."],
  ["**Barnabus** comes away with a leather pouch.",            "Barnabus comes away with a leather pouch."],
];

let pass = 0, fail = 0;
for (const [input, expected] of cases) {
  const ttsOut    = normalizeForTTS(input);
  const clientOut = stripTtsArtifacts(input);
  const expectNoBrackets = !ttsOut.includes("[") && !ttsOut.includes("]");
  const clientNoBrackets = !clientOut.includes("[") && !clientOut.includes("]");
  const matchesExpected  = ttsOut === expected;
  const ok = expectNoBrackets && clientNoBrackets && matchesExpected;
  console.log(`${ok ? "✓" : "✗"} "${input.slice(0, 50)}…"`);
  if (!ok) {
    console.log(`     server: "${ttsOut}"`);
    console.log(`     client: "${clientOut}"`);
    console.log(`     expect: "${expected}"`);
  }
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
