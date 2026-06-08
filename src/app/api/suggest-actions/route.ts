import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic();

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
      const weapons = character.inventory?.weapons?.length
        ? `Weapons: ${character.inventory.weapons.map((w: { name: string }) => w.name).join(", ")}.`
        : "";
      const hpPct = character.max_hp > 0 ? Math.round((character.hp / character.max_hp) * 100) : 100;
      charLine = `Character: ${character.name}, Level ${character.level} ${character.race} ${character.class}. HP ${character.hp}/${character.max_hp} (${hpPct}%). ${weapons} ${cantrips} ${prepared}`.trim();
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        `You are a D&D 5e action suggestion engine. Always respond with ONLY a valid JSON array of exactly 4 short player action strings (3–8 words each). No explanation, no markdown, no extra text.

Read the DM's message first. Every suggestion must make sense for the current moment — irrelevant options are useless:
- COMBAT: suggest attacks, tactical moves, spell use, helping allies, or escape. Do not suggest peaceful dialogue or idle exploration.
- SOCIAL/ROLEPLAY: suggest questions, persuasion, investigation, roleplay, or reading the situation. Do not suggest drawing weapons unless clearly warranted.
- EXPLORATION: suggest investigating the scene, interacting with objects, using skills, or preparing for danger.
- Never suggest something the DM just narrated as already done. Be specific to this scene, not generic.
- If HP is below 40%, include at least one option focused on survival or healing.

CRITICAL SPELL RULE: Only suggest spells the character actually has. Non-spellcasters get zero spell suggestions.`,
      messages: [
        {
          role: "user",
          content: `${charLine}\n\nDM's last message:\n"${dmResponse.slice(0, 1200)}"\n\nGenerate 4 action suggestions that make sense right now.`,
        },
      ],
    });

    const raw   = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) return Response.json({ suggestions: [] });

    let suggestions: string[];
    try {
      suggestions = JSON.parse(match[0]);
    } catch {
      return Response.json({ suggestions: [] });
    }

    const clean = suggestions
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 4);

    return Response.json({ suggestions: clean });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
