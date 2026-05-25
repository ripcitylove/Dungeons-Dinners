"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const TRACKS = {
  tavern: {
    src: "https://archive.org/download/medieval-instrumental-background-music/Dancing%20at%20the%20Inn.mp3",
    label: "Tavern",
  },
  dungeon: {
    src: "https://archive.org/download/medieval-instrumental-background-music/Cold%20Journey.mp3",
    label: "Dungeon",
  },
} as const;

type TrackKey = keyof typeof TRACKS;

export function MusicPlayer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.25);
  const targetVolume = useRef(0.25);
  const activeTrack = useRef<TrackKey>("tavern");
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const trackKey: TrackKey = pathname?.startsWith("/campaign") ? "dungeon" : "tavern";

  // Cross-fade when route changes track
  useEffect(() => {
    if (activeTrack.current === trackKey) return;
    activeTrack.current = trackKey;

    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    if (fadeTimer.current) clearInterval(fadeTimer.current);

    // Fade out
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
        // Fade in
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

  // Sync volume knob → audio element
  useEffect(() => {
    targetVolume.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (!audio.src) {
        audio.src = TRACKS[trackKey].src;
        audio.volume = targetVolume.current;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [trackKey]);

  return (
    <>
      <audio
        ref={audioRef}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
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
          border: `1px solid ${playing ? "rgba(139, 92, 246, 0.45)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: "100px",
          padding: "7px 14px",
          boxShadow: playing ? "0 0 16px rgba(139,92,246,0.15)" : "0 2px 12px rgba(0,0,0,0.4)",
          transition: "border 0.3s, box-shadow 0.3s",
          userSelect: "none",
        }}
      >
        <button
          onClick={toggle}
          title={playing ? "Pause" : "Play background music"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.95rem",
            padding: 0,
            lineHeight: 1,
            color: playing ? "var(--primary)" : "#475569",
            transition: "color 0.2s",
          }}
        >
          {playing ? "⏸" : "♪"}
        </button>

        {playing && (
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
