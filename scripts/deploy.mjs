#!/usr/bin/env node
/**
 * Deployment + rollback tool for Dungeons-Dinners (Vercel via git `main`).
 *
 *   node scripts/deploy.mjs status            Show current live version, deploy log, rollback target
 *   node scripts/deploy.mjs init              One-time: backfill live/* tags for recent main deploys
 *   node scripts/deploy.mjs deploy            Build-gate, push dev -> main (deploy), stamp a live/* tag
 *   node scripts/deploy.mjs rollback          Revert production to the PREVIOUS deployed version
 *   node scripts/deploy.mjs rollback --steps N   Go back N versions
 *   node scripts/deploy.mjs rollback --to live/<ts>   Jump to a specific past deploy (also rolls forward)
 *   node scripts/deploy.mjs verify [<sha>]    Check the Vercel Production build + mythicmeal.io
 *
 * Flags: --dry-run (preview, change nothing), --skip-build, --yes (skip confirm)
 *
 * How it works: every deploy tags the deployed commit `live/<UTC timestamp>`. The
 * tags form an immutable, ordered log. Rollback force-moves `main` to a tagged
 * commit; Vercel rebuilds & re-serves it. Production = whatever `origin/main` is.
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Derive the repo root from this script's own location (scripts/deploy.mjs ->
// repo root is one level up). Keeps the tool portable across machines/checkouts
// instead of hardcoding a single clone's absolute path.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OWNER_REPO = "ripcitylove/Dungeons-Dinners";
const PROD_DOMAIN = "https://www.mythicmeal.io";
const VERCEL_ALIAS = "https://dungeons-dinners.vercel.app";
process.chdir(REPO);

// ---- tooling on PATH + auth ----
const userProfile = process.env.USERPROFILE || process.env.HOME;
const toolDirs = [`${userProfile}\\tools\\PortableGit\\cmd`, `${userProfile}\\tools\\gh\\bin`];
process.env.Path = `${toolDirs.join(";")};${process.env.Path}`;
function readUserEnv(name) {
  try { return execSync(`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('${name}','User')"`).toString().trim(); }
  catch { return ""; }
}
if (!process.env.GH_TOKEN) process.env.GH_TOKEN = readUserEnv("GH_TOKEN");

// ---- helpers ----
const args = process.argv.slice(2);
const cmd = args[0];
const has = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = has("--dry-run");
const SKIP_BUILD = has("--skip-build");
const YES = has("--yes");

function git(a, { quiet = true } = {}) { return execSync(`git ${a}`, { stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit" }).toString().trim(); }
function gitTry(a) { const r = spawnSync("git", a.split(" "), { encoding: "utf8" }); return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() }; }
function gh(path) { return JSON.parse(execSync(`gh api "${path}"`, { stdio: ["ignore", "pipe", "pipe"] }).toString()); }
const short = (s) => (s || "").slice(0, 7);
function subject(sha) { try { return git(`show -s --format=%s ${sha}`); } catch { return "?"; } }
function confirm(msg) {
  if (YES || DRY) return true;
  // Non-interactive environments: require --yes. We print and proceed only with --yes.
  console.log(`\n⚠ ${msg}\n  Re-run with --yes to proceed (or --dry-run to preview).`);
  return false;
}

// Ordered deploy log from live/* tags (oldest -> newest by timestamp name).
function deployLog() {
  git("fetch -q origin --tags --force");
  const tags = git(`tag -l "live/*"`).split("\n").map(t => t.trim()).filter(Boolean).sort();
  return tags.map(tag => ({ tag, sha: git(`rev-list -n 1 ${tag}`), date: git(`show -s --format=%cI ${git(`rev-list -n 1 ${tag}`)}`) }));
}
function currentLive() { git("fetch -q origin"); return git("rev-parse origin/main"); }

async function pollProd(targetSha) {
  process.stdout.write("  waiting for Vercel Production build");
  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, 20000));
    process.stdout.write(".");
    let deps;
    try { deps = gh(`repos/${OWNER_REPO}/deployments?per_page=10`); } catch { continue; }
    const prod = deps.find(d => d.environment === "Production" && d.ref.startsWith(targetSha));
    if (!prod) continue;
    let st;
    try { st = gh(`repos/${OWNER_REPO}/deployments/${prod.id}/statuses?per_page=1`); } catch { continue; }
    const state = st[0]?.state ?? "pending";
    if (state === "success") { console.log(`\n  ✓ Production ${short(targetSha)}: success`); return true; }
    if (state === "failure" || state === "error") { console.log(`\n  ✗ Production ${short(targetSha)}: ${state}`); return false; }
  }
  console.log("\n  ⚠ timed out waiting for Production status");
  return false;
}
function bodyHash(url) {
  const ps = `$r=Invoke-WebRequest '${url}' -UseBasicParsing -TimeoutSec 20; $b=[Text.Encoding]::UTF8.GetBytes($r.Content); (([Security.Cryptography.SHA256]::Create().ComputeHash($b)|%{$_.ToString('x2')}) -join '').Substring(0,16)`;
  try { return execSync(`powershell -NoProfile -Command "${ps}"`).toString().trim(); } catch { return "ERR"; }
}

// ---- commands ----
async function doStatus() {
  const cur = currentLive();
  const log = deployLog();
  console.log(`\nProduction (origin/main): ${short(cur)}  "${subject(cur)}"`);
  console.log(`Live domain: ${PROD_DOMAIN}\n`);
  if (!log.length) { console.log("No deploy log yet. Run:  node scripts/deploy.mjs init"); return; }
  console.log("Deploy log (oldest → newest):");
  const curIdx = log.findIndex(e => e.sha === cur);
  log.forEach((e, i) => {
    const mark = e.sha === cur ? " ← LIVE" : "";
    console.log(`  ${e.tag}  ${short(e.sha)}  ${subject(e.sha).slice(0, 50)}${mark}`);
  });
  const prev = curIdx > 0 ? log[curIdx - 1] : null;
  console.log(prev
    ? `\nRollback target (previous): ${short(prev.sha)}  "${subject(prev.sha)}"\n  → node scripts/deploy.mjs rollback`
    : `\nNo previous version before the current one in the log.`);
}

async function doInit() {
  // Backfill the deploy log from the AUTHORITATIVE record of what was actually
  // shipped: Vercel's successful Production deployments (each real push-to-main).
  git("fetch -q origin --tags --force");
  const deps = gh(`repos/${OWNER_REPO}/deployments?environment=Production&per_page=30`);
  const existing = new Set(deployLog().map(e => e.sha));
  const seen = new Set();
  const toTag = [];
  for (const d of deps) {
    const sha = d.ref;
    if (seen.has(sha)) continue; seen.add(sha);
    let ok = false;
    try { const st = gh(`repos/${OWNER_REPO}/deployments/${d.id}/statuses?per_page=1`); ok = st[0]?.state === "success"; } catch {}
    if (!ok) continue;                                   // only successful prod builds
    if (!gitTry(`cat-file -e ${sha}^{commit}`).ok) continue; // must exist locally
    if (existing.has(sha)) continue;
    const ts = d.created_at.replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    toTag.push({ sha, ts });
  }
  if (!toTag.length) { console.log("Deploy log already covers every successful Production deployment — nothing to backfill."); return; }
  console.log("Will backfill these REAL Production deploys as live/* tags:");
  for (const e of toTag) console.log(`  live/${e.ts}  ${short(e.sha)}  ${subject(e.sha).slice(0, 50)}`);
  if (DRY) { console.log("\n[dry-run] no tags created."); return; }
  if (!confirm(`Create ${toTag.length} backfill tag(s) on origin?`)) return;
  for (const e of toTag) { git(`tag -f live/${e.ts} ${e.sha}`); git(`push -f origin live/${e.ts}`); }
  console.log(`\n✓ Backfilled ${toTag.length} deploy tag(s). Run: node scripts/deploy.mjs status`);
}

async function doDeploy() {
  git("fetch -q origin");
  const prevLive = currentLive();
  const newHead = git("rev-parse dev");
  if (prevLive === newHead) { console.log("Nothing to deploy — dev == origin/main."); return; }
  console.log(`Deploy: ${short(prevLive)} (live) → ${short(newHead)} (dev)  "${subject(newHead)}"`);
  if (DRY) { console.log("[dry-run] would: build → push dev:main → tag live/<ts> → verify."); return; }
  if (!SKIP_BUILD) {
    console.log("Building (deploy gate)…");
    // Invoke `next build` via the node binary directly — avoids the Windows .cmd
    // shell quirk where spawnSync can't launch npm.cmd and reports a false failure.
    // Use the node that's running this script (process.execPath) so the tool works
    // on any machine, not just one with a portable node under %USERPROFILE%\tools.
    const nodeBin = process.execPath;
    const r = spawnSync(nodeBin, ["node_modules/next/dist/bin/next", "build"], { encoding: "utf8" });
    if (r.status !== 0) {
      console.log("✗ BUILD FAILED — aborting deploy.");
      if (r.error) console.log("  spawn error: " + r.error.message);
      console.log(((r.stdout || "") + (r.stderr || "")).slice(-1500));
      process.exit(1);
    }
    console.log("  ✓ build passed");
  }
  git("push origin dev"); git("push origin dev:main");
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  git(`tag -f live/${ts} ${newHead}`); git(`push -f origin live/${ts}`);
  console.log(`✓ Pushed. Tagged live/${ts}.`);
  await pollProd(newHead);
  console.log(`  mythicmeal.io hash=${bodyHash(PROD_DOMAIN)}  prod-alias hash=${bodyHash(VERCEL_ALIAS)}`);
  console.log(`\nRolled-back-from-here would restore ${short(prevLive)}.  Undo:  node scripts/deploy.mjs rollback`);
}

async function doRollback() {
  const cur = currentLive();
  const log = deployLog();
  if (!log.length) { console.log("No deploy log. Run: node scripts/deploy.mjs init"); return; }
  let target;
  const toArg = opt("--to", "");
  if (toArg) {
    const e = log.find(x => x.tag === toArg || x.sha.startsWith(toArg));
    if (!e) { console.log(`Tag/sha not found in deploy log: ${toArg}`); return; }
    target = e.sha;
  } else {
    const steps = parseInt(opt("--steps", "1"), 10);
    const curIdx = log.findIndex(e => e.sha === cur);
    if (curIdx < 0) { console.log(`Current live ${short(cur)} isn't in the deploy log — run 'init' or use --to.`); return; }
    const tgtIdx = curIdx - steps;
    if (tgtIdx < 0) { console.log(`Cannot go back ${steps} — only ${curIdx} earlier version(s) in the log.`); return; }
    target = log[tgtIdx].sha;
  }
  if (target === cur) { console.log("Target equals current live — nothing to do."); return; }
  console.log(`\nROLLBACK production:`);
  console.log(`  FROM ${short(cur)}    "${subject(cur)}"`);
  console.log(`  TO   ${short(target)}    "${subject(target)}"`);
  if (DRY) { console.log(`\n[dry-run] would force-push ${short(target)} → main and verify.`); return; }
  if (!confirm("This re-points production (mythicmeal.io) to the older version above.")) return;
  const r = gitTry(`push origin +${target}:main`);
  if (!r.ok) { console.log("✗ push failed:\n" + r.err); process.exit(1); }
  console.log(`✓ main → ${short(target)} (Vercel redeploying the previous version)`);
  await pollProd(target);
  const a = bodyHash(PROD_DOMAIN), b = bodyHash(VERCEL_ALIAS);
  console.log(`  mythicmeal.io hash=${a}  prod-alias hash=${b}  ${a === b ? "✓ serving rolled-back version" : "⚠ mismatch — check Vercel"}`);
  console.log(`\nProduction is now ${short(target)}. Roll back further: rollback --steps 1 · Roll forward: rollback --to <later live/* tag>`);
}

async function doVerify() {
  const sha = args[1] && !args[1].startsWith("--") ? git(`rev-parse ${args[1]}`) : currentLive();
  console.log(`Verifying Production = ${short(sha)} …`);
  const ok = await pollProd(sha);
  const a = bodyHash(PROD_DOMAIN), b = bodyHash(VERCEL_ALIAS);
  console.log(`  mythicmeal.io hash=${a}  prod-alias hash=${b}  ${a === b ? "✓ in sync" : "⚠ mismatch"}`);
  process.exit(ok && a === b ? 0 : 1);
}

function nodeDirName() {
  return execSync(`powershell -NoProfile -Command "(Get-ChildItem '${userProfile}\\tools' -Directory | ? { $_.Name -like 'node-*-win-x64' }).Name"`).toString().trim();
}

const table = { status: doStatus, init: doInit, deploy: doDeploy, rollback: doRollback, verify: doVerify };
if (!table[cmd]) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(2, 22).join("\n").replace(/\*\/?/g, "").replace(/^ \* ?/gm, ""));
  process.exit(cmd ? 1 : 0);
}
await table[cmd]().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
