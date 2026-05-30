import { NextRequest } from "next/server";

const ALLOWED_VOICES = ["chronicler", "gravedigger", "bard", "oracle", "shade", "sage"] as const;
type AllowedVoice = typeof ALLOWED_VOICES[number];

const VOICE_CONFIG: Record<AllowedVoice, {
  voiceId:    string;
  stability:  number;
  similarity: number;
  style:      number;
}> = {
  chronicler: {
    voiceId:    "JBFqnCBsd6RMkjVDRZzb", // George ♂ — Warm, Captivating Storyteller (British)
    stability:  0.75,
    similarity: 0.75,
    style:      0.30,
  },
  gravedigger: {
    voiceId:    "N2lVS1w4EtoT3dr4eOWO", // Callum ♂ — Husky, Dark (American)
    stability:  0.55,
    similarity: 0.75,
    style:      0.55,
  },
  bard: {
    voiceId:    "pFZP5JQG7iQjIQuC4Bku", // Lily ♀ — Velvety Actress (British)
    stability:  0.30,
    similarity: 0.75,
    style:      0.70,
  },
  oracle: {
    voiceId:    "Xb7hH8MSUJpSbSDYk0k2", // Alice ♀ — Clear, Engaging (British)
    stability:  0.82,
    similarity: 0.80,
    style:      0.12,
  },
  shade: {
    voiceId:    "SOYHLrjzK2X1ezoPC6cr", // Harry ♂ — Fierce Warrior (American)
    stability:  0.50,
    similarity: 0.75,
    style:      0.42,
  },
  sage: {
    voiceId:    "pqHfZKP75CvOlQylNhV4", // Bill ♂ — Wise, Mature, Balanced (American)
    stability:  0.82,
    similarity: 0.80,
    style:      0.12,
  },
};

const DEFAULT_VOICE: AllowedVoice = "chronicler";
const MODEL_ID = "eleven_turbo_v2_5";

async function synthesize(text: string, voice: string): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new Response("ElevenLabs key not configured", { status: 500 });
  if (!text?.trim()) return new Response("No text", { status: 400 });

  const safeVoice: AllowedVoice = ALLOWED_VOICES.includes(voice as AllowedVoice)
    ? (voice as AllowedVoice)
    : DEFAULT_VOICE;

  const { voiceId, stability, similarity, style } = VOICE_CONFIG[safeVoice];

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
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

  // Pipe the stream directly — browser starts receiving audio within ~300 ms
  // instead of waiting 3–5 s for the full ElevenLabs response to buffer.
  return new Response(res.body, {
    headers: {
      "Content-Type":  "audio/mpeg",
      "Cache-Control": "no-cache",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const text  = req.nextUrl.searchParams.get("text") ?? "";
    const voice = req.nextUrl.searchParams.get("voice") ?? DEFAULT_VOICE;
    return await synthesize(text, voice);
  } catch (err) {
    console.error("[api/narrate]", err);
    return new Response("TTS unavailable", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = (await req.json()) as { text: string; voice?: string };
    return await synthesize(text, voice ?? DEFAULT_VOICE);
  } catch (err) {
    console.error("[api/narrate]", err);
    return new Response("TTS unavailable", { status: 500 });
  }
}
