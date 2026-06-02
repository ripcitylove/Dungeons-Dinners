"use client";
import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";

const MAX_W  = 280;  // matches the maxWidth on the portal div
const EST_H  = 110;  // estimated typical tipBox height — used only for above/below flip
const MARGIN = 8;

type TipState = { content: React.ReactNode; x: number; y: number } | null;

export function useTooltip() {
  const [tip, setTip] = useState<TipState>(null);

  const showTooltip = useCallback((content: React.ReactNode, e: React.MouseEvent) => {
    setTip({ content, x: e.clientX, y: e.clientY });
  }, []);

  const hideTooltip = useCallback(() => setTip(null), []);

  const TooltipPortal: React.ReactNode =
    tip != null && typeof window !== "undefined"
      ? createPortal(
          (() => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // Horizontal: center on cursor, clamped so the box stays in viewport
            const left = Math.max(MARGIN, Math.min(tip.x - MAX_W / 2, vw - MAX_W - MARGIN));

            // Vertical: show above cursor; flip below if too close to top
            const aboveCursor = tip.y - 14 > EST_H + MARGIN;
            const top = aboveCursor
              ? Math.min(tip.y - 14, vh - EST_H - MARGIN)
              : Math.min(tip.y + 22, vh - EST_H - MARGIN);

            return (
              <div style={{
                position: "fixed",
                left,
                top,
                transform: aboveCursor ? "translateY(-100%)" : "none",
                zIndex: 99999,
                pointerEvents: "none",
                maxWidth: `${MAX_W}px`,
              }}>
                {tip.content}
              </div>
            );
          })()
        , document.body)
      : null;

  return { showTooltip, hideTooltip, TooltipPortal };
}

// Standard tooltip box — matches the dark fantasy game aesthetic
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
      minWidth: "calc(160px * var(--tooltip-font-scale, 1))" as React.CSSProperties["minWidth"],
      maxWidth: "calc(260px * var(--tooltip-font-scale, 1))" as React.CSSProperties["maxWidth"],
    }}>
      <div style={{ fontWeight: 700, color: accent, marginBottom: "4px", fontSize: "calc(0.8rem * var(--tooltip-font-scale, 1))" as React.CSSProperties["fontSize"] }}>{title}</div>
      <div style={{ color: "#94a3b8" }}>{body}</div>
    </div>
  );
}
