"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../globals.css';

import { supabase } from '../../lib/supabaseClient';
import { sanitizeCharacterName, characterNameError } from '../../lib/nameValidation';
import {
  CANTRIPS, LEVEL1_SPELLS, SPELL_LIMITS, SPELLCASTING_CLASSES,
  getSpellCounts, CLASS_STAT_GUIDES, getTierStyle, type SpellEntry,
} from '../../lib/spellData';
import {
  CLASS_PROFICIENCIES, STANDARD_ARRAY, POINT_BUY_COST, POINT_BUY_BUDGET, calcPointBuyCost,
} from '../../lib/proficiencyData';
import { useTooltip, tipBox, tipBoxNode } from '../../hooks/useTooltip';
import { STAT_TIPS, RACE_TIPS, CLASS_TIPS, ALIGNMENT_TIPS, SKILL_TIPS, STAT_METHOD_TIPS, PROF_TIPS, WEAPON_TIPS, MECHANIC_TIPS, SPELL_SCHOOL_TIPS, ARRAY_VALUE_TIPS } from '../../lib/tooltipData';

type AbilityScores = {
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
};

type StatMethod = 'roll' | 'array' | 'pointbuy';

function roll4d6DropLowest(): number {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => a - b);
  return rolls.slice(1).reduce((a, b) => a + b, 0);
}

function rollAbilityScores(): AbilityScores {
  return {
    strength: roll4d6DropLowest(), dexterity: roll4d6DropLowest(),
    constitution: roll4d6DropLowest(), intelligence: roll4d6DropLowest(),
    wisdom: roll4d6DropLowest(), charisma: roll4d6DropLowest(),
  };
}

function playDiceRollSound() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
    const ctx = new Ctx();
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * 0.55), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass"; bpf.frequency.value = 580; bpf.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    src.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + 0.55);
  } catch { /* AudioContext unavailable */ }
}

const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
};

function startingHP(cls: string, con: number): number {
  return Math.max(1, (CLASS_HIT_DIE[cls] ?? 8) + Math.floor((con - 10) / 2));
}

const DEFAULT_SCORES: AbilityScores = {
  strength: 15, dexterity: 14, constitution: 13,
  intelligence: 12, wisdom: 10, charisma: 8,
};

const POINTBUY_DEFAULT: AbilityScores = {
  strength: 8, dexterity: 8, constitution: 8,
  intelligence: 8, wisdom: 8, charisma: 8,
};

const ALIGNMENTS = [
  { key: "Lawful Good",     short: "LG", desc: "Upholds justice and protects the innocent. A champion of order and virtue." },
  { key: "Neutral Good",    short: "NG", desc: "Does what is good without preference for order or chaos. A healer or helper." },
  { key: "Chaotic Good",    short: "CG", desc: "Acts on conscience with little regard for rules. A rebel with a good heart." },
  { key: "Lawful Neutral",  short: "LN", desc: "Follows rules and tradition above all else, without strong moral bias." },
  { key: "True Neutral",    short: "TN", desc: "Avoids taking strong moral or ethical stances. Seeks balance in all things." },
  { key: "Chaotic Neutral", short: "CN", desc: "Follows whims and personal freedom above all laws or moral codes." },
  { key: "Lawful Evil",     short: "LE", desc: "Methodically pursues evil goals through discipline and rigid structure." },
  { key: "Neutral Evil",    short: "NE", desc: "Does whatever it can get away with, without remorse or allegiance." },
  { key: "Chaotic Evil",    short: "CE", desc: "Acts with arbitrary violence and malice, driven purely by destruction." },
] as const;

// Tooltip data imported from shared lib (RACE_TIPS, CLASS_TIPS, etc.)

const STAT_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
const STAT_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

const RACE_EMOJI: Record<string, string> = {
  Human: "⚔", Elf: "🌙", Dwarf: "🪨", Halfling: "🌿",
  Dragonborn: "🐉", Tiefling: "🔥", Gnome: "🔮", "Half-Elf": "✦", "Half-Orc": "💪",
};
const CLASS_COLORS: Record<string, string> = {
  Fighter: "#ef4444", Wizard: "#3b82f6", Rogue: "#94a3b8", Cleric: "#f59e0b",
  Paladin: "#fbbf24", Ranger: "#22c55e", Bard: "#ec4899", Warlock: "#a78bfa",
  Barbarian: "#f97316", Druid: "#84cc16", Monk: "#06b6d4", Sorcerer: "#8b5cf6",
};
const CLASS_EMOJI: Record<string, string> = {
  Fighter: "⚔️", Wizard: "🔮", Rogue: "🗡️", Cleric: "✨",
  Paladin: "🛡️", Ranger: "🏹", Bard: "🎵", Warlock: "💀",
  Barbarian: "🪓", Druid: "🌿", Monk: "👊", Sorcerer: "🌀",
};
// Static example portraits used as class icons on the class-select step. Generated once
// via scripts/generate-class-portraits.mjs and saved to public/classes/<class>.png. The
// emoji above is the fallback if the image isn't on disk yet (first build).
function classPortraitPath(cls: string): string {
  return `/classes/${cls.toLowerCase()}.png`;
}
const WEAPON_EMOJI: Record<string, string> = {
  "Longsword": "⚔️", "Shortbow": "🏹", "Staff": "🔮",
  "Daggers (x2)": "🗡️", "Warhammer": "🔨", "Crossbow": "🎯",
};
const ALIGNMENT_COLORS: Record<string, string> = {
  "Lawful Good": "#f59e0b", "Neutral Good": "#fbbf24", "Chaotic Good": "#22c55e",
  "Lawful Neutral": "#8b5cf6", "True Neutral": "#64748b", "Chaotic Neutral": "#f97316",
  "Lawful Evil": "#6366f1", "Neutral Evil": "#ef4444", "Chaotic Evil": "#dc2626",
};
const STEP_ICONS = ["🧑", "⚔️", "🎲", "🗡️", "📜", "✨"];

// Inline d20 — used in place of step 1's head emoji as the iconic D&D heading mark.
// SVG so it stays crisp at any size and no extra asset is needed.
function D20Icon({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', margin: '0 auto', filter: 'drop-shadow(0 4px 12px rgba(139,92,246,0.5))' }}>
      <defs>
        <linearGradient id="d20Body" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id="d20Face" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M76,14 L92,64 L50,94 L8,64 L24,14 Z" fill="url(#d20Body)" stroke="#e9d5ff" strokeWidth="1.4" />
      <path d="M50,50 L27,43 L50,26 Z" fill="#c4b5fd" opacity="0.95" />
      <path d="M50,50 L50,26 L73,43 Z" fill="#a78bfa" opacity="0.85" />
      <path d="M50,50 L73,43 L64,69 Z" fill="#8b5cf6" opacity="0.8" />
      <path d="M50,50 L36,69 L27,43 Z" fill="#9333ea" opacity="0.8" />
      <path d="M50,50 L64,69 L36,69 Z" fill="url(#d20Face)" />
      <g stroke="#ede9fe" strokeWidth="0.9" fill="none" opacity="0.55">
        <path d="M50,50 L50,26" /><path d="M50,50 L73,43" /><path d="M50,50 L64,69" /><path d="M50,50 L36,69" /><path d="M50,50 L27,43" />
        <path d="M50,26 L73,43" /><path d="M73,43 L64,69" /><path d="M64,69 L36,69" /><path d="M36,69 L27,43" /><path d="M27,43 L50,26" />
        <path d="M24,14 L76,14" /><path d="M76,14 L92,64" /><path d="M92,64 L50,94" /><path d="M50,94 L8,64" /><path d="M8,64 L24,14" />
      </g>
      <text x="50" y="64" textAnchor="middle" fontSize="22" fontWeight="800" fill="#fef9c3" stroke="#4c1d95" strokeWidth="0.4" fontFamily="system-ui, sans-serif">20</text>
    </svg>
  );
}

function SpellCard({
  spell, selected, disabled, onToggle, showTooltip, hideTooltip,
}: {
  spell: SpellEntry; selected: boolean; disabled: boolean; onToggle: () => void;
  showTooltip?: (c: React.ReactNode, e: React.MouseEvent) => void;
  hideTooltip?: () => void;
}) {
  const schoolColors: Record<string, string> = {
    Evocation: "#ef4444", Abjuration: "#3b82f6", Conjuration: "#8b5cf6",
    Illusion: "#06b6d4", Enchantment: "#f59e0b", Necromancy: "#22c55e",
    Transmutation: "#f97316", Divination: "#e879f9",
  };
  const color = schoolColors[spell.school] ?? "#94a3b8";
  return (
    <div onClick={() => !disabled && onToggle()} style={{
      padding: "10px 12px", borderRadius: "8px",
      border: `1px solid ${selected ? color : "var(--border)"}`,
      background: selected ? `${color}18` : "rgba(0,0,0,0.2)",
      cursor: disabled && !selected ? "not-allowed" : "pointer",
      opacity: disabled && !selected ? 0.45 : 1, transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: "bold", color: selected ? color : "white" }}>{spell.name}</span>
        {selected && <span style={{ fontSize: "0.65rem", color, flexShrink: 0 }}>✓</span>}
      </div>
      <div style={{ fontSize: "0.62rem", color, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "help", display: "inline-block" }}
        onMouseEnter={e => { e.stopPropagation(); const t = SPELL_SCHOOL_TIPS[spell.school]; if (t && showTooltip) showTooltip(tipBox(t.title, t.body, color), e); }}
        onMouseLeave={e => { e.stopPropagation(); hideTooltip?.(); }}
      >{spell.school}</div>
      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "4px", lineHeight: 1.35 }}>{spell.desc}</div>
    </div>
  );
}

export default function CreateCharacter() {
  const router = useRouter();

  const [character, setCharacter] = useState({
    name: '', title: '', race: '', class: '', alignment: '', weapon: '', trinket: '', sex: 'male', shield: false,
  });
  const [charBackground, setCharBackground] = useState('');
  const [skillProficiencies, setSkillProficiencies] = useState<string[]>([]);

  // Stat method
  const [statMethod, setStatMethod] = useState<StatMethod>('roll');
  const [arrayAssignments, setArrayAssignments] = useState<Record<string, number | null>>({
    strength: null, dexterity: null, constitution: null, intelligence: null, wisdom: null, charisma: null,
  });
  const [selectedArrayVal, setSelectedArrayVal] = useState<number | null>(null);

  const [rollingStats,  setRollingStats]  = useState(false);
  const [revealCount,   setRevealCount]   = useState(6);
  const [scores,        setScores]        = useState<AbilityScores>(DEFAULT_SCORES);
  const [nameError,     setNameError]     = useState('');
  const [saving,        setSaving]        = useState(false);
  const [portraitGenerating, setPortraitGenerating] = useState(false);
  const [hoveredRace,   setHoveredRace]   = useState<string | null>(null);
  const [hoveredClass,  setHoveredClass]  = useState<string | null>(null);
  const [hoveredAlign,  setHoveredAlign]  = useState<string | null>(null);

  const [selectedCantrips, setSelectedCantrips] = useState<string[]>([]);
  const [selectedSpells,   setSelectedSpells]   = useState<string[]>([]);
  const [generatingBg,     setGeneratingBg]     = useState(false);

  const [step, setStep] = useState(1);

  const { showTooltip, hideTooltip, TooltipPortal } = useTooltip();

  const spellCounts       = getSpellCounts(character.class, effectiveScores());
  const availableCantrips = CANTRIPS[character.class] ?? [];
  const availableSpells   = LEVEL1_SPELLS[character.class] ?? [];
  // A class only picks spells at creation (level 1) if it actually gets L1 cantrips
  // or spells. Paladins & Rangers are half-casters with no spellcasting until level
  // 2, so they have nothing to choose and skip the spell step entirely.
  const isSpellcaster = spellCounts.cantrips > 0 || spellCounts.spells > 0;
  const totalSteps    = isSpellcaster ? 6 : 5;

  // Derived stat data
  function effectiveScores(): AbilityScores {
    if (statMethod === 'array') {
      return {
        strength:     arrayAssignments.strength     ?? 8,
        dexterity:    arrayAssignments.dexterity    ?? 8,
        constitution: arrayAssignments.constitution ?? 8,
        intelligence: arrayAssignments.intelligence ?? 8,
        wisdom:       arrayAssignments.wisdom       ?? 8,
        charisma:     arrayAssignments.charisma     ?? 8,
      };
    }
    return scores;
  }

  const arrayComplete = STAT_KEYS.every(k => arrayAssignments[k] !== null);
  const pointsSpent   = statMethod === 'pointbuy' ? calcPointBuyCost(scores) : 0;
  const pointsLeft    = POINT_BUY_BUDGET - pointsSpent;

  const profRequired = character.class ? (CLASS_PROFICIENCIES[character.class]?.skillChoices.count ?? 0) : 0;
  const profData     = character.class ? CLASS_PROFICIENCIES[character.class] : null;

  // ── Stat methods ────────────────────────────────────────────────────────────
  const handleStatMethodChange = (method: StatMethod) => {
    setStatMethod(method);
    if (method === 'pointbuy') {
      setScores(POINTBUY_DEFAULT);
    }
    if (method === 'array') {
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

  // ── Stat roll ────────────────────────────────────────────────────────────────
  const handleRollStats = () => {
    if (rollingStats) return;
    setRollingStats(true);
    setRevealCount(0);
    playDiceRollSound();
    setTimeout(() => {
      const newScores = rollAbilityScores();
      setScores(newScores);
      STAT_KEYS.forEach((_, i) => {
        setTimeout(() => setRevealCount(i + 1), i * 110);
      });
      setTimeout(() => setRollingStats(false), STAT_KEYS.length * 110 + 100);
    }, 1100);
  };

  // ── Proficiency toggle ───────────────────────────────────────────────────────
  const toggleSkillProf = (skill: string) => {
    setSkillProficiencies(prev => {
      if (prev.includes(skill)) return prev.filter(s => s !== skill);
      if (prev.length >= profRequired) return prev;
      return [...prev, skill];
    });
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const nextStep = () => {
    if (step === 1) {
      const nameErr = characterNameError(character.name);
      if (nameErr) { setNameError(nameErr); return; }
      if (!character.race) return;
    }
    if (step === 2) {
      if (!character.class) return;
      if (skillProficiencies.length < profRequired) return;
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // ── Spell toggles ────────────────────────────────────────────────────────────
  const toggleCantrip = (name: string) => {
    setSelectedCantrips(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) :
      prev.length < spellCounts.cantrips ? [...prev, name] : prev
    );
  };

  const toggleSpell = (name: string) => {
    setSelectedSpells(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) :
      prev.length < spellCounts.spells ? [...prev, name] : prev
    );
  };

  const handleClassSelect = (cls: string) => {
    setCharacter(c => ({ ...c, class: cls }));
    setSelectedCantrips([]);
    setSelectedSpells([]);
    setSkillProficiencies([]);
  };

  // ── Finish ───────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("You must be logged in!"); router.push('/auth'); return; }

      const trimmedName = character.name.trim();
      const nameErr = characterNameError(trimmedName);
      if (nameErr) { setStep(1); setNameError(nameErr); setSaving(false); return; }

      // Roster cap — a user may keep at most 40 characters in their roster.
      const { count: rosterCount } = await supabase
        .from('characters').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if ((rosterCount ?? 0) >= 40) {
        setStep(1);
        setNameError(`Your roster is full (40 / 40). Delete a character from the dashboard to make room.`);
        setSaving(false);
        return;
      }

      // Global uniqueness — no two characters in the entire game can share a name.
      // The check is case-insensitive so "Aragorn" and "aragorn" collide.
      const { data: existing } = await supabase
        .from('characters').select('id')
        .ilike('name', trimmedName).limit(1);
      if (existing && existing.length > 0) {
        setStep(1);
        setNameError(`"${trimmedName}" is already taken by another adventurer. Choose a different name.`);
        setSaving(false);
        return;
      }

      const charClass   = character.class || 'Fighter';
      const finalScores = effectiveScores();
      const maxHp       = startingHP(charClass, finalScores.constitution);
      const startingInv = {
        gold: 50,
        weapons: character.weapon ? [character.weapon] : ['Iron Dagger'],
        items:   ['Bedroll', 'Rations (5 days)', ...(character.shield ? ['Shield'] : []), character.trinket || 'Mysterious Coin'],
      };

      const { data: newChar, error: insertError } = await supabase.from('characters').insert([{
        user_id:              user.id,
        name:                 trimmedName,
        race:                 character.race || 'Human',
        class:                charClass,
        sex:                  character.sex,
        title:                character.title.trim() || null,
        alignment:            character.alignment || null,
        background:           charBackground.trim() || null,
        skill_proficiencies:  skillProficiencies,
        level:                1,
        xp:                   0,
        max_hp:               maxHp,
        hp:                   maxHp,
        strength:             finalScores.strength,
        dexterity:            finalScores.dexterity,
        constitution:         finalScores.constitution,
        intelligence:         finalScores.intelligence,
        wisdom:               finalScores.wisdom,
        charisma:             finalScores.charisma,
        inventory:            startingInv,
        cantrips_known:       selectedCantrips,
        spells_prepared:      selectedSpells,
        spell_slots_used:     {},
        status_effects:       [],
      }]).select().single();

      if (insertError || !newChar) throw insertError ?? new Error("Insert failed");

      setSaving(false);
      setPortraitGenerating(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        await fetch('/api/generate-portrait', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            race: character.race || 'Human', cls: charClass, sex: character.sex, charId: newChar.id,
            title: character.title.trim() || null,
            alignment: character.alignment || null,
            background: charBackground.trim() || null,
          }),
        });
      } catch (portraitErr) {
        console.error('[create-character] portrait fetch error:', portraitErr);
      }

      router.push('/dashboard');
    } catch (err) {
      console.error("Error saving character:", err);
      alert("Failed to save character. Please try again.");
      setSaving(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const STEP_TITLES = ["Identity & Origins", "Class & Proficiencies", "Ability Scores", "Starting Equipment", "Character Background", "Spells & Cantrips"];
  const stepTitle = STEP_TITLES[step - 1];

  const spellsReady =
    (spellCounts.cantrips === 0 || selectedCantrips.length === spellCounts.cantrips) &&
    (spellCounts.spells   === 0 || selectedSpells.length   === spellCounts.spells);

  const canProceed =
    (step === 1 && !!character.race) ||
    (step === 2 && !!character.class && skillProficiencies.length === profRequired) ||
    (step === 3 && (statMethod !== 'array' || arrayComplete)) ||
    (step === 4 && !!character.weapon) ||
    (step === 5) ||
    (step === 6);

  const eff = effectiveScores();

  // Shared stat card renderer
  const renderStatCards = (displayScores: AbilityScores, isInteractive = false) => (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
      {STAT_LABELS.map((label, statIdx) => {
        const valKey    = STAT_KEYS[statIdx];
        const val       = displayScores[valKey];
        const isRevealed = statMethod !== 'roll' || revealCount > statIdx;
        const m         = Math.floor((val - 10) / 2);
        const guide     = CLASS_STAT_GUIDES[character.class]?.[label];
        const tierStyle = guide ? getTierStyle(guide.tier) : null;
        return (
          <div
            key={label}
            onClick={() => isInteractive && handleArrayStatClick(valKey)}
            style={{
              position: 'relative', padding: '22px 26px', background:
                isInteractive && arrayAssignments[valKey] !== null ? 'rgba(139,92,246,0.15)' :
                isInteractive && selectedArrayVal !== null ? 'rgba(139,92,246,0.05)' : 'var(--card-bg)',
              borderRadius: '12px', textAlign: 'center', minWidth: '108px',
              border: `2px solid ${
                isInteractive && arrayAssignments[valKey] !== null ? (tierStyle ? tierStyle.color + "88" : 'var(--primary)') :
                isInteractive && selectedArrayVal !== null ? 'rgba(139,92,246,0.4)' :
                tierStyle && isRevealed ? tierStyle.color + "55" : "var(--border)"
              }`,
              cursor: isInteractive ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const st = STAT_TIPS[label];
              if (!st) return;
              const accent = tierStyle ? tierStyle.color : "#8b5cf6";
              showTooltip(tipBoxNode(st.title, <>
                  {guide && tierStyle && <div style={{ color: tierStyle.color, fontWeight: 600, marginBottom: "4px", fontSize: "0.9em" }}>{tierStyle.label} for {character.class}</div>}
                  <div style={{ color: "#94a3b8" }}>{st.body}</div>
                  {guide && <div style={{ color: "#64748b", fontSize: "0.9em", marginTop: "4px" }}>{guide.reason}</div>}
                </>, accent), e);
            }}
            onMouseLeave={hideTooltip}
          >
            <div style={{ fontSize: '1.05rem', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
            <div style={{ fontWeight: 'bold', fontSize: '2.4rem', color: isRevealed ? 'white' : '#475569', transition: 'color 0.2s', lineHeight: 1.05 }}>
              {isRevealed ? val : '??'}
            </div>
            <div style={{ fontSize: '1.1rem', color: isRevealed ? (m >= 0 ? '#22c55e' : '#ef4444') : '#374151', fontWeight: 600, marginTop: '4px' }}>
              {isRevealed ? (m >= 0 ? `+${m}` : m) : '--'}
            </div>
            {isRevealed && tierStyle && (
              <div style={{ fontSize: '0.72rem', color: tierStyle.color, marginTop: '8px', fontWeight: 'bold', letterSpacing: '0.08em' }}>
                {tierStyle.label.toUpperCase()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Pithy one-liner per ability — surfaced on the always-visible left rail so
  // newcomers can scan-read which stat covers what. The full description sits
  // behind a hover tooltip via STAT_TIPS.
  const STAT_LEGEND: { code: typeof STAT_LABELS[number]; line: string; color: string }[] = [
    { code: 'STR', line: 'Power, melee hits, carry weight',   color: '#ef4444' },
    { code: 'DEX', line: 'Agility, ranged hits, AC, stealth', color: '#22c55e' },
    { code: 'CON', line: 'Toughness, max HP, concentration',  color: '#f97316' },
    { code: 'INT', line: 'Reasoning, Arcana, Wizard magic',   color: '#3b82f6' },
    { code: 'WIS', line: 'Perception, Cleric & Druid magic',  color: '#eab308' },
    { code: 'CHA', line: 'Presence, Bard/Sorcerer/Warlock',   color: '#ec4899' },
  ];

  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', backgroundImage: 'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(139,92,246,0.09) 0%, transparent 70%)' }}>

      {/* Portrait generation overlay */}
      {portraitGenerating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,3,15,0.95)', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🎨</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '10px' }}>Painting your portrait…</h2>
            <p style={{ color: '#64748b', marginBottom: '28px', lineHeight: 1.6 }}>The artist captures your likeness in ink and magic.<br />This takes about 20 seconds.</p>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', animation: `blink 1.2s step-end ${i * 0.4}s infinite` }} />
              ))}
            </div>
          </div>
          <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }`}</style>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', width: '100%', maxWidth: '1280px', justifyContent: 'center', flexWrap: 'wrap' }}>

      {/* Left rail — Ability Score legend (always visible). Hides below 900px wide. */}
      <aside className="hide-on-narrow" style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '40px' }}>
        <div className="glass-panel" style={{ padding: '20px 18px' }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Reference</div>
          <h3 style={{ fontSize: '1rem', margin: 0, marginBottom: '14px', color: 'white', fontWeight: 600 }}>Ability Scores</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {STAT_LEGEND.map(s => {
              const t = STAT_TIPS[s.code];
              return (
                <div key={s.code}
                  onMouseEnter={e => { if (t) showTooltip(tipBox(t.title, t.body, s.color), e); }}
                  onMouseLeave={hideTooltip}
                  style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}33`, cursor: 'help', transition: 'border-color 0.15s, background 0.15s' }}
                  onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${s.color}88`; (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.4)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${s.color}33`; (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.25)'; }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: s.color, letterSpacing: '0.05em' }}>{s.code}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.35 }}>{s.line}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '14px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)', fontSize: '0.68rem', color: '#c4b5fd', lineHeight: 1.45, cursor: 'help' }}
            onMouseEnter={e => showTooltip(tipBox('Ability Modifier', 'Your modifier = (score − 10) ÷ 2, rounded down. Added to every roll made with that ability (attack, save, skill check).', '#c4b5fd'), e)}
            onMouseLeave={hideTooltip}>
            <strong style={{ color: '#a78bfa' }}>Modifier:</strong> (score − 10) ÷ 2, rounded down. Hover for details.
          </div>
        </div>
      </aside>
      <style>{`@media (max-width: 900px) { .hide-on-narrow { display: none !important; } }`}</style>

      <div className="glass-panel" style={{ flex: '1 1 0', minWidth: 0, maxWidth: '1020px', padding: '52px 56px', position: 'relative' }}>

        {/* Progress bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', zIndex: 0,
            background: `linear-gradient(90deg, var(--primary) ${Math.max(0, ((step - 1) / (totalSteps - 1)) * 100)}%, var(--border) ${Math.max(0, ((step - 1) / (totalSteps - 1)) * 100)}%)`,
          }} />
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(i => {
            const stepLabels = ["Identity — name, race, sex, alignment", "Class — role, proficiencies, skills", "Ability Scores — your six stats", "Equipment — weapon and shield", "Background — backstory for the DM", "Spells — cantrips and prepared spells"];
            const done = step > i; const active = step === i;
            return (
            <div key={i}
              onMouseEnter={e => showTooltip(tipBox(`${STEP_ICONS[i-1]} Step ${i}`, stepLabels[i - 1] ?? '', step >= i ? '#8b5cf6' : '#64748b'), e)}
              onMouseLeave={hideTooltip}
              style={{
                width: '46px', height: '46px', borderRadius: '50%',
                background: done ? 'linear-gradient(135deg, var(--primary), #6d28d9)' : active ? 'rgba(139,92,246,0.22)' : 'var(--card-bg)',
                border: `2px solid ${step >= i ? 'var(--primary)' : 'var(--border)'}`,
                boxShadow: done ? '0 0 16px rgba(139,92,246,0.6)' : active ? '0 0 10px rgba(139,92,246,0.35), 0 0 0 3px rgba(139,92,246,0.12)' : 'none',
                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1,
                color: step >= i ? 'white' : '#475569', fontWeight: 'bold', fontSize: done ? '0.82rem' : '1rem', cursor: 'help', transition: 'all 0.3s',
              }}>{done ? '✓' : i}</div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '2.6rem', marginBottom: '8px', lineHeight: 1, display: 'flex', justifyContent: 'center' }}>
            {step === 1 ? <D20Icon size={58} /> : <span>{STEP_ICONS[step - 1]}</span>}
          </div>
          <h1 className="shimmer-heading" style={{ fontSize: '2.6rem', marginBottom: 0 }}>{stepTitle}</h1>
          <div style={{ height: '1px', width: '80px', background: 'linear-gradient(90deg, transparent, var(--primary), transparent)', margin: '10px auto 0' }} />
        </div>

        <div style={{ minHeight: '340px' }}>

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* Name + Title row */}
              <div style={{ display: 'flex', gap: '14px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: '#cbd5e1', fontSize: '1.15rem', fontWeight: 600, letterSpacing: '0.02em', cursor: 'help' }}
                    onMouseEnter={e => showTooltip(tipBox('Character Name', 'What your hero is called in the world. The DM and other players will use this name throughout your adventure.', '#c4b5fd'), e)}
                    onMouseLeave={hideTooltip}>Character Name</label>
                  <input
                    type="text" value={character.name}
                    onChange={e => {
                      const clean = sanitizeCharacterName(e.target.value);
                      setNameError(clean !== e.target.value ? "Names use letters, spaces, apostrophes, and hyphens only." : '');
                      setCharacter(c => ({ ...c, name: clean }));
                    }}
                    style={{ width: '100%', padding: '18px 20px', borderRadius: '10px', border: `1px solid ${nameError ? '#ef4444' : 'var(--border)'}`, background: 'rgba(0,0,0,0.25)', color: 'white', fontSize: '1.2rem' }}
                    placeholder="e.g. Elara Moonwhisper"
                  />
                  {nameError && <p style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '8px' }}>{nameError}</p>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: '#cbd5e1', fontSize: '1.15rem', fontWeight: 600, letterSpacing: '0.02em', cursor: 'help' }}
                    onMouseEnter={e => showTooltip(tipBox('Title', 'An optional honorific like "the Brave" or "Shadowbane." The DM uses it alongside your name in narration — e.g. "Aria the Brave steps forward…"', '#c4b5fd'), e)}
                    onMouseLeave={hideTooltip}>
                    Title <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="text" value={character.title} maxLength={40}
                    onChange={e => setCharacter(c => ({ ...c, title: e.target.value }))}
                    style={{ width: '100%', padding: '18px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)', color: 'white', fontSize: '1.2rem' }}
                    placeholder="e.g. the Brave"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '14px', color: '#cbd5e1', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0.02em', cursor: 'help' }}
                  onMouseEnter={e => showTooltip(tipBox('Race', 'Your character\'s ancestry — determines stat bonuses, special abilities, darkvision, and innate traits. Hover any race for details.', '#c4b5fd'), e)}
                  onMouseLeave={hideTooltip}>Race</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(150px, 18vw, 220px), 1fr))', gap: 'clamp(12px, 1.3vw, 18px)' }}>
                  {['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Tiefling', 'Gnome', 'Half-Elf', 'Half-Orc'].map(race => (
                    <div key={race}
                      onClick={() => setCharacter(c => ({ ...c, race }))}
                      onMouseEnter={e => { setHoveredRace(race); const t = RACE_TIPS[race]; if (t) showTooltip(tipBox(t.title, t.body, "#c4b5fd"), e); }}
                      onMouseLeave={() => { setHoveredRace(null); hideTooltip(); }}
                      style={{ padding: '22px 14px 18px', borderRadius: '14px', border: `2px solid ${character.race === race ? 'var(--primary)' : hoveredRace === race ? 'rgba(139,92,246,0.55)' : 'var(--border)'}`, background: character.race === race ? 'rgba(139,92,246,0.22)' : hoveredRace === race ? 'rgba(139,92,246,0.1)' : 'rgba(0,0,0,0.18)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', transform: character.race === race ? 'translateY(-4px)' : hoveredRace === race ? 'translateY(-2px)' : 'none', boxShadow: character.race === race ? '0 10px 30px rgba(139,92,246,0.45), 0 0 0 1px rgba(139,92,246,0.5) inset' : 'none' }}>
                      <div style={{ position: 'relative', width: '96px', height: '96px', margin: '0 auto 12px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,0,0,0.4)', border: `2px solid ${character.race === race ? 'rgba(196,181,253,0.7)' : 'rgba(148,163,184,0.2)'}`, boxShadow: character.race === race ? '0 0 22px rgba(139,92,246,0.55)' : 'none' }}>
                        <img
                          src={`/races/${race.toLowerCase().replace('-', '_')}.png`}
                          alt={`${race} emblem`}
                          onError={e => { const i = e.currentTarget; i.style.display = "none"; const fb = i.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = "flex"; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '2.6rem', position: 'absolute', inset: 0 }}>{RACE_EMOJI[race] ?? '🧙'}</div>
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: character.race === race ? 700 : 600, color: character.race === race ? '#c4b5fd' : '#e2e8f0', letterSpacing: '0.02em' }}>{race}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '14px', color: '#cbd5e1', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0.02em', cursor: 'help' }}
                  onMouseEnter={e => showTooltip(tipBox('Sex / Pronouns', 'Sets the pronouns the DM uses when narrating your character\'s actions — he/him, she/her, or they/them.', '#c4b5fd'), e)}
                  onMouseLeave={hideTooltip}>Sex</label>
                <div style={{ display: 'flex', gap: '14px' }}>
                  {(['male', 'female', 'non-binary'] as const).map(s => {
                    const pronounMap = { male: 'he/him', female: 'she/her', 'non-binary': 'they/them' };
                    return (
                    <div key={s} onClick={() => setCharacter(c => ({ ...c, sex: s }))}
                      onMouseEnter={e => showTooltip(tipBox(s.charAt(0).toUpperCase() + s.slice(1), `Pronouns: ${pronounMap[s]} — the DM will refer to your character using these pronouns.`, '#c4b5fd'), e)}
                      onMouseLeave={hideTooltip}
                      style={{ flex: 1, padding: '22px 16px', borderRadius: '12px', border: `2px solid ${character.sex === s ? 'var(--primary)' : 'var(--border)'}`, background: character.sex === s ? 'rgba(139,92,246,0.22)' : 'rgba(0,0,0,0.18)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', textTransform: 'capitalize', boxShadow: character.sex === s ? '0 6px 22px rgba(139,92,246,0.4)' : 'none' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: character.sex === s ? 700 : 600, color: character.sex === s ? '#c4b5fd' : '#e2e8f0' }}>{s}</div>
                      <div style={{ fontSize: '0.8rem', color: character.sex === s ? 'rgba(196,181,253,0.8)' : '#64748b', marginTop: '6px', letterSpacing: '0.04em', textTransform: 'none' }}>{pronounMap[s]}</div>
                    </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '14px', color: '#cbd5e1', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0.02em', cursor: 'help' }}
                  onMouseEnter={e => showTooltip(tipBox('Alignment', 'Your character\'s moral and ethical outlook. Optional — shapes how the DM portrays NPC reactions and your character\'s motivations. Hover any alignment for its description.', '#a78bfa'), e)}
                  onMouseLeave={hideTooltip}>Alignment <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 400 }}>(optional — shapes how the DM reads your character)</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(120px, 12vw, 170px), 1fr))', gap: 'clamp(10px, 1vw, 14px)' }}>
                  {ALIGNMENTS.map(a => (
                    <div key={a.key}
                      onClick={() => setCharacter(c => ({ ...c, alignment: c.alignment === a.key ? '' : a.key }))}
                      onMouseEnter={e => { setHoveredAlign(a.key); showTooltip(tipBox(a.key, ALIGNMENT_TIPS[a.key] ?? a.desc, ALIGNMENT_COLORS[a.key] ?? "#a78bfa"), e); }}
                      onMouseLeave={() => { setHoveredAlign(null); hideTooltip(); }}
                      style={{ padding: '18px 12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', border: `2px solid ${character.alignment === a.key ? (ALIGNMENT_COLORS[a.key] ?? 'var(--primary)') : hoveredAlign === a.key ? (ALIGNMENT_COLORS[a.key] ?? '#8b5cf6') + '77' : 'var(--border)'}`, background: character.alignment === a.key ? (ALIGNMENT_COLORS[a.key] ?? '#8b5cf6') + '22' : hoveredAlign === a.key ? (ALIGNMENT_COLORS[a.key] ?? '#8b5cf6') + '14' : 'rgba(0,0,0,0.18)', transform: character.alignment === a.key ? 'translateY(-3px)' : 'none', boxShadow: character.alignment === a.key ? `0 8px 24px ${ALIGNMENT_COLORS[a.key] ?? '#8b5cf6'}44` : 'none' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.1em', color: character.alignment === a.key ? (ALIGNMENT_COLORS[a.key] ?? '#c4b5fd') : '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', lineHeight: 1 }}>{a.short}</div>
                      <div style={{ fontSize: '0.95rem', color: character.alignment === a.key ? 'white' : '#cbd5e1', lineHeight: 1.25, fontWeight: character.alignment === a.key ? 600 : 400 }}>{a.key}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Class & Proficiencies ── */}
          {step === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '10px', color: '#94a3b8', fontSize: '1rem' }}>Class</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(130px, 14vw, 180px), 1fr))', gap: 'clamp(10px, 1.2vw, 16px)' }}>
                  {['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Paladin', 'Ranger', 'Bard', 'Warlock', 'Barbarian', 'Druid', 'Monk', 'Sorcerer'].map(cls => {
                    const ct = CLASS_TIPS[cls];
                    const clsColor = CLASS_COLORS[cls] ?? '#8b5cf6';
                    return (
                    <div key={cls}
                      onClick={() => handleClassSelect(cls)}
                      onMouseEnter={e => { setHoveredClass(cls); if (ct) showTooltip(tipBoxNode(ct.title, <><div style={{ color: "#64748b", fontSize: "0.9em", marginBottom: "4px" }}>Hit Die: {ct.hitDie} · Primary: {ct.primaryStat}</div><div style={{ color: "#94a3b8" }}>{ct.body}</div></>, clsColor), e); }}
                      onMouseLeave={() => { setHoveredClass(null); hideTooltip(); }}
                      style={{ padding: '14px 8px 10px', borderRadius: '12px', border: `1px solid ${character.class === cls ? clsColor : hoveredClass === cls ? clsColor + '77' : 'var(--border)'}`, background: character.class === cls ? clsColor + '22' : hoveredClass === cls ? clsColor + '11' : 'rgba(0,0,0,0.15)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', transform: character.class === cls ? 'translateY(-3px)' : hoveredClass === cls ? 'translateY(-1px)' : 'none', boxShadow: character.class === cls ? `0 6px 22px ${clsColor}44` : 'none' }}>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', marginBottom: '8px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.35)', border: `1px solid ${character.class === cls ? clsColor + '88' : 'rgba(148,163,184,0.15)'}` }}>
                        <img
                          src={classPortraitPath(cls)}
                          alt={`${cls} example portrait`}
                          onError={e => { const i = e.currentTarget; i.style.display = "none"; const fb = i.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = "flex"; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
                        />
                        <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', position: 'absolute', inset: 0 }}>{CLASS_EMOJI[cls] ?? '⚔️'}</div>
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: character.class === cls ? 700 : 400, color: character.class === cls ? clsColor : 'inherit' }}>{cls}</div>
                      {SPELLCASTING_CLASSES.has(cls) && <div style={{ fontSize: '0.6rem', color: '#8b5cf6', marginTop: '3px', letterSpacing: '0.05em', fontWeight: 700 }}>✦ SPELL</div>}
                    </div>
                    );
                  })}
                </div>
              </div>

              {profData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Proficiency summary */}
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.7, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <span>
                      <strong style={{ color: '#c4b5fd', cursor: 'help' }}
                        onMouseEnter={e => showTooltip(tipBox(PROF_TIPS.saves.title, PROF_TIPS.saves.body, '#c4b5fd'), e)}
                        onMouseLeave={hideTooltip}>Saves:</strong> {profData.savingThrows.join(", ")}
                    </span>
                    <span style={{ color: '#374151' }}>|</span>
                    <span>
                      <strong style={{ color: '#c4b5fd', cursor: 'help' }}
                        onMouseEnter={e => showTooltip(tipBox(PROF_TIPS.armor.title, PROF_TIPS.armor.body, '#c4b5fd'), e)}
                        onMouseLeave={hideTooltip}>Armor:</strong> {profData.armorProficiencies}
                    </span>
                    <span style={{ color: '#374151' }}>|</span>
                    <span>
                      <strong style={{ color: '#c4b5fd', cursor: 'help' }}
                        onMouseEnter={e => showTooltip(tipBox(PROF_TIPS.weapons.title, PROF_TIPS.weapons.body, '#c4b5fd'), e)}
                        onMouseLeave={hideTooltip}>Weapons:</strong> {profData.weaponProficiencies}
                    </span>
                  </div>

                  {/* Skill proficiency selection */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                        Choose <strong style={{ color: 'white' }}>{profData.skillChoices.count}</strong> Skill Proficiencies
                      </label>
                      <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: skillProficiencies.length === profRequired ? '#22c55e' : '#8b5cf6' }}>
                        {skillProficiencies.length} / {profRequired}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {profData.skillChoices.skills.map(skill => {
                        const selected = skillProficiencies.includes(skill);
                        const disabled = !selected && skillProficiencies.length >= profRequired;
                        return (
                          <div key={skill} onClick={() => toggleSkillProf(skill)}
                            onMouseEnter={e => { const st = SKILL_TIPS[skill]; if (st) showTooltip(tipBox(st.title, st.body), e); }}
                            onMouseLeave={hideTooltip}
                            style={{
                              padding: '6px 14px', borderRadius: '20px', cursor: disabled ? 'not-allowed' : 'pointer',
                              border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                              background: selected ? 'rgba(139,92,246,0.25)' : 'transparent',
                              color: selected ? 'white' : disabled ? '#374151' : '#94a3b8',
                              fontSize: '0.82rem', opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
                            }}>
                            {selected && <span style={{ marginRight: '4px', fontSize: '0.65rem' }}>✓</span>}
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

          {/* ── Step 3: Ability Scores ── */}
          {step === 3 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Method tabs */}
              <div style={{ display: 'flex', gap: '12px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                {(['roll', 'array', 'pointbuy'] as const).map(method => (
                  <button key={method} onClick={() => handleStatMethodChange(method)}
                    onMouseEnter={e => { const st = STAT_METHOD_TIPS[method]; if (st) showTooltip(tipBox(st.title, st.body), e); }}
                    onMouseLeave={hideTooltip}
                    style={{
                      padding: '14px 28px', borderRadius: '10px', cursor: 'pointer', fontSize: '1.05rem', transition: 'all 0.15s',
                      border: `1px solid ${statMethod === method ? 'var(--primary)' : 'var(--border)'}`,
                      background: statMethod === method ? 'rgba(139,92,246,0.2)' : 'transparent',
                      color: statMethod === method ? 'white' : '#94a3b8',
                      fontWeight: statMethod === method ? 'bold' : 'normal',
                    }}>
                    {method === 'roll' ? '🎲 Roll' : method === 'array' ? '📊 Standard Array' : '🔢 Point Buy'}
                  </button>
                ))}
              </div>

              {/* Roll */}
              {statMethod === 'roll' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px' }}>
                  <div style={{
                    fontSize: '5.5rem',
                    animation: rollingStats ? 'diceRoll 0.35s linear infinite' : 'none',
                    filter: rollingStats ? 'drop-shadow(0 0 24px rgba(139,92,246,0.85))' : 'none',
                    transition: 'filter 0.3s',
                  }}>🎲</div>
                  <button className="btn-primary" onClick={handleRollStats} disabled={rollingStats}
                    style={{ fontSize: '1.15rem', padding: '16px 32px', borderRadius: '12px' }}>
                    {rollingStats ? 'Rolling…' : 'Roll Ability Scores (4d6 drop lowest)'}
                  </button>
                  {renderStatCards(scores)}
                  <p style={{ color: '#94a3b8', fontSize: '1rem' }}>Re-roll as many times as you like before continuing.</p>
                </div>
              )}

              {/* Standard Array */}
              {statMethod === 'array' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '1rem', textAlign: 'center' }}>
                    Click a value from the pool below, then click a stat to assign it. Click an assigned stat to pick it back up.
                  </p>
                  {/* Value pool */}
                  <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {STANDARD_ARRAY.map(v => {
                      const isUsed = Object.values(arrayAssignments).includes(v);
                      const isSelected = selectedArrayVal === v;
                      return (
                        <div key={v} onClick={() => handleArrayChipClick(v)}
                          onMouseEnter={e => { const tip = ARRAY_VALUE_TIPS[v]; if (tip) showTooltip(tipBox(String(v), tip, '#8b5cf6'), e); }}
                          onMouseLeave={hideTooltip}
                          style={{
                          width: '70px', height: '70px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold', fontSize: '1.55rem', cursor: isUsed ? 'default' : 'pointer', transition: 'all 0.15s',
                          border: `2px solid ${isSelected ? 'var(--primary)' : isUsed ? '#1e293b' : 'var(--border)'}`,
                          background: isSelected ? 'rgba(139,92,246,0.3)' : isUsed ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.2)',
                          color: isUsed ? '#374151' : 'white',
                          textDecoration: isUsed ? 'line-through' : 'none',
                          boxShadow: isSelected ? '0 0 16px rgba(139,92,246,0.55)' : 'none',
                        }}>{v}</div>
                      );
                    })}
                  </div>
                  {/* Stat assignment */}
                  {renderStatCards(effectiveScores(), true)}
                  <p style={{ color: '#94a3b8', fontSize: '0.95rem', textAlign: 'center' }}>
                    {!arrayComplete
                      ? selectedArrayVal !== null
                        ? `Click a stat to assign ${selectedArrayVal}`
                        : 'Click a value from the pool to select it'
                      : '✓ All stats assigned'}
                  </p>
                </div>
              )}

              {/* Point Buy */}
              {statMethod === 'pointbuy' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '1.7rem', fontWeight: 'bold', color: pointsLeft === 0 ? '#22c55e' : '#c4b5fd' }}>
                      {pointsLeft}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '1.05rem' }}> / {POINT_BUY_BUDGET} points remaining</span>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '6px' }}>Stats range 8–15. Cost increases at 14 (+2) and 15 (+2).</div>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {STAT_KEYS.map((statKey, i) => {
                      const val = scores[statKey];
                      const m = Math.floor((val - 10) / 2);
                      const incCost = (POINT_BUY_COST[val + 1] ?? 99) - (POINT_BUY_COST[val] ?? 0);
                      const canInc = val < 15 && pointsLeft >= incCost;
                      const canDec = val > 8;
                      const pbGuide = CLASS_STAT_GUIDES[character.class]?.[STAT_LABELS[i]];
                      const pbTierStyle = pbGuide ? getTierStyle(pbGuide.tier) : null;
                      return (
                        <div key={statKey}
                          style={{ padding: '22px 18px', background: 'var(--card-bg)', borderRadius: '12px', textAlign: 'center', minWidth: '128px', border: `2px solid ${pbTierStyle ? pbTierStyle.color + "55" : 'var(--border)'}` }}
                          onMouseEnter={e => {
                            const st = STAT_TIPS[STAT_LABELS[i]];
                            if (!st) return;
                            const accent = pbTierStyle ? pbTierStyle.color : "#8b5cf6";
                            showTooltip(
                              <div style={{ background: "#12101f", border: `1px solid ${accent}55`, borderRadius: "8px", padding: "9px 13px", fontSize: "0.76rem", color: "#e2e8f0", lineHeight: 1.55, boxShadow: "0 6px 28px rgba(0,0,0,0.85)", minWidth: "180px", maxWidth: "240px" }}>
                                <div style={{ fontWeight: 700, color: accent, marginBottom: "4px", fontSize: "0.8rem" }}>{st.title}</div>
                                {pbGuide && pbTierStyle && <div style={{ color: pbTierStyle.color, fontSize: "0.7rem", marginBottom: "4px", fontWeight: 600 }}>{pbTierStyle.label} for {character.class}</div>}
                                <div style={{ color: "#94a3b8" }}>{st.body}</div>
                                {pbGuide && <div style={{ color: "#64748b", fontSize: "0.7rem", marginTop: "5px" }}>{pbGuide.reason}</div>}
                              </div>, e
                            );
                          }}
                          onMouseLeave={hideTooltip}
                        >
                          <div style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '12px', letterSpacing: '0.05em', fontWeight: 600 }}>{STAT_LABELS[i]}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                            <button onClick={() => adjustPBStat(statKey, -1)} disabled={!canDec} style={{
                              width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: canDec ? 'rgba(139,92,246,0.15)' : 'transparent',
                              color: canDec ? 'white' : '#374151', cursor: canDec ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '1.4rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>−</button>
                            <span style={{ fontWeight: 'bold', fontSize: '2.1rem', minWidth: '36px', lineHeight: 1 }}>{val}</span>
                            <button onClick={() => adjustPBStat(statKey, 1)} disabled={!canInc} style={{
                              width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border)', background: canInc ? 'rgba(139,92,246,0.15)' : 'transparent',
                              color: canInc ? 'white' : '#374151', cursor: canInc ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '1.4rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>+</button>
                          </div>
                          <div style={{ fontSize: '1.05rem', color: m >= 0 ? '#22c55e' : '#ef4444', marginTop: '10px', fontWeight: 600 }}>
                            {m >= 0 ? `+${m}` : m}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
                            {POINT_BUY_COST[val]}pt{POINT_BUY_COST[val] !== 1 ? 's' : ''}
                          </div>
                          {pbTierStyle && (
                            <div style={{ fontSize: '0.7rem', color: pbTierStyle.color, marginTop: '8px', fontWeight: 'bold', letterSpacing: '0.08em' }}>
                              {pbTierStyle.label.toUpperCase()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* HP preview — shown for all methods */}
              {character.class && (
                <p style={{ color: '#94a3b8', fontSize: '1.05rem', textAlign: 'center', marginTop: '6px' }}>
                  Level 1 HP: <strong style={{ color: 'white', fontSize: '1.2em' }}>{startingHP(character.class, eff.constitution)}</strong>
                  {' '}(d{CLASS_HIT_DIE[character.class] ?? 8} + CON mod)
                </p>
              )}

              <style>{`
                @keyframes diceRoll {
                  0%   { transform: rotate(0deg)   scale(1);    }
                  25%  { transform: rotate(90deg)  scale(0.85); }
                  50%  { transform: rotate(180deg) scale(1);    }
                  75%  { transform: rotate(270deg) scale(0.85); }
                  100% { transform: rotate(360deg) scale(1);    }
                }
                @keyframes statReveal {
                  0%   { transform: scale(0.8); opacity: 0.3; }
                  60%  { transform: scale(1.12); }
                  100% { transform: scale(1);   opacity: 1;   }
                }
              `}</style>
            </div>
          )}

          {/* ── Step 4: Equipment ── */}
          {step === 4 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '10px', color: '#94a3b8', fontSize: '1rem' }}>Primary Weapon</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  {['Longsword', 'Shortbow', 'Staff', 'Daggers (x2)', 'Warhammer', 'Crossbow'].map(w => (
                    <div key={w}
                      onClick={() => setCharacter(c => ({ ...c, weapon: w }))}
                      onMouseEnter={e => { const t = WEAPON_TIPS[w]; if (t) showTooltip(tipBox(t.title, t.body, '#f59e0b'), e); }}
                      onMouseLeave={hideTooltip}
                      style={{ padding: '22px 12px', borderRadius: '12px', border: `1px solid ${character.weapon === w ? '#f59e0b' : 'var(--border)'}`, background: character.weapon === w ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.15)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', transform: character.weapon === w ? 'translateY(-3px)' : 'none', boxShadow: character.weapon === w ? '0 6px 22px rgba(245,158,11,0.3)' : 'none' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px', lineHeight: 1 }}>{WEAPON_EMOJI[w] ?? '⚔️'}</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: character.weapon === w ? 700 : 400, color: character.weapon === w ? '#f59e0b' : 'inherit' }}>{w}</div>
                    </div>
                  ))}
                </div>
              </div>

              {['Fighter', 'Paladin', 'Ranger', 'Cleric', 'Druid', 'Barbarian'].includes(character.class) && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Shield</label>
                  <div onClick={() => setCharacter(c => ({ ...c, shield: !c.shield }))}
                    onMouseEnter={e => showTooltip(tipBox('Shield', '+2 to Armor Class · Requires one free hand. You cannot wield a two-handed weapon while using a shield. Usable with light, medium, or heavy armor.', '#22c55e'), e)}
                    onMouseLeave={hideTooltip}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', border: `1px solid ${character.shield ? 'var(--primary)' : 'var(--border)'}`, background: character.shield ? 'rgba(139,92,246,0.2)' : 'transparent' }}>
                    <span style={{ fontSize: '1.5rem' }}>🛡</span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Shield <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>+2 AC</span></div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Requires one free hand — pairs well with one-handed weapons</div>
                    </div>
                    <div style={{ marginLeft: 'auto', width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${character.shield ? 'var(--primary)' : 'var(--border)'}`, background: character.shield ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.7rem' }}>
                      {character.shield && '✓'}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', cursor: 'help' }}
                  onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.TRINKET.title, MECHANIC_TIPS.TRINKET.body, '#f59e0b'), e)}
                  onMouseLeave={hideTooltip}>Starting Trinket <span style={{ fontSize: '0.72rem', color: '#475569' }}>(optional)</span></label>
                <input type="text" value={character.trinket}
                  onChange={e => setCharacter(c => ({ ...c, trinket: e.target.value }))}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                  placeholder="e.g. A silver locket with a faded portrait" />
              </div>
            </div>
          )}

          {/* ── Step 5: Character Background ── */}
          {step === 5 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.7 }}>
                <strong style={{ color: '#c4b5fd', display: 'block', marginBottom: '6px' }}>Optional — skip if you prefer to discover your character in play.</strong>
                Your background gives the DM and portrait artist context. It can be one sentence or a full paragraph — the AI weaves it into your story, encounters, and portrait.
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ color: '#94a3b8', cursor: 'help' }}
                    onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.BACKGROUND_STORY.title, MECHANIC_TIPS.BACKGROUND_STORY.body, '#c4b5fd'), e)}
                    onMouseLeave={hideTooltip}>
                    Character Background <span style={{ fontSize: '0.72rem', color: '#475569' }}>(optional, up to 500 characters)</span>
                  </label>
                  <button
                    onClick={async () => {
                      setGeneratingBg(true);
                      try {
                        const res = await fetch('/api/generate-background', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: character.name.trim() || undefined,
                            race: character.race,
                            cls: character.class,
                            sex: character.sex,
                            alignment: character.alignment || undefined,
                            title: character.title.trim() || undefined,
                          }),
                        });
                        const { background } = await res.json() as { background?: string };
                        if (background) setCharBackground(background);
                      } catch { /* silently ignore */ }
                      setGeneratingBg(false);
                    }}
                    disabled={generatingBg || !character.race || !character.class}
                    onMouseEnter={e => showTooltip(tipBox('✨ Generate with AI', 'Uses AI to write a ~500-character backstory tailored to your race, class, alignment, and name. You can edit the result freely after it generates.', '#c4b5fd'), e)}
                    onMouseLeave={hideTooltip}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold',
                      border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.12)',
                      color: generatingBg ? '#64748b' : '#c4b5fd',
                      cursor: (generatingBg || !character.race || !character.class) ? 'not-allowed' : 'pointer',
                      opacity: (generatingBg || !character.race || !character.class) ? 0.6 : 1,
                      transition: 'all 0.15s', flexShrink: 0,
                    }}
                  >
                    {generatingBg ? '✨ Generating…' : '✨ Generate with AI'}
                  </button>
                </div>
                <textarea
                  value={charBackground}
                  onChange={e => setCharBackground(e.target.value)}
                  rows={7}
                  maxLength={500}
                  placeholder="e.g. A former soldier who abandoned their post after witnessing a massacre. Haunted by guilt, they now wander seeking redemption through service to the weak. They carry a broken sword hilt as a reminder of their failure — and their vow to do better."
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.9rem', lineHeight: 1.65, resize: 'vertical', fontFamily: 'inherit', opacity: generatingBg ? 0.5 : 1, transition: 'opacity 0.2s' }}
                />
                <p style={{ color: '#374151', fontSize: '0.72rem', textAlign: 'right', marginTop: '4px' }}>
                  {charBackground.length} / 500
                </p>
              </div>
            </div>
          )}

          {/* ── Step 6: Spells (spellcasters only) ── */}
          {step === 6 && isSpellcaster && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', fontSize: '0.82rem', color: '#c4b5fd', lineHeight: 1.5 }}>
                As a Level 1 <strong>{character.class}</strong>, you start with no spells readied.
                Select your spells below — these are what you carry into the world.
                {SPELL_LIMITS[character.class]?.spellFormula && (
                  <span> Your prepared count is determined by your ability modifier.</span>
                )}
              </div>

              {spellCounts.cantrips > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'help' }}
                      onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.CANTRIP.title, MECHANIC_TIPS.CANTRIP.body, '#8b5cf6'), e)}
                      onMouseLeave={hideTooltip}>Cantrips (at-will)</h3>
                    <span style={{ fontSize: '0.78rem', color: selectedCantrips.length === spellCounts.cantrips ? '#22c55e' : '#8b5cf6', fontWeight: 'bold' }}>
                      {selectedCantrips.length} / {spellCounts.cantrips} selected
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {availableCantrips.map(spell => (
                      <SpellCard key={spell.name} spell={spell}
                        selected={selectedCantrips.includes(spell.name)}
                        disabled={selectedCantrips.length >= spellCounts.cantrips && !selectedCantrips.includes(spell.name)}
                        onToggle={() => toggleCantrip(spell.name)}
                        showTooltip={showTooltip} hideTooltip={hideTooltip} />
                    ))}
                  </div>
                </div>
              )}

              {spellCounts.spells > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'help' }}
                      onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.PREPARED_SPELL.title, MECHANIC_TIPS.PREPARED_SPELL.body, '#8b5cf6'), e)}
                      onMouseLeave={hideTooltip}>1st-Level Spells</h3>
                    <span style={{ fontSize: '0.78rem', color: selectedSpells.length === spellCounts.spells ? '#22c55e' : '#8b5cf6', fontWeight: 'bold' }}>
                      {selectedSpells.length} / {spellCounts.spells} {SPELL_LIMITS[character.class]?.spellFormula ? 'prepared' : 'known'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {availableSpells.map(spell => (
                      <SpellCard key={spell.name} spell={spell}
                        selected={selectedSpells.includes(spell.name)}
                        disabled={selectedSpells.length >= spellCounts.spells && !selectedSpells.includes(spell.name)}
                        onToggle={() => toggleSpell(spell.name)}
                        showTooltip={showTooltip} hideTooltip={hideTooltip} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={step === 1 ? () => router.push('/dashboard') : prevStep}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < totalSteps ? (
            <button className="btn-primary" onClick={nextStep} disabled={!canProceed}>
              Next Step
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleFinish}
              disabled={saving || portraitGenerating || (isSpellcaster && !spellsReady)}
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Creating…' : 'Complete Character'}
            </button>
          )}
        </div>

      </div>
      </div>
      {TooltipPortal}
    </main>
  );
}
