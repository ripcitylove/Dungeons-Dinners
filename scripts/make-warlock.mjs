// One-off QA helper: a SOLO Warlock who is OUT of Pact Magic slots, to verify the
// DM still lets cantrips (Eldritch Blast) be cast at-will when no slots remain.
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
  name: 'Grimm Hollowvoice', race: 'Tiefling', class: 'Warlock', sex: 'male', alignment: 'Chaotic Neutral',
  strength: 9, dexterity: 14, constitution: 14, intelligence: 11, wisdom: 12, charisma: 15,
  hp: 9, max_hp: 9, skill_proficiencies: ['Arcana', 'Deception'],
  inventory: { gold: 40, items: ['Arcane Focus', 'Potion of Healing'], weapons: ['Dagger', 'Leather'] },
  cantrips_known: ['Eldritch Blast', 'Chill Touch', 'Prestidigitation'],
  spells_prepared: ['Hex', 'Hellish Rebuke'],
  // OUT of pact slots: Warlock L1 has one 1st-level pact slot — mark it spent.
  spell_slots_used: { 1: 1 },
};

await admin.from('characters').delete().eq('user_id', user.id).eq('name', hero.name);
const { data: ch, error: chErr } = await admin.from('characters').insert({
  user_id: user.id, level: 1, xp: 0, status_effects: [], title: null,
  background: 'QA test — a warlock who has burned his pact slot.', portrait_url: null, campaign_id: null, ...hero,
}).select('id,max_hp,inventory,cantrips_known,spells_prepared,spell_slots_used').single();
if (chErr) { console.error('INSERT FAILED', chErr.message); process.exit(1); }

const { data: camp, error: campErr } = await admin.from('campaigns').insert([{
  title: 'The Spent Pact',
  description: 'A warlock walks a cursed moor, his pact magic exhausted. A QA test for cantrip-at-will rules.',
  user_id: user.id,
}]).select().single();
if (campErr || !camp) { console.error('Campaign creation failed', campErr?.message); process.exit(1); }

await admin.from('characters').update({ campaign_id: camp.id }).eq('id', ch.id);
await admin.from('campaign_characters').upsert({
  campaign_id: camp.id, character_id: ch.id, user_id: user.id,
  hp: ch.max_hp, max_hp: ch.max_hp, xp: 0, level: 1,
  inventory: ch.inventory, spell_slots_used: hero.spell_slots_used, status_effects: [],
  cantrips_known: ch.cantrips_known, spells_prepared: ch.spells_prepared,
}, { onConflict: 'campaign_id,character_id' });
await admin.from('campaigns').update({ party_leader_id: ch.id }).eq('id', camp.id);

console.log('\nSolo Warlock (out of pact slots) ready:');
console.log('  id:', camp.id);
console.log('  hero:', hero.name, '— cantrips:', hero.cantrips_known.join(', '), '| slots_used:', JSON.stringify(hero.spell_slots_used));
