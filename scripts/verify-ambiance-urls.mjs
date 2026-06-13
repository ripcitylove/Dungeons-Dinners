// Confirms every URL in MusicPlayer's AMBIANCE_POOLS serves audio/mpeg.
import { readFileSync } from "node:fs";

const src = readFileSync("src/components/MusicPlayer.tsx", "utf8");

// Pull the AMBIANCE_POOLS block
const m = src.match(/const AMBIANCE_POOLS:[\s\S]*?^};/m);
if (!m) { console.error("AMBIANCE_POOLS block not found"); process.exit(1); }

// Match template-literal URLs that resolve archive.org paths
const urls = [...m[0].matchAll(/`\$\{ARCHIVE_DL\}\/[^`]+`/g)].map(x => {
  const url = x[0].replace("`", "").replace("`", "").replace("${ARCHIVE_DL}", "https://archive.org/download");
  return url;
});

const dedup = [...new Set(urls)];
console.log(`Verifying ${dedup.length} unique URLs across ${urls.length} pool entries\n`);

let fail = 0;
for (const url of dedup) {
  // Use GET with Range header to avoid HEAD-redirect quirks on archive.org's CDN
  const res = await fetch(url, { method: "GET", redirect: "follow", headers: { Range: "bytes=0-0" } });
  const ct  = res.headers.get("content-type") ?? "";
  const ok  = res.ok && ct.startsWith("audio/");
  const len = res.headers.get("content-length") ?? "?";
  console.log(`${ok ? "✓" : "✗"} ${url.replace("https://archive.org/download/", "…/")} (${ct}, ${len} bytes)`);
  if (!ok) fail++;
}
console.log(`\n${dedup.length - fail}/${dedup.length} OK`);
process.exit(fail > 0 ? 1 : 0);
