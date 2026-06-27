"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getFontScale, onFontScaleChange, FONT_DEFAULT } from "../lib/fontScale";

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
    // scale/default maps the stored value to a multiplier where the default = 100%.
    const apply = (scale: number) => {
      document.documentElement.style.fontSize = `${(scale / FONT_DEFAULT * 100).toFixed(2)}%`;
    };
    apply(getFontScale());
    // React live to the global Tools-menu "Text Size" control.
    return onFontScaleChange(apply);
  }, [pathname]);

  return null;
}
