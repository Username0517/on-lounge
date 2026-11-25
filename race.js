/*
 * ON-Lounge 레이싱 (race.js)
 *
 * A kart race in the style of the classic chase-camera racers: the road is a flat picture seen from
 * just behind your own kart ("mode 7"), karts and roadside things are flat pictures standing on it.
 * Everything here (tracks, karts, pictures, sounds) is drawn in code; nothing is copied from any game.
 *
 * One file, three parts:
 *   1. CORE  – tracks and the road picture. No DOM, so a test script can load it in node.
 *   2. GAME  – drawing, driving, the lobby and the network (only in the browser).
 *   3. PAD   – a phone that scans a QR code becomes the controller (pad.html is the phone side).
 *
 * Network: every racer drives its own kart and tells the others where it is a couple of times a second;
 * the others draw it where it should be by now. The table host only keeps the race state (map, start,
 * finish times). Fewer messages with more people, so a 6-person race stays under the free plan's limit.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapA = a => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
  // 0xAABBGGRR (little-endian canvas pixels)
  const C32 = (hex, a) => { const n = parseInt(hex.slice(1), 16); return (((a == null ? 255 : a) << 24) >>> 0) + ((n & 255) << 16) + (n & 0xff00) + (n >> 16); };
  const mix32 = (c1, c2, t) => {
    const r = lerp(c1 & 255, c2 & 255, t), g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t), b = lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t);
    return ((255 << 24) >>> 0) + (Math.round(b) << 16) + (Math.round(g) << 8) + Math.round(r);
  };
  const shade32 = (c, k) => {
    const r = clamp((c & 255) * k, 0, 255), g = clamp(((c >> 8) & 255) * k, 0, 255), b = clamp(((c >> 16) & 255) * k, 0, 255);
    return ((255 << 24) >>> 0) + (Math.round(b) << 16) + (Math.round(g) << 8) + Math.round(r);
  };
  function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ================================================================================================
  //  Themes: colours of the road, the roadside and the sky, and what stands by the road
  // ================================================================================================
  const THEMES = {
    meadow: { ko: '초원', road: '#6d6e78', road2: '#64656f', line: '#f4f1e6', kerb: ['#e03131', '#f4f1e6'], off: '#6fb34f', off2: '#5fa043', wall: '#8a5a3b', wall2: '#6b4a32',
      out: '#6aaa4a', out2: '#5c9a3f', pat: 'grass', sky: ['#5fb3f0', '#bfe6ff'], hill: '#4f9a52', hill2: '#3f8044', far: 'hills', fog: '#cfeaff', props: ['tree', 'tree', 'bush', 'flower', 'tree2'] },
    beach: { ko: '해변', road: '#7a7480', road2: '#716b77', line: '#fff7dd', kerb: ['#1c7ed6', '#fff7dd'], off: '#ecd59a', off2: '#e1c784', wall: '#c9a66b', wall2: '#a98a55',
      out: '#3aa6d8', out2: '#57b9e4', pat: 'water', sky: ['#3fa9f5', '#c8ecff'], hill: '#7fc5a0', hill2: '#5aa882', far: 'sea', fog: '#d4f0ff', props: ['palm', 'palm', 'umbrella', 'rock'] },
    sakura: { ko: '벚꽃', road: '#7b7582', road2: '#726c79', line: '#ffffff', kerb: ['#f783ac', '#ffffff'], off: '#86c06a', off2: '#78b25c', wall: '#d9b38c', wall2: '#b8926c',
      out: '#7fb966', out2: '#f2b8cf', pat: 'petal', sky: ['#8fc8ff', '#ffe3ef'], hill: '#9fc98c', hill2: '#e9a8c2', far: 'hills', fog: '#ffeaf3', props: ['sakura', 'sakura', 'lamp', 'bush'] },
    city: { ko: '도심', road: '#3d3f4a', road2: '#373943', line: '#ffd43b', kerb: ['#f8f9fa', '#495057'], off: '#5c6370', off2: '#535a66', wall: '#adb5bd', wall2: '#868e96',
      out: '#2b2f3a', out2: '#353a47', pat: 'city', sky: ['#0b1030', '#38306b'], hill: '#151a33', hill2: '#ffd86b', far: 'city', fog: '#3a3462', night: true, props: ['tower', 'lamp', 'tower', 'sign'] },
    canyon: { ko: '사막', road: '#8c6f5e', road2: '#836655', line: '#fff3d6', kerb: ['#d9480f', '#fff3d6'], off: '#e0a86a', off2: '#d49a5c', wall: '#b5653a', wall2: '#93502c',
      out: '#d99a5a', out2: '#cc8c4c', pat: 'sand', sky: ['#f59f45', '#ffe2a8'], hill: '#c0602f', hill2: '#9c4a22', far: 'mesa', fog: '#ffe0b0', props: ['cactus', 'rock', 'cactus', 'skull'] },
    autumn: { ko: '단풍', road: '#6f6a6a', road2: '#666161', line: '#fff4e0', kerb: ['#e8590c', '#fff4e0'], off: '#c9a14a', off2: '#b88f3d', wall: '#7a4a2a', wall2: '#5e3820',
      out: '#b8863a', out2: '#c96d2c', pat: 'leaf', sky: ['#7cb4e8', '#ffe8c4'], hill: '#c2622a', hill2: '#9c4a1f', far: 'hills', fog: '#ffeed6', props: ['maple', 'maple', 'pine', 'bush'] },
    snow: { ko: '눈꽃', road: '#8a93a6', road2: '#818a9d', line: '#ffffff', kerb: ['#4dabf7', '#ffffff'], off: '#eef4fb', off2: '#dde7f3', wall: '#a5c8e8', wall2: '#86acd0',
      out: '#f1f6fc', out2: '#dfe9f5', pat: 'snow', sky: ['#9cc2e8', '#eef6ff'], hill: '#cfe0f2', hill2: '#ffffff', far: 'mountains', fog: '#f2f7ff', ice: '#bfe3fb', props: ['pine2', 'pine2', 'snowman', 'pine2'] },
    jungle: { ko: '정글', road: '#7a6a52', road2: '#71624b', line: '#f1e3b0', kerb: ['#2f9e44', '#f1e3b0'], off: '#3f8a3a', off2: '#347a30', wall: '#5a4026', wall2: '#45301c',
      out: '#2f7a34', out2: '#286c2c', pat: 'jungle', sky: ['#6cc4a0', '#e2f7d6'], hill: '#2c6b35', hill2: '#1f5428', far: 'trees', fog: '#d8f2d0', mud: '#5b4330', props: ['jtree', 'fern', 'jtree', 'rock'] },
    harbor: { ko: '항구', road: '#6c7480', road2: '#646b77', line: '#ffe066', kerb: ['#f59f00', '#343a40'], off: '#8b8f96', off2: '#7f838a', wall: '#495057', wall2: '#343a40',
      out: '#2a7fb8', out2: '#3b8fc8', pat: 'water', sky: ['#4c8fd6', '#d6ecff'], hill: '#5d6f84', hill2: '#e03131', far: 'port', fog: '#dceeff', props: ['crate', 'bollard', 'crane', 'crate'] },
    candy: { ko: '과자', road: '#c78a5a', road2: '#bd8050', line: '#fff0f6', kerb: ['#f06595', '#fff0f6'], off: '#ffd8e8', off2: '#ffc9df', wall: '#7a4a2a', wall2: '#5e3820',
      out: '#fbc2d8', out2: '#ffe3ee', pat: 'candy', sky: ['#ffa8d0', '#fff0c8'], hill: '#f783ac', hill2: '#ffd43b', far: 'candy', fog: '#ffeef6', props: ['lolly', 'candycane', 'lolly', 'cupcake'] },
    neon: { ko: '네온', road: '#24213a', road2: '#211e35', line: '#3bf0ff', kerb: ['#ff3bd8', '#3bf0ff'], off: '#1b1830', off2: '#211d3a', wall: '#ff3bd8', wall2: '#b21e98',
      out: '#120f22', out2: '#1a1630', pat: 'grid', sky: ['#07051a', '#3a1660'], hill: '#16123a', hill2: '#ff3bd8', far: 'city', fog: '#2a1450', night: true, props: ['neonpost', 'tower', 'neonpost', 'sign'] },
    volcano: { ko: '화산', road: '#4a3f3f', road2: '#433838', line: '#ffb36b', kerb: ['#e8590c', '#343a40'], off: '#3b3030', off2: '#332929', wall: '#5c4a44', wall2: '#463834',
      out: '#e8590c', out2: '#ff922b', pat: 'lava', sky: ['#3a1410', '#c2401e'], hill: '#2a1a18', hill2: '#ff6b2c', far: 'volcano', fog: '#7a2a18', night: true, props: ['rock', 'deadtree', 'rock', 'crystal'] },
    glacier: { ko: '빙하', road: '#9fc6e6', road2: '#95bcdc', line: '#ffffff', kerb: ['#1971c2', '#ffffff'], off: '#d9ecfb', off2: '#c7e1f7', wall: '#74b4e8', wall2: '#4f95cf',
      out: '#e4f2fd', out2: '#cde5f9', pat: 'snow', sky: ['#6aa6dc', '#e2f1ff'], hill: '#b6d6f2', hill2: '#ffffff', far: 'mountains', fog: '#e8f4ff', ice: '#c4e6ff', props: ['icicle', 'pine2', 'icicle', 'snowman'] },
    construct: { ko: '공사장', road: '#6a6560', road2: '#625d58', line: '#ffd43b', kerb: ['#fab005', '#212529'], off: '#a98d6d', off2: '#9a7f60', wall: '#fab005', wall2: '#212529',
      out: '#9c8466', out2: '#8d775a', pat: 'sand', sky: ['#78aee0', '#e6f1fb'], hill: '#8d939c', hill2: '#fab005', far: 'cranes', fog: '#e8eef5', props: ['crane', 'pipes', 'sign2', 'crate'] },
    cave: { ko: '동굴', road: '#4b4560', road2: '#443e58', line: '#c0a8ff', kerb: ['#9775fa', '#2b2440'], off: '#2e2840', off2: '#272238', wall: '#3d3456', wall2: '#2b2440',
      out: '#1a1628', out2: '#221d34', pat: 'dark', sky: ['#0d0a18', '#2a2040'], hill: '#1b1630', hill2: '#9775fa', far: 'cave', fog: '#2a2240', night: true, props: ['crystal', 'crystal', 'shroom', 'rock'] },
    space: { ko: '우주', road: '#4c5672', road2: '#46506a', line: '#8ce99a', kerb: ['#5c7cfa', '#dbe4ff'], off: '#30384e', off2: '#2a3146', wall: '#748ffc', wall2: '#4c6ef5',
      out: null, out2: null, pat: 'void', sky: ['#04030c', '#141032'], hill: '#0a0820', hill2: '#ffd8a8', far: 'planets', fog: '#120e30', night: true, props: ['beacon', 'antenna', 'beacon'] },
    cliff: { ko: '절벽', road: '#7d766c', road2: '#746d63', line: '#fff3d6', kerb: ['#c92a2a', '#fff3d6'], off: '#8a9a5b', off2: '#7c8b50', wall: '#8d8478', wall2: '#6e665c',
      out: null, out2: null, pat: 'void', sky: ['#6fa8dc', '#f4e9d8'], hill: '#8b98a8', hill2: '#ffffff', far: 'peaks', fog: '#e6edf5', props: ['pine', 'rock', 'pine'] },
    rainbow: { ko: '무지개', road: '#ffffff', road2: '#f1f3f5', line: '#ffffff', kerb: ['#ff6b6b', '#4dabf7'], off: '#ffffff', off2: '#f1f3f5', wall: '#ffd43b', wall2: '#fab005',
      out: null, out2: null, pat: 'void', sky: ['#05041a', '#2b1c5c'], hill: '#0c0a26', hill2: '#ffd8f0', far: 'stars', fog: '#1c1442', night: true, rainbow: true, props: ['star', 'beacon'] }
  };

  // ================================================================================================
  //  Tracks
  // ================================================================================================
  // A track is a closed curve through control points (world units; one kart is about 6 wide), a road half
  // width w, and what lies beyond the road edge: 'grass' (slow ground, then a fence), 'wall', or a
  // drop ('void', 'water', 'lava': you fall in and are put back on the road two seconds later).
  // Obstacles are placed along the road: f = 0..1 of the lap, lat = -1 (left edge) .. 1 (right edge).
  //   c cone (knocked over, slows you a little)   t tyre stack / b barrel / r rock (solid, slows a lot)
  //   o oil (spins you)   B boost pad   m moving block [f, amp, seconds, phase]
  //   zones: ['ice', f0, f1] slippery, ['mud', f0, f1, lat0, lat1] slow, ['edge', f0, f1, type] edge override
  const SP = 3;   // spacing of the compiled road samples

  function catmullClosed(P, per) {
    const n = P.length, out = [];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      // centripetal parametrisation: no loops or cusps in sharp turns
      const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
      const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      for (let k = 0; k < per; k++) {
        const t = t1 + (t2 - t1) * k / per;
        const L = (a, b, ta, tb) => [(tb - t) / (tb - ta) * a[0] + (t - ta) / (tb - ta) * b[0], (tb - t) / (tb - ta) * a[1] + (t - ta) / (tb - ta) * b[1]];
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
        const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    return out;
  }
  const OUTER = { grass: 0, wall: 4, void: 0, water: 0, lava: 0 };
  function compile(def) {
    let dense = catmullClosed(def.pts, 48);
    // even spacing
    const resample = (pts, step) => {
      const cum = [0];
      for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
      const total = cum[pts.length], m = Math.round(total / step), sp = total / m, out = [];
      let j = 0;
      for (let i = 0; i < m; i++) {
        const s = i * sp; while (cum[j + 1] < s) j++;
        const a = pts[j], b = pts[(j + 1) % pts.length], t = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
      return { out, total, sp };
    };
    // bends tighter than the road is wide are eased out (the road would fold over itself on the inside)
    let rs = resample(dense, SP);
    const wMax = def.w + 5;
    for (let pass = 0; pass < 80; pass++) {
      const P = rs.out, m = P.length; let tight = 0;
      const ang = i => Math.atan2(P[(i + 1) % m][1] - P[i][1], P[(i + 1) % m][0] - P[i][0]);
      const mark = new Uint8Array(m);
      for (let i = 0; i < m; i++) {
        const k = Math.abs(wrapA(ang((i + 2) % m) - ang((i - 3 + m) % m))) / (5 * rs.sp);
        if (k > 1 / wMax) { tight++; for (let d = -6; d <= 6; d++) mark[(i + d + m) % m] = 1; }
      }
      if (!tight) break;
      const Q = P.map(p => p.slice());
      for (let i = 0; i < m; i++) if (mark[i]) {
        let sx = 0, sy = 0; for (let d = -3; d <= 3; d++) { const q = P[(i + d + m) % m]; sx += q[0]; sy += q[1]; }
        Q[i] = [lerp(P[i][0], sx / 7, 0.6), lerp(P[i][1], sy / 7, 0.6)];
      }
      rs = resample(Q, SP);
    }
    const n = rs.out.length, sp = rs.sp, total = rs.total;
    const X = new Float32Array(n), Y = new Float32Array(n);
    for (let i = 0; i < n; i++) { X[i] = rs.out[i][0]; Y[i] = rs.out[i][1]; }
    const TX = new Float32Array(n), TY = new Float32Array(n), K = new Float32Array(n), A = new Float32Array(n), W = new Float32Array(n), S = new Float32Array(n);
    const E = new Uint8Array(n), Z = new Uint8Array(n);   // edge type, surface zone
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      let tx = X[b] - X[a], ty = Y[b] - Y[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      TX[i] = tx; TY[i] = ty; A[i] = Math.atan2(ty, tx); S[i] = i * sp;
    }
    for (let i = 0; i < n; i++) K[i] = wrapA(A[(i + 3) % n] - A[(i - 3 + n) % n]) / (6 * sp);
    // width, with optional changes along the lap
    const wv = def.wv || [];
    for (let i = 0; i < n; i++) {
      const f = i / n; let w = def.w;
      if (wv.length) {
        const pts = wv.slice().sort((p, q) => p[0] - q[0]);
        let lo = pts[pts.length - 1], hi = pts[0], lf = lo[0] - 1, hf = hi[0];
        for (let k = 0; k < pts.length; k++) { if (pts[k][0] <= f) { lo = pts[k]; lf = pts[k][0]; } }
        for (let k = pts.length - 1; k >= 0; k--) { if (pts[k][0] > f) { hi = pts[k]; hf = pts[k][0]; } }
        if (hi[0] <= f) { hi = pts[0]; hf = pts[0][0] + 1; }
        if (lo[0] > f) { lo = pts[pts.length - 1]; lf = lo[0] - 1; }
        const t = (f - lf) / ((hf - lf) || 1); w = lerp(lo[1], hi[1], clamp(t, 0, 1));
      }
      W[i] = w;
    }
    const ET = { grass: 0, wall: 1, void: 2, water: 3, lava: 4 };
    const inR = (f, f0, f1) => f0 <= f1 ? f >= f0 && f < f1 : f >= f0 || f < f1;
    for (let i = 0; i < n; i++) {
      const f = i / n; let e = def.edge;
      for (const z of def.obs || []) if (z[0] === 'edge' && inR(f, z[1], z[2])) e = z[3];
      E[i] = ET[e];
      for (const z of def.obs || []) {
        if (z[0] === 'ice' && inR(f, z[1], z[2])) Z[i] = 1;
        if (z[0] === 'mud' && inR(f, z[1], z[2])) Z[i] = 2;
      }
    }
    const gw = def.gw || 26;
    // how far from the middle you can go (lim) and what happens there (0 wall, 1 fall)
    const LIM = new Float32Array(n), FALL = new Uint8Array(n), OFF = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const e = E[i];
      if (e === 0) { OFF[i] = W[i]; LIM[i] = W[i] + gw; FALL[i] = 0; }
      else if (e === 1) { OFF[i] = W[i] + 3; LIM[i] = W[i] + 3; FALL[i] = 0; }
      else { OFF[i] = W[i] + 2; LIM[i] = W[i] + 2; FALL[i] = 1; }
    }
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (let i = 0; i < n; i++) { const r = LIM[i] + 10; minx = Math.min(minx, X[i] - r); miny = Math.min(miny, Y[i] - r); maxx = Math.max(maxx, X[i] + r); maxy = Math.max(maxy, Y[i] + r); }
    const tr = { def, n, sp, len: total, X, Y, TX, TY, A, K, W, S, E, Z, LIM, FALL, OFF, gw, minx, miny, maxx, maxy, objs: [], movers: [], pads: [], oils: [] };
    // obstacles
    const at = (f, lat) => { const i = ((Math.round(f * n) % n) + n) % n; const w = W[i] * lat; return { i, x: X[i] - TY[i] * w, y: Y[i] + TX[i] * w }; };
    for (const o of def.obs || []) {
      const k = o[0];
      if (k === 'c' || k === 't' || k === 'b' || k === 'r') { const p = at(o[1], o[2]); tr.objs.push({ k, x: p.x, y: p.y, i: p.i, r: k === 'c' ? 2.2 : k === 'r' ? 5 : 4, solid: k !== 'c' }); }
      else if (k === 'cl') { for (let q = 0; q < o[4]; q++) { const p = at(o[1], lerp(o[2], o[3], o[4] > 1 ? q / (o[4] - 1) : 0.5)); tr.objs.push({ k: 'c', x: p.x, y: p.y, i: p.i, r: 2.2, solid: false }); } }
      else if (k === 'o') { const p = at(o[1], o[2]); tr.oils.push({ x: p.x, y: p.y, i: p.i, r: 5.5 }); }
      else if (k === 'B') { const p = at(o[1], o[2]); tr.pads.push({ x: p.x, y: p.y, i: p.i, a: A[p.i], len: 12, wid: 9 }); }
      else if (k === 'm') { const p = at(o[1], 0); tr.movers.push({ i: p.i, amp: o[2], per: o[3], ph: o[4] || 0, r: 5 }); }
    }
    // the start grid: two columns behind the line, staggered
    tr.grid = [];
    for (let g = 0; g < 6; g++) {
      const back = 12 + g * 9, i = ((Math.round(-back / sp)) % n + n) % n, lat = (g % 2 ? 0.42 : -0.42) * Math.min(W[i], 26) / W[i];
      const w = W[i] * lat; tr.grid.push({ i, x: X[i] - TY[i] * w, y: Y[i] + TX[i] * w, a: A[i], back });
    }
    return tr;
  }
  // nearest road sample to (x, y), searching around a hint (cheap) or everywhere (hint < 0)
  function nearest(tr, x, y, hint) {
    const n = tr.n, X = tr.X, Y = tr.Y;
    let best = -1, bd = 1e18;
    if (hint >= 0) {
      for (let d = -10; d <= 10; d++) { const i = (hint + d + n) % n, dx = x - X[i], dy = y - Y[i], q = dx * dx + dy * dy; if (q < bd) { bd = q; best = i; } }
      // walk further while it keeps getting closer (fast karts, low frame rate)
      for (let dir = -1; dir <= 1; dir += 2) {
        let i = best;
        for (let k = 0; k < 40; k++) { const j = (i + dir + n) % n, dx = x - X[j], dy = y - Y[j], q = dx * dx + dy * dy; if (q < bd) { bd = q; best = j; i = j; } else break; }
      }
    } else {
      for (let i = 0; i < n; i += 4) { const dx = x - X[i], dy = y - Y[i], q = dx * dx + dy * dy; if (q < bd) { bd = q; best = i; } }
      return nearest(tr, x, y, best);
    }
    const dx = x - X[best], dy = y - Y[best];
    return { i: best, lat: -dx * tr.TY[best] + dy * tr.TX[best], along: dx * tr.TX[best] + dy * tr.TY[best] };
  }
  // where a moving block is at race time t (seconds)
  function moverPos(tr, m, t) {
    const lat = Math.sin(TAU * t / m.per + m.ph) * m.amp * tr.W[m.i];
    return { x: tr.X[m.i] - tr.TY[m.i] * lat, y: tr.Y[m.i] + tr.TX[m.i] * lat, lat };
  }
  // checks used by the test script: the road never comes close to another part of itself,
  // and no bend is tighter than the road is wide
  function validate(tr) {
    const out = [];
    const reach = i => tr.LIM[i] + (tr.FALL[i] ? 12 : 6);
    for (let i = 0; i < tr.n; i++) {
      const r = 1 / Math.max(1e-6, Math.abs(tr.K[i]));
      if (r < tr.W[i] + 2) out.push(`bend too tight at ${(i / tr.n).toFixed(3)}: r ${r.toFixed(1)} < w ${tr.W[i].toFixed(0)}+2`);
    }
    let worst = 1e9, wi = 0, wj = 0;
    for (let i = 0; i < tr.n; i += 2) for (let j = i + 2; j < tr.n; j += 2) {
      const ds = Math.min(j - i, tr.n - (j - i)) * tr.sp;
      const need = reach(i) + reach(j);
      if (ds < need * 1.6 + 30) continue;
      const d = Math.hypot(tr.X[i] - tr.X[j], tr.Y[i] - tr.Y[j]);
      if (d - need < worst) { worst = d - need; wi = i; wj = j; }
    }
    if (worst < 4) out.push(`road too close to itself at ${(wi / tr.n).toFixed(3)} / ${(wj / tr.n).toFixed(3)} (gap ${worst.toFixed(1)})`);
    return { errors: out, gap: worst };
  }

  // ================================================================================================
  //  The road picture (texture) of a track, built once when a race starts
  // ================================================================================================
  // The ground outside the track repeats every 64 units, so the same pattern can be used past the edge of
  // the picture without a seam.
  function groundTile(th) {
    const N = 64, t = new Uint32Array(N * N);
    if (th.pat === 'void') return t;   // transparent: the sky shows through
    const a = C32(th.out), b = C32(th.out2);
    const R = seeded(th.ko.length * 977 + th.out.length);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const h = hash2(x * 7 + 3, y * 13 + 1); let c = mix32(a, a, 0);
      switch (th.pat) {
        case 'grass': case 'jungle': c = h < 0.18 ? b : h > 0.94 ? shade32(a, 1.12) : a; break;
        case 'water': { const w = Math.sin((x + Math.sin(y / 9) * 4) / 4 + y / 11); c = w > 0.86 ? shade32(b, 1.25) : w > 0.4 ? b : a; break; }
        case 'sand': { const w = Math.sin(x / 5 + Math.sin(y / 7) * 2); c = w > 0.75 ? b : h > 0.96 ? shade32(a, 0.9) : a; break; }
        case 'snow': c = h < 0.12 ? b : h > 0.985 ? C32('#ffffff') : a; break;
        case 'lava': { const w = Math.sin(x / 6 + Math.cos(y / 5) * 1.6) + Math.sin(y / 8 - x / 13); c = w > 1.1 ? C32('#ffd43b') : w > 0.2 ? b : a; break; }
        case 'city': { const bx = x % 32, by = y % 32; c = (bx < 2 || by < 2) ? C32('#1d2028') : (bx > 8 && bx < 24 && by > 8 && by < 24) ? (h < 0.3 ? C32('#ffd86b') : b) : a; break; }
        case 'grid': c = (x % 16 === 0 || y % 16 === 0) ? C32('#3a1d6e') : a; break;
        case 'petal': c = h < 0.05 ? b : h > 0.97 ? C32('#ffffff') : a; break;
        case 'leaf': c = h < 0.14 ? b : h > 0.92 ? C32('#e8a33a') : a; break;
        case 'candy': { const dx = (x % 16) - 8, dy = (y % 16) - 8; c = dx * dx + dy * dy < 12 ? b : a; break; }
        case 'dark': c = h < 0.06 ? b : h > 0.995 ? C32('#9775fa') : a; break;
        default: c = h < 0.2 ? b : a;
      }
      t[y * N + x] = c;
    }
    return t;
  }

  function buildTexture(tr, th, maxDim) {
    maxDim = maxDim || 1024;
    const pad = 70;
    const ox = tr.minx - pad, oy = tr.miny - pad, ww = tr.maxx - tr.minx + pad * 2, hh = tr.maxy - tr.miny + pad * 2;
    const K = Math.min(1.5, maxDim / Math.max(ww, hh));
    const TW = Math.ceil(ww * K), TH = Math.ceil(hh * K);
    const N = TW * TH;
    const dist = new Float32Array(N).fill(1e9), idx = new Int32Array(N).fill(-1), LAT = new Float32Array(N), ALG = new Float32Array(N);
    const n = tr.n, X = tr.X, Y = tr.Y, TX = tr.TX, TY = tr.TY;
    const st = 0.45 / K;
    for (let i = 0; i < n; i++) {
      const reach = tr.LIM[i] + (tr.FALL[i] ? 6 : 10), kap = Math.abs(tr.K[i]);
      for (let L = -reach; L <= reach; L += st) {
        const half = tr.sp * 0.5 * (1 + Math.abs(L) * kap) + st;
        for (let a = -half; a <= half; a += st) {
          const wx = X[i] + TX[i] * a - TY[i] * L, wy = Y[i] + TY[i] * a + TX[i] * L;
          const tx = ((wx - ox) * K) | 0, ty = ((wy - oy) * K) | 0;
          if (tx < 0 || ty < 0 || tx >= TW || ty >= TH) continue;
          const t = ty * TW + tx, d2 = a * a + L * L;
          if (d2 < dist[t]) { dist[t] = d2; idx[t] = i; LAT[t] = L; ALG[t] = a; }
        }
      }
    }
    const tile = groundTile(th);
    const data = new Uint32Array(N);
    const road = C32(th.road), road2 = C32(th.road2), line = C32(th.line), k1 = C32(th.kerb[0]), k2 = C32(th.kerb[1]);
    const off = C32(th.off), off2 = C32(th.off2), wall = C32(th.wall), wall2 = C32(th.wall2);
    const ice = C32(th.ice || '#cfeaff'), mud = C32(th.mud || '#6b4a32'), mud2 = shade32(mud, 0.8);
    const RB = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa', '#f783ac'].map(c => C32(c));
    const startW = 5, len = tr.len;
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const t = ty * TW + tx, i = idx[t];
      const wx = ox + (tx + 0.5) / K, wy = oy + (ty + 0.5) / K;
      const gx = ((Math.floor(wx) % 64) + 64) % 64, gy = ((Math.floor(wy) % 64) + 64) % 64;
      if (i < 0) { data[t] = tile[gy * 64 + gx]; continue; }
      const lat = LAT[t], d = Math.abs(lat), W = tr.W[i], e = tr.E[i];
      let s = tr.S[i] + ALG[t]; s = ((s % len) + len) % len;
      const h = hash2(Math.floor(wx * 2), Math.floor(wy * 2));
      let c;
      if (d <= W) {
        // the road itself
        if (th.rainbow) { const band = clamp(Math.floor((lat / W + 1) / 2 * 7), 0, 6); c = shade32(RB[band], 0.9 + h * 0.1); }
        else c = h < 0.35 ? road2 : road;
        const z = tr.Z[i];
        if (z === 1) c = h < 0.3 ? shade32(ice, 0.95) : h > 0.97 ? C32('#ffffff') : ice;
        if (z === 2 && d < W - 2) { const m = Math.sin(wx / 3) + Math.cos(wy / 4); c = m > 0.6 ? mud2 : mud; }
        // the dashed middle line
        if (!th.rainbow && d < 0.7 && (s % 24) < 11 && z !== 2) c = line;
        // kerbs at the edge
        if (d > W - 3 && e <= 1) c = (Math.floor(s / 6) % 2) ? k1 : k2;
        if (d > W - 1.5 && e >= 2) c = (Math.floor(s / 6) % 2) ? k1 : k2;
        // start line: a chequered band across the road
        const ds = Math.min(s, len - s);
        if (ds < startW / 2) c = ((Math.floor(lat / 2.5) + Math.floor(s / 2.5)) & 1) ? C32('#ffffff') : C32('#1a1a1a');
      } else if (e === 0) {
        // grass (or sand, snow…) beside the road, then a fence
        const lim = tr.LIM[i];
        if (d <= lim) c = h < 0.25 ? off2 : off;
        else if (d <= lim + 3) c = (Math.floor(s / 4) % 2) ? wall : wall2;
        else c = tile[gy * 64 + gx];
      } else if (e === 1) {
        if (d <= W + 4) c = d <= W + 1 ? wall2 : ((Math.floor(s / 8) % 2) ? wall : shade32(wall, 0.85));
        else c = tile[gy * 64 + gx];
      } else {
        // a drop: a thin lip, then water / lava / nothing
        if (d <= W + 2) c = th.rainbow ? C32('#ffffff') : wall;
        else if (e === 2) c = 0;
        else if (e === 3) c = tile[gy * 64 + gx] || C32('#2a7fb8');
        else c = (h < 0.5 ? C32('#e8590c') : C32('#ff922b'));
        if (e === 3 && th.pat !== 'water') { const w = Math.sin(wx / 4 + wy / 9); c = w > 0.6 ? C32('#5ab0e8') : C32('#2f86c4'); }
        if (e === 4 && th.pat !== 'lava') { const w = Math.sin(wx / 6 + Math.cos(wy / 5) * 1.6); c = w > 0.7 ? C32('#ffd43b') : C32('#e8590c'); }
      }
      data[t] = c;
    }
    // things painted on the road: boost pads, oil, the start grid
    const paint = (cx, cy, a, L, Wd, fn) => {
      const ca = Math.cos(a), sa = Math.sin(a), R = Math.hypot(L, Wd) / 2 + 1;
      for (let y = Math.floor((cy - R - oy) * K); y <= Math.ceil((cy + R - oy) * K); y++) for (let x = Math.floor((cx - R - ox) * K); x <= Math.ceil((cx + R - ox) * K); x++) {
        if (x < 0 || y < 0 || x >= TW || y >= TH) continue;
        const wx = ox + (x + 0.5) / K - cx, wy = oy + (y + 0.5) / K - cy;
        const u = wx * ca + wy * sa, v = -wx * sa + wy * ca;
        if (Math.abs(u) <= L / 2 && Math.abs(v) <= Wd / 2) { const c = fn(u / L + 0.5, v / Wd + 0.5); if (c) data[y * TW + x] = c; }
      }
    };
    const P1 = C32('#ffd43b'), P2 = C32('#ff922b'), P3 = C32('#e8590c');
    for (const p of tr.pads) paint(p.x, p.y, p.a, p.len, p.wid, (u, v) => {
      if (u < 0.06 || u > 0.94 || v < 0.08 || v > 0.92) return P3;
      const ch = ((u * 3) % 1) - Math.abs(v - 0.5) * 0.9;   // three chevrons pointing forward
      return ch > 0.25 && ch < 0.6 ? C32('#fff3bf') : (Math.floor(u * 6) % 2 ? P1 : P2);
    });
    for (const o of tr.oils) paint(o.x, o.y, hash2(o.i, 3) * 6, o.r * 2.2, o.r * 1.7, (u, v) => {
      const dx = u - 0.5, dy = v - 0.5, r = dx * dx + dy * dy;
      return r < 0.2 ? (r < 0.05 && dx < 0 ? C32('#5c4a7a') : C32('#16121e')) : 0;
    });
    for (const g of tr.grid) paint(g.x, g.y, g.a, 8, 7, (u, v) => (u > 0.82 || ((v < 0.1 || v > 0.9) && u > 0.4)) ? C32('#f1f3f5') : 0);
    // smaller copies for far away (less shimmering)
    const mips = [{ w: TW, h: TH, d: data }];
    for (let l = 1; l < 3; l++) {
      const s = mips[l - 1], w = s.w >> 1, h = s.h >> 1, d = new Uint32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a = s.d[(y * 2) * s.w + x * 2], b = s.d[(y * 2) * s.w + x * 2 + 1], c = s.d[(y * 2 + 1) * s.w + x * 2], e = s.d[(y * 2 + 1) * s.w + x * 2 + 1];
        const al = ((a >>> 24) ? 1 : 0) + ((b >>> 24) ? 1 : 0) + ((c >>> 24) ? 1 : 0) + ((e >>> 24) ? 1 : 0);
        if (al < 2) { d[y * w + x] = 0; continue; }
        let r = 0, g = 0, bb = 0, k = 0;
        for (const q of [a, b, c, e]) if (q >>> 24) { r += q & 255; g += (q >> 8) & 255; bb += (q >> 16) & 255; k++; }
        d[y * w + x] = ((255 << 24) >>> 0) + (Math.round(bb / k) << 16) + (Math.round(g / k) << 8) + Math.round(r / k);
      }
      mips.push({ w, h, d });
    }
    return { ox, oy, K, w: TW, h: TH, data, mips, tile };
  }

  // roadside things (trees, lamps…) placed outside the fence, never on another part of the road
  function placeProps(tr, th, seed) {
    const R = seeded(seed), out = [];
    if (!th.props || !th.props.length) return out;
    // a coarse grid of road samples to check "is this spot near any road"
    const cell = 40, grid = new Map(), key = (x, y) => (Math.floor(x / cell) * 73856093) ^ (Math.floor(y / cell) * 19349663);
    for (let i = 0; i < tr.n; i += 2) { const k = key(tr.X[i], tr.Y[i]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
    const clear = (x, y, need) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const l = grid.get(key(x + dx * cell, y + dy * cell)); if (!l) continue;
        for (const i of l) { const d = Math.hypot(x - tr.X[i], y - tr.Y[i]); if (d < tr.LIM[i] + need) return false; }
      }
      return true;
    };
    const step = th.pat === 'void' ? 34 : 15;
    for (let i = 0; i < tr.n; i += Math.max(1, Math.round(step / tr.sp))) {
      for (const side of [-1, 1]) {
        if (R() < 0.25) continue;
        const e = tr.E[i];
        let lat;
        if (e >= 2) { if (th.pat !== 'void' && e !== 3) continue; lat = side * (tr.W[i] + 2.6); if (th.pat !== 'void' || R() < 0.5) continue; }
        else lat = side * (tr.LIM[i] + 6 + R() * 26);
        const x = tr.X[i] - tr.TY[i] * lat, y = tr.Y[i] + tr.TX[i] * lat;
        const lip = e >= 2;
        if (!lip && !clear(x, y, 5)) continue;
        if (lip && !clear(x, y, -1)) continue;
        out.push({ k: lip ? (th.props.includes('beacon') ? 'beacon' : th.props[0]) : th.props[(R() * th.props.length) | 0], x, y, s: 0.85 + R() * 0.4 });
      }
    }
    return out;
  }

  // lv: 1 하 · 2 중 · 3 상 ; hard: a really hard one among the 상 maps
  const MAPS = [
    { id: 'meadow', name: '새싹 초원', lv: 1, th: 'meadow', laps: 3, w: 27, edge: 'grass', sc: 1.35,
      pts: [[200, 600], [500, 600], [700, 580], [780, 480], [760, 360], [640, 320], [520, 360], [420, 300], [380, 180], [260, 140], [150, 200], [120, 340], [140, 480]], obs: [['B', 0.14, 0], ['c', 0.3, -0.45], ['c', 0.32, 0.4], ['t', 0.47, 0.75], ['B', 0.6, 0.35], ['c', 0.74, 0], ['c', 0.76, -0.5], ['B', 0.88, -0.2]] },
    { id: 'beach', name: '햇살 해변', lv: 1, th: 'beach', laps: 3, w: 27, edge: 'grass', sc: 1.3,
      pts: [[150, 500], [450, 520], [700, 500], [820, 420], [800, 300], [680, 260], [560, 300], [460, 240], [380, 140], [240, 120], [130, 200], [100, 350]], obs: [['B', 0.1, 0.3], ['r', 0.27, -0.6], ['c', 0.4, 0.2], ['c', 0.42, -0.3], ['B', 0.55, 0], ['r', 0.66, 0.55], ['c', 0.8, -0.4], ['c', 0.82, 0.35], ['B', 0.92, 0]] },
    { id: 'sakura', name: '벚꽃 공원', lv: 1, th: 'sakura', laps: 3, w: 27, edge: 'grass', sc: 1.15,
      pts: [[300, 650], [600, 650], [760, 600], [800, 480], [740, 380], [600, 360], [560, 260], [640, 160], [560, 80], [420, 100], [380, 220], [300, 320], [180, 360], [120, 480], [170, 600]], obs: [['B', 0.1, 0], ['c', 0.22, 0.5], ['c', 0.24, -0.1], ['t', 0.36, -0.7], ['c', 0.48, 0.3], ['c', 0.5, -0.4], ['B', 0.62, 0.3], ['t', 0.76, 0.6], ['c', 0.87, -0.3], ['c', 0.89, 0.3]] },
    { id: 'city', name: '도심 야경', lv: 1, th: 'city', laps: 3, w: 27, edge: 'wall', sc: 1.2,
      pts: [[200, 700], [500, 700], [700, 700], [760, 640], [760, 420], [700, 360], [520, 360], [460, 300], [460, 160], [400, 100], [200, 100], [140, 160], [140, 640]], obs: [['B', 0.08, 0], ['b', 0.2, 0.55], ['c', 0.33, -0.3], ['c', 0.35, 0.3], ['B', 0.45, -0.3], ['b', 0.57, -0.55], ['o', 0.68, 0.35], ['c', 0.8, 0], ['B', 0.9, 0.3]] },
    { id: 'canyon', name: '모래 협곡', lv: 1, th: 'canyon', laps: 3, w: 27, edge: 'grass', sc: 1.15,
      pts: [[150, 600], [350, 640], [550, 580], [750, 620], [850, 520], [800, 400], [650, 380], [700, 260], [600, 150], [450, 200], [350, 120], [200, 150], [120, 300], [200, 420], [110, 500]], obs: [['B', 0.12, 0], ['r', 0.24, 0.5], ['r', 0.3, -0.5], ['c', 0.41, 0], ['B', 0.52, -0.3], ['r', 0.63, 0.3], ['c', 0.72, -0.4], ['c', 0.74, 0.4], ['r', 0.84, 0], ['B', 0.93, 0.2]] },
    { id: 'autumn', name: '단풍 산책로', lv: 1, th: 'autumn', laps: 3, w: 27, edge: 'grass', sc: 1.2,
      pts: [[200, 700], [500, 720], [700, 650], [650, 540], [480, 520], [450, 420], [620, 380], [720, 280], [620, 160], [420, 150], [300, 240], [320, 360], [200, 450], [120, 560]], obs: [['B', 0.1, -0.2], ['c', 0.2, 0.4], ['t', 0.28, -0.5], ['c', 0.38, 0.1], ['B', 0.5, 0.3], ['c', 0.58, -0.4], ['c', 0.6, 0.4], ['t', 0.7, 0.6], ['o', 0.8, -0.3], ['B', 0.9, 0]] },

    { id: 'snow', name: '눈꽃 언덕', lv: 2, th: 'snow', laps: 3, w: 23, edge: 'grass', sc: 1.15,
      pts: [[200, 650], [480, 680], [700, 620], [780, 500], [700, 420], [560, 450], [460, 380], [520, 260], [680, 220], [720, 120], [560, 60], [360, 90], [260, 200], [300, 320], [180, 420], [130, 540]], obs: [['B', 0.1, 0], ['ice', 0.26, 0.38], ['c', 0.3, 0.4], ['t', 0.45, -0.55], ['B', 0.52, 0.3], ['ice', 0.62, 0.72], ['c', 0.66, -0.3], ['c', 0.68, 0.3], ['t', 0.8, 0.5], ['r', 0.88, -0.5], ['B', 0.94, 0]] },
    { id: 'jungle', name: '정글 진흙길', lv: 2, th: 'jungle', laps: 3, w: 23, edge: 'wall', sc: 1.15,
      pts: [[150, 620], [400, 650], [560, 560], [700, 600], [820, 520], [780, 380], [640, 330], [540, 400], [420, 330], [470, 200], [380, 110], [230, 130], [160, 250], [250, 360], [180, 470]], obs: [['B', 0.08, 0], ['mud', 0.18, 0.26], ['t', 0.3, 0.5], ['t', 0.34, -0.5], ['B', 0.42, 0], ['mud', 0.52, 0.6], ['c', 0.64, 0.3], ['c', 0.66, -0.3], ['r', 0.76, 0.4], ['o', 0.84, -0.3], ['B', 0.92, 0.3]] },
    { id: 'harbor', name: '항구 부두', lv: 2, th: 'harbor', laps: 3, w: 23, edge: 'wall', sc: 1.1,
      pts: [[150, 700], [450, 700], [650, 700], [720, 630], [700, 520], [580, 480], [580, 360], [700, 300], [720, 160], [620, 90], [420, 100], [350, 200], [400, 320], [300, 420], [160, 460], [110, 580]], obs: [['B', 0.1, 0], ['edge', 0.04, 0.24, 'water'], ['b', 0.28, -0.5], ['b', 0.36, 0.5], ['edge', 0.45, 0.6, 'water'], ['B', 0.5, -0.3], ['o', 0.66, 0.3], ['b', 0.75, -0.4], ['edge', 0.82, 0.95, 'water'], ['c', 0.88, 0.2]] },
    { id: 'candy', name: '과자 공장', lv: 2, th: 'candy', laps: 3, w: 23, edge: 'wall', sc: 1.15,
      pts: [[200, 650], [450, 650], [620, 600], [620, 480], [500, 430], [500, 320], [650, 280], [720, 160], [580, 90], [380, 110], [300, 220], [200, 300], [160, 420], [260, 520], [140, 580]], obs: [['B', 0.08, 0], ['m', 0.22, 0.7, 3.2, 0], ['c', 0.33, 0.4], ['c', 0.35, -0.4], ['B', 0.45, 0], ['m', 0.55, 0.7, 2.6, 1.5], ['t', 0.66, 0.5], ['m', 0.78, 0.7, 3.0, 3], ['B', 0.9, -0.3]] },
    { id: 'neon', name: '네온 시티', lv: 2, th: 'neon', laps: 3, w: 23, edge: 'wall', sc: 1.15,
      pts: [[150, 700], [400, 700], [600, 680], [700, 580], [620, 480], [700, 400], [760, 280], [660, 180], [520, 200], [440, 120], [300, 100], [200, 180], [260, 300], [180, 400], [100, 520]], obs: [['B', 0.08, 0.3], ['o', 0.18, -0.3], ['b', 0.27, 0.5], ['c', 0.36, 0], ['B', 0.45, -0.3], ['o', 0.55, 0.3], ['b', 0.64, -0.5], ['m', 0.74, 0.7, 2.8, 0], ['o', 0.86, 0], ['B', 0.93, 0]] },
    { id: 'volcano', name: '화산 분화구', lv: 2, th: 'volcano', laps: 3, w: 23, edge: 'wall', sc: 1.15,
      pts: [[200, 650], [450, 700], [650, 640], [760, 520], [700, 380], [560, 360], [480, 260], [560, 150], [420, 80], [260, 120], [200, 240], [300, 330], [250, 450], [130, 520]], obs: [['B', 0.08, 0], ['r', 0.2, 0.5], ['edge', 0.28, 0.46, 'lava'], ['r', 0.36, -0.4], ['B', 0.5, 0.3], ['r', 0.6, -0.5], ['r', 0.64, 0.5], ['edge', 0.72, 0.88, 'lava'], ['o', 0.8, 0], ['B', 0.93, 0]] },

    { id: 'glacier', name: '빙하 미로', lv: 3, th: 'glacier', laps: 3, w: 19, edge: 'wall', sc: 1.1,
      pts: [[150, 650], [400, 680], [600, 640], [650, 540], [540, 480], [620, 400], [760, 380], [800, 260], [700, 180], [560, 220], [460, 150], [480, 60], [330, 50], [250, 140], [330, 240], [260, 330], [140, 360], [90, 480]], obs: [['B', 0.08, 0], ['ice', 0.14, 0.34], ['t', 0.24, 0.5], ['c', 0.3, -0.4], ['B', 0.42, 0], ['ice', 0.5, 0.72], ['t', 0.58, -0.5], ['c', 0.66, 0.3], ['c', 0.68, -0.3], ['r', 0.82, 0.4], ['B', 0.92, -0.2]] },
    { id: 'construct', name: '공사장', lv: 3, th: 'construct', laps: 3, w: 19, edge: 'wall', sc: 1.1,
      pts: [[200, 700], [450, 700], [620, 690], [700, 600], [620, 520], [680, 430], [600, 350], [680, 260], [620, 160], [480, 140], [420, 240], [320, 200], [300, 100], [180, 90], [100, 200], [180, 320], [120, 440], [150, 580]], obs: [['B', 0.07, 0], ['cl', 0.16, -0.7, 0.2, 4], ['b', 0.24, 0.5], ['m', 0.32, 0.75, 2.4, 0], ['cl', 0.42, -0.2, 0.7, 4], ['B', 0.5, 0], ['b', 0.58, -0.5], ['m', 0.66, 0.75, 2.2, 2], ['t', 0.75, 0.55], ['cl', 0.84, -0.7, 0.2, 4], ['B', 0.92, 0.3]] },
    { id: 'cave', name: '수정 동굴', lv: 3, th: 'cave', laps: 3, w: 19, edge: 'wall', sc: 1.1,
      pts: [[150, 600], [350, 640], [500, 580], [620, 640], [760, 600], [780, 480], [680, 420], [740, 320], [680, 200], [540, 180], [480, 280], [380, 240], [380, 130], [250, 100], [160, 200], [240, 300], [170, 400], [90, 480]], obs: [['B', 0.08, 0], ['r', 0.17, -0.5], ['r', 0.22, 0.5], ['o', 0.3, 0], ['m', 0.4, 0.7, 2.6, 0], ['B', 0.48, 0], ['r', 0.57, 0.4], ['o', 0.65, -0.3], ['m', 0.74, 0.7, 2.3, 1], ['r', 0.84, -0.5], ['B', 0.92, 0.2]] },
    { id: 'space', name: '우주 정거장', lv: 3, hard: 1, th: 'space', laps: 3, w: 19, edge: 'void', sc: 1.1,
      pts: [[200, 650], [450, 680], [620, 620], [650, 500], [540, 440], [560, 320], [700, 300], [760, 180], [640, 100], [480, 140], [400, 260], [300, 200], [280, 90], [150, 110], [100, 250], [200, 360], [120, 470]], obs: [['B', 0.07, 0], ['m', 0.16, 0.7, 2.6, 0], ['B', 0.26, 0.3], ['m', 0.36, 0.7, 2.2, 1.2], ['c', 0.46, 0.4], ['c', 0.48, -0.4], ['m', 0.57, 0.75, 2.4, 2.4], ['B', 0.66, -0.3], ['m', 0.76, 0.7, 2.0, 0.6], ['o', 0.86, 0], ['B', 0.93, 0]] },
    { id: 'cliff', name: '아찔한 절벽길', lv: 3, hard: 1, th: 'cliff', laps: 2, w: 18, edge: 'void', sc: 1.1,
      pts: [[150, 700], [420, 720], [600, 660], [560, 560], [420, 540], [460, 440], [620, 440], [720, 360], [660, 250], [520, 260], [480, 150], [600, 80], [420, 40], [260, 80], [220, 200], [320, 300], [200, 380], [110, 500]], obs: [['B', 0.07, 0], ['edge', 0.0, 0.12, 'wall'], ['r', 0.2, 0.45], ['o', 0.3, -0.3], ['edge', 0.4, 0.5, 'wall'], ['B', 0.45, 0], ['r', 0.56, -0.45], ['m', 0.66, 0.7, 2.4, 0], ['o', 0.76, 0.3], ['r', 0.86, 0], ['B', 0.94, 0]] },
    { id: 'rainbow', name: '무지개 하늘길', lv: 3, hard: 2, th: 'rainbow', laps: 2, w: 15, edge: 'void', sc: 1.15,
      pts: [[200, 600], [420, 640], [560, 560], [500, 460], [380, 480], [300, 400], [380, 300], [540, 320], [660, 260], [620, 150], [480, 120], [360, 60], [220, 100], [150, 220], [220, 330], [120, 420], [110, 520]], obs: [['B', 0.06, 0], ['m', 0.14, 0.75, 2.2, 0], ['B', 0.22, 0], ['m', 0.3, 0.75, 1.9, 1], ['m', 0.4, 0.75, 2.1, 2.2], ['B', 0.48, 0], ['o', 0.56, 0.3], ['m', 0.64, 0.75, 1.8, 0.4], ['m', 0.73, 0.75, 2.3, 1.7], ['B', 0.8, 0], ['m', 0.87, 0.75, 2.0, 2.8], ['B', 0.95, 0]] }
  ];
  for (const m of MAPS) if (m.sc && !m._sc) { m.pts = m.pts.map(([x, y]) => [Math.round(x * m.sc), Math.round(y * m.sc)]); m._sc = 1; }
  const MAP_BY = {}; MAPS.forEach(m => { MAP_BY[m.id] = m; });

  // ================================================================================================
  //  Driving
  // ================================================================================================
  // Speeds are world units per second (a kart is about 8 long). Every kart is the same; only the colour differs.
  const PH = {
    base: 92,        // top speed at the start
    cap: 126,        // top speed after a long clean run (no bumps): it creeps up while you avoid things
    streakTime: 11,  // seconds of clean driving from base to cap
    acc: 72, coast: 26, brake: 150, rev: 30,
    turn: 2.35, driftMin: 42,
    pad: 0.9, padAdd: 38,                       // boost pad: seconds, extra speed
    mini: [[0.42, 20], [0.66, 28]],             // mini boost after a drift (charge level 1 / 2): seconds, extra speed
    miniWin: 0.5, charge1: 0.5, charge2: 1.15,  // the window to press ↑ again, drift time for level 1 / 2
    kartR: 2.7
  };
  const EMPTY_IN = { steer: 0, thr: 0, brake: 0, drift: false, evUp: false, evDrift: false };

  function newKart(tr, slot) {
    const g = tr.grid[slot % tr.grid.length];
    return {
      x: g.x, y: g.y, a: g.a, m: g.a, v: 0, i: g.i, prog: g.i - tr.n, lapMax: -1, lapAt: 0, laps: [],
      streak: 0, boostT: 0, boostCap: 0, miniWin: 0, miniLvl: 0, drift: null, spinT: 0, fallT: 0, hitT: 0, safeT: 0,
      slip: 0, off: false, wrongT: 0, fin: 0, z: 0, noDrift: false, lastHit: -9, bump: 0, sparkT: 0
    };
  }
  // pushes the kart back inside the walls and tells what happened
  function stepKart(k, inp, dt, t, ctx) {
    const tr = ctx.tr;
    if (k.fallT > 0) {
      k.fallT -= dt; k.z = Math.min(k.z + dt * 30, 40);
      if (k.fallT <= 0) {
        // back on the road a little behind where you fell, standing still
        const i = (k.i - 3 + tr.n) % tr.n;
        k.prog -= 3; k.i = i; k.x = tr.X[i]; k.y = tr.Y[i]; k.a = k.m = tr.A[i]; k.v = 0; k.z = 0; k.safeT = 1.2; k.drift = null; k.boostT = 0; k.spinT = 0;
        ctx.fx('respawn', k);
      }
      return;
    }
    if (k.safeT > 0) k.safeT -= dt;
    let thr = inp.thr, brk = inp.brake, st = inp.steer, dr = inp.drift;
    if (k.spinT > 0) { k.spinT -= dt; thr = 0; st = 0; dr = false; brk = 0; }
    const nr = nearest(tr, k.x, k.y, k.i);
    const di = nr.i - k.i; k.prog += di > tr.n / 2 ? di - tr.n : di < -tr.n / 2 ? di + tr.n : di; k.i = nr.i;
    const i = nr.i, d = Math.abs(nr.lat), onRoad = d <= tr.W[i];
    const zone = onRoad ? tr.Z[i] : 0;
    k.off = !onRoad && tr.E[i] === 0;
    // how fast you may go right now
    let top = PH.base + (PH.cap - PH.base) * k.streak;
    if (k.off) top *= 0.5;
    if (zone === 2) top *= 0.55;
    if (k.boostT > 0) { k.boostT -= dt; top = Math.max(top, k.boostCap); }
    if (k.miniWin > 0) k.miniWin -= dt;
    // mini boost: ↑ (or the drift button) pressed again right after a drift
    if (k.miniWin > 0 && (inp.evUp || inp.evDrift) && k.v > 20) {
      const [sec, add] = PH.mini[k.miniLvl - 1];
      k.boostT = Math.max(k.boostT, sec); k.boostCap = PH.base + (PH.cap - PH.base) * k.streak + add; k.v = Math.max(k.v, k.boostCap - add * 0.4);
      k.miniWin = 0; if (inp.evDrift) k.noDrift = true; ctx.fx('mini', k, k.miniLvl);
    }
    if (!dr) k.noDrift = false;
    // speed
    if (brk) { if (k.v > 0) k.v = Math.max(0, k.v - PH.brake * dt); else k.v = Math.max(-PH.rev, k.v - 45 * dt); }
    else if (thr > 0 && k.v < top * thr) k.v = Math.min(top * thr, k.v + PH.acc * dt * (1 - 0.5 * Math.max(0, k.v) / top) + (k.v < 0 ? PH.brake * dt : 0));
    else if (k.v > top) k.v = Math.max(top, k.v - Math.max(30, (k.v - top) * 1.6) * dt);
    else if (!thr) k.v = k.v > 0 ? Math.max(0, k.v - PH.coast * dt) : Math.min(0, k.v + PH.coast * dt);
    // clean driving builds up the top speed; leaving the road or bumping into things costs it
    if (thr > 0.5 && onRoad && zone !== 2 && k.v > PH.base * 0.6 && t - k.lastHit > 1.5) k.streak = Math.min(1, k.streak + dt / PH.streakTime);
    if (k.off) k.streak = Math.max(0, k.streak - dt * 0.12);
    // drift
    const sp = Math.abs(k.v);
    if (!k.drift && dr && !k.noDrift && Math.abs(st) > 0.3 && k.v > PH.driftMin && k.spinT <= 0) { k.drift = { dir: Math.sign(st), ch: 0 }; ctx.fx('drift0', k); }
    let w;
    if (k.drift) {
      const D = k.drift, s = st * D.dir;
      w = D.dir * Math.max(0.3, 1.45 + 1.15 * s);
      k.v -= k.v * 0.1 * dt; D.ch += dt;
      if (!dr || k.v < 28 || k.spinT > 0) {
        const lvl = D.ch >= PH.charge2 ? 2 : D.ch >= PH.charge1 ? 1 : 0;
        if (lvl && dr === false && k.spinT <= 0) { k.miniWin = PH.miniWin; k.miniLvl = lvl; ctx.fx('ready', k, lvl); }
        k.drift = null;
      }
    } else {
      w = st * PH.turn * Math.min(1, sp / 26) * (1 - 0.28 * Math.min(1, sp / 150));
      if (k.v < 0) w = -w;
    }
    k.a = wrapA(k.a + w * dt);
    // the direction of travel follows the nose: at once on the road, slowly on ice or in a drift
    const grip = zone === 1 ? (k.drift ? 1.6 : 2.4) : k.drift ? 5.5 : 16;
    k.m = wrapA(k.m + wrapA(k.a - k.m) * Math.min(1, grip * dt));
    const slipT = k.drift ? k.drift.dir * 0.32 : 0;
    k.slip += (slipT - k.slip) * Math.min(1, dt * 8);
    k.x += Math.cos(k.m) * k.v * dt; k.y += Math.sin(k.m) * k.v * dt;
    // walls and drops
    const n2 = nearest(tr, k.x, k.y, k.i), j = n2.i, d2 = Math.abs(n2.lat), lim = tr.LIM[j];
    if (tr.FALL[j]) {
      if (d2 > lim + 0.5 && k.safeT <= 0) { k.fallT = 1.1; k.drift = null; k.v *= 0.3; k.streak = Math.max(0, k.streak - 0.5); k.lastHit = t; ctx.fx('fall', k); return; }
      if (d2 > lim + 0.5) { const s = Math.sign(n2.lat), L2 = lim - 0.5; k.x = tr.X[j] + tr.TX[j] * n2.along - tr.TY[j] * s * L2; k.y = tr.Y[j] + tr.TY[j] * n2.along + tr.TX[j] * s * L2; }
    } else if (d2 > lim - PH.kartR) {
      const s = Math.sign(n2.lat), L2 = lim - PH.kartR;
      k.x = tr.X[j] + tr.TX[j] * n2.along - tr.TY[j] * s * L2; k.y = tr.Y[j] + tr.TY[j] * n2.along + tr.TX[j] * s * L2;
      let rel = wrapA(k.m - tr.A[j]); if (k.v < 0) rel = wrapA(rel + Math.PI);
      const into = Math.sin(rel) * s;            // > 0: heading into this wall
      const vin = Math.abs(k.v) * Math.max(0, into);
      if (vin > 14 && t - k.lastHit > 0.25) {
        k.v *= 1 - clamp(vin / 85, 0.18, 0.55); k.streak = Math.max(0, k.streak - 0.45); k.lastHit = t; k.hitT = 0.35; k.drift = null;
        const back = wrapA(tr.A[j] + (k.v < 0 ? Math.PI : 0) - rel * 0.35); k.m = back; k.a = wrapA(back + rel * 0.1);
        ctx.fx('wall', k, vin);
      } else if (into > 0) {
        k.v -= k.v * 0.9 * dt;
        k.m = wrapA(tr.A[j] + (k.v < 0 ? Math.PI : 0) + rel * 0.5); k.sparkT = 0.1;
      }
    }
    { const dj = j - k.i; k.prog += dj > tr.n / 2 ? dj - tr.n : dj < -tr.n / 2 ? dj + tr.n : dj; k.i = j; }
    // obstacles
    for (const o of tr.objs) {
      if (Math.abs(o.i - j) > 30 && Math.abs(o.i - j) < tr.n - 30) continue;
      if (ctx.knocked.has(o)) continue;
      const dx = k.x - o.x, dy = k.y - o.y, dd = Math.hypot(dx, dy), need = o.r + PH.kartR;
      if (dd >= need) continue;
      if (!o.solid) {
        ctx.knocked.set(o, { t, vx: Math.cos(k.m) * k.v * 0.9 + dx * -3, vy: Math.sin(k.m) * k.v * 0.9 + dy * -3 });
        k.v *= 0.78; k.streak = Math.max(0, k.streak - 0.3); k.lastHit = t; k.hitT = 0.2; ctx.fx('cone', k);
      } else bounce(k, dx, dy, dd, need, t, ctx, 0.5);
    }
    for (const m of tr.movers) {
      if (Math.abs(m.i - j) > 30 && Math.abs(m.i - j) < tr.n - 30) continue;
      const p = moverPos(tr, m, t), dx = k.x - p.x, dy = k.y - p.y, dd = Math.hypot(dx, dy), need = m.r + PH.kartR;
      if (dd < need) bounce(k, dx, dy, dd, need, t, ctx, 0.45);
    }
    for (const o of tr.oils) {
      if (k.spinT > 0 || k.boostT > 0.2) continue;
      if (Math.hypot(k.x - o.x, k.y - o.y) < o.r) { k.spinT = 0.85; k.v *= 0.7; k.drift = null; k.streak = Math.max(0, k.streak - 0.3); k.lastHit = t; ctx.fx('oil', k); }
    }
    for (const p of tr.pads) {
      const dx = k.x - p.x, dy = k.y - p.y, u = dx * Math.cos(p.a) + dy * Math.sin(p.a), vv = -dx * Math.sin(p.a) + dy * Math.cos(p.a);
      if (Math.abs(u) < p.len / 2 + 1 && Math.abs(vv) < p.wid / 2 + 1) {
        if (k.boostT < PH.pad - 0.1) ctx.fx('pad', k);
        k.boostT = Math.max(k.boostT, PH.pad); k.boostCap = PH.cap + PH.padAdd; k.v = Math.max(k.v, PH.base + 10);
      }
    }
    // other karts: pushed apart; the one behind loses a little
    for (const r of ctx.others) {
      const dx = k.x - r.x, dy = k.y - r.y, dd = Math.hypot(dx, dy), need = PH.kartR * 2;
      if (dd >= need || dd < 0.01 || r.fall) continue;
      const push = (need - dd) * 0.6; k.x += dx / dd * push; k.y += dy / dd * push;
      const ahead = (r.x - k.x) * Math.cos(k.m) + (r.y - k.y) * Math.sin(k.m);
      if (ahead > 0 && k.v > r.v) { k.v = lerp(k.v, r.v, 0.3); if (t - k.lastHit > 0.5) { ctx.fx('kart', k); k.lastHit = t - 1.2; } }
    }
    // going the wrong way?
    const fwd = Math.cos(k.m - tr.A[k.i]);
    k.wrongT = fwd < -0.3 && k.v > 12 ? k.wrongT + dt : Math.max(0, k.wrongT - dt * 2);
    if (k.hitT > 0) k.hitT -= dt;
    if (k.sparkT > 0) k.sparkT -= dt;
  }
  function bounce(k, dx, dy, dd, need, t, ctx, keep) {
    dd = dd || 0.01; const nx = dx / dd, ny = dy / dd;
    k.x += nx * (need - dd + 0.2); k.y += ny * (need - dd + 0.2);
    const vin = -(Math.cos(k.m) * nx + Math.sin(k.m) * ny) * k.v;
    if (vin > 8 && t - k.lastHit > 0.3) {
      k.v *= keep; k.streak = Math.max(0, k.streak - 0.55); k.lastHit = t; k.hitT = 0.4; k.drift = null;
      // turn away from what you hit
      const tx = -ny, ty = nx, along = Math.cos(k.m) * tx + Math.sin(k.m) * ty;
      k.m = Math.atan2(ty * Math.sign(along || 1) * 0.8 + ny * 0.6, tx * Math.sign(along || 1) * 0.8 + nx * 0.6);
      k.a = wrapA(lerp(k.a, k.a + wrapA(k.m - k.a), 0.5));
      ctx.fx('bump', k, vin);
    }
  }
  // a simple driver for the computer: aim a little way down the road, steer round what is in the way
  function autoDrive(k, tr, t, knocked, skill) {
    skill = skill == null ? 1 : skill;
    const look = Math.round((10 + Math.max(0, k.v) * 0.32) / tr.sp), n = tr.n;
    const ti = (k.i + look) % n;
    let lat = 0;
    for (const o of tr.objs) { if (knocked && knocked.has(o)) continue; const di = (o.i - k.i + n) % n; if (di > 2 && di < look + 14) { const ol = -(o.x - tr.X[o.i]) * tr.TY[o.i] + (o.y - tr.Y[o.i]) * tr.TX[o.i]; lat = ol > 0 ? ol - o.r - 6 : ol + o.r + 6; } }
    for (const o of tr.oils) { const di = (o.i - k.i + n) % n; if (di > 2 && di < look + 14) { const ol = -(o.x - tr.X[o.i]) * tr.TY[o.i] + (o.y - tr.Y[o.i]) * tr.TX[o.i]; lat = ol > 0 ? ol - o.r - 6 : ol + o.r + 6; } }
    for (const m of tr.movers) { const di = (m.i - k.i + n) % n; if (di > 0 && di < look + 20) { const p = moverPos(tr, m, t + di * tr.sp / Math.max(30, k.v)); lat = p.lat > 0 ? p.lat - 12 : p.lat + 12; } }
    lat = clamp(lat, -tr.W[ti] + 5, tr.W[ti] - 5);
    const tx = tr.X[ti] - tr.TY[ti] * lat, ty = tr.Y[ti] + tr.TX[ti] * lat;
    const want = Math.atan2(ty - k.y, tx - k.x), diff = wrapA(want - k.a);
    const curve = Math.abs(wrapA(tr.A[(k.i + look * 2) % n] - tr.A[k.i]));
    const steer = clamp(diff * 2.6, -1, 1) * skill;
    return { steer, thr: curve > 1.4 && k.v > 80 ? 0.6 : 1, brake: 0, drift: Math.abs(diff) > 0.38 && k.v > 60 && skill > 0.8, evUp: !!(k.miniWin > 0 && Math.random() < 0.3), evDrift: false };
  }

  const CORE = { THEMES, MAPS, MAP_BY, compile, nearest, moverPos, validate, buildTexture, placeProps, groundTile, C32, mix32, shade32, hash2, seeded, clamp, lerp, wrapA, TAU, SP, PH, newKart, stepKart, autoDrive };
  root.ONL_RACE_CORE = CORE;

  // ================================================================================================
  //  GAME (browser only from here on)
  // ================================================================================================
  if (!root.document) return;
  const doc = root.document;
  const mk = (w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
  const R4 = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  // ---------------- roadside things and obstacles: small pixel pictures, h = height in world units ----------------
  // Each one is drawn once into a little canvas; the bottom middle of the canvas stands on the ground.
  const ART = {};
  function art(k) {
    if (ART[k]) return ART[k];
    let c, h;
    const outline = (cv, col) => {   // a 1-pixel dark outline round the shape
      const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height), a = d.data, W = cv.width, H = cv.height, o = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o[y * W + x] = a[(y * W + x) * 4 + 3] > 0 ? 1 : 0;
      const [r, gg, b] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (o[y * W + x]) continue;
        if ((x > 0 && o[y * W + x - 1]) || (x < W - 1 && o[y * W + x + 1]) || (y > 0 && o[(y - 1) * W + x]) || (y < H - 1 && o[(y + 1) * W + x])) { const i = (y * W + x) * 4; a[i] = r; a[i + 1] = gg; a[i + 2] = b; a[i + 3] = 255; }
      }
      g.putImageData(d, 0, 0); return cv;
    };
    const blob = (g, cx, cy, r, c1, c2, seed) => {   // a round crown with a lit side
      const R = seeded(seed);
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const q = (x * x + y * y) / (r * r) + (R() - 0.5) * 0.25;
        if (q <= 1) R4(g, cx + x, cy + y, 1, 1, (x + y < -r * 0.3 && R() < 0.8) ? c2 : c1);
      }
    };
    const tri = (g, cx, top, bot, w, c1, c2) => { for (let y = top; y <= bot; y++) { const hw = Math.round((y - top) / (bot - top) * w); R4(g, cx - hw, y, hw + 1, 1, c1); R4(g, cx + 1, y, hw, 1, c2); } };
    switch (k) {
      case 'tree': case 'tree2': case 'sakura': case 'maple': case 'jtree': {
        const big = k === 'tree2' || k === 'jtree';
        c = mk(28, big ? 40 : 34); const g = c.getContext('2d'); h = big ? 34 : 26;
        const H = c.height; R4(g, 12, H - 14, 4, 14, '#6b4a32'); R4(g, 12, H - 14, 1, 14, '#8a5a3b');
        const cols = { tree: ['#3f9a3c', '#6cc04a'], tree2: ['#2f7d32', '#4fa64a'], sakura: ['#f2a0c0', '#ffd0e2'], maple: ['#d9480f', '#ff922b'], jtree: ['#2b8a3e', '#51cf66'] }[k];
        if (k === 'jtree') { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.6; for (let r = 0; r < 13; r++) R4(g, 14 + Math.round(Math.cos(a) * r), 12 + Math.round(Math.sin(a) * r * 0.6) + Math.round(r * r / 22), 2, 2, r > 9 ? cols[1] : cols[0]); } }
        else blob(g, 14, big ? 14 : 12, big ? 13 : 11, cols[0], cols[1], k.length * 31);
        outline(c, '#1d2a1a'); break;
      }
      case 'pine': case 'pine2': {
        c = mk(22, 38); const g = c.getContext('2d'); h = 30;
        R4(g, 10, 30, 3, 8, '#6b4a32');
        tri(g, 11, 2, 16, 7, '#2f7d32', '#3f9a3c'); tri(g, 11, 9, 24, 9, '#2f7d32', '#3f9a3c'); tri(g, 11, 17, 31, 10, '#2b6f2e', '#378a39');
        if (k === 'pine2') { for (const [y, w] of [[3, 2], [10, 4], [18, 5], [25, 7]]) R4(g, 11 - w, y + 2, w * 2 + 1, 2, '#ffffff'); }
        outline(c, '#15251a'); break;
      }
      case 'bush': case 'fern': { c = mk(18, 11); const g = c.getContext('2d'); h = 8; blob(g, 9, 6, 5, k === 'fern' ? '#2f9e44' : '#4c9a3a', k === 'fern' ? '#69db7c' : '#74c05a', 5); outline(c, '#1d2a1a'); break; }
      case 'flower': { c = mk(14, 6); const g = c.getContext('2d'); h = 3; const R = seeded(9); for (let i = 0; i < 7; i++) R4(g, 1 + R() * 11 | 0, R() * 4 | 0, 2, 2, ['#f7e36b', '#f39ac0', '#ffffff', '#e8894a'][i % 4]); break; }
      case 'palm': {
        c = mk(30, 40); const g = c.getContext('2d'); h = 32;
        for (let y = 12; y < 40; y++) R4(g, 13 + Math.round(Math.sin(y / 9) * 2), y, 3, 1, y % 4 ? '#a87b4f' : '#7a5636');
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.7; for (let r = 0; r < 13; r++) R4(g, 15 + Math.round(Math.cos(a) * r), 11 + Math.round(Math.sin(a) * r * 0.5) + Math.round(r * r / 18), 2, 2, r % 3 ? '#2f9e44' : '#51cf66'); }
        R4(g, 13, 11, 4, 3, '#7a5636'); outline(c, '#1d2a1a'); break;
      }
      case 'umbrella': { c = mk(20, 18); const g = c.getContext('2d'); h = 13; R4(g, 9, 6, 2, 12, '#ddd'); for (let y = 0; y < 6; y++) for (let x = -9 + (5 - y); x <= 9 - (5 - y); x++) R4(g, 10 + x, y + 1, 1, 1, (Math.floor((x + 10) / 4) % 2) ? '#f03e3e' : '#fff'); outline(c, '#2b2233'); break; }
      case 'rock': case 'skull': { c = mk(16, 11); const g = c.getContext('2d'); h = 7; blob(g, 8, 6, 5, '#8d8478', '#b5ab9c', 13); R4(g, 2, 9, 12, 2, '#6e665c'); outline(c, '#2b2622'); break; }
      case 'lamp': case 'neonpost': {
        c = mk(10, 30); const g = c.getContext('2d'); h = 20; const neon = k === 'neonpost';
        R4(g, 4, 6, 2, 24, neon ? '#3a1d6e' : '#343a40'); R4(g, 2, 28, 6, 2, '#212529');
        if (neon) { R4(g, 3, 4, 4, 18, '#ff3bd8'); R4(g, 4, 4, 2, 18, '#ffd6f6'); } else { R4(g, 1, 1, 8, 5, '#343a40'); R4(g, 2, 2, 6, 3, '#ffe08a'); }
        outline(c, '#111'); break;
      }
      case 'tower': {
        c = mk(26, 56); const g = c.getContext('2d'); h = 64; const R = seeded(77);
        R4(g, 1, 4, 24, 52, '#2b3048'); R4(g, 1, 4, 3, 52, '#3a4060'); R4(g, 1, 2, 24, 3, '#434a6e');
        for (let y = 7; y < 54; y += 4) for (let x = 5; x < 23; x += 4) R4(g, x, y, 2, 2, R() < 0.55 ? '#ffd86b' : '#1a1e30');
        outline(c, '#0a0c16'); break;
      }
      case 'sign': case 'sign2': {
        const cons = k === 'sign2'; c = mk(22, cons ? 16 : 26); const g = c.getContext('2d'); h = cons ? 10 : 20;
        if (cons) { R4(g, 3, 0, 16, 9, '#fab005'); for (let x = 0; x < 16; x += 4) R4(g, 3 + x, 0, 2, 9, '#212529'); R4(g, 5, 9, 2, 7, '#868e96'); R4(g, 15, 9, 2, 7, '#868e96'); }
        else { R4(g, 10, 10, 2, 16, '#495057'); R4(g, 1, 1, 20, 10, '#1c7ed6'); R4(g, 3, 3, 16, 2, '#fff'); R4(g, 3, 7, 10, 2, '#ffd43b'); }
        outline(c, '#111'); break;
      }
      case 'cactus': { c = mk(16, 22); const g = c.getContext('2d'); h = 15; R4(g, 6, 2, 4, 20, '#2f9e44'); R4(g, 7, 2, 1, 20, '#69db7c'); R4(g, 1, 8, 3, 6, '#2f9e44'); R4(g, 1, 13, 5, 2, '#2f9e44'); R4(g, 12, 5, 3, 7, '#2f9e44'); R4(g, 10, 11, 4, 2, '#2f9e44'); outline(c, '#173d20'); break; }
      case 'snowman': { c = mk(14, 20); const g = c.getContext('2d'); h = 12; blob(g, 7, 14, 5, '#f1f3f5', '#ffffff', 3); blob(g, 7, 6, 4, '#f1f3f5', '#ffffff', 4); R4(g, 5, 5, 1, 1, '#000'); R4(g, 8, 5, 1, 1, '#000'); R4(g, 7, 7, 2, 1, '#f76707'); R4(g, 3, 9, 8, 2, '#e03131'); outline(c, '#5c6b80'); break; }
      case 'crate': { c = mk(14, 12); const g = c.getContext('2d'); h = 7; R4(g, 1, 1, 12, 11, '#b07a45'); R4(g, 1, 1, 12, 2, '#d19a5e'); R4(g, 1, 6, 12, 1, '#7a5230'); R4(g, 6, 1, 1, 11, '#7a5230'); outline(c, '#3a2614'); break; }
      case 'bollard': { c = mk(8, 8); const g = c.getContext('2d'); h = 4; R4(g, 1, 1, 6, 7, '#343a40'); R4(g, 1, 1, 6, 2, '#ffd43b'); outline(c, '#111'); break; }
      case 'crane': {
        c = mk(40, 60); const g = c.getContext('2d'); h = 58;
        for (let y = 8; y < 60; y++) { R4(g, 8, y, 2, 1, '#e03131'); R4(g, 16, y, 2, 1, '#e03131'); if (y % 6 === 0) R4(g, 8, y, 10, 1, '#c92a2a'); }
        R4(g, 0, 6, 40, 3, '#e03131'); R4(g, 30, 9, 1, 18, '#495057'); R4(g, 28, 27, 5, 3, '#495057'); outline(c, '#2b0f0f'); break;
      }
      case 'lolly': { c = mk(18, 30); const g = c.getContext('2d'); h = 20; R4(g, 8, 12, 2, 18, '#f8f9fa'); for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) if (x * x + y * y <= 49) R4(g, 9 + x, 8 + y, 1, 1, (Math.floor(Math.atan2(y, x) * 2 + Math.hypot(x, y) * 0.6) % 2) ? '#f06595' : '#fff0f6'); outline(c, '#6b1d3a'); break; }
      case 'candycane': { c = mk(14, 26); const g = c.getContext('2d'); h = 18; for (let y = 6; y < 26; y++) R4(g, 4, y, 3, 1, (y >> 1) % 2 ? '#e03131' : '#fff'); for (let a = 0; a <= Math.PI; a += 0.15) R4(g, 8 + Math.round(-Math.cos(a) * 4) - 1, 6 - Math.round(Math.sin(a) * 4), 3, 2, (a * 3 | 0) % 2 ? '#e03131' : '#fff'); outline(c, '#5c1010'); break; }
      case 'cupcake': { c = mk(14, 13); const g = c.getContext('2d'); h = 8; R4(g, 3, 7, 8, 6, '#c78a5a'); blob(g, 7, 5, 5, '#f783ac', '#ffc9df', 2); R4(g, 6, 0, 2, 2, '#e03131'); outline(c, '#4a2a18'); break; }
      case 'deadtree': { c = mk(20, 28); const g = c.getContext('2d'); h = 20; R4(g, 9, 8, 3, 20, '#2b2222'); for (const [x, y, l, d] of [[9, 10, 7, -1], [11, 6, 6, 1], [10, 14, 5, 1]]) for (let i = 0; i < l; i++) R4(g, x + i * d, y - (i >> 1), 2, 1, '#2b2222'); break; }
      case 'crystal': case 'icicle': {
        const ice = k === 'icicle'; c = mk(16, 24); const g = c.getContext('2d'); h = ice ? 18 : 14;
        const c1 = ice ? '#74c0fc' : '#9775fa', c2 = ice ? '#e7f5ff' : '#e5dbff';
        tri(g, 8, 0, 23, 4, c1, c2); tri(g, 4, 10, 23, 2, c1, c2); tri(g, 12, 8, 23, 2, c1, c2); outline(c, ice ? '#1864ab' : '#3b2a7a'); break;
      }
      case 'shroom': { c = mk(14, 12); const g = c.getContext('2d'); h = 8; R4(g, 6, 6, 2, 6, '#e9ecef'); blob(g, 7, 4, 5, '#7950f2', '#d0bfff', 3); R4(g, 4, 3, 1, 1, '#fff'); R4(g, 9, 2, 1, 1, '#fff'); outline(c, '#2b1a5a'); break; }
      case 'pipes': { c = mk(20, 12); const g = c.getContext('2d'); h = 7; for (const [x, y] of [[1, 6], [7, 6], [13, 6], [4, 1], [10, 1]]) { R4(g, x, y, 6, 5, '#868e96'); R4(g, x + 2, y + 1, 2, 3, '#343a40'); } outline(c, '#212529'); break; }
      case 'beacon': { c = mk(6, 10); const g = c.getContext('2d'); h = 5; R4(g, 2, 3, 2, 7, '#adb5bd'); R4(g, 1, 0, 4, 3, '#ff6b6b'); outline(c, '#111'); break; }
      case 'antenna': { c = mk(14, 30); const g = c.getContext('2d'); h = 20; R4(g, 6, 6, 2, 24, '#adb5bd'); R4(g, 1, 4, 12, 3, '#748ffc'); R4(g, 6, 0, 2, 3, '#ff6b6b'); outline(c, '#111'); break; }
      case 'star': { c = mk(9, 9); const g = c.getContext('2d'); h = 4; for (const [x, y] of [[4, 0], [4, 1], [3, 2], [4, 2], [5, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [2, 5], [3, 5], [5, 5], [6, 5], [1, 6], [2, 6], [6, 6], [7, 6]]) R4(g, x, y + 1, 1, 1, '#ffd43b'); break; }
      // obstacles
      case 'cone': { c = mk(10, 11); const g = c.getContext('2d'); h = 4.5; tri(g, 5, 0, 8, 3, '#f76707', '#ff922b'); R4(g, 3, 4, 5, 1, '#fff'); R4(g, 0, 9, 10, 2, '#e8590c'); outline(c, '#4a1d00'); break; }
      case 'tyres': { c = mk(14, 14); const g = c.getContext('2d'); h = 6.5; for (let i = 0; i < 3; i++) { R4(g, 1, 1 + i * 4, 12, 4, '#212529'); R4(g, 3, 2 + i * 4, 8, 1, '#495057'); R4(g, 1, 4 + i * 4, 12, 1, '#111'); } R4(g, 1, 1, 12, 1, '#e03131'); outline(c, '#000'); break; }
      case 'barrel': { c = mk(12, 14); const g = c.getContext('2d'); h = 6.5; R4(g, 1, 1, 10, 13, '#c92a2a'); R4(g, 1, 1, 3, 13, '#e03131'); R4(g, 1, 4, 10, 1, '#862e2e'); R4(g, 1, 9, 10, 1, '#862e2e'); R4(g, 4, 6, 4, 2, '#ffd43b'); outline(c, '#2b0a0a'); break; }
      case 'block': case 'choco': {
        c = mk(24, 16); const g = c.getContext('2d'); h = 8; const ch = k === 'choco';
        R4(g, 0, 0, 24, 16, ch ? '#6b3e22' : '#f1f3f5');
        if (ch) { for (let x = 0; x < 24; x += 6) for (let y = 0; y < 16; y += 5) { R4(g, x + 1, y + 1, 4, 3, '#8a5530'); } }
        else for (let x = -16; x < 24; x += 8) for (let y = 0; y < 16; y++) R4(g, x + y, y, 4, 1, '#e03131');
        outline(c, '#111'); break;
      }
      default: { c = mk(4, 4); h = 2; }
    }
    ART[k] = { c, h };
    return ART[k];
  }

  // ---------------- karts: a little voxel model, drawn from 32 sides; the driver is the player's own avatar ----------------
  // rows run from the front (top line) to the back; layers from the ground up
  const KART = [
    ['..GGGGGG..', 'KK.GGGG.KK', 'KK.GGGG.KK', 'KK.GGGG.KK', '...GGGG...', '...GGGG...', '...GGGG...', '...GGGG...', '...GGGG...', 'KK.GGGG.KK', 'KK.GGGG.KK', 'KK.GGGG.KK', '..GGGGGG..', '..........'],
    ['.BBBBBBBB.', 'KkBBBBBBkK', 'KkBBBBBBkK', 'KkBBBBBBkK', '.DBBBBBBD.', '.DBBBBBBD.', '.DBBBBBBD.', '.DBBBBBBD.', '.DBBBBBBD.', 'KkDBBBBDkK', 'KkDBBBBDkK', 'KkDBBBBDkK', '.GGEGGEGG.', '...E..E...'],
    ['.YBBBBBBY.', 'KKBBBBBBKK', 'KKBBBBBBKK', 'KKBLLLLBKK', '..BWWWWB..', '..B....B..', '..B....B..', '..BSSSSB..', '..BSSSSB..', 'KKDDDDDDKK', 'KKDDDDDDKK', 'KKDDDDDDKK', '.RDDDDDDR.', '..........'],
    ['..........', '...LLLL...', '...LLLL...', '..........', '...G..G...', '..........', '..........', '...SSSS...', '...SSSS...', '..DDDDDD..', '..DDDDDD..', '..........', '..........', '..........'],
    ['..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '...SSSS...', '..........', '..G....G..', '..G....G..', '..........', '..........'],
    ['..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', 'LLLLLLLLLL', 'BBBBBBBBBB', '..........', '..........']
  ];
  const KCOL = [
    ['빨강', '#e03131'], ['주황', '#f76707'], ['노랑', '#f2b705'], ['초록', '#2f9e44'], ['하늘', '#22b8cf'],
    ['파랑', '#3b5bdb'], ['보라', '#9c36b5'], ['분홍', '#e64980'], ['하양', '#e9ecef'], ['검정', '#343a40']
  ];
  const VOX = 0.6, VS = 4;           // one voxel is 0.6 world units, drawn 4 px wide
  const KPX = VS / VOX;               // kart picture pixels per world unit
  const KFR = 32, PHI = 0.42;          // frames round the kart; camera looks down this much (radians)
  const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const shadeHex = (h, k) => { const [r, g, b] = hexRGB(h); return k >= 1 ? rgbHex(r + (255 - r) * (k - 1), g + (255 - g) * (k - 1), b + (255 - b) * (k - 1)) : rgbHex(r * k, g * k, b * k); };
  const VOXELS = (() => {
    const out = [];
    for (let z = 0; z < KART.length; z++) for (let y = 0; y < KART[z].length; y++) for (let x = 0; x < 10; x++) {
      const ch = KART[z][y][x]; if (ch === '.') continue;
      const up = z + 1 < KART.length && KART[z + 1][y][x] !== '.';
      out.push({ x: x - 4.5, y: 6.5 - y, z, ch, up });   // y: + is the front
    }
    return out;
  })();
  const kartCache = new Map();
  function avatarSit(look, dir) {
    const S = root.ONL_SPRITE; if (!S) return null;
    try { return S.sprite(S.validLook(look) ? look : S.DEFAULT_LOOK, dir, 'sit', 'none', 0); } catch (e) { return null; }
  }
  // the picture of a kart of colour ci with driver look, seen at relative angle frame fi (0 = from behind)
  function kartFrame(ci, look, fi) {
    const key = ci + '|' + (look ? JSON.stringify(look) : '-');
    let set = kartCache.get(key);
    if (!set) { set = []; kartCache.set(key, set); }
    if (set[fi]) return set[fi];
    const base = KCOL[ci % KCOL.length][1];
    const PAL = { B: base, D: shadeHex(base, 0.72), L: shadeHex(base, 1.35), K: '#1b1b20', k: '#6c6f7a', G: '#5b5f6b', S: '#2b2233', W: '#bfe8ff', Y: '#fff3bf', R: '#ff4b4b', E: '#868e96' };
    const th = fi / KFR * TAU;       // kart heading relative to the camera
    const cs = Math.cos(th), sn = Math.sin(th), cp = Math.cos(PHI), sp = Math.sin(PHI);
    const W = 76, H = 74, cx = W / 2, cy = 52;
    const c = mk(W, H), g = c.getContext('2d');
    const P = v => {
      // kart forward = (sin th, cos th) in view space (x right, y away from camera)
      const vx = v.x * cs + v.y * sn, vy = -v.x * sn + v.y * cs;
      return { sx: cx + vx * VS, sy: cy - v.z * VS * cp - vy * VS * sp, d: vy };
    };
    const list = VOXELS.map(v => Object.assign({ v }, P(v)));
    // the driver sits in the middle of the seat
    const seat = P({ x: 0, y: -0.2, z: 1.2 });
    const a = ((th % TAU) + TAU) % TAU;
    const dir = a < Math.PI / 4 || a > TAU - Math.PI / 4 ? 'up' : a < 3 * Math.PI / 4 ? 'right' : a < 5 * Math.PI / 4 ? 'down' : 'left';
    const av = look ? avatarSit(look, dir) : null;
    list.push({ driver: true, sx: seat.sx, sy: seat.sy, d: seat.d + 0.01 });
    list.sort((p, q) => q.d - p.d || (p.v && q.v ? p.v.z - q.v.z : 0));
    const vh = Math.ceil(VS * (cp + sp)) + 1;
    for (const p of list) {
      if (p.driver) {
        if (av) { const s = 2; g.drawImage(av, 0, 0, 18, 21, Math.round(p.sx - 9 * s), Math.round(p.sy - 21 * s + 4), 18 * s, 21 * s); }
        continue;
      }
      const col = PAL[p.v.ch];
      R4(g, Math.round(p.sx - VS / 2), Math.round(p.sy - VS * cp), VS + 1, vh, shadeHex(col, 0.82));
      if (!p.v.up) R4(g, Math.round(p.sx - VS / 2), Math.round(p.sy - VS * cp), VS + 1, Math.max(2, Math.round(VS * sp) + 1), col);
    }
    // crisp edges and a dark outline, like the rest of the lounge
    const d = g.getImageData(0, 0, W, H), A = d.data, on = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { on[i] = A[i * 4 + 3] > 100 ? 1 : 0; A[i * 4 + 3] = on[i] ? 255 : 0; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (on[i]) continue;
      if ((x > 0 && on[i - 1]) || (x < W - 1 && on[i + 1]) || (y > 0 && on[i - W]) || (y < H - 1 && on[i + W])) { A[i * 4] = 20; A[i * 4 + 1] = 16; A[i * 4 + 2] = 28; A[i * 4 + 3] = 255; }
    }
    g.putImageData(d, 0, 0);
    set[fi] = { c, ax: cx, ay: cy + VS * 0.5 };   // anchor: the ground under the kart's middle
    return set[fi];
  }

  // ---------------- sky: colours, far scenery that turns with you, clouds or stars ----------------
  const skyCache = new Map();
  function skyLayers(th, f) {
    const key = th.ko + f; if (skyCache.has(key)) return skyCache.get(key);
    const PW = Math.round(TAU * f), FH = 70;
    const far = mk(PW, FH), g = far.getContext('2d'), R = seeded(th.ko.charCodeAt(0) * 31 + PW);
    const ridge = (base, amp, col, freq, seed, jag) => {
      const Rr = seeded(seed); const ph = [Rr() * 6, Rr() * 6, Rr() * 6];
      for (let x = 0; x < PW; x++) {
        const t = x / PW * TAU;
        let y = Math.sin(t * freq + ph[0]) * 0.5 + Math.sin(t * freq * 2.3 + ph[1]) * 0.3 + Math.sin(t * freq * 5.1 + ph[2]) * 0.2;
        if (jag) y = Math.abs(y) * 1.6 - 0.4;
        const top = Math.round(FH - base - y * amp);
        R4(g, x, top, 1, FH - top, col);
      }
    };
    switch (th.far) {
      case 'hills': case 'trees': ridge(22, 10, th.hill2, 5, 3); ridge(12, 8, th.hill, 9, 4); break;
      case 'sea': R4(g, 0, FH - 8, PW, 8, '#2f8fd0'); for (let i = 0; i < 4; i++) { const x = R() * PW; for (let k = -20; k <= 20; k++) R4(g, x + k, FH - 8 - Math.round((1 - (k * k) / 400) * 10), 1, 10, th.hill); } break;
      case 'mountains': case 'peaks': ridge(30, 22, th.hill, 4, 5, true); for (let x = 0; x < PW; x += 1) { /* snow caps drawn by a lighter ridge on top */ } ridge(18, 8, shadeHex(th.hill, 0.8), 8, 6); break;
      case 'mesa': for (let i = 0; i < 14; i++) { const x = R() * PW, w = 30 + R() * 60, hh = 14 + R() * 20; R4(g, x, FH - hh, w, hh, R() < 0.5 ? th.hill : th.hill2); R4(g, x, FH - hh, w, 2, shadeHex(th.hill, 1.2)); } break;
      case 'city': case 'cranes': case 'port': {
        for (let x = 0; x < PW;) { const w = 10 + R() * 22 | 0, hh = 14 + R() * (th.far === 'city' ? 46 : 20) | 0; R4(g, x, FH - hh, w, hh, th.hill); if (th.night) for (let yy = FH - hh + 3; yy < FH - 2; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 3) if (R() < 0.35) R4(g, xx, yy, 1, 1, th.hill2); x += w + (R() * 6 | 0); }
        if (th.far !== 'city') for (let i = 0; i < 6; i++) { const x = R() * PW; R4(g, x, FH - 50, 2, 50, th.hill2); R4(g, x - 16, FH - 50, 30, 2, th.hill2); }
        break;
      }
      case 'candy': for (let i = 0; i < 18; i++) { const x = R() * PW, r = 8 + R() * 10; R4(g, x, FH - 26, 2, 26, '#fff'); for (let a = 0; a < TAU; a += 0.05) for (let rr = 0; rr < r; rr += 1) R4(g, x + Math.cos(a) * rr, FH - 26 - r + Math.sin(a) * rr, 1, 1, (Math.floor(a * 3) % 2) ? th.hill : th.hill2); } ridge(8, 4, '#ffc9de', 7, 2); break;
      case 'volcano': { ridge(10, 6, th.hill, 8, 9); const x0 = PW * 0.3; for (let k = -90; k <= 90; k++) { const hh = 56 - Math.abs(k) * 0.5; R4(g, x0 + k, FH - hh, 1, hh, th.hill); } R4(g, x0 - 10, FH - 57, 20, 3, th.hill2); break; }
      case 'cave': ridge(14, 10, th.hill, 9, 3, true); break;
      case 'planets': case 'stars': break;
      default: ridge(16, 8, th.hill, 6, 2);
    }
    // a second, slower layer: clouds by day, stars by night (and planets in space)
    const cl = mk(PW, 120), h = cl.getContext('2d');
    if (th.night) {
      for (let i = 0; i < PW / 6; i++) R4(h, R() * PW, R() * 110, 1, 1, R() < 0.2 ? '#fff3bf' : '#ffffff');
      if (th.far === 'planets') { for (const [x, y, r, c1] of [[0.2, 40, 18, '#ffa94d'], [0.6, 30, 10, '#74c0fc'], [0.85, 70, 6, '#ff8787']]) for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) R4(h, x * PW + xx, y + yy, 1, 1, xx + yy < -r * 0.4 ? shadeHex(c1, 1.3) : c1); }
      if (th.rainbow) for (let i = 0; i < 3; i++) { const x = R() * PW; for (let a = 0; a < Math.PI; a += 0.01) for (let b = 0; b < 7; b++) R4(h, x + Math.cos(a) * (60 + b * 2), 100 - Math.sin(a) * (60 + b * 2), 2, 2, ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa', '#f783ac'][b]); }
    } else {
      for (let i = 0; i < 12; i++) { const x = R() * PW, y = 10 + R() * 60, w = 20 + R() * 30; for (let k = 0; k < 5; k++) { const rx = x + R() * w, ry = y + R() * 6, rr = 4 + R() * 6; for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr * 1.6; xx <= rr * 1.6; xx++) if ((xx * xx) / 2.56 + yy * yy <= rr * rr) R4(h, rx + xx, ry + yy, 1, 1, yy < -rr * 0.3 ? '#ffffff' : '#eef6ff'); } }
    }
    const out = { far, cl, PW, FH };
    skyCache.set(key, out);
    return out;
  }

  function boot() {
    if (!root.ONL || !root.ONL_TG) return setTimeout(boot, 150);
    init(root.ONL_TG, root.ONL);
  }
  boot();

  function init(TG, O) {
    const el = O.el, toast = O.toast;
    const now = () => performance.now();
    const me = () => O.uid();
    const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
    const isTouch = () => { try { return matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) { return false; } };
    const fmt = ms => { if (ms == null || !isFinite(ms)) return '-:--.--'; ms = Math.max(0, Math.round(ms)); const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, c = Math.floor(ms / 10) % 100; return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`; };
    const LV_KO = { 1: '하', 2: '중', 3: '상' };

    // ---------------- view ----------------
    const RW = 320, CAM = { dist: 30, h: 12.5, f: 236 }, FAR = 1100;
    let RH = 180, HOR = 62;

    // ---------------- local state ----------------
    let G = null;                       // the race as the host sees it (map, who races, finish times)
    const L = {
      dom: null, raf: 0, last: 0, rid: '', map: '', tr: null, tex: null, th: null, props: [], k: null, slot: -1,
      goAt: 0, rem: {}, knocked: new Map(), fx: [], cam: { x: 0, y: 0, a: 0, ok: false }, shake: 0,
      keys: Object.create(null), steerK: 0, joy: { on: false, x: 0, y: 0, id: null }, tDrift: false, tBrake: false,
      evUp: false, evDrift: false, joyUp: false, sentAt: 0, sent: null, sendSeq: 0, finSent: false, banner: null,
      ghost: null, rec: null, recAt: 0, lastLap: -1, best: null, myRank: null, endShown: '', startEv: false, startBoost: false,
      wrongShown: false, hudKey: {}, acc: 0, mm: null
    };
    // ---------------- sound: a small engine hum, tyre squeal, boost and beeps (all made here, no files) ----------------
    const SND = { ctx: null, eng: null, sq: null, mute: LS.get('onl_race_mute', false) };
    function audio() {
      if (SND.mute) return null;
      if (!SND.ctx) {
        try {
          const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
          const ctx = new AC(), out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination);
          // engine: two buzzing oscillators through a low-pass filter
          const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), eg = ctx.createGain();
          o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = 9; lp.type = 'lowpass'; lp.frequency.value = 700; eg.gain.value = 0;
          o1.connect(lp); o2.connect(lp); lp.connect(eg); eg.connect(out); o1.start(); o2.start();
          // squeal: looped noise through a band-pass filter
          const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
          const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 6;
          const sg = ctx.createGain(); sg.gain.value = 0; ns.connect(bp); bp.connect(sg); sg.connect(out); ns.start();
          SND.ctx = ctx; SND.out = out; SND.eng = { o1, o2, lp, g: eg }; SND.sq = { g: sg, bp }; SND.noise = nb;
        } catch (e) { SND.ctx = null; return null; }
      }
      if (SND.ctx.state === 'suspended') SND.ctx.resume().catch(() => {});
      return SND.ctx;
    }
    function beep(f, dur, type, vol, slide) {
      const ctx = audio(); if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(SND.out); o.start(t); o.stop(t + dur + 0.02);
    }
    function noiseHit(dur, freq, vol) {
      const ctx = audio(); if (!ctx) return;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
      s.buffer = SND.noise; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f); f.connect(g); g.connect(SND.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }
    function soundFrame(k, live) {
      if (!SND.ctx || SND.mute) return;
      const t = SND.ctx.currentTime;
      const v = k ? Math.abs(k.v) : 0, on = live && k && k.fallT <= 0;
      SND.eng.o1.frequency.setTargetAtTime(38 + v * 0.95 + (k && k.boostT > 0 ? 40 : 0), t, 0.06);
      SND.eng.o2.frequency.setTargetAtTime(19 + v * 0.48, t, 0.06);
      SND.eng.lp.frequency.setTargetAtTime(500 + v * 9, t, 0.1);
      SND.eng.g.gain.setTargetAtTime(on ? 0.028 + Math.min(0.03, v / 4000) : 0, t, 0.08);
      SND.sq.g.gain.setTargetAtTime(on && k.drift ? 0.03 : 0, t, 0.05);
    }
    function setMute(m) { SND.mute = m; LS.set('onl_race_mute', m); if (SND.ctx) { SND.eng.g.gain.value = 0; SND.sq.g.gain.value = 0; if (m) SND.ctx.suspend().catch(() => {}); else SND.ctx.resume().catch(() => {}); } if (!m) audio(); }

    // ---------------- effects ----------------
    function puff(k, n, col, spread, up, life) {
      for (let i = 0; i < n; i++) {
        const back = -3.2, side = (Math.random() - 0.5) * 5;
        L.fx.push({ x: k.x + Math.cos(k.a) * back - Math.sin(k.a) * side, y: k.y + Math.sin(k.a) * back + Math.cos(k.a) * side, z: 0.5,
          vx: (Math.random() - 0.5) * spread - Math.cos(k.m) * 6, vy: (Math.random() - 0.5) * spread - Math.sin(k.m) * 6, vz: up * (0.5 + Math.random()), life: life * (0.6 + Math.random() * 0.6), t: 0, col, s: 0.5 + Math.random() * 0.5 });
      }
      if (L.fx.length > 260) L.fx.splice(0, L.fx.length - 260);
    }
    function fxEvent(e, k, a) {
      const mine = k === L.k;
      if (e === 'wall' || e === 'bump') { if (mine) { L.shake = Math.min(1, 0.3 + (a || 20) / 60); noiseHit(0.25, 900, 0.25); banner('쿵!', 'hit', 500); vibrate(40); } puff(k, 8, '#d0d0d0', 18, 6, 0.5); }
      if (e === 'cone') { if (mine) { noiseHit(0.12, 2200, 0.12); vibrate(15); } }
      if (e === 'kart') { if (mine) noiseHit(0.15, 1200, 0.15); }
      if (e === 'oil') { if (mine) { beep(500, 0.5, 'sawtooth', 0.05, 120); banner('미끌!', 'hit', 700); vibrate(30); } }
      if (e === 'pad') { if (mine) { beep(300, 0.35, 'sawtooth', 0.06, 900); vibrate(10); } }
      if (e === 'mini') { if (mine) { beep(500, 0.25, 'square', 0.06, 1300); banner(a === 2 ? '순간 부스트!!' : '순간 부스트!', 'boost', 650); vibrate(20); } puff(k, 10, a === 2 ? '#ff922b' : '#4dabf7', 10, 4, 0.35); }
      if (e === 'ready') { if (mine) beep(a === 2 ? 1100 : 880, 0.08, 'square', 0.05); }
      if (e === 'fall') { if (mine) { beep(400, 0.7, 'triangle', 0.08, 60); banner('앗, 떨어졌어요!', 'hit', 1200); vibrate(60); } }
      if (e === 'respawn') { if (mine) beep(660, 0.12, 'square', 0.05); }
    }
    function vibrate(ms) { try { if (navigator.vibrate && isTouch()) navigator.vibrate(ms); } catch (e) {} PAD.fx(ms); }

    // ---------------- input ----------------
    const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'drift', ShiftRight: 'drift', Space: 'drift', KeyR: 'reset' };
    function typing(ev) { const t = ev.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }
    function onKey(ev) {
      if (!L.dom || typing(ev)) return;
      const k = KEYMAP[ev.code]; if (!k) return;
      ev.preventDefault(); ev.stopPropagation();
      const down = ev.type === 'keydown';
      if (down && !ev.repeat && !L.keys[k]) { if (k === 'up') L.evUp = true; if (k === 'drift') L.evDrift = true; if (k === 'reset') resetKart(); audio(); }
      L.keys[k] = down;
    }
    function releaseKeys() { L.keys = Object.create(null); L.tDrift = L.tBrake = false; L.joy.on = false; L.joy.x = L.joy.y = 0; }
    function gatherInput(dt) {
      const K = L.keys;
      // keyboard steering eases in and out, so a tap is a small correction and holding is a full turn
      const tgt = (K.right ? 1 : 0) - (K.left ? 1 : 0);
      const rate = tgt === 0 ? 9 : Math.sign(tgt) !== Math.sign(L.steerK) ? 12 : 5.5;
      L.steerK += clamp(tgt - L.steerK, -rate * dt, rate * dt);
      let steer = L.steerK, thr = K.up ? 1 : 0, brake = K.down ? 1 : 0, drift = !!K.drift;
      // phone screen: left stick (up = go, sideways = steer), right buttons (drift, brake)
      if (L.joy.on) {
        const jx = L.joy.x, jy = -L.joy.y, ax = Math.abs(jx);
        const s = ax < 0.1 ? 0 : Math.sign(jx) * Math.pow((ax - 0.1) / 0.9, 1.25);
        if (Math.abs(s) > Math.abs(steer)) steer = s;
        thr = Math.max(thr, clamp((jy + 0.05) / 0.45, 0, 1));
        if (jy < -0.45) brake = 1;
        const upNow = jy > 0.4; if (upNow && !L.joyUp) L.evUp = true; L.joyUp = upNow || (L.joyUp && jy > 0.15);
      }
      if (L.tDrift) drift = true;
      if (L.tBrake) brake = 1;
      // phone used as a controller (QR)
      const pi = PAD.input();
      if (pi) {
        if (Math.abs(pi.steer) > Math.abs(steer)) steer = pi.steer;
        thr = Math.max(thr, pi.thr); brake = Math.max(brake, pi.brake); drift = drift || pi.drift;
        if (pi.evUp) L.evUp = true; if (pi.evDrift) L.evDrift = true;
      }
      const out = { steer: clamp(steer, -1, 1), thr, brake, drift, evUp: L.evUp, evDrift: L.evDrift };
      L.evUp = L.evDrift = false;
      return out;
    }
    function resetKart() {
      const k = L.k; if (!k || !L.tr || k.fallT > 0 || k.fin || raceT() < 0) return;
      if (Math.abs(k.v) > 15) return;   // only when stuck
      k.fallT = 0.6; k.v = 0; fxEvent('fall', k);
    }

    // ---------------- race clock ----------------
    const raceT = () => (now() - L.goAt) / 1000;
    const racing = () => !!G && !!L.k && G.phase !== 'end' && raceT() >= 0;

    // ---------------- loading a map ----------------
    function loadMap(id) {
      if (L.map === id && L.tr) return;
      const def = MAP_BY[id] || MAPS[0];
      L.map = def.id; L.th = THEMES[def.th]; L.tr = compile(def); L.tex = buildTexture(L.tr, L.th); L.props = placeProps(L.tr, L.th, def.id.length * 977 + 13);
      L.mm = null;
    }
    // a new race from the host's state
    function setupRace(g) {
      const t0 = now();   // the clock is taken before building the road picture (slow phones take a moment)
      loadMap(g.map);
      L.rid = g.rid; L.rem = {}; L.knocked = new Map(); L.fx = []; L.finSent = false; L.lastLap = -1; L.endShown = ''; L.myRank = null; L.best = null; L.banner = null;
      L.goAt = (g._rx || t0) - (g.el || 0); L.startEv = false; L.startBoost = false; L.wrongShown = false; L.newRec = false;
      L.slot = g.racers.indexOf(me());
      L.k = L.slot >= 0 ? newKart(L.tr, L.slot) : null;
      L.cam.ok = false; L.sentAt = 0; L.sent = null;
      for (const id of g.racers) if (id !== me()) { const s = g.racers.indexOf(id), gr = L.tr.grid[s % L.tr.grid.length]; L.rem[id] = { x: gr.x, y: gr.y, m: gr.a, b: gr.a, v: 0, w: 0, at: now(), ox: 0, oy: 0, p: gr.i - L.tr.n, f: 0, c: 0, dx: gr.x, dy: gr.y, da: gr.a, fin: 0 }; }
      // a ghost of your best run on this map (time trial only)
      L.ghost = g.racers.length === 1 && L.k ? LS.get('onl_race_ghost_' + g.map, null) : null;
      L.rec = L.k ? [] : null; L.recAt = 0;
      hideEnd();
    }

    // ---------------- remote karts: drawn where they should be by now ----------------
    function remoteFrame(dt) {
      const t = now();
      for (const id in L.rem) {
        const r = L.rem[id];
        const age = (t - r.at) / 1000;
        if (age < 1.6 && !(r.f & 4)) { r.m = wrapA(r.m + r.w * dt); r.b = wrapA(r.b + r.w * dt); r.x += Math.cos(r.m) * r.v * dt; r.y += Math.sin(r.m) * r.v * dt; }
        const decay = Math.exp(-dt * 7); r.ox *= decay; r.oy *= decay; r.oa = (r.oa || 0) * decay;
        r.dx = r.x + r.ox; r.dy = r.y + r.oy; r.da = r.b + (r.oa || 0);
        if (L.tr) { const nr = nearest(L.tr, r.dx, r.dy, r.ni == null ? -1 : r.ni); r.ni = nr.i; }
      }
    }
    function onKartMsg(p) {
      if (!G || p.r !== G.rid || !L.tr || p.from === me()) return;
      let r = L.rem[p.from];
      if (!r) r = L.rem[p.from] = { x: p.x, y: p.y, m: p.a, b: p.b, v: 0, w: 0, at: now(), ox: 0, oy: 0, dx: p.x, dy: p.y, da: p.b };
      const px = r.dx, py = r.dy, pa = r.da;
      r.x = +p.x || 0; r.y = +p.y || 0; r.m = +p.a || 0; r.b = +p.b || 0; r.v = clamp(+p.v || 0, -60, 260); r.w = clamp(+p.w || 0, -6, 6);
      r.p = +p.p || 0; r.f = p.f | 0; r.c = p.c | 0; r.at = now();
      // glide from where it was drawn to the new place, unless it jumped (respawn)
      if (Math.hypot(px - r.x, py - r.y) < 30) { r.ox = px - r.x; r.oy = py - r.y; r.oa = wrapA(pa - r.b); } else { r.ox = r.oy = r.oa = 0; }
      if (TG.isHost() && G) G.prog[p.from] = r.p;
    }
    function sendKart(force) {
      const k = L.k; if (!k || !G) return;
      const t = now(), racers = G.racers.length;
      if (racers < 2) return;   // alone: nobody to tell
      // fewer messages when the room is full: Supabase counts one broadcast to N people as N+1
      const people = Math.max(racers, (O.peers ? O.peers() : racers - 1) + 1);
      const minGap = clamp(racers * people * 1000 / 60, 180, 900);
      const since = t - L.sentAt;
      if (since < minGap && !(force && since > 120)) return;
      const flags = (k.drift ? 1 : 0) | (k.boostT > 0 ? 2 : 0) | (k.fallT > 0 ? 4 : 0) | (k.spinT > 0 ? 8 : 0) | (k.fin ? 16 : 0);
      const S = L.sent;
      if (!force && S && since < 1100) {
        // what the others think right now
        const age = since / 1000, pm = S.m + S.w * age;
        const ex = S.x + Math.cos((S.m + pm) / 2) * S.v * age, ey = S.y + Math.sin((S.m + pm) / 2) * S.v * age;
        const err = Math.hypot(ex - k.x, ey - k.y), aerr = Math.abs(wrapA(pm - k.m));
        if (err < 2.2 && aerr < 0.12 && flags === S.f) return;
      }
      const w = L.wEst || 0;
      L.sent = { x: k.x, y: k.y, m: k.m, w, v: k.v, f: flags };
      L.sentAt = t;
      TG.send({ t: 'rk', r: G.rid, x: Math.round(k.x * 10) / 10, y: Math.round(k.y * 10) / 10, a: Math.round(k.m * 100) / 100, b: Math.round((k.a + k.slip) * 100) / 100, v: Math.round(k.v), w: Math.round(w * 100) / 100, p: k.prog, f: flags, c: k.drift ? k.drift.dir : 0 });
    }

    // ---------------- the frame ----------------
    function loop() {
      L.raf = requestAnimationFrame(loop);
      const t = now(); let dt = (t - L.last) / 1000; L.last = t;
      if (!(dt > 0)) return; dt = Math.min(dt, 0.05);
      G = TG.G && TG.G.kind === 'race' ? TG.G : null;
      if (!L.dom || !G) { if (L.dom) drawWait(); return; }
      if (L.rid !== G.rid || !L.tr) setupRace(G);
      const rt = raceT(), k = L.k;
      const inp = gatherInput(dt);
      // start: a well-timed ↑ just as it turns GO gives a little boost
      if (k && rt < 0 && rt > -0.45 && inp.evUp && !L.startEv) { L.startEv = true; L.startBoost = true; }
      if (k && rt < -0.45 && inp.evUp) { L.startEv = true; L.startBoost = false; }
      if (k && rt >= 0 && L.startBoost) { L.startBoost = false; k.boostT = 0.6; k.boostCap = PH.base + 20; k.v = 45; fxEvent('mini', k, 1); }
      const ctx = { tr: L.tr, knocked: L.knocked, others: Object.values(L.rem).map(r => ({ x: r.dx, y: r.dy, v: r.v, fall: r.f & 4 })), fx: fxEvent };
      if (k && rt >= 0 && G.phase !== 'end') {
        const m0 = k.m;
        const live = !k.fin ? inp : autoDrive(k, L.tr, rt, L.knocked, 0.85);
        if (k.fin) { live.thr = 0.55; live.drift = false; }
        // fixed small steps: the same driving at 30 or 120 frames a second
        L.acc += dt; let steps = 0;
        while (L.acc >= 1 / 120 && steps < 8) { stepKart(k, steps ? Object.assign({}, live, { evUp: false, evDrift: false }) : live, 1 / 120, raceT() - L.acc, ctx); L.acc -= 1 / 120; steps++; }
        if (steps >= 8) L.acc = 0;
        L.wEst = lerp(L.wEst || 0, wrapA(k.m - m0) / dt, 0.5);
        afterStep(k, rt, dt);
      }
      remoteFrame(dt);
      for (const [o, v] of L.knocked) if (rt - v.t > 5 || rt < v.t - 1) L.knocked.delete(o);
      // effects
      if (k && k.fallT <= 0) {
        if (k.drift && k.drift.ch > PH.charge1) puff(k, 1, k.drift.ch > PH.charge2 ? '#ff922b' : '#74c0fc', 6, 3, 0.25);
        if (k.boostT > 0) puff(k, 1, Math.random() < 0.5 ? '#ffd43b' : '#ff6b6b', 4, 2, 0.2);
        if (k.off && Math.abs(k.v) > 20 && Math.random() < 0.5) puff(k, 1, L.th.off2, 8, 4, 0.4);
        if (k.sparkT > 0) puff(k, 1, '#ffe066', 10, 6, 0.2);
      }
      for (const id in L.rem) { const r = L.rem[id]; if ((r.f & 1) && Math.random() < 0.3) puff({ x: r.dx, y: r.dy, a: r.da, m: r.m }, 1, '#74c0fc', 6, 3, 0.25); if ((r.f & 2) && Math.random() < 0.4) puff({ x: r.dx, y: r.dy, a: r.da, m: r.m }, 1, '#ffd43b', 4, 2, 0.2); }
      for (const p of L.fx) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 20 * dt; if (p.z < 0) { p.z = 0; p.vz = 0; } }
      L.fx = L.fx.filter(p => p.t < p.life);
      if (k) sendKart(false);
      soundFrame(k, rt >= 0 && G.phase !== 'end');
      draw(dt);
      hud(rt);
    }
    function afterStep(k, rt, dt) {
      const tr = L.tr, laps = G.laps;
      const lapNow = Math.floor(k.prog / tr.n);
      if (lapNow > k.lapMax) {
        if (k.lapMax >= 0) { k.laps.push(rt * 1000 - k.lapAt); }
        k.lapMax = lapNow; k.lapAt = rt * 1000;
        if (!k.fin && lapNow >= 1 && lapNow < laps) { banner(lapNow === laps - 1 ? '마지막 바퀴!' : `${lapNow + 1}바퀴째`, 'lap', 1300); beep(lapNow === laps - 1 ? 988 : 784, 0.18, 'square', 0.06); }
      }
      if (!k.fin && k.prog >= laps * tr.n) finish(k, rt);
      // remember the run for the ghost (10 times a second)
      if (L.rec && !k.fin && rt * 10 >= L.rec.length / 3) L.rec.push(Math.round(k.x * 10) / 10, Math.round(k.y * 10) / 10, Math.round((k.a + k.slip) * 100) / 100);
      if (k.wrongT > 1.2 && !L.wrongShown) { L.wrongShown = true; banner('↩ 거꾸로 가고 있어요!', 'warn', 1600); }
      if (k.wrongT === 0) L.wrongShown = false;
    }
    function finish(k, rt) {
      k.fin = Math.round(rt * 1000);
      sendKart(true);
      beep(784, 0.15, 'square', 0.07); setTimeout(() => beep(988, 0.15, 'square', 0.07), 160); setTimeout(() => beep(1319, 0.35, 'square', 0.07), 320);
      banner('골인!', 'fin', 2200); vibrate(80);
      if (TG.isHost()) onFinish(me(), k.fin); else TG.send({ t: 'rf', r: G.rid, ms: k.fin });
      // a personal best on this map: keep the ghost
      const g = LS.get('onl_race_ghost_' + G.map, null);
      if (L.rec && G.racers.length === 1 && (!g || g.ms > k.fin)) LS.set('onl_race_ghost_' + G.map, { ms: k.fin, p: L.rec });
      submitRecord(G.map, k.fin);
    }

    // ---------------- drawing ----------------
    function fitView() {
      const D = L.dom; if (!D) return;
      const r = D.stage.getBoundingClientRect(); if (!r.width || !r.height) return;
      const want = clamp(Math.round(RW * r.height / r.width), 120, 340);
      if (want !== RH || !D.img) {
        RH = want; HOR = Math.round(RH * 0.34);
        // keep your own kart near the bottom whatever the shape of the screen
        CAM.h = (RH * 0.87 - HOR) * CAM.dist / CAM.f;
        D.cv.width = RW; D.cv.height = RH; D.fc.width = RW; D.fc.height = RH;
        D.img = D.fg.createImageData(RW, RH); D.buf = new Uint32Array(D.img.data.buffer);
        D.g.imageSmoothingEnabled = false;
      }
      const s = Math.min(r.width / RW, r.height / RH);
      D.cv.style.width = Math.floor(RW * s) + 'px'; D.cv.style.height = Math.floor(RH * s) + 'px';
      D.hud.style.width = D.cv.style.width; D.hud.style.height = D.cv.style.height;
      D.hud.style.setProperty('--k', String(Math.max(0.9, Math.min(3.2, s))));
    }
    function camUpdate(dt) {
      const k = L.k;
      let fx, fy, fa;
      if (k) { fx = k.x; fy = k.y; fa = k.m + wrapA(k.a - k.m) * 0.25; }
      else {
        // watching: follow whoever is in front
        const ids = G.racers.filter(id => L.rem[id]); let best = null;
        for (const id of ids) if (!best || (L.rem[id].p || 0) > (L.rem[best].p || 0)) best = id;
        if (!best) { const g = L.tr.grid[0]; fx = g.x; fy = g.y; fa = g.a; }
        else { const r = L.rem[best]; fx = r.dx; fy = r.dy; fa = r.m; L.watch = best; }
      }
      const C = L.cam;
      if (!C.ok) { C.a = fa; C.ok = true; }
      C.a = wrapA(C.a + wrapA(fa - C.a) * Math.min(1, dt * (k && k.fallT > 0 ? 0 : 5.5)));
      C.x = fx - Math.cos(C.a) * CAM.dist; C.y = fy - Math.sin(C.a) * CAM.dist;
    }
    function draw(dt) {
      const D = L.dom; if (!D || !D.img) return;
      camUpdate(dt);
      const g = D.g, th = L.th, C = L.cam, k = L.k;
      const boost = k && k.boostT > 0 ? Math.min(1, k.boostT * 3) : 0;
      const f = CAM.f * (1 - 0.1 * boost);
      // sky
      const sky = skyLayers(th, CAM.f);
      const sg = g.createLinearGradient(0, 0, 0, HOR);
      sg.addColorStop(0, th.sky[0]); sg.addColorStop(1, th.sky[1]);
      g.fillStyle = sg; g.fillRect(0, 0, RW, HOR + 1);
      const offFar = ((C.a * CAM.f) % sky.PW + sky.PW) % sky.PW, offCl = ((C.a * CAM.f * 0.6 + now() * 0.002) % sky.PW + sky.PW) % sky.PW;
      g.drawImage(sky.cl, Math.round(-offCl), HOR - 118); g.drawImage(sky.cl, Math.round(-offCl + sky.PW), HOR - 118);
      g.drawImage(sky.far, Math.round(-offFar), HOR - sky.FH + 1); g.drawImage(sky.far, Math.round(-offFar + sky.PW), HOR - sky.FH + 1);
      // below the horizon: what you see where there is no ground (space, the sky under a cliff road)
      const bg = g.createLinearGradient(0, HOR, 0, RH);
      if (th.pat === 'void') { bg.addColorStop(0, th.sky[1]); bg.addColorStop(1, th.sky[0]); } else { bg.addColorStop(0, th.fog); bg.addColorStop(1, th.fog); }
      g.fillStyle = bg; g.fillRect(0, HOR + 1, RW, RH - HOR);
      if (th.pat === 'void' && th.night) { g.fillStyle = '#ffffff'; for (let i = 0; i < 40; i++) { const sx = ((hash2(i, 1) * 2000 - C.a * CAM.f * 0.8) % RW + RW) % RW, sy = HOR + 4 + hash2(i, 2) * (RH - HOR); g.fillRect(sx | 0, sy | 0, 1, 1); } }
      // the ground
      mode7(D.buf, C, f);
      D.fg.putImageData(D.img, 0, 0);
      g.drawImage(D.fc, 0, 0);
      // haze near the horizon
      const fg = g.createLinearGradient(0, HOR, 0, HOR + RH * 0.2);
      fg.addColorStop(0, hexA(th.fog, 0.85)); fg.addColorStop(1, hexA(th.fog, 0));
      g.fillStyle = fg; g.fillRect(0, HOR, RW, Math.ceil(RH * 0.2));
      // things standing on the ground, far ones first
      sprites(g, C, f);
      // speed lines while boosting
      if (boost) { g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 10; i++) { const y = HOR + 10 + hash2(i, (now() / 40) | 0) * (RH - HOR - 10), x = hash2(i + 9, (now() / 40) | 0) < 0.5 ? hash2(i, 5) * 50 : RW - hash2(i, 5) * 50; g.fillRect(x | 0, y | 0, 14, 1); } }
      // screen shake after a bump
      if (L.shake > 0) { L.shake = Math.max(0, L.shake - dt * 3); D.cv.style.transform = `translate(${(Math.random() - 0.5) * L.shake * 8}px, ${(Math.random() - 0.5) * L.shake * 6}px)`; }
      else if (D.cv.style.transform) D.cv.style.transform = '';
    }
    function hexA(h, a) { const [r, g, b] = hexRGB(h); return `rgba(${r},${g},${b},${a})`; }
    function mode7(buf, C, f) {
      const tex = L.tex, ox = tex.ox, oy = tex.oy, K = tex.K, tile = tex.tile, ch = CAM.h;
      const ca = Math.cos(C.a), sa = Math.sin(C.a), rx = -sa, ry = ca;
      for (let y = HOR + 1; y < RH; y++) {
        const row = y * RW, z = ch * f / (y - HOR);
        if (z > FAR) { buf.fill(0, row, row + RW); continue; }
        const sc = z / f;
        let wx = C.x + ca * z + rx * (-RW / 2 + 0.5) * sc, wy = C.y + sa * z + ry * (-RW / 2 + 0.5) * sc;
        const dx = rx * sc, dy = ry * sc;
        const lev = sc * K > 2.2 ? 2 : sc * K > 1.1 ? 1 : 0, mp = tex.mips[lev], mk2 = K / (1 << lev), mw = mp.w, mh = mp.h, md = mp.d;
        let u = (wx - ox) * mk2, v = (wy - oy) * mk2; const du = dx * mk2, dv = dy * mk2;
        for (let x = 0; x < RW; x++) {
          if (u >= 0 && v >= 0 && u < mw && v < mh) buf[row + x] = md[(v | 0) * mw + (u | 0)];
          else buf[row + x] = tile[(((wy | 0) & 63) << 6) | ((wx | 0) & 63)];
          u += du; v += dv; wx += dx; wy += dy;
        }
      }
    }
    function sprites(g, C, f) {
      const ca = Math.cos(C.a), sa = Math.sin(C.a), rx = -sa, ry = ca, ch = CAM.h, list = [];
      const add = (x, y, z, kind, ref) => {
        const dx = x - C.x, dy = y - C.y, zc = dx * ca + dy * sa;
        if (zc < 2.5 || zc > FAR) return;
        const xc = dx * rx + dy * ry; if (Math.abs(xc) > zc * 0.75 + 30) return;
        list.push({ zc, sx: RW / 2 + xc * f / zc, gy: HOR + (ch - (z || 0)) * f / zc, sc: f / zc, kind, ref });
      };
      for (const p of L.props) add(p.x, p.y, 0, 'prop', p);
      const rt = raceT();
      for (const o of L.tr.objs) {
        const kn = L.knocked.get(o);
        if (kn) { const a = rt - kn.t; if (a < 0.7) add(o.x + kn.vx * a * 0.5, o.y + kn.vy * a * 0.5, Math.max(0, 14 * a - 18 * a * a) + a * 4, 'obj', o); continue; }
        add(o.x, o.y, 0, 'obj', o);
      }
      for (const m of L.tr.movers) { const p = moverPos(L.tr, m, Math.max(0, rt)); add(p.x, p.y, 0, 'mover', m); }
      for (const id in L.rem) { const r = L.rem[id]; if (r.f & 4) continue; add(r.dx, r.dy, 0, 'kart', { id, a: r.da, ci: (G.col || {})[id] | 0, look: O.lookOf(id), spin: r.f & 8 }); }
      if (L.k) { const k = L.k; if (k.fallT <= 0 || k.z < 30) add(k.x, k.y, -k.z * 0.6, 'kart', { id: me(), a: k.a + k.slip + (k.spinT > 0 ? k.spinT * 14 : 0), ci: (G.col || {})[me()] | 0, look: O.lookOf(me()), mine: true, bob: k.hitT > 0 ? Math.sin(k.hitT * 40) : 0, blink: k.safeT > 0 }); }
      if (L.ghost && L.k && rt > 0) {
        const p = L.ghost.p, i = Math.floor(rt * 10) * 3;
        if (i + 5 < p.length) { const fr = rt * 10 % 1; add(lerp(p[i], p[i + 3], fr), lerp(p[i + 1], p[i + 4], fr), 0, 'kart', { id: 'ghost', a: p[i + 2] + wrapA(p[i + 5] - p[i + 2]) * fr, ci: 8, look: null, ghost: true }); }
      }
      for (const p of L.fx) add(p.x, p.y, p.z, 'fx', p);
      list.sort((a, b) => b.zc - a.zc);
      for (const s of list) {
        if (s.kind === 'prop' || s.kind === 'obj' || s.kind === 'mover') {
          const kind = s.kind === 'prop' ? s.ref.k : s.kind === 'mover' ? (L.th.pat === 'candy' ? 'choco' : 'block') : { c: 'cone', t: 'tyres', b: 'barrel', r: 'rock' }[s.ref.k];
          const a = art(kind), hpx = a.h * (s.ref.s || 1) * s.sc;
          if (hpx < 1) continue;
          const wpx = a.c.width / a.c.height * hpx;
          g.drawImage(a.c, Math.round(s.sx - wpx / 2), Math.round(s.gy - hpx), Math.max(1, Math.round(wpx)), Math.max(1, Math.round(hpx)));
        } else if (s.kind === 'kart') {
          const q = s.ref, rel = wrapA(q.a - C.a), fi = ((Math.round(rel / TAU * KFR) % KFR) + KFR) % KFR;
          const fr = kartFrame(q.ci, q.look, fi), ds = s.sc / KPX;
          if (ds * fr.c.width < 2) continue;
          if (q.blink && (now() / 80 | 0) % 2) continue;
          g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(Math.round(s.sx), Math.round(s.gy), 3.6 * s.sc, 1.6 * s.sc, 0, 0, TAU); g.fill();
          if (q.ghost) g.globalAlpha = 0.42;
          const w = Math.round(fr.c.width * ds), h = Math.round(fr.c.height * ds);
          g.drawImage(fr.c, Math.round(s.sx - fr.ax * ds), Math.round(s.gy - fr.ay * ds - (q.bob || 0) * 2), w, h);
          g.globalAlpha = 1;
          // a name over the others
          if (!q.mine && !q.ghost && s.zc < 260) {
            const nm = (G.names || {})[q.id] || O.nameOf(q.id) || ''; if (nm) { g.font = '8px sans-serif'; g.textAlign = 'center'; const ty = Math.round(s.gy - fr.ay * ds - 4); g.fillStyle = 'rgba(0,0,0,.55)'; const tw = g.measureText(nm).width; g.fillRect(Math.round(s.sx - tw / 2 - 2), ty - 8, Math.ceil(tw) + 4, 10); g.fillStyle = '#fff'; g.fillText(nm, Math.round(s.sx), ty); }
          }
        } else if (s.kind === 'fx') {
          const p = s.ref, sz = Math.max(1, Math.min(4, p.s * s.sc * 0.8));
          g.globalAlpha = clamp(1 - p.t / p.life, 0, 1); g.fillStyle = p.col; g.fillRect(Math.round(s.sx - sz / 2), Math.round(s.gy - sz), Math.ceil(sz), Math.ceil(sz)); g.globalAlpha = 1;
        }
      }
    }
    function drawWait() {
      const D = L.dom; if (!D || !D.img) return;
      D.g.fillStyle = '#14101c'; D.g.fillRect(0, 0, RW, RH);
    }

    // ---------------- HUD (plain HTML over the picture, so Korean text stays sharp) ----------------
    function setText(node, key, txt) { if (L.hudKey[key] !== txt) { L.hudKey[key] = txt; node.textContent = txt; } }
    function banner(text, cls, ms) { L.banner = { text, cls, until: now() + ms }; }
    function standings() {
      const rows = [];
      for (const id of G.racers) {
        const fin = (G.fin || {})[id];
        let p;
        if (id === me() && L.k) p = L.k.prog; else if (L.rem[id]) p = L.rem[id].p + (L.rem[id].v * (now() - L.rem[id].at) / 1000) / L.tr.sp; else p = (G.prog || {})[id] || -1e9;
        const mf = id === me() && L.k && L.k.fin ? L.k.fin : fin;
        rows.push({ id, fin: mf || 0, p });
      }
      rows.sort((a, b) => (a.fin && b.fin) ? a.fin - b.fin : a.fin ? -1 : b.fin ? 1 : b.p - a.p);
      return rows;
    }
    function hud(rt) {
      const D = L.dom; if (!D) return;
      const H = D.H, k = L.k, laps = G.laps;
      if (k) {
        const lap = clamp(k.lapMax + 1, 1, laps);
        setText(H.lap, 'lap', `${lap}/${laps}`);
        setText(H.time, 'time', fmt(k.fin || Math.max(0, rt * 1000)));
        const kmh = Math.round(Math.abs(k.v) * 1.6);
        setText(H.spd, 'spd', String(kmh));
        const pct = Math.round(k.streak * 100);
        if (L.hudKey.st !== pct) { L.hudKey.st = pct; H.bar.style.width = pct + '%'; }
        H.mini.hidden = !(k.miniWin > 0);
        H.box.classList.toggle('rc-boosting', k.boostT > 0);
      } else { setText(H.lap, 'lap', '구경 중'); setText(H.time, 'time', fmt(Math.max(0, rt * 1000))); H.mini.hidden = true; }
      if (G.racers.length > 1) {
        const rows = standings(), idx = rows.findIndex(r => r.id === (L.k ? me() : L.watch));
        setText(H.pos, 'pos', idx >= 0 ? `${idx + 1}` : '-'); setText(H.of, 'of', `/${G.racers.length}`);
        H.posBox.hidden = false;
      } else H.posBox.hidden = true;
      // countdown and messages
      let msg = '', cls = '';
      if (rt < 0) { const n = Math.ceil(-rt); msg = n <= 3 ? String(n) : '준비'; cls = 'count'; if (n <= 3 && L.lastCount !== n) { L.lastCount = n; beep(523, 0.15, 'square', 0.07); } }
      else if (rt < 0.8) { msg = 'GO!'; cls = 'go'; if (L.lastCount !== 0) { L.lastCount = 0; beep(1046, 0.4, 'square', 0.08); } }
      else if (L.banner && now() < L.banner.until) { msg = L.banner.text; cls = L.banner.cls; }
      else if (k && k.wrongT > 1.2) { msg = '↩ 거꾸로 가고 있어요!'; cls = 'warn'; }
      setText(H.msg, 'msg', msg); if (L.hudKey.msgc !== cls) { L.hudKey.msgc = cls; H.msg.className = 'rc-msg ' + cls; }
      minimap(D);
      setText(H.padChip, 'pc', PAD.chip());
      PAD.status({ st: G.phase, lap: k ? clamp(k.lapMax + 1, 1, laps) : 0, laps, pos: H.pos.textContent, n: G.racers.length });
      // the end of the race
      const key = G.phase === 'end' ? 'end' : (k && k.fin ? 'fin' : '');
      if (key && L.endShown !== key + (G.seq || 0) && (key === 'end' || now() - (L.finAt || 0) > 0)) { L.endShown = key + (G.seq || 0); showEnd(); }
    }
    function minimap(D) {
      const c = D.mm, g = c.getContext('2d'), tr = L.tr, S = c.width;
      if (!L.mm) {
        // the outline of the track, drawn once
        const sc = (S - 8) / Math.max(tr.maxx - tr.minx, tr.maxy - tr.miny), ox = (S - (tr.maxx - tr.minx) * sc) / 2, oy = (S - (tr.maxy - tr.miny) * sc) / 2;
        const bg = mk(S, S), b = bg.getContext('2d');
        b.lineCap = 'round'; b.lineJoin = 'round';
        for (const [w, col] of [[6, 'rgba(0,0,0,.55)'], [3.5, '#f1f3f5']]) { b.strokeStyle = col; b.lineWidth = w; b.beginPath(); for (let i = 0; i <= tr.n; i += 3) { const j = i % tr.n, x = ox + (tr.X[j] - tr.minx) * sc, y = oy + (tr.Y[j] - tr.miny) * sc; i ? b.lineTo(x, y) : b.moveTo(x, y); } b.closePath(); b.stroke(); }
        b.fillStyle = '#111'; const x0 = ox + (tr.X[0] - tr.minx) * sc, y0 = oy + (tr.Y[0] - tr.miny) * sc; b.fillRect(x0 - 2, y0 - 2, 4, 4);
        L.mm = { bg, sc, ox, oy };
      }
      const M = L.mm; g.clearRect(0, 0, S, S); g.drawImage(M.bg, 0, 0);
      const dot = (x, y, col, r) => { g.fillStyle = '#111'; g.beginPath(); g.arc(M.ox + (x - tr.minx) * M.sc, M.oy + (y - tr.miny) * M.sc, r + 1, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(M.ox + (x - tr.minx) * M.sc, M.oy + (y - tr.miny) * M.sc, r, 0, TAU); g.fill(); };
      for (const id in L.rem) { const r = L.rem[id]; dot(r.dx, r.dy, KCOL[((G.col || {})[id] | 0) % KCOL.length][1], 2.5); }
      if (L.k) dot(L.k.x, L.k.y, KCOL[((G.col || {})[me()] | 0) % KCOL.length][1], 3.5);
    }

    // ================================================================================================
    //  The race on the table: the host keeps the state, everyone drives their own kart
    // ================================================================================================
    const COUNT_MS = 4500, AFTER_FIRST_MS = 30000;
    let lastPush = 0;
    function newRace() {
      const T = TG.T, def = MAP_BY[T.map] || MAPS[0];
      const racers = T.members.filter(m => !m.bot).map(m => m.id).slice(0, INFO.max);
      const col = {}, used = new Set();
      for (const id of racers) { const c = (T.col || {})[id]; if (c != null && !used.has(c)) { col[id] = c; used.add(c); } }
      for (const id of racers) if (col[id] == null) { let c = 0; while (used.has(c)) c++; col[id] = c; used.add(c); }
      const names = {}; for (const m of T.members) names[m.id] = String(m.name || '친구').slice(0, 12);
      G = { kind: 'race', seq: 0, rid: O.newId(), map: def.id, laps: def.laps, racers, col, names, phase: 'count', el: -COUNT_MS, fin: {}, prog: {}, firstFin: 0 };
      TG.G = G;
      setupRace(G);
    }
    function push(to) {
      if (!G || !TG.isHost()) return;
      G.el = Math.round(now() - L.goAt); G.seq++; delete G._rx;
      const p = { t: 'rs', g: G }; if (to) p.to = to;
      TG.send(p); lastPush = now();
    }
    function hostTick() {
      if (!G || !TG.isHost()) return;
      const el = now() - L.goAt;
      if (G.phase === 'count' && el >= 0) { G.phase = 'race'; push(); }
      if (G.phase === 'race') {
        const all = G.racers.length > 0 && G.racers.every(id => G.fin[id]);
        if (all || !G.racers.length || (G.firstFin && el - G.firstFin > AFTER_FIRST_MS)) { G.phase = 'end'; push(); }
      }
    }
    function onFinish(id, ms) {
      if (!G || !TG.isHost() || !G.racers.includes(id) || G.fin[id]) return;
      const minMs = L.tr ? Math.floor(G.laps * L.tr.len / (PH.cap + PH.padAdd) * 750 / 1000) * 1000 : 8000;   // same numbers as race.sql
      if (!(ms >= minMs)) return;
      G.fin[id] = Math.round(ms);
      if (!G.firstFin) G.firstFin = now() - L.goAt;
      push();
    }
    function onState(p) {
      const T = TG.T; if (!p.g || !T || p.from !== T.host) return;
      const g = p.g; if (g.kind !== 'race' || !Array.isArray(g.racers)) return;
      g._rx = now();
      if (G && G.rid === g.rid && g.seq < G.seq) return;
      const fresh = !G || G.rid !== g.rid;
      // the clock: only take it at the start of a race (or if it is clearly off)
      if (!fresh && G) { const mine = now() - L.goAt; if (Math.abs(mine - g.el) > 1500) L.goAt = now() - g.el; }
      G = g; TG.G = G;
      if (fresh) { if (L.dom) setupRace(G); TG.render(); }
    }

    // ---------------- records (race.sql) ----------------
    const REC = {};
    async function fetchRec(map, force) {
      const c = REC[map];
      if (c && !force && now() - c.at < 30000) return c;
      if (!O.raceTop) return { rows: [], mine: 0, at: now() };
      try {
        const [rows, mine] = await Promise.all([O.raceTop(map), O.raceMine(map)]);
        REC[map] = { rows: rows || [], mine: mine || 0, at: now() };
      } catch (e) { REC[map] = { rows: [], mine: 0, at: now(), err: true }; }
      return REC[map];
    }
    async function submitRecord(map, ms) {
      if (!O.raceSubmit) return;
      const before = (REC[map] || {}).mine || 0;
      try {
        const best = await O.raceSubmit(map, ms);
        L.newRec = !!best && best === ms && (!before || ms < before);
        await fetchRec(map, true);
      } catch (e) { /* the board is a bonus; the race itself is done */ }
      if (L.dom && L.endShown) showEnd();
    }
    function boardEl(map, title) {
      const box = el('div', 'rc-board');
      box.appendChild(el('b', '', title || `🏆 ${(MAP_BY[map] || {}).name || ''} 기록 (1~5등)`));
      const list = el('div', 'rc-blist', '불러오는 중…'); box.appendChild(list);
      const mine = el('p', 'rc-bmine', ''); box.appendChild(mine);
      const fill = c => {
        list.innerHTML = '';
        if (!c.rows.length) list.appendChild(el('p', 'rc-bnone', c.err ? '기록을 불러오지 못했어요.' : '아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!'));
        c.rows.slice(0, 5).forEach(r => { const row = el('p', 'rc-brow' + (r.mine ? ' mine' : '')); row.append(el('span', 'rc-brank', ['🥇', '🥈', '🥉'][r.rank - 1] || r.rank + '등'), el('span', 'rc-bname', r.name), el('span', 'rc-btime', fmt(r.ms))); list.appendChild(row); });
        mine.textContent = c.mine ? `내 최고 기록: ${fmt(c.mine)}` : '내 기록: 아직 없어요';
      };
      if (REC[map]) fill(REC[map]);
      fetchRec(map).then(c => { if (box.isConnected || !REC[map]) fill(c); });
      return box;
    }

    // ---------------- results ----------------
    let endTimer = 0;
    function hideEnd() { clearInterval(endTimer); endTimer = 0; if (L.dom) { L.dom.end.hidden = true; L.dom.end.innerHTML = ''; } }
    function showEnd() {
      const D = L.dom; if (!D || !G) return;
      const box = D.end; box.innerHTML = ''; box.hidden = false;
      const over = G.phase === 'end', k = L.k, solo = G.racers.length === 1;
      const rows = standings(), myIdx = rows.findIndex(r => r.id === me());
      const h = el('h3', '', over ? (solo ? (k && k.fin ? '🏁 완주!' : '🏁 레이스 끝') : '🏁 레이스 결과') : '🏁 골인!');
      box.appendChild(h);
      if (k && k.fin) box.appendChild(el('p', 'rc-etime', `${fmt(k.fin)}${!solo && myIdx >= 0 ? ` · ${myIdx + 1}등` : ''}`));
      if (L.newRec) box.appendChild(el('p', 'rc-new', '🎉 내 새 기록!'));
      if (k && k.laps.length) box.appendChild(el('p', 'rc-laps', k.laps.map((t, i) => `${i + 1}바퀴 ${fmt(t)}`).join(' · ')));
      if (!solo) {
        const list = el('div', 'rc-elist');
        rows.forEach((r, i) => {
          const row = el('p', 'rc-erow' + (r.id === me() ? ' mine' : ''));
          const sw = el('i', 'rc-sw'); sw.style.background = KCOL[((G.col || {})[r.id] | 0) % KCOL.length][1];
          row.append(el('span', 'rc-erank', `${i + 1}`), sw, el('span', 'rc-ename', (G.names || {})[r.id] || O.nameOf(r.id) || '친구'), el('span', 'rc-etm', r.fin ? fmt(r.fin) : over ? '완주 못 함' : '달리는 중…'));
          list.appendChild(row);
        });
        box.appendChild(list);
      }
      if (!over) {
        const left = G.firstFin ? Math.max(0, Math.ceil((AFTER_FIRST_MS - (now() - L.goAt - G.firstFin)) / 1000)) : null;
        box.appendChild(el('p', 'rc-wait', left != null && !solo ? `다른 친구들을 기다리는 중… (최대 ${left}초)` : '잠시만요…'));
        clearInterval(endTimer); endTimer = setInterval(() => { if (!L.dom || L.dom.end.hidden || (G && G.phase === 'end')) { clearInterval(endTimer); return; } showEnd(); }, 1000);
      } else clearInterval(endTimer);
      box.appendChild(boardEl(G.map));
      const row = el('div', 'rc-ebtns');
      if (over && TG.isHost()) {
        const again = el('button', 'btn btn-gold', solo ? '🔁 다시 달리기' : '🔁 한 판 더'); again.type = 'button';
        again.addEventListener('click', () => { GAME.start(); push(); TG.render(); });
        const lob = el('button', 'btn', '🗺️ 맵 바꾸기'); lob.type = 'button'; lob.addEventListener('click', () => TG.backToLobby());
        row.append(again, lob);
      } else if (over) row.appendChild(el('p', 'rc-wait', '방장이 다음 판을 고르고 있어요…'));
      const hide = el('button', 'btn', '닫기'); hide.type = 'button'; hide.addEventListener('click', () => { box.hidden = true; clearInterval(endTimer); });
      row.appendChild(hide);
      box.appendChild(row);
    }

    // ---------------- the game screen ----------------
    function mount(body) {
      body.innerHTML = '';
      const wrap = el('div', 'rc-wrap'), stage = el('div', 'rc-stage');
      const cv = el('canvas', 'rc-cv'), fc = mk(RW, RH);
      const hudEl = el('div', 'rc-hud');
      const H = {};
      const tl = el('div', 'rc-tl'); H.lap = el('b', 'rc-lap', ''); H.time = el('span', 'rc-time', ''); tl.append(el('small', '', '바퀴'), H.lap, H.time);
      const tr = el('div', 'rc-tr'); H.posBox = el('div', 'rc-pos'); H.pos = el('b', '', ''); H.of = el('small', '', ''); H.posBox.append(H.pos, H.of);
      const mm = mk(84, 84); mm.className = 'rc-mm'; tr.append(H.posBox, mm);
      const bl = el('div', 'rc-bl'); H.spd = el('b', 'rc-spd', '0'); H.bar = el('i', ''); const bw = el('div', 'rc-gauge'); bw.appendChild(H.bar);
      bl.append(H.spd, el('small', '', 'km/h'), bw, el('small', 'rc-glab', '가속 게이지'));
      H.msg = el('div', 'rc-msg', ''); H.mini = el('div', 'rc-mini', isTouch() ? '↑ 다시 밀기!' : '↑ 다시!'); H.mini.hidden = true;
      const br = el('div', 'rc-br');
      const snd = el('button', 'rc-snd', SND.mute ? '🔇' : '🔊'); snd.type = 'button'; snd.title = '소리 켜기/끄기';
      snd.addEventListener('click', () => { setMute(!SND.mute); snd.textContent = SND.mute ? '🔇' : '🔊'; });
      H.padChip = el('span', 'rc-padchip', ''); br.append(H.padChip, snd);
      H.box = hudEl;
      hudEl.append(tl, tr, bl, H.msg, H.mini, br);
      const end = el('div', 'rc-end'); end.hidden = true;
      stage.append(cv, hudEl, end); wrap.appendChild(stage);
      // phone screen controls
      if (isTouch()) {
        wrap.classList.add('rc-touch');
        const tp = el('div', 'rc-tpad');
        const joy = el('div', 'rc-joy'), knob = el('div', 'rc-knob'); joy.append(knob, el('span', 'rc-joylab', '▲ 가기'));
        const upd = ev => {
          const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2;
          let dx = (ev.clientX - cx) / max, dy = (ev.clientY - cy) / max; const d = Math.hypot(dx, dy); if (d > 1) { dx /= d; dy /= d; }
          L.joy.x = dx; L.joy.y = dy; knob.style.transform = `translate(${dx * max * 0.62}px, ${dy * max * 0.62}px)`;
        };
        joy.addEventListener('pointerdown', ev => { ev.preventDefault(); audio(); L.joy.id = ev.pointerId; try { joy.setPointerCapture(ev.pointerId); } catch (e) {} L.joy.on = true; upd(ev); });
        joy.addEventListener('pointermove', ev => { if (L.joy.on && ev.pointerId === L.joy.id) upd(ev); });
        const off = ev => { if (ev && ev.pointerId !== L.joy.id) return; L.joy.on = false; L.joy.x = L.joy.y = 0; L.joyUp = false; knob.style.transform = ''; };
        joy.addEventListener('pointerup', off); joy.addEventListener('pointercancel', off); joy.addEventListener('lostpointercapture', off);
        const btns = el('div', 'rc-tbtns');
        const hold = (b, on) => {
          b.addEventListener('pointerdown', ev => { ev.preventDefault(); audio(); try { b.setPointerCapture(ev.pointerId); } catch (e) {} on(true); b.classList.add('on'); });
          const up = () => { on(false); b.classList.remove('on'); };
          b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
          b.addEventListener('contextmenu', e => e.preventDefault());
        };
        const bD = el('button', 'rc-tb rc-tdrift', '드리프트'), bB = el('button', 'rc-tb rc-tbrake', '브레이크'); bD.type = bB.type = 'button';
        hold(bD, v => { if (v && !L.tDrift) L.evDrift = true; L.tDrift = v; }); hold(bB, v => { L.tBrake = v; });
        btns.append(bB, bD); tp.append(joy, btns); wrap.appendChild(tp);
      }
      body.appendChild(wrap);
      const g = cv.getContext('2d'), fg = fc.getContext('2d');
      L.dom = { wrap, stage, cv, g, fc, fg, hud: hudEl, H, end, mm, img: null };
      L.hudKey = {};
      window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true);
      window.addEventListener('resize', fitView); window.addEventListener('blur', releaseKeys); document.addEventListener('visibilitychange', releaseKeys);
      fitView(); setTimeout(fitView, 50); setTimeout(fitView, 400);
      G = TG.G; if (G && L.rid !== G.rid) setupRace(G);
      audio();
      cancelAnimationFrame(L.raf); L.last = now(); L.raf = requestAnimationFrame(loop);
      if (G && G.phase === 'end') showEnd();
    }
    function unmount() {
      cancelAnimationFrame(L.raf); L.raf = 0;
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('resize', fitView); window.removeEventListener('blur', releaseKeys); document.removeEventListener('visibilitychange', releaseKeys);
      clearInterval(endTimer); releaseKeys();
      L.dom = null;
      if (SND.ctx) { SND.eng.g.gain.value = 0; SND.sq.g.gain.value = 0; }
    }

    // ---------------- the waiting room: map, kart colour, controls ----------------
    const prevCache = {};
    function mapPreview(id, size) {
      const key = id + size; if (prevCache[key]) return prevCache[key];
      const def = MAP_BY[id], tr = compile(def), th = THEMES[def.th], c = mk(size, size), g = c.getContext('2d');
      g.fillStyle = th.pat === 'void' ? th.sky[0] : th.out; g.fillRect(0, 0, size, size);
      const sc = (size - 10) / Math.max(tr.maxx - tr.minx, tr.maxy - tr.miny), ox = (size - (tr.maxx - tr.minx) * sc) / 2, oy = (size - (tr.maxy - tr.miny) * sc) / 2;
      g.lineJoin = g.lineCap = 'round';
      for (const [w, col] of [[Math.max(3, tr.W[0] * 2 * sc + 2), '#111'], [Math.max(2, tr.W[0] * 2 * sc), th.rainbow ? '#fff' : th.road]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = 0; i <= tr.n; i += 4) { const j = i % tr.n; const x = ox + (tr.X[j] - tr.minx) * sc, y = oy + (tr.Y[j] - tr.miny) * sc; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
      g.fillStyle = '#fff'; g.fillRect(ox + (tr.X[0] - tr.minx) * sc - 2, oy + (tr.Y[0] - tr.miny) * sc - 2, 4, 4);
      return (prevCache[key] = c);
    }
    const copyCanvas = (src, cls) => { const c = mk(src.width, src.height); c.className = cls || ''; c.getContext('2d').drawImage(src, 0, 0); return c; };
    let lobbyTab = 0, kartSpin = 0, spinTimer = 0;
    function myColorPref() { return LS.get('onl_race_color', null); }
    function askColor(c) {
      const T = TG.T; if (!T || !TG.inTable()) return;
      LS.set('onl_race_color', c);
      if (TG.isHost()) { setColor(me(), c); } else TG.send({ t: 'rc', c });
    }
    function setColor(id, c) {
      const T = TG.T; if (!T || T.started || !TG.isHost()) return;
      c = c | 0; if (c < 0 || c >= KCOL.length) return;
      T.col = T.col || {};
      if (Object.keys(T.col).some(o => o !== id && T.col[o] === c && T.members.some(m => m.id === o))) return;
      T.col[id] = c; TG.bump();
    }
    function lobbyExtra(body) {
      const T = TG.T; if (!T) return;
      G = TG.G && TG.G.kind === 'race' ? TG.G : null;
      if (TG.isHost() && !MAP_BY[T.map]) T.map = 'meadow';
      const cur = MAP_BY[T.map] || MAPS[0];
      if (!lobbyTab) lobbyTab = cur.lv;
      // map
      const mb = el('div', 'rc-maps');
      mb.appendChild(el('b', '', '🗺️ 맵 고르기' + (TG.isHost() ? '' : ' (방장이 골라요)')));
      const tabs = el('div', 'rc-tabs');
      [1, 2, 3].forEach(lv => {
        const b = el('button', 'btn gm-chip', `난이도 ${LV_KO[lv]}`); b.type = 'button'; b.setAttribute('aria-pressed', String(lobbyTab === lv));
        b.addEventListener('click', () => { lobbyTab = lv; TG.render(); }); tabs.appendChild(b);
      });
      mb.appendChild(tabs);
      const grid = el('div', 'rc-mapgrid');
      MAPS.filter(m => m.lv === lobbyTab).forEach(m => {
        const b = el('button', 'btn rc-map' + (cur.id === m.id ? ' btn-gold' : '')); b.type = 'button';
        b.append(copyCanvas(mapPreview(m.id, 72), 'rc-mprev'), el('strong', '', m.name), el('small', '', `${m.laps}바퀴 · ${LV_KO[m.lv]}${m.hard === 2 ? ' · 매우 어려움' : m.hard ? ' · 어려움' : ''}`));
        b.disabled = !TG.isHost() && cur.id !== m.id; b.setAttribute('aria-pressed', String(cur.id === m.id));
        b.addEventListener('click', () => { if (!TG.isHost()) return; T.map = m.id; TG.bump(); });
        grid.appendChild(b);
      });
      mb.appendChild(grid);
      mb.appendChild(el('p', 'ct-tip', `지금 고른 맵: ${cur.name} (${THEMES[cur.th].ko}, ${cur.laps}바퀴, 난이도 ${LV_KO[cur.lv]})`));
      body.appendChild(mb);
      body.appendChild(boardEl(cur.id));
      // kart colour
      if (TG.inTable()) {
        T.col = T.col || {};
        const mine = T.col[me()];
        if (mine == null && !L.colAsked) {
          L.colAsked = true;
          const taken = new Set(Object.keys(T.col).filter(o => o !== me()).map(o => T.col[o]));
          let c = myColorPref(); if (c == null || taken.has(c)) { c = 0; while (taken.has(c)) c++; }
          setTimeout(() => askColor(c), 50);
        }
        const cb = el('div', 'rc-colors');
        cb.appendChild(el('b', '', '🎨 내 카트 색깔 (성능은 모두 똑같아요)'));
        const row = el('div', 'rc-colrow');
        const pv = mk(76, 74); pv.className = 'rc-kprev'; pv.dataset.ci = String(mine == null ? 0 : mine);
        row.appendChild(pv);
        const sw = el('div', 'rc-swatches');
        KCOL.forEach(([nm, hex], i) => {
          const owner = Object.keys(T.col).find(o => o !== me() && T.col[o] === i && T.members.some(m => m.id === o));
          const b = el('button', 'rc-swatch' + (mine === i ? ' on' : '')); b.type = 'button'; b.style.background = hex; b.title = owner ? `${nm} (다른 친구가 골랐어요)` : nm;
          b.setAttribute('aria-label', nm); b.disabled = !!owner; b.setAttribute('aria-pressed', String(mine === i));
          b.addEventListener('click', () => askColor(i)); sw.appendChild(b);
        });
        row.appendChild(sw); cb.appendChild(row); body.appendChild(cb);
        if (!spinTimer) spinTimer = setInterval(() => {
          const c = document.querySelector('.rc-kprev'); if (!c) { clearInterval(spinTimer); spinTimer = 0; return; }
          kartSpin = (kartSpin + 1) % KFR;
          const fr = kartFrame(+c.dataset.ci || 0, O.lookOf(me()), kartSpin), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(fr.c, 0, 0);
        }, 110);
      }
      // controls
      const ctl = el('div', 'rc-ctl');
      ctl.appendChild(el('b', '', '🎮 조작 방법'));
      if (isTouch()) ctl.appendChild(el('p', 'ct-tip', '폰 화면 왼쪽 조이스틱: 위로 밀면 출발, 좌우로 방향. 오른쪽 버튼: 드리프트 · 브레이크.'));
      else {
        const mode = LS.get('onl_race_ctl', 'kb');
        const r = el('div', 'rc-tabs');
        [['kb', '⌨️ 키보드로'], ['pad', '📱 폰을 컨트롤러로 (QR)']].forEach(([k2, t]) => {
          const b = el('button', 'btn gm-chip', t); b.type = 'button'; b.setAttribute('aria-pressed', String(mode === k2));
          b.addEventListener('click', () => { LS.set('onl_race_ctl', k2); if (k2 === 'kb') PAD.stop(); TG.render(); }); r.appendChild(b);
        });
        ctl.appendChild(r);
        if (mode === 'pad') ctl.appendChild(PAD.panel());
        else ctl.appendChild(el('p', 'ct-tip', '↑ 가기 · ← → 방향 · ↓ 브레이크(멈추면 후진) · Shift 또는 Space 드리프트 · R 길에 다시 서기(멈췄을 때)'));
      }
      body.appendChild(ctl);
      const d = el('details', 'tg-help'); d.appendChild(el('summary', '', '어떻게 하나요?'));
      [
        '혼자면 기록 도전(타임 어택): 맵마다 내 기록이 남고, 1~5등이 기록판에 올라가요. 내 최고 기록의 유령 카트가 같이 달려요.',
        '2명 이상이면 같이 달려요 (최대 6명). 먼저 결승선을 지나면 1등! 첫 사람이 들어오고 30초가 지나면 끝나요.',
        '부딪히지 않고 깔끔하게 달리면 속도 한계가 조금씩 올라가요(가속 게이지). 벽, 콘, 드럼통, 다른 카트에 부딪히거나 길 밖으로 나가면 느려지고 게이지가 줄어요.',
        '드리프트: 방향을 꺾은 채 드리프트(Shift·Space·드리프트 버튼)를 누르고 있으면 미끄러지며 돌아요. 오래 할수록 불꽃이 파랑 → 주황으로 바뀌어요.',
        '순간 부스트: 드리프트를 놓은 직후 0.5초 안에 ↑를 다시 누르면(조이스틱은 다시 위로 밀기) 아주 잠깐 빨라져요. 주황 불꽃이면 더 세요. 「↑ 다시!」가 보일 때가 기회예요.',
        '출발 부스트: 카운트가 끝나 GO! 하는 순간에 맞춰 ↑를 누르면 빠르게 출발해요. 너무 일찍 누르면 안 돼요.',
        '노란 화살표 판은 부스터, 검은 기름은 미끄러워요. 얼음은 미끄럽고 진흙은 느려요. 무지개·우주·절벽 맵은 길 밖이 낭떠러지예요. 떨어지면 조금 뒤에서 다시 출발해요.',
        '맵 18개: 난이도 하 6개, 중 6개, 상 6개 (상에는 적당히 어려운 맵과 아주 어려운 맵이 섞여 있어요). 모든 카트의 성능은 똑같고 색깔만 달라요.'
      ].forEach(t => d.appendChild(el('p', '', '· ' + t)));
      body.appendChild(d);
    }

    const INFO = { title: '카트 레이싱', icon: '🏎️', min: 1, max: 6, blurb: '광장 동쪽 서킷! 혼자 맵별 기록에 도전하거나 최대 6명이 함께 달려요. 맵 18개 (난이도 하·중·상).' };
    const GAME = {
      start() { L.colAsked = false; newRace(); },
      push(to) { push(to); },
      fastTick() { G = TG.G && TG.G.kind === 'race' ? TG.G : null; hostTick(); },
      tick() { G = TG.G && TG.G.kind === 'race' ? TG.G : null; if (G && TG.isHost() && now() - lastPush > 2500) push(); },
      clientTick() {},
      onMsg(p) {
        G = TG.G && TG.G.kind === 'race' ? TG.G : null;
        if (p.t === 'rs') return onState(p);
        if (!G) { if (p.t === 'rc' && TG.isHost()) setColor(p.from, p.c); return; }
        if (p.t === 'rk') return onKartMsg(p);
        if (p.t === 'rf') { if (TG.isHost() && p.r === G.rid) onFinish(p.from, +p.ms); return; }
        if (p.t === 'rc') { if (TG.isHost()) setColor(p.from, p.c); return; }
      },
      mount, unmount, update() {},
      memberLeft(id, self) {
        delete L.rem[id];
        if (!G || self) return;
        G.racers = G.racers.filter(x => x !== id); delete G.fin[id];
        push();
      },
      memberGone(id) { TG.hostLeave(id); },
      handover() { push(); },
      lobbyExtra,
      myTurn() { return false; }
    };
    TG.register('race', 'raceway', INFO, GAME);
    root.ONL_RACE = { boardEl, fmt, maps: MAPS };
    if (/[?&]debug\b/.test(location.search)) root.__race = { get G() { return G; }, L, push, newRace, setupRace, hostTick, MAPS, PH, autoDrive, PAD: () => PAD, standings, fetchRec, REC, setColor };

    // ================================================================================================
    //  A phone as the controller: the computer shows a QR code, the phone opens pad.html and steers.
    // ================================================================================================
    // The two find each other on a realtime channel 'pad:<code>' (race.sql lets a phone that is not
    // signed in use only these channels). Then they try a direct WebRTC link, which costs no realtime
    // messages and is quicker; if that does not work, the inputs go over the channel, a few times a second.
    const PAD = (() => {
      const S = { code: '', ch: null, state: 'off', phone: null, pc: null, dc: null, inp: null, at: 0, el: null, seenU: -1, seenE: -1, evU: false, evE: false, stAt: 0, fxAt: 0, bcIn: 0 };
      const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const newCode = () => { const a = new Uint32Array(10); (root.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 1e9; }); return Array.from(a, v => ABC[v % ABC.length]).join(''); };
      const padUrl = () => { const page = /test[^/]*\.html$/.test(location.pathname) ? 'test-pad.html' : 'pad.html'; return new URL(page, location.href).href.split('#')[0].split('?')[0] + '#' + S.code; };
      function send(m) { m.from = 'pc'; try { if (S.ch) S.ch.send({ type: 'broadcast', event: 'pad', payload: m }); } catch (e) {} }
      function start() {
        if (S.ch) return;
        if (!O.live() || !O.channel) { S.state = 'nort'; ui(); return; }
        S.code = newCode(); S.state = 'connecting'; S.phone = null; S.inp = null;
        const ch = O.channel('pad:' + S.code); S.ch = ch;
        ch.on('broadcast', { event: 'pad' }, ({ payload }) => onMsg(payload));
        ch.subscribe(st => {
          if (S.ch !== ch) return;
          if (st === 'SUBSCRIBED') { if (S.state === 'connecting' || S.state === 'err') S.state = 'wait'; }
          else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') S.state = 'err';
          ui();
        });
        ui();
      }
      function closePeer() { try { if (S.dc) S.dc.close(); } catch (e) {} try { if (S.pc) S.pc.close(); } catch (e) {} S.dc = null; S.pc = null; }
      function stop() {
        if (S.ch) { send({ t: 'bye', to: S.phone }); const ch = S.ch; setTimeout(() => { try { O.removeChannel(ch); } catch (e) {} }, 200); }
        closePeer(); S.ch = null; S.phone = null; S.inp = null; S.state = 'off'; S.code = ''; ui();
      }
      function onMsg(m) {
        if (!m || m.from !== 'ph' || typeof m.id !== 'string') return;
        if (m.t === 'hi') {
          if (S.phone && S.phone !== m.id) closePeer();
          const again = S.phone === m.id;
          S.phone = m.id; S.at = now(); if (S.state !== 'p2p') S.state = 'bc';
          send({ t: 'ok', to: m.id, name: O.name() });
          if (!again || !S.pc) startPeer();
          ui(); return;
        }
        if (m.id !== S.phone) return;
        S.at = now();
        if (m.t === 'in') take(m);
        else if (m.t === 'sdp' && S.pc && m.d) S.pc.setRemoteDescription(m.d).catch(() => {});
        else if (m.t === 'ice' && S.pc && m.c) S.pc.addIceCandidate(m.c).catch(() => {});
        else if (m.t === 'bye') { closePeer(); S.phone = null; S.inp = null; S.state = 'wait'; ui(); }
      }
      function startPeer() {
        closePeer();
        if (!root.RTCPeerConnection) return;
        try {
          const pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }] });
          S.pc = pc;
          const dc = pc.createDataChannel('in', { ordered: false, maxRetransmits: 0 });
          dc.onopen = () => { if (S.pc !== pc) return; S.dc = dc; S.state = 'p2p'; ui(); };
          dc.onclose = () => { if (S.dc === dc) { S.dc = null; if (S.phone) S.state = 'bc'; ui(); } };
          dc.onmessage = ev => { try { const m = JSON.parse(ev.data); S.at = now(); if (m.t === 'in') take(m); } catch (e) {} };
          pc.onicecandidate = ev => { if (ev.candidate && S.pc === pc) send({ t: 'ice', to: S.phone, c: ev.candidate.toJSON() }); };
          pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => { if (S.pc === pc) send({ t: 'sdp', to: S.phone, d: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }).catch(() => {});
        } catch (e) { S.pc = null; }
      }
      function take(m) {
        const u = m.u | 0, e = m.e | 0;
        if (S.seenU >= 0 && u !== S.seenU) S.evU = true;
        if (S.seenE >= 0 && e !== S.seenE) S.evE = true;
        S.seenU = u; S.seenE = e;
        S.inp = { x: clamp((+m.x || 0) / 100, -1, 1), y: clamp((+m.y || 0) / 100, -1, 1), d: !!m.d, b: !!m.b };
        if (S.state !== 'p2p') { S.state = 'bc'; }
      }
      // what the phone is pressing, in the same shape as the keyboard
      function input() {
        if (!S.inp || !S.phone) return null;
        if (now() - S.at > 3000) return null;
        const jx = S.inp.x, jy = S.inp.y, ax = Math.abs(jx);
        const out = {
          steer: ax < 0.1 ? 0 : Math.sign(jx) * Math.pow((ax - 0.1) / 0.9, 1.25),
          thr: clamp((jy + 0.05) / 0.45, 0, 1), brake: S.inp.b || jy < -0.45 ? 1 : 0, drift: S.inp.d, evUp: S.evU, evDrift: S.evE
        };
        S.evU = S.evE = false;
        return out;
      }
      function toPhone(m, everyMs) {
        if (!S.phone) return;
        if (S.dc && S.dc.readyState === 'open') { try { S.dc.send(JSON.stringify(m)); } catch (e) {} return; }
        const t = now(); if (t - S.bcIn < everyMs) return; S.bcIn = t;
        m.to = S.phone; send(m);
      }
      function status(o) {
        if (!S.phone) return;
        const t = now(), dc = S.dc && S.dc.readyState === 'open';
        if (t - S.stAt < (dc ? 400 : 2500)) return; S.stAt = t;
        toPhone(Object.assign({ t: 'st' }, o), dc ? 0 : 2500);
      }
      function fx(ms) { if (!S.phone) return; const t = now(); if (t - S.fxAt < 300) return; S.fxAt = t; if (S.dc && S.dc.readyState === 'open') toPhone({ t: 'fx', ms }, 0); }
      function chip() {
        if (S.state === 'off' || S.state === 'nort') return '';
        if (!S.phone) return '📱 폰 연결 대기';
        if (now() - S.at > 3000) return '📱 신호 끊김';
        return S.state === 'p2p' ? '📱 빠른 연결' : '📱 연결됨';
      }
      function ui() {
        if (!S.el) return;
        const st = S.el.querySelector('.rc-qrst'), cv = S.el.querySelector('canvas'), url = S.el.querySelector('.rc-qrurl');
        const lost = S.phone && now() - S.at > 3000;
        const txt = { off: '', nort: '혼자 보는 체험 모드에서는 폰 컨트롤러를 쓸 수 없어요.', connecting: '연결 준비 중…', wait: '폰 카메라로 QR 코드를 찍어 주세요.', err: '연결에 실패했어요. 아래 「새 QR」을 눌러 다시 해 보세요.',
          bc: '✅ 폰이 연결됐어요! (기본 연결) 게임을 시작하면 폰으로 조종해요.', p2p: '✅ 폰이 연결됐어요! (빠른 연결) 게임을 시작하면 폰으로 조종해요.' }[S.state] || '';
        st.textContent = lost ? '⚠️ 폰 신호가 끊겼어요. 폰에서 컨트롤러 화면이 켜져 있는지 확인해 주세요.' : txt;
        st.className = 'rc-qrst ' + (S.phone && !lost ? 'ok' : '');
        if (S.code && cv.dataset.code !== S.code) {
          cv.dataset.code = S.code;
          const m = qrMatrix(padUrl()), n = m.length, q = 4, px = 4, g = cv.getContext('2d');
          cv.width = cv.height = (n + q * 2) * px; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#000';
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) g.fillRect((x + q) * px, (y + q) * px, px, px);
          url.textContent = padUrl();
        }
        cv.hidden = !S.code || !!(S.phone && !lost);
      }
      function panel() {
        if (!S.el) {
          const box = el('div', 'rc-qr');
          const cv = mk(10, 10); cv.className = 'rc-qrcv';
          const side = el('div', 'rc-qrside');
          side.append(el('p', 'rc-qrst', ''), el('p', 'ct-tip', '폰의 카메라 앱으로 QR을 비추면 컨트롤러 화면이 열려요. 같은 와이파이가 아니어도 돼요. 폰은 가로로 들면 편해요.'), el('p', 'rc-qrurl', ''));
          const again = el('button', 'btn', '🔄 새 QR'); again.type = 'button'; again.addEventListener('click', () => { stop(); start(); });
          side.appendChild(again);
          box.append(cv, side); S.el = box;
        }
        if (!S.ch) start(); else ui();
        return S.el;
      }
      // leaving the raceway closes the link
      setInterval(() => { if (S.ch && O.scene() !== 'raceway') stop(); else if (S.el && S.el.isConnected) ui(); }, 1000);
      root.addEventListener('pagehide', () => { if (S.ch) send({ t: 'bye', to: S.phone }); });
      return { start, stop, input, status, fx, chip, panel, get S() { return S; } };
    })();

    // ---------------- QR code (byte mode, error correction M, versions 1–10) ----------------
    function qrMatrix(text) {
      const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
      for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
      for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
      const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
      const rsRem = (data, n) => {
        let gen = [1];
        for (let i = 0; i < n; i++) { const ng = new Array(gen.length + 1).fill(0); for (let j = 0; j < gen.length; j++) { ng[j] ^= gen[j]; ng[j + 1] ^= mul(gen[j], EXP[i]); } gen = ng; }
        const r = new Array(n).fill(0);
        for (const d of data) { const f = d ^ r[0]; r.shift(); r.push(0); for (let j = 0; j < n; j++) r[j] ^= mul(gen[j + 1], f); }
        return r;
      };
      const TAB = { 1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]], 6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]] };
      const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
      const bytes = Array.from(new TextEncoder().encode(text));
      let ver = 1;
      for (; ver <= 10; ver++) { const cap = TAB[ver][1].reduce((a, [c, d]) => a + c * d, 0) * 8; if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= cap) break; }
      if (ver > 10) throw new Error('QR text too long');
      const [ecn, groups] = TAB[ver], capBytes = groups.reduce((a, [c, d]) => a + c * d, 0);
      const bits = [];
      const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
      put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
      put(0, Math.min(4, capBytes * 8 - bits.length)); while (bits.length % 8) bits.push(0);
      const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
      for (let p = 0; data.length < capBytes; p++) data.push(p % 2 ? 0x11 : 0xEC);
      const blocks = []; let off = 0;
      for (const [c, d] of groups) for (let i = 0; i < c; i++) { const b = data.slice(off, off + d); off += d; blocks.push({ d: b, e: rsRem(b, ecn) }); }
      const all = [];
      const maxD = Math.max(...blocks.map(b => b.d.length));
      for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) all.push(b.d[i]);
      for (let i = 0; i < ecn; i++) for (const b of blocks) all.push(b.e[i]);
      const N = 17 + ver * 4;
      const M = Array.from({ length: N }, () => new Array(N).fill(false)), F = Array.from({ length: N }, () => new Array(N).fill(false));
      const set = (x, y, v) => { M[y][x] = v; F[y][x] = true; };
      const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } };
      finder(3, 3); finder(N - 4, 3); finder(3, N - 4);
      for (let i = 0; i < N; i++) { if (!F[6][i]) set(i, 6, i % 2 === 0); if (!F[i][6]) set(6, i, i % 2 === 0); }
      const al = ALIGN[ver];
      for (const ay of al) for (const ax of al) {
        if ((ax === 6 && ay === 6) || (ax === 6 && ay === N - 7) || (ax === N - 7 && ay === 6)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
      const drawFormat = mask => {
        const dat = (0 << 3) | mask; let rem = dat;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const b = ((dat << 10) | rem) ^ 0x5412, bit = i => ((b >>> i) & 1) === 1;
        for (let i = 0; i <= 5; i++) set(8, i, bit(i));
        set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
        for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++) set(N - 1 - i, 8, bit(i));
        for (let i = 8; i < 15; i++) set(8, N - 15 + i, bit(i));
        set(8, N - 8, true);
      };
      drawFormat(0);
      if (ver >= 7) {
        let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
        const b = (ver << 12) | rem;
        for (let i = 0; i < 18; i++) { const v = ((b >>> i) & 1) === 1, a = N - 11 + i % 3, c = Math.floor(i / 3); set(a, c, v); set(c, a, v); }
      }
      // the data, in a zigzag from the bottom right
      let k = 0;
      for (let right = N - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < N; vert++) for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? N - 1 - vert : vert;
          if (!F[y][x] && k < all.length * 8) { M[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
        }
      }
      const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
      const apply = m => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
      const penalty = () => {
        let p = 0, dark = 0;
        for (let y = 0; y < N; y++) for (const horiz of [true, false]) {
          let run = 0, prev = null;
          for (let x = 0; x < N; x++) { const v = horiz ? M[y][x] : M[x][y]; if (v === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else { run = 1; prev = v; } }
        }
        for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const v = M[y][x]; if (v === M[y][x + 1] && v === M[y + 1][x] && v === M[y + 1][x + 1]) p += 3; }
        const pat = [true, false, true, true, true, false, true];
        for (let y = 0; y < N; y++) for (let x = 0; x + 7 <= N; x++) for (const horiz of [true, false]) {
          let ok = true; for (let i = 0; i < 7 && ok; i++) ok = (horiz ? M[y][x + i] : M[x + i][y]) === pat[i];
          if (!ok) continue;
          const light = (a, b) => { for (let i = a; i < b; i++) { if (i < 0 || i >= N) continue; if (horiz ? M[y][i] : M[i][y]) return false; } return true; };
          if (light(x - 4, x) || light(x + 7, x + 11)) p += 40;
        }
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (M[y][x]) dark++;
        p += Math.floor(Math.abs(dark * 20 - N * N * 10) / (N * N)) * 10;
        return p;
      };
      let best = 0, bestP = Infinity;
      for (let m = 0; m < 8; m++) { apply(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } apply(m); }
      apply(best); drawFormat(best);
      return M;
    }
    if (/[?&]debug\b/.test(location.search)) root.__qr = qrMatrix;
  }
})(typeof window !== 'undefined' ? window : globalThis);
