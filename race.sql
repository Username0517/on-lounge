-- ON-Lounge · 카트 레이싱 기록판 + 폰 컨트롤러 연결
-- 1) 맵마다 각자의 가장 빠른 완주 시간을 저장하고 1~5등을 보여 줘요.
-- 2) QR을 찍은 폰(로그인 안 해도 됨)이 컴퓨터와 'pad:…' 채널에서만 만날 수 있게 해 줘요.
-- 여러 번 실행해도 괜찮아요.

create table if not exists public.race_times (
  map        text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  ms         integer not null check (ms > 0 and ms <= 3600000),
  updated_at timestamptz not null default now(),
  primary key (map, user_id)
);

alter table public.race_times enable row level security;
revoke all on public.race_times from anon, authenticated;

-- 맵 목록과 "이보다 빠를 수는 없는" 시간(밀리초). race.js의 맵과 같아야 해요.
create or replace function public.race_map_min(p_map text)
returns integer
language sql immutable set search_path = public as $$
  select m.min_ms from (values
    ('meadow', 36000), ('beach', 34000), ('sakura', 34000), ('city', 37000), ('canyon', 36000), ('autumn', 38000),
    ('snow', 40000), ('jungle', 36000), ('harbor', 36000), ('candy', 35000), ('neon', 35000), ('volcano', 35000),
    ('glacier', 38000), ('construct', 36000), ('cave', 36000), ('space', 39000), ('cliff', 27000), ('rainbow', 25000)
  ) as m(map, min_ms)
  where m.map = p_map;
$$;

-- 내 기록 올리기: 더 빠를 때만 바뀌어요. 돌려주는 값은 내 최고 기록.
create or replace function public.submit_race_time(p_map text, p_ms integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare best integer; lo integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  lo := public.race_map_min(p_map);
  if lo is null then raise exception 'unknown map'; end if;
  if p_ms is null or p_ms < lo or p_ms > 3600000 then raise exception 'bad time'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'not a member'; end if;

  insert into public.race_times (map, user_id, ms)
  values (p_map, auth.uid(), p_ms)
  on conflict (map, user_id) do update
    set ms = least(public.race_times.ms, excluded.ms),
        updated_at = case when excluded.ms < public.race_times.ms then now() else public.race_times.updated_at end;

  select ms into best from public.race_times where map = p_map and user_id = auth.uid();
  return best;
end $$;

-- 1~5등. 이름과 시간만 나가요 (이메일이나 아이디는 나가지 않아요).
create or replace function public.top_race_times(p_map text)
returns table (rank integer, name text, ms integer, mine boolean)
language sql stable security definer set search_path = public as $$
  select (row_number() over (order by r.ms asc, r.updated_at asc))::integer,
         coalesce(p.name, '친구'),
         r.ms,
         r.user_id = auth.uid()
  from public.race_times r
  join public.profiles p on p.id = r.user_id
  where r.map = p_map
  order by r.ms asc, r.updated_at asc
  limit 5;
$$;

-- 내 최고 기록 (없으면 0)
create or replace function public.my_race_time(p_map text)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select ms from public.race_times where map = p_map and user_id = auth.uid()), 0);
$$;

revoke all on function public.race_map_min(text) from public, anon, authenticated;
revoke all on function public.submit_race_time(text, integer) from public, anon;
revoke all on function public.top_race_times(text) from public, anon;
revoke all on function public.my_race_time(text) from public, anon;
grant execute on function public.submit_race_time(text, integer) to authenticated;
grant execute on function public.top_race_times(text) to authenticated;
grant execute on function public.my_race_time(text) to authenticated;

-- 폰 컨트롤러: 'pad:코드' 채널에서 broadcast만 주고받을 수 있어요 (로그인 안 한 폰도).
-- 라운지 채널('lounge:…')은 지금처럼 회원만 들어갈 수 있어요.
drop policy if exists "pads listen" on realtime.messages;
create policy "pads listen" on realtime.messages
  for select to anon, authenticated
  using (realtime.topic() like 'pad:%' and realtime.messages.extension = 'broadcast');
drop policy if exists "pads send" on realtime.messages;
create policy "pads send" on realtime.messages
  for insert to anon, authenticated
  with check (realtime.topic() like 'pad:%' and realtime.messages.extension = 'broadcast');
