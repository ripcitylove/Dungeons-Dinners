"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const TRACKS = {
  tavern: {
    src:      "https://opengameart.org/sites/default/files/Kings_Feast_0.mp3",
    ambiance: "https://archive.org/download/Red_Library_Crowds_Indoor_1/R05-06-Congenial%20Crowd.mp3",
    label:    "Tavern",
  },
  dungeon: {
    src:      "https://archive.org/download/medieval-instrumental-background-music/Cold%20Journey.mp3",
    ambiance: null,
    label:    "Dungeon",
  },
} as const;

type TrackKey = keyof typeof TRACKS;

// Ambient volume is intentionally lower than music so crowd noise sits beneath the melody
const AMBIANCE_VOL = 0.28;

// Global handle so the campaign page can call play() directly within its
// own click handler — the only guaranteed way to stay inside a user-gesture
// call stack across all browsers.
declare global {
  interface Window { __dndMusicPlay?: () => void; }
}

function startAmbiance(el: HTMLAudioElement | null, trackKey: TrackKey) {
  if (!el) return;
  const src = TRACKS[trackKey].ambiance;
  if (!src) { el.pause(); el.src = ""; return; }
  if (el.src !== src) { el.src = src; el.volume = AMBIANCE_VOL; }
  el.play().catch(() => {});
}

export function MusicPlayer() {
  const pathname = usePathname();
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const ambRef      = useRef<HTMLAudioElement | null>(null);
  const [playing,   setPlaying]   = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [volume,    setVolume]    = useState(0.25);
  const targetVolume = useRef(0.25);
  const activeTrack  = useRef<TrackKey>("tavern");
  const fadeTimer    = useRef<ReturnType<typeof setInterval> | null>(null);

  const trackKey: TrackKey = pathname?.startsWith("/campaign") ? "dungeon" : "tavern";

  // Expose a direct play function so the campaign page can call it synchronously
  // inside the "Enter the Tavern" button onClick — guaranteeing user-gesture scope.
  useEffect(() => {
    window.__dndMusicPlay = () => {
      const audio = audioRef.current;
      if (!audio || !audio.paused) return;
      setLoadError(false);
      if (!audio.src) { audio.src = TRACKS[trackKey].src; audio.volume = targetVolume.current; }
      audio.play().catch((err) => { console.error("[music] play() blocked:", err); });
      startAmbiance(ambRef.current, trackKey);
    };
    return () => { delete window.__dndMusicPlay; };
  }, [trackKey]);

  // Cross-fade music when route changes track; swap ambiance immediately
  useEffect(() => {
    if (activeTrack.current === trackKey) return;
    activeTrack.current = trackKey;

    const audio = audioRef.current;

    // Always swap ambiance immediately on track change
    if (ambRef.current && !audio?.paused) {
      startAmbiance(ambRef.current, trackKey);
    } else if (ambRef.current && TRACKS[trackKey].ambiance === null) {
      ambRef.current.pause();
    }

    if (!audio || audio.paused) return;

    if (fadeTimer.current) clearInterval(fadeTimer.current);

    fadeTimer.current = setInterval(() => {
      if (!audioRef.current) return;
      if (audioRef.current.volume > 0.04) {
        audioRef.current.volume = Math.max(0, audioRef.current.volume - 0.04);
      } else {
        if (fadeTimer.current) clearInterval(fadeTimer.current);
        audioRef.current.src = TRACKS[trackKey].src;
        audioRef.current.load();
        audioRef.current.volume = 0;
        audioRef.current.play().catch(() => {});
        fadeTimer.current = setInterval(() => {
          if (!audioRef.current) return;
          if (audioRef.current.volume < targetVolume.current - 0.03) {
            audioRef.current.volume = Math.min(targetVolume.current, audioRef.current.volume + 0.04);
          } else {
            audioRef.current.volume = targetVolume.current;
            if (fadeTimer.current) clearInterval(fadeTimer.current);
          }
        }, 40);
      }
    }, 40);

    return () => { if (fadeTimer.current) clearInterval(fadeTimer.current); };
  }, [trackKey]);

  // Sync volume knob → music audio element (ambiance stays at its fixed level)
  useEffect(() => {
    targetVolume.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setLoadError(false);
      if (!audio.src) { audio.src = TRACKS[trackKey].src; audio.volume = targetVolume.current; }
      audio.play().catch((err) => { console.error("[music] play() blocked:", err); });
      startAmbiance(ambRef.current, trackKey);
    } else {
      audio.pause();
      ambRef.current?.pause();
    }
  }, [trackKey]);

  return (
    <>
      <audio
        ref={audioRef}
        loop
        preload="none"
        onPlay={()  => { setPlaying(true);  setLoadError(false); }}
        onPause={()  => { setPlaying(false); ambRef.current?.pause(); }}
        onError={() => { setPlaying(false); setLoadError(true); console.error("[music] failed to load:", TRACKS[trackKey].src); }}
      />
      {/* Ambient layer — crowd chatter for tavern, silent for dungeon */}
      <audio ref={ambRef} loop preload="none" />

      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(10, 7, 24, 0.88)",
          backdropFilter: "blur(14px)",
          border: `1px solid ${loadError ? "rgba(239,68,68,0.5)" : playing ? "rgba(139, 92, 246, 0.45)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: "100px",
          padding: "7px 14px",
          boxShadow: playing ? "0 0 16px rgba(139,92,246,0.15)" : "0 2px 12px rgba(0,0,0,0.4)",
          transition: "border 0.3s, box-shadow 0.3s",
          userSelect: "none",
        }}
      >
        <button
          onClick={toggle}
          title={loadError ? "Music failed to load — click to retry" : playing ? "Pause" : "Play background music"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.95rem",
            padding: 0,
            lineHeight: 1,
            color: loadError ? "#ef4444" : playing ? "var(--primary)" : "#475569",
            transition: "color 0.2s",
          }}
        >
          {loadError ? "⚠" : playing ? "⏸" : "♪"}
        </button>

        {loadError && (
          <span style={{ fontSize: "0.65rem", color: "#ef4444", whiteSpace: "nowrap" }}>
            music unavailable
          </span>
        )}

        {playing && !loadError && (
          <>
            <span style={{ fontSize: "0.65rem", color: "#64748b", whiteSpace: "nowrap" }}>
              {TRACKS[trackKey].label}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{ width: "52px", accentColor: "var(--primary)", cursor: "pointer" }}
            />
          </>
        )}
      </div>
    </>
  );
}
