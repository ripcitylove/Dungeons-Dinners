"use client";

import { useMemo } from "react";

// 16×16 pixel sprites rendered at `size` px per pixel (default 3 → 48×48)
//
// Color codes
//   ' ' transparent
//   'O' outline (#111827)
//   'S' skin              (race palette)
//   'K' skin shadow       (race palette)
//   'H' hair              (race palette)
//   'D' hair dark / hood  (race palette)
//   'E' eye color         (race palette)
//   'A' armor/cloth       (class palette)
//   'B' armor shadow      (class palette)
//   'C' armor highlight   (class palette)
//   'W' weapon            (class palette)
//   'X' weapon shadow     (class palette)
//   'F' magic/fire — SVG opacity-animated (class palette)
//   'G' leather/boots     (class palette)
//   'I' inner cloth       (class palette)

type ColorMap = Record<string, string>;

// ── Race palettes ────────────────────────────────────────────────────────────

const RACE_PALETTES: Record<string, ColorMap> = {
  Human:      { S:"#F5C5A3", K:"#D4956A", H:"#5C3D2E", D:"#3D2314", E:"#5B9BD5" },
  Elf:        { S:"#EDE8D0", K:"#C8B8A0", H:"#E0D080", D:"#A8A040", E:"#48A878" },
  Dwarf:      { S:"#C8956C", K:"#A06840", H:"#8B3A0A", D:"#5C2008", E:"#C08020" },
  Halfling:   { S:"#D4A574", K:"#B07840", H:"#6B3A0A", D:"#4A2008", E:"#7B4F19" },
  Dragonborn: { S:"#4A8040", K:"#2E5828", H:"#1E3A18", D:"#142810", E:"#FF6000" },
  Tiefling:   { S:"#9B4DB5", K:"#7A2E99", H:"#E8E8E8", D:"#C0C0C0", E:"#CC0000" },
  Gnome:      { S:"#D4B896", K:"#A08060", H:"#7A5030", D:"#4A3018", E:"#20C070" },
  "Half-Elf": { S:"#F0D0B0", K:"#D0A880", H:"#C0A060", D:"#806830", E:"#60A090" },
  "Half-Orc": { S:"#7A9060", K:"#506040", H:"#2A2A2A", D:"#181818", E:"#D06020" },
};

// ── Class palettes ───────────────────────────────────────────────────────────

const CLASS_PALETTES: Record<string, ColorMap> = {
  Fighter:  { A:"#8FA8C0", B:"#4A6080", C:"#C8DFF0", W:"#C0C8D0", X:"#7080A0", F:"#90C0E0", G:"#4A3020", I:"#6A88A8" },
  Wizard:   { A:"#3D2C7A", B:"#1E1040", C:"#7A5FD0", W:"#7B6540", X:"#4A3A20", F:"#64B5F6", G:"#1E1040", I:"#4A3A78" },
  Rogue:    { A:"#2A2A3A", B:"#15151E", C:"#40405A", W:"#C0C0A0", X:"#808068", F:"#48A878", G:"#3A2010", I:"#3A3A50" },
  Cleric:   { A:"#D4C890", B:"#A09850", C:"#F0E8B0", W:"#C0A850", X:"#8A7030", F:"#FFFF80", G:"#806040", I:"#F0C840" },
  Paladin:  { A:"#D0D8E0", B:"#7080A0", C:"#F0F8FF", W:"#D0D8E0", X:"#7080A0", F:"#2848C0", G:"#4A3020", I:"#B0B8C8" },
  Ranger:   { A:"#4A6B3A", B:"#2A4020", C:"#6A8F58", W:"#8B6940", X:"#5C4020", F:"#90B870", G:"#5C3A20", I:"#3A5828" },
  Bard:     { A:"#8B2020", B:"#5C1010", C:"#C04040", W:"#C09030", X:"#8B6020", F:"#F0C030", G:"#4A2010", I:"#F0D070" },
  Warlock:  { A:"#1A0A2E", B:"#0A0018", C:"#3A1850", W:"#8060C0", X:"#4A3080", F:"#9040F0", G:"#1A0A2E", I:"#2A1048" },
};

// ── Sprites (16 cols × 16 rows) ──────────────────────────────────────────────

const SPRITES: Record<string, string[]> = {

  // Plate armor, longsword left, shield right
  Fighter: [
    "    OOOOOO      ",
    "   OCAAAACO     ",
    "   OCSSSSCO     ",
    "   OCESESCO     ",
    "  OCAAAAAACO    ",
    "WWOCBBAAAAAOB   ",
    "WWOCBBAAAAAOB   ",
    " WOCBBCCCBBOO   ",
    "   OGGBBGGO     ",
    "   OGGBBGGO     ",
    "   OGGBBGGO     ",
    "   OBBBBBO      ",
    "                ",
    "                ",
    "                ",
    "                ",
  ],

  // Pointed hat, deep-purple robes, staff right, magic orb left
  Wizard: [
    "    OHHO        ",
    "   OHHHO        ",
    "  OHHHHO        ",
    "  OHSSHO   F    ",
    "  OHESSHO  F    ",
    "  OHSSHO  FW    ",
    " OAAAAAO  FW    ",
    " OAAAAAO  FW    ",
    " OABBBAO  FW    ",
    " OABBBAO  FW    ",
    "  OABBO  FW     ",
    "  OAOO    W     ",
    "          W     ",
    "         WW     ",
    "        FF      ",
    "        F       ",
  ],

  // Dark hood, dual daggers, leather cloak
  Rogue: [
    "    ODDDO       ",
    "   ODDSSDO      ",
    "   ODDESSDO     ",
    "   ODDSSDO      ",
    "  ODDAAAADO     ",
    "WWODDBAAAABDD   ",
    "WWODDBAAAABDD   ",
    " WODDBBABBDD    ",
    "   ODGGBGDO     ",
    "   ODGGBGDO     ",
    "   ODGGBGDO     ",
    "   ODDBBDDO     ",
    "                ",
    "                ",
    "                ",
    "                ",
  ],

  // Simple hood, gold robes, mace left, glowing holy symbol
  Cleric: [
    "    OHHHO       ",
    "   OHSSHO       ",
    "   OHESSHO      ",
    "   OHSSHO       ",
    "  OHAAAAAHO     ",
    "W OBAAAAAABO    ",
    "W OBAAIFAIBO    ",
    "W OBBIIIBBO     ",
    "   OGGBBGO      ",
    "   OGGBBGO      ",
    "   OGGBBGO      ",
    "   OBBBBO       ",
    "                ",
    "                ",
    "                ",
    "                ",
  ],

  // Full plate helm, longsword (triple W), shining armor
  Paladin: [
    "    OOOOOO      ",
    "   OCAAAACO     ",
    "   OCAAAACO     ",
    "   OCESESCO     ",
    "  OCAAAAAACO    ",
    "WWWOCBBAAABBO   ",
    "WWWOCBBAAABBO   ",
    "  WOCBBCCBBO    ",
    "   OCGGBBGCO    ",
    "   OCGGBBGCO    ",
    "   OCGGBBGCO    ",
    "   OCBBBBCO     ",
    "                ",
    "                ",
    "                ",
    "                ",
  ],

  // Green hood, archer pose — arrow drawn back (WW = arrow tip, left)
  Ranger: [
    "   ODDDO        ",
    "  ODDSSDDO      ",
    "  ODDESSDDO     ",
    "  ODDSSADDO     ",
    "WWODAAAAADO     ",
    "WWODBAAAAABO    ",
    "WWODBAAAAABO    ",
    "  ODBBAAABBO    ",
    "   OGBBBBGO     ",
    "   OGBBBBGO     ",
    "   OGBBBBGO     ",
    "   OBBBBBBO     ",
    "                ",
    "                ",
    "                ",
    "                ",
  ],

  // Feathered cap (FF=feather), red/gold tunic, lute (W=neck, WWW=body)
  Bard: [
    "   OFFHFFO      ",
    "   OHHSSHO      ",
    "   OHSESSHO     ",
    "   OHHSSHO      ",
    "   OAAAAAO      ",
    "  WOBAAAABBOW   ",
    "  WOBAAAABBOW   ",
    "  WOBWWWBBOW    ",
    "   OIIBBIIO     ",
    "   OGGBBGO      ",
    "   OGGBBGO      ",
    "   OBBBBBO      ",
    "                ",
    "                ",
    "                ",
    "                ",
  ],

  // Dark cowl, void-black robes, eldritch blasts (FF left), wisps below
  Warlock: [
    "   ODHHDO       ",
    "  ODDHSSDO      ",
    "  ODDHESSDO     ",
    "  ODDHSSDO      ",
    "  ODDAAADDO     ",
    "FFODDBAAAABDDO  ",
    "FFODDBAAAABDDO  ",
    " FODDBAABBBDO   ",
    "   ODDBBDDO     ",
    "   ODDBBDDO     ",
    "   ODDBBDDO     ",
    "   ODBBDO       ",
    "F               ",
    "FF              ",
    "F               ",
    "                ",
  ],
};

// ── Animation class per class ────────────────────────────────────────────────

const ANIM_CLASS: Record<string, string> = {
  Fighter: "pc-anim-fighter",
  Wizard:  "pc-anim-wizard",
  Rogue:   "pc-anim-rogue",
  Cleric:  "pc-anim-cleric",
  Paladin: "pc-anim-paladin",
  Ranger:  "pc-anim-ranger",
  Bard:    "pc-anim-bard",
  Warlock: "pc-anim-warlock",
};

// ── Component ────────────────────────────────────────────────────────────────

export function PixelCharacter({
  race,
  cls,
  size = 3,
}: {
  race: string;
  cls: string;
  size?: number;
}) {
  const sprite = SPRITES[cls] ?? SPRITES.Fighter;

  const palette = useMemo<ColorMap>(() => ({
    O: "#111827",
    ...(RACE_PALETTES[race] ?? RACE_PALETTES.Human),
    ...(CLASS_PALETTES[cls] ?? CLASS_PALETTES.Fighter),
  }), [race, cls]);

  const px = size;
  const animClass = ANIM_CLASS[cls] ?? "pc-anim-fighter";

  return (
    <div className={`pc-char ${animClass}`}>
      <svg
        width={16 * px}
        height={16 * px}
        viewBox={`0 0 ${16 * px} ${16 * px}`}
        style={{ imageRendering: "pixelated", display: "block" }}
      >
        {sprite.map((row, y) =>
          [...row].map((code, x) => {
            if (code === " ") return null;
            const color = palette[code] ?? "#FF00FF";
            const isMagic = code === "F";
            // Stagger magic pulse so pixels shimmer in waves
            const delay = `${((x * 0.13 + y * 0.09) % 1.4).toFixed(2)}s`;
            return (
              <rect
                key={`${x}-${y}`}
                x={x * px}
                y={y * px}
                width={px}
                height={px}
                fill={color}
              >
                {isMagic && (
                  <animate
                    attributeName="opacity"
                    values="1;0.25;0.9;1"
                    dur="1.8s"
                    begin={delay}
                    repeatCount="indefinite"
                  />
                )}
              </rect>
            );
          })
        )}
      </svg>
    </div>
  );
}
