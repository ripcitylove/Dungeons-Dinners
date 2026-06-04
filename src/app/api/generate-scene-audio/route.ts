import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const AMBIANCE_PROMPTS: Record<string, string> = {
  tavern:     "cozy medieval tavern interior, warm murmuring crowd, clinking mugs and wooden cups, roaring stone fireplace, laughter in the background, ale being poured, stool scraping on flagstone",
  dungeon:    "dark underground dungeon corridor, slow echoing drips of water on cold stone, distant iron chains rattling, torch flame guttering in damp air, oppressive silence punctuated by faint footsteps deep in the dark",
  forest:     "ancient mystical forest at twilight, wind moving through old-growth canopy, crickets and frogs beginning their chorus, distant owl calls, branches creaking overhead, leaves whispering",
  cave:       "vast underground cavern, single water drops falling into a still black pool, deep resonant stone echoes, faint crystalline hum from mineral formations, bioluminescent quiet, ancient geological breathing",
  ruins:      "crumbling ancient ruins open to the sky, wind whistling mournfully through broken stone arches, loose rubble occasionally settling, dry leaves and grit shifting across old flagstones, the silence of a dead civilization",
  castle:     "grand stone castle interior, distant armored footsteps echoing across flagstone halls, wind moaning through arrow-slit windows high above, torch flames barely stirring in still cold air, regal and imposing silence",
  street:     "narrow cobblestone city street at night, rare distant footsteps on wet stone, lanterns creaking on their chains, muffled voices behind shuttered windows, a rat scurrying in a gutter, the city holding its breath",
  shop:       "cluttered alchemist's shop, glass vials bubbling softly over low flame, dried herbs and parchment rustling in warm still air, wax candle dripping, the creak of overfull shelves, a quill occasionally scratching",
  temple:     "ancient sacred temple, deep resonant bell tone fading slowly, incense smoke drifting in absolute stillness, a hushed devotional murmur barely audible, stone amplifying perfect silence, profound divine presence",
  wilderness: "vast open wilderness, wind sweeping across hilltops and through tall grass, distant thunder rumbling on the horizon, insects and birds holding uneasy quiet, the raw breathing of an untamed world",
  ship:       "sailing ship at sea, hull and rigging groaning with each swell, canvas sails cracking in a stiff wind, waves crashing rhythmically against the bow, seagulls crying far above, salty spray on old timber",
  graveyard:  "moonlit graveyard, iron gate hinge creaking in a cold wind, dead leaves skittering across stone paths, a distant wolf howl swallowed by silence, bare branches clicking overhead, unsettling sacred stillness",
  prison:     "damp stone prison carved from bedrock, distant chains clanking, a slow relentless drip of water, muffled sounds of suffering far down the corridor, the unbearable weight of confinement pressing in",
  arena:      "gladiatorial arena before the bout, dust settling on blood-darkened sand, the low murmur of a waiting crowd holding its breath, occasional stamp of anticipation, wind across open stone grandstands",
  port:       "busy fantasy port at dusk, seagulls crying over weathered docks, waves slapping the pilings, sailors calling across the water, ropes and pulleys squeaking, the smell of brine and tar in the air",
  desert:     "vast scorched desert, hot wind hissing across sun-bleached dunes, complete merciless silence beneath the sun, sand grains whispering as they shift, a distant dry crack of heat-split stone",
  mountain:   "treacherous high mountain pass, howling freezing wind sweeping through the gap, loose stones clattering down unseen cliffs, thin cold air, the vast empty roar of altitude, distant avalanche rumble",
  swamp:      "murky swampland at dusk, frogs and insects building their chorus, water dripping from hanging moss, mud bubbling softly below dark water, eerie stillness suddenly broken by something unseen moving beneath the surface",
  library:    "vast arcane library deep in the night, a quill scratching faintly on parchment, pages being carefully turned, books settling on ancient shelves, dust motes drifting in still lamplight, a place of profound quiet knowledge",
  village:    "small medieval village waking, distant rooster at first light, blacksmith's hammer beginning its rhythm, children's voices carrying across the square, wagon wheels on dirt road, wood smoke and morning bread",
};

const COMBAT_LAYER: Record<string, string> = {
  dungeon:    "dungeon combat ambiance, steel clashing on stone walls, echoing battle cries, urgent and dangerous",
  forest:     "forest combat ambiance, snapping branches underfoot, desperate battle cries among ancient trees",
  cave:       "cave combat ambiance, steel reverberating in rocky chambers, battle cries swallowed by stone",
  tavern:     "tavern brawl ambiance, crashing furniture, shattering mugs, chaotic close-quarters fighting",
  castle:     "castle battle ambiance, armored knights clashing in stone halls, steel ringing off vaulted ceilings",
  ruins:      "ruins combat ambiance, crumbling stone spraying from impacts, desperate fighting through broken arches",
  street:     "street brawl ambiance, cobblestones ringing under boots, cloaked fighters clashing under lantern light",
  temple:     "temple combat ambiance, holy silence shattered by steel, reverent echoes turned chaotic",
  wilderness: "open-field combat ambiance, desperate battle under open sky, weapons clashing against raw wind",
  ship:       "ship deck combat ambiance, clashing steel on heaving planks, cannon smoke, crashing waves",
  graveyard:  "graveyard combat ambiance, steel on cold stone, disturbed silence, desperate moonlit battle",
  desert:     "desert combat ambiance, sand churned up by battle, scorching heat, steel under blazing sun",
  mountain:   "mountain pass combat ambiance, howling wind, precarious footing, high-altitude desperate fighting",
  swamp:      "swamp combat ambiance, water splashing, mud chaos, urgent desperate battle in the mire",
  prison:     "prison combat ambiance, chains rattling, iron bars ringing from impacts, stone corridors echoing steel",
  arena:      "gladiatorial arena ambiance, crowd roaring and stamping, steel on bloodied sand, brutal spectacle",
  village:    "village combat ambiance, panicked villagers fleeing, steel clashing on cobblestones, chaos",
  port:       "port combat ambiance, dockside brawl, sea wind, crates splintering, sailors fighting on the wharf",
  default:    "intense combat ambiance, steel clashing, urgent battle cries, life-or-death tension",
};

// Maps specific modifier words to additional sound details for ElevenLabs
const MODIFIER_SOUNDS: Record<string, string> = {
  // Environmental states
  flooded:    "standing water flooding the floor, slow splashing echoes and constant relentless dripping",
  burning:    "roaring fire consuming wood and stone, crackling and spitting embers, heat-warped air",
  frozen:     "howling arctic wind, crystalline silence, the occasional deep groan of freezing stone",
  overgrown:  "leaves and vines rustling in the breeze, insects and birdsong reclaiming old stonework",
  collapsed:  "rubble settling with soft thuds, occasional loose stone falling, dust-heavy unstable silence",
  smoky:      "thick acrid smoke deadening all sound, muffled acoustics, distant crackling",
  flooded_combat: "water churning underfoot, splashing impacts, desperate battle in standing water",
  // Lighting and time of day
  moonlit:    "open night sky above, cool breeze stirring the darkness, distant night insects and owls",
  torchlit:   "torch flames softly guttering in still air, warm amber light and deep dancing shadows, wax dripping",
  dawn:       "first light birdsong building slowly, dew settling on grass, the world stirring in cool pale morning",
  dusk:       "evening insects waking, air cooling, the day's sounds gradually quieting into blue twilight",
  // Atmosphere / feel
  underground:"immense underground weight, earth-muffled acoustics, the vast pressing silence of buried stone",
  sacred:     "resonant bell harmonics slowly fading, hushed reverence, incense in perfectly still air",
  haunted:    "faint spectral whispers just below hearing, inexplicable cold drafts, unnerving hollow silence",
  cursed:     "low subsonic dread vibration, oppressive psychic weight, a wrongness saturating the air",
  ancient:    "geological silence, the crushing weight of deep time, nothing moving in a thousand years",
  ethereal:   "shimmering high-frequency resonance, a sound almost like breathing, otherworldly stillness",
  arcane:     "crackling magical energy, a deep humming from arcane machinery or wards, charged ozone air",
  crimson:    "thick oppressive atmosphere, something dripping slowly, unsettling weight of violence past",
  festive:    "lively crowd murmur, distant music and laughter, coins and glasses, celebratory warmth",
  eerie:      "unnatural quiet, distant sounds that make no sense, the stillness of something watching",
  misty:      "thick rolling fog swallowing all sound, dampened muffled acoustics, visibility swallowed by grey",
  // Weather
  stormy:     "howling wind and driving rain, rolling thunder, the crack and flash of nearby lightning",
  volcanic:   "low magma rumbling underfoot, hissing steam venting from cracks, occasional rock splitting",
  tidal:      "rhythmic waves surging in and receding slowly, sea spray on stone, the pull of deep water",
  // Architecture
  vaulted:    "massive vaulted stone ceiling amplifying every footstep into cathedral-scale resonance",
  courtyard:  "open courtyard within fortress walls, wind channeled between high battlements, echoing distance",
  mossy:      "damp organic stillness, ancient moisture seeping through old stonework, soft muffled quiet",
  // Terrain
  coastal:    "sea breeze and crashing waves just below, salt air, tide rhythmically washing the rocks",
  marsh:      "wetland insects and frogs, water moving through reeds, mud sucking at every step",
  autumn:     "dry leaves skittering across stone, bare branches clicking in the wind, melancholy stillness",
  // Social
  market:     "merchants calling their wares, shuffling crowds, coins changing hands, a dozen languages blending",
  // Desolation
  abandoned:  "total desolation, no living presence, the absence of any sound carrying its own oppressive weight",
};

function buildPrompt(sceneType: string, modifiers: string[], description: string, isCombat: boolean): string {
  const base = isCombat
    ? (COMBAT_LAYER[sceneType] ?? COMBAT_LAYER.default)
    : (AMBIANCE_PROMPTS[sceneType] ?? `ambient ${sceneType} environment, immersive fantasy soundscape`);

  // Build meaningful sound additions from modifiers
  const modAdditions = modifiers
    .map(m => MODIFIER_SOUNDS[m])
    .filter(Boolean)
    .join(", ");
  const modStr = modAdditions ? `, ${modAdditions}` : "";

  // Use the scene description for extra specificity
  const descExtra = description.length > 15 ? `, ${description.slice(0, 120)}` : "";
  return `${base}${modStr}${descExtra}, seamless looping ambient audio, high fidelity, no music, pure environmental sound`;
}

export async function POST(req: NextRequest) {
  try {
    const { sceneKey, sceneType, modifiers = [], description = "", isCombat = false } = await req.json() as {
      sceneKey: string; sceneType: string; modifiers?: string[]; description?: string; isCombat?: boolean;
    };

    if (!sceneKey?.trim()) return Response.json({ audioUrl: null });

    const storageFile = `audio/${sceneKey}.mp3`;

    // Cache check — list the audio subfolder
    const { data: listed } = await supabase.storage.from("scenes").list("audio");
    const cached = listed?.find(f => f.name === `${sceneKey}.mp3`);
    if (cached) {
      const { data: { publicUrl } } = supabase.storage.from("scenes").getPublicUrl(storageFile);
      return Response.json({ audioUrl: publicUrl });
    }

    // No ElevenLabs key → silent fallback
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn("[generate-scene-audio] ELEVENLABS_API_KEY not set");
      return Response.json({ audioUrl: null });
    }

    // Generate with ElevenLabs Sound Generation
    const prompt = buildPrompt(sceneType, modifiers, description, isCombat);
    const elRes = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method:  "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body:    JSON.stringify({ text: prompt, duration_seconds: 22, prompt_influence: 0.35 }),
    });

    if (!elRes.ok) {
      console.warn("[generate-scene-audio] ElevenLabs:", elRes.status, await elRes.text().catch(() => ""));
      return Response.json({ audioUrl: null });
    }

    const audioBuffer = Buffer.from(await elRes.arrayBuffer());

    const { error } = await supabase.storage
      .from("scenes")
      .upload(storageFile, audioBuffer, { contentType: "audio/mpeg", upsert: true });

    if (error) {
      console.warn("[generate-scene-audio] upload:", error.message);
      return Response.json({ audioUrl: null });
    }

    const { data: { publicUrl } } = supabase.storage.from("scenes").getPublicUrl(storageFile);
    return Response.json({ audioUrl: publicUrl });
  } catch (err) {
    console.error("[generate-scene-audio]", err);
    return Response.json({ audioUrl: null });
  }
}
