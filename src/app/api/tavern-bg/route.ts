import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROMPT =
  "Fantasy RPG environment art. A richly detailed medieval tavern interior — rough-hewn stone walls, thick wooden beams, a massive roaring stone fireplace casting warm amber light, long oak tables crowded with weathered adventurers, steaming tankards, a bard playing lute in the corner, lanterns swinging from the rafters, smoke curling near the ceiling. Wide cinematic view, dramatic fantasy oil-painting style, warm cozy atmosphere with dark undertones, no text, no UI elements.";

export async function GET() {
  try {
    // Return cached image if already generated
    const { data: cached } = await supabase
      .from("scenes")
      .select("image_url")
      .eq("name", "tavern-dashboard")
      .single();

    if (cached?.image_url) {
      return Response.json({ imageUrl: cached.image_url });
    }

    // Also try the plain "tavern" scene (generated during gameplay)
    const { data: tavernCached } = await supabase
      .from("scenes")
      .select("image_url")
      .eq("name", "tavern")
      .single();

    if (tavernCached?.image_url) {
      return Response.json({ imageUrl: tavernCached.image_url });
    }

    // Generate with gpt-image-1
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const img = await openai.images.generate({
      model:   "gpt-image-1",
      prompt:  PROMPT,
      size:    "1536x1024",
      quality: "medium",
      n:       1,
    });

    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return Response.json({ imageUrl: null });

    // Store in Supabase Storage
    const buf = Buffer.from(b64, "base64");
    const { error: uploadErr } = await supabase.storage
      .from("scenes")
      .upload("tavern-dashboard.png", buf, { contentType: "image/png", upsert: true });

    if (uploadErr) {
      console.warn("[tavern-bg] upload failed:", uploadErr.message);
      return Response.json({ imageUrl: null });
    }

    const { data: urlData } = supabase.storage.from("scenes").getPublicUrl("tavern-dashboard.png");
    const permanentUrl = urlData.publicUrl;

    await supabase.from("scenes").upsert({ name: "tavern-dashboard", image_url: permanentUrl }, { onConflict: "name" });

    return Response.json({ imageUrl: permanentUrl });
  } catch (err) {
    console.error("[tavern-bg]", err);
    return Response.json({ imageUrl: null });
  }
}
