import OpenAI from "openai";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { text } = (await req.json()) as { text: string };
    if (!text?.trim()) return new Response("No text", { status: 400 });

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",   // deep, authoritative narrator voice
      input: text.slice(0, 4096),
      speed: 0.92,     // slight slow-down for dramatic weight
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
