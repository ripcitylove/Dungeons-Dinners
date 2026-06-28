// NPC presence tags the DM emits so the engine can show a portrait card for story
// characters (innkeepers, guards, guides, villains in dialogue — anyone present who
// isn't a combat enemy):
//   [NPC:Name:short visual description]  — the NPC is present in the scene
//   [NPC-GONE:Name]                      — the NPC has left
//   [NPC-RENAME:OldNameOrDescriptor:NewName] — the NPC's identity is revealed: the
//       card currently labeled OldName (e.g. "Hooded Stranger") is renamed to NewName
//       (e.g. "Garrick Vane"), KEEPING the same portrait.
// Tags are stripped from the displayed/spoken text. Names are matched case-
// insensitively so re-introducing the same NPC updates rather than duplicates.

export type NpcEntered = { name: string; desc: string };
export type NpcRename = { from: string; to: string };
export type NpcTags = { entered: NpcEntered[]; gone: string[]; renamed: NpcRename[] };

const NPC_RE        = /\[NPC:([^:\]]{1,40}):([^\]]{0,200})\]/gi;
const NPC_GONE_RE   = /\[NPC-GONE:([^\]]{1,40})\]/gi;
const NPC_RENAME_RE = /\[NPC-RENAME:([^:\]]{1,40}):([^:\]]{1,40})\]/gi;

export function parseNpcTags(narrative: string): NpcTags {
  const entered: NpcEntered[] = [];
  const gone: string[] = [];
  const renamed: NpcRename[] = [];
  if (!narrative) return { entered, gone, renamed };

  let m: RegExpExecArray | null;
  // Rename first so we can also drop any [NPC:NewName] re-affirmation collision later.
  NPC_RENAME_RE.lastIndex = 0;
  while ((m = NPC_RENAME_RE.exec(narrative)) !== null) {
    const from = m[1].trim();
    const to = m[2].trim();
    if (from && to) renamed.push({ from, to });
  }
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
  return { entered, gone, renamed };
}

/** Strip NPC tags from text headed to display / TTS. */
export function stripNpcTags(text: string): string {
  return text.replace(NPC_RENAME_RE, "").replace(NPC_RE, "").replace(NPC_GONE_RE, "");
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
 * True when an [NPC:Name] label actually refers to one of the PARTY's own player
 * characters. The DM is told never to give a PC an NPC card, but it occasionally
 * tags a player anyway ("[NPC:Lyra:...]") — which would render that player in the
 * story-NPC column. We match on full name, prefix (first name vs full name, either
 * direction), and bare first name, so "Lyra", "Lyra Quickwit", and "Lyra the Bard"
 * all resolve to the player "Lyra Quickwit".
 */
export function isPlayerName(name: string, partyNames: string[]): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  const nFirst = n.split(/\s+/)[0];
  return partyNames.some(p => {
    const pl = (p ?? "").trim().toLowerCase();
    if (!pl) return false;
    const pFirst = pl.split(/\s+/)[0];
    return pl === n || pl.startsWith(n + " ") || n.startsWith(pl + " ") || (!!pFirst && pFirst === nFirst);
  });
}

/** Drop any NPC cards/tags that actually name a party player character. */
export function dropPlayerNpcs<T extends NpcCardLike>(npcs: T[], partyNames: string[]): T[] {
  if (!partyNames.length) return npcs;
  return npcs.filter(n => !isPlayerName(n.name, partyNames));
}

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

// ── NPC identity reveal (descriptor → proper name) ──────────────────────────
// Anonymous "who is that?" descriptors a card can carry before the character is
// named. Used to recognise a "the hooded stranger reveals his name" reveal so the
// gone+enter backstop only fires for genuinely anonymous cards — never for a named
// or role-specific NPC who actually left.
const NPC_ANON_DESCRIPTORS = new Set([
  "stranger", "figure", "hooded", "cloaked", "masked", "robed", "veiled", "cowled",
  "mysterious", "shadowy", "man", "woman", "person", "traveler", "traveller",
  "newcomer", "visitor", "patron", "boy", "girl", "child", "gentleman", "fellow",
  "individual", "silhouette", "form", "shape", "outsider", "guest", "figurehead",
  // captive / condition descriptors an unnamed person is labeled by until revealed
  "bound", "captive", "prisoner", "chained", "caged", "shackled", "wounded",
  "injured", "dying", "bleeding", "kneeling", "trembling", "weeping", "sobbing",
  "ragged", "blindfolded", "gagged", "unconscious", "bruised", "beaten",
  "frightened", "terrified", "huddled", "crumpled", "frail", "gaunt", "pale",
  "wretched", "battered", "captured", "tied", "hostage", "victim", "survivor",
  "elderly", "old", "young", "tall", "short", "thin", "lean", "scarred",
]);

/**
 * True when a card name is an "anonymous person" descriptor that is clearly standing
 * in for an as-yet-unnamed character — e.g. "Hooded Stranger", "the old man", "Bound
 * Woman", "Wounded Soldier". Requires at least one anonymous descriptor word AND no
 * proper-name token, so a bare role label ("the guard", "merchant") does NOT qualify
 * (a guard leaving is a real departure, not an identity reveal).
 */
export function isAnonymousDescriptor(name: string): boolean {
  const core = npcCore(name);
  if (!core.length) return false;
  const hasAnon = core.some(t => NPC_ANON_DESCRIPTORS.has(t));
  const allNonProper = core.every(t => NPC_ANON_DESCRIPTORS.has(t) || NPC_GENERIC_WORDS.has(t));
  return hasAnon && allNonProper;
}

/** True when a name carries an actual proper-name token (not just generic role / anon-descriptor words). */
export function hasProperName(name: string): boolean {
  return npcCore(name).some(t => !NPC_GENERIC_WORDS.has(t) && !NPC_ANON_DESCRIPTORS.has(t));
}

/** Collapse cards that resolve to the same character, keeping the first and inheriting a portrait/desc from a duplicate. */
function dedupeNpcCards<T extends NpcCardLike>(cards: T[]): T[] {
  const out: T[] = [];
  for (const c of cards) {
    const hit = out.find(o => sameNpcName(o.name, c.name)) as (T & { portrait_url?: string }) | undefined;
    if (hit) {
      const cc = c as T & { portrait_url?: string };
      if (!hit.portrait_url && cc.portrait_url) hit.portrait_url = cc.portrait_url;
      if (!hit.desc && c.desc) hit.desc = c.desc;
    } else out.push({ ...c });
  }
  return out;
}

/**
 * Apply identity reveals: rename the card matching each `from` to its `to` name,
 * PRESERVING the card object (so its cached portrait carries over). If the new name
 * already exists as a separate card, the two are collapsed. Returns a NEW array.
 */
export function applyNpcRenames<T extends NpcCardLike>(prev: T[], renames: NpcRename[]): T[] {
  if (!renames.length) return prev;
  const next = prev.map(c => ({ ...c }));
  for (const { from, to } of renames) {
    if (!from?.trim() || !to?.trim()) continue;
    const card = next.find(c => sameNpcName(c.name, from));
    if (card) card.name = to;
  }
  return dedupeNpcCards(next);
}

/**
 * Backstop for when the DM reveals an identity via [NPC-GONE:descriptor] + [NPC:Name]
 * in the same turn instead of the explicit [NPC-RENAME] tag. Returns a rename pair ONLY
 * in the unambiguous case: exactly one departing card that is a pure anonymous
 * descriptor, and exactly one newly-entered card that has a real proper name and isn't
 * already on screen. Otherwise returns null (treat as a genuine leave + arrival).
 */
export function inferRenameFromGoneEnter<T extends NpcCardLike>(prev: T[], entered: T[], gone: string[]): NpcRename | null {
  if (gone.length !== 1 || entered.length !== 1) return null;
  const card = prev.find(c => sameNpcName(c.name, gone[0]));
  if (!card || !isAnonymousDescriptor(card.name)) return null;
  const e = entered[0];
  if (!hasProperName(e.name)) return null;
  if (prev.some(c => sameNpcName(c.name, e.name))) return null;
  return { from: card.name, to: e.name };
}

// Distinctive physical "placeholder" features by which a still-anonymous NPC is
// identified ("the HOODED stranger", "the SCARRED man"). When the DM finally names
// that character it almost always restates the feature ("Mira — hood pushed back"),
// which lets us link the new name to the existing card even when the DM names them
// via a fresh [NPC:Name] instead of the explicit [NPC-RENAME] tag.
const NPC_REVEAL_FEATURES = [
  "hood", "cloak", "mask", "robe", "veil", "cowl", "scar", "tattoo", "eyepatch",
  "patch", "limp", "beard", "burn", "brand", "bandage", "crimson", "emerald",
];
function revealFeatures(text: string): Set<string> {
  const t = (text || "").toLowerCase();
  const out = new Set<string>();
  for (const f of NPC_REVEAL_FEATURES) if (t.includes(f)) out.add(f);
  return out;
}

/**
 * Backstop for when the DM reveals an anonymous NPC's name with a fresh [NPC:Name] tag
 * (no [NPC-RENAME], no [NPC-GONE]) but restates the distinctive feature in the new
 * description. Links each newly-named NPC to the single on-screen anonymous-descriptor
 * card that shares a distinctive feature, so the card is renamed (portrait kept) rather
 * than duplicated. Requires a UNIQUE feature match to stay safe.
 */
export function inferRevealRenames<T extends NpcCardLike>(prev: T[], entered: T[]): NpcRename[] {
  const renames: NpcRename[] = [];
  const usedFrom = new Set<string>();
  for (const e of entered) {
    if (!hasProperName(e.name)) continue;
    if (prev.some(c => sameNpcName(c.name, e.name))) continue; // already an existing card
    const eFeat = revealFeatures(`${e.name} ${e.desc}`);
    if (!eFeat.size) continue;
    const matches = prev.filter(c =>
      !usedFrom.has(c.name.toLowerCase()) &&
      isAnonymousDescriptor(c.name) &&
      !entered.some(x => sameNpcName(x.name, c.name)) &&
      [...revealFeatures(`${c.name} ${c.desc}`)].some(f => eFeat.has(f)),
    );
    if (matches.length === 1) {
      renames.push({ from: matches[0].name, to: e.name });
      usedFrom.add(matches[0].name.toLowerCase());
    }
  }
  return renames;
}
