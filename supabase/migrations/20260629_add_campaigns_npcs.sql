-- campaigns.npcs: durable, shared NPC roster (replaces per-device localStorage).
--
-- WHY: NPC cards used to live only in each device's localStorage, so they were
-- per-device and could silently diverge between players. Worse, a companion NPC
-- traveling WITH the party (e.g. Sera) could vanish from one device when the
-- scene-change despawn ran but the DM hadn't re-emitted their [NPC:] tag. Moving
-- the roster into the campaign row (mirroring the existing `objectives` jsonb
-- column) makes it durable and shared, synced live via the npcs_sync broadcast.
--
-- Shape: jsonb array of { name, desc, portrait_url?, is_companion? }. is_companion
-- marks an NPC that joined the party — companions are never auto-despawned on a
-- location change; only an explicit departure removes them.
--
-- Backward compatible: defaults to '[]', so existing campaigns are unaffected and
-- the client seeds it from localStorage on first load.

alter table public.campaigns
  add column if not exists npcs jsonb not null default '[]'::jsonb;
