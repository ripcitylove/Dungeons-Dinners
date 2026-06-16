-- campaign_enemies: backs the enemy combat system (⚔ Combat tab, /api/enemies/*).
-- The app shipped expecting this table but it is missing from the live DB
-- (PostgREST PGRST205 on every campaign load). Schema reconstructed from
-- src/app/api/enemies/generate/route.ts and the CampaignEnemy type.
--
-- RLS NOTE: this project's sibling tables (campaigns, campaign_characters) are
-- readable by the bare anon role, and the enemies API routes
-- (generate/route.ts, state/route.ts) write using the ANON key with no user
-- session. So RLS is intentionally left DISABLED here to match that posture and
-- keep the anon-key routes working. Do NOT enable RLS without also adding anon
-- insert/update/select policies, or combat will silently break.

create table if not exists public.campaign_enemies (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns(id) on delete cascade,
  name           text not null,
  enemy_type     text not null default 'Humanoid',
  cr             numeric not null default 1,
  max_hp         integer not null default 10,
  ac             integer not null default 12,
  attack_bonus   integer not null default 2,
  damage_dice    text not null default '1d6',
  abilities      text[] not null default '{}',
  xp_value       integer not null default 50,
  loot           jsonb not null default '{}'::jsonb,
  portrait_emoji text not null default '👹',
  portrait_url   text,
  status_effects text[] not null default '{}',
  condition      text not null default 'healthy',
  is_defeated    boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists campaign_enemies_campaign_id_idx
  on public.campaign_enemies (campaign_id);
create index if not exists campaign_enemies_active_idx
  on public.campaign_enemies (campaign_id, is_defeated, created_at);
