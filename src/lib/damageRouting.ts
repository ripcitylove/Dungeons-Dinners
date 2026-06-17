// Damage routing — pure, dependency-free logic for interpreting the DM's
// [HP:FirstName:±N] tags during combat. Extracted from the campaign page so it
// can be unit-tested in isolation (see scripts/test-damage-routing.ts).
//
// The central hazard this guards against: the DM model is told to emit
// [HP:FirstName:-N] ONLY when the named PLAYER loses N HP, never when the player
// DEALS N damage to an enemy. When the model violates that and tags the attacker
// instead of the target, the client would silently drain the attacker's own HP
// from their successful hit. damageTagShouldBeSuppressed() rejects such tags.

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Parses [HP:FirstName:N] tags from DM text for the named character. Returns HP delta (negative = damage, positive = healing). */
export function parseHpTag(text: string, firstName: string): number {
  const n = esc(firstName);
  const re = new RegExp(`\\[HP:${n}:([+-]?\\d+)\\]`, "gi");
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) total += parseInt(m[1], 10);
  return total;
}

// Verbs that mark the named character as the ATTACKER ("Aria slashes the orc").
// The -ing/-ed forms that double as D&D damage-type adjectives (slashing,
// piercing, fire) are omitted — they describe damage type ("9 slashing"), not an
// action, and would false-positive on legit "Aria takes 9 slashing" tags.
const ATTACK = "deal|deals|dealing|dealt|strike|strikes|striking|struck|hit|hits|hitting|attack|attacks|attacking|attacked|land|lands|landing|landed|cut|cuts|cutting|slash|slashes|slashed|bite|bites|biting|cast|casts|casting|fires|firing|fired|shoot|shoots|shooting|shot|swing|swings|swinging|swung|stab|stabs|stabbing|stabbed|pierce|pierces|pierced|smash|smashes|smashed|crush|crushes|crushed|connect|connects|connecting|connected|tear|tears|tearing|tore|rip|rips|ripping|ripped|bash|bashes|bashed|punch|punches|punching|punched|kick|kicks|kicking|kicked|loose|looses|loosing|loosed|hurl|hurls|hurling|hurled|throw|throws|throwing|threw|launch|launches|launching|launched|unleash|unleashes|unleashing|unleashed|blast|blasts|blasting|blasted|cleave|cleaves|cleaved|cleaving|hack|hacks|hacked|hacking|hew|hews|hewed|hewing|chop|chops|chopped|chopping|rend|rends|rent|rending|skewer|skewers|skewered|skewering|maul|mauls|mauled|mauling|gore|gores|gored|goring|impale|impales|impaled|impaling|sunder|sunders|sundered|batter|batters|battered|battering|hammer|hammers|hammered|hammering|carve|carves|carved|carving|jab|jabs|jabbed|jabbing|thrust|thrusts|thrusting|whack|whacks|whacked|clobber|clobbers|clobbered|pummel|pummels|pummeled|pound|pounds|pounded|smite|smites|smote|zap|zaps|zapped|scorch|scorches|scorched|burn|burns|burned|drain|drains|drained";
// Verbs that mark a character as RECEIVING damage as the verb's subject
// ("Aria takes 9", "the goblin suffers 5").
const RECEIVER = "takes?|took|taking|suffers?|suffered|suffering|loses?|lost|losing|drops?|dropped|dropping|absorbs?|absorbed|absorbing|recoils?|recoiled|recoiling|reels?|reeled|reeling|crumples?|crumpled|crumpling|staggers?|staggered|staggering|collapses?|collapsed|collapsing|buckles?|buckled|winces?|winced|heals?|healed|healing|regains?|regained|regaining|recovers?|recovered|recovering";
// Verbs an ENEMY uses to attack the player ("the orc smashes Aria").
const ENEMY_ATTACK = "hits?|strikes?|catches|caught|cuts?|stabs?|attacks?|claws?|fangs?|bites?|smashes?|crushes?|grabs?|seizes?|wraps?|grapples?|lashes?|lashed|lashing|whips?|whipped|whipping|impales?|impaled|impaling|gores?|gored|goring|rakes?|raked|raking|slams?|slammed|slamming|connects?|connected|connecting|drains?|drained|draining|burns?|burned|scorches?|scorched|freezes?|froze|shocks?|shocked|zaps?|zapped|pummels?|pummeled|pounds?|pounded|mauls?|mauled|skewers?|skewered|gashes?|gashed|batters?|battered|hammers?|hammered|blasts?|blasted";
// Past-participles/adjectives that, after a copula, mean the player got hit
// ("Aria is hit", "Tiegan was struck down", "she gets knocked back").
const PASSIVE_HIT = "hit|struck|caught|cut|stabbed|smashed|crushed|hammered|battered|wounded|injured|slammed|clawed|bitten|gored|impaled|knocked|hurt|slashed|pierced|mauled|downed|dropped|felled|blasted|burned|scorched|seared|frozen|shocked|electrocuted|poisoned|drained|grazed|gashed|bloodied|skewered|pummeled|thrown|sent|flung";

/**
 * Returns true when a negative [HP:FirstName:-N] tag should be REJECTED because
 * the narrative plainly shows the named player as the ATTACKER (dealing the
 * damage) rather than the receiver. Healing (delta >= 0) is never suppressed.
 *
 * Strategy: establish "is the player receiving damage here?" FIRST, using the
 * receiver verb's actual subject — not mere proximity — so that an enemy subject
 * ("the goblin takes 9") near the player's name doesn't get misread as the player
 * receiving. Only if the player is NOT receiving and IS the attacker do we
 * suppress. When unsure, we apply (a missed misroute is rarer and less harmful
 * than nullifying real damage).
 */
export function damageTagShouldBeSuppressed(text: string, firstName: string, delta: number): boolean {
  if (delta >= 0) return false; // only validate damage (negative), leave healing alone
  const n = esc(firstName);

  // ── 1) Is the player the RECEIVER? If so, never suppress. ──

  // 1a. Player is the near subject of a receiver verb: "Aria takes 8",
  //     "Aria, reeling, suffers 5". Tight (≤2 filler words) so a separate enemy
  //     subject can't borrow the player's nearby name.
  const playerSubjectReceiver = new RegExp(`\\b${n}\\b[,\\s]+(?:[\\w'-]+[,\\s]+){0,2}(?:${RECEIVER})\\b`, "i");
  // 1b. Enemy strikes the player: "the orc smashes Aria", "claws rake Aria".
  const enemyHitsPlayer = new RegExp(`\\b(?:${ENEMY_ATTACK})\\b[^.!?\\n]{0,30}\\b${n}\\b`, "i");
  // 1c. Passive voice: "Aria is hit", "Tiegan was struck", "she gets knocked back".
  const passiveReceiver = new RegExp(`\\b${n}\\b\\s+(?:is|was|are|were|gets?|got|been|being|feels?|felt|ends? up)\\s+(?:[\\w'-]+\\s+){0,2}(?:${PASSIVE_HIT})\\b`, "i");
  // 1d. Carried subject: a receiver verb follows the player's name and is NOT
  //     owned by a fresh enemy subject ("the goblin takes"). Catches
  //     "Aria slashes the orc but takes 6 in return".
  const enemyOwnsReceiver  = new RegExp(`\\b(?:the|a|an|that|this|its|their|his|her)\\s+[\\w'-]+\\s+(?:${RECEIVER})\\b`, "i");
  const nameBeforeReceiver = new RegExp(`\\b${n}\\b[^.!?\\n]{0,60}\\b(?:${RECEIVER})\\b`, "i");
  const playerCarriedReceiver = nameBeforeReceiver.test(text) && !enemyOwnsReceiver.test(text);

  if (playerSubjectReceiver.test(text) || enemyHitsPlayer.test(text) || passiveReceiver.test(text) || playerCarriedReceiver) {
    return false;
  }

  // ── 2) Is the player plainly the ATTACKER? Then suppress the misrouted tag. ──
  const playerAttacker       = new RegExp(`\\b${n}\\b[^.!?\\n]{0,30}\\b(?:${ATTACK})\\b`, "i");
  const playerWeaponAttacker = new RegExp(`\\b${n}'?s\\s+[\\w'-]+\\s+(?:${ATTACK})\\b`, "i");
  if (playerAttacker.test(text) || playerWeaponAttacker.test(text)) return true;

  // ── 3) Unsure → apply (don't nullify possibly-real damage). ──
  return false;
}
