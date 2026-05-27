import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

type CharSummary = { name: string; race: string; cls: string };

export async function POST(req: NextRequest) {
  try {
    const { characters } = (await req.json()) as { characters: CharSummary[] };

    const partyDesc = characters
      .map(c => `${c.name} the ${c.race} ${c.cls}`)
      .join(", ");

    const prompt = `You are a creative D&D 5e Dungeon Master. A party of adventurers is about to begin a campaign. Generate a campaign title and opening description tailored to this party.

Party: ${partyDesc}

Return ONLY valid JSON with exactly these two keys — no markdown, no explanation:
{
  "title": "A dramatic 4-7 word campaign title in title case",
  "description": "Two to three sentences that set the scene and hint at the adventure ahead. Written in second person, present tense, atmospheric and evocative."
}`;

    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 220,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw   = res.content[0].type === "text" ? res.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");

    const parsed = JSON.parse(match[0]);
    return Response.json({
      title:       String(parsed.title       ?? "Shadows of the Forgotten Realm"),
      description: String(parsed.description ?? "A perilous adventure awaits."),
    });
  } catch (err) {
    console.error("[generate-campaign]", err);
    return Response.json({
      title:       "Shadows of the Forgotten Realm",
      description: "Dark forces stir across the land. Your party of adventurers has been drawn together by fate — or perhaps something more sinister. The road ahead promises glory, danger, and secrets best left undiscovered.",
    });
  }
}
