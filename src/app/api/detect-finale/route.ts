import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

// Deterministic-enough finale detection. The DM reliably NARRATES the climactic
// ending when the party's final goal is achieved, but does not reliably emit the
// [CAMPAIGN-COMPLETE] engine tag. This lightweight classifier — called ONLY when the
// party is on the last objective — reads the narration and decides whether the final
// goal was just definitively accomplished and the story is concluding.
const SYSTEM = `You judge whether a D&D campaign's FINAL goal has just been ACCOMPLISHED and the story is ending.

Answer with ONLY valid JSON: {"complete": true} or {"complete": false}.

Set complete=true ONLY when the DM's narration clearly shows the party DEFINITIVELY achieving the stated final goal — the climactic victory, the threat ended for good, a triumphant epilogue / send-off. Set complete=false for mere progress, a partial step, a setback, an ongoing fight, a cliffhanger, or anything that leaves the final goal unfinished. When uncertain, answer false.`;

export async function POST(req: NextRequest) {
  try {
    const { narrative, finalGoal } = (await req.json()) as { narrative?: string; finalGoal?: string };
    if (!narrative?.trim() || !finalGoal?.trim()) return Response.json({ complete: false });
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 40,
      system: SYSTEM,
      messages: [{ role: "user", content: `THE PARTY'S FINAL GOAL: ${finalGoal}\n\nDM NARRATION (latest):\n${String(narrative).slice(0, 1600)}` }],
    });
    const raw = res.content[0].type === "text" ? res.content[0].text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    return Response.json({ complete: m ? Boolean(JSON.parse(m[0]).complete) : false });
  } catch (err) {
    console.error("[detect-finale]", err);
    return Response.json({ complete: false });
  }
}
