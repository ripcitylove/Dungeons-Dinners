// Reliable detection of "did the acting caster actually CAST a leveled spell"
// from a DM response, used to gate the client-side fast spell-slot deduction.
//
// THE BUG THIS FIXES: the old fast path consumed a slot whenever a prepared
// spell NAME appeared anywhere in the DM text — so a *declined* cast ("Identify
// doesn't work on ambient light…") or a mere mention burned a slot the player
// never spent. The DM emits an explicit [SPELL:CasterFirstName:spell_key] tag
// ONLY when a spell is genuinely cast (never on a [NO-TURN] refusal or a
// mention — see the chat route's SPELL TAGS rules), so we gate on that tag.

const SPELL_TAG_RE = /\[SPELL:([A-Za-z][A-Za-z'\- ]*?):([a-z_]+)(?::([A-Za-z][A-Za-z'\- ]*?))?\]/gi;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Returns the caster's leveled prepared spell that an explicit
 * [SPELL:Caster:key] tag says was actually cast, or null. Matching is on the
 * caster's first name and a normalized comparison of the tag key against the
 * provided leveled prepared spell names ("fire_bolt" ↔ "Fire Bolt").
 *
 * `leveledPreparedSpells` MUST already exclude cantrips (level 0) — cantrips
 * never consume a slot, so the caller filters them out before calling.
 */
export function findFastSpellCast(text: string, casterFirstName: string, leveledPreparedSpells: string[]): string | null {
  if (!text || !casterFirstName) return null;
  const caster = norm(casterFirstName.split(" ")[0]);
  if (!caster) return null;
  const re = new RegExp(SPELL_TAG_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (norm(m[1].split(" ")[0]) !== caster) continue; // tag is for a different caster
    const key = norm(m[2]);
    const match = leveledPreparedSpells.find(s => norm(s) === key);
    if (match) return match;
  }
  return null;
}
