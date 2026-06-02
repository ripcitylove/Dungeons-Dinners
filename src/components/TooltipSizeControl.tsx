"use client";
import { useState, useEffect } from "react";

const STEPS = [1, 1.25, 1.5, 1.75] as const;
const STORAGE_KEY = "dnd_tooltip_font_scale";

export function TooltipSizeControl() {
  const [stepIdx, setStepIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = parseFloat(localStorage.getItem(STORAGE_KEY) ?? "");
    const idx = STEPS.findIndex(s => s === saved);
    const initial = idx >= 0 ? idx : 0;
    setStepIdx(initial);
    document.documentElement.style.setProperty("--tooltip-font-scale", String(STEPS[initial]));
    setMounted(true);
  }, []);

  const cycle = () => {
    const next = (stepIdx + 1) % STEPS.length;
    setStepIdx(next);
    const scale = STEPS[next];
    document.documentElement.style.setProperty("--tooltip-font-scale", String(scale));
    localStorage.setItem(STORAGE_KEY, String(scale));
  };

  if (!mounted) return null;

  const isDefault = stepIdx === 0;

  return (
    <button
      onClick={cycle}
      title={`Hover tooltip size: ${STEPS[stepIdx] === 1 ? "default" : `${STEPS[stepIdx]}×`} — click to ${stepIdx < STEPS.length - 1 ? "increase" : "reset to default"}`}
      style={{
        position: "fixed",
        top: "12px",
        left: "12px",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        gap: "5px",
        background: "rgba(10, 7, 24, 0.88)",
        backdropFilter: "blur(14px)",
        border: `1px solid ${isDefault ? "rgba(255,255,255,0.08)" : "rgba(139,92,246,0.45)"}`,
        borderRadius: "100px",
        padding: "5px 10px 5px 8px",
        color: isDefault ? "#475569" : "#c4b5fd",
        cursor: "pointer",
        userSelect: "none",
        transition: "border-color 0.2s, color 0.2s, box-shadow 0.2s",
        boxShadow: isDefault ? "0 2px 12px rgba(0,0,0,0.4)" : "0 0 12px rgba(139,92,246,0.2)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)";
        e.currentTarget.style.color = "#e2e8f0";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isDefault ? "rgba(255,255,255,0.08)" : "rgba(139,92,246,0.45)";
        e.currentTarget.style.color = isDefault ? "#475569" : "#c4b5fd";
      }}
    >
      {/* Tooltip bubble icon */}
      <span style={{ fontSize: "0.75rem", lineHeight: 1 }}>💬</span>
      {/* Label */}
      <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
        Tooltip
      </span>
      {/* Step dots */}
      <span style={{ display: "flex", gap: "2px", marginLeft: "1px" }}>
        {STEPS.map((_, i) => (
          <span
            key={i}
            style={{
              width: "4px", height: "4px", borderRadius: "50%",
              background: i <= stepIdx
                ? (isDefault ? "#475569" : "#8b5cf6")
                : "rgba(255,255,255,0.1)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </span>
    </button>
  );
}
