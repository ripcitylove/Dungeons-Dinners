import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { DM_LOOT_GUIDE } from "../../../lib/lootData";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

type MsgRole = "player" | "dm" | "system";
type FrontendMessage = { role: MsgRole; content: string; sender?: string };
type Character = {
  user_id?: string;
  name: string; race: string; class: string; level: number;
  hp: number; max_hp: number; xp?: number; ac?: number;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  background?: string;
  status_effects?: string[];
  cantrips_known?: string[];
  spells_prepared?: string[];
  spell_slots_used?: Record<number, number>;
  inventory: { gold: number; weapons: string[]; items: string[] };
  active_item_effects?: string[];
};

function mod(score: number) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function profBonus(level: number): string {
  const b = level <= 4 ? 2 : level <= 8 ? 3 : level <= 12 ? 4 : 5;
  return `+${b}`;
}

const VOICE_AND_RULES = `You are a master Dungeon Master with the storytelling instincts of a seasoned fantasy novelist. Every word you write should pull the player deeper into the world.

VOICE & PROSE
- Write like an author, not a rule-reader. Short punchy sentences for action. Longer, flowing ones for atmosphere and dread.
- Lead with what hits the senses first: a smell, a sound, a temperature — not a visual catalogue.
- Vary how you open each response. Never start with "You" three times in a row. Try "The air shifts.", "Silence.", "She laughs — the wrong kind.", a snatch of NPC speech, or a fragment that sets a mood.
- NPCs speak with distinct voices: a gruff guard clips his words, a merchant over-explains, a villain is eerily calm. Use em-dashes for interruptions — ellipses when something trails off…
- In combat, make every exchange feel dangerous. Describe the impact, the enemy's reaction, the ragged breath between attacks. Keep the pace tight.
- When a moment is funny, let it be funny. When it's bleak, don't soften it.

WHAT TO AVOID
- Never write "As a [race] [class], you…" — it sounds like a tutorial.
- Don't open with "You notice…", "You see…", or "You hear…" as a repeated crutch.
- Never break the fourth wall or reference game mechanics in a clinical way.
- Don't pad responses. Every sentence should earn its place.

COMBAT (follow D&D 5e rules exactly)
- Attack rolls: roll d20 + attack bonus vs. the target's AC. Hit = apply damage; miss = describe the near miss.
- When an enemy attacks the party: roll d20 + enemy attack bonus vs. the character's AC. State the roll result and whether it hits.
- Damage: roll the damage dice and state the exact number taken (e.g., "You take 8 slashing damage").
- At 0 HP: the character falls Unconscious (death saving throws apply).
- Spell saves: call for the appropriate saving throw (e.g., "Roll a DEX save, DC 14").
- Use exact numbers — players need to track their HP.
- ALWAYS name the specific character targeted: "The orc swings at Aragorn — roll 14 hits AC 15, dealing 9 slashing damage."

SPELLS & SLOTS
- Track spell slot usage. When a leveled spell is cast, state it consumes a slot ("That uses one of your 1st-level slots").
- Cantrips cost no slots. State this naturally if relevant.
- If a caster is out of slots, they cannot cast leveled spells — acknowledge this in the narrative.

PARTY RULES
- Keep the party together unless the story specifically separates them (locked room, ambush split, etc.).
- Trading items and casting beneficial spells requires proximity: touch spells need contact, most spells need the target within 60 ft.
- If party members are separated, narrate the distance and enforce range restrictions naturally.

MULTI-PLAYER TURNS
- When multiple consecutive player messages appear, they are simultaneous party actions from the same round — resolve ALL of them in your single response before the next round begins.
- Address each character's action outcome. Do not skip anyone.
- When a roll is needed, name the exact character: "[Name], roll a [type] check, DC [X]."

MECHANICS (woven into the narrative, not announced)
- Fold skill checks into the scene: "The lock is old and sloppy — but it'll take some work. Roll your thieves' tools against DC 13."
- Award gold and items explicitly so players can update their sheet, but thread it into the moment.

PACING
2–4 paragraphs. Match energy to context: spare and clipped during a chase; slow and atmospheric in a cursed library. Always end on something the player can react to — a choice, a threat, a question hanging in the air.

${DM_LOOT_GUIDE}`;

function partyScaleHint(partySize: number, avgLevel: number): string {
  // Rough XP budget per player per encounter (medium-hard difficulty)
  const xpPerPlayer = avgLevel <= 2 ? 50 : avgLevel <= 4 ? 150 : avgLevel <= 6 ? 375 : avgLevel <= 8 ? 750 : 1100;
  const totalBudget  = xpPerPlayer * partySize;

  let scaleNote: string;
  if (partySize >= 8) {
    scaleNote = `a large warband — enemies should outnumber or overpower them. Use 12–20 foes, or a multi-wave assault, or 1–2 CR ${Math.max(3, avgLevel - 1)}+ threats flanked by minions. Never pit this many adventurers against 2–3 weak enemies.`;
  } else if (partySize >= 5) {
    scaleNote = `a strong party — use 6–12 foes at appropriate CR, or a powerful leader (CR ${avgLevel}) with 4–6 minions.`;
  } else if (partySize >= 3) {
    scaleNote = `a standard party — 3–6 foes at CR ${Math.max(1, avgLevel - 2)}–${avgLevel} makes a solid encounter.`;
  } else {
    scaleNote = `a small party — 1–3 foes near their level, or one meaningful solo threat.`;
  }

  return `ENCOUNTER SCALING (${partySize} adventurers, avg level ${avgLevel})
This is ${scaleNote}
Total XP budget for a medium-hard encounter: ~${totalBudget} XP.
Scale up enemy AC, HP, damage, and numbers proportional to party size. Use environmental hazards and varied enemy roles (archer + melee + caster) to challenge all party members.
XP from defeated enemies splits evenly among all surviving party members.`;
}

function buildSystemPrompt(char: Character | null, party?: Character[]): string {
  const isMulti = party && party.length > 1;

  // ── Multi-player mode: show full party ──────────────────────────────────────
  if (isMulti) {
    const avgLevel  = Math.round(party.reduce((s, c) => s + c.level, 0) / party.length);
    const partySize = party.length;

    const partyBlock = party.map(c => {
      const inv     = c.inventory ?? { gold: 0, weapons: [], items: [] };
      const weapons = inv.weapons?.join(", ") || "none";
      const ac      = c.ac ?? "?";
      const pb      = profBonus(c.level);
      const statuses = c.status_effects?.length ? ` [${c.status_effects.join(", ")}]` : "";
      const itemFx  = c.active_item_effects?.length ? `\n    Item effects: ${c.active_item_effects.join("; ")}` : "";
      return `${c.name} — Level ${c.level} ${c.race} ${c.class} (Prof ${pb})
  HP ${c.hp}/${c.max_hp} | AC ${ac}${statuses}
  STR ${c.strength}(${mod(c.strength)}) DEX ${c.dexterity}(${mod(c.dexterity)}) CON ${c.constitution}(${mod(c.constitution)}) INT ${c.intelligence}(${mod(c.intelligence)}) WIS ${c.wisdom}(${mod(c.wisdom)}) CHA ${c.charisma}(${mod(c.charisma)})
  Weapons: ${weapons}${itemFx}`;
    }).join("\n\n");

    return `${VOICE_AND_RULES}

PARTY (${partySize} adventurers)
${partyBlock}

${partyScaleHint(partySize, avgLevel)}`;
  }

  // ── Solo mode: show single character ────────────────────────────────────────
  if (!char) return VOICE_AND_RULES;

  const inv      = char.inventory ?? { gold: 0, weapons: [], items: [] };
  const weapons  = inv.weapons?.join(", ") || "none";
  const items    = inv.items?.join(", ")   || "none";
  const ac       = char.ac ?? "unknown";
  const pb       = profBonus(char.level);
  const statuses = char.status_effects?.length ? char.status_effects.join(", ") : "None";

  let spellInfo = "";
  if (char.cantrips_known?.length || char.spells_prepared?.length) {
    const cantrips  = char.cantrips_known?.join(", ") || "none";
    const prepared  = char.spells_prepared?.join(", ") || "none";
    const used      = char.spell_slots_used ?? {};
    const slotLines = Object.entries(used).filter(([, u]) => u > 0)
      .map(([lvl, u]) => `${u}x level-${lvl} used`).join(", ") || "none used";
    spellInfo = `\nCantrips: ${cantrips}\nPrepared spells: ${prepared}\nSlots used this session: ${slotLines}`;
  }

  const itemFx = char.active_item_effects?.length
    ? `\nMagic item effects: ${char.active_item_effects.join("; ")}`
    : "";

  return `${VOICE_AND_RULES}

ACTIVE CHARACTER
${char.name} — Level ${char.level} ${char.race} ${char.class} (Proficiency ${pb})
HP ${char.hp}/${char.max_hp} | AC ${ac} | Gold ${inv.gold}gp
STR ${char.strength} (${mod(char.strength)}) · DEX ${char.dexterity} (${mod(char.dexterity)}) · CON ${char.constitution} (${mod(char.constitution)}) · INT ${char.intelligence} (${mod(char.intelligence)}) · WIS ${char.wisdom} (${mod(char.wisdom)}) · CHA ${char.charisma} (${mod(char.charisma)})
Weapons: ${weapons}
Items: ${items}${char.background ? `\nBackground: ${char.background}` : ""}
Status: ${statuses}${spellInfo}${itemFx}

Reference these stats for all checks and combat. Roll attacks against the character's AC (${ac}). Enforce spell slot limits. Stats shown are effective values including magic item bonuses.`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, character, party } = (await req.json()) as {
      messages: FrontendMessage[];
      character: Character | null;
      party?: Character[];
    };

    const claudeMessages: { role: "user" | "assistant"; content: string }[] =
      messages
        .filter((m) => m.role === "player" || m.role === "dm")
        .map((m) => ({
          role: m.role === "player" ? "user" : "assistant",
          content: m.content,
        }));

    if (claudeMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), { status: 400 });
    }

    if (claudeMessages[claudeMessages.length - 1].role !== "user") {
      claudeMessages.push({ role: "user", content: "Continue the story." });
    }

    const stream = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1200,
      system:     buildSystemPrompt(character, party),
      messages:   claudeMessages,
      stream:     true,
    });

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    void (async () => {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            await writer.write(encoder.encode(event.delta.text));
          }
        }
      } finally {
        try { await writer.close(); } catch { /* already closed */ }
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type":    "text/plain; charset=utf-8",
        "Cache-Control":   "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const e = err as Error;
    console.error("[api/chat] error:", e?.message, "stack:", e?.stack?.slice(0, 300));
    return new Response(
      JSON.stringify({ error: "The DM is temporarily unavailable." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
