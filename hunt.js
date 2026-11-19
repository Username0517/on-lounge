/*
 * ON-Lounge · 저택 술래잡기 (숲속의 저택 정문 → "다 함께")
 *
 * 3~6명. 몇 명은 괴물, 나머지는 생존자. 괴물은 처음 15초 동안 감옥에 갇혀 있고, 생존자는 그 사이 흩어져 숨어요.
 * 생존자는 석궁(3초에 한 발)으로 괴물을 밀쳐 내고, 갇힌 친구를 열쇠로 구하고, 나중에 나타나는 사다리 조각 3개를
 * 지상 구멍에 설치해서 모두 빠져나가면 이겨요. 괴물은 생존자를 모두 감옥에 넣으면 이겨요.
 *
 * Network, in one paragraph: this rides on the lounge's table system (games.js) and the mansion room's
 * broadcast channel. Every player owns their own position and only says something when their direction
 * changes (plus a slow heartbeat); everybody else replays that movement against the same walls, so it
 * stays in step without a stream of updates. The table's host is the referee for everything that matters
 * (hits, catches, keys, ladders, who won). Supabase's free plan allows 100 realtime messages a second for
 * the whole project and counts a broadcast to N people as N+1, which is why the table is capped at six.
 */
(function () {
  'use strict';
  // 무료 요금제 기준 최대 인원. Supabase를 Pro로 바꾸면 10으로 올려도 돼요.
  const MAX_PLAYERS = 6;
  function boot() {
    if (!window.ONL || !window.ONL_TG || !window.ONL_MANSION) return setTimeout(boot, 150);
    init(window.ONL_TG, window.ONL_MANSION.kit, window.ONL);
  }
  boot();

  function init(TG, K, O) {
    const { TS, P } = K;
    const FT = K.T;
    const el = O.el, toast = O.toast;
    const now = () => performance.now();
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const pick = a => a[Math.random() * a.length | 0];
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const me = () => O.uid();

    // ---------------- rules ----------------
    const VW = 320, VH = 240;
    const SURV_SPEED = 66, MON_SPEED = 60, SPEED_STEP = 0.04, SPEED_EVERY = 40000, SPEED_MAX_STEPS = 7;
    const JAIL_MS = 15000, OPEN_MS = 6000, MON_HP = 50, BOLT_CD = 3000, BOLT_SPEED = 250, BOLT_RANGE = 230;
    const ATK_CD = 900, ATK_REACH = 24, INSTALL_MS = 3000, KEY_RESPAWN = 15000;
    const PIECE_AT = [90000, 150000, 210000], TIME_LIMIT = 600000;
    const monstersFor = n => (n >= 6 ? 2 : 1);
    const SKINS = ['blue', 'grin', 'scream', 'crawl'];
    const MON_KO = { blue: '물끄러미', grin: '히죽이', scream: '아우성', crawl: '거미손' };

    // ---------------- the three maps ----------------
    // Each map is built from a fixed seed, so everybody gets exactly the same rooms without sending them.
    const THEMES = [
      { name: '지하 감옥', blurb: '돌벽과 쇠사슬. 통나무통과 상자 뒤에 숨기 좋아요.', seed: 4101, floor: 'stone', wall: 'stone', hide: ['barrel', 'crate'], deco: ['chains', 'pipes'], tall: ['jars'], dark: 0.9 },
      { name: '와인 창고', blurb: '나무 바닥, 끝없는 술통 선반. 숨을 곳이 많아요.', seed: 5202, floor: 'plank', wall: 'wood', hide: ['barrel', 'barrel', 'crate'], deco: ['pipes'], tall: ['shelf'], dark: 0.88 },
      { name: '버려진 별관', blurb: '옷장과 침대가 남은 방들. 길이 복잡해요.', seed: 6303, floor: 'dark', wall: 'paper', hide: ['wardrobe', 'closet', 'crate'], deco: ['painting', 'mirror'], tall: ['shelf', 'clock'], dark: 0.86 }
    ];
    const MAPS = [];
    function genMap(idx) {
      if (MAPS[idx]) return MAPS[idx];
      const th = THEMES[idx], R = K.seeded(th.seed);
      const COLS = 4, ROWS = 3, CW = 13, CH = 11, W = COLS * CW + 1, H = ROWS * CH + 3;
      const g = Array.from({ length: H }, () => Array(W).fill('#'));
      const carve = (x, y) => { if (x > 0 && y > 1 && x < W - 1 && y < H - 1) g[y][x] = '.'; };
      const rooms = [];
      for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
        const w = 7 + (R() * 3 | 0), h = 5 + (R() * 3 | 0);
        const x0 = cx * CW + 2 + (R() * (CW - w - 2) | 0), y0 = cy * CH + 3 + (R() * (CH - h - 2) | 0);
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) carve(x, y);
        rooms.push({ cx, cy, x0, y0, w, h, mx: x0 + (w >> 1), my: y0 + (h >> 1), id: rooms.length, nb: [] });
      }
      const at = (cx, cy) => rooms[cy * COLS + cx];
      // a random spanning tree, then a few extra loops so you can run in circles
      const seen = new Set([0]), stack = [0], edges = [];
      while (stack.length) {
        const r = rooms[stack[stack.length - 1]];
        const nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [r.cx + dx, r.cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !seen.has(y * COLS + x));
        if (!nbs.length) { stack.pop(); continue; }
        const [nx, ny] = nbs[R() * nbs.length | 0], n = at(nx, ny);
        seen.add(n.id); stack.push(n.id); edges.push([r.id, n.id]);
      }
      for (const r of rooms) for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const x = r.cx + dx, y = r.cy + dy; if (x >= COLS || y >= ROWS) continue;
        const n = at(x, y); if (!edges.some(([a, b]) => (a === r.id && b === n.id) || (a === n.id && b === r.id)) && R() < 0.45) edges.push([r.id, n.id]);
      }
      for (const [a, b] of edges) {
        const A = rooms[a], B = rooms[b]; A.nb.push(b); B.nb.push(a);
        // two tiles wide, so a big monster and a survivor can pass
        if (A.cy === B.cy) { const y = A.my; for (let x = Math.min(A.mx, B.mx); x <= Math.max(A.mx, B.mx); x++) { carve(x, y); carve(x, y + 1); } }
        else { const x = A.mx; for (let y = Math.min(A.my, B.my); y <= Math.max(A.my, B.my); y++) { carve(x, y); carve(x + 1, y); } }
      }
      // the cell: room (1, 1), walled by bars with one door at the bottom
      const J = at(1, 1);
      const jx0 = J.mx - 3, jy0 = J.y0, jw = 6, jh = 3;
      for (let y = jy0 - 1; y <= jy0 + jh; y++) for (let x = jx0 - 1; x <= jx0 + jw; x++) {
        const edge = y === jy0 - 1 || y === jy0 + jh || x === jx0 - 1 || x === jx0 + jw;
        if (!edge) { g[y][x] = '.'; continue; }
        if (y === jy0 - 1) { g[y][x] = '#'; continue; }
        g[y][x] = 'b';
      }
      const jdoor = [J.mx, jy0 + jh]; g[jdoor[1]][J.mx - 1] = 'j'; g[jdoor[1]][J.mx] = 'j';
      // a ring of floor all round the cell, so every corridor that ran into this room still joins up
      for (let x = jx0 - 2; x <= jx0 + jw + 1; x++) { carve(x, jy0 - 2); carve(x, jy0 + jh + 1); carve(x, jy0 + jh + 2); }
      for (let y = jy0 - 2; y <= jy0 + jh + 2; y++) { carve(jx0 - 2, y); carve(jx0 + jw + 1, y); }
      // the hole up to the ground: the room furthest from the cell
      const dist = new Map([[J.id, 0]]), q = [J.id];
      while (q.length) { const c = q.shift(); for (const n of rooms[c].nb) if (!dist.has(n)) { dist.set(n, dist.get(c) + 1); q.push(n); } }
      const far = rooms.slice().sort((a, z) => (dist.get(z.id) || 0) - (dist.get(a.id) || 0));
      const HR = far[0];
      const hole = { x: HR.mx * TS + 8, y: HR.my * TS + 8 };
      // furniture, hiding places, and points where the key and the ladder pieces can turn up
      const objs = [], hides = [], keyPts = [], piecePts = [], spawns = [];
      const free = (x, y) => g[y] && g[y][x] === '.' && !objs.some(o => o.x === x && (o.y === y || (FT[o.t].h > 1 && o.y + 1 === y)));
      const clearOf = (x, y, r) => { for (const o of rooms) if (Math.abs(x - o.mx) <= r && (y === o.my || y === o.my + 1)) return false; return true; };
      for (const r of rooms) {
        if (r === J) continue;
        // along the north wall, away from the doorways
        const cols = shuffle(Array.from({ length: r.w }, (_, i) => r.x0 + i)).filter(x => Math.abs(x - r.mx) > 1 && g[r.y0 - 1][x] === '#' && g[r.y0 - 1][x + 0] !== '.');
        let nh = r === HR ? 0 : 1 + (R() < 0.6 ? 1 : 0), nt = 1;
        for (const x of cols) {
          if (nh > 0) { const t = th.hide[R() * th.hide.length | 0], tall = FT[t].h > 1; const o = { t, x, y: tall ? r.y0 - 1 : r.y0, hide: true }; if (free(x, r.y0)) { objs.push(o); hides.push({ x: x * TS + 8, y: (r.y0 + 1) * TS - 2, o }); nh--; } continue; }
          if (nt > 0) { const t = th.tall[R() * th.tall.length | 0]; if (free(x, r.y0)) { objs.push({ t, x, y: r.y0 - 1 }); nt--; } continue; }
          if (R() < 0.35) objs.push({ t: th.deco[R() * th.deco.length | 0], x, y: r.y0 - 1, art: pick(['photo', 'landscape', 'girl']) });
        }
        // a hiding place in a lower corner too
        const cx = R() < 0.5 ? r.x0 : r.x0 + r.w - 1, cy = r.y0 + r.h - 1;
        if (r !== HR && free(cx, cy) && clearOf(cx, cy, 1)) { const t = th.hide[R() * th.hide.length | 0]; if (FT[t].h === 1) { objs.push({ t, x: cx, y: cy, hide: true }); hides.push({ x: cx * TS + 8, y: cy * TS + 14, o: objs[objs.length - 1] }); } }
        if (R() < 0.5) objs.push({ t: 'stain', x: r.x0 + 1 + (R() * (r.w - 2) | 0), y: r.y0 + 1 + (R() * (r.h - 2) | 0) });
        if (R() < 0.45) { const x = r.x0 + r.w - 1, y = r.y0; if (free(x, y) && clearOf(x, y, 1)) objs.push({ t: 'candle', x, y }); }
        keyPts.push([(r.x0 + 1 + (R() * (r.w - 2) | 0)) * TS + 8, (r.y0 + 1 + (R() * (r.h - 2) | 0)) * TS + 8]);
        if (r !== HR) piecePts.push([r.mx * TS + 8, (r.my + 1) * TS + 2], [(r.x0 + 1) * TS + 8, (r.y0 + r.h - 2) * TS + 8]);
        if (dist.get(r.id) >= 2) spawns.push([r.mx * TS + 8, (r.my + 1) * TS + 4]);
      }
      const room = { map: g.map(r => r.join('')), floor: th.floor, wall: th.wall, doors: {}, seed: th.seed, webs: [] };
      K.paintRoom(room);
      const jail = { x0: jx0 * TS, y0: jy0 * TS, x1: (jx0 + jw) * TS, y1: (jy0 + jh) * TS, door: { x: jdoor[0] * TS, y: jdoor[1] * TS + 8 }, out: { x: jdoor[0] * TS, y: (jdoor[1] + 2) * TS + 4 } };
      const M = { idx, th, room, W, H, objs, hides, keyPts, piecePts, spawns: spawns.length ? spawns : [[hole.x, hole.y + 20]], hole, jail, jdoor };
      M.solids = objs.map(o => K.solidOf(o)).filter(Boolean);
      M.grid = K.walkGrid(room, M.solids, () => true);
      MAPS[idx] = M;
      return M;
    }

    // ---------------- state ----------------
    // G: the referee's copy of the game (everyone has one; only the host changes it)
    // L: this screen only: where people are, arrows in flight, the camera, my cooldowns
    let G = null, M = null;
    const H = { t0: 0, pos: {}, dirty: false, pushAt: 0, lastPick: 0 };
    const L = { me: null, rem: {}, bolts: [], fx: [], camX: 0, camY: 0, boltAt: -1e9, atkAt: -1e9, hold: 0, holdWhat: null, lastSend: 0, sentVx: 9, sentVy: 9, sendT: 0, elAt: 0, el0: 0, knock: null, msg: [], over: false, endShown: false, keys: Object.create(null), order: [], joy: null, raf: 0, dom: null, lastT: 0, beat: 0, lightFlick: 1, carry: '' };
    const elapsed = () => TG.isHost() && H.t0 ? now() - H.t0 : (L.el0 + (now() - L.elAt));
    const ids = role => G ? Object.keys(G.roles).filter(id => G.roles[id] === role) : [];
    const isMon = id => G && G.roles[id] === 'm';
    const amMon = () => isMon(me());
    const inGame = () => !!G && !!G.roles[me()];
    const jailOpen = el => el >= JAIL_MS && el < JAIL_MS + OPEN_MS;
    const speedOf = id => isMon(id) ? MON_SPEED * (1 + SPEED_STEP * (G.speedLv || 0)) : SURV_SPEED;
    const nameOf = id => (G && G.names[id]) || TG.memberName(id) || '친구';

    function newGame() {
      const T = TG.T;
      const players = shuffle(T.members.filter(m => !m.bot).map(m => m.id));
      const nMon = monstersFor(players.length);
      const mapIdx = T.map >= 0 && T.map < 3 ? T.map : (Math.random() * 3 | 0);
      const g = { kind: 'hunt', seq: 1, map: mapIdx, phase: 'jail', roles: {}, skin: {}, hp: {}, down: {}, jailed: {}, esc: {}, names: {}, hides: {}, inst: 0, speedLv: 0, winner: null, why: '', el: 0, spawn: {} };
      const skins = shuffle(SKINS);
      players.forEach((id, i) => { const m = i < nMon; g.roles[id] = m ? 'm' : 's'; g.names[id] = (T.members.find(x => x.id === id) || {}).name || '친구'; if (m) { g.skin[id] = skins[i % 4]; g.hp[id] = MON_HP; } });
      const map = genMap(mapIdx);
      const sp = shuffle(map.spawns.map((_, i) => i));
      players.forEach((id, i) => { g.spawn[id] = g.roles[id] === 'm' ? -1 - i : sp[i % sp.length]; });
      g.key = { s: 1, ...ptOf(map.keyPts[Math.random() * map.keyPts.length | 0]) };
      g.pieces = shuffle(map.piecePts.map((_, i) => i)).slice(0, 3).map(i => ({ s: 0, ...ptOf(map.piecePts[i]) }));
      return g;
    }
    const ptOf = p => ({ x: p[0], y: p[1] });
    function spawnPos(id) {
      const k = G.spawn[id];
      if (k >= 0) { const s = M.spawns[k % M.spawns.length]; return { x: s[0], y: s[1] }; }
      const J = M.jail, n = -1 - k;
      return { x: J.door.x + [0, -20, 20, -40, 40][n % 5], y: J.y0 + 30 };
    }

    // ---------------- moving (same rules on every screen) ----------------
    function solidTile(ch, el, mon) {
      if (ch === '#' || ch === 'b') return true;
      if (ch === 'j') return !jailOpen(el);
      return false;
    }
    function blockedAt(x, y, el, mon) {
      const f = { x: x - 5, y: y - 5, w: 10, h: 5 };
      const tx0 = Math.floor(f.x / TS), tx1 = Math.floor((f.x + f.w - 0.01) / TS), ty0 = Math.floor(f.y / TS), ty1 = Math.floor((f.y + f.h - 0.01) / TS);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const ch = K.tileAt(M.room, tx, ty); if (solidTile(ch, el, mon)) return true; }
      for (const s of M.solids) if (K.overlap(f, s)) return true;
      return false;
    }
    function moveEnt(e, vx, vy, sp, dt, el, mon) {
      if (!vx && !vy) return false;
      const k = vx && vy ? 0.7071 : 1, dx = vx * sp * k * dt, dy = vy * sp * k * dt;
      let moved = false;
      if (dx && !blockedAt(e.x + dx, e.y, el, mon)) { e.x += dx; moved = true; }
      else if (dx && !vy) { for (const o of [4, -4, 8, -8]) if (!blockedAt(e.x + dx, e.y + o, el, mon)) { e.y += Math.sign(o) * Math.min(Math.abs(o), Math.abs(dx)); moved = true; break; } }
      if (dy && !blockedAt(e.x, e.y + dy, el, mon)) { e.y += dy; moved = true; }
      else if (dy && !vx) { for (const o of [4, -4, 8, -8]) if (!blockedAt(e.x + o, e.y + dy, el, mon)) { e.x += Math.sign(o) * Math.min(Math.abs(o), Math.abs(dy)); moved = true; break; } }
      return moved;
    }
    const dirOf = (vx, vy, prev) => vx < 0 ? 'left' : vx > 0 ? 'right' : vy < 0 ? 'up' : vy > 0 ? 'down' : prev;
    const inJail = p => p.x > M.jail.x0 - 2 && p.x < M.jail.x1 + 2 && p.y > M.jail.y0 && p.y < M.jail.y1 + 4;

    // ---------------- sending ----------------
    const send = p => TG.send(p);
    function sendMove(force) {
      const e = L.me; if (!e) return;
      const t = now();
      if (!force && e.vx === L.sentVx && e.vy === L.sentVy && t - L.lastSend < 2500) return;
      if (!force && t - L.lastSend < 180) { clearTimeout(L.sendT); L.sendT = setTimeout(() => sendMove(true), 185 - (t - L.lastSend)); return; }
      clearTimeout(L.sendT);
      L.lastSend = t; L.sentVx = e.vx; L.sentVy = e.vy;
      send({ t: 'hm', x: Math.round(e.x), y: Math.round(e.y), vx: e.vx, vy: e.vy, d: e.dir });
      if (TG.isHost()) H.pos[me()] = { x: e.x, y: e.y, vx: e.vx, vy: e.vy, at: t };
    }
    function act(a) {
      a.t = 'ha';
      if (L.me) { a.px = Math.round(L.me.x); a.py = Math.round(L.me.y); }
      if (TG.isHost()) hostAct(me(), a); else send(a);
    }
    function fx(f) { f.t = 'hx'; send(f); onFx(f); }

    // ---------------- the referee (host only) ----------------
    function hostPos(id) {
      if (id === me() && L.me) return L.me;
      const p = H.pos[id]; if (!p) return null;
      // where they should be by now, given the last thing they told us
      const dt = Math.min(1.5, (now() - p.at) / 1000), e = { x: p.x, y: p.y };
      if (p.vx || p.vy) moveEnt(e, p.vx, p.vy, speedOf(id), dt, elapsed(), isMon(id));
      return e;
    }
    function dirty() { H.dirty = true; }
    function push(to) {
      if (!G || !TG.isHost()) return;
      G.el = Math.round(elapsed()); G.seq++;
      const p = { t: 'hs', g: G }; if (to) p.to = to;
      send(p); H.dirty = false; H.pushAt = now();
    }
    function hostAct(id, a) {
      if (!G || G.phase === 'end') return;
      const el = elapsed(), mon = isMon(id);
      let pos = hostPos(id);
      if (a.px != null && a.py != null) {
        const told = { x: +a.px || 0, y: +a.py || 0 };
        if (!pos || Math.hypot(told.x - pos.x, told.y - pos.y) < 120) { pos = told; if (id !== me()) H.pos[id] = { x: told.x, y: told.y, vx: 0, vy: 0, at: now() }; }
      }
      if (!G.roles[id]) return;
      if (a.a === 'atk' && mon && !G.down[id] && el >= JAIL_MS) {
        const ax = +a.x || 0, ay = +a.y || 0;
        if (pos && Math.hypot(ax - pos.x, ay - pos.y) > 60) return;   // they are not where they say
        fx({ f: 'swing', id, x: Math.round(ax), y: Math.round(ay), d: a.d });
        for (const sid of ids('s')) {
          if (G.jailed[sid] || G.esc[sid]) continue;
          const hid = Object.keys(G.hides).find(k => G.hides[k] === sid);
          if (hid != null) { const h = M.hides[hid]; if (Math.hypot(h.x - ax, h.y - ay) < ATK_REACH + 8) catchS(sid, id, true); continue; }
          const sp = hostPos(sid); if (!sp) continue;
          if (Math.hypot(sp.x - ax, sp.y - ay) < ATK_REACH + 6) catchS(sid, id, false);
        }
        return;
      }
      if (a.a === 'hit' && !mon) {
        const mid = a.m; if (!isMon(mid) || G.down[mid]) return;
        const mp = hostPos(mid); if (mp && Math.hypot(mp.x - (+a.x || 0), mp.y - (+a.y || 0)) > 48) return;
        const crit = Math.random() < 0.1, dmg = crit ? 2 : 1;
        G.hp[mid] = Math.max(0, (G.hp[mid] || MON_HP) - dmg);
        fx({ f: 'dmg', m: mid, n: dmg, crit: crit ? 1 : 0, kx: clamp(+a.kx || 0, -1, 1), ky: clamp(+a.ky || 0, -1, 1) });
        if (G.hp[mid] <= 0) { G.down[mid] = 1; fx({ f: 'msg', text: `💥 ${MON_KO[G.skin[mid]]}(${nameOf(mid)})가 쓰러졌어요!` }); }
        dirty(); checkWin(); return;
      }
      if (mon) return;
      if (G.jailed[id] || G.esc[id]) return;
      if (a.a === 'hide') {
        const s = +a.s; const h = M.hides[s]; if (!h || G.hides[s] != null) return;
        if (pos && Math.hypot(h.x - pos.x, h.y - pos.y) > 34) return;
        for (const k of Object.keys(G.hides)) if (G.hides[k] === id) delete G.hides[k];
        G.hides[s] = id; dirty(); return;
      }
      if (a.a === 'unhide') { for (const k of Object.keys(G.hides)) if (G.hides[k] === id) delete G.hides[k]; dirty(); return; }
      if (a.a === 'pick') {
        if (a.w === 'key' && G.key.s === 1 && pos && Math.hypot(G.key.x - pos.x, G.key.y - pos.y) < 26) { G.key = { s: 2, c: id, x: 0, y: 0 }; fx({ f: 'msg', text: `🗝️ ${nameOf(id)}님이 감옥 열쇠를 주웠어요`, who: 's' }); dirty(); }
        const i = +a.i;
        if (a.w === 'piece' && G.pieces[i] && G.pieces[i].s === 1 && !G.pieces.some(p => p.s === 2 && p.c === id) && pos && Math.hypot(G.pieces[i].x - pos.x, G.pieces[i].y - pos.y) < 26) { G.pieces[i].s = 2; G.pieces[i].c = id; fx({ f: 'msg', text: `🪜 ${nameOf(id)}님이 사다리 조각을 주웠어요`, who: 's' }); dirty(); }
        return;
      }
      if (a.a === 'free') {
        if (!(G.key.s === 2 && G.key.c === id)) return;
        if (pos && Math.hypot(M.jail.door.x - pos.x, M.jail.door.y - pos.y) > 34) return;
        const who = Object.keys(G.jailed); if (!who.length) return;
        G.jailed = {}; G.freed = (G.freed || 0) + 1; G.key = { s: 0, at: elapsed() + KEY_RESPAWN };
        fx({ f: 'msg', text: `🔓 ${nameOf(id)}님이 감옥 문을 열었어요! (${who.length}명 탈출)` }); K.sfx('unlock');
        dirty(); return;
      }
      if (a.a === 'inst') {
        const p = G.pieces.find(x => x.s === 2 && x.c === id); if (!p) return;
        if (pos && Math.hypot(M.hole.x - pos.x, M.hole.y - pos.y) > 34) return;
        p.s = 3; p.c = null; G.inst++;
        fx({ f: 'msg', text: `🪜 사다리가 설치되었습니다 (${G.inst}/3)`, big: 1 });
        if (G.inst >= 3) fx({ f: 'msg', text: '🕳️ 지상으로 가는 길이 열렸어요! 구멍에서 확인을 눌러 탈출하세요!', big: 1 });
        dirty(); return;
      }
      if (a.a === 'esc') {
        if (G.inst < 3) return;
        if (pos && Math.hypot(M.hole.x - pos.x, M.hole.y - pos.y) > 34) return;
        G.esc[id] = 1; for (const k of Object.keys(G.hides)) if (G.hides[k] === id) delete G.hides[k];
        if (G.key.s === 2 && G.key.c === id) G.key = { s: 1, x: M.hole.x + 18, y: M.hole.y + 6 };
        fx({ f: 'msg', text: `🌅 ${nameOf(id)}님이 탈출했어요!` });
        dirty(); checkWin(); return;
      }
    }
    function catchS(sid, by, found) {
      if (G.jailed[sid]) return;
      const sp = hostPos(sid) || { x: M.jail.out.x, y: M.jail.out.y };
      G.jailed[sid] = 1;
      for (const k of Object.keys(G.hides)) if (G.hides[k] === sid) delete G.hides[k];
      // whatever they carried falls where they were caught
      if (G.key.s === 2 && G.key.c === sid) G.key = { s: 1, x: Math.round(sp.x), y: Math.round(sp.y) };
      for (const p of G.pieces) if (p.s === 2 && p.c === sid) { p.s = 1; p.c = null; p.x = Math.round(sp.x + 8); p.y = Math.round(sp.y); }
      fx({ f: 'msg', text: `⛓️ ${nameOf(sid)}님이 ${found ? '숨은 곳에서 들켜' : ''} 감옥에 갇혔어요!`, jail: sid });
      dirty(); checkWin();
    }
    function checkWin() {
      if (!G || G.phase === 'end') return;
      const S = ids('s'), Mn = ids('m');
      if (Mn.length && Mn.every(id => G.down[id])) return end('s', '괴물을 모두 쓰러뜨렸어요!');
      if (!Mn.length) return end('s', '괴물이 모두 떠났어요');
      if (!S.length) return end('m', '생존자가 모두 떠났어요');
      if (S.every(id => G.esc[id])) return end('s', '모두 무사히 지상으로 탈출했어요!');
      if (S.every(id => G.esc[id] || G.jailed[id])) return end('m', S.some(id => G.esc[id]) ? '감옥에 남은 친구를 구하지 못했어요' : '생존자를 모두 감옥에 가뒀어요!');
      if (elapsed() > JAIL_MS + TIME_LIMIT) return end('m', '시간이 다 됐어요… 날이 밝기 전에 나가지 못했어요');
    }
    function end(w, why) { G.phase = 'end'; G.winner = w; G.why = why; dirty(); push(); }
    function hostTick() {
      if (!G || !TG.isHost()) return;
      const el = elapsed();
      if (G.phase === 'jail' && el >= JAIL_MS) { G.phase = 'play'; fx({ f: 'msg', text: '👹 감옥 문이 열렸어요!', big: 1 }); dirty(); }
      if (G.phase === 'play') {
        const lv = clamp(Math.floor((el - JAIL_MS) / SPEED_EVERY), 0, SPEED_MAX_STEPS);
        if (lv !== G.speedLv) { G.speedLv = lv; fx({ f: 'msg', text: `👣 괴물이 조금 더 빨라졌어요 (+${Math.round(lv * SPEED_STEP * 100)}%)` }); dirty(); }
        G.pieces.forEach((p, i) => { if (p.s === 0 && el - JAIL_MS >= PIECE_AT[i]) { p.s = 1; fx({ f: 'msg', text: `✨ 사다리 조각이 어딘가에 나타났어요! (${i + 1}/3)`, big: 1 }); dirty(); } });
        if (G.key.s === 0 && el >= G.key.at) { G.key = { s: 1, ...ptOf(pick(M.keyPts)) }; fx({ f: 'msg', text: '🗝️ 감옥 열쇠가 다시 나타났어요' }); dirty(); }
        checkWin();
      }
      if (H.dirty || now() - H.pushAt > 3000) push();
    }

    // ---------------- what everyone does with messages ----------------
    function applyState(g, fromHost) {
      const first = !G || G.seq == null;
      const was = G;
      G = g; TG.G = g;
      M = genMap(g.map);
      if (!TG.isHost() || first) { L.el0 = g.el || 0; L.elAt = now(); }
      if (!L.me && G.roles[me()]) { const s = spawnPos(me()); L.me = { x: s.x, y: s.y, vx: 0, vy: 0, dir: 'down', moving: false }; L.camX = s.x - VW / 2; L.camY = s.y - VH / 2; sendMove(true); }
      // I was caught: into the cell. I was let out: just outside its door.
      if (L.me && was) {
        const nowJ = !!G.jailed[me()], wasJ = !!(was.jailed && was.jailed[me()]);
        if (nowJ && !wasJ) { const J = M.jail; L.me.x = J.x0 + 16 + Math.random() * (J.x1 - J.x0 - 32); L.me.y = J.y0 + 28; L.me.vx = L.me.vy = 0; sendMove(true); K.sfx('catch'); L.flash = 1; }
        if (!nowJ && wasJ) { L.me.x = M.jail.out.x + (Math.random() * 30 - 15); L.me.y = M.jail.out.y; sendMove(true); K.sfx('unlock'); }
      }
      if (g.phase === 'end' && !L.endShown) { L.endShown = true; showEnd(); }
      if (g.phase !== 'end' && L.endShown) { L.endShown = false; hideEnd(); }
    }
    function onRemoteMove(p) {
      if (p.from === me()) return;
      const r = L.rem[p.from] || (L.rem[p.from] = { x: p.x, y: p.y, rx: p.x, ry: p.y, vx: 0, vy: 0, dir: 'down' });
      // assume it took about a tenth of a second to get here
      const e = { x: +p.x || 0, y: +p.y || 0 };
      const vx = clamp(p.vx | 0, -1, 1), vy = clamp(p.vy | 0, -1, 1);
      if (M && G && (vx || vy)) moveEnt(e, vx, vy, speedOf(p.from), 0.1, elapsed(), isMon(p.from));
      if (Math.hypot(e.x - r.x, e.y - r.y) > 90) { r.rx = e.x; r.ry = e.y; }
      r.x = e.x; r.y = e.y; r.vx = vx; r.vy = vy; r.dir = p.d || dirOf(vx, vy, r.dir); r.at = now();
      if (TG.isHost()) H.pos[p.from] = { x: +p.x || 0, y: +p.y || 0, vx, vy, at: now() };
    }
    function onFx(f) {
      const t = now();
      if (f.f === 'arrow') { if (f.from === me() && f.mine == null) return; L.bolts.push({ x: f.x, y: f.y, dx: f.dx, dy: f.dy, d: 0, mine: f.from === me(), id: f.from }); K.sfx('shoot'); return; }
      if (f.f === 'swing') { L.fx.push({ k: 'swing', x: f.x, y: f.y, at: t, d: f.d }); if (L.me && Math.hypot(L.me.x - f.x, L.me.y - f.y) < 140) K.sfx('hit'); return; }
      if (f.f === 'dmg') {
        const mp = f.m === me() ? L.me : L.rem[f.m];
        if (mp) L.fx.push({ k: 'dmg', x: mp.x, y: mp.y - 40, n: f.n, crit: f.crit, at: t });
        K.sfx('hit');
        if (f.m === me() && L.me) L.knock = { vx: f.kx * 140, vy: f.ky * 140, until: t + 160 };
        if (G && G.hp[f.m] != null && !TG.isHost()) G.hp[f.m] = Math.max(0, G.hp[f.m] - f.n);
        return;
      }
      if (f.f === 'msg') {
        if (f.who === 's' && amMon()) return;
        L.msg.push({ text: f.text, at: t, big: f.big }); if (L.msg.length > 4) L.msg.shift();
        if (f.big) K.sfx('pick');
        if (f.jail === me()) L.flash = 1;
        return;
      }
    }

    // ---------------- my own little world, every frame ----------------
    const MOVE_KEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
    function inputVec() {
      let x = 0, y = 0;
      for (const k in MOVE_KEYS) if (L.keys[k]) { x += MOVE_KEYS[k][0]; y += MOVE_KEYS[k][1]; }
      if (L.joy && L.joy.on) { x += L.joy.x; y += L.joy.y; }
      return [Math.sign(x), Math.sign(y)];
    }
    function myHide() { if (!G) return null; const k = Object.keys(G.hides).find(s => G.hides[s] === me()); return k == null ? null : +k; }
    function frozen() { return !G || !L.me || G.phase === 'end' || G.esc[me()] || (amMon() && G.down[me()]) || myHide() != null; }
    function step(dt, t) {
      if (!G || !M) return;
      // the host never hears its own state, so it opens and closes the result box here
      if (G.phase === 'end' && !L.endShown) { L.endShown = true; showEnd(); }
      if (G.phase !== 'end' && L.endShown) { L.endShown = false; hideEnd(); }
      const el = elapsed();
      const e = L.me;
      if (e) {
        let [vx, vy] = frozen() ? [0, 0] : inputVec();
        if (L.hold && (vx || vy)) { L.hold = 0; L.holdWhat = null; }
        if (L.knock && t < L.knock.until) { const k = { x: e.x, y: e.y }; moveEnt(k, Math.sign(L.knock.vx), Math.sign(L.knock.vy), Math.hypot(L.knock.vx, L.knock.vy), dt, el, true); e.x = k.x; e.y = k.y; }
        e.vx = vx; e.vy = vy; e.moving = moveEnt(e, vx, vy, speedOf(me()), dt, el, amMon());
        e.dir = dirOf(vx, vy, e.dir);
        if (myHide() != null) { const h = M.hides[myHide()]; e.x = h.x; e.y = h.y; }
        // a monster left behind when the cell closes is put outside
        if (amMon() && el >= JAIL_MS + OPEN_MS && inJail(e)) { e.x = M.jail.out.x; e.y = M.jail.out.y; sendMove(true); }
        sendMove(false);
        // walk over the key or a ladder piece to pick it up
        if (!amMon() && !G.jailed[me()] && t - H.lastPick > 400) {
          if (G.key.s === 1 && Math.hypot(G.key.x - e.x, G.key.y - e.y) < 14) { H.lastPick = t; act({ a: 'pick', w: 'key' }); }
          G.pieces.forEach((p, i) => { if (p.s === 1 && Math.hypot(p.x - e.x, p.y - e.y) < 14 && !G.pieces.some(q => q.s === 2 && q.c === me())) { H.lastPick = t; act({ a: 'pick', w: 'piece', i }); } });
        }
        // putting a ladder piece up: hold for three seconds
        if (L.hold && L.holdWhat === 'inst') { if (t - L.hold >= INSTALL_MS) { L.hold = 0; L.holdWhat = null; act({ a: 'inst' }); } }
      }
      for (const [id, r] of Object.entries(L.rem)) {
        if (!G.roles[id] && !TG.T) continue;
        if (r.vx || r.vy) moveEnt(r, r.vx, r.vy, speedOf(id), dt, el, isMon(id));
        r.moving = !!(r.vx || r.vy);
        r.rx += (r.x - r.rx) * Math.min(1, dt * 12); r.ry += (r.y - r.ry) * Math.min(1, dt * 12);
      }
      // arrows: mine decide whether they hit
      for (const b of L.bolts) {
        const sp = BOLT_SPEED * dt; b.x += b.dx * sp; b.y += b.dy * sp; b.d += sp;
        const ch = K.tileAt(M.room, Math.floor(b.x / TS), Math.floor(b.y / TS));
        if (b.d > BOLT_RANGE || ch === '#' || M.solids.some(s => b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h)) { b.dead = true; continue; }
        if (!b.mine) continue;
        for (const mid of ids('m')) {
          if (G.down[mid]) continue;
          const mp = mid === me() ? L.me : L.rem[mid]; if (!mp) continue;
          const crawl = G.skin[mid] === 'crawl';
          const hx = crawl ? 22 : 11, top = crawl ? 26 : 50;
          if (b.x > mp.rx - hx && b.x < mp.rx + hx && b.y > mp.ry - top && b.y < mp.ry + 4) { b.dead = true; act({ a: 'hit', m: mid, x: Math.round(mp.x), y: Math.round(mp.y), kx: b.dx, ky: b.dy }); break; }
        }
      }
      L.bolts = L.bolts.filter(b => !b.dead);
      L.fx = L.fx.filter(f => t - f.at < 900);
      // a heartbeat when a monster is near (for survivors)
      if (e && !amMon() && !G.esc[me()] && G.phase !== 'end') {
        let dmin = 1e9; for (const mid of ids('m')) { const r = L.rem[mid]; if (r && !G.down[mid]) dmin = Math.min(dmin, Math.hypot(r.x - e.x, r.y - e.y)); }
        if (dmin < 150 && t > L.beat) { L.beat = t + 380 + dmin * 4; K.sfx('heart'); }
      }
    }
    // Space: shoot (survivor) or strike (monster)
    function primary() {
      if (!G || !L.me || G.phase === 'end' || G.esc[me()]) return;
      const t = now(), e = L.me, el = elapsed();
      if (amMon()) {
        if (G.down[me()] || el < JAIL_MS || t - L.atkAt < ATK_CD) return;
        L.atkAt = t;
        const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[e.dir] || [0, 1];
        act({ a: 'atk', x: Math.round(e.x + v[0] * 12), y: Math.round(e.y + v[1] * 12), d: e.dir });
        if (!TG.isHost()) L.fx.push({ k: 'swing', x: e.x + v[0] * 12, y: e.y + v[1] * 12, at: t, d: e.dir });
        return;
      }
      if (G.jailed[me()] || myHide() != null || t - L.boltAt < BOLT_CD) return;
      L.boltAt = t;
      let [vx, vy] = inputVec(); if (!vx && !vy) { const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[e.dir] || [0, 1]; vx = v[0]; vy = v[1]; }
      const n = Math.hypot(vx, vy), dx = vx / n, dy = vy / n;
      const b = { x: e.x + dx * 8, y: e.y - 10 + dy * 6, dx, dy, d: 0, mine: true, id: me() };
      L.bolts.push(b); K.sfx('shoot');
      send({ t: 'hx', f: 'arrow', x: Math.round(b.x), y: Math.round(b.y), dx: +dx.toFixed(3), dy: +dy.toFixed(3) });
    }
    // Enter: hide / come out, open the cell, put up a ladder, climb out
    function nearest(list, e, r) { let best = -1, bd = r; list.forEach((h, i) => { const d = Math.hypot(h.x - e.x, h.y - e.y); if (d < bd) { bd = d; best = i; } }); return best; }
    function interactHint() {
      if (!G || !L.me || amMon() || G.phase === 'end' || G.esc[me()]) return null;
      const e = L.me;
      if (G.jailed[me()]) return null;
      if (myHide() != null) return { k: 'unhide', label: '나오기' };
      if (G.inst >= 3 && Math.hypot(M.hole.x - e.x, M.hole.y - e.y) < 30) return { k: 'esc', label: '🌅 탈출하기' };
      if (G.pieces.some(p => p.s === 2 && p.c === me()) && Math.hypot(M.hole.x - e.x, M.hole.y - e.y) < 30) return { k: 'inst', label: '🪜 사다리 설치 (3초 꾹)' };
      if (G.key.s === 2 && G.key.c === me() && Object.keys(G.jailed).length && Math.hypot(M.jail.door.x - e.x, M.jail.door.y - e.y) < 30) return { k: 'free', label: '🔓 감옥 문 열기' };
      const h = nearest(M.hides, e, 24); if (h >= 0 && G.hides[h] == null) return { k: 'hide', s: h, label: '🫣 숨기' };
      return null;
    }
    function secondary(down) {
      const h = interactHint();
      if (!down) { if (L.holdWhat === 'inst') { L.hold = 0; L.holdWhat = null; } return; }
      if (!h) return;
      if (h.k === 'inst') { if (!L.hold) { L.hold = now(); L.holdWhat = 'inst'; } return; }
      if (h.k === 'hide') { act({ a: 'hide', s: h.s }); K.sfx('hide'); return; }
      if (h.k === 'unhide') { act({ a: 'unhide' }); K.sfx('hide'); return; }
      act({ a: h.k });
    }

    // ---------------- drawing ----------------
    const LIGHT_S = 92, LIGHT_M = 106;
    function lightR() { return !inGame() || G.esc[me()] ? 140 : amMon() ? LIGHT_M : LIGHT_S; }
    function posOf(id) { if (id === me()) return L.me ? { x: L.me.x, y: L.me.y, rx: L.me.x, ry: L.me.y, dir: L.me.dir, moving: L.me.moving } : null; return L.rem[id] || null; }
    function camTarget() {
      if (L.me && inGame() && !G.esc[me()]) return L.me;
      const watch = ids('s').find(id => !G.esc[id] && !G.jailed[id]) || ids('s')[0] || ids('m')[0];
      const p = watch && posOf(watch); return p ? { x: p.rx, y: p.ry } : { x: M.jail.out.x, y: M.jail.out.y };
    }
    function visible(id) {
      if (id === me()) return true;
      if (G.esc[id]) return false;
      const spect = !inGame() || G.esc[me()];
      const hid = Object.values(G.hides).includes(id);
      if (spect) return true;
      if (hid) return !amMon();
      if (isMon(id) === amMon()) return true;
      const p = posOf(id), e = L.me; if (!p || !e) return false;
      return Math.hypot(p.rx - e.x, p.ry - e.y) < lightR() + 12;
    }
    function drawBars(g, x, y, open, lock) {
      P(g, x, y + 13, 16, 3, '#26242a'); P(g, x, y - 12, 16, 3, '#26242a');
      if (open) { P(g, x, y - 12, 2, 28, '#3a3a44'); return; }
      for (let i = 1; i < 16; i += 4) { P(g, x + i, y - 12, 2, 28, '#3a3a44'); P(g, x + i, y - 12, 1, 28, '#5a5a66'); }
      if (lock) { P(g, x + 6, y + 1, 5, 5, '#b08a3a'); P(g, x + 8, y + 3, 1, 2, '#26242a'); }
    }
    function drawHole(g, x, y, n, t) {
      g.fillStyle = '#05040a'; g.beginPath(); g.ellipse(x, y, 13, 9, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#4a3a2a'; g.lineWidth = 2; g.stroke();
      for (let i = 0; i < n; i++) { P(g, x - 5, y - 4 - i * 9, 2, 10, '#8a6040'); P(g, x + 3, y - 4 - i * 9, 2, 10, '#8a6040'); P(g, x - 5, y - 1 - i * 9, 10, 2, '#a8743a'); }
      if (n >= 3) { const a = 0.35 + Math.sin(t / 300) * 0.12; g.fillStyle = `rgba(255,230,160,${a})`; g.beginPath(); g.ellipse(x, y - 24, 14, 22, 0, 0, Math.PI * 2); g.fill(); }
    }
    function drawItem(g, kind, x, y, t) {
      const bob = Math.sin(t / 250) * 1.5;
      g.fillStyle = `rgba(255,236,150,${0.25 + Math.sin(t / 200) * 0.1})`; g.beginPath(); g.arc(x, y - 4 + bob, 8, 0, Math.PI * 2); g.fill();
      if (kind === 'key') { P(g, x - 4, y - 7 + bob, 4, 4, '#e0b84a'); P(g, x - 3, y - 6 + bob, 2, 2, '#14121a'); P(g, x, y - 6 + bob, 6, 2, '#e0b84a'); P(g, x + 4, y - 4 + bob, 1, 2, '#e0b84a'); }
      else { P(g, x - 4, y - 10 + bob, 2, 12, '#8a6040'); P(g, x + 2, y - 10 + bob, 2, 12, '#8a6040'); P(g, x - 4, y - 7 + bob, 8, 2, '#c99866'); P(g, x - 4, y - 2 + bob, 8, 2, '#c99866'); }
    }
    let miniCv = null, miniIdx = -1;
    function mini() {
      if (miniIdx === M.idx && miniCv) return miniCv;
      miniIdx = M.idx; miniCv = document.createElement('canvas'); miniCv.width = M.W; miniCv.height = M.H;
      const c = miniCv.getContext('2d');
      for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) { const ch = M.room.map[y][x]; c.fillStyle = ch === '#' ? 'rgba(0,0,0,0)' : ch === 'b' || ch === 'j' ? '#8a1f24' : 'rgba(220,210,190,.55)'; c.fillRect(x, y, 1, 1); }
      return miniCv;
    }
    function draw(t) {
      const D = L.dom; if (!D || !G || !M) return;
      const g = D.g, el = elapsed();
      const tgt = camTarget();
      const W = M.W * TS, Hh = M.H * TS;
      const cx = clamp(tgt.x - VW / 2, 0, W - VW), cy = clamp(tgt.y - 12 - VH / 2, 0, Hh - VH);
      L.camX += (cx - L.camX) * 0.2; L.camY += (cy - L.camY) * 0.2;
      const ox = Math.round(-L.camX), oy = Math.round(-L.camY);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05040a'; g.fillRect(0, 0, VW, VH);
      g.setTransform(1, 0, 0, 1, ox, oy);
      g.drawImage(M.room.cv, 0, 0);
      for (const o of M.objs) { const d = FT[o.t]; if (d.flat || d.wall) d.draw(g, o.x * TS, o.y * TS, o, t); }
      drawHole(g, M.hole.x, M.hole.y, G.inst, t);
      if (G.key.s === 1) drawItem(g, 'key', G.key.x, G.key.y, t);
      for (const p of G.pieces) if (p.s === 1) drawItem(g, 'piece', p.x, p.y, t);
      const list = [];
      for (const o of M.objs) { const d = FT[o.t]; if (!d.flat && !d.wall) list.push({ y: (o.y + d.h) * TS - 1, o }); }
      for (let ty = 0; ty < M.H; ty++) for (let tx = 0; tx < M.W; tx++) { const ch = M.room.map[ty][tx]; if (ch === 'b' || ch === 'j') list.push({ y: ty * TS + 15, bar: [tx * TS, ty * TS, ch === 'j'] }); }
      for (const id of Object.keys(G.roles)) {
        if (!visible(id)) continue;
        const p = posOf(id); if (!p) continue;
        const hid = Object.values(G.hides).includes(id);
        list.push({ y: p.ry, id, p, hid });
      }
      list.sort((a, z) => a.y - z.y);
      const look0 = O.lookOf(me());
      for (const e of list) {
        if (e.o) FT[e.o.t].draw(g, e.o.x * TS, e.o.y * TS, e.o, t);
        else if (e.bar) drawBars(g, e.bar[0], e.bar[1], e.bar[2] && jailOpen(el), e.bar[2]);
        else if (isMon(e.id)) K.drawMon(g, G.skin[e.id], e.p.rx, e.p.ry, e.p.dir, t, { moving: e.p.moving, alpha: G.down[e.id] ? 0.4 : 1 });
        else K.drawPerson(g, (e.id === me() ? look0 : O.lookOf(e.id)) || look0, e.p.rx, e.p.ry, e.p.dir || 'down', e.p.moving, t, e.hid ? { alpha: 0.35 } : null);
      }
      for (const b of L.bolts) { g.strokeStyle = '#e8dcc2'; g.lineWidth = 1; g.beginPath(); g.moveTo(b.x - b.dx * 6, b.y - b.dy * 6); g.lineTo(b.x, b.y); g.stroke(); P(g, b.x - 1, b.y - 1, 2, 2, '#c9c9d4'); }
      for (const f of L.fx) if (f.k === 'swing') { const a = 1 - (t - f.at) / 900; g.strokeStyle = `rgba(255,80,80,${a})`; g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y - 8, 12, 0, Math.PI * 2); g.stroke(); }
      // the dark
      g.setTransform(1, 0, 0, 1, 0, 0);
      const lights = [];
      if (L.me && inGame() && !G.esc[me()]) lights.push({ x: L.me.x + ox, y: L.me.y - 10 + oy, r: lightR() * (1 + Math.sin(t / 140) * 0.02) });
      else lights.push({ x: tgt.x + ox, y: tgt.y - 10 + oy, r: 140 });
      for (const o of M.objs) if (o.t === 'candle') lights.push({ x: o.x * TS + 8 + ox, y: o.y * TS + oy, r: 44, a: 0.8 });
      if (G.inst >= 3) lights.push({ x: M.hole.x + ox, y: M.hole.y - 20 + oy, r: 70, a: 0.9 });
      if (K.darkness(D.dk, D.dkg, M.th.dark, lights, VW, VH)) g.drawImage(D.dk, 0, 0);
      if (L.flash) { g.fillStyle = `rgba(150,0,10,${L.flash * 0.5})`; g.fillRect(0, 0, VW, VH); L.flash = Math.max(0, L.flash - 0.02); }
      hud(t, ox, oy, el);
    }
    function hud(t, ox, oy, el) {
      const D = L.dom, c = D.hg, k = D.k, w = D.hud.width / k, h = D.hud.height / k;
      c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, w, h);
      const s = w / VW, Z = clamp(w / 560, 1, 1.7), fam = getComputedStyle(document.body).fontFamily, font = (px, wgt) => `${wgt || 700} ${Math.round(px * Z)}px ${fam}`;
      const tx = (text, x, y, col, px, al, wgt, raw) => { c.font = raw ? `${wgt || 700} ${px}px ${fam}` : font(px || 12, wgt); c.textAlign = al || 'left'; c.textBaseline = 'middle'; c.lineWidth = raw ? Math.max(4, px / 10) : 3; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(text, x, y); c.fillStyle = col || '#fff8ea'; c.fillText(text, x, y); };
      // names over people
      for (const id of Object.keys(G.roles)) {
        if (!visible(id)) continue; const p = posOf(id); if (!p) continue;
        const sx = (p.rx + ox) * s, sy = (p.ry + oy - (isMon(id) ? (G.skin[id] === 'crawl' ? 34 : 70) : 28)) * s;
        if (sx < -40 || sx > w + 40 || sy < -20 || sy > h + 20) continue;
        tx(nameOf(id) + (G.jailed[id] ? ' ⛓️' : '') + (G.down[id] ? ' 💫' : ''), sx, sy, isMon(id) ? '#ff8a8a' : id === me() ? '#ffd65a' : '#9fe8a8', 11, 'center');
      }
      // my role
      const role = !inGame() ? '👀 구경 중' : amMon() ? `👹 괴물 · ${MON_KO[G.skin[me()]]}` : G.esc[me()] ? '🌅 탈출 성공!' : G.jailed[me()] ? '⛓️ 감옥' : '🧍 생존자';
      const narrow = w < 520, mk = Math.min(2.2, (w * (narrow ? 0.3 : 0.26)) / M.W), mmH = M.H * mk;
      c.fillStyle = 'rgba(10,8,14,.7)'; c.fillRect(6, 6, 150 * Z, 22 * Z); tx(role, 12, 6 + 11 * Z, amMon() ? '#ff8a8a' : '#fff8ea', 12);
      // on a phone the goal line goes on its own row under the minimap, and the health bars go under that
      const topY = narrow ? Math.max(6 + 26 * Z, 8 + mmH + 6) : 6;
      // monsters' health
      let yy = narrow ? topY + 24 * Z : 6 + 26 * Z;
      for (const mid of ids('m')) {
        const hp = G.hp[mid] || 0, f = hp / MON_HP, bw = 150 * Z - 8;
        c.fillStyle = 'rgba(10,8,14,.7)'; c.fillRect(6, yy, 150 * Z, 17 * Z);
        c.fillStyle = '#3a1a1e'; c.fillRect(10, yy + 11 * Z, bw, 4 * Z); c.fillStyle = G.down[mid] ? '#555' : f > 0.5 ? '#e0514a' : f > 0.2 ? '#f0a030' : '#ffe06a'; c.fillRect(10, yy + 11 * Z, bw * f, 4 * Z);
        tx(`${MON_KO[G.skin[mid]]} ${hp}/${MON_HP}${G.down[mid] ? ' · 쓰러짐' : ''}`, 10, yy + 6 * Z, '#e8dcc2', 9, 'left', 600);
        yy += 20 * Z;
      }
      // the goal line at the top
      const pieceTxt = G.pieces.filter(p => p.s >= 1).length ? `🪜 설치 ${G.inst}/3` : narrow ? '🪜 조각 아직' : `🪜 사다리 조각 아직 안 나옴`;
      const keyTxt = G.key.s === 2 ? `🗝️ ${G.key.c === me() ? '내가' : nameOf(G.key.c) + '님이'}${narrow ? ' 가짐' : ' 열쇠 가짐'}` : G.key.s === 1 ? (narrow ? '🗝️ 어딘가에' : '🗝️ 열쇠가 어딘가에') : (narrow ? '🗝️ 곧 다시' : '🗝️ 열쇠 다시 나오는 중');
      const left = Math.max(0, Math.round((JAIL_MS + TIME_LIMIT - el) / 1000));
      const top = G.phase === 'jail' ? `👹 괴물 풀려나기까지 ${Math.max(0, Math.ceil((JAIL_MS - el) / 1000))}초` : `${pieceTxt} · ${keyTxt} · ⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      c.font = font(11, 600); const tw = c.measureText(top).width + 16;
      c.fillStyle = 'rgba(10,8,14,.72)'; const tx0 = narrow ? 6 : w / 2 - tw / 2; c.fillRect(tx0, topY, tw, 20 * Z); tx(top, narrow ? 14 : w / 2, topY + 10 * Z, '#e8dcc2', 11, narrow ? 'left' : 'center', 600);
      // the minimap
      const mm = mini(), mw = M.W * mk, mh = mmH, mx = w - mw - 8, my = 8;
      c.fillStyle = 'rgba(10,8,14,.72)'; c.fillRect(mx - 3, my - 3, mw + 6, mh + 6); c.imageSmoothingEnabled = false; c.drawImage(mm, mx, my, mw, mh);
      const dot = (x, y, col, r) => { c.fillStyle = col; c.beginPath(); c.arc(mx + x / TS * mk, my + y / TS * mk, r || 2.2, 0, Math.PI * 2); c.fill(); };
      dot(M.hole.x, M.hole.y, G.inst >= 3 ? '#ffe08a' : '#7ad07a', 3);
      if (G.key.s === 1 && !amMon()) dot(G.key.x, G.key.y, '#e0b84a', 2.5);
      for (const p of G.pieces) if (p.s === 1) dot(p.x, p.y, '#5fd0e8', 2.5);
      for (const id of Object.keys(G.roles)) { if (id === me() || !visible(id) || G.esc[id]) continue; if (isMon(id) !== amMon() && inGame()) continue; const p = posOf(id); if (p) dot(p.rx, p.ry, isMon(id) ? '#ff6b6b' : '#8fe38a'); }
      if (L.me && inGame() && !G.esc[me()]) dot(L.me.x, L.me.y, '#ffffff', 2.8);
      // the countdown before the cell opens
      if (G.phase === 'jail' && el > JAIL_MS - 5000) {
        const n = Math.ceil((JAIL_MS - el) / 1000), ph = 1 - ((JAIL_MS - el) % 1000) / 1000;
        c.save(); c.globalAlpha = 1 - ph * 0.5; tx(String(n), w / 2, h / 2, '#ff2a2a', Math.round(h * (0.34 + ph * 0.08)), 'center', 900, true); c.restore();
        if (n !== L.lastCount) { L.lastCount = n; K.sfx('heart'); }
      }
      // messages
      const live = L.msg.filter(m => t - m.at < 4200);
      live.forEach((m, i) => { const a = clamp((4200 - (t - m.at)) / 600, 0, 1); c.globalAlpha = a; const px = m.big ? 15 : 12; c.font = font(px); const mw2 = c.measureText(m.text).width + 20; const y = (narrow ? Math.max(h * 0.3, topY + 60 * Z + ids('m').length * 20 * Z) : h * 0.3) + i * (px + 14) * Z; c.fillStyle = 'rgba(10,8,14,.78)'; c.fillRect(w / 2 - mw2 / 2, y - (px * Z) / 2 - 6, mw2, px * Z + 12); tx(m.text, w / 2, y, m.big ? '#ffd65a' : '#fff8ea', px, 'center'); });
      c.globalAlpha = 1;
      // bottom: what Space and Enter do right now
      if (inGame() && !G.esc[me()] && G.phase !== 'end') {
        const cd = amMon() ? Math.max(0, ATK_CD - (t - L.atkAt)) : Math.max(0, BOLT_CD - (t - L.boltAt));
        const a1 = amMon() ? (G.down[me()] ? '💫 쓰러졌어요' : el < JAIL_MS ? '감옥에서 기다리는 중…' : cd ? `👊 ${(cd / 1000).toFixed(1)}초` : '👊 [Space] 공격') : G.jailed[me()] ? '⛓️ 친구가 열쇠로 열어 줄 거예요' : myHide() != null ? '🫣 숨어 있어요' : cd ? `🏹 ${(cd / 1000).toFixed(1)}초` : '🏹 [Space] 석궁';
        const hint = interactHint();
        let line = a1 + (hint ? `   ·   [Enter] ${hint.label}` : '') + (L.carry ? '   ·   ' + L.carry : '');
        if (narrow) line = line.replace(/\[(Space|Enter)\] /g, '').replace(/   ·   /g, ' · ');
        c.font = font(12); const bw = c.measureText(line).width + 20;
        c.fillStyle = 'rgba(10,8,14,.78)'; c.fillRect(w / 2 - bw / 2, h - 8 - 22 * Z, bw, 22 * Z); tx(line, w / 2, h - 8 - 11 * Z, '#fff8ea', 12, 'center');
        if (L.hold && L.holdWhat === 'inst') { const f = clamp((t - L.hold) / INSTALL_MS, 0, 1); c.fillStyle = 'rgba(10,8,14,.8)'; c.fillRect(w / 2 - 80, h - 52, 160, 14); c.fillStyle = '#ffd65a'; c.fillRect(w / 2 - 78, h - 50, 156 * f, 10); tx('사다리 설치 중…', w / 2, h - 60, '#ffd65a', 11, 'center'); }
        if (D.btnA) D.btnA.textContent = amMon() ? (cd ? (cd / 1000).toFixed(1) : '👊 공격') : (cd ? (cd / 1000).toFixed(1) : '🏹 쏘기');
        if (D.btnB) { D.btnB.textContent = hint ? hint.label.replace(/ \(3초 꾹\)/, '') : '✋'; D.btnB.disabled = !hint; }
      }
      const carry = []; if (G.key.s === 2 && G.key.c === me()) carry.push('🗝️ 열쇠'); if (G.pieces.some(p => p.s === 2 && p.c === me())) carry.push('🪜 조각'); L.carry = carry.join(' ');
    }

    // ---------------- the window ----------------
    function fit() {
      const D = L.dom; if (!D) return;
      const W = D.stage.clientWidth, Hh = D.stage.clientHeight;
      if (!W || !Hh) return;
      const s = Math.max(0.5, Math.min(W / VW, Hh / VH));
      const cw = Math.floor(VW * s), ch = Math.floor(VH * s);
      for (const c of [D.cv, D.hud]) { c.style.width = cw + 'px'; c.style.height = ch + 'px'; }
      const k = Math.min(3, window.devicePixelRatio || 1);
      D.hud.width = Math.round(cw * k); D.hud.height = Math.round(ch * k); D.k = k;
    }
    function loop(t) {
      L.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - L.lastT) / 1000 || 0); L.lastT = t;
      try { step(dt, t); draw(t); } catch (e) { console.error(e); }
    }
    function typing() { const a = document.activeElement; return a && /INPUT|TEXTAREA/.test(a.tagName); }
    function onKey(e) {
      if (!L.dom || typing()) return;
      const root = document.getElementById('tg'); if (!root || root.hidden) return;
      const down = e.type === 'keydown';
      if (MOVE_KEYS[e.code]) { e.preventDefault(); L.keys[e.code] = down; return; }
      if (e.code === 'Space') { e.preventDefault(); if (down && !e.repeat) primary(); return; }
      if (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'NumpadEnter') { e.preventDefault(); if (e.repeat) return; secondary(down); }
    }
    function joystick(pad) {
      const j = el('div', 'hn-joy'), knob = el('div', 'hn-knob'); j.appendChild(knob);
      L.joy = { on: false, x: 0, y: 0 };
      const upd = ev => {
        const r = j.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = ev.clientX - cx, dy = ev.clientY - cy; const d = Math.hypot(dx, dy), max = r.width / 2;
        if (d < 10) { L.joy.x = L.joy.y = 0; knob.style.transform = ''; return; }
        // eight directions only: fewer changes, fewer messages
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        L.joy.x = Math.round(Math.cos(a)); L.joy.y = Math.round(Math.sin(a));
        const k = Math.min(d, max) / d; knob.style.transform = `translate(${dx * k * 0.6}px, ${dy * k * 0.6}px)`;
      };
      j.addEventListener('pointerdown', ev => { ev.preventDefault(); j.setPointerCapture(ev.pointerId); L.joy.on = true; upd(ev); });
      j.addEventListener('pointermove', ev => { if (L.joy.on) upd(ev); });
      const off = () => { L.joy.on = false; L.joy.x = L.joy.y = 0; knob.style.transform = ''; };
      j.addEventListener('pointerup', off); j.addEventListener('pointercancel', off);
      pad.appendChild(j);
    }
    function mount(body) {
      body.innerHTML = '';
      const wrap = el('div', 'hn-wrap');
      const stage = el('div', 'hn-stage');
      const cv = el('canvas', 'hn-cv'); cv.width = VW; cv.height = VH;
      const hudC = el('canvas', 'hn-hud');
      stage.append(cv, hudC); wrap.appendChild(stage);
      const pad = el('div', 'hn-pad'); joystick(pad);
      const btns = el('div', 'hn-btns');
      const A = el('button', 'hn-a', '🏹'), B = el('button', 'hn-b', '✋'); A.type = B.type = 'button';
      A.addEventListener('pointerdown', ev => { ev.preventDefault(); K.ac(); primary(); });
      B.addEventListener('pointerdown', ev => { ev.preventDefault(); K.ac(); secondary(true); });
      B.addEventListener('pointerup', () => secondary(false)); B.addEventListener('pointerleave', () => secondary(false)); B.addEventListener('pointercancel', () => secondary(false));
      btns.append(B, A); pad.appendChild(btns); wrap.appendChild(pad);
      const endBox = el('div', 'hn-end'); endBox.hidden = true; stage.appendChild(endBox);
      body.appendChild(wrap);
      const dk = document.createElement('canvas'); dk.width = VW; dk.height = VH;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      L.dom = { wrap, stage, cv, g, hud: hudC, hg: hudC.getContext('2d'), k: 1, dk, dkg: dk.getContext('2d'), endBox, btnA: A, btnB: B };
      K.loadMon();
      G = TG.G; if (G) { M = genMap(G.map); if (!L.me && G.roles[me()]) applyState(G); }
      window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true); window.addEventListener('resize', fit);
      setTimeout(fit, 30); setTimeout(fit, 300);
      cancelAnimationFrame(L.raf); L.lastT = now(); L.raf = requestAnimationFrame(loop);
      if (G && G.phase === 'end') { L.endShown = true; showEnd(); }
    }
    function unmount() {
      cancelAnimationFrame(L.raf); L.raf = 0;
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('resize', fit);
      clearTimeout(L.sendT);
      L.dom = null; L.me = null; L.rem = {}; L.bolts = []; L.fx = []; L.msg = []; L.endShown = false; L.hold = 0; L.keys = Object.create(null); L.knock = null;
      G = null; M = null; H.pos = {};
    }
    function showEnd() {
      const D = L.dom; if (!D || !G) return;
      const box = D.endBox; box.innerHTML = ''; box.hidden = false;
      const mine = inGame() ? (G.winner === G.roles[me()]) : null;
      box.appendChild(el('h3', '', G.winner === 's' ? '🌅 생존자 승리!' : '👹 괴물 승리!'));
      box.appendChild(el('p', 'hn-why', G.why || ''));
      if (mine != null) box.appendChild(el('p', 'hn-me', mine ? '🎉 우리 편이 이겼어요!' : '😵 아쉽게 졌어요…'));
      const list = el('div', 'hn-list');
      for (const id of Object.keys(G.roles)) {
        const tag = isMon(id) ? `👹 ${MON_KO[G.skin[id]]}${G.down[id] ? ' · 쓰러짐' : ''}` : G.esc[id] ? '🌅 탈출' : G.jailed[id] ? '⛓️ 감옥' : '🧍 남음';
        list.appendChild(el('p', '', `${nameOf(id)} — ${tag}`));
      }
      box.appendChild(list);
      if (TG.isHost()) { const b = el('button', 'btn btn-gold', '대기실로 돌아가기'); b.type = 'button'; b.addEventListener('click', () => TG.backToLobby()); box.appendChild(b); }
      else box.appendChild(el('p', 'hn-why', '방장이 대기실로 돌아가면 다시 할 수 있어요.'));
      K.sfx(G.winner === 's' ? 'pick' : 'catch');
    }
    function hideEnd() { if (L.dom) { L.dom.endBox.hidden = true; L.dom.endBox.innerHTML = ''; } }
    function lobbyExtra(body) {
      const T = TG.T; if (!T) return;
      const box = el('div', 'hn-maps');
      box.appendChild(el('b', '', '🗺️ 맵 고르기' + (TG.isHost() ? '' : ' (방장이 골라요)')));
      const row = el('div', 'hn-maprow');
      const cur = T.map == null ? -1 : T.map;
      [[-1, '🎲 랜덤', '셋 중 하나를 무작위로']].concat(THEMES.map((th, i) => [i, th.name, th.blurb])).forEach(([i, nm, bl]) => {
        const b = el('button', 'btn hn-map' + (cur === i ? ' btn-gold' : ''), ''); b.type = 'button';
        b.append(el('strong', '', nm), el('small', '', bl));
        b.disabled = !TG.isHost(); b.setAttribute('aria-pressed', String(cur === i));
        b.addEventListener('click', () => { if (!TG.isHost()) return; T.map = i; TG.bump(); });
        row.appendChild(b);
      });
      box.appendChild(row); body.appendChild(box);
      const d = el('details', 'tg-help'); d.open = true; d.appendChild(el('summary', '', '어떻게 하나요?'));
      [`3~5명이면 괴물 1명, 6명이면 괴물 2명. 누가 괴물인지는 시작할 때 무작위로 정해져요.`,
        `괴물은 처음 15초 동안 감옥에 갇혀 있어요. 마지막 5초는 화면 가운데 빨간 숫자로 세요. 그 사이에 흩어져 숨으세요!`,
        `생존자: [Space] 석궁 (3초에 한 발, 화살 무제한). 맞은 괴물은 살짝 밀려나요. 괴물 체력 50, 한 발에 1 (10% 확률로 치명타 2).`,
        `괴물: [Space] 공격. 잡힌 생존자는 감옥으로! 숨은 곳 앞에서 공격하면 숨은 사람도 찾아내요. 시간이 갈수록 조금씩 빨라져요.`,
        `[Enter] 옷장·통·상자에 숨기 / 나오기. 열쇠를 주워 감옥 문 앞에서 [Enter] 하면 갇힌 친구들이 풀려나요.`,
        `후반에 사다리 조각 3개가 하나씩 나타나요. 지도의 초록 점(구멍)에서 [Enter]를 3초 꾹 눌러 설치하세요. 3개를 다 설치하면 모두 구멍으로 탈출! 갇힌 친구까지 다 나가야 생존자 승리예요.`,
        `괴물을 모두 쓰러뜨려도 생존자 승리, 생존자를 모두 가두면 괴물 승리. 폰은 왼쪽 조이스틱으로 움직여요.`
      ].forEach(t => d.appendChild(el('p', '', '· ' + t)));
      body.appendChild(d);
    }

    const INFO = { title: '저택 술래잡기', icon: '👹', min: 3, max: MAX_PLAYERS, blurb: `괴물과 생존자로 나뉘어 어두운 지하에서 쫓고 쫓겨요. 숨고, 석궁으로 막고, 갇힌 친구를 구하고, 사다리를 세워 탈출하세요! 3~${MAX_PLAYERS}명.` };
    const GAME = {
      start() {
        unmountKeep();
        G = newGame(); M = genMap(G.map); H.t0 = now(); H.pos = {}; H.dirty = true;
        TG.G = G;
        if (G.roles[me()]) { const s = spawnPos(me()); L.me = { x: s.x, y: s.y, vx: 0, vy: 0, dir: 'down', moving: false }; }
      },
      push(to) { push(to); },
      fastTick: hostTick,
      tick() {},
      onMsg(p) {
        if (p.t === 'hs') {
          if (!p.g || p.from !== (TG.T && TG.T.host)) return;
          const cur = TG.G;
          if (cur && cur.kind === 'hunt' && p.g.seq < cur.seq && p.g.map === cur.map && Object.keys(p.g.roles).join() === Object.keys(cur.roles).join()) return;
          const fresh = !cur || cur.kind !== 'hunt';
          if (fresh) { L.me = null; L.rem = {}; L.endShown = false; }
          applyState(p.g, true);
          if (fresh) TG.render();
          return;
        }
        if (!G) return;
        if (p.t === 'hm') return onRemoteMove(p);
        if (p.t === 'ha') { if (TG.isHost()) hostAct(p.from, p); return; }
        if (p.t === 'hx') { if (p.f === 'arrow' || p.from === (TG.T && TG.T.host)) onFx(p); return; }
      },
      mount, unmount, update() {},
      memberLeft(id, self) {
        if (!G || self) return;
        dropAll(id); delete G.roles[id]; delete G.skin[id]; delete G.hp[id]; delete G.jailed[id]; delete G.esc[id];
        checkWin(); dirty(); push();
      },
      memberGone(id) { TG.hostLeave(id); },
      handover() { H.t0 = now() - (G ? G.el || 0 : 0); H.pos = {}; H.dirty = true; },
      lobbyExtra,
      myTurn() { return false; }
    };
    function dropAll(id) {
      for (const k of Object.keys(G.hides)) if (G.hides[k] === id) delete G.hides[k];
      if (G.key.s === 2 && G.key.c === id) { const p = hostPos(id) || M.jail.out; G.key = { s: 1, x: Math.round(p.x), y: Math.round(p.y) }; }
      for (const pc of G.pieces) if (pc.s === 2 && pc.c === id) { const p = hostPos(id) || M.jail.out; pc.s = 1; pc.c = null; pc.x = Math.round(p.x); pc.y = Math.round(p.y); }
    }
    function unmountKeep() { L.me = null; L.rem = {}; L.bolts = []; L.fx = []; L.msg = []; L.endShown = false; hideEnd(); }

    TG.register('hunt', 'mansion', INFO, GAME);
    if (/[?&]debug\b/.test(location.search)) window.__hunt = { sync: () => sendMove(true), get G() { return G; }, get L() { return L; }, get M() { return M; }, genMap, THEMES, hostAct, elapsed, primary, secondary, interactHint, push, checkWin, set t0(v) { H.t0 = v; }, get H() { return H; } };
  }
})();
