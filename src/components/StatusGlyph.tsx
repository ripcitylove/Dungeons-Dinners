// Custom, color-themed SVG status/buff/debuff icons for the party-card badges —
// a hand-authored set inspired by tabletop status-icon sheets (bold, flat,
// silhouette glyphs). Each glyph is drawn on a 24×24 grid and tinted to its
// effect's registry color via CSS `color` → currentColor. Negative-space detail
// uses HOLE (a near-black) so it reads as a cutout on the dark badge.
//
// Keyed by the canonical STATUS_EFFECTS name; resolveStatusKey() maps aliases/
// spell-name variants to the right glyph. Falls back to null (card shows the emoji)
// for anything without a glyph.
import React from "react";
import { resolveStatusKey } from "../lib/statusEffects";

const HOLE = "#0b0a14";
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const F = { fill: "currentColor" };

const GLYPHS: Record<string, React.ReactNode> = {
  // ── CONDITIONS ──────────────────────────────────────────────
  Dead: (<>
    <path {...F} d="M12 2C7 2 3.5 5.4 3.5 10c0 2.8 1.4 5 3.5 6.3V19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2.7c2.1-1.3 3.5-3.5 3.5-6.3C20.5 5.4 17 2 12 2Z"/>
    <circle cx="9" cy="10" r="1.9" fill={HOLE}/><circle cx="15" cy="10" r="1.9" fill={HOLE}/>
    <path d="M10 16h4" stroke={HOLE} strokeWidth="1.6" strokeLinecap="round"/>
  </>),
  Unconscious: (<>
    <path {...S} d="M5 8h5l-5 5h5"/>
    <path {...S} strokeWidth="1.8" d="M13 4h4l-4 4h4"/>
    <path {...S} strokeWidth="1.6" d="M15 15h3l-3 3h3"/>
  </>),
  Poisoned: (<>
    <path {...F} d="M12 2.5C12 2.5 5 11 5 15.5a7 7 0 0 0 14 0C19 11 12 2.5 12 2.5Z"/>
    <circle cx="9.6" cy="15" r="1.5" fill={HOLE}/><circle cx="14.4" cy="15" r="1.5" fill={HOLE}/>
    <path d="M9.6 18.2c1.6 1 3.2 1 4.8 0" stroke={HOLE} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
  </>),
  Blinded: (<>
    <path {...S} d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/>
    <circle cx="12" cy="12" r="2.6" {...F}/>
    <path d="M4 4l16 16" {...S}/>
  </>),
  Frightened: (<>
    <path {...F} d="M12 3l9 16H3L12 3Z"/>
    <rect x="11" y="9" width="2" height="5.5" rx="1" fill={HOLE}/>
    <circle cx="12" cy="16.5" r="1.2" fill={HOLE}/>
  </>),
  Paralyzed: (<path {...F} d="M13 2L4 13h6l-2 9 10-12h-6l1-8Z"/>),
  Stunned: (<>
    <path {...S} d="M5 12a7 7 0 1 1 7 7"/>
    <path {...F} d="M17 3l.9 1.9 2.1.3-1.5 1.5.35 2.1L17 7.8l-1.85 1 .35-2.1L14 5.2l2.1-.3L17 3Z"/>
    <circle cx="9" cy="20" r="1.4" {...F}/>
  </>),
  Prone: (<path {...F} d="M12 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM6 16h12l-3-4-3 1.4L9 12l-3 4Zm-1 2h14v2.4H5V18Z"/>),
  Charmed: (<path {...F} d="M12 21S3.5 14.5 3.5 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.5 2.8C20.5 14.5 12 21 12 21Z"/>),
  Exhausted: (<>
    <path {...S} d="M8 4.5C8 4.5 14 6 14 12s-6 7.5-6 7.5"/>
    <path {...F} d="M17 9c0 1.4-1.6 3-1.6 3S13.8 10.4 13.8 9a1.6 1.6 0 0 1 3.2 0Z"/>
  </>),
  Restrained: (<>
    <rect {...S} x="3.5" y="8" width="8" height="5.5" rx="2.75"/>
    <rect {...S} x="12.5" y="11" width="8" height="5.5" rx="2.75"/>
  </>),
  Petrified: (<>
    <rect {...F} x="4" y="5" width="16" height="14" rx="1.5"/>
    <path d="M9 5v4l-3 2M15 5l2 3-2 3 3 2M9 19v-3l3-2-2-3" stroke={HOLE} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </>),
  Deafened: (<>
    <path {...F} d="M4 9.5h3l4-3.5v12l-4-3.5H4Z"/>
    <path d="M15 8.5l5 7M20 8.5l-5 7" {...S} strokeWidth="2"/>
  </>),
  Grappled: (<path {...F} d="M8 11V5.6a1.4 1.4 0 0 1 2.8 0V10h.6V4.4a1.4 1.4 0 0 1 2.8 0V10h.6V5.6a1.4 1.4 0 0 1 2.8 0V13c0 4-2.6 7-6.3 7C9 20 6 17.6 6 14l-1.6-2.6a1.3 1.3 0 0 1 2-1.6L8 11Z"/>),
  Invisible: (<>
    <path {...S} strokeDasharray="2.6 2.2" d="M6 20v-9a6 6 0 0 1 12 0v9l-2-1.6-2 1.6-2-1.6-2 1.6-2-1.6Z"/>
    <circle cx="9.5" cy="11" r="1.1" {...F}/><circle cx="14.5" cy="11" r="1.1" {...F}/>
  </>),
  Incapacitated: (<>
    <circle {...S} cx="12" cy="12" r="9"/>
    <path d="M6 6l12 12" {...S}/>
  </>),
  Burning: (<path {...F} d="M12 2c1 3-1.5 4.5-1.5 7 0 1.3 1 2.2 1.5 2.8.6-.8 1-1.6 1-2.8 2 1.4 3.5 3.6 3.5 6.2a4.5 4.5 0 0 1-9 0C7.5 9 12 7 12 2Z"/>),

  // ── BUFFS ───────────────────────────────────────────────────
  Blessed: (<path {...F} d="M12 2l1.7 6.1L20 9.5l-5.2 3.4L16.5 19 12 15.2 7.5 19l1.7-6.1L4 9.5l6.3-1.4L12 2Z"/>),
  Hasted: (<path {...F} d="M3 9h7l-1.5 6 8-9h-7l1.5-6L3 9Zm14.5 3h3l-3 4h3l-5 5 1-4h-3l4-5Z" fillOpacity="1"/>),
  Raging: (<path {...F} d="M7 11V5.8a1.4 1.4 0 0 1 2.8 0V10h.6V4.6a1.4 1.4 0 0 1 2.8 0V10h.6V5.8a1.4 1.4 0 0 1 2.8 0V13c0 4-2.5 7-6 7-2.7 0-4.7-2-5.6-4.6l-1-3a1.4 1.4 0 0 1 2.4-1.3L7 11Z"/>),
  Inspired: (<path {...F} d="M9 5l9-2v10.2A3.3 3.3 0 1 0 19.2 16V6.6L11 8.3v8A3.3 3.3 0 1 0 12.2 19V5.2"/>),
  Shielded: (<path {...F} d="M12 2.5 5 5.2v5.3c0 4.7 3 8.4 7 10 4-1.6 7-5.3 7-10V5.2L12 2.5Z"/>),
  Concentrating: (<>
    <circle {...S} cx="12" cy="12" r="8.5"/>
    <circle {...S} cx="12" cy="12" r="4.7"/>
    <circle {...F} cx="12" cy="12" r="1.8"/>
  </>),
  Flying: (<>
    <path {...F} d="M3 8c5-2 9 .5 11 4-4-1.5-7-1-9 1 .5-2.5-.5-4-2-5Z"/>
    <path {...F} d="M14 16l4-9 1.6.7-3 7H20v2h-7v-2l1-.7Z" fillOpacity=".95"/>
  </>),
  Regenerating: (<>
    <path {...S} d="M19 7a8 8 0 1 0 1.6 6"/>
    <path {...F} d="M20.5 4.5l1 4.2-4.2-1 3.2-3.2Z"/>
    <path d="M12 8.5v7M8.5 12h7" stroke={HOLE} strokeWidth="2" strokeLinecap="round"/>
  </>),
  "Wild Shaped": (<>
    <path {...F} d="M12 11c2.2 0 4 1.9 4 4.2 0 1.7-1.8 2.8-4 2.8s-4-1.1-4-2.8C8 12.9 9.8 11 12 11Z"/>
    <circle cx="6.5" cy="8.5" r="2.1" {...F}/><circle cx="17.5" cy="8.5" r="2.1" {...F}/>
    <circle cx="9" cy="4.8" r="1.9" {...F}/><circle cx="15" cy="4.8" r="1.9" {...F}/>
  </>),
  "Bardic Inspiration": (<>
    <path {...F} d="M10 4l8-1.6v9.1A3 3 0 1 0 19 14V4.2L11.6 5.6v8.2A3 3 0 1 0 12.6 16V4"/>
    <path {...F} d="M4.5 13l3.5-.7v5.4A2.4 2.4 0 1 1 6.6 16v-2.4" fillOpacity=".8"/>
  </>),
  "Death Ward": (<>
    <path {...F} d="M12 2.5 5 5.2v5.3c0 4.7 3 8.4 7 10 4-1.6 7-5.3 7-10V5.2L12 2.5Z"/>
    <path d="M12 8.3c1.6-1.7 4.2-.5 4.2 1.5 0 2-2.6 3.6-4.2 4.9-1.6-1.3-4.2-2.9-4.2-4.9 0-2 2.6-3.2 4.2-1.5Z" fill={HOLE}/>
  </>),
  Sanctuary: (<>
    <path {...F} d="M12 2.5 4 8v1.5h16V8L12 2.5Z"/>
    <path {...F} d="M5.5 11h13v9.5h-3.5V15a3 3 0 0 0-6 0v5.5H5.5V11Z"/>
  </>),
  Guidance: (<>
    <path {...F} d="M12 2l1.5 5.2L19 5.4l-3.5 4.4L20.5 12l-5 2.2L19 18.6l-5.5-1.8L12 22l-1.5-5.2L5 18.6l3.5-4.4L3.5 12l5-2.2L5 5.4l5.5 1.8L12 2Z" fillOpacity=".25"/>
    <path {...F} d="M12 5l1 4 4 1-4 1-1 4-1-4-4-1 4-1 1-4Z"/>
  </>),
  Shillelagh: (<>
    <path {...F} d="M14.5 20.5l-9-9a2 2 0 0 1 2.8-2.8l9 9a2 2 0 0 1-2.8 2.8Z" fillOpacity=".9"/>
    <path {...F} d="M15 3c3 0 5 2 5 5-2.2.3-3.7-.2-4.8-1.3C14.1 5.6 14.7 4.5 15 3ZM8 6c.3 2.2-.2 3.7-1.3 4.8C5.6 9.9 5 8.5 5 7c0-1.4 1.4-1 3-1Z"/>
  </>),
  Resistance: (<>
    <path {...F} d="M12 9c0-2.5 1-4 2.2-4S16 6 15.6 8.4M12 9c0-2.8-.6-4.3-1.8-4.3S8.5 6 8.8 8.6M12 9c0-1.8-1-3-2-3S8 7.2 8.4 9"/>
    <path {...F} d="M7 9.5c-.8-1-2.2-.6-2.2.8 0 2.6 2 6 4.4 7.4C11 19 13 19 13 19s5-1.5 5-7V8.5c0-1.2-1.6-1.4-2-.2l-.7 2"/>
    <path d="M11.5 12.5l1.2 1.2 2.3-2.6" stroke={HOLE} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </>),
  Aided: (<>
    <path {...F} d="M12 20S4 14 4 8.8A4.4 4.4 0 0 1 12 6a4.4 4.4 0 0 1 8 2.8C20 14 12 20 12 20Z"/>
    <path d="M12 8.5v6M9 11.5h6" stroke={HOLE} strokeWidth="2" strokeLinecap="round"/>
  </>),
  Heroism: (<>
    <path {...F} d="M12 2.5 5 5.2v5.3c0 4.7 3 8.4 7 10 4-1.6 7-5.3 7-10V5.2L12 2.5Z"/>
    <path d="M12 6.5l1.1 3.4h3.6l-2.9 2.1 1.1 3.4-2.9-2.1-2.9 2.1 1.1-3.4-2.9-2.1h3.6L12 6.5Z" fill={HOLE}/>
  </>),
  "Shield of Faith": (<>
    <path {...F} d="M12 2.5 5 5.2v5.3c0 4.7 3 8.4 7 10 4-1.6 7-5.3 7-10V5.2L12 2.5Z"/>
    <path d="M12 7v7M9 10h6" stroke={HOLE} strokeWidth="2.2" strokeLinecap="round"/>
  </>),
  Protected: (<>
    <path {...F} d="M12 2.5 5 5.2v5.3c0 4.7 3 8.4 7 10 4-1.6 7-5.3 7-10V5.2L12 2.5Z"/>
    <circle cx="12" cy="11" r="3.4" fill={HOLE}/>
    <path d="M12 6v10M7 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".55"/>
  </>),
  Barkskin: (<>
    <path {...F} d="M12 2c3 2 4.5 5 4.5 8.5 0 2-1 3.6-2.4 4.6V21h-4.2v-5.9C8.5 14.1 7.5 12.5 7.5 10.5 7.5 7 9 4 12 2Z"/>
    <path d="M12 6v11M10 9c1 1 3 1 4 0M10 13c1 1 3 1 4 0" stroke={HOLE} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
  </>),
  Longstrider: (<>
    <path {...F} d="M14 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM11 8l3 1 1 3 3 1-1 2-3.6-1.2L13 12l-1.5 3.5L15 18l-1.4 3-4-2.6 2-5-2.5-1 1-3.5L11 8Z"/>
    <path d="M3 9h4M2 13h4M4 17h3" {...S} strokeWidth="1.8" opacity=".8"/>
  </>),
  Enlarged: (<path {...S} d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5M8 8l-3-3M16 8l3-3M8 16l-3 3M16 16l3 3"/>),

  // ── DEBUFFS ─────────────────────────────────────────────────
  Cursed: (<path {...F} d="M12 2l2 4 4-2-1 4.5 4 1.5-3.5 2.8L21 19l-4.5-1L15 22l-3-3-3 3-1.5-4L3 19l1.5-4.7L1 11.5l4-1.5L4 5.5l4 2 2-4 2 4Z" fillOpacity=".9"/>),
  Hexed: (<>
    <path {...S} d="M12 2.5l8.2 4.7v9.6L12 21.5l-8.2-4.7V7.2L12 2.5Z"/>
    <circle {...F} cx="12" cy="12" r="2.4"/>
    <path d="M12 7.5v2M12 14.5v2M8 9.7l1.7 1M14.3 13.3l1.7 1M8 14.3l1.7-1M14.3 10.7l1.7-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </>),
  Marked: (<>
    <circle {...S} cx="12" cy="12" r="8.5"/>
    <circle {...S} cx="12" cy="12" r="3.6"/>
    <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" {...S} strokeWidth="2"/>
  </>),
  Silenced: (<>
    <path {...F} d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 16h-7l-4 3.5V16H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 5Z" fillOpacity=".85"/>
    <path d="M8 7l8 8" stroke={HOLE} strokeWidth="2.2" strokeLinecap="round"/>
  </>),
  Weakened: (<path {...F} d="M12 4v8.2l3.5-3.5 1.8 1.8L12 16 6.7 10.5l1.8-1.8L12 12.2V4Z" transform="translate(0 1)"/>),
  "Hunter's Mark": (<>
    <circle {...S} cx="11" cy="13" r="6.5"/>
    <circle {...F} cx="11" cy="13" r="2"/>
    <path {...F} d="M14 10l7-7M18.5 3H21v2.5M21 3l-2.4 2.4"/>
    <path d="M14 10l7-7" {...S} strokeWidth="2"/>
  </>),
  Baned: (<path {...F} d="M12 22l-1.7-6.1L4 14.5l5.2-3.4L7.5 5 12 8.8 16.5 5l-1.7 6.1L20 14.5l-6.3 1.4L12 22Z" fillOpacity=".9"/>),
  Slowed: (<>
    <path {...S} d="M16 18a6 6 0 1 1-6-6"/>
    <circle {...S} cx="16.5" cy="9.5" r="4.5"/>
    <path d="M16.5 7v2.5l1.6 1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 12c-1.4 0-2.5 1-2.5 2.4" {...S} strokeWidth="1.8"/>
  </>),
  Reduced: (<path {...S} d="M4 4l5 5M4 4v4M4 4h4M20 4l-5 5M20 4v4M20 4h-4M4 20l5-5M4 20v-4M4 20h4M20 20l-5-5M20 20v-4M20 20h-4"/>),

  // ── DISEASES ────────────────────────────────────────────────
  Diseased: (<>
    <circle {...F} cx="12" cy="12" r="5.5"/>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M5 19l2-2" {...S} strokeWidth="2"/>
    <circle cx="10.5" cy="11" r="1" fill={HOLE}/><circle cx="13.5" cy="13" r="1" fill={HOLE}/>
  </>),
  Infected: (<>
    <path {...F} d="M12 2.5C12 2.5 5 11 5 15.5a7 7 0 0 0 14 0C19 11 12 2.5 12 2.5Z"/>
    <path d="M12 9v5M12 17.5h.01" stroke={HOLE} strokeWidth="1.8" strokeLinecap="round"/>
  </>),
  Fevered: (<>
    <path {...S} d="M14 13.5V5a2 2 0 0 0-4 0v8.5a4 4 0 1 0 4 0Z"/>
    <path {...F} d="M12 11.5a2 2 0 0 1 0 5.8 2 2 0 0 1 0-5.8Z"/>
    <path d="M12 8v3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </>),
  "Sewer Plague": (<>
    <circle {...F} cx="12" cy="12" r="2.4"/>
    <path {...F} d="M12 3.5a4 4 0 0 1 3.5 6L13.4 11a1.6 1.6 0 0 0-2.8 0L8.5 9.5A4 4 0 0 1 12 3.5Z"/>
    <path {...F} d="M4.6 16.2a4 4 0 0 1 .9-6.7l2 1.3a1.6 1.6 0 0 0 1.4 2.4l-.1 2.4a4 4 0 0 1-4.2.6Z"/>
    <path {...F} d="M19.4 16.2a4 4 0 0 1-4.2-.6l-.1-2.4a1.6 1.6 0 0 0 1.4-2.4l2-1.3a4 4 0 0 1 .9 6.7Z"/>
  </>),

  // ── ENCHANTMENTS ────────────────────────────────────────────
  Attuned: (<>
    <path {...F} d="M7 3h10l4 5-9 12L3 8l4-5Z" fillOpacity=".95"/>
    <path d="M3.5 8h17M9 3.5 7.5 8 12 19M15 3.5 16.5 8 12 19" stroke={HOLE} strokeWidth="1.1" fill="none" strokeLinejoin="round"/>
  </>),
  Empowered: (<>
    <path {...F} d="M12 3l6 7h-3.5v9h-5v-9H6l6-7Z"/>
    <path {...F} d="M18.5 14l.7 1.6 1.8.2-1.3 1.2.4 1.8-1.6-.9-1.6.9.4-1.8-1.3-1.2 1.8-.2.7-1.6Z" fillOpacity=".9"/>
  </>),
  Enchanted: (<>
    <path {...F} d="M11 4l1.4 4.6L17 10l-4.6 1.4L11 16l-1.4-4.6L5 10l4.6-1.4L11 4Z"/>
    <path {...F} d="M18 13l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" fillOpacity=".85"/>
  </>),
  "Mage Armor": (<>
    <path {...F} d="M12 2.5 5 5.2v5.3c0 4.7 3 8.4 7 10 4-1.6 7-5.3 7-10V5.2L12 2.5Z"/>
    <path d="M12 7.5l2.6 3.5L12 14.5 9.4 11 12 7.5Z" fill={HOLE}/>
  </>),
  "Mirror Image": (<>
    <path {...F} d="M6 9.5a2.3 2.3 0 1 1 0-.1ZM2.5 20v-2.5C2.5 15.6 4 14 6 14s3.5 1.6 3.5 3.5V20H2.5Z" fillOpacity=".55"/>
    <path {...F} d="M18 9.5a2.3 2.3 0 1 1 0-.1ZM14.5 20v-2.5c0-1.9 1.5-3.5 3.5-3.5s3.5 1.6 3.5 3.5V20h-7Z" fillOpacity=".75"/>
    <path {...F} d="M12 8.5a2.6 2.6 0 1 1 0-.1ZM8 20v-2.8C8 15 9.8 13.2 12 13.2s4 1.8 4 4V20H8Z"/>
  </>),
};

export function hasStatusGlyph(name: string): boolean {
  const key = resolveStatusKey(name);
  return key != null && key in GLYPHS;
}

/** Renders the custom SVG glyph for an effect (by raw/alias name), tinted to `color`.
 *  Returns null when no glyph exists (caller can fall back to an emoji). */
export function StatusGlyph({ name, color = "currentColor", size = 18 }: { name: string; color?: string; size?: number | string }) {
  const key = resolveStatusKey(name);
  const glyph = key ? GLYPHS[key] : null;
  if (!glyph) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      style={{ color, display: "block", overflow: "visible" }}>
      {glyph}
    </svg>
  );
}
