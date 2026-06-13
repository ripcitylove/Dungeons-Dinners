// Regression test for the Wild Shape audio system.
//
// Goals (per the user's request):
//   1. When a druid activates Wild Shape, play a form-specific sound.
//   2. When Wild Shape is reverted, play the SAME sound used on transformation
//      (not a generic chime).
//   3. Real animal-call audio clips are stored under public/sounds/wildshape/
//      and used in preference to the synth voices; synth is the fallback.
//   4. The AudioContext is primed on the Begin Adventure user gesture so the
//      streaming-triggered ability sound isn't muted by autoplay policy.
//
// This is a static-source test — it asserts file presence, regex shapes, and
// the playback-cap configuration, without depending on a running browser.

import { readFileSync, statSync, existsSync } from "node:fs";

const sounds  = readFileSync("src/lib/classAbilitySounds.ts", "utf8");
const page    = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`OK  ${name}`); pass++; }
  else      { console.log(`FAIL ${name}${hint ? " -- " + hint : ""}`); fail++; }
}

// ── 1. Audio assets are present on disk ─────────────────────────────────────

for (const f of ["bear", "wolf", "eagle", "bigcat", "horse", "snake", "splash", "frog", "ape", "boar"]) {
  const path = `public/sounds/wildshape/${f}.ogg`;
  const exists = existsSync(path);
  check(`${path} exists`, exists);
  if (exists) {
    const size = statSync(path).size;
    check(`${path} is non-trivial (>= 10 KB)`, size >= 10_000, `${size} bytes`);
    check(`${path} is reasonable (<= 500 KB)`, size <= 500_000, `${size} bytes`);
  }
}

// ── 2. classAbilitySounds.ts wires the audio paths ──────────────────────────

check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/bear.ogg",
  /\/sounds\/wildshape\/bear\.ogg/.test(sounds),
);
check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/wolf.ogg",
  /\/sounds\/wildshape\/wolf\.ogg/.test(sounds),
);
check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/eagle.ogg",
  /\/sounds\/wildshape\/eagle\.ogg/.test(sounds),
);
check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/bigcat.ogg",
  /\/sounds\/wildshape\/bigcat\.ogg/.test(sounds),
);
check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/horse.ogg",
  /\/sounds\/wildshape\/horse\.ogg/.test(sounds),
);
check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/snake.ogg",
  /\/sounds\/wildshape\/snake\.ogg/.test(sounds),
);
check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/splash.ogg",
  /\/sounds\/wildshape\/splash\.ogg/.test(sounds),
);
check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/frog.ogg",
  /\/sounds\/wildshape\/frog\.ogg/.test(sounds),
);
check(
  "frog regex covers frog, toad, bullfrog",
  /frog\.ogg/.test(sounds) && /frog\|toad\|bullfrog/.test(sounds),
);
check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/ape.ogg",
  /\/sounds\/wildshape\/ape\.ogg/.test(sounds),
);
check(
  "ape regex covers ape, gorilla, chimp, monkey",
  /ape\.ogg/.test(sounds) && /ape\|gorilla\|chimpanzee\|chimp\|monkey/.test(sounds),
);
check(
  "WILDSHAPE_AUDIO catalog references /sounds/wildshape/boar.ogg",
  /\/sounds\/wildshape\/boar\.ogg/.test(sounds),
);
check(
  "boar regex covers boar, pig, hog, swine",
  /boar\.ogg/.test(sounds) && /boar\|pig\|hog\|swine/.test(sounds),
);
check(
  "splash regex covers crocodile, fish, octopus, and shark",
  /splash\.ogg/.test(sounds) &&
    /crocodile\|fish\|octopus\|shark/.test(sounds),
  "the aquatic forms must map to splash.ogg",
);

check(
  "each catalog entry declares a maxMs playback cap",
  (sounds.match(/maxMs:\s*\d+/g) ?? []).length >= 10,
  "playback should be capped so long clips don't drone on",
);

check(
  "playAbilitySound prefers real audio for wild_shape with a form hint",
  /if \(resourceKey === "wild_shape" && formHint\)\s*\{\s*const match = findWildshapeAudio\(formHint\)/.test(sounds),
  "the real-audio path must run before synth for wildshape with a form",
);

check(
  "playAbilitySound falls back to playSynthVoice on failure",
  /playSynthVoice\(resourceKey, formHint, volume\)/.test(sounds),
  "synth must remain the fallback so every form is audible",
);

check(
  "primeAbilitySounds is exported (for user-gesture resume)",
  /export function primeAbilitySounds\(\)/.test(sounds),
);

check(
  "preloadWildShapeAudio is exported (for early-load on gesture)",
  /export function preloadWildShapeAudio\(\)/.test(sounds),
);

check(
  "playback honors a fade-out + pause at maxMs",
  /setTimeout\(\(\) => \{ try \{ fresh\.pause\(\); \}/.test(sounds),
  "the cap must actually stop playback",
);

// ── 3. Campaign page wires revert-reuse-transform + audio priming ────────────

check(
  "campaign page imports primeAbilitySounds and preloadWildShapeAudio",
  /import \{ playAbilitySound, primeAbilitySounds, preloadWildShapeAudio \} from "\.\.\/\.\.\/\.\.\/lib\/classAbilitySounds"/.test(page),
);

check(
  "Begin Adventure click primes the AudioContext",
  /primeAbilitySounds\(\)/.test(page),
);

check(
  "Begin Adventure click preloads the wildshape audio clips",
  /preloadWildShapeAudio\(\)/.test(page),
);

check(
  "revert path captures the prior form name from status_effects",
  /const wsStatus = currentStatuses\.find\(s => \/\^Wild Shape:\/i\.test\(s\)\);[\s\S]{0,200}const priorForm =/.test(page),
  "revert must read the form before stripping the status entry",
);

check(
  "revert passes priorForm to playAbilitySound so the same sound replays",
  /playAbilitySound\("wild_shape", priorForm \|\| undefined\)/.test(page),
  "the revert sound must be the same form-specific sound used on transform",
);

check(
  "transform path still passes the form name (existing behavior unbroken)",
  /playAbilitySound\("wild_shape", formOrRevert\)/.test(page),
);

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
