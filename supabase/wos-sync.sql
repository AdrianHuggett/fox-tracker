-- In-game data from whiteoutstats.com (see supabase/functions/wos-sync/index.ts and docs/02-database.md).
-- Signed-in members read it; only the wos-sync Edge Function (service role) writes it.

create table if not exists public.wos_players (
  chief_id      bigint primary key,
  uid           bigint,
  nick_name     text not null default '',
  alliance      text,        -- 'FOX' or 'NGT' while in the alliance, null after leaving
  alliance_rank smallint,    -- 1..5 = R1..R5
  power         bigint,
  furnace_level int,
  x             int,         -- city position on the state map, as shown in game (X:Y)
  y             int,
  roster_at     timestamptz, -- last seen in the alliance roster
  pos_at        timestamptz  -- when x/y were last looked up
);
alter table public.wos_players enable row level security;
revoke all on public.wos_players from anon, public;
grant select on public.wos_players to authenticated;
drop policy if exists wos_players_read on public.wos_players;
create policy wos_players_read on public.wos_players for select to authenticated using (true);

create table if not exists public.wos_sync_state (
  id         int primary key,
  last_run   timestamptz,
  roster_at  timestamptz,
  last_error text
);
alter table public.wos_sync_state enable row level security;
revoke all on public.wos_sync_state from anon, public;
grant select on public.wos_sync_state to authenticated;
drop policy if exists wos_sync_state_read on public.wos_sync_state;
create policy wos_sync_state_read on public.wos_sync_state for select to authenticated using (true);

-- Every 5 minutes, call the function (the anon key is the public one from index.html).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('wos-sync') where exists (select 1 from cron.job where jobname = 'wos-sync');
select cron.schedule('wos-sync', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://nhkyrurfcrorwbobqlrp.supabase.co/functions/v1/wos-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ANON_KEY'),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
$$);

-- Check
select (select relrowsecurity from pg_class where oid = 'public.wos_players'::regclass) as players_rls,
       (select count(*) from pg_policies where tablename in ('wos_players', 'wos_sync_state')) as policies,
       (select count(*) from cron.job where jobname = 'wos-sync') as cron_jobs;
