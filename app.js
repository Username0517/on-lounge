
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
  const sb = LIVE ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;

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
  function guitar(g, x, body, accent, bass) {
    const top = bass ? 50 : 56;
    P(g, x - 4, 93, 9, 1, '#121117'); P(g, x - 4, 92, 1, 2, '#121117'); P(g, x + 4, 92, 1, 2, '#121117'); P(g, x, 84, 1, 9, '#121117');
    P(g, x, top, 2, 26, '#121117'); P(g, x, top + 1, 1, 24, '#6b4a33'); P(g, x + 1, top + 1, 1, 24, '#d8c3a0');
    P(g, x - 1, top - 4, 4, 5, '#121117'); P(g, x, top - 3, 3, 3, bass ? '#3a2418' : '#e9e4da');
    pixCircle(g, x, 84, 5, '#121117'); pixCircle(g, x, 81, 4, '#121117'); pixCircle(g, x, 84, 4, body); pixCircle(g, x, 81, 3, body);
    P(g, x + 1, 79, 2, 8, accent); P(g, x - 2, 83, 3, 1, '#d8d4cc'); P(g, x - 2, 86, 3, 1, '#d8d4cc'); P(g, x + 3, 81, 1, 5, shade(body, 1.3));
  }
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
    { id: 'bass', label: '베이스', box: [49, 45, 11, 50], sortY: 95, obs: [[48, 84, 12, 11]], draw: g => guitar(g, 54, '#4a2c1c', '#b5702e', true) },
    { id: 'elec', label: '일렉기타', box: [61, 51, 11, 44], sortY: 95, obs: [[60, 84, 12, 11]], draw: g => guitar(g, 66, '#d84b3a', '#f4f1ea', false) },
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
    room3: { n: 'ROOM 3', sub: '세미나실' }, room4: { n: 'ROOM 4', sub: '라운지' }
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
    hall: { name: '복도', w: 160, h: 280, bounds: [22, 52, 138, 266], drawBg: bgHall, items: hallItems, seats: [],
      spawns: { sanctuary: [80, 58, 'down'], room1: [26, 100, 'right'], room2: [26, 200, 'right'], room3: [134, 100, 'left'], room4: [134, 200, 'left'] },
      spots: [{ id: 'toSanctuary', item: null, x: 80, y: 56, r: 14, ax: 80, ay: 4, hit: [62, 9, 36, 40], label: '본당으로 들어가기' }]
        .concat(HALL_DOORS.map(([id, x, y, right]) => ({ id: 'to-' + id, item: null, x: right ? x - 10 : x + 10, y, r: 12, ax: right ? x - 10 : x + 10, ay: y - 22, hit: right ? [x - 10, y - 16, 16, 32] : [x - 6, y - 16, 16, 32], label: `${ROOM_INFO[id].n} ${ROOM_INFO[id].sub} 들어가기`, room: id }))),
      labels: [{ x: 80, y: 2, t: '본당', align: 'center', count: 'sanctuary' }]
        .concat(HALL_DOORS.map(([id, x, y, right]) => ({ x: right ? x - 9 : x + 9, y: y + 18, t: ROOM_INFO[id].n, sub: ROOM_INFO[id].sub, align: right ? 'right' : 'left', count: id }))) },
    room1: { name: 'ROOM 1 · 회의실', w: 192, h: 176, bounds: [10, 48, 182, 162], drawBg: bgRoom1, items: room1Items, seats: r1Seats, spawns: { door: [96, 156, 'up'] }, spots: [exitSpot] },
    room2: { name: 'ROOM 2 · 탕비실', w: 192, h: 176, bounds: [10, 48, 182, 162], drawBg: bgRoom2, items: room2Items, seats: r2Seats, spawns: { door: [96, 156, 'up'] },
      spots: [exitSpot, { id: 'water', item: 'r2-water', x: 167, y: 70, r: 12, ax: 167, ay: 12, label: '물 한 잔 마시기' }, { id: 'coffee', item: 'r2-counter', x: 96, y: 68, r: 12, ax: 96, ay: 20, label: '커피 내리기' }] },
    room3: { name: 'ROOM 3 · 세미나실', w: 192, h: 176, bounds: [10, 48, 182, 162], drawBg: bgRoom3, items: room3Items, seats: r3Seats, spawns: { door: [96, 156, 'up'] }, spots: [exitSpot] },
    room4: { name: 'ROOM 4 · 라운지', w: 192, h: 176, bounds: [10, 48, 182, 162], drawBg: bgRoom4, items: room4Items, seats: r4Seats, spawns: { door: [96, 156, 'up'] }, spots: [exitSpot] }
  };
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
  function blocked(x, y) {
    const [x0, y0, x1, y1] = scene.bounds;
    if (x < x0 || x > x1 || y < y0 || y > y1) return true;
    for (const o of obstacles) if (x + 4 > o.x && x - 4 < o.x + o.w && y > o.y && y - 3 < o.y + o.h) return true;
    return false;
  }

  // ================= pathfinding =================
  const CS = 4;
  let GW = 0, GH = 0, walk = new Uint8Array(0);
  function rebuildWalk() {
    GW = Math.ceil(W / CS); GH = Math.ceil(H / CS);
    if (walk.length !== GW * GH) walk = new Uint8Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) walk[j * GW + i] = blocked(i * CS + 2, j * CS + 2) ? 0 : 1;
  }
  function nearestCell(p) {
    const ci = clamp(Math.floor(p.x / CS), 0, GW - 1), cj = clamp(Math.floor(p.y / CS), 0, GH - 1);
    if (walk[cj * GW + ci]) return cj * GW + ci;
    for (let rad = 1; rad < 14; rad++) for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < GW && j < GH && walk[j * GW + i]) return j * GW + i;
    }
    return -1;
  }
  function clearLine(a, c) {
    const d = Math.hypot(c.x - a.x, c.y - a.y), n = Math.ceil(d / 1.5);
    for (let k = 1; k <= n; k++) { const t = k / n; if (blocked(a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t)) return false; }
    return true;
  }
  function findPath(from, to) {
    const s = nearestCell(from), t = nearestCell(to);
    if (s < 0 || t < 0) return [];
    const prev = new Int32Array(GW * GH).fill(-1); prev[s] = s;
    const q = [s]; let head = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (head < q.length) {
      const cur = q[head++]; if (cur === t) break;
      const ci = cur % GW, cj = (cur - ci) / GW;
      for (const [di, dj] of dirs) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        const n = j * GW + i;
        if (!walk[n] || prev[n] !== -1) continue;
        if (di && dj && (!walk[cj * GW + i] || !walk[j * GW + ci])) continue;
        prev[n] = cur; q.push(n);
      }
    }
    if (prev[t] === -1) return [];
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
    bubble: null, emote: null, path: [], goal: null, onArrive: null, onFail: null, stuck: 0, noteAt: 0, playing: null, dnd: false });
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
    if (sp.id === 'toHall') return () => goScene('hall', sceneId);
    if (sp.id === 'toSanctuary') return () => goScene('sanctuary', 'door');
    if (sp.room) return () => goScene(sp.room, 'door');
    const RUN = {
      stand: () => openQt(), qr: () => openQr(), board: () => openModal('board'), prayer: () => openPrayers(),
      eq: () => { lightMode = (lightMode + 1) % LIGHTS.length; toast(`${LIGHTS[lightMode].n}으로 바꿨어요`); lobbySend('lights', { mode: lightMode }); },
      water: () => { doMotion(player, 'water'); toast('시원한 물 한 잔 마셨어요'); },
      coffee: () => { doMotion(player, 'coffee'); toast('커피 향이 퍼져요'); }
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
    standUp(ent); ent.path = []; ent.goal = null;
    if (!blocked(sp.sx, sp.sy)) { ent.x = sp.sx; ent.y = sp.sy; }
    ent.dir = sp.face; ent.moving = false;
    ent.action = 'play'; ent.actionUntil = Infinity; ent.actionT0 = performance.now(); ent.playing = sp.id;
    if (ent.isPlayer) toast(`${INSTRUMENTS[sp.id]} 연주 중이에요. 움직이면 멈춰요.`);
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
  }
  function nearestFreeChair(ent, maxD) {
    let best = null, bd = maxD;
    for (const c of chairs) { if (c.occ) continue; const a = seatApproach(c), d = Math.hypot(a.x - ent.x, a.y - ent.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  let near = null;
  function computeNear() {
    if (editMode) return null;
    if (player.seat) return { label: '일어나기', run: () => { standUp(player); if (!player.dnd) player.action = null; } };
    if (player.playing) return { label: '연주 멈추기', run: () => { player.action = null; player.playing = null; } };
    let best = null, bd = Infinity;
    for (const s of spots) { const d = Math.hypot(s.x - player.x, s.y - player.y); if (d < s.r && d < bd) { bd = d; best = s; } }
    if (best) return best;
    const c = nearestFreeChair(player, 9);
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
    let moved = false;
    if (!blocked(nx, ent.y)) { ent.x = nx; moved = true; }
    if (!blocked(ent.x, ny)) { ent.y = ny; moved = true; }
    if (Math.abs(vx) > Math.abs(vy)) ent.dir = vx > 0 ? 'right' : 'left'; else ent.dir = vy > 0 ? 'down' : 'up';
    ent.moving = moved;
    return moved;
  }
  function follow(ent, dt, mul) {
    if (!ent.path.length) { ent.moving = false; return; }
    const wp = ent.path[0], dx = wp.x - ent.x, dy = wp.y - ent.y;
    if (Math.hypot(dx, dy) < 1.2) {
      ent.path.shift();
      if (!ent.path.length) { ent.moving = false; ent.goal = null; const cb = ent.onArrive; ent.onArrive = null; ent.onFail = null; if (cb) cb(); }
      return;
    }
    const ok = step(ent, dx, dy, dt, mul);
    ent.stuck = ok ? 0 : ent.stuck + dt;
    if (ent.stuck > 0.4) { ent.path = []; ent.goal = null; ent.moving = false; ent.stuck = 0; const f = ent.onFail; ent.onArrive = null; ent.onFail = null; if (f) f(); }
  }
  function goTo(ent, target, onArrive, onFail) {
    if (ent.seat) standUp(ent);
    ent.action = null; ent.playing = null;
    ent.path = findPath(ent, target); ent.onArrive = onArrive || null; ent.onFail = onFail || null;
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
      step(player, vx, vy, dt);
    } else follow(player, dt, 1);
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
    const nn = computeNear();
    if ((nn && nn.label) !== (near && near.label)) { const btn = $('actBtn'); if (nn) { btn.textContent = nn.label; btn.hidden = false; } else btn.hidden = true; }
    near = nn;
    if (LIVE) netTick(now);
  }

  // ================= realtime (Supabase) =================
  const net = { ch: null, lobby: null, uid: null, ready: false, remotes: new Map(), sig: '', lastSend: 0, lastTrack: 0, dirty: true, counts: {}, total: 0 };
  const seatIdx = ent => ent.seat ? chairs.indexOf(ent.seat) : -1;
  function netSend(event, payload) { if (LIVE && net.ready && net.ch) net.ch.send({ type: 'broadcast', event, payload }); }
  function lobbySend(event, payload) { if (LIVE && net.lobby) net.lobby.send({ type: 'broadcast', event, payload }); }
  function lobbyTrack() { if (LIVE && net.lobby) net.lobby.track({ name: player.name, scene: sceneId, dnd: !!player.dnd }); }
  function myState() {
    return { id: net.uid, x: Math.round(player.x * 10) / 10, y: Math.round(player.y * 10) / 10, dir: player.dir, mv: player.moving, seat: seatIdx(player),
      act: player.action, play: player.playing, dnd: !!player.dnd, to: player.path.length ? player.goal : null };
  }
  function netTick(now) {
    if (!net.ready) return;
    const st = myState(), kb = player.moving && !player.path.length;
    const sig = [st.seat, st.act, st.play, st.dnd, st.to && st.to.join(','), st.mv, kb ? Math.round(player.x / 6) + ':' + Math.round(player.y / 6) : '', st.mv ? '' : st.x + ':' + st.y + ':' + st.dir].join('|');
    if (sig !== net.sig && now - net.lastSend > (kb ? 250 : 60)) { net.sig = sig; net.lastSend = now; net.ch.send({ type: 'broadcast', event: 'st', payload: st }); net.dirty = true; }
    if (net.dirty && !player.moving && now - net.lastTrack > 2000) { net.lastTrack = now; net.dirty = false; net.ch.track(Object.assign({ name: player.name, look: player.look }, st)); }
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
    if (act !== ent.action) { ent.action = act; ent.actionT0 = now; ent.actionUntil = !act ? 0 : (act === 'pray' || act === 'play') ? Infinity : act === 'jump' ? now + 650 : now + 2400; }
    ent.playing = p.play || null; ent.dnd = !!p.dnd;
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
      const metas = state[key], meta = metas && metas[metas.length - 1];
      if (!meta) continue;
      seen.add(key);
      let ent = net.remotes.get(key);
      if (!ent) { ent = addRemote(key, meta); applyRemote(ent, meta, now, true); }
      if (meta.name) ent.name = meta.name;
      if (validLook(meta.look)) ent.look = meta.look;
      ent.dnd = !!meta.dnd;
    }
    for (const key of [...net.remotes.keys()]) if (!seen.has(key)) removeRemote(key);
    renderPeople();
  }
  function onLobbySync() {
    const st = net.lobby.presenceState(), counts = {}; let total = 0;
    for (const k in st) { const m = st[k][st[k].length - 1]; if (!m) continue; total++; counts[m.scene] = (counts[m.scene] || 0) + 1; }
    net.counts = counts; net.total = total; renderPeople();
  }
  async function connectRealtime() {
    try { await sb.realtime.setAuth(); } catch (e) { /* older clients set auth automatically */ }
    const lob = sb.channel('lounge:lobby', { config: { private: true, broadcast: { self: false }, presence: { key: net.uid } } });
    net.lobby = lob;
    lob.on('presence', { event: 'sync' }, onLobbySync)
      .on('broadcast', { event: 'lights' }, ({ payload: p }) => { if (p && LIGHTS[p.mode]) lightMode = p.mode; })
      .on('broadcast', { event: 'content' }, () => { loadContent(); })
      .subscribe(status => { if (status === 'SUBSCRIBED') lobbyTrack(); });
    joinSceneChannel();
  }
  function joinSceneChannel() {
    if (net.ch) { const old = net.ch; net.ch = null; try { sb.removeChannel(old); } catch (e) {} }
    for (const id of [...net.remotes.keys()]) removeRemote(id);
    net.ready = false;
    const ch = sb.channel('lounge:' + sceneId, { config: { private: true, broadcast: { self: false }, presence: { key: net.uid } } });
    net.ch = ch;
    ch.on('presence', { event: 'sync' }, () => { if (net.ch === ch) onSync(); })
      .on('broadcast', { event: 'st' }, ({ payload: p }) => {
        if (net.ch !== ch || !p || p.id === net.uid) return;
        const ent = net.remotes.get(p.id) || addRemote(p.id, p);
        applyRemote(ent, p, performance.now(), false);
      })
      .on('broadcast', { event: 'chat' }, ({ payload: p }) => {
        if (net.ch !== ch || !p || p.id === net.uid) return;
        const ent = net.remotes.get(p.id);
        if (ent) ent.bubble = { text: p.text, until: performance.now() + 4500 };
        log(p.name, p.text, '');
      })
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
    data.reverse().forEach(m => log(m.name, m.body, m.user_id === net.uid ? 'me' : ''));
    if (data.length) log('', '── 여기까지 오늘 대화 ──', 'sys');
  }
  // chat resets every day at 00:00 China time (01:00 Korea): clear the log and bubbles for people who are still online
  let chatDay = null;
  setInterval(() => {
    const d = chinaYmd();
    if (chatDay === null) { chatDay = d; return; }
    if (d === chatDay) return;
    chatDay = d;
    logEl.innerHTML = '';
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
  function log(name, text, cls) {
    const li = document.createElement('li'); if (cls) li.className = cls;
    if (name) { const bEl = document.createElement('b'); bEl.textContent = name; li.appendChild(bEl); }
    li.appendChild(document.createTextNode(text)); logEl.appendChild(li);
    while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
    const pane = logEl.parentElement; pane.scrollTop = pane.scrollHeight;
  }
  function say(ent, text) { ent.bubble = { text, until: performance.now() + 4500 }; if (ent.scene === sceneId) log(ent.name, text, ent.isPlayer ? 'me' : ''); }
  $('chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('chatInput'), text = inp.value.trim().slice(0, 200);
    if (!text || player.dnd) return;
    say(player, text); inp.value = '';
    if (LIVE) {
      netSend('chat', { id: net.uid, name: player.name, text });
      sb.from('messages').insert({ name: player.name, body: text, scene: sceneId }).then(({ error }) => { if (error) toast('대화 기록을 저장하지 못했어요'); });
      return;
    }
  });
  document.querySelectorAll('[data-motion]').forEach(btn => btn.addEventListener('click', () => { if (!player.dnd) doMotion(player, btn.dataset.motion); }));


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
      if (qtView <= today) {
        const a = el('a', 'btn btn-gold', '우리말성경으로 본문 읽기');
        a.href = `https://www.duranno.com/qt/view/bible.asp?qtDate=${qtView}&d=w`;
        a.target = '_blank'; a.rel = 'noopener'; row.appendChild(a);
      }
      body.appendChild(row);
    } else body.appendChild(el('p', 'small', '관리자가 이번 달 본문표를 올리면 여기에 보여요.'));
    if (ref && qtView > today) body.appendChild(el('p', 'small', '본문 읽기 버튼은 그날 0시에 열려요.'));
    const nav = el('div', 'qt-nav');
    const prev = el('button', 'btn', '◀ 전날'), next = el('button', 'btn', '다음날 ▶'), now = el('button', 'btn', '오늘');
    [prev, now, next].forEach(b2 => { b2.type = 'button'; nav.appendChild(b2); });
    prev.addEventListener('click', () => { qtView = addDays(qtView, -1); renderQt(); });
    next.addEventListener('click', () => { qtView = addDays(qtView, 1); renderQt(); });
    now.addEventListener('click', () => { qtView = chinaYmd(); renderQt(); });
    now.hidden = qtView === today;
    body.appendChild(nav);
    body.appendChild(el('p', 'small', '매일 0시(중국 시간, 한국 시간 1시)에 그날 본문으로 바뀌어요. 읽기 버튼은 두란노 생명의삶 페이지를 우리말성경으로 열어요.'));
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
  const isTyping = () => { const t = document.activeElement; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
  const MOVE = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'];
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('modal').hidden) closeModal(); if (!$('qrPop').hidden) closeQr(); if (drag) endDrag(true); return; }
    if (isTyping() || !$('join').hidden || !$('creator').hidden) return;
    const k = e.key.toLowerCase();
    if (MOVE.includes(k)) { keys.add(k); e.preventDefault(); if (!$('modal').hidden) closeModal(); }
    else if ((k === 'e' || k === ' ') && near && $('modal').hidden) { near.run(); e.preventDefault(); }
    else if (k === 'enter') { $('chatInput').focus(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
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
    if (c) { if (c.occ === player) return; if (!c.occ) { goTo(player, seatApproach(c), () => sit(player, c)); return; } }
    const sp = spots.find(sp => g.x >= sp.hit[0] && g.x <= sp.hit[0] + sp.hit[2] && g.y >= sp.hit[1] && g.y <= sp.hit[1] + sp.hit[3]);
    if (sp) {
      const tgt = sp.sx != null ? { x: sp.sx, y: sp.sy } : { x: sp.x, y: sp.y };
      goTo(player, tgt, () => sp.run(), () => { if (Math.hypot(sp.x - player.x, sp.y - player.y) < sp.r) sp.run(); });
      return;
    }
    goTo(player, { x: g.x, y: g.y });
  });
  canvas.addEventListener('pointermove', e => {
    if (!editMode) return;
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
    const spr = sprite(c.look, c.dir, legs, arms, frame);
    const x = Math.round(c.x), y = Math.round(c.y);
    const jump = c.action === 'jump' ? Math.round(Math.sin(clamp((now - c.actionT0) / 650, 0, 1) * Math.PI) * 8) : 0;
    if (!c.seat) { b.fillStyle = 'rgba(60,30,10,.28)'; b.fillRect(x - 5, y - 1, 10, 2); b.fillRect(x - 3, y + 1, 6, 1); }
    b.drawImage(spr, x - 9, y - 22 + (c.seat ? 3 : 0) - jump);
  }
  function drawWorld(now) {
    b.drawImage(bg, 0, 0);
    if (player.path.length && !player.seat) {
      const t = player.path[player.path.length - 1], p = Math.floor(now / 220) % 2, tx = Math.round(t.x), ty = Math.round(t.y);
      b.fillStyle = '#ffcc4d';
      b.fillRect(tx - 3 - p, ty, 2, 1); b.fillRect(tx + 2 + p, ty, 2, 1); b.fillRect(tx, ty - 2 - p, 1, 1); b.fillRect(tx, ty + 1 + p, 1, 1);
    }
    const list = ITEMS.map(it => ({ y: it.sortY + off(it.id).dy, it }))
      .concat(chairs.map(c => ({ y: seatBackY(c), chair: c })))
      .concat(chars.map(c => ({ y: c.y, c })));
    list.sort((a, z) => a.y - z.y);
    for (const e of list) {
      if (e.it) { const o = off(e.it.id); b.save(); b.translate(o.dx, o.dy); e.it.draw(b); b.restore(); }
      else if (e.chair) drawSeatBack(b, e.chair);
      else drawChar(e.c, now);
    }
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
      if (Math.hypot(sp.x - player.x, sp.y - player.y) > 80) continue;
      const active = near === sp;
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
    if (t === 'chat') { const pane = logEl.parentElement; pane.scrollTop = pane.scrollHeight; }
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
  function closeCreator() { $('creator').hidden = true; }
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
    $('count').textContent = LIVE ? Math.max(net.total, 1) : entities.length;
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


  // ================= moving between scenes (본당 <-> 복도 <-> ROOM 1-4) =================
  let switching = false;
  function goScene(id, spawnKey) {
    if (switching || !SCENES[id] || id === sceneId) return;
    switching = true;
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
      $('sceneTag').textContent = scene.name;
      logEl.innerHTML = '';
      log('', id === 'hall' ? '복도로 나왔어요. 방에 들어가면 그 방 사람들끼리만 대화해요.' : `${scene.name}에 들어왔어요. 여기 대화는 이 방 사람들에게만 보여요.`, 'sys');
      if (LIVE) { lobbyTrack(); joinSceneChannel(); loadHistory(); }
      renderPeople();
      requestAnimationFrame(() => { fade.classList.remove('on'); switching = false; });
    }, 280);
  }

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
  async function loadPrayers() {
    if (LIVE) { const { data, error } = await sb.rpc('list_prayers'); prayers = error || !data ? [] : data; prayerSample = false; return !error; }
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
    const note = el('span', 'small', '누가 썼는지 아무도 볼 수 없어요. 관리자도요.');
    const sub = el('button', 'btn btn-gold', '익명으로 올리기'); sub.type = 'submit';
    row.append(note, sub); form.append(ta, row);
    const list = el('div', 'pr-list'); list.appendChild(el('p', 'small', '불러오는 중…'));
    body.append(form, list);
    $('modal').hidden = false; ta.focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = ta.value.trim();
      if (text.length < 2) { toast('기도제목을 조금 더 적어 주세요'); return; }
      sub.disabled = true;
      if (LIVE) {
        const { error } = await sb.rpc('add_prayer', { body: text });
        if (error) { toast(/limit/i.test(error.message) ? '하루에 5개까지 올릴 수 있어요' : '올리지 못했어요. 잠시 후 다시 해 주세요'); sub.disabled = false; return; }
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
      if (pr.mine || isAdmin) {
        const del = el('button', 'btn pr-del', '삭제'); del.type = 'button';
        del.addEventListener('click', async () => {
          if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = '정말 삭제'; return; }
          if (LIVE) { const { error } = await sb.rpc('delete_prayer', { pid: pr.id }); if (error) { toast('삭제하지 못했어요'); return; } await loadPrayers(); }
          else { prayers = prayers.filter(x => x !== pr); saveDemoPrayers(); }
          renderPrayers(list);
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
        if (chk.error || chk.data !== true) throw new Error('초대 코드가 맞지 않아요.');
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
      if (j.error) { $('crErr').textContent = /invite/i.test(j.error.message) ? '초대 코드가 맞지 않아요.' : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'; return false; }
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
    if (demoStarted) return; demoStarted = true;
    renderPeople();
    log('', '체험판이에요. 실제 사이트에서는 접속한 사람들이 여기 함께 보여요. 저장은 이 기기에만 돼요.', 'sys');
  }

  // ================= boot =================
  loadSceneArt(); refreshChars(); applyLayout(); resize(); setTab('chat'); showAdmin(); $('sceneTag').textContent = scene.name;
  $('modeTag').textContent = LIVE ? 'LIVE' : 'DEMO';
  if (window.matchMedia('(hover: none)').matches) $('hint').textContent = '바닥을 눌러 이동 · 의자를 누르면 앉아요 · 말풍선(…)이 뜬 곳을 눌러 살펴보기';
  if (store.get('onl-off') === '1') setDnd(true, true);
  if (LIVE) bootLive();
  else if (store.get('onl-demo-auth')) afterLogin(null);
  else showAuth('');
  if (/[?&]debug\b/.test(location.search)) window.__onl = { goScene, scene: () => sceneId, openPrayers };
  requestAnimationFrame(loop);
})();
