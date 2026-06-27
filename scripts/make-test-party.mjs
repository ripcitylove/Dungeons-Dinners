// One-off QA helper: provision 3 extra roster characters (with gold + items so
// inventory/currency/trading can be exercised) for the qa-playtest account, so a
// full 6-player campaign can be assembled. Idempotent per name.
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
    name: 'Lyra Quickfingers', race: 'Halfling', class: 'Rogue', sex: 'female', alignment: 'Chaotic Neutral',
    strength: 10, dexterity: 15, constitution: 14, intelligence: 12, wisdom: 13, charisma: 8,
    hp: 10, max_hp: 10, skill_proficiencies: ['Stealth', 'Sleight of Hand'],
    inventory: { gold: 75, items: ["Thieves' Tools", 'Potion of Healing'], weapons: ['Shortsword', 'Leather'] },
    cantrips_known: [], spells_prepared: [], spell_slots_used: {},
  },
  {
    name: 'Thornwick Greenleaf', race: 'Elf', class: 'Ranger', sex: 'male', alignment: 'Neutral Good',
    strength: 13, dexterity: 15, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10,
    hp: 12, max_hp: 12, skill_proficiencies: ['Survival', 'Perception'],
    inventory: { gold: 40, items: ['Hunting Trap', 'Rations'], weapons: ['Longbow', 'Leather'] },
    cantrips_known: [], spells_prepared: [], spell_slots_used: {},
  },
  {
    name: 'Sorcha Emberkin', race: 'Tiefling', class: 'Sorcerer', sex: 'female', alignment: 'Chaotic Good',
    strength: 8, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 15,
    hp: 8, max_hp: 8, skill_proficiencies: ['Arcana', 'Persuasion'],
    inventory: { gold: 120, items: ['Spell Component Pouch', 'Potion of Healing'], weapons: ['Dagger'] },
    cantrips_known: ['Fire Bolt', 'Light', 'Prestidigitation', 'Mage Hand'],
    spells_prepared: ['Magic Missile', 'Shield'], spell_slots_used: {},
  },
];

for (const c of chars) {
  // delete prior same-name char for this user (idempotent)
  await admin.from('characters').delete().eq('user_id', user.id).eq('name', c.name);
  const { data, error } = await admin.from('characters').insert({
    user_id: user.id, level: 1, xp: 0, status_effects: [], title: null,
    background: `QA test character — ${c.class}.`, portrait_url: null, campaign_id: null, ...c,
  }).select('id,name').single();
  if (error) { console.error('INSERT FAILED', c.name, error.message); process.exit(1); }
  console.log('Created', data.name, data.id);
}
console.log('Done.');
