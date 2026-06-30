// Quest-item classification + the duplicate-quest-item filter. Run:
//   node scripts/test-quest-classify.ts
import { isQuestItemType, isOneTimeUseType } from "../src/lib/lootData.ts";

let pass = 0; const fails: string[] = [];
const t = (name: string, got: unknown, want: unknown) => {
  if (got === want) pass++; else fails.push(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

// ── isQuestItemType ──
for (const ty of ["key", "lore", "quest", "plot", "objective", "quest_item", "KEY", "Lore"]) t(`quest: ${ty}`, isQuestItemType(ty), true);
for (const ty of ["potion", "weapon", "armor", "trinket", "valuable", "wondrous", "scroll", "consumable"]) t(`normal: ${ty}`, isQuestItemType(ty), false);
t("quest: undefined", isQuestItemType(undefined), false);
t("quest: null", isQuestItemType(null), false);

// ── isOneTimeUseType ──
t("one-time: key", isOneTimeUseType("key"), true);
t("one-time: Key (case)", isOneTimeUseType("Key"), true);
t("one-time: lore (no)", isOneTimeUseType("lore"), false);
t("one-time: quest (no)", isOneTimeUseType("quest"), false);
t("one-time: potion (no)", isOneTimeUseType("potion"), false);
t("one-time: undefined", isOneTimeUseType(undefined), false);

// ── Duplicate-quest filter (mirrors applyStateChange) — quest items already held
//    are NOT re-added; normal items still stack. ──
type Meta = Record<string, { type?: string }>;
function filterGained(heldItems: string[], meta: Meta, gained: string[]): string[] {
  const heldByLower = new Map(heldItems.map(i => [i.trim().toLowerCase(), i] as const));
  return gained.filter(g => {
    const heldName = heldByLower.get(g.trim().toLowerCase());
    if (!heldName) return true;
    return !isQuestItemType(meta[heldName]?.type);
  });
}
const eqArr = (name: string, got: string[], want: string[]) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
eqArr("held quest key re-award → blocked",
  filterGained(["Brass Key"], { "Brass Key": { type: "key" } }, ["Brass Key"]), []);
eqArr("held quest key re-award (case-insensitive) → blocked",
  filterGained(["Ancient Map"], { "Ancient Map": { type: "lore" } }, ["ancient map"]), []);
eqArr("held normal potion re-award → still stacks",
  filterGained(["Potion of Healing"], { "Potion of Healing": { type: "potion" } }, ["Potion of Healing"]), ["Potion of Healing"]);
eqArr("new quest item not yet held → added",
  filterGained([], {}, ["Brass Key"]), ["Brass Key"]);
eqArr("single DM grant of two of a new normal item → both kept",
  filterGained([], {}, ["Torch", "Torch"]), ["Torch", "Torch"]);
eqArr("mix: new potion kept, held quest key blocked",
  filterGained(["Brass Key"], { "Brass Key": { type: "key" } }, ["Potion of Healing", "Brass Key"]), ["Potion of Healing"]);

console.log(`\nQuest classify + dedup battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Quest items classified + de-duped; normal items still stack.");
