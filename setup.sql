-- =====================================================================
-- ON-Lounge : Supabase 초기 설정
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전해요. (이미 저장된 QT·광고·QR·배치는 지워지지 않아요)
-- =====================================================================

-- 1) 초대 코드 ─ 아래 'onlounge2026' 을 원하는 코드로 바꾼 뒤 실행하세요.
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  invite_code text not null
);
insert into public.settings (id, invite_code) values (1, 'onlounge2026')
on conflict (id) do update set invite_code = excluded.invite_code;
alter table public.settings enable row level security;
-- settings 에는 읽기 규칙을 만들지 않아요. 앱에서 초대 코드를 볼 수 없고, 아래 함수만 확인해요.

-- 2) 회원 프로필 (이름, 캐릭터 외형)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 8),
  look jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3) 관리자 명단
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- 4) 관리자가 고치는 내용 (이번 주 광고, 헌금 QR, 물건 배치, 우리말성경 링크)
create table if not exists public.content (
  id int primary key default 1 check (id = 1),
  qt jsonb not null default '{}'::jsonb,
  ads jsonb not null default '[]'::jsonb,
  qr_url text,
  updated_at timestamptz not null default now()
);
alter table public.content add column if not exists layout jsonb not null default '{}'::jsonb;
alter table public.content add column if not exists sample boolean not null default true;
alter table public.content add column if not exists qt_link text;
insert into public.content (id) values (1) on conflict (id) do nothing;
update public.content set
  ads = '[{"t":"관리 탭에서 광고를 바꿔 주세요","b":"관리자 계정으로 로그인하면 이번 주 광고를 올릴 수 있어요."}]'::jsonb
where id = 1 and sample = true;

-- 4-1) 월별 QT 일정 (날짜 하나에 본문 범위 하나). 앱이 중국 시간 기준 '오늘' 줄을 보여줘요.
create table if not exists public.qt_plan (
  day date primary key,
  ref text not null check (char_length(ref) between 1 and 80)
);

-- 5) 채팅 기록 (30일 지나면 자동으로 지워져요)
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists messages_created_at_idx on public.messages (created_at desc);
-- 어느 공간(본당, 복도, room1~4)에서 한 말인지
alter table public.messages add column if not exists scene text not null default 'sanctuary';
create index if not exists messages_scene_idx on public.messages (scene, created_at desc);

-- 5-1) 익명 기도제목. 쓴 사람(author)은 아무도 볼 수 없어요(관리자 포함). 아래 함수로만 읽고 써요.
create table if not exists public.prayers (
  id bigint generated always as identity primary key,
  author uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 300),
  created_at timestamptz not null default now()
);
create table if not exists public.prayer_amens (
  prayer_id bigint not null references public.prayers (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (prayer_id, user_id)
);

-- ---------------------------------------------------------------------
-- 도우미 함수
-- ---------------------------------------------------------------------
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 회원가입 화면에서 초대 코드가 맞는지만 확인 (코드 자체는 알려주지 않아요)
create or replace function public.check_invite(code text) returns boolean
language sql stable security definer set search_path = public as $$
  select code is not distinct from (select invite_code from public.settings where id = 1);
$$;
grant execute on function public.check_invite(text) to anon, authenticated;

-- 캐릭터를 만들면 회원으로 등록/수정 (관리자·기존 회원은 코드 없이)
drop function if exists public.join_lounge(text, text, jsonb);
create or replace function public.join_lounge(code text, display_name text, look jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.is_admin() and not public.is_member() and code is distinct from (select invite_code from public.settings where id = 1) then
    raise exception 'wrong invite code';
  end if;
  insert into public.profiles (id, name, look)
  values (auth.uid(), left(coalesce(nullif(trim(display_name), ''), '친구'), 8), coalesce(look, '{}'::jsonb))
  on conflict (id) do update set name = excluded.name, look = excluded.look;
end;
$$;
revoke execute on function public.join_lounge(text, text, jsonb) from public, anon;
grant execute on function public.join_lounge(text, text, jsonb) to authenticated;

create or replace function public.prune_messages() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.messages where created_at < now() - interval '30 days';
  return null;
end;
$$;
drop trigger if exists prune_messages_trg on public.messages;
create trigger prune_messages_trg after insert on public.messages
for each statement execute function public.prune_messages();

-- 기도제목 함수 (60일 지난 글은 목록에서 빠져요)
drop function if exists public.list_prayers();
create or replace function public.list_prayers()
returns table (id bigint, body text, created_at timestamptz, amens int, amened boolean, mine boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.body, p.created_at,
         (select count(*) from public.prayer_amens a where a.prayer_id = p.id)::int,
         exists (select 1 from public.prayer_amens a where a.prayer_id = p.id and a.user_id = auth.uid()),
         p.author = auth.uid()
  from public.prayers p
  where public.is_member() and p.created_at > now() - interval '60 days'
  order by p.created_at desc
  limit 100;
$$;
create or replace function public.add_prayer(body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'not a member'; end if;
  if (select count(*) from public.prayers where author = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'daily limit reached';
  end if;
  insert into public.prayers (author, body) values (auth.uid(), trim(body));
end;
$$;
create or replace function public.toggle_amen(pid bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'not a member'; end if;
  if exists (select 1 from public.prayer_amens where prayer_id = pid and user_id = auth.uid()) then
    delete from public.prayer_amens where prayer_id = pid and user_id = auth.uid();
  else
    insert into public.prayer_amens (prayer_id, user_id) values (pid, auth.uid());
  end if;
end;
$$;
create or replace function public.delete_prayer(pid bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.prayers where id = pid and (author = auth.uid() or public.is_admin());
end;
$$;
revoke execute on function public.list_prayers() from public, anon;
revoke execute on function public.add_prayer(text) from public, anon;
revoke execute on function public.toggle_amen(bigint) from public, anon;
revoke execute on function public.delete_prayer(bigint) from public, anon;
grant execute on function public.list_prayers() to authenticated;
grant execute on function public.add_prayer(text) to authenticated;
grant execute on function public.toggle_amen(bigint) to authenticated;
grant execute on function public.delete_prayer(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 권한 규칙 (RLS): 회원만 보고, 관리자만 고칠 수 있어요
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.admins   enable row level security;
alter table public.content  enable row level security;
alter table public.messages enable row level security;
alter table public.qt_plan  enable row level security;
alter table public.prayers  enable row level security;   -- 읽기 규칙 없음: 함수로만 접근
alter table public.prayer_amens enable row level security;

grant select, update on public.profiles to authenticated;
grant select on public.admins to authenticated;
grant select, update on public.content to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant select, insert, update, delete on public.qt_plan to authenticated;

drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles
  for select to authenticated using (public.is_member());
drop policy if exists "self update profile" on public.profiles;
create policy "self update profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "self read admin flag" on public.admins;
create policy "self read admin flag" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "members read content" on public.content;
create policy "members read content" on public.content
  for select to authenticated using (public.is_member());
drop policy if exists "admins update content" on public.content;
create policy "admins update content" on public.content
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read qt" on public.qt_plan;
create policy "members read qt" on public.qt_plan
  for select to authenticated using (public.is_member());
drop policy if exists "admins write qt" on public.qt_plan;
create policy "admins write qt" on public.qt_plan
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages
  for select to authenticated using (public.is_member());
drop policy if exists "members write messages" on public.messages;
create policy "members write messages" on public.messages
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "admins or author delete messages" on public.messages;
create policy "admins or author delete messages" on public.messages
  for delete to authenticated using (public.is_admin() or user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 실시간 채널: 회원만 'lounge:…' 채널(로비, 본당, 복도, room1~4)에 들어올 수 있어요
-- ---------------------------------------------------------------------
drop policy if exists "members listen lounge" on realtime.messages;
create policy "members listen lounge" on realtime.messages
  for select to authenticated using (public.is_member() and realtime.topic() like 'lounge:%');
drop policy if exists "members send lounge" on realtime.messages;
create policy "members send lounge" on realtime.messages
  for insert to authenticated with check (public.is_member() and realtime.topic() like 'lounge:%');

-- =====================================================================
-- [관리자 지정] 사이트에서 본인 이메일로 회원가입한 뒤,
-- 아래 줄의 이메일을 바꾸고 맨 앞의 -- 두 개를 지운 다음, 그 줄만 선택해서 Run 하세요.
-- insert into public.admins (user_id) select id from auth.users where email = '본인이메일@example.com';
-- =====================================================================
