import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

export type StateChange = {
  target_name:           string | null;
  hp_delta:              number;
  gold_delta:            number;
  items_gained:          string[];
  items_lost:            string[];
  weapons_gained:        string[];
  xp_award:              number;
  status_effects_gained: string[];
  status_effects_lost:   string[];
  spell_slots_used:      number;
  spell_slot_level:      number;
};

const ZERO_CHANGE: StateChange = {
  target_name: null,
  hp_delta: 0, gold_delta: 0,
  items_gained: [], items_lost: [], weapons_gained: [],
  xp_award: 0, status_effects_gained: [], status_effects_lost: [],
  spell_slots_used: 0, spell_slot_level: 0,
};

const SYSTEM = `You are a D&D 5e game state extractor. Given a Dungeon Master's narrative, extract character stat changes, XP awards, status effects, and spell slot usage.

Return ONLY valid JSON matching this exact schema. Use 0 or [] when nothing changed:
{
  "target_name":           string | null, // exact name of the specific character who received damage/healing/items; null if unclear or if XP/gold applies to the whole party.
  "hp_delta":              number,    // negative = damage, positive = healing. 0 if no HP change.
  "gold_delta":            number,    // net gold change. 0 if none.
  "items_gained":          string[],  // consumables/trinkets added. [] if none.
  "items_lost":            string[],  // items spent or destroyed. [] if none.
  "weapons_gained":        string[],  // weapons or armor obtained. [] if none.
  "xp_award":              number,    // XP earned — ALWAYS infer from the outcome described (see XP rules below). Never 0 unless nothing happened.
  "status_effects_gained": string[],  // conditions gained: "Unconscious","Poisoned","Prone","Blinded","Frightened","Paralyzed","Stunned","Charmed","Restrained","Exhausted","Petrified"
  "status_effects_lost":   string[],  // conditions that ended this turn. [] if none.
  "spell_slots_used":      number,    // number of leveled spell slots consumed (not cantrips). 0 if none.
  "spell_slot_level":      number     // level of the slot consumed (1–9). Match the spell's minimum level or the upcast level if stated. 0 if no spell cast.
}

HP TAG PRIORITY: If the narrative contains [HP:FirstName:N] tags, use them for hp_delta — they are authoritative. [HP:Aria:-9] → target_name="Aria", hp_delta=-9. [HP:Thorin:+5] → target_name="Thorin", hp_delta=5.

HP / LOOT / STATUS RULES (strict — only what DM explicitly states):
- HP/loot only count when the DM narrates the resolved result.
- CRITICAL — DAMAGE DIRECTION: hp_delta only applies when a player character RECEIVES damage or healing. Players frequently DEAL damage to enemies — this does NOT affect the player's hp_delta.
  PLAYER TAKES DAMAGE — set hp_delta NEGATIVE, set target_name to the named player (or null if only "you"):
    "Aria takes 9 slashing" → target_name="Aria", hp_delta=-9
    "you suffer 12 fire damage" → target_name=null, hp_delta=-12
    "the orc hits you for 8" → target_name=null, hp_delta=-8
    "Thorin is struck for 6" → target_name="Thorin", hp_delta=-6
    "the goblin's claws rake Thorin for 7" → target_name="Thorin", hp_delta=-7
    "the skeleton's blade catches Aria across the arm, dealing 5 damage" → target_name="Aria", hp_delta=-5
  PLAYER DEALS DAMAGE — hp_delta = 0, enemy receives it:
    "Aria deals 9 to the orc", "the spell hits for 12", "Thorin strikes the goblin for 6"
    "Aria's blade bites for 9 slashing", "9 damage to the skeleton", "hits the guard for 7"
  KEY TEST: Who is the RECIPIENT of the hit? If a named player or "you", hp_delta. If an enemy/monster, hp_delta = 0.
  ENEMY ATTACK PATTERN: "The [enemy] hits/strikes/attacks [player name] for X" → target_name=[player name], hp_delta=-X.
  When a player attacks or casts a spell and the DM describes the hit damage, hp_delta = 0. The enemy absorbs it.
- CRITICAL — hp_delta rules: Set hp_delta when ALL of the following are true:
  1. A player character — either named OR addressed as "you" / "your character" — explicitly RECEIVES (takes, suffers, loses) damage or healing. Not deals, strikes, or hits an enemy.
  2. The DM states the exact numeric amount (e.g. "takes 7 damage", "heals 4 HP").
  3. If the DM named the character, set target_name to that exact name. If the DM used "you" (no name given), set target_name to null but STILL set hp_delta to the stated amount.
  If the amount is not stated as a number, set hp_delta to 0.
  Enemy attacks that miss, flavor descriptions of violence, or narration about monsters do NOT count.
- A creature falling to 0 HP = Unconscious (if not dead).
- Status effects: only add when DM explicitly applies the condition to a player character; always set target_name.
- Spell slots: count whenever a character casts, invokes, channels, unleashes, or uses ANY named leveled spell (not cantrips). This includes paraphrased descriptions — "channels healing energy", "weaves a protective barrier", "calls forth divine light", "unleashes arcane force" are all leveled spell uses. ALWAYS set target_name to the exact CASTER's first name (the one casting), NOT the recipient of healing or buffing. Set spell_slot_level to the spell's minimum level (e.g. Fireball=3, Cure Wounds=1, Misty Step=2, Bless=1, Hold Person=2) or the upcast level if explicitly stated (e.g. "using a 3rd-level slot"). Never leave spell_slot_level at 0 when spell_slots_used > 0. CRITICAL: target_name must be the CASTER, not the person being healed or buffed.
- HP with "you": when the DM uses "you" / "your character" with no name, set target_name to null — but ONLY do this when a single character is clearly the recipient. For party-wide effects ("each of you") set target_name to null.
- CRITICAL — items/weapons/gold rules: ALWAYS set target_name when awarding items, weapons, or gold to a specific character. If the DM says "Thorin finds a Potion of Healing", set target_name to "Thorin". If it is truly unclear who receives an item (e.g. "the chest contains a sword" with no recipient named), output 0/[] for that item — do NOT set target_name to null with items populated.
- Currency: only set gold_delta when a character explicitly receives/loses gold and you set target_name; estimate value from "pouch of coins", "purse of gold", etc.
- Use the exact item name the DM stated.

XP RULES (infer generously — players must always feel progression):
- ALWAYS award XP when any of the following are described — you do NOT need the DM to say "you earn X XP":
  • Successful attack or spell hit in combat → 10–25 XP
  • Enemy defeated / falls / dies → 50–300 XP based on how powerful they seemed (CR 1/4–1: 50, CR 2–4: 100, CR 5–8: 200, CR 9+: 300+)
  • Clever skill check success (persuasion, stealth, investigation, acrobatics, etc.) → 15–35 XP
  • Trap survived, lock picked, puzzle solved, clue found → 20–50 XP
  • Significant story beat (major revelation, quest objective completed, boss defeated) → 100–200 XP
  • Any round of active combat, even if no kill → at minimum 10 XP for participating
- Award 0 ONLY when the narrative is pure scene-setting, DM monologue, failed action, or the player did nothing.
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
      target_name:           typeof parsed.target_name === "string" ? parsed.target_name : null,
      hp_delta:              Number(parsed.hp_delta      ?? 0),
      gold_delta:            Number(parsed.gold_delta    ?? 0),
      items_gained:          Array.isArray(parsed.items_gained)          ? parsed.items_gained          : [],
      items_lost:            Array.isArray(parsed.items_lost)            ? parsed.items_lost            : [],
      weapons_gained:        Array.isArray(parsed.weapons_gained)        ? parsed.weapons_gained        : [],
      xp_award:              Math.max(0, Number(parsed.xp_award         ?? 0)),
      status_effects_gained: Array.isArray(parsed.status_effects_gained) ? parsed.status_effects_gained : [],
      status_effects_lost:   Array.isArray(parsed.status_effects_lost)   ? parsed.status_effects_lost   : [],
      spell_slots_used:      Math.max(0, Number(parsed.spell_slots_used ?? 0)),
      spell_slot_level:      Math.max(0, Number((parsed as { spell_slot_level?: number }).spell_slot_level ?? 0)),
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
