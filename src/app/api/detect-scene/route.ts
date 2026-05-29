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
  tavern:            "A dimly lit medieval tavern interior — stone walls, wooden beams, flickering candles, smoke-stained oak tables, ale mugs, a roaring hearth, warm amber light",
  tavern_combat:     "A medieval tavern brawl in full chaos — overturned tables, shattered mugs, chairs flying, combatants clashing in wild torchlight, a barrel rolling across the floor",
  dungeon:           "A dark stone dungeon corridor — flickering torchlight casting long shadows on mossy blocks, iron doors, chains on damp walls, an ancient oppressive silence",
  dungeon_combat:    "A dungeon chamber mid-battle — stone floor scattered with weapons, torchlight strobing from the violence, dark silhouettes locked in desperate combat, blood on the stone",
  forest:            "A dense mystical forest — towering ancient trees, shafts of dim light piercing the canopy, twisted roots, glowing mushrooms, ethereal mist curling along the ground",
  forest_combat:     "A forest clearing erupting in battle — broken branches, leaves torn by movement, dappled lethal light through the canopy, the chaos of combat among the ancient trees",
  cave:              "A vast underground cave — crystalline formations catching light, an underground lake reflecting dark water, stalactites hanging like teeth, bioluminescent fungi",
  cave_combat:       "A cavern fight — stalactites overhead, the echoing crash of weapons, glowing crystals casting wild colors on battling figures, shadows dancing across wet stone",
  ruins:             "Ancient crumbling ruins — broken stone arches, vines reclaiming carved pillars, moonlight through collapsed ceilings, scattered rubble and forgotten grandeur",
  ruins_combat:      "Ancient ruins consumed by battle — crumbling stone spraying from weapon impacts, fighters using broken arches for cover, dust and debris in the air, desperate combat",
  castle:            "A grand medieval castle interior — vaulted stone halls, tapestried walls, high stained-glass windows, flickering torches throwing long shadows on the stone floors",
  castle_combat:     "A castle great hall in the heat of battle — toppled banners, armored fighters clashing, steel ringing off stone walls, the echoing chaos of castle siege",
  street:            "A cobblestone medieval city street at night — lantern-lit storefronts, cloaked figures in doorways, rain-slick stones, the tension of dark alleys",
  street_combat:     "A city street ambush — cloaked fighters clashing under swinging lanterns, shutters slamming, citizens fleeing, lantern-light catching drawn steel in the rain",
  shop:              "A cluttered merchant's shop — shelves of potions and curiosities, hanging herbs, warm candlelight, a mysterious proprietor behind a counter of wonders",
  temple:            "An ancient stone temple — ceremonial columns rising into shadow, incense smoke drifting through shafts of divine light, a rune-carved altar radiating quiet power",
  temple_combat:     "A sacred temple defiled by battle — holy statues cracked, altar fire flickering wild, divine symbols clashing with darkness, desperate combat in the incense smoke",
  wilderness:        "A dramatic wilderness landscape — rugged mountains under storming skies, a winding dirt path through wild grass, the dark horizon full of unnamed danger",
  wilderness_combat: "An open battlefield in the wilderness — fighters locked in combat among rocks and grass, dramatic stormy sky above, earth torn up by the struggle, raw violent energy",
  ship:              "The deck of a dark fantasy sailing vessel — creaking wood, swaying lanterns in sea wind, rope rigging catching moonlight, dark churning water below",
  ship_combat:       "A ship deck battle — combatants fighting across heaving planks, rigging swinging overhead, salt spray and cannon smoke, chaos on the dark churning sea",
  graveyard:         "An old moonlit graveyard — crooked tombstones, bare gnarled trees, mist curling across the cold ground, the distant howl of wind through iron gates",
  prison:            "A grim stone prison — iron-barred cells, damp torchlit corridors, distant sounds of chains and dripping water, the hopeless weight of captivity",
  arena:             "A vast open-air gladiatorial arena — packed sand floor stained with old battles, roaring crowd in stone seats, iron portcullises, merciless midday sun",
  port:              "A fantasy port at dusk — tall ships moored at weathered docks, seagulls crying, barrels of cargo, salty mist, the clamour of sailors and merchants",
  desert:            "A vast scorched desert — rolling dunes under a blazing sun, heat shimmering on the horizon, bleached bones half-buried in sand, a lone caravan trail",
  mountain:          "A treacherous mountain pass — sheer cliffs dropping into fog, icy ledges, howling wind, a distant fortress carved into the rock face above the clouds",
  swamp:             "A murky swampland at dusk — twisted black trees rising from dark water, fireflies drifting through hanging moss, the croak of unseen creatures, eerie stillness",
  library:           "A vast arcane library — towering shelves of leather-bound tomes, floating candles, dust motes in still air, the scratch of quill on parchment, ancient secrets",
  village:           "A small pastoral village under threat — thatched cottages, a muddy square, frightened faces at shuttered windows, smoke rising from the wrong direction",
};

const SCENE_FALLBACKS: Record<string, string[]> = {
  cave:              ["dungeon", "prison"],
  dungeon:           ["cave", "prison"],
  cave_combat:       ["dungeon_combat"],
  dungeon_combat:    ["cave_combat", "ruins_combat"],
  prison:            ["dungeon", "cave"],
  graveyard:         ["ruins", "dungeon"],
  ruins:             ["graveyard", "castle"],
  ruins_combat:      ["dungeon_combat", "castle_combat"],
  castle:            ["ruins", "temple"],
  castle_combat:     ["ruins_combat", "dungeon_combat"],
  temple:            ["castle", "library"],
  temple_combat:     ["castle_combat", "ruins_combat"],
  library:           ["temple", "castle"],
  forest:            ["wilderness", "swamp"],
  forest_combat:     ["wilderness_combat"],
  swamp:             ["forest", "wilderness"],
  wilderness:        ["forest", "mountain", "desert"],
  wilderness_combat: ["forest_combat", "ruins_combat"],
  mountain:          ["wilderness", "desert"],
  desert:            ["wilderness", "mountain"],
  village:           ["street", "shop"],
  street:            ["village", "port"],
  street_combat:     ["tavern_combat", "ruins_combat"],
  shop:              ["tavern", "village"],
  tavern:            ["shop", "street"],
  tavern_combat:     ["street_combat"],
  port:              ["ship", "street"],
  ship:              ["port"],
  ship_combat:       ["arena", "wilderness_combat"],
  arena:             ["ruins", "castle"],
};

const SCENE_SYSTEM = `You are a scene classifier for a D&D fantasy RPG. Read the DM narrative and return EXACTLY one scene key.

AVAILABLE KEYS (pick the single best match):
tavern, dungeon, forest, cave, ruins, castle, street, shop, temple, wilderness, ship, graveyard, prison, arena, port, desert, mountain, swamp, library, village

CLASSIFICATION RULES — read carefully:
- INDOOR scenes: if characters are INSIDE a structure (inn, tavern, great hall, throne room, library, dungeon corridor, prison cell, temple interior, shop, underground cave) → use the indoor key (tavern, dungeon, castle, library, temple, shop, prison, cave)
- OUTDOOR ruins: crumbling walls open to the sky, collapsed structures, outdoor rubble → ruins
- INDOOR ruins-style: an ancient underground chamber, sealed vault, or intact ruin interior → dungeon or castle
- Wilderness ONLY if truly outdoors with no primary structure (open road, hillside, plains, jungle)
- "ancient hall", "stone chamber", "great hall", "corridor", "vaulted ceiling" → castle or dungeon (INDOOR), NOT ruins
- Default to dungeon for any underground or enclosed ancient setting

Return ONLY the single key word. No explanation, no punctuation.`;

export async function POST(req: NextRequest) {
  let currentScene = "wilderness";
  try {
    const body = (await req.json()) as { narrative: string; currentScene: string; isCombat?: boolean; campaignDescription?: string };
    const { narrative, isCombat, campaignDescription } = body;
    currentScene = body.currentScene ?? "wilderness";

    if (!narrative?.trim()) return Response.json({ sceneName: currentScene });

    // Build context: campaign description gives the AI a frame of reference
    const contextPrefix = campaignDescription
      ? `Campaign setting: ${campaignDescription.slice(0, 200)}\n\nCurrent narrative: `
      : "";

    // Step 1: Detect base scene type
    const detect = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 10,
      system:     SCENE_SYSTEM,
      messages:   [{ role: "user", content: `${contextPrefix}${narrative.slice(0, 700)}` }],
    });

    const raw      = detect.content[0].type === "text" ? detect.content[0].text.trim().toLowerCase() : "";
    const baseScene = Object.keys(SCENE_PROMPTS).includes(raw) ? raw : (currentScene.replace("_combat", "") ?? "wilderness");

    // Use combat variant when in active combat
    const sceneName = isCombat ? `${baseScene}_combat` : baseScene;

    // Same scene — no image change needed
    if (sceneName === currentScene) return Response.json({ sceneName, imageUrl: null });

    // Step 2: Fetch all cached scene images
    const { data: allCached } = await supabase.from("scenes").select("name, image_url");
    const cacheMap = new Map((allCached ?? []).map(s => [s.name as string, s.image_url as string]));

    // Exact cache hit
    const exactUrl = cacheMap.get(sceneName);
    if (exactUrl) return Response.json({ sceneName, imageUrl: exactUrl });

    // Visually similar fallback
    const fallbacks = SCENE_FALLBACKS[sceneName] ?? [];
    const fallbackUrl = fallbacks.map(f => cacheMap.get(f)).find(Boolean);
    if (fallbackUrl) {
      return Response.json({ sceneName, imageUrl: fallbackUrl });
    }

    // Step 3: No suitable image — generate with DALL-E
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const scenePrompt = SCENE_PROMPTS[sceneName] ?? SCENE_PROMPTS[baseScene];
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

    const imgBuffer = Buffer.from(b64, "base64");

    const { error: uploadError } = await supabase.storage
      .from("scenes")
      .upload(`${sceneName}.png`, imgBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.warn("[detect-scene] storage upload failed:", uploadError.message);
      return Response.json({ sceneName, imageUrl: fallbackUrl ?? null });
    }

    const { data: { publicUrl } } = supabase.storage.from("scenes").getPublicUrl(`${sceneName}.png`);

    await supabase.from("scenes").upsert({ name: sceneName, image_url: publicUrl });

    return Response.json({ sceneName, imageUrl: publicUrl });
  } catch (err) {
    console.error("[detect-scene]", err);
    return Response.json({ sceneName: currentScene ?? "wilderness", imageUrl: null });
  }
}
