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

    const prompt = `You are a creative D&D 5e Dungeon Master. A party of adventurers is about to begin a campaign. Generate a campaign title, opening description, and an ordered list of objectives (the quest spine) tailored to this party.

Party: ${partyDesc}

Return ONLY valid JSON with exactly these keys — no markdown, no explanation:
{
  "title": "A dramatic 4-7 word campaign title in title case",
  "description": "Two to three sentences that set the scene and hint at the adventure ahead. Written in second person, present tense, atmospheric and evocative.",
  "objectives": ["5 to 6 concise objectives, each 3-8 words, written as an imperative goal (e.g. 'Reach the harbor of Saltmere', 'Uncover who summoned the party'). They MUST be ordered from the campaign's clear opening objective to its final resolution — a beginning-to-end spine the DM can pace the story along. The first objective is the party's immediate, concrete starting goal. The last resolves the central conflict."]
}`;

    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 420,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw   = res.content[0].type === "text" ? res.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");

    const parsed = JSON.parse(match[0]);
    const objectives = Array.isArray(parsed.objectives)
      ? parsed.objectives.map((o: unknown) => String(o ?? "").trim()).filter(Boolean).slice(0, 8)
      : [];
    return Response.json({
      title:       String(parsed.title       ?? "Shadows of the Forgotten Realm"),
      description: String(parsed.description ?? "A perilous adventure awaits."),
      objectives:  objectives.length ? objectives : FALLBACK_OBJECTIVES,
    });
  } catch (err) {
    console.error("[generate-campaign]", err);
    return Response.json({
      title:       "Shadows of the Forgotten Realm",
      description: "Dark forces stir across the land. Your party of adventurers has been drawn together by fate — or perhaps something more sinister. The road ahead promises glory, danger, and secrets best left undiscovered.",
      objectives:  FALLBACK_OBJECTIVES,
    });
  }
}

// Used when generation fails or returns no objectives — keeps the tracker working.
const FALLBACK_OBJECTIVES = [
  "Discover why the party was brought together",
  "Investigate the strange events nearby",
  "Find the source of the disturbance",
  "Confront the force behind it",
  "Resolve the threat and claim your reward",
];
