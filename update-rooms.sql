-- ON-Lounge: 새 방(카탄 섬, 낙서 골목)에서도 채팅이 되도록 방 목록만 고쳐요. 여러 번 실행해도 괜찮아요.
create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  new.user_id := auth.uid();
  select name into nm from public.profiles where id = new.user_id;
  if nm is null then
    raise exception 'not a member';
  end if;
  new.name := nm;
  if new.scene not in ('sanctuary', 'hall', 'room1', 'room2', 'room3', 'room4', 'hall1', 'f1r1', 'f1r2', 'f1r3', 'roof', 'soccer') then
    raise exception 'bad scene';
  end if;
  if (select count(*) from public.messages where user_id = new.user_id and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'slow down';
  end if;
  return new;
end;
$$;
