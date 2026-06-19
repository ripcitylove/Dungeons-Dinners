// NPC presence tag parsing. Run: node scripts/test-npc-tags.ts
import { parseNpcTags, stripNpcTags } from "../src/lib/npcTags.ts";

let pass = 0;
const fails: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};

// ── parse entered ──
eq("single NPC", parseNpcTags("A woman waves you over. [NPC:Mira:a freckled innkeeper with kind eyes]"),
  { entered: [{ name: "Mira", desc: "a freckled innkeeper with kind eyes" }], gone: [] });
eq("two NPCs", parseNpcTags("[NPC:Captain Reyes:a stern guard captain in plate] [NPC:Pip:a nervous halfling urchin]"),
  { entered: [{ name: "Captain Reyes", desc: "a stern guard captain in plate" }, { name: "Pip", desc: "a nervous halfling urchin" }], gone: [] });
eq("empty description ok", parseNpcTags("[NPC:Stranger:]"), { entered: [{ name: "Stranger", desc: "" }], gone: [] });

// ── parse gone ──
eq("npc leaves", parseNpcTags("Mira slips into the back. [NPC-GONE:Mira]"), { entered: [], gone: ["Mira"] });
eq("enter + gone together", parseNpcTags("[NPC:Pip:a nervous halfling] [NPC-GONE:Mira]"),
  { entered: [{ name: "Pip", desc: "a nervous halfling" }], gone: ["Mira"] });

// ── none ──
eq("no tags", parseNpcTags("The road stretches on, empty and quiet."), { entered: [], gone: [] });

// ── stripping for display/TTS ──
eq("strip entered", stripNpcTags("A woman waves. [NPC:Mira:a kind innkeeper] She smiles."), "A woman waves.  She smiles.");
eq("strip gone", stripNpcTags("She leaves. [NPC-GONE:Mira]"), "She leaves. ");
eq("strip both", stripNpcTags("[NPC:Pip:urchin] hi [NPC-GONE:Mira]"), " hi ");

console.log(`\nNPC-tag battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ NPC enter/leave tags parse and strip cleanly.");
