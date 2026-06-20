import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type CampaignEnemy = {
  id:             string;
  campaign_id:    string;
  name:           string;
  enemy_type:     string;
  cr:             number;
  max_hp:         number;
  ac:             number;
  attack_bonus:   number;
  damage_dice:    string;
  abilities:      string[];
  xp_value:       number;
  loot:           { gold?: number; items?: string[]; weapons?: string[] };
  portrait_emoji: string;
  status_effects: string[];
  condition:      "healthy" | "wounded" | "bloodied" | "critical" | "defeated";
  is_defeated:    boolean;
};

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, party, context } = (await req.json()) as {
      campaign_id: string;
      party: { name: string; race: string; class: string; level: number }[];
      context: string;
    };

    const avgLevel  = Math.round(party.reduce((s, c) => s + c.level, 0) / party.length);
    const partySize = party.length;
    const partyDesc = party.map(c => `${c.name} the Lvl ${c.level} ${c.race} ${c.class}`).join(", ");
    // Encounter size scales with the party (which ranges 1–10). Keep a real floor so
    // a big party never faces a lone foe, and a ceiling of 10 so it stays balanced
    // and the scene's enemy cards still fit on screen.
    const maxEnemies = Math.min(10, Math.max(2, Math.ceil(partySize * 1.5)));
    const minEnemies = Math.min(maxEnemies, Math.max(1, Math.round(partySize * 0.75)));
    const crMin = Math.max(0.125, avgLevel - 2);
    const crMax = avgLevel + 1;

    // XP reference by CR for the prompt
    const xpRef = "CR 1/8=25, 1/4=50, 1/2=100, 1=200, 2=450, 3=700, 4=1100, 5=1800, 6=2300, 7=2900, 8=3900";

    const prompt = `You are a D&D 5e encounter designer. Generate an enemy group for this combat.

Party (${partySize} adventurers, avg level ${avgLevel}): ${partyDesc}
Combat context: ${context.slice(0, 500)}

Generate ${minEnemies}–${maxEnemies} enemies — SCALE THE COUNT to a party of ${partySize}. A solo or duo party should face few foes; a large party of 6–10 should face a sizable group (or a boss with minions) so the fight feels earned. Requirements:
- CR range: ${crMin}–${crMax}
- For parties of 5+: use a boss (higher CR) flanked by minions, or more enemies of moderate CR
- XP must match D&D 5e values: ${xpRef}
- Total loot gold across all enemies: ${avgLevel * 5}–${avgLevel * 30}gp (split naturally per enemy)
- Include weapons/items only when they fit the enemy's nature
- Number identical enemy types (e.g. "Goblin Scout #1", "Goblin Scout #2")
- portrait_emoji: one emoji that visually represents the creature

Return ONLY a valid JSON array, no markdown, no explanation:
[{
  "name": "Orc Warchief",
  "enemy_type": "Humanoid (orc)",
  "cr": 2,
  "max_hp": 42,
  "ac": 16,
  "attack_bonus": 5,
  "damage_dice": "2d8+3",
  "abilities": ["Aggressive"],
  "xp_value": 450,
  "loot": { "gold": 30, "items": ["Potion of Healing"], "weapons": ["Greataxe"] },
  "portrait_emoji": "👹"
}]`;

    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 900,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw   = res.content[0].type === "text" ? res.content[0].text : "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array in response");

    const parsed = JSON.parse(match[0]) as Partial<CampaignEnemy & { loot: object }>[];
    const rows = parsed.map(e => ({
      campaign_id,
      name:           String(e.name          ?? "Unknown Enemy"),
      enemy_type:     String(e.enemy_type     ?? "Humanoid"),
      cr:             Number(e.cr             ?? 1),
      max_hp:         Math.max(1, Number(e.max_hp        ?? 10)),
      ac:             Math.max(8, Number(e.ac             ?? 12)),
      attack_bonus:   Number(e.attack_bonus   ?? 2),
      damage_dice:    String(e.damage_dice    ?? "1d6"),
      abilities:      Array.isArray(e.abilities) ? e.abilities : [],
      xp_value:       Math.max(0, Number(e.xp_value      ?? 50)),
      loot:           (e.loot && typeof e.loot === "object") ? e.loot : {},
      portrait_emoji: String(e.portrait_emoji ?? "👹"),
      status_effects: [] as string[],
      condition:      "healthy" as const,
      is_defeated:    false,
    }));

    const { data, error } = await supabase
      .from("campaign_enemies")
      .insert(rows)
      .select();

    if (error) throw error;
    return Response.json({ enemies: data ?? [] });
  } catch (err) {
    console.error("[enemies/generate]", err);
    return Response.json({ enemies: [] }, { status: 500 });
  }
}
