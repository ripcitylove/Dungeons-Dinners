"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Landing page: excluded by user request.
// Campaign page: excluded because it manages its own rem scaling via fs() helper.
function isExcluded(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/campaign/");
}

export function FontScaleApplier() {
  const pathname = usePathname();

  useEffect(() => {
    if (isExcluded(pathname)) {
      document.documentElement.style.fontSize = "";
      return;
    }
    const saved = parseFloat(localStorage.getItem("dnd_chat_font_size") ?? "");
    const scale = !isNaN(saved) && saved >= 0.65 && saved <= 1.35 ? saved : 0.9;
    // scale/0.9 maps the stored value to a multiplier where 0.9 (default) = 100%
    document.documentElement.style.fontSize = `${(scale / 0.9 * 100).toFixed(2)}%`;
  }, [pathname]);

  return null;
}
