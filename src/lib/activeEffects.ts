// Deterministic backstop for showing buffs/debuffs the DM EXPLICITLY narrates as
// active on a party member — e.g. "Randiezel has Shillelagh active, staff humming."
//
// The LLM state extractor is the primary path, but it can miss effects and never
// runs on resume recaps (those replay cached text without a fresh extraction), so a
// narrated-active buff can fail to appear on the card. This scans for high-precision
// "{Name} … {KnownEffect} … active/has/maintains/possessive" structures and returns
// the effects to ADD per character. ADD-only — removal stays with the extractor —
// and removal contexts ("the Shillelagh fades") are excluded so we never re-add a
// buff that's ending.

import { STATUS_EFFECTS } from "./statusEffects.ts";

const EFFECT_NAMES = Object.keys(STATUS_EFFECTS);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Right after the effect: it's being REMOVED, not gained — skip. Tokens are
// word-bounded so "close" can't trip "lose", "sends" can't trip "end", etc.
const REMOVAL_AFTER = /^[^.!?\n]{0,25}\b(?:fad\w*|ends?|ended|ending|drops?|dropped|wears?\s+off|wore\s+off|dispel\w*|expir\w*|broke\w*|gone|lost|los(?:e|es|ing)|no longer|wins?\s+out|spent)\b/i;
// Right after the effect: an "is active / still up / humming…" confirmation.
const ACTIVE_AFTER  = /^[^.!?\n]{0,30}\b(?:active|still up|still active|humming|maintained|in effect|glowing|wreathed|surrounds?)\b/i;
// Just before the effect: a "has / maintains / keeps / 's …" possession cue.
const CUE_BEFORE    = /\b(?:has|have|had|maintains?|maintaining|keeps?|keeping|sustains?|carries|holds?|bears|under)\b[^.!?\n]{0,20}$/i;
const POSSESSIVE    = /['’]s\s*$/;

/**
 * Returns { [firstName]: [canonicalEffectName, ...] } for effects the narrative
 * explicitly states are active on a named party member. For each effect mention we
 * confirm an "active"/possession cue, reject removal contexts, then attribute it to
 * the NEAREST party first-name that precedes it (or the name in "…active on Name").
 * Nearest-preceding-name attribution prevents one character's effect bleeding onto
 * another in multi-clause lines ("Randiezel has Shillelagh active; Vi has Guidance").
 */
export function detectActiveEffects(narrative: string, partyNames: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!narrative) return out;
  const lower = narrative.toLowerCase();
  const firsts = partyNames.map(p => p.split(" ")[0]).filter(f => f.length >= 2);

  for (const effect of EFFECT_NAMES) {
    if (!lower.includes(effect.toLowerCase())) continue; // effect not present — skip fast
    const re = new RegExp(`\\b${esc(effect)}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(narrative)) !== null) {
      const end    = m.index + m[0].length;
      const after  = narrative.slice(end, end + 40);
      const before = narrative.slice(Math.max(0, m.index - 70), m.index);

      if (REMOVAL_AFTER.test(after)) continue;                       // being removed
      const activated = ACTIVE_AFTER.test(after) || CUE_BEFORE.test(before) || POSSESSIVE.test(before);
      if (!activated) continue;                                      // mere flavor mention

      let chosen: string | null = null;
      // 1) Explicit RECIPIENT named after the effect — the bearer, not the caster:
      //    "Vi's Guidance settles over Barnabus", "Guidance active on Ekko",
      //    "Bless on Aria". This overrides a possessive caster before the effect.
      if (firsts.length) {
        const recip = after.match(new RegExp(`\\b(?:over|on|onto|upon|around|across|to|for)\\s+\\b(${firsts.map(esc).join("|")})\\b`, "i"));
        if (recip) chosen = firsts.find(f => f.toLowerCase() === recip[1].toLowerCase()) ?? null;
      }
      // 2) Otherwise the nearest party first-name BEFORE the effect (self-buff /
      //    possessive bearer: "Randiezel has Shillelagh active").
      if (!chosen) {
        let chosenPos = -1;
        for (const f of firsts) {
          const nameRe = new RegExp(`\\b${esc(f)}\\b`, "gi");
          let nm: RegExpExecArray | null, last = -1;
          while ((nm = nameRe.exec(before)) !== null) last = nm.index;
          if (last > chosenPos) { chosenPos = last; chosen = f; }
        }
      }
      if (!chosen) continue;

      (out[chosen] ??= []);
      if (!out[chosen].includes(effect)) out[chosen].push(effect);
    }
  }
  return out;
}
