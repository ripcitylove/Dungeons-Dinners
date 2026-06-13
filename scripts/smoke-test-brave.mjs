// Playwright smoke test — launches Brave, opens localhost:3000, captures all
// page console output, fails if the page errors out on boot. Used to confirm
// the dev server is healthy before the user manually tests narration.

import { chromium } from "@playwright/test";

const BRAVE = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const URL   = "http://localhost:3000";

const browser = await chromium.launch({ headless: true, executablePath: BRAVE });
const page    = await browser.newPage();

const errors  = [];
const consoleMsgs = [];
page.on("console", msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", e => errors.push(e.message));
page.on("requestfailed", r => {
  // Ignore aborts and known-noisy requests
  const f = r.failure();
  if (f && !/aborted|net::ERR_ABORTED/i.test(f.errorText)) {
    errors.push(`request failed: ${r.url()} (${f.errorText})`);
  }
});

try {
  console.log(`Loading ${URL} in Brave (headless)...`);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  const title = await page.title();
  console.log(`Page title: "${title}"`);
  console.log(`Console messages: ${consoleMsgs.length}`);
  if (errors.length === 0) {
    console.log("\n✓ Page loaded without errors");
    consoleMsgs.slice(0, 8).forEach(m => console.log(`  ${m}`));
  } else {
    console.log("\n✗ Errors detected:");
    errors.forEach(e => console.log(`  ${e}`));
  }
} finally {
  await browser.close();
}

process.exit(errors.length > 0 ? 1 : 0);
