// The site's brand mark — a 20-sided die (icosahedron, vertex-on projection),
// themed to the UI: violet facets, warm-gold edges, and "20" on the front face.
// Reuses the same d20 geometry the in-game DiceRoller draws, so the brand die and
// the rolled die read as the same object. Drop it in anywhere the old ⬡ glyph was.
import type { CSSProperties } from "react";

type Props = { size?: number | string; className?: string; style?: CSSProperties; title?: string };

export function D20Icon({ size = 32, className, style, title }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: "block", overflow: "visible", ...style }}
      role="img"
      aria-label={title ?? "20-sided die"}
    >
      <defs>
        <linearGradient id="d20Face" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%"  stopColor="#a78bfa" />
          <stop offset="52%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="d20Cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#d6c8ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* outer silhouette */}
      <path d="M76,14 L92,64 L50,94 L8,64 L24,14 Z" fill="url(#d20Face)" stroke="#d4a96a" strokeWidth="3" strokeLinejoin="round" />

      {/* lit top-cap pentagon (the front face cluster) */}
      <path d="M27,43 L50,26 L73,43 L64,69 L36,69 Z" fill="url(#d20Cap)" opacity="0.5" />

      {/* facet edges — subtle warm-gold lines */}
      <g stroke="#ecdcab" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.55">
        {/* inner pentagon */}
        <path d="M50,26 L73,43 L64,69 L36,69 L27,43 Z" />
        {/* spokes from inner ring out to the silhouette vertices */}
        <path d="M50,26 L24,14 M50,26 L76,14 M73,43 L76,14 M73,43 L92,64 M64,69 L92,64 M64,69 L50,94 M36,69 L50,94 M36,69 L8,64 M27,43 L8,64 M27,43 L24,14" />
      </g>

      {/* "20" on the front face */}
      <text
        x="50" y="53" textAnchor="middle" dominantBaseline="central"
        fontSize="25" fontWeight={900}
        fontFamily="var(--font-cinzel-decorative), var(--font-cinzel), Georgia, serif"
        fill="#fef3c7" stroke="#3b0764" strokeWidth="0.7" paintOrder="stroke"
        style={{ letterSpacing: "-1px" }}
      >20</text>
    </svg>
  );
}
