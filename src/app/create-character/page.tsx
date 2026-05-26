"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../globals.css';

import { supabase } from '../../lib/supabaseClient';
import {
  CANTRIPS, LEVEL1_SPELLS, SPELL_LIMITS, SPELLCASTING_CLASSES,
  getSpellCounts, type SpellEntry,
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

  // Determine max steps dynamically: step 5 (spells) only for spellcasting classes
  const [character, setCharacter] = useState({
    name: '', race: '', class: '', background: '', weapon: '', trinket: '', sex: 'male',
  });
  const [rollingStats, setRollingStats] = useState(false);
  const [scores, setScores]             = useState<AbilityScores>(DEFAULT_SCORES);
  const [nameError, setNameError]       = useState('');
  const [saving, setSaving]             = useState(false);

  // Spell selection state
  const [selectedCantrips, setSelectedCantrips] = useState<string[]>([]);
  const [selectedSpells,   setSelectedSpells]   = useState<string[]>([]);

  const isSpellcaster = SPELLCASTING_CLASSES.has(character.class);
  const totalSteps    = isSpellcaster ? 5 : 4;

  const [step, setStep] = useState(1);

  const spellCounts = getSpellCounts(character.class, scores);
  const availableCantrips = CANTRIPS[character.class] ?? [];
  const availableSpells   = LEVEL1_SPELLS[character.class] ?? [];

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

  // When class changes, reset spell selections
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

      const charClass    = character.class || 'Fighter';
      const maxHp        = startingHP(charClass, scores.constitution);
      const startingInv  = {
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
      }]).select().single();

      if (insertError || !newChar) throw insertError ?? new Error("Insert failed");

      // Generate portrait in background (non-blocking redirect)
      router.push('/dashboard');

      // Fire-and-forget portrait generation
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch('/api/generate-portrait', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ race: character.race || 'Human', cls: charClass, sex: character.sex, charId: newChar.id }),
        }).catch(console.error);
      }
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
                  {['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Tiefling'].map(race => (
                    <div key={race} onClick={() => setCharacter(c => ({ ...c, race }))}
                      style={{ padding: '16px', borderRadius: '8px', border: `1px solid ${character.race === race ? 'var(--primary)' : 'var(--border)'}`, background: character.race === race ? 'rgba(139,92,246,0.2)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                      {race}
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
            </div>
          )}

          {/* ── Step 2: Class ── */}
          {step === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Class</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Paladin', 'Ranger', 'Bard', 'Warlock', 'Barbarian', 'Druid', 'Monk', 'Sorcerer'].map(cls => (
                    <div key={cls} onClick={() => handleClassSelect(cls)}
                      style={{ padding: '14px', borderRadius: '8px', border: `1px solid ${character.class === cls ? 'var(--primary)' : 'var(--border)'}`, background: character.class === cls ? 'rgba(139,92,246,0.2)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', fontSize: '0.9rem' }}>
                      {cls}
                      {SPELLCASTING_CLASSES.has(cls) && <div style={{ fontSize: '0.6rem', color: '#8b5cf6', marginTop: '3px' }}>✦ Spellcaster</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Roll Stats ── */}
          {step === 3 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ fontSize: '4rem', marginBottom: '24px', animation: rollingStats ? 'float 0.5s infinite' : 'none' }}>🎲</div>
              <button className="btn-primary" onClick={() => {
                setRollingStats(true);
                setTimeout(() => { setScores(rollAbilityScores()); setRollingStats(false); }, 900);
              }} disabled={rollingStats} style={{ marginBottom: '24px' }}>
                {rollingStats ? 'Rolling...' : 'Roll Ability Scores (4d6 drop lowest)'}
              </button>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {([['STR', scores.strength], ['DEX', scores.dexterity], ['CON', scores.constitution], ['INT', scores.intelligence], ['WIS', scores.wisdom], ['CHA', scores.charisma]] as [string, number][]).map(([label, val]) => {
                  const m = Math.floor((val - 10) / 2);
                  return (
                    <div key={label} style={{ padding: '14px 16px', background: 'var(--card-bg)', borderRadius: '8px', textAlign: 'center', minWidth: '70px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>{label}</div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.3rem' }}>{val}</div>
                      <div style={{ fontSize: '0.75rem', color: m >= 0 ? '#22c55e' : '#ef4444' }}>{m >= 0 ? `+${m}` : m}</div>
                    </div>
                  );
                })}
              </div>
              <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '16px' }}>Re-roll as many times as you like before continuing.</p>
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

              {/* Cantrips */}
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

              {/* Level 1 Spells */}
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
              disabled={saving || (step === 4 && !character.weapon) || (step === 5 && !spellsReady)}
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
