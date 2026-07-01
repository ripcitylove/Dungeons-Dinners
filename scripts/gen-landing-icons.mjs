// Generates the landing-page feature/step ICONS as cute chibi-character art matching
// the hero illustration style (the Whimsy dragon + party). Transparent PNGs so they
// float on the dark cards. → public/landing/<name>.png
// Permanent assets — committed and reused; resumable (skips existing).
// Run: node scripts/gen-landing-icons.mjs   (pass --force to regenerate all)
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const env = fs.readFileSync(path.resolve(".env.local"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = /^\s*OPENAI_API_KEY\s*=\s*(.*)\s*$/.exec(line);
    if (m) return m[1].replace(/^["']|["']$/g, "").replace(/^﻿/, "").trim();
  }
  throw new Error("OPENAI_API_KEY not found in env or .env.local");
}
const openai = new OpenAI({ apiKey: loadKey() });
const FORCE = process.argv.includes("--force");

// Shared style so all 9 read as one cohesive set that matches the hero art.
const STYLE =
  "Adorable chibi fantasy character illustration in a warm hand-painted storybook style — " +
  "big expressive eyes, rounded chunky proportions, soft thick clean outlines, gentle cinematic " +
  "shading, cozy rich dark-fantasy palette (deep greens, warm browns, soft purples, warm reds). " +
  "A SINGLE subject, centered, full-body, facing the viewer, friendly and heroic. " +
  "FULLY TRANSPARENT background (no scene, no ground, no cast shadow, no frame, no border). " +
  "No text, no letters, no numbers, no watermark, no logo. High quality, clean, readable as a small app icon.";

const ICONS = {
  // 6 feature-card icons
  "dungeon-master": "a wise, friendly little green chibi dragon Dungeon Master wearing a small hood/cloak, holding up a glowing blue twenty-sided die (d20)",
  "combat":         "a brave chibi knight in plate armor in a dynamic mid-swing action pose with a glowing sword raised",
  "multiplayer":    "a cheerful tight group of three tiny chibi adventurers huddled shoulder-to-shoulder — a helmeted warrior, a green-robed elf mage, and a small friendly dragon",
  "voice":          "a joyful chibi bard singing with an open mouth while strumming a lute, a few small glowing musical notes floating nearby",
  "portrait":       "a proud cute chibi hero character posing inside an ornate golden painting frame, like a painted portrait",
  "controller":     "a happy little green chibi dragon leaning back and playing with a modern video game controller held in its claws",
  // 3 'how it works' step icons
  "forge":          "a sturdy chibi dwarf blacksmith with a big beard hammering a glowing hot sword on an anvil, warm orange sparks flying",
  "map":            "a curious little chibi adventurer excitedly holding up an unrolled old treasure map with a route and an X",
  "spellbook":      "a tiny chibi wizard in a big pointed hat reading a large open glowing spellbook, sparkles rising from the pages",
};

const outDir = path.resolve("public/landing");
fs.mkdirSync(outDir, { recursive: true });

const jobs = Object.entries(ICONS).map(([name, subject]) => ({
  name, file: path.join(outDir, `${name}.png`),
  prompt: `${STYLE}\n\nThe icon depicts: ${subject}.`,
}));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gen(job) {
  if (!FORCE && fs.existsSync(job.file)) { console.log(`skip (exists)  ${job.name}`); return false; }
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await openai.images.generate({
        model: "gpt-image-1", prompt: job.prompt, size: "1024x1024",
        quality: "medium", background: "transparent", n: 1,
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) { console.log(`FAIL (no data) ${job.name}`); return false; }
      fs.writeFileSync(job.file, Buffer.from(b64, "base64"));
      console.log(`saved          ${job.name} -> ${path.relative(process.cwd(), job.file)}`);
      return true;
    } catch (e) {
      const msg = e?.message ?? String(e);
      if (e?.status === 429 || /rate limit/i.test(msg)) {
        const hint = /try again in ([\d.]+)s/i.exec(msg);
        const waitMs = Math.ceil(((hint ? parseFloat(hint[1]) : 13) + 2) * 1000);
        console.log(`  429 ${job.name} — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt})`);
        await sleep(waitMs); continue;
      }
      console.log(`ERROR ${job.name}: ${msg}`); return false;
    }
  }
  console.log(`GAVE UP ${job.name}`); return false;
}

console.log(`Generating ${jobs.length} landing icons (transparent, chibi style)…`);
let made = 0;
for (const job of jobs) { if (await gen(job)) { made++; await sleep(13000); } }
console.log(`Done. ${made} generated, ${jobs.length - made} skipped/existing.`);
