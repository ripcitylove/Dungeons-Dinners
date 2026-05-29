import { NextRequest } from "next/server";

const EL_KEY = process.env.ELEVENLABS_API_KEY ?? "";

type VoiceConfig = {
  voiceId:         string;
  stability:       number;
  similarityBoost: number;
  style:           number;
};

// ElevenLabs voice IDs — all sourced from the shared voice library
const VOICE_CONFIG: Record<string, VoiceConfig> = {
  // Male
  myrrdin:   { voiceId: "oR4uRy4fHDUGGISL0Rev", stability: 0.75, similarityBoost: 0.70, style: 0.10 },
  cornelius: { voiceId: "6sFKzaJr574YWVu4UuJF", stability: 0.70, similarityBoost: 0.70, style: 0.05 },
  oldwizard: { voiceId: "JoYo65swyP8hH6fVMeTO", stability: 0.72, similarityBoost: 0.68, style: 0.08 },
  // Female
  morganna:  { voiceId: "7NsaqHdLuKNFvEfjpUno", stability: 0.65, similarityBoost: 0.75, style: 0.12 },
  eleanor:   { voiceId: "2qQJWjw5XdG80GreshqG", stability: 0.72, similarityBoost: 0.72, style: 0.05 },
  kanika:    { voiceId: "xccfcojYYGnqTTxwZEDU", stability: 0.60, similarityBoost: 0.78, style: 0.15 },
};

const DEFAULT_VOICE = "myrrdin";

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = (await req.json()) as { text: string; voice?: string };
    if (!text?.trim()) return new Response("No text", { status: 400 });

    const config = VOICE_CONFIG[voice ?? DEFAULT_VOICE] ?? VOICE_CONFIG[DEFAULT_VOICE];

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`, {
      method:  "POST",
      headers: {
        "xi-api-key":   EL_KEY,
        "Content-Type": "application/json",
        "Accept":       "audio/mpeg",
      },
      body: JSON.stringify({
        text:     text.slice(0, 5000),
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability:        config.stability,
          similarity_boost: config.similarityBoost,
          style:            config.style,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[api/narrate] ElevenLabs error:", res.status, errText);
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
