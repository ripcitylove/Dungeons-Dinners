import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')];}));
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const { data: list } = await a.auth.admin.listUsers({ page:1, perPage:1000 });
const user = list.users.find(u => u.email === 'qa-playtest@dndlegends.test');
const hero = { name: 'Thorin Ironside', race: 'Dwarf', class: 'Fighter', sex:'male', alignment:'Lawful Good',
  strength: 16, dexterity: 12, constitution: 16, intelligence: 9, wisdom: 12, charisma: 10,
  hp: 28, max_hp: 28, skill_proficiencies:['Athletics','Intimidation'],
  inventory:{ gold:30, items:['Torch'], weapons:['Battleaxe','Shield','Chain Mail'] },
  cantrips_known:[], spells_prepared:[], spell_slots_used:{} };
await a.from('characters').delete().eq('user_id', user.id).eq('name', hero.name);
const { data: ch } = await a.from('characters').insert({ user_id:user.id, level:3, xp:900, status_effects:[], title:null, background:'QA — combat onset test.', portrait_url:null, campaign_id:null, ...hero }).select('id,max_hp,inventory').single();
const { data: camp } = await a.from('campaigns').insert([{ title:'The Ambush', description:'Thorin walks a narrow canyon trail. A band of GOBLIN RAIDERS is about to ambush him from the rocks the instant he advances — combat should erupt immediately on the first move. A QA test for enemy cards appearing the moment combat engages.', user_id:user.id }]).select().single();
await a.from('characters').update({ campaign_id: camp.id }).eq('id', ch.id);
await a.from('campaign_characters').upsert({ campaign_id:camp.id, character_id:ch.id, user_id:user.id, hp:ch.max_hp, max_hp:ch.max_hp, xp:900, level:3, inventory:ch.inventory, spell_slots_used:{}, status_effects:[], cantrips_known:[], spells_prepared:[] }, { onConflict:'campaign_id,character_id' });
await a.from('campaigns').update({ party_leader_id: ch.id }).eq('id', camp.id);
console.log('Combat test campaign:', camp.id);
