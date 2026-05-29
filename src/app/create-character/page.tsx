"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../globals.css';

import { supabase } from '../../lib/supabaseClient';
import {
  CANTRIPS, LEVEL1_SPELLS, SPELL_LIMITS, SPELLCASTING_CLASSES,
  getSpellCounts, CLASS_STAT_GUIDES, getTierStyle, type SpellEntry,
} from '../../lib/spellData';

type AbilityScores = {
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
};

function roll4d6DropLowest(): number {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => a - b);
  return rolls.slice(1).reduce((a, b) => a + b, 0);
}

function rollAbilityScores(): AbilityScores {
  return {
    strength:     roll4d6DropLowest(),
    dexterity:    roll4d6DropLowest(),
    constitution: roll4d6DropLowest(),
    intelligence: roll4d6DropLowest(),
    wisdom:       roll4d6DropLowest(),
    charisma:     roll4d6DropLowest(),
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
  const hitDie = CLASS_HIT_DIE[cls] ?? 8;
  const conMod = Math.floor((con - 10) / 2);
  return Math.max(1, hitDie + conMod);
}

const DEFAULT_SCORES: AbilityScores = {
  strength: 15, dexterity: 14, constitution: 13,
  intelligence: 12, wisdom: 10, charisma: 8,
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

const RACE_TOOLTIPS: Record<string, string> = {
  Human:      "Adaptable and ambitious. +1 to all ability scores. Gains an extra skill proficiency and feat.",
  Elf:        "Keen senses and grace. Darkvision, advantage on saves vs. charm, immune to sleep magic.",
  Dwarf:      "Hardy and stoic. Poison resistance, proficiency with tools, advantage on saves vs. poison.",
  Halfling:   "Lucky and nimble. Reroll 1s on attack rolls, ability checks, and saving throws.",
  Dragonborn: "Draconic heritage. Breath weapon attack and resistance to that element type.",
  Tiefling:   "Infernal lineage. Resistance to fire, Hellish Rebuke, darkness spell at higher levels.",
  Gnome:      "Inventive and curious. Advantage on INT/WIS/CHA saving throws vs. magic.",
  "Half-Elf": "Human versatility and elven grace. Two extra skills, advantage on saves vs. charm.",
  "Half-Orc": "Fierce and resilient. Savage Attacks on crits, Relentless Endurance once per long rest.",
};

const CLASS_TOOLTIPS: Record<string, string> = {
  Fighter:   "Master of combat. Action Surge, Second Wind, Fighting Style. Multiple attacks at higher levels.",
  Wizard:    "Arcane scholar. Vast spellbook, Arcane Recovery of spell slots on a short rest.",
  Rogue:     "Cunning striker. Sneak Attack bonus damage, Cunning Action for Dash/Hide/Disengage.",
  Cleric:    "Divine agent. Healing spells, Turn Undead, powerful domain abilities.",
  Paladin:   "Holy warrior. Divine Smite on hits, Lay on Hands healing pool, aura bonuses.",
  Ranger:    "Wilderness expert. Hunter's Mark, Favored Enemy, Natural Explorer features.",
  Bard:      "Magical performer. Bardic Inspiration dice, Jack of All Trades skill versatility.",
  Warlock:   "Eldritch bargainer. Eldritch Blast, limited but fully recovering spell slots on short rest.",
  Barbarian: "Primal warrior. Rage for bonus damage and damage resistance, Reckless Attack advantage.",
  Druid:     "Nature's servant. Wild Shape into beasts, powerful nature magic, healing spells.",
  Monk:      "Martial artist. Ki points for Stunning Strike, Flurry of Blows, unarmored movement.",
  Sorcerer:  "Natural spellcaster. Metamagic to shape spells, Sorcery Points for flexible slot use.",
};

const STAT_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
const STAT_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

// ── Spell card component ──────────────────────────────────────────────────────
function SpellCard({
  spell, selected, disabled, onToggle,
}: {
  spell: SpellEntry; selected: boolean; disabled: boolean; onToggle: () => void;
}) {
  const schoolColors: Record<string, string> = {
    Evocation: "#ef4444", Abjuration: "#3b82f6", Conjuration: "#8b5cf6",
    Illusion: "#06b6d4", Enchantment: "#f59e0b", Necromancy: "#22c55e",
    Transmutation: "#f97316", Divination: "#e879f9",
  };
  const color = schoolColors[spell.school] ?? "#94a3b8";

  return (
    <div
      onClick={() => !disabled && onToggle()}
      style={{
        padding: "10px 12px",
        borderRadius: "8px",
        border: `1px solid ${selected ? color : "var(--border)"}`,
        background: selected ? `${color}18` : "rgba(0,0,0,0.2)",
        cursor: disabled && !selected ? "not-allowed" : "pointer",
        opacity: disabled && !selected ? 0.45 : 1,
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: "bold", color: selected ? color : "white" }}>
          {spell.name}
        </span>
        {selected && <span style={{ fontSize: "0.65rem", color, flexShrink: 0 }}>✓</span>}
      </div>
      <div style={{ fontSize: "0.62rem", color, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {spell.school}
      </div>
      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "4px", lineHeight: 1.35 }}>
        {spell.desc}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CreateCharacter() {
  const router = useRouter();

  const [character, setCharacter] = useState({
    name: '', race: '', class: '', alignment: '', weapon: '', trinket: '', sex: 'male',
  });
  const [rollingStats,  setRollingStats]  = useState(false);
  const [revealCount,   setRevealCount]   = useState(6);
  const [scores,        setScores]        = useState<AbilityScores>(DEFAULT_SCORES);
  const [nameError,     setNameError]     = useState('');
  const [saving,        setSaving]        = useState(false);
  const [portraitGenerating, setPortraitGenerating] = useState(false);
  const [hoveredStat,   setHoveredStat]   = useState<string | null>(null);
  const [hoveredRace,   setHoveredRace]   = useState<string | null>(null);
  const [hoveredClass,  setHoveredClass]  = useState<string | null>(null);
  const [hoveredAlign,  setHoveredAlign]  = useState<string | null>(null);

  const [selectedCantrips, setSelectedCantrips] = useState<string[]>([]);
  const [selectedSpells,   setSelectedSpells]   = useState<string[]>([]);

  const isSpellcaster = SPELLCASTING_CLASSES.has(character.class);
  const totalSteps    = isSpellcaster ? 5 : 4;

  const [step, setStep] = useState(1);

  const spellCounts       = getSpellCounts(character.class, scores);
  const availableCantrips = CANTRIPS[character.class] ?? [];
  const availableSpells   = LEVEL1_SPELLS[character.class] ?? [];

  // ── Stat roll with animation ────────────────────────────────────────────────
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

  // ── Navigation ──────────────────────────────────────────────────────────────
  const nextStep = () => {
    if (step === 1) {
      if (!character.name.trim()) { setNameError('Your character needs a name.'); return; }
      if (!character.race) return;
    }
    if (step === 2 && !character.class) return;
    setStep(s => Math.min(s + 1, totalSteps));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // ── Spell toggles ───────────────────────────────────────────────────────────
  const toggleCantrip = (name: string) => {
    if (selectedCantrips.includes(name)) {
      setSelectedCantrips(prev => prev.filter(n => n !== name));
    } else if (selectedCantrips.length < spellCounts.cantrips) {
      setSelectedCantrips(prev => [...prev, name]);
    }
  };

  const toggleSpell = (name: string) => {
    if (selectedSpells.includes(name)) {
      setSelectedSpells(prev => prev.filter(n => n !== name));
    } else if (selectedSpells.length < spellCounts.spells) {
      setSelectedSpells(prev => [...prev, name]);
    }
  };

  const handleClassSelect = (cls: string) => {
    setCharacter(c => ({ ...c, class: cls }));
    setSelectedCantrips([]);
    setSelectedSpells([]);
  };

  // ── Finish ───────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("You must be logged in!"); router.push('/auth'); return; }

      const trimmedName = character.name.trim();
      if (!trimmedName) { setStep(1); setNameError('Your character needs a name.'); setSaving(false); return; }

      const { data: existing } = await supabase
        .from('characters').select('id')
        .eq('user_id', user.id).ilike('name', trimmedName).limit(1);
      if (existing && existing.length > 0) {
        setStep(1);
        setNameError(`"${trimmedName}" is already on your roster. Choose a different name.`);
        setSaving(false);
        return;
      }

      const charClass   = character.class || 'Fighter';
      const maxHp       = startingHP(charClass, scores.constitution);
      const startingInv = {
        gold: 50,
        weapons: character.weapon ? [character.weapon] : ['Iron Dagger'],
        items:   ['Bedroll', 'Rations (5 days)', character.trinket || 'Mysterious Coin'],
      };

      const { data: newChar, error: insertError } = await supabase.from('characters').insert([{
        user_id:          user.id,
        name:             trimmedName,
        race:             character.race || 'Human',
        class:            charClass,
        sex:              character.sex,
        background:       character.alignment || null,
        level:            1,
        xp:               0,
        max_hp:           maxHp,
        hp:               maxHp,
        strength:         scores.strength,
        dexterity:        scores.dexterity,
        constitution:     scores.constitution,
        intelligence:     scores.intelligence,
        wisdom:           scores.wisdom,
        charisma:         scores.charisma,
        inventory:        startingInv,
        cantrips_known:   selectedCantrips,
        spells_prepared:  selectedSpells,
        spell_slots_used: {},
        status_effects:   [],
      }]).select().single();

      if (insertError || !newChar) throw insertError ?? new Error("Insert failed");

      setSaving(false);
      setPortraitGenerating(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/generate-portrait', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ race: character.race || 'Human', cls: charClass, sex: character.sex, charId: newChar.id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error('[create-character] portrait generation failed:', res.status, body);
        }
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

  // ── Render helpers ───────────────────────────────────────────────────────────
  const stepTitle = [
    "Identity & Origins",
    "Class & Vocation",
    "Roll for Stats",
    "Starting Equipment",
    "Spells & Cantrips",
  ][step - 1];

  const canProceed =
    (step === 1 && !!character.race) ||
    (step === 2 && !!character.class) ||
    (step === 3) ||
    (step === 4 && !!character.weapon) ||
    (step === 5);

  const spellsReady =
    (spellCounts.cantrips === 0 || selectedCantrips.length === spellCounts.cantrips) &&
    (spellCounts.spells   === 0 || selectedSpells.length   === spellCounts.spells);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>

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

      <div className="glass-panel" style={{ width: '100%', maxWidth: '860px', padding: '40px', position: 'relative' }}>

        {/* Progress bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', background: 'var(--border)', zIndex: 0 }} />
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(i => (
            <div key={i} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: step >= i ? 'var(--primary)' : 'var(--card-bg)',
              border: `2px solid ${step >= i ? 'var(--primary)' : 'var(--border)'}`,
              display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1,
              color: step >= i ? 'white' : 'var(--foreground)', fontWeight: 'bold', fontSize: '0.85rem',
            }}>{i}</div>
          ))}
        </div>

        <h1 style={{ fontSize: '2rem', marginBottom: '24px', textAlign: 'center' }}>{stepTitle}</h1>

        <div style={{ minHeight: '340px' }}>

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Character Name</label>
                <input
                  type="text"
                  value={character.name}
                  onChange={e => { setCharacter(c => ({ ...c, name: e.target.value })); setNameError(''); }}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${nameError ? '#ef4444' : 'var(--border)'}`, background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                  placeholder="e.g. Elara Moonwhisper"
                />
                {nameError && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '6px' }}>{nameError}</p>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Race</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Tiefling', 'Gnome', 'Half-Elf', 'Half-Orc'].map(race => (
                    <div key={race} style={{ position: 'relative' }}
                      onMouseEnter={() => setHoveredRace(race)}
                      onMouseLeave={() => setHoveredRace(null)}
                    >
                      <div onClick={() => setCharacter(c => ({ ...c, race }))}
                        style={{ padding: '16px', borderRadius: '8px', border: `1px solid ${character.race === race ? 'var(--primary)' : 'var(--border)'}`, background: character.race === race ? 'rgba(139,92,246,0.2)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                        {race}
                      </div>
                      {hoveredRace === race && RACE_TOOLTIPS[race] && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#1a1730', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', padding: '9px 12px', zIndex: 300, width: '200px', pointerEvents: 'none', fontSize: '0.72rem', color: '#e2e8f0', lineHeight: 1.45, textAlign: 'left', boxShadow: '0 4px 16px rgba(0,0,0,0.6)', whiteSpace: 'normal' }}>
                          <div style={{ fontWeight: 'bold', color: '#c4b5fd', marginBottom: '4px' }}>{race}</div>
                          {RACE_TOOLTIPS[race]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Sex</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {(['male', 'female', 'non-binary'] as const).map(s => (
                    <div key={s} onClick={() => setCharacter(c => ({ ...c, sex: s }))}
                      style={{ flex: 1, padding: '14px', borderRadius: '8px', border: `1px solid ${character.sex === s ? 'var(--primary)' : 'var(--border)'}`, background: character.sex === s ? 'rgba(139,92,246,0.2)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', textTransform: 'capitalize' }}>
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: '#94a3b8' }}>Alignment <span style={{ fontSize: '0.72rem', color: '#475569' }}>(optional — shapes how the DM reads your character)</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {ALIGNMENTS.map(a => (
                    <div key={a.key} style={{ position: 'relative' }}
                      onMouseEnter={() => setHoveredAlign(a.key)}
                      onMouseLeave={() => setHoveredAlign(null)}
                    >
                      <div
                        onClick={() => setCharacter(c => ({ ...c, alignment: c.alignment === a.key ? '' : a.key }))}
                        style={{
                          padding: '10px 8px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                          border: `1px solid ${character.alignment === a.key ? 'var(--primary)' : 'var(--border)'}`,
                          background: character.alignment === a.key ? 'rgba(139,92,246,0.2)' : 'transparent',
                        }}
                      >
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', color: character.alignment === a.key ? '#c4b5fd' : '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>{a.short}</div>
                        <div style={{ fontSize: '0.78rem', color: character.alignment === a.key ? 'white' : '#94a3b8', lineHeight: 1.2 }}>{a.key}</div>
                      </div>
                      {hoveredAlign === a.key && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#1a1730', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', padding: '9px 12px', zIndex: 300, width: '200px', pointerEvents: 'none', fontSize: '0.72rem', color: '#e2e8f0', lineHeight: 1.45, textAlign: 'left', boxShadow: '0 4px 16px rgba(0,0,0,0.6)', whiteSpace: 'normal' }}>
                          <div style={{ fontWeight: 'bold', color: '#c4b5fd', marginBottom: '4px' }}>{a.key}</div>
                          {a.desc}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Class ── */}
          {step === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Class</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Paladin', 'Ranger', 'Bard', 'Warlock', 'Barbarian', 'Druid', 'Monk', 'Sorcerer'].map(cls => (
                    <div key={cls} style={{ position: 'relative' }}
                      onMouseEnter={() => setHoveredClass(cls)}
                      onMouseLeave={() => setHoveredClass(null)}
                    >
                      <div onClick={() => handleClassSelect(cls)}
                        style={{ padding: '14px', borderRadius: '8px', border: `1px solid ${character.class === cls ? 'var(--primary)' : 'var(--border)'}`, background: character.class === cls ? 'rgba(139,92,246,0.2)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', fontSize: '0.9rem' }}>
                        {cls}
                        {SPELLCASTING_CLASSES.has(cls) && <div style={{ fontSize: '0.6rem', color: '#8b5cf6', marginTop: '3px' }}>✦ Spellcaster</div>}
                      </div>
                      {hoveredClass === cls && CLASS_TOOLTIPS[cls] && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#1a1730', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', padding: '9px 12px', zIndex: 300, width: '210px', pointerEvents: 'none', fontSize: '0.72rem', color: '#e2e8f0', lineHeight: 1.45, textAlign: 'left', boxShadow: '0 4px 16px rgba(0,0,0,0.6)', whiteSpace: 'normal' }}>
                          <div style={{ fontWeight: 'bold', color: '#c4b5fd', marginBottom: '4px' }}>{cls}</div>
                          {CLASS_TOOLTIPS[cls]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Roll Stats ── */}
          {step === 3 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{
                fontSize: '4rem', marginBottom: '24px',
                animation: rollingStats ? 'diceRoll 0.35s linear infinite' : 'none',
                filter: rollingStats ? 'drop-shadow(0 0 18px rgba(139,92,246,0.8))' : 'none',
                transition: 'filter 0.3s',
              }}>🎲</div>
              <button className="btn-primary" onClick={handleRollStats} disabled={rollingStats} style={{ marginBottom: '24px' }}>
                {rollingStats ? 'Rolling…' : 'Roll Ability Scores (4d6 drop lowest)'}
              </button>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {STAT_LABELS.map((label, statIdx) => {
                  const valKey   = STAT_KEYS[statIdx];
                  const val      = scores[valKey];
                  const isRevealed = revealCount > statIdx;
                  const m        = Math.floor((val - 10) / 2);
                  const guide    = CLASS_STAT_GUIDES[character.class]?.[label];
                  const tierStyle = guide ? getTierStyle(guide.tier) : null;
                  return (
                    <div
                      key={label}
                      style={{
                        position: 'relative', padding: '14px 16px', background: 'var(--card-bg)', borderRadius: '8px',
                        textAlign: 'center', minWidth: '70px',
                        border: `1px solid ${tierStyle && isRevealed ? tierStyle.color + "55" : "var(--border)"}`,
                        cursor: 'default', transition: 'all 0.2s',
                        animation: isRevealed && rollingStats === false && revealCount <= STAT_KEYS.length && revealCount === statIdx + 1
                          ? 'statReveal 0.3s ease-out'
                          : 'none',
                      }}
                      onMouseEnter={() => setHoveredStat(label)}
                      onMouseLeave={() => setHoveredStat(null)}
                    >
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>{label}</div>
                      <div style={{
                        fontWeight: 'bold', fontSize: '1.3rem',
                        color: isRevealed ? 'white' : '#475569',
                        transition: 'color 0.2s',
                      }}>
                        {isRevealed ? val : '??'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: isRevealed ? (m >= 0 ? '#22c55e' : '#ef4444') : '#374151' }}>
                        {isRevealed ? (m >= 0 ? `+${m}` : m) : '--'}
                      </div>
                      {isRevealed && tierStyle && (
                        <div style={{ fontSize: '0.52rem', color: tierStyle.color, marginTop: '4px', fontWeight: 'bold', letterSpacing: '0.06em' }}>
                          {tierStyle.label.toUpperCase()}
                        </div>
                      )}
                      {hoveredStat === label && isRevealed && guide && tierStyle && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: '#1a1730', border: `1px solid ${tierStyle.color}66`, borderRadius: '7px', padding: '9px 11px', zIndex: 300, width: '170px', pointerEvents: 'none', fontSize: '0.72rem', color: '#e2e8f0', lineHeight: 1.45, textAlign: 'left', boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>
                          <div style={{ fontWeight: 'bold', color: tierStyle.color, marginBottom: '4px', fontSize: '0.74rem' }}>{tierStyle.label} Stat</div>
                          {guide.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '16px' }}>Re-roll as many times as you like before continuing.</p>
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
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Primary Weapon</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {['Longsword', 'Shortbow', 'Staff', 'Daggers (x2)', 'Warhammer', 'Crossbow'].map(w => (
                    <div key={w} onClick={() => setCharacter(c => ({ ...c, weapon: w }))}
                      style={{ padding: '16px', borderRadius: '8px', border: `1px solid ${character.weapon === w ? 'var(--primary)' : 'var(--border)'}`, background: character.weapon === w ? 'rgba(139,92,246,0.2)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                      {w}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Starting Trinket (Flavor)</label>
                <input type="text" value={character.trinket}
                  onChange={e => setCharacter(c => ({ ...c, trinket: e.target.value }))}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }}
                  placeholder="e.g. A silver locket with a faded portrait" />
              </div>
            </div>
          )}

          {/* ── Step 5: Spells (spellcasters only) ── */}
          {step === 5 && isSpellcaster && (
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
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Cantrips (at-will)
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: selectedCantrips.length === spellCounts.cantrips ? '#22c55e' : '#8b5cf6', fontWeight: 'bold' }}>
                      {selectedCantrips.length} / {spellCounts.cantrips} selected
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {availableCantrips.map(spell => (
                      <SpellCard
                        key={spell.name} spell={spell}
                        selected={selectedCantrips.includes(spell.name)}
                        disabled={selectedCantrips.length >= spellCounts.cantrips && !selectedCantrips.includes(spell.name)}
                        onToggle={() => toggleCantrip(spell.name)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {spellCounts.spells > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      1st-Level Spells
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: selectedSpells.length === spellCounts.spells ? '#22c55e' : '#8b5cf6', fontWeight: 'bold' }}>
                      {selectedSpells.length} / {spellCounts.spells} {SPELL_LIMITS[character.class]?.spellFormula ? 'prepared' : 'known'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {availableSpells.map(spell => (
                      <SpellCard
                        key={spell.name} spell={spell}
                        selected={selectedSpells.includes(spell.name)}
                        disabled={selectedSpells.length >= spellCounts.spells && !selectedSpells.includes(spell.name)}
                        onToggle={() => toggleSpell(spell.name)}
                      />
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
              disabled={saving || portraitGenerating || (step === 4 && !character.weapon) || (step === 5 && !spellsReady)}
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Creating…' : 'Complete Character'}
            </button>
          )}
        </div>

      </div>
    </main>
  );
}
