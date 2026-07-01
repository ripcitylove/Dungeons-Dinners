// Behavioral probe against the LIVE dev /api/chat — verifies the DM-prompt changes
// actually take effect end to end. Run: npx tsx scripts/probe-combat-fixes.mjs
// (dev server must be running on :3000)
import { detectRequiredRoll } from "../src/lib/diceRequest.ts";
const BASE = "http://localhost:3000";

const mkChar = (o) => ({
  id: o.id, name: o.name, race: o.race ?? "Human", class: o.class, sex: o.sex ?? "male",
  level: o.level ?? 1, xp: 0, max_hp: o.max_hp ?? 12, hp: o.hp ?? (o.max_hp ?? 12),
  strength: o.strength ?? 16, dexterity: o.dexterity ?? 14, constitution: o.constitution ?? 14,
  intelligence: o.intelligence ?? 10, wisdom: o.wisdom ?? 12, charisma: o.charisma ?? 10,
  inventory: o.inventory ?? { gold: 0, items: [], weapons: [] },
  cantrips_known: o.cantrips_known ?? [], spells_prepared: o.spells_prepared ?? [],
  spell_slots_used: o.spell_slots_used ?? {}, status_effects: o.status_effects ?? [],
  class_resources: o.class_resources ?? {}, title: o.title ?? null, pronouns: o.pronouns ?? "he/him",
});

async function ask(body) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) return `HTTP ${res.status}: ${await res.text()}`;
  const reader = res.body.getReader(); const dec = new TextDecoder(); let out = "";
  for (;;) { const { value, done } = await reader.read(); if (done) break; out += dec.decode(value, { stream: true }); }
  return out.trim();
}

const results = [];
function judge(name, text, checks) {
  const fails = checks.filter(c => !c.ok(text)).map(c => c.label);
  results.push({ name, ok: fails.length === 0, fails, text });
}

// ── Scenario 1: invalid maneuver keeps the SAME player's turn ─────────────────
async function scenarioNoTurn() {
  const grog = mkChar({ id: "grog", name: "Grog Smashstone", class: "Barbarian", level: 1, max_hp: 15 });
  const jana = mkChar({ id: "jana", name: "Jana Felhammer", class: "Paladin", level: 2, max_hp: 20, sex: "female", pronouns: "she/her" });
  const text = await ask({
    messages: [
      { role: "dm", content: "5 + 3 [Melee ATK] = 8 — misses AC 11. The shortsword skips off the tunnel wall. Your move, Grog.", sender: null },
      { role: "player", content: "Run in and do a whirlwind attack to try and hit multiple targets.", sender: "Grog Smashstone" },
    ],
    character: grog, party: [grog, jana],
    campaignContext: { title: "The Tunnels", description: "A goblin ambush in cramped mining tunnels." },
    enemies: [{ name: "Goblin", condition: "healthy" }, { name: "Goblin #2", condition: "wounded" }],
    currentTurnPlayerName: "Grog Smashstone", prevActingPlayerName: "Grog Smashstone",
    turnOrder: ["grog", "jana"],
  });
  judge("1. Invalid maneuver → keeps Grog's turn", text, [
    { label: "emits [NO-TURN]", ok: t => /\[NO-?TURN\]/i.test(t) },
    { label: "re-addresses Grog (not Jana)", ok: t => /\bGrog\b/i.test(t) && !/\bJana\b/i.test(t) },
    { label: "does not narrate the whirlwind as happening", ok: t => !/whirl(s|ing)?\b.*(cut|slash|strike|hits|carv)/i.test(t) },
  ]);
}

// ── Scenario 2: rogue Sneak Attack prompts a multi-die follow-up ──────────────
async function scenarioSneak() {
  const vex = mkChar({ id: "vex", name: "Vex", class: "Rogue", level: 5, max_hp: 32, dexterity: 18,
    inventory: { gold: 0, items: [], weapons: ["Dagger"] } });
  const text = await ask({
    messages: [
      { role: "player", content: "I sneak up and stab the guard with my dagger — I have advantage from hiding.", sender: "Vex" },
      { role: "dm", content: "You slip from the shadows behind the guard. Roll a d20.", sender: null },
      { role: "player", content: "[Rolled a 17 on a d20]", sender: "Vex" },
      { role: "dm", content: "17 + 7 [DEX] + [Prof] = 24 — hits AC 15! Roll a d4 for your dagger.", sender: null },
      { role: "player", content: "[Rolled a 3 on a d4]", sender: "Vex" },
    ],
    character: vex, party: [vex],
    campaignContext: { title: "The Keep", description: "Infiltrating a guarded keep." },
    enemies: [{ name: "Guard", condition: "healthy" }],
    currentTurnPlayerName: "Vex", prevActingPlayerName: "Vex", isRollResult: true, turnOrder: ["vex"],
  });
  judge("2. Rogue hit → prompts multi-die Sneak Attack", text, [
    { label: "prompts a Sneak Attack roll", ok: t => /sneak attack/i.test(t) },
    { label: "asks for Nd6 (multi-die)", ok: t => /\broll\b[\s\S]{0,40}?\dd6/i.test(t) || /\b[2-6]d6\b/i.test(t) },
  ]);
}

// ── Scenario 3: downed hero's turn → DM announces the death save ──────────────
async function scenarioDeathSave() {
  const kael = mkChar({ id: "kael", name: "Kael", class: "Fighter", level: 3, max_hp: 28, hp: 0,
    status_effects: ["Unconscious"], class_resources: { death_fails: 0 } });
  const mira = mkChar({ id: "mira", name: "Mira", class: "Cleric", level: 3, max_hp: 24, sex: "female", pronouns: "she/her" });
  const text = await ask({
    messages: [
      { role: "dm", content: "The ogre's club crashes into Kael and he crumples to the stone, unmoving. [HP:Kael:-14]", sender: null },
      { role: "player", content: "[It is Kael's turn]", sender: null },
    ],
    character: kael, party: [kael, mira],
    campaignContext: { title: "The Ogre's Den", description: "A brutal fight against a cave ogre." },
    enemies: [{ name: "Ogre", condition: "bloodied" }],
    currentTurnPlayerName: "Kael", prevActingPlayerName: "Kael", turnOrder: ["kael", "mira"],
  });
  judge("3. Downed hero's turn → DM announces death save", text, [
    { label: "mentions a death saving throw", ok: t => /death sav/i.test(t) },
    { label: "addresses Kael (not skipped)", ok: t => /\bKael\b/i.test(t) },
    { label: "does NOT say 'Roll a d20' (engine owns the die)", ok: t => !/roll\s+(?:a\s+)?d20/i.test(t) },
  ]);
}

// ── Scenario 4: cleric Cure Wounds → caster rolls the healing die ─────────────
async function scenarioHeal() {
  const lyra = mkChar({ id: "lyra", name: "Lyra", class: "Cleric", level: 3, max_hp: 24, sex: "female", pronouns: "she/her",
    wisdom: 16, cantrips_known: ["Sacred Flame"], spells_prepared: ["Cure Wounds", "Bless", "Healing Word"] });
  const thorin = mkChar({ id: "thorin", name: "Thorin", class: "Fighter", level: 3, max_hp: 30, hp: 9 });
  const text = await ask({
    messages: [
      { role: "dm", content: "Thorin bleeds from the ogre's blow. Lyra, your move.", sender: null },
      { role: "player", content: "I cast Cure Wounds on Thorin.", sender: "Lyra" },
    ],
    character: lyra, party: [lyra, thorin],
    campaignContext: { title: "The Ogre's Den", description: "A brutal fight against a cave ogre." },
    enemies: [{ name: "Ogre", condition: "bloodied" }],
    currentTurnPlayerName: "Lyra", prevActingPlayerName: "Lyra", turnOrder: ["lyra", "thorin"],
  });
  judge("4. Cleric Cure Wounds → caster rolls the heal die", text, [
    { label: "prompts a d8 heal roll (not auto-applied)", ok: t => /\broll\b[\s\S]{0,30}?d8/i.test(t) },
    { label: "does not pre-state a healed HP tag before the roll", ok: t => !/\[HP:Thorin:\+\d/i.test(t) },
  ]);
}

// ── Scenario 5: REGRESSION — a plain attack still asks for a single d20 ───────
async function scenarioRegression() {
  const bron = mkChar({ id: "bron", name: "Bron", class: "Fighter", level: 2, max_hp: 22, strength: 17,
    inventory: { gold: 0, items: ["Shield"], weapons: ["Longsword"] } });
  const text = await ask({
    messages: [
      { role: "dm", content: "The bandit lunges at you. Your move, Bron.", sender: null },
      { role: "player", content: "I swing my longsword at the bandit.", sender: "Bron" },
    ],
    character: bron, party: [bron],
    campaignContext: { title: "The Road", description: "A bandit ambush on the king's road." },
    enemies: [{ name: "Bandit", condition: "healthy" }],
    currentTurnPlayerName: "Bron", prevActingPlayerName: "Bron", turnOrder: ["bron"],
  });
  judge("5. Plain attack → single d20 to hit (no regression)", text, [
    { label: "asks for a d20", ok: t => /roll\s+(?:a\s+)?d20/i.test(t) },
    { label: "does NOT ask for a multi-die or damage yet", ok: t => !/\b[2-9]d\d/i.test(t) },
  ]);
}

// ── Scenario 6: player saving throw → roller die type actually resolves ───────
// The reported bug: clicking the dice button showed no dice because the save's die
// type never resolved. Assert the DM calls for the save AND that detectRequiredRoll
// (the exact fn the client uses) resolves it to a d20 → the roller WILL open.
async function scenarioSave() {
  const aria = mkChar({ id: "aria", name: "Aria", class: "Ranger", level: 4, max_hp: 30, sex: "female", pronouns: "she/her" });
  const text = await ask({
    messages: [
      { role: "dm", content: "The cultist thrusts a bony hand toward Aria, chanting Hold Person.", sender: null },
      { role: "player", content: "I try to resist the spell!", sender: "Aria" },
    ],
    character: aria, party: [aria],
    campaignContext: { title: "The Crypt", description: "A cult ritual in an old crypt." },
    enemies: [{ name: "Cultist", condition: "healthy" }],
    currentTurnPlayerName: "Aria", prevActingPlayerName: "Aria", turnOrder: ["aria"],
  });
  const roll = detectRequiredRoll(text);
  judge("6. Player save → die type resolves (roller opens)", text, [
    { label: "DM calls for a save / d20", ok: t => /sav(?:e|ing)|\bd20\b/i.test(t) },
    { label: "detectRequiredRoll resolves a d20 (roller shows dice)", ok: () => roll?.sides === 20 && roll?.count === 1 },
    { label: "not misrouted as a death save", ok: t => !/death sav/i.test(t) },
  ]);
}

// ── Scenario 7: finishing blow on a CRITICAL enemy still needs the to-hit roll ──
async function scenarioFinishingBlow() {
  const grog = mkChar({ id: "grog", name: "Grog", class: "Barbarian", level: 3, max_hp: 30, strength: 18,
    inventory: { gold: 0, items: [], weapons: ["Greataxe"] } });
  const text = await ask({
    messages: [
      { role: "dm", content: "The last goblin reels, barely standing, blood streaming down its face. Your move, Grog.", sender: null },
      { role: "player", content: "I finish it off with my greataxe — swing for the kill.", sender: "Grog" },
    ],
    character: grog, party: [grog],
    campaignContext: { title: "The Warren", description: "Clearing a goblin warren." },
    enemies: [{ name: "Goblin", condition: "critical" }],
    currentTurnPlayerName: "Grog", prevActingPlayerName: "Grog", turnOrder: ["grog"],
  });
  judge("7. Finishing blow on critical enemy → still calls for the roll", text, [
    { label: "calls for a d20 to hit", ok: t => /roll\s+(?:a\s+)?d20/i.test(t) },
    { label: "does NOT narrate the kill before the roll", ok: t => !/\b(?:kills?|slain|dead|dies|beheads?|ends? it|finishes? it|crumples|collapses)\b/i.test(t) },
  ]);
}

const [, , only] = process.argv;
const all = { 1: scenarioNoTurn, 2: scenarioSneak, 3: scenarioDeathSave, 4: scenarioHeal, 5: scenarioRegression, 6: scenarioSave, 7: scenarioFinishingBlow };
const run = only ? [all[only]] : Object.values(all);
for (const fn of run) { try { await fn(); } catch (e) { results.push({ name: fn.name, ok: false, fails: [String(e)], text: "" }); } }

console.log("\n══════ COMBAT-FIX LIVE PROBE (dev /api/chat) ══════\n");
for (const r of results) {
  console.log(`${r.ok ? "✅ PASS" : "❌ FAIL"}  ${r.name}`);
  if (!r.ok) r.fails.forEach(f => console.log(`         ↳ missing: ${f}`));
  console.log(`   DM said: ${r.text.replace(/\s+/g, " ").slice(0, 320)}\n`);
}
const passed = results.filter(r => r.ok).length;
console.log(`── ${passed}/${results.length} scenarios passed ──`);
process.exit(passed === results.length ? 0 : 1);
