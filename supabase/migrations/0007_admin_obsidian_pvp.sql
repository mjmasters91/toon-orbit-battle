-- Admins may play Obsidian cards in PvP. Everyone else still cannot.
-- create_room, create_challenge, join_room, respond_invite, and enqueue_pvp
-- all call assert_pvp_deck, so this one change covers those paths.
-- Spectators stay blind: public_board and public_avatar still drop ob_*.
-- Do not apply from the client. Run this in the Supabase SQL editor.

create or replace function public.assert_pvp_deck(p_user uuid, p_deck jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  n int;
  elem jsonb;
  cid text;
  is_gold boolean;
  need int;
  have int;
  admin boolean := exists (
    select 1 from public.profiles where id = p_user and role = 'admin'
  );
begin
  if jsonb_typeof(p_deck) is distinct from 'array' then
    raise exception 'Choose a 12-card deck.';
  end if;
  n := jsonb_array_length(p_deck);
  if n <> 12 then
    raise exception 'A PvP deck is exactly 12 cards.';
  end if;
  for elem in select value from jsonb_array_elements(p_deck) loop
    cid := elem->>'id';
    if cid is null or not exists (select 1 from public.cards c where c.id = cid) then
      raise exception 'Unknown card.';
    end if;
    if not admin and (cid like 'ob_%' or exists (select 1 from public.cards c where c.id = cid and c.admin_only)) then
      raise exception 'Obsidian cards are not allowed in PvP.';
    end if;
  end loop;
  for cid, is_gold, need in
    select e->>'id', coalesce((e->>'gold')::boolean, false), count(*)::int
    from jsonb_array_elements(p_deck) e
    group by 1, 2
  loop
    select count into have from public.collection
    where user_id = p_user and card_id = cid and gold = is_gold;
    if coalesce(have, 0) < need then
      raise exception 'That deck uses cards you do not own.';
    end if;
  end loop;
end;
$$;

revoke execute on function public.assert_pvp_deck(uuid, jsonb) from public, anon, authenticated;
