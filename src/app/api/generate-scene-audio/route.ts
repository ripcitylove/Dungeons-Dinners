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
  dungeon:    "dungeon combat, steel clashing on stone walls, echoing battle cries, urgent and dangerous",
  forest:     "forest combat, snapping branches, battle cries, desperate fighting among trees",
  tavern:     "tavern brawl, crashing furniture, shattering mugs, chaotic close-quarters fighting",
  default:    "intense combat, steel clashing, urgent grunts and battle cries, life-or-death tension",
};

function buildPrompt(sceneType: string, modifiers: string[], description: string, isCombat: boolean): string {
  const base = isCombat
    ? (COMBAT_LAYER[sceneType] ?? COMBAT_LAYER.default)
    : (AMBIANCE_PROMPTS[sceneType] ?? `ambient ${sceneType} environment, immersive soundscape`);

  const modStr = modifiers.length > 0 ? `, ${modifiers.join(", ")} quality` : "";
  const descExtra = description.length > 15 ? `, ${description.slice(0, 100)}` : "";
  return `${base}${modStr}${descExtra}, seamless looping ambient audio, high fidelity, no music, pure sound environment`;
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
