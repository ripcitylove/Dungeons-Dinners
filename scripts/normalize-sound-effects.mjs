// Loudness-normalises every SFX clip under public/sounds/{abilities,spells,
// wildshape}/*.mp3 to a consistent target loudness so no individual sound is
// jarringly loud or quiet relative to the others. Uses ffmpeg's EBU R128
// loudnorm filter in two-pass mode for accuracy.
//
//   node scripts/normalize-sound-effects.mjs
//   node scripts/normalize-sound-effects.mjs --dry-run    # report only, don't modify files
//
// Target loudness is -18 LUFS integrated, true peak ceiling -1.5 dBTP, LRA 11.
// This sits ~2 dB below the typical ElevenLabs narration level (~-16 LUFS) so
// SFX are clearly audible without competing with the spoken story.
//
// Requires ffmpeg on PATH.

import { execSync } from "node:child_process";
import { readdirSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const TARGET_I   = -18;     // integrated loudness target (LUFS)
const TARGET_LRA = 11;      // loudness range target
const TARGET_TP  = -1.5;    // true peak ceiling (dBTP)

const DIRS = [
  join(ROOT, "public", "sounds", "abilities"),
  join(ROOT, "public", "sounds", "spells"),
  join(ROOT, "public", "sounds", "wildshape"),
];

function ffmpeg(cmd) {
  // ffmpeg writes loudnorm measurements to stderr. execSync doesn't surface
  // stderr on success — append `2>&1` so it's merged into stdout for capture.
  try {
    return execSync(`${cmd} 2>&1`, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  } catch (err) {
    return (err.stdout ?? "") + (err.stderr ?? "");
  }
}

function measure(input) {
  const out = ffmpeg(`ffmpeg -hide_banner -i "${input}" -af "loudnorm=I=${TARGET_I}:LRA=${TARGET_LRA}:TP=${TARGET_TP}:print_format=json" -f null -`);
  // The JSON block is the last `{ ... }` in the output.
  const match = out.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function normalize(input, stats) {
  const tempOut = input.replace(/\.mp3$/i, "._norm.mp3");
  const filter = `loudnorm=I=${TARGET_I}:LRA=${TARGET_LRA}:TP=${TARGET_TP}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true:print_format=summary`;
  ffmpeg(`ffmpeg -y -hide_banner -loglevel error -i "${input}" -af "${filter}" -ar 44100 -b:a 96k "${tempOut}"`);
  if (!existsSync(tempOut)) throw new Error("ffmpeg pass-2 produced no output");
  renameSync(tempOut, input);
}

let totalProcessed = 0;
let totalSkipped = 0;
let totalFailed = 0;

for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith(".mp3") && !f.includes("._norm."));
  console.log(`\n== ${dir.replace(ROOT + "\\", "").replace(/\\/g, "/")} (${files.length} files) ==`);
  for (const f of files) {
    const input = join(dir, f);
    process.stdout.write(`  ⏳ ${f.padEnd(34)} `);
    const stats = measure(input);
    if (!stats) {
      console.log("✗ could not measure (corrupt file?)");
      totalFailed++;
      continue;
    }
    const before = parseFloat(stats.input_i);
    const tp = parseFloat(stats.input_tp);
    // Skip files already in spec (within 0.7 LUFS of target AND not clipping).
    const alreadyOk = Math.abs(before - TARGET_I) < 0.7 && tp < TARGET_TP + 0.5;
    if (alreadyOk) {
      console.log(`✓ already at ${before.toFixed(1)} LUFS — skipping`);
      totalSkipped++;
      continue;
    }
    if (dryRun) {
      console.log(`would normalize: ${before.toFixed(1)} LUFS / TP ${tp.toFixed(1)} → ${TARGET_I} LUFS`);
      continue;
    }
    try {
      normalize(input, stats);
      console.log(`✓ ${before.toFixed(1)} LUFS → ${TARGET_I} LUFS`);
      totalProcessed++;
    } catch (err) {
      const stale = input.replace(/\.mp3$/i, "._norm.mp3");
      if (existsSync(stale)) try { unlinkSync(stale); } catch { /* ignore */ }
      console.log(`✗ pass-2 failed: ${err.message?.slice(0, 60)}`);
      totalFailed++;
    }
  }
}

console.log(`\nDone. ${totalProcessed} normalised, ${totalSkipped} already on-target, ${totalFailed} failed.`);
if (dryRun) console.log("(dry-run mode — no files were modified)");
if (totalFailed > 0) process.exit(1);
