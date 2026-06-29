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
    .waitFor({ state: "visible", timeout: 45000 });
  await page.waitForTimeout(1500); // let state settle after render
}

test("#2a — suggestions are on-demand: not auto-fetched, fetched on input focus", async ({ page }) => {
  test.setTimeout(120000);
  let suggestCalls = 0;
  page.on("request", req => { if (req.url().includes("/api/suggest-actions")) suggestCalls++; });

  await authAndOpenCampaign(page);
  await page.waitForTimeout(3000); // give any (old) auto-fetch a chance to fire

  const autoCalls = suggestCalls;
  expect(autoCalls, "should NOT auto-fetch suggestions before focus").toBe(0);

  const input = page.locator("[data-chat-input]");
  const enabled = await input.isEnabled().catch(() => false);
  test.skip(!enabled, "Chat input disabled (not this player's turn) — focus path can't be exercised");

  // sessionStarted flips true only once the campaign finishes loading (a 28s
  // fallback covers headless, where audio/scene never signal). Poll the focus path
  // until that gate opens and the on-demand fetch fires.
  await expect.poll(async () => {
    await input.blur().catch(() => {});
    await input.focus();
    await page.waitForTimeout(2500);
    return suggestCalls;
  }, { timeout: 40000, intervals: [3000], message: "on-focus should fetch suggestions once loaded" }).toBeGreaterThan(0);

  console.log(`suggest-actions calls — before focus: ${autoCalls}, after focus: ${suggestCalls}`);
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
