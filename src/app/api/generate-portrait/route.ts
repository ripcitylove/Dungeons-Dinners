import OpenAI from "openai";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RACE_DESC: Record<string, string> = {
  Human:     "human with natural, expressive features",
  Elf:       "elf with elegantly pointed ears and ethereal, otherworldly beauty",
  Dwarf:     "dwarf — stocky and broad-shouldered with a braided beard and weathered face",
  Halfling:  "halfling — small, nimble, with large curious eyes and curly hair",
  Dragonborn:"dragonborn with reptilian scales, a draconic face, and an imposing presence",
  Tiefling:  "tiefling with small curved horns, solid-colored eyes, and a long tail",
};

const CLASS_DESC: Record<string, string> = {
  Fighter:   "clad in scarred battle armor, bearing sword and shield, determined expression",
  Wizard:    "in flowing robes covered in arcane runes, holding an ancient gnarled staff",
  Rogue:     "in dark fitted leather armor, twin daggers at the hip, a sharp intelligent gaze",
  Cleric:    "in holy vestments bearing a divine symbol, soft radiant light emanating from hands",
  Paladin:   "in gleaming full plate armor, radiant divine light casting long shadows around them",
  Ranger:    "in worn forest-green leathers, longbow across back, alert watchful expression",
  Bard:      "in richly colored traveling clothes, lute slung over back, a charming confident smile",
  Warlock:   "in dark robes adorned with eldritch symbols, eyes glowing faintly with otherworldly power",
  Barbarian: "bare-chested or lightly armored with tribal tattoos and a massive axe at the ready",
  Druid:     "in robes woven from leaves and bark, holding a gnarled wooden staff, serene expression",
  Monk:      "in simple flowing robes, hands raised in a precise martial arts stance",
  Sorcerer:  "in dramatic robes, crackling magical energy coiling around outstretched fingertips",
};

export async function POST(req: NextRequest) {
  try {
    // Accept the user's session token so storage upload respects auth RLS
    const authHeader = req.headers.get("authorization");
    const { race, cls, sex, charId } = (await req.json()) as {
      race: string; cls: string; sex: string; charId: string;
    };

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const genderWord = sex === "female" ? "woman" : sex === "non-binary" ? "androgynous person" : "man";
    const raceDesc   = RACE_DESC[race]  ?? race.toLowerCase();
    const classDesc  = CLASS_DESC[cls]  ?? cls.toLowerCase();

    const prompt = `Fantasy RPG character portrait. A ${genderWord} who is a ${raceDesc}, ${classDesc}. Dark fantasy painterly style, dramatic side lighting, highly detailed face, head-and-shoulders composition. Cinematic epic fantasy art. No text, no watermarks, no logos.`;

    const imgResponse = await openai.images.generate({
      model:   "dall-e-3",
      prompt,
      size:    "1024x1024",
      quality: "standard",
      n:       1,
    });

    const dalleUrl = imgResponse.data?.[0]?.url;
    if (!dalleUrl) throw new Error("No image URL returned");

    // Fetch the image binary
    const imgFetch = await fetch(dalleUrl);
    if (!imgFetch.ok) throw new Error("Failed to download generated image");
    const imgBuffer = await imgFetch.arrayBuffer();

    // Upload to Supabase Storage using the caller's auth token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
    );

    const path = `${charId}.png`;
    const { error: uploadError } = await supabase.storage
      .from("portraits")
      .upload(path, imgBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("[generate-portrait] storage upload:", uploadError.message);
      // Fall back: return the (temporary) DALL-E URL so the client can still display it
      return Response.json({ url: dalleUrl, stored: false });
    }

    const { data: { publicUrl } } = supabase.storage.from("portraits").getPublicUrl(path);

    // Persist portrait URL on the character row
    await supabase.from("characters").update({ portrait_url: publicUrl }).eq("id", charId);

    return Response.json({ url: publicUrl, stored: true });
  } catch (err) {
    console.error("[generate-portrait]", err);
    return Response.json({ error: "Portrait generation failed" }, { status: 500 });
  }
}
