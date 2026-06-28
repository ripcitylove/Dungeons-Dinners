// QA helper: a scene built around an UNNAMED hooded figure, so we can drive an
// identity reveal and confirm the NPC card renames (keeping its portrait) instead
// of spawning a duplicate.
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
  name: 'Vesper Quill', race: 'Human', class: 'Rogue', sex: 'female', alignment: 'Neutral Good',
  strength: 10, dexterity: 16, constitution: 12, intelligence: 13, wisdom: 12, charisma: 14,
  hp: 20, max_hp: 20, skill_proficiencies: ['Stealth', 'Investigation', 'Persuasion'],
  inventory: { gold: 50, items: ['Thieves Tools', 'Potion of Healing'], weapons: ['Dagger', 'Shortbow', 'Leather'] },
  cantrips_known: [], spells_prepared: [], spell_slots_used: {},
};

await admin.from('characters').delete().eq('user_id', user.id).eq('name', hero.name);
const { data: ch, error: chErr } = await admin.from('characters').insert({
  user_id: user.id, level: 3, xp: 900, status_effects: [], title: null,
  background: 'QA test — a rogue meeting a secretive informant.', portrait_url: null, campaign_id: null, ...hero,
}).select('id,max_hp,inventory,cantrips_known,spells_prepared,spell_slots_used').single();
if (chErr) { console.error('INSERT FAILED', chErr.message); process.exit(1); }

const { data: camp, error: campErr } = await admin.from('campaigns').insert([{
  title: 'The Informant',
  description: 'In a lantern-lit back alley, Vesper meets a HOODED STRANGER — a cloaked figure with a scar through one brow, here to trade information. The stranger is wary but will readily give their name the moment Vesper asks directly. A QA test for an NPC identity reveal.',
  user_id: user.id,
}]).select().single();
if (campErr || !camp) { console.error('Campaign creation failed', campErr?.message); process.exit(1); }

await admin.from('characters').update({ campaign_id: camp.id }).eq('id', ch.id);
await admin.from('campaign_characters').upsert({
  campaign_id: camp.id, character_id: ch.id, user_id: user.id,
  hp: ch.max_hp, max_hp: ch.max_hp, xp: 900, level: 3,
  inventory: ch.inventory, spell_slots_used: {}, status_effects: [],
  cantrips_known: ch.cantrips_known, spells_prepared: ch.spells_prepared,
}, { onConflict: 'campaign_id,character_id' });
await admin.from('campaigns').update({ party_leader_id: ch.id }).eq('id', camp.id);

console.log('\nIdentity-reveal test campaign ready:');
console.log('  id:', camp.id);
