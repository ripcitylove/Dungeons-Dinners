import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic();

type PartyMemberCtx = {
  name: string;
  class?: string;
  race?: string;
  hp?: number;
  max_hp?: number;
  status_effects?: string[];
  isMe?: boolean;
};

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
      const pronouns = character.sex === "female" ? "she/her" : character.sex === "non-binary" ? "they/them" : "he/him";
      charLine = `Character: ${character.name} (${pronouns}), Level ${character.level ?? 1} ${character.race ?? ""} ${character.class ?? ""}. HP ${character.hp}/${character.max_hp} (${hpPct}%). ${weapons} ${cantrips} ${prepared}`.trim();
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
          return `  - ${p.name}${p.race || p.class ? ` (${[p.race, p.class].filter(Boolean).join(" ")})` : ""}: ${state}${status ? `, ${status}` : ""}`;
        }).join("\n");
        partyLine = `\n\nPARTY (other characters present in the scene):\n${aliveLines}`;
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

PRONOUN RULE: The character line includes pronouns in parentheses (she/her, he/him, they/them). Use those exact pronouns if you refer to the character in a suggestion. Never assume gender from a name or class.

CRITICAL SPELL RULE: Only suggest spells the character actually has. Non-spellcasters get zero spell suggestions.`,
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
