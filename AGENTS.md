<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Existing-Campaign Parity (PARAMOUNT — Non-Negotiable)

Every change MUST take full effect on EXISTING, SAVED, in-progress campaigns — not only on newly created ones. This is the highest-priority correctness rule for this game: **a fix that only works for new campaigns is NOT a fix.** The player must NEVER have to take any action (re-trigger the event, re-engage, manually reload-and-regenerate, start over) to receive a fix.

- **Backfill is part of the change.** When a fix alters how a value is produced (new data shape, newly generated/persisted value, new tag/format), it does NOTHING for rows already written for existing campaigns. The change is INCOMPLETE until those existing rows are corrected. In the SAME unit of work, write and run a migration/backfill that fixes the already-saved data across all affected campaigns. Persisted per-campaign data includes: `campaign_enemies` (incl. portrait_url), `campaign_characters`, `campaign_messages`, NPC rosters, objectives, inventory, scene/portrait URLs, turn state.
- **Verify against a REAL existing campaign, not a fresh QA one.** Never declare a fix done after testing only a freshly-created test campaign — that hides exactly this class of bug. Inspect the actual saved campaigns' data (Supabase, via service role) BEFORE and AFTER; confirm the specific affected rows in real campaigns are fixed. Quote the before/after row state when reporting.
- **Durable over ephemeral.** Anything every player must see (enemy/NPC cards, portraits, stats) must live in shared storage (DB) and sync via broadcast — never per-device/per-client ephemeral state, which silently fails for peers and on reload. If a value is generated client-side, persist it so reloads and other players get it without regenerating.
- This rule outranks brevity and speed. If satisfying it requires a backfill script run against production data, that is expected and required — not optional.

# Qualifying Questions Before Changes (Non-Negotiable)

When the user asks for an update or change to something, and you have any questions or need more context to do the job well, ask exactly **3 qualifying questions** before starting the work. These questions should be the ones whose answers most improve the result — scope, intent, edge cases, affected surfaces, or trade-offs.

- If you genuinely understand the ask and have no real questions, do NOT manufacture questions — just complete the work.
- Only ask when the questions are real and would change what you build. Don't ask about things you can verify yourself in the codebase or resolve with a sensible default.
- This applies to change/update requests. It does not require interrogating trivial or fully-specified asks.

# Real-Time Value Accuracy (Non-Negotiable)

All values that change during gameplay — HP, gold, XP, level, spell slots, status effects, inventory — must be calculated correctly and reflected in the UI immediately when they change. This applies to every player's view, not just the acting player.

- Use Supabase Realtime broadcast to push stat changes to all clients the moment they occur.
- The `character_sync` broadcast event is the canonical channel for syncing all character stats to party cards.
- Never show stale values. If a value can change, it must be wired to live state.
- Party cards must display: HP, gold, XP progress, spell slots (spellcasting classes), and status effects — all kept current in real time.

# Change Safety (Non-Negotiable)

Every change must be clean, correct, and isolated — it must not break or negatively impact any already-working feature.

- Never fix a bug in a way that could create other issues or create new bugs. Always test and re-test fixes to ensure integrity is upheld and fixes are solid.
- Before implementing any change, identify all features that share code or state with the area being modified and verify they still work after the change.
- If a proposed implementation would impact or break an existing feature, stop. Explain what the conflict is and why it exists. Ask for explicit confirmation before proceeding.
- If there is an alternative approach that satisfies the request without affecting other features, that alternative is always the preferred path. Only take the impactful route if the user confirms it after being fully informed.
- "It compiles" is not "it works." Verify behavior in the browser across all affected surfaces before reporting a change as complete.

# Testing Before Pushing (Non-Negotiable)

Every change must be tested before pushing to live. This is not optional.

- Start the dev server (`npm run dev`) and open the affected page in a browser.
- Exercise the golden path of the changed feature — confirm it works exactly as requested.
- Check for regressions in nearby features (e.g. if you touch the sidebar, verify chat, party cards, and sheet tabs still function).
- Only after confirming the feature works correctly in the browser, report it as complete and offer to push.
- Never claim a feature is working based solely on a successful build or TypeScript check — those verify correctness of code, not correctness of behavior.

# Push vs. Deploy Vocabulary (Non-Negotiable)

This project auto-deploys: a push to the `main` branch triggers a Vercel **production** deploy (the live site). A push to any other branch does **not** touch production. The user works across two machines and needs to back up / sync code to GitHub without going live. Honor this exact vocabulary:

- **"push to git"** (or "push", "back up", "sync", "save to github") → commit and push to a **non-`main`** branch (`dev` by default). This updates GitHub only. **Never let this reach production.** Do NOT push to `main`.
- **"push to live"** (or any phrasing where **"live"** is the operative word — "go live", "push live", "deploy to live") → promote to **`main`** so it deploys to production. Use the canonical deploy path (`scripts/deploy.mjs` / `DEPLOY.md`), which build-gates first.
- When "live" is absent from the instruction, assume GitHub-only. **Production is only ever touched when the user explicitly uses "live" (or an unmistakable synonym like "deploy to production" / "ship to prod").** If a push instruction is ambiguous about production, default to GitHub-only and ask before deploying.
- This does not override the standing rule that nothing is pushed at all unless the user explicitly asks.

# Site-Wide Tooltip Standard

Every interactive element — buttons, stats, class/race labels, spell slots, rest actions, skill chips, turn controls — must have a hover tooltip so new players understand what everything is and does.

## How to add tooltips

**Hook (client components):**
```tsx
import { useTooltip, tipBox } from "../../hooks/useTooltip";
const { showTooltip, hideTooltip, TooltipPortal } = useTooltip();
// Add {TooltipPortal} somewhere in the JSX return
```

**Data library** — never write D&D descriptions inline. Import from `src/lib/tooltipData.ts`:
- `STAT_TIPS[label]` — STR/DEX/CON/INT/WIS/CHA descriptions
- `RACE_TIPS[race]` — racial abilities and bonuses
- `CLASS_TIPS[cls]` — class role, hit die, primary stat, abilities
- `SKILL_TIPS[skill]` — skill checks and governing ability
- `MECHANIC_TIPS.HP / .AC / .GOLD / .XP / .SPELL_SLOTS / .SHORT_REST / .LONG_REST / .PASS_TURN / .INITIATIVE / .CR / .HIT_DIE / .CANTRIP / .PREPARED_SPELL / .LEVEL / .ATTUNEMENT / .CURSED / ...`
- `ALIGNMENT_TIPS[key]` — alignment descriptions (string, not TipEntry)
- `STAT_METHOD_TIPS.roll / .array / .pointbuy`
- `CONDITION_TIPS[condition]` — status effect descriptions (string, not TipEntry)
- `PROF_TIPS.saves / .armor / .weapons` — proficiency category descriptions
- `WEAPON_TIPS[weapon]` — weapon stats, damage dice, and usage notes
- `ENEMY_CONDITION_TIPS[label]` — enemy health state descriptions (Healthy/Wounded/Bloodied/Critical/Defeated)
- `DICE_TIPS[die]` — d4/d6/d8/d10/d12/d20/d100 explanations

**Coverage rule** — every D&D term a new player might not understand needs a tooltip: races, classes, alignments, proficiency labels, weapon names, spell headers (Cantrips, Prepared Spells), enemy stats (CR, AC, ATK), condition badges, stat methods, skill chips, rest buttons, and game mechanic labels. Add new entries to `tooltipData.ts` rather than writing descriptions inline in components.

**Wire a tooltip:**
```tsx
onMouseEnter={e => { const t = STAT_TIPS[label]; if (t) showTooltip(tipBox(t.title, t.body), e); }}
onMouseLeave={hideTooltip}
```

**`tipBox(title, body, accent?)`** renders the standard dark-fantasy tooltip card. Pass an accent color to match the element's theme.

**campaign/[id]/page.tsx** already has its own `showTooltip`/`hideTooltip` at the component level (uses `globalTooltip` state). Do NOT add `useTooltip()` there — just call the existing `showTooltip`/`hideTooltip` directly and import `tipBox` and the needed data maps.

## Tooltip placement rules
- Tooltips render via portal at `document.body` — they are always above all stacking contexts.
- `pointerEvents: none` on the tooltip div prevents it from blocking clicks.
- Tooltips are automatically hidden when `dmBusy` activates (the `dmBusy` effect in the campaign page calls `hideTooltip()`).
- Do not add tooltips inside elements that already have `pointerEvents: none` (e.g., the `dmBusy` lock wrapper) — the events won't fire.

# Product Northstar

DnD Legends is a multiplayer D&D 5e experience where **every user is a player** and **the AI is the Dungeon Master**.

- There is no human DM role. The AI runs the world: enemies, NPCs, encounters, loot, story.
- Every person at the table plays a character. No one sits out to manage the game.
- Do not build DM-control UIs (enemy spawners, encounter editors, stat overrides). The AI handles all of that autonomously.
- Features should serve the players: character creation, inventory, spells, party coordination, and immersive narrative.
- The AI DM should follow D&D 5e rules faithfully and make encounters feel earned, dangerous, and rewarding.
