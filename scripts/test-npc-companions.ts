// Verifies sticky-companion NPC behavior: companions survive a scene change even
// when not re-emitted, [NPC-JOIN] parsing, and join-narration detection.
// Run: npx tsx scripts/test-npc-companions.ts
import { parseNpcTags, resetNpcRoster, mergeNpcRoster, npcJoinedInNarrative, type NpcCardLike } from "../src/lib/npcTags";

type Card = NpcCardLike & { portrait_url?: string };
let pass = 0, fail = 0;
const check = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.log(`  ✗ ${name}`); } };

// 1) [NPC-JOIN] parsing
const tags = parseNpcTags("Sera nods. [NPC:Sera:weary woman in chains] [NPC-JOIN:Sera] She falls in beside you.");
check("parses [NPC-JOIN] into joined", tags.joined.length === 1 && tags.joined[0] === "Sera");
check("still parses [NPC:] entered", tags.entered.some(e => e.name === "Sera"));

// 2) join-narration detection (no tag)
check("detects 'joins your party'", npcJoinedInNarrative("Garrick joins your party with a grim nod.", "Garrick"));
check("detects 'comes with you'", npcJoinedInNarrative("The healer Mira comes with you into the dark.", "Mira"));
check("detects 'travels with the group'", npcJoinedInNarrative("Old Tom travels with the group from now on.", "Tom"));
check("title-prefixed name still matches", npcJoinedInNarrative("Lady Sera agrees to come along.", "Lady Sera"));
check("does NOT fire on plain mention", !npcJoinedInNarrative("Sera watches from the doorway.", "Sera"));
check("does NOT fire on enemy joining a fight", !npcJoinedInNarrative("A second goblin joins the attack.", "Sera"));

// 3) SCENE RESET keeps companions even when NOT re-emitted
const prev: Card[] = [
  { name: "Sera", desc: "freed captive", is_companion: true, portrait_url: "sera.png" },
  { name: "Innkeeper Bram", desc: "behind the bar" }, // location NPC, not a companion
];
// Party moves to a cave; the DM re-emits only a new NPC, forgets Sera + leaves Bram behind.
const afterMove = resetNpcRoster(prev, [{ name: "Cave Hermit", desc: "ragged old man" } as Card], 6);
check("companion Sera survives the move", afterMove.some(n => n.name === "Sera" && n.is_companion));
check("companion keeps her portrait", afterMove.find(n => n.name === "Sera")?.portrait_url === "sera.png");
check("non-companion Bram is dropped on move", !afterMove.some(n => n.name === "Innkeeper Bram"));
check("new scene NPC is added", afterMove.some(n => n.name === "Cave Hermit"));

// 4) explicit departure STILL removes a companion (same-scene merge with gone)
const afterGone = mergeNpcRoster(prev, [], ["Sera"], 6);
check("explicit [NPC-GONE] removes the companion", !afterGone.some(n => n.name === "Sera"));

// 5) re-emitting a companion on move preserves the flag (existing entry reused)
const afterReEmit = resetNpcRoster(prev, [{ name: "Sera", desc: "now at your side" } as Card], 6);
check("re-emitted companion stays a companion", afterReEmit.find(n => n.name === "Sera")?.is_companion === true);
check("re-emit updates description", afterReEmit.find(n => n.name === "Sera")?.desc === "now at your side");

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) process.exit(1);
console.log("✓ Sticky-companion NPC logic is correct.");
