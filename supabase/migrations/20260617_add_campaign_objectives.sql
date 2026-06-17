-- campaigns.objectives: the campaign "quest spine" for the Objectives Tracker.
-- An ordered JSONB array of milestones generated at campaign creation:
--   [{ "id": "obj-1", "text": "Reach the harbor of Saltmere", "status": "active" },
--    { "id": "obj-2", "text": "Investigate the cracked monument", "status": "hidden" }, ...]
-- status ∈ 'hidden' | 'active' | 'done'. The DM reveals (hidden->active) and
-- completes (active->done) objectives in order via [OBJECTIVE-NEW:n] /
-- [OBJECTIVE-DONE:n] tags. See src/lib/objectives.ts.
--
-- The client is null-safe: a campaign with no objectives column / empty array
-- simply shows no tracker, so applying this is non-breaking. Apply in the
-- Supabase SQL editor (same posture as campaign_enemies — anon-readable, RLS off).

alter table public.campaigns
  add column if not exists objectives jsonb not null default '[]'::jsonb;
