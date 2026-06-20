"use client";
// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for the character-creation UI.
// Used by BOTH /create-character and /create-campaign so they can never diverge.
// The component is CONTROLLED: the parent owns `form` (a CharForm) + navigation;
// this renders one step's content and reports edits via `patch`. Ability-score
// roll animation + hover state are internal.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type CSSProperties } from "react";
import {
  CANTRIPS, LEVEL1_SPELLS, SPELL_LIMITS, SPELLCASTING_CLASSES,
  getSpellCounts, CLASS_STAT_GUIDES, getTierStyle, computeAC, type SpellEntry,
} from "../lib/spellData";
import {
  starterWeaponsFor, starterArmorFor, classCanUseShield, isTwoHanded,
  describeWeapon, describeArmor, armorInventoryEntry, classUnarmoredDefense,
  armorByName, weaponTag, isLightMelee, classOffhandWeapons,
} from "../lib/equipmentData";
import {
  CLASS_PROFICIENCIES, STANDARD_ARRAY, POINT_BUY_COST, POINT_BUY_BUDGET, calcPointBuyCost,
} from "../lib/proficiencyData";
import { tipBox, tipBoxNode } from "../hooks/useTooltip";
import { sanitizeCharacterName } from "../lib/nameValidation";
import {
  STAT_TIPS, RACE_TIPS, CLASS_TIPS, ALIGNMENT_TIPS, SKILL_TIPS, STAT_METHOD_TIPS,
  PROF_TIPS, MECHANIC_TIPS, SPELL_SCHOOL_TIPS,
} from "../lib/tooltipData";
import { SPELL_PRACTICAL } from "../lib/spellTooltips";
import { WeaponIcon, hasWeaponIcon } from "./WeaponIcons";

// ── Shared types ──────────────────────────────────────────────────────────────
export type AbilityScores = {
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
};
export type StatMethod = "roll" | "array" | "pointbuy";

/** The full per-character draft both pages edit. */
export interface CharForm {
  name: string; title: string; race: string; class: string; sex: string;
  alignment: string; weapon: string; offHand: string; armor: string; trinket: string; shield: boolean;
  background: string;
  skillProficiencies: string[];
  scores: AbilityScores;
  statMethod: StatMethod;
  cantrips: string[];
  spells: string[];
}

export const POINTBUY_DEFAULT: AbilityScores = {
  strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8,
};

export function emptyForm(): CharForm {
  return {
    name: "", title: "", race: "", class: "", sex: "male",
    alignment: "", weapon: "", offHand: "", armor: "", trinket: "", shield: false, background: "",
    skillProficiencies: [],
    scores: { ...POINTBUY_DEFAULT },
    statMethod: "pointbuy",
    cantrips: [], spells: [],
  };
}

// ── Shared data + helpers ───────────────────────────────────────────────────────
const STAT_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const STAT_LABELS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;

export const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
};
export function startingHP(cls: string, con: number): number {
  return Math.max(1, (CLASS_HIT_DIE[cls] ?? 8) + Math.floor((con - 10) / 2));
}
export const STEP_TITLES = ["Identity & Origins", "Class & Proficiencies", "Ability Scores", "Starting Equipment", "Character Background", "Spells & Cantrips"];
export const STEP_ICONS = ["🧑", "⚔️", "🎲", "🗡️", "📜", "✨"];

/** Sentinel "no dice rolled yet" grid — Roll mode starts here so it never
 *  inherits the Standard Array / Point Buy values and looks pre-filled. */
export const UNROLLED_SCORES: AbilityScores = {
  strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0,
};
/** True while the player is on Roll mode but hasn't rolled yet (grid is the
 *  sentinel all-zero state). Used to show "—" and gate the Next button. */
export function isRollUnrolled(form: CharForm): boolean {
  return form.statMethod === "roll" && STAT_KEYS.every(k => form.scores[k as keyof AbilityScores] === 0);
}

/** Does this class actually pick spells at level 1? (Half-casters don't.) */
export function isSpellcasterForm(form: CharForm): boolean {
  const sc = getSpellCounts(form.class, form.scores);
  return sc.cantrips > 0 || sc.spells > 0;
}
export function totalStepsForForm(form: CharForm): number {
  return isSpellcasterForm(form) ? 6 : 5;
}

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

const RACE_EMOJI: Record<string, string> = {
  Human: "⚔", Elf: "🌙", Dwarf: "🪨", Halfling: "🌿",
  Dragonborn: "🐉", Tiefling: "🔥", Gnome: "🔮", "Half-Elf": "✦", "Half-Orc": "💪",
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
function classPortraitPath(cls: string): string { return `/classes/${cls.toLowerCase()}.png`; }
const ALIGNMENT_COLORS: Record<string, string> = {
  "Lawful Good": "#f59e0b", "Neutral Good": "#fbbf24", "Chaotic Good": "#22c55e",
  "Lawful Neutral": "#8b5cf6", "True Neutral": "var(--muted)", "Chaotic Neutral": "#f97316",
  "Lawful Evil": "#6366f1", "Neutral Evil": "#ef4444", "Chaotic Evil": "#dc2626",
};

// Inline d20 — iconic heading mark used by both pages' step-1 header. Exported.
export function D20Icon({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block", margin: "0 auto", filter: "drop-shadow(0 4px 12px rgba(139,92,246,0.5))" }}>
      <defs>
        <linearGradient id="d20BodyCS" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id="d20FaceCS" x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd" /><stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M76,14 L92,64 L50,94 L8,64 L24,14 Z" fill="url(#d20BodyCS)" stroke="#e9d5ff" strokeWidth="1.4" />
      <path d="M50,50 L27,43 L50,26 Z" fill="#c4b5fd" opacity="0.95" />
      <path d="M50,50 L50,26 L73,43 Z" fill="#a78bfa" opacity="0.85" />
      <path d="M50,50 L73,43 L64,69 Z" fill="#8b5cf6" opacity="0.8" />
      <path d="M50,50 L36,69 L27,43 Z" fill="#9333ea" opacity="0.8" />
      <path d="M50,50 L64,69 L36,69 Z" fill="url(#d20FaceCS)" />
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
  const color = schoolColors[spell.school] ?? "var(--subtle)";
  const practical = SPELL_PRACTICAL[spell.name];
  const schoolTip = SPELL_SCHOOL_TIPS[spell.school];
  // Rich, spell-specific tooltip: what it does, when/why to use it, and its school.
  const richTip = (
    <>
      <div style={{ color: "var(--foreground)", marginBottom: practical ? "8px" : 0, lineHeight: 1.4 }}>{spell.desc}.</div>
      {practical && (
        <div style={{ color: "var(--subtle)", lineHeight: 1.5 }}>
          <span style={{ color: "#fbbf24", fontWeight: 700 }}>Practical use — </span>{practical}
        </div>
      )}
      <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid rgba(148,163,184,0.2)", fontSize: "0.82em", color: "var(--muted)", lineHeight: 1.4 }}>
        <span style={{ color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{spell.school}</span>
        {schoolTip ? ` — ${schoolTip.body}` : ""}
      </div>
    </>
  );
  return (
    <div onClick={() => !disabled && onToggle()}
      onMouseEnter={e => showTooltip?.(tipBoxNode(spell.name, richTip, color), e)}
      onMouseLeave={() => hideTooltip?.()}
      style={{
        padding: "10px 12px", borderRadius: "8px",
        border: `1px solid ${selected ? color : "var(--border)"}`,
        background: selected ? `${color}18` : "var(--inset-bg)",
        cursor: disabled && !selected ? "not-allowed" : "pointer",
        opacity: disabled && !selected ? 0.45 : 1, transition: "all 0.15s",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: "bold", color: selected ? color : "var(--foreground)" }}>{spell.name}</span>
        {selected && <span style={{ fontSize: "0.65rem", color, flexShrink: 0 }}>✓</span>}
      </div>
      <div style={{ fontSize: "0.62rem", color, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em", display: "inline-block" }}>{spell.school}</div>
      <div style={{ fontSize: "0.72rem", color: "var(--subtle)", marginTop: "4px", lineHeight: 1.35 }}>{spell.desc}</div>
    </div>
  );
}

/** Pithy one-liner per ability for the always-visible left rail. Exported so both
 *  pages render the identical reference panel. */
export const STAT_LEGEND: { code: typeof STAT_LABELS[number]; line: string; color: string }[] = [
  { code: "STR", line: "Power, melee hits, carry weight",   color: "#ef4444" },
  { code: "DEX", line: "Agility, ranged hits, AC, stealth", color: "#22c55e" },
  { code: "CON", line: "Toughness, max HP, concentration",  color: "#f97316" },
  { code: "INT", line: "Reasoning, Arcana, Wizard magic",   color: "#3b82f6" },
  { code: "WIS", line: "Perception, Cleric & Druid magic",  color: "#eab308" },
  { code: "CHA", line: "Presence, Bard/Sorcerer/Warlock",   color: "#ec4899" },
];

// ── The controlled component ────────────────────────────────────────────────────
export interface CharacterStepsProps {
  step: number;                              // 1-6
  form: CharForm;
  patch: (p: Partial<CharForm>) => void;
  showTooltip: (c: React.ReactNode, e: React.MouseEvent) => void;
  hideTooltip: () => void;
  nameError: string;
  setNameError: (s: string) => void;
}

export function CharacterSteps({ step, form, patch, showTooltip, hideTooltip, nameError, setNameError }: CharacterStepsProps) {
  const [hoveredRace, setHoveredRace]   = useState<string | null>(null);
  const [hoveredClass, setHoveredClass] = useState<string | null>(null);
  const [hoveredAlign, setHoveredAlign] = useState<string | null>(null);
  const [rollingStats, setRollingStats] = useState(false);
  const [revealCount, setRevealCount]   = useState(6);
  const [generatingBg, setGeneratingBg] = useState(false);

  const scores = form.scores;
  const spellCounts       = getSpellCounts(form.class, scores);
  const availableCantrips = CANTRIPS[form.class] ?? [];
  const availableSpells   = LEVEL1_SPELLS[form.class] ?? [];
  const pointsLeft        = POINT_BUY_BUDGET - calcPointBuyCost(scores);
  const profRequired      = form.class ? (CLASS_PROFICIENCIES[form.class]?.skillChoices.count ?? 0) : 0;
  const profData          = form.class ? CLASS_PROFICIENCIES[form.class] : null;

  const handleStatMethodChange = (method: StatMethod) => {
    if (method === "pointbuy") { patch({ statMethod: method, scores: { ...POINTBUY_DEFAULT } }); return; }
    if (method === "array") {
      const arranged = { ...scores };
      STAT_KEYS.forEach((k, i) => { arranged[k as keyof AbilityScores] = STANDARD_ARRAY[i]; });
      patch({ statMethod: method, scores: arranged }); return;
    }
    // Roll starts on an empty grid so it never inherits the Array / Point Buy
    // numbers — the player must actually roll before any values appear.
    patch({ statMethod: method, scores: { ...UNROLLED_SCORES } });
  };
  const adjustPBStat = (statKey: string, delta: number) => {
    const current = scores[statKey as keyof AbilityScores];
    const newVal = current + delta;
    if (newVal < 8 || newVal > 15) return;
    const newScores = { ...scores, [statKey as keyof AbilityScores]: newVal };
    if (calcPointBuyCost(newScores) > POINT_BUY_BUDGET) return;
    patch({ scores: newScores });
  };
  const adjustStat = (statKey: string, delta: number) => {
    if (form.statMethod === "pointbuy") { adjustPBStat(statKey, delta); return; }
    const cur = scores[statKey as keyof AbilityScores];
    let targetKey: string | null = null;
    let best: number | null = null;
    STAT_KEYS.forEach(k => {
      if (k === statKey) return;
      const v = scores[k as keyof AbilityScores];
      if (delta > 0 && v > cur && (best === null || v < best)) { best = v; targetKey = k; }
      if (delta < 0 && v < cur && (best === null || v > best)) { best = v; targetKey = k; }
    });
    if (targetKey === null) return;
    const tk = targetKey as keyof AbilityScores;
    patch({ scores: { ...scores, [statKey as keyof AbilityScores]: scores[tk], [tk]: cur } });
  };
  const handleRollStats = () => {
    if (rollingStats) return;
    setRollingStats(true);
    setRevealCount(0);
    playDiceRollSound();
    setTimeout(() => {
      patch({ scores: rollAbilityScores() });
      STAT_KEYS.forEach((_, i) => setTimeout(() => setRevealCount(i + 1), i * 110));
      setTimeout(() => setRollingStats(false), STAT_KEYS.length * 110 + 100);
    }, 1100);
  };
  const toggleSkillProf = (skill: string) => {
    const prev = form.skillProficiencies;
    if (prev.includes(skill)) { patch({ skillProficiencies: prev.filter(s => s !== skill) }); return; }
    if (prev.length >= profRequired) return;
    patch({ skillProficiencies: [...prev, skill] });
  };
  const handleClassSelect = (cls: string) => {
    // Reset equipment to the new class's proficiencies. Default to its iconic
    // starter armor (e.g. Fighter → Chain Mail); no-armor classes start unarmored.
    const armorOpts = starterArmorFor(cls);
    patch({
      class: cls, cantrips: [], spells: [], skillProficiencies: [],
      weapon: "", offHand: "", armor: armorOpts[0]?.name ?? "", shield: false,
    });
  };
  const toggleCantrip = (name: string) => {
    const prev = form.cantrips;
    patch({ cantrips: prev.includes(name) ? prev.filter(n => n !== name) : prev.length < spellCounts.cantrips ? [...prev, name] : prev });
  };
  const toggleSpell = (name: string) => {
    const prev = form.spells;
    patch({ spells: prev.includes(name) ? prev.filter(n => n !== name) : prev.length < spellCounts.spells ? [...prev, name] : prev });
  };
  const isSpellcaster = spellCounts.cantrips > 0 || spellCounts.spells > 0;

  // ── Equipment step (step 4) derived values ──
  const weaponOptions   = starterWeaponsFor(form.class);
  const armorOptions     = starterArmorFor(form.class);
  const canShield        = classCanUseShield(form.class);
  const weaponTwoHanded  = form.weapon ? isTwoHanded(form.weapon) : false;
  const primaryLightMelee = form.weapon ? isLightMelee(form.weapon) : false;
  const offhandOptions   = classOffhandWeapons(form.class);
  // Off-hand (dual wield) is only offered for a light melee primary, and only if
  // the class actually has a second light weapon it can use.
  const canDualWield     = primaryLightMelee && offhandOptions.length > 0;
  const dualWielding     = canDualWield && !!form.offHand;
  // Shield and an off-hand weapon both need the free hand — they're exclusive, and
  // neither is possible with a two-handed weapon.
  const shieldActive     = form.shield && canShield && !weaponTwoHanded && !form.offHand;
  const previewItems     = [armorInventoryEntry(form.armor), ...(shieldActive ? ["Shield"] : [])];
  const previewAC        = computeAC(form.class, form.scores.dexterity, form.scores.constitution, form.scores.wisdom, previewItems, form.weapon ? [form.weapon] : []);
  // Selecting a weapon: drop anything the new grip can no longer support.
  const selectWeapon = (name: string) => patch({
    weapon: name,
    shield: isTwoHanded(name) ? false : form.shield,
    offHand: isLightMelee(name) ? form.offHand : "",   // off-hand only valid with a light melee primary
  });
  // Shield ⇄ off-hand are mutually exclusive.
  const toggleShield = () => { if (!weaponTwoHanded) patch({ shield: !form.shield, offHand: "" }); };
  const selectOffHand = (name: string) => patch({ offHand: form.offHand === name ? "" : name, shield: false });
  const fmtMod = (n: number) => (n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`);
  const acFormula = (): string => {
    const dexMod    = Math.floor((form.scores.dexterity - 10) / 2);
    const shieldStr = shieldActive ? " + 2 (Shield)" : "";
    const armor     = form.armor ? armorByName(form.armor) : undefined;
    if (armor) {
      if (armor.category === "light")  return `${armor.baseAC} (${armor.name}) ${fmtMod(dexMod)} (DEX)${shieldStr}`;
      if (armor.category === "medium") return `${armor.baseAC} (${armor.name}) ${fmtMod(Math.min(dexMod, armor.dexCap ?? 2))} (DEX, max +2)${shieldStr}`;
      return `${armor.baseAC} (${armor.name}, no DEX)${shieldStr}`;
    }
    const ud = classUnarmoredDefense(form.class);
    if (ud === "con") return `10 ${fmtMod(dexMod)} (DEX) ${fmtMod(Math.floor((form.scores.constitution - 10) / 2))} (CON — Unarmored Defense)${shieldStr}`;
    if (ud === "wis") return `10 ${fmtMod(dexMod)} (DEX) ${fmtMod(Math.floor((form.scores.wisdom - 10) / 2))} (WIS — Unarmored Defense)`;
    return `10 ${fmtMod(dexMod)} (DEX)${shieldStr}`;
  };

  // ── Unified ability-score grid ──
  const renderUnifiedGrid = () => (
    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" }}>
      {STAT_LABELS.map((label, statIdx) => {
        const statKey   = STAT_KEYS[statIdx];
        const val       = scores[statKey];
        // Roll mode before any dice are thrown: show a dash, not a number.
        const unrolled  = form.statMethod === "roll" && !rollingStats && val === 0;
        const isRevealed = form.statMethod !== "roll" || revealCount > statIdx;
        const m         = Math.floor((val - 10) / 2);
        const guide     = CLASS_STAT_GUIDES[form.class]?.[label];
        const tierStyle = guide ? getTierStyle(guide.tier) : null;
        let canDec: boolean, canInc: boolean;
        if (form.statMethod === "pointbuy") {
          const incCost = (POINT_BUY_COST[val + 1] ?? 99) - (POINT_BUY_COST[val] ?? 0);
          canDec = val > 8;
          canInc = val < 15 && pointsLeft >= incCost;
        } else {
          canInc = STAT_KEYS.some(k => k !== statKey && scores[k] > val);
          canDec = STAT_KEYS.some(k => k !== statKey && scores[k] < val);
        }
        const locked = form.statMethod === "roll" && rollingStats;
        const decOn = canDec && !locked, incOn = canInc && !locked;
        const stepBtn = (on: boolean) => ({
          width: "34px", height: "34px", borderRadius: "8px", border: "1px solid var(--border)",
          background: on ? "rgba(139,92,246,0.15)" : "transparent",
          color: on ? "var(--foreground)" : "#9ca3af", cursor: on ? "pointer" : "not-allowed",
          fontWeight: "bold", fontSize: "1.35rem", lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        } as CSSProperties);
        const stepLbl = form.statMethod === "pointbuy" ? ["Lower", "Raise"] : ["Move down a rank", "Move up a rank"];
        return (
          <div key={label}
            style={{ position: "relative", padding: "20px 16px", background: "var(--card-bg)", borderRadius: "12px", textAlign: "center", minWidth: "128px", border: `2px solid ${tierStyle && isRevealed ? tierStyle.color + "55" : "var(--border)"}`, transition: "all 0.15s" }}
            onMouseEnter={e => {
              const st = STAT_TIPS[label]; if (!st) return;
              const accent = tierStyle ? tierStyle.color : "#8b5cf6";
              showTooltip(tipBoxNode(st.title, <>
                {guide && tierStyle && <div style={{ color: tierStyle.color, fontWeight: 600, marginBottom: "4px", fontSize: "0.9em" }}>{tierStyle.label} for {form.class}</div>}
                <div style={{ color: "var(--subtle)" }}>{st.body}</div>
                {guide && <div style={{ color: "var(--muted)", fontSize: "0.9em", marginTop: "4px" }}>{guide.reason}</div>}
              </>, accent), e);
            }}
            onMouseLeave={hideTooltip}
          >
            <div style={{ fontSize: "1rem", color: "var(--subtle)", marginBottom: "10px", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <button onClick={() => adjustStat(statKey, -1)} disabled={!decOn} title={stepLbl[0]} style={stepBtn(decOn)}>−</button>
              <span style={{ fontWeight: "bold", fontSize: "2.1rem", minWidth: "34px", lineHeight: 1, color: isRevealed ? "var(--foreground)" : "#9ca3af", transition: "color 0.2s" }}>{isRevealed ? val : (unrolled ? "—" : "??")}</span>
              <button onClick={() => adjustStat(statKey, 1)} disabled={!incOn} title={stepLbl[1]} style={stepBtn(incOn)}>+</button>
            </div>
            <div style={{ fontSize: "1.05rem", color: isRevealed ? (m >= 0 ? "#16a34a" : "#dc2626") : "#9ca3af", fontWeight: 600, marginTop: "8px" }}>{isRevealed ? (m >= 0 ? `+${m}` : m) : (unrolled ? "—" : "--")}</div>
            {form.statMethod === "pointbuy" && (
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "4px" }}>{POINT_BUY_COST[val]}pt{POINT_BUY_COST[val] !== 1 ? "s" : ""}</div>
            )}
            {isRevealed && tierStyle && (
              <div style={{ fontSize: "0.7rem", color: tierStyle.color, marginTop: "6px", fontWeight: "bold", letterSpacing: "0.08em" }}>{tierStyle.label.toUpperCase()}</div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* ── Step 1: Identity ── */}
      {step === 1 && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div style={{ display: "flex", gap: "14px" }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: "block", marginBottom: "10px", color: "var(--foreground)", fontSize: "1.15rem", fontWeight: 600, letterSpacing: "0.02em", cursor: "help" }}
                onMouseEnter={e => showTooltip(tipBox("Character Name", "What your hero is called in the world. The DM and other players will use this name throughout your adventure.", "#c4b5fd"), e)}
                onMouseLeave={hideTooltip}>Character Name</label>
              <input type="text" value={form.name}
                onChange={e => { const clean = sanitizeCharacterName(e.target.value); setNameError(clean !== e.target.value ? "Names use letters, spaces, apostrophes, and hyphens only." : ""); patch({ name: clean }); }}
                style={{ width: "100%", padding: "18px 20px", borderRadius: "10px", border: `1px solid ${nameError ? "#ef4444" : "var(--border)"}`, background: "var(--inset-bg)", color: "var(--foreground)", fontSize: "1.2rem" }}
                placeholder="e.g. Elara Moonwhisper" />
              {nameError && <p style={{ color: "#ef4444", fontSize: "0.9rem", marginTop: "8px" }}>{nameError}</p>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "10px", color: "var(--foreground)", fontSize: "1.15rem", fontWeight: 600, letterSpacing: "0.02em", cursor: "help" }}
                onMouseEnter={e => showTooltip(tipBox("Title", "An optional honorific like \"the Brave\" or \"Shadowbane.\" The DM uses it alongside your name in narration — e.g. \"Aria the Brave steps forward…\"", "#c4b5fd"), e)}
                onMouseLeave={hideTooltip}>Title <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label>
              <input type="text" value={form.title} maxLength={40}
                onChange={e => patch({ title: e.target.value })}
                style={{ width: "100%", padding: "18px 20px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--inset-bg)", color: "var(--foreground)", fontSize: "1.2rem" }}
                placeholder="e.g. the Brave" />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "14px", color: "var(--foreground)", fontSize: "1.25rem", fontWeight: 600, letterSpacing: "0.02em", cursor: "help" }}
              onMouseEnter={e => showTooltip(tipBox("Race", "Your character's ancestry — determines stat bonuses, special abilities, darkvision, and innate traits. Hover any race for details.", "#c4b5fd"), e)}
              onMouseLeave={hideTooltip}>Race</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(clamp(150px, 18vw, 220px), 1fr))", gap: "clamp(12px, 1.3vw, 18px)" }}>
              {["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Tiefling", "Gnome", "Half-Elf", "Half-Orc"].map(race => (
                <div key={race}
                  onClick={() => patch({ race })}
                  onMouseEnter={e => { setHoveredRace(race); const t = RACE_TIPS[race]; if (t) showTooltip(tipBox(t.title, t.body, "#c4b5fd"), e); }}
                  onMouseLeave={() => { setHoveredRace(null); hideTooltip(); }}
                  style={{ padding: "22px 14px 18px", borderRadius: "14px", border: `2px solid ${form.race === race ? "var(--primary)" : hoveredRace === race ? "rgba(139,92,246,0.55)" : "var(--border)"}`, background: form.race === race ? "rgba(139,92,246,0.22)" : hoveredRace === race ? "rgba(139,92,246,0.1)" : "var(--inset-bg)", cursor: "pointer", textAlign: "center", transition: "all 0.2s", transform: form.race === race ? "translateY(-4px)" : hoveredRace === race ? "translateY(-2px)" : "none", boxShadow: form.race === race ? "0 10px 30px rgba(139,92,246,0.45), 0 0 0 1px rgba(139,92,246,0.5) inset" : "none" }}>
                  <div style={{ position: "relative", width: "96px", height: "96px", margin: "0 auto 12px", borderRadius: "50%", overflow: "hidden", background: "var(--inset-bg)", border: `2px solid ${form.race === race ? "rgba(196,181,253,0.7)" : "rgba(148,163,184,0.2)"}`, boxShadow: form.race === race ? "0 0 22px rgba(139,92,246,0.55)" : "none" }}>
                    <img src={`/races/${race.toLowerCase().replace("-", "_")}.png`} alt={`${race} emblem`}
                      onError={e => { const i = e.currentTarget; i.style.display = "none"; const fb = i.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = "flex"; }}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: "2.6rem", position: "absolute", inset: 0 }}>{RACE_EMOJI[race] ?? "🧙"}</div>
                  </div>
                  <div style={{ fontSize: "1.15rem", fontWeight: form.race === race ? 700 : 600, color: form.race === race ? "var(--accent-strong)" : "var(--foreground)", letterSpacing: "0.02em" }}>{race}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "14px", color: "var(--foreground)", fontSize: "1.25rem", fontWeight: 600, letterSpacing: "0.02em", cursor: "help" }}
              onMouseEnter={e => showTooltip(tipBox("Sex / Pronouns", "Sets the pronouns the DM uses when narrating your character's actions — he/him, she/her, or they/them.", "#c4b5fd"), e)}
              onMouseLeave={hideTooltip}>Sex</label>
            <div style={{ display: "flex", gap: "14px" }}>
              {(["male", "female", "non-binary"] as const).map(s => {
                const pronounMap = { male: "he/him", female: "she/her", "non-binary": "they/them" };
                return (
                  <div key={s} onClick={() => patch({ sex: s })}
                    onMouseEnter={e => showTooltip(tipBox(s.charAt(0).toUpperCase() + s.slice(1), `Pronouns: ${pronounMap[s]} — the DM will refer to your character using these pronouns.`, "#c4b5fd"), e)}
                    onMouseLeave={hideTooltip}
                    style={{ flex: 1, padding: "22px 16px", borderRadius: "12px", border: `2px solid ${form.sex === s ? "var(--primary)" : "var(--border)"}`, background: form.sex === s ? "rgba(139,92,246,0.22)" : "var(--inset-bg)", cursor: "pointer", textAlign: "center", transition: "all 0.2s", textTransform: "capitalize", boxShadow: form.sex === s ? "0 6px 22px rgba(139,92,246,0.4)" : "none" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: form.sex === s ? 700 : 600, color: form.sex === s ? "var(--accent-strong)" : "var(--foreground)" }}>{s}</div>
                    <div style={{ fontSize: "0.8rem", color: form.sex === s ? "var(--accent-strong)" : "var(--muted)", marginTop: "6px", letterSpacing: "0.04em", textTransform: "none" }}>{pronounMap[s]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "14px", color: "var(--foreground)", fontSize: "1.25rem", fontWeight: 600, letterSpacing: "0.02em", cursor: "help" }}
              onMouseEnter={e => showTooltip(tipBox("Alignment", "Your character's moral and ethical outlook. Optional — shapes how the DM portrays NPC reactions and your character's motivations. Hover any alignment for its description.", "#a78bfa"), e)}
              onMouseLeave={hideTooltip}>Alignment <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 400 }}>(optional — shapes how the DM reads your character)</span></label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(clamp(120px, 12vw, 170px), 1fr))", gap: "clamp(10px, 1vw, 14px)" }}>
              {ALIGNMENTS.map(a => (
                <div key={a.key}
                  onClick={() => patch({ alignment: form.alignment === a.key ? "" : a.key })}
                  onMouseEnter={e => { setHoveredAlign(a.key); showTooltip(tipBox(a.key, ALIGNMENT_TIPS[a.key] ?? a.desc, ALIGNMENT_COLORS[a.key] ?? "#a78bfa"), e); }}
                  onMouseLeave={() => { setHoveredAlign(null); hideTooltip(); }}
                  style={{ padding: "18px 12px", borderRadius: "12px", cursor: "pointer", textAlign: "center", transition: "all 0.2s", border: `2px solid ${form.alignment === a.key ? (ALIGNMENT_COLORS[a.key] ?? "var(--primary)") : hoveredAlign === a.key ? (ALIGNMENT_COLORS[a.key] ?? "#8b5cf6") + "77" : "var(--border)"}`, background: form.alignment === a.key ? (ALIGNMENT_COLORS[a.key] ?? "#8b5cf6") + "22" : hoveredAlign === a.key ? (ALIGNMENT_COLORS[a.key] ?? "#8b5cf6") + "14" : "var(--inset-bg)", transform: form.alignment === a.key ? "translateY(-3px)" : "none", boxShadow: form.alignment === a.key ? `0 8px 24px ${ALIGNMENT_COLORS[a.key] ?? "#8b5cf6"}44` : "none" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "0.1em", color: form.alignment === a.key ? (ALIGNMENT_COLORS[a.key] ?? "var(--accent-strong)") : "var(--subtle)", textTransform: "uppercase", marginBottom: "4px", lineHeight: 1 }}>{a.short}</div>
                  <div style={{ fontSize: "0.95rem", color: form.alignment === a.key ? "var(--foreground)" : "var(--subtle)", lineHeight: 1.25, fontWeight: form.alignment === a.key ? 600 : 400 }}>{a.key}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Class & Proficiencies ── */}
      {step === 2 && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "10px", color: "var(--subtle)", fontSize: "1rem" }}>Class</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(clamp(130px, 14vw, 180px), 1fr))", gap: "clamp(10px, 1.2vw, 16px)" }}>
              {["Fighter", "Wizard", "Rogue", "Cleric", "Paladin", "Ranger", "Bard", "Warlock", "Barbarian", "Druid", "Monk", "Sorcerer"].map(cls => {
                const ct = CLASS_TIPS[cls];
                const clsColor = CLASS_COLORS[cls] ?? "#8b5cf6";
                return (
                  <div key={cls} onClick={() => handleClassSelect(cls)}
                    onMouseEnter={e => { setHoveredClass(cls); if (ct) showTooltip(tipBoxNode(ct.title, <><div style={{ color: "var(--muted)", fontSize: "0.9em", marginBottom: "4px" }}>Hit Die: {ct.hitDie} · Primary: {ct.primaryStat}</div><div style={{ color: "var(--subtle)" }}>{ct.body}</div></>, clsColor), e); }}
                    onMouseLeave={() => { setHoveredClass(null); hideTooltip(); }}
                    style={{ padding: "14px 8px 10px", borderRadius: "12px", border: `1px solid ${form.class === cls ? clsColor : hoveredClass === cls ? clsColor + "77" : "var(--border)"}`, background: form.class === cls ? clsColor + "22" : hoveredClass === cls ? clsColor + "11" : "var(--inset-bg)", cursor: "pointer", textAlign: "center", transition: "all 0.2s", transform: form.class === cls ? "translateY(-3px)" : hoveredClass === cls ? "translateY(-1px)" : "none", boxShadow: form.class === cls ? `0 6px 22px ${clsColor}44` : "none" }}>
                    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", marginBottom: "8px", borderRadius: "8px", overflow: "hidden", background: "var(--inset-bg)", border: `1px solid ${form.class === cls ? clsColor + "88" : "rgba(148,163,184,0.15)"}` }}>
                      <img src={classPortraitPath(cls)} alt={`${cls} example portrait`}
                        onError={e => { const i = e.currentTarget; i.style.display = "none"; const fb = i.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = "flex"; }}
                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
                      <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: "2rem", position: "absolute", inset: 0 }}>{CLASS_EMOJI[cls] ?? "⚔️"}</div>
                    </div>
                    <div style={{ fontSize: "0.92rem", fontWeight: form.class === cls ? 700 : 400, color: form.class === cls ? clsColor : "var(--foreground)" }}>{cls}</div>
                    {SPELLCASTING_CLASSES.has(cls) && <div style={{ fontSize: "0.6rem", color: "#8b5cf6", marginTop: "3px", letterSpacing: "0.05em", fontWeight: 700 }}>✦ SPELL</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {profData && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)", fontSize: "0.8rem", color: "var(--subtle)", lineHeight: 1.7, display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <span><strong style={{ color: "var(--accent-strong)", cursor: "help" }} onMouseEnter={e => showTooltip(tipBox(PROF_TIPS.saves.title, PROF_TIPS.saves.body, "#c4b5fd"), e)} onMouseLeave={hideTooltip}>Saves:</strong> {profData.savingThrows.join(", ")}</span>
                <span style={{ color: "var(--muted)" }}>|</span>
                <span><strong style={{ color: "var(--accent-strong)", cursor: "help" }} onMouseEnter={e => showTooltip(tipBox(PROF_TIPS.armor.title, PROF_TIPS.armor.body, "#c4b5fd"), e)} onMouseLeave={hideTooltip}>Armor:</strong> {profData.armorProficiencies}</span>
                <span style={{ color: "var(--muted)" }}>|</span>
                <span><strong style={{ color: "var(--accent-strong)", cursor: "help" }} onMouseEnter={e => showTooltip(tipBox(PROF_TIPS.weapons.title, PROF_TIPS.weapons.body, "#c4b5fd"), e)} onMouseLeave={hideTooltip}>Weapons:</strong> {profData.weaponProficiencies}</span>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <label style={{ color: "var(--subtle)", fontSize: "0.9rem" }}>Choose <strong style={{ color: "var(--foreground)" }}>{profData.skillChoices.count}</strong> Skill Proficiencies</label>
                  <span style={{ fontSize: "0.78rem", fontWeight: "bold", color: form.skillProficiencies.length === profRequired ? "#16a34a" : "#8b5cf6" }}>{form.skillProficiencies.length} / {profRequired}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {profData.skillChoices.skills.map(skill => {
                    const selected = form.skillProficiencies.includes(skill);
                    const disabled = !selected && form.skillProficiencies.length >= profRequired;
                    return (
                      <div key={skill} onClick={() => toggleSkillProf(skill)}
                        onMouseEnter={e => { const st = SKILL_TIPS[skill]; if (st) showTooltip(tipBox(st.title, st.body), e); }}
                        onMouseLeave={hideTooltip}
                        style={{ padding: "6px 14px", borderRadius: "20px", cursor: disabled ? "not-allowed" : "pointer", border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`, background: selected ? "rgba(139,92,246,0.25)" : "transparent", color: selected ? "var(--foreground)" : disabled ? "var(--muted)" : "var(--subtle)", fontSize: "0.82rem", opacity: disabled ? 0.5 : 1, transition: "all 0.15s" }}>
                        {selected && <span style={{ marginRight: "4px", fontSize: "0.65rem" }}>✓</span>}{skill}
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
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", gap: "12px", paddingBottom: "20px", borderBottom: "1px solid var(--border)" }}>
            {(["roll", "array", "pointbuy"] as const).map(method => (
              <button key={method} onClick={() => handleStatMethodChange(method)}
                onMouseEnter={e => { const st = STAT_METHOD_TIPS[method]; if (st) showTooltip(tipBox(st.title, st.body), e); }}
                onMouseLeave={hideTooltip}
                style={{ padding: "14px 28px", borderRadius: "10px", cursor: "pointer", fontSize: "1.05rem", transition: "all 0.15s", border: `1px solid ${form.statMethod === method ? "var(--primary)" : "var(--border)"}`, background: form.statMethod === method ? "rgba(139,92,246,0.2)" : "transparent", color: form.statMethod === method ? "var(--foreground)" : "var(--subtle)", fontWeight: form.statMethod === method ? "bold" : "normal" }}>
                {method === "roll" ? "🎲 Roll" : method === "array" ? "📊 Standard Array" : "🔢 Point Buy"}
              </button>
            ))}
          </div>

          <div style={{ textAlign: "center", minHeight: "52px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            {form.statMethod === "pointbuy" && (
              <div>
                <span style={{ fontSize: "1.7rem", fontWeight: "bold", color: pointsLeft === 0 ? "#16a34a" : "var(--accent-strong)" }}>{pointsLeft}</span>
                <span style={{ color: "var(--subtle)", fontSize: "1.05rem" }}> / {POINT_BUY_BUDGET} points remaining</span>
                <div style={{ fontSize: "0.9rem", color: "var(--muted)", marginTop: "6px" }}>Use −/+ to raise or lower each stat. Range 8–15; cost rises at 14 and 15.</div>
              </div>
            )}
            {form.statMethod === "array" && (
              <div style={{ color: "var(--subtle)", fontSize: "1.02rem" }}>
                Fixed values <strong style={{ color: "var(--accent-strong)" }}>15 · 14 · 13 · 12 · 10 · 8</strong>
                <div style={{ fontSize: "0.9rem", color: "var(--muted)", marginTop: "6px" }}>Use the −/+ on each stat to rearrange the array however you like.</div>
              </div>
            )}
            {form.statMethod === "roll" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ fontSize: "3.2rem", animation: rollingStats ? "diceRoll 0.35s linear infinite" : "none", filter: rollingStats ? "drop-shadow(0 0 24px rgba(139,92,246,0.85))" : "none", transition: "filter 0.3s", lineHeight: 1 }}>🎲</div>
                <button className="btn-primary" onClick={handleRollStats} disabled={rollingStats} style={{ fontSize: "1.1rem", padding: "14px 28px", borderRadius: "12px" }}>{rollingStats ? "Rolling…" : "Roll Ability Scores (4d6 drop lowest)"}</button>
                <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Re-roll anytime, then use −/+ on each stat to rearrange the results.</div>
              </div>
            )}
          </div>

          {renderUnifiedGrid()}

          {form.class && (
            <p style={{ color: "var(--subtle)", fontSize: "1.05rem", textAlign: "center", marginTop: "6px" }}>
              Level 1 HP: <strong style={{ color: "var(--foreground)", fontSize: "1.2em" }}>{isRollUnrolled(form) ? "—" : startingHP(form.class, scores.constitution)}</strong>{" "}(d{CLASS_HIT_DIE[form.class] ?? 8} + CON mod)
            </p>
          )}

          <style>{`
            @keyframes diceRoll { 0%{transform:rotate(0deg) scale(1)} 25%{transform:rotate(90deg) scale(0.85)} 50%{transform:rotate(180deg) scale(1)} 75%{transform:rotate(270deg) scale(0.85)} 100%{transform:rotate(360deg) scale(1)} }
          `}</style>
        </div>
      )}

      {/* ── Step 4: Equipment ── */}
      {step === 4 && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Live Armor Class — reflects weapon/armor/shield choices in real time. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", padding: "12px 18px", borderRadius: "12px", background: "rgba(148,163,184,0.1)", border: "1px solid var(--border)", cursor: "help" }}
            onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.AC.title, `${MECHANIC_TIPS.AC.body}\n\nYours: ${acFormula()} = ${previewAC}`, "#94a3b8"), e)}
            onMouseLeave={hideTooltip}>
            <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>🛡</span>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Armor Class</div>
              <div style={{ fontSize: "1.7rem", fontWeight: "bold", color: "var(--foreground)", lineHeight: 1.1 }}>{previewAC}</div>
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--subtle)", maxWidth: "260px", lineHeight: 1.45 }}>{acFormula()}</div>
          </div>

          {/* Primary Weapon — curated to this class's proficiencies */}
          <div>
            <label style={{ display: "block", marginBottom: "10px", color: "var(--subtle)", fontSize: "1rem" }}>Primary Weapon <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>· {form.class} proficiencies</span></label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
              {weaponOptions.map(w => {
                const sel = form.weapon === w.name;
                return (
                  <div key={w.name} onClick={() => selectWeapon(w.name)}
                    onMouseEnter={e => { const t = describeWeapon(w.name); showTooltip(tipBox(t.title, t.body, "#f59e0b"), e); }}
                    onMouseLeave={hideTooltip}
                    style={{ padding: "18px 12px", borderRadius: "12px", border: `1px solid ${sel ? "#f59e0b" : "var(--border)"}`, background: sel ? "rgba(245,158,11,0.15)" : "var(--inset-bg)", cursor: "pointer", textAlign: "center", transition: "all 0.2s", transform: sel ? "translateY(-3px)" : "none", boxShadow: sel ? "0 6px 22px rgba(245,158,11,0.3)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                      {hasWeaponIcon(w.name)
                        ? <WeaponIcon name={w.name} size={48} />
                        : <span style={{ fontSize: "1.9rem", lineHeight: 1 }}>{w.icon}</span>}
                    </div>
                    <div style={{ fontSize: "0.92rem", fontWeight: sel ? 700 : 400, color: sel ? "#f59e0b" : "var(--foreground)" }}>{w.name}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "3px" }}>
                      {w.hands === "versatile" ? `${w.damage.split(" ")[0]}/${w.versatileDamage}` : w.damage.split(" ")[0]}
                      {weaponTag(w.name) ? <span style={{ color: w.hands === "2h" ? "#c084fc" : "var(--muted)", fontWeight: 600 }}> · {weaponTag(w.name)}</span> : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Armor — Unarmored + this class's proficient starter armors */}
          <div>
            <label style={{ display: "block", marginBottom: "10px", color: "var(--subtle)", fontSize: "1rem" }}>Armor</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
              {[null, ...armorOptions].map((a, i) => {
                const name = a ? a.name : "";
                const sel  = form.armor === name;
                const dexMod = Math.floor((form.scores.dexterity - 10) / 2);
                const acHint = a
                  ? (a.category === "heavy" ? `AC ${a.baseAC}` : a.category === "medium" ? `AC ${a.baseAC + Math.min(dexMod, a.dexCap ?? 2)}` : `AC ${a.baseAC + dexMod}`)
                  : (() => { const ud = classUnarmoredDefense(form.class); return ud === "con" ? `AC ${10 + dexMod + Math.floor((form.scores.constitution - 10) / 2)}` : ud === "wis" ? `AC ${10 + dexMod + Math.floor((form.scores.wisdom - 10) / 2)}` : `AC ${10 + dexMod}`; })();
                return (
                  <div key={i} onClick={() => patch({ armor: name })}
                    onMouseEnter={e => { const t = a ? describeArmor(a) : { title: "Unarmored", body: classUnarmoredDefense(form.class) ? "No armor. Your class's Unarmored Defense sets your AC from your ability scores." : "No armor worn. AC = 10 + your DEX modifier." }; showTooltip(tipBox(t.title, t.body, "#22c55e"), e); }}
                    onMouseLeave={hideTooltip}
                    style={{ padding: "14px 12px", borderRadius: "10px", border: `1px solid ${sel ? "#22c55e" : "var(--border)"}`, background: sel ? "rgba(34,197,94,0.13)" : "var(--inset-bg)", cursor: "pointer", textAlign: "center", transition: "all 0.18s" }}>
                    <div style={{ fontSize: "0.92rem", fontWeight: sel ? 700 : 500, color: sel ? "#16a34a" : "var(--foreground)" }}>{a ? a.name : "Unarmored"}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "3px" }}>{acHint}{a?.stealthDisadvantage ? " · Stealth ✗" : ""}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shield — only for classes proficient with shields */}
          {canShield && (
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "var(--subtle)" }}>Shield</label>
              <div onClick={toggleShield}
                onMouseEnter={e => showTooltip(tipBox("Shield", weaponTwoHanded ? "Unavailable: a two-handed weapon needs both hands. Choose a one-handed or versatile weapon to use a shield." : "+2 to Armor Class · Requires one free hand. Can't be combined with a two-handed weapon or with dual-wielding.", "#22c55e"), e)}
                onMouseLeave={hideTooltip}
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", borderRadius: "8px", cursor: weaponTwoHanded ? "not-allowed" : "pointer", opacity: weaponTwoHanded ? 0.5 : 1, transition: "all 0.2s", border: `1px solid ${shieldActive ? "var(--primary)" : "var(--border)"}`, background: shieldActive ? "rgba(139,92,246,0.2)" : "transparent" }}>
                <span style={{ fontSize: "1.5rem" }}>🛡</span>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "var(--foreground)" }}>Shield <span style={{ color: "#16a34a", fontSize: "0.8rem" }}>+2 AC</span></div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{weaponTwoHanded ? "Disabled — your weapon is two-handed" : dualWielding ? "Dual-wielding — click to swap to a shield" : "Requires one free hand — one-handed or versatile weapons"}</div>
                </div>
                <div style={{ marginLeft: "auto", width: "20px", height: "20px", borderRadius: "50%", border: `2px solid ${shieldActive ? "var(--primary)" : "var(--border)"}`, background: shieldActive ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.7rem", color: "#fff" }}>{shieldActive && "✓"}</div>
              </div>
            </div>
          )}

          {/* Off-hand weapon — dual wield (two-weapon fighting); only for a light melee primary */}
          {canDualWield && (
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "var(--subtle)" }}>Off-Hand Weapon <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>(dual wield — optional)</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
                {offhandOptions.map(w => {
                  const sel = form.offHand === w.name;
                  return (
                    <div key={w.name} onClick={() => selectOffHand(w.name)}
                      onMouseEnter={e => { const t = describeWeapon(w.name); showTooltip(tipBox(`Off-hand: ${t.title}`, `Two-weapon fighting: as a bonus action, make one extra attack with this light off-hand weapon.\n\n${t.body}`, "#a78bfa"), e); }}
                      onMouseLeave={hideTooltip}
                      style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "10px", border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}`, background: sel ? "rgba(139,92,246,0.18)" : "var(--inset-bg)", cursor: "pointer", transition: "all 0.15s" }}>
                      {hasWeaponIcon(w.name) ? <WeaponIcon name={w.name} size={32} /> : <span style={{ fontSize: "1.3rem" }}>{w.icon}</span>}
                      <span style={{ fontSize: "0.82rem", fontWeight: sel ? 700 : 500, color: sel ? "var(--accent-strong)" : "var(--foreground)" }}>{w.name}</span>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "6px" }}>
                {dualWielding
                  ? `Dual-wielding ${form.weapon} + ${form.offHand}. Click again to clear. (Uses your off hand — no shield.)`
                  : "Optional: pick a second light weapon to fight with two weapons. This uses your off hand, so you can't also carry a shield."}
              </p>
            </div>
          )}

          {/* Trinket — pure optional flavor for the DM to weave in */}
          <div>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--subtle)", cursor: "help" }}
              onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.TRINKET.title, MECHANIC_TIPS.TRINKET.body, "#f59e0b"), e)}
              onMouseLeave={hideTooltip}>Starting Trinket <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>(optional — pure flavor)</span></label>
            <input type="text" value={form.trinket} maxLength={120} onChange={e => patch({ trinket: e.target.value })}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--inset-bg)", color: "var(--foreground)", fontSize: "1rem" }}
              placeholder="e.g. A silver locket with a faded portrait — leave blank if you like" />
          </div>
        </div>
      )}

      {/* ── Step 5: Background ── */}
      {step === 5 && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ padding: "14px 18px", borderRadius: "10px", background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)", fontSize: "0.82rem", color: "var(--subtle)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--accent-strong)", display: "block", marginBottom: "6px" }}>Optional — skip if you prefer to discover your character in play.</strong>
            Your background gives the DM and portrait artist context. It can be one sentence or a full paragraph — the AI weaves it into your story, encounters, and portrait.
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ color: "var(--subtle)", cursor: "help" }}
                onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.BACKGROUND_STORY.title, MECHANIC_TIPS.BACKGROUND_STORY.body, "#c4b5fd"), e)}
                onMouseLeave={hideTooltip}>Character Background <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>(optional, up to 700 characters)</span></label>
              <button
                onClick={async () => {
                  setGeneratingBg(true);
                  try {
                    const res = await fetch("/api/generate-background", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: form.name.trim() || undefined, race: form.race, cls: form.class, sex: form.sex, alignment: form.alignment || undefined, title: form.title.trim() || undefined }),
                    });
                    const { background } = await res.json() as { background?: string };
                    if (background) patch({ background });
                  } catch { /* silently ignore */ }
                  setGeneratingBg(false);
                }}
                disabled={generatingBg || !form.race || !form.class}
                onMouseEnter={e => showTooltip(tipBox("✨ Generate with AI", "Uses AI to write a ~500-character backstory tailored to your race, class, alignment, and name. You can edit the result freely after it generates.", "#c4b5fd"), e)}
                onMouseLeave={hideTooltip}
                style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.12)", color: generatingBg ? "var(--muted)" : "var(--accent-strong)", cursor: (generatingBg || !form.race || !form.class) ? "not-allowed" : "pointer", opacity: (generatingBg || !form.race || !form.class) ? 0.6 : 1, transition: "all 0.15s", flexShrink: 0 }}>
                {generatingBg ? "✨ Generating…" : "✨ Generate with AI"}
              </button>
            </div>
            <textarea value={form.background} onChange={e => patch({ background: e.target.value })} rows={7} maxLength={700}
              placeholder="e.g. A former soldier who abandoned their post after witnessing a massacre. Haunted by guilt, they now wander seeking redemption through service to the weak."
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--inset-bg)", color: "var(--foreground)", fontSize: "0.9rem", lineHeight: 1.65, resize: "vertical", fontFamily: "inherit", opacity: generatingBg ? 0.5 : 1, transition: "opacity 0.2s" }} />
            <p style={{ color: "var(--muted)", fontSize: "0.72rem", textAlign: "right", marginTop: "4px" }}>{form.background.length} / 700</p>
          </div>
        </div>
      )}

      {/* ── Step 6: Spells ── */}
      {step === 6 && isSpellcaster && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", fontSize: "0.82rem", color: "var(--accent-strong)", lineHeight: 1.5 }}>
            As a Level 1 <strong>{form.class}</strong>, you start with no spells readied. Select your spells below — these are what you carry into the world.
            {SPELL_LIMITS[form.class]?.spellFormula && <span> Your prepared count is determined by your ability modifier.</span>}
          </div>
          {spellCounts.cantrips > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "0.9rem", fontWeight: "bold", color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "help" }} onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.CANTRIP.title, MECHANIC_TIPS.CANTRIP.body, "#8b5cf6"), e)} onMouseLeave={hideTooltip}>Cantrips (at-will)</h3>
                <span style={{ fontSize: "0.78rem", color: form.cantrips.length === spellCounts.cantrips ? "#16a34a" : "#8b5cf6", fontWeight: "bold" }}>{form.cantrips.length} / {spellCounts.cantrips} selected</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                {availableCantrips.map(spell => (
                  <SpellCard key={spell.name} spell={spell} selected={form.cantrips.includes(spell.name)} disabled={form.cantrips.length >= spellCounts.cantrips && !form.cantrips.includes(spell.name)} onToggle={() => toggleCantrip(spell.name)} showTooltip={showTooltip} hideTooltip={hideTooltip} />
                ))}
              </div>
            </div>
          )}
          {spellCounts.spells > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "0.9rem", fontWeight: "bold", color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "help" }} onMouseEnter={e => showTooltip(tipBox(MECHANIC_TIPS.PREPARED_SPELL.title, MECHANIC_TIPS.PREPARED_SPELL.body, "#8b5cf6"), e)} onMouseLeave={hideTooltip}>1st-Level Spells</h3>
                <span style={{ fontSize: "0.78rem", color: form.spells.length === spellCounts.spells ? "#16a34a" : "#8b5cf6", fontWeight: "bold" }}>{form.spells.length} / {spellCounts.spells} {SPELL_LIMITS[form.class]?.spellFormula ? "prepared" : "known"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                {availableSpells.map(spell => (
                  <SpellCard key={spell.name} spell={spell} selected={form.spells.includes(spell.name)} disabled={form.spells.length >= spellCounts.spells && !form.spells.includes(spell.name)} onToggle={() => toggleSpell(spell.name)} showTooltip={showTooltip} hideTooltip={hideTooltip} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
