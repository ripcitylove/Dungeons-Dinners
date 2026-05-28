"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { CLASS_STAT_GUIDES, getTierStyle } from "../../lib/spellData";
import { computeInventoryBonuses } from "../../lib/lootData";
import { ALLOWED_EMAIL } from "../../lib/allowedUsers";
import "../globals.css";

type Inventory = { gold: number; weapons: string[]; items: string[] };
type Character = {
  id: string; name: string; race: string; class: string; level: number;
  hp: number; max_hp: number;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  inventory: Inventory | null;
  portrait_url?: string | null;
};
type Campaign = { id: string; title: string; description: string; created_at: string };
type CampaignMember = { id: string; name: string; race: string; class: string; level: number; portrait_url?: string | null; campaign_id: string };

const CLASS_COLORS: Record<string, string> = {
  Fighter:   "#ef4444",
  Wizard:    "#3b82f6",
  Rogue:     "#94a3b8",
  Cleric:    "#f59e0b",
  Paladin:   "#fbbf24",
  Ranger:    "#22c55e",
  Bard:      "#ec4899",
  Warlock:   "#8b5cf6",
  Barbarian: "#f97316",
  Druid:     "#65a30d",
  Monk:      "#06b6d4",
  Sorcerer:  "#a855f7",
};

const ABILITY_LABELS = [
  ["STR", "strength"], ["DEX", "dexterity"], ["CON", "constitution"],
  ["INT", "intelligence"], ["WIS", "wisdom"], ["CHA", "charisma"],
] as const;

function mod(score: number) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

// ── Character Sheet Modal ────────────────────────────────────────────────────

function CharacterModal({
  char,
  onClose,
  onDelete,
}: {
  char: Character;
  onClose: () => void;
  onDelete: (id: string, name: string) => void;
}) {
  const modalIb    = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
  const modalMaxHp = char.max_hp + modalIb.hpMaxAdd;
  const hpPct      = Math.max(0, Math.min(100, Math.round((char.hp / Math.max(1, modalMaxHp)) * 100)));
  const hpColor    = hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";
  const inv        = char.inventory;
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}
    >
      <div
        className="glass-panel animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "560px", padding: "32px", position: "relative" }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.3rem", lineHeight: 1 }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ display: "flex", gap: "24px", alignItems: "flex-end", marginBottom: "28px" }}>
          <div style={{ width: "80px", height: "80px", flexShrink: 0, borderRadius: "10px", overflow: "hidden", border: "2px solid var(--border)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {char.portrait_url
              ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: "2.2rem" }}>🧙</span>
            }
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: "1.7rem", fontWeight: "bold", marginBottom: "4px", color: CLASS_COLORS[char.class] ?? "white" }}>{char.name}</h2>
            <p style={{ color: "var(--subtle)", fontSize: "0.9rem", marginBottom: "12px" }}>
              {char.race} {char.class} · Level {char.level}
            </p>
            <div style={{ fontSize: "0.78rem", display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span style={{ color: "var(--muted)" }}>Hit Points</span>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ color: hpColor, fontWeight: "bold" }}>{char.hp} / {modalMaxHp}</span>
                {modalIb.hpMaxAdd > 0 && (
                  <span title={`Base: ${char.max_hp} · Item bonus: +${modalIb.hpMaxAdd}`} style={{ fontSize: "0.6rem", color: "#f59e0b", fontWeight: "bold", cursor: "help", background: "rgba(245,158,11,0.15)", borderRadius: "4px", padding: "1px 4px" }}>✦+{modalIb.hpMaxAdd}</span>
                )}
              </div>
            </div>
            <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${hpPct}%`, background: hpColor, borderRadius: "4px", transition: "width 0.4s ease" }} />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Ability Scores */}
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Ability Scores</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              {ABILITY_LABELS.map(([label, key]) => {
                const val = char[key];
                const m = mod(val);
                const guide = CLASS_STAT_GUIDES[char.class]?.[label];
                const tierStyle = guide ? getTierStyle(guide.tier) : null;
                return (
                  <div
                    key={label}
                    style={{ position: "relative", background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "8px 4px", textAlign: "center", border: `1px solid ${tierStyle ? tierStyle.color + "55" : "transparent"}`, cursor: "default", transition: "border-color 0.2s" }}
                    onMouseEnter={() => setHoveredStat(label)}
                    onMouseLeave={() => setHoveredStat(null)}
                  >
                    <div style={{ fontSize: "0.62rem", color: "var(--muted)", marginBottom: "2px" }}>{label}</div>
                    <div style={{ fontWeight: "bold", fontSize: "1.15rem" }}>{val}</div>
                    <div style={{ fontSize: "0.68rem", color: m.startsWith("+") ? "#22c55e" : "#ef4444" }}>{m}</div>
                    {tierStyle && (
                      <div style={{ fontSize: "0.5rem", color: tierStyle.color, marginTop: "3px", fontWeight: "bold", letterSpacing: "0.06em" }}>
                        {tierStyle.label.toUpperCase()}
                      </div>
                    )}
                    {hoveredStat === label && guide && tierStyle && (
                      <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "#1a1730", border: `1px solid ${tierStyle.color}66`, borderRadius: "7px", padding: "9px 11px", zIndex: 500, width: "160px", pointerEvents: "none", fontSize: "0.7rem", color: "#e2e8f0", lineHeight: 1.45, textAlign: "left", boxShadow: "0 4px 16px rgba(0,0,0,0.6)" }}>
                        <div style={{ fontWeight: "bold", color: tierStyle.color, marginBottom: "4px", fontSize: "0.72rem" }}>{tierStyle.label} Stat</div>
                        {guide.reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inventory */}
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Inventory</div>
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "14px", fontSize: "0.83rem", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🪙</span>
                <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{inv?.gold ?? 0} gold</span>
              </div>
              {(inv?.weapons?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: "0.68rem", color: "#475569", marginBottom: "4px" }}>WEAPONS</div>
                  {inv!.weapons.map((w, i) => <div key={i} style={{ color: "#e2e8f0", marginBottom: "2px" }}>⚔ {w}</div>)}
                </div>
              )}
              {(inv?.items?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: "0.68rem", color: "#475569", marginBottom: "4px" }}>ITEMS</div>
                  {inv!.items.map((item, i) => <div key={i} style={{ color: "var(--subtle)", marginBottom: "2px" }}>· {item}</div>)}
                </div>
              )}
              {!inv && <div style={{ color: "var(--muted)" }}>No inventory data</div>}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => onDelete(char.id, char.name)} className="btn-danger">
            Delete Character
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading]               = useState(true);
  const [userId, setUserId]                 = useState<string | null>(null);
  const [characters, setCharacters]         = useState<Character[]>([]);
  const [campaigns, setCampaigns]           = useState<Campaign[]>([]);
  const [userEmail, setUserEmail]           = useState("");
  const [selectedChar, setSelectedChar]     = useState<Character | null>(null);
  const [campaignMembers, setCampaignMembers] = useState<Record<string, CampaignMember[]>>({});
  const [confirmDelete, setConfirmDelete]   = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [tavernBgUrl, setTavernBgUrl]       = useState<string | null>(null);
  const musicStarted = useRef(false);

  useEffect(() => {
    const handleFirstTouch = () => {
      if (musicStarted.current) return;
      musicStarted.current = true;
      window.__dndMusicPlay?.();
      document.removeEventListener("pointerdown", handleFirstTouch);
    };
    document.addEventListener("pointerdown", handleFirstTouch);
    return () => document.removeEventListener("pointerdown", handleFirstTouch);
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem("dnd_tavern_bg");
    if (cached) { setTavernBgUrl(cached); return; }
    fetch("/api/tavern-bg")
      .then(r => r.json())
      .then(({ imageUrl }: { imageUrl: string | null }) => {
        if (imageUrl) {
          setTavernBgUrl(imageUrl);
          localStorage.setItem("dnd_tavern_bg", imageUrl);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }

      if (user.email !== ALLOWED_EMAIL) {
        await supabase.auth.signOut();
        router.push("/auth");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const [charsRes, campsRes] = await Promise.all([
        supabase.from("characters")
          .select("id, name, race, class, level, hp, max_hp, strength, dexterity, constitution, intelligence, wisdom, charisma, inventory, portrait_url")
          .eq("user_id", user.id),
        supabase.from("campaigns")
          .select("id, title, description, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (charsRes.data) setCharacters(charsRes.data as Character[]);
      if (campsRes.data) setCampaigns(campsRes.data as Campaign[]);

      if (campsRes.data && campsRes.data.length > 0) {
        const campIds = campsRes.data.map(c => c.id);
        const { data: membersData } = await supabase
          .from("characters")
          .select("id, name, race, class, level, portrait_url, campaign_id")
          .in("campaign_id", campIds);
        if (membersData) {
          const grouped = (membersData as CampaignMember[]).reduce<Record<string, CampaignMember[]>>((acc, char) => {
            (acc[char.campaign_id] ??= []).push(char);
            return acc;
          }, {});
          setCampaignMembers(grouped);
        }
      }

      setLoading(false);
    }
    loadDashboard();
  }, [router]);

  // Real-time portrait updates
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("portrait-updates")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "characters",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as { id: string; portrait_url?: string | null };
        if (!updated.portrait_url) return;
        setCharacters(prev => prev.map(c => c.id === updated.id ? { ...c, portrait_url: updated.portrait_url } : c));
        setSelectedChar(prev => prev?.id === updated.id ? { ...prev, portrait_url: updated.portrait_url } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const deleteCampaign = (id: string, title: string) => setConfirmDelete({ id, title });

  const confirmDeleteCampaign = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    await supabase.from("campaign_messages").delete().eq("campaign_id", confirmDelete.id);
    const { data, error } = await supabase
      .from("campaigns").delete().eq("id", confirmDelete.id).select();
    setDeleting(false);
    if (error) { alert(`Failed to delete campaign: ${error.message}`); return; }
    if (!data || data.length === 0) {
      alert("Delete was blocked by database permissions.");
      return;
    }
    setCampaigns(prev => prev.filter(c => c.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  const deleteCharacter = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("characters").delete().eq("id", id);
    if (error) { alert(`Failed to delete character: ${error.message}`); return; }
    setCharacters(prev => prev.filter(c => c.id !== id));
    setSelectedChar(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "40px", position: "relative" }}>

      {/* Tavern background */}
      {tavernBgUrl && (
        <div style={{ position: "fixed", inset: 0, zIndex: -1, overflow: "hidden" }}>
          <img src={tavernBgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: 0.3 }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(5,3,15,0.65) 0%, rgba(5,3,15,0.5) 60%, rgba(5,3,15,0.85) 100%)" }} />
        </div>
      )}

      {/* Character sheet modal */}
      {selectedChar && (
        <CharacterModal char={selectedChar} onClose={() => setSelectedChar(null)} onDelete={deleteCharacter} />
      )}

      {/* Delete campaign confirmation */}
      {confirmDelete && (
        <div
          onClick={() => { if (!deleting) setConfirmDelete(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}
        >
          <div
            className="glass-panel animate-fade-in"
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "420px", padding: "36px", textAlign: "center" }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "10px" }}>Delete Campaign?</h2>
            <p style={{ color: "var(--subtle)", fontSize: "0.9rem", marginBottom: "6px" }}>
              <strong style={{ color: "white" }}>&ldquo;{confirmDelete.title}&rdquo;</strong> and all its messages will be permanently deleted.
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: "28px" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="btn-secondary" style={{ padding: "10px 24px" }}>
                Cancel
              </button>
              <button
                onClick={confirmDeleteCampaign}
                disabled={deleting}
                style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: "#ef4444", color: "white", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1, fontWeight: "bold", fontSize: "0.9rem" }}
              >
                {deleting ? "Deleting…" : "Yes, Delete It"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "48px" }}>
        <div style={{ fontSize: "1.5rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: "var(--primary)" }}>⬡</span> D&amp;D Legends
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>{userEmail}</span>
          <button onClick={signOut} className="btn-secondary" style={{ padding: "8px 18px", fontSize: "0.875rem" }}>Sign Out</button>
        </div>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: characters.length > 0 ? "2fr 1fr" : "1fr", gap: "32px", maxWidth: "1200px" }}>

        {/* Campaigns */}
        <section>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
            Active Campaigns
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {campaigns.length === 0 && (
              <p style={{ color: "var(--subtle)" }}>No campaigns yet — start one below!</p>
            )}

            {campaigns.map((camp) => {
              const members = campaignMembers[camp.id] ?? [];
              return (
                <div key={camp.id} className="glass-panel animate-fade-in" style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px" }}>
                  {/* Title + description */}
                  <div style={{ minWidth: "180px", maxWidth: "200px" }}>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "6px" }}>{camp.title}</h3>
                    <p style={{ color: "var(--subtle)", fontSize: "0.82rem", marginBottom: "10px", lineHeight: 1.5 }}>{camp.description}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <code style={{ fontSize: "0.7rem", color: "#475569", background: "rgba(0,0,0,0.3)", padding: "3px 8px", borderRadius: "4px" }}>
                        {camp.id.slice(0, 8)}…
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/campaign/${camp.id}`)}
                        style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.78rem", padding: 0 }}
                      >
                        🔗 Copy invite
                      </button>
                    </div>
                  </div>

                  {/* Party roster */}
                  <div style={{ flex: 1, borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)", padding: "0 20px", alignSelf: "stretch", display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px" }}>
                    <p style={{ fontSize: "0.65rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                      Party · {members.length} {members.length === 1 ? "adventurer" : "adventurers"}
                    </p>
                    {members.length === 0 ? (
                      <p style={{ color: "#334155", fontSize: "0.82rem", fontStyle: "italic" }}>No players yet — share the invite link!</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                        {members.slice(0, 5).map(m => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "32px", height: "32px", flexShrink: 0, borderRadius: "6px", overflow: "hidden", border: `1px solid ${CLASS_COLORS[m.class] ?? "var(--border)"}44`, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {m.portrait_url
                                ? <img src={m.portrait_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <span style={{ fontSize: "0.9rem" }}>🧙</span>
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: "0.82rem", fontWeight: "bold", color: CLASS_COLORS[m.class] ?? "white", lineHeight: 1.2 }}>{m.name}</div>
                              <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{m.race} {m.class} · Lvl {m.level}</div>
                            </div>
                          </div>
                        ))}
                        {members.length > 5 && (
                          <p style={{ fontSize: "0.72rem", color: "#475569" }}>+{members.length - 5} more…</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
                    <Link href={`/campaign/${camp.id}`}>
                      <button className="btn-primary">Resume Session</button>
                    </Link>
                    <button onClick={() => deleteCampaign(camp.id, camp.title)} className="btn-danger">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {/* New campaign */}
            <div
              className="glass-panel animate-fade-in"
              style={{ padding: "24px", display: "flex", justifyContent: "center", alignItems: "center", borderStyle: "dashed" }}
            >
              <button
                onClick={() => router.push("/create-campaign")}
                className="btn-secondary"
                style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem" }}
              >
                <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>+</span> Start New Campaign
              </button>
            </div>
          </div>
        </section>

        {/* Character Roster */}
        {characters.length > 0 && (
          <section>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
              Your Roster
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="glass-panel glass-panel-hover animate-fade-in"
                  onClick={() => setSelectedChar(char)}
                  style={{ padding: "16px", display: "flex", gap: "14px", alignItems: "center", cursor: "pointer" }}
                >
                  <div style={{ width: "48px", height: "48px", flexShrink: 0, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {char.portrait_url
                      ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: "1.4rem" }}>🧙</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontWeight: "bold", color: CLASS_COLORS[char.class] ?? "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{char.name}</h4>
                    <p style={{ color: "var(--subtle)", fontSize: "0.78rem" }}>
                      {char.race} {char.class} · Lvl {char.level}
                    </p>
                    {(() => {
                      const ib   = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
                      const rMax = Math.max(1, char.max_hp + ib.hpMaxAdd);
                      const rPct = Math.max(0, Math.min(100, Math.round((char.hp / rMax) * 100)));
                      return (
                        <div style={{ marginTop: "5px", height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.07)", overflow: "hidden", width: "80%" }}>
                          <div style={{ height: "100%", width: `${rPct}%`, background: rPct > 50 ? "#22c55e" : rPct > 25 ? "#f59e0b" : "#ef4444", borderRadius: "2px" }} />
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteCharacter(char.id, char.name); }}
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "1rem", padding: "4px", lineHeight: 1, flexShrink: 0 }}
                    title="Delete character"
                  >
                    🗑
                  </button>
                </div>
              ))}

              <Link href="/create-character" style={{ textDecoration: "none" }}>
                <div className="glass-panel animate-fade-in" style={{ padding: "16px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", borderStyle: "dashed" }}>
                  <span style={{ color: "var(--primary)", fontWeight: "bold" }}>+ Create New Character</span>
                </div>
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
