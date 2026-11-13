
(() => {
  const $ = id => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };
  const loadJSON = (k, d) => { try { const v = JSON.parse(store.get(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = v => clamp(Math.round(v * f), 0, 255);
    return '#' + ((1 << 24) | (c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).slice(1);
  }

  // ================= characters (js/sprite.js) =================
  const { HAIRS, HAIR_COLORS, TOPS, TOP_COLORS, BOTTOMS, BOTTOM_COLORS, DEFAULT_LOOK, randomLook, validLook, sprite, SW, SH } = window.ONL_SPRITE;

  // ================= mode: LIVE (Supabase) or DEMO (this device only) =================
  const CFG = window.ONLOUNGE_CONFIG || {};
  const LIVE = !!(window.supabase && CFG.supabaseUrl && CFG.supabaseKey && !/여기에/.test(CFG.supabaseUrl + CFG.supabaseKey));
  const sbRaw = LIVE ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;
  const BP = window.ONL_BACKPORT || { legacy: false };   // BACKPORT
  const sb = LIVE && window.ONL_BACKPORT ? ONL_BACKPORT.wrap(sbRaw, { name: () => player.name }) : sbRaw;   // BACKPORT

  // ================= scenes: 본당 -> 복도 -> ROOM 1-4 =================
  const buf = document.createElement('canvas'), b = buf.getContext('2d');
  const bg = document.createElement('canvas');
  const P = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  function pixCircle(g, cx, cy, rad, c) {
    g.fillStyle = c;
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + rad * 0.6) g.fillRect(cx + x, cy + y, 1, 1);
  }
  // seats: face 'up' = sitter faces the front wall (back of chair toward viewer), 'down' = sitter faces the viewer
  function mkSeat(x, y, face, kind, apDy) {
    const w = kind === 'fold' ? 11 : 9;
    return { x, y, w, cx: x + w / 2, face, kind, apDy: apDy != null ? apDy : (face === 'up' ? -2 : -9), occ: null, reserved: false };
  }
  const seatApproach = c => ({ x: c.cx, y: c.y + c.apDy });
  const seatObstacle = c => c.kind === 'sofa' ? null : (c.face === 'up' ? { x: c.x - 1, y: c.y, w: c.w + 2, h: 11 } : { x: c.x - 1, y: c.y - 6, w: c.w + 2, h: 11 });
  const seatHit = c => c.face === 'up' ? [c.x - 1, c.y - 8, c.w + 2, 20] : [c.x - 1, c.y - 9, c.w + 2, 15];
  const SEAT_COL = { fold: ['#121117', '#2c2a31', '#45424c', '#2a2830'], office: ['#1e2330', '#4a5a78', '#6a7ea6', '#3e4c68'] };
  function drawSeatBase(g, c) {
    if (c.kind === 'sofa') return;
    const [k, s1, hi] = SEAT_COL[c.kind];
    P(g, c.x - 1, c.y - 1, c.w + 2, 6, k); P(g, c.x, c.y, c.w, 4, s1); P(g, c.x, c.y, c.w, 1, hi);
  }
  function drawSeatBack(g, c) {
    if (c.kind === 'sofa') return;
    const [k, , hi, back] = SEAT_COL[c.kind];
    if (c.face === 'up') {
      P(g, c.x - 1, c.y + 3, c.w + 2, 7, k); P(g, c.x, c.y + 4, c.w, 5, back); P(g, c.x, c.y + 4, c.w, 1, hi);
      P(g, c.x + 3, c.y + 6, c.w - 6, 1, k); P(g, c.x, c.y + 10, 1, 2, k); P(g, c.x + c.w - 1, c.y + 10, 1, 2, k);
    } else {
      P(g, c.x - 1, c.y - 8, c.w + 2, 8, k); P(g, c.x, c.y - 7, c.w, 6, back); P(g, c.x, c.y - 7, c.w, 1, hi);
    }
  }
  const seatBackY = c => c.face === 'up' ? c.y + 9 : c.y - 3;

  // ---- drawing helpers shared by scenes ----
  function floorTiles(g, w, h, y0, cols, size, line) {
    for (let y = y0; y < h; y += size) for (let x = 0; x < w; x += size) {
      P(g, x, y, size, size, cols[((x + y) / size) % cols.length | 0]); P(g, x, y, size, 1, line);
    }
  }
  function woodFloor(g, w, h, y0, T, hi, lo) {
    for (let ty = y0; ty < h; ty += 12) {
      const rowI = (ty - y0) / 12, off = rowI % 2 ? 12 : 0;
      for (let tx = -24; tx < w + 24; tx += 24) {
        const x0 = tx + off, k = ((x0 / 12 | 0) + rowI) % 3;
        P(g, x0, ty, 24, 12, T[(k + 3) % 3]); P(g, x0, ty, 24, 1, hi); P(g, x0, ty + 11, 24, 1, lo); P(g, x0 + 23, ty, 1, 12, lo);
      }
    }
  }
  function backWall(g, w, col, panel) {
    P(g, 0, 0, w, 44, col);
    for (let x = 0; x < w; x += 24) P(g, x, 2, 1, 38, panel);
    P(g, 0, 0, w, 2, shade(col, 0.92)); P(g, 0, 39, w, 5, shade(col, 0.93)); P(g, 0, 39, w, 1, shade(col, 0.84)); P(g, 0, 44, w, 2, 'rgba(60,40,20,.16)');
  }
  function sideWalls(g, w, h, thick, col) {
    P(g, 0, 44, thick, h - 44, col); P(g, thick, 44, 1, h - 44, shade(col, 0.84));
    P(g, w - thick, 44, thick, h - 44, col); P(g, w - thick - 1, 44, 1, h - 44, shade(col, 0.84));
  }
  function frontWallWithDoor(g, w, h, col) {
    P(g, 0, h - 8, w, 8, col); P(g, 0, h - 9, w, 1, shade(col, 0.84));
    const dx = w / 2 - 12;
    P(g, dx, h - 9, 24, 9, DOOR.frame); P(g, dx + 1, h - 8, 22, 8, DOOR.slab); P(g, dx + 1, h - 8, 22, 1, DOOR.hi); P(g, dx + 11, h - 8, 2, 8, DOOR.frame);
    P(g, dx + 3, h - 16, 18, 7, '#7a3b44'); P(g, dx + 4, h - 15, 16, 5, '#94505b');
  }
  function plant(g, x, y) {
    pixCircle(g, x - 4, y - 15, 4, '#2b2233'); pixCircle(g, x + 3, y - 16, 4, '#2b2233'); pixCircle(g, x, y - 20, 4, '#2b2233');
    pixCircle(g, x - 4, y - 15, 3, '#4f9a5a'); pixCircle(g, x + 3, y - 16, 3, '#4f9a5a'); pixCircle(g, x, y - 20, 3, '#6cc47a');
    P(g, x - 1, y - 22, 2, 1, '#86d690'); P(g, x - 6, y - 10, 12, 11, '#2b2233'); P(g, x - 5, y - 8, 10, 8, '#c96f4a'); P(g, x - 6, y - 10, 12, 2, '#e08a5f');
  }
  function speaker(g, x) {
    P(g, x - 1, 3, 10, 53, '#0e0d12'); P(g, x, 4, 8, 51, '#24222b'); P(g, x, 4, 8, 1, '#3a3744');
    for (let y = 8; y < 50; y += 4) { P(g, x + 2, y, 4, 2, '#3a3744'); P(g, x + 3, y, 2, 1, '#17151c'); }
    P(g, x + 1, 52, 6, 2, '#3a3744');
  }
  // guitars on stands, drawn from a pixel map so the neck always meets the body
  const GUITAR_BODY = ['kk..knk..kk', 'khk.knk.kBk', 'kBhkknkkBBk', 'kBBBWpWBBBk', '.kBBWWWBBk.', '.kBBWpWBBk.', 'kBBBBWBBBBk', 'kBBBBdBBBBk', 'kBBBBBBKBBk', 'kbBBBBBBBbk', '.kbBBBBBbk.', '..kkkkkkk..'];
  const GUITAR_HEAD = ['....kkk....', '....kHHk...', '....kHHk...', '....kHHk...', '....kHk....', '....kNk....'];
  const GUITAR_STAND = ['...k...k...', '..k.....k..', '.kk.....kk.'];
  function guitar(g, x, pal, neckLen) {
    const neck = []; for (let i = 0; i < neckLen; i++) neck.push(i % 3 === 2 && i < neckLen - 2 ? '....kfk....' : '....knk....');
    const rows = GUITAR_HEAD.concat(neck, GUITAR_BODY, GUITAR_STAND), top = 94 - rows.length;
    const col = Object.assign({ k: '#121117', N: '#f4f1ea', p: '#2a2830', d: '#c9c9d4', K: '#c9c9d4' }, pal);
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') P(g, x - 5 + i, top + j, 1, 1, col[r[i]]); });
  }
  const ELEC = { B: '#d84b3a', b: '#9e2f24', h: '#f58a72', W: '#f4f1ea', H: '#d8b98a', n: '#d8b98a', f: '#3a2418' };
  const BASS = { B: '#7a4222', b: '#2e1a10', h: '#b36e34', W: '#e9e0cc', H: '#3a2418', n: '#5a3a26', f: '#e9e4da' };
  const DOOR = { frame: '#0e0d12', slab: '#24232a', hi: '#3c3b46', knob: '#c9c9d4' };
  function sideDoor(g, x, y, right) {
    const fx = right ? x - 7 : x;
    P(g, fx, y - 15, 8, 30, DOOR.frame); P(g, fx + 1, y - 14, 6, 28, DOOR.slab); P(g, fx + (right ? 1 : 6), y - 14, 1, 28, DOOR.hi);
    P(g, right ? fx + 2 : fx + 5, y - 1, 1, 3, DOOR.knob);
  }

  // ---- 본당 ----
  const sanctSeats = [];
  for (let row = 0; row < 7; row++) [15, 31, 47, 63, 119, 135, 151, 167].forEach(x => sanctSeats.push(mkSeat(x, 124 + row * 25, 'up', 'fold')));
  function bgSanctuary(g, w, h) {
    woodFloor(g, w, h, 40, ['#c4915f', '#bd8a5a', '#c99866'], '#d2a372', '#a87a4f');
    backWall(g, w, '#f4f1ec', '#ebe6de');
    sideWalls(g, w, h, 6, '#ece7df');
    P(g, 0, h - 4, w, 4, '#ece7df'); P(g, 0, h - 5, w, 1, '#cbc2b4');
    // exit door in the middle of the left wall
    P(g, 0, 203, 8, 29, DOOR.frame); P(g, 0, 205, 6, 25, DOOR.slab); P(g, 5, 205, 1, 25, DOOR.hi); P(g, 4, 216, 1, 3, DOOR.knob);
    P(g, 1, 196, 5, 5, '#2f8a55'); P(g, 2, 197, 3, 3, '#7fe0a0');
    P(g, 8, 210, 5, 14, '#7a3b44'); P(g, 9, 211, 3, 12, '#94505b');
  }
  const sanctItems = [
    { id: 'spkL', label: '스피커(왼쪽)', box: [69, 3, 10, 53], sortY: 56, obs: [[69, 46, 10, 10]], draw: g => speaker(g, 70) },
    { id: 'spkR', label: '스피커(오른쪽)', box: [113, 3, 10, 53], sortY: 56, obs: [[113, 46, 10, 10]], draw: g => speaker(g, 114) },
    { id: 'drum', label: '전자드럼', box: [12, 55, 36, 40], sortY: 94, obs: [[21, 58, 27, 36]], draw: g => {
      P(g, 22, 60, 2, 32, '#3a3a44'); P(g, 44, 60, 2, 32, '#3a3a44'); P(g, 22, 62, 24, 2, '#3a3a44'); P(g, 22, 88, 24, 2, '#3a3a44');
      for (const [x, y, rr] of [[26, 62, 4], [44, 60, 4], [24, 90, 3]]) { pixCircle(g, x, y, rr + 1, '#121117'); pixCircle(g, x, y, rr, '#c9c9d4'); pixCircle(g, x, y, 1, '#8b8b98'); }
      for (const [x, y] of [[30, 70], [38, 68], [30, 82], [40, 80]]) { pixCircle(g, x, y, 4, '#121117'); pixCircle(g, x, y, 3, '#2f2f39'); pixCircle(g, x, y, 2, '#4a4a56'); }
      P(g, 35, 73, 8, 6, '#121117'); P(g, 36, 74, 6, 4, '#2f2f39'); P(g, 41, 74, 1, 4, '#5aa9e6');
      P(g, 25, 74, 5, 4, '#121117'); P(g, 26, 75, 3, 2, '#5aa9e6');
      pixCircle(g, 16, 82, 3, '#121117'); pixCircle(g, 16, 82, 2, '#3a2c36');
    } },
    { id: 'bass', label: '베이스', box: [49, 59, 11, 35], sortY: 95, obs: [[48, 84, 12, 11]], draw: g => guitar(g, 54, BASS, 14) },
    { id: 'elec', label: '일렉기타', box: [61, 62, 11, 32], sortY: 95, obs: [[60, 84, 12, 11]], draw: g => guitar(g, 66, ELEC, 11) },
    { id: 'stand', label: '인도자 보면대(QT)', box: [90, 56, 14, 17], sortY: 72, obs: [[91, 66, 11, 7]], draw: g => {
      P(g, 91, 57, 12, 7, '#121117'); P(g, 92, 58, 10, 5, '#3a3a44'); P(g, 93, 58, 8, 4, '#f4f1ec');
      P(g, 94, 59, 4, 1, '#9aa0ab'); P(g, 94, 61, 5, 1, '#9aa0ab');
      P(g, 96, 64, 1, 8, '#121117'); P(g, 93, 72, 7, 1, '#121117'); P(g, 93, 71, 1, 1, '#121117'); P(g, 99, 71, 1, 1, '#121117');
    } },
    { id: 'synth', label: '신디사이저', box: [137, 53, 17, 27], sortY: 76, obs: [[137, 54, 17, 24]], draw: g => {
      P(g, 138, 54, 15, 23, '#0e0d12'); P(g, 139, 55, 13, 21, '#2a2a33');
      P(g, 148, 56, 3, 19, '#f4f1ec'); for (let y = 57; y < 75; y += 3) P(g, 148, y, 2, 1, '#121117');
      P(g, 141, 58, 4, 3, '#5aa9e6'); P(g, 141, 63, 2, 1, '#ff7a6b'); P(g, 141, 66, 2, 1, '#7bd389');
      P(g, 139, 77, 2, 2, '#121117'); P(g, 150, 77, 2, 2, '#121117');
    } },
    { id: 'piano', label: '메인 피아노', box: [137, 81, 20, 28], sortY: 106, obs: [[137, 82, 20, 26]], draw: g => {
      P(g, 138, 82, 18, 25, '#0e0d12'); P(g, 139, 83, 16, 23, '#1f1d24'); P(g, 140, 85, 3, 19, '#2f2c36');
      P(g, 151, 84, 3, 21, '#f4f1ec'); for (let y = 85; y < 104; y += 3) P(g, 151, y, 2, 1, '#121117');
      P(g, 139, 106, 2, 2, '#0e0d12'); P(g, 153, 106, 2, 2, '#0e0d12');
    } },
    { id: 'qr', label: '헌금함', box: [6, 286, 20, 40], sortY: 324, obs: [[7, 312, 18, 13]], draw: g => {
      P(g, 7, 304, 18, 21, '#3b2a22'); P(g, 8, 305, 16, 19, '#8a5a3b'); P(g, 8, 305, 16, 2, '#a8734f');
      P(g, 10, 299, 12, 7, '#3b2a22'); P(g, 11, 300, 10, 5, '#6b4430'); P(g, 13, 301, 6, 1, '#2a1d2e');
      P(g, 10, 287, 12, 12, '#2a1d2e'); P(g, 11, 288, 10, 10, '#ffffff');
      ['1110101', '1010011', '1110101', '0001010', '1101101', '1001011', '1110111'].forEach((row, j) => [...row].forEach((v, i) => { if (v === '1') P(g, 12 + i, 289 + j + (j > 3 ? 1 : 0), 1, 1, '#2a1d2e'); }));
    } },
    { id: 'prayer', label: '익명 기도제목함', box: [6, 329, 21, 24], sortY: 352, obs: [[7, 341, 19, 11]], draw: g => {
      P(g, 7, 336, 19, 16, '#3b2a22'); P(g, 8, 337, 17, 14, '#c99a63'); P(g, 8, 337, 17, 2, '#e0b47c');
      P(g, 11, 340, 11, 2, '#3b2a22');
      P(g, 10, 330, 6, 8, '#fff7e0'); P(g, 15, 331, 6, 7, '#ffe1ea'); P(g, 11, 332, 4, 1, '#c9b48a'); P(g, 16, 333, 4, 1, '#d9a3b3');
      P(g, 12, 345, 9, 4, '#8a5a3b'); P(g, 13, 346, 7, 2, '#f2e6c8');
    } },
    { id: 'board', label: '광고 게시판', box: [148, 288, 32, 31], sortY: 318, obs: [[149, 309, 30, 9]], draw: g => {
      P(g, 152, 308, 2, 10, '#3b2a22'); P(g, 174, 308, 2, 10, '#3b2a22');
      P(g, 149, 289, 30, 21, '#3b2a22'); P(g, 150, 290, 28, 19, '#6b4430'); P(g, 152, 292, 24, 15, '#c99a63');
      P(g, 154, 294, 8, 6, '#ffffff'); P(g, 164, 293, 9, 5, '#ffe58a'); P(g, 163, 300, 10, 6, '#ffc2cf'); P(g, 154, 301, 7, 5, '#c9e8ff');
      P(g, 157, 294, 2, 1, '#d84b3a'); P(g, 168, 293, 2, 1, '#3fb5a3');
    } },
    { id: 'eq', label: 'EQ 데스크', box: [116, 330, 70, 24], sortY: 352, obs: [[117, 338, 68, 15]], draw: g => {
      P(g, 117, 335, 68, 18, '#3b2a22'); P(g, 118, 336, 66, 16, '#5a3d2a'); P(g, 118, 336, 66, 1, '#7a5238');
      P(g, 122, 331, 42, 12, '#121117'); P(g, 123, 332, 40, 10, '#2a2a33');
      for (let x = 125; x < 161; x += 4) { P(g, x, 333, 1, 7, '#4a4a55'); P(g, x, 334 + (x % 3) * 2, 2, 1, x % 8 === 1 ? '#ff7a6b' : '#f4efe6'); }
      P(g, 166, 331, 15, 9, '#2a1d2e'); P(g, 167, 332, 13, 7, '#9aa0ab'); P(g, 168, 333, 11, 4, '#5aa9e6');
    } }
  ];

  // ---- 복도 ----
  const ROOM_INFO = {
    room1: { n: 'ROOM 1', sub: '회의실' }, room2: { n: 'ROOM 2', sub: '탕비실' },
    room3: { n: 'ROOM 3', sub: '세미나실' }, room4: { n: 'ROOM 4', sub: '라운지' },
    f1r1: { n: 'ROOM 1', sub: '락커룸' }, f1r2: { n: 'ROOM 2', sub: '준비 중' }, f1r3: { n: 'ROOM 3', sub: '준비 중' }, f1r4: { n: 'ROOM 4', sub: '준비 중' }
  };
  const HALL_DOORS = [['room1', 16, 100, false], ['room2', 16, 200, false], ['room3', 144, 100, true], ['room4', 144, 200, true]];
  function bgHall(g, w, h) {
    woodFloor(g, w, h, 40, ['#c4915f', '#bd8a5a', '#c99866'], '#d2a372', '#a87a4f');
    backWall(g, w, '#f4f1ec', '#ebe6de');
    P(g, 62, 9, 36, 35, DOOR.frame); P(g, 64, 11, 15, 33, DOOR.slab); P(g, 81, 11, 15, 33, DOOR.slab);
    P(g, 64, 11, 15, 1, DOOR.hi); P(g, 81, 11, 15, 1, DOOR.hi); P(g, 79, 11, 2, 33, DOOR.frame);
    P(g, 76, 25, 1, 6, DOOR.knob); P(g, 83, 25, 1, 6, DOOR.knob);
    sideWalls(g, w, h, 16, '#ece7df');
    P(g, 0, h - 8, w, 8, '#ece7df'); P(g, 0, h - 9, w, 1, '#cbc2b4');
    for (const [, x, y, right] of HALL_DOORS) { sideDoor(g, right ? x + 6 : x - 6, y, right); P(g, right ? x - 6 : x + 1, y - 7, 5, 14, '#7a3b44'); }
    elevatorBottom(g, w, h);
  }
  const hallItems = [
    { id: 'h-plant1', label: '화분', box: [20, 246, 16, 26], sortY: 270, obs: [[22, 262, 12, 8]], draw: g => plant(g, 28, 270) },
    { id: 'h-plant2', label: '화분', box: [124, 246, 16, 26], sortY: 270, obs: [[126, 262, 12, 8]], draw: g => plant(g, 132, 270) },
    { id: 'h-bench', label: '벤치', box: [124, 132, 16, 36], sortY: 166, obs: [[124, 136, 16, 30]], draw: g => {
      P(g, 125, 134, 14, 32, '#3b2a22'); P(g, 126, 135, 12, 30, '#a8734f'); for (let y = 138; y < 164; y += 5) P(g, 126, y, 12, 1, '#8a5a3b');
      P(g, 136, 135, 2, 30, '#8a5a3b');
    } },
    { id: 'h-cooler', label: '공기청정기', box: [22, 136, 12, 22], sortY: 158, obs: [[22, 148, 12, 10]], draw: g => {
      P(g, 22, 137, 12, 21, '#3b3a44'); P(g, 23, 138, 10, 19, '#f3f0e9'); for (let y = 141; y < 150; y += 2) P(g, 25, y, 6, 1, '#c6c9cf'); P(g, 26, 152, 4, 2, '#7bd389');
    } }
  ];

  // ---- rooms ----
  function roomShell(g, w, h, floor, wall) {
    floor(g, w, h);
    backWall(g, w, wall, shade(wall, 0.95));
    sideWalls(g, w, h, 6, '#ece7df');
    frontWallWithDoor(g, w, h, '#ece7df');
  }
  const r1Seats = [60, 80, 100, 120].map(x => mkSeat(x, 82, 'down', 'office')).concat([60, 80, 100, 120].map(x => mkSeat(x, 114, 'up', 'office', 16)));
  function bgRoom1(g, w, h) {
    roomShell(g, w, h, (gg) => floorTiles(gg, w, h, 44, ['#7d8796', '#76808f'], 12, '#6c7584'), '#eef0f2');
    P(g, 62, 7, 68, 30, '#9aa0ab'); P(g, 64, 9, 64, 26, '#ffffff'); P(g, 68, 14, 22, 1, '#4f7ec4'); P(g, 68, 18, 30, 1, '#4f7ec4'); P(g, 100, 13, 20, 12, '#ffe1ea'); P(g, 70, 24, 18, 1, '#c94a45');
    P(g, 64, 36, 64, 2, '#c6c9cf'); P(g, 150, 10, 12, 12, '#2b2930'); P(g, 151, 11, 10, 10, '#f3f0e9'); P(g, 156, 13, 1, 4, '#2b2930'); P(g, 156, 16, 3, 1, '#2b2930');
  }
  const room1Items = [
    { id: 'r1-table', label: '회의 테이블', fixed: true, box: [52, 86, 88, 28], sortY: 112, obs: [[54, 88, 84, 22]], draw: g => {
      P(g, 53, 87, 86, 25, '#3b2a22'); P(g, 54, 88, 84, 18, '#b07a4f'); P(g, 54, 88, 84, 1, '#c99a63'); P(g, 54, 106, 84, 5, '#8a5a3b');
      P(g, 66, 92, 10, 7, '#f3f0e9'); P(g, 104, 94, 12, 8, '#2b2930'); P(g, 105, 95, 10, 5, '#5a7fb0'); P(g, 90, 96, 4, 4, '#f0cc55');
    } },
    { id: 'r1-plant', label: '화분', box: [162, 40, 16, 26], sortY: 66, obs: [[164, 56, 12, 8]], draw: g => plant(g, 170, 64) }
  ];
  const r2Seats = [84, 100].map(x => mkSeat(x, 96, 'down', 'office')).concat([84, 100].map(x => mkSeat(x, 128, 'up', 'office', 16)));
  function bgRoom2(g, w, h) {
    roomShell(g, w, h, (gg) => floorTiles(gg, w, h, 44, ['#e9e4da', '#ddd6c9'], 10, '#cfc7b8'), '#f6efe3');
    P(g, 20, 6, 100, 18, '#c99a63'); for (let x = 20; x < 120; x += 25) { P(g, x, 6, 1, 18, '#8a5a3b'); P(g, x + 11, 13, 3, 2, '#f2c94c'); } P(g, 20, 23, 100, 2, '#8a5a3b');
  }
  const room2Items = [
    { id: 'r2-counter', label: '싱크대·커피머신', box: [20, 26, 100, 32], sortY: 58, obs: [[20, 44, 100, 14]], draw: g => {
      P(g, 20, 40, 100, 18, '#3b2a22'); P(g, 21, 41, 98, 6, '#e9e4da'); P(g, 21, 47, 98, 10, '#c99a63'); for (let x = 21; x < 119; x += 24) P(g, x, 47, 1, 10, '#8a5a3b');
      P(g, 56, 42, 18, 4, '#9aa0ab'); P(g, 58, 43, 14, 2, '#cfe0ea'); P(g, 64, 36, 2, 6, '#9aa0ab');
      P(g, 88, 26, 16, 17, '#26252b'); P(g, 90, 28, 12, 6, '#4a4c56'); P(g, 94, 36, 4, 5, '#f3f0e9'); P(g, 91, 29, 2, 1, '#e8894a');
      P(g, 30, 34, 14, 8, '#f3f0e9'); P(g, 31, 35, 9, 6, '#3b3a44'); P(g, 41, 36, 2, 4, '#c6c9cf');
    } },
    { id: 'r2-fridge', label: '냉장고', box: [128, 14, 22, 46], sortY: 60, obs: [[128, 48, 22, 12]], draw: g => {
      P(g, 128, 15, 22, 45, '#3b3a44'); P(g, 129, 16, 20, 43, '#e9ecef'); P(g, 129, 33, 20, 1, '#9aa0ab'); P(g, 146, 20, 1, 9, '#9aa0ab'); P(g, 146, 37, 1, 12, '#9aa0ab');
      P(g, 132, 20, 5, 4, '#f0cc55'); P(g, 138, 22, 4, 3, '#f0a9bb');
    } },
    { id: 'r2-water', label: '정수기', box: [158, 18, 18, 42], sortY: 60, obs: [[159, 50, 16, 10]], draw: g => {
      P(g, 161, 18, 12, 14, '#2f6fae'); P(g, 162, 19, 10, 12, '#7fb8e8'); P(g, 163, 20, 3, 8, '#c9e4f8');
      P(g, 159, 31, 16, 29, '#3b3a44'); P(g, 160, 32, 14, 27, '#f3f0e9'); P(g, 162, 38, 3, 3, '#c94a45'); P(g, 169, 38, 3, 3, '#4f7ec4'); P(g, 162, 46, 10, 2, '#9aa0ab');
    } },
    { id: 'r2-table', label: '둥근 테이블', fixed: true, box: [80, 96, 32, 32], sortY: 126, obs: [[82, 100, 28, 22]], draw: g => {
      pixCircle(g, 96, 110, 14, '#3b2a22'); pixCircle(g, 96, 109, 13, '#f3f0e9'); pixCircle(g, 96, 109, 11, '#e9e4da');
      P(g, 94, 122, 4, 4, '#3b2a22'); P(g, 88, 104, 6, 5, '#f3f0e9'); P(g, 89, 105, 4, 3, '#7a5238'); P(g, 101, 110, 5, 4, '#f0cc55');
    } }
  ];
  const r3Seats = [];
  for (const y of [92, 120]) for (const x of [44, 64, 120, 140]) r3Seats.push(mkSeat(x, y, 'up', 'office'));
  function bgRoom3(g, w, h) {
    roomShell(g, w, h, (gg) => woodFloor(gg, w, h, 40, ['#9a6a46', '#93643f', '#a0704b'], '#ad7d55', '#7a5238'), '#ece7df');
    P(g, 54, 5, 84, 32, '#1b1d24'); P(g, 57, 8, 78, 26, '#3a4f7a'); P(g, 62, 13, 40, 3, '#9cc6e8'); P(g, 62, 19, 56, 2, '#c9e4f8'); P(g, 62, 24, 30, 2, '#c9e4f8');
    P(g, 94, 37, 4, 4, '#1b1d24');
  }
  const room3Items = [
    { id: 'r3-podium', label: '강대', box: [150, 46, 20, 28], sortY: 72, obs: [[152, 60, 16, 12]], draw: g => {
      P(g, 151, 52, 18, 20, '#3b2a22'); P(g, 152, 53, 16, 18, '#8a5a3b'); P(g, 152, 53, 16, 3, '#a8734f'); P(g, 158, 47, 1, 6, '#26252b'); P(g, 157, 46, 3, 2, '#26252b');
    } },
    { id: 'r3-plant', label: '화분', box: [14, 40, 16, 26], sortY: 66, obs: [[16, 56, 12, 8]], draw: g => plant(g, 22, 64) }
  ];
  const r4Seats = [66, 82, 98, 114].map(x => mkSeat(x, 64, 'down', 'sofa', 12)).concat([66, 82, 98, 114].map(x => mkSeat(x, 124, 'up', 'sofa', -12)));
  function bgRoom4(g, w, h) {
    roomShell(g, w, h, (gg) => floorTiles(gg, w, h, 44, ['#c9b28f', '#c3ab87'], 12, '#b89f7a'), '#f3ebe0');
    P(g, 40, 80, 112, 40, '#5f8a55'); P(g, 42, 82, 108, 36, '#7aa56d'); P(g, 46, 86, 100, 1, '#c9e0a8'); P(g, 46, 113, 100, 1, '#c9e0a8');
    P(g, 150, 8, 26, 20, '#6b4430'); P(g, 152, 10, 22, 16, '#9cc6e8'); P(g, 152, 18, 22, 8, '#7aa56d'); pixCircle(g, 168, 14, 2, '#fff3c4');
  }
  const room4Items = [
    { id: 'r4-sofa1', label: '소파', fixed: true, box: [58, 46, 76, 26], sortY: 60, obs: [[58, 50, 76, 20]], draw: g => {
      P(g, 58, 47, 76, 24, '#3b2a22'); P(g, 59, 48, 74, 10, '#c94a45'); P(g, 59, 58, 74, 12, '#e06b5f'); P(g, 59, 48, 74, 1, '#e8897c');
      P(g, 58, 52, 5, 18, '#a83c38'); P(g, 129, 52, 5, 18, '#a83c38'); for (let x = 77; x < 130; x += 17) P(g, x, 58, 1, 12, '#c94a45');
    } },
    { id: 'r4-sofa2', label: '소파', fixed: true, box: [58, 118, 76, 26], sortY: 140, obs: [[58, 120, 76, 20]], draw: g => {
      P(g, 58, 119, 76, 24, '#3b2a22'); P(g, 59, 120, 74, 10, '#e06b5f'); P(g, 59, 130, 74, 12, '#c94a45'); P(g, 59, 141, 74, 1, '#a83c38');
      P(g, 58, 120, 5, 18, '#a83c38'); P(g, 129, 120, 5, 18, '#a83c38'); for (let x = 77; x < 130; x += 17) P(g, x, 120, 1, 10, '#c94a45');
    } },
    { id: 'r4-table', label: '커피 테이블', fixed: true, box: [76, 88, 40, 18], sortY: 104, obs: [[76, 90, 40, 14]], draw: g => {
      P(g, 76, 89, 40, 15, '#3b2a22'); P(g, 77, 90, 38, 10, '#8a5a3b'); P(g, 77, 90, 38, 1, '#a8734f'); P(g, 77, 100, 38, 3, '#6b4430');
      P(g, 84, 92, 6, 5, '#f3f0e9'); P(g, 85, 93, 4, 3, '#7a5238'); P(g, 100, 92, 8, 5, '#f0a9bb');
    } },
    { id: 'r4-shelf', label: '책장', box: [12, 12, 36, 48], sortY: 60, obs: [[12, 48, 36, 12]], draw: g => {
      P(g, 12, 13, 36, 47, '#3b2a22'); P(g, 13, 14, 34, 45, '#8a5a3b');
      const cols = ['#c94a45', '#4f7ec4', '#f0cc55', '#5f8a55', '#b8a6dc', '#f3f0e9'];
      [16, 29, 42].forEach((y, si) => { P(g, 14, y + 10, 32, 2, '#6b4430'); let x = 15; for (let i = 0; i < 8 && x < 44; i++) { const ww = 2 + ((i + si) % 2); P(g, x, y + 10 - (7 + (i * 3 + si) % 3), ww, 7 + (i * 3 + si) % 3, cols[(i + si * 2) % cols.length]); x += ww + 1; } });
    } },
    { id: 'r4-lamp', label: '스탠드', box: [162, 40, 14, 30], sortY: 70, obs: [[164, 64, 10, 6]], draw: g => {
      P(g, 164, 67, 10, 3, '#26252b'); P(g, 168, 50, 2, 18, '#26252b');
      for (let i = 0; i < 9; i++) P(g, 165 - Math.floor(i / 3), 41 + i, 8 + 2 * Math.floor(i / 3), 1, i === 0 ? '#26252b' : '#f7ecc4');
    } }
  ];
  // ================= 엘리베이터 · 1층 · 3층 옥상 =================
  // elevator in the bottom wall of a hallway (opposite the top door)
  function elevatorBottom(g, w, h) {
    const x = w / 2 - 16;
    P(g, x - 2, h - 10, 36, 10, '#8d8f99'); P(g, x - 1, h - 9, 34, 9, '#b9bcc6');
    P(g, x, h - 8, 15, 8, '#d9dce3'); P(g, x + 17, h - 8, 15, 8, '#d9dce3'); P(g, x + 15, h - 8, 2, 8, '#8d8f99');
    P(g, x, h - 8, 15, 1, '#f4f5f8'); P(g, x + 17, h - 8, 15, 1, '#f4f5f8');
    P(g, x + 36, h - 9, 3, 6, '#3b3a44'); P(g, x + 37, h - 8, 1, 1, '#ffcc4d'); P(g, x + 37, h - 6, 1, 1, '#7bd389');
    P(g, x + 2, h - 22, 28, 12, 'rgba(60,40,20,.10)');
  }
  const ELEV_SPOT = (w, h) => ({ id: 'elevator', item: null, x: w / 2, y: h - 18, r: 14, ax: w / 2, ay: h - 34, hit: [w / 2 - 18, h - 12, 36, 12], label: '엘리베이터 타기' });

  // 1층 복도: same as 2층, glass exit doors on the top wall
  const HALL1_DOORS = [['f1r1', 16, 100, false], ['f1r2', 16, 200, false], ['f1r3', 144, 100, true], ['f1r4', 144, 200, true]];
  function bgHall1(g, w, h) {
    woodFloor(g, w, h, 40, ['#c4915f', '#bd8a5a', '#c99866'], '#d2a372', '#a87a4f');
    backWall(g, w, '#f4f1ec', '#ebe6de');
    // glass entrance doors
    P(g, 58, 7, 44, 37, '#0e0d12'); P(g, 60, 9, 19, 35, '#9fc6d8'); P(g, 81, 9, 19, 35, '#9fc6d8');
    for (const x0 of [60, 81]) { P(g, x0, 9, 19, 2, '#c9e4ef'); P(g, x0 + 3, 13, 2, 26, 'rgba(255,255,255,.55)'); P(g, x0 + 7, 13, 1, 18, 'rgba(255,255,255,.4)'); }
    P(g, 79, 9, 2, 35, '#0e0d12'); P(g, 75, 24, 2, 7, '#c9c9d4'); P(g, 83, 24, 2, 7, '#c9c9d4');
    P(g, 70, 1, 20, 5, '#2f8a55'); P(g, 71, 2, 18, 3, '#3fae6c');   // EXIT sign
    P(g, 44, 46, 72, 12, '#7a3b44'); P(g, 45, 47, 70, 10, '#94505b'); for (let x = 48; x < 112; x += 4) P(g, x, 49, 2, 6, '#7a3b44');   // door mat
    sideWalls(g, w, h, 16, '#ece7df');
    P(g, 0, h - 8, w, 8, '#ece7df'); P(g, 0, h - 9, w, 1, '#cbc2b4');
    elevatorBottom(g, w, h);
    for (const [id, x, y, right] of HALL1_DOORS) {
      sideDoor(g, right ? x + 6 : x - 6, y, right);
      P(g, right ? x - 6 : x + 1, y - 7, 5, 14, id === 'f1r1' ? '#2f8a55' : '#8d8f99');
      if (id !== 'f1r1') { P(g, right ? x - 10 : x + 4, y - 3, 6, 6, '#ffcc4d'); P(g, right ? x - 9 : x + 5, y - 2, 4, 4, '#251c2c'); P(g, right ? x - 8 : x + 6, y - 1, 2, 2, '#ffcc4d'); }
    }
  }
  const hall1Items = [
    { id: 'h1-plant1', label: '화분', box: [20, 246, 16, 26], sortY: 270, obs: [[22, 262, 12, 8]], draw: g => plant(g, 28, 270) },
    { id: 'h1-plant2', label: '화분', box: [124, 246, 16, 26], sortY: 270, obs: [[126, 262, 12, 8]], draw: g => plant(g, 132, 270) },
    { id: 'h1-sofa', label: '대기 소파', box: [122, 130, 18, 40], sortY: 168, obs: [[124, 134, 16, 34]], draw: g => {
      P(g, 123, 132, 17, 37, '#2b2233'); P(g, 124, 133, 15, 35, '#5d6a8c'); P(g, 135, 133, 4, 35, '#4a5675'); for (let y = 144; y < 166; y += 11) P(g, 124, y, 11, 1, '#4a5675');
    } },
    { id: 'h1-info', label: '안내판', box: [20, 132, 14, 30], sortY: 160, obs: [[22, 150, 10, 10]], draw: g => {
      P(g, 26, 146, 2, 14, '#3b3a44'); P(g, 21, 133, 12, 15, '#251c2c'); P(g, 22, 134, 10, 13, '#f4f1ea'); P(g, 23, 136, 8, 1, '#2f8a55'); P(g, 23, 139, 6, 1, '#8d8f99'); P(g, 23, 142, 7, 1, '#8d8f99');
    } }
  ];

  // ---- ROOM 1 (1층) · 락커룸 ----
  const SEAT_COL_EXTRA = { benchW: ['#2b2233', '#f4f1ea', '#ffffff', '#d9d4ca'], benchB: ['#0e0d12', '#2c2a31', '#4a4752', '#1d1b22'], wood: ['#3b2a22', '#a8734f', '#c99866', '#8a5a3b'] };
  Object.assign(SEAT_COL, SEAT_COL_EXTRA);
  const lockerSeats = [14, 27, 40, 53, 66].map(x => Object.assign(mkSeat(x, 64, 'down', 'benchW'), { team: 'w' }))
    .concat([117, 130, 143, 156, 169].map(x => Object.assign(mkSeat(x, 64, 'down', 'benchB'), { team: 'b' })));
  function locker(g, x, y, open, kit, num) {
    P(g, x, y, 13, 30, '#2b2233'); P(g, x + 1, y + 1, 11, 28, open ? '#3a3d4c' : '#5d6a8c');
    if (!open) { for (let k = 0; k < 3; k++) P(g, x + 3, y + 4 + k * 2, 7, 1, '#4a5675'); P(g, x + 9, y + 14, 2, 4, '#c9c9d4'); P(g, x + 4, y + 22, 5, 3, '#f4f1ea'); P(g, x + 5, y + 23, 3, 1, '#8d8f99'); }
    else {
      P(g, x + 1, y + 1, 11, 28, '#1d1b22'); P(g, x + 2, y + 3, 9, 1, '#8d8f99');
      // jersey on a hanger
      const c = kit === 'w' ? '#f4f1ea' : '#2c2a31', d = kit === 'w' ? '#d9d4ca' : '#121117';
      P(g, x + 5, y + 4, 3, 1, '#c9c9d4'); P(g, x + 3, y + 5, 7, 9, c); P(g, x + 2, y + 5, 2, 4, c); P(g, x + 9, y + 5, 2, 4, c); P(g, x + 5, y + 5, 3, 1, d);
      P(g, x + 5, y + 8, 3, 4, kit === 'w' ? '#2c2a31' : '#f4f1ea'); P(g, x + 6, y + 9, 1, 2, c);
      P(g, x + 3, y + 23, 3, 2, '#d84b3a'); P(g, x + 7, y + 23, 3, 2, '#d84b3a'); P(g, x + 3, y + 25, 7, 1, '#f4f1ea');   // boots
      P(g, x + 12, y + 1, 4, 28, '#4a5675'); P(g, x + 13, y + 14, 1, 3, '#c9c9d4');   // open door
    }
    if (num) { P(g, x + 4, y + 1, 5, 2, '#f4f1ea'); }
  }
  function soccerBall(g, x, y) {
    pixCircle(g, x, y, 3, '#2b2233'); pixCircle(g, x, y, 2, '#f4f1ea'); P(g, x - 1, y - 1, 2, 2, '#2b2233'); P(g, x + 1, y + 1, 1, 1, '#8d8f99');
  }
  function bgLocker(g, w, h) {
    floorTiles(g, w, h, 44, ['#cfd3d6', '#c6cacd'], 8, '#b9bdc1');
    P(g, 0, 0, w, 44, '#e6e2d8'); P(g, 0, 39, w, 5, '#d4cfc3'); P(g, 0, 44, w, 2, 'rgba(60,40,20,.16)');
    // lockers along the back wall, either side of the pitch door
    const open = { 1: 'w', 4: 'b', 10: 'w' };
    [4, 17, 30, 43, 56, 69].forEach((x, i) => locker(g, x, 8, !!open[i], open[i], true));
    [110, 123, 136, 149, 162, 175].forEach((x, i) => locker(g, x, 8, !!open[i + 6], open[i + 6], true));
    // pitch door (green) with a paper sign
    P(g, 82, 6, 28, 38, '#0e0d12'); P(g, 84, 8, 11, 36, '#2f8a55'); P(g, 97, 8, 11, 36, '#2f8a55'); P(g, 84, 8, 24, 2, '#3fae6c'); P(g, 95, 8, 2, 36, '#0e0d12');
    P(g, 92, 24, 1, 6, '#c9c9d4'); P(g, 99, 24, 1, 6, '#c9c9d4'); P(g, 86, 12, 7, 6, '#9fc6d8'); P(g, 99, 12, 7, 6, '#9fc6d8');
    sideWalls(g, w, h, 6, '#e6e2d8');
    frontWallWithDoor(g, w, h, '#e6e2d8');
    // floor marking: a big centre line, like a pitch
    P(g, 20, 112, w - 40, 1, 'rgba(255,255,255,.55)');
    for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; P(g, Math.round(96 + Math.cos(t) * 18), Math.round(112 + Math.sin(t) * 12), 1, 1, 'rgba(255,255,255,.55)'); }
  }
  const lockerItems = [
    { id: 'lk-sign', label: '축구장 안내', box: [111, 0, 0, 0], sortY: 0, fixed: true, obs: [], draw: g => {
      // paper taped to the wall next to the door: "축구장 ↓"
      P(g, 68, 22, 13, 15, '#fdfcf7'); P(g, 68, 22, 13, 1, '#e6e2d8'); P(g, 70, 21, 3, 2, 'rgba(255,204,77,.8)'); P(g, 76, 21, 3, 2, 'rgba(255,204,77,.8)');
      P(g, 70, 25, 9, 1, '#251c2c'); P(g, 70, 27, 9, 1, '#251c2c'); P(g, 74, 29, 1, 5, '#d84b3a'); P(g, 72, 32, 5, 1, '#d84b3a'); P(g, 73, 33, 3, 1, '#d84b3a');
    } },
    { id: 'lk-basket', label: '공 바구니', box: [14, 120, 22, 20], sortY: 138, obs: [[14, 128, 22, 10]], draw: g => {
      P(g, 14, 126, 22, 13, '#2b2233'); P(g, 15, 127, 20, 11, '#5a4a3a'); for (let x = 17; x < 35; x += 3) P(g, x, 127, 1, 11, '#3b2f25');
      soccerBall(g, 19, 124); soccerBall(g, 25, 123); soccerBall(g, 31, 124); soccerBall(g, 22, 120);
    } },
    { id: 'lk-board', label: '작전판', box: [160, 112, 22, 30], sortY: 140, obs: [[162, 132, 18, 8]], draw: g => {
      P(g, 170, 128, 2, 12, '#3b3a44'); P(g, 160, 112, 22, 18, '#2b2233'); P(g, 161, 113, 20, 16, '#f4f1ea'); P(g, 170, 113, 1, 16, '#9fc6d8');
      P(g, 164, 117, 2, 2, '#d84b3a'); P(g, 175, 122, 2, 2, '#3f6fb8'); P(g, 166, 120, 6, 1, '#251c2c'); P(g, 171, 119, 1, 3, '#251c2c'); P(g, 165, 125, 2, 1, '#d84b3a');
    } },
    { id: 'lk-cones', label: '콘', box: [150, 148, 26, 10], sortY: 156, obs: [], draw: g => {
      for (const x of [152, 160, 168]) { P(g, x, 152, 5, 4, '#2b2233'); P(g, x + 1, 151, 3, 4, '#f08a3a'); P(g, x + 2, 149, 1, 2, '#f08a3a'); P(g, x + 1, 153, 3, 1, '#f4f1ea'); }
    } },
    { id: 'lk-ball', label: '축구공', box: [92, 132, 8, 8], sortY: 138, obs: [], draw: g => soccerBall(g, 96, 136) },
    { id: 'lk-towel', label: '수건', box: [44, 150, 20, 10], sortY: 158, obs: [], draw: g => { P(g, 44, 152, 14, 5, '#2b2233'); P(g, 45, 153, 12, 3, '#9fc6d8'); P(g, 45, 154, 12, 1, '#f4f1ea'); P(g, 58, 154, 5, 3, '#2b2233'); P(g, 59, 155, 3, 1, '#3fb5a3'); } }
  ];

  // ---- 축구장 ----
  const FIELD = { w: 320, h: 208, x0: 16, y0: 22, x1: 304, y1: 194, gy0: 86, gy1: 130 };
  function bgSoccer(g, w, h) {
    for (let x = 0; x < w; x += 20) P(g, x, 0, 20, h, (x / 20) % 2 ? '#4f9a5a' : '#58a663');
    P(g, 0, 0, w, 14, '#3b3a44'); for (let x = 2; x < w; x += 6) P(g, x, 3, 3, 4, ['#d84b3a', '#f0cc55', '#3f6fb8', '#f4f1ea'][(x / 6 | 0) % 4]);   // stands
    const L = 'rgba(255,255,255,.85)', { x0, y0, x1, y1, gy0, gy1 } = FIELD, cx = w / 2, cy = (y0 + y1) / 2;
    P(g, x0, y0, x1 - x0, 1, L); P(g, x0, y1, x1 - x0 + 1, 1, L); P(g, x0, y0, 1, y1 - y0, L); P(g, x1, y0, 1, y1 - y0, L);
    P(g, cx, y0, 1, y1 - y0, L);
    for (let a = 0; a < 90; a++) { const t = a / 90 * Math.PI * 2; P(g, Math.round(cx + Math.cos(t) * 20), Math.round(cy + Math.sin(t) * 20), 1, 1, L); }
    P(g, cx - 1, cy - 1, 3, 3, L);
    for (const [a, dir] of [[x0, 1], [x1, -1]]) {
      const bx = dir > 0 ? a : a - 34; P(g, bx, gy0 - 20, 34, 1, L); P(g, bx, gy1 + 20, 35, 1, L); P(g, dir > 0 ? a + 34 : a - 34, gy0 - 20, 1, gy1 - gy0 + 40, L);
      const sx = dir > 0 ? a : a - 14; P(g, sx, gy0 - 6, 14, 1, L); P(g, sx, gy1 + 6, 15, 1, L); P(g, dir > 0 ? a + 14 : a - 14, gy0 - 6, 1, gy1 - gy0 + 12, L);
      P(g, dir > 0 ? a + 24 : a - 24, cy, 1, 1, L);
    }
    // goals (nets)
    for (const [gx, gw] of [[2, 14], [304, 14]]) {
      P(g, gx, FIELD.gy0 - 1, gw, FIELD.gy1 - FIELD.gy0 + 2, '#f4f1ea');
      P(g, gx + (gx < 10 ? 0 : 1), FIELD.gy0, gw - 1, FIELD.gy1 - FIELD.gy0, '#cfd8d0');
      for (let y = FIELD.gy0 + 2; y < FIELD.gy1; y += 3) P(g, gx + 1, y, gw - 2, 1, '#b4bfb6');
      for (let x = gx + 2; x < gx + gw - 1; x += 3) P(g, x, FIELD.gy0, 1, FIELD.gy1 - FIELD.gy0, '#b4bfb6');
    }
    P(g, 0, h - 10, w, 10, '#3b3a44'); P(g, w / 2 - 14, h - 10, 28, 10, '#2f8a55'); P(g, w / 2 - 12, h - 9, 24, 9, '#3fae6c'); P(g, w / 2, h - 9, 1, 9, '#2f8a55');
  }

  // ---- 3층 옥상 ----
  function bgRoof(g, w, h) {
    // sky band (the weather layer paints over it while playing)
    P(g, 0, 0, w, 44, '#9fd0f0');
    // city skyline
    const sky = [[0, 30, 14], [14, 22, 10], [24, 34, 16], [40, 18, 12], [52, 28, 18], [70, 12, 10], [80, 26, 14], [94, 20, 12], [106, 31, 16], [122, 16, 12], [134, 27, 14], [148, 22, 10], [158, 33, 16], [174, 19, 18]];
    for (const [x, y, ww] of sky) { P(g, x, y, ww, 44 - y, '#7d8597'); for (let yy = y + 3; yy < 42; yy += 4) for (let xx = x + 2; xx < x + ww - 1; xx += 3) P(g, xx, yy, 1, 2, '#a5adbd'); }
    // deck
    for (let y = 50; y < h; y += 10) for (let x = 0; x < w; x += 10) { P(g, x, y, 10, 10, ((x + y) / 10) % 2 ? '#b8b2a7' : '#c2bcb1'); P(g, x, y, 10, 1, '#a9a397'); }
    P(g, 0, 44, w, 6, '#8d8f99'); P(g, 0, 44, w, 1, '#c9c9d4'); for (let x = 2; x < w; x += 8) P(g, x, 36, 1, 8, '#5a5560'); P(g, 0, 36, w, 1, '#5a5560');   // parapet + railing
    P(g, 0, 50, 6, h - 50, '#8d8f99'); P(g, w - 6, 50, 6, h - 50, '#8d8f99');
    // wooden deck area in the middle
    for (let y = 92; y < 160; y += 6) { P(g, 34, y, 124, 6, (y / 6) % 2 ? '#a8734f' : '#b07b56'); P(g, 34, y, 124, 1, '#8a5a3b'); }
    P(g, 0, h - 10, w, 10, '#8d8f99'); P(g, 0, h - 11, w, 1, '#6f7280');
    elevatorBottom(g, w, h);
  }
  const roofSeats = [62, 80, 98, 116].map(x => mkSeat(x, 112, 'up', 'wood')).concat([62, 80, 98, 116].map(x => mkSeat(x, 140, 'up', 'wood')));
  const roofItems = [
    { id: 'rf-plant1', label: '화분', box: [10, 60, 16, 26], sortY: 84, obs: [[12, 76, 12, 8]], draw: g => plant(g, 18, 84) },
    { id: 'rf-plant2', label: '화분', box: [166, 60, 16, 26], sortY: 84, obs: [[168, 76, 12, 8]], draw: g => plant(g, 174, 84) },
    { id: 'rf-plant3', label: '화분', box: [10, 160, 16, 26], sortY: 184, obs: [[12, 176, 12, 8]], draw: g => plant(g, 18, 184) },
    { id: 'rf-sign', label: '날씨판', box: [150, 96, 26, 34], sortY: 128, obs: [[154, 120, 18, 8]], draw: g => {
      P(g, 162, 114, 2, 14, '#3b3a44'); P(g, 150, 96, 26, 20, '#2b2233'); P(g, 151, 97, 24, 18, '#f4f1ea'); P(g, 151, 97, 24, 3, '#3f6fb8');
    } },
    { id: 'rf-lights', label: '전구 줄', box: [0, 52, 0, 0], sortY: 0, fixed: true, obs: [], draw: g => {
      for (let x = 30; x < 166; x++) { const y = 60 + Math.round(Math.sin((x - 30) / 136 * Math.PI) * 6); P(g, x, y, 1, 1, '#3b3a44'); if (x % 9 === 0) P(g, x, y + 1, 2, 2, '#ffd65a'); }
    } }
  ];

  const exitSpot = { id: 'toHall', item: null, x: 96, y: 158, r: 14, ax: 96, ay: 144, hit: [82, 160, 28, 16], label: '복도로 나가기' };
  const SCENES = {
    sanctuary: { name: '본당', w: 192, h: 360, bounds: [10, 50, 182, 354], lights: true, drawBg: bgSanctuary, items: sanctItems, seats: sanctSeats,
      spawns: { door: [14, 217, 'right'] },
      spots: [
        { id: 'stand', item: 'stand', x: 96, y: 81, r: 13, ax: 97, ay: 49, label: '오늘의 QT 보기' },
        { id: 'drum', item: 'drum', x: 15, y: 82, r: 12, sx: 15, sy: 82, face: 'right', ax: 34, ay: 52, label: '드럼 치기' },
        { id: 'bass', item: 'bass', x: 54, y: 104, r: 7, sx: 54, sy: 104, face: 'right', ax: 54, ay: 42, label: '베이스 치기' },
        { id: 'elec', item: 'elec', x: 67, y: 104, r: 7, sx: 67, sy: 104, face: 'right', ax: 67, ay: 48, label: '일렉기타 치기' },
        { id: 'synth', item: 'synth', x: 162, y: 66, r: 12, sx: 162, sy: 66, face: 'left', ax: 145, ay: 46, label: '신디 연주하기' },
        { id: 'piano', item: 'piano', x: 164, y: 98, r: 12, sx: 164, sy: 98, face: 'left', ax: 147, ay: 74, label: '피아노 치기' },
        { id: 'qr', item: 'qr', x: 32, y: 312, r: 16, ax: 16, ay: 280, label: '헌금 QR 보기' },
        { id: 'prayer', item: 'prayer', x: 34, y: 346, r: 13, ax: 17, ay: 324, label: '익명 기도제목 보기' },
        { id: 'board', item: 'board', x: 164, y: 326, r: 14, ax: 164, ay: 282, label: '이번 주 광고 보기' },
        { id: 'eq', item: 'eq', x: 140, y: 326, r: 14, ax: 142, ay: 322, label: '무대 조명 바꾸기' },
        { id: 'toHall', item: null, x: 14, y: 217, r: 11, ax: 10, ay: 188, hit: [0, 200, 14, 34], label: '복도로 나가기' }
      ],
      labels: [{ x: 4, y: 193, t: '출구', align: 'left' }] },
    hall: { name: '2층 복도', w: 160, h: 280, bounds: [22, 52, 138, 266], drawBg: bgHall, items: hallItems, seats: [],
      spawns: { sanctuary: [80, 58, 'down'], room1: [26, 100, 'right'], room2: [26, 200, 'right'], room3: [134, 100, 'left'], room4: [134, 200, 'left'], elevator: [80, 256, 'up'] },
      spots: [{ id: 'toSanctuary', item: null, x: 80, y: 56, r: 14, ax: 80, ay: 4, hit: [62, 9, 36, 40], label: '본당으로 들어가기' }, ELEV_SPOT(160, 280)]
        .concat(HALL_DOORS.map(([id, x, y, right]) => ({ id: 'to-' + id, item: null, x: right ? x - 10 : x + 10, y, r: 12, ax: right ? x - 10 : x + 10, ay: y - 22, hit: right ? [x - 10, y - 16, 16, 32] : [x - 6, y - 16, 16, 32], label: `${ROOM_INFO[id].n} ${ROOM_INFO[id].sub} 들어가기`, room: id }))),
      labels: [{ x: 80, y: 2, t: '본당', align: 'center', count: 'sanctuary' }]
        .concat(HALL_DOORS.map(([id, x, y, right]) => ({ x: right ? x - 9 : x + 9, y: y + 18, t: ROOM_INFO[id].n, sub: ROOM_INFO[id].sub, align: right ? 'right' : 'left', count: id }))) },
    room1: { name: 'ROOM 1 · 회의실', w: 192, h: 176, bounds: [10, 48, 182, 162], drawBg: bgRoom1, items: room1Items, seats: r1Seats, spawns: { door: [96, 156, 'up'] }, spots: [exitSpot] },
    room2: { name: 'ROOM 2 · 탕비실', w: 192, h: 176, bounds: [10, 48, 182, 162], drawBg: bgRoom2, items: room2Items, seats: r2Seats, spawns: { door: [96, 156, 'up'] },
      spots: [exitSpot, { id: 'water', item: 'r2-water', x: 167, y: 70, r: 12, ax: 167, ay: 12, label: '물 한 잔 마시기' }, { id: 'coffee', item: 'r2-counter', x: 96, y: 68, r: 12, ax: 96, ay: 20, label: '커피 내리기' }] },
    room3: { name: 'ROOM 3 · 세미나실', w: 192, h: 176, bounds: [10, 48, 182, 162], drawBg: bgRoom3, items: room3Items, seats: r3Seats, spawns: { door: [96, 156, 'up'] }, spots: [exitSpot] },
    room4: { name: 'ROOM 4 · 라운지', w: 192, h: 176, bounds: [10, 48, 182, 162], drawBg: bgRoom4, items: room4Items, seats: r4Seats, spawns: { door: [96, 156, 'up'] }, spots: [exitSpot] },
    hall1: { name: '1층 복도', w: 160, h: 280, bounds: [22, 52, 138, 266], drawBg: bgHall1, items: hall1Items, seats: [],
      spawns: { elevator: [80, 256, 'up'], f1r1: [26, 100, 'right'], f1r2: [26, 200, 'right'], f1r3: [134, 100, 'left'], f1r4: [134, 200, 'left'] },
      spots: [{ id: 'outside', item: null, x: 80, y: 58, r: 14, ax: 80, ay: 4, hit: [58, 7, 44, 40], label: '건물 밖으로 나가기' }, ELEV_SPOT(160, 280)]
        .concat(HALL1_DOORS.map(([id, x, y, right]) => ({ id: 'to-' + id, item: null, x: right ? x - 10 : x + 10, y, r: 12, ax: right ? x - 10 : x + 10, ay: y - 22, hit: right ? [x - 10, y - 16, 16, 32] : [x - 6, y - 16, 16, 32], label: id === 'f1r1' ? `${ROOM_INFO[id].n} ${ROOM_INFO[id].sub} 들어가기` : `${ROOM_INFO[id].n} 문 열어 보기`, room: id === 'f1r1' ? id : null, locked: id !== 'f1r1' }))),
      labels: [{ x: 80, y: 2, t: '출입문', align: 'center' }]
        .concat(HALL1_DOORS.map(([id, x, y, right]) => ({ x: right ? x - 9 : x + 9, y: y + 18, t: ROOM_INFO[id].n, sub: ROOM_INFO[id].sub, align: right ? 'right' : 'left', count: id === 'f1r1' ? id : undefined }))) },
    f1r1: { name: '1층 ROOM 1 · 락커룸', w: 192, h: 176, bounds: [10, 48, 182, 162], drawBg: bgLocker, items: lockerItems, seats: lockerSeats, spawns: { door: [96, 156, 'up'], field: [96, 74, 'down'] },
      spots: [exitSpot, { id: 'pitch', item: null, x: 96, y: 56, r: 14, ax: 96, ay: 2, hit: [82, 6, 28, 40], label: '축구장 가기' }] },
    roof: { name: '3층 · 옥상', w: 192, h: 200, bounds: [8, 52, 184, 186], drawBg: bgRoof, items: roofItems, seats: roofSeats, weather: true, spawns: { elevator: [96, 178, 'up'] },
      spots: [ELEV_SPOT(192, 200), { id: 'weather', item: 'rf-sign', x: 163, y: 134, r: 14, ax: 163, ay: 88, label: '오늘 베이징 날씨 보기' }] },
    soccer: { name: '축구장', w: FIELD.w, h: FIELD.h, bounds: [8, 20, 312, 196], drawBg: bgSoccer, items: [], seats: [], soccer: true, spawns: { w: [110, 108, 'right'], b: [210, 108, 'left'] },
      spots: [{ id: 'leaveField', item: null, x: 160, y: 194, r: 12, ax: 160, ay: 182, hit: [146, 198, 28, 10], label: '락커룸으로 돌아가기' }] }
  };
  const HALL_OF = { room1: 'hall', room2: 'hall', room3: 'hall', room4: 'hall', f1r1: 'hall1' };
  const FLOOR_OF = id => id === 'roof' ? 3 : (id === 'hall1' || id === 'f1r1' || id === 'soccer') ? 1 : 2;
  const ALL_ITEMS = Object.values(SCENES).flatMap(sc => sc.items);
  const itemById = Object.fromEntries(ALL_ITEMS.map(it => [it.id, it]));
  let sceneId = 'sanctuary', scene = SCENES.sanctuary, W = scene.w, H = scene.h, ITEMS = scene.items, chairs = scene.seats, spots = [];
  let layout = {};
  const off = id => (id && layout[id]) || { dx: 0, dy: 0 };
  function cleanLayout(l) {
    const out = {};
    if (l && typeof l === 'object') for (const id in l) if (itemById[id] && !itemById[id].fixed && l[id]) {
      const dx = Math.round(+l[id].dx || 0), dy = Math.round(+l[id].dy || 0);
      if (dx || dy) out[id] = { dx: clamp(dx, -400, 400), dy: clamp(dy, -400, 400) };
    }
    return out;
  }

  let obstacles = [];
  function buildObstacles() {
    obstacles = chairs.map(seatObstacle).filter(Boolean);
    for (const it of ITEMS) { const o = off(it.id); for (const [x, y, w, h] of it.obs) obstacles.push({ x: x + o.dx, y: y + o.dy, w, h }); }
  }
  // pad > 0 keeps planned paths a little away from edges, so walking never grazes a corner and stalls
  function blocked(x, y, pad = 0) {
    const [x0, y0, x1, y1] = scene.bounds;
    if (x < x0 + pad || x > x1 - pad || y < y0 + pad || y > y1 - pad) return true;
    for (const o of obstacles) if (x + 4 + pad > o.x && x - 4 - pad < o.x + o.w && y + pad > o.y && y - 3 - pad < o.y + o.h) return true;
    return false;
  }
  const PAD = 0.75;

  // ================= pathfinding =================
  const CS = 4;
  let GW = 0, GH = 0, walk = new Uint8Array(0);
  function rebuildWalk() {
    GW = Math.ceil(W / CS); GH = Math.ceil(H / CS);
    if (walk.length !== GW * GH) walk = new Uint8Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) walk[j * GW + i] = blocked(i * CS + 2, j * CS + 2, PAD) ? 0 : 1;
  }
  function nearestCell(p) {
    const ci = clamp(Math.floor(p.x / CS), 0, GW - 1), cj = clamp(Math.floor(p.y / CS), 0, GH - 1);
    if (walk[cj * GW + ci]) return cj * GW + ci;
    for (let rad = 1; rad < 28; rad++) for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < GW && j < GH && walk[j * GW + i]) return j * GW + i;
    }
    return -1;
  }
  function clearLine(a, c) {
    const d = Math.hypot(c.x - a.x, c.y - a.y), n = Math.ceil(d / 1.5);
    for (let k = 1; k <= n; k++) { const t = k / n; if (blocked(a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t, k < n ? PAD : 0)) return false; }
    return true;
  }
  function findPath(from, to) {
    const [bx0, by0, bx1, by1] = scene.bounds;
    to = { x: clamp(to.x, bx0 + 2, bx1 - 2), y: clamp(to.y, by0 + 2, by1 - 2) };   // a click on a wall means "go as close as you can"
    const s = nearestCell(from); let t = nearestCell(to);
    if (s < 0 || t < 0) return [];
    let bestC = s, bestD = Infinity;
    const prev = new Int32Array(GW * GH).fill(-1); prev[s] = s;
    const q = [s]; let head = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (head < q.length) {
      const cur = q[head++]; if (cur === t) break;
      const ci = cur % GW, cj = (cur - ci) / GW;
      const dd = (ci * CS + 2 - to.x) ** 2 + (cj * CS + 2 - to.y) ** 2; if (dd < bestD) { bestD = dd; bestC = cur; }
      for (const [di, dj] of dirs) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        const n = j * GW + i;
        if (!walk[n] || prev[n] !== -1) continue;
        if (di && dj && (!walk[cj * GW + i] || !walk[j * GW + ci])) continue;
        prev[n] = cur; q.push(n);
      }
    }
    if (prev[t] === -1) { t = bestC; to = { x: (t % GW) * CS + 2, y: Math.floor(t / GW) * CS + 2 }; }   // can't reach it: walk as close as possible
    if (t === s) return [];
    const cells = []; for (let c = t; c !== s; c = prev[c]) cells.push(c); cells.reverse();
    const raw = cells.map(c => ({ x: (c % GW) * CS + 2, y: Math.floor(c / GW) * CS + 2 }));
    if (!raw.length) return blocked(to.x, to.y) ? [] : [{ x: to.x, y: to.y }];
    if (!blocked(to.x, to.y)) raw[raw.length - 1] = { x: to.x, y: to.y };
    const outPts = []; let cur = { x: from.x, y: from.y }, idx = 0;
    while (idx < raw.length) {
      let far = idx;
      for (let k = raw.length - 1; k > idx; k--) if (clearLine(cur, raw[k])) { far = k; break; }
      outPts.push(raw[far]); cur = raw[far]; idx = far + 1;
    }
    return outPts;
  }

  // ================= interactive spots (follow their item when moved) =================
  const INSTRUMENTS = { drum: '드럼', bass: '베이스', elec: '일렉기타', synth: '신디', piano: '피아노' };
  const spotById = id => spots.find(s => s.id === id);
  function applyLayout() {
    spots = scene.spots.map(d => {
      const o = off(d.item), sp = Object.assign({}, d);
      sp.x = d.x + o.dx; sp.y = d.y + o.dy; sp.ax = d.ax + o.dx; sp.ay = d.ay + o.dy;
      if (d.sx != null) { sp.sx = d.sx + o.dx; sp.sy = d.sy + o.dy; }
      if (d.item) { const bx = itemById[d.item].box; sp.hit = [bx[0] + o.dx, bx[1] + o.dy, bx[2], bx[3]]; }
      sp.run = spotRun(sp);
      return sp;
    });
    buildObstacles(); rebuildWalk();
    for (const c of chars) if (!c.seat && !c.remote && blocked(c.x, c.y)) { const n = nearestCell(c); if (n >= 0) { c.x = (n % GW) * CS + 2; c.y = Math.floor(n / GW) * CS + 2; } c.path = []; }
  }
  function loadSceneArt() {
    W = scene.w; H = scene.h; ITEMS = scene.items; chairs = scene.seats;
    buf.width = W; buf.height = H; bg.width = W; bg.height = H;
    const g = bg.getContext('2d'); g.clearRect(0, 0, W, H);
    scene.drawBg(g, W, H);
    for (const c of chairs) drawSeatBase(g, c);
  }

  // ================= entities =================
  const mkEnt = (name, look, x, y, sc) => ({ name, look, x, y, scene: sc || 'sanctuary', dir: 'right', moving: false, animT: 0, seat: null, action: null, actionUntil: 0, actionT0: 0,
    bubble: null, emote: null, path: [], goal: null, onArrive: null, onFail: null, stuck: 0, noteAt: 0, playing: null, dnd: false, hold: null, brew: null, zz: false, hitT0: -1e9 });
  const player = mkEnt(store.get('onl-name') || '나', validLook(loadJSON('onus-look', null)) || randomLook(), 14, 217);
  player.isPlayer = true;
  const entities = [player];
  let chars = [player];   // entities in the scene the player is in
  const refreshChars = () => { chars = entities.filter(e => e.scene === sceneId); };

  // ================= content (QT, ads, QR, layout) =================
  const ymd = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
  const SAMPLE = {
    ads: [
      { t: '청년부 겨울 수련회 신청', b: '11월 셋째 주까지 셀장에게 신청서를 내 주세요.' },
      { t: '주일 점심 섬김', b: '이번 주는 2셀이 섬겨요. 11시 40분까지 식당으로!' },
      { t: '찬양팀 연습', b: '토요일 오후 3시, 본당에서 모여요.' }
    ],
    qr: null, sample: true
  };
  let content = Object.assign({}, SAMPLE);
  if (!LIVE) { content = Object.assign({}, SAMPLE, loadJSON('cl-content', {})); layout = cleanLayout(loadJSON('onl-layout', {})); }

  // ================= interactions =================
  const LIGHTS = [{ n: '따뜻한 조명', c: '255,196,120' }, { n: '푸른 조명', c: '110,160,255' }, { n: '보라 조명', c: '190,120,255' }, { n: '조명 끔', c: null }];
  let lightMode = 0;
  function spotRun(sp) {
    if (INSTRUMENTS[sp.id]) return () => startPlay(player, sp);
    if (sp.id === 'toHall') return () => goScene(HALL_OF[sceneId] || 'hall', sceneId);
    if (sp.id === 'toSanctuary') return () => goScene('sanctuary', 'door');
    if (sp.room) return () => goScene(sp.room, 'door');
    if (sp.locked) return () => toast(pick(LOCKED_MSG));
    const RUN = {
      elevator: () => openElevator(), outside: () => toast(pick(OUTSIDE_MSG)), weather: () => openWeather(),
      pitch: () => openParty(), leaveField: () => leaveMatch(true),
      stand: () => openQt(), qr: () => openQr(), board: () => openModal('board'), prayer: () => openPrayers(),
      eq: () => { lightMode = (lightMode + 1) % LIGHTS.length; const inst = EQ_INST[eqStep++ % EQ_INST.length]; eqFx(inst, 1); lobbySend('lights', { mode: lightMode, inst }); },
      water: () => useMachine('water'),
      coffee: () => useMachine('coffee')
    };
    return RUN[sp.id] || (() => {});
  }

  function faceToward(ent, tx, ty) { const dx = tx - ent.x, dy = ty - ent.y; ent.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  function sit(ent, c) {
    if (c.occ && c.occ !== ent) return false;
    ent.seat = c; c.occ = ent; c.reserved = false;
    ent.x = c.cx; ent.y = c.y + (c.face === 'up' ? 7 : 4); ent.dir = c.face; ent.path = []; ent.goal = null; ent.action = ent.dnd ? 'pray' : null; ent.playing = null; ent.moving = false;
    return true;
  }
  function standUp(ent) { if (!ent.seat) return; const a = seatApproach(ent.seat); ent.dir = ent.seat.face; ent.x = a.x; ent.y = a.y; if (ent.seat.occ === ent) ent.seat.occ = null; ent.seat = null; }
  function startPlay(ent, sp) {
    if (chars.some(c => c !== ent && c.playing === sp.id)) { if (ent.isPlayer) toast(`다른 사람이 ${INSTRUMENTS[sp.id]}를 연주하고 있어요`); return; }
    const again = ent.playing === sp.id;
    standUp(ent); ent.path = []; ent.goal = null; ent.hold = null;
    if (!blocked(sp.sx, sp.sy)) { ent.x = sp.sx; ent.y = sp.sy; }
    ent.dir = sp.face; ent.moving = false;
    ent.action = 'play'; ent.actionUntil = Infinity; ent.actionT0 = performance.now(); ent.playing = sp.id;
    if (ent.isPlayer) { sfx(sp.id); ent.riffAt = performance.now() + 3200; if (!again) toast(`${INSTRUMENTS[sp.id]} 연주 중이에요. 다시 누르면 한 번 더, 움직이면 멈춰요.`); }
  }
  function doMotion(ent, m) {
    const now = performance.now();
    const EMO = { heart: '♥', sleepy: 'Zz', water: '💧', coffee: '☕' };
    if (EMO[m]) {
      const sym = EMO[m];
      ent.emote = { sym, until: now + 2400 };
      if (ent.isPlayer) netSend('emote', { id: net.uid, sym });
      return;
    }
    if (m === 'jump' && ent.seat) return;
    if (m === 'pray' && ent.action === 'pray') { ent.action = null; return; }
    ent.playing = null; ent.action = m; ent.actionT0 = now;
    ent.actionUntil = m === 'pray' ? Infinity : m === 'jump' ? now + 650 : now + 2400;
    if (ent.isPlayer && m === 'jump') sfx('whoosh', 0.5);
  }
  function nearestFreeChair(ent, maxD) {
    let best = null, bd = maxD;
    for (const c of chairs) { if (c.occ) continue; const a = seatApproach(c), d = Math.hypot(a.x - ent.x, a.y - ent.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  let near = null;
  function computeNear() {
    if (editMode) return null;
    if (scene.soccer && match) return { label: '⚽ 공 차기', run: kick };
    if (player.seat && player.seat.team) return { label: '⚽ 축구 파티', run: () => openParty() };
    if (player.seat) return { label: '일어나기', run: () => { standUp(player); if (!player.dnd) player.action = null; } };
    if (player.playing) return { label: '연주 멈추기', run: () => { player.action = null; player.playing = null; } };
    let best = null, bd = Infinity;
    for (const s of spots) { const d = Math.hypot(s.x - player.x, s.y - player.y); if (d < s.r && d < bd) { bd = d; best = s; } }
    if (best) return best;
    const c = nearestFreeChair(player, 9);
    if (c && c.team) return { label: '⚽ 축구 파티', run: () => openParty() };
    if (c) return { label: c.kind === 'sofa' ? '소파에 앉기' : '의자에 앉기', run: () => sit(player, c) };
    return null;
  }

  // ================= movement =================
  const keys = new Set();
  const SPEED = 42;
  function step(ent, vx, vy, dt, mul = 1) {
    const len = Math.hypot(vx, vy);
    if (!len) { ent.moving = false; return false; }
    vx /= len; vy /= len;
    const sp = SPEED * mul * dt, nx = ent.x + vx * sp, ny = ent.y + vy * sp;
    if (blocked(ent.x, ent.y)) { ent.x = nx; ent.y = ny; ent.moving = true; return true; }   // stuck inside something (e.g. an item was moved onto us): walk out freely
    const ox = ent.x, oy = ent.y;
    if (!blocked(nx, ent.y)) ent.x = nx;
    if (!blocked(ent.x, ny)) ent.y = ny;
    const moved = Math.hypot(ent.x - ox, ent.y - oy) > sp * 0.2;
    if (Math.abs(vx) > Math.abs(vy)) ent.dir = vx > 0 ? 'right' : 'left'; else ent.dir = vy > 0 ? 'down' : 'up';
    ent.moving = moved;
    return moved;
  }
  function follow(ent, dt, mul) {
    if (!ent.path.length) { ent.moving = false; return; }
    const wp = ent.path[0], dx = wp.x - ent.x, dy = wp.y - ent.y;
    if (Math.hypot(dx, dy) < 1.2) {
      ent.path.shift();
      if (!ent.path.length) { ent.moving = false; ent.goal = null; ent.retries = 0; const cb = ent.onArrive; ent.onArrive = null; ent.onFail = null; if (cb) cb(); }
      return;
    }
    const ok = step(ent, dx, dy, dt, mul);
    ent.stuck = ok ? 0 : ent.stuck + dt;
    if (ent.stuck > 0.25) {
      ent.stuck = 0;
      // something got in the way (a person sat down, an item moved): plan again from here, up to twice
      const end = ent.path[ent.path.length - 1];
      if ((ent.retries || 0) < 2 && end) {
        ent.retries = (ent.retries || 0) + 1;
        const np = findPath(ent, end);
        if (np.length) { ent.path = np; return; }
      }
      ent.retries = 0; ent.path = []; ent.goal = null; ent.moving = false; const f = ent.onFail; ent.onArrive = null; ent.onFail = null; if (f) f();
    }
  }
  function goTo(ent, target, onArrive, onFail) {
    if (ent.seat) standUp(ent);
    ent.action = null; ent.playing = null;
    ent.retries = 0; ent.path = findPath(ent, target); ent.onArrive = onArrive || null; ent.onFail = onFail || null;
    ent.goal = ent.path.length ? [Math.round(ent.path[ent.path.length - 1].x), Math.round(ent.path[ent.path.length - 1].y)] : null;
    if (!ent.path.length) { if (Math.hypot(target.x - ent.x, target.y - ent.y) < 3 && onArrive) onArrive(); else if (onFail) onFail(); }
  }
  const notes = [];
  function update(dt, now) {
    let vx = 0, vy = 0;
    if (keys.has('arrowleft') || keys.has('a')) vx -= 1;
    if (keys.has('arrowright') || keys.has('d')) vx += 1;
    if (keys.has('arrowup') || keys.has('w')) vy -= 1;
    if (keys.has('arrowdown') || keys.has('s')) vy += 1;
    if (vx || vy) {
      if (player.seat) standUp(player);
      player.path = []; player.goal = null; player.onArrive = null;
      if (player.action && player.action !== 'jump') { player.action = null; player.playing = null; }
      if (!$('qrPop').hidden) closeQr();
      if (player.brew) player.brew = null;
      step(player, vx, vy, dt, scene.soccer ? 1.3 : 1);
    } else follow(player, dt, 1);
    if (player.brew && player.path.length) player.brew = null;
    if (player.hold && now - player.hold.t0 > HOLD_MS) player.hold = null;
    if (player.playing && now > (player.riffAt || 0)) { player.riffAt = now + 3200; sfx(player.playing, 0.55); }
    updateZz(now); soccerUpdate(dt, now);
    if (player.dnd && !player.moving && !player.path.length && !player.action) { player.action = 'pray'; player.actionUntil = Infinity; player.actionT0 = now; }

    if (LIVE) updateRemotes(dt);

    for (const c of chars) {
      c.animT = c.moving ? c.animT + dt : 0;
      if (c.bubble && now > c.bubble.until) c.bubble = null;
      if (c.emote && now > c.emote.until) c.emote = null;
      if (c.action && now > c.actionUntil) { c.action = null; c.playing = null; }
      if (c.action === 'play' && now > c.noteAt) { c.noteAt = now + 700; notes.push({ x: c.x + (Math.random() * 10 - 5), y: c.y - 22, t0: now, sym: pick(['♪', '♫']) }); }
    }
    for (let i = notes.length - 1; i >= 0; i--) if (now - notes[i].t0 > 1500) notes.splice(i, 1);
    for (let i = floaters.length - 1; i >= 0; i--) if (now - floaters[i].t0 > 2200) floaters.splice(i, 1);
    const nn = computeNear();
    if ((nn && nn.label) !== (near && near.label)) { const btn = $('actBtn'); if (nn) { btn.textContent = nn.label; btn.hidden = false; } else btn.hidden = true; }
    near = nn;
    if (LIVE) netTick(now);
  }

  // ================= realtime (Supabase) =================
  const net = { ch: null, lobby: null, chatDb: null, uid: null, ready: false, remotes: new Map(), sig: '', lastSend: 0, lastTrack: 0, dirty: true, counts: {}, total: 0 };
  const seatIdx = ent => ent.seat ? chairs.indexOf(ent.seat) : -1;
  function netSend(event, payload) { if (LIVE && net.ready && net.ch) net.ch.send({ type: 'broadcast', event, payload }); }
  function lobbySend(event, payload) { if (LIVE && net.lobby) net.lobby.send({ type: 'broadcast', event, payload }); }
  // one account can be open in several windows or phones; each window is a "session", and only the newest one stays connected
  const SID = Math.random().toString(36).slice(2, 10), T0 = Date.now();
  function lobbyTrack() { if (LIVE && net.lobby) net.lobby.track({ name: player.name, scene: sceneId, dnd: !!player.dnd, hb: Date.now(), sid: SID, t0: T0 }); }
  // of several entries under one person, use the newest window's; ignore a frozen older one
  const pickMeta = metas => { let best = null; for (const m of metas || []) if (!best || (m.t0 || 0) > (best.t0 || 0) || ((m.t0 || 0) === (best.t0 || 0) && (m.hb || 0) > (best.hb || 0))) best = m; return best; };

  // ---- liveness ----
  // The server can keep a closed phone or a frozen tab "present" for a long time, so every client
  // re-announces itself every 20 s (hb) and anyone not heard from for 75 s is treated as gone.
  const ALIVE_MS = 75000, HB_MS = 20000;
  const heard = new Map(), lastHb = new Map(), lobbyHeard = new Map(), lobbyHb = new Map(), oldClient = new Set();
  const markHeard = id => heard.set(id, performance.now());
  const isAlive = id => performance.now() - (heard.get(id) || 0) < ALIVE_MS;
  setInterval(() => {
    if (!LIVE || exited) return;
    if (net.ready && net.ch) { net.dirty = true; net.lastTrack = 0; if (document.hidden) pushState(); }
    lobbyTrack();
  }, HB_MS);
  setInterval(() => {
    if (!LIVE) return;
    let changed = false;
    for (const id of [...net.remotes.keys()]) if (!oldClient.has(id) && !isAlive(id)) { removeRemote(id); changed = true; }
    if (net.lobby) onLobbySync(); else if (changed) renderPeople();
  }, 5000);
  function myState() {
    return { id: net.uid, x: Math.round(player.x * 10) / 10, y: Math.round(player.y * 10) / 10, dir: player.dir, mv: player.moving, seat: seatIdx(player),
      act: player.action, play: player.playing, dnd: !!player.dnd, og: gm && !gm.over ? 1 : 0, zz: player.zz ? 1 : 0, tie: player.tie || 0, hold: player.hold ? player.hold.k : null, brew: player.brew ? player.brew.k : null, to: player.path.length ? player.goal : null };
  }
  function netTick(now) {
    if (!net.ready) return;
    const st = myState(), kb = player.moving && !player.path.length;
    const sig = [st.seat, st.act, st.play, st.dnd, st.og, st.zz, st.tie, st.hold, st.brew, st.to && st.to.join(','), st.mv, kb ? Math.round(player.x / 6) + ':' + Math.round(player.y / 6) : '', st.mv ? '' : st.x + ':' + st.y + ':' + st.dir].join('|');
    if (sig !== net.sig && now - net.lastSend > (kb ? 250 : 60)) { net.sig = sig; net.lastSend = now; net.ch.send({ type: 'broadcast', event: 'st', payload: st }); net.dirty = true; }
    if (net.dirty && !player.moving && now - net.lastTrack > 2000) { net.lastTrack = now; net.dirty = false; net.ch.track(Object.assign({ name: player.name, look: player.look, hb: Date.now(), sid: SID, t0: T0 }, st)); }
  }
  function addRemote(id, meta) {
    const sp = Object.values(scene.spawns)[0];
    const ent = mkEnt(meta.name || '', validLook(meta.look) || Object.assign({}, DEFAULT_LOOK), meta.x || sp[0], meta.y || sp[1], sceneId);
    ent.id = id; ent.remote = true; ent.tx = null; ent.ty = null;
    net.remotes.set(id, ent); entities.push(ent); refreshChars();
    return ent;
  }
  function removeRemote(id) {
    const ent = net.remotes.get(id); if (!ent) return;
    if (ent.seat && ent.seat.occ === ent) ent.seat.occ = null;
    net.remotes.delete(id);
    gmPeerGone(id); partyPeerGone(id);
    const i = entities.indexOf(ent); if (i >= 0) entities.splice(i, 1);
    refreshChars();
  }
  function applyRemote(ent, p, now, snap) {
    const ns = p.seat >= 0 ? chairs[p.seat] : null;
    if (ns !== ent.seat) {
      if (ent.seat && ent.seat.occ === ent) ent.seat.occ = null;
      ent.seat = null;
      if (ns && (!ns.occ || ns.occ === ent)) { ns.occ = ent; ent.seat = ns; ent.x = ns.cx; ent.y = ns.y + (ns.face === 'up' ? 7 : 4); ent.dir = ns.face; ent.path = []; ent.tx = null; }
    }
    if (!ent.seat) {
      if (p.to) {
        if (snap) { ent.x = p.x; ent.y = p.y; }
        const key = p.to.join(',');
        if (ent.goalKey !== key) { ent.goalKey = key; ent.path = findPath(ent, { x: p.to[0], y: p.to[1] }); }
        ent.tx = null;
      } else {
        ent.goalKey = null; ent.path = []; ent.tx = p.x; ent.ty = p.y; ent.rdir = p.dir;
        if (snap || Math.hypot(p.x - ent.x, p.y - ent.y) > 60) { ent.x = p.x; ent.y = p.y; }
      }
    }
    const act = p.act || null;
    if (act !== ent.action && !(act === 'punch' && ent.action === 'punch')) { ent.action = act; ent.actionT0 = now; ent.actionUntil = !act ? 0 : (act === 'pray' || act === 'play') ? Infinity : act === 'jump' ? now + 650 : act === 'punch' ? now + 450 : now + 2400; }
    const play = p.play || null;
    if (play && play !== ent.playing && !snap && ent.scene === sceneId && INSTRUMENTS[play]) sfx(play, 0.35);
    ent.playing = play; ent.dnd = !!p.dnd; ent.og = !!p.og; ent.zz = !!p.zz; ent.tie = +p.tie || 0;
    if ((p.hold || null) !== (ent.hold && ent.hold.k)) ent.hold = p.hold ? { k: p.hold, t0: now } : null;
    if ((p.brew || null) !== (ent.brew && ent.brew.k)) { ent.brew = p.brew ? { k: p.brew, t0: now } : null; if (ent.brew && !snap && sceneId === 'room2') sfx(p.brew === 'coffee' ? 'brew' : 'pour', 0.3); }
  }
  function updateRemotes(dt) {
    for (const ent of net.remotes.values()) {
      if (ent.seat) { ent.moving = false; continue; }
      if (ent.path.length) { follow(ent, dt, 1); if (!ent.path.length) ent.goalKey = null; continue; }
      if (ent.tx != null) {
        const dx = ent.tx - ent.x, dy = ent.ty - ent.y, d = Math.hypot(dx, dy);
        if (d > 0.8) {
          const sp = Math.min(d, SPEED * 1.1 * dt); ent.x += dx / d * sp; ent.y += dy / d * sp; ent.moving = true;
          ent.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        } else { ent.moving = false; if (ent.rdir) ent.dir = ent.rdir; }
      } else ent.moving = false;
    }
  }
  function onSync() {
    if (!net.ch) return;
    const state = net.ch.presenceState(), seen = new Set(), now = performance.now();
    for (const key in state) {
      if (key === net.uid) continue;
      const meta = pickMeta(state[key]);
      if (!meta) continue;
      // only a new heartbeat counts as a sign of life; an old entry the server still holds does not
      if (meta.hb && meta.hb !== lastHb.get(key)) { lastHb.set(key, meta.hb); markHeard(key); }
      else if (!meta.hb) { oldClient.add(key); markHeard(key); }   // someone still on an older version of the page
      else if (!heard.has(key)) markHeard(key);
      if (!isAlive(key)) continue;
      seen.add(key);
      let ent = net.remotes.get(key);
      if (!ent) { ent = addRemote(key, meta); applyRemote(ent, meta, now, true); }
      if (meta.name) ent.name = meta.name;
      if (validLook(meta.look)) ent.look = meta.look;
      ent.dnd = !!meta.dnd; ent.og = !!meta.og; ent.zz = !!meta.zz; ent.tie = +meta.tie || 0;
    }
    for (const key of [...net.remotes.keys()]) if (!seen.has(key)) removeRemote(key);
    if (net.lobby) onLobbySync(); else renderPeople();
  }
  function onLobbySync() {
    if (!net.lobby) return;
    const st = net.lobby.presenceState(), counts = {}, now = performance.now(); let total = 1;
    counts[sceneId] = 1;   // me
    // the same account opened somewhere newer: this window steps aside
    if ((st[net.uid] || []).some(m => m.sid && m.sid !== SID && (m.t0 || 0) > T0)) { superseded(); return; }
    for (const k in st) {
      if (k === net.uid) continue;
      const m = pickMeta(st[k]); if (!m) continue;
      if (m.hb && m.hb !== lobbyHb.get(k)) { lobbyHb.set(k, m.hb); lobbyHeard.set(k, now); }
      else if (!m.hb || !lobbyHeard.has(k)) lobbyHeard.set(k, now);
      const alive = now - lobbyHeard.get(k) < ALIVE_MS || (m.scene === sceneId && net.remotes.has(k));
      if (!alive || m.scene === sceneId) continue;   // my room is counted from the people actually here (below)
      total++; counts[m.scene] = (counts[m.scene] || 0) + 1;
    }
    // people in my room: exactly the characters I can see, so the number and the name tags always agree
    const here = [...net.remotes.keys()].length;
    counts[sceneId] += here; total += here;
    net.counts = counts; net.total = total; renderPeople();
  }
  async function connectRealtime() {
    try { await sb.realtime.setAuth(); } catch (e) { /* older clients set auth automatically */ }
    const lob = sb.channel('lounge:lobby', { config: { private: true, broadcast: { self: false }, presence: { key: net.uid } } });
    net.lobby = lob;
    lob.on('presence', { event: 'sync' }, onLobbySync)
      .on('broadcast', { event: 'lights' }, ({ payload: p }) => { if (p && LIGHTS[p.mode]) { lightMode = p.mode; if (sceneId === 'sanctuary' && EQ_INST.includes(p.inst)) eqFx(p.inst, 0.4); } })
      .on('broadcast', { event: 'content' }, () => { loadContent(); })
      .subscribe(status => { if (status === 'SUBSCRIBED') lobbyTrack(); });
    joinSceneChannel();
  }
  // Chat comes from the database: every INSERT on public.messages for this room. The server fills in the
  // sender's id and name, so nothing a client sends over a channel can pose as another member.
  function joinChatDb() {
    if (net.chatDb) { const old = net.chatDb; net.chatDb = null; try { sb.removeChannel(old); } catch (e) {} }
    if (BP.legacy) return;   // BACKPORT: the old database has no chat feed
    const id = sceneId;
    net.chatDb = sb.channel('db-chat:' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'scene=eq.' + id }, ({ new: m }) => {
        if (id === sceneId && m) showChat(m.user_id, m.name, m.body, m.created_at);
      })
      .subscribe();
  }
  function joinSceneChannel() {
    joinChatDb();
    if (net.ch) { const old = net.ch; net.ch = null; try { sb.removeChannel(old); } catch (e) {} }
    for (const id of [...net.remotes.keys()]) removeRemote(id);
    net.ready = false;
    const ch = sb.channel('lounge:' + (sceneId === 'soccer' && match ? 'soccer-' + match.id : sceneId), { config: { private: true, broadcast: { self: false }, presence: { key: net.uid } } });
    net.ch = ch;
    ch.on('presence', { event: 'sync' }, () => { if (net.ch === ch) onSync(); })
      .on('broadcast', { event: 'st' }, ({ payload: p }) => {
        if (net.ch !== ch || !p || p.id === net.uid) return;
        markHeard(p.id);
        const fresh = !net.remotes.has(p.id);
        const ent = net.remotes.get(p.id) || addRemote(p.id, p);
        if (fresh) onLobbySync();
        applyRemote(ent, p, performance.now(), false);
      })
      .on('broadcast', { event: 'chat' }, ({ payload: p }) => { if (net.ch === ch && BP.legacy && p) showChat(p.id, p.name, p.text); })   // BACKPORT
      .on('broadcast', { event: 'hit' }, ({ payload: p }) => { if (net.ch === ch) onHit(p); })
      .on('broadcast', { event: 'gm' }, ({ payload: p }) => { if (net.ch === ch) onGm(p); })
      .on('broadcast', { event: 'pty' }, ({ payload: p }) => { if (net.ch === ch) onPty(p); })
      .on('broadcast', { event: 'fb' }, ({ payload: p }) => { if (net.ch === ch) onFb(p); })
      .on('broadcast', { event: 'emote' }, ({ payload: p }) => { const ent = p && net.remotes.get(p.id); if (ent) ent.emote = { sym: p.sym, until: performance.now() + 2400 }; })
      .subscribe(status => {
        if (net.ch !== ch) return;
        if (status === 'SUBSCRIBED') { net.ready = true; net.sig = ''; net.lastTrack = 0; net.dirty = true; $('liveDot').classList.remove('bad'); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          net.ready = false; $('liveDot').classList.add('bad');
          if (status !== 'CLOSED') toast('실시간 연결이 불안정해요. 자동으로 다시 연결하고 있어요.');
        }
      });
  }
  async function loadContent() {
    const { data, error } = await sb.from('content').select('ads, qr_url, layout, sample, qt_link').eq('id', 1).maybeSingle();
    if (error || !data) return;
    content = { ads: Array.isArray(data.ads) ? data.ads : [], qr: data.qr_url || null, sample: !!data.sample };
    qtLink = data.qt_link || '';
    if (!editMode) { layout = cleanLayout(data.layout); applyLayout(); }
  }
  async function loadHistory() {
    const forScene = sceneId;
    const since = new Date(`${chinaYmd()}T00:00:00+08:00`).toISOString();   // today 00:00 China time
    const { data } = await sb.from('messages').select('name, body, user_id, created_at').eq('scene', forScene).gte('created_at', since).order('created_at', { ascending: false }).limit(40);
    if (forScene !== sceneId) return;
    if (!data) return;
    data.reverse().forEach(m => log(m.name, m.body, m.user_id === net.uid ? 'me' : '', m.created_at));
    if (data.length) log('', '── 여기까지 오늘 대화 ──', 'sys');
  }
  // chat resets every day at 00:00 China time (01:00 Korea): clear the log and bubbles for people who are still online
  let chatDay = null;
  setInterval(() => {
    const d = chinaYmd();
    if (chatDay === null) { chatDay = d; return; }
    if (d === chatDay) return;
    chatDay = d;
    logEl.innerHTML = ''; lastFrom = null;
    for (const c of entities) c.bubble = null;
    log('', '0시가 지나 대화가 초기화됐어요. 새로운 하루도 함께해요!', 'sys');
  }, 20000);
  let saveProfileTimer = 0;
  function saveProfileSoon() {
    if (!LIVE || !net.uid) return;
    clearTimeout(saveProfileTimer);
    saveProfileTimer = setTimeout(() => { sb.from('profiles').update({ name: player.name, look: player.look }).eq('id', net.uid).then(() => {}); }, 800);
    net.dirty = true; net.lastTrack = 0; lobbyTrack();
  }

  // ================= chat =================
  const logEl = $('log');
  let lastFrom = null, unread = 0;
  const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  function log(name, text, cls, at) {
    const pane = logEl.parentElement, atBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 60;
    const li = document.createElement('li'), c = cls || '';
    const kind = /\bsys\b/.test(c) ? 'sys' : /\bme\b/.test(c) ? 'me' : 'them';
    li.className = ['msg', kind, c].filter(Boolean).join(' ');
    if (kind === 'sys') { li.textContent = text; lastFrom = null; }
    else {
      const from = kind === 'me' ? '\u0000me' : name;
      if (from === lastFrom) li.classList.add('cont');
      else if (kind === 'them') { const bEl = document.createElement('b'); bEl.textContent = name; li.appendChild(bEl); }
      const row = document.createElement('div'); row.className = 'bub-row';
      const bub = document.createElement('span'); bub.className = 'bub'; bub.textContent = text;
      const tm = document.createElement('i'); tm.className = 'tm'; tm.textContent = hhmm(at ? new Date(at) : new Date());
      row.append(bub, tm); li.appendChild(row);
      lastFrom = from;
      try { if (!isDesktop() && (!open || tab !== 'chat') && kind === 'them') { unread++; syncUnread(); } } catch (e) {}
    }
    logEl.appendChild(li);
    while (logEl.children.length > 120) logEl.removeChild(logEl.firstChild);
    if (atBottom || kind === 'me') pane.scrollTop = pane.scrollHeight;
  }
  function syncUnread() { const t = $('tab-chat'); t.dataset.unread = unread > 9 ? '9+' : unread || ''; }
  // a chat line from someone else: a database row, or (via backport.js) a legacy broadcast
  function showChat(uid, name, text, at) {
    if (!uid || uid === net.uid) return;
    const ent = net.remotes.get(uid); markHeard(uid);
    if (ent) ent.bubble = { text, until: performance.now() + 4500 };
    log(name, text, '', at);
  }
  function say(ent, text) { ent.bubble = { text, until: performance.now() + 4500 }; if (ent.scene === sceneId) log(ent.name, text, ent.isPlayer ? 'me' : ''); }
  $('chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('chatInput'), text = inp.value.trim().slice(0, 200);
    if (!text || player.dnd) return;
    say(player, text); inp.value = '';
    if (LIVE) {
      // the server sets user_id and name; everyone else sees this line when the row is inserted
      if (BP.legacy) netSend('chat', { id: net.uid, name: player.name, text });   // BACKPORT: old database, no row feed
      sb.from('messages').insert({ body: text, scene: sceneId }).then(({ error }) => {
        if (error) toast(/slow down/.test(error.message) ? '너무 빨리 보내고 있어요. 잠시 후 다시 해 주세요' : '대화 기록을 저장하지 못했어요');
      });
      return;
    }
  });
  document.querySelectorAll('[data-motion]').forEach(btn => btn.addEventListener('click', () => { if (!player.dnd) doMotion(player, btn.dataset.motion); }));
  $('punchBtn').addEventListener('click', () => { if (scene.soccer) kick(); else doPunch(); });
  $('fbBtn').addEventListener('click', () => { if (isPartyHost() && canStart()) startMatch(); else openParty(); });


  // ================= QT plan: monthly schedule, today's passage switches at 00:00 China time =================
  const chinaYmd = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const addDays = (ymdStr, n) => { const [y, m, d] = ymdStr.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
  const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const fmtDay = ymdStr => { const [y, m, d] = ymdStr.split('-').map(Number); return `${y}년 ${m}월 ${d}일 (${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`; };
  let qtPlan = {}, qtLink = '', qtSample = false, qtView = null;
  function sampleQtMonth(ym) {
    const out = {}, n = daysIn(ym);
    for (let d = 1; d <= n; d++) { const ch = Math.ceil(d / 2), half = d % 2; out[`${ym}-${String(d).padStart(2, '0')}`] = `요한복음 ${ch}:${half ? '1-18' : '19-36'}`; }
    return out;
  }
  if (!LIVE) {
    const saved = loadJSON('onl-qtplan', null);
    if (saved && typeof saved === 'object' && Object.keys(saved).length) qtPlan = saved;
    else { qtPlan = sampleQtMonth(chinaYmd().slice(0, 7)); qtSample = true; }
    qtLink = store.get('onl-qtlink') || '';
  }
  async function loadQtPlan(fromYmd, toYmd) {
    if (!LIVE) return;
    const { data, error } = await sb.from('qt_plan').select('day, ref').gte('day', fromYmd).lte('day', toYmd);
    if (error || !data) return;
    for (const k of Object.keys(qtPlan)) if (k >= fromYmd && k <= toYmd) delete qtPlan[k];
    data.forEach(r => { qtPlan[r.day] = r.ref; });
  }
  async function openQt() {
    qtView = chinaYmd();
    if (LIVE) await loadQtPlan(addDays(qtView, -7), addDays(qtView, 14));
    renderQt(); $('modal').hidden = false; $('modalClose').focus();
  }
  function renderQt() {
    const today = chinaYmd(), body = $('modalBody'); body.innerHTML = '';
    $('modalTitle').textContent = qtView === today ? '오늘의 QT' : 'QT 본문';
    if (qtSample) body.appendChild(el('span', 'tag', '예시'));
    body.appendChild(el('div', 'qt-date', fmtDay(qtView)));
    const ref = qtPlan[qtView];
    body.appendChild(el('div', 'qt-ref', ref || '이 날의 본문이 아직 없어요'));
    if (ref) {
      const row = el('div', 'btns');
      const copy = el('button', 'btn', '본문 범위 복사'); copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(ref); toast('복사했어요. 성경 앱에서 붙여넣어 찾아보세요.'); }
        catch (e) { const r = document.createRange(); r.selectNodeContents(body.querySelector('.qt-ref')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('본문 범위를 선택해 두었어요. 복사해서 쓰세요.'); }
      });
      row.appendChild(copy);
      body.appendChild(row);
    } else body.appendChild(el('p', 'small', '관리자가 이번 달 본문표를 올리면 여기에 보여요.'));
    const nav = el('div', 'qt-nav');
    const prev = el('button', 'btn', '◀ 전날'), next = el('button', 'btn', '다음날 ▶'), now = el('button', 'btn', '오늘');
    [prev, now, next].forEach(b2 => { b2.type = 'button'; nav.appendChild(b2); });
    prev.addEventListener('click', () => { qtView = addDays(qtView, -1); renderQt(); });
    next.addEventListener('click', () => { qtView = addDays(qtView, 1); renderQt(); });
    now.addEventListener('click', () => { qtView = chinaYmd(); renderQt(); });
    now.hidden = qtView === today;
    body.appendChild(nav);
    body.appendChild(el('p', 'small', '매일 0시(중국 시간, 한국 시간 1시)에 그날 본문으로 바뀌어요. 본문은 우리말성경으로 읽어 주세요.'));
  }

  // ================= toast / modal / QR =================
  let toastTimer = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400); }
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  function openModal(kind) {
    const body = $('modalBody'); body.innerHTML = '';
    {
      $('modalTitle').textContent = '이번 주 광고';
      if (content.sample) body.appendChild(el('span', 'tag', '예시'));
      if (!content.ads.length) body.appendChild(el('p', 'small', '이번 주 광고가 아직 없어요.'));
      content.ads.forEach(a => { const c = el('div', 'ad'); c.appendChild(el('strong', '', a.t)); if (a.b) c.appendChild(el('span', '', a.b)); body.appendChild(c); });
    }
    $('modal').hidden = false; $('modalClose').focus();
  }
  function closeModal() { $('modal').hidden = true; }
  $('modalClose').addEventListener('click', closeModal);
  $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal')) closeModal(); });
  function openQr() {
    const has = !!content.qr;
    $('qrFig').hidden = !has; $('qrEmpty').hidden = has;
    if (has) $('qrImg').src = content.qr;
    $('qrPop').hidden = false;
  }
  function closeQr() { $('qrPop').hidden = true; }
  $('qrPop').addEventListener('click', e => { if (e.target === $('qrPop')) closeQr(); });

  // ================= input =================
  const canvas = $('room'), ctx = canvas.getContext('2d'), stageEl = $('stage');
  const isTyping = () => { const t = document.activeElement; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.offsetParent !== null && !t.disabled; };
  const MOVE = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'];
  const KEY_MOTION = { 1: 'wave', 2: 'clap', 3: 'pray', 4: 'heart', 5: 'sleepy' };
  // read the physical key, so shortcuts also work while the keyboard is in Korean (ㄹ is still the F key)
  function keyName(e) {
    const c = e.code || '';
    if (/^Key[A-Z]$/.test(c)) return c.slice(3).toLowerCase();
    if (/^(Digit|Numpad)[0-9]$/.test(c)) return c.slice(-1);
    if (c === 'Space') return ' ';
    if (c === 'Enter' || c === 'NumpadEnter') return 'enter';
    return (e.key || '').toLowerCase();
  }
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('gm').hidden) { $('gm').hidden = true; gmLabel(); return; } if (!$('modal').hidden) closeModal(); if (!$('qrPop').hidden) closeQr(); if (drag) endDrag(true); return; }
    if (isTyping() || !$('join').hidden || !$('creator').hidden || !$('gm').hidden) return;
    const k = keyName(e);
    // a button focused by an earlier click must not also fire on Enter/Space
    if ((k === 'enter' || k === ' ') && document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
    if (MOVE.includes(k)) { keys.add(k); e.preventDefault(); if (!$('modal').hidden) closeModal(); }
    else if (k === 'e' || k === 'enter') { if (near && $('modal').hidden && !e.repeat) near.run(); e.preventDefault(); }
    else if (k === ' ') { if (scene.soccer) kick(); else if (!player.dnd && !e.repeat) doMotion(player, 'jump'); e.preventDefault(); }
    else if (k === 'f') { if (scene.soccer) kick(); else if (!e.repeat) doPunch(); e.preventDefault(); }
    else if (KEY_MOTION[k] && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) { if (!player.dnd) doMotion(player, KEY_MOTION[k]); }
  });
  window.addEventListener('keyup', e => { keys.delete(keyName(e)); keys.delete(e.key.toLowerCase()); });
  window.addEventListener('blur', () => keys.clear());
  $('actBtn').addEventListener('click', () => { if (near) near.run(); });

  let s = 2, cw = 0, ch = 0, dpr = 1, camX = 0, camY = 0, camInit = false;
  const toGame = e => { const rc = canvas.getBoundingClientRect(); return { x: (e.clientX - rc.left) / s + camX, y: (e.clientY - rc.top) / s + camY }; };

  // ---- layout editing (admins) ----
  let editMode = false, layoutBackup = null, drag = null, hoverItem = null;
  function itemAt(gx, gy) {
    const list = ITEMS.filter(it => !it.fixed).sort((a, z) => (z.sortY + off(z.id).dy) - (a.sortY + off(a.id).dy));
    return list.find(it => { const o = off(it.id), [x, y, w, h] = it.box; return gx >= x + o.dx - 1 && gx <= x + o.dx + w + 1 && gy >= y + o.dy - 1 && gy <= y + o.dy + h + 1; }) || null;
  }
  function startEdit() {
    editMode = true; layoutBackup = JSON.parse(JSON.stringify(layout));
    $('editBar').hidden = false; closeModal(); closeQr();
    toast('옮길 물건을 끌어서 놓으세요. 빈 곳을 끌면 화면이 움직여요.');
  }
  function stopEdit() { editMode = false; drag = null; hoverItem = null; $('editBar').hidden = true; }
  function endDrag(cancel) {
    if (!drag) return;
    if (cancel && drag.it) { layout[drag.it.id] = { dx: drag.odx, dy: drag.ody }; }
    drag = null; layout = cleanLayout(layout); applyLayout();
  }
  async function saveLayout() {
    layout = cleanLayout(layout); applyLayout();
    if (LIVE) {
      const { error } = await sb.from('content').update({ layout, updated_at: new Date().toISOString() }).eq('id', 1);
      if (error) { toast('배치를 저장하지 못했어요. 관리자 계정인지 확인해 주세요.'); return; }
      lobbySend('content', {});
    } else store.set('onl-layout', JSON.stringify(layout));
    stopEdit(); toast('배치를 저장했어요');
  }
  $('editSave').addEventListener('click', saveLayout);
  $('editCancel').addEventListener('click', () => { layout = layoutBackup || {}; applyLayout(); stopEdit(); toast('배치 편집을 취소했어요'); });
  $('editReset').addEventListener('click', () => { layout = {}; applyLayout(); toast('처음 배치로 돌렸어요. 저장을 눌러야 반영돼요.'); });
  $('layoutStart').addEventListener('click', () => { if (isAdmin) startEdit(); });

  canvas.addEventListener('pointerdown', e => {
    const g = toGame(e);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if (editMode) {
      const it = itemAt(g.x, g.y);
      const o = it ? off(it.id) : null;
      drag = it ? { it, gx: g.x, gy: g.y, odx: o.dx, ody: o.dy } : { pan: true, cx: e.clientX, cy: e.clientY, camX, camY };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      return;
    }
    const c = chairs.find(c => { const [hx, hy, hw, hh] = seatHit(c); return g.x >= hx && g.x <= hx + hw && g.y >= hy && g.y <= hy + hh; });
    if (c && c.team) { openParty(); return; }
    if (c) { if (c.occ === player) return; if (!c.occ) { goTo(player, seatApproach(c), () => sit(player, c)); return; } }
    const sp = spots.find(sp => g.x >= sp.hit[0] && g.x <= sp.hit[0] + sp.hit[2] && g.y >= sp.hit[1] && g.y <= sp.hit[1] + sp.hit[3]);
    if (sp) {
      const tgt = sp.sx != null ? { x: sp.sx, y: sp.sy } : { x: sp.x, y: sp.y };
      goTo(player, tgt, () => sp.run(), () => { if (Math.hypot(sp.x - player.x, sp.y - player.y) < sp.r) sp.run(); });
      return;
    }
    goTo(player, { x: g.x, y: g.y });
  });
  let hoverSpot = null;
  canvas.addEventListener('pointerleave', () => { hoverSpot = null; });
  canvas.addEventListener('pointermove', e => {
    if (!editMode) {
      if (e.pointerType !== 'mouse') return;
      const g = toGame(e);
      hoverSpot = spots.find(sp => g.x >= sp.hit[0] && g.x <= sp.hit[0] + sp.hit[2] && g.y >= sp.hit[1] && g.y <= sp.hit[1] + sp.hit[3]) || null;
      const chair = !hoverSpot && chairs.some(c => { const [hx, hy, hw, hh] = seatHit(c); return !c.occ && g.x >= hx && g.x <= hx + hw && g.y >= hy && g.y <= hy + hh; });
      canvas.style.cursor = hoverSpot || chair ? 'pointer' : 'default';
      return;
    }
    if (!drag) { const g = toGame(e); hoverItem = itemAt(g.x, g.y); canvas.style.cursor = hoverItem ? 'grab' : 'move'; return; }
    if (drag.pan) { camX = drag.camX - (e.clientX - drag.cx) / s; camY = drag.camY - (e.clientY - drag.cy) / s; return; }
    const g = toGame(e), [bx, by, bw, bh] = drag.it.box;
    const dx = clamp(Math.round(drag.odx + g.x - drag.gx), -bx, W - bx - bw), dy = clamp(Math.round(drag.ody + g.y - drag.gy), -by, H - by - bh);
    layout[drag.it.id] = { dx, dy };
    canvas.style.cursor = 'grabbing';
  });
  const finish = () => { if (drag) endDrag(false); };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  // ================= render =================
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const aw = stageEl.clientWidth, ah = stageEl.clientHeight;
    s = Math.max(Math.min(aw / W, ah / H), Math.min(aw / W * 1.4, 3));
    cw = Math.floor(Math.min(aw, W * s)); ch = Math.floor(Math.min(ah, H * s));
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  }
  new ResizeObserver(resize).observe(stageEl);
  resize();

  const walkFrame = c => [1, 0, 2, 0][Math.floor(c.animT * 8) % 4];
  function drawChar(c, now) {
    const legs = c.seat ? 'sit' : c.moving ? 'walk' : 'stand';
    const arms = c.action && c.action !== 'jump' ? c.action : 'none';
    let frame = legs === 'walk' ? walkFrame(c) : 0;
    if (arms === 'wave' || arms === 'clap' || arms === 'play') frame = Math.floor((now - c.actionT0) / 220) % 2 ? 1 : 2;
    const spr = sprite(kitLook(c), c.dir, legs, arms, frame);
    const x = Math.round(c.x), y = Math.round(c.y);
    const jump = c.action === 'jump' ? Math.round(Math.sin(clamp((now - c.actionT0) / 650, 0, 1) * Math.PI) * 8) : 0;
    if (!c.seat) { b.fillStyle = 'rgba(60,30,10,.28)'; b.fillRect(x - 5, y - 1, 10, 2); b.fillRect(x - 3, y + 1, 6, 1); }
    const shake = now - c.hitT0 < 320 ? (Math.floor(now / 40) % 2 ? 1 : -1) : 0;
    if (c.tie === 1 && c.seat) {
      // tying boots on the bench: head bowed forward
      const dx = x - 9, dy = y - 22 + 3;
      b.drawImage(spr, 0, 12, SW, SH - 12, dx, dy + 12, SW, SH - 12);
      b.drawImage(spr, 0, 0, SW, 12, dx, dy + 3, SW, 12);
    } else b.drawImage(spr, x - 9 + shake, y - 22 + (c.seat ? 3 : 0) - jump);
    drawHeld(c, x + shake, y - jump, now); drawFist(c, x, y - jump, now);
  }
  function drawWorld(now) {
    if (scene.weather) drawSky(now);
    b.drawImage(bg, 0, 0);
    if (player.path.length && !player.seat) {
      const t = player.path[player.path.length - 1], p = Math.floor(now / 220) % 2, tx = Math.round(t.x), ty = Math.round(t.y);
      b.fillStyle = '#ffcc4d';
      b.fillRect(tx - 3 - p, ty, 2, 1); b.fillRect(tx + 2 + p, ty, 2, 1); b.fillRect(tx, ty - 2 - p, 1, 1); b.fillRect(tx, ty + 1 + p, 1, 1);
    }
    const list = ITEMS.map(it => ({ y: it.sortY + off(it.id).dy, it }))
      .concat(chairs.map(c => ({ y: seatBackY(c), chair: c })))
      .concat(chars.map(c => ({ y: c.y, c })));
    if (scene.soccer && ball) list.push({ y: ball.y, ball: true });
    list.sort((a, z) => a.y - z.y);
    for (const e of list) {
      if (e.it) { const o = off(e.it.id); b.save(); b.translate(o.dx, o.dy); e.it.draw(b); b.restore(); }
      else if (e.chair) drawSeatBack(b, e.chair);
      else if (e.ball) drawBall(now);
      else drawChar(e.c, now);
    }
    drawMachineFx(now); drawEqFx(now);
    if (scene.weather) { drawWeatherFx(now); drawWeatherBoard(now); }
    if (!scene.lights) return;
    b.save(); b.globalCompositeOperation = 'lighter';
    const L = LIGHTS[lightMode].c;
    if (L) for (const lx of [40, 152]) {
      const lg = b.createRadialGradient(lx, 46, 2, lx, 74, 56);
      lg.addColorStop(0, `rgba(${L},.26)`); lg.addColorStop(1, `rgba(${L},0)`);
      b.fillStyle = lg; b.fillRect(0, 40, W, 80);
    }
    b.restore();
    if (!L) { b.fillStyle = 'rgba(20,14,30,.26)'; b.fillRect(0, 0, W, 112); }
  }
  function wrapText(c, text, maxW) {
    const lines = []; let cur = '';
    for (const chx of text) { if (c.measureText(cur + chx).width > maxW && cur) { lines.push(cur); cur = chx.trim() ? chx : ''; } else cur += chx; }
    if (cur) lines.push(cur);
    return lines.slice(0, 3);
  }
  function rrect(c, x, y, w, h, rr) {
    c.beginPath(); c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr); c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
  }
  function drawOverlay(now) {
    const fs = clamp(s * 4.6, 10, 13);
    const SX = gx => (gx - camX) * s, SY = gy => (gy - camY) * s;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (editMode) {
      for (const it of ITEMS.filter(i => !i.fixed)) {
        const o = off(it.id), [x, y, w, h] = it.box, active = (drag && drag.it === it) || hoverItem === it;
        ctx.setLineDash(active ? [] : [4, 3]); ctx.lineWidth = active ? 2.5 : 1.5;
        ctx.strokeStyle = active ? '#ffcc4d' : 'rgba(255,248,234,.85)';
        ctx.strokeRect(SX(x + o.dx), SY(y + o.dy), w * s, h * s);
        if (active) {
          ctx.setLineDash([]); ctx.font = `600 ${fs}px ${getComputedStyle(document.body).fontFamily}`;
          const tw = ctx.measureText(it.label).width + 12, lx = SX(x + o.dx + w / 2), ly = SY(y + o.dy) - fs;
          ctx.fillStyle = '#ffcc4d'; rrect(ctx, lx - tw / 2, ly - fs * 0.7, tw, fs * 1.4, 4); ctx.fill();
          ctx.fillStyle = '#251c2c'; ctx.fillText(it.label, lx, ly);
        }
      }
      ctx.setLineDash([]);
    } else for (const sp of spots) {
      const hov = hoverSpot === sp;
      if (Math.hypot(sp.x - player.x, sp.y - player.y) > 80 && !hov) continue;
      const active = near === sp;
      if (hov) {
        ctx.font = `700 ${fs}px ${getComputedStyle(document.body).fontFamily}`;
        const tw = ctx.measureText(sp.label).width + 14, th = fs * 1.6, x = clamp(SX(sp.ax), tw / 2 + 4, cw - tw / 2 - 4), y = Math.max(th / 2 + 4, SY(sp.ay) - 4);
        ctx.fillStyle = active ? '#3fb5a3' : '#ffcc4d'; ctx.strokeStyle = '#251c2c'; ctx.lineWidth = 2;
        rrect(ctx, x - tw / 2, y - th / 2, tw, th, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = active ? '#ffffff' : '#251c2c'; ctx.fillText(sp.label, x, y + 0.5);
        continue;
      }
      const bw = 18, bh = 11, x = SX(sp.ax), y = SY(sp.ay) - 4 + Math.sin(now / 260 + sp.ax) * 1.5;
      ctx.fillStyle = active ? '#3fb5a3' : '#fffdf7'; ctx.strokeStyle = '#251c2c'; ctx.lineWidth = 1.5;
      rrect(ctx, x - bw / 2, y - bh / 2, bw, bh, 4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3, y + bh / 2 - 0.5); ctx.lineTo(x, y + bh / 2 + 4); ctx.lineTo(x + 3, y + bh / 2 - 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(x - 2.5, y + bh / 2 - 2, 5, 2.2);
      ctx.fillStyle = active ? '#ffffff' : '#251c2c';
      const phase = Math.floor(now / 300) % 4;
      for (let i = 0; i < 3; i++) { const lift = active && i === phase ? 1 : 0; ctx.fillRect(x - 5 + i * 4, y - 1 - lift, 2, 2); }
    }
    if (!editMode) for (const lb of scene.labels || []) {
      const cnt = lb.count ? sceneCount(lb.count) : 0;
      ctx.font = `800 ${fs * 0.95}px ${getComputedStyle(document.body).fontFamily}`;
      const main = lb.t + (lb.sub ? ' ' + lb.sub : ''), extra = cnt ? ` · ${cnt}명` : '';
      const tw = ctx.measureText(main + extra).width + 10, th = fs * 1.35;
      let lx = SX(lb.x); if (lb.align === 'right') lx -= tw; else if (lb.align === 'center') lx -= tw / 2;
      const ly = SY(lb.y);
      ctx.fillStyle = cnt ? 'rgba(47,138,85,.92)' : 'rgba(37,28,44,.82)'; rrect(ctx, lx, ly, tw, th, 4); ctx.fill();
      ctx.fillStyle = '#fff8ea'; ctx.textAlign = 'left'; ctx.fillText(main + extra, lx + 5, ly + th / 2 + 0.5); ctx.textAlign = 'center';
    }
    for (const n of notes) {
      const t = (now - n.t0) / 1500;
      ctx.globalAlpha = 1 - t; ctx.font = `700 ${fs * 1.3}px sans-serif`;
      ctx.fillStyle = '#ffcc4d'; ctx.strokeStyle = '#251c2c'; ctx.lineWidth = 3;
      const x = SX(n.x + Math.sin(t * 6) * 3), y = SY(n.y - t * 18);
      ctx.strokeText(n.sym, x, y); ctx.fillText(n.sym, x, y);
    }
    ctx.globalAlpha = 1;
    const fam = getComputedStyle(document.body).fontFamily;
    for (const f of floaters) {
      const t = (now - f.t0) / 2200; ctx.globalAlpha = t < 0.75 ? 1 : (1 - t) * 4;
      if (f.bare) { ctx.font = `${fs * 1.6}px sans-serif`; ctx.fillText(f.text, SX(f.x), SY(f.y) - t * 14 * s / 2); continue; }
      ctx.font = `800 ${fs}px ${fam}`;
      const tw = ctx.measureText(f.text).width + 12, th = fs * 1.5, x = clamp(SX(f.x), tw / 2 + 4, cw - tw / 2 - 4), y = SY(f.y) - t * 14 * s / 2;
      ctx.fillStyle = 'rgba(37,28,44,.88)'; rrect(ctx, x - tw / 2, y - th / 2, tw, th, 5); ctx.fill();
      ctx.fillStyle = '#ffcc4d'; ctx.fillText(f.text, x, y + 0.5);
    }
    ctx.globalAlpha = 1;
    const sorted = chars.slice().sort((a, z) => a.y - z.y);
    for (const c of sorted) {
      const headTop = c.y - 20 + (c.seat ? 3 : 0) - (c.action === 'jump' ? 8 : 0);
      const sx = SX(c.x), ny0 = SY(headTop);
      if (ny0 < -40 || ny0 > ch + 60) continue;
      ctx.font = `700 ${fs}px ${fam}`;
      const label = c.name || '…';
      const nh = fs + 5, ny = ny0 - nh / 2 - 1;
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a1420'; ctx.strokeText(label, sx, ny + 0.5);
      ctx.fillStyle = c.isPlayer ? '#ffd65a' : '#8fe38a'; ctx.fillText(label, sx, ny + 0.5);
      let top = ny - nh / 2 - 4;
      if (c.isPlayer ? gmActive() && !gm.practice : c.og) {
        const r = Math.max(3, fs * 0.42), gy = top - r - 2;
        for (const [dx, col] of [[-r - 1, '#16131a'], [r + 1, '#fbf8f2']]) { ctx.beginPath(); ctx.arc(sx + dx, gy, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#251c2c'; ctx.stroke(); }
        top -= r * 2 + 4;
      }
      const ht = now - c.hitT0;
      if (ht < 1500) {
        const hx = SX(c.x), hy = SY(c.y - 16);
        if (ht < 420) {
          const r = fs * (1.2 + ht / 420 * 0.6);
          ctx.fillStyle = '#ffcc4d'; ctx.strokeStyle = '#251c2c'; ctx.lineWidth = 2; ctx.beginPath();
          for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? r * 0.5 : r; ctx.lineTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.font = `800 ${fs * 0.8}px ${fam}`; ctx.fillStyle = '#d84b3a'; ctx.fillText('퍽!', hx, hy + 1);
        } else {
          ctx.font = `700 ${fs}px sans-serif`; ctx.fillStyle = '#ffcc4d'; ctx.strokeStyle = '#251c2c'; ctx.lineWidth = 2.5;
          for (let i = 0; i < 3; i++) { const a = now / 180 + i * 2.09, x = sx + Math.cos(a) * fs * 1.1, y = top - fs * 0.3 + Math.sin(a) * fs * 0.35; ctx.strokeText('★', x, y); ctx.fillText('★', x, y); }
          top -= fs * 0.9;
        }
      }
      if (c.tie && c.seat && sceneId === 'f1r1') {
        ctx.font = `${fs * 1.1}px sans-serif`;
        ctx.fillText(c.tie === 1 ? '👟' : '✅', sx + fs * 1.3, top + (c.tie === 1 ? Math.sin(now / 150) * 2 : 0));
      }
      if (c.zz && !c.dnd && !c.emote) {
        ctx.font = `700 ${fs * 1.2}px "Pixelify Sans", sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = '#251c2c'; ctx.fillStyle = '#c9d6ff';
        for (let i = 0; i < 3; i++) { const ph = ((now / 1400) + i / 3) % 1, x = sx + 4 + ph * fs * 0.9, y = top - fs * 0.4 - ph * fs * 1.6; ctx.globalAlpha = ph < 0.8 ? 1 : (1 - ph) * 5; ctx.font = `700 ${fs * (0.8 + ph * 0.6)}px "Pixelify Sans", sans-serif`; ctx.strokeText('z', x, y); ctx.fillText('z', x, y); }
        ctx.globalAlpha = 1; top -= fs * 1.6;
      }
      if (c.emote && !c.dnd) {
        ctx.font = `700 ${fs * 1.5}px "Pixelify Sans", sans-serif`;
        const ey = top - fs * 0.8 + Math.sin(now / 160) * 2;
        ctx.lineWidth = 3; ctx.strokeStyle = '#251c2c'; ctx.strokeText(c.emote.sym, sx, ey);
        ctx.fillStyle = c.emote.sym === '♥' ? '#ff6b8a' : '#ffcc4d'; ctx.fillText(c.emote.sym, sx, ey);
        top -= fs * 1.7;
      }
      if (c.dnd) {
        const pw = fs * 2.2, ph = fs * 1.9, px = sx - pw / 2, py = top - ph - 6;
        ctx.fillStyle = '#fffdf7'; ctx.strokeStyle = '#251c2c'; ctx.lineWidth = 2;
        rrect(ctx, px, py, pw, ph, 6); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - 4, py + ph - 1); ctx.lineTo(sx, py + ph + 5); ctx.lineTo(sx + 4, py + ph - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(sx - 3, py + ph - 3, 6, 3);
        ctx.font = `${fs * 1.25}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.fillStyle = '#251c2c'; ctx.fillText('🙏', sx, py + ph / 2 + 1);
        continue;
      }
      if (c.bubble && !player.dnd) {
        ctx.font = `500 ${fs}px ${fam}`;
        const lines = wrapText(ctx, c.bubble.text, Math.max(90, s * 56)), lh = fs * 1.35;
        const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16, bh = lines.length * lh + 10;
        const bx = clamp(sx - bw / 2, 4, cw - bw - 4), by = top - bh - 6;
        ctx.fillStyle = '#fffdf7'; ctx.strokeStyle = '#251c2c'; ctx.lineWidth = 2;
        rrect(ctx, bx, by, bw, bh, 6); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - 5, by + bh - 1); ctx.lineTo(sx, by + bh + 6); ctx.lineTo(sx + 5, by + bh - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(sx - 4, by + bh - 3, 8, 3);
        ctx.fillStyle = '#2b2230'; lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 5 + lh * (i + 0.5)));
      }
    }
    const fam2 = getComputedStyle(document.body).fontFamily;
    if (scene.weather) {
      // today's Beijing weather on the rooftop sign
      ctx.font = `800 ${fs * 0.95}px ${fam2}`; ctx.fillStyle = '#251c2c';
      if (WX.ok) ctx.fillText(`${Math.round(WX.temp)}°`, SX(169), SY(107.5));
    }
    if (scene.soccer) drawSoccerHud(ctx, fs, fam2);
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt, now); drawWorld(now);
    const vw = cw / s, vh = ch / s;
    if (editMode) {
      if (drag && drag.it) { const o = off(drag.it.id), [x, y, w, h] = drag.it.box, cx = x + o.dx + w / 2, cy = y + o.dy + h / 2;
        if (SYc(cy) < 0.15 || SYc(cy) > 0.85) camY += ((cy - vh / 2) - camY) * Math.min(1, dt * 3); }
      camX = clamp(camX, 0, Math.max(0, W - vw)); camY = clamp(camY, 0, Math.max(0, H - vh));
    } else {
      const tx = clamp(player.x - vw / 2, 0, Math.max(0, W - vw)), ty = clamp(player.y - 14 - vh / 2, 0, Math.max(0, H - vh));
      if (!camInit) { camX = tx; camY = ty; camInit = true; }
      camX += (tx - camX) * Math.min(1, dt * 6); camY += (ty - camY) * Math.min(1, dt * 6);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(buf, camX, camY, vw, vh, 0, 0, cw, ch);
    if (player.dnd) {
      const px = (player.x - camX) * s, py = (player.y - 12 - camY) * s;
      const lg = ctx.createRadialGradient(px, py, s * 6, px, py, s * 46);
      lg.addColorStop(0, 'rgba(12,10,24,.25)'); lg.addColorStop(1, 'rgba(12,10,24,.78)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, cw, ch);
    }
    drawOverlay(now);
    requestAnimationFrame(loop);
  }
  const SYc = gy => (gy - camY) / (ch / s);

  // ================= panel / tabs =================
  const app = $('app');
  const TITLES = { chat: '대화', char: '내 캐릭터 꾸미기', admin: '관리자' };
  const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;
  let tab = 'chat', open = false;
  function setTab(t) {
    tab = t;
    document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t; });
    $('panelTitle').textContent = TITLES[t]; syncTabs();
    if (t === 'chat') { const pane = logEl.parentElement; pane.scrollTop = pane.scrollHeight; if (open || isDesktop()) { unread = 0; syncUnread(); } }
  }
  function syncTabs() {
    document.querySelectorAll('.tabs [data-tab]').forEach(btn => btn.setAttribute('aria-pressed', String((isDesktop() || open) && btn.dataset.tab === tab)));
    app.classList.toggle('open', open);
  }
  document.querySelectorAll('.tabs [data-tab]').forEach(btn => btn.addEventListener('click', () => {
    const t = btn.dataset.tab;
    if (isDesktop()) { setTab(tab === t && t !== 'chat' ? 'chat' : t); return; }
    if (open && tab === t) { open = false; syncTabs(); return; }
    open = true; setTab(t);
  }));
  $('panelClose').addEventListener('click', () => { open = false; syncTabs(); });
  window.matchMedia('(min-width: 900px)').addEventListener('change', syncTabs);

  // ================= character pane =================
  function drawPreviews(now) {
    const fr = [1, 0, 2, 0][Math.floor(now / 160) % 4];
    ['down', 'right', 'up'].forEach((d, i) => { const c = $('pv' + i).getContext('2d'); c.clearRect(0, 0, SW, SH); c.drawImage(sprite(player.look, d, 'walk', 'none', fr), 0, 0); });
  }
  (function pvLoop(now) { if (!$('pv0').closest('[hidden]')) drawPreviews(now); requestAnimationFrame(pvLoop); })(0);
  function onLook() { store.set('onus-look', JSON.stringify(player.look)); saveProfileSoon(); }
  const nameInput = $('nameInput');
  nameInput.value = player.name;
  nameInput.addEventListener('input', () => { player.name = nameInput.value.trim().slice(0, 8) || '나'; store.set('onl-name', player.name); renderPeople(); saveProfileSoon(); });
  $('editLookBtn').addEventListener('click', () => openCreator('edit'));
  $('logoutBtn').addEventListener('click', async () => {
    if (LIVE) { await sb.auth.signOut(); } else { store.set('onl-demo-auth', ''); }
    location.reload();
  });

  // ================= character creator (full screen) =================
  const CAT = [
    { id: 'hair', label: '헤어스타일' }, { id: 'hairColor', label: '머리 색' },
    { id: 'top', label: '상의' }, { id: 'bottom', label: '하의' }
  ];
  let crMode = 'edit', crCat = 'hair', crDir = 0, crBackup = null, crDone = null;
  const DIRS = ['down', 'right', 'up', 'left'];
  function openCreator(mode, onDone) {
    crMode = mode; crDone = onDone || null; crBackup = Object.assign({}, player.look);
    $('creator').hidden = false;
    $('crTitle').textContent = mode === 'edit' ? '캐릭터 꾸미기' : '캐릭터 만들기';
    $('crDone').textContent = mode === 'edit' ? '저장' : '이 모습으로 입장';
    $('crCancel').hidden = mode !== 'edit';
    $('crName').value = player.name === '나' || player.name === '새친구' ? '' : player.name;
    $('crNameRow').hidden = false;
    $('crErr').textContent = '';
    renderCreator();
  }
  function closeCreator() { $('creator').hidden = true; if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); }
  function thumb(look, view, crop) {
    const cv = document.createElement('canvas'); cv.width = SW; cv.height = crop ? 14 : SH;
    const c = cv.getContext('2d'); c.drawImage(sprite(look, view, 'stand', 'none', 0), 0, crop ? -1 : 0);
    return cv;
  }
  function optBtn(label, pressed, onClick, art) {
    const btn = el('button', 'cr-opt'); btn.type = 'button'; btn.setAttribute('aria-pressed', String(pressed));
    if (art) btn.appendChild(art);
    btn.appendChild(el('span', '', label));
    btn.addEventListener('click', onClick);
    return btn;
  }
  function swatchRow(list, key) {
    const row = el('div', 'cr-swatches');
    list.forEach((o, i) => {
      const b2 = el('button', 'sw'); b2.type = 'button'; b2.style.background = o.c; b2.title = o.n; b2.setAttribute('aria-label', o.n);
      b2.setAttribute('aria-pressed', String(player.look[key] === o.c));
      b2.addEventListener('click', () => { player.look = Object.assign({}, player.look, { [key]: o.c }); renderCreator(); });
      row.appendChild(b2);
    });
    return row;
  }
  function renderCreator() {
    document.querySelectorAll('#crTabs [data-cat]').forEach(t => t.setAttribute('aria-pressed', String(t.dataset.cat === crCat)));
    const box = $('crOptions'); box.innerHTML = '';
    const L = player.look;
    const setL = (k, v) => () => { player.look = Object.assign({}, player.look, { [k]: v }); renderCreator(); };
    if (crCat === 'hair') {
      [['남성', 'm'], ['여성', 'f']].forEach(([title, gnd]) => {
        box.appendChild(el('div', 'cr-sub', title));
        const grid = el('div', 'cr-grid');
        HAIRS.filter(h => h.g === gnd).forEach(h => grid.appendChild(optBtn(h.label, L.hair === h.id, setL('hair', h.id), thumb(Object.assign({}, L, { hair: h.id }), 'down', true))));
        box.appendChild(grid);
      });
    } else if (crCat === 'hairColor') {
      const grid = el('div', 'cr-grid');
      HAIR_COLORS.forEach(o => grid.appendChild(optBtn(o.n, L.hairColor === o.c, setL('hairColor', o.c), thumb(Object.assign({}, L, { hairColor: o.c }), 'down', true))));
      box.appendChild(grid);
    } else if (crCat === 'top') {
      box.appendChild(el('div', 'cr-sub', '색'));
      box.appendChild(swatchRow(TOP_COLORS, 'topColor'));
      box.appendChild(el('div', 'cr-sub', '종류'));
      const grid = el('div', 'cr-grid');
      TOPS.forEach(t => grid.appendChild(optBtn(t.label, L.top === t.id, setL('top', t.id), thumb(Object.assign({}, L, { top: t.id }), 'down'))));
      box.appendChild(grid);
    } else {
      box.appendChild(el('div', 'cr-sub', '색'));
      box.appendChild(swatchRow(BOTTOM_COLORS, 'bottomColor'));
      box.appendChild(el('div', 'cr-sub', '종류'));
      const grid = el('div', 'cr-grid');
      BOTTOMS.forEach(t => grid.appendChild(optBtn(t.label, L.bottom === t.id, setL('bottom', t.id), thumb(Object.assign({}, L, { bottom: t.id }), 'down'))));
      box.appendChild(grid);
    }
    const hn = HAIRS.find(h => h.id === L.hair), hc = HAIR_COLORS.find(x => x.c === L.hairColor), tn = TOPS.find(t => t.id === L.top), tc = TOP_COLORS.find(x => x.c === L.topColor), bn = BOTTOMS.find(t => t.id === L.bottom), bc = BOTTOM_COLORS.find(x => x.c === L.bottomColor);
    $('crSummary').textContent = `${hc.n} ${hn.label} · ${tc.n} ${tn.label} · ${bc.n} ${bn.label}`;
  }
  document.querySelectorAll('#crTabs [data-cat]').forEach(t => t.addEventListener('click', () => { crCat = t.dataset.cat; renderCreator(); }));
  $('crLeft').addEventListener('click', () => { crDir = (crDir + 1) % 4; });
  $('crRight').addEventListener('click', () => { crDir = (crDir + 3) % 4; });
  $('crRandom').addEventListener('click', () => { player.look = randomLook(); renderCreator(); });
  $('crCancel').addEventListener('click', () => { player.look = crBackup; closeCreator(); });
  $('crDone').addEventListener('click', async () => {
    const name = $('crName').value.trim().slice(0, 8);
    if (!name) { $('crErr').textContent = '이름을 입력해 주세요.'; $('crName').focus(); return; }
    player.name = name; nameInput.value = name; store.set('onl-name', name);
    store.set('onus-look', JSON.stringify(player.look));
    if (crDone) { const btn = $('crDone'); btn.disabled = true; const ok = await crDone(); btn.disabled = false; if (!ok) return; }
    else saveProfileSoon();
    closeCreator(); renderPeople(); doMotion(player, 'jump');
  });
  (function crLoop(now) {
    if (!$('creator').hidden) {
      const c = $('crPv').getContext('2d'), fr = [1, 0, 2, 0][Math.floor(now / 170) % 4];
      c.clearRect(0, 0, SW, SH); c.drawImage(sprite(player.look, DIRS[crDir], 'walk', 'none', fr), 0, 0);
    }
    requestAnimationFrame(crLoop);
  })(0);

  function sceneCount(id) {
    if (LIVE) return net.counts[id] || 0;
    return entities.filter(e => e.scene === id).length;
  }
  function renderPeople() {
    const p = $('people'); p.innerHTML = '';
    chars.forEach(c => p.appendChild(el('span', c.isPlayer ? 'me' : '', c.dnd ? `🙏 ${c.name || '…'}` : (c.name || '…'))));
    $('count').textContent = LIVE ? Math.max(net.total || 1, 1) : entities.length;
    const where = Object.keys(SCENES).map(id => [id, sceneCount(id)]).filter(([, n]) => n).map(([id, n]) => `${SCENES[id].name.replace(/ · .*/, m => m)} ${n}명`);
    $('where').textContent = where.length ? '지금 접속: ' + where.join(' · ') : '';
  }

  // ================= admin =================
  let isAdmin = false, draftAds = [], draftQr = null;
  function showAdmin() {
    $('adminLock').hidden = isAdmin; $('adminEdit').hidden = !isAdmin;
    $('pinBox').hidden = LIVE; $('liveLockNote').hidden = !LIVE; $('adminLogout').hidden = LIVE;
    if (isAdmin) { draftAds = content.ads.map(a => Object.assign({}, a)); draftQr = content.qr; fillAdmin(); }
  }
  function fillAdmin() {
    setPlanMonth(chinaYmd().slice(0, 7));
    const th = $('qrThumb'); if (draftQr) { th.src = draftQr; th.hidden = false; } else th.hidden = true;
    renderAds();
  }
  function renderAds() {
    const list = $('adList'); list.innerHTML = '';
    draftAds.forEach((a, i) => {
      const box = el('div', 'ad-edit');
      const t = el('input'); t.type = 'text'; t.id = `ad-t-${i}`; t.value = a.t; t.placeholder = '제목'; t.setAttribute('aria-label', `광고 ${i + 1} 제목`); t.addEventListener('input', () => { a.t = t.value; });
      const d = el('textarea'); d.id = `ad-b-${i}`; d.rows = 2; d.value = a.b; d.placeholder = '내용'; d.setAttribute('aria-label', `광고 ${i + 1} 내용`); d.addEventListener('input', () => { a.b = d.value; });
      const del = el('button', 'btn', '삭제'); del.type = 'button'; del.addEventListener('click', () => { draftAds.splice(i, 1); renderAds(); });
      box.append(t, d, del); list.appendChild(box);
    });
  }
  function tryPin() {
    if ($('pinInput').value === '0000') { isAdmin = true; $('pinInput').value = ''; showAdmin(); toast('관리자 모드로 들어왔어요'); }
    else $('pinMsg').textContent = 'PIN이 맞지 않아요. 테스트용 PIN은 0000이에요.';
  }
  $('pinBtn').addEventListener('click', tryPin);
  $('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryPin(); });
  $('adminLogout').addEventListener('click', () => { if (!LIVE) { isAdmin = false; stopEdit(); showAdmin(); } });
  $('adAdd').addEventListener('click', () => { draftAds.push({ t: '', b: '' }); renderAds(); const l = $(`ad-t-${draftAds.length - 1}`); if (l) l.focus(); });
  $('qrFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
        draftQr = cv.toDataURL('image/png');
        const th = $('qrThumb'); th.src = draftQr; th.hidden = false;
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
  $('qrRemove').addEventListener('click', () => { draftQr = null; $('qrThumb').hidden = true; $('qrFile').value = ''; });
  $('adminSave').addEventListener('click', async () => {
    if (!isAdmin) return;
    const next = {
      ads: draftAds.filter(a => a.t.trim()).map(a => ({ t: a.t.trim(), b: a.b.trim() })),
      qr: draftQr, sample: false
    };
    if (LIVE) {
      const { error } = await sb.from('content').update({ ads: next.ads, qr_url: next.qr, sample: false, updated_at: new Date().toISOString() }).eq('id', 1);
      if (error) { toast('저장하지 못했어요. 관리자 계정인지 확인해 주세요.'); return; }
      content = next; lobbySend('content', {});
      toast('저장했어요. 모든 사람에게 바로 보여요.');
    } else {
      content = next;
      toast(store.set('cl-content', JSON.stringify(content)) ? '저장했어요. 게시판·헌금함에서 확인해 보세요.' : '이 기기에 저장하지 못했어요. QR 이미지를 더 작은 파일로 올려 주세요.');
    }
    draftAds = content.ads.map(a => Object.assign({}, a)); renderAds();
  });


  // ---- QT plan editor (admins): photo -> text -> rows -> save ----
  let planYm = null, planRows = [];
  async function setPlanMonth(ym) {
    planYm = ym; $('qtMonth').value = ym;
    const from = `${ym}-01`, to = `${ym}-${String(daysIn(ym)).padStart(2, '0')}`;
    if (LIVE) await loadQtPlan(from, to);
    planRows = Object.keys(qtPlan).filter(k => k >= from && k <= to && !(qtSample && !LIVE)).sort().map(k => ({ day: +k.slice(8), ref: qtPlan[k] }));
    $('ocrMsg').textContent = planRows.length ? `저장된 일정 ${planRows.length}일이 있어요.` : '이 달 일정이 아직 없어요. 본문표 사진을 올려 주세요.';
    renderPlan();
  }
  const REF_OK = /^\S+ \d{1,3}(?::\d{1,3}(?:-\d{1,3}(?::\d{1,3})?)?|편|장|-\d{1,3}장)$/;
  const refWarn = ref => { if (!REF_OK.test(ref)) return true; const nums = (ref.match(/\d+/g) || []).map(Number); return nums.some(n => n > 176 || n < 1); };
  function renderPlan() {
    const box = $('qtRows'); box.innerHTML = '';
    const n = daysIn(planYm);
    planRows.sort((a, z) => a.day - z.day);
    planRows.forEach((r, i) => {
      const row = el('div', 'qt-row' + (refWarn(r.ref) || r.day < 1 || r.day > n ? ' warn' : ''));
      const d = el('input'); d.type = 'number'; d.min = 1; d.max = n; d.value = r.day; d.id = `qt-d-${i}`; d.setAttribute('aria-label', '날짜');
      d.addEventListener('change', () => { r.day = +d.value; renderPlan(); });
      const t = el('input'); t.type = 'text'; t.value = r.ref; t.id = `qt-r-${i}`; t.setAttribute('aria-label', `${r.day}일 본문`);
      t.addEventListener('change', () => { r.ref = t.value.trim(); row.classList.toggle('warn', refWarn(r.ref)); });
      const del = el('button', 'btn', '삭제'); del.type = 'button'; del.addEventListener('click', () => { planRows.splice(i, 1); renderPlan(); });
      row.append(d, t, del); box.appendChild(row);
    });
    const have = new Set(planRows.map(r => r.day)), missing = [];
    for (let d = 1; d <= n; d++) if (!have.has(d)) missing.push(d);
    const warnN = planRows.filter(r => refWarn(r.ref)).length;
    $('qtCheck').textContent = !planRows.length ? '' : [missing.length ? `빠진 날: ${missing.join(', ')}일` : '모든 날짜가 채워졌어요.', warnN ? `주황색 칸 ${warnN}개는 확인이 필요해요.` : ''].filter(Boolean).join(' ');
  }
  function applyParsed(text) {
    const rows = ONL_PARSE.parseSchedule(text, daysIn(planYm));
    if (!rows.length) { $('ocrMsg').textContent = '본문 범위를 찾지 못했어요. 사진을 더 밝고 반듯하게 찍거나, 글로 붙여넣어 주세요.'; return; }
    const map = new Map(planRows.map(r => [r.day, r])); rows.forEach(r => map.set(r.day, r));
    planRows = [...map.values()];
    $('ocrMsg').textContent = `${rows.length}일 치 본문을 읽었어요. 표를 확인하고 저장해 주세요.`;
    renderPlan();
  }
  const loadScript = src => new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error('load')); document.head.appendChild(sc); });
  async function prepImage(file) {
    const bmp = await createImageBitmap(file);
    let k = bmp.width < 1400 ? 2 : 1; if (bmp.width * k > 3000) k = 3000 / bmp.width;
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(bmp, 0, 0, cv.width, cv.height);
    const im = c.getImageData(0, 0, cv.width, cv.height), px = im.data, hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) { const l = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000 | 0; px[i] = l; hist[l]++; }
    const total = px.length / 4; let lo = 0, hi = 255, acc = 0;
    for (; lo < 255; lo++) { acc += hist[lo]; if (acc > total * 0.01) break; }
    acc = 0; for (; hi > 0; hi--) { acc += hist[hi]; if (acc > total * 0.01) break; }
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < px.length; i += 4) { const v = clamp(Math.round((px[i] - lo) * 255 / span), 0, 255); px[i] = px[i + 1] = px[i + 2] = v; }
    c.putImageData(im, 0, 0);
    return cv;
  }
  $('qtPhoto').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const msg = $('ocrMsg');
    try {
      msg.textContent = '글자 읽기를 준비하는 중… (처음에는 10~20초 걸려요)';
      if (!window.Tesseract) await loadScript('tesseract.min.js');
      const base = new URL('./', location.href).href;
      const worker = await Tesseract.createWorker('kor', 1, {
        workerPath: base + 'worker.min.js', corePath: base, langPath: base.replace(/\/$/, ''),
        logger: m => { if (m.status === 'recognizing text') msg.textContent = `사진 속 글자를 읽는 중… ${Math.round(m.progress * 100)}%`; }
      });
      const { data } = await worker.recognize(await prepImage(f));
      await worker.terminate();
      $('qtPaste').value = data.text;
      applyParsed(data.text);
    } catch (err) {
      msg.textContent = LIVE ? '사진을 읽지 못했어요. 다른 사진으로 해 보거나 글로 붙여넣어 주세요.' : '체험판에서는 사진 읽기를 쓸 수 없어요. 아래 "글로 붙여넣기"로 해 보세요.';
    }
    e.target.value = '';
  });
  $('qtPasteBtn').addEventListener('click', () => applyParsed($('qtPaste').value));
  $('qtMonth').addEventListener('change', () => { if ($('qtMonth').value) setPlanMonth($('qtMonth').value); });
  $('qtAddRow').addEventListener('click', () => {
    const used = new Set(planRows.map(r => r.day)); let d = 1; while (used.has(d) && d < daysIn(planYm)) d++;
    planRows.push({ day: d, ref: '' }); renderPlan(); const last = $(`qt-r-${planRows.findIndex(r => r.day === d && r.ref === '')}`); if (last) last.focus();
  });
  $('qtSave').addEventListener('click', async () => {
    if (!isAdmin) return;
    const n = daysIn(planYm), seen = new Set();
    const rows = planRows.filter(r => r.ref && r.day >= 1 && r.day <= n && !seen.has(r.day) && seen.add(r.day))
      .map(r => ({ day: `${planYm}-${String(r.day).padStart(2, '0')}`, ref: r.ref.slice(0, 80) }));
    const from = `${planYm}-01`, to = `${planYm}-${String(n).padStart(2, '0')}`;
    if (LIVE) {
      const del = await sb.from('qt_plan').delete().gte('day', from).lte('day', to);
      const ins = rows.length ? await sb.from('qt_plan').insert(rows) : { error: null };
      if (del.error || ins.error) { toast('일정을 저장하지 못했어요. 관리자 계정인지 확인해 주세요.'); return; }
      lobbySend('content', {});
    } else {
      if (qtSample) { qtPlan = {}; qtSample = false; }
    }
    for (const k of Object.keys(qtPlan)) if (k >= from && k <= to) delete qtPlan[k];
    rows.forEach(r => { qtPlan[r.day] = r.ref; });
    if (!LIVE) store.set('onl-qtplan', JSON.stringify(qtPlan));
    toast(`${planYm.replace('-', '년 ')}월 QT 일정 ${rows.length}일을 저장했어요`);
  });


  // ================= sound effects (made in the browser, no audio files) =================
  let actx = null, sfxOn = store.get('onl-sfx') !== '0';
  function ac() {
    if (!sfxOn) return null;
    try {
      if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); const comp = actx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(actx.destination); actx.__out = actx.createGain(); actx.__out.gain.value = 0.85; actx.__out.connect(comp); }
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { return null; }
    return actx;
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function tone(a, t, f, d, type, v, o2) {
    const o = a.createOscillator(), g = a.createGain(); let node = o;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (o2 && o2.slide) o.frequency.exponentialRampToValueAtTime(o2.slide, t + d);
    if (o2 && o2.detune) o.detune.value = o2.detune;
    if (o2 && o2.dist) { const ws = a.createWaveShaper(), cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv[i] = Math.tanh(x * o2.dist); } ws.curve = cv; node.connect(ws); node = ws; }
    if (o2 && o2.lp) { const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o2.lp; if (o2.q) fl.Q.value = o2.q; node.connect(fl); node = fl; }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    node.connect(g); g.connect(a.__out); o.start(t); o.stop(t + d + 0.03);
  }
  let noiseBuf = null;
  function noise(a, t, d, v, type, freq, q) {
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const ch0 = noiseBuf.getChannelData(0); for (let i = 0; i < ch0.length; i++) ch0[i] = Math.random() * 2 - 1; }
    const src = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf; src.loop = true; fl.type = type; fl.frequency.value = freq; if (q) fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(fl); fl.connect(g); g.connect(a.__out); src.start(t, Math.random() * 0.5); src.stop(t + d + 0.03);
  }
  const RIFFS = [[60, 64, 67, 72], [62, 65, 69, 74], [57, 60, 64, 69], [65, 69, 72, 77]];
  function sfx(kind, vol = 1) {
    const a = ac(); if (!a || vol <= 0) return;
    const t = a.currentTime + 0.02, v = x => Math.max(0.0002, x * vol), R = pick(RIFFS);
    switch (kind) {
      // every instrument keeps some energy above ~200 Hz so it is heard on phone speakers too
      case 'piano':
        R.forEach((m, i) => { const tt = t + i * 0.14; tone(a, tt, mtof(m), 1.3, 'triangle', v(0.3)); tone(a, tt, mtof(m + 12), 0.6, 'sine', v(0.1)); tone(a, tt, mtof(m + 19), 0.25, 'sine', v(0.03)); });
        tone(a, t + 0.56, mtof(R[0] - 12), 1.4, 'triangle', v(0.18)); tone(a, t + 0.56, mtof(R[2] - 12), 1.4, 'triangle', v(0.12));
        break;
      case 'synth':
        R.concat(R[2] + 12, R[0] + 12).forEach((m, i) => { const tt = t + i * 0.1; tone(a, tt, mtof(m + 12), 0.3, 'square', v(0.16), { lp: 3200 }); tone(a, tt, mtof(m + 12), 0.3, 'sawtooth', v(0.09), { detune: 9, lp: 3200 }); });
        tone(a, t, mtof(R[0]), 0.9, 'sawtooth', v(0.11), { lp: 1400, detune: -7 });
        break;
      case 'bass':
        [R[0] - 12, R[0] - 12, R[2] - 12, R[1] - 12, R[0] - 12].forEach((m, i) => { const tt = t + i * 0.16; tone(a, tt, mtof(m), 0.28, 'sawtooth', v(0.32), { lp: 900, q: 4 }); tone(a, tt, mtof(m - 12), 0.28, 'sine', v(0.3)); tone(a, tt, mtof(m + 12), 0.08, 'triangle', v(0.08)); });
        break;
      case 'elec':
        [[R[0] - 12, R[0] - 5, R[0]], [R[1] - 12, R[1] - 5, R[1]], [R[3] - 12, R[3] - 5, R[3]]].forEach((ch, k) => ch.forEach((m, i) => tone(a, t + k * 0.24 + i * 0.012, mtof(m), k === 2 ? 0.9 : 0.24, 'sawtooth', v(0.11), { dist: 6, lp: 3000 })));
        break;
      case 'drum': {
        const kick = d => { tone(a, t + d, 190, 0.28, 'sine', v(0.75), { slide: 50 }); tone(a, t + d, 1500, 0.03, 'triangle', v(0.25), { slide: 300 }); };
        const snare = d => { noise(a, t + d, 0.18, v(0.5), 'highpass', 1200); tone(a, t + d, 230, 0.1, 'triangle', v(0.3), { slide: 160 }); };
        const hat = (d, g) => noise(a, t + d, 0.045, v(g || 0.2), 'highpass', 7500);
        kick(0); hat(0); hat(0.12); snare(0.24); hat(0.24, 0.12); hat(0.36); kick(0.48); kick(0.6); hat(0.6); snare(0.72); hat(0.84);
        [0.9, 0.96, 1.02].forEach((d, i) => tone(a, t + d, [260, 200, 150][i], 0.18, 'sine', v(0.45), { slide: [180, 140, 100][i] }));
        noise(a, t + 1.08, 0.6, v(0.22), 'highpass', 5000); kick(1.08);
        break;
      }
      case 'punch': noise(a, t, 0.12, v(0.45), 'lowpass', 1400); tone(a, t, 180, 0.22, 'sine', v(0.55), { slide: 50 }); break;
      case 'whoosh': noise(a, t, 0.22, v(0.12), 'bandpass', 900, 1.2); break;
      case 'pour': noise(a, t, 1.0, v(0.12), 'bandpass', 1500, 2); for (let i = 0; i < 4; i++) tone(a, t + 0.15 + i * 0.2, 900 + i * 120, 0.08, 'sine', v(0.05)); break;
      case 'brew': noise(a, t, 1.6, v(0.09), 'lowpass', 500); for (let i = 0; i < 7; i++) tone(a, t + 0.25 + i * 0.18 + Math.random() * 0.05, 300 + Math.random() * 400, 0.06, 'sine', v(0.06)); tone(a, t + 1.65, mtof(84), 0.25, 'sine', v(0.08)); tone(a, t + 1.8, mtof(88), 0.35, 'sine', v(0.08)); break;
      case 'ding': tone(a, t, mtof(84), 0.9, 'sine', v(0.2)); tone(a, t + 0.28, mtof(79), 1.1, 'sine', v(0.18)); break;
      case 'kick': tone(a, t, 140, 0.12, 'sine', v(0.7), { slide: 60 }); noise(a, t, 0.06, v(0.35), 'bandpass', 1200, 1); break;
      case 'whistle': tone(a, t, 2600, 0.25, 'sine', v(0.12)); tone(a, t + 0.3, 2600, 0.5, 'sine', v(0.12)); tone(a, t + 0.3, 2660, 0.5, 'sine', v(0.06)); break;
      case 'goal': noise(a, t, 1.6, v(0.18), 'bandpass', 900, 0.5); [72, 76, 79, 84].forEach((m, i) => tone(a, t + 0.1 + i * 0.12, mtof(m), 0.5, 'triangle', v(0.14))); break;
      case 'sip': tone(a, t, 520, 0.09, 'sine', v(0.06), { slide: 760 }); break;
      case 'pop': tone(a, t, mtof(76), 0.12, 'sine', v(0.08)); tone(a, t + 0.07, mtof(83), 0.16, 'sine', v(0.07)); break;
    }
  }
  function syncSfxBtn() { const b2 = $('sfxBtn'); b2.textContent = sfxOn ? '🔊' : '🔇'; b2.setAttribute('aria-label', sfxOn ? '효과음 끄기' : '효과음 켜기'); b2.setAttribute('aria-pressed', String(!sfxOn)); }
  $('sfxBtn').addEventListener('click', () => { sfxOn = !sfxOn; store.set('onl-sfx', sfxOn ? '1' : '0'); syncSfxBtn(); if (sfxOn) sfx('pop'); toast(sfxOn ? '효과음을 켰어요' : '효과음을 껐어요'); });
  syncSfxBtn();

  // ================= EQ desk: each touch changes the stage light and plays an instrument through the speakers =================
  const EQ_INST = ['piano', 'elec', 'drum', 'bass', 'synth'];
  let eqStep = 0, eqPulse = -1e9;
  const floaters = [];
  function eqFx(inst, vol) {
    const now = performance.now(); eqPulse = now;
    sfx(inst, vol);
    const L = off('spkL'), Rr = off('spkR'), E = off('eq');
    for (let i = 0; i < 3; i++) {
      notes.push({ x: 74 + L.dx + (Math.random() * 6 - 3), y: 30 + L.dy + i * 6, t0: now + i * 180, sym: pick(['♪', '♫']) });
      notes.push({ x: 118 + Rr.dx + (Math.random() * 6 - 3), y: 30 + Rr.dy + i * 6, t0: now + 90 + i * 180, sym: pick(['♪', '♫']) });
    }
    floaters.push({ x: 143 + E.dx, y: 326 + E.dy, t0: now, text: `${LIGHTS[lightMode].n} · ${INSTRUMENTS[inst]}` });
  }
  function drawEqFx(now) {
    const t = now - eqPulse; if (t > 2600 || sceneId !== 'sanctuary') return;
    const E = off('eq'), col = LIGHTS[lightMode].c ? `rgb(${LIGHTS[lightMode].c})` : '#9aa0ab';
    for (let x = 125; x < 161; x += 4) {
      const h = 1 + Math.round((Math.sin(now / 70 + x * 1.7) * 0.5 + 0.5) * 6 * (1 - t / 2600));
      b.fillStyle = '#121117'; b.fillRect(x + E.dx - 1, 333 + E.dy, 3, 8);
      b.fillStyle = col; b.fillRect(x + E.dx, 340 + E.dy - h, 1, h);
    }
    const flash = Math.floor(now / 120) % 2 ? col : '#f4f1ea';
    for (const [id, x] of [['spkL', 70], ['spkR', 114]]) { const o = off(id); for (let y = 8; y < 50; y += 8) { b.fillStyle = flash; b.globalAlpha = 0.55 * (1 - t / 2600); b.fillRect(x + o.dx + 2, y + o.dy, 4, 2); } }
    b.globalAlpha = 1;
  }

  // ================= 탕비실: coffee machine & water dispenser =================
  const HOLD_MS = 45000;
  function useMachine(kind) {
    if (player.brew) return;
    const t0 = performance.now();
    player.brew = { k: kind, t0 }; player.hold = null; player.dir = 'up';
    sfx(kind === 'coffee' ? 'brew' : 'pour');
    setTimeout(() => {
      if (!player.brew || player.brew.t0 !== t0) return;
      player.brew = null; player.hold = { k: kind, t0: performance.now() }; sfx('pop');
    }, kind === 'coffee' ? 1900 : 1200);
  }
  function drawMachineFx(now) {
    if (sceneId !== 'room2') return;
    for (const c of chars) {
      if (!c.brew) continue;
      const t = now - c.brew.t0, f = Math.floor(now / 110);
      if (c.brew.k === 'coffee') {
        const o = off('r2-counter');
        b.fillStyle = f % 2 ? '#7bd389' : '#2f8a55'; b.fillRect(91 + o.dx, 29 + o.dy, 2, 1);
        b.fillStyle = '#251c2c'; b.fillRect(93 + o.dx, 38 + o.dy, 6, 5); b.fillStyle = '#f4f1ea'; b.fillRect(94 + o.dx, 39 + o.dy, 4, 3); b.fillRect(98 + o.dx, 39 + o.dy, 1, 2);
        const fill = Math.min(2, Math.floor(t / 600)); b.fillStyle = '#6b3a1e'; if (fill) b.fillRect(94 + o.dx, 42 + o.dy - fill, 4, fill);
        b.fillStyle = '#6b3a1e'; b.fillRect(96 + o.dx, 35 + o.dy + (f % 3), 1, 1);
      } else {
        const o = off('r2-water');
        b.fillStyle = '#9ad0f5'; b.fillRect(170 + o.dx, 41 + o.dy, 1, 3 + (f % 2));
        b.fillStyle = '#251c2c'; b.fillRect(168 + o.dx, 43 + o.dy, 5, 5); b.fillStyle = '#dff1fc'; b.fillRect(169 + o.dx, 44 + o.dy, 3, 3);
        const fill = Math.min(3, Math.floor(t / 350)); b.fillStyle = '#5aa9e6'; if (fill) b.fillRect(169 + o.dx, 47 + o.dy - fill, 3, fill);
      }
    }
  }
  // the cup in someone's hand (drawn right after their sprite)
  function drawHeld(c, x, y, now) {
    if (!c.hold || c.dir === 'up') return;
    const t = now - c.hold.t0, sip = t % 6000 > 5300;
    const hx = c.dir === 'left' ? x - 8 : c.dir === 'right' ? x + 5 : x + 4, hy = y - (c.seat ? 6 : 9) - (sip ? 3 : 0);
    b.fillStyle = '#251c2c'; b.fillRect(hx - 1, hy - 1, 5, 5);
    if (c.hold.k === 'coffee') {
      b.fillStyle = '#f4f1ea'; b.fillRect(hx, hy, 3, 3); b.fillStyle = '#6b3a1e'; b.fillRect(hx, hy, 3, 1);
      b.fillStyle = '#251c2c'; b.fillRect(c.dir === 'left' ? hx - 2 : hx + 4, hy + 1, 1, 1);
      if (Math.floor(now / 400) % 3) { b.fillStyle = 'rgba(255,255,255,.75)'; b.fillRect(hx + 1, hy - 3 - (Math.floor(now / 400) % 2), 1, 1); b.fillRect(hx + 2, hy - 5 + (Math.floor(now / 400) % 2), 1, 1); }
    } else {
      b.fillStyle = '#dff1fc'; b.fillRect(hx, hy, 3, 3); b.fillStyle = '#5aa9e6'; b.fillRect(hx, hy + 1, 3, 2);
    }
  }

  // ================= 펀치! =================
  let punchAt = 0;
  function punchTarget() {
    let best = null, bd = 70;
    for (const c of chars) {
      if (c === player || c.dnd) continue;
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function swing(tgt) {
    const now = performance.now();
    if (tgt) faceToward(player, tgt.x, tgt.y);
    player.action = 'punch'; player.actionT0 = now; player.actionUntil = now + 450; player.playing = null;
    if (tgt) { netSend('hit', { id: net.uid, to: tgt.id }); setTimeout(() => takeHit(tgt, player), 140); }
    else sfx('whoosh');
  }
  function doPunch() {
    if (player.dnd) { toast('OFF 모드에서는 펀치를 날릴 수 없어요 🙏'); return; }
    const now = performance.now(); if (now - punchAt < 1100) return; punchAt = now;
    const tgt = punchTarget();
    if (!tgt) {
      if (player.seat) { toast('주먹을 날릴 사람이 근처에 없어요'); return; }
      swing(null); floaters.push({ x: player.x, y: player.y - 30, t0: now, text: '👊', bare: true }); return;
    }
    const seat = player.seat, back = () => { if (seat && !seat.occ) goTo(player, seatApproach(seat), () => sit(player, seat)); };
    if (!seat && Math.hypot(tgt.x - player.x, tgt.y - player.y) < 14) { swing(tgt); return; }
    // stand up, walk over, punch, and go back to the same chair
    const side = player.x < tgt.x ? -9 : 9;
    let spot = { x: tgt.x + side, y: tgt.y };
    if (blocked(spot.x, spot.y)) spot = { x: tgt.x - side, y: tgt.y };
    if (blocked(spot.x, spot.y)) spot = { x: tgt.x, y: tgt.y + 8 };
    goTo(player, spot, () => { swing(tgt); setTimeout(back, 650); }, () => { if (Math.hypot(tgt.x - player.x, tgt.y - player.y) < 20) { swing(tgt); setTimeout(back, 650); } });
  }
  function takeHit(tgt, from) {
    const now = performance.now();
    tgt.hitT0 = now;
    if (tgt.isPlayer && !tgt.seat) {
      // a little knock-back away from whoever threw it
      const dx = tgt.x - from.x, dy = tgt.y - from.y, d = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 6; i++) { const nx = tgt.x + dx / d, ny = tgt.y + dy / d; if (blocked(nx, ny)) break; tgt.x = nx; tgt.y = ny; }
      tgt.path = []; tgt.goal = null;
    }
    if (tgt.scene === sceneId) sfx('punch', tgt.isPlayer || from.isPlayer ? 1 : 0.5);
  }
  function onHit(p) {
    if (!p) return;
    const atk = net.remotes.get(p.id), tgt = p.to === net.uid ? player : net.remotes.get(p.to);
    if (atk) { const now = performance.now(); atk.action = 'punch'; atk.actionT0 = now; atk.actionUntil = now + 450; if (tgt) faceToward(atk, tgt.x, tgt.y); }
    if (tgt) setTimeout(() => takeHit(tgt, atk || tgt), 140);
  }
  function drawFist(c, x, y, now) {
    if (c.action !== 'punch') return;
    const k = clamp((now - c.actionT0) / 450, 0, 1), ext = Math.round(Math.sin(k * Math.PI) * 5);
    let fx, fy = y - 11;
    if (c.dir === 'right') fx = x + 5 + ext; else if (c.dir === 'left') fx = x - 7 - ext; else if (c.dir === 'down') { fx = x + 3; fy = y - 9 + Math.round(ext / 2); } else return;
    b.fillStyle = '#251c2c'; b.fillRect(fx - 1, fy - 1, 4, 4); b.fillStyle = '#f5cda6'; b.fillRect(fx, fy, 2, 2);
  }

  // ================= away / idle (Zz) and leaving properly =================
  const IDLE_MS = 3 * 60 * 1000, PHONE = window.matchMedia('(hover: none)').matches;
  let lastInput = performance.now(), hiddenAway = false, awayTimer = 0, sleptOff = false, exited = false, inLounge = false;
  const touched = () => { lastInput = performance.now(); };
  ['keydown', 'pointerdown', 'wheel'].forEach(ev => window.addEventListener(ev, touched, { passive: true }));
  function updateZz(now) {
    const idleRoom = ['sanctuary', 'hall', 'hall1', 'roof'].includes(sceneId);
    const zz = !player.dnd && (hiddenAway || (idleRoom && now - lastInput > IDLE_MS && !player.playing && !player.brew && !gmActive()));
    if (zz !== !!player.zz) { player.zz = zz; net.dirty = true; net.lastTrack = 0; }
  }
  function pushState() {
    if (!LIVE || !net.ready || !net.ch) return;
    const st = myState(); net.sig = '';
    try { net.ch.send({ type: 'broadcast', event: 'st', payload: st }); net.ch.track(Object.assign({ name: player.name, look: player.look }, st)); } catch (e) {}
  }
  function leaveRealtime() {
    if (!LIVE) return;
    for (const c of [net.ch, net.lobby, net.chatDb]) if (c) { try { c.untrack(); } catch (e) {} try { sb.removeChannel(c); } catch (e) {} }
    net.ch = null; net.lobby = null; net.chatDb = null; net.ready = false;
    for (const id of [...net.remotes.keys()]) removeRemote(id);
    renderPeople();
  }
  document.addEventListener('visibilitychange', () => {
    if (!inLounge || exited) return;
    if (document.hidden) {
      hiddenAway = true; player.zz = true; pushState();
      clearTimeout(awayTimer);
      // a tab left open in the background should not leave a character standing in the lounge
      awayTimer = setTimeout(() => { if (document.hidden && LIVE && net.ch) { if (gmActive() && !gm.practice) gmSend({ t: 'end', id: gm.id, to: gm.oppId, why: 'left' }); leaveRealtime(); sleptOff = true; } }, PHONE ? 45000 : 180000);
    } else {
      hiddenAway = false; touched(); clearTimeout(awayTimer);
      if (sleptOff && LIVE) {
        sleptOff = false;
        if (gmActive() && !gm.practice) gmFinish(3 - gm.me, 'left-me');
        log('', '다시 연결했어요. 잠깐 자리를 비운 사이 라운지에서 나가 있었어요.', 'sys'); connectRealtime();
      }
    }
  });
  window.addEventListener('beforeunload', e => { if (LIVE && inLounge && !exited) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('pagehide', () => { if (!exited) leaveRealtime(); });
  function askExit() {
    const body = $('modalBody'); body.innerHTML = '';
    $('modalTitle').textContent = '라운지 종료';
    body.appendChild(el('p', '', '라운지에서 나갈까요?'));
    body.appendChild(el('p', 'small', gmActive() && !gm.practice ? '지금 두고 있는 오목은 기권 처리돼요. 내 캐릭터도 라운지에서 바로 사라져요.' : '내 캐릭터도 라운지에서 바로 사라져요. 다음에 들어오면 다시 만나요!'));
    const row = el('div', 'btns');
    const yes = el('button', 'btn btn-gold', '종료하기'), no = el('button', 'btn', '계속 있기');
    yes.type = no.type = 'button';
    yes.addEventListener('click', () => doExit()); no.addEventListener('click', closeModal);
    row.append(yes, no); body.appendChild(row);
    $('modal').hidden = false; yes.focus();
  }
  function doExit(why) {
    closeModal();
    if (sceneId === GM_ROOM) gmLeaveRoom();
    leaveRealtime(); exited = true;
    const ps = $('bye').querySelectorAll('p');
    if (why === 'dup') { ps[0].textContent = '다른 창에서 다시 접속했어요'; ps[1].textContent = '같은 계정으로 다른 창이나 기기에서 라운지에 들어와서, 이 창의 접속은 끝냈어요. 이 창에서 계속하려면 아래 버튼을 눌러 주세요.'; $('byeBack').textContent = '이 창에서 접속하기'; }
    $('bye').hidden = false;
  }
  function superseded() { if (!exited) doExit('dup'); }
  $('exitBtn').addEventListener('click', askExit);
  $('byeBack').addEventListener('click', () => location.reload());

  // ================= 엘리베이터 =================
  const LOCKED_MSG = ['🚧 아직 공사 중인 방이에요. 개발자를 재촉해 주세요! 😆', '🔒 문이 잠겨 있어요… 개발자가 새 게임을 만드는 중이래요 🛠️', '🚧 곧 새로운 게임이 들어올 예정! 개발자 어깨를 주물러 주면 빨라질지도? 💆', '☕ 개발자에게 럭킨 生椰拿铁를 사 주면 될지도..?', '📱 지금 당장 개발자에게 톡을 보내 재촉하세요!', '🍲 개발자는 훠궈를 좋아한다던데 (쑥덕쑥덕)...'];
  const OUTSIDE_MSG = ['🚪 바깥 세상은 아직 디자인 중이에요! 개발자에게 빨리 만들라고 재촉해 주세요 😆', '🌳 밖은 아직 공사 중… 개발자를 콕콕 찔러서 업데이트를 받아 내세요 👉', '🚧 문이 꿈쩍도 안 해요. 개발자가 바깥 풍경을 그리는 중이래요 (아마도…)', '☕ 개발자에게 럭킨 生椰拿铁를 사 주면 될지도..?', '📱 지금 당장 개발자에게 톡을 보내 재촉하세요!', '🍲 개발자는 훠궈를 좋아한다던데 (쑥덕쑥덕)...'];
  const FLOORS = [{ f: 3, to: 'roof', name: '3F · 옥상', sub: '하늘과 실시간 베이징 날씨 ☁️' }, { f: 2, to: 'hall', name: '2F · 본당 · 회의실 층', sub: '본당, ROOM 1~4' }, { f: 1, to: 'hall1', name: '1F · 로비', sub: '락커룸 ⚽, 건물 출입문' }];
  function openElevator() {
    const body = $('modalBody'); body.innerHTML = '';
    $('modalTitle').textContent = '엘리베이터';
    body.appendChild(el('p', '', '몇 층으로 갈까요?'));
    const cur = FLOOR_OF(sceneId), list = el('div', 'ev-list');
    for (const fl of FLOORS) {
      const b2 = el('button', 'btn ev-btn' + (fl.f === cur ? ' here' : '')); b2.type = 'button'; b2.disabled = fl.f === cur;
      b2.append(el('b', 'ev-f', String(fl.f)), el('span', 'ev-n', fl.name + (fl.f === cur ? ' (지금 층)' : '')), el('span', 'ev-s', fl.sub));
      b2.addEventListener('click', () => { closeModal(); sfx('ding'); goScene(fl.to, 'elevator'); });
      list.appendChild(b2);
    }
    body.appendChild(list);
    $('modal').hidden = false;
  }

  // ================= 옥상: 오늘의 베이징 날씨 =================
  // Open-Meteo (free, no key). The rooftop sky follows the real weather in Beijing.
  const WX = { ok: false, tried: 0, kind: 'clear', temp: null, hi: null, lo: null, wind: null, isDay: 1, aqi: null, at: 0 };
  const WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=39.9042&longitude=116.4074&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=1';
  const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=39.9042&longitude=116.4074&current=us_aqi&timezone=Asia%2FShanghai';
  async function getJSON(url) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  // our own site asks the weather services (api/weather.js on Vercel), so it works wherever the lounge itself opens;
  // if that is missing, the page tries Open-Meteo directly
  const WMO_KIND = c => c >= 95 ? 'storm' : ((c >= 71 && c <= 77) || c === 85 || c === 86) ? 'snow' : ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) ? 'rain' : (c === 45 || c === 48) ? 'fog' : c === 3 ? 'cloudy' : (c === 1 || c === 2) ? 'partly' : 'clear';
  async function loadWeather(force) {
    const now = Date.now();
    if (!force && now - WX.tried < (WX.ok ? 30 * 60e3 : 2 * 60e3)) return;
    WX.tried = now;
    let d = null;
    try { const r = await getJSON('api/weather'); if (r && r.ok) d = r; } catch (e) {}
    if (!d) try {
      const o = await getJSON(WX_URL), c = o.current || {}, dl = o.daily || {};
      d = { kind: WMO_KIND(+c.weather_code || 0), temp: c.temperature_2m, isDay: c.is_day === 0 ? 0 : 1, wind: c.wind_speed_10m, hi: dl.temperature_2m_max && dl.temperature_2m_max[0], lo: dl.temperature_2m_min && dl.temperature_2m_min[0], aqi: null };
      try { const a = await getJSON(AQ_URL); d.aqi = a.current && a.current.us_aqi != null ? +a.current.us_aqi : null; } catch (e) {}
    } catch (e) {}
    if (!d || d.temp == null) return;
    const before = WX.kind;
    Object.assign(WX, { ok: true, kind: d.kind, temp: d.temp, hi: d.hi, lo: d.lo, isDay: d.isDay, wind: d.wind, aqi: d.aqi, at: now });
    if (before !== WX.kind) wxSeed();
  }
  setInterval(() => { if (sceneId === 'roof') loadWeather(); }, 60e3);
  const wxKind = () => (WX.ok && WX_NAME[WX.kind]) ? WX.kind : 'clear';
  const WX_NAME = { clear: ['☀️', '맑음'], partly: ['🌤️', '구름 조금'], cloudy: ['☁️', '흐림'], fog: ['🌫️', '안개'], rain: ['🌧️', '비'], snow: ['❄️', '눈'], storm: ['⛈️', '천둥번개'] };
  const aqiText = v => v == null ? '정보 없음' : v <= 50 ? `좋음 (${v})` : v <= 100 ? `보통 (${v})` : v <= 150 ? `민감군 나쁨 (${v})` : v <= 200 ? `나쁨 (${v})` : `매우 나쁨 (${v})`;
  let wxDrops = [], wxClouds = [];
  function wxSeed() {
    const k = wxKind(), W2 = SCENES.roof.w, H2 = SCENES.roof.h;
    const n = k === 'rain' || k === 'storm' ? 110 : k === 'snow' ? 80 : 0;
    wxDrops = Array.from({ length: n }, () => ({ x: Math.random() * (W2 + 40) - 20, y: Math.random() * H2, v: 0.6 + Math.random() * 0.6, ph: Math.random() * 6 }));
    const nc = k === 'clear' ? 1 : k === 'partly' ? 3 : 5;
    wxClouds = Array.from({ length: nc }, (_, i) => ({ x: Math.random() * W2, y: 4 + Math.random() * 16, w: 16 + Math.random() * 18, v: 1.5 + Math.random() * 2 }));
  }
  wxSeed();
  function drawSky(now) {
    const k = wxKind(), night = WX.ok && !WX.isDay;
    const top = night ? '#141a36' : { clear: '#5fb4ec', partly: '#79bde8', cloudy: '#9aa6b3', fog: '#b9bfc6', rain: '#7c8796', snow: '#c9d2dc', storm: '#56606f' }[k];
    const bot = night ? '#2c3460' : { clear: '#bfe4fb', partly: '#c7e3f5', cloudy: '#c3cad2', fog: '#d6d9dd', rain: '#a3acb8', snow: '#e4e9ee', storm: '#7a8392' }[k];
    const gr = b.createLinearGradient(0, 0, 0, 44); gr.addColorStop(0, top); gr.addColorStop(1, bot); b.fillStyle = gr; b.fillRect(0, 0, W, 44);
    if (night) { b.fillStyle = '#f4f1ea'; for (let i = 0; i < 26; i++) { const x = (i * 53) % W, y = (i * 29) % 30 + 2; if ((Math.floor(now / 600) + i) % 7) b.fillRect(x, y, 1, 1); } pixCircle(b, 164, 9, 4, '#f4ecc4'); pixCircle(b, 166, 8, 3, top); }
    else if (k === 'clear' || k === 'partly') { pixCircle(b, 164, 10, 6, '#fff3b0'); pixCircle(b, 164, 10, 4, '#ffd65a'); }
    const cc = k === 'storm' ? '#5a6370' : k === 'rain' ? '#8e98a6' : night ? '#3a426a' : '#f4f6f8';
    for (const c of wxClouds) {
      const x = ((c.x + now / 1000 * c.v) % (W + 40)) - 20;
      b.fillStyle = cc; b.fillRect(x, c.y + 3, c.w, 4); b.fillRect(x + 3, c.y + 1, c.w * 0.5, 3); b.fillRect(x + c.w * 0.45, c.y, c.w * 0.35, 4);
    }
  }
  function drawWeatherFx(now) {
    const k = wxKind(), night = WX.ok && !WX.isDay;
    if (k === 'rain' || k === 'storm') {
      b.fillStyle = 'rgba(190,215,240,.75)';
      for (const d of wxDrops) { const y = (d.y + now / 1000 * 170 * d.v) % H, x = (d.x - (y * 0.25)) % (W + 20); b.fillRect(x, y, 1, 4); if (y > 52 && ((now / 90 + d.ph) | 0) % 9 === 0) b.fillRect(x - 1, y + 4, 3, 1); }
      b.fillStyle = 'rgba(40,50,70,.18)'; b.fillRect(0, 0, W, H);
      if (k === 'storm' && Math.floor(now / 100) % 61 === 0) { b.fillStyle = 'rgba(255,255,255,.45)'; b.fillRect(0, 0, W, H); }
    } else if (k === 'snow') {
      b.fillStyle = '#ffffff';
      for (const d of wxDrops) { const y = (d.y + now / 1000 * 22 * d.v) % H, x = (d.x + Math.sin(now / 900 + d.ph) * 4 + W) % W; b.fillRect(x, y, d.v > 0.9 ? 2 : 1, d.v > 0.9 ? 2 : 1); }
      b.fillStyle = 'rgba(220,230,245,.12)'; b.fillRect(0, 0, W, H);
    } else if (k === 'fog' || (WX.aqi != null && WX.aqi > 150)) { b.fillStyle = k === 'fog' ? 'rgba(220,224,230,.35)' : 'rgba(200,190,150,.22)'; b.fillRect(0, 0, W, H); }
    else if (k === 'cloudy') { b.fillStyle = 'rgba(80,90,110,.12)'; b.fillRect(0, 0, W, H); }
    else if (!night) { const gl = b.createRadialGradient(164, 10, 4, 164, 10, 160); gl.addColorStop(0, 'rgba(255,230,150,.22)'); gl.addColorStop(1, 'rgba(255,230,150,0)'); b.fillStyle = gl; b.fillRect(0, 0, W, H); }
    if (night) {
      b.fillStyle = 'rgba(16,20,48,.38)'; b.fillRect(0, 0, W, H);
      for (let x = 30; x < 166; x += 9) { const y = 60 + Math.round(Math.sin((x - 30) / 136 * Math.PI) * 6); const gl = b.createRadialGradient(x + 1, y + 2, 0, x + 1, y + 2, 9); gl.addColorStop(0, 'rgba(255,214,90,.55)'); gl.addColorStop(1, 'rgba(255,214,90,0)'); b.fillStyle = gl; b.fillRect(x - 9, y - 7, 20, 20); }
    }
  }
  // the rooftop board just shows a picture: sun, cloud, raindrops, snowflake, lightning, fog, moon
  function drawWeatherBoard(now) {
    const o = off('rf-sign'), x0 = 151 + o.dx, y0 = 100 + o.dy, k = wxKind(), night = WX.ok && !WX.isDay, f = Math.floor(now / 300) % 2;
    P(b, x0, y0, 24, 15, '#f4f1ea');
    const cloud = (cx, cy, col) => { P(b, cx - 5, cy, 11, 3, col); P(b, cx - 3, cy - 2, 5, 2, col); P(b, cx + 1, cy - 3, 3, 3, col); P(b, cx - 6, cy + 1, 1, 1, col); };
    const cx = x0 + 7, cy = y0 + 6;
    if (!WX.ok) { cloud(cx, cy, '#c6c9cf'); P(b, cx - 1, cy + 4, 2, 2, '#8d8f99'); return; }
    if (k === 'clear' || k === 'partly') {
      if (night) { pixCircle(b, cx, cy, 3, '#f4ecc4'); pixCircle(b, cx + 2, cy - 1, 2, '#f4f1ea'); }
      else { pixCircle(b, cx, cy, 3, '#ffd65a'); for (const [dx, dy] of [[0, -5], [0, 5], [-5, 0], [5, 0], [-4, -4], [4, 4], [-4, 4], [4, -4]]) P(b, cx + dx, cy + dy, 1, 1, f ? '#f0a83a' : '#ffd65a'); }
      if (k === 'partly') cloud(cx + 3, cy + 3, '#ffffff'), P(b, cx - 2, cy + 6, 11, 1, '#c6c9cf');
    } else if (k === 'cloudy') { cloud(cx - 1, cy - 1, '#c6c9cf'); cloud(cx + 2, cy + 2, '#8d8f99'); }
    else if (k === 'fog') { for (let i = 0; i < 4; i++) P(b, cx - 6 + (i % 2) * 2, cy - 3 + i * 2, 11, 1, '#8d8f99'); }
    else {
      cloud(cx, cy - 2, k === 'storm' ? '#5a6370' : '#8d8f99');
      if (k === 'rain') for (let i = 0; i < 3; i++) P(b, cx - 4 + i * 4, cy + 3 + ((f + i) % 2) * 2, 1, 2, '#3f8fd8');
      if (k === 'snow') for (let i = 0; i < 3; i++) { const sx = cx - 4 + i * 4, sy = cy + 3 + ((f + i) % 2) * 2; P(b, sx, sy, 1, 1, '#9fc6ff'); P(b, sx - 1, sy, 3, 1, '#9fc6ff'); P(b, sx, sy - 1, 1, 3, '#9fc6ff'); }
      if (k === 'storm') { P(b, cx, cy + 2, 2, 2, '#ffd65a'); P(b, cx - 1, cy + 4, 2, 2, '#ffd65a'); P(b, cx, cy + 6, 1, 1, '#ffd65a'); for (let i = 0; i < 2; i++) P(b, cx - 5 + i * 9, cy + 3 + f * 2, 1, 2, '#3f8fd8'); }
    }
  }
  function openWeather() {
    loadWeather();
    if (!WX.ok) { toast('☁️ 날씨를 불러오는 중이에요. 잠시 후 다시 눌러 주세요'); return; }
    const [ic, nm] = WX_NAME[wxKind()];
    toast(`${ic} 오늘 베이징: ${nm} · 지금 ${Math.round(WX.temp)}°C${WX.hi != null ? ` (최고 ${Math.round(WX.hi)}° / 최저 ${Math.round(WX.lo)}°)` : ''}`);
  }

  // ================= 1층 락커룸: 축구 파티 =================
  // The party lives on the host's page; the host shares it on the room channel ('pty') and everyone else asks the host.
  let party = null, partyAt = 0;
  const FB_MODES = [3, 4, 5];
  const inParty = () => !!(party && net.uid && party.members[net.uid]);
  const isPartyHost = () => !!(party && party.host === net.uid);
  function ptySend(p) { netSend('pty', Object.assign({ from: net.uid }, p)); }
  function teamCount(pt, team) { return Object.values(pt.members).filter(m => m.team === team).length; }
  function freeSlot(pt, team) { const used = new Set(Object.values(pt.members).filter(m => m.team === team).map(m => m.slot)); for (let i = 0; i < pt.mode; i++) if (!used.has(i)) return i; return -1; }
  function hostShare() { if (isPartyHost()) { party.v = (party.v || 0) + 1; ptySend({ t: 'state', party }); applyParty(); } }
  function hostJoin(uid, name, team) {
    if (!party || !['w', 'b'].includes(team)) return;
    const cur = party.members[uid];
    if (cur && cur.team === team) return;
    const slot = freeSlot(party, team); if (slot < 0) return;
    party.members[uid] = { name: String(name || '…').slice(0, 8), team, slot, ready: false };
    hostShare();
  }
  function hostLeave(uid) { if (party && party.members[uid]) { delete party.members[uid]; hostShare(); } }
  function createParty(mode, team) {
    party = { id: gmNewId(), host: net.uid || 'me', hostName: gmClip(player.name), mode, members: {}, v: 0 };
    hostJoin(net.uid || 'me', player.name, team);
    log('', `⚽ ${gmClip(player.name)}님이 ${mode} 대 ${mode} 축구 파티를 만들었어요!`, 'sys game');
    ptySend({ t: 'notice', text: `⚽ ${gmClip(player.name)}님이 ${mode} 대 ${mode} 축구 파티를 만들었어요!` });
  }
  function joinParty(team) { if (!party) return; if (isPartyHost()) hostJoin(net.uid, player.name, team); else ptySend({ t: 'join', pid: party.id, team, name: gmClip(player.name) }); }
  function leaveParty(silent) {
    if (!party) return;
    if (isPartyHost()) { ptySend({ t: 'close', pid: party.id, why: 'host' }); party = null; }
    else if (inParty()) { ptySend({ t: 'leave', pid: party.id }); delete party.members[net.uid]; }
    player.tie = 0; if (player.seat && player.seat.team) standUp(player);
    applyParty(); if (!silent) toast('파티에서 나왔어요');
  }
  function setReady(r) { if (!inParty()) return; if (isPartyHost()) { party.members[net.uid].ready = r; hostShare(); } else { ptySend({ t: 'ready', pid: party.id, ready: r }); party.members[net.uid].ready = r; applyParty(); } }
  // the demo (one person) can try a practice match on its own
  function canStart() { return !!(party && isPartyHost() && Object.values(party.members).every(m => m.ready) && (LIVE ? teamCount(party, 'w') >= 1 && teamCount(party, 'b') >= 1 : true)); }
  function startMatch() {
    if (!canStart()) return;
    const teams = {}, names = {};
    for (const [uid, m] of Object.entries(party.members)) { teams[uid] = m.team; names[uid] = m.name; }
    const mt = { id: gmNewId(), host: net.uid, mode: party.mode, teams, names, dur: (window.__onl && window.__onl.fbDur) || 180 };
    ptySend({ t: 'start', pid: party.id, match: mt });
    party = null; enterMatch(mt);
  }
  // bring my character in line with the party: sit on my bench, head down (tying boots) until ready
  function applyParty() {
    if (sceneId !== 'f1r1') return;
    const me = party && net.uid && party.members[net.uid];
    if (me) {
      const seat = lockerSeats.filter(c => c.team === me.team)[me.slot];
      if (seat && player.seat !== seat && (!seat.occ || seat.occ === player)) { if (player.seat) standUp(player); sit(player, seat); }
      player.tie = me.ready ? 2 : 1;
    } else player.tie = 0;
    net.dirty = true; net.lastTrack = 0;
    fbLabel();
    if (partyOpen()) openParty(true);
  }
  function onPty(p) {
    if (!p || p.from === net.uid || sceneId !== 'f1r1') return;
    if (p.t === 'notice') { log('', p.text, 'sys game'); return; }
    if (p.t === 'hello') { if (isPartyHost()) hostShare(); return; }
    if (p.t === 'state') {
      if (party && isPartyHost() && p.party.id !== party.id) return;   // two hosts at once: keep mine
      party = p.party; partyAt = performance.now(); applyParty(); return;
    }
    if (p.t === 'close') { if (party && party.id === p.pid) { const was = inParty(); party = null; applyParty(); if (was) toast('방장이 나가서 파티가 해산됐어요'); } return; }
    if (p.t === 'start') {
      if (party && party.id === p.pid) { const mine = p.match && p.match.teams && p.match.teams[net.uid]; party = null; if (mine) enterMatch(p.match); else applyParty(); }
      return;
    }
    if (!isPartyHost() || !party || p.pid !== party.id) return;
    if (p.t === 'join') hostJoin(p.from, p.name, p.team);
    else if (p.t === 'leave') hostLeave(p.from);
    else if (p.t === 'ready' && party.members[p.from]) { party.members[p.from].ready = !!p.ready; hostShare(); }
  }
  // a member who leaves the room or disconnects drops out; if the host goes, the party is over
  function partyPeerGone(id) {
    if (!party) return;
    if (party.host === id) { const was = inParty(); party = null; applyParty(); if (was) toast('방장이 나가서 파티가 해산됐어요'); }
    else if (isPartyHost()) hostLeave(id);
  }
  setInterval(() => {
    if (sceneId !== 'f1r1') return;
    if (isPartyHost()) ptySend({ t: 'state', party });
    else if (party && performance.now() - partyAt > 9000) { const was = inParty(); party = null; applyParty(); if (was) toast('파티 연결이 끊겨서 나왔어요'); }
  }, 3000);
  function fbLabel() {
    const btn = $('fbBtn'); btn.hidden = sceneId !== 'f1r1';
    btn.textContent = inParty() ? (isPartyHost() && canStart() ? '⚽ 경기 시작!' : '⚽ 파티') : party ? '⚽ 파티 참가' : '⚽ 축구';
    btn.classList.toggle('ping', !!(isPartyHost() && canStart()));
  }
  function openParty(refresh) {
    if (sceneId !== 'f1r1') return;
    const body = $('modalBody'); body.innerHTML = '';
    $('modalTitle').textContent = '⚽ 축구 파티';
    if (!party) {
      body.appendChild(el('p', '', '아직 파티가 없어요. 파티를 만들고 팀을 골라 벤치에 앉으면 다른 사람들이 참가할 수 있어요.'));
      let mode = +(store.get('onl-fb-mode') || 3); if (!FB_MODES.includes(mode)) mode = 3;
      const row = el('div', 'gm-opt'); row.appendChild(el('span', 'gm-opt-l', '인원'));
      for (const m of FB_MODES) { const c = el('button', 'btn gm-chip', `${m} : ${m}`); c.type = 'button'; c.setAttribute('aria-pressed', String(m === mode)); c.addEventListener('click', () => { store.set('onl-fb-mode', String(m)); openParty(true); }); row.appendChild(c); }
      body.appendChild(row);
      const btns = el('div', 'fb-btns');
      const w = el('button', 'btn fb-w', '⚪ 흰 팀으로 만들기'), bk = el('button', 'btn fb-b', '⚫ 검정 팀으로 만들기'); w.type = bk.type = 'button';
      w.addEventListener('click', () => { createParty(mode, 'w'); openParty(true); }); bk.addEventListener('click', () => { createParty(mode, 'b'); openParty(true); });
      btns.append(w, bk); body.appendChild(btns);
      body.appendChild(el('p', 'small', '팀마다 최소 1명씩 있고 모두 레디하면 방장이 경기를 시작할 수 있어요. 경기는 3분이에요.'));
    } else {
      body.appendChild(el('p', 'small', `방장 ${party.hostName} · ${party.mode} 대 ${party.mode}`));
      const cols = el('div', 'fb-cols');
      for (const [team, title] of [['w', '⚪ 흰 팀'], ['b', '⚫ 검정 팀']]) {
        const col = el('div', 'fb-col fb-col-' + team); col.appendChild(el('b', '', `${title} (${teamCount(party, team)}/${party.mode})`));
        const ms = Object.entries(party.members).filter(([, m]) => m.team === team).sort((a, z) => a[1].slot - z[1].slot);
        for (let i = 0; i < party.mode; i++) {
          const m = ms[i];
          col.appendChild(el('span', 'fb-slot' + (m ? '' : ' empty'), m ? `${m[1].ready ? '✅' : '👟'} ${m[1].name}${m[0] === party.host ? ' 👑' : ''}` : '빈 자리'));
        }
        const mine = inParty() && party.members[net.uid].team === team;
        if (!mine) { const jb = el('button', 'btn', inParty() ? '이 팀으로 바꾸기' : '이 팀으로 참가'); jb.type = 'button'; jb.disabled = teamCount(party, team) >= party.mode || (inParty() && party.members[net.uid].ready); jb.addEventListener('click', () => joinParty(team)); col.appendChild(jb); }
        cols.appendChild(col);
      }
      body.appendChild(cols);
      const btns = el('div', 'fb-btns');
      if (inParty()) {
        const me = party.members[net.uid];
        const rd = el('button', 'btn' + (me.ready ? '' : ' btn-gold'), me.ready ? '레디 취소' : '레디!'); rd.type = 'button'; rd.addEventListener('click', () => setReady(!me.ready)); btns.appendChild(rd);
        if (isPartyHost()) { const st = el('button', 'btn btn-gold', '경기 시작'); st.type = 'button'; st.disabled = !canStart(); st.addEventListener('click', startMatch); btns.appendChild(st); }
        const lv = el('button', 'btn', isPartyHost() ? '파티 해산' : '파티 나가기'); lv.type = 'button'; lv.addEventListener('click', () => { leaveParty(); openParty(true); }); btns.appendChild(lv);
      }
      body.appendChild(btns);
      body.appendChild(el('p', 'small', inParty() ? (isPartyHost() ? (canStart() ? '모두 준비됐어요! 경기를 시작하세요.' : '팀마다 1명 이상, 모두 레디하면 시작할 수 있어요.') : '레디를 누르면 신발끈을 다 묶고 고개를 들어요. 방장이 시작하면 바로 축구장으로 가요.') : '팀을 고르면 그 팀 벤치에 앉아요.'));
    }
    $('modal').hidden = false;
    if (!refresh) $('modalClose').focus();
  }
  const partyOpen = () => !$('modal').hidden && $('modalTitle').textContent === '⚽ 축구 파티';

  // ================= 축구장: 경기 =================
  // The match host (lowest id among players still on the pitch) moves the ball and keeps score/time;
  // everyone else draws the ball from the host's updates ('fb' on the match channel) and asks the host to kick.
  let match = null, ball = null, fbLastSend = 0, fbSyncAt = 0;
  const KICK_R = 13, KICK_POW = 175, DRIB_R = 6;
  const matchHost = () => {
    if (!match) return null;
    const here = Object.keys(match.teams).filter(id => id === net.uid || net.remotes.has(id)).sort();
    return here[0] || null;
  };
  const amMatchHost = () => !!(match && net.uid && matchHost() === net.uid);
  const teamOf = id => match && match.teams[id];
  function formation(team, idx) {
    // own half, first player near the centre circle
    const side = team === 'w' ? -1 : 1, spots2 = [[30, 0], [58, -42], [58, 42], [92, 0], [40, -72]], [dx, dy] = spots2[idx % spots2.length];
    return { x: FIELD.w / 2 + side * dx, y: (FIELD.y0 + FIELD.y1) / 2 + dy, dir: team === 'w' ? 'right' : 'left' };
  }
  function myIndex() { const ids = Object.keys(match.teams).filter(id => match.teams[id] === teamOf(net.uid)).sort(); return Math.max(0, ids.indexOf(net.uid)); }
  function toKickoffSpot() {
    if (!match) return;
    const f = formation(teamOf(net.uid), myIndex());
    player.x = clamp(f.x, 20, 300); player.y = f.y; player.dir = f.dir; player.path = []; player.goal = null;
  }
  function enterMatch(mt) {
    match = Object.assign({}, mt, { score: { w: 0, b: 0 }, rem: mt.dur || 180, phase: 'kickoff', phaseAt: performance.now(), startedAt: performance.now(), final: null });
    ball = { x: FIELD.w / 2, y: (FIELD.y0 + FIELD.y1) / 2, vx: 0, vy: 0, tx: null, ty: null };
    player.tie = 0;
    goScene('soccer', teamOf(net.uid) || 'w');
  }
  function onSoccerEnter() {
    if (!match) { setTimeout(() => goScene('f1r1', 'field'), 50); return; }
    toKickoffSpot();
    log('', `⚽ 킥오프! ${match.mode} 대 ${match.mode}, 3분 경기예요. 공 가까이에서 Space(또는 ⚽ 버튼)로 차요.`, 'sys game');
    match.phase = 'kickoff'; match.phaseAt = performance.now();
    sfx('whistle');
  }
  function leaveMatch(ask) {
    if (!match) { goScene('f1r1', 'field'); return; }
    if (ask && !match.final) {
      const body = $('modalBody'); body.innerHTML = '';
      $('modalTitle').textContent = '경기에서 나가기';
      body.appendChild(el('p', '', '경기 중이에요. 락커룸으로 돌아갈까요? 내 팀은 한 명 적게 뛰게 돼요.'));
      const row = el('div', 'btns'), y = el('button', 'btn btn-gold', '나가기'), n = el('button', 'btn', '계속 뛰기'); y.type = n.type = 'button';
      y.addEventListener('click', () => { closeModal(); match = null; ball = null; goScene('f1r1', 'field'); }); n.addEventListener('click', closeModal);
      row.append(y, n); body.appendChild(row); $('modal').hidden = false; return;
    }
    match = null; ball = null; goScene('f1r1', 'field');
  }
  function fbSend(p) { netSend('fb', Object.assign({ from: net.uid }, p)); }
  function kick() {
    if (!match || !ball || match.final) return;
    const dx0 = ball.x - player.x, dy0 = ball.y - (player.y - 2), d = Math.hypot(dx0, dy0);
    let ux, uy;
    if (keys.size && (player.moving)) { const kx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0), ky = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0), kl = Math.hypot(kx, ky); if (kl) { ux = kx / kl; uy = ky / kl; } }
    if (ux == null) { if (d > 1) { ux = dx0 / d; uy = dy0 / d; } else { const f = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[player.dir]; ux = f[0]; uy = f[1]; } }
    player.action = 'jump'; player.actionT0 = performance.now(); player.actionUntil = player.actionT0 + 250;
    if (d > KICK_R) { sfx('whoosh', 0.5); return; }
    sfx('kick');
    applyKick(ux, uy, KICK_POW);   // predict locally, the host has the final say
    if (!amMatchHost()) fbSend({ t: 'kick', ux, uy, pw: KICK_POW, px: player.x, py: player.y });
  }
  function applyKick(ux, uy, pw) { if (!ball) return; ball.vx = ux * pw; ball.vy = uy * pw; ball.tx = null; }
  // ---- host simulation ----
  function hostStep(dt, now) {
    const m = match, bl = ball;
    if (m.final) return;
    if (m.phase === 'goal') { if (now - m.phaseAt > 2600) { m.phase = 'kickoff'; m.phaseAt = now; bl.x = FIELD.w / 2; bl.y = (FIELD.y0 + FIELD.y1) / 2; bl.vx = bl.vy = 0; fbSend({ t: 'reset' }); toKickoffSpot(); } }
    if (m.phase === 'kickoff' && now - m.phaseAt > 1200) m.phase = 'play';
    if (m.phase === 'play') {
      m.rem = Math.max(0, m.rem - dt);
      // dribbling: anyone who runs into the ball pushes it
      for (const c of chars) {
        if (!teamOf(c.isPlayer ? net.uid : c.id)) continue;
        const dx = bl.x - c.x, dy = bl.y - (c.y - 1), d = Math.hypot(dx, dy);
        if (d < DRIB_R && d > 0.01) { const sp = Math.max(Math.hypot(bl.vx, bl.vy), 62); bl.vx = dx / d * sp; bl.vy = dy / d * sp; bl.x = c.x + dx / d * DRIB_R; bl.y = c.y - 1 + dy / d * DRIB_R; }
      }
      bl.x += bl.vx * dt; bl.y += bl.vy * dt;
      const fr = Math.exp(-1.5 * dt); bl.vx *= fr; bl.vy *= fr; if (Math.hypot(bl.vx, bl.vy) < 3) bl.vx = bl.vy = 0;
      const inMouth = bl.y > FIELD.gy0 + 2 && bl.y < FIELD.gy1 - 2;
      if (bl.x < FIELD.x0 + 2) { if (inMouth) return goal('b'); bl.x = FIELD.x0 + 2; bl.vx = Math.abs(bl.vx) * 0.6; }
      if (bl.x > FIELD.x1 - 2) { if (inMouth) return goal('w'); bl.x = FIELD.x1 - 2; bl.vx = -Math.abs(bl.vx) * 0.6; }
      if (bl.y < FIELD.y0 + 2) { bl.y = FIELD.y0 + 2; bl.vy = Math.abs(bl.vy) * 0.6; }
      if (bl.y > FIELD.y1 - 2) { bl.y = FIELD.y1 - 2; bl.vy = -Math.abs(bl.vy) * 0.6; }
      if (m.rem <= 0) return endMatch('time');
    }
    if (now - fbLastSend > 90) { fbLastSend = now; fbSend({ t: 'ball', x: +bl.x.toFixed(1), y: +bl.y.toFixed(1), vx: +bl.vx.toFixed(1), vy: +bl.vy.toFixed(1), sw: m.score.w, sb: m.score.b, rem: Math.ceil(m.rem), ph: m.phase }); }
  }
  function goal(team) {
    const m = match; m.score[team]++; m.phase = 'goal'; m.phaseAt = performance.now(); m.lastGoal = team;
    ball.vx = ball.vy = 0;
    fbSend({ t: 'goal', team, sw: m.score.w, sb: m.score.b });
    sfx('goal');
  }
  function endMatch(why) {
    const m = match; if (!m || m.final) return;
    m.final = { sw: m.score.w, sb: m.score.b, why, at: performance.now() };
    fbSend({ t: 'end', sw: m.score.w, sb: m.score.b, why });
    finishMatchUI();
  }
  function finishMatchUI() {
    const m = match; sfx('whistle');
    const { sw, sb } = m.final, mine = teamOf(net.uid);
    const res = sw === sb ? '무승부' : (sw > sb ? 'w' : 'b') === mine ? '승리! 🎉' : '패배 😢';
    log('', `🏁 경기 끝! ⚪ 흰 팀 ${sw} : ${sb} 검정 팀 ⚫ · ${res}`, 'sys game');
    setTimeout(() => { if (match === m) { match = null; ball = null; if (sceneId === 'soccer') goScene('f1r1', 'field'); } }, 6000);
  }
  function onFb(p) {
    if (!p || !match || sceneId !== 'soccer' || p.from === net.uid) return;
    const now = performance.now();
    if (p.t === 'kick') {
      if (!amMatchHost() || !teamOf(p.from) || match.phase === 'goal' || match.final) return;
      const d = Math.hypot(ball.x - p.px, ball.y - (p.py - 2));
      if (d <= KICK_R + 8) { const l = Math.hypot(p.ux, p.uy) || 1; applyKick(p.ux / l, p.uy / l, clamp(+p.pw || KICK_POW, 0, 220)); if (match.phase === 'kickoff') match.phase = 'play'; }
      return;
    }
    if (amMatchHost()) return;   // only follow the host
    if (p.t === 'ball') {
      fbSyncAt = now; ball.tx = p.x; ball.ty = p.y; ball.vx = p.vx; ball.vy = p.vy;
      match.score.w = p.sw; match.score.b = p.sb; match.rem = p.rem; if (p.ph && match.phase !== 'goal') match.phase = p.ph;
    } else if (p.t === 'goal') { match.score.w = p.sw; match.score.b = p.sb; match.phase = 'goal'; match.phaseAt = now; match.lastGoal = p.team; sfx('goal'); }
    else if (p.t === 'reset') { match.phase = 'kickoff'; match.phaseAt = now; ball.x = FIELD.w / 2; ball.y = (FIELD.y0 + FIELD.y1) / 2; ball.vx = ball.vy = 0; ball.tx = null; toKickoffSpot(); }
    else if (p.t === 'end') { match.score.w = p.sw; match.score.b = p.sb; if (!match.final) { match.final = { sw: p.sw, sb: p.sb, why: p.why, at: now }; finishMatchUI(); } }
  }
  function soccerUpdate(dt, now) {
    if (sceneId !== 'soccer' || !match || !ball) return;
    if (amMatchHost()) hostStep(dt, now);
    else {
      // follow the host's ball smoothly, moving it on with its speed between updates
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; const fr = Math.exp(-1.5 * dt); ball.vx *= fr; ball.vy *= fr;
      if (ball.tx != null) { ball.x += (ball.tx + ball.vx * 0.05 - ball.x) * Math.min(1, dt * 10); ball.y += (ball.ty + ball.vy * 0.05 - ball.y) * Math.min(1, dt * 10); ball.tx += ball.vx * dt; ball.ty += ball.vy * dt; }
      if (match.phase === 'play' && !match.final) match.rem = Math.max(0, match.rem - dt);
    }
    // a team with nobody left: the host ends the game (after a short grace at the start)
    if (LIVE && amMatchHost() && !match.final && now - match.startedAt > 8000) {
      const here = Object.keys(match.teams).filter(id => id === net.uid || net.remotes.has(id));
      const w = here.filter(id => match.teams[id] === 'w').length, bk = here.filter(id => match.teams[id] === 'b').length;
      if (!w || !bk) endMatch('left');
    }
  }
  function drawBall(now) {
    if (!ball) return;
    const x = Math.round(ball.x), y = Math.round(ball.y), sp = Math.hypot(ball.vx, ball.vy), spin = Math.floor(now / Math.max(40, 400 - sp * 2)) % 2;
    b.fillStyle = 'rgba(20,40,20,.3)'; b.fillRect(x - 2, y + 1, 5, 2);
    pixCircle(b, x, y - 1, 3, '#2b2233'); pixCircle(b, x, y - 1, 2, '#f4f1ea'); P(b, x - (spin ? 1 : 0), y - (spin ? 2 : 1), 1, 1, '#2b2233');
  }
  function drawSoccerHud(ctx, fs, fam) {
    if (!match) return;
    const m = match, t = Math.max(0, Math.ceil(m.rem)), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    const txt = `⚪ ${m.score.w}  :  ${m.score.b} ⚫   ${mm}:${ss}`;
    ctx.font = `800 ${fs * 1.15}px ${fam}`;
    const tw = ctx.measureText(txt).width + 20, th = fs * 2;
    ctx.fillStyle = 'rgba(37,28,44,.85)'; rrect(ctx, cw / 2 - tw / 2, 8, tw, th, 8); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillText(txt, cw / 2, 8 + th / 2 + 1);
    const now = performance.now();
    if (m.phase === 'goal' && now - m.phaseAt < 2500) {
      const k = (now - m.phaseAt) / 2500;
      ctx.font = `900 ${fs * 3}px ${fam}`; ctx.lineWidth = 6; ctx.strokeStyle = '#251c2c'; ctx.fillStyle = '#ffd65a';
      const y = ch * 0.42 - Math.sin(k * Math.PI) * 6;
      ctx.strokeText('GOAL!', cw / 2, y); ctx.fillText('GOAL!', cw / 2, y);
      ctx.font = `800 ${fs * 1.2}px ${fam}`; ctx.lineWidth = 4; const s2 = m.lastGoal === 'w' ? '⚪ 흰 팀 득점!' : '⚫ 검정 팀 득점!';
      ctx.strokeText(s2, cw / 2, y + fs * 2.4); ctx.fillStyle = '#ffffff'; ctx.fillText(s2, cw / 2, y + fs * 2.4);
    }
    if (m.phase === 'kickoff' && !m.final && now - m.phaseAt < 1400) { ctx.font = `800 ${fs * 1.6}px ${fam}`; ctx.lineWidth = 5; ctx.strokeStyle = '#251c2c'; ctx.fillStyle = '#ffffff'; ctx.strokeText('킥오프!', cw / 2, ch * 0.3); ctx.fillText('킥오프!', cw / 2, ch * 0.3); }
    if (m.final) {
      const { sw, sb } = m.final, mine = teamOf(net.uid), res = sw === sb ? '무승부!' : (sw > sb ? 'w' : 'b') === mine ? '승리! 🎉' : '패배…';
      ctx.fillStyle = 'rgba(20,16,28,.55)'; ctx.fillRect(0, 0, cw, ch);
      ctx.font = `900 ${fs * 2.6}px ${fam}`; ctx.lineWidth = 6; ctx.strokeStyle = '#251c2c'; ctx.fillStyle = '#ffd65a'; ctx.strokeText(res, cw / 2, ch * 0.4); ctx.fillText(res, cw / 2, ch * 0.4);
      ctx.font = `800 ${fs * 1.3}px ${fam}`; ctx.fillStyle = '#ffffff'; ctx.fillText(`⚪ ${sw} : ${sb} ⚫`, cw / 2, ch * 0.4 + fs * 2.6);
      ctx.font = `600 ${fs}px ${fam}`; ctx.fillText('잠시 후 락커룸으로 돌아가요', cw / 2, ch * 0.4 + fs * 4.4);
    }
  }
  // team kit on the pitch: white or black shirts and shorts
  const KIT = { w: { top: 'tee', topColor: '#f3f0e9', bottom: 'shorts', bottomColor: '#f3f0e9' }, b: { top: 'tee', topColor: '#26242b', bottom: 'shorts', bottomColor: '#26242b' } };
  function kitLook(c) { if (sceneId !== 'soccer' || !match) return c.look; const t = teamOf(c.isPlayer ? net.uid : c.id); return t ? Object.assign({}, c.look, KIT[t]) : c.look; }

  // ================= moving between scenes (본당 <-> 복도 <-> ROOM 1-4) =================
  let switching = false;
  function goScene(id, spawnKey) {
    if (switching || !SCENES[id] || id === sceneId) return;
    if (gmActive() && !gm.practice) { toast('오목 중에는 방을 나갈 수 없어요. 게임을 끝내거나 기권해 주세요.'); gmOpen(); return; }
    switching = true;
    if (sceneId === GM_ROOM) gmLeaveRoom();
    if (sceneId === 'f1r1' && party) leaveParty(true);
    player.tie = 0;
    const fade = $('fade'); fade.classList.add('on');
    setTimeout(() => {
      standUp(player);
      player.path = []; player.goal = null; player.onArrive = null; player.playing = null; player.action = player.dnd ? 'pray' : null;
      if (editMode) stopEdit();
      closeModal(); closeQr();
      sceneId = id; scene = SCENES[id]; player.scene = id;
      loadSceneArt(); refreshChars(); applyLayout();
      const sp = scene.spawns[spawnKey] || Object.values(scene.spawns)[0];
      player.x = sp[0]; player.y = sp[1]; player.dir = sp[2];
      camInit = false; resize();
      $('sceneTag').textContent = scene.name; gmLabel(); fbLabel();
      logEl.innerHTML = '';
      log('', id === 'hall' || id === 'hall1' ? `${scene.name}로 나왔어요. 방에 들어가면 그 방 사람들끼리만 대화해요.` : id === 'roof' ? '옥상에 올라왔어요! 하늘은 지금 베이징 날씨를 따라가요. 날씨판을 눌러 보세요.' : id === 'f1r1' ? '락커룸이에요. 축구장 문이나 벤치를 누르면 축구 파티를 만들거나 참가할 수 있어요.' : id === 'soccer' ? '축구장에 들어왔어요!' : `${scene.name}에 들어왔어요. 여기 대화는 이 방 사람들에게만 보여요.`, 'sys');
      if (LIVE) { lobbyTrack(); joinSceneChannel(); loadHistory(); }
      if (id === 'roof') loadWeather();
      if (id === 'soccer') onSoccerEnter();
      if (id === 'f1r1') { party = null; setTimeout(() => { if (sceneId === 'f1r1') ptySend({ t: 'hello' }); }, 1500); }
      renderPeople();
      requestAnimationFrame(() => { fade.classList.remove('on'); switching = false; });
    }, 280);
  }

  // ================= 오목 (탕비실 1:1 Gomoku) =================
  // Each game has its own id, so many pairs can play in the same room at once.
  // Messages ride on the room's broadcast channel (event 'gm'); nothing is stored in the database.
  const GN = 15, GM_ROOM = 'room2';
  let gm = null, gmIn = null, gmOut = null, gmGhost = -1, gmHover = -1, gmInvTimer = 0;
  const gmActive = () => !!(gm && !gm.over);
  const gmNewId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const gmClip = s => String(s || '상대').slice(0, 8);
  const gmTurn = () => gm.ms.length % 2 === 0 ? 1 : 2;
  const gmMyTurn = () => gmActive() && (gm.practice === 'hot' || gmTurn() === gm.me);
  function gmSend(p) { netSend('gm', Object.assign({ from: net.uid }, p)); }
  function gmLabel() {
    const b = $('gmBtn');
    b.hidden = sceneId !== GM_ROOM;
    b.textContent = gmActive() ? ($('gm').hidden ? (gmMyTurn() ? '⚫ 내 차례!' : '⚫ 오목판') : '⚫ 오목 중') : '⚫ 오목';
    b.classList.toggle('ping', gmActive() && $('gm').hidden && gmMyTurn());
  }

  // ---- rules ----
  const GDIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  function gmLine(b, idx) {
    const c = b[idx]; if (!c) return null;
    const r = Math.floor(idx / GN), q = idx % GN;
    for (const [dr, dq] of GDIRS) {
      const cells = [idx];
      for (const s of [1, -1]) {
        let rr = r + dr * s, qq = q + dq * s;
        while (rr >= 0 && rr < GN && qq >= 0 && qq < GN && b[rr * GN + qq] === c) { cells.push(rr * GN + qq); rr += dr * s; qq += dq * s; }
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }
  function gmLoad(ms) {
    gm.b.fill(0); gm.ms = ms.slice();
    gm.ms.forEach((ix, i) => { gm.b[ix] = i % 2 ? 2 : 1; });
  }

  // ---- computer opponent for practice (attack + defence pattern scoring) ----
  function gmScoreAt(b, idx, c) {
    const r = Math.floor(idx / GN), q = idx % GN; let total = 0;
    for (const [dr, dq] of GDIRS) {
      let n = 1, open = 0;
      for (const s of [1, -1]) {
        let rr = r + dr * s, qq = q + dq * s;
        while (rr >= 0 && rr < GN && qq >= 0 && qq < GN && b[rr * GN + qq] === c) { n++; rr += dr * s; qq += dq * s; }
        if (rr >= 0 && rr < GN && qq >= 0 && qq < GN && !b[rr * GN + qq]) open++;
      }
      if (n >= 5) total += 1e6;
      else if (n === 4) total += open === 2 ? 1e5 : open ? 1e4 : 0;
      else if (n === 3) total += open === 2 ? 5e3 : open ? 400 : 0;
      else if (n === 2) total += open === 2 ? 200 : open ? 30 : 0;
      else total += open;
    }
    return total;
  }
  function gmAiMove() {
    const b = gm.b, me = gmTurn(), you = 3 - me;
    if (!gm.ms.length) return 7 * GN + 7;
    let best = -1, bestS = -1;
    for (let i = 0; i < GN * GN; i++) {
      if (b[i]) continue;
      const r = Math.floor(i / GN), q = i % GN; let nearStone = false;
      for (let dr = -2; dr <= 2 && !nearStone; dr++) for (let dq = -2; dq <= 2; dq++) { const rr = r + dr, qq = q + dq; if (rr >= 0 && rr < GN && qq >= 0 && qq < GN && b[rr * GN + qq]) { nearStone = true; break; } }
      if (!nearStone) continue;
      const atk = gmScoreAt(b, i, me), def = gmScoreAt(b, i, you), lv = gm.level || 'mid';
      let s;
      // 상: plays for the win and blocks everything. 중: blocks real threats, misses some ideas. 하: often misses even open threes
      if (lv === 'hard') s = atk * 1.1 + def + Math.random() * 5;
      else if (lv === 'mid') s = atk + def * 0.8 + Math.random() * 450;
      else s = (atk >= 1e6 && Math.random() < 0.5 ? 1e6 : atk * 0.6) + def * 0.4 + Math.random() * 3200;
      if (s > bestS) { bestS = s; best = i; }
    }
    return best;
  }

  // ---- starting / finishing ----
  const GM_TIMES = [10, 20, 30, 0];   // seconds per move; 0 = no limit
  const LV_NAME = { easy: '하', mid: '중', hard: '상' };
  let gmPrefTl = +(store.get('onl-gm-tl') || 20); if (!GM_TIMES.includes(gmPrefTl)) gmPrefTl = 20;
  let gmPrefLv = store.get('onl-gm-lv') || 'mid'; if (!LV_NAME[gmPrefLv]) gmPrefLv = 'mid';
  function gmStart(id, oppId, oppName, color, practice, tl, level) {
    tl = GM_TIMES.includes(+tl) ? +tl : 0;
    gm = { id, oppId, oppName: gmClip(oppName), me: color, b: new Uint8Array(GN * GN), ms: [], over: false, win: null, how: '', winner: 0, practice: practice || null, tl, level: level || 'mid', turnT0: performance.now() };
    gmGhost = -1; gmHover = -1;
    closeModal(); gmHideInvite();
    net.dirty = true; net.lastTrack = 0;
    gmOpen();
    if (!practice) log('', `⚫ ${gm.oppName}님과 오목을 시작했어요. ${color === 1 ? '내가 흑이라 먼저 둬요.' : '상대가 흑이라 먼저 둬요.'}${tl ? ` 한 수 ${tl}초!` : ''}`, 'sys game');
    if (practice === 'ai' && color === 2) setTimeout(gmAiTurn, 500);
  }
  function gmFinish(winner, how) {
    if (!gmActive()) return;
    gm.over = true; gm.winner = winner; gm.how = how; gmGhost = -1;
    net.dirty = true; net.lastTrack = 0;
    if (gm.practice) {
      toast(winner === 0 ? '비겼어요' : how === 'timeout' ? '⏰ 시간 초과!' : gm.practice === 'hot' ? `${winner === 1 ? '흑' : '백'}이 이겼어요!` : winner === gm.me ? '이겼어요! 🎉' : '컴퓨터가 이겼어요');
    } else {
      const meName = gmClip(player.name), opp = gm.oppName;
      const iWon = winner === gm.me;
      const text = gmResultText(winner === 0 ? null : iWon ? meName : opp, winner === 0 ? null : iWon ? opp : meName, how, meName, opp);
      log('', text, 'sys game');
      // the winner (or, for a draw, whoever placed the last stone) tells the rest of the room
      if (iWon || (winner === 0 && how === 'full' && gm.ms.length % 2 === (gm.me === 1 ? 1 : 0))) gmSend({ t: 'res', id: gm.id, w: iWon ? meName : null, l: iWon ? opp : null, a: meName, b: opp, how, loser: iWon ? gm.oppId : null });
      if ($('gm').hidden && how !== 'left-me') toast(text);
    }
    gmRender();
  }
  function gmResultText(w, l, how, a, b) {
    if (!w) return `🤝 ${a}님과 ${b}님의 오목은 무승부예요`;
    if (how === 'resign') return `🏆 ${w}님이 이겼어요 (${l}님 기권)`;
    if (how === 'left') return `🏆 ${w}님이 이겼어요 (${l}님이 자리를 떠났어요)`;
    if (how === 'timeout') return `🏆 ${w}님이 이겼어요 (${l}님 시간 초과)`;
    return `🏆 ${w}님이 ${l}님을 이겼어요!`;
  }
  let gmWarned = false;
  const gmLeft = () => Math.max(0, Math.ceil((gm.tl * 1000 - (performance.now() - gm.turnT0)) / 1000));
  // the clock: whoever runs out of time loses. My own client calls my timeout; if the opponent's page is frozen,
  // I call theirs after a few seconds of grace.
  setInterval(() => {
    if (!gmActive() || !gm.tl) return;
    const el2 = performance.now() - gm.turnT0, lim = gm.tl * 1000;
    if (!$('gm').hidden) gmRender(); else gmLabel();
    if (gm.practice === 'hot' || (gm.practice === 'ai' ? gmTurn() === gm.me : gmMyTurn())) {
      if (!gmWarned && lim - el2 <= 5000 && lim - el2 > 0) { gmWarned = true; sfx('pop', 0.6); }
      if (el2 >= lim) {
        if (!gm.practice) gmSend({ t: 'end', id: gm.id, to: gm.oppId, why: 'timeout' });
        gmFinish(gm.practice === 'hot' ? 3 - gmTurn() : 3 - gm.me, 'timeout');
      }
    } else if (!gm.practice && el2 >= lim + 5000) { gmSend({ t: 'end', id: gm.id, to: gm.oppId, why: 'timeout' }); gmFinish(gm.me, 'timeout'); }
  }, 250);
  function gmPlace(idx) {
    if (!gmActive() || gm.b[idx]) return false;
    gm.b[idx] = gmTurn(); gm.ms.push(idx); gm.turnT0 = performance.now(); gmWarned = false;
    const line = gmLine(gm.b, idx);
    if (line) { gm.win = line; gmFinish(gm.b[idx], 'five'); }
    else if (gm.ms.length >= GN * GN) gmFinish(0, 'full');
    return true;
  }
  function gmPlay(idx) {
    if (!gmMyTurn() || gm.b[idx]) return;
    const ms = gm.ms.concat(idx);
    if (!gm.practice) gmSend({ t: 'mv', id: gm.id, to: gm.oppId, ms });
    gmPlace(idx); gmGhost = -1; gmRender();
    if (gm.practice === 'ai' && gmActive()) setTimeout(gmAiTurn, 380 + Math.random() * 300);
  }
  function gmAiTurn() { if (!gm || gm.practice !== 'ai' || !gmActive() || gmTurn() === gm.me) return; gmPlace(gmAiMove()); gmRender(); }
  function gmResign() {
    if (!gmActive()) { gmCloseBoard(); return; }
    if (!gm.practice) gmSend({ t: 'end', id: gm.id, to: gm.oppId, why: 'resign' });
    gmFinish(gm.practice === 'hot' ? 3 - gmTurn() : 3 - gm.me, 'resign');
  }
  // leaving 탕비실 (or the page) during a game counts as a loss
  function gmLeaveRoom() {
    if (gmActive()) {
      if (!gm.practice) { gmSend({ t: 'end', id: gm.id, to: gm.oppId, why: 'left' }); log('', '방을 나와서 오목은 기권 처리됐어요.', 'sys'); }
      gmFinish(3 - gm.me, 'left-me');
    }
    if (gmOut) gmCancelOut(true);
    if (gmIn) { gmSend({ t: 'no', id: gmIn.id, to: gmIn.from, why: 'left' }); gmHideInvite(); }
    gm = null; $('gm').hidden = true;
  }
  window.addEventListener('pagehide', () => { if (gmActive() && !gm.practice) gmSend({ t: 'end', id: gm.id, to: gm.oppId, why: 'left' }); });

  // ---- challenge list ----
  function gmLobby() {
    if (gmActive()) { gmOpen(); return; }
    if (gm && gm.over) { gm = null; }
    const body = $('modalBody'); body.innerHTML = '';
    $('modalTitle').textContent = '오목 한 판';
    body.appendChild(el('p', 'small', '탕비실에 있는 사람에게 도전해 보세요. 신청한 사람이 흑으로 먼저 두고, 가로·세로·대각선으로 5개를 먼저 이으면 이겨요.'));
    const list = el('div', 'gm-list');
    const others = [...net.remotes.values()].filter(e => e.scene === sceneId || LIVE).sort((a, z) => (a.name || '').localeCompare(z.name || ''));
    if (!others.length) list.appendChild(el('p', 'gm-empty', LIVE ? '지금 탕비실에 다른 사람이 없어요. 누가 들어오면 여기에 보여요.' : '체험판이라 다른 사람이 없어요. 실제 사이트에서는 탕비실에 있는 사람이 여기에 보여요.'));
    for (const e of others) {
      const row = el('div', 'gm-row');
      row.appendChild(el('span', 'gm-name', e.name || '…'));
      const busy = e.og ? '게임 중' : e.dnd ? 'OFF' : '';
      if (busy) row.appendChild(el('span', 'gm-busy', busy));
      const b = el('button', 'btn btn-gold', '도전'); b.type = 'button'; b.disabled = !!busy;
      b.addEventListener('click', () => gmChallenge(e.id, e.name));
      row.appendChild(b); list.appendChild(row);
    }
    body.appendChild(list);
    // time per move, chosen before the game (the challenger's choice is used for both players)
    const chips = (label, opts, cur, onPick) => {
      const row = el('div', 'gm-opt'); row.appendChild(el('span', 'gm-opt-l', label));
      for (const [v, txt] of opts) { const c = el('button', 'btn gm-chip', txt); c.type = 'button'; c.setAttribute('aria-pressed', String(v === cur)); c.addEventListener('click', () => { onPick(v); gmLobby(); }); row.appendChild(c); }
      return row;
    };
    body.insertBefore(chips('한 수 시간', GM_TIMES.map(t => [t, t ? `${t}초` : '제한 없음']), gmPrefTl, v => { gmPrefTl = v; store.set('onl-gm-tl', String(v)); }), list);
    body.appendChild(el('p', 'small', '시간 안에 두지 못하면 그 판은 지게 돼요. 처음이면 20초를 추천해요.'));
    const pr = el('div', 'gm-practice');
    pr.appendChild(chips('컴퓨터 난이도', [['easy', '하'], ['mid', '중'], ['hard', '상']], gmPrefLv, v => { gmPrefLv = v; store.set('onl-gm-lv', v); }));
    const ai = el('button', 'btn', `컴퓨터와 연습 (${LV_NAME[gmPrefLv]})`); ai.type = 'button'; ai.addEventListener('click', () => gmStart('p', null, `컴퓨터(${LV_NAME[gmPrefLv]})`, 1, 'ai', gmPrefTl, gmPrefLv));
    const hot = el('button', 'btn', '혼자 두 색 두기'); hot.type = 'button'; hot.addEventListener('click', () => gmStart('p', null, '백', 1, 'hot', 0));
    const prb = el('div', 'gm-practice-btns'); prb.append(ai, hot); pr.appendChild(prb); body.appendChild(pr);
    $('modal').hidden = false; $('modalClose').focus();
  }
  function gmChallenge(to, name) {
    if (gmActive()) return;
    if (gmOut) gmCancelOut(true);
    if (player.dnd) { toast('OFF 모드에서는 신청할 수 없어요. 제목의 OFF를 눌러 ON으로 바꿔 주세요.'); return; }
    const id = gmNewId();
    const tl = gmPrefTl;
    gmOut = { id, to, tl, name: gmClip(name), timer: setTimeout(() => { if (gmOut && gmOut.id === id) { gmSend({ t: 'cx', id, to }); gmOut = null; closeModal(); toast(`${gmClip(name)}님이 응답하지 않았어요`); } }, 25000) };
    gmSend({ t: 'inv', id, to, name: gmClip(player.name), tl });
    const body = $('modalBody'); body.innerHTML = '';
    $('modalTitle').textContent = '오목 신청';
    body.appendChild(el('p', '', `${gmOut.name}님에게 오목을 신청했어요. (한 수 ${tl ? tl + '초' : '시간 제한 없음'})`));
    body.appendChild(el('p', 'small gm-wait', '대답을 기다리는 중…'));
    const c = el('button', 'btn', '신청 취소'); c.type = 'button'; c.addEventListener('click', () => { gmCancelOut(); closeModal(); });
    body.appendChild(c);
    $('modal').hidden = false;
  }
  function gmCancelOut(silent) {
    if (!gmOut) return;
    clearTimeout(gmOut.timer); gmSend({ t: 'cx', id: gmOut.id, to: gmOut.to }); gmOut = null;
    if (!silent) toast('신청을 취소했어요');
  }

  // ---- incoming invite card ----
  function gmShowInvite(p) {
    const tl = GM_TIMES.includes(+p.tl) ? +p.tl : 0;
    gmIn = { id: p.id, from: p.from, name: gmClip(p.name), until: Date.now() + 20000, tl };
    $('gmInvText').textContent = `${gmIn.name}님이 오목 한 판을 신청했어요! (한 수 ${tl ? tl + '초' : '시간 제한 없음'})`;
    $('gmInv').hidden = false;
    const tick = () => {
      if (!gmIn) return;
      const left = Math.ceil((gmIn.until - Date.now()) / 1000);
      if (left <= 0) { gmDecline('timeout'); return; }
      $('gmInvSec').textContent = `${left}`;
    };
    clearInterval(gmInvTimer); tick(); gmInvTimer = setInterval(tick, 250);
  }
  function gmHideInvite() { clearInterval(gmInvTimer); gmIn = null; $('gmInv').hidden = true; }
  function gmAccept() {
    if (!gmIn) return;
    const { id, from, name, tl } = gmIn;
    if (!net.remotes.has(from)) { gmHideInvite(); toast('상대가 방을 나갔어요'); return; }
    if (gmOut) gmCancelOut(true);
    gmSend({ t: 'ok', id, to: from, name: gmClip(player.name) });
    gmStart(id, from, name, 2, null, tl);
  }
  function gmDecline(why) {
    if (!gmIn) return;
    gmSend({ t: 'no', id: gmIn.id, to: gmIn.from, why: why || 'no' });
    gmHideInvite();
  }
  $('gmAccept').addEventListener('click', gmAccept);
  $('gmDecline').addEventListener('click', () => gmDecline('no'));

  // ---- network ----
  function onGm(p) {
    if (!p || p.from === net.uid || sceneId !== GM_ROOM) return;
    if (p.t === 'res') {   // announced to everyone in the room
      if (gm && gm.id === p.id) return;   // the two players already logged it themselves
      log('', gmResultText(p.w && gmClip(p.w), p.l && gmClip(p.l), p.how, gmClip(p.a), gmClip(p.b)), 'sys game');
      return;
    }
    if (p.to !== net.uid) return;
    const fromName = () => gmClip((net.remotes.get(p.from) || {}).name || p.name);
    switch (p.t) {
      case 'inv':
        if (gmActive() || gmIn || player.dnd || (gmOut && gmOut.to !== p.from)) { gmSend({ t: 'no', id: p.id, to: p.from, why: player.dnd ? 'dnd' : 'busy' }); return; }
        if (gmOut && gmOut.to === p.from) {   // both challenged each other at the same moment: just start
          const mine = gmOut; clearTimeout(mine.timer); gmOut = null;
          if (mine.id < p.id) { gmSend({ t: 'ok', id: p.id, to: p.from, name: gmClip(player.name) }); gmStart(p.id, p.from, fromName(), 2, null, p.tl); }
          else gmOut = mine;   // the other side will accept mine
          return;
        }
        gmShowInvite(p); break;
      case 'cx':
        if (gmIn && gmIn.id === p.id) { gmHideInvite(); toast(`${fromName()}님이 신청을 취소했어요`); }
        break;
      case 'ok':
        if (gmOut && gmOut.id === p.id && !gmActive()) { clearTimeout(gmOut.timer); const n = gmOut.name, tl = gmOut.tl; gmOut = null; gmStart(p.id, p.from, n, 1, null, tl); }
        else gmSend({ t: 'end', id: p.id, to: p.from, why: 'cancel' });
        break;
      case 'no':
        if (gmOut && gmOut.id === p.id) {
          clearTimeout(gmOut.timer); const n = gmOut.name; gmOut = null; closeModal();
          toast(p.why === 'busy' ? `${n}님은 지금 다른 게임 중이에요` : p.why === 'dnd' ? `${n}님은 OFF 모드예요` : p.why === 'timeout' ? `${n}님이 응답하지 않았어요` : p.why === 'left' ? `${n}님이 방을 나갔어요` : `${n}님이 다음에 하자고 했어요`);
        }
        break;
      case 'mv':
        if (!gm || gm.id !== p.id || p.from !== gm.oppId || gm.over || !Array.isArray(p.ms)) return;
        if (p.ms.length <= gm.ms.length || p.ms.length > GN * GN) return;
        if (!p.ms.every(ix => Number.isInteger(ix) && ix >= 0 && ix < GN * GN) || new Set(p.ms).size !== p.ms.length) return;
        if (!gm.ms.every((ix, i) => p.ms[i] === ix)) return;
        { const last = p.ms[p.ms.length - 1]; gmLoad(p.ms.slice(0, -1)); gmPlace(last); }
        gmGhost = -1; gmRender();
        break;
      case 'end':
        if (!gm || gm.id !== p.id || p.from !== gm.oppId) return;
        if (p.why === 'cancel' && !gm.ms.length) { gm.over = true; gm = null; $('gm').hidden = true; gmLabel(); net.dirty = true; toast('상대가 신청을 취소했어요'); return; }
        if (gmActive()) gmFinish(gm.me, p.why === 'resign' ? 'resign' : p.why === 'timeout' ? 'timeout' : 'left');
        break;
    }
  }
  // called from removeRemote: the opponent closed the page or lost connection
  function gmPeerGone(id) {
    if (gmActive() && !gm.practice && gm.oppId === id) gmFinish(gm.me, 'left');
    if (gmIn && gmIn.from === id) gmHideInvite();
    if (gmOut && gmOut.to === id) { clearTimeout(gmOut.timer); gmOut = null; if (!$('modal').hidden) closeModal(); }
  }

  // ---- board UI ----
  const gmCv = $('gmBoard');
  function gmSize() {
    const w = Math.min(window.innerWidth - 44, 460), h = window.innerHeight - 210;
    const s = Math.max(210, Math.floor(Math.min(w, h)));
    gmCv.style.width = gmCv.style.height = s + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (gmCv.width !== Math.round(s * dpr)) { gmCv.width = gmCv.height = Math.round(s * dpr); }
  }
  function gmOpen() { $('gm').hidden = false; gmSize(); gmRender(); }
  function gmCloseBoard() { $('gm').hidden = true; if (gm && gm.over) gm = null; gmLabel(); }
  function gmGeom() { const s = gmCv.clientWidth, cell = s / (GN - 1 + 1.4); return { s, cell, m: cell * 0.7 }; }
  function gmRender() {
    gmLabel();
    if (!gm || $('gm').hidden) return;
    const meName = gmClip(player.name);
    const names = gm.practice === 'hot' ? ['흑', '백'] : gm.me === 1 ? [meName + ' (나)', gm.oppName] : [gm.oppName, meName + ' (나)'];
    $('gmP1').textContent = '⚫ ' + names[0]; $('gmP2').textContent = '⚪ ' + names[1];
    const t = gmTurn();
    $('gmP1').classList.toggle('on', !gm.over && t === 1); $('gmP2').classList.toggle('on', !gm.over && t === 2);
    let msg;
    if (gm.over) {
      if (gm.winner === 0) msg = '무승부예요';
      else if (gm.practice === 'hot') msg = `${gm.winner === 1 ? '흑' : '백'} 승리!`;
      else if (gm.winner === gm.me) msg = gm.how === 'five' ? '🎉 오목 완성! 이겼어요' : gm.how === 'resign' ? '🎉 상대가 기권해서 이겼어요' : gm.how === 'timeout' ? '🎉 상대가 시간을 넘겨서 이겼어요' : '🎉 상대가 떠나서 이겼어요';
      else msg = gm.how === 'timeout' ? '⏰ 시간 초과로 졌어요' : gm.practice === 'ai' ? (gm.how === 'five' ? '컴퓨터가 이겼어요' : '기권했어요') : gm.how === 'five' ? `${gm.oppName}님이 이겼어요` : '기권했어요';
    } else if (gm.practice === 'hot') msg = `${t === 1 ? '흑' : '백'} 차례예요`;
    else msg = gmMyTurn() ? '내 차례예요' : gm.practice === 'ai' ? '컴퓨터가 생각 중…' : `${gm.oppName}님 차례예요`;
    if (gm.tl && !gm.over) { const left = gmLeft(); msg += ` · ${left}초`; }
    $('gmTurn').textContent = msg;
    $('gmTurn').classList.toggle('hurry', !!(gm.tl && !gm.over && gmLeft() <= 5));
    const bar = $('gmTime'); bar.hidden = !gm.tl || gm.over;
    if (gm.tl) bar.firstElementChild.style.width = `${Math.max(0, 100 * (gm.tl * 1000 - (performance.now() - gm.turnT0)) / (gm.tl * 1000))}%`;
    $('gmTurn').className = 'gm-turn' + (gmMyTurn() ? ' mine' : '') + (gm.over ? ' done' : '');
    $('gmTitle').textContent = gm.practice ? '오목 연습' : '오목 한 판';
    $('gmResign').hidden = gm.over; $('gmClose').hidden = !gm.over;
    $('gmAgain').hidden = !(gm.over && (gm.practice || net.remotes.has(gm.oppId)));
    $('gmAgain').textContent = gm.practice ? '다시 하기' : '한 판 더 신청';
    gmDraw();
  }
  function gmDraw() {
    const g = gmCv.getContext('2d'), dpr = gmCv.width / gmCv.clientWidth;
    const { s, cell, m } = gmGeom();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#e6b86a'; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(160,100,40,.10)';
    for (let i = 0; i < 9; i++) g.fillRect(0, (i * 53) % s, s, 2 + (i % 3));
    g.strokeStyle = '#5b3a1e'; g.lineWidth = 1;
    for (let i = 0; i < GN; i++) {
      const p = Math.round(m + i * cell) + 0.5;
      g.beginPath(); g.moveTo(m, p); g.lineTo(m + cell * (GN - 1), p); g.stroke();
      g.beginPath(); g.moveTo(p, m); g.lineTo(p, m + cell * (GN - 1)); g.stroke();
    }
    g.fillStyle = '#5b3a1e';
    for (const [r, q] of [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]]) { g.beginPath(); g.arc(m + q * cell, m + r * cell, Math.max(2, cell * 0.12), 0, Math.PI * 2); g.fill(); }
    const stone = (idx, c, alpha) => {
      const x = m + (idx % GN) * cell, y = m + Math.floor(idx / GN) * cell, r = cell * 0.45;
      g.globalAlpha = alpha;
      g.fillStyle = 'rgba(40,20,0,.28)'; g.beginPath(); g.arc(x + r * 0.12, y + r * 0.16, r, 0, Math.PI * 2); g.fill();
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      if (c === 1) { gr.addColorStop(0, '#5d5966'); gr.addColorStop(1, '#141218'); } else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d4cfc6'); }
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      if (c === 2) { g.strokeStyle = 'rgba(80,70,60,.55)'; g.lineWidth = 1; g.stroke(); }
      g.globalAlpha = 1;
    };
    for (let i = 0; i < GN * GN; i++) if (gm.b[i]) stone(i, gm.b[i], 1);
    const last = gm.ms[gm.ms.length - 1];
    if (last != null) { g.fillStyle = '#ff5a4f'; g.beginPath(); g.arc(m + (last % GN) * cell, m + Math.floor(last / GN) * cell, Math.max(2.5, cell * 0.13), 0, Math.PI * 2); g.fill(); }
    if (gm.win) {
      g.strokeStyle = '#ff5a4f'; g.lineWidth = Math.max(2, cell * 0.1);
      for (const ix of gm.win) { g.beginPath(); g.arc(m + (ix % GN) * cell, m + Math.floor(ix / GN) * cell, cell * 0.47, 0, Math.PI * 2); g.stroke(); }
    }
    const pre = gmGhost >= 0 ? gmGhost : gmHover;
    if (pre >= 0 && gmMyTurn() && !gm.b[pre]) {
      stone(pre, gmTurn(), gmGhost >= 0 ? 0.75 : 0.4);
      if (gmGhost >= 0) { g.strokeStyle = '#2f8f80'; g.lineWidth = 2; g.beginPath(); g.arc(m + (pre % GN) * cell, m + Math.floor(pre / GN) * cell, cell * 0.5, 0, Math.PI * 2); g.stroke(); }
    }
  }
  function gmCellAt(e) {
    const rc = gmCv.getBoundingClientRect(), { cell, m } = gmGeom();
    const q = Math.round((e.clientX - rc.left - m) / cell), r = Math.round((e.clientY - rc.top - m) / cell);
    return q < 0 || r < 0 || q >= GN || r >= GN ? -1 : r * GN + q;
  }
  gmCv.addEventListener('pointerdown', e => {
    if (!gmMyTurn()) return;
    const idx = gmCellAt(e); if (idx < 0 || gm.b[idx]) return;
    e.preventDefault();
    if (e.pointerType === 'mouse') { gmPlay(idx); return; }
    // touch: first tap previews, second tap on the same spot places the stone
    if (gmGhost === idx) gmPlay(idx); else { gmGhost = idx; gmRender(); }
  });
  gmCv.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || !gmMyTurn()) return; const idx = gmCellAt(e); if (idx !== gmHover) { gmHover = idx; gmDraw(); } });
  gmCv.addEventListener('pointerleave', () => { if (gmHover >= 0) { gmHover = -1; if (gm) gmDraw(); } });
  $('gmBtn').addEventListener('click', () => { if (gm && (gmActive() || gm.over)) gmOpen(); else gmLobby(); });
  $('gmHide').addEventListener('click', () => { if (gm && gm.over) gmCloseBoard(); else { $('gm').hidden = true; gmLabel(); } });
  $('gmResign').addEventListener('click', () => {
    if (!gmActive()) return;
    const b = $('gmResign');
    if (b.dataset.sure) { delete b.dataset.sure; b.textContent = '기권'; gmResign(); return; }
    b.dataset.sure = '1'; b.textContent = '정말 기권?';
    setTimeout(() => { if (b.dataset.sure) { delete b.dataset.sure; b.textContent = '기권'; } }, 3000);
  });
  $('gmClose').addEventListener('click', gmCloseBoard);
  $('gmAgain').addEventListener('click', () => {
    if (!gm) return;
    const { practice, oppId, oppName, me, tl, level } = gm;
    gm = null; $('gm').hidden = true;
    if (practice) gmStart('p', null, oppName, practice === 'ai' ? 3 - me : 1, practice, tl, level);
    else gmChallenge(oppId, oppName);
  });
  $('gm').addEventListener('pointerdown', e => { if (e.target === $('gm')) { if (gm && gm.over) gmCloseBoard(); else { $('gm').hidden = true; gmLabel(); } } });
  window.addEventListener('resize', () => { if (!$('gm').hidden) { gmSize(); gmRender(); } });

  // ================= anonymous prayer requests (box under the offering QR) =================
  const relTime = t => {
    const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
    if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.floor(h / 24)}일 전`;
  };
  const DEMO_PRAYERS = [
    { id: 3, body: '이번 주 면접이 있어요. 떨지 않고 준비한 만큼 말할 수 있도록 기도 부탁드려요.', created_at: Date.now() - 3600e3 * 5, amens: 4, amened: false, mine: false },
    { id: 2, body: '가족 중에 몸이 안 좋은 분이 있어요. 빨리 회복되길 함께 기도해 주세요.', created_at: Date.now() - 3600e3 * 30, amens: 7, amened: false, mine: false },
    { id: 1, body: '요즘 마음이 많이 지쳐 있어요. 다시 기쁨을 찾을 수 있도록요.', created_at: Date.now() - 3600e3 * 70, amens: 9, amened: true, mine: false }
  ];
  let prayers = [], prayerSample = false;
  // Prayers have no author on the server. This device remembers the ids it posted (to mark "mine") and when it posted
  // (to warn after 5 in a day). Both are only hints kept in localStorage: editing and deleting always need the password.
  const myPrayerIds = () => { const a = loadJSON('onl-my-prayers', []); return Array.isArray(a) ? a : []; };
  const prayerStamps = () => { const a = loadJSON('onl-pr-day', []), t = Date.now() - 864e5; return (Array.isArray(a) ? a : []).filter(x => x > t); };
  async function loadPrayers() {
    if (LIVE) {
      const { data, error } = await sb.rpc('list_prayers'); prayers = error || !data ? [] : data; prayerSample = false;
      const mine = myPrayerIds(); prayers.forEach(p => { p.mine = p.mine === true || mine.includes(p.id); });
      return !error;
    }
    const saved = loadJSON('onl-prayers', null);
    if (Array.isArray(saved)) { prayers = saved; prayerSample = false; } else { prayers = DEMO_PRAYERS.map(x => Object.assign({}, x)); prayerSample = true; }
    return true;
  }
  const saveDemoPrayers = () => { store.set('onl-prayers', JSON.stringify(prayers)); prayerSample = false; };
  async function openPrayers() {
    const body = $('modalBody'); body.innerHTML = '';
    $('modalTitle').textContent = '익명 기도제목';
    const form = el('form', 'pr-form'); form.noValidate = true;
    const ta = el('textarea'); ta.id = 'prText'; ta.rows = 3; ta.maxLength = 300; ta.placeholder = '나누고 싶은 기도제목을 적어 주세요. 이름은 남지 않아요.'; ta.setAttribute('aria-label', '기도제목');
    const row = el('div', 'pr-row');
    const note = el('span', 'small', '글에는 이름이 남지 않아요. 수정·삭제할 때 쓸 비밀번호를 정해 주세요.');
    const sub = el('button', 'btn btn-gold', '익명으로 올리기'); sub.type = 'submit';
    const pwIn = el('input'); pwIn.type = 'password'; pwIn.id = 'prPw'; pwIn.autocomplete = 'new-password'; pwIn.placeholder = '이 글의 비밀번호'; pwIn.setAttribute('aria-label', '이 글의 비밀번호');
    if (LIVE && !BP.legacy) row.append(pwIn);   // BACKPORT: the old database has no prayer passwords
    row.append(note, sub); form.append(ta, row);
    const list = el('div', 'pr-list'); list.appendChild(el('p', 'small', '불러오는 중…'));
    body.append(form, list);
    $('modal').hidden = false; ta.focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = ta.value.trim();
      if (text.length < 2) { toast('기도제목을 조금 더 적어 주세요'); return; }
      if (LIVE && !BP.legacy && !pwIn.value) { toast('이 글의 비밀번호를 정해 주세요'); pwIn.focus(); return; }
      // a nudge only: this count lives on the device, so it is not a limit
      if (LIVE && prayerStamps().length >= 5 && !confirm('오늘 이 기기에서 이미 기도제목을 5개 올렸어요. 그래도 올릴까요?')) return;
      sub.disabled = true;
      if (LIVE) {
        const { data, error } = await sb.rpc('add_prayer', { body: text, pw: pwIn.value });
        if (error) { toast(/limit/i.test(error.message) ? '하루에 5개까지 올릴 수 있어요' : '올리지 못했어요. 잠시 후 다시 해 주세요'); sub.disabled = false; return; }
        store.set('onl-pr-day', JSON.stringify([...prayerStamps(), Date.now()]));
        if (typeof data === 'number') store.set('onl-my-prayers', JSON.stringify([...myPrayerIds(), data].slice(-200)));
        pwIn.value = '';
        lobbySend('prayer', {});
      } else {
        if (prayerSample) prayers = [];
        prayers.unshift({ id: Date.now(), body: text, created_at: Date.now(), amens: 0, amened: false, mine: true }); saveDemoPrayers();
      }
      ta.value = ''; sub.disabled = false; toast('익명으로 올렸어요');
      await loadPrayers(); renderPrayers(list);
    });
    await loadPrayers(); renderPrayers(list);
  }
  function renderPrayers(list) {
    list.innerHTML = '';
    if (prayerSample) list.appendChild(el('span', 'tag', '예시'));
    if (!prayers.length) { list.appendChild(el('p', 'small', '아직 올라온 기도제목이 없어요. 첫 번째로 나눠 주세요.')); return; }
    prayers.forEach(pr => {
      const card = el('div', 'pr-card');
      card.appendChild(el('p', 'pr-body', pr.body));
      const meta = el('div', 'pr-meta');
      meta.appendChild(el('span', 'small', relTime(pr.created_at) + (pr.mine ? ' · 내가 쓴 글' : '')));
      const amen = el('button', 'btn pr-amen', `🙏 함께 기도해요 ${pr.amens || 0}`); amen.type = 'button'; amen.setAttribute('aria-pressed', String(!!pr.amened));
      amen.addEventListener('click', async () => {
        if (LIVE) { const { error } = await sb.rpc('toggle_amen', { pid: pr.id }); if (error) return; await loadPrayers(); }
        else { pr.amened = !pr.amened; pr.amens = (pr.amens || 0) + (pr.amened ? 1 : -1); saveDemoPrayers(); }
        renderPrayers(list);
      });
      meta.appendChild(amen);
      const deleteIt = async pw => {
        if (LIVE) {
          const { data, error } = await sb.rpc('delete_prayer', { pid: pr.id, pw });
          if (error || data === false) { toast(error ? '삭제하지 못했어요' : '비밀번호가 맞지 않아요'); return; }
          await loadPrayers();
        } else { prayers = prayers.filter(x => x !== pr); saveDemoPrayers(); }
        renderPrayers(list);
      };
      if (LIVE && !BP.legacy) {   // BACKPORT: only the new database checks a password per prayer
        // any device can manage a prayer with its password; "mine" only opens the panel at first sight
        const panel = el('div', 'pr-row'); panel.hidden = !pr.mine;
        const pw = el('input'); pw.type = 'password'; pw.autocomplete = 'off'; pw.placeholder = isAdmin ? '비밀번호 (관리자는 삭제에 불필요)' : '이 글의 비밀번호'; pw.setAttribute('aria-label', '이 글의 비밀번호');
        const edit = el('button', 'btn', '수정'); edit.type = 'button';
        const del = el('button', 'btn pr-del', '삭제'); del.type = 'button';
        edit.addEventListener('click', async () => {
          if (!pw.value) { toast('비밀번호를 입력해 주세요'); return; }
          const nb = prompt('새 내용', pr.body);
          if (nb === null || nb.trim().length < 2) return;
          const { data, error } = await sb.rpc('update_prayer', { pid: pr.id, pw: pw.value, new_body: nb.trim().slice(0, 300) });
          if (error || data === false) { toast(error ? '수정하지 못했어요' : '비밀번호가 맞지 않아요'); return; }
          toast('수정했어요'); await loadPrayers(); renderPrayers(list);
        });
        del.addEventListener('click', async () => {
          if (!pw.value && !isAdmin) { toast('비밀번호를 입력해 주세요'); return; }
          if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = '정말 삭제'; return; }
          await deleteIt(pw.value);
        });
        panel.append(pw, edit, del);
        const manage = el('button', 'btn', '관리'); manage.type = 'button';
        manage.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) pw.focus(); });
        meta.appendChild(manage);
        card.append(meta, panel);
        list.appendChild(card);
        return;
      }
      if (pr.mine || isAdmin) {
        const del = el('button', 'btn pr-del', '삭제'); del.type = 'button';
        del.addEventListener('click', async () => {
          if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = '정말 삭제'; return; }
          await deleteIt();
        });
        meta.appendChild(del);
      }
      card.appendChild(meta);
      list.appendChild(card);
    });
  }

  // ================= ON-Lounge / OFF-Lounge (do not disturb) =================
  function setDnd(on, quiet) {
    player.dnd = on;
    app.classList.toggle('off', on);
    $('dndBtn').textContent = on ? 'OFF' : 'ON';
    $('dndBtn').setAttribute('aria-pressed', String(!on));
    document.title = on ? 'OFF-Lounge' : 'ON-Lounge';
    $('chatInput').disabled = on;
    $('chatInput').placeholder = on ? 'OFF-Lounge 모드에서는 채팅할 수 없어요' : '할 말을 입력하세요';
    if (on) { player.bubble = null; player.emote = null; player.playing = null; player.action = 'pray'; player.actionUntil = Infinity; player.actionT0 = performance.now(); if (!quiet) toast('OFF-Lounge 모드예요. 조용히 기도하는 시간이에요.'); }
    else { if (player.action === 'pray') player.action = null; if (!quiet) toast('ON-Lounge로 돌아왔어요'); const pane = logEl.parentElement; pane.scrollTop = pane.scrollHeight; }
    store.set('onl-off', on ? '1' : '0');
    lobbyTrack(); renderPeople();
  }
  $('dndBtn').addEventListener('click', () => setDnd(!player.dnd));


  // ================= sign up -> log in -> create character =================
  let authTab = 'login';
  function showAuth(loadingText) {
    $('join').hidden = false;
    $('joinLoading').hidden = !loadingText; $('authCard').hidden = !!loadingText;
    if (loadingText) $('joinLoading').textContent = loadingText;
    $('demoNote').hidden = LIVE;
    setAuthTab(authTab);
  }
  function setAuthTab(t) {
    authTab = t;
    document.querySelectorAll('[data-auth]').forEach(b2 => b2.setAttribute('aria-pressed', String(b2.dataset.auth === t)));
    $('signupFields').hidden = t !== 'signup';
    $('authBtn').textContent = t === 'signup' ? '회원가입' : '로그인';
    $('authPw').autocomplete = t === 'signup' ? 'new-password' : 'current-password';
    $('authPw2').required = t === 'signup'; $('authCode').required = t === 'signup';
    $('authErr').textContent = '';
  }
  document.querySelectorAll('[data-auth]').forEach(b2 => b2.addEventListener('click', () => setAuthTab(b2.dataset.auth)));
  let pendingCode = '';
  $('authCard').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('authErr'), btn = $('authBtn');
    const email = $('authEmail').value.trim(), pw = $('authPw').value;
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = '이메일 주소를 확인해 주세요.'; return; }
    if (pw.length < 6) { err.textContent = '비밀번호는 6자 이상이어야 해요.'; return; }
    if (authTab === 'signup' && pw !== $('authPw2').value) { err.textContent = '비밀번호가 서로 달라요.'; return; }
    err.textContent = ''; btn.disabled = true; const label = btn.textContent; btn.textContent = '잠시만요…';
    try {
      if (!LIVE) { store.set('onl-demo-auth', email); await afterLogin(null); return; }
      if (authTab === 'signup') {
        const code = $('authCode').value.trim();
        const chk = await sb.rpc('check_invite', { code });
        if (chk.error) throw new Error('확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
        if (chk.data !== 'ok') throw new Error(inviteMsg(chk.data));
        const r = await sb.auth.signUp({ email, password: pw });
        if (r.error) throw new Error(/registered|exists/i.test(r.error.message) ? '이미 가입된 이메일이에요. 로그인해 주세요.' : '가입하지 못했어요. 잠시 후 다시 시도해 주세요.');
        if (!r.data.session) throw new Error('가입은 됐지만 바로 로그인되지 않았어요. 관리자에게 Supabase의 "Confirm email"을 꺼 달라고 해 주세요.');
        pendingCode = code;
        await afterLogin(r.data.session.user);
      } else {
        const r = await sb.auth.signInWithPassword({ email, password: pw });
        if (r.error) throw new Error('이메일이나 비밀번호가 맞지 않아요.');
        await afterLogin(r.data.session.user);
      }
    } catch (ex) { err.textContent = ex.message; }
    btn.disabled = false; btn.textContent = label;
  });
  // status from check_invite / join_lounge: 'wrong' | 'closed' | 'banned:<seconds>'
  function inviteMsg(st) {
    const ban = /^banned:(\d+)/.exec(st || '');
    if (ban) return `시도가 너무 많았어요. ${Math.ceil(ban[1] / 60)}분 뒤에 다시 해 주세요.`;
    return st === 'closed' ? '지금은 새 가입을 받지 않아요. 관리자에게 문의해 주세요.' : '초대 코드가 맞지 않아요.';
  }
  async function loadMe(user) {
    const { data, error } = await sb.from('profiles').select('name, look').eq('id', user.id).maybeSingle();
    net.uid = user.id;
    if (error || !data) return { member: false };
    player.name = data.name; nameInput.value = data.name;
    const lk = validLook(data.look);
    if (lk) player.look = lk;
    return { member: true, hasLook: !!lk };
  }
  async function afterLogin(user) {
    if (!LIVE) {
      $('join').hidden = true;
      if (!validLook(loadJSON('onus-look', null))) openCreator('new', async () => true);
      startDemo();
      return;
    }
    const me = await loadMe(user);
    const a = await sb.rpc('is_admin'); isAdmin = a.data === true;
    if (me.member && me.hasLook) { await enterLounge(); return; }
    $('join').hidden = true;
    $('crCodeRow').hidden = me.member || isAdmin || !!pendingCode;
    openCreator('new', async () => {
      const code = pendingCode || $('crCode').value.trim();
      const j = await sb.rpc('join_lounge', { code, display_name: player.name, look: player.look });
      if (j.error) { $('crErr').textContent = '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'; return false; }
      if (j.data !== 'ok') { $('crErr').textContent = inviteMsg(j.data); return false; }
      await enterLounge();
      return true;
    });
  }
  async function enterLounge() {
    $('join').hidden = true;
    renderPeople();
    await loadContent();
    const a = await sb.rpc('is_admin'); isAdmin = a.data === true; showAdmin();
    await loadHistory();
    log('', '왼쪽 출입구로 들어왔어요. 말풍선(…)이 뜬 곳에 가까이 가 보세요.', 'sys');
    inLounge = true;
    connectRealtime();
  }
  async function bootLive() {
    showAuth('연결하는 중…');
    const { data: { session } } = await sb.auth.getSession();
    if (session) { await afterLogin(session.user); return; }
    showAuth('');
  }
  let demoStarted = false;
  function startDemo() {
    if (demoStarted) return; demoStarted = true; inLounge = true; net.uid = net.uid || 'me';
    renderPeople();
    log('', '체험판이에요. 실제 사이트에서는 접속한 사람들이 여기 함께 보여요. 저장은 이 기기에만 돼요.', 'sys');
  }

  // ================= boot =================
  loadSceneArt(); refreshChars(); applyLayout(); resize(); setTab('chat'); showAdmin(); $('sceneTag').textContent = scene.name;
  $('modeTag').textContent = LIVE ? 'LIVE' : 'DEMO';
  if (window.matchMedia('(hover: none)').matches) $('hint').textContent = '바닥을 눌러 이동 · 의자를 누르면 앉아요 · 말풍선(…)이 뜬 곳을 눌러 살펴보기 · 펀치는 가까운 사람에게!';
  if (store.get('onl-off') === '1') setDnd(true, true);
  if (LIVE) bootLive();
  else if (store.get('onl-demo-auth')) afterLogin(null);
  else showAuth('');
  if (/[?&]debug\b/.test(location.search)) window.__onl = { goScene, scene: () => sceneId, openPrayers, SCENES, player: () => player, net, goTo, findPath, blocked, update: (dt, n) => update(dt, n), sfxTest: k => { actx = null; sfx(k); }, doPunch, setBall: (x, y, vx, vy) => { if (ball) Object.assign(ball, { x, y, vx, vy }); }, soccer: () => match && { score: match.score, rem: match.rem, phase: match.phase, ball: ball && [Math.round(ball.x), Math.round(ball.y)] }, chars: () => chars, near: () => near, sit, seatApproach, nearestCell, gw: () => [GW, GH, walk] };
  requestAnimationFrame(loop);
})();
