"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import "../globals.css";
import {
  CANTRIPS, LEVEL1_SPELLS, SPELL_LIMITS, SPELLCASTING_CLASSES,
  getSpellCounts, CLASS_STAT_GUIDES, getTierStyle, type SpellEntry,
} from "../../lib/spellData";
import { computeInventoryBonuses } from "../../lib/lootData";
import {
  CLASS_PROFICIENCIES, STANDARD_ARRAY, POINT_BUY_COST, POINT_BUY_BUDGET, calcPointBuyCost,
} from "../../lib/proficiencyData";
import { useTooltip, tipBox } from "../../hooks/useTooltip";
import { RACE_TIPS, ALIGNMENT_TIPS, CLASS_TIPS, MECHANIC_TIPS, STAT_TIPS, SKILL_TIPS, STAT_METHOD_TIPS, PROF_TIPS, WEAPON_TIPS, SPELL_SCHOOL_TIPS, ARRAY_VALUE_TIPS } from "../../lib/tooltipData";

// ── Types ──────────────────────────────────────────────────────────────────────
type AbilityScores = {
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
};
type StatMethod = "roll" | "array" | "pointbuy";
type CharDraft = {
  name: string; title: string; race: string; sex: string; class: string; alignment: string;
  weapon: string; trinket: string; shield: boolean; charBackground: string;
  scores: AbilityScores;
  cantrips: string[]; spells: string[]; skillProficiencies: string[];
  rosterId?: string;
  rosterLevel?: number;
  rosterMaxHp?: number;
};
type RosterChar = {
  id: string; name: string; race: string; class: string; sex: string;
  level: number; max_hp: number; hp: number; xp?: number;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  user_id?: string;
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
const ALIGNMENTS = [
  { key: "Lawful Good", short: "LG" }, { key: "Neutral Good", short: "NG" }, { key: "Chaotic Good", short: "CG" },
  { key: "Lawful Neutral", short: "LN" }, { key: "True Neutral", short: "TN" }, { key: "Chaotic Neutral", short: "CN" },
  { key: "Lawful Evil", short: "LE" }, { key: "Neutral Evil", short: "NE" }, { key: "Chaotic Evil", short: "CE" },
] as const;

const POINTBUY_DEFAULT: AbilityScores = {
  strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8,
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
const SHIELD_CLASSES = new Set(["Fighter", "Paladin", "Ranger", "Cleric", "Druid", "Barbarian"]);

function emptyDraft(): CharDraft {
  return {
    name: "", title: "", race: "", sex: "male", class: "", alignment: "",
    weapon: "", trinket: "", shield: false, charBackground: "",
    scores: DEFAULT_SCORES, cantrips: [], spells: [], skillProficiencies: [],
  };
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

  // Stat method state (resets per character)
  const [statMethod, setStatMethod] = useState<StatMethod>("roll");
  const [arrayAssignments, setArrayAssignments] = useState<Record<string, number | null>>({
    strength: null, dexterity: null, constitution: null, intelligence: null, wisdom: null, charisma: null,
  });
  const [selectedArrayVal, setSelectedArrayVal] = useState<number | null>(null);
  const [completedChars, setCompletedChars] = useState<CharDraft[]>([]);
  const [rosterChars, setRosterChars] = useState<RosterChar[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  const { showTooltip, hideTooltip, TooltipPortal } = useTooltip();

  const isSpellcaster     = SPELLCASTING_CLASSES.has(draft.class);
  const totalCharSteps    = isSpellcaster ? 6 : 5;
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
    setStatMethod("roll");
    setArrayAssignments({ strength: null, dexterity: null, constitution: null, intelligence: null, wisdom: null, charisma: null });
    setSelectedArrayVal(null);
    setCharStep(1);
    setCharNameErr("");
  };

  const handleClassChange = (cls: string) => {
    setDraft(d => ({ ...d, class: cls, skillProficiencies: [] }));
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
        .select("id,name,race,class,sex,level,max_hp,hp,xp,user_id,strength,dexterity,constitution,intelligence,wisdom,charisma,inventory,cantrips_known,spells_prepared,campaign_id,portrait_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRosterChars((data as RosterChar[]) ?? []);
    } finally {
      setRosterLoading(false);
    }
  };

  // ── Stat helpers ──
  const effectiveScores = (): AbilityScores => {
    if (statMethod === "array") {
      return {
        strength: arrayAssignments.strength ?? 8, dexterity: arrayAssignments.dexterity ?? 8,
        constitution: arrayAssignments.constitution ?? 8, intelligence: arrayAssignments.intelligence ?? 8,
        wisdom: arrayAssignments.wisdom ?? 8, charisma: arrayAssignments.charisma ?? 8,
      };
    }
    return scores;
  };
  const arrayComplete   = Object.values(arrayAssignments).every(v => v !== null);
  const pointsSpent     = statMethod === "pointbuy" ? calcPointBuyCost(scores) : 0;
  const pointsLeft      = POINT_BUY_BUDGET - pointsSpent;
  const profData        = draft.class ? CLASS_PROFICIENCIES[draft.class] : null;
  const profRequired    = profData?.skillChoices.count ?? 0;

  const handleStatMethodChange = (method: StatMethod) => {
    setStatMethod(method);
    if (method === "pointbuy") setScores(POINTBUY_DEFAULT);
    if (method === "array") {
      setArrayAssignments({ strength: null, dexterity: null, constitution: null, intelligence: null, wisdom: null, charisma: null });
      setSelectedArrayVal(null);
    }
  };

  const handleArrayChipClick = (val: number) => {
    const isUsed = Object.values(arrayAssignments).includes(val);
    if (isUsed) return;
    setSelectedArrayVal(prev => prev === val ? null : val);
  };

  const handleArrayStatClick = (statKey: string) => {
    if (selectedArrayVal !== null) {
      const displaced = arrayAssignments[statKey];
      setArrayAssignments(a => ({ ...a, [statKey]: selectedArrayVal }));
      setSelectedArrayVal(displaced);
    } else if (arrayAssignments[statKey] !== null) {
      setSelectedArrayVal(arrayAssignments[statKey]);
      setArrayAssignments(a => ({ ...a, [statKey]: null }));
    }
  };

  const adjustPBStat = (statKey: string, delta: number) => {
    const current = scores[statKey as keyof AbilityScores];
    const newVal = current + delta;
    if (newVal < 8 || newVal > 15) return;
    const newScores = { ...scores, [statKey as keyof AbilityScores]: newVal };
    if (calcPointBuyCost(newScores) > POINT_BUY_BUDGET) return;
    setScores(newScores);
  };

  const toggleSkillProf = (skill: string) => {
    setDraft(d => {
      const prev = d.skillProficiencies;
      if (prev.includes(skill)) return { ...d, skillProficiencies: prev.filter(s => s !== skill) };
      if (prev.length >= profRequired) return d;
      return { ...d, skillProficiencies: [...prev, skill] };
    });
  };

  // ── Finalize new character and advance ──
  const finalizeAndAdvance = () => {
    const eff = effectiveScores();
    const finalized: CharDraft = { ...draft, scores: eff, cantrips: selectedCantrips, spells: selectedSpells };
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
      title: "", alignment: "", charBackground: "", skillProficiencies: [],
      weapon: char.inventory?.weapons?.[0] ?? "",
      trinket: "",
      shield: char.inventory?.items?.includes("Shield") ?? false,
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
        setStatMethod("roll"); // restored characters always show roll tab
        setArrayAssignments({ strength: null, dexterity: null, constitution: null, intelligence: null, wisdom: null, charisma: null });
        setCharStep(SPELLCASTING_CLASSES.has(prevDraft.class) ? 6 : 5);
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
        setStatMethod("roll");
        setArrayAssignments({ strength: null, dexterity: null, constitution: null, intelligence: null, wisdom: null, charisma: null });
        setCharStep(SPELLCASTING_CLASSES.has(lastDraft.class) ? 6 : 5);
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
        const rows = newChars.map(c => {
          const weapons = [c.weapon || "Iron Dagger"];
          const items   = ["Bedroll", "Rations (5 days)", ...(c.shield ? ["Shield"] : []), c.trinket || "Mysterious Coin"];
          const baseMaxHp   = startingHP(c.class, c.scores.constitution);
          const ib          = computeInventoryBonuses(items, weapons);
          const effectiveHp = baseMaxHp + ib.hpMaxAdd;
          return {
            user_id:             user.id,
            campaign_id:         campData.id,
            name:                c.name.trim(),
            race:                c.race,
            class:               c.class,
            sex:                 c.sex,
            title:               c.title?.trim() || null,
            alignment:           c.alignment || null,
            background:          c.charBackground?.trim() || null,
            skill_proficiencies: c.skillProficiencies,
            level:               1,
            xp:                  0,
            max_hp:              baseMaxHp,
            hp:                  effectiveHp,
            strength:            c.scores.strength,
            dexterity:           c.scores.dexterity,
            constitution:        c.scores.constitution,
            intelligence:        c.scores.intelligence,
            wisdom:              c.scores.wisdom,
            charisma:            c.scores.charisma,
            inventory:           { gold: 50, weapons, items },
            cantrips_known:      c.cantrips,
            spells_prepared:     c.spells,
            spell_slots_used:    {},
            status_effects:      [],
          };
        });
        const { data, error: charErr } = await supabase.from("characters").insert(rows).select();
        if (charErr || !data) throw charErr ?? new Error("Character creation failed");
        newCharData = data;

        // Insert campaign-specific state rows for new characters
        const ccNewRows = (data as { id: string }[]).map((char, i) => {
          const c = newChars[i];
          const weapons = [c.weapon || "Iron Dagger"];
          const items   = ["Bedroll", "Rations (5 days)", ...(c.shield ? ["Shield"] : []), c.trinket || "Mysterious Coin"];
          const baseMaxHp   = startingHP(c.class, c.scores.constitution);
          const ib          = computeInventoryBonuses(items, weapons);
          const effectiveHp = baseMaxHp + ib.hpMaxAdd;
          return {
            campaign_id: campData.id, character_id: char.id, user_id: user.id,
            hp: effectiveHp, max_hp: baseMaxHp, xp: 0, level: 1,
            inventory: { gold: 50, weapons, items },
            spell_slots_used: {}, status_effects: [],
            cantrips_known: c.cantrips, spells_prepared: c.spells,
          };
        });
        await supabase.from("campaign_characters").insert(ccNewRows);
      }

      for (const c of rosterPicks) {
        const rChar     = rosterChars?.find(r => r.id === c.rosterId);
        const inv       = rChar?.inventory ?? { items: [], weapons: [] };
        const ib        = computeInventoryBonuses(inv.items ?? [], inv.weapons ?? []);
        const baseMaxHp = c.rosterMaxHp ?? startingHP(c.class, c.scores.constitution);
        const fullHp    = baseMaxHp + ib.hpMaxAdd;
        const { error: rErr } = await supabase.from("characters")
          .update({ campaign_id: campData.id })
          .eq("id", c.rosterId!);
        if (rErr) throw rErr;
        // Upsert campaign-specific state for roster character (fresh HP, slots/statuses reset)
        await supabase.from("campaign_characters").upsert({
          campaign_id: campData.id, character_id: c.rosterId!, user_id: rChar?.user_id ?? user.id,
          hp: fullHp, max_hp: baseMaxHp,
          xp: rChar?.xp ?? 0, level: c.rosterLevel ?? 1,
          inventory: rChar?.inventory ?? { gold: 50, weapons: [], items: [] },
          spell_slots_used: {}, status_effects: [],
          cantrips_known: rChar?.cantrips_known ?? c.cantrips,
          spells_prepared: rChar?.spells_prepared ?? c.spells,
        }, { onConflict: "campaign_id,character_id" });
      }

      // Set party leader to the first character added (respects completedChars order)
      const firstChar   = completedChars[0];
      const firstCharId = firstChar?.rosterId
        ?? newCharData[newChars.indexOf(firstChar)]?.id
        ?? null;
      if (firstCharId) {
        await supabase.from("campaigns").update({ party_leader_id: firstCharId }).eq("id", campData.id);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        // Generate portraits for new characters
        newCharData.forEach((char, i) => {
          const c = newChars[i];
          fetch("/api/generate-portrait", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ race: c.race, cls: c.class, sex: c.sex, charId: char.id, title: c.title?.trim() || null, alignment: c.alignment || null, background: c.charBackground?.trim() || null }),
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
    phase === "count"      ? "Add Characters →" :
    phase === "characters" && charStep < totalCharSteps ? "Next Step →" :
    phase === "characters" && currentPlayerIdx + 1 < playerCount ? `Player ${currentPlayerIdx + 2} →` :
    phase === "characters" ? "Review Party →" :
    phase === "review"     ? "⚔ Launch Campaign" :
    "Next →";

  const nextDisabled =
    (phase === "characters" && charStep === 2 && (!draft.class || draft.skillProficiencies.length < profRequired)) ||
    (phase === "characters" && charStep === 3 && statMethod === "array" && !arrayComplete) ||
    (phase === "characters" && charStep === 4 && !draft.weapon);

  const stepTitle =
    phase === "count"      ? "How Many Adventurers?" :
    phase === "characters" ? ["Identity & Origins", "Class & Proficiencies", "Ability Scores", "Starting Equipment", "Character Background", "Spells & Cantrips"][charStep - 1] :
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
          <div style={{ textAlign: "center", marginBottom: charStep === 1 ? "16px" : "28px" }}>
            <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: currentPlayerIdx === 0 && charStep === 1 ? "8px" : "0" }}>
              Building <strong style={{ color: "var(--primary)" }}>
                {draft.name.trim() || `Player ${currentPlayerIdx + 1}`}
              </strong>'s character
            </p>
            {currentPlayerIdx === 0 && charStep === 1 && (
              <p style={{ fontSize: "0.75rem", color: "#475569", display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "20px", padding: "3px 12px" }}>
                👑 <span>Player 1&apos;s character becomes the <strong style={{ color: "#c4b5fd" }}>Party Leader</strong> — they can invite others and manage the party</span>
              </p>
            )}
            {/* Inline nav on step 1 — sits right below the disclaimer */}
            {charStep === 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px" }}>
                <button className="btn-secondary" onClick={handleBack}>Back</button>
                <button className="btn-primary" onClick={handleNext} disabled={nextDisabled}>{nextLabel}</button>
              </div>
            )}
          </div>
        )}
        {phase === "count" && (
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: "480px", margin: "16px auto 12px" }}>
            <button className="btn-secondary" onClick={handleBack}>Cancel</button>
            <button className="btn-primary" onClick={handleNext}>{nextLabel}</button>
          </div>
        )}
        {phase !== "characters" && phase !== "count" && <div style={{ marginBottom: "28px" }} />}

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
                <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

                  {/* Left: new character form */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>

                    {/* Name + Title */}
                    <div style={{ display: "flex", gap: "10px" }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>Character Name</label>
                        <input
                          autoFocus type="text" value={draft.name}
                          onChange={e => { setDraft(d => ({ ...d, name: e.target.value })); setCharNameErr(""); }}
                          placeholder="e.g. Elara Moonwhisper"
                          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${charNameErr ? "#ef4444" : "var(--border)"}`, background: "rgba(0,0,0,0.2)", color: "white", fontSize: "1rem" }}
                        />
                        {charNameErr && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "6px" }}>{charNameErr}</p>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>Title <span style={{ fontSize: "0.7rem", color: "#475569" }}>(optional)</span></label>
                        <input type="text" value={draft.title} maxLength={40}
                          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                          placeholder="e.g. the Brave"
                          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "white", fontSize: "1rem" }}
                        />
                      </div>
                    </div>

                    {/* Race */}
                    <div>
                      <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8", cursor: "help" }}
                        onMouseEnter={e => showTooltip(tipBox("Race", "Your character's ancestry — determines stat bonuses, special abilities, darkvision, and innate traits. Hover any race for details.", "#c4b5fd"), e)}
                        onMouseLeave={hideTooltip}>Race</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                        {["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Tiefling", "Gnome", "Half-Elf", "Half-Orc"].map(race => (
                          <div key={race} onClick={() => setDraft(d => ({ ...d, race }))}
                            onMouseEnter={e => { const t = RACE_TIPS[race]; if (t) showTooltip(tipBox(t.title, t.body, "#c4b5fd"), e); }}
                            onMouseLeave={hideTooltip}
                            style={{
                              padding: "14px", borderRadius: "8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                              border: `1px solid ${draft.race === race ? "var(--primary)" : "var(--border)"}`,
                              background: draft.race === race ? "rgba(139,92,246,0.2)" : "transparent",
                            }}>{race}</div>
                        ))}
                      </div>
                    </div>

                    {/* Sex */}
                    <div>
                      <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8", cursor: "help" }}
                        onMouseEnter={e => showTooltip(tipBox("Sex / Pronouns", "Sets the pronouns the DM uses when narrating your character's actions — he/him, she/her, or they/them.", "#c4b5fd"), e)}
                        onMouseLeave={hideTooltip}>Sex</label>
                      <div style={{ display: "flex", gap: "12px" }}>
                        {(["male", "female", "non-binary"] as const).map(s => {
                          const pronounMap = { male: "he/him", female: "she/her", "non-binary": "they/them" };
                          return (
                          <div key={s} onClick={() => setDraft(d => ({ ...d, sex: s }))}
                            onMouseEnter={e => showTooltip(tipBox(s.charAt(0).toUpperCase() + s.slice(1), `Pronouns: ${pronounMap[s]} — the DM will refer to your character using these pronouns.`, "#c4b5fd"), e)}
                            onMouseLeave={hideTooltip}
                            style={{
                              flex: 1, padding: "12px", borderRadius: "8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", textTransform: "capitalize",
                              border: `1px solid ${draft.sex === s ? "var(--primary)" : "var(--border)"}`,
                              background: draft.sex === s ? "rgba(139,92,246,0.2)" : "transparent",
                            }}>{s}</div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Alignment */}
                    <div>
                      <label style={{ display: "block", marginBottom: "6px", color: "#94a3b8", cursor: "help" }}
                        onMouseEnter={e => showTooltip(tipBox("Alignment", "Your character's moral and ethical outlook. Optional — shapes how the DM portrays NPC reactions and your character's motivations. Hover any alignment for its description.", "#a78bfa"), e)}
                        onMouseLeave={hideTooltip}>Alignment <span style={{ fontSize: "0.7rem", color: "#475569" }}>(optional)</span></label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                        {ALIGNMENTS.map(a => (
                          <div key={a.key} onClick={() => setDraft(d => ({ ...d, alignment: d.alignment === a.key ? "" : a.key }))}
                            onMouseEnter={e => showTooltip(tipBox(a.key, ALIGNMENT_TIPS[a.key] ?? "", "#a78bfa"), e)}
                            onMouseLeave={hideTooltip}
                            style={{
                              padding: "8px 6px", borderRadius: "8px", cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                              border: `1px solid ${draft.alignment === a.key ? "var(--primary)" : "var(--border)"}`,
                              background: draft.alignment === a.key ? "rgba(139,92,246,0.2)" : "transparent",
                            }}>
                            <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.06em", color: draft.alignment === a.key ? "#c4b5fd" : "#64748b", textTransform: "uppercase" }}>{a.short}</div>
                            <div style={{ fontSize: "0.72rem", color: draft.alignment === a.key ? "white" : "#94a3b8", lineHeight: 1.2, marginTop: "1px" }}>{a.key}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: roster import (vertical list) */}
                  {(rosterLoading || availableRoster.length > 0) && (
                    <div style={{ width: "200px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                      <p style={{ fontSize: "0.72rem", color: "#fbbf24", fontWeight: "bold", letterSpacing: "0.03em", lineHeight: 1.4 }}>
                        📜 Import from Roster
                        <span style={{ display: "block", color: "#64748b", fontWeight: 400, fontSize: "0.65rem" }}>Click a character to skip creation</span>
                      </p>
                      {rosterLoading ? (
                        <div style={{ padding: "12px 0", textAlign: "center", fontSize: "0.78rem", color: "#475569" }}>Loading…</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "380px", overflowY: "auto", paddingRight: "2px" }}>
                          {availableRoster.map(c => {
                            const hpPct = Math.max(0, Math.min(100, (c.hp / Math.max(1, c.max_hp)) * 100));
                            const hpCol = hpPct > 60 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";
                            const classColor = ({ Fighter:"#ef4444",Wizard:"#3b82f6",Rogue:"#94a3b8",Cleric:"#f59e0b",Paladin:"#fbbf24",Ranger:"#22c55e",Bard:"#ec4899",Warlock:"#a78bfa",Barbarian:"#f97316",Druid:"#84cc16",Monk:"#06b6d4",Sorcerer:"#8b5cf6" } as Record<string,string>)[c.class] ?? "#c4b5fd";
                            return (
                              <div key={c.id} onClick={() => selectRosterChar(c)}
                                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)", cursor: "pointer", transition: "all 0.18s", userSelect: "none" }}
                                onMouseEnter={e => { e.currentTarget.style.border = "1px solid rgba(245,158,11,0.55)"; e.currentTarget.style.background = "rgba(245,158,11,0.1)"; e.currentTarget.style.transform = "translateX(-2px)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(245,158,11,0.12)"; }}
                                onMouseLeave={e => { e.currentTarget.style.border = "1px solid rgba(245,158,11,0.2)"; e.currentTarget.style.background = "rgba(245,158,11,0.04)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                                {/* Portrait */}
                                <div style={{ width: "56px", height: "56px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${classColor}`, boxShadow: `0 0 10px ${classColor}44`, background: "rgba(0,0,0,0.5)", flexShrink: 0 }}>
                                  {c.portrait_url
                                    ? <img src={c.portrait_url} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                                    : <div style={{ width: "100%", height: "100%", background: `${classColor}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>🧙</div>
                                  }
                                </div>
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: classColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                                  <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "3px" }}>{c.race} {c.class}</div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                    <span style={{ fontSize: "0.58rem", fontWeight: "bold", color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "8px", padding: "1px 5px" }}>Lvl {c.level}</span>
                                    <span style={{ fontSize: "0.6rem", color: hpCol }}>{c.hp}/{c.max_hp} HP</span>
                                  </div>
                                  {c.campaign_id && <div style={{ fontSize: "0.55rem", color: "#475569", marginTop: "2px" }}>In campaign</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Class & Proficiencies */}
              {charStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                    {["Fighter", "Wizard", "Rogue", "Cleric", "Paladin", "Ranger", "Bard", "Warlock", "Barbarian", "Druid", "Monk", "Sorcerer"].map(cls => {
                      const ct = CLASS_TIPS[cls];
                      return (
                      <div key={cls} onClick={() => handleClassChange(cls)}
                        onMouseEnter={e => { if (ct) showTooltip(<div style={{ background: "#12101f", border: "1px solid #8b5cf655", borderRadius: "8px", padding: "9px 13px", fontSize: "0.76rem", color: "#e2e8f0", lineHeight: 1.55, boxShadow: "0 6px 28px rgba(0,0,0,0.85)", minWidth: "190px", maxWidth: "240px" }}><div style={{ fontWeight: 700, color: "#c4b5fd", marginBottom: "3px" }}>{ct.title}</div><div style={{ color: "#64748b", fontSize: "0.68rem", marginBottom: "5px" }}>Hit Die: {ct.hitDie} · Primary: {ct.primaryStat}</div><div style={{ color: "#94a3b8" }}>{ct.body}</div></div>, e); }}
                        onMouseLeave={hideTooltip}
                        style={{
                          padding: "14px", borderRadius: "8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", fontSize: "0.9rem",
                          border: `1px solid ${draft.class === cls ? "var(--primary)" : "var(--border)"}`,
                          background: draft.class === cls ? "rgba(139,92,246,0.2)" : "transparent",
                        }}>
                        {cls}
                        {SPELLCASTING_CLASSES.has(cls) && <div style={{ fontSize: "0.6rem", color: "#8b5cf6", marginTop: "3px" }}>✦ Spellcaster</div>}
                      </div>
                      );
                    })}
                  </div>

                  {profData && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)", fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.7, display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        <span><strong style={{ color: "#c4b5fd" }}>Saves:</strong> {profData.savingThrows.join(", ")}</span>
                        <span style={{ color: "#374151" }}>|</span>
                        <span><strong style={{ color: "#c4b5fd" }}>Armor:</strong> {profData.armorProficiencies}</span>
                        <span style={{ color: "#374151" }}>|</span>
                        <span><strong style={{ color: "#c4b5fd" }}>Weapons:</strong> {profData.weaponProficiencies}</span>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                          <label style={{ color: "#94a3b8", fontSize: "0.88rem" }}>
                            Choose <strong style={{ color: "white" }}>{profData.skillChoices.count}</strong> Skill Proficiencies
                          </label>
                          <span style={{ fontSize: "0.78rem", fontWeight: "bold", color: draft.skillProficiencies.length === profRequired ? "#22c55e" : "#8b5cf6" }}>
                            {draft.skillProficiencies.length} / {profRequired}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {profData.skillChoices.skills.map(skill => {
                            const selected = draft.skillProficiencies.includes(skill);
                            const disabled = !selected && draft.skillProficiencies.length >= profRequired;
                            return (
                              <div key={skill} onClick={() => toggleSkillProf(skill)}
                                onMouseEnter={e => { const st = SKILL_TIPS[skill]; if (st) showTooltip(tipBox(st.title, st.body), e); }}
                                onMouseLeave={hideTooltip}
                                style={{
                                  padding: "5px 12px", borderRadius: "20px", cursor: disabled ? "not-allowed" : "pointer",
                                  border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                                  background: selected ? "rgba(139,92,246,0.25)" : "transparent",
                                  color: selected ? "white" : disabled ? "#374151" : "#94a3b8",
                                  fontSize: "0.8rem", opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
                                }}>
                                {selected && <span style={{ marginRight: "3px", fontSize: "0.62rem" }}>✓</span>}
                                {skill}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ability Scores */}
              {charStep === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* Method tabs */}
                  <div style={{ display: "flex", gap: "8px", paddingBottom: "14px", borderBottom: "1px solid var(--border)" }}>
                    {(["roll", "array", "pointbuy"] as const).map(method => (
                      <button key={method} onClick={() => handleStatMethodChange(method)} style={{
                        padding: "7px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", transition: "all 0.15s",
                        border: `1px solid ${statMethod === method ? "var(--primary)" : "var(--border)"}`,
                        background: statMethod === method ? "rgba(139,92,246,0.2)" : "transparent",
                        color: statMethod === method ? "white" : "#94a3b8",
                        fontWeight: statMethod === method ? "bold" : "normal",
                      }}>
                        {method === "roll" ? "🎲 Roll" : method === "array" ? "📊 Standard Array" : "🔢 Point Buy"}
                      </button>
                    ))}
                  </div>

                  {/* Roll */}
                  {statMethod === "roll" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                      <div style={{ fontSize: "3.5rem", animation: rolling ? "float 0.5s infinite" : "none" }}>🎲</div>
                      <button className="btn-primary" disabled={rolling} onClick={() => {
                        setRolling(true);
                        setTimeout(() => { setScores(rollAll()); setRolling(false); }, 900);
                      }}>
                        {rolling ? "Rolling…" : "Roll Ability Scores (4d6 drop lowest)"}
                      </button>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                        {(["STR","DEX","CON","INT","WIS","CHA"] as const).map((label, i) => {
                          const sk = (["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const)[i];
                          const val = scores[sk]; const m = Math.floor((val-10)/2);
                          const guide = CLASS_STAT_GUIDES[draft.class]?.[label];
                          const ts = guide ? getTierStyle(guide.tier) : null;
                          return (
                            <div key={label} style={{ position:"relative", padding:"14px 16px", background:"var(--card-bg)", borderRadius:"8px", textAlign:"center", minWidth:"70px", border:`1px solid ${ts ? ts.color+"55":"var(--border)"}` }}
                              onMouseEnter={() => setHoveredStat(label)} onMouseLeave={() => setHoveredStat(null)}>
                              <div style={{ fontSize:"0.7rem", color:"#94a3b8", marginBottom:"4px" }}>{label}</div>
                              <div style={{ fontWeight:"bold", fontSize:"1.3rem" }}>{val}</div>
                              <div style={{ fontSize:"0.75rem", color:m>=0?"#22c55e":"#ef4444" }}>{m>=0?`+${m}`:m}</div>
                              {ts && <div style={{ fontSize:"0.52rem", color:ts.color, marginTop:"4px", fontWeight:"bold" }}>{ts.label.toUpperCase()}</div>}
                              {hoveredStat===label && guide && ts && (
                                <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)", background:"#1a1730", border:`1px solid ${ts.color}66`, borderRadius:"7px", padding:"9px 11px", zIndex:300, width:"170px", pointerEvents:"none", fontSize:"0.72rem", color:"#e2e8f0", lineHeight:1.45, textAlign:"left" }}>
                                  <div style={{ fontWeight:"bold", color:ts.color, marginBottom:"4px" }}>{ts.label} Stat</div>{guide.reason}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p style={{ color:"#475569", fontSize:"0.75rem" }}>Re-roll as many times as you like.</p>
                    </div>
                  )}

                  {/* Standard Array */}
                  {statMethod === "array" && (
                    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                      <p style={{ color:"#94a3b8", fontSize:"0.8rem", textAlign:"center" }}>Click a value, then click a stat to assign it.</p>
                      <div style={{ display:"flex", gap:"10px", justifyContent:"center", flexWrap:"wrap" }}>
                        {STANDARD_ARRAY.map(v => {
                          const isUsed = Object.values(arrayAssignments).includes(v);
                          const isSelected = selectedArrayVal === v;
                          return (
                            <div key={v} onClick={() => handleArrayChipClick(v)} style={{
                              width:"50px", height:"50px", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center",
                              fontWeight:"bold", fontSize:"1.05rem", cursor:isUsed?"default":"pointer", transition:"all 0.15s",
                              border:`2px solid ${isSelected?"var(--primary)":isUsed?"#1e293b":"var(--border)"}`,
                              background:isSelected?"rgba(139,92,246,0.3)":isUsed?"rgba(0,0,0,0.1)":"rgba(0,0,0,0.2)",
                              color:isUsed?"#374151":"white", textDecoration:isUsed?"line-through":"none",
                            }}>{v}</div>
                          );
                        })}
                      </div>
                      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", justifyContent:"center" }}>
                        {(["STR","DEX","CON","INT","WIS","CHA"] as const).map((label, i) => {
                          const sk = (["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const)[i];
                          const assigned = arrayAssignments[sk]; const m = assigned !== null ? Math.floor((assigned-10)/2) : null;
                          return (
                            <div key={label} onClick={() => handleArrayStatClick(sk)} style={{
                              padding:"12px 14px", borderRadius:"8px", textAlign:"center", minWidth:"72px", cursor:"pointer", transition:"all 0.15s",
                              background:assigned!==null?"rgba(139,92,246,0.15)":selectedArrayVal!==null?"rgba(139,92,246,0.05)":"var(--card-bg)",
                              border:`1px solid ${assigned!==null?"var(--primary)":selectedArrayVal!==null?"rgba(139,92,246,0.4)":"var(--border)"}`,
                            }}>
                              <div style={{ fontSize:"0.68rem", color:"#94a3b8", marginBottom:"4px" }}>{label}</div>
                              <div style={{ fontWeight:"bold", fontSize:"1.2rem", color:assigned!==null?"white":"#374151" }}>{assigned??'--'}</div>
                              <div style={{ fontSize:"0.72rem", color:assigned!==null?(m!>=0?"#22c55e":"#ef4444"):"#374151" }}>
                                {assigned!==null?(m!>=0?`+${m}`:m):'··'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p style={{ color:"#64748b", fontSize:"0.78rem", textAlign:"center" }}>
                        {!arrayComplete ? (selectedArrayVal!==null ? `Click a stat to assign ${selectedArrayVal}` : "Click a value to select it") : "✓ All stats assigned"}
                      </p>
                    </div>
                  )}

                  {/* Point Buy */}
                  {statMethod === "pointbuy" && (
                    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                      <div style={{ textAlign:"center" }}>
                        <span style={{ fontSize:"1.1rem", fontWeight:"bold", color:pointsLeft===0?"#22c55e":"#c4b5fd" }}>{pointsLeft}</span>
                        <span style={{ color:"#64748b", fontSize:"0.82rem" }}> / {POINT_BUY_BUDGET} points remaining</span>
                      </div>
                      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", justifyContent:"center" }}>
                        {(["STR","DEX","CON","INT","WIS","CHA"] as const).map((label, i) => {
                          const sk = (["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const)[i];
                          const val = scores[sk]; const m = Math.floor((val-10)/2);
                          const incCost = (POINT_BUY_COST[val+1]??99)-(POINT_BUY_COST[val]??0);
                          const canInc = val < 15 && pointsLeft >= incCost;
                          const canDec = val > 8;
                          return (
                            <div key={label} style={{ padding:"12px 10px", background:"var(--card-bg)", borderRadius:"8px", textAlign:"center", minWidth:"82px", border:"1px solid var(--border)" }}>
                              <div style={{ fontSize:"0.68rem", color:"#94a3b8", marginBottom:"8px" }}>{label}</div>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                                <button onClick={() => adjustPBStat(sk,-1)} disabled={!canDec} style={{ width:"22px", height:"22px", borderRadius:"6px", border:"1px solid var(--border)", background:canDec?"rgba(139,92,246,0.15)":"transparent", color:canDec?"white":"#374151", cursor:canDec?"pointer":"not-allowed", fontWeight:"bold", fontSize:"0.9rem" }}>−</button>
                                <span style={{ fontWeight:"bold", fontSize:"1.2rem", minWidth:"22px" }}>{val}</span>
                                <button onClick={() => adjustPBStat(sk,1)} disabled={!canInc} style={{ width:"22px", height:"22px", borderRadius:"6px", border:"1px solid var(--border)", background:canInc?"rgba(139,92,246,0.15)":"transparent", color:canInc?"white":"#374151", cursor:canInc?"pointer":"not-allowed", fontWeight:"bold", fontSize:"0.9rem" }}>+</button>
                              </div>
                              <div style={{ fontSize:"0.72rem", color:m>=0?"#22c55e":"#ef4444", marginTop:"6px" }}>{m>=0?`+${m}`:m}</div>
                              <div style={{ fontSize:"0.6rem", color:"#475569", marginTop:"2px" }}>{POINT_BUY_COST[val]}pt{POINT_BUY_COST[val]!==1?"s":""}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {draft.class && (
                    <p style={{ color:"#475569", fontSize:"0.78rem", textAlign:"center" }}>
                      Level 1 HP: <strong style={{ color:"white" }}>{startingHP(draft.class, effectiveScores().constitution)}</strong>
                      {" "}(d{CLASS_HIT_DIE[draft.class]??8} + CON mod)
                    </p>
                  )}
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

                  {/* Shield — only for proficient classes */}
                  {SHIELD_CLASSES.has(draft.class) && (
                    <div>
                      <label style={{ display: "block", marginBottom: "10px", color: "#94a3b8" }}>Shield</label>
                      <div
                        onClick={() => setDraft(d => ({ ...d, shield: !d.shield }))}
                        style={{
                          display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s",
                          border: `1px solid ${draft.shield ? "var(--primary)" : "var(--border)"}`,
                          background: draft.shield ? "rgba(139,92,246,0.2)" : "transparent",
                        }}
                      >
                        <span style={{ fontSize: "1.5rem" }}>🛡</span>
                        <div>
                          <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>Shield <span style={{ color: "#22c55e", fontSize: "0.8rem" }}>+2 AC</span></div>
                          <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Requires one free hand — pairs well with one-handed weapons</div>
                        </div>
                        <div style={{ marginLeft: "auto", width: "20px", height: "20px", borderRadius: "50%", border: `2px solid ${draft.shield ? "var(--primary)" : "var(--border)"}`, background: draft.shield ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.7rem" }}>
                          {draft.shield && "✓"}
                        </div>
                      </div>
                    </div>
                  )}

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

              {/* Character Background */}
              {charStep === 5 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)", fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.65 }}>
                    <strong style={{ color: "#c4b5fd", display: "block", marginBottom: "4px" }}>Optional — skip to continue.</strong>
                    The DM and portrait artist will use this backstory to shape your character&apos;s story and portrait.
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", color: "#94a3b8" }}>
                      Character Background <span style={{ fontSize: "0.7rem", color: "#475569" }}>(optional)</span>
                    </label>
                    <textarea
                      value={draft.charBackground} rows={6} maxLength={500}
                      onChange={e => setDraft(d => ({ ...d, charBackground: e.target.value }))}
                      placeholder="e.g. A wandering mercenary haunted by a betrayal. They carry a broken medallion — once a symbol of their old order, now a reminder of who they used to be..."
                      style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", color: "white", fontSize: "0.9rem", lineHeight: 1.6, resize: "vertical", fontFamily: "inherit" }}
                    />
                    <p style={{ color: "#374151", fontSize: "0.7rem", textAlign: "right", marginTop: "4px" }}>{draft.charBackground.length} / 500</p>
                  </div>
                </div>
              )}

              {/* Spells */}
              {charStep === 6 && isSpellcaster && (
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
                        {!c.rosterId && c.shield && " · 🛡 Shield"}
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

        {/* ── Footer navigation (hidden on count phase and charStep 1 — buttons are inline there) ── */}
        {((phase === "characters" && charStep > 1) || phase === "review") && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
            <button className="btn-secondary" onClick={handleBack}>
              Back
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
      {TooltipPortal}
    </main>
  );
}
