import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const AMBIANCE_PROMPTS: Record<string, string> = {
  tavern:     "cozy medieval tavern interior, warm murmuring crowd, clinking mugs and wooden cups, roaring fireplace, laughter in the background, ale being poured",
  dungeon:    "dark underground dungeon, echoing drips of water on stone, distant chains rattling, torch fire guttering, damp air, oppressive silence broken by faint footsteps",
  forest:     "mystical old-growth forest, wind moving gently through leaves, crickets and frogs, distant bird calls, branches creaking, ethereal peaceful atmosphere",
  cave:       "vast underground cave, water dripping into a still pool, deep resonant echoes, crystalline hum, bioluminescent silence, ancient geological sounds",
  ruins:      "crumbling ancient ruins, wind whistling through broken stone, loose rubble settling, creaking wooden beams, dust and sand shifting, forgotten grandeur",
  castle:     "grand stone castle interior, distant footsteps echoing on flagstone, wind through arrow-slit windows, torch flames in still air, regal and imposing",
  street:     "cobblestone medieval city street at night, distant footsteps, lanterns swaying in breeze, muffled voices from buildings, occasional cart wheel on stone",
  shop:       "cluttered alchemist shop, soft bubbling potions, herbs drying in warm air, quiet candlelight, pages turning, peaceful mercantile atmosphere",
  temple:     "sacred ancient temple, resonant bell tones, incense smoke in still air, hushed devotional murmur, stone amplifying silence, divine atmosphere",
  wilderness: "open wild landscape, howling wind across hills, distant thunder, tall grass and reeds rustling, raw dangerous and beautiful open air",
  ship:       "sailing ship at sea, creaking hull and rigging, wind through sails, waves rhythmically crashing, seagulls distant, salty spray",
  graveyard:  "moonlit graveyard, wind through iron gate hinges, leaves skittering on stone paths, distant howl, unsettling quiet, rustling bare branches",
  prison:     "damp stone prison, distant clanking chains, slow drip of water, muffled distant sounds of suffering, oppressive weight of confinement",
  arena:      "open gladiatorial arena, crowd roaring and stamping, anticipatory chanting, dust and heat, the hush before violence, thousands of voices",
  port:       "fantasy port at dusk, seagulls calling, waves slapping docks, sailors shouting, rope and pulley creaking, busy maritime atmosphere",
  desert:     "vast scorched desert, hot wind hissing through sand dunes, complete desolate silence, heat shimmer, distant sand shifting",
  mountain:   "high mountain pass, howling freezing wind, loose stones clattering, distant avalanche rumble, thin cold air, vast open emptiness",
  swamp:      "murky swampland, frogs and insects chorusing, water dripping from hanging moss, bubbling mud, eerie stillness broken by unseen creatures",
  library:    "vast arcane library, quill scratching on parchment, pages turning, books settling on shelves, dust motes in still air, scholarly quiet",
  village:    "small peaceful fantasy village, distant rooster, blacksmith hammer, children playing, wagon wheels, pastoral everyday life sounds",
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
  flooded:    "standing water flooding the floor, deep splashing echoes and constant dripping",
  burning:    "roaring fire and crackling flames consuming the space, heat haze and smoke",
  frozen:     "howling ice wind, crystalline silence, occasional creak of frozen stone",
  overgrown:  "rustling leaves and vines, insects and birdsong reclaiming the stonework",
  collapsed:  "settling rubble, occasional stone falling, dust and unstable silence",
  smoky:      "thick choking smoke, deadened muffled acoustics, distant crackling",
  moonlit:    "open night sky above, cool breeze, distant night insects and owls",
  underground:"deep underground weight, earth-muffled sound, the vast silence of buried stone",
  sacred:     "resonant bell harmonics, hushed reverence, incense and devotional calm",
  haunted:    "spectral whispers, inexplicable cold drafts, unnerving silence",
  cursed:     "low dread vibration, oppressive psychic weight, wrongness in the air",
  ancient:    "geological silence, the weight of millennia, deep time",
  ethereal:   "shimmering high-frequency resonance, otherworldly stillness",
  arcane:     "crackling magical energy, humming arcane machinery, charged air",
  crimson:    "thick oppressive atmosphere, dripping, unsettling red-tinged silence",
  festive:    "lively crowd murmur, distant music and laughter, celebratory atmosphere",
  stormy:     "howling wind and driving rain, thunder rumbling, lightning crack",
  volcanic:   "low rumbling magma, heat shimmer, occasional rock cracking and hissing steam",
  tidal:      "rhythmic waves surging in and receding, sea spray, wet stone",
  eerie:      "unnatural quiet, distant inexplicable sounds, unsettling stillness",
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
