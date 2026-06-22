import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

export type StateChange = {
  target_name:           string | null;
  hp_delta:              number;
  temp_hp_grant:         number;
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
  hp_delta: 0, temp_hp_grant: 0, gold_delta: 0,
  items_gained: [], items_lost: [], weapons_gained: [],
  xp_award: 0, status_effects_gained: [], status_effects_lost: [],
  spell_slots_used: 0, spell_slot_level: 0,
};

const SYSTEM = `You are a D&D 5e game state extractor. Given a Dungeon Master's narrative, extract character stat changes, XP awards, status effects, and spell slot usage.

Return ONLY valid JSON matching this exact schema. Use 0 or [] when nothing changed:
{
  "target_name":           string | null, // exact name of the specific character who received damage/healing/items; null if unclear or if XP/gold applies to the whole party.
  "hp_delta":              number,    // negative = damage, positive = real healing. 0 if no HP change. Do NOT use for temp HP — use temp_hp_grant instead.
  "temp_hp_grant":         number,    // temporary hit points granted (a separate buffer, NOT real healing). False Life = 1d4+4 (typically 5–8). Heroism = CHA modifier. Aid bonus HP = 5/10/15. Any "gains X temporary hit points" → extract the number. Always positive. 0 if no temp HP granted. Set target_name to the recipient.
  "gold_delta":            number,    // net gold change. 0 if none.
  "items_gained":          string[],  // EVERYTHING that isn't a weapon or armor: consumables, trinkets, rings, amulets, cloaks, boots, rods, wands, scrolls, potions, ammunition, containers, lore tokens, plot items, jewelry, gems. Wearable accessories (rings, necklaces, cloaks, gloves) go here, NOT in weapons_gained. [] if none.
  "items_lost":            string[],  // items spent or destroyed. [] if none.
  "weapons_gained":        string[],  // ONLY swords, axes, bows, crossbows, daggers, maces, hammers, staves used as weapons, AND body armor / shields. Wearable accessories like rings, amulets, cloaks, boots, gloves are NEVER weapons — they go in items_gained. [] if none.
  "xp_award":              number,    // XP earned — ALWAYS infer from the outcome described (see XP rules below). Never 0 unless nothing happened.
  "status_effects_gained": string[],  // effects gained — use canonical names with optional duration in parens. Format: "Name" or "Name (duration)". Apply EVERY buff/debuff/condition that lands on a PC, including minor ones like Guidance. Conditions: Unconscious, Dead, Poisoned, Blinded, Frightened, Paralyzed, Stunned, Prone, Charmed, Exhausted, Restrained, Petrified, Deafened, Grappled, Invisible, Incapacitated, Burning. Buffs: Blessed, Hasted, Raging, Inspired, Shielded, Concentrating, Flying, Regenerating, Wild Shaped, Bardic Inspiration, Death Ward, Sanctuary, Guidance, Shillelagh, Resistance, Aided, Heroism, Shield of Faith, Protected, Barkskin, Longstrider, Enlarged. Debuffs: Cursed, Hexed, Marked, Silenced, Weakened, Hunter's Mark, Baned, Slowed, Reduced. Diseases: Diseased, Infected, Fevered, Sewer Plague. Enchantments: Attuned, Empowered, Enchanted, Mage Armor, Mirror Image. Use the effect form not the spell name: Bless→Blessed, Bane→Baned, Haste→Hasted, Aid→Aided, Enlarge→Enlarged.
  "status_effects_lost":   string[],  // effects that ended this turn — use same canonical names as gained. [] if none.
  "spell_slots_used":      number,    // number of leveled spell slots consumed (not cantrips). 0 if none.
  "spell_slot_level":      number     // level of the slot consumed (1–9). Match the spell's minimum level or the upcast level if stated. 0 if no spell cast.
}

HP TAG PRIORITY (with damage-direction sanity check):
- An [HP:FirstName:N] tag is normally authoritative. [HP:Aria:-9] → target_name="Aria", hp_delta=-9. [HP:Thorin:+5] → target_name="Thorin", hp_delta=5.
- BUT the DM occasionally mis-tags damage the player DEALT to an enemy as if the player took it. Before trusting an HP tag, verify the narrative actually shows the named character LOSING (or for positive deltas, GAINING) HP. Apply the same DAMAGE DIRECTION rules below.
- If the narrative clearly shows the named character as the ATTACKER (e.g. "Aria's blade bites — 9 slashing.") and there is no co-occurring "X takes / suffers / hits Aria" pattern, treat the tag as a model error: set hp_delta=0 and target_name=null. The tag is more useful as a hint than as an authority.

THP TAG PRIORITY: If the narrative contains [THP:FirstName:+N] tags, use them for temp_hp_grant — they are authoritative. [THP:Mira:+7] → target_name="Mira", temp_hp_grant=7. Always treat these as exact integers (never round).

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
- TEMP HP: Set temp_hp_grant (not hp_delta) whenever the DM narrates temporary hit points — "gains X temporary HP", "False Life grants...", "Heroism shields you with...", etc. Temp HP and real healing are mutually exclusive in the same event; do not set both for the same effect.
- Status effects: only add when DM explicitly applies an effect to a player character; always set target_name to the affected character. Include duration in parens when the DM states it, e.g. "Poisoned (1 minute)". For status_effects_lost, match the base name exactly as it was gained (e.g. "Poisoned", not "the poison").
- CONCENTRATING: only add "Concentrating" when a CONCENTRATION spell is cast (e.g. Bless, Hold Person, Hunter's Mark, Faerie Fire, Hex, Web, Haste, Spirit Guardians). NEVER add "Concentrating" for instantaneous spells or cantrips that don't concentrate (e.g. Magic Missile, Fire Bolt, Cure Wounds, Healing Word, Fireball, Sacred Flame, Eldritch Blast, Shield, Misty Step) — those do NOT create a concentration effect. When unsure whether a spell concentrates, do NOT add Concentrating. (The engine also classifies concentration deterministically from the cast, so only add this when the DM's prose clearly describes maintaining concentration.)
- Spell slots: count whenever a character casts, invokes, channels, unleashes, or uses ANY named leveled spell (not cantrips). This includes paraphrased descriptions — "channels healing energy", "weaves a protective barrier", "calls forth divine light", "unleashes arcane force" are all leveled spell uses. ALWAYS set target_name to the exact CASTER's first name (the one casting), NOT the recipient of healing or buffing. Set spell_slot_level to the spell's minimum level (e.g. Fireball=3, Cure Wounds=1, Misty Step=2, Bless=1, Hold Person=2) or the upcast level if explicitly stated (e.g. "using a 3rd-level slot"). Never leave spell_slot_level at 0 when spell_slots_used > 0. CRITICAL: target_name must be the CASTER, not the person being healed or buffed.
- HP with "you": when the DM uses "you" / "your character" with no name, set target_name to null — but ONLY do this when a single character is clearly the recipient. For party-wide effects ("each of you") set target_name to null.
- CRITICAL — items/weapons/gold rules: When the DM names a recipient ("Thorin finds a Potion of Healing"), set target_name to "Thorin". When the DM addresses the acting player as "you"/"your" ("You find a sword in the chest", "You pocket a small ruby"), set target_name to null AND populate items_gained / weapons_gained / gold_delta — the client routes it to the acting player. Only output empty arrays / 0 when the recipient is genuinely unclear (e.g. "the chest contains a sword" with no player addressed at all).
- ACQUISITION VERBS — Any of these verbs (or paraphrased equivalents) acquiring an item or money MUST populate items_gained / weapons_gained / gold_delta: takes, finds, scoops, scoops up, lifts, picks up, pockets, claims, grabs, gathers, collects, snatches, snags, pries free, retrieves, recovers, swipes, helps himself to, helps herself to, slips into pocket, tucks away, stows, draws (when from chest/body/etc.), comes away with, walks away with, leaves with. Don't be conservative — if the DM narrates a character physically taking possession of an item, weapon, or coin, treat it as an acquisition.
- CRITICAL — EXACT AMOUNTS ARE NEVER ROUNDED. If the DM states a specific number ("47 gold pieces", "12 silver", "3 platinum"), gold_delta MUST equal that exact integer. NEVER round to the nearest 5 or 10. 47 stays 47. 23 stays 23. 81 stays 81. Rounding stated amounts is a CRITICAL VIOLATION — players track their currency exactly and any drift breaks the game.
- Currency: set gold_delta whenever a character or "you" receives/loses gold. Convert silver/copper exactly: 10 sp = 1 gp, 100 cp = 1 gp (truncate down only if the conversion isn't whole — but the DM should always give whole-gp results). 1 ep = 0 gp (electrum is uncommon; round DOWN to nearest gp only when an exchange truly forces it). Platinum: 1 pp = 10 gp.
- For vague phrasing ("the gold", "a handful of coins") with NO stated amount, estimate a deliberately non-round value within these ranges — pick a varied amount, never a round multiple of 5 unless it just happens to be one. The variety makes the game feel real and prevents the "always 50gp" feel:
    handful / pouch:  pick from 8-37 gp  (e.g. 11, 17, 23, 28, 34 — not 10, 20, 30)
    small purse:      pick from 23-67 gp (e.g. 27, 38, 49, 58, 62)
    pile / hoard:     pick from 47-138 gp
    chest / cache:    pick from 113-287 gp
    treasury:         pick from 287-731 gp
  Use the same target_name rule as items.
- Use the exact item name the DM stated (preserve the recognizable phrase; ignore decorative trailing words like "carefully").
- GOLD LOSS (spending / theft / gifts) — gold_delta is NEGATIVE when a character pays, gives away, is robbed of, or otherwise parts with money:
    "You pay 12 gold for a night at the inn." → gold_delta=-12
    "You hand the beggar 5 gold." → gold_delta=-5
    "The cutpurse melts into the crowd with 20 of your coins." → gold_delta=-20
    "You buy the healer's kit for 25 gp." → gold_delta=-25, items_gained=["Healer's Kit"]
    "It costs you 8 gold to bribe the guard." → gold_delta=-8
- CONDITIONAL / FUTURE / APPRAISAL is NOT acquisition — do NOT award gold or items for value that has not actually changed hands this turn. Only count what the character physically takes/receives/spends NOW:
    "That ruby would fetch maybe 50 gold at market." → gold_delta=0
    "You could sell this blade for a tidy sum." → gold_delta=0
    "The chest looks like it might hold treasure." → no items_gained (nothing taken yet)
    "The merchant offers 40 gold for the pelt — do you accept?" → gold_delta=0 (offer not yet accepted)
- WORKED EXAMPLES — gold (extract the integer even when the verb is IMPLICIT or the number sits mid-sentence; a container that "yields/holds/contains N" coins that the player is looting counts as acquisition):
    "His coin purse yields 14 gold pieces." → gold_delta=14
    "You're 62 gold richer." → gold_delta=62
    "A glint of gold — 25 pieces — disappears into your pack." → gold_delta=25
    "The merchant counts out your reward: 150 gold." → gold_delta=150
    "Among the rubble: 240 copper and 30 silver all told." → gold_delta=5   (240cp=2gp + 30sp=3gp)
    "You pocket the 18 gold difference from the haggle." → gold_delta=18
    "The strongbox pops open — coins spill across the floor." → gold_delta = vague "pile/hoard" estimate (47-138), target the looting player
- WORKED EXAMPLES — loot (route by TYPE; preserve the DM's item name):
    "A Battleaxe, still sharp, leans against the wall — you take it." → weapons_gained=["Battleaxe"]
    "You take the dead guard's Chain Mail." → weapons_gained=["Chain Mail"]   (body armor / shields go with weapons)
    "You find a Cloak of Elvenkind folded at the bottom of the trunk." → items_gained=["Cloak of Elvenkind"]   (wearable accessory — NOT a weapon)
    "You slide a Ring of Protection onto your finger." → items_gained=["Ring of Protection"]
    "You tuck the bundle of three torches into your pack." → items_gained=["Torch","Torch","Torch"]
    "You snap the wand in two — its last charge spent." → items_lost=["Wand"]
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
      temp_hp_grant:         Math.max(0, Number(parsed.temp_hp_grant ?? 0)),
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
      change.hp_delta !== 0 || change.temp_hp_grant > 0 || change.gold_delta !== 0 ||
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
