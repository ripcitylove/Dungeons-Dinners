import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
};

const SCENE_SYSTEM = `You are a scene classifier for a fantasy RPG. Read the DM narrative and return EXACTLY one of these scene keys:
tavern, dungeon, forest, cave, ruins, castle, street, shop, temple, wilderness, ship, graveyard

Return ONLY the single word. No explanation, no punctuation.`;

export async function POST(req: NextRequest) {
  try {
    const { narrative, currentScene } = (await req.json()) as {
      narrative: string;
      currentScene: string;
    };

    if (!narrative?.trim()) return Response.json({ sceneName: currentScene ?? "tavern" });

    // Step 1: Detect scene name
    const detect = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 10,
      system:     SCENE_SYSTEM,
      messages:   [{ role: "user", content: narrative.slice(0, 800) }],
    });

    const raw       = detect.content[0].type === "text" ? detect.content[0].text.trim().toLowerCase() : "";
    const sceneName = Object.keys(SCENE_PROMPTS).includes(raw) ? raw : (currentScene ?? "tavern");

    // Same scene — no image change needed
    if (sceneName === currentScene) return Response.json({ sceneName, imageUrl: null });

    // Step 2: Check DB cache
    const { data: cached } = await supabase
      .from("scenes")
      .select("image_url")
      .eq("name", sceneName)
      .single();

    if (cached?.image_url) return Response.json({ sceneName, imageUrl: cached.image_url });

    // Step 3: Generate new scene image with DALL-E
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const scenePrompt = SCENE_PROMPTS[sceneName];
    const fullPrompt  = `Fantasy RPG environment art. ${scenePrompt}. Wide cinematic landscape view, dramatic fantasy painting style, moody atmosphere, dark fantasy aesthetic, no characters, no text.`;

    const imgResponse = await openai.images.generate({
      model:   "dall-e-3",
      prompt:  fullPrompt,
      size:    "1792x1024",
      quality: "standard",
      n:       1,
    });

    const dalleUrl = imgResponse.data?.[0]?.url;
    if (!dalleUrl) return Response.json({ sceneName, imageUrl: null });

    // Step 4: Upload to Supabase Storage
    const imgFetch  = await fetch(dalleUrl);
    const imgBuffer = await imgFetch.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("scenes")
      .upload(`${sceneName}.png`, imgBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.warn("[detect-scene] storage upload failed:", uploadError.message);
      // Cache the DALL-E URL temporarily
      await supabase.from("scenes").upsert({ name: sceneName, image_url: dalleUrl });
      return Response.json({ sceneName, imageUrl: dalleUrl });
    }

    const { data: { publicUrl } } = supabase.storage.from("scenes").getPublicUrl(`${sceneName}.png`);

    // Step 5: Cache in DB
    await supabase.from("scenes").upsert({ name: sceneName, image_url: publicUrl });

    return Response.json({ sceneName, imageUrl: publicUrl });
  } catch (err) {
    console.error("[detect-scene]", err);
    return Response.json({ sceneName: "tavern", imageUrl: null });
  }
}
