import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { NextRequest } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED_VOICES = ["chronicler", "gravedigger", "bard", "oracle", "shade", "sage"] as const;
type AllowedVoice = typeof ALLOWED_VOICES[number];

const VOICE_CONFIG: Record<AllowedVoice, {
  voiceId:    string;
  stability:  number;
  similarity: number;
  style:      number;
}> = {
  chronicler: {
    voiceId:    "JBFqnCBsd6RMkjVDRZzb",
    stability:  0.75,
    similarity: 0.75,
    style:      0.30,
  },
  gravedigger: {
    voiceId:    "N2lVS1w4EtoT3dr4eOWO",
    stability:  0.55,
    similarity: 0.75,
    style:      0.55,
  },
  bard: {
    voiceId:    "pFZP5JQG7iQjIQuC4Bku",
    stability:  0.30,
    similarity: 0.75,
    style:      0.70,
  },
  oracle: {
    voiceId:    "Xb7hH8MSUJpSbSDYk0k2",
    stability:  0.82,
    similarity: 0.80,
    style:      0.12,
  },
  shade: {
    voiceId:    "SOYHLrjzK2X1ezoPC6cr",
    stability:  0.50,
    similarity: 0.75,
    style:      0.42,
  },
  sage: {
    voiceId:    "pqHfZKP75CvOlQylNhV4",
    stability:  0.82,
    similarity: 0.80,
    style:      0.12,
  },
};

const DEFAULT_VOICE: AllowedVoice = "chronicler";
const MODEL_ID = "eleven_turbo_v2_5";
const BUCKET = "scenes";

// Generate TTS via ElevenLabs, upload to Supabase Storage, return the public
// CDN URL. Xbox Edge (and other constrained browsers) can play static CDN URLs
// but refuse audio served directly from serverless API responses.
function normalizeForTTS(raw: string): string {
  return raw
    .replace(/=/g, " equals ")
    // Em-dashes and en-dashes → natural comma pause
    .replace(/\s*[—–]\s*/g, ", ")
    // Hyphen used as a separator between words/phrases ("HP - Max HP") → comma pause
    .replace(/\s+-\s+/g, ", ")
    // Leading list-bullet hyphens at start of line → nothing
    .replace(/^-\s+/gm, "");
}

async function synthesize(text: string, voice: string): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new Response("ElevenLabs key not configured", { status: 500 });
  if (!text?.trim()) return new Response("No text", { status: 400 });

  text = normalizeForTTS(text);

  const safeVoice: AllowedVoice = ALLOWED_VOICES.includes(voice as AllowedVoice)
    ? (voice as AllowedVoice)
    : DEFAULT_VOICE;
  const { voiceId, stability, similarity, style } = VOICE_CONFIG[safeVoice];

  // Deterministic storage key — same text+voice always maps to the same file
  const hash = crypto
    .createHash("sha256")
    .update(`${safeVoice}:${text.slice(0, 5000)}`)
    .digest("hex")
    .slice(0, 24);
  const storageFile = `narration/${hash}.mp3`;

  // Cache hit: redirect immediately without calling ElevenLabs
  const { data: listed } = await supabase.storage.from(BUCKET).list("narration", { search: hash.slice(0, 8) });
  const cached = listed?.find(f => f.name === `${hash}.mp3`);
  if (cached) {
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageFile);
    return Response.json({ audioUrl: publicUrl });
  }

  // Generate audio
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method:  "POST",
    headers: {
      "xi-api-key":   apiKey,
      "Content-Type": "application/json",
      "Accept":       "audio/mpeg",
    },
    body: JSON.stringify({
      text:     text.slice(0, 5000),
      model_id: MODEL_ID,
      voice_settings: {
        stability,
        similarity_boost:  similarity,
        style,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    let parsed: { detail?: { code?: string } } = {};
    try { parsed = JSON.parse(msg); } catch { /* ignore */ }
    if (res.status === 401 && parsed.detail?.code === "quota_exceeded") {
      console.warn("[api/narrate] ElevenLabs quota exhausted");
      return new Response("quota_exceeded", { status: 402 });
    }
    console.error("[api/narrate] ElevenLabs:", res.status, msg);
    return new Response("TTS unavailable", { status: 500 });
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());

  // Upload to Supabase Storage so the browser gets a static CDN URL
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageFile, audioBuffer, { contentType: "audio/mpeg", upsert: true });

  if (error) {
    console.error("[api/narrate] Supabase upload:", error.message);
    return new Response("Upload failed", { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageFile);
  // Return the CDN URL as JSON so the client sets it directly on the <audio>
  // element — the element must never see the slow API URL (Xbox times out).
  return Response.json({ audioUrl: publicUrl });
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = (await req.json()) as { text: string; voice?: string };
    return await synthesize(text, voice ?? DEFAULT_VOICE);
  } catch (err) {
    console.error("[api/narrate]", err);
    return Response.json({ error: "TTS unavailable" }, { status: 500 });
  }
}
