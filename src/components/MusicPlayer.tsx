"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

// ── Tavern music pool (shuffled each cycle) ───────────────────────────────────
const TAVERN_MUSIC_POOL = [
  "https://opengameart.org/sites/default/files/Kings_Feast_0.mp3",
  "https://archive.org/download/medieval-instrumental-background-music/Through%20The%20Forest.mp3",
  "https://archive.org/download/medieval-instrumental-background-music/Heroic%20Demise%20%28loopable%29.mp3",
  "https://opengameart.org/sites/default/files/PiratesTheme_0.mp3",
];

// ── Tavern ambiance pool — rotates through different atmosphere sounds ─────────
const TAVERN_AMBIANCE_POOL = [
  // Lively crowd
  "https://archive.org/download/Red_Library_Crowds_Indoor_1/R05-06-Congenial%20Crowd.mp3",
  // Quieter murmur
  "https://archive.org/download/Red_Library_Crowds_Indoor_1/R05-01-Quiet%20Indoor%20Crowd.mp3",
  // Fireplace crackling
  "https://archive.org/download/fireplace-sounds-for-ambiance/Fireplace%20Crackling%20Loop.mp3",
  // Rain on window (cozy tavern interior)
  "https://archive.org/download/rain-sounds-interior-ambiance/Rain%20On%20Window%20Interior.mp3",
];

// ── Dungeon music pool ────────────────────────────────────────────────────────
const DUNGEON_MUSIC_POOL = [
  "https://archive.org/download/medieval-instrumental-background-music/Cold%20Journey.mp3",
];

const AMBIANCE_VOL = 0.28;
const MAX_SKIP = 6; // give up showing music after this many consecutive errors

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
  const ambRef   = useRef<HTMLAudioElement | null>(null);

  const [playing,   setPlaying]   = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [volume,    setVolume]    = useState(0.10);

  const targetVolume   = useRef(0.10);
  const activeTrack    = useRef<"tavern" | "dungeon">("tavern");
  const fadeTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const musicQueue     = useRef<string[]>([]);
  const ambianceQueue  = useRef<string[]>([]);
  const musicErrors    = useRef(0);
  const ambianceErrors = useRef(0);

  const trackKey    = pathname?.startsWith("/campaign") ? "dungeon" : "tavern";
  const musicPool   = trackKey === "dungeon" ? DUNGEON_MUSIC_POOL  : TAVERN_MUSIC_POOL;
  const ambPool     = trackKey === "dungeon" ? []                  : TAVERN_AMBIANCE_POOL;

  // ── Ambiance helpers ─────────────────────────────────────────────────────────
  const playNextAmbiance = useCallback(() => {
    const amb = ambRef.current;
    if (!amb || !ambPool.length) { amb?.pause(); return; }
    const { src, queue } = nextFrom(ambianceQueue.current, ambPool);
    if (!src) return;
    ambianceQueue.current = queue;
    amb.src = src;
    amb.volume = AMBIANCE_VOL;
    amb.load();
    amb.play().catch(() => {});
  }, [ambPool]);

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

  // ── Expose global play handle (must be called inside a user-gesture) ─────────
  useEffect(() => {
    window.__dndMusicPlay = () => {
      const audio = audioRef.current;
      if (!audio || !audio.paused) return;
      setLoadError(false);
      if (!audio.src) playNextMusic();
      else audio.play().catch(() => {});
      playNextAmbiance();
    };
    return () => { delete window.__dndMusicPlay; };
  }, [playNextMusic, playNextAmbiance]);

  // ── Cross-fade music on route change ─────────────────────────────────────────
  useEffect(() => {
    if (activeTrack.current === trackKey) return;
    activeTrack.current = trackKey;

    // Reset queues so new context gets a fresh shuffle
    musicQueue.current    = [];
    ambianceQueue.current = [];
    musicErrors.current    = 0;
    ambianceErrors.current = 0;

    const audio = audioRef.current;

    if (ambRef.current) {
      if (!audio?.paused && ambPool.length) playNextAmbiance();
      else { ambRef.current.pause(); }
    }

    if (!audio || audio.paused) return;

    if (fadeTimer.current) clearInterval(fadeTimer.current);

    // Fade out → swap → fade in
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
  }, [trackKey, playNextMusic, playNextAmbiance, ambPool.length]);

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
      playNextAmbiance();
    } else {
      audio.pause();
      ambRef.current?.pause();
    }
  }, [playNextMusic, playNextAmbiance]);

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={()  => { setPlaying(true); setLoadError(false); musicErrors.current = 0; }}
        onPause={()  => { setPlaying(false); ambRef.current?.pause(); }}
        onEnded={() => { playNextMusic(); }}
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
      <audio
        ref={ambRef}
        preload="none"
        onEnded={() => { playNextAmbiance(); }}
        onError={() => {
          ambianceErrors.current++;
          if (ambianceErrors.current < MAX_SKIP) setTimeout(() => playNextAmbiance(), 600);
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
