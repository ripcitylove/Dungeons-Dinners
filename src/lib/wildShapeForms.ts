// Wild-Shape beast catalog. Each entry has an emoji used to swap the druid's
// portrait while transformed, the CR cap that gates whether a level-X druid
// can take this form, and the speed types it has (so the engine can also
// gate L2-3 forms with flying/swimming).
//
// The map is intentionally focused — it covers the canonical PHB beasts a
// druid will actually pick. For names the DM invents that don't match any
// entry, we fall back to a generic 🐾 paw emoji. The form name itself
// (lowercased) is the lookup key; the matcher does substring matching too.

export type WildShapeForm = {
  emoji:        string;
  crLabel:      string;  // "1/8", "1/4", "1/2", "1", etc.
  crValue:      number;  // numeric CR for ordering
  hasFly:       boolean;
  hasSwim:      boolean;
  hp:           string;  // dice formula for the beast's typical HP
  display?:     string;  // pretty display name; defaults to the catalog key
};

/**
 * Built-in static portrait for a Wild Shape form. Pre-generated images are
 * stored under /public/wildshape/<key>.png so the portrait swap is instant
 * with no live image-generation API call. The catalog generator script
 * (scripts/generate-wildshape-images.mjs) creates these.
 */
export function wildShapeImagePath(key: string): string {
  return `/wildshape/${key}.png`;
}

// Stored lowercase. Substring matching handled by resolveWildShapeForm below.
export const WILD_SHAPE_FORMS: Record<string, WildShapeForm> = {
  // CR 0 — universally allowed
  rat:           { emoji: "🐀", crLabel: "0",   crValue: 0,    hasFly: false, hasSwim: false, hp: "1" },
  weasel:        { emoji: "🐀", crLabel: "0",   crValue: 0,    hasFly: false, hasSwim: false, hp: "1" },
  frog:          { emoji: "🐸", crLabel: "0",   crValue: 0,    hasFly: false, hasSwim: true,  hp: "1" },
  spider:        { emoji: "🕷️", crLabel: "0",   crValue: 0,    hasFly: false, hasSwim: false, hp: "1" },
  // CR 1/8 — L2-3 allowed (no fly/swim variants)
  hawk:          { emoji: "🦅", crLabel: "1/8", crValue: 0.125, hasFly: true,  hasSwim: false, hp: "1" },
  owl:           { emoji: "🦉", crLabel: "1/8", crValue: 0.125, hasFly: true,  hasSwim: false, hp: "3" },
  raven:         { emoji: "🦅", crLabel: "1/8", crValue: 0.125, hasFly: true,  hasSwim: false, hp: "1" },
  bat:           { emoji: "🦇", crLabel: "0",   crValue: 0,     hasFly: true,  hasSwim: false, hp: "1" },
  cat:           { emoji: "🐈", crLabel: "0",   crValue: 0,     hasFly: false, hasSwim: false, hp: "2" },
  dog:           { emoji: "🐕", crLabel: "1/8", crValue: 0.125, hasFly: false, hasSwim: false, hp: "5" },
  mastiff:       { emoji: "🐕", crLabel: "1/8", crValue: 0.125, hasFly: false, hasSwim: false, hp: "5" },
  goat:          { emoji: "🐐", crLabel: "0",   crValue: 0,     hasFly: false, hasSwim: false, hp: "4" },
  // CR 1/4 — L2-3 CAP
  wolf:          { emoji: "🐺", crLabel: "1/4", crValue: 0.25, hasFly: false, hasSwim: false, hp: "11" },
  pony:          { emoji: "🐴", crLabel: "1/8", crValue: 0.125, hasFly: false, hasSwim: false, hp: "11" },
  panther:       { emoji: "🐆", crLabel: "1/4", crValue: 0.25, hasFly: false, hasSwim: false, hp: "13" },
  giant_rat:     { emoji: "🐀", crLabel: "1/8", crValue: 0.125, hasFly: false, hasSwim: false, hp: "7" },
  boar:          { emoji: "🐗", crLabel: "1/4", crValue: 0.25, hasFly: false, hasSwim: false, hp: "11" },
  giant_weasel:  { emoji: "🐀", crLabel: "1/8", crValue: 0.125, hasFly: false, hasSwim: false, hp: "9" },
  // CR 1/2 — L4-7 CAP (swimming allowed)
  ape:           { emoji: "🦍", crLabel: "1/2", crValue: 0.5,  hasFly: false, hasSwim: false, hp: "19" },
  crocodile:     { emoji: "🐊", crLabel: "1/2", crValue: 0.5,  hasFly: false, hasSwim: true,  hp: "19" },
  warhorse:      { emoji: "🐎", crLabel: "1/2", crValue: 0.5,  hasFly: false, hasSwim: false, hp: "19" },
  riding_horse:  { emoji: "🐎", crLabel: "1/4", crValue: 0.25, hasFly: false, hasSwim: false, hp: "13" },
  black_bear:    { emoji: "🐻", crLabel: "1/2", crValue: 0.5,  hasFly: false, hasSwim: false, hp: "19" },
  giant_goat:    { emoji: "🐐", crLabel: "1/2", crValue: 0.5,  hasFly: false, hasSwim: false, hp: "19" },
  giant_wolf_spider: { emoji: "🕷️", crLabel: "1/4", crValue: 0.25, hasFly: false, hasSwim: false, hp: "11" },
  // CR 1 — L8+ CAP (flying allowed)
  bear:          { emoji: "🐻", crLabel: "1",   crValue: 1,    hasFly: false, hasSwim: false, hp: "34", display: "Brown Bear" },
  brown_bear:    { emoji: "🐻", crLabel: "1",   crValue: 1,    hasFly: false, hasSwim: false, hp: "34" },
  dire_wolf:     { emoji: "🐺", crLabel: "1",   crValue: 1,    hasFly: false, hasSwim: false, hp: "37" },
  giant_eagle:   { emoji: "🦅", crLabel: "1",   crValue: 1,    hasFly: true,  hasSwim: false, hp: "26" },
  giant_owl:     { emoji: "🦉", crLabel: "1/4", crValue: 0.25, hasFly: true,  hasSwim: false, hp: "19" },
  giant_octopus: { emoji: "🐙", crLabel: "1",   crValue: 1,    hasFly: false, hasSwim: true,  hp: "52" },
  // Fallback families
  eagle:         { emoji: "🦅", crLabel: "0",   crValue: 0,    hasFly: true,  hasSwim: false, hp: "3" },
  falcon:        { emoji: "🦅", crLabel: "0",   crValue: 0,    hasFly: true,  hasSwim: false, hp: "1" },
  tiger:         { emoji: "🐯", crLabel: "1",   crValue: 1,    hasFly: false, hasSwim: false, hp: "37" },
  lion:          { emoji: "🦁", crLabel: "1",   crValue: 1,    hasFly: false, hasSwim: false, hp: "26" },
  snake:         { emoji: "🐍", crLabel: "1/8", crValue: 0.125, hasFly: false, hasSwim: true,  hp: "2" },
  viper:         { emoji: "🐍", crLabel: "1/8", crValue: 0.125, hasFly: false, hasSwim: true,  hp: "5" },
  fish:          { emoji: "🐟", crLabel: "0",   crValue: 0,    hasFly: false, hasSwim: true,  hp: "1" },
  octopus:       { emoji: "🐙", crLabel: "1/4", crValue: 0.25, hasFly: false, hasSwim: true,  hp: "3" },
  shark:         { emoji: "🦈", crLabel: "1/2", crValue: 0.5,  hasFly: false, hasSwim: true,  hp: "22" },
};

const ENTRIES = Object.entries(WILD_SHAPE_FORMS);

/**
 * Resolve a free-text beast name (e.g. "brown bear", "Brown Bear", "Big Brown Bear")
 * to the catalog entry. Tries exact match first, then substring match on the
 * longest catalog key. Returns null if no match (caller can use the 🐾 fallback).
 */
export function resolveWildShapeForm(input: string): { key: string; form: WildShapeForm } | null {
  const lc = input.toLowerCase().replace(/[_-]/g, " ").trim();
  if (!lc) return null;
  // Exact match (catalog stores keys with underscores; check the underscore form too)
  const direct = WILD_SHAPE_FORMS[lc.replace(/\s+/g, "_")] ?? WILD_SHAPE_FORMS[lc];
  if (direct) return { key: lc.replace(/\s+/g, "_"), form: direct };
  // Substring match, longest first
  const matches = ENTRIES
    .filter(([k]) => lc.includes(k.replace(/_/g, " ")))
    .sort((a, b) => b[0].length - a[0].length);
  if (matches.length > 0) {
    const [key, form] = matches[0];
    return { key, form };
  }
  return null;
}

export const FALLBACK_BEAST_EMOJI = "🐾";

/** Max CR cap for a druid at the given level (numeric for comparisons). */
export function wildShapeCrCap(level: number): number {
  if (level >= 8) return 1;
  if (level >= 4) return 0.5;
  return 0.25;
}

/** Whether a druid at the given level can take a form with the given speeds. */
export function wildShapeSpeedAllowed(level: number, hasFly: boolean, hasSwim: boolean): boolean {
  if (level >= 8) return true;
  if (level >= 4) return !hasFly;     // L4-7: swimming OK, no flying
  return !hasFly && !hasSwim;          // L2-3: no fly, no swim
}
