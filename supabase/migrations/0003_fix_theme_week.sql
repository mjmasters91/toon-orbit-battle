create or replace function public.theme_pack_price(p_theme text)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  themes text[];
  wk int;
  n int;
  full int := public.setting('theme_price', 400);
  disc int := public.setting('theme_week_price', 350);
begin
  select coalesce(array_agg(a order by a), '{}') into themes
  from (select distinct archetype a from public.cards where pack_pool and archetype is not null and archetype <> '') s;
  n := coalesce(array_length(themes, 1), 0);
  if n = 0 or p_theme is null or p_theme = '' then
    return full;
  end if;
  wk := extract(week from current_date)::int;
  if themes[(((wk - 1) % n) + 1)] = p_theme then
    return disc;
  end if;
  return full;
end;
$$;
