import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type MsgRole = "player" | "dm" | "system";
type FrontendMessage = { role: MsgRole; content: string; sender?: string };
type Character = {
  name: string;
  race: string;
  class: string;
  level: number;
  hp: number;
  max_hp: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  background?: string;
  inventory: { gold: number; weapons: string[]; items: string[] };
};

function mod(score: number) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function buildSystemPrompt(char: Character | null): string {
  const voice = `You are a master Dungeon Master with the storytelling instincts of a seasoned fantasy novelist. Every word you write should pull the player deeper into the world.

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
- Never break the fourth wall or reference game mechanics in a clinical way ("Your Dexterity modifier is…").
- Don't pad responses. Every sentence should earn its place.

MECHANICS (woven into the narrative, not announced)
- Fold skill checks into the scene: "The lock is old and sloppy — but it'll take some work. Roll your thieves' tools against DC 13." Not: "Make a Dexterity (Thieves' Tools) check, DC 13."
- In combat: call for attack rolls and damage within the action. "Roll to hit — what do you get?" feels alive. A dry mechanic list does not.
- Award gold and items explicitly so players can update their sheet, but thread it into the moment.

PACING
2–4 paragraphs. Match energy to context: spare and clipped during a chase; slow and atmospheric in a cursed library. Always end on something the player can react to — a choice, a threat, a question hanging in the air.`;

  if (!char) return voice;

  const inv     = char.inventory ?? { gold: 0, weapons: [], items: [] };
  const weapons = inv.weapons?.join(", ") || "none";
  const items   = inv.items?.join(", ")   || "none";

  return `${voice}

ACTIVE CHARACTER
${char.name} — Level ${char.level} ${char.race} ${char.class}
HP ${char.hp}/${char.max_hp} | Gold ${inv.gold}gp
STR ${char.strength} (${mod(char.strength)}) · DEX ${char.dexterity} (${mod(char.dexterity)}) · CON ${char.constitution} (${mod(char.constitution)}) · INT ${char.intelligence} (${mod(char.intelligence)}) · WIS ${char.wisdom} (${mod(char.wisdom)}) · CHA ${char.charisma} (${mod(char.charisma)})
Weapons: ${weapons}
Items: ${items}${char.background ? `\nBackground: ${char.background}` : ""}

Reference these stats whenever ${char.name} attempts something uncertain. Their race and class inform how they'd naturally approach obstacles — lean into that without stating it outright.`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, character } = (await req.json()) as {
      messages: FrontendMessage[];
      character: Character | null;
    };

    // Map frontend message format → Anthropic format (skip 'system' flavor messages)
    const claudeMessages: { role: "user" | "assistant"; content: string }[] =
      messages
        .filter((m) => m.role === "player" || m.role === "dm")
        .map((m) => ({
          role: m.role === "player" ? "user" : "assistant",
          content: m.content,
        }));

    if (claudeMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
      });
    }

    // Anthropic requires the last message to be from the user
    if (claudeMessages[claudeMessages.length - 1].role !== "user") {
      claudeMessages.push({
        role: "user",
        content: "Continue the story.",
      });
    }

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 768,
      system: buildSystemPrompt(character),
      messages: claudeMessages,
    });

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    void (async () => {
      try {
        let eventCount = 0;
        let deltaCount = 0;
        for await (const event of stream) {
          eventCount++;
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            deltaCount++;
            await writer.write(encoder.encode(event.delta.text));
          }
        }
        console.log(`[chat] stream done — events: ${eventCount}, text_deltas: ${deltaCount}`);
      } catch (e) {
        console.error("[chat] stream error:", e);
      } finally {
        try { await writer.close(); } catch { /* already closed */ }
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[api/chat]", err);
    return new Response(
      JSON.stringify({ error: "The DM is temporarily unavailable." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
