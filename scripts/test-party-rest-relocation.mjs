// Static regression test: party-wide rest buttons live at the top of the Party
// window, are gated by D&D rest rules (no combat, no pending roll, DM not busy),
// and the old Party Leader rest panel is gone.

import { readFileSync } from "node:fs";

const src = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── Old "Party Rest" panel under Manage Party section is removed ─────────────
check(
  "old Party-Leader rest panel removed",
  !/Party Rest<\/p>/.test(src) && !/always visible to party leader/.test(src),
  "old block still in the Manage Party section",
);

// ── New rest panel sits at the top of the Party tab ──────────────────────────
const partyTabStart = src.indexOf('sidebarTab === "party"');
const partyTabEnd   = src.indexOf('sidebarTab === "sheet"', partyTabStart);
check(
  "party tab block found",
  partyTabStart > 0 && partyTabEnd > partyTabStart,
);
const partyBlock = src.slice(partyTabStart, partyTabEnd);

const shortRestIdx = partyBlock.indexOf("🌙 Short Rest");
const longRestIdx  = partyBlock.indexOf("☀️ Long Rest");
const playerCardsIdx = partyBlock.indexOf("Player cards");
check(
  "short rest button inside party tab",
  shortRestIdx > 0,
);
check(
  "long rest button inside party tab",
  longRestIdx > 0,
);
check(
  "rest buttons placed ABOVE the player cards",
  shortRestIdx > 0 && longRestIdx > 0 && playerCardsIdx > 0 && shortRestIdx < playerCardsIdx && longRestIdx < playerCardsIdx,
  `short@${shortRestIdx} long@${longRestIdx} cards@${playerCardsIdx}`,
);

// ── D&D rules gating ─────────────────────────────────────────────────────────
check(
  "rest disabled when combat is active",
  /restInCombat\s*=\s*combatActive\s*&&\s*enemies\.some/.test(partyBlock),
  "combat gate missing",
);
check(
  "rest disabled while DM is mid-response (isTyping or narrating)",
  /restDmBusy\s*=\s*isTyping\s*\|\|\s*narrating/.test(partyBlock),
);
check(
  "rest disabled while a dice roll is pending",
  /restRollPending\s*=\s*!!rollRequestedUserId/.test(partyBlock),
);
check(
  "buttons receive disabled={restDisabled}",
  (partyBlock.match(/disabled=\{restDisabled\}/g) || []).length >= 2,
  "expected two disabled bindings (short + long rest)",
);
check(
  "buttons reveal a reason when disabled",
  /restDisabledReason/.test(partyBlock) && /Cannot rest during combat/.test(partyBlock),
);
check(
  "click handler is suppressed when disabled (onClick={restDisabled ? undefined : …})",
  /onClick=\{restDisabled \? undefined : handlePartyShortRest\}/.test(partyBlock)
  && /onClick=\{restDisabled \? undefined : handlePartyLongRest\}/.test(partyBlock),
);

// ── Handlers themselves are untouched (rest LOGIC didn't change) ─────────────
check(
  "handlePartyShortRest still defined",
  /const handlePartyShortRest = useCallback/.test(src),
);
check(
  "handlePartyLongRest still defined",
  /const handlePartyLongRest = useCallback/.test(src),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
