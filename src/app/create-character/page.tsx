"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import '../globals.css';

import { supabase } from '../../lib/supabaseClient';

export default function CreateCharacter() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [character, setCharacter] = useState({ name: '', race: '', class: '', background: '' });
  const [rollingStats, setRollingStats] = useState(false);

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleFinish = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to save a character!");
        router.push('/auth');
        return;
      }

      const { error } = await supabase.from('characters').insert([
        {
          user_id: user.id,
          name: character.name || 'Unknown Hero',
          race: character.race || 'Human',
          class: character.class || 'Fighter',
          level: 1,
          hp: 10,
          strength: 15,
          dexterity: 14,
          constitution: 13,
          intelligence: 12,
          wisdom: 10,
          charisma: 8
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
          {[1, 2, 3].map(i => (
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
                  setTimeout(() => setRollingStats(false), 1500);
                }}
                disabled={rollingStats}
                style={{ marginBottom: '24px' }}
              >
                {rollingStats ? 'Rolling...' : 'Roll Ability Scores'}
              </button>
              
              {!rollingStats && (
                <div style={{ display: 'flex', gap: '16px', opacity: 0.5 }}>
                  <div style={{ padding: '16px', background: 'var(--card-bg)', borderRadius: '8px', textAlign: 'center' }}>STR<br/><b>15</b></div>
                  <div style={{ padding: '16px', background: 'var(--card-bg)', borderRadius: '8px', textAlign: 'center' }}>DEX<br/><b>14</b></div>
                  <div style={{ padding: '16px', background: 'var(--card-bg)', borderRadius: '8px', textAlign: 'center' }}>CON<br/><b>13</b></div>
                  <div style={{ padding: '16px', background: 'var(--card-bg)', borderRadius: '8px', textAlign: 'center' }}>INT<br/><b>12</b></div>
                  <div style={{ padding: '16px', background: 'var(--card-bg)', borderRadius: '8px', textAlign: 'center' }}>WIS<br/><b>10</b></div>
                  <div style={{ padding: '16px', background: 'var(--card-bg)', borderRadius: '8px', textAlign: 'center' }}>CHA<br/><b>8</b></div>
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
          
          {step < 3 ? (
            <button className="btn-primary" onClick={nextStep} disabled={step === 1 && !character.race || step === 2 && !character.class}>Next Step</button>
          ) : (
            <button className="btn-primary" onClick={handleFinish} style={{ background: 'var(--accent)' }}>Complete Character</button>
          )}
        </div>

      </div>
    </main>
  );
}
