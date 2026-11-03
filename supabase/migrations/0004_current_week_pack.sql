-- Pack of the Week. Same rule as theme_pack_price: distinct pack-pool
-- archetypes in plain text order, indexed by extract(week) (the ISO week).
-- New functions are not executable until granted. Revoke the public/anon
-- default first, then grant only the roles that should call this.

create or replace function public.current_week_pack()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with themes as (
    select archetype
    from public.cards
    where pack_pool
      and archetype is not null
      and archetype <> ''
    group by archetype
  ),
  numbered as (
    select archetype,
           row_number() over (order by archetype) as n,
           count(*) over () as total
    from themes
  )
  select archetype
  from numbered
  where total > 0
    and n = ((extract(week from current_date)::int - 1) % total) + 1;
$$;

revoke execute on function public.current_week_pack() from public, anon;
grant execute on function public.current_week_pack() to anon, authenticated;
