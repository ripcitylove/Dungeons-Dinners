import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { dmResponse, character } = await req.json();

    const charLine = character
      ? `Player: ${character.name}, Level ${character.level} ${character.race} ${character.class}. HP ${character.hp}/${character.max_hp}.`
      : "";

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You generate D&D action suggestions. Given the DM narration below, return exactly 4 short player actions (3-8 words each). Vary them: one aggressive, one cautious/defensive, one social/clever, one exploratory.

${charLine}

DM narration: "${dmResponse}"

Respond with ONLY a JSON array of 4 strings. No explanation.`,
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    const suggestions: string[] = match ? JSON.parse(match[0]) : [];

    return Response.json({ suggestions: suggestions.slice(0, 4) });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
