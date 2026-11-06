-- Add Justus to new and existing Backpacks. Run only with the owner's approval.
-- Existing rows, saved quantities and access policies are preserved.
begin;
lock table public.item_template in share row exclusive mode;
lock table public.user_items in share row exclusive mode;

create temporary table justus_existing_items on commit drop as
select to_jsonb(i) as row_data from public.user_items i;
create temporary table justus_existing_template on commit drop as
select to_jsonb(i) as row_data from public.item_template i;

do $justus$
declare
  item_sort integer;
  item_group text;
begin
  if (select count(*) from public.item_template where name='Justus Sigils') > 1 then
    raise exception 'Duplicate Justus template rows; inspect before proceeding';
  end if;
  if exists (select 1 from public.user_items where name='Justus Sigils'
             group by user_id having count(*) > 1) then
    raise exception 'Duplicate Justus Backpack rows; inspect before proceeding';
  end if;

  select grp into item_group from public.item_template
  where name in ('Gareth Sigils','Kathy Sigils','General Expert Sigils')
  order by case name when 'Gareth Sigils' then 0 when 'Kathy Sigils' then 1 else 2 end
  limit 1;
  if item_group is null or item_group !~ 'Expert Materials$' then
    raise exception 'Expected the existing Expert Materials group';
  end if;

  select sort into item_sort from public.item_template where name='Justus Sigils';
  if item_sort is null then
    select coalesce(max(sort),0)+1 into item_sort from (
      select sort from public.item_template union all select sort from public.user_items
    ) all_items;
    insert into public.item_template(sort,grp,icon,name,target,free)
    values(item_sort,item_group,'📜','Justus Sigils',0,0);
  end if;

  if exists (select 1 from public.user_items i join public.profiles p on p.id=i.user_id
             where i.sort=item_sort and i.name<>'Justus Sigils'
             and not exists (select 1 from public.user_items j
                             where j.user_id=p.id and j.name='Justus Sigils')) then
    raise exception 'Justus sort conflicts with an existing row';
  end if;

  insert into public.user_items(user_id,sort,grp,icon,name,have,target,free)
  select p.id,item_sort,item_group,'📜','Justus Sigils',0,0,0
  from public.profiles p
  where not exists (select 1 from public.user_items i
                    where i.user_id=p.id and i.name='Justus Sigils');

  if exists (select 1 from justus_existing_items old
             where not exists (select 1 from public.user_items i where to_jsonb(i)=old.row_data))
     or exists (select 1 from justus_existing_template old
                where not exists (select 1 from public.item_template i where to_jsonb(i)=old.row_data)) then
    raise exception 'An existing row changed; rolling back';
  end if;
  if exists (select 1 from public.profiles p
             where not exists (select 1 from public.user_items i
                               where i.user_id=p.id and i.name='Justus Sigils')) then
    raise exception 'A member is missing Justus; rolling back';
  end if;
end;
$justus$;

select 'Justus Sigils' as item,
       (select count(*) from public.item_template where name='Justus Sigils') as template_rows,
       (select count(*) from public.user_items where name='Justus Sigils') as backpack_rows;
commit;
