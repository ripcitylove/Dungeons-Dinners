"use client";

import React, { useState, useEffect, useRef, use, useCallback, useMemo } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import "../../globals.css";
import DiceRoller, { D20Icon } from "../../../components/DiceRoller";
import type { StateChange } from "../../api/chat-state/route";
import { getXpToNextLevel, SPELLCASTING_CLASSES, getSpellSlots, computeAC, CLASS_STAT_GUIDES, getTierStyle, CANTRIPS, LEVEL1_SPELLS, getSpellLevel } from "../../../lib/spellData";
import {
  getItemByName, computeInventoryBonuses, getEffectiveStat, rollDiceFormula,
  buildItemEffectsSummary, RARITY_COLORS, RARITY_LABELS, ITEM_ICONS,
  type LootItem,
} from "../../../lib/lootData";
import { tipBox, tipBoxNode, TooltipPortal } from "../../../hooks/useTooltip";
import { MECHANIC_TIPS, ENEMY_CONDITION_TIPS, WEAPON_TIPS, ITEM_TIPS } from "../../../lib/tooltipData";
import { CLASS_RESOURCES, SHORT_REST_RESET_KEYS, getBardicInspirationDie, getSneakAttackDice, getWildShapeCR, getRageDamageBonus } from "../../../lib/classFeatures";
import { STATUS_EFFECTS, parseStatusEffect, getDominantEffect, getCardEffectGlow } from "../../../lib/statusEffects";

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
type DroppedItem   = { id: string; name: string; type: "item" | "weapon"; fromCharacter: string; fromUserId: string };

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
  inventory: { gold: number; cp?: number; sp?: number; ep?: number; pp?: number; weapons: string[]; items: string[] };
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
    body: "The AI is your Dungeon Master. It narrates the world, runs enemies, hands out loot, and responds to every action you take. No human DM needed — just type and play.",
    tip: "You don't need to know D&D 5e rules. The DM handles all mechanics automatically.",
  },
  {
    icon: "💬",
    title: "Type Your Actions",
    body: "Read the DM's narration in the center panel, then describe your action in the text box at the bottom. Be specific and in-character for the best results.",
    tip: "Try: \"I kick open the door and charge in with my sword raised\" instead of just \"I attack.\"",
    diagram: "chat" as const,
  },
  {
    icon: "⚔️",
    title: "Turns & The Party Panel",
    body: "In multiplayer, everyone takes turns in order. The left panel shows your party — the card glowing purple is the active player. Your text box unlocks when it's your turn.",
    tip: "Playing solo? The input is always active — no waiting.",
    diagram: "party" as const,
  },
  {
    icon: "🎲",
    title: "Rolling Dice",
    body: "The DM asks you to roll at key moments — attacks, saving throws, skill checks. Click the 🎲 button in the header or press D. Your result goes straight to the DM.",
    tip: "The DM specifies the die and the difficulty — just roll and report what you get.",
    diagram: "dice" as const,
  },
  {
    icon: "📋",
    title: "Your Character Sheet",
    body: "Click the Sheet tab on the right sidebar to see your stats, spells, inventory, and HP. Hover any stat for a plain-English description. Click a spell or item to use it in the story.",
    tip: "The Party tab shows every adventurer and their HP in real time.",
    diagram: "sheet" as const,
  },
  {
    icon: "🔊",
    title: "Narration & Music",
    body: "Click 🔊 in the header to enable AI voice narration — the DM speaks the story aloud. The music player (bottom-right) sets the atmosphere. Both work great on TV and console!",
    tip: "Match the music to the scene: swap between combat, exploration, or tavern tracks.",
    diagram: "audio" as const,
  },
  {
    icon: "✨",
    title: "Begin Your Adventure",
    body: "The DM will open your campaign with an immersive scene. Read it, then type your first action. The world responds to everything you do — make it count.",
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

/** Parses [HP:FirstName:N] tags from DM text for the named character. Returns HP delta (negative = damage, positive = healing). */
function parseHpTag(text: string, firstName: string): number {
  const n = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[HP:${n}:([+-]?\\d+)\\]`, "gi");
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) total += parseInt(m[1], 10);
  return total;
}

// Detect which player the DM is addressing at the end of a response.
// Returns the matching full name from partyNames, or null.
function detectNextTurnPlayer(text: string, partyNames: string[]): string | null {
  const tail = text.slice(-280);
  let lastMatch: { idx: number; name: string } | null = null;
  for (const fullName of partyNames) {
    const firstName = fullName.split(" ")[0];
    if (firstName.length < 2) continue;
    const esc = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // "[Name], what do you do?" or "your move, [Name]?" or any call-to-action addressed to Name
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

function RevealText({ text, onComplete, intervalMs = 50 }: { text: string; onComplete?: () => void; intervalMs?: number }) {
  const [groups, setGroups] = React.useState<Array<{ id: number; chars: string }>>([]);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    setGroups([]);
    if (!text) return;
    let pos = 0;
    let gid = 0;
    const interval = setInterval(() => {
      if (pos >= text.length) { clearInterval(interval); onCompleteRef.current?.(); return; }
      // Grab one char plus any trailing whitespace so spaces don't each get their own span
      let chunk = text[pos++];
      while (pos < text.length && /\s/.test(text[pos]) && chunk.length < 4) chunk += text[pos++];
      setGroups(prev => [...prev, { id: gid++, chars: chunk }]);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [text]);

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

function ColorizedText({ text, playerColors = {}, onShowTooltip, onHideTooltip }: {
  text: string;
  playerColors?: Record<string, string>;
  onShowTooltip?: (content: React.ReactNode, e: React.MouseEvent) => void;
  onHideTooltip?: () => void;
}) {
  type Seg = { start: number; end: number; color: string; tooltip?: string; richTooltip?: { title: string; body: string; accent: string } };
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
    const hasInteraction = !!(seg.tooltip || seg.richTooltip);
    out.push(
      <span
        key={seg.start}
        title={seg.richTooltip ? undefined : seg.tooltip}
        onMouseEnter={seg.richTooltip && onShowTooltip ? (e => onShowTooltip(tipBox(seg.richTooltip!.title, seg.richTooltip!.body, seg.richTooltip!.accent), e)) : undefined}
        onMouseLeave={seg.richTooltip && onHideTooltip ? onHideTooltip : undefined}
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
  // Narration-synced reveal: text waits here until audio duration is known, then types at voice pace
  const [narRevealText,       setNarRevealText]       = useState<string | null>(null);
  const [narRevealIntervalMs, setNarRevealIntervalMs] = useState<number | null>(null);
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
  const [enemies,          setEnemies]           = useState<CampaignEnemy[]>([]);
  const [combatActive,     setCombatActive]      = useState(false);

  // Narration
  const [narrationEnabled, setNarrationEnabled]  = useState(true);
  const [toastMsg,         setToastMsg]          = useState<string | null>(null);
  const [narrating,        setNarrating]         = useState(false);
  const [selectedVoice,    setSelectedVoice]     = useState<string>("bard");
  const [voicePickerOpen,  setVoicePickerOpen]   = useState(false);
  const [testingVoice,     setTestingVoice]      = useState<string | null>(null);
  const [narVolume,        setNarVolume]         = useState<number>(() => parseFloat(localStorage.getItem("dnd_nar_volume") ?? "1"));
  const [narMuted,         setNarMuted]          = useState<boolean>(() => localStorage.getItem("dnd_nar_muted") === "1");
  const narVolumeRef = useRef<number>(1);
  const narMutedRef  = useRef<boolean>(false);
  const [passTurnOpen,     setPassTurnOpen]      = useState(false);
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
  const [chatPaneWidth, setChatPaneWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const v = parseInt(localStorage.getItem("dnd_chat_pane_w") ?? "");
      if (!isNaN(v) && v >= 280 && v <= 700) return v;
    }
    return 380;
  });
  const [sidebarPaneWidth, setSidebarPaneWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const v = parseInt(localStorage.getItem("dnd_sidebar_pane_w") ?? "");
      if (!isNaN(v) && v >= 200 && v <= 480) return v;
    }
    return 270;
  });
  const dragRef = useRef<{ which: "chat" | "sidebar"; startX: number; startW: number } | null>(null);

  const chatWidthRatio    = Math.max(0.85, Math.min(1.45, chatPaneWidth / 380));
  const sidebarWidthRatio = Math.max(0.85, Math.min(1.5,  sidebarPaneWidth / 270));
  // fs() scales sidebar fonts with A-/A+ control AND sidebar drag width
  const fs  = (base: number) => `${(base * chatFontSize / 0.9 * sidebarWidthRatio).toFixed(2)}rem`;
  // chatFontPx scales chat message text with A-/A+ control AND chat drag width
  const chatMsgSize = `${(chatFontSize * chatWidthRatio).toFixed(2)}rem`;

  // Portrait lightbox
  const [portraitModal, setPortraitModal] = useState<{ name: string; cls: string; url: string; subtitle?: string } | null>(null);
  const [showBackstory, setShowBackstory] = useState(false);

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
  const [partyLeaderId,    setPartyLeaderId]       = useState<string | null>(null);

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
  const autoScrollRafRef     = useRef<number | null>(null);
  const narSlot0TextRef      = useRef<string | null>(null); // first narration sentence, used to compute speech rate
  const logEndRef            = useRef<HTMLDivElement>(null);
  const abortRef             = useRef<AbortController | null>(null);
  const characterRef         = useRef<Character | null>(null);
  const channelRef           = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef            = useRef<string | null>(null);
  const narAudioRef          = useRef<HTMLAudioElement | null>(null);
  const audioPlayingRef      = useRef(false);
  const messagesRef          = useRef<Message[]>(OPENING_MESSAGES);
  const isTypingRef          = useRef(false);
  const narrationEnabledRef  = useRef(false);
  const turnOrderRef              = useRef<string[]>([]);
  const currentTurnIndexRef       = useRef(0);
  const restoredTurnStateRef      = useRef<{ order: string[]; index: number } | null>(null);
  const currentSceneRef        = useRef<string>("");
  const enemiesRef             = useRef<CampaignEnemy[]>([]);
  const rollRequestedUserIdRef = useRef<string | null>(null);
  const isGroupCheckRollRef    = useRef(false);
  const resumeNarrationRef        = useRef<string>("");
  const resumeCurrentPlayerIdRef = useRef<string | null>(null);
  const autoOpenedRef             = useRef(false);
  // Ordered narration slot system — ensures sentences always play in the order they were sent
  const narSlotCounterRef    = useRef(0);
  const narSlotsRef          = useRef<(string | "SKIP" | null)[]>([]);
  const narPlaySlotRef       = useRef(0);
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

  // Close pass-turn submenu whenever the turn moves
  useEffect(() => { setPassTurnOpen(false); }, [currentTurnIndex]);

  // Persist turn state to DB whenever it changes so campaigns resume at the right position
  useEffect(() => {
    if (!turnOrder.length || !params.id) return;
    supabase.from("campaigns")
      .update({ turn_order: turnOrder, current_turn_index: currentTurnIndex })
      .eq("id", params.id)
      .then(() => {});
  }, [turnOrder, currentTurnIndex, params.id]);

  // ── Per-campaign state write helper ──────────────────────────────────────────
  // Routes to campaign_characters when using the CC table, otherwise characters.
  const charWrite = useCallback(async (charId: string, fields: Record<string, unknown>) => {
    if (usesCCTableRef.current) {
      await supabase.from("campaign_characters").update(fields).eq("campaign_id", params.id).eq("character_id", charId);
    } else {
      await supabase.from("characters").update(fields).eq("id", charId);
    }
  }, [params.id]);
  useEffect(() => { charWriteRef.current = charWrite; }, [charWrite]);

  useEffect(() => {
    const done = localStorage.getItem("dnd_campaign_tutorial_done");
    if (!done) {
      const t = setTimeout(() => setTutorialStep(0), 1400);
      return () => clearTimeout(t);
    }
  }, []);

  // Build turn order from campaign party — prefer DB-restored state on resume, fall back to alphabetical
  useEffect(() => {
    if (!campaignParty.length) return;
    const partyIds = new Set(campaignParty.map(c => c.id));
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
    } else {
      finalOrder = [...campaignParty].sort((a, b) => a.name.localeCompare(b.name)).map(c => c.id);
      finalIndex = 0;
    }
    turnOrderRef.current = finalOrder;
    setTurnOrder(finalOrder);
    setCurrentTurnIndex(finalIndex);
    currentTurnIndexRef.current = finalIndex;
    // Suggestions are handled by the unified suggestion guarantee effect below
  }, [campaignParty.length]);

  // When the active character index changes, sync the character sheet
  useEffect(() => {
    if (campaignParty.length === 0) return;
    const c = campaignParty[Math.min(activeCharIdx, campaignParty.length - 1)];
    if (c && c.id !== characterRef.current?.id) {
      setCharacter(c);
      characterRef.current = c;
    }
  }, [activeCharIdx, campaignParty]);

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
            return {
              ...char,
              hp: cc.hp, max_hp: cc.max_hp, xp: cc.xp, level: cc.level,
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
        // Clamp HP to effective max (base + item bonuses) — never raw max_hp alone
        const normalizedParty = party.map(c => {
          const ib = computeInventoryBonuses(c.inventory?.items ?? [], c.inventory?.weapons ?? []);
          const effectiveMax = c.max_hp + ib.hpMaxAdd;
          return c.hp > effectiveMax ? { ...c, hp: effectiveMax } : c;
        });
        if (normalizedParty.some((c, i) => c.hp !== party[i].hp)) {
          normalizedParty.forEach(c => {
            if (c.hp !== party.find(p => p.id === c.id)?.hp) {
              if (usesCCTableRef.current) {
                supabase.from("campaign_characters").update({ hp: c.hp }).eq("campaign_id", params.id).eq("character_id", c.id).then(() => {});
              } else {
                supabase.from("characters").update({ hp: c.hp }).eq("id", c.id).then(() => {});
              }
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

        // Auto-assign party leader to first character if unset — only campaign owner does this to avoid races
        if (!loadedLeaderCharId && user.id === campRes.data?.user_id) {
          const firstCharId = party[0].id;
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
        // New campaign — DM will narrate the opening scene when the session starts
        setMessages(OPENING_MESSAGES);
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
        setLogEntries(prev => [...prev, { id: `rt-${Date.now()}`, timestamp: new Date(), role: "player", sender: payload.characterName, content: payload.content }]);
        // Track this player's action for round reconciliation
        if (payload.characterId && !roundActionsRef.current.some(a => a.characterId === payload.characterId)) {
          const updated: RoundAction[] = [...roundActionsRef.current, { characterId: payload.characterId as string, name: (payload.characterName as string) ?? "Unknown", action: payload.content as string }];
          roundActionsRef.current = updated;
          setRoundActions(updated);
        }
      })
      .on("broadcast", { event: "dm_response" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        setIsTyping(false); setStreamingContent("");
        setMessages(prev => [...prev, { role: "dm", content: payload.content }]);
        setLogEntries(prev => [...prev, { id: `rt-${Date.now()}`, timestamp: new Date(), role: "dm", content: payload.content }]);
        const rollTarget = detectDiceRollTarget(payload.content as string);
        const dmRollMode = rollTarget ? detectRollMode(payload.content as string) : "normal";
        setDiceRollTarget(rollTarget);
        setRequiredDiceType(detectRequiredDiceType(payload.content as string));
        setRequiredRollMode(dmRollMode !== "normal" ? dmRollMode : null);
        // Restore the acting character so applyStateChange can gate correctly
        prevActingCharIdRef.current = (payload.actingCharId as string | null) ?? null;
        // Fast HP detection — apply HP change to this player's own character immediately.
        if (pendingHpDeltaRef.current === 0) {
          const myChar = characterRef.current;
          if (myChar) {
            const firstName = myChar.name.split(" ")[0];
            const hpDelta = parseHpTag(payload.content as string, firstName);
            if (hpDelta !== 0) {
              const ib = computeInventoryBonuses(myChar.inventory?.items ?? [], myChar.inventory?.weapons ?? []);
              const newHp = Math.max(0, Math.min(myChar.max_hp + ib.hpMaxAdd, myChar.hp + hpDelta));
              const fastChar = { ...myChar, hp: newHp };
              setCharacter(fastChar);
              setCampaignParty(prev => prev.map(c => c.id === myChar.id ? { ...c, hp: newHp } : c));
              characterRef.current = fastChar;
              campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === myChar.id ? { ...c, hp: newHp } : c);
              pendingHpDeltaRef.current = hpDelta;
              charWriteRef.current?.(myChar.id, { hp: newHp });
              channelRef.current?.send({ type: "broadcast", event: "character_sync", payload: { charId: myChar.id, hp: newHp } });
            }
          }
        }
        // roll_request broadcast syncs the turn — no need to re-derive userId here
        fetch("/api/chat-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: payload.content }) })
          .then(r => r.json()).then((change: StateChange) => applyStateChange(change)).catch(() => {});
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
          fetch("/api/suggest-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dmResponse: payload.content, character: characterRef.current }) })
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
        setCurrentTurnIndex(payload.newIndex);
        currentTurnIndexRef.current = payload.newIndex;
        // Focus the party panel on the newly active character
        if (campaignPartyRef.current.length > 1) {
          const turnCharId = turnOrderRef.current[payload.newIndex];
          const turnPartyIdx = campaignPartyRef.current.findIndex(c => c.id === turnCharId);
          if (turnPartyIdx >= 0) setActiveCharIdx(turnPartyIdx);
        }
        // Generate suggestions if the turn just landed on this player
        const order = turnOrderRef.current;
        const isNowMyTurn = order.length <= 1 || order[payload.newIndex] === characterRef.current?.id;
        if (isNowMyTurn && characterRef.current) {
          const lastDmMsg = [...messagesRef.current].reverse().find(m => m.role === "dm");
          if (lastDmMsg) {
            fetch("/api/suggest-actions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dmResponse: lastDmMsg.content, character: characterRef.current }),
            }).then(r => r.json()).then(({ suggestions: s }) => setSuggestions(s ?? [])).catch(() => {});
          }
        }
      })
      .on("broadcast", { event: "turn_order_swap" }, ({ payload }) => {
        if (payload.userId === userIdRef.current) return;
        const newOrder = payload.newOrder as string[];
        const newIndex = payload.newIndex as number;
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
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel); channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, params.id]);

  // RAF auto-scroll — runs continuously while the DM is narrating so the chat
  // drifts down at a pace that matches text arrival rather than jumping.
  useEffect(() => {
    const active = isTyping || !!streamingContent || !!openingRevealText || !!narRevealText;
    if (!active) {
      if (autoScrollRafRef.current) { cancelAnimationFrame(autoScrollRafRef.current); autoScrollRafRef.current = null; }
      return;
    }
    let rafId: number;
    const tick = () => {
      const el = msgContainerRef.current;
      if (el) {
        const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (remaining > 1) {
          // Ease toward bottom: gentle when close, faster when behind — capped so it never feels like a snap
          el.scrollTop += Math.max(0.8, Math.min(remaining * 0.055, 7));
        }
      }
      rafId = requestAnimationFrame(tick);
      autoScrollRafRef.current = rafId;
    };
    rafId = requestAnimationFrame(tick);
    autoScrollRafRef.current = rafId;
    return () => { cancelAnimationFrame(rafId); autoScrollRafRef.current = null; };
  }, [isTyping, streamingContent, openingRevealText, narRevealText]);

  // Instant snap to bottom when a new non-streaming message lands or suggestions change
  useEffect(() => {
    if (isTyping || streamingContent || openingRevealText || narRevealText) return;
    const el = msgContainerRef.current;
    if (!el) return;
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 60);
    return () => clearTimeout(t);
  }, [messages, suggestions, isTyping, streamingContent, openingRevealText, narRevealText]);

  // Fallback: if narRevealText is set but audio never fires canplaythrough (quota, error, disabled mid-flight),
  // unblock the reveal after 1.5 s so text is never permanently stuck.
  useEffect(() => {
    if (!narRevealText || narRevealIntervalMs !== null) return;
    const t = setTimeout(() => setNarRevealIntervalMs(52), 1500);
    return () => clearTimeout(t);
  }, [narRevealText, narRevealIntervalMs]);

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
      body: JSON.stringify({ dmResponse: lastDm.content, character: char }),
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

  const applyStateChange = useCallback(async (change: StateChange) => {
    const char = characterRef.current;
    console.log("[applyStateChange] called", { char: char?.name ?? "NULL", change });
    if (!char) return;

    // Determine if this character was the acting character for this DM response.
    // prevActingCharIdRef is set in handleSend (before turn advance) and synced via dm_response broadcast.
    const wasPrevActingChar = char.id === prevActingCharIdRef.current;
    // Fallback: solo play only — in multiplayer the turn advances BEFORE the DM responds, so
    // isCurrentTurnChar would wrongly flag the NEXT player as the acting char.
    const isCurrentTurnChar = turnOrderRef.current.length <= 1;
    const isActingChar = wasPrevActingChar || isCurrentTurnChar;
    console.log("[applyStateChange] acting", { wasPrevActingChar, isCurrentTurnChar, isActingChar, prevActingCharId: prevActingCharIdRef.current, charId: char.id, turnLen: turnOrderRef.current.length });

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
    // Fast detection already applied this HP delta — skip to prevent double-counting.
    if (change.hp_delta !== 0 && pendingHpDeltaRef.current !== 0) {
      change = { ...change, hp_delta: 0 };
    }
    pendingHpDeltaRef.current = 0; // always clear after deciding
    console.log("[applyStateChange] hp_delta", change.hp_delta, "isEffectiveTarget", isEffectiveTarget, "target_name", change.target_name);

    // Spell slots: ONLY the acting character (the caster) consumes slots.
    // Observers learn about other players' slot changes via character_sync broadcast from the caster's client.
    // Never gate on target_name — the target of healing is not the caster.
    const shouldApplySlots = isActingChar;
    // Check pending UI spell cast BEFORE hasChange so stuck pendingSpellCastRef always gets cleared.
    const hadPendingCast = pendingSpellCastRef.current > 0;

    const hasChange =
      change.hp_delta !== 0 ||
      (change.spell_slots_used > 0 && (shouldApplySlots || hadPendingCast)) ||
      (isActingChar && hadPendingCast) || // always clear stuck pending cast on the acting char
      (isExplicitTarget && (change.gold_delta !== 0 || change.items_gained.length > 0 ||
        change.items_lost.length > 0 || change.weapons_gained.length > 0 ||
        change.status_effects_gained.length > 0 || change.status_effects_lost.length > 0)) ||
      change.xp_award > 0;
    console.log("[applyStateChange] hasChange", hasChange, { hp_delta: change.hp_delta, spell_slots_used: change.spell_slots_used, xp_award: change.xp_award, shouldApplySlots, hadPendingCast, isEffectiveTarget, isActingChar });
    if (!hasChange) return;

    const charIb         = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
    const effectiveMaxHp = char.max_hp + charIb.hpMaxAdd;
    const newHp          = Math.max(0, Math.min(effectiveMaxHp, char.hp + change.hp_delta));
    const newGold    = isExplicitTarget ? Math.max(0, (char.inventory?.gold ?? 0) + change.gold_delta) : (char.inventory?.gold ?? 0);
    const newItems   = isExplicitTarget ? [...(char.inventory?.items ?? []).filter(i => !change.items_lost.includes(i)), ...change.items_gained] : (char.inventory?.items ?? []);
    const newWeapons = isExplicitTarget ? [...(char.inventory?.weapons ?? []), ...change.weapons_gained] : (char.inventory?.weapons ?? []);

    // Status effects — unconscious tracks HP for any effective target; named conditions require explicit target.
    let newStatuses = [...(char.status_effects ?? [])];
    if (isEffectiveTarget) {
      if (newHp === 0 && change.hp_delta < 0 && !newStatuses.includes("Unconscious")) newStatuses.push("Unconscious");
      if (newHp > 0 && newHp <= effectiveMaxHp) newStatuses = newStatuses.filter(s => s !== "Unconscious");
      if (isExplicitTarget) {
        change.status_effects_gained.forEach(s => { if (!newStatuses.includes(s)) newStatuses.push(s); });
        newStatuses = newStatuses.filter(s => !change.status_effects_lost.includes(s));
      }
    } else if (change.hp_delta !== 0) {
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
    if (change.hp_delta < 0) parts.push(`${Math.abs(change.hp_delta)} damage taken`);
    if (change.hp_delta > 0) parts.push(`+${change.hp_delta} HP restored`);
    if (isExplicitTarget && change.gold_delta > 0) parts.push(`+${change.gold_delta}gp`);
    if (isExplicitTarget && change.gold_delta < 0) parts.push(`${change.gold_delta}gp`);
    if (isExplicitTarget) change.items_gained.forEach(i => parts.push(`+${i}`));
    if (isExplicitTarget) change.weapons_gained.forEach(w => parts.push(`+${w}`));
    if (isExplicitTarget) change.status_effects_gained.forEach(s => parts.push(`⚡ ${s}`));
    if (isExplicitTarget) change.status_effects_lost.forEach(s => parts.push(`✓ ${s} cleared`));
    if (shouldApplySlots && change.spell_slots_used > 0 && !hadPendingCast) parts.push(`${change.spell_slots_used} spell slot${change.spell_slots_used > 1 ? "s" : ""} used`);
    if (isExplicitTarget && newHp === 0 && change.hp_delta < 0) parts.push("💀 UNCONSCIOUS");

    // XP + level up
    let newXp    = char.xp ?? 0;
    let newLevel = char.level;
    let newMaxHp = char.max_hp;
    let leveledUp = false;

    if (change.xp_award > 0) {
      newXp += change.xp_award;
      parts.push(`+${change.xp_award} XP`);
      const xpToNext = getXpToNextLevel(newLevel);
      if (newXp >= xpToNext && newLevel < 10) {
        newLevel++;
        const hitDie  = CLASS_HIT_DIE[char.class] ?? 8;
        const hpGain  = Math.floor(hitDie / 2) + 1 + Math.floor((char.constitution - 10) / 2);
        newMaxHp      = char.max_hp + hpGain;
        leveledUp     = true;
        parts.push(`⬆ LEVEL UP → ${newLevel}! +${hpGain} max HP`);
      }
    }

    const updatedChar: Character = {
      ...char, hp: newHp, level: newLevel, max_hp: newMaxHp, xp: newXp,
      status_effects: newStatuses, spell_slots_used: newSlotsUsed,
      inventory: { gold: newGold, items: newItems, weapons: newWeapons },
    };
    console.log("[applyStateChange] APPLYING", { oldHp: char.hp, newHp, oldSlots: char.spell_slots_used, newSlots: newSlotsUsed });
    setCharacter(updatedChar);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updatedChar : c));

    const dbUpdate: Record<string, unknown> = {
      hp: newHp, inventory: updatedChar.inventory, xp: newXp,
      status_effects: newStatuses, spell_slots_used: newSlotsUsed,
    };
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
        status_effects:   newStatuses,
      },
    });

    if (parts.length) {
      const notice = parts.join(" · ");
      setStateNotice(notice);
      setTimeout(() => setStateNotice(null), leveledUp || newHp === 0 ? 8000 : 4000);
      setLogEntries(prev => [...prev, { id: `state-${Date.now()}`, timestamp: new Date(), role: "system", content: `⚡ ${notice}` }]);
    }
  }, [charWrite, charNameMatches]);

  // ── Ordered narration queue (slot-based) ──────────────────────────────────────
  // Each sentence gets a numbered slot BEFORE the async fetch so they always play in order.
  const playNextInQueue = useCallback(() => {
    if (audioPlayingRef.current) return;
    const slot = narPlaySlotRef.current;
    if (slot >= narSlotCounterRef.current) return;
    const entry = narSlotsRef.current[slot];
    if (entry === null || entry === undefined) return; // not ready yet — will retry when set
    narPlaySlotRef.current++;
    if (entry === "SKIP") { playNextInQueue(); return; }

    const el = narAudioRef.current;
    if (!el) { playNextInQueue(); return; }

    audioPlayingRef.current = true;

    const cleanup = () => {
      el.oncanplaythrough = null;
      el.onerror          = null;
      el.onended          = null;
      audioPlayingRef.current = false;
      if (narPlaySlotRef.current >= narSlotCounterRef.current) setNarrating(false);
      playNextInQueue();
    };

    el.onended = cleanup;
    el.onerror = cleanup;
    el.volume  = narMutedRef.current ? 0 : narVolumeRef.current;
    el.src = entry as string;
    // Wait for canplaythrough (same pattern as working ambiance player) before calling play().
    // Xbox Edge requires the browser to confirm data is available; calling play() immediately
    // after load() can silently fail on strict console browsers.
    el.oncanplaythrough = () => {
      el.oncanplaythrough = null;
      // When the first sentence loads, compute how fast to type so text matches the voice pace
      if (slot === 0 && narSlot0TextRef.current && el.duration > 0) {
        const avgGroupSize = 1.3; // chars per RevealText interval tick
        const groups = narSlot0TextRef.current.length / avgGroupSize;
        const computed = Math.round((el.duration * 1000) / groups);
        setNarRevealIntervalMs(Math.max(24, Math.min(160, computed)));
      }
      setNarrating(true);
      const p = el.play();
      if (p instanceof Promise) p.catch(() => cleanup());
    };
    el.load();
  }, []);

  const enqueueNarration = useCallback(async (text: string) => {
    const myGen = narGenerationRef.current; // capture at enqueue time
    const slot = narSlotCounterRef.current++;
    if (slot === 0) narSlot0TextRef.current = text; // first sentence length drives the reveal rate
    narSlotsRef.current[slot] = null; // reserve — not ready yet
    try {
      const res = await fetch("/api/narrate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, voice: selectedVoiceRef.current ?? "chronicler" }),
      });
      // If a new DM response started while this fetch was in flight, discard the result.
      // Writing stale audio to the now-reset slot array causes the wrong clip to play.
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
  // Keep the loading-screen effect's narration call up to date
  useEffect(() => { enqueueNarrationRef.current = enqueueNarration; }, [enqueueNarration]);

  // ── Party join/leave narration ────────────────────────────────────────────────
  // Joins are debounced 8 s so multiple arrivals batch into one DM announcement.
  // Leave / kick fire immediately.
  const fireDmPartyResponse = useCallback(async (trigger: Message) => {
    if (isTypingRef.current) return;
    setPartyChangePending(false);
    setIsTyping(true); isTypingRef.current = true;
    setStreamingContent("");
    narGenerationRef.current++; narSlotCounterRef.current = 0; narSlotsRef.current = []; narPlaySlotRef.current = 0;
    audioPlayingRef.current = false;
    narSlot0TextRef.current = null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messagesRef.current, trigger], character: characterRef.current }),
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
        setStreamingContent(full);
        if (narrationEnabledRef.current) {
          const m = narBuf.match(/^([\s\S]{40,}?[.!?…]["']?)\s+/);
          if (m) {
            if (/\broll\s+a\s+d\d+\b/i.test(m[1])) { narBuf = ""; } // stop at roll request
            else { const s = stripSystemLeaks(m[1]); if (s) enqueueNarration(s); narBuf = narBuf.slice(m[0].length); }
          }
        }
      }
      if (narrationEnabledRef.current && narBuf.trim().length > 30) enqueueNarration(stripSystemLeaks(narBuf.trim()));
      setMessages(prev => [...prev, { role: "dm", content: full }]);
      setLogEntries(prev => [...prev, { id: `dm-${Date.now()}`, timestamp: new Date(), role: "dm", content: full }]);
      supabase.from("campaign_messages").insert([{ campaign_id: params.id, role: "dm", content: full, sender: null }])
        .then(({ error }) => { if (error) console.error("[party event]", error); });
      channelRef.current?.send({ type: "broadcast", event: "dm_response", payload: { senderId: userIdRef.current, content: full, actingCharId: characterRef.current?.id ?? null } });
      const isPartyEventMyTurn = turnOrderRef.current.length <= 1 || turnOrderRef.current[currentTurnIndexRef.current] === characterRef.current?.id;
      if (isPartyEventMyTurn && characterRef.current) {
        fetch("/api/suggest-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dmResponse: full, character: characterRef.current }) })
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
    const roll       = Math.ceil(Math.random() * hitDie);
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
    const notice = `Short Rest: d${hitDie} rolled ${roll} + CON ${conMod >= 0 ? "+" : ""}${conMod} = +${gained} HP${isWarlock ? " · Pact slots restored" : ""}`;
    setStateNotice(notice);
    setTimeout(() => setStateNotice(null), 5000);
    setLogEntries(prev => [...prev, { id: `rest-${Date.now()}`, timestamp: new Date(), role: "system", content: `🌙 ${notice}` }]);
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
    const notice = `Long Rest: HP fully restored (${longMaxHp}), spell slots & class abilities recovered, conditions cleared`;
    setStateNotice(notice);
    setTimeout(() => setStateNotice(null), 6000);
    setLogEntries(prev => [...prev, { id: `rest-${Date.now()}`, timestamp: new Date(), role: "system", content: `☀️ Long Rest — ${char.name} is fully restored.` }]);
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
    const newUsed = currentUsed + cost;
    const newClassResources = { ...(char.class_resources ?? {}), [resourceKey]: newUsed };
    const updated = { ...char, class_resources: newClassResources };
    setCharacter(updated);
    characterRef.current = updated;
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updated : c));
    campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === char.id ? updated : c);
    await charWrite(char.id, { class_resources: newClassResources });
    channelRef.current?.send({
      type: "broadcast", event: "character_sync",
      payload: {
        charId: char.id, hp: char.hp, max_hp: char.max_hp,
        xp: char.xp, level: char.level,
        inventory: char.inventory, spell_slots_used: char.spell_slots_used ?? {},
        class_resources: newClassResources, status_effects: char.status_effects ?? [],
      },
    });
  }, [charWrite]);

  const handlePartyShortRest = useCallback(async () => {
    const party = campaignPartyRef.current;
    if (!party.length) return;

    const updates = party.map(char => {
      const hitDie    = CLASS_HIT_DIE[char.class] ?? 8;
      const roll      = Math.ceil(Math.random() * hitDie);
      const conMod    = Math.floor((char.constitution - 10) / 2);
      const gained    = Math.max(1, roll + conMod);
      const ib        = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
      const maxHp     = char.max_hp + ib.hpMaxAdd;
      const newHp     = Math.min(maxHp, char.hp + gained);
      const isWarlock = char.class === "Warlock";
      const newSlots  = isWarlock ? {} : { ...(char.spell_slots_used ?? {}) };
      const newStatus = (char.status_effects ?? []).filter(s => !["Prone", "Frightened", "Stunned"].includes(s));
      return { char, newHp, newSlots, newStatus, gained };
    });

    await Promise.all(updates.map(u =>
      charWrite(u.char.id, { hp: u.newHp, spell_slots_used: u.newSlots, status_effects: u.newStatus })
    ));

    setCampaignParty(prev => prev.map(c => {
      const u = updates.find(x => x.char.id === c.id);
      return u ? { ...c, hp: u.newHp, spell_slots_used: u.newSlots, status_effects: u.newStatus } : c;
    }));

    const activeU = updates.find(u => u.char.id === characterRef.current?.id);
    if (activeU) {
      const updated = { ...activeU.char, hp: activeU.newHp, spell_slots_used: activeU.newSlots, status_effects: activeU.newStatus };
      setCharacter(updated); characterRef.current = updated;
    }

    const summary = updates.map(u => `${u.char.name} +${u.gained} HP`).join(" · ");
    setStateNotice(`Party Short Rest: ${summary}`);
    setTimeout(() => setStateNotice(null), 6000);
    setLogEntries(prev => [...prev, { id: `rest-${Date.now()}`, timestamp: new Date(), role: "system", content: `🌙 Party Short Rest — ${summary}` }]);
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
      charWrite(u.char.id, { hp: u.maxHp, spell_slots_used: {}, status_effects: u.newStatus })
    ));

    setCampaignParty(prev => prev.map(c => {
      const u = updates.find(x => x.char.id === c.id);
      return u ? { ...c, hp: u.maxHp, spell_slots_used: {}, status_effects: u.newStatus } : c;
    }));

    const activeU = updates.find(u => u.char.id === characterRef.current?.id);
    if (activeU) {
      const updated = { ...activeU.char, hp: activeU.maxHp, spell_slots_used: {}, status_effects: activeU.newStatus };
      setCharacter(updated); characterRef.current = updated;
    }

    const names = updates.map(u => u.char.name).join(", ");
    setStateNotice("Party Long Rest: Full HP restored, all spell slots recovered");
    setTimeout(() => setStateNotice(null), 6000);
    setLogEntries(prev => [...prev, { id: `rest-${Date.now()}`, timestamp: new Date(), role: "system", content: `☀️ Party Long Rest — ${names} fully restored.` }]);
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
      .replace(/\[HP:[^\]]+\]/gi, "")
      .replace(/^ALL PLAYERS HAVE ACTED[^\n]*/gim, "")
      .replace(/^DO NOT CALL NEXT TURN[^\n]*/gim, "")
      .replace(/^ROLL RESTRICTION:[^\n]*/gim, "")
      .replace(/^PARTY —[^\n]*/gim, "")
      // Strip attack-roll math lines — e.g. "11 + 3 [STR] + 2 [Prof] = 16 — hits AC 14!"
      // Identified by bracket-enclosed stat/modifier labels specific to these math displays
      .replace(/\b\d+[^.!?\n]*\[(?:STR|DEX|CON|INT|WIS|CHA|Prof|Spell ATK|\+\d[^\]]*)\][^.!?\n]*[.!?]?/gi, "")
      // Strip "Roll a dN." game-mechanic instructions — these are not DM narration
      .replace(/\bRoll\s+a\s+d\d+[^.!?]*[.!?]/gi, "")
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
        // "Aria's turn / roll / check / save"
        new RegExp(`\\b${esc}'s?\\s+(?:turn|roll|check|saving throw|save)`, "i"),
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
  const sendToAI = async (allMessages: Message[], isOpeningScene = false, opts?: { trackRound?: boolean; roundSummary?: { name: string; action: string }[]; nextPlayerName?: string | null; prevPlayerName?: string | null; allActed?: boolean; preserveNarration?: boolean; isRollResult?: boolean; isTurnSkip?: boolean; skippedPlayerName?: string; isGroupCheckResult?: boolean; turnOrder?: string[]; _retryCount?: number }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset narration queue unless we want to continue from a prior DM response (e.g. reconciliation after allActed)
    if (!opts?.preserveNarration) {
      // Bump generation and clear queued slots so in-flight TTS fetches for the old
      // response are discarded. Do NOT pause the audio element — the currently playing
      // clip must finish naturally so narration never cuts off mid-sentence.
      // The clip's onended handler will see the empty new queue and clean up correctly.
      narGenerationRef.current++; narSlotCounterRef.current = 0; narSlotsRef.current = []; narPlaySlotRef.current = 0;
      narSlot0TextRef.current   = null;
      setNarRevealText(null);
      setNarRevealIntervalMs(null);
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
        setStreamingContent(full);
        // Sentence-level streaming narration — suppressed during opening loading screen
        if (narrationEnabledRef.current && !campaignLoadingRef.current && !narDone) {
          const m = narBuf.match(/^([\s\S]{40,}?[.!?…]["']?)\s+/);
          if (m) {
            // Stop streaming narration at a roll request — post-roll text may be truncated
            // from the display, so we must not narrate it
            if (/\broll\s+a\s+d\d+\b/i.test(m[1])) { narBuf = ""; narDone = true; }
            else {
              const narSentence = stripSystemLeaks(m[1]);
              if (narSentence) {
                enqueueNarration(narSentence);
              }
              narBuf = narBuf.slice(m[0].length);
            }
          }
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

      // Enqueue any remaining narBuf — threshold is 8 chars (not 30) so short call-to-action
      // sentences like "Your move!" or "What do you do?" are not silently dropped.
      if (narrationEnabledRef.current && !campaignLoadingRef.current && !narDone && narBuf.trim().length > 8) enqueueNarration(stripSystemLeaks(narBuf.trim()));

      // Guard: if the response has no sentence-ending punctuation it's a bare fragment (e.g. "Shmang,").
      // Retry up to 3 times. On the 3rd failure fall back to a silent empty message so nothing is shown.
      if (!/[.!?…]/.test(full.trim())) {
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

      // Route through narration-synced reveal when voice is active; add directly to messages otherwise
      if (full) {
        if (narrationEnabledRef.current && !campaignLoadingRef.current) {
          setNarRevealText(full);
          // narRevealIntervalMs will be set when slot-0 audio canplaythrough fires
        } else {
          setMessages(prev => [...prev, { role: "dm", content: full }]);
        }
        setLogEntries(prev => [...prev, { id: `dm-${Date.now()}`, timestamp: new Date(), role: "dm", content: full }]);
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
        targetChar = prevActingChar ?? currentTurnChar ?? characterRef.current;
      }

      const validRollTarget  = targetChar?.name ?? rollTarget;
      const targetUserId     = targetChar?.user_id ?? null;
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
          const rollerPartyIdx = campaignPartyRef.current.findIndex(c => c.id === targetChar.id);
          if (rollerPartyIdx >= 0) setActiveCharIdx(rollerPartyIdx);
          channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: rollerIdx } });
        }
      }
      channelRef.current?.send({ type: "broadcast", event: "roll_request", payload: { userId: targetUserId } });

      // DM-driven turn: when the DM's closing question names a player ("Aria, what do you do?"),
      // always make that player the active turn — the DM is authoritative on who acts next.
      // If the player already acted this round, un-record it so the round doesn't stall.
      if (!validRollTarget && !opts?.allActed && turnOrderRef.current.length > 1) {
        const partyNames = campaignPartyRef.current.map(c => c.name);
        const dmTurnName = detectNextTurnPlayer(full, partyNames);
        const dmTurnChar = dmTurnName ? campaignPartyRef.current.find(c => c.name === dmTurnName) : null;
        if (dmTurnChar) {
          const alreadyActed = roundActionsRef.current.some(a => a.characterId === dmTurnChar.id);
          if (alreadyActed) {
            roundActionsRef.current = roundActionsRef.current.filter(a => a.characterId !== dmTurnChar.id);
            setRoundActions([...roundActionsRef.current]);
          }
          const dmTurnIdx = turnOrderRef.current.indexOf(dmTurnChar.id);
          if (dmTurnIdx >= 0 && dmTurnIdx !== currentTurnIndexRef.current) {
            setCurrentTurnIndex(dmTurnIdx);
            currentTurnIndexRef.current = dmTurnIdx;
            const dmPartyIdx = campaignPartyRef.current.findIndex(c => c.id === dmTurnChar.id);
            if (dmPartyIdx >= 0) setActiveCharIdx(dmPartyIdx);
            channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: dmTurnIdx } });
          }
        } else if (opts?.prevPlayerName) {
          // No explicit next-player found — check if the DM's closing question is directed at the
          // previous player (follow-up: "Shmang, what element would you like?"). If so, rewind to them.
          const prevChar = campaignPartyRef.current.find(c => c.name === opts.prevPlayerName);
          if (prevChar) {
            const prevIdx = turnOrderRef.current.indexOf(prevChar.id);
            if (prevIdx >= 0 && prevIdx !== currentTurnIndexRef.current) {
              const tail = full.slice(-350);
              const firstName = prevChar.name.split(" ")[0];
              const escPrev = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              // Last ? in the tail — check if the player's name and "you/your" both appear near it
              const lastQIdx = tail.lastIndexOf("?");
              if (lastQIdx >= 0) {
                const nearQ = tail.slice(Math.max(0, lastQIdx - 220), lastQIdx + 1);
                const isFollowUp = new RegExp(`\\b${escPrev}\\b`, "i").test(nearQ)
                  && /\byou(?:r)?\b/i.test(nearQ);
                if (isFollowUp) {
                  if (roundActionsRef.current.some(a => a.characterId === prevChar.id)) {
                    roundActionsRef.current = roundActionsRef.current.filter(a => a.characterId !== prevChar.id);
                    setRoundActions([...roundActionsRef.current]);
                  }
                  setCurrentTurnIndex(prevIdx);
                  currentTurnIndexRef.current = prevIdx;
                  channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: prevIdx } });
                  const partyIdx = campaignPartyRef.current.findIndex(c => c.id === prevChar.id);
                  if (partyIdx >= 0) setActiveCharIdx(partyIdx);
                }
              }
            }
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
      const toInsert = lastMsg.role === "player"
        ? [
            { campaign_id: params.id, role: lastMsg.role, content: lastMsg.content, sender: lastMsg.sender ?? null },
            { campaign_id: params.id, role: "dm",         content: full,            sender: null },
          ]
        : [{ campaign_id: params.id, role: "dm", content: full, sender: null }];
      supabase.from("campaign_messages").insert(toInsert).then(({ error }) => { if (error) console.error("[campaign] save:", error); });

      channelRef.current?.send({ type: "broadcast", event: "dm_response", payload: { senderId: userId, content: full, actingCharId: characterRef.current?.id ?? null } });

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

      // Fast HP detection — apply HP change to this character immediately before chat-state returns.
      if (!isOpeningScene && pendingHpDeltaRef.current === 0) {
        const actingChar = characterRef.current;
        if (actingChar) {
          const firstName = actingChar.name.split(" ")[0];
          const hpDelta = parseHpTag(full, firstName);
          if (hpDelta !== 0) {
            const ib = computeInventoryBonuses(actingChar.inventory?.items ?? [], actingChar.inventory?.weapons ?? []);
            const newHp = Math.max(0, Math.min(actingChar.max_hp + ib.hpMaxAdd, actingChar.hp + hpDelta));
            const fastChar = { ...actingChar, hp: newHp };
            setCharacter(fastChar);
            setCampaignParty(prev => prev.map(c => c.id === actingChar.id ? { ...c, hp: newHp } : c));
            characterRef.current = fastChar;
            campaignPartyRef.current = campaignPartyRef.current.map(c => c.id === actingChar.id ? { ...c, hp: newHp } : c);
            pendingHpDeltaRef.current = hpDelta;
            charWriteRef.current?.(actingChar.id, { hp: newHp });
            channelRef.current?.send({ type: "broadcast", event: "character_sync", payload: { charId: actingChar.id, hp: newHp } });
          }
        }
      }

      // State changes (HP, gold, items, XP) — skip on opening scene (no player action yet)
      if (!isOpeningScene) {
        console.log("[chat-state] sending narrative:", full.slice(0, 300));
        fetch("/api/chat-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: full }) })
          .then(r => r.json())
          .then((change: StateChange) => {
            console.log("[chat-state] response", change);
            return applyStateChange(change);
          })
          .catch((err) => console.error("[chat-state] error", err));
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
        fetch("/api/suggest-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dmResponse: full, character: nextTurnChar }) })
          .then(r => r.json()).then(({ suggestions: s }) => setSuggestions(s ?? [])).catch(() => {});
      }

      // Round management: reconcile when every party member has acted (count-based, not position-based)
      if (opts?.trackRound && !rollTarget) {
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
    // Clear round actions and reset turn to first player before DM reconciles
    roundActionsRef.current = [];
    setRoundActions([]);
    setCurrentTurnIndex(0);
    currentTurnIndexRef.current = 0;
    channelRef.current?.send({ type: "broadcast", event: "round_reset",  payload: {} });
    channelRef.current?.send({ type: "broadcast", event: "turn_taken",   payload: { userId, newIndex: 0 } });
    if (campaignPartyRef.current.length > 1) setActiveCharIdx(0);
    // Strip pass entries from the DM summary — the DM should only see actual player actions.
    // Passed players are absent from the resolution; enemies still target all present characters.
    const dmSummary = summary.filter(a => a.action !== "passed their turn");
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
      trackRound:     turnOrderRef.current.length > 1,
      nextPlayerName: toChar.name,
      prevPlayerName: fromChar.name,
      isTurnSkip:     true,
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

    const playerMsg: Message = { role: "player", content: text, sender: character?.name ?? "You" };
    const updatedMessages    = [...messages, playerMsg];
    setMessages(updatedMessages);
    setLogEntries(prev => [...prev, { id: `player-${Date.now()}`, timestamp: new Date(), role: "player", sender: playerMsg.sender, content: text }]);
    channelRef.current?.send({ type: "broadcast", event: "player_action", payload: { senderId: userId, content: text, characterName: character?.name, characterId: character?.id } });

    // Record this player's action for round tracking (not for roll submissions)
    if (!isRollSubmit && order.length > 1 && character) {
      const updated: RoundAction[] = [...roundActionsRef.current.filter(a => a.characterId !== character.id), { characterId: character.id, name: character.name, action: text }];
      roundActionsRef.current = updated;
      setRoundActions(updated);
    }

    // Capture acting character BEFORE the turn advances — applyStateChange uses this to gate changes
    prevActingCharIdRef.current = character?.id ?? null;

    // Compute next player and advance turn BEFORE awaiting the DM so no bonus actions slip through
    // Skip players who have already acted (e.g. via pass) so the turn doesn't cycle back to them.
    const findNextUnactedIdx = (fromIdx: number) => {
      for (let i = 1; i < order.length; i++) {
        const candidateIdx = (fromIdx + i) % order.length;
        if (!roundActionsRef.current.some(a => a.characterId === order[candidateIdx])) return candidateIdx;
      }
      return (fromIdx + 1) % order.length; // fallback: all acted (reconciliation will catch this)
    };

    let nextPlayerName: string | null = null;
    if (isRollSubmit && !wasGroupCheckRoll && order.length > 1) {
      // Roll submitted: DM resolves the roll, then advance to the next unacted player's turn.
      const nextIdx = findNextUnactedIdx(currentTurnIndexRef.current);
      const nextCid = order[nextIdx];
      nextPlayerName = campaignPartyRef.current.find(c => c.id === nextCid)?.name ?? null;
      setCurrentTurnIndex(nextIdx);
      currentTurnIndexRef.current = nextIdx;
      channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: nextIdx } });
      if (campaignPartyRef.current.length > 1) setActiveCharIdx(prev => (prev + 1) % campaignPartyRef.current.length);
    } else if (isRollSubmit && wasGroupCheckRoll && order.length > 1) {
      // Group check roll — keep the same player's turn; DM resolves the check and returns to them
      nextPlayerName = campaignPartyRef.current.find(c => c.id === order[currentTurnIndexRef.current])?.name ?? null;
    } else if (!isRollSubmit && order.length > 1) {
      const allActedNow = order.every(cid => roundActionsRef.current.some(a => a.characterId === cid));
      if (!allActedNow) {
        const nextIdx = findNextUnactedIdx(currentTurnIndexRef.current);
        const nextCid = order[nextIdx];
        nextPlayerName = campaignPartyRef.current.find(c => c.id === nextCid)?.name ?? null;
        setCurrentTurnIndex(nextIdx);
        currentTurnIndexRef.current = nextIdx;
        channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: nextIdx } });
        if (campaignPartyRef.current.length > 1) setActiveCharIdx(prev => (prev + 1) % campaignPartyRef.current.length);
      }
    }

    const allActedForDM = !isRollSubmit && order.length > 1
      && roundActionsRef.current.length >= campaignPartyRef.current.length
      && order.every(cid => roundActionsRef.current.some(a => a.characterId === cid));

    pendingReconciliationRef.current = null;
    await sendToAI(updatedMessages, false, {
      trackRound:     order.length > 1,
      nextPlayerName,
      prevPlayerName: character?.name ?? null,
      allActed:       allActedForDM,
      ...(isRollSubmit && { isRollResult: true }),
      ...(wasGroupCheckRoll && { isGroupCheckResult: true }),
    });

    // If sendToAI detected all players have acted, trigger round reconciliation
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
    const dropped: DroppedItem = {
      id:            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name:          itemName,
      type:          itemType,
      fromCharacter: char.name,
      fromUserId:    userIdRef.current!,
    };
    const newInv = {
      ...char.inventory,
      items:   itemType === "item"   ? char.inventory.items.filter(i => i !== itemName)   : char.inventory.items,
      weapons: itemType === "weapon" ? char.inventory.weapons.filter(w => w !== itemName) : char.inventory.weapons,
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
    const fromNewInv = {
      ...from.inventory,
      items:   itemType === "item"   ? from.inventory.items.filter(i => i !== itemName)   : from.inventory.items,
      weapons: itemType === "weapon" ? from.inventory.weapons.filter(w => w !== itemName) : from.inventory.weapons,
    };
    const toNewInv = {
      ...to.inventory,
      items:   itemType === "item"   ? [...(to.inventory?.items   ?? []), itemName] : (to.inventory?.items   ?? []),
      weapons: itemType === "weapon" ? [...(to.inventory?.weapons ?? []), itemName] : (to.inventory?.weapons ?? []),
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
    const newInv = {
      ...char.inventory,
      items:   dropped.type === "item"   ? [...char.inventory.items, dropped.name]   : char.inventory.items,
      weapons: dropped.type === "weapon" ? [...char.inventory.weapons, dropped.name] : char.inventory.weapons,
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
    setLogEntries(prev => [...prev, { id: `use-${Date.now()}`, timestamp: new Date(), role: "system", content: `🧪 ${notice}` }]);
  }, [charWrite]);

  // ── Party management ─────────────────────────────────────────────────────────
  const addToParty = useCallback(async (char: Character) => {
    if (campaignPartyRef.current.some(c => c.id === char.id)) return;

    let updated: Character;

    if (usesCCTableRef.current) {
      // CC-table campaign: check for existing saved state (returning player)
      const { data: existingCC } = await supabase.from("campaign_characters")
        .select("*").eq("campaign_id", params.id).eq("character_id", char.id).maybeSingle();
      if (existingCC) {
        const cc = existingCC as CampaignCharacterRow;
        updated = {
          ...char, campaign_id: params.id,
          hp: cc.hp, max_hp: cc.max_hp, xp: cc.xp, level: cc.level,
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
    const joinContent = `[Party change — weave naturally into the story: ${updated.name}, a ${updated.class}, has joined the party]`;
    fireDmPartyResponse({ role: "player", content: joinContent });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, fireDmPartyResponse]);

  const leaveParty = useCallback(async (charId: string) => {
    const char = campaignPartyRef.current.find(c => c.id === charId);
    if (!char) return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDiceResult = (result: number, diceType: number, description?: string) => {
    // Stop any in-flight narration immediately — roll submission takes priority
    if (narAudioRef.current) { narAudioRef.current.pause(); narAudioRef.current.src = ""; }
    setNarrating(false);
    narGenerationRef.current++;
    narSlotCounterRef.current = 0;
    narSlotsRef.current = [];
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
  // True when the character whose turn it is belongs to this user — in couch co-op all chars
  // share the same user_id so this is always true; in pure multiplayer it restricts to your own turns.
  const canPassTurn = (() => {
    const turnChar = campaignParty.find(c => c.id === currentTurnPlayerId);
    return !turnChar || turnChar.user_id === userId;
  })();
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
      {/* ── Tutorial modal ── */}
      {tutorialStep !== null && (() => {
        const step = CAMPAIGN_TUTORIAL_STEPS[tutorialStep];
        const isLast = tutorialStep === CAMPAIGN_TUTORIAL_STEPS.length - 1;
        const closeTutorial = (markDone = true) => {
          if (markDone) localStorage.setItem("dnd_campaign_tutorial_done", "1");
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
                          const dmPartyIdx = campaignPartyRef.current.findIndex(c => c.id === dmTurnChar.id);
                          if (dmPartyIdx >= 0) setActiveCharIdx(dmPartyIdx);
                        }
                      }
                    }

                    setSessionStarted(true);
                    if (resumeNarrationRef.current) {
                      enqueueNarration(resumeNarrationRef.current);
                    }
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
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "40px 24px 28px", background: "linear-gradient(transparent, rgba(0,0,0,0.92))" }}>
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
                      narGenerationRef.current++; narSlotCounterRef.current = 0; narSlotsRef.current = []; narPlaySlotRef.current = 0;
                      narSlot0TextRef.current = null;
                      audioPlayingRef.current = false;
                      setNarrating(false);
                      setNarRevealText(null);
                      setNarRevealIntervalMs(null);
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

        {/* Messages */}
        <div ref={msgContainerRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {messages.map((msg, idx) => (
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
                {msg.role === "dm" ? <ColorizedText text={stripSystemLeaks(msg.content)} playerColors={Object.fromEntries(campaignParty.map(c => [c.name.split(" ")[0], CLASS_COLORS[c.class] ?? "#94a3b8"]))} onShowTooltip={showTooltip} onHideTooltip={hideTooltip} /> : msg.content}
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

          {/* Narration-synced reveal — text types at speech pace once audio duration is known */}
          {narRevealText && (
            <div className="animate-fade-in" style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "3px", fontWeight: "bold" }}>Dungeon Master</span>
              <div style={{ padding: "11px 15px", borderRadius: "12px", fontSize: chatMsgSize, lineHeight: 1.55, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                {narRevealIntervalMs !== null
                  ? <RevealText
                      text={stripSystemLeaks(narRevealText)}
                      intervalMs={narRevealIntervalMs}
                      onComplete={() => {
                        const content = narRevealText;
                        setNarRevealText(null);
                        setNarRevealIntervalMs(null);
                        setMessages(prev => [...prev, { role: "dm", content }]);
                      }}
                    />
                  : <span style={{ display: "inline-block", width: "2px", height: "1em", background: "var(--primary)", marginLeft: "2px", verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
                }
              </div>
            </div>
          )}

          {/* Streaming */}
          {(isTyping || streamingContent) && !narRevealText && (
            <div className="animate-fade-in" style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "3px", fontWeight: "bold" }}>Dungeon Master</span>
              <div style={{ padding: "11px 15px", borderRadius: "12px", fontSize: chatMsgSize, lineHeight: 1.55, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", whiteSpace: "pre-wrap", minWidth: "80px" }}>
                {streamingContent && !narrationEnabled
                  ? <><StreamingText text={stripSystemLeaks(streamingContent)} /><span style={{ display: "inline-block", width: "2px", height: "1em", background: "var(--primary)", marginLeft: "2px", verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} /></>
                  : <span className="animate-float" style={{ color: "var(--primary)", fontSize: "0.85rem" }}>The DM is thinking...</span>
                }
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested actions — hidden while a dice roll is pending or active */}
        {suggestions.length > 0 && !dmBusy && isMyTurn && !showDice && !pendingDiceShow && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.04)" }}>
            <p style={{ fontSize: `${(chatFontSize * 0.72).toFixed(2)}rem`, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Suggested actions</p>
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
          </div>
        )}

        {/* First-time chat hint */}
        {showChatHint && (
          <div style={{ padding: "9px 14px", borderTop: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.07)", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>💬</span>
            <p style={{ fontSize: "0.75rem", color: "#a78bfa", lineHeight: 1.55, flex: 1, margin: 0 }}>
              <strong>Type what your character says or does</strong> — the AI Dungeon Master responds instantly.
              Use the 🎲 button to roll dice when asked, or explore the sidebar tabs for your sheet, party, and combat.
            </p>
            <button
              onClick={() => { setShowChatHint(false); sessionStorage.setItem(`chatHint_${params.id}`, "1"); }}
              style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "1rem", padding: "2px 4px", lineHeight: 1, flexShrink: 0 }}
              title="Dismiss"
            >✕</button>
          </div>
        )}

        {/* Input bar */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--border)", background: "var(--card-bg)", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn-secondary"
              onClick={() => setShowDice(true)}
              disabled={isTyping || narrating || !isMyTurn}
              title="Roll Dice"
              style={{
                padding: "14px 18px", fontSize: "1.4rem", flexShrink: 0,
                ...(!showDice && (pendingDiceShow || rollRequestedUserId === userId) && isMyTurn && {
                  border: "1.5px solid rgba(251,191,36,0.8)",
                  boxShadow: "0 0 16px rgba(251,191,36,0.5), 0 0 32px rgba(251,191,36,0.2)",
                  animation: "dicePulse 0.8s ease-in-out infinite alternate",
                  color: "#fbbf24",
                }),
              }}
            ><D20Icon size={22} color={(!showDice && (pendingDiceShow || rollRequestedUserId === userId) && isMyTurn) ? "#fbbf24" : "currentColor"}/></button>
            <input
              type="text" value={input}
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
        {sidebarTab === "party" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Party ({campaignParty.length})
              </h3>
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
                const isActive      = idx === activeCharIdx;
                const isDiceTarget  = diceRollTarget === char.name;
                const isCurrentTurn = turnOrder.length > 1 && char.id === currentTurnPlayerId;
                const cardInv      = char.inventory ?? { gold: 0, items: [], weapons: [] };
                const cardIb       = computeInventoryBonuses(cardInv.items, cardInv.weapons);
                const cardMaxHp    = char.max_hp + cardIb.hpMaxAdd;
                const pct          = Math.max(0, Math.min(100, (char.hp / Math.max(1, cardMaxHp)) * 100));
                const color        = pct > 60 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
                const classEmoji   = CLASS_EMOJI[char.class] ?? "⚔️";
                const dominantEff  = getDominantEffect(char.status_effects ?? []);
                const effectGlow   = getCardEffectGlow(char.status_effects ?? []);
                const borderColor  = isDiceTarget ? "rgba(251,191,36,0.9)" : isCurrentTurn ? "rgba(139,92,246,0.9)" : dominantEff ? dominantEff.badgeColor : "var(--border)";
                const bgColor      = isDiceTarget ? "rgba(251,191,36,0.08)" : isCurrentTurn ? "rgba(139,92,246,0.16)" : "rgba(0,0,0,0.3)";
                const cardAnim     = isDiceTarget ? "diceCardRise 1.4s ease-in-out infinite" : isCurrentTurn ? "activePlayerRise 2s ease-in-out infinite" : "none";
                const cardShadow   = isDiceTarget || isCurrentTurn ? undefined : (effectGlow ?? undefined);
                return (
                  <div key={char.id}
                    onClick={() => { if (campaignParty.length > 1) { setActiveCharIdx(idx); if (char.id !== character?.id) setSidebarTab("sheet"); } }}
                    style={{ position: "relative", padding: "14px 16px", background: bgColor, borderRadius: "10px", border: `2px solid ${borderColor}`, boxShadow: cardShadow, animation: cardAnim, order: isDiceTarget ? -2 : isCurrentTurn ? -1 : 0, transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease", cursor: campaignParty.length > 1 ? "pointer" : "default" }}>
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
                          style={{ width: fs(3.2), height: fs(3.2), borderRadius: "50%", overflow: "hidden", border: `2px solid ${isDiceTarget ? "rgba(251,191,36,0.9)" : isCurrentTurn ? "rgba(139,92,246,0.7)" : "var(--border)"}`, background: "rgba(0,0,0,0.4)", animation: isDiceTarget ? "diceTargetGlow 1.2s ease-in-out infinite" : "none", cursor: char.portrait_url ? "zoom-in" : "default" }}>
                          {char.portrait_url ? (
                            <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(1.1) }}>{classEmoji}</div>
                          )}
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
                    <div style={{ width: "100%", height: "6px", background: "#3f3f46", borderRadius: "3px", overflow: "hidden", marginBottom: "7px" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
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
                        {isMyTurn && char.id === character?.id && campaignParty.length > 1 && (
                          <button
                            onClick={e => { e.stopPropagation(); setPassTurnOpen(v => !v); }}
                            style={{ background: passTurnOpen ? "rgba(139,92,246,0.28)" : "rgba(139,92,246,0.12)", border: `1px solid ${passTurnOpen ? "rgba(139,92,246,0.7)" : "rgba(139,92,246,0.35)"}`, color: "#a78bfa", cursor: "pointer", fontSize: fs(0.62), padding: "2px 8px", borderRadius: "4px", lineHeight: 1.4, fontWeight: 600, transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.28)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.7)"; showTooltip(tipBox(MECHANIC_TIPS.PASS_TURN.title, MECHANIC_TIPS.PASS_TURN.body), e); }}
                            onMouseLeave={e => { e.currentTarget.style.background = passTurnOpen ? "rgba(139,92,246,0.28)" : "rgba(139,92,246,0.12)"; e.currentTarget.style.borderColor = passTurnOpen ? "rgba(139,92,246,0.7)" : "rgba(139,92,246,0.35)"; hideTooltip(); }}
                          >{passTurnOpen ? "↑ Cancel" : "Pass Turn"}</button>
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
                    {/* Pass-turn submenu — only on the active player's own card */}
                    {isMyTurn && char.id === character?.id && passTurnOpen && campaignParty.length > 1 && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: "8px", padding: "7px 8px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.28)", borderRadius: "8px" }}>
                        <div style={{ fontSize: fs(0.6), color: "#64748b", marginBottom: "5px", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>Pass turn to…</div>
                        {campaignParty.filter(c => c.id !== character?.id).map(targetChar => {
                          const targetIdx = campaignParty.findIndex(c => c.id === targetChar.id);
                          return (
                            <button key={targetChar.id}
                              onClick={e => { e.stopPropagation(); setPassTurnOpen(false); handleTurnSkip(targetChar, targetIdx); }}
                              style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", padding: "5px 7px", borderRadius: "6px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", transition: "background 0.12s" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.2)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                            >
                              <span style={{ fontSize: fs(0.75), color: CLASS_COLORS[targetChar.class] ?? "white", fontWeight: 700 }}>{targetChar.name}</span>
                              <span style={{ fontSize: fs(0.65), color: "#64748b" }}>{targetChar.race} {targetChar.class}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                              style={{ width: fs(1.7), height: fs(1.7), display: "flex", alignItems: "center", justifyContent: "center", background: eff.badgeBg, border: `1.5px solid ${eff.badgeColor}`, borderRadius: "6px", boxShadow: `0 0 7px ${eff.cardGlow}`, cursor: "help", fontSize: fs(1.0), flexShrink: 0 }}
                              onMouseEnter={e => showTooltip(tipBox(name, `${eff.description}\n\n${durationLine}`, eff.badgeColor), e)}
                              onMouseLeave={hideTooltip}
                            >{eff.icon}</div>
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

            {/* Manage party — party leader only */}
            {isPartyLeader && (
            <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
              <button
                onClick={() => setManagePartyOpen(o => !o)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "1px solid var(--border)", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontSize: fs(0.75), color: "#94a3b8", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "#94a3b8"; }}
              >
                <span>⊕ Manage Party</span>
                <span style={{ fontSize: fs(0.65) }}>{managePartyOpen ? "▲" : "▼"}</span>
              </button>

              {managePartyOpen && (
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
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
                            style={{ fontSize: fs(0.68), padding: "3px 8px", borderRadius: "5px", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                          >Leave</button>
                        ) : (
                          <button
                            onClick={() => addToParty(char)}
                            style={{ fontSize: fs(0.68), padding: "3px 8px", borderRadius: "5px", border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)", color: "#4ade80", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.2)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(34,197,94,0.1)"; }}
                          >Join</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Party-wide rests — always visible to party leader */}
              <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: fs(0.68), color: "#64748b", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Party Rest</p>
                <div style={{ display: "flex", gap: "7px" }}>
                  <button onClick={handlePartyShortRest}
                    style={{ flex: 1, padding: "7px", borderRadius: "7px", fontSize: "0.73rem", fontWeight: "bold", border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)", color: "#f59e0b", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.2)"; showTooltip(tipBox(MECHANIC_TIPS.SHORT_REST.title, MECHANIC_TIPS.SHORT_REST.body, "#f59e0b"), e); }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.08)"; hideTooltip(); }}>
                    🌙 Short Rest
                  </button>
                  <button onClick={handlePartyLongRest}
                    style={{ flex: 1, padding: "7px", borderRadius: "7px", fontSize: "0.73rem", fontWeight: "bold", border: "1px solid rgba(99,102,241,0.35)", background: "rgba(99,102,241,0.08)", color: "#818cf8", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.2)"; showTooltip(tipBox(MECHANIC_TIPS.LONG_REST.title, MECHANIC_TIPS.LONG_REST.body, "#818cf8"), e); }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.08)"; hideTooltip(); }}>
                    ☀️ Long Rest
                  </button>
                </div>
              </div>
            </div>
            )}

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
        )}

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
                      {vc.portrait_url ? (
                        <img src={vc.portrait_url} alt={vc.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(4) }}>{CLASS_EMOJI[vc.class] ?? "⚔️"}</div>
                      )}
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
                    {character.portrait_url ? (
                      <img src={character.portrait_url} alt={character.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(4) }}>🧙</div>
                    )}
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
                {SPELLCASTING_CLASSES.has(character.class) && ((character.cantrips_known?.length ?? 0) > 0 || (character.spells_prepared?.length ?? 0) > 0) && (
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
                    const rarityColor = catalogItem ? RARITY_COLORS[catalogItem.rarity] : "#475569";
                    const icon        = catalogItem ? ITEM_ICONS[catalogItem.type] : (slot === "weapon" ? "⚔" : "🎒");
                    const isHovered   = hoveredItem === `${slot}-${idx}`;
                    const itemKey     = `${slot}-${idx}`;
                    return (
                      <div key={itemKey} style={{ marginBottom: "4px" }}>
                        <div style={{ position: "relative" }}>
                          <div
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: tradingItem?.name === name && tradingItem?.slot === slot ? "6px 6px 0 0" : "6px", fontSize: fs(0.82), border: `1px solid ${tradingItem?.name === name && tradingItem?.slot === slot ? "rgba(139,92,246,0.45)" : catalogItem ? rarityColor + "44" : "transparent"}`, cursor: "default", transition: "border-color 0.15s" }}
                            onMouseEnter={e => {
                              setHoveredItem(itemKey);
                              if (catalogItem) {
                                showTooltip(tipBoxNode(name, <>
                                    <div style={{ color: rarityColor, fontSize: "0.85em", fontWeight: "bold", marginBottom: "4px" }}>{RARITY_LABELS[catalogItem.rarity]}</div>
                                    <div style={{ color: "#94a3b8", marginBottom: catalogItem.effects.some(fx => fx.description) ? "5px" : 0 }}>{catalogItem.description}</div>
                                    {catalogItem.effects.map((fx, fi) => fx.description && <div key={fi} style={{ padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "2px", color: fx.description.startsWith("⚠️") ? "#ef4444" : "#c4b5fd", fontSize: "0.9em" }}>{fx.description}</div>)}
                                    {catalogItem.requiresAttunement && <div style={{ color: "#64748b", fontSize: "0.85em", marginTop: "4px" }}>Requires Attunement</div>}
                                  </>, rarityColor), e);
                              } else {
                                const fallback = WEAPON_TIPS[name] ?? ITEM_TIPS[name];
                                if (fallback) showTooltip(tipBox(fallback.title, fallback.body), e);
                              }
                            }}
                            onMouseLeave={() => { setHoveredItem(null); hideTooltip(); }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
                              <span style={{ flexShrink: 0 }}>{icon}</span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: catalogItem ? rarityColor : "#e2e8f0" }}>{name}</div>
                                {catalogItem && (
                                  <div style={{ fontSize: fs(0.58), color: rarityColor, fontWeight: "bold", letterSpacing: "0.04em" }}>
                                    {RARITY_LABELS[catalogItem.rarity]}{catalogItem.requiresAttunement ? " · Attunement" : ""}{catalogItem.cursed ? " ⚠️" : ""}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0, marginLeft: "6px" }}>
                              {catalogItem?.consumable && (
                                <button
                                  onClick={() => handleUseItem(name)}
                                  style={{ fontSize: fs(0.58), color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "4px", cursor: "pointer", padding: "2px 6px", fontWeight: "bold" }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.25)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(34,197,94,0.12)"; }}
                                >Use</button>
                              )}
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

      <style>{`
        @keyframes blink  { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 0.75; } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes streamFadeIn { from { opacity: 0; filter: blur(3px); transform: translateY(3px); } to { opacity: 1; filter: blur(0); transform: translateY(0); } }
        @keyframes dicePulse { from { transform: scale(1); box-shadow: 0 0 10px rgba(251,191,36,0.4), 0 0 20px rgba(251,191,36,0.15); } to { transform: scale(1.1); box-shadow: 0 0 22px rgba(251,191,36,0.75), 0 0 44px rgba(251,191,36,0.3); } }
      `}</style>
    </main>
  );
}
