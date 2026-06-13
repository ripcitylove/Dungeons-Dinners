// Pre-generates static example portraits for every player class on the
// character-creation class-select step. Saves to public/classes/<class>.png.
// Skips files that already exist (idempotent). Re-run with --force to redo.
//
//   node scripts/generate-class-portraits.mjs
//   node scripts/generate-class-portraits.mjs --force
//   node scripts/generate-class-portraits.mjs --only Fighter,Wizard

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

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

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const onlyArg = argv.find(a => a.startsWith("--only"));
const onlyList = onlyArg ? onlyArg.replace(/^--only=?/, "").split(",").map(s => s.trim()).filter(Boolean) : null;

const outDir = "public/classes";
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Each class gets an archetypal example portrait — a single representative
// adventurer the player sees as the icon. These are STATIC examples (no name,
// no identity), used purely to communicate "this is what this class looks like."
const CLASSES = [
  { key: "Fighter",   flavor: "a stoic human warrior in plate armor, weathered face, longsword resting against shoulder, scarred from countless battles" },
  { key: "Wizard",    flavor: "an elderly elven wizard in deep blue robes, white beard, glowing staff, intricate arcane sigils on collar" },
  { key: "Rogue",     flavor: "a hooded halfling rogue in dark leather, sly grin, twin daggers crossed at the belt, shadowed face with one bright eye visible" },
  { key: "Cleric",    flavor: "a serene human cleric in silver and gold vestments, holy symbol gleaming, warhammer at side, golden divine aura" },
  { key: "Paladin",   flavor: "a noble human paladin in radiant golden plate armor, kneeling with sword planted, holy white light glowing from the blade" },
  { key: "Ranger",    flavor: "a half-elf ranger in earthtone leathers and cloak, longbow drawn, wolf at side, forest backdrop, alert green eyes" },
  { key: "Bard",      flavor: "a charismatic tiefling bard with violet skin and curling horns, lute in hand, embroidered colorful coat, mid-performance smile" },
  { key: "Warlock",   flavor: "a mysterious human warlock with glowing violet eyes, dark hooded cloak, swirling eldritch tendrils of purple energy around outstretched hand" },
  { key: "Barbarian", flavor: "a fierce half-orc barbarian, muscular and tattooed, massive greataxe over shoulder, war paint, mid-roar, fur and bone armor" },
  { key: "Druid",     flavor: "a wise wood-elf druid in moss-green robes woven with vines, antlered headdress, gnarled wooden staff, glowing nature runes" },
  { key: "Monk",      flavor: "a focused human monk in simple saffron robes, shaved head, hands in fighting stance, calm centered expression, knuckles wrapped" },
  { key: "Sorcerer",  flavor: "a dragonborn sorcerer with copper scales, robes trailing arcane flame, draconic energy crackling around clawed hands, fierce yellow eyes" },
];

const stylePrompt = "Dark fantasy painterly D&D character portrait, head-and-shoulders bust, dramatic cinematic lighting, highly detailed face and clothing, expressive eyes, isolated subject on subtle moody background, no text, no watermark, no logos, no border. Single character only.";

const targets = CLASSES.filter(c => !onlyList || onlyList.includes(c.key));
console.log(`Generating ${targets.length} of ${CLASSES.length} class portraits.`);

let generated = 0, skipped = 0, failed = 0;
for (const cls of targets) {
  const outPath = join(outDir, `${cls.key.toLowerCase()}.png`);
  if (!force && existsSync(outPath)) { skipped++; console.log(`SKIP  ${cls.key} (already exists)`); continue; }
  const prompt = `D&D class portrait — ${cls.key}. ${cls.flavor}. ${stylePrompt}`;
  try {
    console.log(`GEN   ${cls.key}...`);
    const resp = await openai.images.generate({
      model:   "gpt-image-1",
      prompt,
      size:    "1024x1024",
      quality: "low",
      n:       1,
    });
    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) throw new Error("no image returned");
    writeFileSync(outPath, Buffer.from(b64, "base64"));
    generated++;
    console.log(`DONE  ${cls.key} -> ${outPath}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${cls.key} — ${err?.message ?? err}`);
  }
}

console.log(`\nGenerated ${generated}, skipped ${skipped}, failed ${failed}.`);
process.exit(failed > 0 ? 1 : 0);
