import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getSpellSlots } from "../../../lib/spellData";

const anthropic = new Anthropic();

type PartyMemberCtx = {
  name: string;
  class?: string;
  race?: string;
  // Drives pronoun derivation for THIS party member — critical for the
  // suggester to refer to other characters correctly. Same mapping the chat
  // route uses: female → she/her, non-binary → they/them, anything else
  // (including undefined) → he/him.
  sex?: string;
  hp?: number;
  max_hp?: number;
  status_effects?: string[];
  isMe?: boolean;
};

function pronounsFor(sex?: string): string {
  if (sex === "female") return "she/her";
  if (sex === "non-binary") return "they/them";
  return "he/him";
}

type EnemyCtx = {
  name: string;
  condition?: string;
  is_defeated?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const {
      dmResponse,
      character,
      party,
      enemies,
    } = (await req.json()) as {
      dmResponse: string;
      character?: PartyMemberCtx & {
        cantrips_known?: string[];
        spells_prepared?: string[];
        inventory?: { weapons?: ({ name: string } | string)[] };
        level?: number;
        sex?: string;
        spell_slots_used?: Record<string, number>;
      };
      party?: PartyMemberCtx[];
      enemies?: EnemyCtx[];
    };

    let charLine = "";
    if (character) {
      const cantrips = character.cantrips_known?.length
        ? `Cantrips: ${character.cantrips_known.join(", ")}.`
        : "No cantrips.";
      const prepared = character.spells_prepared?.length
        ? `Prepared spells: ${character.spells_prepared.join(", ")}.`
        : "No prepared spells.";
      const weapons = character.inventory?.weapons?.length
        ? `Weapons: ${character.inventory.weapons.map(w => typeof w === "string" ? w : w.name).join(", ")}.`
        : "";
      const hpPct = character.max_hp && character.max_hp > 0 ? Math.round(((character.hp ?? 0) / character.max_hp) * 100) : 100;
      const pronouns = pronounsFor(character.sex);
      // Spell-slot economy: prepared (leveled) spells each need a slot; cantrips are free.
      const maxSlots = character.class ? getSpellSlots(character.class, character.level ?? 1) : {};
      const usedSlots = character.spell_slots_used ?? {};
      let slotsLeft = 0;
      for (const [lvl, n] of Object.entries(maxSlots)) slotsLeft += Math.max(0, (n as number) - (Number(usedSlots[lvl]) || 0));
      const hasLeveledSpells = (character.spells_prepared?.length ?? 0) > 0;
      const slotNote = hasLeveledSpells
        ? ` Spell slots remaining: ${slotsLeft}${slotsLeft === 0 ? " (NO leveled spells castable — cantrips only)" : ""}.`
        : "";
      charLine = `Character: ${character.name} (${pronouns}), Level ${character.level ?? 1} ${character.race ?? ""} ${character.class ?? ""}. HP ${character.hp}/${character.max_hp} (${hpPct}%). ${weapons} ${cantrips} ${prepared}${slotNote}`.trim();
    }

    // ── Party context block ────────────────────────────────────────────────────
    // The OTHER party members the suggester might mistakenly think are dead.
    // We list every alive teammate by name + HP so the model knows who is
    // visibly standing in the scene right now.
    let partyLine = "";
    if (party?.length) {
      const others = party.filter(p => !p.isMe);
      if (others.length > 0) {
        const aliveLines = others.map(p => {
          const cur = p.hp ?? 0;
          const max = p.max_hp ?? 0;
          const isDead = (p.status_effects ?? []).some(s => /dead/i.test(s));
          const isUnconscious = cur === 0 || (p.status_effects ?? []).some(s => /unconscious/i.test(s));
          const state = isDead ? "DEAD" : isUnconscious ? "Unconscious (0 HP)" : `${cur}/${max} HP, alive and standing`;
          const status = (p.status_effects ?? []).filter(s => !/^dead$|^unconscious$/i.test(s)).join(", ");
          // Pronouns appear immediately after the name so the suggester can
          // never mistake the character's gender when crafting a suggestion
          // that references them in third person.
          const prn = pronounsFor(p.sex);
          const subtitle = [p.race, p.class].filter(Boolean).join(" ");
          return `  - ${p.name} (${prn})${subtitle ? `, ${subtitle}` : ""}: ${state}${status ? `, ${status}` : ""}`;
        }).join("\n");
        partyLine = `\n\nPARTY (other characters present in the scene — pronouns are CANONICAL, not guesses):\n${aliveLines}`;
      }
    }

    // ── Enemy context ──────────────────────────────────────────────────────────
    let enemyLine = "";
    if (enemies?.length) {
      const alive = enemies.filter(e => !e.is_defeated);
      if (alive.length > 0) {
        enemyLine = `\n\nACTIVE ENEMIES: ${alive.map(e => `${e.name}${e.condition ? ` (${e.condition})` : ""}`).join(", ")}`;
      }
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 320,
      system:
        `You are a D&D 5e action suggestion engine. Always respond with ONLY a valid JSON array of exactly 4 short player action strings (3–8 words each). No explanation, no markdown, no extra text.

Read the DM's message AND the party / enemy state. Every suggestion must make sense for the current moment — nonsensical or contradicted options ruin the experience.

CRITICAL — PARTY AWARENESS:
- The PARTY block lists every other character currently present in the scene with their actual HP and status. Trust this block as ground truth.
- NEVER suggest asking whether a party member who is currently alive and standing might be dead, missing, or "still out there." If the PARTY block says Aria is at 9/9 HP and alive, do NOT suggest "Ask if Aria is still alive." The DM's flowery prose may speak of a character in past or mystical tense — the PARTY block is authoritative.
- Only suggest mourning, searching for, or asking about the fate of party members who are actually DEAD or absent. If a member is Unconscious, "stabilize / heal / revive" suggestions are fine.

CRITICAL — SCENE-FIT:
- COMBAT: suggest attacks, tactical moves, spell use, helping allies, or escape. Do not suggest peaceful dialogue or idle exploration.
- SOCIAL/ROLEPLAY: suggest questions, persuasion, investigation, roleplay, or reading the situation. Do not suggest drawing weapons unless clearly warranted.
- EXPLORATION: suggest investigating the scene, interacting with objects, using skills, or preparing for danger.
- Never suggest something the DM just narrated as already done. Be specific to this scene, not generic.
- If HP is below 40%, include at least one option focused on survival or healing.

PRONOUN RULE — NON-NEGOTIABLE, APPLIES TO EVERY NAMED CHARACTER:
- The acting Character line AND every entry in the PARTY block include the character's pronouns in parentheses immediately after the name: (she/her), (he/him), or (they/them). These pronouns are CANONICAL — derived from the character's sex field in the database. They are not guesses.
- Whenever any suggestion refers to another character in the third person — by name, by class, or by description — you MUST use the pronouns shown in their PARTY entry.
- NEVER infer gender from a name. "Aria" might be he/him. "Thor" might be they/them. "Mira" might be he/him. The PARTY block is the only authority.
- NEVER infer gender from race or class. A male elf, a female dwarf, a non-binary monk — all are valid. The PARTY block tells you which.
- This rule applies to BOTH the acting character AND every other party member you mention. Suggestions like "Heal him" / "Pass her the potion" / "Ask them to flank" MUST match the listed pronouns.
- If you cannot recall a member's pronouns mid-suggestion, refer to them by name only (no third-person pronoun) rather than guessing.

CRITICAL SPELL RULE: Only suggest spells the character actually has. Non-spellcasters get zero spell suggestions.

CRITICAL SPELL-SLOT RULE: "Prepared spells" are LEVELED — each one costs a spell slot to cast. Cantrips are FREE and always castable. When the Character line shows "Spell slots remaining: 0", you MUST NOT suggest ANY prepared/leveled spell (e.g. Hellish Rebuke, Cure Wounds, Magic Missile, Healing Word) — suggest only cantrips, weapon attacks, movement, items, or skill uses. Never suggest a spell the character has no slot to cast.`,
      messages: [
        {
          role: "user",
          content: `${charLine}${partyLine}${enemyLine}\n\nDM's last message:\n"${dmResponse.slice(0, 1200)}"\n\nGenerate 4 action suggestions that make sense right now — consult the PARTY block before suggesting anything about other characters.`,
        },
      ],
    });

    const raw   = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) return Response.json({ suggestions: [] });

    let suggestions: string[];
    try {
      suggestions = JSON.parse(match[0]);
    } catch {
      return Response.json({ suggestions: [] });
    }

    const clean = suggestions
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 4);

    return Response.json({ suggestions: clean });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
