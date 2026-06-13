// Generates an ElevenLabs sound-effect clip for every class ability and saves
// them to public/sounds/abilities/<key>.mp3. Idempotent: skips any file that
// already exists unless --force is passed. The runtime classAbilitySounds.ts
// module will prefer these real clips over the synth fallback for any key
// that's present.
//
//   node scripts/generate-ability-sounds.mjs
//   node scripts/generate-ability-sounds.mjs --force
//   node scripts/generate-ability-sounds.mjs --only rage,action_surge,ki
//
// Requires ELEVENLABS_API_KEY in .env.local (the same key the narration route
// already uses).

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

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyIdx = args.findIndex(a => a === "--only");
const only = onlyIdx >= 0 && args[onlyIdx + 1]
  ? new Set(args[onlyIdx + 1].split(",").map(s => s.trim()))
  : null;

// ── Sound prompts ─────────────────────────────────────────────────────────────
// Each entry yields one ~1-4 second clip. Prompts are tuned for ElevenLabs
// sound-generation: concrete, sensory, and short. prompt_influence is high so
// the model stays close to the description (0.3 default is too loose for game
// SFX where each clip has a specific role).
const PROMPTS = {
  // Barbarian
  rage: {
    prompt: "Deep guttural barbarian war roar, primal fury scream, single short combat shout, no music",
    duration: 1.6,
  },

  // Bard
  bardic_inspiration: {
    prompt: "Magical harp arpeggio rising upward, sparkling enchantment, light chime at the peak, no voice",
    duration: 1.5,
  },

  // Cleric
  channel_divinity: {
    prompt: "Heavenly angelic choir holding a single sustained chord, divine light, ethereal reverb, no melody, no words",
    duration: 2.8,
  },

  // Druid — generic shapeshift (used when no specific form is named)
  wild_shape: {
    prompt: "Magical transformation woosh with crackling nature energy, leaves and twigs swirling, brief",
    duration: 1.6,
  },

  // Fighter — full-throated warrior battle cry. Single powerful shout.
  second_wind: {
    prompt: "Single powerful full-throated warrior battle cry, fierce determined shout from a knight charging into combat, no words, brief echo tail, no music",
    duration: 1.8,
  },
  action_surge: {
    prompt: "Sharp electric thunderclap with brief sizzling arc tail, surge of power, single decisive crack",
    duration: 1.4,
  },

  // Monk
  ki: {
    prompt: "Deep meditative temple gong struck once, long resonant low decay, peaceful and powerful",
    duration: 3.5,
  },

  // Paladin
  lay_on_hands: {
    prompt: "Warm celestial healing chime, divine golden bell, soft sparkling tail, gentle and reverent",
    duration: 2.2,
  },
  paladin_channel: {
    prompt: "Solemn brass fanfare horn note, holy proclamation, dignified divine power, no melody",
    duration: 2.4,
  },

  // Ranger — outdoor forest atmosphere, tracking the prey. Wind through trees,
  // bowstring tension, no actual arrow shot.
  hunters_mark: {
    prompt: "Wind whistling through pine forest, taut bowstring stretched and held creaking under tension, soft leaves crunch underfoot, single hushed wilderness moment, no music",
    duration: 1.8,
  },

  // Rogue
  cunning_action: {
    prompt: "Fast cloth whoosh as a shadow dashes by, agile rogue movement, single quick sweep",
    duration: 1.1,
  },
  sneak_attack: {
    prompt: "Sharp dagger metallic unsheath shink immediately followed by a heavy body impact thud, brief and decisive",
    duration: 1.3,
  },
  uncanny_dodge: {
    prompt: "Quick cape snap and dodge whoosh, fabric flutter, fast evasion movement",
    duration: 1.1,
  },
  evasion_rogue: {
    prompt: "Acrobatic leap whoosh through air with a light landing on stone, agile and quick",
    duration: 1.3,
  },

  // Sorcerer — Tesla coil winding tight and releasing. Concrete electrical
  // physics rather than abstract "magic energy".
  sorcery_points: {
    prompt: "Deep electrical hum charging upward like a Tesla coil winding tight, sharp arc release with single bright crack and sizzling tail, no music",
    duration: 1.6,
  },

  // Wizard
  arcane_recovery: {
    prompt: "Soft magical page rustle followed by a gentle bell chime and a faint shimmer, scholarly and warm",
    duration: 1.8,
  },

  // Warlock
  eldritch_invocations: {
    prompt: "Otherworldly deep drone with faint whispering chant in unknown language, dark cosmic horror, eerie reverb",
    duration: 3.0,
  },
  // Warlock — a single large bell struck once in the far distance, slow and
  // ominous, with a long reverberant decay.
  pact_boon: {
    prompt: "Single large deep cathedral bell struck once in the far distance, slow ominous toll with long reverberant fading decay, no other sounds, no music",
    duration: 3.0,
  },
};

const OUT_DIR = join(ROOT, "public", "sounds", "abilities");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ── Generation ────────────────────────────────────────────────────────────────
async function generate(key, prompt, durationSeconds) {
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
      // 0.5 keeps the model close to the prompt without being mechanical.
      // 0.3 (default) drifts too much for game SFX where each cue has a job.
      prompt_influence: 0.5,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${errText.slice(0, 200)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4096) {
    throw new Error(`Suspiciously small payload (${buf.length} bytes) — likely truncated`);
  }
  return buf;
}

const entries = Object.entries(PROMPTS).filter(([key]) => !only || only.has(key));
console.log(`Generating ${entries.length} ability sound effect${entries.length === 1 ? "" : "s"}…`);

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
    const buf = await generate(key, prompt, duration);
    writeFileSync(outPath, buf);
    console.log(`\r  ✓  ${key} (${(buf.length / 1024).toFixed(0)} KB, ~${duration}s)`);
    made++;
    // Be gentle on the API — small delay between requests.
    await new Promise(r => setTimeout(r, 350));
  } catch (err) {
    console.log(`\r  ✗  ${key} — ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. ${made} generated, ${skipped} skipped, ${failed} failed.`);
console.log(`Files saved to: ${OUT_DIR}`);
if (failed > 0) process.exit(1);
