"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const TAVERN_TRACK       = "/Tavern_Theme.mp3";
const TAVERN_MUSIC_POOL  = [TAVERN_TRACK];

// ── Dungeon music pool ────────────────────────────────────────────────────────
const DUNGEON_MUSIC_POOL = [
  "https://archive.org/download/medieval-instrumental-background-music/Cold%20Journey.mp3",
];

const MAX_SKIP = 6;

declare global {
  interface Window { __dndMusicPlay?: () => void; }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextFrom(queue: string[], pool: string[]): { src: string; queue: string[] } {
  const q = queue.length ? queue : shuffle(pool);
  const [src, ...rest] = q;
  return { src: src ?? pool[0], queue: rest };
}

export function MusicPlayer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing,   setPlaying]   = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [volume,    setVolume]    = useState(0.25);

  const targetVolume = useRef(0.25);
  const activeTrack  = useRef<"tavern" | "dungeon">("tavern");
  const fadeTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const musicQueue   = useRef<string[]>([]);
  const musicErrors  = useRef(0);

  const trackKey  = pathname?.startsWith("/campaign") ? "dungeon" : "tavern";
  const musicPool = trackKey === "dungeon" ? DUNGEON_MUSIC_POOL : TAVERN_MUSIC_POOL;

  // ── Music helpers ────────────────────────────────────────────────────────────
  const loadAndPlay = useCallback((src: string, startVol?: number) => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    audio.src = src;
    audio.volume = startVol ?? targetVolume.current;
    audio.load();
    audio.play().catch(() => {});
  }, []);

  const playNextMusic = useCallback((startVol?: number) => {
    const { src, queue } = nextFrom(musicQueue.current, musicPool);
    musicQueue.current = queue;
    loadAndPlay(src, startVol);
  }, [musicPool, loadAndPlay]);

  // ── Expose global play handle ─────────────────────────────────────────────
  useEffect(() => {
    window.__dndMusicPlay = () => {
      const audio = audioRef.current;
      if (!audio || !audio.paused) return;
      setLoadError(false);
      if (!audio.src) playNextMusic();
      else audio.play().catch(() => {});
    };
    return () => { delete window.__dndMusicPlay; };
  }, [playNextMusic]);

  // ── Cross-fade on route change ───────────────────────────────────────────────
  useEffect(() => {
    if (activeTrack.current === trackKey) return;
    activeTrack.current = trackKey;
    musicQueue.current  = [];
    musicErrors.current = 0;

    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    if (fadeTimer.current) clearInterval(fadeTimer.current);

    fadeTimer.current = setInterval(() => {
      if (!audioRef.current) return;
      if (audioRef.current.volume > 0.04) {
        audioRef.current.volume = Math.max(0, audioRef.current.volume - 0.04);
      } else {
        if (fadeTimer.current) clearInterval(fadeTimer.current);
        playNextMusic(0);
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
  }, [trackKey, playNextMusic]);

  // ── Sync volume knob ─────────────────────────────────────────────────────────
  useEffect(() => {
    targetVolume.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── Toggle play / pause ──────────────────────────────────────────────────────
  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setLoadError(false);
      musicErrors.current = 0;
      if (!audio.src) playNextMusic();
      else audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playNextMusic]);

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        loop={trackKey === "tavern"}
        onPlay={()  => { setPlaying(true); setLoadError(false); musicErrors.current = 0; }}
        onPause={()  => { setPlaying(false); }}
        onEnded={() => { if (trackKey !== "tavern") playNextMusic(); }}
        onError={() => {
          musicErrors.current++;
          if (musicErrors.current >= MAX_SKIP) {
            setPlaying(false);
            setLoadError(true);
          } else {
            setTimeout(() => playNextMusic(), 600);
          }
        }}
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
              {trackKey === "dungeon" ? "Dungeon" : "Tavern"}
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
