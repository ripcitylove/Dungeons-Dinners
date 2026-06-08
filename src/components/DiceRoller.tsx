"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
type DieSides = typeof DICE_SIDES[number];
const DIE_LABEL: Record<number, string> = { 4:"d4",6:"d6",8:"d8",10:"d10",12:"d12",20:"d20",100:"d%" };

type Quality = "crit"|"fumble"|"excellent"|"good"|"fair"|"poor";
function getQuality(r: number, s: number): Quality {
  if (s===20&&r===20) return "crit";
  if (s===20&&r===1)  return "fumble";
  const x = r/s;
  return x>=.9?"excellent":x>=.55?"good":x>=.3?"fair":"poor";
}
const QUALITY: Record<Quality,{
  edge:string; glow:string; face:string; label:string; sub:string;
  pc:number; flash:string|null; num:string;
}> = {
  crit:     {edge:"#fbbf24",glow:"rgba(251,191,36,.9)",  face:"rgba(251,191,36,.22)",label:"✦ CRITICAL HIT ✦",       sub:"Natural 20 — fate smiles upon you.", pc:20,flash:"rgba(251,191,36,.18)",num:"#fef9c3"},
  fumble:   {edge:"#9ca3af",glow:"rgba(100,116,139,.6)", face:"rgba(75,85,99,.25)",  label:"Critical Fumble",         sub:"Natural 1 — the dice are cruel.",    pc:10,flash:"rgba(239,68,68,.16)",  num:"#d1d5db"},
  excellent:{edge:"#4ade80",glow:"rgba(34,197,94,.75)",  face:"rgba(34,197,94,.16)", label:"Excellent Roll!",          sub:"Fortune favors the bold.",           pc:14,flash:null,                   num:"#dcfce7"},
  good:     {edge:"#c4b5fd",glow:"rgba(139,92,246,.75)", face:"rgba(139,92,246,.16)",label:"",                         sub:"",                                   pc:8, flash:null,                   num:"#ede9fe"},
  fair:     {edge:"#94a3b8",glow:"rgba(100,116,139,.45)",face:"rgba(100,116,139,.13)",label:"",                        sub:"",                                   pc:4, flash:null,                   num:"#e2e8f0"},
  poor:     {edge:"#f87171",glow:"rgba(239,68,68,.55)",  face:"rgba(239,68,68,.15)", label:"Ouch.",                   sub:"Better luck next time.",              pc:6, flash:null,                   num:"#fecaca"},
};

// ── Die geometry (all paths in 0 0 100 100 viewBox) ──────────────────────────
type FaceDef = { p: string; dark: number };
type Geom = {
  outer: string;
  faces: FaceDef[];
  inner: string[];
  gx:number; gy:number; grx:number; gry:number; ga:number;
  nx:number; ny:number; nSize:number;
  isCircle?: true;
};

const GEOM: Record<number, Geom> = {
  // d4 — tetrahedron face-on (triangle with altitude lines)
  4: {
    outer: "M50,6 L94,87 L6,87 Z",
    faces: [{ p:"M50,6 L94,87 L6,87 Z", dark:0 }],
    inner: ["M50,6 L50,76","M6,87 L73,46","M94,87 L27,46"],
    gx:37,gy:28,grx:13,gry:8,ga:-18,
    nx:50,ny:73,nSize:20,
  },
  // d6 — isometric cube (3 visible faces)
  6: {
    outer: "M50,10 L84,29 L84,71 L50,90 L16,71 L16,29 Z",
    faces: [
      { p:"M50,10 L84,29 L50,48 L16,29 Z", dark:-0.06 },
      { p:"M84,29 L84,71 L50,90 L50,48 Z", dark:0.12 },
      { p:"M16,29 L16,71 L50,90 L50,48 Z", dark:0.07 },
    ],
    inner: ["M50,10 L50,48","M50,48 L84,71","M50,48 L16,71"],
    gx:37,gy:19,grx:13,gry:7,ga:-12,
    nx:50,ny:55,nSize:26,
  },
  // d8 — octahedron diamond (4 visible triangular faces)
  8: {
    outer: "M50,5 L93,50 L50,95 L7,50 Z",
    faces: [
      { p:"M50,5 L93,50 L50,50 Z",  dark:0.05 },
      { p:"M50,5 L7,50  L50,50 Z",  dark:-0.05 },
      { p:"M93,50 L50,95 L50,50 Z", dark:0.13 },
      { p:"M7,50  L50,95 L50,50 Z", dark:0.08 },
    ],
    inner: ["M7,50 L93,50","M50,5 L50,95"],
    gx:35,gy:22,grx:13,gry:8,ga:0,
    nx:50,ny:56,nSize:26,
  },
  // d10 — pentagonal trapezohedron (kite shape)
  10: {
    outer: "M50,5 L90,37 L76,88 L24,88 L10,37 Z",
    faces: [
      { p:"M50,5 L90,37 L50,59 Z",    dark:-0.04 },
      { p:"M50,5 L10,37 L50,59 Z",    dark:0.04 },
      { p:"M90,37 L76,88 L50,59 Z",   dark:0.13 },
      { p:"M10,37 L24,88 L50,59 Z",   dark:0.09 },
      { p:"M76,88 L24,88 L50,59 Z",   dark:0.17 },
    ],
    inner: ["M10,37 L90,37","M50,5 L50,59","M50,59 L76,88","M50,59 L24,88"],
    gx:35,gy:18,grx:14,gry:8,ga:-5,
    nx:50,ny:64,nSize:23,
  },
  // d12 — dodecahedron (outer pentagon + inner pentagon + connecting radii)
  12: {
    outer: "M50,7 L88,35 L74,79 L26,79 L12,35 Z",
    faces: [
      { p:"M50,7 L88,35 L67,42 L50,29 Z",    dark:-0.04 },
      { p:"M88,35 L74,79 L61,62 L67,42 Z",   dark:0.10 },
      { p:"M74,79 L26,79 L39,62 L61,62 Z",   dark:0.18 },
      { p:"M26,79 L12,35 L33,42 L39,62 Z",   dark:0.10 },
      { p:"M12,35 L50,7 L50,29 L33,42 Z",    dark:0.03 },
      { p:"M50,29 L67,42 L61,62 L39,62 L33,42 Z", dark:0.06 },
    ],
    inner: [
      "M50,29 L67,42","M67,42 L61,62","M61,62 L39,62","M39,62 L33,42","M33,42 L50,29",
      "M50,7 L50,29","M88,35 L67,42","M74,79 L61,62","M26,79 L39,62","M12,35 L33,42",
    ],
    gx:36,gy:19,grx:14,gry:8,ga:-10,
    nx:50,ny:54,nSize:23,
  },
  // d20 — icosahedron (equilateral triangle with 4 internal sub-triangles)
  20: {
    outer: "M50,5 L95,84 L5,84 Z",
    faces: [
      { p:"M50,5 L72,44 L28,44 Z",    dark:-0.08 },
      { p:"M5,84  L28,44 L50,84 Z",   dark:0.08 },
      { p:"M95,84 L72,44 L50,84 Z",   dark:0.06 },
      { p:"M28,44 L72,44 L50,84 Z",   dark:0.15 },
    ],
    inner: ["M28,44 L72,44","M28,44 L50,84","M72,44 L50,84"],
    gx:36,gy:24,grx:14,gry:8,ga:-18,
    nx:50,ny:69,nSize:21,
  },
  // d100 — circle (rendered as circle SVG)
  100: {
    outer:"", faces:[], inner:[],
    gx:34,gy:30,grx:15,gry:9,ga:-10,
    nx:50,ny:54,nSize:18,
    isCircle:true,
  },
};

// ── Audio ─────────────────────────────────────────────────────────────────────
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    if (!_ctx || _ctx.state==="closed") {
      const C = (window.AudioContext ?? (window as unknown as Record<string,unknown>).webkitAudioContext) as typeof AudioContext;
      _ctx = new C();
    }
    if (_ctx.state==="suspended") _ctx.resume().catch(()=>{});
    return _ctx;
  } catch { return null; }
}
function noise(ctx: AudioContext, dur: number, freq: number, vol: number, t: number, q = 1.4) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.ceil(sr*dur), sr);
  const d = buf.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*(1-i/d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bpf = ctx.createBiquadFilter(); bpf.type="bandpass"; bpf.frequency.value=freq; bpf.Q.value=q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime+t);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+dur+0.02);
  src.connect(bpf); bpf.connect(g); g.connect(ctx.destination);
  src.start(ctx.currentTime+t); src.stop(ctx.currentTime+t+dur+0.06);
}
function tone(ctx: AudioContext, f: number, vol: number, t: number, dur: number, type: OscillatorType="sine") {
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type=type; osc.frequency.value=f;
  g.gain.setValueAtTime(vol, ctx.currentTime+t);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(ctx.currentTime+t); osc.stop(ctx.currentTime+t+dur+0.05);
}
function crystalRing(ctx: AudioContext, t: number, vol = 0.18) {
  // Bright glassy ping — overtone series of a crystal die
  [2200, 3300, 4400, 6600].forEach((f, i) => tone(ctx, f, vol*(0.9**i), t, 0.6+i*0.08, "sine"));
  tone(ctx, 1100, vol*0.55, t, 0.9, "triangle");
}
function playRollSound() {
  const ctx = getCtx(); if (!ctx) return;
  // Hard crystal launch
  noise(ctx, 0.03, 2400, 0.55, 0, 2.2);
  noise(ctx, 0.04,  900, 0.48, 0.005);
  // Tumbling clicks — decreasing intervals (dice speeding up then slowing)
  const clicks = [0.06,0.11,0.17,0.24,0.33,0.45,0.59,0.76,0.96,1.18];
  clicks.forEach((t,i) => {
    noise(ctx, 0.035, 1800+Math.random()*600, 0.38*(0.82**i), t, 1.8);
    if (i%3===0) noise(ctx, 0.025, 800+Math.random()*400, 0.22*(0.82**i), t+0.01);
  });
  // Final settle thud + crystal ring
  noise(ctx, 0.12, 280, 0.52, 1.32);
  tone(ctx, 160, 0.14, 1.32, 0.4, "triangle");
  crystalRing(ctx, 1.36, 0.14);
}
function playResultSound(q: Quality) {
  const ctx = getCtx(); if (!ctx) return;
  if (q==="crit") {
    [523,659,784,1047,1319].forEach((f,i) => tone(ctx, f, 0.30, i*0.06, 1.6));
    crystalRing(ctx, 0.28, 0.22);
    tone(ctx, 2093, 0.14, 0.34, 2.0, "triangle");
  } else if (q==="fumble") {
    [330,294,247,196,165].forEach((f,i) => tone(ctx, f, 0.28, i*0.13, 0.85));
    noise(ctx, 0.18, 120, 0.40, 0.6);
    tone(ctx, 110, 0.14, 0.58, 0.5, "triangle");
  } else if (q==="excellent") {
    [523,659,784,1047].forEach((f,i) => tone(ctx, f, 0.26, i*0.08, 1.2));
    crystalRing(ctx, 0.26, 0.15);
  } else if (q==="good") {
    [523,659].forEach((f,i) => tone(ctx, f, 0.28, i*0.07, 1.0));
    crystalRing(ctx, 0.1, 0.10);
  } else if (q==="fair") {
    tone(ctx, 440, 0.22, 0, 0.85);
    crystalRing(ctx, 0.05, 0.07);
  } else {
    [330,294].forEach((f,i) => tone(ctx, f, 0.22, i*0.1, 0.7, "triangle"));
    noise(ctx, 0.1, 200, 0.28, 0.15);
  }
}

// ── Crystal Die SVG ───────────────────────────────────────────────────────────
// Renders the correct polyhedral shape (d4=triangle, d6=cube, d8=diamond,
// d10=kite, d12=pentagon+inner, d20=tri+subtris, d100=circle)
// with a semi-transparent amethyst crystal material.
function DieSVG({
  sides, size, edgeColor, glowColor, faceColor, numberValue, spinning, idleAnim,
}: {
  sides: number; size: number;
  edgeColor: string; glowColor: string; faceColor: string;
  numberValue?: number | null;
  spinning?: boolean;
  idleAnim?: boolean;
}) {
  const g = GEOM[sides] ?? GEOM[20];
  const id = `die${sides}`;

  // Parse faceColor to derive slightly-tinted variants for each face
  function faceFill(dark: number) {
    // Shift opacity a bit darker/lighter per face for 3D depth
    // We do this by layering a black or white fill on top
    return dark > 0
      ? `rgba(0,0,0,${dark*0.55})`
      : `rgba(255,255,255,${Math.abs(dark)*0.45})`;
  }

  const wrapStyle: React.CSSProperties = {
    width: size, height: size,
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: spinning
      ? `dieRollSpin 0.68s ease-in-out infinite`
      : idleAnim
      ? `dieBobFloat 2.2s ease-in-out infinite`
      : undefined,
    filter: `drop-shadow(0 0 ${Math.round(size*0.12)}px ${glowColor}) drop-shadow(0 6px 18px rgba(0,0,0,0.85))`,
  };

  if (g.isCircle) {
    return (
      <div style={wrapStyle}>
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`${id}glint`} cx="0.35" cy="0.30" r="0.5">
              <stop offset="0%" stopColor="rgba(255,255,255,0.75)"/>
              <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
            </radialGradient>
          </defs>
          {/* Outer ring */}
          <circle cx="50" cy="50" r="44" fill={faceColor} stroke={edgeColor} strokeWidth="1.8"/>
          {/* Inner ring */}
          <circle cx="50" cy="50" r="34" fill="none" stroke={edgeColor} strokeWidth="0.9" strokeOpacity="0.45"/>
          {/* Cross lines */}
          <line x1="6" y1="50" x2="94" y2="50" stroke={edgeColor} strokeWidth="0.7" strokeOpacity="0.3"/>
          <line x1="50" y1="6" x2="50" y2="94" stroke={edgeColor} strokeWidth="0.7" strokeOpacity="0.3"/>
          {/* Glint */}
          <circle cx="50" cy="50" r="44" fill={`url(#${id}glint)`} style={{transform:`translate(${g.gx-50}%,${g.gy-50}%)`,transformOrigin:"50% 50%"}}/>
          {/* Number */}
          {numberValue != null && (
            <text x={g.nx} y={g.ny} textAnchor="middle" dominantBaseline="middle"
              fontSize={g.nSize} fontWeight="700" fill="rgba(255,255,255,0.95)"
              fontFamily="Cinzel,Palatino Linotype,serif"
              style={{textShadow:`0 0 10px ${glowColor}`}}>
              {numberValue}
            </text>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`${id}glint`} cx="0.35" cy="0.3" r="0.55">
            <stop offset="0%" stopColor="rgba(255,255,255,0.78)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
          <filter id={`${id}glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Base face fill */}
        <path d={g.outer} fill={faceColor}/>

        {/* Per-face shading (3D depth) */}
        {g.faces.map((f, i) => (
          <path key={i} d={f.p} fill={faceFill(f.dark)} fillOpacity="0.85"/>
        ))}

        {/* Interior structural edges (the crystal's inner geometry) */}
        {g.inner.map((line, i) => (
          <path key={i} d={line} stroke={edgeColor} strokeWidth="0.7" strokeOpacity="0.38" strokeLinecap="round"/>
        ))}

        {/* Outer silhouette edge — bright, lit */}
        <path d={g.outer} fill="none" stroke={edgeColor} strokeWidth="1.8" strokeLinejoin="round"
          filter={`url(#${id}glow)`}/>

        {/* Light-side highlight edge (upper-left faces) — extra bright */}
        <path d={g.outer} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.9"
          strokeLinejoin="round" strokeDasharray="none"/>

        {/* Glint highlight */}
        <path d={g.outer} fill={`url(#${id}glint)`} transform={`translate(${(g.gx-50)*0.38} ${(g.gy-50)*0.38})`}/>

        {/* Die number */}
        {numberValue != null && (
          <text x={g.nx} y={g.ny} textAnchor="middle" dominantBaseline="middle"
            fontSize={g.nSize} fontWeight="700" fill="rgba(255,255,255,0.97)"
            fontFamily="Cinzel,Palatino Linotype,serif"
            stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" paintOrder="stroke">
            {numberValue}
          </text>
        )}
      </svg>
    </div>
  );
}

// ── D20 icon for the toolbar button ──────────────────────────────────────────
export function D20Icon({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50,5 L95,84 L5,84 Z" fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round"/>
      <path d="M28,44 L72,44" stroke={color} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.65"/>
      <path d="M28,44 L50,84" stroke={color} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.65"/>
      <path d="M72,44 L50,84" stroke={color} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.65"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DiceRoller({
  onRollComplete, onCancel, requiredDice, requiredRollMode, rollContext, narVolume, narMuted,
}: {
  onRollComplete: (result: number, diceType: number, description?: string) => void;
  onCancel?: () => void;
  requiredDice?: number | null;
  requiredRollMode?: "normal"|"advantage"|"disadvantage"|null;
  rollContext?: string | null;
  narVolume?: number;
  narMuted?: boolean;
}) {
  const [selectedDie,  setSelectedDie]  = useState<DieSides|null>(null);
  const [phase,        setPhase]        = useState<"idle"|"rolling"|"result">("idle");
  const [result,       setResult]       = useState<number|null>(null);
  const [altResult,    setAltResult]    = useState<number|null>(null);
  const [displayNum,   setDisplayNum]   = useState<number|null>(null);
  const [wrongDie,     setWrongDie]     = useState(false);
  const [showFlash,    setShowFlash]    = useState(false);
  const [flashColor,   setFlashColor]   = useState("transparent");

  const countupRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const didRoll    = useRef(false);
  const narVolumeRef = useRef(narVolume ?? 1);
  const narMutedRef  = useRef(narMuted  ?? false);
  useEffect(() => { narVolumeRef.current = narVolume ?? 1;    }, [narVolume]);
  useEffect(() => { narMutedRef.current  = narMuted  ?? false; }, [narMuted]);

  const isAdvDis  = !!requiredRollMode && requiredRollMode !== "normal";
  const quality   = result !== null && selectedDie !== null ? getQuality(result, selectedDie) : null;
  const qs        = quality ? QUALITY[quality] : null;

  // Default crystal palette (idle/rolling)
  const CRYSTAL_EDGE = "rgba(196,181,253,0.88)";
  const CRYSTAL_GLOW = "rgba(139,92,246,0.80)";
  const CRYSTAL_FACE = "rgba(109,40,217,0.14)";

  const executeRoll = useCallback((sides: DieSides) => {
    if (didRoll.current) return;
    didRoll.current = true;
    setSelectedDie(sides);
    setPhase("rolling");
    setResult(null); setAltResult(null); setDisplayNum(null);
    playRollSound();

    const r1 = Math.floor(Math.random()*sides)+1;
    const r2 = isAdvDis ? Math.floor(Math.random()*sides)+1 : null;
    let kept: number, dropped: number|null = null;
    if (r2 !== null) {
      if (requiredRollMode==="advantage") { kept=Math.max(r1,r2); dropped=Math.min(r1,r2); }
      else                                { kept=Math.min(r1,r2); dropped=Math.max(r1,r2); }
    } else { kept=r1; }

    // Random number cycle during roll
    setTimeout(() => {
      countupRef.current = setInterval(() => setDisplayNum(Math.floor(Math.random()*sides)+1), 60);
    }, 620);

    setTimeout(() => {
      if (countupRef.current) { clearInterval(countupRef.current); countupRef.current=null; }
      setResult(kept); setAltResult(dropped); setDisplayNum(kept);
      setPhase("result");
      const q = getQuality(kept, sides);
      playResultSound(q);
      if (q==="crit") { const c=new Audio("/angelic_choir.mp3"); c.volume=0.75; c.play().catch(()=>{}); }
      const qd = QUALITY[q];
      if (qd.flash) { setFlashColor(qd.flash); setShowFlash(true); setTimeout(()=>setShowFlash(false),1400); }
      const desc = r2!==null
        ? `Rolled with ${requiredRollMode}: ${r1} and ${r2}, taking ${kept} on a d${sides}`
        : undefined;
      setTimeout(() => onRollComplete(kept, sides, desc), 2800);
    }, 1380);
  }, [requiredRollMode, isAdvDis, onRollComplete]);

  // Auto-roll when the DM has already called for a specific die
  useEffect(() => {
    if (requiredDice && DICE_SIDES.includes(requiredDice as DieSides)) {
      const t = setTimeout(() => executeRoll(requiredDice as DieSides), 180);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDieClick = useCallback((sides: DieSides) => {
    if (phase!=="idle") return;
    if (requiredDice && sides!==requiredDice) {
      setWrongDie(true); setTimeout(()=>setWrongDie(false),2200); return;
    }
    executeRoll(sides);
  }, [phase, requiredDice, executeRoll]);

  useEffect(() => () => { if (countupRef.current) clearInterval(countupRef.current); }, []);

  const headerLabel = requiredRollMode==="advantage"
    ? "⚔ Roll with Advantage"
    : requiredRollMode==="disadvantage"
    ? "⚔ Roll with Disadvantage"
    : requiredDice ? "⚔ The DM Calls for a Roll" : "Choose Your Die";

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"rgba(3,2,12,0.97)",
      zIndex:100,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      backdropFilter:"blur(28px)",
    }}>

      {/* Screen flash */}
      {showFlash && (
        <div style={{ position:"absolute",inset:0,pointerEvents:"none",zIndex:200,
          background:flashColor, animation:"screenFlash 1.4s ease-out forwards" }}/>
      )}

      {/* Top glow halo */}
      <div style={{ position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
        width:"700px",height:"320px", pointerEvents:"none",
        background:"radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.22) 0%, transparent 70%)" }}/>

      {/* Cancel */}
      {onCancel && phase==="idle" && (
        <button onClick={onCancel} style={{
          position:"absolute",top:"24px",right:"28px",
          background:"none",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:"8px",padding:"6px 14px",
          color:"#475569",fontSize:"0.78rem",cursor:"pointer",
          transition:"border-color 0.15s,color 0.15s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.25)";e.currentTarget.style.color="#94a3b8";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";e.currentTarget.style.color="#475569";}}>
          ✕ Cancel
        </button>
      )}

      {/* DM context prompt */}
      {rollContext && phase!=="result" && (
        <div style={{
          maxWidth:"520px",padding:"12px 20px",marginBottom:"24px",
          background:"rgba(139,92,246,0.07)",border:"1px solid rgba(139,92,246,0.22)",
          borderRadius:"10px",color:"#c4b5fd",fontSize:"0.88rem",
          lineHeight:1.55,textAlign:"center",fontStyle:"italic",
        }}>{rollContext}</div>
      )}

      {/* Header label */}
      <p style={{ color:"#6366f1",fontSize:"0.72rem",fontWeight:700,letterSpacing:"0.18em",
        textTransform:"uppercase",marginBottom:"8px" }}>{headerLabel}</p>

      {/* Title */}
      {phase==="idle" && (
        <p style={{ fontSize:"1.6rem",fontWeight:800,color:"white",marginBottom:"40px",letterSpacing:"-0.01em" }}>
          {requiredDice
            ? <>Roll a <span style={{color:"#a78bfa",textShadow:"0 0 24px rgba(139,92,246,0.8)"}}>d{requiredDice}</span>
                {isAdvDis && <span style={{fontSize:"1rem",color:"#64748b",marginLeft:"12px",fontWeight:600}}>({requiredRollMode})</span>}</>
            : "Choose your die"}
        </p>
      )}
      {phase==="rolling" && requiredDice && (
        <p style={{ fontSize:"1.4rem",fontWeight:800,color:"white",marginBottom:"32px",letterSpacing:"-0.01em" }}>
          Rolling <span style={{color:"#a78bfa",textShadow:"0 0 20px rgba(139,92,246,0.8)"}}>d{requiredDice}</span>
          {isAdvDis && <span style={{fontSize:"0.9rem",color:"#64748b",marginLeft:"10px"}}>({requiredRollMode})</span>}
        </p>
      )}

      {/* Wrong die warning */}
      {wrongDie && (
        <div style={{
          position:"absolute",top:"calc(50% - 200px)",
          background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.5)",
          borderRadius:"10px",padding:"10px 24px",
          color:"#f87171",fontSize:"0.88rem",fontWeight:600,
          animation:"fadeIn 0.2s ease-out",
        }}>A d{requiredDice} is called for — choose wisely.</div>
      )}

      {/* ── Idle: die grid or single auto-roll die ── */}
      {phase==="idle" && (
        requiredDice
          // If DM called for a die, show it spinning and about to roll
          ? (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"20px",
              animation:"dieBobFloat 2.2s ease-in-out infinite" }}>
              <div style={{ position:"relative" }}>
                <div style={{ position:"absolute",inset:"-32px",borderRadius:"50%",
                  background:"radial-gradient(circle, rgba(139,92,246,0.45) 0%, transparent 65%)",
                  animation:"beaconPulse 1.5s ease-in-out infinite",pointerEvents:"none" }}/>
                <DieSVG sides={requiredDice} size={140}
                  edgeColor={CRYSTAL_EDGE} glowColor={CRYSTAL_GLOW} faceColor={CRYSTAL_FACE}/>
              </div>
              <span style={{ fontSize:"1rem",fontWeight:800,color:"#c4b5fd",
                letterSpacing:"0.06em",textShadow:"0 0 18px rgba(139,92,246,0.75)" }}>
                Rolling…
              </span>
            </div>
          )
          // Full 7-die grid for freestyle rolls
          : (
            <div style={{
              display:"flex",gap:"20px",flexWrap:"wrap",justifyContent:"center",
              maxWidth:"600px",padding:"0 20px",
              animation:wrongDie?"diceShake 0.45s ease-in-out":"none",
            }}>
              {DICE_SIDES.map(sides => (
                <button key={sides} onClick={()=>handleDieClick(sides)} style={{
                  background:"none",border:"none",cursor:"pointer",padding:0,
                  display:"flex",flexDirection:"column",alignItems:"center",gap:"10px",
                  transition:"transform 0.18s ease",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.14) translateY(-4px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="none";}}>
                  <DieSVG sides={sides} size={68}
                    edgeColor={CRYSTAL_EDGE} glowColor={CRYSTAL_GLOW} faceColor={CRYSTAL_FACE}/>
                  <span style={{ fontSize:"0.76rem",fontWeight:700,color:"#475569",letterSpacing:"0.05em" }}>
                    {DIE_LABEL[sides]}
                  </span>
                </button>
              ))}
            </div>
          )
      )}

      {/* ── Rolling phase ── */}
      {phase==="rolling" && selectedDie && (
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"36px" }}>
          <div style={{ position:"relative",width:"220px",height:"220px",
            display:"flex",alignItems:"center",justifyContent:"center",
            perspective:"600px",perspectiveOrigin:"50% 40%" }}>

            {/* Outer atmosphere */}
            <div style={{ position:"absolute",inset:"-24px",borderRadius:"50%",
              background:"radial-gradient(circle, rgba(139,92,246,0.30) 0%, transparent 65%)",
              animation:"outerPulse 0.42s ease-in-out infinite alternate" }}/>

            {/* Table shadow */}
            <div style={{ position:"absolute",bottom:"-10px",left:"50%",transform:"translateX(-50%)",
              width:"120px",height:"22px",
              background:"radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
              filter:"blur(5px)", animation:"shadowPulse 0.42s ease-in-out infinite alternate" }}/>

            {/* Orbiting light sparks */}
            <div style={{ position:"absolute",left:"50%",top:"50%",width:0,height:0 }}>
              {[0,1,2,3,4,5].map(i => {
                const r = 72+(i%2)*20, dur = 0.8+i*0.12, delay = -(i/6)*dur;
                return (
                  <div key={i} style={{ position:"absolute",width:0,height:0,
                    animation:`orbit ${dur}s linear ${delay}s infinite` }}>
                    <div style={{ position:"absolute",
                      left:`${r}px`,top:`${-(1.5+i%2)}px`,
                      width:`${3+(i%3)}px`,height:`${3+(i%3)}px`,
                      borderRadius:"50%",opacity:0.78,
                      background:i%3===0?"#fbbf24":i%3===1?"#a78bfa":"#e0d7ff",
                      boxShadow:`0 0 8px ${i%3===0?"#fbbf24":"#8b5cf6"}` }}/>
                  </div>
                );
              })}
            </div>

            {/* The spinning die */}
            <div style={{
              animation:"dieRollSpin 0.62s ease-in-out infinite",
              filter:`drop-shadow(0 0 28px ${CRYSTAL_GLOW}) drop-shadow(0 8px 24px rgba(0,0,0,0.88))`,
            }}>
              <DieSVG sides={selectedDie} size={172}
                edgeColor={CRYSTAL_EDGE} glowColor={CRYSTAL_GLOW} faceColor={CRYSTAL_FACE}
                numberValue={displayNum}/>
            </div>
          </div>

          <div style={{ textAlign:"center" }}>
            <p style={{ color:"#6366f1",fontSize:"0.9rem",fontWeight:700,letterSpacing:"0.12em",
              textTransform:"uppercase",animation:"breathe 1s ease-in-out infinite alternate" }}>
              {isAdvDis ? "Rolling twice…" : "Casting the fates…"}
            </p>
            <p style={{ color:"#334155",fontSize:"0.72rem",marginTop:"6px",letterSpacing:"0.06em" }}>
              {isAdvDis
                ? (requiredRollMode==="advantage" ? "Keeping the higher roll" : "Keeping the lower roll")
                : "May fortune favor you"}
            </p>
          </div>
        </div>
      )}

      {/* ── Result phase ── */}
      {phase==="result" && result!==null && selectedDie && qs && quality && (
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"28px",
          animation:"resultReveal 0.55s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <div style={{ position:"relative",width:"240px",height:"240px",
            display:"flex",alignItems:"center",justifyContent:"center" }}>

            {/* Particle burst */}
            <div style={{ position:"absolute",inset:0,pointerEvents:"none" }}>
              {Array.from({length:qs.pc}).map((_,i) => {
                const angle=(i/qs.pc)*360;
                const sz=quality==="crit"?7+(i%3)*2:4+(i%3);
                const delay=(i%5)*0.035;
                const dur=0.75+(i%3)*0.2;
                return (
                  <div key={i} style={{ position:"absolute",left:"50%",top:"50%",width:0,height:0,
                    transform:`rotate(${angle}deg)` }}>
                    <div style={{ position:"absolute",
                      width:`${sz}px`,height:`${sz}px`,
                      marginLeft:`${-sz/2}px`,marginTop:`${-sz/2}px`,
                      background:qs.edge,borderRadius:quality==="crit"?"1px":"50%",
                      boxShadow:`0 0 ${sz*2}px ${qs.edge}`,
                      animation:`particleShoot ${dur}s cubic-bezier(0.1,0.8,0.3,1) ${delay}s both` }}/>
                  </div>
                );
              })}
            </div>

            {/* Crit stars */}
            {quality==="crit" && [
              {l:"12px",t:"12px"},{l:"168px",t:"8px"},{l:"8px",t:"162px"},
              {l:"164px",t:"160px"},{l:"88px",t:"2px"},{l:"88px",t:"172px"},
            ].map(({l,t},i) => (
              <div key={i} style={{ position:"absolute",left:l,top:t,zIndex:10,pointerEvents:"none",
                fontSize:`${0.72+(i%3)*0.38}rem`,color:"#fbbf24",
                animation:`critStar ${1.1+i*0.18}s ease-out ${i*0.1}s both`,
                textShadow:"0 0 12px rgba(251,191,36,0.9)" }}>✦</div>
            ))}

            {/* Far glow ring */}
            <div style={{ position:"absolute",inset:"-44px",borderRadius:"50%",
              background:`radial-gradient(circle, ${qs.glow.replace("rgba(","rgba(").replace(",.9",",.24").replace(",.75",",.22").replace(",.55",",.18").replace(",.6",",.18").replace(",.45",",.14")} 0%, transparent 65%)`,
              animation:"outerPulse 1.4s ease-in-out infinite alternate" }}/>

            {/* Settled die */}
            <div style={{ animation:"resultSettle 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <DieSVG sides={selectedDie} size={198}
                edgeColor={qs.edge} glowColor={qs.glow} faceColor={qs.face}
                numberValue={result}/>
            </div>
          </div>

          {/* Result labels */}
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:"0.8rem",fontWeight:600,color:"#64748b",letterSpacing:"0.08em",
              textTransform:"uppercase",marginBottom:"6px" }}>{DIE_LABEL[selectedDie]}</p>
            <p style={{
              fontSize:quality==="crit"||quality==="fumble"?"1.6rem":"1.3rem",
              fontWeight:800,color:qs.edge,
              textShadow:quality==="crit"||quality==="excellent"?`0 0 20px ${qs.glow}`:"none",
              letterSpacing:quality==="crit"?"0.06em":"-0.01em",
              animation:quality==="crit"||quality==="fumble"?"resultReveal 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s both":"none",
            }}>{qs.label||result}</p>
            {qs.sub && (
              <p style={{ fontSize:"0.82rem",color:qs.edge,opacity:0.7,marginTop:"4px",fontStyle:"italic" }}>
                {qs.sub}
              </p>
            )}
            {!qs.label && (
              <p style={{ fontSize:"0.78rem",color:"#475569",marginTop:"4px" }}>
                {result} on a {DIE_LABEL[selectedDie]}
              </p>
            )}
          </div>

          {/* Advantage/disadvantage secondary */}
          {altResult !== null && (
            <div style={{ display:"flex",alignItems:"center",gap:"14px",padding:"10px 20px",
              background:"rgba(255,255,255,0.03)",borderRadius:"10px",
              border:"1px solid rgba(255,255,255,0.07)",marginTop:"-12px" }}>
              <span style={{ fontSize:"0.7rem",fontWeight:700,letterSpacing:"0.1em",
                textTransform:"uppercase",
                color:requiredRollMode==="advantage"?"#4ade80":"#f87171" }}>
                {requiredRollMode==="advantage"?"▲ Advantage":"▼ Disadvantage"}
              </span>
              <span style={{ fontSize:"0.8rem",color:"#475569" }}>
                Also rolled:{" "}
                <span style={{ textDecoration:"line-through",color:"#334155",fontWeight:700 }}>
                  {altResult}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dieRollSpin {
          0%   { transform: rotate(0deg)    scale(1)    skewX(0deg);  }
          12%  { transform: rotate(62deg)   scale(0.91) skewX(4deg);  }
          25%  { transform: rotate(145deg)  scale(1.07) skewX(-5deg); }
          38%  { transform: rotate(228deg)  scale(0.93) skewX(6deg);  }
          51%  { transform: rotate(302deg)  scale(1.06) skewX(-4deg); }
          64%  { transform: rotate(384deg)  scale(0.92) skewX(5deg);  }
          77%  { transform: rotate(448deg)  scale(1.05) skewX(-3deg); }
          89%  { transform: rotate(520deg)  scale(0.94) skewX(2deg);  }
          100% { transform: rotate(580deg)  scale(1)    skewX(0deg);  }
        }
        @keyframes dieBobFloat {
          0%,100% { transform: translateY(0px)  rotate(-2deg); }
          50%     { transform: translateY(-9px) rotate(2deg);  }
        }
        @keyframes beaconPulse {
          0%   { opacity:0.45; transform:scale(0.90); }
          50%  { opacity:1;    transform:scale(1.10); }
          100% { opacity:0.45; transform:scale(0.90); }
        }
        @keyframes outerPulse {
          from { transform:scale(0.92); opacity:0.65; }
          to   { transform:scale(1.08); opacity:1;    }
        }
        @keyframes shadowPulse {
          from { transform:translateX(-50%) scaleX(0.82); opacity:0.38; }
          to   { transform:translateX(-50%) scaleX(1.12); opacity:0.65; }
        }
        @keyframes orbit {
          from { transform:rotate(0deg); }
          to   { transform:rotate(360deg); }
        }
        @keyframes breathe {
          from { opacity:0.5; }
          to   { opacity:1;   }
        }
        @keyframes resultReveal {
          0%   { transform:scale(0.38) rotate(-10deg); opacity:0; }
          65%  { transform:scale(1.07) rotate(1.5deg); }
          100% { transform:scale(1)    rotate(0deg);   opacity:1; }
        }
        @keyframes resultSettle {
          0%   { transform:scale(0.5) translateY(30px) rotate(-8deg); opacity:0; }
          55%  { transform:scale(1.08) translateY(-6px) rotate(1deg); }
          78%  { transform:scale(0.97) translateY(2px)  rotate(-0.5deg); }
          100% { transform:scale(1)    translateY(0)    rotate(0deg); opacity:1; }
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes particleShoot {
          0%   { transform:translateY(0)     scale(1);    opacity:1; }
          60%  { opacity:0.8; }
          100% { transform:translateY(-148px) scale(0);   opacity:0; }
        }
        @keyframes screenFlash {
          0%   { opacity:0; }
          12%  { opacity:1; }
          100% { opacity:0; }
        }
        @keyframes critStar {
          0%   { transform:translateY(0)     scale(0)   rotate(-15deg); opacity:0; }
          25%  { opacity:1; }
          70%  { transform:translateY(-30px) scale(1)   rotate(8deg);  opacity:1; }
          100% { transform:translateY(-60px) scale(0.4) rotate(25deg); opacity:0; }
        }
        @keyframes diceShake {
          0%,100% { transform:translateX(0); }
          18%     { transform:translateX(-10px); }
          36%     { transform:translateX(10px); }
          54%     { transform:translateX(-7px); }
          72%     { transform:translateX(7px); }
          88%     { transform:translateX(-3px); }
        }
      `}} />
    </div>
  );
}
