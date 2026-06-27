// One-off QA helper: provision a SINGLE-player campaign for the qa-playtest
// account — a lone Wizard, so solo turn-flow, combat scaling, the enemy phase,
// attack-cantrip dice (Fire Bolt 1d10), save-cantrip handling (Acid Splash),
// cantrip slots, and leveled slot consumption (Magic Missile) can all be exercised
// with one character. Idempotent: re-running makes a fresh campaign + re-seats.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const user = list?.users?.find(u => u.email === 'qa-playtest@dndlegends.test');
if (!user) { console.error('qa-playtest user not found'); process.exit(1); }

const hero = {
  name: 'Solonius Vane', race: 'Human', class: 'Wizard', sex: 'male', alignment: 'Neutral Good',
  strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10,
  hp: 7, max_hp: 7, skill_proficiencies: ['Arcana', 'Investigation'],
  inventory: { gold: 55, items: ['Spellbook', 'Potion of Healing'], weapons: ['Quarterstaff'] },
  cantrips_known: ['Fire Bolt', 'Acid Splash', 'Light'],
  spells_prepared: ['Magic Missile', 'Shield', 'Sleep'], spell_slots_used: {},
};

await admin.from('characters').delete().eq('user_id', user.id).eq('name', hero.name);
const { data: ch, error: chErr } = await admin.from('characters').insert({
  user_id: user.id, level: 1, xp: 0, status_effects: [], title: null,
  background: 'QA test character — solo Wizard.', portrait_url: null, campaign_id: null, ...hero,
}).select('id,max_hp,inventory,cantrips_known,spells_prepared').single();
if (chErr) { console.error('INSERT FAILED', chErr.message); process.exit(1); }

const { data: camp, error: campErr } = await admin.from('campaigns').insert([{
  title: 'The Lone Lantern',
  description: 'A solitary mage walks a haunted frontier road. A QA test campaign for a single-player party.',
  user_id: user.id,
}]).select().single();
if (campErr || !camp) { console.error('Campaign creation failed', campErr?.message); process.exit(1); }

await admin.from('characters').update({ campaign_id: camp.id }).eq('id', ch.id);
await admin.from('campaign_characters').upsert({
  campaign_id: camp.id, character_id: ch.id, user_id: user.id,
  hp: ch.max_hp, max_hp: ch.max_hp, xp: 0, level: 1,
  inventory: ch.inventory, spell_slots_used: {}, status_effects: [],
  cantrips_known: ch.cantrips_known, spells_prepared: ch.spells_prepared,
}, { onConflict: 'campaign_id,character_id' });
await admin.from('campaigns').update({ party_leader_id: ch.id }).eq('id', camp.id);

console.log('\nSingle-player campaign ready:');
console.log('  id:', camp.id);
console.log('  hero:', hero.name, '(Lvl 1 Wizard) — cantrips:', hero.cantrips_known.join(', '));
