// Determines which party member the DM's narration is handing the turn to, by
// finding the player addressed by a second-person turn prompt ("…what do you do?")
// or a third-person one ("What does X do?").
//
// The bug this fixes: the old detector picked the name with the LATEST position
// before the prompt. In "Randiezel, Ekko is bleeding out at your feet — what do you
// do?" BOTH names precede the prompt, and Ekko (merely the sentence's object) sits
// closer to it, so Ekko wrongly won — and on resume the "Acting" highlight landed on
// Ekko instead of the real addressee, Randiezel. The addressee is the VOCATIVE: a
// name set off by a comma ("Randiezel, … what do you do?" or "what do you do,
// Randiezel?"). We resolve vocatives first and only fall back to the loose
// proximity heuristic when there's no vocative.

// Second-person turn-prompt phrasings the DM rotates through.
const PROMPT =
  `what (?:\\w+ ){0,4}(?:do|will|would|shall|can|could) you` +
  `|what(?:'s| is) your (?:action|move|next move)` +
  `|which (?:\\w+ ){0,4}(?:do|will|would|shall) you` +
  `|(?:do|would|will) you (?:like|want|wish|prefer|choose|pick|decide|select)` +
  `|your (?:move|turn|action)` +
  `|you(?:'re| are) up` +
  `|how (?:do|will|would) you (?:respond|react|proceed)` +
  `|(?:make|take) your (?:move|action|choice)` +
  `|(?:the )?(?:choice|move|moment|decision|call) is yours` +
  `|what now` +
  `|(?:like|want) to (?:try|do|attempt)` +
  `|try (?:something (?:else|different)|again|instead)`;

type Hit = { idx: number; name: string };
const latest = (arr: Hit[]): Hit | null =>
  arr.reduce<Hit | null>((best, c) => (!best || c.idx > best.idx ? c : best), null);

export function detectTurnAddressee(text: string, partyNames: string[]): string | null {
  if (!text) return null;
  const tail = text.slice(-350);

  const vocative: Hit[] = []; // highest confidence: name set off by a comma
  const loose: Hit[]    = []; // fallback: name within 120 chars of the prompt
  const third: Hit[]    = []; // third-person / yes-no question forms

  for (const fullName of partyNames) {
    const firstName = fullName.split(" ")[0];
    if (firstName.length < 2) continue;
    const esc = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let m: RegExpExecArray | null;

    // VOCATIVE — leading "Name, … {prompt}" (comma right after the name) or
    // trailing "{prompt} …, Name" (name shortly after the prompt, behind a comma).
    const vlead  = new RegExp(`\\b${esc}\\b\\s*,[^\\n]{0,120}?(?:${PROMPT})`, "gi");
    const vtrail = new RegExp(`(?:${PROMPT})[^\\n]{0,40}?,\\s*${esc}\\b`, "gi");
    vlead.lastIndex = 0;  while ((m = vlead.exec(tail))  !== null) vocative.push({ idx: m.index, name: fullName });
    vtrail.lastIndex = 0; while ((m = vtrail.exec(tail)) !== null) vocative.push({ idx: m.index, name: fullName });

    // LOOSE — name on either side of the prompt within 120 chars (old behavior).
    const looseRe = new RegExp(
      `\\b${esc}\\b[^\\n]{0,120}(?:${PROMPT})` +
      `|(?:${PROMPT})[^\\n]{0,120}\\b${esc}\\b`,
      "gi"
    );
    looseRe.lastIndex = 0; while ((m = looseRe.exec(tail)) !== null) loose.push({ idx: m.index, name: fullName });

    // THIRD-PERSON — "What does X do?", "How will X respond?", "X, what do they do?",
    // and yes/no questions ("Does X press on?").
    const thirdRe = new RegExp(
      `what (?:does|will|would|can|shall) \\b${esc}\\b[^?\\n]{0,80}\\?` +
      `|how (?:does|will|would|should) \\b${esc}\\b[^?\\n]{0,80}\\?` +
      `|\\b${esc}\\b[^?\\n]{0,60},?\\s+(?:what|how)[^?\\n]{0,80}\\?` +
      `|(?:does|will|is|are|can|should|would|shall)\\s+\\b${esc}\\b[^?\\n]{0,60}\\?`,
      "gi"
    );
    thirdRe.lastIndex = 0; while ((m = thirdRe.exec(tail)) !== null) third.push({ idx: m.index, name: fullName });
  }

  // Vocative wins outright; otherwise the loose proximity match; otherwise third-person.
  return (latest(vocative) ?? latest(loose) ?? latest(third))?.name ?? null;
}
