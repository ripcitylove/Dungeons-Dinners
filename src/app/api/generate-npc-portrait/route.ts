import OpenAI from "openai";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// NPC portraits — mirrors the enemy portrait route, but keyed by NPC NAME (a named
// individual should always look the same) and prompted as a friendly/neutral story
// character rather than a menacing enemy. Cached in storage (npcs/<slug>.png) so a
// recurring NPC reuses their image instead of re-calling the model.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

function buildNpcPrompt(name: string, role: string): string {
  const who = role?.trim()
    ? role.trim().slice(0, 240)
    : "a fantasy townsperson with an ordinary, lived-in face";
  return `Fantasy RPG character portrait of a non-player character named ${name}: ${who}. ` +
    `Warm painterly fantasy art, head-and-shoulders composition, expressive detailed face, ` +
    `soft cinematic lighting, epic fantasy aesthetic. A believable individual, not a monster. ` +
    `No text, no watermarks, no logos, no plain background.`;
}

export async function POST(req: NextRequest) {
  try {
    const { name, role = "" } = (await req.json()) as { name: string; role?: string };
    if (!name?.trim()) return Response.json({ portraitUrl: null });

    const slug = slugify(name);
    if (!slug) return Response.json({ portraitUrl: null });

    // Cache check — reuse this NPC's existing portrait if we've made one.
    const { data: files } = await supabase.storage.from("portraits").list("npcs");
    if (files?.some(f => f.name === `${slug}.png`)) {
      const { data: { publicUrl } } = supabase.storage.from("portraits").getPublicUrl(`npcs/${slug}.png`);
      return Response.json({ portraitUrl: publicUrl });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const imgRes = await openai.images.generate({
      model:   "gpt-image-1",
      prompt:  buildNpcPrompt(name, role),
      size:    "1024x1024",
      quality: "medium",
      n:       1,
    });

    const b64 = imgRes.data?.[0]?.b64_json;
    if (!b64) return Response.json({ portraitUrl: null });

    const { error } = await supabase.storage
      .from("portraits")
      .upload(`npcs/${slug}.png`, Buffer.from(b64, "base64"), { contentType: "image/png", upsert: true });
    if (error) {
      console.error("[generate-npc-portrait] upload:", error.message);
      return Response.json({ portraitUrl: null });
    }

    const { data: { publicUrl } } = supabase.storage.from("portraits").getPublicUrl(`npcs/${slug}.png`);
    return Response.json({ portraitUrl: publicUrl });
  } catch (err) {
    console.error("[generate-npc-portrait]", err);
    return Response.json({ portraitUrl: null });
  }
}
