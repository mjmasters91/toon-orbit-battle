-- Searchable admin member list. Not applied. Review this file, then run it in the SQL editor.
-- Admins only. The list returns public profile fields, not emails or secrets.
-- Avatars go through public_avatar, so ob_% and admin-only cards stay off the list.
-- Hosted Supabase rejects DELETE and UPDATE with no WHERE. This file has neither.

create or replace function public.admin_search_players(p_query text default '', p_limit int default 25, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  raw text := left(trim(coalesce(p_query, '')), 32);
  q text := replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_');
  lim int := least(50, greatest(1, coalesce(p_limit, 25)));
  off int := greatest(0, coalesce(p_offset, 0));
  total int;
  rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  select count(*) into total
  from public.profiles p
  where q = '' or p.username ilike '%' || q || '%' escape '\';
  select coalesce(jsonb_agg(s.item order by s.username), '[]'::jsonb)
  into rows
  from (
    select p.username, jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'role', p.role,
      'coins', p.coins,
      'packs', p.unopened_packs,
      'cards', coalesce((select sum(c.count) from public.collection c where c.user_id = p.id), 0),
      'avatar', public.public_avatar(p.avatar),
      'rating', p.rating,
      'tier', public.rating_band(p.rating)->>'tier',
      'division', public.rating_band(p.rating)->>'division',
      'ranked_wins', p.ranked_wins,
      'ranked_losses', p.ranked_losses,
      'last_active', coalesce(
        (select max(m.updated_at) from public.matches m where m.host = p.id or m.guest = p.id),
        p.created_at
      )
    ) as item
    from public.profiles p
    where q = '' or p.username ilike '%' || q || '%' escape '\'
    order by p.username
    limit lim offset off
  ) s;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'players', rows);
end;
$$;

revoke all on function public.admin_search_players(text, int, int) from public, anon;
grant execute on function public.admin_search_players(text, int, int) to authenticated;
