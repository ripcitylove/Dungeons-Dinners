import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { name, race, cls, sex, alignment, title } = await req.json() as {
      name?: string; race?: string; cls?: string;
      sex?: string; alignment?: string; title?: string;
    };

    if (!race || !cls) {
      return Response.json({ error: "race and class are required" }, { status: 400 });
    }

    const pronouns = sex === "female" ? "she/her" : sex === "non-binary" ? "they/them" : "he/him";
    const titlePart = title ? `, known as "${title}"` : "";
    const alignPart = alignment ? ` Their alignment is ${alignment}.` : "";

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `You are a D&D 5e character background writer. Write a concise, evocative character background of 400–500 characters. Write in third person. Do not mention game mechanics or stat numbers. Focus on: where the character comes from, one defining event that shaped them, what drives them now. Keep it grounded and personal — no chosen-one tropes. End on a forward-looking note. Return only the background text, no quotes, no label.`,
      messages: [{
        role: "user",
        content: `Character: ${name || "Unknown"} (${pronouns})${titlePart}
Race: ${race}
Class: ${cls}${alignPart}

Write the background.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const truncated = text.slice(0, 500);

    return Response.json({ background: truncated });
  } catch {
    return Response.json({ error: "Failed to generate background" }, { status: 500 });
  }
}
