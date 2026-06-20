"use client";

import { useState, useEffect } from "react";
import { getTheme, onThemeChange, type Theme } from "../../lib/theme";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { sanitizeCharacterName, characterNameError } from "../../lib/nameValidation";
import "../globals.css";
import { getSpellCounts } from "../../lib/spellData";
import { computeInventoryBonuses } from "../../lib/lootData";
import { initObjectives } from "../../lib/objectives";
import { CLASS_PROFICIENCIES } from "../../lib/proficiencyData";
import { armorInventoryEntry, findEquippedArmor } from "../../lib/equipmentData";
import { useTooltip, tipBox } from "../../hooks/useTooltip";
import { CharacterSteps, isRollUnrolled, UNROLLED_SCORES, type CharForm } from "../../components/CharacterSteps";
import { STAT_TIPS } from "../../lib/tooltipData";

// ── Types ──────────────────────────────────────────────────────────────────────
type AbilityScores = {
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
};
type StatMethod = "roll" | "array" | "pointbuy";
type CharDraft = {
  name: string; title: string; race: string; sex: string; class: string; alignment: string;
  weapon: string; offHand: string; armor: string; trinket: string; shield: boolean; charBackground: string;
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
const CLASS_COLORS: Record<string, string> = {
  Fighter: "#ef4444", Wizard: "#3b82f6", Rogue: "var(--subtle)", Cleric: "#f59e0b",
  Paladin: "#fbbf24", Ranger: "#22c55e", Bard: "#ec4899", Warlock: "#a78bfa",
  Barbarian: "#f97316", Druid: "#84cc16", Monk: "#06b6d4", Sorcerer: "#8b5cf6",
};
const CLASS_EMOJI: Record<string, string> = {
  Fighter: "⚔️", Wizard: "🔮", Rogue: "🗡️", Cleric: "✨",
  Paladin: "🛡️", Ranger: "🏹", Bard: "🎵", Warlock: "💀",
  Barbarian: "🪓", Druid: "🌿", Monk: "👊", Sorcerer: "🌀",
};
const WEAPON_EMOJI: Record<string, string> = {
  "Longsword": "⚔️", "Shortbow": "🏹", "Staff": "🔮",
  "Daggers (x2)": "🗡️", "Warhammer": "🔨", "Crossbow": "🎯",
};
const STEP_ICONS = ["🧑", "⚔️", "🎲", "🗡️", "📜", "✨"];
const PLAYER_COUNT_NAMES = ["Solo", "Duo", "Trio", "Party", "Company", "Band", "Warband", "Brigade", "Legion", "Army"];

// Inline d20 — matches the create-character step 1 heading mark so the
// Identity & Origins step looks identical across the two flows.
function D20Icon({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', margin: '0 auto', filter: 'drop-shadow(0 4px 12px rgba(139,92,246,0.5))' }}>
      <defs>
        <linearGradient id="d20BodyCamp" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id="d20FaceCamp" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M76,14 L92,64 L50,94 L8,64 L24,14 Z" fill="url(#d20BodyCamp)" stroke="#e9d5ff" strokeWidth="1.4" />
      <path d="M50,50 L27,43 L50,26 Z" fill="#c4b5fd" opacity="0.95" />
      <path d="M50,50 L50,26 L73,43 Z" fill="#a78bfa" opacity="0.85" />
      <path d="M50,50 L73,43 L64,69 Z" fill="#8b5cf6" opacity="0.8" />
      <path d="M50,50 L36,69 L27,43 Z" fill="#9333ea" opacity="0.8" />
      <path d="M50,50 L64,69 L36,69 Z" fill="url(#d20FaceCamp)" />
      <g stroke="#ede9fe" strokeWidth="0.9" fill="none" opacity="0.55">
        <path d="M50,50 L50,26" /><path d="M50,50 L73,43" /><path d="M50,50 L64,69" /><path d="M50,50 L36,69" /><path d="M50,50 L27,43" />
        <path d="M50,26 L73,43" /><path d="M73,43 L64,69" /><path d="M64,69 L36,69" /><path d="M36,69 L27,43" /><path d="M27,43 L50,26" />
        <path d="M24,14 L76,14" /><path d="M76,14 L92,64" /><path d="M92,64 L50,94" /><path d="M50,94 L8,64" /><path d="M8,64 L24,14" />
      </g>
      <text x="50" y="64" textAnchor="middle" fontSize="22" fontWeight="800" fill="#fef9c3" stroke="#4c1d95" strokeWidth="0.4" fontFamily="system-ui, sans-serif">20</text>
    </svg>
  );
}

// Ability Scores reference legend — sourced from create-character so the two
// flows surface the same scan-able primer.
const STAT_LEGEND_CAMP: { code: string; line: string; color: string }[] = [
  { code: 'STR', line: 'Power, melee hits, carry weight',   color: '#ef4444' },
  { code: 'DEX', line: 'Agility, ranged hits, AC, stealth', color: '#22c55e' },
  { code: 'CON', line: 'Toughness, max HP, concentration',  color: '#f97316' },
  { code: 'INT', line: 'Reasoning, Arcana, Wizard magic',   color: '#3b82f6' },
  { code: 'WIS', line: 'Perception, Cleric & Druid magic',  color: '#eab308' },
  { code: 'CHA', line: 'Presence, Bard/Sorcerer/Warlock',   color: '#ec4899' },
];

// Fresh characters open on the Roll tab, so the grid starts on the shared
// "unrolled" sentinel (all zeros → renders as dashes) instead of a seeded
// spread that would look like Standard Array before any dice are thrown.
const DEFAULT_SCORES: AbilityScores = { ...UNROLLED_SCORES };

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
    weapon: "", offHand: "", armor: "", trinket: "", shield: false, charBackground: "",
    scores: DEFAULT_SCORES, cantrips: [], spells: [], skillProficiencies: [],
  };
}

// ── Wizard ────────────────────────────────────────────────────────────────────
// The per-character creation UI is the shared <CharacterSteps> component
// (src/components/CharacterSteps.tsx) — the single source of truth, also used by
// /create-character. This file only wraps it with campaign + multi-player chrome.
export default function CreateCampaignWizard() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("count");
  // SSR-stable default first (avoids the data-theme hydration mismatch), then
  // apply the saved theme on mount so the global toggle flips in one click.
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { setTheme(getTheme()); return onThemeChange(setTheme); }, []);
  const [playerCount, setPlayerCount] = useState(1);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [charStep, setCharStep] = useState(1);
  const [draft, setDraft] = useState<CharDraft>(emptyDraft());
  const [scores, setScores] = useState<AbilityScores>(DEFAULT_SCORES);
  const [selectedCantrips, setSelectedCantrips] = useState<string[]>([]);
  const [selectedSpells, setSelectedSpells] = useState<string[]>([]);
  const [charNameErr, setCharNameErr] = useState("");

  // Stat method state (resets per character)
  const [statMethod, setStatMethod] = useState<StatMethod>("roll");
  const [completedChars, setCompletedChars] = useState<CharDraft[]>([]);
  const [rosterChars, setRosterChars] = useState<RosterChar[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  const { showTooltip, hideTooltip, TooltipPortal } = useTooltip();

  // Adapter: map this wizard's split working state <-> the shared CharForm so the
  // single-source-of-truth <CharacterSteps> drives the per-player draft.
  const form: CharForm = {
    name: draft.name, title: draft.title, race: draft.race, class: draft.class, sex: draft.sex,
    alignment: draft.alignment, weapon: draft.weapon, offHand: draft.offHand, armor: draft.armor, trinket: draft.trinket, shield: draft.shield,
    background: draft.charBackground, skillProficiencies: draft.skillProficiencies,
    scores, statMethod, cantrips: selectedCantrips, spells: selectedSpells,
  };
  const patch = (p: Partial<CharForm>) => {
    setDraft(d => ({ ...d,
      ...(p.name !== undefined ? { name: p.name } : {}),
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.race !== undefined ? { race: p.race } : {}),
      ...(p.class !== undefined ? { class: p.class } : {}),
      ...(p.sex !== undefined ? { sex: p.sex } : {}),
      ...(p.alignment !== undefined ? { alignment: p.alignment } : {}),
      ...(p.weapon !== undefined ? { weapon: p.weapon } : {}),
      ...(p.offHand !== undefined ? { offHand: p.offHand } : {}),
      ...(p.armor !== undefined ? { armor: p.armor } : {}),
      ...(p.trinket !== undefined ? { trinket: p.trinket } : {}),
      ...(p.shield !== undefined ? { shield: p.shield } : {}),
      ...(p.background !== undefined ? { charBackground: p.background } : {}),
      ...(p.skillProficiencies !== undefined ? { skillProficiencies: p.skillProficiencies } : {}),
    }));
    if (p.scores !== undefined) setScores(p.scores);
    if (p.statMethod !== undefined) setStatMethod(p.statMethod);
    if (p.cantrips !== undefined) setSelectedCantrips(p.cantrips);
    if (p.spells !== undefined) setSelectedSpells(p.spells);
  };

  const spellCounts       = getSpellCounts(draft.class, scores);
  // Half-casters (Paladin/Ranger) have no L1 spells — skip the spell step at creation.
  const isSpellcaster     = spellCounts.cantrips > 0 || spellCounts.spells > 0;
  const totalCharSteps    = isSpellcaster ? 6 : 5;

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
    setCharStep(1);
    setCharNameErr("");
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
  // The unified grid keeps `scores` as the effective set for every source.
  const effectiveScores = (): AbilityScores => scores;
  const profData        = draft.class ? CLASS_PROFICIENCIES[draft.class] : null;
  const profRequired    = profData?.skillChoices.count ?? 0;

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
      offHand: char.inventory?.weapons?.[1] ?? "",
      armor: findEquippedArmor((char.inventory?.items ?? []).join(" "))?.name ?? "",
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
        const nameErr = characterNameError(draft.name);
        if (nameErr) { setCharNameErr(nameErr); return; }
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
        { const pc = getSpellCounts(prevDraft.class, prevDraft.scores); setCharStep(pc.cantrips > 0 || pc.spells > 0 ? 6 : 5); }
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
        { const lc = getSpellCounts(lastDraft.class, lastDraft.scores); setCharStep(lc.cantrips > 0 || lc.spells > 0 ? 6 : 5); }
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
      const { title: aiTitle, description: aiDescription, objectives: aiObjectives } = genRes.ok
        ? await genRes.json()
        : { title: "Shadows of the Forgotten Realm", description: "A perilous adventure awaits.", objectives: [] };

      const { data: campData, error: campErr } = await supabase
        .from("campaigns")
        .insert([{ title: aiTitle, description: aiDescription, user_id: user.id }])
        .select().single();
      if (campErr || !campData) throw campErr ?? new Error("Campaign creation failed");

      // Persist the ordered quest spine (first objective active, rest hidden).
      // AWAIT it so the first objective is committed BEFORE we navigate into the
      // campaign — the party must have a goal in the tracker before the first turn.
      // Error-tolerant: a missing `objectives` column (migration not yet applied)
      // logs a warning but never blocks campaign creation. Null-safe downstream.
      const objectives = initObjectives(aiObjectives);
      if (objectives.length) {
        const { error: objErr } = await supabase.from("campaigns").update({ objectives }).eq("id", campData.id);
        if (objErr) console.warn("[campaign] objectives not saved (migration pending?):", objErr.message);
      }

      const newChars    = completedChars.filter(c => !c.rosterId);
      const rosterPicks = completedChars.filter(c => !!c.rosterId);

      let newCharData: { id: string }[] = [];
      if (newChars.length > 0) {
        const rows = newChars.map(c => {
          const weapons = [c.weapon || "Iron Dagger", ...(c.offHand ? [c.offHand] : [])];
          const items   = ["Bedroll", "Rations (5 days)", armorInventoryEntry(c.armor), ...(c.shield ? ["Shield"] : []), ...(c.trinket.trim() ? [c.trinket.trim()] : [])];
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
          const weapons = [c.weapon || "Iron Dagger", ...(c.offHand ? [c.offHand] : [])];
          const items   = ["Bedroll", "Rations (5 days)", armorInventoryEntry(c.armor), ...(c.shield ? ["Shield"] : []), ...(c.trinket.trim() ? [c.trinket.trim()] : [])];
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
    (phase === "characters" && charStep === 3 && isRollUnrolled(form)) ||
    (phase === "characters" && charStep === 4 && !draft.weapon);

  const stepTitle =
    phase === "count"      ? "How Many Adventurers?" :
    phase === "characters" ? ["Identity & Origins", "Class & Proficiencies", "Ability Scores", "Starting Equipment", "Character Background", "Spells & Cantrips"][charStep - 1] :
    phase === "review"     ? "Ready to Begin" :
    "Forging your world…";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <main className="themed-page" data-theme={theme} style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "clamp(20px, 3vw, 40px) clamp(12px, 2vw, 20px)", background: "radial-gradient(ellipse 70% 55% at 50% 40%, rgba(139,92,246,0.09) 0%, transparent 70%), var(--canvas-bg)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "24px", width: "100%", maxWidth: "1280px", justifyContent: "center", flexWrap: "wrap" }}>

      {/* Left rail — Ability Score legend (sticky, always visible on wide
          viewports). Hides below 900px so phones / Xbox at narrow widths get
          the form full-width. Mirrors create-character so the layouts feel
          like the same product. */}
      {phase === "characters" && (
        <aside className="hide-on-narrow-camp" style={{ width: "220px", flexShrink: 0, position: "sticky", top: "40px" }}>
          <div className="glass-panel" style={{ padding: "20px 18px" }}>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "4px" }}>Reference</div>
            <h3 style={{ fontSize: "1rem", margin: 0, marginBottom: "14px", color: "var(--foreground)", fontWeight: 600 }}>Ability Scores</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {STAT_LEGEND_CAMP.map(s => {
                const t = STAT_TIPS[s.code];
                return (
                  <div key={s.code}
                    onMouseEnter={e => { if (t) showTooltip(tipBox(t.title, t.body, s.color), e); }}
                    onMouseLeave={hideTooltip}
                    style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "8px 10px", borderRadius: "8px", background: "var(--inset-bg)", border: `1px solid ${s.color}33`, cursor: "help", transition: "border-color 0.15s, background 0.15s" }}
                    onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${s.color}88`; (e.currentTarget as HTMLDivElement).style.background = "var(--inset-bg)"; }}
                    onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${s.color}33`; (e.currentTarget as HTMLDivElement).style.background = "var(--inset-bg)"; }}
                  >
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: s.color, letterSpacing: "0.05em" }}>{s.code}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--subtle)", lineHeight: 1.35 }}>{s.line}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: "14px", padding: "8px 10px", borderRadius: "8px", background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.25)", fontSize: "0.68rem", color: "var(--accent-strong)", lineHeight: 1.45, cursor: "help" }}
              onMouseEnter={e => showTooltip(tipBox("Ability Modifier", "Your modifier = (score − 10) ÷ 2, rounded down. Added to every roll made with that ability (attack, save, skill check).", "#c4b5fd"), e)}
              onMouseLeave={hideTooltip}>
              <strong style={{ color: "var(--accent-strong)" }}>Modifier:</strong> (score − 10) ÷ 2, rounded down. Hover for details.
            </div>
          </div>
        </aside>
      )}
      <style>{`@media (max-width: 900px) { .hide-on-narrow-camp { display: none !important; } }`}</style>

      <div className="glass-panel" style={{ flex: "1 1 0", minWidth: 0, maxWidth: "1020px", padding: "clamp(24px, 4vw, 52px) clamp(20px, 4vw, 56px)", position: "relative" }}>

        {/* ── Top progress ── */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "1.1rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {phase === "characters" ? `Player ${currentPlayerIdx + 1} of ${playerCount}` :
               phase === "creating"   ? "The DM is forging your world…" : "Campaign Setup"}
            </span>
            <span style={{ fontSize: "1rem", color: "#475569" }}>{Math.round(progressPct)}%</span>
          </div>
          <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, var(--primary), #7c3aed)", borderRadius: "3px", transition: "width 0.5s ease", boxShadow: "0 0 10px rgba(139,92,246,0.6)" }} />
          </div>
        </div>

        {/* ── Numbered step circles — matches create-character stepper ── */}
        {phase === "characters" && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px", position: "relative", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "2px", zIndex: 0,
              background: `linear-gradient(90deg, var(--primary) ${Math.max(0, ((charStep - 1) / (totalCharSteps - 1)) * 100)}%, var(--border) ${Math.max(0, ((charStep - 1) / (totalCharSteps - 1)) * 100)}%)`,
            }} />
            {Array.from({ length: totalCharSteps }, (_, i) => i + 1).map(i => {
              const done = charStep > i; const active = charStep === i;
              return (
                <div key={i} style={{
                  width: "clamp(32px, 3.5vw, 46px)", height: "clamp(32px, 3.5vw, 46px)", borderRadius: "50%",
                  background: done ? "linear-gradient(135deg, var(--primary), #6d28d9)" : active ? "rgba(139,92,246,0.22)" : "var(--card-bg)",
                  border: `2px solid ${charStep >= i ? "var(--primary)" : "var(--border)"}`,
                  boxShadow: done ? "0 0 16px rgba(139,92,246,0.6)" : active ? "0 0 10px rgba(139,92,246,0.35), 0 0 0 3px rgba(139,92,246,0.12)" : "none",
                  display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1,
                  color: charStep >= i ? "white" : "#475569", fontWeight: "bold", fontSize: done ? "0.82rem" : "1rem", transition: "all 0.3s",
                }}>{done ? "✓" : i}</div>
              );
            })}
          </div>
        )}

        {/* ── Title — D20Icon for step 1 of character builder, matching create-character ── */}
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          <div style={{ fontSize: "2.6rem", marginBottom: "8px", lineHeight: 1, display: "flex", justifyContent: "center" }}>
            {phase === "characters" && charStep === 1
              ? <D20Icon size={58} />
              : phase === "count" ? "⚔️"
              : phase === "characters" ? <span>{STEP_ICONS[charStep - 1]}</span>
              : phase === "review" ? "🏰"
              : "✨"}
          </div>
          <h1 className="shimmer-heading" style={{ fontSize: "2.6rem", marginBottom: 0 }}>{stepTitle}</h1>
          <div style={{ height: "1px", width: "80px", background: "linear-gradient(90deg, transparent, var(--primary), transparent)", margin: "10px auto 0" }} />
        </div>
        {phase === "characters" && (
          <div style={{ textAlign: "center", marginBottom: charStep === 1 ? "16px" : "28px" }}>
            <p style={{ color: "var(--muted)", fontSize: "1.2rem", marginBottom: currentPlayerIdx === 0 && charStep === 1 ? "8px" : "0" }}>
              Building <strong style={{ color: "var(--primary)" }}>
                {draft.name.trim() || `Player ${currentPlayerIdx + 1}`}
              </strong>'s character
            </p>
            {currentPlayerIdx === 0 && charStep === 1 && (
              <p style={{ fontSize: "1rem", color: "#475569", display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "20px", padding: "3px 12px" }}>
                👑 <span>Player 1&apos;s character becomes the <strong style={{ color: "var(--accent-strong)" }}>Party Leader</strong> — they lead and manage the party</span>
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
              <p style={{ color: "var(--subtle)", textAlign: "center", fontSize: "1rem", maxWidth: "480px" }}>
                Each adventurer can create a new character or select one from their existing roster.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px", width: "100%", maxWidth: "620px" }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <div key={n} onClick={() => setPlayerCount(n)} style={{
                    padding: "26px 10px", borderRadius: "14px", textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                    border: `2px solid ${playerCount === n ? "var(--primary)" : "var(--border)"}`,
                    background: playerCount === n ? "rgba(139,92,246,0.2)" : "var(--inset-bg)",
                    transform: playerCount === n ? "translateY(-4px)" : "none",
                    boxShadow: playerCount === n ? "0 8px 28px rgba(139,92,246,0.4)" : "none",
                  }}>
                    <div style={{ fontSize: "2rem", fontWeight: "bold", color: playerCount === n ? "var(--primary)" : "var(--foreground)", lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: "1rem", color: playerCount === n ? "var(--accent-strong)" : "var(--muted)", marginTop: "6px", fontWeight: playerCount === n ? 700 : 400, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {PLAYER_COUNT_NAMES[n - 1]}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ color: "#475569", fontSize: "1.05rem" }}>
                {playerCount === 1 ? "A solo adventure — you control your hero." :
                 `You'll set up ${playerCount} characters, one per adventurer.`}
              </p>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "14px 18px", borderRadius: "10px", background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)", maxWidth: "480px", textAlign: "left" }}>
                <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: "1px" }}>💡</span>
                <div style={{ fontSize: "1.05rem", color: "var(--subtle)", lineHeight: 1.65 }}>
                  <strong style={{ color: "var(--accent-strong)", display: "block", marginBottom: "3px" }}>Set this to everyone at the table today.</strong>
                  Pick one character per adventurer — everyone plays together from the same screen.
                </div>
              </div>
            </div>
          )}

          {/* Character creation */}
          {phase === "characters" && (
            <div className="animate-fade-in">
              {charStep === 1 ? (
                <div style={{ display: "flex", gap: "clamp(16px, 2vw, 28px)", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 480px", minWidth: 0 }}>
                    <CharacterSteps step={1} form={form} patch={patch} showTooltip={showTooltip} hideTooltip={hideTooltip} nameError={charNameErr} setNameError={setCharNameErr} onGuideRestart={resetCurrentChar} />
                  </div>
                  {/* Roster import — create-campaign-specific chrome around the shared identity step */}
                  {(rosterLoading || availableRoster.length > 0) && (
                    <div style={{ flex: "0 1 220px", minWidth: "180px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <p style={{ fontSize: "1rem", color: "#fbbf24", fontWeight: "bold", letterSpacing: "0.03em", lineHeight: 1.4 }}>
                        📜 Import from Roster
                        <span style={{ display: "block", color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>Click a character to skip creation</span>
                      </p>
                      {rosterLoading ? (
                        <div style={{ padding: "12px 0", textAlign: "center", fontSize: "1.05rem", color: "#475569" }}>Loading…</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "380px", overflowY: "auto", paddingRight: "2px" }}>
                          {availableRoster.map(c => {
                            const hpPct = Math.max(0, Math.min(100, (c.hp / Math.max(1, c.max_hp)) * 100));
                            const hpCol = hpPct > 60 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";
                            const classColor = ({ Fighter:"#ef4444",Wizard:"#3b82f6",Rogue:"var(--subtle)",Cleric:"#f59e0b",Paladin:"#fbbf24",Ranger:"#22c55e",Bard:"#ec4899",Warlock:"#a78bfa",Barbarian:"#f97316",Druid:"#84cc16",Monk:"#06b6d4",Sorcerer:"#8b5cf6" } as Record<string,string>)[c.class] ?? "var(--accent-strong)";
                            return (
                              <div key={c.id} onClick={() => selectRosterChar(c)}
                                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)", cursor: "pointer", transition: "all 0.18s", userSelect: "none" }}
                                onMouseEnter={e => { e.currentTarget.style.border = "1px solid rgba(245,158,11,0.55)"; e.currentTarget.style.background = "rgba(245,158,11,0.1)"; e.currentTarget.style.transform = "translateX(-2px)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(245,158,11,0.12)"; }}
                                onMouseLeave={e => { e.currentTarget.style.border = "1px solid rgba(245,158,11,0.2)"; e.currentTarget.style.background = "rgba(245,158,11,0.04)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                                <div style={{ width: "56px", height: "56px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${classColor}`, boxShadow: `0 0 10px ${classColor}44`, background: "rgba(0,0,0,0.5)", flexShrink: 0 }}>
                                  {c.portrait_url
                                    ? <img src={c.portrait_url} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                                    : <div style={{ width: "100%", height: "100%", background: `${classColor}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>🧙</div>
                                  }
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: "1.05rem", fontWeight: "bold", color: classColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                                  <div style={{ fontSize: "1.2rem", color: "var(--muted)", marginBottom: "3px" }}>{c.race} {c.class}</div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                    <span style={{ fontSize: "1.15rem", fontWeight: "bold", color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "8px", padding: "1px 5px" }}>Lvl {c.level}</span>
                                    <span style={{ fontSize: "1.2rem", color: hpCol }}>{c.hp}/{c.max_hp} HP</span>
                                  </div>
                                  {c.campaign_id && <div style={{ fontSize: "1.15rem", color: "#475569", marginTop: "2px" }}>In campaign</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <CharacterSteps step={charStep} form={form} patch={patch} showTooltip={showTooltip} hideTooltip={hideTooltip} nameError={charNameErr} setNameError={setCharNameErr} onGuideRestart={resetCurrentChar} />
              )}
            </div>
          )}

          {/* Party review */}
          {phase === "review" && (
            <div className="animate-fade-in">
              <p style={{ textAlign: "center", color: "var(--subtle)", marginBottom: "24px", fontSize: "1.15rem" }}>
                Your party is assembled. The DM will name your campaign upon launch.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: completedChars.length === 1 ? "1fr" : "1fr 1fr", gap: "14px" }}>
                {completedChars.map((c, i) => {
                  const clsColor = CLASS_COLORS[c.class] ?? "#8b5cf6";
                  const rChar = c.rosterId ? rosterChars?.find(r => r.id === c.rosterId) : null;
                  const portraitUrl = rChar?.portrait_url ?? null;
                  return (
                  <div key={i} className="glass-panel" style={{ padding: "18px 16px", display: "flex", gap: "14px", alignItems: "center", border: `1px solid ${clsColor}33`, boxShadow: `0 4px 24px ${clsColor}18` }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "10px", background: clsColor + "1a", border: `1px solid ${clsColor}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                      {portraitUrl
                        ? <img src={portraitUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
                        : <span style={{ fontSize: "1.6rem" }}>{CLASS_EMOJI[c.class] ?? "🧙"}</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: "bold", fontSize: "1.2rem", color: "var(--foreground)" }}>{c.name}</div>
                      <div style={{ color: clsColor, fontSize: "1rem", fontWeight: 600, marginTop: "1px" }}>{c.race} {c.class} · {c.rosterId ? `Level ${c.rosterLevel}` : "Lv 1"}</div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "5px" }}>
                        <span style={{ fontSize: "1rem", color: "var(--subtle)", background: "rgba(255,255,255,0.06)", borderRadius: "6px", padding: "1px 7px" }}>
                          ❤ {c.rosterId ? c.rosterMaxHp : startingHP(c.class, c.scores.constitution)} HP
                        </span>
                        {!c.rosterId && <span style={{ fontSize: "1rem", color: "var(--subtle)", background: "rgba(255,255,255,0.06)", borderRadius: "6px", padding: "1px 7px" }}>{WEAPON_EMOJI[c.weapon] ?? "⚔️"} {c.weapon || "Iron Dagger"}</span>}
                        {c.cantrips.length > 0 && <span style={{ fontSize: "1rem", color: "#8b5cf6", background: "rgba(139,92,246,0.1)", borderRadius: "6px", padding: "1px 7px" }}>✨ {c.cantrips.length} cantrip{c.cantrips.length > 1 ? "s" : ""}</span>}
                        {c.rosterId && <span style={{ fontSize: "1.2rem", color: "#fbbf24", background: "rgba(251,191,36,0.1)", borderRadius: "6px", padding: "1px 7px" }}>📜 Returning</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: "1.4rem", opacity: 0.4 }}>{i === 0 ? "👑" : ""}</div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Creating state */}
          {phase === "creating" && (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px", height: "280px", background: "radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, transparent 70%)", borderRadius: "12px" }}>
              <div style={{ fontSize: "4rem", animation: "float 1.2s ease-in-out infinite", filter: "drop-shadow(0 0 24px rgba(139,92,246,0.7))" }}>⚔️</div>
              <div style={{ textAlign: "center" }}>
                <p className="shimmer-heading" style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "8px" }}>The DM is forging your world…</p>
                <p style={{ color: "var(--muted)", fontSize: "1.05rem" }}>Naming your campaign and preparing the stage</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--primary)", animation: `blink 1.2s step-end ${i * 0.4}s infinite`, boxShadow: "0 0 8px rgba(139,92,246,0.8)" }} />
                ))}
              </div>
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
      </div>
      {TooltipPortal}
    </main>
  );
}
