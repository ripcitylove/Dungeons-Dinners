"use client";
import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";

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
          <div style={{ position: "fixed", left: tip.x, top: tip.y - 14, transform: "translate(-50%, -100%)", zIndex: 99999, pointerEvents: "none", maxWidth: "280px" }}>
            {tip.content}
          </div>,
          document.body
        )
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
      padding: "9px 13px",
      fontSize: "0.76rem",
      color: "#e2e8f0",
      lineHeight: 1.55,
      boxShadow: "0 6px 28px rgba(0,0,0,0.85)",
      minWidth: "160px",
      maxWidth: "260px",
    }}>
      <div style={{ fontWeight: 700, color: accent, marginBottom: "4px", fontSize: "0.8rem" }}>{title}</div>
      <div style={{ color: "#94a3b8" }}>{body}</div>
    </div>
  );
}
