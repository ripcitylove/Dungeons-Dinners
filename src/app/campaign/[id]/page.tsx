"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import "../../globals.css";
import DiceRoller from "../../../components/DiceRoller";
import type { StateChange } from "../../api/chat-state/route";
import { getXpToNextLevel, SPELLCASTING_CLASSES } from "../../../lib/spellData";

type MsgRole  = "dm" | "player" | "system";
type Message  = { role: MsgRole; content: string; sender?: string };
type LogEntry = { id: string; timestamp: Date; role: MsgRole; sender?: string; content: string };
type PendingAction = { userId: string; characterName: string; content: string };
type DroppedItem   = { id: string; name: string; type: "item" | "weapon"; fromCharacter: string; fromUserId: string };

type Character = {
  id: string; user_id?: string; name: string; race: string; class: string; level: number;
  hp: number; max_hp: number; xp?: number;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  background?: string;
  portrait_url?: string | null;
  sex?: string;
  cantrips_known?: string[];
  spells_prepared?: string[];
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
  { id: "nova",   label: "Sage",        desc: "Warm narrator"       },
] as const;

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

  // Campaign meta
  const [campaignTitle,    setCampaignTitle]      = useState<string>("");

  // Scene
  const [currentSceneUrl,  setCurrentSceneUrl]   = useState<string | null>(null);
  const [sceneLoading,     setSceneLoading]       = useState(false);

  // Inventory exchange
  const [droppedItems,     setDroppedItems]       = useState<DroppedItem[]>([]);

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
  const currentSceneRef      = useRef<string>("tavern");
  // Ordered narration slot system — ensures sentences always play in the order they were sent
  const narSlotCounterRef    = useRef(0);
  const narSlotsRef          = useRef<(string | "SKIP" | null)[]>([]);
  const narPlaySlotRef       = useRef(0);
  const campaignPartyRef     = useRef<Character[]>([]);

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
        supabase.from("characters").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("campaign_messages").select("role, content, sender, created_at").eq("campaign_id", params.id).order("created_at", { ascending: true }),
        supabase.from("characters").select("*").eq("campaign_id", params.id).order("created_at"),
        supabase.from("campaigns").select("title").eq("id", params.id).single(),
      ]);

      if (campRes.data?.title) setCampaignTitle(campRes.data.title);

      if (partyRes.data?.length) {
        const party = partyRes.data as Character[];
        setCampaignParty(party);
        campaignPartyRef.current = party;
        setCharacter(party[0]);
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
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

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
      .on("broadcast", { event: "item_dropped" }, ({ payload }) => {
        if (payload.fromUserId === userIdRef.current) return;
        setDroppedItems(prev => [...prev, payload as DroppedItem]);
      })
      .on("broadcast", { event: "item_taken" }, ({ payload }) => {
        setDroppedItems(prev => prev.filter(i => i.id !== payload.id));
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
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
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
    const hasChange =
      change.hp_delta !== 0 || change.gold_delta !== 0 ||
      change.items_gained.length > 0 || change.items_lost.length > 0 ||
      change.weapons_gained.length > 0 || change.xp_award > 0;
    if (!hasChange) return;

    const newHp      = Math.max(0, Math.min(char.max_hp, char.hp + change.hp_delta));
    const newGold    = Math.max(0, (char.inventory?.gold ?? 0) + change.gold_delta);
    const newItems   = [...(char.inventory?.items ?? []).filter(i => !change.items_lost.includes(i)), ...change.items_gained];
    const newWeapons = [...(char.inventory?.weapons ?? []), ...change.weapons_gained];

    const parts: string[] = [];
    if (change.hp_delta    < 0) parts.push(`${Math.abs(change.hp_delta)} damage taken`);
    if (change.hp_delta    > 0) parts.push(`+${change.hp_delta} HP restored`);
    if (change.gold_delta  > 0) parts.push(`+${change.gold_delta}gp`);
    if (change.gold_delta  < 0) parts.push(`${change.gold_delta}gp`);
    change.items_gained.forEach(i   => parts.push(`+${i}`));
    change.weapons_gained.forEach(w => parts.push(`+${w}`));

    // XP award
    let newXp    = char.xp ?? 0;
    let newLevel = char.level;
    let newMaxHp = char.max_hp;
    let leveledUp = false;

    if (change.xp_award > 0) {
      newXp += change.xp_award;
      parts.push(`+${change.xp_award} XP`);

      // Check level up (D&D 5e thresholds)
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
      inventory: { gold: newGold, items: newItems, weapons: newWeapons },
    };
    setCharacter(updatedChar);
    setCampaignParty(prev => prev.map(c => c.id === char.id ? updatedChar : c));

    const dbUpdate: Record<string, unknown> = {
      hp: newHp, inventory: updatedChar.inventory, xp: newXp,
    };
    if (leveledUp) { dbUpdate.level = newLevel; dbUpdate.max_hp = newMaxHp; }
    await supabase.from("characters").update(dbUpdate).eq("id", char.id);

    if (parts.length) {
      const notice = parts.join(" · ");
      setStateNotice(notice);
      setTimeout(() => setStateNotice(null), leveledUp ? 8000 : 4000);
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
  const narratePartyEvent = useCallback(async (type: "join" | "leave" | "kick", player: PresencePlayer) => {
    const label    = type === "join" ? `${player.characterName} has joined the party.`
                   : type === "kick" ? `${player.characterName} has been removed from the party.`
                   :                   `${player.characterName} has left the party.`;
    const systemMsg: Message = { role: "system", content: `⚔ ${label}` };
    setMessages(prev => [...prev, systemMsg]);
    setLogEntries(prev => [...prev, { id: `party-${Date.now()}`, timestamp: new Date(), role: "system", content: `⚔ ${label}` }]);
    if (isTypingRef.current) return;

    setIsTyping(true); isTypingRef.current = true;
    setStreamingContent("");
    // Reset narration slots for this new response
    narSlotCounterRef.current = 0; narSlotsRef.current = []; narPlaySlotRef.current = 0;

    const trigger: Message = {
      role: "player",
      content: `[Party change — weave naturally into the story: ${player.characterName}, a ${player.characterClass}, ${type === "join" ? "has arrived and joined" : "has departed from"} the party]`,
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messagesRef.current, systemMsg, trigger], character: characterRef.current }),
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

  useEffect(() => { narratePartyEventRef.current = narratePartyEvent; }, [narratePartyEvent]);

  const kickPlayer = useCallback((player: PresencePlayer) => {
    channelRef.current?.send({ type: "broadcast", event: "player_kicked", payload: { targetUserId: player.userId } });
    narratePartyEvent("kick", player);
  }, [narratePartyEvent]);

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages, character }),
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

      // Advance turn to next campaign character
      if (campaignPartyRef.current.length > 1) {
        setActiveCharIdx(prev => (prev + 1) % campaignPartyRef.current.length);
      }

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

  const handleDiceResult  = (result: number) => { setShowDice(false); handleSend(`[Rolled a ${result} on a d20]`); };
  const copyInviteLink    = () => { navigator.clipboard.writeText(window.location.href); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };

  const hpPercent        = character ? Math.max(0, (character.hp / character.max_hp) * 100) : 0;
  const hpColor          = hpPercent > 60 ? "#22c55e" : hpPercent > 25 ? "#f59e0b" : "#ef4444";
  const otherPlayers     = players.filter(p => p.userId !== userId);
  const currentTurnPlayerId = turnOrder[currentTurnIndex] ?? null;
  const isMyTurn         = turnOrder.length === 0 || currentTurnPlayerId === userId;
  const allPartyCards    = players.slice().sort((a, b) => a.characterName.localeCompare(b.characterName));

  const xpToNext   = character ? getXpToNextLevel(character.level) : 300;
  const xpPercent  = character ? Math.min(100, ((character.xp ?? 0) / xpToNext) * 100) : 0;

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

                // Narrate the DM's opening line immediately.
                enqueueNarration(OPENING_MESSAGES[1].content);
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
              }}>{msg.content}</div>
            </div>
          ))}

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
            <button className="btn-secondary" onClick={() => setShowDice(true)} disabled={isTyping} style={{ padding: "0 14px", fontSize: "1.2rem", flexShrink: 0 }} title="Roll Dice">🎲</button>
            <input
              type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={isTyping}
              placeholder={isTyping ? "The DM is responding..." : "Describe your action..."}
              style={{ flex: 1, background: "rgba(0,0,0,0.5)", border: "1px solid var(--border)", borderRadius: "8px", color: "white", padding: "11px 14px", fontSize: "0.9rem", opacity: isTyping ? 0.6 : 1 }}
            />
            <button className="btn-primary" onClick={() => handleSend()} disabled={isTyping || !input.trim()} style={{ flexShrink: 0 }}>Send</button>
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
                const isActive  = idx === activeCharIdx;
                const isOnline  = players.some(p => p.userId === char.user_id);
                const pct       = Math.max(0, (char.hp / char.max_hp) * 100);
                const color     = pct > 60 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
                const classEmoji = char.class === "Wizard" ? "🧙" : char.class === "Rogue" ? "🗡️" : char.class === "Cleric" ? "✝" : "⚔";
                return (
                  <div key={char.id}
                    onClick={() => campaignParty.length > 1 && setActiveCharIdx(idx)}
                    style={{ padding: "12px 14px", background: isActive ? "rgba(139,92,246,0.12)" : "rgba(0,0,0,0.3)", borderRadius: "10px", border: isActive ? "1.5px solid rgba(139,92,246,0.6)" : "1px solid var(--border)", boxShadow: isActive ? "0 0 20px rgba(139,92,246,0.28)" : "none", transition: "all 0.3s ease", cursor: campaignParty.length > 1 ? "pointer" : "default" }}>
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
                          <span style={{ fontSize: "0.88rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{char.name}</span>
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
                      <span style={{ fontSize: "0.72rem", color, fontWeight: "bold" }}>{char.hp}/{char.max_hp} HP</span>
                      {campaignParty.length > 1 && (
                        <span style={{ fontSize: "0.65rem", fontWeight: "bold", color: isActive ? "#c4b5fd" : "#3f3f46", background: isActive ? "rgba(139,92,246,0.2)" : "transparent", borderRadius: "4px", padding: isActive ? "2px 7px" : "0" }}>
                          {isActive ? "Acting" : "Waiting"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }) : allPartyCards.map(p => {
                const isCurrentTurn = turnOrder.length > 1 && p.userId === currentTurnPlayerId;
                const isMe          = p.userId === userId;
                const pct           = Math.max(0, (p.hp / p.maxHp) * 100);
                const color         = pct > 60 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={p.userId} style={{ padding: "12px 14px", background: isCurrentTurn ? "rgba(139,92,246,0.12)" : "rgba(0,0,0,0.3)", borderRadius: "10px", border: isCurrentTurn ? "1.5px solid rgba(139,92,246,0.6)" : "1px solid var(--border)", boxShadow: isCurrentTurn ? "0 0 18px rgba(139,92,246,0.25)" : "none", transition: "all 0.3s ease" }}>
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
                          <span style={{ fontSize: "0.88rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.characterName}</span>
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
                      {turnOrder.length > 1 && (
                        <span style={{ fontSize: "0.65rem", fontWeight: "bold", color: isCurrentTurn ? "#c4b5fd" : "#475569", background: isCurrentTurn ? "rgba(139,92,246,0.2)" : "transparent", borderRadius: "4px", padding: isCurrentTurn ? "2px 7px" : "0" }}>
                          {isCurrentTurn ? (isMe ? "⚡ Your turn" : "⚡ Acting…") : "Waiting"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {campaignParty.length === 0 && allPartyCards.length === 0 && (
                <p style={{ fontSize: "0.78rem", color: "#475569", fontStyle: "italic" }}>No adventurers connected. Share the invite link!</p>
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
                <div style={{ display: "flex", alignItems: "flex-end", gap: "14px" }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, border: "1px solid var(--border)", background: "rgba(0,0,0,0.4)" }}>
                    {character.portrait_url ? (
                      <img src={character.portrait_url} alt={character.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>🧙</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "1rem" }}>{character.name}</div>
                    <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{character.race} {character.class} · Lvl {character.level}</div>
                  </div>
                </div>

                {/* HP */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.85rem" }}>
                    <span style={{ color: "#94a3b8" }}>Hit Points</span>
                    <span style={{ fontWeight: "bold", color: hpColor }}>{character.hp} / {character.max_hp}</span>
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
                  {([["STR", character.strength], ["DEX", character.dexterity], ["CON", character.constitution], ["INT", character.intelligence], ["WIS", character.wisdom], ["CHA", character.charisma]] as [string, number][]).map(([label, score]) => {
                    const m = Math.floor((score - 10) / 2);
                    return (
                      <div key={label} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", padding: "10px 4px", borderRadius: "8px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginBottom: "2px" }}>{label}</div>
                        <div style={{ fontWeight: "bold", fontSize: "1rem" }}>{score}</div>
                        <div style={{ fontSize: "0.7rem", color: m >= 0 ? "#22c55e" : "#ef4444" }}>{m >= 0 ? `+${m}` : m}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Spells (spellcasters only) */}
                {SPELLCASTING_CLASSES.has(character.class) && ((character.cantrips_known?.length ?? 0) > 0 || (character.spells_prepared?.length ?? 0) > 0) && (
                  <div>
                    <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "10px", color: "var(--primary)" }}>Spells</h3>
                    {(character.cantrips_known?.length ?? 0) > 0 && (
                      <div style={{ marginBottom: "8px" }}>
                        <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Cantrips</div>
                        {character.cantrips_known!.map((s, i) => (
                          <div key={i} style={{ padding: "5px 10px", background: "rgba(139,92,246,0.08)", borderRadius: "5px", marginBottom: "3px", fontSize: "0.8rem" }}>✦ {s}</div>
                        ))}
                      </div>
                    )}
                    {(character.spells_prepared?.length ?? 0) > 0 && (
                      <div>
                        <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Prepared</div>
                        {character.spells_prepared!.map((s, i) => (
                          <div key={i} style={{ padding: "5px 10px", background: "rgba(139,92,246,0.08)", borderRadius: "5px", marginBottom: "3px", fontSize: "0.8rem" }}>◈ {s}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Inventory with drop buttons */}
                <div>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "10px", color: "var(--primary)" }}>Inventory</h3>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", marginBottom: "6px", fontSize: "0.85rem" }}>
                    <span>Gold</span>
                    <span style={{ color: "#fbbf24", fontWeight: "bold" }}>{character.inventory?.gold ?? 0}gp</span>
                  </div>
                  {character.inventory?.weapons?.map((w, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", marginBottom: "4px", fontSize: "0.82rem" }}>
                      <span>⚔️ {w}</span>
                      <button onClick={() => dropItem(w, "weapon")} title="Drop to party pool"
                        style={{ fontSize: "0.6rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#f59e0b"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; }}>drop</button>
                    </div>
                  ))}
                  {character.inventory?.items?.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", marginBottom: "4px", fontSize: "0.82rem" }}>
                      <span>🎒 {item}</span>
                      <button onClick={() => dropItem(item, "item")} title="Drop to party pool"
                        style={{ fontSize: "0.6rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#f59e0b"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; }}>drop</button>
                    </div>
                  ))}
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

      <style>{`
        @keyframes blink  { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 0.75; } }
      `}</style>
    </main>
  );
}
