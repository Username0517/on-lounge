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
  const R = window.CatanRules;
  const root = $('tg'), btn = $('tgBtn');
  const KIND_OF = { f1r2: 'catan', f1r3: 'draw' };
  const INFO = {
    catan: { title: '카탄', icon: '🏝️', min: 2, max: 6, blurb: '자원을 모아 마을과 도시를 짓고, 먼저 10점을 만들면 이겨요. 2~6명 (5명부터는 큰 섬).' },
    draw: { title: '그림 퀴즈', icon: '🎨', min: 2, max: 6, blurb: '한 명이 제시어를 그리면 나머지가 맞혀요. 빨리 맞힐수록 점수가 커요. 2~6명.' }
  };
  const GAMES = {};
  const me = () => O.uid();
  const kindHere = () => KIND_OF[O.scene()] || null;
  const now = () => performance.now();
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ================= the table (lobby, host, members) =================
  let T = null;          // { id, kind, host, members: [{ id, name }], started, v }
  let G = null;          // the game itself (shape depends on the kind)
  let lastTbl = 0, askAt = -1e9, mountedKey = '', hostGoneAt = 0;
  const isHost = () => !!T && T.host === me();
  const inTable = () => !!T && T.members.some(m => m.id === me());
  const memberName = id => { const m = T && T.members.find(x => x.id === id); return (m && m.name) || O.nameOf(id) || '친구'; };
  function send(p) { p.from = me(); p.k = T ? T.kind : kindHere(); if (T) p.tid = T.id; return O.send(p); }
  const seqNow = () => !G || !T ? 0 : T.kind === 'catan' ? (G.x ? G.x.seq : 0) : (G.seq || 0);
  function sendTbl() { if (!isHost()) return; lastTbl = now(); send({ t: 'tbl', tbl: T, seq: seqNow() }); }
  function bump() { T.v = (T.v || 0) + 1; sendTbl(); render(); }
  function ask() { const t = now(); if (t - askAt < 1500) return; askAt = t; O.send({ t: 'q', from: me(), k: kindHere() }); }
  function game() { return T ? GAMES[T.kind] : null; }

  function createTable() {
    const kind = kindHere(); if (!kind || T) return;
    T = { id: O.newId(), kind, host: me(), members: [{ id: me(), name: O.name() }], started: false, v: 1 };
    G = null; sendTbl(); render();
    O.say(`${INFO[kind].icon} ${INFO[kind].title} 자리를 열었어요. 친구들이 들어오길 기다려요!`);
    send({ t: 'note', text: `${INFO[kind].icon} ${O.name()}님이 ${INFO[kind].title} 자리를 열었어요. ${kind === 'catan' ? '테이블' : '그림판'}을 눌러 참가해요!` });
  }
  function joinTable() {
    if (!T || inTable()) return;
    if (isHost()) return;
    send({ t: 'join', name: O.name() });
  }
  function hostJoin(id, name) {
    if (!isHost() || T.members.some(m => m.id === id)) { sendTbl(); return; }
    const g = game();
    if (T.members.length >= INFO[T.kind].max) { send({ t: 'err', to: id, msg: '자리가 꽉 찼어요' }); return; }
    if (T.started && !(g.lateJoin && g.lateJoin(id, name))) { send({ t: 'err', to: id, msg: '이미 시작한 게임이에요. 구경은 할 수 있어요!' }); return; }
    if (!T.members.some(m => m.id === id)) T.members.push({ id, name: String(name || '친구').slice(0, 12) });
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
        else send({ t: 'close', id: T.id });
      } else send({ t: 'leave' });
    }
    if (game() && game().unmount) game().unmount();
    T = null; G = null; mountedKey = '';
    if (!quiet) render(); else label();
    setTimeout(ask, 1200);
  }
  function hostLeave(id) {
    if (!isHost() || !T.members.some(m => m.id === id)) return;
    const g = game();
    if (T.started && g.memberLeft) g.memberLeft(id, false);
    T.members = T.members.filter(m => m.id !== id);
    bump(); if (T.started) g.push();
  }
  function startGame() {
    if (!isHost() || T.started) return;
    const live = T.members.filter(m => O.here(m.id));
    if (live.length < INFO[T.kind].min) { toast(`${INFO[T.kind].min}명부터 시작할 수 있어요`); return; }
    T.members = live; T.started = true; T.v++;
    game().start(); sendTbl(); game().push(); render();
  }
  function backToLobby() { if (!isHost()) return; if (game().unmount) game().unmount(); T.started = false; G = null; mountedKey = ''; T.members = T.members.filter(m => O.here(m.id)); bump(); }
  // the host vanished: the first player still in the room takes over
  function takeOver() {
    if (!T || isHost()) return;
    const next = T.members.find(m => m.id !== T.host && O.here(m.id));
    if (!next) { if (game() && game().unmount) game().unmount(); T = null; G = null; mountedKey = ''; render(); return; }
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
      const t = p.tbl; if (!t || t.host !== p.from) return;
      if (T && T.id !== t.id) { if (isHost() && T.id < t.id) return; if (!isHost() && O.here(T.host) && now() - lastTbl < 9000) return; if (game() && game().unmount) game().unmount(); G = null; mountedKey = ''; }
      else if (T) {
        // two browsers both think they host this table (one of them was cut off for a while): the one further along in the game keeps it
        const mine = seqNow(), theirs = p.seq || 0;
        if (isHost() && t.host !== me()) {
          if (mine > theirs || (mine === theirs && me() < t.host)) { sendTbl(); if (T.started) game().push(); return; }
          if (game().unmount) game().unmount(); G = null; mountedKey = '';
        } else if (!isHost() && t.host !== T.host) { if (theirs < mine && O.here(T.host) && now() - lastTbl < 9000) return; if (theirs < mine) { if (game().unmount) game().unmount(); G = null; mountedKey = ''; } }
        else if ((t.v || 0) < (T.v || 0)) return;
      }
      const wasStarted = T && T.started, wasIn = inTable();
      T = t; lastTbl = now(); hostGoneAt = 0;
      if (wasStarted && !T.started) { if (game().unmount) game().unmount(); G = null; mountedKey = ''; }
      if (T.started && !G) send({ t: 'q' });
      if (wasIn && !inTable() && T.started) toast('게임에서 빠졌어요');
      render(); return;
    }
    if (p.t === 'close') { if (T && T.id === p.id) { const was = inTable(); if (game().unmount) game().unmount(); T = null; G = null; mountedKey = ''; if (was) toast('자리가 닫혔어요'); render(); } return; }
    if (p.t === 'err') { toast(p.msg); if (game() && game().onErr) game().onErr(); return; }
    if (!T || p.tid !== T.id) return;
    if (p.t === 'join') { hostJoin(p.from, p.name); return; }
    if (p.t === 'leave') { hostLeave(p.from); return; }
    const g = game(); if (g && g.onMsg) g.onMsg(p);
  };
  TG.onReady = () => {
    if (!kindHere()) return;
    if (isHost()) { sendTbl(); if (T.started) game().push(); } else setTimeout(() => { askAt = -1e9; ask(); }, 500);
    label();
  };
  TG.onHello = () => {};
  TG.onGone = id => {
    if (!T) return;
    if (isHost()) { if (T.members.some(m => m.id === id)) { if (!T.started) hostLeave(id); else if (game().memberGone) game().memberGone(id); else hostLeave(id); } return; }
    if (id === T.host) takeOver();
  };
  TG.onLeaveScene = () => { if (T) leaveTable(true); T = null; G = null; mountedKey = ''; root.hidden = true; root.innerHTML = ''; btn.hidden = true; };
  TG.busy = () => inTable() && T.started;
  TG.hide = () => { root.hidden = true; label(); };
  TG.open = kind => {
    if (!O.live()) { toast('혼자 보는 체험 모드에서는 함께 하는 게임을 할 수 없어요'); return; }
    if (!kindHere()) return;
    root.hidden = false; mountedKey = ''; render(); if (!T) ask();
  };
  btn.addEventListener('click', () => TG.open(kindHere()));

  let tickAt = now();
  setInterval(() => {
    const kind = kindHere();
    { const t0 = now(); if (t0 - tickAt > 5000) { lastTbl = t0; hostGoneAt = 0; if (T && !isHost()) { askAt = -1e9; ask(); } } tickAt = t0; }   // this tab was asleep: do not jump to conclusions
    if (!kind) { if (!btn.hidden) btn.hidden = true; return; }
    if (!O.ready()) return;
    const t = now();
    if (isHost()) { if (t - lastTbl > 4000) sendTbl(); if (T.started && game().tick) game().tick(t); }
    else if (T) {
      // the host is silent: ask, then take over if it has really gone
      if (t - lastTbl > 9000) ask();
      if (!O.here(T.host) || t - lastTbl > 30000) { if (!hostGoneAt) hostGoneAt = t; if (t - hostGoneAt > 2500) { hostGoneAt = 0; lastTbl = t; takeOver(); } } else hostGoneAt = 0;
      if (T && T.started && game().clientTick) game().clientTick(t);
    }
    label();
  }, 1000);

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
  function confirmBar(card, text, yesText, cb) {
    const old = card.querySelector('.tg-ask'); if (old) old.remove();
    const bar = el('div', 'tg-ask'); bar.appendChild(el('p', '', text));
    const row = el('div', 'tg-row'), y = el('button', 'btn btn-gold', yesText), n = el('button', 'btn', '취소');
    y.type = n.type = 'button'; y.addEventListener('click', () => { bar.remove(); cb(); }); n.addEventListener('click', () => bar.remove());
    row.append(y, n); bar.appendChild(row); card.appendChild(bar); y.focus();
  }
  function render() {
    label();
    if (root.hidden) return;
    const kind = kindHere(); if (!kind) { root.hidden = true; return; }
    const inf = INFO[kind];
    const key = !T ? 'none' : !T.started ? 'lobby' : (G ? 'game:' + T.id : 'wait');
    if (key.startsWith('game:') && key === mountedKey && root.firstChild) { GAMES[kind].update(); return; }
    if (mountedKey.startsWith('game:') && GAMES[kind].unmount) GAMES[kind].unmount();
    mountedKey = key; root.innerHTML = '';
    const card = el('div', 'tg-card tg-' + kind + (key.startsWith('game:') ? ' tg-play' : ''));
    const head = el('div', 'tg-head'), h = el('h2', '', `${inf.icon} ${inf.title}`), hb = el('div', 'tg-row');
    const fold = el('button', 'btn', '접기'); fold.type = 'button'; fold.addEventListener('click', TG.hide);
    if (inTable()) {
      const out = el('button', 'btn', '나가기'); out.type = 'button';
      out.addEventListener('click', () => { if (T && T.started && !(G && G.over)) confirmBar(card, kind === 'catan' ? '게임에서 나갈까요? 내 차례는 자동으로 넘어가게 돼요.' : '게임에서 나갈까요?', '나가기', () => leaveTable()); else leaveTable(); });
      hb.appendChild(out);
    }
    hb.appendChild(fold); head.append(h, hb); card.appendChild(head);
    const body = el('div', 'tg-body'); card.appendChild(body); root.appendChild(card);
    if (key === 'none') {
      body.appendChild(el('p', 'tg-blurb', inf.blurb));
      body.appendChild(el('p', 'tg-empty', '아직 열린 자리가 없어요. 먼저 자리를 열고 친구들을 기다려 보세요!'));
      const b = el('button', 'btn btn-gold tg-big', '자리 열기'); b.type = 'button'; b.addEventListener('click', createTable); body.appendChild(b);
    } else if (key === 'lobby') {
      body.appendChild(el('p', 'tg-blurb', inf.blurb));
      const list = el('div', 'tg-list');
      T.members.forEach(m => { const r = el('div', 'tg-mem'); r.append(el('span', 'tg-name', m.name), el('span', 'tg-tag', m.id === T.host ? '방장' : m.id === me() ? '나' : '')); list.appendChild(r); });
      for (let i = T.members.length; i < Math.min(inf.max, Math.max(inf.min, T.members.length + 1)); i++) list.appendChild(el('div', 'tg-mem empty', '빈 자리'));
      body.appendChild(list);
      const row = el('div', 'tg-row');
      if (!inTable()) { const j = el('button', 'btn btn-gold tg-big', T.members.length >= inf.max ? '자리가 꽉 찼어요' : '참가하기'); j.type = 'button'; j.disabled = T.members.length >= inf.max; j.addEventListener('click', joinTable); row.appendChild(j); }
      else if (isHost()) {
        const ok = T.members.length >= inf.min;
        const s = el('button', 'btn btn-gold tg-big', ok ? '게임 시작' : `${inf.min}명부터 시작할 수 있어요`); s.type = 'button'; s.disabled = !ok; s.addEventListener('click', startGame); row.appendChild(s);
      } else row.appendChild(el('p', 'tg-empty', '방장이 시작하기를 기다리고 있어요…'));
      body.appendChild(row);
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
  const TERRAIN_COL = { hills: '#c9643a', forest: '#2f7d3f', pasture: '#9bd070', fields: '#e6c04f', mountains: '#8a90a0', desert: '#ead9ad' };
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
  function cTick() {
    if (!G || G.phase === 'finished') return;
    const t = Date.now();
    for (const id of cWaiting()) {
      if (id === me() || O.here(id)) { delete C.absent[id]; continue; }
      if (!C.absent[id]) C.absent[id] = t;
      else if (t - C.absent[id] > 6000) { C.absent[id] = t - 3500; cAuto(id); return; }
    }
    // a trade offer nobody in the room can answer
    if (G.tradeOffer && !G.players.some((p, i) => i !== G.tradeOffer.from && O.here(p.id) && G.tradeOffer.responses[p.id] !== 'decline')) { G.tradeOffer = null; G.x.seq++; cPush(); }
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
    const cv = d.cv, geo = cGeo(), wCss = cv.clientWidth || 300, bw = geo.x1 - geo.x0, bh = geo.y1 - geo.y0;
    const S = wCss / bw, hCss = Math.round(S * bh), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (cv.width !== Math.round(wCss * dpr) || cv.height !== Math.round(hCss * dpr)) { cv.width = Math.round(wCss * dpr); cv.height = Math.round(hCss * dpr); cv.style.height = hCss + 'px'; }
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
    for (const h of geo.H) {
      const hx = G.hexes[h.k];
      hexPath(h.x, h.y, 0.97); g.fillStyle = TERRAIN_COL[hx.terrain] || '#ccc'; g.fill(); g.strokeStyle = 'rgba(37,28,44,.55)'; g.lineWidth = 1.5; g.stroke();
      if (glow && roll && hx.number === roll && h.k !== G.robber) { hexPath(h.x, h.y, 0.9); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }
      g.fillStyle = hx.terrain === 'forest' || hx.terrain === 'hills' ? 'rgba(255,255,255,.92)' : 'rgba(37,28,44,.8)';
      g.font = `700 ${Math.max(8, S * 0.25)}px sans-serif`; g.fillText(TERRAIN_KO[hx.terrain], X(h.x), Y(h.y - 0.58));
      if (hx.number) {
        g.fillStyle = '#fff8ea'; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(X(h.x), Y(h.y + 0.08), S * 0.33, 0, 6.3); g.fill(); g.stroke();
        const hot = hx.number === 6 || hx.number === 8; g.fillStyle = hot ? '#d6362b' : INK; g.font = `800 ${Math.max(10, S * 0.36)}px sans-serif`; g.fillText(hx.number, X(h.x), Y(h.y + 0.04));
        const n = PIPS[hx.number], pw = S * 0.055; for (let i = 0; i < n; i++) g.fillRect(X(h.x) - (n * pw * 1.6) / 2 + i * pw * 1.6 + pw * 0.3, Y(h.y + 0.27), pw, pw);
      }
      if (h.k === G.robber) {
        const rx = X(h.x - 0.5), ry = Y(h.y + 0.22); g.fillStyle = '#3b3a44'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(rx, ry - S * 0.3, S * 0.14, 0, 6.3); g.fill(); g.stroke(); g.beginPath(); g.ellipse(rx, ry, S * 0.17, S * 0.26, 0, 0, 6.3); g.fill(); g.stroke();
      }
    }
    // roads
    g.lineCap = 'round';
    for (const e of geo.E) {
      const rd = eRoad(e); if (!rd) continue;
      const ax = e.x1 + (e.x2 - e.x1) * 0.16, ay = e.y1 + (e.y2 - e.y1) * 0.16, bx = e.x1 + (e.x2 - e.x1) * 0.84, by = e.y1 + (e.y2 - e.y1) * 0.84;
      g.strokeStyle = INK; g.lineWidth = S * 0.2; g.beginPath(); g.moveTo(X(ax), Y(ay)); g.lineTo(X(bx), Y(by)); g.stroke();
      g.strokeStyle = R.PLAYER_COLORS[rd.owner]; g.lineWidth = S * 0.12; g.beginPath(); g.moveTo(X(ax), Y(ay)); g.lineTo(X(bx), Y(by)); g.stroke();
    }
    // buildings
    for (const v of geo.V) {
      const bd = vBuild(v); if (!bd) continue;
      const cx = X(v.x), cy = Y(v.y), u = S * (bd.building === 'city' ? 0.2 : 0.16);
      g.fillStyle = R.PLAYER_COLORS[bd.owner]; g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
      if (bd.building === 'city') { g.moveTo(cx - u * 1.5, cy + u); g.lineTo(cx - u * 1.5, cy - u * 0.2); g.lineTo(cx - u * 0.2, cy - u * 0.2); g.lineTo(cx - u * 0.2, cy - u * 1.1); g.lineTo(cx + u * 0.65, cy - u * 1.9); g.lineTo(cx + u * 1.5, cy - u * 1.1); g.lineTo(cx + u * 1.5, cy + u); }
      else { g.moveTo(cx - u, cy + u); g.lineTo(cx - u, cy - u * 0.3); g.lineTo(cx, cy - u * 1.3); g.lineTo(cx + u, cy - u * 0.3); g.lineTo(cx + u, cy + u); }
      g.closePath(); g.fill(); g.stroke();
    }
    // where I can act
    const spots = cValid(); C.spots = spots;
    if (spots.length) {
      const pulse = 0.5 + 0.5 * Math.sin(now() / 260), col = R.PLAYER_COLORS[cIdx()] || '#fff';
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
  }
  const resChip = (k, n, extra) => { const c = el('span', 'ct-res' + (extra || '')); c.style.setProperty('--c', RES_COL[k]); c.append(el('b', '', RES_KO[k]), el('i', '', n)); return c; };
  function cMount(body) {
    const d = C.dom = {};
    d.players = el('div', 'ct-players'); d.status = el('p', 'ct-status'); d.dice = el('div', 'ct-dice');
    const top = el('div', 'ct-top'); top.append(d.status, d.dice);
    d.cv = el('canvas', 'ct-board'); d.cv.addEventListener('pointerdown', cTap);
    d.panel = el('div', 'ct-panel'); d.hand = el('div', 'ct-hand'); d.acts = el('div', 'ct-acts'); d.log = el('div', 'ct-log');
    const left = el('div', 'ct-left'), right = el('div', 'ct-right');
    left.append(d.cv); right.append(d.panel, d.hand, d.acts, d.log);
    const cols = el('div', 'ct-cols'); cols.append(left, right);
    body.append(d.players, top, cols);
    d.ro = new ResizeObserver(() => cDraw()); d.ro.observe(d.cv);
    cUpdate();
  }
  function cUnmount() { if (C.dom && C.dom.ro) C.dom.ro.disconnect(); cancelAnimationFrame(C.raf); C.dom = null; C.panel = null; C.mode = null; C.pend = null; C.lastSeq = -1; }
  const mkBtn = (text, cls, fn, dis) => { const b = el('button', 'btn ' + (cls || ''), text); b.type = 'button'; if (dis) b.disabled = true; b.addEventListener('click', fn); return b; };
  function cUpdate() {
    const d = C.dom; if (!d || !G) return;
    const g = G, i = cIdx(), mine = cMine(), meP = i >= 0 ? g.players[i] : null, playing = g.phase === 'playing';
    // players
    d.players.innerHTML = '';
    g.players.forEach((p, pi) => {
      const c = el('div', 'ct-p' + (pi === g.currentPlayerIndex && g.phase !== 'finished' ? ' on' : '') + (O.here(p.id) ? '' : ' away'));
      const dot = el('i', 'ct-dot'); dot.style.background = R.PLAYER_COLORS[pi];
      const vp = p.victoryPoints + (pi === i ? (p.hiddenVictoryPoints || 0) : 0);
      c.append(dot, el('b', '', p.name + (p.id === me() ? ' (나)' : '')), el('span', 'ct-vp', `★${vp}`), el('span', '', `카드 ${cardCount(p)}`), el('span', '', `발전 ${p.developmentCards.length + p.newDevCards.length}`));
      if (p.knightsPlayed) c.appendChild(el('span', '', `기사 ${p.knightsPlayed}`));
      if (p.hasLongestRoad) c.appendChild(el('span', 'ct-badge', '최장 도로 +2'));
      if (p.hasLargestArmy) c.appendChild(el('span', 'ct-badge', '최대 기사단 +2'));
      if (!O.here(p.id)) c.appendChild(el('span', 'ct-off', '자리 비움'));
      d.players.appendChild(c);
    });
    cStatus();
    d.dice.innerHTML = ''; if (g.diceRoll) { d.dice.append(el('span', 'ct-die', g.diceRoll.die1), el('span', 'ct-die', g.diceRoll.die2), el('b', '', '= ' + g.diceRoll.total)); }
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
    // my hand
    d.hand.innerHTML = '';
    if (meP) {
      const row = el('div', 'ct-step'); RES.forEach(k => row.appendChild(resChip(k, meP.resources[k], meP.resources[k] ? '' : ' zero'))); d.hand.appendChild(row);
      const devs = meP.developmentCards.concat(meP.newDevCards);
      if (devs.length) {
        const dr = el('div', 'ct-devs'), canPlay = mine && playing && !g.devCardPlayedThisTurn && (g.turnPhase === 'main' || g.turnPhase === 'roll');
        meP.developmentCards.forEach(cd => { const b = mkBtn(DEV_KO[cd], 'ct-dev', () => { if (cd === 'monopoly') { C.panel = { t: 'mono' }; cUpdate(); } else cAct('dev', [cd]); }, cd === 'victoryPoint' || !canPlay); b.title = DEV_TIP[cd]; dr.appendChild(b); });
        meP.newDevCards.forEach(cd => { const b = mkBtn(DEV_KO[cd] + (cd === 'victoryPoint' ? '' : ' (다음 턴부터)'), 'ct-dev new', () => {}, true); b.title = DEV_TIP[cd]; dr.appendChild(b); });
        d.hand.appendChild(dr);
      }
    } else d.hand.appendChild(el('p', 'tg-empty', '구경하고 있어요'));
    // actions
    const a = d.acts; a.innerHTML = '';
    if (meP && playing) {
      const has = c => RES.every(k => meP.resources[k] >= (c[k] || 0)), main = mine && g.turnPhase === 'main', BC = R.BUILDING_COSTS;
      const tog = m => () => { C.mode = C.mode === m ? null : m; C.pend = null; C.panel = null; cUpdate(); };
      if (mine && g.turnPhase === 'roll') a.appendChild(mkBtn('🎲 주사위 굴리기', 'btn-gold tg-big', () => cAct('roll', [])));
      if (main) {
        a.append(mkBtn('길', C.mode === 'road' ? 'btn-gold' : '', tog('road'), !has(BC.road) || !meP.roads), mkBtn('마을', C.mode === 'settle' ? 'btn-gold' : '', tog('settle'), !has(BC.settlement) || !meP.settlements),
          mkBtn('도시', C.mode === 'city' ? 'btn-gold' : '', tog('city'), !has(BC.city) || !meP.cities), mkBtn('발전 카드', '', () => cAct('buyDev', []), !has(BC.developmentCard) || !g.devCardDeck.length),
          mkBtn('교환', C.panel && C.panel.t === 'trade' ? 'btn-gold' : '', () => { C.panel = C.panel && C.panel.t === 'trade' ? null : { t: 'trade', tab: 'bank', offer: {}, req: {} }; C.mode = null; cUpdate(); }, !!tr),
          mkBtn('턴 종료 ▶', 'btn-gold', () => { C.mode = null; C.panel = null; cAct('end', []); }));
      }
      a.appendChild(el('p', 'ct-tip', COST_KO));
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
    start: cStart, push: cPush, tick: cTick, mount: cMount, update: cUpdate, unmount: cUnmount, keepLeavers: true,
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
  const WORDS = ('사과 바나나 수박 포도 딸기 복숭아 파인애플 당근 옥수수 감자 고구마 양파 버섯 호박 토마토 김밥 떡볶이 라면 피자 햄버거 치킨 짜장면 만두 비빔밥 삼겹살 아이스크림 케이크 초콜릿 도넛 붕어빵 솜사탕 팝콘 커피 우유 ' +
    '강아지 고양이 토끼 코끼리 기린 사자 호랑이 곰 판다 원숭이 돼지 소 말 양 닭 오리 펭귄 부엉이 독수리 앵무새 상어 고래 돌고래 문어 오징어 거북이 악어 뱀 개구리 나비 벌 개미 거미 달팽이 공룡 낙타 캥거루 코알라 다람쥐 고슴도치 ' +
    '자동차 버스 기차 지하철 비행기 헬리콥터 배 자전거 오토바이 택시 소방차 구급차 로켓 잠수함 트럭 킥보드 ' +
    '집 학교 교회 병원 아파트 놀이터 도서관 편의점 공항 다리 등대 성 텐트 풍차 피라미드 만리장성 에펠탑 ' +
    '의자 책상 침대 소파 냉장고 세탁기 텔레비전 컴퓨터 노트북 휴대폰 시계 안경 우산 가방 모자 신발 양말 장갑 목도리 열쇠 가위 연필 지우개 책 달력 거울 빗 칫솔 비누 수건 촛불 전구 선풍기 에어컨 청소기 카메라 마이크 이어폰 리모컨 ' +
    '기타 피아노 드럼 바이올린 트럼펫 축구공 농구공 야구 배드민턴 탁구 볼링 스케이트 스키 수영 낚시 줄넘기 그네 미끄럼틀 시소 연 풍선 주사위 퍼즐 로봇 인형 ' +
    '해 달 별 구름 비 눈 무지개 번개 바람 산 바다 강 섬 폭포 사막 화산 나무 꽃 장미 해바라기 선인장 잎 숲 눈사람 ' +
    '의사 경찰 소방관 요리사 선생님 가수 화가 농부 우주인 해적 왕 공주 마법사 유령 천사 목사님 ' +
    '눈물 웃음 하품 재채기 악수 박수 기도 찬양 십자가 성경 방주 무지개떡 크리스마스 선물 생일 결혼식 졸업 소풍 캠핑 불꽃놀이 ' +
    '코 입 귀 손 발 머리카락 수염 심장 뼈 이빨 ' +
    '젓가락 숟가락 포크 냄비 프라이팬 컵 접시 주전자 도마 칼 ' +
    '지도 나침반 망원경 현미경 지구 태양 우주선 외계인 보물상자 왕관 반지 목걸이 다이아몬드 돈 지갑 저금통 편지 우체통 신호등 횡단보도 엘리베이터 계단 사다리 열기구 낙하산 썰매 눈싸움 훠궈 마라탕 탕후루 버블티').split(' ').filter((w, i, a) => w && a.indexOf(w) === i);
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const cho = ch => { const c = ch.charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch; };
  const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const editDist = (a, b) => { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const COLORS = ['#251c2c', '#ffffff', '#8d8f99', '#e63946', '#ff8a3a', '#ffcc4d', '#7ddc5a', '#2f8a55', '#4fa6dc', '#3f51b5', '#b06cff', '#ff8fb3', '#8a5a3b', '#f5cda6'];
  const SIZES = [5, 12, 26];
  const PICK_MS = 15000, DRAW_MS = 80000, REVEAL_MS = 5000, END_MS = 60000, ROUNDS = 3;

  const D = { dom: null, strokes: [], cur: null, color: COLORS[0], size: 1, endAt: 0, total: 1, myWord: null, choices: null, chat: [], out: [], flushT: 0, need: false, needAt: 0, used: [] };
  const H = { word: null, choices: null, hint1: false, hint2: false, phaseEnd: 0 };   // host-only secrets
  const dDrawer = () => G && G.drawer;
  const dAmDrawer = () => !!G && G.drawer === me() && inTable();
  const dName = id => (G && G.names && G.names[id]) || memberName(id);
  function dSay(text, cls) { D.chat.push({ text, cls: cls || 'sys' }); if (D.chat.length > 60) D.chat.shift(); dChat(); }

  // ---- host ----
  function dStart() {
    G = { kind: 'draw', seq: 1, round: 1, rounds: ROUNDS, order: shuffle(T.members.map(m => m.id)), turn: 0, drawer: null, phase: 'pick', rem: 0, total: 1, mask: [], scores: {}, got: {}, names: {}, word: null, over: false };
    T.members.forEach(m => { G.scores[m.id] = 0; G.names[m.id] = m.name; });
    D.used = []; dBeginPick();
  }
  function dSetPhase(phase, ms) { G.phase = phase; G.total = ms; H.phaseEnd = now() + ms; G.seq++; }
  function dBeginPick() {
    G.order = G.order.filter(id => O.here(id));
    if (G.order.length < 2) { dFinish(); return; }
    if (G.turn >= G.order.length) { G.turn = 0; G.round++; }
    if (G.round > G.rounds) { dFinish(); return; }
    G.drawer = G.order[G.turn]; G.got = {}; G.word = null; G.mask = []; H.word = null; H.hint1 = H.hint2 = false;
    const pool = WORDS.filter(w => !D.used.includes(w)); H.choices = shuffle(pool.length >= 3 ? pool : WORDS).slice(0, 3);
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
      if (g.phase === 'pick') { D.strokes = []; D.cur = null; if (g.drawer !== me()) { D.choices = null; D.myWord = null; } dSay(`${g.round}/${g.rounds} 라운드 · ${dName(g.drawer)}님이 그릴 차례예요`); }
      if (g.phase === 'draw') { if (g.drawer === me()) dSay('그리기 시작! 글자나 숫자는 쓰지 않기로 해요 🙂'); sfx('pop', 0.35); }
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
      d.input.value = '';
      if (isHost()) dGuess(me(), text); else send({ t: 'g', text });
    });
    const side = el('div', 'dw-side'); side.append(d.scores, d.chat, d.form);
    const main = el('div', 'dw-main'); main.append(d.wrap, d.tools);
    const cols = el('div', 'dw-cols'); cols.append(main, side);
    body.append(d.info, d.time, cols);
    dRedraw(); dTools(); dChat(); dUpdate();
    clearInterval(D.clock); D.clock = setInterval(dClock, 250);
    if (G && G.phase === 'draw' && !dAmDrawer()) { D.need = true; D.needAt = now(); send({ t: 'need' }); }
  }
  function dUnmount() { clearInterval(D.clock); clearInterval(D.flushT); D.dom = null; D.cur = null; D.strokes = []; D.chat = []; D.prev = null; D.choices = null; D.myWord = null; }
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
    d.input.disabled = !can; d.sendBtn.disabled = !can;
    d.input.placeholder = !member ? '구경하고 있어요' : drawer ? '내가 그리는 차례예요' : g.got[me()] != null ? '정답을 맞혔어요! 🎉' : g.phase === 'draw' ? '정답을 입력하세요' : '잠깐 기다려요…';
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
    T: () => T, G: () => G, C, D, H, createTable, joinTable, startGame, leaveTable, cAct, cAuto, cValid, WORDS,
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
