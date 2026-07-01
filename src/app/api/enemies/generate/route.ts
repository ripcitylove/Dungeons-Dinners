import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { maxEnemiesForParty, boardCapForParty, capToToughest } from "../../../../lib/encounterScaling";

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

// Parse the model's enemy array, TOLERATING a truncated response. A large party can
// push the JSON past max_tokens, cutting the final object mid-property — a plain
// JSON.parse then throws and the whole request 500s with an EMPTY board. Instead we
// try a clean parse, and on failure salvage every COMPLETE top-level {…} object
// (dropping only the partial tail), so combat still gets its cards.
function parseEnemyObjects(raw: string): Record<string, unknown>[] {
  const start = raw.indexOf("[");
  const body  = start >= 0 ? raw.slice(start) : raw;
  const arr   = body.match(/\[[\s\S]*\]/);
  if (arr) {
    try { const a = JSON.parse(arr[0]); if (Array.isArray(a)) return a as Record<string, unknown>[]; } catch { /* salvage below */ }
  }
  // Salvage: walk the text, collecting brace-balanced objects and parsing each alone.
  const objs: Record<string, unknown>[] = [];
  let depth = 0, objStart = -1, inStr = false, esc = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") { if (depth === 0) objStart = i; depth++; }
    else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try { objs.push(JSON.parse(body.slice(objStart, i + 1)) as Record<string, unknown>); } catch { /* skip malformed */ }
        objStart = -1;
      }
    }
  }
  return objs;
}

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, party, context, existing } = (await req.json()) as {
      campaign_id: string;
      party: { name: string; race: string; class: string; level: number }[];
      context: string;
      // When present, this is an ADDITIVE spawn mid-combat (reinforcements / a boss
      // joining a fight that's already on the board): we do NOT wipe, and we tell the
      // model which foes are already carded so it returns ONLY the genuinely NEW ones.
      existing?: string[];
    };
    const additive = Array.isArray(existing) && existing.length > 0;

    const avgLevel  = Math.round(party.reduce((s, c) => s + c.level, 0) / party.length);
    const partySize = party.length;
    const partyDesc = party.map(c => `${c.name} the Lvl ${c.level} ${c.race} ${c.class}`).join(", ");
    // Encounter size scales with the party (which ranges 1–10). Keep a real floor so
    // a big party never faces a lone foe, and a ceiling of 12 so a leader + a full
    // band of minions (the intended large-party structure) all fit as cards without
    // the prose ever describing more foes than the engine can spawn.
    const maxEnemies = maxEnemiesForParty(partySize);
    const minEnemies = Math.min(maxEnemies, Math.max(1, Math.round(partySize * 0.75)));
    // LOW-LEVEL SWARM GUARD (deterministic, applies to EVERY campaign). Regardless of
    // how many foes the DM prose describes, hard-cap the number of enemy CARDS on the
    // board to ~one-per-hero at low levels; surplus foes are simply not spawned (the
    // story can bring them back as a later wave via an additive spawn). See
    // src/lib/encounterScaling.ts for the rationale.
    const boardCap = boardCapForParty(partySize, avgLevel);
    const crMin = Math.max(0.125, avgLevel - 2);
    const crMax = avgLevel + 1;

    // XP reference by CR for the prompt
    const xpRef = "CR 1/8=25, 1/4=50, 1/2=100, 1=200, 2=450, 3=700, 4=1100, 5=1800, 6=2300, 7=2900, 8=3900";

    const alreadyBlock = additive
      ? `\nALREADY ON THE BATTLEFIELD (do NOT recreate these — they already have cards): ${existing!.join(", ")}\nReturn ONLY foes the narrative introduces that are NOT already listed above. If the narrative introduces no genuinely new foe, return an empty array [].\n`
      : "";

    const prompt = `You are a D&D 5e encounter builder. The Dungeon Master has just narrated enemies becoming present for a fight. Turn EXACTLY the foes the DM described into stat-blocked cards — be FAITHFUL to the prose, do NOT rebalance the count.

Party (${partySize} adventurers, avg level ${avgLevel}): ${partyDesc}
${alreadyBlock}
DM narrative — spawn exactly the enemies it describes:
"""
${context.slice(0, 1500)}
"""

RULES:
1. COUNT & IDENTITY COME FROM THE PROSE. Create one entry per distinct enemy the narrative actually describes as present. "Three cultists" → exactly 3 cultists. "A cult leader and two acolytes" → 1 leader + 2 acolytes. Use the same names/types the DM used. NEVER add, drop, merge, or rename enemies to rebalance — the players were told these exact foes appeared, so the cards MUST match.
2. Number identical types: "Cultist #1", "Cultist #2". Give a named leader/boss its own distinct name (e.g. "Cult Leader"). Hard cap of 12 entries — if the prose implies a horde (e.g. "a dozen rats"), represent up to 12 and stop.
3. STATS are yours to set, tuned to the party (avg level ${avgLevel}): pick a sensible CR per enemy (minions lower, a leader/boss higher), roughly within CR ${crMin}–${crMax}, and 5e-appropriate max_hp / ac / attack_bonus / damage_dice for that creature at that CR.
4. ONLY if the narrative does not clearly describe any specific enemies, fall back to inventing a fitting group of ${minEnemies}–${maxEnemies} foes for a party of ${partySize}.
5. XP must match D&D 5e by CR: ${xpRef}
6. Total loot gold across all enemies: ${avgLevel * 5}–${avgLevel * 30}gp (split naturally; only give items/weapons that fit the enemy).
7. portrait_emoji: one emoji that visually represents the creature.

Return ONLY a valid JSON array, no markdown, no explanation. Schema per enemy:
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
      // Scale the budget with the enemy ceiling — each stat-block object is ~140–220
      // tokens, so a large party (up to 12 foes) needs far more than the old flat
      // 1500, which truncated the JSON mid-array and 500'd the whole request.
      max_tokens: Math.min(4096, 700 + maxEnemies * 260),
      messages:   [{ role: "user", content: prompt }],
    });

    const raw    = res.content[0].type === "text" ? res.content[0].text : "";
    const parsed = parseEnemyObjects(raw) as Partial<CampaignEnemy & { loot: object }>[];
    // In additive mode an empty result is VALID (no genuinely new foe this turn) — just
    // return nothing rather than throwing/500ing on a normal combat turn.
    if (parsed.length === 0) {
      if (additive) return Response.json({ enemies: [] });
      throw new Error("No parseable enemies in response");
    }
    let rows = parsed.map(e => ({
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

    // A FRESH encounter wipes any leftover rows first so stragglers from a past fight
    // don't accumulate. An ADDITIVE spawn (reinforcements / a boss joining an ongoing
    // fight) must NOT wipe — it appends the new foes to the live board, and we drop any
    // the model echoed that already exist by name (case-insensitive) as a safety net.
    if (!additive) {
      await supabase.from("campaign_enemies").delete().eq("campaign_id", campaign_id);
      rows = capToToughest(rows, boardCap);              // low-level swarm guard
    } else {
      const have = new Set(existing!.map(n => n.toLowerCase()));
      for (let i = rows.length - 1; i >= 0; i--) if (have.has(rows[i].name.toLowerCase())) rows.splice(i, 1);
      // Cap across the WHOLE board: only admit as many reinforcements as fit under the
      // cap alongside foes already present, so later waves can't silently re-swarm.
      rows = capToToughest(rows, Math.max(0, boardCap - existing!.length));
      if (rows.length === 0) return Response.json({ enemies: [] });
    }

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
