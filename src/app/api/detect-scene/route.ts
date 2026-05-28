import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SCENE_PROMPTS: Record<string, string> = {
  tavern:     "A dimly lit medieval tavern interior — stone walls, wooden beams, flickering candles, smoke-stained oak tables, ale mugs, a roaring hearth",
  dungeon:    "A dark stone dungeon corridor — flickering torchlight casting shadows on mossy blocks, iron doors, chains on walls, an ancient oppressive silence",
  forest:     "A dense mystical forest — towering ancient trees, rays of dim light piercing the canopy, twisted roots, glowing mushrooms, an eerie mist",
  cave:       "A vast underground cave — crystalline formations, an underground lake reflecting dark water, stalactites, bioluminescent fungi, ancient silence",
  ruins:      "Ancient crumbling ruins — broken stone arches, vines reclaiming carved pillars, moonlight through collapsed ceilings, scattered rubble",
  castle:     "A grand medieval castle interior — vaulted stone halls, tapestried walls, high stained-glass windows, flickering torches, heavy shadows",
  street:     "A cobblestone medieval city street at night — lantern-lit storefronts, cloaked figures in doorways, rain-slick stones, shadows between buildings",
  shop:       "A cluttered merchant's shop interior — shelves of potions and curiosities, hanging herbs, candlelight, a mysterious proprietor behind a counter",
  temple:     "An ancient stone temple interior — rows of ceremonial columns, incense smoke drifting through shafts of light, an imposing altar, rune-carved floors",
  wilderness: "A dramatic wilderness landscape — rugged mountains under storm clouds, a winding dirt path, wild grass, distant dark horizon",
  ship:       "The deck and interior of a dark fantasy sailing vessel — creaking wood, lanterns swaying in sea wind, rope rigging, dark churning water below",
  graveyard:  "An old moonlit graveyard — crooked tombstones, bare gnarled trees, mist curling across the ground, the distant howl of wind",
  prison:     "A grim stone prison cell block — iron-barred cells, damp torchlit corridors, distant sounds of chains and dripping water, a guard tower visible through a slit window",
  arena:      "A vast open-air gladiatorial arena — packed sand floor stained with old battles, roaring crowds in tiered stone seats, iron portcullises, a merciless midday sun",
  port:       "A bustling fantasy port at dusk — tall ships moored at weathered docks, seagulls crying overhead, barrels of cargo, salty mist, the clamour of sailors and merchants",
  desert:     "A vast scorched desert landscape — rolling dunes under a blazing sun, heat shimmering on the horizon, bleached bones half-buried in sand, a lone caravan trail",
  mountain:   "A treacherous mountain pass at altitude — sheer cliffs dropping into fog, icy ledges, howling wind, a distant fortress carved into the rock face",
  swamp:      "A murky swampland at dusk — twisted black trees rising from black water, fireflies drifting through hanging moss, the croak of unseen things, a faint putrid smell",
  library:    "A vast arcane library — towering shelves of leather-bound tomes, floating candles, dust motes hanging in still air, the scratch of quill on parchment, a sense of ancient secrets",
  village:    "A small pastoral village under threat — thatched cottages, a muddy square, frightened faces peering through shuttered windows, smoke rising in the wrong direction",
};

// Visually similar scene groups — used as fallbacks before generating a new image.
// Order matters: first match wins. Only reused if exact scene has no cached image.
const SCENE_FALLBACKS: Record<string, string[]> = {
  cave:       ["dungeon", "prison"],
  dungeon:    ["cave", "prison"],
  prison:     ["dungeon", "cave"],
  graveyard:  ["ruins", "dungeon"],
  ruins:      ["graveyard", "castle"],
  castle:     ["ruins", "temple"],
  temple:     ["castle", "library"],
  library:    ["temple", "castle"],
  forest:     ["wilderness", "swamp"],
  swamp:      ["forest", "wilderness"],
  wilderness: ["forest", "mountain", "desert"],
  mountain:   ["wilderness", "desert"],
  desert:     ["wilderness", "mountain"],
  village:    ["street", "shop"],
  street:     ["village", "port"],
  shop:       ["tavern", "village"],
  tavern:     ["shop", "street"],
  port:       ["ship", "street"],
  ship:       ["port"],
  arena:      ["ruins", "castle"],
};

const SCENE_SYSTEM = `You are a scene classifier for a fantasy RPG. Read the DM narrative and return EXACTLY one of these scene keys:
tavern, dungeon, forest, cave, ruins, castle, street, shop, temple, wilderness, ship, graveyard, prison, arena, port, desert, mountain, swamp, library, village

Return ONLY the single word. No explanation, no punctuation.`;

export async function POST(req: NextRequest) {
  let currentScene = "wilderness";
  try {
    const body = (await req.json()) as { narrative: string; currentScene: string };
    const { narrative } = body;
    currentScene = body.currentScene ?? "wilderness";

    if (!narrative?.trim()) return Response.json({ sceneName: currentScene });

    // Step 1: Detect scene name
    const detect = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 10,
      system:     SCENE_SYSTEM,
      messages:   [{ role: "user", content: narrative.slice(0, 800) }],
    });

    const raw       = detect.content[0].type === "text" ? detect.content[0].text.trim().toLowerCase() : "";
    const sceneName = Object.keys(SCENE_PROMPTS).includes(raw) ? raw : (currentScene ?? "wilderness");

    // Same scene — no image change needed
    if (sceneName === currentScene) return Response.json({ sceneName, imageUrl: null });

    // Step 2: Fetch all cached scene images in one query
    const { data: allCached } = await supabase.from("scenes").select("name, image_url");
    const cacheMap = new Map((allCached ?? []).map(s => [s.name as string, s.image_url as string]));

    // Exact cache hit
    const exactUrl = cacheMap.get(sceneName);
    if (exactUrl) return Response.json({ sceneName, imageUrl: exactUrl });

    // Visually similar fallback — reuse an existing image rather than generating
    const fallbacks = SCENE_FALLBACKS[sceneName] ?? [];
    const fallbackUrl = fallbacks.map(f => cacheMap.get(f)).find(Boolean);
    if (fallbackUrl) {
      console.log(`[detect-scene] reusing ${fallbacks.find(f => cacheMap.get(f))} image for ${sceneName}`);
      return Response.json({ sceneName, imageUrl: fallbackUrl });
    }

    // Step 3: No suitable existing image — generate with DALL-E
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const scenePrompt = SCENE_PROMPTS[sceneName];
    const fullPrompt  = `Fantasy RPG environment art. ${scenePrompt}. Wide cinematic landscape view, dramatic fantasy painting style, moody atmosphere, dark fantasy aesthetic, no characters, no text.`;

    const imgResponse = await openai.images.generate({
      model:   "gpt-image-1",
      prompt:  fullPrompt,
      size:    "1536x1024",
      quality: "medium",
      n:       1,
    });

    const b64 = imgResponse.data?.[0]?.b64_json;
    if (!b64) return Response.json({ sceneName, imageUrl: fallbackUrl ?? null });

    // Step 4: Upload to Supabase Storage
    const imgBuffer = Buffer.from(b64, "base64");

    const { error: uploadError } = await supabase.storage
      .from("scenes")
      .upload(`${sceneName}.png`, imgBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.warn("[detect-scene] storage upload failed:", uploadError.message);
      return Response.json({ sceneName, imageUrl: fallbackUrl ?? null });
    }

    const { data: { publicUrl } } = supabase.storage.from("scenes").getPublicUrl(`${sceneName}.png`);

    // Step 5: Cache in DB
    await supabase.from("scenes").upsert({ name: sceneName, image_url: publicUrl });

    return Response.json({ sceneName, imageUrl: publicUrl });
  } catch (err) {
    console.error("[detect-scene]", err);
    return Response.json({ sceneName: currentScene ?? "wilderness", imageUrl: null });
  }
}
