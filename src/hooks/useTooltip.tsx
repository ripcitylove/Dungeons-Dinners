"use client";
import React, { useState, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

const MARGIN = 10;

// maxWidth scales with the viewport: 50% of vw, clamped between 260px and 520px.
// This means short text stays compact while long descriptions flow horizontally
// rather than collapsing into a tall narrow column.
function computeMaxW(vw: number): number {
  return Math.min(520, Math.max(260, Math.round(vw * 0.5)));
}

type TipContent = { id: number; content: React.ReactNode; x: number; y: number };
type TipState   = TipContent | null;

// Renders a single tooltip. Starts invisible, measures its own rendered size via
// useLayoutEffect (fires before paint), then positions and reveals — no flash.
function PositionedTooltip({ tip }: { tip: TipContent }) {
  const ref  = useRef<HTMLDivElement>(null);
  // Compute maxW at mount time (always client-side; component never SSR-renders).
  const maxW = computeMaxW(window.innerWidth);

  const [style, setStyle] = useState<React.CSSProperties>({
    position:   "fixed",
    left:       tip.x,
    top:        tip.y,
    visibility: "hidden",
    zIndex:     99999,
    pointerEvents: "none",
    maxWidth:   maxW,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w  = el.offsetWidth;
    const h  = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: center on cursor, then clamp into [MARGIN, vw - w - MARGIN].
    // If the box is somehow wider than the viewport (shouldn't happen given
    // maxWidth, but defensive), fall back to MARGIN on the left.
    const maxLeft = Math.max(MARGIN, vw - w - MARGIN);
    const left = Math.max(MARGIN, Math.min(tip.x - w / 2, maxLeft));

    // Vertical: prefer above the cursor when it fits; otherwise place below.
    // In BOTH branches clamp top into [MARGIN, vh - h - MARGIN] so the box can
    // never clip off the top OR the bottom of the viewport, even when:
    //   • The tooltip is taller than the space above the cursor.
    //   • The cursor is so low that below-cursor would overflow off the bottom.
    //   • The tooltip is taller than the available space either way.
    const fitsAbove = tip.y - 14 - h >= MARGIN;
    const desiredTop = fitsAbove ? tip.y - 14 - h : tip.y + 22;
    const maxTop = Math.max(MARGIN, vh - h - MARGIN);
    const top = Math.max(MARGIN, Math.min(desiredTop, maxTop));

    setStyle({
      position:   "fixed",
      left,
      top,
      visibility: "visible",
      zIndex:     99999,
      pointerEvents: "none",
      // Hard caps so the box is guaranteed to fit inside the viewport even on
      // very small screens. If content exceeds the height cap, the inner tipBox
      // already scrolls via the page; we just stop the box itself from clipping.
      maxWidth:   Math.min(maxW, vw - 2 * MARGIN),
      maxHeight:  vh - 2 * MARGIN,
      overflowY:  "auto",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tip.id]);

  return <div ref={ref} style={style}>{tip.content}</div>;
}

// Exported component — usable directly when a hook isn't convenient (e.g. campaign page).
export function TooltipPortal({ tip }: { tip: TipState }) {
  if (!tip || typeof window === "undefined") return null;
  return createPortal(<PositionedTooltip key={tip.id} tip={tip} />, document.body);
}

export function useTooltip() {
  const [tip, setTip] = useState<TipState>(null);
  const idRef         = useRef(0);

  const showTooltip = useCallback((content: React.ReactNode, e: React.MouseEvent) => {
    setTip({ id: ++idRef.current, content, x: e.clientX, y: e.clientY });
  }, []);

  const hideTooltip = useCallback(() => setTip(null), []);

  return { showTooltip, hideTooltip, TooltipPortal: <TooltipPortal tip={tip} /> };
}

// Shared container style — applied to both tipBox and tipBoxNode for consistency.
const TIP_CONTAINER = (accent: string): React.CSSProperties => ({
  background:   "#12101f",
  border:       `1px solid ${accent}55`,
  borderRadius: "8px",
  padding:      "calc(9px * var(--tooltip-font-scale, 1)) calc(13px * var(--tooltip-font-scale, 1))",
  fontSize:     "calc(0.76rem * var(--tooltip-font-scale, 1))",
  color:        "#e2e8f0",
  lineHeight:   1.55,
  boxShadow:    "0 6px 28px rgba(0,0,0,0.85)",
  minWidth:     "calc(200px * var(--tooltip-font-scale, 1))",
  maxWidth:     "calc(300px * var(--tooltip-font-scale, 1))",
});
const TIP_TITLE = (accent: string): React.CSSProperties => ({
  fontWeight: 700, color: accent, marginBottom: "4px",
  fontSize: "calc(0.8rem * var(--tooltip-font-scale, 1))",
});

// Standard tooltip card — string body, dark fantasy aesthetic.
export function tipBox(title: string, body: string, accent = "#8b5cf6"): React.ReactNode {
  return (
    <div style={TIP_CONTAINER(accent)}>
      <div style={TIP_TITLE(accent)}>{title}</div>
      <div style={{ color: "#94a3b8" }}>{body}</div>
    </div>
  );
}

// Rich tooltip card — accepts ReactNode body for multi-section content.
// Uses identical container and title styles as tipBox.
export function tipBoxNode(title: string, body: React.ReactNode, accent = "#8b5cf6"): React.ReactNode {
  return (
    <div style={TIP_CONTAINER(accent)}>
      {title && <div style={TIP_TITLE(accent)}>{title}</div>}
      {body}
    </div>
  );
}
