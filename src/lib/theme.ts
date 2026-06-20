// Single source of truth for the light/dark theme so ONE settings control (the
// global Tools menu) can drive the theme everywhere. Pages keep their own
// `data-theme` on their root element (the scoped CSS needs it there) but subscribe
// to changes via `onThemeChange` instead of each owning a separate toggle.

export type Theme = "dark" | "light";

const KEY = "dnd_theme";
export const THEME_EVENT = "dnd-theme-change";

export function getTheme(): Theme {
  try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}

/** Persist + broadcast a theme change so every listening surface updates live. */
export function setThemeGlobal(t: Theme) {
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: t })); } catch { /* ignore */ }
}

/** Subscribe to theme changes (in-tab custom event + cross-tab storage event).
 *  Returns an unsubscribe function. */
export function onThemeChange(cb: (t: Theme) => void): () => void {
  const onCustom  = (e: Event) => cb(((e as CustomEvent).detail as Theme) ?? getTheme());
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(getTheme()); };
  window.addEventListener(THEME_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
