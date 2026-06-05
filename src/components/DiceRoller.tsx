"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
type DieSides = typeof DICE_SIDES[number];

const DIE_CLIP: Record<number, string> = {
  4:   "polygon(50% 0%, 0% 100%, 100% 100%)",
  6:   "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  8:   "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  10:  "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  12:  "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  20:  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  100: "circle(50%)",
};

const DIE_LABEL: Record<number, string> = {
  4: "d4", 6: "d6", 8: "d8", 10: "d10", 12: "d12", 20: "d20", 100: "d100",
};

type Quality = "crit" | "fumble" | "excellent" | "good" | "fair" | "poor";

function getQuality(result: number, sides: number): Quality {
  if (sides === 20 && result === 20) return "crit";
  if (sides === 20 && result === 1)  return "fumble";
  const ratio = result / sides;
  if (ratio >= 0.9) return "excellent";
  if (ratio >= 0.55) return "good";
  if (ratio >= 0.3) return "fair";
  return "poor";
}

const QUALITY: Record<Quality, {
  color: string; glow: string; bg: string; label: string; sub: string;
  particleCount: number; flashColor: string | null;
}> = {
  crit:      { color: "#fbbf24", glow: "rgba(251,191,36,0.9)",  bg: "linear-gradient(145deg,#f59e0b 0%,#d97706 40%,#b45309 100%)", label: "✦ CRITICAL HIT ✦", sub: "Natural 20 — fate smiles upon you.",  particleCount: 20, flashColor: "rgba(251,191,36,0.18)" },
  fumble:    { color: "#9ca3af", glow: "rgba(80,80,80,0.6)",    bg: "linear-gradient(145deg,#4b5563 0%,#374151 50%,#1f2937 100%)", label: "Critical Fumble",   sub: "Natural 1 — the dice are cruel.",    particleCount: 10, flashColor: "rgba(239,68,68,0.16)" },
  excellent: { color: "#4ade80", glow: "rgba(34,197,94,0.75)",  bg: "linear-gradient(145deg,#22c55e 0%,#16a34a 50%,#15803d 100%)", label: "Excellent Roll!",   sub: "Fortune favors the bold.",           particleCount: 14, flashColor: null },
  good:      { color: "#c4b5fd", glow: "rgba(139,92,246,0.75)", bg: "linear-gradient(145deg,#8b5cf6 0%,#7c3aed 50%,#6d28d9 100%)", label: "",                  sub: "",                                   particleCount: 8,  flashColor: null },
  fair:      { color: "#94a3b8", glow: "rgba(100,116,139,0.45)",bg: "linear-gradient(145deg,#64748b 0%,#475569 50%,#334155 100%)", label: "",                  sub: "",                                   particleCount: 4,  flashColor: null },
  poor:      { color: "#f87171", glow: "rgba(239,68,68,0.55)",  bg: "linear-gradient(145deg,#ef4444 0%,#b91c1c 50%,#7f1d1d 100%)", label: "Ouch.",             sub: "Better luck next time.",             particleCount: 6,  flashColor: null },
};

const CRIT_STAR_POSITIONS = [
  { left: "12px",  top: "12px"  },
  { left: "168px", top: "8px"   },
  { left: "8px",   top: "162px" },
  { left: "164px", top: "160px" },
  { left: "88px",  top: "2px"   },
  { left: "88px",  top: "172px" },
];

// ── Audio ─────────────────────────────────────────────────────────────────────
function getCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
    return new Ctx();
  } catch { return null; }
}

function noiseBurst(ctx: AudioContext, dur: number, freq: number, vol: number, delay: number) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bpf = ctx.createBiquadFilter();
  bpf.type = "bandpass"; bpf.frequency.value = freq; bpf.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur + 0.02);
  src.connect(bpf); bpf.connect(g); g.connect(ctx.destination);
  src.start(ctx.currentTime + delay);
  src.stop(ctx.currentTime + delay + dur + 0.06);
}

function tone(ctx: AudioContext, freq: number, vol: number, delay: number, dur: number, type: OscillatorType = "sine") {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + dur + 0.05);
}

function playRollSound() {
  const ctx = getCtx(); if (!ctx) return;
  // Hard impact when die hits the table
  noiseBurst(ctx, 0.04, 800, 0.6, 0);
  noiseBurst(ctx, 0.03, 400, 0.5, 0.01);
  // Tumbling rattles
  const pattern = [0.06, 0.13, 0.19, 0.26, 0.34, 0.44, 0.56, 0.70, 0.86];
  pattern.forEach((t, i) => {
    noiseBurst(ctx, 0.045, 700 + Math.random() * 300, 0.42 * Math.pow(0.80, i), t);
  });
  // Final settle thud
  noiseBurst(ctx, 0.10, 250, 0.55, 1.05);
  tone(ctx, 140, 0.16, 1.05, 0.28, "triangle");
}

function playResultSound(q: Quality) {
  const ctx = getCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  if (q === "crit") {
    [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(ctx, f, 0.28, i * 0.065, 1.5, "sine"); });
    tone(ctx, 2093, 0.12, 0.33, 1.8, "triangle");
    [392, 523, 659].forEach((f) => { tone(ctx, f, 0.08, 0.35, 1.6, "sine"); });
    void now;
  } else if (q === "fumble") {
    [330, 294, 247, 196, 165].forEach((f, i) => { tone(ctx, f, 0.28, i * 0.13, 0.85, "sine"); });
    noiseBurst(ctx, 0.18, 120, 0.42, 0.6);
    tone(ctx, 110, 0.15, 0.58, 0.5, "triangle");
  } else if (q === "excellent") {
    [523, 659, 784, 1047].forEach((f, i) => { tone(ctx, f, 0.25, i * 0.08, 1.2, "sine"); });
    tone(ctx, 1568, 0.1, 0.28, 1.1, "triangle");
  } else if (q === "good") {
    [523, 659].forEach((f, i) => { tone(ctx, f, 0.28, i * 0.07, 1.0, "sine"); });
  } else if (q === "fair") {
    tone(ctx, 440, 0.22, 0, 0.85, "sine");
  } else {
    [330, 294].forEach((f, i) => tone(ctx, f, 0.22, i * 0.1, 0.7, "triangle"));
    noiseBurst(ctx, 0.1, 200, 0.28, 0.15);
  }
}

// ── Die face — shared between rolling and result phases ───────────────────────
function DieFace({
  sides, bg, glow, animName, size = 128, numberValue, numberColor, numberSize,
}: {
  sides: number; bg: string; glow: string; animName?: string; size?: number;
  numberValue?: number | null; numberColor?: string; numberSize?: string;
}) {
  const inset = Math.round(size * 0.09);
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Cast shadow on the surface */}
      <div style={{
        position: "absolute",
        inset: inset + 4,
        clipPath: DIE_CLIP[sides],
        background: "rgba(0,0,0,0.55)",
        filter: "blur(8px)",
        transform: "translate(5px, 8px)",
        animation: animName,
      }} />
      {/* Base die face */}
      <div style={{
        position: "absolute", inset,
        clipPath: DIE_CLIP[sides],
        background: bg,
        filter: `drop-shadow(0 0 ${size * 0.16}px ${glow}) drop-shadow(0 4px 12px rgba(0,0,0,0.7))`,
        animation: animName,
      }} />
      {/* Top-left light sheen — simulates 3D surface lighting */}
      <div style={{
        position: "absolute", inset,
        clipPath: DIE_CLIP[sides],
        background: "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 30%, transparent 60%, rgba(0,0,0,0.22) 100%)",
        animation: animName,
        pointerEvents: "none",
      }} />
      {/* Edge bevel highlight */}
      <div style={{
        position: "absolute", inset,
        clipPath: DIE_CLIP[sides],
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25), inset 2px 0 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.45), inset -2px 0 0 rgba(0,0,0,0.25)",
        animation: animName,
        pointerEvents: "none",
      }} />
      {/* Number */}
      {numberValue !== null && numberValue !== undefined && (
        <div style={{ position: "relative", zIndex: 2 }}>
          <span style={{
            fontSize: numberSize ?? "2.8rem",
            fontWeight: 700,
            color: numberColor ?? "rgba(255,255,255,0.95)",
            lineHeight: 1,
            textShadow: `0 0 16px ${glow}, 0 2px 6px rgba(0,0,0,0.75), 0 1px 0 rgba(0,0,0,0.9)`,
            letterSpacing: "0.04em",
            fontFamily: "var(--font-cinzel, 'Cinzel', 'Palatino Linotype', 'Book Antiqua', serif)",
          }}>
            {numberValue}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DiceRoller({
  onRollComplete,
  onCancel,
  requiredDice,
  requiredRollMode,
  rollContext,
  narVolume,
  narMuted,
}: {
  onRollComplete: (result: number, diceType: number, description?: string) => void;
  onCancel?: () => void;
  requiredDice?: number | null;
  requiredRollMode?: "normal" | "advantage" | "disadvantage" | null;
  rollContext?: string | null;
  narVolume?: number;
  narMuted?: boolean;
}) {
  const [selectedDie,  setSelectedDie]  = useState<DieSides | null>(null);
  const [phase,        setPhase]        = useState<"idle" | "rolling" | "result">("idle");
  const [result,       setResult]       = useState<number | null>(null);
  const [altResult,    setAltResult]    = useState<number | null>(null);
  const [displayNum,   setDisplayNum]   = useState<number | null>(null);
  const [wrongDie,     setWrongDie]     = useState(false);
  const [showFlash,    setShowFlash]    = useState(false);
  const [flashColor,   setFlashColor]   = useState<string>("transparent");
  const countupRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const didRoll       = useRef(false);

  // Sync narration volume via refs so executeRoll always reads current values
  const narVolumeRef = useRef(narVolume ?? 1);
  const narMutedRef  = useRef(narMuted  ?? false);
  useEffect(() => { narVolumeRef.current = narVolume ?? 1;    }, [narVolume]);
  useEffect(() => { narMutedRef.current  = narMuted  ?? false; }, [narMuted]);

  const isAdvDis = !!requiredRollMode && requiredRollMode !== "normal";
  const quality = result !== null && selectedDie !== null ? getQuality(result, selectedDie) : null;
  const qs      = quality ? QUALITY[quality] : null;

  const executeRoll = useCallback((sides: DieSides) => {
    if (didRoll.current) return;
    didRoll.current = true;

    setSelectedDie(sides);
    setPhase("rolling");
    setResult(null);
    setAltResult(null);
    setDisplayNum(null);
    playRollSound();

    const r1 = Math.floor(Math.random() * sides) + 1;
    const r2 = isAdvDis ? Math.floor(Math.random() * sides) + 1 : null;

    let kept: number;
    let dropped: number | null = null;
    if (r2 !== null) {
      if (requiredRollMode === "advantage") {
        kept = Math.max(r1, r2); dropped = Math.min(r1, r2);
      } else {
        kept = Math.min(r1, r2); dropped = Math.max(r1, r2);
      }
    } else {
      kept = r1;
    }

    setTimeout(() => {
      countupRef.current = setInterval(() => {
        setDisplayNum(Math.floor(Math.random() * sides) + 1);
      }, 65);
    }, 680);

    setTimeout(() => {
      if (countupRef.current) { clearInterval(countupRef.current); countupRef.current = null; }
      setResult(kept);
      setAltResult(dropped);
      setDisplayNum(kept);
      setPhase("result");
      const q = getQuality(kept, sides);
      playResultSound(q);
      if (q === "crit") {
        const choir = new Audio("/angelic_choir.mp3");
        choir.volume = narMutedRef.current ? 0 : Math.min(1, narVolumeRef.current);
        choir.play().catch(() => {});
      }
      const qData = QUALITY[q];
      if (qData.flashColor) {
        setFlashColor(qData.flashColor);
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 1400);
      }
      const description = r2 !== null
        ? `Rolled with ${requiredRollMode}: ${r1} and ${r2}, taking ${kept} on a d${sides}`
        : undefined;
      setTimeout(() => onRollComplete(kept, sides, description), 2800);
    }, 1350);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredRollMode, isAdvDis, onRollComplete]);

  const handleDieClick = useCallback((sides: DieSides) => {
    if (phase !== "idle") return;
    if (requiredDice && sides !== requiredDice) {
      setWrongDie(true);
      setTimeout(() => setWrongDie(false), 2200);
      return;
    }
    executeRoll(sides);
  }, [phase, requiredDice, executeRoll]);

  useEffect(() => () => { if (countupRef.current) clearInterval(countupRef.current); }, []);

  const headerLabel = requiredRollMode === "advantage"
    ? "⚔ Roll with Advantage"
    : requiredRollMode === "disadvantage"
    ? "⚔ Roll with Disadvantage"
    : requiredDice
    ? "⚔ The DM Calls for a Roll"
    : "Choose Your Die";

  // Rolling die gradient — deep stone/obsidian with purple magic
  const rollingBg = "linear-gradient(145deg, #6d28d9 0%, #5b21b6 35%, #4c1d95 65%, #3b0764 100%)";
  const rollingGlow = "rgba(139,92,246,0.85)";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(3, 2, 12, 0.97)",
      zIndex: 100,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(28px)",
    }}>

      {/* Screen flash for crit / fumble */}
      {showFlash && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 200,
          background: flashColor,
          animation: "screenFlash 1.4s ease-out forwards",
        }} />
      )}

      {/* Atmospheric top glow */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "700px", height: "320px", background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "0", left: "50%", transform: "translateX(-50%)", width: "360px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.45), transparent)", pointerEvents: "none" }} />

      {/* Cancel — only shown in idle (manual die selection) */}
      {onCancel && phase === "idle" && (
        <button
          onClick={onCancel}
          style={{
            position: "absolute", top: "24px", right: "28px",
            background: "none", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px", padding: "6px 14px",
            color: "#475569", fontSize: "0.78rem", cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "#94a3b8"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";  e.currentTarget.style.color = "#475569"; }}
        >
          ✕ Cancel
        </button>
      )}

      {/* DM prompt context */}
      {rollContext && phase !== "result" && (
        <div style={{
          maxWidth: "520px", padding: "12px 20px",
          background: "rgba(139,92,246,0.07)",
          border: "1px solid rgba(139,92,246,0.22)",
          borderRadius: "10px",
          marginBottom: "24px",
          color: "#c4b5fd",
          fontSize: "0.88rem",
          lineHeight: 1.55,
          textAlign: "center",
          fontStyle: "italic",
        }}>
          {rollContext}
        </div>
      )}

      {/* Header */}
      <p style={{ color: "#6366f1", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}>
        {headerLabel}
      </p>

      {phase === "idle" && (
        <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "white", marginBottom: "40px", letterSpacing: "-0.01em" }}>
          {requiredDice ? (
            <>Roll a <span style={{ color: "#a78bfa", textShadow: "0 0 24px rgba(139,92,246,0.8)" }}>d{requiredDice}</span>
            {isAdvDis && <span style={{ fontSize: "1rem", color: "#64748b", marginLeft: "12px", fontWeight: 600 }}>({requiredRollMode})</span>}</>
          ) : "Choose your die"}
        </p>
      )}

      {phase !== "idle" && requiredDice && (
        <p style={{ fontSize: "1.4rem", fontWeight: 800, color: "white", marginBottom: "32px", letterSpacing: "-0.01em", opacity: phase === "result" ? 0 : 1, transition: "opacity 0.3s" }}>
          Rolling <span style={{ color: "#a78bfa", textShadow: "0 0 20px rgba(139,92,246,0.8)" }}>d{requiredDice}</span>
          {isAdvDis && <span style={{ fontSize: "0.9rem", color: "#64748b", marginLeft: "10px" }}>({requiredRollMode})</span>}
        </p>
      )}

      {/* Wrong-die warning */}
      {wrongDie && (
        <div style={{
          position: "absolute", top: "calc(50% - 200px)",
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.5)",
          borderRadius: "10px", padding: "10px 24px",
          color: "#f87171", fontSize: "0.88rem", fontWeight: 600,
          animation: "fadeIn 0.2s ease-out",
        }}>
          A d{requiredDice} is called for — choose wisely.
        </div>
      )}

      {/* ── Idle: Die Selector ── */}
      {phase === "idle" && (
        <div style={{
          display: "flex", gap: "18px", flexWrap: "wrap", justifyContent: "center",
          maxWidth: "580px", padding: "0 20px",
          animation: wrongDie ? "diceShake 0.45s ease-in-out" : "none",
        }}>
          {DICE_SIDES.map(sides => {
            const isRequired = requiredDice === sides;
            const isDimmed   = !!requiredDice && !isRequired;
            return (
              <button
                key={sides}
                onClick={() => handleDieClick(sides)}
                style={{
                  width: "84px", height: "96px",
                  background: "none", border: "none",
                  cursor: isDimmed ? "default" : "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: "10px", padding: 0,
                  opacity: isDimmed ? 0.11 : 1,
                  transition: "transform 0.18s ease, opacity 0.15s",
                }}
                onMouseEnter={e => {
                  if (!isDimmed) e.currentTarget.style.transform = "perspective(220px) rotateX(-10deg) rotateY(8deg) scale(1.14) translateY(-4px)";
                }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
              >
                <div style={{
                  position: "relative",
                  width: "60px", height: "60px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: isRequired ? "dieBob 1.9s ease-in-out infinite" : "none",
                }}>
                  {isRequired && (
                    <div style={{
                      position: "absolute", inset: "-14px",
                      borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 65%)",
                      animation: "beaconPulse 1.5s ease-in-out infinite",
                      pointerEvents: "none",
                    }} />
                  )}
                  {/* Shadow */}
                  <div style={{
                    position: "absolute", inset: 4,
                    clipPath: DIE_CLIP[sides],
                    background: "rgba(0,0,0,0.5)",
                    filter: "blur(5px)",
                    transform: "translate(3px, 5px)",
                  }} />
                  {/* Die body */}
                  <div style={{
                    position: "absolute", inset: 0,
                    clipPath: DIE_CLIP[sides],
                    background: isRequired
                      ? "linear-gradient(145deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%)"
                      : "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)",
                    filter: isRequired ? "drop-shadow(0 0 12px rgba(139,92,246,0.7))" : "none",
                    transition: "all 0.18s",
                  }} />
                  {/* Sheen */}
                  <div style={{
                    position: "absolute", inset: 0,
                    clipPath: DIE_CLIP[sides],
                    background: "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 45%)",
                    pointerEvents: "none",
                  }} />
                </div>
                <span style={{
                  fontSize: "0.78rem", fontWeight: 700,
                  color: isRequired ? "#c4b5fd" : "#475569",
                  letterSpacing: "0.05em",
                }}>
                  {DIE_LABEL[sides]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Rolling Phase ── */}
      {phase === "rolling" && selectedDie && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "36px" }}>
          <div style={{ position: "relative", width: "200px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>

            {/* Outer atmosphere ring */}
            <div style={{
              position: "absolute", inset: "-24px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 65%)",
              animation: "outerPulse 0.45s ease-in-out infinite alternate",
            }} />

            {/* Stone floor shadow (static, underneath) */}
            <div style={{
              position: "absolute",
              bottom: "-8px", left: "50%", transform: "translateX(-50%)",
              width: "110px", height: "20px",
              background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
              filter: "blur(4px)",
              animation: "shadowPulse 0.42s ease-in-out infinite alternate",
            }} />

            {/* Orbiting sparks */}
            <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
              {[0, 1, 2, 3, 4, 5].map(i => {
                const radius  = 68 + (i % 2) * 18;
                const duration = 0.85 + i * 0.13;
                const startDelay = -(i / 6) * duration;
                return (
                  <div key={i} style={{
                    position: "absolute", width: 0, height: 0, left: 0, top: 0,
                    animation: `orbit ${duration}s linear ${startDelay}s infinite`,
                  }}>
                    <div style={{
                      position: "absolute",
                      left: `${radius}px`, top: `${-(1.5 + i % 2)}px`,
                      width: `${3 + (i % 3)}px`, height: `${3 + (i % 3)}px`,
                      borderRadius: "50%",
                      background: i % 3 === 0 ? "#fbbf24" : i % 3 === 1 ? "#8b5cf6" : "#c4b5fd",
                      opacity: 0.75,
                      boxShadow: `0 0 8px ${i % 3 === 0 ? "#fbbf24" : "#8b5cf6"}`,
                    }} />
                  </div>
                );
              })}
            </div>

            {/* 3D rolling die */}
            <DieFace
              sides={selectedDie}
              bg={rollingBg}
              glow={rollingGlow}
              animName="dieRoll3d 0.44s cubic-bezier(0.45,0.05,0.55,0.95) infinite"
              size={160}
              numberValue={displayNum}
            />
          </div>

          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#6366f1", fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", animation: "breathe 1s ease-in-out infinite alternate" }}>
              {isAdvDis ? "Rolling twice…" : "Casting the fates…"}
            </p>
            <p style={{ color: "#334155", fontSize: "0.72rem", marginTop: "6px", letterSpacing: "0.06em" }}>
              {isAdvDis
                ? (requiredRollMode === "advantage" ? "Keeping the higher roll" : "Keeping the lower roll")
                : "May fortune favor you"}
            </p>
          </div>
        </div>
      )}

      {/* ── Result Phase ── */}
      {phase === "result" && result !== null && selectedDie && qs && quality && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px", animation: "resultReveal 0.55s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <div style={{ position: "relative", width: "220px", height: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>

            {/* Particle burst */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {Array.from({ length: qs.particleCount }).map((_, i) => {
                const angle  = (i / qs.particleCount) * 360;
                const size   = quality === "crit" ? 7 + (i % 3) * 2 : 4 + (i % 3);
                const delay  = (i % 5) * 0.035;
                const dur    = 0.75 + (i % 3) * 0.2;
                return (
                  <div key={i} style={{
                    position: "absolute", left: "50%", top: "50%", width: 0, height: 0,
                    transform: `rotate(${angle}deg)`,
                  }}>
                    <div style={{
                      position: "absolute",
                      width: `${size}px`, height: `${size}px`,
                      marginLeft: `-${size / 2}px`, marginTop: `-${size / 2}px`,
                      background: qs.color,
                      borderRadius: quality === "crit" ? "1px" : "50%",
                      boxShadow: `0 0 ${size * 2}px ${qs.color}`,
                      animation: `particleShoot ${dur}s cubic-bezier(0.1, 0.8, 0.3, 1) ${delay}s both`,
                    }} />
                  </div>
                );
              })}
            </div>

            {/* Crit floating ✦ stars */}
            {quality === "crit" && CRIT_STAR_POSITIONS.map((pos, i) => (
              <div key={i} style={{
                position: "absolute", ...pos,
                fontSize: `${0.72 + (i % 3) * 0.38}rem`,
                color: "#fbbf24",
                animation: `critStar ${1.1 + i * 0.18}s ease-out ${i * 0.1}s both`,
                pointerEvents: "none",
                textShadow: "0 0 12px rgba(251,191,36,0.9)",
                zIndex: 10,
              }}>✦</div>
            ))}

            {/* Far glow */}
            <div style={{
              position: "absolute", inset: "-44px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${qs.glow.replace(")", ", 0.24)").replace("rgba(", "rgba(")} 0%, transparent 65%)`,
              animation: "outerPulse 1.4s ease-in-out infinite alternate",
            }} />

            {/* Settled die — 3D result face */}
            <div style={{ animation: "resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <DieFace
                sides={selectedDie}
                bg={qs.bg}
                glow={qs.glow}
                size={186}
                numberValue={result}
                numberColor="white"
                numberSize={quality === "crit" || quality === "fumble" ? "3.8rem" : "4rem"}
              />
            </div>
          </div>

          {/* Result label */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
              {DIE_LABEL[selectedDie]}
            </p>
            <p style={{
              fontSize: quality === "crit" || quality === "fumble" ? "1.6rem" : "1.3rem",
              fontWeight: 800, color: qs.color,
              textShadow: quality === "crit" || quality === "excellent" ? `0 0 20px ${qs.glow}` : "none",
              letterSpacing: quality === "crit" ? "0.06em" : "-0.01em",
              animation: quality === "crit" || quality === "fumble" ? "resultReveal 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" : "none",
            }}>
              {qs.label || result}
            </p>
            {qs.sub && (
              <p style={{ fontSize: "0.82rem", color: qs.color, opacity: 0.7, marginTop: "4px", fontStyle: "italic" }}>
                {qs.sub}
              </p>
            )}
            {!qs.label && (
              <p style={{ fontSize: "0.78rem", color: "#475569", marginTop: "4px" }}>
                {result} on a {DIE_LABEL[selectedDie]}
              </p>
            )}
          </div>

          {/* Advantage / disadvantage secondary roll */}
          {altResult !== null && (
            <div style={{
              display: "flex", alignItems: "center", gap: "14px",
              padding: "10px 20px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.07)",
              marginTop: "-12px",
            }}>
              <span style={{
                fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: requiredRollMode === "advantage" ? "#4ade80" : "#f87171",
              }}>
                {requiredRollMode === "advantage" ? "▲ Advantage" : "▼ Disadvantage"}
              </span>
              <span style={{ fontSize: "0.8rem", color: "#475569" }}>
                Also rolled:{" "}
                <span style={{ textDecoration: "line-through", color: "#334155", fontWeight: 700 }}>
                  {altResult}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dieRoll3d {
          0%   { transform: perspective(280px) rotateX(0deg)   rotateY(0deg)   rotateZ(0deg);   }
          12%  { transform: perspective(280px) rotateX(108deg) rotateY(72deg)  rotateZ(45deg);  }
          25%  { transform: perspective(280px) rotateX(216deg) rotateY(144deg) rotateZ(135deg); }
          37%  { transform: perspective(280px) rotateX(144deg) rotateY(252deg) rotateZ(90deg);  }
          50%  { transform: perspective(280px) rotateX(288deg) rotateY(36deg)  rotateZ(180deg); }
          62%  { transform: perspective(280px) rotateX(72deg)  rotateY(288deg) rotateZ(252deg); }
          75%  { transform: perspective(280px) rotateX(324deg) rotateY(180deg) rotateZ(315deg); }
          87%  { transform: perspective(280px) rotateX(252deg) rotateY(324deg) rotateZ(270deg); }
          100% { transform: perspective(280px) rotateX(360deg) rotateY(360deg) rotateZ(360deg); }
        }
        @keyframes outerPulse {
          from { transform: scale(0.93); opacity: 0.7; }
          to   { transform: scale(1.07); opacity: 1;   }
        }
        @keyframes shadowPulse {
          from { transform: translateX(-50%) scaleX(0.85); opacity: 0.4; }
          to   { transform: translateX(-50%) scaleX(1.1);  opacity: 0.65; }
        }
        @keyframes breathe {
          from { opacity: 0.55; }
          to   { opacity: 1;   }
        }
        @keyframes resultReveal {
          0%   { transform: scale(0.4) rotate(-8deg); opacity: 0; }
          65%  { transform: scale(1.06) rotate(1deg); }
          100% { transform: scale(1)   rotate(0deg);  opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes particleShoot {
          0%   { transform: translateY(0)     scale(1);   opacity: 1; }
          60%  { opacity: 0.8; }
          100% { transform: translateY(-140px) scale(0); opacity: 0; }
        }
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes beaconPulse {
          0%   { opacity: 0.5; transform: scale(0.92); }
          50%  { opacity: 1;   transform: scale(1.08); }
          100% { opacity: 0.5; transform: scale(0.92); }
        }
        @keyframes dieBob {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-5px); }
        }
        @keyframes diceShake {
          0%,100% { transform: translateX(0); }
          18%     { transform: translateX(-9px); }
          36%     { transform: translateX(9px); }
          54%     { transform: translateX(-6px); }
          72%     { transform: translateX(6px); }
          88%     { transform: translateX(-3px); }
        }
        @keyframes screenFlash {
          0%   { opacity: 0; }
          12%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes critStar {
          0%   { transform: translateY(0)    scale(0) rotate(-15deg); opacity: 0; }
          25%  { opacity: 1; }
          70%  { transform: translateY(-28px) scale(1) rotate(8deg);  opacity: 1; }
          100% { transform: translateY(-56px) scale(0.4) rotate(25deg); opacity: 0; }
        }
      ` }} />
    </div>
  );
}
