import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

// Folds a prior running recap plus the turns that have just aged out of the recent
// window into a single updated recap. Used by the campaign page's LIGHT history
// summarization (see src/lib/historyWindow.ts) to keep very long campaigns from
// resending the full transcript to the DM every turn. The recap must preserve the
// facts the DM needs for continuity — NPCs, locations, decisions, unresolved
// threads — not retell the prose.
const SYSTEM = `You compress the EARLY history of an ongoing D&D campaign into a tight factual recap the Dungeon Master can rely on for continuity. You are given the PRIOR RECAP (may be empty) and the NEW EARLY EVENTS that just aged out of the live window. Produce ONE updated recap that folds them together.

Keep, in compact prose (NOT a bullet dump, no markdown):
- WHO: party members and notable NPCs met, their relationships, allegiances, and fates (alive/dead/departed).
- WHERE: locations visited and the party's current trajectory.
- WHAT: key decisions, promises, betrayals, victories, defeats, and major loot/artifacts gained.
- OPEN THREADS: unresolved goals, debts, mysteries, and dangers still in play.

Rules:
- Be faithful — never invent events not present in the input.
- Prioritize facts a DM would CALL BACK to later; drop routine combat rounds and filler.
- Stay under 350 words. Write in past tense, third person. No preamble, no headers — just the recap text.`;

export async function POST(req: NextRequest) {
  try {
    const { priorSummary, messages } = (await req.json()) as {
      priorSummary?: string;
      messages: { role: string; content: string; sender?: string }[];
    };
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ summary: priorSummary ?? "" });
    }

    const transcript = messages
      .filter(m => m.role === "player" || m.role === "dm")
      .map(m => (m.role === "dm" ? `DM: ${m.content}` : `${m.sender ?? "Player"}: ${m.content}`))
      .join("\n")
      .slice(0, 16000); // hard cap so a giant fold never blows past a sane input size

    const userContent =
      `PRIOR RECAP:\n${(priorSummary ?? "").trim() || "(none yet)"}\n\n` +
      `NEW EARLY EVENTS (older turns that just aged out of the live window):\n${transcript}\n\n` +
      `Produce the single updated recap.`;

    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      // No prompt cache here: this prompt is ~500 tokens (below Haiku's 2048-token
      // cache floor) and the call runs only ~once per 30 messages, so its cost is
      // negligible and caching would be a no-op anyway.
      system:     SYSTEM,
      messages:   [{ role: "user", content: userContent }],
    });

    const u = res.usage;
    console.log(`[api/summarize-history] tokens in=${u.input_tokens} cacheWrite=${u.cache_creation_input_tokens ?? 0} cacheRead=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`);

    const summary = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    // Fail safe: if the model returned nothing usable, keep the prior recap so the
    // caller never persists an empty summary (which would drop early context).
    return Response.json({ summary: summary || (priorSummary ?? "") });
  } catch (err) {
    console.error("[api/summarize-history]", err);
    // Fail safe — signal no usable summary; the caller falls back to full history.
    return Response.json({ summary: "" }, { status: 500 });
  }
}
