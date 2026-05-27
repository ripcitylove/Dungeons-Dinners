"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { CLASS_STAT_GUIDES, getTierStyle } from "../../lib/spellData";
import { computeInventoryBonuses } from "../../lib/lootData";
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
type Tier = "free" | "tavern" | "dm" | "legendary";

const TIER_LABELS: Record<Tier, string> = {
  free: "Free", tavern: "Tavern Patron", dm: "Dungeon Master", legendary: "Legendary Hero",
};
const TIER_COLORS: Record<Tier, string> = {
  free: "#64748b", tavern: "var(--primary)", dm: "var(--secondary)", legendary: "#f59e0b",
};
const CAMPAIGN_LIMITS: Record<Tier, number> = {
  free: 1, tavern: 5, dm: Infinity, legendary: Infinity,
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
  const modalIb       = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
  const modalMaxHp    = char.max_hp + modalIb.hpMaxAdd;
  const hpPct         = Math.max(0, Math.min(100, Math.round((char.hp / Math.max(1, modalMaxHp)) * 100)));
  const hpColor       = hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";
  const inv           = char.inventory;
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: "20px",
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "560px", padding: "32px", position: "relative" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.3rem", lineHeight: 1 }}
        >
          ✕
        </button>

        {/* Hero header */}
        <div style={{ display: "flex", gap: "24px", alignItems: "flex-end", marginBottom: "28px" }}>
          <div style={{ width: "80px", height: "80px", flexShrink: 0, borderRadius: "10px", overflow: "hidden", border: "2px solid var(--border)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {char.portrait_url
              ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: "2.2rem" }}>🧙</span>
            }
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: "1.7rem", fontWeight: "bold", marginBottom: "4px" }}>{char.name}</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "12px" }}>
              {char.race} {char.class} · Level {char.level}
            </p>
            {/* HP bar */}
            <div style={{ fontSize: "0.78rem", display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span style={{ color: "#64748b" }}>Hit Points</span>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ color: hpColor, fontWeight: "bold" }}>{char.hp} / {modalMaxHp}</span>
                {modalIb.hpMaxAdd > 0 && (
                  <span title={`Base max HP: ${char.max_hp} · Item bonus: +${modalIb.hpMaxAdd}`} style={{ fontSize: "0.6rem", color: "#f59e0b", fontWeight: "bold", cursor: "help", background: "rgba(245,158,11,0.15)", borderRadius: "4px", padding: "1px 4px" }}>✦+{modalIb.hpMaxAdd}</span>
                )}
              </div>
            </div>
            <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${hpPct}%`, background: hpColor, borderRadius: "4px", transition: "width 0.4s ease" }} />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Ability scores */}
          <div>
            <div style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Ability Scores</div>
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
                    <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "2px" }}>{label}</div>
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
            <div style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Inventory</div>
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "14px", fontSize: "0.83rem", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🪙</span>
                <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{inv?.gold ?? 0} gold</span>
              </div>
              {(inv?.weapons?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: "0.68rem", color: "#475569", marginBottom: "4px" }}>WEAPONS</div>
                  {inv!.weapons.map((w, i) => (
                    <div key={i} style={{ color: "#e2e8f0", marginBottom: "2px" }}>⚔ {w}</div>
                  ))}
                </div>
              )}
              {(inv?.items?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: "0.68rem", color: "#475569", marginBottom: "4px" }}>ITEMS</div>
                  {inv!.items.map((item, i) => (
                    <div key={i} style={{ color: "#94a3b8", marginBottom: "2px" }}>· {item}</div>
                  ))}
                </div>
              )}
              {!inv && <div style={{ color: "#475569" }}>No inventory data</div>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => onDelete(char.id, char.name)}
            style={{ background: "none", border: "1px solid #ef4444", color: "#ef4444", padding: "7px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem" }}
          >
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
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tier, setTier] = useState<Tier>("free");
  const [userEmail, setUserEmail] = useState("");
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tavernBgUrl, setTavernBgUrl] = useState<string | null>(null);
  const musicStarted = useRef(false);

  // Auto-start tavern music on first user interaction
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

  // Load tavern background (localStorage cache → API → DALL-E)
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

      setUserEmail(user.email ?? "");

      const [charsRes, campsRes, profileRes] = await Promise.all([
        supabase.from("characters")
          .select("id, name, race, class, level, hp, max_hp, strength, dexterity, constitution, intelligence, wisdom, charisma, inventory, portrait_url")
          .eq("user_id", user.id),
        supabase.from("campaigns")
          .select("id, title, description, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("user_profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (charsRes.data) setCharacters(charsRes.data as Character[]);
      if (campsRes.data) setCampaigns(campsRes.data as Campaign[]);
      if (profileRes.data?.subscription_tier) setTier(profileRes.data.subscription_tier as Tier);

      setLoading(false);
    }
    loadDashboard();
  }, [router]);

  const openNewCampaign = () => {
    const limit = CAMPAIGN_LIMITS[tier];
    if (campaigns.length >= limit) {
      alert(tier === "free"
        ? "Free accounts can only have 1 campaign. Upgrade to Tavern Patron for 5, or DM tier for unlimited."
        : `Your ${TIER_LABELS[tier]} plan allows up to ${limit} campaigns. Upgrade for unlimited.`);
      router.push("/pricing");
      return;
    }
    router.push("/create-campaign");
  };

  const deleteCampaign = (id: string, title: string) => {
    setConfirmDelete({ id, title });
  };

  const confirmDeleteCampaign = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    // Remove messages first to avoid FK constraint violations
    await supabase.from("campaign_messages").delete().eq("campaign_id", confirmDelete.id);
    const { data, error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", confirmDelete.id)
      .select();
    setDeleting(false);
    if (error) {
      console.error("[deleteCampaign]", error);
      alert(`Failed to delete campaign: ${error.message}`);
      return;
    }
    // RLS blocked the delete — no rows returned, no error thrown
    if (!data || data.length === 0) {
      alert("Delete was blocked by database permissions. Ask your admin to add a DELETE policy for the campaigns table.");
      return;
    }
    setCampaigns(prev => prev.filter(c => c.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  const deleteCharacter = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("characters").delete().eq("id", id);
    if (error) {
      console.error("[deleteCharacter]", error);
      alert(`Failed to delete character: ${error.message}`);
      return;
    }
    setCharacters(prev => prev.filter(c => c.id !== id));
    setSelectedChar(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        Loading Tavern...
      </div>
    );
  }

  const campaignLimit = CAMPAIGN_LIMITS[tier];
  const atLimit = campaigns.length >= campaignLimit;

  return (
    <main style={{ minHeight: "100vh", padding: "40px", position: "relative" }}>
      {/* Tavern background */}
      {tavernBgUrl && (
        <div style={{ position: "fixed", inset: 0, zIndex: -1, overflow: "hidden" }}>
          <img
            src={tavernBgUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: 0.35 }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(5,3,15,0.6) 0%, rgba(5,3,15,0.5) 60%, rgba(5,3,15,0.8) 100%)" }} />
        </div>
      )}

      {/* Character sheet modal */}
      {selectedChar && (
        <CharacterModal
          char={selectedChar}
          onClose={() => setSelectedChar(null)}
          onDelete={deleteCharacter}
        />
      )}

      {/* Delete campaign confirmation modal */}
      {confirmDelete && (
        <div
          onClick={() => { if (!deleting) setConfirmDelete(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}
        >
          <div
            className="glass-panel animate-fade-in"
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "420px", padding: "32px", textAlign: "center" }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "10px" }}>Delete Campaign?</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "6px" }}>
              <strong style={{ color: "white" }}>&ldquo;{confirmDelete.title}&rdquo;</strong> and all of its messages will be permanently deleted.
            </p>
            <p style={{ color: "#64748b", fontSize: "0.82rem", marginBottom: "28px" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="btn-secondary"
                style={{ padding: "10px 24px", fontSize: "0.9rem" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCampaign}
                disabled={deleting}
                style={{ padding: "10px 24px", fontSize: "0.9rem", borderRadius: "8px", border: "none", background: "#ef4444", color: "white", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1, fontWeight: "bold" }}
              >
                {deleting ? "Deleting…" : "Yes, Delete It"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
          <span style={{ color: "var(--primary)" }}>⬡</span> Tavern Dashboard
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <span style={{
            padding: "4px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold",
            border: `1px solid ${TIER_COLORS[tier]}`, color: TIER_COLORS[tier],
          }}>
            {TIER_LABELS[tier]}
          </span>
          <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>{userEmail}</span>
          {tier === "free" && (
            <Link href="/pricing">
              <button className="btn-primary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>Upgrade ↑</button>
            </Link>
          )}
          <button onClick={signOut} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>Sign Out</button>
        </div>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "32px" }}>
        {/* Campaigns */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            <h2 style={{ fontSize: "1.8rem" }}>Active Campaigns</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              {campaigns.length} / {campaignLimit === Infinity ? "∞" : campaignLimit} used
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {campaigns.length === 0 && (
              <p style={{ color: "#94a3b8" }}>No campaigns yet. Start one below!</p>
            )}

            {campaigns.map((camp) => (
              <div key={camp.id} className="glass-panel animate-fade-in" style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "1.2rem", marginBottom: "6px" }}>{camp.title}</h3>
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "8px" }}>{camp.description}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <code style={{ fontSize: "0.72rem", color: "#475569", background: "rgba(0,0,0,0.3)", padding: "3px 8px", borderRadius: "4px" }}>
                      ID: {camp.id.slice(0, 8)}...
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/campaign/${camp.id}`)}
                      style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}
                    >
                      🔗 Copy invite link
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
                  <Link href={`/campaign/${camp.id}`}>
                    <button className="btn-primary">Resume Session</button>
                  </Link>
                  <button
                    onClick={() => deleteCampaign(camp.id, camp.title)}
                    style={{ background: "none", border: "1px solid #ef4444", color: "#ef4444", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            <div
              className="glass-panel animate-fade-in"
              style={{ padding: "24px", display: "flex", justifyContent: "center", alignItems: "center", borderStyle: "dashed", opacity: atLimit ? 0.6 : 1 }}
            >
              {atLimit ? (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#94a3b8", marginBottom: "12px", fontSize: "0.9rem" }}>
                    Campaign limit reached ({campaigns.length}/{campaignLimit === Infinity ? "∞" : campaignLimit})
                  </p>
                  <Link href="/pricing">
                    <button className="btn-primary" style={{ fontSize: "0.9rem" }}>Upgrade for More →</button>
                  </Link>
                </div>
              ) : (
                <button onClick={openNewCampaign} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.5rem" }}>+</span> Start New Campaign
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Character Roster — only shown when characters exist */}
        {characters.length > 0 && <section>
          <h2 style={{ fontSize: "1.8rem", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            Your Roster
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {characters.map((char) => (
              <div
                key={char.id}
                className="glass-panel animate-fade-in"
                onClick={() => setSelectedChar(char)}
                style={{ padding: "16px", display: "flex", gap: "14px", alignItems: "center", cursor: "pointer", transition: "border-color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "")}
              >
                <div style={{ width: "48px", height: "48px", flexShrink: 0, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {char.portrait_url
                    ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "1.4rem" }}>🧙</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontWeight: "bold" }}>{char.name}</h4>
                  <p style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
                    {char.race} {char.class} · Lvl {char.level}
                  </p>
                  {/* Mini HP bar */}
                  {(() => {
                    const rIb  = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
                    const rMax = Math.max(1, char.max_hp + rIb.hpMaxAdd);
                    const rPct = Math.max(0, Math.min(100, Math.round((char.hp / rMax) * 100)));
                    return (
                      <div style={{ marginTop: "5px", height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.08)", overflow: "hidden", width: "80%" }}>
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
        </section>}
      </div>
    </main>
  );
}
