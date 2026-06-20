// Hand-authored empty-state glyphs, drawn in the same idiom as our spell/status
// icons (see StatusGlyph.tsx): flat silhouette on a 24×24 grid, filled with
// currentColor, with negative-space detail punched out in HOLE so it reads as a
// crisp cutout. Tint via the wrapping element's `color`. Used on the dashboard's
// "No campaigns yet" / "No characters yet" cards in place of bare emoji.
import React from "react";

const HOLE = "#0b0a14";
const F = { fill: "currentColor" as const };

type GlyphProps = { size?: number | string; color?: string; style?: React.CSSProperties };

function Glyph({ size = 52, color = "currentColor", style, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      style={{ color, display: "block", overflow: "visible", ...style }}>
      {children}
    </svg>
  );
}

/** Treasure map — a folded parchment with a dashed route and an X-marks-the-spot.
 *  Stands in for "Your Adventures." */
export function AdventureGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      {/* parchment with two implied folds */}
      <path {...F} fillOpacity={0.95} d="M3.5 5.2 8.5 3.6 15.5 5.6 20.5 4 V18.4 L15.5 20.4 L8.5 18.4 L3.5 20 Z" />
      {/* fold creases */}
      <path d="M8.5 3.6V18.4M15.5 5.6V20.4" stroke={HOLE} strokeWidth="1" fill="none" strokeLinejoin="round" opacity={0.45} />
      {/* dashed travel route */}
      <path d="M6 15.6C7.6 11 9.6 13 11 11.4 12.5 9.8 13.6 7.6 16.4 8.1" stroke={HOLE} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeDasharray="1.3 1.5" />
      {/* start pin */}
      <circle cx="6" cy="15.6" r="1.15" fill={HOLE} />
      {/* X marks the spot */}
      <path d="M15.2 6.7l2 2M17.2 6.7l-2 2" stroke={HOLE} strokeWidth="1.5" strokeLinecap="round" />
    </Glyph>
  );
}

/** Knight's great helm with a crest ridge — stands in for "Your Heroes." */
export function HeroGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      {/* crest ridge */}
      <path {...F} d="M9.4 3.4C10 1.9 14 1.9 14.6 3.4 13.4 3 10.6 3 9.4 3.4Z" />
      {/* helm dome + body */}
      <path {...F} d="M12 3c4.1 0 6.7 3 6.7 7.1V16c0 3.1-3 5.4-6.7 5.4S5.3 19.1 5.3 16V10.1C5.3 6 7.9 3 12 3Z" />
      {/* visor slit */}
      <rect x="6.3" y="9.1" width="11.4" height="2" rx="1" fill={HOLE} />
      {/* center bar */}
      <path d="M12 11.6v6.6" stroke={HOLE} strokeWidth="1.6" strokeLinecap="round" />
      {/* breath bars */}
      <path d="M8.8 12.6v4.4M15.2 12.6v4.4" stroke={HOLE} strokeWidth="1.2" strokeLinecap="round" />
    </Glyph>
  );
}
