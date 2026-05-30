"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

// ── Music pools ───────────────────────────────────────────────────────────────
// All archive.org URLs serve via HTTP 302 → CDN; <audio> follows redirects.
const MIST_CROWN = "https://archive.org/download/the-eldritch-chime-of-the-ashen-fortress-wkylnl/Mist%20Crown%20-%20The%20Eldritch%20Chime%20Of%20The%20Ashen%20Fortress%20-%20";
const MEDIEVAL   = "https://archive.org/download/medieval-instrumental-background-music/";
const KM         = "https://archive.org/download/Incompetech/mp3-royaltyfree/"; // Kevin MacLeod – CC BY 3.0
const DARK_AMB   = "https://archive.org/download/darkambient_201908/";
const BATTLE_IA  = "https://archive.org/download/battle-ia-item/";
const JAMENDO    = "https://archive.org/download/jamendo-190464/";

// Tavern and social share the same track list (same vibe, same pool)
const TAVERN_TRACKS: string[] = [
  "/Tavern_Theme.mp3",
  `${MEDIEVAL}Celebration.mp3`,
  "https://archive.org/download/minstrel-voyage-medieval-tavern-music-the-medieval-serenade/Minstrel%20Voyage%20%E2%80%94%20Medieval%20Tavern%20Music%20TheMedievalSerenade.mp3",
  `${MIST_CROWN}07%20A%20Kind%20Face.mp3`,
  `${KM}Salty%20Ditty.mp3`,
  `${KM}Drinking%20Song.mp3`,
  `${KM}Ouroboros.mp3`,
  `${KM}Celtic%20Impulse.mp3`,
  `${MEDIEVAL}Royal%20Coupling.mp3`,
];

const POOLS: Record<string, string[]> = {
  tavern: TAVERN_TRACKS,
  social: TAVERN_TRACKS,

  // Active combat
  combat: [
    `${MIST_CROWN}06%20Din%20of%20Battle.mp3`,
    `${BATTLE_IA}battle-orchestra-music.mp3`,
    `${BATTLE_IA}epic-cinematic-battle-theme.mp3`,
    `${BATTLE_IA}to-the-death.mp3`,
    `${KM}Clash%20Defiant.mp3`,
    `${KM}Danger%20Storm.mp3`,
    `${KM}Action.mp3`,
    `${KM}Dark%20Times.mp3`,
    `${KM}Anguish.mp3`,
    "https://soundimage.org/wp-content/uploads/2020/06/Preparing-for-Battle.mp3",
    "https://soundimage.org/wp-content/uploads/2021/08/Ancient-Crusades.mp3",
    "https://soundimage.org/wp-content/uploads/2018/01/Battle-of-the-Ancients.mp3",
    "https://soundimage.org/wp-content/uploads/2016/07/Fantasy-Forest-Battle.mp3",
    "https://soundimage.org/wp-content/uploads/2016/07/Into-Battle.mp3",
    "https://soundimage.org/wp-content/uploads/2016/07/Forward-Assault.mp3",
  ],

  // Dark / underground (dungeon, cave, prison, graveyard)
  dungeon: [
    `${MIST_CROWN}03%20Flickering%20Torchlight.mp3`,
    `${MIST_CROWN}04%20Cursed%20Halls.mp3`,
    `${MIST_CROWN}08%20Twisting%20Corridors.mp3`,
    `${MIST_CROWN}10%20Red%20Abyss.mp3`,
    `${MIST_CROWN}11%20Descend%20the%20Central%20Bell%20Tower.mp3`,
    "https://archive.org/download/dark-fantasy-music-a-blackened-heart/Dark%20Fantasy%20Music%20-%20A%20Blackened%20Heart.mp3",
    `${MEDIEVAL}Cold%20Journey.mp3`,
    `${KM}Atlantean%20Twilight.mp3`,
    `${KM}BlackVortex.mp3`,
    `${KM}Ossuary%206%20-%20Air.mp3`,
    `${KM}Crypteque.mp3`,
    `${DARK_AMB}Dark%20Ambient%20Texture.mp3`,
    `${DARK_AMB}Gloomy.mp3`,
    `${DARK_AMB}Nightmare.mp3`,
    `${DARK_AMB}Suspense%20Piano.mp3`,
  ],

  // Nature / outdoors (forest, wilderness, swamp, mountain, desert)
  nature: [
    `${MEDIEVAL}Cold%20Journey.mp3`,
    `${MEDIEVAL}Nordic%20Wist.mp3`,
    `${JAMENDO}01-1720369-Sapere%20Aude-Fantasy%20Forest.mp3`,
    `${JAMENDO}03-1720368-Sapere%20Aude-Elven%20Dance.mp3`,
    `${KM}Celtic%20Impulse.mp3`,
    `${KM}Enchanted%20Festival.mp3`,
    `${KM}Spring%20Thaw.mp3`,
    `${KM}Folk%20Round.mp3`,
    "https://soundimage.org/wp-content/uploads/2014/09/Our-Mountain_v003.mp3",
    "https://soundimage.org/wp-content/uploads/2023/12/Lost-Jungle.mp3",
    "https://soundimage.org/wp-content/uploads/2020/06/Misty-Bog_remixed.mp3",
  ],

  // Mystical / sacred (temple, library, ruins)
  mystical: [
    `${MIST_CROWN}05%20Long%20Ago%2C%20When%20the%20Light%20Fought%20Shadow.mp3`,
    `${MIST_CROWN}12%20Mist%20Crown.mp3`,
    "https://archive.org/download/dark-fantasy-music-the-witch/Dark%20Fantasy%20Music%20-%20The%20Witch.mp3",
    "https://archive.org/download/magic-fantasy-music-the-last-of-her-kind/Magic%20Fantasy%20Music%20-%20The%20Last%20of%20Her%20Kind.mp3",
    `${JAMENDO}04-1720366-Sapere%20Aude-Mystic%20Swamp.mp3`,
    `${KM}Arcane.mp3`,
    `${KM}Baba%20Yaga.mp3`,
    `${KM}Alchemists%20Tower.mp3`,
    `${DARK_AMB}Wizard%20Place.mp3`,
    "https://soundimage.org/wp-content/uploads/2023/12/Magic-Clock-Shop.mp3",
    "https://soundimage.org/wp-content/uploads/2023/12/Magic-Ocean.mp3",
  ],

  // Majestic / grand (castle, arena)
  epic: [
    `${MIST_CROWN}09%20The%20Ashen%20Fortress.mp3`,
    `${MIST_CROWN}13%20Citadel%20of%20Mist.mp3`,
    `${MIST_CROWN}01%20Foreign%20Shore.mp3`,
    `${MIST_CROWN}02%20Brave%20the%20Unknown.mp3`,
    `${MIST_CROWN}14%20No%20One%20Will%20Know%20of%20Their%20Sacrifice.mp3`,
    `${MEDIEVAL}The%20Britons.mp3`,
    `${MEDIEVAL}Royal%20Coupling.mp3`,
    "https://archive.org/download/epic-fantasy-music-the-wolf-and-the-moon/Epic%20Fantasy%20Music%20-%20The%20Wolf%20and%20the%20Moon.mp3",
    `${KM}Crusade.mp3`,
    `${DARK_AMB}Valhalla.mp3`,
    "https://soundimage.org/wp-content/uploads/2023/12/The-Voyage-Begins.mp3",
    "https://soundimage.org/wp-content/uploads/2020/06/The-Key-to-the-Kingdom.mp3",
    "https://soundimage.org/wp-content/uploads/2020/06/Comrades-Always.mp3",
  ],

  // Maritime (ship)
  sea: [
    `${MEDIEVAL}Cold%20Journey.mp3`,
    `${MIST_CROWN}09%20The%20Ashen%20Fortress.mp3`,
    "https://soundimage.org/wp-content/uploads/2022/04/High-Seas-Adventures.mp3",
    "https://soundimage.org/wp-content/uploads/2020/07/Pirates.mp3",
    "https://soundimage.org/wp-content/uploads/2023/12/City-Beneath-the-Waves.mp3",
    `${KM}Jaunty%20Gypsy.mp3`,
  ],
};

// Maps detect-scene keys → pool name
const SCENE_TO_POOL: Record<string, string> = {
  // Combat variants — every scene type gets one
  tavern_combat:     "combat",
  dungeon_combat:    "combat",
  forest_combat:     "combat",
  cave_combat:       "combat",
  ruins_combat:      "combat",
  castle_combat:     "combat",
  street_combat:     "combat",
  temple_combat:     "combat",
  wilderness_combat: "combat",
  ship_combat:       "combat",
  graveyard_combat:  "combat",
  prison_combat:     "combat",
  library_combat:    "combat",
  port_combat:       "combat",
  desert_combat:     "combat",
  mountain_combat:   "combat",
  swamp_combat:      "combat",
  village_combat:    "combat",
  shop_combat:       "combat",
  arena:             "combat",
  // Non-combat
  dungeon:           "dungeon",
  cave:              "dungeon",
  prison:            "dungeon",
  graveyard:         "dungeon",
  forest:            "nature",
  wilderness:        "nature",
  swamp:             "nature",
  mountain:          "nature",
  desert:            "nature",
  temple:            "mystical",
  library:           "mystical",
  ruins:             "mystical",
  tavern:            "social",
  shop:              "social",
  port:              "social",
  village:           "social",
  street:            "social",
  castle:            "epic",
  ship:              "sea",
};

const POOL_LABELS: Record<string, string> = {
  tavern: "Tavern", social: "Town", combat: "Combat", dungeon: "Dungeon",
  nature: "Wilds", mystical: "Mystical", epic: "Castle", sea: "Sea",
};

const MAX_SKIP = 6;

declare global {
  interface Window {
    __dndMusicPlay?: () => void;
    __dndSetMusicScene?: (scene: string, sceneType?: string, modifiers?: string[]) => void;
    __dndSetAmbiance?: (url: string | null) => void;
  }
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
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const ambianceRef = useRef<HTMLAudioElement | null>(null);

  const [playing,       setPlaying]       = useState(false);
  const [loadError,     setLoadError]     = useState(false);
  const [volume,        setVolume]        = useState(0.10);
  const [ambianceVol,   setAmbianceVol]   = useState(0.60);
  const [ambianceReady, setAmbianceReady] = useState(false);
  const [poolLabel,     setPoolLabel]     = useState("Tavern");

  const targetVolume    = useRef(0.10);
  const targetAmbianceV = useRef(0.60);
  const activePoolKey   = useRef<string>("tavern");
  const fadeTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambianceFade    = useRef<ReturnType<typeof setInterval> | null>(null);
  const musicQueue      = useRef<string[]>([]);
  const musicErrors     = useRef(0);

  const isOnLanding  = pathname === "/";
  const isOnCampaign = !!pathname?.startsWith("/campaign");
  const defaultPool  = isOnCampaign ? "dungeon" : "tavern";

  const getPool = (key: string) => POOLS[key] ?? POOLS.dungeon;

  const clearFade = useCallback(() => {
    if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; }
  }, []);

  // ── Load and play a single track ─────────────────────────────────────────────
  const loadAndPlay = useCallback((src: string, startVol?: number) => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    audio.src    = src;
    audio.volume = startVol ?? targetVolume.current;
    audio.load();
    audio.play().catch(() => {});
  }, []);

  const playNextMusic = useCallback((startVol?: number) => {
    const pool = getPool(activePoolKey.current);
    const { src, queue } = nextFrom(musicQueue.current, pool);
    musicQueue.current = queue;
    loadAndPlay(src, startVol);
  }, [loadAndPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cross-fade to a new pool ──────────────────────────────────────────────────
  const fadeTo = useCallback((targetPool: string) => {
    if (activePoolKey.current === targetPool) return;
    const pool  = getPool(targetPool);
    const audio = audioRef.current;

    activePoolKey.current = targetPool;
    musicQueue.current    = [];
    musicErrors.current   = 0;
    setPoolLabel(POOL_LABELS[targetPool] ?? targetPool);

    if (!audio || audio.paused) return;

    clearFade();
    fadeTimer.current = setInterval(() => {
      const a = audioRef.current;
      if (!a) { clearFade(); return; }
      if (a.volume > 0.04) {
        a.volume = Math.max(0, a.volume - 0.04);
      } else {
        clearFade();
        const { src, queue } = nextFrom(musicQueue.current, pool);
        musicQueue.current = queue;
        a.src    = src;
        a.volume = 0;
        a.load();
        a.play().catch(() => {});
        fadeTimer.current = setInterval(() => {
          const b = audioRef.current;
          if (!b) { clearFade(); return; }
          if (b.volume < targetVolume.current - 0.03) {
            b.volume = Math.min(targetVolume.current, b.volume + 0.04);
          } else {
            b.volume = targetVolume.current;
            clearFade();
          }
        }, 40);
      }
    }, 40);
  }, [clearFade]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ambiance fade helpers ────────────────────────────────────────────────────
  const clearAmbianceFade = useCallback(() => {
    if (ambianceFade.current) { clearInterval(ambianceFade.current); ambianceFade.current = null; }
  }, []);

  const fadeInAmbiance = useCallback(() => {
    const a = ambianceRef.current;
    if (!a) return;
    clearAmbianceFade();
    a.volume = 0;
    a.play().catch(() => {});
    ambianceFade.current = setInterval(() => {
      const b = ambianceRef.current;
      if (!b) { clearAmbianceFade(); return; }
      if (b.volume < targetAmbianceV.current - 0.02) {
        b.volume = Math.min(targetAmbianceV.current, b.volume + 0.02);
      } else {
        b.volume = targetAmbianceV.current;
        clearAmbianceFade();
      }
    }, 60);
  }, [clearAmbianceFade]);

  const fadeOutAmbiance = useCallback((cb?: () => void) => {
    const a = ambianceRef.current;
    if (!a || a.paused) { cb?.(); return; }
    clearAmbianceFade();
    ambianceFade.current = setInterval(() => {
      const b = ambianceRef.current;
      if (!b) { clearAmbianceFade(); cb?.(); return; }
      if (b.volume > 0.02) {
        b.volume = Math.max(0, b.volume - 0.02);
      } else {
        b.volume = 0;
        b.pause();
        clearAmbianceFade();
        cb?.();
      }
    }, 60);
  }, [clearAmbianceFade]);

  // ── Expose global handles ───────────────────────────────────────────────────
  useEffect(() => {
    window.__dndMusicPlay = () => {
      const audio = audioRef.current;
      if (!audio || !audio.paused) return;
      setLoadError(false);
      if (!audio.src) playNextMusic();
      else audio.play().catch(() => {});
    };

    window.__dndSetMusicScene = (scene: string, sceneType?: string, mods?: string[]) => {
      // Priority 1: combat suffix always wins
      if (scene.endsWith("_combat")) { fadeTo("combat"); return; }

      // Priority 2: modifier-based pool overrides
      if (mods && mods.length > 0) {
        const modSet = new Set(mods);
        // Sacred/divine locations → mystical
        if (modSet.has("sacred") || modSet.has("holy") || modSet.has("divine") || modSet.has("blessed") || modSet.has("celestial")) {
          fadeTo("mystical"); return;
        }
        // Nautical modifiers on non-ship scenes → sea
        if (modSet.has("nautical") || modSet.has("tidal") || modSet.has("coastal")) {
          fadeTo("sea"); return;
        }
        // Festive/crowded → social
        if (modSet.has("festive") || modSet.has("crowded") || modSet.has("celebration") || modSet.has("lively")) {
          fadeTo("social"); return;
        }
        // Frozen outdoors → nature (frozen dungeons stay dungeon)
        if ((modSet.has("frozen") || modSet.has("icy") || modSet.has("blizzard")) &&
            (sceneType === "wilderness" || sceneType === "mountain" || sceneType === "forest")) {
          fadeTo("nature"); return;
        }
        // Arcane/ethereal ruins or temples → mystical
        if ((modSet.has("ancient") || modSet.has("ethereal") || modSet.has("arcane") || modSet.has("mystical")) &&
            (sceneType === "ruins" || sceneType === "temple" || sceneType === "library")) {
          fadeTo("mystical"); return;
        }
      }

      // Priority 3: exact match in table
      if (SCENE_TO_POOL[scene]) { fadeTo(SCENE_TO_POOL[scene]); return; }
      // Priority 4: strip modifiers — find the longest base key that prefixes the scene
      const baseKey = Object.keys(SCENE_TO_POOL)
        .filter(k => scene.startsWith(k + "_") || scene === k)
        .sort((a, b) => b.length - a.length)[0];
      fadeTo(SCENE_TO_POOL[baseKey ?? ""] ?? "dungeon");
    };

    window.__dndSetAmbiance = (url: string | null) => {
      const a = ambianceRef.current;
      if (!a) return;
      if (!url) { fadeOutAmbiance(() => { if (ambianceRef.current) ambianceRef.current.src = ""; setAmbianceReady(false); }); return; }
      if (a.src === url) return;
      fadeOutAmbiance(() => {
        const b = ambianceRef.current;
        if (!b) return;
        b.src  = url;
        b.load();
        setAmbianceReady(true);
      });
    };

    return () => { delete window.__dndMusicPlay; delete window.__dndSetMusicScene; delete window.__dndSetAmbiance; };
  }, [playNextMusic, fadeTo, fadeInAmbiance, fadeOutAmbiance]);

  // ── Switch pool on route change (campaign ↔ dashboard) ──────────────────────
  useEffect(() => {
    fadeTo(defaultPool);
  }, [defaultPool, fadeTo]);

  // ── Sync volume knobs ────────────────────────────────────────────────────────
  useEffect(() => {
    targetVolume.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    targetAmbianceV.current = ambianceVol;
    if (ambianceRef.current && !ambianceRef.current.paused) ambianceRef.current.volume = ambianceVol;
  }, [ambianceVol]);

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

  const isTavern = activePoolKey.current === "tavern" || activePoolKey.current === "social";

  if (isOnLanding) return null;

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        loop={isTavern}
        onPlay={()  => { setPlaying(true); setLoadError(false); musicErrors.current = 0; }}
        onPause={()  => { setPlaying(false); }}
        onEnded={() => { if (!isTavern) playNextMusic(); }}
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
        ref={ambianceRef}
        preload="none"
        loop
        onCanPlayThrough={() => { if (ambianceRef.current?.src) fadeInAmbiance(); }}
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
              {poolLabel}
            </span>
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              title="Music volume"
              style={{ width: "48px", accentColor: "var(--primary)", cursor: "pointer" }}
            />
          </>
        )}
        {ambianceReady && (
          <>
            <span style={{ fontSize: "0.65rem", color: "#475569", whiteSpace: "nowrap" }}>🌫</span>
            <input
              type="range" min={0} max={1} step={0.05} value={ambianceVol}
              onChange={e => setAmbianceVol(parseFloat(e.target.value))}
              title="Ambiance volume"
              style={{ width: "42px", accentColor: "#64748b", cursor: "pointer" }}
            />
          </>
        )}
      </div>
    </>
  );
}
