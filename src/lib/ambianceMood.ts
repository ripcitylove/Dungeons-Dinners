// Detects when the DM narrative describes a scene-wide UNNATURAL SILENCE so the
// ambient audio can stop contradicting it (the bug: DM says "the harbor remains
// unnaturally silent" while harbor chatter/bustle keeps playing). Returns a mood
// the ambiance layer maps to a silent pool; null leaves the normal location
// ambiance in place. High precision — a single NPC "falling silent" must NOT mute
// the whole scene, so environment-subject silence requires a place/world noun.

export type AmbianceMood = "silent";

// Environment nouns that legitimately scope silence to the whole scene.
const ENV = "harbor|harbour|room|chamber|hall|street|alley|forest|woods|woodland|grove|cave|cavern|tavern|inn|market|square|air|night|world|crowd|place|clearing|village|town|city|dock|docks|port|ship|deck|corridor|swamp|chapel|temple|courtyard|valley|camp|hold|keep|cellar|cemetery|graveyard|sea|shore";

const SILENCE_PATTERNS: RegExp[] = [
  // "(un)naturally / eerily / deathly / utterly … silent|quiet|still" — these
  // intensified forms are inherently scene-level atmosphere.
  /\b(?:un)?naturally\s+(?:silent|quiet|still|hushed)\b/i,
  /\b(?:eerily|deathly|preternaturally|strangely|unnervingly|utterly|completely|absolutely|oppressively)\s+(?:silent|quiet|still|hushed)\b/i,
  // "(utter|complete|total|absolute|dead|profound|sudden) silence"
  /\b(?:utter|complete|total|absolute|dead|profound|sudden|ringing|crushing|unnatural)\s+silence\b/i,
  // "silence so heavy / silence fell / descended / swallowed / deepened"
  /\bsilence\s+(?:so\s+)?(?:heavy|thick|deep|profound|complete|total|absolute)\b/i,
  /\bsilence\s+(?:swallow|fell|descend|settl|deepen|press)/i,
  // Scene/place goes silent: "the harbor goes completely silent", "everything falls still"
  new RegExp(`\\b(?:everything|the\\s+(?:${ENV}))\\s+(?:goes|grows|falls?|fell|turns?|is|has\\s+gone|becomes?|became|went)\\s+(?:completely\\s+|utterly\\s+|eerily\\s+|unnaturally\\s+|dead\\s+|deathly\\s+|suddenly\\s+|wholly\\s+)?(?:silent|quiet|still)\\b`, "i"),
  // "no waves, no gulls" / "no sound, no …" — explicit absence of expected sound.
  /\bno\s+(?:waves?|gulls?|sound|sounds|noise|voices?|wind|birds?|chatter)\b[^.!?\n]{0,40}\bno\s+(?:waves?|gulls?|sound|sounds|noise|voices?|wind|birds?|chatter|distant)\b/i,
  // "all sound vanished/died/stopped/ceased", "not a single sound"
  /\ball\s+sound\s+(?:has\s+)?(?:vanished|died|stopped|ceased|drained|fled|gone)\b/i,
  /\bnot\s+a\s+(?:single\s+)?(?:sound|whisper|breath|noise)\b/i,
];

export function detectAmbianceMood(narrative: string): AmbianceMood | null {
  if (!narrative) return null;
  return SILENCE_PATTERNS.some(re => re.test(narrative)) ? "silent" : null;
}
