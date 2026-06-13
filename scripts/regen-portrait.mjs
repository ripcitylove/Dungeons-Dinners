// Usage: node scripts/regen-portrait.mjs "Character Name"
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Parse .env.local
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const nameArg = process.argv[2];
if (!nameArg) { console.error("Usage: node scripts/regen-portrait.mjs \"Character Name\""); process.exit(1); }

const { data: chars, error } = await supabase
  .from("characters")
  .select("id, name, race, class, sex, title, alignment, background")
  .ilike("name", `%${nameArg}%`);

if (error) { console.error("DB error:", error.message); process.exit(1); }
if (!chars?.length) { console.error("No character found matching:", nameArg); process.exit(1); }

const char = chars[0];
console.log(`Found: ${char.name} (${char.race} ${char.class}) — id: ${char.id}`);

// Delete cached portrait from storage
await supabase.storage.from("portraits").remove([`${char.id}.png`]);
await supabase.from("characters").update({ portrait_url: null }).eq("id", char.id);
console.log("Cleared cached portrait.");

// Call the generate-portrait API
const baseUrl = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const res = await fetch(`${baseUrl}/api/generate-portrait`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ race: char.race, cls: char.class, sex: char.sex ?? "male", charId: char.id, title: char.title, alignment: char.alignment, background: char.background, force: true }),
});

const json = await res.json();
if (json.url) {
  console.log("New portrait URL:", json.url);
} else {
  console.error("Generation failed:", json);
}
