// Proactively give EVERY existing active enemy a persisted portrait, so all current
// campaigns are fixed immediately — not only after a player reloads and regenerates.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')];}));
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const BASE = process.env.BACKFILL_BASE || 'http://localhost:3000';

const { data: enemies } = await a.from('campaign_enemies').select('id,enemy_type,cr,portrait_url,is_defeated').is('portrait_url', null).eq('is_defeated', false);
console.log(`Active enemies missing a portrait: ${enemies.length}`);
const cache = new Map(); // enemy_type -> url (avoid duplicate endpoint calls)
let fixed = 0, failed = 0;
for (const e of enemies) {
  try {
    let url = cache.get(e.enemy_type);
    if (!url) {
      const res = await fetch(`${BASE}/api/generate-enemy-portrait`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ enemyType: e.enemy_type, cr: e.cr }) });
      const j = await res.json();
      url = j.portraitUrl;
      if (url) cache.set(e.enemy_type, url);
    }
    if (url) { await a.from('campaign_enemies').update({ portrait_url: url }).eq('id', e.id); fixed++; }
    else { failed++; console.warn('  no portrait for', e.enemy_type); }
  } catch (err) { failed++; console.warn('  error', e.enemy_type, err.message); }
}
console.log(`\nBackfilled ${fixed} enemies (${cache.size} distinct types). Failed: ${failed}.`);
