// Mints a real session for the campaign owner (service role), then runs the
// optimizations Playwright spec with the tokens in env. Keeps the spec itself
// dependency-free (no supabase/fs imports → no ESM/CJS conflict in the runner).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);

const EMAIL = "lunsford.randy@gmail.com";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon  = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const { data: link, error: lerr } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
if (lerr) { console.error("generateLink:", lerr.message); process.exit(1); }
const { data: v, error: verr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (verr) { console.error("verifyOtp:", verr.message); process.exit(1); }
console.log("Minted session for", v.user.email);

// Discover a REAL campaign to test against (the hardcoded fixture can be deleted as
// campaigns come and go). Prefer the owner's campaign with the MOST messages so the
// history-windowing test has enough history. Passed to the spec via env.
const { data: camps } = await admin.from("campaigns").select("id,npcs").eq("user_id", v.user.id);
let best = null, bestMsgs = -1, bestNpcs = 0;
for (const c of camps ?? []) {
  const { count } = await admin.from("campaign_messages").select("*", { count: "exact", head: true }).eq("campaign_id", c.id);
  const nc = Array.isArray(c.npcs) ? c.npcs.filter(n => n?.is_companion).length : 0;
  // Prefer more messages; break ties toward one that has companion NPCs (for the #NPC test).
  if ((count ?? 0) > bestMsgs || ((count ?? 0) === bestMsgs && nc > bestNpcs)) { best = c.id; bestMsgs = count ?? 0; bestNpcs = nc; }
}
if (!best) { console.error("No campaign found for", EMAIL, "— create one to run e2e."); process.exit(1); }
console.log(`Testing against campaign ${best} (${bestMsgs} messages, ${bestNpcs} companions)`);

const extra = process.env.OPT_HEADED ? ["--headed"] : [];
if (process.env.PWGREP) extra.push("--grep", process.env.PWGREP);
const r = spawnSync("npx", ["playwright", "test", "tests/e2e/optimizations.spec.ts", "--project=chromium", "--reporter=list", "--workers=1", ...extra], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, TEST_ACCESS_TOKEN: v.session.access_token, TEST_REFRESH_TOKEN: v.session.refresh_token, TEST_CAMPAIGN_ID: best, TEST_CAMPAIGN_COMPANIONS: String(bestNpcs) },
});
process.exit(r.status ?? 1);
