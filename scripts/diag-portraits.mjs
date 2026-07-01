// Diagnostic: reconcile characters.portrait_url against actual storage files.
// Read-only. Reveals why portraits appear to be "remade" mid-campaign.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. All characters
const { data: chars, error } = await supabase
  .from("characters")
  .select("id, name, race, class, portrait_url, campaign_id, user_id, created_at")
  .order("created_at", { ascending: false });
if (error) { console.error("DB error:", error.message); process.exit(1); }

// 2. All storage files in the portraits bucket (paginate)
const files = new Set();
let offset = 0;
for (;;) {
  const { data, error: e } = await supabase.storage.from("portraits").list("", { limit: 100, offset });
  if (e) { console.error("storage list error:", e.message); break; }
  if (!data?.length) break;
  data.forEach(f => files.add(f.name));
  if (data.length < 100) break;
  offset += 100;
}
console.log(`Characters: ${chars.length}   Storage files: ${files.size}\n`);

let nullUrl = 0, urlButNoFile = 0, fileButNullUrl = 0, urlMismatch = 0, ok = 0;
const problems = [];
for (const c of chars) {
  const expected = `${c.id}.png`;
  const hasFile = files.has(expected);
  const url = c.portrait_url;
  if (!url) {
    nullUrl++;
    if (hasFile) { fileButNullUrl++; problems.push(`FILE-BUT-NULL-URL  ${c.name} (${c.id}) — storage has ${expected} but portrait_url is null → will REGEN a new face`); }
    else problems.push(`NULL-NO-FILE       ${c.name} (${c.id}) — no url, no file → needs first-time gen`);
    continue;
  }
  if (!url.includes(c.id)) { urlMismatch++; problems.push(`URL-MISMATCH       ${c.name} (${c.id}) — portrait_url does not contain its own id: ${url}`); continue; }
  if (!hasFile) { urlButNoFile++; problems.push(`URL-BUT-NO-FILE    ${c.name} (${c.id}) — portrait_url set but ${expected} missing in storage → cache MISS → REGEN new face`); continue; }
  ok++;
}

console.log(`OK (url+file agree):        ${ok}`);
console.log(`portrait_url null:          ${nullUrl}  (of those, file exists but url null: ${fileButNullUrl})`);
console.log(`url set but file missing:   ${urlButNoFile}`);
console.log(`url points to wrong id:     ${urlMismatch}\n`);
if (problems.length) { console.log("Problems:\n" + problems.slice(0, 60).join("\n")); if (problems.length > 60) console.log(`… +${problems.length - 60} more`); }
else console.log("No mismatches — every character's url and storage file agree.");
