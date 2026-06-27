// One-off QA helper: provision 2 more roster characters (to reach an 8-player
// "Brigade") for the qa-playtest account. Idempotent per name.
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

const chars = [
  {
    name: 'Aldwin Stormcaller', race: 'Human', class: 'Wizard', sex: 'male', alignment: 'Lawful Neutral',
    strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10,
    hp: 7, max_hp: 7, skill_proficiencies: ['Arcana', 'Investigation'],
    inventory: { gold: 60, items: ['Spellbook', 'Potion of Healing'], weapons: ['Quarterstaff'] },
    cantrips_known: ['Fire Bolt', 'Mage Hand', 'Light'],
    spells_prepared: ['Magic Missile', 'Shield', 'Sleep', 'Detect Magic'], spell_slots_used: {},
  },
  {
    name: 'Dame Seraphina', race: 'Human', class: 'Paladin', sex: 'female', alignment: 'Lawful Good',
    strength: 15, dexterity: 10, constitution: 13, intelligence: 8, wisdom: 12, charisma: 14,
    hp: 11, max_hp: 11, skill_proficiencies: ['Persuasion', 'Religion'],
    inventory: { gold: 90, items: ['Holy Symbol', 'Potion of Healing'], weapons: ['Longsword', 'Chain Mail', 'Shield'] },
    cantrips_known: [], spells_prepared: [], spell_slots_used: {},
  },
];

for (const c of chars) {
  await admin.from('characters').delete().eq('user_id', user.id).eq('name', c.name);
  const { data, error } = await admin.from('characters').insert({
    user_id: user.id, level: 1, xp: 0, status_effects: [], title: null,
    background: `QA test character — ${c.class}.`, portrait_url: null, campaign_id: null, ...c,
  }).select('id,name').single();
  if (error) { console.error('INSERT FAILED', c.name, error.message); process.exit(1); }
  console.log('Created', data.name, data.id);
}
console.log('Done.');
