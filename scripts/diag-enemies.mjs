import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false}});
const { data, error } = await sb.from("campaign_enemies").select("campaign_id, name, condition, is_defeated, created_at").order("created_at",{ascending:false}).limit(300);
if (error) { console.error(error.message); process.exit(1); }
console.log(`Total enemy rows (recent 300): ${data.length}\n`);
// naming: how many have "#N" or numeric suffix
const suffixed = data.filter(e => /#\s*\d+|\s\d+$/.test(e.name));
console.log(`Names with a #N / numeric suffix: ${suffixed.length}`);
console.log("Sample names:", [...new Set(data.map(e=>e.name))].slice(0,25).join(" | "), "\n");
// STUCK: not is_defeated but condition critical (badly hurt, still on board a long time)
const active = data.filter(e => !e.is_defeated);
const byCond = {};
for (const e of active) byCond[e.condition] = (byCond[e.condition]??0)+1;
console.log("Active (on-screen) enemies by condition:", JSON.stringify(byCond));
const critical = active.filter(e => e.condition === "critical" || e.condition === "defeated");
console.log(`\nActive but condition critical/defeated (likely stuck-dead): ${critical.length}`);
critical.slice(0,30).forEach(e => console.log(`  ${e.condition.padEnd(9)} is_defeated=${e.is_defeated}  ${e.name}  (camp ${e.campaign_id.slice(0,8)})`));
