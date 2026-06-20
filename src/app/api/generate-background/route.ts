import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic();

const MAX_CHARS = 700;

// Trim AI output to <= MAX_CHARS WITHOUT cutting mid-sentence. We accumulate whole
// sentences until the next one would overflow; that guarantees a clean ending the
// textarea's maxLength can never sever. Falls back to a word-boundary + ellipsis
// only if a single sentence somehow exceeds the cap. No extra API call involved.
function trimToCleanSentence(text: string, max = MAX_CHARS): string {
  const t = text.replace(/\r\n/g, "\n").trim(); // canonical LF so length is exact
  if (t.length <= max) return t;
  const sentences = t.match(/[^.!?]+[.!?]+["'”’)\]]*\s*/g) ?? [];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  out = out.trim();
  if (out.length >= 120) return out; // got at least one full sentence — clean stop
  // A single over-long sentence: cut at the last word boundary and mark it.
  const slice = t.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  return ((lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trim() + "…");
}

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
      max_tokens: 240,
      system: `You are a D&D 5e character background writer. Write a complete, self-contained character background of about 500–650 characters — a full little story with a clear arc, not a fragment. Hard rule: NEVER exceed 700 characters, and ALWAYS finish your final sentence (do not trail off). Write in third person. Do not mention game mechanics or stat numbers. Cover, in order: where the character comes from, one defining event that shaped them, and what drives them now. Keep it grounded and personal — no chosen-one tropes. End on a forward-looking note. Return only the background text, no quotes, no label.`,
      messages: [{
        role: "user",
        content: `Character: ${name || "Unknown"} (${pronouns})${titlePart}
Race: ${race}
Class: ${cls}${alignPart}

Write the background.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const background = trimToCleanSentence(text);

    return Response.json({ background });
  } catch {
    return Response.json({ error: "Failed to generate background" }, { status: 500 });
  }
}
