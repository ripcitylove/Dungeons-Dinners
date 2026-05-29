"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import "../globals.css";
import {
  CANTRIPS, LEVEL1_SPELLS, SPELL_LIMITS, SPELLCASTING_CLASSES,
  getSpellCounts, CLASS_STAT_GUIDES, getTierStyle, type SpellEntry,
} from "../../lib/spellData";

// ── Types ──────────────────────────────────────────────────────────────────────
type AbilityScores = {
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
};
type CharDraft = {
  name: string; race: string; sex: string; class: string;
  weapon: string; trinket: string;
  scores: AbilityScores;
  cantrips: string[]; spells: string[];
  rosterId?: string;
  rosterLevel?: number;
  rosterMaxHp?: number;
};
type RosterChar = {
  id: string; name: string; race: string; class: string; sex: string;
  level: number; max_hp: number; hp: number;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  inventory: { gold: number; weapons: string[]; items: string[] };
  cantrips_known: string[]; spells_prepared: string[];
  campaign_id: string | null;
  portrait_url?: string | null;
};
type Phase = "count" | "characters" | "review" | "creating";

// ── Constants ──────────────────────────────────────────────────────────────────
const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
};
const WEAPONS = ["Longsword", "Shortbow", "Staff", "Daggers (x2)", "Warhammer", "Crossbow"];
const DEFAULT_SCORES: AbilityScores = {
  strength: 15, dexterity: 14, constitution: 13,
  intelligence: 12, wisdom: 10, charisma: 8,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function roll4d6DropLowest(): number {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => a - b);
  return rolls.slice(1).reduce((a, b) => a + b, 0);
}
function rollAll(): AbilityScores {
  return {
    strength: roll4d6DropLowest(), dexterity: roll4d6DropLowest(),
    constitution: roll4d6DropLowest(), intelligence: roll4d6DropLowest(),
    wisdom: roll4d6DropLowest(), charisma: roll4d6DropLowest(),
  };
}
function startingHP(cls: string, con: number): number {
  return Math.max(1, (CLASS_HIT_DIE[cls] ?? 8) + Math.floor((con - 10) / 2));
}
function emptyDraft(): CharDraft {
  return { name: "", race: "", sex: "male", class: "", weapon: "", trinket: "", scores: DEFAULT_SCORES, cantrips: [], spells: [] };
}

// ── SpellCard ──────────────────────────────────────────────────────────────────
const SCHOOL_COLORS: Record<string, string> = {
  Abjuration: "#3b82f6", Conjuration: "#8b5cf6", Divination: "#e879f9",
  Enchantment: "#f59e0b", Evocation: "#ef4444", Illusion: "#06b6d4",
  Necromancy: "#22c55e", Transmutation: "#f97316",
};
function SpellCard({ spell, selected, disabled, onToggle }: {
  spell: SpellEntry; selected: boolean; disabled: boolean; onToggle: () => void;
}) {
  const color = SCHOOL_COLORS[spell.school] ?? "#94a3b8";
  return (
    <div onClick={() => !disabled && onToggle()} style={{
      padding: "10px 12px", borderRadius: "8px",
      border: `1px solid ${selected ? color : "var(--border)"}`,
      background: selected ? `${color}18` : "rgba(0,0,0,0.2)",
      cursor: disabled && !selected ? "not-allowed" : "pointer",
      opacity: disabled && !selected ? 0.45 : 1, transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: "bold", color: selected ? color : "white" }}>{spell.name}</span>
        {selected && <span style={{ fontSize: "0.65rem", color, flexShrink: 0 }}>✓</span>}
      </div>
      <div style={{ fontSize: "0.62rem", color, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{spell.school}</div>
      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "4px", lineHeight: 1.35 }}>{spell.desc}</div>
    </div>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────
export default function CreateCampaignWizard() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("count");
  const [playerCount, setPlayerCount] = useState(1);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [charStep, setCharStep] = useState(1);
  const [draft, setDraft] = useState<CharDraft>(emptyDraft());
  const [scores, setScores] = useState<AbilityScores>(DEFAULT_SCORES);
  const [rolling, setRolling] = useState(false);
  const [selectedCantrips, setSelectedCantrips] = useState<string[]>([]);
  const [selectedSpells, setSelectedSpells] = useState<string[]>([]);
  const [charNameErr, setCharNameErr] = useState("");
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [completedChars, setCompletedChars] = useState<CharDraft[]>([]);
  const [rosterChars, setRosterChars] = useState<RosterChar[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  const isSpellcaster     = SPELLCASTING_CLASSES.has(draft.class);
  const totalCharSteps    = isSpellcaster ? 5 : 4;
  const spellCounts       = getSpellCounts(draft.class, scores);
  const availableCantrips = CANTRIPS[draft.class] ?? [];
  const availableSpells   = LEVEL1_SPELLS[draft.class] ?? [];

  // Characters already picked from roster (to prevent double-picking)
  const alreadyPickedIds = new Set(completedChars.filter(c => c.rosterId).map(c => c.rosterId!));
  const availableRoster  = (rosterChars ?? []).filter(c => !alreadyPickedIds.has(c.id));

  // ── Helpers ──
  const resetCurrentChar = () => {
    setDraft(emptyDraft());
    setScores(DEFAULT_SCORES);
    setSelectedCantrips([]);
    setSelectedSpells([]);
    setCharStep(1);
    setCharNameErr("");
  };

  const handleClassChange = (cls: string) => {
    setDraft(d => ({ ...d, class: cls }));
    setSelectedCantrips([]);
    setSelectedSpells([]);
  };

  const loadRoster = async () => {
    if (rosterChars !== null) return;
    setRosterLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("characters")
        .select("id,name,race,class,sex,level,max_hp,hp,strength,dexterity,constitution,intelligence,wisdom,charisma,inventory,cantrips_known,spells_prepared,campaign_id,portrait_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRosterChars((data as RosterChar[]) ?? []);
    } finally {
      setRosterLoading(false);
    }
  };

  // ── Finalize new character and advance ──
  const finalizeAndAdvance = () => {
    const finalized: CharDraft = { ...draft, scores, cantrips: selectedCantrips, spells: selectedSpells };
    const next = [...completedChars, finalized];
    setCompletedChars(next);
    if (next.length < playerCount) {
      setCurrentPlayerIdx(i => i + 1);
      resetCurrentChar();
    } else {
      setPhase("review");
    }
  };

  // ── Select existing character from roster dropdown ──
  const selectRosterChar = (char: RosterChar) => {
    const rosterDraft: CharDraft = {
      name: char.name, race: char.race, sex: char.sex, class: char.class,
      weapon: char.inventory?.weapons?.[0] ?? "",
      trinket: "",
      scores: {
        strength: char.strength, dexterity: char.dexterity, constitution: char.constitution,
        intelligence: char.intelligence, wisdom: char.wisdom, charisma: char.charisma,
      },
      cantrips: char.cantrips_known ?? [],
      spells: char.spells_prepared ?? [],
      rosterId: char.id,
      rosterLevel: char.level,
      rosterMaxHp: char.max_hp,
    };
    const next = [...completedChars, rosterDraft];
    setCompletedChars(next);
    if (next.length < playerCount) {
      setCurrentPlayerIdx(i => i + 1);
      resetCurrentChar();
    } else {
      setPhase("review");
    }
  };

  // ── Navigation ──
  const handleNext = () => {
    if (phase === "count") {
      setPhase("characters");
      loadRoster();
      return;
    }

    if (phase === "characters") {
      if (charStep === 1) {
        if (!draft.name.trim()) { setCharNameErr("Your character needs a name."); return; }
        if (!draft.race) return;
        const nameTaken = completedChars.some(c => c.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
        if (nameTaken) { setCharNameErr(`"${draft.name.trim()}" is already in your party.`); return; }
        setCharNameErr("");
      }
      if (charStep < totalCharSteps) { setCharStep(s => s + 1); return; }
      finalizeAndAdvance();
      return;
    }

    if (phase === "review") {
      handleLaunch();
    }
  };

  const handleBack = () => {
    if (phase === "count") { router.push("/dashboard"); return; }

    if (phase === "characters") {
      if (charStep > 1) { setCharStep(s => s - 1); return; }
      if (currentPlayerIdx === 0) { setPhase("count"); return; }
      // Restore previous player
      const prev = [...completedChars];
      const prevDraft = prev.pop()!;
      setCompletedChars(prev);
      setCurrentPlayerIdx(i => i - 1);
      if (prevDraft.rosterId) {
        resetCurrentChar(); // roster pick — land at step 1 so they can change
      } else {
        setDraft(prevDraft);
        setScores(prevDraft.scores);
        setSelectedCantrips(prevDraft.cantrips);
        setSelectedSpells(prevDraft.spells);
        setCharStep(SPELLCASTING_CLASSES.has(prevDraft.class) ? 5 : 4);
      }
      return;
    }

    if (phase === "review") {
      const prev = [...completedChars];
      const lastDraft = prev.pop()!;
      setCompletedChars(prev);
      setCurrentPlayerIdx(prev.length);
      setPhase("characters");
      if (lastDraft.rosterId) {
        resetCurrentChar();
      } else {
        setDraft(lastDraft);
        setScores(lastDraft.scores);
        setSelectedCantrips(lastDraft.cantrips);
        setSelectedSpells(lastDraft.spells);
        setCharStep(SPELLCASTING_CLASSES.has(lastDraft.class) ? 5 : 4);
      }
    }
  };

  // ── Create everything ──
  const handleLaunch = async () => {
    setPhase("creating");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }

      const genRes = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characters: completedChars.map(c => ({ name: c.name, race: c.race, cls: c.class })),
        }),
      });
      const { title: aiTitle, description: aiDescription } = genRes.ok
        ? await genRes.json()
        : { title: "Shadows of the Forgotten Realm", description: "A perilous adventure awaits." };

      const { data: campData, error: campErr } = await supabase
        .from("campaigns")
        .insert([{ title: aiTitle, description: aiDescription, user_id: user.id }])
        .select().single();
      if (campErr || !campData) throw campErr ?? new Error("Campaign creation failed");

      const newChars    = completedChars.filter(c => !c.rosterId);
      const rosterPicks = completedChars.filter(c => !!c.rosterId);

      let newCharData: { id: string }[] = [];
      if (newChars.length > 0) {
        const rows = newChars.map(c => ({
          user_id:      user.id,
          campaign_id:  campData.id,
          name:         c.name.trim(),
          race:         c.race,
          class:        c.class,
          sex:          c.sex,
          level:        1,
          xp:           0,
          max_hp:       startingHP(c.class, c.scores.constitution),
          hp:           startingHP(c.class, c.scores.constitution),
          strength:     c.scores.strength,
          dexterity:    c.scores.dexterity,
          constitution: c.scores.constitution,
          intelligence: c.scores.intelligence,
          wisdom:       c.scores.wisdom,
          charisma:     c.scores.charisma,
          inventory:    { gold: 50, weapons: [c.weapon || "Iron Dagger"], items: ["Bedroll", "Rations (5 days)", c.trinket || "Mysterious Coin"] },
          cantrips_known:   c.cantrips,
          spells_prepared:  c.spells,
          spell_slots_used: {},
          status_effects:   [],
        }));
        const { data, error: charErr } = await supabase.from("characters").insert(rows).select();
        if (charErr || !data) throw charErr ?? new Error("Character creation failed");
        newCharData = data;
      }

      for (const c of rosterPicks) {
        const maxHp = c.rosterMaxHp ?? startingHP(c.class, c.scores.constitution);
        const { error: rErr } = await supabase.from("characters")
          .update({ campaign_id: campData.id, hp: maxHp, max_hp: maxHp, spell_slots_used: {}, status_effects: [] })
          .eq("id", c.rosterId!);
        if (rErr) throw rErr;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        // Generate portraits for new characters
        newCharData.forEach((char, i) => {
          const c = newChars[i];
          fetch("/api/generate-portrait", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ race: c.race, cls: c.class, sex: c.sex, charId: char.id }),
          }).catch(console.error);
        });
        // Generate portraits for roster characters that don't have one yet
        rosterPicks.forEach(c => {
          const rChar = rosterChars?.find(r => r.id === c.rosterId);
          if (rChar && !rChar.portrait_url) {
            fetch("/api/generate-portrait", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ race: rChar.race, cls: rChar.class, sex: rChar.sex, charId: rChar.id }),
            }).catch(console.error);
          }
        });
      }

      sessionStorage.setItem("pendingCampaignTitle",       aiTitle);
      sessionStorage.setItem("pendingCampaignDescription", aiDescription);
      router.push(`/campaign/${campData.id}`);
    } catch (err) {
      console.error("[create-campaign]", err);
      alert("Something went wrong creating your campaign. Please try again.");
      setPhase("review");
    }
  };

  // ── Progress ──
  const totalTopSteps  = 1 + playerCount + 1;
  const currentTopStep =
    phase === "count"      ? 1 :
    phase === "characters" ? 1 + currentPlayerIdx + 1 :
    totalTopSteps;
  const progressPct = (currentTopStep / totalTopSteps) * 100;

  // ── Labels ──
  const nextLabel =
    phase === "count"      ? `Build ${playerCount} ${playerCount === 1 ? "Character" : "Characters"} →` :
    phase === "characters" && charStep < totalCharSteps ? "Next Step →" :
    phase === "characters" && currentPlayerIdx + 1 < playerCount ? `Player ${currentPlayerIdx + 2} →` :
    phase === "characters" ? "Review Party →" :
    phase === "review"     ? "⚔ Launch Campaign" :
    "Next →";

  const nextDisabled =
    (phase === "characters" && charStep === 2 && !draft.class) ||
    (phase === "characters" && charStep === 4 && !draft.weapon);

  const stepTitle =
    phase === "count"      ? "How Many Adventurers?" :
    phase === "characters" ? ["Identity & Origins", "Class & Vocation", "Ability Scores", "Starting Equipment", "Spells & Cantrips"][charStep - 1] :
    phase === "review"     ? "Ready to Begin" :
    "Forging your world…";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 20px" }}>
      <div className="glass-panel" style={{ width: "100%", maxWidth: "860px", padding: "40px", position: "relative" }}>

        {/* ── Top progress ── */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {phase === "characters" ? `Player ${currentPlayerIdx + 1} of ${playerCount}` :
               phase === "creating"   ? "The DM is forging your world…" : "Campaign Setup"}
            </span>
            <span style={{ fontSize: "0.72rem", color: "#475569" }}>{Math.round(progressPct)}%</span>
          </div>
          <div style={{ height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--primary)", borderRadius: "2px", transition: "width 0.5s ease" }} />
          </div>
        </div>

        {/* ── Character sub-step dots ── */}
        {phase === "characters" && (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "20px" }}>
            {Array.from({ length: totalCharSteps }, (_, i) => (
              <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: charStep > i ? "var(--primary)" : "var(--border)", transition: "background 0.2s" }} />
            ))}
          </div>
        )}

        {/* ── Title ── */}
        <h1 style={{ fontSize: "1.9rem", marginBottom: "6px", textAlign: "center" }}>{stepTitle}</h1>
        {phase === "characters" && (
          <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.85rem", marginBottom: "28px" }}>
            Building <strong style={{ color: "var(--primary)" }}>
              {draft.name.trim() || `Player ${currentPlayerIdx + 1}`}
            </strong>'s character
          </p>
        )}
        {phase !== "characters" && <div style={{ marginBottom: "28px" }} />}

        {/* ── Content ── */}
        <div style={{ minHeight: "320px" }}>

          {/* Player count */}
          {phase === "count" && (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>
              <p style={{ color: "#94a3b8", textAlign: "center", fontSize: "0.9rem", maxWidth: "420px" }}>
                Each adventurer can create a new character or select one from their existing roster.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", width: "100%", maxWidth: "520px" }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <div key={n} onClick={() => setPlayerCount(n)} style={{
                    padding: "18px 10px", borderRadius: "10px", textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                    border: `2px solid ${playerCount === n ? "var(--primary)" : "var(--border)"}`,
                    background: playerCount === n ? "rgba(139,92,246,0.2)" : "rgba(0,0,0,0.15)",
                  }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: playerCount === n ? "var(--primary)" : "white" }}>{n}</div>
                    <div style={{ fontSize: "0.62rem", color: "#64748b", marginTop: "3px" }}>
                      {n === 1 ? "Solo" : n === 2 ? "Duo" : `${n} players`}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ color: "#475569", fontSize: "0.82rem" }}>
                {playerCount === 1 ? "A solo adventure — you control your hero." :
                 `You'll set up ${playerCount} characters, one per adventurer.`}
              </p>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "14px 18px", borderRadius: "10px", background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)", maxWidth: "480px", textAlign: "left" }}>
                <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: "1px" }}>💡</span>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.65 }}>
                  <strong style={{ color: "#c4b5fd", display: "block", marginBottom: "3px" }}>Only set this to who&apos;s here right now.</strong>
                  More players can join any time using the invite link inside your campaign — they pick their own character when they arrive.
                </div>
              </div>
            </div>
          )}

          {/* Character creation */}
          {phase === "characters" && (
            <div className="animate-fade-in">

              {/* Identity */}
              {charStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                  {/* ── Roster import cards ── */}
                  {rosterLoading ? (
                    <div style={{ padding: "18px 0", textAlign: "center", fontSize: "0.82rem", color: "#475569" }}>Loading your roster…</div>
                  ) : availableRoster.length > 0 ? (
                    <div>
                      <p style={{ fontSize: "0.78rem", color: "#fbbf24", fontWeight: "bold", marginBottom: "12px", letterSpacing: "0.03em" }}>
                        📜 Import from Roster <span style={{ color: "#64748b", fontWeight: 400 }}>(optional — click a character to skip creation)</span>
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
                        {availableRoster.map(c => {
                          const hpPct = Math.max(0, Math.min(100, (c.hp / Math.max(1, c.max_hp)) * 100));
                          const hpCol = hpPct > 60 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";
                          const classColor = ({ Fighter:"#ef4444",Wizard:"#3b82f6",Rogue:"#94a3b8",Cleric:"#f59e0b",Paladin:"#fbbf24",Ranger:"#22c55e",Bard:"#ec4899",Warlock:"#a78bfa",Barbarian:"#f97316",Druid:"#84cc16",Monk:"#06b6d4",Sorcerer:"#8b5cf6" } as Record<string,string>)[c.class] ?? "#c4b5fd";
                          return (
                            <div key={c.id} onClick={() => selectRosterChar(c)}
                              style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 10px 12px", borderRadius: "12px", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)", cursor: "pointer", transition: "all 0.18s", textAlign: "center", userSelect: "none" }}
                              onMouseEnter={e => { e.currentTarget.style.border = "1px solid rgba(245,158,11,0.55)"; e.currentTarget.style.background = "rgba(245,158,11,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(245,158,11,0.15)"; }}
                              onMouseLeave={e => { e.currentTarget.style.border = "1px solid rgba(245,158,11,0.2)"; e.currentTarget.style.background = "rgba(245,158,11,0.04)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                              {/* Portrait */}
                              <div style={{ width: "60px", height: "60px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${classColor}55`, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "9px", flexShrink: 0 }}>
                                {c.portrait_url && <img src={c.portrait_url} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />}
                              </div>
                              {/* Name */}
                              <div style={{ fontSize: "0.82rem", fontWeight: "bold", color: classColor, marginBottom: "2px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{c.name}</div>
                              {/* Race · Class */}
                              <div style={{ fontSize: "0.65rem", color: "#64748b", marginBottom: "6px" }}>{c.race} {c.class}</div>
                              {/* Level badge */}
                              <div style={{ fontSize: "0.62rem", fontWeight: "bold", color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "10px", padding: "1px 7px", marginBottom: "7px" }}>Lvl {c.level}</div>
                              {/* HP bar */}
                              <div style={{ width: "100%", height: "3px", background: "#3f3f46", borderRadius: "2px", overflow: "hidden", marginBottom: "3px" }}>
                                <div style={{ width: `${hpPct}%`, height: "100%", background: hpCol, transition: "width 0.3s" }} />
                              </div>
                              <div style={{ fontSize: "0.58rem", color: hpCol }}>{c.hp}/{c.max_hp} HP</div>
                              {c.campaign_id && <div style={{ fontSize: "0.55rem", color: "#475569", marginTop: "4px" }}>In campaign</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : rosterChars !== null ? null : null}

                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                    <span style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>or create a new character</span>
                    <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                  </div>

                  {/* Name */}
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>Character Name</label>
                    <input
                      autoFocus type="text" value={draft.name}
                      onChange={e => { setDraft(d => ({ ...d, name: e.target.value })); setCharNameErr(""); }}
                      placeholder="e.g. Elara Moonwhisper"
                      style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${charNameErr ? "#ef4444" : "var(--border)"}`, background: "rgba(0,0,0,0.2)", color: "white", fontSize: "1rem" }}
                    />
                    {charNameErr && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "6px" }}>{charNameErr}</p>}
                  </div>

                  {/* Race */}
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>Race</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                      {["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Tiefling", "Gnome", "Half-Elf", "Half-Orc"].map(race => (
                        <div key={race} onClick={() => setDraft(d => ({ ...d, race }))} style={{
                          padding: "14px", borderRadius: "8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                          border: `1px solid ${draft.race === race ? "var(--primary)" : "var(--border)"}`,
                          background: draft.race === race ? "rgba(139,92,246,0.2)" : "transparent",
                        }}>{race}</div>
                      ))}
                    </div>
                  </div>

                  {/* Sex */}
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>Sex</label>
                    <div style={{ display: "flex", gap: "12px" }}>
                      {(["male", "female", "non-binary"] as const).map(s => (
                        <div key={s} onClick={() => setDraft(d => ({ ...d, sex: s }))} style={{
                          flex: 1, padding: "12px", borderRadius: "8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", textTransform: "capitalize",
                          border: `1px solid ${draft.sex === s ? "var(--primary)" : "var(--border)"}`,
                          background: draft.sex === s ? "rgba(139,92,246,0.2)" : "transparent",
                        }}>{s}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Class */}
              {charStep === 2 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                  {["Fighter", "Wizard", "Rogue", "Cleric", "Paladin", "Ranger", "Bard", "Warlock", "Barbarian", "Druid", "Monk", "Sorcerer"].map(cls => (
                    <div key={cls} onClick={() => handleClassChange(cls)} style={{
                      padding: "14px", borderRadius: "8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", fontSize: "0.9rem",
                      border: `1px solid ${draft.class === cls ? "var(--primary)" : "var(--border)"}`,
                      background: draft.class === cls ? "rgba(139,92,246,0.2)" : "transparent",
                    }}>
                      {cls}
                      {SPELLCASTING_CLASSES.has(cls) && <div style={{ fontSize: "0.6rem", color: "#8b5cf6", marginTop: "3px" }}>✦ Spellcaster</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Ability scores */}
              {charStep === 3 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
                  <div style={{ fontSize: "3.5rem", animation: rolling ? "float 0.5s infinite" : "none" }}>🎲</div>
                  <button className="btn-primary" disabled={rolling} onClick={() => {
                    setRolling(true);
                    setTimeout(() => { setScores(rollAll()); setRolling(false); }, 900);
                  }}>
                    {rolling ? "Rolling…" : "Roll Ability Scores (4d6 drop lowest)"}
                  </button>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                    {([["STR", scores.strength], ["DEX", scores.dexterity], ["CON", scores.constitution], ["INT", scores.intelligence], ["WIS", scores.wisdom], ["CHA", scores.charisma]] as [string, number][]).map(([label, val]) => {
                      const m = Math.floor((val - 10) / 2);
                      const guide = CLASS_STAT_GUIDES[draft.class]?.[label];
                      const tierStyle = guide ? getTierStyle(guide.tier) : null;
                      return (
                        <div
                          key={label}
                          style={{ position: "relative", padding: "14px 16px", background: "var(--card-bg)", borderRadius: "8px", textAlign: "center", minWidth: "70px", border: `1px solid ${tierStyle ? tierStyle.color + "55" : "var(--border)"}`, cursor: "default", transition: "border-color 0.2s" }}
                          onMouseEnter={() => setHoveredStat(label)}
                          onMouseLeave={() => setHoveredStat(null)}
                        >
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "4px" }}>{label}</div>
                          <div style={{ fontWeight: "bold", fontSize: "1.3rem" }}>{val}</div>
                          <div style={{ fontSize: "0.75rem", color: m >= 0 ? "#22c55e" : "#ef4444" }}>{m >= 0 ? `+${m}` : m}</div>
                          {tierStyle && (
                            <div style={{ fontSize: "0.52rem", color: tierStyle.color, marginTop: "4px", fontWeight: "bold", letterSpacing: "0.06em" }}>
                              {tierStyle.label.toUpperCase()}
                            </div>
                          )}
                          {hoveredStat === label && guide && tierStyle && (
                            <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#1a1730", border: `1px solid ${tierStyle.color}66`, borderRadius: "7px", padding: "9px 11px", zIndex: 300, width: "170px", pointerEvents: "none", fontSize: "0.72rem", color: "#e2e8f0", lineHeight: 1.45, textAlign: "left", boxShadow: "0 4px 16px rgba(0,0,0,0.6)" }}>
                              <div style={{ fontWeight: "bold", color: tierStyle.color, marginBottom: "4px", fontSize: "0.74rem" }}>{tierStyle.label} Stat</div>
                              {guide.reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ color: "#475569", fontSize: "0.8rem" }}>
                    Level 1 HP: <strong style={{ color: "white" }}>{startingHP(draft.class, scores.constitution)}</strong>
                    {" "}(d{CLASS_HIT_DIE[draft.class] ?? 8} + CON mod)
                  </p>
                  <p style={{ color: "#475569", fontSize: "0.75rem" }}>Re-roll as many times as you like.</p>
                </div>
              )}

              {/* Equipment */}
              {charStep === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "10px", color: "#94a3b8" }}>Primary Weapon</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                      {WEAPONS.map(w => (
                        <div key={w} onClick={() => setDraft(d => ({ ...d, weapon: w }))} style={{
                          padding: "14px", borderRadius: "8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                          border: `1px solid ${draft.weapon === w ? "var(--primary)" : "var(--border)"}`,
                          background: draft.weapon === w ? "rgba(139,92,246,0.2)" : "transparent",
                        }}>⚔ {w}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>
                      Starting Trinket <span style={{ color: "#475569" }}>(optional)</span>
                    </label>
                    <input
                      type="text" value={draft.trinket} maxLength={80}
                      onChange={e => setDraft(d => ({ ...d, trinket: e.target.value }))}
                      placeholder="e.g. A silver locket with a faded portrait"
                      style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "white", fontSize: "0.95rem" }}
                    />
                  </div>
                </div>
              )}

              {/* Spells */}
              {charStep === 5 && isSpellcaster && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}>
                  <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", fontSize: "0.82rem", color: "#c4b5fd", lineHeight: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                    <span>As a Level 1 <strong>{draft.class}</strong>, choose your spells.
                    {SPELL_LIMITS[draft.class]?.spellFormula && " Prepared count is based on your ability modifier."}</span>
                    <span style={{ flexShrink: 0, fontWeight: "bold", color: (selectedCantrips.length === spellCounts.cantrips || spellCounts.cantrips === 0) && (selectedSpells.length === spellCounts.spells || spellCounts.spells === 0) ? "#22c55e" : "#8b5cf6" }}>
                      {selectedCantrips.length + selectedSpells.length} / {spellCounts.cantrips + spellCounts.spells} chosen
                    </span>
                  </div>

                  {spellCounts.cantrips > 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Cantrips</span>
                        <span style={{ fontSize: "0.78rem", color: selectedCantrips.length === spellCounts.cantrips ? "#22c55e" : "#8b5cf6", fontWeight: "bold" }}>
                          {selectedCantrips.length} / {spellCounts.cantrips}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {availableCantrips.map(spell => (
                          <SpellCard key={spell.name} spell={spell}
                            selected={selectedCantrips.includes(spell.name)}
                            disabled={selectedCantrips.length >= spellCounts.cantrips && !selectedCantrips.includes(spell.name)}
                            onToggle={() => setSelectedCantrips(prev =>
                              prev.includes(spell.name) ? prev.filter(s => s !== spell.name) :
                              prev.length < spellCounts.cantrips ? [...prev, spell.name] : prev
                            )} />
                        ))}
                      </div>
                    </div>
                  )}

                  {spellCounts.spells > 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          1st-Level Spells
                        </span>
                        <span style={{ fontSize: "0.78rem", color: selectedSpells.length === spellCounts.spells ? "#22c55e" : "#8b5cf6", fontWeight: "bold" }}>
                          {selectedSpells.length} / {spellCounts.spells} {SPELL_LIMITS[draft.class]?.spellFormula ? "prepared" : "known"}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {availableSpells.map(spell => (
                          <SpellCard key={spell.name} spell={spell}
                            selected={selectedSpells.includes(spell.name)}
                            disabled={selectedSpells.length >= spellCounts.spells && !selectedSpells.includes(spell.name)}
                            onToggle={() => setSelectedSpells(prev =>
                              prev.includes(spell.name) ? prev.filter(s => s !== spell.name) :
                              prev.length < spellCounts.spells ? [...prev, spell.name] : prev
                            )} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Party review */}
          {phase === "review" && (
            <div className="animate-fade-in">
              <p style={{ textAlign: "center", color: "#94a3b8", marginBottom: "24px", fontSize: "0.9rem" }}>
                Your party is assembled. The DM will name your campaign upon launch.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: completedChars.length === 1 ? "1fr" : "1fr 1fr", gap: "12px" }}>
                {completedChars.map((c, i) => (
                  <div key={i} className="glass-panel" style={{ padding: "16px", display: "flex", gap: "14px", alignItems: "center" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "8px", background: c.rosterId ? "rgba(245,158,11,0.12)" : "rgba(139,92,246,0.12)", border: `1px solid ${c.rosterId ? "rgba(245,158,11,0.3)" : "rgba(139,92,246,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>
                      {c.rosterId ? "📜" : "🧙"}
                    </div>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "0.95rem" }}>{c.name}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>{c.race} {c.class} · {c.rosterId ? `Level ${c.rosterLevel}` : "Level 1"}</div>
                      <div style={{ color: "#64748b", fontSize: "0.72rem", marginTop: "2px" }}>
                        ❤ {c.rosterId ? c.rosterMaxHp : startingHP(c.class, c.scores.constitution)} HP
                        {!c.rosterId && ` · ${c.weapon || "Iron Dagger"}`}
                        {c.cantrips.length > 0 && ` · ${c.cantrips.length} cantrip${c.cantrips.length > 1 ? "s" : ""}`}
                      </div>
                      {c.rosterId && (
                        <div style={{ fontSize: "0.62rem", color: "#fbbf24", marginTop: "3px" }}>Returning adventurer</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Creating state */}
          {phase === "creating" && (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", height: "240px" }}>
              <div style={{ fontSize: "3rem", animation: "float 1.2s ease-in-out infinite" }}>⚔️</div>
              <p style={{ color: "#94a3b8", fontSize: "0.95rem" }}>The DM is naming and preparing your campaign…</p>
            </div>
          )}
        </div>

        {/* ── Footer navigation ── */}
        {phase !== "creating" && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
            <button className="btn-secondary" onClick={handleBack}>
              {phase === "count" ? "Cancel" : "Back"}
            </button>
            <button
              className="btn-primary"
              onClick={handleNext}
              disabled={nextDisabled}
              style={phase === "review" ? { background: "var(--accent)", padding: "10px 28px" } : {}}
            >
              {nextLabel}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
