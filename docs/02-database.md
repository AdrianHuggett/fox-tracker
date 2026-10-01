# 02 · Database (Supabase project `nhkyrurfcrorwbobqlrp`)

RLS is enabled on every table. `anon` has no grants anywhere, and TRUNCATE is revoked everywhere. The browser uses the anon key with a signed-in session, so it acts as the role `authenticated`.

> Columns marked ✔ were confirmed against the live database on 2 Oct 2026; the rest come from the code and earlier notes. To get an exact snapshot, have Adrian run the dump query at the end of this file and paste the result.

## Tables

### `profiles`, one row per account (created by the signup trigger)

| Column | Type | Notes |
|---|---|---|
| `id` ✔ | uuid, PK | = `auth.users.id` |
| `name` | text | Copied from the account metadata on every load (`touchProfile`) |
| `email` | text | Copied on every load. **Never fetched for display** (privacy decision, 28 Sep) |
| `is_admin` ✔ | boolean not null default false | Adrian only. Not writable from the browser |
| `r4_editor` ✔ | boolean not null default false | Set only by `set_r4_editor()` |
| `created_at` ✔ | timestamptz not null default now() | |
| `last_seen` ✔ | timestamptz | Stamped on every load |
| `currency_code`, `currency_symbol` | text | Per-member display currency |
| `currency_rate` ✔ | numeric not null default 1 | |

- Policies: `own_profile_read`: SELECT using `id = auth.uid() OR is_admin()`. `own_profile_write`: UPDATE using/check `id = auth.uid()`.
- Grants to `authenticated`: SELECT on all columns. **UPDATE only on** `name, email, last_seen, currency_code, currency_symbol, currency_rate` (column grants), which is why `is_admin` and `r4_editor` cannot be changed from the browser.

### `settings`, a single shared row

`id` ✔ int default 1, `next_svs` ✔ date (drives every projection), `mur` ✔ numeric default 63.4 (MUR per £, display only). Read by all; edited by Adrian in the dashboard.

### Shared reference data (read by all signed-in users)

- `item_template`: the item list copied into each new member's `user_items` (sort, grp, icon, name).
- `packs`: id (int), sort, sec, grp, name, icon, price (in GBP), pack_value (% from Torxim's WoS Corner), occurrence.
- `pack_contents(pack_id, item, qty)`.
- `baselines(item, usd)`: the value of one unit in USD, used for pack scoring and the "biggest gaps" card.

### Per-member data (own rows only)

- `user_items(user_id, sort, grp, icon, name, have ✔ numeric default 0, target ✔ numeric default 0, free ✔ numeric default 0)`. Rows are updated by `(user_id, sort)`. `free` is the old starting estimate.
- `user_packs(user_id ✔ uuid, pack_id ✔ int, freq ✔ numeric default 0)`. **`freq` = packs already bought.**
- `stock_history(user_id ✔ default auth.uid(), day ✔ date, have ✔ jsonb, packs ✔ jsonb, updated_at ✔ timestamptz default now())`. Unique on (user_id, day); the trigger `stock_history_trim` deletes the member's rows older than 90 days whenever a new day is inserted. Policies: select, insert, update on own rows.
- `user_exchanges(user_id uuid not null default auth.uid() → auth.users on delete cascade, xid text, qty numeric ≥ 0 default 0, PK(user_id, xid))`. Created 28 Sep with:
  ```sql
  alter table public.user_exchanges enable row level security;
  revoke all on public.user_exchanges from anon, public;
  grant select, insert, update, delete on public.user_exchanges to authenticated;
  create policy user_exchanges_own_read   on public.user_exchanges for select using (user_id = auth.uid());
  create policy user_exchanges_own_insert on public.user_exchanges for insert with check (user_id = auth.uid());
  create policy user_exchanges_own_update on public.user_exchanges for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy user_exchanges_own_delete on public.user_exchanges for delete using (user_id = auth.uid());
  ```

### R4 roles (readable by every signed-in user; direct writes admin only)

- `r4_members(id bigint, sort, name)`.
- `r4_tasks(id bigint, sort, section, name, freq, remarks, time_utc, roles jsonb)`, where `roles = {"<r4_members.id>": "main"|"assist"}`.
- Policies on both tables: `*_read` SELECT using `true`; `*_insert` check `is_admin()`; `*_update` using/check `is_admin()`; `*_delete` using `is_admin()`. Table grants to `authenticated`: SELECT, INSERT, UPDATE, DELETE (RLS does the gating).
- **R4 editors never write these tables directly.** They only call `set_r4_role()`.

## Functions (public schema)

All are SECURITY DEFINER with `search_path = public`. EXECUTE is revoked from `public` and `anon`, and granted to `authenticated`.

```sql
-- existing before 27 Sep (exact body confirmed)
create or replace function public.is_admin() returns boolean
language sql stable security definer as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- 28 Sep
create or replace function public.set_r4_editor(target uuid, on_off boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update profiles set r4_editor = on_off where id = target;
end $$;

create or replace function public.set_r4_role(task_id bigint, member_id bigint, new_role text) returns void
language plpgsql security definer set search_path = public as $$
declare k text := member_id::text;
begin
  if not coalesce((select is_admin or r4_editor from profiles where id = auth.uid()), false) then
    raise exception 'Not allowed'; end if;
  if new_role is not null and new_role not in ('main','assist') then raise exception 'Bad role'; end if;
  if not exists (select 1 from r4_members where id = member_id) then raise exception 'Unknown R4'; end if;
  update r4_tasks set roles = case when new_role is null then coalesce(roles,'{}'::jsonb) - k
                                   else coalesce(roles,'{}'::jsonb) || jsonb_build_object(k, new_role) end
   where id = task_id;
  if not found then raise exception 'Unknown task'; end if;
end $$;
```

- `handle_new_user()`: the trigger function on `auth.users` insert (`on_auth_user_created`). It creates the `profiles` row (name from the signup metadata), copies `item_template` into `user_items` (have, target and free = 0) and adds one `user_packs` row per pack (freq 0). **If you add an item or pack type, make sure new and existing members get the rows.**
- The trigger function behind `stock_history_trim`.

## Auth settings (read from `/auth/v1/settings`, 28 Sep)

- Email/password login is on; signup is open (`disable_signup = false`).
- `mailer_autoconfirm = true`: no confirmation email at signup.
- **Unverified**: SMTP (probably still Supabase's built-in sender, which only reaches project team members at a few emails per hour) and URL configuration (Site URL / Redirect URLs must include `https://adrianhuggett.github.io/fox-tracker/`). See `06-open-items.md`.

## How to change the database

Claude Code cannot reach the Supabase dashboard. The procedure:

1. Write the SQL. Prefer `create … if not exists`, explicit `grant`/`revoke`, and RLS on every new table.
2. Explain it to Adrian in French in one or two sentences, and wait for "oui".
3. He pastes it into **Supabase → SQL Editor → Run** and sends back the output of a verifying `SELECT` you give him.
4. Deploy front-end code that depends on it **only after** the SQL is confirmed.

If he has installed the Supabase CLI and logged in himself (`supabase login`, `supabase link --project-ref nhkyrurfcrorwbobqlrp`), you may use `supabase db query` style commands, with the same approval rule. Never handle the DB password.

## Schema dump query (read-only)

Ask Adrian to run this in the SQL Editor and paste the single cell back. It lists columns, primary keys, policies, RLS flags, grants, triggers and function bodies.

```sql
select string_agg(line, E'\n' order by ord) from (
select 1 ord, 'COL '||table_name||'.'||column_name||' '||data_type||coalesce(' default '||column_default,'')||case when is_nullable='NO' then ' not null' else '' end line
  from information_schema.columns where table_schema='public'
union all select 2, 'PK '||tc.table_name||' ('||string_agg(kcu.column_name,',')||')'
  from information_schema.table_constraints tc join information_schema.key_column_usage kcu using(constraint_name,table_schema)
  where tc.table_schema='public' and tc.constraint_type='PRIMARY KEY' group by tc.table_name
union all select 3, 'POL '||tablename||' '||policyname||' '||cmd||' using('||coalesce(qual,'')||') check('||coalesce(with_check,'')||')'
  from pg_policies where schemaname='public'
union all select 4, 'RLS '||relname||' '||relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
union all select 5, 'TGRANT '||table_name||' '||grantee||' '||string_agg(privilege_type,',' order by privilege_type)
  from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by table_name,grantee
union all select 6, 'CGRANT '||table_name||' '||grantee||' '||privilege_type||' ('||string_agg(column_name,',' order by column_name)||')'
  from information_schema.column_privileges where table_schema='public' and grantee='authenticated' and privilege_type in ('UPDATE','INSERT')
  group by table_name,grantee,privilege_type
union all select 7, 'TRG '||event_object_schema||'.'||event_object_table||' '||trigger_name||' '||action_timing||' '||event_manipulation||' '||action_statement
  from information_schema.triggers where event_object_schema in ('public','auth')
union all select 8, 'FN '||p.proname||' acl='||coalesce(p.proacl::text,'default')||E'\n'||pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
) x;
```

Save the result as `docs/schema-snapshot.txt` and keep this file in sync with it.
