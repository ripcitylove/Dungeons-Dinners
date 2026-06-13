// Generates an ElevenLabs sound-effect clip for every spell registered in
// PROMPTS below, saving to public/sounds/spells/<key>.mp3.
//
//   node scripts/generate-spell-sounds.mjs
//   node scripts/generate-spell-sounds.mjs --force
//   node scripts/generate-spell-sounds.mjs --only fire_bolt,cure_wounds
//
// Requires ELEVENLABS_API_KEY in .env.local (same key used by narration and
// class-ability sound generators).

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

// ── Spell prompts ────────────────────────────────────────────────────────────
// Each entry maps a spell key (snake_case) to an ElevenLabs prompt + clip
// duration. Prompts are tuned for short, evocative game SFX — each clip plays
// the moment the DM narrates the spell being cast.
const PROMPTS = {
  // ── Damage cantrips & spells ────────────────────────────────────────────────
  fire_bolt: {
    prompt: "Sharp magical flame whoosh and impact, fireball launching with crackling combustion tail, brief and decisive, no music",
    duration: 1.4,
  },
  eldritch_blast: {
    prompt: "Crackling otherworldly force beam discharge, deep eldritch pulse with electric warbling tail, dark cosmic energy, no music",
    duration: 1.8,
  },
  magic_missile: {
    prompt: "Three quick magical force darts streaking and impacting in rapid succession, glittering arcane whoosh, no music",
    duration: 1.8,
  },
  sacred_flame: {
    prompt: "Single bright holy radiant flame striking down from above, divine light burst with bell-like shimmer tail, no music",
    duration: 1.6,
  },
  ray_of_frost: {
    prompt: "Icy magical beam crystalline crackling, frost ray forming and shattering, cold winter wind tail, no music",
    duration: 1.5,
  },
  shocking_grasp: {
    prompt: "Sharp electric arc discharge, sudden lightning crack with brief sizzling tail, no music",
    duration: 1.2,
  },
  thunderwave: {
    prompt: "Massive thunder boom expanding outward like a sonic shockwave, deep sub-bass blast with reverberant tail, no music",
    duration: 2.0,
  },
  acid_splash: {
    prompt: "Bubbling green acid splash impact, hissing corrosive sizzle tail, no music",
    duration: 1.4,
  },
  chill_touch: {
    prompt: "Cold necrotic shadowy whoosh, ghostly chill spreading with ethereal cold tail, no music",
    duration: 1.6,
  },
  poison_spray: {
    prompt: "Hissing toxic green cloud spraying outward, venomous mist with bubbling poisonous tail, no music",
    duration: 1.4,
  },
  vicious_mockery: {
    prompt: "Cutting magical psychic taunt warble, distorted mocking laughter echo with brief disorienting psychic resonance, no music",
    duration: 1.5,
  },
  thorn_whip: {
    prompt: "Whip cracking through air, plant vines lashing with leafy organic whoosh, no music",
    duration: 1.3,
  },
  burning_hands: {
    prompt: "Cone of fire roaring outward, dragon-breath whoosh with crackling combustion tail, no music",
    duration: 1.8,
  },
  guiding_bolt: {
    prompt: "Holy bright radiant beam streaking through the air, divine light bolt with celestial shimmer tail, no music",
    duration: 1.6,
  },
  inflict_wounds: {
    prompt: "Dark necrotic energy bursting on touch, sickening corrupt power impact with shadowy gasping tail, no music",
    duration: 1.5,
  },
  produce_flame: {
    prompt: "Small flame igniting in the palm with a soft whoosh, gentle crackling fire tail, no music",
    duration: 1.4,
  },
  dissonant_whispers: {
    prompt: "Eerie ghostly whispering voices overlapping in unsettling psychic discord, brief disturbing echo, no music",
    duration: 2.0,
  },
  ice_knife: {
    prompt: "Crystalline ice dagger forming and shattering on impact with icy shower tail, no music",
    duration: 1.5,
  },

  // ── Healing ────────────────────────────────────────────────────────────────
  cure_wounds: {
    prompt: "Warm divine healing glow chime, soft golden bell with gentle sparkle tail and life-restoring shimmer, no music",
    duration: 1.8,
  },
  healing_word: {
    prompt: "Soft whispered divine healing word with warm chime and gentle rising shimmer, brief and gentle, no music",
    duration: 1.5,
  },
  goodberry: {
    prompt: "Soft nature magic chime with leafy rustle and small ripe berry plinking sound, gentle and earthy, no music",
    duration: 1.3,
  },
  spare_the_dying: {
    prompt: "Soft tender divine touch chime, warm life-affirming bell with gentle stabilizing breath, no music",
    duration: 1.6,
  },

  // ── Buffs / Protection ─────────────────────────────────────────────────────
  bless: {
    prompt: "Warm divine blessing chime with angelic vocal hum, golden light shimmer, holy and uplifting, no music",
    duration: 2.0,
  },
  shield: {
    prompt: "Sudden magical barrier whoosh forming a translucent arcane shield, brief crystalline ward chime, no music",
    duration: 1.4,
  },
  mage_armor: {
    prompt: "Spiraling magical force shimmer wrapping around a body forming arcane armor, soft glassy crystallization, no music",
    duration: 1.8,
  },
  shield_of_faith: {
    prompt: "Divine protective aura swelling with celestial chime and gentle warm shimmer, holy ward, no music",
    duration: 1.8,
  },
  heroism: {
    prompt: "Inspiring uplifting heroic horn pulse with warm divine glow shimmer, courage-instilling chime, no music",
    duration: 2.0,
  },
  divine_favor: {
    prompt: "Golden divine blessing falling on a weapon with radiant glow shimmer chime, brief holy infusion, no music",
    duration: 1.5,
  },

  // ── Utility / Other ────────────────────────────────────────────────────────
  faerie_fire: {
    prompt: "Magical sparkling outline shimmer with twinkling fey chimes, brief enchanted glitter effect, no music",
    duration: 1.8,
  },
  detect_magic: {
    prompt: "Soft mystical scanning chime with gentle arcane shimmer pulses, subtle revealing ping, no music",
    duration: 1.8,
  },
  sleep: {
    prompt: "Gentle magical lullaby chime with soft dreamy fade and whispered drowsy hush, soothing, no music",
    duration: 2.0,
  },
  charm_person: {
    prompt: "Mesmerizing enchantment shimmer with hypnotic chime spiral and dreamy magical aura, no music",
    duration: 2.0,
  },
};

const OUT_DIR = join(ROOT, "public", "sounds", "spells");
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
console.log(`Generating ${entries.length} spell sound effect${entries.length === 1 ? "" : "s"}…`);

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
