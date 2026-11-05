-- ============================================================================
-- Codeply Supabase migration v4: prompt-cache token counts on app_events
-- ----------------------------------------------------------------------------
-- Craft, Crew and the CLI now send, with each AI call, how much of its input
-- came from the prompt cache:
--   tokens_in           ALL input (unchanged meaning; cached input included)
--   cache_read_tokens   part of tokens_in served from the cache (~0.1x price)
--   cache_write_tokens  part of tokens_in written to the cache (~1.25x price)
-- Both are left out of an event when zero, so they are nullable here.
--
-- Run in the Supabase SQL Editor. Safe to run more than once.
--
-- Order to roll it out:
--   1. Run this file.
--   2. Update the `track` Edge Function so it writes the two new fields from
--      each event into app_events (same as tokens_in / tokens_out).
--   3. Ship the Craft / CLI update that sends them.
-- The admin dashboard (api/admin-overview.js, api/admin-user.js) works before
-- and after this runs: without the columns it just shows no cache numbers.
-- ============================================================================

alter table public.app_events add column if not exists cache_read_tokens integer;
alter table public.app_events add column if not exists cache_write_tokens integer;

comment on column public.app_events.cache_read_tokens is 'Part of tokens_in read from the prompt cache.';
comment on column public.app_events.cache_write_tokens is 'Part of tokens_in written to the prompt cache.';
