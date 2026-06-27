# DnD Legends — Playtesting & QA Methodology

This document captures how to drive the game end‑to‑end, what to check, and how
to recognize issues **accurately** (real bugs vs. intended behavior). It exists so
any future QA pass — human or agent — can be **thorough, repeatable, and precise**.

The northstar: *every value that can change during play must be correct and reflected
live on every player's view* (see `AGENTS.md` → "Real‑Time Value Accuracy"). Most bugs
are violations of that rule or of D&D 5e math.

---

## 0. TL;DR loop

1. Start the dev server, provision a throwaway test account (no self‑serve signup).
2. Drive the browser with the Playwright MCP tools (snapshot → act → snapshot).
3. Create characters → launch a campaign → play a short arc (creation, combat,
   NPC, loot, rest, level).
4. After **every** state change, read the **party panel** and compare against the
   **expected 5e value**. A mismatch is a bug; record it with evidence.
5. Fix → **retest in the browser** → confirm no regressions in nearby features.

---

## 1. Environment setup

- **Dev server:** `npm run dev` (Next 16 + Turbopack). Wait for `✓ Ready`. Hot‑reload
  (Fast Refresh) applies most edits without losing page state — handy mid‑test, but
  see the HMR gotcha in §6.
- **Env:** `.env.local` must have non‑empty `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `INVITE_SECRET`, `NEXT_PUBLIC_BASE_URL`. (`ELEVENLABS_API_KEY` / `OPENAI_API_KEY`
  only matter for voice.) Verify values are present before driving.
- **There is no self‑serve signup** — `/auth` is login‑only. Provision a confirmed
  test user via the Supabase **service‑role admin API**:

  ```js
  // scripts/make-test-user.mjs  (idempotent: deletes any prior same-email user first)
  import { createClient } from '@supabase/supabase-js';
  const admin = createClient(URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  ```

  No `user_profiles` row or subscription is required — there is **no paywall** gating
  dashboard / character creation / campaign play. `/campaign/[id]` is gated to the
  **owner** only.

- **Multiplayer model:** the product is **couch co‑op** — one screen, one account, a
  character per "seat." To simulate N players, create N characters and launch an
  N‑seat campaign; turn‑passing and party cards exercise the multiplayer paths. (True
  remote multiplayer uses invite links/guest sessions, but the owner‑only gate means
  the couch‑co‑op path is the primary one to test.)

---

## 2. Driving the browser (Playwright MCP)

- Prefer `browser_snapshot` (accessibility tree) over screenshots for **acting** —
  it gives stable `ref` handles. Use `browser_take_screenshot` to **see** layout,
  art, and floating overlays (e.g. the hint arrow) that the tree doesn't convey.
- Refs change after re‑renders. If a `ref` is "not found," re‑snapshot the nearest
  stable parent (`main`, or a panel ref) and read the new child refs.
- Overlays intercept clicks ("…intercepts pointer events"). Dismiss the blocking
  layer first (Begin Adventure splash, Whimsy guide, chat hint).
- After sending an action, the DM streams; **wait** (`browser_wait_for`) ~8–12s, then
  snapshot. Voice **narration** ("Narrating…") can hold the input disabled longer.
- Check `browser_console_messages` (level `error`) after risky steps — surfaces API
  failures (e.g. a `/api/narrate` non‑2xx, a 4xx/5xx resource load).

---

## 3. The gameplay flow (routes)

| Step | Path |
|------|------|
| Landing | `/` |
| Login | `/auth` |
| Character creation | `/create-character` |
| Dashboard / roster | `/dashboard` |
| Create campaign | `/create-campaign` |
| Play | `/campaign/[id]` |

Creation steps: Identity → Class (+skill proficiencies) → Ability Scores
(Roll / Standard Array / Point Buy) → Equipment → Background (optional, AI‑generate
available) → Spells (spellcasters only). Campaign: pick party size → build/import a
character per seat → Launch.

---

## 4. The verification checklist (with EXACT expected values)

This is the heart of accurate issue recognition. For each system, compute the 5e‑
correct value and compare to what the UI shows on **every** affected player's card.

### 4.1 Character creation math
- **HP at level 1** = max(hit die) + CON mod. d12 Barbarian CON 13 → **13**; d10
  Fighter CON 13 → **11**; d8 Cleric CON 12 → **9**.
- **AC** = armor base + capped DEX + shield. Chain Shirt(13)+DEX(+1) = 14; +shield = 16.
  Chain Mail = 16 (no DEX). Hide(12)+DEX(max 2). Armor buttons show the per‑character
  total (includes this character's DEX) — that's intended, not a bug.
- **Cantrips / prepared** counts match class+level. L1 Cleric: 3 cantrips; prepared =
  WIS mod + level (WIS 15 → 3).
- **Class proficiencies** are 5e‑correct: Barbarian = Light/Medium + Shields (NOT
  Heavy); Cleric = Light/Medium + Shields; Fighter = All armor; etc.
- **Standard Array** values are 15/14/13/12/10/8; swaps via +/- are unique‑preserving.
- **Point Buy** starts at 27 pts; cost rises at 14/15.

### 4.2 Combat — the live values to watch on the party card
After each resolved action, the acting **and** non‑acting cards must update:
- **HP**: enemy hit a player → that player's HP **drops by exactly the stated amount**.
  A **miss** changes nothing. A heal raises it (clamped to max). Damage to a *non‑acting*
  player must also land (multi‑target rounds). 0 HP → **Unconscious** status.
- **Spell slots**: a **leveled** cast decrements one slot of that level; a **cantrip**
  decrements **nothing**. Upcasting decrements the chosen level.
- **AC used by the DM** matches the sheet (it announces "= N — hits AC X").
- **Save DC** = 8 + proficiency + casting‑stat mod (L1 Cleric WIS 15 → **DC 12**).
- **Dice dice‑type** matches the weapon/spell: Longsword 1d8, Greataxe 1d12, Guiding
  Bolt 4d6 (no caster mod added), Sacred Flame 1d8. **Crit** = double the damage dice.
- **Enemy cards**: the count and identities tracked should match what the DM narrates
  (3 cultists narrated → 3 cards). Each shows CR / AC.
- **XP**: awarded on a meaningful outcome and **split evenly across alive party
  members** (unconscious/dead members get no share for that instance).
- **Turn order / ownership**: the active card is highlighted "Acting"; the DM addresses
  that character; you cannot act for a character whose turn it isn't.

### 4.3 Rests
- **Long Rest** restores all HP and all spell slots. **Short Rest** restores per‑class
  resources (e.g. Warlock slots, hit‑dice healing).

### 4.4 Persistence & sync
- Characters persist across campaigns (XP/level/gold carry over).
- Stat changes broadcast via Supabase `character_sync` so every client's card matches.
- Reload restores the campaign from the DB (but see §6 resume gotcha).

---

## 5. How values actually flow (so you fix the right layer)

The DM (`src/app/api/chat/route.ts`) narrates **and emits deterministic tags** that the
client (`src/app/campaign/[id]/page.tsx`) parses and applies:

- `[HP:Name:±N]` → HP change for that player (authoritative; the
  `damageRouting` guard rejects mis‑tagged attacker‑as‑victim cases).
- `[CAST:Caster:Spell]` → slot consumption (level looked up; cantrips = level 0 = no
  slot) + concentration classification.
- `[ATK]`, `[GOLD:±N]`, `[LOOT:…]`, `[WEAPON:…]`, `[XP:N]`, `[OBJECTIVE-*]`,
  `[WILDSHAPE:…]`, `[ABILITY:…]`, etc.
- A secondary **AI state‑extractor** (`/api/chat-state`, Haiku) parses the prose as a
  **fallback** for HP / XP / slots / loot when tags are missing. It is the usual
  culprit for "phantom" changes (e.g. it once counted a cantrip as a slot) — the fix is
  to let the **deterministic tag win** and gate the extractor against it.

**Debugging rule of thumb:** if a value is wrong, decide whether (a) the DM failed to
emit the right tag (prompt fix in `chat/route.ts`), (b) the client mis‑applied or
double‑applied a tag/extractor value (`applyStateChange` / the fast‑paths in
`page.tsx`), or (c) the extractor hallucinated (gate it deterministically). Prefer
**deterministic** fixes over prompt‑only ones — LLM tag emission is not 100% reliable,
so the client should be robust to a missing or duplicated signal.

---

## 6. Known gotchas (don't mis‑file these as new bugs)

- **Resume turn desync:** reloading a campaign re‑shows the "Begin Adventure" splash,
  which re‑anchors the acting turn to the **party leader** and can desync from the DM's
  actual turn. For clean combat tests, prefer a **fresh campaign** over resuming a
  half‑finished one.
- **HMR mid‑combat:** editing code hot‑reloads the page in place. State usually
  survives, but XP/slot counters can reflect a **mix** of pre‑ and post‑edit logic for
  the same fight — validate fixes on a **fresh** action, not on accumulated totals.
- **`/api/narrate` skips:** very short / non‑speakable lines return **204 No Content**
  (intended — TTS can't voice them). That's a skip, not an error.
- **Suggested‑action buttons** auto‑send; the green **hint arrow** only belongs on the
  main play screen (hidden during dice/modals; gone for the session once hushed).

---

## 7. Recording an issue (format)

For each finding, capture enough to reproduce and to judge intended‑vs‑bug:

```
Issue: <one line>
Where: <screen / file:line if known>
Repro: <exact steps / action text>
Expected (5e or product rule): <value/behavior + why>
Actual: <value/behavior observed + evidence: party card reading, DM text, console>
Severity: blocker / major / minor / cosmetic
Suspected layer: DM prompt | client tag‑apply | AI extractor | data | UI
```

Severity guide: **blocker** = breaks the core loop or corrupts persistent state
(e.g. damage never applies); **major** = wrong rules math or stale live value;
**minor** = unfair‑but‑playable or rare; **cosmetic** = visual only.

---

## 8. Coverage targets for a "thorough" pass

- Creation: at least one **martial** and one **spellcaster** (exercises the spells
  step, slot tracking, save DCs) — and a third for **3+ party** turn dynamics that a
  duo can't surface (multi‑target enemy rounds, XP split across 3, turn order).
- Combat: melee hit, melee **miss** (verify no HP change), a **crit** (double dice), a
  leveled spell (slot −1), a **cantrip** (slot unchanged), an enemy hit on a
  **non‑acting** player, an enemy defeat (XP split), and a downed PC (no XP share).
- Systems: NPC dialogue, loot (gold + item, exact amounts), Short + Long Rest, a
  level‑up if reachable.
- Always re‑check **nearby** features after a fix (e.g. touching slot logic → re‑verify
  both cantrip and leveled casts; touching HP → verify heals, misses, and downs).

---

## 9. Full‑subsystem sweep (broad QA pass)

A periodic broad pass that goes beyond the golden combat path and exercises **every
subsystem, control, and scale**. Run it after major changes or on request. Provision a
larger roster fast with `scripts/make-test-party.mjs` (varied classes + gold + items),
then build the largest party you want to stress (a **6‑player "Band"** is the sweet spot
for scale dynamics). Drive the live UI for what needs the browser, and **code‑audit** the
subsystems that read better than they click (see §9.4).

### 9.1 Economy & items
- **Inventory:** view each character's sheet; confirm items list, the per‑item **Use /
  Trade / Drop** controls (only on *your* character; hidden when viewing another player).
- **Use:** a consumable (Potion of Healing) rolls its formula, heals, and is removed; a
  non‑consumable prefills a chat action.
- **Trade:** click Trade → "Send to" picker lists the *other* party members → pick one →
  item leaves sender, **appears in recipient's inventory**, both cards sync. Verify both ends.
- **Drop / pick‑up:** dropped items enter a pool another PC can take.
- **Currency:** gold changes via `[GOLD:±N]` and the extractor; gold can't go negative.
  ⚠ Note the sheet shows pp/gp/sp/cp but only **gp** is ever written (the others are
  decorative — confirm they stay 0, don't mistake them for a bug).
- **Item enrichment:** a DM‑invented item gets a tooltip/value via `/api/item-details`.
- ⚠ Item name matching is **case‑sensitive** — watch for an item that fails to leave/trade
  if the DM re‑cases the name.

### 9.2 Scale & volume (the reason to test 6 players)
- **Turn order:** header reads "Turn N of 6"; the DM addresses the acting character; you
  cannot act for a character whose turn it isn't.
- **Party panel:** all 6 cards render and scroll; HP/gold/XP/slots/status correct per card.
- **Enemy volume:** trigger a combat and **count the enemy cards vs the DM's narrated
  count** — they must match (spawning is narration‑faithful). THEN judge whether the
  *count itself* is appropriate for the party size (a 6‑player party facing 3 CR‑1/8 foes
  is badly under‑scaled). Enemy scaling now lives in the **DM's narration**, not the
  spawn formula — so under/over‑scaling is a *prompt* issue, not a spawn bug.
- **XP across N:** an award splits across alive members; large parties level slower
  (split ÷ N) — flag if progression feels off.
- **Performance:** watch for layout jank / slowness with 6 cards + 6 portraits + scene art.

### 9.3 Controls, audio, fonts, UI
- **Audio menu (🎚):** 6 narration voices (preview ▶, volume, off) + background music
  track picker (Tavern/Wilds/Dungeon/Mystical/Castle/Sea/Combat). Toggle and confirm.
- **Narration mute (🔈)** and the dashboard music player.
- **Font scaling (A− / A+):** persisted (`dnd_chat_font_size`, 0.65–1.35). ⚠ Only renders
  when the **chat pane ≥ 420px** (`chatPaneWidth >= 420`) — drag the pane wider to reveal
  it. Note the discoverability cost for couch/TV play.
- **Sidebar tabs:** Party / Character / Story Log all switch and render.
- **Tooltips:** hover stats, class/race labels, mechanic chips → dark‑fantasy tooltip card.
- **Theme toggle** (Tools ⚙, top‑left), **Save & Exit**, **resize dividers**, **Rests**.
- **Console:** keep `browser_console_messages level:error` at **0** the whole pass.

### 9.4 AI calls, images, optimization (code‑audit + observe)
Best audited by reading the routes, then confirming live. Capture **OPT** (optimization)
and **ISSUE** items with file:line — do not fix during a sweep, isolate and report.
- **AI calls per turn:** main DM = `/api/chat` (**Sonnet 4.6**); helpers = `chat-state`,
  `enemies/generate`, `enemies/state`, `suggest-actions`, `generate-background` (**Haiku**);
  TTS = `narrate` (ElevenLabs). Count how many fire per action; flag redundant/ungated ones
  (e.g. `chat-state` running on pure‑narration turns; `enemies/state` running out of combat;
  oversized `max_tokens`).
- **Image gen:** portraits (`generate-portrait`), enemy/NPC portraits, scene/“moment”
  images (`detect-scene`) — all OpenAI `gpt-image-1`, cached by deterministic key in
  Supabase storage. Flag: every‑turn scene classification, missing retry on enemy/NPC
  portraits, missing `width`/`height` (layout shift), fire‑and‑forget portrait gaps.
- **Scaling formulas:** enemy count/CR (`enemies/generate`) and XP curve (`getXpToNextLevel`)
  — sanity‑check for the party size under test.

### 9.5 Isolate‑don't‑fix mode
For a broad sweep the goal is **coverage + an accurate issue list**, not fixes. For each
finding use the §7 format, tag severity, and name the suspected layer. Group by subsystem
in the final report so issues can be triaged and worked one at a time.
