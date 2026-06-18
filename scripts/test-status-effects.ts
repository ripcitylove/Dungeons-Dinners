// Status-effect registry battery. Every canonical effect name the DM prompt and
// the chat-state extraction prompt are allowed to emit MUST resolve to a badge in
// STATUS_EFFECTS (so its icon shows on the card), and common spell-name variants
// must alias onto the right effect. The reported gap: Guidance (and other player
// buffs) had no icon. Run: node scripts/test-status-effects.ts
import { STATUS_EFFECTS, resolveStatusEffect, parseStatusEffect, getCardEffectGlow, dedupeStatusEffects } from "../src/lib/statusEffects.ts";
import { SPELL_META } from "../src/lib/classAbilitySounds.ts";

let pass = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) pass++; else fails.push(`  ✗ ${name}`); };
const eq = (name: string, got: unknown, want: unknown) => {
  if (got === want) pass++; else fails.push(`  ✗ ${name}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
};

// ── The reported bug: Guidance must be a real buff badge with an icon ──
const g = resolveStatusEffect("Guidance");
ok("Guidance resolves", g !== null);
eq("Guidance is a buff", g?.type, "buff");
ok("Guidance has an icon", !!g?.icon && g.icon.length > 0);
eq("Guidance shows +1d4", g?.bonusLabel, "+1d4");
ok("Guidance (1 minute) parses+resolves", resolveStatusEffect(parseStatusEffect("Guidance (1 minute)").name) !== null);
ok("Guidance drives a card glow", getCardEffectGlow(["Guidance"]) !== null);

// Shillelagh is a buff with an icon (the reported gap)
const sh = resolveStatusEffect("Shillelagh");
ok("Shillelagh resolves", sh !== null);
eq("Shillelagh is a buff", sh?.type, "buff");
ok("Shillelagh has an icon", !!sh?.icon && sh.icon.length > 0);
ok("shillelagh (lowercase) resolves", resolveStatusEffect("shillelagh") === STATUS_EFFECTS["Shillelagh"]);

// ── Sync guard: EVERY canonical name in the DM + extraction prompts must resolve. ──
// Keep this list identical to chat/route.ts and chat-state/route.ts.
const CANONICAL = [
  // Conditions
  "Unconscious","Dead","Poisoned","Blinded","Frightened","Paralyzed","Stunned","Prone","Charmed","Exhausted","Restrained","Petrified","Deafened","Grappled","Invisible","Incapacitated","Burning",
  // Buffs
  "Blessed","Hasted","Raging","Inspired","Shielded","Concentrating","Flying","Regenerating","Wild Shaped","Bardic Inspiration","Death Ward","Sanctuary","Guidance","Shillelagh","Resistance","Aided","Heroism","Shield of Faith","Protected","Barkskin","Longstrider","Enlarged",
  // Debuffs
  "Cursed","Hexed","Marked","Silenced","Weakened","Hunter's Mark","Baned","Slowed","Reduced",
  // Diseases
  "Diseased","Infected","Fevered","Sewer Plague",
  // Enchantments
  "Attuned","Empowered","Enchanted","Mage Armor","Mirror Image",
];
for (const nm of CANONICAL) {
  const eff = resolveStatusEffect(nm);
  ok(`canonical "${nm}" resolves to a badge with an icon`, !!eff && !!eff.icon);
}

// ── Alias guard: the LLM often writes the spell name, not the effect form. ──
const ALIASES: [string, string][] = [
  ["Bless", "Blessed"], ["bless", "Blessed"],
  ["Haste", "Hasted"], ["Rage", "Raging"],
  ["Bane", "Baned"], ["Slow", "Slowed"],
  ["Enlarge", "Enlarged"], ["Reduce", "Reduced"],
  ["Aid", "Aided"], ["Hex", "Hexed"], ["Curse", "Cursed"],
  ["Guided", "Guidance"], ["guidance", "Guidance"],
  ["Invisibility", "Invisible"], ["Concentration", "Concentrating"],
  ["Protection from Evil and Good", "Protected"], ["Protection", "Protected"],
  ["Wild Shape", "Wild Shaped"], ["on fire", "Burning"],
];
for (const [variant, canonical] of ALIASES) {
  const got = resolveStatusEffect(variant);
  ok(`alias "${variant}" → ${canonical}`, got === STATUS_EFFECTS[canonical]);
}

// ── Truly unknown effect → null (card renders the generic ✦ fallback icon) ──
eq("unknown effect resolves null", resolveStatusEffect("Bedazzled"), null);
eq("empty resolves null", resolveStatusEffect(""), null);

// ── Case-insensitive exact key match ──
ok("lowercase 'poisoned' resolves", resolveStatusEffect("poisoned") === STATUS_EFFECTS["Poisoned"]);

// ── Sync guard: every bonus-granting spell maps to a REAL status effect, so the
//    [SPELL:...] tag reliably puts a buff icon on the recipient's card. ──
for (const [key, meta] of Object.entries(SPELL_META)) {
  if (!meta.buff) continue;
  ok(`SPELL_META.${key} buff "${meta.buff}" resolves to an effect`, resolveStatusEffect(meta.buff) !== null);
}
// The spells the user named (and their kin) are wired to grant a buff.
for (const k of ["guidance", "shillelagh", "bless", "shield_of_faith", "mage_armor", "heroism", "resistance", "barkskin", "aid"]) {
  ok(`spell "${k}" grants a buff`, !!SPELL_META[k]?.buff);
}

// ── No same-effect stacking: dedupeStatusEffects collapses by NAME (the Vi-with-
//    two-Guidance bug: "Guidance" + "Guidance (1 minute)" are one effect). ──
eq("dup by name collapses", dedupeStatusEffects(["Guidance", "Guidance (1 minute)"]).length, 1);
eq("dup keeps the duration-bearing entry", dedupeStatusEffects(["Guidance", "Guidance (1 minute)"])[0], "Guidance (1 minute)");
eq("case-insensitive dup collapses", dedupeStatusEffects(["Blessed", "blessed"]).length, 1);
eq("distinct effects preserved", dedupeStatusEffects(["Guidance", "Shillelagh", "Blessed"]).length, 3);
eq("order preserved", dedupeStatusEffects(["Shillelagh", "Guidance", "Shillelagh"]).join(","), "Shillelagh,Guidance");
eq("empty/blank dropped", dedupeStatusEffects(["", "  ", "Guidance"]).length, 1);

console.log(`\nStatus-effect registry battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Every canonical effect (incl. Guidance) resolves to an icon; spell-name aliases map correctly.");
