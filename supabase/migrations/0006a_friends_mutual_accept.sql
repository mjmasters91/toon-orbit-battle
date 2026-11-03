-- Mutual friend requests become friendships automatically.
create or replace function public.send_friend_request(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  other uuid;
  rev public.friend_requests;
begin
  select id into other from public.profiles where lower(username) = lower(trim(p_username));
  if other is null then raise exception 'No account with that username.'; end if;
  if other = uid then raise exception 'That’s you.'; end if;
  if exists (select 1 from public.friends where user_id = uid and friend_id = other) then
    raise exception 'Already friends.';
  end if;
  select * into rev from public.friend_requests
   where from_id = other and to_id = uid and status = 'pending' limit 1 for update;
  if rev.id is not null then
    update public.friend_requests set status = 'accepted' where id = rev.id;
    update public.friend_requests set status = 'accepted' where from_id = uid and to_id = other and status = 'pending';
    insert into public.friends (user_id, friend_id) values (uid, other) on conflict do nothing;
    insert into public.friends (user_id, friend_id) values (other, uid) on conflict do nothing;
    return jsonb_build_object('ok', true, 'accepted', true);
  end if;
  insert into public.friend_requests (from_id, to_id, status)
  values (uid, other, 'pending')
  on conflict do nothing;
  return jsonb_build_object('ok', true, 'accepted', false);
end;
$$;
revoke execute on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

-- Resolve pairs that already requested each other.
with pairs as (
  select a.id a_id, b.id b_id, a.from_id, a.to_id
  from public.friend_requests a
  join public.friend_requests b on b.from_id = a.to_id and b.to_id = a.from_id
  where a.status = 'pending' and b.status = 'pending'
), ins as (
  insert into public.friends (user_id, friend_id)
  select from_id, to_id from pairs
  on conflict do nothing
)
update public.friend_requests set status = 'accepted'
where id in (select a_id from pairs union select b_id from pairs);
