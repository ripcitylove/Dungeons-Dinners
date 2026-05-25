import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type StateChange = {
  hp_delta: number;
  gold_delta: number;
  items_gained: string[];
  items_lost: string[];
  weapons_gained: string[];
};

const ZERO_CHANGE: StateChange = {
  hp_delta: 0,
  gold_delta: 0,
  items_gained: [],
  items_lost: [],
  weapons_gained: [],
};

const SYSTEM = `You are a D&D 5e game state extractor. Given a Dungeon Master's narrative, extract any character stat changes.

Return ONLY valid JSON matching this exact schema. Use 0 or [] when nothing changed:
{
  "hp_delta": number,        // negative = damage taken, positive = healing received. 0 if no HP change.
  "gold_delta": number,      // net change in gold pieces. 0 if no gold change.
  "items_gained": string[],  // consumables/trinkets added to inventory. [] if none.
  "items_lost": string[],    // items spent or destroyed. [] if none.
  "weapons_gained": string[] // weapons or armor obtained. [] if none.
}

Rules:
- Only extract changes the DM explicitly states — never infer.
- If the DM says "Roll for damage" or "roll to attack", that is NOT yet a resolved state change.
- HP changes only count when the DM narrates the result ("You take 8 slashing damage", "You regain 5 hit points").
- Loot only counts when the DM says the character found/received it (e.g., "You find 15 gold pieces", "You pick up the Potion of Healing").
- No markdown, no explanation — output JSON only.`;

export async function POST(req: NextRequest) {
  try {
    const { narrative } = (await req.json()) as { narrative: string };
    if (!narrative?.trim()) {
      return Response.json(ZERO_CHANGE);
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: SYSTEM,
      messages: [{ role: "user", content: narrative }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json(ZERO_CHANGE);

    const parsed = JSON.parse(match[0]) as Partial<StateChange>;
    const change: StateChange = {
      hp_delta: Number(parsed.hp_delta ?? 0),
      gold_delta: Number(parsed.gold_delta ?? 0),
      items_gained: Array.isArray(parsed.items_gained) ? parsed.items_gained : [],
      items_lost: Array.isArray(parsed.items_lost) ? parsed.items_lost : [],
      weapons_gained: Array.isArray(parsed.weapons_gained) ? parsed.weapons_gained : [],
    };

    // Only return non-zero changes
    const hasChange =
      change.hp_delta !== 0 ||
      change.gold_delta !== 0 ||
      change.items_gained.length > 0 ||
      change.items_lost.length > 0 ||
      change.weapons_gained.length > 0;

    return Response.json(hasChange ? change : ZERO_CHANGE);
  } catch (err) {
    console.error("[chat-state]", err);
    return Response.json(ZERO_CHANGE);
  }
}
