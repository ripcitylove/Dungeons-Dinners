// Backfill: sync campaign_characters.level / max_hp / xp to the canonical
// characters.* values for EVERY campaign. The client merge always sources these
// three from the global `characters` table, so the per-campaign copies were never
// updated after creation and drifted stale (e.g. a Lvl-2 cleric whose CC row still
// read Lvl 1). Stale-but-inert today, but a latent trap for any future code path
// that reads the CC level. This makes both tables internally consistent.
//
// Run: node scripts/backfill-cc-level-sync.mjs        (dry run, prints diffs)
//      node scripts/backfill-cc-level-sync.mjs --apply (writes the fixes)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes('--apply');

const { data: ccRows, error } = await a
  .from('campaign_characters')
  .select('id, campaign_id, character_id, level, max_hp, xp');
if (error) { console.error(error); process.exit(1); }

// Pull every referenced character once.
const charIds = [...new Set((ccRows || []).map(r => r.character_id))];
const { data: chars } = await a.from('characters').select('id, name, level, max_hp, xp').in('id', charIds);
const byId = Object.fromEntries((chars || []).map(c => [c.id, c]));

let drift = 0, fixed = 0;
for (const cc of ccRows || []) {
  const c = byId[cc.character_id];
  if (!c) continue;
  const patch = {};
  if (cc.level  !== c.level)  patch.level  = c.level;
  if (cc.max_hp !== c.max_hp) patch.max_hp = c.max_hp;
  if (cc.xp     !== c.xp)     patch.xp     = c.xp;
  if (Object.keys(patch).length === 0) continue;
  drift++;
  console.log(`${c.name} (cc ${cc.id.slice(0, 8)} camp ${cc.campaign_id.slice(0, 8)}): ` +
    `lvl ${cc.level}->${c.level}  maxhp ${cc.max_hp}->${c.max_hp}  xp ${cc.xp}->${c.xp}`);
  if (APPLY) {
    const { error: uerr } = await a.from('campaign_characters').update(patch).eq('id', cc.id);
    if (uerr) console.error('  update failed:', uerr.message);
    else fixed++;
  }
}
console.log(`\n${drift} drifted CC row(s)${APPLY ? `, ${fixed} fixed` : ' (dry run — pass --apply to write)'}.`);
