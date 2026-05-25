"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { PixelCharacter } from "../../../components/PixelCharacter";
import "../../globals.css";
import DiceRoller from "../../../components/DiceRoller";
import type { StateChange } from "../../api/chat-state/route";

type MsgRole = "dm" | "player" | "system";
type Message = { role: MsgRole; content: string; sender?: string };
type LogEntry = { id: string; timestamp: Date; role: MsgRole; sender?: string; content: string };

type Character = {
  id: string; name: string; race: string; class: string; level: number;
  hp: number; max_hp: number;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  background?: string;
  inventory: { gold: number; weapons: string[]; items: string[] };
};

type PresencePlayer = {
  userId: string; characterName: string; characterClass: string; hp: number; maxHp: number;
};

const OPENING_MESSAGES: Message[] = [
  { role: "system",  content: "Welcome, adventurer. The torchlight flickers as your journey begins..." },
  { role: "dm",      content: '"Ah, brave adventurer. I have a task for you — if you possess the courage," the hooded figure rasps, leaning forward from the shadows of a corner booth.' },
];

// ── Export helper ────────────────────────────────────────────────────────────

function exportLog(entries: LogEntry[], campaignId: string) {
  const header = [
    "# Campaign Adventure Log",
    `Campaign: ${campaignId}`,
    `Exported: ${new Date().toLocaleString()}`,
    "",
    "---",
    "",
  ].join("\n");

  const body = entries.map((e) => {
    const time = e.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const who = e.role === "dm"     ? "Dungeon Master"
               : e.role === "system" ? "Narrator"
               : (e.sender ?? "Player");
    return `**[${time}] ${who}**\n${e.content}`;
  }).join("\n\n");

  const blob = new Blob([header + body], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `adventure-log-${campaignId.slice(0, 8)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CampaignSession(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);

  const [messages,        setMessages]        = useState<Message[]>(OPENING_MESSAGES);
  const [logEntries,      setLogEntries]       = useState<LogEntry[]>([]);
  const [suggestions,     setSuggestions]      = useState<string[]>([]);
  const [streamingContent,setStreamingContent] = useState("");
  const [input,           setInput]            = useState("");
  const [isTyping,        setIsTyping]         = useState(false);
  const [showDice,        setShowDice]         = useState(false);
  const [character,       setCharacter]        = useState<Character | null>(null);
  const [stateNotice,     setStateNotice]      = useState<string | null>(null);
  const [players,         setPlayers]          = useState<PresencePlayer[]>([]);
  const [userId,          setUserId]           = useState<string | null>(null);
  const [linkCopied,      setLinkCopied]       = useState(false);
  const [sidebarTab,      setSidebarTab]       = useState<"sheet" | "log">("sheet");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logEndRef      = useRef<HTMLDivElement>(null);
  const abortRef       = useRef<AbortController | null>(null);
  const characterRef   = useRef<Character | null>(null);
  const channelRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef      = useRef<string | null>(null);

  useEffect(() => { characterRef.current = character; }, [character]);
  useEffect(() => { userIdRef.current   = userId;    }, [userId]);

  // ── Load user, character, and message history ──────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [charRes, historyRes] = await Promise.all([
        supabase.from("characters").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("campaign_messages").select("role, content, sender, created_at").eq("campaign_id", params.id).order("created_at", { ascending: true }),
      ]);

      if (charRes.data?.[0]) setCharacter(charRes.data[0] as Character);

      if (historyRes.data && historyRes.data.length > 0) {
        const hist = historyRes.data as (Message & { created_at?: string })[];
        setMessages([...OPENING_MESSAGES, ...hist]);
        setLogEntries(hist.map((m, i) => ({
          id:        `hist-${i}`,
          timestamp: m.created_at ? new Date(m.created_at) : new Date(),
          role:      m.role,
          sender:    m.sender,
          content:   m.content,
        })));
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // ── Supabase Realtime ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !character) return;

    const channel = supabase.channel(`campaign:${params.id}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setPlayers(Object.values(channel.presenceState<PresencePlayer>()).flat());
      })
      .on("broadcast", { event: "player_action" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        setMessages(prev => [...prev, { role: "player", content: payload.content, sender: payload.characterName }]);
        setLogEntries(prev => [...prev, { id: `rt-${Date.now()}`, timestamp: new Date(), role: "player", sender: payload.characterName, content: payload.content }]);
      })
      .on("broadcast", { event: "dm_response" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        setIsTyping(false);
        setStreamingContent("");
        setMessages(prev => [...prev, { role: "dm", content: payload.content }]);
        setLogEntries(prev => [...prev, { id: `rt-${Date.now()}`, timestamp: new Date(), role: "dm", content: payload.content }]);
      })
      .on("broadcast", { event: "dm_typing" }, ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        setIsTyping(payload.typing as boolean);
        if (!payload.typing) setStreamingContent("");
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, characterName: character.name, characterClass: character.class, hp: character.hp, maxHp: character.max_hp });
        }
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, character?.id, params.id]);

  useEffect(() => {
    if (!channelRef.current || !character || !userId) return;
    channelRef.current.track({ userId, characterName: character.name, characterClass: character.class, hp: character.hp, maxHp: character.max_hp });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.hp]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingContent]);
  useEffect(() => { if (sidebarTab === "log") logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logEntries, sidebarTab]);

  // ── Apply character state changes ───────────────────────────────────────────
  const applyStateChange = useCallback(async (change: StateChange) => {
    const char = characterRef.current;
    if (!char) return;
    const hasChange = change.hp_delta !== 0 || change.gold_delta !== 0 || change.items_gained.length > 0 || change.items_lost.length > 0 || change.weapons_gained.length > 0;
    if (!hasChange) return;

    const newHp      = Math.max(0, Math.min(char.max_hp, char.hp + change.hp_delta));
    const newGold    = Math.max(0, (char.inventory?.gold ?? 0) + change.gold_delta);
    const newItems   = [...(char.inventory?.items ?? []).filter(i => !change.items_lost.includes(i)), ...change.items_gained];
    const newWeapons = [...(char.inventory?.weapons ?? []), ...change.weapons_gained];

    const updatedChar: Character = { ...char, hp: newHp, inventory: { gold: newGold, items: newItems, weapons: newWeapons } };
    setCharacter(updatedChar);

    await supabase.from("characters").update({ hp: newHp, inventory: updatedChar.inventory }).eq("id", char.id);

    const parts: string[] = [];
    if (change.hp_delta    < 0) parts.push(`${Math.abs(change.hp_delta)} damage taken`);
    if (change.hp_delta    > 0) parts.push(`+${change.hp_delta} HP restored`);
    if (change.gold_delta  > 0) parts.push(`+${change.gold_delta}gp`);
    if (change.gold_delta  < 0) parts.push(`${change.gold_delta}gp`);
    change.items_gained.forEach(i  => parts.push(`+${i}`));
    change.weapons_gained.forEach(w => parts.push(`+${w}`));

    if (parts.length) {
      const notice = parts.join(" · ");
      setStateNotice(notice);
      setTimeout(() => setStateNotice(null), 4000);
      // Log the state change as a system entry
      setLogEntries(prev => [...prev, { id: `state-${Date.now()}`, timestamp: new Date(), role: "system", content: `⚡ ${notice}` }]);
    }
  }, []);

  // ── AI call ─────────────────────────────────────────────────────────────────
  const sendToAI = async (allMessages: Message[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsTyping(true);
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
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamingContent(full);
      }

      setMessages(prev => [...prev, { role: "dm", content: full }]);
      setLogEntries(prev => [...prev, { id: `dm-${Date.now()}`, timestamp: new Date(), role: "dm", content: full }]);

      // Persist to DB
      const lastPlayerMsg = allMessages[allMessages.length - 1];
      supabase.from("campaign_messages").insert([
        { campaign_id: params.id, role: lastPlayerMsg.role, content: lastPlayerMsg.content, sender: lastPlayerMsg.sender ?? null },
        { campaign_id: params.id, role: "dm", content: full, sender: null },
      ]).then(({ error }) => { if (error) console.error("[campaign] save:", error); });

      // Broadcast to party
      channelRef.current?.send({ type: "broadcast", event: "dm_response", payload: { senderId: userId, content: full } });

      // State changes (non-blocking)
      fetch("/api/chat-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narrative: full }) })
        .then(r => r.json()).then((change: StateChange) => applyStateChange(change)).catch(() => {});

      // Suggested actions (non-blocking, fires after streaming)
      fetch("/api/suggest-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dmResponse: full, character: characterRef.current }) })
        .then(r => r.json()).then(({ suggestions }) => setSuggestions(suggestions ?? [])).catch(() => {});

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages(prev => [...prev, { role: "dm", content: "The DM seems to be indisposed. Please try again." }]);
    } finally {
      setIsTyping(false);
      setStreamingContent("");
      channelRef.current?.send({ type: "broadcast", event: "dm_typing", payload: { senderId: userId, typing: false } });
    }
  };

  // ── Player sends ────────────────────────────────────────────────────────────
  const handleSend = async (actionText?: string) => {
    const text = (actionText ?? input).trim();
    if (!text || isTyping) return;
    if (!actionText) setInput("");
    setSuggestions([]);

    const playerMsg: Message = { role: "player", content: text, sender: character?.name ?? "You" };
    const updated = [...messages, playerMsg];
    setMessages(updated);
    setLogEntries(prev => [...prev, { id: `player-${Date.now()}`, timestamp: new Date(), role: "player", sender: playerMsg.sender, content: text }]);

    channelRef.current?.send({ type: "broadcast", event: "player_action", payload: { senderId: userId, content: text, characterName: character?.name } });

    await sendToAI(updated);
  };

  const handleDiceResult = (result: number) => { setShowDice(false); handleSend(`[Rolled a ${result} on a d20]`); };
  const copyInviteLink   = () => { navigator.clipboard.writeText(window.location.href); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };

  const hpPercent = character ? Math.max(0, (character.hp / character.max_hp) * 100) : 0;
  const hpColor   = hpPercent > 60 ? "#22c55e" : hpPercent > 25 ? "#f59e0b" : "#ef4444";
  const otherPlayers = players.filter(p => p.userId !== userId);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "row", overflow: "hidden" }}>
      {showDice && <DiceRoller onRollComplete={handleDiceResult} />}

      {/* ── Pane 1: Visual scene ── */}
      <div style={{ flex: 1, position: "relative", borderRight: "1px solid var(--border)", overflow: "hidden" }}>
        <Image src="/hero_bg.png" alt="Current Scene" fill style={{ objectFit: "cover", opacity: 0.75 }} priority />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "40px 24px 28px", background: "linear-gradient(transparent, rgba(0,0,0,0.92))" }}>
          <h2 style={{ fontSize: "1.8rem", fontWeight: "bold", textShadow: "0 2px 10px black", marginBottom: "6px" }}>The Broken Cask Tavern</h2>
          <p style={{ color: "#cbd5e1", textShadow: "0 1px 5px black", fontSize: "0.9rem" }}>Dimly lit, smelling of stale ale and woodsmoke. A hooded figure awaits.</p>
        </div>
      </div>

      {/* ── Pane 2: Chat ── */}
      <div style={{ flex: "0 0 520px", display: "flex", flexDirection: "column", background: "var(--background)", borderRight: "1px solid var(--border)" }}>
        {/* Header */}
        <header className="glass-panel" style={{ margin: "16px", padding: "12px 16px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <Link href="/dashboard" style={{ flexShrink: 0, color: "#94a3b8", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>← Tavern</Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Curse of the Shadow King</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.7rem", marginTop: "1px" }}>DM: Claude Opus · {players.length + 1} in party</p>
          </div>
          <button onClick={copyInviteLink} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.78rem", flexShrink: 0 }} title="Copy invite link">
            {linkCopied ? "✓ Copied!" : "🔗 Invite"}
          </button>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {messages.map((msg, idx) => (
            <div key={idx} className="animate-fade-in" style={{ alignSelf: msg.role === "player" ? "flex-end" : "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", alignItems: msg.role === "player" ? "flex-end" : "flex-start" }}>
              {msg.role === "player" && <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "3px" }}>{msg.sender ?? "You"}</span>}
              {msg.role === "dm"     && <span style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "3px", fontWeight: "bold" }}>Dungeon Master</span>}
              <div style={{
                padding: "11px 15px", borderRadius: "12px", fontSize: "0.9rem", lineHeight: 1.55, whiteSpace: "pre-wrap",
                background: msg.role === "dm" ? "rgba(139,92,246,0.15)" : msg.role === "system" ? "transparent" : "var(--card-bg)",
                border:     msg.role === "dm" ? "1px solid rgba(139,92,246,0.3)" : msg.role === "system" ? "none" : "1px solid var(--border)",
                fontStyle: msg.role === "system" ? "italic" : "normal",
                color:     msg.role === "system" ? "#94a3b8" : "white",
                textAlign: msg.role === "system" ? "center" : "left",
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Streaming DM response */}
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
        {suggestions.length > 0 && !isTyping && (
          <div style={{ padding: "8px 16px 4px", display: "flex", gap: "6px", flexWrap: "wrap", borderTop: "1px solid rgba(139,92,246,0.2)" }}>
            <span style={{ fontSize: "0.68rem", color: "#64748b", alignSelf: "center", flexShrink: 0 }}>Suggest:</span>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                style={{ padding: "4px 10px", borderRadius: "14px", fontSize: "0.76rem", border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.08)", color: "#c4b5fd", cursor: "pointer", transition: "background 0.15s, border-color 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.22)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.08)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.35)"; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--border)", background: "var(--card-bg)" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn-secondary" onClick={() => setShowDice(true)} disabled={isTyping} style={{ padding: "0 14px", fontSize: "1.2rem", flexShrink: 0 }} title="Roll Dice">🎲</button>
            <input
              type="text"
              value={input}
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

      {/* ── Pane 3: Sidebar (Character Sheet / Story Log) ── */}
      <div style={{ flex: "0 0 300px", background: "var(--card-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Tab toggle */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {(["sheet", "log"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              style={{
                flex: 1, padding: "12px 8px", fontSize: "0.75rem", fontWeight: "bold",
                background: sidebarTab === tab ? "rgba(139,92,246,0.15)" : "transparent",
                borderTop: "none", borderLeft: "none", borderRight: "none",
                borderBottom: sidebarTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
                color: sidebarTab === tab ? "var(--primary)" : "#64748b",
                cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.07em", transition: "all 0.15s",
              }}
            >
              {tab === "sheet" ? "Character" : "Story Log"}
            </button>
          ))}
        </div>

        {/* ── Character Sheet tab ── */}
        {sidebarTab === "sheet" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {/* Party members */}
            {otherPlayers.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#94a3b8", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Party ({otherPlayers.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {otherPlayers.map(p => {
                    const pct   = Math.max(0, (p.hp / p.maxHp) * 100);
                    const color = pct > 60 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={p.userId} style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <div>
                            <div style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{p.characterName}</div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{p.characterClass}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                            <span style={{ fontSize: "0.75rem", color, fontWeight: "bold" }}>{p.hp}/{p.maxHp}</span>
                          </div>
                        </div>
                        <div style={{ width: "100%", height: "4px", background: "#3f3f46", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)" }} />
              </div>
            )}

            {/* State change notice */}
            {stateNotice && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "8px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", fontSize: "0.8rem", color: "#34d399", textAlign: "center" }}>
                ⚡ {stateNotice}
              </div>
            )}

            {/* Character sheet */}
            <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>Character Sheet</h2>

            {character ? (
              <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Identity with pixel sprite */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: "14px" }}>
                  <div style={{ height: "56px", display: "flex", alignItems: "flex-end", flexShrink: 0 }}>
                    <PixelCharacter race={character.race} cls={character.class} size={3} />
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

                {/* Inventory */}
                <div>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "10px", color: "var(--primary)" }}>Inventory</h3>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", marginBottom: "6px", fontSize: "0.85rem" }}>
                    <span>Gold</span>
                    <span style={{ color: "#fbbf24", fontWeight: "bold" }}>{character.inventory?.gold ?? 0}gp</span>
                  </div>
                  {character.inventory?.weapons?.map((w, i) => (
                    <div key={i} style={{ padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", marginBottom: "4px", fontSize: "0.82rem" }}>⚔️ {w}</div>
                  ))}
                  {character.inventory?.items?.map((item, i) => (
                    <div key={i} style={{ padding: "6px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", marginBottom: "4px", fontSize: "0.82rem" }}>🎒 {item}</div>
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
            {/* Log header + export */}
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{logEntries.length} entries</span>
              <button
                onClick={() => exportLog(logEntries, params.id)}
                disabled={logEntries.length === 0}
                style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "0.75rem", border: "1px solid var(--border)", background: "transparent", color: logEntries.length === 0 ? "#475569" : "#94a3b8", cursor: logEntries.length === 0 ? "default" : "pointer", transition: "color 0.15s, border-color 0.15s" }}
                onMouseEnter={e => { if (logEntries.length > 0) { e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "var(--primary)"; }}}
                onMouseLeave={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                ↓ Export .md
              </button>
            </div>

            {/* Log entries */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {logEntries.length === 0 && (
                <p style={{ color: "#475569", fontSize: "0.85rem", textAlign: "center", marginTop: "40px" }}>No events yet. Start adventuring!</p>
              )}
              {logEntries.map(entry => {
                const time = entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const isDM     = entry.role === "dm";
                const isPlayer = entry.role === "player";
                const isSystem = entry.role === "system";
                return (
                  <div
                    key={entry.id}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      borderLeft: `3px solid ${isDM ? "#8b5cf6" : isPlayer ? "#0ea5e9" : "#475569"}`,
                      background: isDM ? "rgba(139,92,246,0.08)" : isPlayer ? "rgba(14,165,233,0.08)" : "rgba(0,0,0,0.2)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: "bold", color: isDM ? "#a78bfa" : isPlayer ? "#38bdf8" : "#64748b" }}>
                        {isDM ? "DM" : isSystem ? "System" : (entry.sender ?? "Player")}
                      </span>
                      <span style={{ fontSize: "0.65rem", color: "#475569" }}>{time}</span>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: isSystem ? "#94a3b8" : "#cbd5e1", lineHeight: 1.45, margin: 0 }}>
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
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </main>
  );
}
