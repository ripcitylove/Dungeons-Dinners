import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { DM_LOOT_GUIDE } from "../../../lib/lootData";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

type MsgRole = "player" | "dm" | "system";
type FrontendMessage = { role: MsgRole; content: string; sender?: string };
type ActiveEnemy = {
  name: string; enemy_type: string; cr: number; ac: number;
  attack_bonus: number; damage_dice: string; max_hp: number;
  condition: string; abilities: string[];
  loot: { gold?: number; items?: string[]; weapons?: string[] };
  xp_value: number;
};
type Character = {
  user_id?: string;
  name: string; race: string; class: string; level: number;
  hp: number; max_hp: number; xp?: number; ac?: number;
  sex?: string;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  background?: string;
  status_effects?: string[];
  cantrips_known?: string[];
  spells_prepared?: string[];
  spell_slots_used?: Record<number, number>;
  inventory: { gold: number; weapons: string[]; items: string[] };
  active_item_effects?: string[];
};

function mod(score: number) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function profBonus(level: number): string {
  const b = level <= 4 ? 2 : level <= 8 ? 3 : level <= 12 ? 4 : 5;
  return `+${b}`;
}

const VOICE_AND_RULES = `You are a master Dungeon Master with the storytelling instincts of a seasoned fantasy novelist. Every word you write should pull the player deeper into the world.

VOICE & PROSE
- Write like an author, not a rule-reader. Short punchy sentences for action. Longer, flowing ones for atmosphere and dread.
- Lead with what hits the senses first: a smell, a sound, a temperature — not a visual catalogue.
- Vary how you open each response. Never start with "You" three times in a row. Try "The air shifts.", "Silence.", "She laughs — the wrong kind.", a snatch of NPC speech, or a fragment that sets a mood.
- NPCs speak with distinct voices: a gruff guard clips his words, a merchant over-explains, a villain is eerily calm. Use em-dashes for interruptions — ellipses when something trails off…
- In combat, make every exchange feel dangerous. Describe the impact, the enemy's reaction, the ragged breath between attacks. Keep the pace tight.
- When a moment is funny, let it be funny. When it's bleak, don't soften it.

WHAT TO AVOID
- Never write "As a [race] [class], you…" — it sounds like a tutorial.
- Don't open with "You notice…", "You see…", or "You hear…" as a repeated crutch.
- Never break the fourth wall or reference game mechanics in a clinical way.
- Don't pad responses. Every sentence should earn its place.

COMBAT (follow D&D 5e rules exactly)
- Attack rolls: roll d20 + attack bonus vs. the target's AC. Hit = apply damage; miss = describe the near miss.
- When an enemy attacks the party: roll d20 + enemy attack bonus vs. the character's AC. State the roll result and whether it hits.
- Damage: roll the damage dice and state the exact number taken (e.g., "You take 8 slashing damage").
- At 0 HP: the character falls Unconscious (death saving throws apply).
- Spell saves: call for the appropriate saving throw (e.g., "Roll a DEX save, DC 14").
- Use exact numbers — players need to track their HP.
- ALWAYS name the specific character targeted: "The orc swings at Aragorn — roll 14 hits AC 15, dealing 9 slashing damage."

SPELLS & SLOTS
- Track spell slot usage. When a leveled spell is cast, state it consumes a slot ("That uses one of your 1st-level slots").
- Cantrips cost no slots. State this naturally if relevant.
- If a caster is out of slots, they cannot cast leveled spells — acknowledge this in the narrative.

PARTY RULES
- Keep the party together unless the story specifically separates them (locked room, ambush split, etc.).
- Trading items and casting beneficial spells requires proximity: touch spells need contact, most spells need the target within 60 ft.
- If party members are separated, narrate the distance and enforce range restrictions naturally.

WORLD VARIETY & CAMPAIGN OPENINGS
- Never default to a generic tavern. Every campaign deserves a unique starting point that fits the party and the stakes.
- Draw from the full breadth of D&D 5e locales: a ship in a midnight squall; a prison transport wagon jolting along a mountain road; a burning village the party just stumbled upon; a royal court mid-assassination attempt; a plague-quarantined district; a half-submerged ruin breached by a treasure hunter moments ago; a desert caravan under gnoll attack; a dwarven forge-city on the eve of war; an elven forest where the trees have started dying; a gladiatorial arena where the party wakes in a holding cell; a thieves' guild den after a job gone wrong; a haunted lighthouse at the edge of a storm; an arcane academy whose headmaster just vanished.
- Use the party's composition as a compass: clerics and paladins belong near temples or holy sites; rangers and druids in untamed wilds; rogues and bards in urban underbellies; wizards near ruins, libraries, or arcane towers.
- When starting a new campaign, open with 2–3 paragraphs that put the party squarely in the scene — atmosphere, sensory detail, immediate tension — before acknowledging any player action.
- If a campaign title or description was provided, treat it as the authoritative world-setting. The description is the seed of the world; grow it.

MULTI-PLAYER TURNS
- Player messages are prefixed with [CharacterName]: to identify the speaker.
- When multiple consecutive [Name]: messages appear without an assistant response between them, they are simultaneous actions from the same round — resolve ALL of them together in one response before moving to the next round.
- Address each character's outcome individually. Never skip a character who submitted an action.
- When a roll is needed, address the character by their exact name as shown in their prefix: "[Name], roll a [type] check, DC [X]."
- Scale encounters to match the full party size — refer to the ENCOUNTER SCALING block below the party list for guidance.

MECHANICS (woven into the narrative, not announced)
- Fold skill checks into the scene: "The lock is old and sloppy — but it'll take some work. Roll your thieves' tools against DC 13."
- Award gold and items explicitly so players can update their sheet, but thread it into the moment.

CHARACTER SPOTLIGHT
Before crafting any scene, scan the full party sheet: spells, cantrips, inventory, race, class, background, and sex. Then design the environment so that one or two characters' specific abilities become quietly, naturally relevant — without ever announcing it.

The world should feel like it was built for this exact party:
- A character with Light or Dancing Lights → a passage where torches won't stay lit; a mine with no lanterns left
- A character with Speak with Animals → a spooked horse blocking the gate; livestock that fled into the fog
- A character with Healing Word or Cure Wounds → a wounded courier who collapses at the party's feet
- A Ranger → a blizzard erasing the trail; tracks only a trained eye can read
- A Rogue with Thieves' Tools → a locked strongbox the fleeing guard left behind; a mark in a crowd that only Stealth can tail
- A Bard → a noble who grants audience only to those who can impress them; a locked-down tavern that opens for the right song
- A Cleric or Paladin → a desecrated shrine that radiates dread; a dying villager who recognises a holy symbol
- An Elf, Half-Elf, or any race with Darkvision → a lightless cellar; a sunless catacomb; a moonless road
- A Dwarf → a suspicious wall that might be hollow; an underground passage where stonecunning matters
- A Wizard or Sorcerer → a locked tome, an arcane seal, a magical trap that needs identifying
- A character with a noble or sage background → a court gate, a family name the steward recognises, an old debt
- A character carrying rope, grappling hook, or a specific potion → a cliff face, a gap in the floor, a poisoned well
- A female character in a rigid social setting → a lord who dismisses her; a guild that refuses to deal with men; an informant who only trusts women

Never name the ability or item in the scene setup. Let the player discover the connection. Reward clever use naturally.
Rotate the spotlight — if a character was centre-stage last response, favour someone else this time.

PACING
2–4 paragraphs. Match energy to context: spare and clipped during a chase; slow and atmospheric in a cursed library. Always end on something the player can react to — a choice, a threat, a question hanging in the air.

${DM_LOOT_GUIDE}`;

function partyScaleHint(partySize: number, avgLevel: number): string {
  // Rough XP budget per player per encounter (medium-hard difficulty)
  const xpPerPlayer = avgLevel <= 2 ? 50 : avgLevel <= 4 ? 150 : avgLevel <= 6 ? 375 : avgLevel <= 8 ? 750 : 1100;
  const totalBudget  = xpPerPlayer * partySize;

  let scaleNote: string;
  if (partySize >= 8) {
    scaleNote = `a large warband — enemies should outnumber or overpower them. Use 12–20 foes, or a multi-wave assault, or 1–2 CR ${Math.max(3, avgLevel - 1)}+ threats flanked by minions. Never pit this many adventurers against 2–3 weak enemies.`;
  } else if (partySize >= 5) {
    scaleNote = `a strong party — use 6–12 foes at appropriate CR, or a powerful leader (CR ${avgLevel}) with 4–6 minions.`;
  } else if (partySize >= 3) {
    scaleNote = `a standard party — 3–6 foes at CR ${Math.max(1, avgLevel - 2)}–${avgLevel} makes a solid encounter.`;
  } else {
    scaleNote = `a small party — 1–3 foes near their level, or one meaningful solo threat.`;
  }

  return `ENCOUNTER SCALING (${partySize} adventurers, avg level ${avgLevel})
This is ${scaleNote}
Total XP budget for a medium-hard encounter: ~${totalBudget} XP.
Scale up enemy AC, HP, damage, and numbers proportional to party size. Use environmental hazards and varied enemy roles (archer + melee + caster) to challenge all party members.
XP from defeated enemies splits evenly among all surviving party members.`;
}

function buildSystemPrompt(char: Character | null, party?: Character[], campaignContext?: { title: string; description: string }, enemies?: ActiveEnemy[], openingScene?: boolean): string {
  const campaignBlock = campaignContext?.description
    ? `\nCAMPAIGN\nTitle: ${campaignContext.title}\nSetting: ${campaignContext.description}\nStay true to this setting throughout the adventure.\n`
    : "";

  const openingBlock = openingScene
    ? `\nOPENING SCENE — THIS IS YOUR FIRST MESSAGE\nDo NOT repeat the campaign description verbatim. Instead: drop the party immediately into the living world. Lead with sensory detail — sound, smell, light, immediate tension or wonder. One specific detail should make the scene feel real and urgent. Then turn to the adventurers, acknowledge who is present, and ask what they would like to do.\n`
    : "";

  const enemyBlock = enemies?.length
    ? `\nACTIVE ENEMIES IN COMBAT\n${enemies.map(e => {
        const lootLine = [
          e.loot.gold ? `${e.loot.gold}gp` : "",
          ...(e.loot.weapons ?? []),
          ...(e.loot.items   ?? []),
        ].filter(Boolean).join(", ");
        return `${e.name} — ${e.enemy_type} | CR ${e.cr} | AC ${e.ac} | ATK +${e.attack_bonus} (${e.damage_dice}) | HP: ${e.condition.toUpperCase()} | XP: ${e.xp_value}
  Abilities: ${e.abilities.join(", ") || "none"}
  Loot on defeat: ${lootLine || "none"}`;
      }).join("\n\n")}

Use enemy AC values when players attack them. Use enemy ATK bonus and damage dice when enemies attack players.
When an enemy's HP reaches 0, narrate their defeat vividly. Award their XP and loot naturally through the narrative once combat ends.\n`
    : "";
  const isMulti = party && party.length > 1;

  // ── Multi-player mode: show full party ──────────────────────────────────────
  if (isMulti) {
    const avgLevel  = Math.round(party.reduce((s, c) => s + c.level, 0) / party.length);
    const partySize = party.length;

    const partyBlock = party.map(c => {
      const inv      = c.inventory ?? { gold: 0, weapons: [], items: [] };
      const weapons  = inv.weapons?.join(", ") || "none";
      const items    = inv.items?.join(", ")   || "none";
      const ac       = c.ac ?? "?";
      const pb       = profBonus(c.level);
      const statuses = c.status_effects?.length ? ` [${c.status_effects.join(", ")}]` : "";
      const itemFx   = c.active_item_effects?.length ? `\n  Item effects: ${c.active_item_effects.join("; ")}` : "";
      const sexStr   = c.sex ? `${c.sex} ` : "";
      const bgStr    = c.background ? `\n  Background: ${c.background}` : "";
      const cantStr  = c.cantrips_known?.length  ? c.cantrips_known.join(", ")  : "";
      const spellStr = c.spells_prepared?.length ? c.spells_prepared.join(", ") : "";
      const spellLine = (cantStr || spellStr)
        ? `\n  Cantrips: ${cantStr || "—"}  |  Spells prepared: ${spellStr || "—"}`
        : "";
      return `${c.name} — Level ${c.level} ${sexStr}${c.race} ${c.class} (Prof ${pb})${bgStr}
  HP ${c.hp}/${c.max_hp} | AC ${ac}${statuses}
  STR ${c.strength}(${mod(c.strength)}) DEX ${c.dexterity}(${mod(c.dexterity)}) CON ${c.constitution}(${mod(c.constitution)}) INT ${c.intelligence}(${mod(c.intelligence)}) WIS ${c.wisdom}(${mod(c.wisdom)}) CHA ${c.charisma}(${mod(c.charisma)})
  Weapons: ${weapons}  |  Items: ${items}${spellLine}${itemFx}`;
    }).join("\n\n");

    return `${VOICE_AND_RULES}${openingBlock}
${campaignBlock}${enemyBlock}
PARTY (${partySize} adventurers)
${partyBlock}

${partyScaleHint(partySize, avgLevel)}`;
  }

  // ── Solo mode: show single character ────────────────────────────────────────
  if (!char) return `${VOICE_AND_RULES}${openingBlock}${campaignBlock}${enemyBlock}`;

  const inv      = char.inventory ?? { gold: 0, weapons: [], items: [] };
  const weapons  = inv.weapons?.join(", ") || "none";
  const items    = inv.items?.join(", ")   || "none";
  const ac       = char.ac ?? "unknown";
  const pb       = profBonus(char.level);
  const statuses = char.status_effects?.length ? char.status_effects.join(", ") : "None";

  let spellInfo = "";
  if (char.cantrips_known?.length || char.spells_prepared?.length) {
    const cantrips  = char.cantrips_known?.join(", ") || "none";
    const prepared  = char.spells_prepared?.join(", ") || "none";
    const used      = char.spell_slots_used ?? {};
    const slotLines = Object.entries(used).filter(([, u]) => u > 0)
      .map(([lvl, u]) => `${u}x level-${lvl} used`).join(", ") || "none used";
    spellInfo = `\nCantrips: ${cantrips}\nPrepared spells: ${prepared}\nSlots used this session: ${slotLines}`;
  }

  const itemFx = char.active_item_effects?.length
    ? `\nMagic item effects: ${char.active_item_effects.join("; ")}`
    : "";

  return `${VOICE_AND_RULES}${openingBlock}
${campaignBlock}${enemyBlock}
ACTIVE CHARACTER
${char.name} — Level ${char.level} ${char.race} ${char.class} (Proficiency ${pb})
HP ${char.hp}/${char.max_hp} | AC ${ac} | Gold ${inv.gold}gp
STR ${char.strength} (${mod(char.strength)}) · DEX ${char.dexterity} (${mod(char.dexterity)}) · CON ${char.constitution} (${mod(char.constitution)}) · INT ${char.intelligence} (${mod(char.intelligence)}) · WIS ${char.wisdom} (${mod(char.wisdom)}) · CHA ${char.charisma} (${mod(char.charisma)})
Weapons: ${weapons}
Items: ${items}${char.background ? `\nBackground: ${char.background}` : ""}
Status: ${statuses}${spellInfo}${itemFx}

Reference these stats for all checks and combat. Roll attacks against the character's AC (${ac}). Enforce spell slot limits. Stats shown are effective values including magic item bonuses.`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, character, party, campaignContext, enemies, openingScene } = (await req.json()) as {
      messages: FrontendMessage[];
      character: Character | null;
      party?: Character[];
      campaignContext?: { title: string; description: string };
      enemies?: ActiveEnemy[];
      openingScene?: boolean;
    };

    const claudeMessages: { role: "user" | "assistant"; content: string }[] =
      messages
        .filter((m) => m.role === "player" || m.role === "dm")
        .map((m) => ({
          role: m.role === "player" ? "user" : "assistant",
          content: m.role === "player" && m.sender ? `[${m.sender}]: ${m.content}` : m.content,
        }));

    if (claudeMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), { status: 400 });
    }

    if (claudeMessages[claudeMessages.length - 1].role !== "user") {
      claudeMessages.push({ role: "user", content: "Continue the story." });
    }

    const stream = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1200,
      system:     buildSystemPrompt(character, party, campaignContext, enemies, openingScene),
      messages:   claudeMessages,
      stream:     true,
    });

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    void (async () => {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            await writer.write(encoder.encode(event.delta.text));
          }
        }
      } finally {
        try { await writer.close(); } catch { /* already closed */ }
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type":    "text/plain; charset=utf-8",
        "Cache-Control":   "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const e = err as Error;
    console.error("[api/chat] error:", e?.message, "stack:", e?.stack?.slice(0, 300));
    return new Response(
      JSON.stringify({ error: "The DM is temporarily unavailable." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
