import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')];}));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const user = list.users.find(u => u.email === 'qa-playtest@dndlegends.test');
const hero = { name: 'Kael Brightwood', race: 'Human', class: 'Fighter', sex: 'male', alignment: 'Lawful Good',
  strength: 16, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 11,
  hp: 24, max_hp: 24, skill_proficiencies: ['Athletics','Perception'],
  inventory: { gold: 40, items: ['Rope','Potion of Healing'], weapons: ['Longsword','Shield','Chain Mail'] },
  cantrips_known: [], spells_prepared: [], spell_slots_used: {} };
await admin.from('characters').delete().eq('user_id', user.id).eq('name', hero.name);
const { data: ch } = await admin.from('characters').insert({ user_id: user.id, level: 3, xp: 900, status_effects: [], title: null, background: 'QA — a fighter freeing a captive.', portrait_url: null, campaign_id: null, ...hero }).select('id,max_hp,inventory,cantrips_known,spells_prepared,spell_slots_used').single();
const { data: camp } = await admin.from('campaigns').insert([{ title: 'The Cellar', description: 'Kael breaks into a smugglers cellar and finds a BOUND WOMAN tied to a chair — a captive, gagged, who will give her name (Sera) the moment she is freed and asked. A QA test for correcting a placeholder NPC card to a real name.', user_id: user.id }]).select().single();
await admin.from('characters').update({ campaign_id: camp.id }).eq('id', ch.id);
await admin.from('campaign_characters').upsert({ campaign_id: camp.id, character_id: ch.id, user_id: user.id, hp: ch.max_hp, max_hp: ch.max_hp, xp: 900, level: 3, inventory: ch.inventory, spell_slots_used: {}, status_effects: [], cantrips_known: [], spells_prepared: [] }, { onConflict: 'campaign_id,character_id' });
await admin.from('campaigns').update({ party_leader_id: ch.id }).eq('id', camp.id);
console.log('Captive test campaign:', camp.id);
