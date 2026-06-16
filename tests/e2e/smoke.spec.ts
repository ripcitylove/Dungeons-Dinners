import { test, expect } from "@playwright/test";

/**
 * Smoke tests — fast, backend-light checks that the app boots and the core
 * navigation works. These don't need real Supabase/AI data, so they're safe
 * to run in CI without secrets. Deeper golden-path tests (auth, character
 * creation, DM chat) can be added with test credentials + seeded data.
 */

test("landing page renders the hero and primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Adventure Awaits/i })).toBeVisible();
  // The page has multiple "Enter the Tavern" CTAs (hero + footer); assert the first.
  await expect(page.getByRole("button", { name: /Enter the Tavern/i }).first()).toBeVisible();
});

test("primary CTA navigates to the auth page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Enter the Tavern/i }).first().click();
  await expect(page).toHaveURL(/\/auth/);
});

test("pricing route redirects to dashboard (billing dormant)", async ({ page }) => {
  // /pricing is a server redirect to /dashboard; unauthenticated users land on /auth.
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/(dashboard|auth)/);
});
