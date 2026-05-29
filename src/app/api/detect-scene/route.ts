import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Base visual descriptions per scene type — used as the foundation for the DALL-E prompt,
// enriched with narrative-specific details extracted by Claude.
const SCENE_BASE: Record<string, string> = {
  tavern:      "A medieval tavern interior — stone walls, wooden beams, flickering candles, ale mugs, a roaring hearth",
  dungeon:     "A dark stone dungeon — flickering torchlight casting long shadows on mossy blocks, iron doors, damp walls",
  forest:      "A dense mystical forest — towering ancient trees, shafts of dim light, twisted roots, ethereal mist",
  cave:        "An underground cave — crystalline formations, stalactites hanging like teeth, bioluminescent fungi",
  ruins:       "Ancient crumbling ruins — broken stone arches, vines reclaiming carved pillars, moonlight through collapsed ceilings",
  castle:      "A grand medieval castle interior — vaulted stone halls, tapestried walls, high stained-glass windows, flickering torches",
  street:      "A cobblestone medieval city street at night — lantern-lit storefronts, cloaked figures, rain-slick stones",
  shop:        "A cluttered merchant's shop — shelves of potions and curiosities, hanging herbs, warm candlelight",
  temple:      "An ancient stone temple — ceremonial columns rising into shadow, incense smoke, a rune-carved altar",
  wilderness:  "A dramatic open wilderness — rugged terrain under storming skies, a winding dirt path, unnamed danger on the horizon",
  ship:        "The deck of a dark fantasy sailing vessel — creaking wood, swaying lanterns, rope rigging, dark churning water",
  graveyard:   "An old moonlit graveyard — crooked tombstones, bare gnarled trees, mist curling across the cold ground",
  prison:      "A grim stone prison — iron-barred cells, damp torchlit corridors, chains and dripping water",
  arena:       "A vast open-air gladiatorial arena — packed sand floor, roaring crowd in stone seats, iron portcullises",
  port:        "A fantasy port at dusk — tall ships moored at weathered docks, salty mist, sailors and merchants",
  desert:      "A vast scorched desert — rolling dunes under a blazing sun, heat shimmering on the horizon, bleached bones",
  mountain:    "A treacherous mountain pass — sheer cliffs dropping into fog, icy ledges, howling wind",
  swamp:       "A murky swampland at dusk — twisted black trees rising from dark water, fireflies, hanging moss",
  library:     "A vast arcane library — towering shelves of leather-bound tomes, floating candles, dust motes in still air",
  village:     "A small pastoral village — thatched cottages, a muddy square, smoke rising from chimneys",
};

const COMBAT_SUFFIX: Record<string, string> = {
  tavern:     "erupting into a brawl — overturned tables, shattered mugs, combatants clashing in torchlight",
  dungeon:    "mid-battle — stone floor scattered with weapons, torchlight strobing from the violence",
  forest:     "erupting in battle — broken branches, leaves torn by movement, chaos among ancient trees",
  cave:       "in the chaos of combat — glowing crystals casting wild colors on battling figures",
  ruins:      "consumed by battle — crumbling stone spraying from impacts, fighters using broken arches for cover",
  castle:     "in the heat of battle — toppled banners, armored fighters clashing, steel ringing off stone walls",
  street:     "in a street ambush — cloaked fighters clashing under swinging lanterns, citizens fleeing",
  temple:     "defiled by battle — holy statues cracked, altar fire flickering wild, desperate combat",
  wilderness: "as an open battlefield — fighters locked in combat among rocks and grass, stormy sky above",
  ship:       "in a ship deck battle — combatants fighting across heaving planks, salt spray and cannon smoke",
  arena:      "in a gladiatorial fight — combatants circling on blood-stained sand, crowd roaring",
};

const SCENE_SYSTEM = `You are a scene classifier for a D&D fantasy RPG. Analyze the DM narrative and return a JSON object.

SCENE TYPES (pick exactly one):
tavern, dungeon, forest, cave, ruins, castle, street, shop, temple, wilderness, ship, graveyard, prison, arena, port, desert, mountain, swamp, library, village

CLASSIFICATION RULES:
- INDOOR: inside a structure → tavern, dungeon, castle, library, temple, shop, prison, cave
- OUTDOOR ruins: crumbling walls open to sky → ruins
- Wilderness ONLY if truly outdoors with no primary structure
- Default to dungeon for any underground or enclosed ancient setting

Return ONLY valid JSON, no other text:
{"type":"<scene_type>","description":"<1-2 sentences describing this specific scene's lighting, atmosphere, and key visual details>","modifiers":["<word1>"]}

modifiers: 1-3 lowercase single words capturing what makes THIS scene visually distinct from a generic version (e.g. "flooded", "burning", "moonlit", "ornate", "frozen", "collapsed", "smoky", "overgrown", "crimson", "underground"). Omit if truly generic.`;

function buildCacheKey(type: string, modifiers: string[], isCombat: boolean): string {
  const base = modifiers.length > 0
    ? `${type}_${modifiers.sort().slice(0, 2).join("_")}`
    : type;
  return isCombat ? `${base}_combat` : base;
}

function buildPrompt(type: string, modifiers: string[], description: string, isCombat: boolean): string {
  const base = SCENE_BASE[type] ?? `a ${type} location in a dark fantasy world`;
  const combatSuffix = isCombat ? ` ${COMBAT_SUFFIX[type] ?? "mid-battle with combatants clashing"}` : "";
  const extras = description.length > 10 ? ` ${description}` : "";
  return `Fantasy RPG environment art. ${base}${combatSuffix}.${extras} Wide cinematic landscape view, dramatic fantasy painting style, moody atmosphere, dark fantasy aesthetic, no characters, no text.`;
}

export async function POST(req: NextRequest) {
  let currentScene = "wilderness";
  try {
    const body = (await req.json()) as {
      narrative: string; currentScene: string; isCombat?: boolean; campaignDescription?: string;
    };
    const { narrative, isCombat = false, campaignDescription } = body;
    currentScene = body.currentScene ?? "wilderness";

    if (!narrative?.trim()) return Response.json({ sceneName: currentScene });

    const contextPrefix = campaignDescription
      ? `Campaign setting: ${campaignDescription.slice(0, 200)}\n\nCurrent narrative:\n`
      : "";

    // Step 1: Classify scene AND extract visual descriptors in one call
    const detect = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system:     SCENE_SYSTEM,
      messages:   [{ role: "user", content: `${contextPrefix}${narrative.slice(0, 800)}` }],
    });

    const raw = detect.content[0].type === "text" ? detect.content[0].text.trim() : "";

    let sceneType  = currentScene.replace("_combat", "") || "wilderness";
    let modifiers: string[] = [];
    let description = "";

    try {
      const parsed = JSON.parse(raw);
      if (parsed.type && SCENE_BASE[parsed.type]) sceneType = parsed.type;
      if (Array.isArray(parsed.modifiers)) modifiers = parsed.modifiers.map((m: unknown) => String(m).toLowerCase().replace(/[^a-z]/g, "")).filter(Boolean).slice(0, 3);
      if (parsed.description) description = String(parsed.description).slice(0, 300);
    } catch {
      // JSON parse failed — try to extract just the type from the raw text
      const word = raw.toLowerCase().match(/\b(tavern|dungeon|forest|cave|ruins|castle|street|shop|temple|wilderness|ship|graveyard|prison|arena|port|desert|mountain|swamp|library|village)\b/)?.[1];
      if (word) sceneType = word;
    }

    const sceneName = buildCacheKey(sceneType, modifiers, isCombat);

    // Same scene key — no change needed
    if (sceneName === currentScene) return Response.json({ sceneName, imageUrl: null });

    // Step 2: Check cache — exact match only (no cross-type fallbacks)
    const { data: allCached } = await supabase.from("scenes").select("name, image_url");
    const cacheMap = new Map((allCached ?? []).map(s => [s.name as string, s.image_url as string]));

    const exactUrl = cacheMap.get(sceneName);
    if (exactUrl) return Response.json({ sceneName, imageUrl: exactUrl });

    // Step 3: Generate a new image specific to this scene
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const fullPrompt = buildPrompt(sceneType, modifiers, description, isCombat);

    const imgResponse = await openai.images.generate({
      model:   "gpt-image-1",
      prompt:  fullPrompt,
      size:    "1536x1024",
      quality: "medium",
      n:       1,
    });

    const b64 = imgResponse.data?.[0]?.b64_json;
    if (!b64) return Response.json({ sceneName, imageUrl: null });

    const storageKey = `${sceneName}.png`;
    const { error: uploadError } = await supabase.storage
      .from("scenes")
      .upload(storageKey, Buffer.from(b64, "base64"), { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.warn("[detect-scene] upload failed:", uploadError.message);
      return Response.json({ sceneName, imageUrl: null });
    }

    const { data: { publicUrl } } = supabase.storage.from("scenes").getPublicUrl(storageKey);
    await supabase.from("scenes").upsert({ name: sceneName, image_url: publicUrl });

    return Response.json({ sceneName, imageUrl: publicUrl });
  } catch (err) {
    console.error("[detect-scene]", err);
    return Response.json({ sceneName: currentScene ?? "wilderness", imageUrl: null });
  }
}
