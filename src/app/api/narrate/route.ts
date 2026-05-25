import OpenAI from "openai";
import { NextRequest } from "next/server";

const ALLOWED_VOICES = ["onyx", "fable", "echo", "ash", "ballad"] as const;
type AllowedVoice = typeof ALLOWED_VOICES[number];

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { text, voice } = (await req.json()) as { text: string; voice?: string };
    if (!text?.trim()) return new Response("No text", { status: 400 });

    const safeVoice: AllowedVoice = ALLOWED_VOICES.includes(voice as AllowedVoice)
      ? (voice as AllowedVoice)
      : "onyx";

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: safeVoice,
      input: text.slice(0, 4096),
      speed: 0.92,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[api/narrate]", err);
    return new Response("TTS unavailable", { status: 500 });
  }
}
