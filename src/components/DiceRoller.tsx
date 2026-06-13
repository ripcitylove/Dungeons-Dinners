"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
type DieSides = typeof DICE_SIDES[number];
const DIE_LABEL: Record<number, string> = { 4:"D4",6:"D6",8:"D8",10:"D10",12:"D12",20:"D20",100:"D100" };

type Quality = "crit"|"fumble"|"excellent"|"good"|"fair"|"poor";
function getQuality(r: number, s: number): Quality {
  if (s===20&&r===20) return "crit";
  if (s===20&&r===1)  return "fumble";
  const x = r/s;
  return x>=.9?"excellent":x>=.55?"good":x>=.3?"fair":"poor";
}

// Quality result themes — face colors are solid enough to clearly show the die shape
const QUALITY: Record<Quality,{
  edge:string; glow:string; face:string; label:string; sub:string;
  pc:number; flash:string|null; num:string;
}> = {
  crit:     {edge:"#fbbf24",glow:"rgba(251,191,36,.9)",  face:"rgba(140,85,0,0.68)",   label:"✦ CRITICAL HIT ✦",   sub:"Natural 20 — fate smiles upon you.", pc:20,flash:"rgba(251,191,36,.18)",num:"#fef9c3"},
  fumble:   {edge:"#9ca3af",glow:"rgba(100,116,139,.6)", face:"rgba(55,65,80,0.68)",   label:"Critical Fumble",     sub:"Natural 1 — the dice are cruel.",    pc:10,flash:"rgba(239,68,68,.16)",  num:"#d1d5db"},
  excellent:{edge:"#4ade80",glow:"rgba(34,197,94,.75)",  face:"rgba(15,120,55,0.65)",  label:"Excellent Roll!",      sub:"Fortune favors the bold.",           pc:14,flash:null,                   num:"#dcfce7"},
  good:     {edge:"#c4b5fd",glow:"rgba(139,92,246,.75)", face:"rgba(88,28,196,0.62)",  label:"",                     sub:"",                                   pc:8, flash:null,                   num:"#ede9fe"},
  fair:     {edge:"#94a3b8",glow:"rgba(100,116,139,.45)",face:"rgba(60,75,100,0.62)",  label:"",                     sub:"",                                   pc:4, flash:null,                   num:"#e2e8f0"},
  poor:     {edge:"#f87171",glow:"rgba(239,68,68,.55)",  face:"rgba(140,25,25,0.65)",  label:"Ouch.",               sub:"Better luck next time.",              pc:6, flash:null,                   num:"#fecaca"},
};

// ── Die geometry (0 0 100 100 viewBox) ───────────────────────────────────────
// Each die has: outer = silhouette path, faces = per-face polygons with a
// "dark" factor (-1..+1, negative=lit, positive=shadow), inner = interior
// edge lines that show through the crystal, and glint/number placement.
type FaceDef = { p: string; dark: number };
type Geom = {
  outer: string;
  faces: FaceDef[];
  inner: string[];
  gx:number; gy:number;
  nx:number; ny:number; nSize:number;
  isCircle?: true;
};

const GEOM: Record<number, Geom> = {
  // d4 — tetrahedron: equilateral triangle, Y from centroid creates 3 equal triangular faces
  4: {
    outer: "M50,6 L94,87 L6,87 Z",
    faces: [
      { p:"M50,6 L6,87 L50,60 Z",   dark:-0.10 }, // upper-left (most lit)
      { p:"M50,6 L50,60 L94,87 Z",  dark:0.04  }, // upper-right
      { p:"M6,87 L94,87 L50,60 Z",  dark:0.16  }, // bottom (darkest)
    ],
    inner: ["M50,6 L50,60","M6,87 L50,60","M94,87 L50,60"],
    gx:36,gy:28,
    nx:50,ny:78,nSize:20,
  },
  // d6 — isometric cube: hexagon, Y of inner lines points UP to top vertices,
  // center at (50,50). 3 visible faces: top (lit), right (mid), left (dark).
  6: {
    outer: "M50,10 L84,29 L84,71 L50,90 L16,71 L16,29 Z",
    faces: [
      { p:"M50,10 L84,29 L50,50 L16,29 Z", dark:-0.12 }, // top face — brightest
      { p:"M84,29 L84,71 L50,90 L50,50 Z", dark:0.08  }, // right face — medium
      { p:"M16,29 L16,71 L50,90 L50,50 Z", dark:0.20  }, // left face — darkest
    ],
    inner: ["M50,50 L50,10","M50,50 L84,29","M50,50 L16,29"],
    gx:36,gy:19,
    nx:50,ny:55,nSize:26,
  },
  // d8 — octahedron: diamond shape, 4 triangular faces, cross dividers
  8: {
    outer: "M50,5 L93,50 L50,95 L7,50 Z",
    faces: [
      { p:"M50,5 L7,50  L50,50 Z",  dark:-0.08 }, // upper-left (lit)
      { p:"M50,5 L93,50 L50,50 Z",  dark:0.04  }, // upper-right
      { p:"M7,50  L50,95 L50,50 Z", dark:0.10  }, // lower-left
      { p:"M93,50 L50,95 L50,50 Z", dark:0.18  }, // lower-right (darkest)
    ],
    inner: ["M7,50 L93,50","M50,5 L50,95"],
    gx:32,gy:22,
    nx:50,ny:56,nSize:26,
  },
  // d10 — pentagonal trapezohedron: wide diamond silhouette, 5 kite faces
  // Outer: 4-point diamond T(50,7) R(91,48) B(50,93) L(9,48)
  // Inner: UI(50,28) LI(50,72) LE(36,48) RE(64,48)
  10: {
    outer: "M50,7 L91,48 L50,93 L9,48 Z",
    faces: [
      { p:"M50,7 L9,48 L36,48 L50,28 Z",   dark:-0.08 }, // upper-left kite (lit)
      { p:"M50,7 L50,28 L64,48 L91,48 Z",   dark:0.02  }, // upper-right kite
      { p:"M50,28 L36,48 L50,72 L64,48 Z",  dark:-0.04 }, // center front kite
      { p:"M9,48 L36,48 L50,72 L50,93 Z",   dark:0.14  }, // lower-left kite
      { p:"M64,48 L91,48 L50,93 L50,72 Z",  dark:0.20  }, // lower-right kite (darkest)
    ],
    inner: [
      "M9,48 L36,48","M64,48 L91,48",
      "M50,7 L50,28","M50,28 L36,48","M50,28 L64,48",
      "M36,48 L50,72","M64,48 L50,72","M50,72 L50,93",
    ],
    gx:30,gy:18,
    nx:50,ny:65,nSize:22,
  },
  // d12 — dodecahedron: circular 10-gon outer, inner pentagon, 5 surrounding pentagon faces
  // Outer ring (CW): V0(50,6) V9(76,14) V8(92,36) V7(92,64) V6(76,86) V5(50,94) V4(24,86) V3(8,64) V2(8,36) V1(24,14)
  // Inner pentagon: P0(50,28) P1(71,43) P2(63,68) P3(37,68) P4(29,43)
  12: {
    outer: "M50,6 L76,14 L92,36 L92,64 L76,86 L50,94 L24,86 L8,64 L8,36 L24,14 Z",
    faces: [
      { p:"M50,28 L71,43 L63,68 L37,68 L29,43 Z",         dark: 0.06 }, // center pentagon
      { p:"M29,43 L50,28 L50,6 L24,14 L8,36 Z",            dark:-0.06 }, // upper-left face (lit)
      { p:"M50,28 L71,43 L92,36 L76,14 L50,6 Z",           dark: 0.02 }, // upper-right face
      { p:"M71,43 L63,68 L76,86 L92,64 L92,36 Z",          dark: 0.14 }, // right face
      { p:"M63,68 L37,68 L24,86 L50,94 L76,86 Z",          dark: 0.22 }, // bottom face (darkest)
      { p:"M37,68 L29,43 L8,36 L8,64 L24,86 Z",            dark: 0.10 }, // left face
    ],
    inner: [
      // 5 spokes: inner pentagon vertex → outer ring vertex
      "M50,28 L50,6","M71,43 L92,36","M63,68 L76,86","M37,68 L24,86","M29,43 L8,36",
      // 5 inner pentagon edges
      "M50,28 L71,43","M71,43 L63,68","M63,68 L37,68","M37,68 L29,43","M29,43 L50,28",
    ],
    gx:32,gy:16,
    nx:50,ny:54,nSize:20,
  },
  // d20 — icosahedron vertex-on "wheel" projection
  // C=(50,50) center vertex; inner ring V0-V4; outer ring O0-O4
  // 15 faces: 5 top-cap (lit) + 5 up-belt (mid) + 5 gap (dark)
  20: {
    outer: "M76,14 L92,64 L50,94 L8,64 L24,14 Z",
    faces: [
      // 5 top-cap faces (centre vertex C → inner ring) — brightest
      { p:"M50,50 L27,43 L50,26 Z", dark:-0.12 },
      { p:"M50,50 L50,26 L73,43 Z", dark:-0.08 },
      { p:"M50,50 L73,43 L64,69 Z", dark: 0.04 },
      { p:"M50,50 L36,69 L27,43 Z", dark:-0.02 },
      { p:"M50,50 L64,69 L36,69 Z", dark: 0.10 },
      // 5 up-belt faces (outer ring → inner ring) — medium
      { p:"M24,14 L27,43 L50,26 Z", dark:-0.04 },
      { p:"M76,14 L50,26 L73,43 Z", dark: 0.04 },
      { p:"M92,64 L73,43 L64,69 Z", dark: 0.14 },
      { p:"M8,64  L36,69 L27,43 Z", dark: 0.18 },
      { p:"M50,94 L64,69 L36,69 Z", dark: 0.24 },
      // 5 gap faces (outer ring edge triangles) — darkest
      { p:"M24,14 L76,14 L50,26 Z", dark: 0.22 },
      { p:"M76,14 L92,64 L73,43 Z", dark: 0.26 },
      { p:"M92,64 L50,94 L64,69 Z", dark: 0.30 },
      { p:"M50,94 L8,64  L36,69 Z", dark: 0.28 },
      { p:"M8,64  L24,14 L27,43 Z", dark: 0.22 },
    ],
    inner: [
      // 5 spokes C → inner ring
      "M50,50 L50,26","M50,50 L73,43","M50,50 L64,69","M50,50 L36,69","M50,50 L27,43",
      // 5 inner pentagon edges
      "M50,26 L73,43","M73,43 L64,69","M64,69 L36,69","M36,69 L27,43","M27,43 L50,26",
      // 10 outer spokes inner → outer ring
      "M50,26 L76,14","M73,43 L76,14","M73,43 L92,64","M64,69 L92,64",
      "M64,69 L50,94","M36,69 L50,94","M36,69 L8,64","M27,43 L8,64",
      "M27,43 L24,14","M50,26 L24,14",
    ],
    gx:28,gy:20,
    nx:50,ny:63,nSize:18,
  },
  // d100 — circle die
  100: {
    outer:"", faces:[], inner:[],
    gx:34,gy:30,
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
  [2200,3300,4400,6600].forEach((f,i) => tone(ctx, f, vol*(0.9**i), t, 0.6+i*0.08));
  tone(ctx, 1100, vol*0.55, t, 0.9, "triangle");
}
function playRollSound() {
  const ctx = getCtx(); if (!ctx) return;
  noise(ctx, 0.03, 2400, 0.55, 0, 2.2);
  noise(ctx, 0.04,  900, 0.48, 0.005);
  [0.06,0.11,0.17,0.24,0.33,0.45,0.59,0.76,0.96,1.18].forEach((t,i) => {
    noise(ctx, 0.035, 1800+Math.random()*600, 0.38*(0.82**i), t, 1.8);
    if (i%3===0) noise(ctx, 0.025, 800+Math.random()*400, 0.22*(0.82**i), t+0.01);
  });
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

// ── Per-face colour derivation ────────────────────────────────────────────────
// dark: negative = lit (brighter), positive = shadow (darker).
// Produces a visible colour difference between faces so the die reads as 3-D.
function shadeFace(base: string, dark: number): string {
  const m = base.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return base;
  const [r, g, b, a] = [+m[1], +m[2], +m[3], +(m[4] ?? "1")];
  const f = dark * 2.8;                                        // amplify difference
  const nr = Math.round(Math.max(0, Math.min(255, r * (1 - f * 0.38))));
  const ng = Math.round(Math.max(0, Math.min(255, g * (1 - f * 0.38))));
  const nb = Math.round(Math.max(0, Math.min(255, b * (1 - f * 0.38))));
  const na = +(Math.max(0.10, Math.min(0.95, a + f * 0.14)).toFixed(2));
  return `rgba(${nr},${ng},${nb},${na})`;
}

// ── Crystal Die SVG ───────────────────────────────────────────────────────────
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
  const uid = `die${sides}g${Math.round(size)}`;   // unique per size to avoid gradient conflicts

  const wrapStyle: React.CSSProperties = {
    width: size, height: size,
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: spinning
      ? `dieRollSpin 0.68s ease-in-out infinite`
      : idleAnim
      ? `dieBobFloat 2.2s ease-in-out infinite`
      : undefined,
    filter: `drop-shadow(0 0 ${Math.round(size*0.13)}px ${glowColor}) drop-shadow(0 6px 20px rgba(0,0,0,0.88))`,
  };

  if (g.isCircle) {
    return (
      <div style={wrapStyle}>
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id={`${uid}rg`} cx="0.35" cy="0.3" r="0.55">
              <stop offset="0%" stopColor="rgba(255,255,255,0.70)"/>
              <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill={shadeFace(faceColor, 0.08)} stroke={edgeColor} strokeWidth="2"/>
          <circle cx="50" cy="50" r="34" fill="none" stroke={edgeColor} strokeWidth="0.9" strokeOpacity="0.4"/>
          <line x1="6" y1="50" x2="94" y2="50" stroke={edgeColor} strokeWidth="0.8" strokeOpacity="0.28"/>
          <line x1="50" y1="6" x2="50" y2="94" stroke={edgeColor} strokeWidth="0.8" strokeOpacity="0.28"/>
          <circle cx="50" cy="50" r="44" fill={`url(#${uid}rg)`}/>
          {numberValue != null && (
            <text x={g.nx} y={g.ny} textAnchor="middle" dominantBaseline="middle"
              fontSize={g.nSize} fontWeight="700" fill="rgba(255,255,255,0.97)"
              stroke="rgba(0,0,0,0.55)" strokeWidth="0.5" paintOrder="stroke"
              fontFamily="Cinzel,Palatino Linotype,serif">{numberValue}</text>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <defs>
          <radialGradient id={`${uid}rg`} cx="0.35" cy="0.28" r="0.58">
            <stop offset="0%" stopColor="rgba(255,255,255,0.72)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
          <filter id={`${uid}ef`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Per-face shaded fills — each face gets its own derived colour for 3-D depth */}
        {g.faces.map((f, i) => (
          <path key={i} d={f.p} fill={shadeFace(faceColor, f.dark)}/>
        ))}

        {/* Interior structural edges — the crystal's internal geometry */}
        {g.inner.map((ln, i) => (
          <path key={i} d={ln} stroke={edgeColor} strokeWidth="0.75" strokeOpacity="0.42" strokeLinecap="round"/>
        ))}

        {/* Outer silhouette edge — bright, glowing */}
        <path d={g.outer} fill="none" stroke={edgeColor} strokeWidth="2" strokeLinejoin="round"
          filter={`url(#${uid}ef)`}/>

        {/* Thin specular highlight along lit edges */}
        <path d={g.outer} fill="none" stroke="rgba(255,255,255,0.50)" strokeWidth="0.8" strokeLinejoin="round"/>

        {/* Light-reflection glint patch in upper-left */}
        <path d={g.outer} fill={`url(#${uid}rg)`}/>

        {/* Die number */}
        {numberValue != null && (
          <text x={g.nx} y={g.ny} textAnchor="middle" dominantBaseline="middle"
            fontSize={g.nSize} fontWeight="700" fill="rgba(255,255,255,0.97)"
            stroke="rgba(0,0,0,0.60)" strokeWidth="0.6" paintOrder="stroke"
            fontFamily="Cinzel,Palatino Linotype,serif">{numberValue}</text>
        )}
      </svg>
    </div>
  );
}

// ── D20 toolbar icon ──────────────────────────────────────────────────────────
// Vertex-on icosahedron "wheel": outer pentagon + inner pentagon + spokes
export function D20Icon({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M76,14 L92,64 L50,94 L8,64 L24,14 Z"
        fill="rgba(88,28,196,0.40)" stroke={color} strokeWidth="4.5" strokeLinejoin="round"/>
      <path d="M50,26 L73,43 L64,69 L36,69 L27,43 Z"
        fill="rgba(167,139,250,0.22)" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.70"/>
      <line x1="50" y1="50" x2="50" y2="26" stroke={color} strokeWidth="1.5" strokeOpacity="0.55"/>
      <line x1="50" y1="50" x2="73" y2="43" stroke={color} strokeWidth="1.5" strokeOpacity="0.55"/>
      <line x1="50" y1="50" x2="64" y2="69" stroke={color} strokeWidth="1.5" strokeOpacity="0.55"/>
      <line x1="50" y1="50" x2="36" y2="69" stroke={color} strokeWidth="1.5" strokeOpacity="0.55"/>
      <line x1="50" y1="50" x2="27" y2="43" stroke={color} strokeWidth="1.5" strokeOpacity="0.55"/>
      <line x1="50" y1="26" x2="76" y2="14" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
      <line x1="73" y1="43" x2="76" y2="14" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
      <line x1="73" y1="43" x2="92" y2="64" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
      <line x1="64" y1="69" x2="92" y2="64" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
      <line x1="64" y1="69" x2="50" y2="94" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
      <line x1="36" y1="69" x2="50" y2="94" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
      <line x1="36" y1="69" x2="8"  y2="64" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
      <line x1="27" y1="43" x2="8"  y2="64" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
      <line x1="27" y1="43" x2="24" y2="14" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
      <line x1="50" y1="26" x2="24" y2="14" stroke={color} strokeWidth="1" strokeOpacity="0.40"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
// Crystal palette for idle/rolling state
const CRYSTAL_EDGE = "rgba(196,181,253,0.90)";
const CRYSTAL_GLOW = "rgba(139,92,246,0.82)";
const CRYSTAL_FACE = "rgba(88,28,196,0.62)";   // solid enough to see the shape clearly

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

  const countupRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const didRoll      = useRef(false);
  const narVolumeRef = useRef(narVolume ?? 1);
  const narMutedRef  = useRef(narMuted  ?? false);
  useEffect(() => { narVolumeRef.current = narVolume ?? 1;    }, [narVolume]);
  useEffect(() => { narMutedRef.current  = narMuted  ?? false; }, [narMuted]);

  // Hide the floating Tooltip / Back / Save toolbar while the roll modal is up —
  // those buttons sit at zIndex 9998 above the modal and clutter the screen.
  useEffect(() => {
    document.body.classList.add("dice-modal-open");
    return () => { document.body.classList.remove("dice-modal-open"); };
  }, []);

  const isAdvDis = !!requiredRollMode && requiredRollMode !== "normal";
  const quality  = result !== null && selectedDie !== null ? getQuality(result, selectedDie) : null;
  const qs       = quality ? QUALITY[quality] : null;

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

    setTimeout(() => {
      countupRef.current = setInterval(() => setDisplayNum(Math.floor(Math.random()*sides)+1), 60);
    }, 620);

    setTimeout(() => {
      if (countupRef.current) { clearInterval(countupRef.current); countupRef.current=null; }
      setResult(kept); setAltResult(dropped); setDisplayNum(kept);
      setPhase("result");
      const q = getQuality(kept, sides);
      playResultSound(q);
      if (q==="crit")   { const c=new Audio("/angelic_choir.mp3"); c.volume=0.75; c.play().catch(()=>{}); }
      if (q==="fumble") { const f=new Audio("/disappointing.mp3"); f.volume=0.75; f.play().catch(()=>{}); }
      const qd = QUALITY[q];
      if (qd.flash) { setFlashColor(qd.flash); setShowFlash(true); setTimeout(()=>setShowFlash(false),1400); }
      const desc = r2!==null
        ? `Rolled with ${requiredRollMode}: ${r1} and ${r2}, taking ${kept} on a ${DIE_LABEL[sides] ?? `D${sides}`}`
        : undefined;
      setTimeout(() => onRollComplete(kept, sides, desc), 2800);
    }, 1380);
  }, [requiredRollMode, isAdvDis, onRollComplete]);

  // Do NOT auto-roll — always require the player to click the die.

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

      {showFlash && (
        <div style={{ position:"absolute",inset:0,pointerEvents:"none",zIndex:200,
          background:flashColor, animation:"screenFlash 1.4s ease-out forwards" }}/>
      )}

      <div style={{ position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
        width:"700px",height:"320px", pointerEvents:"none",
        background:"radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.22) 0%, transparent 70%)" }}/>

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

      {rollContext && phase!=="result" && (
        <div style={{
          maxWidth:"520px",padding:"12px 20px",marginBottom:"24px",
          background:"rgba(139,92,246,0.07)",border:"1px solid rgba(139,92,246,0.22)",
          borderRadius:"10px",color:"#c4b5fd",fontSize:"0.88rem",
          lineHeight:1.55,textAlign:"center",fontStyle:"italic",
        }}>{rollContext}</div>
      )}

      <p style={{ color:"#6366f1",fontSize:"0.72rem",fontWeight:700,letterSpacing:"0.18em",
        textTransform:"uppercase",marginBottom:"8px" }}>{headerLabel}</p>

      {phase==="idle" && (
        <p style={{ fontSize:"1.6rem",fontWeight:800,color:"white",marginBottom:"40px",letterSpacing:"-0.01em" }}>
          {requiredDice
            ? <>Roll a <span style={{color:"#a78bfa",textShadow:"0 0 24px rgba(139,92,246,0.8)"}}>{DIE_LABEL[requiredDice] ?? `D${requiredDice}`}</span>
                {isAdvDis && <span style={{fontSize:"1rem",color:"#64748b",marginLeft:"12px",fontWeight:600}}>({requiredRollMode})</span>}</>
            : "Choose your die"}
        </p>
      )}
      {phase==="rolling" && requiredDice && (
        <p style={{ fontSize:"1.4rem",fontWeight:800,color:"white",marginBottom:"32px",letterSpacing:"-0.01em" }}>
          Rolling <span style={{color:"#a78bfa",textShadow:"0 0 20px rgba(139,92,246,0.8)"}}>{DIE_LABEL[requiredDice] ?? `D${requiredDice}`}</span>
          {isAdvDis && <span style={{fontSize:"0.9rem",color:"#64748b",marginLeft:"10px"}}>({requiredRollMode})</span>}
        </p>
      )}

      {wrongDie && requiredDice && (
        <div style={{
          position:"absolute",top:"calc(50% - 200px)",
          background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.5)",
          borderRadius:"10px",padding:"10px 24px",
          color:"#f87171",fontSize:"0.88rem",fontWeight:600,
          animation:"fadeIn 0.2s ease-out",
        }}>A {DIE_LABEL[requiredDice] ?? `D${requiredDice}`} is called for — choose wisely.</div>
      )}

      {/* ── Idle phase ── */}
      {phase==="idle" && (
        requiredDice
          ? (
            <button onClick={() => handleDieClick(requiredDice as DieSides)}
              style={{ background:"none",border:"none",cursor:"pointer",padding:0,
                display:"flex",flexDirection:"column",alignItems:"center",gap:"20px" }}>
              <div style={{ position:"relative", animation:"dieBobFloat 2.2s ease-in-out infinite" }}>
                <div style={{ position:"absolute",inset:"-32px",borderRadius:"50%",
                  background:"radial-gradient(circle, rgba(139,92,246,0.45) 0%, transparent 65%)",
                  animation:"beaconPulse 1.5s ease-in-out infinite",pointerEvents:"none" }}/>
                <DieSVG sides={requiredDice} size={140}
                  edgeColor={CRYSTAL_EDGE} glowColor={CRYSTAL_GLOW} faceColor={CRYSTAL_FACE}/>
              </div>
              <span style={{ fontSize:"1rem",fontWeight:800,color:"#c4b5fd",
                letterSpacing:"0.06em",textShadow:"0 0 18px rgba(139,92,246,0.75)" }}>
                Click to Roll
              </span>
            </button>
          )
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
                  <DieSVG sides={sides} size={70}
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
            display:"flex",alignItems:"center",justifyContent:"center" }}>

            <div style={{ position:"absolute",inset:"-24px",borderRadius:"50%",
              background:"radial-gradient(circle, rgba(139,92,246,0.30) 0%, transparent 65%)",
              animation:"outerPulse 0.42s ease-in-out infinite alternate" }}/>

            <div style={{ position:"absolute",bottom:"-10px",left:"50%",transform:"translateX(-50%)",
              width:"120px",height:"22px",
              background:"radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
              filter:"blur(5px)", animation:"shadowPulse 0.42s ease-in-out infinite alternate" }}/>

            <div style={{ position:"absolute",left:"50%",top:"50%",width:0,height:0 }}>
              {[0,1,2,3,4,5].map(i => {
                const r=72+(i%2)*20, dur=0.8+i*0.12, delay=-(i/6)*dur;
                return (
                  <div key={i} style={{ position:"absolute",width:0,height:0,
                    animation:`orbit ${dur}s linear ${delay}s infinite` }}>
                    <div style={{ position:"absolute",left:`${r}px`,top:`${-(1.5+i%2)}px`,
                      width:`${3+(i%3)}px`,height:`${3+(i%3)}px`,
                      borderRadius:"50%",opacity:0.80,
                      background:i%3===0?"#fbbf24":i%3===1?"#a78bfa":"#e0d7ff",
                      boxShadow:`0 0 8px ${i%3===0?"#fbbf24":"#8b5cf6"}` }}/>
                  </div>
                );
              })}
            </div>

            <div style={{ animation:"dieRollSpin 0.62s ease-in-out infinite",
              filter:`drop-shadow(0 0 28px ${CRYSTAL_GLOW}) drop-shadow(0 8px 24px rgba(0,0,0,0.88))` }}>
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

            {quality==="crit" && [
              {l:"12px",t:"12px"},{l:"168px",t:"8px"},{l:"8px",t:"162px"},
              {l:"164px",t:"160px"},{l:"88px",t:"2px"},{l:"88px",t:"172px"},
            ].map(({l,t},i) => (
              <div key={i} style={{ position:"absolute",left:l,top:t,zIndex:10,pointerEvents:"none",
                fontSize:`${0.72+(i%3)*0.38}rem`,color:"#fbbf24",
                animation:`critStar ${1.1+i*0.18}s ease-out ${i*0.1}s both`,
                textShadow:"0 0 12px rgba(251,191,36,0.9)" }}>✦</div>
            ))}

            <div style={{ position:"absolute",inset:"-44px",borderRadius:"50%",
              background:`radial-gradient(circle, ${qs.glow.replace(/[\d.]+\)$/,"0.22)")} 0%, transparent 65%)`,
              animation:"outerPulse 1.4s ease-in-out infinite alternate" }}/>

            <div style={{ animation:"resultSettle 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <DieSVG sides={selectedDie} size={198}
                edgeColor={qs.edge} glowColor={qs.glow} faceColor={qs.face}
                numberValue={result}/>
            </div>
          </div>

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
          0%   { transform: rotate(0deg)   scale(1)    skewX(0deg);   }
          12%  { transform: rotate(65deg)  scale(0.90) skewX(5deg);   }
          25%  { transform: rotate(150deg) scale(1.08) skewX(-6deg);  }
          38%  { transform: rotate(235deg) scale(0.92) skewX(6deg);   }
          51%  { transform: rotate(308deg) scale(1.07) skewX(-5deg);  }
          64%  { transform: rotate(390deg) scale(0.91) skewX(5deg);   }
          77%  { transform: rotate(455deg) scale(1.06) skewX(-4deg);  }
          90%  { transform: rotate(528deg) scale(0.93) skewX(3deg);   }
          100% { transform: rotate(580deg) scale(1)    skewX(0deg);   }
        }
        @keyframes dieBobFloat {
          0%,100% { transform: translateY(0px)   rotate(-2deg); }
          50%     { transform: translateY(-10px) rotate(2deg);  }
        }
        @keyframes beaconPulse {
          0%   { opacity:0.40; transform:scale(0.88); }
          50%  { opacity:1;    transform:scale(1.12); }
          100% { opacity:0.40; transform:scale(0.88); }
        }
        @keyframes outerPulse {
          from { transform:scale(0.92); opacity:0.65; }
          to   { transform:scale(1.08); opacity:1;    }
        }
        @keyframes shadowPulse {
          from { transform:translateX(-50%) scaleX(0.80); opacity:0.35; }
          to   { transform:translateX(-50%) scaleX(1.14); opacity:0.65; }
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
          0%   { transform:scale(0.5) translateY(28px) rotate(-8deg); opacity:0; }
          55%  { transform:scale(1.08) translateY(-6px) rotate(1deg); }
          78%  { transform:scale(0.97) translateY(2px)  rotate(-0.5deg); }
          100% { transform:scale(1)    translateY(0)    rotate(0deg); opacity:1; }
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes particleShoot {
          0%   { transform:translateY(0)      scale(1);  opacity:1; }
          60%  { opacity:0.8; }
          100% { transform:translateY(-148px) scale(0);  opacity:0; }
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
