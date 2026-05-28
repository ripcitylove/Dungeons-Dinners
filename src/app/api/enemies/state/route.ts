import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type EnemyCondition = "healthy" | "wounded" | "bloodied" | "critical" | "defeated";

export type EnemyStateChange = {
  name:                  string;
  condition:             EnemyCondition;
  is_defeated:           boolean;
  status_effects_gained: string[];
  status_effects_lost:   string[];
};

export type EnemyStateResult = {
  changes:      EnemyStateChange[];
  combat_ended: boolean;
};

const SYSTEM = `You extract enemy state changes from a D&D 5e Dungeon Master's narrative.

Given a list of active enemy names and the DM narrative, return valid JSON only:
{
  "changes": [
    {
      "name": "exact enemy name from the provided list",
      "condition": "healthy",
      "is_defeated": false,
      "status_effects_gained": [],
      "status_effects_lost": []
    }
  ],
  "combat_ended": false
}

Condition values — pick the most accurate based on the narrative:
- "healthy"  — no injury described, or enemy is not mentioned this turn
- "wounded"  — minor hit, slight stumble, glancing blow
- "bloodied" — clearly hurt, bleeding, staggering, notably damaged
- "critical"  — barely standing, gravely wounded, on one knee, near death
- "defeated"  — falls, dies, flees permanently, rendered incapacitated

Rules:
- Only include enemies explicitly named or clearly referenced in THIS narrative
- Set is_defeated: true when the enemy definitively falls, dies, surrenders, or is stopped
- combat_ended: true only when the fight has clearly concluded (all enemies defeated, fled, or peace restored)
- Do not include enemies that are not mentioned — omit them from changes entirely
- Return valid JSON only. No markdown, no explanation.`;

export async function POST(req: NextRequest) {
  try {
    const { narrative, enemies } = (await req.json()) as {
      narrative: string;
      enemies:   { id: string; name: string }[];
    };

    if (!narrative?.trim() || !enemies.length) {
      return Response.json({ changes: [], combat_ended: false });
    }

    const prompt = `Active enemies: ${enemies.map(e => e.name).join(", ")}

DM narrative:
${narrative.slice(0, 1200)}`;

    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:     SYSTEM,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw   = res.content[0].type === "text" ? res.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ changes: [], combat_ended: false });

    const parsed = JSON.parse(match[0]) as Partial<EnemyStateResult>;
    const changes: EnemyStateChange[] = Array.isArray(parsed.changes) ? parsed.changes : [];

    // Persist condition + defeat changes to DB
    await Promise.all(
      changes.map(async c => {
        const enemy = enemies.find(e => e.name === c.name);
        if (!enemy) return;
        await supabase.from("campaign_enemies").update({
          condition:      c.condition  ?? "healthy",
          is_defeated:    Boolean(c.is_defeated),
          status_effects: c.status_effects_gained ?? [],
        }).eq("id", enemy.id);
      })
    );

    return Response.json({
      changes,
      combat_ended: Boolean(parsed.combat_ended),
    });
  } catch (err) {
    console.error("[enemies/state]", err);
    return Response.json({ changes: [], combat_ended: false });
  }
}
