"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Hand-crafted SVG weapon icons — painterly "RPG inventory" style inspired by the
// reference sheet: each weapon at a dynamic diagonal on a dark vignette tile, with
// steel blades (bright edge → dark spine), wooden hafts, leather grips, and gold
// fittings. One cohesive set so the equipment picker stops looking like emoji.
//
// Each icon is its own <svg> with defs prefixed by a unique id (so multiple icons
// on one screen never collide). 64×64 viewBox; the weapon is drawn pointing "up"
// then rotated for the signature diagonal pose.
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";

export type WeaponIconProps = { size?: number; style?: React.CSSProperties; className?: string };

// ── Shared material gradients (steel / wood / leather / gold) ─────────────────
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-tile`} cx="0.38" cy="0.28" r="0.9">
        <stop offset="0%" stopColor="#323d57" />
        <stop offset="55%" stopColor="#1a2130" />
        <stop offset="100%" stopColor="#0b0e16" />
      </radialGradient>
      <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2="0.25">
        <stop offset="0%" stopColor="#fbfdff" />
        <stop offset="28%" stopColor="#c4cedb" />
        <stop offset="62%" stopColor="#7c8a9c" />
        <stop offset="100%" stopColor="#434d5c" />
      </linearGradient>
      <linearGradient id={`${id}-steelDark`} x1="0" y1="0" x2="1" y2="0.25">
        <stop offset="0%" stopColor="#9aa6b6" />
        <stop offset="60%" stopColor="#505a6a" />
        <stop offset="100%" stopColor="#2a313d" />
      </linearGradient>
      <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0.12">
        <stop offset="0%" stopColor="#b88b56" />
        <stop offset="48%" stopColor="#855d31" />
        <stop offset="100%" stopColor="#452b12" />
      </linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="0.45">
        <stop offset="0%" stopColor="#ffeaa8" />
        <stop offset="45%" stopColor="#e3b65d" />
        <stop offset="100%" stopColor="#996922" />
      </linearGradient>
      <linearGradient id={`${id}-leather`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#5d4028" />
        <stop offset="50%" stopColor="#3b2716" />
        <stop offset="100%" stopColor="#221507" />
      </linearGradient>
    </defs>
  );
}

function Tile({ id, size = 48, children }: { id: string; size?: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <Defs id={id} />
      <rect x="1.5" y="1.5" width="61" height="61" rx="13" fill={`url(#${id}-tile)`} stroke="#070a11" strokeWidth="1.5" />
      <rect x="3" y="3" width="58" height="58" rx="11" fill="none" stroke="#ffffff" strokeOpacity="0.07" />
      {children}
    </svg>
  );
}

const OUTLINE = "#0d121b";

// ── Reusable parts (drawn upright, centered on x=32) ──────────────────────────
function Grip({ id, top, bottom, w = 4 }: { id: string; top: number; bottom: number; w?: number }) {
  const x = 32 - w / 2;
  const wraps = [];
  for (let y = top + 1.5; y < bottom - 0.5; y += 2.1) wraps.push(y);
  return (
    <g>
      <rect x={x} y={top} width={w} height={bottom - top} rx={w / 3} fill={`url(#${id}-leather)`} stroke="#140c05" strokeWidth="0.6" />
      {wraps.map((y, i) => (
        <line key={i} x1={x - 0.2} y1={y} x2={x + w + 0.2} y2={y + 0.7} stroke="#1a1108" strokeWidth="0.8" strokeLinecap="round" />
      ))}
      <line x1={x + 0.5} y1={top + 0.5} x2={x + 0.5} y2={bottom - 0.5} stroke="#7a5536" strokeWidth="0.5" strokeOpacity="0.5" />
    </g>
  );
}

function Haft({ id, top, bottom, w = 2.9, butt = true }: { id: string; top: number; bottom: number; w?: number; butt?: boolean }) {
  return (
    <g>
      <rect x={32 - w / 2} y={top} width={w} height={bottom - top} rx={w / 3} fill={`url(#${id}-wood)`} stroke={OUTLINE} strokeWidth="0.6" />
      <line x1={32 - w / 2 + 0.6} y1={top + 1} x2={32 - w / 2 + 0.6} y2={bottom - 1} stroke="#caa06a" strokeWidth="0.5" strokeOpacity="0.4" />
      {butt && <rect x={32 - w / 2 - 0.5} y={bottom - 3.2} width={w + 1} height="3.4" rx="1.2" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />}
    </g>
  );
}

function Pommel({ id, y, r = 2.4 }: { id: string; y: number; r?: number }) {
  return (
    <g>
      <circle cx="32" cy={y} r={r} fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.6" />
      <circle cx={32 - r * 0.3} cy={y - r * 0.3} r={r * 0.28} fill="#fff6d8" />
    </g>
  );
}

// Straight double-edged blade: tip at `tip`, shoulders at `tip+6`, base at `base`.
function StraightBlade({ id, tip, base, hw }: { id: string; tip: number; base: number; hw: number }) {
  const sh = tip + (base - tip) * 0.16; // shoulder y
  return (
    <g>
      <path
        d={`M32 ${tip} L${32 + hw} ${sh} L${32 + hw} ${base} L${32 - hw} ${base} L${32 - hw} ${sh} Z`}
        fill={`url(#${id}-steel)`}
        stroke={OUTLINE}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {/* dark spine on the right half for volume */}
      <path d={`M32 ${tip} L${32 + hw} ${sh} L${32 + hw} ${base} L32 ${base} Z`} fill="#000" fillOpacity="0.16" />
      {/* center fuller + edge highlight */}
      <line x1="32" y1={sh + 1} x2="32" y2={base - 1} stroke="#eef4fb" strokeWidth="0.7" strokeOpacity="0.65" />
      <line x1={32 - hw + 0.7} y1={sh + 1} x2={32 - hw + 0.7} y2={base - 0.5} stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.55" />
    </g>
  );
}

// ── Individual weapons ────────────────────────────────────────────────────────
function Dagger({ size }: { size?: number }) {
  const id = "wpn-dagger";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-42 32 32)">
        <StraightBlade id={id} tip={13} base={36} hw={2.6} />
        <rect x="24.5" y="35.5" width="15" height="3.4" rx="1.6" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.6" />
        <Grip id={id} top={38.5} bottom={48} w={3.6} />
        <Pommel id={id} y={49.5} r={2.2} />
      </g>
    </Tile>
  );
}

function Longsword({ size }: { size?: number }) {
  const id = "wpn-longsword";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-42 32 32)">
        <StraightBlade id={id} tip={6} base={40} hw={3} />
        <rect x="22" y="39.5" width="20" height="3.8" rx="1.9" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.6" />
        <circle cx="22.5" cy="41.4" r="1.5" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        <circle cx="41.5" cy="41.4" r="1.5" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        <Grip id={id} top={43} bottom={53} w={4} />
        <Pommel id={id} y={54.5} r={2.6} />
      </g>
    </Tile>
  );
}

function Greatsword({ size }: { size?: number }) {
  const id = "wpn-greatsword";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-42 32 32)">
        <StraightBlade id={id} tip={4} base={40} hw={4.1} />
        {/* broad crossguard with downturned quillons */}
        <path d="M19 40 Q21 43 26 42 L38 42 Q43 43 45 40 L45 43.4 Q43 45 38 44.4 L26 44.4 Q21 45 19 43.4 Z" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.6" strokeLinejoin="round" />
        <Grip id={id} top={44} bottom={56} w={4.2} />
        <Pommel id={id} y={57.5} r={2.8} />
      </g>
    </Tile>
  );
}

function Battleaxe({ size }: { size?: number }) {
  const id = "wpn-battleaxe";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        <Haft id={id} top={14} bottom={55} w={3.2} />
        {/* axe head — chunky single bit sweeping left, bearded cutting edge */}
        <path
          d="M31 15.5 L19 16.8 C14.5 18.5, 12.5 24, 13.8 31 C 21 27.5, 26 27.2, 31 28.2 Z"
          fill={`url(#${id}-steel)`}
          stroke={OUTLINE}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <path d="M31 15.5 L19 16.8 C14.5 18.5, 12.5 24, 13.8 31 C 21 28.5, 26 28.4, 31 28.2 Z" fill="#000" fillOpacity="0.13" />
        {/* bright cutting edge along the sweep */}
        <path d="M13.8 31 C 12.6 24, 14.6 18.6, 19 16.8 L31 15.5" fill="none" stroke="#f4f8fc" strokeWidth="0.9" strokeOpacity="0.75" strokeLinecap="round" />
        {/* back lug */}
        <path d="M33 16 C36.5 16.5, 38 19, 37.5 24 C 35.5 21.5, 34.5 21, 33 21 Z" fill={`url(#${id}-steelDark)`} stroke={OUTLINE} strokeWidth="0.6" strokeLinejoin="round" />
        {/* gold collar binding head to haft */}
        <rect x="29.4" y="15.5" width="5.2" height="3.2" rx="1.1" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
      </g>
    </Tile>
  );
}

function Warhammer({ size }: { size?: number }) {
  const id = "wpn-warhammer";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        {/* haft */}
        <rect x="30.4" y="20" width="3.2" height="34" rx="1.4" fill={`url(#${id}-wood)`} stroke={OUTLINE} strokeWidth="0.6" />
        {/* hammer head block */}
        <rect x="21" y="16" width="22" height="11" rx="2.2" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.7" />
        <rect x="21" y="16" width="22" height="4.4" rx="2.2" fill="#ffffff" fillOpacity="0.22" />
        <rect x="21" y="22.6" width="22" height="4.4" rx="2.2" fill="#000" fillOpacity="0.18" />
        {/* face bevels */}
        <rect x="21" y="16" width="3.2" height="11" fill="#000" fillOpacity="0.16" />
        <rect x="39.8" y="16" width="3.2" height="11" fill="#000" fillOpacity="0.16" />
        {/* back spike */}
        <path d="M43 18 L49 21 L43 24.5 Z" fill={`url(#${id}-steelDark)`} stroke={OUTLINE} strokeWidth="0.6" strokeLinejoin="round" />
        {/* gold collar + butt */}
        <rect x="29.6" y="26" width="4.8" height="3" rx="1" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        <rect x="29.8" y="52" width="4.4" height="3.4" rx="1.2" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
      </g>
    </Tile>
  );
}

function Spear({ size }: { size?: number }) {
  const id = "wpn-spear";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        {/* haft full length */}
        <rect x="30.6" y="22" width="2.8" height="34" rx="1.3" fill={`url(#${id}-wood)`} stroke={OUTLINE} strokeWidth="0.6" />
        <line x1="31.1" y1="24" x2="31.1" y2="54" stroke="#caa06a" strokeWidth="0.5" strokeOpacity="0.4" />
        {/* leaf-shaped spearhead */}
        <path
          d="M32 7 C35.5 13, 36.5 17, 35.5 21 C34.4 23, 32 24, 32 24 C32 24, 29.6 23, 28.5 21 C27.5 17, 28.5 13, 32 7 Z"
          fill={`url(#${id}-steel)`}
          stroke={OUTLINE}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <path d="M32 7 C35.5 13, 36.5 17, 35.5 21 C34.4 23, 32 24, 32 24 Z" fill="#000" fillOpacity="0.16" />
        <line x1="32" y1="10" x2="32" y2="23" stroke="#eef4fb" strokeWidth="0.7" strokeOpacity="0.7" />
        {/* socket collar */}
        <rect x="29.4" y="23" width="5.2" height="3.2" rx="1.2" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        <rect x="30" y="54" width="4" height="3" rx="1" fill={`url(#${id}-steelDark)`} stroke={OUTLINE} strokeWidth="0.5" />
      </g>
    </Tile>
  );
}

function Shortbow({ size }: { size?: number }) {
  const id = "wpn-shortbow";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-18 32 32)">
        {/* bow stave — a C curve */}
        <path d="M38 8 C26 18, 26 46, 38 56" fill="none" stroke={`url(#${id}-wood)`} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M38 8 C26 18, 26 46, 38 56" fill="none" stroke="#d8b079" strokeWidth="0.9" strokeLinecap="round" strokeOpacity="0.45" />
        {/* nock caps */}
        <circle cx="38" cy="8" r="2" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        <circle cx="38" cy="56" r="2" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        {/* grip wrap */}
        <rect x="26.5" y="29" width="4" height="6" rx="1.4" fill={`url(#${id}-leather)`} stroke="#140c05" strokeWidth="0.5" />
        {/* string */}
        <line x1="38" y1="8" x2="38" y2="56" stroke="#e8edf3" strokeWidth="0.8" strokeOpacity="0.85" />
        {/* nocked arrow */}
        <line x1="20" y1="32" x2="44" y2="32" stroke={`url(#${id}-wood)`} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M20 32 L24 30.4 L24 33.6 Z" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.5" />
        <path d="M44 30 L48 32 L44 34 M45.5 30.6 L49 32 L45.5 33.4" fill="none" stroke="#d9534f" strokeWidth="1" strokeLinecap="round" />
      </g>
    </Tile>
  );
}

function Shortsword({ size }: { size?: number }) {
  const id = "wpn-shortsword";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-42 32 32)">
        <StraightBlade id={id} tip={10} base={37} hw={2.9} />
        <rect x="23.5" y="36.5" width="17" height="3.5" rx="1.7" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.6" />
        <Grip id={id} top={39.5} bottom={49} w={3.8} />
        <Pommel id={id} y={50.5} r={2.3} />
      </g>
    </Tile>
  );
}

function Scimitar({ size }: { size?: number }) {
  const id = "wpn-scimitar";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-38 32 32)">
        {/* curved single-edged blade sweeping up-left */}
        <path
          d="M31 38 C 24 34, 16 26, 19 11 C 26 17, 30 27, 33.5 37 Z"
          fill={`url(#${id}-steel)`}
          stroke={OUTLINE}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <path d="M31 38 C 26 33, 22 26, 23 17 C 27 24, 30 31, 33.5 37 Z" fill="#000" fillOpacity="0.15" />
        {/* bright outer cutting edge */}
        <path d="M19 11 C 16 26, 24 34, 31 38" fill="none" stroke="#f4f8fc" strokeWidth="0.9" strokeOpacity="0.8" strokeLinecap="round" />
        {/* curved gold guard */}
        <path d="M27 37 Q32 41 39 38 L38 41 Q32 44 27.5 40.5 Z" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.6" strokeLinejoin="round" />
        <Grip id={id} top={40.5} bottom={49} w={3.6} />
        <Pommel id={id} y={50.5} r={2.2} />
      </g>
    </Tile>
  );
}

function Rapier({ size }: { size?: number }) {
  const id = "wpn-rapier";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-42 32 32)">
        <StraightBlade id={id} tip={5} base={41} hw={1.5} />
        {/* classic swept hilt: crossguard + side ring + knuckle bow to the pommel */}
        <rect x="26" y="40.2" width="12" height="2.6" rx="1.3" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        <circle cx="27.5" cy="45" r="3" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.6" />
        <path d="M37 42 C 43 45, 42 52, 33 53.5" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.7" strokeLinecap="round" />
        <Grip id={id} top={42.5} bottom={52} w={3.4} />
        <Pommel id={id} y={53.5} r={2.3} />
      </g>
    </Tile>
  );
}

function Handaxe({ size }: { size?: number }) {
  const id = "wpn-handaxe";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        <Haft id={id} top={21} bottom={52} w={3} />
        <path d="M31 22 L22 23 C18 24.5, 16.5 29, 17.6 34.5 C 23 31.5, 27 31.4, 31 32 Z" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M31 22 L22 23 C18 24.5, 16.5 29, 17.6 34.5 C 23 32, 27 32, 31 32 Z" fill="#000" fillOpacity="0.13" />
        <path d="M17.6 34.5 C 16.5 29, 18 24.6, 22 23 L31 22" fill="none" stroke="#f4f8fc" strokeWidth="0.8" strokeOpacity="0.75" strokeLinecap="round" />
        <rect x="29.6" y="21.5" width="4.8" height="3" rx="1" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
      </g>
    </Tile>
  );
}

function Greataxe({ size }: { size?: number }) {
  const id = "wpn-greataxe";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        <Haft id={id} top={13} bottom={56} w={3.4} />
        {/* double-bit head */}
        <path d="M31 15 L20 16 C13.5 18, 10.5 24, 12 31 C 20 27, 26 27, 31 28 Z" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M33 15 L44 16 C50.5 18, 53.5 24, 52 31 C 44 27, 38 27, 33 28 Z" fill={`url(#${id}-steelDark)`} stroke={OUTLINE} strokeWidth="0.7" strokeLinejoin="round" />
        <path d="M12 31 C 10.5 24, 13.5 18.2, 20 16 L31 15" fill="none" stroke="#f4f8fc" strokeWidth="0.9" strokeOpacity="0.8" strokeLinecap="round" />
        <rect x="29.2" y="14.5" width="5.6" height="3.4" rx="1.2" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
      </g>
    </Tile>
  );
}

function Maul({ size }: { size?: number }) {
  const id = "wpn-maul";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        <Haft id={id} top={24} bottom={56} w={3.4} />
        {/* large two-faced head */}
        <rect x="18" y="13" width="28" height="13" rx="2.4" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.7" />
        <rect x="18" y="13" width="28" height="5" rx="2.4" fill="#ffffff" fillOpacity="0.2" />
        <rect x="18" y="21.5" width="28" height="4.5" rx="2.4" fill="#000" fillOpacity="0.18" />
        <rect x="18" y="13" width="3.6" height="13" fill="#000" fillOpacity="0.16" />
        <rect x="42.4" y="13" width="3.6" height="13" fill="#000" fillOpacity="0.16" />
        <rect x="29" y="24.5" width="6" height="3" rx="1.1" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
      </g>
    </Tile>
  );
}

function Mace({ size }: { size?: number }) {
  const id = "wpn-mace";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        <Haft id={id} top={22} bottom={55} w={3} />
        {/* flanged head — six bladed flanges around a steel core */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const a = ((deg - 90) * Math.PI) / 180;
          const tipX = 32 + Math.cos(a) * 10, tipY = 17 + Math.sin(a) * 10;
          const lX = 32 + Math.cos(a - 0.42) * 5, lY = 17 + Math.sin(a - 0.42) * 5;
          const rX = 32 + Math.cos(a + 0.42) * 5, rY = 17 + Math.sin(a + 0.42) * 5;
          return <path key={i} d={`M${tipX} ${tipY} L${lX} ${lY} L${rX} ${rY} Z`} fill={`url(#${id}-steelDark)`} stroke={OUTLINE} strokeWidth="0.5" strokeLinejoin="round" />;
        })}
        <circle cx="32" cy="17" r="5.6" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.7" />
        <circle cx="29.9" cy="14.9" r="1.8" fill="#ffffff" fillOpacity="0.45" />
        <rect x="29.4" y="22" width="5.2" height="3" rx="1" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
      </g>
    </Tile>
  );
}

function Club({ size }: { size?: number }) {
  const id = "wpn-club";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        {/* gnarled tapered wooden club */}
        <path
          d="M32 11 C 38 13, 39 22, 36 29 C 35 40, 34.5 50, 34 54 L 30 54 C 29.5 50, 29 40, 28 29 C 25 22, 26 13, 32 11 Z"
          fill={`url(#${id}-wood)`}
          stroke={OUTLINE}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <path d="M32 11 C 38 13, 39 22, 36 29 C 35 40, 34.5 50, 34 54 L 32 54 Z" fill="#000" fillOpacity="0.14" />
        <line x1="31" y1="16" x2="31.5" y2="52" stroke="#caa06a" strokeWidth="0.6" strokeOpacity="0.4" />
        {/* knots */}
        <circle cx="33" cy="20" r="1.3" fill="#3c260f" fillOpacity="0.7" />
        <circle cx="30" cy="34" r="1.1" fill="#3c260f" fillOpacity="0.6" />
        {/* grip wrap near base */}
        {[46, 48.5, 51].map((y, i) => <line key={i} x1="29" y1={y} x2="35" y2={y + 0.7} stroke="#1a1108" strokeWidth="0.8" strokeLinecap="round" />)}
      </g>
    </Tile>
  );
}

function Quarterstaff({ size }: { size?: number }) {
  const id = "wpn-quarterstaff";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        <rect x="30.4" y="8" width="3.2" height="48" rx="1.6" fill={`url(#${id}-wood)`} stroke={OUTLINE} strokeWidth="0.6" />
        <line x1="31" y1="10" x2="31" y2="54" stroke="#caa06a" strokeWidth="0.5" strokeOpacity="0.4" />
        {/* metal end caps */}
        <rect x="29.4" y="7" width="5.2" height="4.4" rx="1.4" fill={`url(#${id}-steelDark)`} stroke={OUTLINE} strokeWidth="0.6" />
        <rect x="29.4" y="52.6" width="5.2" height="4.4" rx="1.4" fill={`url(#${id}-steelDark)`} stroke={OUTLINE} strokeWidth="0.6" />
        {/* center grip wrap */}
        <rect x="29.6" y="28" width="4.8" height="8" rx="1.4" fill={`url(#${id}-leather)`} stroke="#140c05" strokeWidth="0.5" />
        {[30, 33].map((y, i) => <line key={i} x1="29.6" y1={y} x2="34.4" y2={y + 0.7} stroke="#1a1108" strokeWidth="0.7" />)}
      </g>
    </Tile>
  );
}

function Javelin({ size }: { size?: number }) {
  const id = "wpn-javelin";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        <rect x="30.8" y="20" width="2.4" height="36" rx="1.1" fill={`url(#${id}-wood)`} stroke={OUTLINE} strokeWidth="0.6" />
        {/* slim spearhead */}
        <path d="M32 8 C34 13, 34.4 17, 33.6 20.5 C33 22, 32 22.5, 32 22.5 C32 22.5, 31 22, 30.4 20.5 C29.6 17, 30 13, 32 8 Z" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.7" strokeLinejoin="round" />
        <line x1="32" y1="11" x2="32" y2="21.5" stroke="#eef4fb" strokeWidth="0.6" strokeOpacity="0.7" />
        <rect x="29.8" y="21" width="4.4" height="2.6" rx="1" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        {/* leather cord wrap */}
        {[40, 42.5].map((y, i) => <line key={i} x1="30" y1={y} x2="34" y2={y + 0.7} stroke="#1a1108" strokeWidth="0.8" />)}
      </g>
    </Tile>
  );
}

function Sickle({ size }: { size?: number }) {
  const id = "wpn-sickle";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-12 32 32)">
        {/* short wooden handle */}
        <Grip id={id} top={36} bottom={52} w={4} />
        <rect x="28.5" y="33.5" width="7" height="3.4" rx="1.2" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        {/* hooked crescent blade */}
        <path
          d="M30 34 C 30 24, 25 16, 14 15 C 19 18, 23 24, 25.5 32 C 24 26, 21 21, 16 19 C 22 22, 27 28, 30 34 Z"
          fill={`url(#${id}-steel)`}
          stroke={OUTLINE}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <path d="M14 15 C 25 16, 30 24, 30 34" fill="none" stroke="#f4f8fc" strokeWidth="0.9" strokeOpacity="0.75" strokeLinecap="round" />
      </g>
    </Tile>
  );
}

function Longbow({ size }: { size?: number }) {
  const id = "wpn-longbow";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-14 32 32)">
        <path d="M36 6 C 28 18, 28 46, 36 58" fill="none" stroke={`url(#${id}-wood)`} strokeWidth="3" strokeLinecap="round" />
        <path d="M36 6 C 28 18, 28 46, 36 58" fill="none" stroke="#d8b079" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.45" />
        <circle cx="36" cy="6" r="1.9" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        <circle cx="36" cy="58" r="1.9" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
        <rect x="27.5" y="29" width="4" height="6" rx="1.4" fill={`url(#${id}-leather)`} stroke="#140c05" strokeWidth="0.5" />
        <line x1="36" y1="6" x2="36" y2="58" stroke="#e8edf3" strokeWidth="0.8" strokeOpacity="0.85" />
      </g>
    </Tile>
  );
}

function LightCrossbow({ size }: { size?: number }) {
  const id = "wpn-lightcrossbow";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-10 32 32)">
        {/* prod (bow arms) */}
        <path d="M11 26 Q32 16 53 26" fill="none" stroke={`url(#${id}-steelDark)`} strokeWidth="3.2" strokeLinecap="round" />
        {/* string drawn back to the nut */}
        <path d="M12 25.5 L32 31 L52 25.5" fill="none" stroke="#e8edf3" strokeWidth="0.9" strokeOpacity="0.85" />
        {/* stock */}
        <rect x="29.8" y="20" width="4.4" height="34" rx="1.6" fill={`url(#${id}-wood)`} stroke={OUTLINE} strokeWidth="0.6" />
        <line x1="30.4" y1="22" x2="30.4" y2="52" stroke="#caa06a" strokeWidth="0.5" strokeOpacity="0.4" />
        {/* loaded bolt */}
        <rect x="31.2" y="12" width="1.6" height="18" fill={`url(#${id}-wood)`} />
        <path d="M32 9 L33.6 14 L30.4 14 Z" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.5" strokeLinejoin="round" />
        {/* trigger lug + butt */}
        <rect x="33.5" y="40" width="3" height="4" rx="1" fill={`url(#${id}-steelDark)`} stroke={OUTLINE} strokeWidth="0.5" />
        <rect x="29.4" y="52" width="5.2" height="3.2" rx="1.2" fill={`url(#${id}-gold)`} stroke="#5a3d12" strokeWidth="0.5" />
      </g>
    </Tile>
  );
}

function HandCrossbow({ size }: { size?: number }) {
  const id = "wpn-handcrossbow";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-10 32 32)">
        <path d="M17 28 Q32 21 47 28" fill="none" stroke={`url(#${id}-steelDark)`} strokeWidth="2.8" strokeLinecap="round" />
        <path d="M18 27.5 L32 31.5 L46 27.5" fill="none" stroke="#e8edf3" strokeWidth="0.8" strokeOpacity="0.85" />
        {/* short stock */}
        <rect x="29.8" y="22" width="4.4" height="20" rx="1.6" fill={`url(#${id}-wood)`} stroke={OUTLINE} strokeWidth="0.6" />
        {/* angled pistol grip */}
        <g transform="rotate(22 32 40)">
          <rect x="30" y="40" width="4" height="10" rx="1.6" fill={`url(#${id}-leather)`} stroke="#140c05" strokeWidth="0.5" />
        </g>
        {/* bolt */}
        <rect x="31.2" y="15" width="1.6" height="14" fill={`url(#${id}-wood)`} />
        <path d="M32 12 L33.4 16.5 L30.6 16.5 Z" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.5" strokeLinejoin="round" />
      </g>
    </Tile>
  );
}

function Sling({ size }: { size?: number }) {
  const id = "wpn-sling";
  return (
    <Tile id={id} size={size}>
      <g>
        {/* two leather cords rising to loop ends */}
        <path d="M28 36 C 22 28, 19 18, 22 11" fill="none" stroke={`url(#${id}-leather)`} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M36 36 C 42 28, 45 18, 42 11" fill="none" stroke={`url(#${id}-leather)`} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="22" cy="11" r="2.4" fill="none" stroke={`url(#${id}-leather)`} strokeWidth="1.6" />
        <circle cx="42" cy="11" r="2.4" fill="none" stroke={`url(#${id}-leather)`} strokeWidth="1.6" />
        {/* pouch cradling a stone */}
        <path d="M26 35 Q32 46 38 35 Q32 41 26 35 Z" fill={`url(#${id}-leather)`} stroke="#140c05" strokeWidth="0.6" />
        <circle cx="32" cy="36" r="5" fill="#9aa6b6" stroke="#3a4452" strokeWidth="0.7" />
        <circle cx="30" cy="34" r="1.6" fill="#e2e8f0" fillOpacity="0.6" />
      </g>
    </Tile>
  );
}

function Dart({ size }: { size?: number }) {
  const id = "wpn-dart";
  return (
    <Tile id={id} size={size}>
      <g transform="rotate(-40 32 32)">
        {/* shaft */}
        <rect x="31" y="22" width="2" height="22" rx="1" fill={`url(#${id}-wood)`} stroke={OUTLINE} strokeWidth="0.5" />
        {/* steel point */}
        <path d="M32 10 L35 23 L29 23 Z" fill={`url(#${id}-steel)`} stroke={OUTLINE} strokeWidth="0.6" strokeLinejoin="round" />
        <line x1="32" y1="13" x2="32" y2="22" stroke="#eef4fb" strokeWidth="0.6" strokeOpacity="0.7" />
        {/* fletching */}
        <path d="M32 41 C 28 44, 27 49, 28 53 C 30 50, 31.4 47, 32 44 Z" fill="#d9534f" stroke="#7f1d1d" strokeWidth="0.4" strokeLinejoin="round" />
        <path d="M32 41 C 36 44, 37 49, 36 53 C 34 50, 32.6 47, 32 44 Z" fill="#c0392b" stroke="#7f1d1d" strokeWidth="0.4" strokeLinejoin="round" />
      </g>
    </Tile>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
const RENDERERS: Record<string, (p: { size?: number }) => React.ReactElement> = {
  Dagger, Shortsword, Longsword, Rapier, Scimitar, Greatsword,
  Handaxe, Battleaxe, Greataxe, Warhammer, Maul, Mace, Club, Quarterstaff,
  Spear, Javelin, Sickle,
  Shortbow, Longbow, "Light Crossbow": LightCrossbow, "Hand Crossbow": HandCrossbow, Sling, Dart,
};

export function hasWeaponIcon(name: string): boolean {
  return name in RENDERERS;
}

export function WeaponIcon({ name, size = 48, style, className }: { name: string } & WeaponIconProps) {
  const R = RENDERERS[name];
  if (!R) return null;
  return <span className={className} style={{ display: "inline-block", lineHeight: 0, ...style }}>{R({ size })}</span>;
}
