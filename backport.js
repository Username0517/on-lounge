/*
 * backport.js - lets this client run against the OLD database (setup.sql before the password-based prayers,
 * the invite gate and the server-side chat sender), so the client can be deployed first and setup.sql run after.
 *
 * Every fallback lives in this file. To remove it once the new setup.sql is applied:
 *   1. delete this file,
 *   2. delete its <script> tag in index.html,
 *   3. in app.js delete the lines marked "BACKPORT" and use the plain client:  const sb = ... createClient(...)
 *
 * How it works: wrap() returns a proxy of the Supabase client. At start it asks the database one harmless question
 * (check_invite with an empty code): the new function answers with text, the old one with a boolean.
 * On an old database the proxy translates the new calls into the old ones. On a new database it passes everything through.
 * A page that stays open while setup.sql is applied keeps the old behaviour until it is reloaded.
 */
(function () {
  'use strict';

  const BP = { legacy: false };

  // ctx.name() returns the display name of the signed-in member (the old database wants it in every chat row).
  BP.wrap = function (raw, ctx) {
    const ready = raw.rpc('check_invite', { code: '' }).then(
      ({ data, error }) => { BP.legacy = !error && typeof data === 'boolean'; },
      () => { BP.legacy = false; }
    );

    function legacyRpc(fn, args, opts) {
      const a = args || {};
      switch (fn) {
        case 'check_invite':   // old: boolean; new: 'ok' | 'wrong' | 'closed' | 'banned:<seconds>'
          return raw.rpc(fn, a, opts).then(r => (r.error ? r : { data: r.data === true ? 'ok' : 'wrong', error: null }));
        case 'join_lounge':    // old: raises 'wrong invite code'; new: returns a status
          return raw.rpc(fn, a, opts).then(r => {
            if (r.error && /invite/i.test(r.error.message)) return { data: 'wrong', error: null };
            return r.error ? r : { data: 'ok', error: null };
          });
        case 'add_prayer':     // old: no password, no id returned
          return raw.rpc(fn, { body: a.body }, opts);
        case 'delete_prayer':  // old: author or admin only, no password, nothing returned
          return raw.rpc(fn, { pid: a.pid }, opts).then(r => (r.error ? r : { data: true, error: null }));
        case 'update_prayer':  // old database cannot edit
          return Promise.resolve({ data: false, error: null });
        default:
          return raw.rpc(fn, args, opts);
      }
    }

    return new Proxy(raw, {
      get(target, key) {
        if (key === 'rpc') return (fn, args, opts) => ready.then(() => (BP.legacy ? legacyRpc(fn, args, opts) : raw.rpc(fn, args, opts)));
        if (key === 'from') {
          return table => {
            const q = raw.from(table);
            if (table !== 'messages') return q;
            // old database: the client sends its own name and user_id is filled by a column default
            return new Proxy(q, {
              get(qt, qk) {
                if (qk === 'insert') return row => ready.then(() => (BP.legacy ? raw.from(table).insert({ name: ctx.name(), ...row }) : raw.from(table).insert(row)));
                const v = qt[qk];
                return typeof v === 'function' ? v.bind(qt) : v;
              }
            });
          };
        }
        const v = target[key];
        return typeof v === 'function' ? v.bind(target) : v;
      }
    });
  };

  window.ONL_BACKPORT = BP;
})();
