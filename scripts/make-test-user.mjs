// One-off: create a confirmed test auth user for the automated playthrough.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = 'qa-playtest@dndlegends.test';
const password = 'PlaytestPass!2026';

// Remove any prior test user so the run is clean/idempotent.
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const existing = list?.users?.find(u => u.email === email);
if (existing) {
  await admin.auth.admin.deleteUser(existing.id);
  console.log('Deleted prior test user', existing.id);
}

const { data, error } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
});
if (error) { console.error('CREATE FAILED:', error.message); process.exit(1); }
console.log('Created user:', data.user.id, email, '/', password);
