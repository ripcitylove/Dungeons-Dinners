// Lightweight audio cues for class-ability invocations. Each sound is synthesized
// on the fly via the Web Audio API — no asset downloads, no network calls, and
// the entire library weighs zero bytes on disk. Each cue is short (~0.4–1.2s)
// and tinted to the ability's theme so players hear a distinct "yes, that
// fired" feedback when they press a class-ability button.

type Voice = (ctx: AudioContext, out: AudioNode, now: number) => void;

// Helper: schedule a swept oscillator note with an envelope.
function note(
  ctx: AudioContext,
  out: AudioNode,
  now: number,
  opts: {
    type?: OscillatorType;
    freqStart: number;
    freqEnd?: number;
    duration: number;
    attack?: number;
    release?: number;
    gain?: number;
    detune?: number;
  },
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freqStart, now);
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), now + opts.duration);
  }
  if (opts.detune !== undefined) osc.detune.setValueAtTime(opts.detune, now);
  const peak    = opts.gain ?? 0.18;
  const attack  = opts.attack  ?? 0.005;
  const release = opts.release ?? 0.10;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.setValueAtTime(peak, now + opts.duration - release);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
  osc.connect(gain).connect(out);
  osc.start(now);
  osc.stop(now + opts.duration + 0.05);
}

// Helper: schedule a band-passed white-noise burst (great for growls, swooshes,
// drum hits, etc.).
function noise(
  ctx: AudioContext,
  out: AudioNode,
  now: number,
  opts: {
    duration: number;
    centerFreq?: number;
    Q?: number;
    gain?: number;
    attack?: number;
    release?: number;
  },
) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * opts.duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src    = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain   = ctx.createGain();
  src.buffer       = buf;
  filter.type      = "bandpass";
  filter.frequency.setValueAtTime(opts.centerFreq ?? 800, now);
  filter.Q.setValueAtTime(opts.Q ?? 1.0, now);
  const peak    = opts.gain ?? 0.22;
  const attack  = opts.attack ?? 0.01;
  const release = opts.release ?? 0.20;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.setValueAtTime(peak, now + opts.duration - release);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
  src.connect(filter).connect(gain).connect(out);
  src.start(now);
  src.stop(now + opts.duration + 0.05);
}

// ── Per-ability voices ────────────────────────────────────────────────────────
// Each voice gets a master gain + slight stereo widening so the cues feel
// punchier than raw sine tones.
const VOICES: Record<string, Voice> = {
  // 🔥 Barbarian Rage — low growl + sharp bark
  rage: (ctx, out, now) => {
    noise(ctx, out, now,        { duration: 0.55, centerFreq: 180, Q: 0.8, gain: 0.25, attack: 0.02, release: 0.25 });
    note(ctx,  out, now + 0.05, { type: "sawtooth", freqStart: 110, freqEnd: 78,  duration: 0.45, gain: 0.18 });
    note(ctx,  out, now + 0.15, { type: "square",   freqStart: 220, freqEnd: 140, duration: 0.30, gain: 0.10 });
  },

  // 🎵 Bardic Inspiration — rising plucked chord (1-3-5)
  bardic_inspiration: (ctx, out, now) => {
    note(ctx, out, now,         { type: "triangle", freqStart: 440, duration: 0.50, gain: 0.16 });
    note(ctx, out, now + 0.08,  { type: "triangle", freqStart: 554, duration: 0.55, gain: 0.14 });
    note(ctx, out, now + 0.16,  { type: "triangle", freqStart: 659, duration: 0.60, gain: 0.13 });
  },

  // ✝️ Cleric Channel Divinity — high sustained choir
  channel_divinity: (ctx, out, now) => {
    note(ctx, out, now, { type: "sine", freqStart: 523, duration: 0.95, gain: 0.13, attack: 0.10, release: 0.40 });
    note(ctx, out, now, { type: "sine", freqStart: 659, duration: 0.95, gain: 0.10, attack: 0.10, release: 0.40, detune: 5 });
    note(ctx, out, now, { type: "sine", freqStart: 784, duration: 0.95, gain: 0.08, attack: 0.10, release: 0.40 });
  },

  // 🐺 Druid Wild Shape — animal call (lower octave growl). The form-specific
  // bear-growl / wolf-howl / eagle-cry voices live in WILDSHAPE_VOICES below;
  // this default fires when no form is named.
  wild_shape: (ctx, out, now) => {
    noise(ctx, out, now,         { duration: 0.50, centerFreq: 260, Q: 1.0, gain: 0.22, attack: 0.02, release: 0.20 });
    note(ctx,  out, now + 0.05,  { type: "sawtooth", freqStart: 165, freqEnd: 130, duration: 0.50, gain: 0.14 });
  },

  // 💪 Fighter Second Wind — recovery chime + inhale
  second_wind: (ctx, out, now) => {
    noise(ctx, out, now,         { duration: 0.35, centerFreq: 1200, Q: 2.0, gain: 0.10, attack: 0.05, release: 0.20 });
    note(ctx,  out, now + 0.10,  { type: "sine", freqStart: 880, freqEnd: 1175, duration: 0.50, gain: 0.16 });
  },

  // ⚡ Fighter Action Surge — zap / lightning crack
  action_surge: (ctx, out, now) => {
    noise(ctx, out, now,         { duration: 0.25, centerFreq: 3000, Q: 0.7, gain: 0.28, attack: 0.002, release: 0.10 });
    note(ctx,  out, now,         { type: "square", freqStart: 220, freqEnd: 880, duration: 0.20, gain: 0.16 });
    note(ctx,  out, now + 0.08,  { type: "square", freqStart: 660, freqEnd: 220, duration: 0.30, gain: 0.10 });
  },

  // ☯️ Monk Ki — meditation gong (long fade)
  ki: (ctx, out, now) => {
    note(ctx, out, now, { type: "sine",     freqStart: 196, duration: 1.10, gain: 0.20, attack: 0.005, release: 0.80 });
    note(ctx, out, now, { type: "triangle", freqStart: 392, duration: 1.10, gain: 0.10, attack: 0.005, release: 0.80, detune: -7 });
    note(ctx, out, now, { type: "sine",     freqStart: 588, duration: 1.10, gain: 0.05, attack: 0.005, release: 0.80, detune: 4 });
  },

  // 🤲 Paladin Lay on Hands — healing chime (high major chord)
  lay_on_hands: (ctx, out, now) => {
    note(ctx, out, now,         { type: "sine", freqStart: 1047, duration: 0.85, gain: 0.13, attack: 0.02, release: 0.40 });
    note(ctx, out, now + 0.05,  { type: "sine", freqStart: 1319, duration: 0.85, gain: 0.10, attack: 0.02, release: 0.40 });
    note(ctx, out, now + 0.10,  { type: "sine", freqStart: 1568, duration: 0.85, gain: 0.08, attack: 0.02, release: 0.40 });
  },

  // 🛡️ Paladin Channel Divinity — same as Cleric but slightly darker
  paladin_channel: (ctx, out, now) => {
    note(ctx, out, now, { type: "sine", freqStart: 392, duration: 0.95, gain: 0.14, attack: 0.10, release: 0.40 });
    note(ctx, out, now, { type: "sine", freqStart: 494, duration: 0.95, gain: 0.10, attack: 0.10, release: 0.40, detune: 5 });
    note(ctx, out, now, { type: "sine", freqStart: 587, duration: 0.95, gain: 0.08, attack: 0.10, release: 0.40 });
  },

  // 🎯 Ranger Hunter's Mark — bow twang
  hunters_mark: (ctx, out, now) => {
    note(ctx, out, now,         { type: "triangle", freqStart: 880, freqEnd: 660, duration: 0.30, gain: 0.20 });
    note(ctx, out, now + 0.04,  { type: "sine",     freqStart: 440, freqEnd: 330, duration: 0.40, gain: 0.12 });
  },

  // 💨 Rogue Cunning Action — swoosh
  cunning_action: (ctx, out, now) => {
    noise(ctx, out, now, { duration: 0.40, centerFreq: 2400, Q: 0.6, gain: 0.20, attack: 0.005, release: 0.30 });
  },

  // ✨ Sorcery / Metamagic — glassy bell
  sorcery_points: (ctx, out, now) => {
    note(ctx, out, now,         { type: "sine", freqStart: 1318, duration: 0.70, gain: 0.16, attack: 0.005, release: 0.40 });
    note(ctx, out, now + 0.02,  { type: "sine", freqStart: 2637, duration: 0.55, gain: 0.08, attack: 0.005, release: 0.30 });
  },

  // 📖 Wizard Arcane Recovery — gentle page-flip + chime
  arcane_recovery: (ctx, out, now) => {
    noise(ctx, out, now,        { duration: 0.20, centerFreq: 2400, Q: 0.8, gain: 0.12, attack: 0.005, release: 0.10 });
    note(ctx,  out, now + 0.12, { type: "sine", freqStart: 880, freqEnd: 1175, duration: 0.55, gain: 0.14 });
  },

  // 🔮 Warlock Eldritch Invocation — otherworldly drone
  eldritch_invocations: (ctx, out, now) => {
    note(ctx, out, now, { type: "sawtooth", freqStart: 110, duration: 1.00, gain: 0.13, attack: 0.10, release: 0.50, detune: -8 });
    note(ctx, out, now, { type: "sawtooth", freqStart: 138, duration: 1.00, gain: 0.10, attack: 0.10, release: 0.50, detune: 8  });
    note(ctx, out, now, { type: "sine",     freqStart: 220, duration: 1.00, gain: 0.06, attack: 0.10, release: 0.50 });
  },

  // 📜 Warlock Pact Boon — short signature
  pact_boon: (ctx, out, now) => {
    note(ctx, out, now,         { type: "triangle", freqStart: 330, freqEnd: 440, duration: 0.35, gain: 0.18 });
    note(ctx, out, now + 0.12,  { type: "triangle", freqStart: 440, freqEnd: 550, duration: 0.40, gain: 0.14 });
  },
};

// ── Wild-Shape form-specific voices ──────────────────────────────────────────
// When a Druid names a beast form, we play the appropriate critter sound.
// Names are matched case-insensitive and on substring (so "Brown Bear" matches
// the "bear" voice). Falls back to the generic wild_shape voice above.
const WILDSHAPE_VOICES: Array<{ matches: RegExp; voice: Voice }> = [
  { matches: /\bbear\b/i, voice: (ctx, out, now) => {
    // Deep bear growl — heavy low rumble + sawtooth bark
    noise(ctx, out, now,        { duration: 0.85, centerFreq: 140, Q: 0.7, gain: 0.30, attack: 0.05, release: 0.40 });
    note(ctx,  out, now + 0.08, { type: "sawtooth", freqStart: 82,  freqEnd: 55,  duration: 0.80, gain: 0.20 });
    note(ctx,  out, now + 0.20, { type: "sawtooth", freqStart: 165, freqEnd: 110, duration: 0.50, gain: 0.08 });
  }},
  { matches: /\bwolf|dire wolf|hound\b/i, voice: (ctx, out, now) => {
    // Wolf howl — rising pitch on a triangle then a low rumble
    note(ctx, out, now,         { type: "triangle", freqStart: 220, freqEnd: 440, duration: 0.55, gain: 0.18, attack: 0.05, release: 0.20 });
    note(ctx, out, now + 0.30,  { type: "triangle", freqStart: 440, freqEnd: 660, duration: 0.65, gain: 0.15, attack: 0.05, release: 0.40 });
    noise(ctx, out, now + 0.50, { duration: 0.45, centerFreq: 300, Q: 1.2, gain: 0.10, attack: 0.05, release: 0.30 });
  }},
  { matches: /\b(eagle|hawk|falcon|owl|raven)\b/i, voice: (ctx, out, now) => {
    // Raptor cry — sharp descending chirp
    note(ctx, out, now,         { type: "triangle", freqStart: 1760, freqEnd: 1100, duration: 0.20, gain: 0.20 });
    note(ctx, out, now + 0.15,  { type: "sawtooth", freqStart: 2200, freqEnd: 1400, duration: 0.20, gain: 0.14 });
    note(ctx, out, now + 0.30,  { type: "triangle", freqStart: 1320, freqEnd: 660,  duration: 0.30, gain: 0.10 });
  }},
  { matches: /\b(snake|serpent|viper|cobra)\b/i, voice: (ctx, out, now) => {
    // Snake hiss — high-frequency noise burst
    noise(ctx, out, now, { duration: 0.70, centerFreq: 5000, Q: 0.6, gain: 0.18, attack: 0.10, release: 0.40 });
  }},
  { matches: /\b(rat|mouse|weasel)\b/i, voice: (ctx, out, now) => {
    // Tiny squeak
    note(ctx, out, now,         { type: "square", freqStart: 1760, freqEnd: 2640, duration: 0.10, gain: 0.14 });
    note(ctx, out, now + 0.12,  { type: "square", freqStart: 2200, freqEnd: 1760, duration: 0.10, gain: 0.10 });
  }},
  { matches: /\b(panther|tiger|lion|cat|jaguar|leopard)\b/i, voice: (ctx, out, now) => {
    // Feline snarl
    noise(ctx, out, now,        { duration: 0.55, centerFreq: 360, Q: 1.2, gain: 0.22, attack: 0.03, release: 0.30 });
    note(ctx,  out, now + 0.05, { type: "sawtooth", freqStart: 220, freqEnd: 165, duration: 0.50, gain: 0.14 });
  }},
  { matches: /\b(horse|riding horse|warhorse|pony)\b/i, voice: (ctx, out, now) => {
    // Horse neigh
    note(ctx, out, now,         { type: "sawtooth", freqStart: 440, freqEnd: 880, duration: 0.20, gain: 0.18 });
    note(ctx, out, now + 0.18,  { type: "sawtooth", freqStart: 880, freqEnd: 440, duration: 0.25, gain: 0.14 });
    note(ctx, out, now + 0.40,  { type: "sawtooth", freqStart: 660, freqEnd: 330, duration: 0.30, gain: 0.10 });
  }},
];

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_ctx && _ctx.state !== "closed") return _ctx;
  try {
    const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
              ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
    return _ctx;
  } catch {
    return null;
  }
}

/**
 * Resume the shared AudioContext. Browsers suspend audio until a user gesture,
 * and AI-triggered class-ability sounds fire during streaming (no gesture).
 * Call this from any genuine user-gesture handler (button click, key press)
 * so the context is ready for the next streaming-triggered sound.
 */
export function primeAbilitySounds(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

// ── Real-audio voices (loaded once, played from cache) ──────────────────────
// Each entry maps a wildshape form/family to a path under public/sounds/wildshape/.
// When a clip is registered AND loaded, it's played instead of the synth voice
// for that form. Missing or failed clips fall back to the synth voice for that
// form's family — every form remains audible no matter what.
// Each entry is a real-audio clip sourced from Wikimedia Commons (public-domain
// or CC-licensed). Longer clips are capped at ~3 s via maxMs so a wolf-howl
// doesn't run for 10 seconds — the cue is meant as feedback, not background.
const WILDSHAPE_AUDIO: Array<{ matches: RegExp; src: string; maxMs?: number }> = [
  { matches: /\b(brown bear|black bear|bear)\b/i,                  src: "/sounds/wildshape/bear.ogg",   maxMs: 3000 },
  { matches: /\b(dire wolf|wolf|hound|mastiff|dog)\b/i,            src: "/sounds/wildshape/wolf.ogg",   maxMs: 4000 },
  { matches: /\b(giant eagle|eagle|hawk|falcon|raven)\b/i,         src: "/sounds/wildshape/eagle.ogg",  maxMs: 3000 },
  { matches: /\b(tiger|lion|panther|jaguar|leopard|cat|cougar)\b/i, src: "/sounds/wildshape/bigcat.ogg", maxMs: 3500 },
  { matches: /\b(warhorse|riding horse|horse|pony)\b/i,             src: "/sounds/wildshape/horse.ogg",  maxMs: 3000 },
  { matches: /\b(viper|cobra|snake|serpent)\b/i,                    src: "/sounds/wildshape/snake.ogg",  maxMs: 2500 },
  // Apes / primates — howler monkey call stands in for ape/gorilla/baboon too.
  { matches: /\b(ape|gorilla|chimpanzee|chimp|monkey|baboon|orangutan)\b/i, src: "/sounds/wildshape/ape.ogg",  maxMs: 3000 },
  // Boars / pigs — short grunt clip works for boar, giant boar, hog, swine.
  { matches: /\b(boar|pig|hog|swine|warthog)\b/i,                    src: "/sounds/wildshape/boar.ogg",   maxMs: 1500 },
  // Amphibians — frog croak. Listed before the aquatic catch-all so "frog"
  // (which also matches generic water themes) gets its own voice.
  { matches: /\b(frog|toad|bullfrog)\b/i,                            src: "/sounds/wildshape/frog.ogg",   maxMs: 2500 },
  // Aquatic forms — water splash for crocodile, fish, octopus, shark, etc.
  { matches: /\b(crocodile|fish|octopus|shark|alligator|barracuda|dolphin|whale|eel)\b/i, src: "/sounds/wildshape/splash.ogg", maxMs: 2500 },
];

const _audioCache: Record<string, HTMLAudioElement | "loading" | "failed"> = {};

function preloadAudio(src: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const existing = _audioCache[src];
  if (existing && existing !== "loading" && existing !== "failed") return existing;
  if (existing === "loading" || existing === "failed") return null;
  _audioCache[src] = "loading";
  const el = new Audio();
  el.preload = "auto";
  el.src = src;
  el.addEventListener("canplaythrough", () => { _audioCache[src] = el; }, { once: true });
  el.addEventListener("error", () => { _audioCache[src] = "failed"; }, { once: true });
  // Some browsers don't fire canplaythrough until play() is attempted — store
  // the element eagerly so the first call can attempt playback; if it fails,
  // the error handler downgrades to "failed" and synth will be used next time.
  _audioCache[src] = el;
  return el;
}

function findWildshapeAudio(formHint: string): { el: HTMLAudioElement; maxMs?: number } | null {
  for (const entry of WILDSHAPE_AUDIO) {
    if (entry.matches.test(formHint)) {
      const el = preloadAudio(entry.src);
      if (el) return { el, maxMs: entry.maxMs };
    }
  }
  return null;
}

/** Preload all registered wildshape audio clips. Safe to call multiple times. */
export function preloadWildShapeAudio(): void {
  for (const entry of WILDSHAPE_AUDIO) preloadAudio(entry.src);
}

/**
 * Plays the audio cue for a class-ability invocation.
 *
 * @param resourceKey The CLASS_RESOURCES key (e.g. "wild_shape", "ki", "rage").
 * @param formHint    Optional hint — for Wild Shape, the beast name. The function
 *                    picks a form-specific voice (bear growl, wolf howl, raptor
 *                    cry, hiss, etc.) when it can; falls back to the generic
 *                    wild_shape voice.
 * @param volume      Master volume (0.0–1.0). Defaults to 0.7. Use a lower value
 *                    if you want the cue to sit quietly under narration.
 */
export function playAbilitySound(resourceKey: string, formHint?: string, volume = 0.7): void {
  // 1. Real-audio path: for wild_shape with a form hint, try to play a real
  //    animal clip first. The clip plays via HTMLAudioElement (no AudioContext
  //    gymnastics) and bypasses Web Audio entirely.
  if (resourceKey === "wild_shape" && formHint) {
    const match = findWildshapeAudio(formHint);
    if (match && _audioCache[match.el.src] !== "failed") {
      try {
        // Clone so overlapping calls don't cut each other off.
        const fresh = match.el.cloneNode(true) as HTMLAudioElement;
        fresh.volume = Math.max(0, Math.min(1, volume));
        const p = fresh.play();
        const cap = match.maxMs;
        // Fade out + stop at the configured cap so longer howls don't drone on.
        if (cap && cap > 0) {
          const fadeStart = Math.max(0, cap - 250);
          setTimeout(() => {
            try {
              const startVol = fresh.volume;
              const steps = 8;
              for (let i = 1; i <= steps; i++) {
                setTimeout(() => { try { fresh.volume = Math.max(0, startVol * (1 - i / steps)); } catch { /* ignore */ } }, (i * 250) / steps);
              }
            } catch { /* ignore */ }
          }, fadeStart);
          setTimeout(() => { try { fresh.pause(); } catch { /* ignore */ } }, cap);
        }
        if (p instanceof Promise) {
          p.catch(() => {
            // Autoplay blocked or load failed — fall through to synth.
            playSynthVoice(resourceKey, formHint, volume);
          });
          return;
        }
        return;
      } catch {
        // fall through to synth
      }
    }
  }

  playSynthVoice(resourceKey, formHint, volume);
}

function playSynthVoice(resourceKey: string, formHint: string | undefined, volume: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  // Browsers suspend the AudioContext until a user gesture; calling resume()
  // from inside a click handler reliably wakes it up.
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  let voice: Voice | undefined = VOICES[resourceKey];
  if (resourceKey === "wild_shape" && formHint) {
    const match = WILDSHAPE_VOICES.find(v => v.matches.test(formHint));
    if (match) voice = match.voice;
  }
  if (!voice) return;
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  master.connect(ctx.destination);
  voice(ctx, master, ctx.currentTime + 0.005);
  // Clean up the master gain after the longest cue (~1.2s + headroom).
  setTimeout(() => { try { master.disconnect(); } catch { /* ignore */ } }, 1600);
}

/** Public list of known voices — used by tests and dev tooling. */
export const KNOWN_ABILITY_VOICES = Object.keys(VOICES);
