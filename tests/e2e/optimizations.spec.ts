import { test, expect, Page } from "@playwright/test";

/**
 * Live golden-path test for the token-savings changes (#2a on-demand suggestions,
 * #3 history caching restructure, #4 light summarization). Authenticates as the real
 * owner via a service-role-minted session (tokens passed in via env — see
 * scripts/run-opt-e2e.mjs), opens the real 290-message campaign, and:
 *   - asserts suggestions are NOT auto-fetched but ARE fetched on input focus (#2a)
 *   - intercepts the /api/chat call to assert the client sends a WINDOWED payload
 *     (recap + recent ~50, not all 290) (#3/#4), then ABORTS it so the real campaign
 *     is never mutated and no tokens are spent.
 */

const CAMPAIGN_ID = "7026a5d6-77b4-40fa-a57b-b3b6a68d0de7"; // The Pact of Broken Chains (290 msgs)

const session = {
  access_token:  process.env.TEST_ACCESS_TOKEN || "",
  refresh_token: process.env.TEST_REFRESH_TOKEN || "",
};

test.beforeAll(() => {
  if (!session.access_token || !session.refresh_token) {
    throw new Error("Missing TEST_ACCESS_TOKEN / TEST_REFRESH_TOKEN — run via scripts/run-opt-e2e.mjs");
  }
});

async function authAndOpenCampaign(page: Page) {
  // Hand the session to the app via the URL hash; detectSessionInUrl persists it.
  const hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`;
  await page.goto(`/dashboard#${hash}`);
  // Wait until auth settled (dashboard shows authenticated chrome, not the /auth page).
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(2000); // let the client persist the session
  await page.goto(`/campaign/${CAMPAIGN_ID}`);
  // The campaign page redirects to /dashboard if unauthenticated/not owner.
  await page.waitForURL(new RegExp(`/campaign/${CAMPAIGN_ID}`), { timeout: 20000 });
  await page.waitForSelector("[data-chat-input]", { timeout: 30000 });
  // CRITICAL: wait for the full 290-message history to hydrate from the DB into
  // state before interacting — otherwise the client would send only the opening.
  // Recent turns reliably mention these names; their presence proves the
  // transcript loaded (the page auto-scrolls to the latest messages).
  await page.getByText(/Artemis|Cleriss|Minny|champion|sanctum/i).first()
    .waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(1500); // let state settle after render
}

test("#NPC — restored companions load from the DB and SURVIVE a location change", async ({ page }) => {
  test.setTimeout(120000);
  // Mock NPC portrait generation so cards render instantly (a card only shows once
  // it has a portrait_url) without real image-gen.
  await page.route("**/api/generate-npc-portrait", async route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ portraitUrl: "https://placehold.co/200x200/png" }) }));
  // Block all Supabase REST writes so the real campaign roster is never mutated.
  await page.route("**/rest/v1/**", async route =>
    route.request().method() === "GET" ? route.continue() : route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  await authAndOpenCampaign(page);

  // 1) The DB-restored companions render (proves campaigns.npcs load + portrait flow).
  await expect(page.locator('img[alt="Sera"]').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('img[alt="Daveth"]').first()).toBeVisible({ timeout: 30000 });

  const input = page.locator("[data-chat-input]");
  if (!(await input.isEnabled().catch(() => false))) { test.skip(true, "input disabled — cannot drive a turn"); return; }

  // 2) Simulate a LOCATION CHANGE: detect-scene reports moved=true, and the DM
  // response does NOT re-emit Sera/Daveth (it introduces a new scene NPC). Before
  // the fix this dropped the companions; now they must persist.
  await page.route("**/api/chat-state", async route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/summarize-history", async route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ summary: "recap" }) }));
  await page.route("**/api/detect-scene", async route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sceneName: "mountain", imageUrl: null, momentImageUrl: null, sceneType: "mountain", modifiers: [], description: "", shouldChange: true, moved: true }) }));
  await page.route("**/api/chat", async route =>
    route.fulfill({ status: 200, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Three days of hard travel bring you to the Obsidian Tower's frozen gate. [NPC:Gate Sentinel:a frost-rimed guardian in black iron] What do you do?" }));

  await input.fill("We travel north to the tower.");
  await input.press("Enter");
  await page.waitForTimeout(8000); // process response + scene-reset

  // Companions kept across the move; the new scene NPC appears.
  await expect(page.locator('img[alt="Sera"]').first(), "Sera (companion) must survive the move").toBeVisible();
  await expect(page.locator('img[alt="Daveth"]').first(), "Daveth (companion) must survive the move").toBeVisible();
  await expect(page.locator('img[alt="Gate Sentinel"]').first(), "new scene NPC should appear").toBeVisible({ timeout: 15000 });
});

test("#2a — suggestions appear (auto on your turn / on focus) and don't refetch-spam", async ({ page }) => {
  test.setTimeout(120000);
  let suggestCalls = 0;
  page.on("request", req => { if (req.url().includes("/api/suggest-actions")) suggestCalls++; });

  await authAndOpenCampaign(page);

  const input = page.locator("[data-chat-input]");
  const enabled = await input.isEnabled().catch(() => false);
  test.skip(!enabled, "Chat input disabled (not this player's turn)");

  // Suggestions should be fetched for the current prompt — either auto-surfaced
  // after narration on your turn, or via the on-focus fallback. Poll (focusing as a
  // backstop) until one lands.
  await expect.poll(async () => {
    await input.blur().catch(() => {});
    await input.focus();
    await page.waitForTimeout(2500);
    return suggestCalls;
  }, { timeout: 40000, intervals: [3000], message: "suggestions should be fetched (auto or on focus)" }).toBeGreaterThan(0);

  // Per-DM-message guard: once fetched for the current prompt, repeated focus/idle
  // must NOT keep refetching it — that's the per-turn cost we reconciled away.
  const afterFirst = suggestCalls;
  for (let i = 0; i < 3; i++) { await input.blur().catch(() => {}); await input.focus(); await page.waitForTimeout(1500); }
  console.log(`suggest-actions calls: first=${afterFirst}, after repeated focus=${suggestCalls}`);
  expect(suggestCalls - afterFirst, "repeated focus must not refetch the same prompt (per-message guard)").toBeLessThanOrEqual(1);
});

test("#3/#4 — DM call sends a WINDOWED payload (recap + recent), not the full 290-message history", async ({ page }) => {
  test.setTimeout(120000);
  await authAndOpenCampaign(page);

  const input = page.locator("[data-chat-input]");
  const enabled = await input.isEnabled().catch(() => false);
  test.skip(!enabled, "Chat input disabled (not this player's turn) — cannot send a turn");

  // Intercept the DM call: capture the payload, then ABORT so nothing reaches the
  // server (no campaign mutation, no token cost).
  let chatBody: any = null;
  await page.route("**/api/chat", async route => {
    try { chatBody = JSON.parse(route.request().postData() || "{}"); } catch { /* ignore */ }
    await route.abort();
  });
  // Also stub summarize-history so the recap step is instant and free.
  await page.route("**/api/summarize-history", async route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ summary: "TEST RECAP: the party pursued the Broken Chain cult through the monastery." }) }));

  await input.fill("I take a quiet look around the chamber.");
  await input.press("Enter");
  await expect.poll(() => chatBody, { timeout: 20000, message: "captured /api/chat payload" }).not.toBeNull();

  const msgs = chatBody.messages as { role: string; content: string }[];
  console.log(`/api/chat payload messages: ${msgs.length} (campaign has 290 stored)`);
  console.log(`first message starts: ${JSON.stringify(msgs[0].content.slice(0, 60))}`);

  // #4: windowed — far fewer than the 290 stored messages, and a recap leads.
  expect(msgs.length, "payload should be windowed, not full history").toBeLessThan(120);
  expect(msgs[0].content, "first message should be the STORY SO FAR recap").toContain("STORY SO FAR");
  // The current action must be present as the last message.
  expect(msgs[msgs.length - 1].content).toContain("quiet look around");
});

/**
 * #2c — scene-classifier skip. The client should call /api/detect-scene after a
 * normal DM turn, but SKIP it when the DM response is a [NO-TURN] refusal (no scene
 * change / story moment is possible). We force the DM response via interception and
 * block every Supabase REST write so the real campaign is never mutated.
 */
// Unique marker embedded in the faked DM response. The send-path scene call
// (page.tsx:5674) passes `narrative: full` — i.e. THIS response — so we count only
// detect-scene calls whose narrative carries the marker. That isolates the call
// THIS turn triggers from unrelated baseline scene calls (load restore, resume
// re-detection) that carry a historical narrative.
const SCENE_MARKER = "SCENEPROBE7X";

async function sendActionAndCountSceneCalls(page: Page, dmBody: string): Promise<number> {
  // Block all Supabase REST writes (keep GET reads) — no message/turn-state mutation.
  await page.route("**/rest/v1/**", async route =>
    route.request().method() === "GET"
      ? route.continue()
      : route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  let myTurnSceneCalls = 0;
  await page.route("**/api/detect-scene", async route => {
    try { if ((JSON.parse(route.request().postData() || "{}").narrative || "").includes(SCENE_MARKER)) myTurnSceneCalls++; } catch { /* */ }
    await route.abort();
  });
  // Cheap/free no-op for the other post-turn helper so it can't interfere.
  await page.route("**/api/chat-state", async route =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  // Force the DM response content (this is what the scene gate inspects).
  await page.route("**/api/chat", async route =>
    route.fulfill({ status: 200, headers: { "content-type": "text/plain; charset=utf-8" }, body: dmBody }));

  const input = page.locator("[data-chat-input]");
  await expect(input).toBeEnabled({ timeout: 15000 });
  await input.fill("I look around the chamber carefully.");
  await input.press("Enter");
  await page.waitForTimeout(8000); // process the streamed response + the scene-gate decision
  return myTurnSceneCalls;
}

test("#2c — a normal DM response DOES call the scene classifier (control)", async ({ page }) => {
  test.setTimeout(120000);
  await authAndOpenCampaign(page);
  await page.waitForTimeout(3000); // let load-time scene detection settle before intercepting
  const calls = await sendActionAndCountSceneCalls(page,
    `You step deeper into the sanctum. ${SCENE_MARKER} Cold blue light spills from a cracked archway ahead and the air turns frigid. What do you do, Artemis?`);
  console.log(`my-turn scene calls after NORMAL response: ${calls}`);
  expect(calls, "a normal DM response should trigger scene detection").toBeGreaterThan(0);
});

test("#2c — a [NO-TURN] DM response SKIPS the scene classifier", async ({ page }) => {
  test.setTimeout(120000);
  await authAndOpenCampaign(page);
  await page.waitForTimeout(3000);
  const calls = await sendActionAndCountSceneCalls(page,
    `[NO-TURN] ${SCENE_MARKER} That isn't possible right now — the sealed door won't budge no matter how hard you try.`);
  console.log(`my-turn scene calls after [NO-TURN] response: ${calls}`);
  expect(calls, "a [NO-TURN] response must NOT trigger scene detection").toBe(0);
});
