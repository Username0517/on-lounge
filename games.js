/*
 * ON-Lounge table games: 카탄 (1층 ROOM 2) and 그림 퀴즈 (1층 ROOM 3).
 *
 * How it works, in one paragraph: each of the two rooms has one "table". Whoever opens the table is its
 * host. The host's browser is the referee: players send what they want to do, the host checks it, changes
 * the game and sends the new state to everyone in the room. If the host leaves, the next player in the
 * list takes over with the copy of the game it already has, so the game goes on.
 *
 * The Catan rules themselves come from catan-rules.js (MIT, Viral Doshi — see LICENSE-catan.md).
 * Everything on screen here (board drawing, buttons, Korean text) is our own.
 */
(function () {
  'use strict';
  const O = window.ONL; if (!O) return;
  const { TG, $, el, toast, sfx } = O;
  const P = O.P, pixCircle = O.pixCircle;

  // ---- pixel icons for the six things you can hold in Catan ----
  // Drawn here in the lounge's own pixel style so they match the rooms and need no extra image files.
  // Icons are built from horizontal spans and the 1-pixel outline is worked out from the shape itself,
  // which keeps the silhouettes clean at 16x16.
  function spanDraw(g, groups, edge) {
    const on = {}, col = {}, k = (x, y) => x + ',' + y;
    for (const grp of groups) for (const [y, x0, x1] of grp.s) for (let x = x0; x <= x1; x++) { on[k(x, y)] = 1; col[k(x, y)] = grp.c; }
    for (const key in on) {
      const [x, y] = key.split(',').map(Number);
      const e = !on[k(x - 1, y)] || !on[k(x + 1, y)] || !on[k(x, y - 1)] || !on[k(x, y + 1)];
      P(g, x, y, 1, 1, e ? edge : col[key]);
    }
  }
  const INK = '#2b2233';
  // an upright log, seen as a block: a diamond top with the rings, then the two side faces
  const CUBE_TOP = [[0, 7, 8], [1, 5, 10], [2, 3, 12], [3, 1, 14], [4, 1, 14], [5, 3, 12], [6, 5, 10], [7, 7, 8]];
  const CUBE_L = [[4, 0, 0], [5, 0, 2], [6, 0, 4], [7, 0, 6], [8, 0, 7], [9, 0, 7], [10, 0, 7], [11, 0, 7], [12, 1, 7], [13, 3, 7], [14, 5, 7], [15, 7, 7]];
  const CUBE_R = [[4, 15, 15], [5, 13, 15], [6, 11, 15], [7, 9, 15], [8, 8, 15], [9, 8, 15], [10, 8, 15], [11, 8, 15], [12, 8, 14], [13, 8, 12], [14, 8, 10], [15, 8, 8]];
  const ICON_DRAW = {
    lumber(g) {   // a wooden stick
      spanDraw(g, [{ s: [[1, 10, 13], [2, 10, 13], [3, 9, 12], [4, 9, 12], [5, 8, 11], [6, 8, 11], [7, 7, 10],
        [8, 7, 10], [9, 6, 9], [10, 5, 8], [11, 5, 8], [12, 4, 7], [13, 3, 6], [14, 3, 6]], c: '#8a5a3b' }], INK);
      P(g, 11, 2, 2, 1, '#d2a372'); P(g, 4, 13, 2, 1, '#d2a372');       // the cut ends
      P(g, 11, 3, 1, 2, '#a8734f'); P(g, 9, 6, 1, 2, '#a8734f'); P(g, 7, 9, 1, 2, '#a8734f'); P(g, 5, 12, 1, 2, '#a8734f');
      P(g, 10, 5, 1, 1, '#6f452c'); P(g, 8, 8, 1, 1, '#6f452c'); P(g, 6, 11, 1, 1, '#6f452c');   // knots
    },
    grain(g) {    // a fat ear of wheat on its stalk
      spanDraw(g, [{ s: [[9, 7, 8], [10, 7, 8], [11, 7, 8], [12, 7, 8], [13, 7, 8], [14, 7, 8]], c: '#8a5a3b' },
        { s: [[0, 7, 8], [1, 6, 9], [2, 5, 10], [3, 4, 11], [4, 4, 11], [5, 4, 11], [6, 4, 11], [7, 5, 10], [8, 6, 9]], c: '#edc84e' },
        { s: [[10, 2, 6], [11, 1, 6], [12, 1, 5], [10, 9, 13], [11, 9, 14], [12, 10, 14]], c: '#7fa84a' }], INK);
      P(g, 6, 2, 2, 6, '#fae9a8');
      for (const y of [2, 4, 6]) { P(g, 6, y, 4, 1, '#d9ae38'); }
      for (const y of [3, 5, 7]) { P(g, 5, y, 1, 1, INK); P(g, 10, y, 1, 1, INK); }
      P(g, 6, 1, 2, 1, '#fae9a8');
      P(g, 3, 11, 2, 1, '#9ec46a'); P(g, 11, 11, 2, 1, '#9ec46a');
    },
    dev(g) {      // an arrow pointing up: the development card
      spanDraw(g, [{ s: [[1, 7, 8], [2, 6, 9], [3, 5, 10], [4, 4, 11], [5, 3, 12], [6, 2, 13], [7, 2, 13],
        [8, 5, 10], [9, 5, 10], [10, 5, 10], [11, 5, 10], [12, 5, 10], [13, 5, 10], [14, 5, 10]], c: '#f2c13c' }], INK);
      P(g, 7, 2, 1, 5, '#ffe9a0'); P(g, 6, 8, 1, 6, '#ffe9a0');
      P(g, 9, 9, 1, 5, '#c99a1e'); P(g, 11, 6, 2, 1, '#c99a1e');
    },
    brick(g) {    // one brick, seen a little from above
      spanDraw(g, [{ s: [[4, 3, 12], [5, 2, 13], [6, 1, 14]], c: '#e27a52' },
        { s: [[7, 1, 14], [8, 1, 14], [9, 1, 14], [10, 1, 14], [11, 1, 14]], c: '#c05430' }], INK);
      P(g, 3, 5, 8, 1, '#f09874');
      P(g, 2, 11, 12, 1, '#8f3b1c');
      P(g, 5, 7, 1, 4, '#9c4420'); P(g, 10, 7, 1, 4, '#9c4420');
      P(g, 2, 7, 1, 4, '#d4663c');
    },
    ore(g) {      // a dark lump of ore with bright flecks
      spanDraw(g, [{ s: [[2, 7, 9], [3, 6, 10], [4, 5, 11], [5, 4, 12], [6, 3, 12], [7, 2, 13], [8, 2, 13], [9, 1, 14], [10, 1, 14], [11, 2, 13], [12, 3, 12], [13, 5, 10]], c: '#3b3a44' }], INK);
      P(g, 6, 5, 2, 2, '#6f7280'); P(g, 9, 7, 2, 2, '#8d8f99'); P(g, 4, 9, 2, 2, '#6f7280');
      P(g, 11, 10, 2, 1, '#565763'); P(g, 7, 11, 2, 1, '#565763');
      P(g, 6, 5, 1, 1, '#c9d4e8'); P(g, 10, 7, 1, 1, '#c9d4e8');
    },
    wool(g) {     // a sheep from the side: woolly body, head out to the left, four legs
      spanDraw(g, [
        { s: [[1, 7, 11], [2, 5, 13], [3, 4, 14], [4, 4, 14], [5, 4, 14], [6, 4, 14], [7, 4, 14], [8, 5, 13]], c: '#fdfcf7' },
        { s: [[4, 1, 4], [5, 0, 4], [6, 0, 4], [7, 0, 4], [8, 1, 4]], c: '#eee3d4' },
        { s: [[9, 5, 7], [10, 5, 7], [11, 5, 7], [12, 5, 7], [9, 11, 13], [10, 11, 13], [11, 11, 13], [12, 11, 13]], c: '#9a6a45' }], INK);
      P(g, 6, 9, 1, 3, '#b4815a'); P(g, 12, 9, 1, 3, '#b4815a');   // the near pair of legs, lighter
      P(g, 6, 1, 2, 1, '#fdfcf7'); P(g, 9, 1, 2, 1, '#fdfcf7');    // fluff on top
      P(g, 2, 6, 1, 1, INK);                                       // eye
      P(g, 0, 7, 2, 1, '#d9b7a8');                                 // muzzle
      P(g, 1, 3, 2, 1, INK); P(g, 1, 4, 1, 1, '#eee3d4');          // ear
      P(g, 6, 3, 4, 1, '#ebe7dc'); P(g, 9, 5, 4, 1, '#ebe7dc'); P(g, 5, 6, 3, 1, '#ebe7dc');
    }
  };
  // the robber and the dice faces, same pixel style
  function robberCanvas() {
    if (iconCache.__rob) return iconCache.__rob;
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    spanDraw(g, [{ s: [[1, 6, 9], [2, 5, 10], [3, 4, 11], [4, 4, 11], [5, 3, 12], [6, 3, 12], [7, 2, 13], [8, 2, 13], [9, 2, 13], [10, 2, 13], [11, 3, 12], [12, 3, 12], [13, 4, 11]], c: '#3b3a44' }], '#17151c');
    P(g, 5, 5, 6, 3, '#d8c9a8');                       // the face under the hood
    P(g, 6, 6, 1, 1, '#17151c'); P(g, 9, 6, 1, 1, '#17151c');
    P(g, 4, 9, 8, 1, '#5a5767'); P(g, 5, 11, 6, 1, '#2b2a33');
    return (iconCache.__rob = c);
  }
  const DIE_PIPS = { 1: [[7, 7]], 2: [[4, 4], [10, 10]], 3: [[4, 4], [7, 7], [10, 10]], 4: [[4, 4], [10, 4], [4, 10], [10, 10]], 5: [[4, 4], [10, 4], [7, 7], [4, 10], [10, 10]], 6: [[4, 3], [10, 3], [4, 7], [10, 7], [4, 11], [10, 11]] };
  function dieCanvas(n) {
    const key = '__die' + n; if (iconCache[key]) return iconCache[key];
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
    P(g, 0, 0, 16, 16, '#2b2233'); P(g, 1, 1, 14, 14, '#fdfcf7'); P(g, 1, 1, 14, 1, '#ffffff'); P(g, 1, 14, 14, 1, '#ddd8cc');
    for (const [x, y] of (DIE_PIPS[n] || [])) P(g, x - 1, y - 1, 3, 3, '#2b2233');
    return (iconCache[key] = c);
  }
  function pixEl(canvas, cls, label) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.className = cls || '';
    c.getContext('2d').drawImage(canvas, 0, 0);
    if (label) { c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); }
    return c;
  }
  const ICON_KO = { lumber: '나무', grain: '밀', dev: '발전 카드', brick: '벽돌', ore: '철', wool: '양털' };
  const iconCache = {};
  function iconCanvas(kind) {
    if (iconCache[kind]) return iconCache[kind];
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d'); ICON_DRAW[kind](g);
    return (iconCache[kind] = c);
  }
  function iconEl(kind, n, cls) {
    const w = el('span', 'ct-ic ' + (cls || '') + (n ? '' : ' zero'));
    const c = document.createElement('canvas'); c.width = c.height = 16; c.className = 'ct-icimg';
    c.getContext('2d').drawImage(iconCanvas(kind), 0, 0);
    c.title = ICON_KO[kind]; c.setAttribute('role', 'img'); c.setAttribute('aria-label', ICON_KO[kind]);
    w.append(c, el('b', '', String(n)));
    return w;
  }
  const avatarCache = new Map();
  function avatarEl(id, look) {
    look = look || O.lookOf(id);
    const key = id + ':' + JSON.stringify(look || 0);
    let c = avatarCache.get(key);
    if (!c) { c = document.createElement('canvas'); c.width = O.SW; c.height = O.SH; c.getContext('2d').drawImage(O.avatar(look, 'down'), 0, 0); avatarCache.set(key, c); }
    const out = document.createElement('canvas'); out.width = O.SW; out.height = O.SH; out.className = 'ct-avatar';
    out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }
  const R = window.CatanRules;
  const root = $('tg'), btn = $('tgBtn');
  const KIND_OF = { f1r2: 'catan', f1r3: 'draw', room2: 'chess' };
  const INFO = {
    catan: { title: '카탄', icon: '🏝️', min: 2, max: 6, bots: true, blurb: '자원을 모아 마을과 도시를 짓고, 먼저 10점을 만들면 이겨요. 2~6명 (5명부터는 큰 섬).' },
    chess: { title: '체스', icon: '♟️', min: 2, max: 2, bots: true, blurb: '한 명씩 번갈아 두는 체스예요. 친구와 1:1로 두거나, 컴퓨터(상·중·하)와 둘 수 있어요.' },
    draw: { title: '그림 퀴즈', icon: '🎨', min: 2, max: 6, blurb: '한 명이 제시어를 그리면 나머지가 맞혀요. 빨리 맞힐수록 점수가 커요. 2~6명.' }
  };
  const GAMES = {};
  const me = () => O.uid();
  const kindHere = () => KIND_OF[O.scene()] || null;
  const now = () => performance.now();
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ================= tables (several per room, each with its own host) =================
  // A room can hold any number of tables at once. Every table is broadcast by its own host; each client
  // keeps a list of what it has heard and only runs the game for the one table it is sitting at.
  const TABLES = new Map();   // id -> { tbl, at }
  let T = null;               // the table I am sitting at, or null while browsing the list
  let G = null;               // the game itself (shape depends on the kind)
  let lastTbl = 0, askAt = -1e9, mountedKey = '', hostGoneAt = 0;
  const TBL_GONE = 16000;     // a table nobody has broadcast for this long has closed
  const isHost = () => !!T && T.host === me();
  const inTable = () => !!T && T.members.some(m => m.id === me());
  const memberName = id => { const m = T && T.members.find(x => x.id === id); return (m && m.name) || O.nameOf(id) || '친구'; };
  function send(p) { p.from = me(); p.k = T ? T.kind : kindHere(); if (p.tid === undefined && T) p.tid = T.id; return O.send(p); }
  const seqNow = () => !G || !T ? 0 : T.kind === 'catan' ? (G.x ? G.x.seq : 0) : (G.seq || 0);
  function sendTbl() { if (!isHost()) return; lastTbl = now(); send({ t: 'tbl', tbl: T, seq: seqNow() }); }
  function bump() { T.v = (T.v || 0) + 1; sendTbl(); render(); }
  function ask() { const t = now(); if (t - askAt < 1500) return; askAt = t; O.send({ t: 'q', from: me(), k: kindHere() }); }
  function game() { return T ? GAMES[T.kind] : null; }
  // every table in this room that we have heard from recently, newest first
  function tableList() {
    const t = now(), out = [];
    for (const [id, e] of [...TABLES]) {
      if (t - e.at > TBL_GONE) { TABLES.delete(id); continue; }
      if (e.tbl.kind !== kindHere()) continue;
      out.push(e.tbl);
    }
    return out.sort((x, y) => (x.at0 || 0) - (y.at0 || 0));
  }
  function noteTable(tbl) {
    // one host can only hold one table: a newer one from the same person replaces the old
    for (const [id, e] of [...TABLES]) if (id !== tbl.id && e.tbl.host === tbl.host) TABLES.delete(id);
    const was = TABLES.get(tbl.id);
    TABLES.set(tbl.id, { tbl, at: now(), at0: was ? was.at0 : now() });
    tbl.at0 = TABLES.get(tbl.id).at0;
  }

  function createTable() {
    const kind = kindHere(); if (!kind) return;
    if (T) { if (inTable()) { toast('이미 자리에 앉아 있어요'); return; } T = null; }
    T = { id: O.newId(), kind, host: me(), members: [{ id: me(), name: O.name() }], started: false, v: 1 };
    G = null; noteTable(T); sendTbl(); render();
    O.say(`${INFO[kind].icon} ${INFO[kind].title} 자리를 열었어요. 친구들이 들어오길 기다려요!`);
    send({ t: 'note', text: `${INFO[kind].icon} ${O.name()}님이 ${INFO[kind].title} 자리를 열었어요. 같은 방에서 참가할 수 있어요!` });
  }
  function joinTable(tid) {
    const e = TABLES.get(tid); if (!e) return;
    if (T && T.id === tid) return;
    if (T && inTable()) { toast('지금 앉아 있는 자리에서 먼저 나와 주세요'); return; }
    if (e.tbl.started) { watchTable(tid); return; }   // already playing: watch instead of asking to join
    joinWait = { id: tid, at: now() };
    O.send({ t: 'join', from: me(), k: kindHere(), tid, name: O.name() });
    render();
  }
  // onlookers do not need the host's permission; the state is already going out to the whole room
  function watchTable(tid) {
    const e = TABLES.get(tid); if (!e) return;
    if (T && inTable()) { toast('지금 앉아 있는 자리에서 먼저 나와 주세요'); return; }
    if (game() && game().unmount) game().unmount();
    joinWait = null; T = e.tbl; G = null; mountedKey = ''; lastTbl = now(); hostGoneAt = 0; clearChat();
    askAt = -1e9; ask(); send({ t: 'q' });
    toast('구경하는 중이에요. 다음 판부터 함께할 수 있어요!');
    render();
  }
  let joinWait = null;
  function hostJoin(id, name) {
    if (!isHost() || !T) return;
    if (T.members.some(m => m.id === id)) { sendTbl(); return; }
    const g = game();
    if (T.members.length >= INFO[T.kind].max) { send({ t: 'err', to: id, msg: '자리가 꽉 찼어요' }); return; }
    if (T.started && !(g.lateJoin && g.lateJoin(id, name))) { send({ t: 'err', to: id, msg: '이미 시작한 게임이에요. 구경은 할 수 있어요!' }); return; }
    T.members.push({ id, name: String(name || '친구').slice(0, 12) });
    bump(); if (T.started) g.push();
  }
  // leaving: the host hands the table to the next player first
  function leaveTable(quiet) {
    if (!T) return;
    if (inTable()) {
      if (isHost()) {
        const g = game();
        if (T.started && g.memberLeft) g.memberLeft(me(), true);
        T.members = T.members.filter(m => m.id !== me());
        const next = T.members.find(m => O.here(m.id));
        if (next && (!T.started || !G || !G.over)) { T.host = next.id; T.v++; lastTbl = now(); send({ t: 'tbl', tbl: T, seq: seqNow() }); if (T.started && g.handover) g.handover(); }
        else { send({ t: 'close', id: T.id }); TABLES.delete(T.id); }
      } else send({ t: 'leave' });
    }
    if (game() && game().unmount) game().unmount();
    T = null; G = null; mountedKey = ''; joinWait = null;
    if (!quiet) render(); else label();
    setTimeout(ask, 800);
  }
  function hostLeave(id) {
    if (!isHost() || !T.members.some(m => m.id === id)) return;
    const g = game();
    if (T.started && g.memberLeft) g.memberLeft(id, false);
    T.members = T.members.filter(m => m.id !== id);
    bump(); if (T.started) g.push();
  }
  function addBot(level) {
    if (!isHost() || T.started || !INFO[T.kind].bots) return;
    if (T.members.length >= INFO[T.kind].max) { toast('자리가 꽉 찼어요'); return; }
    const used = T.members.map(m => m.name);
    const nm = '🤖 ' + (BOT_NAMES.find(x => !used.includes('🤖 ' + x)) || ('컴퓨터' + (T.members.length + 1)));
    T.members.push({ id: 'bot-' + O.newId(), name: nm, bot: true, level: level || 'mid', look: O.randomLook() });
    bump();
  }
  function setBotLevel(id, lv) { if (!isHost() || T.started) return; const m = T.members.find(x => x.id === id); if (m && m.bot) { m.level = lv; bump(); } }
  function removeBot(id) { if (!isHost() || T.started) return; T.members = T.members.filter(m => !(m.id === id && m.bot)); bump(); }
  function startGame() {
    if (!isHost() || T.started) return;
    const live = T.members.filter(m => m.bot || O.here(m.id));
    if (live.length < INFO[T.kind].min) { toast(`${INFO[T.kind].min}명부터 시작할 수 있어요`); return; }
    T.members = live; T.started = true; T.v++; clearChat('게임 시작! 여기 대화는 같이 하는 사람들만 봐요.');
    game().start(); sendTbl(); game().push(); render();
  }
  function backToLobby() { if (!isHost()) return; if (game().unmount) game().unmount(); T.started = false; G = null; mountedKey = ''; clearChat('게임이 끝나서 대화를 비웠어요.'); T.members = T.members.filter(m => m.bot || O.here(m.id)); bump(); }
  // the host vanished: the first player still in the room takes over
  function takeOver() {
    if (!T || isHost()) return;
    const next = T.members.find(m => m.id !== T.host && O.here(m.id));
    if (!next) { if (game() && game().unmount) game().unmount(); TABLES.delete(T.id); T = null; G = null; mountedKey = ''; render(); return; }
    if (next.id !== me()) return;   // someone ahead of me does it
    const old = T.host, g = game();
    T.host = me(); T.v = (T.v || 0) + 1;
    if (!T.started) T.members = T.members.filter(m => m.id !== old);
    else if (g.memberLeft) g.memberLeft(old, false);
    if (T.started && !g.keepLeavers) T.members = T.members.filter(m => m.id !== old);
    sendTbl(); if (T.started && g.handover) g.handover(); if (T.started) g.push();
    toast('방장이 나가서 내가 방장이 됐어요'); render();
  }

  TG.onMsg = p => {
    if (!p || p.from === me() || !kindHere() || p.k !== kindHere()) return;
    if (p.to && p.to !== me()) return;
    if (p.t === 'q') { if (isHost()) { sendTbl(); if (T.started) game().push(p.from); } return; }
    if (p.t === 'note') { O.say(p.text); return; }
    if (p.t === 'tbl') {
      const t = p.tbl; if (!t || !t.id || t.host !== p.from) return;
      noteTable(t);
      const amMember = t.members.some(m => m.id === me());
      // this is the table I am sitting at (or just got into)
      if (T && T.id === t.id) {
        const mine = seqNow(), theirs = p.seq || 0;
        if (isHost() && t.host !== me()) {
          // two browsers both think they host it: the one further along keeps it
          if (mine > theirs || (mine === theirs && me() < t.host)) { sendTbl(); if (T.started) game().push(); return; }
          if (game().unmount) game().unmount(); G = null; mountedKey = '';
        } else if (!isHost() && t.host !== T.host && theirs < mine) { if (game().unmount) game().unmount(); G = null; mountedKey = ''; }
        else if (t.host === T.host && (t.v || 0) < (T.v || 0)) return;
        const wasStarted = T.started, wasIn = inTable();
        T = t; lastTbl = now(); hostGoneAt = 0;
        if (wasStarted && !T.started) { if (game().unmount) game().unmount(); G = null; mountedKey = ''; clearChat('게임이 끝나서 대화를 비웠어요.'); }
        if (!wasStarted && T.started) clearChat('게임 시작! 여기 대화는 같이 하는 사람들만 봐요.');
        if (T.started && !G) send({ t: 'q' });
        if (wasIn && !inTable() && T.started) toast('게임에서 빠졌어요');
        render(); return;
      }
      // the host let me in: sit down here
      if (amMember && (!T || !inTable())) {
        if (joinWait && joinWait.id !== t.id) { /* a different table answered: ignore */ }
        if (game() && game().unmount) game().unmount();
        T = t; G = null; mountedKey = ''; joinWait = null; lastTbl = now(); hostGoneAt = 0;
        if (T.started) send({ t: 'q' });
        render(); return;
      }
      render(); return;   // somebody else's table: just refresh the list
    }
    if (p.t === 'close') {
      TABLES.delete(p.id);
      if (T && T.id === p.id) { const was = inTable(); if (game().unmount) game().unmount(); T = null; G = null; mountedKey = ''; if (was) toast('자리가 닫혔어요'); }
      render(); return;
    }
    if (p.t === 'err') { toast(p.msg); joinWait = null; if (game() && game().onErr) game().onErr(); render(); return; }
    if (p.t === 'join') { if (T && p.tid === T.id) hostJoin(p.from, p.name); return; }
    if (!T || p.tid !== T.id) return;
    if (p.t === 'say') {
      if (!inTable()) return;   // only the people playing see it
      pushChat({ id: p.from, name: String(p.name || '친구').slice(0, 12), text: String(p.text || '').slice(0, 120) });
      return;
    }
    if (p.t === 'leave') { hostLeave(p.from); return; }
    const g = game(); if (g && g.onMsg) g.onMsg(p);
  };
  TG.onReady = () => {
    if (!kindHere()) return;
    if (isHost()) { sendTbl(); if (T.started) game().push(); } else setTimeout(() => { askAt = -1e9; ask(); }, 500);
    label();
  };
  TG.onHello = () => { if (isHost()) sendTbl(); };
  TG.onGone = id => {
    for (const [tid, e] of [...TABLES]) if (e.tbl.host === id && (!T || T.id !== tid)) TABLES.delete(tid);
    if (!T) { render(); return; }
    if (isHost()) { if (T.members.some(m => m.id === id)) { if (!T.started) hostLeave(id); else if (game().memberGone) game().memberGone(id); else hostLeave(id); } return; }
    if (id === T.host) takeOver();
  };
  TG.onLeaveScene = () => {
    if (T) leaveTable(true);
    T = null; G = null; mountedKey = ''; TABLES.clear(); joinWait = null;
    chatBack(); root.hidden = true; root.innerHTML = ''; card = null; btn.hidden = true;
  };
  TG.busy = () => inTable() && T.started;
  TG.hide = () => {
    chatBack();
    const k = kindHere();
    if (mountedKey.startsWith('game:') && k && GAMES[k].unmount) GAMES[k].unmount();
    mountedKey = ''; root.hidden = true; root.innerHTML = ''; card = null; label();
  };
  TG.open = kind => {
    if (!O.live()) { toast('혼자 보는 체험 모드에서는 함께 하는 게임을 할 수 없어요'); return; }
    if (!kindHere()) return;
    root.hidden = false; mountedKey = ''; card = null; render(); ask();
  };
  btn.addEventListener('click', () => TG.open(kindHere()));

  let tickAt = now();
  setInterval(() => {
    const kind = kindHere();
    { const t0 = now(); if (t0 - tickAt > 5000) { lastTbl = t0; hostGoneAt = 0; if (T && !isHost()) { askAt = -1e9; ask(); } } tickAt = t0; }   // this tab was asleep: do not jump to conclusions
    if (!kind) { if (!btn.hidden) btn.hidden = true; return; }
    if (!O.ready()) return;
    const t = now();
    if (joinWait && t - joinWait.at > 6000) { joinWait = null; toast('자리에 들어가지 못했어요. 다시 눌러 보세요.'); render(); }
    if (isHost()) { if (t - lastTbl > 4000) sendTbl(); if (T.started && game().tick) game().tick(t); }
    else if (T) {
      // the host is silent: ask, then take over if it has really gone
      if (t - lastTbl > 9000) ask();
      if (!O.here(T.host) || t - lastTbl > 30000) { if (!hostGoneAt) hostGoneAt = t; if (t - hostGoneAt > 2500) { hostGoneAt = 0; lastTbl = t; takeOver(); } } else hostGoneAt = 0;
      if (T && T.started && game().clientTick) game().clientTick(t);
    } else if (!root.hidden) { ask(); if (t - (lastList || 0) > 2500) { lastList = t; render(); } }
    label();
  }, 1000);
  let lastList = 0;

  // the computer players move on their own, quicker timer; everything else stays on the 1 s one
  setInterval(() => {
    if (!T || !T.started || !isHost() || !kindHere()) return;
    const g = game(); if (g && g.fastTick) { try { g.fastTick(now()); } catch (e) { console.error(e); } }
  }, 200);

  // ================================================================================================
  //  체스
  // ================================================================================================
  // 빨·주·노·초·파·보 — told apart at a glance on the board, which the shipped palette was not
  const PCOL = ['#e03131', '#f76707', '#f2b705', '#2f9e44', '#1c7ed6', '#9c36b5'];
  const pcol = i => PCOL[i] || (R.PLAYER_COLORS && R.PLAYER_COLORS[i]) || '#888';
  const CR = window.ONL_CHESS;
  const CS = { dom: null, sel: -1, dest: [], promo: null, lastSeq: -1, think: 0, raf: 0 };
  const PIECE_KO = { p: '폰', n: '나이트', b: '비숍', r: '룩', q: '퀸', k: '킹' };
  // the pieces, drawn as 16x16 pixel art so they match the rest of the lounge
  // Each piece is a list of horizontal spans [row, x0, x1]. The outline is worked out from the shape
  // itself, so every piece gets a clean 1-pixel edge and the silhouettes stay distinct at this size.
  const PIECE_SPANS = {
    p: [[3, 6, 9], [4, 5, 10], [5, 5, 10], [6, 6, 9], [7, 6, 9], [8, 5, 10], [9, 5, 10], [10, 4, 11], [11, 4, 11], [12, 3, 12], [13, 2, 13]],
    r: [[2, 2, 4], [2, 6, 9], [2, 11, 13], [3, 2, 13], [4, 2, 13], [5, 3, 12], [6, 4, 11], [7, 4, 11], [8, 4, 11], [9, 4, 11], [10, 3, 12], [11, 3, 12], [12, 2, 13], [13, 2, 13]],
    b: [[1, 7, 8], [2, 6, 9], [3, 5, 10], [4, 5, 10], [5, 5, 10], [6, 5, 10], [7, 6, 9], [8, 4, 11], [9, 5, 10], [10, 5, 10], [11, 4, 11], [12, 3, 12], [13, 2, 13]],
    n: [[1, 9, 11], [2, 8, 12], [3, 6, 12], [4, 4, 12], [5, 3, 12], [6, 2, 12], [7, 2, 12], [8, 3, 12], [9, 4, 11], [10, 5, 11], [11, 4, 11], [12, 3, 12], [13, 2, 13]],
    q: [[1, 2, 2], [1, 5, 5], [1, 7, 8], [1, 10, 10], [1, 13, 13], [2, 2, 13], [3, 3, 12], [4, 4, 11], [5, 4, 11], [6, 5, 10], [7, 5, 10], [8, 5, 10], [9, 5, 10], [10, 4, 11], [11, 4, 11], [12, 3, 12], [13, 2, 13]],
    k: [[0, 6, 9], [1, 6, 9], [2, 6, 9], [3, 3, 12], [4, 6, 9], [5, 3, 12], [6, 3, 12], [7, 4, 11], [8, 5, 10], [9, 5, 10], [10, 5, 10], [11, 4, 11], [12, 3, 12], [13, 2, 13]]
  };
  // extra marks once the body is drawn: [x, y, w, h, 'edge'|'shade']
  const PIECE_MARKS = {
    p: [[6, 6, 1, 2, 'shade'], [6, 4, 2, 1, 'shade']],
    r: [[7, 5, 2, 1, 'edge'], [4, 6, 1, 4, 'shade'], [3, 3, 3, 1, 'shade']],
    b: [[8, 3, 1, 3, 'edge'], [6, 4, 1, 3, 'shade'], [5, 9, 2, 1, 'shade']],
    n: [[8, 5, 1, 1, 'edge'], [2, 7, 2, 1, 'edge'], [4, 6, 1, 2, 'shade'], [10, 3, 1, 4, 'shade'], [11, 5, 1, 3, 'edge']],
    q: [[5, 3, 1, 1, 'edge'], [10, 3, 1, 1, 'edge'], [4, 5, 1, 5, 'shade'], [4, 2, 2, 1, 'shade']],
    k: [[4, 8, 1, 4, 'shade'], [4, 6, 2, 1, 'shade'], [7, 1, 1, 2, 'shade'], [4, 3, 1, 1, 'shade'], [11, 3, 1, 1, 'shade']]
  };
  function drawPiece(g, t, F, E, S) {
    const on = {}, key = (x, y) => x + ',' + y;
    for (const [y, x0, x1] of PIECE_SPANS[t]) for (let x = x0; x <= x1; x++) on[key(x, y)] = 1;
    for (const k in on) {
      const [x, y] = k.split(',').map(Number);
      const edge = !on[key(x - 1, y)] || !on[key(x + 1, y)] || !on[key(x, y - 1)] || !on[key(x, y + 1)];
      P(g, x, y, 1, 1, edge ? E : F);
    }
    for (const [x, y, w, h, kind] of (PIECE_MARKS[t] || [])) P(g, x, y, w, h, kind === 'edge' ? E : S);
  }
  const PIECE_DRAW = {
    p: (g, F, E, S) => drawPiece(g, 'p', F, E, S),
    r: (g, F, E, S) => drawPiece(g, 'r', F, E, S),
    b: (g, F, E, S) => drawPiece(g, 'b', F, E, S),
    n: (g, F, E, S) => drawPiece(g, 'n', F, E, S),
    q: (g, F, E, S) => drawPiece(g, 'q', F, E, S),
    k: (g, F, E, S) => drawPiece(g, 'k', F, E, S)
  };
  const PIECE_COL = {
    w: ['#f6f1e3', '#251c2c', '#cdc3ad'],
    b: ['#3f3a52', '#17151c', '#6f6a86']
  };
  const pieceCache = {};
  function pieceCanvas(ch) {
    if (pieceCache[ch]) return pieceCache[ch];
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const [F, E, S] = PIECE_COL[ch === ch.toUpperCase() ? 'w' : 'b'];
    PIECE_DRAW[ch.toLowerCase()](c.getContext('2d'), F, E, S);
    return (pieceCache[ch] = c);
  }
  const chGame = () => G && G.g;
  const chMyColor = () => !G ? null : G.white === me() ? 'w' : G.black === me() ? 'b' : null;
  const chTurnId = () => !G ? null : (G.g.w ? G.white : G.black);
  const chMyTurn = () => !!G && !G.g.over && chTurnId() === me();
  const chIsBot = id => { const m = T && T.members.find(x => x.id === id); return !!(m && m.bot); };
  const chLevel = id => { const m = T && T.members.find(x => x.id === id); return (m && m.level) || 'mid'; };
  const chName = id => { const m = T && T.members.find(x => x.id === id); return (m && m.name) || O.nameOf(id) || '친구'; };
  function chLog(t) { G.log.push(t); if (G.log.length > 60) G.log.shift(); }

  function chStart() {
    const ms = T.members.slice();
    const a = ms[0], b = ms[1];
    const flip = Math.random() < 0.5;
    G = { kind: 'chess', seq: 1, g: CR.newGame(), white: (flip ? b : a).id, black: (flip ? a : b).id, over: null, log: [], looks: {} };
    for (const m of ms) G.looks[m.id] = m.look || O.lookOf(m.id) || null;
    chLog(`⚪ 흰색 ${chName(G.white)} · ⚫ 검은색 ${chName(G.black)}`);
    chLog('흰색부터 시작해요.');
    CS.sel = -1; CS.dest = []; CS.think = 0;
  }
  function chPush(to) { if (!G) return; const p = { t: 'cs', g: G }; if (to) p.to = to; send(p); chApply(G); }
  function chDo(pid, from, to, promo) {
    const g = G.g;
    if (g.over) return { error: '이미 끝났어요' };
    if (chTurnId() !== pid) return { error: '지금은 상대 차례예요' };
    const r = CR.move(g, from, to, promo);
    if (r.error) return r;
    G.seq++;
    const h = g.hist[g.hist.length - 1];
    chLog(`${g.full}. ${chName(pid)} ${h ? h.s : ''}${g.over ? '' : CR.inCheck(g, g.w) ? ' 체크!' : ''}`);
    if (g.over) {
      const W = g.over.why;
      chLog(W === 'mate' ? `체크메이트! ${chName(g.over.win === 'w' ? G.white : G.black)}님 승리 🏆`
        : W === 'resign' ? `${chName(g.over.win === 'w' ? G.white : G.black)}님 승리 (기권)`
        : W === 'stale' ? '스테일메이트 — 무승부예요' : W === '50' ? '50수 규칙 — 무승부예요'
        : W === 'rep' ? '같은 자리 3번 반복 — 무승부예요' : '말이 모자라 무승부예요');
    }
    return r;
  }
  function chAct(from, to, promo) {
    if (!G || G.g.over) return;
    if (isHost()) { const r = chDo(me(), from, to, promo); if (r.error) toast(r.error); else chPush(); return; }
    send({ t: 'mv', from_sq: from, to_sq: to, promo });
  }
  function chResign() {
    if (!G || G.g.over || !chMyColor()) return;
    if (isHost()) { CR.resign(G.g, chMyColor() === 'w'); G.seq++; chLog(`${chName(me())}님이 기권했어요.`); chPush(); }
    else send({ t: 'rs' });
  }
  // the computer thinks on the host's browser
  function chBotTick(now) {
    if (!G || G.g.over || !isHost()) return false;
    const id = chTurnId();
    if (!chIsBot(id)) return false;
    const wait = { easy: 700, mid: 600, hard: 450 }[chLevel(id)] || 600;
    if (!CS.think) { CS.think = now; return false; }
    if (now - CS.think < wait) return false;
    CS.think = 0;
    const mv = CR.best(G.g, chLevel(id));
    if (!mv) return false;
    const r = chDo(id, mv.from, mv.to, mv.promo);
    if (!r.error) chPush();
    return true;
  }
  function chApply(g) {
    const first = CS.lastSeq < 0;
    const was = G && G.seq;
    G = g; CS.sel = -1; CS.dest = [];
    if (!first && g.seq !== CS.lastSeq) {
      if (g.g.over) sfx(g.g.over.win && chMyColor() === g.g.over.win ? 'goal' : 'pop', 0.45);
      else sfx(CR.inCheck(g.g, g.g.w) ? 'ding' : 'pop', 0.35);
    }
    CS.lastSeq = g.seq;
    render();
  }
  // ---- board ----
  function chFlip() { return chMyColor() === 'b'; }
  function chCells() {
    const out = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out.push({ i: CR.sq(r, f), r, f });
    return out;
  }
  function chDrawBoard() {
    const d = CS.dom; if (!d || !G) return;
    const cv = d.cv, g = cv.getContext('2d'), fl = chFlip(), B = G.g;
    cv.width = 144; cv.height = 144;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#6f452c'; g.fillRect(0, 0, 144, 144);
    const px = (r, f) => [8 + (fl ? 7 - f : f) * 16, 8 + (fl ? 7 - r : r) * 16];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const [x, y] = px(r, f), i = CR.sq(r, f);
      g.fillStyle = (r + f) % 2 ? '#b98a5e' : '#edd9b0'; g.fillRect(x, y, 16, 16);
      if (B.last && (B.last.from === i || B.last.to === i)) { g.fillStyle = 'rgba(255,214,90,.5)'; g.fillRect(x, y, 16, 16); }
    }
    // the king that is in check
    if (!B.over && CR.inCheck(B, B.w)) {
      const k = CR.findKing(B, B.w), [x, y] = px(CR.row(k), CR.file(k));
      g.fillStyle = 'rgba(230,57,70,.6)'; g.fillRect(x, y, 16, 16);
    }
    if (CS.sel >= 0) { const [x, y] = px(CR.row(CS.sel), CR.file(CS.sel)); g.fillStyle = 'rgba(63,181,163,.55)'; g.fillRect(x, y, 16, 16); }
    for (const m of CS.dest) {
      const [x, y] = px(CR.row(m.to), CR.file(m.to));
      g.fillStyle = 'rgba(37,28,44,.45)';
      if (m.cap) { g.fillRect(x, y, 16, 2); g.fillRect(x, y + 14, 16, 2); g.fillRect(x, y + 2, 2, 12); g.fillRect(x + 14, y + 2, 2, 12); }
      else { g.fillRect(x + 6, y + 6, 4, 4); g.fillRect(x + 7, y + 5, 2, 6); g.fillRect(x + 5, y + 7, 6, 2); }
    }
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = B.b[CR.sq(r, f)]; if (!p) continue;
      const [x, y] = px(r, f); g.drawImage(pieceCanvas(p), x, y);
    }
    // a thin frame instead of tiny letters, which only turn to mush when the board is scaled up
    g.fillStyle = '#4a2f1d'; g.fillRect(6, 6, 132, 2); g.fillRect(6, 136, 132, 2); g.fillRect(6, 6, 2, 132); g.fillRect(136, 6, 2, 132);
  }
  function chTap(ev) {
    if (!G || G.g.over || !chMyTurn() || CS.promo) return;
    const rc = CS.dom.cv.getBoundingClientRect(), fl = chFlip();
    const u = rc.width / 144;
    let f = Math.floor((ev.clientX - rc.left - 8 * u) / (16 * u)), r = Math.floor((ev.clientY - rc.top - 8 * u) / (16 * u));
    if (f < 0 || f > 7 || r < 0 || r > 7) return;
    if (fl) { f = 7 - f; r = 7 - r; }
    const i = CR.sq(r, f), B = G.g, p = B.b[i], mine = chMyColor() === 'w';
    const hit = CS.dest.find(m => m.to === i);
    if (hit) {
      const promos = CS.dest.filter(m => m.to === i && m.promo);
      if (promos.length) { CS.promo = { from: CS.sel, to: i }; CS.sel = -1; CS.dest = []; chUpdate(); return; }
      const from = CS.sel; CS.sel = -1; CS.dest = []; chAct(from, i); chDrawBoard(); return;
    }
    if (p && CR.isW(p) === mine) {
      CS.sel = i; CS.dest = CR.legal(B).filter(m => m.from === i);
      sfx('pop', 0.25);
    } else { CS.sel = -1; CS.dest = []; }
    chDrawBoard(); chStatus();
  }
  const CH_START = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  function chTaken(white) {   // pieces of this colour that are gone
    const have = {}, B = G.g;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = B.b[CR.sq(r, f)]; if (!p) continue;
      if (CR.isW(p) !== white) continue;
      const t = p.toLowerCase(); have[t] = (have[t] || 0) + 1;
    }
    const out = [];
    for (const t of ['q', 'r', 'b', 'n', 'p']) for (let k = (have[t] || 0); k < CH_START[t]; k++) out.push(white ? t.toUpperCase() : t);
    return out;
  }
  function chPieceEl(ch, cls) {
    const c = document.createElement('canvas'); c.width = c.height = 16; c.className = 'ch-pc ' + (cls || '');
    c.getContext('2d').drawImage(pieceCanvas(ch), 0, 0);
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', (CR.isW(ch) ? '흰 ' : '검은 ') + PIECE_KO[ch.toLowerCase()]);
    return c;
  }
  function chSide(id, colour) {
    const box = el('div', 'ch-side' + (chTurnId() === id && !G.g.over ? ' on' : ''));
    const head = el('div', 'ch-sidehead');
    head.append(el('i', 'ch-dot ' + colour), avatarEl(id, G.looks && G.looks[id]), el('b', '', chName(id) + (id === me() ? ' (나)' : '')));
    if (chIsBot(id)) head.appendChild(el('span', 'ct-mini', '🤖 ' + (BOT_KO[chLevel(id)] || '중')));
    const taken = el('div', 'ch-taken');
    chTaken(colour !== 'w').forEach(p => taken.appendChild(chPieceEl(p, 'small')));
    box.append(head, taken);
    return box;
  }
  function chMount(body) {
    const d = CS.dom = {};
    d.status = el('p', 'ct-status');
    d.sides = el('div', 'ch-sides');
    d.wrap = el('div', 'ch-wrap'); d.cv = el('canvas', 'ch-board'); d.cv.addEventListener('pointerdown', chTap);
    d.promo = el('div', 'ch-promo'); d.wrap.append(d.cv, d.promo);
    d.acts = el('div', 'ct-acts'); d.log = el('div', 'ct-log');
    const left = d.left = el('div', 'ch-left'), right = el('div', 'ct-right');
    left.append(d.wrap); right.append(d.sides, d.acts, d.log);
    const cols = el('div', 'ct-cols'); cols.append(left, right);
    body.append(d.status, cols);
    d.ro = new ResizeObserver(() => chSize()); d.ro.observe(d.left);
    d.onwin = () => chSize(); window.addEventListener('resize', d.onwin);
    chUpdate();
  }
  function chSize() {
    const d = CS.dom; if (!d) return;
    const availW = (d.left && d.left.clientWidth) || 300;
    const availH = Math.max(180, window.innerHeight - (window.innerWidth >= 900 ? 190 : 330));
    const px = Math.max(144, Math.floor(Math.min(availW, availH) / 144) * 144 || Math.min(availW, availH));
    d.cv.style.width = d.cv.style.height = Math.min(availW, availH, px) + 'px';
    chDrawBoard();
  }
  function chUnmount() {
    if (CS.dom) { if (CS.dom.ro) CS.dom.ro.disconnect(); if (CS.dom.onwin) window.removeEventListener('resize', CS.dom.onwin); }
    CS.dom = null; CS.sel = -1; CS.dest = []; CS.promo = null; CS.lastSeq = -1;
  }
  function chStatus() {
    const d = CS.dom; if (!d || !G) return;
    const B = G.g, mine = chMyColor();
    let t, cls = '';
    if (B.over) {
      const w = B.over.win;
      t = !w ? '무승부예요' : (w === mine ? '🏆 내가 이겼어요!' : `${chName(w === 'w' ? G.white : G.black)}님 승리`);
      cls = 'done';
    } else if (!mine) t = `${chName(chTurnId())}님 차례 (구경 중)`;
    else if (chMyTurn()) { t = CR.inCheck(B, B.w) ? '체크! 킹을 피하세요' : (CS.sel >= 0 ? '갈 곳을 누르세요' : '내 차례예요 · 말을 누르세요'); cls = 'mine'; }
    else t = `${chName(chTurnId())}님이 생각 중…`;
    d.status.textContent = t; d.status.className = 'ct-status ' + cls;
  }
  function chUpdate() {
    const d = CS.dom; if (!d || !G) return;
    chStatus();
    d.sides.innerHTML = '';
    d.sides.append(chSide(G.black, 'b'), chSide(G.white, 'w'));
    // promotion picker
    d.promo.innerHTML = ''; d.promo.hidden = !CS.promo;
    if (CS.promo) {
      d.promo.appendChild(el('p', '', '무엇으로 승진할까요?'));
      const row = el('div', 'tg-row');
      for (const q of ['q', 'r', 'b', 'n']) {
        const b = el('button', 'btn ch-promob', ''); b.type = 'button';
        b.append(chPieceEl(chMyColor() === 'w' ? q.toUpperCase() : q), el('span', '', PIECE_KO[q]));
        b.addEventListener('click', () => { const pm = CS.promo; CS.promo = null; chAct(pm.from, pm.to, q); chUpdate(); });
        row.appendChild(b);
      }
      const cx = el('button', 'btn', '취소'); cx.type = 'button'; cx.addEventListener('click', () => { CS.promo = null; chUpdate(); });
      row.appendChild(cx); d.promo.appendChild(row);
    }
    d.acts.innerHTML = '';
    if (G.g.over) {
      if (isHost()) d.acts.appendChild(mkBtn('새 게임 준비하기', 'btn-gold', backToLobby));
      else d.acts.appendChild(el('p', 'tg-empty', '방장이 새 게임을 준비할 수 있어요'));
    } else if (chMyColor()) {
      d.acts.appendChild(mkBtn('기권하기', '', () => confirmBar(root.querySelector('.tg-card'), '정말 기권할까요?', '기권', chResign)));
      d.acts.appendChild(el('p', 'ct-tip', '말을 누르면 갈 수 있는 곳이 점으로 표시돼요.'));
    }
    d.log.innerHTML = ''; G.log.slice(-14).forEach(t => d.log.appendChild(el('p', '', t))); d.log.scrollTop = d.log.scrollHeight;
    chSize();
  }
  GAMES.chess = {
    start: chStart, push: chPush, mount: chMount, update: chUpdate, unmount: chUnmount,
    fastTick: chBotTick,
    tick() { if (G && !G.g.over && !chIsBot(chTurnId()) && isHost()) { /* humans take their time */ } },
    myTurn: chMyTurn,
    memberLeft(id, self) {
      if (!G || G.g.over || self) return;
      if (id === G.white || id === G.black) { CR.resign(G.g, id === G.white); G.seq++; chLog(`${chName(id)}님이 나가서 게임이 끝났어요.`); }
    },
    memberGone(id) { hostLeave(id); },
    handover() { CS.think = 0; },
    onMsg(p) {
      if (p.t === 'cs') { if (p.from !== T.host || !p.g || !p.g.g) return; if (G && p.g.seq < G.seq) return; chApply(p.g); return; }
      if (p.t === 'mv') {
        if (!isHost() || !G) return;
        const r = chDo(p.from, +p.from_sq, +p.to_sq, p.promo);
        if (r.error) send({ t: 'err', to: p.from, msg: r.error }); else chPush();
        return;
      }
      if (p.t === 'rs') { if (!isHost() || !G || G.g.over) return; const c = p.from === G.white ? 'w' : p.from === G.black ? 'b' : null; if (!c) return; CR.resign(G.g, c === 'w'); G.seq++; chLog(`${chName(p.from)}님이 기권했어요.`); chPush(); }
    },
    lobbyExtra(body) {
      const d = el('details', 'tg-help'); d.appendChild(el('summary', '', '체스 규칙이 가물가물하다면'));
      ['말을 누르면 갈 수 있는 칸이 점으로 보여요. 점을 누르면 그 칸으로 가요.', '킹이 잡히게 되면 체크, 피할 수 없으면 체크메이트로 끝나요.', '킹과 룩이 아직 안 움직였고 사이가 비어 있으면 캐슬링(킹을 두 칸)이 돼요.', '폰이 끝줄에 닿으면 퀸·룩·비숍·나이트 중 하나로 바꿔요.', '같은 자리가 3번 반복되거나 50수 동안 아무 말도 안 잡히면 무승부예요.'].forEach(t => d.appendChild(el('p', '', '· ' + t)));
      body.appendChild(d);
    }
  };

  // ================= shell UI =================
  function label() {
    const kind = kindHere();
    if (!kind) { btn.hidden = true; return; }
    const inf = INFO[kind]; btn.hidden = false;
    let text = `${inf.icon} ${inf.title}`, ping = false;
    if (T && !T.started) text += ` 대기 ${T.members.length}/${inf.max}`;
    else if (T && T.started) { text += inTable() ? ' 진행 중' : ' 구경'; ping = root.hidden && inTable() && !!(game().myTurn && game().myTurn()); }
    btn.textContent = text; btn.classList.toggle('ping', ping);
  }
  // ---- lounge chat inside the game ----
  // The real chat pane is borrowed from the side panel and put back when the game closes, so chatting
  // during a game uses exactly the same box (and the same history) as everywhere else.
  // ---- chat for the table only ----
  // Its own little chat, not the lounge one: only the people sitting at this table see it, and it is
  // wiped when a game ends so the next game starts on a clean slate.
  let chatOpen = false, chatUnread = 0, tchat = [], chatLog = null, chatInput = null;
  const wide = () => window.innerWidth >= 900;
  function buildChat(box) {
    box.innerHTML = '';
    box.appendChild(el('div', 'tgc-head', '💬 게임 대화'));
    chatLog = el('div', 'tgc-log');
    const form = el('form', 'tgc-form');
    chatInput = el('input'); chatInput.type = 'text'; chatInput.maxLength = 120; chatInput.autocomplete = 'off'; chatInput.setAttribute('aria-label', '게임 대화 입력');
    const send1 = el('button', 'btn btn-gold', '보내기'); send1.type = 'submit';
    form.append(chatInput, send1);
    form.addEventListener('submit', ev => { ev.preventDefault(); const t = chatInput.value.trim(); if (!t) return; chatInput.value = ''; sayChat(t); });
    box.append(chatLog, form);
    drawChat();
  }
  function drawChat() {
    if (!chatLog) return;
    const sc = chatLog, stick = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 40 || !sc.clientHeight;
    sc.innerHTML = '';
    if (!tchat.length) sc.appendChild(el('p', 'tgc-sys', inTable() ? '같이 하는 사람들끼리만 보이는 대화예요. 게임이 끝나면 지워져요.' : '게임에 참여하면 대화할 수 있어요.'));
    for (const m of tchat) {
      const line = el('p', 'tgc-line' + (m.sys ? ' sys' : m.id === me() ? ' me' : ''));
      if (m.sys) line.textContent = m.text;
      else { line.append(el('b', '', m.name), document.createTextNode(' ' + m.text)); }
      sc.appendChild(line);
    }
    if (stick) sc.scrollTop = sc.scrollHeight;
    if (chatInput) {
      const can = inTable();
      chatInput.disabled = !can;
      chatInput.placeholder = can ? '메시지를 입력하세요' : '구경 중에는 보낼 수 없어요';
    }
  }
  function pushChat(m) {
    tchat.push(m); if (tchat.length > 80) tchat.shift();
    if (!m.sys && m.id !== me() && !(chatOpen || wide())) chatUnread++;
    drawChat(); applyChat();
  }
  function sayChat(text) {
    if (!inTable()) return;
    const t = String(text).slice(0, 120);
    send({ t: 'say', text: t, name: O.name() });
    pushChat({ id: me(), name: O.name(), text: t });
  }
  function clearChat(note) { tchat = []; if (note) tchat.push({ sys: 1, text: note }); chatUnread = 0; drawChat(); }
  function applyChat() {
    const box = root.querySelector('.tg-chat'), btn = root.querySelector('.tg-chatbtn'); if (!box) return;
    const on = chatOpen || wide();
    box.classList.toggle('show', on);
    if (on) { chatUnread = 0; if (chatLog) chatLog.scrollTop = chatLog.scrollHeight; }
    if (btn) { btn.hidden = wide(); btn.setAttribute('aria-pressed', String(chatOpen)); btn.dataset.unread = chatUnread ? (chatUnread > 9 ? '9+' : chatUnread) : ''; }
  }
  const chatBack = () => {};   // nothing is borrowed any more
  window.addEventListener('resize', () => { if (!root.hidden) applyChat(); });
  function confirmBar(card, text, yesText, cb) {
    const old = card.querySelector('.tg-ask'); if (old) old.remove();
    const bar = el('div', 'tg-ask'); bar.appendChild(el('p', '', text));
    const row = el('div', 'tg-row'), y = el('button', 'btn btn-gold', yesText), n = el('button', 'btn', '취소');
    y.type = n.type = 'button'; y.addEventListener('click', () => { bar.remove(); cb(); }); n.addEventListener('click', () => bar.remove());
    row.append(y, n); bar.appendChild(row); card.appendChild(bar); y.focus();
  }
  // The card is built once and kept. Only the body is redrawn, so the chat pane never moves and
  // whatever you were typing (and where you had scrolled to) stays put when somebody joins or leaves.
  let card = null, bodyEl = null, headTitle = null, headBtns = null, outBtn = null;
  function ensureCard(kind) {
    if (card && root.contains(card)) return;
    root.innerHTML = '';
    card = el('div', 'tg-card tg-' + kind);
    const head = el('div', 'tg-head'); headTitle = el('h2', '', ''); headBtns = el('div', 'tg-row');
    outBtn = el('button', 'btn', '나가기'); outBtn.type = 'button'; outBtn.hidden = true;
    outBtn.addEventListener('click', () => {
      if (inTable() && T.started && !(G && G.over)) confirmBar(card, T.kind === 'catan' ? '게임에서 나갈까요? 내 차례는 자동으로 넘어가게 돼요.' : '게임에서 나갈까요?', '나가기', () => leaveTable());
      else leaveTable();
    });
    const cBtn = el('button', 'btn tg-chatbtn', '💬 대화'); cBtn.type = 'button';
    cBtn.addEventListener('click', () => { chatOpen = !chatOpen; applyChat(); });
    const fold = el('button', 'btn', '접기'); fold.type = 'button'; fold.addEventListener('click', TG.hide);
    headBtns.append(outBtn, cBtn, fold); head.append(headTitle, headBtns); card.appendChild(head);
    const main = el('div', 'tg-main'); bodyEl = el('div', 'tg-body');
    const chatBox = el('div', 'tg-chat');
    main.append(bodyEl, chatBox); card.appendChild(main); root.appendChild(card);
    buildChat(chatBox); applyChat();
  }
  function render() {
    label();
    if (root.hidden) return;
    const kind = kindHere(); if (!kind) { chatBack(); root.hidden = true; card = null; return; }
    const inf = INFO[kind];
    ensureCard(kind);
    const key = !T ? 'list' : !T.started ? 'lobby' : (G ? 'game:' + T.id : 'wait');
    headTitle.textContent = `${inf.icon} ${inf.title}`;
    const watching = !!T && !inTable();
    outBtn.hidden = !T;
    outBtn.textContent = watching ? '그만 보기' : '나가기';
    card.classList.toggle('tg-play', key.startsWith('game:'));
    if (key.startsWith('game:') && key === mountedKey && bodyEl.firstChild) { GAMES[kind].update(); return; }
    if (mountedKey.startsWith('game:') && GAMES[kind].unmount) GAMES[kind].unmount();
    mountedKey = key;
    bodyEl.innerHTML = '';
    const body = bodyEl;
    if (key === 'list') {
      // every table open in this room right now
      body.appendChild(el('p', 'tg-blurb', inf.blurb));
      const list = tableList();
      if (!list.length) body.appendChild(el('p', 'tg-empty', '아직 열린 자리가 없어요. 먼저 자리를 열고 친구들을 기다려 보세요!'));
      else {
        const wrap = el('div', 'tg-list');
        list.forEach(t => {
          const r = el('div', 'tg-room' + (t.started ? ' playing' : ''));
          const who = el('div', 'tg-roomwho');
          t.members.slice(0, 6).forEach(m => who.appendChild(avatarEl(m.id, m.look)));
          const info = el('div', 'tg-roominfo');
          const hostName = (t.members.find(m => m.id === t.host) || {}).name || '친구';
          info.append(el('b', '', `${hostName}님의 자리`), el('span', 'tg-tag', `${t.members.length}/${inf.max}명 · ${t.started ? '진행 중' : '대기 중'}`));
          const j = el('button', 'btn ' + (t.started ? '' : 'btn-gold'), joinWait && joinWait.id === t.id ? '들어가는 중…' : t.started ? '구경하기' : t.members.length >= inf.max ? '꽉 참' : '참가하기');
          j.type = 'button'; j.disabled = !!joinWait || (!t.started && t.members.length >= inf.max);
          j.addEventListener('click', () => t.started ? watchTable(t.id) : joinTable(t.id));
          r.append(who, info, j); wrap.appendChild(r);
        });
        body.appendChild(wrap);
      }
      const b = el('button', 'btn btn-gold tg-big', '➕ 새 자리 만들기'); b.type = 'button'; b.addEventListener('click', createTable);
      body.appendChild(b);
      body.appendChild(el('p', 'ct-tip', '한 방에서 여러 자리가 동시에 열릴 수 있어요. 원하는 자리에 들어가세요.'));
    } else if (key === 'lobby') {
      body.appendChild(el('p', 'tg-blurb', inf.blurb));
      const list = el('div', 'tg-list');
      T.members.forEach(m => {
        const r = el('div', 'tg-mem' + (m.bot ? ' bot' : ''));
        r.appendChild(avatarEl(m.id, m.look));
        r.appendChild(el('span', 'tg-name', m.name));
        if (m.bot) {
          if (isHost()) {
            const lv = el('div', 'tg-lv');
            for (const [k, ko] of [['hard', '상'], ['mid', '중'], ['easy', '하']]) {
              const c = el('button', 'btn gm-chip', ko); c.type = 'button'; c.setAttribute('aria-pressed', String(m.level === k));
              c.addEventListener('click', () => setBotLevel(m.id, k)); lv.appendChild(c);
            }
            const x = el('button', 'btn tg-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', '컴퓨터 빼기');
            x.addEventListener('click', () => removeBot(m.id)); lv.appendChild(x);
            r.appendChild(lv);
          } else r.appendChild(el('span', 'tg-tag', '컴퓨터 · ' + (BOT_KO[m.level] || '중')));
        } else r.appendChild(el('span', 'tg-tag', m.id === T.host ? '방장' : m.id === me() ? '나' : ''));
        list.appendChild(r);
      });
      for (let i = T.members.length; i < Math.min(inf.max, Math.max(inf.min, T.members.length + 1)); i++) list.appendChild(el('div', 'tg-mem empty', '빈 자리'));
      body.appendChild(list);
      if (inf.bots && isHost()) {
        const bRow = el('div', 'tg-row');
        const add = el('button', 'btn', '🤖 컴퓨터 추가'); add.type = 'button';
        add.disabled = T.members.length >= inf.max;
        add.addEventListener('click', () => addBot('mid'));
        bRow.append(add, el('span', 'ct-tip', '컴퓨터를 넣으면 혼자서도, 사람이 적어도 바로 시작할 수 있어요. 상/중/하로 실력을 고르세요.'));
        body.appendChild(bRow);
      }
      const row = el('div', 'tg-row');
      if (!inTable()) {
        const j = el('button', 'btn btn-gold tg-big', T.members.length >= inf.max ? '자리가 꽉 찼어요' : '참가하기'); j.type = 'button';
        j.disabled = T.members.length >= inf.max || !!joinWait; j.addEventListener('click', () => joinTable(T.id)); row.appendChild(j);
        const bk = el('button', 'btn', '← 자리 목록'); bk.type = 'button'; bk.addEventListener('click', () => { T = null; mountedKey = ''; render(); }); row.appendChild(bk);
      }
      else if (isHost()) {
        const ok = T.members.length >= inf.min;
        const s = el('button', 'btn btn-gold tg-big', ok ? '게임 시작' : `${inf.min}명부터 시작할 수 있어요`); s.type = 'button'; s.disabled = !ok; s.addEventListener('click', startGame); row.appendChild(s);
      } else row.appendChild(el('p', 'tg-empty', '방장이 시작하기를 기다리고 있어요…'));
      body.appendChild(row);
      if (inTable()) { const bk = el('button', 'btn tg-backlist', '← 다른 자리 보기'); bk.type = 'button'; bk.addEventListener('click', () => { leaveTable(); }); body.appendChild(bk); }
      if (GAMES[kind].lobbyExtra) GAMES[kind].lobbyExtra(body);
    } else if (key === 'wait') {
      body.appendChild(el('p', 'tg-empty', '게임 상황을 불러오고 있어요…'));
    } else GAMES[kind].mount(body, card);
  }

  // ================================================================================================
  //  카탄
  // ================================================================================================
  const RES = ['brick', 'lumber', 'wool', 'grain', 'ore'];
  const RES_KO = { brick: '벽돌', lumber: '나무', wool: '양털', grain: '밀', ore: '철' };
  const RES_COL = { brick: '#c45a2c', lumber: '#2d7a3a', wool: '#8fc76a', grain: '#e0b84a', ore: '#7d8597' };
  const TERRAIN_COL = { hills: '#c75b33', forest: '#2f7d3f', pasture: '#7fc257', fields: '#e8c044', mountains: '#8d93a3', desert: '#e8d9ae' };
  const TERRAIN_EDGE = { hills: 'rgba(255,255,255,.22)', forest: 'rgba(255,255,255,.18)', pasture: 'rgba(255,255,255,.3)', fields: 'rgba(255,255,255,.32)', mountains: 'rgba(255,255,255,.28)', desert: 'rgba(0,0,0,.12)' };
  const TERRAIN_ICON = { hills: 'brick', forest: 'lumber', pasture: 'wool', fields: 'grain', mountains: 'ore', desert: null };
  const TERRAIN_KO = { hills: '벽돌', forest: '나무', pasture: '양털', fields: '밀', mountains: '철', desert: '사막' };
  const DEV_KO = { knight: '기사', victoryPoint: '승점 +1', roadBuilding: '도로 건설', yearOfPlenty: '풍년', monopoly: '독점' };
  const DEV_TIP = { knight: '도둑을 옮기고 카드 1장을 뺏어요', victoryPoint: '가지고만 있어도 1점 (쓰지 않아요)', roadBuilding: '길 2개를 공짜로 놓아요', yearOfPlenty: '원하는 자원 2장을 받아요', monopoly: '자원 하나를 골라 모두에게서 가져와요' };
  const COST_KO = '길: 벽돌1 나무1 · 마을: 벽돌1 나무1 양털1 밀1 · 도시: 철3 밀2 · 발전 카드: 철1 양털1 밀1';
  const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
  const resText = o => RES.filter(r => o && o[r] > 0).map(r => `${RES_KO[r]} ${o[r]}`).join(', ') || '없음';
  const cardCount = p => typeof p.resources === 'number' ? p.resources : RES.reduce((a, r) => a + (p.resources[r] || 0), 0);

  const C = { geo: null, geoKey: '', mode: null, pend: null, panel: null, dom: null, busy: 0, absent: {}, lastSeq: -1, flash: 0, raf: 0 };
  const cIdx = () => G ? G.players.findIndex(p => p.id === me()) : -1;
  const cCur = () => G.players[G.currentPlayerIndex];
  const cMine = () => !!G && G.phase !== 'finished' && cCur().id === me();
  function cLog(text) { const X = G.x; X.log.push(text); if (X.log.length > 40) X.log.splice(0, X.log.length - 40); }

  // Digits drawn by hand. The pixel font we were using made 2 and 5 look like the same squiggle.
  const DIGITS = {
    '0': ['0110', '1001', '1001', '1001', '1001', '1001', '0110'],
    '1': ['0010', '0110', '1010', '0010', '0010', '0010', '0111'],
    '2': ['0110', '1001', '0001', '0010', '0100', '1000', '1111'],
    '3': ['1110', '0001', '0001', '0110', '0001', '1001', '0110'],
    '4': ['0010', '0110', '1010', '1010', '1111', '0010', '0010'],
    '5': ['1111', '1000', '1110', '0001', '0001', '1001', '0110'],
    '6': ['0110', '1000', '1110', '1001', '1001', '1001', '0110'],
    '7': ['1111', '0001', '0010', '0010', '0100', '0100', '0100'],
    '8': ['0110', '1001', '1001', '0110', '1001', '1001', '0110'],
    '9': ['0110', '1001', '1001', '0111', '0001', '0001', '0110']
  };
  // draws the text centred on (cx, cy); u is the size of one pixel
  function pixNum(g, text, cx, cy, u, col) {
    text = String(text);
    // Draw in real screen pixels. The board canvas is scaled, so drawing in board units puts cell
    // edges on fractions of a pixel and the browser smears 2 and 5 into the same squiggle.
    const m = g.getTransform ? g.getTransform() : null;
    const sx = m ? m.a : 1, sy = m ? m.d : 1, ox = m ? m.e : 0, oy = m ? m.f : 0;
    const du = Math.max(1, Math.round(u * sx));
    const gw = 4 * du, gap = du, total = text.length * gw + (text.length - 1) * gap;
    let x = Math.round(cx * sx + ox - total / 2), y = Math.round(cy * sy + oy - (7 * du) / 2);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = col;
    for (const ch of text) {
      const rows = DIGITS[ch];
      if (rows) for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) if (rows[r][c] === '1') g.fillRect(x + c * du, y + r * du, du, du);
      x += gw + gap;
    }
    g.restore();
  }
  function cGeo() {
    const key = G.id + ':' + Object.keys(G.hexes).length;
    if (C.geo && C.geoKey === key) return C.geo;
    const ANG = [90, 30, -30, -90, -150, 150].map(a => a * Math.PI / 180), V = new Map(), E = new Map(), H = [];
    const vp = (q, r, d) => [Math.sqrt(3) * (q + r / 2) + Math.cos(ANG[d]), 1.5 * r - Math.sin(ANG[d])];
    const id = (x, y) => Math.round(x * 10) + ',' + Math.round(y * 10);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const hk in G.hexes) {
      const h = G.hexes[hk], cx = Math.sqrt(3) * (h.q + h.r / 2), cy = 1.5 * h.r; H.push({ k: hk, q: h.q, r: h.r, x: cx, y: cy });
      for (let d = 0; d < 6; d++) {
        const [x, y] = vp(h.q, h.r, d), [xb, yb] = vp(h.q, h.r, (d + 1) % 6);
        let v = V.get(id(x, y)); if (!v) { v = { x, y, keys: [] }; V.set(id(x, y), v); } v.keys.push(`v_${h.q}_${h.r}_${d}`);
        const eid = id((x + xb) / 2, (y + yb) / 2); let e = E.get(eid); if (!e) { e = { x1: x, y1: y, x2: xb, y2: yb, mx: (x + xb) / 2, my: (y + yb) / 2, keys: [] }; E.set(eid, e); } e.keys.push(`e_${h.q}_${h.r}_${d}`);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    const byKey = {}; for (const v of V.values()) for (const k of v.keys) byKey[k] = v;
    const ports = (G.ports || []).map(pt => {
      const a = byKey[pt.vertices[0]], b = byKey[pt.vertices[1]]; if (!a || !b) return null;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, d = Math.hypot(mx - cx, my - cy) || 1;
      return { a, b, x: mx + (mx - cx) / d * 0.78, y: my + (my - cy) / d * 0.78, ratio: pt.ratio, res: pt.resource };
    }).filter(Boolean);
    C.geoKey = key; C.geo = { V: [...V.values()], E: [...E.values()], H, ports, x0: x0 - 1.25, y0: y0 - 1.25, x1: x1 + 1.25, y1: y1 + 1.25 };
    return C.geo;
  }
  const vBuild = v => { for (const k of v.keys) { const b = G.vertices[k]; if (b && b.building) return Object.assign({ key: k }, b); } return null; };
  const eRoad = e => { for (const k of e.keys) { const r = G.edges[k]; if (r && r.road) return r; } return null; };

  // ---- host: the referee ----
  function cStart() {
    const ms = shuffle(T.members);
    G = R.createGame(T.id, { id: ms[0].id, name: ms[0].name }, ms.length > 4, false);
    for (const m of ms.slice(1)) R.addPlayer(G, { id: m.id, name: m.name });
    R.startGame(G);
    for (const m of T.members) {
      const p = G.players.find(x => x.id === m.id); if (!p) continue;
      p.look = m.look || O.lookOf(m.id) || null;
      if (m.bot) { p.bot = true; p.level = m.level || 'mid'; }
    }
    G.x = { step: 'settle', last: null, seq: 1, log: [], actAt: Date.now() };
    cLog(`게임 시작! 순서: ${G.players.map(p => p.name).join(' → ')}`);
    cLog('먼저 차례대로 마을 1개와 길 1개를 두 번씩 놓아요.');
    C.absent = {};
  }
  function cPush(to) { if (!G) return; const p = { t: 'gs', g: G }; if (to) p.to = to; send(p); cApply(G); }
  function cAct(a, args) {
    if (!G || G.phase === 'finished') return;
    if (isHost()) { const r = cDo(me(), a, args || []); if (r && r.error) toast(r.error); else cPush(); return; }
    if (now() - C.busy < 600) return;
    C.busy = now(); send({ t: 'act', a, args: args || [] });
  }
  const ERR_KO = [[/not your turn/i, '아직 내 차례가 아니에요'], [/not enough/i, '자원이 모자라요'], [/too close/i, '다른 건물과 너무 가까워요'], [/occupied|already exists/i, '이미 놓여 있어요'], [/connect/i, '내 길이나 건물과 이어져야 해요'], [/no (settlements|cities|roads) left/i, '남은 말이 없어요'], [/one development card/i, '발전 카드는 한 차례에 한 장만 쓸 수 있어요'], [/no development cards left/i, '발전 카드가 다 떨어졌어요'], [/different hex/i, '도둑은 다른 땅으로 옮겨야 해요']];
  const errKo = e => { for (const [re, ko] of ERR_KO) if (re.test(e || '')) return ko; return '지금은 할 수 없어요'; };
  function cDo(pid, a, args) {
    const r = cDo2(pid, a, args);
    if (G.phase === 'finished' && !G.x.won) { G.x.won = true; const w = G.players.find(p => p.id === G.winner); cLog(`🏆 ${w ? w.name : ''}님이 10점을 만들어 이겼어요!`); }
    return r;
  }
  function cDo2(pid, a, args) {
    const g = G, X = g.x, pi = g.players.findIndex(p => p.id === pid);
    if (pi < 0 || g.phase === 'finished') return { error: '게임에 참가하고 있지 않아요' };
    const P = g.players[pi], cur = g.players[g.currentPlayerIndex], mine = cur.id === pid, nm = P.name;
    const bad = m => ({ error: m || '지금은 할 수 없어요' });
    const fin = r => { if (!r || !r.success) return bad(errKo(r && r.error)); X.seq++; X.actAt = Date.now(); return r; };
    let r;
    switch (a) {
      case 'settle': {
        const k = String(args[0]);
        if (g.phase === 'setup') {
          if (!mine || X.step !== 'settle') return bad();
          r = fin(R.placeSettlement(g, pid, k)); if (r.error) return r;
          X.step = 'road'; X.last = k; cLog(`${nm}: 마을을 놓았어요`); return r;
        }
        if (!mine || g.turnPhase !== 'main') return bad();
        r = fin(R.placeSettlement(g, pid, k)); if (!r.error) { R.updateLongestRoad(g); cLog(`${nm}: 마을을 지었어요`); } return r;
      }
      case 'road': {
        const k = String(args[0]);
        if (g.phase === 'setup') {
          if (!mine || X.step !== 'road') return bad();
          r = fin(R.placeRoad(g, pid, k, true, X.last)); if (r.error) return r;
          X.step = 'settle'; X.last = null; R.advanceSetup(g, pid);
          cLog(`${nm}: 길을 놓았어요`); if (g.phase === 'playing') cLog(`준비 끝! ${cCur().name}님부터 주사위를 굴려요.`); return r;
        }
        if (!mine || !(g.turnPhase === 'main' || (g.freeRoads > 0 && g.turnPhase === 'roll'))) return bad();
        const free = g.freeRoads > 0;
        r = fin(R.placeRoad(g, pid, k, false, null)); if (!r.error) cLog(`${nm}: 길을 놓았어요${free ? ' (도로 건설)' : ''}`); return r;
      }
      case 'city': r = fin(R.upgradeToCity(g, pid, String(args[0]))); if (!r.error) cLog(`${nm}: 도시로 키웠어요`); return r;
      case 'roll': {
        r = fin(R.rollDice(g, pid)); if (r.error) return r;
        const d = g.diceRoll; cLog(`${nm}: 🎲 ${d.die1} + ${d.die2} = ${d.total}`);
        if (d.total === 7) cLog(g.turnPhase === 'discard' ? '7! 카드가 8장 이상인 사람은 절반을 버려요.' : '7! 도둑을 옮겨요.');
        else { const gs = g.players.map((p, i) => r.resourceGains && resText(r.resourceGains[i]) !== '없음' ? `${p.name} +${resText(r.resourceGains[i])}` : null).filter(Boolean); cLog(gs.length ? gs.join(' / ') : '아무도 자원을 받지 못했어요'); }
        return r;
      }
      case 'discard': {
        const o = {}; for (const k of RES) { const n = Math.floor(+((args[0] || {})[k]) || 0); if (n < 0) return bad(); if (n) o[k] = n; }
        r = fin(R.discardCards(g, pid, o)); if (!r.error) cLog(`${nm}: 카드 ${RES.reduce((s, k) => s + (o[k] || 0), 0)}장을 버렸어요`); return r;
      }
      case 'robber': {
        const hk = String(args[0]); let victim = args[1] || null;
        if (!mine) return bad();
        const cands = R.getPlayersOnHex(g, hk, pi).map(i => g.players[i]).filter(p => cardCount(p) > 0);
        if (victim && !cands.some(p => p.id === victim)) victim = null;
        if (!victim && cands.length) victim = cands[Math.random() * cands.length | 0].id;
        r = fin(R.moveRobber(g, pid, hk, victim)); if (r.error) return r;
        cLog(r.stolenInfo ? `${nm}: 도둑을 옮기고 ${r.stolenInfo.victimName}님 카드 1장을 가져갔어요` : `${nm}: 도둑을 옮겼어요`); return r;
      }
      case 'buyDev': r = fin(R.buyDevCard(g, pid)); if (!r.error) cLog(`${nm}: 발전 카드를 샀어요`); return r;
      case 'dev': {
        const card = String(args[0]), res = args[1];
        if (!mine || !(g.turnPhase === 'main' || g.turnPhase === 'roll')) return bad();
        if (card === 'monopoly' && !RES.includes(res)) return bad();
        let before = 0; if (card === 'monopoly') before = P.resources[res];
        r = fin(R.playDevCard(g, pid, card, { resource: res })); if (r.error) return r;
        cLog(card === 'monopoly' ? `${nm}: 독점! ${RES_KO[res]} ${P.resources[res] - before}장을 모두에게서 가져갔어요` : `${nm}: 발전 카드 '${DEV_KO[card]}'을 썼어요`); return r;
      }
      case 'yop': if (!RES.includes(args[0])) return bad(); r = fin(R.yearOfPlentyPick(g, pid, args[0])); if (!r.error) cLog(`${nm}: 풍년으로 ${RES_KO[args[0]]} 1장`); return r;
      case 'bank': {
        const give = args[0], get = args[1]; if (!RES.includes(give) || !RES.includes(get) || give === get) return bad();
        const ratio = R.getTradeRatio(g, pi, give);
        r = fin(R.bankTrade(g, pid, give, ratio, get)); if (!r.error) cLog(`${nm}: 은행과 교환 (${RES_KO[give]} ${ratio} → ${RES_KO[get]} 1)`); return r;
      }
      case 'offer': {
        const cl = o => { const z = {}; for (const k of RES) { const n = Math.floor(+((o || {})[k]) || 0); if (n > 0 && n < 20) z[k] = n; } return z; };
        const offer = cl(args[0]), req = cl(args[1]);
        if (!Object.keys(offer).length || !Object.keys(req).length) return bad('주는 것과 받는 것을 모두 골라 주세요');
        r = fin(R.proposeTrade(g, pid, offer, req)); if (!r.error) cLog(`${nm}: 교환 제안 — 주는 것 [${resText(offer)}] / 받는 것 [${resText(req)}]`); return r;
      }
      case 'respond': {
        const tr = g.tradeOffer; if (!tr) return bad('제안이 이미 끝났어요');
        const from = g.players[tr.from];
        if (args[0] && RES.some(k => (from.resources[k] || 0) < (tr.offer[k] || 0))) { g.tradeOffer = null; X.seq++; return bad('제안한 사람의 자원이 바뀌어 취소됐어요'); }
        r = fin(R.respondToTrade(g, pid, !!args[0])); if (!r.error) cLog(r.traded ? `${nm}님이 ${from.name}님의 제안을 받아 교환했어요` : `${nm}: 제안을 거절했어요`); return r;
      }
      case 'cancel': r = fin(R.cancelTrade(g, pid)); if (!r.error) cLog(`${nm}: 제안을 취소했어요`); return r;
      case 'end': r = fin(R.endTurn(g, pid)); if (!r.error) cLog(`— ${cCur().name}님 차례 —`); return r;
    }
    return bad();
  }
  // someone who has to act is not in the room (or the host presses "대신 진행"): play the simplest legal move for them
  function cWaiting() {
    if (!G || G.phase === 'finished') return [];
    if (G.phase === 'playing' && G.turnPhase === 'discard') return G.discardingPlayers.map(d => G.players[d.playerIndex].id);
    return [cCur().id];
  }
  const cAutoMove = pid => { try { return botTurn(pid); } catch (e) { return null; } };
  function cAuto(pid) {
    const g = G, geo = cGeo(), P = g.players.find(p => p.id === pid); if (!P) return;
    const pick = a => a[Math.random() * a.length | 0];
    let r = null;
    if (g.phase === 'setup') {
      if (g.x.step === 'settle') {
        const vs = geo.V.filter(v => R.canPlaceSettlement(g, pid, v.keys[0], true).valid);
        const score = v => g.x && R.getVertexAdjacentHexes(g, v.keys[0]).reduce((s, h) => s + (PIPS[h.number] || 0), 0);
        vs.sort((a, b) => score(b) - score(a)); if (vs.length) r = cDo(pid, 'settle', [pick(vs.slice(0, 4)).keys[0]]);
      } else { const es = geo.E.filter(e => R.canPlaceRoad(g, pid, e.keys[0], true, g.x.last).valid); if (es.length) r = cDo(pid, 'road', [pick(es).keys[0]]); }
    } else if (g.turnPhase === 'discard') {
      const d = g.discardingPlayers.find(x => g.players[x.playerIndex].id === pid); if (!d) return;
      const pool = []; for (const k of RES) for (let i = 0; i < P.resources[k]; i++) pool.push(k);
      const o = {}; shuffle(pool).slice(0, d.cardsToDiscard).forEach(k => { o[k] = (o[k] || 0) + 1; }); r = cDo(pid, 'discard', [o]);
    } else if (cCur().id !== pid) return;
    else if (g.turnPhase === 'robber') r = cDo(pid, 'robber', [pick(Object.keys(g.hexes).filter(k => k !== g.robber)), null]);
    else if (g.turnPhase === 'roll') r = cDo(pid, 'roll', []);
    else if (g.turnPhase === 'main') { if (g.tradeOffer) g.tradeOffer = null; r = cDo(pid, 'end', []); }
    if (r && !r.error) { cLog(`(${P.name}님 대신 자동으로 진행했어요)`); cPush(); }
  }
  // ================= 카탄 컴퓨터 =================
  // The table host runs every computer player. They are ordinary players in the game with bot:true, so
  // if the host leaves, the next host picks them up and the game carries on.
  const BOT_KO = { easy: '하', mid: '중', hard: '상' };
  const BOT_WAIT0 = { easy: 1100, mid: 800, hard: 550 };
  const BOT_WAIT = new Proxy(BOT_WAIT0, { get: (t, k) => (t[k] || 800) / (window.__botFast || 1) });
  const BOT_NAMES = ['도담', '보리', '초롱', '하람', '소리'];
  let botAt = 0;
  const isBot = pid => { const p = G && G.players && G.players.find(x => x.id === pid); return !!(p && p.bot); };
  const botLevel = pid => { const p = G.players.find(x => x.id === pid); return p && p.level || 'mid'; };
  const pick = a => a[Math.random() * a.length | 0];
  const need = (P, cost) => RES.reduce((n, k) => n + Math.max(0, (cost[k] || 0) - P.resources[k]), 0);
  const canAfford = (P, cost) => need(P, cost) === 0;
  // how good a corner is: the numbers around it, plus a bonus for covering different resources
  function vScore(vkey, lvl) {
    const hexes = R.getVertexAdjacentHexes(G, vkey) || [];
    let s = 0; const kinds = new Set();
    for (const h of hexes) { s += PIPS[h.number] || 0; if (h.terrain && h.terrain !== 'desert') kinds.add(h.terrain); }
    if (lvl === 'easy') return s;
    let bonus = kinds.size * 1.3;
    if (lvl === 'hard') { for (const h of hexes) if (h.terrain === 'mountains' || h.terrain === 'fields') bonus += (PIPS[h.number] || 0) * 0.25; }
    return s + bonus;
  }
  const bestOf = (list, scoreFn, lvl) => {
    if (!list.length) return null;
    const scored = list.map(v => ({ v, s: scoreFn(v) })).sort((a, b) => b.s - a.s);
    if (lvl === 'easy') return pick(scored).v;
    if (lvl === 'mid') return pick(scored.slice(0, Math.max(1, Math.min(4, scored.length)))).v;
    return scored[0].v;
  };
  const myVertices = pi => { const out = []; for (const k in G.vertices) { const b = G.vertices[k]; if (b && b.building && b.owner === pi) out.push(Object.assign({ key: k }, b)); } return out; };
  // a road is worth building when it reaches a corner we could settle on later
  function roadValue(ekey, pid, lvl) {
    const geo = cGeo(), e = geo.E.find(x => x.keys.includes(ekey)); if (!e) return 0;
    let best = 0;
    for (const [vx, vy] of [[e.x1, e.y1], [e.x2, e.y2]]) {
      const v = geo.V.find(p => Math.abs(p.x - vx) < 0.01 && Math.abs(p.y - vy) < 0.01); if (!v) continue;
      if (vBuild(v)) continue;
      const far = R.canPlaceSettlement(G, pid, v.keys[0], false);
      best = Math.max(best, vScore(v.keys[0], lvl) * (far.valid ? 1 : 0.55));
    }
    return best;
  }
  function botDiscard(pid) {
    const P = G.players.find(p => p.id === pid), d = G.discardingPlayers.find(x => G.players[x.playerIndex].id === pid);
    if (!d) return null;
    const keep = { ore: 3, grain: 3, brick: 1, lumber: 1, wool: 1 }, pool = [];
    for (const k of RES) for (let n = 0; n < P.resources[k]; n++) pool.push(k);
    pool.sort((a, b) => (P.resources[b] - (keep[b] || 0)) - (P.resources[a] - (keep[a] || 0)));
    const o = {}; pool.slice(0, d.cardsToDiscard).forEach(k => { o[k] = (o[k] || 0) + 1; });
    return cDo(pid, 'discard', [o]);
  }
  function botRobber(pid, lvl) {
    const pi = G.players.findIndex(p => p.id === pid);
    const keys = Object.keys(G.hexes).filter(k => k !== G.robber);
    const hurt = hk => {
      if (lvl === 'easy') return Math.random();
      const on = R.getPlayersOnHex(G, hk, -1) || [];
      let s = 0;
      for (const idx of on) {
        if (idx === pi) return -100;   // never rob myself
        s += (PIPS[G.hexes[hk].number] || 0) + (lvl === 'hard' ? G.players[idx].victoryPoints * 1.5 : 0);
      }
      return s;
    };
    const hk = bestOf(keys, hurt, lvl === 'easy' ? 'easy' : 'hard');
    const cands = R.getPlayersOnHex(G, hk, pi).map(k => G.players[k]).filter(p => cardCount(p) > 0);
    const victim = cands.length ? (lvl === 'hard' ? cands.sort((a, b) => b.victoryPoints - a.victoryPoints)[0] : pick(cands)) : null;
    return cDo(pid, 'robber', [hk, victim ? victim.id : null]);
  }
  // trade with the bank only when it finishes something we are saving for
  function botBankTrade(pid, lvl, want) {
    if (lvl === 'easy') return null;
    const g = G, pi = g.players.findIndex(p => p.id === pid), P = g.players[pi];
    const short = RES.filter(k => (want[k] || 0) > P.resources[k]);
    if (short.length !== 1) return null;
    const get = short[0];
    for (const give of RES) {
      if (give === get) continue;
      const ratio = R.getTradeRatio(g, pi, give);
      if (P.resources[give] - ratio >= (want[give] || 0)) return cDo(pid, 'bank', [give, get]);
    }
    return null;
  }
  function botPlayDev(pid, lvl) {
    const g = G, pi = g.players.findIndex(p => p.id === pid), P = g.players[pi];
    if (lvl === 'easy' || g.devCardPlayedThisTurn) return null;
    const have = c => P.developmentCards.includes(c);
    const robberOnMe = R.getPlayersOnHex(g, g.robber, -1) || [];
    if (have('knight') && (robberOnMe.includes(pi) || (lvl === 'hard' && P.knightsPlayed >= 2))) return cDo(pid, 'dev', ['knight']);
    if (have('monopoly')) {
      const best = RES.map(k => ({ k, n: g.players.reduce((a, q, qi) => a + (qi === pi ? 0 : q.resources[k]), 0) })).sort((a, b) => b.n - a.n)[0];
      if (best.n >= (lvl === 'hard' ? 4 : 6)) return cDo(pid, 'dev', ['monopoly', best.k]);
    }
    if (have('roadBuilding') && P.roads >= 2) return cDo(pid, 'dev', ['roadBuilding']);
    if (have('yearOfPlenty')) return cDo(pid, 'dev', ['yearOfPlenty']);
    return null;
  }
  function botTurn(pid) {
    const g = G, lvl = botLevel(pid), pi = g.players.findIndex(p => p.id === pid), P = g.players[pi], BC = R.BUILDING_COSTS;
    const geo = cGeo();
    if (g.phase === 'setup') {
      if (g.x.step === 'settle') {
        const spots = geo.V.filter(v => R.canPlaceSettlement(g, pid, v.keys[0], true).valid).map(v => v.keys[0]);
        return spots.length ? cDo(pid, 'settle', [bestOf(spots, k => vScore(k, lvl), lvl)]) : null;
      }
      const roads = geo.E.filter(e => R.canPlaceRoad(g, pid, e.keys[0], true, g.x.last).valid).map(e => e.keys[0]);
      return roads.length ? cDo(pid, 'road', [bestOf(roads, k => roadValue(k, pid, lvl), lvl)]) : null;
    }
    if (g.turnPhase === 'discard') return botDiscard(pid);
    if (g.currentPlayerIndex !== pi) return null;
    if (g.turnPhase === 'robber') return botRobber(pid, lvl);
    if (g.yearOfPlentyPicks > 0) { const want = RES.slice().sort((a, b) => P.resources[a] - P.resources[b])[0]; return cDo(pid, 'yop', [want]); }
    if (g.turnPhase === 'roll') { const r = botPlayDev(pid, lvl); return r && !r.error ? r : cDo(pid, 'roll', []); }
    if (g.turnPhase !== 'main') return null;
    if (g.freeRoads > 0) {
      const roads = geo.E.filter(e => R.canPlaceRoad(g, pid, e.keys[0], false, null).valid).map(e => e.keys[0]);
      return roads.length ? cDo(pid, 'road', [bestOf(roads, k => roadValue(k, pid, lvl), lvl)]) : cDo(pid, 'end', []);
    }
    let r = botPlayDev(pid, lvl); if (r && !r.error) return r;
    // 1) a city on my best settlement
    const mine = myVertices(pi).filter(b => b.building === 'settlement');
    if (mine.length && P.cities > 0) {
      if (canAfford(P, BC.city)) return cDo(pid, 'city', [bestOf(mine.map(b => b.key), k => vScore(k, lvl), lvl)]);
      if (lvl !== 'easy') { const t = botBankTrade(pid, lvl, BC.city); if (t && !t.error) return t; }
    }
    // 2) a new settlement where I can reach
    const spots = geo.V.filter(v => R.canPlaceSettlement(g, pid, v.keys[0], false).valid).map(v => v.keys[0]);
    if (spots.length && P.settlements > 0) {
      if (canAfford(P, BC.settlement)) return cDo(pid, 'settle', [bestOf(spots, k => vScore(k, lvl), lvl)]);
      const t = botBankTrade(pid, lvl, BC.settlement); if (t && !t.error) return t;
    }
    // 3) a road, but only to open up a new corner — roads built for their own sake just use up pieces
    const roads = geo.E.filter(e => R.canPlaceRoad(g, pid, e.keys[0], false, null).valid).map(e => e.keys[0]);
    const needRoad = roads.length && P.roads > 0 && P.settlements > 0 && (lvl === 'easy' ? Math.random() < 0.5 : spots.length === 0);
    if (needRoad) {
      if (canAfford(P, BC.road)) return cDo(pid, 'road', [bestOf(roads, k => roadValue(k, pid, lvl), lvl)]);
      const t = botBankTrade(pid, lvl, BC.road); if (t && !t.error) return t;
    }
    // 4) a development card with what is left over
    if (g.devCardDeck.length && canAfford(P, BC.developmentCard) && (lvl === 'hard' || Math.random() < 0.5)) return cDo(pid, 'buyDev', []);
    // 5) nothing to do: trade spare cards toward whatever we are saving for next
    if (lvl !== 'easy') {
      const goal = (mine.length && P.cities > 0) ? BC.city : spots.length ? BC.settlement : BC.road;
      const t = botBankTrade(pid, lvl, goal); if (t && !t.error) return t;
    }
    return cDo(pid, 'end', []);
  }
  // answer a human's trade offer
  function botTrade(pid) {
    const g = G, tr = g.tradeOffer, lvl = botLevel(pid), pi = g.players.findIndex(p => p.id === pid), P = g.players[pi];
    if (!tr || tr.from === pi || tr.responses[pid]) return null;
    if (RES.some(k => P.resources[k] < (tr.request[k] || 0))) return cDo(pid, 'respond', [false]);
    if (lvl === 'easy') return cDo(pid, 'respond', [Math.random() < 0.35]);
    const gain = RES.reduce((a, k) => a + (tr.offer[k] || 0) * (P.resources[k] < 2 ? 2 : 1), 0);
    const loss = RES.reduce((a, k) => a + (tr.request[k] || 0) * (P.resources[k] <= (tr.request[k] || 0) ? 2.4 : 1), 0);
    const leader = g.players[tr.from].victoryPoints >= 7 && lvl === 'hard';
    return cDo(pid, 'respond', [!leader && gain >= loss]);
  }
  function botStep(now) {
    if (!G || G.phase === 'finished' || now - botAt < 300) return false;
    const waiting = cWaiting().filter(isBot);
    if (G.tradeOffer) for (const p of G.players) if (p.bot && !G.tradeOffer.responses[p.id] && G.tradeOffer.from !== G.players.indexOf(p)) {
      if (now - botAt < BOT_WAIT[p.level] ) return false;
      botAt = now; const r = botTrade(p.id); if (r && !r.error) { cPush(); return true; }
    }
    if (!waiting.length) return false;
    const pid = waiting[0];
    if (now - botAt < BOT_WAIT[botLevel(pid)]) return false;
    botAt = now;
    const r = botTurn(pid);
    if (r && r.error) { const f = cAutoMove(pid); if (!f) cDo(pid, 'end', []); }   // never let a computer jam the game
    cPush(); return true;
  }
  // how long the person whose turn it is has left, in milliseconds
  const TURN_MS = { setup: 60000, roll: 45000, main: 100000, robber: 45000, discard: 45000 };
  function turnWindow() {
    if (!G) return TURN_MS.main;
    if (G.phase === 'setup') return TURN_MS.setup;
    return TURN_MS[G.turnPhase] || TURN_MS.main;
  }
  const turnLeft = now => Math.max(0, turnWindow() - ((now || Date.now()) - (G.x.actAt || Date.now())));
  function cTick() {
    if (!G || G.phase === 'finished') return;
    if (botStep(performance.now())) return;
    const t = Date.now();
    for (const id of cWaiting()) {
      if (id === me() || O.here(id) || isBot(id)) { delete C.absent[id]; continue; }
      if (!C.absent[id]) C.absent[id] = t;
      else if (t - C.absent[id] > 6000) { C.absent[id] = t - 3500; cAuto(id); return; }
    }
    // a turn clock, so one person thinking forever cannot stall the table
    const waits = cWaiting().filter(id => !isBot(id));
    if (waits.length) {
      const left = turnLeft(t);
      if (left <= 0) { G.x.actAt = t; for (const id of waits) cAuto(id); return; }
    }
    // a trade offer nobody in the room can answer
    if (G.tradeOffer && !G.players.some((p, i) => i !== G.tradeOffer.from && (O.here(p.id) || p.bot) && G.tradeOffer.responses[p.id] !== 'decline')) { G.tradeOffer = null; G.x.seq++; cPush(); }
  }

  // ---- everyone: show the state ----
  function cApply(g) {
    const first = !G || C.lastSeq < 0, old = C.lastSeq;
    G = g; C.lastSeq = g.x.seq; C.busy = 0;
    if (!first && g.x.seq !== old) {
      if (g.diceRoll && C.dice !== g.x.seq && /🎲/.test(g.x.log[g.x.log.length - 2] || '') + /🎲/.test(g.x.log[g.x.log.length - 1] || '')) { C.dice = g.x.seq; C.flash = now(); sfx('pop', 0.4); }
      if (cMine() && C.turnOf !== g.currentPlayerIndex + ':' + g.turnPhase + ':' + g.x.step) sfx('ding', 0.35);
    }
    C.turnOf = g.currentPlayerIndex + ':' + g.turnPhase + ':' + g.x.step;
    if (g.phase === 'finished' && !C.won) { C.won = true; sfx('goal', 0.5); }
    if (g.phase !== 'finished') C.won = false;
    // what the board is waiting for me to do
    const mine = cMine();
    if (g.phase === 'setup') C.mode = mine ? g.x.step : null;
    else if (mine && g.turnPhase === 'robber') C.mode = 'robber';
    else if (mine && g.freeRoads > 0 && (g.turnPhase === 'main' || g.turnPhase === 'roll')) C.mode = 'road';
    else if (!mine || g.turnPhase !== 'main') C.mode = null;
    else if (C.mode === 'robber') C.mode = null;
    C.pend = null;
    if (C.panel && (C.panel.t === 'steal' || (C.panel.t === 'trade' && (!mine || g.turnPhase !== 'main')) || (C.panel.t === 'mono' && !mine))) C.panel = null;
    render();
  }
  const cValid = () => {
    const g = G, geo = cGeo(), id = me(), i = cIdx(), out = [];
    if (i < 0 || !C.mode) return out;
    if (C.mode === 'settle') for (const v of geo.V) { if (R.canPlaceSettlement(g, id, v.keys[0], g.phase === 'setup').valid) out.push({ x: v.x, y: v.y, key: v.keys[0] }); }
    if (C.mode === 'road') for (const e of geo.E) { if (R.canPlaceRoad(g, id, e.keys[0], g.phase === 'setup', g.x.last).valid) out.push({ x: e.mx, y: e.my, key: e.keys[0], e }); }
    if (C.mode === 'city') for (const v of geo.V) { const b = vBuild(v); if (b && b.building === 'settlement' && b.owner === i) out.push({ x: v.x, y: v.y, key: b.key }); }
    if (C.mode === 'robber') for (const h of geo.H) if (h.k !== g.robber) out.push({ x: h.x, y: h.y, key: h.k, hex: true });
    return out;
  };
  function cDraw() {
    const d = C.dom; if (!d || !G) return;
    const cv = d.cv, geo = cGeo(), bw = geo.x1 - geo.x0, bh = geo.y1 - geo.y0;
    // as big as the space allows, in width and in height, so a wide screen gets a big board
    // and a phone never has to scroll past it
    const box = cv.parentNode, availW = (box && box.clientWidth) || cv.clientWidth || 300;
    const availH = Math.max(200, window.innerHeight - (window.innerWidth >= 900 ? 240 : 430));
    const S = Math.min(availW / bw, availH / bh), wCss = Math.round(S * bw), hCss = Math.round(S * bh);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (cv.width !== Math.round(wCss * dpr) || cv.height !== Math.round(hCss * dpr)) { cv.width = Math.round(wCss * dpr); cv.height = Math.round(hCss * dpr); cv.style.width = wCss + 'px'; cv.style.height = hCss + 'px'; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, wCss, hCss);
    const X = x => (x - geo.x0) * S, Y = y => (y - geo.y0) * S, INK = '#251c2c';
    C.S = S; C.X = X; C.Y = Y;
    g.fillStyle = '#4fa6dc'; g.fillRect(0, 0, wCss, hCss);
    g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 40; i++) g.fillRect((i * 97 % 100) / 100 * wCss, (i * 53 % 100) / 100 * hCss, S * 0.3, 2);
    const ANG = [90, 30, -30, -90, -150, 150].map(a => a * Math.PI / 180);
    const hexPath = (cx, cy, k) => { g.beginPath(); for (let i = 0; i < 6; i++) { const px = X(cx + Math.cos(ANG[i]) * k), py = Y(cy - Math.sin(ANG[i]) * k); if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); };
    // sand under the land
    g.fillStyle = '#f1dfae'; for (const h of geo.H) { hexPath(h.x, h.y, 1.16); g.fill(); }
    // ports
    g.font = `700 ${Math.max(9, S * 0.3)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of geo.ports) {
      g.strokeStyle = '#8a5a3b'; g.lineWidth = Math.max(2, S * 0.07); g.beginPath(); g.moveTo(X(p.a.x), Y(p.a.y)); g.lineTo(X(p.x), Y(p.y)); g.lineTo(X(p.b.x), Y(p.b.y)); g.stroke();
      g.fillStyle = p.res ? RES_COL[p.res] : '#fdfcf7'; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(X(p.x), Y(p.y), S * 0.36, 0, 6.3); g.fill(); g.stroke();
      g.fillStyle = p.res && p.res !== 'grain' && p.res !== 'wool' ? '#fff' : INK; g.fillText(p.ratio + ':1', X(p.x), Y(p.y));
    }
    const roll = G.diceRoll && G.diceRoll.total, glow = now() - C.flash < 2600;
    g.imageSmoothingEnabled = false;
    for (const h of geo.H) {
      const hx = G.hexes[h.k];
      // one flat main colour per land, with the matching resource picture on it
      hexPath(h.x, h.y, 0.99); g.fillStyle = TERRAIN_COL[hx.terrain] || '#ccc'; g.fill();
      hexPath(h.x, h.y, 0.99); g.strokeStyle = INK; g.lineWidth = Math.max(1.5, S * 0.05); g.stroke();
      hexPath(h.x, h.y, 0.86); g.strokeStyle = TERRAIN_EDGE[hx.terrain] || 'rgba(0,0,0,.12)'; g.lineWidth = Math.max(1, S * 0.04); g.stroke();
      const ic = TERRAIN_ICON[hx.terrain];
      if (ic) { const w = S * 0.74; g.globalAlpha = 0.95; g.drawImage(iconCanvas(ic), X(h.x) - w / 2, Y(h.y - 0.62) - w / 2, w, w); g.globalAlpha = 1; }
      if (glow && roll && hx.number === roll && h.k !== G.robber) { hexPath(h.x, h.y, 0.88); g.strokeStyle = '#fff'; g.lineWidth = Math.max(3, S * 0.09); g.stroke(); }
      if (hx.number) {
        const hot = hx.number === 6 || hx.number === 8, cx = X(h.x), cy = Y(h.y + 0.24), rad = S * 0.42;
        g.beginPath(); g.arc(cx, cy, rad, 0, 6.3); g.fillStyle = hot ? '#fff1ef' : '#fff8ea'; g.fill();
        g.strokeStyle = INK; g.lineWidth = Math.max(2, S * 0.06); g.stroke();
        // the pixel size has to be a whole number of screen pixels or the digits blur into squiggles
        const dn = String(hx.number).length, fit = (rad * 1.05) / (5 * dn - 1);
        pixNum(g, hx.number, cx, cy - S * 0.055, Math.max(1, Math.floor(Math.min(rad * 0.17, fit))), hot ? '#cf2f24' : '#251c2c');
        g.fillStyle = hot ? '#cf2f24' : '#251c2c';   // pixNum puts the colour back, so set it again for the pips
        const n = PIPS[hx.number], pw = Math.max(1.5, S * 0.06);
        for (let i = 0; i < n; i++) g.fillRect(cx - (n * pw * 1.7) / 2 + i * pw * 1.7 + pw * 0.35, cy + rad * 0.44, pw, pw);
      } else { g.fillStyle = 'rgba(37,28,44,.5)'; g.font = `700 ${Math.max(9, S * 0.26)}px sans-serif`; g.fillText('사막', X(h.x), Y(h.y + 0.3)); }
      if (h.k === G.robber) {
        const w = S * 0.95;
        g.globalAlpha = 0.25; g.fillStyle = '#000'; hexPath(h.x, h.y, 0.99); g.fill(); g.globalAlpha = 1;
        g.drawImage(robberCanvas(), X(h.x) - w / 2, Y(h.y + 0.1) - w / 2, w, w);
      }
    }
    // roads
    g.lineCap = 'round';
    for (const e of geo.E) {
      const rd = eRoad(e); if (!rd) continue;
      const ax = e.x1 + (e.x2 - e.x1) * 0.16, ay = e.y1 + (e.y2 - e.y1) * 0.16, bx = e.x1 + (e.x2 - e.x1) * 0.84, by = e.y1 + (e.y2 - e.y1) * 0.84;
      g.strokeStyle = INK; g.lineWidth = S * 0.2; g.beginPath(); g.moveTo(X(ax), Y(ay)); g.lineTo(X(bx), Y(by)); g.stroke();
      g.strokeStyle = pcol(rd.owner); g.lineWidth = S * 0.12; g.beginPath(); g.moveTo(X(ax), Y(ay)); g.lineTo(X(bx), Y(by)); g.stroke();
    }
    // buildings
    for (const v of geo.V) {
      const bd = vBuild(v); if (!bd) continue;
      const cx = X(v.x), cy = Y(v.y), u = S * (bd.building === 'city' ? 0.2 : 0.16);
      g.fillStyle = pcol(bd.owner); g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
      if (bd.building === 'city') { g.moveTo(cx - u * 1.5, cy + u); g.lineTo(cx - u * 1.5, cy - u * 0.2); g.lineTo(cx - u * 0.2, cy - u * 0.2); g.lineTo(cx - u * 0.2, cy - u * 1.1); g.lineTo(cx + u * 0.65, cy - u * 1.9); g.lineTo(cx + u * 1.5, cy - u * 1.1); g.lineTo(cx + u * 1.5, cy + u); }
      else { g.moveTo(cx - u, cy + u); g.lineTo(cx - u, cy - u * 0.3); g.lineTo(cx, cy - u * 1.3); g.lineTo(cx + u, cy - u * 0.3); g.lineTo(cx + u, cy + u); }
      g.closePath(); g.fill(); g.stroke();
    }
    // where I can act
    const spots = cValid(); C.spots = spots;
    if (spots.length) {
      const pulse = 0.5 + 0.5 * Math.sin(now() / 260), col = pcol(cIdx());
      for (const s of spots) {
        const sel = C.pend === s.key, rad = S * (s.hex ? 0.5 : 0.2) * (sel ? 1.25 : 1);
        g.beginPath(); g.arc(X(s.x), Y(s.y), rad, 0, 6.3);
        g.fillStyle = sel ? col : `rgba(255,255,255,${s.hex ? 0.12 + pulse * 0.12 : 0.55 + pulse * 0.35})`; g.fill();
        g.strokeStyle = sel ? '#fff' : col; g.lineWidth = sel ? 3 : 2; g.stroke();
      }
    }
    cancelAnimationFrame(C.raf);
    if ((spots.length || glow) && !root.hidden) C.raf = requestAnimationFrame(cDraw);
  }
  function cTap(ev) {
    if (!G || !C.spots || !C.spots.length) return;
    const rc = C.dom.cv.getBoundingClientRect(), px = ev.clientX - rc.left, py = ev.clientY - rc.top;
    let best = null, bd = 1e9;
    for (const s of C.spots) { const d = Math.hypot(C.X(s.x) - px, C.Y(s.y) - py); if (d < bd) { bd = d; best = s; } }
    if (!best || bd > C.S * (best.hex ? 0.85 : 0.48)) { C.pend = null; cDraw(); return; }
    if (C.pend !== best.key) { C.pend = best.key; cDraw(); cStatus(); return; }   // first tap picks, second tap confirms
    C.pend = null;
    if (C.mode === 'robber') {
      const cands = R.getPlayersOnHex(G, best.key, cIdx()).map(i => G.players[i]).filter(p => cardCount(p) > 0);
      if (cands.length > 1) { C.panel = { t: 'steal', hex: best.key, cands: cands.map(p => p.id) }; cUpdate(); return; }
      cAct('robber', [best.key, cands.length ? cands[0].id : null]); return;
    }
    const a = C.mode; if (G.phase !== 'setup' && !(a === 'road' && G.freeRoads > 0)) C.mode = null;
    cAct(a, [best.key]);
  }

  function cStatusText() {
    const g = G, cur = cCur(), mine = cMine(), i = cIdx(), nm = cur.name;
    if (g.phase === 'finished') { const w = g.players.find(p => p.id === g.winner); return [`🏆 ${w ? w.name : ''}님 승리!`, 'done']; }
    if (g.phase === 'setup') return mine ? [g.x.step === 'settle' ? '내 차례! 마을을 놓을 곳을 눌러요 (한 번 더 누르면 확정)' : '이어서 길을 놓을 곳을 눌러요', 'mine'] : [`${nm}님이 ${g.x.step === 'settle' ? '마을' : '길'}을 놓고 있어요`, ''];
    if (g.turnPhase === 'discard') {
      const d = g.discardingPlayers.find(x => x.playerIndex === i);
      return d ? [`7이 나왔어요! 카드 ${d.cardsToDiscard}장을 골라 버려요`, 'mine'] : [`카드를 버리는 중: ${g.discardingPlayers.map(x => g.players[x.playerIndex].name).join(', ')}`, ''];
    }
    if (g.turnPhase === 'robber') return mine ? ['도둑을 옮길 땅을 눌러요 (한 번 더 누르면 확정)', 'mine'] : [`${nm}님이 도둑을 옮기고 있어요`, ''];
    if (g.turnPhase === 'roll') return mine ? ['내 차례! 주사위를 굴려요', 'mine'] : [`${nm}님이 주사위를 굴릴 차례예요`, ''];
    if (mine && g.yearOfPlentyPicks > 0) return [`풍년! 받을 자원을 골라요 (${g.yearOfPlentyPicks}장 남음)`, 'mine'];
    if (mine && g.freeRoads > 0) return [`도로 건설! 길 놓을 곳을 눌러요 (${g.freeRoads}개 남음)`, 'mine'];
    if (mine) return [C.mode === 'settle' ? '마을을 지을 곳을 눌러요' : C.mode === 'road' ? '길을 놓을 곳을 눌러요' : C.mode === 'city' ? '도시로 키울 마을을 눌러요' : '내 차례! 짓거나 교환하고, 다 했으면 턴 종료', 'mine'];
    return [`${nm}님 차례예요`, ''];
  }
  function cStatus() {
    const d = C.dom; if (!d) return;
    const [text, cls] = cStatusText(); d.status.textContent = C.pend ? '같은 곳을 한 번 더 누르면 확정돼요' : text; d.status.className = 'ct-status ' + cls;
    cClock();
  }
  // the turn clock, shown only when it is getting tight
  function cClock() {
    const d = C.dom; if (!d || !d.clock || !G) return;
    const waiting = G.phase !== 'finished' && cWaiting().some(id => !isBot(id));
    const left = waiting ? turnLeft() : 0, secs = Math.ceil(left / 1000);
    const show = waiting && left < 30000;
    d.clock.hidden = !show;
    if (show) { d.clock.textContent = '⏱ ' + secs + '초'; d.clock.classList.toggle('hurry', left < 10000); }
  }
  const resChip = (k, n, extra) => { const c = el('span', 'ct-res' + (extra || '')); c.style.setProperty('--c', RES_COL[k]); c.append(el('b', '', RES_KO[k]), el('i', '', n)); return c; };
  function cMount(body) {
    const d = C.dom = {};
    d.players = el('div', 'ct-players'); d.status = el('p', 'ct-status'); d.dice = el('div', 'ct-dice'); d.clock = el('span', 'ct-clock'); d.clock.hidden = true;
    const top = el('div', 'ct-top'); top.append(d.status, d.clock, d.dice);
    d.cv = el('canvas', 'ct-board'); d.cv.addEventListener('pointerdown', cTap);
    d.panel = el('div', 'ct-panel'); d.hand = el('div', 'ct-hand'); d.acts = el('div', 'ct-acts'); d.log = el('div', 'ct-log');
    const left = d.left = el('div', 'ct-left'), right = el('div', 'ct-right');
    left.append(d.cv); right.append(d.panel, d.hand, d.acts, d.log);
    const cols = el('div', 'ct-cols'); cols.append(left, right);
    body.append(d.players, top, cols);
    d.ro = new ResizeObserver(() => cDraw()); d.ro.observe(d.left);
    d.clockIv = setInterval(cClock, 500);   // the box, not the canvas: its size is ours to set
    d.onwin = () => cDraw(); window.addEventListener('resize', d.onwin);
    cUpdate();
  }
  function cUnmount() {
    if (C.dom) { if (C.dom.ro) C.dom.ro.disconnect(); if (C.dom.onwin) window.removeEventListener('resize', C.dom.onwin); clearInterval(C.dom.clockIv); }
    cancelAnimationFrame(C.raf); C.dom = null; C.panel = null; C.mode = null; C.pend = null; C.lastSeq = -1;
  }
  const mkBtn = (text, cls, fn, dis) => { const b = el('button', 'btn ' + (cls || ''), text); b.type = 'button'; if (dis) b.disabled = true; b.addEventListener('click', fn); return b; };
  function cUpdate() {
    const d = C.dom; if (!d || !G) return;
    const g = G, i = cIdx(), mine = cMine(), meP = i >= 0 ? g.players[i] : null, playing = g.phase === 'playing';
    // players
    // one card per player: their own little character in the middle, what they are holding on either side
    d.players.innerHTML = '';
    g.players.forEach((p, pi) => {
      const c = el('div', 'ct-p' + (pi === g.currentPlayerIndex && g.phase !== 'finished' ? ' on' : '') + (O.here(p.id) || p.bot ? '' : ' away'));
      const head = el('div', 'ct-phead'), dot = el('i', 'ct-dot'); dot.style.background = pcol(pi);
      const vp = p.victoryPoints + (pi === i ? (p.hiddenVictoryPoints || 0) : 0);
      head.append(dot, el('b', 'ct-pname', p.name + (p.id === me() ? ' (나)' : '')), el('span', 'ct-vp', `★${vp}`));
      if (p.knightsPlayed) head.appendChild(el('span', 'ct-mini', `🛡${p.knightsPlayed}`));
      if (p.hasLongestRoad) head.appendChild(el('span', 'ct-badge', '최장 도로 +2'));
      if (p.hasLargestArmy) head.appendChild(el('span', 'ct-badge', '최대 기사단 +2'));
      if (p.bot) head.appendChild(el('span', 'ct-mini', '🤖 ' + (BOT_KO[p.level] || '컴퓨터')));
      else if (!O.here(p.id)) head.appendChild(el('span', 'ct-off', '자리 비움'));
      const body = el('div', 'ct-pbody'), L = el('div', 'ct-icside'), Rt = el('div', 'ct-icside');
      const devs = p.developmentCards.length + p.newDevCards.length;
      L.append(iconEl('lumber', p.resources.lumber), iconEl('grain', p.resources.grain), iconEl('dev', devs, 'dev'));
      Rt.append(iconEl('brick', p.resources.brick), iconEl('ore', p.resources.ore), iconEl('wool', p.resources.wool));
      const av = el('div', 'ct-avwrap'); av.appendChild(avatarEl(p.id, p.look));
      body.append(L, av, Rt); c.append(head, body);
      d.players.appendChild(c);
    });
    cStatus();
    d.dice.innerHTML = '';
    if (g.diceRoll) {
      d.dice.append(pixEl(dieCanvas(g.diceRoll.die1), 'ct-die', '주사위 ' + g.diceRoll.die1), pixEl(dieCanvas(g.diceRoll.die2), 'ct-die', '주사위 ' + g.diceRoll.die2));
      const tot = el('b', 'ct-total' + (g.diceRoll.total === 7 ? ' seven' : ''), String(g.diceRoll.total));
      d.dice.appendChild(tot);
    } else d.dice.appendChild(el('span', 'ct-tip', '아직 주사위를 굴리지 않았어요'));
    // panel: whatever needs an answer right now
    const pn = d.panel; pn.innerHTML = '';
    const disc = playing && g.turnPhase === 'discard' && g.discardingPlayers.find(x => x.playerIndex === i);
    const tr = g.tradeOffer;
    if (g.phase === 'finished') {
      const rank = g.players.slice().sort((a, b) => b.victoryPoints - a.victoryPoints);
      pn.appendChild(el('p', 'ct-win', `🏆 ${rank[0].name}님 승리!`));
      rank.forEach((p, k) => pn.appendChild(el('p', 'ct-rank', `${k + 1}등  ${p.name}  ★${p.victoryPoints}`)));
      if (isHost()) pn.appendChild(mkBtn('새 게임 준비하기', 'btn-gold', backToLobby)); else pn.appendChild(el('p', 'tg-empty', '방장이 새 게임을 준비할 수 있어요'));
    } else if (disc) {
      if (!C.panel || C.panel.t !== 'disc') C.panel = { t: 'disc', o: {} };
      const o = C.panel.o, sum = RES.reduce((s, k) => s + (o[k] || 0), 0);
      pn.appendChild(el('p', 'ct-ptitle', `버릴 카드 ${sum} / ${disc.cardsToDiscard}`));
      const row = el('div', 'ct-step');
      RES.forEach(k => { if (!meP.resources[k]) return; const c = resChip(k, `${o[k] || 0}/${meP.resources[k]}`, ' pick'); c.addEventListener('click', () => { o[k] = (o[k] || 0) + 1; if (o[k] > meP.resources[k] || sum >= disc.cardsToDiscard) o[k] = 0; cUpdate(); }); row.appendChild(c); });
      pn.append(row, el('p', 'ct-tip', '자원을 누르면 1장씩 늘어요 (다시 0으로 돌아가요)'), mkBtn('버리기', 'btn-gold', () => cAct('discard', [o]), sum !== disc.cardsToDiscard));
    } else if (C.panel && C.panel.t === 'steal') {
      pn.appendChild(el('p', 'ct-ptitle', '누구 카드를 가져올까요?'));
      const row = el('div', 'tg-row'); C.panel.cands.forEach(id => row.appendChild(mkBtn(g.players.find(p => p.id === id).name, '', () => { const h = C.panel.hex; C.panel = null; cAct('robber', [h, id]); }))); pn.appendChild(row);
    } else if (mine && playing && g.yearOfPlentyPicks > 0) {
      pn.appendChild(el('p', 'ct-ptitle', `풍년: 받을 자원 (${g.yearOfPlentyPicks}장 남음)`));
      const row = el('div', 'ct-step'); RES.forEach(k => { const c = resChip(k, '+1', ' pick'); c.addEventListener('click', () => cAct('yop', [k])); row.appendChild(c); }); pn.appendChild(row);
    } else if (C.panel && C.panel.t === 'mono') {
      pn.appendChild(el('p', 'ct-ptitle', '독점: 어떤 자원을 모두에게서 가져올까요?'));
      const row = el('div', 'ct-step'); RES.forEach(k => { const c = resChip(k, '전부', ' pick'); c.addEventListener('click', () => { C.panel = null; cAct('dev', ['monopoly', k]); }); row.appendChild(c); });
      pn.append(row, mkBtn('취소', '', () => { C.panel = null; cUpdate(); }));
    } else if (tr && i >= 0 && tr.from !== i) {
      const from = g.players[tr.from], declined = tr.responses[me()] === 'decline', can = RES.every(k => (meP.resources[k] || 0) >= (tr.request[k] || 0));
      pn.appendChild(el('p', 'ct-ptitle', `${from.name}님의 교환 제안`));
      pn.appendChild(el('p', 'ct-tip', `내가 받는 것: ${resText(tr.offer)}  /  내가 주는 것: ${resText(tr.request)}`));
      if (declined) pn.appendChild(el('p', 'tg-empty', '거절했어요'));
      else { const row = el('div', 'tg-row'); row.append(mkBtn(can ? '수락' : '자원이 모자라요', 'btn-gold', () => cAct('respond', [true]), !can), mkBtn('거절', '', () => cAct('respond', [false]))); pn.appendChild(row); }
    } else if (tr && tr.from === i) {
      pn.appendChild(el('p', 'ct-ptitle', '교환 제안을 보냈어요'));
      pn.appendChild(el('p', 'ct-tip', `주는 것: ${resText(tr.offer)}  /  받는 것: ${resText(tr.request)} · 거절 ${Object.keys(tr.responses).length}명`));
      pn.appendChild(mkBtn('제안 취소', '', () => cAct('cancel', [])));
    } else if (C.panel && C.panel.t === 'trade' && mine && g.turnPhase === 'main') {
      const p = C.panel;
      const tabs = el('div', 'tg-row'); tabs.append(mkBtn('은행·항구', p.tab === 'bank' ? 'btn-gold' : '', () => { p.tab = 'bank'; cUpdate(); }), mkBtn('친구와', p.tab === 'pl' ? 'btn-gold' : '', () => { p.tab = 'pl'; cUpdate(); }), mkBtn('닫기', '', () => { C.panel = null; cUpdate(); }));
      pn.appendChild(tabs);
      if (p.tab === 'bank') {
        pn.appendChild(el('p', 'ct-tip', '줄 자원 (필요한 장수)'));
        const r1 = el('div', 'ct-step'); RES.forEach(k => { const ratio = R.getTradeRatio(g, i, k), ok = meP.resources[k] >= ratio; const c = resChip(k, ratio + '장', ' pick' + (p.give === k ? ' sel' : '') + (ok ? '' : ' no')); if (ok) c.addEventListener('click', () => { p.give = k; cUpdate(); }); r1.appendChild(c); });
        pn.append(r1, el('p', 'ct-tip', '받을 자원 (1장)'));
        const r2 = el('div', 'ct-step'); RES.forEach(k => { if (k === p.give) return; const c = resChip(k, '+1', ' pick' + (p.get === k ? ' sel' : '')); c.addEventListener('click', () => { p.get = k; cUpdate(); }); r2.appendChild(c); });
        pn.append(r2, mkBtn('교환하기', 'btn-gold', () => { cAct('bank', [p.give, p.get]); p.give = p.get = null; }, !p.give || !p.get || p.give === p.get));
      } else {
        const stepper = (o, lim) => { const r = el('div', 'ct-step'); RES.forEach(k => { const c = resChip(k, o[k] || 0, ' pick' + (o[k] ? ' sel' : '')); c.addEventListener('click', () => { o[k] = (o[k] || 0) + 1; if (o[k] > (lim ? meP.resources[k] : 5)) o[k] = 0; cUpdate(); }); r.appendChild(c); }); return r; };
        pn.append(el('p', 'ct-tip', '내가 주는 것 (누르면 1장씩)'), stepper(p.offer, true), el('p', 'ct-tip', '내가 받고 싶은 것'), stepper(p.req, false));
        const ok = RES.some(k => p.offer[k]) && RES.some(k => p.req[k]);
        pn.appendChild(mkBtn('모두에게 제안하기', 'btn-gold', () => { cAct('offer', [p.offer, p.req]); C.panel = null; }, !ok));
      }
    }
    pn.hidden = !pn.firstChild;
    // my hand: one big card per resource, plus the development cards
    d.hand.innerHTML = '';
    if (meP) {
      const row = el('div', 'ct-cards');
      for (const k of ['lumber', 'brick', 'wool', 'grain', 'ore']) {
        const c = el('div', 'ct-card' + (meP.resources[k] ? '' : ' zero'));
        c.append(pixEl(iconCanvas(k), 'ct-cardic', ICON_KO[k]), el('b', '', String(meP.resources[k])), el('span', '', RES_KO[k]));
        row.appendChild(c);
      }
      d.hand.appendChild(row);
      const devs = meP.developmentCards.concat(meP.newDevCards);
      if (devs.length) {
        const dr = el('div', 'ct-devs'), canPlay = mine && playing && !g.devCardPlayedThisTurn && (g.turnPhase === 'main' || g.turnPhase === 'roll');
        meP.developmentCards.forEach(cd => {
          const b2 = mkBtn('', 'ct-dev', () => { if (cd === 'monopoly') { C.panel = { t: 'mono' }; cUpdate(); } else cAct('dev', [cd]); }, cd === 'victoryPoint' || !canPlay);
          b2.append(pixEl(iconCanvas('dev'), 'ct-devic', '발전 카드'), el('b', '', DEV_KO[cd]), el('i', '', DEV_TIP[cd]),
            el('u', '', cd === 'victoryPoint' ? '쓰는 카드가 아니에요' : !canPlay ? (g.devCardPlayedThisTurn ? '이번 차례엔 이미 썼어요' : '내 차례에 쓸 수 있어요') : '눌러서 쓰기'));
          dr.appendChild(b2);
        });
        meP.newDevCards.forEach(cd => {
          const b2 = mkBtn('', 'ct-dev new', () => {}, true);
          b2.append(pixEl(iconCanvas('dev'), 'ct-devic', '발전 카드'), el('b', '', DEV_KO[cd]), el('i', '', DEV_TIP[cd]), el('u', '', cd === 'victoryPoint' ? '이미 점수에 들어가 있어요' : '다음 차례부터 쓸 수 있어요'));
          dr.appendChild(b2);
        });
        d.hand.appendChild(dr);
      }
    } else d.hand.appendChild(el('p', 'tg-empty', '구경하고 있어요'));
    // build: each thing with what it costs, greyed out when I cannot afford it
    const a = d.acts; a.innerHTML = '';
    if (meP && playing) {
      const has = c => RES.every(k => meP.resources[k] >= (c[k] || 0)), main = mine && g.turnPhase === 'main', BC = R.BUILDING_COSTS;
      const tog = m => () => { C.mode = C.mode === m ? null : m; C.pend = null; C.panel = null; cUpdate(); };
      if (mine && g.turnPhase === 'roll') {
        const rb = mkBtn('🎲 주사위 굴리기', 'btn-gold ct-roll', () => cAct('roll', []));
        a.appendChild(rb);
      }
      const grid = el('div', 'ct-build');
      const item = (key, ko, cost, left, onClick, active) => {
        const can = has(cost) && left > 0 && main;
        const bx = mkBtn('', 'ct-bi' + (active ? ' on' : '') + (can ? '' : ' no'), onClick, !can);
        const cs = el('div', 'ct-cost');
        for (const k of RES) for (let i = 0; i < (cost[k] || 0); i++) cs.appendChild(pixEl(iconCanvas(k === 'brick' ? 'brick' : k), 'ct-costic', RES_KO[k]));
        bx.append(el('b', '', ko), cs, el('u', '', left > 0 ? `남은 말 ${left}` : '다 썼어요'));
        grid.appendChild(bx);
      };
      item('road', '길', BC.road, meP.roads, tog('road'), C.mode === 'road');
      item('settle', '마을', BC.settlement, meP.settlements, tog('settle'), C.mode === 'settle');
      item('city', '도시', BC.city, meP.cities, tog('city'), C.mode === 'city');
      {
        const can = has(BC.developmentCard) && g.devCardDeck.length > 0 && main;
        const bx = mkBtn('', 'ct-bi' + (can ? '' : ' no'), () => cAct('buyDev', []), !can);
        const cs = el('div', 'ct-cost');
        for (const k of RES) for (let i = 0; i < (BC.developmentCard[k] || 0); i++) cs.appendChild(pixEl(iconCanvas(k), 'ct-costic', RES_KO[k]));
        bx.append(el('b', '', '발전 카드'), cs, el('u', '', `남은 카드 ${g.devCardDeck.length}`));
        grid.appendChild(bx);
      }
      a.appendChild(grid);
      if (main) {
        const row2 = el('div', 'tg-row');
        row2.append(mkBtn('🔄 교환', C.panel && C.panel.t === 'trade' ? 'btn-gold ct-wide' : 'ct-wide', () => { C.panel = C.panel && C.panel.t === 'trade' ? null : { t: 'trade', tab: 'bank', offer: {}, req: {} }; C.mode = null; cUpdate(); }, !!tr),
          mkBtn('턴 종료 ▶', 'btn-gold ct-wide', () => { C.mode = null; C.panel = null; cAct('end', []); }));
        a.appendChild(row2);
      }
    }
    if (isHost() && g.phase !== 'finished') {
      const w = cWaiting().filter(id => id !== me());
      if (w.length && Date.now() - (g.x.actAt || 0) > 40000) a.appendChild(mkBtn(`${g.players.find(p => p.id === w[0]).name}님 대신 진행 (방장)`, '', () => cAuto(w[0])));
    }
    // log
    d.log.innerHTML = ''; g.x.log.slice(-14).forEach(t => d.log.appendChild(el('p', '', t))); d.log.scrollTop = d.log.scrollHeight;
    cDraw();
  }
  GAMES.catan = {
    start: cStart, push: cPush, tick: cTick, fastTick: botStep, mount: cMount, update: cUpdate, unmount: cUnmount, keepLeavers: true,
    handover() { C.absent = {}; },
    memberLeft(id) { const p = G && G.players.find(x => x.id === id); if (p) cLog(`${p.name}님이 나갔어요. 그 차례는 자동으로 넘어가요.`); },
    memberGone() {},   // stays in the game; cTick plays for them until they come back
    clientTick() { if (C.dom && G && isFinite(G.x.actAt)) { /* keep "away" marks fresh */ if (now() - (C.lastUi || 0) > 5000) { C.lastUi = now(); cUpdate(); } } },
    myTurn() { return !!G && G.phase !== 'finished' && cWaiting().includes(me()); },
    onErr() { C.busy = 0; },
    onMsg(p) {
      if (p.t === 'gs') { if (p.from !== T.host || !p.g || !p.g.x) return; if (G && p.g.id === G.id && p.g.x.seq < G.x.seq) return; cApply(p.g); return; }
      if (p.t === 'act' && isHost() && G) { const r = cDo(p.from, p.a, Array.isArray(p.args) ? p.args : []); if (r && r.error) send({ t: 'err', to: p.from, msg: r.error }); else cPush(); }
    },
    lobbyExtra(body) {
      const d = el('details', 'tg-help'); d.appendChild(el('summary', '', '카탄이 처음이라면? (30초 규칙)'));
      ['주사위 숫자와 같은 땅 옆에 내 마을·도시가 있으면 그 자원을 받아요 (도시는 2장).', '자원으로 길 → 마을 → 도시를 짓고, 발전 카드를 사요.', '마을 1점, 도시 2점, 최장 도로(5칸 이상) 2점, 최대 기사단(기사 3장 이상) 2점.', '7이 나오면 카드 8장 이상은 절반을 버리고, 도둑을 옮겨 카드 1장을 뺏어요.', '자원은 은행(4:1), 항구(3:1·2:1), 친구와 자유롭게 바꿀 수 있어요.', '먼저 10점을 만들면 승리!'].forEach(t => d.appendChild(el('p', '', '· ' + t)));
      body.appendChild(d);
    }
  };

  // ================================================================================================
  //  그림 퀴즈
  // ================================================================================================
  // three baskets. Every turn offers one word from each, so there is always an easy way out and
  // something worth showing off with.
  const uniq = s => s.split(' ').filter((w, i, a) => w && a.indexOf(w) === i);
  const WORD_SETS = [
    // 쉬움
    uniq('사과 바나나 수박 포도 딸기 당근 옥수수 감자 고구마 양파 버섯 호박 토마토 오이 가지 배추 무 파 마늘 레몬 오렌지 키위 체리 멜론 참외 밤 땅콩 ' +
      '라면 피자 햄버거 치킨 만두 케이크 도넛 커피 우유 밥 국 빵 계란 치즈 김 두부 소시지 핫도그 아이스크림 사탕 초콜릿 젤리 과자 떡 꿀 ' +
      '강아지 고양이 토끼 코끼리 기린 사자 호랑이 곰 판다 원숭이 돼지 소 말 양 닭 오리 펭귄 상어 고래 문어 거북이 뱀 개구리 나비 벌 개미 거미 공룡 쥐 다람쥐 사슴 여우 늑대 올빼미 병아리 금붕어 ' +
      '자동차 버스 기차 비행기 배 자전거 택시 트럭 로켓 풍선 연 썰매 ' +
      '집 학교 교회 병원 아파트 다리 성 텐트 문 창문 계단 지붕 굴뚝 울타리 ' +
      '의자 책상 침대 소파 냉장고 텔레비전 컴퓨터 휴대폰 시계 안경 우산 가방 모자 신발 양말 장갑 열쇠 가위 연필 책 거울 칫솔 비누 수건 촛불 전구 카메라 빗자루 베개 이불 컵 접시 숟가락 젓가락 포크 칼 냄비 ' +
      '기타 피아노 드럼 축구공 농구공 그네 미끄럼틀 시소 주사위 로봇 인형 공 ' +
      '해 달 별 구름 비 눈 무지개 번개 산 바다 강 섬 나무 꽃 장미 해바라기 선인장 잎 숲 눈사람 모닥불 돌 모래 ' +
      '의사 경찰 소방관 요리사 선생님 가수 왕 공주 유령 아기 할머니 할아버지 ' +
      '눈물 웃음 악수 박수 기도 십자가 성경 선물 생일 하트 ' +
      '코 입 귀 손 발 눈 머리 이빨 혀 수염 ' +
      '지구 태양 왕관 반지 목걸이 돈 지갑 편지 신호등 사다리 사탕수수 깃발 지도 열쇠고리'),
    // 보통
    uniq('복숭아 파인애플 아보카도 블루베리 석류 자몽 망고 두리안 브로콜리 시금치 양배추 고추 깻잎 미역 ' +
      '김밥 떡볶이 짜장면 비빔밥 삼겹살 붕어빵 솜사탕 팝콘 탕후루 마라탕 훠궈 초밥 라자냐 파스타 샐러드 토스트 와플 크로플 마카롱 티라미수 푸딩 식혜 수정과 버블티 아메리카노 라떼 ' +
      '돌고래 오징어 악어 달팽이 낙타 캥거루 코알라 고슴도치 부엉이 독수리 앵무새 공작 플라밍고 해파리 불가사리 소라게 메뚜기 잠자리 무당벌레 두더지 하마 코뿔소 얼룩말 치타 수달 너구리 ' +
      '지하철 헬리콥터 오토바이 소방차 구급차 잠수함 킥보드 열기구 요트 경운기 지게차 유모차 롤러코스터 관람차 회전목마 ' +
      '놀이터 도서관 편의점 공항 등대 풍차 피라미드 분수대 터널 고속도로 주차장 백화점 미용실 목욕탕 노래방 ' +
      '세탁기 노트북 목도리 지우개 달력 선풍기 에어컨 청소기 마이크 이어폰 리모컨 프라이팬 주전자 도마 다리미 믹서기 전자레인지 가습기 드라이기 계산기 저울 망치 못 드라이버 줄자 ' +
      '바이올린 트럼펫 하모니카 탬버린 야구 배드민턴 탁구 볼링 스케이트 스키 수영 낚시 줄넘기 퍼즐 윷놀이 제기차기 딱지 팽이 보드게임 카드 ' +
      '바람 폭포 사막 화산 빙산 오로라 단풍 낙엽 새싹 뿌리 씨앗 벌집 거미줄 둥지 이슬 안개 서리 고드름 ' +
      '화가 농부 우주인 해적 마법사 천사 목사님 간호사 기자 판사 배우 개그맨 바리스타 미용사 사육사 ' +
      '하품 재채기 딸꾹질 코골이 찬양 방주 크리스마스 결혼식 졸업 소풍 캠핑 불꽃놀이 눈싸움 생일파티 운동회 ' +
      '머리카락 심장 뼈 근육 지문 ' +
      '나침반 망원경 현미경 우주선 외계인 보물상자 다이아몬드 저금통 우체통 횡단보도 엘리베이터 낙하산 만리장성 에펠탑 자유의여신상 피사의사탑 ' +
      '마스크 미세먼지 백신 체온계 반창고 깁스 목발 돋보기 자물쇠'),
    // 어려움
    uniq('회전초밥 에그타르트 슈크림 양갱 약과 인절미 호떡 군고구마 곱창 막창 닭발 순대 어묵 번데기 ' +
      '두바이초콜릿 쫀득쿠키 요거트아이스크림 흑당 민트초코 깐풍기 마라샹궈 꿔바로우 월병 ' +
      '치이카와 우사기 하치와레 산리오 쿠로미 마이멜로디 시나모롤 폼폼푸린 케로피 짱구 도라에몽 피카츄 포켓몬 디지몬 스누피 무민 리락쿠마 ' +
      '카카오프렌즈 라이언 어피치 춘식이 펭수 뽀로로 타요 핑크퐁 아기상어 ' +
      '레고 닌텐도 플레이스테이션 메이플스토리 마인크래프트 로블록스 테트리스 ' +
      '스타벅스 맥도날드 코카콜라 애플 삼성 나이키 아디다스 샤오미 알리페이 위챗 ' +
      '하프 아코디언 색소폰 트라이앵글 캐스터네츠 지휘자 발레 태권도 씨름 양궁 역도 마라톤 펜싱 승마 컬링 봅슬레이 ' +
      '종유석 간헐천 산호초 맹그로브 툰드라 사바나 협곡 삼각주 운석 블랙홀 은하수 일식 월식 ' +
      '예배 성찬 세례 부활절 추수감사절 성탄절 십일조 전도 선교 주일학교 수련회 성가대 헌금 축도 ' +
      '시험 발표 면접 운전면허 여권 비자 환승 시차 유학 기숙사 월세 이사 택배 환불 적금 ' +
      '한복 갓 부채 연날리기 투호 가야금 장구 탈춤 사물놀이 상모돌리기 ' +
      '자금성 천단 이화원 용 봉황 춘절 홍등 경극 태극권 서예 ' +
      '모래시계 타임캡슐 미로 신기루 도미노 매듭 풍선아트 마술 복화술 그림자놀이 ' +
      '인공지능 드론 전기차 태양광 재활용 분리수거 텀블러 에코백 기후변화 지진 태풍 홍수 가뭄')
  ];
  const WORDS = WORD_SETS[0].concat(WORD_SETS[1], WORD_SETS[2]);
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const cho = ch => { const c = ch.charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch; };
  const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const editDist = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const COLORS = ['#251c2c', '#ffffff', '#8d8f99', '#e63946', '#ff8a3a', '#ffcc4d', '#7ddc5a', '#2f8a55', '#4fa6dc', '#3f51b5', '#b06cff', '#ff8fb3', '#8a5a3b', '#f5cda6'];
  const SIZES = [5, 12, 26];
  const PICK_MS = 15000, DRAW_MS = 80000, REVEAL_MS = 5000, END_MS = 60000, ROUNDS = 3;

  const GUESS_COOL = 2500;   // one answer every 2.5 s per person
  const D = { coolUntil: 0, dom: null, strokes: [], cur: null, color: COLORS[0], size: 1, endAt: 0, total: 1, myWord: null, choices: null, chat: [], out: [], flushT: 0, need: false, needAt: 0, used: [] };
  const H = { word: null, choices: null, hint1: false, hint2: false, phaseEnd: 0, lastGuess: {} };   // host-only secrets
  const dDrawer = () => G && G.drawer;
  const dAmDrawer = () => !!G && G.drawer === me() && inTable();
  const dName = id => (G && G.names && G.names[id]) || memberName(id);
  function dSay(text, cls) { D.chat.push({ text, cls: cls || 'sys' }); if (D.chat.length > 60) D.chat.shift(); dChat(); }

  // ---- host ----
  function dStart() {
    G = { kind: 'draw', seq: 1, round: 1, rounds: ROUNDS, order: shuffle(T.members.map(m => m.id)), turn: 0, drawer: null, phase: 'pick', rem: 0, total: 1, mask: [], scores: {}, got: {}, names: {}, word: null, over: false };
    T.members.forEach(m => { G.scores[m.id] = 0; G.names[m.id] = m.name; });
    if (D.used.length > 220) D.used = D.used.slice(-120);   // keep avoiding recent words across games
    dBeginPick();
  }
  function dSetPhase(phase, ms) { G.phase = phase; G.total = ms; H.phaseEnd = now() + ms; G.seq++; }
  function dBeginPick() {
    G.order = G.order.filter(id => O.here(id));
    if (G.order.length < 2) { dFinish(); return; }
    if (G.turn >= G.order.length) { G.turn = 0; G.round++; }
    if (G.round > G.rounds) { dFinish(); return; }
    G.drawer = G.order[G.turn]; G.got = {}; G.word = null; G.mask = []; H.word = null; H.hint1 = H.hint2 = false; H.lastGuess = {};
    // one easy, one middling, one hard — in a random order so the drawer cannot tell which is which
    H.choices = shuffle(WORD_SETS.map(set => { const left = set.filter(w => !D.used.includes(w)); return (left.length ? left : set)[Math.random() * (left.length || set.length) | 0]; }));
    dSetPhase('pick', PICK_MS);
    D.strokes = []; send({ t: 'clr' });
    if (G.drawer === me()) { D.choices = H.choices; D.myWord = null; } else send({ t: 'pick', to: G.drawer, words: H.choices });
    dPush();
  }
  function dChoose(i) {
    if (!G || G.phase !== 'pick') return;
    H.word = H.choices[clampN(i | 0, 0, 2)]; D.used.push(H.word);
    G.mask = [...H.word].map(c => c === ' ' ? ' ' : '');
    dSetPhase('draw', DRAW_MS);
    if (G.drawer === me()) { D.myWord = H.word; D.choices = null; } else send({ t: 'w', to: G.drawer, word: H.word });
    dPush();
  }
  function dEndTurn(why) {
    if (!G || G.phase === 'reveal' || G.phase === 'end') return;
    G.word = H.word; G.why = why || ''; dSetPhase('reveal', REVEAL_MS); dPush();
  }
  function dFinish() { G.over = true; G.word = H.word; dSetPhase('end', END_MS); dPush(); }
  function dGuess(id, text) {
    if (!G || G.phase !== 'draw' || id === G.drawer || G.got[id] != null || !G.order.includes(id)) return;
    const t = now(); if (t - (H.lastGuess[id] || 0) < GUESS_COOL - 250) return;
    H.lastGuess[id] = t;
    text = String(text || '').slice(0, 30); const a = norm(text), w = norm(H.word); if (!a) return;
    if (a === w) {
      const rem = Math.max(0, H.phaseEnd - now()), pts = Math.round(60 + 240 * rem / DRAW_MS);
      G.got[id] = pts; G.scores[id] = (G.scores[id] || 0) + pts;
      G.got[G.drawer] = (G.got[G.drawer] || 0) + 40; G.scores[G.drawer] = (G.scores[G.drawer] || 0) + 40;
      G.seq++; send({ t: 'ok', id, pts }); dOnOk(id, pts);
      if (G.order.every(x => x === G.drawer || G.got[x] != null || !O.here(x))) dEndTurn('all'); else dPush();
      return;
    }
    const near = w.length >= 2 && (editDist(a, w) === 1 || (a.length === w.length && [...a].map(cho).join('') === [...w].map(cho).join('')));
    send({ t: 'chat', id, name: dName(id), text }); dOnChat(id, dName(id), text);
    if (near) { if (id === me()) dSay('거의 맞았어요! 조금만 더…', 'near'); else send({ t: 'near', to: id }); }
  }
  function dTick() {
    if (!G) return;
    const t = now(), rem = H.phaseEnd - t;
    if (G.phase === 'pick') { if (!O.here(G.drawer)) { G.turn++; dBeginPick(); return; } if (rem <= 0) dChoose(Math.random() * 3 | 0); }
    else if (G.phase === 'draw') {
      if (!O.here(G.drawer) && G.drawer !== me()) { dEndTurn('left'); return; }
      const k = 1 - rem / DRAW_MS, n = [...H.word].length;
      if (!H.hint1 && k > 0.45) { H.hint1 = true; G.mask = [...H.word].map(c => c === ' ' ? ' ' : cho(c)); G.seq++; dPush(); }
      else if (!H.hint2 && k > 0.72 && n >= 3) { H.hint2 = true; const i = Math.random() * n | 0; G.mask[i] = [...H.word][i]; G.seq++; dPush(); }
      if (rem <= 0) dEndTurn('time');
    } else if (G.phase === 'reveal') { if (rem <= 0) { G.turn++; dBeginPick(); } }
    else if (G.phase === 'end') { if (rem <= 0) backToLobby(); }
    if (G && t - (D.lastPush || 0) > 4000) dPush();
  }
  function dPush(to) { if (!G) return; D.lastPush = now(); G.rem = Math.max(0, H.phaseEnd - now()); const p = { t: 'ds', g: G }; if (to) p.to = to; send(p); dApply(G, true); }

  // ---- everyone ----
  function dApply(g, own) {
    const prev = G && !own ? { phase: G.phase, drawer: G.drawer, seq: G.seq } : D.prev || {};
    G = g; D.endAt = now() + (g.rem || 0); D.total = g.total || 1;
    if (!own && T && T.host !== me()) { /* keep a copy so a new host can carry on */ }
    const changed = D.prev ? (D.prev.phase !== g.phase || D.prev.drawer !== g.drawer || D.prev.round !== g.round) : true;
    if (changed) {
      // a new turn always starts on a blank board, so nobody has to press 모두 지우기
      if (g.phase === 'pick') { D.strokes = []; D.cur = null; D.need = false; dRedraw(); if (g.drawer !== me()) { D.choices = null; D.myWord = null; } dSay(`${g.round}/${g.rounds} 라운드 · ${dName(g.drawer)}님이 그릴 차례예요`); }
      if (g.phase === 'draw') { dRedraw(); if (g.drawer === me()) dSay('그리기 시작! 글자나 숫자는 쓰지 않기로 해요 🙂'); sfx('pop', 0.35); }
      if (g.phase === 'reveal') { dSay(`정답은 「${g.word || '?'}」${g.why === 'left' ? ' (그리던 친구가 나갔어요)' : g.why === 'all' ? ' · 모두 맞혔어요!' : ''}`, 'ans'); D.choices = null; }
      if (g.phase === 'end') { dSay('게임 끝! 수고했어요 👏', 'ans'); sfx('goal', 0.45); }
    }
    D.prev = { phase: g.phase, drawer: g.drawer, round: g.round };
    if (g.phase === 'draw' && D.need && g.drawer !== me() && now() - D.needAt > 2500) { D.needAt = now(); send({ t: 'need' }); }
    render();
  }
  function dOnOk(id, pts) { dSay(`${dName(id)}님 정답! +${pts}`, 'ok'); sfx('ding', 0.45); }
  function dOnChat(id, name, text) { dSay(`${name}: ${text}`, id === me() ? 'me' : 'msg'); }

  // ---- canvas ----
  const CW = 800, CH = 600;
  function dCtx() { return D.dom && D.dom.cv.getContext('2d'); }
  function dSeg(g, s, from) {
    const p = s.p; if (p.length < 2) return;
    g.strokeStyle = s.c; g.fillStyle = s.c; g.lineWidth = s.w * 0.8; g.lineCap = 'round'; g.lineJoin = 'round';
    if (p.length === 2) { g.beginPath(); g.arc(p[0] * 0.8, p[1] * 0.6, s.w * 0.4, 0, 6.3); g.fill(); return; }
    const i0 = Math.max(0, (from || 0) - 2);
    g.beginPath(); g.moveTo(p[i0] * 0.8, p[i0 + 1] * 0.6); for (let i = i0 + 2; i < p.length; i += 2) g.lineTo(p[i] * 0.8, p[i + 1] * 0.6); g.stroke();
  }
  function dRedraw() { const g = dCtx(); if (!g) return; g.fillStyle = '#fff'; g.fillRect(0, 0, CW, CH); for (const s of D.strokes) if (s) dSeg(g, s, 0); }
  function dPt(ev) { const rc = D.dom.cv.getBoundingClientRect(); return [clampN(Math.round((ev.clientX - rc.left) / rc.width * 1000), 0, 1000), clampN(Math.round((ev.clientY - rc.top) / rc.height * 1000), 0, 1000)]; }
  function dFlush(end) {
    const s = D.cur; if (!s) return;
    if (s.sent < s.p.length || end) { send({ t: 's', i: s.i, c: s.c, w: s.w, o: s.sent, p: s.p.slice(s.sent), e: end ? 1 : 0 }); s.sent = s.p.length; }
  }
  function dDown(ev) {
    if (!dAmDrawer() || G.phase !== 'draw') return;
    ev.preventDefault(); try { D.dom.cv.setPointerCapture(ev.pointerId); } catch (e) {}
    const [x, y] = dPt(ev), eraser = D.color === 'eraser';
    D.cur = { i: D.strokes.length, c: eraser ? '#ffffff' : D.color, w: eraser ? 40 : SIZES[D.size], p: [x, y], sent: 0 };
    D.strokes.push(D.cur); dSeg(dCtx(), D.cur, 0);
    clearInterval(D.flushT); D.flushT = setInterval(() => dFlush(false), 110);
  }
  function dMove(ev) {
    const s = D.cur; if (!s) return; ev.preventDefault();
    const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
    for (const e2 of (evs.length ? evs : [ev])) {
      const [x, y] = dPt(e2), n = s.p.length; if (Math.abs(x - s.p[n - 2]) + Math.abs(y - s.p[n - 1]) < 4) continue;
      if (s.p.length > 3000) break;
      s.p.push(x, y); dSeg(dCtx(), s, n);
    }
  }
  function dUp() { if (!D.cur) return; clearInterval(D.flushT); dFlush(true); D.cur = null; }
  function dUndo() { if (!dAmDrawer() || G.phase !== 'draw' || !D.strokes.length) return; D.strokes.pop(); D.cur = null; send({ t: 'u', n: D.strokes.length }); dRedraw(); }
  function dClear() { if (!dAmDrawer() || G.phase !== 'draw') return; D.strokes = []; D.cur = null; send({ t: 'clr' }); dRedraw(); }
  function dSendAll(to) {
    let part = [], size = 0; const out = [];
    D.strokes.forEach((s, i) => { if (!s) return; part.push({ i, c: s.c, w: s.w, p: s.p }); size += s.p.length; if (size > 3500) { out.push(part); part = []; size = 0; } });
    out.push(part);
    out.forEach((ss, k) => setTimeout(() => send({ t: 'all', to, first: k === 0 ? 1 : 0, n: D.strokes.length, ss }), k * 150));
  }

  // ---- UI ----
  function dMount(body) {
    const d = D.dom = {};
    d.info = el('div', 'dw-info'); d.round = el('span', 'dw-round'); d.word = el('div', 'dw-word'); d.time = el('div', 'dw-time'); d.bar = el('i'); d.time.appendChild(d.bar);
    d.info.append(d.round, d.word);
    d.wrap = el('div', 'dw-wrap'); d.cv = el('canvas', 'dw-cv'); d.cv.width = CW; d.cv.height = CH; d.over = el('div', 'dw-over'); d.wrap.append(d.cv, d.over);
    d.cv.addEventListener('pointerdown', dDown); d.cv.addEventListener('pointermove', dMove); d.cv.addEventListener('pointerup', dUp); d.cv.addEventListener('pointercancel', dUp); d.cv.addEventListener('lostpointercapture', dUp);
    d.tools = el('div', 'dw-tools');
    COLORS.forEach(c => { const b = el('button', 'dw-col'); b.type = 'button'; b.style.background = c; b.dataset.c = c; b.setAttribute('aria-label', '색 ' + c); b.addEventListener('click', () => { D.color = c; dTools(); }); d.tools.appendChild(b); });
    const er = el('button', 'btn dw-tb', '지우개'); er.type = 'button'; er.dataset.c = 'eraser'; er.addEventListener('click', () => { D.color = 'eraser'; dTools(); });
    d.tools.appendChild(er);
    SIZES.forEach((s, i) => { const b = el('button', 'btn dw-tb dw-size'); b.type = 'button'; b.dataset.s = i; const dot = el('i'); dot.style.width = dot.style.height = (4 + i * 5) + 'px'; b.appendChild(dot); b.setAttribute('aria-label', ['가는 붓', '중간 붓', '굵은 붓'][i]); b.addEventListener('click', () => { D.size = i; if (D.color === 'eraser') D.color = COLORS[0]; dTools(); }); d.tools.appendChild(b); });
    const un = el('button', 'btn dw-tb', '되돌리기'); un.type = 'button'; un.addEventListener('click', dUndo);
    const cl = el('button', 'btn dw-tb', '모두 지우기'); cl.type = 'button'; cl.addEventListener('click', dClear);
    d.tools.append(un, cl);
    d.scores = el('div', 'dw-scores');
    d.chat = el('div', 'dw-chat');
    d.form = el('form', 'dw-form'); d.input = el('input'); d.input.type = 'text'; d.input.maxLength = 30; d.input.autocomplete = 'off'; d.input.setAttribute('aria-label', '정답 입력');
    d.sendBtn = el('button', 'btn btn-gold', '정답!'); d.sendBtn.type = 'submit'; d.form.append(d.input, d.sendBtn);
    d.form.addEventListener('submit', ev => {
      ev.preventDefault(); const text = d.input.value.trim(); if (!text || !G || G.phase !== 'draw' || !inTable() || dAmDrawer() || G.got[me()] != null) return;
      if (now() < D.coolUntil) return;                 // no spamming the answer box
      D.coolUntil = now() + GUESS_COOL;
      d.input.value = '';
      if (isHost()) dGuess(me(), text); else send({ t: 'g', text });
      dUpdate();
    });
    const side = el('div', 'dw-side'); side.append(d.scores, d.chat, d.form);
    const main = el('div', 'dw-main'); main.append(d.wrap, d.tools);
    const cols = el('div', 'dw-cols'); cols.append(main, side);
    body.append(d.info, d.time, cols);
    dRedraw(); dTools(); dChat(); dUpdate();
    clearInterval(D.clock); D.clock = setInterval(dClock, 250);
    if (G && G.phase === 'draw' && !dAmDrawer()) { D.need = true; D.needAt = now(); send({ t: 'need' }); }
  }
  function dUnmount() { clearInterval(D.clock); clearTimeout(D.coolT); D.coolUntil = 0; clearInterval(D.flushT); D.dom = null; D.cur = null; D.strokes = []; D.chat = []; D.prev = null; D.choices = null; D.myWord = null; }
  function dTools() { const d = D.dom; if (!d) return; d.tools.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('sel', b.dataset.c === D.color)); d.tools.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('sel', D.color !== 'eraser' && +b.dataset.s === D.size)); }
  function dChat() { const d = D.dom; if (!d) return; d.chat.innerHTML = ''; D.chat.slice(-40).forEach(m => d.chat.appendChild(el('p', m.cls, m.text))); d.chat.scrollTop = d.chat.scrollHeight; }
  function dClock() {
    const d = D.dom; if (!d || !G) return;
    const rem = Math.max(0, D.endAt - now()); d.bar.style.width = (G.phase === 'end' ? 0 : clampN(rem / D.total * 100, 0, 100)) + '%';
    d.bar.className = G.phase === 'draw' && rem < 10000 ? 'hurry' : '';
    const sec = d.over.querySelector('.dw-sec'); if (sec) sec.textContent = Math.ceil(rem / 1000);
  }
  function dUpdate() {
    const d = D.dom; if (!d || !G) return;
    const g = G, drawer = dAmDrawer(), member = inTable();
    d.round.textContent = g.phase === 'end' ? '끝' : `${Math.min(g.round, g.rounds)} / ${g.rounds} 라운드`;
    // word line
    d.word.innerHTML = '';
    if (g.phase === 'draw') {
      if (drawer && D.myWord) { d.word.append(el('span', 'dw-lab', '제시어'), el('b', 'dw-my', D.myWord)); }
      else { d.word.appendChild(el('span', 'dw-lab', `${dName(g.drawer)}님이 그리는 중 · ${g.mask.filter(c => c !== ' ').length}글자`)); const m = el('span', 'dw-mask'); g.mask.forEach(c => m.appendChild(el('i', c === ' ' ? 'sp' : c ? 'on' : '', c && c !== ' ' ? c : ''))); d.word.appendChild(m); }
    } else if (g.phase === 'pick') d.word.appendChild(el('span', 'dw-lab', drawer ? '그릴 낱말을 골라요' : `${dName(g.drawer)}님이 낱말을 고르는 중…`));
    else if (g.phase === 'reveal') d.word.append(el('span', 'dw-lab', '정답'), el('b', 'dw-my', g.word || '?'));
    else d.word.appendChild(el('span', 'dw-lab', '최종 순위'));
    // overlay on the canvas
    const ov = d.over; ov.innerHTML = ''; ov.hidden = true;
    if (g.phase === 'pick') {
      ov.hidden = false;
      if (drawer && D.choices) { ov.appendChild(el('p', 'dw-big', '무엇을 그릴까요?')); const row = el('div', 'dw-pick'); D.choices.forEach((w, i) => { const b = el('button', 'btn btn-gold', w); b.type = 'button'; b.addEventListener('click', () => { if (isHost()) dChoose(i); else { D.myWord = D.choices[i]; D.choices = null; send({ t: 'word', i }); dUpdate(); } }); row.appendChild(b); }); ov.appendChild(row); const s = el('p', 'dw-small'); s.append(el('span', 'dw-sec', ''), '초 안에 고르지 않으면 아무거나 골라져요'); ov.appendChild(s); }
      else ov.appendChild(el('p', 'dw-big', drawer ? '낱말을 받는 중…' : `${dName(g.drawer)}님이 낱말을 고르고 있어요`));
    } else if (g.phase === 'reveal' || g.phase === 'end') {
      ov.hidden = false;
      if (g.phase === 'reveal') { ov.appendChild(el('p', 'dw-big', `정답: ${g.word || '?'}`)); const list = el('div', 'dw-gain'); g.order.forEach(id => list.appendChild(el('p', g.got[id] ? 'up' : '', `${dName(id)}  ${g.got[id] ? '+' + g.got[id] : '+0'}`))); ov.appendChild(list); }
      else {
        const rank = Object.keys(g.scores).sort((a, b) => g.scores[b] - g.scores[a]);
        ov.appendChild(el('p', 'dw-big', '🏆 최종 순위')); const list = el('div', 'dw-gain');
        rank.forEach((id, k) => list.appendChild(el('p', k === 0 ? 'up' : '', `${['🥇', '🥈', '🥉'][k] || (k + 1) + '등'}  ${dName(id)}  ${g.scores[id]}점`))); ov.appendChild(list);
        if (isHost()) { const b = el('button', 'btn btn-gold', '한 판 더 준비하기'); b.type = 'button'; b.addEventListener('click', backToLobby); ov.appendChild(b); } else ov.appendChild(el('p', 'dw-small', '방장이 한 판 더 준비할 수 있어요'));
      }
    }
    d.tools.hidden = !(drawer && g.phase === 'draw');
    d.cv.classList.toggle('mine', drawer && g.phase === 'draw');
    // scores
    d.scores.innerHTML = '';
    Object.keys(g.scores).sort((a, b) => g.scores[b] - g.scores[a]).forEach(id => {
      const c = el('div', 'dw-p' + (id === g.drawer && g.phase !== 'end' ? ' drawer' : '') + (g.got[id] != null && id !== g.drawer ? ' got' : '') + (O.here(id) ? '' : ' away'));
      c.append(el('b', '', dName(id) + (id === me() ? ' (나)' : '')), el('span', '', g.scores[id] + '점')); if (id === g.drawer && g.phase !== 'end') c.appendChild(el('i', '', '✏️')); else if (g.got[id] != null) c.appendChild(el('i', '', '✔'));
      d.scores.appendChild(c);
    });
    // guess box
    const can = member && g.phase === 'draw' && !drawer && g.got[me()] == null;
    const wait = Math.max(0, D.coolUntil - now());
    d.input.disabled = !can || wait > 0; d.sendBtn.disabled = !can || wait > 0;
    d.input.placeholder = !member ? '구경하고 있어요' : drawer ? '내가 그리는 차례예요' : g.got[me()] != null ? '정답을 맞혔어요! 🎉'
      : wait > 0 ? `${Math.ceil(wait / 1000)}초 뒤에 다시 쓸 수 있어요` : g.phase === 'draw' ? '정답을 입력하세요' : '잠깐 기다려요…';
    if (wait > 0) { clearTimeout(D.coolT); D.coolT = setTimeout(() => { if (D.dom) dUpdate(); }, Math.min(wait, 400)); }
    dClock();
  }
  GAMES.draw = {
    start: dStart, push: dPush, tick: dTick, mount: dMount, update: dUpdate, unmount: dUnmount,
    lateJoin(id, name) { if (!G || G.over) return false; G.scores[id] = G.scores[id] || 0; G.names[id] = String(name || '친구').slice(0, 12); if (!G.order.includes(id)) G.order.push(id); G.seq++; return true; },
    memberLeft(id, self) {
      if (!G) return; const wasDrawer = G.drawer === id, idx = G.order.indexOf(id);
      if (idx >= 0) { G.order.splice(idx, 1); if (idx < G.turn) G.turn--; }
      if (self) return;
      if (G.order.length < 2 && !G.over) { dFinish(); return; }
      if (wasDrawer && (G.phase === 'pick' || G.phase === 'draw')) { if (G.phase === 'pick') dBeginPick(); else { G.turn--; dEndTurn('left'); } }
    },
    memberGone(id) { hostLeave(id); },
    // a new host does not know the secret word: close this turn and move on
    handover() {
      H.phaseEnd = now() + Math.max(0, D.endAt - now()); H.hint1 = H.hint2 = true;
      if (G.phase === 'draw' || G.phase === 'pick') {
        if (G.drawer === me() && D.myWord) { H.word = D.myWord; H.hint1 = G.mask.some(c => c && c !== ' '); H.hint2 = true; }
        else if (G.phase === 'pick') dBeginPick();
        else { H.word = null; G.word = null; G.why = 'left'; dSetPhase('reveal', 2500); dSay('방장이 바뀌어서 이번 그림은 넘어가요'); }
      } else H.word = G.word;
    },
    myTurn() { return !!G && G.drawer === me() && (G.phase === 'pick' || G.phase === 'draw'); },
    onMsg(p) {
      if (p.t === 'ds') { if (p.from !== T.host || !p.g) return; if (G && (p.g.seq || 0) < (G.seq || 0) && p.g.round === G.round && p.g.turn === G.turn) return; dApply(p.g); return; }
      if (p.t === 'pick') { if (p.from === T.host && Array.isArray(p.words)) { D.choices = p.words.slice(0, 3); D.myWord = null; dUpdate(); } return; }
      if (p.t === 'w') { if (p.from === T.host) { D.myWord = String(p.word); D.choices = null; dUpdate(); } return; }
      if (p.t === 'word') { if (isHost() && G && p.from === G.drawer) dChoose(p.i); return; }
      if (p.t === 'g') { if (isHost()) dGuess(p.from, p.text); return; }
      if (p.t === 'ok') { if (p.from === T.host) dOnOk(p.id, p.pts); return; }
      if (p.t === 'chat') { if (p.from === T.host) dOnChat(p.id, String(p.name || ''), String(p.text || '').slice(0, 30)); return; }
      if (p.t === 'near') { dSay('거의 맞았어요! 조금만 더…', 'near'); return; }
      if (p.t === 'need') { if (dAmDrawer() && G.phase === 'draw') dSendAll(p.from); return; }
      // drawing: only from the person whose turn it is
      if (!G || p.from !== G.drawer) return;
      if (p.t === 's') {
        const i = p.i | 0; if (i < 0 || i > 2000 || !Array.isArray(p.p)) return;
        let s = D.strokes[i]; if (!s) { if ((p.o | 0) > 0) { D.need = true; return; } s = D.strokes[i] = { c: String(p.c).slice(0, 9), w: clampN(+p.w || 5, 1, 60), p: [] }; }
        if (s.p.length !== (p.o | 0)) { D.need = true; if (now() - D.needAt > 2500) { D.needAt = now(); send({ t: 'need' }); } return; }
        const from = s.p.length; for (const v of p.p.slice(0, 3200)) s.p.push(clampN(+v || 0, 0, 1000));
        const g = dCtx(); if (g) dSeg(g, s, from); return;
      }
      if (p.t === 'u') { D.strokes.length = Math.max(0, Math.min(D.strokes.length, p.n | 0)); dRedraw(); return; }
      if (p.t === 'clr') { D.strokes = []; D.need = false; dRedraw(); return; }
      if (p.t === 'all') {
        if (p.first) D.strokes = [];
        for (const s of (p.ss || [])) D.strokes[s.i | 0] = { c: String(s.c).slice(0, 9), w: clampN(+s.w || 5, 1, 60), p: (s.p || []).slice(0, 3200).map(v => clampN(+v || 0, 0, 1000)) };
        D.need = false; dRedraw();
      }
    }
  };
  // test hook (only with ?debug in the address)
  if (/[?&]debug\b/.test(location.search)) window.__tg = {
    T: () => T, G: () => G, C, D, H, createTable, joinTable, startGame, leaveTable, tables: tableList, TABLES, cAct, cAuto, cValid, WORDS, addBot, setBotLevel, removeBot, backToLobby, cPush, watchTable, botTurn, botStep, chAct, chDo, chResign,
    // a simple robot player for automated tests
    bot() {
      if (!G || !T || T.kind !== 'catan' || G.phase === 'finished' || !cWaiting().includes(me()) || now() - C.busy < 500) return;
      const g = G, P = g.players[cIdx()], pick = a => a[Math.random() * a.length | 0], has = c => RES.every(k => P.resources[k] >= (c[k] || 0)), BC = R.BUILDING_COSTS;
      const spot = m => { C.mode = m; const v = cValid(); C.mode = null; return v; };
      if (g.phase === 'setup') { const v = spot(g.x.step); return cAct(g.x.step, [pick(v).key]); }
      if (g.turnPhase === 'discard') { const d = g.discardingPlayers.find(x => x.playerIndex === cIdx()); const pool = []; for (const k of RES) for (let i = 0; i < P.resources[k]; i++) pool.push(k); const o = {}; shuffle(pool).slice(0, d.cardsToDiscard).forEach(k => { o[k] = (o[k] || 0) + 1; }); return cAct('discard', [o]); }
      if (g.turnPhase === 'robber') return cAct('robber', [pick(spot('robber')).key, null]);
      if (g.turnPhase === 'roll') return cAct('roll', []);
      if (g.yearOfPlentyPicks > 0) return cAct('yop', [pick(RES)]);
      if (g.freeRoads > 0) { const v = spot('road'); if (v.length) return cAct('road', [pick(v).key]); }
      if (has(BC.city) && P.cities) { const v = spot('city'); if (v.length) return cAct('city', [pick(v).key]); }
      if (has(BC.settlement) && P.settlements) { const v = spot('settle'); if (v.length) return cAct('settle', [pick(v).key]); }
      if (has(BC.developmentCard) && g.devCardDeck.length && Math.random() < 0.6) return cAct('buyDev', []);
      if (!g.devCardPlayedThisTurn) { const c = P.developmentCards.find(x => x !== 'victoryPoint'); if (c) return cAct('dev', [c, pick(RES)]); }
      if (has(BC.road) && P.roads && Math.random() < 0.7) { const v = spot('road'); if (v.length) return cAct('road', [pick(v).key]); }
      for (const k of RES) { const ratio = R.getTradeRatio(g, cIdx(), k); if (P.resources[k] >= ratio + 2) { const need = RES.filter(x => x !== k).sort((a, b) => P.resources[a] - P.resources[b])[0]; return cAct('bank', [k, need]); } }
      cAct('end', []);
    }
  };
})();
