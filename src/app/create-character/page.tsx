"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../globals.css';

import { supabase } from '../../lib/supabaseClient';
import { PixelCharacter } from '../../components/PixelCharacter';

type AbilityScores = {
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
};

// 4d6 drop lowest — standard D&D 5e method
function roll4d6DropLowest(): number {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => a - b);
  return rolls.slice(1).reduce((a, b) => a + b, 0);
}

function rollAbilityScores(): AbilityScores {
  return {
    strength: roll4d6DropLowest(),
    dexterity: roll4d6DropLowest(),
    constitution: roll4d6DropLowest(),
    intelligence: roll4d6DropLowest(),
    wisdom: roll4d6DropLowest(),
    charisma: roll4d6DropLowest(),
  };
}

// Level 1 HP = hit die max + CON modifier
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

export default function CreateCharacter() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [character, setCharacter] = useState({ name: '', race: '', class: '', background: '', weapon: '', trinket: '' });
  const [rollingStats, setRollingStats] = useState(false);
  const [scores, setScores] = useState<AbilityScores>(DEFAULT_SCORES);

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleFinish = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to save a character!");
        router.push('/auth');
        return;
      }

      // Format the starting inventory
      const startingInventory = {
        gold: 50,
        weapons: character.weapon ? [character.weapon] : ['Iron Dagger'],
        items: ['Bedroll', 'Rations (5 days)', character.trinket || 'Mysterious Coin']
      };

      const charClass = character.class || 'Fighter';
      const maxHp = startingHP(charClass, scores.constitution);

      const { error } = await supabase.from('characters').insert([
        {
          user_id: user.id,
          name: character.name || 'Unknown Hero',
          race: character.race || 'Human',
          class: charClass,
          level: 1,
          max_hp: maxHp,
          hp: maxHp,
          strength: scores.strength,
          dexterity: scores.dexterity,
          constitution: scores.constitution,
          intelligence: scores.intelligence,
          wisdom: scores.wisdom,
          charisma: scores.charisma,
          inventory: startingInventory
        }
      ]);
      
      if (error) throw error;
      router.push('/dashboard');
    } catch (error) {
      console.error("Error saving character:", error);
      alert("Failed to save character. Please try again.");
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', padding: '40px', position: 'relative' }}>
        
        {/* Progress Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', background: 'var(--border)', zIndex: 0 }}></div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ 
              width: '32px', height: '32px', borderRadius: '50%', 
              background: step >= i ? 'var(--primary)' : 'var(--card-bg)',
              border: `2px solid ${step >= i ? 'var(--primary)' : 'var(--border)'}`,
              display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1,
              color: step >= i ? 'white' : 'var(--foreground)', fontWeight: 'bold'
            }}>
              {i}
            </div>
          ))}
        </div>

        <h1 style={{ fontSize: '2rem', marginBottom: '24px', textAlign: 'center' }}>
          {step === 1 && "Identity & Origins"}
          {step === 2 && "Class & Vocation"}
          {step === 3 && "Roll for Stats"}
          {step === 4 && "Starting Equipment"}
        </h1>

        <div style={{ minHeight: '300px' }}>
          {step === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Character Name</label>
                <input 
                  type="text" 
                  value={character.name}
                  onChange={e => setCharacter({...character, name: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }} 
                  placeholder="e.g. Elara Moonwhisper"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Race</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Tiefling'].map(race => (
                    <div 
                      key={race}
                      onClick={() => setCharacter({...character, race})}
                      style={{ 
                        padding: '16px', borderRadius: '8px', border: `1px solid ${character.race === race ? 'var(--primary)' : 'var(--border)'}`, 
                        background: character.race === race ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                      }}
                    >
                      {race}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Class</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Paladin', 'Ranger', 'Bard', 'Warlock'].map(cls => (
                    <div 
                      key={cls}
                      onClick={() => setCharacter({...character, class: cls})}
                      style={{ 
                        padding: '16px', borderRadius: '8px', border: `1px solid ${character.class === cls ? 'var(--primary)' : 'var(--border)'}`, 
                        background: character.class === cls ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                      }}
                    >
                      {cls}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ fontSize: '4rem', marginBottom: '24px', animation: rollingStats ? 'float 0.5s infinite' : 'none' }}>
                🎲
              </div>
              <button
                className="btn-primary"
                onClick={() => {
                  setRollingStats(true);
                  setTimeout(() => {
                    setScores(rollAbilityScores());
                    setRollingStats(false);
                  }, 900);
                }}
                disabled={rollingStats}
                style={{ marginBottom: '24px' }}
              >
                {rollingStats ? 'Rolling...' : 'Roll Ability Scores (4d6 drop lowest)'}
              </button>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {([
                  ['STR', scores.strength],
                  ['DEX', scores.dexterity],
                  ['CON', scores.constitution],
                  ['INT', scores.intelligence],
                  ['WIS', scores.wisdom],
                  ['CHA', scores.charisma],
                ] as [string, number][]).map(([label, val]) => {
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
              <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '16px' }}>
                Re-roll as many times as you like before continuing.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Primary Weapon</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {['Longsword', 'Shortbow', 'Staff', 'Daggers (x2)', 'Warhammer', 'Crossbow'].map(w => (
                    <div 
                      key={w}
                      onClick={() => setCharacter({...character, weapon: w})}
                      style={{ 
                        padding: '16px', borderRadius: '8px', border: `1px solid ${character.weapon === w ? 'var(--primary)' : 'var(--border)'}`, 
                        background: character.weapon === w ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                      }}
                    >
                      {w}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Starting Trinket (Flavor)</label>
                <input 
                  type="text" 
                  value={character.trinket}
                  onChange={e => setCharacter({...character, trinket: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem' }} 
                  placeholder="e.g. A silver locket with a faded portrait"
                />
              </div>
            </div>
          )}

        </div>

        {/* Live character preview — appears once race or class is chosen */}
        {(character.race || character.class) && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", padding: "20px 0", marginTop: "8px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Preview</span>
              <PixelCharacter race={character.race || "Human"} cls={character.class || "Fighter"} size={5} />
              <span style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 600 }}>
                {[character.race, character.class].filter(Boolean).join(" · ") || "Choose race & class"}
              </span>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={step === 1 ? () => router.push('/dashboard') : prevStep}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          {step < 4 ? (
            <button className="btn-primary" onClick={nextStep} disabled={(step === 1 && !character.race) || (step === 2 && !character.class) || (step === 4 && !character.weapon)}>Next Step</button>
          ) : (
            <button className="btn-primary" onClick={handleFinish} style={{ background: 'var(--accent)' }} disabled={!character.weapon}>Complete Character</button>
          )}
        </div>

      </div>
    </main>
  );
}
