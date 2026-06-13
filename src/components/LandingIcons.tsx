// Hand-crafted SVG icon set for the marketing page. Each icon is built from
// layered gradient shapes with gold accents to feel like original game art
// rather than emoji or generic stock icons. All share a 64×64 viewBox.

import React from "react";

type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

const VIOLET_DARK   = "#3b1d8a";
const VIOLET_MID    = "#6d28d9";
const VIOLET_BRIGHT = "#a78bfa";
const GOLD          = "#d4a96a";
const GOLD_BRIGHT   = "#fde68a";
const STEEL         = "#94a3b8";
const STEEL_LIGHT   = "#e2e8f0";
const EMBER         = "#f97316";

function Frame({ size = 64, children, gradId, glow = true, accent = VIOLET_BRIGHT }: { size?: number; children: React.ReactNode; gradId: string; glow?: boolean; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <defs>
        <radialGradient id={`${gradId}bg`} cx="0.5" cy="0.42" r="0.55">
          <stop offset="0%"  stopColor={accent} stopOpacity="0.30"/>
          <stop offset="65%" stopColor={accent} stopOpacity="0.05"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </radialGradient>
        {glow && (
          <filter id={`${gradId}glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="0.9" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        )}
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${gradId}bg)`}/>
      <g filter={glow ? `url(#${gradId}glow)` : undefined}>{children}</g>
    </svg>
  );
}

// ── 1. Dungeon Master — hooded silhouette with a glowing d20 eye ──────────────
export function DungeonMasterIcon({ size, className, style }: IconProps) {
  return (
    <span className={className} style={style}>
      <Frame size={size} gradId="dm" accent={VIOLET_BRIGHT}>
        <defs>
          <linearGradient id="dmHood" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor={VIOLET_DARK}/>
            <stop offset="55%"  stopColor={VIOLET_MID}/>
            <stop offset="100%" stopColor="#1e1140"/>
          </linearGradient>
          <radialGradient id="dmEye" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"   stopColor={GOLD_BRIGHT}/>
            <stop offset="60%"  stopColor={GOLD}/>
            <stop offset="100%" stopColor="#92400e"/>
          </radialGradient>
        </defs>
        {/* Outer cloak silhouette */}
        <path
          d="M32 6 C 18 6, 11 18, 11 32 C 11 44, 16 56, 16 56 L 48 56 C 48 56, 53 44, 53 32 C 53 18, 46 6, 32 6 Z"
          fill="url(#dmHood)"
          stroke="#0a0518"
          strokeWidth="0.8"
        />
        {/* Inner hood shadow (creates depth at the face opening) */}
        <path
          d="M32 14 C 24 14, 20 22, 20 30 C 20 38, 24 44, 32 44 C 40 44, 44 38, 44 30 C 44 22, 40 14, 32 14 Z"
          fill="#0a0518"
          opacity="0.92"
        />
        {/* Glowing d20 "eye" — a small icosahedron silhouette */}
        <g transform="translate(32 31)">
          <polygon points="0,-7 6,-3 5,5 -5,5 -6,-3" fill="url(#dmEye)" stroke={GOLD_BRIGHT} strokeWidth="0.6" strokeLinejoin="round"/>
          <polygon points="0,-7 0,-2 6,-3" fill={GOLD_BRIGHT} opacity="0.55"/>
          <polygon points="0,-2 -6,-3 -5,5" fill="#7c2d12" opacity="0.45"/>
          <polygon points="0,-2 6,-3 5,5" fill="#92400e" opacity="0.55"/>
        </g>
        {/* Hood highlight — top arc */}
        <path
          d="M19 18 C 24 11, 40 11, 45 18"
          fill="none"
          stroke={VIOLET_BRIGHT}
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.55"
        />
        {/* Bottom hem shadow */}
        <path d="M16 56 L 48 56 L 50 60 L 14 60 Z" fill="#0a0518" opacity="0.55"/>
      </Frame>
    </span>
  );
}

// ── 2. Combat — crossed longswords over an ember ──────────────────────────────
export function CombatIcon({ size, className, style }: IconProps) {
  return (
    <span className={className} style={style}>
      <Frame size={size} gradId="combat" accent={EMBER}>
        <defs>
          <linearGradient id="bladeA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor={STEEL_LIGHT}/>
            <stop offset="55%"  stopColor={STEEL}/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
          <linearGradient id="bladeB" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={STEEL_LIGHT}/>
            <stop offset="55%"  stopColor={STEEL}/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
          <radialGradient id="emberG" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"   stopColor="#fde047"/>
            <stop offset="55%"  stopColor={EMBER}/>
            <stop offset="100%" stopColor="#7c2d12" stopOpacity="0"/>
          </radialGradient>
        </defs>
        {/* Ember glow behind the crossed swords */}
        <circle cx="32" cy="32" r="13" fill="url(#emberG)"/>
        {/* Sword A: top-left to bottom-right */}
        <g transform="translate(32 32) rotate(45) translate(-32 -32)">
          <rect x="30" y="6"  width="4" height="40" fill="url(#bladeA)" stroke="#0f172a" strokeWidth="0.6"/>
          <polygon points="32,4 30,8 34,8" fill={STEEL_LIGHT} stroke="#0f172a" strokeWidth="0.5"/>
          <rect x="26" y="46" width="12" height="3" fill={GOLD} stroke="#7c2d12" strokeWidth="0.5"/>
          <rect x="30" y="49" width="4" height="9" fill="#5b3520" stroke="#0f172a" strokeWidth="0.5"/>
          <circle cx="32" cy="60" r="2" fill={GOLD_BRIGHT} stroke="#7c2d12" strokeWidth="0.5"/>
          <line x1="32" y1="8" x2="32" y2="44" stroke={STEEL_LIGHT} strokeWidth="0.6" opacity="0.85"/>
        </g>
        {/* Sword B: top-right to bottom-left */}
        <g transform="translate(32 32) rotate(-45) translate(-32 -32)">
          <rect x="30" y="6"  width="4" height="40" fill="url(#bladeB)" stroke="#0f172a" strokeWidth="0.6"/>
          <polygon points="32,4 30,8 34,8" fill={STEEL_LIGHT} stroke="#0f172a" strokeWidth="0.5"/>
          <rect x="26" y="46" width="12" height="3" fill={GOLD} stroke="#7c2d12" strokeWidth="0.5"/>
          <rect x="30" y="49" width="4" height="9" fill="#5b3520" stroke="#0f172a" strokeWidth="0.5"/>
          <circle cx="32" cy="60" r="2" fill={GOLD_BRIGHT} stroke="#7c2d12" strokeWidth="0.5"/>
          <line x1="32" y1="8" x2="32" y2="44" stroke={STEEL_LIGHT} strokeWidth="0.6" opacity="0.85"/>
        </g>
        {/* Tiny spark dots */}
        <circle cx="32" cy="32" r="1.6" fill={GOLD_BRIGHT}/>
      </Frame>
    </span>
  );
}

// ── 3. Multiplayer — round feast table seen from above, six plates ────────────
// Leans into the "Dungeons & Dinner Legends" name: every player at the table
// literally gets a seat.
export function MultiplayerIcon({ size, className, style }: IconProps) {
  return (
    <span className={className} style={style}>
      <Frame size={size} gradId="mp" accent={GOLD}>
        <defs>
          <radialGradient id="mpTable" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"   stopColor="#a16207"/>
            <stop offset="65%"  stopColor="#7c5a1f"/>
            <stop offset="100%" stopColor="#3f2a0c"/>
          </radialGradient>
          <radialGradient id="mpCenterpiece" cx="0.5" cy="0.4" r="0.5">
            <stop offset="0%"   stopColor="#fde047"/>
            <stop offset="55%"  stopColor={EMBER}/>
            <stop offset="100%" stopColor="#7c2d12" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="mpPlate" cx="0.45" cy="0.4" r="0.55">
            <stop offset="0%"   stopColor="#fff"/>
            <stop offset="55%"  stopColor="#fef3c7"/>
            <stop offset="100%" stopColor="#92400e"/>
          </radialGradient>
        </defs>
        {/* Round wooden table — top-down view */}
        <circle cx="32" cy="32" r="24" fill="url(#mpTable)" stroke="#0a0518" strokeWidth="0.8"/>
        {/* Wood grain ring */}
        <circle cx="32" cy="32" r="20" fill="none" stroke="#5b3520" strokeOpacity="0.6" strokeWidth="0.5"/>
        <circle cx="32" cy="32" r="15" fill="none" stroke="#5b3520" strokeOpacity="0.5" strokeWidth="0.4"/>
        {/* Central platter with steaming roast — the campfire/centerpiece */}
        <circle cx="32" cy="32" r="8" fill="url(#mpCenterpiece)" opacity="0.7"/>
        <circle cx="32" cy="32" r="5" fill="#92400e" stroke={GOLD} strokeWidth="0.5"/>
        <ellipse cx="32" cy="32" rx="3.5" ry="2.2" fill="#7c2d12"/>
        {/* Steam wisps rising from centerpiece */}
        <path d="M 30 26 C 29 23, 31 22, 30 19" stroke="#fef3c7" strokeWidth="0.6" strokeOpacity="0.55" fill="none" strokeLinecap="round"/>
        <path d="M 34 26 C 35 23, 33 22, 34 19" stroke="#fef3c7" strokeWidth="0.6" strokeOpacity="0.55" fill="none" strokeLinecap="round"/>
        {/* Six place settings around the table */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const r = 17;
          const x = 32 + Math.cos((deg - 90) * Math.PI / 180) * r;
          const y = 32 + Math.sin((deg - 90) * Math.PI / 180) * r;
          return (
            <g key={i}>
              {/* Plate */}
              <circle cx={x} cy={y} r="3.4" fill="url(#mpPlate)" stroke="#5b3520" strokeWidth="0.5"/>
              <circle cx={x} cy={y} r="2.1" fill="none" stroke="#7c5a1f" strokeWidth="0.35" opacity="0.7"/>
              {/* Tiny garnish on plate */}
              <circle cx={x - 0.5} cy={y - 0.5} r="0.5" fill={EMBER} opacity="0.7"/>
            </g>
          );
        })}
      </Frame>
    </span>
  );
}

// ── 4. Voice — concentric sound waves around a glowing rune ───────────────────
export function VoiceIcon({ size, className, style }: IconProps) {
  return (
    <span className={className} style={style}>
      <Frame size={size} gradId="voice" accent={GOLD}>
        <defs>
          <radialGradient id="voiceCore" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"   stopColor="#fff"/>
            <stop offset="40%"  stopColor={GOLD_BRIGHT}/>
            <stop offset="100%" stopColor={GOLD}/>
          </radialGradient>
        </defs>
        {/* Sound waves emanating left and right */}
        {[8, 14, 20].map((r, i) => (
          <g key={i}>
            <path
              d={`M ${24 - r * 0.7} ${32 - r * 0.5} Q ${24 - r * 0.85} 32 ${24 - r * 0.7} ${32 + r * 0.5}`}
              stroke={GOLD}
              strokeOpacity={0.85 - i * 0.18}
              strokeWidth={1.4 - i * 0.25}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${40 + r * 0.7} ${32 - r * 0.5} Q ${40 + r * 0.85} 32 ${40 + r * 0.7} ${32 + r * 0.5}`}
              stroke={GOLD}
              strokeOpacity={0.85 - i * 0.18}
              strokeWidth={1.4 - i * 0.25}
              fill="none"
              strokeLinecap="round"
            />
          </g>
        ))}
        {/* Central rune — a glowing diamond inside a circle */}
        <circle cx="32" cy="32" r="10" fill={VIOLET_DARK} stroke={GOLD} strokeWidth="1"/>
        <circle cx="32" cy="32" r="7" fill="url(#voiceCore)"/>
        <polygon points="32,26 36,32 32,38 28,32" fill={VIOLET_DARK} stroke={GOLD} strokeWidth="0.6"/>
        <circle cx="32" cy="32" r="1.6" fill={GOLD_BRIGHT}/>
      </Frame>
    </span>
  );
}

// ── 5. AI Painted Portraits — gilded frame with portrait silhouette ───────────
export function PortraitIcon({ size, className, style }: IconProps) {
  return (
    <span className={className} style={style}>
      <Frame size={size} gradId="port" accent={VIOLET_BRIGHT}>
        <defs>
          <linearGradient id="frameGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={GOLD_BRIGHT}/>
            <stop offset="50%"  stopColor={GOLD}/>
            <stop offset="100%" stopColor="#7c5a1f"/>
          </linearGradient>
          <linearGradient id="portBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={VIOLET_MID}/>
            <stop offset="100%" stopColor={VIOLET_DARK}/>
          </linearGradient>
        </defs>
        {/* Outer ornate frame */}
        <rect x="10" y="10" width="44" height="48" rx="2" fill="url(#frameGold)" stroke="#5a3d0e" strokeWidth="0.8"/>
        {/* Inner canvas */}
        <rect x="14" y="14" width="36" height="40" fill="url(#portBg)"/>
        {/* Portrait silhouette — head + shoulders */}
        <circle cx="32" cy="28" r="7" fill="#1e1140" stroke={VIOLET_BRIGHT} strokeWidth="0.6"/>
        <path d="M 18 54 C 18 44, 25 38, 32 38 C 39 38, 46 44, 46 54 Z" fill="#1e1140" stroke={VIOLET_BRIGHT} strokeWidth="0.6"/>
        {/* Highlight on the canvas — soft top-down light */}
        <rect x="14" y="14" width="36" height="14" fill="white" opacity="0.07"/>
        {/* Frame corner ornaments */}
        {[{x:10,y:10},{x:50,y:10},{x:10,y:54},{x:50,y:54}].map((p, i) => (
          <circle key={i} cx={p.x + (i % 2 ? -2 : 2)} cy={p.y + (i < 2 ? 2 : -2)} r="1.5" fill={GOLD_BRIGHT} stroke="#5a3d0e" strokeWidth="0.4"/>
        ))}
        {/* Small brush in the corner */}
        <g transform="translate(46 50) rotate(-35)">
          <rect x="-1" y="-9" width="2" height="9" fill="#5a3d0e"/>
          <rect x="-1.5" y="-12" width="3" height="3" fill={GOLD}/>
          <path d="M -2 -16 L 2 -16 L 1.5 -12 L -1.5 -12 Z" fill="#e2e8f0" stroke="#475569" strokeWidth="0.4"/>
        </g>
      </Frame>
    </span>
  );
}

// ── 6. PC & Xbox — modern controller silhouette ───────────────────────────────
export function ControllerIcon({ size, className, style }: IconProps) {
  return (
    <span className={className} style={style}>
      <Frame size={size} gradId="ctrl" accent={VIOLET_BRIGHT}>
        <defs>
          <linearGradient id="ctrlBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2d3748"/>
            <stop offset="55%"  stopColor="#1a202c"/>
            <stop offset="100%" stopColor="#0f172a"/>
          </linearGradient>
        </defs>
        {/* Controller body — wide bean shape */}
        <path
          d="M 12 28 C 12 22, 16 18, 22 18 L 42 18 C 48 18, 52 22, 52 28 C 52 36, 50 46, 44 46 C 41 46, 39 44, 37 42 C 36 41, 35 40, 32 40 C 29 40, 28 41, 27 42 C 25 44, 23 46, 20 46 C 14 46, 12 36, 12 28 Z"
          fill="url(#ctrlBody)"
          stroke="#0a0518"
          strokeWidth="0.8"
        />
        {/* Top highlight rim */}
        <path
          d="M 14 25 C 14 21, 17 19, 22 19 L 42 19 C 47 19, 50 21, 50 25"
          fill="none"
          stroke="#475569"
          strokeWidth="0.6"
          opacity="0.85"
        />
        {/* Left thumbstick */}
        <circle cx="22" cy="30" r="4" fill="#0f172a" stroke="#475569" strokeWidth="0.7"/>
        <circle cx="22" cy="30" r="2.4" fill="#1a202c" stroke="#64748b" strokeWidth="0.5"/>
        {/* D-pad */}
        <g transform="translate(22 38)">
          <rect x="-3" y="-1" width="6" height="2" fill="#0f172a" stroke="#475569" strokeWidth="0.4"/>
          <rect x="-1" y="-3" width="2" height="6" fill="#0f172a" stroke="#475569" strokeWidth="0.4"/>
        </g>
        {/* Right thumbstick */}
        <circle cx="42" cy="36" r="4" fill="#0f172a" stroke="#475569" strokeWidth="0.7"/>
        <circle cx="42" cy="36" r="2.4" fill="#1a202c" stroke="#64748b" strokeWidth="0.5"/>
        {/* ABXY buttons — gold + violet glow */}
        <g transform="translate(42 28)">
          <circle cx="0"  cy="-3" r="1.7" fill={GOLD_BRIGHT}    stroke="#5a3d0e" strokeWidth="0.3"/> {/* Y top */}
          <circle cx="3"  cy="0"  r="1.7" fill="#ef4444"        stroke="#7f1d1d" strokeWidth="0.3"/> {/* B right */}
          <circle cx="0"  cy="3"  r="1.7" fill="#22c55e"        stroke="#14532d" strokeWidth="0.3"/> {/* A bottom */}
          <circle cx="-3" cy="0"  r="1.7" fill={VIOLET_BRIGHT}  stroke="#3b1d8a" strokeWidth="0.3"/> {/* X left */}
        </g>
        {/* Center logo nub */}
        <circle cx="32" cy="26" r="2" fill={VIOLET_BRIGHT} stroke="#0a0518" strokeWidth="0.5"/>
        <circle cx="32" cy="26" r="0.8" fill={GOLD_BRIGHT}/>
      </Frame>
    </span>
  );
}

// ── 7. Forge — anvil with hammer and embers ───────────────────────────────────
export function ForgeIcon({ size, className, style }: IconProps) {
  return (
    <span className={className} style={style}>
      <Frame size={size} gradId="forge" accent={EMBER}>
        <defs>
          <linearGradient id="anvilG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#94a3b8"/>
            <stop offset="55%"  stopColor="#475569"/>
            <stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
        </defs>
        {/* Ember glow under the anvil */}
        <ellipse cx="32" cy="54" rx="22" ry="4" fill={EMBER} opacity="0.4"/>
        <ellipse cx="32" cy="54" rx="14" ry="2.5" fill="#fde047" opacity="0.5"/>
        {/* Anvil silhouette */}
        <path
          d="M 12 34 L 52 34 L 48 40 L 46 40 L 46 48 L 18 48 L 18 40 L 16 40 Z"
          fill="url(#anvilG)"
          stroke="#0a0518"
          strokeWidth="0.8"
        />
        {/* Anvil horn */}
        <path d="M 8 34 L 16 34 L 16 38 L 12 38 Z" fill="url(#anvilG)" stroke="#0a0518" strokeWidth="0.8"/>
        {/* Top highlight on anvil */}
        <rect x="14" y="34" width="34" height="1.5" fill="#cbd5e1" opacity="0.55"/>
        {/* Hammer mid-strike, angled */}
        <g transform="translate(32 30) rotate(-25)">
          <rect x="-1.5" y="-20" width="3" height="18" fill="#5b3520" stroke="#0a0518" strokeWidth="0.5"/>
          <rect x="-6" y="-26" width="12" height="7" rx="1" fill="url(#anvilG)" stroke="#0a0518" strokeWidth="0.6"/>
          <rect x="-5" y="-25" width="10" height="1.5" fill="#e2e8f0" opacity="0.5"/>
        </g>
        {/* Floating embers */}
        {[{x:18,y:24,r:1.2},{x:46,y:20,r:1},{x:24,y:14,r:0.8},{x:42,y:30,r:1.4}].map((e, i) => (
          <circle key={i} cx={e.x} cy={e.y} r={e.r} fill={GOLD_BRIGHT} opacity="0.9"/>
        ))}
      </Frame>
    </span>
  );
}

// ── 8. Campaign Map — unrolled scroll with route line and X marks ─────────────
export function MapIcon({ size, className, style }: IconProps) {
  return (
    <span className={className} style={style}>
      <Frame size={size} gradId="map" accent={GOLD}>
        <defs>
          <linearGradient id="parchment" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#fef3c7"/>
            <stop offset="55%"  stopColor="#e9c890"/>
            <stop offset="100%" stopColor="#a16207"/>
          </linearGradient>
        </defs>
        {/* Left scroll roll */}
        <rect x="8" y="14" width="6" height="36" rx="3" fill="#7c5a1f" stroke="#0a0518" strokeWidth="0.7"/>
        <rect x="9" y="14" width="4" height="36" fill="#a16207"/>
        {/* Right scroll roll */}
        <rect x="50" y="14" width="6" height="36" rx="3" fill="#7c5a1f" stroke="#0a0518" strokeWidth="0.7"/>
        <rect x="51" y="14" width="4" height="36" fill="#a16207"/>
        {/* Parchment */}
        <rect x="14" y="18" width="36" height="28" fill="url(#parchment)" stroke="#92400e" strokeWidth="0.6"/>
        {/* Mountain symbols (two triangles) */}
        <polygon points="20,38 25,28 30,38" fill="#5b3520" opacity="0.7"/>
        <polygon points="22,38 25,32 28,38" fill="#92400e" opacity="0.85"/>
        {/* Route — dashed line winding across */}
        <path
          d="M 18 42 C 24 40, 28 30, 34 30 C 40 30, 42 38, 46 38"
          stroke="#7c2d12"
          strokeWidth="1.2"
          fill="none"
          strokeDasharray="2 2"
          strokeLinecap="round"
        />
        {/* X-marks-the-spot */}
        <g transform="translate(46 38)">
          <line x1="-2" y1="-2" x2="2" y2="2" stroke="#7f1d1d" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="2" y1="-2" x2="-2" y2="2" stroke="#7f1d1d" strokeWidth="1.5" strokeLinecap="round"/>
        </g>
        {/* Compass rose top-right */}
        <g transform="translate(44 24)">
          <circle cx="0" cy="0" r="3.2" fill="#fef3c7" stroke="#92400e" strokeWidth="0.5"/>
          <polygon points="0,-3 1,0 0,3 -1,0" fill="#7c2d12"/>
          <polygon points="0,-3 0.6,0 -0.6,0" fill={GOLD_BRIGHT}/>
        </g>
      </Frame>
    </span>
  );
}

// ── 9. Spellbook — open tome with rising sparkles ─────────────────────────────
export function SpellbookIcon({ size, className, style }: IconProps) {
  return (
    <span className={className} style={style}>
      <Frame size={size} gradId="book" accent={VIOLET_BRIGHT}>
        <defs>
          <linearGradient id="bookCover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={VIOLET_MID}/>
            <stop offset="100%" stopColor={VIOLET_DARK}/>
          </linearGradient>
          <linearGradient id="pageG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#fef3c7"/>
            <stop offset="100%" stopColor="#e9c890"/>
          </linearGradient>
        </defs>
        {/* Open book — two pages with center seam */}
        <path
          d="M 8 38 L 8 50 L 32 50 L 32 42 L 56 50 L 56 38 L 32 30 Z"
          fill="url(#bookCover)"
          stroke="#0a0518"
          strokeWidth="0.8"
        />
        {/* Left page */}
        <path d="M 10 38 L 32 32 L 32 48 L 10 48 Z" fill="url(#pageG)" stroke="#92400e" strokeWidth="0.5"/>
        {/* Right page */}
        <path d="M 54 38 L 32 32 L 32 48 L 54 48 Z" fill="url(#pageG)" stroke="#92400e" strokeWidth="0.5"/>
        {/* Text lines on each page */}
        {[39, 41, 43, 45].map((y, i) => (
          <g key={i}>
            <line x1="14" y1={y} x2={28} y2={y - 0.6} stroke="#7c2d12" strokeWidth="0.5" opacity="0.6"/>
            <line x1="36" y1={y - 0.6} x2={50} y2={y} stroke="#7c2d12" strokeWidth="0.5" opacity="0.6"/>
          </g>
        ))}
        {/* Center seam */}
        <line x1="32" y1="32" x2="32" y2="48" stroke="#5b3520" strokeWidth="0.7"/>
        {/* Rising sparkles */}
        <g>
          {[
            { x: 22, y: 24, s: 1.6, r: 0 },
            { x: 32, y: 18, s: 2.2, r: 25 },
            { x: 42, y: 22, s: 1.4, r: -10 },
            { x: 28, y: 12, s: 1, r: 15 },
            { x: 38, y: 12, s: 1.1, r: -20 },
          ].map((sp, i) => (
            <g key={i} transform={`translate(${sp.x} ${sp.y}) rotate(${sp.r})`}>
              <path
                d={`M 0,${-sp.s * 2} L ${sp.s * 0.5},${-sp.s * 0.5} L ${sp.s * 2},0 L ${sp.s * 0.5},${sp.s * 0.5} L 0,${sp.s * 2} L ${-sp.s * 0.5},${sp.s * 0.5} L ${-sp.s * 2},0 L ${-sp.s * 0.5},${-sp.s * 0.5} Z`}
                fill={GOLD_BRIGHT}
                opacity="0.95"
              />
            </g>
          ))}
        </g>
      </Frame>
    </span>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
export type LandingIconName =
  | "dungeon-master"
  | "combat"
  | "multiplayer"
  | "voice"
  | "portrait"
  | "controller"
  | "forge"
  | "map"
  | "spellbook";

export function LandingIcon({ name, size = 64, className, style }: { name: LandingIconName } & IconProps) {
  switch (name) {
    case "dungeon-master": return <DungeonMasterIcon size={size} className={className} style={style}/>;
    case "combat":         return <CombatIcon         size={size} className={className} style={style}/>;
    case "multiplayer":    return <MultiplayerIcon    size={size} className={className} style={style}/>;
    case "voice":          return <VoiceIcon          size={size} className={className} style={style}/>;
    case "portrait":       return <PortraitIcon       size={size} className={className} style={style}/>;
    case "controller":     return <ControllerIcon     size={size} className={className} style={style}/>;
    case "forge":          return <ForgeIcon          size={size} className={className} style={style}/>;
    case "map":            return <MapIcon            size={size} className={className} style={style}/>;
    case "spellbook":      return <SpellbookIcon      size={size} className={className} style={style}/>;
  }
}
