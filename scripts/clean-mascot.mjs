// De-matte a mascot PNG: removes the flat background color that anti-aliased
// edge pixels were blended against (the cause of a light "halo" on dark UIs),
// while preserving smooth edges. Straight-alpha un-multiply: F = (C-(1-a)B)/a.
import sharp from "sharp";

const inFile  = process.argv[2];
const outFile = process.argv[3];
const previewFile = process.argv[4]; // optional dark composite for visual check

const { data, info } = await sharp(inFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

// Estimate the matte color B = average RGB of fully-transparent pixels.
let br = 0, bg = 0, bb = 0, n = 0;
for (let p = 0, i = 0; p < W * H; p++, i += C) {
  if (data[i + 3] === 0) { br += data[i]; bg += data[i + 1]; bb += data[i + 2]; n++; }
}
const B = n ? [br / n, bg / n, bb / n] : [255, 255, 255];
console.log("matte B ≈", B.map(v => Math.round(v)));

const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;
const out = Buffer.alloc(W * H * 4);
let cleaned = 0;
for (let p = 0, si = 0, di = 0; p < W * H; p++, si += C, di += 4) {
  let a = data[si + 3];
  let r = data[si], g = data[si + 1], b = data[si + 2];
  if (a === 0) { a = 0; r = g = b = 0; }            // fully clear → zero RGB (no leak)
  else if (a < 8) { a = 0; r = g = b = 0; }          // kill ultra-faint fringe
  else if (a < 255) {                                 // de-matte partial edges
    const af = a / 255;
    r = clamp((r - (1 - af) * B[0]) / af);
    g = clamp((g - (1 - af) * B[1]) / af);
    b = clamp((b - (1 - af) * B[2]) / af);
    cleaned++;
  }
  out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = a;
}
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(outFile);
console.log(`wrote ${outFile} (de-matted ${cleaned} edge px)`);

if (previewFile) {
  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .flatten({ background: { r: 13, g: 11, b: 22 } })
    .png().toFile(previewFile);
  console.log("wrote preview", previewFile);
}
