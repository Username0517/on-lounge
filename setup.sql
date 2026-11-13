-- =====================================================================
-- ON-Lounge : Supabase 초기 설정
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전해요. (이미 저장된 QT·광고·QR·배치는 지워지지 않아요)
-- =====================================================================

-- 1) Invite code. No code is shipped in this file: set it as a secret BEFORE running this script
--    (until then every sign-up is refused; existing members are not affected). Pick ONE:
--      a) Vault:  select vault.create_secret('<your code>', 'invite_code');
--                 (to change it later: select vault.update_secret(id, '<new code>') for the row in vault.secrets)
--      b) DB setting:  alter database postgres set app.invite_code = '<your code>';
--    Vault is read first, then the DB setting. An empty or missing value keeps sign-up closed.
--    Older versions of this file kept the code in settings.invite_code. That column is no longer read;
--    once the secret is set, remove the old plaintext copy with:
--      alter table public.settings drop column invite_code;
--    Table settings (single row) also holds the failed-attempt counters used by the invite gate below.
create table if not exists public.settings (
  id int primary key default 1 check (id = 1)
);
alter table public.settings add column if not exists attempts jsonb not null default '{}'::jsonb;
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'settings' and column_name = 'invite_code') then
    alter table public.settings alter column invite_code drop not null;
  end if;
end $$;
insert into public.settings (id) values (1) on conflict (id) do nothing;
alter table public.settings enable row level security;
-- No read policy on settings: the app can never read the counters or the code, only the functions below touch them.

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

-- 5) 채팅 기록 (매일 0시, 중국 시간 기준으로 초기화돼요)
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
-- serves the per-member flood check in messages_before_insert()
create index if not exists messages_user_idx on public.messages (user_id, created_at desc);

-- 5-1) Anonymous prayer requests. The author is not stored; a prayer is edited or deleted only with the password
-- chosen for it (stored as a hash). Read and written through the functions below only.
-- pw_hash is bcrypt. pw_pre = true: bcrypt of sha256-hex(password), so passwords of any length are fully used
-- (bcrypt itself ignores everything after 72 bytes). pw_pre = false: legacy row, bcrypt of the raw password.
create table if not exists public.prayers (
  id bigint generated always as identity primary key,
  body text not null check (char_length(body) between 2 and 300),
  created_at timestamptz not null default now()
);
alter table public.prayers add column if not exists pw_hash text;
alter table public.prayers add column if not exists pw_pre boolean not null default true;
-- One-time migration from the author-based schema: the author's account password hash becomes the prayer password
-- (legacy rows are edited and deleted with the account password), then the author link is dropped for good.
-- The copied hash is byte-identical to auth.users.encrypted_password, so someone who can read the auth schema
-- can still match legacy rows to accounts. New prayers use a fresh salt and cannot be matched.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'prayers' and column_name = 'author') then
    update public.prayers p
       set pw_hash = nullif(u.encrypted_password, ''), pw_pre = false
      from auth.users u
     where u.id = p.author and p.pw_hash is null;
    alter table public.prayers drop column author;
  end if;
end $$;
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

create extension if not exists pgcrypto with schema extensions;

-- The invite code lives in a secret store, never in this file: Vault first, then the app.invite_code
-- database setting. '' means "not set", which keeps sign-up closed.
create or replace function public.invite_secret() returns text
language plpgsql stable security definer set search_path = public as $$
declare s text;
begin
  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into s using 'invite_code';
  end if;
  return coalesce(nullif(s, ''), current_setting('app.invite_code', true), '');
end;
$$;

-- Caller address as seen by PostgREST: the last X-Forwarded-For entry, which is the one appended by the
-- proxy closest to us. Treat it as a hint only; the global bucket below covers a spoofed value.
create or replace function public.client_ip() returns text
language plpgsql stable set search_path = public as $$
declare x text[];
begin
  begin
    x := string_to_array(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',');
  exception when others then
    x := null;
  end;
  if x is null or cardinality(x) = 0 or btrim(x[cardinality(x)]) = '' then
    return 'unknown';
  end if;
  return left(btrim(x[cardinality(x)]), 64);
end;
$$;

-- fail2ban inside the database. Counters live as json in settings.attempts, one entry per key:
--   n = failures in the current window, w = window start, l = ban level, u = banned until, t = last change (epoch seconds)
-- guard_hit(key, limit, window_seconds, record): returns the remaining ban in seconds (0 = free).
-- With record = true it counts one failure; reaching the limit bans the key for 1 h, doubling per repeat up to 24 h.
-- Entries idle for a day are dropped (the level resets) and the map is capped at 200 keys.
-- Callers must RETURN a status instead of raising, otherwise the counter update is rolled back with the transaction.
create or replace function public.guard_hit(k text, lim int, win int, rec boolean) returns int
language plpgsql security definer set search_path = public as $$
declare
  t0 bigint := extract(epoch from now())::bigint;
  a jsonb; e jsonb; n int; w bigint; l int; u bigint; victim text;
begin
  if rec then
    select attempts into a from public.settings where id = 1 for update;
  else
    select attempts into a from public.settings where id = 1;
  end if;
  a := coalesce(a, '{}'::jsonb);
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into a
    from jsonb_each(a)
   where greatest((value ->> 't')::bigint, (value ->> 'u')::bigint) >= t0 - 86400;
  e := a -> k;
  if e is null then
    n := 0; w := t0; l := 0; u := 0;
  else
    n := (e ->> 'n')::int; w := (e ->> 'w')::bigint; l := (e ->> 'l')::int; u := (e ->> 'u')::bigint;
    if u > t0 then
      return (u - t0)::int;
    end if;
  end if;
  if not rec then
    return 0;
  end if;
  if t0 - w > win then
    n := 0; w := t0;
  end if;
  n := n + 1;
  if n >= lim then
    l := l + 1;
    u := t0 + least(3600 * (1 << least(l - 1, 5)), 86400);
    n := 0; w := t0;
  end if;
  if e is null and (select count(*) from jsonb_object_keys(a)) >= 200 then
    select key into victim from jsonb_each(a) where key <> '*'
     order by greatest((value ->> 't')::bigint, (value ->> 'u')::bigint) limit 1;
    if victim is not null then
      a := a - victim;
    end if;
  end if;
  a := jsonb_set(a, array[k], jsonb_build_object('n', n, 'w', w, 'l', l, 'u', u, 't', t0));
  update public.settings set attempts = a where id = 1;
  return case when u > t0 then (u - t0)::int else 0 end;
end;
$$;

-- The only place an invite code is judged. Returns 'ok', 'wrong', 'closed' (no secret set) or 'banned:<seconds>'.
-- Per-address bucket: 5 failures / 15 min. Global bucket: 30 failures / hour (the address can be spoofed).
create or replace function public.invite_gate(code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  s text := public.invite_secret();
  ip text := 'ip:' || public.client_ip();
  secs int;
begin
  if s = '' then
    return 'closed';
  end if;
  secs := greatest(public.guard_hit(ip, 5, 900, false), public.guard_hit('*', 30, 3600, false));
  if secs > 0 then
    return 'banned:' || secs;
  end if;
  if coalesce(code, '') = '' then
    return 'wrong';   -- an empty code never matches and is not counted
  end if;
  if code = s then
    return 'ok';
  end if;
  secs := greatest(public.guard_hit(ip, 5, 900, true), public.guard_hit('*', 30, 3600, true));
  return case when secs > 0 then 'banned:' || secs else 'wrong' end;
end;
$$;

-- Sign-up screen: is this invite code right? (the code itself is never revealed)
drop function if exists public.check_invite(text);
create or replace function public.check_invite(code text) returns text
language sql security definer set search_path = public as $$
  select public.invite_gate(code);
$$;
revoke execute on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anon, authenticated;

-- 캐릭터를 만들면 회원으로 등록/수정 (관리자·기존 회원은 코드 없이)
-- Returns the invite_gate status for a newcomer, 'ok' otherwise.
drop function if exists public.join_lounge(text, text, jsonb);
create or replace function public.join_lounge(code text, display_name text, look jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.is_admin() and not public.is_member() then
    st := public.invite_gate(code);
    if st <> 'ok' then
      return st;
    end if;
  end if;
  insert into public.profiles (id, name, look)
  values (auth.uid(), left(coalesce(nullif(trim(display_name), ''), '친구'), 8), coalesce(look, '{}'::jsonb))
  on conflict (id) do update set name = excluded.name, look = excluded.look;
  return 'ok';
end;
$$;
revoke execute on function public.join_lounge(text, text, jsonb) from public, anon;
grant execute on function public.join_lounge(text, text, jsonb) to authenticated;

-- Internal helpers: only other functions in this file may call them.
revoke execute on function public.invite_secret() from public, anon, authenticated;
revoke execute on function public.client_ip() from public, anon, authenticated;
revoke execute on function public.guard_hit(text, int, int, boolean) from public, anon, authenticated;
revoke execute on function public.invite_gate(text) from public, anon, authenticated;

create or replace function public.prune_messages() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.messages
  where created_at < (date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai');
  return null;
end;
$$;
drop trigger if exists prune_messages_trg on public.messages;
create trigger prune_messages_trg after insert on public.messages
for each statement execute function public.prune_messages();

-- Never trust the client about who wrote a message: user_id and name come from the session and the profile,
-- scene must be a real room, and one member may post at most 5 messages per 10 seconds.
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
  if new.scene not in ('sanctuary', 'hall', 'room1', 'room2', 'room3', 'room4', 'hall1', 'f1r1', 'roof', 'soccer') then
    raise exception 'bad scene';
  end if;
  if (select count(*) from public.messages where user_id = new.user_id and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'slow down';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_before_insert_trg on public.messages;
create trigger messages_before_insert_trg before insert on public.messages
for each row execute function public.messages_before_insert();

-- 기도제목 함수 (60일 지난 글은 목록에서 빠져요)
drop function if exists public.list_prayers();
create or replace function public.list_prayers()
returns table (id bigint, body text, created_at timestamptz, amens int, amened boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.body, p.created_at,
         (select count(*) from public.prayer_amens a where a.prayer_id = p.id)::int,
         exists (select 1 from public.prayer_amens a where a.prayer_id = p.id and a.user_id = auth.uid())
  from public.prayers p
  where public.is_member() and p.created_at > now() - interval '60 days'
  order by p.created_at desc
  limit 100;
$$;

-- Does pw open prayer pid? Passwords of any length are accepted: new rows hash sha256-hex(pw), legacy rows the raw pw.
create or replace function public.prayer_pw_ok(pid bigint, pw text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(pw, '') <> '' and exists (
    select 1 from public.prayers p
    where p.id = pid and p.pw_hash is not null
      and p.pw_hash = extensions.crypt(
            case when p.pw_pre then encode(sha256(convert_to(pw, 'utf8')), 'hex') else pw end,
            p.pw_hash));
$$;

-- Returns the new prayer id (the app keeps it on the device to mark "my" prayers).
drop function if exists public.add_prayer(text);
create or replace function public.add_prayer(body text, pw text) returns bigint
language plpgsql security definer set search_path = public as $$
declare pid bigint;
begin
  if not public.is_member() then raise exception 'not a member'; end if;
  if coalesce(pw, '') = '' then raise exception 'password required'; end if;
  insert into public.prayers (body, pw_hash)
  values (trim(body), extensions.crypt(encode(sha256(convert_to(pw, 'utf8')), 'hex'), extensions.gen_salt('bf')))
  returning id into pid;
  return pid;
end;
$$;
-- false = wrong password (or no such prayer)
create or replace function public.update_prayer(pid bigint, pw text, new_body text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'not a member'; end if;
  if not public.prayer_pw_ok(pid, pw) then return false; end if;
  update public.prayers set body = trim(new_body) where id = pid;
  return true;
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
-- Admins delete without a password. false = wrong password (or no such prayer).
drop function if exists public.delete_prayer(bigint);
create or replace function public.delete_prayer(pid bigint, pw text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if not public.is_member() or not public.prayer_pw_ok(pid, pw) then return false; end if;
  end if;
  delete from public.prayers where id = pid;
  return true;
end;
$$;
revoke execute on function public.list_prayers() from public, anon;
revoke execute on function public.add_prayer(text, text) from public, anon;
revoke execute on function public.update_prayer(bigint, text, text) from public, anon;
revoke execute on function public.toggle_amen(bigint) from public, anon;
revoke execute on function public.delete_prayer(bigint, text) from public, anon;
revoke execute on function public.prayer_pw_ok(bigint, text) from public, anon, authenticated;
grant execute on function public.list_prayers() to authenticated;
grant execute on function public.add_prayer(text, text) to authenticated;
grant execute on function public.update_prayer(bigint, text, text) to authenticated;
grant execute on function public.toggle_amen(bigint) to authenticated;
grant execute on function public.delete_prayer(bigint, text) to authenticated;

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
grant select, delete on public.messages to authenticated;
-- Members may only supply the text and the room; user_id and name are filled in by messages_before_insert().
revoke insert on public.messages from authenticated;
grant insert (body, scene) on public.messages to authenticated;
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
  for select to authenticated using (public.is_member() and created_at >= (date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai'));
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

-- Chat reaches other clients from the database, not from client-to-client messages: the app listens to
-- INSERTs on public.messages (members only, via the select policy above), so every name shown comes from the server.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- =====================================================================
-- [관리자 지정] 사이트에서 본인 이메일로 회원가입한 뒤,
-- 아래 줄의 이메일을 바꾸고 맨 앞의 -- 두 개를 지운 다음, 그 줄만 선택해서 Run 하세요.
-- insert into public.admins (user_id) select id from auth.users where email = '본인이메일@example.com';
-- =====================================================================
