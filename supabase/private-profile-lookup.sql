-- Owner approved and applied on 16 November 2026. Do not rerun table creation.
-- No changes to existing profiles, preview documents, alliance sync or Backpack.
begin;
create table public.private_profile_lookup_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_at timestamptz not null,
  day date not null,
  attempts integer not null check (attempts between 1 and 30)
);
alter table public.private_profile_lookup_limits enable row level security;
alter table public.private_profile_lookup_limits force row level security;
revoke all on public.private_profile_lookup_limits from public, anon, authenticated;

create function public.claim_private_profile_lookup() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  stamp timestamptz := clock_timestamp();
  today date := (stamp at time zone 'UTC')::date;
  accepted uuid;
  previous public.private_profile_lookup_limits%rowtype;
begin
  if caller is null or not exists (
    select 1 from public.private_feature_previews p
    join public.profiles a on a.id=p.owner_id
    where p.id='account-optimizer' and p.owner_id=caller and a.is_admin=true
  ) then raise exception 'Private preview access required' using errcode='42501'; end if;
  insert into public.private_profile_lookup_limits as limits(user_id,last_at,day,attempts)
  values(caller,stamp,today,1)
  on conflict(user_id) do update set last_at=stamp, day=today,
    attempts=case when limits.day=today then limits.attempts+1 else 1 end
  where limits.last_at <= stamp-interval '30 seconds'
    and (limits.day<>today or limits.attempts<30)
  returning user_id into accepted;
  if accepted is not null then return jsonb_build_object('allowed',true); end if;
  select * into previous from public.private_profile_lookup_limits where user_id=caller;
  return jsonb_build_object('allowed',false,'retry_after',greatest(1,ceil(extract(epoch from (
    case when previous.day=today and previous.attempts>=30
      then ((today+1)::timestamp at time zone 'UTC')
      else previous.last_at+interval '30 seconds' end - stamp)))));
end;
$$;
revoke all on function public.claim_private_profile_lookup() from public, anon;
grant execute on function public.claim_private_profile_lookup() to authenticated;
commit;
