"use client";

import React, { useState, useEffect, useRef, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
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
type PendingAction = { userId: string; characterName: string; content: string };
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
  inventory: { gold: number; weapons: string[]; items: string[] };
};

type PresencePlayer = {
  userId: string; characterName: string; characterClass: string;
  hp: number; maxHp: number; portraitUrl?: string | null;
};

const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
};

const OPENING_MESSAGES: Message[] = [
  { role: "system", content: "Welcome, adventurer. The torchlight flickers as your journey begins..." },
  { role: "dm",     content: '"Ah, brave adventurer. I have a task for you — if you possess the courage," the hooded figure rasps, leaning forward from the shadows of a corner booth.' },
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
  { id: "onyx",   label: "Gravedigger", desc: "Deep & foreboding"   },
  { id: "fable",  label: "Bard",        desc: "British storyteller" },
  { id: "echo",   label: "Herald",      desc: "Clear & resonant"    },
  { id: "ash",    label: "Rogue",       desc: "Gritty & measured"   },
  { id: "ballad", label: "Sage",        desc: "Warm narrator"       },
] as const;

// ── Colored narrative — red for damage, green for healing ─────────────────────
const DAMAGE_RE = /\b\d+\s*(?:(?:slashing|piercing|bludgeoning|fire|cold|lightning|thunder|poison|acid|necrotic|radiant|psychic|force)\s+)?damage\b/gi;
const HEAL_RE   = /\b(?:regain[s]?|heal[s]?|restore[s]?|recover[s]?)\s+\d+\s*(?:hit\s*points?|hp)?\b|\b\d+\s*(?:hit\s*points?|hp)\s+(?:restored|recovered)\b/gi;

function ColorizedText({ text }: { text: string }) {
  type Seg = { start: number; end: number; color: string };
  const segs: Seg[] = [];
  let m: RegExpExecArray | null;
  DAMAGE_RE.lastIndex = 0;
  while ((m = DAMAGE_RE.exec(text)) !== null) segs.push({ start: m.index, end: m.index + m[0].length, color: "#ef4444" });
  HEAL_RE.lastIndex = 0;
  while ((m = HEAL_RE.exec(text))   !== null) segs.push({ start: m.index, end: m.index + m[0].length, color: "#22c55e" });
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
  const [character,        setCharacter]         = useState<Character | null>(null);
  const [stateNotice,      setStateNotice]       = useState<string | null>(null);
  const [players,          setPlayers]           = useState<PresencePlayer[]>([]);
  const [userId,           setUserId]            = useState<string | null>(null);
  const [partyChangePending, setPartyChangePending] = useState(false);
  const [linkCopied,       setLinkCopied]        = useState(false);
  const [sidebarTab,       setSidebarTab]        = useState<"party" | "sheet" | "log">("party");

  // Narration
  const [narrationEnabled, setNarrationEnabled]  = useState(true);
  const [narrating,        setNarrating]         = useState(false);
  const [selectedVoice,    setSelectedVoice]     = useState<string>("fable");
  const [voicePickerOpen,  setVoicePickerOpen]   = useState(false);
  const selectedVoiceRef = useRef<string>("fable");

  // Campaign party (characters linked to this campaign — always visible)
  const [campaignParty,    setCampaignParty]      = useState<Character[]>([]);
  const [activeCharIdx,    setActiveCharIdx]      = useState(0);

  // Session / turns
  const [sessionStarted,   setSessionStarted]    = useState(false);
  const [turnOrder,        setTurnOrder]         = useState<string[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex]  = useState(0);
  const [pendingActions,   setPendingActions]    = useState<PendingAction[]>([]);

  // Campaign meta — pre-populate from sessionStorage when navigating from create-campaign
  const [campaignTitle, setCampaignTitle] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("pendingCampaignTitle");
    if (stored) { sessionStorage.removeItem("pendingCampaignTitle"); return stored; }
    return "";
  });

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

  // Stat tooltip hover
  const [hoveredStat,      setHoveredStat]        = useState<string | null>(null);

  // Item tooltip hover
  const [hoveredItem,      setHoveredItem]        = useState<string | null>(null);
  const [hoveredSpell,     setHoveredSpell]       = useState<string | null>(null);

  // Party management
  const [userRoster,       setUserRoster]         = useState<Character[]>([]);
  const [managePartyOpen,  setManagePartyOpen]    = useState(false);

  // Dice-roll targeting — character name the DM just asked to roll
  const [diceRollTarget,   setDiceRollTarget]     = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const logEndRef            = useRef<HTMLDivElement>(null);
  const abortRef             = useRef<AbortController | null>(null);
  const characterRef         = useRef<Character | null>(null);
  const channelRef           = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef            = useRef<string | null>(null);
  const narrateAudioRef      = useRef<HTMLAudioElement | null>(null);
  const audioPlayingRef      = useRef(false);
  const messagesRef          = useRef<Message[]>(OPENING_MESSAGES);
  const isTypingRef          = useRef(false);
  const narrationEnabledRef  = useRef(false);
  const prevPlayerDataRef    = useRef<Map<string, PresencePlayer>>(new Map());
  const isInitialPresenceRef = useRef(true);
  const narratePartyEventRef = useRef<((type: "join"|"leave"|"kick", player: PresencePlayer) => void) | null>(null);
  const turnOrderRef         = useRef<string[]>([]);
  const currentTurnIndexRef  = useRef(0);
  const pendingActionsRef    = useRef<PendingAction[]>([]);
  const pendingJoinsRef      = useRef<PresencePlayer[]>([]);
  const joinDebounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLeavesRef     = useRef<PresencePlayer[]>([]);
  const leaveDebounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSceneRef      = useRef<string>("tavern");
  const resumeNarrationRef   = useRef<string>("");
  // Ordered narration slot system — ensures sentences always play in the order they were sent
  const narSlotCounterRef    = useRef(0);
  const narSlotsRef          = useRef<(string | "SKIP" | null)[]>([]);
  const narPlaySlotRef       = useRef(0);
  const campaignPartyRef     = useRef<Character[]>([]);
  const pendingSpellCastRef  = useRef<number>(0);

  // ── Ref sync effects ─────────────────────────────────────────────────────────
  useEffect(() => { characterRef.current        = character;        }, [character]);
  useEffect(() => { campaignPartyRef.current    = campaignParty;    }, [campaignParty]);
  useEffect(() => { userIdRef.current           = userId;           }, [userId]);
  useEffect(() => { selectedVoiceRef.current    = selectedVoice;    }, [selectedVoice]);
  useEffect(() => { messagesRef.current         = messages;         }, [messages]);
  useEffect(() => { isTypingRef.current         = isTyping;         }, [isTyping]);
  useEffect(() => { narrationEnabledRef.current = narrationEnabled;  }, [narrationEnabled]);
  useEffect(() => { turnOrderRef.current        = turnOrder;        }, [turnOrder]);
  useEffect(() => { currentTurnIndexRef.current = currentTurnIndex; }, [currentTurnIndex]);
  useEffect(() => { pendingActionsRef.current   = pendingActions;   }, [pendingActions]);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [charRes, historyRes, partyRes, campRes] = await Promise.all([
        // Load ALL of the current user's characters (no limit — used for roster + active char)
        supabase.from("characters").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("campaign_messages").select("role, content, sender, created_at").eq("campaign_id", params.id).order("created_at", { ascending: true }),
        // Fetch all characters in this campaign; filter party_active in JS so the
        // query never fails if the column is NULL or the migration hasn't run yet.
        supabase.from("characters").select("*").eq("campaign_id", params.id).order("created_at"),
        supabase.from("campaigns").select("title").eq("id", params.id).single(),
      ]);

      if (campRes.data?.title) setCampaignTitle(campRes.data.title);
      else if (campRes.error) console.error("[campaign] title fetch:", campRes.error.message);

      if (partyRes.error) console.error("[campaign] party fetch:", partyRes.error.message);

      // Roster = all user characters
      if (charRes.data) setUserRoster(charRes.data as Character[]);

      // Include characters where party_active is true OR null (handles missing migration)
      const rawParty = (partyRes.data ?? []) as Character[];
      const party    = rawParty.filter(c => c.party_active !== false);

      if (party.length) {
        setCampaignParty(party);
        campaignPartyRef.current = party;
        // Set active character to the current user's own character in the party
        const myChar = party.find(c => c.user_id === user.id) ?? (charRes.data?.[0] as Character | undefined);
        const myIdx  = party.findIndex(c => c.user_id === user.id);
        if (myChar) { setCharacter(myChar); characterRef.current = myChar; }
        if (myIdx >= 0) setActiveCharIdx(myIdx);
      } else if (charRes.data?.[0]) {
        setCharacter(charRes.data[0] as Character);
      }

      if (historyRes.data && historyRes.data.length > 0) {
        const hist = historyRes.data as (Message & { created_at?: string })[];
        setMessages([...OPENING_MESSAGES, ...hist]);
        setLogEntries(hist.map((m, i) => ({
          id: `hist-${i}`, timestamp: m.created_at ? new Date(m.created_at) : new Date(),
          role: m.role, sender: m.sender, content: m.content,
        })));
        const lastDm = [...hist].reverse().find(m => m.role === "dm");
        if (lastDm) resumeNarrationRef.current = lastDm.content;
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
        const all      = Object.values(channel.presenceState<PresencePlayer>()).flat();
        const newOrder = all.map(p => p.userId).sort();
        setPlayers(all);
        turnOrderRef.current = newOrder;
        setTurnOrder(newOrder);
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
      .on("broadcast", { event: "player_action" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        setMessages(prev => [...prev, { role: "player", content: payload.content, sender: payload.characterName }]);
        setLogEntries(prev => [...prev, { id: `rt-${Date.now()}`, timestamp: new Date(), role: "player", sender: payload.characterName, content: payload.content }]);
      })
      .on("broadcast", { event: "dm_response" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        setIsTyping(false); setStreamingContent("");
        setMessages(prev => [...prev, { role: "dm", content: payload.content }]);
        setLogEntries(prev => [...prev, { id: `rt-${Date.now()}`, timestamp: new Date(), role: "dm", content: payload.content }]);
        const rollTarget = detectDiceRollTarget(payload.content as string);
        setDiceRollTarget(rollTarget);
        fetch("/api/chat-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: payload.content }) })
          .then(r => r.json()).then((change: StateChange) => applyStateChange(change)).catch(() => {});
      })
      .on("broadcast", { event: "dm_typing" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        setIsTyping(payload.typing as boolean);
        if (!payload.typing) setStreamingContent("");
      })
      .on("broadcast", { event: "turn_taken" }, ({ payload }) => {
        if (payload.userId === userIdRef.current) return;
        setCurrentTurnIndex(payload.newIndex);
        setPendingActions(payload.pendingActions);
        currentTurnIndexRef.current = payload.newIndex;
        pendingActionsRef.current   = payload.pendingActions;
      })
      .on("broadcast", { event: "round_reset" }, () => {
        setCurrentTurnIndex(0); setPendingActions([]);
        currentTurnIndexRef.current = 0; pendingActionsRef.current = [];
      })
      .on("broadcast", { event: "character_hp_update" }, ({ payload }) => {
        const { charId, newHp, newMaxHp } = payload as { charId: string; newHp: number; newMaxHp: number };
        setCampaignParty(prev => prev.map(c => c.id === charId ? { ...c, hp: newHp, max_hp: newMaxHp } : c));
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
      .on("broadcast", { event: "scene_change" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        if (payload.imageUrl) { currentSceneRef.current = payload.sceneName; setCurrentSceneUrl(payload.imageUrl); }
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

  // ── State changes (HP, gold, items, XP) ──────────────────────────────────────
  const applyStateChange = useCallback(async (change: StateChange) => {
    const char = characterRef.current;
    if (!char) return;
    // In multiplayer, only apply to the character targeted by the DM
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

    // Broadcast HP update so all players' party cards stay in sync
    if (change.hp_delta !== 0 || leveledUp) {
      channelRef.current?.send({ type: "broadcast", event: "character_hp_update", payload: { charId: char.id, newHp, newMaxHp } });
    }

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
    if (slot >= narSlotCounterRef.current) return; // nothing pending
    const entry = narSlotsRef.current[slot];
    if (entry === null || entry === undefined) return; // slot not ready yet — will be called when it arrives
    narPlaySlotRef.current++;
    if (entry === "SKIP") { playNextInQueue(); return; }

    audioPlayingRef.current = true;
    const audio = narrateAudioRef.current;
    if (!audio) { audioPlayingRef.current = false; return; }
    audio.src = entry;
    audio.onended = () => {
      URL.revokeObjectURL(entry);
      audioPlayingRef.current = false;
      if (narPlaySlotRef.current >= narSlotCounterRef.current) setNarrating(false);
      playNextInQueue();
    };
    setNarrating(true);
    audio.play().catch((err) => { console.error("[narration] play() blocked:", err); audioPlayingRef.current = false; setNarrating(false); playNextInQueue(); });
  }, []);

  const enqueueNarration = useCallback(async (text: string) => {
    const slot = narSlotCounterRef.current++;
    narSlotsRef.current[slot] = null; // reserve — not ready yet
    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: selectedVoiceRef.current }),
      });
      if (!res.ok) {
        console.error("[narration] /api/narrate returned", res.status);
        narSlotsRef.current[slot] = "SKIP"; playNextInQueue(); return;
      }
      const blob = await res.blob();
      narSlotsRef.current[slot] = URL.createObjectURL(blob);
      playNextInQueue();
    } catch (err) {
      console.error("[narration] fetch error:", err);
      narSlotsRef.current[slot] = "SKIP";
      playNextInQueue();
    }
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
    await Promise.all(theirChars.map(c => supabase.from("characters").update({ party_active: false }).eq("id", c.id)));
    channelRef.current?.send({ type: "broadcast", event: "player_kicked", payload: { targetUserId: player.userId } });
    narratePartyEvent("kick", player);
  }, [narratePartyEvent]);

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

  // ── AI call ───────────────────────────────────────────────────────────────────
  const sendToAI = async (allMessages: Message[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset narration queue
    if (narrateAudioRef.current) { narrateAudioRef.current.pause(); narrateAudioRef.current.src = ""; }
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

      // Build full party context for the DM (effective stats)
      const partyForDM = campaignPartyRef.current.length > 1
        ? campaignPartyRef.current.map(c => {
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

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages, character: charForDM, party: partyForDM }),
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
        if (narrationEnabled) {
          const m = narBuf.match(/^([\s\S]{60,}?[.!?…]["']?)\s+/);
          if (m) { enqueueNarration(m[1]); narBuf = narBuf.slice(m[0].length); }
        }
      }
      if (narrationEnabled && narBuf.trim().length > 10) enqueueNarration(narBuf.trim());

      setMessages(prev => [...prev, { role: "dm", content: full }]);
      setLogEntries(prev => [...prev, { id: `dm-${Date.now()}`, timestamp: new Date(), role: "dm", content: full }]);

      // Detect which character the DM is asking to roll dice
      const rollTarget = detectDiceRollTarget(full);
      setDiceRollTarget(rollTarget);

      const lastPlayerMsg = allMessages[allMessages.length - 1];
      supabase.from("campaign_messages").insert([
        { campaign_id: params.id, role: lastPlayerMsg.role, content: lastPlayerMsg.content, sender: lastPlayerMsg.sender ?? null },
        { campaign_id: params.id, role: "dm",               content: full,                  sender: null },
      ]).then(({ error }) => { if (error) console.error("[campaign] save:", error); });

      channelRef.current?.send({ type: "broadcast", event: "dm_response", payload: { senderId: userId, content: full } });

      // State changes (HP, gold, items, XP)
      fetch("/api/chat-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: full }) })
        .then(r => r.json()).then((change: StateChange) => applyStateChange(change)).catch(() => {});

      // Suggested actions
      fetch("/api/suggest-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dmResponse: full, character: characterRef.current }) })
        .then(r => r.json()).then(({ suggestions: s }) => setSuggestions(s ?? [])).catch(() => {});

      // Scene detection (non-blocking — updates background when ready)
      setSceneLoading(true);
      fetch("/api/detect-scene", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: full, currentScene: currentSceneRef.current }) })
        .then(r => r.json())
        .then(({ sceneName, imageUrl }: { sceneName: string; imageUrl: string | null }) => {
          if (imageUrl && sceneName !== currentSceneRef.current) {
            currentSceneRef.current = sceneName;
            setCurrentSceneUrl(imageUrl);
            channelRef.current?.send({ type: "broadcast", event: "scene_change", payload: { senderId: userId, sceneName, imageUrl } });
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

  // ── Player send ───────────────────────────────────────────────────────────────
  const handleSend = async (actionText?: string) => {
    const text = (actionText ?? input).trim();
    if (!text || isTyping) return;
    const order    = turnOrderRef.current;
    const isMyTurn = order.length === 0 || order[currentTurnIndexRef.current] === userId;
    if (!isMyTurn) return;
    if (!actionText) setInput("");
    setSuggestions([]);
    setDiceRollTarget(null); // clear roll highlight when player acts

    const playerMsg: Message = { role: "player", content: text, sender: character?.name ?? "You" };
    const updatedMessages    = [...messages, playerMsg];
    setMessages(updatedMessages);
    setLogEntries(prev => [...prev, { id: `player-${Date.now()}`, timestamp: new Date(), role: "player", sender: playerMsg.sender, content: text }]);
    channelRef.current?.send({ type: "broadcast", event: "player_action", payload: { senderId: userId, content: text, characterName: character?.name } });

    const myAction: PendingAction = { userId: userId!, characterName: character?.name ?? "Player", content: text };
    const newPending = [...pendingActionsRef.current, myAction];
    const newIndex   = currentTurnIndexRef.current + 1;
    setPendingActions(newPending); setCurrentTurnIndex(newIndex);
    pendingActionsRef.current = newPending; currentTurnIndexRef.current = newIndex;
    channelRef.current?.send({ type: "broadcast", event: "turn_taken", payload: { userId, newIndex, pendingActions: newPending } });

    if (order.length === 0 || newIndex >= order.length) {
      await sendToAI(updatedMessages);
      setPendingActions([]); setCurrentTurnIndex(0);
      pendingActionsRef.current = []; currentTurnIndexRef.current = 0;
      channelRef.current?.send({ type: "broadcast", event: "round_reset", payload: {} });
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
        party_active:     true,
        hp:               freshHp,
        spell_slots_used: {},
        status_effects:   [],
      }).eq("id", char.id);
      if (error) { console.error("[addToParty]", error); return; }
      updated = { ...char, campaign_id: params.id, party_active: true, hp: freshHp, spell_slots_used: {}, status_effects: [] };
    } else {
      // Returning to this campaign — restore last saved state, clamp hp, mark active
      const ib = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
      const clampedHp = Math.min(char.hp, char.max_hp + ib.hpMaxAdd);
      const dbUpdate: Record<string, unknown> = { party_active: true };
      if (clampedHp !== char.hp) dbUpdate.hp = clampedHp;
      await supabase.from("characters").update(dbUpdate).eq("id", char.id);
      updated = { ...char, party_active: true, hp: clampedHp };
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
    // Persist the removal — character keeps campaign_id (state preserved) but is inactive
    await supabase.from("characters").update({ party_active: false }).eq("id", charId);
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

  const handleDiceResult  = (result: number) => { setShowDice(false); handleSend(`[Rolled a ${result} on a d20]`); };
  const copyInviteLink    = () => { navigator.clipboard.writeText(window.location.href); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };

  const otherPlayers        = players.filter(p => p.userId !== userId);
  const currentTurnPlayerId = turnOrder[currentTurnIndex] ?? null;
  const isMyTurn            = turnOrder.length === 0 || currentTurnPlayerId === userId;
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
      <audio ref={narrateAudioRef} />
      {showDice && <DiceRoller onRollComplete={handleDiceResult} />}

      {/* Session start overlay */}
      {!sessionStarted && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,3,15,0.97)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <div className="animate-fade-in" style={{ textAlign: "center", maxWidth: "480px", padding: "40px" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "24px" }}>⚔️</div>
            <h1 style={{ fontSize: "2.2rem", fontWeight: "bold", marginBottom: "10px" }}>Your adventure awaits</h1>
            <p style={{ color: "#64748b", marginBottom: "40px", lineHeight: 1.6 }}>The torchlight flickers as your party gathers in the shadows…</p>
            <button className="btn-primary"
              style={{ padding: "16px 48px", fontSize: "1.1rem", borderRadius: "12px", letterSpacing: "0.04em" }}
              onClick={() => {
                setSessionStarted(true);

                // Unlock the narration <audio> element synchronously inside this click handler.
                // Browsers gate audio.play() on user-gesture call-stack proximity — once we
                // play (even a silent clip) here, future async play() calls on this element
                // are allowed for the rest of the session.
                const narAudio = narrateAudioRef.current;
                if (narAudio) {
                  narAudio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
                  narAudio.play().catch(() => {});
                }

                // Start background music — must be called synchronously within this click
                // handler so it counts as a user gesture in all browsers.
                window.__dndMusicPlay?.();

                // Narrate the last DM line on resume, or the opening line for new campaigns.
                enqueueNarration(resumeNarrationRef.current || OPENING_MESSAGES[1].content);
              }}>
              Enter the Tavern
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
            {currentSceneRef.current === "tavern" ? "The Broken Cask Tavern" : currentSceneRef.current.charAt(0).toUpperCase() + currentSceneRef.current.slice(1)}
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
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100, background: "rgba(10,7,24,0.97)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: "10px", padding: "6px", minWidth: "160px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                {VOICES.map(v => (
                  <button key={v.id} onClick={() => {
                    // Flush the narration queue before switching voices.
                    // Without this, in-flight TTS fetches orphan their slots and
                    // audioPlayingRef can get stuck true (browser paused audio on
                    // the dropdown click, so onended never fires), silently
                    // breaking all future narration.
                    if (narrateAudioRef.current) { narrateAudioRef.current.pause(); narrateAudioRef.current.src = ""; }
                    narSlotCounterRef.current = 0; narSlotsRef.current = []; narPlaySlotRef.current = 0;
                    audioPlayingRef.current = false;
                    setNarrating(false);
                    setSelectedVoice(v.id);
                    setVoicePickerOpen(false);
                  }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: "7px", border: "none", background: selectedVoice === v.id ? "rgba(139,92,246,0.25)" : "transparent", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (selectedVoice !== v.id) e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
                    onMouseLeave={e => { if (selectedVoice !== v.id) e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: "bold", color: selectedVoice === v.id ? "#c4b5fd" : "white" }}>{v.label}</div>
                    <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "1px" }}>{v.desc}</div>
                  </button>
                ))}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "4px", paddingTop: "4px" }}>
                  <button onClick={() => { if (narrateAudioRef.current) { narrateAudioRef.current.pause(); narrateAudioRef.current.src = ""; } setNarrationEnabled(false); setVoicePickerOpen(false); }}
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

        {/* Turn indicator */}
        {turnOrder.length > 1 && (
          <div style={{ padding: "7px 16px", background: "rgba(139,92,246,0.08)", borderBottom: "1px solid rgba(139,92,246,0.15)", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px" }}>
            {isTyping ? (
              <span style={{ color: "#8b5cf6" }}>⏳ DM is responding…</span>
            ) : currentTurnIndex >= turnOrder.length ? (
              <span style={{ color: "#8b5cf6" }}>All actions in — DM is next…</span>
            ) : (
              <>
                <span style={{ color: "#475569" }}>Turn {currentTurnIndex + 1} of {turnOrder.length}:</span>
                <span style={{ color: isMyTurn ? "#c4b5fd" : "white", fontWeight: "bold" }}>
                  {isMyTurn ? "Your turn" : `${players.find(p => p.userId === currentTurnPlayerId)?.characterName ?? "Waiting"}…`}
                </span>
              </>
            )}
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
              }}>{msg.role === "dm" ? <ColorizedText text={msg.content} /> : msg.content}</div>
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
                <button key={i} onClick={() => handleSend(s)}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: "8px", fontSize: "0.82rem", border: "1px solid rgba(139,92,246,0.25)", background: "rgba(139,92,246,0.06)", color: "#cbd5e1", cursor: "pointer", transition: "all 0.15s", lineHeight: 1.4 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.18)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)"; e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.06)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)"; e.currentTarget.style.color = "#cbd5e1"; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--border)", background: "var(--card-bg)" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn-secondary" onClick={() => setShowDice(true)} disabled={isTyping || !isMyTurn} style={{ padding: "0 14px", fontSize: "1.2rem", flexShrink: 0 }} title="Roll Dice">🎲</button>
            <input
              type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={isTyping || !isMyTurn}
              placeholder={
                isTyping   ? "The DM is responding…"
                : !isMyTurn ? `Waiting for ${players.find(p => p.userId === currentTurnPlayerId)?.characterName ?? "other players"}…`
                : "Describe your action…"
              }
              style={{ flex: 1, background: "rgba(0,0,0,0.5)", border: "1px solid var(--border)", borderRadius: "8px", color: "white", padding: "11px 14px", fontSize: "0.9rem", opacity: (isTyping || !isMyTurn) ? 0.6 : 1 }}
            />
            <button className="btn-primary" onClick={() => handleSend()} disabled={isTyping || !isMyTurn || !input.trim()} style={{ flexShrink: 0 }}>Send</button>
          </div>
        </div>
      </div>

      {/* ── Pane 3: Sidebar ── */}
      <div style={{ flex: "0 0 300px", background: "var(--card-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Tab toggle */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {(["party", "sheet", "log"] as const).map(tab => (
            <button key={tab} onClick={() => setSidebarTab(tab)}
              style={{ flex: 1, padding: "12px 4px", fontSize: "0.68rem", fontWeight: "bold",
                background: sidebarTab === tab ? "rgba(139,92,246,0.15)" : "transparent",
                borderTop: "none", borderLeft: "none", borderRight: "none",
                borderBottom: sidebarTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
                color: sidebarTab === tab ? "var(--primary)" : "#64748b",
                cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", transition: "all 0.15s" }}>
              {tab === "party" ? "Party" : tab === "sheet" ? "Character" : "Log"}
            </button>
          ))}
        </div>

        {/* ── Party tab ── */}
        {sidebarTab === "party" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Party ({campaignParty.length > 0 ? campaignParty.length : allPartyCards.length})
              </h3>
              <button onClick={copyInviteLink}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 10px", fontSize: "0.7rem", color: linkCopied ? "#22c55e" : "#94a3b8", cursor: "pointer", transition: "all 0.15s" }}>
                {linkCopied ? "✓ Copied!" : "🔗 Invite"}
              </button>
            </div>

            {/* Player cards — campaign party (always visible) or presence fallback */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: droppedItems.length > 0 ? "20px" : 0 }}>
              {campaignParty.length > 0 ? campaignParty.map((char, idx) => {
                const isActive    = idx === activeCharIdx;
                const isOnline    = players.some(p => p.userId === char.user_id);
                const isDiceTarget = diceRollTarget === char.name;
                const isMyChar    = char.user_id === userId;
                const cardInv     = char.inventory ?? { gold: 0, items: [], weapons: [] };
                const cardIb      = computeInventoryBonuses(cardInv.items, cardInv.weapons);
                const cardMaxHp   = char.max_hp + cardIb.hpMaxAdd;
                const pct         = Math.max(0, Math.min(100, (char.hp / Math.max(1, cardMaxHp)) * 100));
                const color       = pct > 60 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
                const classEmoji  = char.class === "Wizard" ? "🧙" : char.class === "Rogue" ? "🗡️" : char.class === "Cleric" ? "✝" : "⚔";
                const borderColor = isDiceTarget ? "rgba(251,191,36,0.9)" : isActive ? "rgba(139,92,246,0.6)" : "var(--border)";
                const bgColor     = isDiceTarget ? "rgba(251,191,36,0.08)" : isActive ? "rgba(139,92,246,0.12)" : "rgba(0,0,0,0.3)";
                const glow        = isDiceTarget ? "0 0 20px rgba(251,191,36,0.4)" : isActive ? "0 0 20px rgba(139,92,246,0.28)" : "none";
                return (
                  <div key={char.id}
                    onClick={() => campaignParty.length > 1 && setActiveCharIdx(idx)}
                    style={{ padding: "12px 14px", background: bgColor, borderRadius: "10px", border: `1.5px solid ${borderColor}`, boxShadow: glow, transition: "all 0.3s ease", cursor: campaignParty.length > 1 ? "pointer" : "default" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${isActive ? "rgba(139,92,246,0.7)" : "var(--border)"}`, background: "rgba(0,0,0,0.4)" }}>
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
                      <span style={{ fontSize: "0.72rem", color, fontWeight: "bold" }} title={cardIb.hpMaxAdd > 0 ? `Base ${char.max_hp} +${cardIb.hpMaxAdd} item bonus` : undefined}>
                        {Math.min(char.hp, cardMaxHp)}/{cardMaxHp} HP{cardIb.hpMaxAdd > 0 ? " ✦" : ""}
                      </span>
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
                          return <span key={s} style={{ fontSize: "0.6rem", padding: "1px 6px", borderRadius: "10px", background: st.bg, color: st.color, fontWeight: 700, letterSpacing: "0.03em" }}>{s}</span>;
                        })}
                      </div>
                    )}
                  </div>
                );
              }) : allPartyCards.map(p => {
                const isCurrentTurn = turnOrder.length > 1 && p.userId === currentTurnPlayerId;
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
                          {isMe && <span style={{ fontSize: "0.58rem", background: "rgba(139,92,246,0.3)", color: "#c4b5fd", borderRadius: "3px", padding: "1px 4px", flexShrink: 0 }}>You</span>}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{p.characterClass}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
                        {!isMe && (
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

            {/* Manage party — add/remove characters from roster */}
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
            </div>

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
                      return <span key={s} style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: "20px", background: st.bg, color: st.color, fontWeight: 700, border: `1px solid ${st.color}40` }}>{s}</span>;
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
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", marginBottom: "6px", fontSize: "0.85rem" }}>
                    <span>Gold</span>
                    <span style={{ color: "#fbbf24", fontWeight: "bold" }}>{character.inventory?.gold ?? 0}gp</span>
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

      <style>{`
        @keyframes blink  { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 0.75; } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </main>
  );
}
