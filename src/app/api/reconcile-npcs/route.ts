import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

// Silent on-load reconciliation: when a saved campaign reopens with a placeholder
// NPC card still showing a descriptor label ("Bound Woman", "Hooded Stranger"),
// read the recent story and decide whether that character has since been given a
// proper name. Returns rename pairs the client applies deterministically (it only
// ever renames a card that actually exists). Conservative by design — when in doubt,
// it renames nothing, so a still-mysterious figure keeps its placeholder.
function buildSystem(labels: string[]): string {
  return `You reconcile NPC name cards for a D&D campaign. The game shows a portrait card for each on-screen story character. Some cards still use a PLACEHOLDER label because the character had no name when they first appeared.

PLACEHOLDER CARDS TO CHECK (exact current labels):
${labels.map(l => `- ${l}`).join("\n")}

Read the STORY EXCERPT the user provides. For EACH placeholder label above, decide:
- Has the SAME character been given a PROPER NAME in the story (they introduced themselves, another character named them, or the narration names them)? If yes, output a rename from the EXACT placeholder label to that proper name.
- If the character is still unnamed / mysterious in the story, or you are not confident the name belongs to THAT specific placeholder, do NOT rename it.

STRICT RULES:
- Never invent a name. Only use a proper name that literally appears in the excerpt for that character.
- The "from" value MUST be one of the exact placeholder labels listed above.
- A proper name is a personal name (e.g. "Sera", "Garrick Vane"), never a role or descriptor ("the guard", "innkeeper", "hooded figure").
- Do NOT rename a placeholder to a PLAYER/party member's name.
- When uncertain, omit it. Renaming the wrong character is worse than leaving a placeholder.

Return ONLY valid JSON, no other text:
{"renames":[{"from":"<exact placeholder label>","to":"<proper name from the story>"}]}
If nothing should be renamed, return {"renames":[]}.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { narrative?: string; labels?: string[] };
    const labels = (body.labels ?? []).map(s => String(s).trim()).filter(Boolean).slice(0, 8);
    const narrative = (body.narrative ?? "").slice(-6000); // last ~6k chars of recent story
    if (!labels.length || !narrative.trim()) return Response.json({ renames: [] });

    const res = await anthropic.messages.create({
      model:       "claude-haiku-4-5-20251001",
      max_tokens:  200,
      temperature: 0, // deterministic extraction — same story always yields the same decision
      system:      buildSystem(labels),
      messages:    [{ role: "user", content: `STORY EXCERPT (most recent first portion may be a [RECAP]):\n${narrative}` }],
    });

    const raw = res.content[0]?.type === "text" ? res.content[0].text.trim() : "";
    let renames: { from: string; to: string }[] = [];
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
      if (Array.isArray(parsed.renames)) {
        const labelSet = new Set(labels.map(l => l.toLowerCase()));
        renames = parsed.renames
          .map((r: unknown) => {
            const o = r as { from?: unknown; to?: unknown };
            return { from: String(o.from ?? "").trim(), to: String(o.to ?? "").trim() };
          })
          // The "from" must be an exact placeholder we asked about; "to" must be a real,
          // different name. Final safety net on top of the model's own instructions.
          .filter((r: { from: string; to: string }) =>
            r.from && r.to &&
            labelSet.has(r.from.toLowerCase()) &&
            r.from.toLowerCase() !== r.to.toLowerCase() &&
            /[a-z]/i.test(r.to) && r.to.length <= 40)
          .slice(0, 8);
      }
    } catch { /* model returned non-JSON → no renames */ }

    return Response.json({ renames });
  } catch (err) {
    console.error("[reconcile-npcs]", err);
    return Response.json({ renames: [] });
  }
}
