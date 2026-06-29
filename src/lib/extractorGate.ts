// Decides whether the Haiku chat-state extractor (/api/chat-state) can be SKIPPED
// for a given DM narrative because the turn is ALREADY fully covered by the
// deterministic inline tags the client parses ([HP]/[THP]/[GOLD]/[LOOT]/[WEAPON]/
// [ITEM-LOST]/[XP]/[CAST]/[SPELL]/…).
//
// The extractor's ONLY unique catches are:
//   (a) STATUS EFFECTS — there is no [STATUS] tag, so conditions (poisoned,
//       frightened, prone, …) come only from the extractor.
//   (b) a FORGOTTEN [HP] tag on a turn that clearly dealt damage.
//   (c) UNTAGGED spell-slot use (DM cast a leveled spell without a [CAST]/[SPELL]).
//
// We may skip the extractor ONLY when none of those can be in play. HP/temp-HP are
// applied by the fast-[HP]/[THP]-tag path independently of the extractor, so a
// turn whose only state is tagged economy/HP needs no extractor call at all.
//
// Conservative by construction: ANY whiff of a condition word, spell word without
// a cast tag, or damage word without an HP tag forces the extractor to run. This
// protects Real-Time Value Accuracy (we never silently drop a condition or HP).

const CONDITION_KW = /\b(poison\w*|frighten\w*|prone|stunned?|charm\w*|paralyz\w*|grappl\w*|restrain\w*|blind\w*|deafen\w*|unconscious|incapacitat\w*|petrif\w*|exhaust\w*|invisib\w*|bless\w*|curse\w*|concentrat\w*|inspir\w*|rag(?:e|ing)|marked|hex\w*|asleep|sleep\w*|slow\w*|haste\w*|burning|bleeding|diseased?|silenced)\b/i;
const SPELL_KW     = /\b(spell|cast\w*|slot|cantrip|smite|channel|invocation)\b/i;
const DAMAGE_KW    = /\b(damage|wound\w*|hit|hits|strikes?|struck|bite|bites|slash\w*|gash|stab\w*|burn\w*|sear\w*|bludgeon\w*|pierc\w*|takes?\s+\d|loses?\s+\d|hp)\b/i;

const STATE_TAG = /\[[A-Za-z][A-Za-z-]*[:\]]/;
const HP_TAG    = /\[(?:HP|THP):/i;
const SPELL_TAG = /\[(?:CAST|SPELL):/i;

/** True when the DM narrative is fully covered by deterministic tags and the
 *  chat-state extractor can be skipped without losing any state. */
export function isFullyTagCovered(narrative: string, inCombat: boolean): boolean {
  if (!STATE_TAG.test(narrative)) return false; // no tags → extractor is the only source
  if (inCombat) return false;                   // combat can apply conditions/HP the DM under-tags
  if (CONDITION_KW.test(narrative)) return false;                        // (a) a status effect may need extracting
  if (SPELL_KW.test(narrative) && !SPELL_TAG.test(narrative)) return false; // (c) untagged spell use
  if (DAMAGE_KW.test(narrative) && !HP_TAG.test(narrative)) return false;   // (b) untagged damage
  return true;
}
