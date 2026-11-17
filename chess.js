/*
 * ON-Lounge chess rules and computer opponent.
 *
 * Board squares use the 0x88 layout: index = row * 16 + file, and a square is off the board when
 * (index & 0x88) is not zero. Row 0 is rank 8 (black's back rank), row 7 is rank 1 (white's).
 * Pieces are single letters, capitals for white: P N B R Q K / p n b r q k, '' for an empty square.
 *
 * Everything here is plain data, so a whole game can be sent over the network and picked up by
 * another browser without any of it being rebuilt.
 */
window.ONL_CHESS = (function () {
  'use strict';
  const on = i => (i & 0x88) === 0;
  const row = i => i >> 4, file = i => i & 15;
  const sq = (r, f) => r * 16 + f;
  const isW = p => !!p && p === p.toUpperCase();
  const same = (a, b) => !!a && !!b && isW(a) === isW(b);
  const NAME = { p: '폰', n: '나이트', b: '비숍', r: '룩', q: '퀸', k: '킹' };
  const OFF = {
    n: [-33, -31, -18, -14, 14, 18, 31, 33],
    b: [-17, -15, 15, 17],
    r: [-16, -1, 1, 16],
    q: [-17, -16, -15, -1, 1, 15, 16, 17],
    k: [-17, -16, -15, -1, 1, 15, 16, 17]
  };
  const alg = i => 'abcdefgh'[file(i)] + (8 - row(i));
  const fromAlg = s => sq(8 - (+s[1]), 'abcdefgh'.indexOf(s[0]));

  function newGame() {
    const b = new Array(128).fill('');
    const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let f = 0; f < 8; f++) {
      b[sq(0, f)] = back[f]; b[sq(1, f)] = 'p';
      b[sq(6, f)] = 'P'; b[sq(7, f)] = back[f].toUpperCase();
    }
    return { b, w: true, cas: 'KQkq', ep: -1, half: 0, full: 1, hist: [], reps: {}, over: null, last: null };
  }
  const clone = g => ({ b: g.b.slice(), w: g.w, cas: g.cas, ep: g.ep, half: g.half, full: g.full, hist: [], reps: g.reps, over: null, last: g.last });

  function findKing(g, white) {
    const k = white ? 'K' : 'k';
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const i = sq(r, f); if (g.b[i] === k) return i; }
    return -1;
  }
  // is square i attacked by the side given?
  function attacked(g, i, byWhite) {
    const b = g.b;
    // pawns
    const pd = byWhite ? 16 : -16;   // a pawn that attacks i sits "behind" it
    for (const d of [pd - 1, pd + 1]) { const j = i + d; if (on(j) && b[j] && isW(b[j]) === byWhite && b[j].toLowerCase() === 'p') return true; }
    for (const d of OFF.n) { const j = i + d; if (on(j) && b[j] && isW(b[j]) === byWhite && b[j].toLowerCase() === 'n') return true; }
    for (const d of OFF.k) { const j = i + d; if (on(j) && b[j] && isW(b[j]) === byWhite && b[j].toLowerCase() === 'k') return true; }
    for (const d of OFF.b) for (let j = i + d; on(j); j += d) {
      if (b[j]) { if (isW(b[j]) === byWhite && 'bq'.includes(b[j].toLowerCase())) return true; break; }
    }
    for (const d of OFF.r) for (let j = i + d; on(j); j += d) {
      if (b[j]) { if (isW(b[j]) === byWhite && 'rq'.includes(b[j].toLowerCase())) return true; break; }
    }
    return false;
  }
  const inCheck = (g, white) => { const k = findKing(g, white); return k < 0 ? false : attacked(g, k, !white); };

  // every move the side to move could make, ignoring whether it leaves the king in check
  function pseudo(g) {
    const out = [], b = g.b, white = g.w;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const i = sq(r, f), p = b[i];
      if (!p || isW(p) !== white) continue;
      const t = p.toLowerCase();
      if (t === 'p') {
        const dir = white ? -16 : 16, start = white ? 6 : 1, last = white ? 0 : 7;
        const one = i + dir;
        if (on(one) && !b[one]) {
          if (row(one) === last) for (const q of 'qrbn') out.push({ from: i, to: one, promo: q });
          else {
            out.push({ from: i, to: one });
            const two = i + dir * 2;
            if (r === start && !b[two]) out.push({ from: i, to: two, dbl: true });
          }
        }
        for (const d of [dir - 1, dir + 1]) {
          const j = i + d; if (!on(j)) continue;
          if (b[j] && !same(p, b[j])) {
            if (row(j) === last) for (const q of 'qrbn') out.push({ from: i, to: j, promo: q, cap: b[j] });
            else out.push({ from: i, to: j, cap: b[j] });
          } else if (j === g.ep && !b[j]) out.push({ from: i, to: j, ep: true, cap: white ? 'p' : 'P' });
        }
      } else if (t === 'n' || t === 'k') {
        for (const d of OFF[t]) { const j = i + d; if (on(j) && !same(p, b[j])) out.push({ from: i, to: j, cap: b[j] || undefined }); }
      } else {
        const dirs = t === 'q' ? OFF.q : OFF[t];
        for (const d of dirs) for (let j = i + d; on(j); j += d) {
          if (!b[j]) { out.push({ from: i, to: j }); continue; }
          if (!same(p, b[j])) out.push({ from: i, to: j, cap: b[j] });
          break;
        }
      }
    }
    // castling
    const k = white ? findKing(g, true) : findKing(g, false);
    const home = white ? sq(7, 4) : sq(0, 4);
    if (k === home && !attacked(g, k, !white)) {
      const rights = white ? ['K', 'Q'] : ['k', 'q'];
      if (g.cas.includes(rights[0]) && !b[k + 1] && !b[k + 2] && b[k + 3] === (white ? 'R' : 'r')
        && !attacked(g, k + 1, !white) && !attacked(g, k + 2, !white)) out.push({ from: k, to: k + 2, castle: 'k' });
      if (g.cas.includes(rights[1]) && !b[k - 1] && !b[k - 2] && !b[k - 3] && b[k - 4] === (white ? 'R' : 'r')
        && !attacked(g, k - 1, !white) && !attacked(g, k - 2, !white)) out.push({ from: k, to: k - 2, castle: 'q' });
    }
    return out;
  }
  // apply a move in place; no checking, callers use legal moves
  function apply(g, m) {
    const b = g.b, p = b[m.from], white = isW(p), t = p.toLowerCase();
    const cap = m.ep ? b[m.to + (white ? 16 : -16)] : b[m.to];
    if (m.ep) b[m.to + (white ? 16 : -16)] = '';
    b[m.to] = m.promo ? (white ? m.promo.toUpperCase() : m.promo) : p;
    b[m.from] = '';
    if (m.castle) {
      const r0 = m.castle === 'k' ? m.from + 3 : m.from - 4, r1 = m.castle === 'k' ? m.from + 1 : m.from - 1;
      b[r1] = b[r0]; b[r0] = '';
    }
    // castling rights
    let cas = g.cas;
    if (t === 'k') cas = cas.replace(white ? /[KQ]/g : /[kq]/g, '');
    if (m.from === sq(7, 0) || m.to === sq(7, 0)) cas = cas.replace('Q', '');
    if (m.from === sq(7, 7) || m.to === sq(7, 7)) cas = cas.replace('K', '');
    if (m.from === sq(0, 0) || m.to === sq(0, 0)) cas = cas.replace('q', '');
    if (m.from === sq(0, 7) || m.to === sq(0, 7)) cas = cas.replace('k', '');
    g.cas = cas || '-';
    g.ep = m.dbl ? (m.from + m.to) / 2 : -1;
    g.half = (t === 'p' || cap) ? 0 : g.half + 1;
    if (!white) g.full++;
    g.w = !white;
    g.last = { from: m.from, to: m.to };
    return cap;
  }
  function legal(g) {
    const out = [];
    for (const m of pseudo(g)) {
      const c = clone(g); apply(c, m);
      if (!inCheck(c, !c.w)) out.push(m);
    }
    return out;
  }
  const key = g => g.b.join('') + '|' + g.w + '|' + g.cas + '|' + g.ep;

  // make a move on the real game, with the bookkeeping the UI needs
  function move(g, from, to, promo) {
    if (g.over) return { error: '이미 끝난 게임이에요' };
    const ms = legal(g).filter(m => m.from === from && m.to === to);
    if (!ms.length) return { error: '그 수는 둘 수 없어요' };
    const m = ms.length > 1 ? (ms.find(x => x.promo === (promo || 'q')) || ms[0]) : ms[0];
    const piece = g.b[from], cap = apply(g, m);
    const k = key(g); g.reps[k] = (g.reps[k] || 0) + 1;
    g.hist.push({ n: g.full, s: text(piece, m, cap), from: m.from, to: m.to });
    if (g.hist.length > 120) g.hist.splice(0, g.hist.length - 120);
    finish(g);
    return { ok: true, move: m, cap, piece };
  }
  function text(piece, m, cap) {
    if (m.castle) return m.castle === 'k' ? '0-0' : '0-0-0';
    const t = piece.toLowerCase();
    return (t === 'p' ? '' : NAME[t]) + alg(m.from) + (cap ? '×' : '-') + alg(m.to) + (m.promo ? '=' + NAME[m.promo] : '');
  }
  function finish(g) {
    const ms = legal(g);
    if (!ms.length) { g.over = inCheck(g, g.w) ? { win: g.w ? 'b' : 'w', why: 'mate' } : { win: null, why: 'stale' }; return; }
    if (g.half >= 100) { g.over = { win: null, why: '50' }; return; }
    if (g.reps[key(g)] >= 3) { g.over = { win: null, why: 'rep' }; return; }
    // not enough pieces left for anyone to mate
    const left = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const p = g.b[sq(r, f)]; if (p && p.toLowerCase() !== 'k') left.push(p.toLowerCase()); }
    if (!left.length || (left.length === 1 && 'nb'.includes(left[0]))) g.over = { win: null, why: 'material' };
  }
  function resign(g, white) { if (!g.over) g.over = { win: white ? 'b' : 'w', why: 'resign' }; }

  // ---- computer opponent ----
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  };
  function evaluate(g) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = g.b[sq(r, f)]; if (!p) continue;
      const t = p.toLowerCase(), white = isW(p);
      const idx = white ? r * 8 + f : (7 - r) * 8 + f;
      const v = VAL[t] + (PST[t] ? PST[t][idx] : 0);
      s += white ? v : -v;
    }
    return g.w ? s : -s;   // from the side to move's point of view
  }
  const ordered = (g, ms) => ms.slice().sort((a, b) => {
    const sc = m => (m.cap ? VAL[String(m.cap).toLowerCase()] * 10 - VAL[g.b[m.from].toLowerCase()] : 0) + (m.promo ? 800 : 0);
    return sc(b) - sc(a);
  });
  function quiesce(g, alpha, beta, depth) {
    const stand = evaluate(g);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (depth <= 0) return alpha;
    for (const m of ordered(g, legal(g).filter(x => x.cap || x.promo))) {
      const c = clone(g); apply(c, m);
      const v = -quiesce(c, -beta, -alpha, depth - 1);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function search(g, depth, alpha, beta) {
    const ms = legal(g);
    if (!ms.length) return inCheck(g, g.w) ? -90000 - depth : 0;
    if (depth <= 0) return quiesce(g, alpha, beta, 3);
    for (const m of ordered(g, ms)) {
      const c = clone(g); apply(c, m);
      const v = -search(c, depth - 1, -beta, -alpha);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  // level: 'easy' plays almost at random, 'mid' looks a couple of moves ahead, 'hard' a bit further
  function best(g, level) {
    const ms = legal(g);
    if (!ms.length) return null;
    if (level === 'easy') {
      // mostly random, but it will take a free piece about half the time
      const caps = ms.filter(m => m.cap);
      if (caps.length && Math.random() < 0.5) return caps[Math.random() * caps.length | 0];
      return ms[Math.random() * ms.length | 0];
    }
    const depth = level === 'hard' ? 3 : 2, noise = level === 'hard' ? 0 : 18;
    let bestV = -1e9, pickList = [];
    for (const m of ordered(g, ms)) {
      const c = clone(g); apply(c, m);
      let v = -search(c, depth - 1, -1e9, 1e9);
      if (noise) v += (Math.random() * 2 - 1) * noise;
      if (v > bestV + 0.001) { bestV = v; pickList = [m]; }
      else if (v > bestV - 0.001) pickList.push(m);
    }
    return pickList[Math.random() * pickList.length | 0] || ms[0];
  }

  return { newGame, legal, move, inCheck, resign, best, alg, fromAlg, on, row, file, sq, isW, findKing, NAME, evaluate };
})();
