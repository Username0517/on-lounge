# Changelog

## Security hardening: invite gate, anonymous prayers, trusted chat sender

Audience: the developer and the developer's AI agent. This entry lists what changed, why, how, how it was tested, and what to know before you touch this code again.

Files changed: `setup.sql`, `app.js`, `index.html`. File added: `backport.js`.

### Deploy order (read first)

1. Deploy the client (`app.js`, `backport.js`, `index.html`). It also works against the OLD database.
2. Set the invite code secret (see "Invite gate"). Do this BEFORE step 3. Without a secret, new sign-ups are refused.
3. Run the new `setup.sql` in the Supabase SQL Editor. It is safe to run more than once.
4. Reload any page that was open during step 3. A page keeps its old behaviour until it reloads.
5. Run `alter table public.settings drop column invite_code;` to remove the old plaintext code.
6. In the next deploy, remove the backport (see "Removing backport.js").

`setup.sql` migrates data in place. There is no down migration. The `prayers.author` column is dropped for good. Take a backup first if you need a way back.

### What changed and why

| Area | Before | After | Why |
|---|---|---|---|
| Invite code | Default code `onlounge2026` written in `setup.sql`, also in git history | No code in the repo. Read from Vault, then from a DB setting. Missing or empty = sign-up closed | A default code can be used by mistake. A shipped code is public |
| Invite guessing | `check_invite` was open to `anon` with no limit | Failures are counted per IP and globally. Repeated failures are banned in the database | Stop brute force. The check runs in the DB, so a client cannot skip it |
| Prayer ownership | `prayers.author` stored the user id | No author. Each prayer has its own password (hash only). Edit and delete need the password | The author link let a DB reader find who wrote a prayer |
| Prayer limit | 5 per day per author, enforced in SQL | Removed from the server. The client warns from `localStorage` only | No author exists to count by. The owner chose a soft warning |
| Chat sender | The client sent `name` and `user_id` checks only covered `user_id` | A trigger sets `user_id` and `name` from the session and the profile. Clients may only send `body` and `scene` | Never trust the client about who wrote a message |
| Chat delivery | Client-to-client `chat` broadcast plus a DB insert | Clients listen to `INSERT` on `public.messages` (`postgres_changes`) | The row is already stored. The broadcast let a client fake a sender name |
| Chat flood | None | At most 5 messages per 10 seconds per member | Stop spam |

### How it was changed

#### Invite gate (`setup.sql`)

- `settings` is now a single row with `attempts jsonb`. The old `invite_code` column is no longer read. The script makes it nullable so old data does not block the script.
- `invite_secret()` returns the code. It reads Vault (`vault.decrypted_secrets`, name `invite_code`) first. It then reads `current_setting('app.invite_code', true)`. It returns `''` if neither exists. The Vault lookup runs through `execute` and `to_regclass`, so the script works on a project without Vault.
- `client_ip()` returns the LAST entry of `x-forwarded-for`, or `'unknown'`. Supabase documents the FIRST entry in its examples. We use the last entry on purpose. Supabase documentation does not say whether the proxy appends to or replaces this header. Treat the IP as a hint.
- `guard_hit(key, limit, window_seconds, record)` is the counter. Each key holds `n` (count), `w` (window start), `l` (ban level), `u` (banned until), `t` (last change). Reaching the limit bans for 1 hour. Each repeat doubles the ban, up to 24 hours. Entries idle for 24 hours are dropped. The map is capped at 200 keys.
- `invite_gate(code)` returns `'ok'`, `'wrong'`, `'closed'`, or `'banned:<seconds>'`. Limits: 5 failures per 15 minutes per IP, and 30 failures per hour for the shared key `'*'`. The shared key covers a spoofed IP header.
- An empty or null code returns `'wrong'` and is NOT counted.
- `check_invite(code)` changed from `boolean` to `text`. It is `security definer` and granted to `anon` and `authenticated`.
- `join_lounge(code, name, look)` changed from `void` to `text`. It returns the gate status. It no longer raises on a wrong code.
- Why return a status instead of raising: a raised exception rolls back the transaction, and the failure count is rolled back with it. Do not change this back to `raise exception`.
- `invite_secret`, `client_ip`, `guard_hit`, `invite_gate` are internal. They are revoked from `public`, `anon`, and `authenticated`.

Set the secret with one of these. Vault is read first.

```sql
select vault.create_secret('<your code>', 'invite_code');
-- or
alter database postgres set app.invite_code = '<your code>';
```

The Vault option may not exist on every plan. The DB setting is not a protected store: any role that can call `current_setting` can read it. Prefer Vault.

#### Anonymous prayers (`setup.sql`)

- New columns: `pw_hash text`, `pw_pre boolean default true`.
- New rows store `bcrypt(sha256_hex(password))`. The SHA-256 step makes passwords of any length count in full. bcrypt alone ignores everything after 72 bytes. There is no length limit and no complexity rule by owner decision.
- Legacy rows store `pw_pre = false`. Their `pw_hash` is a copy of the author's `auth.users.encrypted_password`. The author's account password opens them. The one-time migration then drops `prayers.author`.
- Legacy rows whose author had no password hash get `pw_hash = null`. Only an admin can delete those.
- `prayer_pw_ok(pid, pw)` checks a password. It is internal. An empty or null password never matches.
- `add_prayer(body, pw)` returns the new id. An empty password is refused. The old `add_prayer(text)` is dropped.
- `update_prayer(pid, pw, new_body)` is new. It returns `false` on a wrong password.
- `delete_prayer(pid, pw default null)` returns `boolean`. Admins delete without a password.
- `list_prayers()` no longer returns `mine`. The client keeps "my prayer" ids in `localStorage` (`onl-my-prayers`, last 200). They only decide whether the manage panel starts open. The server always checks the password.
- There is no limit on password attempts for prayers (owner decision). A member can try passwords on any prayer id without a limit. This is a known weakness. Add a counter with `guard_hit` if it matters.

#### Chat (`setup.sql`, `app.js`)

- `messages_before_insert()` (before-insert trigger, `security definer`) sets `user_id := auth.uid()` and `name` from `profiles`. It rejects non-members, scenes outside `sanctuary, hall, room1..room4`, and a 6th message within 10 seconds. Update the scene list when you add a room.
- `messages` grants: `select, delete` stay. `insert` is revoked, then granted for `(body, scene)` only.
- New index `messages_user_idx (user_id, created_at desc)` for the flood check.
- `messages` is added to the `supabase_realtime` publication. The script checks first, so it can run twice.
- `app.js`: `joinChatDb()` subscribes to `postgres_changes` for the current scene. `showChat()` shows a line from someone else and ignores your own line. The sender sees their own line at once from local code.
- The `chat` broadcast listener and sender are removed. They remain only as `BACKPORT` lines.

#### Client (`app.js`)

- `sbRaw` is the real Supabase client. `sb` is the wrapped one. All app code uses `sb`.
- `inviteMsg(status)` maps `wrong`, `closed`, `banned:<s>` to Korean user messages.
- Prayer form: new password field. A `confirm()` appears after 5 posts in 24 hours on this device (`onl-pr-day`). It is a warning, not a limit.
- Each prayer card has a "manage" panel: password field, edit, delete. Edit uses `prompt()` for the new text.

#### `backport.js`

Purpose: the client can be deployed before `setup.sql` runs. It wraps the Supabase client in a `Proxy`.

- It sends one probe at start: `rpc('check_invite', { code: '' })`. A `boolean` answer means an old database (`ONL_BACKPORT.legacy = true`). A `text` answer, an error, or a network failure means a new database.
- On an old database it translates calls:
  - `check_invite`: boolean to `'ok'` or `'wrong'`.
  - `join_lounge`: the exception `wrong invite code` becomes `'wrong'`; success becomes `'ok'`.
  - `add_prayer`: sends only `body`. The password is dropped.
  - `delete_prayer`: sends only `pid`. It reports success without proof, because the old function returns nothing.
  - `update_prayer`: returns `false`.
  - `messages.insert`: adds `name` from `ctx.name()`.
- Every `rpc` waits for the probe. The probe also runs on a new database. That is one extra call per page load.
- In legacy mode `app.js` also sends and listens to the `chat` broadcast, and hides the prayer password field. These lines carry the `BACKPORT` marker.

### Removing backport.js

1. Delete `backport.js`.
2. Delete `<script src="backport.js"></script>` in `index.html`.
3. In `app.js`, find every line with `BACKPORT`: `grep -n BACKPORT app.js`.
   - Delete the `BP` constant and the `sb` wrapper line. Rename `sbRaw` back to `sb`.
   - Delete the `chat` broadcast listener and the legacy `netSend('chat', ...)` line.
   - In `joinChatDb()`, delete the `if (BP.legacy) return;` line.
   - In `openPrayers()` and `renderPrayers()`, replace `LIVE && !BP.legacy` with `LIVE`. Keep the code in the block. Delete the old delete-button branch only if you no longer need the demo mode, which still uses it.
4. Run `node --check app.js`.

### How it was tested

Test code is NOT in the repo. It was in a temporary folder and is gone or will be pruned. Rebuild it if you need to rerun.

- SQL (62 checks, all passed). Real PostgreSQL 18 with `pgcrypto` built from source. The old `setup.sql` (from `git show HEAD:setup.sql`) was applied first and filled with sample data. The new `setup.sql` was then applied twice. Checked:
  - migration: `author` dropped, legacy hash copied, a row without hash stays unusable;
  - invite: closed without a secret, Vault wins over the DB setting, empty and null codes, 5-failure ban, doubling to 2 hours, the 200-key cap, the global bucket against 250 spoofed IPs, failures committed (not rolled back);
  - chat: `user_id` and `name` forced, client-sent `name` and `user_id` refused, bad scene, flood limit, non-member refused;
  - prayers: 1-character password, long password where only the first 72 bytes match (must fail), edit, wrong, empty and null passwords, admin delete, hashes are bcrypt with a different salt per row;
  - privileges: internal functions not callable by `authenticated`, `anon` blocked from prayers, `list_prayers`, and `join_lounge`, `messages` in the realtime publication.
- `backport.js`: a mock client in Node. Covered old database translation, new database pass-through, and a failed probe.
- `node --check` passed for `app.js` and `backport.js`.

### Not tested

- No browser run. The prayer manage panel, the chat feed, and the sign-up messages were never seen on screen.
- No real Supabase project. The mock schemas for `auth`, `realtime`, and `vault` were hand-written. Not verified there: Vault on the free plan, `ALTER DATABASE ... SET app.invite_code`, the `x-forwarded-for` behaviour, `postgres_changes` filtering with RLS, and the realtime publication change.
- Realtime `postgres_changes` DELETE events are not filtered by RLS (Supabase documentation). The app does not use DELETE events for chat.

### Known limits and risks

- Not fixed on purpose: presence name tags and the `st`, `emote`, `hit`, `gm` broadcasts. The server cannot verify the sender of these. A client can fake a name tag, including an admin look.
- Login password guessing is not handled in SQL. Use the Supabase Auth settings: rate limits, CAPTCHA, and MFA for admins.
- The copied legacy hash is byte-identical to `auth.users.encrypted_password`. Anyone who can read the auth schema can link a legacy prayer to an account. New prayers use a new salt and cannot be linked.
- `guard_hit` locks the `settings` row on each recorded failure. Under attack, sign-up attempts queue behind each other. Existing members are not affected.
- During an attack on the global key, new sign-ups are refused for up to 24 hours.
- The prayer limit of 5 per day is a client warning only. Anyone can clear `localStorage` or call the RPC directly.
- Old CSP, `?debug`, and QR-image issues from the review are not part of this change.

### Rules for future edits

- Keep failure counting in functions that RETURN a status. A raised exception undoes the count.
- Keep new internal helper functions revoked from `public`, `anon`, and `authenticated`.
- Do not add `user_id` or `name` back to the `messages` insert grant.
- Do not store a plaintext invite code or prayer password anywhere in the repo, in logs, or in the database.
- Run `setup.sql` twice on a copy before you ship a change to it.
