// QA helper: a SOLO bard in a bustling tavern — a social scene that naturally
// produces (a) long multi-sentence DM narration (to test audio-locked text
// pacing) and (b) multiple named NPC cards (to test duplicate-card resolution).
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
  name: 'Lyra Quickwit', race: 'Half-Elf', class: 'Bard', sex: 'female', alignment: 'Chaotic Good',
  strength: 10, dexterity: 14, constitution: 12, intelligence: 12, wisdom: 10, charisma: 16,
  hp: 18, max_hp: 18, skill_proficiencies: ['Persuasion', 'Performance', 'Insight'],
  inventory: { gold: 60, items: ['Lute', 'Potion of Healing'], weapons: ['Rapier', 'Leather'] },
  cantrips_known: ['Vicious Mockery', 'Mage Hand'],
  spells_prepared: ['Healing Word', 'Charm Person', 'Faerie Fire'],
  spell_slots_used: {},
};

await admin.from('characters').delete().eq('user_id', user.id).eq('name', hero.name);
const { data: ch, error: chErr } = await admin.from('characters').insert({
  user_id: user.id, level: 3, xp: 900, status_effects: [], title: null,
  background: 'QA test — a traveling bard seeking stories and coin.', portrait_url: null, campaign_id: null, ...hero,
}).select('id,max_hp,inventory,cantrips_known,spells_prepared,spell_slots_used').single();
if (chErr) { console.error('INSERT FAILED', chErr.message); process.exit(1); }

const { data: camp, error: campErr } = await admin.from('campaigns').insert([{
  title: 'The Brass Lantern',
  description: 'Lyra steps into the Brass Lantern, a crowded tavern on a market road. The innkeeper Bram Hollowcask works the bar, the bard Sella tunes a fiddle by the hearth, and a hooded stranger nurses ale in the corner. A QA test for rich social narration and NPC presence.',
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

console.log('\nSolo Bard (tavern social scene) ready:');
console.log('  id:', camp.id);
console.log('  hero:', hero.name);
