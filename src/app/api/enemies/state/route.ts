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

const SYSTEM = `You track enemy state changes from a D&D 5e Dungeon Master's narrative.

You are given each active enemy with its CURRENT condition, plus the DM narrative.
Return valid JSON only:
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

Condition values, from best to worst: healthy → wounded → bloodied → critical → defeated.
- "wounded"  — minor hit, slight stumble, glancing blow
- "bloodied" — clearly hurt, bleeding, staggering, notably damaged
- "critical"  — barely standing, gravely wounded, on one knee, near death
- "defeated"  — falls, dies, flees permanently, rendered incapacitated

CRITICAL — DAMAGE ONLY ACCUMULATES. An enemy's condition NEVER improves on its own:
- An enemy's HP does not regenerate between turns. Wounds do not close on their own.
- If an enemy takes MORE damage this turn, report the new WORSE condition.
- If an enemy is merely mentioned, acts, attacks, or speaks but is NOT freshly wounded this turn, return its CURRENT condition UNCHANGED — never reset it to "healthy".
- ONLY report a BETTER (healthier) condition if the narrative EXPLICITLY describes THAT enemy being healed, regenerating, mending, or magically restored. Absent an explicit heal, a healthier condition is wrong.

Rules:
- Only include enemies explicitly named or clearly referenced in THIS narrative; omit the rest.
- Set is_defeated: true when the enemy definitively falls, dies, surrenders, or is stopped.
- combat_ended: true only when the fight has clearly concluded (all enemies defeated, fled, or peace restored).
- Return valid JSON only. No markdown, no explanation.`;

export async function POST(req: NextRequest) {
  try {
    const { narrative, enemies } = (await req.json()) as {
      narrative: string;
      enemies:   { id: string; name: string; condition?: EnemyCondition }[];
    };

    if (!narrative?.trim() || !enemies.length) {
      return Response.json({ changes: [], combat_ended: false });
    }

    const prompt = `Active enemies (with current condition):
${enemies.map(e => `- ${e.name} (currently ${e.condition ?? "healthy"})`).join("\n")}

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

    // ── Monotonic clamp — enemies never auto-heal ──────────────────────────────
    // The classifier can still misfire (re-reading an unhurt mention as "healthy").
    // Deterministically forbid any IMPROVEMENT in condition unless the narrative
    // explicitly describes THAT enemy being healed/regenerating. Damage only ever
    // accumulates; a worse condition (or defeat) is always allowed.
    const RANK: Record<EnemyCondition, number> = { healthy: 0, wounded: 1, bloodied: 2, critical: 3, defeated: 4 };
    const HEAL = "heal(?:s|ed|ing)?|regenerat\\w+|mends?|knits?|restore[sd]?|recover(?:s|ed|ing)?|wounds?\\s+close|new\\s+flesh|made\\s+whole";
    for (const c of changes) {
      const prior = enemies.find(e => e.name === c.name)?.condition;
      if (!prior || c.is_defeated) continue;            // defeat is always allowed
      const newRank = RANK[c.condition] ?? 0;
      const curRank = RANK[prior] ?? 0;
      if (newRank < curRank) {
        // Improvement proposed — only honor it if THIS enemy was explicitly healed.
        const esc = c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const healed = new RegExp(`\\b${esc}\\b[^.!?]{0,90}\\b(?:${HEAL})\\b|\\b(?:${HEAL})\\b[^.!?]{0,90}\\b${esc}\\b`, "i").test(narrative);
        if (!healed) c.condition = prior;               // clamp: no auto-heal
      }
    }

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
