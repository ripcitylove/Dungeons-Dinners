"use client";

import { useState, useEffect } from 'react';

export default function DiceRoller({ onRollComplete }: { onRollComplete: (result: number) => void }) {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const playClatterSound = () => {
    // Generate a dice clatter sound using Web Audio API
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      
      for(let i=0; i<5; i++) {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(300 + Math.random() * 500, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
          
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        }, i * 150);
      }
    } catch(e) { console.error("Audio API not supported", e); }
  };

  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    setResult(null);
    playClatterSound();
    
    // Simulate physics roll duration
    setTimeout(() => {
      const finalResult = Math.floor(Math.random() * 20) + 1;
      setResult(finalResult);
      setRolling(false);
      
      // Play ding sound on result
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime( finalResult === 20 ? 880 : 440, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } catch(e) {}

      setTimeout(() => onRollComplete(finalResult), 2000);
    }, 1200);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', backdropFilter: 'blur(8px)' }}>
      
      <div 
        onClick={rollDice}
        style={{
          width: '160px', height: '160px', 
          background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', // Hexagon shape for D20 2D projection
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          cursor: 'pointer',
          animation: rolling ? 'spin 0.4s linear infinite' : 'float 3s ease-in-out infinite',
          boxShadow: '0 0 40px var(--primary)',
          transition: 'all 0.3s'
        }}
      >
        <span style={{ fontSize: '4rem', fontWeight: 'bold', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.5)', transform: rolling ? 'scale(0.5) rotate(180deg)' : 'scale(1)', opacity: rolling ? 0.2 : 1, transition: 'all 0.2s' }}>
          {result !== null ? result : '20'}
        </span>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(0.8); } 100% { transform: rotate(360deg) scale(1); } }
      `}} />
      
      <p className="animate-fade-in" style={{ marginTop: '40px', fontSize: '1.5rem', color: '#cbd5e1', fontWeight: 600 }}>
        {rolling ? 'Casting the fates...' : result !== null ? (result === 20 ? 'CRITICAL SUCCESS!' : result === 1 ? 'CRITICAL FAILURE!' : `You rolled a ${result}.`) : 'Click the die to roll.'}
      </p>
    </div>
  );
}
