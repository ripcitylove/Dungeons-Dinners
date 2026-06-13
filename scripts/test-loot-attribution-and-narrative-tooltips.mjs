// Regression tests for:
//   1. Loot lands on the correct character even after the turn advances
//      (applyStateChange now resolves the target from target_name → actor →
//      local-user fallback, instead of blindly using characterRef.current).
//   2. DM narrative renders item names with rarity tooltips (ColorizedText
//      accepts a knownItems prop; the catalog + DM-awarded item_meta + tooltipData
//      entries get scanned and tinted on hover).

import { readFileSync } from "node:fs";

const page  = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");
const loot  = readFileSync("src/lib/lootData.ts", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── Fix 1: target resolution in applyStateChange ─────────────────────────────
const applyFn = page.match(/const applyStateChange = useCallback[\s\S]*?\}, \[charWrite, charNameMatches\]\);/);
check("applyStateChange function exists", !!applyFn);
if (applyFn) {
  const body = applyFn[0];
  check(
    "target resolved from change.target_name first",
    /if \(change\.target_name\)/.test(body) && /campaignPartyRef\.current\.find/.test(body),
    "target_name lookup against the party not found",
  );
  check(
    "falls back to prevActingCharIdRef when no target_name",
    /prevActingCharIdRef\.current/.test(body) && /campaignPartyRef\.current\.find\(c => c\.id === prevActingCharIdRef\.current\)/.test(body),
  );
  check(
    "still falls back to characterRef.current as last resort",
    /if \(!char\) char = characterRef\.current/.test(body),
  );
  check(
    "setCharacter only fires when target IS the local user's character",
    /if \(char\.id === characterRef\.current\?\.id\)\s*\{[\s\S]*?setCharacter\(updatedChar\)/.test(body),
    "missing local-user gate around setCharacter — would hijack identity",
  );
  check(
    "campaignPartyRef is kept in sync alongside the setState",
    /campaignPartyRef\.current = campaignPartyRef\.current\.map/.test(body),
  );
  // The enrichment branch (item-details) used to read characterRef.current — verify
  // it now reads from the party to find the recipient.
  check(
    "enrichment branch reads recipient from campaignPartyRef",
    /const recipient = campaignPartyRef\.current\.find\(c => c\.id === char\.id\)/.test(body),
    "item enrichment will silently drop when target ≠ local user",
  );
}

// ── Fix 2: narrative tooltips for items ──────────────────────────────────────
check(
  "lootData exports getAllCatalogItems",
  /export function getAllCatalogItems/.test(loot),
);
check(
  "page.tsx imports getAllCatalogItems",
  /getAllCatalogItems/.test(page) && /from "\.\.\/\.\.\/\.\.\/lib\/lootData"/.test(page),
);
check(
  "ColorizedText accepts a knownItems prop",
  /knownItems\?\: KnownItem\[\]/.test(page) && /const sortedItems = \[\.\.\.knownItems\]\.sort/.test(page),
);
check(
  "ColorizedText resolves nodeTooltip on hover",
  /seg\.nodeTooltip && onShowTooltip/.test(page),
);
check(
  "knownItemsForNarrative useMemo present",
  /const knownItemsForNarrative = useMemo<KnownItem\[\]>/.test(page),
);
check(
  "DM message render passes knownItems",
  /<ColorizedText[^>]*knownItems=\{knownItemsForNarrative\}/.test(page),
);
check(
  "longer item names match before shorter ones (no 'Ring' eating 'Ring of Protection')",
  /sort\(\(a, b\) => b\.name\.length - a\.name\.length\)/.test(page),
);
check(
  "catalog entries contribute description + effects + rarity label",
  /RARITY_LABELS\[item\.rarity\]/.test(page) && /item\.effects\.map/.test(page),
);
check(
  "DM-awarded items_meta entries get tooltips with gp value",
  /info\.value_gp/.test(page) && /An item awarded by the Dungeon Master/.test(page),
);
check(
  "WEAPON_TIPS and ITEM_TIPS fallbacks included",
  /for \(const \[name, tip\] of Object\.entries\(WEAPON_TIPS\)\)/.test(page)
  && /for \(const \[name, tip\] of Object\.entries\(ITEM_TIPS\)\)/.test(page),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
