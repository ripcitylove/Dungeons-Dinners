import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

export type StateChange = {
  hp_delta:              number;
  gold_delta:            number;
  items_gained:          string[];
  items_lost:            string[];
  weapons_gained:        string[];
  xp_award:              number;
  status_effects_gained: string[];
  status_effects_lost:   string[];
  spell_slots_used:      number;
};

const ZERO_CHANGE: StateChange = {
  hp_delta: 0, gold_delta: 0,
  items_gained: [], items_lost: [], weapons_gained: [],
  xp_award: 0, status_effects_gained: [], status_effects_lost: [], spell_slots_used: 0,
};

const SYSTEM = `You are a D&D 5e game state extractor. Given a Dungeon Master's narrative, extract character stat changes, XP awards, status effects, and spell slot usage.

Return ONLY valid JSON matching this exact schema. Use 0 or [] when nothing changed:
{
  "hp_delta":              number,    // negative = damage, positive = healing. 0 if no HP change.
  "gold_delta":            number,    // net gold change. 0 if none.
  "items_gained":          string[],  // consumables/trinkets added. [] if none.
  "items_lost":            string[],  // items spent or destroyed. [] if none.
  "weapons_gained":        string[],  // weapons or armor obtained. [] if none.
  "xp_award":              number,    // XP earned. 0=nothing, 15=minor, 30=notable, 75=small combat, 150=sig combat, 300=major, 500+=boss
  "status_effects_gained": string[],  // conditions gained: "Unconscious","Poisoned","Prone","Blinded","Frightened","Paralyzed","Stunned","Charmed","Restrained","Exhausted","Petrified"
  "status_effects_lost":   string[],  // conditions that ended this turn. [] if none.
  "spell_slots_used":      number     // number of leveled spell slots consumed (not cantrips). 0 if none.
}

Rules:
- Only extract changes the DM explicitly states — never infer.
- HP/loot only count when the DM narrates the resolved result.
- A creature falling to 0 HP = Unconscious (if not dead).
- Status effects: only add when DM explicitly applies the condition.
- Spell slots: only count when a leveled spell is explicitly cast.
- Currency: "a pouch of coins", "a purse of gold", "handful of silver" — estimate the gold value and include in gold_delta. NPC gifts of coins count as positive gold_delta.
- Items received from NPCs as rewards, gifts, or trades count the same as found loot — include in items_gained or weapons_gained.
- Use the exact item name the DM stated (e.g. "Potion of Healing", "Longsword +1", "Ring of Protection").
- No markdown, no explanation — output JSON only.`;

export async function POST(req: NextRequest) {
  try {
    const { narrative } = (await req.json()) as { narrative: string };
    if (!narrative?.trim()) return Response.json(ZERO_CHANGE);

    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:     SYSTEM,
      messages:   [{ role: "user", content: narrative }],
    });

    const raw   = response.content[0].type === "text" ? response.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json(ZERO_CHANGE);

    const parsed = JSON.parse(match[0]) as Partial<StateChange>;
    const change: StateChange = {
      hp_delta:              Number(parsed.hp_delta      ?? 0),
      gold_delta:            Number(parsed.gold_delta    ?? 0),
      items_gained:          Array.isArray(parsed.items_gained)          ? parsed.items_gained          : [],
      items_lost:            Array.isArray(parsed.items_lost)            ? parsed.items_lost            : [],
      weapons_gained:        Array.isArray(parsed.weapons_gained)        ? parsed.weapons_gained        : [],
      xp_award:              Math.max(0, Number(parsed.xp_award         ?? 0)),
      status_effects_gained: Array.isArray(parsed.status_effects_gained) ? parsed.status_effects_gained : [],
      status_effects_lost:   Array.isArray(parsed.status_effects_lost)   ? parsed.status_effects_lost   : [],
      spell_slots_used:      Math.max(0, Number(parsed.spell_slots_used ?? 0)),
    };

    const hasChange =
      change.hp_delta !== 0 || change.gold_delta !== 0 ||
      change.items_gained.length > 0 || change.items_lost.length > 0 ||
      change.weapons_gained.length > 0 || change.xp_award > 0 ||
      change.status_effects_gained.length > 0 || change.status_effects_lost.length > 0 ||
      change.spell_slots_used > 0;

    return Response.json(hasChange ? change : ZERO_CHANGE);
  } catch (err) {
    console.error("[chat-state]", err);
    return Response.json(ZERO_CHANGE);
  }
}
