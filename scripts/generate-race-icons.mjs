// Pre-generates a colored D&D-style emblem icon for every race shown on the
// character-creation Identity step. Saves to public/races/<race>.png.
// Skips files that already exist (idempotent). Re-run with --force to redo.
//
//   node scripts/generate-race-icons.mjs
//   node scripts/generate-race-icons.mjs --force
//   node scripts/generate-race-icons.mjs --only Elf,Dwarf

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

const outDir = "public/races";
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Each entry is the race name + an iconographic flavor — emblem, not character.
// Filename uses lowercase with hyphens replaced by underscores so "Half-Elf"
// becomes "half_elf.png" (matches the renderer in create-character/page.tsx).
const RACES = [
  { key: "Human",      file: "human",      flavor: "a royal crowned heraldic crest, twin crossed longswords behind a heater shield emblazoned with a stylized lion, regal gold and crimson red" },
  { key: "Elf",        file: "elf",        flavor: "an ornate emerald-and-silver crescent moon entwined with leaves and curling vines, an arrow piercing through, dawn-light glow" },
  { key: "Dwarf",      file: "dwarf",      flavor: "a heraldic warhammer crossed with a pickaxe over a mountain peak, glowing forge-ember runes and bronze gem inlay, deep amber and steel" },
  { key: "Halfling",   file: "halfling",   flavor: "a friendly emblem of a smoking briar pipe over crossed grain stalks and a small round shield, warm earthy greens and tans, cozy and noble" },
  { key: "Dragonborn", file: "dragonborn", flavor: "a fierce dragon head emblem breathing rainbow chromatic flame, scales rendered in iridescent ruby, sapphire and emerald, gold accents" },
  { key: "Tiefling",   file: "tiefling",   flavor: "twin curling demonic horns wreathed in violet hellfire with a glowing infernal sigil between them, crimson and purple flame, gold rim" },
  { key: "Gnome",      file: "gnome",      flavor: "intricate brass clockwork gears framing a glowing magical gem, sparks of arcane lightning, copper and sapphire-blue tones, tinker workshop motif" },
  { key: "Half-Elf",   file: "half_elf",   flavor: "a split heraldic emblem — one half elven leaf-and-moon in silver-green, other half human sword-and-crown in gold-red, mirrored as one crest" },
  { key: "Half-Orc",   file: "half_orc",   flavor: "a great battle-axe crossed with a curving tusk over a tribal painted shield, bone and iron accents, fierce green and bronze tones" },
];

const stylePrompt = "Highly detailed D&D fantasy emblem logo, ornate and heraldic, vibrant colors with gold metallic accents, painted illustration style, isolated centered subject on dark moody background with subtle radial glow, no text, no watermark, no border. Heroic and iconic.";

const targets = RACES.filter(r => !onlyList || onlyList.includes(r.key));
console.log(`Generating ${targets.length} of ${RACES.length} race icons.`);

let generated = 0, skipped = 0, failed = 0;
for (const race of targets) {
  const outPath = join(outDir, `${race.file}.png`);
  if (!force && existsSync(outPath)) { skipped++; console.log(`SKIP  ${race.key} (already exists)`); continue; }
  const prompt = `D&D race emblem — ${race.key}. ${race.flavor}. ${stylePrompt}`;
  try {
    console.log(`GEN   ${race.key}...`);
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
    console.log(`DONE  ${race.key} -> ${outPath}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${race.key} — ${err?.message ?? err}`);
  }
}

console.log(`\nGenerated ${generated}, skipped ${skipped}, failed ${failed}.`);
process.exit(failed > 0 ? 1 : 0);
