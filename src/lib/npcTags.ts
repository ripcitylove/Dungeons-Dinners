// NPC presence tags the DM emits so the engine can show a portrait card for story
// characters (innkeepers, guards, guides, villains in dialogue — anyone present who
// isn't a combat enemy):
//   [NPC:Name:short visual description]  — the NPC is present in the scene
//   [NPC-GONE:Name]                      — the NPC has left
// Tags are stripped from the displayed/spoken text. Names are matched case-
// insensitively so re-introducing the same NPC updates rather than duplicates.

export type NpcEntered = { name: string; desc: string };
export type NpcTags = { entered: NpcEntered[]; gone: string[] };

const NPC_RE      = /\[NPC:([^:\]]{1,40}):([^\]]{0,200})\]/gi;
const NPC_GONE_RE = /\[NPC-GONE:([^\]]{1,40})\]/gi;

export function parseNpcTags(narrative: string): NpcTags {
  const entered: NpcEntered[] = [];
  const gone: string[] = [];
  if (!narrative) return { entered, gone };

  let m: RegExpExecArray | null;
  NPC_RE.lastIndex = 0;
  while ((m = NPC_RE.exec(narrative)) !== null) {
    const name = m[1].trim();
    const desc = m[2].trim();
    if (name) entered.push({ name, desc });
  }
  NPC_GONE_RE.lastIndex = 0;
  while ((m = NPC_GONE_RE.exec(narrative)) !== null) {
    const name = m[1].trim();
    if (name) gone.push(name);
  }
  return { entered, gone };
}

/** Strip NPC tags from text headed to display / TTS. */
export function stripNpcTags(text: string): string {
  return text.replace(NPC_RE, "").replace(NPC_GONE_RE, "");
}

// ── NPC identity resolution ─────────────────────────────────────────────────
// The DM sometimes refers to the SAME character by different labels across turns
// ("Eldrin" → "Captain Eldrin", "the Innkeeper" → "Innkeeper"). Matching cards by
// EXACT name then spawns a second portrait for one person. sameNpcName() resolves
// these "safe" cases — shared proper name, or article/honorific-only differences —
// WITHOUT merging two genuinely distinct same-role NPCs ("Tom the Guard" vs "Bob
// the Guard" stay separate, because their shared token is only a generic role).

// Leading articles + honorifics/titles: dropped before comparing the proper-name
// "core" so "the Innkeeper"=="Innkeeper" and "Captain Eldrin"=="Eldrin".
const NPC_TITLE_WORDS = new Set([
  "the", "a", "an",
  "sir", "ser", "lady", "lord", "master", "mistress", "mister", "mr", "mrs", "ms",
  "miss", "madam", "madame", "dame", "father", "brother", "sister", "elder",
  "old", "young", "captain", "capt", "general", "sergeant", "sgt", "commander",
  "chief", "high", "king", "queen", "prince", "princess", "saint", "st", "dr",
  "doctor", "professor", "prof", "uncle", "aunt", "granny", "grandfather",
  "grandmother", "lieutenant", "lt", "colonel", "major", "admiral", "warden",
]);

// Generic role/descriptor nouns that, even when shared between two names, must NOT
// alone be treated as the same character (two "guards" are two people). A subset
// match requires at least one shared NON-generic (proper-name) token.
const NPC_GENERIC_WORDS = new Set([
  "guard", "guardsman", "guardian", "watchman", "watch", "sentry", "soldier",
  "innkeeper", "keeper", "barkeep", "bartender", "merchant", "trader",
  "shopkeeper", "smith", "blacksmith", "man", "woman", "boy", "girl", "child",
  "kid", "villager", "guide", "priest", "priestess", "cleric", "monk", "knight",
  "stranger", "figure", "traveler", "traveller", "person", "people", "noble",
  "peasant", "servant", "maid", "cook", "hunter", "fisherman", "sailor", "host",
  "hostess", "waitress", "waiter", "beggar", "farmer", "healer", "sage",
  "scholar", "wizard", "mage", "bard", "ranger", "druid", "sorcerer", "warlock",
  "fighter", "rogue", "paladin", "barbarian", "dwarf", "elf", "human", "orc",
  "gnome", "halfling", "tiefling", "dragonborn", "goblin", "bandit", "cultist",
  "owner", "captain", "lord", "lady", "elder",
]);

function npcTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Proper-name core: tokens with leading articles/honorifics removed. */
function npcCore(name: string): string[] {
  const stripped = npcTokens(name).filter(t => !NPC_TITLE_WORDS.has(t));
  // If stripping left nothing (the name WAS only a title, e.g. "the Captain"),
  // fall back to the raw tokens so we still have something to compare.
  return stripped.length ? stripped : npcTokens(name);
}

/**
 * True when two NPC labels denote the SAME character under the conservative
 * "safe matching" policy:
 *   • exact (case-insensitive) match, or
 *   • identical proper-name core after dropping articles/honorifics
 *     ("the Innkeeper" ≈ "Innkeeper", "Captain Eldrin" ≈ "Eldrin"), or
 *   • one core's tokens are a subset of the other's AND they share at least one
 *     non-generic (proper-name) token ("Eldrin" ≈ "Eldrin Hollowvoice").
 * Two distinct same-role NPCs ("Tom the Guard" / "Bob the Guard") do NOT match.
 */
export function sameNpcName(a: string, b: string): boolean {
  const al = a.trim().toLowerCase();
  const bl = b.trim().toLowerCase();
  if (!al || !bl) return false;
  if (al === bl) return true;

  const ca = npcCore(a);
  const cb = npcCore(b);
  if (!ca.length || !cb.length) return false;

  if (ca.join(" ") === cb.join(" ")) return true;

  const [small, big] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
  const bigSet = new Set(big);
  if (!small.every(t => bigSet.has(t))) return false;
  // Require a shared PROPER token so a lone generic role noun can't merge two
  // different characters.
  return small.some(t => bigSet.has(t) && !NPC_GENERIC_WORDS.has(t));
}

// Minimal shape of an on-screen NPC card. The campaign page's SceneNpc (which also
// carries portrait_url) is assignable to this, so these helpers operate on the real
// cards and preserve any extra fields via the spread.
export type NpcCardLike = { name: string; desc: string };

/**
 * Collapse multiple labels for the SAME character emitted in ONE response into a
 * single card (first label wins as canonical; latest non-empty description kept),
 * so a single turn can never spawn two cards for one person.
 */
export function dedupeEnteredNpcs<T extends NpcCardLike>(entered: T[]): T[] {
  const out: T[] = [];
  for (const e of entered) {
    const hit = out.find(d => sameNpcName(d.name, e.name));
    if (hit) { if (e.desc) hit.desc = e.desc; }
    else out.push({ ...e });
  }
  return out;
}

/**
 * Roster after a SCENE RESET: the re-emitted NPCs are authoritative. Each is matched
 * leniently against the previous roster so a relabel (e.g. "Bram" for an existing
 * "Bram Hollowcask") reuses the existing card — keeping its cached portrait — instead
 * of duplicating. Capped to the most recent `max`.
 */
export function resetNpcRoster<T extends NpcCardLike>(prev: T[], entered: T[], max = 6): T[] {
  return dedupeEnteredNpcs(entered).slice(-max).map(e => {
    const existing = prev.find(n => sameNpcName(n.name, e.name));
    return existing ? { ...existing, desc: e.desc || existing.desc } : { ...e };
  });
}

/**
 * Roster after a normal (same-scene) turn: drop any `gone` NPCs, then merge the newly
 * entered NPCs into the previous roster. A newly entered label that resolves to an
 * existing card (variant name for the same character) UPDATES it rather than adding a
 * duplicate. Capped to the most recent `max`.
 */
export function mergeNpcRoster<T extends NpcCardLike>(prev: T[], entered: T[], gone: string[], max = 6): T[] {
  let next = [...prev];
  if (gone.length) next = next.filter(n => !gone.some(g => sameNpcName(g, n.name)));
  for (const e of dedupeEnteredNpcs(entered)) {
    const idx = next.findIndex(n => sameNpcName(n.name, e.name));
    if (idx >= 0) next[idx] = { ...next[idx], desc: e.desc || next[idx].desc };
    else next.push({ ...e });
  }
  return next.slice(-max);
}
