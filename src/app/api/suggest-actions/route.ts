import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic();

const FALLBACK: string[] = [
  "Examine your surroundings carefully",
  "Ready your weapon and advance",
  "Listen for hidden dangers",
  "Search for another way through",
];

export async function POST(req: NextRequest) {
  try {
    const { dmResponse, character } = await req.json();

    let charLine = "";
    if (character) {
      const cantrips = character.cantrips_known?.length
        ? `Cantrips: ${character.cantrips_known.join(", ")}.`
        : "No cantrips.";
      const prepared = character.spells_prepared?.length
        ? `Prepared spells: ${character.spells_prepared.join(", ")}.`
        : "No prepared spells.";
      charLine = `Active character: ${character.name}, Level ${character.level} ${character.race} ${character.class}. HP ${character.hp}/${character.max_hp}. ${cantrips} ${prepared}`;
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        'You are a D&D 5e action suggestion engine. Always respond with ONLY a valid JSON array of exactly 4 short player action strings (3–8 words each). No explanation, no markdown, no extra text. Example output: ["Attack the nearest enemy","Take cover behind the barrels","Reason with the guard captain","Search the shadows for a clue"]\n\nCRITICAL SPELL RULE: If you suggest a spell action, it MUST be a spell listed in the character\'s cantrips or prepared spells. Never suggest a spell the character does not have. Non-spellcasters get zero spell suggestions.',
      messages: [
        {
          role: "user",
          content: `${charLine}\n\nDM narration:\n"${dmResponse.slice(0, 800)}"\n\nGenerate 4 contextual action suggestions. Vary them: one aggressive, one cautious/defensive, one social or clever, one exploratory. Only reference spells the character actually has prepared or knows as cantrips.`,
        },
      ],
    });

    const raw   = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) return Response.json({ suggestions: FALLBACK });

    let suggestions: string[];
    try {
      suggestions = JSON.parse(match[0]);
    } catch {
      return Response.json({ suggestions: FALLBACK });
    }

    // Ensure we always return exactly 4 strings, padding with fallback if needed
    const clean = suggestions
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 4);

    while (clean.length < 4) clean.push(FALLBACK[clean.length]);

    return Response.json({ suggestions: clean });
  } catch {
    return Response.json({ suggestions: FALLBACK });
  }
}
