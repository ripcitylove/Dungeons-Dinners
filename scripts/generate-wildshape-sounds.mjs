// Generates an ElevenLabs sound-effect clip for every Wild Shape animal
// family and saves them to public/sounds/wildshape/<family>.mp3. The runtime
// classAbilitySounds.ts module prefers these over the existing .ogg files
// (which can be deleted once the .mp3 set is verified).
//
//   node scripts/generate-wildshape-sounds.mjs
//   node scripts/generate-wildshape-sounds.mjs --force
//   node scripts/generate-wildshape-sounds.mjs --only bear,owl,spider
//
// Requires ELEVENLABS_API_KEY in .env.local (same key the narration route uses).

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Hand-load .env.local — node doesn't read it by default.
const envPath = join(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.ELEVENLABS_API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY in .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyIdx = args.findIndex(a => a === "--only");
const only = onlyIdx >= 0 && args[onlyIdx + 1]
  ? new Set(args[onlyIdx + 1].split(",").map(s => s.trim()))
  : null;

// ── Wild Shape family prompts ─────────────────────────────────────────────────
// Each entry maps one family file to an ElevenLabs prompt + clip duration.
// The runtime regex matcher routes specific forms (bear, brown bear, black
// bear → "bear.mp3"; wolf, dire wolf, hound → "wolf.mp3"; etc.).
const PROMPTS = {
  // Large mammals
  bear: {
    prompt: "Single deep ferocious brown bear roar, low guttural growl, threatening forest animal, no music",
    duration: 2.2,
  },
  wolf: {
    prompt: "Single long mournful wolf howl rising and holding, lone wolf at night, no music",
    duration: 3.0,
  },
  bigcat: {
    prompt: "Single ferocious big cat snarl roar, tiger or panther threat, deep predatory growl, no music",
    duration: 2.4,
  },
  ape: {
    prompt: "Single sharp ape territorial call, gorilla hoot rising in pitch, single primate vocalization, no music",
    duration: 2.2,
  },
  boar: {
    prompt: "Wild boar aggressive grunt and snort, single short pig charge sound, no music",
    duration: 1.4,
  },
  horse: {
    prompt: "Single horse neigh whinny with snort, war horse vocalization, no music",
    duration: 2.2,
  },
  goat: {
    prompt: "Single goat bleat call, mountain goat with slight echo, single short vocalization, no music",
    duration: 1.3,
  },

  // Birds
  eagle: {
    prompt: "Single piercing eagle screech cry, bird of prey hunting call, sharp descending raptor scream, no music",
    duration: 2.0,
  },
  owl: {
    prompt: "Single deep owl hoot at night, two-tone hoo hoo, dark forest atmosphere, no music",
    duration: 2.0,
  },
  bat: {
    prompt: "Single high-pitched bat chirp and squeak, fast clicking echolocation, small flying creature, no music",
    duration: 1.0,
  },

  // Reptiles / amphibians
  snake: {
    prompt: "Long threatening snake hiss, venomous serpent warning, no music",
    duration: 2.0,
  },
  frog: {
    prompt: "Single deep frog croak ribbit, bullfrog at pond, no music",
    duration: 1.2,
  },

  // Aquatic / amphibious
  splash: {
    prompt: "Single large water splash impact, sea creature surfacing or diving, no music",
    duration: 1.5,
  },

  // Small mammals
  rat: {
    prompt: "Single tiny rat squeak high-pitched, small rodent vocalization, no music",
    duration: 0.9,
  },
  cat: {
    prompt: "Single house cat meow, domestic cat call, slightly inquisitive, no music",
    duration: 1.1,
  },

  // Arachnids
  spider: {
    prompt: "Eerie giant spider chittering and skittering legs on stone, arachnid creature movement, no music",
    duration: 1.8,
  },
};

const OUT_DIR = join(ROOT, "public", "sounds", "wildshape");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function generate(prompt, durationSeconds) {
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: durationSeconds,
      prompt_influence: 0.55,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${errText.slice(0, 200)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4096) {
    throw new Error(`Suspiciously small payload (${buf.length} bytes)`);
  }
  return buf;
}

const entries = Object.entries(PROMPTS).filter(([key]) => !only || only.has(key));
console.log(`Generating ${entries.length} wild-shape sound effect${entries.length === 1 ? "" : "s"}…`);

let made = 0;
let skipped = 0;
let failed = 0;
for (const [key, { prompt, duration }] of entries) {
  const outPath = join(OUT_DIR, `${key}.mp3`);
  if (!force && existsSync(outPath)) {
    console.log(`  ⏭  ${key} (already exists — pass --force to regenerate)`);
    skipped++;
    continue;
  }
  process.stdout.write(`  ⏳ ${key} …`);
  try {
    const buf = await generate(prompt, duration);
    writeFileSync(outPath, buf);
    console.log(`\r  ✓  ${key} (${(buf.length / 1024).toFixed(0)} KB, ~${duration}s)`);
    made++;
    await new Promise(r => setTimeout(r, 350));
  } catch (err) {
    console.log(`\r  ✗  ${key} — ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. ${made} generated, ${skipped} skipped, ${failed} failed.`);
console.log(`Files saved to: ${OUT_DIR}`);
if (failed > 0) process.exit(1);
