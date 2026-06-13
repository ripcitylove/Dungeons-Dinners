// Regression test: music and ambiance only swap tracks when the scene's pool
// actually changes. Within the same scene, the current track loops forever.

import { readFileSync } from "node:fs";

const player = readFileSync("src/components/MusicPlayer.tsx", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── Music side (already had loop + same-pool early return) ───────────────────
check(
  "music <audio> has the `loop` attribute",
  /ref=\{audioRef\}[\s\S]*?\bloop\b/.test(player),
);
check(
  "fadeTo early-returns when the target pool is already active",
  /const fadeTo = useCallback\(\(targetPool: string\) => \{[\s\S]*?if \(activePoolKey\.current === targetPool\) return;/.test(player),
);

// ── Ambiance side: loop attribute now set ────────────────────────────────────
check(
  "ambiance <audio> has the `loop` attribute",
  /ref=\{ambianceRef\}[\s\S]*?\bloop\b/.test(player),
);

// ── Ambiance side: no auto-rotation on ended ─────────────────────────────────
// Look at the JSX block (not the JS code that defines playNextAmbiance) to make
// sure the ended handler doesn't pick a new track from the pool.
const ambianceJsxMatch = player.match(/<audio\s+ref=\{ambianceRef\}[\s\S]*?\/>/);
check("ambiance audio JSX located", !!ambianceJsxMatch);
if (ambianceJsxMatch) {
  const jsx = ambianceJsxMatch[0];
  check(
    "ambiance JSX has NO onEnded that calls playNextAmbiance",
    !/onEnded=\{[^}]*playNextAmbiance/.test(jsx),
    "ambiance onEnded still rotates — same scene will swap tracks on track end",
  );
}

// ── Ambiance side: same-pool early return in playNextAmbiance ────────────────
const playNextAmbiance = player.match(/const playNextAmbiance = useCallback[\s\S]*?\}, \[fadeOutAmbiance\]\);/);
check("playNextAmbiance defined", !!playNextAmbiance);
if (playNextAmbiance) {
  const body = playNextAmbiance[0];
  check(
    "playNextAmbiance early-returns when the same pool is already playing",
    /if \(activeAmbiancePool\.current === poolKey && ambianceRef\.current\?\.src\) return;/.test(body),
    "missing same-pool guard — same scene will swap ambient track",
  );
  check(
    "empty-pool (combat) still fades the current ambiance out",
    /if \(pool\.length === 0\)[\s\S]*?fadeOutAmbiance\(/.test(body),
    "combat case broken",
  );
  check(
    "new pool path still shuffles and starts a track",
    /if \(activeAmbiancePool\.current !== poolKey \|\| ambianceQueueRef\.current\.length === 0\)[\s\S]*?shuffle\(pool\)/.test(body),
    "new pool path broken — scene changes won't swap ambient",
  );
}

// ── Manual user controls still rotate (the gate is scene-detection only) ─────
check(
  "Skip button still calls playNextMusic directly",
  /const skip = useCallback\(\(\) => \{[\s\S]*?playNextMusic\(0\);/.test(player),
);
check(
  "Pool picker (manual mood swap) still calls fadeTo",
  /const selectPool = useCallback\(\(key: string\) => \{\s*fadeTo\(key\);/.test(player),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
