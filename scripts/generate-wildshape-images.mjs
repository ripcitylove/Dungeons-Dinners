// Pre-generates portrait images for every Wild Shape beast in the catalog.
// Hits OpenAI image API once per key, saves to public/wildshape/<key>.png.
// Skips any image that already exists on disk (idempotent). Run once after
// adding new beasts; rerun with --force to regenerate them all.
//
//   node scripts/generate-wildshape-images.mjs
//   node scripts/generate-wildshape-images.mjs --force
//   node scripts/generate-wildshape-images.mjs --only bear,wolf,giant_eagle

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

// Hand-load .env.local — node doesn't read it by default
const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env.local");
  process.exit(1);
}

// Pull the catalog by simple parse — we only need keys and a couple of fields
const formsSrc = readFileSync("src/lib/wildShapeForms.ts", "utf8");
const catalogBlock = formsSrc.match(/WILD_SHAPE_FORMS:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\n\};/);
if (!catalogBlock) { console.error("Could not parse WILD_SHAPE_FORMS"); process.exit(1); }

const entries = [];
const lineRe = /^\s*([a-z_]+):\s*\{[\s\S]*?crLabel:\s*"([^"]+)"[\s\S]*?hasFly:\s*(true|false)[\s\S]*?hasSwim:\s*(true|false)/gm;
let m;
while ((m = lineRe.exec(catalogBlock[1])) !== null) {
  entries.push({ key: m[1], crLabel: m[2], hasFly: m[3] === "true", hasSwim: m[4] === "true" });
}
if (!entries.length) { console.error("No beasts parsed from catalog"); process.exit(1); }

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const onlyArg = argv.find(a => a.startsWith("--only"));
const onlyList = onlyArg ? onlyArg.replace(/^--only=?/, "").split(",").map(s => s.trim()).filter(Boolean) : null;

const outDir = "public/wildshape";
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Human-readable name + descriptive flavor — used in the image prompt
const FLAVOR = {
  rat:               "a small wild rat, sharp eyes, bristled fur",
  weasel:            "a sleek weasel mid-pounce, lithe and quick",
  frog:              "a glistening forest frog crouched on a wet stone",
  spider:            "a large hairy spider with multiple gleaming eyes",
  hawk:              "a fierce hawk in mid-flight, wings spread, golden eye",
  owl:               "a wise great horned owl, feathers ruffled, piercing yellow eyes",
  raven:             "an obsidian raven with a sharp beak and intelligent gaze",
  bat:               "a small bat in flight, wings spread, ears alert",
  cat:               "an alert tabby cat with bright eyes and twitching ears",
  dog:               "a loyal hunting dog, ears perked, watchful",
  mastiff:           "a powerful mastiff with broad shoulders and a stern muzzle",
  goat:              "a mountain goat with strong horns and a shaggy coat",
  wolf:              "a lean grey wolf, fangs bared, fur bristling",
  pony:              "a sturdy fjord pony with a thick mane",
  panther:           "a sleek black panther in a low crouch, golden eyes glowing",
  giant_rat:         "an oversized dire rat the size of a dog, matted fur and sharp incisors",
  boar:              "a fierce wild boar with tusks raised, eyes red with fury",
  giant_weasel:      "an oversized weasel the size of a hound, sinuous and quick",
  ape:               "a powerful great ape, knuckles braced, intelligent eyes",
  crocodile:         "a massive crocodile, jaws open, scales glistening with swamp water",
  warhorse:          "a battle-trained warhorse, armored barding, flared nostrils",
  riding_horse:      "a sturdy bay riding horse, alert and proud",
  black_bear:        "a black bear standing tall, claws extended, growling",
  giant_goat:        "an oversized mountain goat with massive curling horns",
  giant_wolf_spider: "an enormous wolf spider as large as a dog, eight glittering eyes",
  bear:              "a powerful brown bear roaring, claws raised, fur thick",
  brown_bear:        "a massive brown grizzly bear roaring, claws raised, fur thick",
  dire_wolf:         "an enormous dire wolf, fangs bared, fur matted with battle",
  giant_eagle:       "a colossal eagle soaring with wings fully extended, talons curled",
  giant_owl:         "an enormous owl with a wingspan of ten feet, wise piercing eyes",
  giant_octopus:     "a massive octopus underwater, tentacles writhing, intelligent eye",
  eagle:             "a fierce eagle in flight, wings outstretched against the sky",
  falcon:            "a swift peregrine falcon mid-dive, wings tucked",
  tiger:             "a fierce orange tiger with black stripes, fangs bared, low crouch",
  lion:              "a male lion with a thick mane, roaring, golden eyes",
  snake:             "a venomous snake coiled and ready to strike, forked tongue",
  viper:             "a deadly viper coiled with hood flared, fangs visible",
  fish:              "a large freshwater fish underwater, scales shimmering",
  octopus:           "an octopus with curling tentacles, intelligent eye",
  shark:             "a fierce reef shark, jaws open, dorsal fin slicing the water",
};

const stylePrompt = "Dark fantasy painterly style, dramatic lighting, cinematic D&D bestiary illustration, head-and-shoulders or full-creature portrait, highly detailed, expressive eye, no text, no watermark, no logos, clean isolated subject on subtle natural background.";

const targets = entries.filter(e => !onlyList || onlyList.includes(e.key));
console.log(`Catalog has ${entries.length} beasts; generating ${targets.length}.`);

let generated = 0, skipped = 0, failed = 0;
for (const beast of targets) {
  const outPath = join(outDir, `${beast.key}.png`);
  if (!force && existsSync(outPath)) { skipped++; console.log(`SKIP  ${beast.key} (already exists)`); continue; }
  const flavor = FLAVOR[beast.key] ?? `a ${beast.key.replace(/_/g, " ")} beast`;
  const prompt = `D&D beast portrait. ${flavor}. ${stylePrompt}`;
  try {
    console.log(`GEN   ${beast.key}...`);
    const resp = await openai.images.generate({
      model:   "gpt-image-1",
      prompt,
      size:    "1024x1024",
      quality: "low",  // beast portrait — small + quick is fine
      n:       1,
    });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error("no image returned");
    writeFileSync(outPath, Buffer.from(b64, "base64"));
    generated++;
    console.log(`DONE  ${beast.key} -> ${outPath}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${beast.key} — ${err?.message ?? err}`);
  }
}

console.log(`\nGenerated ${generated}, skipped ${skipped}, failed ${failed}.`);
process.exit(failed > 0 ? 1 : 0);
