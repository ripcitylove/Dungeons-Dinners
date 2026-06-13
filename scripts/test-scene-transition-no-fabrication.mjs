// Single-player action that triggers a scene transition — verify the DM doesn't
// invent actions for other party members during the narration.

const URL = "http://localhost:3000/api/chat";
const ABSENT_PLAYER = "Ekko";

const party = [
  { user_id: "u1", name: "Aria",   race: "Elf",      class: "Druid",   level: 1, hp: 9,  max_hp: 9,  ac: 14, strength: 10, dexterity: 14, constitution: 12, intelligence: 12, wisdom: 16, charisma: 10, inventory: { gold: 50, weapons: [], items: [] } },
  { user_id: "u2", name: "Thorin", race: "Dwarf",    class: "Fighter", level: 1, hp: 11, max_hp: 11, ac: 16, strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8,  inventory: { gold: 50, weapons: ["Longsword"], items: [] } },
  { user_id: "u3", name: "Vasha",  race: "Halfling", class: "Bard",    level: 1, hp: 8,  max_hp: 8,  ac: 13, strength: 10, dexterity: 14, constitution: 12, intelligence: 12, wisdom: 12, charisma: 16, inventory: { gold: 50, weapons: [], items: [] } },
  { user_id: "u4", name: "Ekko",   race: "Elf",      class: "Monk",    level: 1, hp: 9,  max_hp: 9,  ac: 15, strength: 10, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 14, charisma: 10, inventory: { gold: 50, weapons: [], items: [] } },
];

const messages = [
  { role: "dm", content: "The shrine looms ahead. An iron door sealed with runes stands in its base. Aria, what do you do?" },
  { role: "player", sender: "Aria", content: "I sprint for the vault door and try to push it open." },
];

const payload = {
  messages,
  character: party[0],
  party,
  prevActingPlayerName: "Aria",
  currentTurnPlayerName: "Thorin",
  turnOrder: ["Thorin", "Vasha", "Ekko"],
  campaignContext: { title: "Test", description: "Scene-transition fabrication regression test." },
};

console.log(`Posting single Aria action — checking DM doesn't fabricate ${ABSENT_PLAYER}'s action in the scene\n`);

const res = await fetch(URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

if (!res.ok || !res.body) { console.error(`✗ ${res.status}`); process.exit(1); }

const reader  = res.body.getReader();
const decoder = new TextDecoder();
let full = "";
while (true) { const { done, value } = await reader.read(); if (done) break; full += decoder.decode(value, { stream: true }); }

console.log("DM response:\n", full, "\n----");

const ACTION_VERBS = [
  "dives","dove","charges","charged","strikes","struck","casts","cast","leaps","leapt",
  "attacks","attacked","fires","fired","slashes","slashed","sings","sang","draws","drew",
  "lunges","lunged","sprints","sprinted","tumbles","tumbled","scrambles","scrambled",
  "rushes","rushed","plunges","plunged","crawls","crawled","ducks","ducked","dodges","dodged",
  "moves","moved","runs","ran","jumps","jumped","steps","stepped","follows","followed",
];
const esc = ABSENT_PLAYER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const violations = [];
for (const v of ACTION_VERBS) {
  const re = new RegExp(`\\b${esc}\\b(?:'s)?(?:\\s+\\w+){0,3}\\s+${v}\\b`, "i");
  const m = full.match(re);
  if (m) violations.push(`"${m[0]}"`);
}

const mentions = (full.match(new RegExp(`\\b${esc}\\b`, "gi")) ?? []).length;
console.log(`"${ABSENT_PLAYER}" mentions: ${mentions}, action-verb violations: ${violations.length}`);
if (violations.length > 0) {
  violations.forEach(v => console.log(`  ✗ ${v}`));
  process.exit(1);
}
console.log(`✓ ${ABSENT_PLAYER}'s action not fabricated`);
