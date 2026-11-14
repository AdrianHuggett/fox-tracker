-- Add Gen 6 shards and widgets to current and future Backpacks.
-- Run with owner approval. Existing rows and quantities are preserved.
begin;
lock table public.item_template in share row exclusive mode;
lock table public.user_items in share row exclusive mode;

create temporary table gen6_existing_items on commit drop as
select to_jsonb(i) as row_data from public.user_items i;
create temporary table gen6_existing_template on commit drop as
select to_jsonb(i) as row_data from public.item_template i;

do $gen6$
declare
  hero text;
  suffix text;
  item_name text;
  item_sort integer;
  item_group text;
  item_icon text;
begin
  foreach hero in array array['Wu Ming','Renee','Wayne'] loop
    foreach suffix in array array['',' widget'] loop
      item_name := hero || suffix;
      if (select count(*) from public.item_template where name=item_name)>1
        or exists (select 1 from public.user_items where name=item_name
                   group by user_id having count(*)>1) then
        raise exception 'Duplicate rows for %; inspect before proceeding', item_name;
      end if;

      select grp,icon into item_group,item_icon from public.item_template
      where name='Gwen' || suffix;
      if item_group is null or
        (suffix='' and item_group !~ 'Hero Shards$') or
        (suffix=' widget' and item_group !~ 'Hero (Exclusive )?Gear$') then
        raise exception 'Expected existing group for Gwen%', suffix;
      end if;

      select sort into item_sort from public.item_template where name=item_name;
      if item_sort is null then
        select coalesce(max(sort),0)+1 into item_sort from (
          select sort from public.item_template union all select sort from public.user_items
        ) all_items;
        insert into public.item_template(sort,grp,icon,name,target,free)
        values(item_sort,item_group,item_icon,item_name,0,0);
      end if;

      if exists (select 1 from public.user_items i join public.profiles p on p.id=i.user_id
        where i.sort=item_sort and i.name<>item_name
        and not exists (select 1 from public.user_items j
          where j.user_id=p.id and j.name=item_name)) then
        raise exception 'Sort conflict for %; inspect before proceeding', item_name;
      end if;

      insert into public.user_items(user_id,sort,grp,icon,name,have,target,free)
      select p.id,item_sort,item_group,item_icon,item_name,0,0,0
      from public.profiles p where not exists (
        select 1 from public.user_items i where i.user_id=p.id and i.name=item_name
      );
      if exists (select 1 from public.profiles p where not exists (
        select 1 from public.user_items i where i.user_id=p.id and i.name=item_name
      )) then
        raise exception 'Missing % after insertion', item_name;
      end if;
    end loop;
  end loop;

  if exists (select row_data from gen6_existing_items
             except all select to_jsonb(i) from public.user_items i)
    or exists (select row_data from gen6_existing_template
               except all select to_jsonb(i) from public.item_template i) then
    raise exception 'An existing row changed; rolling back';
  end if;
end;
$gen6$;

select name,count(*) as backpack_rows from public.user_items
where name in ('Wu Ming','Renee','Wayne','Wu Ming widget','Renee widget','Wayne widget')
group by name order by name;
commit;
