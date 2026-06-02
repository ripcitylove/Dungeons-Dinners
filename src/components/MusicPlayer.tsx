"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

// ── Music pools ───────────────────────────────────────────────────────────────
const MIST_CROWN = "https://archive.org/download/the-eldritch-chime-of-the-ashen-fortress-wkylnl/Mist%20Crown%20-%20The%20Eldritch%20Chime%20Of%20The%20Ashen%20Fortress%20-%20";
const MEDIEVAL   = "https://archive.org/download/medieval-instrumental-background-music/";
const KM         = "https://archive.org/download/Incompetech/mp3-royaltyfree/";
const DARK_AMB   = "https://archive.org/download/darkambient_201908/";
const BATTLE_IA  = "https://archive.org/download/battle-ia-item/";
const JAMENDO    = "https://archive.org/download/jamendo-190464/";

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
  sea: [
    "https://soundimage.org/wp-content/uploads/2022/04/High-Seas-Adventures.mp3",
    "https://soundimage.org/wp-content/uploads/2020/07/Pirates.mp3",
    "https://soundimage.org/wp-content/uploads/2023/12/City-Beneath-the-Waves.mp3",
    "https://soundimage.org/wp-content/uploads/2023/12/The-Voyage-Begins.mp3",
    `${MIST_CROWN}01%20Foreign%20Shore.mp3`,
    `${KM}Mariners%20Wharf.mp3`,
    `${KM}Jaunty%20Gypsy.mp3`,
  ],
};

const SCENE_TO_POOL: Record<string, string> = {
  // All combat variants → combat pool
  tavern_combat: "combat", dungeon_combat: "combat", forest_combat: "combat",
  cave_combat: "combat", ruins_combat: "combat", castle_combat: "combat",
  street_combat: "combat", temple_combat: "combat", wilderness_combat: "combat",
  ship_combat: "combat", graveyard_combat: "combat", prison_combat: "combat",
  library_combat: "combat", port_combat: "combat", desert_combat: "combat",
  mountain_combat: "combat", swamp_combat: "combat", village_combat: "combat",
  shop_combat: "combat", arena: "combat", arena_combat: "combat",
  // Dark underground
  dungeon: "dungeon", cave: "dungeon", prison: "dungeon",
  // Eerie / supernatural → mystical (graveyard and swamp are atmospheric, not just dark)
  graveyard: "mystical", swamp: "mystical",
  // Outdoor nature
  forest: "nature", wilderness: "nature", mountain: "nature", desert: "nature",
  // Arcane / sacred
  temple: "mystical", library: "mystical", ruins: "mystical",
  // Social / urban
  tavern: "social", shop: "social", port: "social", village: "social", street: "social",
  // Grand / naval
  castle: "epic", ship: "sea",
};

// ── Pool metadata for the picker ──────────────────────────────────────────────
const POOL_META: { key: string; icon: string; label: string; desc: string }[] = [
  { key: "social",   icon: "🍺", label: "Tavern",   desc: "Folk, warm & social" },
  { key: "nature",   icon: "🌲", label: "Wilds",    desc: "Outdoor & epic nature" },
  { key: "dungeon",  icon: "💀", label: "Dungeon",  desc: "Dark & underground" },
  { key: "mystical", icon: "✨", label: "Mystical", desc: "Arcane & ethereal" },
  { key: "epic",     icon: "🏰", label: "Castle",   desc: "Grand & majestic" },
  { key: "sea",      icon: "⚓", label: "Sea",      desc: "Maritime adventure" },
  { key: "combat",   icon: "⚔",  label: "Combat",   desc: "Intense battle" },
];

const POOL_LABELS: Record<string, string> = {
  tavern: "Tavern", social: "Tavern", combat: "Combat", dungeon: "Dungeon",
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

// Pure function — mirrors __dndSetMusicScene logic without side effects (used for "recommended" display)
function computePool(scene: string, sceneType?: string, mods?: string[]): string {
  if (scene.endsWith("_combat")) return "combat";
  if (mods && mods.length > 0) {
    const modSet = new Set(mods);
    if (modSet.has("sacred") || modSet.has("holy") || modSet.has("divine") || modSet.has("blessed") || modSet.has("celestial") || modSet.has("altar") || modSet.has("ritual")) return "mystical";
    if (modSet.has("nautical") || modSet.has("tidal") || modSet.has("coastal") || modSet.has("harbor") || modSet.has("dock") || modSet.has("port")) return "sea";
    if (modSet.has("festive") || modSet.has("crowded") || modSet.has("celebration") || modSet.has("lively") || modSet.has("market")) return "social";
    if (modSet.has("haunted") || modSet.has("cursed") || modSet.has("ethereal") || modSet.has("ghostly") || modSet.has("spectral") || modSet.has("eerie") || modSet.has("bone") || modSet.has("crypt")) return "mystical";
    if (modSet.has("arcane") || modSet.has("magical") || modSet.has("mystical") || modSet.has("glowing") || modSet.has("bioluminescent") || modSet.has("crystal")) return "mystical";
    if (modSet.has("throne") || modSet.has("grand") || modSet.has("great_hall") || modSet.has("vaulted") || modSet.has("battlements")) return "epic";
    if (modSet.has("stormy") || modSet.has("frozen") || modSet.has("icy") || modSet.has("blizzard") || modSet.has("volcanic") || modSet.has("cliff") || modSet.has("canyon")) return "nature";
    if ((modSet.has("underground") || modSet.has("collapsed") || modSet.has("flooded") || modSet.has("iron") || modSet.has("pit")) &&
        (sceneType === "dungeon" || sceneType === "cave" || sceneType === "prison")) return "dungeon";
  }
  if (SCENE_TO_POOL[scene]) return SCENE_TO_POOL[scene];
  const baseKey = Object.keys(SCENE_TO_POOL)
    .filter(k => scene.startsWith(k + "_") || scene === k)
    .sort((a, b) => b.length - a.length)[0];
  return SCENE_TO_POOL[baseKey ?? ""] ?? "dungeon";
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
  const [pickerOpen,    setPickerOpen]    = useState(false);
  const [recommended,   setRecommended]   = useState<string | null>(null);

  const targetVolume    = useRef(0.10);
  const targetAmbianceV = useRef(0.60);
  const activePoolKey   = useRef<string>("tavern");
  const fadeTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambianceFade    = useRef<ReturnType<typeof setInterval> | null>(null);
  const musicQueue      = useRef<string[]>([]);
  const musicErrors     = useRef(0);
  const lastSceneArgs   = useRef<{ scene: string; type?: string; mods?: string[] } | null>(null);

  const isOnLanding  = pathname === "/";
  const isOnCampaign = !!pathname?.startsWith("/campaign");
  const defaultPool  = isOnCampaign ? "dungeon" : "tavern";

  const getPool = (key: string) => POOLS[key] ?? POOLS.dungeon;

  const clearFade = useCallback(() => {
    if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; }
  }, []);

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

  // ── Expose global handles ────────────────────────────────────────────────────
  useEffect(() => {
    window.__dndMusicPlay = () => {
      const audio = audioRef.current;
      if (!audio || !audio.paused) return;
      setLoadError(false);
      if (!audio.src) playNextMusic();
      else audio.play().catch(() => {});
    };

    window.__dndSetMusicScene = (scene: string, sceneType?: string, mods?: string[]) => {
      // Store for "match scene" button in the picker
      lastSceneArgs.current = { scene, type: sceneType, mods };
      setRecommended(computePool(scene, sceneType, mods));

      // Auto-switch pool
      if (scene.endsWith("_combat")) { fadeTo("combat"); return; }
      if (mods && mods.length > 0) {
        const modSet = new Set(mods);
        // Sacred / divine → mystical
        if (modSet.has("sacred") || modSet.has("holy") || modSet.has("divine") || modSet.has("blessed") || modSet.has("celestial") || modSet.has("altar") || modSet.has("ritual")) { fadeTo("mystical"); return; }
        // Nautical → sea
        if (modSet.has("nautical") || modSet.has("tidal") || modSet.has("coastal") || modSet.has("harbor") || modSet.has("dock") || modSet.has("port")) { fadeTo("sea"); return; }
        // Social / festive
        if (modSet.has("festive") || modSet.has("crowded") || modSet.has("celebration") || modSet.has("lively") || modSet.has("market")) { fadeTo("social"); return; }
        // Eerie / haunted → mystical regardless of scene type
        if (modSet.has("haunted") || modSet.has("cursed") || modSet.has("ethereal") || modSet.has("ghostly") || modSet.has("spectral") || modSet.has("eerie") || modSet.has("bone") || modSet.has("crypt")) { fadeTo("mystical"); return; }
        // Arcane / magical → mystical
        if (modSet.has("arcane") || modSet.has("magical") || modSet.has("mystical") || modSet.has("glowing") || modSet.has("bioluminescent") || modSet.has("crystal")) { fadeTo("mystical"); return; }
        // Grand / castle features → epic
        if (modSet.has("throne") || modSet.has("grand") || modSet.has("great_hall") || modSet.has("vaulted") || modSet.has("battlements")) { fadeTo("epic"); return; }
        // Storm / nature extremes → nature
        if (modSet.has("stormy") || modSet.has("frozen") || modSet.has("icy") || modSet.has("blizzard") || modSet.has("volcanic") || modSet.has("cliff") || modSet.has("canyon")) { fadeTo("nature"); return; }
        // Underground / dark → dungeon
        if (modSet.has("underground") || modSet.has("collapsed") || modSet.has("flooded") || modSet.has("iron") || modSet.has("pit")) {
          if (sceneType === "dungeon" || sceneType === "cave" || sceneType === "prison") { fadeTo("dungeon"); return; }
        }
      }
      if (SCENE_TO_POOL[scene]) { fadeTo(SCENE_TO_POOL[scene]); return; }
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

  useEffect(() => { fadeTo(defaultPool); }, [defaultPool, fadeTo]);

  useEffect(() => {
    targetVolume.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    targetAmbianceV.current = ambianceVol;
    if (ambianceRef.current && !ambianceRef.current.paused) ambianceRef.current.volume = ambianceVol;
  }, [ambianceVol]);

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

  const skip = useCallback(() => {
    if (!audioRef.current || audioRef.current.paused) return;
    musicErrors.current = 0;
    playNextMusic(targetVolume.current);
  }, [playNextMusic]);

  const selectPool = useCallback((key: string) => {
    fadeTo(key);
    setPickerOpen(false);
  }, [fadeTo]);

  const matchScene = useCallback(() => {
    const args = lastSceneArgs.current;
    if (args) window.__dndSetMusicScene?.(args.scene, args.type, args.mods);
    setPickerOpen(false);
  }, []);

  // Normalize current active key for comparison (tavern aliases to social in POOL_META)
  const activeMetaKey = activePoolKey.current === "tavern" ? "social" : activePoolKey.current;

  if (isOnLanding || pathname === "/auth") return null;

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        loop
        onPlay={()  => { setPlaying(true); setLoadError(false); musicErrors.current = 0; }}
        onPause={()  => { setPlaying(false); }}
        onEnded={() => playNextMusic()}
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

      {/* Click-away backdrop */}
      {pickerOpen && (
        <div
          onClick={() => setPickerOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 49 }}
        />
      )}

      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          zIndex: 50,
          userSelect: "none",
        }}
      >
        {/* Pool picker — floats above the pill */}
        {pickerOpen && (
          <div
            className="animate-fade-in"
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              background: "rgba(10, 7, 24, 0.97)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(139,92,246,0.4)",
              borderRadius: "12px",
              padding: "6px",
              minWidth: "200px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
          >
            {/* Match scene button */}
            {recommended && (
              <button
                onClick={matchScene}
                style={{
                  display: "flex", alignItems: "center", gap: "8px", width: "100%",
                  padding: "7px 10px", borderRadius: "8px", border: "none",
                  background: "rgba(139,92,246,0.15)", cursor: "pointer",
                  marginBottom: "4px", transition: "background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.28)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.15)"; }}
              >
                <span style={{ fontSize: "0.75rem" }}>✦</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#c4b5fd" }}>Match Scene</div>
                  <div style={{ fontSize: "0.62rem", color: "#64748b" }}>
                    {POOL_META.find(p => p.key === recommended)?.icon}{" "}
                    {POOL_META.find(p => p.key === recommended)?.label ?? recommended}
                  </div>
                </div>
              </button>
            )}

            <div style={{ borderTop: recommended ? "1px solid rgba(255,255,255,0.07)" : "none", paddingTop: recommended ? "4px" : 0, display: "flex", flexDirection: "column", gap: "1px" }}>
              {POOL_META.map(p => {
                const isActive = p.key === activeMetaKey;
                const isRec    = p.key === recommended && p.key !== activeMetaKey;
                return (
                  <button
                    key={p.key}
                    onClick={() => selectPool(p.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px", width: "100%",
                      padding: "7px 10px", borderRadius: "8px", border: "none",
                      background: isActive ? "rgba(139,92,246,0.25)" : "transparent",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>{p.icon}</span>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: "bold", color: isActive ? "#c4b5fd" : "white" }}>{p.label}</div>
                      <div style={{ fontSize: "0.62rem", color: "#64748b" }}>{p.desc}</div>
                    </div>
                    {isActive && <span style={{ fontSize: "0.62rem", color: "#8b5cf6", flexShrink: 0 }}>●</span>}
                    {isRec    && <span style={{ fontSize: "0.62rem", color: "#64748b", flexShrink: 0 }} title="Matches current scene">✦</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pill */}
        <div
          style={{
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
          }}
        >
          {/* Play / pause */}
          <button
            onClick={toggle}
            title={loadError ? "Music failed to load — click to retry" : playing ? "Pause" : "Play background music"}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "0.95rem", padding: 0, lineHeight: 1,
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

          {!loadError && (
            <>
              {/* Pool label — opens picker */}
              <button
                onClick={() => setPickerOpen(v => !v)}
                title="Change music mood"
                style={{
                  background: pickerOpen ? "rgba(139,92,246,0.18)" : "none",
                  border: "none", cursor: "pointer", padding: "2px 5px",
                  borderRadius: "5px", fontSize: "0.65rem", color: playing ? "#94a3b8" : "#475569",
                  whiteSpace: "nowrap", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "3px",
                }}
              >
                {poolLabel} <span style={{ fontSize: "0.5rem", opacity: 0.7 }}>▾</span>
              </button>

              {/* Skip track */}
              {playing && (
                <button
                  onClick={skip}
                  title="Skip track"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "0.75rem", padding: 0, lineHeight: 1,
                    color: "#475569", transition: "color 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#94a3b8"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#475569"; }}
                >
                  ⏭
                </button>
              )}

              {/* Music volume */}
              {playing && (
                <input
                  type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  title="Music volume"
                  style={{ width: "48px", accentColor: "var(--primary)", cursor: "pointer" }}
                />
              )}
            </>
          )}

          {/* Ambiance volume */}
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
      </div>
    </>
  );
}
