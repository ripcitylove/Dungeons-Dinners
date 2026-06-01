"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { CLASS_STAT_GUIDES, getTierStyle } from "../../lib/spellData";
import { computeInventoryBonuses } from "../../lib/lootData";
import { useTooltip, tipBox } from "../../hooks/useTooltip";
import { STAT_TIPS, RACE_TIPS, CLASS_TIPS, MECHANIC_TIPS } from "../../lib/tooltipData";
import "../globals.css";

type Inventory = { gold: number; weapons: string[]; items: string[] };
type Character = {
  id: string; name: string; race: string; class: string; level: number;
  hp: number; max_hp: number; sex?: string;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  inventory: Inventory | null;
  portrait_url?: string | null;
  campaign_id?: string | null;
};
type Campaign = { id: string; title: string; description: string; created_at: string; isOwned: boolean };
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
  const { showTooltip, hideTooltip, TooltipPortal } = useTooltip();

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", marginBottom: "28px" }}>
          {/* Portrait — large and centered */}
          <div style={{
            width: "160px", height: "160px", flexShrink: 0, borderRadius: "50%", overflow: "hidden",
            border: `3px solid ${CLASS_COLORS[char.class] ?? "var(--border)"}`,
            boxShadow: `0 0 32px ${CLASS_COLORS[char.class] ?? "#8b5cf6"}44, 0 0 80px ${CLASS_COLORS[char.class] ?? "#8b5cf6"}18`,
            background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {char.portrait_url
              ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
              : <div style={{ width: "100%", height: "100%", background: `${CLASS_COLORS[char.class] ?? "#6b7280"}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem" }}>🧙</div>
            }
          </div>
          {/* Name + subtitle */}
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "1.8rem", fontWeight: "bold", marginBottom: "4px", color: CLASS_COLORS[char.class] ?? "white" }}>{char.name}</h2>
            <p style={{ color: "var(--subtle)", fontSize: "0.9rem", marginBottom: "14px" }}>
              {char.race} {char.class} · {char.sex === "female" ? "she/her" : char.sex === "non-binary" ? "they/them" : "he/him"} · Level {char.level}
            </p>
            <div style={{ fontSize: "0.78rem", display: "flex", justifyContent: "space-between", marginBottom: "5px", gap: "12px" }}>
              <span style={{ color: "var(--muted)" }}>Hit Points</span>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ color: hpColor, fontWeight: "bold" }}>{char.hp} / {modalMaxHp}</span>
                {modalIb.hpMaxAdd > 0 && (
                  <span title={`Base: ${char.max_hp} · Item bonus: +${modalIb.hpMaxAdd}`} style={{ fontSize: "0.6rem", color: "#f59e0b", fontWeight: "bold", cursor: "help", background: "rgba(245,158,11,0.15)", borderRadius: "4px", padding: "1px 4px" }}>✦+{modalIb.hpMaxAdd}</span>
                )}
              </div>
            </div>
            <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.07)", overflow: "hidden", minWidth: "280px" }}>
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
                    style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "8px 4px", textAlign: "center", border: `1px solid ${tierStyle ? tierStyle.color + "55" : "transparent"}`, cursor: "default", transition: "border-color 0.2s" }}
                    onMouseEnter={e => {
                      const st = STAT_TIPS[label];
                      if (!st) return;
                      const accent = tierStyle ? tierStyle.color : "#8b5cf6";
                      showTooltip(
                        <div style={{ background: "#12101f", border: `1px solid ${accent}55`, borderRadius: "8px", padding: "9px 13px", fontSize: "0.76rem", color: "#e2e8f0", lineHeight: 1.55, boxShadow: "0 6px 28px rgba(0,0,0,0.85)", minWidth: "180px", maxWidth: "240px" }}>
                          <div style={{ fontWeight: 700, color: accent, marginBottom: "4px", fontSize: "0.8rem" }}>{st.title}</div>
                          {guide && tierStyle && <div style={{ color: tierStyle.color, fontSize: "0.7rem", marginBottom: "4px", fontWeight: 600 }}>{tierStyle.label} for {char.class}</div>}
                          <div style={{ color: "#94a3b8" }}>{st.body}</div>
                          {guide && <div style={{ color: "#64748b", fontSize: "0.7rem", marginTop: "5px" }}>{guide.reason}</div>}
                        </div>, e
                      );
                    }}
                    onMouseLeave={hideTooltip}
                  >
                    <div style={{ fontSize: "0.62rem", color: "var(--muted)", marginBottom: "2px" }}>{label}</div>
                    <div style={{ fontWeight: "bold", fontSize: "1.15rem" }}>{val}</div>
                    <div style={{ fontSize: "0.68rem", color: m.startsWith("+") ? "#22c55e" : "#ef4444" }}>{m}</div>
                    {tierStyle && (
                      <div style={{ fontSize: "0.5rem", color: tierStyle.color, marginTop: "3px", fontWeight: "bold", letterSpacing: "0.06em" }}>
                        {tierStyle.label.toUpperCase()}
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
      {TooltipPortal}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { showTooltip, hideTooltip, TooltipPortal } = useTooltip();
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
  const [copiedId, setCopiedId]             = useState<string | null>(null);
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        await supabase.auth.signOut();
        router.push("/auth");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const [charsRes, campsRes] = await Promise.all([
        supabase.from("characters")
          .select("id, name, race, class, level, hp, max_hp, sex, strength, dexterity, constitution, intelligence, wisdom, charisma, inventory, portrait_url, campaign_id")
          .eq("user_id", user.id),
        supabase.from("campaigns")
          .select("id, title, description, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (charsRes.data) setCharacters(charsRes.data as Character[]);

      const ownedIds = new Set((campsRes.data ?? []).map(c => c.id));
      const joinedIds = [...new Set(
        (charsRes.data ?? [])
          .filter(c => c.campaign_id && !ownedIds.has(c.campaign_id))
          .map(c => c.campaign_id as string)
      )];

      let allCamps: Campaign[] = (campsRes.data ?? []).map(c => ({ ...c, isOwned: true }));

      if (joinedIds.length > 0) {
        const { data: joinedData } = await supabase
          .from("campaigns")
          .select("id, title, description, created_at")
          .in("id", joinedIds);
        if (joinedData) {
          allCamps = [...allCamps, ...joinedData.map(c => ({ ...c, isOwned: false }))];
        }
      }

      setCampaigns(allCamps);

      if (allCamps.length > 0) {
        const campIds = allCamps.map(c => c.id);
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

  const copyInvite = (campId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/campaign/${campId}`);
    setCopiedId(campId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const userInitials = userEmail
    ? userEmail.split("@")[0].slice(0, 2).toUpperCase()
    : "?";
  const displayName = userEmail.split("@")[0];

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <main style={{ minHeight: "100vh", position: "relative" }}>

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

      {/* Page wrapper */}
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "28px 36px 80px" }}>

        {/* Nav */}
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "44px" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "var(--primary)" }}>⬡</span>
            <span>Dungeons &amp; Dinner Legends</span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.04)", borderRadius: "40px", padding: "6px 16px 6px 6px", border: "1px solid var(--border)" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "0.75rem", flexShrink: 0, color: "white" }}>
                {userInitials}
              </div>
              <span style={{ color: "var(--subtle)", fontSize: "0.82rem" }}>{displayName}</span>
            </div>
            <button onClick={signOut} className="btn-secondary" style={{ padding: "8px 18px", fontSize: "0.875rem" }}>Sign Out</button>
          </div>
        </nav>

        {/* ── First-time welcome banner ── */}
        {!loading && characters.length === 0 && campaigns.length === 0 && (
          <div className="glass-panel animate-fade-in" style={{ marginBottom: "32px", padding: "28px 32px", border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.07)" }}>
            <p style={{ fontSize: "0.72rem", color: "var(--primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Welcome, Adventurer</p>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "20px" }}>Here&apos;s how to get started in 3 steps:</h2>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {[
                { n: "1", icon: "⚒️", title: "Create a Character", desc: "Head to the Roster section on the right and hit Create a Character. Pick your race, class, and roll your ability scores." },
                { n: "2", icon: "🗺️", title: "Start a Campaign",   desc: "Click + New Campaign. Set how many players are starting today, then build or import characters from your roster." },
                { n: "3", icon: "🔗", title: "Invite Your Party",   desc: "Once inside your campaign, hit the Invite button to copy a link. Send it to friends — they join instantly." },
              ].map(({ n, icon, title, desc }) => (
                <div key={n} style={{ flex: "1 1 200px", background: "rgba(0,0,0,0.25)", borderRadius: "10px", padding: "16px 18px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.62rem", fontWeight: 900, color: "var(--primary)", background: "rgba(139,92,246,0.2)", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
                    <span style={{ fontSize: "1rem" }}>{icon}</span>
                    <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{title}</span>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--subtle)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "36px", alignItems: "start" }}>

          {/* ── Campaigns ── */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Campaigns</h2>
                <p style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>Your Adventures</p>
              </div>
              <button
                onClick={() => router.push("/create-campaign")}
                className="btn-primary"
                style={{ padding: "9px 18px", fontSize: "0.85rem", flexShrink: 0 }}
              >
                + New Campaign
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="glass-panel" style={{ padding: "56px 40px", textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "16px", opacity: 0.35, lineHeight: 1 }}>⚔</div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "8px" }}>No campaigns yet</h3>
                <p style={{ color: "var(--subtle)", fontSize: "0.88rem", marginBottom: "28px", maxWidth: "340px", margin: "0 auto 28px", lineHeight: 1.6 }}>
                  Start your first campaign or join one with a friend&apos;s invite link.
                </p>
                <button onClick={() => router.push("/create-campaign")} className="btn-primary">
                  Start a Campaign
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                {campaigns.map((camp) => {
                  const members = campaignMembers[camp.id] ?? [];
                  return (
                    <div
                      key={camp.id}
                      className="glass-panel animate-fade-in"
                      style={{ padding: "22px", display: "flex", flexDirection: "column", gap: "14px", position: "relative" }}
                    >
                      {/* Joined badge */}
                      {!camp.isOwned && (
                        <span style={{ position: "absolute", top: "14px", right: "14px", fontSize: "0.65rem", background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "20px", padding: "3px 9px", fontWeight: 600, letterSpacing: "0.03em", cursor: "help" }}
                          onMouseEnter={e => showTooltip(tipBox("Joined Campaign", "You are a member of this campaign hosted by another player. You can resume and play your character here.", "#818cf8"), e)}
                          onMouseLeave={hideTooltip}>
                          Joined
                        </span>
                      )}

                      {/* Title + description */}
                      <div style={{ paddingRight: camp.isOwned ? 0 : 64 }}>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>{camp.title}</h3>
                        <p style={{ color: "var(--subtle)", fontSize: "0.82rem", lineHeight: 1.55, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {camp.description}
                        </p>
                      </div>

                      {/* Party member portraits */}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", minHeight: "32px" }}>
                        {members.length === 0 ? (
                          <span style={{ fontSize: "0.78rem", color: "#475569", fontStyle: "italic" }}>No adventurers yet</span>
                        ) : (
                          <>
                            {members.slice(0, 9).map(m => (
                              <div
                                key={m.id}
                                title={`${m.name} (${m.class})`}
                                style={{ width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${CLASS_COLORS[m.class] ?? "var(--border)"}`, background: "rgba(0,0,0,0.5)", flexShrink: 0 }}
                              >
                                {m.portrait_url
                                  ? <img src={m.portrait_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : <div style={{ width: "100%", height: "100%", background: `${CLASS_COLORS[m.class] ?? "#4b5563"}22` }} />
                                }
                              </div>
                            ))}
                            {members.length > 9 && (
                              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "var(--muted)", flexShrink: 0 }}>
                                +{members.length - 9}
                              </div>
                            )}
                            <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginLeft: "6px" }}>
                              {members.length} {members.length === 1 ? "adventurer" : "adventurers"}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "auto" }}>
                        <button
                          onClick={() => copyInvite(camp.id)}
                          onMouseEnter={e => showTooltip(tipBox("🔗 Invite Link", "Copies a link to your clipboard. Share it so another player can join this campaign with their account.", "#818cf8"), e)}
                          onMouseLeave={hideTooltip}
                          style={{ background: "none", border: "1px solid var(--border)", borderRadius: "6px", color: copiedId === camp.id ? "#22c55e" : "var(--subtle)", cursor: "pointer", fontSize: "0.78rem", padding: "6px 12px", transition: "all 0.2s", flexShrink: 0 }}
                        >
                          {copiedId === camp.id ? "Copied!" : "🔗 Invite"}
                        </button>
                        {camp.isOwned && (
                          <button
                            onClick={() => deleteCampaign(camp.id, camp.title)}
                            className="btn-danger"
                            style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                          >
                            Delete
                          </button>
                        )}
                        <Link href={`/campaign/${camp.id}`} style={{ marginLeft: "auto", textDecoration: "none" }}>
                          <button className="btn-primary" style={{ padding: "8px 18px", fontSize: "0.85rem" }}>
                            Resume
                          </button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Roster ── */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Characters</h2>
                <p style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>Your Heroes</p>
              </div>
              {characters.length > 0 && (
                <Link href="/create-character" style={{ textDecoration: "none" }}>
                  <button className="btn-secondary" style={{ padding: "7px 14px", fontSize: "0.78rem" }}>+ New Character</button>
                </Link>
              )}
            </div>
            {!loading && characters.length > 0 && campaigns.length === 0 && (
              <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "8px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)", fontSize: "0.78rem", color: "#c4b5fd", lineHeight: 1.6 }}>
                💡 Ready to play? Hit <strong>+ New Campaign</strong> to start an adventure with your characters.
              </div>
            )}

            {characters.length === 0 ? (
              <div className="glass-panel" style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "12px", opacity: 0.35, lineHeight: 1 }}>🧙‍♂️</div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "8px" }}>No characters yet</h3>
                <p style={{ color: "var(--subtle)", fontSize: "0.82rem", marginBottom: "20px", lineHeight: 1.6 }}>
                  Create your first hero to start adventuring.
                </p>
                <Link href="/create-character" style={{ textDecoration: "none" }}>
                  <button className="btn-primary" style={{ fontSize: "0.85rem" }}>Create a Character</button>
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
                {characters.map((char) => {
                  const ib = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
                  const rMax = Math.max(1, char.max_hp + ib.hpMaxAdd);
                  const rPct = Math.max(0, Math.min(100, Math.round((char.hp / rMax) * 100)));
                  const hpColor = rPct > 50 ? "#22c55e" : rPct > 25 ? "#f59e0b" : "#ef4444";
                  const classColor = CLASS_COLORS[char.class] ?? "#94a3b8";
                  return (
                    <div
                      key={char.id}
                      className="glass-panel glass-panel-hover animate-fade-in"
                      onClick={() => setSelectedChar(char)}
                      style={{ padding: "10px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "7px" }}
                    >
                      {/* Portrait */}
                      <div style={{ width: "100%", aspectRatio: "1", borderRadius: "8px", overflow: "hidden", background: "rgba(0,0,0,0.5)", border: `2px solid ${classColor}33`, position: "relative", flexShrink: 0 }}>
                        {char.portrait_url
                          ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", background: `${classColor}10` }} />
                        }
                        <div style={{ position: "absolute", bottom: "5px", right: "5px", background: "rgba(0,0,0,0.75)", borderRadius: "4px", padding: "2px 6px", fontSize: "0.62rem", fontWeight: "bold", color: "#f59e0b", lineHeight: 1.3, cursor: "help" }}
                          onMouseEnter={e => { e.stopPropagation(); showTooltip(tipBox(MECHANIC_TIPS.LEVEL.title, MECHANIC_TIPS.LEVEL.body, "#f59e0b"), e); }}
                          onMouseLeave={e => { e.stopPropagation(); hideTooltip(); }}>
                          Lv {char.level}
                        </div>
                      </div>

                      {/* Name */}
                      <div style={{ fontWeight: "bold", color: classColor, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                        {char.name}
                      </div>

                      {/* Race / Class */}
                      <div
                        style={{ fontSize: "0.68rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        onMouseEnter={e => {
                          e.stopPropagation();
                          const rt = RACE_TIPS[char.race];
                          const ct = CLASS_TIPS[char.class];
                          if (!rt && !ct) return;
                          showTooltip(
                            <div style={{ background: "#12101f", border: "1px solid #8b5cf655", borderRadius: "8px", padding: "9px 13px", fontSize: "0.76rem", color: "#e2e8f0", lineHeight: 1.55, boxShadow: "0 6px 28px rgba(0,0,0,0.85)", minWidth: "180px", maxWidth: "240px" }}>
                              {rt && <>
                                <div style={{ fontWeight: 700, color: "#c4b5fd", marginBottom: "3px", fontSize: "0.8rem" }}>{rt.title}</div>
                                <div style={{ color: "#94a3b8", marginBottom: ct ? "8px" : 0 }}>{rt.body}</div>
                              </>}
                              {ct && <>
                                <div style={{ fontWeight: 700, color: CLASS_COLORS[char.class] ?? "#c4b5fd", marginBottom: "3px", fontSize: "0.8rem" }}>{ct.title}</div>
                                <div style={{ color: "#64748b", fontSize: "0.68rem", marginBottom: "3px" }}>Hit Die: {ct.hitDie} · Primary: {ct.primaryStat}</div>
                                <div style={{ color: "#94a3b8" }}>{ct.body}</div>
                              </>}
                            </div>, e
                          );
                        }}
                        onMouseLeave={hideTooltip}
                      >
                        {char.race} {char.class}
                      </div>

                      {/* HP bar */}
                      <div style={{ height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.07)" }}>
                        <div style={{ height: "100%", width: `${rPct}%`, background: hpColor, borderRadius: "2px", transition: "width 0.3s" }} />
                      </div>
                    </div>
                  );
                })}

                {/* Create new character card */}
                <Link href="/create-character" style={{ textDecoration: "none" }}>
                  <div
                    className="glass-panel animate-fade-in"
                    style={{ padding: "10px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", aspectRatio: "1", borderStyle: "dashed", borderColor: "rgba(139,92,246,0.3)", gap: "6px" }}
                  >
                    <span style={{ fontSize: "1.4rem", color: "var(--primary)", opacity: 0.6, lineHeight: 1 }}>+</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--primary)", fontWeight: "bold", opacity: 0.8, textAlign: "center" }}>New Character</span>
                  </div>
                </Link>
              </div>
            )}
          </section>

        </div>
      </div>
      {TooltipPortal}
    </main>
  );
}
