// Integration test: post a round-reconciliation payload that includes only 3 of 4 party
// members in the action summary, and verify the DM never makes the omitted player the
// subject of an action verb. Runs against the live dev server.

const URL = "http://localhost:3000/api/chat";

const ABSENT_PLAYER = "Ekko";
const ACTING_PLAYERS = ["Aria", "Thorin", "Vasha"];

const party = [
  { user_id: "u1", name: "Aria",   race: "Elf",      class: "Druid",  level: 1, hp: 9,  max_hp: 9,  ac: 14, strength: 10, dexterity: 14, constitution: 12, intelligence: 12, wisdom: 16, charisma: 10, inventory: { gold: 50, weapons: [], items: [] } },
  { user_id: "u2", name: "Thorin", race: "Dwarf",    class: "Fighter",level: 1, hp: 11, max_hp: 11, ac: 16, strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8,  inventory: { gold: 50, weapons: ["Longsword"], items: [] } },
  { user_id: "u3", name: "Vasha",  race: "Halfling", class: "Bard",   level: 1, hp: 8,  max_hp: 8,  ac: 13, strength: 10, dexterity: 14, constitution: 12, intelligence: 12, wisdom: 12, charisma: 16, inventory: { gold: 50, weapons: [], items: [] } },
  { user_id: "u4", name: "Ekko",   race: "Elf",      class: "Monk",   level: 1, hp: 9,  max_hp: 9,  ac: 15, strength: 10, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 14, charisma: 10, inventory: { gold: 50, weapons: [], items: [] } },
];

const messages = [
  { role: "player", sender: "Aria",   content: "I cast Entangle on the rooty hunger advancing on us." },
  { role: "dm",                       content: "The roots writhe outward, snaring the creature. Thorin, what do you do?" },
  { role: "player", sender: "Thorin", content: "I charge with my longsword and strike the creature." },
  { role: "dm",                       content: "The blade sinks deep. Vasha, what do you do?" },
  { role: "player", sender: "Vasha",  content: "I sing an Inspiration into Thorin's next strike." },
  { role: "dm",                       content: "Your voice sharpens his next swing. Ekko, what do you do?" },
];

const payload = {
  messages,
  character: party[0],
  party,
  pendingReconciliation: false,
  roundSummary: ACTING_PLAYERS.map(n => ({ name: n, action: messages.find(m => m.sender === n)?.content ?? "" })),
  prevActingPlayerName: "Vasha",
  campaignContext: { title: "Test Campaign", description: "Verify the DM doesn't fabricate actions for absent players." },
};

console.log(`Posting reconciliation with acting players [${ACTING_PLAYERS.join(", ")}] — ${ABSENT_PLAYER} omitted`);
console.log(`Listening for any sentence where "${ABSENT_PLAYER}" is the subject of an action verb…\n`);

const res = await fetch(URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

if (!res.ok || !res.body) {
  console.error(`✗ Request failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const reader  = res.body.getReader();
const decoder = new TextDecoder();
let full = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  full += decoder.decode(value, { stream: true });
}

console.log("DM response:\n");
console.log(full);
console.log("\n----");

// Heuristic violation detection: look for "Ekko" followed (within ~3 words) by a strong action verb.
// Allows passive mentions like "the party including Ekko" but flags "Ekko dives/charges/casts/etc."
const ACTION_VERBS = [
  "dives","dove","charges","charged","strikes","struck","swings","swung","casts","cast",
  "leaps","leapt","attacks","attacked","fires","fired","throws","threw","slashes","slashed",
  "sings","sang","sneaks","snuck","draws","drew","raises","raised","slams","slammed",
  "lunges","lunged","sprints","sprinted","crashes","crashed","tumbles","tumbled",
  "scrambles","scrambled","rushes","rushed","plunges","plunged","crawls","crawled",
  "ducks","ducked","dodges","dodged","grabs","grabbed","shouts","shouted","whispers","whispered",
  "moves","moved","runs","ran","jumps","jumped",
];
const escapedName = ABSENT_PLAYER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const violations = [];
for (const verb of ACTION_VERBS) {
  // "Ekko <verb>" or "Ekko, <something brief>, <verb>" etc.
  const re = new RegExp(`\\b${escapedName}\\b(?:'s)?(?:\\s+\\w+){0,3}\\s+${verb}\\b`, "i");
  const m = full.match(re);
  if (m) violations.push(`"${m[0]}"`);
}

const subjectMentions = (full.match(new RegExp(`\\b${escapedName}\\b`, "gi")) ?? []).length;
console.log(`"${ABSENT_PLAYER}" mentioned ${subjectMentions} time(s)`);
console.log(`Action-verb subject violations: ${violations.length}`);
if (violations.length > 0) {
  console.log("\n✗ VIOLATIONS:");
  violations.forEach(v => console.log(`  ${v}`));
  process.exit(1);
} else {
  console.log("\n✓ No fabricated action for the absent player");
}
