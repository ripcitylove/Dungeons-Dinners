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
  `${KM}Celtic%20Impulse.mp3`,
  `${MEDIEVAL}Royal%20Coupling.mp3`,
  `${KM}Carefree.mp3`,
  `${KM}Fluffing%20a%20Duck.mp3`,
  `${KM}Blarney%20Street.mp3`,
  `${KM}Merry%20Go.mp3`,
  `${KM}Enchanted%20Festival.mp3`,
  `${KM}Spring%20Thaw.mp3`,
  `${KM}Folk%20Round.mp3`,
  `${KM}Verdant%20Acres.mp3`,
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
    `${KM}Volatile%20Reaction.mp3`,
    `${KM}Strength%20of%20the%20Titans.mp3`,
    `${KM}Heavy%20Interlude.mp3`,
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
    `${KM}Atlantean%20Twilight.mp3`,
    `${KM}BlackVortex.mp3`,
    `${KM}Ossuary%206%20-%20Air.mp3`,
    `${KM}Crypteque.mp3`,
    `${DARK_AMB}Dark%20Ambient%20Texture.mp3`,
    `${DARK_AMB}Gloomy.mp3`,
    `${DARK_AMB}Nightmare.mp3`,
    `${DARK_AMB}Suspense%20Piano.mp3`,
    `${KM}Cipher.mp3`,
    `${KM}Investigations.mp3`,
    `${KM}Dark%20Fog.mp3`,
  ],
  nature: [
    `${MEDIEVAL}Cold%20Journey.mp3`,
    `${MEDIEVAL}Nordic%20Wist.mp3`,
    `${JAMENDO}01-1720369-Sapere%20Aude-Fantasy%20Forest.mp3`,
    "https://soundimage.org/wp-content/uploads/2014/09/Our-Mountain_v003.mp3",
    "https://soundimage.org/wp-content/uploads/2023/12/Lost-Jungle.mp3",
    "https://soundimage.org/wp-content/uploads/2020/06/Misty-Bog_remixed.mp3",
    `${KM}Healing.mp3`,
    `${KM}Forest%20Walk.mp3`,
    `${MIST_CROWN}01%20Foreign%20Shore.mp3`,
    `${MIST_CROWN}02%20Brave%20the%20Unknown.mp3`,
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
    `${KM}Ouroboros.mp3`,
    `${KM}Gregorian%20Chant.mp3`,
    `${KM}Wizardtorium.mp3`,
    `${KM}Ancient%20and%20Mysterious.mp3`,
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
    `${KM}Heroic%20Age.mp3`,
    `${KM}Long%20Road%20Ahead.mp3`,
    `${KM}Stormfront.mp3`,
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

// ── Ambiance pools (atmospheric/environmental audio, played under music) ──────
// Every URL here points to a pure SOUNDSCAPE — cave drips, forest birds, rain,
// crowd murmur, ocean waves — never melodic music. This guarantees the music
// player and ambiance player never "fight" each other with two competing scores.
// All tracks confirmed live (audio/mpeg content-type) on archive.org.
const ARCHIVE_DL = "https://archive.org/download";
const AMBIANCE_POOLS: Record<string, string[]> = {
  dungeon: [
    `${ARCHIVE_DL}/d-d-ambience-generic-dungeon/D%26D%20Ambience%20-%20Generic%20Dungeon.mp3`,
    `${ARCHIVE_DL}/3-excavation-naine-catacombs-ambience.-dark-caverns./3_Excavation%20naine%20%28Catacombs_ambience._Dark_caverns%29..mp3`,
    `${ARCHIVE_DL}/dark-cave-ambience-sound-effect-no-copyright/Dark%20CAVE%20Ambience%20SOUND%20Effect%20%28NO%20Copyright%29.mp3`,
    `${ARCHIVE_DL}/spiders-cave-fantasy-asmr-ambience-1-hour/Spiders%27%20Cave%20Fantasy%20ASMR%20Ambience%201%20Hour.mp3`,
  ],
  nature: [
    `${ARCHIVE_DL}/forest_ambience_19072014/forest_ambience_19072014.mp3`,
    `${ARCHIVE_DL}/forest-sounds-woodland-ambience-bird-song-x-nn-7i-ta-57j-m/Forest%20Sounds%20_%20Woodland%20Ambience%2C%20Bird%20Song%20%5BxNN7iTA57jM%5D.mp3`,
    `${ARCHIVE_DL}/d-d-ambience-to-a-jungles-of-chult/D%26D%20Ambience%20-%20%5BToA%5D%20-%20Jungles%20of%20Chult.mp3`,
    `${ARCHIVE_DL}/thelastofusrainambience/The%20Last%20Of%20Us%20-%20Thunderstorm%20Ambience%20%281%29.mp3`,
  ],
  mystical: [
    `${ARCHIVE_DL}/curse-of-strahd-town-of-vallaki-st.-andrals-church-ambience/Curse%20of%20Strahd%20-%20Town%20of%20Vallaki%20-%20St.%20Andral%27s%20Church%20%28Ambience%29.mp3`,
    `${ARCHIVE_DL}/d-d-ambience-to-a-lost-city-of-omu/D%26D%20Ambience%20-%20%5BToA%5D%20-%20Lost%20City%20of%20Omu.mp3`,
  ],
  social: [
    `${ARCHIVE_DL}/tavern_202212/Tavern.mp3`,
    `${ARCHIVE_DL}/co-s-vallaki-ambience/%28CoS%29%20Vallaki%20Ambience.mp3`,
  ],
  epic: [
    `${ARCHIVE_DL}/d-d-ambience-to-a-lost-city-of-omu/D%26D%20Ambience%20-%20%5BToA%5D%20-%20Lost%20City%20of%20Omu.mp3`,
    `${ARCHIVE_DL}/curse-of-strahd-town-of-vallaki-st.-andrals-church-ambience/Curse%20of%20Strahd%20-%20Town%20of%20Vallaki%20-%20St.%20Andral%27s%20Church%20%28Ambience%29.mp3`,
  ],
  sea: [
    `${ARCHIVE_DL}/d-d-ambience-to-a-port-nyanzaru/D%26D%20Ambience%20-%20%5BToA%5D%20-%20Port%20Nyanzaru.mp3`,
    `${ARCHIVE_DL}/5-hours-of-bora-bora-ambience-soft-ocean-sounds/5%20Hours%20of%20Bora%20Bora%20Ambience%20%20Soft%20Ocean%20Sounds.mp3`,
  ],
  eerie: [
    `${ARCHIVE_DL}/curse-of-strahd-town-of-vallaki-st.-andrals-church-ambience/Curse%20of%20Strahd%20-%20Town%20of%20Vallaki%20-%20St.%20Andral%27s%20Church%20%28Ambience%29.mp3`,
    `${ARCHIVE_DL}/co-s-vallaki-ambience/%28CoS%29%20Vallaki%20Ambience.mp3`,
    `${ARCHIVE_DL}/spiders-cave-fantasy-asmr-ambience-1-hour/Spiders%27%20Cave%20Fantasy%20ASMR%20Ambience%201%20Hour.mp3`,
  ],
  city: [
    `${ARCHIVE_DL}/CitysNightAmbienceSounds_201501/City%60s%20Night%20ambience%20sounds.mp3`,
    `${ARCHIVE_DL}/co-s-vallaki-ambience/%28CoS%29%20Vallaki%20Ambience.mp3`,
  ],
  desert: [
    // No dedicated desert ambient track found in the open corpus — share the exotic
    // jungle SFX as the closest "hot environment with bugs and wind" approximation.
    `${ARCHIVE_DL}/d-d-ambience-to-a-jungles-of-chult/D%26D%20Ambience%20-%20%5BToA%5D%20-%20Jungles%20of%20Chult.mp3`,
  ],
  combat: [
    // Intentionally empty — combat music is the soundtrack. Adding an ambient layer
    // here would just compete with the battle score. The MusicPlayer handles an empty
    // pool gracefully (no ambiance plays).
  ],
};

// Scene → ambiance pool (separate from music pool — street/graveyard need different atmosphere)
const SCENE_TO_AMBIANCE_POOL: Record<string, string> = {
  dungeon: "dungeon", cave: "dungeon", prison: "dungeon",
  forest: "nature", wilderness: "nature", mountain: "nature",
  temple: "mystical", library: "mystical", shop: "mystical",
  tavern: "social", village: "social",
  castle: "epic", ruins: "epic", arena: "epic",
  ship: "sea", port: "sea",
  graveyard: "eerie", swamp: "eerie",
  street: "city",
  desert: "desert",
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
  // Eerie / supernatural
  graveyard: "mystical", swamp: "mystical",
  // Outdoor nature
  forest: "nature", wilderness: "nature", mountain: "nature",
  // Arcane / sacred
  temple: "mystical", library: "mystical", ruins: "mystical",
  // Social / urban — street is ominous city at night, not warm tavern
  tavern: "social", shop: "social", village: "social",
  street: "dungeon",
  // Grand / naval — port is nautical, not social; desert is vast/epic not woodland
  castle: "epic", desert: "epic",
  ship: "sea", port: "sea",
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

// Volume ratio for background music when this ambiance pool is active (0=mute, 1=full).
// Every pool now plays pure soundscape (no melodic content), so music can layer at
// full volume without two scores fighting each other. Each value is a gentle taper
// to keep the ambient texture audible under the soundtrack — never to mute it.
const MUSIC_BALANCE_RATIOS: Record<string, number> = {
  combat:   1.0,  // no ambiance — music carries the scene
  dungeon:  0.85, // cave drips/echoes — quiet, music can play loud
  nature:   0.85, // forest/birds — quiet, music can play loud
  mystical: 0.80, // church/lost city — atmospheric, leave space for music
  epic:     0.80,
  sea:      0.80, // waves/port — leave room for music
  eerie:    0.75, // creaky, subtle — needs presence under music
  social:   0.70, // crowd murmur — louder ambient, drop music slightly
  city:     0.75, // night street — moderate ambient
  desert:   0.85,
};

declare global {
  interface Window {
    __dndMusicPlay?: () => void;
    __dndSetMusicScene?: (scene: string, sceneType?: string, modifiers?: string[]) => void;
    __dndSetAmbiance?: (url: string | null) => void;
    __dndSetAmbianceScene?: (scene: string, sceneType?: string, mods?: string[]) => void;
    __dndDuckAudio?: (duck: boolean) => void;
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

function resolvePool(scene: string, sceneType?: string, mods?: string[]): string {
  if (scene.endsWith("_combat")) return "combat";
  if (mods && mods.length > 0) {
    const modSet = new Set(mods);
    // Sacred / divine space
    if (modSet.has("sacred") || modSet.has("holy") || modSet.has("divine") || modSet.has("blessed") || modSet.has("celestial") || modSet.has("altar") || modSet.has("ritual") || modSet.has("chapel") || modSet.has("shrine")) return "mystical";
    // Nautical → sea
    if (modSet.has("nautical") || modSet.has("tidal") || modSet.has("coastal") || modSet.has("harbor") || modSet.has("dock") || modSet.has("port")) return "sea";
    // Festive / social
    if (modSet.has("festive") || modSet.has("crowded") || modSet.has("celebration") || modSet.has("lively") || modSet.has("market") || modSet.has("inn") || modSet.has("feast")) return "social";
    // Eerie / supernatural
    if (modSet.has("haunted") || modSet.has("cursed") || modSet.has("ethereal") || modSet.has("ghostly") || modSet.has("spectral") || modSet.has("eerie") || modSet.has("bone") || modSet.has("crypt")) return "mystical";
    // Arcane / magical
    if (modSet.has("arcane") || modSet.has("magical") || modSet.has("mystical") || modSet.has("glowing") || modSet.has("bioluminescent") || modSet.has("crystal")) return "mystical";
    // Fog / mist → ethereal/mystical
    if (modSet.has("fog") || modSet.has("mist") || modSet.has("misty")) return "mystical";
    // Grand / majestic castle features
    if (modSet.has("throne") || modSet.has("grand") || modSet.has("great_hall") || modSet.has("battlements") || modSet.has("courtyard") || modSet.has("tower") || modSet.has("royal") || modSet.has("noble") || modSet.has("rampart")) return "epic";
    // Extreme outdoor conditions
    if (modSet.has("stormy") || modSet.has("frozen") || modSet.has("icy") || modSet.has("blizzard") || modSet.has("volcanic") || modSet.has("cliff") || modSet.has("canyon")) return "nature";
    // Outdoor nature markers — only if not an underground scene type
    if ((modSet.has("overgrown") || modSet.has("clearing") || modSet.has("canopy") || modSet.has("meadow") || modSet.has("river") || modSet.has("hilltop") || modSet.has("marsh") || modSet.has("dawn") || modSet.has("dusk") || modSet.has("autumn"))
        && sceneType !== "dungeon" && sceneType !== "cave" && sceneType !== "prison") return "nature";
    // Underground / subterranean — no scene-type restriction; collapsed ruins, flooded vaults, etc. all feel dungeon
    if (modSet.has("underground") || modSet.has("collapsed") || modSet.has("flooded") || modSet.has("iron") || modSet.has("pit") || modSet.has("buried") || modSet.has("sunken")) return "dungeon";
  }
  if (SCENE_TO_POOL[scene]) return SCENE_TO_POOL[scene];
  const baseKey = Object.keys(SCENE_TO_POOL)
    .filter(k => scene.startsWith(k + "_") || scene === k)
    .sort((a, b) => b.length - a.length)[0];
  return SCENE_TO_POOL[baseKey ?? ""] ?? "dungeon";
}

function resolveAmbiancePool(scene: string, sceneType?: string, mods?: string[]): string {
  if (scene.endsWith("_combat")) return "combat";
  if (mods && mods.length > 0) {
    const modSet = new Set(mods);
    if (modSet.has("sacred") || modSet.has("holy") || modSet.has("divine") || modSet.has("altar") || modSet.has("chapel") || modSet.has("shrine") || modSet.has("ritual")) return "mystical";
    if (modSet.has("nautical") || modSet.has("coastal") || modSet.has("harbor") || modSet.has("dock") || modSet.has("tidal")) return "sea";
    if (modSet.has("festive") || modSet.has("crowded") || modSet.has("market") || modSet.has("inn") || modSet.has("feast")) return "social";
    if (modSet.has("haunted") || modSet.has("ghostly") || modSet.has("spectral") || modSet.has("bone") || modSet.has("crypt") || modSet.has("eerie")) return "eerie";
    if (modSet.has("cursed") || modSet.has("ethereal") || modSet.has("fog") || modSet.has("mist") || modSet.has("misty")) return "eerie";
    if (modSet.has("arcane") || modSet.has("magical") || modSet.has("glowing") || modSet.has("bioluminescent") || modSet.has("crystal")) return "mystical";
    if (modSet.has("throne") || modSet.has("grand") || modSet.has("great_hall") || modSet.has("battlements") || modSet.has("courtyard") || modSet.has("royal")) return "epic";
    if (modSet.has("stormy") || modSet.has("volcanic") || modSet.has("canyon") || modSet.has("cliff") || modSet.has("frozen") || modSet.has("icy") || modSet.has("blizzard")) return "nature";
    if ((modSet.has("overgrown") || modSet.has("clearing") || modSet.has("meadow") || modSet.has("river") || modSet.has("hilltop") || modSet.has("dawn") || modSet.has("dusk"))
        && sceneType !== "dungeon" && sceneType !== "cave" && sceneType !== "prison") return "nature";
    if (modSet.has("underground") || modSet.has("collapsed") || modSet.has("flooded") || modSet.has("pit") || modSet.has("buried")) return "dungeon";
    if (modSet.has("midnight") || modSet.has("shadowy") || modSet.has("desolate")) {
      if (sceneType === "street" || sceneType === "ruins" || sceneType === "village") return "city";
    }
  }
  if (SCENE_TO_AMBIANCE_POOL[scene]) return SCENE_TO_AMBIANCE_POOL[scene];
  const baseKey = Object.keys(SCENE_TO_AMBIANCE_POOL)
    .filter(k => scene.startsWith(k + "_") || scene === k)
    .sort((a, b) => b.length - a.length)[0];
  return SCENE_TO_AMBIANCE_POOL[baseKey ?? ""] ?? "dungeon";
}

export function MusicPlayer() {
  const pathname = usePathname();
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const ambianceRef = useRef<HTMLAudioElement | null>(null);

  const [playing,       setPlaying]       = useState(false);
  const [loadError,     setLoadError]     = useState(false);
  const [volume,        setVolume]        = useState(() => { try { return parseFloat(localStorage.getItem("dnd_music_vol")      ?? "0.10"); } catch { return 0.10; } });
  const [ambianceVol,   setAmbianceVol]   = useState(() => { try { return parseFloat(localStorage.getItem("dnd_ambiance_vol")  ?? "0.35"); } catch { return 0.35; } });
  const [musicMuted,    setMusicMuted]    = useState(() => { try { return localStorage.getItem("dnd_music_muted")    === "1"; }  catch { return false; } });
  const [ambianceMuted, setAmbianceMuted] = useState(() => { try { return localStorage.getItem("dnd_ambiance_muted") === "1"; } catch { return false; } });
  const [ambianceReady, setAmbianceReady] = useState(false);
  const [poolLabel,     setPoolLabel]     = useState("Tavern");
  const [pickerOpen,    setPickerOpen]    = useState(false);
  const [recommended,   setRecommended]   = useState<string | null>(null);

  const targetVolume    = useRef(0.10);
  const targetAmbianceV = useRef(0.35);
  const activePoolKey   = useRef<string>("tavern");
  // Render-readable mirror of activePoolKey.current (kept in sync in fadeTo) so the
  // active-pool highlight can be derived during render without reading the ref.
  const [activePool, setActivePool] = useState<string>("tavern");
  const fadeTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambianceFade    = useRef<ReturnType<typeof setInterval> | null>(null);
  const musicQueue      = useRef<string[]>([]);
  const musicErrors     = useRef(0);
  const lastSceneArgs   = useRef<{ scene: string; type?: string; mods?: string[] } | null>(null);
  // Ambiance pool state
  const activeAmbiancePool = useRef<string>("");
  const ambianceQueueRef   = useRef<string[]>([]);
  const ambianceErrors     = useRef(0);
  const isDucked               = useRef(false);
  const duckFadeTimer          = useRef<number | null>(null);
  const musicMutedRef          = useRef(false);
  const ambianceMutedRef       = useRef(false);
  const ambianceMusicSuppressed = useRef<number>(1);
  const suppressFadeRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  const isOnLanding  = pathname === "/";
  const isOnCampaign = !!pathname?.startsWith("/campaign");
  const defaultPool  = isOnCampaign ? "dungeon" : "tavern";

  const getPool = (key: string) => POOLS[key] ?? POOLS.dungeon;

  const clearFade = useCallback(() => {
    if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; }
  }, []);

  const clearSuppressFade = useCallback(() => {
    if (suppressFadeRef.current) { clearInterval(suppressFadeRef.current); suppressFadeRef.current = null; }
  }, []);

  const loadAndPlay = useCallback((src: string, startVol?: number) => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    audio.src    = src;
    audio.volume = startVol ?? (musicMutedRef.current ? 0 : targetVolume.current * ambianceMusicSuppressed.current);
    audio.load();
    audio.play().catch(() => {});
  }, []);

  const playNextMusic = useCallback((startVol?: number) => {
    const pool = getPool(activePoolKey.current);
    const { src, queue } = nextFrom(musicQueue.current, pool);
    musicQueue.current = queue;
    loadAndPlay(src, startVol);
  }, [loadAndPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth fade between two volume levels using equal-power curve.
  // onDone fires when fade-out reaches 0; resolves the fade-in itself.
  const smoothFade = useCallback((
    fromVol: number, toVol: number, durationMs: number,
    onStep: (v: number) => void, onDone: () => void,
  ) => {
    clearFade();
    clearSuppressFade(); // prevent balance fade from competing with track-change fade
    const STEP = 16;
    let elapsed = 0;
    fadeTimer.current = setInterval(() => {
      elapsed += STEP;
      const prog = Math.min(1, elapsed / durationMs);
      const vol = fromVol > toVol
        ? fromVol * Math.cos((prog * Math.PI) / 2)         // equal-power fade-out
        : toVol   * Math.sin((prog * Math.PI) / 2);        // equal-power fade-in
      onStep(Math.max(0, Math.min(1, vol)));
      if (prog >= 1) { clearFade(); onDone(); }
    }, STEP);
  }, [clearFade, clearSuppressFade]);

  const fadeTo = useCallback((targetPool: string) => {
    if (activePoolKey.current === targetPool) return;
    const pool  = getPool(targetPool);
    const audio = audioRef.current;

    activePoolKey.current = targetPool;
    setActivePool(targetPool);
    musicQueue.current    = [];
    musicErrors.current   = 0;
    setPoolLabel(POOL_LABELS[targetPool] ?? targetPool);

    // While narration is ducking, skip the fade — duckFadeTimer owns volume right now.
    // Pool metadata is already updated above; unduck/playNextMusic will use the new pool.
    if (!audio || audio.paused || isDucked.current) return;

    // Pick next track and start pre-buffering it in parallel with the fade-out
    const { src, queue } = nextFrom(musicQueue.current, pool);
    musicQueue.current = queue;
    const preload = new Audio();
    preload.preload = "auto";
    preload.src = src;
    preload.load();

    const startVol = audio.volume;
    smoothFade(startVol, 0, 1600, v => { if (audioRef.current) audioRef.current.volume = v; }, () => {
      const a = audioRef.current;
      if (!a) return;
      a.src = src;
      a.volume = 0;
      a.load();
      a.play().catch(() => {});
      const fadeInTarget = musicMutedRef.current ? 0 : targetVolume.current * ambianceMusicSuppressed.current;
      smoothFade(0, fadeInTarget, 1200, v => { if (audioRef.current) audioRef.current.volume = v; }, () => {
        if (audioRef.current) audioRef.current.volume = fadeInTarget;
      });
    });
  }, [smoothFade]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearAmbianceFade = useCallback(() => {
    if (ambianceFade.current) { clearInterval(ambianceFade.current); ambianceFade.current = null; }
  }, []);

  const clearDuckFade = useCallback(() => {
    if (duckFadeTimer.current) { cancelAnimationFrame(duckFadeTimer.current); duckFadeTimer.current = null; }
  }, []);

  const setMusicBalance = useCallback((ratio: number) => {
    ambianceMusicSuppressed.current = ratio;
    clearSuppressFade();
    // Skip the fade if duck or track-change is already controlling volume — they
    // will read ambianceMusicSuppressed.current when they finish.
    if (isDucked.current || fadeTimer.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    const targetV = musicMutedRef.current ? 0 : targetVolume.current * ratio;
    if (Math.abs(audio.volume - targetV) < 0.005) return;
    const start = audio.volume;
    const STEP = 30;
    const duration = 1600;
    let elapsed = 0;
    suppressFadeRef.current = setInterval(() => {
      elapsed += STEP;
      const prog = Math.min(1, elapsed / duration);
      const v = start + (targetV - start) * Math.sin((prog * Math.PI) / 2);
      const a = audioRef.current;
      if (a) a.volume = Math.max(0, Math.min(1, v));
      if (prog >= 1) clearSuppressFade();
    }, STEP);
  }, [clearSuppressFade]);

  const duckTo = useCallback((duck: boolean) => {
    if (isDucked.current === duck) return;
    isDucked.current = duck;
    clearDuckFade();
    clearFade();
    clearSuppressFade();

    const DUCK_RATIO = 0.20;
    const FADE_MS    = 280;
    const musicTarget = duck
      ? (musicMutedRef.current ? 0 : targetVolume.current * DUCK_RATIO)
      : (musicMutedRef.current ? 0 : targetVolume.current * ambianceMusicSuppressed.current);
    const ambiTarget = duck
      ? (ambianceMutedRef.current ? 0 : targetAmbianceV.current * DUCK_RATIO)
      : (ambianceMutedRef.current ? 0 : targetAmbianceV.current);

    const musicStart = audioRef.current?.volume    ?? musicTarget;
    const ambiStart  = ambianceRef.current?.volume ?? ambiTarget;
    const t0 = performance.now();

    const tick = () => {
      const prog = Math.min(1, (performance.now() - t0) / FADE_MS);
      const ease = Math.sin((prog * Math.PI) / 2); // ease-out — fast start, smooth settle
      const music = audioRef.current;
      if (music && !music.paused) music.volume = Math.max(0, Math.min(1, musicStart + (musicTarget - musicStart) * ease));
      const amb = ambianceRef.current;
      if (amb   && !amb.paused)   amb.volume   = Math.max(0, Math.min(1, ambiStart  + (ambiTarget  - ambiStart)  * ease));
      if (prog < 1) {
        duckFadeTimer.current = requestAnimationFrame(tick);
      } else {
        if (music && !music.paused) music.volume = musicTarget;
        if (amb   && !amb.paused)   amb.volume   = ambiTarget;
        duckFadeTimer.current = null;
      }
    };

    duckFadeTimer.current = requestAnimationFrame(tick);
  }, [clearDuckFade, clearFade, clearSuppressFade]);

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

  // Pick next track from an ambiance pool, fading out the current one first
  const playNextAmbiance = useCallback((poolKey: string) => {
    const pool = AMBIANCE_POOLS[poolKey] ?? AMBIANCE_POOLS.dungeon;
    // Empty pool (combat) — fade the current ambiance out and stop. Music carries
    // the scene without a competing ambient layer.
    if (pool.length === 0) {
      activeAmbiancePool.current = poolKey;
      ambianceQueueRef.current = [];
      fadeOutAmbiance(() => {
        if (ambianceRef.current) ambianceRef.current.src = "";
        setAmbianceReady(false);
      });
      return;
    }
    // Same scene -> same ambiance. If the active pool already matches and a
    // track is already loaded, keep looping the current track. We only swap
    // the ambient track when the scene's pool actually changes. Without this
    // gate, scene detection firing on every DM response (even for the same
    // scene) would rotate to a different ambient track each time.
    if (activeAmbiancePool.current === poolKey && ambianceRef.current?.src) return;
    if (activeAmbiancePool.current !== poolKey || ambianceQueueRef.current.length === 0) {
      // New pool or no queue yet — shuffle a fresh queue, excluding the currently playing URL
      const current = ambianceRef.current?.src ?? "";
      ambianceQueueRef.current = shuffle(pool).filter(u => u !== current);
      activeAmbiancePool.current = poolKey;
    }
    const [url, ...rest] = ambianceQueueRef.current;
    ambianceQueueRef.current = rest;
    if (!url) return;
    fadeOutAmbiance(() => {
      const b = ambianceRef.current;
      if (!b) return;
      b.src = url;
      b.load();
      setAmbianceReady(true);
    });
  }, [fadeOutAmbiance]);

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
      lastSceneArgs.current = { scene, type: sceneType, mods };
      const pool = resolvePool(scene, sceneType, mods);
      setRecommended(pool);
      fadeTo(pool);
    };

    window.__dndSetAmbiance = (url: string | null) => {
      const a = ambianceRef.current;
      if (!a) return;
      if (!url) { setMusicBalance(1); fadeOutAmbiance(() => { if (ambianceRef.current) ambianceRef.current.src = ""; setAmbianceReady(false); }); return; }
      if (a.src === url) return;
      fadeOutAmbiance(() => {
        const b = ambianceRef.current;
        if (!b) return;
        b.src  = url;
        b.load();
        setAmbianceReady(true);
      });
    };

    window.__dndSetAmbianceScene = (scene: string, sceneType?: string, mods?: string[]) => {
      const poolKey = resolveAmbiancePool(scene, sceneType, mods);
      ambianceErrors.current = 0;
      setMusicBalance(MUSIC_BALANCE_RATIOS[poolKey] ?? 1);
      playNextAmbiance(poolKey);
    };

    window.__dndDuckAudio = duckTo;

    return () => {
      delete window.__dndMusicPlay;
      delete window.__dndSetMusicScene;
      delete window.__dndSetAmbiance;
      delete window.__dndSetAmbianceScene;
      delete window.__dndDuckAudio;
    };
  }, [playNextMusic, fadeTo, fadeInAmbiance, fadeOutAmbiance, playNextAmbiance, duckTo, setMusicBalance]);

  useEffect(() => { fadeTo(defaultPool); }, [defaultPool, fadeTo]);

  // Clear campaign ambiance when navigating away from a campaign page
  useEffect(() => {
    if (!isOnCampaign) {
      setMusicBalance(1);
      fadeOutAmbiance(() => {
        if (ambianceRef.current) ambianceRef.current.src = "";
        activeAmbiancePool.current = "";
        setAmbianceReady(false);
      });
    }
  }, [isOnCampaign, fadeOutAmbiance, setMusicBalance]);

  useEffect(() => {
    targetVolume.current = volume;
    if (audioRef.current && !isDucked.current) {
      // Cancel any in-progress fade so the slider value takes effect immediately
      clearFade();
      clearSuppressFade();
      audioRef.current.volume = musicMutedRef.current ? 0 : volume * ambianceMusicSuppressed.current;
    }
    localStorage.setItem("dnd_music_vol", String(volume));
  }, [volume, clearFade, clearSuppressFade]);

  useEffect(() => {
    targetAmbianceV.current = ambianceVol;
    if (ambianceRef.current && !ambianceRef.current.paused && !isDucked.current) ambianceRef.current.volume = ambianceMutedRef.current ? 0 : ambianceVol;
    localStorage.setItem("dnd_ambiance_vol", String(ambianceVol));
  }, [ambianceVol]);

  useEffect(() => {
    musicMutedRef.current = musicMuted;
    if (audioRef.current && !isDucked.current) {
      clearFade();
      clearSuppressFade();
      audioRef.current.volume = musicMuted ? 0 : targetVolume.current * ambianceMusicSuppressed.current;
    }
    localStorage.setItem("dnd_music_muted", musicMuted ? "1" : "0");
  }, [musicMuted, clearFade, clearSuppressFade]);

  useEffect(() => {
    ambianceMutedRef.current = ambianceMuted;
    if (ambianceRef.current && !ambianceRef.current.paused && !isDucked.current) ambianceRef.current.volume = ambianceMuted ? 0 : targetAmbianceV.current;
    localStorage.setItem("dnd_ambiance_muted", ambianceMuted ? "1" : "0");
  }, [ambianceMuted]);

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
    const startVol = audioRef.current.volume;
    smoothFade(startVol, 0, 350, v => { if (audioRef.current) audioRef.current.volume = v; }, () => {
      playNextMusic(0);
      const fadeInTo = musicMutedRef.current ? 0 : targetVolume.current * ambianceMusicSuppressed.current;
      smoothFade(0, fadeInTo, 700, v => { if (audioRef.current) audioRef.current.volume = v; }, () => {
        if (audioRef.current) audioRef.current.volume = fadeInTo;
      });
    });
  }, [smoothFade, playNextMusic]);

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
  const activeMetaKey = activePool === "tavern" ? "social" : activePool;

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
        // No onEnded rotation — `loop` keeps the same track playing forever. The
        // ambient track only swaps when the scene's pool changes (handled in
        // playNextAmbiance) or when the user picks a different mood manually.
        onError={() => {
          ambianceErrors.current++;
          if (ambianceErrors.current < MAX_SKIP && activeAmbiancePool.current) {
            setTimeout(() => playNextAmbiance(activeAmbiancePool.current), 800);
          }
        }}
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
          // The scene panel's title overlay ("Wilderness · The story unfolds…")
          // sits in the bottom-left of the scene image. Lift the player above
          // it so the two don't overlap, especially at Xbox MS Edge scaling
          // where every fixed-pixel UI element compounds.
          bottom: "clamp(14px, 1.5vw, 20px)",
          left: "clamp(12px, 1.5vw, 20px)",
          zIndex: 50,
          userSelect: "none",
          maxWidth: "min(92vw, 540px)",
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

        {/* Pill — responsive padding + gap so the pill stays compact on Xbox
            and doesn't extend across the scene title underneath it. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(6px, 0.7vw, 10px)",
            background: "rgba(10, 7, 24, 0.88)",
            backdropFilter: "blur(14px)",
            border: `1px solid ${loadError ? "rgba(239,68,68,0.5)" : playing ? "rgba(139, 92, 246, 0.45)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: "100px",
            padding: "clamp(6px, 0.8vw, 10px) clamp(12px, 1.4vw, 18px)",
            minHeight: "clamp(36px, 3.5vw, 48px)",
            boxShadow: playing ? "0 0 16px rgba(139,92,246,0.15)" : "0 2px 12px rgba(0,0,0,0.4)",
            transition: "border 0.3s, box-shadow 0.3s",
            flexWrap: "nowrap",
          }}
        >
          {/* Play / pause */}
          <button
            onClick={toggle}
            title={loadError ? "Music failed to load — click to retry" : playing ? "Pause" : "Play background music"}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "1.3rem", padding: "0 2px", lineHeight: 1,
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
                  borderRadius: "5px", fontSize: "0.78rem", color: playing ? "#94a3b8" : "#475569",
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
                    fontSize: "1.1rem", padding: "0 2px", lineHeight: 1,
                    color: "#475569", transition: "color 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#94a3b8"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#475569"; }}
                >
                  ⏭
                </button>
              )}

              {/* Music mute + volume */}
              {playing && (
                <>
                  <button
                    onClick={() => setMusicMuted(m => !m)}
                    title={musicMuted ? "Unmute music" : "Mute music"}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: musicMuted ? "#f87171" : "#475569", padding: "0 1px", lineHeight: 1, flexShrink: 0, transition: "color 0.2s" }}
                  >
                    {musicMuted ? "🔇" : volume < 0.35 ? "🔈" : "🔊"}
                  </button>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={musicMuted ? 0 : volume}
                    onChange={e => { const v = parseFloat(e.target.value); if (musicMuted && v > 0) setMusicMuted(false); if (v > 0) setVolume(v); else setMusicMuted(true); }}
                    title="Music volume"
                    style={{ width: "clamp(42px, 4vw, 62px)", height: "18px", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                </>
              )}
            </>
          )}

          {/* Ambiance mute + volume */}
          {ambianceReady && (
            <>
              <span style={{ fontSize: "0.65rem", color: "#475569", whiteSpace: "nowrap" }}>🌫</span>
              <button
                onClick={() => setAmbianceMuted(m => !m)}
                title={ambianceMuted ? "Unmute ambiance" : "Mute ambiance"}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: ambianceMuted ? "#f87171" : "#475569", padding: "0 1px", lineHeight: 1, flexShrink: 0, transition: "color 0.2s" }}
              >
                {ambianceMuted ? "🔇" : "🔈"}
              </button>
              <input
                type="range" min={0} max={1} step={0.05}
                value={ambianceMuted ? 0 : ambianceVol}
                onChange={e => { const v = parseFloat(e.target.value); if (ambianceMuted && v > 0) setAmbianceMuted(false); if (v > 0) setAmbianceVol(v); else setAmbianceMuted(true); }}
                title="Ambiance volume"
                style={{ width: "clamp(38px, 3.5vw, 56px)", height: "18px", accentColor: "#64748b", cursor: "pointer" }}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
