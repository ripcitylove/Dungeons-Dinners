import OpenAI from "openai";
import { NextRequest } from "next/server";

const ALLOWED_VOICES = ["onyx", "fable", "echo", "ash", "nova", "ballad", "chronicler"] as const;
type AllowedVoice = typeof ALLOWED_VOICES[number];

// chronicler is a styled variant — maps to a real OpenAI voice + speaking instructions
const VOICE_CONFIG: Partial<Record<AllowedVoice, { base: string; instructions: string }>> = {
  chronicler: {
    base: "onyx",
    instructions:
      "You are an ancient, grizzled wizard narrating a dark fantasy epic. Your voice is deep, slow, and weathered — each word chosen with deliberate weight, as if you have witnessed centuries of war and magic. Speak with gravitas and mystery. Pause between sentences. Let the silence carry menace. You are recounting legend by dying firelight, and every syllable should feel earned.",
  },
};

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { text, voice } = (await req.json()) as { text: string; voice?: string };
    if (!text?.trim()) return new Response("No text", { status: 400 });

    const safeVoice: AllowedVoice = ALLOWED_VOICES.includes(voice as AllowedVoice)
      ? (voice as AllowedVoice)
      : "onyx";

    const config = VOICE_CONFIG[safeVoice];
    const baseVoice = config?.base ?? safeVoice;

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: baseVoice as AllowedVoice,
      input: text.slice(0, 4096),
      ...(config?.instructions && { instructions: config.instructions }),
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
