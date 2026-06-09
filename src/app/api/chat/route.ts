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

function modNum(score: number): number {
  return Math.floor((score - 10) / 2);
}

function profBonusNum(level: number): number {
  return level <= 4 ? 2 : level <= 8 ? 3 : level <= 12 ? 4 : 5;
}

function profBonus(level: number): string {
  const b = profBonusNum(level);
  return `+${b}`;
}

function sn(n: number): string { return n >= 0 ? `+${n}` : `${n}`; }

const SPELLCASTING_ABILITY: Record<string, keyof Character> = {
  Bard: "charisma", Cleric: "wisdom", Druid: "wisdom",
  Paladin: "charisma", Ranger: "wisdom", Sorcerer: "charisma",
  Warlock: "charisma", Wizard: "intelligence",
  Fighter: "intelligence", Rogue: "intelligence",
};

const SKILL_ABILITY: Record<string, keyof Character> = {
  Athletics: "strength",
  Acrobatics: "dexterity", "Sleight of Hand": "dexterity", Stealth: "dexterity",
  Arcana: "intelligence", History: "intelligence", Investigation: "intelligence",
  Nature: "intelligence", Religion: "intelligence",
  "Animal Handling": "wisdom", Insight: "wisdom", Medicine: "wisdom",
  Perception: "wisdom", Survival: "wisdom",
  Deception: "charisma", Intimidation: "charisma", Performance: "charisma", Persuasion: "charisma",
};

function buildAttackLine(c: Character): string {
  const pb = profBonusNum(c.level);
  const str = modNum(c.strength), dex = modNum(c.dexterity);
  const parts: string[] = [
    `Melee ATK ${sn(str + pb)} (STR${sn(str)}+prof${pb})`,
    `Ranged ATK ${sn(dex + pb)} (DEX${sn(dex)}+prof${pb})`,
  ];
  const spKey = SPELLCASTING_ABILITY[c.class];
  if (spKey && (c.cantrips_known?.length || c.spells_prepared?.length)) {
    const sm = modNum(c[spKey] as number);
    parts.push(`Spell ATK ${sn(sm + pb)} · DC ${8 + sm + pb} (${String(spKey).slice(0,3).toUpperCase()}${sn(sm)}+prof${pb})`);
  }
  parts.push(`Initiative ${sn(dex)}`);
  return parts.join(" · ");
}

function buildSkillLine(c: Character): string {
  if (!c.skill_proficiencies?.length) return "";
  const pb = profBonusNum(c.level);
  const bonuses = c.skill_proficiencies.map(skill => {
    const key = SKILL_ABILITY[skill];
    const score = key ? (c[key] as number ?? 10) : 10;
    return `${skill} ${sn(modNum(score) + pb)}`;
  });
  return `Proficient skills (with prof bonus): ${bonuses.join(", ")}`;
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
- Never write onomatopoeia or sound effects as spelled-out words ("Whoosh", "Clang", "Thunk", "Brrr", "Zzzt", "Crack", "Hiss", "Boom"). Describe what happens instead: "the door splinters inward" not "Crack! The door opens."
- Avoid invented fantasy gibberish, nonsense syllables, or phonetic garbling unless voicing a creature that genuinely cannot speak Common.
- NEVER begin your response by addressing a player by name alone, e.g. "Shmang," or "Ekko,". That is a critical error — it produces a broken one-word response. Always write a complete sentence first.

ROLL DISCIPLINE — NON-NEGOTIABLE
When you request a dice roll, your response ENDS with that request. One sentence. Stop writing immediately.
- NEVER narrate the outcome of a roll you haven't received. NEVER assume. NEVER fabricate a result.
- The result arrives as the player's very next message — resolve it then and only then.
- Do not write "Roll a d20… and the blade bites deep." Stop at "Roll a d20."
- Skipping or faking a player's roll destroys their agency. It must never happen.
- HARD STOP: "Roll a d[N]." is always the LAST sentence in your entire response. Zero words follow it. Any content after the period is a critical error that breaks the game.

MANDATORY ROLL REQUESTS — CRITICAL VIOLATION IF SKIPPED
For every player action that requires a dice roll, you MUST ask for that roll. You may NEVER auto-resolve or narrate success/failure without first requesting the roll. This applies unconditionally to:
- Any melee or ranged ATTACK → you must say "Roll a d20." You may not say "you hit" or "you miss" without a roll.
- Any SPELL ATTACK (Fire Bolt, Chromatic Orb, Shocking Grasp, etc.) → you must say "Roll a d20." Never narrate the spell landing or missing without one.
- Any ABILITY CHECK or SKILL CHECK where there is a chance of failure → you must say "Roll a d20."
- A SAVING THROW when the player's OWN character is the target of an enemy effect → you must say "Roll a d20."
Deciding on your own that "the attack hits" or "the check succeeds" without a player die roll is a critical error. The player MUST roll. Always.

NO-ROLL ACTIONS — RESOLVE IMMEDIATELY, NEVER ASK FOR A DICE ROLL
Many spells and abilities auto-succeed with no roll required. Narrate the effect and move on:
- Healing spells: Healing Word, Cure Wounds, Mass Cure Wounds, Lay on Hands, Prayer of Healing, Spare the Dying — always heal the stated dice amount, no roll.
- Mobility & teleportation: Misty Step, Dimension Door, Blink, Fly, Spider Climb, Longstrider — auto-succeed, no roll.
- Buff / utility / protection spells: Bless, Guidance, Aid, Heroism, Bardic Inspiration, Enhance Ability, Mage Armor, Shield, Haste, Invisibility, Minor Illusion, Prestidigitation, Detect Magic, and any spell that simply applies an effect — resolve immediately, no roll needed.
- Spells that force enemy SAVING THROWS (Thunderwave, Sleep, Fireball, Hold Person, etc.): the ENEMY makes the save — YOU resolve it internally and narrate the result. The player who cast the spell does NOT roll anything. Never ask the caster to roll when their spell imposes a saving throw on an enemy.

NARRATION ORDER — STRICT CHRONOLOGICAL ONLY
Never narrate events that have not yet occurred or been resolved. Narrate strictly in cause-and-effect order:
- Describe the attempt or casting only — never the outcome — before receiving a roll.
- Wrong: "You swing the sword and it bites deep into the orc's shoulder. Roll a d20." Right: "The orc raises its axe. Roll a d20."
- Wrong: "The fireball explodes, scorching the trolls. Roll a d20." Right: "You hurl the fireball. Roll a d20." (Then after the roll: describe the damage.)
- Never assume an action succeeds or fails before the dice determine it. The dice speak first, you narrate after.

CHARACTER VOICES — GIVE PCs PERSONALITY
You voice the entire world — including the player characters. Narrate how they react, move, and speak using their class, race, alignment, and background as a blueprint.
- Barbarian: blunt and physical — charges before thinking, growls, slams things.
- Rogue: quiet and watchful — says little, misses nothing, always knows the exits.
- Wizard: precise and deliberate — pauses to observe, mutters calculations.
- Paladin: principled and formal — every word chosen, treats oaths as sacred.
- Bard: expressive and performative — turns danger into theatre.
- Cleric: calm and quietly fierce in defence of their faith.
- Ranger: patient and attuned — reads terrain before speaking, trusts instincts.
- Warlock: wry and slightly apart — their patron touches everything.
- Sorcerer: aware of their power in a way that is either thrilling or unsettling.
Use alignment as action: Chaotic bends rules; Lawful follows them even at cost; Good protects the weak.
Show personality through action and reaction — never announce "as a rogue you…"

COMBAT (follow D&D 5e rules exactly)
- Attack rolls: When a player declares ANY attack (melee, ranged, or spell), your ENTIRE response is "Roll a d20." — one sentence, then stop. Never narrate hitting, missing, or dealing damage before receiving the roll. When the player reports the number, add their ATK bonus and compare to the target AC. Announce with labeled components: "11 + 3 [STR] + 2 [Prof] = 16 — hits AC 14!"
- Enemy attacks: you roll d20 + enemy ATK bonus vs. character AC yourself. Announce the attack roll result with labels ("14 + 5 = 19 — hits AC 15!"), then narrate the dramatic outcome. Never state the damage number in prose — use an HP TAG instead (see HP TAGS below).
- Damage: after a player's weapon hit, say "Roll a d[N]." When the player reports the number, state only the total and damage type: "9 slashing." Do not show the damage formula or addends. For enemy hits on player characters, calculate the damage yourself but never speak it in prose — use HP TAG only.
- At 0 HP: the character falls Unconscious (death saving throws apply).
- Spell saves: say "Roll a d20." You add their save modifier and compare to the DC with labels: "9 + 2 [WIS] + 2 [Prof] = 13 — fails DC 14."
- ALWAYS judge health as a PERCENTAGE of max HP, never as a raw number. A Sorcerer at 7/7 HP is FULL health. A Fighter at 7/80 HP is near death. Describe condition accordingly: 100% = healthy, 75%+ = lightly wounded, 50%+ = wounded, 25%+ = badly wounded, below 25% = critical. Never imply a character is in danger based on their HP number alone without considering their max HP.
- ALWAYS name the specific character targeted: "The orc swings at Aragorn — 14 + 5 = 19 — hits AC 15!"

HP TAGS — mandatory after resolving any damage or healing on a player character:
  Append: [HP:FirstName:-N] for N damage, [HP:FirstName:+N] for N healing. Use the exact first name from the stat block.
  Never state the number in prose narration — only in the tag. One tag per character affected. Tags are stripped from the display.
  Examples: [HP:Aria:-9]  [HP:Thorin:+5]  [HP:Zara:-12]

MODIFIER HANDLING — YOU DO ALL MATH, PLAYERS ROLL ONLY THE RAW DIE
You hold the full character sheet. Players submit only the number showing on the physical die.
- NEVER say "add your modifier", "add proficiency", or ask the player to do any arithmetic.
- NEVER use phrasing like "roll your Stealth check" or "roll d20 + your DEX" — always say "roll a d20" and calculate the final number yourself.
- Each character block below contains pre-calculated ATTACK BONUSES and PROFICIENT SKILLS — use them directly, do not re-derive.
- Attack rolls: d20 result + Melee ATK bonus (STR-based weapons) or Ranged ATK bonus (ranged/finesse/DEX weapons).
- Spell attacks: d20 result + Spell ATK bonus from the stat block.
- Skill checks: if the skill appears in Proficient skills list, use that pre-calculated total. Otherwise d20 + raw ability mod only.
- Saving throws: d20 + ability mod + prof bonus when the save type is in their Save proficiencies list; otherwise d20 + ability mod alone.
- Damage after a hit: ask "Roll a d[N]." Add STR mod for melee, DEX for ranged/finesse, no mod for most spell damage. Magic weapon bonus (+1/+2/+3) adds to both attack rolls and damage.
- Critical hit (natural 20): double the damage dice rolled (not the modifier). Roll the weapon die twice, add mod once.
- Show all arithmetic in one compact line per roll with every addend labeled: "8 + 3 [STR] + 2 [Prof] = 13 — misses AC 14." Label every non-roll component: ability modifier ([STR], [DEX], [CON], [INT], [WIS], [CHA]), proficiency bonus ([Prof]), spell attack bonus ([Spell ATK]), magic weapon bonus ([+1 weapon]), etc. Never collapse components into an unlabeled total. Never ask players to verify or re-check.

SPELLS & SLOTS
- Track spell slot usage. When a leveled spell is cast, state it consumes a slot ("That uses one of your 1st-level slots").
- Cantrips cost no slots. State this naturally if relevant.
- If a caster is out of slots, they cannot cast leveled spells — acknowledge this in the narrative.
- STRICT SPELL RESTRICTION: Only ever reference, suggest, or narrate a character casting a spell that appears in their listed Cantrips or Prepared spells. Never hint at, name, or suggest spells they don't have — including spells typical of their class. Players can only cast what is explicitly prepared. If you suggest actions, only spells from their actual list are valid options.

SPELL PARAMETER CLARIFICATION
Some spells require the caster to choose a parameter BEFORE the effect resolves — damage type, element, creature type, shape, etc. When a player declares such a spell without specifying the required choice, ask them to choose FIRST. Then, once they answer, describe the effect and request any roll. Never assume a choice the player hasn't stated. One clarifying question per response — stop there.

Spells that always need a player choice before resolving:
- Chromatic Orb → "Which element? Acid, cold, fire, lightning, poison, or thunder?"
- Dragon's Breath → "Which damage type? Acid, cold, fire, lightning, or poison?"
- Elemental Weapon → "Which element? Acid, cold, fire, lightning, or thunder?"
- Conjure Elemental → "Which elemental? Air, earth, fire, or water?"
- Polymorph / Wild Shape → "What form are you taking?"
- Any spell whose description says 'choose a damage type', 'choose a creature type', or similar.

If the player already named the choice in their message (e.g. "I cast Chromatic Orb — fire"), proceed directly without asking again.

PARTY RULES
- Keep the party together unless the story specifically separates them (locked room, ambush split, etc.).
- Trading items and casting beneficial spells requires proximity: touch spells need contact, most spells need the target within 60 ft.
- If party members are separated, narrate the distance and enforce range restrictions naturally.

ENVIRONMENT — ALWAYS MOVING
Never let the story stagnate in one location. Every 2–3 player exchanges, introduce a new sub-location or environmental development: the party pushes through a new door, emerges into a different chamber, a part of the environment changes dramatically (fire, collapse, rising water, a new arrival). Vary the sensory palette — shift from torchlit corridors to open caverns to narrow stairs. The world is alive and the party is always moving through it, not standing still.

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
- CURRENT TURN names who will act NEXT once any pending business resolves. End your response by asking that player what they do — unless the ROLL RESTRICTION says someone else must roll first (in which case, ask only that person to roll and stop).
- ROLL RESTRICTION is the absolute authority on who may roll. Follow it exactly. Ask no other character to roll in any response. Asking the wrong character to roll is a critical error.
- When a previous player's action resolves with a roll: one sentence asking only that player to roll a d20, then STOP. Zero words after the period. The ROLL RESTRICTION block names the permitted roller.
- Rotate your closing call-to-action phrasing — never repeat the same one twice in a row. Examples: "[Name], what do you do?" / "How do you respond, [Name]?" / "The choice is yours, [Name]." / "What's your next move, [Name]?" / "Make your move, [Name]." / "You're up, [Name] — what now?"
- TURN ORDER: The REMAINING THIS ROUND block (when present) shows which players still need to declare their next action. It does NOT restrict who may roll — a player may still be asked to roll their dice even if they already submitted their action this round (e.g. an attack roll resolves after the action is submitted). The ROLL RESTRICTION block is the final authority on who rolls. The CURRENT TURN block is the final authority on who acts next.
- After all players have taken their turn you will receive a [ROUND RECONCILIATION] prompt. At that point: resolve all combat, have living enemies take their turns (attack appropriate party members with full dice), apply all ongoing effects and conditions, narrate the complete round outcome, then set the scene for the next round. Do NOT end with "[Name], what do you do?" — the game engine automatically sends that prompt to the next player. Writing it causes the player to be asked twice.
- Scale encounters to match the full party size — refer to the ENCOUNTER SCALING block below the party list for guidance.
- PLAYER AGENCY — NEVER invent or narrate an action for a player who has not yet taken their turn. Only describe consequences of actions players have already submitted. If a player has not acted this turn, they have not acted — full stop.

TURN REPLAY — NO-RESULT ACTIONS
If a player's action produced ZERO outcome (blank wall, empty room, no one present, no information gained, no effect), do NOT advance to the next player. Keep their turn. One brief sentence describing the null result, then ask the same player what they want to try next with a varied call to action (e.g. "What now, [Name]?" or "[Name], what do you do?" or "The choice is yours, [Name]."). The engine reads who you address at the end of your response and sets the turn accordingly.

MECHANICS (woven into the narrative, not announced)
- Fold skill checks into the scene: "The lock is old and sloppy — but it'll take some work. Roll a d20." (You then add their tool/skill bonus and compare to DC 13.)
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
Every word costs a player real listening time. Spoken narration at normal speed takes roughly one second per word. Keep responses minimal.

Word budgets (absolute hard limits — the model must never exceed these):
- Regular turn (any action, combat, dialogue, exploration): 40–55 words. Two to four sentences only.
- Round reconciliation (all players have acted): 65–85 words. Resolve all actions, enemies attack, hand off.
- Campaign opening scene only: up to 100 words. The single exception.

Rules with no exceptions:
- One sensory detail per response maximum — cut the rest.
- Lead with what CHANGES — no scene-setting preamble.
- Never re-summarize what the player just said.
- End on an action hook or direct question.
- If it can be cut without losing meaning, cut it.

NEVER OUTPUT JSON OR STRUCTURED DATA
Your responses are pure narrative prose. Never include JSON, curly braces, XP tallies, state objects, or any structured data in your output — the game engine extracts all state changes automatically from your narrative. If you output raw JSON it appears as literal text in the player's chat.

Describe events naturally — the numbers are tracked invisibly. "The orc falls, a hard-won fight that sharpens your skills" is enough. Do not annotate with stats, XP values, or brackets.

STATUS EFFECTS
The game engine automatically tracks buffs, debuffs, conditions, diseases, and enchantments on player character cards — complete with glowing icons and tooltip descriptions. Use canonical effect names in your narrative and the engine detects and applies them. When an effect expires or is removed, just narrate it ending.

Available effects by category (use these exact names):
CONDITIONS: Unconscious, Dead, Poisoned, Blinded, Frightened, Paralyzed, Stunned, Prone, Charmed, Exhausted, Restrained, Petrified, Deafened, Grappled, Invisible, Incapacitated
BUFFS: Blessed, Hasted, Raging, Inspired, Shielded, Concentrating, Flying, Regenerating, Wild Shaped, Bardic Inspiration, Death Ward, Sanctuary
DEBUFFS: Cursed, Hexed, Marked, Silenced, Weakened, Hunter's Mark
DISEASES: Diseased, Infected, Fevered, Sewer Plague
ENCHANTMENTS: Attuned, Empowered, Enchanted, Mage Armor, Mirror Image

When applying an effect, mention the duration naturally if known: "Aria falls Prone", "the Blessed effect lasts 1 minute", "Thorin is Poisoned". When it ends: "the paralysis fades", "Aria shakes off the Frightened condition". No special tags needed — the engine reads your prose.

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

function buildSystemPrompt(char: Character | null, party?: Character[], campaignContext?: { title: string; description: string }, enemies?: ActiveEnemy[], openingScene?: boolean, currentTurnPlayerName?: string, targetedEnemyName?: string, prevActingPlayerName?: string, roundSummary?: { name: string; action: string }[], partyLeaderName?: string, pendingReconciliation?: boolean, isRollResult?: boolean, isTurnSkip?: boolean, skippedPlayerName?: string, isGroupCheckResult?: boolean, turnOrder?: string[]): string {
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
  // Suppress prevActedLine during reconciliation — the round summary supersedes individual turn transitions
  const prevActedLine = !roundSummary?.length && !pendingReconciliation && prevActingPlayerName && prevActingPlayerName !== currentTurnPlayerName
    ? isRollResult
      ? `${prevActingPlayerName} just submitted a roll result. Resolve the outcome in 1–2 complete sentences, then ask ${currentTurnPlayerName ?? prevActingPlayerName} what they do. `
      : `${prevActingPlayerName} just acted. Does it need a dice roll? → If yes: narrate the attempt in 1 sentence, then end with "Roll a d20." Do NOT start your response with ${prevActingPlayerName}'s name. → If no: narrate the outcome in 1–2 complete sentences, then ask ${currentTurnPlayerName} what they do. `
    : "";

  // Only add the standalone turn instruction when there is no preceding player to resolve.
  const standaloneTurnInstruction = !prevActedLine
    ? `It is ${currentTurnPlayerName}'s turn. If a roll is needed ask for it and stop. Otherwise ask what they want to do.\n`
    : "";

  // Roll restriction: concise single-line authority on who may roll.
  const rollRestriction = prevActingPlayerName && prevActingPlayerName !== currentTurnPlayerName && !isRollResult
    ? `ROLL RESTRICTION: Only ${prevActingPlayerName} may roll this response. Do not ask ${currentTurnPlayerName} to roll.`
    : `ROLL RESTRICTION: Only ${currentTurnPlayerName} may roll.`;

  const turnBlock = currentTurnPlayerName
    ? `\nCURRENT TURN: ${currentTurnPlayerName}\n${prevActedLine}${standaloneTurnInstruction}${rollRestriction}\n`
    : "";

  const reconcileBlock = roundSummary?.length
    ? `\n[ROUND COMPLETE — ALL PLAYERS HAVE ACTED]\nHere is what each player did:\n${roundSummary.map(a => `- ${a.name}: ${a.action}`).join("\n")}\n\nTell the story — do NOT announce you are resolving a round, do NOT number your steps, do NOT say "resolving", "processing", or any meta-commentary about game mechanics. Narrate each action's outcome vividly, have every living enemy attack an appropriate party member and state the result and exact damage, apply ongoing effects and conditions naturally, then close with the new scene setup. Do NOT end with "[Name], what do you do?" — the engine prompts the next player automatically.\n`
    : "";

  const pendingReconcileBlock = pendingReconciliation
    ? `\n[ROUND ENDING — ${prevActingPlayerName ?? "the last player"} just acted]\nNarrate ${prevActingPlayerName ? `${prevActingPlayerName}'s` : "their"} action outcome in 1–2 sentences. YOUR RESPONSE ENDS THERE — no question, no "what do you do?", no turn prompt of any kind. Do NOT ask any player anything. Do NOT resolve other players' actions. Do NOT call for dice rolls. The full round summary is arriving in the next message and the engine will handle all turn prompting.\n`
    : "";

  const targetBlock = targetedEnemyName
    ? `\nPLAYER'S TARGET: The active player is focusing their attack on ${targetedEnemyName}. Resolve their action against ${targetedEnemyName} unless they explicitly say otherwise.\n`
    : "";

  const partyLeaderBlock = party && party.length > 1
    ? `\nGROUP ROLLS — For whole-party checks (Perception, Stealth, saving throws), ask the CURRENT TURN player to roll a d20 for the party. This does NOT use their individual turn action — they still act after the result.\n`
    : "";

  const groupCheckBlock = isGroupCheckResult && currentTurnPlayerName
    ? `\n[GROUP CHECK RESOLVED] The group check roll was just submitted. Resolve the result. IMPORTANT: this was NOT ${currentTurnPlayerName}'s individual turn action — they still have their full turn. After resolving the group check, ask ${currentTurnPlayerName} what they want to do.\n`
    : "";

  const turnOrderBlock = turnOrder && turnOrder.length > 1
    ? `\nREMAINING THIS ROUND: ${turnOrder.join(" → ")}.\n`
    : "";

  const turnSkipBlock = isTurnSkip && currentTurnPlayerName
    ? skippedPlayerName
      ? `\n[TURN SWAPPED — ${skippedPlayerName} ↔ ${currentTurnPlayerName}]\n${skippedPlayerName} has deferred — they will still act later in the round. It is now ${currentTurnPlayerName}'s turn.\nYour entire response: one sentence placing ${currentTurnPlayerName} in the current moment (what they see or face right now), then ask ${currentTurnPlayerName} what they do. Two sentences maximum. No dice. No combat resolution.\n`
      : `\n[TURN SWAP]\nIt is now ${currentTurnPlayerName}'s turn.\nYour entire response: one sentence placing ${currentTurnPlayerName} in the current moment, then ask ${currentTurnPlayerName} what they do. Two sentences maximum.\n`
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
      const pronouns   = c.sex === "female" ? "she/her" : c.sex === "non-binary" ? "they/them" : "he/him";
      const titleStr   = c.title ? ` "${c.title}"` : "";
      const alignStr   = c.alignment ? `\n  Alignment: ${c.alignment}` : "";
      const bgStr      = c.background ? `\n  Background: ${c.background}` : "";
      const saves      = CLASS_SAVES[c.class] ? `Save proficiencies: ${CLASS_SAVES[c.class].join(", ")}` : "";
      const atkLine    = buildAttackLine(c);
      const skillLine  = buildSkillLine(c);
      const profLine   = [saves, skillLine].filter(Boolean).join("\n  ");
      const cantStr    = c.cantrips_known?.length  ? c.cantrips_known.join(", ")  : "";
      const spellStr   = c.spells_prepared?.length ? c.spells_prepared.join(", ") : "";
      const spellLine  = (cantStr || spellStr)
        ? `\n  Cantrips: ${cantStr || "—"}  |  Spells prepared: ${spellStr || "—"}`
        : "";
      const hpPct = c.max_hp > 0 ? Math.round((c.hp / c.max_hp) * 100) : 0;
      return `${c.name}${titleStr} — Level ${c.level} ${sexStr}${c.race} ${c.class} (Prof ${pb})
  Pronouns: ${pronouns}${alignStr}${bgStr}
  HP ${c.hp}/${c.max_hp} (${hpPct}%) | AC ${ac}${statuses}
  STR ${c.strength}(${mod(c.strength)}) DEX ${c.dexterity}(${mod(c.dexterity)}) CON ${c.constitution}(${mod(c.constitution)}) INT ${c.intelligence}(${mod(c.intelligence)}) WIS ${c.wisdom}(${mod(c.wisdom)}) CHA ${c.charisma}(${mod(c.charisma)})
  ATTACK BONUSES: ${atkLine}
  Weapons: ${weapons}  |  Items: ${items}${profLine ? `\n  ${profLine}` : ""}${spellLine}${itemFx}`;
    }).join("\n\n");

    return `${VOICE_AND_RULES}${openingBlock}
${campaignBlock}${enemyBlock}${reconcileBlock || turnSkipBlock || turnBlock || pendingReconcileBlock}${groupCheckBlock}${partyLeaderBlock}${targetBlock}${turnOrderBlock}
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
  const solSkills  = buildSkillLine(char) ? `\n${buildSkillLine(char)}` : (char.skill_proficiencies?.length ? `\nSkill proficiencies: ${char.skill_proficiencies.join(", ")}` : "");
  const solAlign   = char.alignment ? `\nAlignment: ${char.alignment}` : "";
  const solBg      = char.background ? `\nBackground: ${char.background}` : "";
  const solAtk     = buildAttackLine(char);

  return `${VOICE_AND_RULES}${openingBlock}
${campaignBlock}${enemyBlock}${reconcileBlock || turnSkipBlock || turnBlock}${groupCheckBlock}${partyLeaderBlock}${targetBlock}${turnOrderBlock}
ACTIVE CHARACTER
${char.name}${titleStr} — Level ${char.level} ${char.race} ${char.class} (Proficiency ${pb})
HP ${char.hp}/${char.max_hp} (${char.max_hp > 0 ? Math.round((char.hp / char.max_hp) * 100) : 0}%) | AC ${ac} | Gold ${inv.gold}gp
STR ${char.strength} (${mod(char.strength)}) · DEX ${char.dexterity} (${mod(char.dexterity)}) · CON ${char.constitution} (${mod(char.constitution)}) · INT ${char.intelligence} (${mod(char.intelligence)}) · WIS ${char.wisdom} (${mod(char.wisdom)}) · CHA ${char.charisma} (${mod(char.charisma)})
ATTACK BONUSES: ${solAtk}
Weapons: ${weapons}
Items: ${items}${solAlign}${solBg}${solSaves}${solSkills}
Status: ${statuses}${spellInfo}${itemFx}

Use ATTACK BONUSES above for all roll calculations. Apply proficiency bonus (${pb}) to ${CLASS_SAVES[char.class]?.join("/")??"class"} saves and proficient skill checks. Player rolls only the raw die; you add modifiers. Enforce spell slot limits.`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, character, party, campaignContext, enemies, openingScene, currentTurnPlayerName, targetedEnemyName, prevActingPlayerName, roundSummary, partyLeaderName, pendingReconciliation, isRollResult, isTurnSkip, skippedPlayerName, isGroupCheckResult, turnOrder } = (await req.json()) as {
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
      isRollResult?: boolean;
      isTurnSkip?: boolean;
      skippedPlayerName?: string;
      isGroupCheckResult?: boolean;
      turnOrder?: string[];
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

    // max_tokens is a hard ceiling that enforces the word budget.
    // Calibrated so a well-formed response always fits but the DM can't ramble.
    const maxTokens = roundSummary?.length ? 260 : openingScene ? 300 : isTurnSkip ? 150 : 190;

    const stream = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system:     buildSystemPrompt(character, party, campaignContext, enemies, openingScene, currentTurnPlayerName, targetedEnemyName, prevActingPlayerName, roundSummary, partyLeaderName, pendingReconciliation, isRollResult, isTurnSkip, skippedPlayerName, isGroupCheckResult, turnOrder),
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
