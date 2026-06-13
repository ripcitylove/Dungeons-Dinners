// Regression test for the class-abilities audio + Wild Shape portrait system.
//
// Verifies:
//  - The Wild Shape beast catalog and resolver exist and key beasts resolve.
//  - The class-ability sound module has voices for the major resource keys
//    and form-specific WILDSHAPE_VOICES for the common animals.
//  - The campaign page imports the new modules, plays a sound on ability use,
//    parses the [WILDSHAPE:Name:Form] tag streamed back from the DM, updates
//    status_effects with the "Wild Shape: X" entry, broadcasts character_sync,
//    and morphs the party-card portrait to the beast emoji.
//  - The DM prompt instructs the model to emit [WILDSHAPE:...] tags.
//  - stripSystemLeaks scrubs the [WILDSHAPE:...] tag so it never reaches chat.

import { readFileSync, existsSync } from "node:fs";
// existsSync is used both for the lib files and for the on-disk beast portraits below.

let pass = 0, fail = 0;
function check(name, cond, hint) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else      { console.log(`✗ ${name}${hint ? " — " + hint : ""}`); fail++; }
}

// ── Files exist ──────────────────────────────────────────────────────────────
check("classAbilitySounds.ts exists", existsSync("src/lib/classAbilitySounds.ts"));
check("wildShapeForms.ts exists",      existsSync("src/lib/wildShapeForms.ts"));

const sounds   = readFileSync("src/lib/classAbilitySounds.ts", "utf8");
const forms    = readFileSync("src/lib/wildShapeForms.ts",     "utf8");
const page     = readFileSync("src/app/campaign/[id]/page.tsx", "utf8");
const chat     = readFileSync("src/app/api/chat/route.ts",      "utf8");
const features = readFileSync("src/lib/classFeatures.ts",       "utf8");

// ── classAbilitySounds.ts: voices wired for the major class resources ───────
check("sounds module exports playAbilitySound",                 /export function playAbilitySound/.test(sounds));
check("sounds VOICES map has rage",                              /rage:\s*\(/.test(sounds));
check("sounds VOICES map has bardic_inspiration",                /bardic_inspiration:\s*\(/.test(sounds));
check("sounds VOICES map has channel_divinity",                  /channel_divinity:\s*\(/.test(sounds));
check("sounds VOICES map has wild_shape",                        /wild_shape:\s*\(/.test(sounds));
check("sounds VOICES map has second_wind",                       /second_wind:\s*\(/.test(sounds));
check("sounds VOICES map has action_surge",                      /action_surge:\s*\(/.test(sounds));
check("sounds VOICES map has ki",                                /ki:\s*\(/.test(sounds));
check("sounds VOICES map has lay_on_hands",                      /lay_on_hands:\s*\(/.test(sounds));
check("sounds VOICES map has hunters_mark",                      /hunters_mark:\s*\(/.test(sounds));
check("sounds VOICES map has cunning_action",                    /cunning_action:\s*\(/.test(sounds));
check("sounds VOICES map has sorcery_points",                    /sorcery_points:\s*\(/.test(sounds));
check("sounds VOICES map has arcane_recovery",                   /arcane_recovery:\s*\(/.test(sounds));
check("sounds VOICES map has eldritch_invocations",              /eldritch_invocations:\s*\(/.test(sounds));
check("sounds WILDSHAPE_VOICES includes bear voice",             /WILDSHAPE_VOICES[\s\S]*?bear/i.test(sounds));
check("sounds WILDSHAPE_VOICES includes wolf voice",             /WILDSHAPE_VOICES[\s\S]*?wolf/i.test(sounds));
check("sounds WILDSHAPE_VOICES includes raptor (eagle/hawk) voice", /WILDSHAPE_VOICES[\s\S]*?(?:eagle|hawk|falcon)/i.test(sounds));

// ── wildShapeForms.ts: catalog + resolver ────────────────────────────────────
check("forms exports WILD_SHAPE_FORMS map",                /export const WILD_SHAPE_FORMS/.test(forms));
check("forms exports resolveWildShapeForm function",       /export function resolveWildShapeForm/.test(forms));
check("forms exports FALLBACK_BEAST_EMOJI",                /export const FALLBACK_BEAST_EMOJI/.test(forms));
check("forms exports wildShapeCrCap helper",               /export function wildShapeCrCap/.test(forms));
check("forms catalog has bear with bear emoji",            /bear:[\s\S]*?emoji:\s*"🐻"/.test(forms));
check("forms catalog has wolf with wolf emoji",            /wolf:[\s\S]*?emoji:\s*"🐺"/.test(forms));
check("forms catalog has giant_eagle with eagle emoji",    /giant_eagle:[\s\S]*?emoji:\s*"🦅"/.test(forms));
check("forms catalog has panther with leopard emoji",      /panther:[\s\S]*?emoji:\s*"🐆"/.test(forms));

// ── classFeatures.ts: Revert no-cost sub-ability ────────────────────────────
check("Wild Shape Revert sub-ability still defined cost: 0", /name:\s*"Revert"[\s\S]*?cost:\s*0/.test(features));

// ── page.tsx: imports + plumbing ────────────────────────────────────────────
check("page imports classAbilitySounds",          /from\s+"\.\.\/\.\.\/\.\.\/lib\/classAbilitySounds"/.test(page));
check("page imports wildShapeForms (resolver)",   /from\s+"\.\.\/\.\.\/\.\.\/lib\/wildShapeForms"/.test(page)
                                                  && /resolveWildShapeForm/.test(page));
check("page imports FALLBACK_BEAST_EMOJI",        /FALLBACK_BEAST_EMOJI/.test(page));
check("page has parseWildShapeTag helper",        /function parseWildShapeTag/.test(page));
check("parseWildShapeTag handles revert variants", /revert\|reverts\?\|human\|natural\|normal/.test(page));
check("handleUseClassAbility plays sound",        /playAbilitySound\(resourceKey\)/.test(page));
check("stripSystemLeaks scrubs [WILDSHAPE:...]",  /\\\[WILDSHAPE:\[\^\\\]\]\+\\\]/.test(page));

// ── page.tsx: Fast WILD SHAPE detection block ───────────────────────────────
check("Fast WILD SHAPE detection iterates campaignPartyRef", /for \(const partyMember of campaignPartyRef\.current\)[\s\S]{0,300}?parseWildShapeTag\(full, firstName\)/.test(page));
check("revert path filters Wild Shape entries out",          /currentStatuses\.filter\(s => !\/\^Wild Shape:\/i\.test\(s\)\)/.test(page));
check("transform path stores 'Wild Shape: <Form>' status",   /const tagged = `Wild Shape: \$\{formOrRevert\}`/.test(page));
check("transform path calls playAbilitySound with form hint", /playAbilitySound\("wild_shape", formOrRevert\)/.test(page));
check("WILD SHAPE handler broadcasts character_sync",        /event:\s*"character_sync"[\s\S]{0,400}?status_effects/.test(page));
check("WILD SHAPE handler persists via charWriteRef",        /charWriteRef\.current\?\.\(partyMember\.id, \{ status_effects/.test(page));

// ── page.tsx: party-card portrait morphs to beast ───────────────────────────
check("party-card resolves wildShapeStatus from status_effects",
      /const wildShapeStatus = \(char\.status_effects \?\? \[\]\)\.find\(s => \/\^Wild Shape:\/i\.test\(s\)\)/.test(page));
check("party-card renders wildShapeEmoji when set",
      /\{wildShapeEmoji \?/.test(page));

// ── page.tsx: character-sheet portrait morphs too ───────────────────────────
check("character-sheet portrait morphs on Wild Shape",
      /character\.status_effects \?\? \[\][\s\S]{0,200}?Wild Shape:[\s\S]{0,400}?resolveWildShapeForm/.test(page));

// ── chat/route.ts: DM prompt emits the tag ───────────────────────────────────
check("DM prompt has 'WILD SHAPE TAGS' instruction block",   /WILD SHAPE TAGS/.test(chat));
check("DM prompt example shows a beast-form WILDSHAPE tag",   /\[WILDSHAPE:[^\]:]+:(?:bear|brown bear|wolf|giant eagle|panther)\]/.test(chat));
check("DM prompt example shows revert tag",                   /\[WILDSHAPE:[^\]]+:revert\]/.test(chat));
check("DM prompt forbids tag emission when [NO-TURN] was used", /Do NOT emit the tag if you REJECTED a Wild Shape attempt with \[NO-TURN\]/.test(chat));
check("Wild Shape rules block reminds DM to emit the tag",    /emit a \[WILDSHAPE:FirstName:Form\] tag/.test(chat));

// ── Non-Druid class-ability tags (RAGE / INSPIRED / MARK) ───────────────────
check("page has parseRageTag helper",                              /function parseRageTag/.test(page));
check("page has parseInspiredTag helper",                          /function parseInspiredTag/.test(page));
check("page has parseMarkTag helper",                              /function parseMarkTag/.test(page));
check("stripSystemLeaks scrubs [RAGE:...]",                        /\\\[RAGE:\[\^\\\]\]\+\\\]/.test(page));
check("stripSystemLeaks scrubs [INSPIRED:...]",                    /\\\[INSPIRED:\[\^\\\]\]\+\\\]/.test(page));
check("stripSystemLeaks scrubs [MARK:...]",                        /\\\[MARK:\[\^\\\]\]\+\\\]/.test(page));
check("Fast persistent-buff handler iterates the party",           /Fast persistent-buff detection[\s\S]{0,400}?for \(const partyMember of campaignPartyRef\.current\)/.test(page));
check("RAGE off path removes the 'Raging' status",                 /rage === "off"[\s\S]{0,200}?filter\(s => s !== "Raging"\)/.test(page));
check("INSPIRED off path strips Inspired entries",                 /inspired[\s\S]{0,200}?filter\(s => !\/\^Inspired\/\.test\(s\)\)/.test(page));
check("INSPIRED grant path stores die size in status",             /Inspired \(\$\{inspired\.die\}\)/.test(page));
check("MARK off path strips Hunter's Mark entries",                /mark[\s\S]{0,300}?filter\(s => !\/\^Hunter's Mark\/i\.test\(s\)\)/.test(page));
check("MARK grant path stores target name in status",              /Hunter's Mark: \$\{mark\.target\}/.test(page));

// ── DM prompt: instructions for the new tags ────────────────────────────────
check("DM prompt has CLASS-ABILITY STATE TAGS block",              /CLASS-ABILITY STATE TAGS/.test(chat));
check("DM prompt instructs RAGE off tag emission",                 /\[RAGE:FirstName:off\]/.test(chat));
check("DM prompt instructs INSPIRED die-size tag emission",        /\[INSPIRED:RecipientFirstName:dX\]/.test(chat));
check("DM prompt cites the per-level Bardic die sizes (d6/d8/d10/d12)", /d6 \(Bard L1[\s\S]*?d12 \(L15/.test(chat));
check("DM prompt instructs MARK target tag emission",              /\[MARK:RangerFirstName:TargetName\]/.test(chat));
check("DM prompt forbids ability tags after [NO-TURN]",            /Do NOT emit any of these tags after a \[NO-TURN\] refusal/.test(chat));

// ── handleUseClassAbility wiring ─────────────────────────────────────────────
check("handleUseClassAbility triggers ability-flash overlay",      /triggerAbilityFlash\(char\.id, resDef\.color\)/.test(page));
check("handleUseClassAbility applies 'Raging' on rage activation",  /resourceKey === "rage"[\s\S]{0,200}?newStatusEffects = \[\.\.\.newStatusEffects, "Raging"\]/.test(page));
check("handleUseClassAbility strips 'Raging' on rage end",          /resourceKey === "rage"[\s\S]{0,300}?filter\(s => s !== "Raging"\)/.test(page));
check("handleUseClassAbility broadcasts status_effects with the rest", /status_effects: newStatusEffects/.test(page));

// ── Barbarian Rage now has an End Rage sub-ability (cost 0) ────────────────
check("Rage has 'End Rage' sub-ability (cost 0)",
      /name:\s*"End Rage"[\s\S]*?cost:\s*0/.test(features));

// ── Ability-flash visual overlay ────────────────────────────────────────────
check("abilityFlash state defined",                                /const \[abilityFlash, setAbilityFlash\] = useState</.test(page));
check("abilityFlash render checks charId match",                   /abilityFlash && abilityFlash\.charId === char\.id/.test(page));
check("abilityFlash uses CSS @keyframes abilityFlash",             /animation:\s*"abilityFlash/.test(page));

const globalsCss = readFileSync("src/app/globals.css", "utf8");
check("globals.css defines @keyframes abilityFlash",               /@keyframes abilityFlash\s*\{[\s\S]*?opacity:/.test(globalsCss));

// ── Pre-generated Wild Shape portrait images on disk ────────────────────────
const REQUIRED_BEASTS = ["bear", "brown_bear", "wolf", "dire_wolf", "giant_eagle", "owl", "panther", "tiger", "lion", "snake", "boar", "rat", "frog", "spider", "hawk", "cat"];
for (const k of REQUIRED_BEASTS) {
  check(`pre-generated portrait exists: ${k}.png`, existsSync(`public/wildshape/${k}.png`));
}
check("wildShapeForms.ts exports wildShapeImagePath helper", /export function wildShapeImagePath/.test(forms));
check("page imports wildShapeImagePath",                    /wildShapeImagePath/.test(page));
check("party-card portrait uses wildShapeImagePath",         /wildShapeImagePath\(wildShapeResolved\.key\)/.test(page));
check("portrait img falls back to emoji on onError",         /onError={e => \{[\s\S]{0,200}?nextElementSibling/.test(page));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
