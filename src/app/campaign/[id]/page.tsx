"use client";

import React, { useState, useEffect, useRef, use, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { ALLOWED_EMAIL } from "../../../lib/allowedUsers";
import "../../globals.css";
import DiceRoller from "../../../components/DiceRoller";
import type { StateChange } from "../../api/chat-state/route";
import { getXpToNextLevel, SPELLCASTING_CLASSES, getSpellSlots, computeAC, CLASS_STAT_GUIDES, getTierStyle, CANTRIPS, LEVEL1_SPELLS } from "../../../lib/spellData";
import {
  getItemByName, computeInventoryBonuses, getEffectiveStat, rollDiceFormula,
  buildItemEffectsSummary, RARITY_COLORS, RARITY_LABELS, ITEM_ICONS,
  type LootItem,
} from "../../../lib/lootData";

type MsgRole  = "dm" | "player" | "system";
type Message  = { role: MsgRole; content: string; sender?: string };
type LogEntry = { id: string; timestamp: Date; role: MsgRole; sender?: string; content: string };
type DroppedItem   = { id: string; name: string; type: "item" | "weapon"; fromCharacter: string; fromUserId: string };
type TradeOffer    = { id: string; fromUserId: string; fromCharId: string; fromCharName: string; toUserId: string; toCharId: string; offeredItems: { name: string; type: "item" | "weapon" }[]; offeredGold: number };

type Character = {
  id: string; user_id?: string; name: string; race: string; class: string; level: number;
  hp: number; max_hp: number; xp?: number;
  campaign_id?: string | null;
  party_active?: boolean;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  background?: string;
  portrait_url?: string | null;
  sex?: string;
  cantrips_known?: string[];
  spells_prepared?: string[];
  status_effects?: string[];
  spell_slots_used?: Record<number, number>;
  inventory: { gold: number; cp?: number; sp?: number; ep?: number; pp?: number; weapons: string[]; items: string[] };
};

type PresencePlayer = {
  userId: string; characterName: string; characterClass: string;
  hp: number; maxHp: number; portraitUrl?: string | null;
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

// ── Colored narrative — red for damage, green for healing ─────────────────────
const DAMAGE_RE = /\b\d+\s*(?:(?:slashing|piercing|bludgeoning|fire|cold|lightning|thunder|poison|acid|necrotic|radiant|psychic|force)\s+)?damage\b/gi;
const HEAL_RE   = /\b(?:regain[s]?|heal[s]?|restore[s]?|recover[s]?)\s+\d+\s*(?:hit\s*points?|hp)?\b|\b\d+\s*(?:hit\s*points?|hp)\s+(?:restored|recovered)\b/gi;

function ColorizedText({ text, playerColors = {} }: { text: string; playerColors?: Record<string, string> }) {
  type Seg = { start: number; end: number; color: string };
  const segs: Seg[] = [];
  let m: RegExpExecArray | null;
  DAMAGE_RE.lastIndex = 0;
  while ((m = DAMAGE_RE.exec(text)) !== null) segs.push({ start: m.index, end: m.index + m[0].length, color: "#ef4444" });
  HEAL_RE.lastIndex = 0;
  while ((m = HEAL_RE.exec(text))   !== null) segs.push({ start: m.index, end: m.index + m[0].length, color: "#22c55e" });
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
    out.push(<span key={seg.start} style={{ color: seg.color, fontWeight: 600 }}>{text.slice(seg.start, seg.end)}</span>);
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

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Unconscious:   { bg: "rgba(239,68,68,0.25)",   color: "#ef4444" },
  Dead:          { bg: "rgba(31,31,31,0.6)",      color: "#6b7280" },
  Poisoned:      { bg: "rgba(168,85,247,0.25)",   color: "#a855f7" },
  Blinded:       { bg: "rgba(100,116,139,0.2)",   color: "#94a3b8" },
  Frightened:    { bg: "rgba(249,115,22,0.25)",   color: "#f97316" },
  Paralyzed:     { bg: "rgba(139,92,246,0.25)",   color: "#8b5cf6" },
  Stunned:       { bg: "rgba(234,179,8,0.25)",    color: "#eab308" },
  Prone:         { bg: "rgba(148,163,184,0.15)",  color: "#94a3b8" },
  Charmed:       { bg: "rgba(236,72,153,0.25)",   color: "#ec4899" },
  Exhausted:     { bg: "rgba(245,158,11,0.25)",   color: "#f59e0b" },
  Restrained:    { bg: "rgba(132,204,22,0.2)",    color: "#84cc16" },
  Petrified:     { bg: "rgba(163,163,163,0.2)",   color: "#a3a3a3" },
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  Unconscious: "Incapacitated, can't move or speak. Fails all STR/DEX saves. Attacks against have advantage; hits within 5ft are crits.",
  Dead:        "The character has died. Only Revivify, Raise Dead, or Resurrection can bring them back.",
  Poisoned:    "Disadvantage on attack rolls and ability checks.",
  Blinded:     "Can't see. Attack rolls have disadvantage; attacks against have advantage.",
  Frightened:  "Disadvantage on ability checks and attacks while the source of fear is in sight. Can't move closer to it.",
  Paralyzed:   "Incapacitated, can't move or speak. Fails STR/DEX saves. Attacks within 5ft are automatic crits.",
  Stunned:     "Incapacitated, can't move, and can only speak falteringly. Fails STR/DEX saves. Attacks have advantage.",
  Prone:       "Must crawl to move; standing costs half speed. Melee attacks have advantage; ranged attacks have disadvantage.",
  Charmed:     "Can't attack the charmer. The charmer has advantage on social ability checks against the target.",
  Exhausted:   "Stacking penalties: 1=disadv. on checks, 3=disadv. on attacks & saves, 5=max HP halved, 6=death.",
  Restrained:  "Speed becomes 0. Attack rolls have disadvantage; attacks against have advantage. Disadvantage on DEX saves.",
  Petrified:   "Transformed to stone. Incapacitated, immune to poison & disease, resistance to all damage.",
};

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
  const [showDice,         setShowDice]          = useState(false);
  const [showChatHint,     setShowChatHint]      = useState(false);
  const [character,        setCharacter]         = useState<Character | null>(null);
  const [stateNotice,      setStateNotice]       = useState<string | null>(null);
  const [players,          setPlayers]           = useState<PresencePlayer[]>([]);
  const [userId,           setUserId]            = useState<string | null>(null);
  const [partyChangePending, setPartyChangePending] = useState(false);
  const [linkCopied,       setLinkCopied]        = useState(false);
  const [sidebarTab,       setSidebarTab]        = useState<"party" | "sheet" | "log" | "combat">("party");
  const [enemies,          setEnemies]           = useState<CampaignEnemy[]>([]);
  const [combatActive,     setCombatActive]      = useState(false);

  // Narration
  const [narrationEnabled, setNarrationEnabled]  = useState(true);
  const [toastMsg,         setToastMsg]          = useState<string | null>(null);
  const [narrating,        setNarrating]         = useState(false);
  const [selectedVoice,    setSelectedVoice]     = useState<string>("chronicler");
  const [voicePickerOpen,  setVoicePickerOpen]   = useState(false);
  const [testingVoice,     setTestingVoice]      = useState<string | null>(null);
  const selectedVoiceRef = useRef<string>("chronicler");
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
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(({ audioUrl }: { audioUrl?: string }) => {
        const audio = previewAudioRef.current;
        if (!audio || !audioUrl) { setTestingVoice(null); return; }
        audio.src     = audioUrl;
        audio.onended = () => { setTestingVoice(null); };
        audio.onerror = () => { setTestingVoice(null); };
        audio.play().catch(() => setTestingVoice(null));
      })
      .catch(() => setTestingVoice(null));
  }

  // Campaign party (characters linked to this campaign — always visible)
  const [campaignParty,    setCampaignParty]      = useState<Character[]>([]);
  const [activeCharIdx,    setActiveCharIdx]      = useState(0);

  // Session / turns
  const [sessionStarted,   setSessionStarted]    = useState(false);
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
  const [tradeTarget,      setTradeTarget]        = useState<Character | null>(null);
  const [tradeItems,       setTradeItems]         = useState<{ name: string; type: "item" | "weapon" }[]>([]);
  const [tradeGold,        setTradeGold]          = useState(0);
  const [incomingTrade,    setIncomingTrade]      = useState<TradeOffer | null>(null);
  const [tradingItemKey,   setTradingItemKey]     = useState<string | null>(null);
  const [tradingCurrency,  setTradingCurrency]   = useState(false);
  const [currencyAmount,   setCurrencyAmount]    = useState("");
  const [currencyDenom,    setCurrencyDenom]     = useState<"cp"|"sp"|"ep"|"gp"|"pp">("gp");
  const [currencyTarget,   setCurrencyTarget]    = useState<Character | null>(null);

  // Stat tooltip hover
  const [hoveredStat,      setHoveredStat]        = useState<string | null>(null);

  // Item / status tooltip hover
  const [hoveredItem,      setHoveredItem]        = useState<string | null>(null);
  const [hoveredSpell,     setHoveredSpell]       = useState<string | null>(null);
  const [hoveredStatus,    setHoveredStatus]      = useState<string | null>(null);

  // Party management
  const [userRoster,       setUserRoster]         = useState<Character[]>([]);
  const [managePartyOpen,  setManagePartyOpen]    = useState(false);
  const [partyLeaderId,    setPartyLeaderId]       = useState<string | null>(null);

  // Dice-roll targeting — character name the DM just asked to roll
  const [diceRollTarget,      setDiceRollTarget]      = useState<string | null>(null);
  // Which die type the DM is requesting (4, 6, 8, 10, 12, 20, 100 — null = player's choice)
  const [requiredDiceType,    setRequiredDiceType]    = useState<number | null>(null);
  // userId of the player the DM explicitly called on to roll — gates isMyTurn
  const [rollRequestedUserId, setRollRequestedUserId] = useState<string | null>(null);
  // Enemy targeting — which enemy the player is focusing on
  const [targetedEnemyId,   setTargetedEnemyId]   = useState<string | null>(null);

  // Guest join (invite link flow)
  const [showGuestJoin,      setShowGuestJoin]      = useState(false);
  const [guestJoining,       setGuestJoining]       = useState(false);
  const [guestError,         setGuestError]         = useState<string | null>(null);
  const [guestRosterChars,   setGuestRosterChars]   = useState<Character[]>([]);
  const [selectedRosterChar, setSelectedRosterChar] = useState<Character | null>(null);

  // Read once from URL — stable across renders
  const inviteToken = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("invite");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the invite overlay opens, pre-load any characters this user already owns
  useEffect(() => {
    if (!showGuestJoin) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("characters").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
        .then(({ data }) => {
          const available = ((data ?? []) as Character[]).filter(c => c.campaign_id !== params.id);
          setGuestRosterChars(available);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGuestJoin]);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const messagesEndRef       = useRef<HTMLDivElement>(null);
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
  const prevPlayerDataRef    = useRef<Map<string, PresencePlayer>>(new Map());
  const isInitialPresenceRef = useRef(true);
  const narratePartyEventRef = useRef<((type: "join"|"leave"|"kick", player: PresencePlayer) => void) | null>(null);
  const turnOrderRef         = useRef<string[]>([]);
  const currentTurnIndexRef  = useRef(0);
  const pendingJoinsRef      = useRef<PresencePlayer[]>([]);
  const joinDebounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLeavesRef     = useRef<PresencePlayer[]>([]);
  const leaveDebounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSceneRef        = useRef<string>("");
  const enemiesRef             = useRef<CampaignEnemy[]>([]);
  const rollRequestedUserIdRef = useRef<string | null>(null);
  const resumeNarrationRef   = useRef<string>("");
  const autoOpenedRef        = useRef(false);
  // Ordered narration slot system — ensures sentences always play in the order they were sent
  const narSlotCounterRef    = useRef(0);
  const narSlotsRef          = useRef<(string | "SKIP" | null)[]>([]);
  const narPlaySlotRef       = useRef(0);
  const campaignPartyRef     = useRef<Character[]>([]);
  const pendingSpellCastRef  = useRef<number>(0);
  const playersRef           = useRef<PresencePlayer[]>([]);

  // ── Ref sync effects ─────────────────────────────────────────────────────────
  useEffect(() => { characterRef.current        = character;        }, [character]);
  useEffect(() => { campaignPartyRef.current    = campaignParty;    }, [campaignParty]);
  useEffect(() => { userIdRef.current           = userId;           }, [userId]);
  useEffect(() => { selectedVoiceRef.current    = selectedVoice;    }, [selectedVoice]);
  useEffect(() => { messagesRef.current         = messages;         }, [messages]);
  useEffect(() => { isTypingRef.current         = isTyping;         }, [isTyping]);
  useEffect(() => { narrationEnabledRef.current = narrationEnabled;  }, [narrationEnabled]);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 8000);
    return () => clearTimeout(t);
  }, [toastMsg]);
  useEffect(() => { turnOrderRef.current        = turnOrder;        }, [turnOrder]);
  useEffect(() => { currentTurnIndexRef.current = currentTurnIndex; }, [currentTurnIndex]);
  useEffect(() => { campaignDescriptionRef.current = campaignDescription; }, [campaignDescription]);
  useEffect(() => { enemiesRef.current             = enemies;             }, [enemies]);
  useEffect(() => { playersRef.current            = players;             }, [players]);
  useEffect(() => { rollRequestedUserIdRef.current = rollRequestedUserId; }, [rollRequestedUserId]);
  useEffect(() => { roundActionsRef.current = roundActions; }, [roundActions]);

  // Build turn order from campaign party (character IDs sorted by name) — works with any number of accounts
  useEffect(() => {
    if (!campaignParty.length) return;
    const order = [...campaignParty]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => c.id);
    turnOrderRef.current = order;
    setTurnOrder(order);
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

      const [charRes, historyRes, partyRes, campRes, enemiesRes] = await Promise.all([
        // Load ALL of the current user's characters (no limit — used for roster + active char)
        supabase.from("characters").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("campaign_messages").select("role, content, sender, created_at").eq("campaign_id", params.id).order("created_at", { ascending: true }),
        // Fetch all characters in this campaign; filter party_active in JS so the
        // query never fails if the column is NULL or the migration hasn't run yet.
        supabase.from("characters").select("*").eq("campaign_id", params.id).order("created_at"),
        supabase.from("campaigns").select("*").eq("id", params.id).single(),
        supabase.from("campaign_enemies").select("*").eq("campaign_id", params.id).eq("is_defeated", false).order("created_at"),
      ]);

      if (campRes.data?.title) setCampaignTitle(campRes.data.title);
      if (campRes.data?.description) {
        setCampaignDescription(campRes.data.description);
        campaignDescriptionRef.current = campRes.data.description;
      }
      const loadedLeaderCharId = (campRes.data as { party_leader_id?: string } | null)?.party_leader_id ?? null;
      setPartyLeaderId(loadedLeaderCharId);
      if (campRes.error) console.error("[campaign] title fetch:", campRes.error.message);

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

      const party = (partyRes.data ?? []) as Character[];

      // Gate access: only campaign owner or party members may enter without an invite
      const userInParty = party.some(c => c.user_id === user.id);
      const isOwner     = campRes.data?.user_id === user.id;
      if (!userInParty && !isOwner) {
        if (inviteToken) { setShowGuestJoin(true); return; }
        router.push("/dashboard");
        return;
      }

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
              supabase.from("characters").update({ hp: c.hp }).eq("id", c.id).then(() => {});
            }
          });
        }
        const fixedParty = normalizedParty;
        setCampaignParty(fixedParty);
        campaignPartyRef.current = fixedParty;
        // Set active character to the current user's own character in the party
        const myChar = fixedParty.find(c => c.user_id === user.id) ?? (charRes.data?.[0] as Character | undefined);
        const myIdx  = fixedParty.findIndex(c => c.user_id === user.id);
        if (myChar) { setCharacter(myChar); characterRef.current = myChar; }
        if (myIdx >= 0) setActiveCharIdx(myIdx);

        // Auto-assign party leader to first character if unset — only campaign owner does this to avoid races
        if (!loadedLeaderCharId && user.id === campRes.data?.user_id) {
          const firstCharId = party[0].id;
          supabase.from("campaigns").update({ party_leader_id: firstCharId }).eq("id", params.id).then(() => {});
          setPartyLeaderId(firstCharId);
        }
      } else if (charRes.data?.[0]) {
        setCharacter(charRes.data[0] as Character);
      }

      // Trigger portrait generation for any of the current user's party characters missing one
      const myPartyChars = party.filter(c => c.user_id === user.id && !c.portrait_url);
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
          // Restore suggestions — turn order not known yet on resume so always generate
          if (characterRef.current) {
            fetch("/api/suggest-actions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dmResponse: lastDm.content, character: characterRef.current }),
            }).then(r => r.json()).then(({ suggestions: s }) => setSuggestions(s ?? [])).catch(() => {});
          }
          // Restore the scene image — detect-scene hits its DB cache so this is fast
          fetch("/api/detect-scene", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ narrative: lastDm.content, currentScene: "", campaignDescription: campaignDescriptionRef.current }),
          })
            .then(r => r.json())
            .then(({ sceneName, imageUrl, sceneType, modifiers, description }: { sceneName: string; imageUrl: string | null; sceneType?: string; modifiers?: string[]; description?: string }) => {
              if (imageUrl) { currentSceneRef.current = sceneName; setCurrentSceneUrl(imageUrl); (window as { __dndSetMusicScene?: (s: string) => void }).__dndSetMusicScene?.(sceneName); }
              if (sceneName && sceneType) {
                fetch("/api/generate-scene-audio", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sceneKey: sceneName, sceneType, modifiers: modifiers ?? [], description: description ?? "", isCombat: false }),
                })
                  .then(r => r.json())
                  .then(({ audioUrl }: { audioUrl: string | null }) => {
                    if (audioUrl) (window as Window & { __dndSetAmbiance?: (url: string | null) => void }).__dndSetAmbiance?.(audioUrl);
                  })
                  .catch(() => {});
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
        // Push updated portrait to presence so other players see it immediately
        if (characterRef.current?.id === updated.id && channelRef.current) {
          channelRef.current.track({
            userId: userIdRef.current!,
            characterName:  characterRef.current.name,
            characterClass: characterRef.current.class,
            hp:             characterRef.current.hp,
            maxHp:          characterRef.current.max_hp,
            portraitUrl:    url,
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // ── Realtime ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !character) return;

    const channel = supabase.channel(`campaign:${params.id}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const all = Object.values(channel.presenceState<PresencePlayer>()).flat();
        setPlayers(all);
        // Sync live HP from presence into campaignParty so cards update in real-time
        setCampaignParty(prev => prev.map(char => {
          const online = all.find(p => p.userId === char.user_id);
          return (online && online.hp !== char.hp) ? { ...char, hp: online.hp } : char;
        }));

        if (isInitialPresenceRef.current) {
          isInitialPresenceRef.current = false;
          all.forEach(p => prevPlayerDataRef.current.set(p.userId, p));
          return;
        }

        const currentIds = new Set(all.map(p => p.userId));
        const prev = prevPlayerDataRef.current;
        all.forEach(p => { if (!prev.has(p.userId) && p.userId !== userIdRef.current) narratePartyEventRef.current?.("join", p); });
        prev.forEach((p, id) => { if (!currentIds.has(id) && id !== userIdRef.current) narratePartyEventRef.current?.("leave", p); });
        prevPlayerDataRef.current = new Map(all.map(p => [p.userId, p]));
      })
      .on("broadcast", { event: "player_kicked" }, ({ payload }) => {
        if (payload.targetUserId === userIdRef.current) router.push("/dashboard");
      })
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
        setDiceRollTarget(rollTarget);
        setRequiredDiceType(detectRequiredDiceType(payload.content as string));
        // roll_request broadcast syncs the turn — no need to re-derive userId here
        fetch("/api/chat-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: payload.content }) })
          .then(r => r.json()).then((change: StateChange) => applyStateChange(change)).catch(() => {});
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
        // Full stat sync — replaces character_hp_update for all state changes
        const p = payload as {
          charId: string; hp: number; max_hp: number;
          xp?: number; level?: number;
          inventory?: Character["inventory"];
          spell_slots_used?: Record<number, number>;
          status_effects?: string[];
        };
        setCampaignParty(prev => prev.map(c => {
          if (c.id !== p.charId) return c;
          return {
            ...c,
            hp:      p.hp,
            max_hp:  p.max_hp,
            ...(p.xp              !== undefined && { xp:              p.xp              }),
            ...(p.level           !== undefined && { level:           p.level           }),
            ...(p.inventory       !== undefined && { inventory:       p.inventory       }),
            ...(p.spell_slots_used !== undefined && { spell_slots_used: p.spell_slots_used }),
            ...(p.status_effects  !== undefined && { status_effects:  p.status_effects  }),
          };
        }));
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
        if (payload.fromUserId === userIdRef.current) return;
        setDroppedItems(prev => [...prev, payload as DroppedItem]);
      })
      .on("broadcast", { event: "item_taken" }, ({ payload }) => {
        setDroppedItems(prev => prev.filter(i => i.id !== payload.id));
      })
      .on("broadcast", { event: "trade_offer" }, ({ payload }) => {
        const offer = payload as TradeOffer;
        if (offer.toUserId !== userIdRef.current) return;
        setIncomingTrade(offer);
      })
      .on("broadcast", { event: "trade_accepted" }, ({ payload }) => {
        const offer = payload as TradeOffer;
        if (offer.fromUserId !== userIdRef.current) return;
        const char = characterRef.current;
        if (!char || char.id !== offer.fromCharId) return;
        let items   = [...char.inventory.items];
        let weapons = [...char.inventory.weapons];
        offer.offeredItems.forEach(oi => {
          if (oi.type === "item")   { const idx = items.indexOf(oi.name);   if (idx !== -1) items.splice(idx, 1); }
          else                      { const idx = weapons.indexOf(oi.name); if (idx !== -1) weapons.splice(idx, 1); }
        });
        const newGold = Math.max(0, (char.inventory.gold ?? 0) - offer.offeredGold);
        const newInv  = { ...char.inventory, gold: newGold, items, weapons };
        setCharacter(prev => prev ? { ...prev, inventory: newInv } : null);
        setCampaignParty(prev => prev.map(c => c.id === char.id ? { ...c, inventory: newInv } : c));
        supabase.from("characters").update({ inventory: newInv }).eq("id", char.id);
        const toName = campaignPartyRef.current.find(c => c.id === offer.toCharId)?.name ?? "party member";
        setStateNotice(`Trade complete — items sent to ${toName}.`);
        setTimeout(() => setStateNotice(null), 4000);
      })
      .on("broadcast", { event: "trade_declined" }, ({ payload }) => {
        const p = payload as { fromUserId: string; fromCharName?: string };
        if (p.fromUserId !== userIdRef.current) return;
        setStateNotice("Your trade offer was declined.");
        setTimeout(() => setStateNotice(null), 3000);
      })
      .on("broadcast", { event: "item_gifted" }, ({ payload }) => {
        const p = payload as { toUserId: string; toCharId: string; itemName: string; itemType: "item" | "weapon"; fromCharName: string };
        if (p.toUserId !== userIdRef.current) return;
        const char = characterRef.current;
        if (!char || char.id !== p.toCharId) return;
        const newInv = { ...char.inventory,
          items:   p.itemType === "item"   ? [...char.inventory.items, p.itemName]   : char.inventory.items,
          weapons: p.itemType === "weapon" ? [...char.inventory.weapons, p.itemName] : char.inventory.weapons,
        };
        setCharacter(prev => prev ? { ...prev, inventory: newInv } : null);
        setCampaignParty(prev => prev.map(c => c.id === char.id ? { ...c, inventory: newInv } : c));
        supabase.from("characters").update({ inventory: newInv }).eq("id", char.id);
        setStateNotice(`${p.fromCharName} gave you ${p.itemName}!`);
        setTimeout(() => setStateNotice(null), 4000);
      })
      .on("broadcast", { event: "currency_gifted" }, ({ payload }) => {
        const p = payload as { toUserId: string; toCharId: string; amount: number; denom: "cp"|"sp"|"ep"|"gp"|"pp"; fromCharName: string };
        if (p.toUserId !== userIdRef.current) return;
        const char = characterRef.current;
        if (!char || char.id !== p.toCharId) return;
        const denomKey = p.denom === "gp" ? "gold" : p.denom;
        const cur = (char.inventory[denomKey as keyof typeof char.inventory] as number | undefined) ?? 0;
        const newInv = { ...char.inventory, [denomKey]: cur + p.amount };
        setCharacter(prev => prev ? { ...prev, inventory: newInv } : null);
        setCampaignParty(prev => prev.map(c => c.id === char.id ? { ...c, inventory: newInv } : c));
        supabase.from("characters").update({ inventory: newInv }).eq("id", char.id);
        setStateNotice(`${p.fromCharName} sent you ${p.amount}${p.denom}!`);
        setTimeout(() => setStateNotice(null), 4000);
      })
      .on("broadcast", { event: "scene_change" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        if (payload.imageUrl) {
          currentSceneRef.current = payload.sceneName;
          setCurrentSceneUrl(payload.imageUrl);
          (window as Window).__dndSetMusicScene?.(payload.sceneName as string);
        }
      })
      .on("broadcast", { event: "ambiance_change" }, ({ payload }) => {
        if (payload.audioUrl) (window as Window).__dndSetAmbiance?.(payload.audioUrl as string);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId,
            characterName:  character.name,
            characterClass: character.class,
            hp:             character.hp,
            maxHp:          character.max_hp,
            portraitUrl:    character.portrait_url ?? null,
          });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel); channelRef.current = null;
      if (joinDebounceRef.current)  { clearTimeout(joinDebounceRef.current);  joinDebounceRef.current  = null; }
      if (leaveDebounceRef.current) { clearTimeout(leaveDebounceRef.current); leaveDebounceRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, character?.id, params.id]);

  // Re-track when HP changes or active character switches
  useEffect(() => {
    if (!channelRef.current || !character || !userId) return;
    channelRef.current.track({
      userId,
      characterName:  character.name,
      characterClass: character.class,
      hp:             character.hp,
      maxHp:          character.max_hp,
      portraitUrl:    character.portrait_url ?? null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.hp, character?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingContent]);
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

  // When DM names a player to roll: auto-open their dice panel
  // Turn does NOT advance — rollRequestedUserId gates who can submit
  useEffect(() => {
    if (!diceRollTarget || !character) return;
    if (diceRollTarget.toLowerCase() === character.name.toLowerCase()) {
      setShowDice(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceRollTarget]);

  // ── State changes (HP, gold, items, XP) ──────────────────────────────────────
  const applyStateChange = useCallback(async (change: StateChange) => {
    const char = characterRef.current;
    if (!char) return;
    // HP changes require an explicit name match — never apply damage/healing when the target is ambiguous
    if (change.hp_delta !== 0) {
      const nameMatch = change.target_name &&
        change.target_name.toLowerCase() === char.name.toLowerCase();
      if (!nameMatch) change = { ...change, hp_delta: 0 };
    }
    // Non-HP changes (XP, gold, items) skip this character if the DM named someone else
    if (change.target_name && change.target_name.toLowerCase() !== char.name.toLowerCase()) return;
    const hasChange =
      change.hp_delta !== 0 || change.gold_delta !== 0 ||
      change.items_gained.length > 0 || change.items_lost.length > 0 ||
      change.weapons_gained.length > 0 || change.xp_award > 0 ||
      change.status_effects_gained.length > 0 || change.status_effects_lost.length > 0 ||
      change.spell_slots_used > 0;
    if (!hasChange) return;

    const charIb         = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
    const effectiveMaxHp = char.max_hp + charIb.hpMaxAdd;
    const newHp          = Math.max(0, Math.min(effectiveMaxHp, char.hp + change.hp_delta));
    const newGold    = Math.max(0, (char.inventory?.gold ?? 0) + change.gold_delta);
    const newItems   = [...(char.inventory?.items ?? []).filter(i => !change.items_lost.includes(i)), ...change.items_gained];
    const newWeapons = [...(char.inventory?.weapons ?? []), ...change.weapons_gained];

    // Status effects
    let newStatuses = [...(char.status_effects ?? [])];
    if (newHp === 0 && !newStatuses.includes("Unconscious")) newStatuses.push("Unconscious");
    if (newHp > 0 && newHp <= effectiveMaxHp) newStatuses = newStatuses.filter(s => s !== "Unconscious");
    change.status_effects_gained.forEach(s => { if (!newStatuses.includes(s)) newStatuses.push(s); });
    newStatuses = newStatuses.filter(s => !change.status_effects_lost.includes(s));

    // Spell slots — skip deduction if the player already paid via click-cast
    const newSlotsUsed = { ...(char.spell_slots_used ?? {}) };
    if (change.spell_slots_used > 0) {
      if (pendingSpellCastRef.current > 0) {
        pendingSpellCastRef.current = Math.max(0, pendingSpellCastRef.current - change.spell_slots_used);
      } else {
        newSlotsUsed[1] = (newSlotsUsed[1] ?? 0) + change.spell_slots_used;
      }
    }

    const parts: string[] = [];
    if (change.hp_delta < 0) parts.push(`${Math.abs(change.hp_delta)} damage taken`);
    if (change.hp_delta > 0) parts.push(`+${change.hp_delta} HP restored`);
    if (change.gold_delta > 0) parts.push(`+${change.gold_delta}gp`);
    if (change.gold_delta < 0) parts.push(`${change.gold_delta}gp`);
    change.items_gained.forEach(i   => parts.push(`+${i}`));
    change.weapons_gained.forEach(w => parts.push(`+${w}`));
    change.status_effects_gained.forEach(s => parts.push(`⚡ ${s}`));
    change.status_effects_lost.forEach(s   => parts.push(`✓ ${s} cleared`));
    if (change.spell_slots_used > 0) parts.push(`${change.spell_slots_used} spell slot${change.spell_slots_used > 1 ? "s" : ""} used`);
    if (newHp === 0 && change.hp_delta < 0) parts.push("💀 UNCONSCIOUS");

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
    setCharacter(updatedChar);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updatedChar : c));

    const dbUpdate: Record<string, unknown> = {
      hp: newHp, inventory: updatedChar.inventory, xp: newXp,
      status_effects: newStatuses, spell_slots_used: newSlotsUsed,
    };
    if (leveledUp) { dbUpdate.level = newLevel; dbUpdate.max_hp = newMaxHp; }
    await supabase.from("characters").update(dbUpdate).eq("id", char.id);

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
    if (entry === "SKIP") { playNextInQueue(); return; }

    const el = narAudioRef.current;
    if (!el) { playNextInQueue(); return; }

    audioPlayingRef.current = true;

    const cleanup = () => {
      audioPlayingRef.current = false;
      if (narPlaySlotRef.current >= narSlotCounterRef.current) setNarrating(false);
      playNextInQueue();
    };

    el.onended = cleanup;
    el.onerror = () => cleanup();
    el.src = entry as string;
    setNarrating(true);
    const p = el.play();
    if (p instanceof Promise) p.catch(() => cleanup());
  }, []);

  const enqueueNarration = useCallback(async (text: string) => {
    const slot = narSlotCounterRef.current++;
    narSlotsRef.current[slot] = null; // reserve — not ready yet
    try {
      const res = await fetch("/api/narrate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, voice: selectedVoiceRef.current ?? "chronicler" }),
      });
      if (!res.ok) {
        if (res.status === 402) {
          setNarrationEnabled(false);
          narrationEnabledRef.current = false;
          setToastMsg("Voice narration quota reached — upgrade your ElevenLabs plan to re-enable it.");
        }
        narSlotsRef.current[slot] = "SKIP";
      } else {
        const { audioUrl } = await res.json() as { audioUrl?: string };
        // Set the CDN URL directly — the <audio> element must never see the slow
        // API URL. Xbox Edge times out if the audio src takes more than ~1 s to
        // respond; Supabase CDN responds in milliseconds.
        narSlotsRef.current[slot] = audioUrl ?? "SKIP";
      }
    } catch {
      narSlotsRef.current[slot] = "SKIP";
    }
    playNextInQueue();
  }, [playNextInQueue]);

  // ── Party join/leave narration ────────────────────────────────────────────────
  // Joins are debounced 8 s so multiple arrivals batch into one DM announcement.
  // Leave / kick fire immediately.
  const fireDmPartyResponse = useCallback(async (trigger: Message) => {
    if (isTypingRef.current) return;
    setPartyChangePending(false);
    setIsTyping(true); isTypingRef.current = true;
    setStreamingContent("");
    narSlotCounterRef.current = 0; narSlotsRef.current = []; narPlaySlotRef.current = 0;
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
          const m = narBuf.match(/^([\s\S]{60,}?[.!?…]["']?)\s+/);
          if (m) { enqueueNarration(m[1]); narBuf = narBuf.slice(m[0].length); }
        }
      }
      if (narrationEnabledRef.current && narBuf.trim().length > 10) enqueueNarration(narBuf.trim());
      setMessages(prev => [...prev, { role: "dm", content: full }]);
      setLogEntries(prev => [...prev, { id: `dm-${Date.now()}`, timestamp: new Date(), role: "dm", content: full }]);
      supabase.from("campaign_messages").insert([{ campaign_id: params.id, role: "dm", content: full, sender: null }])
        .then(({ error }) => { if (error) console.error("[party event]", error); });
      channelRef.current?.send({ type: "broadcast", event: "dm_response", payload: { senderId: userIdRef.current, content: full } });
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

  const narratePartyEvent = useCallback((type: "join" | "leave" | "kick", player: PresencePlayer) => {
    const label = type === "join" ? `${player.characterName} has joined the party.`
                : type === "kick" ? `${player.characterName} has been removed from the party.`
                :                   `${player.characterName} has left the party.`;
    setMessages(prev => [...prev, { role: "system", content: `⚔ ${label}` }]);
    setLogEntries(prev => [...prev, { id: `party-${Date.now()}`, timestamp: new Date(), role: "system", content: `⚔ ${label}` }]);

    if (type === "join") {
      // Collect arrivals; DM speaks once after 8 s of silence
      pendingJoinsRef.current = [...pendingJoinsRef.current, player];
      if (joinDebounceRef.current) clearTimeout(joinDebounceRef.current);
      joinDebounceRef.current = setTimeout(() => {
        const joins = pendingJoinsRef.current;
        pendingJoinsRef.current = [];
        joinDebounceRef.current = null;
        if (!joins.length) return;
        const arrivals = joins.map(p => `${p.characterName} (${p.characterClass})`).join(", ");
        const content = joins.length === 1
          ? `[Party change — weave naturally into the story: ${joins[0].characterName}, a ${joins[0].characterClass}, has arrived and joined the party]`
          : `[Party change — weave naturally into the story: ${arrivals} have all arrived and joined the party together — acknowledge each of them]`;
        fireDmPartyResponse({ role: "player", content });
      }, 8000);
      return;
    }

    if (type === "kick") {
      // Kick is a deliberate DM action — announce immediately
      const content = `[Party change — weave naturally into the story: ${player.characterName}, a ${player.characterClass}, has been removed from the party]`;
      fireDmPartyResponse({ role: "player", content });
      return;
    }

    // Leave — batch departures the same way as arrivals
    pendingLeavesRef.current = [...pendingLeavesRef.current, player];
    if (leaveDebounceRef.current) clearTimeout(leaveDebounceRef.current);
    leaveDebounceRef.current = setTimeout(() => {
      const leaves = pendingLeavesRef.current;
      pendingLeavesRef.current = [];
      leaveDebounceRef.current = null;
      if (!leaves.length) return;
      const departures = leaves.map(p => `${p.characterName} (${p.characterClass})`).join(", ");
      const content = leaves.length === 1
        ? `[Party change — weave naturally into the story: ${leaves[0].characterName}, a ${leaves[0].characterClass}, has departed from the party]`
        : `[Party change — weave naturally into the story: ${departures} have all departed from the party — acknowledge each of them]`;
      fireDmPartyResponse({ role: "player", content });
    }, 8000);
  }, [fireDmPartyResponse]);

  useEffect(() => { narratePartyEventRef.current = narratePartyEvent; }, [narratePartyEvent]);

  const kickPlayer = useCallback(async (player: PresencePlayer) => {
    const theirChars = campaignPartyRef.current.filter(c => c.user_id === player.userId);
    await Promise.all(theirChars.map(c => supabase.from("characters").update({ campaign_id: null }).eq("id", c.id)));
    channelRef.current?.send({ type: "broadcast", event: "player_kicked", payload: { targetUserId: player.userId } });
    narratePartyEvent("kick", player);
  }, [narratePartyEvent]);

  const kickCharacter = useCallback(async (char: Character) => {
    await supabase.from("characters").update({ campaign_id: null }).eq("id", char.id);
    if (char.user_id) {
      channelRef.current?.send({ type: "broadcast", event: "player_kicked", payload: { targetUserId: char.user_id } });
    }
    const asPresence: PresencePlayer = { userId: char.user_id ?? "", characterName: char.name, characterClass: char.class, hp: char.hp, maxHp: char.max_hp, portraitUrl: char.portrait_url ?? null };
    narratePartyEvent("kick", asPresence);
    setCampaignParty(prev => { const next = prev.filter(c => c.id !== char.id); campaignPartyRef.current = next; return next; });
  }, [narratePartyEvent]);

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
    // Clear temporary status effects on rest
    const newStatuses = (char.status_effects ?? []).filter(s => !["Prone", "Frightened", "Stunned"].includes(s));
    const updated: Character = { ...char, hp: newHp, spell_slots_used: newSlotsUsed, status_effects: newStatuses };
    setCharacter(updated);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updated : c));
    await supabase.from("characters").update({ hp: newHp, spell_slots_used: newSlotsUsed, status_effects: newStatuses }).eq("id", char.id);
    const notice = `Short Rest: d${hitDie} rolled ${roll} + CON ${conMod >= 0 ? "+" : ""}${conMod} = +${gained} HP${isWarlock ? " · Pact slots restored" : ""}`;
    setStateNotice(notice);
    setTimeout(() => setStateNotice(null), 5000);
    setLogEntries(prev => [...prev, { id: `rest-${Date.now()}`, timestamp: new Date(), role: "system", content: `🌙 ${notice}` }]);
  }, []);

  const handleLongRest = useCallback(async () => {
    const char = characterRef.current;
    if (!char) return;
    // Long rest: full HP (including item bonuses), all slots, clear non-permanent conditions
    const longIb      = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
    const longMaxHp   = char.max_hp + longIb.hpMaxAdd;
    const newStatuses = (char.status_effects ?? []).filter(s => s === "Dead" || s === "Petrified");
    const updated: Character = { ...char, hp: longMaxHp, spell_slots_used: {}, status_effects: newStatuses };
    setCharacter(updated);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updated : c));
    await supabase.from("characters").update({ hp: longMaxHp, spell_slots_used: {}, status_effects: newStatuses }).eq("id", char.id);
    const notice = `Long Rest: HP fully restored (${longMaxHp}), spell slots recovered, conditions cleared`;
    setStateNotice(notice);
    setTimeout(() => setStateNotice(null), 6000);
    setLogEntries(prev => [...prev, { id: `rest-${Date.now()}`, timestamp: new Date(), role: "system", content: `☀️ Long Rest — ${char.name} is fully restored.` }]);
  }, []);

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
      supabase.from("characters").update({ hp: u.newHp, spell_slots_used: u.newSlots, status_effects: u.newStatus }).eq("id", u.char.id)
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
  }, []);

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
      supabase.from("characters").update({ hp: u.maxHp, spell_slots_used: {}, status_effects: u.newStatus }).eq("id", u.char.id)
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
  }, []);

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
      if (combat_ended) setCombatActive(false);
    } catch (err) {
      console.error("[updateEnemyStates]", err);
    }
  }, []);

  // ── Dice-roll target detection ────────────────────────────────────────────────
  const detectDiceRollTarget = useCallback((narrative: string): string | null => {
    const names = campaignPartyRef.current.map(c => c.name).filter(Boolean);
    for (const name of names) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`\\b${esc}[,.]?\\s+(?:roll|make|attempt)`, "i"),
        new RegExp(`roll[s]?[^.!?]*?\\bfor\\s+${esc}\\b`, "i"),
        new RegExp(`\\b${esc}[,.]?\\s+(?:you|your)\\s+(?:need|must|have to)`, "i"),
        new RegExp(`\\b${esc}'s?\\s+(?:turn|roll|check|saving throw|save)`, "i"),
        new RegExp(`\\b${esc}[,]\\s+(?:make|give me)`, "i"),
      ];
      if (patterns.some(p => p.test(narrative))) return name;
    }
    return null;
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
  const sendToAI = async (allMessages: Message[], isOpeningScene = false, opts?: { trackRound?: boolean; roundSummary?: { name: string; action: string }[]; nextPlayerName?: string | null; prevPlayerName?: string | null; allActed?: boolean }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset narration queue
    if (narAudioRef.current) { narAudioRef.current.pause(); narAudioRef.current.src = ""; }
    narSlotCounterRef.current = 0; narSlotsRef.current = []; narPlaySlotRef.current = 0;
    audioPlayingRef.current   = false;
    setNarrating(false);

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

      // Build full party context for the DM — only include currently online players
      const onlineUserIds = new Set([
        ...playersRef.current.map(p => p.userId),
        userId, // always include the current user
      ].filter(Boolean));
      const onlineParty = campaignPartyRef.current.filter(
        c => !c.user_id || onlineUserIds.has(c.user_id)
      );

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
        ? (playersRef.current.find(p => p.userId === rollRequestUid)?.characterName
           ?? onlineParty.find(c => c.user_id === rollRequestUid)?.name
           ?? null)
        : null;
      const currentTurnName   = currentTurnCharId
        ? (campaignPartyRef.current.find(c => c.id === currentTurnCharId)?.name ?? null)
        : null;

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
          ...(partyLeaderName && { partyLeaderName }),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("DM unavailable");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full   = "";
      let narBuf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full   += chunk;
        narBuf += chunk;
        setStreamingContent(full);
        // Sentence-level streaming narration — fires TTS as each sentence completes
        if (narrationEnabledRef.current) {
          const m = narBuf.match(/^([\s\S]{60,}?[.!?…]["']?)\s+/);
          if (m) { enqueueNarration(m[1]); narBuf = narBuf.slice(m[0].length); }
        }
      }
      if (narrationEnabledRef.current && narBuf.trim().length > 10) enqueueNarration(narBuf.trim());

      setMessages(prev => [...prev, { role: "dm", content: full }]);
      setLogEntries(prev => [...prev, { id: `dm-${Date.now()}`, timestamp: new Date(), role: "dm", content: full }]);

      // Detect which character the DM is asking to roll, and what die type
      // Safety guard: only honour a roll request for the character whose turn it currently is.
      // If the DM asks a non-active player to roll, discard the request — it should not happen.
      const rollTarget   = detectDiceRollTarget(full);
      const currentTurnCharIdForRoll = turnOrderRef.current[currentTurnIndexRef.current] ?? null;
      const targetChar   = rollTarget ? campaignPartyRef.current.find(c => c.name === rollTarget) : null;
      const isCurrentTurnPlayer = !targetChar || turnOrderRef.current.length <= 1
        || targetChar.id === currentTurnCharIdForRoll;
      const validRollTarget  = isCurrentTurnPlayer ? rollTarget  : null;
      const targetUserId     = isCurrentTurnPlayer ? (targetChar?.user_id ?? null) : null;
      setDiceRollTarget(validRollTarget);
      setRequiredDiceType(detectRequiredDiceType(full));
      setRollRequestedUserId(targetUserId);
      rollRequestedUserIdRef.current = targetUserId;
      channelRef.current?.send({ type: "broadcast", event: "roll_request", payload: { userId: targetUserId } });

      // Enemy combat: spawn enemies when combat starts, or update existing enemy states
      const activeEnemies = enemiesRef.current.filter(e => !e.is_defeated);
      if (activeEnemies.length > 0) {
        updateEnemyStates(full);
      } else if (detectCombatStart(full)) {
        spawnEnemies(full);
      }

      const lastPlayerMsg = allMessages[allMessages.length - 1];
      supabase.from("campaign_messages").insert([
        { campaign_id: params.id, role: lastPlayerMsg.role, content: lastPlayerMsg.content, sender: lastPlayerMsg.sender ?? null },
        { campaign_id: params.id, role: "dm",               content: full,                  sender: null },
      ]).then(({ error }) => { if (error) console.error("[campaign] save:", error); });

      channelRef.current?.send({ type: "broadcast", event: "dm_response", payload: { senderId: userId, content: full } });

      // State changes (HP, gold, items, XP) — skip on opening scene (no player action yet)
      if (!isOpeningScene) {
        fetch("/api/chat-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: full }) })
          .then(r => r.json()).then((change: StateChange) => applyStateChange(change)).catch(() => {});
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

      // Round management: only detect when all players have acted (turn advance already done in handleSend)
      if (opts?.trackRound && !rollTarget) {
        const order = turnOrderRef.current;
        if (order.length > 1) {
          const allActed = order.every(cid => roundActionsRef.current.some(a => a.characterId === cid));
          if (allActed) {
            const summary    = roundActionsRef.current.map(a => ({ name: a.name, action: a.action }));
            const msgsWithDm: Message[] = [...allMessages, { role: "dm", content: full }];
            pendingReconciliationRef.current = { messages: msgsWithDm, summary };
          }
          // Turn advance for non-reconciliation case already happened in handleSend
        }
      }

      // Scene detection (non-blocking — updates background when ready)
      const isCombatNow = enemiesRef.current.some(e => !e.is_defeated);
      setSceneLoading(true);
      fetch("/api/detect-scene", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: full, currentScene: currentSceneRef.current, isCombat: isCombatNow, campaignDescription: campaignDescriptionRef.current }) })
        .then(r => r.json())
        .then(({ sceneName, imageUrl, sceneType, modifiers, description }: { sceneName: string; imageUrl: string | null; sceneType?: string; modifiers?: string[]; description?: string }) => {
          if (imageUrl && sceneName !== currentSceneRef.current) {
            currentSceneRef.current = sceneName;
            setCurrentSceneUrl(imageUrl);
            channelRef.current?.send({ type: "broadcast", event: "scene_change", payload: { senderId: userId, sceneName, imageUrl } });
            (window as Window).__dndSetMusicScene?.(sceneName, sceneType, modifiers);
          }
          // Ambient audio generation (non-blocking, fires whether or not image changed)
          if (sceneType) {
            fetch("/api/generate-scene-audio", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sceneKey: sceneName, sceneType, modifiers: modifiers ?? [], description: description ?? "", isCombat: isCombatNow }),
            })
              .then(r => r.json())
              .then(({ audioUrl }: { audioUrl: string | null }) => {
                if (audioUrl) {
                  (window as Window).__dndSetAmbiance?.(audioUrl);
                  channelRef.current?.send({ type: "broadcast", event: "ambiance_change", payload: { audioUrl } });
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => setSceneLoading(false));

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
    await sendToAI(msgs, false, { roundSummary: summary });
  };

  // ── Player send ───────────────────────────────────────────────────────────────
  const handleSend = async (actionText?: string, bypassTurn = false) => {
    const text = (actionText ?? input).trim();
    if (!text || isTyping || narrating) return;
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

    // Compute next player and advance turn BEFORE awaiting the DM so no bonus actions slip through
    let nextPlayerName: string | null = null;
    if (!isRollSubmit && order.length > 1) {
      const allActedNow = order.every(cid => roundActionsRef.current.some(a => a.characterId === cid));
      if (!allActedNow) {
        const nextIdx = (currentTurnIndexRef.current + 1) % order.length;
        const nextCid = order[nextIdx];
        nextPlayerName = campaignPartyRef.current.find(c => c.id === nextCid)?.name ?? null;
        setCurrentTurnIndex(nextIdx);
        currentTurnIndexRef.current = nextIdx;
        channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex: nextIdx } });
        if (campaignPartyRef.current.length > 1) setActiveCharIdx(prev => (prev + 1) % campaignPartyRef.current.length);
      }
    }

    const allActedForDM = !isRollSubmit && order.length > 1
      && order.every(cid => roundActionsRef.current.some(a => a.characterId === cid));

    pendingReconciliationRef.current = null;
    await sendToAI(updatedMessages, false, {
      trackRound:     order.length > 1,
      nextPlayerName,
      prevPlayerName: character?.name ?? null,
      allActed:       allActedForDM,
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
    await supabase.from("characters").update({ inventory: newInv }).eq("id", char.id);
    setDroppedItems(prev => [...prev, dropped]);
    channelRef.current?.send({ type: "broadcast", event: "item_dropped", payload: dropped });
  }, []);

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
    await supabase.from("characters").update({ inventory: newInv }).eq("id", char.id);
  }, []);

  const sendTradeOffer = useCallback(() => {
    const char = characterRef.current;
    if (!char || !tradeTarget || (tradeItems.length === 0 && tradeGold === 0)) return;
    const offer: TradeOffer = {
      id:           `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fromUserId:   userIdRef.current!,
      fromCharId:   char.id,
      fromCharName: char.name,
      toUserId:     tradeTarget.user_id!,
      toCharId:     tradeTarget.id,
      offeredItems: tradeItems,
      offeredGold:  tradeGold,
    };
    channelRef.current?.send({ type: "broadcast", event: "trade_offer", payload: offer });
    setTradeTarget(null); setTradeItems([]); setTradeGold(0);
    setStateNotice(`Trade offer sent to ${tradeTarget.name}.`);
    setTimeout(() => setStateNotice(null), 3000);
  }, [tradeTarget, tradeItems, tradeGold]);

  const acceptTrade = useCallback(async (offer: TradeOffer) => {
    const char = characterRef.current;
    if (!char) return;
    const newItems   = [...char.inventory.items,   ...offer.offeredItems.filter(i => i.type === "item").map(i => i.name)];
    const newWeapons = [...char.inventory.weapons, ...offer.offeredItems.filter(i => i.type === "weapon").map(i => i.name)];
    const newGold    = (char.inventory.gold ?? 0) + offer.offeredGold;
    const newInv     = { ...char.inventory, gold: newGold, items: newItems, weapons: newWeapons };
    setCharacter(prev => prev ? { ...prev, inventory: newInv } : null);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? { ...c, inventory: newInv } : c));
    await supabase.from("characters").update({ inventory: newInv }).eq("id", char.id);
    channelRef.current?.send({ type: "broadcast", event: "trade_accepted", payload: offer });
    setIncomingTrade(null);
    setStateNotice(`Trade accepted! Received from ${offer.fromCharName}.`);
    setTimeout(() => setStateNotice(null), 4000);
  }, []);

  const declineTrade = useCallback((offer: TradeOffer) => {
    channelRef.current?.send({ type: "broadcast", event: "trade_declined", payload: { id: offer.id, fromUserId: offer.fromUserId } });
    setIncomingTrade(null);
  }, []);

  const giftItem = useCallback(async (itemName: string, itemType: "item" | "weapon", toChar: Character) => {
    const char = characterRef.current;
    if (!char) return;
    const removeFirst = (arr: string[], name: string) => { const i = arr.indexOf(name); return i !== -1 ? [...arr.slice(0, i), ...arr.slice(i + 1)] : arr; };
    const newItems   = itemType === "item"   ? removeFirst(char.inventory.items,   itemName) : char.inventory.items;
    const newWeapons = itemType === "weapon" ? removeFirst(char.inventory.weapons, itemName) : char.inventory.weapons;
    const newInv = { ...char.inventory, items: newItems, weapons: newWeapons };
    setCharacter(prev => prev ? { ...prev, inventory: newInv } : null);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? { ...c, inventory: newInv } : c));
    await supabase.from("characters").update({ inventory: newInv }).eq("id", char.id);
    channelRef.current?.send({ type: "broadcast", event: "item_gifted", payload: {
      toUserId: toChar.user_id, toCharId: toChar.id, itemName, itemType, fromCharName: char.name,
    }});
    setTradingItemKey(null);
    setStateNotice(`${itemName} sent to ${toChar.name}.`);
    setTimeout(() => setStateNotice(null), 3000);
  }, []);

  const giftCurrency = useCallback(async (amount: number, denom: "cp"|"sp"|"ep"|"gp"|"pp", toChar: Character) => {
    const char = characterRef.current;
    if (!char || amount <= 0) return;
    const denomKey = denom === "gp" ? "gold" : denom;
    const current = (char.inventory[denomKey as keyof typeof char.inventory] as number | undefined) ?? 0;
    if (amount > current) { setStateNotice(`Not enough ${denom}.`); setTimeout(() => setStateNotice(null), 2500); return; }
    const newInv = { ...char.inventory, [denomKey]: current - amount };
    setCharacter(prev => prev ? { ...prev, inventory: newInv } : null);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? { ...c, inventory: newInv } : c));
    await supabase.from("characters").update({ inventory: newInv }).eq("id", char.id);
    channelRef.current?.send({ type: "broadcast", event: "currency_gifted", payload: {
      toUserId: toChar.user_id, toCharId: toChar.id, amount, denom, fromCharName: char.name,
    }});
    setTradingCurrency(false);
    setCurrencyAmount("");
    setStateNotice(`${amount}${denom} sent to ${toChar.name}.`);
    setTimeout(() => setStateNotice(null), 3000);
  }, []);

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
    await supabase.from("characters").update({ hp: newHp, inventory: newInv }).eq("id", char.id);

    const notice = parts.join(" · ");
    setStateNotice(notice);
    setTimeout(() => setStateNotice(null), 5000);
    setLogEntries(prev => [...prev, { id: `use-${Date.now()}`, timestamp: new Date(), role: "system", content: `🧪 ${notice}` }]);
  }, []);

  // ── Party management ─────────────────────────────────────────────────────────
  const addToParty = useCallback(async (char: Character) => {
    if (campaignPartyRef.current.some(c => c.id === char.id)) return;

    let updated: Character;

    if (char.campaign_id !== params.id) {
      // Joining a new campaign — reset to full D&D 5e starting metrics
      const ib      = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
      const freshHp = char.max_hp + ib.hpMaxAdd;
      const { error } = await supabase.from("characters").update({
        campaign_id:      params.id,
        hp:               freshHp,
        spell_slots_used: {},
        status_effects:   [],
      }).eq("id", char.id);
      if (error) { console.error("[addToParty]", error); return; }
      updated = { ...char, campaign_id: params.id, hp: freshHp, spell_slots_used: {}, status_effects: [] };
    } else {
      // Returning to this campaign — preserve damage, but ensure item HP bonuses are reflected
      const ib = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
      const effectiveMax = char.max_hp + ib.hpMaxAdd;
      // If HP is at or above base max (fresh join or fully rested), bring to full effective max
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
    narratePartyEvent("join", { userId: userIdRef.current!, characterName: updated.name, characterClass: updated.class, hp: updated.hp, maxHp: updated.max_hp, portraitUrl: updated.portrait_url ?? null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, narratePartyEvent]);

  const leaveParty = useCallback(async (charId: string) => {
    const char = campaignPartyRef.current.find(c => c.id === charId);
    if (!char) return;
    // Persist the removal — clear campaign_id so they don't appear on future loads
    await supabase.from("characters").update({ campaign_id: null }).eq("id", charId);
    const newParty = campaignPartyRef.current.filter(c => c.id !== charId);
    setCampaignParty(newParty);
    campaignPartyRef.current = newParty;
    if (characterRef.current?.id === charId) {
      const next = newParty.find(c => c.user_id === userIdRef.current) ?? newParty[0] ?? null;
      setCharacter(next); characterRef.current = next;
      setActiveCharIdx(next ? newParty.indexOf(next) : 0);
    }
    setPartyChangePending(true);
    narratePartyEvent("leave", { userId: char.user_id ?? userIdRef.current!, characterName: char.name, characterClass: char.class, hp: char.hp, maxHp: char.max_hp, portraitUrl: char.portrait_url ?? null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narratePartyEvent]);

  const handleDiceResult = (result: number, diceType: number) => {
    setShowDice(false);
    setRequiredDiceType(null);
    handleSend(`[Rolled a ${result} on a d${diceType}]`, true);
  };

  const handleGuestJoin = async () => {
    if (!selectedRosterChar) { setGuestError("Select a character to continue."); return; }
    setGuestJoining(true);
    setGuestError(null);
    try {
      const verifyRes = await fetch("/api/campaign-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken, campaignId: params.id }),
      });
      if (!verifyRes.ok) { setGuestError("This invite link is invalid. Ask for a new one."); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setGuestError("Session expired. Please refresh."); return; }

      const guestIb     = computeInventoryBonuses(selectedRosterChar.inventory?.items ?? [], selectedRosterChar.inventory?.weapons ?? []);
      const guestFullHp = selectedRosterChar.max_hp + guestIb.hpMaxAdd;
      const { error: upErr } = await supabase.from("characters").update({ campaign_id: params.id, hp: guestFullHp, spell_slots_used: {}, status_effects: [] }).eq("id", selectedRosterChar.id);
      if (upErr) { setGuestError("Could not join campaign. Try again."); return; }

      const char: Character = { ...selectedRosterChar, campaign_id: params.id, hp: guestFullHp, spell_slots_used: {}, status_effects: [] };
      const joinUserId = user.id;

      // ── Shared: wire up state and load campaign data ─────────────────────
      setUserId(joinUserId);
      userIdRef.current = joinUserId;
      setCharacter(char);
      characterRef.current = char;
      setUserRoster(prev => prev.some(c => c.id === char.id) ? prev.map(c => c.id === char.id ? char : c) : [...prev, char]);
      setCampaignParty(prev => {
        const next = prev.some(c => c.id === char.id) ? prev.map(c => c.id === char.id ? char : c) : [...prev, char];
        campaignPartyRef.current = next;
        return next;
      });
      setActiveCharIdx(campaignPartyRef.current.findIndex(c => c.id === char.id));

      const [historyRes, campRes] = await Promise.all([
        supabase.from("campaign_messages").select("role, content, sender, created_at").eq("campaign_id", params.id).order("created_at", { ascending: true }),
        supabase.from("campaigns").select("*").eq("id", params.id).single(),
      ]);
      if (campRes.data?.title) setCampaignTitle(campRes.data.title);
      if (campRes.data?.description) { setCampaignDescription(campRes.data.description); campaignDescriptionRef.current = campRes.data.description; }
      setPartyLeaderId((campRes.data as { party_leader_id?: string } | null)?.party_leader_id ?? null);

      if (historyRes.data?.length) {
        const hist = historyRes.data as (Message & { created_at?: string })[];
        setMessages([...OPENING_MESSAGES, ...hist]);
        setLogEntries(hist.map((m, i) => ({ id: `hist-${i}`, timestamp: m.created_at ? new Date(m.created_at) : new Date(), role: m.role as MsgRole, sender: m.sender, content: m.content })));
        const lastDm = [...hist].reverse().find(m => m.role === "dm");
        if (lastDm) {
          resumeNarrationRef.current = lastDm.content;
          // Restore suggestions on resume
          if (characterRef.current) {
            fetch("/api/suggest-actions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dmResponse: lastDm.content, character: characterRef.current }),
            }).then(r => r.json()).then(({ suggestions: s }) => setSuggestions(s ?? [])).catch(() => {});
          }
          fetch("/api/detect-scene", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: lastDm.content, currentScene: "", campaignDescription: campaignDescriptionRef.current }) })
            .then(r => r.json())
            .then(({ sceneName, imageUrl }: { sceneName: string; imageUrl: string | null }) => { if (imageUrl) { currentSceneRef.current = sceneName; setCurrentSceneUrl(imageUrl); (window as { __dndSetMusicScene?: (s: string) => void }).__dndSetMusicScene?.(sceneName); } })
            .catch(() => {});
        }
      }
      setShowGuestJoin(false);
    } finally {
      setGuestJoining(false);
    }
  };
  const copyInviteLink = async () => {
    try {
      const res  = await fetch(`/api/campaign-invite?campaignId=${params.id}`);
      const data = await res.json() as { url?: string };
      await navigator.clipboard.writeText(data.url ?? window.location.href);
    } catch {
      await navigator.clipboard.writeText(window.location.href);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const otherPlayers        = players.filter(p => p.userId !== userId);
  const currentTurnPlayerId = turnOrder[currentTurnIndex] ?? null;
  const isPartyLeader       = !!character && character.id === partyLeaderId;
  const leaderChar          = campaignParty.find(c => c.id === partyLeaderId) ?? null;
  const isMyTurn            = rollRequestedUserId
    ? rollRequestedUserId === userId
    : (turnOrder.length <= 1 || currentTurnPlayerId === character?.id);
  const allPartyCards       = players.slice().sort((a, b) => a.characterName.localeCompare(b.characterName));

  const xpToNext   = character ? getXpToNextLevel(character.level) : 300;
  const xpPercent  = character ? Math.min(100, ((character.xp ?? 0) / xpToNext) * 100) : 0;

  const STAT_KEY_MAP: Record<string, string> = {
    STR: "strength", DEX: "dexterity", CON: "constitution",
    INT: "intelligence", WIS: "wisdom", CHA: "charisma",
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
      {showDice && <DiceRoller onRollComplete={handleDiceResult} requiredDice={requiredDiceType} />}
      {toastMsg && (
        <div onClick={() => setToastMsg(null)} style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "rgba(127,29,29,0.95)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: "10px", padding: "12px 20px", color: "#fca5a5", fontSize: "0.85rem", maxWidth: "420px", textAlign: "center", cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          🔇 {toastMsg}
        </div>
      )}

      {/* Join overlay — shown when arriving via invite link; requires a roster character */}
      {showGuestJoin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,3,15,0.97)", zIndex: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", overflowY: "auto", padding: "24px 16px" }}>
          <div className="animate-fade-in" style={{ width: "100%", maxWidth: "460px", background: "rgba(15,10,30,0.9)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ textAlign: "center", padding: "32px 32px 20px" }}>
              <div style={{ fontSize: "2.4rem", marginBottom: "10px" }}>🗡️</div>
              <h1 style={{ fontSize: "1.7rem", fontWeight: "bold", marginBottom: "6px" }}>Join the Adventure</h1>
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Select a character from your roster to bring into this campaign.</p>
            </div>

            <div style={{ padding: "4px 28px 28px" }}>
              {guestRosterChars.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📜</div>
                  <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "16px", lineHeight: 1.6 }}>
                    You need at least one character on your roster to join a campaign.
                  </p>
                  <a href="/create-character" style={{ display: "inline-block", padding: "10px 24px", borderRadius: "8px", background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "#c4b5fd", fontSize: "0.88rem", fontWeight: "bold", textDecoration: "none" }}>
                    Create a Character →
                  </a>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                  {guestRosterChars.map(rc => {
                    const isSelected = selectedRosterChar?.id === rc.id;
                    const hpPct      = Math.max(0, Math.min(100, (rc.hp / Math.max(1, rc.max_hp)) * 100));
                    const hpCol      = hpPct > 60 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={rc.id} onClick={() => setSelectedRosterChar(rc)}
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", border: `1.5px solid ${isSelected ? "rgba(139,92,246,0.7)" : "var(--border)"}`, background: isSelected ? "rgba(139,92,246,0.12)" : "rgba(0,0,0,0.3)", cursor: "pointer", transition: "all 0.15s" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${isSelected ? "rgba(139,92,246,0.6)" : "var(--border)"}`, background: "rgba(0,0,0,0.4)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                          {rc.portrait_url ? <img src={rc.portrait_url} alt={rc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (rc.class === "Wizard" ? "🧙" : rc.class === "Rogue" ? "🗡️" : rc.class === "Cleric" ? "✝" : "⚔")}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                            <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: CLASS_COLORS[rc.class] ?? "white" }}>{rc.name}</span>
                            <span style={{ fontSize: "0.65rem", color: "#64748b" }}>Lvl {rc.level}</span>
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "4px" }}>{rc.race} {rc.class}</div>
                          <div style={{ width: "100%", height: "3px", background: "#3f3f46", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${hpPct}%`, height: "100%", background: hpCol }} />
                          </div>
                          <div style={{ fontSize: "0.62rem", color: hpCol, marginTop: "2px" }}>{rc.hp}/{rc.max_hp} HP</div>
                        </div>
                        {isSelected && <div style={{ fontSize: "1rem", color: "#8b5cf6", flexShrink: 0 }}>✓</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {guestError && <p style={{ color: "#ef4444", fontSize: "0.82rem", marginBottom: "14px", textAlign: "center" }}>{guestError}</p>}

              {guestRosterChars.length > 0 && (
                <button onClick={handleGuestJoin} disabled={guestJoining || !selectedRosterChar} className="btn-primary"
                  style={{ width: "100%", padding: "13px", fontSize: "0.95rem", borderRadius: "10px", opacity: (guestJoining || !selectedRosterChar) ? 0.5 : 1 }}>
                  {guestJoining ? "Entering the world…" : selectedRosterChar ? `Enter as ${selectedRosterChar.name}` : "Select a character above"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Session start overlay */}
      {!sessionStarted && !showGuestJoin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,3,15,0.97)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <div className="animate-fade-in" style={{ textAlign: "center", maxWidth: "480px", padding: "40px" }}>
            {(() => {
              const leaderChar = campaignParty.find(c => c.id === partyLeaderId) ?? character;
              const leaderColor = CLASS_COLORS[leaderChar?.class ?? ""] ?? "#f59e0b";
              return leaderChar ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "28px", gap: "10px" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.15em" }}>Party Leader</span>
                  {leaderChar.portrait_url ? (
                    <div style={{ width: "96px", height: "96px", borderRadius: "50%", overflow: "hidden", border: `3px solid ${leaderColor}`, boxShadow: `0 0 28px ${leaderColor}55, 0 0 60px ${leaderColor}20` }}>
                      <img src={leaderChar.portrait_url} alt={leaderChar.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                    </div>
                  ) : (
                    <div style={{ width: "96px", height: "96px", borderRadius: "50%", border: `3px solid ${leaderColor}`, boxShadow: `0 0 28px ${leaderColor}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem", background: "rgba(0,0,0,0.4)" }}>
                      {leaderChar.class === "Wizard" ? "🧙" : leaderChar.class === "Rogue" ? "🗡️" : leaderChar.class === "Cleric" ? "✝" : leaderChar.class === "Ranger" ? "🏹" : leaderChar.class === "Druid" ? "🌿" : leaderChar.class === "Bard" ? "🎵" : "⚔️"}
                    </div>
                  )}
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "white" }}>{leaderChar.name}</span>
                </div>
              ) : null;
            })()}
            <h1 style={{ fontSize: "2.2rem", fontWeight: "bold", marginBottom: "10px" }}>Your adventure awaits</h1>
            <p style={{ color: "#64748b", marginBottom: "40px", lineHeight: 1.6 }}>The torchlight flickers as your party gathers in the shadows…</p>
            <button className="btn-primary"
              style={{ padding: "16px 48px", fontSize: "1.1rem", borderRadius: "12px", letterSpacing: "0.04em" }}
              onClick={() => {
                setSessionStarted(true);

                // Activate both audio elements with a real src inside the user gesture.
                // Playing with no src fails and does NOT grant permission; a real URL does.
                for (const el of [narAudioRef.current, previewAudioRef.current]) {
                  if (el) {
                    el.src = "/api/silence";
                    el.onended = () => { el.src = ""; el.onended = null; };
                    el.play().catch(() => {});
                  }
                }

                // Start background music — must be synchronous for user-gesture gate.
                window.__dndMusicPlay?.();

                // Resumed campaign: narrate the last DM line.
                if (resumeNarrationRef.current) {
                  enqueueNarration(resumeNarrationRef.current);
                }

                // New campaign: auto-trigger DM opening scene.
                const isNewCampaign = !messagesRef.current.some(m => m.role === "dm" || m.role === "player");
                if (isNewCampaign && !autoOpenedRef.current) {
                  autoOpenedRef.current = true;
                  setTimeout(() => {
                    if (isTypingRef.current) return;
                    const trigger: Message = { role: "player", content: "Begin our adventure.", sender: "" };
                    sendToAI([...messagesRef.current, trigger], true);
                  }, 400);
                }
              }}>
              Begin Adventure
            </button>
          </div>
        </div>
      )}

      {/* ── Pane 1: Scene ── */}
      <div style={{ flex: 1, position: "relative", borderRight: "1px solid var(--border)", overflow: "hidden" }}>
        {/* Dynamic background image — crossfades on scene change */}
        <img
          key={currentSceneUrl ?? "default"}
          src={currentSceneUrl ?? "/hero_bg.png"}
          alt="Current Scene"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.75, animation: "fadeIn 1.2s ease" }}
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

      {/* ── Pane 2: Chat ── */}
      <div style={{ flex: "0 0 520px", display: "flex", flexDirection: "column", background: "var(--background)", borderRight: "1px solid var(--border)" }}>
        {/* Header */}
        <header className="glass-panel" style={{ margin: "16px", padding: "12px 16px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <Link href="/dashboard" style={{ flexShrink: 0, color: "#94a3b8", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>← Tavern</Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaignTitle || "Loading…"}</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.7rem", marginTop: "1px" }}>DM: Claude · {campaignParty.length > 0 ? campaignParty.length : players.length} in party</p>
          </div>
          {/* Voice/narration picker */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => { if (!narrationEnabled) { setNarrationEnabled(true); setVoicePickerOpen(true); } else { setVoicePickerOpen(v => !v); } }}
              title={narrationEnabled ? "Change DM voice" : "Enable AI narration"}
              style={{ background: narrationEnabled ? "rgba(139,92,246,0.2)" : "transparent", border: `1px solid ${narrationEnabled ? "rgba(139,92,246,0.5)" : "var(--border)"}`, borderRadius: "8px", padding: "5px 10px", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, display: "flex", alignItems: "center", gap: "5px", transition: "all 0.2s", color: narrationEnabled ? "#c4b5fd" : "#94a3b8" }}>
              {narrating ? <span style={{ animation: "blink 0.8s step-end infinite" }}>🔊</span> : narrationEnabled ? "🔊" : "🔇"}
              {narrationEnabled && <span style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>{VOICES.find(v => v.id === selectedVoice)?.label ?? "Voice"} ▾</span>}
            </button>
            {voicePickerOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100, background: "rgba(10,7,24,0.97)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: "10px", padding: "6px", minWidth: "210px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
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
                      narSlotCounterRef.current = 0; narSlotsRef.current = []; narPlaySlotRef.current = 0;
                      audioPlayingRef.current = false;
                      setNarrating(false);
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
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "4px", paddingTop: "4px" }}>
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
                <span style={{ animation: "blink 1s step-end infinite" }}>🎲</span>
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
                    style={{
                      flexShrink: 0, width: "88px",
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
                      <div style={{ position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)", fontSize: "0.5rem", background: "#ef4444", color: "white", borderRadius: "3px", padding: "1px 5px", fontWeight: "bold", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
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
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {messages.map((msg, idx) => (
            <div key={idx} className="animate-fade-in" style={{ alignSelf: msg.role === "player" ? "flex-end" : "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", alignItems: msg.role === "player" ? "flex-end" : "flex-start" }}>
              {msg.role === "player" && <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "3px" }}>{msg.sender ?? "You"}</span>}
              {msg.role === "dm"     && <span style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "3px", fontWeight: "bold" }}>Dungeon Master</span>}
              <div style={{ padding: "11px 15px", borderRadius: "12px", fontSize: "0.9rem", lineHeight: 1.55, whiteSpace: "pre-wrap",
                background: msg.role === "dm" ? "rgba(139,92,246,0.15)" : msg.role === "system" ? "transparent" : "var(--card-bg)",
                border:     msg.role === "dm" ? "1px solid rgba(139,92,246,0.3)" : msg.role === "system" ? "none" : "1px solid var(--border)",
                fontStyle:  msg.role === "system" ? "italic" : "normal",
                color:      msg.role === "system" ? "#94a3b8" : "white",
                textAlign:  msg.role === "system" ? "center" : "left",
              }}>{msg.role === "dm" ? <ColorizedText text={msg.content} playerColors={Object.fromEntries(campaignParty.map(c => [c.name, CLASS_COLORS[c.class] ?? "#94a3b8"]))} /> : msg.content}</div>
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

          {/* Streaming */}
          {(isTyping || streamingContent) && (
            <div className="animate-fade-in" style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "3px", fontWeight: "bold" }}>Dungeon Master</span>
              <div style={{ padding: "11px 15px", borderRadius: "12px", fontSize: "0.9rem", lineHeight: 1.55, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", whiteSpace: "pre-wrap", minWidth: "80px" }}>
                {streamingContent || <span className="animate-float" style={{ color: "var(--primary)", fontSize: "0.85rem" }}>The DM is thinking...</span>}
                {streamingContent && <span style={{ display: "inline-block", width: "2px", height: "1em", background: "var(--primary)", marginLeft: "2px", verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested actions */}
        {suggestions.length > 0 && !isTyping && isMyTurn && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.04)" }}>
            <p style={{ fontSize: "0.65rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Suggested actions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => handleSend(s)} disabled={narrating}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: "8px", fontSize: "0.82rem", border: "1px solid rgba(139,92,246,0.25)", background: "rgba(139,92,246,0.06)", color: "#cbd5e1", cursor: narrating ? "not-allowed" : "pointer", opacity: narrating ? 0.5 : 1, transition: "all 0.15s", lineHeight: 1.4 }}
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
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--border)", background: "var(--card-bg)" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn-secondary" onClick={() => setShowDice(true)} disabled={isTyping || narrating || !isMyTurn} style={{ padding: "0 14px", fontSize: "1.2rem", flexShrink: 0 }} title="Roll Dice">🎲</button>
            <input
              type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={isTyping || narrating || !isMyTurn}
              placeholder={
                isTyping      ? "The DM is responding…"
                : narrating   ? "Narrating…"
                : !isMyTurn && rollRequestedUserId ? `Waiting for ${campaignParty.find(c => c.user_id === rollRequestedUserId)?.name ?? "a player"} to roll…`
                : !isMyTurn   ? `Waiting for ${campaignParty.find(c => c.id === currentTurnPlayerId)?.name ?? "other players"}…`
                : rollRequestedUserId ? "Describe your roll result…"
                : "Describe your action…"
              }
              style={{ flex: 1, background: "rgba(0,0,0,0.5)", border: "1px solid var(--border)", borderRadius: "8px", color: "white", padding: "11px 14px", fontSize: "0.9rem", opacity: (isTyping || narrating || !isMyTurn) ? 0.6 : 1 }}
            />
            <button className="btn-primary" onClick={() => handleSend()} disabled={isTyping || narrating || !isMyTurn || !input.trim()} style={{ flexShrink: 0 }}>Send</button>
          </div>
        </div>
      </div>

      {/* ── Pane 3: Sidebar ── */}
      <div style={{ flex: "0 0 300px", background: "var(--card-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Tab toggle */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {(["party", "sheet", "log"] as const).map(tab => {
            const TAB_META = {
              party:  { label: "Party",     sub: "Everyone + Invite" },
              sheet:  { label: "Character", sub: "Stats & Inventory" },
              log:    { label: "Story Log", sub: "Full Transcript"   },
            };
            const { label, sub } = TAB_META[tab];
            return (
              <button key={tab} onClick={() => setSidebarTab(tab)}
                style={{ flex: 1, padding: "10px 4px 8px", fontSize: "0.65rem", fontWeight: "bold",
                  background: sidebarTab === tab ? "rgba(139,92,246,0.15)" : "transparent",
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  borderBottom: sidebarTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
                  color: sidebarTab === tab ? "var(--primary)" : "#64748b",
                  cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", transition: "all 0.15s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <span>{label}</span>
                <span style={{ fontSize: "0.55rem", fontWeight: 400, letterSpacing: "0.03em", textTransform: "none", color: sidebarTab === tab ? "rgba(139,92,246,0.75)" : "#3f3f46", lineHeight: 1 }}>{sub}</span>
              </button>
            );
          })}
          {enemies.length > 0 && (
            <button onClick={() => setSidebarTab("combat")}
              style={{ flex: 1, padding: "12px 4px", fontSize: "0.68rem", fontWeight: "bold", position: "relative",
                background: sidebarTab === "combat" ? "rgba(239,68,68,0.15)" : "transparent",
                borderTop: "none", borderLeft: "none", borderRight: "none",
                borderBottom: sidebarTab === "combat" ? "2px solid #ef4444" : "2px solid transparent",
                color: sidebarTab === "combat" ? "#ef4444" : "#64748b",
                cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", transition: "all 0.15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <span>⚔ Combat</span>
              <span style={{ fontSize: "0.55rem", fontWeight: 400, letterSpacing: "0.03em", textTransform: "none", color: sidebarTab === "combat" ? "rgba(239,68,68,0.75)" : "#3f3f46", lineHeight: 1 }}>Click enemies to target</span>
              {combatActive && enemies.some(e => !e.is_defeated) && (
                <span style={{ position: "absolute", top: "6px", right: "4px", width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", animation: "blink 1s step-end infinite" }} />
              )}
            </button>
          )}
        </div>

        {/* ── Party tab ── */}
        {sidebarTab === "party" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Party ({campaignParty.length > 0 ? campaignParty.length : allPartyCards.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                <button onClick={copyInviteLink}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 10px", fontSize: "0.7rem", color: linkCopied ? "#22c55e" : "#94a3b8", cursor: "pointer", transition: "all 0.15s" }}>
                  {linkCopied ? "✓ Copied!" : "🔗 Invite"}
                </button>
                {!linkCopied && campaignParty.length < 2 && (
                  <span style={{ fontSize: "0.58rem", color: "#3f3f46" }}>Share to add players</span>
                )}
              </div>
            </div>

            {/* Player cards — campaign party (always visible) or presence fallback */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: droppedItems.length > 0 ? "20px" : 0 }}>
              {campaignParty.length > 0 ? campaignParty.map((char, idx) => {
                const isActive     = idx === activeCharIdx;
                const isOnline     = players.some(p => p.userId === char.user_id);
                const isDiceTarget  = diceRollTarget === char.name;
                const isCurrentTurn = turnOrder.length > 1 && char.id === currentTurnPlayerId;
                const isMyChar     = char.user_id === userId;
                const cardInv      = char.inventory ?? { gold: 0, items: [], weapons: [] };
                const cardIb       = computeInventoryBonuses(cardInv.items, cardInv.weapons);
                const cardMaxHp    = char.max_hp + cardIb.hpMaxAdd;
                const pct          = Math.max(0, Math.min(100, (char.hp / Math.max(1, cardMaxHp)) * 100));
                const color        = pct > 60 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
                const classEmoji   = char.class === "Wizard" ? "🧙" : char.class === "Rogue" ? "🗡️" : char.class === "Cleric" ? "✝" : "⚔";
                const borderColor  = isDiceTarget ? "rgba(251,191,36,0.9)" : isCurrentTurn ? "rgba(139,92,246,0.9)" : isActive ? "rgba(139,92,246,0.6)" : "var(--border)";
                const bgColor      = isDiceTarget ? "rgba(251,191,36,0.08)" : isCurrentTurn ? "rgba(139,92,246,0.16)" : isActive ? "rgba(139,92,246,0.12)" : "rgba(0,0,0,0.3)";
                const cardAnim     = isDiceTarget ? "diceCardRise 1.4s ease-in-out infinite" : isCurrentTurn ? "activePlayerRise 2s ease-in-out infinite" : "none";
                return (
                  <div key={char.id}
                    onClick={() => campaignParty.length > 1 && setActiveCharIdx(idx)}
                    style={{ padding: "12px 14px", background: bgColor, borderRadius: "10px", border: `1.5px solid ${borderColor}`, animation: cardAnim, order: isDiceTarget ? -2 : isCurrentTurn ? -1 : 0, transition: "background 0.3s ease, border-color 0.3s ease", cursor: campaignParty.length > 1 ? "pointer" : "default" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${isDiceTarget ? "rgba(251,191,36,0.9)" : isActive ? "rgba(139,92,246,0.7)" : "var(--border)"}`, background: "rgba(0,0,0,0.4)", animation: isDiceTarget ? "diceTargetGlow 1.2s ease-in-out infinite" : "none" }}>
                          {char.portrait_url ? (
                            <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>{classEmoji}</div>
                          )}
                        </div>
                        {/* Online indicator dot */}
                        <div style={{ position: "absolute", bottom: 0, right: 0, width: "9px", height: "9px", borderRadius: "50%", background: isOnline ? "#22c55e" : "#3f3f46", border: "1.5px solid rgba(10,7,24,0.9)", boxShadow: isOnline ? "0 0 5px #22c55e" : "none" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.88rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: CLASS_COLORS[char.class] ?? "white" }}>{char.name}</span>
                          {char.id === partyLeaderId && (
                            <span title="Party Leader" style={{ fontSize: "1.05rem", flexShrink: 0, animation: "crownPulse 2.4s ease-in-out infinite", display: "inline-block" }}>👑</span>
                          )}
                          {isActive && campaignParty.length > 1 && (
                            <span style={{ fontSize: "0.58rem", background: "rgba(139,92,246,0.45)", color: "#e9d5ff", borderRadius: "3px", padding: "1px 5px", flexShrink: 0, fontWeight: "bold", letterSpacing: "0.03em" }}>⚡ Active</span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{char.race} {char.class} · Lvl {char.level}</div>
                      </div>
                    </div>
                    <div style={{ width: "100%", height: "4px", background: "#3f3f46", borderRadius: "2px", overflow: "hidden", marginBottom: "6px" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: "0.72rem", color, fontWeight: "bold" }} title={cardIb.hpMaxAdd > 0 ? `Base ${char.max_hp} +${cardIb.hpMaxAdd} item bonus` : undefined}>
                          {Math.min(char.hp, cardMaxHp)}/{cardMaxHp} HP{cardIb.hpMaxAdd > 0 ? " ✦" : ""}
                        </span>
                        <span style={{ fontSize: "0.65rem", color: "#f59e0b", fontWeight: 600 }} title="Gold">💰 {char.inventory?.gold ?? 0}</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {isDiceTarget && (
                          <span style={{ fontSize: "0.62rem", color: "#fbbf24", fontWeight: "bold", animation: "blink 1s step-end infinite" }}>🎲 Roll!</span>
                        )}
                        {campaignParty.length > 1 && !isDiceTarget && (
                          <span style={{ fontSize: "0.65rem", fontWeight: "bold", color: isActive ? "#c4b5fd" : "#3f3f46", background: isActive ? "rgba(139,92,246,0.2)" : "transparent", borderRadius: "4px", padding: isActive ? "2px 7px" : "0" }}>
                            {isActive ? "Acting" : "Waiting"}
                          </span>
                        )}
                        {isMyChar && (
                          <button
                            onClick={e => { e.stopPropagation(); leaveParty(char.id); }}
                            title="Leave party"
                            style={{ background: "none", border: "none", color: "#3f3f46", cursor: "pointer", fontSize: "0.75rem", padding: "1px 3px", lineHeight: 1, transition: "color 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
                            onMouseLeave={e => { e.currentTarget.style.color = "#3f3f46"; }}
                          >✕</button>
                        )}
                        {!isMyChar && char.user_id && (
                          <button
                            onClick={e => { e.stopPropagation(); setTradeTarget(char); setTradeItems([]); setTradeGold(0); }}
                            title={`Trade with ${char.name}`}
                            style={{ background: "none", border: "1px solid rgba(139,92,246,0.25)", color: "#8b5cf6", cursor: "pointer", fontSize: "0.58rem", padding: "2px 5px", borderRadius: "4px", lineHeight: 1, transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.15)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)"; }}
                          >⇄</button>
                        )}
                        {!isMyChar && isPartyLeader && (
                          <button
                            onClick={e => { e.stopPropagation(); kickCharacter(char); }}
                            title={`Kick ${char.name}`}
                            style={{ background: "none", border: "none", color: "#3f3f46", cursor: "pointer", fontSize: "0.75rem", padding: "1px 3px", lineHeight: 1, transition: "color 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
                            onMouseLeave={e => { e.currentTarget.style.color = "#3f3f46"; }}
                          >✕</button>
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
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", marginTop: "2px" }}>
                            <span style={{ color: "#7c3aed", fontWeight: 600 }}>XP</span>
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
                        <div style={{ marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          {levels.map(lvl => {
                            const max   = maxSlots[lvl];
                            const used  = usedSlots[lvl] ?? 0;
                            const avail = Math.max(0, max - used);
                            return (
                              <div key={lvl} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                                <span style={{ fontSize: "0.52rem", color: "#64748b", marginRight: "1px" }}>L{lvl}</span>
                                {Array.from({ length: max }, (_, i) => (
                                  <div key={i} style={{
                                    width: "7px", height: "7px", borderRadius: "50%",
                                    background: i < avail ? "#8b5cf6" : "transparent",
                                    border: `1.5px solid ${i < avail ? "#8b5cf6" : "#3f3f46"}`,
                                    transition: "all 0.2s",
                                    boxShadow: i < avail ? "0 0 3px rgba(139,92,246,0.5)" : "none",
                                  }} />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {(char.status_effects?.length ?? 0) > 0 && (
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                        {char.status_effects!.map(s => {
                          const st = STATUS_COLORS[s] ?? { bg: "rgba(100,116,139,0.2)", color: "#94a3b8" };
                          const hkey = `${char.id}-${s}`;
                          return (
                            <span key={s} style={{ position: "relative" }}
                              onMouseEnter={() => setHoveredStatus(hkey)}
                              onMouseLeave={() => setHoveredStatus(null)}
                            >
                              <span style={{ fontSize: "0.6rem", padding: "1px 6px", borderRadius: "10px", background: st.bg, color: st.color, fontWeight: 700, letterSpacing: "0.03em", cursor: "help" }}>{s}</span>
                              {hoveredStatus === hkey && STATUS_DESCRIPTIONS[s] && (
                                <span style={{ position: "absolute", bottom: "calc(100% + 5px)", left: "50%", transform: "translateX(-50%)", background: "#1a1730", border: `1px solid ${st.color}55`, borderRadius: "7px", padding: "7px 10px", zIndex: 600, width: "190px", pointerEvents: "none", fontSize: "0.68rem", color: "#e2e8f0", lineHeight: 1.45, textAlign: "left", boxShadow: "0 4px 16px rgba(0,0,0,0.7)", whiteSpace: "normal", display: "block", fontWeight: "normal" }}>
                                  <span style={{ fontWeight: "bold", color: st.color, marginBottom: "3px", display: "block" }}>{s}</span>
                                  {STATUS_DESCRIPTIONS[s]}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }) : allPartyCards.map(p => {
                const isCurrentTurn = turnOrder.length > 1 && campaignParty.find(c => c.name === p.characterName)?.id === currentTurnPlayerId;
                const isDiceTarget  = diceRollTarget === p.characterName;
                const isMe          = p.userId === userId;
                const pct           = Math.max(0, (p.hp / p.maxHp) * 100);
                const color         = pct > 60 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
                const borderColor2  = isDiceTarget ? "rgba(251,191,36,0.9)" : isCurrentTurn ? "rgba(139,92,246,0.6)" : "var(--border)";
                const bgColor2      = isDiceTarget ? "rgba(251,191,36,0.08)" : isCurrentTurn ? "rgba(139,92,246,0.12)" : "rgba(0,0,0,0.3)";
                const glow2         = isDiceTarget ? "0 0 18px rgba(251,191,36,0.35)" : isCurrentTurn ? "0 0 18px rgba(139,92,246,0.25)" : "none";
                return (
                  <div key={p.userId} style={{ padding: "12px 14px", background: bgColor2, borderRadius: "10px", border: `1.5px solid ${borderColor2}`, boxShadow: glow2, transition: "all 0.3s ease" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `2px solid ${isCurrentTurn ? "rgba(139,92,246,0.7)" : "var(--border)"}`, background: "rgba(0,0,0,0.4)" }}>
                        {p.portraitUrl ? (
                          <img src={p.portraitUrl} alt={p.characterName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                            {p.characterClass === "Wizard" ? "🧙" : p.characterClass === "Rogue" ? "🗡️" : p.characterClass === "Cleric" ? "✝" : "⚔"}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ fontSize: "0.88rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: CLASS_COLORS[p.characterClass] ?? "white" }}>{p.characterName}</span>
                          {p.userId === leaderChar?.user_id && (
                            <span title="Party Leader" style={{ fontSize: "0.72rem", flexShrink: 0, filter: "drop-shadow(0 0 4px rgba(251,191,36,0.7))" }}>👑</span>
                          )}
                          {isMe && <span style={{ fontSize: "0.58rem", background: "rgba(139,92,246,0.3)", color: "#c4b5fd", borderRadius: "3px", padding: "1px 4px", flexShrink: 0 }}>You</span>}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{p.characterClass}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
                        {!isMe && isPartyLeader && (
                          <button onClick={() => kickPlayer(p)} title={`Remove ${p.characterName}`}
                            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "0.85rem", padding: "2px 4px", lineHeight: 1, transition: "color 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
                            onMouseLeave={e => { e.currentTarget.style.color = "#475569"; }}>✕</button>
                        )}
                      </div>
                    </div>
                    <div style={{ width: "100%", height: "4px", background: "#3f3f46", borderRadius: "2px", overflow: "hidden", marginBottom: "6px" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.72rem", color, fontWeight: "bold" }}>{p.hp}/{p.maxHp} HP</span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {isDiceTarget && (
                          <span style={{ fontSize: "0.62rem", color: "#fbbf24", fontWeight: "bold", animation: "blink 1s step-end infinite" }}>🎲 Roll!</span>
                        )}
                        {turnOrder.length > 1 && !isDiceTarget && (
                          <span style={{ fontSize: "0.65rem", fontWeight: "bold", color: isCurrentTurn ? "#c4b5fd" : "#475569", background: isCurrentTurn ? "rgba(139,92,246,0.2)" : "transparent", borderRadius: "4px", padding: isCurrentTurn ? "2px 7px" : "0" }}>
                            {isCurrentTurn ? (isMe ? "⚡ Your turn" : "⚡ Acting…") : "Waiting"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {campaignParty.length === 0 && allPartyCards.length === 0 && (
                <p style={{ fontSize: "0.78rem", color: "#475569", fontStyle: "italic" }}>No adventurers connected. Share the invite link!</p>
              )}
            </div>

            {/* Manage party — party leader only */}
            {isPartyLeader && (
            <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
              <button
                onClick={() => setManagePartyOpen(o => !o)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "1px solid var(--border)", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontSize: "0.75rem", color: "#94a3b8", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "#94a3b8"; }}
              >
                <span>⊕ Manage Party</span>
                <span style={{ fontSize: "0.65rem" }}>{managePartyOpen ? "▲" : "▼"}</span>
              </button>

              {managePartyOpen && (
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {userRoster.length === 0 ? (
                    <p style={{ fontSize: "0.75rem", color: "#475569", fontStyle: "italic", padding: "6px 0" }}>
                      No characters yet. <Link href="/create-character" style={{ color: "var(--primary)" }}>Create one →</Link>
                    </p>
                  ) : userRoster.map(char => {
                    const inParty = campaignParty.some(c => c.id === char.id);
                    return (
                      <div key={char.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", background: inParty ? "rgba(139,92,246,0.08)" : "rgba(0,0,0,0.2)", borderRadius: "7px", border: `1px solid ${inParty ? "rgba(139,92,246,0.35)" : "var(--border)"}` }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden", border: "1px solid var(--border)", background: "rgba(0,0,0,0.4)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {char.portrait_url
                            ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: "0.9rem" }}>🧙</span>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{char.name}</div>
                          <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{char.race} {char.class} · Lvl {char.level} · {char.hp}/{char.max_hp} HP</div>
                        </div>
                        {inParty ? (
                          <button
                            onClick={() => leaveParty(char.id)}
                            style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: "5px", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                          >Leave</button>
                        ) : (
                          <button
                            onClick={() => addToParty(char)}
                            style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: "5px", border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)", color: "#4ade80", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
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
                <p style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Party Rest</p>
                <div style={{ display: "flex", gap: "7px" }}>
                  <button onClick={handlePartyShortRest}
                    style={{ flex: 1, padding: "7px", borderRadius: "7px", fontSize: "0.73rem", fontWeight: "bold", border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)", color: "#f59e0b", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.08)"; }}>
                    🌙 Short Rest
                  </button>
                  <button onClick={handlePartyLongRest}
                    style={{ flex: 1, padding: "7px", borderRadius: "7px", fontSize: "0.73rem", fontWeight: "bold", border: "1px solid rgba(99,102,241,0.35)", background: "rgba(99,102,241,0.08)", color: "#818cf8", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.08)"; }}>
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
                  {droppedItems.map(item => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: "7px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontSize: "0.8rem" }}>{item.type === "weapon" ? "⚔️" : "🎒"} {item.name}</div>
                        <div style={{ fontSize: "0.62rem", color: "#64748b" }}>from {item.fromCharacter}</div>
                      </div>
                      {item.fromUserId !== userId && (
                        <button onClick={() => takeItem(item)}
                          style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: "5px", border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.1)", color: "#c4b5fd", cursor: "pointer" }}>
                          Take
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Character Sheet tab ── */}
        {sidebarTab === "sheet" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {stateNotice && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "8px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", fontSize: "0.8rem", color: "#34d399", textAlign: "center" }}>
                ⚡ {stateNotice}
              </div>
            )}

            {character ? (
              <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Identity with portrait */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "100%", height: "180px", borderRadius: "10px", overflow: "hidden", border: `2px solid ${CLASS_COLORS[character.class] ?? "var(--border)"}40`, background: "rgba(0,0,0,0.5)", flexShrink: 0 }}>
                    {character.portrait_url ? (
                      <img src={character.portrait_url} alt={character.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem" }}>🧙</div>
                    )}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: CLASS_COLORS[character.class] ?? "white" }}>{character.name}</div>
                    <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{character.race} {character.class} · Lvl {character.level}</div>
                  </div>
                </div>

                {/* Status effects */}
                {(character.status_effects?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {character.status_effects!.map(s => {
                      const st = STATUS_COLORS[s] ?? { bg: "rgba(100,116,139,0.2)", color: "#94a3b8" };
                      return (
                        <span key={s} style={{ position: "relative" }}
                          onMouseEnter={() => setHoveredStatus(`sheet-${s}`)}
                          onMouseLeave={() => setHoveredStatus(null)}
                        >
                          <span style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: "20px", background: st.bg, color: st.color, fontWeight: 700, border: `1px solid ${st.color}40`, cursor: "help", display: "block" }}>{s}</span>
                          {hoveredStatus === `sheet-${s}` && STATUS_DESCRIPTIONS[s] && (
                            <span style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "#1a1730", border: `1px solid ${st.color}55`, borderRadius: "8px", padding: "9px 12px", zIndex: 600, width: "210px", pointerEvents: "none", fontSize: "0.72rem", color: "#e2e8f0", lineHeight: 1.5, textAlign: "left", boxShadow: "0 4px 20px rgba(0,0,0,0.7)", whiteSpace: "normal", display: "block", fontWeight: "normal" }}>
                              <span style={{ fontWeight: "bold", color: st.color, marginBottom: "4px", display: "block" }}>{s}</span>
                              {STATUS_DESCRIPTIONS[s]}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* HP */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.85rem" }}>
                    <span style={{ color: "#94a3b8" }}>Hit Points</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ fontWeight: "bold", color: hpColor }}>{Math.min(character.hp, effectiveMaxHp)} / {effectiveMaxHp}</span>
                      {(itemBonuses?.hpMaxAdd ?? 0) > 0 && (
                        <span
                          title={`Base max HP: ${character.max_hp} · Item bonus: +${itemBonuses!.hpMaxAdd} · Effective max: ${effectiveMaxHp}`}
                          style={{ fontSize: "0.65rem", color: "#f59e0b", fontWeight: "bold", cursor: "help", background: "rgba(245,158,11,0.15)", borderRadius: "4px", padding: "1px 5px" }}
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
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.85rem" }}>
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
                        style={{ position: "relative", background: "rgba(0,0,0,0.3)", border: `1px solid ${tierStyle ? tierStyle.color + "55" : "var(--border)"}`, padding: "10px 4px", borderRadius: "8px", textAlign: "center", cursor: "default", transition: "border-color 0.2s" }}
                        onMouseEnter={() => setHoveredStat(label)}
                        onMouseLeave={() => setHoveredStat(null)}
                      >
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginBottom: "2px" }}>{label}</div>
                        <div style={{ fontWeight: "bold", fontSize: "1rem" }}>{effScore}</div>
                        <div style={{ fontSize: "0.7rem", color: m >= 0 ? "#22c55e" : "#ef4444" }}>{m >= 0 ? `+${m}` : m}</div>
                        {hasItemBuf && (
                          <div style={{ fontSize: "0.5rem", color: netDiff > 0 ? "#f59e0b" : "#ef4444", marginTop: "1px", fontWeight: "bold" }}>
                            {netDiff > 0 ? `✦+${netDiff}` : `✦${netDiff}`}
                          </div>
                        )}
                        {tierStyle && !hasItemBuf && (
                          <div style={{ fontSize: "0.5rem", color: tierStyle.color, marginTop: "3px", fontWeight: "bold", letterSpacing: "0.06em" }}>
                            {tierStyle.label.toUpperCase()}
                          </div>
                        )}
                        {hoveredStat === label && (
                          <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "#1a1730", border: `1px solid ${tierStyle ? tierStyle.color + "66" : "#ffffff22"}`, borderRadius: "7px", padding: "9px 11px", zIndex: 500, width: "170px", pointerEvents: "none", fontSize: "0.7rem", color: "#e2e8f0", lineHeight: 1.45, textAlign: "left", boxShadow: "0 4px 16px rgba(0,0,0,0.6)" }}>
                            {hasItemBuf && (
                              <div style={{ marginBottom: "5px", paddingBottom: "5px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                <div style={{ color: "#94a3b8", fontSize: "0.65rem", marginBottom: "2px" }}>Base: {baseScore} → Effective: {effScore}</div>
                                {addBonus !== 0 && <div style={{ color: netDiff > 0 ? "#f59e0b" : "#ef4444" }}>Item bonus: {addBonus > 0 ? "+" : ""}{addBonus}</div>}
                                {setBonus > baseScore && <div style={{ color: "#f59e0b" }}>Set to minimum: {setBonus}</div>}
                              </div>
                            )}
                            {guide && tierStyle && (
                              <>
                                <div style={{ fontWeight: "bold", color: tierStyle.color, marginBottom: "4px", fontSize: "0.72rem" }}>{tierStyle.label} Stat</div>
                                {guide.reason}
                              </>
                            )}
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
                      <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "10px", color: "var(--primary)" }}>Spell Slots</h3>
                      {Object.entries(maxSlots).map(([lvl, max]) => {
                        const used = usedSlots[Number(lvl)] ?? 0;
                        const remaining = Math.max(0, max - used);
                        return (
                          <div key={lvl} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <span style={{ fontSize: "0.7rem", color: "#64748b", width: "42px", flexShrink: 0 }}>Lvl {lvl}</span>
                            <div style={{ display: "flex", gap: "4px" }}>
                              {Array.from({ length: max }, (_, i) => (
                                <div key={i} style={{ width: "12px", height: "12px", borderRadius: "50%", background: i < remaining ? "#8b5cf6" : "rgba(100,116,139,0.3)", border: i < remaining ? "1px solid #7c3aed" : "1px solid #475569", transition: "background 0.2s" }} />
                              ))}
                            </div>
                            <span style={{ fontSize: "0.68rem", color: remaining > 0 ? "#8b5cf6" : "#ef4444" }}>{remaining}/{max}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null;
                })()}

                {/* Spellbook */}
                {SPELLCASTING_CLASSES.has(character.class) && ((character.cantrips_known?.length ?? 0) > 0 || (character.spells_prepared?.length ?? 0) > 0) && (
                  <div>
                    <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "10px", color: "var(--primary)" }}>Spellbook</h3>
                    {(character.cantrips_known?.length ?? 0) > 0 && (
                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Cantrips · at-will</div>
                        {character.cantrips_known!.map((s, i) => {
                          const entry = CANTRIPS[character.class]?.find(e => e.name === s);
                          const active = hoveredSpell === `c-${i}`;
                          return (
                            <div key={i} style={{ position: "relative", marginBottom: "3px" }}>
                              <div
                                role="button"
                                onClick={() => { if (!isTyping) handleSend(`I cast ${s}.`); }}
                                onMouseEnter={() => setHoveredSpell(`c-${i}`)}
                                onMouseLeave={() => setHoveredSpell(null)}
                                style={{ padding: "6px 10px", background: active ? "rgba(139,92,246,0.22)" : "rgba(139,92,246,0.08)", borderRadius: "5px", fontSize: "0.8rem", cursor: isTyping ? "default" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${active ? "rgba(139,92,246,0.45)" : "transparent"}`, transition: "all 0.15s", opacity: isTyping ? 0.55 : 1 }}
                              >
                                <span>✦ {s}</span>
                                <span style={{ fontSize: "0.58rem", color: "#8b5cf6", fontWeight: 600 }}>at-will</span>
                              </div>
                              {active && entry && (
                                <div style={{ position: "absolute", bottom: "calc(100% + 5px)", left: 0, right: 0, background: "#1a1730", border: "1px solid rgba(139,92,246,0.4)", borderRadius: "7px", padding: "8px 10px", zIndex: 500, pointerEvents: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.7)", fontSize: "0.7rem", color: "#e2e8f0", lineHeight: 1.5 }}>
                                  <div style={{ fontWeight: "bold", marginBottom: "3px", color: "#c4b5fd" }}>{s} <span style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 400 }}>· {entry.school}</span></div>
                                  <div style={{ color: "#94a3b8" }}>{entry.desc}</div>
                                </div>
                              )}
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
                            <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Prepared Spells</div>
                            {slotLevels.length > 0 && (
                              <div style={{ display: "flex", gap: "5px" }}>
                                {slotLevels.map(lvl => {
                                  const avail = Math.max(0, (maxSlots[lvl] ?? 0) - (usedSlots[lvl] ?? 0));
                                  return (
                                    <span key={lvl} style={{ fontSize: "0.58rem", background: avail > 0 ? "rgba(139,92,246,0.2)" : "rgba(0,0,0,0.3)", color: avail > 0 ? "#c4b5fd" : "#3f3f46", borderRadius: "4px", padding: "1px 5px", fontWeight: 600 }}>
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
                                    await supabase.from("characters").update({ spell_slots_used: newSlots }).eq("id", character.id);
                                    pendingSpellCastRef.current += 1;
                                    handleSend(`I cast ${s}.`);
                                  }}
                                  onMouseEnter={() => setHoveredSpell(`p-${i}`)}
                                  onMouseLeave={() => setHoveredSpell(null)}
                                  style={{ padding: "6px 10px", background: canCast && active ? "rgba(139,92,246,0.22)" : canCast ? "rgba(139,92,246,0.08)" : "rgba(0,0,0,0.2)", borderRadius: "5px", fontSize: "0.8rem", cursor: canCast ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${active && canCast ? "rgba(139,92,246,0.45)" : "transparent"}`, transition: "all 0.15s", opacity: canCast ? 1 : 0.4 }}
                                >
                                  <span style={{ color: canCast ? undefined : "#475569" }}>◈ {s}</span>
                                  <span style={{ fontSize: "0.58rem", color: canCast ? "#8b5cf6" : "#3f3f46", fontWeight: 600 }}>
                                    {availLvl !== null ? `L${availLvl} slot` : "no slots"}
                                  </span>
                                </div>
                                {active && entry && (
                                  <div style={{ position: "absolute", bottom: "calc(100% + 5px)", left: 0, right: 0, background: "#1a1730", border: "1px solid rgba(139,92,246,0.4)", borderRadius: "7px", padding: "8px 10px", zIndex: 500, pointerEvents: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.7)", fontSize: "0.7rem", color: "#e2e8f0", lineHeight: 1.5 }}>
                                    <div style={{ fontWeight: "bold", marginBottom: "3px", color: "#c4b5fd" }}>{s} <span style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 400 }}>· {entry.school}</span></div>
                                    <div style={{ color: "#94a3b8" }}>{entry.desc}</div>
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

                {/* Inventory with drop buttons */}
                <div>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "10px", color: "var(--primary)" }}>Inventory</h3>
                  {/* Currency */}
                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "8px 10px", marginBottom: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Currency</span>
                      {campaignParty.filter(c => c.id !== character.id).length > 0 && (
                        <button onClick={() => { setTradingCurrency(!tradingCurrency); setCurrencyAmount(""); setCurrencyTarget(null); }}
                          style={{ fontSize: "0.62rem", color: tradingCurrency ? "#a78bfa" : "#64748b", background: tradingCurrency ? "rgba(139,92,246,0.15)" : "none", border: tradingCurrency ? "1px solid rgba(139,92,246,0.4)" : "none", borderRadius: "4px", cursor: "pointer", padding: "2px 6px" }}>
                          {tradingCurrency ? "cancel" : "send"}
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "0.82rem" }}>
                      {([
                        { key: "pp" as const, color: "#e2e8f0", amount: character.inventory?.pp ?? 0 },
                        { key: "gp" as const, color: "#fbbf24", amount: character.inventory?.gold ?? 0 },
                        { key: "ep" as const, color: "#34d399", amount: character.inventory?.ep ?? 0 },
                        { key: "sp" as const, color: "#94a3b8", amount: character.inventory?.sp ?? 0 },
                        { key: "cp" as const, color: "#f97316", amount: character.inventory?.cp ?? 0 },
                      ]).map(({ key, color, amount }) => (
                        <div key={key} style={{ display: "flex", alignItems: "baseline", gap: "2px", opacity: amount === 0 ? 0.4 : 1 }}>
                          <span style={{ color, fontWeight: "bold" }}>{amount}</span>
                          <span style={{ color: "#64748b", fontSize: "0.72rem" }}>{key}</span>
                        </div>
                      ))}
                    </div>
                    {tradingCurrency && (
                      <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ display: "flex", gap: "5px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
                          <input type="number" min={1} value={currencyAmount} onChange={e => setCurrencyAmount(e.target.value)} placeholder="Amt"
                            style={{ width: "60px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", color: "white", padding: "4px 6px", fontSize: "0.78rem" }} />
                          <select value={currencyDenom} onChange={e => setCurrencyDenom(e.target.value as "cp"|"sp"|"ep"|"gp"|"pp")}
                            style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", color: "white", padding: "4px 5px", fontSize: "0.78rem" }}>
                            <option value="pp">pp</option>
                            <option value="gp">gp</option>
                            <option value="ep">ep</option>
                            <option value="sp">sp</option>
                            <option value="cp">cp</option>
                          </select>
                          <span style={{ color: "#475569", fontSize: "0.72rem" }}>to</span>
                          <select value={currencyTarget?.id ?? ""} onChange={e => setCurrencyTarget(campaignParty.find(c => c.id === e.target.value) ?? null)}
                            style={{ flex: 1, minWidth: "80px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", color: "white", padding: "4px 6px", fontSize: "0.78rem" }}>
                            <option value="">Select…</option>
                            {campaignParty.filter(c => c.id !== character.id).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => { const amt = parseInt(currencyAmount, 10); if (!isNaN(amt) && amt > 0 && currencyTarget) giftCurrency(amt, currencyDenom, currencyTarget); }}
                          disabled={!currencyAmount || !currencyTarget || parseInt(currencyAmount, 10) <= 0}
                          style={{ width: "100%", padding: "5px", background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: "4px", color: "#c4b5fd", fontSize: "0.78rem", cursor: "pointer", opacity: (!currencyAmount || !currencyTarget || parseInt(currencyAmount,10) <= 0) ? 0.4 : 1 }}>
                          Send Currency
                        </button>
                      </div>
                    )}
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
                    const isTrading   = tradingItemKey === itemKey;
                    const tradeTargets = campaignParty.filter(c => c.id !== character.id);
                    return (
                      <div key={itemKey} style={{ marginBottom: "4px" }}>
                        <div style={{ position: "relative" }}>
                          <div
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: isTrading ? "6px 6px 0 0" : "6px", fontSize: "0.82rem", border: `1px solid ${isTrading ? "rgba(139,92,246,0.5)" : catalogItem ? rarityColor + "44" : "transparent"}`, cursor: "default", transition: "border-color 0.15s" }}
                            onMouseEnter={() => setHoveredItem(itemKey)}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
                              <span style={{ flexShrink: 0 }}>{icon}</span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: catalogItem ? rarityColor : "#e2e8f0" }}>{name}</div>
                                {catalogItem && (
                                  <div style={{ fontSize: "0.58rem", color: rarityColor, fontWeight: "bold", letterSpacing: "0.04em" }}>
                                    {RARITY_LABELS[catalogItem.rarity]}{catalogItem.requiresAttunement ? " · Attunement" : ""}{catalogItem.cursed ? " ⚠️" : ""}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0, marginLeft: "6px" }}>
                              {catalogItem?.consumable && (
                                <button
                                  onClick={() => handleUseItem(name)}
                                  style={{ fontSize: "0.58rem", color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "4px", cursor: "pointer", padding: "2px 6px", fontWeight: "bold" }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.25)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(34,197,94,0.12)"; }}
                                >Use</button>
                              )}
                              {tradeTargets.length > 0 && (
                                <button
                                  onClick={() => setTradingItemKey(isTrading ? null : itemKey)}
                                  title="Trade this item"
                                  style={{ fontSize: "0.58rem", color: isTrading ? "#a78bfa" : "#64748b", background: isTrading ? "rgba(139,92,246,0.15)" : "none", border: isTrading ? "1px solid rgba(139,92,246,0.4)" : "none", borderRadius: "4px", cursor: "pointer", padding: "2px 5px" }}
                                  onMouseEnter={e => { if (!isTrading) e.currentTarget.style.color = "#a78bfa"; }}
                                  onMouseLeave={e => { if (!isTrading) e.currentTarget.style.color = "#64748b"; }}
                                >trade</button>
                              )}
                              <button
                                onClick={() => dropItem(name, slot)}
                                title="Drop to party pool"
                                style={{ fontSize: "0.58rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#f59e0b"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; }}
                              >drop</button>
                            </div>
                          </div>
                          {isHovered && !isTrading && catalogItem && (
                            <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "#1a1730", border: `1px solid ${rarityColor}55`, borderRadius: "8px", padding: "10px 12px", zIndex: 500, pointerEvents: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.7)", fontSize: "0.72rem", color: "#e2e8f0", lineHeight: 1.5 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                                <span style={{ fontWeight: "bold", fontSize: "0.8rem" }}>{name}</span>
                                <span style={{ color: rarityColor, fontSize: "0.62rem", fontWeight: "bold" }}>{RARITY_LABELS[catalogItem.rarity]}</span>
                              </div>
                              <div style={{ color: "#94a3b8", marginBottom: "7px", fontSize: "0.69rem", lineHeight: 1.4 }}>{catalogItem.description}</div>
                              {catalogItem.effects.map((fx, fi) => fx.description && (
                                <div key={fi} style={{ padding: "3px 7px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "3px", color: fx.description.startsWith("⚠️") ? "#ef4444" : "#c4b5fd", fontSize: "0.68rem" }}>
                                  {fx.description}
                                </div>
                              ))}
                              {catalogItem.requiresAttunement && (
                                <div style={{ color: "#64748b", fontSize: "0.62rem", marginTop: "5px" }}>Requires Attunement</div>
                              )}
                            </div>
                          )}
                        </div>
                        {isTrading && (
                          <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.4)", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "6px 8px" }}>
                            <div style={{ fontSize: "0.62rem", color: "#a78bfa", marginBottom: "5px", fontWeight: "bold" }}>Send to:</div>
                            {tradeTargets.length === 0 ? (
                              <div style={{ fontSize: "0.65rem", color: "#64748b" }}>No other party members.</div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                {tradeTargets.map(tc => (
                                  <button key={tc.id}
                                    onClick={() => giftItem(name, slot, tc)}
                                    style={{ textAlign: "left", padding: "4px 8px", borderRadius: "4px", fontSize: "0.72rem", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#e2e8f0", cursor: "pointer", transition: "background 0.15s" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.25)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
                                  >
                                    {tc.name} <span style={{ color: "#64748b", fontSize: "0.62rem" }}>{tc.race} {tc.class}</span>
                                  </button>
                                ))}
                                <button onClick={() => setTradingItemKey(null)}
                                  style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.65rem", background: "none", border: "none", color: "#64748b", cursor: "pointer", textAlign: "left" }}
                                >Cancel</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Party Leadership */}
                <div style={{ paddingTop: "4px", borderTop: "1px solid var(--border)" }}>
                  {isPartyLeader ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                        <span style={{ fontSize: "1rem", filter: "drop-shadow(0 0 5px rgba(251,191,36,0.8))" }}>👑</span>
                        <span style={{ fontSize: "0.78rem", fontWeight: "bold", color: "#fbbf24" }}>Party Leader</span>
                      </div>
                      {campaignParty.filter(c => c.id !== partyLeaderId).length > 0 && (
                        <div>
                          <p style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Transfer Leadership</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                            {campaignParty.filter(c => c.id !== partyLeaderId).map(c => (
                              <button key={c.id} onClick={() => transferLeadership(c.id)}
                                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderRadius: "7px", border: "1px solid rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.04)", cursor: "pointer", transition: "all 0.15s", textAlign: "left" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(251,191,36,0.12)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.5)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(251,191,36,0.04)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.2)"; }}>
                                <span style={{ fontSize: "0.8rem" }}>👑</span>
                                <div>
                                  <div style={{ fontSize: "0.78rem", fontWeight: "bold", color: "#e2e8f0" }}>{c.name}</div>
                                  <div style={{ fontSize: "0.62rem", color: "#64748b" }}>{c.race} {c.class} · Make Leader</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : leaderChar ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0" }}>
                      <span style={{ fontSize: "0.9rem", filter: "drop-shadow(0 0 4px rgba(251,191,36,0.6))" }}>👑</span>
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#fbbf24", fontWeight: "bold" }}>{leaderChar.name}</div>
                        <div style={{ fontSize: "0.62rem", color: "#64748b" }}>is leading the party</div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Rest */}
                <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
                  <button onClick={handleShortRest}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid var(--border)", background: "rgba(245,158,11,0.1)", color: "#f59e0b", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.1)"; }}>
                    🌙 Short Rest
                  </button>
                  <button onClick={handleLongRest}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid var(--border)", background: "rgba(99,102,241,0.1)", color: "#818cf8", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.1)"; }}>
                    ☀️ Long Rest
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "40px", fontSize: "0.9rem" }}>Loading character...</div>
            )}
          </div>
        )}

        {/* ── Story Log tab ── */}
        {sidebarTab === "log" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{logEntries.length} entries</span>
              <button onClick={() => exportLog(logEntries, params.id)} disabled={logEntries.length === 0}
                style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "0.75rem", border: "1px solid var(--border)", background: "transparent", color: logEntries.length === 0 ? "#475569" : "#94a3b8", cursor: logEntries.length === 0 ? "default" : "pointer", transition: "color 0.15s, border-color 0.15s" }}
                onMouseEnter={e => { if (logEntries.length > 0) { e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "var(--primary)"; }}}
                onMouseLeave={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                ↓ Export .md
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {logEntries.length === 0 && <p style={{ color: "#475569", fontSize: "0.85rem", textAlign: "center", marginTop: "40px" }}>No events yet. Start adventuring!</p>}
              {logEntries.map(entry => {
                const time     = entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const isDM     = entry.role === "dm";
                const isPlayer = entry.role === "player";
                return (
                  <div key={entry.id} style={{ padding: "9px 12px", borderRadius: "8px", borderLeft: `3px solid ${isDM ? "#8b5cf6" : isPlayer ? "#0ea5e9" : "#475569"}`, background: isDM ? "rgba(139,92,246,0.08)" : isPlayer ? "rgba(14,165,233,0.08)" : "rgba(0,0,0,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: "bold", color: isDM ? "#a78bfa" : isPlayer ? "#38bdf8" : "#64748b" }}>
                        {isDM ? "DM" : entry.role === "system" ? "System" : (entry.sender ?? "Player")}
                      </span>
                      <span style={{ fontSize: "0.65rem", color: "#475569" }}>{time}</span>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: entry.role === "system" ? "#94a3b8" : "#cbd5e1", lineHeight: 1.45, margin: 0 }}>
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
                          {e.enemy_type} · CR {e.cr} · AC {e.ac}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end", flexShrink: 0 }}>
                        {e.is_defeated
                          ? <span style={{ fontSize: "0.6rem", background: "#1f2937", color: "#6b7280", borderRadius: "4px", padding: "2px 6px" }}>DEFEATED</span>
                          : <span style={{ fontSize: "0.6rem", background: `${color}22`, color, borderRadius: "4px", padding: "2px 6px", fontWeight: "bold" }}>{label}</span>
                        }
                        {isTargeted && (
                          <span style={{ fontSize: "0.58rem", background: "rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: "4px", padding: "2px 6px", fontWeight: "bold", letterSpacing: "0.04em" }}>⚔ TARGET</span>
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
                          <span style={{ fontSize: "0.65rem", color: "#64748b" }}>ATK +{e.attack_bonus} · {e.damage_dice}</span>
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
      </div>

      {/* ── Trade compose modal ── */}
      {tradeTarget && character && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => setTradeTarget(null)}>
          <div style={{ background: "#1e293b", borderRadius: "14px", padding: "24px", maxWidth: "400px", width: "90%", border: "1px solid rgba(139,92,246,0.45)", boxShadow: "0 20px 60px rgba(0,0,0,0.85)" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: "4px", fontSize: "1rem", fontWeight: "bold" }}>⇄ Trade with {tradeTarget.name}</h3>
            <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "18px" }}>{tradeTarget.race} {tradeTarget.class} · Lvl {tradeTarget.level}</p>

            {/* Items to offer */}
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Your Items to Offer</div>
              {[...(character.inventory?.weapons ?? []).map(w => ({ name: w, type: "weapon" as const })), ...(character.inventory?.items ?? []).map(i => ({ name: i, type: "item" as const }))].length === 0 ? (
                <p style={{ fontSize: "0.75rem", color: "#475569", fontStyle: "italic" }}>No items in inventory.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
                  {[...(character.inventory?.weapons ?? []).map(w => ({ name: w, type: "weapon" as const })), ...(character.inventory?.items ?? []).map(i => ({ name: i, type: "item" as const }))].map(({ name, type }, idx) => {
                    const isSelected = tradeItems.some(ti => ti.name === name && ti.type === type);
                    return (
                      <label key={`${type}-${idx}`} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", background: isSelected ? "rgba(139,92,246,0.15)" : "rgba(0,0,0,0.3)", cursor: "pointer", border: `1px solid ${isSelected ? "rgba(139,92,246,0.4)" : "transparent"}`, transition: "all 0.15s" }}>
                        <input type="checkbox" checked={isSelected}
                          onChange={() => setTradeItems(prev => isSelected ? prev.filter(ti => !(ti.name === name && ti.type === type)) : [...prev, { name, type }])}
                          style={{ accentColor: "#8b5cf6", width: "14px", height: "14px", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.8rem" }}>{type === "weapon" ? "⚔️" : "🎒"} {name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gold to offer */}
            <div style={{ marginBottom: "22px" }}>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Gold to Send</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="number" min={0} max={character.inventory?.gold ?? 0} value={tradeGold}
                  onChange={e => setTradeGold(Math.max(0, Math.min(character.inventory?.gold ?? 0, parseInt(e.target.value) || 0)))}
                  style={{ flex: 1, padding: "7px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.4)", border: "1px solid var(--border)", color: "#fbbf24", fontSize: "0.85rem", outline: "none" }} />
                <span style={{ fontSize: "0.75rem", color: "#64748b", flexShrink: 0 }}>/ {character.inventory?.gold ?? 0}gp available</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => { setTradeTarget(null); setTradeItems([]); setTradeGold(0); }}
                style={{ flex: 1, padding: "9px", borderRadius: "7px", fontSize: "0.8rem", border: "1px solid var(--border)", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={sendTradeOffer} disabled={tradeItems.length === 0 && tradeGold === 0}
                style={{ flex: 2, padding: "9px", borderRadius: "7px", fontSize: "0.8rem", fontWeight: "bold", border: "1px solid rgba(139,92,246,0.5)", background: tradeItems.length === 0 && tradeGold === 0 ? "rgba(139,92,246,0.05)" : "rgba(139,92,246,0.2)", color: tradeItems.length === 0 && tradeGold === 0 ? "#475569" : "#c4b5fd", cursor: tradeItems.length === 0 && tradeGold === 0 ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
                Send Offer ⇄
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Incoming trade modal ── */}
      {incomingTrade && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ background: "#1e293b", borderRadius: "14px", padding: "24px", maxWidth: "380px", width: "90%", border: "1px solid rgba(139,92,246,0.45)", boxShadow: "0 20px 60px rgba(0,0,0,0.85)", animation: "fadeInScale 0.2s ease" }}>
            <h3 style={{ marginBottom: "4px", fontSize: "1rem", fontWeight: "bold" }}>⇄ Trade Offer</h3>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "16px" }}><span style={{ color: "white", fontWeight: 600 }}>{incomingTrade.fromCharName}</span> wants to trade with you</p>

            <div style={{ padding: "12px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.35)", border: "1px solid var(--border)", marginBottom: "20px" }}>
              <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>They&apos;re offering</div>
              {incomingTrade.offeredItems.length === 0 && incomingTrade.offeredGold === 0 && (
                <p style={{ fontSize: "0.8rem", color: "#475569", fontStyle: "italic" }}>Nothing specified</p>
              )}
              {incomingTrade.offeredItems.map((item, i) => (
                <div key={i} style={{ fontSize: "0.82rem", padding: "3px 0", color: "#e2e8f0" }}>{item.type === "weapon" ? "⚔️" : "🎒"} {item.name}</div>
              ))}
              {incomingTrade.offeredGold > 0 && (
                <div style={{ fontSize: "0.85rem", color: "#fbbf24", fontWeight: "bold", marginTop: incomingTrade.offeredItems.length > 0 ? "6px" : 0 }}>
                  🪙 {incomingTrade.offeredGold} gold
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => declineTrade(incomingTrade)}
                style={{ flex: 1, padding: "9px", borderRadius: "7px", fontSize: "0.8rem", border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.22)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}>
                Decline
              </button>
              <button onClick={() => acceptTrade(incomingTrade)}
                style={{ flex: 2, padding: "9px", borderRadius: "7px", fontSize: "0.8rem", fontWeight: "bold", border: "1px solid rgba(139,92,246,0.5)", background: "rgba(139,92,246,0.2)", color: "#c4b5fd", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.32)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.2)"; }}>
                Accept Trade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent audio elements — must be in the DOM so Xbox Edge grants play
          permission when activated inside the Begin Adventure user gesture. */}
      <audio ref={narAudioRef}     preload="none" style={{ display: "none" }} />
      <audio ref={previewAudioRef} preload="none" style={{ display: "none" }} />

      <style>{`
        @keyframes blink  { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 0.75; } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </main>
  );
}
