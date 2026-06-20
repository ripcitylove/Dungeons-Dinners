// One-time generator for character-creation art:
//   • Class EMBLEM ICONS  → public/classes/<cls>_icon.png   (ornate sigil crests)
//   • Race PORTRAITS      → public/races/<slug>_<sex>.png    (sex-aware example faces)
//
// Permanent assets — committed and reused forever, so the creation screen never
// calls an image API at runtime. Resumable: existing files are skipped, so a
// re-run continues where a failed run left off. Run: node scripts/gen-creation-art.mjs
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

// ── Load OPENAI_API_KEY from .env.local ──
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

const EMBLEM_STYLE = "Ornate painted heraldic EMBLEM ICON, dark high-fantasy game crest, gold filigree and rich color, dramatic rim lighting, centered symmetrical composition on a dark moody background. A SYMBOL only — absolutely NO people, NO faces, NO full figures, NO text, NO letters, NO numbers, NO watermark. Highly detailed, clean silhouette, suitable as a small UI icon.";

const CLASS_EMBLEM = {
  Fighter:   "two crossed steel longswords over a battered knight's shield",
  Wizard:    "an open spellbook radiating arcane runes and a glowing arcane sigil",
  Rogue:     "a hooded mask above a single curved dagger and a coiled lockpick",
  Cleric:    "a radiant holy sunburst symbol with a stylized chalice at its center",
  Paladin:   "a sacred winged shield bearing an upright sword and a halo of light",
  Ranger:    "a longbow with a nocked arrow wrapped in oak leaves and a feather",
  Bard:      "an ornate lute crossed with a quill, framed by swirling musical notes",
  Warlock:   "an eldritch all-seeing eye within a pact circle of occult runes and tendrils",
  Barbarian: "a massive double-bladed war axe crossed with a cracked tusked skull and fur",
  Druid:     "a great stag's antlers encircling a crescent moon and a sprouting leaf",
  Monk:      "a serene clenched fist within a circular lotus mandala of balance",
  Sorcerer:  "a burst of innate draconic flame curling around a glowing crystalline sigil",
};

const RACE_DESC = {
  Human:       "a human",
  Elf:         "a high elf with long pointed ears and ethereal graceful features",
  Dwarf:       "a stout mountain dwarf with thick braided hair and weathered skin",
  Halfling:    "a halfling, small in stature with a youthful round face and curly hair",
  Dragonborn:  "a dragonborn, a proud draconic humanoid with a scaled reptilian face, horns and no hair",
  Tiefling:    "a tiefling with curling horns, vivid jewel-toned skin, solid-colored eyes and a sly expression",
  Gnome:       "a gnome, small with large bright eyes, an inventive clever look and wild hair",
  "Half-Elf":  "a half-elf with subtly pointed ears blending human and elven features",
  "Half-Orc":  "a half-orc with grey-green skin, a strong jaw, small protruding tusks and fierce eyes",
};

const SEX = {
  male:   "male",
  female: "female",
  nb:     "androgynous, ambiguous-gender",
};

const racePortraitPrompt = (race, sexWord) =>
  `Fantasy RPG character portrait of a ${sexWord} ${RACE_DESC[race]}. Head-and-shoulders composition, facing the viewer, painterly dark-fantasy art, dramatic cinematic lighting, highly detailed expressive face, rich costume hinting at an adventurer. A single believable individual. No text, no watermark, no logos, no plain studio background.`;

const slug = s => s.toLowerCase().replace(/-/g, "_");

// Build the work list
const jobs = [];
for (const [cls, subject] of Object.entries(CLASS_EMBLEM)) {
  jobs.push({ file: path.resolve("public/classes", `${cls.toLowerCase()}_icon.png`), prompt: `${EMBLEM_STYLE} The emblem depicts: ${subject}.`, label: `class:${cls}` });
}
for (const race of Object.keys(RACE_DESC)) {
  for (const [sexKey, sexWord] of Object.entries(SEX)) {
    jobs.push({ file: path.resolve("public/races", `${slug(race)}_${sexKey}.png`), prompt: racePortraitPrompt(race, sexWord), label: `race:${race}/${sexKey}` });
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// The org cap is 5 images/min for gpt-image-1, so we go sequential with retry +
// backoff on 429 (honoring the "try again in Ns" hint) and a steady pace between
// successes to stay under the limit.
async function gen(job) {
  if (fs.existsSync(job.file)) { console.log(`skip (exists)  ${job.label}`); return false; }
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await openai.images.generate({ model: "gpt-image-1", prompt: job.prompt, size: "1024x1024", quality: "medium", n: 1 });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) { console.log(`FAIL (no data) ${job.label}`); return false; }
      fs.writeFileSync(job.file, Buffer.from(b64, "base64"));
      console.log(`saved          ${job.label} -> ${path.relative(process.cwd(), job.file)}`);
      return true;
    } catch (e) {
      const msg = e?.message ?? String(e);
      if (e?.status === 429 || /rate limit/i.test(msg)) {
        const hint = /try again in ([\d.]+)s/i.exec(msg);
        const waitMs = Math.ceil(((hint ? parseFloat(hint[1]) : 13) + 2) * 1000);
        console.log(`  429 ${job.label} — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt})`);
        await sleep(waitMs);
        continue;
      }
      console.log(`ERROR ${job.label}: ${msg}`);
      return false;
    }
  }
  console.log(`GAVE UP ${job.label} after retries`);
  return false;
}

let done = 0;
console.log(`Generating ${jobs.length} images (sequential, rate-limit aware)…`);
for (const job of jobs) {
  const made = await gen(job);
  done++;
  if (made) await sleep(13000); // pace under the 5/min cap
}
console.log(`Done. ${done}/${jobs.length} processed.`);
