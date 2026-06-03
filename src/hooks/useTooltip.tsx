"use client";
import React, { useState, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

const MARGIN = 10;

type TipContent = { id: number; content: React.ReactNode; x: number; y: number };
type TipState   = TipContent | null;

// Renders a single tooltip at the correct position. Starts hidden, measures its
// own rendered size via useLayoutEffect, then positions and reveals in the same
// paint frame (no visible flash).
function PositionedTooltip({ tip }: { tip: TipContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    left: tip.x,
    top: tip.y,
    visibility: "hidden",
    zIndex: 99999,
    pointerEvents: "none",
    maxWidth: "380px",
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w  = el.offsetWidth;
    const h  = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: center on cursor, clamp so neither edge leaves the viewport
    const left = Math.max(MARGIN, Math.min(tip.x - w / 2, vw - w - MARGIN));

    // Vertical: prefer above cursor; flip below when there isn't room
    const fitsAbove = tip.y - 14 - h >= MARGIN;
    const top = fitsAbove
      ? Math.max(MARGIN, tip.y - 14 - h)       // above: top edge of box
      : Math.min(tip.y + 22, vh - h - MARGIN); // below: top edge of box

    setStyle({
      position: "fixed",
      left,
      top,
      visibility: "visible",
      zIndex: 99999,
      pointerEvents: "none",
      maxWidth: "380px",
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
  const [tip,  setTip]  = useState<TipState>(null);
  const idRef            = useRef(0);

  const showTooltip = useCallback((content: React.ReactNode, e: React.MouseEvent) => {
    setTip({ id: ++idRef.current, content, x: e.clientX, y: e.clientY });
  }, []);

  const hideTooltip = useCallback(() => setTip(null), []);

  return { showTooltip, hideTooltip, TooltipPortal: <TooltipPortal tip={tip} /> };
}

// Standard tooltip card — dark fantasy game aesthetic.
export function tipBox(title: string, body: string, accent = "#8b5cf6"): React.ReactNode {
  return (
    <div style={{
      background: "#12101f",
      border: `1px solid ${accent}55`,
      borderRadius: "8px",
      padding: "calc(9px * var(--tooltip-font-scale, 1)) calc(13px * var(--tooltip-font-scale, 1))",
      fontSize: "calc(0.76rem * var(--tooltip-font-scale, 1))" as React.CSSProperties["fontSize"],
      color: "#e2e8f0",
      lineHeight: 1.55,
      boxShadow: "0 6px 28px rgba(0,0,0,0.85)",
      minWidth: "calc(200px * var(--tooltip-font-scale, 1))" as React.CSSProperties["minWidth"],
      maxWidth: "calc(380px * var(--tooltip-font-scale, 1))" as React.CSSProperties["maxWidth"],
    }}>
      <div style={{ fontWeight: 700, color: accent, marginBottom: "4px", fontSize: "calc(0.8rem * var(--tooltip-font-scale, 1))" as React.CSSProperties["fontSize"] }}>{title}</div>
      <div style={{ color: "#94a3b8" }}>{body}</div>
    </div>
  );
}
