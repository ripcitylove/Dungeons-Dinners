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

    // Generate the portrait — retry transient failures (429 rate-limit, 5xx,
    // timeouts) the same way character portraits do, so a momentary blip no longer
    // leaves the NPC with no image (it previously failed silently to null).
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let b64: string | undefined;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const imgRes = await openai.images.generate({
          model:   "gpt-image-1",
          prompt:  buildNpcPrompt(name, role),
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
      console.error("[generate-npc-portrait] generation failed:", lastErr instanceof Error ? lastErr.message : lastErr);
      return Response.json({ portraitUrl: null });
    }

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
