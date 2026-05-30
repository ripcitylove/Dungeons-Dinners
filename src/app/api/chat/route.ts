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
  title?: string;
  alignment?: string;
  background?: string;
  skill_proficiencies?: string[];
  status_effects?: string[];
  cantrips_known?: string[];
  spells_prepared?: string[];
  spell_slots_used?: Record<number, number>;
  inventory: { gold: number; weapons: string[]; items: string[] };
  active_item_effects?: string[];
};

const CLASS_SAVES: Record<string, string[]> = {
  Barbarian: ["STR","CON"], Bard: ["DEX","CHA"], Cleric: ["WIS","CHA"],
  Druid: ["INT","WIS"], Fighter: ["STR","CON"], Monk: ["STR","DEX"],
  Paladin: ["WIS","CHA"], Ranger: ["STR","DEX"], Rogue: ["DEX","INT"],
  Sorcerer: ["CON","CHA"], Warlock: ["WIS","CHA"], Wizard: ["INT","WIS"],
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
- ALWAYS judge health as a PERCENTAGE of max HP, never as a raw number. A Sorcerer at 7/7 HP is FULL health. A Fighter at 7/80 HP is near death. Describe condition accordingly: 100% = healthy, 75%+ = lightly wounded, 50%+ = wounded, 25%+ = badly wounded, below 25% = critical. Never imply a character is in danger based on their HP number alone without considering their max HP.
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

MULTI-PLAYER TURNS & ROUND STRUCTURE
- Player messages are prefixed with [CharacterName]: to identify the speaker.
- Always address characters by their FIRST NAME ONLY (e.g. say "Aria" not "Aria Moonwhisper"). Never use a character's full name in narration or dialogue.
- This game uses D&D 5e round structure. Each round every player takes ONE action in sequence.
- CURRENT TURN tells you exactly who is acting. Address ONLY that player. Narrate consequences of the previous action, then ask the CURRENT TURN player what they do.
- ROLL REQUESTS: You may ONLY ask the CURRENT TURN player to roll dice. NEVER ask a different player to roll during someone else's turn — not even to "resolve" a prior action. If a roll for a non-active character would make sense, note it silently in the narrative (e.g. "Chonk's sharp eyes catch something…") and defer any mechanical roll until it is that character's turn.
- Do NOT include "[Name], roll a [type]" for any character other than the CURRENT TURN player.
- After all players have taken their turn you will receive a [ROUND RECONCILIATION] prompt. At that point: resolve all combat, have living enemies take their turns (attack appropriate party members with full dice), apply all ongoing effects and conditions, narrate the complete round outcome, then address the first player of the new round.
- Scale encounters to match the full party size — refer to the ENCOUNTER SCALING block below the party list for guidance.

MECHANICS (woven into the narrative, not announced)
- Fold skill checks into the scene: "The lock is old and sloppy — but it'll take some work. Roll your thieves' tools against DC 13."
- Treasure is contextual — award it when it makes sense and feels earned. Not every fight ends with loot. Not every NPC carries coin. The world runs on more than gold. Items appear when the DM decides, not on a schedule.

CHARACTER SPOTLIGHT
Before crafting any scene, scan the full party sheet: spells, cantrips, inventory, race, class, alignment, background, skill proficiencies, and sex. Use alignment to shape how a character would naturally respond to moral choices. Use background details as seeds for encounters, NPC recognition, or personal story hooks. Use skill proficiencies when calling for checks — a character proficient in Persuasion should get the prof bonus on Charisma checks to sway NPCs. Then design the environment so that one or two characters' specific abilities become quietly, naturally relevant — without ever announcing it.

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

PACING — STRICTLY ENFORCED
Responses must be brief. Players are waiting to act — every extra sentence is dead time.

Word budgets (hard limits):
- Regular turn (combat, exploration, dialogue): 50–70 words. Three to five sentences maximum.
- Round reconciliation (all players acted): 80–110 words. Resolve everything, enemies attack, then hand off.
- Campaign opening scene only: up to 150 words. This is the single exception.

Rules with no exceptions:
- Never write more than two sentences of atmosphere before something happens.
- Never re-summarize what the player just said back to them.
- Never pad with "As you…", "Suddenly…", "With a…" filler openers.
- One sensory detail maximum per response — pick the sharpest one and cut the rest.
- End every response on a hook the player can immediately react to.

XP AWARDS — REQUIRED
Award XP consistently so players always feel progression. Include xp_award in the state JSON whenever one of these happens:
- Successful attack or spell in combat: 10–25 XP per character
- Defeating an enemy: award its full xp_value split among surviving party members
- Clever skill check success (persuasion, stealth, investigation, acrobatics, etc.): 15–35 XP
- Minor victory (picking a lock, solving a puzzle clue, surviving a trap): 20–50 XP
- Significant story moment (completing an objective, major revelation, defeating a boss): 75–150 XP
Never award 0 XP for a meaningful action. Scale higher for harder challenges.

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

function buildSystemPrompt(char: Character | null, party?: Character[], campaignContext?: { title: string; description: string }, enemies?: ActiveEnemy[], openingScene?: boolean, currentTurnPlayerName?: string, targetedEnemyName?: string, prevActingPlayerName?: string, roundSummary?: { name: string; action: string }[], partyLeaderName?: string, pendingReconciliation?: boolean): string {
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
  const prevActedLine = prevActingPlayerName && prevActingPlayerName !== currentTurnPlayerName
    ? `${prevActingPlayerName} has just finished their turn — it is OVER. Do NOT ask ${prevActingPlayerName} what they do next. Do NOT end your response with a question directed at ${prevActingPlayerName}. `
    : "";
  const turnBlock = currentTurnPlayerName
    ? `\nCURRENT TURN: ${currentTurnPlayerName}\n${prevActedLine}It is now ${currentTurnPlayerName}'s turn and they have not yet acted. Resolve any consequences of the previous action, then end your response by addressing ${currentTurnPlayerName} directly by name and asking what they want to do — even if just "What do you do, ${currentTurnPlayerName}?" Make it feel natural in the narrative.\nROLL RESTRICTION: In this response you may only ask ${currentTurnPlayerName} to roll dice. Do not ask any other character to roll.\n`
    : "";

  const reconcileBlock = roundSummary?.length
    ? `\n[ROUND RECONCILIATION — ALL PLAYERS HAVE ACTED]\n${prevActedLine}Every player has taken their action this round. Here is what each player did:\n${roundSummary.map(a => `- ${a.name}: ${a.action}`).join("\n")}\n\nNow perform a FULL ROUND RESOLUTION:\n1. Resolve all player actions with complete dice outcomes.\n2. Each living enemy takes their turn — roll attacks against appropriate party members, state the roll, hit/miss, and exact damage.\n3. Apply all ongoing effects, concentration checks, and end-of-round conditions.\n4. Narrate the full round outcome vividly.\n5. End by addressing ${currentTurnPlayerName ?? "the first player"} by name, asking what they want to do — even if just "What do you do, ${currentTurnPlayerName ?? "adventurer"}?" Make this the final sentence of your response.\n`
    : "";

  const pendingReconcileBlock = pendingReconciliation
    ? `\nALL PLAYERS HAVE ACTED — DO NOT CALL NEXT TURN\nAll players have now taken their action this round. Briefly narrate the immediate outcome of this last action. Do NOT address any player, ask what they do next, or call for any dice rolls. The complete round summary arrives in the very next message.\n`
    : "";

  const targetBlock = targetedEnemyName
    ? `\nPLAYER'S TARGET: The active player is focusing their attack on ${targetedEnemyName}. Resolve their action against ${targetedEnemyName} unless they explicitly say otherwise.\n`
    : "";

  const partyLeaderBlock = partyLeaderName && party && party.length > 1
    ? `\nGROUP ROLLS — When the situation calls for the entire party to make a check (Perception, Stealth, saving throws, etc.), address ONLY ${partyLeaderName} and explicitly say it is a group/party check. Example: "${partyLeaderName}, roll Stealth for the group." Never ask each party member individually for the same roll.\n`
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
      const statuses   = c.status_effects?.length ? ` [${c.status_effects.join(", ")}]` : "";
      const itemFx     = c.active_item_effects?.length ? `\n  Item effects: ${c.active_item_effects.join("; ")}` : "";
      const sexStr     = c.sex ? `${c.sex} ` : "";
      const titleStr   = c.title ? ` "${c.title}"` : "";
      const alignStr   = c.alignment ? `\n  Alignment: ${c.alignment}` : "";
      const bgStr      = c.background ? `\n  Background: ${c.background}` : "";
      const saves      = CLASS_SAVES[c.class] ? `Save proficiencies: ${CLASS_SAVES[c.class].join(", ")}` : "";
      const skillProfs = c.skill_proficiencies?.length ? `Skilled: ${c.skill_proficiencies.join(", ")}` : "";
      const profLine   = [saves, skillProfs].filter(Boolean).join(" | ");
      const cantStr    = c.cantrips_known?.length  ? c.cantrips_known.join(", ")  : "";
      const spellStr   = c.spells_prepared?.length ? c.spells_prepared.join(", ") : "";
      const spellLine  = (cantStr || spellStr)
        ? `\n  Cantrips: ${cantStr || "—"}  |  Spells prepared: ${spellStr || "—"}`
        : "";
      const hpPct = c.max_hp > 0 ? Math.round((c.hp / c.max_hp) * 100) : 0;
      return `${c.name}${titleStr} — Level ${c.level} ${sexStr}${c.race} ${c.class} (Prof ${pb})${alignStr}${bgStr}
  HP ${c.hp}/${c.max_hp} (${hpPct}%) | AC ${ac}${statuses}
  STR ${c.strength}(${mod(c.strength)}) DEX ${c.dexterity}(${mod(c.dexterity)}) CON ${c.constitution}(${mod(c.constitution)}) INT ${c.intelligence}(${mod(c.intelligence)}) WIS ${c.wisdom}(${mod(c.wisdom)}) CHA ${c.charisma}(${mod(c.charisma)})
  Weapons: ${weapons}  |  Items: ${items}${profLine ? `\n  ${profLine}` : ""}${spellLine}${itemFx}`;
    }).join("\n\n");

    return `${VOICE_AND_RULES}${openingBlock}
${campaignBlock}${enemyBlock}${reconcileBlock || turnBlock || pendingReconcileBlock}${partyLeaderBlock}${targetBlock}
PARTY — CURRENTLY ONLINE (${partySize} adventurers present)
Do not reference or narrate characters not listed here as if they are present.
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

  const titleStr   = char.title ? ` "${char.title}"` : "";
  const solSaves   = CLASS_SAVES[char.class] ? `\nSaving throw proficiencies: ${CLASS_SAVES[char.class].join(", ")}` : "";
  const solSkills  = char.skill_proficiencies?.length ? `\nSkill proficiencies: ${char.skill_proficiencies.join(", ")}` : "";
  const solAlign   = char.alignment ? `\nAlignment: ${char.alignment}` : "";
  const solBg      = char.background ? `\nBackground: ${char.background}` : "";

  return `${VOICE_AND_RULES}${openingBlock}
${campaignBlock}${enemyBlock}${reconcileBlock || turnBlock}${partyLeaderBlock}${targetBlock}
ACTIVE CHARACTER
${char.name}${titleStr} — Level ${char.level} ${char.race} ${char.class} (Proficiency ${pb})
HP ${char.hp}/${char.max_hp} (${char.max_hp > 0 ? Math.round((char.hp / char.max_hp) * 100) : 0}%) | AC ${ac} | Gold ${inv.gold}gp
STR ${char.strength} (${mod(char.strength)}) · DEX ${char.dexterity} (${mod(char.dexterity)}) · CON ${char.constitution} (${mod(char.constitution)}) · INT ${char.intelligence} (${mod(char.intelligence)}) · WIS ${char.wisdom} (${mod(char.wisdom)}) · CHA ${char.charisma} (${mod(char.charisma)})
Weapons: ${weapons}
Items: ${items}${solAlign}${solBg}${solSaves}${solSkills}
Status: ${statuses}${spellInfo}${itemFx}

Reference these stats for all checks and combat. Apply proficiency bonus (${pb}) to saving throws in ${CLASS_SAVES[char.class]?.join("/") ?? "class"} saves and to proficient skill checks. Roll attacks against the character's AC (${ac}). Enforce spell slot limits.`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, character, party, campaignContext, enemies, openingScene, currentTurnPlayerName, targetedEnemyName, prevActingPlayerName, roundSummary, partyLeaderName, pendingReconciliation } = (await req.json()) as {
      messages: FrontendMessage[];
      character: Character | null;
      party?: Character[];
      campaignContext?: { title: string; description: string };
      enemies?: ActiveEnemy[];
      openingScene?: boolean;
      currentTurnPlayerName?: string;
      targetedEnemyName?: string;
      prevActingPlayerName?: string;
      roundSummary?: { name: string; action: string }[];
      partyLeaderName?: string;
      pendingReconciliation?: boolean;
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

    // Pacing instruction keeps responses short; max_tokens is a hard ceiling only.
    // Must be high enough that the model never truncates mid-sentence.
    const maxTokens = roundSummary?.length ? 520 : openingScene ? 480 : 380;

    const stream = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system:     buildSystemPrompt(character, party, campaignContext, enemies, openingScene, currentTurnPlayerName, targetedEnemyName, prevActingPlayerName, roundSummary, partyLeaderName, pendingReconciliation),
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
