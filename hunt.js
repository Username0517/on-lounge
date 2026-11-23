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
    // the view is 320x240 world pixels, stretched taller on a phone held upright (or wider on its side) so the game fills the screen
    const VW0 = 320, VH0 = 240;
    let VW = VW0, VH = VH0;
    // 밸런스 (3차 패치): 석궁을 자주 쏘고, 맞으면 잠깐 멈칫 → 그 틈에 도망
    const SURV_SPEED = 68, MON_SPEED = 60, SPEED_STEP = 0.03, SPEED_EVERY = 60000, SPEED_MAX_STEPS = 4;
    const JAIL_MS = 15000, OPEN_MS = 6000, MON_HP = 60, BOLT_CD = 1200, BOLT_SPEED = 270, BOLT_RANGE = 240;
    const ATK_CD = 1100, ATK_REACH = 20, INSTALL_MS = 2000, KEY_RESPAWN = 8000;
    const STUN_MS = 800, STUN_IMMUNE = 1000;           // 화살에 맞으면 0.8초 기절, 깨어난 뒤 1초는 다시 기절하지 않음
    const BOOST_MS = 4000, BOOST_MUL = 1.4, BOOST_RESPAWN = 25000;   // ⚡ 각성제: 4초 동안 1.4배 빠르게, 25초 뒤 다시 생김
    const PASS_CD = 6000;                              // 비밀 통로는 한 번 쓰면 6초 뒤에 다시
    const SELF_FREE_MS = 45000;                        // 감옥에서 45초가 지나면 스스로 탈옥 (감옥 지키기 방지)
    const TIME_LIMIT = 600000;
    const monstersFor = n => (n >= 6 ? 2 : 1);
    // 괴물 모습: 기어다니는 거미손, 떠다니는 얼굴 (방장이 대기실에서 골라요)
    const SKINS = ['crawl', 'face'];
    const MON_KO = { crawl: '거미손', face: '떠도는 얼굴', blue: '물끄러미', grin: '히죽이', scream: '아우성' };
    const MON_LOOKS = [[0, '🕷️ 거미손', '네 발로 기어와요'], [1, '😱 떠도는 얼굴', '얼굴만 떠다녀요'], [-1, '🎲 섞어서', '괴물마다 무작위']];

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
      // everything here must come from R, never Math.random: every screen has to build exactly the same map
      const shuffleR = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const ri = (lo, hi) => lo + (R() * (hi - lo + 1) | 0);
      // 5x3 cells. Each cell gets a room of a different kind: plain rooms, small closets, pillared halls,
      // a courtyard with a block in the middle to run round, L-shaped rooms, and long two-cell galleries.
      const COLS = 5, ROWS = 3, CW = 13, CH = 11, W = COLS * CW + 1, H = ROWS * CH + 3;
      const g = Array.from({ length: H }, () => Array(W).fill('#'));
      const carve = (x, y) => { if (x > 0 && y > 1 && x < W - 1 && y < H - 1) g[y][x] = '.'; };
      const wall = (x, y) => { if (x > 0 && y > 1 && x < W - 1 && y < H - 1) g[y][x] = '#'; };
      const JC = [2, 1];
      const rooms = [], anchor = [];   // anchor[cell] = { mx, my, room } — where corridors meet that cell
      const cellId = (cx, cy) => cy * COLS + cx;
      const KINDS = ['normal', 'normal', 'small', 'pillars', 'ring', 'L'];
      for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
        if (anchor[cellId(cx, cy)]) continue;
        const isJ = cx === JC[0] && cy === JC[1];
        const canMerge = !isJ && cx + 1 < COLS && !(cx + 1 === JC[0] && cy === JC[1]) && !anchor[cellId(cx + 1, cy)];
        const kind = isJ ? 'jail' : canMerge && R() < 0.3 ? 'gallery' : KINDS[R() * KINDS.length | 0];
        let w, h;
        if (kind === 'gallery') { w = 2 * CW - 3 - ri(0, 2); h = ri(6, 8); }
        else if (kind === 'jail') { w = ri(8, 9); h = ri(6, 7); }
        else if (kind === 'small') { w = ri(5, 6); h = ri(4, 5); }
        else if (kind === 'pillars' || kind === 'ring') { w = ri(9, 11); h = ri(7, 8); }
        else if (kind === 'L') { w = ri(8, 10); h = ri(6, 8); }
        else { w = ri(6, 9); h = ri(5, 7); }
        const span = kind === 'gallery' ? 2 * CW : CW;
        const x0 = cx * CW + 2 + (R() * Math.max(1, span - w - 2) | 0), y0 = cy * CH + 3 + (R() * Math.max(1, CH - h - 2) | 0);
        const r = { id: rooms.length, cx, cy, kind, x0, y0, w, h, mx: x0 + (w >> 1), my: y0 + (h >> 1), nb: [] };
        rooms.push(r);
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) carve(x, y);
        // the shape inside
        if (kind === 'pillars') { for (let y = y0 + 2; y <= y0 + h - 3; y += 3) for (let x = x0 + 2; x <= x0 + w - 3; x += 3) wall(x, y); }
        if (kind === 'gallery') { for (const y of [y0 + 1, y0 + h - 2]) for (let x = x0 + 3; x <= x0 + w - 4; x += 4) wall(x, y); }
        if (kind === 'ring') { for (let y = y0 + 3; y <= y0 + h - 4; y++) for (let x = x0 + 3; x <= x0 + w - 4; x++) wall(x, y); }
        if (kind === 'L') { const cw = (w >> 1) - 1, ch = (h >> 1) - 1, right = R() < 0.5, low = R() < 0.5; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) wall(right ? x0 + w - 1 - x : x0 + x, low ? y0 + h - 1 - y : y0 + y); }
        if (kind === 'gallery') {
          anchor[cellId(cx, cy)] = { mx: x0 + 4, my: r.my, room: r };
          anchor[cellId(cx + 1, cy)] = { mx: x0 + w - 5, my: r.my, room: r };
        } else anchor[cellId(cx, cy)] = { mx: r.mx, my: r.my, room: r };
      }
      // a random spanning tree over the cells, then extra links so there are loops to run round
      const NC = COLS * ROWS, seen = new Set([0]), stack = [0], edges = [];
      const nbOf = c => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c % COLS + dx, (c / COLS | 0) + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < COLS && y < ROWS).map(([x, y]) => cellId(x, y));
      while (stack.length) {
        const c = stack[stack.length - 1], nbs = nbOf(c).filter(n => !seen.has(n));
        if (!nbs.length) { stack.pop(); continue; }
        const n = nbs[R() * nbs.length | 0]; seen.add(n); stack.push(n); edges.push([c, n]);
      }
      for (let c = 0; c < NC; c++) for (const n of nbOf(c)) if (n > c && !edges.some(([a, b]) => (a === c && b === n) || (a === n && b === c)) && R() < 0.42) edges.push([c, n]);
      for (const [a, b] of edges) {
        const A = anchor[a], B = anchor[b];
        if (A.room !== B.room) { if (!A.room.nb.includes(B.room.id)) A.room.nb.push(B.room.id); if (!B.room.nb.includes(A.room.id)) B.room.nb.push(A.room.id); }
        const wd = R() < 0.3 ? 3 : 2;   // corridors are two or three tiles wide
        if ((a % COLS) !== (b % COLS)) { const y = A.my; for (let x = Math.min(A.mx, B.mx); x <= Math.max(A.mx, B.mx); x++) for (let k = 0; k < wd; k++) carve(x, y + k); }
        else { const x = A.mx; for (let y = Math.min(A.my, B.my); y <= Math.max(A.my, B.my); y++) for (let k = 0; k < wd; k++) carve(x + k, y); }
      }
      // the cell: in the middle room, walled by bars with one door at the bottom
      const J = anchor[cellId(JC[0], JC[1])].room;
      const jx0 = J.mx - 3, jy0 = J.y0, jw = 6, jh = 3;
      for (let y = jy0 - 1; y <= jy0 + jh; y++) for (let x = jx0 - 1; x <= jx0 + jw; x++) {
        const edge = y === jy0 - 1 || y === jy0 + jh || x === jx0 - 1 || x === jx0 + jw;
        if (!edge) { g[y][x] = '.'; continue; }
        if (y === jy0 - 1) { g[y][x] = '#'; continue; }
        g[y][x] = 'b';
      }
      const jdoor = [J.mx, jy0 + jh]; g[jdoor[1]][J.mx - 1] = 'j'; g[jdoor[1]][J.mx] = 'j';
      for (let x = jx0 - 2; x <= jx0 + jw + 1; x++) { carve(x, jy0 - 2); carve(x, jy0 + jh + 1); carve(x, jy0 + jh + 2); }
      for (let y = jy0 - 2; y <= jy0 + jh + 2; y++) { carve(jx0 - 2, y); carve(jx0 + jw + 1, y); }
      // the hole up to the ground: the room furthest from the cell
      const dist = new Map([[J.id, 0]]), q = [J.id];
      while (q.length) { const c = q.shift(); for (const n of rooms[c].nb) if (!dist.has(n)) { dist.set(n, dist.get(c) + 1); q.push(n); } }
      const far = rooms.slice().sort((a, z) => (dist.get(z.id) || 0) - (dist.get(a.id) || 0));
      const HR = far[0];
      // a floor tile in a room, near a wanted spot if possible
      const isFloor = (x, y) => g[y] && g[y][x] === '.';
      const floorNear = (r, x, y) => { let best = null, bd = 1e9; for (let yy = r.y0; yy < r.y0 + r.h; yy++) for (let xx = r.x0; xx < r.x0 + r.w; xx++) if (isFloor(xx, yy) && isFloor(xx, yy + 1)) { const d = Math.abs(xx - x) + Math.abs(yy - y); if (d < bd) { bd = d; best = [xx, yy]; } } return best || [r.mx, r.my]; };
      const floorIn = r => { for (let k = 0; k < 30; k++) { const x = r.x0 + 1 + (R() * Math.max(1, r.w - 2) | 0), y = r.y0 + 1 + (R() * Math.max(1, r.h - 2) | 0); if (isFloor(x, y)) return [x, y]; } return floorNear(r, r.mx, r.my); };
      const [hx0, hy0] = floorNear(HR, HR.mx, HR.my);
      const hole = { x: hx0 * TS + 8, y: hy0 * TS + 8 };
      // furniture, hiding places, and points where the key and the ladder pieces can turn up
      const objs = [], hides = [], keyPts = [], piecePts = [], spawns = [], boostPts = [], passages = [];
      const free = (x, y) => g[y] && g[y][x] === '.' && !objs.some(o => o.x === x && (o.y === y || (FT[o.t].h > 1 && o.y + 1 === y)));
      const clearOf = (x, y, rr) => { for (const o of anchor) if (o && Math.abs(x - o.mx) <= rr + 1 && Math.abs(y - o.my) <= 2) return false; return true; };
      const northCols = r => shuffleR(Array.from({ length: r.w }, (_, i) => r.x0 + i)).filter(x => isFloor(x, r.y0) && isFloor(x, r.y0 + 1) && g[r.y0 - 1][x] === '#' && clearOf(x, r.y0, 1));
      for (const r of rooms) {
        if (r === J) continue;
        const cols = northCols(r);
        let nh = r === HR ? 0 : (r.kind === 'small' ? 1 : 1 + (R() < 0.6 ? 1 : 0)) + (r.kind === 'gallery' ? 1 : 0), nt = 1;
        for (const x of cols) {
          if (nh > 0) { const t = th.hide[R() * th.hide.length | 0], tall = FT[t].h > 1; const o = { t, x, y: tall ? r.y0 - 1 : r.y0, hide: true }; if (free(x, r.y0)) { objs.push(o); hides.push({ x: x * TS + 8, y: (r.y0 + 1) * TS - 2, o }); nh--; } continue; }
          if (nt > 0) { const t = th.tall[R() * th.tall.length | 0]; if (free(x, r.y0)) { objs.push({ t, x, y: r.y0 - 1 }); nt--; } continue; }
          if (R() < 0.35) objs.push({ t: th.deco[R() * th.deco.length | 0], x, y: r.y0 - 1, art: ['photo', 'landscape', 'girl'][R() * 3 | 0] });
        }
        // a hiding place in a lower corner too
        const cx = R() < 0.5 ? r.x0 : r.x0 + r.w - 1, cy = r.y0 + r.h - 1;
        if (r !== HR && free(cx, cy) && isFloor(cx, cy - 1) && clearOf(cx, cy, 1)) { const t = th.hide[R() * th.hide.length | 0]; if (FT[t].h === 1) { objs.push({ t, x: cx, y: cy, hide: true }); hides.push({ x: cx * TS + 8, y: cy * TS + 14, o: objs[objs.length - 1] }); } }
        if (R() < 0.5) { const [sx, sy] = floorIn(r); objs.push({ t: 'stain', x: sx, y: sy }); }
        // big rooms get candles (a little light); small ones stay pitch dark
        const nc = r.kind === 'gallery' ? 2 : r.kind === 'small' ? 0 : R() < 0.45 ? 1 : 0;
        for (let k = 0; k < nc; k++) { const x = k ? r.x0 : r.x0 + r.w - 1, y = r.y0; if (free(x, y) && clearOf(x, y, 1)) objs.push({ t: 'candle', x, y }); }
        const kp = floorIn(r); keyPts.push([kp[0] * TS + 8, kp[1] * TS + 8]);
        if (r !== HR) { const a1 = floorNear(r, r.mx, r.my + 1), a2 = floorIn(r); piecePts.push([a1[0] * TS + 8, a1[1] * TS + 10], [a2[0] * TS + 8, a2[1] * TS + 8]); }
        if ((dist.get(r.id) || 0) >= 2) { const sp = floorNear(r, r.mx, r.my + 1); spawns.push([sp[0] * TS + 8, sp[1] * TS + 12]); }
      }
      // energy drinks (a short burst of speed for survivors): three rooms
      for (const r of shuffleR(rooms.filter(r => r !== J && r !== HR)).slice(0, 3)) { const [x, y] = floorIn(r); boostPts.push([x * TS + 8, y * TS + 10]); }
      // two secret passages: a bookcase in one room opens onto a bookcase in a far-away room (survivors only)
      const cand = shuffleR(rooms.filter(r => r !== J && r !== HR));
      const used = new Set();
      for (let k = 0, tries = 0; passages.length < 2 && tries < 12; tries++) {
        let pair = null;
        for (const A of cand) { if (used.has(A.id)) continue; for (const B of cand) { if (B === A || used.has(B.id)) continue; if (Math.abs(A.cx - B.cx) + Math.abs(A.cy - B.cy) >= 3) { pair = [A, B]; break; } } if (pair) break; }
        if (!pair) break;
        const ends = pair.map(r => { const x = northCols(r).find(x => free(x, r.y0) && !objs.some(o => o.x === x && o.y === r.y0 - 1)); return x == null ? null : { r, x }; });
        if (ends.some(e => !e)) { used.add(pair[0].id); continue; }
        for (const e of ends) { objs.push({ t: 'shelf', x: e.x, y: e.r.y0 - 1, secret: passages.length + 1 }); used.add(e.r.id); }
        passages.push(ends.map(e => [e.x * TS + 8, (e.r.y0 + 1) * TS + 4]));
      }
      const room = { map: g.map(r => r.join('')), floor: th.floor, wall: th.wall, doors: {}, seed: th.seed, webs: [] };
      K.paintRoom(room);
      const jail = { x0: jx0 * TS, y0: jy0 * TS, x1: (jx0 + jw) * TS, y1: (jy0 + jh) * TS, door: { x: jdoor[0] * TS, y: jdoor[1] * TS + 8 }, out: { x: jdoor[0] * TS, y: (jdoor[1] + 2) * TS + 4 } };
      const M = { idx, th, room, W, H, objs, hides, keyPts, piecePts, boostPts, passages, spawns: spawns.length ? spawns : [[hole.x, hole.y + 20]], hole, jail, jdoor };
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
    const speedOf = id => isMon(id) ? MON_SPEED * (1 + SPEED_STEP * (G.speedLv || 0)) : SURV_SPEED * (G.fast && G.fast[id] > elapsed() ? BOOST_MUL : 1);
    const stunned = (id, el) => !!(G && G.stun && G.stun[id] && (el == null ? elapsed() : el) < G.stun[id]);
    const nameOf = id => (G && G.names[id]) || TG.memberName(id) || '친구';

    function newGame() {
      const T = TG.T;
      const players = shuffle(T.members.filter(m => !m.bot).map(m => m.id));
      const nMon = monstersFor(players.length);
      const mapIdx = T.map >= 0 && T.map < 3 ? T.map : (Math.random() * 3 | 0);
      const g = { kind: 'hunt', seq: 1, map: mapIdx, phase: 'jail', roles: {}, skin: {}, hp: {}, down: {}, jailed: {}, esc: {}, names: {}, hides: {}, inst: 0, speedLv: 0, winner: null, why: '', el: 0, spawn: {} };
      const look = T.mon == null ? 0 : T.mon;
      players.forEach((id, i) => { const m = i < nMon; g.roles[id] = m ? 'm' : 's'; g.names[id] = (T.members.find(x => x.id === id) || {}).name || '친구'; if (m) { g.skin[id] = look >= 0 ? SKINS[look] : pick(SKINS); g.hp[id] = MON_HP; } });
      const map = genMap(mapIdx);
      const sp = shuffle(map.spawns.map((_, i) => i));
      players.forEach((id, i) => { g.spawn[id] = g.roles[id] === 'm' ? -1 - i : sp[i % sp.length]; });
      g.key = { s: 1, ...ptOf(map.keyPts[Math.random() * map.keyPts.length | 0]) };
      g.pieces = shuffle(map.piecePts.map((_, i) => i)).slice(0, 3).map(i => ({ s: 1, ...ptOf(map.piecePts[i]) }));   // 사다리 조각은 처음부터 맵에 있어요
      g.stun = {}; g.jailAt = {}; g.fast = {};
      g.boost = map.boostPts.map(p => ({ s: 1, x: p[0], y: p[1], at: 0 }));
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
      if (a.a === 'atk' && mon && !G.down[id] && el >= JAIL_MS && !stunned(id, el)) {
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
        G.stun = G.stun || {};
        const st = G.stun[mid] || 0, canStun = el > st + STUN_IMMUNE;   // st = when the last stun ends
        if (canStun) G.stun[mid] = el + STUN_MS;
        fx({ f: 'dmg', m: mid, n: dmg, crit: crit ? 1 : 0, kx: clamp(+a.kx || 0, -1, 1), ky: clamp(+a.ky || 0, -1, 1), stun: canStun ? 1 : 0 });
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
      if (a.a === 'pick' && a.w === 'boost') {
        const b = (G.boost || [])[a.i | 0];
        if (b && b.s === 1 && pos && Math.hypot(b.x - pos.x, b.y - pos.y) < 26 && !G.jailed[id]) { b.s = 0; b.at = el; (G.fast || (G.fast = {}))[id] = el + BOOST_MS; fx({ f: 'boost', id }); dirty(); }
        return;
      }
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
        G.jailed = {}; G.jailAt = {}; G.freed = (G.freed || 0) + 1; G.key = { s: 0, at: elapsed() + KEY_RESPAWN };
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
      G.jailed[sid] = 1; (G.jailAt || (G.jailAt = {}))[sid] = elapsed();
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
        // 감옥에 오래 있으면 스스로 탈옥
        for (const sid of Object.keys(G.jailed)) { const at = (G.jailAt || {})[sid]; if (at != null && el - at >= SELF_FREE_MS) { delete G.jailed[sid]; delete G.jailAt[sid]; fx({ f: 'msg', text: `🗝️ ${nameOf(sid)}님이 몰래 감옥 자물쇠를 풀고 빠져나왔어요!` }); dirty(); } }
        for (const b of G.boost || []) if (b.s === 0 && el - b.at >= BOOST_RESPAWN) { b.s = 1; dirty(); }
        if (G.key.s === 0 && el >= G.key.at) { G.key = { s: 1, ...ptOf(pick(M.keyPts)) }; fx({ f: 'msg', text: '🗝️ 감옥 열쇠가 다시 나타났어요' }); dirty(); }
        checkWin();
      }
      if (H.dirty || now() - H.pushAt > 3000) push();
    }

    // ---------------- what everyone does with messages ----------------
    function applyState(g, fromHost) {
      const first = !G || G.seq == null;
      const was = G;
      if (was && !TG.isHost()) keepMine(g);
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
      if (f.f === 'boost') { if (G) { G.fast = G.fast || {}; G.fast[f.id] = elapsed() + BOOST_MS; } if (f.id === me()) { L.msg.push({ text: '⚡ 각성! 4초 동안 빨라져요', at: t }); if (L.msg.length > 4) L.msg.shift(); K.sfx('pick'); } return; }
      if (f.f === 'dmg') {
        const mp = f.m === me() ? L.me : L.rem[f.m];
        if (mp) L.fx.push({ k: 'dmg', x: mp.x, y: mp.y - 40, n: f.n, crit: f.crit, at: t });
        K.sfx('hit');
        if (f.m === me() && L.me) L.knock = { vx: f.kx * 140, vy: f.ky * 140, until: t + 160 };
        if (f.stun) { if (G) { G.stun = G.stun || {}; G.stun[f.m] = elapsed() + STUN_MS; } if (mp) L.fx.push({ k: 'stun', id: f.m, at: t }); }
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
    // a state from the host that was sent before it heard my hide/unhide should not undo it on my screen
    function keepMine(g) {
      const t = now();
      if (L.unhideAt && t - L.unhideAt < 1500) for (const k of Object.keys(g.hides)) if (g.hides[k] === me()) delete g.hides[k];
      if (L.hideAt && t - L.hideAt < 1500 && !Object.values(g.hides).includes(me())) { const k = Object.keys(G ? G.hides : {}).find(s => G.hides[s] === me()); if (k != null && g.hides[k] == null) g.hides[k] = me(); }
    }
    function frozen() { return !G || !L.me || G.phase === 'end' || G.esc[me()] || (amMon() && (G.down[me()] || stunned(me()))) || myHide() != null; }
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
          (G.boost || []).forEach((b, i) => { if (b.s === 1 && Math.hypot(b.x - e.x, b.y - e.y) < 14) { H.lastPick = t; act({ a: 'pick', w: 'boost', i }); } });
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
          // a little more generous than the drawing, so a near miss still counts
          const sk = G.skin[mid], hx = sk === 'crawl' ? 25 : sk === 'face' ? 17 : 14, top = sk === 'crawl' ? 38 : sk === 'face' ? 52 : 54, bot = sk === 'face' ? -4 : 6;
          if (b.x > mp.rx - hx && b.x < mp.rx + hx && b.y > mp.ry - top && b.y < mp.ry + bot) { b.dead = true; act({ a: 'hit', m: mid, x: Math.round(mp.x), y: Math.round(mp.y), kx: b.dx, ky: b.dy }); break; }
        }
      }
      L.bolts = L.bolts.filter(b => !b.dead);
      L.fx = L.fx.filter(f => t - f.at < (f.k === 'stun' ? STUN_MS : f.k === 'puff' ? 500 : 900));
      // a heartbeat when a monster is near (for survivors)
      if (e && !amMon() && !G.esc[me()] && G.phase !== 'end') {
        let dmin = 1e9; for (const mid of ids('m')) { const r = L.rem[mid]; if (r && !G.down[mid]) dmin = Math.min(dmin, Math.hypot(r.x - e.x, r.y - e.y)); }
        if (dmin < 150 && t > L.beat) { L.beat = t + 380 + dmin * 4; K.sfx('heart'); }
      }
    }
    // Space: shoot (survivor) or strike (monster)
    // which way to shoot or strike: an aimed direction (aim stick / mouse), or else where I am going or facing,
    // pulled onto a visible target if one is roughly that way (or, for a plain tap, the nearest one in reach)
    function aimDir(aim, tap) {
      const e = L.me;
      let [vx, vy] = inputVec(); if (!vx && !vy) { const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[e.dir] || [0, 1]; vx = v[0]; vy = v[1]; }
      let n = Math.hypot(vx, vy), d = aim ? { dx: aim.dx, dy: aim.dy } : { dx: vx / n, dy: vy / n };
      if (aim && !tap) return d;
      const reach = amMon() ? 60 : BOLT_RANGE;
      let best = null, bs = -1;
      for (const id of Object.keys(G.roles)) {
        if (id === me() || isMon(id) === amMon() || !visible(id) || G.jailed[id] || G.esc[id] || G.down[id]) continue;
        const p = posOf(id); if (!p) continue;
        const tx = p.rx - e.x, ty = (p.ry - (isMon(id) ? 16 : 8)) - (e.y - 10), dist = Math.hypot(tx, ty); if (dist > reach || dist < 1) continue;
        const cos = (tx * d.dx + ty * d.dy) / dist;
        const score = tap ? 2 - dist / reach + cos * 0.3 : cos > 0.86 ? cos - dist / reach * 0.2 : -1;   // a tap takes the nearest; Space only a target within ~30°
        if (score > bs) { bs = score; best = { dx: tx / dist, dy: ty / dist }; }
      }
      return best || d;
    }
    const dirName = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    function primary(aim, tap) {
      if (!G || !L.me || G.phase === 'end' || G.esc[me()]) return;
      const t = now(), e = L.me, el = elapsed();
      if (amMon()) {
        if (G.down[me()] || stunned(me(), el) || el < JAIL_MS || t - L.atkAt < ATK_CD) return;
        L.atkAt = t;
        const v = aimDir(aim, tap); e.dir = dirName(v.dx, v.dy);
        act({ a: 'atk', x: Math.round(e.x + v.dx * 12), y: Math.round(e.y + v.dy * 12), d: e.dir });
        if (!TG.isHost()) L.fx.push({ k: 'swing', x: e.x + v.dx * 12, y: e.y + v.dy * 12, at: t, d: e.dir });
        return;
      }
      if (G.jailed[me()] || myHide() != null || t - L.boltAt < BOLT_CD) return;
      L.boltAt = t;
      const v = aimDir(aim, tap), dx = v.dx, dy = v.dy;
      if (!e.moving) e.dir = dirName(dx, dy);
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
      if (G.pieces.some(p => p.s === 2 && p.c === me()) && Math.hypot(M.hole.x - e.x, M.hole.y - e.y) < 30) return { k: 'inst', label: '🪜 사다리 설치 (2초 꾹)' };
      if (G.key.s === 2 && G.key.c === me() && Object.keys(G.jailed).length && Math.hypot(M.jail.door.x - e.x, M.jail.door.y - e.y) < 30) return { k: 'free', label: '🔓 감옥 문 열기' };
      const h = nearest(M.hides, e, 24); if (h >= 0 && G.hides[h] == null) return { k: 'hide', s: h, label: '🫣 숨기' };
      for (const pr of M.passages || []) for (let k = 0; k < 2; k++) if (Math.hypot(pr[k][0] - e.x, pr[k][1] - e.y) < 20) {
        const wait = PASS_CD - (now() - (L.passAt || -1e9));
        return wait > 0 ? { k: 'none', label: `🚪 비밀 통로 (${Math.ceil(wait / 1000)}초)` } : { k: 'pass', to: pr[1 - k], label: '🚪 비밀 통로로 들어가기' };
      }
      return null;
    }
    // coming out of a hiding place: the nearest free spot around it (the hiding place itself is solid)
    function stepOut(hs) {
      const h = M.hides[hs], e = L.me; if (!h || !e) return;
      let best = null, bd = 1e9;
      for (let r = 10; r <= 40 && !best; r += 6) for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r + 4;
        if (blockedAt(x, y, elapsed(), false)) continue;
        const d = Math.abs(a - Math.PI / 2); if (d < bd) { bd = d; best = { x, y }; }   // prefer stepping out the front (down)
      }
      if (best) { e.x = best.x; e.y = best.y; }
    }
    function secondary(down) {
      const h = interactHint();
      if (!down) { if (L.holdWhat === 'inst') { L.hold = 0; L.holdWhat = null; } return; }
      if (!h) return;
      if (h.k === 'inst') { if (!L.hold) { L.hold = now(); L.holdWhat = 'inst'; } return; }
      if (h.k === 'none') return;
      if (h.k === 'pass') { L.fx.push({ k: 'puff', x: L.me.x, y: L.me.y, at: now() }); L.me.x = h.to[0]; L.me.y = h.to[1]; L.passAt = now(); sendMove(true); L.fx.push({ k: 'puff', x: h.to[0], y: h.to[1], at: now() }); K.sfx('door'); return; }
      if (h.k === 'hide') { act({ a: 'hide', s: h.s }); for (const k of Object.keys(G.hides)) if (G.hides[k] === me()) delete G.hides[k]; G.hides[h.s] = me(); L.hideAt = now(); K.sfx('hide'); return; }
      if (h.k === 'unhide') { const hs = myHide(); act({ a: 'unhide' }); delete G.hides[hs]; L.unhideAt = now(); stepOut(hs); sendMove(true); K.sfx('hide'); return; }
      act({ a: h.k });
    }

    // ---------------- drawing ----------------
    const TOUCH = window.matchMedia && matchMedia('(hover: none), (max-width: 899px)').matches;
    const LIGHT_S = 118, LIGHT_M = 100;   // 생존자 손전등이 더 멀리 비춰요
    const SENSE_R = 260;                  // 이 거리 안의 괴물은 어둠 속에서도 빨간 눈이 보이고, 화면 가장자리에 방향 표시가 떠요
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
      if (kind === 'boost') { P(g, x - 2, y - 11 + bob, 4, 2, '#c0c0c0'); P(g, x - 3, y - 9 + bob, 6, 8, '#ffe14a'); P(g, x - 2, y - 8 + bob, 2, 5, '#fff6b0'); P(g, x - 1, y - 6 + bob, 2, 2, '#c08a00'); return; }
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
      for (const b of G.boost || []) if (b.s === 1) drawItem(g, 'boost', b.x, b.y, t);
      // survivors know which bookcases are passages: a faint glint
      if (!amMon()) for (const pr of M.passages || []) for (const [px, py] of pr) { const a = 0.35 + Math.sin(t / 260 + px) * 0.25; g.fillStyle = `rgba(190,150,255,${a})`; g.fillRect(px - 5, py - 30, 10, 2); g.fillRect(px - 1, py - 34, 2, 10); }
      for (const f of L.fx) if (f.k === 'puff') { const k = (t - f.at) / 500; if (k < 1) { g.fillStyle = `rgba(200,180,255,${0.6 * (1 - k)})`; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.fillRect(Math.round(f.x + Math.cos(a) * k * 14), Math.round(f.y - 8 + Math.sin(a) * k * 10), 2, 2); } } }
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
        else if (isMon(e.id)) K.drawMon(g, G.skin[e.id], e.p.rx, e.p.ry, e.p.dir, t, { key: 'h' + e.id, moving: e.p.moving, alpha: G.down[e.id] ? 0.4 : 1 });
        else K.drawPerson(g, (e.id === me() ? look0 : O.lookOf(e.id)) || look0, e.p.rx, e.p.ry, e.p.dir || 'down', e.p.moving, t, e.hid ? { alpha: 0.35 } : null);
      }
      for (const b of L.bolts) { g.strokeStyle = '#e8dcc2'; g.lineWidth = 1; g.beginPath(); g.moveTo(b.x - b.dx * 6, b.y - b.dy * 6); g.lineTo(b.x, b.y); g.stroke(); P(g, b.x - 1, b.y - 1, 2, 2, '#c9c9d4'); }
      for (const id of ids('m')) if (stunned(id, el) && visible(id)) { const p = posOf(id); if (!p) continue; const top = G.skin[id] === 'crawl' ? 36 : G.skin[id] === 'face' ? 56 : 60; for (let i = 0; i < 3; i++) { const a = t / 180 + i * 2.1; P(g, Math.round(p.rx + Math.cos(a) * 9 - 1), Math.round(p.ry - top + Math.sin(a) * 3), 3, 3, i % 2 ? '#ffe06a' : '#fff8ea'); } }
      for (const f of L.fx) if (f.k === 'swing') { const a = 1 - (t - f.at) / 900; g.strokeStyle = `rgba(255,80,80,${a})`; g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y - 8, 12, 0, Math.PI * 2); g.stroke(); }
      if (L.aiming && L.me && L.aim) {
        const len = amMon() ? 24 : BOLT_RANGE, x0 = L.me.x, y0 = L.me.y - 10;
        g.strokeStyle = amMon() ? 'rgba(255,90,90,.85)' : 'rgba(255,230,140,.75)'; g.lineWidth = 1; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + L.aim.dx * len, y0 + L.aim.dy * len); g.stroke(); g.setLineDash([]);
        P(g, Math.round(x0 + L.aim.dx * len) - 1, Math.round(y0 + L.aim.dy * len) - 1, 3, 3, amMon() ? '#ff5a5a' : '#ffe68c');
      }
      // the dark
      g.setTransform(1, 0, 0, 1, 0, 0);
      const lights = [];
      if (L.me && inGame() && !G.esc[me()]) lights.push({ x: L.me.x + ox, y: L.me.y - 10 + oy, r: lightR() * (1 + Math.sin(t / 140) * 0.02) });
      else lights.push({ x: tgt.x + ox, y: tgt.y - 10 + oy, r: 140 });
      for (const o of M.objs) if (o.t === 'candle') lights.push({ x: o.x * TS + 8 + ox, y: o.y * TS + oy, r: 44, a: 0.8 });
      if (G.inst >= 3) lights.push({ x: M.hole.x + ox, y: M.hole.y - 20 + oy, r: 70, a: 0.9 });
      if (K.darkness(D.dk, D.dkg, M.th.dark, lights, VW, VH)) g.drawImage(D.dk, 0, 0);
      // in the dark: the monsters' eyes, for survivors, when they are near enough to sense
      if (inGame() && !amMon() && L.me && !G.esc[me()]) for (const id of ids('m')) {
        if (G.down[id] || visible(id)) continue;
        const p = posOf(id); if (!p) continue;
        const d = Math.hypot(p.rx - L.me.x, p.ry - L.me.y); if (d > SENSE_R) continue;
        const a = clamp(1.25 - d / SENSE_R, 0.25, 1) * (Math.floor(t / 900 + p.rx) % 5 ? 1 : 0.2);   // a blink now and then
        const ex = Math.round(p.rx + ox), ey = Math.round(p.ry + oy - (G.skin[id] === 'crawl' ? 18 : G.skin[id] === 'face' ? 34 : 44));
        g.fillStyle = `rgba(255,40,40,${a})`; g.fillRect(ex - 4, ey, 2, 2); g.fillRect(ex + 2, ey, 2, 2);
        g.fillStyle = `rgba(255,60,60,${a * 0.25})`; g.fillRect(ex - 6, ey - 2, 12, 6);
      }
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
        const sx = (p.rx + ox) * s, sy = (p.ry + oy - (isMon(id) ? (G.skin[id] === 'crawl' ? 42 : G.skin[id] === 'face' ? 62 : 70) : 28)) * s;
        if (sx < -40 || sx > w + 40 || sy < -20 || sy > h + 20) continue;
        tx(nameOf(id) + (G.jailed[id] ? ' ⛓️' : '') + (G.down[id] ? ' 💀' : stunned(id, el) ? ' 💫 기절' : ''), sx, sy, isMon(id) ? '#ff8a8a' : id === me() ? '#ffd65a' : '#9fe8a8', 11, 'center');
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
      if (!amMon()) { for (const p of G.pieces) if (p.s === 1) dot(p.x, p.y, '#5fd0e8', 2.5); for (const b of G.boost || []) if (b.s === 1) dot(b.x, b.y, '#ffe14a', 2); for (const pr of M.passages || []) for (const [px, py] of pr) dot(px, py, '#b48cff', 2); }
      for (const id of Object.keys(G.roles)) {
        if (id === me() || G.esc[id]) continue;
        const p = posOf(id); if (!p) continue;
        const sensed = inGame() && !amMon() && isMon(id) && L.me && Math.hypot(p.rx - L.me.x, p.ry - L.me.y) < SENSE_R;
        if (!sensed) { if (!visible(id)) continue; if (isMon(id) !== amMon() && inGame()) continue; }
        dot(p.rx, p.ry, isMon(id) ? (Math.floor(t / 300) % 2 ? '#ff6b6b' : '#ff2a2a') : '#8fe38a', isMon(id) ? 2.8 : 2.2);
      }
      if (L.me && inGame() && !G.esc[me()]) dot(L.me.x, L.me.y, '#ffffff', 2.8);
      // arrows at the edge of the screen pointing at monsters that are near but out of sight
      if (inGame() && !amMon() && L.me && !G.esc[me()] && G.phase !== 'jail') for (const id of ids('m')) {
        if (G.down[id]) continue; const p = posOf(id); if (!p) continue;
        const ddx = p.rx - L.me.x, ddy = p.ry - L.me.y, d = Math.hypot(ddx, ddy);
        if (d > SENSE_R + 60 || d < 1) continue;
        const sx = (p.rx + ox) * s, sy = (p.ry - 20 + oy) * s;
        if (sx > 20 && sx < w - 20 && sy > 20 && sy < h - 20 && visible(id)) continue;
        const ux = ddx / d, uy = ddy / d, cx = w / 2, cy = h / 2, rx = w / 2 - 34 * Z, ry = h / 2 - 34 * Z;
        const k2 = Math.min(rx / Math.max(0.001, Math.abs(ux)), ry / Math.max(0.001, Math.abs(uy)));
        const ax = cx + ux * k2, ay = cy + uy * k2, a = clamp(1.3 - d / (SENSE_R + 60), 0.35, 1), ang = Math.atan2(uy, ux), R = 13 * Z;
        c.save(); c.globalAlpha = a * (0.75 + Math.sin(t / 120) * 0.25); c.translate(ax, ay); c.rotate(ang);
        c.fillStyle = '#ff3030'; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(R, 0); c.lineTo(-R * 0.7, -R * 0.75); c.lineTo(-R * 0.35, 0); c.lineTo(-R * 0.7, R * 0.75); c.closePath(); c.stroke(); c.fill();
        c.restore();
        tx(`${Math.round(d / TS)}칸`, ax - ux * 22 * Z, ay - uy * 22 * Z, '#ff8a8a', 9, 'center');
      }
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
        const a1 = amMon() ? (G.down[me()] ? '💀 쓰러졌어요' : stunned(me(), el) ? '💫 기절! 잠시 못 움직여요' : el < JAIL_MS ? '감옥에서 기다리는 중…' : cd ? `👊 ${(cd / 1000).toFixed(1)}초` : '👊 [Space·클릭] 공격') : G.jailed[me()] ? '⛓️ 친구가 열쇠로 열어 줄 거예요' : myHide() != null ? '🫣 숨어 있어요' : cd ? `🏹 ${(cd / 1000).toFixed(1)}초` : '🏹 [Space·클릭] 석궁';
        const hint = interactHint();
        let line = a1 + (hint ? `   ·   [Enter] ${hint.label}` : '') + (L.carry ? '   ·   ' + L.carry : '');
        if (narrow) line = line.replace(/\[(Space·클릭|Space|Enter)\] /g, '').replace(/   ·   /g, ' · ');
        // on a touch screen the sticks cover the bottom corners, so the line sits above them
        const by = h - 8 - (w < 560 && L.dom.pad && L.dom.pad.offsetHeight ? L.dom.pad.offsetHeight + 6 : 0);
        c.font = font(12); const bw = c.measureText(line).width + 20;
        c.fillStyle = 'rgba(10,8,14,.78)'; c.fillRect(w / 2 - bw / 2, by - 22 * Z, bw, 22 * Z); tx(line, w / 2, by - 11 * Z, '#fff8ea', 12, 'center');
        if (L.hold && L.holdWhat === 'inst') { const f = clamp((t - L.hold) / INSTALL_MS, 0, 1); c.fillStyle = 'rgba(10,8,14,.8)'; c.fillRect(w / 2 - 80, by - 52, 160, 14); c.fillStyle = '#ffd65a'; c.fillRect(w / 2 - 78, by - 50, 156 * f, 10); tx('사다리 설치 중…', w / 2, by - 60, '#ffd65a', 11, 'center'); }
        if (D.btnA) { const lab = D.btnA.querySelector('.hn-aimlab'); if (lab) lab.textContent = cd ? (cd / 1000).toFixed(1) : amMon() ? '👊' : '🏹'; D.btnA.classList.toggle('cool', !!cd); }
        if (D.btnB) { D.btnB.textContent = hint ? hint.label.replace(/ \(2초 꾹\)/, '') : '✋'; D.btnB.disabled = !hint; }
      }
      const carry = []; if (G.key.s === 2 && G.key.c === me()) carry.push('🗝️ 열쇠'); if (G.pieces.some(p => p.s === 2 && p.c === me())) carry.push('🪜 조각'); L.carry = carry.join(' ');
    }

    // ---------------- the window ----------------
    function fit() {
      const D = L.dom; if (!D) return;
      const W = D.stage.clientWidth, Hh = D.stage.clientHeight;
      if (!W || !Hh) return;
      const ratio = Hh / W;
      VW = VW0; VH = VH0;
      if (ratio > VH0 / VW0) VH = Math.min(Math.round(VW0 * ratio), 440);
      else if (W > 0 && 1 / ratio > VW0 / VH0 + 0.05 && W < 1000) VW = Math.min(Math.round(VH0 / ratio), 440);
      if (D.cv.width !== VW || D.cv.height !== VH) { D.cv.width = VW; D.cv.height = VH; D.dk.width = VW; D.dk.height = VH; D.g.imageSmoothingEnabled = false; }
      const s = Math.max(0.3, Math.min(W / VW, Hh / VH));
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
    function onFocusIn(e) { if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) releaseKeys(); }
    function releaseKeys() { for (const k of Object.keys(L.keys)) L.keys[k] = false; if (L.joy) { L.joy.on = false; L.joy.x = L.joy.y = 0; } if (L.holdWhat) { L.hold = 0; L.holdWhat = null; } }
    function onKey(e) {
      // a key let go always counts, even while typing in the chat box (otherwise it stays "held" and you keep walking)
      if (e.type === 'keyup' && MOVE_KEYS[e.code]) L.keys[e.code] = false;
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
    // the right-hand stick: drag to aim (a dotted line shows where), let go to fire; a quick tap fires at the nearest target
    function aimStick() {
      const j = el('div', 'hn-joy hn-aimjoy'), knob = el('div', 'hn-knob hn-aimknob'), lab = el('span', 'hn-aimlab', '🏹');
      j.append(knob, lab);
      let id = null, moved = false;
      const upd = ev => {
        const r = j.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = ev.clientX - cx, dy = ev.clientY - cy, d = Math.hypot(dx, dy), max = r.width / 2;
        if (d > 16) { moved = true; L.aim = { dx: dx / d, dy: dy / d }; L.aiming = true; }
        const k = d ? Math.min(d, max) / d : 0; knob.style.transform = `translate(${dx * k * 0.6}px, ${dy * k * 0.6}px)`;
      };
      j.addEventListener('pointerdown', ev => { ev.preventDefault(); K.ac(); id = ev.pointerId; try { j.setPointerCapture(id); } catch (e) {} moved = false; L.aim = null; L.aiming = false; upd(ev); });
      j.addEventListener('pointermove', ev => { if (ev.pointerId === id) upd(ev); });
      const up = ev => {
        if (ev.pointerId !== id) return; id = null; knob.style.transform = '';
        if (ev.type !== 'pointercancel') { if (moved && L.aim) primary(L.aim, false); else primary(null, true); }
        L.aiming = false; L.aim = null;
      };
      j.addEventListener('pointerup', up); j.addEventListener('pointercancel', up);
      return j;
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
      const B = el('button', 'hn-b', '✋'); B.type = 'button';
      const A = aimStick();
      B.addEventListener('pointerdown', ev => { ev.preventDefault(); K.ac(); secondary(true); });
      B.addEventListener('pointerup', () => secondary(false)); B.addEventListener('pointerleave', () => secondary(false)); B.addEventListener('pointercancel', () => secondary(false));
      btns.append(B, A); pad.appendChild(btns); wrap.appendChild(pad);
      const endBox = el('div', 'hn-end'); endBox.hidden = true; stage.appendChild(endBox);
      body.appendChild(wrap);
      // computer: click on the game to fire towards the mouse
      stage.addEventListener('pointerdown', ev => {
        if (ev.pointerType !== 'mouse' || ev.button !== 0 || !L.me) return;
        const r = cv.getBoundingClientRect(); if (!r.width) return;
        const wx = (ev.clientX - r.left) / r.width * VW + L.camX, wy = (ev.clientY - r.top) / r.height * VH + L.camY;
        const dx = wx - L.me.x, dy = wy - (L.me.y - 10), d = Math.hypot(dx, dy); if (d < 4) return;
        ev.preventDefault(); K.ac(); primary({ dx: dx / d, dy: dy / d }, false);
      });
      const dk = document.createElement('canvas'); dk.width = VW; dk.height = VH;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      L.dom = { wrap, stage, cv, g, pad, hud: hudC, hg: hudC.getContext('2d'), k: 1, dk, dkg: dk.getContext('2d'), endBox, btnA: A, btnB: B };
      K.loadMon();
      G = TG.G; if (G) { M = genMap(G.map); if (!L.me && G.roles[me()]) applyState(G); }
      window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true); window.addEventListener('resize', fit);
      window.addEventListener('blur', releaseKeys); document.addEventListener('focusin', onFocusIn); document.addEventListener('visibilitychange', releaseKeys);
      setTimeout(fit, 30); setTimeout(fit, 300);
      cancelAnimationFrame(L.raf); L.lastT = now(); L.raf = requestAnimationFrame(loop);
      if (G && G.phase === 'end') { L.endShown = true; showEnd(); }
    }
    function unmount() {
      cancelAnimationFrame(L.raf); L.raf = 0;
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('resize', fit);
      window.removeEventListener('blur', releaseKeys); document.removeEventListener('focusin', onFocusIn); document.removeEventListener('visibilitychange', releaseKeys);
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
      const box2 = el('div', 'hn-maps');
      box2.appendChild(el('b', '', '👹 괴물 모습' + (TG.isHost() ? '' : ' (방장이 골라요)')));
      const row2 = el('div', 'hn-maprow'), curM = T.mon == null ? 0 : T.mon;
      MON_LOOKS.forEach(([i, nm, bl]) => {
        const b = el('button', 'btn hn-map' + (curM === i ? ' btn-gold' : ''), ''); b.type = 'button';
        b.append(el('strong', '', nm), el('small', '', bl));
        b.disabled = !TG.isHost(); b.setAttribute('aria-pressed', String(curM === i));
        b.addEventListener('click', () => { if (!TG.isHost()) return; T.mon = i; TG.bump(); });
        row2.appendChild(b);
      });
      box2.appendChild(row2); body.appendChild(box2);
      const d = el('details', 'tg-help'); d.open = true; d.appendChild(el('summary', '', '어떻게 하나요?'));
      [`3~5명이면 괴물 1명, 6명이면 괴물 2명. 누가 괴물인지는 시작할 때 무작위로 정해져요.`,
        `괴물은 처음 15초 동안 감옥에 갇혀 있어요. 마지막 5초는 화면 가운데 빨간 숫자로 세요. 그 사이에 흩어져 숨으세요!`,
        `생존자: [Space] 또는 마우스 클릭으로 석궁 (1.2초에 한 발, 화살 무제한). 맞은 괴물은 밀려나고 0.8초 동안 멈칫해요. 괴물 체력 ${MON_HP}, 한 발에 1 (10% 확률로 치명타 2). 폰은 오른쪽 조준 스틱을 끌어서 겨누고 놓으면 발사, 톡 치면 가장 가까운 괴물에게 자동 조준.`,
        `괴물: [Space]·클릭 공격. 잡힌 생존자는 감옥으로! 숨은 곳 앞에서 공격하면 숨은 사람도 찾아내요. 1분마다 아주 조금씩 빨라져요. 생존자에겐 가까이 온 괴물의 빨간 눈과 방향 화살표가 보여요.`,
        `[Enter] 옷장·통·상자에 숨기 / 나오기. 열쇠를 주워 감옥 문 앞에서 [Enter] 하면 갇힌 친구들이 풀려나요. 감옥에 45초 있으면 스스로 탈옥해요.`,
        `맵 곳곳의 ⚡ 각성제(노란 점)를 먹으면 4초 동안 빨라져요. 보랏빛으로 반짝이는 책장은 비밀 통로예요. [Enter]로 들어가면 멀리 떨어진 다른 책장으로 나와요 (생존자만).`,
        `사다리 조각 3개는 처음부터 맵 곳곳에 있어요(지도의 파란 점, 괴물 지도엔 안 보여요). 지도의 초록 점(구멍)에서 [Enter]를 2초 꾹 눌러 설치하세요. 3개를 다 설치하면 모두 구멍으로 탈출! 갇힌 친구까지 다 나가야 생존자 승리예요.`,
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
    if (/[?&]debug\b/.test(location.search)) window.__hunt = { sync: () => sendMove(true), get G() { return G; }, get L() { return L; }, get M() { return M; }, genMap, THEMES, hostAct, elapsed, speedOf, primary, secondary, interactHint, push, checkWin, set t0(v) { H.t0 = v; }, get H() { return H; } };
  }
})();
