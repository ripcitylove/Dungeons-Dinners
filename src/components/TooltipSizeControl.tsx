"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const STEPS = [1, 1.25, 1.5, 1.75] as const;
const STORAGE_KEY = "dnd_tooltip_font_scale";

const MENU_HIDE_CLASS = "tooltip-size-toolbar";

// Console-style collapsed corner menu — a single trigger expands a slim
// vertical stack on hover/focus. Removes 3 always-visible chips from the
// chrome and matches PC-game tools-corner convention.
export function TooltipSizeControl() {
  const [stepIdx, setStepIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const router   = useRouter();
  const pathname = usePathname();
  const isCampaign = pathname?.startsWith("/campaign/");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    router.push("/dashboard");
  };

  const openMenu  = () => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } setOpen(true); };
  const closeMenu = () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); closeTimerRef.current = setTimeout(() => setOpen(false), 280); };

  if (!mounted || pathname === "/" || pathname === "/auth") return null;

  const isDefault = stepIdx === 0;

  // Trigger: a single small circular icon in the bottom-left.
  // Menu: stacks up from the trigger on hover/focus.
  return (
    <div
      className={MENU_HIDE_CLASS}
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
      onFocus={openMenu}
      onBlur={closeMenu}
      style={{
        position: "fixed",
        left: "16px",
        bottom: "16px",
        zIndex: 9998,
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "flex-start",
        gap: "8px",
        pointerEvents: "none",
      }}
    >
      {/* Trigger — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Tools"
        aria-label="Tools menu"
        aria-expanded={open}
        style={{
          pointerEvents: "auto",
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%), rgba(10, 7, 24, 0.85)",
          backdropFilter: "blur(14px)",
          border: `1px solid ${open ? "rgba(212,169,106,0.7)" : "rgba(255,255,255,0.12)"}`,
          color: open ? "#fde68a" : "#94a3b8",
          fontSize: "1.1rem",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: open
            ? "inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 22px rgba(0,0,0,0.55), 0 0 18px rgba(212,169,106,0.25)"
            : "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.45)",
          transition: "border-color 0.18s, color 0.18s, box-shadow 0.18s, transform 0.18s",
          transform: open ? "translateY(-1px)" : "translateY(0)",
        }}
      >
        ⚙
      </button>

      {/* Expanded menu — slim vertical stack of actions */}
      <div
        style={{
          pointerEvents: open ? "auto" : "none",
          display: "flex",
          flexDirection: "column-reverse",
          gap: "6px",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.18s ease, transform 0.18s ease",
        }}
      >
        {/* Tooltip size control */}
        <button
          onClick={cycle}
          title={`Hover tooltip size: ${STEPS[stepIdx] === 1 ? "default" : `${STEPS[stepIdx]}×`} — click to ${stepIdx < STEPS.length - 1 ? "increase" : "reset"}`}
          tabIndex={open ? 0 : -1}
          style={menuItemStyle(!isDefault)}
        >
          <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>💬</span>
          <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>Tooltip</span>
          <span style={{ display: "flex", gap: "3px" }}>
            {STEPS.map((_, i) => (
              <span key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: i <= stepIdx ? (isDefault ? "#475569" : "#8b5cf6") : "rgba(255,255,255,0.1)", transition: "background 0.2s" }} />
            ))}
          </span>
        </button>

        {/* Back */}
        <button
          onClick={() => router.back()}
          title="Go back"
          tabIndex={open ? 0 : -1}
          style={menuItemStyle(false)}
        >
          <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>←</span>
          <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>Back</span>
        </button>

        {/* Save & return to dashboard — campaign pages only */}
        {isCampaign && (
          <button
            onClick={handleSave}
            disabled={saving}
            title="Save campaign and return to dashboard"
            tabIndex={open ? 0 : -1}
            style={{
              ...menuItemStyle(false, true),
              opacity: saving ? 0.7 : 1,
              color: saving ? "#4ade80" : "#94a3b8",
            }}
          >
            <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>{saving ? "✓" : "💾"}</span>
            <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
              {saving ? "Saving…" : "Save & Exit"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function menuItemStyle(active: boolean, isSave = false): React.CSSProperties {
  const borderColor = isSave
    ? "rgba(34,197,94,0.28)"
    : active ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.1)";
  const color = active ? "#c4b5fd" : "#94a3b8";
  return {
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%), rgba(10, 7, 24, 0.85)",
    backdropFilter: "blur(14px)",
    border: `1px solid ${borderColor}`,
    borderRadius: "999px",
    padding: "8px 14px 8px 12px",
    minHeight: "38px",
    color,
    cursor: "pointer",
    userSelect: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 10px rgba(0,0,0,0.35)",
    transition: "border-color 0.18s, color 0.18s, transform 0.15s",
  };
}
