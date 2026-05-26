"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import "../globals.css";
import {
  CANTRIPS, LEVEL1_SPELLS, SPELL_LIMITS, SPELLCASTING_CLASSES,
  getSpellCounts, type SpellEntry,
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
};
type Phase = "campaign" | "count" | "characters" | "review" | "creating";

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

  // Campaign
  const [phase, setPhase]               = useState<Phase>("campaign");
  const [campaignName, setCampaignName] = useState("");
  const [campaignDesc, setCampaignDesc] = useState("");
  const [campNameErr,  setCampNameErr]  = useState("");

  // Player count
  const [playerCount, setPlayerCount] = useState(1);

  // Current player being built
  const [currentPlayerIdx,   setCurrentPlayerIdx]   = useState(0);
  const [charStep,           setCharStep]           = useState(1);
  const [draft,              setDraft]              = useState<CharDraft>(emptyDraft());
  const [scores,             setScores]             = useState<AbilityScores>(DEFAULT_SCORES);
  const [rolling,            setRolling]            = useState(false);
  const [selectedCantrips,   setSelectedCantrips]   = useState<string[]>([]);
  const [selectedSpells,     setSelectedSpells]     = useState<string[]>([]);
  const [charNameErr,        setCharNameErr]        = useState("");

  // Completed characters
  const [completedChars, setCompletedChars] = useState<CharDraft[]>([]);

  // Derived
  const isSpellcaster    = SPELLCASTING_CLASSES.has(draft.class);
  const totalCharSteps   = isSpellcaster ? 5 : 4;
  const spellCounts      = getSpellCounts(draft.class, scores);
  const availableCantrips = CANTRIPS[draft.class] ?? [];
  const availableSpells   = LEVEL1_SPELLS[draft.class] ?? [];

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

  // ── Finalize current character and advance ──
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

  // ── Navigation ──
  const handleNext = () => {
    if (phase === "campaign") {
      if (!campaignName.trim()) { setCampNameErr("Your campaign needs a name."); return; }
      setCampNameErr("");
      setPhase("count");
      return;
    }

    if (phase === "count") {
      setPhase("characters");
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
    if (phase === "campaign") { router.push("/dashboard"); return; }
    if (phase === "count") { setPhase("campaign"); return; }

    if (phase === "characters") {
      if (charStep > 1) { setCharStep(s => s - 1); return; }
      if (currentPlayerIdx === 0) { setPhase("count"); return; }
      // Restore previous player's draft
      const prev = [...completedChars];
      const prevDraft = prev.pop()!;
      setCompletedChars(prev);
      setDraft(prevDraft);
      setScores(prevDraft.scores);
      setSelectedCantrips(prevDraft.cantrips);
      setSelectedSpells(prevDraft.spells);
      setCurrentPlayerIdx(i => i - 1);
      setCharStep(SPELLCASTING_CLASSES.has(prevDraft.class) ? 5 : 4);
      return;
    }

    if (phase === "review") {
      // Restore last completed character for editing
      const prev = [...completedChars];
      const lastDraft = prev.pop()!;
      setCompletedChars(prev);
      setDraft(lastDraft);
      setScores(lastDraft.scores);
      setSelectedCantrips(lastDraft.cantrips);
      setSelectedSpells(lastDraft.spells);
      setCurrentPlayerIdx(prev.length);
      setCharStep(SPELLCASTING_CLASSES.has(lastDraft.class) ? 5 : 4);
      setPhase("characters");
    }
  };

  // ── Create everything ──
  const handleLaunch = async () => {
    setPhase("creating");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }

      const { data: campData, error: campErr } = await supabase
        .from("campaigns")
        .insert([{ title: campaignName.trim(), description: campaignDesc.trim() || "A freshly created campaign.", user_id: user.id }])
        .select().single();
      if (campErr || !campData) throw campErr ?? new Error("Campaign creation failed");

      const rows = completedChars.map(c => ({
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
        cantrips_known:  c.cantrips,
        spells_prepared: c.spells,
      }));

      const { data: charData, error: charErr } = await supabase.from("characters").insert(rows).select();
      if (charErr || !charData) throw charErr ?? new Error("Character creation failed");

      // Fire portrait generation for all characters (background)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        charData.forEach((char, i) => {
          const c = completedChars[i];
          fetch("/api/generate-portrait", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ race: c.race, cls: c.class, sex: c.sex, charId: char.id }),
          }).catch(console.error);
        });
      }

      router.push(`/campaign/${campData.id}`);
    } catch (err) {
      console.error("[create-campaign]", err);
      alert("Something went wrong creating your campaign. Please try again.");
      setPhase("review");
    }
  };

  // ── Progress ──
  // Top-level steps: Campaign → Party Size → Players 1…N → Review
  const totalTopSteps = 2 + playerCount + 1;
  const currentTopStep =
    phase === "campaign"   ? 1 :
    phase === "count"      ? 2 :
    phase === "characters" ? 2 + currentPlayerIdx + 1 :
    totalTopSteps;

  const progressPct = (currentTopStep / totalTopSteps) * 100;

  // Next button label
  const nextLabel =
    phase === "campaign"   ? "Next →" :
    phase === "count"      ? `Build ${playerCount} ${playerCount === 1 ? "Character" : "Characters"} →` :
    phase === "characters" && charStep < totalCharSteps ? "Next Step →" :
    phase === "characters" && currentPlayerIdx + 1 < playerCount ? `Player ${currentPlayerIdx + 2} →` :
    phase === "characters" ? "Review Party →" :
    phase === "review"     ? "⚔ Launch Campaign" :
    "Next →";

  // Next button disabled
  const nextDisabled =
    (phase === "characters" && charStep === 2 && !draft.class) ||
    (phase === "characters" && charStep === 4 && !draft.weapon);

  // Step title
  const charSubStepTitles = ["Identity & Origins", "Class & Vocation", "Ability Scores", "Starting Equipment", "Spells & Cantrips"];
  const stepTitle =
    phase === "campaign"   ? "Name Your Adventure" :
    phase === "count"      ? "How Many Adventurers?" :
    phase === "characters" ? charSubStepTitles[charStep - 1] :
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
               phase === "creating"   ? "Creating your world…" : "Campaign Setup"}
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

          {/* Campaign name & desc */}
          {phase === "campaign" && (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>Campaign Name</label>
                <input
                  autoFocus type="text" value={campaignName} maxLength={80}
                  onChange={e => { setCampaignName(e.target.value); setCampNameErr(""); }}
                  onKeyDown={e => e.key === "Enter" && handleNext()}
                  placeholder="e.g. The Lost Mines of Phandelver"
                  style={{ width: "100%", padding: "14px", borderRadius: "8px", border: `1px solid ${campNameErr ? "#ef4444" : "var(--border)"}`, background: "rgba(0,0,0,0.2)", color: "white", fontSize: "1.1rem" }}
                />
                {campNameErr && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "6px" }}>{campNameErr}</p>}
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>
                  Description <span style={{ color: "#475569" }}>(optional)</span>
                </label>
                <textarea
                  value={campaignDesc} maxLength={300} rows={3}
                  onChange={e => setCampaignDesc(e.target.value)}
                  placeholder="A brief hook or premise for your adventure…"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "white", fontSize: "0.95rem", resize: "none", fontFamily: "inherit" }}
                />
              </div>
            </div>
          )}

          {/* Player count */}
          {phase === "count" && (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>
              <p style={{ color: "#94a3b8", textAlign: "center", fontSize: "0.9rem", maxWidth: "420px" }}>
                Each adventurer will be walked through character creation before your campaign begins.
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
                 `You'll create ${playerCount} characters, one per adventurer.`}
              </p>
            </div>
          )}

          {/* Character creation sub-steps */}
          {phase === "characters" && (
            <div className="animate-fade-in">

              {/* Identity */}
              {charStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>Race</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                      {["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Tiefling"].map(race => (
                        <div key={race} onClick={() => setDraft(d => ({ ...d, race }))} style={{
                          padding: "14px", borderRadius: "8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                          border: `1px solid ${draft.race === race ? "var(--primary)" : "var(--border)"}`,
                          background: draft.race === race ? "rgba(139,92,246,0.2)" : "transparent",
                        }}>{race}</div>
                      ))}
                    </div>
                  </div>
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
                      return (
                        <div key={label} style={{ padding: "14px 16px", background: "var(--card-bg)", borderRadius: "8px", textAlign: "center", minWidth: "70px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "4px" }}>{label}</div>
                          <div style={{ fontWeight: "bold", fontSize: "1.3rem" }}>{val}</div>
                          <div style={{ fontSize: "0.75rem", color: m >= 0 ? "#22c55e" : "#ef4444" }}>{m >= 0 ? `+${m}` : m}</div>
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
                <strong style={{ color: "white" }}>{campaignName}</strong> is ready. Your party:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: completedChars.length === 1 ? "1fr" : "1fr 1fr", gap: "12px" }}>
                {completedChars.map((c, i) => (
                  <div key={i} className="glass-panel" style={{ padding: "16px", display: "flex", gap: "14px", alignItems: "center" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "8px", background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>🧙</div>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "0.95rem" }}>{c.name}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.78rem" }}>{c.race} {c.class} · Level 1</div>
                      <div style={{ color: "#64748b", fontSize: "0.72rem", marginTop: "2px" }}>
                        ❤ {startingHP(c.class, c.scores.constitution)} HP · {c.weapon || "Iron Dagger"}
                        {c.cantrips.length > 0 && ` · ${c.cantrips.length} cantrip${c.cantrips.length > 1 ? "s" : ""}`}
                      </div>
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
              <p style={{ color: "#94a3b8", fontSize: "0.95rem" }}>Forging your world…</p>
            </div>
          )}
        </div>

        {/* ── Footer navigation ── */}
        {phase !== "creating" && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
            <button className="btn-secondary" onClick={handleBack}>
              {phase === "campaign" ? "Cancel" : "Back"}
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
