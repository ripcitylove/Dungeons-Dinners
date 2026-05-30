import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Rich base descriptions — foundation layer for DALL-E, always evocative and moody
const SCENE_BASE: Record<string, string> = {
  tavern:      "A dimly lit medieval tavern — low wooden beams hung with iron lanterns, scarred oak tables, mugs of ale, a roaring stone hearth casting amber light across weathered faces",
  dungeon:     "A foreboding stone dungeon — torchlight guttering in damp corridors, mossy walls dripping with moisture, iron doors with rusted hinges, bones half-buried in dark earth",
  forest:      "An ancient mystical forest at the edge of night — cathedral-like trees older than memory, shafts of cold silver light, roots like grasping fingers, luminous mist threading between the trunks",
  cave:        "A vast underground cavern — crystalline formations refracting pale light, stalactites hanging like cathedral spires, bioluminescent fungi painting the dark in blue and violet hues",
  ruins:       "Crumbling ancient ruins — shattered stone arches choked with ivy, carved pillars tilting at odd angles, moonlight pouring through collapsed ceilings, the weight of lost civilizations in every stone",
  castle:      "A grand castle interior — soaring vaulted halls of pale stone, tapestries faded by centuries, stained-glass windows depicting forgotten battles, torch-shadows dancing across cold floors",
  street:      "A narrow cobblestone city street after midnight — gas lanterns casting sickly yellow halos, rain-slicked stones reflecting fractured light, shuttered storefronts and shadows that move wrong",
  shop:        "A cramped alchemist's shop overflowing with wonders — shelves bowing under grimoires and glowing vials, dried herbs and monster parts hanging from the rafters, the smell of sulfur and old paper",
  temple:      "An ancient sacred temple — colossal ceremonial columns rising into shadow, incense smoke curling past rune-carved altars, eerie phosphorescent light from no visible source",
  wilderness:  "A vast and merciless wilderness — jagged terrain under a churning storm sky, a dirt path swallowed by tall grass, distant peaks wrapped in storm-clouds, ominous and beautiful and alive",
  ship:        "The heaving deck of a dark fantasy galleon — rope rigging silhouetted against storm clouds, swaying lanterns carving orange arcs through sea spray, the groan of ancient timber",
  graveyard:   "An old graveyard under a pale full moon — crooked tombstones half-sunk into black earth, gnarled leafless trees reaching skyward, tendrils of silver mist drifting across the cold ground",
  prison:      "A medieval prison carved from bedrock — iron-barred cells vanishing into darkness, torchlit corridors slick with moisture, chains hanging from the walls, silence heavier than stone",
  arena:       "A vast open-air gladiatorial arena — a wide floor of rust-colored sand, towering stone grandstands, iron portcullises flanking shadowed passages, the ghost of a thousand roaring crowds",
  port:        "A fantasy port city at dusk — tall-masted ships moored along weathered docks, salty haze softening the orange skyline, merchant stalls and sailors and the smell of brine and tar",
  desert:      "An immense scorched desert under a merciless sun — rolling dunes casting purple shadows, heat shimmering off bleached stone, skeletal ruins half-buried in sand, utter silence",
  mountain:    "A treacherous mountain pass — sheer cliffs dropping into fog-filled abyss on either side, icy ledges dusted with snow, howling wind bending the last pine trees, granite sky above",
  swamp:       "A murky swamp at twilight — ancient black trees rising from still dark water, fireflies pulsing like dying stars, curtains of hanging moss, the sense of being watched from below the surface",
  library:     "A towering arcane library — shelves climbing impossibly high, leather-bound tomes glowing faintly at the edges, floating candles trailing smoke, dust motes drifting in shafts of amber light",
  village:     "A small medieval village — thatched-roof cottages around a muddy square, smoke curling from chimneys, a weathervane creaking in the wind, the smell of bread and livestock and coming rain",
};

const COMBAT_SUFFIX: Record<string, string> = {
  tavern:     "— tables overturned, shattered mugs flying, the hearth fire whipping wild from the chaos",
  dungeon:    "— torches strobing with the violence, weapons clashing on stone, smoke rising from a dozen wounds",
  forest:     "— branches snapping, leaves torn by impact, dark shapes moving fast through the ancient trees",
  cave:       "— crystals shattering into shards of colored light, the roar of battle echoing off every surface",
  ruins:      "— stone chips spraying from impacts, fighters using broken arches for cover, dust hanging in the air",
  castle:     "— tapestries torn from the walls, armor ringing off stone floors, torches guttering from concussive blows",
  street:     "— lanterns swinging wildly, citizens fleeing into alley shadows, blood dark on the wet cobblestones",
  temple:     "— altar fires whipping, sacred statues cracking from impacts, incense smoke turning acrid",
  wilderness: "— the ground churned by feet and hooves, fighters locked together in the tall grass, storm overhead",
  ship:       "— planks splitting underfoot, rigging cut and falling, salt spray and cannon smoke everywhere",
  arena:      "— combatants circling on blood-soaked sand, the ghost crowd pressing in, predatory and silent",
};

// Artistic style variants — rotated deterministically by scene type for variety
const STYLE_VARIANTS: Record<string, string> = {
  tavern:     "warm painterly illustration, rich earthy tones, intimate candlelit atmosphere",
  dungeon:    "dark cinematic concept art, deep shadows, high contrast torchlight, cold stone palette",
  forest:     "ethereal fantasy painting, blue-green atmosphere, mysterious depth, luminous mist",
  cave:       "bioluminescent fantasy art, deep purples and blues, crystalline glow, vast underground scale",
  ruins:      "epic ruins concept art, dramatic overcast sky, crumbling grandeur, melancholic beauty",
  castle:     "gothic architectural illustration, dramatic upward perspective, rich textures, cold stone light",
  street:     "noir fantasy illustration, rain-wet reflections, gaslit amber and shadow, sinister mood",
  shop:       "detailed character study environment, warm amber glow, cluttered curiosities, intimate scale",
  temple:     "sacred horror concept art, phosphorescent light, ancient symbolism, awe-inspiring scale",
  wilderness: "epic landscape painting, dramatic sky, vast scale, untamed and dangerous beauty",
  ship:       "dramatic maritime fantasy art, stormy sky, dynamic composition, salt-spray atmosphere",
  graveyard:  "gothic horror illustration, cold moonlight, long shadows, ethereal mist, dread atmosphere",
  prison:     "dark oppressive concept art, claustrophobic framing, torchlit decay, iron and stone palette",
  arena:      "classical epic painting, dramatic lighting, sweeping grandeur, ancient and brutal",
  port:       "painterly dusk seascape, warm orange sky, nautical detail, bustling atmosphere",
  desert:     "desolate epic landscape, blazing light, endless scale, stark beauty",
  mountain:   "dramatic alpine concept art, vertiginous scale, storm light, ice and stone",
  swamp:      "surreal dark fantasy painting, deep greens and blacks, eerie light, oppressive atmosphere",
  library:    "mystical interior painting, warm amber glow, impossible scale, floating magical light",
  village:    "pastoral fantasy illustration, warm evening light, cozy and ominous, lived-in detail",
};

function buildCacheKey(type: string, modifiers: string[], isCombat: boolean): string {
  const base = modifiers.length > 0
    ? `${type}_${modifiers.sort().slice(0, 2).join("_")}`
    : type;
  return isCombat ? `${base}_combat` : base;
}

function buildPrompt(type: string, modifiers: string[], description: string, isCombat: boolean): string {
  const base      = SCENE_BASE[type] ?? `a ${type} location in a dark fantasy world`;
  const combat    = isCombat ? ` ${COMBAT_SUFFIX[type] ?? "as fierce combat erupts"}` : "";
  const style     = STYLE_VARIANTS[type] ?? "dramatic dark fantasy concept art, cinematic atmosphere";
  const modStr    = modifiers.length > 0 ? ` Scene quality: ${modifiers.join(", ")}.` : "";
  const narrative = description.length > 20 ? ` ${description}` : "";
  return `${style}. ${base}${combat}.${modStr}${narrative} Ultra-wide cinematic landscape framing, no text, no UI, no watermarks, no modern elements. Highly detailed.`;
}

// How similar is the new scene to the current one? Used to suppress trivial re-draws.
function buildSceneSystem(currentScene: string): string {
  return `You are a scene classifier for a D&D fantasy RPG. Analyze the DM narrative and return JSON.

SCENE TYPES (pick exactly one):
tavern, dungeon, forest, cave, ruins, castle, street, shop, temple, wilderness, ship, graveyard, prison, arena, port, desert, mountain, swamp, library, village

CLASSIFICATION RULES:
- INDOOR: inside a structure → tavern, dungeon, castle, library, temple, shop, prison, cave
- OUTDOOR ruins: crumbling walls open to sky → ruins
- Wilderness ONLY if truly outdoors with no primary structure
- Default to dungeon for any underground or enclosed ancient setting

CHANGE DETECTION — current scene is: "${currentScene}"
shouldChange: true ONLY if the scene is meaningfully different — a new physical location, a dramatic environmental transformation (fire, flood, collapse), or a revelation that recontextualizes the entire space. Set to false for: continuing narration in the same place, adding monsters/NPCs, dialogue, combat starting in the same location, or minor shifts in mood. When in doubt, do NOT change.

Return ONLY valid JSON, no other text:
{"type":"<scene_type>","shouldChange":<bool>,"description":"<2-3 evocative sentences — specific lighting, focal objects, dramatic details unique to this moment>","modifiers":["<word>"]}

modifiers: 1-3 lowercase words for strong visual distinctions only (e.g. "burning","flooded","frozen","abandoned","crimson","collapsed"). Omit for generic scenes.`;
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

    // Step 1: Classify scene, extract descriptors, and judge whether change is warranted
    const detect = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 250,
      system:     buildSceneSystem(currentScene.replace(/_combat$/, "")),
      messages:   [{ role: "user", content: `${contextPrefix}${narrative.slice(0, 900)}` }],
    });

    const raw = detect.content[0].type === "text" ? detect.content[0].text.trim() : "";

    let sceneType   = currentScene.replace("_combat", "") || "wilderness";
    let modifiers:  string[] = [];
    let description = "";
    let shouldChange = false;

    try {
      const parsed = JSON.parse(raw);
      if (parsed.type && SCENE_BASE[parsed.type]) sceneType = parsed.type;
      if (Array.isArray(parsed.modifiers)) modifiers = parsed.modifiers.map((m: unknown) => String(m).toLowerCase().replace(/[^a-z]/g, "")).filter(Boolean).slice(0, 3);
      if (parsed.description) description = String(parsed.description).slice(0, 400);
      shouldChange = !!parsed.shouldChange;
    } catch {
      const word = raw.toLowerCase().match(/\b(tavern|dungeon|forest|cave|ruins|castle|street|shop|temple|wilderness|ship|graveyard|prison|arena|port|desert|mountain|swamp|library|village)\b/)?.[1];
      if (word) sceneType = word;
      // If parse fails we conservatively skip the change
    }

    const sceneName = buildCacheKey(sceneType, modifiers, isCombat);

    // No visual change warranted — return current scene info without touching image
    if (!shouldChange && sceneName === currentScene) {
      return Response.json({ sceneName, imageUrl: null, sceneType, modifiers, description });
    }

    // Scene changed but AI said it's not visually meaningful enough for a new image
    if (!shouldChange) {
      return Response.json({ sceneName, imageUrl: null, sceneType, modifiers, description });
    }

    // Step 2: Check cache — exact key match reuses saved image
    const { data: allCached } = await supabase.from("scenes").select("name, image_url");
    const cacheMap = new Map((allCached ?? []).map(s => [s.name as string, s.image_url as string]));

    const exactUrl = cacheMap.get(sceneName);
    if (exactUrl) return Response.json({ sceneName, imageUrl: exactUrl, sceneType, modifiers, description });

    // Step 3: Truly new scene — generate a bespoke image and save it for future reuse
    const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

    return Response.json({ sceneName, imageUrl: publicUrl, sceneType, modifiers, description });
  } catch (err) {
    console.error("[detect-scene]", err);
    return Response.json({ sceneName: currentScene ?? "wilderness", imageUrl: null });
  }
}
