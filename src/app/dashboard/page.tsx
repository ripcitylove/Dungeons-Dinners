"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { CLASS_STAT_GUIDES, getTierStyle } from "../../lib/spellData";
import { computeInventoryBonuses, getItemByName, RARITY_COLORS, RARITY_LABELS, ITEM_ICONS } from "../../lib/lootData";
import { useTooltip, tipBox, tipBoxNode } from "../../hooks/useTooltip";
import { AdventureGlyph, HeroGlyph } from "../../components/EmptyStateIcons";
import { getTheme, onThemeChange } from "../../lib/theme";
import { D20Icon } from "../../components/D20Icon";
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
  title?: string | null;
  background?: string | null;
};
type Campaign = { id: string; title: string; description: string; created_at: string; isOwned: boolean; status?: string | null };
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
  onUpdate,
}: {
  char: Character;
  onClose: () => void;
  onDelete: (id: string, name: string) => void;
  onUpdate: (id: string, patch: Partial<Character>) => void;
}) {
  const modalIb    = computeInventoryBonuses(char.inventory?.items ?? [], char.inventory?.weapons ?? []);
  const modalMaxHp = char.max_hp + modalIb.hpMaxAdd;
  const hpPct      = Math.max(0, Math.min(100, Math.round((char.hp / Math.max(1, modalMaxHp)) * 100)));
  const hpColor    = hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";
  const inv        = char.inventory;
  const { showTooltip, hideTooltip, TooltipPortal } = useTooltip();
  const [editMode, setEditMode]           = useState(false);
  const [editTitle, setEditTitle]         = useState(char.title ?? "");
  const [editBackground, setEditBackground] = useState(char.background ?? "");
  const [editSaving, setEditSaving]       = useState(false);
  const [regenLoading, setRegenLoading]   = useState(false);
  const [regenPortrait, setRegenPortrait] = useState(char.portrait_url ?? null);

  const handleRegenPortrait = async () => {
    setRegenLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/generate-portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ race: char.race, cls: char.class, sex: char.sex ?? "male", charId: char.id, title: char.title, background: char.background, force: true }),
      });
      const json = await res.json();
      if (json.url) { setRegenPortrait(json.url); onUpdate(char.id, { portrait_url: json.url }); }
    } finally {
      setRegenLoading(false);
    }
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    const patch = { title: editTitle.trim() || null, background: editBackground.trim() || null };
    const { error } = await supabase.from("characters").update(patch).eq("id", char.id);
    setEditSaving(false);
    if (!error) { onUpdate(char.id, patch); setEditMode(false); }
  };

  // One inventory line — rarity-colored name, type icon, and a hover tooltip with
  // description/effects when the item is a known catalog entry.
  const invEntry = (name: string, fallbackIcon: string, key: string) => {
    const meta  = getItemByName(name);
    const color = meta ? RARITY_COLORS[meta.rarity] : "#cbd5e1";
    const icon  = meta ? (ITEM_ICONS[meta.type] ?? fallbackIcon) : fallbackIcon;
    return (
      <div
        key={key}
        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "7px", background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22`, cursor: meta ? "help" : "default" }}
        onMouseEnter={meta ? e => showTooltip(
          <div style={{ background: "#12101f", border: `1px solid ${color}66`, borderRadius: "8px", padding: "10px 13px", fontSize: "1.28rem", color: "#e2e8f0", lineHeight: 1.55, boxShadow: "0 6px 28px rgba(0,0,0,0.85)", minWidth: "190px", maxWidth: "260px" }}>
            <div style={{ fontWeight: 700, color, marginBottom: "3px", fontSize: "1.41rem" }}>{meta!.name}</div>
            <div style={{ color, fontSize: "1.22rem", marginBottom: "5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{RARITY_LABELS[meta!.rarity]} {meta!.type}</div>
            <div style={{ color: "#94a3b8" }}>{meta!.description}</div>
            {meta!.effects.filter(ef => ef.description).map((ef, i) => (
              <div key={i} style={{ color: "#a5b4fc", fontSize: "1.22rem", marginTop: "4px" }}>▸ {ef.description}</div>
            ))}
          </div>, e
        ) : undefined}
        onMouseLeave={meta ? hideTooltip : undefined}
      >
        <span style={{ fontSize: "1.46rem", flexShrink: 0 }}>{icon}</span>
        <span style={{ color, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        {meta && (
          <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: "1.05rem", color, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.04em" }}>{RARITY_LABELS[meta.rarity]}</span>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}
    >
      <div
        className="glass-panel animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "clamp(320px, 90vw, 720px)", maxHeight: "92vh", overflowY: "auto", padding: "clamp(20px, 3vw, 32px)", position: "relative" }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.72rem", lineHeight: 1 }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", marginBottom: "28px" }}>
          {/* Portrait — large and centered */}
          <div style={{ position: "relative", width: "160px", height: "160px", flexShrink: 0 }}>
            <div style={{
              width: "160px", height: "160px", borderRadius: "50%", overflow: "hidden",
              border: `3px solid ${CLASS_COLORS[char.class] ?? "var(--border)"}`,
              boxShadow: `0 0 32px ${CLASS_COLORS[char.class] ?? "#8b5cf6"}44, 0 0 80px ${CLASS_COLORS[char.class] ?? "#8b5cf6"}18`,
              background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {regenPortrait
                ? <img src={regenPortrait} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                : <div style={{ width: "100%", height: "100%", background: `${CLASS_COLORS[char.class] ?? "#6b7280"}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem" }}>🧙</div>
              }
            </div>
            <button
              onClick={handleRegenPortrait}
              disabled={regenLoading}
              title="Regenerate portrait"
              style={{ position: "absolute", bottom: "6px", right: "6px", width: "28px", height: "28px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.75)", color: "white", cursor: regenLoading ? "default" : "pointer", fontSize: "1.46rem", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, opacity: regenLoading ? 0.5 : 0.85, transition: "opacity 0.2s" }}
            >
              {regenLoading ? "…" : "↻"}
            </button>
          </div>
          {/* Name + subtitle */}
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "2.36rem", fontWeight: "bold", marginBottom: "4px", color: CLASS_COLORS[char.class] ?? "white" }}>{char.name}</h2>
            <p style={{ color: "var(--subtle)", fontSize: "1.53rem", marginBottom: "14px" }}>
              {char.race} {char.class} · {char.sex === "female" ? "she/her" : char.sex === "non-binary" ? "they/them" : "he/him"} · Level {char.level}
            </p>
            <div style={{ fontSize: "1.41rem", display: "flex", justifyContent: "space-between", marginBottom: "5px", gap: "12px" }}>
              <span style={{ color: "var(--muted)" }}>Hit Points</span>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ color: hpColor, fontWeight: "bold" }}>{char.hp} / {modalMaxHp}</span>
                {modalIb.hpMaxAdd > 0 && (
                  <span title={`Base: ${char.max_hp} · Item bonus: +${modalIb.hpMaxAdd}`} style={{ fontSize: "1.61rem", color: "#f59e0b", fontWeight: "bold", cursor: "help", background: "rgba(245,158,11,0.15)", borderRadius: "4px", padding: "1px 4px" }}>✦+{modalIb.hpMaxAdd}</span>
                )}
              </div>
            </div>
            <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.07)", overflow: "hidden", minWidth: "280px" }}>
              <div style={{ height: "100%", width: `${hpPct}%`, background: hpColor, borderRadius: "4px", transition: "width 0.4s ease" }} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(18px, 2.5vw, 26px)" }}>
          {/* Ability Scores */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "1.28rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Ability Scores</div>
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
                        <div style={{ background: "#12101f", border: `1px solid ${accent}55`, borderRadius: "8px", padding: "9px 13px", fontSize: "1.28rem", color: "#e2e8f0", lineHeight: 1.55, boxShadow: "0 6px 28px rgba(0,0,0,0.85)", minWidth: "180px", maxWidth: "240px" }}>
                          <div style={{ fontWeight: 700, color: accent, marginBottom: "4px", fontSize: "1.41rem" }}>{st.title}</div>
                          {guide && tierStyle && <div style={{ color: tierStyle.color, fontSize: "1.28rem", marginBottom: "4px", fontWeight: 600 }}>{tierStyle.label} for {char.class}</div>}
                          <div style={{ color: "#94a3b8" }}>{st.body}</div>
                          {guide && <div style={{ color: "#64748b", fontSize: "1.28rem", marginTop: "5px" }}>{guide.reason}</div>}
                        </div>, e
                      );
                    }}
                    onMouseLeave={hideTooltip}
                  >
                    <div style={{ fontSize: "1.61rem", color: "var(--muted)", marginBottom: "2px" }}>{label}</div>
                    <div style={{ fontWeight: "bold", fontSize: "1.53rem" }}>{val}</div>
                    <div style={{ fontSize: "1.28rem", color: m.startsWith("+") ? "#22c55e" : "#ef4444" }}>{m}</div>
                    {tierStyle && (
                      <div style={{ fontSize: "1.46rem", color: tierStyle.color, marginTop: "3px", fontWeight: "bold", letterSpacing: "0.06em" }}>
                        {tierStyle.label.toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inventory */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "1.28rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Inventory</div>
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "14px", fontSize: "1.41rem", display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Currency */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderRadius: "7px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <span style={{ fontSize: "1.53rem" }}>🪙</span>
                <span style={{ color: "#f59e0b", fontWeight: "bold" }}>{(inv?.gold ?? 0).toLocaleString()}</span>
                <span style={{ color: "#f59e0b", opacity: 0.7 }}>gold</span>
              </div>

              {(inv?.weapons?.length ?? 0) > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ fontSize: "1.2rem", color: "var(--muted)", letterSpacing: "0.08em", fontWeight: 600 }}>WEAPONS · {inv!.weapons.length}</div>
                  {inv!.weapons.map((w, i) => invEntry(w, "⚔", `w${i}`))}
                </div>
              )}

              {(inv?.items?.length ?? 0) > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ fontSize: "1.2rem", color: "var(--muted)", letterSpacing: "0.08em", fontWeight: 600 }}>ITEMS · {inv!.items.length}</div>
                  {inv!.items.map((item, i) => invEntry(item, "🎒", `i${i}`))}
                </div>
              )}

              {inv && (inv.weapons?.length ?? 0) === 0 && (inv.items?.length ?? 0) === 0 && (
                <div style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "1.28rem" }}>No weapons or items carried.</div>
              )}
              {!inv && <div style={{ color: "var(--muted)" }}>No inventory data</div>}
            </div>
          </div>
        </div>

        {/* Edit panel */}
        {editMode ? (
          <div style={{ marginTop: "24px", borderTop: "1px solid var(--border)", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "1.28rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>Title / Epithet</label>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder='e.g. "The Unbroken" or "Shadowblade"'
                maxLength={60}
                style={{ width: "100%", background: "rgba(0,0,0,0.35)", border: "1px solid var(--border)", borderRadius: "7px", padding: "8px 12px", color: "var(--text)", fontSize: "1.46rem", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "1.28rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>Backstory</label>
              <textarea
                value={editBackground}
                onChange={e => setEditBackground(e.target.value)}
                placeholder="Where did this hero come from? What drives them forward?"
                rows={5}
                style={{ width: "100%", background: "rgba(0,0,0,0.35)", border: "1px solid var(--border)", borderRadius: "7px", padding: "8px 12px", color: "var(--text)", fontSize: "1.46rem", lineHeight: 1.6, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setEditMode(false)} style={{ padding: "7px 16px", borderRadius: "7px", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer", fontSize: "1.41rem" }}>Cancel</button>
              <button onClick={handleEditSave} disabled={editSaving} className="btn-primary" style={{ padding: "7px 18px", fontSize: "1.41rem", opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {(char.title || char.background) && (
              <div style={{ marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                {char.title && <div style={{ fontSize: "1.41rem", color: "rgba(212,169,106,0.8)", fontStyle: "italic", marginBottom: char.background ? "8px" : 0 }}>&ldquo;{char.title}&rdquo;</div>}
                {char.background && <div style={{ fontSize: "1.41rem", color: "var(--subtle)", lineHeight: 1.7 }}>{char.background}</div>}
              </div>
            )}
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setEditMode(true)} style={{ padding: "7px 14px", borderRadius: "7px", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer", fontSize: "1.41rem", display: "flex", alignItems: "center", gap: "5px" }}>
                ✏️ Edit Title &amp; Backstory
              </button>
              <button onClick={() => onDelete(char.id, char.name)} className="btn-danger">
                Delete Character
              </button>
            </div>
          </>
        )}
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
  // Light / dark theme — owned by the single global settings menu (Tools, top-left).
  // We just read the current value and react to changes; the toggle lives there.
  // SSR-stable default first (avoids the data-theme hydration mismatch), then
  // apply the saved theme on mount so the global toggle flips in one click.
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => { setTheme(getTheme()); return onThemeChange(setTheme); }, []);
  const light = theme === "light";
  const musicStarted = useRef(false);

  // Title-reveal chime — the same sound the in-game "New Objective Discovered!"
  // banner plays. Fired once as the title animates in; if the browser blocks
  // autoplay on a fresh load, it retries on the first interaction so it still lands.
  const titleChimePlayed = useRef(false);
  const playTitleChime = () => {
    if (titleChimePlayed.current) return;
    try {
      const el = new Audio("/sounds/tracker-chime.mp3");
      el.volume = 0.55;
      void el.play().then(() => { titleChimePlayed.current = true; }).catch(() => {});
    } catch { /* ignore */ }
  };
  useEffect(() => { playTitleChime(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start the Legends Theme when the dashboard opens. __dndMusicPlay is a no-op
  // if music is already playing, and only starts when paused — so a few spaced
  // attempts cover the global MusicPlayer mounting slightly after this page. If the
  // browser blocks autoplay before any interaction, the first-touch handler below
  // still kicks it off on the first click.
  useEffect(() => {
    const shots = [120, 700, 1600, 3000].map(ms =>
      setTimeout(() => { try { window.__dndMusicPlay?.(); } catch { /* ignore */ } }, ms));
    return () => shots.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const handleFirstTouch = () => {
      playTitleChime();
      if (musicStarted.current) return;
      musicStarted.current = true;
      window.__dndMusicPlay?.();
      document.removeEventListener("pointerdown", handleFirstTouch);
    };
    document.addEventListener("pointerdown", handleFirstTouch);
    return () => document.removeEventListener("pointerdown", handleFirstTouch);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          .select("id, title, description, created_at, status")
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
          .select("id, title, description, created_at, status")
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

  // Auto-heal missing portraits — if creation-time generation failed (e.g. a
  // transient rate-limit), any roster character without a portrait gets one
  // generated here on the dashboard. Sequential to respect the image API's
  // per-minute cap; the realtime subscription above also catches the DB write.
  const portraitHealedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading) return;
    const missing = characters.filter(c => !c.portrait_url && !portraitHealedRef.current.has(c.id));
    if (missing.length === 0) return;
    missing.forEach(c => portraitHealedRef.current.add(c.id));
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const auth: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      for (const c of missing) {
        if (cancelled) break;
        try {
          const res = await fetch("/api/generate-portrait", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...auth },
            body: JSON.stringify({ race: c.race, cls: c.class, sex: c.sex ?? "male", charId: c.id }),
          });
          const json = await res.json().catch(() => ({} as { url?: string }));
          if (json.url && !cancelled) {
            setCharacters(prev => prev.map(x => x.id === c.id ? { ...x, portrait_url: json.url as string } : x));
          }
        } catch { /* leave it for the next dashboard visit */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, characters]);

  const deleteCampaign = (id: string, title: string) => setConfirmDelete({ id, title });

  // Escape (and Xbox controller B) on the dashboard while the delete-confirm
  // modal is open: dismiss the modal — never delete. The destructive action
  // must require an explicit click on the red Delete button.
  useEffect(() => {
    if (!confirmDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) {
        e.preventDefault();
        setConfirmDelete(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDelete, deleting]);

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
    <main className="dashboard-root" data-theme={theme} style={{ minHeight: "100vh", position: "relative" }}>

      {/* Themed backdrop — a base canvas (dark fantasy / warm parchment) with the
          tavern image and a theme-aware wash on top. Always rendered so the light
          theme reads even before/without a tavern background. */}
      <div style={{ position: "fixed", inset: 0, zIndex: -1, overflow: "hidden", background: "var(--canvas-bg)" }}>
        {tavernBgUrl && (
          <img src={tavernBgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: 0.3 }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: theme === "light"
          ? "linear-gradient(to bottom, rgba(244,238,224,0.86) 0%, rgba(244,238,224,0.78) 60%, rgba(244,238,224,0.93) 100%)"
          : "linear-gradient(to bottom, rgba(5,3,15,0.65) 0%, rgba(5,3,15,0.5) 60%, rgba(5,3,15,0.85) 100%)" }} />
      </div>

      {/* Character sheet modal */}
      {selectedChar && (
        <CharacterModal
          char={selectedChar}
          onClose={() => setSelectedChar(null)}
          onDelete={deleteCharacter}
          onUpdate={(id, patch) => {
            setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
            setSelectedChar(prev => prev?.id === id ? { ...prev, ...patch } : prev);
          }}
        />
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
            <h2 style={{ fontSize: "1.72rem", fontWeight: "bold", marginBottom: "10px" }}>Delete Campaign?</h2>
            <p style={{ color: "var(--subtle)", fontSize: "1.53rem", marginBottom: "6px" }}>
              <strong style={{ color: "white" }}>&ldquo;{confirmDelete.title}&rdquo;</strong> and all its messages will be permanently deleted.
            </p>
            <p style={{ color: "var(--muted)", fontSize: "1.41rem", marginBottom: "28px" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              {/* autoFocus on Cancel: on Xbox controller, B/back collapses onto
                  the focused element. Cancel must be the default so a stray B
                  press dismisses the modal instead of confirming the delete. */}
              <button autoFocus onClick={() => setConfirmDelete(null)} disabled={deleting} className="btn-secondary" style={{ padding: "10px 24px" }}>
                Cancel
              </button>
              <button
                onClick={confirmDeleteCampaign}
                disabled={deleting}
                style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: "#ef4444", color: "white", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1, fontWeight: "bold", fontSize: "1.53rem" }}
              >
                {deleting ? "Deleting…" : "Yes, Delete It"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page wrapper */}
      <div style={{ maxWidth: "1380px", margin: "0 auto", padding: "clamp(20px, 3vw, 36px) clamp(16px, 3vw, 48px) clamp(60px, 6vw, 100px)" }}>

        {/* Nav */}
        <nav className="nav-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          {/* Wordmark moved to the centered logo header below; keep the hex mark
              as the nav's left anchor so the Sign Out cluster stays right-aligned. */}
          <div className="nav-brand" style={{ fontSize: "2.24rem" }}>
            <span className="nav-brand-mark"><D20Icon className="d20-glow" size="1.2em" /></span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div className="nav-pill">
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "1.15rem", flexShrink: 0, color: "white", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(139,92,246,0.4)" }}>
                {userInitials}
              </div>
              <span style={{ color: "var(--subtle)", fontSize: "1.53rem" }}>{displayName}</span>
            </div>
            <button onClick={signOut} className="btn-secondary" style={{ padding: "14px 28px", fontSize: "1.15rem" }}>Sign Out</button>
          </div>
        </nav>

        {/* Centered title header — golden fantasy text that reveals like the in-game
            "New Objective Discovered!" banner (same look + chime), then sparkles. */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "clamp(28px, 4vw, 48px)" }}>
          <div className="dnd-title-reveal" style={{ position: "relative", textAlign: "center", padding: "0 20px", maxWidth: "92vw" }}>
            {/* radial gold glow pool behind the text */}
            <div aria-hidden style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "min(820px, 96vw)", height: "210px", pointerEvents: "none",
              background: "radial-gradient(ellipse at center, rgba(212,175,55,0.20) 0%, rgba(212,175,55,0.07) 40%, transparent 72%)" }} />
            <h1 className="objective-banner-text dnd-title-sheen" style={{ position: "relative", margin: 0, fontFamily: "var(--font-cinzel-decorative), var(--font-cinzel), Georgia, serif", fontWeight: 900, fontSize: "clamp(1.55rem, 4.8vw, 3.4rem)", lineHeight: 1.18, letterSpacing: "0.01em" }}>
              Dungeons &amp; Dinner Legends
            </h1>
            {/* Magical sparkles — a scattered field that twinkles around AND over the
                title, continuously, after it appears. */}
            <div aria-hidden className="dnd-sparkle-layer">
              {[
                { left: "3%",  top: "20%", d: "0.0s",  s: 1.05 },
                { left: "14%", top: "70%", d: "0.9s",  s: 0.7 },
                { left: "22%", top: "8%",  d: "1.6s",  s: 0.85 },
                { left: "33%", top: "88%", d: "0.45s", s: 0.65 },
                { left: "42%", top: "-2%", d: "2.1s",  s: 0.9 },
                { left: "50%", top: "92%", d: "1.2s",  s: 0.75 },
                { left: "58%", top: "2%",  d: "0.3s",  s: 0.8 },
                { left: "67%", top: "84%", d: "1.8s",  s: 0.7 },
                { left: "78%", top: "10%", d: "0.7s",  s: 0.95 },
                { left: "86%", top: "76%", d: "2.4s",  s: 0.8 },
                { left: "96%", top: "26%", d: "1.4s",  s: 1.0 },
              ].map((sp, i) => (
                <span key={i} className="dnd-sparkle" style={{ left: sp.left, top: sp.top, animationDelay: sp.d, ['--sp-scale' as string]: String(sp.s) }}>{i % 2 ? '✧' : '✦'}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Whimsy welcome strip — featured for returning adventurers (the
            first-timer banner below already features the chef pose). Uses a
            static, browser-cached mascot asset; no API call. ── */}
        {!loading && (characters.length > 0 || campaigns.length > 0) && (
          <div className="animate-fade-in" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", flexWrap: "wrap", marginBottom: "clamp(28px, 4vw, 44px)" }}>
            <img
              src="/mascot/dragon-welcome.png"
              alt="Whimsy, the Dungeons & Dinner Legends cooking-dragon mascot"
              draggable={false}
              width={120}
              height={128}
              style={{ flexShrink: 0, width: "clamp(92px, 10vw, 128px)", height: "auto", filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.45))" }}
            />
            <div style={{ position: "relative", background: "var(--card-bg)", border: "1px solid rgba(139,92,246,0.35)", borderRadius: "16px", padding: "16px 22px", maxWidth: "560px", boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8b7bb8", marginBottom: "5px" }}>Whimsy</div>
              <div style={{ color: "var(--text-on-canvas)", fontSize: "clamp(1rem, 1.6vw, 1.2rem)", lineHeight: 1.5 }}>
                Welcome back, <strong style={{ color: "var(--accent-strong)" }}>{displayName}</strong>! Choose a hero below or leap into a campaign — your next adventure awaits.
              </div>
            </div>
          </div>
        )}

        {/* ── First-time welcome banner ── */}
        {!loading && characters.length === 0 && campaigns.length === 0 && (
          <div className="glass-panel animate-fade-in" style={{ position: "relative", overflow: "hidden", marginBottom: "36px", padding: "32px 36px", border: "1px solid rgba(139,92,246,0.35)", background: "rgba(139,92,246,0.07)" }}>
            <p style={{ fontSize: "1.53rem", color: "var(--primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Welcome, Adventurer</p>
            <h2 style={{ fontSize: "2.01rem", fontWeight: 800, marginBottom: "24px", color: "var(--text-on-canvas)" }}>Here&apos;s how to get started in 2 steps:</h2>
            <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", position: "relative" }}>
              {/* Whimsy — the cooking-dragon mascot. Anchored to the steps' TOP edge so
                  his counter line pixel-stacks onto the box, with the pancakes & spoon
                  dipping just inside. (~0.87 of his height is the counter line, so
                  top:-122 on a 140px-tall image lands the line on the box top.) Hidden
                  on narrow screens so he never crowds the steps. */}
              <img
                src="/mascot/dragon-chef.png"
                alt="Whimsy, the Dungeons & Dinner Legends mascot — a friendly cooking dragon"
                draggable={false}
                className="hide-on-narrow"
                style={{ position: "absolute", top: "-122px", right: "clamp(48px, 5vw, 92px)", width: "140px", height: "auto", pointerEvents: "none", userSelect: "none", zIndex: 2, filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.45))" }}
              />
              {[
                { n: "1", Icon: AdventureGlyph, title: "Start a Campaign",   desc: "Hit + Start a Campaign in the Adventures panel. Set how many adventurers are at the table today, then build or import a character for each from your roster." },
                { n: "2", Icon: HeroGlyph,      title: "Create a Character", desc: "Hit + Create a Character in the Heroes panel. Pick your race, class, and roll your ability scores." },
              ].map(({ n, Icon, title, desc }) => (
                <div key={n} style={{ flex: "1 1 220px", background: light ? "rgba(22,18,34,0.9)" : "rgba(0,0,0,0.25)", borderRadius: "12px", padding: "20px 22px", border: light ? "1px solid rgba(80,60,30,0.25)" : "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "1.28rem", fontWeight: 900, color: "var(--primary)", background: "rgba(139,92,246,0.2)", borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
                    <span style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}><Icon size={26} /></span>
                    <span style={{ fontSize: "1.41rem", fontWeight: 700 }}>{title}</span>
                  </div>
                  <p style={{ fontSize: "1.57rem", color: "var(--subtle)", lineHeight: 1.65, margin: 0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "clamp(20px, 3vw, 48px)", alignItems: "start" }}>

          {/* ── Campaigns ── */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "1.61rem", fontWeight: 700, color: "var(--text-on-canvas-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Campaigns</h2>
                <p style={{ fontSize: "2.3rem", fontWeight: 800, lineHeight: 1, color: "var(--text-on-canvas)" }}>Your Adventures</p>
              </div>
              {/* Header CTA only when the list is non-empty — the empty-state card
                  carries its own button, so we don't show two for the same action.
                  Mirrors the Characters section for a symmetric layout. */}
              {campaigns.length > 0 && (
                <button
                  onClick={() => router.push("/create-campaign")}
                  className="btn-cta"
                  style={{ flexShrink: 0 }}
                >
                  <span className="btn-cta-plus">+</span> New Campaign
                </button>
              )}
            </div>

            {campaigns.length === 0 ? (
              <div className="glass-panel" style={{ padding: "56px 40px", textAlign: "center", minHeight: "340px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ marginBottom: "16px", color: "var(--primary)", opacity: 0.45 }}><AdventureGlyph size={54} /></div>
                <h3 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "10px" }}>No campaigns yet</h3>
                <p style={{ color: "var(--subtle)", fontSize: "1.46rem", maxWidth: "360px", margin: "0 auto 28px", lineHeight: 1.6, minHeight: "3.2em", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  Start your first campaign and gather your party at the table.
                </p>
                <button onClick={() => router.push("/create-campaign")} className="btn-cta">
                  <span className="btn-cta-plus">+</span> Start a Campaign
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
                {campaigns.map((camp) => {
                  const members = campaignMembers[camp.id] ?? [];
                  const completed = camp.status === "completed";
                  return (
                    <div
                      key={camp.id}
                      className="glass-panel animate-fade-in"
                      style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "16px", position: "relative" }}
                    >
                      {/* Joined badge */}
                      {!camp.isOwned && (
                        <span style={{ position: "absolute", top: "14px", right: "14px", fontSize: "1.41rem", background: light ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.15)", color: light ? "#4338ca" : "#818cf8", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "20px", padding: "3px 9px", fontWeight: 600, letterSpacing: "0.03em", cursor: "help" }}
                          onMouseEnter={e => showTooltip(tipBox("Joined Campaign", "You are a member of this campaign hosted by another player. You can resume and play your character here.", "#818cf8"), e)}
                          onMouseLeave={hideTooltip}>
                          Joined
                        </span>
                      )}

                      {/* Title + description */}
                      <div style={{ paddingRight: camp.isOwned ? 0 : 64 }}>
                        <h3 style={{ fontSize: "1.72rem", fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span>{camp.title}</span>
                          {completed && (
                            <span style={{ fontSize: "1.05rem", background: "rgba(251,191,36,0.16)", color: "#f59e0b", border: "1px solid rgba(251,191,36,0.45)", borderRadius: "20px", padding: "2px 10px", fontWeight: 700, letterSpacing: "0.08em" }}>✓ COMPLETED</span>
                          )}
                        </h3>
                        <p style={{ color: "var(--subtle)", fontSize: "1.61rem", lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {camp.description}
                        </p>
                      </div>

                      {/* Party member portraits */}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", minHeight: "32px" }}>
                        {members.length === 0 ? (
                          <span style={{ fontSize: "1.53rem", color: "#475569", fontStyle: "italic" }}>No adventurers yet</span>
                        ) : (
                          <>
                            {members.slice(0, 9).map(m => (
                              <div
                                key={m.id}
                                title={`${m.name} (${m.class})`}
                                style={{ width: "34px", height: "34px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${CLASS_COLORS[m.class] ?? "var(--border)"}`, background: "rgba(0,0,0,0.5)", flexShrink: 0 }}
                              >
                                {m.portrait_url
                                  ? <img src={m.portrait_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : <div style={{ width: "100%", height: "100%", background: `${CLASS_COLORS[m.class] ?? "#4b5563"}22` }} />
                                }
                              </div>
                            ))}
                            {members.length > 9 && (
                              <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.61rem", color: "var(--muted)", flexShrink: 0 }}>
                                +{members.length - 9}
                              </div>
                            )}
                            <span style={{ fontSize: "1.46rem", color: "var(--muted)", marginLeft: "6px" }}>
                              {members.length} {members.length === 1 ? "adventurer" : "adventurers"}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "auto" }}>
                        {camp.isOwned && (
                          <button
                            onClick={() => deleteCampaign(camp.id, camp.title)}
                            className="btn-danger"
                            style={{ padding: "8px 16px", fontSize: "1.53rem" }}
                          >
                            Delete
                          </button>
                        )}
                        <Link href={`/campaign/${camp.id}`} style={{ marginLeft: "auto", textDecoration: "none" }}>
                          <button className="btn-primary" style={{ padding: "10px 22px" }}>
                            {completed ? "View" : "Resume"}
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
            {(() => {
              const ROSTER_CAP   = 40;
              const rosterFull   = characters.length >= ROSTER_CAP;
              const rosterClose  = characters.length >= ROSTER_CAP - 5;
              const counterColor = light
                ? (rosterFull ? "#b91c1c" : rosterClose ? "#b45309" : "#5c5345")
                : (rosterFull ? "#f87171" : rosterClose ? "#fbbf24" : "#94a3b8");
              const counterBg    = rosterFull ? (light ? "rgba(239,68,68,0.16)" : "rgba(239,68,68,0.12)") : rosterClose ? (light ? "rgba(251,191,36,0.18)" : "rgba(251,191,36,0.12)") : (light ? "rgba(139,92,246,0.16)" : "rgba(139,92,246,0.10)");
              const counterBd    = rosterFull ? "rgba(239,68,68,0.4)"  : rosterClose ? "rgba(251,191,36,0.4)"  : "rgba(139,92,246,0.3)";
              return (
            <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "1.61rem", fontWeight: 700, color: "var(--text-on-canvas-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span>Characters</span>
                  <span
                    title={rosterFull ? "Roster is full — delete a character to make room." : `Roster cap: ${ROSTER_CAP} characters per account.`}
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      padding: "3px 12px",
                      borderRadius: "999px",
                      background: counterBg,
                      border: `1px solid ${counterBd}`,
                      color: counterColor,
                      letterSpacing: "0.04em",
                      textTransform: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {characters.length} / {ROSTER_CAP}
                  </span>
                </h2>
                <p style={{ fontSize: "2.3rem", fontWeight: 800, lineHeight: 1, color: "var(--text-on-canvas)" }}>Your Heroes</p>
              </div>
              {characters.length > 0 && (
                rosterFull ? (
                  <button
                    className="btn-cta"
                    disabled
                    title="Roster is full (40 / 40). Delete a character to make room."
                    style={{ cursor: "not-allowed", opacity: 0.5 }}
                  >
                    <span className="btn-cta-plus">✕</span> Roster Full
                  </button>
                ) : (
                  <Link href="/create-character" style={{ textDecoration: "none" }}>
                    <button className="btn-cta">
                      <span className="btn-cta-plus">+</span> New Character
                    </button>
                  </Link>
                )
              )}
            </div>

            {/* Cap warning banner — appears when within 5 slots of the cap. */}
            {rosterClose && !rosterFull && characters.length > 0 && (
              <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "8px", background: light ? "rgba(251,191,36,0.16)" : "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", fontSize: "1.41rem", color: light ? "#b45309" : "#fbbf24", lineHeight: 1.6 }}>
                ⚠ You&apos;re nearing the roster cap — {ROSTER_CAP - characters.length} slot{ROSTER_CAP - characters.length === 1 ? "" : "s"} left. Each account holds up to {ROSTER_CAP} heroes.
              </div>
            )}
            {rosterFull && (
              <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "8px", background: light ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.4)", fontSize: "1.41rem", color: light ? "#b91c1c" : "#f87171", lineHeight: 1.6 }}>
                🔒 Roster is full ({ROSTER_CAP} / {ROSTER_CAP}). Delete a character to create a new one.
              </div>
            )}
            </>
              );
            })()}
            {!loading && characters.length > 0 && campaigns.length === 0 && (
              <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "8px", background: light ? "rgba(139,92,246,0.14)" : "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)", fontSize: "1.57rem", color: light ? "#6d28d9" : "#c4b5fd", lineHeight: 1.6 }}>
                💡 Ready to play? Hit <strong>+ Start a Campaign</strong> to start an adventure with your characters.
              </div>
            )}

            {characters.length === 0 ? (
              <div className="glass-panel" style={{ padding: "56px 40px", textAlign: "center", minHeight: "340px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ marginBottom: "16px", color: "var(--primary)", opacity: 0.45 }}><HeroGlyph size={54} /></div>
                <h3 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "10px" }}>No characters yet</h3>
                <p style={{ color: "var(--subtle)", fontSize: "1.46rem", maxWidth: "360px", margin: "0 auto 28px", lineHeight: 1.6, minHeight: "3.2em", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  Create your first hero to start adventuring.
                </p>
                <Link href="/create-character" style={{ textDecoration: "none" }}>
                  <button className="btn-cta"><span className="btn-cta-plus">+</span> Create a Character</button>
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
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
                      style={{ padding: "14px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "10px" }}
                    >
                      {/* Portrait */}
                      <div style={{ width: "100%", aspectRatio: "1", borderRadius: "8px", overflow: "hidden", background: "rgba(0,0,0,0.5)", border: `2px solid ${classColor}33`, position: "relative", flexShrink: 0 }}>
                        {char.portrait_url
                          ? <img src={char.portrait_url} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", background: `${classColor}10` }} />
                        }
                        <div style={{ position: "absolute", bottom: "5px", right: "5px", background: "rgba(0,0,0,0.75)", borderRadius: "4px", padding: "2px 6px", fontSize: "1.28rem", fontWeight: "bold", color: "#f59e0b", lineHeight: 1.3, cursor: "help" }}
                          onMouseEnter={e => { e.stopPropagation(); showTooltip(tipBox(MECHANIC_TIPS.LEVEL.title, MECHANIC_TIPS.LEVEL.body, "#f59e0b"), e); }}
                          onMouseLeave={e => { e.stopPropagation(); hideTooltip(); }}>
                          Lv {char.level}
                        </div>
                      </div>

                      {/* Name */}
                      <div style={{ fontWeight: "bold", color: classColor, fontSize: "1.46rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                        {char.name}
                      </div>

                      {/* Race / Class */}
                      <div
                        style={{ fontSize: "1.61rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        onMouseEnter={e => {
                          e.stopPropagation();
                          const rt = RACE_TIPS[char.race];
                          const ct = CLASS_TIPS[char.class];
                          if (!rt && !ct) return;
                          const clsColor = CLASS_COLORS[char.class] ?? "#c4b5fd";
                          showTooltip(tipBoxNode(rt ? rt.title : (ct?.title ?? ""), <>
                            {rt && <div style={{ color: "#94a3b8", marginBottom: ct ? "8px" : 0, paddingBottom: ct ? "6px" : 0, borderBottom: ct ? "1px solid rgba(255,255,255,0.08)" : "none" }}>{rt.body}</div>}
                            {ct && <>
                              <div style={{ fontWeight: 700, color: clsColor, marginBottom: "2px" }}>{ct.title}</div>
                              <div style={{ color: "#64748b", fontSize: "0.9em", marginBottom: "3px" }}>Hit Die: {ct.hitDie} · Primary: {ct.primaryStat}</div>
                              <div style={{ color: "#94a3b8" }}>{ct.body}</div>
                            </>}
                          </>, "#c4b5fd"), e);
                        }}
                        onMouseLeave={hideTooltip}
                      >
                        {char.race} {char.class}
                      </div>

                      {/* HP bar */}
                      <div style={{ height: "5px", borderRadius: "2px", background: "rgba(255,255,255,0.07)" }}>
                        <div style={{ height: "100%", width: `${rPct}%`, background: hpColor, borderRadius: "2px", transition: "width 0.3s" }} />
                      </div>
                    </div>
                  );
                })}

                {/* Create new character card — replaced by a locked tile at the cap. */}
                {characters.length >= 40 ? (
                  <div
                    title="Roster is full (40 / 40). Delete a character to make room."
                    className="glass-panel animate-fade-in"
                    style={{ padding: "14px", cursor: "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", aspectRatio: "1", borderStyle: "dashed", borderColor: "rgba(239,68,68,0.3)", gap: "8px", opacity: 0.6 }}
                  >
                    <span style={{ fontSize: "2.36rem", color: "#f87171", opacity: 0.7, lineHeight: 1 }}>🔒</span>
                    <span style={{ fontSize: "1.46rem", color: "#f87171", fontWeight: "bold", opacity: 0.85, textAlign: "center", lineHeight: 1.25 }}>Roster Full<br/><span style={{ fontSize: "1.15rem", fontWeight: 500, opacity: 0.75 }}>40 / 40</span></span>
                  </div>
                ) : (
                  <Link href="/create-character" style={{ textDecoration: "none" }}>
                    <div
                      className="glass-panel animate-fade-in"
                      style={{ padding: "14px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", aspectRatio: "1", borderStyle: "dashed", borderColor: "rgba(139,92,246,0.3)", gap: "8px" }}
                    >
                      <span style={{ fontSize: "2.36rem", color: "var(--primary)", opacity: 0.6, lineHeight: 1 }}>+</span>
                      <span style={{ fontSize: "1.46rem", color: "var(--primary)", fontWeight: "bold", opacity: 0.8, textAlign: "center" }}>New Character</span>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </section>

        </div>
      </div>
      {TooltipPortal}
    </main>
  );
}
