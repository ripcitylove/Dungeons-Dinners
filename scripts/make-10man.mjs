// One-off QA helper: assemble a full 10-player ("Legion") campaign for the
// qa-playtest account. Adds 2 new roster characters (a Druid + a Bard — they bring
// damaging cantrips of different dice for cantrip-die testing), creates a fresh
// campaign, and seats all 10 roster characters into it with clean level-1 state.
// Idempotent: re-running makes a new campaign and re-seats; the 2 added chars are
// delete-by-name first.
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

// ── 1. Add the 2 characters that take the roster from 8 → 10 ──────────────────
const newChars = [
  {
    name: 'Faylen Mossheart', race: 'Half-Elf', class: 'Druid', sex: 'female', alignment: 'Neutral Good',
    strength: 10, dexterity: 13, constitution: 14, intelligence: 12, wisdom: 15, charisma: 8,
    hp: 9, max_hp: 9, skill_proficiencies: ['Nature', 'Medicine'],
    inventory: { gold: 45, items: ['Druidic Focus', 'Potion of Healing'], weapons: ['Quarterstaff', 'Leather'] },
    cantrips_known: ['Thorn Whip', 'Produce Flame', 'Druidcraft'],
    spells_prepared: ['Cure Wounds', 'Entangle', 'Thunderwave'], spell_slots_used: {},
  },
  {
    name: 'Tibbs Merrylute', race: 'Gnome', class: 'Bard', sex: 'male', alignment: 'Chaotic Good',
    strength: 8, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 15,
    hp: 9, max_hp: 9, skill_proficiencies: ['Performance', 'Persuasion'],
    inventory: { gold: 80, items: ['Lute', 'Potion of Healing'], weapons: ['Rapier', 'Leather'] },
    cantrips_known: ['Vicious Mockery', 'Mage Hand'],
    spells_prepared: ['Healing Word', 'Dissonant Whispers', 'Faerie Fire', 'Charm Person'], spell_slots_used: {},
  },
];

for (const c of newChars) {
  await admin.from('characters').delete().eq('user_id', user.id).eq('name', c.name);
  const { error } = await admin.from('characters').insert({
    user_id: user.id, level: 1, xp: 0, status_effects: [], title: null,
    background: `QA test character — ${c.class}.`, portrait_url: null, campaign_id: null, ...c,
  });
  if (error) { console.error('INSERT FAILED', c.name, error.message); process.exit(1); }
  console.log('Created', c.name);
}

// ── 2. Gather the full roster (should now be 10) ──────────────────────────────
const { data: roster } = await admin.from('characters').select('*').eq('user_id', user.id).order('created_at');
if (!roster || roster.length < 10) { console.error(`Expected >=10 roster chars, found ${roster?.length ?? 0}`); process.exit(1); }
// Take the 10 we want: the 8 original Brigade + the 2 new. Pick by name to be safe.
const wanted = [
  'Brother Aldric', 'Kira Stormblade', 'Grok Ironhide', 'Lyra Quickfingers', 'Thornwick Greenleaf',
  'Sorcha Emberkin', 'Aldwin Stormcaller', 'Dame Seraphina', 'Faylen Mossheart', 'Tibbs Merrylute',
];
const party = wanted.map(n => roster.find(r => r.name === n)).filter(Boolean);
if (party.length !== 10) { console.error('Could not assemble exactly 10 named party members; got', party.map(p => p.name)); process.exit(1); }

// ── 3. Create the campaign ────────────────────────────────────────────────────
const { data: camp, error: campErr } = await admin.from('campaigns').insert([{
  title: 'The Legion of the Sundered Banner',
  description: 'Ten heroes answer the muster as a dead empire stirs beneath the frontier. A QA test campaign for a full ten-player party.',
  user_id: user.id,
}]).select().single();
if (campErr || !camp) { console.error('Campaign creation failed', campErr?.message); process.exit(1); }

// ── 4. Seat all 10: set characters.campaign_id + upsert clean campaign_characters ──
for (const c of party) {
  await admin.from('characters').update({ campaign_id: camp.id }).eq('id', c.id);
  await admin.from('campaign_characters').upsert({
    campaign_id: camp.id, character_id: c.id, user_id: user.id,
    hp: c.max_hp, max_hp: c.max_hp, xp: 0, level: 1,
    inventory: c.inventory ?? { gold: 50, weapons: [], items: [] },
    spell_slots_used: {}, status_effects: [],
    cantrips_known: c.cantrips_known ?? [], spells_prepared: c.spells_prepared ?? [],
  }, { onConflict: 'campaign_id,character_id' });
}

// ── 5. Party leader = first seated character ──────────────────────────────────
await admin.from('campaigns').update({ party_leader_id: party[0].id }).eq('id', camp.id);

console.log('\n10-player campaign ready:');
console.log('  id:', camp.id);
console.log('  party:', party.map(p => `${p.name} (${p.class})`).join(', '));
console.log('  leader:', party[0].name);
