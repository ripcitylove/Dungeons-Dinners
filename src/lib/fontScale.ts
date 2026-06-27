// Single source of truth for the reading font size so ONE control isn't the only
// way to change it. The campaign page has inline A−/A+ buttons (which hide on a
// narrow chat pane), and the global Tools menu has an always-visible "Text Size"
// item — both drive this module, and every surface subscribes so the change is
// applied live everywhere instead of only on next mount.

export const FONT_KEY = "dnd_chat_font_size";
export const FONT_EVENT = "dnd-font-scale-change";
export const FONT_MIN = 0.65;
export const FONT_MAX = 1.35;
export const FONT_DEFAULT = 0.9;
export const FONT_STEP = 0.05;

const clamp = (n: number) => Math.min(FONT_MAX, Math.max(FONT_MIN, n));

/** Current font scale (rem multiplier baseline); falls back to the default. */
export function getFontScale(): number {
  try {
    const saved = parseFloat(localStorage.getItem(FONT_KEY) ?? "");
    return !isNaN(saved) ? clamp(saved) : FONT_DEFAULT;
  } catch { return FONT_DEFAULT; }
}

/** Persist + broadcast a font-scale change so every listening surface updates live. */
export function setFontScaleGlobal(n: number): number {
  const v = parseFloat(clamp(n).toFixed(2));
  try { localStorage.setItem(FONT_KEY, String(v)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(FONT_EVENT, { detail: v })); } catch { /* ignore */ }
  return v;
}

/** Subscribe to font-scale changes (in-tab custom event + cross-tab storage event).
 *  Returns an unsubscribe function. */
export function onFontScaleChange(cb: (n: number) => void): () => void {
  const onCustom  = (e: Event) => cb(((e as CustomEvent).detail as number) ?? getFontScale());
  const onStorage = (e: StorageEvent) => { if (e.key === FONT_KEY) cb(getFontScale()); };
  window.addEventListener(FONT_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FONT_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
