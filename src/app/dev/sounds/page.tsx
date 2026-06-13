"use client";

import { useEffect, useState } from "react";
import { playAbilitySound, primeAbilitySounds, KNOWN_ABILITY_VOICES } from "../../../lib/classAbilitySounds";

// Each entry maps a voice key to a label + flavour color for the test buttons.
const VOICE_META: Record<string, { label: string; emoji: string; color: string; cls: string }> = {
  rage:                 { label: "Rage",                emoji: "🔥", color: "#ef4444", cls: "Barbarian" },
  bardic_inspiration:   { label: "Bardic Inspiration",  emoji: "🎵", color: "#ec4899", cls: "Bard" },
  channel_divinity:     { label: "Channel Divinity",    emoji: "✝",  color: "#f59e0b", cls: "Cleric" },
  wild_shape:           { label: "Wild Shape (generic)",emoji: "🐺", color: "#65a30d", cls: "Druid" },
  second_wind:          { label: "Second Wind",         emoji: "💪", color: "#ef4444", cls: "Fighter" },
  action_surge:         { label: "Action Surge",        emoji: "⚡", color: "#fbbf24", cls: "Fighter" },
  ki:                   { label: "Ki",                  emoji: "☯",  color: "#06b6d4", cls: "Monk" },
  lay_on_hands:         { label: "Lay on Hands",        emoji: "🤲", color: "#fbbf24", cls: "Paladin" },
  paladin_channel:      { label: "Paladin Channel",     emoji: "🛡", color: "#f97316", cls: "Paladin" },
  hunters_mark:         { label: "Hunter's Mark",       emoji: "🎯", color: "#22c55e", cls: "Ranger" },
  cunning_action:       { label: "Cunning Action",      emoji: "💨", color: "#94a3b8", cls: "Rogue" },
  sneak_attack:         { label: "Sneak Attack",        emoji: "🗡", color: "#94a3b8", cls: "Rogue" },
  uncanny_dodge:        { label: "Uncanny Dodge",       emoji: "👁", color: "#94a3b8", cls: "Rogue" },
  evasion_rogue:        { label: "Evasion",             emoji: "🤸", color: "#94a3b8", cls: "Rogue" },
  sorcery_points:       { label: "Sorcery Points",      emoji: "✨", color: "#a855f7", cls: "Sorcerer" },
  arcane_recovery:      { label: "Arcane Recovery",     emoji: "📖", color: "#3b82f6", cls: "Wizard" },
  eldritch_invocations: { label: "Eldritch Invocation", emoji: "🔮", color: "#8b5cf6", cls: "Warlock" },
  pact_boon:            { label: "Pact Boon",           emoji: "📜", color: "#8b5cf6", cls: "Warlock" },
};

const WILDSHAPE_FORMS = [
  "bear", "wolf", "eagle", "owl", "panther", "snake", "horse", "rat",
  "ape", "boar", "frog", "crocodile", "bat", "cat", "goat", "spider",
] as const;

export default function SoundsTestPage() {
  const [volume, setVolume] = useState(0.7);
  const [lastFired, setLastFired] = useState<string | null>(null);

  // Prime the audio context on first interaction.
  useEffect(() => {
    const wake = () => primeAbilitySounds();
    document.addEventListener("pointerdown", wake, { once: true });
    return () => document.removeEventListener("pointerdown", wake);
  }, []);

  const fire = (key: string, formHint?: string) => {
    primeAbilitySounds();
    playAbilitySound(key, formHint, volume);
    setLastFired(`${key}${formHint ? ` · ${formHint}` : ""}`);
  };

  // Show any synth voice that's registered but not yet listed in VOICE_META
  // (so new voices appear automatically without editing this file).
  const unlistedVoices = KNOWN_ABILITY_VOICES.filter(v => !VOICE_META[v]);

  return (
    <main style={{ minHeight: "100vh", padding: "48px 24px 80px", maxWidth: "1100px", margin: "0 auto" }}>
      <header style={{ marginBottom: "32px" }}>
        <p style={{ color: "var(--primary)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>
          Audio Test Bench
        </p>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 900, marginBottom: "10px" }}>Class Ability Sounds</h1>
        <p style={{ color: "var(--subtle)", fontSize: "1rem", lineHeight: 1.6, maxWidth: "640px" }}>
          Click any cue to play it through the master bus (reverb + warm low-pass + high-shelf tame).
          Use this page to audition voice changes without spinning up a campaign.
        </p>
      </header>

      <section style={{ marginBottom: "32px", display: "flex", alignItems: "center", gap: "18px", padding: "14px 18px", borderRadius: "12px", background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.25)" }}>
        <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#c4b5fd", whiteSpace: "nowrap" }}>
          Volume
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: "#8b5cf6" }}
        />
        <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontVariantNumeric: "tabular-nums", minWidth: "44px", textAlign: "right" }}>
          {Math.round(volume * 100)}%
        </span>
        {lastFired && (
          <span style={{ fontSize: "0.78rem", color: "#fde68a", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            ▶ {lastFired}
          </span>
        )}
      </section>

      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>
        Class Abilities
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px", marginBottom: "40px" }}>
        {Object.entries(VOICE_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => fire(key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 14px",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.45)",
              border: `1px solid ${meta.color}55`,
              color: "white",
              cursor: "pointer",
              textAlign: "left",
              transition: "transform 0.12s, border-color 0.12s, box-shadow 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.boxShadow = `0 6px 18px ${meta.color}33`; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${meta.color}55`; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
          >
            <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>{meta.emoji}</span>
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontSize: "0.92rem", fontWeight: 700, color: meta.color, lineHeight: 1.1 }}>
                {meta.label}
              </span>
              <span style={{ fontSize: "0.7rem", color: "#64748b", letterSpacing: "0.04em", marginTop: "2px" }}>
                {meta.cls} · {key}
              </span>
            </span>
          </button>
        ))}

        {unlistedVoices.length > 0 && unlistedVoices.map(key => (
          <button key={key} onClick={() => fire(key)} style={{ padding: "12px", borderRadius: "10px", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.1)", color: "white", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{key}</span>
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>
        Wild Shape Forms
      </h2>
      <p style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "14px" }}>
        Plays the real-audio clip when available; falls back to the synth wildshape voice for that family.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
        {WILDSHAPE_FORMS.map(form => (
          <button
            key={form}
            onClick={() => fire("wild_shape", form)}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(101,163,13,0.12)",
              border: "1px solid rgba(101,163,13,0.35)",
              color: "#bef264",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 700,
              letterSpacing: "0.03em",
              textTransform: "capitalize",
              transition: "all 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(101,163,13,0.22)"; e.currentTarget.style.borderColor = "rgba(101,163,13,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(101,163,13,0.12)"; e.currentTarget.style.borderColor = "rgba(101,163,13,0.35)"; }}
          >
            {form}
          </button>
        ))}
      </div>
    </main>
  );
}
