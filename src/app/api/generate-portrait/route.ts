import OpenAI from "openai";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// Physical trait pools per race — randomised per generation so same race+class never looks identical
const RACE_TRAITS: Record<string, { base: string; skin: string[]; hair: string[]; eyes: string[]; age: string[] }> = {
  Human: {
    base: "human with natural, expressive features",
    skin: ["fair", "olive", "warm brown", "deep ebony", "tawny", "ruddy"],
    hair: ["auburn", "jet black", "sandy blonde", "chestnut brown", "salt-and-pepper", "fiery red", "dark brown"],
    eyes: ["hazel", "deep brown", "pale blue", "storm grey", "warm amber", "green"],
    age: ["young", "middle-aged", "weathered and experienced", "grizzled veteran"],
  },
  Elf: {
    base: "elf with elegantly pointed ears",
    skin: ["pale porcelain", "warm golden", "sun-kissed bronze", "cool grey-toned", "olive"],
    hair: ["silver-white", "autumn copper", "raven black", "moonlight blonde", "deep chestnut", "platinum", "pale gold"],
    eyes: ["violet", "silver", "piercing emerald", "storm grey", "amber gold", "ice blue", "deep indigo"],
    age: ["youthful and sharp-featured", "ageless and serene", "ancient with timeless eyes", "young with an intense gaze"],
  },
  Dwarf: {
    base: "dwarf — stocky and broad-shouldered with a weathered face",
    skin: ["ruddy and sun-beaten", "pale and rock-dusted", "warm tan", "deep brown", "ashen"],
    hair: ["fiery red braid", "iron-grey braid", "dark brown braid", "black braid", "blonde braid streaked with grey"],
    eyes: ["deep-set brown", "sharp grey", "steely blue", "hazel", "amber"],
    age: ["stout and youthful", "middle-aged with laugh lines", "old and battle-scarred", "ancient with a magnificent beard"],
  },
  Halfling: {
    base: "halfling — small and nimble with large curious eyes",
    skin: ["rosy and fair", "warm tan", "freckled pale", "honey brown", "golden"],
    hair: ["wild curly brown", "tight copper curls", "bouncy blonde curls", "dark wavy curls", "strawberry-blonde curls"],
    eyes: ["bright hazel", "warm brown", "sky blue", "green", "amber"],
    age: ["youthful and mischievous", "cheerful and middle-aged", "sprightly elder with twinkling eyes"],
  },
  Dragonborn: {
    base: "dragonborn with reptilian scales and a draconic face",
    skin: ["crimson scales", "cobalt blue scales", "emerald green scales", "obsidian black scales", "burnished gold scales", "silver-white scales", "deep purple scales"],
    hair: ["no hair — small horns instead", "ridge of dark spines", "crest of bony protrusions"],
    eyes: ["slit-pupiled amber", "smoldering red", "cold silver", "vibrant gold", "pale blue"],
    age: ["young with fearsome intensity", "mature and imposing", "elder with ancient gravitas"],
  },
  Tiefling: {
    base: "tiefling with small curved horns and solid-colored eyes",
    skin: ["deep crimson", "pale lavender", "dusky mauve", "ashen grey", "dark cobalt blue"],
    hair: ["jet black with violet sheen", "white with a silver shimmer", "dark red", "deep purple", "coal black"],
    eyes: ["solid gold", "solid silver", "glowing red", "flat black", "solid violet"],
    age: ["young and sharp", "confident and mature", "ancient-looking with knowing eyes"],
  },
  Gnome: {
    base: "gnome — tiny and quick-witted with large bright eyes",
    skin: ["rosy fair", "warm tan", "pale with a bluish tinge", "earthy brown", "creamy"],
    hair: ["wild white tufts", "shock of bright orange", "messy grey", "unruly dark curls", "frizzy silver"],
    eyes: ["enormous bright blue", "wide vivid green", "large warm brown", "sparkling hazel", "big amber"],
    age: ["young and energetic", "cheerful middle-aged", "ancient but spry"],
  },
  "Half-Elf": {
    base: "half-elf with subtly pointed ears blending human warmth with elven grace",
    skin: ["fair with a warm glow", "olive", "sun-bronzed", "warm brown", "pale"],
    hair: ["wavy chestnut", "dark brown with silver highlights", "sandy", "raven black", "auburn"],
    eyes: ["one blue one brown", "striking violet", "warm hazel", "sharp green", "pale grey"],
    age: ["youthful and bright", "mature and confident", "worldly and experienced"],
  },
  "Half-Orc": {
    base: "half-orc with prominent tusks and a powerful broad-shouldered build",
    skin: ["deep olive-green", "grey-green", "muted brown-green", "warm tan with a green cast", "dusky grey"],
    hair: ["coarse black", "dark brown", "shaved close", "wild black dreadlocks", "thick dark braids"],
    eyes: ["fierce red", "sharp amber", "cold grey", "deep brown", "pale yellow"],
    age: ["young and fierce", "prime and battle-hardened", "scarred veteran"],
  },
};

// Multiple visual descriptions per class — one is picked at random each generation
const CLASS_VARIANTS: Record<string, string[]> = {
  Fighter: [
    "clad in scarred battle armor, bearing sword and shield, determined expression",
    "in dented plate mail, a two-handed greatsword resting on their shoulder, steely gaze",
    "wearing chain hauberk with a war-worn tabard, hand resting on a sword hilt, calm before battle",
    "in battered half-plate, shield arm raised, a deep scar across one cheek",
  ],
  Wizard: [
    "in flowing robes covered in arcane runes, holding an ancient gnarled staff",
    "wearing a deep-blue robe embroidered with star charts, a spell tome clutched to their chest",
    "in midnight robes, magical sigils glowing on their hands, eyes lit by inner arcane light",
    "in scholarly robes with ink-stained fingers, spectacles perched on their nose, a floating orb of light nearby",
  ],
  Rogue: [
    "in dark fitted leather armor, twin daggers at the hip, a sharp intelligent gaze",
    "wearing a hooded cloak over dark leathers, leaning against shadows, one dagger in hand",
    "in close-cut black armor, a coil of rope on one shoulder, a confident smirk",
    "in patched traveling leathers, a crossbow on their back, eyes constantly scanning",
  ],
  Cleric: [
    "in holy vestments bearing a divine symbol, soft radiant light emanating from hands",
    "wearing ceremonial armor etched with holy scripture, a mace at their belt, serene expression",
    "draped in white and gold robes, a glowing holy symbol raised aloft, divine light behind them",
    "in worn travel vestments, a reliquary at their neck, eyes full of quiet conviction",
  ],
  Paladin: [
    "in gleaming full plate armor, radiant divine light casting long shadows around them",
    "wearing ornate plate blazoned with a holy crest, longsword raised, divine aura flickering",
    "in heavy armor with a flowing tabard, a war hammer in one hand, shield bearing a sacred symbol",
    "in silver-bright armor, kneeling in prayer, a nimbus of golden light encircling their head",
  ],
  Ranger: [
    "in worn forest-green leathers, longbow across back, alert watchful expression",
    "wearing a cloak of mottled brown and green, twin short swords at the hip, poised and ready",
    "in travel-worn leather, a hawk perched on one arm, eyes keen as a predator's",
    "draped in a weathered cloak, quiver over shoulder, reading tracks on the ground with intense focus",
  ],
  Bard: [
    "in richly colored traveling clothes, lute slung over back, a charming confident smile",
    "wearing a flamboyant coat with silver buttons, holding a pan flute, mid-performance",
    "in embroidered doublet, a harp tucked under one arm, a theatrical flourish in their pose",
    "in motley traveling silks, a theatrical mask pushed up on their forehead, eyes full of mischief",
  ],
  Warlock: [
    "in dark robes adorned with eldritch symbols, eyes glowing faintly with otherworldly power",
    "wearing void-black robes, a pact blade at their side, eldritch flames wreathing their hands",
    "draped in tattered robes covered in runes, an eye-covered tome chained to their belt, unsettling stare",
    "in deep violet robes, shadows clinging unnaturally to their form, one hand crackling with dark energy",
  ],
  Barbarian: [
    "bare-chested with tribal tattoos and a massive axe at the ready, wild ferocious look",
    "in furs and rough hides, a greatclub over one shoulder, primal intensity in their eyes",
    "wearing minimal armor, muscles coiled, a battle-rage scar running across their chest",
    "in berserker war paint, dual axes crossed on their back, a fearless grin",
  ],
  Druid: [
    "in robes woven from leaves and bark, holding a gnarled wooden staff, serene expression",
    "wearing a cloak of feathers and moss, hands glowing with earthy green nature magic",
    "draped in animal hides with a crown of antlers, wild eyes full of ancient power",
    "wrapped in vines and wildflowers, a raven perched on one shoulder, calm and wise",
  ],
  Monk: [
    "in simple flowing robes, hands raised in a precise martial arts stance",
    "wearing wrapped linen robes, barefoot, mid-kata with a blur of motion",
    "in a plain gi with a cloth belt, seated in deep meditation, inner peace on their face",
    "in lightweight robes, one palm extended forward, ki energy shimmering around their body",
  ],
  Sorcerer: [
    "in dramatic robes, crackling magical energy coiling around outstretched fingertips",
    "wearing storm-grey robes, lightning coursing between their hands, wild power barely contained",
    "in flowing silk robes, fire dancing in their palms, eyes blazing with untamed magic",
    "draped in iridescent robes, arcane energy erupting from their eyes, hair floating on a magical wind",
  ],
};

// Use service role key server-side to bypass storage RLS.
// Falls back to user-auth approach if service key is not configured.
function makeSupabase(authHeader: string | null) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
  );
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const { race, cls, sex, charId, title, alignment, background } = (await req.json()) as {
      race: string; cls: string; sex: string; charId: string;
      title?: string | null; alignment?: string | null; background?: string | null;
    };

    if (!charId?.trim()) return Response.json({ error: "Missing charId" }, { status: 400 });

    const supabaseCheck = makeSupabase(authHeader);
    const path = `${charId}.png`;

    // Return cached portrait if it already exists
    const { data: existing } = await supabaseCheck.storage.from("portraits").list("", { search: charId });
    const cached = existing?.find(f => f.name === path);
    if (cached) {
      const { data: { publicUrl } } = supabaseCheck.storage.from("portraits").getPublicUrl(path);
      // Ensure the DB row is also updated (in case a prior run uploaded but didn't update)
      await supabaseCheck.from("characters").update({ portrait_url: publicUrl }).eq("id", charId).is("portrait_url", null);
      return Response.json({ url: publicUrl, stored: true, cached: true });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const genderWord = sex === "female" ? "woman" : sex === "non-binary" ? "androgynous person" : "man";

    // Pick randomised physical traits so same race+class never looks identical
    const rt = RACE_TRAITS[race];
    const raceBase  = rt?.base ?? race.toLowerCase();
    const physParts = rt
      ? `${pick(rt.age)}, ${pick(rt.skin)} skin, ${pick(rt.hair)} hair, ${pick(rt.eyes)} eyes`
      : "";

    const classVariants = CLASS_VARIANTS[cls] ?? [cls.toLowerCase()];
    const classDesc = pick(classVariants);

    const titlePart = title ? `, known as "${title}"` : "";
    const alignPart = alignment ? ` Alignment: ${alignment}.` : "";
    const bgPart    = background ? ` Background: ${background.slice(0, 120)}.` : "";
    const physPart  = physParts ? ` Physical traits: ${physParts}.` : "";

    const prompt = `Fantasy RPG character portrait. A ${genderWord} who is a ${raceBase}${titlePart}.${physPart} Class appearance: ${classDesc}.${alignPart}${bgPart} Dark fantasy painterly style, dramatic side lighting, highly detailed face, head-and-shoulders composition. Cinematic epic fantasy art. No text, no watermarks, no logos.`;

    const imgResponse = await openai.images.generate({
      model:   "gpt-image-1",
      prompt,
      size:    "1024x1024",
      quality: "medium",
      n:       1,
    });

    const b64 = imgResponse.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned from OpenAI");
    const imgBuffer = Buffer.from(b64, "base64");

    const supabase = makeSupabase(authHeader);

    const { error: uploadError } = await supabase.storage
      .from("portraits")
      .upload(path, imgBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("[generate-portrait] storage upload failed:", uploadError.message);
      return Response.json({ error: "Upload failed", detail: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from("portraits").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("characters")
      .update({ portrait_url: publicUrl })
      .eq("id", charId);

    if (updateError) {
      console.error("[generate-portrait] character update failed:", updateError.message);
      // Still return the URL so the client can display it even if DB write failed
      return Response.json({ url: publicUrl, stored: false });
    }

    return Response.json({ url: publicUrl, stored: true });
  } catch (err) {
    console.error("[generate-portrait]", err);
    return Response.json({ error: "Portrait generation failed" }, { status: 500 });
  }
}
