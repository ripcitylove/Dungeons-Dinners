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
  const rules = `You are an expert, creative Dungeon Master running a Dungeons & Dragons 5th Edition campaign.

Core rules:
1. Stay in character as the DM at all times. Never speak as a player or break the fourth wall.
2. Write with vivid sensory detail — sight, sound, smell, texture. Make the world feel alive.
3. Enforce D&D 5e rules. When a player attempts an uncertain action, call for a specific check with a DC (e.g., "Make a Dexterity (Stealth) check — DC 14"). When they roll, use the result meaningfully.
4. Run combat cinematically: describe strikes, enemy reactions, and the ebb of battle. Track enemy HP secretly. Ask the player to roll attack rolls and damage rolls.
5. Award loot explicitly and instruct the player to update their sheet (e.g., "You find 20 gold pieces and a Potion of Healing. Add them to your inventory.").
6. Drive the story forward. Every response should present a clear situation the player can react to.
7. Keep responses to 2–4 paragraphs — immersive but not overwhelming.
8. Provide dramatic NPC dialogue in quotes. Give NPCs distinct voices.`;

  if (!char) return rules;

  const inv = char.inventory ?? { gold: 0, weapons: [], items: [] };
  const weapons = inv.weapons?.join(", ") || "none";
  const items = inv.items?.join(", ") || "none";

  return `${rules}

Active character:
• Name: ${char.name}  Race: ${char.race}  Class: ${char.class}  Level: ${char.level}
• HP: ${char.hp}/${char.max_hp}
• STR ${char.strength} (${mod(char.strength)})  DEX ${char.dexterity} (${mod(char.dexterity)})  CON ${char.constitution} (${mod(char.constitution)})  INT ${char.intelligence} (${mod(char.intelligence)})  WIS ${char.wisdom} (${mod(char.wisdom)})  CHA ${char.charisma} (${mod(char.charisma)})
• Gold: ${inv.gold}gp  |  Weapons: ${weapons}  |  Items: ${items}
${char.background ? `• Background: ${char.background}` : ""}

Use this character's stats when calling for ability checks and saving throws. A ${char.race} ${char.class} would approach problems through the lens of their class abilities and racial traits.`;
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
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system: buildSystemPrompt(character),
      messages: claudeMessages,
    });

    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(new TextEncoder().encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

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
