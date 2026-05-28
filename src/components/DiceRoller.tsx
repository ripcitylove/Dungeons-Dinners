"use client";

import { useState } from "react";

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
type DieSides = typeof DICE_SIDES[number];

// clip-path polygons that approximate each die shape
const DIE_CLIP: Record<number, string> = {
  4:   "polygon(50% 0%, 0% 100%, 100% 100%)",
  6:   "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  8:   "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  10:  "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  12:  "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  20:  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  100: "circle(50%)",
};

function playRollSound() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
    const ctx = new Ctx();
    const sr  = ctx.sampleRate;
    // White-noise burst through bandpass — sounds like dice on a table
    const buf  = ctx.createBuffer(1, Math.floor(sr * 0.45), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass"; bpf.frequency.value = 650; bpf.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    src.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + 0.45);
  } catch { /* AudioContext unavailable */ }
}

function playResultSound(isCrit: boolean, isFumble: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Crit: bright ascending arpeggio; fumble: descending minor; normal: bell chord
    const notes = isCrit
      ? [523, 659, 784, 1047]
      : isFumble
      ? [330, 277, 220]
      : [523, 659];
    notes.forEach((freq, i) => {
      const delay = i * 0.1;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(isCrit ? 0.28 : 0.35, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + delay); osc.stop(now + delay + 1.1);
    });
  } catch { /* AudioContext unavailable */ }
}

export default function DiceRoller({
  onRollComplete,
  requiredDice,
}: {
  onRollComplete: (result: number, diceType: number) => void;
  requiredDice?: number | null;
}) {
  const [selectedDie, setSelectedDie] = useState<DieSides | null>(null);
  const [rolling,     setRolling]     = useState(false);
  const [result,      setResult]      = useState<number | null>(null);
  const [wrongDie,    setWrongDie]    = useState(false);

  const handleDieClick = (sides: DieSides) => {
    if (rolling || result !== null) return;

    if (requiredDice && sides !== requiredDice) {
      setWrongDie(true);
      setTimeout(() => setWrongDie(false), 2200);
      return;
    }

    setSelectedDie(sides);
    setRolling(true);
    playRollSound();

    setTimeout(() => {
      const r = Math.floor(Math.random() * sides) + 1;
      const isCrit   = sides === 20 && r === 20;
      const isFumble = sides === 20 && r === 1;
      setResult(r);
      setRolling(false);
      playResultSound(isCrit, isFumble);
      setTimeout(() => onRollComplete(r, sides), 2400);
    }, 1300);
  };

  const isCrit   = selectedDie === 20 && result === 20;
  const isFumble = selectedDie === 20 && result === 1;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(4, 4, 14, 0.93)",
      zIndex: 100,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(16px)",
    }}>

      {/* Header */}
      <p style={{ color: "var(--muted)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>
        {requiredDice ? "The DM Calls for a Roll" : "Choose Your Die"}
      </p>

      {requiredDice && (
        <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "white", marginBottom: "36px", letterSpacing: "-0.01em" }}>
          Roll a <span style={{ color: "var(--primary)" }}>d{requiredDice}</span>
        </p>
      )}
      {!requiredDice && <div style={{ marginBottom: "36px" }} />}

      {/* Wrong-die warning */}
      {wrongDie && (
        <div style={{
          position: "absolute", top: "calc(50% - 160px)",
          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.45)",
          borderRadius: "8px", padding: "10px 22px",
          color: "#ef4444", fontSize: "0.88rem", fontWeight: 600,
        }}>
          You need to roll a d{requiredDice} for this check.
        </div>
      )}

      {/* Die selector */}
      {!rolling && result === null && (
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center", maxWidth: "560px", padding: "0 20px" }}>
          {DICE_SIDES.map(sides => {
            const isRequired = requiredDice === sides;
            const isDimmed   = !!requiredDice && !isRequired;
            return (
              <button
                key={sides}
                onClick={() => handleDieClick(sides)}
                style={{
                  width: "80px", height: "88px",
                  background: "none", border: "none",
                  cursor: isDimmed ? "default" : "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: "10px", padding: 0,
                  opacity: isDimmed ? 0.25 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                <div style={{
                  width: "50px", height: "50px",
                  clipPath: DIE_CLIP[sides],
                  background: isRequired
                    ? "linear-gradient(135deg, var(--primary), var(--primary-hover))"
                    : "rgba(255,255,255,0.13)",
                  filter: isRequired ? "drop-shadow(0 0 12px rgba(139,92,246,0.7))" : "none",
                  transition: "background 0.15s",
                }} />
                <span style={{
                  fontSize: "0.78rem", fontWeight: 700,
                  color: isRequired ? "#c4b5fd" : "var(--muted)",
                  letterSpacing: "0.04em",
                }}>
                  d{sides}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Spinning animation during roll */}
      {rolling && selectedDie && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>
          <div style={{
            width: "110px", height: "110px",
            clipPath: DIE_CLIP[selectedDie],
            background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
            animation: "diceRoll 0.35s linear infinite",
            filter: "drop-shadow(0 0 30px rgba(139,92,246,0.7))",
          }} />
          <p style={{ color: "var(--subtle)", fontSize: "1.05rem", fontWeight: 600, letterSpacing: "0.04em" }}>
            Casting the fates…
          </p>
        </div>
      )}

      {/* Result */}
      {result !== null && selectedDie && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", animation: "fadeIn 0.4s ease-out" }}>
          <div style={{
            width: "130px", height: "130px",
            clipPath: DIE_CLIP[selectedDie],
            background: isCrit
              ? "linear-gradient(135deg, #f59e0b, #d97706)"
              : isFumble
              ? "linear-gradient(135deg, #374151, #1f2937)"
              : "linear-gradient(135deg, var(--primary), var(--primary-hover))",
            display: "flex", alignItems: "center", justifyContent: "center",
            filter: `drop-shadow(0 0 32px ${isCrit ? "rgba(245,158,11,0.8)" : isFumble ? "rgba(80,80,80,0.5)" : "rgba(139,92,246,0.75)"})`,
          }}>
            <span style={{ fontSize: "3rem", fontWeight: 900, color: "white", lineHeight: 1 }}>{result}</span>
          </div>
          <p style={{ fontSize: "1.3rem", fontWeight: 700, color: isCrit ? "#fbbf24" : isFumble ? "#6b7280" : "white", textAlign: "center" }}>
            {isCrit ? "✦ CRITICAL HIT ✦" : isFumble ? "Critical Failure" : `${result} on a d${selectedDie}`}
          </p>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes diceRoll {
          0%   { transform: rotate(0deg)   scale(1);    }
          25%  { transform: rotate(90deg)  scale(0.85); }
          50%  { transform: rotate(180deg) scale(1);    }
          75%  { transform: rotate(270deg) scale(0.85); }
          100% { transform: rotate(360deg) scale(1);    }
        }
      ` }} />
    </div>
  );
}
