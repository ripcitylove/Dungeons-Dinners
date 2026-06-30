import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/^﻿/, "") });

export type ItemDetail = {
  name:        string;
  description: string;
  value_gp:    number;
  rarity:      "common" | "uncommon" | "rare" | "very_rare" | "legendary";
  type:        string;
};

const SYSTEM = `You are a D&D 5e item appraiser. Given a short narrative excerpt and a list of item names just awarded to a player, return concise metadata for each.

Return ONLY valid JSON in this exact shape (no markdown, no prose):
{
  "items": [
    {
      "name":        string,  // exact item name as given
      "description": string,  // 1–2 sentence flavor + mechanical note. ≤ 180 chars. Be evocative but practical.
      "value_gp":    number,  // approximate gold piece value. Mundane: 1–50. Trinkets/curios: 5–25. Magical: 100–5000+. Use 0 for items with no resale value (personal letters, lore notes, plot tokens).
      "rarity":      string,  // one of: "common", "uncommon", "rare", "very_rare", "legendary". Mundane things like rations, rope, pouches, parchment → "common". Subtly magical / minor enchantments → "uncommon". Notable magical items → "rare" or above.
      "type":        string   // short category lowercased: "potion", "scroll", "weapon", "armor", "trinket", "consumable", "container", "tool", "valuable", "key", "lore", "quest", "wondrous"
      // QUEST CLASSIFICATION (important — drives the Quest Items tab + dedup):
      //   "key"   = a single-use key/keycard/sigil that opens ONE thing then is spent.
      //   "lore"  = letters, journals, maps, notes, ritual pages — readable plot info.
      //   "quest" = a plot/objective item the party must carry, deliver, or turn in
      //             (an amulet the quest is about, a stolen relic, a prisoner's token).
      // Use "key"/"lore"/"quest" for anything story/objective-bound; reserve the
      // generic types (potion/weapon/trinket/valuable/wondrous) for ordinary loot.
    }
  ]
}

Rules:
- Stay faithful to what the narrative implies. If the DM described a "leather pouch (23 gold pieces)", the pouch itself is a "container" worth ~1gp; do NOT count the 23 gp in its value_gp.
- A "vial of dark liquid" with no stated effect: description hints at "unidentified — could be poison, alchemical reagent, or magical draught"; type "consumable"; rarity "uncommon"; value_gp 25–50.
- A "folded parchment covered in ritual notes": type "lore"; rarity "common"; value_gp 0 (plot item, not currency).
- Be terse. Descriptions should fit a tooltip card.`;

export async function POST(req: NextRequest) {
  try {
    const { items, context } = (await req.json()) as { items: string[]; context?: string };
    if (!Array.isArray(items) || items.length === 0) return Response.json({ items: [] });

    const userMsg = `Narrative excerpt (for flavor context):\n${(context ?? "").slice(0, 1500)}\n\nItems to appraise:\n${items.map(n => `- ${n}`).join("\n")}`;

    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system:     SYSTEM,
      messages:   [{ role: "user", content: userMsg }],
    });

    const raw   = response.content[0].type === "text" ? response.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ items: [] });

    const parsed = JSON.parse(match[0]) as { items?: Array<Partial<ItemDetail>> };
    const validRarities = new Set(["common", "uncommon", "rare", "very_rare", "legendary"]);
    const out: ItemDetail[] = (parsed.items ?? [])
      .filter(it => typeof it.name === "string" && it.name.trim().length > 0)
      .map(it => ({
        name:        it.name as string,
        description: typeof it.description === "string" ? it.description.slice(0, 240) : "",
        value_gp:    Math.max(0, Math.min(50000, Math.round(Number(it.value_gp ?? 0)))),
        rarity:      validRarities.has(it.rarity as string) ? (it.rarity as ItemDetail["rarity"]) : "common",
        type:        typeof it.type === "string" ? it.type.toLowerCase() : "wondrous",
      }));

    return Response.json({ items: out });
  } catch (err) {
    console.error("[item-details]", err);
    return Response.json({ items: [] });
  }
}
