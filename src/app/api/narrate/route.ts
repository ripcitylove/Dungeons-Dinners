import { NextRequest } from "next/server";

const ALLOWED_VOICES = ["chronicler", "gravedigger", "bard", "oracle", "shade", "sage"] as const;
type AllowedVoice = typeof ALLOWED_VOICES[number];

// Maps each persona to an ElevenLabs pre-made voice + tuned settings
const VOICE_CONFIG: Record<AllowedVoice, {
  voiceId:    string;
  stability:  number;
  similarity: number;
  style:      number;
}> = {
  chronicler: {
    voiceId:    "JBFqnCBsd6RMkjVDRZzb", // George — deep British, authoritative
    stability:  0.80,
    similarity: 0.75,
    style:      0.20,
  },
  gravedigger: {
    voiceId:    "TxGEqnHWrfWFTfGW9XjX", // Josh — low, foreboding
    stability:  0.70,
    similarity: 0.75,
    style:      0.40,
  },
  bard: {
    voiceId:    "IKne3meq5aSn9XLyUdCD", // Charlie — British, animated
    stability:  0.40,
    similarity: 0.75,
    style:      0.60,
  },
  oracle: {
    voiceId:    "XB0fDUnXU5powFXDhCwa", // Charlotte — serene, ethereal female
    stability:  0.90,
    similarity: 0.80,
    style:      0.10,
  },
  shade: {
    voiceId:    "2EiwWnXFnvU5JabPnv8n", // Clyde — gritty, world-worn male
    stability:  0.60,
    similarity: 0.75,
    style:      0.30,
  },
  sage: {
    voiceId:    "ThT5KcBeYPX3keUQqHPh", // Dorothy — warm, mature British female
    stability:  0.75,
    similarity: 0.80,
    style:      0.20,
  },
};

const DEFAULT_VOICE: AllowedVoice = "chronicler";
const MODEL_ID = "eleven_turbo_v2_5";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return new Response("ElevenLabs key not configured", { status: 500 });

    const { text, voice } = (await req.json()) as { text: string; voice?: string };
    if (!text?.trim()) return new Response("No text", { status: 400 });

    const safeVoice: AllowedVoice = ALLOWED_VOICES.includes(voice as AllowedVoice)
      ? (voice as AllowedVoice)
      : DEFAULT_VOICE;

    const { voiceId, stability, similarity, style } = VOICE_CONFIG[safeVoice];

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
      console.error("[api/narrate] ElevenLabs:", res.status, msg);
      return new Response("TTS unavailable", { status: 500 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return new Response(buffer, {
      headers: {
        "Content-Type":  "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[api/narrate]", err);
    return new Response("TTS unavailable", { status: 500 });
  }
}
