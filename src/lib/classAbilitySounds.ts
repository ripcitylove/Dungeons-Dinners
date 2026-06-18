// Premium audio cues for class-ability invocations. Each sound is synthesised
// on the fly via the Web Audio API and routed through a master bus that adds
// algorithmic reverb + a warm low-pass — so the cues feel cinematic instead of
// like raw oscillator beeps. Wild Shape forms continue to use real audio files
// (sourced from Wikimedia) for the highest possible quality.

type Voice = (ctx: AudioContext, out: AudioNode, now: number) => void;

// ── Primitive helpers ────────────────────────────────────────────────────────

// A single oscillator with envelope. Optional pitch sweep and vibrato.
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
    vibratoHz?: number;     // LFO rate for vibrato
    vibratoCents?: number;  // LFO depth in cents
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

  // Optional vibrato via LFO modulating detune in cents.
  let lfo: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;
  if (opts.vibratoHz && opts.vibratoCents) {
    lfo = ctx.createOscillator();
    lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = opts.vibratoHz;
    lfoGain.gain.value = opts.vibratoCents;
    lfo.connect(lfoGain).connect(osc.detune);
    lfo.start(now);
    lfo.stop(now + opts.duration + 0.05);
  }

  const peak    = opts.gain ?? 0.18;
  const attack  = Math.max(0.001, opts.attack  ?? 0.005);
  const release = Math.max(0.001, opts.release ?? 0.10);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.setValueAtTime(peak, now + Math.max(attack, opts.duration - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
  osc.connect(gain).connect(out);
  osc.start(now);
  osc.stop(now + opts.duration + 0.05);
}

// Inharmonic bell tone — sounds like a real chime / glass / gong.
// Builds the note from a stack of detuned partials with each partial's gain
// scaled by its ratio. Decay shortens as ratio grows (high partials die fast).
function bell(
  ctx: AudioContext,
  out: AudioNode,
  now: number,
  opts: { freq: number; duration: number; gain?: number; partials?: number[]; brightness?: number; vibratoHz?: number },
) {
  const partials  = opts.partials ?? [1.0, 2.0, 2.756, 5.404, 8.933]; // tubular-bell-ish
  const peak      = opts.gain ?? 0.18;
  const bright    = opts.brightness ?? 0.65;
  for (let i = 0; i < partials.length; i++) {
    const ratio = partials[i];
    const partialGain = peak * Math.pow(bright, i);
    const partialDur  = opts.duration * (1 - Math.min(0.6, i * 0.12));
    note(ctx, out, now, {
      type: "sine",
      freqStart: opts.freq * ratio,
      duration: partialDur,
      attack: 0.003,
      release: partialDur * 0.85,
      gain: partialGain,
      vibratoHz: opts.vibratoHz,
      vibratoCents: opts.vibratoHz ? 4 : undefined,
    });
  }
}

// A sub-bass impact — thumps from a quick pitch-drop sine. Use as combat thuds.
function impact(
  ctx: AudioContext,
  out: AudioNode,
  now: number,
  opts: { freq?: number; duration?: number; gain?: number },
) {
  const freq     = opts.freq ?? 80;
  const duration = opts.duration ?? 0.42;
  const gain     = opts.gain ?? 0.38;
  note(ctx, out, now, {
    type: "sine",
    freqStart: freq * 3.0,
    freqEnd: freq * 0.9,
    duration,
    attack: 0.002,
    release: duration * 0.9,
    gain,
  });
  // Tiny click on top so it cuts through.
  noise(ctx, out, now, { duration: 0.012, centerFreq: 3500, Q: 0.6, gain: gain * 0.4, attack: 0.001, release: 0.008 });
}

// Filtered noise sweep — useful for whooshes, breaths, wind gusts, page turns.
function whoosh(
  ctx: AudioContext,
  out: AudioNode,
  now: number,
  opts: { duration: number; freqStart: number; freqEnd: number; gain?: number; Q?: number; attack?: number; release?: number },
) {
  const buf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * opts.duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src    = ctx.createBufferSource();
  src.buffer   = buf;
  const filter = ctx.createBiquadFilter();
  filter.type  = "bandpass";
  filter.frequency.setValueAtTime(opts.freqStart, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), now + opts.duration);
  filter.Q.value = opts.Q ?? 2.4;
  const gain   = ctx.createGain();
  const peak   = opts.gain ?? 0.18;
  const attack = opts.attack  ?? 0.015;
  const rel    = opts.release ?? Math.max(0.05, opts.duration * 0.45);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.setValueAtTime(peak, now + Math.max(attack, opts.duration - rel));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
  src.connect(filter).connect(gain).connect(out);
  src.start(now);
  src.stop(now + opts.duration + 0.05);
}

// High-frequency sparkle — a fast-decay shimmer for magical accents.
function shimmer(
  ctx: AudioContext,
  out: AudioNode,
  now: number,
  opts: { duration?: number; gain?: number; cutoffHz?: number },
) {
  const duration = opts.duration ?? 0.5;
  const buf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 0.7);
  const src   = ctx.createBufferSource();
  src.buffer  = buf;
  const hp    = ctx.createBiquadFilter();
  hp.type     = "highpass";
  hp.frequency.value = opts.cutoffHz ?? 5500;
  const gain  = ctx.createGain();
  gain.gain.value = opts.gain ?? 0.08;
  src.connect(hp).connect(gain).connect(out);
  src.start(now);
  src.stop(now + duration + 0.05);
}

// Generic noise burst (kept for legacy compatibility — used internally by impact).
function noise(
  ctx: AudioContext,
  out: AudioNode,
  now: number,
  opts: { duration: number; centerFreq?: number; Q?: number; gain?: number; attack?: number; release?: number },
) {
  const buf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * opts.duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src    = ctx.createBufferSource();
  src.buffer   = buf;
  const filter = ctx.createBiquadFilter();
  filter.type  = "bandpass";
  filter.frequency.setValueAtTime(opts.centerFreq ?? 800, now);
  filter.Q.setValueAtTime(opts.Q ?? 1.0, now);
  const gain   = ctx.createGain();
  const peak   = opts.gain ?? 0.22;
  const attack = Math.max(0.001, opts.attack  ?? 0.01);
  const rel    = Math.max(0.001, opts.release ?? 0.20);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.setValueAtTime(peak, now + Math.max(attack, opts.duration - rel));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);
  src.connect(filter).connect(gain).connect(out);
  src.start(now);
  src.stop(now + opts.duration + 0.05);
}

// ── Per-ability voices ───────────────────────────────────────────────────────
// Each voice now layers multiple primitives. The master bus (built in
// `playSynthVoice`) adds reverb tail and warmth on top.

const VOICES: Record<string, Voice> = {
  // 🔥 Barbarian Rage — chest-rattling roar with body slam
  rage: (ctx, out, now) => {
    // Body slam — sub-bass impact
    impact(ctx, out, now, { freq: 60, duration: 0.50, gain: 0.36 });
    // Throat growl — band-pass noise around vocal formants
    noise(ctx, out, now + 0.02, { duration: 0.70, centerFreq: 240, Q: 0.6, gain: 0.22, attack: 0.04, release: 0.30 });
    // Layered low saws with detune for chorus
    note(ctx, out, now + 0.06, { type: "sawtooth", freqStart: 110, freqEnd: 78,  duration: 0.55, gain: 0.16, detune: -10 });
    note(ctx, out, now + 0.06, { type: "sawtooth", freqStart: 110, freqEnd: 78,  duration: 0.55, gain: 0.16, detune: 10 });
    // Bark on top
    note(ctx, out, now + 0.20, { type: "square",   freqStart: 220, freqEnd: 140, duration: 0.30, gain: 0.08 });
  },

  // 🎵 Bardic Inspiration — sparkling rising arpeggio + soft chime tail
  bardic_inspiration: (ctx, out, now) => {
    // Plucked-string-like notes — sine + brief noise click for attack
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    chord.forEach((f, i) => {
      noise(ctx, out, now + i * 0.07, { duration: 0.04, centerFreq: 4500, Q: 1.5, gain: 0.06, attack: 0.001, release: 0.03 });
      note(ctx, out, now + i * 0.07, { type: "triangle", freqStart: f, duration: 0.55, gain: 0.15 - i * 0.015, attack: 0.005, release: 0.35 });
      note(ctx, out, now + i * 0.07, { type: "sine",     freqStart: f * 2, duration: 0.45, gain: 0.05, attack: 0.005, release: 0.30 });
    });
    // Tail bell at the peak
    bell(ctx, out, now + 0.30, { freq: 1046.50, duration: 0.80, gain: 0.10, brightness: 0.45 });
    shimmer(ctx, out, now + 0.20, { duration: 0.55, gain: 0.05 });
  },

  // ✝️ Cleric Channel Divinity — soaring vowel choir
  channel_divinity: (ctx, out, now) => {
    // Sustained vowel choir — many detuned sines with slow vibrato
    const chord = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C major triad spread
    chord.forEach((f, i) => {
      note(ctx, out, now, {
        type: "sine",
        freqStart: f,
        duration: 1.30,
        gain: 0.07 - i * 0.005,
        attack: 0.15,
        release: 0.70,
        detune: (i % 2 ? 6 : -6),
        vibratoHz: 4.5,
        vibratoCents: 8,
      });
    });
    // Formant filter feel via subtle high-frequency noise (breath)
    noise(ctx, out, now, { duration: 1.20, centerFreq: 1500, Q: 1.5, gain: 0.04, attack: 0.20, release: 0.60 });
    shimmer(ctx, out, now + 0.10, { duration: 1.10, gain: 0.05 });
  },

  // 🐺 Druid Wild Shape (generic fallback) — primal call + body shift
  wild_shape: (ctx, out, now) => {
    impact(ctx, out, now, { freq: 90, duration: 0.40, gain: 0.30 });
    noise(ctx, out, now + 0.04, { duration: 0.55, centerFreq: 280, Q: 1.0, gain: 0.22, attack: 0.03, release: 0.25 });
    note(ctx, out, now + 0.08, { type: "sawtooth", freqStart: 165, freqEnd: 110, duration: 0.55, gain: 0.14 });
    note(ctx, out, now + 0.08, { type: "sawtooth", freqStart: 165, freqEnd: 110, duration: 0.55, gain: 0.10, detune: 12 });
  },

  // 💪 Fighter Second Wind — heroic inhale + rising chime
  second_wind: (ctx, out, now) => {
    // Inhale whoosh
    whoosh(ctx, out, now, { duration: 0.45, freqStart: 600, freqEnd: 1500, gain: 0.12, Q: 1.8 });
    // Triumphant chime with vibrato
    note(ctx, out, now + 0.12, { type: "sine", freqStart: 880, freqEnd: 1175, duration: 0.55, gain: 0.16, attack: 0.02, release: 0.40, vibratoHz: 5, vibratoCents: 12 });
    note(ctx, out, now + 0.12, { type: "sine", freqStart: 1760, duration: 0.50, gain: 0.06, attack: 0.04, release: 0.40 });
    shimmer(ctx, out, now + 0.18, { duration: 0.55, gain: 0.06 });
  },

  // ⚡ Fighter Action Surge — thunder crack + electric sizzle
  action_surge: (ctx, out, now) => {
    // Initial crack — wide-band high noise burst
    noise(ctx, out, now, { duration: 0.06, centerFreq: 4000, Q: 0.5, gain: 0.35, attack: 0.001, release: 0.05 });
    // Sub-bass thunder
    impact(ctx, out, now + 0.01, { freq: 50, duration: 0.45, gain: 0.32 });
    // Electric arcs — square pulses sweeping
    note(ctx, out, now + 0.03, { type: "square", freqStart: 220, freqEnd: 880, duration: 0.18, gain: 0.12 });
    note(ctx, out, now + 0.08, { type: "square", freqStart: 660, freqEnd: 220, duration: 0.22, gain: 0.10, detune: 14 });
    // Lingering sizzle
    noise(ctx, out, now + 0.05, { duration: 0.40, centerFreq: 6000, Q: 1.8, gain: 0.08, attack: 0.04, release: 0.30 });
  },

  // ☯️ Monk Ki — true inharmonic gong with breath
  ki: (ctx, out, now) => {
    // Soft mallet strike
    noise(ctx, out, now, { duration: 0.03, centerFreq: 700, Q: 0.5, gain: 0.20, attack: 0.001, release: 0.025 });
    // Inharmonic gong partials — long sustain
    bell(ctx, out, now, { freq: 196, duration: 1.40, gain: 0.22, partials: [1.0, 1.59, 2.14, 2.65, 3.34, 4.51], brightness: 0.55, vibratoHz: 3.0 });
    // Sub-bass anchor
    note(ctx, out, now, { type: "sine", freqStart: 98, duration: 1.20, gain: 0.12, attack: 0.02, release: 0.80 });
    // Distant breath
    noise(ctx, out, now + 0.20, { duration: 1.00, centerFreq: 600, Q: 1.5, gain: 0.04, attack: 0.30, release: 0.60 });
  },

  // 🤲 Paladin Lay on Hands — celestial bell + warm vowel
  lay_on_hands: (ctx, out, now) => {
    // Bright bell at the strike
    bell(ctx, out, now, { freq: 1046.50, duration: 0.95, gain: 0.16, brightness: 0.50, vibratoHz: 4.5 });
    // Warm chord underneath — major third
    note(ctx, out, now + 0.02, { type: "sine", freqStart: 523.25, duration: 0.85, gain: 0.10, attack: 0.05, release: 0.50 });
    note(ctx, out, now + 0.02, { type: "sine", freqStart: 659.25, duration: 0.85, gain: 0.08, attack: 0.05, release: 0.50 });
    shimmer(ctx, out, now + 0.10, { duration: 0.85, gain: 0.06 });
  },

  // 🛡️ Paladin Channel Divinity — solemn brass-like fanfare
  paladin_channel: (ctx, out, now) => {
    // Brass body — multiple saws with light detune
    const chord = [196.00, 246.94, 293.66]; // G minor-ish
    chord.forEach((f, i) => {
      note(ctx, out, now, { type: "sawtooth", freqStart: f, duration: 1.10, gain: 0.10 - i * 0.01, attack: 0.10, release: 0.50, detune: -6, vibratoHz: 4, vibratoCents: 6 });
      note(ctx, out, now, { type: "sawtooth", freqStart: f, duration: 1.10, gain: 0.10 - i * 0.01, attack: 0.10, release: 0.50, detune: 6 });
    });
    // Soft chime accent at the head
    bell(ctx, out, now + 0.05, { freq: 587.33, duration: 0.70, gain: 0.07, brightness: 0.4 });
    noise(ctx, out, now, { duration: 1.00, centerFreq: 800, Q: 2.0, gain: 0.04, attack: 0.20, release: 0.60 });
  },

  // 🎯 Ranger Hunter's Mark — bow draw, release, arrow whistle
  hunters_mark: (ctx, out, now) => {
    // Bow draw — rising filtered noise
    whoosh(ctx, out, now, { duration: 0.18, freqStart: 200, freqEnd: 900, gain: 0.10, Q: 4 });
    // Twang — sharp pitched note
    note(ctx, out, now + 0.16, { type: "triangle", freqStart: 880, freqEnd: 440, duration: 0.32, gain: 0.18, attack: 0.001, release: 0.20 });
    note(ctx, out, now + 0.16, { type: "sine",     freqStart: 1760, freqEnd: 880, duration: 0.28, gain: 0.08 });
    // Arrow whistle
    note(ctx, out, now + 0.28, { type: "sine", freqStart: 2200, freqEnd: 800, duration: 0.40, gain: 0.06 });
  },

  // 💨 Rogue Cunning Action — fast swirling whoosh
  cunning_action: (ctx, out, now) => {
    whoosh(ctx, out, now, { duration: 0.30, freqStart: 1800, freqEnd: 600, gain: 0.18, Q: 3.5 });
    whoosh(ctx, out, now + 0.06, { duration: 0.25, freqStart: 800, freqEnd: 2200, gain: 0.10, Q: 4 });
    note(ctx, out, now + 0.04, { type: "sine", freqStart: 880, freqEnd: 1320, duration: 0.18, gain: 0.06 });
  },

  // 🗡️ Rogue Sneak Attack — metallic shink + bone-crunching thud
  sneak_attack: (ctx, out, now) => {
    // Blade chink — inharmonic high bell
    bell(ctx, out, now, { freq: 2400, duration: 0.30, gain: 0.18, partials: [1.0, 1.51, 2.23, 3.07], brightness: 0.50 });
    // Whoosh of the strike
    whoosh(ctx, out, now, { duration: 0.18, freqStart: 3000, freqEnd: 800, gain: 0.16, Q: 2 });
    // Body impact
    impact(ctx, out, now + 0.08, { freq: 110, duration: 0.30, gain: 0.28 });
  },

  // 💨 Rogue Uncanny Dodge — quick directional whoosh + cape snap
  uncanny_dodge: (ctx, out, now) => {
    whoosh(ctx, out, now, { duration: 0.20, freqStart: 1200, freqEnd: 2400, gain: 0.16, Q: 3 });
    // Cape snap
    noise(ctx, out, now + 0.10, { duration: 0.06, centerFreq: 1500, Q: 0.8, gain: 0.18, attack: 0.001, release: 0.05 });
    note(ctx, out, now + 0.04, { type: "sine", freqStart: 660, freqEnd: 990, duration: 0.16, gain: 0.06 });
  },

  // 🤸 Rogue Evasion — agile leap with rising twin tones
  evasion_rogue: (ctx, out, now) => {
    whoosh(ctx, out, now, { duration: 0.30, freqStart: 800, freqEnd: 2400, gain: 0.12, Q: 3 });
    note(ctx, out, now, { type: "triangle", freqStart: 880,  freqEnd: 1320, duration: 0.22, gain: 0.14 });
    note(ctx, out, now + 0.08, { type: "triangle", freqStart: 1175, freqEnd: 1568, duration: 0.22, gain: 0.10 });
    shimmer(ctx, out, now + 0.10, { duration: 0.32, gain: 0.05 });
  },

  // ✨ Sorcery / Metamagic — crystalline glass bell with shimmer
  sorcery_points: (ctx, out, now) => {
    bell(ctx, out, now, { freq: 1318.51, duration: 0.95, gain: 0.16, partials: [1.0, 2.0, 3.01, 4.97, 6.83], brightness: 0.60, vibratoHz: 5 });
    note(ctx, out, now + 0.02, { type: "sine", freqStart: 2637.02, duration: 0.55, gain: 0.07, attack: 0.005, release: 0.30 });
    shimmer(ctx, out, now, { duration: 0.95, gain: 0.10 });
  },

  // 📖 Wizard Arcane Recovery — gentle page rustle + soft chime
  arcane_recovery: (ctx, out, now) => {
    // Page rustle
    whoosh(ctx, out, now, { duration: 0.30, freqStart: 1800, freqEnd: 800, gain: 0.10, Q: 1.5 });
    noise(ctx, out, now + 0.05, { duration: 0.20, centerFreq: 3500, Q: 1.0, gain: 0.06, attack: 0.04, release: 0.15 });
    // Soft chime
    bell(ctx, out, now + 0.18, { freq: 880, duration: 0.70, gain: 0.12, brightness: 0.50 });
    shimmer(ctx, out, now + 0.20, { duration: 0.55, gain: 0.05 });
  },

  // 🔮 Warlock Eldritch Invocation — otherworldly resonant drone
  eldritch_invocations: (ctx, out, now) => {
    // Layered detuned saws — wide chorus
    const f = 110;
    [-12, -6, 0, 6, 12].forEach((d) => {
      note(ctx, out, now, {
        type: "sawtooth",
        freqStart: f,
        duration: 1.30,
        gain: 0.07,
        attack: 0.20,
        release: 0.70,
        detune: d,
        vibratoHz: 1.6,
        vibratoCents: 12,
      });
    });
    // Sub-bass anchor
    note(ctx, out, now, { type: "sine", freqStart: 55, duration: 1.20, gain: 0.12, attack: 0.15, release: 0.70 });
    // Otherworldly breath
    noise(ctx, out, now + 0.10, { duration: 1.20, centerFreq: 500, Q: 1.2, gain: 0.06, attack: 0.30, release: 0.70 });
    // Distant shimmer high
    shimmer(ctx, out, now + 0.20, { duration: 1.10, gain: 0.05, cutoffHz: 7000 });
  },

  // 📜 Warlock Pact Boon — ritual chant fragment
  pact_boon: (ctx, out, now) => {
    impact(ctx, out, now, { freq: 70, duration: 0.30, gain: 0.22 });
    note(ctx, out, now + 0.04, { type: "triangle", freqStart: 330, freqEnd: 440, duration: 0.40, gain: 0.16, vibratoHz: 5, vibratoCents: 10 });
    note(ctx, out, now + 0.04, { type: "sine",     freqStart: 660, duration: 0.40, gain: 0.06 });
    note(ctx, out, now + 0.14, { type: "triangle", freqStart: 440, freqEnd: 587, duration: 0.42, gain: 0.14, vibratoHz: 5, vibratoCents: 10 });
    note(ctx, out, now + 0.14, { type: "sine",     freqStart: 880, duration: 0.40, gain: 0.06 });
    shimmer(ctx, out, now + 0.10, { duration: 0.50, gain: 0.05 });
  },
};

// ── Wild-Shape form-specific voices (synth fallback when no audio file) ──────
const WILDSHAPE_VOICES: Array<{ matches: RegExp; voice: Voice }> = [
  { matches: /\bbear\b/i, voice: (ctx, out, now) => {
    impact(ctx, out, now, { freq: 50, duration: 0.50, gain: 0.30 });
    noise(ctx, out, now + 0.02, { duration: 0.95, centerFreq: 140, Q: 0.6, gain: 0.28, attack: 0.05, release: 0.45 });
    note(ctx,  out, now + 0.08, { type: "sawtooth", freqStart: 82, freqEnd: 55, duration: 0.85, gain: 0.18, detune: -8 });
    note(ctx,  out, now + 0.08, { type: "sawtooth", freqStart: 82, freqEnd: 55, duration: 0.85, gain: 0.18, detune: 8 });
    note(ctx,  out, now + 0.25, { type: "sawtooth", freqStart: 165, freqEnd: 110, duration: 0.50, gain: 0.07 });
  }},
  { matches: /\bwolf|dire wolf|hound\b/i, voice: (ctx, out, now) => {
    note(ctx, out, now, { type: "triangle", freqStart: 220, freqEnd: 440, duration: 0.60, gain: 0.18, attack: 0.05, release: 0.20, vibratoHz: 5, vibratoCents: 18 });
    note(ctx, out, now + 0.30, { type: "triangle", freqStart: 440, freqEnd: 660, duration: 0.70, gain: 0.15, attack: 0.05, release: 0.40, vibratoHz: 4, vibratoCents: 16 });
    noise(ctx, out, now + 0.50, { duration: 0.50, centerFreq: 300, Q: 1.2, gain: 0.10, attack: 0.05, release: 0.30 });
  }},
  { matches: /\b(eagle|hawk|falcon|owl|raven)\b/i, voice: (ctx, out, now) => {
    note(ctx, out, now,         { type: "triangle", freqStart: 1760, freqEnd: 1100, duration: 0.22, gain: 0.20 });
    note(ctx, out, now + 0.15,  { type: "sawtooth", freqStart: 2200, freqEnd: 1400, duration: 0.22, gain: 0.14 });
    note(ctx, out, now + 0.30,  { type: "triangle", freqStart: 1320, freqEnd: 660,  duration: 0.30, gain: 0.10 });
  }},
  { matches: /\b(snake|serpent|viper|cobra)\b/i, voice: (ctx, out, now) => {
    noise(ctx, out, now, { duration: 0.75, centerFreq: 5000, Q: 0.6, gain: 0.18, attack: 0.10, release: 0.40 });
    noise(ctx, out, now + 0.05, { duration: 0.55, centerFreq: 3000, Q: 1.5, gain: 0.08, attack: 0.10, release: 0.40 });
  }},
  { matches: /\b(rat|mouse|weasel)\b/i, voice: (ctx, out, now) => {
    note(ctx, out, now,         { type: "square", freqStart: 1760, freqEnd: 2640, duration: 0.10, gain: 0.14 });
    note(ctx, out, now + 0.12,  { type: "square", freqStart: 2200, freqEnd: 1760, duration: 0.10, gain: 0.10 });
  }},
  { matches: /\b(panther|tiger|lion|cat|jaguar|leopard)\b/i, voice: (ctx, out, now) => {
    noise(ctx, out, now,        { duration: 0.65, centerFreq: 360, Q: 1.2, gain: 0.24, attack: 0.03, release: 0.30 });
    note(ctx,  out, now + 0.05, { type: "sawtooth", freqStart: 220, freqEnd: 165, duration: 0.55, gain: 0.16, detune: 10 });
    note(ctx,  out, now + 0.05, { type: "sawtooth", freqStart: 220, freqEnd: 165, duration: 0.55, gain: 0.10, detune: -10 });
  }},
  { matches: /\b(horse|riding horse|warhorse|pony)\b/i, voice: (ctx, out, now) => {
    note(ctx, out, now,         { type: "sawtooth", freqStart: 440, freqEnd: 880, duration: 0.20, gain: 0.18 });
    note(ctx, out, now + 0.18,  { type: "sawtooth", freqStart: 880, freqEnd: 440, duration: 0.25, gain: 0.14 });
    note(ctx, out, now + 0.40,  { type: "sawtooth", freqStart: 660, freqEnd: 330, duration: 0.30, gain: 0.10 });
  }},
];

// ── Audio context ────────────────────────────────────────────────────────────
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

export function primeAbilitySounds(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

// ── Master reverb impulse response — built once and cached ───────────────────
// Algorithmic stereo impulse response: random noise multiplied by an
// exponential decay curve. Tuned for "intimate room" reverb that warms the
// tones without smearing transients.
let _impulseCache: AudioBuffer | null = null;
function getImpulseResponse(ctx: AudioContext): AudioBuffer {
  if (_impulseCache && _impulseCache.sampleRate === ctx.sampleRate) return _impulseCache;
  const duration = 1.5;
  const decay    = 2.4;
  const length   = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Slight left/right decorrelation via offset noise — gives a stereo feel.
      const noise = Math.random() * 2 - 1;
      data[i] = noise * Math.pow(1 - t, decay);
    }
  }
  _impulseCache = buf;
  return buf;
}

// ── Real-audio voices (class abilities) ──────────────────────────────────────
// When a clip exists under /sounds/abilities/<key>.mp3 it plays instead of the
// synth voice for that key. Files are generated by
// scripts/generate-ability-sounds.mjs via the ElevenLabs sound-generation API.
// Missing or failed clips fall back to the synth voice — every ability remains
// audible no matter what.
const ABILITY_AUDIO: Record<string, { src: string; maxMs?: number }> = {
  rage:                 { src: "/sounds/abilities/rage.mp3",                 maxMs: 2200 },
  bardic_inspiration:   { src: "/sounds/abilities/bardic_inspiration.mp3",   maxMs: 2200 },
  channel_divinity:     { src: "/sounds/abilities/channel_divinity.mp3",     maxMs: 3500 },
  wild_shape:           { src: "/sounds/abilities/wild_shape.mp3",           maxMs: 2200 },
  second_wind:          { src: "/sounds/abilities/second_wind.mp3",          maxMs: 2200 },
  action_surge:         { src: "/sounds/abilities/action_surge.mp3",         maxMs: 2000 },
  ki:                   { src: "/sounds/abilities/ki.mp3",                   maxMs: 4500 },
  lay_on_hands:         { src: "/sounds/abilities/lay_on_hands.mp3",         maxMs: 3000 },
  paladin_channel:      { src: "/sounds/abilities/paladin_channel.mp3",      maxMs: 3200 },
  hunters_mark:         { src: "/sounds/abilities/hunters_mark.mp3",         maxMs: 1800 },
  cunning_action:       { src: "/sounds/abilities/cunning_action.mp3",       maxMs: 1500 },
  sneak_attack:         { src: "/sounds/abilities/sneak_attack.mp3",         maxMs: 1700 },
  uncanny_dodge:        { src: "/sounds/abilities/uncanny_dodge.mp3",        maxMs: 1500 },
  evasion_rogue:        { src: "/sounds/abilities/evasion_rogue.mp3",        maxMs: 1800 },
  sorcery_points:       { src: "/sounds/abilities/sorcery_points.mp3",       maxMs: 2200 },
  arcane_recovery:      { src: "/sounds/abilities/arcane_recovery.mp3",      maxMs: 2400 },
  eldritch_invocations: { src: "/sounds/abilities/eldritch_invocations.mp3", maxMs: 3800 },
  pact_boon:            { src: "/sounds/abilities/pact_boon.mp3",            maxMs: 3200 },
};

// ── Real-audio voices (spells) ───────────────────────────────────────────────
// Generated via scripts/generate-spell-sounds.mjs. Each entry plays when the
// DM emits a [SPELL:Caster:key] tag in narration. Keys are snake_case.
export const SPELL_AUDIO: Record<string, { src: string; maxMs?: number }> = {
  // Damage
  fire_bolt:          { src: "/sounds/spells/fire_bolt.mp3",          maxMs: 1800 },
  eldritch_blast:     { src: "/sounds/spells/eldritch_blast.mp3",     maxMs: 2200 },
  magic_missile:      { src: "/sounds/spells/magic_missile.mp3",      maxMs: 2200 },
  sacred_flame:       { src: "/sounds/spells/sacred_flame.mp3",       maxMs: 2000 },
  ray_of_frost:       { src: "/sounds/spells/ray_of_frost.mp3",       maxMs: 1900 },
  shocking_grasp:     { src: "/sounds/spells/shocking_grasp.mp3",     maxMs: 1600 },
  thunderwave:        { src: "/sounds/spells/thunderwave.mp3",        maxMs: 2400 },
  acid_splash:        { src: "/sounds/spells/acid_splash.mp3",        maxMs: 1800 },
  chill_touch:        { src: "/sounds/spells/chill_touch.mp3",        maxMs: 2000 },
  poison_spray:       { src: "/sounds/spells/poison_spray.mp3",       maxMs: 1800 },
  vicious_mockery:    { src: "/sounds/spells/vicious_mockery.mp3",    maxMs: 1900 },
  thorn_whip:         { src: "/sounds/spells/thorn_whip.mp3",         maxMs: 1700 },
  burning_hands:      { src: "/sounds/spells/burning_hands.mp3",      maxMs: 2200 },
  guiding_bolt:       { src: "/sounds/spells/guiding_bolt.mp3",       maxMs: 2000 },
  inflict_wounds:     { src: "/sounds/spells/inflict_wounds.mp3",     maxMs: 1900 },
  produce_flame:      { src: "/sounds/spells/produce_flame.mp3",      maxMs: 1800 },
  dissonant_whispers: { src: "/sounds/spells/dissonant_whispers.mp3", maxMs: 2400 },
  ice_knife:          { src: "/sounds/spells/ice_knife.mp3",          maxMs: 1900 },
  // Healing
  cure_wounds:        { src: "/sounds/spells/cure_wounds.mp3",        maxMs: 2200 },
  healing_word:       { src: "/sounds/spells/healing_word.mp3",       maxMs: 1900 },
  goodberry:          { src: "/sounds/spells/goodberry.mp3",          maxMs: 1700 },
  spare_the_dying:    { src: "/sounds/spells/spare_the_dying.mp3",    maxMs: 2000 },
  // Buffs / Protection
  bless:              { src: "/sounds/spells/bless.mp3",              maxMs: 2400 },
  shield:             { src: "/sounds/spells/shield.mp3",             maxMs: 1800 },
  mage_armor:         { src: "/sounds/spells/mage_armor.mp3",         maxMs: 2200 },
  shield_of_faith:    { src: "/sounds/spells/shield_of_faith.mp3",    maxMs: 2200 },
  heroism:            { src: "/sounds/spells/heroism.mp3",            maxMs: 2400 },
  divine_favor:       { src: "/sounds/spells/divine_favor.mp3",       maxMs: 1900 },
  // Utility
  faerie_fire:        { src: "/sounds/spells/faerie_fire.mp3",        maxMs: 2200 },
  detect_magic:       { src: "/sounds/spells/detect_magic.mp3",       maxMs: 2200 },
  sleep:              { src: "/sounds/spells/sleep.mp3",              maxMs: 2400 },
  charm_person:       { src: "/sounds/spells/charm_person.mp3",       maxMs: 2400 },
};

export const KNOWN_SPELL_KEYS = Object.keys(SPELL_AUDIO);

// ── Spell visual metadata ────────────────────────────────────────────────────
// Each spell gets an animation kind (drives the CSS keyframe via the
// `spell-fx-<kind>` class) and a tint color. The display name is the canonical
// spell name as it appears in player chat. targetSide tells the engine which
// card to flash: "target" for spells aimed at others (Fire Bolt, Cure Wounds
// when healing an ally), "caster" for self-targeting spells (Shield, Mage
// Armor), or "both" for AoE / multi-target (Bless, Thunderwave).
export type SpellAnimKind =
  | "heal" | "fire" | "cold" | "lightning" | "thunder" | "acid" | "poison"
  | "radiant" | "necrotic" | "force" | "psychic" | "physical" | "buff" | "enchant";

// `buff` (optional) names the canonical STATUS_EFFECTS entry this spell grants its
// recipient. When the DM emits the spell's [SPELL:...] tag, the engine deterministically
// applies that status effect (so the buff icon ALWAYS shows on the recipient's card —
// no reliance on prose extraction). Recipient = the tag's target if named, else caster.
export const SPELL_META: Record<string, { name: string; anim: SpellAnimKind; color: string; targetSide: "caster" | "target" | "both"; buff?: string }> = {
  // Damage
  fire_bolt:          { name: "Fire Bolt",          anim: "fire",      color: "#f97316", targetSide: "target" },
  eldritch_blast:     { name: "Eldritch Blast",     anim: "force",     color: "#8b5cf6", targetSide: "target" },
  magic_missile:      { name: "Magic Missile",      anim: "force",     color: "#a78bfa", targetSide: "target" },
  sacred_flame:       { name: "Sacred Flame",       anim: "radiant",   color: "#fde047", targetSide: "target" },
  ray_of_frost:       { name: "Ray of Frost",       anim: "cold",      color: "#60a5fa", targetSide: "target" },
  shocking_grasp:     { name: "Shocking Grasp",     anim: "lightning", color: "#fbbf24", targetSide: "target" },
  thunderwave:        { name: "Thunderwave",        anim: "thunder",   color: "#94a3b8", targetSide: "both"   },
  acid_splash:        { name: "Acid Splash",        anim: "acid",      color: "#22c55e", targetSide: "target" },
  chill_touch:        { name: "Chill Touch",        anim: "necrotic",  color: "#a855f7", targetSide: "target" },
  poison_spray:       { name: "Poison Spray",       anim: "poison",    color: "#84cc16", targetSide: "target" },
  vicious_mockery:    { name: "Vicious Mockery",    anim: "psychic",   color: "#ec4899", targetSide: "target" },
  thorn_whip:         { name: "Thorn Whip",         anim: "physical",  color: "#16a34a", targetSide: "target" },
  burning_hands:      { name: "Burning Hands",      anim: "fire",      color: "#ef4444", targetSide: "both"   },
  guiding_bolt:       { name: "Guiding Bolt",       anim: "radiant",   color: "#fde047", targetSide: "target" },
  inflict_wounds:     { name: "Inflict Wounds",     anim: "necrotic",  color: "#7c3aed", targetSide: "target" },
  produce_flame:      { name: "Produce Flame",      anim: "fire",      color: "#f97316", targetSide: "target" },
  dissonant_whispers: { name: "Dissonant Whispers", anim: "psychic",   color: "#ec4899", targetSide: "target" },
  ice_knife:          { name: "Ice Knife",          anim: "cold",      color: "#3b82f6", targetSide: "target" },
  // Healing — green
  cure_wounds:        { name: "Cure Wounds",        anim: "heal",      color: "#22c55e", targetSide: "target" },
  healing_word:       { name: "Healing Word",       anim: "heal",      color: "#4ade80", targetSide: "target" },
  goodberry:          { name: "Goodberry",          anim: "heal",      color: "#65a30d", targetSide: "target" },
  spare_the_dying:    { name: "Spare the Dying",    anim: "heal",      color: "#86efac", targetSide: "target" },
  // Buffs / protection — gold/violet. Each grants a status effect to its recipient.
  bless:              { name: "Bless",              anim: "buff",      color: "#fde68a", targetSide: "both",   buff: "Blessed"         },
  shield:             { name: "Shield",             anim: "buff",      color: "#a78bfa", targetSide: "caster", buff: "Shielded"        },
  mage_armor:         { name: "Mage Armor",         anim: "buff",      color: "#c4b5fd", targetSide: "caster", buff: "Mage Armor"      },
  shield_of_faith:    { name: "Shield of Faith",    anim: "buff",      color: "#fde68a", targetSide: "target", buff: "Shield of Faith" },
  heroism:            { name: "Heroism",            anim: "buff",      color: "#fbbf24", targetSide: "target", buff: "Heroism"         },
  divine_favor:       { name: "Divine Favor",       anim: "buff",      color: "#fcd34d", targetSide: "caster", buff: "Empowered"       },
  guidance:           { name: "Guidance",           anim: "buff",      color: "#fcd34d", targetSide: "target", buff: "Guidance"        },
  shillelagh:         { name: "Shillelagh",         anim: "buff",      color: "#84cc16", targetSide: "caster", buff: "Shillelagh"      },
  resistance:         { name: "Resistance",         anim: "buff",      color: "#60a5fa", targetSide: "target", buff: "Resistance"      },
  barkskin:           { name: "Barkskin",           anim: "buff",      color: "#84cc16", targetSide: "target", buff: "Barkskin"        },
  longstrider:        { name: "Longstrider",        anim: "buff",      color: "#2dd4bf", targetSide: "target", buff: "Longstrider"     },
  aid:                { name: "Aid",                anim: "buff",      color: "#f472b6", targetSide: "target", buff: "Aided"           },
  enlarge:            { name: "Enlarge",            anim: "buff",      color: "#f87171", targetSide: "target", buff: "Enlarged"        },
  reduce:             { name: "Reduce",             anim: "buff",      color: "#94a3b8", targetSide: "target", buff: "Reduced"         },
  protection_from_evil_and_good: { name: "Protection from Evil and Good", anim: "buff", color: "#a78bfa", targetSide: "target", buff: "Protected" },
  // Utility / enchant
  faerie_fire:        { name: "Faerie Fire",        anim: "enchant",   color: "#f472b6", targetSide: "target" },
  detect_magic:       { name: "Detect Magic",       anim: "enchant",   color: "#a78bfa", targetSide: "caster" },
  sleep:              { name: "Sleep",              anim: "enchant",   color: "#818cf8", targetSide: "target" },
  charm_person:       { name: "Charm Person",       anim: "enchant",   color: "#f472b6", targetSide: "target" },
};

/** Preload all known class-ability audio clips. Safe to call multiple times. */
export function preloadAbilityAudio(): void {
  for (const key of Object.keys(ABILITY_AUDIO)) preloadAudio(ABILITY_AUDIO[key].src);
}

/** Preload all known spell audio clips. Safe to call multiple times. */
export function preloadSpellAudio(): void {
  for (const key of Object.keys(SPELL_AUDIO)) preloadAudio(SPELL_AUDIO[key].src);
}

function findSpellAudio(spellKey: string): { el: HTMLAudioElement; maxMs?: number } | null {
  const entry = SPELL_AUDIO[spellKey];
  if (!entry) return null;
  const el = preloadAudio(entry.src);
  if (!el) return null;
  if (_audioCache[entry.src] === "failed") return null;
  return { el, maxMs: entry.maxMs };
}

/**
 * Plays the audio cue for a spell cast. No synth fallback — if the clip is
 * missing, no sound plays (spells without registered audio are simply silent).
 */
export function playSpellSound(spellKey: string, volume = 0.7): void {
  const match = findSpellAudio(spellKey);
  if (match) playRealClip(match, volume);
}

function findAbilityAudio(resourceKey: string): { el: HTMLAudioElement; maxMs?: number } | null {
  const entry = ABILITY_AUDIO[resourceKey];
  if (!entry) return null;
  const el = preloadAudio(entry.src);
  if (!el) return null;
  if (_audioCache[entry.src] === "failed") return null;
  return { el, maxMs: entry.maxMs };
}

// Plays a cached audio clip with optional fade-out cap. Shared by both the
// ability and wildshape real-audio paths.
function playRealClip(match: { el: HTMLAudioElement; maxMs?: number }, volume: number): boolean {
  try {
    const fresh = match.el.cloneNode(true) as HTMLAudioElement;
    fresh.volume = Math.max(0, Math.min(1, volume));
    const p = fresh.play();
    const cap = match.maxMs;
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
      p.catch(() => { /* autoplay blocked or load failed — caller falls through */ });
    }
    return true;
  } catch {
    return false;
  }
}

// ── Real-audio voices (wildshape) ─────────────────────────────────────────────
// ORDER MATTERS — specific patterns first so e.g. "giant owl" matches the owl
// entry instead of being swallowed by the eagle/raptor catch-all, and "cat"
// only matches plain house cat rather than panther/lion.
const WILDSHAPE_AUDIO: Array<{ matches: RegExp; src: string; maxMs?: number }> = [
  // Owls — must come BEFORE the eagle/raptor pattern.
  { matches: /\b(giant owl|owl)\b/i,                                          src: "/sounds/wildshape/owl.mp3",    maxMs: 2400 },
  // Bears
  { matches: /\b(brown bear|black bear|bear)\b/i,                             src: "/sounds/wildshape/bear.mp3",   maxMs: 2600 },
  // Canids
  { matches: /\b(dire wolf|wolf|hound|mastiff|dog)\b/i,                       src: "/sounds/wildshape/wolf.mp3",   maxMs: 3500 },
  // Raptors — AFTER owl so owl doesn't get caught here.
  { matches: /\b(giant eagle|eagle|hawk|falcon|raven)\b/i,                    src: "/sounds/wildshape/eagle.mp3",  maxMs: 2400 },
  // Bats — small flying mammal, distinct from raptors.
  { matches: /\bbat\b/i,                                                       src: "/sounds/wildshape/bat.mp3",    maxMs: 1200 },
  // Big cats — BEFORE the bare "cat" pattern below.
  { matches: /\b(tiger|lion|panther|jaguar|leopard|cougar)\b/i,               src: "/sounds/wildshape/bigcat.mp3", maxMs: 2800 },
  // House cat — bare "cat" only, after bigcat.
  { matches: /\bcat\b/i,                                                       src: "/sounds/wildshape/cat.mp3",    maxMs: 1400 },
  // Equines
  { matches: /\b(warhorse|riding horse|horse|pony)\b/i,                       src: "/sounds/wildshape/horse.mp3",  maxMs: 2600 },
  // Snakes
  { matches: /\b(viper|cobra|snake|serpent)\b/i,                              src: "/sounds/wildshape/snake.mp3",  maxMs: 2400 },
  // Primates
  { matches: /\b(ape|gorilla|chimpanzee|chimp|monkey|baboon|orangutan)\b/i,   src: "/sounds/wildshape/ape.mp3",    maxMs: 2600 },
  // Pigs / boars
  { matches: /\b(boar|pig|hog|swine|warthog)\b/i,                             src: "/sounds/wildshape/boar.mp3",   maxMs: 1700 },
  // Goats
  { matches: /\b(goat|ram)\b/i,                                                src: "/sounds/wildshape/goat.mp3",   maxMs: 1600 },
  // Frogs / toads — BEFORE aquatic catch-all so they don't get a generic splash.
  { matches: /\b(frog|toad|bullfrog)\b/i,                                      src: "/sounds/wildshape/frog.mp3",   maxMs: 1500 },
  // Rodents
  { matches: /\b(rat|mouse|weasel|ferret)\b/i,                                src: "/sounds/wildshape/rat.mp3",    maxMs: 1100 },
  // Arachnids
  { matches: /\b(spider|scorpion|tarantula)\b/i,                               src: "/sounds/wildshape/spider.mp3", maxMs: 2200 },
  // Aquatic catch-all — splash for crocodile, fish, octopus, shark, etc.
  { matches: /\b(crocodile|fish|octopus|shark|alligator|barracuda|dolphin|whale|eel)\b/i, src: "/sounds/wildshape/splash.mp3", maxMs: 1900 },
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

export function preloadWildShapeAudio(): void {
  for (const entry of WILDSHAPE_AUDIO) preloadAudio(entry.src);
}

export function playAbilitySound(resourceKey: string, formHint?: string, volume = 0.7): void {
  // 1. Wild Shape with a form hint → try real animal clip first.
  if (resourceKey === "wild_shape" && formHint) {
    const match = findWildshapeAudio(formHint);
    if (match && playRealClip(match, volume)) return;
  }

  // 2. Class ability with a registered real clip → use it.
  const abilityMatch = findAbilityAudio(resourceKey);
  if (abilityMatch && playRealClip(abilityMatch, volume)) return;

  // 3. Fall back to the synth voice (always-available, premium-tuned).
  playSynthVoice(resourceKey, formHint, volume);
}

// ── Synth playback through master bus (reverb + warm low-pass) ───────────────
function playSynthVoice(resourceKey: string, formHint: string | undefined, volume: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  let voice: Voice | undefined = VOICES[resourceKey];
  if (resourceKey === "wild_shape" && formHint) {
    const match = WILDSHAPE_VOICES.find(v => v.matches.test(formHint));
    if (match) voice = match.voice;
  }
  if (!voice) return;

  // Build the per-invocation master bus:
  //   voice → busInput → [dry, convolverReverb] → warmLowPass → master → output
  const busInput  = ctx.createGain();
  busInput.gain.value = 1.0;

  const dry = ctx.createGain();
  dry.gain.value = 0.78;

  const wet = ctx.createGain();
  wet.gain.value = 0.32;

  const convolver = ctx.createConvolver();
  convolver.buffer = getImpulseResponse(ctx);

  const warmth = ctx.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.frequency.value = 7800;
  warmth.Q.value = 0.55;

  // Subtle high-shelf cut to tame piercing partials
  const tame = ctx.createBiquadFilter();
  tame.type = "highshelf";
  tame.frequency.value = 4200;
  tame.gain.value = -3;

  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));

  busInput.connect(dry);
  dry.connect(tame);
  busInput.connect(convolver);
  convolver.connect(wet);
  wet.connect(tame);
  tame.connect(warmth);
  warmth.connect(master);
  master.connect(ctx.destination);

  voice(ctx, busInput, ctx.currentTime + 0.005);

  // Clean up after the longest possible cue + reverb tail.
  setTimeout(() => {
    try {
      busInput.disconnect();
      dry.disconnect();
      wet.disconnect();
      convolver.disconnect();
      tame.disconnect();
      warmth.disconnect();
      master.disconnect();
    } catch { /* ignore */ }
  }, 3200);
}

/** Public list of known voices — used by tests and dev tooling. */
export const KNOWN_ABILITY_VOICES = Object.keys(VOICES);
