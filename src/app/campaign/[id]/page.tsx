"use client";

import React, { useState, useEffect, useRef, use, useCallback, useMemo } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import "../../globals.css";
import DiceRoller, { D20Icon } from "../../../components/DiceRoller";
import type { StateChange } from "../../api/chat-state/route";
import { getXpToNextLevel, SPELLCASTING_CLASSES, getSpellSlots, computeAC, CLASS_STAT_GUIDES, getTierStyle, CANTRIPS, LEVEL1_SPELLS, getSpellLevel, getClassSpellsAtLevel } from "../../../lib/spellData";
import {
  getItemByName, getAllCatalogItems, computeInventoryBonuses, getEffectiveStat, rollDiceFormula,
  buildItemEffectsSummary, RARITY_COLORS, RARITY_LABELS, ITEM_ICONS,
  type LootItem,
} from "../../../lib/lootData";
import { tipBox, tipBoxNode, TooltipPortal } from "../../../hooks/useTooltip";
import { MECHANIC_TIPS, ENEMY_CONDITION_TIPS, WEAPON_TIPS, ITEM_TIPS, resolveItemTip } from "../../../lib/tooltipData";
import { CLASS_RESOURCES, SHORT_REST_RESET_KEYS, getBardicInspirationDie, getSneakAttackDice, getWildShapeCR, getRageDamageBonus } from "../../../lib/classFeatures";
import { playAbilitySound, primeAbilitySounds, preloadWildShapeAudio, preloadAbilityAudio, playSpellSound, preloadSpellAudio, SPELL_META } from "../../../lib/classAbilitySounds";
import { resolveWildShapeForm, FALLBACK_BEAST_EMOJI, wildShapeImagePath } from "../../../lib/wildShapeForms";
import { STATUS_EFFECTS, parseStatusEffect, getDominantEffect, getCardEffectGlow } from "../../../lib/statusEffects";
import { parseHpTag, damageTagShouldBeSuppressed } from "../../../lib/damageRouting";
import { stripTrailingTurnPrompt } from "../../../lib/turnPrompt";

type MsgRole  = "dm" | "player" | "system";
type Message  = { role: MsgRole; content: string; sender?: string; imageUrl?: string };
type CampaignCharacterRow = {
  id: string; campaign_id: string; character_id: string; user_id: string | null;
  hp: number; max_hp: number; xp: number; level: number;
  inventory: Character["inventory"];
  spell_slots_used: Record<number, number>;
  class_resources: Record<string, number>;
  status_effects: string[];
  cantrips_known: string[];
  spells_prepared: string[];
};
type LogEntry = { id: string; timestamp: Date; role: MsgRole; sender?: string; content: string };
type DroppedItem   = { id: string; name: string; type: "item" | "weapon"; fromCharacter: string; fromUserId: string; meta?: NonNullable<Character["inventory"]["item_meta"]>[string] };

type Character = {
  id: string; user_id?: string; name: string; race: string; class: string; level: number;
  hp: number; max_hp: number; xp?: number;
  campaign_id?: string | null;
  party_active?: boolean;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  background?: string;
  title?: string;
  skill_proficiencies?: string[];
  portrait_url?: string | null;
  sex?: string;
  cantrips_known?: string[];
  spells_prepared?: string[];
  status_effects?: string[];
  spell_slots_used?: Record<number, number>;
  class_resources?: Record<string, number>;
  inventory: {
    gold: number; cp?: number; sp?: number; ep?: number; pp?: number;
    weapons: string[]; items: string[];
    // Per-item metadata for DM-awarded loot not in the static catalog.
    // Keyed by exact item/weapon name; populated by /api/item-details.
    item_meta?: Record<string, { description: string; value_gp?: number; rarity?: "common" | "uncommon" | "rare" | "very_rare" | "legendary"; type?: string }>;
  };
};

type EnemyCondition = "healthy" | "wounded" | "bloodied" | "critical" | "defeated";

type CampaignEnemy = {
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
  portrait_url?:  string;
  status_effects: string[];
  condition:      EnemyCondition;
  is_defeated:    boolean;
};

const CONDITION_COLORS: Record<EnemyCondition, string> = {
  healthy:  "#22c55e",
  wounded:  "#84cc16",
  bloodied: "#f59e0b",
  critical: "#ef4444",
  defeated: "#6b7280",
};
const CONDITION_LABELS: Record<EnemyCondition, string> = {
  healthy:  "Healthy",
  wounded:  "Wounded",
  bloodied: "Bloodied",
  critical: "Critical",
  defeated: "Defeated",
};
const CONDITION_PCT: Record<EnemyCondition, number> = {
  healthy:  100,
  wounded:  68,
  bloodied: 38,
  critical: 12,
  defeated: 0,
};

const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
};

const OPENING_MESSAGES: Message[] = [
  { role: "system", content: "Welcome, adventurer. Your journey begins..." },
];

// ── First-time chat hint arrow ────────────────────────────────────────────────
// A glowing green pointer that draws the player's eye to the hint banner.
// Renders via portal to escape the chat panel's overflow:hidden box.
// Disappears the instant `showChatHint` flips off (the "Got it" handler).
function ChatHintArrow({ show, hintRef }: { show: boolean; hintRef: React.RefObject<HTMLDivElement | null> }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!show) { setPos(null); return; }
    const el = hintRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      // Place the arrow tip ~16px to the left of the banner, vertically centered.
      // Arrow svg is 70x44 with the tip on the right edge.
      setPos({ top: r.top + r.height / 2 - 22, left: Math.max(8, r.left - 86) });
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const t = window.setInterval(measure, 800); // catch pane drags

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearInterval(t);
    };
  }, [show, hintRef]);

  if (!show || !pos || typeof window === "undefined") return null;

  return createPortal(
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 9997,
        pointerEvents: "none",
        animation: "hintArrowPulse 1.1s ease-in-out infinite",
      }}
    >
      <svg width="70" height="44" viewBox="0 0 70 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hintArrowFill" x1="0" y1="22" x2="70" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#16a34a"/>
            <stop offset="100%" stopColor="#4ade80"/>
          </linearGradient>
        </defs>
        {/* Arrow body: tail rectangle + triangular head, tip on right */}
        <path
          d="M 2 16 L 40 16 L 40 6 L 68 22 L 40 38 L 40 28 L 2 28 Z"
          fill="url(#hintArrowFill)"
          stroke="#bbf7d0"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    document.body
  );
}

function exportLog(entries: LogEntry[], campaignId: string) {
  const header = ["# Campaign Adventure Log", `Campaign: ${campaignId}`, `Exported: ${new Date().toLocaleString()}`, "", "---", ""].join("\n");
  const body   = entries.map(e => {
    const time = e.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const who  = e.role === "dm" ? "Dungeon Master" : e.role === "system" ? "Narrator" : (e.sender ?? "Player");
    return `**[${time}] ${who}**\n${e.content}`;
  }).join("\n\n");
  const blob = new Blob([header + body], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `adventure-log-${campaignId.slice(0, 8)}.md`; a.click();
  URL.revokeObjectURL(url);
}

const VOICES = [
  { id: "chronicler",  label: "Chronicler",  desc: "♂ British — warm, captivating storyteller"  },
  { id: "gravedigger", label: "Gravedigger", desc: "♂ Husky & dark — brooding menace"           },
  { id: "bard",        label: "Bard",        desc: "♀ British — velvety actress, theatrical"    },
  { id: "oracle",      label: "Oracle",      desc: "♀ British — clear & measured, otherworldly" },
  { id: "shade",       label: "Shade",       desc: "♂ Fierce warrior — raw & intense"           },
  { id: "sage",        label: "Sage",        desc: "♂ Wise & measured — aged counsel"           },
] as const;

const CAMPAIGN_TUTORIAL_STEPS = [
  {
    icon: "🐉",
    title: "Welcome to DnD Legends",
    body: "Your Dungeon Master is an AI. It writes the world, voices every NPC, runs enemy turns, hands out loot, and remembers what your party has done. There's no human DM — every player at the table plays a character.",
    tip: "You don't need to know D&D 5e rules. The DM handles all the math, dice modifiers, and rule lookups automatically.",
  },
  {
    icon: "💬",
    title: "Type Your Actions",
    body: "Read the DM's narration in the center panel, then describe what your character says or does in the input bar at the bottom. Be specific and in-character — vivid actions get vivid responses.",
    tip: "Try: \"I kick open the door and charge in with my warhammer raised, eyes locked on the captain\" instead of just \"I attack.\"",
    diagram: "chat" as const,
  },
  {
    icon: "⚔️",
    title: "Turns & The Party Panel",
    body: "In multiplayer, everyone takes turns. The party cards on the left show every adventurer — the card outlined in their class color and gently rising is the active player. Click any party card to view that character's full sheet on the right.",
    tip: "Solo? Your input is always active. The DM scales encounters to your party size automatically.",
    diagram: "party" as const,
  },
  {
    icon: "🎲",
    title: "Rolling Dice",
    body: "The dice button (next to the input bar) stays LOCKED until the DM calls for a roll — attacks, saves, skill checks. When it's time, the button glows gold and pulses. Click it, pick the die the DM asked for, and your result goes straight back to the story.",
    tip: "Critical hits, critical fumbles, and rolls under disadvantage all have their own animations and sound. The DM does all the math — you just submit the raw number on the die.",
    diagram: "dice" as const,
  },
  {
    icon: "📋",
    title: "Sheet, Party, Log & Combat",
    body: "The right sidebar has four tabs. CHARACTER is your sheet — stats, spells, inventory, HP. PARTY shows everyone's live stats and gold. LOG is the full transcript. COMBAT appears when enemies are present — click an enemy to target them.",
    tip: "Party leaders see an \"⊕ Invite Players\" panel at the bottom of the Party tab — invite anyone from your roster anytime you're out of combat.",
    diagram: "sheet" as const,
  },
  {
    icon: "🔊",
    title: "Narration & Atmosphere",
    body: "Toggle the 🔊 button at the top of the chat to enable AI voice narration — the DM speaks the story aloud in the voice you pick. The music player at bottom-right swaps between exploration, combat, and tavern tracks. Both feel great on a TV.",
    tip: "Playing on Xbox via MS Edge? Use the D-pad to navigate — focused buttons show a gold ring so you always know where you are.",
    diagram: "audio" as const,
  },
  {
    icon: "✨",
    title: "Your Adventure Begins",
    body: "Your characters keep their level, XP, gold, and gear across every campaign they join — they grow with the story. The DM remembers what you've done and calls back to it. Type your first action and the world responds.",
    tip: "Re-open this guide anytime with the ? button in the header.",
  },
] as const;

// ── Colored narrative — red for damage, green for healing, gold for roll math ──
const DAMAGE_RE = /\b\d+\s*(?:(?:slashing|piercing|bludgeoning|fire|cold|lightning|thunder|poison|acid|necrotic|radiant|psychic|force)\s+)?damage\b/gi;
const HEAL_RE   = /\b(?:regain[s]?|heal[s]?|restore[s]?|recover[s]?)\s+\d+\s*(?:hit\s*points?|hp)?\b|\b\d+\s*(?:hit\s*points?|hp)\s+(?:restored|recovered)\b/gi;
// Roll math: "12 + 5 = 17", "8 + 3 + 2 = 13", or parenthetical "(d20: 12 + STR: +3)"
const ROLL_RE   = /\b\d+(?:\s*[+\-]\s*\d+)+\s*=\s*\d+\b|\(\s*d(?:4|6|8|10|12|20):?\s*\d+[^)]{0,80}\)/gi;
// Bonus modifier labels like [STR], [Prof], [Spell ATK], [+3 sword]
const BONUS_LABEL_RE = /\[(?:STR|DEX|CON|INT|WIS|CHA|Prof|Spell ATK|Melee ATK|Ranged ATK|\+\d[^\]]*|-\d[^\]]*)\]/g;

function getBonusTooltip(label: string): { title: string; body: string; accent: string } | null {
  const inner = label.slice(1, -1).trim();
  if (inner === "STR")       return { title: "Strength Modifier",      body: "Added to melee attack rolls, melee damage, and Athletics checks.",                                                          accent: "#f59e0b" };
  if (inner === "DEX")       return { title: "Dexterity Modifier",     body: "Added to ranged/finesse attacks, initiative, Acrobatics, and Stealth.",                                                     accent: "#f59e0b" };
  if (inner === "CON")       return { title: "Constitution Modifier",  body: "Affects hit points and saving throws to maintain concentration on spells.",                                                  accent: "#f59e0b" };
  if (inner === "INT")       return { title: "Intelligence Modifier",  body: "Used for Arcana, History, Investigation, and Wizard spellcasting.",                                                          accent: "#f59e0b" };
  if (inner === "WIS")       return { title: "Wisdom Modifier",        body: "Used for Perception, Insight, Medicine, and Cleric/Druid/Ranger spellcasting.",                                             accent: "#f59e0b" };
  if (inner === "CHA")       return { title: "Charisma Modifier",      body: "Used for Persuasion, Deception, Performance, and Bard/Sorcerer/Warlock/Paladin spellcasting.",                              accent: "#f59e0b" };
  if (inner === "Prof")      return { title: "Proficiency Bonus",      body: "+2 at levels 1–4 · +3 at 5–8 · +4 at 9–12. Added to attack rolls, skill checks, and saves you are trained in.",            accent: "#22c55e" };
  if (inner === "Spell ATK") return { title: "Spell Attack Bonus",     body: "Spellcasting ability mod + proficiency bonus. Roll d20 + this value vs. target AC to land a spell attack.",                 accent: "#8b5cf6" };
  if (inner === "Melee ATK") return { title: "Melee Attack Bonus",     body: "STR modifier (or DEX for finesse weapons) + proficiency bonus. Added to melee weapon attack rolls.",                        accent: "#f59e0b" };
  if (inner === "Ranged ATK")return { title: "Ranged Attack Bonus",    body: "DEX modifier + proficiency bonus. Added to ranged weapon attack rolls.",                                                     accent: "#f59e0b" };
  const magic = inner.match(/^([+-]\d+)(?:\s+(.+))?$/);
  if (magic) {
    const mod = magic[1], item = magic[2] ?? "magic item";
    return { title: `${mod} Magic Bonus`, body: `Enchantment bonus from your ${item}. Adds ${mod} to both attack rolls and damage.`, accent: "#fbbf24" };
  }
  return null;
}

// parseHpTag + damageTagShouldBeSuppressed now live in ../../../lib/damageRouting
// (imported above) so the combat damage-routing logic can be unit-tested in
// isolation — see scripts/test-damage-routing.ts.

// Keep the Unconscious condition consistent with HP on the client-side fast HP
// paths. Those paths apply an [HP:Name:±N] tag immediately and set
// pendingHpDeltaRef, which makes the slow chat-state path skip the delta — so the
// slow path's Unconscious add/clear (HP>0 ⇒ conscious, HP==0-from-damage ⇒ down)
// never runs. This mirrors that same invariant. Returns the (possibly unchanged)
// status array; reference-equal to the input when nothing changed.
function reconcileUnconscious(statuses: string[], newHp: number, hpDelta: number): string[] {
  const has = statuses.includes("Unconscious");
  if (newHp > 0 && has) return statuses.filter(s => s !== "Unconscious");
  if (newHp === 0 && hpDelta < 0 && !has) return [...statuses, "Unconscious"];
  return statuses;
}

/** Parses [THP:FirstName:+N] tags from DM text. Returns the highest temp-HP grant
 *  seen for that character (D&D 5e: temp HP doesn't stack — keep the larger value). */
function parseThpTag(text: string, firstName: string): number {
  const n = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[THP:${n}:\\+?(\\d+)\\]`, "gi");
  let maxGrant = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) maxGrant = Math.max(maxGrant, parseInt(m[1], 10));
  return maxGrant;
}

/** Parses authoritative ECONOMY tags the DM emits inline (deterministic source
 *  of truth — no LLM extraction):
 *    [GOLD:+N] / [GOLD:-N] / [GOLD:FirstName:±N]   → gold_delta
 *    [LOOT:item] / [LOOT:FirstName:item]           → items_gained
 *    [WEAPON:item] / [WEAPON:FirstName:item]       → weapons_gained (weapons/armor/shields)
 *    [ITEM-LOST:item] / [ITEM-LOST:FirstName:item] → items_lost
 *    [XP:N]                                        → xp_award (explicit milestone XP)
 *  Returns the parsed values plus per-category flags so the chat-state extractor
 *  (now a fallback) can have its tagged categories overridden — the tag wins. */
type EconomyTags = {
  target_name: string | null;
  gold_delta: number;
  items_gained: string[];
  items_lost: string[];
  weapons_gained: string[];
  xp_award: number;
  goldTagged: boolean;
  lootTagged: boolean;
  xpTagged: boolean;
  any: boolean;
};
// Weapons / armor / shields routed into weapons_gained (so they're equippable),
// even when the DM mistakenly tags them [LOOT:..] or invents a name not in the
// static catalog. Matched as whole words, case-insensitive.
const WEAPON_ARMOR_RE = /\b(?:sword|longsword|shortsword|greatsword|broadsword|blade|dagger|dirk|rapier|scimitar|sabre|saber|falchion|katana|cutlass|axe|battleaxe|greataxe|handaxe|hatchet|mace|hammer|warhammer|maul|club|cudgel|flail|morningstar|spear|javelin|lance|pike|halberd|glaive|trident|quarterstaff|bow|longbow|shortbow|crossbow|sling|dart|whip|warpick|scythe|shield|buckler|armou?r|mail|chainmail|plate|breastplate|cuirass|brigandine|splint)\b/i;
// A loot string that is purely an amount of coin → convert to gp (game economy
// tracks gold only). Anchored to the whole string so "3 Gold Rings" or "Silver
// Ring" are NOT mistaken for currency.
const CURRENCY_LOOT_RE = /^\s*([\d,]+)\s*(copper|silver|gold|platinum|electrum|cp|sp|gp|pp|ep)(?:\s+(?:coins?|pieces?|bits?))?\s*$/i;
function currencyToGp(amount: number, denom: string): number {
  switch (denom.toLowerCase()) {
    case "copper": case "cp":    return Math.floor(amount / 100);
    case "silver": case "sp":    return Math.floor(amount / 10);
    case "electrum": case "ep":  return Math.floor(amount / 2);
    case "gold": case "gp":      return amount;
    case "platinum": case "pp":  return amount * 10;
    default:                     return 0;
  }
}
function parseEconomyTags(text: string): EconomyTags {
  const r: EconomyTags = {
    target_name: null, gold_delta: 0, items_gained: [], items_lost: [], weapons_gained: [],
    xp_award: 0, goldTagged: false, lootTagged: false, xpTagged: false, any: false,
  };
  // Optional "FirstName:" prefix = a SINGLE capitalised token followed by a colon.
  // Restricting to one token (no spaces) stops a multi-word or colon-containing
  // item name ([LOOT:Potion of Healing], [LOOT:Scroll of Fireball]) from being
  // mis-read as a recipient, while still catching [GOLD:Thorin:+14].
  const NAME = `(?:([A-Za-z][A-Za-z'\\-]*):)?`;
  let m: RegExpExecArray | null;
  const goldRe = new RegExp(`\\[GOLD:${NAME}([+-]?\\d+)\\]`, "gi");
  while ((m = goldRe.exec(text)) !== null) { r.gold_delta += parseInt(m[2], 10); if (m[1]) r.target_name = m[1].trim(); r.goldTagged = true; }
  const rawLoot: string[] = [];
  const lootRe = new RegExp(`\\[LOOT:${NAME}([^\\]]+)\\]`, "gi");
  while ((m = lootRe.exec(text)) !== null) { rawLoot.push(m[2].trim()); if (m[1]) r.target_name = m[1].trim(); r.lootTagged = true; }
  const wpnRe = new RegExp(`\\[WEAPON:${NAME}([^\\]]+)\\]`, "gi");
  while ((m = wpnRe.exec(text)) !== null) { r.weapons_gained.push(m[2].trim()); if (m[1]) r.target_name = m[1].trim(); r.lootTagged = true; }
  const lostRe = new RegExp(`\\[ITEM-?LOST:${NAME}([^\\]]+)\\]`, "gi");
  while ((m = lostRe.exec(text)) !== null) { r.items_lost.push(m[2].trim()); if (m[1]) r.target_name = m[1].trim(); r.lootTagged = true; }
  const xpRe = /\[XP:\+?(\d+)\]/gi;
  while ((m = xpRe.exec(text)) !== null) { r.xp_award += parseInt(m[1], 10); r.xpTagged = true; }

  // Normalise loot deterministically: coin → gold, weapons/armor → weapons_gained,
  // everything else stays a general item. Resolves DM tag-selection slips.
  for (const it of rawLoot) {
    const coin = it.match(CURRENCY_LOOT_RE);
    if (coin) { r.gold_delta += currencyToGp(parseInt(coin[1].replace(/,/g, ""), 10), coin[2]); r.goldTagged = true; continue; }
    if (WEAPON_ARMOR_RE.test(it)) { r.weapons_gained.push(it); continue; }
    r.items_gained.push(it);
  }

  r.any = r.goldTagged || r.lootTagged || r.xpTagged;
  return r;
}

/** Parses [WILDSHAPE:FirstName:Form] tags. Returns "revert" if the form is the
 *  literal string "revert" / "revert" / "human" (the druid is reverting), the
 *  beast name otherwise (e.g. "bear", "brown bear", "giant eagle"), or null if
 *  the tag isn't present for that character. The last tag in the text wins so a
 *  transform-then-revert sequence in one DM response settles on "revert". */
function parseWildShapeTag(text: string, firstName: string): string | null {
  const n = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[WILDSHAPE:${n}:([^\\]]+)\\]`, "gi");
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) last = m[1].trim();
  if (!last) return null;
  if (/^(revert|reverts?|human|natural|normal)$/i.test(last)) return "revert";
  return last;
}

/** Returns the last [RAGE:FirstName:on|off] verdict for that character, or null. */
function parseRageTag(text: string, firstName: string): "on" | "off" | null {
  const n = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[RAGE:${n}:(on|off|end|stop)\\]`, "gi");
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) last = m[1].toLowerCase();
  if (!last) return null;
  return last === "on" ? "on" : "off";
}

/** Returns the last [INSPIRED:FirstName:dX|off] verdict — either an "off" or the
 *  die size ("d6"/"d8"/"d10"/"d12"). Used to add/remove the Inspired buff on a
 *  recipient when the bard grants Bardic Inspiration. */
function parseInspiredTag(text: string, firstName: string): { off: true } | { die: string } | null {
  const n = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[INSPIRED:${n}:([^\\]]+)\\]`, "gi");
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) last = m[1].trim().toLowerCase();
  if (!last) return null;
  if (/^(off|end|expired|used|consumed|spent)$/i.test(last)) return { off: true };
  const dieMatch = last.match(/d(4|6|8|10|12|20)/);
  if (!dieMatch) return { die: "d6" };
  return { die: `d${dieMatch[1]}` };
}

/** Returns all [ABILITY:FirstName:key] keys narrated for that character in the
 *  given response, in narration order. Used to trigger sound + card flash for
 *  instant class abilities (second_wind, action_surge, cunning_action,
 *  channel_divinity, ki, lay_on_hands, sorcery_points, arcane_recovery,
 *  eldritch_invocations, pact_boon, sneak_attack, uncanny_dodge, evasion_rogue,
 *  paladin_channel). The DM emits one tag per invocation; we play feedback for
 *  each. */
function parseAbilityTags(text: string, firstName: string): string[] {
  const n = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[ABILITY:${n}:([a-z_]+)\\]`, "gi");
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) keys.push(m[1].toLowerCase());
  return keys;
}

/** Parses every [SPELL:Caster:spell_key] or [SPELL:Caster:spell_key:Target]
 *  tag in a DM response. Returns the (caster, spell_key, optional target)
 *  tuples in narration order. The engine plays the sound + flashes the
 *  appropriate card per spell. Caster is matched against the full text so
 *  the parser works regardless of which character we're scanning for. */
function parseSpellTags(text: string): Array<{ caster: string; key: string; target?: string }> {
  const re = /\[SPELL:([A-Za-z][A-Za-z'\- ]*?):([a-z_]+)(?::([A-Za-z][A-Za-z'\- ]*?))?\]/g;
  const out: Array<{ caster: string; key: string; target?: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ caster: m[1].trim(), key: m[2].toLowerCase(), target: m[3]?.trim() || undefined });
  }
  return out;
}

/** Returns the last [MARK:FirstName:on|off|target] verdict for a ranger applying
 *  or dropping Hunter's Mark. If a target name is given, it becomes the badge
 *  detail (e.g. "Hunter's Mark: Goblin"). */
function parseMarkTag(text: string, firstName: string): { off: true } | { target: string } | null {
  const n = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[MARK:${n}:([^\\]]+)\\]`, "gi");
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) last = m[1].trim();
  if (!last) return null;
  if (/^(off|end|cleared|dropped)$/i.test(last)) return { off: true };
  if (/^on$/i.test(last)) return { target: "" };
  return { target: last };
}

// Detect which player the DM is addressing at the end of a response.
// Returns the matching full name from partyNames, or null.
// Generic detector that finds ANY proper-noun addressee in a "what do you
// do?"-style DM prompt, returning the name regardless of party membership.
// Used by the resume audit to catch stale addressing where the DM ended its
// last narration asking a now-departed character what they do. The narrower
// `detectNextTurnPlayer` only matches names already in the party — it can't
// flag a departed character because their name is no longer in the list.
function detectDmAddressee(text: string): string | null {
  const tail = text.slice(-400);
  const actionPrompt = `what (?:\\w+ ){0,4}(?:do|will|would|shall|can|could) you|what(?:'s| is) your (?:action|move|next move)|which (?:\\w+ ){0,4}(?:do|will|would|shall) you|(?:do|would|will) you (?:like|want|wish|prefer|choose|pick|decide|select)|your (?:move|turn|action)|you(?:'re| are) up|how (?:do|will|would) you (?:respond|react|proceed)|(?:make|take) your (?:move|action|choice)|(?:the )?(?:choice|move|moment|decision|call) is yours|what now|(?:like|want) to (?:try|do|attempt)|try (?:something (?:else|different)|again|instead)`;
  // Patterns where a capitalized name appears next to an action-prompt phrase.
  // Group 1 captures the candidate name.
  const patterns: RegExp[] = [
    // "what do you do, Tiegan?"
    new RegExp(`(?:${actionPrompt})[^,?\\n]{0,30}[,?]\\s*([A-Z][a-zA-Z]+)\\b`, "gi"),
    // "Tiegan, what do you do?"
    new RegExp(`\\b([A-Z][a-zA-Z]+)\\b[,]?\\s*(?:${actionPrompt})`, "gi"),
    // "What does Tiegan do?" / "How does Tiegan respond?"
    new RegExp(`(?:what|how) (?:does|will|would|can|shall) ([A-Z][a-zA-Z]+)\\b[^?\\n]{0,80}\\?`, "gi"),
    // "Tiegan, what do they do?"
    new RegExp(`\\b([A-Z][a-zA-Z]+)\\b[,]?\\s+(?:what|how)[^?\\n]{0,80}\\?`, "gi"),
  ];
  // Common English words that are capitalized at sentence starts but aren't names.
  const COMMON_WORDS = new Set([
    "The", "A", "An", "You", "Your", "What", "How", "Why", "When", "Where", "Who", "Which", "Whose",
    "But", "And", "Or", "So", "Now", "Then", "Here", "There", "This", "That", "These", "Those",
    "I", "It", "He", "She", "They", "We", "Us", "Them", "Him", "Her", "Me",
    "Do", "Does", "Did", "Will", "Would", "Should", "Could", "Can", "Shall", "Must",
    "Is", "Are", "Was", "Were", "Be", "Been", "Being", "Have", "Has", "Had",
    "Roll", "Tell", "Show", "Make", "Take", "Choose", "Pick", "Decide", "Try", "Attempt",
    "Combat", "Initiative", "Stealth", "Perception",
  ]);
  let lastMatch: { idx: number; name: string } | null = null;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(tail)) !== null) {
      const name = m[1];
      if (!name) continue;
      if (COMMON_WORDS.has(name)) continue;
      if (name.length < 3) continue;
      if (!lastMatch || m.index > lastMatch.idx) lastMatch = { idx: m.index, name };
    }
  }
  return lastMatch?.name ?? null;
}

function detectNextTurnPlayer(text: string, partyNames: string[]): string | null {
  const tail = text.slice(-350);
  let lastMatch: { idx: number; name: string } | null = null;
  for (const fullName of partyNames) {
    const firstName = fullName.split(" ")[0];
    if (firstName.length < 2) continue;
    const esc = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Second-person: "[Name], what do you do?" / "What do you do, [Name]?"
    const actionPrompt = `what (?:\\w+ ){0,4}(?:do|will|would|shall|can|could) you|what(?:'s| is) your (?:action|move|next move)|which (?:\\w+ ){0,4}(?:do|will|would|shall) you|(?:do|would|will) you (?:like|want|wish|prefer|choose|pick|decide|select)|your (?:move|turn|action)|you(?:'re| are) up|how (?:do|will|would) you (?:respond|react|proceed)|(?:make|take) your (?:move|action|choice)|(?:the )?(?:choice|move|moment|decision|call) is yours|what now|(?:like|want) to (?:try|do|attempt)|try (?:something (?:else|different)|again|instead)`;
    const re = new RegExp(
      `\\b${esc}\\b[^\\n]{0,120}(?:${actionPrompt})` +
      `|(?:${actionPrompt})[^\\n]{0,120}\\b${esc}\\b`,
      "gi"
    );
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(tail)) !== null) {
      if (!lastMatch || m.index > lastMatch.idx) lastMatch = { idx: m.index, name: fullName };
    }
    // Third-person: "What does [Name] do?" / "How does [Name] respond?" / "[Name], what do they do?"
    // Also: "Does/Will/Is/Can/Should/Shall [Name] X?" — yes/no question directed at the player
    const thirdRe = new RegExp(
      `what (?:does|will|would|can|shall) \\b${esc}\\b[^?\\n]{0,80}\\?` +
      `|how (?:does|will|would|should) \\b${esc}\\b[^?\\n]{0,80}\\?` +
      `|\\b${esc}\\b[^?\\n]{0,60},?\\s+(?:what|how)[^?\\n]{0,80}\\?` +
      `|(?:does|will|is|are|can|should|would|shall)\\s+\\b${esc}\\b[^?\\n]{0,60}\\?`,
      "gi"
    );
    thirdRe.lastIndex = 0;
    while ((m = thirdRe.exec(tail)) !== null) {
      if (!lastMatch || m.index > lastMatch.idx) lastMatch = { idx: m.index, name: fullName };
    }
  }
  return lastMatch?.name ?? null;
}

// Fades in each chunk of text as it arrives during streaming
function StreamingText({ text }: { text: string }) {
  const [chunks, setChunks] = React.useState<Array<{ id: number; content: string }>>([]);
  const processedRef = React.useRef(0);
  const idRef        = React.useRef(0);

  React.useEffect(() => {
    if (text.length > processedRef.current) {
      const newContent = text.slice(processedRef.current);
      processedRef.current = text.length;
      setChunks(prev => [...prev, { id: idRef.current++, content: newContent }]);
    }
  }, [text]);

  return (
    <>
      {chunks.map(({ id, content }) => (
        <span key={id} style={{ animation: "streamFadeIn 0.62s ease forwards", opacity: 0, display: "inline" }}>
          {content}
        </span>
      ))}
    </>
  );
}

// Builds an array of sentence-end character positions for the given text.
// A "sentence end" is the index AFTER a sentence-terminating punctuation
// (. ! ? or trailing : or ; for clause-level pauses) that is followed by
// whitespace or end-of-text. The final entry is always text.length so the
// last (potentially un-punctuated) sentence completes when audio finishes.
function buildSentenceBoundaries(text: string): number[] {
  const ends: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (/[.!?]/.test(text[i])) {
      // Real boundary: at end of text OR followed by whitespace.
      if (i === text.length - 1 || /\s/.test(text[i + 1])) {
        ends.push(i + 1);
      }
    }
  }
  if (ends[ends.length - 1] !== text.length) ends.push(text.length);
  return ends;
}

// Returns the largest sentence-end position ≤ pos. Used to snap the
// audio-driven reveal back to the most recent COMPLETED sentence so we never
// expose mid-word fragments like "T|".
function snapDownToSentenceEnd(boundaries: number[], pos: number): number {
  let best = 0;
  for (const b of boundaries) {
    if (b <= pos) best = b;
    else break;
  }
  return best;
}

function RevealText({ text, isPaused, onComplete, intervalMs = 50, getAudioProgress }: {
  text: string;
  isPaused?: boolean;
  onComplete?: () => void;
  intervalMs?: number;
  // Optional getter that returns the narration's current audio progress (0–1).
  // When provided AND it returns a number, the reveal locks to the live audio
  // playback position — true 1:1 with the narrator's voice. When it returns
  // null/undefined (audio not playing, between slots, fallback to interval),
  // the component advances at intervalMs while not paused.
  getAudioProgress?: () => number | null;
}) {
  const [groups, setGroups] = React.useState<Array<{ id: number; chars: string }>>([]);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;
  const isPausedRef = React.useRef(isPaused ?? false);
  isPausedRef.current = isPaused ?? false;
  const getAudioProgressRef = React.useRef(getAudioProgress);
  getAudioProgressRef.current = getAudioProgress;

  React.useEffect(() => {
    setGroups([]);
    if (!text) return;
    const sentenceEnds = buildSentenceBoundaries(text);
    let pos = 0;
    let gid = 0;
    let done = false;
    let lastTickAt = performance.now();
    let intervalAccumMs = 0;
    let rafId = 0;

    const tick = () => {
      if (done) return;
      const now = performance.now();
      const delta = now - lastTickAt;
      lastTickAt = now;

      let targetPos = pos;
      const audioProgress = getAudioProgressRef.current?.();

      if (typeof audioProgress === "number") {
        // Audio-synced mode — compute raw target from audio progress, then
        // SNAP to the most recent completed sentence boundary so we never
        // show partial words (no "T|" stranded at the end of the reveal).
        // The reveal advances in sentence-sized chunks, each appearing the
        // moment its audio completes.
        const raw = Math.min(text.length, Math.round(audioProgress * text.length));
        targetPos = snapDownToSentenceEnd(sentenceEnds, raw);
        intervalAccumMs = 0;
      } else if (!isPausedRef.current) {
        // Interval fallback — used when no audio is playing. Per-char reveal
        // (existing behavior) is fine here because there's no voice to drift
        // out of sync with.
        intervalAccumMs += delta;
        while (intervalAccumMs >= intervalMs && targetPos < text.length) {
          intervalAccumMs -= intervalMs;
          targetPos++;
        }
      } else {
        intervalAccumMs = 0; // discard accumulated time while paused
      }

      if (targetPos > pos) {
        // Single group per tick — the whole new slice fades in together.
        // For sentence-snap that's a graceful sentence-sized reveal; for the
        // interval fallback it's still a tight 1-2 character chunk per frame.
        const chunk = text.slice(pos, targetPos);
        const groupId = gid++;
        pos = targetPos;
        setGroups(prev => [...prev, { id: groupId, chars: chunk }]);
      }

      if (pos >= text.length) {
        done = true;
        onCompleteRef.current?.();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [text, intervalMs]);

  const revealed = groups.reduce((s, g) => s + g.chars.length, 0);
  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {groups.map(({ id, chars }) => (
        <span key={id} style={{ animation: "revealCharFade 0.38s ease forwards", opacity: 0 }}>{chars}</span>
      ))}
      {revealed < text.length && (
        <span style={{ display: "inline-block", width: "2px", height: "0.9em", background: "rgba(139,92,246,0.8)", marginLeft: "1px", verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
      )}
    </span>
  );
}

type KnownItem = {
  name: string;
  color: string;
  tooltipNode: React.ReactNode;
};

function ColorizedText({ text, playerColors = {}, knownItems = [], onShowTooltip, onHideTooltip }: {
  text: string;
  playerColors?: Record<string, string>;
  knownItems?: KnownItem[];
  onShowTooltip?: (content: React.ReactNode, e: React.MouseEvent) => void;
  onHideTooltip?: () => void;
}) {
  type Seg = {
    start: number;
    end: number;
    color: string;
    tooltip?: string;
    richTooltip?: { title: string; body: string; accent: string };
    nodeTooltip?: React.ReactNode;
  };
  const segs: Seg[] = [];
  let m: RegExpExecArray | null;
  DAMAGE_RE.lastIndex = 0;
  while ((m = DAMAGE_RE.exec(text)) !== null) segs.push({ start: m.index, end: m.index + m[0].length, color: "#ef4444" });
  HEAL_RE.lastIndex = 0;
  while ((m = HEAL_RE.exec(text))   !== null) segs.push({ start: m.index, end: m.index + m[0].length, color: "#22c55e" });
  ROLL_RE.lastIndex = 0;
  while ((m = ROLL_RE.exec(text)) !== null) segs.push({ start: m.index, end: m.index + m[0].length, color: "#fbbf24", tooltip: `Roll breakdown: ${m[0].trim()}` });
  BONUS_LABEL_RE.lastIndex = 0;
  while ((m = BONUS_LABEL_RE.exec(text)) !== null) {
    const tt = getBonusTooltip(m[0]);
    if (tt) segs.push({ start: m.index, end: m.index + m[0].length, color: "#a78bfa", richTooltip: tt });
  }
  // Item mentions — catalog items + DM-awarded loot present in any party
  // member's inventory get tinted with their rarity color and a hover tooltip.
  // Sort by name length descending so longer matches win over shorter substrings
  // ("Ring of Protection" beats "Ring").
  const sortedItems = [...knownItems].sort((a, b) => b.name.length - a.name.length);
  for (const item of sortedItems) {
    if (!item.name.trim()) continue;
    const escaped = item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    let im: RegExpExecArray | null;
    while ((im = re.exec(text)) !== null) {
      segs.push({ start: im.index, end: im.index + im[0].length, color: item.color, nodeTooltip: item.tooltipNode });
    }
  }
  for (const [name, color] of Object.entries(playerColors)) {
    if (!name.trim()) continue;
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    while ((m = re.exec(text)) !== null) segs.push({ start: m.index, end: m.index + m[0].length, color });
  }
  segs.sort((a, b) => a.start - b.start);
  const out: React.ReactElement[] = [];
  let pos = 0;
  for (const seg of segs) {
    if (seg.start < pos) continue;
    if (seg.start > pos) out.push(<span key={pos}>{text.slice(pos, seg.start)}</span>);
    const hasInteraction = !!(seg.tooltip || seg.richTooltip || seg.nodeTooltip);
    const onEnter = seg.nodeTooltip && onShowTooltip
      ? (e: React.MouseEvent) => onShowTooltip(seg.nodeTooltip!, e)
      : seg.richTooltip && onShowTooltip
        ? (e: React.MouseEvent) => onShowTooltip(tipBox(seg.richTooltip!.title, seg.richTooltip!.body, seg.richTooltip!.accent), e)
        : undefined;
    const onLeave = (seg.nodeTooltip || seg.richTooltip) && onHideTooltip ? onHideTooltip : undefined;
    out.push(
      <span
        key={seg.start}
        title={(seg.nodeTooltip || seg.richTooltip) ? undefined : seg.tooltip}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{ color: seg.color, fontWeight: 600, ...(hasInteraction && { textDecoration: "underline dotted", cursor: "help" }) }}
      >
        {text.slice(seg.start, seg.end)}
      </span>
    );
    pos = seg.end;
  }
  if (pos < text.length) out.push(<span key={pos}>{text.slice(pos)}</span>);
  return <>{out}</>;
}

const CLASS_COLORS: Record<string, string> = {
  Fighter:   "#ef4444", Wizard:    "#3b82f6", Rogue:     "#94a3b8",
  Cleric:    "#f59e0b", Paladin:   "#fbbf24", Ranger:    "#22c55e",
  Bard:      "#ec4899", Warlock:   "#8b5cf6", Barbarian: "#f97316",
  Druid:     "#65a30d", Monk:      "#06b6d4", Sorcerer:  "#a855f7",
};

// Monotonic counter for collision-free React keys. `Date.now()` alone is not
// enough — two log entries created in the same millisecond (e.g. two rest
// presses, or a state-notice firing in the same tick as a DM response insert)
// will produce identical keys and trigger React's "two children with the same
// key" warning. The counter guarantees uniqueness regardless of how fast the
// callsite fires; the timestamp prefix keeps keys naturally ordered and
// readable in DevTools.
let _logIdCounter = 0;
function makeLogId(prefix: string): string {
  _logIdCounter = (_logIdCounter + 1) | 0;
  return `${prefix}-${Date.now()}-${_logIdCounter.toString(36)}`;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// Strip artifacts that would otherwise sound like the DM is having a stroke or
// "speaking in tongues" when read aloud by TTS:
//   • Bracketed system tokens ([HP:Aria:-9], [1d8+3], [STR], etc.)
//   • Asterisks (markdown bold/italic — TTS spells them out)
//   • Pictographic emoji — TTS vocalises them as nonsense syllables
//   • Zero-width / bidi / format chars and BOMs — vocalised as clicks/pauses
//   • C0 / C1 control characters — can crash the parser or emit noise bursts
//   • Anything else outside text, punctuation, digits, marks, whitespace
// Applied at every queue entry point so resume, streaming, and cached-replay
// paths all reach the network with the same clean text.
const _STRIP_EMOJI    = new RegExp("[\\u{1F000}-\\u{1FFFF}\\u{2600}-\\u{27BF}]", "gu");
const _STRIP_INVISIBLE = new RegExp("[\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]", "g");
const _STRIP_CONTROL  = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]", "g");
const _STRIP_NONTEXT  = new RegExp("[^\\p{L}\\p{N}\\p{P}\\p{Zs}\\p{M}\\n\\r\\t]", "gu");
function stripTtsArtifacts(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\*+/g, "")
    .replace(_STRIP_EMOJI, "")
    .replace(_STRIP_INVISIBLE, "")
    .replace(_STRIP_CONTROL, "")
    .replace(_STRIP_NONTEXT, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Pull as many TTS-ready chunks as possible from a streaming narration buffer.
// Returns the chunks plus the leftover buffer.
//
// Three failure modes this handles:
//   1. Multiple complete sentences in one chunk — loop until none match.
//   2. Smart/curly quotes after the sentence-ender (DM models love " " ' ') —
//      character class accepts them alongside straight quotes.
//   3. A genuinely long clause (DM writes a 600-char run-on or quotes block) —
//      force-split at the nearest clause boundary so no TTS clip exceeds the
//      45s watchdog limit. Worst-case forces a hard cut.
//
// When `isFinal=true` (end of stream), accept sentences without trailing
// whitespace and dump anything left over as a final fragment.
function pullNarrationChunks(buf: string, isFinal: boolean): { chunks: string[]; remaining: string } {
  const chunks: string[] = [];
  const MAX_CHUNK = 280;   // ~20s of speech — safely under the 45s watchdog
  const MIN_FORCED = 60;   // never force-split shorter than this
  // Quote characters allowed after a sentence-ender: straight ' " plus all curly variants
  const QUOTE_CLASS = "[\\u2018\\u2019\\u201C\\u201D'\"]";
  // Streaming match: 40+ chars then sentence-ender + optional quote + whitespace
  const SENT_RE_STREAM = new RegExp(`^([\\s\\S]{40,}?[.!?…]${QUOTE_CLASS}?)\\s+`);
  // Final match: shorter min, trailing whitespace OR end-of-buffer
  const SENT_RE_FINAL  = new RegExp(`^([\\s\\S]{8,}?[.!?…]${QUOTE_CLASS}?)(?:\\s+|$)`);

  while (true) {
    const m = buf.match(isFinal ? SENT_RE_FINAL : SENT_RE_STREAM);
    if (m) {
      chunks.push(m[1].trim());
      buf = buf.slice(m[0].length);
      continue;
    }
    // No sentence-ender found — force-split if the buffer has grown past MAX_CHUNK
    if (buf.length > MAX_CHUNK) {
      const slice = buf.slice(0, MAX_CHUNK);
      const boundary = Math.max(
        slice.lastIndexOf(", "),
        slice.lastIndexOf("; "),
        slice.lastIndexOf("— "),
        slice.lastIndexOf("– "),
      );
      if (boundary > MIN_FORCED) {
        chunks.push(buf.slice(0, boundary + 1).trim());
        buf = buf.slice(boundary + 2);
        continue;
      }
      const wsBoundary = slice.lastIndexOf(" ");
      if (wsBoundary > MIN_FORCED) {
        chunks.push(buf.slice(0, wsBoundary).trim());
        buf = buf.slice(wsBoundary + 1);
        continue;
      }
      // Last resort: hard cut at MAX_CHUNK
      chunks.push(buf.slice(0, MAX_CHUNK).trim());
      buf = buf.slice(MAX_CHUNK);
      continue;
    }
    break;
  }
  // At end of stream, anything still in the buffer is the final fragment
  if (isFinal && buf.trim().length > 0) {
    chunks.push(buf.trim());
    buf = "";
  }

  // Merge tiny chunks (< MIN_TTS_CHARS) with the next chunk. ElevenLabs given a
  // ~25-char fragment in isolation (e.g. `"Where did you get those?"`) rushes
  // the prosody and drops syllables — the resulting clip sounds like nonsense
  // or a foreign language. Concatenating short sentences with the next sentence
  // gives the model enough context to voice them naturally.
  //
  // The merge only fires when there IS a next chunk. The final chunk is left
  // untouched (even if short) — the alternative would be losing it entirely.
  const MIN_TTS_CHARS = 40;
  const merged: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let cur = chunks[i];
    // Merge forward — combined with subsequent chunks until length meets the floor
    while (cur.length < MIN_TTS_CHARS && i + 1 < chunks.length && cur.length + chunks[i + 1].length + 1 <= MAX_CHUNK) {
      cur = cur + " " + chunks[i + 1];
      i++;
    }
    merged.push(cur);
  }
  return { chunks: merged, remaining: buf };
}

const CLASS_EMOJI: Record<string, string> = {
  Fighter: "⚔️", Wizard: "🧙", Rogue: "🗡️", Cleric: "✝️", Paladin: "🛡️", Ranger: "🏹",
  Bard: "🎶", Warlock: "🔮", Barbarian: "🪓", Druid: "🌿", Monk: "👊", Sorcerer: "✨",
};

const CLASS_SAVES: Record<string, string[]> = {
  Barbarian: ["STR","CON"], Bard: ["DEX","CHA"], Cleric: ["WIS","CHA"],
  Druid: ["INT","WIS"], Fighter: ["STR","CON"], Monk: ["STR","DEX"],
  Paladin: ["WIS","CHA"], Ranger: ["STR","DEX"], Rogue: ["DEX","INT"],
  Sorcerer: ["CON","CHA"], Warlock: ["WIS","CHA"], Wizard: ["INT","WIS"],
};

// Status effect colors and descriptions live in src/lib/statusEffects.ts

// ── Component ──────────────────────────────────────────────────────────────────
export default function CampaignSession(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();

  // Core state
  const [messages,         setMessages]         = useState<Message[]>(OPENING_MESSAGES);
  const [logEntries,       setLogEntries]        = useState<LogEntry[]>([]);
  const [suggestions,      setSuggestions]       = useState<string[]>([]);
  const [streamingContent, setStreamingContent]  = useState("");
  const [input,            setInput]             = useState("");
  const [isTyping,         setIsTyping]          = useState(false);
  // Narration-synced reveal: text waits here until audio duration is known, then types at voice pace.
  // narRevealPaused holds the reveal during inter-slot audio gaps so typing stays 1:1 with the narrator.
  const [narRevealText,       setNarRevealText]       = useState<string | null>(null);
  const [narRevealIntervalMs, setNarRevealIntervalMs] = useState<number | null>(null);
  const [narRevealPaused,     setNarRevealPaused]     = useState(true);
  const [showDice,         setShowDice]          = useState(false);
  const [pendingDiceShow,  setPendingDiceShow]   = useState(false);
  const [isGroupCheckRoll, setIsGroupCheckRoll]  = useState(false);
  const [showChatHint,     setShowChatHint]      = useState(false);
  const [tutorialStep,     setTutorialStep]       = useState<number | null>(null);
  const [character,        setCharacter]         = useState<Character | null>(null);
  const [stateNotice,      setStateNotice]       = useState<string | null>(null);
  const [turnSkipBanner,   setTurnSkipBanner]    = useState<string | null>(null);
  const [userId,           setUserId]            = useState<string | null>(null);
  const [partyChangePending, setPartyChangePending] = useState(false);
  const [sidebarTab,       setSidebarTab]        = useState<"party" | "sheet" | "log" | "combat">("party");
  const [openSpellLevels,  setOpenSpellLevels]   = useState<number[]>([]); // expanded higher-level spell sections in the sheet
  const [enemies,          setEnemies]           = useState<CampaignEnemy[]>([]);
  const [combatActive,     setCombatActive]      = useState(false);

  // Narration
  const [narrationEnabled, setNarrationEnabled]  = useState(true);
  const [toastMsg,         setToastMsg]          = useState<string | null>(null);
  const [narrating,        setNarrating]         = useState(false);
  const [selectedVoice,    setSelectedVoice]     = useState<string>("bard");
  const [voicePickerOpen,  setVoicePickerOpen]   = useState(false);
  const [testingVoice,     setTestingVoice]      = useState<string | null>(null);
  const [narVolume,        setNarVolume]         = useState<number>(() => { try { const v = parseFloat(localStorage.getItem("dnd_nar_volume") ?? "1"); return isNaN(v) ? 1 : v; } catch { return 1; } });
  const [narMuted,         setNarMuted]          = useState<boolean>(() => { try { return localStorage.getItem("dnd_nar_muted") === "1"; } catch { return false; } });
  // Collapsed state for the Suggested Actions panel. Default to expanded.
  // Persisted to localStorage and hydrated client-side (the SSR-safe pattern —
  // reading localStorage inside the initializer would cause hydration mismatches).
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState<boolean>(false);
  useEffect(() => {
    try { setSuggestionsCollapsed(localStorage.getItem("dnd_suggestions_collapsed") === "1"); } catch { /* ignore */ }
  }, []);
  const toggleSuggestionsCollapsed = useCallback(() => {
    setSuggestionsCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("dnd_suggestions_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const narVolumeRef = useRef<number>(1);
  const narMutedRef  = useRef<boolean>(false);
  const selectedVoiceRef = useRef<string>("bard");
  const previewAudioRef  = useRef<HTMLAudioElement | null>(null);

  // ── Round tracking ────────────────────────────────────────────────────────────
  type RoundAction = { characterId: string; name: string; action: string };
  const [roundActions, setRoundActions] = useState<RoundAction[]>([]);
  const roundActionsRef           = useRef<RoundAction[]>([]);
  const pendingReconciliationRef  = useRef<{ messages: Message[]; summary: { name: string; action: string }[] } | null>(null);

  const VOICE_SAMPLES: Record<string, string> = {
    chronicler:  "In ages past, when shadow held dominion over these lands, a band of heroes arose — ordinary souls thrust into extraordinary peril. Their tale, your tale, begins tonight.",
    gravedigger: "Every soul finds its way to the earth, eventually. Some sooner than others. I have buried kings and beggars alike. The question is which you shall be.",
    bard:        "Oh, gather close, you magnificent fools! The tale I am about to spin will chill your bones, steal your breath, and leave you absolutely begging for more!",
    oracle:      "The threads of fate are rarely as they appear. What you seek lies not ahead of you, but within the choices already made — whether you know it or not.",
    shade:       "Three enemies. Two exits. One chance. You want to live? Stop thinking. Start moving. Every second you waste is a second they use against you.",
    sage:        "I have walked these roads for forty years, and I will tell you plainly what I know — courage is plentiful in youth. Wisdom is the rarer gift, and the harder earned.",
  };

  function testVoice(voiceId: string) {
    const el = previewAudioRef.current;
    if (el) { el.pause(); el.src = ""; }
    if (testingVoice === voiceId) { setTestingVoice(null); return; }

    setTestingVoice(voiceId);
    const text = VOICE_SAMPLES[voiceId] ?? VOICE_SAMPLES.chronicler;

    fetch("/api/narrate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text, voice: voiceId }),
    })
      .then(r => {
        if (!r.ok) { setToastMsg(`Voice unavailable (${r.status})`); return Promise.reject(r.status); }
        return r.json();
      })
      .then(({ audioUrl }: { audioUrl?: string }) => {
        const audio = previewAudioRef.current;
        if (!audioUrl || !audio) { setTestingVoice(null); return; }
        audio.src = audioUrl;
        audio.onended = () => { setTestingVoice(null); };
        audio.onerror = () => { setTestingVoice(null); };
        audio.oncanplaythrough = () => {
          audio.oncanplaythrough = null;
          audio.play().catch(() => setTestingVoice(null));
        };
        audio.load();
      })
      .catch((err: unknown) => {
        if (typeof err !== "number") setToastMsg(`Voice unavailable`);
        setTestingVoice(null);
      });
  }

  // Campaign party (characters linked to this campaign — always visible)
  const [campaignParty,    setCampaignParty]      = useState<Character[]>([]);
  const [activeCharIdx,    setActiveCharIdx]      = useState(0);

  // Session / turns
  const [sessionStarted,   setSessionStarted]    = useState(false);
  const [campaignLoading,  setCampaignLoading]   = useState(false);
  const [loadDmDone,       setLoadDmDone]        = useState(false);
  const [loadSceneDone,    setLoadSceneDone]     = useState(false);
  const [loadAmbianceDone, setLoadAmbianceDone]  = useState(false);
  const [loadFadingOut,    setLoadFadingOut]     = useState(false);
  const [openingRevealText,setOpeningRevealText] = useState<string | null>(null);
  const [turnOrder,        setTurnOrder]         = useState<string[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex]  = useState(0);

  // Campaign meta — pre-populate from sessionStorage when navigating from create-campaign
  const [campaignTitle, setCampaignTitle] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("pendingCampaignTitle");
    if (stored) { sessionStorage.removeItem("pendingCampaignTitle"); return stored; }
    return "";
  });
  const [campaignDescription, setCampaignDescription] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("pendingCampaignDescription");
    if (stored) { sessionStorage.removeItem("pendingCampaignDescription"); return stored; }
    return "";
  });
  const campaignDescriptionRef = useRef<string>("");

  // Scene
  const [currentSceneUrl,  setCurrentSceneUrl]   = useState<string | null>(null);
  const [sceneLoading,     setSceneLoading]       = useState(false);

  // Inventory exchange
  const [droppedItems,     setDroppedItems]       = useState<DroppedItem[]>([]);
  const [tradingItem,      setTradingItem]        = useState<{ name: string; slot: "item" | "weapon" } | null>(null);

  // Chat font size — persisted across sessions
  const [chatFontSize, setChatFontSize] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = parseFloat(localStorage.getItem("dnd_chat_font_size") ?? "");
      if (!isNaN(saved) && saved >= 0.65 && saved <= 1.35) return saved;
    }
    return 0.9;
  });

  // Resizable pane widths — persisted across sessions
  const [chatPaneWidth,    setChatPaneWidth]    = useState<number>(380);
  const [sidebarPaneWidth, setSidebarPaneWidth] = useState<number>(270);
  // Restore persisted widths after mount — must not run during SSR to avoid hydration mismatch
  useEffect(() => {
    const cv = parseInt(localStorage.getItem("dnd_chat_pane_w") ?? "");
    if (!isNaN(cv) && cv >= 280 && cv <= 700) setChatPaneWidth(cv);
    const sv = parseInt(localStorage.getItem("dnd_sidebar_pane_w") ?? "");
    if (!isNaN(sv) && sv >= 200 && sv <= 480) setSidebarPaneWidth(sv);
  }, []);
  const dragRef = useRef<{ which: "chat" | "sidebar"; startX: number; startW: number } | null>(null);

  const chatWidthRatio    = Math.max(0.85, Math.min(1.45, chatPaneWidth / 380));
  const sidebarWidthRatio = Math.max(0.85, Math.min(1.5,  sidebarPaneWidth / 270));
  // fs() scales sidebar fonts with A-/A+ control AND sidebar drag width
  const fs  = (base: number) => `${(base * chatFontSize / 0.9 * sidebarWidthRatio).toFixed(2)}rem`;
  // chatFontPx scales chat message text with A-/A+ control AND chat drag width
  const chatMsgSize = `${(chatFontSize * chatWidthRatio).toFixed(2)}rem`;

  // Memoized first-name → class color map for ColorizedText. Recomputes only when
  // party composition changes.
  const playerColorMap = useMemo(
    () => Object.fromEntries(campaignParty.map(c => [c.name.split(" ")[0], CLASS_COLORS[c.class] ?? "#94a3b8"])),
    [campaignParty],
  );

  // Items the DM might mention in narrative prose. Built from the static catalog
  // PLUS any DM-awarded loot already in a party member's inventory (so invented
  // items like "Mysterious Coin" still get a tooltip after they're awarded).
  // Each entry is { name, color, tooltipNode } — the renderer scans every DM
  // message for these names and applies a rarity-tinted underline + hover tooltip.
  const knownItemsForNarrative = useMemo<KnownItem[]>(() => {
    const items: KnownItem[] = [];
    const seen = new Set<string>();
    // 1. Static catalog — full rarity coloring + description + effect list
    for (const item of getAllCatalogItems()) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const rarityColor = RARITY_COLORS[item.rarity];
      const tooltipNode = tipBoxNode(
        item.name,
        <>
          <div style={{ color: rarityColor, fontSize: "0.85em", fontWeight: "bold", marginBottom: "4px" }}>
            {RARITY_LABELS[item.rarity]}
          </div>
          <div style={{ color: "#94a3b8", marginBottom: item.effects.some(fx => fx.description) ? "5px" : 0 }}>
            {item.description}
          </div>
          {item.effects.map((fx, fi) => fx.description && (
            <div key={fi} style={{ padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "2px", color: fx.description.startsWith("⚠️") ? "#ef4444" : "#c4b5fd", fontSize: "0.9em" }}>
              {fx.description}
            </div>
          ))}
          {item.requiresAttunement && <div style={{ color: "#64748b", fontSize: "0.85em", marginTop: "4px" }}>Requires Attunement</div>}
        </>,
        rarityColor,
      );
      items.push({ name: item.name, color: rarityColor, tooltipNode });
    }
    // 2. DM-awarded loot stored in party inventories (item_meta) — same rarity
    // treatment using the enriched description + gp value.
    const validRarities = new Set<LootItem["rarity"]>(["common", "uncommon", "rare", "very_rare", "legendary"]);
    for (const char of campaignParty) {
      const meta = char.inventory?.item_meta ?? {};
      for (const [name, info] of Object.entries(meta)) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const rarity = (validRarities.has(info.rarity as LootItem["rarity"]) ? info.rarity : "common") as LootItem["rarity"];
        const color = RARITY_COLORS[rarity];
        const tooltipNode = tipBoxNode(
          name,
          <>
            <div style={{ color, fontSize: "0.85em", fontWeight: "bold", marginBottom: "4px" }}>
              {RARITY_LABELS[rarity]}
            </div>
            <div style={{ color: "#94a3b8", marginBottom: (info.value_gp ?? 0) > 0 ? "5px" : 0 }}>
              {info.description || "An item awarded by the Dungeon Master."}
            </div>
            {(info.value_gp ?? 0) > 0 && (
              <div style={{ padding: "2px 6px", background: "rgba(251,191,36,0.08)", borderRadius: "4px", color: "#fbbf24", fontSize: "0.85em", fontWeight: "bold" }}>≈ {info.value_gp} gp</div>
            )}
          </>,
          color,
        );
        items.push({ name, color, tooltipNode });
      }
    }
    // 3. Weapons and adventuring items with canonical tooltipData entries.
    // No rarity color (use a neutral steel tone) but a real description.
    for (const [name, tip] of Object.entries(WEAPON_TIPS)) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ name, color: "#94a3b8", tooltipNode: tipBox(tip.title, tip.body, "#94a3b8") });
    }
    for (const [name, tip] of Object.entries(ITEM_TIPS)) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ name, color: "#94a3b8", tooltipNode: tipBox(tip.title, tip.body, "#94a3b8") });
    }
    return items;
  }, [campaignParty]);

  // Portrait lightbox
  const [portraitModal, setPortraitModal] = useState<{ name: string; cls: string; url: string; subtitle?: string } | null>(null);
  const [showBackstory, setShowBackstory] = useState(false);

  // Xbox controller B button (and keyboard Escape) — Save & Exit, NEVER delete.
  // Why: a player on Xbox pressed B inside a campaign and perceived it as the
  // campaign being deleted. Edge on Xbox maps controller B to a back/escape
  // intent, and any of: a focused destructive button, a Browser-Back to a
  // dashboard with a stale confirm modal, or just losing the session view, can
  // read as data loss. The campaign autosaves continuously via the chat +
  // character_sync channels, so the safe interpretation of B is: close any
  // open modal, otherwise return to the dashboard. The campaign row is never
  // touched — it stays in the dashboard list, fully resumable.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Modal-close priority: dismiss any open modal first instead of leaving
      // the campaign. Prevents B from skipping past a dialog the player is
      // actively interacting with.
      if (portraitModal) { setPortraitModal(null); e.preventDefault(); return; }
      if (showBackstory) { setShowBackstory(false); e.preventDefault(); return; }
      if (showDice)      { setShowDice(false);      e.preventDefault(); return; }
      if (showChatHint)  { setShowChatHint(false);  e.preventDefault(); return; }
      // No modal in the way — treat B / Escape as Save & Exit. Autosave has
      // already persisted everything; just navigate.
      e.preventDefault();
      router.push("/dashboard");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, portraitModal, showBackstory, showDice, showChatHint]);

  // Class-ability flash overlay — a brief colored pulse on the party card portrait
  // when ANY class ability is invoked. Key bumps each press so the CSS animation
  // re-fires on rapid repeated clicks.
  const [abilityFlash, setAbilityFlash] = useState<{ charId: string; color: string; key: number } | null>(null);
  const abilityFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerAbilityFlash = useCallback((charId: string, color: string) => {
    setAbilityFlash({ charId, color, key: Date.now() });
    if (abilityFlashTimerRef.current) clearTimeout(abilityFlashTimerRef.current);
    abilityFlashTimerRef.current = setTimeout(() => setAbilityFlash(null), 1200);
  }, []);

  // Spell visual effect on a target party card. Each invocation bumps `key` so
  // the CSS animation re-fires on rapid casts. The overlay element is rendered
  // on the affected character card and tinted with the spell's theme color.
  const [spellFlash, setSpellFlash] = useState<{ charId: string; anim: string; color: string; key: number } | null>(null);
  const spellFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerSpellFlash = useCallback((charId: string, anim: string, color: string) => {
    setSpellFlash({ charId, anim, color, key: Date.now() });
    if (spellFlashTimerRef.current) clearTimeout(spellFlashTimerRef.current);
    spellFlashTimerRef.current = setTimeout(() => setSpellFlash(null), 1600);
  }, []);

  // Card "shuffled-off-the-deck" turn-end animation. Plays for ~1.6s on the
  // character whose turn just ended. The animation is gated to a single card
  // at a time so multiple turn changes don't overlap.
  const [turnEndCardId, setTurnEndCardId] = useState<string | null>(null);
  const turnEndCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerTurnEndAnim = useCallback((charId: string) => {
    setTurnEndCardId(charId);
    if (turnEndCardTimerRef.current) clearTimeout(turnEndCardTimerRef.current);
    turnEndCardTimerRef.current = setTimeout(() => setTurnEndCardId(null), 1700);
  }, []);

  // Stat / currency tooltip hover
  const [hoveredStat,      setHoveredStat]        = useState<string | null>(null);
  const [hoveredCurrency,  setHoveredCurrency]    = useState<string | null>(null);

  // Item / status tooltip hover
  const [hoveredItem,      setHoveredItem]        = useState<string | null>(null);
  const [hoveredSpell,     setHoveredSpell]       = useState<string | null>(null);
  const [hoveredStatus,    setHoveredStatus]      = useState<string | null>(null);

  // Global tooltip portal — always renders above ALL elements regardless of stacking context
  const tooltipIdRef = useRef(0);
  const [globalTooltip, setGlobalTooltip] = useState<{ id: number; content: React.ReactNode; x: number; y: number } | null>(null);
  const showTooltip = useCallback((content: React.ReactNode, e: React.MouseEvent) => setGlobalTooltip({ id: ++tooltipIdRef.current, content, x: e.clientX, y: e.clientY }), []);
  const hideTooltip = useCallback(() => setGlobalTooltip(null), []);

  // Party management
  const [userRoster,       setUserRoster]         = useState<Character[]>([]);
  const [managePartyOpen,  setManagePartyOpen]    = useState(false);
  const [claimLeaderOpen,  setClaimLeaderOpen]    = useState(false);
  const [claimingLeaderId, setClaimingLeaderId]   = useState<string | null>(null);
  const [partyLeaderId,    setPartyLeaderId]       = useState<string | null>(null);
  // Tracks whether the current user owns the campaign (DB campaigns.user_id).
  // Used as a belt-and-suspenders gate for the Invite Players panel — the
  // owner ALWAYS sees the management UI even if partyLeaderId drifts out of
  // sync momentarily during a reclaim or character swap.
  const [isCampaignOwner, setIsCampaignOwner] = useState(false);

  // Dice-roll targeting — character name the DM just asked to roll
  const [diceRollTarget,      setDiceRollTarget]      = useState<string | null>(null);
  // Which die type the DM is requesting (4, 6, 8, 10, 12, 20, 100 — null = player's choice)
  const [requiredDiceType,    setRequiredDiceType]    = useState<number | null>(null);
  // Roll mode requested by DM (advantage/disadvantage/normal)
  const [requiredRollMode,    setRequiredRollMode]    = useState<"normal" | "advantage" | "disadvantage" | null>(null);
  // userId of the player the DM explicitly called on to roll — gates isMyTurn
  const [rollRequestedUserId, setRollRequestedUserId] = useState<string | null>(null);
  // Context sentence from the DM shown at the top of the dice screen
  const [diceRollContext,     setDiceRollContext]     = useState<string | null>(null);
  // Enemy targeting — which enemy the player is focusing on
  const [targetedEnemyId,   setTargetedEnemyId]   = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const msgContainerRef      = useRef<HTMLDivElement>(null);
  const chatHintRef          = useRef<HTMLDivElement>(null);
  const autoScrollRafRef     = useRef<number | null>(null);
  const narSlot0TextRef      = useRef<string | null>(null); // first narration sentence, used to compute speech rate
  const logEndRef            = useRef<HTMLDivElement>(null);
  const abortRef             = useRef<AbortController | null>(null);
  const characterRef         = useRef<Character | null>(null);
  const channelRef           = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef            = useRef<string | null>(null);
  const narAudioRef          = useRef<HTMLAudioElement | null>(null);
  const narWarmupRef         = useRef<HTMLAudioElement | null>(null);
  const audioPlayingRef      = useRef(false);
  const messagesRef          = useRef<Message[]>(OPENING_MESSAGES);
  const isTypingRef          = useRef(false);
  const narrationEnabledRef  = useRef(false);
  const turnOrderRef              = useRef<string[]>([]);
  const currentTurnIndexRef       = useRef(0);
  const restoredTurnStateRef      = useRef<{ order: string[]; index: number } | null>(null);
  const currentSceneRef        = useRef<string>("");
  const enemiesRef             = useRef<CampaignEnemy[]>([]);
  const rollRequestedUserIdRef     = useRef<string | null>(null);
  const isGroupCheckRollRef        = useRef(false);
  const dmFollowUpBlockAdvanceRef  = useRef(false); // set by sendToAI when DM asks same-player follow-up
  // Turn-sync hardening:
  // - turnBroadcastedThisCycleRef: ensures at most ONE turn_taken broadcast per
  //   handleSend cycle. The DM-routing branches inside sendToAI can each
  //   independently decide to advance/rewind the turn; without this flag they
  //   could each fire a broadcast and clients would apply them in network
  //   order, not send order.
  // - reconciliationGuardUntilRef: a short window after triggerReconciliation
  //   fires its round_reset + turn_taken(0). Any deferred turn_taken from a
  //   concurrent handleSend on another client (or our own re-entry) would
  //   clobber the reset; this ref lets the deferred branch see we just
  //   reconciled and bail.
  const turnBroadcastedThisCycleRef = useRef(false);
  const reconciliationGuardUntilRef = useRef(0);
  // Gates round_state_response adoption. We only honor a response while a
  // request is genuinely pending — once any other state-mutating event
  // (turn_taken, player_action, round_reset, swap) has already advanced our
  // view past the moment of request, a late response would clobber fresher
  // state. Cleared on first adopted response OR on any qualifying event OR
  // after a short timeout.
  const pendingStateRequestRef = useRef(false);
  // True iff the next persist-to-DB effect run was triggered by a LOCAL
  // change (handleSend's deferred advance, DM-routing branches, PATCH-mode
  // turn-order rebuild, etc.) rather than by a received broadcast. Without
  // this gate every client writes the campaigns row on every received
  // turn_taken — last-writer-wins with no ordering, so a slow client can
  // persist a stale value AFTER the fast one and corrupt the DB. With the
  // gate, only the originating client writes; receivers update local state
  // silently. The persist effect reads + clears this flag.
  const shouldPersistTurnRef = useRef(false);
  // Queue for turn_order_swap broadcasts whose order references a party
  // member we haven't yet observed locally. Without this, a self-heal swap
  // from a faster client (one whose campaignParty already includes the new
  // joiner) is silently rejected on slower clients, and the subsequent
  // turn_taken targets an index that doesn't exist in their order. Applied
  // when the missing member finally arrives via the campaignParty effect.
  const pendingTurnOrderSwapRef = useRef<{ newOrder: string[]; newIndex: number } | null>(null);
  const resumeNarrationRef        = useRef<string>("");
  // True once the resume-state reconciler has run this session — prevents the
  // recovery flow from re-firing on every state change (which would loop forever).
  const resumeLootReconciledRef   = useRef<boolean>(false);
  const resumeCurrentPlayerIdRef = useRef<string | null>(null);
  // True once this client has triggered a resume recap — prevents re-triggering
  // on the same page load (e.g. if the user re-clicks Begin Adventure or React
  // re-renders the resume branch). Multi-client races are mitigated by the
  // [RECAP] marker check on the last DM message.
  const resumeRecapTriggeredRef   = useRef(false);
  const autoOpenedRef             = useRef(false);
  // Ordered narration slot system — ensures sentences always play in the order they were sent
  const narSlotCounterRef    = useRef(0);
  const narSlotsRef          = useRef<(string | "SKIP" | null)[]>([]);
  const narSlotTextsRef      = useRef<string[]>([]); // original text per slot — used to regen truncated clips
  const narSlotRetriedRef    = useRef<boolean[]>([]); // tracks whether a slot was already regen'd to avoid loops
  const narPlaySlotRef       = useRef(0);
  // Currently-playing slot index, or -1 when no slot is actively sounding.
  // Used by the audio-synced text reveal to know which slot's audio time to
  // sample for 1:1 voice/text alignment.
  const narActiveSlotRef     = useRef(-1);
  const fetchClipForSlotRef  = useRef<((slot: number, text: string, fresh: boolean) => Promise<void>) | null>(null);
  // Incremented on every queue reset — lets in-flight ElevenLabs fetches detect they're stale
  // and skip writing to the (now-reused) slot array, preventing old audio from clobbering new.
  const narGenerationRef     = useRef(0);
  const campaignPartyRef     = useRef<Character[]>([]);
  const pendingSpellCastRef      = useRef<number>(0);
  const pendingSpellCastLevelRef = useRef<number>(0);
  const pendingHpDeltaRef        = useRef<number>(0);
  const prevActingCharIdRef      = useRef<string | null>(null);
  const sceneRequestIdRef    = useRef(0);
  const usesCCTableRef       = useRef(false);
  const charWriteRef         = useRef<((charId: string, fields: Record<string, unknown>) => Promise<void>) | null>(null);
  const skipTurnTimeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campaignLoadingRef      = useRef(false);
  const loadingTimeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enqueueNarrationRef     = useRef<((text: string) => void) | null>(null);
  const preloadResultRef        = useRef<{ dmText: string; sceneUrl: string | null; sceneName: string; sceneType?: string; modifiers?: string[] } | null>(null);
  const preloadPromiseRef       = useRef<Promise<void> | null>(null);
  const preloadAbortRef         = useRef<AbortController | null>(null);

  // ── Pane drag-resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      if (dragRef.current.which === "chat") {
        const w = Math.min(700, Math.max(280, dragRef.current.startW - delta));
        setChatPaneWidth(w);
        localStorage.setItem("dnd_chat_pane_w", String(w));
      } else {
        const w = Math.min(480, Math.max(200, dragRef.current.startW - delta));
        setSidebarPaneWidth(w);
        localStorage.setItem("dnd_sidebar_pane_w", String(w));
      }
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ── Campaign loading gate — waits for DM text, scene image, and ambiance ────
  useEffect(() => {
    if (!campaignLoading || loadFadingOut) return;
    if (!loadDmDone || !loadSceneDone || !loadAmbianceDone) return;
    if (loadingTimeoutRef.current) { clearTimeout(loadingTimeoutRef.current); loadingTimeoutRef.current = null; }
    setLoadFadingOut(true);
    const firstDm = messagesRef.current.find(m => m.role === "dm");
    setTimeout(() => {
      campaignLoadingRef.current = false;
      setCampaignLoading(false);
      setLoadFadingOut(false);
      setSessionStarted(true);
      if (firstDm) {
        setMessages(prev => { const i = prev.findIndex(m => m.role === "dm"); return i < 0 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)]; });
        setOpeningRevealText(firstDm.content);
        enqueueNarrationRef.current?.(firstDm.content);
      }
    }, 950);
  }, [campaignLoading, loadFadingOut, loadDmDone, loadSceneDone, loadAmbianceDone]);

  // ── Pre-load opening scene while "Your adventure awaits" is displayed ────────
  // Kicks off /api/chat + /api/detect-scene before the player clicks "Begin Adventure"
  // so the loading screen clears much faster.
  useEffect(() => {
    if (sessionStarted || campaignLoading) return;
    if (!userId || !character || !campaignParty.length) return;
    const isNew = !messagesRef.current.some(m => m.role === "dm" || m.role === "player");
    if (!isNew) return;
    if (preloadPromiseRef.current || preloadResultRef.current) return;

    const ctrl = new AbortController();
    preloadAbortRef.current = ctrl;

    preloadPromiseRef.current = (async () => {
      try {
        // Build same context sendToAI would use
        const char = characterRef.current;
        const party = campaignPartyRef.current;
        const inv = char?.inventory ?? { gold: 0, items: [], weapons: [] };
        const ib  = char ? computeInventoryBonuses(inv.items, inv.weapons) : null;
        const baseAC = char ? computeAC(char.class, char.dexterity, char.constitution, char.wisdom, inv.items, inv.weapons) : 0;
        const charForDM = char && ib ? {
          ...char,
          strength:     getEffectiveStat(char.strength,     "strength",     ib),
          dexterity:    getEffectiveStat(char.dexterity,    "dexterity",    ib),
          constitution: getEffectiveStat(char.constitution, "constitution", ib),
          intelligence: getEffectiveStat(char.intelligence, "intelligence", ib),
          wisdom:       getEffectiveStat(char.wisdom,       "wisdom",       ib),
          charisma:     getEffectiveStat(char.charisma,     "charisma",     ib),
          ac: baseAC + ib.acAdd,
          active_item_effects: ib.activeEffects.map(e => `${e.itemName}: ${e.text}`),
        } : null;
        const partyForDM = party.length > 1 ? party.map(c => {
          const ci = c.inventory ?? { gold: 0, items: [], weapons: [] };
          const cib = computeInventoryBonuses(ci.items, ci.weapons);
          const cAC = computeAC(c.class, c.dexterity, c.constitution, c.wisdom, ci.items, ci.weapons);
          return { ...c, ac: cAC + cib.acAdd, active_item_effects: cib.activeEffects.map(e => `${e.itemName}: ${e.text}`) };
        }) : undefined;
        const campaignCtx = campaignDescriptionRef.current
          ? { title: campaignTitle, description: campaignDescriptionRef.current } : undefined;
        const firstTurnName = [...party].sort((a, b) => a.name.localeCompare(b.name))[0]?.name ?? char?.name ?? null;
        const trigger: Message = { role: "player", content: "Begin our adventure.", sender: "" };

        // ── 1. DM opening narrative ──────────────────────────────────────────
        const chatRes = await fetch("/api/chat", {
          method: "POST", signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messagesRef.current, trigger],
            character: charForDM, party: partyForDM,
            campaignContext: campaignCtx,
            openingScene: true,
            ...(firstTurnName && { currentTurnPlayerName: firstTurnName }),
          }),
        });
        if (!chatRes.ok || !chatRes.body) return;
        const reader = chatRes.body.getReader();
        const dec = new TextDecoder();
        let dmText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          dmText += dec.decode(value, { stream: true });
        }
        if (!dmText || ctrl.signal.aborted) return;

        // ── 2. Scene image ───────────────────────────────────────────────────
        const partySnap = party.map(c => ({ name: c.name, race: c.race, class: c.class }));
        const sceneRes = await fetch("/api/detect-scene", {
          method: "POST", signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ narrative: dmText, party: partySnap, campaignDescription: campaignDescriptionRef.current }),
        });
        if (ctrl.signal.aborted) return;
        let sceneUrl: string | null = null;
        let sceneName = "";
        let sceneType: string | undefined;
        let sceneModifiers: string[] | undefined;
        let sceneDesc: string | undefined;
        if (sceneRes.ok) {
          const sd = await sceneRes.json() as { sceneName: string; imageUrl: string | null; sceneType?: string; modifiers?: string[]; description?: string };
          sceneUrl = sd.imageUrl;
          sceneName = sd.sceneName ?? "";
          sceneType = sd.sceneType;
          sceneModifiers = sd.modifiers;
          sceneDesc = sd.description;
        }

        if (!ctrl.signal.aborted) {
          preloadResultRef.current = { dmText, sceneUrl, sceneName, sceneType, modifiers: sceneModifiers };
        }
      } catch {
        // Pre-load failed silently — Begin Adventure will fall back to normal flow
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted, campaignLoading, userId, character?.id, campaignParty.length]);

  // ── Ref sync effects ─────────────────────────────────────────────────────────
  useEffect(() => { characterRef.current        = character;        }, [character]);
  useEffect(() => { campaignPartyRef.current    = campaignParty;    }, [campaignParty]);
  useEffect(() => { userIdRef.current           = userId;           }, [userId]);
  useEffect(() => { selectedVoiceRef.current    = selectedVoice;    }, [selectedVoice]);
  useEffect(() => { messagesRef.current         = messages;         }, [messages]);
  useEffect(() => { isTypingRef.current         = isTyping;         }, [isTyping]);
  useEffect(() => { narrationEnabledRef.current = narrationEnabled;  }, [narrationEnabled]);
  useEffect(() => { window.__dndDuckAudio?.(narrating); }, [narrating]);
  useEffect(() => {
    narVolumeRef.current = narVolume;
    if (narAudioRef.current) narAudioRef.current.volume = narMutedRef.current ? 0 : narVolume;
    localStorage.setItem("dnd_nar_volume", String(narVolume));
  }, [narVolume]);
  useEffect(() => {
    narMutedRef.current = narMuted;
    if (narAudioRef.current) narAudioRef.current.volume = narMuted ? 0 : narVolumeRef.current;
    localStorage.setItem("dnd_nar_muted", narMuted ? "1" : "0");
  }, [narMuted]);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 8000);
    return () => clearTimeout(t);
  }, [toastMsg]);
  useEffect(() => { turnOrderRef.current        = turnOrder;        }, [turnOrder]);
  useEffect(() => { currentTurnIndexRef.current = currentTurnIndex; }, [currentTurnIndex]);
  useEffect(() => { campaignDescriptionRef.current = campaignDescription; }, [campaignDescription]);
  useEffect(() => { enemiesRef.current             = enemies;             }, [enemies]);
  useEffect(() => { rollRequestedUserIdRef.current = rollRequestedUserId; }, [rollRequestedUserId]);
  useEffect(() => { isGroupCheckRollRef.current = isGroupCheckRoll; }, [isGroupCheckRoll]);
  useEffect(() => { roundActionsRef.current = roundActions; }, [roundActions]);

  // Keep party card focus locked to the current-turn player
  useEffect(() => {
    const id = turnOrder[currentTurnIndex] ?? null;
    if (!id || !campaignParty.length) return;
    const idx = campaignParty.findIndex(c => c.id === id);
    if (idx >= 0) setActiveCharIdx(idx);
  }, [currentTurnIndex, turnOrder, campaignParty]);


  // Persist turn state to DB whenever it changes so campaigns resume at the right position.
  // SINGLE-WRITER INVARIANT: only persist when the change originated locally
  // (shouldPersistTurnRef set true at the local mutation site). Broadcast
  // receivers update React state but leave the ref false, so they skip the
  // write. This prevents the last-writer-wins race where a slow client
  // overwrites a faster client's correct value with a stale one.
  useEffect(() => {
    if (!turnOrder.length || !params.id) return;
    if (!shouldPersistTurnRef.current) return;
    shouldPersistTurnRef.current = false;
    supabase.from("campaigns")
      .update({ turn_order: turnOrder, current_turn_index: currentTurnIndex })
      .eq("id", params.id)
      .then(() => {});
  }, [turnOrder, currentTurnIndex, params.id]);

  // ── Per-campaign state write helper ──────────────────────────────────────────
  // Routes to campaign_characters when using the CC table, otherwise characters.
  // Fields that belong to the CHARACTER, not the campaign — they persist globally
  // so the same character at level 5 in campaign A remains level 5 in campaign B,
  // and XP earned in one campaign continues their progression in another.
  const GLOBAL_CHAR_FIELDS = useMemo(() => new Set([
    "level", "xp", "max_hp", "title", "portrait_url", "name",
    "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
  ]), []);

  const charWrite = useCallback(async (charId: string, fields: Record<string, unknown>) => {
    const globalFields: Record<string, unknown> = {};
    const sessionFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (GLOBAL_CHAR_FIELDS.has(k)) globalFields[k] = v;
      else sessionFields[k] = v;
    }
    // Global character properties always write to the characters table so they
    // remain tethered to the character regardless of which campaign they're in.
    if (Object.keys(globalFields).length > 0) {
      await supabase.from("characters").update(globalFields).eq("id", charId);
    }
    // Per-campaign session state — HP, inventory, spell slots, status effects,
    // class_resources — goes to whichever table this campaign uses.
    if (Object.keys(sessionFields).length > 0) {
      if (usesCCTableRef.current) {
        await supabase.from("campaign_characters").update(sessionFields).eq("campaign_id", params.id).eq("character_id", charId);
      } else {
        await supabase.from("characters").update(sessionFields).eq("id", charId);
      }
    }
  }, [params.id, GLOBAL_CHAR_FIELDS]);
  useEffect(() => { charWriteRef.current = charWrite; }, [charWrite]);

  // Turn-end card animation — when currentTurnIndex changes, the character
  // who JUST finished their turn gets the "shuffled-off-the-deck" spin. The
  // previous turn-holder is captured via a ref so the effect doesn't fire on
  // initial mount or party rebuilds.
  const prevTurnCharIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (turnOrder.length <= 1) { prevTurnCharIdRef.current = turnOrder[0] ?? null; return; }
    const newTurnCharId = turnOrder[currentTurnIndex] ?? null;
    const prevTurnCharId = prevTurnCharIdRef.current;
    if (prevTurnCharId && prevTurnCharId !== newTurnCharId) {
      triggerTurnEndAnim(prevTurnCharId);
    }
    prevTurnCharIdRef.current = newTurnCharId;
  }, [currentTurnIndex, turnOrder, triggerTurnEndAnim]);

  // Build a compact body for /api/suggest-actions that includes the rest of the
  // party (name + HP + status) and any live enemies. Without this context the
  // suggester sees only the DM's prose, so when the DM says "Ekko gave it
  // something real tonight" the model can mis-suggest "Ask if Ekko is still
  // alive" even though Ekko is standing right there at full HP.
  const buildSuggestActionsBody = useCallback((dmResponse: string, char: Character | null) => {
    const partyCtx = campaignPartyRef.current.map(c => ({
      name: c.name,
      class: c.class,
      race: c.race,
      // CRITICAL: include sex so the API can derive pronouns. Without this
      // the suggestion engine guesses pronouns from name/class and gets
      // them wrong — a critical immersion bug that the user reported
      // explicitly. See /api/suggest-actions/route.ts where pronouns are
      // baked into the party block from sex.
      sex: c.sex,
      hp: c.hp,
      max_hp: c.max_hp,
      status_effects: c.status_effects ?? [],
      isMe: char ? c.id === char.id : false,
    }));
    const enemiesCtx = enemiesRef.current
      .filter(e => !e.is_defeated)
      .map(e => ({ name: e.name, condition: e.condition, is_defeated: e.is_defeated }));
    return {
      dmResponse,
      character: char,
      party: partyCtx,
      enemies: enemiesCtx,
    };
  }, []);

  // Tutorial is triggered inline by the campaign loader once it has confirmed
  // the campaign has no prior gameplay history (see the "New campaign" branch
  // below). Resumes of an in-progress campaign never show the tutorial.

  // Build turn order from campaign party. Three modes:
  //  1. RESTORE (first run): use DB-saved order + index from restoredTurnStateRef.
  //  2. PATCH (subsequent runs with prior order present): preserve the
  //     in-flight order, append new joiners, drop removed members, and keep
  //     the index pointing at the SAME character. Critical for mid-session
  //     joins — previously the effect fell through to alphabetical and reset
  //     the index to 0, which on Tiegan's client could land the turn on
  //     Pookie (or vice versa) the moment Pookie joined, and then the DM-
  //     routing logic for the next message would compute against a freshly-
  //     shuffled order, sometimes leaving the named player without a routable
  //     index. Symptom: DM addresses Pookie, system stays on Tiegan.
  //  3. COLD (no prior order, no restore): alphabetical, index 0.
  useEffect(() => {
    if (!campaignParty.length) return;
    const partyIds = new Set(campaignParty.map(c => c.id));
    // Replay a queued turn_order_swap if its missing ids are now all present.
    // The self-heal swap from a faster client could not be applied earlier
    // because we hadn't yet seen the new member — now we have.
    const queued = pendingTurnOrderSwapRef.current;
    if (queued && queued.newOrder.every(id => partyIds.has(id))) {
      pendingTurnOrderSwapRef.current = null;
      turnOrderRef.current = queued.newOrder;
      setTurnOrder(queued.newOrder);
      setCurrentTurnIndex(queued.newIndex);
      currentTurnIndexRef.current = queued.newIndex;
      // Receiver-driven replay — do NOT mark persist; originator already did.
      const activePartyIdx = campaignParty.findIndex(c => c.id === queued.newOrder[queued.newIndex]);
      if (activePartyIdx >= 0) setActiveCharIdx(activePartyIdx);
      return;
    }
    const restored = restoredTurnStateRef.current;
    let finalOrder: string[];
    let finalIndex: number;
    if (restored) {
      restoredTurnStateRef.current = null;
      const validOrder = restored.order.filter(id => partyIds.has(id));
      // Add any party members missing from the saved order (e.g. new joiners)
      campaignParty.forEach(c => { if (!validOrder.includes(c.id)) validOrder.push(c.id); });
      finalOrder = validOrder;
      finalIndex = Math.min(restored.index, validOrder.length - 1);
      // Track whose turn it is so Begin Adventure can sync the DM to that player
      resumeCurrentPlayerIdRef.current = validOrder[finalIndex] ?? null;
      // RESTORE-vs-swap reconciliation: if a turn_order_swap arrived BEFORE
      // this effect first ran, turnOrderRef may already hold a different
      // (newer) order. Detect the divergence and re-fire round_state_request
      // so peers can resync us — DB might be stale relative to in-flight
      // realtime events.
      const priorOrder = turnOrderRef.current;
      const priorMatchesRestored =
        priorOrder.length === finalOrder.length &&
        priorOrder.every((id, i) => id === finalOrder[i]);
      if (priorOrder.length > 0 && !priorMatchesRestored && userIdRef.current && channelRef.current) {
        pendingStateRequestRef.current = true;
        setTimeout(() => { pendingStateRequestRef.current = false; }, 2500);
        channelRef.current.send({
          type: "broadcast",
          event: "round_state_request",
          payload: { fromUserId: userIdRef.current },
        });
      }
    } else if (turnOrderRef.current.length > 0) {
      // PATCH MODE — keep the in-flight order; only add joiners and remove
      // departed members. The active character's slot must survive the patch
      // so the DM-routing logic sees a stable index.
      const currentTurnCharId = turnOrderRef.current[currentTurnIndexRef.current] ?? null;
      const filteredOrder = turnOrderRef.current.filter(id => partyIds.has(id));
      campaignParty.forEach(c => { if (!filteredOrder.includes(c.id)) filteredOrder.push(c.id); });
      finalOrder = filteredOrder;
      const preservedIdx = currentTurnCharId ? filteredOrder.indexOf(currentTurnCharId) : -1;
      finalIndex = preservedIdx >= 0
        ? preservedIdx
        : Math.min(currentTurnIndexRef.current, Math.max(0, filteredOrder.length - 1));
    } else {
      finalOrder = [...campaignParty].sort((a, b) => a.name.localeCompare(b.name)).map(c => c.id);
      finalIndex = 0;
    }
    turnOrderRef.current = finalOrder;
    setTurnOrder(finalOrder);
    setCurrentTurnIndex(finalIndex);
    currentTurnIndexRef.current = finalIndex;
    // Local mutation — persist it. (Receivers of turn_taken/turn_order_swap
    // skip this flag and so don't write to DB; only the originating client
    // does. Prevents last-writer-wins races on the campaigns row.)
    shouldPersistTurnRef.current = true;
    // Sync the "Acting" highlight to the current turn player
    const activePartyIdx = campaignParty.findIndex(c => c.id === finalOrder[finalIndex]);
    if (activePartyIdx >= 0) setActiveCharIdx(activePartyIdx);
    // Suggestions are handled by the unified suggestion guarantee effect below
  }, [campaignParty.length]);

  // `character` is the local user's IDENTITY for action submission and game logic.
  // It must follow the actual turn order — NEVER follow card clicks, otherwise clicking
  // another player's card to view their sheet swaps the user's identity and the next
  // action (including dice rolls) gets attributed to the wrong character. That caused
  // the "DM skips Shmang for no reason" bug — Shmang would silently be added to
  // roundActions when the user submitted anything after viewing Shmang's card.
  useEffect(() => {
    if (campaignParty.length === 0) return;
    let c: Character | undefined;
    if (turnOrder.length > 1) {
      // Multiplayer / hotseat — the user plays whoever has the current turn.
      const turnCharId = turnOrder[currentTurnIndex];
      c = campaignParty.find(ch => ch.id === turnCharId);
    } else {
      // Solo play — there's only one character to play as.
      c = campaignParty[0];
    }
    if (c && c.id !== characterRef.current?.id) {
      setCharacter(c);
      characterRef.current = c;
    }
  }, [currentTurnIndex, turnOrder, campaignParty]);

  // ── Empty-party reclaim prompt ───────────────────────────────────────────────
  // If a campaign loads with zero characters in the party, the owner must seat
  // someone from their roster BEFORE the resume / opening begins — otherwise a
  // random character would be auto-assigned. The modal opens during the
  // pre-start screen and blocks the Begin Adventure flow until a leader is
  // chosen. Non-owners are kicked to /dashboard at load, so reaching this
  // effect already implies ownership.
  useEffect(() => {
    if (!userId) return;
    // Wait until BOTH the party and roster have been read from the DB.
    // userRoster is set inside the campaign loader after the auth check, so
    // gating on userId guarantees we're past the auth pause but not yet past
    // the data read (campaignParty starts empty and stays empty for an empty
    // campaign — that's the case we want to catch).
    if (campaignParty.length === 0 && userRoster.length > 0) {
      setClaimLeaderOpen(true);
    } else {
      setClaimLeaderOpen(false);
    }
  }, [userId, campaignParty.length, userRoster.length]);

  // ── Load user, character, history ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { await supabase.auth.signOut(); router.push("/auth"); return; }
      setUserId(user.id);
      if (!sessionStorage.getItem(`chatHint_${params.id}`)) setShowChatHint(true);

      const [charRes, historyRes, partyRes, campRes, enemiesRes, ccRes] = await Promise.all([
        // Load ALL of the current user's characters (no limit — used for roster + active char)
        supabase.from("characters").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("campaign_messages").select("role, content, sender, created_at").eq("campaign_id", params.id).order("created_at", { ascending: true }),
        // Fetch all characters in this campaign; filter party_active in JS so the
        // query never fails if the column is NULL or the migration hasn't run yet.
        supabase.from("characters").select("*").eq("campaign_id", params.id).order("created_at"),
        supabase.from("campaigns").select("*").eq("id", params.id).single(),
        supabase.from("campaign_enemies").select("*").eq("campaign_id", params.id).eq("is_defeated", false).order("created_at"),
        // Campaign-specific character state (null-safe — empty if table doesn't exist yet)
        supabase.from("campaign_characters").select("*").eq("campaign_id", params.id),
      ]);

      // Capture ownership flag once so the Invite Players panel can stay
      // permanently visible to the owner regardless of partyLeaderId drift.
      setIsCampaignOwner(!!campRes.data?.user_id && campRes.data.user_id === user.id);

      if (campRes.data?.title) setCampaignTitle(campRes.data.title);
      if (campRes.data?.description) {
        setCampaignDescription(campRes.data.description);
        campaignDescriptionRef.current = campRes.data.description;
      }
      const loadedLeaderCharId = (campRes.data as { party_leader_id?: string } | null)?.party_leader_id ?? null;
      setPartyLeaderId(loadedLeaderCharId);
      if (campRes.error) console.error("[campaign] title fetch:", campRes.error.message);

      // Stash DB-persisted turn state — applied by the campaignParty.length effect once the party loads
      const savedOrder = (campRes.data as { turn_order?: string[] } | null)?.turn_order;
      const savedIndex = (campRes.data as { current_turn_index?: number } | null)?.current_turn_index ?? 0;
      if (savedOrder?.length) restoredTurnStateRef.current = { order: savedOrder, index: savedIndex };

      // Load any active enemies (e.g. campaign resumed mid-combat)
      if (enemiesRes.data?.length) {
        const active = enemiesRes.data as CampaignEnemy[];
        setEnemies(active);
        enemiesRef.current = active;
        setCombatActive(true);
      }

      if (partyRes.error) console.error("[campaign] party fetch:", partyRes.error.message);

      // Roster = all user characters
      if (charRes.data) setUserRoster(charRes.data as Character[]);

      // Merge campaign-specific state onto party if CC table rows exist
      const ccRows = (ccRes.data ?? []) as CampaignCharacterRow[];
      if (ccRows.length > 0) usesCCTableRef.current = true;

      const rawParty = (partyRes.data ?? []) as Character[];
      const party = ccRows.length > 0
        ? rawParty.map(char => {
            const cc = ccRows.find(r => r.character_id === char.id);
            if (!cc) return char;
            // level / xp / max_hp / ability scores stay on the global characters
            // table (rawParty) — they are properties of the character, not the
            // campaign. The CC table contributes per-session state only.
            return {
              ...char,
              hp: cc.hp,
              inventory: cc.inventory, spell_slots_used: cc.spell_slots_used,
              class_resources: cc.class_resources ?? {},
              status_effects: cc.status_effects, cantrips_known: cc.cantrips_known,
              spells_prepared: cc.spells_prepared,
            };
          })
        : rawParty;

      // Gate access: only campaign owner may enter
      const isOwner = campRes.data?.user_id === user.id;
      if (!isOwner) { router.push("/dashboard"); return; }

      if (party.length) {
        // Clamp HP to effective max (base + item bonuses) — never raw max_hp alone.
        // Also clear a STALE Unconscious condition from anyone at HP > 0: older
        // fast-HP paths bumped HP without clearing it, so a healed-above-0 player
        // could persist as Unconscious. Enforces the HP>0 ⇒ conscious invariant on
        // load and self-heals any already-corrupted rows.
        const normalizedParty = party.map(c => {
          const ib = computeInventoryBonuses(c.inventory?.items ?? [], c.inventory?.weapons ?? []);
          const effectiveMax = c.max_hp + ib.hpMaxAdd;
          const clampedHp = c.hp > effectiveMax ? effectiveMax : c.hp;
          const statuses = c.status_effects ?? [];
          const fixedStatuses = clampedHp > 0 && statuses.includes("Unconscious")
            ? statuses.filter(s => s !== "Unconscious")
            : statuses;
          if (clampedHp === c.hp && fixedStatuses === statuses) return c;
          return { ...c, hp: clampedHp, status_effects: fixedStatuses };
        });
        if (normalizedParty.some((c, i) => c.hp !== party[i].hp || c.status_effects !== party[i].status_effects)) {
          normalizedParty.forEach((c, i) => {
            const orig = party[i];
            const hpChanged = c.hp !== orig.hp;
            const statusChanged = c.status_effects !== orig.status_effects;
            if (!hpChanged && !statusChanged) return;
            const patch = { ...(hpChanged && { hp: c.hp }), ...(statusChanged && { status_effects: c.status_effects }) };
            if (usesCCTableRef.current) {
              supabase.from("campaign_characters").update(patch).eq("campaign_id", params.id).eq("character_id", c.id).then(() => {});
            } else {
              supabase.from("characters").update(patch).eq("id", c.id).then(() => {});
            }
          });
        }
        const fixedParty = normalizedParty;
        setCampaignParty(fixedParty);
        campaignPartyRef.current = fixedParty;
        // Set active character to the first party member
        const myChar = fixedParty[0] ?? (charRes.data?.[0] as Character | undefined);
        if (myChar) { setCharacter(myChar); characterRef.current = myChar; }
        setActiveCharIdx(0);

        // Auto-assign or auto-CORRECT party leader. Two cases trigger a write:
        //   (a) No party_leader_id set yet (fresh campaign).
        //   (b) party_leader_id is STALE — points to a character no longer in
        //       the party (departed, deleted, replaced via empty-party reclaim
        //       in an older client that didn't reset the leader column).
        // Only the campaign owner performs the write so concurrent clients
        // don't race each other.
        const leaderInParty = !!loadedLeaderCharId && party.some(c => c.id === loadedLeaderCharId);
        if ((!loadedLeaderCharId || !leaderInParty) && user.id === campRes.data?.user_id) {
          const firstCharId = party[0].id;
          if (loadedLeaderCharId && !leaderInParty) {
            console.warn(`[campaign] stale party_leader_id (${loadedLeaderCharId}) — auto-correcting to ${firstCharId}`);
          }
          supabase.from("campaigns").update({ party_leader_id: firstCharId }).eq("id", params.id).then(() => {});
          setPartyLeaderId(firstCharId);
        }
      } else if (charRes.data?.[0]) {
        setCharacter(charRes.data[0] as Character);
      }

      // Trigger portrait generation for any party characters missing one
      const myPartyChars = party.filter(c => !c.portrait_url);
      if (myPartyChars.length > 0) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          myPartyChars.forEach(c => {
            fetch("/api/generate-portrait", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
              body: JSON.stringify({ race: c.race, cls: c.class, sex: c.sex ?? "male", charId: c.id }),
            }).catch(() => {});
          });
        });
      }

      if (historyRes.data && historyRes.data.length > 0) {
        const hist = historyRes.data as (Message & { created_at?: string })[];
        setMessages([...OPENING_MESSAGES, ...hist]);
        setLogEntries(hist.map((m, i) => ({
          id: `hist-${i}`, timestamp: m.created_at ? new Date(m.created_at) : new Date(),
          role: m.role, sender: m.sender, content: m.content,
        })));
        const lastDm = [...hist].reverse().find(m => m.role === "dm");
        if (lastDm) {
          resumeNarrationRef.current = lastDm.content;
          // Suggestions are generated after turn order is restored (see turn-order useEffect)
          // Restore the scene image — detect-scene hits its DB cache so this is fast.
          // Use the last DM message with real scene description (>30 chars) — guards against
          // "Roll a d20." being the most recent message and causing a wrong scene classification.
          const sceneNarrative = ([...hist].reverse().find(m => m.role === "dm" && m.content.trim().length > 30) ?? lastDm).content;
          const loadSceneReqId = ++sceneRequestIdRef.current;
          fetch("/api/detect-scene", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ narrative: sceneNarrative, currentScene: "", campaignDescription: campaignDescriptionRef.current }),
          })
            .then(r => r.json())
            .then(({ sceneName, imageUrl, sceneType, modifiers, description }: { sceneName: string; imageUrl: string | null; sceneType?: string; modifiers?: string[]; description?: string }) => {
              if (sceneRequestIdRef.current !== loadSceneReqId) return; // superseded by a newer request
              if (imageUrl) { currentSceneRef.current = sceneName; setCurrentSceneUrl(imageUrl); (window as Window).__dndSetMusicScene?.(sceneName, sceneType, modifiers); }
              if (sceneName && sceneType) {
                (window as Window).__dndSetAmbianceScene?.(sceneName, sceneType, modifiers);
              }
            })
            .catch(() => {});
        }
      } else {
        // New campaign — DM will narrate the opening scene when the session starts.
        // Trigger the tutorial only for brand-new campaigns (no prior gameplay).
        // Returning to a campaign with history skips the tutorial entirely.
        // The per-campaign localStorage flag still suppresses the tutorial if
        // the player explicitly clicked "Skip" before any gameplay happened.
        setMessages(OPENING_MESSAGES);
        const skipped = localStorage.getItem(`dnd_campaign_tutorial_done_${params.id}`);
        if (!skipped) setTimeout(() => setTutorialStep(0), 1400);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // ── Live portrait push — fires when generate-portrait writes portrait_url ──────
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("campaign-portrait-updates")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "characters",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as Partial<Character> & { id: string };
        if (!updated.portrait_url) return;
        const url = updated.portrait_url;
        setCharacter(prev => prev?.id === updated.id ? { ...prev, portrait_url: url } : prev);
        setCampaignParty(prev => prev.map(c => c.id === updated.id ? { ...c, portrait_url: url } : c));
        setUserRoster(prev => prev.map(c => c.id === updated.id ? { ...c, portrait_url: url } : c));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // ── Realtime ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !character) return;

    const channel = supabase.channel(`campaign:${params.id}`);

    channel
      .on("broadcast", { event: "leader_changed" }, ({ payload }) => {
        setPartyLeaderId(payload.newLeaderId as string);
      })
      .on("broadcast", { event: "player_action" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        setMessages(prev => [...prev, { role: "player", content: payload.content, sender: payload.characterName }]);
        setLogEntries(prev => [...prev, { id: makeLogId("rt"), timestamp: new Date(), role: "player", sender: payload.characterName, content: payload.content }]);
        // Track this player's action for round reconciliation (skip questions — they don't consume turns)
        // Guard: only record if the broadcast has BOTH a character ID and non-empty action text.
        // An empty/whitespace action could otherwise cause reconciliation to include a player who
        // didn't actually act, prompting the DM to fabricate their action.
        const broadcastAction = ((payload.content as string) ?? "").trim();
        if (payload.characterId && !payload.isQuestion && broadcastAction.length > 0 && !roundActionsRef.current.some(a => a.characterId === payload.characterId)) {
          const updated: RoundAction[] = [...roundActionsRef.current, { characterId: payload.characterId as string, name: (payload.characterName as string) ?? "Unknown", action: broadcastAction }];
          roundActionsRef.current = updated;
          setRoundActions(updated);
          // A live action just changed our roundActions — any pending state
          // request is now stale relative to what we just observed.
          pendingStateRequestRef.current = false;
        }
      })
      // End-of-round double-prompt fix: the originator stripped a trailing
      // turn-prompt from the round-completing message. Apply the same edit to
      // this peer's transcript + log so the duplicate prompt disappears here too.
      .on("broadcast", { event: "dm_message_edit" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        const oldC = payload.oldContent as string, newC = payload.newContent as string;
        if (!oldC || newC === undefined) return;
        setMessages(prev => prev.map(m => (m.role === "dm" && m.content === oldC) ? { ...m, content: newC } : m));
        setLogEntries(prev => prev.map(e => (e.role === "dm" && e.content === oldC) ? { ...e, content: newC } : e));
      })
      .on("broadcast", { event: "dm_response" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        // Skip empty broadcasts — these occur when the sender suppressed a degenerate response
        if (!(payload.content as string)?.trim()) return;
        // A DM response implies a turn move just happened on the originator;
        // any in-flight round_state_response we receive AFTER this is stale.
        pendingStateRequestRef.current = false;
        setIsTyping(false); setStreamingContent("");
        setMessages(prev => [...prev, { role: "dm", content: payload.content }]);
        setLogEntries(prev => [...prev, { id: makeLogId("rt"), timestamp: new Date(), role: "dm", content: payload.content }]);
        const dmDieType  = detectRequiredDiceType(payload.content as string);
        const rollTarget = dmDieType !== null ? detectDiceRollTarget(payload.content as string) : null;
        const dmRollMode = rollTarget ? detectRollMode(payload.content as string) : "normal";
        setDiceRollTarget(rollTarget);
        setRequiredDiceType(dmDieType);
        setRequiredRollMode(dmRollMode !== "normal" ? dmRollMode : null);
        // Proactively clear roll state for non-roll responses; roll_request broadcast confirms it
        if (!rollTarget && dmDieType === null) {
          setRollRequestedUserId(null);
          rollRequestedUserIdRef.current = null;
        }
        // Restore the acting character so applyStateChange can gate correctly
        prevActingCharIdRef.current = (payload.actingCharId as string | null) ?? null;
        // Fast HP detection — apply HP change to this player's own character immediately.
        if (pendingHpDeltaRef.current === 0) {
          const myChar = characterRef.current;
          if (myChar) {
            const firstName = myChar.name.split(" ")[0];
            const hpDelta = parseHpTag(payload.content as string, firstName);
            // Damage-direction guard: reject the tag when the narrative shows
            // this player as the ATTACKER. Without this, an Aria-deals-9-to-the-
            // goblin event with a mis-emitted [HP:Aria:-9] would silently
            // subtract 9 from Aria's own pool.
            if (hpDelta !== 0 && damageTagShouldBeSuppressed(payload.content as string, firstName, hpDelta)) {
              console.warn(`[fast HP] Suppressed [HP:${firstName}:${hpDelta}] — narrative shows ${firstName} as attacker, not receiver`);
              // Mark as consumed so the chat-state route's hp_delta is also skipped.
              pendingHpDeltaRef.current = hpDelta;
            } else if (hpDelta !== 0) {
              const ib = computeInventoryBonuses(myChar.inventory?.items ?? [], myChar.inventory?.weapons ?? []);
              const fastTempHp0 = myChar.class_resources?.temp_hp ?? 0;
              let fastTempHp = fastTempHp0;
              let fastDelta  = hpDelta;
              if (hpDelta < 0 && fastTempHp > 0) {
                const dmg = Math.abs(hpDelta); const absorbed = Math.min(fastTempHp, dmg);
                fastTempHp = fastTempHp - absorbed; fastDelta = -(dmg - absorbed);
              }
              const newHp = Math.max(0, Math.min(myChar.max_hp + ib.hpMaxAdd, myChar.hp + fastDelta));
              const fastRes = fastTempHp !== fastTempHp0 ? { ...(myChar.class_resources ?? {}), temp_hp: fastTempHp } : (myChar.class_resources ?? {});
              const baseStatuses = myChar.status_effects ?? [];
              const newStatuses  = reconcileUnconscious(baseStatuses, newHp, fastDelta);
              const statusChanged = newStatuses !== baseStatuses;
              const fastChar = { ...myChar, hp: newHp, class_resources: fastRes, ...(statusChanged && { status_effects: newStatuses }) };
              setCharacter(fastChar);
              setCampaignParty(prev => prev.map(c => c.id === myChar.id ? { ...c, hp: newHp, class_resources: fastRes, ...(statusChanged && { status_effects: newStatuses }) } : c));
              characterRef.current = fastChar;
              campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === myChar.id ? { ...c, hp: newHp, class_resources: fastRes, ...(statusChanged && { status_effects: newStatuses }) } : c);
              pendingHpDeltaRef.current = hpDelta;
              charWriteRef.current?.(myChar.id, { hp: newHp, ...(fastTempHp !== fastTempHp0 && { class_resources: fastRes }), ...(statusChanged && { status_effects: newStatuses }) });
              channelRef.current?.send({ type: "broadcast", event: "character_sync", payload: { charId: myChar.id, hp: newHp, ...(fastTempHp !== fastTempHp0 && { class_resources: fastRes }), ...(statusChanged && { status_effects: newStatuses }) } });
            }
          }
        }
        // roll_request broadcast syncs the turn — no need to re-derive userId here
        // Deterministic economy tags (primary) + chat-state extractor (fallback).
        applyDmStateFromNarrative(payload.content as string);
        // Focus the party panel on the character whose turn the DM just announced
        if (campaignPartyRef.current.length > 1) {
          const turnCharId = turnOrderRef.current[currentTurnIndexRef.current];
          const turnPartyIdx = campaignPartyRef.current.findIndex(c => c.id === turnCharId);
          if (turnPartyIdx >= 0) setActiveCharIdx(turnPartyIdx);
        }
        // Generate suggestions for this player if it's now their turn
        const order = turnOrderRef.current;
        const isMyTurnNow = order.length <= 1 || order[currentTurnIndexRef.current] === characterRef.current?.id;
        if (isMyTurnNow && characterRef.current) {
          fetch("/api/suggest-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildSuggestActionsBody(payload.content as string, characterRef.current)) })
            .then(r => r.json()).then(({ suggestions: s }) => setSuggestions(s ?? [])).catch(() => {});
        }
      })
      .on("broadcast", { event: "dm_typing" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        setIsTyping(payload.typing as boolean);
        if (!payload.typing) setStreamingContent("");
      })
      .on("broadcast", { event: "turn_taken" }, ({ payload }) => {
        if (payload.userId === userIdRef.current) return;
        const newIdx = payload.newIndex;
        // Receiver-side validation: a stale, malformed, or out-of-order
        // broadcast can carry an index that no longer fits the local
        // turnOrder (e.g. an earlier turn_taken arriving after a turn_order_swap
        // shrank the order). Setting an out-of-range index freezes the UI on
        // an undefined character — drop the message instead.
        if (typeof newIdx !== "number" || !Number.isInteger(newIdx)) return;
        if (newIdx < 0 || newIdx >= turnOrderRef.current.length) return;
        // Our view is now fresher than any in-flight round_state_response.
        pendingStateRequestRef.current = false;
        setCurrentTurnIndex(newIdx);
        currentTurnIndexRef.current = newIdx;
        // Focus the party panel on the newly active character
        if (campaignPartyRef.current.length > 1) {
          const turnCharId = turnOrderRef.current[newIdx];
          const turnPartyIdx = campaignPartyRef.current.findIndex(c => c.id === turnCharId);
          if (turnPartyIdx >= 0) setActiveCharIdx(turnPartyIdx);
        }
        // Generate suggestions if the turn just landed on this player
        const order = turnOrderRef.current;
        const isNowMyTurn = order.length <= 1 || order[newIdx] === characterRef.current?.id;
        if (isNowMyTurn && characterRef.current) {
          const lastDmMsg = [...messagesRef.current].reverse().find(m => m.role === "dm");
          if (lastDmMsg) {
            fetch("/api/suggest-actions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildSuggestActionsBody(lastDmMsg.content, characterRef.current)),
            }).then(r => r.json()).then(({ suggestions: s }) => setSuggestions(s ?? [])).catch(() => {});
          }
        }
      })
      .on("broadcast", { event: "turn_order_swap" }, ({ payload }) => {
        if (payload.userId === userIdRef.current) return;
        const newOrder = payload.newOrder as string[];
        const newIndex = payload.newIndex as number;
        // Receiver-side validation: reject malformed orders or out-of-range
        // indices. Same rationale as turn_taken — a stale swap could otherwise
        // strand the local turn pointer on an undefined char id.
        if (!Array.isArray(newOrder) || newOrder.length === 0) return;
        if (typeof newIndex !== "number" || !Number.isInteger(newIndex)) return;
        if (newIndex < 0 || newIndex >= newOrder.length) return;
        // Foreign-id check. If the sender's party already includes someone
        // we haven't observed yet (a join race — common with the self-heal
        // turn_order_swap from sendToAI's DM-named branch), we cannot
        // immediately apply the swap. Queue it instead and let the
        // campaignParty effect replay it when the missing id finally arrives.
        // Without this, the self-heal swap is silently dropped on slower
        // clients and the subsequent turn_taken targets an out-of-range index
        // that also gets dropped — net effect, peers stay on the old turn.
        const partyIds = new Set(campaignPartyRef.current.map(c => c.id));
        if (partyIds.size > 0 && !newOrder.every(id => partyIds.has(id))) {
          pendingTurnOrderSwapRef.current = { newOrder, newIndex };
          return;
        }
        pendingStateRequestRef.current = false;
        turnOrderRef.current = newOrder;
        setTurnOrder(newOrder);
        setCurrentTurnIndex(newIndex);
        currentTurnIndexRef.current = newIndex;
        if (campaignPartyRef.current.length > 1) {
          const turnCharId = newOrder[newIndex];
          const turnPartyIdx = campaignPartyRef.current.findIndex(c => c.id === turnCharId);
          if (turnPartyIdx >= 0) setActiveCharIdx(turnPartyIdx);
        }
      })
      .on("broadcast", { event: "roll_request" }, ({ payload }) => {
        if ((payload as { userId: string | null }).userId === userIdRef.current) return;
        const uid = (payload as { userId: string | null }).userId ?? null;
        setRollRequestedUserId(uid);
        rollRequestedUserIdRef.current = uid;
      })
      .on("broadcast", { event: "round_reset" }, () => {
        roundActionsRef.current = [];
        setRoundActions([]);
        pendingStateRequestRef.current = false;
        // Mirror the reconciliation guard window on the receiver side.
        // Without this, only the originating client knew a reset just happened
        // — every other client's deferred-advance branch would happily compute
        // findNextUnactedIdx against the freshly-emptied roundActionsRef and
        // broadcast turn_taken(next), clobbering the turn_taken(0) the
        // originator just sent. The guard must be set on every client that
        // observes a reset, not just the one that triggered it.
        reconciliationGuardUntilRef.current = Date.now() + 1500;
      })
      // Mid-round state sync — a joining/refreshing client asks peers for the
      // current view of roundActions + currentTurnIndex. Without this, a tab
      // refresh during an active round leaves the rejoiner with an empty
      // roundActionsRef, and the very next turn-advance they compute lands on
      // a player who already acted (since the rejoiner doesn't know).
      .on("broadcast", { event: "round_state_request" }, ({ payload }) => {
        const fromUserId = (payload as { fromUserId?: string }).fromUserId;
        if (!fromUserId || fromUserId === userIdRef.current) return;
        // Only respond if we have meaningful state to share — otherwise we'd
        // race other peers' responses with an empty answer.
        if (roundActionsRef.current.length === 0 && turnOrderRef.current.length <= 1) return;
        channelRef.current?.send({
          type: "broadcast",
          event: "round_state_response",
          payload: {
            toUserId:         fromUserId,
            roundActions:     roundActionsRef.current,
            currentTurnIndex: currentTurnIndexRef.current,
            turnOrder:        turnOrderRef.current,
          },
        });
      })
      .on("broadcast", { event: "round_state_response" }, ({ payload }) => {
        const p = payload as { toUserId?: string; roundActions?: RoundAction[]; currentTurnIndex?: number; turnOrder?: string[] };
        if (p.toUserId !== userIdRef.current) return;
        // Only adopt while a request is still genuinely pending. If a
        // turn_taken / player_action / round_reset / turn_order_swap landed
        // since we asked, our local view is fresher than this response and
        // adopting it would roll us BACKWARDS to the responder's snapshot.
        if (!pendingStateRequestRef.current) return;
        // Single-shot: clear the flag so a second peer's late response can't
        // also overwrite us.
        pendingStateRequestRef.current = false;
        // Only accept if we still have no local round state. Defense in depth
        // with the pendingStateRequestRef check above.
        if (roundActionsRef.current.length > 0) return;
        if (Array.isArray(p.roundActions) && p.roundActions.length > 0) {
          roundActionsRef.current = p.roundActions;
          setRoundActions(p.roundActions);
        }
        // Adopt peer's turnOrder too — without this we could end up agreeing
        // on the same index value but having different orders, so the index
        // resolves to a different character on each client. Validate against
        // local party first; reject if a foreign id slipped in.
        const responderOrder = Array.isArray(p.turnOrder) ? p.turnOrder : null;
        const partyIds = new Set(campaignPartyRef.current.map(c => c.id));
        const orderValid = responderOrder
          && responderOrder.length > 0
          && responderOrder.every(id => typeof id === "string" && partyIds.has(id));
        if (orderValid && responderOrder) {
          turnOrderRef.current = responderOrder;
          setTurnOrder(responderOrder);
        }
        // Adopt peer's turn index — must be in-range against the (now
        // possibly updated) turnOrderRef.
        if (typeof p.currentTurnIndex === "number"
            && Number.isInteger(p.currentTurnIndex)
            && p.currentTurnIndex >= 0
            && p.currentTurnIndex < turnOrderRef.current.length) {
          setCurrentTurnIndex(p.currentTurnIndex);
          currentTurnIndexRef.current = p.currentTurnIndex;
        }
      })
      .on("broadcast", { event: "character_hp_update" }, ({ payload }) => {
        // Legacy event — still handled for sessions in-flight from old clients
        const { charId, newHp, newMaxHp } = payload as { charId: string; newHp: number; newMaxHp: number };
        setCampaignParty(prev => prev.map(c => c.id === charId ? { ...c, hp: newHp, max_hp: newMaxHp } : c));
      })
      .on("broadcast", { event: "character_sync" }, ({ payload }) => {
        // Full stat sync for all state changes
        const p = payload as {
          charId: string; hp: number; max_hp: number;
          xp?: number; level?: number;
          inventory?: Character["inventory"];
          spell_slots_used?: Record<number, number>;
          class_resources?: Record<string, number>;
          status_effects?: string[];
        };
        const merge = (c: Character) => ({
          ...c,
          // Only overwrite hp/max_hp when they are present — partial broadcasts (e.g. fast spell
          // detection) only send spell_slots_used and must not wipe the existing hp values.
          ...(p.hp               !== undefined && { hp:               p.hp               }),
          ...(p.max_hp           !== undefined && { max_hp:           p.max_hp           }),
          ...(p.xp               !== undefined && { xp:               p.xp               }),
          ...(p.level            !== undefined && { level:            p.level            }),
          ...(p.inventory        !== undefined && { inventory:        p.inventory        }),
          ...(p.spell_slots_used !== undefined && { spell_slots_used: p.spell_slots_used }),
          ...(p.class_resources  !== undefined && { class_resources:  p.class_resources  }),
          ...(p.status_effects   !== undefined && { status_effects:   p.status_effects   }),
        });
        setCampaignParty(prev => prev.map(c => c.id !== p.charId ? c : merge(c)));
        // Also update the active character sheet for other players' characters
        if (characterRef.current?.id === p.charId) {
          const updated = merge(characterRef.current);
          setCharacter(updated);
          characterRef.current = updated;
        }
      })
      .on("broadcast", { event: "enemies_spawned" }, ({ payload }) => {
        const spawned = payload.enemies as CampaignEnemy[];
        setEnemies(spawned);
        enemiesRef.current = spawned;
        setCombatActive(true);
        setSidebarTab("combat");
      })
      .on("broadcast", { event: "enemies_updated" }, ({ payload }) => {
        const { changes, combat_ended } = payload as {
          changes: { name: string; condition: EnemyCondition; is_defeated: boolean; status_effects_gained: string[]; status_effects_lost: string[] }[];
          combat_ended: boolean;
        };
        setEnemies(prev => {
          const updated = prev.map(e => {
            const ch = changes.find(c => c.name === e.name);
            if (!ch) return e;
            return {
              ...e,
              condition:      ch.condition,
              is_defeated:    ch.is_defeated || e.is_defeated,
              status_effects: [...e.status_effects.filter(s => !ch.status_effects_lost?.includes(s)), ...(ch.status_effects_gained ?? [])],
            };
          });
          enemiesRef.current = updated;
          return updated;
        });
        if (combat_ended) setCombatActive(false);
      })
      .on("broadcast", { event: "item_dropped" }, ({ payload }) => {
        setDroppedItems(prev => [...prev, payload as DroppedItem]);
      })
      .on("broadcast", { event: "item_taken" }, ({ payload }) => {
        setDroppedItems(prev => prev.filter(i => i.id !== payload.id));
      })
      .on("broadcast", { event: "scene_change" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        if (payload.imageUrl) {
          currentSceneRef.current = payload.sceneName as string;
          setCurrentSceneUrl(payload.imageUrl as string);
          (window as Window).__dndSetMusicScene?.(payload.sceneName as string, payload.sceneType as string | undefined, payload.modifiers as string[] | undefined);
          if (payload.sceneType) (window as Window).__dndSetAmbianceScene?.(payload.sceneName as string, payload.sceneType as string, payload.modifiers as string[] | undefined);
        }
        // Attach story moment illustration to the matching DM message
        if (payload.momentImageUrl) {
          const dmContent = payload.dmContent as string | undefined;
          setMessages(prev => {
            const ridx = dmContent
              ? [...prev].reverse().findIndex(m => m.role === "dm" && m.content.slice(0, 120) === dmContent)
              : [...prev].reverse().findIndex(m => m.role === "dm");
            if (ridx < 0) return prev;
            const idx = prev.length - 1 - ridx;
            if (prev[idx].imageUrl) return prev; // already set
            const next = [...prev];
            next[idx] = { ...next[idx], imageUrl: payload.momentImageUrl as string };
            return next;
          });
        }
      })
      .subscribe(status => {
        // Once joined, ask peers for the current round state. This rebuilds
        // roundActionsRef after a tab refresh or mid-session join — without
        // it the rejoiner's next turn-advance would skip the already-acted
        // players (since they don't know who acted) and produce desync.
        if (status === "SUBSCRIBED" && userIdRef.current) {
          pendingStateRequestRef.current = true;
          // Auto-clear after 2.5s — any response arriving later than this is
          // almost certainly stale relative to events we've meanwhile applied.
          setTimeout(() => { pendingStateRequestRef.current = false; }, 2500);
          channel.send({
            type: "broadcast",
            event: "round_state_request",
            payload: { fromUserId: userIdRef.current },
          });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel); channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, params.id]);

  // ── Chat auto-scroll ────────────────────────────────────────────────────────
  // Tracks whether the user has intentionally scrolled away from the bottom. When
  // they do, every auto-scroll source (RAF drift, snap-to-bottom, suggestion-reflow)
  // backs off until the user returns near the bottom. Previously the three effects
  // raced against each other and against the user's wheel, producing the "crazy
  // scrolling" feel during streaming + suggestion arrival.
  const userInterruptedScrollRef = useRef(false);

  // Manual scroll buttons on the narration window. Scrolls ~80% of the visible
  // height per click so the reader keeps a line of overlap for context. The
  // existing onScroll handler picks up these (smooth) scrolls and toggles
  // auto-scroll engagement just like a wheel/touch scroll would.
  const scrollNarration = useCallback((dir: 1 | -1) => {
    const el = msgContainerRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * el.clientHeight * 0.8, behavior: "smooth" });
  }, []);

  // Detect user scroll-up vs programmatic scrolls (mounted once)
  useEffect(() => {
    const el = msgContainerRef.current;
    if (!el) return;
    let lastTop = el.scrollTop;
    const onScroll = () => {
      const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      // Scrolled upward by more than 5px AND ended up far enough from the bottom
      // → treat as a deliberate user scroll-up. Programmatic auto-scrolls always
      // step DOWN, so this check rejects them.
      if (el.scrollTop < lastTop - 5 && fromBottom > 80) {
        userInterruptedScrollRef.current = true;
      }
      // Returned to within 30px of the bottom → re-engage auto-scroll.
      if (fromBottom < 30) {
        userInterruptedScrollRef.current = false;
      }
      lastTop = el.scrollTop;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the latest narration pinned to the bottom whenever the messages VIEWPORT
  // resizes. The Suggested Actions panel appearing, expanding, or collapsing
  // shrinks/grows the chat area; without re-pinning, the end of the narration
  // slips below the fold and looks "covered" by the suggestions. A ResizeObserver
  // fires through the panel's height transition too, so the final resting state is
  // always the bottom — the player can read the end of the narration in every
  // state. Respects a deliberate scroll-up so we never yank them off older text.
  useEffect(() => {
    const el = msgContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (userInterruptedScrollRef.current) return;
      el.scrollTop = el.scrollHeight - el.clientHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Single auto-scroll behavior — drift smoothly while content streams, snap when idle,
  // never override the user.
  useEffect(() => {
    const el = msgContainerRef.current;
    if (!el) return;
    const active = isTyping || !!streamingContent || !!openingRevealText || !!narRevealText;
    if (!active) {
      if (autoScrollRafRef.current) { cancelAnimationFrame(autoScrollRafRef.current); autoScrollRafRef.current = null; }
      if (userInterruptedScrollRef.current) return;
      // Idle snap — gives the layout a tick to settle (suggestion panel reflow, etc.)
      // before we land at the bottom. One snap, not three competing ones.
      const t = setTimeout(() => {
        if (!userInterruptedScrollRef.current && msgContainerRef.current) {
          msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight;
        }
      }, 60);
      return () => clearTimeout(t);
    }
    // Streaming/revealing — drift toward the bottom each frame.
    let rafId = 0;
    const tick = () => {
      if (!userInterruptedScrollRef.current) {
        const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (remaining > 100) {
          // Big layout shift (e.g. Suggested Actions panel just appeared and shrank
          // the chat) — instant snap so the last narration line never sits behind
          // the suggestions panel even momentarily.
          el.scrollTop = el.scrollHeight - el.clientHeight;
        } else if (remaining > 1) {
          // Gentle drift for the steady text-reveal case.
          el.scrollTop += Math.max(0.8, Math.min(remaining * 0.055, 7));
        }
      }
      rafId = requestAnimationFrame(tick);
      autoScrollRafRef.current = rafId;
    };
    rafId = requestAnimationFrame(tick);
    autoScrollRafRef.current = rafId;
    return () => { cancelAnimationFrame(rafId); autoScrollRafRef.current = null; };
  }, [isTyping, streamingContent, openingRevealText, narRevealText, messages, suggestions]);

  // Fallback: if narRevealText is set but audio never fires canplaythrough (quota, error, disabled mid-flight),
  // unblock the reveal after 1.5 s so text is never permanently stuck.
  useEffect(() => {
    if (!narRevealText || narRevealIntervalMs !== null) return;
    const t = setTimeout(() => {
      setNarRevealIntervalMs(52);
      setNarRevealPaused(false); // no audio coming — let the reveal proceed
    }, 1500);
    return () => clearTimeout(t);
  }, [narRevealText, narRevealIntervalMs]);

  // Flush: when narration has fully stopped (all slots played, no more audio) but the
  // reveal is still mid-text (slight drift from displayed length > TTS-stripped slot total),
  // release the pause so the remaining few characters type out and the message commits.
  useEffect(() => {
    if (!narrating && narRevealText && narRevealIntervalMs !== null && narRevealPaused) {
      setNarRevealPaused(false);
    }
  }, [narrating, narRevealText, narRevealIntervalMs, narRevealPaused]);

  // Global narration watchdog — resets every time a new clip begins playing
  // (narHeartbeat is bumped in playNextInQueue). This way long multi-sentence
  // narrations never get killed mid-speech; only true stalls (no clip transitions
  // for 45 s) trigger the unlock.
  const [narHeartbeat, setNarHeartbeat] = useState(0);
  useEffect(() => {
    if (!narrating) return;
    const t = setTimeout(() => {
      console.warn("[narration] global watchdog — narrating stuck, force-resetting");
      const el = narAudioRef.current;
      if (el) { el.pause(); el.src = ""; }
      audioPlayingRef.current = false;
      narSlotCounterRef.current = 0;
      narSlotsRef.current = [];
      narSlotTextsRef.current = [];
      narSlotRetriedRef.current = [];
      narPlaySlotRef.current = 0;
      setNarrating(false);
    }, 45000);
    return () => clearTimeout(t);
  }, [narrating, narHeartbeat]);

  // Guarantee: whenever it's my turn, the DM isn't busy, and suggestions are empty,
  // fetch them from the last DM message. Covers resume, turn changes, and silent fetch failures.
  const suggestionFetchInFlightRef = useRef(false);
  useEffect(() => {
    const myTurn = rollRequestedUserId ? rollRequestedUserId === userId
      : (turnOrder.length <= 1 || turnOrder[currentTurnIndex] === character?.id);
    const busy = isTyping || narrating;
    if (!sessionStarted || !myTurn || busy || suggestions.length > 0) return;
    if (suggestionFetchInFlightRef.current) return;
    const char   = characterRef.current;
    const lastDm = [...messagesRef.current].reverse().find(m => m.role === "dm");
    if (!char || !lastDm) return;
    suggestionFetchInFlightRef.current = true;
    fetch("/api/suggest-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSuggestActionsBody(lastDm.content, char)),
    })
      .then(r => r.json())
      .then(({ suggestions: s }) => { if (s?.length) setSuggestions(s); })
      .catch(() => {})
      .finally(() => { suggestionFetchInFlightRef.current = false; });
  // messages.length re-checks after each new DM message arrives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted, rollRequestedUserId, userId, turnOrder, currentTurnIndex, character?.id, isTyping, narrating, suggestions.length, messages.length]);
  useEffect(() => { if (sidebarTab === "log") logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logEntries, sidebarTab]);

  // Fetch AI portraits for enemies that don't have one yet
  useEffect(() => {
    const needsPortrait = enemies.filter(e => !e.portrait_url && !e.is_defeated);
    if (!needsPortrait.length) return;
    needsPortrait.forEach(e => {
      fetch("/api/generate-enemy-portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enemyType: e.enemy_type, cr: e.cr }),
      })
        .then(r => r.json())
        .then(({ portraitUrl }: { portraitUrl: string | null }) => {
          if (portraitUrl) {
            setEnemies(prev => prev.map(en => en.id === e.id ? { ...en, portrait_url: portraitUrl } : en));
          }
        })
        .catch(() => {});
    });
  }, [enemies.map(e => e.id).join(",")]);

  // When DM names a player to roll: mark pending — dice opens AFTER narration finishes
  useEffect(() => {
    if (!diceRollTarget) {
      setPendingDiceShow(false);
      return;
    }
    if (!character) return;
    if (diceRollTarget.toLowerCase() === character.name.toLowerCase()) {
      setPendingDiceShow(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceRollTarget]);

  // Open dice panel only after ALL narration (including in-flight TTS fetches) has finished.
  // narrating covers active playback; the slot counter covers sentences queued but not yet playing.
  useEffect(() => {
    if (!pendingDiceShow || isTyping) return;
    const narrationInFlight = narrating || narPlaySlotRef.current < narSlotCounterRef.current;
    if (!narrationInFlight) {
      setPendingDiceShow(false);
      setShowDice(true);
    }
  }, [pendingDiceShow, narrating, isTyping]);

  // ── State changes (HP, gold, items, XP) ──────────────────────────────────────

  // Flexible name check: null target = any character; "Aria" matches "Aria Windwalker"; exact also works.
  const charNameMatches = useCallback((targetName: string | null, charName: string): boolean => {
    if (!targetName) return true;
    const t = targetName.toLowerCase();
    const c = charName.toLowerCase();
    return c === t || c.startsWith(t + " ") || t.startsWith(c + " ");
  }, []);

  const applyStateChange = useCallback(async (change: StateChange, narrativeContext?: string) => {
    // Resolve the character this change should land on. The local user's
    // `characterRef.current` is unreliable: by the time chat-state returns, the
    // turn has often already advanced, so `characterRef.current` points at the
    // NEXT player rather than the actor. We resolve in priority order:
    //   1. Named target — the DM said "Randiezel scoops the gold" → Randiezel.
    //   2. The acting character — fallback for "you find a sword" style awards.
    //   3. The local user's character — preserves opening-scene / solo behaviour.
    let char: Character | null = null;
    if (change.target_name) {
      const named = campaignPartyRef.current.find(c => charNameMatches(change.target_name!, c.name));
      if (named) char = named;
    }
    if (!char && prevActingCharIdRef.current) {
      const actor = campaignPartyRef.current.find(c => c.id === prevActingCharIdRef.current);
      if (actor) char = actor;
    }
    if (!char) char = characterRef.current;
    if (!char) return;

    // Determine if this character was the acting character for this DM response.
    // prevActingCharIdRef is set in handleSend (before turn advance) and synced via dm_response broadcast.
    const wasPrevActingChar = char.id === prevActingCharIdRef.current;
    // Fallback: solo play only — in multiplayer the turn advances BEFORE the DM responds, so
    // isCurrentTurnChar would wrongly flag the NEXT player as the acting char.
    const isCurrentTurnChar = turnOrderRef.current.length <= 1;
    const isActingChar = wasPrevActingChar || isCurrentTurnChar;
    // Targeting helpers — computed once, used for every field below.
    // isExplicitTarget: DM named this exact character.
    // isImplicitTarget: DM said "you" (no name) and this is the acting character.
    // isEffectiveTarget: this character is the recipient (either explicit or implicit).
    const isExplicitTarget = !!change.target_name && charNameMatches(change.target_name, char.name);
    const isImplicitTarget = !change.target_name && isActingChar;
    const isEffectiveTarget = isExplicitTarget || isImplicitTarget;

    // HP: only applies when this character is the recipient.
    if (change.hp_delta !== 0 && !isEffectiveTarget) {
      change = { ...change, hp_delta: 0 };
    }
    // Temp HP grant: only applies when this character is the recipient.
    if (change.temp_hp_grant > 0 && !isEffectiveTarget) {
      change = { ...change, temp_hp_grant: 0 };
    }
    // Fast detection already applied this HP delta — skip to prevent double-counting.
    if (change.hp_delta !== 0 && pendingHpDeltaRef.current !== 0) {
      change = { ...change, hp_delta: 0 };
    }
    pendingHpDeltaRef.current = 0; // always clear after deciding

    // Spell slots: ONLY the acting character (the caster) consumes slots.
    // Observers learn about other players' slot changes via character_sync broadcast from the caster's client.
    // Never gate on target_name — the target of healing is not the caster.
    const shouldApplySlots = isActingChar;
    // Check pending UI spell cast BEFORE hasChange so stuck pendingSpellCastRef always gets cleared.
    const hadPendingCast = pendingSpellCastRef.current > 0;

    const hasChange =
      change.hp_delta !== 0 ||
      change.temp_hp_grant > 0 ||
      (change.spell_slots_used > 0 && (shouldApplySlots || hadPendingCast)) ||
      (isActingChar && hadPendingCast) || // always clear stuck pending cast on the acting char
      (isEffectiveTarget && (change.gold_delta !== 0 || change.items_gained.length > 0 ||
        change.items_lost.length > 0 || change.weapons_gained.length > 0)) ||
      (isExplicitTarget && (change.status_effects_gained.length > 0 || change.status_effects_lost.length > 0)) ||
      change.xp_award > 0;
    if (!hasChange) return;

    const charIb         = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
    const effectiveMaxHp = char.max_hp + charIb.hpMaxAdd;

    // Temp HP tracking (stored in class_resources.temp_hp — no DB migration needed)
    const currentTempHp = char.class_resources?.temp_hp ?? 0;
    let newTempHp = currentTempHp;
    // Grant temp HP first (doesn't stack — take the higher value per D&D 5e rules)
    if (change.temp_hp_grant > 0) {
      newTempHp = Math.max(currentTempHp, change.temp_hp_grant);
    }
    // Damage hits temp HP before real HP
    let adjustedHpDelta = change.hp_delta;
    if (adjustedHpDelta < 0 && newTempHp > 0) {
      const dmg       = Math.abs(adjustedHpDelta);
      const absorbed  = Math.min(newTempHp, dmg);
      newTempHp       = newTempHp - absorbed;
      adjustedHpDelta = -(dmg - absorbed);
    }

    const newHp          = Math.max(0, Math.min(effectiveMaxHp, char.hp + adjustedHpDelta));
    // Loot follows the same effective-target rule HP uses: "you find a potion" (no name) lands on
    // the acting player; "Thorin finds a potion" lands on Thorin. Without this, items the DM awards
    // to "you" silently disappear because target_name is null.
    const newGold    = isEffectiveTarget ? Math.max(0, (char.inventory?.gold ?? 0) + change.gold_delta) : (char.inventory?.gold ?? 0);
    const newItems   = isEffectiveTarget ? [...(char.inventory?.items ?? []).filter(i => !change.items_lost.includes(i)), ...change.items_gained] : (char.inventory?.items ?? []);
    const newWeapons = isEffectiveTarget ? [...(char.inventory?.weapons ?? []), ...change.weapons_gained] : (char.inventory?.weapons ?? []);

    // Status effects — unconscious tracks HP for any effective target; named conditions require explicit target.
    let newStatuses = [...(char.status_effects ?? [])];
    if (isEffectiveTarget) {
      if (newHp === 0 && adjustedHpDelta < 0 && !newStatuses.includes("Unconscious")) newStatuses.push("Unconscious");
      if (newHp > 0 && newHp <= effectiveMaxHp) newStatuses = newStatuses.filter(s => s !== "Unconscious");
      if (isExplicitTarget) {
        change.status_effects_gained.forEach(s => { if (!newStatuses.includes(s)) newStatuses.push(s); });
        newStatuses = newStatuses.filter(s => !change.status_effects_lost.includes(s));
      }
    } else if (adjustedHpDelta !== 0) {
      if (newHp === 0 && !newStatuses.includes("Unconscious")) newStatuses.push("Unconscious");
      if (newHp > 0) newStatuses = newStatuses.filter(s => s !== "Unconscious");
    }

    // Spell slots — consume when named explicitly OR this is the acting character.
    // If the player clicked a spell in the UI (or fast detection fired), pendingSpellCastRef > 0
    // (slot already consumed) — just clear the pending count, but reconcile if the AI identified
    // an upcast level different from what fast detection assumed.
    const newSlotsUsed = { ...(char.spell_slots_used ?? {}) };
    if ((shouldApplySlots || hadPendingCast) && change.spell_slots_used > 0) {
      if (hadPendingCast) {
        // Reconcile upcast: if fast detection consumed level X but AI says level Y, correct it
        const fastLevel    = pendingSpellCastLevelRef.current;
        const correctLevel = change.spell_slot_level;
        if (fastLevel > 0 && correctLevel > 0 && correctLevel !== fastLevel) {
          if ((newSlotsUsed[fastLevel] ?? 0) > 0) {
            newSlotsUsed[fastLevel] = (newSlotsUsed[fastLevel]! - 1);
          }
          newSlotsUsed[correctLevel] = (newSlotsUsed[correctLevel] ?? 0) + 1;
        }
        pendingSpellCastRef.current = Math.max(0, pendingSpellCastRef.current - change.spell_slots_used);
        pendingSpellCastLevelRef.current = 0;
      } else {
        const allSlots = getSpellSlots(char.class, char.level);
        let toConsume = change.spell_slots_used;
        while (toConsume > 0) {
          // Prefer the level the AI identified; fall back to lowest available
          const preferredLvl = change.spell_slot_level > 0 ? change.spell_slot_level : null;
          const preferredAvail = preferredLvl && (allSlots[preferredLvl] ?? 0) - (newSlotsUsed[preferredLvl] ?? 0) > 0;
          const availLevel = preferredAvail
            ? preferredLvl!
            : (Object.keys(allSlots).map(Number).sort()
                .find(lvl => (allSlots[lvl] ?? 0) - (newSlotsUsed[lvl] ?? 0) > 0) ?? 1);
          newSlotsUsed[availLevel] = (newSlotsUsed[availLevel] ?? 0) + 1;
          toConsume--;
        }
      }
    }

    const parts: string[] = [];
    if (change.temp_hp_grant > 0 && newTempHp > currentTempHp) parts.push(`+${newTempHp - currentTempHp} THP`);
    if (change.hp_delta < 0 && currentTempHp > 0 && newTempHp < currentTempHp) {
      const absorbed = (currentTempHp + (change.temp_hp_grant > 0 ? Math.max(0, change.temp_hp_grant - currentTempHp) : 0)) - newTempHp;
      if (absorbed > 0) parts.push(`${absorbed} THP absorbed`);
    }
    if (adjustedHpDelta < 0) parts.push(`${Math.abs(adjustedHpDelta)} damage taken`);
    if (adjustedHpDelta > 0) parts.push(`+${adjustedHpDelta} HP restored`);
    if (isEffectiveTarget && change.gold_delta > 0) parts.push(`+${change.gold_delta}gp`);
    if (isEffectiveTarget && change.gold_delta < 0) parts.push(`${change.gold_delta}gp`);
    if (isEffectiveTarget) change.items_gained.forEach(i => parts.push(`+${i}`));
    if (isEffectiveTarget) change.weapons_gained.forEach(w => parts.push(`+${w}`));
    if (isExplicitTarget) change.status_effects_gained.forEach(s => parts.push(`⚡ ${s}`));
    if (isExplicitTarget) change.status_effects_lost.forEach(s => parts.push(`✓ ${s} cleared`));
    if (shouldApplySlots && change.spell_slots_used > 0 && !hadPendingCast) parts.push(`${change.spell_slots_used} spell slot${change.spell_slots_used > 1 ? "s" : ""} used`);
    if (isExplicitTarget && newHp === 0 && adjustedHpDelta < 0) parts.push("💀 UNCONSCIOUS");

    // XP + level up
    let newXp    = char.xp ?? 0;
    let newLevel = char.level;
    let newMaxHp = char.max_hp;
    let leveledUp = false;

    if (change.xp_award > 0) {
      newXp += change.xp_award;
      parts.push(`+${change.xp_award} XP`);
      // Loop (not a single if) so one large award can cross MULTIPLE thresholds
      // at once and grant every level earned, accumulating HP for each.
      let totalHpGain = 0;
      while (newXp >= getXpToNextLevel(newLevel) && newLevel < 10) {
        newLevel++;
        const hitDie  = CLASS_HIT_DIE[char.class] ?? 8;
        totalHpGain  += Math.floor(hitDie / 2) + 1 + Math.floor((char.constitution - 10) / 2);
        leveledUp     = true;
      }
      if (leveledUp) {
        newMaxHp = char.max_hp + totalHpGain;
        parts.push(`⬆ LEVEL UP → ${newLevel}! +${totalHpGain} max HP`);
      }
    }

    // Rebuild class_resources with updated temp HP
    const classResChanged = newTempHp !== currentTempHp;
    const newClassRes = { ...(char.class_resources ?? {}) };
    if (newTempHp > 0) { newClassRes.temp_hp = newTempHp; } else { delete newClassRes.temp_hp; }

    // Preserve any existing item_meta — and strip entries for items that were lost
    const survivingItemNames = new Set<string>([...newItems, ...newWeapons]);
    const carriedMeta = char.inventory?.item_meta ?? {};
    const trimmedMeta: NonNullable<Character["inventory"]["item_meta"]> = {};
    for (const [k, v] of Object.entries(carriedMeta)) {
      if (survivingItemNames.has(k)) trimmedMeta[k] = v;
    }

    const newInventory: Character["inventory"] = {
      ...(char.inventory ?? { gold: 0, items: [], weapons: [] }),
      gold: newGold, items: newItems, weapons: newWeapons,
    };
    if (Object.keys(trimmedMeta).length > 0) newInventory.item_meta = trimmedMeta;
    else delete newInventory.item_meta;

    const updatedChar: Character = {
      ...char, hp: newHp, level: newLevel, max_hp: newMaxHp, xp: newXp,
      status_effects: newStatuses, spell_slots_used: newSlotsUsed,
      class_resources: newClassRes,
      inventory: newInventory,
    };
    // Only mutate `character` (the local user's identity) when the target IS the
    // local user's current character. Otherwise we'd hijack the user's identity
    // mid-flight (the same root-cause family as the click-to-Acting bug).
    if (char.id === characterRef.current?.id) {
      setCharacter(updatedChar);
      characterRef.current = updatedChar;
    }
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updatedChar : c));
    campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === char.id ? updatedChar : c);

    const dbUpdate: Record<string, unknown> = {
      hp: newHp, inventory: updatedChar.inventory, xp: newXp,
      status_effects: newStatuses, spell_slots_used: newSlotsUsed,
    };
    if (classResChanged) dbUpdate.class_resources = newClassRes;
    if (leveledUp) { dbUpdate.level = newLevel; dbUpdate.max_hp = newMaxHp; }
    await charWrite(char.id, dbUpdate);

    // Always clear any pending optimistic spell cast once the acting char's DM response is processed,
    // even if chat-state returned spell_slots_used = 0 (so the refs never stay stuck > 0).
    if (isActingChar && pendingSpellCastRef.current > 0) {
      pendingSpellCastRef.current = 0;
      pendingSpellCastLevelRef.current = 0;
    }

    // Broadcast full stat sync so every player's party card stays accurate
    channelRef.current?.send({
      type: "broadcast", event: "character_sync",
      payload: {
        charId:           char.id,
        hp:               newHp,
        max_hp:           newMaxHp,
        xp:               newXp,
        level:            newLevel,
        inventory:        updatedChar.inventory,
        spell_slots_used: newSlotsUsed,
        class_resources:  newClassRes,
        status_effects:   newStatuses,
      },
    });

    if (parts.length) {
      const notice = parts.join(" · ");
      setStateNotice(notice);
      setTimeout(() => setStateNotice(null), leveledUp || newHp === 0 ? 8000 : 4000);
      setLogEntries(prev => [...prev, { id: makeLogId("state"), timestamp: new Date(), role: "system", content: `⚡ ${notice}` }]);
    }

    // Enrich DM-awarded loot that isn't in the static catalog so players see real
    // tooltips and values for invented items. Only the recipient enriches —
    // observers get the meta via the second character_sync broadcast below.
    if (isEffectiveTarget) {
      const newlyAwarded = [...change.items_gained, ...change.weapons_gained];
      const needsMeta = newlyAwarded.filter(name => {
        if (!name) return false;
        if (getItemByName(name)) return false;
        if (WEAPON_TIPS[name] || ITEM_TIPS[name]) return false;
        if (updatedChar.inventory.item_meta?.[name]) return false;
        return true;
      });
      if (needsMeta.length > 0) {
        fetch("/api/item-details", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ items: needsMeta, context: narrativeContext ?? "" }),
        })
          .then(r => r.ok ? r.json() : { items: [] })
          .then((data: { items?: Array<{ name: string; description: string; value_gp?: number; rarity?: string; type?: string }> }) => {
            const list = Array.isArray(data.items) ? data.items : [];
            if (list.length === 0) return;
            // Look up the latest version of the recipient in the party — they
            // may not be the local user's `character`, so we can't assume
            // `characterRef.current` is the right place to read from.
            const recipient = campaignPartyRef.current.find(c => c.id === char.id);
            if (!recipient) return;
            const validRarities = new Set(["common", "uncommon", "rare", "very_rare", "legendary"]);
            const existingMeta = recipient.inventory.item_meta ?? {};
            const mergedMeta: NonNullable<Character["inventory"]["item_meta"]> = { ...existingMeta };
            for (const it of list) {
              if (!it.name) continue;
              const rarity = validRarities.has(it.rarity ?? "") ? (it.rarity as "common" | "uncommon" | "rare" | "very_rare" | "legendary") : "common";
              mergedMeta[it.name] = {
                description: typeof it.description === "string" ? it.description : "",
                value_gp:    typeof it.value_gp === "number" && it.value_gp >= 0 ? it.value_gp : 0,
                rarity,
                type:        typeof it.type === "string" ? it.type : undefined,
              };
            }
            const newInv = { ...recipient.inventory, item_meta: mergedMeta };
            const enrichedChar = { ...recipient, inventory: newInv };
            // Only update `character` if the recipient happens to be the local user's current char
            if (characterRef.current?.id === recipient.id) {
              setCharacter(enrichedChar);
              characterRef.current = enrichedChar;
            }
            setCampaignParty(prev => prev.map(c => c.id === recipient.id ? { ...c, inventory: newInv } : c));
            campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === recipient.id ? { ...c, inventory: newInv } : c);
            charWriteRef.current?.(recipient.id, { inventory: newInv });
            channelRef.current?.send({
              type: "broadcast", event: "character_sync",
              payload: { charId: recipient.id, inventory: newInv },
            });
          })
          .catch(err => console.warn("[item-details]", err));
      }
    }
  }, [charWrite, charNameMatches]);

  // ── DM → sheet state pipeline ─────────────────────────────────────────────────
  // PRIMARY: authoritative economy tags the DM emits inline ([GOLD:..]/[LOOT:..]/
  //   [WEAPON:..]/[ITEM-LOST:..]/[XP:..]) are parsed DETERMINISTICALLY — no LLM, no
  //   guessing — so a number the DM wrote can never be mis-read or missed.
  // FALLBACK: the /api/chat-state extractor still runs for HP / temp-HP / spell
  //   slots / status effects (not yet migrated to tags) AND for any economy the DM
  //   left untagged (older saves, or the model forgetting a tag). Where a tag fired,
  //   its value overrides the extractor's guess for that category — the tag wins.
  // RESILIENCE: if the extractor call fails outright, tagged economy still applies,
  //   so an extractor outage no longer silently drops a player's gold/loot.
  const applyDmStateFromNarrative = useCallback((narrative: string) => {
    const econ = parseEconomyTags(narrative);
    const econOnlyChange = (): StateChange => ({
      target_name: econ.target_name,
      hp_delta: 0, temp_hp_grant: 0,
      gold_delta:     econ.goldTagged ? econ.gold_delta     : 0,
      items_gained:   econ.lootTagged ? econ.items_gained   : [],
      items_lost:     econ.lootTagged ? econ.items_lost     : [],
      weapons_gained: econ.lootTagged ? econ.weapons_gained : [],
      xp_award:       econ.xpTagged   ? econ.xp_award        : 0,
      status_effects_gained: [], status_effects_lost: [], spell_slots_used: 0, spell_slot_level: 0,
    });
    fetch("/api/chat-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative }) })
      .then(r => r.json())
      .then((change: StateChange) => {
        if (!econ.any) { applyStateChange(change, narrative); return; }
        // Deterministic tags are authoritative — strip the tagged categories out of
        // the extractor's result so they can't double-apply or fight the tag.
        const extractorPart: StateChange = {
          ...change,
          ...(econ.goldTagged ? { gold_delta: 0 } : {}),
          ...(econ.lootTagged ? { items_gained: [], items_lost: [], weapons_gained: [] } : {}),
          ...(econ.xpTagged   ? { xp_award: 0 } : {}),
        };
        const econTarget = econ.target_name, extractorTarget = change.target_name;
        const sameOrAbsentTarget = !econTarget || !extractorTarget || charNameMatches(econTarget, extractorTarget);
        if (sameOrAbsentTarget) {
          // Common case — single recipient: one merged change (tag values win).
          applyStateChange({
            ...extractorPart,
            target_name:    econTarget ?? extractorTarget,
            gold_delta:     econ.goldTagged ? econ.gold_delta     : extractorPart.gold_delta,
            items_gained:   econ.lootTagged ? econ.items_gained   : extractorPart.items_gained,
            items_lost:     econ.lootTagged ? econ.items_lost     : extractorPart.items_lost,
            weapons_gained: econ.lootTagged ? econ.weapons_gained : extractorPart.weapons_gained,
            xp_award:       econ.xpTagged   ? econ.xp_award        : extractorPart.xp_award,
          }, narrative);
        } else {
          // Rare — DM tagged economy for a DIFFERENT recipient than the extractor's
          // HP/status target. Apply as two changes so neither is dropped by the
          // single-target model. Extractor part FIRST (clears pendingHpDeltaRef);
          // econ part second (no HP, different char → no clobber).
          applyStateChange(extractorPart, narrative);
          applyStateChange(econOnlyChange(), narrative);
        }
      })
      .catch(() => { if (econ.any) applyStateChange(econOnlyChange(), narrative); });
  }, [applyStateChange, charNameMatches]);

  // ── Resume-loot reconciliation ────────────────────────────────────────────────
  // On resume, the DM's most recent message is loaded from the DB but its state
  // changes (items, gold, weapons, status effects) are NOT re-extracted — the
  // assumption is that the original session already persisted those changes.
  // When the original applyStateChange ran on the wrong character (the legacy
  // identity-hijack bug), the DB never recorded the loot and the recipient was
  // left empty-handed forever. This function re-runs chat-state on the last DM
  // message and additively recovers anything missing.
  //
  // Idempotency rules:
  //   • items_gained / weapons_gained — added only if NOT already present
  //   • status_effects_gained        — added only if NOT already present
  //   • status_effects_lost          — removed only if currently present
  //   • gold_delta                   — applied only when items/weapons were
  //                                    also missing (heuristic: if loot is
  //                                    missing, gold probably is too)
  //   • hp_delta, xp_award, spell_slots_used — SKIPPED (re-applying would
  //                                    double-count damage / progression).
  const reconcileResumeLoot = useCallback(async () => {
    if (resumeLootReconciledRef.current) return;
    resumeLootReconciledRef.current = true; // mark BEFORE awaiting so concurrent triggers no-op

    const lastDm = [...messagesRef.current].reverse().find(m => m.role === "dm");
    if (!lastDm || !lastDm.content?.trim()) return;

    let change: StateChange;
    try {
      const res = await fetch("/api/chat-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative: lastDm.content }),
      });
      change = await res.json() as StateChange;
    } catch (err) {
      console.warn("[resume reconcile] chat-state fetch failed:", err);
      return;
    }

    // Resolve the recipient (same priority chain as applyStateChange).
    let target: Character | undefined;
    if (change.target_name) {
      target = campaignPartyRef.current.find(c => charNameMatches(change.target_name!, c.name));
    }
    if (!target && prevActingCharIdRef.current) {
      target = campaignPartyRef.current.find(c => c.id === prevActingCharIdRef.current);
    }
    if (!target) return; // nothing to reconcile against

    const inv = target.inventory ?? { gold: 0, items: [], weapons: [] };
    const itemsLower   = new Set((inv.items   ?? []).map(s => s.toLowerCase()));
    const weaponsLower = new Set((inv.weapons ?? []).map(s => s.toLowerCase()));
    const statusesLower = new Set((target.status_effects ?? []).map(s => s.toLowerCase()));

    const missingItems   = change.items_gained.filter(i => !itemsLower.has(i.toLowerCase()));
    const missingWeapons = change.weapons_gained.filter(w => !weaponsLower.has(w.toLowerCase()));
    const missingStatuses = change.status_effects_gained.filter(s => !statusesLower.has(s.toLowerCase()));
    const presentStatusesToLose = change.status_effects_lost.filter(s => statusesLower.has(s.toLowerCase()));

    const lootWasMissing = missingItems.length > 0 || missingWeapons.length > 0;
    const goldDelta      = lootWasMissing && change.gold_delta !== 0 ? change.gold_delta : 0;

    if (missingItems.length === 0 && missingWeapons.length === 0 && missingStatuses.length === 0 && presentStatusesToLose.length === 0 && goldDelta === 0) {
      return; // nothing missing — DB state is already correct
    }

    const newItems   = [...(inv.items   ?? []), ...missingItems];
    const newWeapons = [...(inv.weapons ?? []), ...missingWeapons];
    const newGold    = Math.max(0, (inv.gold ?? 0) + goldDelta);
    const newStatuses = [
      ...(target.status_effects ?? []).filter(s => !presentStatusesToLose.includes(s)),
      ...missingStatuses,
    ];

    const newInventory: Character["inventory"] = {
      ...inv,
      gold: newGold,
      items: newItems,
      weapons: newWeapons,
    };
    const updated: Character = { ...target, inventory: newInventory, status_effects: newStatuses };

    if (characterRef.current?.id === target.id) {
      setCharacter(updated);
      characterRef.current = updated;
    }
    setCampaignParty(prev => prev.map(c => c.id === target!.id ? updated : c));
    campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === target!.id ? updated : c);
    await charWrite(target.id, { inventory: newInventory, status_effects: newStatuses });
    channelRef.current?.send({
      type: "broadcast", event: "character_sync",
      payload: { charId: target.id, inventory: newInventory, status_effects: newStatuses },
    });

    // Notify the user — they should see they finally got their loot
    const parts: string[] = [];
    missingItems.forEach(i => parts.push(`+${i}`));
    missingWeapons.forEach(w => parts.push(`+${w}`));
    if (goldDelta > 0) parts.push(`+${goldDelta}gp`);
    missingStatuses.forEach(s => parts.push(`⚡ ${s}`));
    if (parts.length > 0) {
      const notice = `Recovered loot for ${target.name}: ${parts.join(" · ")}`;
      setStateNotice(notice);
      setTimeout(() => setStateNotice(null), 6000);
      setLogEntries(prev => [...prev, { id: makeLogId("resume-loot"), timestamp: new Date(), role: "system", content: `🪙 ${notice}` }]);
    }

    // Enrich any DM-invented items so tooltips / values appear in the UI
    const targetSnapshot = target;
    const needsMeta = [...missingItems, ...missingWeapons].filter(name =>
      !getItemByName(name) && !WEAPON_TIPS[name] && !ITEM_TIPS[name] && !newInventory.item_meta?.[name]
    );
    if (needsMeta.length > 0) {
      fetch("/api/item-details", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ items: needsMeta, context: lastDm.content }),
      })
        .then(r => r.ok ? r.json() : { items: [] })
        .then((data: { items?: Array<{ name: string; description: string; value_gp?: number; rarity?: string; type?: string }> }) => {
          const list = Array.isArray(data.items) ? data.items : [];
          if (list.length === 0) return;
          const recipient = campaignPartyRef.current.find(c => c.id === targetSnapshot.id);
          if (!recipient) return;
          const validRarities = new Set(["common", "uncommon", "rare", "very_rare", "legendary"]);
          const mergedMeta: NonNullable<Character["inventory"]["item_meta"]> = { ...(recipient.inventory.item_meta ?? {}) };
          for (const it of list) {
            if (!it.name) continue;
            const rarity = validRarities.has(it.rarity ?? "") ? (it.rarity as "common" | "uncommon" | "rare" | "very_rare" | "legendary") : "common";
            mergedMeta[it.name] = {
              description: typeof it.description === "string" ? it.description : "",
              value_gp:    typeof it.value_gp === "number" && it.value_gp >= 0 ? it.value_gp : 0,
              rarity,
              type:        typeof it.type === "string" ? it.type : undefined,
            };
          }
          const enrichedInv = { ...recipient.inventory, item_meta: mergedMeta };
          const enrichedChar = { ...recipient, inventory: enrichedInv };
          if (characterRef.current?.id === recipient.id) {
            setCharacter(enrichedChar);
            characterRef.current = enrichedChar;
          }
          setCampaignParty(prev => prev.map(c => c.id === recipient.id ? { ...c, inventory: enrichedInv } : c));
          campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === recipient.id ? { ...c, inventory: enrichedInv } : c);
          charWriteRef.current?.(recipient.id, { inventory: enrichedInv });
          channelRef.current?.send({
            type: "broadcast", event: "character_sync",
            payload: { charId: recipient.id, inventory: enrichedInv },
          });
        })
        .catch(err => console.warn("[resume reconcile][item-details]", err));
    }
  }, [charWrite, charNameMatches]);

  // ── Audio-synced text reveal getter ─────────────────────────────────────────
  // Returns a 0-1 ratio of how much of the full narration text has been
  // "spoken" by the narrator, sampled live from the audio element. Used by
  // RevealText to render letters in lockstep with the voice — when the voice
  // is fast, text reveals fast; when the voice pauses between slots, text
  // pauses too. Returns null when no slot is currently sounding so RevealText
  // can either hold position or fall back to interval mode.
  const getNarrationProgress = useCallback((): number | null => {
    const slot = narActiveSlotRef.current;
    const slotTexts = narSlotTextsRef.current;
    if (!slotTexts.length) return null;

    // Total raw chars across every slot enqueued so far.
    let total = 0;
    for (const t of slotTexts) total += t?.length ?? 0;
    if (total <= 0) return null;

    // Raw chars completed by slots that are entirely behind us.
    let done = 0;
    if (slot < 0) {
      // No slot sounding right now — return progress based on how many slots
      // have fully finished playing (narPlaySlotRef advances past each one).
      const finished = Math.min(slotTexts.length, narPlaySlotRef.current);
      for (let i = 0; i < finished; i++) done += slotTexts[i]?.length ?? 0;
      return Math.min(1, done / total);
    }

    for (let i = 0; i < slot; i++) done += slotTexts[i]?.length ?? 0;

    // Add the in-progress slot's audio-relative position.
    const el = narAudioRef.current;
    const currentText = slotTexts[slot] ?? "";
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      const ratio = Math.min(1, Math.max(0, el.currentTime / el.duration));
      done += ratio * currentText.length;
    }
    return Math.min(1, done / total);
  }, []);

  // ── Ordered narration queue (slot-based) ──────────────────────────────────────
  // Each sentence gets a numbered slot BEFORE the async fetch so they always play in order.
  const playNextInQueue = useCallback(() => {
    if (audioPlayingRef.current) return;
    const slot = narPlaySlotRef.current;
    if (slot >= narSlotCounterRef.current) return;
    const entry = narSlotsRef.current[slot];
    if (entry === null || entry === undefined) return; // not ready yet — will retry when set
    narPlaySlotRef.current++;
    const playingSlot = slot; // remember which slot this clip belongs to for retry logic
    if (entry === "SKIP") {
      if (narPlaySlotRef.current >= narSlotCounterRef.current) setNarrating(false);
      playNextInQueue();
      return;
    }

    const el = narAudioRef.current;
    if (!el) { playNextInQueue(); return; }

    audioPlayingRef.current = true;
    const slotText = narSlotTextsRef.current[playingSlot] ?? "";
    console.log(`[narration] slot ${playingSlot} starting (${slotText.length} chars): "${slotText.slice(0, 60)}${slotText.length > 60 ? "…" : ""}"`);

    // Per-clip stuck-audio failsafe — cleared as soon as onended/onerror fire normally
    let stuckTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (stuckTimer) { clearTimeout(stuckTimer); stuckTimer = null; }
      el.oncanplaythrough = null;
      el.onerror          = null;
      el.onended          = null;
      el.onpause          = null;
      el.onplay           = null;
      audioPlayingRef.current = false;
      // Clear the active slot so the audio-synced reveal stops sampling this
      // element's currentTime (which would otherwise stay at duration and
      // erroneously hold the text at the end-of-slot position).
      narActiveSlotRef.current = -1;
      // Hold the text reveal while audio is silent (between slots). The next slot's
      // onplay handler flips this back to false so the typing resumes only when sound resumes.
      setNarRevealPaused(true);
      if (narPlaySlotRef.current >= narSlotCounterRef.current) setNarrating(false);
      playNextInQueue();
    };

    // Two-axis truncation detection — speech runs at ~12-15 chars/sec, so a clip should
    // be at least text.length / 25 seconds long (allowing fast voices). And once playing,
    // currentTime should approach duration. Either failure mode regen's with fresh:true.
    const tryRegen = (reason: string): boolean => {
      const text = narSlotTextsRef.current[playingSlot];
      const alreadyRetried = narSlotRetriedRef.current[playingSlot];
      if (!text || alreadyRetried) return false;
      console.warn(`[narration] ${reason} (slot ${playingSlot}) — regenerating`);
      narSlotRetriedRef.current[playingSlot] = true;
      narSlotsRef.current[playingSlot] = null;
      narPlaySlotRef.current = playingSlot; // rewind to replay once fresh URL is ready
      if (stuckTimer) { clearTimeout(stuckTimer); stuckTimer = null; }
      el.oncanplaythrough = null;
      el.onerror          = null;
      el.onended          = null;
      el.onplay           = null;
      el.onpause          = null;
      try { el.pause(); } catch { /* ignore */ }
      audioPlayingRef.current = false;
      fetchClipForSlotRef.current?.(playingSlot, text, true);
      return true;
    };

    const onEndedCheck = () => {
      const dur = el.duration;
      const cur = el.currentTime;
      console.log(`[narration] slot ${playingSlot} ended: ${cur.toFixed(2)}s / ${dur.toFixed(2)}s`);
      // Failure mode A: file's reported duration is fine but playback ended very early
      // (true mid-stream cutoff — rare but real).
      if (dur > 1 && cur > 0 && cur < dur * 0.92) {
        if (tryRegen(`mid-stream cutoff (${cur.toFixed(1)}s / ${dur.toFixed(1)}s)`)) return;
      }
      cleanup();
    };

    // Defensive resume — if SOMETHING pauses the audio mid-playback while we still expect
    // it to be playing (currentTime well below duration and we haven't requested a pause),
    // call play() again. This catches any external pause source (visibility changes, focus
    // loss, react re-renders, third-party effects) that would otherwise leave narration
    // permanently stuck mid-sentence.
    el.onpause = () => {
      // Only treat as unexpected if the clip hasn't reached its end and we still think we're playing
      if (!audioPlayingRef.current) return;
      const dur = el.duration;
      const cur = el.currentTime;
      if (!Number.isFinite(dur) || dur <= 0) return;
      if (cur >= dur - 0.15) return; // natural end — onended will fire
      console.warn(`[narration] unexpected pause at ${cur.toFixed(2)}s / ${dur.toFixed(2)}s (slot ${playingSlot}) — resuming`);
      const p = el.play();
      if (p instanceof Promise) p.catch(err => console.warn("[narration] resume failed:", err));
    };

    el.onended = onEndedCheck;
    el.onerror = cleanup;
    el.volume  = narMutedRef.current ? 0 : narVolumeRef.current;
    el.src = entry as string;
    // Wait for canplaythrough (same pattern as working ambiance player) before calling play().
    // Xbox Edge requires the browser to confirm data is available; calling play() immediately
    // after load() can silently fail on strict console browsers.
    el.oncanplaythrough = () => {
      el.oncanplaythrough = null;
      // Failure mode B: file's internal duration is shorter than the text would require —
      // ElevenLabs returned an MP3 that's "complete" but only covers part of the speech.
      // 25 chars/sec is the upper bound of fast speech; anything shorter than text/25 is bad.
      const text = narSlotTextsRef.current[playingSlot];
      const dur  = el.duration;
      if (text && dur > 0 && Number.isFinite(dur) && dur < text.length / 25) {
        if (tryRegen(`duration too short for text (${dur.toFixed(1)}s for ${text.length} chars, need ≥${(text.length / 25).toFixed(1)}s)`)) return;
      }
      // If onended never fires (CDN stall, browser quirk), force-cleanup after duration + 8 s buffer
      const clipMs = el.duration > 0 ? Math.ceil(el.duration * 1000) + 8000 : 30000;
      stuckTimer = setTimeout(() => {
        if (audioPlayingRef.current) {
          console.warn("[narration] clip stuck — forcing cleanup");
          el.pause();
          cleanup();
        }
      }, clipMs);
      setNarrating(true);
      setNarHeartbeat(h => h + 1); // bump watchdog — fresh clip is playing
      // Start text reveal the moment audio actually begins playing, not when it's merely buffered.
      // This guarantees voice and text are in sync — no blinking cursor before narrator speaks.
      // For ALL slots: unpause the reveal so typing resumes only while audio is sounding.
      // For slot 0 specifically: also compute the per-group interval from slot 0's duration.
      el.onplay = () => {
        el.onplay = null;
        // Mark this slot as the live one so the audio-synced reveal samples
        // its currentTime/duration for 1:1 voice ↔ text alignment.
        narActiveSlotRef.current = playingSlot;
        setNarRevealPaused(false);
        if (slot === 0 && narSlot0TextRef.current && dur > 0) {
          // Fallback interval — only kicks in if the audio progress getter
          // returns null (e.g. audio failed mid-flight). The RAF loop in
          // RevealText prefers the audio-synced path when available.
          const avgGroupSize = 1.3;
          const groups = (narSlot0TextRef.current.length) / avgGroupSize;
          const computed = Math.round((dur * 1000) / groups);
          setNarRevealIntervalMs(Math.max(24, Math.min(160, computed)));
        }
      };
      const p = el.play();
      if (p instanceof Promise) p.catch(() => cleanup());

      // While this clip plays, pre-warm the browser's HTTP cache for the next one.
      // Stored in narWarmupRef (not a local variable) so the element is not GC'd
      // before loading completes — ensuring canplaythrough fires near-instantly
      // on the main element instead of waiting for a full network round-trip.
      const nextSlot = narPlaySlotRef.current; // already incremented past current
      const nextEntry = narSlotsRef.current[nextSlot];
      if (nextEntry && nextEntry !== "SKIP" && typeof nextEntry === "string") {
        if (!narWarmupRef.current) narWarmupRef.current = new Audio();
        const warmup = narWarmupRef.current;
        warmup.preload = "auto";
        warmup.src = nextEntry;
        warmup.load();
      }
    };
    el.load();
  }, []);

  // Internal fetch — shared by initial enqueue and truncation retries
  const fetchClipForSlot = useCallback(async (slot: number, text: string, fresh: boolean) => {
    const myGen = narGenerationRef.current;
    try {
      const res = await fetch("/api/narrate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, voice: selectedVoiceRef.current ?? "chronicler", ...(fresh && { fresh: true }) }),
      });
      if (narGenerationRef.current !== myGen) return;
      if (!res.ok) {
        if (res.status === 402) {
          setNarrationEnabled(false);
          narrationEnabledRef.current = false;
          setToastMsg("Voice narration quota reached — upgrade your ElevenLabs plan to re-enable it.");
        }
        narSlotsRef.current[slot] = "SKIP";
      } else {
        const { audioUrl } = await res.json() as { audioUrl?: string };
        narSlotsRef.current[slot] = audioUrl ?? "SKIP";
      }
    } catch {
      if (narGenerationRef.current !== myGen) return;
      narSlotsRef.current[slot] = "SKIP";
    }
    if (narGenerationRef.current === myGen) playNextInQueue();
  }, [playNextInQueue]);

  // Expose latest fetcher to playNextInQueue (used for truncation regen)
  useEffect(() => { fetchClipForSlotRef.current = fetchClipForSlot; }, [fetchClipForSlot]);

  const enqueueNarration = useCallback(async (text: string) => {
    // Defensive scrub + split — every entry point into the queue (streaming, resume,
    // party-event, cached replay) runs through here.
    //   • stripTtsArtifacts removes leaked system tokens ([HP:Aria:-9], [1d8+3],
    //     etc.) and markdown asterisks before they reach the TTS engine.
    //   • pullNarrationChunks splits text > ~280 chars so a single mega-clip never
    //     blows past the 45s watchdog.
    const scrubbed = stripTtsArtifacts(text);
    if (!scrubbed) return;
    const { chunks } = pullNarrationChunks(scrubbed, true);
    const toEnqueue = chunks.length > 0 ? chunks : (scrubbed.trim() ? [scrubbed] : []);
    if (toEnqueue.length === 0) return;
    const tasks: Promise<void>[] = [];
    for (const chunkText of toEnqueue) {
      const slot = narSlotCounterRef.current++;
      if (slot === 0) narSlot0TextRef.current = chunkText;
      narSlotsRef.current[slot] = null;
      narSlotTextsRef.current[slot] = chunkText;
      narSlotRetriedRef.current[slot] = false;
      tasks.push(fetchClipForSlot(slot, chunkText, false));
    }
    await Promise.all(tasks);
  }, [fetchClipForSlot]);
  // Keep the loading-screen effect's narration call up to date
  useEffect(() => { enqueueNarrationRef.current = enqueueNarration; }, [enqueueNarration]);

  // ── Party join/leave narration ────────────────────────────────────────────────
  // Joins are debounced 8 s so multiple arrivals batch into one DM announcement.
  // Leave / kick fire immediately.
  const fireDmPartyResponse = useCallback(async (
    trigger: Message,
    ctx?: {
      party?: Character[];
      campaignContext?: { title: string; description: string };
      partyLeaderName?: string | null;
      turnOrder?: string[];
    }
  ) => {
    if (isTypingRef.current) return;
    setPartyChangePending(false);
    setIsTyping(true); isTypingRef.current = true;
    setStreamingContent("");
    narGenerationRef.current++; narSlotCounterRef.current = 0; narSlotsRef.current = []; narSlotTextsRef.current = []; narSlotRetriedRef.current = []; narPlaySlotRef.current = 0;
    audioPlayingRef.current = false;
    narSlot0TextRef.current = null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messagesRef.current, trigger],
          character: characterRef.current,
          ...(ctx?.party && ctx.party.length > 1 && { party: ctx.party }),
          ...(ctx?.campaignContext && { campaignContext: ctx.campaignContext }),
          ...(ctx?.partyLeaderName && { partyLeaderName: ctx.partyLeaderName }),
          ...(ctx?.turnOrder && ctx.turnOrder.length > 1 && { turnOrder: ctx.turnOrder }),
        }),
      });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "", narBuf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk; narBuf += chunk;
        if (full.length >= 15 || /[.!?…]/.test(full)) setStreamingContent(full);
        if (narrationEnabledRef.current) {
          const { chunks: sents, remaining } = pullNarrationChunks(narBuf, false);
          let stopped = false;
          for (const s of sents) {
            if (/\broll\s+a\s+d\d+\b/i.test(s)) { narBuf = ""; stopped = true; break; }
            const cleaned = stripSystemLeaks(s);
            if (cleaned) enqueueNarration(cleaned);
          }
          if (!stopped) narBuf = remaining;
        }
      }
      // Same tail-guard rationale as the other final-flush — raise 8→24 so
      // sub-prosody-window stubs don't get sent to TTS and come back garbled.
      if (narrationEnabledRef.current && narBuf.trim().length > 24) {
        const { chunks: tail } = pullNarrationChunks(narBuf, true);
        for (const s of tail) {
          const cleaned = stripSystemLeaks(s);
          if (cleaned) enqueueNarration(cleaned);
        }
      }
      setMessages(prev => [...prev, { role: "dm", content: full }]);
      setLogEntries(prev => [...prev, { id: makeLogId("dm"), timestamp: new Date(), role: "dm", content: full }]);
      supabase.from("campaign_messages").insert([{ campaign_id: params.id, role: "dm", content: full, sender: null }])
        .then(({ error }) => { if (error) console.error("[party event]", error); });
      channelRef.current?.send({ type: "broadcast", event: "dm_response", payload: { senderId: userIdRef.current, content: full, actingCharId: characterRef.current?.id ?? null } });
      const isPartyEventMyTurn = turnOrderRef.current.length <= 1 || turnOrderRef.current[currentTurnIndexRef.current] === characterRef.current?.id;
      if (isPartyEventMyTurn && characterRef.current) {
        fetch("/api/suggest-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildSuggestActionsBody(full, characterRef.current)) })
          .then(r => r.json()).then(({ suggestions: s }) => setSuggestions(s ?? [])).catch(() => {});
      }
    } catch { /* best effort */ } finally {
      setIsTyping(false); isTypingRef.current = false;
      setStreamingContent("");
      channelRef.current?.send({ type: "broadcast", event: "dm_typing", payload: { senderId: userIdRef.current, typing: false } });
    }
  }, [params.id, enqueueNarration]);

  const removeFromParty = useCallback(async (char: Character) => {
    await supabase.from("characters").update({ campaign_id: null }).eq("id", char.id);
    setCampaignParty(prev => { const next = prev.filter(c => c.id !== char.id); campaignPartyRef.current = next; return next; });
  }, []);

  const transferLeadership = useCallback(async (targetCharId: string) => {
    const { error } = await supabase.from("campaigns").update({ party_leader_id: targetCharId }).eq("id", params.id);
    if (error) { console.error("[transfer leader]", error.message); return; }
    setPartyLeaderId(targetCharId);
    channelRef.current?.send({ type: "broadcast", event: "leader_changed", payload: { newLeaderId: targetCharId } });
  }, [params.id]);

  const handleShortRest = useCallback(async () => {
    const char = characterRef.current;
    if (!char) return;
    const hitDie     = CLASS_HIT_DIE[char.class] ?? 8;
    const roll       = Math.floor(Math.random() * hitDie) + 1;
    const conMod     = Math.floor((char.constitution - 10) / 2);
    const gained     = Math.max(1, roll + conMod);
    const restIb     = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
    const restMaxHp  = char.max_hp + restIb.hpMaxAdd;
    const newHp      = Math.min(restMaxHp, char.hp + gained);
    const isWarlock = char.class === "Warlock";
    // Warlock recovers all pact slots on short rest
    const newSlotsUsed = isWarlock ? {} : { ...(char.spell_slots_used ?? {}) };
    // Reset short-rest class resources
    const shortResetKeys = SHORT_REST_RESET_KEYS[char.class] ?? [];
    const isBardL5Plus = char.class === "Bard" && char.level >= 5;
    const newClassResources = { ...(char.class_resources ?? {}) };
    for (const key of shortResetKeys) delete newClassResources[key];
    if (isBardL5Plus) delete newClassResources["bardic_inspiration"];
    // Clear temporary status effects on rest
    const newStatuses = (char.status_effects ?? []).filter(s => !["Prone", "Frightened", "Stunned"].includes(s));
    const updated: Character = { ...char, hp: newHp, spell_slots_used: newSlotsUsed, class_resources: newClassResources, status_effects: newStatuses };
    setCharacter(updated);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updated : c));
    await charWrite(char.id, { hp: newHp, spell_slots_used: newSlotsUsed, class_resources: newClassResources, status_effects: newStatuses });
    channelRef.current?.send({
      type: "broadcast", event: "character_sync",
      payload: { charId: char.id, hp: newHp, max_hp: char.max_hp, xp: char.xp, level: char.level, inventory: char.inventory, spell_slots_used: newSlotsUsed, class_resources: newClassResources, status_effects: newStatuses },
    });
    const notice = `Short Rest: d${hitDie} rolled ${roll} + CON ${conMod >= 0 ? "+" : ""}${conMod} = +${gained} HP${isWarlock ? " · Pact slots restored" : ""}`;
    setStateNotice(notice);
    setTimeout(() => setStateNotice(null), 5000);
    setLogEntries(prev => [...prev, { id: makeLogId("rest"), timestamp: new Date(), role: "system", content: `🌙 ${notice}` }]);
  }, [charWrite]);

  const handleLongRest = useCallback(async () => {
    const char = characterRef.current;
    if (!char) return;
    // Long rest: full HP (including item bonuses), all slots, clear non-permanent conditions
    const longIb      = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
    const longMaxHp   = char.max_hp + longIb.hpMaxAdd;
    const newStatuses = (char.status_effects ?? []).filter(s => s === "Dead" || s === "Petrified");
    const updated: Character = { ...char, hp: longMaxHp, spell_slots_used: {}, class_resources: {}, status_effects: newStatuses };
    setCharacter(updated);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updated : c));
    await charWrite(char.id, { hp: longMaxHp, spell_slots_used: {}, class_resources: {}, status_effects: newStatuses });
    channelRef.current?.send({
      type: "broadcast", event: "character_sync",
      payload: { charId: char.id, hp: longMaxHp, max_hp: char.max_hp, xp: char.xp, level: char.level, inventory: char.inventory, spell_slots_used: {}, class_resources: {}, status_effects: newStatuses },
    });
    const notice = `Long Rest: HP fully restored (${longMaxHp}), spell slots & class abilities recovered, conditions cleared`;
    setStateNotice(notice);
    setTimeout(() => setStateNotice(null), 6000);
    setLogEntries(prev => [...prev, { id: makeLogId("rest"), timestamp: new Date(), role: "system", content: `☀️ Long Rest — ${char.name} is fully restored.` }]);
  }, [charWrite]);

  const handleUseClassAbility = useCallback(async (resourceKey: string, cost: number) => {
    const char = characterRef.current;
    if (!char) return;
    const resources = CLASS_RESOURCES[char.class] ?? [];
    const resDef = resources.find(r => r.key === resourceKey);
    if (!resDef) return;
    const statArr: [number, number, number, number, number, number] = [char.charisma, char.wisdom, char.constitution, char.strength, char.intelligence, char.dexterity];
    const maxVal = resDef.getMax(char.level, ...statArr);
    const currentUsed = (char.class_resources ?? {})[resourceKey] ?? 0;
    const available = Math.max(0, maxVal - currentUsed);
    if (available < cost && resDef.unit !== "passive") return;
    // Play the synthesized class-ability cue (rage growl, ki gong, etc.). For
    // wild_shape, the form isn't known yet — the form-specific bear/wolf/eagle
    // voice fires later when the DM streams the [WILDSHAPE:Name:Form] tag.
    playAbilitySound(resourceKey);
    // Brief colored pulse on the active card portrait — color matches the
    // resource's theme so each ability has a unique visual signature.
    triggerAbilityFlash(char.id, resDef.color);
    const newUsed = currentUsed + cost;
    const newClassResources = { ...(char.class_resources ?? {}), [resourceKey]: newUsed };
    // Self-applied persistent buffs. Currently: Rage on/off — "Enter Rage"
    // (cost > 0) adds the Raging status; "End Rage" (cost 0) removes it.
    // The card glow + 🔥 badge come for free via getCardEffectGlow.
    let newStatusEffects = char.status_effects ?? [];
    if (resourceKey === "rage") {
      if (cost > 0) {
        if (!newStatusEffects.includes("Raging")) newStatusEffects = [...newStatusEffects, "Raging"];
      } else {
        newStatusEffects = newStatusEffects.filter(s => s !== "Raging");
      }
    }
    const updated = { ...char, class_resources: newClassResources, status_effects: newStatusEffects };
    setCharacter(updated);
    characterRef.current = updated;
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updated : c));
    campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === char.id ? updated : c);
    await charWrite(char.id, { class_resources: newClassResources, status_effects: newStatusEffects });
    channelRef.current?.send({
      type: "broadcast", event: "character_sync",
      payload: {
        charId: char.id, hp: char.hp, max_hp: char.max_hp,
        xp: char.xp, level: char.level,
        inventory: char.inventory, spell_slots_used: char.spell_slots_used ?? {},
        class_resources: newClassResources, status_effects: newStatusEffects,
      },
    });
  }, [charWrite, triggerAbilityFlash]);

  const handlePartyShortRest = useCallback(async () => {
    const party = campaignPartyRef.current;
    if (!party.length) return;

    const updates = party.map(char => {
      const hitDie    = CLASS_HIT_DIE[char.class] ?? 8;
      const roll      = Math.floor(Math.random() * hitDie) + 1;
      const conMod    = Math.floor((char.constitution - 10) / 2);
      const gained    = Math.max(1, roll + conMod);
      const ib        = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
      const maxHp     = char.max_hp + ib.hpMaxAdd;
      const newHp     = Math.min(maxHp, char.hp + gained);
      const isWarlock = char.class === "Warlock";
      const newSlots  = isWarlock ? {} : { ...(char.spell_slots_used ?? {}) };
      const newStatus = (char.status_effects ?? []).filter(s => !["Prone", "Frightened", "Stunned"].includes(s));
      // Reset short-rest class resources (Monk ki, Barbarian rage, etc.)
      const shortResetKeys = SHORT_REST_RESET_KEYS[char.class] ?? [];
      const isBardL5Plus   = char.class === "Bard" && char.level >= 5;
      const newClassRes    = { ...(char.class_resources ?? {}) };
      for (const key of shortResetKeys) delete newClassRes[key];
      if (isBardL5Plus) delete newClassRes["bardic_inspiration"];
      return { char, newHp, newSlots, newStatus, newClassRes, gained };
    });

    await Promise.all(updates.map(u =>
      charWrite(u.char.id, { hp: u.newHp, spell_slots_used: u.newSlots, class_resources: u.newClassRes, status_effects: u.newStatus })
    ));

    setCampaignParty(prev => prev.map(c => {
      const u = updates.find(x => x.char.id === c.id);
      return u ? { ...c, hp: u.newHp, spell_slots_used: u.newSlots, class_resources: u.newClassRes, status_effects: u.newStatus } : c;
    }));

    const activeU = updates.find(u => u.char.id === characterRef.current?.id);
    if (activeU) {
      const updated = { ...activeU.char, hp: activeU.newHp, spell_slots_used: activeU.newSlots, class_resources: activeU.newClassRes, status_effects: activeU.newStatus };
      setCharacter(updated); characterRef.current = updated;
    }

    updates.forEach(u => channelRef.current?.send({
      type: "broadcast", event: "character_sync",
      payload: { charId: u.char.id, hp: u.newHp, max_hp: u.char.max_hp, xp: u.char.xp, level: u.char.level, inventory: u.char.inventory, spell_slots_used: u.newSlots, class_resources: u.newClassRes, status_effects: u.newStatus },
    }));
    const summary = updates.map(u => `${u.char.name} +${u.gained} HP`).join(" · ");
    setStateNotice(`Party Short Rest: ${summary}`);
    setTimeout(() => setStateNotice(null), 6000);
    setLogEntries(prev => [...prev, { id: makeLogId("rest"), timestamp: new Date(), role: "system", content: `🌙 Party Short Rest — ${summary}` }]);
  }, [charWrite]);

  const handlePartyLongRest = useCallback(async () => {
    const party = campaignPartyRef.current;
    if (!party.length) return;

    const updates = party.map(char => {
      const ib        = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
      const maxHp     = char.max_hp + ib.hpMaxAdd;
      const newStatus = (char.status_effects ?? []).filter(s => s === "Dead" || s === "Petrified");
      return { char, maxHp, newStatus };
    });

    await Promise.all(updates.map(u =>
      charWrite(u.char.id, { hp: u.maxHp, spell_slots_used: {}, class_resources: {}, status_effects: u.newStatus })
    ));

    setCampaignParty(prev => prev.map(c => {
      const u = updates.find(x => x.char.id === c.id);
      return u ? { ...c, hp: u.maxHp, spell_slots_used: {}, class_resources: {}, status_effects: u.newStatus } : c;
    }));

    const activeU = updates.find(u => u.char.id === characterRef.current?.id);
    if (activeU) {
      const updated = { ...activeU.char, hp: activeU.maxHp, spell_slots_used: {}, class_resources: {}, status_effects: activeU.newStatus };
      setCharacter(updated); characterRef.current = updated;
    }

    updates.forEach(u => channelRef.current?.send({
      type: "broadcast", event: "character_sync",
      payload: { charId: u.char.id, hp: u.maxHp, max_hp: u.char.max_hp, xp: u.char.xp, level: u.char.level, inventory: u.char.inventory, spell_slots_used: {}, class_resources: {}, status_effects: u.newStatus },
    }));
    const names = updates.map(u => u.char.name).join(", ");
    setStateNotice("Party Long Rest: Full HP restored, all spell slots recovered");
    setTimeout(() => setStateNotice(null), 6000);
    setLogEntries(prev => [...prev, { id: makeLogId("rest"), timestamp: new Date(), role: "system", content: `☀️ Party Long Rest — ${names} fully restored.` }]);
  }, [charWrite]);

  // ── Combat: enemy generation and state tracking ───────────────────────────────
  const detectCombatStart = (text: string): boolean =>
    /\b(roll(?:s)? (?:for )?initiative|initiative (?:order|is rolled|begins)|combat begins?|battle begins?|fights? break(?:s)? out)\b/i.test(text);

  const spawnEnemies = useCallback(async (context: string) => {
    const party = campaignPartyRef.current.map(c => ({ name: c.name, race: c.race, class: c.class, level: c.level }));
    if (!party.length) return;
    try {
      const res = await fetch("/api/enemies/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: params.id, party, context }),
      });
      const { enemies: spawned } = await res.json() as { enemies: CampaignEnemy[] };
      if (!spawned.length) return;
      setEnemies(spawned);
      enemiesRef.current = spawned;
      setCombatActive(true);
      setSidebarTab("combat");
      channelRef.current?.send({ type: "broadcast", event: "enemies_spawned", payload: { enemies: spawned } });
      // Immediately switch to combat music without waiting for scene image generation
      const combatSceneName = currentSceneRef.current.replace(/_combat$/, "") + "_combat";
      (window as Window).__dndSetMusicScene?.(combatSceneName);
    } catch (err) {
      console.error("[spawnEnemies]", err);
    }
  }, [params.id]);

  const updateEnemyStates = useCallback(async (narrative: string) => {
    const active = enemiesRef.current.filter(e => !e.is_defeated);
    if (!active.length) return;
    try {
      const res = await fetch("/api/enemies/state", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative, enemies: active.map(e => ({ id: e.id, name: e.name })) }),
      });
      const { changes, combat_ended } = await res.json() as {
        changes: { name: string; condition: EnemyCondition; is_defeated: boolean; status_effects_gained: string[]; status_effects_lost: string[] }[];
        combat_ended: boolean;
      };
      if (changes.length) {
        setEnemies(prev => {
          const updated = prev.map(e => {
            const ch = changes.find(c => c.name === e.name);
            if (!ch) return e;
            return {
              ...e,
              condition:      ch.condition,
              is_defeated:    ch.is_defeated || e.is_defeated,
              status_effects: [...e.status_effects.filter(s => !ch.status_effects_lost?.includes(s)), ...(ch.status_effects_gained ?? [])],
            };
          });
          enemiesRef.current = updated;
          return updated;
        });
        channelRef.current?.send({ type: "broadcast", event: "enemies_updated", payload: { changes, combat_ended } });
      }
      if (combat_ended) {
        setCombatActive(false);
        // Return to ambient scene music when combat ends
        const ambientScene = currentSceneRef.current.replace(/_combat$/, "");
        (window as Window).__dndSetMusicScene?.(ambientScene);
      }
    } catch (err) {
      console.error("[updateEnemyStates]", err);
    }
  }, []);

  // ── Strip internal system annotations from DM output ────────────────────────
  // The AI occasionally echoes system-prompt instruction text. Strip it before
  // displaying or narrating, but keep raw content in the story log for debugging.
  const stripSystemLeaks = useCallback((text: string): string => {
    return text
      .replace(/\[ROUND RECONCILIATION[^\]]*\]/gi, "")
      .replace(/\[ALL PLAYERS HAVE ACTED[^\]]*\]/gi, "")
      .replace(/\[CURRENT TURN[^\]]*\]/gi, "")
      .replace(/\[RECAP\]\s*/gi, "")
      .replace(/\[HP:[^\]]+\]/gi, "")
      .replace(/\[THP:[^\]]+\]/gi, "")
      .replace(/\[NO-?TURN\]/gi, "")
      .replace(/\[WILDSHAPE:[^\]]+\]/gi, "")
      .replace(/\[RAGE:[^\]]+\]/gi, "")
      .replace(/\[INSPIRED:[^\]]+\]/gi, "")
      .replace(/\[MARK:[^\]]+\]/gi, "")
      .replace(/\[ABILITY:[^\]]+\]/gi, "")
      .replace(/\[SPELL:[^\]]+\]/gi, "")
      .replace(/\[GOLD:[^\]]+\]/gi, "")
      .replace(/\[LOOT:[^\]]+\]/gi, "")
      .replace(/\[WEAPON:[^\]]+\]/gi, "")
      .replace(/\[ITEM-?LOST:[^\]]+\]/gi, "")
      .replace(/\[XP:[^\]]+\]/gi, "")
      .replace(/^ALL PLAYERS HAVE ACTED[^\n]*/gim, "")
      .replace(/^DO NOT CALL NEXT TURN[^\n]*/gim, "")
      .replace(/^ROLL RESTRICTION:[^\n]*/gim, "")
      .replace(/^PARTY —[^\n]*/gim, "")
      // Strip attack-roll math lines — e.g. "11 + 3 [STR] + 2 [Prof] = 16 — hits AC 14!"
      // Identified by bracket-enclosed stat/modifier labels specific to these math displays
      .replace(/\b\d+[^.!?\n]*\[(?:STR|DEX|CON|INT|WIS|CHA|Prof|Spell ATK|\+\d[^\]]*)\][^.!?\n]*[.!?]?/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }, []);

  // ── Dice-roll target detection ────────────────────────────────────────────────
  const detectDiceRollTarget = useCallback((narrative: string): string | null => {
    const names = campaignPartyRef.current.map(c => c.name).filter(Boolean);
    if (!names.length) return null;

    // Pass 1 — sentence-scoped: find sentences that are explicit roll requests,
    // then look for a player name inside only those sentences. This prevents a
    // name mentioned in narrative ("Thorin charges the orc") from stealing the
    // roll assignment when the actual request ("Aria, make a save") is elsewhere.
    const sentences = narrative.split(/(?<=[.!?\n])\s*/);
    const rollSentences = sentences.filter(s =>
      /\b(?:roll|make|give me)\b/i.test(s) &&
      /\b(?:check|save|saving throw|attack(?: roll)?|initiative|d\d+)\b/i.test(s)
    );
    for (const name of names) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (rollSentences.some(s => new RegExp(`\\b${esc}\\b`, "i").test(s))) return name;
    }

    // Pass 2 — pattern-based fallback on the full text, covering phrasings
    // that span sentence boundaries or use indirect constructions.
    for (const name of names) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        // "Aria, roll..." / "Aria, make..." / "Aria, please roll..." / "Aria, you roll..."
        new RegExp(`\\b${esc}[,.]?\\s+(?:please\\s+)?(?:you\\s+)?(?:roll|make|attempt)`, "i"),
        // "roll for Aria" / "rolls for Aria"
        new RegExp(`roll[s]?[^.!?]{0,80}\\bfor\\s+${esc}\\b`, "i"),
        // "Aria, you need to / must / have to / should roll"
        new RegExp(`\\b${esc}[,.]?\\s+(?:you|your)\\s+(?:need|must|have to|should)`, "i"),
        // "Aria's roll / check / save" — deliberately excludes "turn" ("Barnabus's turn" is not a roll request)
        new RegExp(`\\b${esc}'s?\\s+(?:roll|check|saving throw|save)`, "i"),
        // "need Aria to roll" / "have Aria make" / "let's have Aria roll" / "ask Aria to make"
        new RegExp(`\\b(?:need|have|ask|want|let(?:'s)?)\\s+(?:\\w+\\s+){0,2}${esc}\\s+to\\s+(?:roll|make)`, "i"),
      ];
      if (patterns.some(p => p.test(narrative))) return name;
    }

    return null;
  }, []);

  // ── Roll mode detection (advantage / disadvantage) ───────────────────────────
  const detectRollMode = useCallback((narrative: string): "advantage" | "disadvantage" | "normal" => {
    if (/\b(roll(?:s)?\s+(?:it\s+)?with\s+advantage|advantage\s+on\s+(?:the\s+)?(?:roll|check|save|saving throw|attack)|has?\s+advantage\s+on\s+(?:this|the|that)?)\b/i.test(narrative)) return "advantage";
    if (/\b(roll(?:s)?\s+(?:it\s+)?with\s+disadvantage|disadvantage\s+on\s+(?:the\s+)?(?:roll|check|save|saving throw|attack)|has?\s+disadvantage\s+on\s+(?:this|the|that)?)\b/i.test(narrative)) return "disadvantage";
    return "normal";
  }, []);

  // ── Dice type detection ──────────────────────────────────────────────────────
  const detectRequiredDiceType = useCallback((narrative: string): number | null => {
    // Explicit die mention: "roll a d6", "roll 2d8", "d20 check"
    const explicit = narrative.match(/\broll\s+(?:\d+)?d(\d+)\b/i)
      ?? narrative.match(/\bd(\d+)\b/i);
    if (explicit) {
      const n = parseInt(explicit[1]);
      if ([4, 6, 8, 10, 12, 20, 100].includes(n)) return n;
    }
    // Ability checks / saving throws / attack rolls / initiative = d20
    const d20 = [
      /\broll\s+(?:a\s+)?(?:\w[\w\s]{0,20})?\b(?:check|save|saving throw|attack roll|attack|initiative)\b/i,
      /\bmake\s+(?:a\s+)?(?:\w[\w\s]{0,20})?\b(?:check|save|saving throw|roll)\b/i,
      /\bgive me\s+(?:a\s+)?(?:\w[\w\s]{0,20})?\b(?:check|save|roll)\b/i,
      /\broll\s+(?:for\s+)?(?:initiative|stealth|perception|athletics|acrobatics|persuasion|deception|insight|investigation|arcana|history|nature|religion|survival|medicine|performance|intimidation)\b/i,
    ];
    if (d20.some(p => p.test(narrative))) return 20;
    return null;
  }, []);

  // ── AI call ───────────────────────────────────────────────────────────────────
  const sendToAI = async (allMessages: Message[], isOpeningScene = false, opts?: { trackRound?: boolean; roundSummary?: { name: string; action: string }[]; nextPlayerName?: string | null; prevPlayerName?: string | null; allActed?: boolean; preserveNarration?: boolean; isRollResult?: boolean; isTurnSkip?: boolean; skippedPlayerName?: string; isGroupCheckResult?: boolean; turnOrder?: string[]; isQuestion?: boolean; isResumeRecap?: boolean; departedAddresseeName?: string; _retryCount?: number }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset the single-broadcast latch HERE (not just at the top of handleSend)
    // so it can't leak between sendToAI calls. triggerReconciliation and
    // handleTurnSkip both invoke sendToAI directly — if the latch was already
    // set true by a prior cycle, every DM-routing branch inside this new
    // sendToAI would silently suppress its turn_taken broadcast, and peers
    // would never see the routing decision.
    turnBroadcastedThisCycleRef.current = false;

    // Reset narration queue unless we want to continue from a prior DM response (e.g. reconciliation after allActed)
    if (!opts?.preserveNarration) {
      // Stop any in-flight audio immediately so old narration never bleeds into new DM text.
      if (narAudioRef.current) { narAudioRef.current.pause(); narAudioRef.current.src = ""; }
      audioPlayingRef.current = false;
      setNarrating(false);
      narGenerationRef.current++; narSlotCounterRef.current = 0; narSlotsRef.current = []; narSlotTextsRef.current = []; narSlotRetriedRef.current = []; narPlaySlotRef.current = 0;
      narSlot0TextRef.current = null;
      setNarRevealText(null);
      setNarRevealIntervalMs(null);
      setNarRevealPaused(true);
    }

    setIsTyping(true); isTypingRef.current = true;
    setStreamingContent("");
    setSuggestions([]);
    channelRef.current?.send({ type: "broadcast", event: "dm_typing", payload: { senderId: userId, typing: true } });

    try {
      const charForDM = character ? (() => {
        const inv = character.inventory ?? { gold: 0, items: [], weapons: [] };
        const ib  = computeInventoryBonuses(inv.items, inv.weapons);
        const baseAC = computeAC(character.class, character.dexterity, character.constitution, character.wisdom, inv.items, inv.weapons);
        return {
          ...character,
          strength:     getEffectiveStat(character.strength,     "strength",     ib),
          dexterity:    getEffectiveStat(character.dexterity,    "dexterity",    ib),
          constitution: getEffectiveStat(character.constitution, "constitution", ib),
          intelligence: getEffectiveStat(character.intelligence, "intelligence", ib),
          wisdom:       getEffectiveStat(character.wisdom,       "wisdom",       ib),
          charisma:     getEffectiveStat(character.charisma,     "charisma",     ib),
          ac: baseAC + ib.acAdd,
          active_item_effects: ib.activeEffects.map(e => `${e.itemName}: ${e.text}`),
        };
      })() : null;

      const onlineParty = campaignPartyRef.current;

      const partyForDM = onlineParty.length > 1
        ? onlineParty.map(c => {
            const inv  = c.inventory ?? { gold: 0, items: [], weapons: [] };
            const ib   = computeInventoryBonuses(inv.items, inv.weapons);
            const baseAC = computeAC(c.class, c.dexterity, c.constitution, c.wisdom, inv.items, inv.weapons);
            return {
              ...c,
              strength:     getEffectiveStat(c.strength,     "strength",     ib),
              dexterity:    getEffectiveStat(c.dexterity,    "dexterity",    ib),
              constitution: getEffectiveStat(c.constitution, "constitution", ib),
              intelligence: getEffectiveStat(c.intelligence, "intelligence", ib),
              wisdom:       getEffectiveStat(c.wisdom,       "wisdom",       ib),
              charisma:     getEffectiveStat(c.charisma,     "charisma",     ib),
              ac: baseAC + ib.acAdd,
              active_item_effects: ib.activeEffects.map(e => `${e.itemName}: ${e.text}`),
            };
          })
        : undefined;


      const campaignCtx = campaignDescriptionRef.current
        ? { title: campaignTitle, description: campaignDescriptionRef.current }
        : undefined;

      const activeEnemiesForDM = enemiesRef.current
        .filter(e => !e.is_defeated)
        .map(e => ({
          name: e.name, enemy_type: e.enemy_type, cr: e.cr, ac: e.ac,
          attack_bonus: e.attack_bonus, damage_dice: e.damage_dice,
          max_hp: e.max_hp, condition: e.condition,
          abilities: e.abilities, loot: e.loot, xp_value: e.xp_value,
        }));

      const currentTurnCharId = turnOrderRef.current[currentTurnIndexRef.current] ?? null;
      const rollRequestUid    = rollRequestedUserIdRef.current ?? null;
      const rollRequestName   = rollRequestUid
        ? (onlineParty.find(c => c.user_id === rollRequestUid)?.name ?? null)
        : null;
      const currentTurnName   = currentTurnCharId
        ? (campaignPartyRef.current.find(c => c.id === currentTurnCharId)?.name ?? null)
        : null;
      // Remaining turn order — unacted players only, starting from the current player.
      // Passed players are excluded so the DM never cycles back to them via TURN ORDER / UP NEXT.
      const actedIds = new Set(roundActionsRef.current.map(a => a.characterId));
      const unactedIds   = turnOrderRef.current.filter(id => !actedIds.has(id));
      const currentActorId   = turnOrderRef.current[currentTurnIndexRef.current] ?? null;
      const currentUnactedIdx = currentActorId ? unactedIds.indexOf(currentActorId) : -1;
      // Rotate list so current player is first (e.g. [C, B] not [B, C] when C is acting)
      const reorderedUnacted = currentUnactedIdx > 0
        ? [...unactedIds.slice(currentUnactedIdx), ...unactedIds.slice(0, currentUnactedIdx)]
        : unactedIds;
      const turnOrderNames = reorderedUnacted.length > 1
        ? reorderedUnacted
            .map(id => campaignPartyRef.current.find(c => c.id === id)?.name ?? null)
            .filter((n): n is string => n !== null)
        : [];

      // Party leader for group roll routing
      const partyLeaderChar = onlineParty.find(c => c.id === partyLeaderId);
      const partyLeaderName = partyLeaderChar?.name ?? null;

      // When all players have acted, don't address anyone — reconciliation handles next prompt
      // Otherwise: roll target > pre-computed next player > current turn char > solo fallback
      const nextPromptName = opts?.allActed
        ? null
        : (rollRequestName
            ?? opts?.nextPlayerName
            ?? (turnOrderRef.current.length > 1 ? currentTurnName : null)
            ?? (onlineParty.length === 1 ? onlineParty[0]?.name : null)
            ?? character?.name);
      const prevActorName  = opts?.prevPlayerName ?? null;
      const targetedEnemy  = targetedEnemyId ? enemiesRef.current.find(e => e.id === targetedEnemyId && !e.is_defeated) : null;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages, character: charForDM, party: partyForDM,
          campaignContext: campaignCtx,
          enemies: activeEnemiesForDM.length ? activeEnemiesForDM : undefined,
          ...(isOpeningScene && { openingScene: true }),
          ...(nextPromptName && { currentTurnPlayerName: nextPromptName }),
          ...(prevActorName && nextPromptName && prevActorName !== nextPromptName && { prevActingPlayerName: prevActorName }),
          ...(targetedEnemy && { targetedEnemyName: targetedEnemy.name }),
          ...(opts?.roundSummary?.length && { roundSummary: opts.roundSummary }),
          ...(opts?.allActed && { pendingReconciliation: true }),
          ...(opts?.isRollResult && { isRollResult: true }),
          ...(opts?.isTurnSkip && { isTurnSkip: true }),
          ...(opts?.skippedPlayerName && { skippedPlayerName: opts.skippedPlayerName }),
          ...(opts?.isGroupCheckResult && { isGroupCheckResult: true }),
          ...(opts?.isQuestion && { isQuestion: true }),
          ...(opts?.isResumeRecap && { resumeRecap: true }),
          ...(opts?.departedAddresseeName && { departedAddresseeName: opts.departedAddresseeName }),
          ...(turnOrderNames.length > 1 && !opts?.roundSummary?.length && { turnOrder: turnOrderNames }),
          ...(partyLeaderName && { partyLeaderName }),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("DM unavailable");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full    = "";
      let narBuf  = "";
      let narDone = false; // set true once we've enqueued enough narration for this response

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full   += chunk;
        narBuf += chunk;
        // Only surface content once we have a meaningful fragment — prevents bare "PlayerName," flashes
        if (full.length >= 15 || /[.!?…]/.test(full)) setStreamingContent(full);
        // Sentence-level streaming narration — pulls EVERY complete sentence per chunk so
        // a single big chunk doesn't dump the whole response into one mega-clip.
        if (narrationEnabledRef.current && !campaignLoadingRef.current && !narDone) {
          const { chunks: sents, remaining } = pullNarrationChunks(narBuf, false);
          for (const s of sents) {
            // Stop streaming narration at a roll request — post-roll text may be truncated
            // from the display, so we must not narrate it
            if (/\broll\s+a\s+d\d+\b/i.test(s)) { narBuf = ""; narDone = true; break; }
            const cleaned = stripSystemLeaks(s);
            if (cleaned) enqueueNarration(cleaned);
          }
          if (!narDone) narBuf = remaining;
        }
      }
      // Client-side safeguard: truncate anything the DM wrote after a roll request.
      // The model is instructed to stop at "Roll a dN." but sometimes ignores it.
      {
        const rollSentRe = /\broll\s+a\s+d\d+[^.!?\n]*[.!?]/gi;
        let lastRollEnd = -1;
        let rm: RegExpExecArray | null;
        while ((rm = rollSentRe.exec(full)) !== null) lastRollEnd = rm.index + rm[0].length;
        if (lastRollEnd > 0 && lastRollEnd < full.length - 1) {
          // Narrate any pre-roll content still sitting in narBuf (< 40 chars, never matched
          // the streaming regex) before clearing it — otherwise that content is silently lost.
          if (narrationEnabledRef.current && !campaignLoadingRef.current && !narDone) {
            const rollInNarBuf = narBuf.search(/\broll\s+a\s+d\d+/i);
            const preRoll = (rollInNarBuf > 0 ? narBuf.slice(0, rollInNarBuf) : narBuf).trim();
            if (preRoll.length > 8) enqueueNarration(stripSystemLeaks(preRoll));
          }
          full = full.slice(0, lastRollEnd).trim();
          narBuf = "";
          narDone = true;
        }
      }

      // Final flush — split anything remaining into sentence-sized chunks so we never
      // dump a multi-paragraph response as one giant TTS clip (which the watchdog kills).
      // Tail guard raised from 8 → 24 chars: ElevenLabs at < ~16-24 chars of context
      // routinely produces slurred or "speaking in tongues" output because there's not
      // enough prosody window to settle on a voice. The text still appears in chat;
      // we just skip narrating that one stub. Falling short on the LAST sentence's
      // audio is preferable to playing a garbled clip the player has to mentally
      // un-hear.
      if (narrationEnabledRef.current && !campaignLoadingRef.current && !narDone && narBuf.trim().length > 24) {
        const { chunks: tail } = pullNarrationChunks(narBuf, true);
        for (const s of tail) {
          const cleaned = stripSystemLeaks(s);
          if (cleaned) enqueueNarration(cleaned);
        }
      }

      // Guard: catch two classes of degenerate response:
      // 1. Raw fragment — no sentence-ending punctuation (e.g. "Shmang,")
      // 2. Strip-degenerate — passes the raw check but stripSystemLeaks reduces it to a bare
      //    fragment at display time (e.g. "Randiezel, roll a d20." → display shows "Randiezel,")
      const displayFull = stripSystemLeaks(full).trim();
      const isDegenerate =
        !/[.!?…]/.test(full.trim()) ||
        !displayFull ||
        (displayFull.length < 20 && !/[.!?…]/.test(displayFull));
      if (isDegenerate) {
        const retryCount = (opts?._retryCount ?? 0) + 1;
        if (retryCount <= 3) {
          console.warn(`[sendToAI] Degenerate response (attempt ${retryCount}), retrying:`, JSON.stringify(full));
          setTimeout(() => sendToAI(allMessages, isOpeningScene, { ...opts, _retryCount: retryCount }), 400);
          return;
        }
        // All retries exhausted — suppress the fragment entirely, show nothing
        console.error("[sendToAI] Degenerate response after 3 retries, suppressing:", JSON.stringify(full));
        full = "";
      }

      // Bare-name truncation: substantive response that ends with a single capitalized
      // proper-noun token (e.g. "...he watched him go.' Barnabus") — the DM cut off
      // mid-call-to-action. If the trailing name matches a party member we accept the
      // response and route the turn to them below. If it doesn't match (likely an NPC
      // being addressed before the model truncated), retry to get a complete response.
      if (full && !isDegenerate) {
        const lastSegRaw = displayFull.split(/[.!?…\n]/).pop()?.trim() ?? "";
        const lastSeg = lastSegRaw.replace(/^[^A-Za-z]+/, "").trim();
        const isBareNameTail = lastSeg.length > 1
          && lastSeg.length < 30
          && /^[A-Z][a-zA-Z'-]*$/.test(lastSeg);
        if (isBareNameTail) {
          const matchesParty = campaignPartyRef.current.some(c =>
            c.name.split(" ")[0].toLowerCase() === lastSeg.toLowerCase()
          );
          if (!matchesParty) {
            const retryCount = (opts?._retryCount ?? 0) + 1;
            if (retryCount <= 2) {
              console.warn(`[sendToAI] Bare-name truncation (non-party), retry ${retryCount}:`, JSON.stringify(lastSeg));
              setTimeout(() => sendToAI(allMessages, isOpeningScene, { ...opts, _retryCount: retryCount }), 400);
              return;
            }
            console.warn("[sendToAI] Bare-name truncation persisted, accepting:", JSON.stringify(lastSeg));
          }
        }
      }

      if (full) {
        // Always add to messages so the chat history is complete regardless of narration mode
        setMessages(prev => [...prev, { role: "dm", content: full }]);
        if (narrationEnabledRef.current && !campaignLoadingRef.current) {
          setNarRevealText(full);
          // narRevealIntervalMs will be set when slot-0 audio canplaythrough fires
        }
        setLogEntries(prev => [...prev, { id: makeLogId("dm"), timestamp: new Date(), role: "dm", content: full }]);
      }
      if (isOpeningScene && campaignLoadingRef.current) setLoadDmDone(true);

      // Detect which character the DM is asking to roll, and what die type.
      // If DM asks a different character than the current turn, rewind the turn to that character
      // so they can roll before the game advances to the next player.
      const rollTarget      = detectDiceRollTarget(full);
      const detectedDieType = detectRequiredDiceType(full);
      let targetChar        = rollTarget ? campaignPartyRef.current.find(c => c.name === rollTarget) : null;

      // Unnamed roll request (DM says "Roll a DEX save" without naming anyone):
      // assign to the player who just acted — they're almost always the one who needs to roll.
      // Fall back to the current turn character for solo play.
      if (!targetChar && detectedDieType !== null && /\b(?:roll|make|give me)\b/i.test(full)) {
        const prevActingName = opts?.prevPlayerName;
        const prevActingChar = prevActingName
          ? campaignPartyRef.current.find(c => c.name === prevActingName)
          : null;
        const currentTurnCharId = turnOrderRef.current[currentTurnIndexRef.current];
        const currentTurnChar   = currentTurnCharId
          ? campaignPartyRef.current.find(c => c.id === currentTurnCharId)
          : null;
        // During reconciliation, prevPlayerName is the LAST actor of the finished
        // round — routing an unnamed roll to them would re-engage the wrong player
        // (the double-prompt bug via the roll path). Prefer the new round's current
        // turn character instead.
        targetChar = (opts?.roundSummary?.length ? null : prevActingChar) ?? currentTurnChar ?? characterRef.current;
      }

      // Only activate the dice UI when we know what die to roll — a named target without
      // a detected die type means the DM is just addressing the player, not requesting a roll.
      const validRollTarget  = detectedDieType !== null ? (targetChar?.name ?? rollTarget) : null;
      const targetUserId     = detectedDieType !== null ? (targetChar?.user_id ?? null) : null;
      const detectedRollMode = (validRollTarget || detectedDieType) ? detectRollMode(full) : "normal";
      setDiceRollTarget(validRollTarget ?? null);
      setRequiredDiceType(detectedDieType);
      setRequiredRollMode(detectedRollMode !== "normal" ? detectedRollMode : null);
      setRollRequestedUserId(targetUserId);
      rollRequestedUserIdRef.current = targetUserId;
      // Capture the DM's roll-request sentence for the dice screen header
      if (validRollTarget || detectedDieType) {
        const rollSents = full.trim().split(/(?<=[.!?…])\s+/);
        setDiceRollContext(rollSents[rollSents.length - 1]?.trim() || null);
      } else {
        setDiceRollContext(null);
      }
      // Rewind turn to rolling character if DM addressed someone other than the current turn player
      if (targetChar && turnOrderRef.current.length > 1) {
        const rollerIdx = turnOrderRef.current.findIndex(id => id === targetChar.id);
        if (rollerIdx >= 0 && rollerIdx !== currentTurnIndexRef.current) {
          setCurrentTurnIndex(rollerIdx);
          currentTurnIndexRef.current = rollerIdx;
          shouldPersistTurnRef.current = true;
          const rollerPartyIdx = campaignPartyRef.current.findIndex(c => c.id === targetChar.id);
          if (rollerPartyIdx >= 0) setActiveCharIdx(rollerPartyIdx);
          // Single-broadcast invariant: only the FIRST DM-routing branch in
          // this sendToAI cycle gets to broadcast turn_taken. Without this,
          // a roll-rewind + dm-named-turn + bare-name-tail could each fire
          // their own turn_taken and clients would apply them in network
          // order, producing visible desync.
          if (!turnBroadcastedThisCycleRef.current) {
            channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: rollerIdx } });
            turnBroadcastedThisCycleRef.current = true;
          }
        }
      }
      channelRef.current?.send({ type: "broadcast", event: "roll_request", payload: { userId: targetUserId } });

      // DM-driven turn: when the DM's closing question names a player ("Aria, what do you do?"),
      // advance the turn to that player. detectNextTurnPlayer only matches explicit call-to-action
      // patterns so false positives are rare; if a named player acts again handleSend's
      // findNextUnactedIdx still routes the round correctly.
      // Skip DM-text turn routing during reconciliation (roundSummary): the round
      // was already reset to index 0 authoritatively, and the reconcile message's
      // closing prompt must NOT be allowed to move the turn (e.g. back to the
      // player who just acted) — that produced the double-prompt bug.
      if (!validRollTarget && !opts?.allActed && !opts?.roundSummary?.length && turnOrderRef.current.length > 1) {
        const partyNames = campaignPartyRef.current.map(c => c.name);
        const dmTurnName = detectNextTurnPlayer(full, partyNames);
        const dmTurnChar = dmTurnName ? campaignPartyRef.current.find(c => c.name === dmTurnName) : null;

        // Determine whether any valid party first name appears within the IMMEDIATE
        // closing-question window (80 chars before the last "?"). This is the
        // signal for "the DM is addressing a real party member at the end". If
        // no valid name appears near the "?" but the response still ends with "?"
        // the DM likely hallucinated a name (e.g. addressed someone not in the
        // party) — in that case we trust the engine's pre-computed intent and
        // let the deferred advance run instead of blocking it.
        const tailFull   = full.slice(-400);
        const lastQIdx   = tailFull.lastIndexOf("?");
        const nearQWin   = lastQIdx >= 0 ? tailFull.slice(Math.max(0, lastQIdx - 80), lastQIdx + 1) : "";
        const anyPartyNameNearQ = nearQWin && partyNames.some(n => {
          const fn = n.split(" ")[0];
          if (!fn || fn.length < 2) return false;
          const esc = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`\\b${esc}\\b`, "i").test(nearQWin);
        });

        if (dmTurnChar) {
          let dmTurnIdx = turnOrderRef.current.indexOf(dmTurnChar.id);
          // Self-heal: the DM addressed someone who is in the party but
          // missing from the turn order. This happens during a join race
          // where the campaignParty update beat the turn-order patch effect.
          // Append them now (mirroring the turn_order_swap broadcast so peers
          // see the same composition) and route to that new slot.
          if (dmTurnIdx === -1 && dmTurnChar.id) {
            const repaired = [...turnOrderRef.current, dmTurnChar.id];
            turnOrderRef.current = repaired;
            setTurnOrder(repaired);
            dmTurnIdx = repaired.length - 1;
            shouldPersistTurnRef.current = true;
            channelRef.current?.send({
              type: "broadcast",
              event: "turn_order_swap",
              payload: { userId, newOrder: repaired, newIndex: dmTurnIdx },
            });
            console.warn(`[sendToAI] turn order missing ${dmTurnChar.name} — appended and routed`);
          }
          if (dmTurnIdx >= 0 && dmTurnIdx !== currentTurnIndexRef.current) {
            setCurrentTurnIndex(dmTurnIdx);
            currentTurnIndexRef.current = dmTurnIdx;
            shouldPersistTurnRef.current = true;
            const dmPartyIdx = campaignPartyRef.current.findIndex(c => c.id === dmTurnChar.id);
            if (dmPartyIdx >= 0) setActiveCharIdx(dmPartyIdx);
            if (!turnBroadcastedThisCycleRef.current) {
              channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: dmTurnIdx } });
              turnBroadcastedThisCycleRef.current = true;
            }
          } else if (dmTurnIdx >= 0) {
            // DM addressed the current player — it's a follow-up, block the deferred advance
            dmFollowUpBlockAdvanceRef.current = true;
          }
        } else if (opts?.prevPlayerName && anyPartyNameNearQ) {
          // No explicit detection match. Check if the DM's closing question is a
          // follow-up to the previous player (e.g. "Shmang, which element?"). The
          // prev player's name must appear IMMEDIATELY before the "?" — not
          // somewhere earlier in the narrative — otherwise an unrelated mention
          // of the prev player's name (e.g. "Shmang's father walked into the
          // forest") would falsely trigger this branch.
          const prevChar = campaignPartyRef.current.find(c => c.name === opts.prevPlayerName);
          if (prevChar) {
            const prevIdx = turnOrderRef.current.indexOf(prevChar.id);
            if (prevIdx >= 0 && lastQIdx >= 0) {
              const firstName = prevChar.name.split(" ")[0];
              const escPrev = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              // Tightened window: 80 chars before "?" only. Prevents earlier
              // narrative mentions of the prev player from triggering a false follow-up.
              const nameNearQ = new RegExp(`\\b${escPrev}\\b`, "i").test(nearQWin);
              const isFollowUp = nameNearQ
                && (/\byou(?:r)?\b/i.test(nearQWin)
                  || /what (?:does|will|would|can|shall) /i.test(nearQWin)
                  || /how (?:does|will|would|should) /i.test(nearQWin)
                  || new RegExp(`(?:does|will|is|are|can|should|would|did|do)\\s+\\b${escPrev}\\b`, "i").test(nearQWin));
              if (isFollowUp) {
                dmFollowUpBlockAdvanceRef.current = true;
                if (prevIdx !== currentTurnIndexRef.current) {
                  setCurrentTurnIndex(prevIdx);
                  currentTurnIndexRef.current = prevIdx;
                  shouldPersistTurnRef.current = true;
                  if (!turnBroadcastedThisCycleRef.current) {
                    channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: prevIdx } });
                    turnBroadcastedThisCycleRef.current = true;
                  }
                  const partyIdx = campaignPartyRef.current.findIndex(c => c.id === prevChar.id);
                  if (partyIdx >= 0) setActiveCharIdx(partyIdx);
                }
              }
            }
          }
        }

        // Safety net: block the deferred advance only when the DM's closing "?"
        // addresses a REAL party member. If the response ends with "?" but no
        // valid party name appears near it (e.g. DM hallucinated "Barnabus, what
        // do you do?"), let the deferred advance run so the engine's intended
        // nextPlayer becomes the active player — that prevents the highlight
        // from getting stuck on the previous actor.
        if (!dmFollowUpBlockAdvanceRef.current && full.trimEnd().endsWith("?") && anyPartyNameNearQ) {
          dmFollowUpBlockAdvanceRef.current = true;
        }

        // Bare-name routing: when no action-prompt pattern matched but the response
        // ends with a bare party-member name (truncated call-to-action — DM was about
        // to ask them what they do but the completion stopped), route the turn to that
        // player and block the deferred advance. Guards: skip when the matched player
        // is the one who just acted, or has already acted this round.
        if (!dmTurnChar && !dmFollowUpBlockAdvanceRef.current) {
          const lastSegRaw = full.trim().split(/[.!?…\n]/).pop()?.trim() ?? "";
          const lastSeg = lastSegRaw.replace(/^[^A-Za-z]+/, "").trim();
          const isBareNameTail = lastSeg.length > 1
            && lastSeg.length < 30
            && /^[A-Z][a-zA-Z'-]*$/.test(lastSeg);
          if (isBareNameTail) {
            const matched = campaignPartyRef.current.find(c =>
              c.name.split(" ")[0].toLowerCase() === lastSeg.toLowerCase()
            );
            const alreadyActed = matched && roundActionsRef.current.some(a => a.characterId === matched.id);
            if (matched && !alreadyActed && matched.name !== opts?.prevPlayerName) {
              const targetIdx = turnOrderRef.current.indexOf(matched.id);
              if (targetIdx >= 0) {
                if (targetIdx !== currentTurnIndexRef.current) {
                  setCurrentTurnIndex(targetIdx);
                  currentTurnIndexRef.current = targetIdx;
                  shouldPersistTurnRef.current = true;
                  const partyIdx = campaignPartyRef.current.findIndex(c => c.id === matched.id);
                  if (partyIdx >= 0) setActiveCharIdx(partyIdx);
                  if (!turnBroadcastedThisCycleRef.current) {
                    channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: targetIdx } });
                    turnBroadcastedThisCycleRef.current = true;
                  }
                }
                dmFollowUpBlockAdvanceRef.current = true;
                console.warn(`[sendToAI] Bare-name truncation — routed turn to ${matched.name}`);
              }
            }
          }
        }
      }

      // [NO-TURN] tag — the DM signals that the player's submission was either:
      //   (a) a failed/invalid action attempt (wrong class feature, no spell slot,
      //       trying a non-prepared spell, out-of-resource, etc.), OR
      //   (b) a clarification request ("which element?", "what form?") that needs
      //       the player to respond before the action actually resolves.
      // In BOTH cases the player's turn must NOT be consumed:
      //   1. Block the deferred turn advance.
      //   2. Remove the player's entry from roundActions so they still owe an action.
      // Without (2), the reconciliation logic still thinks they acted this round.
      if (/\[NO-?TURN\]/i.test(full) && opts?.prevPlayerName) {
        dmFollowUpBlockAdvanceRef.current = true;
        const prevChar = campaignPartyRef.current.find(c => c.name === opts.prevPlayerName);
        if (prevChar) {
          const trimmed = roundActionsRef.current.filter(a => a.characterId !== prevChar.id);
          if (trimmed.length !== roundActionsRef.current.length) {
            roundActionsRef.current = trimmed;
            setRoundActions(trimmed);
          }
        }
      }

      // Detect group/party check — this roll does NOT consume the current player's individual turn
      const isGroupCheck = /\b(for the (?:party|group)|(?:group|party) (?:check|roll|save|saving throw))\b/i.test(full);
      if (isGroupCheck) {
        setIsGroupCheckRoll(true);
        isGroupCheckRollRef.current = true;
      }

      // Enemy combat: spawn enemies when combat starts, or update existing enemy states
      const activeEnemies = enemiesRef.current.filter(e => !e.is_defeated);
      if (activeEnemies.length > 0) {
        updateEnemyStates(full);
      } else if (detectCombatStart(full)) {
        spawnEnemies(full);
      }

      // Only persist the triggering player message when it's new — not when the last message is already a DM
      // response (e.g. triggerReconciliation or handleTurnSkip pass messages ending with a DM msg).
      const lastMsg = allMessages[allMessages.length - 1];
      if (full) {
        const toInsert = lastMsg.role === "player"
          ? [
              { campaign_id: params.id, role: lastMsg.role, content: lastMsg.content, sender: lastMsg.sender ?? null },
              { campaign_id: params.id, role: "dm",         content: full,            sender: null },
            ]
          : [{ campaign_id: params.id, role: "dm", content: full, sender: null }];
        supabase.from("campaign_messages").insert(toInsert).then(({ error }) => { if (error) console.error("[campaign] save:", error); });
        channelRef.current?.send({ type: "broadcast", event: "dm_response", payload: { senderId: userId, content: full, actingCharId: characterRef.current?.id ?? null } });
      } else if (lastMsg.role === "player") {
        // DM response suppressed — still persist the player's action so it survives session reload
        supabase.from("campaign_messages")
          .insert([{ campaign_id: params.id, role: "player", content: lastMsg.content, sender: lastMsg.sender ?? null }])
          .then(({ error }) => { if (error) console.error("[campaign] save player:", error); });
      }

      // Focus the party panel on the character whose turn the DM just announced
      if (campaignPartyRef.current.length > 1) {
        const turnCharId = turnOrderRef.current[currentTurnIndexRef.current];
        const turnPartyIdx = campaignPartyRef.current.findIndex(c => c.id === turnCharId);
        if (turnPartyIdx >= 0) setActiveCharIdx(turnPartyIdx);
      }

      // Fast client-side spell slot detection — fire immediately so the card updates before chat-state returns.
      // Scans the DM text for any spell name in this character's prepared list and consumes the slot instantly.
      if (!isOpeningScene && pendingSpellCastRef.current === 0) {
        const actingChar = characterRef.current;
        if (actingChar && SPELLCASTING_CLASSES.has(actingChar.class)) {
          const prepared = [
            ...(actingChar.cantrips_known ?? []),
            ...(actingChar.spells_prepared ?? []),
          ];
          // Find the first leveled spell mentioned in the DM narrative
          const castSpell = prepared.find(spell => {
            const slotLvl = getSpellLevel(spell);
            if (slotLvl === 0) return false; // skip cantrips
            return new RegExp(`\\b${spell.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(full);
          });
          if (castSpell) {
            const spellLvl = getSpellLevel(castSpell);
            const allSlots = getSpellSlots(actingChar.class, actingChar.level);
            const used = { ...(actingChar.spell_slots_used ?? {}) };
            if ((allSlots[spellLvl] ?? 0) - (used[spellLvl] ?? 0) > 0) {
              used[spellLvl] = (used[spellLvl] ?? 0) + 1;
              const fastChar = { ...actingChar, spell_slots_used: used };
              setCharacter(fastChar);
              setCampaignParty(prev => prev.map(c => c.id === actingChar.id ? { ...c, spell_slots_used: used } : c));
              characterRef.current = fastChar;
              campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === actingChar.id ? { ...c, spell_slots_used: used } : c);
              // Mark as pending so applyStateChange won't double-deduct; record level for upcast reconciliation.
              // Also persist to DB immediately — if applyStateChange encounters a target_name mismatch
              // (e.g. caster healed a different character) the DB write there may be skipped.
              pendingSpellCastRef.current++;
              pendingSpellCastLevelRef.current = spellLvl;
              charWriteRef.current?.(actingChar.id, { spell_slots_used: used });
              channelRef.current?.send({
                type: "broadcast", event: "character_sync",
                payload: { charId: actingChar.id, spell_slots_used: used },
              });
            }
          }
        }
      }

      // Fast TEMP-HP detection — when the DM writes a [THP:Name:+N] tag, apply
      // the temp-HP grant to that party member immediately (don't wait for the
      // async chat-state extraction). Runs against EVERY party member so
      // healing/buffs aimed at another player (e.g. Aid, Heroism on an ally)
      // also light up the recipient's card without delay.
      if (!isOpeningScene) {
        for (const partyMember of campaignPartyRef.current) {
          const firstName = partyMember.name.split(" ")[0];
          const thpGrant = parseThpTag(full, firstName);
          if (thpGrant <= 0) continue;
          const currentThp = partyMember.class_resources?.temp_hp ?? 0;
          // D&D 5e: temp HP doesn't stack — take the larger of current vs new grant
          if (thpGrant <= currentThp) continue;
          const newRes = { ...(partyMember.class_resources ?? {}), temp_hp: thpGrant };
          const updated = { ...partyMember, class_resources: newRes };
          if (characterRef.current?.id === partyMember.id) {
            setCharacter(updated);
            characterRef.current = updated;
          }
          setCampaignParty(prev => prev.map(c => c.id === partyMember.id ? updated : c));
          campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === partyMember.id ? updated : c);
          charWriteRef.current?.(partyMember.id, { class_resources: newRes });
          channelRef.current?.send({
            type: "broadcast", event: "character_sync",
            payload: { charId: partyMember.id, class_resources: newRes },
          });
        }
      }

      // Fast WILD SHAPE detection — when the DM writes a [WILDSHAPE:Name:Form] tag,
      // mirror it onto the druid's status_effects ("Wild Shape: Bear") so the
      // party card portrait morphs into the beast emoji, AND play the form-
      // specific bear/wolf/eagle voice. A "[WILDSHAPE:Name:revert]" tag (or
      // 'human' / 'natural') strips the status and reverts the portrait.
      if (!isOpeningScene) {
        for (const partyMember of campaignPartyRef.current) {
          const firstName = partyMember.name.split(" ")[0];
          const formOrRevert = parseWildShapeTag(full, firstName);
          if (formOrRevert === null) continue;
          const currentStatuses = partyMember.status_effects ?? [];
          let newStatuses: string[];
          if (formOrRevert === "revert") {
            // Capture the form name from the status BEFORE we strip it, so we
            // can replay the same form-specific sound on revert that fired on
            // transform (e.g. bear-growl in, bear-growl out).
            const wsStatus = currentStatuses.find(s => /^Wild Shape:/i.test(s));
            const priorForm = wsStatus ? wsStatus.replace(/^Wild Shape:\s*/i, "").trim() : "";
            newStatuses = currentStatuses.filter(s => !/^Wild Shape:/i.test(s));
            if (newStatuses.length === currentStatuses.length) continue; // nothing to remove
            playAbilitySound("wild_shape", priorForm || undefined);
          } else {
            const tagged = `Wild Shape: ${formOrRevert}`;
            if (currentStatuses.some(s => s.toLowerCase() === tagged.toLowerCase())) continue;
            newStatuses = [
              ...currentStatuses.filter(s => !/^Wild Shape:/i.test(s)),
              tagged,
            ];
            // Form-specific voice — passes the form so the bear/wolf/eagle
            // voice can fire instead of the generic one.
            playAbilitySound("wild_shape", formOrRevert);
          }
          const updated = { ...partyMember, status_effects: newStatuses };
          if (characterRef.current?.id === partyMember.id) {
            setCharacter(updated);
            characterRef.current = updated;
          }
          setCampaignParty(prev => prev.map(c => c.id === partyMember.id ? updated : c));
          campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === partyMember.id ? updated : c);
          charWriteRef.current?.(partyMember.id, { status_effects: newStatuses });
          channelRef.current?.send({
            type: "broadcast", event: "character_sync",
            payload: { charId: partyMember.id, status_effects: newStatuses },
          });
        }
      }

      // Fast persistent-buff detection — RAGE, INSPIRED, MARK. The DM emits
      // these tags when a buff is granted or expires; we mirror them onto
      // status_effects so the card glow + badge update in real-time across all
      // clients without waiting for chat-state to round-trip.
      if (!isOpeningScene) {
        for (const partyMember of campaignPartyRef.current) {
          const firstName = partyMember.name.split(" ")[0];
          const currentStatuses = partyMember.status_effects ?? [];
          let newStatuses = currentStatuses;
          let changed = false;
          // RAGE — the DM tracks when a barbarian's rage ends (no attack last
          // round, knocked out, voluntary end). Engine handles the start (player
          // click); the DM controls the off-switch via [RAGE:Name:off].
          const rage = parseRageTag(full, firstName);
          if (rage === "off") {
            if (newStatuses.includes("Raging")) {
              newStatuses = newStatuses.filter(s => s !== "Raging");
              changed = true;
            }
          } else if (rage === "on") {
            if (!newStatuses.includes("Raging")) {
              newStatuses = [...newStatuses, "Raging"];
              playAbilitySound("rage");
              changed = true;
            }
          }
          // INSPIRED — bard grants the die to an ally, or the ally uses/expires it.
          const inspired = parseInspiredTag(full, firstName);
          if (inspired) {
            const inspiredEntry = newStatuses.find(s => /^Inspired/.test(s));
            if ("off" in inspired) {
              if (inspiredEntry) {
                newStatuses = newStatuses.filter(s => !/^Inspired/.test(s));
                changed = true;
              }
            } else {
              const tagged = `Inspired (${inspired.die})`;
              if (inspiredEntry !== tagged) {
                newStatuses = [...newStatuses.filter(s => !/^Inspired/.test(s)), tagged];
                playAbilitySound("bardic_inspiration");
                changed = true;
              }
            }
          }
          // MARK — ranger applies Hunter's Mark to a target, or drops/moves it.
          const mark = parseMarkTag(full, firstName);
          if (mark) {
            const markEntry = newStatuses.find(s => /^Hunter's Mark/i.test(s));
            if ("off" in mark) {
              if (markEntry) {
                newStatuses = newStatuses.filter(s => !/^Hunter's Mark/i.test(s));
                changed = true;
              }
            } else {
              const tagged = mark.target ? `Hunter's Mark: ${mark.target}` : "Hunter's Mark";
              if (markEntry !== tagged) {
                newStatuses = [...newStatuses.filter(s => !/^Hunter's Mark/i.test(s)), tagged];
                playAbilitySound("hunters_mark");
                changed = true;
              }
            }
          }
          if (!changed) continue;
          const updated = { ...partyMember, status_effects: newStatuses };
          if (characterRef.current?.id === partyMember.id) {
            setCharacter(updated);
            characterRef.current = updated;
          }
          setCampaignParty(prev => prev.map(c => c.id === partyMember.id ? updated : c));
          campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === partyMember.id ? updated : c);
          charWriteRef.current?.(partyMember.id, { status_effects: newStatuses });
          channelRef.current?.send({
            type: "broadcast", event: "character_sync",
            payload: { charId: partyMember.id, status_effects: newStatuses },
          });
        }
      }

      // Fast ABILITY detection — when the DM narrates an instant class ability
      // (Second Wind, Action Surge, Cunning Action, Ki, Lay on Hands, Channel
      // Divinity, Sorcery Points, Arcane Recovery, Eldritch Invocation, Pact
      // Boon, Sneak Attack, Uncanny Dodge, Evasion), they emit one
      // [ABILITY:Name:key] tag per invocation. Mirror the click-the-button
      // feedback: play the synth voice for that key and pulse the card flash
      // in that ability's resource color. Persistent buffs (Rage / Inspired /
      // Mark / Wild Shape) already have their own dedicated tags above.
      if (!isOpeningScene) {
        for (const partyMember of campaignPartyRef.current) {
          const firstName = partyMember.name.split(" ")[0];
          const keys = parseAbilityTags(full, firstName);
          if (keys.length === 0) continue;
          const classResources = CLASS_RESOURCES[partyMember.class] ?? [];
          // Stagger multiple invocations slightly so two simultaneous cues
          // don't smear into each other.
          keys.forEach((key, i) => {
            const resDef = classResources.find(r => r.key === key);
            const color  = resDef?.color ?? "#8b5cf6";
            setTimeout(() => {
              playAbilitySound(key);
              triggerAbilityFlash(partyMember.id, color);
            }, i * 220);
          });
        }
      }

      // Fast SPELL detection — the DM emits [SPELL:Caster:spell_key] or
      // [SPELL:Caster:spell_key:Target] tags whenever a registered spell is
      // cast. Each tag plays the matching ElevenLabs clip and flashes the
      // affected party card with the spell's theme color and animation.
      // targetSide decides which card flashes: "caster" (self-buff), "target"
      // (damage / heal aimed at another), or "both" (AoE / multi-target buff).
      if (!isOpeningScene) {
        const spellHits = parseSpellTags(full);
        const partyByFirst = new Map<string, { id: string; name: string }>();
        for (const m of campaignPartyRef.current) partyByFirst.set(m.name.split(" ")[0].toLowerCase(), { id: m.id, name: m.name });
        spellHits.forEach(({ caster, key, target }, i) => {
          const meta = SPELL_META[key];
          setTimeout(() => {
            playSpellSound(key);
            if (!meta) return;
            const casterMember = partyByFirst.get(caster.split(" ")[0].toLowerCase());
            const targetMember = target ? partyByFirst.get(target.split(" ")[0].toLowerCase()) : undefined;
            if (meta.targetSide === "caster" && casterMember) {
              triggerSpellFlash(casterMember.id, meta.anim, meta.color);
            } else if (meta.targetSide === "target" && targetMember) {
              triggerSpellFlash(targetMember.id, meta.anim, meta.color);
            } else if (meta.targetSide === "both") {
              if (casterMember) triggerSpellFlash(casterMember.id, meta.anim, meta.color);
              if (targetMember && targetMember.id !== casterMember?.id) {
                setTimeout(() => triggerSpellFlash(targetMember.id, meta.anim, meta.color), 80);
              }
            } else if (casterMember) {
              // Fallback: target named but not in party (enemy or NPC) — flash caster instead.
              triggerSpellFlash(casterMember.id, meta.anim, meta.color);
            }
          }, i * 260);
        });
      }

      // Fast HP detection — apply HP change to this character immediately before chat-state returns.
      if (!isOpeningScene && pendingHpDeltaRef.current === 0) {
        const actingChar = characterRef.current;
        if (actingChar) {
          const firstName = actingChar.name.split(" ")[0];
          const hpDelta = parseHpTag(full, firstName);
          // Damage-direction guard: if the DM emitted [HP:Aria:-N] but the
          // narrative shows Aria as the ATTACKER, the tag is a model error.
          // Suppressing here stops the acting player from losing HP to their
          // own successful hit. Mark pendingHpDeltaRef so the slow path
          // (chat-state) also skips a duplicate application.
          if (hpDelta !== 0 && damageTagShouldBeSuppressed(full, firstName, hpDelta)) {
            console.warn(`[fast HP] Suppressed [HP:${firstName}:${hpDelta}] — narrative shows ${firstName} as attacker, not receiver`);
            pendingHpDeltaRef.current = hpDelta;
          } else if (hpDelta !== 0) {
            const ib = computeInventoryBonuses(actingChar.inventory?.items ?? [], actingChar.inventory?.weapons ?? []);
            const fastTempHp0 = actingChar.class_resources?.temp_hp ?? 0;
            let fastTempHp = fastTempHp0;
            let fastDelta  = hpDelta;
            if (hpDelta < 0 && fastTempHp > 0) {
              const dmg = Math.abs(hpDelta); const absorbed = Math.min(fastTempHp, dmg);
              fastTempHp = fastTempHp - absorbed; fastDelta = -(dmg - absorbed);
            }
            const newHp = Math.max(0, Math.min(actingChar.max_hp + ib.hpMaxAdd, actingChar.hp + fastDelta));
            const fastRes = fastTempHp !== fastTempHp0 ? { ...(actingChar.class_resources ?? {}), temp_hp: fastTempHp } : (actingChar.class_resources ?? {});
            const baseStatuses = actingChar.status_effects ?? [];
            const newStatuses  = reconcileUnconscious(baseStatuses, newHp, fastDelta);
            const statusChanged = newStatuses !== baseStatuses;
            const fastChar = { ...actingChar, hp: newHp, class_resources: fastRes, ...(statusChanged && { status_effects: newStatuses }) };
            setCharacter(fastChar);
            setCampaignParty(prev => prev.map(c => c.id === actingChar.id ? { ...c, hp: newHp, class_resources: fastRes, ...(statusChanged && { status_effects: newStatuses }) } : c));
            characterRef.current = fastChar;
            campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === actingChar.id ? { ...c, hp: newHp, class_resources: fastRes, ...(statusChanged && { status_effects: newStatuses }) } : c);
            pendingHpDeltaRef.current = hpDelta;
            charWriteRef.current?.(actingChar.id, { hp: newHp, ...(fastTempHp !== fastTempHp0 && { class_resources: fastRes }), ...(statusChanged && { status_effects: newStatuses }) });
            channelRef.current?.send({ type: "broadcast", event: "character_sync", payload: { charId: actingChar.id, hp: newHp, ...(fastTempHp !== fastTempHp0 && { class_resources: fastRes }), ...(statusChanged && { status_effects: newStatuses }) } });
          }
        }
      }

      // State changes (HP, gold, items, XP) — skip on opening scene (no player action yet)
      // Deterministic economy tags (primary) + chat-state extractor (fallback).
      if (!isOpeningScene) {
        applyDmStateFromNarrative(full);
      }

      // Determine whose turn it is NOW (post-advance) to decide if suggestions should appear here
      const nextTurnCharId = turnOrderRef.current[currentTurnIndexRef.current] ?? null;
      const nextTurnChar   = (nextTurnCharId && campaignPartyRef.current.find(c => c.id === nextTurnCharId))
        || characterRef.current;
      // Local = solo play, OR the character whose turn it is belongs to this user
      const isLocalTurn = turnOrderRef.current.length <= 1
        || !nextTurnCharId
        || nextTurnChar?.user_id === userId;
      if (isLocalTurn && !opts?.allActed && nextTurnChar) {
        fetch("/api/suggest-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildSuggestActionsBody(full, nextTurnChar)) })
          .then(r => r.json()).then(({ suggestions: s }) => setSuggestions(s ?? [])).catch(() => {});
      }

      // Round management: reconcile when every party member has acted (count-based, not position-based)
      if (opts?.trackRound && !validRollTarget) {
        const order = turnOrderRef.current;
        if (order.length > 1) {
          const partySize = campaignPartyRef.current.length;
          const allActed  = roundActionsRef.current.length >= partySize
            && order.every(cid => roundActionsRef.current.some(a => a.characterId === cid));
          if (allActed) {
            const summary    = roundActionsRef.current.map(a => ({ name: a.name, action: a.action }));
            const msgsWithDm: Message[] = [...allMessages, { role: "dm", content: full }];
            pendingReconciliationRef.current = { messages: msgsWithDm, summary };
          }
          // Turn advance for non-reconciliation case already happened in handleSend
        }
      }

      // Scene detection — skip on roll submissions and on the brief pendingReconciliation bridge
      // response (allActed). The bridge fires immediately before reconciliation, so two detection
      // requests would be in-flight with the same stale currentScene — the newer one (reconciliation)
      // would win and could revert the scene if it got stale data. Only run detection on the
      // substantive reconciliation response.
      if (!opts?.isRollResult && !opts?.allActed) {
        const isCombatNow = enemiesRef.current.some(e => !e.is_defeated);
        const partySnap   = campaignPartyRef.current.map(c => ({ name: c.name, race: c.race, class: c.class }));
        const enemySnap   = enemiesRef.current.filter(e => !e.is_defeated).map(e => ({ name: e.name }));
        const sceneReqId  = ++sceneRequestIdRef.current;
        setSceneLoading(true);
        fetch("/api/detect-scene", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ narrative: full, currentScene: currentSceneRef.current, isCombat: isCombatNow, campaignDescription: campaignDescriptionRef.current, party: partySnap, enemies: enemySnap }),
        })
          .then(r => r.json())
          .then(({ sceneName, imageUrl, momentImageUrl, sceneType, modifiers, description }: { sceneName: string; imageUrl: string | null; momentImageUrl?: string | null; sceneType?: string; modifiers?: string[]; description?: string; shouldChange?: boolean }) => {
            if (sceneRequestIdRef.current !== sceneReqId) return; // superseded by a newer request
            // Update background when server decided a change is warranted
            if (imageUrl) {
              currentSceneRef.current = sceneName;
              setCurrentSceneUrl(imageUrl);
              if (campaignLoadingRef.current) setLoadSceneDone(true);
              (window as Window).__dndSetMusicScene?.(sceneName, sceneType, modifiers);
              if (sceneType) (window as Window).__dndSetAmbianceScene?.(sceneName, sceneType, modifiers);
              if (campaignLoadingRef.current) setLoadAmbianceDone(true);
            } else {
              if (campaignLoadingRef.current) { setLoadSceneDone(true); setLoadAmbianceDone(true); }
            }
            // Broadcast scene update (background + moment) to all other clients
            channelRef.current?.send({
              type: "broadcast", event: "scene_change",
              payload: { senderId: userId, sceneName, imageUrl, momentImageUrl: momentImageUrl ?? null, sceneType, modifiers, dmContent: full.slice(0, 120) },
            });
            // Attach story moment illustration to the DM message that triggered it
            if (momentImageUrl) {
              const matchContent = full;
              setMessages(prev => {
                const ridx = [...prev].reverse().findIndex(m => m.role === "dm" && m.content === matchContent);
                if (ridx < 0) return prev;
                const idx = prev.length - 1 - ridx;
                const next = [...prev];
                next[idx] = { ...next[idx], imageUrl: momentImageUrl };
                return next;
              });
            }
          })
          .catch(() => { if (campaignLoadingRef.current) { setLoadSceneDone(true); setLoadAmbianceDone(true); } })
          .finally(() => { if (sceneRequestIdRef.current === sceneReqId) setSceneLoading(false); });
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages(prev => [...prev, { role: "dm", content: "The DM seems to be indisposed. Please try again." }]);
    } finally {
      setIsTyping(false); isTypingRef.current = false;
      setStreamingContent("");
      channelRef.current?.send({ type: "broadcast", event: "dm_typing", payload: { senderId: userId, typing: false } });
    }
  };

  // ── Round reconciliation ──────────────────────────────────────────────────────
  const triggerReconciliation = async (msgs: Message[], summary: { name: string; action: string }[]) => {
    // END-OF-ROUND DOUBLE-PROMPT FIX. The round-completing message (the last
    // entry in `msgs`) must NOT prompt anyone — THIS reconciliation is the sole
    // source of the next-turn prompt. Deterministically strip any trailing
    // "…what do you do, X?" the model tacked on (covers both the model ignoring
    // the bridge "never prompt" instruction AND the round-ending-on-a-roll path
    // whose template always prompts). Without this the round leader is asked for
    // an action twice in a row. Fix the live transcript, persisted history, and
    // peers' transcripts so it's gone everywhere, not just locally.
    if (msgs.length > 0 && msgs[msgs.length - 1].role === "dm") {
      const original = msgs[msgs.length - 1].content;
      const stripped = stripTrailingTurnPrompt(original);
      if (stripped !== original) {
        msgs = [...msgs.slice(0, -1), { ...msgs[msgs.length - 1], content: stripped }];
        setMessages(prev => {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].role === "dm" && prev[i].content === original) {
              const next = [...prev]; next[i] = { ...next[i], content: stripped }; return next;
            }
          }
          return prev;
        });
        setLogEntries(prev => prev.map(e => (e.role === "dm" && e.content === original) ? { ...e, content: stripped } : e));
        supabase.from("campaign_messages").update({ content: stripped })
          .eq("campaign_id", params.id).eq("role", "dm").eq("content", original)
          .then(() => {});
        channelRef.current?.send({ type: "broadcast", event: "dm_message_edit", payload: { senderId: userId, oldContent: original, newContent: stripped } });
      }
    }
    // Clear round actions and reset turn to first player before DM reconciles
    roundActionsRef.current = [];
    setRoundActions([]);
    setCurrentTurnIndex(0);
    currentTurnIndexRef.current = 0;
    shouldPersistTurnRef.current = true;
    // Open the reconciliation guard window: for the next 1.5s, the deferred
    // advance in handleSend (ours or any other client's, racing this reset)
    // must suppress its turn_taken broadcast — otherwise it would clobber the
    // round_reset + turn_taken(0) we just emitted. 1500ms is comfortably
    // longer than the typical broadcast round-trip and shorter than a player
    // can submit a new action.
    reconciliationGuardUntilRef.current = Date.now() + 1500;
    channelRef.current?.send({ type: "broadcast", event: "round_reset",  payload: {} });
    channelRef.current?.send({ type: "broadcast", event: "turn_taken",   payload: { userId, newIndex: 0 } });
    if (campaignPartyRef.current.length > 1) setActiveCharIdx(0);
    // Strip pass entries and empty actions from the DM summary — the DM should only see
    // genuine player submissions. Letting an empty entry through gives the DM only a name with
    // no action, which it then fabricates an action for (the "DM acts for a player" bug).
    const dmSummary = summary.filter(a => a.action && a.action.trim().length > 0 && a.action !== "passed their turn");
    const lastActor = dmSummary[dmSummary.length - 1]?.name ?? summary[summary.length - 1]?.name ?? null;
    await sendToAI(msgs, false, { roundSummary: dmSummary, prevPlayerName: lastActor, preserveNarration: true });
  };

  // ── Turn swap — current player swaps their slot with the target player ───────
  const handleTurnSkip = async (toChar: Character, toPartyIdx: number) => {
    if (campaignPartyRef.current.length <= 1) return;
    // Can't swap while the DM is mid-response or a roll is still pending
    if (isTypingRef.current || rollRequestedUserIdRef.current) return;

    const fromIdx    = currentTurnIndexRef.current;
    const fromCharId = turnOrderRef.current[fromIdx];
    const fromChar   = campaignPartyRef.current.find(c => c.id === fromCharId);
    if (!fromChar || fromChar.id === toChar.id) return;

    const toIdx = turnOrderRef.current.findIndex(id => id === toChar.id);
    if (toIdx < 0) return;

    // Swap positions — fromChar will still act at toIdx later; toChar acts now at fromIdx
    const newOrder = [...turnOrderRef.current];
    [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
    turnOrderRef.current = newOrder;
    setTurnOrder(newOrder);
    shouldPersistTurnRef.current = true;
    // currentTurnIndex stays at fromIdx — it now points to toChar after the swap
    setActiveCharIdx(toPartyIdx);
    setSuggestions([]);

    // Broadcast the new order so all clients stay in sync
    channelRef.current?.send({ type: "broadcast", event: "turn_order_swap", payload: { userId, newOrder, newIndex: fromIdx } });

    // Show a brief banner — auto-dismiss after 2.5s
    setTurnSkipBanner(`${fromChar.name} swaps turns with ${toChar.name} — ${toChar.name} acts now!`);
    if (skipTurnTimeoutRef.current) clearTimeout(skipTurnTimeoutRef.current);
    skipTurnTimeoutRef.current = setTimeout(() => {
      setTurnSkipBanner(null);
      skipTurnTimeoutRef.current = null;
    }, 2500);

    // Call the DM — fromChar will still act later so do NOT mark them as skipped
    pendingReconciliationRef.current = null;
    await sendToAI(messagesRef.current, false, {
      trackRound:       turnOrderRef.current.length > 1,
      nextPlayerName:   toChar.name,
      prevPlayerName:   fromChar.name,
      skippedPlayerName: fromChar.name,
      isTurnSkip:       true,
    });
    const pending = pendingReconciliationRef.current as { messages: Message[]; summary: { name: string; action: string }[] } | null;
    if (pending) {
      pendingReconciliationRef.current = null;
      await triggerReconciliation(pending.messages, pending.summary);
    }
  };

  // ── Player send ───────────────────────────────────────────────────────────────
  const handleSend = async (actionText?: string, bypassTurn = false) => {
    const text = (actionText ?? input).trim();
    if (!text || isTyping || (narrating && !bypassTurn)) return;
    const order       = turnOrderRef.current;
    const rollReq     = rollRequestedUserIdRef.current;
    const isRollSubmit = rollReq === userId; // capture before clearing
    const isMyTurn    = rollReq
      ? rollReq === userId
      : (order.length <= 1 || order[currentTurnIndexRef.current] === character?.id);
    if (!isMyTurn && !bypassTurn) return;
    if (!actionText) setInput("");
    setSuggestions([]);
    setDiceRollTarget(null);
    setRollRequestedUserId(null);
    rollRequestedUserIdRef.current = null;
    const wasGroupCheckRoll = isGroupCheckRollRef.current;
    if (wasGroupCheckRoll) { setIsGroupCheckRoll(false); isGroupCheckRollRef.current = false; }
    channelRef.current?.send({ type: "broadcast", event: "roll_request", payload: { userId: null } });

    // Reset the per-cycle single-broadcast latch. Inside sendToAI, the
    // rewind / detect-next / follow-up / bare-name branches each independently
    // decide whether to advance the turn; each must claim the single broadcast
    // for this cycle so receivers don't apply conflicting indices.
    turnBroadcastedThisCycleRef.current = false;

    // Questions (ending with ?) are informational — they don't consume the player's turn action.
    const isQuestion = !isRollSubmit && text.endsWith('?');

    const playerMsg: Message = { role: "player", content: text, sender: character?.name ?? "You" };
    const updatedMessages    = [...messages, playerMsg];
    setMessages(updatedMessages);
    setLogEntries(prev => [...prev, { id: makeLogId("player"), timestamp: new Date(), role: "player", sender: playerMsg.sender, content: text }]);
    channelRef.current?.send({ type: "broadcast", event: "player_action", payload: { senderId: userId, content: text, characterName: character?.name, characterId: character?.id, isQuestion } });

    // Record this player's action for round tracking (not for roll submissions or questions)
    if (!isRollSubmit && !isQuestion && order.length > 1 && character) {
      const updated: RoundAction[] = [...roundActionsRef.current.filter(a => a.characterId !== character.id), { characterId: character.id, name: character.name, action: text }];
      roundActionsRef.current = updated;
      setRoundActions(updated);
    }

    // Capture acting character BEFORE the turn advances — applyStateChange uses this to gate changes
    prevActingCharIdRef.current = character?.id ?? null;

    // Compute next player and advance turn BEFORE awaiting the DM so no bonus actions slip through.
    // Skip players who have already acted (e.g. via pass) so the turn doesn't cycle back to them.
    //
    // CRITICAL — read turnOrderRef/roundActionsRef INSIDE the closure (not the
    // captured `order` snapshot). When this fn is invoked AFTER the DM await,
    // a turn_order_swap or player_action broadcast may have arrived; the
    // captured snapshot would route the turn against stale data. Refs give us
    // the freshest possible view at call time.
    const findNextUnactedIdx = (fromIdx: number) => {
      const o = turnOrderRef.current;
      const acted = roundActionsRef.current;
      if (o.length === 0) return 0;
      for (let i = 1; i < o.length; i++) {
        const candidateIdx = (fromIdx + i) % o.length;
        if (!acted.some(a => a.characterId === o[candidateIdx])) return candidateIdx;
      }
      return (fromIdx + 1) % o.length; // fallback: all acted (reconciliation will catch this)
    };

    let nextPlayerName: string | null = null;
    // Always defer turn advancement until after the DM responds — the DM may direct the next roll
    // to the same player (e.g. damage roll after a hit), so we must not advance prematurely.
    let pendingTurnAdvanceIdx: number | null = null;
    if (isRollSubmit && !wasGroupCheckRoll && order.length > 1) {
      // Roll submitted: defer advance just like regular actions. The DM routing determines the next
      // player — if the same player needs a follow-up roll, the rewind + rollRequested guard will keep
      // the turn on them; if the action is fully resolved, detectNextTurnPlayer advances to the next.
      const nextIdx = findNextUnactedIdx(currentTurnIndexRef.current);
      // Index turnOrderRef.current (not the captured `order` snapshot) — a
      // turn_order_swap during pre-await setup could have grown the order and
      // findNextUnactedIdx may return an index past `order.length-1`.
      nextPlayerName = campaignPartyRef.current.find(c => c.id === turnOrderRef.current[nextIdx])?.name ?? null;
      pendingTurnAdvanceIdx = nextIdx;
    } else if (isRollSubmit && wasGroupCheckRoll && order.length > 1) {
      // Group check roll — keep the same player's turn; DM resolves the check and returns to them
      nextPlayerName = campaignPartyRef.current.find(c => c.id === turnOrderRef.current[currentTurnIndexRef.current])?.name ?? null;
    } else if (!isRollSubmit && !isQuestion && order.length > 1) {
      const allActedNow = order.every(cid => roundActionsRef.current.some(a => a.characterId === cid));
      if (!allActedNow) {
        const nextIdx = findNextUnactedIdx(currentTurnIndexRef.current);
        nextPlayerName = campaignPartyRef.current.find(c => c.id === turnOrderRef.current[nextIdx])?.name ?? null;
        // Store for deferred application — sendToAI's DM routing may override this
        pendingTurnAdvanceIdx = nextIdx;
      }
    }

    const allActedForDM = !isRollSubmit && !isQuestion && order.length > 1
      && roundActionsRef.current.length >= campaignPartyRef.current.length
      && order.every(cid => roundActionsRef.current.some(a => a.characterId === cid));

    // Capture current turn index before the DM responds so we can detect whether
    // (The previous "round-complete short circuit" that fired reconciliation
    // directly without a bridge has been removed. It bypassed sendToAI, which
    // meant the [NO-TURN] tag — used when the DM rejects an invalid action
    // attempt — could never fire on the last submission of a round. The
    // BRIDGE RESPONSE ONLY prompt and the [NO-TURN] detection inside sendToAI
    // together replace what the short-circuit was defending against: the
    // bridge prompt forbids questions, and [NO-TURN] removes the player from
    // roundActions if their action wasn't actually valid, which keeps
    // pendingReconciliation from firing for an invalid last action.)

    // sendToAI's DM-driven routing already moved the turn to the correct player.
    const turnIdxBeforeDM = currentTurnIndexRef.current;
    dmFollowUpBlockAdvanceRef.current = false; // reset before each DM call
    pendingReconciliationRef.current = null;
    await sendToAI(updatedMessages, false, {
      trackRound:     order.length > 1,
      nextPlayerName,
      prevPlayerName: character?.name ?? null,
      allActed:       allActedForDM,
      ...(isRollSubmit && { isRollResult: true }),
      ...(wasGroupCheckRoll && { isGroupCheckResult: true }),
      ...(isQuestion && { isQuestion: true }),
    });

    // Apply the deferred turn advancement only if:
    // 1. The DM's routing didn't already move the turn to a different player, AND
    // 2. The DM didn't request a roll from the current player (e.g. damage roll after a hit), AND
    // 3. The DM didn't ask the same player a follow-up question (e.g. "which element?")
    const rollPendingAfterDM = rollRequestedUserIdRef.current !== null;
    // Reconciliation-guard window: if triggerReconciliation just fired (here
    // or on another client), suppress the deferred advance entirely.
    // Otherwise the index we'd broadcast would clobber the freshly-set
    // turn_taken(0) from the reset, and roundActionsRef having just been
    // cleared would let candidateAlreadyActed pass falsely.
    const inReconciliationWindow = Date.now() < reconciliationGuardUntilRef.current;
    // Single-broadcast invariant: if a DM-routing branch already broadcast
    // turn_taken this cycle, don't emit a competing one from the deferred
    // path. The DM-routing decision wins.
    const alreadyBroadcastedThisCycle = turnBroadcastedThisCycleRef.current;
    if (pendingTurnAdvanceIdx !== null
        && currentTurnIndexRef.current === turnIdxBeforeDM
        && !rollPendingAfterDM
        && !dmFollowUpBlockAdvanceRef.current
        && !inReconciliationWindow
        && !alreadyBroadcastedThisCycle) {
      // CRITICAL — turn-sync correctness:
      // pendingTurnAdvanceIdx was computed at submission time, BEFORE we awaited
      // the DM. During the DM's stream, player_action broadcasts from other
      // clients may have landed and updated roundActionsRef. If we trust the
      // stale index here, we can advance to a player who has since acted —
      // which other clients then receive via turn_taken and silently accept,
      // producing visible turn desync ("the indicator landed on someone who
      // already went").
      // Re-run findNextUnactedIdx (which now reads turnOrderRef / roundActionsRef
      // INSIDE the closure, not the captured snapshot) so the broadcast we
      // emit reflects reality on every client. If every order slot has now
      // acted, suppress the broadcast entirely — round reconciliation will
      // fire and reset the round cleanly via round_reset + turn_taken(0).
      const freshNextIdx = findNextUnactedIdx(currentTurnIndexRef.current);
      const candidateCharId = turnOrderRef.current[freshNextIdx];
      const candidateAlreadyActed = roundActionsRef.current.some(a => a.characterId === candidateCharId);
      if (!candidateAlreadyActed) {
        setCurrentTurnIndex(freshNextIdx);
        currentTurnIndexRef.current = freshNextIdx;
        shouldPersistTurnRef.current = true;
        channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: freshNextIdx } });
        turnBroadcastedThisCycleRef.current = true;
        if (campaignPartyRef.current.length > 1) {
          const advPartyIdx = campaignPartyRef.current.findIndex(c => c.id === candidateCharId);
          if (advPartyIdx >= 0) setActiveCharIdx(advPartyIdx);
        }
      }
    }

    // If sendToAI detected all players have acted (edge case — allActedForDM was
    // false at submission time but became true via in-flight broadcasts), trigger
    // round reconciliation. With the short-circuit above this path is rare.
    const pending = pendingReconciliationRef.current as { messages: Message[]; summary: { name: string; action: string }[] } | null;
    if (pending) {
      pendingReconciliationRef.current = null;
      await triggerReconciliation(pending.messages, pending.summary);
    }
  };

  // ── Inventory exchange ────────────────────────────────────────────────────────
  const dropItem = useCallback(async (itemName: string, itemType: "item" | "weapon") => {
    const char = characterRef.current;
    if (!char) return;
    const droppedMeta = char.inventory.item_meta?.[itemName];
    const dropped: DroppedItem = {
      id:            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name:          itemName,
      type:          itemType,
      fromCharacter: char.name,
      fromUserId:    userIdRef.current!,
      ...(droppedMeta && { meta: droppedMeta }),
    };
    const itemsLeft   = itemType === "item"   ? char.inventory.items.filter(i => i !== itemName)   : char.inventory.items;
    const weaponsLeft = itemType === "weapon" ? char.inventory.weapons.filter(w => w !== itemName) : char.inventory.weapons;
    const stillHasItem = itemsLeft.includes(itemName) || weaponsLeft.includes(itemName);
    const newMeta: Character["inventory"]["item_meta"] = { ...(char.inventory.item_meta ?? {}) };
    if (!stillHasItem) delete newMeta[itemName];
    const newInv: Character["inventory"] = {
      ...char.inventory,
      items:   itemsLeft,
      weapons: weaponsLeft,
      ...(Object.keys(newMeta).length > 0 ? { item_meta: newMeta } : { item_meta: undefined }),
    };
    setCharacter(prev => prev ? { ...prev, inventory: newInv } : null);
    await charWrite(char.id, { inventory: newInv });
    setDroppedItems(prev => [...prev, dropped]);
    channelRef.current?.send({ type: "broadcast", event: "item_dropped", payload: dropped });
  }, [charWrite]);

  const tradeItem = useCallback(async (itemName: string, itemType: "item" | "weapon", targetCharId: string) => {
    const from = characterRef.current;
    const to   = campaignPartyRef.current.find(c => c.id === targetCharId);
    if (!from || !to || from.id === to.id) return;
    // Transfer item_meta entry along with the item so tooltips survive the trade
    const transferredMeta = from.inventory.item_meta?.[itemName];
    const fromItemsLeft   = itemType === "item"   ? from.inventory.items.filter(i => i !== itemName)   : from.inventory.items;
    const fromWeaponsLeft = itemType === "weapon" ? from.inventory.weapons.filter(w => w !== itemName) : from.inventory.weapons;
    const stillHasItem    = fromItemsLeft.includes(itemName) || fromWeaponsLeft.includes(itemName);
    const fromMeta: Character["inventory"]["item_meta"] = { ...(from.inventory.item_meta ?? {}) };
    if (!stillHasItem) delete fromMeta[itemName];
    const fromNewInv: Character["inventory"] = {
      ...from.inventory,
      items:   fromItemsLeft,
      weapons: fromWeaponsLeft,
      ...(Object.keys(fromMeta).length > 0 ? { item_meta: fromMeta } : { item_meta: undefined }),
    };
    const toMeta: Character["inventory"]["item_meta"] = { ...(to.inventory.item_meta ?? {}) };
    if (transferredMeta) toMeta[itemName] = transferredMeta;
    const toNewInv: Character["inventory"] = {
      ...to.inventory,
      items:   itemType === "item"   ? [...(to.inventory?.items   ?? []), itemName] : (to.inventory?.items   ?? []),
      weapons: itemType === "weapon" ? [...(to.inventory?.weapons ?? []), itemName] : (to.inventory?.weapons ?? []),
      ...(Object.keys(toMeta).length > 0 && { item_meta: toMeta }),
    };
    setCharacter(prev => prev?.id === from.id ? { ...prev, inventory: fromNewInv } : prev);
    setCampaignParty(prev => prev.map(c =>
      c.id === from.id ? { ...c, inventory: fromNewInv }
      : c.id === to.id ? { ...c, inventory: toNewInv }
      : c
    ));
    setTradingItem(null);
    await Promise.all([
      charWrite(from.id, { inventory: fromNewInv }),
      charWrite(to.id,   { inventory: toNewInv   }),
    ]);
    channelRef.current?.send({ type: "broadcast", event: "character_sync", payload: { charId: from.id, inventory: fromNewInv } });
    channelRef.current?.send({ type: "broadcast", event: "character_sync", payload: { charId: to.id,   inventory: toNewInv   } });
  }, [charWrite]);

  const takeItem = useCallback(async (dropped: DroppedItem) => {
    const char = characterRef.current;
    if (!char) return;
    setDroppedItems(prev => prev.filter(i => i.id !== dropped.id));
    channelRef.current?.send({ type: "broadcast", event: "item_taken", payload: { id: dropped.id } });
    const mergedMeta: Character["inventory"]["item_meta"] = { ...(char.inventory.item_meta ?? {}) };
    if (dropped.meta) mergedMeta[dropped.name] = dropped.meta;
    const newInv: Character["inventory"] = {
      ...char.inventory,
      items:   dropped.type === "item"   ? [...char.inventory.items, dropped.name]   : char.inventory.items,
      weapons: dropped.type === "weapon" ? [...char.inventory.weapons, dropped.name] : char.inventory.weapons,
      ...(Object.keys(mergedMeta).length > 0 && { item_meta: mergedMeta }),
    };
    setCharacter(prev => prev ? { ...prev, inventory: newInv } : null);
    await charWrite(char.id, { inventory: newInv });
  }, [charWrite]);


  const handleUseItem = useCallback(async (itemName: string) => {
    const char = characterRef.current;
    if (!char) return;
    const item = getItemByName(itemName);
    if (!item || !item.consumable) return;

    const healEffect = item.effects.find(e => e.type === "hp_heal");
    let newHp = char.hp;
    const parts: string[] = [`Used ${itemName}`];

    if (healEffect?.diceFormula) {
      const { total, rolls } = rollDiceFormula(healEffect.diceFormula);
      const healed = Math.min(char.max_hp - char.hp, total);
      newHp = char.hp + healed;
      parts.push(`+${healed} HP (${healEffect.diceFormula}: [${rolls.join("+")}] = ${total})`);
    } else {
      const specialFx = item.effects.find(e => e.type === "special")?.description;
      if (specialFx) parts.push(specialFx.slice(0, 60));
    }
    parts.push("(consumed)");

    let removed = false;
    const newItems = char.inventory.items.filter(i => {
      if (!removed && i === itemName) { removed = true; return false; }
      return true;
    });
    const newInv = { ...char.inventory, items: newItems };
    const updatedChar: Character = { ...char, hp: newHp, inventory: newInv };
    setCharacter(updatedChar);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updatedChar : c));
    await charWrite(char.id, { hp: newHp, inventory: newInv });

    const notice = parts.join(" · ");
    setStateNotice(notice);
    setTimeout(() => setStateNotice(null), 5000);
    setLogEntries(prev => [...prev, { id: makeLogId("use"), timestamp: new Date(), role: "system", content: `🧪 ${notice}` }]);
  }, [charWrite]);

  // ── Party management ─────────────────────────────────────────────────────────
  const addToParty = useCallback(async (char: Character) => {
    if (campaignPartyRef.current.some(c => c.id === char.id)) return;
    // Combat lock — never allow party additions while any enemy is undefeated.
    if (enemiesRef.current.some(e => !e.is_defeated)) return;

    let updated: Character;

    if (usesCCTableRef.current) {
      // CC-table campaign: check for existing saved state (returning player).
      // The character's level / xp / max_hp / ability scores live on the global
      // characters table — they persist across campaigns. The CC snapshot only
      // contributes per-session state (HP, inventory, spell slots, status).
      const { data: existingCC } = await supabase.from("campaign_characters")
        .select("*").eq("campaign_id", params.id).eq("character_id", char.id).maybeSingle();
      if (existingCC) {
        const cc = existingCC as CampaignCharacterRow;
        updated = {
          ...char, campaign_id: params.id,
          hp: cc.hp,
          inventory: cc.inventory, spell_slots_used: cc.spell_slots_used,
          status_effects: cc.status_effects, cantrips_known: cc.cantrips_known,
          spells_prepared: cc.spells_prepared,
        };
        await supabase.from("characters").update({ campaign_id: params.id }).eq("id", char.id);
      } else {
        const ib      = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
        const freshHp = char.max_hp + ib.hpMaxAdd;
        await supabase.from("characters").update({ campaign_id: params.id }).eq("id", char.id);
        await supabase.from("campaign_characters").insert({
          campaign_id: params.id, character_id: char.id, user_id: userIdRef.current,
          hp: freshHp, max_hp: char.max_hp, xp: char.xp ?? 0, level: char.level,
          inventory: char.inventory, spell_slots_used: {}, status_effects: [],
          cantrips_known: char.cantrips_known ?? [], spells_prepared: char.spells_prepared ?? [],
        });
        updated = { ...char, campaign_id: params.id, hp: freshHp, spell_slots_used: {}, status_effects: [] };
      }
    } else if (char.campaign_id !== params.id) {
      // Old campaign joining new — reset to full D&D 5e starting metrics
      const ib      = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
      const freshHp = char.max_hp + ib.hpMaxAdd;
      const { error } = await supabase.from("characters").update({
        campaign_id: params.id, hp: freshHp, spell_slots_used: {}, status_effects: [],
      }).eq("id", char.id);
      if (error) { console.error("[addToParty]", error); return; }
      updated = { ...char, campaign_id: params.id, hp: freshHp, spell_slots_used: {}, status_effects: [] };
    } else {
      // Old campaign returning — preserve damage, ensure item HP bonuses are reflected
      const ib = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
      const effectiveMax = char.max_hp + ib.hpMaxAdd;
      const resolvedHp = char.hp >= char.max_hp ? effectiveMax : Math.min(char.hp, effectiveMax);
      if (resolvedHp !== char.hp) await supabase.from("characters").update({ hp: resolvedHp }).eq("id", char.id);
      updated = { ...char, hp: resolvedHp };
    }

    const newParty = [...campaignPartyRef.current, updated];
    setCampaignParty(newParty);
    campaignPartyRef.current = newParty;
    if (!characterRef.current || characterRef.current.user_id !== userIdRef.current) {
      setCharacter(updated); characterRef.current = updated;
      setActiveCharIdx(newParty.length - 1);
    }
    setPartyChangePending(true);
    const joinContent = `[Party change — ${updated.name}, a Level ${updated.level} ${updated.race} ${updated.class}, has just joined the party. The party now has ${newParty.length} adventurers. Write a brief in-world moment (1–3 sentences) showing how ${updated.name} arrives in the current scene — give them a small gesture, line, or detail that fits their class. Do not call for a dice roll. Do not address anyone with "what do you do" — the next turn prompt is handled separately.]`;
    const campaignContext = campaignDescriptionRef.current
      ? { title: campaignTitle, description: campaignDescriptionRef.current }
      : undefined;
    const partyLeaderName = newParty.find(c => c.id === partyLeaderId)?.name ?? null;
    fireDmPartyResponse(
      { role: "player", content: joinContent },
      { party: newParty, campaignContext, partyLeaderName },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, fireDmPartyResponse, campaignTitle, partyLeaderId]);

  // Reclaim leadership of an empty campaign. Seats the chosen roster character
  // as the first party member AND sets them as party leader in one shot, so
  // the player can immediately invite others. Mirrors the join half of
  // addToParty but skips the DM narration (no story exists yet to weave into).
  const claimLeadership = useCallback(async (char: Character) => {
    if (claimingLeaderId) return; // debounce double-clicks
    setClaimingLeaderId(char.id);
    try {
      // 1. Seat the character in the campaign (no DM narration — fresh start).
      const ib = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
      const freshHp = char.max_hp + ib.hpMaxAdd;
      await supabase.from("characters").update({
        campaign_id: params.id, hp: freshHp, spell_slots_used: {}, status_effects: [],
      }).eq("id", char.id);

      const seated: Character = { ...char, campaign_id: params.id, hp: freshHp, spell_slots_used: {}, status_effects: [] };
      const newParty = [seated];
      setCampaignParty(newParty);
      campaignPartyRef.current = newParty;
      setCharacter(seated);
      characterRef.current = seated;
      setActiveCharIdx(0);

      // 2. Set them as party leader AND reset turn order so any IDs of
      // departed characters are cleared. The newly-seated leader becomes the
      // sole turn-holder.
      const { error: leaderErr } = await supabase.from("campaigns")
        .update({ party_leader_id: char.id, turn_order: [char.id], current_turn_index: 0 }).eq("id", params.id);
      if (leaderErr) console.error("[claim leader]", leaderErr.message);
      setPartyLeaderId(char.id);
      setTurnOrder([char.id]);
      turnOrderRef.current = [char.id];
      setCurrentTurnIndex(0);
      currentTurnIndexRef.current = 0;
      channelRef.current?.send({ type: "broadcast", event: "leader_changed", payload: { newLeaderId: char.id } });

      // 3. Invalidate the cached resume narration. The last DM message in the
      // history (and any [RECAP] sitting on top of it) addresses someone who
      // is no longer in the party — replaying it would show the player a line
      // like "What do you do, Tiegan?" when Tiegan is gone. Clearing these
      // refs forces the resume flow to generate a FRESH recap that targets
      // the newly-seated leader instead.
      resumeNarrationRef.current = "";
      resumeRecapTriggeredRef.current = false;

      // 4. Close the prompt — the Party tab will now show the seated character.
      setClaimLeaderOpen(false);
    } finally {
      setClaimingLeaderId(null);
    }
  }, [params.id, claimingLeaderId]);

  const leaveParty = useCallback(async (charId: string) => {
    const char = campaignPartyRef.current.find(c => c.id === charId);
    if (!char) return;
    // Combat lock — never allow party removals while any enemy is undefeated.
    if (enemiesRef.current.some(e => !e.is_defeated)) return;
    // Persist the removal — clear campaign_id so they don't appear on future loads
    await supabase.from("characters").update({ campaign_id: null }).eq("id", charId);
    const newParty = campaignPartyRef.current.filter(c => c.id !== charId);
    setCampaignParty(newParty);
    campaignPartyRef.current = newParty;
    if (characterRef.current?.id === charId) {
      const next = newParty[0] ?? null;
      setCharacter(next); characterRef.current = next;
      setActiveCharIdx(next ? newParty.indexOf(next) : 0);
    }
    setPartyChangePending(true);
    const remaining = newParty.length;
    const leaveContent = `[Party change — ${char.name}, the Level ${char.level} ${char.race} ${char.class}, has just departed from the party. ${remaining} adventurer${remaining === 1 ? "" : "s"} ${remaining === 1 ? "remains" : "remain"}. Write a brief in-world moment (1–3 sentences) showing ${char.name}'s exit from the current scene — a parting line, an obligation pulling them away, a quiet fade into the crowd, whatever fits the tone. Do not call for a dice roll. Do not address anyone with "what do you do" — the next turn prompt is handled separately.]`;
    const campaignContext = campaignDescriptionRef.current
      ? { title: campaignTitle, description: campaignDescriptionRef.current }
      : undefined;
    const partyLeaderName = newParty.find(c => c.id === partyLeaderId)?.name ?? null;
    fireDmPartyResponse(
      { role: "player", content: leaveContent },
      { party: newParty, campaignContext, partyLeaderName },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireDmPartyResponse, campaignTitle, partyLeaderId]);

  const handleDiceResult = (result: number, diceType: number, description?: string) => {
    // Stop any in-flight narration immediately — roll submission takes priority
    if (narAudioRef.current) { narAudioRef.current.pause(); narAudioRef.current.src = ""; }
    setNarrating(false);
    narGenerationRef.current++;
    narSlotCounterRef.current = 0;
    narSlotsRef.current = [];
    narSlotTextsRef.current = [];
    narSlotRetriedRef.current = [];
    narPlaySlotRef.current = 0;
    setShowDice(false);
    setRequiredDiceType(null);
    setRequiredRollMode(null);
    setDiceRollContext(null);
    const msg = description ?? `Rolled a ${result} on a d${diceType}`;
    handleSend(`[${msg}]`, true);
  };

  const handleDiceCancel = () => {
    setShowDice(false);
    setPendingDiceShow(false);
    setDiceRollTarget(null);
    setRequiredDiceType(null);
    setRequiredRollMode(null);
    setDiceRollContext(null);
    setRollRequestedUserId(null);
    rollRequestedUserIdRef.current = null;
  };

  const currentTurnPlayerId = turnOrder[currentTurnIndex] ?? null;
  const isPartyLeader       = !!character && character.id === partyLeaderId;
  // True only when partyLeaderId resolves to an actual party member. When it
  // doesn't (stale/broken DB value, mid-render gap during reclaim), the
  // campaign owner gets the panel as a recovery fail-safe so they can fix the
  // state. Once a valid leader exists, ONLY that leader manages the party —
  // even the campaign owner loses the panel if they've transferred leadership.
  const hasValidLeader      = !!partyLeaderId && campaignParty.some(c => c.id === partyLeaderId);
  const canManageParty      = isPartyLeader || (isCampaignOwner && !hasValidLeader);
  const isMyTurn            = rollRequestedUserId
    ? rollRequestedUserId === userId
    : (turnOrder.length <= 1 || currentTurnPlayerId === character?.id);
  const dmBusy              = isTyping || narrating;

  const xpToNext   = character ? getXpToNextLevel(character.level) : 300;
  const xpPercent  = character ? Math.min(100, ((character.xp ?? 0) / xpToNext) * 100) : 0;

  const STAT_KEY_MAP: Record<string, string> = {
    STR: "strength", DEX: "dexterity", CON: "constitution",
    INT: "intelligence", WIS: "wisdom", CHA: "charisma",
  };
  const STAT_FULL: Record<string, string> = {
    STR: "Strength", DEX: "Dexterity", CON: "Constitution",
    INT: "Intelligence", WIS: "Wisdom", CHA: "Charisma",
  };
  const STAT_GENERAL_DESC: Record<string, string> = {
    STR: "Melee attack rolls, damage, Athletics checks, and carrying capacity.",
    DEX: "Ranged attacks, AC in light armor, Initiative, Stealth, Acrobatics, and Sleight of Hand.",
    CON: "Hit points gained at each level and Constitution saving throws.",
    INT: "Investigation, Arcana, History, Nature, and spellcasting modifier for Wizards.",
    WIS: "Perception, Insight, Survival, Medicine, and spellcasting for Clerics and Druids.",
    CHA: "Persuasion, Deception, Intimidation, and spellcasting for Bards, Sorcerers, and Warlocks.",
  };
  const CURRENCY_INFO: Record<string, { name: string; exchange: string }> = {
    pp: { name: "Platinum Pieces", exchange: "1 pp = 10 gp" },
    gp: { name: "Gold Pieces",     exchange: "Standard currency · 1 gp = 10 sp" },
    ep: { name: "Electrum Pieces", exchange: "1 ep = 5 sp · rarely used outside old empires" },
    sp: { name: "Silver Pieces",   exchange: "1 sp = 10 cp · 10 sp = 1 gp" },
    cp: { name: "Copper Pieces",   exchange: "Smallest coin · 100 cp = 1 gp" },
  };
  const itemBonuses    = character
    ? computeInventoryBonuses(character.inventory?.items ?? [], character.inventory?.weapons ?? [])
    : null;
  const effectiveMaxHp = character ? character.max_hp + (itemBonuses?.hpMaxAdd ?? 0) : 0;
  const hpPercent      = character ? Math.max(0, Math.min(100, (character.hp / Math.max(1, effectiveMaxHp)) * 100)) : 0;
  const hpColor        = hpPercent > 60 ? "#22c55e" : hpPercent > 25 ? "#f59e0b" : "#ef4444";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "row", overflow: "hidden" }}>
      {/* ── Empty-party reclaim modal ──
          Fires when a campaign loads with zero seated characters. Owner picks
          one of their roster characters to seat as the new party leader. */}
      {claimLeaderOpen && (
        <div
          onClick={() => {}}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div
            className="glass-panel animate-fade-in"
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "640px", padding: "32px", position: "relative", border: "1px solid rgba(212,169,106,0.45)", boxShadow: "0 0 60px rgba(212,169,106,0.18), 0 24px 80px rgba(0,0,0,0.7)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "20px" }}>
              <span style={{ fontSize: "2.6rem", marginBottom: "8px" }}>👑</span>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fde68a", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                Empty Camp
              </p>
              <h2 style={{ fontSize: "1.55rem", fontWeight: 800, marginBottom: "10px" }}>Seat a New Party Leader</h2>
              <p style={{ color: "var(--subtle)", fontSize: "0.95rem", lineHeight: 1.6, maxWidth: "520px" }}>
                This campaign has no adventurers. Choose a hero from your roster to seat as
                the new party leader. They&apos;ll appear in the Party tab immediately and can
                invite others.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", maxHeight: "55vh", overflowY: "auto", padding: "4px" }}>
              {userRoster.map(rc => {
                const classColor = CLASS_COLORS[rc.class] ?? "#8b5cf6";
                const claiming = claimingLeaderId === rc.id;
                const otherClaiming = !!claimingLeaderId && claimingLeaderId !== rc.id;
                return (
                  <button
                    key={rc.id}
                    onClick={() => claimLeadership(rc)}
                    disabled={!!claimingLeaderId}
                    style={{
                      background: "rgba(0,0,0,0.45)",
                      border: `1.5px solid ${claiming ? "#fde68a" : classColor + "55"}`,
                      borderRadius: "10px",
                      padding: "12px 10px",
                      cursor: claimingLeaderId ? (claiming ? "wait" : "not-allowed") : "pointer",
                      opacity: otherClaiming ? 0.4 : 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                      transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
                      color: "white",
                      textAlign: "center",
                      boxShadow: claiming ? `0 0 18px ${classColor}55` : "none",
                    }}
                    onMouseEnter={e => { if (!claimingLeaderId) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = classColor; e.currentTarget.style.boxShadow = `0 6px 22px ${classColor}33, 0 0 12px rgba(212,169,106,0.2)`; } }}
                    onMouseLeave={e => { if (!claimingLeaderId) { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = `${classColor}55`; e.currentTarget.style.boxShadow = "none"; } }}
                  >
                    <div style={{ width: "72px", height: "72px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${classColor}aa`, background: "rgba(0,0,0,0.5)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {rc.portrait_url
                        ? <img src={rc.portrait_url} alt={rc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: "1.8rem" }}>🧙</span>
                      }
                    </div>
                    <div style={{ minWidth: 0, width: "100%" }}>
                      <div style={{ fontSize: "0.86rem", fontWeight: 700, color: classColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rc.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "2px" }}>Lvl {rc.level} {rc.race} {rc.class}</div>
                    </div>
                    {claiming && (
                      <span style={{ fontSize: "0.7rem", color: "#fde68a", fontWeight: 700, letterSpacing: "0.06em" }}>Seating…</span>
                    )}
                  </button>
                );
              })}
            </div>
            {userRoster.length === 0 && (
              <p style={{ color: "var(--subtle)", fontSize: "0.9rem", textAlign: "center", padding: "20px" }}>
                You have no characters yet.{" "}
                <Link href="/create-character" style={{ color: "var(--primary)", fontWeight: 700 }}>Create one →</Link>
              </p>
            )}
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
              <Link href="/dashboard" style={{ color: "#64748b", fontSize: "0.82rem", textDecoration: "none" }}>
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Tutorial modal ── */}
      {tutorialStep !== null && (() => {
        const step = CAMPAIGN_TUTORIAL_STEPS[tutorialStep];
        const isLast = tutorialStep === CAMPAIGN_TUTORIAL_STEPS.length - 1;
        const closeTutorial = (markDone = true) => {
          if (markDone) localStorage.setItem(`dnd_campaign_tutorial_done_${params.id}`, "1");
          setTutorialStep(null);
        };

        const Diagram = () => {
          const d = (step as { diagram?: string }).diagram;
          if (!d) return null;
          const base: React.CSSProperties = { margin: "0 0 18px", padding: "14px", background: "rgba(0,0,0,0.35)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", fontSize: "0.72rem" };
          if (d === "chat") return (
            <div style={base}>
              <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: "8px", padding: "10px 12px", marginBottom: "8px" }}>
                <div style={{ color: "#8b5cf6", fontWeight: "bold", marginBottom: "4px" }}>🎭 Dungeon Master</div>
                <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>&quot;The iron door groans open. Beyond it, torchlight flickers across stone walls...&quot;</div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: "6px", padding: "8px 10px", color: "#64748b" }}>I draw my sword and step through carefully...</div>
                <div style={{ background: "var(--primary)", borderRadius: "6px", padding: "8px 12px", color: "white", fontWeight: "bold" }}>→</div>
              </div>
            </div>
          );
          if (d === "party") return (
            <div style={{ ...base, display: "flex", gap: "8px" }}>
              <div style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>⚔</div>
                  <div><div style={{ color: "white", fontSize: "0.8rem", fontWeight: "bold" }}>Thorin</div><div style={{ color: "#64748b", fontSize: "0.65rem" }}>Dwarf Fighter</div></div>
                </div>
                <div style={{ height: "4px", background: "#3f3f46", borderRadius: "2px" }}><div style={{ width: "80%", height: "100%", background: "#22c55e", borderRadius: "2px" }} /></div>
                <div style={{ color: "#64748b", fontSize: "0.65rem", marginTop: "4px", textAlign: "center" }}>Waiting</div>
              </div>
              <div style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "rgba(139,92,246,0.15)", border: "1.5px solid rgba(139,92,246,0.8)", boxShadow: "0 0 14px rgba(139,92,246,0.3)" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(139,92,246,0.3)", border: "1.5px solid rgba(139,92,246,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>🧙</div>
                  <div><div style={{ color: "#c4b5fd", fontSize: "0.8rem", fontWeight: "bold" }}>Lyra</div><div style={{ color: "#64748b", fontSize: "0.65rem" }}>Elf Wizard</div></div>
                </div>
                <div style={{ height: "4px", background: "#3f3f46", borderRadius: "2px" }}><div style={{ width: "65%", height: "100%", background: "#8b5cf6", borderRadius: "2px" }} /></div>
                <div style={{ color: "#c4b5fd", fontSize: "0.65rem", marginTop: "4px", textAlign: "center", fontWeight: "bold" }}>⚡ Acting</div>
              </div>
            </div>
          );
          if (d === "dice") return (
            <div style={{ ...base, textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: "12px", alignItems: "center" }}>
                <div style={{ padding: "8px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: "8px", color: "#94a3b8", fontSize: "0.8rem" }}>← Tavern</div>
                <div style={{ flex: 1, padding: "6px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", color: "#64748b", fontSize: "0.78rem" }}>My Campaign</div>
                <div style={{ padding: "8px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: "8px", color: "#94a3b8", fontSize: "0.8rem" }}>🔇</div>
                <div style={{ padding: "8px 14px", background: "rgba(251,191,36,0.2)", border: "1.5px solid rgba(251,191,36,0.7)", borderRadius: "8px", color: "#fbbf24", display:"inline-flex", alignItems:"center", boxShadow: "0 0 12px rgba(251,191,36,0.3)" }}><D20Icon size={22} color="#fbbf24"/></div>
              </div>
              <div style={{ color: "#f59e0b", fontSize: "0.68rem", marginTop: "8px" }}>↑ Click here or press D to roll</div>
            </div>
          );
          if (d === "sheet") return (
            <div style={base}>
              <div style={{ display: "flex", gap: "2px", marginBottom: "10px" }}>
                {(["Party", "Sheet", "Log", "⚔ Combat"] as const).map(tab => (
                  <div key={tab} style={{ flex: 1, padding: "6px 2px", borderRadius: "6px", textAlign: "center", fontSize: "0.65rem", background: tab === "Sheet" ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.04)", border: tab === "Sheet" ? "1px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.06)", color: tab === "Sheet" ? "#c4b5fd" : "#64748b", fontWeight: tab === "Sheet" ? "bold" : "normal" }}>{tab}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
                {[["Strength","16","+3"],["Dexterity","12","+1"],["Constitution","14","+2"],["Intelligence","10","+0"],["Wisdom","13","+1"],["Charisma","8","-1"]].map(([name, score, mod]) => (
                  <div key={name} style={{ background: "rgba(0,0,0,0.3)", borderRadius: "6px", padding: "5px 2px", textAlign: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: "0.5rem", color: "#64748b", marginBottom: "1px" }}>{name}</div>
                    <div style={{ fontSize: "0.82rem", fontWeight: "bold" }}>{score}</div>
                    <div style={{ fontSize: "0.6rem", color: "#22c55e" }}>{mod}</div>
                  </div>
                ))}
              </div>
            </div>
          );
          if (d === "audio") return (
            <div style={{ ...base, display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ flex: 1, padding: "10px 12px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.5)", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "1.4rem", marginBottom: "4px" }}>🔊</div>
                <div style={{ color: "#c4b5fd", fontSize: "0.7rem", fontWeight: "bold" }}>Voice Narration</div>
                <div style={{ color: "#64748b", fontSize: "0.62rem", marginTop: "2px" }}>Header button</div>
              </div>
              <div style={{ color: "#475569", fontSize: "1rem" }}>+</div>
              <div style={{ flex: 1, padding: "10px 12px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "1.4rem", marginBottom: "4px" }}>🎵</div>
                <div style={{ color: "#34d399", fontSize: "0.7rem", fontWeight: "bold" }}>Music Player</div>
                <div style={{ color: "#64748b", fontSize: "0.62rem", marginTop: "2px" }}>Bottom right corner</div>
              </div>
            </div>
          );
          return null;
        };

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
            onClick={() => {}} // no click-outside dismiss — explicit buttons only
          >
            <div className="glass-panel animate-fade-in" style={{ width: "100%", maxWidth: "480px", padding: "32px", position: "relative" }} onClick={e => e.stopPropagation()}>
              {/* Progress dots */}
              <div style={{ display: "flex", gap: "5px", justifyContent: "center", marginBottom: "24px" }}>
                {CAMPAIGN_TUTORIAL_STEPS.map((_, i) => (
                  <button key={i} onClick={() => setTutorialStep(i)} style={{ width: i === tutorialStep ? "20px" : "7px", height: "7px", borderRadius: "4px", background: i === tutorialStep ? "var(--primary)" : i < tutorialStep ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", transition: "all 0.25s", padding: 0 }} />
                ))}
              </div>

              {/* Icon */}
              <div style={{ textAlign: "center", fontSize: "2.8rem", marginBottom: "12px", lineHeight: 1 }}>{step.icon}</div>

              {/* Title */}
              <h2 style={{ textAlign: "center", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "12px" }}>{step.title}</h2>

              {/* Diagram */}
              <Diagram />

              {/* Body */}
              <p style={{ color: "#94a3b8", fontSize: "0.88rem", lineHeight: 1.65, textAlign: "center", marginBottom: (step as { tip?: string }).tip ? "14px" : "28px" }}>
                {step.body}
              </p>

              {/* Tip */}
              {(step as { tip?: string }).tip && (
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "8px", padding: "10px 12px", marginBottom: "28px" }}>
                  <span style={{ fontSize: "0.9rem", flexShrink: 0, marginTop: "1px" }}>💡</span>
                  <span style={{ fontSize: "0.78rem", color: "#fcd34d", lineHeight: 1.5 }}>{(step as { tip?: string }).tip}</span>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => closeTutorial(true)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "0.78rem", padding: "4px 0", transition: "color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#94a3b8"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#475569"; }}>
                  Skip Tutorial
                </button>
                <div style={{ display: "flex", gap: "8px" }}>
                  {tutorialStep > 0 && (
                    <button className="btn-secondary" onClick={() => setTutorialStep(t => t! - 1)} style={{ padding: "9px 18px", fontSize: "0.85rem" }}>← Back</button>
                  )}
                  {isLast ? (
                    <button className="btn-primary" onClick={() => closeTutorial(true)} style={{ padding: "9px 22px", fontSize: "0.85rem" }}>Let&apos;s Play! →</button>
                  ) : (
                    <button className="btn-primary" onClick={() => setTutorialStep(t => t! + 1)} style={{ padding: "9px 22px", fontSize: "0.85rem" }}>Next →</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {showDice && <DiceRoller onRollComplete={handleDiceResult} onCancel={handleDiceCancel} requiredDice={requiredDiceType} requiredRollMode={requiredRollMode} rollContext={diceRollContext} narVolume={narVolume} narMuted={narMuted} />}
      {toastMsg && (
        <div onClick={() => setToastMsg(null)} style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "rgba(127,29,29,0.95)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: "10px", padding: "12px 20px", color: "#fca5a5", fontSize: "0.85rem", maxWidth: "420px", textAlign: "center", cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          🔇 {toastMsg}
        </div>
      )}

      {/* Session start overlay — pre-start screen OR loading screen */}
      {(!sessionStarted || loadFadingOut) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,3,15,0.97)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", opacity: loadFadingOut ? 0 : 1, transition: "opacity 0.95s ease", pointerEvents: loadFadingOut ? "none" : "auto" }}>

          {/* ── Loading screen (after Begin is clicked on a new campaign) ── */}
          {campaignLoading ? (
            <div className="animate-fade-in" style={{ textAlign: "center", maxWidth: "420px", padding: "40px" }}>
              <div style={{ width: "88px", height: "88px", borderRadius: "50%", border: "1px solid rgba(139,92,246,0.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 36px", animation: "dmOrbPulse 2.8s ease-in-out infinite" }}>
                <span style={{ fontSize: "2.8rem", display: "inline-block", animation: "dmOrbSpin 10s linear infinite" }}>⬡</span>
              </div>
              <h1 style={{ fontSize: "1.55rem", fontWeight: "bold", marginBottom: "10px", color: "#e2e8f0", letterSpacing: "0.02em" }}>DM is creating your world…</h1>
              <p style={{ color: "#3f4f62", fontSize: "0.82rem", marginBottom: "44px", lineHeight: 1.6 }}>Weaving the threads of fate</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
                {([
                  { done: loadSceneDone,    label: "Painting the scene"  },
                  { done: loadAmbianceDone, label: "Setting the mood"    },
                  { done: loadDmDone,       label: "Preparing the story" },
                ] as const).map(({ done, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "14px", width: "230px" }}>
                    <span style={{ width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "bold", background: done ? "rgba(34,197,94,0.15)" : "transparent", border: done ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(139,92,246,0.25)", color: done ? "#4ade80" : "#8b5cf6", transition: "all 0.4s ease", animation: done ? "none" : "blink 1.8s step-end infinite" }}>
                      {done ? "✓" : "◦"}
                    </span>
                    <span style={{ fontSize: "0.83rem", color: done ? "#64748b" : "#475569", transition: "color 0.4s ease" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── Pre-start screen ── */
            <div className="animate-fade-in" style={{ textAlign: "center", maxWidth: "480px", padding: "40px" }}>
              {(() => {
                const leaderChar = campaignParty.find(c => c.id === partyLeaderId) ?? character;
                const leaderColor = CLASS_COLORS[leaderChar?.class ?? ""] ?? "#f59e0b";
                return leaderChar ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "28px", gap: "10px" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.15em" }}>Party Leader</span>
                    {leaderChar.portrait_url ? (
                      <div style={{ width: "clamp(180px, 28vmin, 380px)", height: "clamp(180px, 28vmin, 380px)", borderRadius: "50%", overflow: "hidden", border: `5px solid ${leaderColor}`, boxShadow: `0 0 60px ${leaderColor}77, 0 0 120px ${leaderColor}22` }}>
                        <img src={leaderChar.portrait_url} alt={leaderChar.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                      </div>
                    ) : (
                      <div style={{ width: "clamp(180px, 28vmin, 380px)", height: "clamp(180px, 28vmin, 380px)", borderRadius: "50%", border: `5px solid ${leaderColor}`, boxShadow: `0 0 60px ${leaderColor}77`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "clamp(4rem, 12vmin, 9rem)", background: "rgba(0,0,0,0.4)" }}>
                        {leaderChar.class === "Wizard" ? "🧙" : leaderChar.class === "Rogue" ? "🗡️" : leaderChar.class === "Cleric" ? "✝" : leaderChar.class === "Ranger" ? "🏹" : leaderChar.class === "Druid" ? "🌿" : leaderChar.class === "Bard" ? "🎵" : "⚔️"}
                      </div>
                    )}
                    <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "white" }}>{leaderChar.name}</span>
                  </div>
                ) : null;
              })()}
              <h1 style={{ fontSize: "2.2rem", fontWeight: "bold", marginBottom: "10px" }}>Your adventure awaits</h1>
              <p style={{ color: "#64748b", marginBottom: "40px", lineHeight: 1.6 }}>The torchlight flickers as your party gathers in the shadows…</p>
              <button className="btn-primary"
                style={{ padding: "16px 48px", fontSize: "1.1rem", borderRadius: "12px", letterSpacing: "0.04em" }}
                onClick={() => {
                  // Activate audio inside the user gesture
                  for (const el of [narAudioRef.current, previewAudioRef.current]) {
                    if (el) { el.src = "/silence.wav"; el.load(); el.play().catch(() => {}); }
                  }
                  window.__dndMusicPlay?.();
                  // Prime the Web Audio context and preload both audio sets
                  // (class abilities + wild-shape forms) so the first AI-
                  // triggered sound (which fires mid-stream, outside any
                  // gesture) plays reliably with no network latency.
                  primeAbilitySounds();
                  preloadAbilityAudio();
                  preloadWildShapeAudio();
                  preloadSpellAudio();

                  const isNewCampaign = !messagesRef.current.some(m => m.role === "dm" || m.role === "player");
                  if (isNewCampaign) {
                    preloadAbortRef.current?.abort();
                    const cached = preloadResultRef.current;
                    if (cached) {
                      // ── Pre-load complete: skip loading screen, fade directly to session ──
                      preloadResultRef.current = null;
                      autoOpenedRef.current = true;
                      const trigger: Message = { role: "player", content: "Begin our adventure.", sender: "" };
                      setMessages(prev => [...prev, trigger]);
                      if (cached.sceneUrl) {
                        currentSceneRef.current = cached.sceneName;
                        setCurrentSceneUrl(cached.sceneUrl);
                        channelRef.current?.send({ type: "broadcast", event: "scene_change", payload: { senderId: userId, sceneName: cached.sceneName, imageUrl: cached.sceneUrl, sceneType: cached.sceneType, modifiers: cached.modifiers } });
                        if (cached.sceneType) {
                          (window as Window).__dndSetMusicScene?.(cached.sceneName, cached.sceneType, cached.modifiers);
                          (window as Window).__dndSetAmbianceScene?.(cached.sceneName, cached.sceneType, cached.modifiers);
                        }
                      }
                      setOpeningRevealText(cached.dmText);
                      setLoadFadingOut(true);
                      setTimeout(() => {
                        setLoadFadingOut(false);
                        setSessionStarted(true);
                        enqueueNarrationRef.current?.(cached.dmText);
                      }, 950);
                    } else {
                      // ── No pre-load or still in flight: normal loading screen flow ────────
                      setCampaignLoading(true);
                      campaignLoadingRef.current = true;
                      loadingTimeoutRef.current = setTimeout(() => {
                        if (!campaignLoadingRef.current) return;
                        setLoadDmDone(true); setLoadSceneDone(true); setLoadAmbianceDone(true);
                      }, 28000);
                      if (!autoOpenedRef.current) {
                        autoOpenedRef.current = true;
                        setTimeout(() => {
                          if (isTypingRef.current) return;
                          const trigger: Message = { role: "player", content: "Begin our adventure.", sender: "" };
                          sendToAI([...messagesRef.current, trigger], true);
                        }, 400);
                      }
                    }
                  } else {
                    // Resumed campaign: replay the last DM message so the player hears where
                    // things left off. Never trigger a new AI call here — the AI sees the
                    // "[Campaign resumed...]" message as player input and generates nonsense.

                    // Re-derive the active turn from the DM's last message. The DB-saved
                    // current_turn_index reflects the pre-advance that fired before the AI
                    // responded — if the player navigated away before the in-session correction
                    // could persist, the wrong player ends up as "Acting" on resume.
                    if (resumeNarrationRef.current && turnOrderRef.current.length > 1) {
                      const partyNames = campaignPartyRef.current.map(c => c.name);
                      const dmTurnName = detectNextTurnPlayer(resumeNarrationRef.current, partyNames);
                      const dmTurnChar = dmTurnName ? campaignPartyRef.current.find(c => c.name === dmTurnName) : null;
                      if (dmTurnChar) {
                        const dmTurnIdx = turnOrderRef.current.indexOf(dmTurnChar.id);
                        if (dmTurnIdx >= 0 && dmTurnIdx !== currentTurnIndexRef.current) {
                          setCurrentTurnIndex(dmTurnIdx);
                          currentTurnIndexRef.current = dmTurnIdx;
                          shouldPersistTurnRef.current = true;
                          const dmPartyIdx = campaignPartyRef.current.findIndex(c => c.id === dmTurnChar.id);
                          if (dmPartyIdx >= 0) setActiveCharIdx(dmPartyIdx);
                        }
                      }
                    }

                    setSessionStarted(true);

                    // Resume recap audit — fires every resume, not just empty-party reclaims.
                    // 1) Detect the addressee of the cached DM narration USING THE GENERIC
                    //    detector (detectDmAddressee) — it returns ANY name found, including
                    //    departed characters. The narrower detectNextTurnPlayer would silently
                    //    return null for absent characters, causing the audit to miss them.
                    // 2) If the addressed name is NOT in the current party (departed character,
                    //    party changed since last save), the cached text is stale and must be
                    //    replaced — force a fresh recap even when the cached text starts with
                    //    [RECAP].
                    // 3) Otherwise the standard rules apply: skip recap if the latest DM
                    //    message already starts with [RECAP] (page reload after a recap),
                    //    and replay the existing narration in that case.
                    const partyFirstNames = campaignPartyRef.current.map(c => c.name.split(" ")[0].toLowerCase());
                    const cachedAddressee = resumeNarrationRef.current
                      ? detectDmAddressee(resumeNarrationRef.current)
                      : null;
                    const addressesAbsent = !!resumeNarrationRef.current
                      && cachedAddressee !== null
                      && !partyFirstNames.includes(cachedAddressee.toLowerCase());
                    const lastDmIsRecap = !!resumeNarrationRef.current && /^\s*\[RECAP\]/i.test(resumeNarrationRef.current);
                    const forceRecap = addressesAbsent; // stale addressing — regenerate even if cached is a [RECAP]
                    if (forceRecap && resumeNarrationRef.current) {
                      console.warn(`[campaign] cached narration addresses "${cachedAddressee}" who is not in the current party — forcing fresh recap`);
                      // Clear the stale text so its narration doesn't sneak through
                      // the streamer's reset path.
                      resumeNarrationRef.current = "";
                    }
                    if (!resumeRecapTriggeredRef.current && (forceRecap || !lastDmIsRecap)) {
                      resumeRecapTriggeredRef.current = true;
                      // When the audit caught stale addressing, pass the detected
                      // departed name to the API so the recap prompt can be
                      // explicit about whom NOT to address — even if the AI
                      // would otherwise echo the name from chat history.
                      const departedAddresseeName = addressesAbsent && cachedAddressee ? cachedAddressee : undefined;
                      setTimeout(() => {
                        if (isTypingRef.current) return;
                        void sendToAI(messagesRef.current, false, { isResumeRecap: true, departedAddresseeName });
                      }, 400);
                    } else if (resumeNarrationRef.current) {
                      enqueueNarration(resumeNarrationRef.current);
                    }
                    // Recover any loot the original session failed to persist (e.g. legacy
                    // applyStateChange identity-hijack bug). Idempotent — only adds items
                    // the recipient is currently missing.
                    void reconcileResumeLoot();
                  }
                }}>
                Begin Adventure
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Pane 1: Scene ── */}
      <div style={{ flex: 1, position: "relative", borderRight: "1px solid var(--border)", overflow: "hidden" }}>
        {/* Dynamic background image — crossfades on scene change */}
        <img
          key={currentSceneUrl ?? "default"}
          src={currentSceneUrl ?? "/hero_bg.png"}
          alt="Current Scene"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", opacity: 0.75, animation: "fadeIn 1.2s ease" }}
        />
        {/* Scene loading indicator */}
        {sceneLoading && (
          <div style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.6)", borderRadius: "20px", padding: "5px 12px", fontSize: "0.7rem", color: "#8b5cf6", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ animation: "blink 1s step-end infinite" }}>✦</span> Generating scene…
          </div>
        )}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "40px 24px 80px", background: "linear-gradient(transparent, rgba(0,0,0,0.92))", pointerEvents: "none" }}>
          <h2 style={{ fontSize: "1.8rem", fontWeight: "bold", textShadow: "0 2px 10px black", marginBottom: "6px", textTransform: "capitalize" }}>
            {currentSceneRef.current ? currentSceneRef.current.charAt(0).toUpperCase() + currentSceneRef.current.slice(1) : (campaignTitle || "")}
          </h2>
          <p style={{ color: "#cbd5e1", textShadow: "0 1px 5px black", fontSize: "0.9rem" }}>
            {currentSceneRef.current === "tavern" ? "Dimly lit, smelling of stale ale and woodsmoke." : "The story unfolds…"}
          </p>
        </div>
      </div>

      {/* ── Drag handle: Scene | Chat ── */}
      <div
        title="Drag to resize"
        style={{ width: "10px", flexShrink: 0, cursor: "col-resize", background: "var(--border)", transition: "background 0.15s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px" }}
        onMouseDown={e => { e.preventDefault(); dragRef.current = { which: "chat", startX: e.clientX, startW: chatPaneWidth }; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.55)"; }}
        onMouseLeave={e => { if (!dragRef.current) e.currentTarget.style.background = "var(--border)"; }}
      >
        {[0,1,2,3,4].map(i => <span key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: "rgba(255,255,255,0.18)", pointerEvents: "none" }} />)}
      </div>

      {/* ── Pane 2: Chat ── */}
      <div style={{ width: chatPaneWidth, flex: "0 0 auto", display: "flex", flexDirection: "column", background: "var(--background)", overflow: "hidden" }}>
        {/* Header */}
        <header className="glass-panel" style={{ margin: "16px", padding: "12px 16px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", overflow: "visible", flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaignTitle || "Loading…"}</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.7rem", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>DM: Claude · {campaignParty.length} in party</p>
          </div>
          {/* Help / tutorial — hidden at narrow widths */}
          {chatPaneWidth >= 360 && <button
            onClick={() => setTutorialStep(0)}
            title="Open tutorial"
            style={{ flexShrink: 0, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: "8px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.88rem", color: "#64748b", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; e.currentTarget.style.color = "#c4b5fd"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "#64748b"; }}
          >?</button>}
          {/* Font size controls — hidden at narrow widths */}
          <div style={{ display: chatPaneWidth >= 420 ? "flex" : "none", alignItems: "center", gap: "3px", flexShrink: 0 }}>
            <button
              onClick={() => { const v = Math.max(0.65, parseFloat((chatFontSize - 0.05).toFixed(2))); setChatFontSize(v); localStorage.setItem("dnd_chat_font_size", String(v)); }}
              disabled={chatFontSize <= 0.65}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: "6px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: chatFontSize <= 0.65 ? "not-allowed" : "pointer", opacity: chatFontSize <= 0.65 ? 0.35 : 1, fontSize: "0.72rem", fontWeight: "bold", color: "#64748b", transition: "all 0.15s" }}
              onMouseEnter={e => { if (chatFontSize > 0.65) { e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; e.currentTarget.style.color = "#c4b5fd"; } showTooltip(tipBox(MECHANIC_TIPS.FONT_SIZE.title, MECHANIC_TIPS.FONT_SIZE.body, "#64748b"), e); }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "#64748b"; hideTooltip(); }}
            >A−</button>
            <button
              onClick={() => { const v = Math.min(1.35, parseFloat((chatFontSize + 0.05).toFixed(2))); setChatFontSize(v); localStorage.setItem("dnd_chat_font_size", String(v)); }}
              disabled={chatFontSize >= 1.35}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: "6px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: chatFontSize >= 1.35 ? "not-allowed" : "pointer", opacity: chatFontSize >= 1.35 ? 0.35 : 1, fontSize: "1rem", fontWeight: "bold", color: "#64748b", transition: "all 0.15s" }}
              onMouseEnter={e => { if (chatFontSize < 1.35) { e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; e.currentTarget.style.color = "#c4b5fd"; } showTooltip(tipBox(MECHANIC_TIPS.FONT_SIZE.title, MECHANIC_TIPS.FONT_SIZE.body, "#64748b"), e); }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "#64748b"; hideTooltip(); }}
            >A+</button>
          </div>
          {/* Narrator mute button — shown only when narration is on */}
          {narrationEnabled && (
            <button
              onClick={() => setNarMuted(m => !m)}
              title={narMuted ? "Unmute narrator" : "Mute narrator"}
              style={{ background: narMuted ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${narMuted ? "rgba(239,68,68,0.4)" : "var(--border)"}`, borderRadius: "8px", width: "36px", height: "36px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", color: narMuted ? "#f87171" : "#94a3b8", flexShrink: 0, transition: "all 0.2s" }}
            >
              {narMuted ? "🔇" : "🔈"}
            </button>
          )}
          {/* Voice/narration picker */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => { if (!narrationEnabled) { setNarrationEnabled(true); setVoicePickerOpen(true); } else { setVoicePickerOpen(v => !v); } }}
              title={narrationEnabled ? "Change DM voice" : "Enable AI narration"}
              style={{ background: narrationEnabled ? "rgba(139,92,246,0.2)" : "transparent", border: `1px solid ${narrationEnabled ? "rgba(139,92,246,0.5)" : "var(--border)"}`, borderRadius: "8px", padding: "7px 13px", minHeight: "36px", cursor: "pointer", fontSize: "1rem", lineHeight: 1, display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s", color: narrationEnabled ? "#c4b5fd" : "#94a3b8" }}>
              {narrating ? <span style={{ animation: "blink 0.8s step-end infinite" }}>🔊</span> : narrationEnabled ? "🔊" : "🔇"}
              {narrationEnabled && chatPaneWidth > 310 && <span style={{ fontSize: "0.78rem", whiteSpace: "nowrap", fontWeight: 600 }}>{VOICES.find(v => v.id === selectedVoice)?.label ?? "Voice"} ▾</span>}
            </button>
            {voicePickerOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 9999, background: "rgba(10,7,24,0.97)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: "10px", padding: "6px", minWidth: "210px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                {VOICES.map(v => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "4px", borderRadius: "7px", background: selectedVoice === v.id ? "rgba(139,92,246,0.25)" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (selectedVoice !== v.id) (e.currentTarget as HTMLDivElement).style.background = "rgba(139,92,246,0.12)"; }}
                    onMouseLeave={e => { if (selectedVoice !== v.id) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                    {/* Select this voice */}
                    <button onClick={() => {
                      // Flush the narration queue before switching voices.
                      // Without this, in-flight TTS fetches orphan their slots and
                      // audioPlayingRef can get stuck true (browser paused audio on
                      // the dropdown click, so onended never fires), silently
                      // breaking all future narration.
                      if (narAudioRef.current) { narAudioRef.current.pause(); narAudioRef.current.src = ""; }
                      narGenerationRef.current++; narSlotCounterRef.current = 0; narSlotsRef.current = []; narSlotTextsRef.current = []; narSlotRetriedRef.current = []; narPlaySlotRef.current = 0;
                      narSlot0TextRef.current = null;
                      audioPlayingRef.current = false;
                      setNarrating(false);
                      setNarRevealText(null);
                      setNarRevealIntervalMs(null);
                      setNarRevealPaused(true);
                      setSelectedVoice(v.id);
                      setVoicePickerOpen(false);
                      // Stop any preview playing
                      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current.src = ""; }
                      setTestingVoice(null);
                    }}
                      style={{ flex: 1, textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: "bold", color: selectedVoice === v.id ? "#c4b5fd" : "white" }}>{v.label}</div>
                      <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "1px" }}>{v.desc}</div>
                    </button>
                    {/* Preview button — locked while narration is playing */}
                    <button
                      disabled={narrating}
                      onClick={e => { e.stopPropagation(); testVoice(v.id); }}
                      title={narrating ? "Narration in progress" : "Preview voice"}
                      style={{ flexShrink: 0, width: "28px", height: "28px", marginRight: "6px", borderRadius: "6px", border: "1px solid rgba(139,92,246,0.3)", background: testingVoice === v.id ? "rgba(139,92,246,0.35)" : "rgba(139,92,246,0.1)", cursor: narrating ? "not-allowed" : testingVoice === v.id ? "default" : "pointer", fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", color: narrating ? "#4b3f6b" : "#c4b5fd", opacity: narrating ? 0.45 : 1, transition: "background 0.15s, opacity 0.15s, color 0.15s" }}
                      onMouseEnter={e => { if (!narrating && testingVoice !== v.id) e.currentTarget.style.background = "rgba(139,92,246,0.25)"; }}
                      onMouseLeave={e => { if (!narrating && testingVoice !== v.id) e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}>
                      {testingVoice === v.id ? <span style={{ animation: "blink 0.8s step-end infinite" }}>♪</span> : "▶"}
                    </button>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "4px", padding: "8px 10px 4px" }}>
                  {/* Narrator volume slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <button
                      onClick={() => setNarMuted(m => !m)}
                      title={narMuted ? "Unmute narrator" : "Mute narrator"}
                      style={{ flexShrink: 0, width: "22px", fontSize: "0.85rem", background: "none", border: "none", cursor: "pointer", color: narMuted ? "#f87171" : "#94a3b8", padding: 0, lineHeight: 1 }}
                    >
                      {narMuted ? "🔇" : narVolume < 0.4 ? "🔈" : "🔊"}
                    </button>
                    <input
                      type="range" min={0} max={1} step={0.02}
                      value={narMuted ? 0 : narVolume}
                      onChange={e => { const v = parseFloat(e.target.value); if (narMuted && v > 0) setNarMuted(false); setNarVolume(v === 0 ? narVolume : v); if (v === 0) setNarMuted(true); }}
                      style={{ flex: 1, accentColor: "#8b5cf6", cursor: "pointer", height: "4px" }}
                    />
                    <span style={{ fontSize: "0.65rem", color: "#64748b", minWidth: "28px", textAlign: "right" }}>
                      {narMuted ? "Off" : `${Math.round(narVolume * 100)}%`}
                    </span>
                  </div>
                  <button onClick={() => { if (narAudioRef.current) { narAudioRef.current.pause(); narAudioRef.current.src = ""; } audioPlayingRef.current = false; setNarrating(false); setNarrationEnabled(false); setVoicePickerOpen(false); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: "7px", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.75rem", color: "#64748b", transition: "color 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; }}>
                    Turn off narration
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Turn indicator / roll request banner */}
        {(turnOrder.length > 1 || rollRequestedUserId) && (
          <div style={{ padding: "7px 16px", background: rollRequestedUserId ? "rgba(251,191,36,0.08)" : "rgba(139,92,246,0.08)", borderBottom: `1px solid ${rollRequestedUserId ? "rgba(251,191,36,0.25)" : "rgba(139,92,246,0.15)"}`, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px" }}>
            {isTyping ? (
              <span style={{ color: "#8b5cf6" }}>⏳ DM is responding…</span>
            ) : rollRequestedUserId ? (
              <>
                <span style={{ animation: "blink 1s step-end infinite", display:"inline-flex",alignItems:"center" }}><D20Icon size={16} color="#fbbf24"/></span>
                <span style={{ color: isMyTurn ? "#fbbf24" : "#94a3b8", fontWeight: "bold" }}>
                  {isMyTurn ? "Your roll!" : `${campaignParty.find(c => c.user_id === rollRequestedUserId)?.name ?? "A player"} is rolling…`}
                </span>
              </>
            ) : (
              <>
                <span style={{ color: "#475569" }}>Turn {currentTurnIndex + 1} of {turnOrder.length}:</span>
                <span style={{ color: isMyTurn ? "#c4b5fd" : "white", fontWeight: "bold" }}>
                  {isMyTurn ? "Your turn" : `${campaignParty.find(c => c.id === currentTurnPlayerId)?.name ?? "Waiting"}…`}
                </span>
              </>
            )}
          </div>
        )}

        {/* ── Combat enemy strip ── */}
        {combatActive && enemies.some(e => !e.is_defeated) && (
          <div className="animate-fade-in" style={{ borderBottom: "1px solid rgba(239,68,68,0.2)", background: "rgba(30,0,0,0.55)", padding: "10px 14px 12px" }}>
            <div style={{ fontSize: "0.62rem", color: "rgba(239,68,68,0.7)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "8px", fontWeight: "bold" }}>
              ⚔ {enemies.filter(e => !e.is_defeated).length} {enemies.filter(e => !e.is_defeated).length === 1 ? "Enemy" : "Enemies"} — click to target
            </div>
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "2px" }}>
              {enemies.map(e => {
                const isTargeted = !e.is_defeated && targetedEnemyId === e.id;
                const cond       = e.condition ?? "healthy";
                const condColor  = CONDITION_COLORS[cond];
                const condPct    = CONDITION_PCT[cond];
                return (
                  <div
                    key={e.id}
                    onClick={() => { if (!e.is_defeated) setTargetedEnemyId(prev => prev === e.id ? null : e.id); }}
                    onMouseEnter={ev => { const condLabel = e.is_defeated ? "Defeated" : CONDITION_LABELS[cond]; const condDesc = ENEMY_CONDITION_TIPS[condLabel]; showTooltip(tipBox(e.name, `${condLabel}${condDesc ? ' — ' + condDesc : ''}\n${e.enemy_type} · CR ${e.cr} · AC ${e.ac}`, condColor), ev); }}
                    onMouseLeave={hideTooltip}
                    style={{
                      flexShrink: 0, width: "clamp(72px, 5.5rem, 104px)",
                      background: e.is_defeated ? "rgba(0,0,0,0.2)" : isTargeted ? "rgba(120,0,0,0.7)" : "rgba(60,0,0,0.55)",
                      border: `1.5px solid ${e.is_defeated ? "rgba(255,255,255,0.05)" : isTargeted ? "rgba(239,68,68,0.9)" : "rgba(239,68,68,0.3)"}`,
                      borderRadius: "10px", padding: "8px 8px 7px",
                      cursor: e.is_defeated ? "default" : "pointer",
                      opacity: e.is_defeated ? 0.4 : 1,
                      transition: "all 0.3s ease",
                      animation: isTargeted ? "targetedEnemy 1.6s ease-in-out infinite" : "none",
                      position: "relative",
                    }}
                  >
                    {/* Portrait */}
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: "7px", overflow: "hidden", marginBottom: "6px", background: "rgba(0,0,0,0.5)", border: `1.5px solid ${isTargeted ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.06)"}`, position: "relative" }}>
                      {e.portrait_url ? (
                        <img src={e.portrait_url} alt={e.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: e.is_defeated ? "grayscale(1)" : "none" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
                          {e.portrait_emoji}
                        </div>
                      )}
                      {/* Generating indicator */}
                      {!e.portrait_url && !e.is_defeated && (
                        <div style={{ position: "absolute", bottom: "3px", right: "3px", width: "6px", height: "6px", borderRadius: "50%", background: "#8b5cf6", animation: "blink 1s step-end infinite" }} />
                      )}
                    </div>
                    {/* Name */}
                    <div style={{ fontSize: "0.62rem", fontWeight: "bold", color: e.is_defeated ? "#6b7280" : isTargeted ? "#fca5a5" : "#fecaca", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "5px", textDecoration: e.is_defeated ? "line-through" : "none" }}>
                      {e.name}
                    </div>
                    {/* Condition bar */}
                    {!e.is_defeated && (
                      <div style={{ width: "100%", height: "3px", background: "#1f2937", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ width: `${condPct}%`, height: "100%", background: condColor, transition: "width 0.5s ease, background 0.4s ease" }} />
                      </div>
                    )}
                    {/* Target badge */}
                    {isTargeted && (
                      <div style={{ position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)", fontSize: "0.5rem", background: "#ef4444", color: "white", borderRadius: "3px", padding: "1px 5px", fontWeight: "bold", letterSpacing: "0.04em", whiteSpace: "nowrap", cursor: "help" }}
                        onMouseEnter={ev => showTooltip(tipBox(MECHANIC_TIPS.TARGET_ENEMY.title, MECHANIC_TIPS.TARGET_ENEMY.body, "#ef4444"), ev)}
                        onMouseLeave={hideTooltip}>
                        ⚔ TARGET
                      </div>
                    )}
                    {e.is_defeated && (
                      <div style={{ textAlign: "center", fontSize: "0.52rem", color: "#6b7280", fontWeight: "bold" }}>DEFEATED</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages — the bottom padding scales up when the Suggested Actions panel is
            present so the last narration line is never visually flush with (or covered by)
            the suggestions. Reduced back to 8px when there's no suggestion panel below.
            Wrapped in a relative container so the manual scroll buttons can float in the
            bottom-right corner of the narration window without affecting the flex layout. */}
        <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div ref={msgContainerRef} data-msg-scroll style={{ flex: 1, overflowY: "auto", padding: `0 16px ${suggestions.length > 0 ? 64 : 8}px`, display: "flex", flexDirection: "column", gap: "14px" }}>
          {(narRevealText && messages.length > 0 && messages[messages.length - 1].role === "dm"
            ? messages.slice(0, -1)
            : messages
          ).map((msg, idx) => (
            <div key={idx} className="animate-fade-in" style={{ alignSelf: msg.role === "player" ? "flex-end" : "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", alignItems: msg.role === "player" ? "flex-end" : "flex-start" }}>
              {msg.role === "player" && <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "3px" }}>{msg.sender ?? "You"}</span>}
              {msg.role === "dm"     && <span style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "3px", fontWeight: "bold" }}>Dungeon Master</span>}
              <div style={{ padding: "11px 15px", borderRadius: "12px", fontSize: chatMsgSize, lineHeight: 1.55, whiteSpace: "pre-wrap",
                background: msg.role === "dm" ? "rgba(139,92,246,0.15)" : msg.role === "system" ? "transparent" : "var(--card-bg)",
                border:     msg.role === "dm" ? "1px solid rgba(139,92,246,0.3)" : msg.role === "system" ? "none" : "1px solid var(--border)",
                fontStyle:  msg.role === "system" ? "italic" : "normal",
                color:      msg.role === "system" ? "#94a3b8" : "white",
                textAlign:  msg.role === "system" ? "center" : "left",
              }}>
                {msg.role === "dm" ? <ColorizedText text={stripSystemLeaks(msg.content)} playerColors={playerColorMap} knownItems={knownItemsForNarrative} onShowTooltip={showTooltip} onHideTooltip={hideTooltip} /> : msg.content}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Story illustration"
                    style={{
                      display: "block", width: "100%", maxWidth: "340px", marginTop: "12px",
                      borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.55)",
                      border: "1px solid rgba(139,92,246,0.35)",
                      animation: "fadeIn 0.8s ease",
                    }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Party change — waiting for DM debounce to fire */}
          {partyChangePending && !isTyping && !streamingContent && (
            <div className="animate-fade-in" style={{ alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "14px 20px", borderRadius: "12px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", marginTop: "4px" }}>
              <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--primary)", opacity: 0.7, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
              <span style={{ fontSize: "0.75rem", color: "#8b5cf6", letterSpacing: "0.04em" }}>The DM is preparing their response…</span>
            </div>
          )}

          {/* Opening narration reveal — slow character-by-character after loading screen */}
          {openingRevealText && (
            <div className="animate-fade-in" style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "3px", fontWeight: "bold" }}>Dungeon Master</span>
              <div style={{ padding: "11px 15px", borderRadius: "12px", fontSize: chatMsgSize, lineHeight: 1.55, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                <RevealText
                  text={stripSystemLeaks(openingRevealText)}
                  onComplete={() => {
                    const content = openingRevealText;
                    setOpeningRevealText(null);
                    setMessages(prev => [...prev, { role: "dm" as const, content }]);
                  }}
                />
              </div>
            </div>
          )}

          {/* Narration-synced reveal — only shown once audio interval is known (narrator is speaking) */}
          {narRevealText && narRevealIntervalMs !== null && (
            <div className="animate-fade-in" style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "3px", fontWeight: "bold" }}>Dungeon Master</span>
              <div style={{ padding: "11px 15px", borderRadius: "12px", fontSize: chatMsgSize, lineHeight: 1.55, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                <RevealText
                  text={stripSystemLeaks(narRevealText)}
                  intervalMs={narRevealIntervalMs}
                  isPaused={narRevealPaused}
                  getAudioProgress={getNarrationProgress}
                  onComplete={() => {
                    setNarRevealText(null);
                    setNarRevealIntervalMs(null);
                    setNarRevealPaused(true);
                    // Message already committed to messages state in sendToAI — no re-add needed
                  }}
                />
              </div>
            </div>
          )}

          {/* Streaming / audio-loading placeholder — visible until narration reveal takes over */}
          {(isTyping || streamingContent || (narRevealText && narRevealIntervalMs === null)) && narRevealIntervalMs === null && (
            <div className="animate-fade-in" style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "3px", fontWeight: "bold" }}>Dungeon Master</span>
              <div style={{ padding: "11px 15px", borderRadius: "12px", fontSize: chatMsgSize, lineHeight: 1.55, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", whiteSpace: "pre-wrap", minWidth: "80px" }}>
                {streamingContent && !narrationEnabled
                  ? <><StreamingText text={stripSystemLeaks(streamingContent)} /><span style={{ display: "inline-block", width: "2px", height: "1em", background: "var(--primary)", marginLeft: "2px", verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} /></>
                  : narRevealText
                    ? <span className="animate-float" style={{ color: "var(--primary)", fontSize: "0.85rem" }}>Narrator is speaking…</span>
                    : <span className="animate-float" style={{ color: "var(--primary)", fontSize: "0.85rem" }}>The DM is thinking...</span>
                }
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
          {/* Manual scroll buttons — float over the bottom-right of the narration window */}
          <div style={{ position: "absolute", right: "12px", bottom: "14px", display: "flex", flexDirection: "column", gap: "8px", zIndex: 6 }}>
            {[{ dir: -1 as const, glyph: "▲", tip: ["Scroll Up", "Scroll the story window up to re-read earlier narration."] },
              { dir: 1 as const,  glyph: "▼", tip: ["Scroll Down", "Scroll the story window down toward the latest narration."] }].map(b => (
              <button
                key={b.glyph}
                onClick={() => scrollNarration(b.dir)}
                onMouseDown={e => e.preventDefault()}
                aria-label={b.tip[0]}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.35)"; e.currentTarget.style.color = "white"; showTooltip(tipBox(b.tip[0], b.tip[1]), e); }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(20,18,30,0.78)"; e.currentTarget.style.color = "#c4b5fd"; hideTooltip(); }}
                style={{ width: "34px", height: "34px", borderRadius: "50%", background: "rgba(20,18,30,0.78)", border: "1px solid rgba(139,92,246,0.4)", color: "#c4b5fd", fontSize: "0.8rem", lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", boxShadow: "0 2px 8px rgba(0,0,0,0.4)", transition: "background 0.15s ease, color 0.15s ease" }}
              >{b.glyph}</button>
            ))}
          </div>
        </div>

        {/* Suggested actions — hidden while a dice roll is pending or active.
            The list collapses to a single header bar when the player wants
            more narration-reading real estate. State persists across reloads. */}
        {suggestions.length > 0 && !dmBusy && isMyTurn && !showDice && !pendingDiceShow && (
          <div style={{ padding: suggestionsCollapsed ? "6px 16px" : "10px 16px", borderTop: "1px solid rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.04)", transition: "padding 0.18s ease" }}>
            <button
              onClick={toggleSuggestionsCollapsed}
              title={suggestionsCollapsed ? "Show suggested actions" : "Hide suggested actions to read more narration"}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "none", border: "none", padding: "0", margin: suggestionsCollapsed ? "0" : "0 0 8px 0",
                color: "#475569", cursor: "pointer", textAlign: "left",
                fontSize: `${(chatFontSize * 0.72).toFixed(2)}rem`,
                textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#94a3b8"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#475569"; }}
            >
              <span>
                Suggested actions
                {suggestionsCollapsed && (
                  <span style={{ marginLeft: "8px", color: "#6d5a9c", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
                    ({suggestions.length} hidden)
                  </span>
                )}
              </span>
              <span style={{ fontSize: `${(chatFontSize * 0.85).toFixed(2)}rem`, lineHeight: 1, transform: suggestionsCollapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.18s ease", display: "inline-block" }}>
                ▾
              </span>
            </button>
            {!suggestionsCollapsed && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => handleSend(s)} disabled={narrating}
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: "8px", fontSize: `${(chatFontSize * 0.91).toFixed(2)}rem`, border: "1px solid rgba(139,92,246,0.25)", background: "rgba(139,92,246,0.06)", color: "#cbd5e1", cursor: narrating ? "not-allowed" : "pointer", opacity: narrating ? 0.5 : 1, transition: "all 0.15s", lineHeight: 1.4 }}
                    onMouseEnter={e => { if (!narrating) { e.currentTarget.style.background = "rgba(139,92,246,0.18)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)"; e.currentTarget.style.color = "white"; } }}
                    onMouseLeave={e => { if (!narrating) { e.currentTarget.style.background = "rgba(139,92,246,0.06)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)"; e.currentTarget.style.color = "#cbd5e1"; } }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* First-time chat hint */}
        {showChatHint && (
          <div ref={chatHintRef} className="chat-hint-glow" style={{ padding: "11px 14px", borderTop: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.07)", display: "flex", alignItems: "center", gap: "12px", position: "relative" }}>
            <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>💬</span>
            <p style={{ fontSize: "0.75rem", color: "#a78bfa", lineHeight: 1.55, flex: 1, margin: 0 }}>
              <strong>Type what your character says or does</strong> — the AI Dungeon Master responds instantly.
              Use the <span style={{ display: "inline-flex", verticalAlign: "middle", margin: "0 2px" }}><D20Icon size={16} color="#c4b5fd"/></span> button to roll dice when asked, or explore the sidebar tabs for your sheet, party, and combat.
            </p>
            <button
              onClick={() => { setShowChatHint(false); sessionStorage.setItem(`chatHint_${params.id}`, "1"); }}
              className="btn-dismiss"
              title="Dismiss"
            >
              <span className="btn-dismiss-check">✓</span> Got it
            </button>
          </div>
        )}

        {/* Input bar */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--border)", background: "var(--card-bg)", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            {(() => {
              const dmCallingForRoll = (pendingDiceShow || rollRequestedUserId === userId) && isMyTurn;
              const diceDisabled    = isTyping || narrating || !isMyTurn || !dmCallingForRoll;
              const diceTitle       = !isMyTurn ? "Wait for your turn"
                                    : isTyping || narrating ? "DM is responding"
                                    : !dmCallingForRoll ? "🔒 Dice unlock when the DM calls for a roll"
                                    : "Roll Dice";
              return (
            <button
              className="btn-secondary"
              onClick={() => setShowDice(true)}
              disabled={diceDisabled}
              title={diceTitle}
              style={{
                padding: "14px 18px", fontSize: "1.4rem", flexShrink: 0,
                ...(!showDice && dmCallingForRoll && {
                  border: "1.5px solid rgba(251,191,36,0.8)",
                  boxShadow: "0 0 16px rgba(251,191,36,0.5), 0 0 32px rgba(251,191,36,0.2)",
                  animation: "dicePulse 0.8s ease-in-out infinite alternate",
                  color: "#fbbf24",
                }),
              }}
            ><D20Icon size={22} color={!showDice && dmCallingForRoll ? "#fbbf24" : "currentColor"}/></button>
              );
            })()}
            <input
              type="text" value={input}
              data-chat-input
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={isTyping || narrating || !isMyTurn || showDice || pendingDiceShow}
              placeholder={
                isTyping        ? "The DM is responding…"
                : narrating     ? "Narrating…"
                : showDice || pendingDiceShow ? "Roll the dice above…"
                : !isMyTurn && rollRequestedUserId ? `Waiting for ${campaignParty.find(c => c.user_id === rollRequestedUserId)?.name ?? "a player"} to roll…`
                : !isMyTurn     ? `Waiting for ${campaignParty.find(c => c.id === currentTurnPlayerId)?.name ?? "other players"}…`
                : "Describe your action…"
              }
              style={{
                flex: 1, minWidth: 0, background: "rgba(0,0,0,0.5)", borderRadius: "8px", color: "white",
                padding: "14px 18px", fontSize: "1.25rem",
                opacity: (isTyping || narrating || !isMyTurn || showDice || pendingDiceShow) ? 0.6 : 1,
                border: (isMyTurn && !isTyping && !narrating && !showDice && !pendingDiceShow)
                  ? "1.5px solid rgba(139,92,246,0.7)"
                  : "1px solid var(--border)",
                boxShadow: (isMyTurn && !isTyping && !narrating && !showDice && !pendingDiceShow)
                  ? "0 0 14px rgba(139,92,246,0.4), 0 0 28px rgba(139,92,246,0.15), inset 0 0 8px rgba(139,92,246,0.06)"
                  : "none",
                transition: "border-color 0.3s, box-shadow 0.3s",
              }}
            />
            <button className="btn-primary" onClick={() => handleSend()} disabled={isTyping || narrating || !isMyTurn || !input.trim() || showDice || pendingDiceShow} style={{ flexShrink: 0, padding: "14px 28px", fontSize: "1.1rem" }}>Send</button>
          </div>
        </div>
      </div>

      {/* ── Drag handle: Chat | Sidebar ── */}
      <div
        title="Drag to resize"
        style={{ width: "10px", flexShrink: 0, cursor: "col-resize", background: "var(--border)", transition: "background 0.15s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px" }}
        onMouseDown={e => { e.preventDefault(); dragRef.current = { which: "sidebar", startX: e.clientX, startW: sidebarPaneWidth }; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.55)"; }}
        onMouseLeave={e => { if (!dragRef.current) e.currentTarget.style.background = "var(--border)"; }}
      >
        {[0,1,2,3,4].map(i => <span key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: "rgba(255,255,255,0.18)", pointerEvents: "none" }} />)}
      </div>

      {/* ── Pane 3: Sidebar ── */}
      <div style={{ width: sidebarPaneWidth, flex: "0 0 auto", background: "var(--card-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Tab toggle */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {(["party", "sheet", "log"] as const).map(tab => {
            const TAB_META = {
              party:  { label: "Party",     sub: "Everyone",          tip: "View all party members — HP, gold, XP, spell slots, and active status effects." },
              sheet:  { label: "Character", sub: "Stats & Inventory", tip: "Your character's ability scores, spell slots, spellbook, inventory, and currency." },
              log:    { label: "Story Log", sub: "Full Transcript",   tip: "The complete transcript of this session — every DM narration and player action." },
            };
            const { label, sub, tip } = TAB_META[tab];
            return (
              <button key={tab} onClick={() => setSidebarTab(tab)}
                onMouseEnter={e => showTooltip(tipBox(label, tip, "#8b5cf6"), e)}
                onMouseLeave={hideTooltip}
                style={{ flex: 1, padding: "10px 4px 8px", fontSize: fs(0.65), fontWeight: "bold",
                  background: sidebarTab === tab ? "rgba(139,92,246,0.15)" : "transparent",
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  borderBottom: sidebarTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
                  color: sidebarTab === tab ? "var(--primary)" : "#64748b",
                  cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", transition: "all 0.15s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <span>{label}</span>
                <span style={{ fontSize: fs(0.55), fontWeight: 400, letterSpacing: "0.03em", textTransform: "none", color: sidebarTab === tab ? "rgba(139,92,246,0.75)" : "#3f3f46", lineHeight: 1 }}>{sub}</span>
              </button>
            );
          })}
          {enemies.length > 0 && (
            <button onClick={() => setSidebarTab("combat")}
              style={{ flex: 1, padding: "12px 4px", fontSize: fs(0.68), fontWeight: "bold", position: "relative",
                background: sidebarTab === "combat" ? "rgba(239,68,68,0.15)" : "transparent",
                borderTop: "none", borderLeft: "none", borderRight: "none",
                borderBottom: sidebarTab === "combat" ? "2px solid #ef4444" : "2px solid transparent",
                color: sidebarTab === "combat" ? "#ef4444" : "#64748b",
                cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", transition: "all 0.15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <span>⚔ Combat</span>
              <span style={{ fontSize: fs(0.55), fontWeight: 400, letterSpacing: "0.03em", textTransform: "none", color: sidebarTab === "combat" ? "rgba(239,68,68,0.75)" : "#3f3f46", lineHeight: 1 }}>Click enemies to target</span>
              {combatActive && enemies.some(e => !e.is_defeated) && (
                <span style={{ position: "absolute", top: "6px", right: "4px", width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", animation: "blink 1s step-end infinite" }} />
              )}
            </button>
          )}
        </div>

        {/* Dim sidebar while DM is busy; only block pointer events while actively typing (not narrating, so tooltips still work) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", pointerEvents: isTyping ? "none" : "auto", opacity: dmBusy ? 0.5 : 1, transition: "opacity 0.2s" }}>

        {/* ── Party tab ── */}
        {sidebarTab === "party" && (() => {
          // ── Rest gating per D&D 5e rules ─────────────────────────────────────
          // Cannot rest during combat (enemies present and not yet defeated), while
          // the DM is mid-response, or while a dice roll is pending. These are the
          // legitimate "safe enough to recover" conditions.
          const restInCombat   = combatActive && enemies.some(e => !e.is_defeated);
          const restDmBusy     = isTyping || narrating;
          const restRollPending = !!rollRequestedUserId;
          const restDisabled   = restInCombat || restDmBusy || restRollPending;
          const restDisabledReason = restInCombat   ? "Cannot rest during combat — defeat or flee the enemies first."
                                   : restRollPending ? "Cannot rest while a dice roll is pending."
                                   : restDmBusy      ? "Cannot rest while the DM is narrating."
                                   : null;
          const shortRestTip = restDisabledReason
            ? { title: "Short Rest — Unavailable", body: restDisabledReason }
            : MECHANIC_TIPS.SHORT_REST;
          const longRestTip = restDisabledReason
            ? { title: "Long Rest — Unavailable", body: restDisabledReason }
            : MECHANIC_TIPS.LONG_REST;
          return (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Party ({campaignParty.length})
              </h3>
            </div>

            {/* Party-wide rest buttons — gated by D&D rules (no combat, no pending roll/narration) */}
            <div style={{ display: "flex", gap: "7px", marginBottom: "14px", paddingBottom: "14px", borderBottom: "1px solid var(--border)" }}>
              <button
                onClick={restDisabled ? undefined : handlePartyShortRest}
                disabled={restDisabled}
                style={{
                  flex: 1, padding: "8px", borderRadius: "7px", fontSize: "0.75rem", fontWeight: "bold",
                  border: `1px solid ${restDisabled ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.4)"}`,
                  background: restDisabled ? "rgba(245,158,11,0.04)" : "rgba(245,158,11,0.1)",
                  color: restDisabled ? "rgba(245,158,11,0.45)" : "#f59e0b",
                  cursor: restDisabled ? "not-allowed" : "pointer",
                  opacity: restDisabled ? 0.65 : 1,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  if (!restDisabled) e.currentTarget.style.background = "rgba(245,158,11,0.22)";
                  showTooltip(tipBox(shortRestTip.title, shortRestTip.body, "#f59e0b"), e);
                }}
                onMouseLeave={e => {
                  if (!restDisabled) e.currentTarget.style.background = "rgba(245,158,11,0.1)";
                  hideTooltip();
                }}
              >
                🌙 Short Rest
              </button>
              <button
                onClick={restDisabled ? undefined : handlePartyLongRest}
                disabled={restDisabled}
                style={{
                  flex: 1, padding: "8px", borderRadius: "7px", fontSize: "0.75rem", fontWeight: "bold",
                  border: `1px solid ${restDisabled ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.4)"}`,
                  background: restDisabled ? "rgba(99,102,241,0.04)" : "rgba(99,102,241,0.1)",
                  color: restDisabled ? "rgba(129,140,248,0.45)" : "#818cf8",
                  cursor: restDisabled ? "not-allowed" : "pointer",
                  opacity: restDisabled ? 0.65 : 1,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  if (!restDisabled) e.currentTarget.style.background = "rgba(99,102,241,0.22)";
                  showTooltip(tipBox(longRestTip.title, longRestTip.body, "#818cf8"), e);
                }}
                onMouseLeave={e => {
                  if (!restDisabled) e.currentTarget.style.background = "rgba(99,102,241,0.1)";
                  hideTooltip();
                }}
              >
                ☀️ Long Rest
              </button>
            </div>

            {/* Turn-skip banner */}
            {turnSkipBanner && (
              <div style={{ padding: "8px 12px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: "8px", marginBottom: "6px", fontSize: fs(0.75), color: "#c4b5fd", textAlign: "center", animation: "fadeIn 0.3s ease" }}>
                ⏭ {turnSkipBanner}
              </div>
            )}

            {/* Player cards — campaign party (always visible) or presence fallback */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: droppedItems.length > 0 ? "20px" : 0 }}>
              {campaignParty.map((char, idx) => {
                // `isActive` (which drives the "Acting" pill) follows the real turn order
                // now — NOT the clicked-card index. Clicking a card only opens that
                // character's sheet for viewing; it never makes them the active player.
                const isDiceTarget  = diceRollTarget === char.name;
                const isCurrentTurn = turnOrder.length > 1 && char.id === currentTurnPlayerId;
                const isActive      = isCurrentTurn;
                const cardInv      = char.inventory ?? { gold: 0, items: [], weapons: [] };
                const cardIb       = computeInventoryBonuses(cardInv.items, cardInv.weapons);
                const cardMaxHp    = char.max_hp + cardIb.hpMaxAdd;
                const tempHp       = char.class_resources?.temp_hp ?? 0;
                const pct          = Math.max(0, Math.min(100, (char.hp / Math.max(1, cardMaxHp)) * 100));
                const color        = pct > 60 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
                const classEmoji   = CLASS_EMOJI[char.class] ?? "⚔️";
                // While Wild Shaped, the status_effects array carries an entry
                // like "Wild Shape: Bear" — the form emoji becomes the portrait
                // and overrides the class glyph (and the photo portrait too).
                const wildShapeStatus = (char.status_effects ?? []).find(s => /^Wild Shape:/i.test(s));
                const wildShapeFormName = wildShapeStatus ? wildShapeStatus.replace(/^Wild Shape:\s*/i, "").trim() : null;
                const wildShapeResolved = wildShapeFormName ? resolveWildShapeForm(wildShapeFormName) : null;
                const wildShapeEmoji    = wildShapeResolved?.form.emoji ?? (wildShapeFormName ? FALLBACK_BEAST_EMOJI : null);
                const dominantEff  = getDominantEffect(char.status_effects ?? []);
                const effectGlow   = getCardEffectGlow(char.status_effects ?? []);
                const classHex     = CLASS_COLORS[char.class] ?? "#8b5cf6";
                const classRgb     = hexToRgb(classHex);
                const borderColor  = isDiceTarget ? "rgba(251,191,36,0.9)" : isCurrentTurn ? `rgba(${classRgb},0.9)` : dominantEff ? dominantEff.badgeColor : "var(--border)";
                const bgColor      = isDiceTarget ? "rgba(251,191,36,0.08)" : isCurrentTurn ? `rgba(${classRgb},0.16)` : "rgba(0,0,0,0.3)";
                const cardAnim     = isDiceTarget ? "diceCardRise 1.4s ease-in-out infinite" : isCurrentTurn ? "activePlayerRise 2s ease-in-out infinite" : "none";
                const cardShadow   = isDiceTarget || isCurrentTurn ? undefined : (effectGlow ?? undefined);
                const isTurnEnding = turnEndCardId === char.id;
                return (
                  <div key={char.id}
                    className={isTurnEnding ? "card-turn-end" : undefined}
                    onClick={() => { if (campaignParty.length > 1) { setActiveCharIdx(idx); setSidebarTab("sheet"); } }}
                    style={{ "--card-rgb": classRgb, position: "relative", padding: "14px 16px", background: bgColor, borderRadius: "10px", border: `2px solid ${borderColor}`, boxShadow: cardShadow, animation: isTurnEnding ? undefined : cardAnim, order: isDiceTarget ? -2 : (isCurrentTurn || isTurnEnding) ? -1 : 0, zIndex: isTurnEnding ? 3 : undefined, transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease", cursor: campaignParty.length > 1 ? "pointer" : "default" } as React.CSSProperties}>
                    {/* Party leader crown — top-left corner badge */}
                    {char.id === partyLeaderId && (
                      <span
                        style={{ position: "absolute", top: "-10px", left: "-6px", fontSize: fs(1.1), animation: "crownPulse 2.4s ease-in-out infinite", display: "inline-block", cursor: "help", zIndex: 2, filter: "drop-shadow(0 1px 4px rgba(251,191,36,0.7))" }}
                        onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.PARTY_LEADER.title, MECHANIC_TIPS.PARTY_LEADER.body, "#f59e0b"), e)}
                        onMouseLeave={hideTooltip}>👑</span>
                    )}
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div
                          onClick={char.portrait_url ? e => { e.stopPropagation(); setPortraitModal({ name: char.name, cls: char.class, url: char.portrait_url!, subtitle: `${char.race} ${char.class} · Level ${char.level}` }); } : undefined}
                          style={{ position: "relative", width: fs(3.2), height: fs(3.2), borderRadius: "50%", overflow: "hidden", border: `2px solid ${isDiceTarget ? "rgba(251,191,36,0.9)" : isCurrentTurn ? `rgba(${classRgb},0.7)` : "var(--border)"}`, background: "rgba(0,0,0,0.4)", animation: isDiceTarget ? "diceTargetGlow 1.2s ease-in-out infinite" : "none", cursor: char.portrait_url ? "zoom-in" : "default" }}>
                          {wildShapeEmoji ? (
                            wildShapeResolved ? (
                              <img
                                src={wildShapeImagePath(wildShapeResolved.key)}
                                alt={`Wild Shape: ${wildShapeFormName}`}
                                title={`Wild Shaped: ${wildShapeFormName}`}
                                onError={e => {
                                  // Image not pre-generated — fall back to the beast emoji
                                  const img = e.currentTarget;
                                  img.style.display = "none";
                                  const fb = img.nextElementSibling as HTMLElement | null;
                                  if (fb) fb.style.display = "flex";
                                }}
                                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                              />
                            ) : null
                          ) : char.portrait_url ? (
                            <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(1.1) }}>{classEmoji}</div>
                          )}
                          {wildShapeEmoji && (
                            <div
                              style={{ display: wildShapeResolved ? "none" : "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: fs(1.55), background: "rgba(34,197,94,0.18)" }}
                              title={`Wild Shaped: ${wildShapeFormName}`}
                            >
                              {wildShapeEmoji}
                            </div>
                          )}
                          {abilityFlash && abilityFlash.charId === char.id && (
                            <div
                              key={abilityFlash.key}
                              style={{ position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none", background: `radial-gradient(circle, ${abilityFlash.color}cc 0%, ${abilityFlash.color}55 45%, transparent 75%)`, animation: "abilityFlash 1.1s ease-out forwards", mixBlendMode: "screen" }}
                            />
                          )}
                          {spellFlash && spellFlash.charId === char.id && (() => {
                            const animMap: Record<string, string> = {
                              heal:      "spellHealPulse 1.5s ease-out forwards",
                              fire:      "spellFireRoar 1.5s ease-out forwards",
                              cold:      "spellColdFreeze 1.5s ease-out forwards",
                              lightning: "spellLightningCrackle 1.2s ease-out forwards",
                              thunder:   "spellThunderPush 1.4s ease-out forwards",
                              acid:      "spellPoisonSwirl 1.4s ease-out forwards",
                              poison:    "spellPoisonSwirl 1.4s ease-out forwards",
                              radiant:   "spellRadiantBeam 1.4s ease-out forwards",
                              necrotic:  "spellNecroticDrain 1.5s ease-out forwards",
                              force:     "spellForceBlast 1.3s ease-out forwards",
                              psychic:   "spellPsychicWaver 1.4s ease-out forwards",
                              physical:  "spellDamageStrike 1.3s ease-out forwards",
                              buff:      "spellBuffAura 1.5s ease-out forwards",
                              enchant:   "spellEnchantSpiral 1.5s ease-out forwards",
                            };
                            const animation = animMap[spellFlash.anim] ?? "abilityFlash 1.1s ease-out forwards";
                            return (
                              <div
                                key={spellFlash.key}
                                style={{
                                  position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
                                  background: spellFlash.anim === "heal"
                                    ? `radial-gradient(circle, ${spellFlash.color}dd 0%, ${spellFlash.color}66 45%, transparent 80%)`
                                    : `radial-gradient(circle, ${spellFlash.color}cc 0%, ${spellFlash.color}55 45%, transparent 75%)`,
                                  animation,
                                  mixBlendMode: "screen",
                                  boxShadow: `0 0 22px ${spellFlash.color}66, 0 0 44px ${spellFlash.color}33`,
                                }}
                              />
                            );
                          })()}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span
                            ref={el => {
                              if (!el) return;
                              el.style.fontSize = '';
                              const avail = el.parentElement?.clientWidth ?? 0;
                              if (!avail || el.scrollWidth <= avail) return;
                              const cur = parseFloat(getComputedStyle(el).fontSize);
                              el.style.fontSize = `${Math.max(9, cur * (avail / el.scrollWidth) * 0.96)}px`;
                            }}
                            style={{ fontSize: fs(0.95), fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", color: CLASS_COLORS[char.class] ?? "white", display: "block", width: "100%" }}
                          >{char.name}</span>
                        </div>
                        <div style={{ fontSize: fs(0.76), color: "#94a3b8" }}>
                          {char.race} {char.class} · <span style={{ cursor: "help" }}
                            onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.LEVEL.title, MECHANIC_TIPS.LEVEL.body, "#f59e0b"), e)}
                            onMouseLeave={hideTooltip}>Lvl {char.level}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom: tempHp > 0 ? "3px" : "7px" }}>
                      <div style={{ width: "100%", height: "6px", background: "#3f3f46", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
                      </div>
                      {tempHp > 0 && (
                        <div style={{ width: "100%", height: "3px", background: "#3f3f46", borderRadius: "2px", overflow: "hidden", marginTop: "2px" }}>
                          <div style={{ width: `${Math.min(100, (tempHp / Math.max(1, cardMaxHp)) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#f59e0b,#fbbf24)", boxShadow: "0 0 5px rgba(251,191,36,0.6)", transition: "width 0.4s ease" }} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: fs(0.78), color, fontWeight: "bold", cursor: "help" }}
                          title={cardIb.hpMaxAdd > 0 ? `Base ${char.max_hp} +${cardIb.hpMaxAdd} item bonus` : undefined}
                          onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.HP.title, MECHANIC_TIPS.HP.body), e)}
                          onMouseLeave={hideTooltip}
                        >
                          {Math.min(char.hp, cardMaxHp)}/{cardMaxHp} HP{cardIb.hpMaxAdd > 0 ? " ✦" : ""}
                        </span>
                        {tempHp > 0 && (
                          <span style={{ fontSize: fs(0.65), color: "#f59e0b", fontWeight: 700, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "4px", padding: "0 4px", cursor: "help" }}
                            onMouseEnter={e => showTooltip(tipBox("Temporary Hit Points", `+${tempHp} temporary HP — absorbs incoming damage before your real HP. Does not stack; the higher value is always kept. Clears on long rest.`, "#f59e0b"), e)}
                            onMouseLeave={hideTooltip}
                          >+{tempHp} THP</span>
                        )}
                        <span style={{ fontSize: fs(0.65), color: "#f59e0b", fontWeight: 600, cursor: "help" }}
                          onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.GOLD.title, MECHANIC_TIPS.GOLD.body, "#f59e0b"), e)}
                          onMouseLeave={hideTooltip}
                        >💰 {char.inventory?.gold ?? 0}</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {isDiceTarget && (
                          <span style={{ display:"inline-flex",alignItems:"center",gap:"3px",color:"#fbbf24",fontWeight:"bold",fontSize:fs(0.62),animation:"blink 1s step-end infinite" }}><D20Icon size={13} color="#fbbf24"/> Roll!</span>
                        )}
                        {campaignParty.length > 1 && !isDiceTarget && (
                          <span style={{ fontSize: fs(0.65), fontWeight: "bold", color: isActive ? "#c4b5fd" : "#3f3f46", background: isActive ? "rgba(139,92,246,0.2)" : "transparent", borderRadius: "4px", padding: isActive ? "2px 7px" : "0" }}>
                            {isActive ? "Acting" : "Waiting"}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* XP progress bar */}
                    {(() => {
                      const curXp = char.xp ?? 0;
                      const xpMax = getXpToNextLevel(char.level);
                      const xpPct = char.level >= 10 ? 100 : Math.min(100, (curXp / xpMax) * 100);
                      return (
                        <div style={{ marginTop: "5px" }}>
                          <div style={{ width: "100%", height: "3px", background: "#3f3f46", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${xpPct}%`, height: "100%", background: char.level >= 10 ? "#f59e0b" : "linear-gradient(90deg,#6d28d9,#8b5cf6)", transition: "width 0.6s ease" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(0.58), marginTop: "2px" }}>
                            <span style={{ color: "#7c3aed", fontWeight: 600, cursor: "help" }}
                              onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.XP.title, MECHANIC_TIPS.XP.body, "#7c3aed"), e)}
                              onMouseLeave={hideTooltip}
                            >XP</span>
                            <span style={{ color: "#64748b" }}>{char.level >= 10 ? "MAX LEVEL" : `${curXp} / ${xpMax}`}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Spell slot pips */}
                    {SPELLCASTING_CLASSES.has(char.class) && (() => {
                      const maxSlots  = getSpellSlots(char.class, char.level);
                      const usedSlots = char.spell_slots_used ?? {};
                      const levels    = Object.keys(maxSlots).map(Number).sort();
                      if (levels.length === 0) return null;
                      return (
                        <div style={{ marginTop: "7px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}
                          onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.SPELL_SLOTS.title, MECHANIC_TIPS.SPELL_SLOTS.body, "#8b5cf6"), e)}
                          onMouseLeave={hideTooltip}>
                          {levels.map(lvl => {
                            const max   = maxSlots[lvl];
                            const used  = usedSlots[lvl] ?? 0;
                            const avail = Math.max(0, max - used);
                            return (
                              <div key={lvl} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                <span style={{ fontSize: fs(0.58), color: "#94a3b8", marginRight: "2px", fontWeight: 700 }}>L{lvl}</span>
                                {max <= 8 ? Array.from({ length: max }, (_, i) => (
                                  <div key={i} style={{
                                    width: "13px", height: "13px", borderRadius: "50%",
                                    background: i < avail ? "#8b5cf6" : "transparent",
                                    border: `2px solid ${i < avail ? "#8b5cf6" : "#3f3f46"}`,
                                    transition: "all 0.2s",
                                    boxShadow: i < avail ? "0 0 6px rgba(139,92,246,0.75)" : "none",
                                  }} />
                                )) : null}
                                <span style={{ fontSize: fs(0.6), color: avail > 0 ? "#a78bfa" : "#ef4444", fontWeight: 700, marginLeft: "2px" }}>{avail}/{max}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {/* Class resource pips */}
                    {(() => {
                      const resDefs = (CLASS_RESOURCES[char.class] ?? []).filter(r => r.unit !== "passive" && r.minLevel <= char.level);
                      if (resDefs.length === 0) return null;
                      const statArr: [number, number, number, number, number, number] = [char.charisma, char.wisdom, char.constitution, char.strength, char.intelligence, char.dexterity];
                      return (
                        <div style={{ marginTop: "6px", display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
                          {resDefs.map(res => {
                            const maxVal = res.getMax(char.level, ...statArr);
                            const usedVal = (char.class_resources ?? {})[res.key] ?? 0;
                            const avail = Math.max(0, maxVal - usedVal);
                            if (maxVal === 0) return null;
                            return (
                              <div key={res.key} style={{ display: "flex", alignItems: "center", gap: "3px" }}
                                onMouseEnter={e => showTooltip(tipBox(`${res.emoji} ${res.name}`, `${avail}/${maxVal} ${res.unit} · ${res.resetOn === "shortRest" ? "Short Rest" : res.resetOn === "bardic" ? "Long/Short Rest" : "Long Rest"}`, res.color), e)}
                                onMouseLeave={hideTooltip}>
                                <span style={{ fontSize: fs(0.72) }}>{res.emoji}</span>
                                {res.unit === "HP" ? (
                                  <span style={{ fontSize: fs(0.68), color: res.color, fontWeight: 700 }}>{avail}/{maxVal}</span>
                                ) : maxVal <= 10 ? (
                                  Array.from({ length: maxVal }, (_, i) => (
                                    <div key={i} style={{
                                      width: "12px", height: "12px", borderRadius: "50%",
                                      background: i < avail ? res.color : "transparent",
                                      border: `2px solid ${i < avail ? res.color : "#3f3f46"}`,
                                      transition: "all 0.2s",
                                      boxShadow: i < avail ? `0 0 5px ${res.color}99` : "none",
                                    }} />
                                  ))
                                ) : (
                                  <span style={{ fontSize: fs(0.7), color: res.color, fontWeight: 700 }}>{avail}/{maxVal}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {(char.status_effects?.length ?? 0) > 0 && (
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                        {char.status_effects!.map(raw => {
                          const { name, duration } = parseStatusEffect(raw);
                          const eff = STATUS_EFFECTS[name];
                          if (!eff) {
                            return (
                              <span key={raw} style={{ fontSize: fs(0.6), padding: "1px 6px", borderRadius: "10px", background: "rgba(100,116,139,0.2)", color: "#94a3b8", fontWeight: 700, cursor: "help" }}
                                onMouseEnter={e => showTooltip(tipBox(name, name, "#94a3b8"), e)}
                                onMouseLeave={hideTooltip}
                              >{name}</span>
                            );
                          }
                          const durationLine = duration ? `Duration: ${duration}` : `Duration: ${eff.defaultDuration}`;
                          return (
                            <div key={raw}
                              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: fs(1.7), height: eff.bonusLabel ? "auto" : fs(1.7), padding: eff.bonusLabel ? "2px 5px" : "0", gap: "1px", background: eff.badgeBg, border: `1.5px solid ${eff.badgeColor}`, borderRadius: "6px", boxShadow: `0 0 7px ${eff.cardGlow}`, cursor: "help", fontSize: fs(1.0), flexShrink: 0 }}
                              onMouseEnter={e => showTooltip(tipBox(name, `${eff.description}\n\n${durationLine}`, eff.badgeColor), e)}
                              onMouseLeave={hideTooltip}
                            >
                              {eff.icon}
                              {eff.bonusLabel && <span style={{ fontSize: fs(0.52), color: eff.badgeColor, fontWeight: 700, lineHeight: 1 }}>{eff.bonusLabel}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {campaignParty.length === 0 && (
                <p style={{ fontSize: fs(0.78), color: "#475569", fontStyle: "italic" }}>No adventurers yet. Add characters from Manage Party below.</p>
              )}
            </div>

            {/* Manage party — visible to the campaign owner OR the current
                party leader. Using canManageParty (owner OR leader) instead of
                just isPartyLeader prevents the panel from disappearing if
                partyLeaderId ever drifts out of sync with the active character
                (stale DB value, mid-reclaim render gap, etc.). */}
            {canManageParty && (() => {
              const inCombatNow = combatActive && enemies.some(e => !e.is_defeated);
              const availableToInvite = userRoster.filter(c => !campaignParty.some(p => p.id === c.id)).length;
              return (
            <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(139,92,246,0.25)" }}>
              <button
                onClick={() => setManagePartyOpen(o => !o)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 60%), rgba(139,92,246,0.12)",
                  border: "1px solid rgba(212,169,106,0.45)", borderRadius: "8px",
                  padding: "9px 12px", cursor: "pointer", fontSize: fs(0.78),
                  color: "#fde68a", fontWeight: 700, letterSpacing: "0.03em",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.25)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(212,169,106,0.85)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 14px rgba(139,92,246,0.35), 0 0 14px rgba(212,169,106,0.28)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(212,169,106,0.45)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.25)"; }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.05em", color: "#fde68a", textShadow: "0 0 8px rgba(253,230,138,0.6)" }}>⊕</span>
                  <span>Invite Players</span>
                  {availableToInvite > 0 && !managePartyOpen && (
                    <span style={{ fontSize: fs(0.6), background: "rgba(139,92,246,0.35)", color: "#e9d5ff", padding: "1px 8px", borderRadius: "999px", fontWeight: 700 }}>
                      {availableToInvite} available
                    </span>
                  )}
                </span>
                <span style={{ fontSize: fs(0.65), color: "#c4b5fd" }}>{managePartyOpen ? "▲" : "▼"}</span>
              </button>

              {managePartyOpen && (
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {inCombatNow && (
                    <div style={{ padding: "8px 10px", borderRadius: "7px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", fontSize: fs(0.72), color: "#fca5a5", lineHeight: 1.4 }}>
                      ⚔️ Combat is active — party changes are locked until the encounter ends. New invitations and departures can resume once all enemies are defeated.
                    </div>
                  )}
                  {userRoster.length === 0 ? (
                    <p style={{ fontSize: fs(0.75), color: "#475569", fontStyle: "italic", padding: "6px 0" }}>
                      No characters yet. <Link href="/create-character" style={{ color: "var(--primary)" }}>Create one →</Link>
                    </p>
                  ) : userRoster.map(char => {
                    const inParty = campaignParty.some(c => c.id === char.id);
                    return (
                      <div key={char.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", background: inParty ? "rgba(139,92,246,0.08)" : "rgba(0,0,0,0.2)", borderRadius: "7px", border: `1px solid ${inParty ? "rgba(139,92,246,0.35)" : "var(--border)"}` }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden", border: "1px solid var(--border)", background: "rgba(0,0,0,0.4)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {char.portrait_url
                            ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: fs(0.9) }}>🧙</span>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: fs(0.8), fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{char.name}</div>
                          <div style={{ fontSize: fs(0.65), color: "#64748b" }}>{char.race} {char.class} · Lvl {char.level} · {char.hp}/{char.max_hp} HP</div>
                        </div>
                        {inParty ? (
                          <button
                            onClick={() => leaveParty(char.id)}
                            disabled={inCombatNow}
                            title={inCombatNow ? "Cannot leave the party during combat — wait until the encounter ends." : undefined}
                            style={{ fontSize: fs(0.68), padding: "3px 8px", borderRadius: "5px", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: inCombatNow ? "#7f1d1d" : "#f87171", cursor: inCombatNow ? "not-allowed" : "pointer", opacity: inCombatNow ? 0.45 : 1, flexShrink: 0, transition: "all 0.15s" }}
                            onMouseEnter={e => { if (!inCombatNow) e.currentTarget.style.background = "rgba(239,68,68,0.2)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                          >Leave</button>
                        ) : (
                          <button
                            onClick={() => addToParty(char)}
                            disabled={inCombatNow}
                            title={inCombatNow
                              ? "Cannot invite new characters during combat — wait until the encounter ends."
                              : char.campaign_id && char.campaign_id !== params.id
                                ? "Invite this character — they will leave their current campaign and bring their level/XP with them."
                                : undefined}
                            style={{ fontSize: fs(0.68), padding: "3px 8px", borderRadius: "5px", border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)", color: inCombatNow ? "#14532d" : "#4ade80", cursor: inCombatNow ? "not-allowed" : "pointer", opacity: inCombatNow ? 0.45 : 1, flexShrink: 0, transition: "all 0.15s" }}
                            onMouseEnter={e => { if (!inCombatNow) e.currentTarget.style.background = "rgba(34,197,94,0.2)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(34,197,94,0.1)"; }}
                          >{char.campaign_id && char.campaign_id !== params.id ? "Invite" : "Join"}</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
            );
            })()}

            {/* Party item pool */}
            {droppedItems.length > 0 && (
              <div style={{ marginTop: "4px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                <h4 style={{ fontSize: "0.72rem", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                  Party Pool
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {droppedItems.map(item => {
                    const poolCatalog = getItemByName(item.name);
                    const poolWeaponTip = WEAPON_TIPS[item.name];
                    const poolItemTip = ITEM_TIPS[item.name];
                    return (
                    <div key={item.id}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: "7px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}
                      onMouseEnter={e => {
                        if (poolCatalog) {
                          const rc = RARITY_COLORS[poolCatalog.rarity];
                          showTooltip(tipBoxNode(item.name, <>
                            <div style={{ color: rc, fontSize: "0.85em", fontWeight: "bold", marginBottom: "4px" }}>{RARITY_LABELS[poolCatalog.rarity]}</div>
                            <div style={{ color: "#94a3b8", marginBottom: poolCatalog.effects.some(fx => fx.description) ? "5px" : 0 }}>{poolCatalog.description}</div>
                            {poolCatalog.effects.map((fx, fi) => fx.description && <div key={fi} style={{ padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "2px", color: fx.description.startsWith("⚠️") ? "#ef4444" : "#c4b5fd", fontSize: "0.9em" }}>{fx.description}</div>)}
                          </>, rc), e);
                        } else if (poolWeaponTip || poolItemTip) {
                          const t = poolWeaponTip ?? poolItemTip!;
                          showTooltip(tipBox(t.title, t.body), e);
                        }
                      }}
                      onMouseLeave={() => hideTooltip()}
                    >
                      <div>
                        <div style={{ fontSize: "0.8rem" }}>{item.type === "weapon" ? "⚔️" : "🎒"} {item.name}</div>
                        <div style={{ fontSize: "0.62rem", color: "#64748b" }}>from {item.fromCharacter}</div>
                      </div>
                      {(
                        <button onClick={() => takeItem(item)}
                          style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: "5px", border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.1)", color: "#c4b5fd", cursor: "pointer" }}>
                          Take
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ── Character Sheet tab ── */}
        {sidebarTab === "sheet" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {campaignParty[activeCharIdx] && campaignParty[activeCharIdx].id !== character?.id ? (
              (() => {
                const vc = campaignParty[activeCharIdx];
                const vcColor = CLASS_COLORS[vc.class] ?? "#8b5cf6";
                const vcPct = vc.max_hp > 0 ? Math.round((vc.hp / vc.max_hp) * 100) : 0;
                const vcHpColor = vcPct > 60 ? "#22c55e" : vcPct > 25 ? "#f59e0b" : "#ef4444";
                const getMod = (v: number) => { const m = Math.floor((v - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };
                return (
                  <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ padding: "6px 10px", borderRadius: "6px", background: `${vcColor}18`, border: `1px solid ${vcColor}40`, fontSize: fs(0.72), color: vcColor, textAlign: "center", fontWeight: "bold" }}>
                      👁 Viewing {vc.name}&apos;s Sheet
                    </div>
                    <div
                      onClick={vc.portrait_url ? () => setPortraitModal({ name: vc.name, cls: vc.class, url: vc.portrait_url!, subtitle: `${vc.race} ${vc.class} · Level ${vc.level}` }) : undefined}
                      style={{ width: "100%", aspectRatio: "4/3", borderRadius: "10px", overflow: "hidden", border: `2px solid ${vcColor}40`, background: "rgba(0,0,0,0.5)", cursor: vc.portrait_url ? "zoom-in" : "default" }}>
                      {(() => {
                        const wsStatus = (vc.status_effects ?? []).find(s => /^Wild Shape:/i.test(s));
                        const wsFormName = wsStatus ? wsStatus.replace(/^Wild Shape:\s*/i, "").trim() : null;
                        const wsResolved = wsFormName ? resolveWildShapeForm(wsFormName) : null;
                        const wsEmoji    = wsResolved?.form.emoji ?? (wsFormName ? FALLBACK_BEAST_EMOJI : null);
                        if (wsResolved) {
                          return (
                            <div style={{ position: "relative", width: "100%", height: "100%" }}>
                              <img
                                src={wildShapeImagePath(wsResolved.key)}
                                alt={`Wild Shape: ${wsFormName}`}
                                title={`Wild Shaped: ${wsFormName}`}
                                onError={e => { const img = e.currentTarget; img.style.display = "none"; const fb = img.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = "flex"; }}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                              <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: fs(5), background: "rgba(34,197,94,0.2)" }} title={`Wild Shaped: ${wsFormName}`}>
                                {wsResolved.form.emoji}
                              </div>
                            </div>
                          );
                        }
                        if (wsEmoji) {
                          return (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(5), background: "rgba(34,197,94,0.2)" }} title={`Wild Shaped: ${wsFormName}`}>
                              {wsEmoji}
                            </div>
                          );
                        }
                        return vc.portrait_url ? (
                          <img src={vc.portrait_url} alt={vc.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(4) }}>{CLASS_EMOJI[vc.class] ?? "⚔️"}</div>
                        );
                      })()}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: "bold", fontSize: fs(1.1), color: vcColor }}>{vc.name}</div>
                      <div style={{ color: "#94a3b8", fontSize: fs(0.75) }}>{vc.race} {vc.class} · Lvl {vc.level}</div>
                    </div>
                    {(vc.status_effects?.length ?? 0) > 0 && (
                      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                        {vc.status_effects!.map(raw => {
                          const { name, duration } = parseStatusEffect(raw);
                          const eff = STATUS_EFFECTS[name];
                          if (!eff) return <span key={raw} style={{ fontSize: fs(0.72), padding: "3px 10px", borderRadius: "20px", background: "rgba(100,116,139,0.2)", color: "#94a3b8", fontWeight: 700 }}>{name}</span>;
                          return (
                            <div key={raw}
                              style={{ width: fs(1.8), height: fs(1.8), display: "flex", alignItems: "center", justifyContent: "center", background: eff.badgeBg, border: `1.5px solid ${eff.badgeColor}`, borderRadius: "6px", boxShadow: `0 0 7px ${eff.cardGlow}`, cursor: "help", fontSize: fs(1.05), flexShrink: 0 }}
                              onMouseEnter={e => showTooltip(tipBox(name, `${eff.description}\n\nDuration: ${duration ?? eff.defaultDuration}`, eff.badgeColor), e)}
                              onMouseLeave={hideTooltip}
                            >{eff.icon}</div>
                          );
                        })}
                      </div>
                    )}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: fs(0.85) }}>
                        <span style={{ color: "#94a3b8" }}>Hit Points</span>
                        <span style={{ fontWeight: "bold", color: vcHpColor }}>{vc.hp} / {vc.max_hp}</span>
                      </div>
                      <div style={{ width: "100%", height: "10px", background: "#3f3f46", borderRadius: "5px", overflow: "hidden" }}>
                        <div style={{ width: `${vcPct}%`, height: "100%", background: vcHpColor, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                      {([["STR", vc.strength], ["DEX", vc.dexterity], ["CON", vc.constitution], ["INT", vc.intelligence], ["WIS", vc.wisdom], ["CHA", vc.charisma]] as [string, number][]).map(([lbl, val]) => (
                        <div key={lbl} style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "8px 6px", textAlign: "center", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: fs(0.65), color: "#64748b", letterSpacing: "0.05em", marginBottom: "2px" }}>{lbl}</div>
                          <div style={{ fontSize: fs(1), fontWeight: "bold", color: "white" }}>{val}</div>
                          <div style={{ fontSize: fs(0.7), color: "#8b5cf6" }}>{getMod(val)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <div style={{ flex: 1, background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "10px", textAlign: "center", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: fs(0.65), color: "#64748b", marginBottom: "3px", letterSpacing: "0.04em" }}>GOLD</div>
                        <div style={{ fontSize: fs(0.95), fontWeight: "bold", color: "#f59e0b" }}>{vc.inventory?.gold ?? 0} gp</div>
                      </div>
                      <div style={{ flex: 1, background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "10px", textAlign: "center", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: fs(0.65), color: "#64748b", marginBottom: "3px", letterSpacing: "0.04em" }}>XP</div>
                        <div style={{ fontSize: fs(0.95), fontWeight: "bold", color: "#8b5cf6" }}>{vc.xp ?? 0}</div>
                      </div>
                    </div>
                    {/* Other player class abilities — read-only */}
                    {(() => {
                      const resDefs = (CLASS_RESOURCES[vc.class] ?? []).filter(r => r.unit !== "passive" && r.minLevel <= vc.level);
                      if (resDefs.length === 0) return null;
                      const statArr: [number, number, number, number, number, number] = [vc.charisma, vc.wisdom, vc.constitution, vc.strength, vc.intelligence, vc.dexterity];
                      return (
                        <div>
                          <div style={{ fontSize: fs(0.75), color: "#64748b", marginBottom: "8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Class Abilities</div>
                          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
                            {resDefs.map(res => {
                              const maxVal = res.getMax(vc.level, ...statArr);
                              const usedVal = (vc.class_resources ?? {})[res.key] ?? 0;
                              const avail = Math.max(0, maxVal - usedVal);
                              if (maxVal === 0) return null;
                              return (
                                <div key={res.key} style={{ display: "flex", alignItems: "center", gap: "3px" }}
                                  onMouseEnter={e => showTooltip(
                                    <div style={{ background: "#1a1730", border: `1px solid ${res.color}55`, borderRadius: "8px", padding: "8px 11px", width: "200px", fontSize: fs(0.7), color: "#e2e8f0", lineHeight: 1.45, boxShadow: "0 4px 16px rgba(0,0,0,0.7)", whiteSpace: "normal" }}>
                                      <div style={{ fontWeight: "bold", color: res.color, marginBottom: "3px" }}>{res.emoji} {res.name}</div>
                                      <div style={{ color: "#94a3b8", fontSize: fs(0.68) }}>{avail}/{maxVal} {res.unit} remaining</div>
                                    </div>, e)}
                                  onMouseLeave={hideTooltip}>
                                  <span style={{ fontSize: fs(0.75) }}>{res.emoji}</span>
                                  {maxVal <= 10 ? (
                                    Array.from({ length: maxVal }, (_, i) => (
                                      <div key={i} style={{ width: "11px", height: "11px", borderRadius: "50%", background: i < avail ? res.color : "transparent", border: `1.5px solid ${i < avail ? res.color : "#3f3f46"}`, boxShadow: i < avail ? `0 0 5px ${res.color}99` : "none" }} />
                                    ))
                                  ) : (
                                    <span style={{ fontSize: fs(0.68), color: res.color, fontWeight: 700 }}>{avail}/{maxVal}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    {((vc.inventory?.items?.length ?? 0) + (vc.inventory?.weapons?.length ?? 0)) > 0 && (
                      <div>
                        <div style={{ fontSize: fs(0.75), color: "#64748b", marginBottom: "8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Inventory</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {[...(vc.inventory?.weapons ?? []), ...(vc.inventory?.items ?? [])].slice(0, 8).map((item, i) => {
                            const vcCatalog = getItemByName(item);
                            const vcWepTip = WEAPON_TIPS[item];
                            const vcItemTip = ITEM_TIPS[item];
                            return (
                            <div key={i}
                              style={{ padding: "5px 8px", borderRadius: "6px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", fontSize: fs(0.75), color: "#e2e8f0", cursor: vcCatalog || vcWepTip || vcItemTip ? "help" : "default" }}
                              onMouseEnter={e => {
                                if (vcCatalog) {
                                  const rc = RARITY_COLORS[vcCatalog.rarity];
                                  showTooltip(tipBoxNode(item, <>
                                    <div style={{ color: rc, fontSize: "0.85em", fontWeight: "bold", marginBottom: "4px" }}>{RARITY_LABELS[vcCatalog.rarity]}</div>
                                    <div style={{ color: "#94a3b8", marginBottom: vcCatalog.effects.some(fx => fx.description) ? "5px" : 0 }}>{vcCatalog.description}</div>
                                    {vcCatalog.effects.map((fx, fi) => fx.description && <div key={fi} style={{ padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "2px", color: fx.description.startsWith("⚠️") ? "#ef4444" : "#c4b5fd", fontSize: "0.9em" }}>{fx.description}</div>)}
                                  </>, rc), e);
                                } else if (vcWepTip || vcItemTip) {
                                  const t = vcWepTip ?? vcItemTip!;
                                  showTooltip(tipBox(t.title, t.body), e);
                                }
                              }}
                              onMouseLeave={() => hideTooltip()}
                            >
                              {item}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <>
                {stateNotice && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "8px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", fontSize: fs(0.8), color: "#34d399", textAlign: "center" }}>
                ⚡ {stateNotice}
              </div>
            )}

            {character ? (
              <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Identity with portrait */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <div
                    onClick={character.portrait_url ? () => setPortraitModal({ name: character.name, cls: character.class, url: character.portrait_url!, subtitle: `${character.race} ${character.class} · Level ${character.level}` }) : undefined}
                    style={{ width: "100%", aspectRatio: "4/3", borderRadius: "10px", overflow: "hidden", border: `2px solid ${CLASS_COLORS[character.class] ?? "var(--border)"}40`, background: "rgba(0,0,0,0.5)", flexShrink: 0, cursor: character.portrait_url ? "zoom-in" : "default", transition: "border-color 0.2s, box-shadow 0.2s" }}
                    onMouseEnter={e => { if (character.portrait_url) { (e.currentTarget as HTMLDivElement).style.borderColor = `${CLASS_COLORS[character.class] ?? "#8b5cf6"}99`; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${CLASS_COLORS[character.class] ?? "#8b5cf6"}33`; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${CLASS_COLORS[character.class] ?? "var(--border)"}40`; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                  >
                    {(() => {
                      const wsStatus = (character.status_effects ?? []).find(s => /^Wild Shape:/i.test(s));
                      const wsFormName = wsStatus ? wsStatus.replace(/^Wild Shape:\s*/i, "").trim() : null;
                      const wsResolved = wsFormName ? resolveWildShapeForm(wsFormName) : null;
                      const wsEmoji    = wsResolved?.form.emoji ?? (wsFormName ? FALLBACK_BEAST_EMOJI : null);
                      if (wsResolved) {
                        return (
                          <div style={{ position: "relative", width: "100%", height: "100%" }}>
                            <img
                              src={wildShapeImagePath(wsResolved.key)}
                              alt={`Wild Shape: ${wsFormName}`}
                              title={`Wild Shaped: ${wsFormName}`}
                              onError={e => { const img = e.currentTarget; img.style.display = "none"; const fb = img.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = "flex"; }}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: fs(5), background: "rgba(34,197,94,0.2)" }} title={`Wild Shaped: ${wsFormName}`}>
                              {wsResolved.form.emoji}
                            </div>
                          </div>
                        );
                      }
                      if (wsEmoji) {
                        return (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(5), background: "rgba(34,197,94,0.2)" }} title={`Wild Shaped: ${wsFormName}`}>
                            {wsEmoji}
                          </div>
                        );
                      }
                      return character.portrait_url ? (
                        <img src={character.portrait_url} alt={character.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(4) }}>🧙</div>
                      );
                    })()}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: "bold", fontSize: fs(1.1), color: CLASS_COLORS[character.class] ?? "white" }}>{character.name}</div>
                    {character.title && <div style={{ fontSize: fs(0.72), color: "rgba(180,140,70,0.75)", fontStyle: "italic", marginTop: "2px" }}>&ldquo;{character.title}&rdquo;</div>}
                    <div style={{ color: "#94a3b8", fontSize: fs(0.75) }}>{character.race} {character.class} · Lvl {character.level}</div>
                  </div>
                  <button
                    onClick={() => setShowBackstory(true)}
                    style={{ fontSize: fs(0.72), padding: "5px 14px", borderRadius: "20px", background: "rgba(180,120,40,0.1)", border: "1px solid rgba(180,120,40,0.35)", color: "#d4a96a", cursor: "pointer", transition: "all 0.15s", fontWeight: 600, letterSpacing: "0.03em" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(180,120,40,0.22)"; e.currentTarget.style.borderColor = "rgba(180,120,40,0.6)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(180,120,40,0.1)"; e.currentTarget.style.borderColor = "rgba(180,120,40,0.35)"; }}>
                    📖 Backstory
                  </button>
                </div>

                {/* Status effects */}
                {(character.status_effects?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {character.status_effects!.map(raw => {
                      const { name, duration } = parseStatusEffect(raw);
                      const eff = STATUS_EFFECTS[name];
                      if (!eff) return <span key={raw} style={{ fontSize: fs(0.72), padding: "3px 10px", borderRadius: "20px", background: "rgba(100,116,139,0.2)", color: "#94a3b8", fontWeight: 700 }}>{name}</span>;
                      return (
                        <div key={raw}
                          style={{ width: fs(1.9), height: fs(1.9), display: "flex", alignItems: "center", justifyContent: "center", background: eff.badgeBg, border: `1.5px solid ${eff.badgeColor}`, borderRadius: "6px", boxShadow: `0 0 8px ${eff.cardGlow}`, cursor: "help", fontSize: fs(1.1), flexShrink: 0 }}
                          onMouseEnter={e => showTooltip(tipBox(name, `${eff.description}\n\nDuration: ${duration ?? eff.defaultDuration}`, eff.badgeColor), e)}
                          onMouseLeave={hideTooltip}
                        >{eff.icon}</div>
                      );
                    })}
                  </div>
                )}

                {/* HP */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: fs(0.85) }}>
                    <span style={{ color: "#94a3b8" }}>Hit Points</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ fontWeight: "bold", color: hpColor }}>{Math.min(character.hp, effectiveMaxHp)} / {effectiveMaxHp}</span>
                      {(itemBonuses?.hpMaxAdd ?? 0) > 0 && (
                        <span
                          title={`Base max HP: ${character.max_hp} · Item bonus: +${itemBonuses!.hpMaxAdd} · Effective max: ${effectiveMaxHp}`}
                          style={{ fontSize: fs(0.65), color: "#f59e0b", fontWeight: "bold", cursor: "help", background: "rgba(245,158,11,0.15)", borderRadius: "4px", padding: "1px 5px" }}
                        >✦+{itemBonuses!.hpMaxAdd}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ width: "100%", height: "10px", background: "#3f3f46", borderRadius: "5px", overflow: "hidden" }}>
                    <div style={{ width: `${hpPercent}%`, height: "100%", background: hpColor, transition: "width 0.4s ease, background 0.4s ease" }} />
                  </div>
                </div>

                {/* XP */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: fs(0.85) }}>
                    <span style={{ color: "#94a3b8" }}>Experience</span>
                    <span style={{ fontWeight: "bold", color: "#8b5cf6" }}>{character.xp ?? 0} / {xpToNext} XP</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "#3f3f46", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${xpPercent}%`, height: "100%", background: "linear-gradient(90deg, #7c3aed, #a855f7)", transition: "width 0.6s ease" }} />
                  </div>
                </div>

                {/* Ability scores */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                  {([["STR", character.strength], ["DEX", character.dexterity], ["CON", character.constitution], ["INT", character.intelligence], ["WIS", character.wisdom], ["CHA", character.charisma]] as [string, number][]).map(([label, baseScore]) => {
                    const statKey    = STAT_KEY_MAP[label];
                    const effScore   = itemBonuses ? getEffectiveStat(baseScore, statKey, itemBonuses) : baseScore;
                    const m          = Math.floor((effScore - 10) / 2);
                    const guide      = CLASS_STAT_GUIDES[character.class]?.[label];
                    const tierStyle  = guide ? getTierStyle(guide.tier) : null;
                    const addBonus   = itemBonuses?.statAdd[statKey] ?? 0;
                    const setBonus   = itemBonuses?.statSet[statKey] ?? 0;
                    const hasItemBuf = addBonus !== 0 || (setBonus > 0 && setBonus > baseScore);
                    const netDiff    = effScore - baseScore;
                    return (
                      <div
                        key={label}
                        style={{ position: "relative", background: "rgba(0,0,0,0.3)", border: `1px solid ${tierStyle ? tierStyle.color + "55" : "var(--border)"}`, padding: "10px 4px 8px", borderRadius: "8px", textAlign: "center", cursor: "help", transition: "border-color 0.2s" }}
                        onMouseEnter={e => { setHoveredStat(label); showTooltip(tipBoxNode(`${STAT_FULL[label]} (${label})`,
                          <>
                            <div style={{ color: "#94a3b8", marginBottom: (hasItemBuf || guide) ? "6px" : 0, paddingBottom: (hasItemBuf || guide) ? "6px" : 0, borderBottom: (hasItemBuf || guide) ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                              {STAT_GENERAL_DESC[label]}
                            </div>
                            {hasItemBuf && (
                              <div style={{ marginBottom: guide ? "6px" : 0, paddingBottom: guide ? "6px" : 0, borderBottom: guide ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                                <div style={{ color: "#94a3b8", fontSize: "0.9em", marginBottom: "2px" }}>Base: {baseScore} → Effective: {effScore}</div>
                                {addBonus !== 0 && <div style={{ padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "2px", color: netDiff > 0 ? "#f59e0b" : "#ef4444", fontSize: "0.9em" }}>Item bonus: {addBonus > 0 ? "+" : ""}{addBonus}</div>}
                                {setBonus > baseScore && <div style={{ padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", color: "#f59e0b", fontSize: "0.9em" }}>Set to minimum: {setBonus}</div>}
                              </div>
                            )}
                            {guide && tierStyle && (
                              <>
                                <div style={{ fontWeight: "bold", color: tierStyle.color, marginBottom: "2px", fontSize: "0.95em" }}>{tierStyle.label} for {character.class}</div>
                                <div style={{ color: "#94a3b8", fontSize: "0.9em" }}>{guide.reason}</div>
                              </>
                            )}
                          </>, tierStyle?.color ?? "#8b5cf6"), e); }}
                        onMouseLeave={() => { setHoveredStat(null); hideTooltip(); }}
                      >
                        <div style={{ fontSize: fs(0.6), color: "#94a3b8", marginBottom: "2px", lineHeight: 1.1 }}>{STAT_FULL[label]}</div>
                        <div style={{ fontWeight: "bold", fontSize: fs(1) }}>{effScore}</div>
                        <div style={{ fontSize: fs(0.7), color: m >= 0 ? "#22c55e" : "#ef4444" }}>{m >= 0 ? `+${m}` : m}</div>
                        {hasItemBuf && (
                          <div style={{ fontSize: fs(0.5), color: netDiff > 0 ? "#f59e0b" : "#ef4444", marginTop: "1px", fontWeight: "bold" }}>
                            {netDiff > 0 ? `✦+${netDiff}` : `✦${netDiff}`}
                          </div>
                        )}
                        {tierStyle && !hasItemBuf && (
                          <div style={{ fontSize: fs(0.5), color: tierStyle.color, marginTop: "3px", fontWeight: "bold", letterSpacing: "0.06em" }}>
                            {tierStyle.label.toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Spell slots */}
                {SPELLCASTING_CLASSES.has(character.class) && (() => {
                  const maxSlots  = getSpellSlots(character.class, character.level);
                  const usedSlots = character.spell_slots_used ?? {};
                  const hasSlots  = Object.keys(maxSlots).length > 0;
                  return hasSlots ? (
                    <div>
                      <h3
                        style={{ fontSize: fs(0.85), fontWeight: "bold", marginBottom: "10px", color: "var(--primary)", cursor: "help" }}
                        onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.SPELL_SLOTS.title, MECHANIC_TIPS.SPELL_SLOTS.body), e)}
                        onMouseLeave={hideTooltip}
                      >Spell Slots</h3>
                      {Object.entries(maxSlots).map(([lvl, max]) => {
                        const used = usedSlots[Number(lvl)] ?? 0;
                        const remaining = Math.max(0, max - used);
                        return (
                          <div key={lvl} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <span style={{ fontSize: fs(0.7), color: "#64748b", width: "42px", flexShrink: 0 }}>Lvl {lvl}</span>
                            <div style={{ display: "flex", gap: "4px" }}>
                              {Array.from({ length: max }, (_, i) => (
                                <div key={i} style={{ width: "12px", height: "12px", borderRadius: "50%", background: i < remaining ? "#8b5cf6" : "rgba(100,116,139,0.3)", border: i < remaining ? "1px solid #7c3aed" : "1px solid #475569", transition: "background 0.2s" }} />
                              ))}
                            </div>
                            <span style={{ fontSize: fs(0.68), color: remaining > 0 ? "#8b5cf6" : "#ef4444" }}>{remaining}/{max}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null;
                })()}

                {/* Spellbook */}
                {SPELLCASTING_CLASSES.has(character.class) && ((character.cantrips_known?.length ?? 0) > 0 || (character.spells_prepared?.length ?? 0) > 0 || Object.keys(getSpellSlots(character.class, character.level)).length > 0) && (
                  <div>
                    <h3 style={{ fontSize: fs(0.85), fontWeight: "bold", marginBottom: "10px", color: "var(--primary)", cursor: "help" }}
                      onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.SPELLBOOK.title, MECHANIC_TIPS.SPELLBOOK.body, "#8b5cf6"), e)}
                      onMouseLeave={hideTooltip}>Spellbook</h3>
                    {(character.cantrips_known?.length ?? 0) > 0 && (
                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ fontSize: fs(0.65), color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px", cursor: "help" }}
                          onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.CANTRIP.title, MECHANIC_TIPS.CANTRIP.body, "#8b5cf6"), e)}
                          onMouseLeave={hideTooltip}>Cantrips · at-will</div>
                        {character.cantrips_known!.map((s, i) => {
                          const entry = CANTRIPS[character.class]?.find(e => e.name === s);
                          const active = hoveredSpell === `c-${i}`;
                          return (
                            <div key={i} style={{ position: "relative", marginBottom: "3px" }}>
                              <div
                                role="button"
                                onClick={() => { if (!isTyping) handleSend(`I cast ${s}.`); }}
                                onMouseEnter={e => { setHoveredSpell(`c-${i}`); if (entry) showTooltip(tipBox(s, `${entry.school} · ${entry.desc}`, "#8b5cf6"), e); }}
                                onMouseLeave={() => { setHoveredSpell(null); hideTooltip(); }}
                                style={{ padding: "6px 10px", background: active ? "rgba(139,92,246,0.22)" : "rgba(139,92,246,0.08)", borderRadius: "5px", fontSize: fs(0.8), cursor: isTyping ? "default" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${active ? "rgba(139,92,246,0.45)" : "transparent"}`, transition: "all 0.15s", opacity: isTyping ? 0.55 : 1 }}
                              >
                                <span>✦ {s}</span>
                                <span style={{ fontSize: fs(0.58), color: "#8b5cf6", fontWeight: 600 }}>at-will</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(character.spells_prepared?.length ?? 0) > 0 && (() => {
                      const maxSlots  = getSpellSlots(character.class, character.level);
                      const usedSlots = character.spell_slots_used ?? {};
                      const slotLevels = Object.keys(maxSlots).map(Number).sort();
                      const availLvl   = slotLevels.find(lvl => Math.max(0, (maxSlots[lvl] ?? 0) - (usedSlots[lvl] ?? 0)) > 0) ?? null;
                      const totalAvail = slotLevels.reduce((n, lvl) => n + Math.max(0, (maxSlots[lvl] ?? 0) - (usedSlots[lvl] ?? 0)), 0);
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <div style={{ fontSize: fs(0.65), color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "help" }}
                              onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.PREPARED_SPELL.title, MECHANIC_TIPS.PREPARED_SPELL.body, "#8b5cf6"), e)}
                              onMouseLeave={hideTooltip}>Prepared Spells</div>
                            {slotLevels.length > 0 && (
                              <div style={{ display: "flex", gap: "5px" }}>
                                {slotLevels.map(lvl => {
                                  const avail = Math.max(0, (maxSlots[lvl] ?? 0) - (usedSlots[lvl] ?? 0));
                                  return (
                                    <span key={lvl} style={{ fontSize: fs(0.58), background: avail > 0 ? "rgba(139,92,246,0.2)" : "rgba(0,0,0,0.3)", color: avail > 0 ? "#c4b5fd" : "#3f3f46", borderRadius: "4px", padding: "1px 5px", fontWeight: 600, cursor: "help" }}
                                      onMouseEnter={e => showTooltip(tipBox(`Level ${lvl} Spell Slots`, `${avail} of ${maxSlots[lvl]} remaining. ${MECHANIC_TIPS.SPELL_SLOTS.body}`, "#8b5cf6"), e)}
                                      onMouseLeave={hideTooltip}>
                                      L{lvl}: {avail}/{maxSlots[lvl]}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {character.spells_prepared!.map((s, i) => {
                            const entry   = LEVEL1_SPELLS[character.class]?.find(e => e.name === s);
                            const canCast = !isTyping && totalAvail > 0;
                            const active  = hoveredSpell === `p-${i}`;
                            return (
                              <div key={i} style={{ position: "relative", marginBottom: "3px" }}>
                                <div
                                  role="button"
                                  onClick={async () => {
                                    if (!canCast || !availLvl) return;
                                    const newSlots = { ...usedSlots, [availLvl]: (usedSlots[availLvl] ?? 0) + 1 };
                                    setCharacter(prev => prev ? { ...prev, spell_slots_used: newSlots } : null);
                                    setCampaignParty(prev => prev.map(c => c.id === character.id ? { ...c, spell_slots_used: newSlots } : c));
                                    // Sync refs immediately — applyStateChange reads characterRef.current after the DM
                                    // responds; without this, it would overwrite the consumed slot with a stale value.
                                    if (characterRef.current) characterRef.current = { ...characterRef.current, spell_slots_used: newSlots };
                                    campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === character.id ? { ...c, spell_slots_used: newSlots } : c);
                                    await charWrite(character.id, { spell_slots_used: newSlots });
                                    pendingSpellCastRef.current += 1;
                                    handleSend(`I cast ${s}.`);
                                  }}
                                  onMouseEnter={e => { setHoveredSpell(`p-${i}`); if (entry) showTooltip(tipBox(s, `${entry.school} · ${entry.desc}`, "#8b5cf6"), e); }}
                                  onMouseLeave={() => { setHoveredSpell(null); hideTooltip(); }}
                                  style={{ padding: "6px 10px", background: canCast && active ? "rgba(139,92,246,0.22)" : canCast ? "rgba(139,92,246,0.08)" : "rgba(0,0,0,0.2)", borderRadius: "5px", fontSize: fs(0.8), cursor: canCast ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${active && canCast ? "rgba(139,92,246,0.45)" : "transparent"}`, transition: "all 0.15s", opacity: canCast ? 1 : 0.4 }}
                                >
                                  <span style={{ color: canCast ? undefined : "#475569" }}>◈ {s}</span>
                                  <span style={{ fontSize: fs(0.58), color: canCast ? "#8b5cf6" : "#3f3f46", fontWeight: 600 }}>
                                    {availLvl !== null ? `L${availLvl} slot` : "no slots"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Higher-level spells (2nd+) the caster has slots for — full class lists, cast consumes the right slot */}
                    {(() => {
                      const maxSlots   = getSpellSlots(character.class, character.level);
                      const usedSlots  = character.spell_slots_used ?? {};
                      const slotLevels = Object.keys(maxSlots).map(Number).sort((a, b) => a - b);
                      const maxSlotLvl = slotLevels.length ? slotLevels[slotLevels.length - 1] : 0;
                      // Half-casters (and anyone who picked no spells at creation) have no
                      // 1st-level "Prepared Spells" list, so include level 1 here to give
                      // them access. Full casters with prepared picks start at level 2.
                      const startLvl = (character.spells_prepared?.length ?? 0) === 0 ? 1 : 2;
                      if (maxSlotLvl < startLvl) return null;
                      const sections: [number, { name: string; school: string; desc: string }[]][] = [];
                      for (let L = startLvl; L <= maxSlotLvl; L++) {
                        const spells = getClassSpellsAtLevel(character.class, L);
                        if (spells.length) sections.push([L, spells]);
                      }
                      if (!sections.length) return null;
                      return (
                        <div style={{ marginTop: "12px" }}>
                          <div style={{ fontSize: fs(0.65), color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Higher-Level Spells</div>
                          {sections.map(([L, spells]) => {
                            const open    = openSpellLevels.includes(L);
                            // Cast a level-L spell with the lowest available slot of level ≥ L (auto-upcast).
                            const castLvl = slotLevels.find(sl => sl >= L && Math.max(0, (maxSlots[sl] ?? 0) - (usedSlots[sl] ?? 0)) > 0) ?? null;
                            return (
                              <div key={L} style={{ marginBottom: "4px" }}>
                                <button
                                  onClick={() => setOpenSpellLevels(prev => prev.includes(L) ? prev.filter(x => x !== L) : [...prev, L])}
                                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)", borderRadius: "5px", padding: "5px 9px", cursor: "pointer", color: "#c4b5fd", fontSize: fs(0.72), fontWeight: 600 }}
                                >
                                  <span>Level {L} · {spells.length} spells</span>
                                  <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                    <span style={{ fontSize: fs(0.56), color: castLvl ? "#8b5cf6" : "#ef4444" }}>{castLvl ? `slot ready (L${castLvl})` : "no slot"}</span>
                                    <span style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
                                  </span>
                                </button>
                                {open && (
                                  <div style={{ marginTop: "3px", display: "flex", flexDirection: "column", gap: "3px" }}>
                                    {spells.map((sp, i) => {
                                      const canCast = !isTyping && castLvl !== null;
                                      return (
                                        <div key={i} role="button"
                                          onClick={async () => {
                                            if (!canCast || castLvl === null) return;
                                            const newSlots = { ...usedSlots, [castLvl]: (usedSlots[castLvl] ?? 0) + 1 };
                                            setCharacter(prev => prev ? { ...prev, spell_slots_used: newSlots } : null);
                                            setCampaignParty(prev => prev.map(c => c.id === character.id ? { ...c, spell_slots_used: newSlots } : c));
                                            if (characterRef.current) characterRef.current = { ...characterRef.current, spell_slots_used: newSlots };
                                            campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === character.id ? { ...c, spell_slots_used: newSlots } : c);
                                            await charWrite(character.id, { spell_slots_used: newSlots });
                                            pendingSpellCastRef.current += 1;
                                            handleSend(`I cast ${sp.name}.`);
                                          }}
                                          onMouseEnter={e => showTooltip(tipBox(sp.name, `${sp.school} · ${sp.desc}`, "#8b5cf6"), e)}
                                          onMouseLeave={hideTooltip}
                                          style={{ padding: "6px 10px", background: canCast ? "rgba(139,92,246,0.08)" : "rgba(0,0,0,0.2)", borderRadius: "5px", fontSize: fs(0.8), cursor: canCast ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: canCast ? 1 : 0.45, transition: "all 0.15s" }}
                                        >
                                          <span style={{ color: canCast ? undefined : "#475569" }}>◈ {sp.name}</span>
                                          <span style={{ fontSize: fs(0.58), color: canCast ? "#8b5cf6" : "#3f3f46", fontWeight: 600 }}>{castLvl !== null ? `L${castLvl} slot` : "no slot"}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Class Abilities */}
                {(() => {
                  const resDefs = (CLASS_RESOURCES[character.class] ?? []).filter(r => r.minLevel <= character.level);
                  if (resDefs.length === 0) return null;
                  const statArr: [number, number, number, number, number, number] = [character.charisma, character.wisdom, character.constitution, character.strength, character.intelligence, character.dexterity];
                  return (
                    <div>
                      <h3 style={{ fontSize: fs(0.85), fontWeight: "bold", marginBottom: "10px", color: "var(--primary)" }}>Class Abilities</h3>
                      {resDefs.map(res => {
                        const maxVal  = res.getMax(character.level, ...statArr);
                        const usedVal = (character.class_resources ?? {})[res.key] ?? 0;
                        const avail   = Math.max(0, maxVal - usedVal);
                        const isPassive = res.unit === "passive";
                        const isHP      = res.unit === "HP";
                        return (
                          <div key={res.key} style={{ marginBottom: "12px", padding: "10px 12px", background: "rgba(0,0,0,0.25)", borderRadius: "9px", border: `1px solid ${res.color}33` }}>
                            {/* Header row */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}
                              onMouseEnter={e => showTooltip(tipBoxNode(`${res.emoji} ${res.name}`,
                                <>
                                  <div style={{ color: "#94a3b8" }}>{res.description}</div>
                                  {character.class === "Barbarian" && res.key === "rage" && <div style={{ marginTop: "5px", color: "#f97316", fontSize: "0.9em" }}>Damage bonus: +{getRageDamageBonus(character.level)}</div>}
                                  {character.class === "Bard" && res.key === "bardic_inspiration" && <div style={{ marginTop: "5px", color: "#f59e0b", fontSize: "0.9em" }}>Die: {getBardicInspirationDie(character.level)}</div>}
                                  {character.class === "Rogue" && res.key === "sneak_attack" && <div style={{ marginTop: "5px", color: "#a78bfa", fontSize: "0.9em" }}>Damage: {getSneakAttackDice(character.level)}</div>}
                                  {character.class === "Druid" && res.key === "wild_shape" && <div style={{ marginTop: "5px", color: "#22c55e", fontSize: "0.9em" }}>Max CR: {getWildShapeCR(character.level)}</div>}
                                </>, res.color), e)}
                              onMouseLeave={hideTooltip}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: fs(1) }}>{res.emoji}</span>
                                <span style={{ fontWeight: "bold", color: res.color, fontSize: fs(0.82) }}>{res.name}</span>
                              </div>
                              {!isPassive && (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  {isHP ? (
                                    <span style={{ fontSize: fs(0.72), color: res.color, fontWeight: 700 }}>{avail} / {maxVal} {res.unit}</span>
                                  ) : maxVal <= 10 ? (
                                    <div style={{ display: "flex", gap: "3px" }}>
                                      {Array.from({ length: maxVal }, (_, i) => (
                                        <div key={i} style={{
                                          width: "10px", height: "10px", borderRadius: "50%",
                                          background: i < avail ? res.color : "transparent",
                                          border: `1.5px solid ${i < avail ? res.color : "#3f3f46"}`,
                                          boxShadow: i < avail ? `0 0 5px ${res.color}88` : "none",
                                          transition: "all 0.2s",
                                        }} />
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: fs(0.75), color: res.color, fontWeight: 700 }}>{avail} / {maxVal}</span>
                                  )}
                                  <span style={{ fontSize: fs(0.6), color: "#475569" }}>{res.resetOn === "shortRest" ? "SR" : res.resetOn === "bardic" ? "LR/SR" : "LR"}</span>
                                </div>
                              )}
                              {isPassive && <span style={{ fontSize: fs(0.6), color: "#475569", fontStyle: "italic" }}>passive</span>}
                            </div>
                            {/* Sub-abilities / use buttons */}
                            {!isPassive && (res.subAbilities ?? []).filter(sa => sa.minLevel <= character.level).map(sa => {
                              const canUse = !isTyping && (isHP ? avail >= sa.cost : avail >= sa.cost);
                              return (
                                <button key={sa.name}
                                  disabled={!canUse}
                                  onClick={() => { handleUseClassAbility(res.key, sa.cost); handleSend(`I use ${sa.name}.`); }}
                                  onMouseEnter={e => { if (canUse) e.currentTarget.style.background = `${res.color}33`; showTooltip(tipBox(sa.name, sa.description + (sa.cost > 0 ? ` · Cost: ${sa.cost} ${res.unit}` : ""), res.color), e); }}
                                  onMouseLeave={e => { e.currentTarget.style.background = canUse ? `${res.color}18` : "transparent"; hideTooltip(); }}
                                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "5px 8px", marginTop: "4px", borderRadius: "6px", background: canUse ? `${res.color}18` : "transparent", border: `1px solid ${canUse ? res.color + "44" : "#3f3f46"}`, cursor: canUse ? "pointer" : "default", opacity: canUse ? 1 : 0.4, transition: "all 0.15s", textAlign: "left" }}
                                >
                                  <span style={{ fontSize: fs(0.75), color: canUse ? "#e2e8f0" : "#64748b", fontWeight: 600 }}>{sa.name}</span>
                                  {sa.cost > 0 && <span style={{ fontSize: fs(0.62), color: canUse ? res.color : "#64748b", fontWeight: 700 }}>-{sa.cost} {res.unit}</span>}
                                </button>
                              );
                            })}
                            {isPassive && (
                              <div style={{ fontSize: fs(0.7), color: "#64748b", lineHeight: 1.45 }}>
                                {character.class === "Rogue" && res.key === "sneak_attack" && <span style={{ color: "#a78bfa" }}>{getSneakAttackDice(character.level)} extra damage</span>}
                                {character.class === "Bard" && res.key === "bardic_inspiration" && <span style={{ color: "#f59e0b" }}>Die: {getBardicInspirationDie(character.level)}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Proficiencies */}
                {(() => {
                  const pb = character.level <= 4 ? 2 : character.level <= 8 ? 3 : character.level <= 12 ? 4 : 5;
                  const saves = CLASS_SAVES[character.class] ?? [];
                  const skills = character.skill_proficiencies ?? [];
                  if (saves.length === 0 && skills.length === 0) return null;
                  return (
                    <div>
                      <h3 style={{ fontSize: fs(0.85), fontWeight: "bold", marginBottom: "10px", color: "var(--primary)" }}>
                        Proficiencies <span style={{ fontSize: fs(0.72), color: "#64748b", fontWeight: 400 }}>+{pb} prof. bonus</span>
                      </h3>
                      {saves.length > 0 && (
                        <div style={{ marginBottom: "8px" }}>
                          <div style={{ fontSize: fs(0.65), color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Saving Throws</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {saves.map(s => (
                              <span key={s} style={{ fontSize: fs(0.75), padding: "3px 10px", borderRadius: "4px", background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", fontWeight: 600 }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {skills.length > 0 && (
                        <div>
                          <div style={{ fontSize: fs(0.65), color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Skill Proficiencies</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {skills.map(s => (
                              <span key={s} style={{ fontSize: fs(0.75), padding: "3px 10px", borderRadius: "4px", background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)", fontWeight: 600 }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Inventory with drop buttons */}
                <div>
                  <h3 style={{ fontSize: fs(0.85), fontWeight: "bold", marginBottom: "10px", color: "var(--primary)" }}>Inventory</h3>
                  {/* Currency */}
                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "8px 10px", marginBottom: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: fs(0.78), color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Currency</span>
                    </div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: fs(0.82) }}>
                      {([
                        { key: "pp" as const, color: "#e2e8f0", amount: character.inventory?.pp ?? 0 },
                        { key: "gp" as const, color: "#fbbf24", amount: character.inventory?.gold ?? 0 },
                        { key: "ep" as const, color: "#34d399", amount: character.inventory?.ep ?? 0 },
                        { key: "sp" as const, color: "#94a3b8", amount: character.inventory?.sp ?? 0 },
                        { key: "cp" as const, color: "#f97316", amount: character.inventory?.cp ?? 0 },
                      ]).map(({ key, color, amount }) => (
                        <div key={key} style={{ display: "flex", alignItems: "baseline", gap: "2px", opacity: amount === 0 ? 0.4 : 1, cursor: "help" }}
                          onMouseEnter={e => showTooltip(
                            <div style={{ background: "#1a1730", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "7px", padding: "8px 11px", width: "170px", fontSize: fs(0.7), color: "#e2e8f0", lineHeight: 1.45, boxShadow: "0 4px 16px rgba(0,0,0,0.6)", whiteSpace: "normal" }}>
                              <div style={{ fontWeight: "bold", color, marginBottom: "2px", fontSize: fs(0.73) }}>{CURRENCY_INFO[key].name}</div>
                              <div style={{ color: "#94a3b8", fontSize: fs(0.68) }}>{CURRENCY_INFO[key].exchange}</div>
                            </div>, e)}
                          onMouseLeave={hideTooltip}
                        >
                          <span style={{ color, fontWeight: "bold" }}>{amount}</span>
                          <span style={{ color: "#64748b", fontSize: fs(0.72) }}>{key}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {[
                    ...(character.inventory?.weapons ?? []).map(w => ({ name: w, slot: "weapon" as const })),
                    ...(character.inventory?.items   ?? []).map(i => ({ name: i, slot: "item"   as const })),
                  ].map(({ name, slot }, idx) => {
                    const catalogItem: LootItem | undefined = getItemByName(name);
                    const dmMeta      = character.inventory?.item_meta?.[name];
                    const metaRarity  = dmMeta?.rarity ?? "common";
                    const rarityColor = catalogItem
                      ? RARITY_COLORS[catalogItem.rarity]
                      : dmMeta ? RARITY_COLORS[metaRarity] : "#475569";
                    const dmIconKey   = dmMeta?.type as keyof typeof ITEM_ICONS | undefined;
                    const icon        = catalogItem
                      ? ITEM_ICONS[catalogItem.type]
                      : dmIconKey && ITEM_ICONS[dmIconKey]
                        ? ITEM_ICONS[dmIconKey]
                        : (slot === "weapon" ? "⚔" : "🎒");
                    const isHovered   = hoveredItem === `${slot}-${idx}`;
                    const itemKey     = `${slot}-${idx}`;
                    return (
                      <div key={itemKey} style={{ marginBottom: "4px" }}>
                        <div style={{ position: "relative" }}>
                          <div
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: tradingItem?.name === name && tradingItem?.slot === slot ? "6px 6px 0 0" : "6px", fontSize: fs(0.82), border: `1px solid ${tradingItem?.name === name && tradingItem?.slot === slot ? "rgba(139,92,246,0.45)" : (catalogItem || dmMeta) ? rarityColor + "44" : "transparent"}`, cursor: "default", transition: "border-color 0.15s" }}
                            onMouseEnter={e => {
                              setHoveredItem(itemKey);
                              if (catalogItem) {
                                showTooltip(tipBoxNode(name, <>
                                    <div style={{ color: rarityColor, fontSize: "0.85em", fontWeight: "bold", marginBottom: "4px" }}>{RARITY_LABELS[catalogItem.rarity]}</div>
                                    <div style={{ color: "#94a3b8", marginBottom: catalogItem.effects.some(fx => fx.description) ? "5px" : 0 }}>{catalogItem.description}</div>
                                    {catalogItem.effects.map((fx, fi) => fx.description && <div key={fi} style={{ padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "2px", color: fx.description.startsWith("⚠️") ? "#ef4444" : "#c4b5fd", fontSize: "0.9em" }}>{fx.description}</div>)}
                                    {catalogItem.requiresAttunement && <div style={{ color: "#64748b", fontSize: "0.85em", marginTop: "4px" }}>Requires Attunement</div>}
                                  </>, rarityColor), e);
                              } else if (dmMeta) {
                                showTooltip(tipBoxNode(name, <>
                                    <div style={{ color: rarityColor, fontSize: "0.85em", fontWeight: "bold", marginBottom: "4px" }}>{RARITY_LABELS[metaRarity]}</div>
                                    <div style={{ color: "#94a3b8", marginBottom: (dmMeta.value_gp ?? 0) > 0 ? "5px" : 0 }}>{dmMeta.description || "An item awarded by the Dungeon Master."}</div>
                                    {(dmMeta.value_gp ?? 0) > 0 && (
                                      <div style={{ padding: "2px 6px", background: "rgba(251,191,36,0.08)", borderRadius: "4px", color: "#fbbf24", fontSize: "0.85em", fontWeight: "bold" }}>≈ {dmMeta.value_gp} gp</div>
                                    )}
                                  </>, rarityColor), e);
                              } else {
                                // Fuzzy resolver — handles "Rations (5 days)" → "Rations" and
                                // falls back to a generic inventory tip so every item gets a tooltip.
                                const fallback = resolveItemTip(name, WEAPON_TIPS, ITEM_TIPS);
                                showTooltip(tipBox(fallback.title, fallback.body), e);
                              }
                            }}
                            onMouseLeave={() => { setHoveredItem(null); hideTooltip(); }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
                              <span style={{ flexShrink: 0 }}>{icon}</span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: (catalogItem || dmMeta) ? rarityColor : "#e2e8f0" }}>{name}</div>
                                {catalogItem && (
                                  <div style={{ fontSize: fs(0.58), color: rarityColor, fontWeight: "bold", letterSpacing: "0.04em" }}>
                                    {RARITY_LABELS[catalogItem.rarity]}{catalogItem.requiresAttunement ? " · Attunement" : ""}{catalogItem.cursed ? " ⚠️" : ""}
                                  </div>
                                )}
                                {!catalogItem && dmMeta && (
                                  <div style={{ fontSize: fs(0.58), color: rarityColor, fontWeight: "bold", letterSpacing: "0.04em" }}>
                                    {RARITY_LABELS[metaRarity]}{(dmMeta.value_gp ?? 0) > 0 ? ` · ${dmMeta.value_gp} gp` : ""}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0, marginLeft: "6px" }}>
                              {/* Use button — always shown. Catalog consumables resolve mechanically
                                  (heals, etc.); everything else prefills the chat input with
                                  "I use my <item>." so the player can elaborate and let the DM narrate. */}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (catalogItem?.consumable) { handleUseItem(name); return; }
                                  const prefill = `I use my ${name}.`;
                                  setInput(prev => {
                                    const trimmed = prev.trim();
                                    return trimmed.length === 0 ? prefill : `${trimmed} ${prefill}`;
                                  });
                                  // Focus the chat input so the player can keep typing
                                  requestAnimationFrame(() => {
                                    const el = document.querySelector<HTMLInputElement>('input[data-chat-input]');
                                    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
                                  });
                                }}
                                title={catalogItem?.consumable ? `Use ${name} immediately` : `Send "I use my ${name}." to the DM`}
                                style={{ fontSize: fs(0.58), color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "4px", cursor: "pointer", padding: "2px 6px", fontWeight: "bold" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.25)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(34,197,94,0.12)"; }}
                              >Use</button>
                              {campaignParty.length > 1 && (
                                <button
                                  onClick={e => { e.stopPropagation(); setTradingItem(prev => prev?.name === name && prev?.slot === slot ? null : { name, slot }); }}
                                  title="Trade to another character"
                                  style={{ fontSize: fs(0.58), color: "#a78bfa", background: tradingItem?.name === name && tradingItem?.slot === slot ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "4px", cursor: "pointer", padding: "2px 6px", fontWeight: "bold" }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.25)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = tradingItem?.name === name && tradingItem?.slot === slot ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.08)"; }}
                                >Trade</button>
                              )}
                              <button
                                onClick={() => dropItem(name, slot)}
                                title="Drop to party pool"
                                style={{ fontSize: fs(0.58), color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#f59e0b"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; }}
                              >drop</button>
                            </div>
                          </div>
                          {/* Trade picker — character selector */}
                          {tradingItem?.name === name && tradingItem?.slot === slot && (
                            <div style={{ background: "rgba(20,14,40,0.97)", border: "1px solid rgba(139,92,246,0.45)", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "4px 0", zIndex: 10 }}>
                              <div style={{ padding: "4px 10px 4px", fontSize: fs(0.62), color: "#6d5a9c", letterSpacing: "0.06em", textTransform: "uppercase" }}>Send to</div>
                              {campaignParty.filter(c => c.id !== character?.id).map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => tradeItem(name, slot, c.id)}
                                  style={{ width: "100%", textAlign: "left", padding: "5px 10px", background: "none", border: "none", color: "#c4b5fd", fontSize: fs(0.78), cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.18)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                                >
                                  <span style={{ fontSize: fs(0.7) }}>{c.class === "Wizard" ? "🧙" : c.class === "Rogue" ? "🗡️" : c.class === "Cleric" ? "✝" : "⚔"}</span>
                                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                                  <span style={{ color: "#475569", fontSize: fs(0.65) }}>{c.class}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Party Leadership */}
                <div style={{ paddingTop: "4px", borderTop: "1px solid var(--border)" }}>
                  {isPartyLeader ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                        <span style={{ fontSize: fs(1), filter: "drop-shadow(0 0 5px rgba(251,191,36,0.8))" }}>👑</span>
                        <span style={{ fontSize: fs(0.78), fontWeight: "bold", color: "#fbbf24" }}>Party Leader</span>
                      </div>
                      {campaignParty.filter(c => c.id !== partyLeaderId).length > 0 && (
                        <div>
                          <p style={{ fontSize: fs(0.68), color: "#64748b", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Transfer Leadership</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                            {campaignParty.filter(c => c.id !== partyLeaderId).map(c => (
                              <button key={c.id} onClick={() => transferLeadership(c.id)}
                                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderRadius: "7px", border: "1px solid rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.04)", cursor: "pointer", transition: "all 0.15s", textAlign: "left" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(251,191,36,0.12)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.5)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(251,191,36,0.04)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.2)"; }}>
                                <span style={{ fontSize: fs(0.8) }}>👑</span>
                                <div>
                                  <div style={{ fontSize: fs(0.78), fontWeight: "bold", color: "#e2e8f0" }}>{c.name}</div>
                                  <div style={{ fontSize: fs(0.62), color: "#64748b" }}>{c.race} {c.class} · Make Leader</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : campaignParty.find(c => c.id === partyLeaderId) ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0" }}>
                      <span style={{ fontSize: fs(0.9), filter: "drop-shadow(0 0 4px rgba(251,191,36,0.6))" }}>👑</span>
                      <div>
                        <div style={{ fontSize: fs(0.72), color: "#fbbf24", fontWeight: "bold" }}>{campaignParty.find(c => c.id === partyLeaderId)!.name}</div>
                        <div style={{ fontSize: fs(0.62), color: "#64748b" }}>is leading the party</div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Rest */}
                <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
                  <button onClick={handleShortRest}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", fontSize: fs(0.75), fontWeight: "bold", border: "1px solid var(--border)", background: "rgba(245,158,11,0.1)", color: "#f59e0b", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.2)"; showTooltip(tipBox(MECHANIC_TIPS.SHORT_REST.title, MECHANIC_TIPS.SHORT_REST.body, "#f59e0b"), e); }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.1)"; hideTooltip(); }}>
                    🌙 Short Rest
                  </button>
                  <button onClick={handleLongRest}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", fontSize: fs(0.75), fontWeight: "bold", border: "1px solid var(--border)", background: "rgba(99,102,241,0.1)", color: "#818cf8", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.2)"; showTooltip(tipBox(MECHANIC_TIPS.LONG_REST.title, MECHANIC_TIPS.LONG_REST.body, "#818cf8"), e); }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.1)"; hideTooltip(); }}>
                    ☀️ Long Rest
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "40px", fontSize: fs(0.9) }}>Loading character...</div>
            )}
              </>
            )}
          </div>
        )}

        {/* ── Story Log tab ── */}
        {sidebarTab === "log" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: fs(0.78), color: "#64748b" }}>{logEntries.length} entries</span>
              <button onClick={() => exportLog(logEntries, params.id)} disabled={logEntries.length === 0}
                style={{ padding: "5px 12px", borderRadius: "6px", fontSize: fs(0.75), border: "1px solid var(--border)", background: "transparent", color: logEntries.length === 0 ? "#475569" : "#94a3b8", cursor: logEntries.length === 0 ? "default" : "pointer", transition: "color 0.15s, border-color 0.15s" }}
                onMouseEnter={e => { if (logEntries.length > 0) { e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "var(--primary)"; }}}
                onMouseLeave={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                ↓ Export .md
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {logEntries.length === 0 && <p style={{ color: "#475569", fontSize: fs(0.85), textAlign: "center", marginTop: "40px" }}>No events yet. Start adventuring!</p>}
              {logEntries.map(entry => {
                const time     = entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const isDM     = entry.role === "dm";
                const isPlayer = entry.role === "player";
                return (
                  <div key={entry.id} style={{ padding: "9px 12px", borderRadius: "8px", borderLeft: `3px solid ${isDM ? "#8b5cf6" : isPlayer ? "#0ea5e9" : "#475569"}`, background: isDM ? "rgba(139,92,246,0.08)" : isPlayer ? "rgba(14,165,233,0.08)" : "rgba(0,0,0,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: fs(0.68), fontWeight: "bold", color: isDM ? "#a78bfa" : isPlayer ? "#38bdf8" : "#64748b" }}>
                        {isDM ? "DM" : entry.role === "system" ? "System" : (entry.sender ?? "Player")}
                      </span>
                      <span style={{ fontSize: fs(0.65), color: "#475569" }}>{time}</span>
                    </div>
                    <p style={{ fontSize: fs(0.78), color: entry.role === "system" ? "#94a3b8" : "#cbd5e1", lineHeight: 1.45, margin: 0 }}>
                      {entry.content.length > 180 ? entry.content.slice(0, 180) + "…" : entry.content}
                    </p>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* ── Combat tab ── */}
        {sidebarTab === "combat" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ⚔ Enemies {combatActive && enemies.some(e => !e.is_defeated) ? `(${enemies.filter(e => !e.is_defeated).length} active)` : "(combat ended)"}
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {enemies.map(e => {
                const cond      = e.condition ?? "healthy";
                const color     = CONDITION_COLORS[cond];
                const pct       = CONDITION_PCT[cond];
                const label     = CONDITION_LABELS[cond];
                const isTargeted = !e.is_defeated && targetedEnemyId === e.id;
                return (
                  <div key={e.id}
                    onClick={() => { if (!e.is_defeated) setTargetedEnemyId(prev => prev === e.id ? null : e.id); }}
                    style={{
                      padding: "12px 14px", borderRadius: "10px",
                      background: e.is_defeated ? "rgba(0,0,0,0.15)" : isTargeted ? "rgba(120,0,0,0.55)" : "rgba(60,0,0,0.45)",
                      border: `1.5px solid ${e.is_defeated ? "rgba(255,255,255,0.05)" : isTargeted ? "rgba(239,68,68,0.85)" : "rgba(239,68,68,0.35)"}`,
                      opacity: e.is_defeated ? 0.45 : 1, transition: "all 0.4s ease",
                      cursor: e.is_defeated ? "default" : "pointer",
                      animation: isTargeted ? "targetedEnemy 1.6s ease-in-out infinite" : "none",
                    }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                      {e.portrait_url ? (
                        <div style={{ width: "48px", height: "48px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, filter: e.is_defeated ? "grayscale(1)" : "none", border: isTargeted ? "2px solid rgba(239,68,68,0.7)" : "2px solid transparent", transition: "border-color 0.3s" }}>
                          <img src={e.portrait_url} alt={e.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : (
                        <span style={{ fontSize: "1.7rem", lineHeight: 1, filter: e.is_defeated ? "grayscale(1)" : "none" }}>
                          {e.portrait_emoji}
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: "bold", fontSize: "0.88rem", color: e.is_defeated ? "#6b7280" : "#fca5a5", textDecoration: e.is_defeated ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {e.name}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                          {e.enemy_type} · <span style={{ cursor: "help" }}
                            onMouseEnter={ev => showTooltip(tipBox(MECHANIC_TIPS.CR.title, MECHANIC_TIPS.CR.body, "#f59e0b"), ev)}
                            onMouseLeave={hideTooltip}>CR {e.cr}</span> · <span style={{ cursor: "help" }}
                            onMouseEnter={ev => showTooltip(tipBox(MECHANIC_TIPS.AC.title, MECHANIC_TIPS.AC.body, "#94a3b8"), ev)}
                            onMouseLeave={hideTooltip}>AC {e.ac}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end", flexShrink: 0 }}>
                        {e.is_defeated
                          ? <span style={{ fontSize: "0.6rem", background: "#1f2937", color: "#6b7280", borderRadius: "4px", padding: "2px 6px", cursor: "help" }}
                              onMouseEnter={ev => showTooltip(tipBox("Defeated", ENEMY_CONDITION_TIPS.Defeated, "#6b7280"), ev)}
                              onMouseLeave={hideTooltip}>DEFEATED</span>
                          : <span style={{ fontSize: "0.6rem", background: `${color}22`, color, borderRadius: "4px", padding: "2px 6px", fontWeight: "bold", cursor: "help" }}
                              onMouseEnter={ev => { const desc = ENEMY_CONDITION_TIPS[label]; showTooltip(tipBox(label, desc ?? "", color), ev); }}
                              onMouseLeave={hideTooltip}>{label}</span>
                        }
                        {isTargeted && (
                          <span style={{ fontSize: "0.58rem", background: "rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: "4px", padding: "2px 6px", fontWeight: "bold", letterSpacing: "0.04em", cursor: "help" }}
                            onMouseEnter={ev => showTooltip(tipBox(MECHANIC_TIPS.TARGET_ENEMY.title, MECHANIC_TIPS.TARGET_ENEMY.body, "#ef4444"), ev)}
                            onMouseLeave={hideTooltip}>⚔ TARGET</span>
                        )}
                      </div>
                    </div>

                    {/* Condition bar — shows health state, not exact HP */}
                    {!e.is_defeated && (
                      <>
                        <div style={{ width: "100%", height: "5px", background: "#1f2937", borderRadius: "3px", overflow: "hidden", marginBottom: "5px" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "3px", transition: "width 0.6s ease, background 0.4s ease" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.65rem", color: "#64748b", cursor: "help" }}
                          onMouseEnter={ev => showTooltip(tipBox("Attack & Damage", `ATK +${e.attack_bonus} is added to a d20 roll to hit. On a hit, ${e.damage_dice} is rolled for damage dealt to HP.`, "#ef4444"), ev)}
                          onMouseLeave={hideTooltip}>ATK +{e.attack_bonus} · {e.damage_dice}</span>
                          {e.status_effects.length > 0 && (
                            <span style={{ fontSize: "0.62rem", color: "#f59e0b" }}>{e.status_effects.join(", ")}</span>
                          )}
                        </div>
                        {e.abilities.length > 0 && (
                          <div style={{ marginTop: "5px", fontSize: "0.65rem", color: "#475569" }}>
                            ⚡ {e.abilities.join(" · ")}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {enemies.length === 0 && (
                <p style={{ color: "#475569", fontSize: "0.85rem", textAlign: "center", marginTop: "40px" }}>
                  No enemies in the area.
                </p>
              )}
            </div>
          </div>
        )}
        </div>{/* end dmBusy lock wrapper */}
      </div>


      {/* Persistent audio elements — no display:none; Xbox Edge can refuse play()
          permission to hidden elements. Positioned off-screen instead. */}
      <audio ref={narAudioRef}     preload="none" style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }} />
      <audio ref={previewAudioRef} preload="none" style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }} />

      {/* Portrait lightbox */}
      {typeof window !== "undefined" && portraitModal && createPortal(
        <div
          onClick={() => setPortraitModal(null)}
          style={{ position: "fixed", inset: 0, zIndex: 99998, background: "rgba(3,2,12,0.93)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", cursor: "pointer" }}
        >
          {/* Close button */}
          <button
            onClick={() => setPortraitModal(null)}
            style={{ position: "absolute", top: "20px", right: "24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8", fontSize: "1rem", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#94a3b8"; }}
          >✕</button>

          {/* Portrait + name card */}
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "22px" }}>
            <div style={{
              width: "min(400px, 82vw)", aspectRatio: "3/4",
              borderRadius: "18px", overflow: "hidden",
              border: `3px solid ${CLASS_COLORS[portraitModal.cls] ?? "#8b5cf6"}`,
              boxShadow: `0 0 60px ${CLASS_COLORS[portraitModal.cls] ?? "#8b5cf6"}55, 0 0 140px ${CLASS_COLORS[portraitModal.cls] ?? "#8b5cf6"}25, inset 0 0 0 1px rgba(255,255,255,0.06)`,
              animation: "fadeInScale 0.28s ease-out forwards",
            }}>
              <img src={portraitModal.url} alt={portraitModal.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(1.5rem, 4vw, 2.1rem)", fontWeight: "bold", color: CLASS_COLORS[portraitModal.cls] ?? "white", letterSpacing: "0.04em", textShadow: `0 0 28px ${CLASS_COLORS[portraitModal.cls] ?? "#8b5cf6"}88` }}>
                {portraitModal.name}
              </div>
              {portraitModal.subtitle && (
                <div style={{ color: "#94a3b8", fontSize: "1rem", marginTop: "5px", letterSpacing: "0.03em" }}>{portraitModal.subtitle}</div>
              )}
            </div>
          </div>
          <p style={{ position: "absolute", bottom: "20px", color: "#334155", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>Click anywhere to close</p>
        </div>,
        document.body
      )}

      {/* Backstory storybook modal */}
      {showBackstory && character && typeof window !== "undefined" && createPortal(
        <div onClick={() => setShowBackstory(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, padding: "20px" }}>
          <div onClick={e => e.stopPropagation()} className="animate-fade-in" style={{ width: "100%", maxWidth: "520px", background: "linear-gradient(160deg, #1e140a 0%, #140e05 60%, #1a100a 100%)", border: "2px solid rgba(180,140,70,0.5)", borderRadius: "14px", padding: "40px 36px", position: "relative", boxShadow: "0 0 80px rgba(120,80,20,0.3), 0 24px 64px rgba(0,0,0,0.85), inset 0 0 40px rgba(100,60,10,0.1)", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ position: "absolute", top: "12px", left: "16px", color: "rgba(180,140,70,0.45)", fontSize: "0.9rem", lineHeight: 1, pointerEvents: "none" }}>✦</div>
            <div style={{ position: "absolute", top: "12px", right: "16px", color: "rgba(180,140,70,0.45)", fontSize: "0.9rem", lineHeight: 1, pointerEvents: "none" }}>✦</div>
            <div style={{ position: "absolute", bottom: "12px", left: "16px", color: "rgba(180,140,70,0.45)", fontSize: "0.9rem", lineHeight: 1, pointerEvents: "none" }}>✦</div>
            <div style={{ position: "absolute", bottom: "12px", right: "16px", color: "rgba(180,140,70,0.45)", fontSize: "0.9rem", lineHeight: 1, pointerEvents: "none" }}>✦</div>
            <button onClick={() => setShowBackstory(false)} style={{ position: "absolute", top: "14px", right: "40px", background: "none", border: "none", color: "rgba(180,140,70,0.6)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "4px" }}>✕</button>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{ fontSize: "0.62rem", color: "rgba(180,140,70,0.65)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}>The Chronicles of</div>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#d4a96a", fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "0.02em" }}>{character.name}</div>
              {character.title && <div style={{ fontSize: "0.9rem", color: "rgba(212,169,106,0.65)", marginTop: "5px", fontStyle: "italic", fontFamily: "Georgia, serif" }}>&ldquo;{character.title}&rdquo;</div>}
              <div style={{ fontSize: "0.75rem", color: "rgba(180,140,70,0.45)", marginTop: "4px" }}>{character.race} {character.class} · Level {character.level}</div>
              <div style={{ width: "80px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(180,140,70,0.5), transparent)", margin: "14px auto 0" }} />
            </div>
            <div style={{ fontSize: "0.9rem", color: "#c4a882", lineHeight: 1.9, fontFamily: "Georgia, 'Times New Roman', serif", textAlign: "justify" }}>
              {character.background?.trim()
                ? character.background
                : <span style={{ color: "rgba(180,140,70,0.4)", fontStyle: "italic" }}>This character&apos;s story has just begun…</span>
              }
            </div>
            <div style={{ textAlign: "center", marginTop: "24px", fontSize: "0.62rem", color: "rgba(180,140,70,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>click outside to close</div>
          </div>
        </div>,
        document.body
      )}

      {/* Global tooltip portal — always on top of everything */}
      <TooltipPortal tip={globalTooltip} />

      {/* First-time hint arrow — pulsing green attention pointer.
          Rendered as a portal so it can sit outside the chat panel's
          overflow:hidden box. Gated on `sessionStarted` so it never
          appears during the campaign loading screen — only after the
          narrator UI has actually surfaced. Hides instantly when
          `showChatHint` flips to false (the player clicks "Got it"). */}
      <ChatHintArrow show={showChatHint && sessionStarted} hintRef={chatHintRef} />

      <style>{`
        @keyframes blink  { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 0.75; } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes streamFadeIn { from { opacity: 0; filter: blur(3px); transform: translateY(3px); } to { opacity: 1; filter: blur(0); transform: translateY(0); } }
        @keyframes dicePulse { from { transform: scale(1); box-shadow: 0 0 10px rgba(251,191,36,0.4), 0 0 20px rgba(251,191,36,0.15); } to { transform: scale(1.1); box-shadow: 0 0 22px rgba(251,191,36,0.75), 0 0 44px rgba(251,191,36,0.3); } }
        @keyframes hintArrowPulse {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            filter: drop-shadow(0 0 10px rgba(34,197,94,0.85)) drop-shadow(0 0 22px rgba(34,197,94,0.45));
          }
          50% {
            transform: translate(10px, 0) scale(1.12);
            filter: drop-shadow(0 0 18px rgba(74,222,128,1)) drop-shadow(0 0 44px rgba(34,197,94,0.7)) drop-shadow(0 0 70px rgba(34,197,94,0.35));
          }
        }
      `}</style>
    </main>
  );
}
