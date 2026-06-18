// Character-name rules.
//
// The deterministic DM tag parsers that must capture an UNKNOWN recipient name —
// the economy tags ([GOLD:Name:±N], [LOOT:Name:..], [WEAPON:Name:..],
// [ITEM-LOST:Name:..]) and the spell tag ([SPELL:Caster:key]) — only accept the
// charset [A-Za-z'\- ] in a name. A name with a digit or symbol (e.g. "Aria2",
// "Randiezel123") silently fails to match those tags, so gold/loot never lands and
// spell slots are never deducted for that character. Rather than loosen every
// parser (and still mis-speak "Aria2" in TTS), we constrain names at creation to
// exactly that charset. Keeps the whole pipeline consistent and predictable.

export const NAME_MAX = 40;

// Letters, spaces, apostrophes, hyphens; must begin with a letter.
const NAME_RE = /^[A-Za-z][A-Za-z' -]*$/;

/**
 * Strip characters a character name may not contain, as the user types. Keeps
 * letters, spaces, apostrophes, and hyphens; collapses repeated spaces; drops any
 * leading space/apostrophe/hyphen so the name always begins with a letter. Returns
 * the cleaned value (capped at NAME_MAX). Use in the input's onChange so invalid
 * characters simply never appear.
 */
export function sanitizeCharacterName(raw: string): string {
  return raw
    .replace(/[^A-Za-z' -]/g, "")   // drop digits / symbols / other scripts
    .replace(/\s{2,}/g, " ")        // collapse runs of spaces
    .replace(/^[\s'-]+/, "")        // must start with a letter
    .slice(0, NAME_MAX);
}

/**
 * Validate a (typically trimmed) character name. Returns a human-readable error
 * string when invalid, or null when the name is acceptable. Use on step-advance /
 * save to catch empties and pasted-then-untouched values.
 */
export function characterNameError(name: string): string | null {
  const n = (name ?? "").trim();
  if (!n) return "Your character needs a name.";
  if (n.length > NAME_MAX) return `Names must be ${NAME_MAX} characters or fewer.`;
  if (!NAME_RE.test(n)) return "Names can use letters, spaces, apostrophes, and hyphens only — no numbers or symbols.";
  return null;
}
