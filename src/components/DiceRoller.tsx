"use client";

import { useState, useRef, useEffect } from "react";

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

const QUALITY: Record<Quality, { color: string; glow: string; bg: string; label: string; sub: string }> = {
  crit:      { color: "#fbbf24", glow: "rgba(251,191,36,0.9)",  bg: "linear-gradient(135deg,#f59e0b,#b45309)", label: "✦ CRITICAL HIT ✦", sub: "Natural 20 — legendary!" },
  fumble:    { color: "#9ca3af", glow: "rgba(80,80,80,0.6)",    bg: "linear-gradient(135deg,#374151,#111827)", label: "Critical Fumble",   sub: "Natural 1 — fate is cruel." },
  excellent: { color: "#4ade80", glow: "rgba(34,197,94,0.75)",  bg: "linear-gradient(135deg,#16a34a,#15803d)", label: "Excellent Roll!",  sub: "" },
  good:      { color: "#c4b5fd", glow: "rgba(139,92,246,0.75)", bg: "linear-gradient(135deg,#7c3aed,#6d28d9)", label: "",                sub: "" },
  fair:      { color: "#94a3b8", glow: "rgba(100,116,139,0.45)",bg: "linear-gradient(135deg,#475569,#334155)", label: "",                sub: "" },
  poor:      { color: "#f87171", glow: "rgba(239,68,68,0.55)",  bg: "linear-gradient(135deg,#b91c1c,#7f1d1d)", label: "Ouch.",           sub: "" },
};

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
  // 9 rapid clicks (dice tumbling), accelerating then decelerating
  const pattern = [0, 0.06, 0.11, 0.155, 0.19, 0.23, 0.29, 0.38, 0.52];
  pattern.forEach((t, i) => {
    noiseBurst(ctx, 0.055, 620 + Math.random() * 280, 0.48 * Math.pow(0.84, i), t);
  });
  // Three longer bounces
  noiseBurst(ctx, 0.07, 560, 0.38, 0.7);
  noiseBurst(ctx, 0.07, 520, 0.32, 0.88);
  // Final heavy settle thud
  noiseBurst(ctx, 0.14, 280, 0.55, 1.06);
  tone(ctx, 160, 0.18, 1.06, 0.3, "triangle");
}

function playResultSound(q: Quality) {
  const ctx = getCtx(); if (!ctx) return;
  const now = ctx.currentTime;

  if (q === "crit") {
    // Gold fanfare: 5-note rapid ascending + sustain shimmer
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      tone(ctx, f, 0.28, i * 0.065, 1.5, "sine");
    });
    // High shimmer
    tone(ctx, 2093, 0.12, 0.33, 1.8, "triangle");
    // Warm pad chord
    [392, 523, 659].forEach((f, i) => {
      tone(ctx, f, 0.08, 0.35, 1.6, "sine");
      void i;
    });
    void now;
  } else if (q === "fumble") {
    [330, 294, 247, 196, 165].forEach((f, i) => {
      tone(ctx, f, 0.28, i * 0.13, 0.85, "sine");
    });
    noiseBurst(ctx, 0.18, 120, 0.42, 0.6);
    tone(ctx, 110, 0.15, 0.58, 0.5, "triangle");
  } else if (q === "excellent") {
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(ctx, f, 0.25, i * 0.08, 1.2, "sine");
    });
    tone(ctx, 1568, 0.1, 0.28, 1.1, "triangle");
  } else if (q === "good") {
    [523, 659].forEach((f, i) => {
      tone(ctx, f, 0.28, i * 0.07, 1.0, "sine");
    });
  } else if (q === "fair") {
    tone(ctx, 440, 0.22, 0, 0.85, "sine");
  } else {
    // poor
    [330, 294].forEach((f, i) => tone(ctx, f, 0.22, i * 0.1, 0.7, "triangle"));
    noiseBurst(ctx, 0.1, 200, 0.28, 0.15);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DiceRoller({
  onRollComplete,
  requiredDice,
}: {
  onRollComplete: (result: number, diceType: number) => void;
  requiredDice?: number | null;
}) {
  const [selectedDie,  setSelectedDie]  = useState<DieSides | null>(null);
  const [phase,        setPhase]        = useState<"idle" | "rolling" | "result">("idle");
  const [result,       setResult]       = useState<number | null>(null);
  const [displayNum,   setDisplayNum]   = useState<number | null>(null);
  const [wrongDie,     setWrongDie]     = useState(false);
  const countupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const quality = result !== null && selectedDie !== null ? getQuality(result, selectedDie) : null;
  const qs      = quality ? QUALITY[quality] : null;

  const handleDieClick = (sides: DieSides) => {
    if (phase !== "idle") return;

    if (requiredDice && sides !== requiredDice) {
      setWrongDie(true);
      setTimeout(() => setWrongDie(false), 2200);
      return;
    }

    setSelectedDie(sides);
    setPhase("rolling");
    setResult(null);
    setDisplayNum(null);
    playRollSound();

    const finalResult = Math.floor(Math.random() * sides) + 1;

    // Start number count-up at 680ms
    setTimeout(() => {
      countupRef.current = setInterval(() => {
        setDisplayNum(Math.floor(Math.random() * sides) + 1);
      }, 65);
    }, 680);

    // Settle at 1350ms
    setTimeout(() => {
      if (countupRef.current) { clearInterval(countupRef.current); countupRef.current = null; }
      setResult(finalResult);
      setDisplayNum(finalResult);
      setPhase("result");
      const q = getQuality(finalResult, sides);
      playResultSound(q);
      setTimeout(() => onRollComplete(finalResult, sides), 2800);
    }, 1350);
  };

  useEffect(() => () => { if (countupRef.current) clearInterval(countupRef.current); }, []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(3, 2, 12, 0.96)",
      zIndex: 100,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(24px)",
    }}>

      {/* Atmospheric top glow */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "600px", height: "300px", background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <p style={{ color: "#6366f1", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}>
        {requiredDice ? "⚔ The DM Calls for a Roll" : "Choose Your Die"}
      </p>

      {requiredDice ? (
        <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "white", marginBottom: "40px", letterSpacing: "-0.01em" }}>
          Roll a <span style={{ color: "#a78bfa", textShadow: "0 0 20px rgba(139,92,246,0.7)" }}>d{requiredDice}</span>
        </p>
      ) : (
        <div style={{ marginBottom: "40px" }} />
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
          You must roll a d{requiredDice} for this check.
        </div>
      )}

      {/* ── Die Selector ── */}
      {phase === "idle" && (
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", justifyContent: "center", maxWidth: "580px", padding: "0 20px" }}>
          {DICE_SIDES.map(sides => {
            const isRequired = requiredDice === sides;
            const isDimmed   = !!requiredDice && !isRequired;
            return (
              <button
                key={sides}
                onClick={() => handleDieClick(sides)}
                style={{
                  width: "84px", height: "92px",
                  background: "none", border: "none",
                  cursor: isDimmed ? "default" : "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: "10px", padding: 0,
                  opacity: isDimmed ? 0.18 : 1,
                  transition: "transform 0.18s ease, opacity 0.15s",
                }}
                onMouseEnter={e => { if (!isDimmed) { e.currentTarget.style.transform = "scale(1.15) translateY(-3px)"; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1) translateY(0)"; }}
              >
                <div style={{
                  width: "54px", height: "54px",
                  clipPath: DIE_CLIP[sides],
                  background: isRequired
                    ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                    : "rgba(255,255,255,0.09)",
                  boxShadow: isRequired
                    ? "0 0 18px rgba(139,92,246,0.7), 0 0 36px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.15)"
                    : "inset 0 1px 0 rgba(255,255,255,0.06)",
                  transition: "all 0.18s",
                }} />
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
          <div style={{ position: "relative", width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Outer pulse ring */}
            <div style={{
              position: "absolute", inset: "-20px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 68%)",
              animation: "outerPulse 0.5s ease-in-out infinite alternate",
            }} />
            {/* Die shape */}
            <div style={{
              position: "absolute", inset: "16px",
              clipPath: DIE_CLIP[selectedDie],
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              animation: "dieRoll 0.38s linear infinite",
              filter: "drop-shadow(0 0 18px rgba(139,92,246,0.8))",
            }} />
            {/* Number overlay — not clipped */}
            {displayNum !== null && (
              <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "2.8rem", fontWeight: 900, color: "rgba(255,255,255,0.95)", lineHeight: 1, textShadow: "0 0 14px rgba(139,92,246,0.9)", letterSpacing: "-0.02em" }}>
                  {displayNum}
                </span>
              </div>
            )}
          </div>
          <p style={{ color: "#6366f1", fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", animation: "breathe 1s ease-in-out infinite alternate" }}>
            Casting the fates…
          </p>
        </div>
      )}

      {/* ── Result Phase ── */}
      {phase === "result" && result !== null && selectedDie && qs && quality && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px", animation: "resultReveal 0.55s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <div style={{ position: "relative", width: "200px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Far glow */}
            <div style={{
              position: "absolute", inset: "-40px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${qs.glow.replace(")", ", 0.22)").replace("rgba(", "rgba(")} 0%, transparent 65%)`,
              animation: "outerPulse 1.4s ease-in-out infinite alternate",
            }} />
            {/* Mid glow */}
            <div style={{
              position: "absolute", inset: "-10px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${qs.glow.replace(")", ", 0.18)").replace("rgba(", "rgba(")} 0%, transparent 70%)`,
            }} />
            {/* Die face */}
            <div style={{
              position: "absolute", inset: "14px",
              clipPath: DIE_CLIP[selectedDie],
              background: qs.bg,
              filter: `drop-shadow(0 0 28px ${qs.glow}) drop-shadow(0 0 56px ${qs.glow.replace(")", ", 0.4)").replace("rgba(", "rgba(")})`,
            }} />
            {/* Number — sibling, not clipped */}
            <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{
                fontSize: quality === "crit" || quality === "fumble" ? "3.6rem" : "3.8rem",
                fontWeight: 900, color: "white", lineHeight: 1,
                textShadow: `0 0 20px ${qs.glow}, 0 2px 6px rgba(0,0,0,0.6)`,
                letterSpacing: "-0.03em",
                animation: quality === "crit" ? "critPop 0.4s cubic-bezier(0.34,1.56,0.64,1)" : "none",
              }}>{result}</span>
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
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dieRoll {
          0%   { transform: rotate(0deg)   scale(1.0);  }
          14%  { transform: rotate(51deg)  scale(0.86); }
          28%  { transform: rotate(102deg) scale(1.04); }
          42%  { transform: rotate(153deg) scale(0.88); }
          57%  { transform: rotate(204deg) scale(1.03); }
          71%  { transform: rotate(255deg) scale(0.90); }
          85%  { transform: rotate(306deg) scale(1.02); }
          100% { transform: rotate(360deg) scale(1.0);  }
        }
        @keyframes outerPulse {
          from { transform: scale(0.93); opacity: 0.7; }
          to   { transform: scale(1.07); opacity: 1;   }
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
        @keyframes critPop {
          0%   { transform: scale(0.6); }
          60%  { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      ` }} />
    </div>
  );
}
