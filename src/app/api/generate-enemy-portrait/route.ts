import OpenAI from "openai";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ENEMY_DESCS: Record<string, string> = {
  goblin:       "a small cunning goblin — green warty skin, beady red eyes, ragged leather armor, wielding a nicked scimitar",
  hobgoblin:    "a disciplined hobgoblin soldier — dark orange skin, black iron military armor, cold calculating eyes, longsword at the ready",
  bugbear:      "a brutish bugbear — large hairy goblinoid with a scarred muzzle, crude patchwork armor, dragging a heavy morningstar",
  orc:          "a powerful orc warrior — grey-green muscular frame, bone-decorated tribal armor, tusks bared in a snarl, hefting a brutal greataxe",
  troll:        "a towering grey-green troll — hunched and massive, long clawed arms, warty mottled hide, jagged teeth in a wide maw",
  ogre:         "a brutish ogre — enormous and dim-witted, crude animal-hide wrappings, massive nail-studded club, piggy murderous eyes",
  skeleton:     "an animated skeleton warrior — bleached white bones, hollow eye sockets glowing with pale spectral fire, rusted armor fragments",
  zombie:       "a shambling zombie — rotting putrid flesh, milky blank eyes, torn beggar's clothes, broken blackened fingernails outstretched",
  ghoul:        "a feral ghoul — gaunt slavering undead, paralytic claws extended, sunken face with jagged teeth, hollow ravenous eyes",
  wight:        "a wight — a fallen warrior preserved in undeath, glowing red eyes in a gaunt withered face, tattered ruined armor, cold hatred radiating outward",
  wraith:       "a wraith — a spectral form barely visible, dark robes dissolving into shadow, two malevolent pinpoints of ghostly light where eyes should be",
  spectre:      "a spectre — a translucent ghostly figure rippling with cold blue-white energy, face twisted in anguish, ethereal hands outstretched",
  vampire:      "a vampire — aristocratic pale face framed by dark hair, crimson predatory eyes, elegant dark coat, fangs barely visible in a cold smile",
  werewolf:     "a werewolf mid-transformation — half-man half-wolf, bursting through tattered clothes, yellow eyes blazing, muzzle stretched in a savage howl",
  dragon:       "a fearsome dragon — massive reptilian head with armored scales, blazing predatory eyes, smoke curling from its nostrils",
  red_dragon:   "a red dragon — crimson scales gleaming like hot coals, molten orange eyes filled with ancient fury, fire simmering behind its teeth",
  black_dragon: "a black dragon — obsidian scales dripping acid, pale white eyes cold with malice, frilled neck horns swept back dramatically",
  green_dragon: "a green dragon — emerald scales, cruel slitted pupils, perpetual sneer of contemptuous intelligence",
  blue_dragon:  "a blue dragon — electric blue scales crackling faintly with static, eyes like lightning, regal and imposing",
  white_dragon: "a white dragon — icy pale scales coated in frost, pale blue predatory eyes, breath crystallizing in the frigid air around it",
  wolf:         "a dire wolf — massive silver-grey beast with burning amber eyes, hackles raised, lips curled to reveal formidable fangs",
  bear:         "a cave bear — enormous brown bear rearing up on hind legs, roaring with teeth bared, powerful claws outstretched",
  spider:       "a giant spider — eight glistening eyes above massive chelicerae, hairy articulated legs, dripping venom-laced fangs",
  bandit:       "a scarred human bandit — stitched leather armor, crossbow raised, eyes cold and calculating beneath a wide hat brim",
  cultist:      "a robed cultist — dark ceremonial robes covered in arcane sigils, bone-carved mask, sacrificial dagger raised, eyes wide with fanatical zeal",
  assassin:     "a hooded assassin — dark fitted leathers, face mostly hidden beneath a black hood, poison-tipped blades drawn, utterly still",
  mage:         "a dark mage — robes billowing with arcane energy, hands ablaze with crackling fire, eyes glowing white with channeled power",
  wizard:       "a corrupt wizard — ancient robes covered in runes, staff crackling with dark magic, eyes gleaming with dangerous knowledge",
  lich:         "an ancient lich — skeletal face in rotting archmage robes, phylactery on a chain, eye sockets blazing with cold necromantic fire",
  beholder:     "a terrifying beholder — massive floating eyeball surrounded by writhing eye stalks each with a different deadly gaze, central eye glaring",
  gnoll:        "a gnoll — hyena-headed humanoid with spotted fur, wearing bone trophies, wielding a spear and slavering with predatory hunger",
  drow:         "a drow dark elf — white hair, obsidian skin, cold violet eyes, spider-silk black armor, hand crossbows raised",
  golem:        "a stone golem — hulking animated construct of grey stone etched with glowing runes, blank featureless carved face, massive stone fists",
  elemental:    "an elemental — a humanoid form composed of swirling elemental energy, eyes like blazing embers within the churning mass",
  demon:        "a demon — a terrifying fiendish creature with bat wings, horns, and glowing red eyes filled with malevolent hatred",
  devil:        "a devil — a calculating fiend with crimson skin, curling horns, and cold cruel eyes radiating infernal authority",
  harpy:        "a harpy — a hideous winged woman with taloned feet, matted feathers, screaming mouth wide open, mad predatory eyes",
  minotaur:     "a minotaur — a massive bull-headed humanoid in a labyrinth-worn iron collar, axes in each hand, rage burning in bovine eyes",
  manticore:    "a manticore — lion body with a human face twisted in predatory hunger, spike-studded tail raised to throw, leathery wings spread",
  basilisk:     "a basilisk — a massive eight-legged lizard with a ridge of scales down its spine, eyes gleaming with a petrifying glow",
  banshee:      "a banshee — a wailing ghostly woman, transparent robes flying, face contorted in eternal anguish, mouth open in a silent shriek",
};

function buildEnemyPrompt(enemyType: string, cr: number): string {
  const slug = enemyType.toLowerCase().replace(/\s+/g, "_");
  let desc = "";
  for (const [key, d] of Object.entries(ENEMY_DESCS)) {
    if (slug.includes(key) || key.includes(slug)) { desc = d; break; }
  }
  if (!desc) desc = `a fearsome ${enemyType} — a dangerous D&D 5e creature with an imposing presence`;
  const tier = cr >= 15 ? "legendary, terrifying" : cr >= 10 ? "immensely powerful" : cr >= 5 ? "powerful and imposing" : cr >= 2 ? "menacing and dangerous" : "scrappy but deadly";
  return `Fantasy RPG enemy portrait. ${desc}. ${tier} appearance. Dark painterly fantasy art style, dramatic front-facing head-and-shoulders composition, intense cinematic lighting, highly detailed face, epic dark fantasy aesthetic. No text, no watermarks, no logos, no backgrounds.`;
}

export async function POST(req: NextRequest) {
  try {
    const { enemyType, cr = 1 } = (await req.json()) as { enemyType: string; cr?: number };
    if (!enemyType?.trim()) return Response.json({ portraitUrl: null });

    const slug = enemyType.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

    // Check storage cache first. Pass { search: slug } so the lookup is server-side
    // filtered — without it, list() returns only the first 100 files and a cache
    // check would MISS an existing portrait once the folder grows past 100, then
    // regenerate a brand-new face (upsert) over the cached one. The character
    // portrait route uses this same guard.
    const { data: files } = await supabase.storage.from("portraits").list("enemies", { search: slug });
    const cached = files?.find(f => f.name === `${slug}.png`);
    if (cached) {
      const { data: { publicUrl } } = supabase.storage.from("portraits").getPublicUrl(`enemies/${slug}.png`);
      return Response.json({ portraitUrl: publicUrl });
    }

    // Generate the portrait — retry transient failures (429 rate-limit, 5xx,
    // timeouts) the same way character portraits do, so a momentary blip no longer
    // leaves the enemy with no image (it previously failed silently to null).
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let b64: string | undefined;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const imgRes = await openai.images.generate({
          model:   "gpt-image-1",
          prompt:  buildEnemyPrompt(enemyType, cr),
          size:    "1024x1024",
          quality: "medium",
          n:       1,
        });
        b64 = imgRes.data?.[0]?.b64_json;
        if (b64) break;
        lastErr = new Error("No image data returned from OpenAI");
      } catch (e: unknown) {
        lastErr = e;
        const err = e as { status?: number; message?: string };
        const status = err?.status ?? 0;
        const msg = err?.message ?? "";
        const transient = status === 429 || (status >= 500 && status < 600) || /rate limit|timeout|timed out|ECONNRESET|fetch failed|network/i.test(msg);
        if (!transient || attempt === 4) break;
        const hint = /try again in ([\d.]+)s/i.exec(msg);
        const waitMs = Math.min(20000, Math.ceil(((hint ? parseFloat(hint[1]) : 2 * attempt) + 1) * 1000));
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
    if (!b64) {
      console.error("[generate-enemy-portrait] generation failed:", lastErr instanceof Error ? lastErr.message : lastErr);
      return Response.json({ portraitUrl: null });
    }

    const { error } = await supabase.storage
      .from("portraits")
      .upload(`enemies/${slug}.png`, Buffer.from(b64, "base64"), { contentType: "image/png", upsert: true });

    if (error) {
      console.error("[generate-enemy-portrait] upload:", error.message);
      return Response.json({ portraitUrl: null });
    }

    const { data: { publicUrl } } = supabase.storage.from("portraits").getPublicUrl(`enemies/${slug}.png`);
    return Response.json({ portraitUrl: publicUrl });
  } catch (err) {
    console.error("[generate-enemy-portrait]", err);
    return Response.json({ portraitUrl: null });
  }
}
