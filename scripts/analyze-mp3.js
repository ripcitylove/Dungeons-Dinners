// MP3 frame analyzer — counts frames, detects gaps, reports duration
import fs from "fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/analyze-mp3.js <file.mp3>");
  process.exit(1);
}

const buf = fs.readFileSync(file);
console.log(`File: ${file}, total ${buf.length} bytes`);

// MP3 frame header: 4 bytes
// 11 bits sync (0xFFE), 2 bits MPEG version, 2 bits layer, 1 bit protection,
// 4 bits bitrate index, 2 bits sample rate index, 1 bit padding, 1 bit private,
// 2 bits channel mode, 2 bits mode ext, 1 bit copyright, 1 bit original, 2 bits emphasis

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const SAMPLERATES_V1 = [44100, 48000, 32000];

let frames = 0;
let totalSeconds = 0;
let i = 0;

// Skip ID3v2 tag if present
if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  i = 10 + size;
  console.log(`Skipping ID3v2 header (${10 + size} bytes)`);
}

let lastFrameEnd = i;
let gaps = 0;

while (i < buf.length - 4) {
  if (buf[i] !== 0xFF || (buf[i + 1] & 0xE0) !== 0xE0) {
    i++;
    continue;
  }
  if (i > lastFrameEnd) {
    gaps++;
    if (gaps <= 5) console.log(`  Gap of ${i - lastFrameEnd} bytes before frame at offset ${i}`);
  }
  const byte1 = buf[i + 1];
  const byte2 = buf[i + 2];
  const versionBits = (byte1 >> 3) & 0x03; // 11 = v1
  const layerBits = (byte1 >> 1) & 0x03;   // 01 = layer3
  const bitrateIdx = (byte2 >> 4) & 0x0f;
  const sampleRateIdx = (byte2 >> 2) & 0x03;
  const padding = (byte2 >> 1) & 0x01;

  if (versionBits !== 3 || layerBits !== 1 || bitrateIdx === 0 || bitrateIdx === 15 || sampleRateIdx === 3) {
    i++;
    continue;
  }

  const bitrate = BITRATES_V1_L3[bitrateIdx] * 1000;
  const sampleRate = SAMPLERATES_V1[sampleRateIdx];
  const frameSize = Math.floor((144 * bitrate) / sampleRate) + padding;
  const frameDuration = 1152 / sampleRate;

  frames++;
  totalSeconds += frameDuration;

  if (frames <= 3 || frames % 200 === 0) {
    console.log(`  Frame ${frames} @ offset ${i}: ${bitrate / 1000} kbps, ${sampleRate} Hz, size ${frameSize}`);
  }

  i += frameSize;
  lastFrameEnd = i;
}

console.log(`\nTotal frames: ${frames}`);
console.log(`Total audio duration: ${totalSeconds.toFixed(2)} seconds`);
console.log(`Gaps between frames: ${gaps}`);
console.log(`Last frame ended at byte ${lastFrameEnd} of ${buf.length} (${buf.length - lastFrameEnd} unparsed trailing bytes)`);
