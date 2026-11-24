/*
 * ON-Lounge · 괴담 수집 (어두운 숲속 구멍 아래의 세계)
 *
 * 혼자 하는 추리·공포 이야기 모드. 챕터마다 잘 알려진 도시 괴담 하나를 바탕으로 우리만의 이야기를 새로 썼어요.
 *   제1장 나홀로 숨바꼭질 · 제2장 쿠네쿠네 · 제3장 원숭이 꿈 · 제4장 (준비 중)
 * 갑자기 튀어나오는 장면 없이, 단서를 모으고 숨고 피하는 게임이에요.
 * 진행은 이 기기(localStorage)에만 저장돼요. 서버로는 아무것도 보내지 않아요.
 *
 * 저택(mansion.js)의 그림·소리·충돌 도구(ONL_MANSION.kit)를 같이 써요. 그래서 index.html에서 mansion.js 다음에 불러와야 해요.
 */
window.ONL_TALES = (function () {
  'use strict';
  let O = window.ONL;
  const need = () => (O = O || window.ONL);
  const K = window.ONL_MANSION && window.ONL_MANSION.kit;
  if (!K) { console.error('tales.js: mansion.js must load first'); return { open() {}, close() {}, isOpen: () => false, rainLevel: () => 1 }; }
  const { tone, noise, box, FULL, BASE, OUT, TS, T, FLOORS, WALLS, paintRoom, objRect, solidOf, overlap, walkGrid, bfs, darkness, drawPerson, chaseMusic, ac, AU, tileAt, isDoorCh, P, seeded, el } = K;
  const VW = 256, VH = 192;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = a => a[Math.random() * a.length | 0];
  const now = () => performance.now();
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ================= sound =================
  const MY = {
    grass: () => { const k = (AU.alt = !AU.alt) ? 1.05 : 0.95; noise(0.06, 0.09, 1300 * k, 0.9); noise(0.04, 0.05, 500 * k, 1, 0.03); },
    metal: () => { const k = (AU.alt = !AU.alt) ? 1.04 : 0.96; tone(260 * k, 0.07, 'triangle', 0.12, 200 * k); noise(0.03, 0.08, 2600 * k, 3); },
    soft: () => { const k = (AU.alt = !AU.alt) ? 1.05 : 0.95; tone(150 * k, 0.06, 'sine', 0.12, 110 * k); noise(0.03, 0.05, 900 * k, 1.5); },
    squeak: v => { const k = v || 0.05; tone(1300, 0.09, 'square', k, 1750); tone(1700, 0.08, 'square', k * 0.7, 1250, 0.1); },
    giggle: v => { const k = v || 0.06; [720, 640, 760, 600, 700].forEach((f, i) => tone(f, 0.09, 'triangle', k, f * 0.9, i * 0.11)); },
    whisper: v => { const k = v || 0.08; for (let i = 0; i < 7; i++) noise(0.09, k * (0.5 + Math.random() * 0.5), 2600 + Math.random() * 1800, 2.5, i * 0.08); },
    static: v => { const k = v || 0.1; noise(1.2, k, 4800, 0.4); tone(15600, 1.2, 'sine', k * 0.15); },
    chime: () => { tone(784, 0.7, 'sine', 0.14); tone(1568, 0.5, 'sine', 0.03); tone(622.3, 1.1, 'sine', 0.14, 0, 0.55); tone(1244.5, 0.7, 'sine', 0.03, 0, 0.55); },
    match: () => { noise(0.18, 0.25, 3200, 1.2); noise(0.5, 0.07, 900, 0.6, 0.15); },
    fire: () => { for (let i = 0; i < 14; i++) noise(0.03, 0.1 + Math.random() * 0.12, 1500 + Math.random() * 2500, 4, i * 0.09 + Math.random() * 0.05); noise(1.6, 0.06, 400, 0.5); },
    bell: v => { const k = v || 0.09; tone(1568, 1.6, 'sine', k); tone(2349, 1.1, 'sine', k * 0.5); tone(3136, 0.6, 'sine', k * 0.25); },
    brake: () => { tone(2100, 1.6, 'sawtooth', 0.05, 1150); tone(2190, 1.6, 'sawtooth', 0.04, 1210); noise(1.8, 0.2, 2400, 0.8); },
    drip: v => { tone(1250, 0.09, 'sine', v || 0.06, 520); },
    knock: v => { const k = v || 0.2; for (let i = 0; i < 3; i++) { tone(110, 0.1, 'sine', k, 70, i * 0.28); noise(0.04, k * 0.5, 600, 1, i * 0.28); } },
    hum: v => { const k = v || 0.05; tone(196, 1.6, 'triangle', k, 207); tone(293.7, 1.6, 'sine', k * 0.5, 277.2, 0.2); },
    fall: () => { const c = ac(); if (!c) return; noise(1.1, 0.25, 900, 0.5); tone(500, 1.0, 'sine', 0.08, 90); tone(48, 0.5, 'sine', 0.5, 30, 1.05); noise(0.35, 0.35, 160, 0.7, 1.05); },
    soft_catch: () => { tone(110, 2.2, 'sine', 0.22, 55); tone(116, 2.2, 'sine', 0.16, 58); noise(1.6, 0.08, 600, 0.5); },
    page: () => { noise(0.14, 0.08, 3500, 1); noise(0.1, 0.05, 2500, 1, 0.12); },
    ring: () => { for (let i = 0; i < 4; i++) { tone(1320, 0.07, 'square', 0.035, 0, i * 0.1); tone(1660, 0.07, 'square', 0.025, 0, i * 0.1 + 0.05); } },
    creak: v => { const k = v || 0.05; tone(95, 0.5, 'sawtooth', k, 72); noise(0.4, k * 0.8, 300, 3); },
    clack: v => { const k = v || 0.12; tone(70, 0.09, 'sine', k * 1.4, 50); noise(0.05, k * 0.6, 1500, 2); tone(70, 0.09, 'sine', k * 1.2, 50, 0.16); noise(0.05, k * 0.5, 1500, 2, 0.16); }
  };
  function sfx(n, v) { try { if (MY[n]) MY[n](v); else K.sfx(n, v); } catch (e) {} }

  // background sound for each place, built from oscillators and noise; it sits in the same slot as the
  // mansion's music (AU.bgm) so the chase drone ducks it the same way
  function bgm(kind) {
    if (AU.bgm) { const b = AU.bgm; AU.bgm = null; clearTimeout(b.timer); try { b.g.gain.setTargetAtTime(0.0001, AU.ctx.currentTime, 0.5); } catch (e) {} setTimeout(() => { for (const n of b.nodes) try { n.stop(); } catch (e) {} }, 2500); }
    if (!kind) return;
    const c = ac(); if (!c) return;
    const g = c.createGain(); g.gain.value = 0.0001; g.connect(AU.master);
    const nodes = [], t = c.currentTime;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g);
    const drone = (f, ty, v, lfoR) => {
      const o = c.createOscillator(), og = c.createGain(); o.type = ty; o.frequency.value = f; og.gain.value = v;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = lfoR || 0.06 + Math.random() * 0.08; lg.gain.value = v * 0.6; lfo.connect(lg); lg.connect(og.gain);
      o.connect(og); og.connect(lp); o.start(t); lfo.start(t); nodes.push(o, lfo);
    };
    const bed = (freq, q, v, sweep) => {
      const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let br = 0;
      for (let i = 0; i < len; i++) { br = (br + (Math.random() * 2 - 1) * 0.02) * 0.998; d[i] = br * 6; }
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      if (sweep) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 0.07; lg.gain.value = sweep; l.connect(lg); lg.connect(f.frequency); l.start(t); nodes.push(l); }
      const sg = c.createGain(); sg.gain.value = v; s.connect(f); f.connect(sg); sg.connect(g); s.start(t); nodes.push(s);
    };
    let evt = () => {};
    if (kind === 'apt') {                 // an old fridge humming, a clock, the rain on the window, water somewhere
      drone(60, 'sine', 0.22, 0.03); drone(120, 'triangle', 0.05, 0.05); drone(87.3, 'sine', 0.08); bed(1800, 0.5, 0.35, 300);
      evt = () => { if (Math.random() < 0.5) sfx('drip', 0.03); if (Math.random() < 0.12) tone(41, 1.4, 'sine', 0.1, 36); if (Math.random() < 0.08) sfx('giggle', 0.012); };
    } else if (kind === 'field') {      // wet summer evening: frogs, wind across the rice, a low hum under everything
      drone(73.4, 'sine', 0.2); drone(110, 'triangle', 0.04); bed(600, 0.7, 0.55, 300);
      evt = () => { const n = 3 + (Math.random() * 6 | 0), f = 380 + Math.random() * 200; for (let i = 0; i < n; i++) noise(0.05, 0.04, f, 4, i * 0.13); if (Math.random() < 0.15) sfx('bell', 0.015); };
    } else if (kind === 'train') {      // the rumble of the rails, the wheels, now and then a long whistle far away
      drone(46, 'sawtooth', 0.12, 0.02); drone(92, 'sine', 0.06); bed(240, 0.6, 0.9, 80);
      let n = 0; evt = () => { sfx('clack', 0.06); if (++n % 9 === 0 && Math.random() < 0.5) { tone(523, 2.2, 'sine', 0.02, 515, 0.2); tone(659, 2.2, 'sine', 0.015, 650, 0.2); } };
    } else if (kind === 'woods') {
      drone(55, 'triangle', 0.26); drone(58.3, 'sine', 0.12); bed(500, 0.8, 0.5, 260);
      evt = () => { if (Math.random() < 0.25) sfx('whisper', 0.02); };
    }
    g.gain.setTargetAtTime(0.16, t, 2.5);
    const B = AU.bgm = { g, nodes, timer: 0 };
    const every = kind === 'train' ? 1150 : kind === 'apt' ? 3200 : 2600;
    const loop = () => { if (AU.bgm !== B) return; if (!AU.chase) try { evt(); } catch (e) {} B.timer = setTimeout(loop, every * (kind === 'train' ? 1 : 0.6 + Math.random() * 0.8)); };
    B.timer = setTimeout(loop, 1200);
  }
  function setSound(on) { K.setSound(on); if (on && open_) setTimeout(() => bgm(CH ? CH.music : 'woods'), 60); }

  // ================= new floors, walls and furniture =================
  Object.assign(FLOORS, {
    lino: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, (ty % 2) ? '#66563f' : '#6b5a43'); P(g, x, y + 15, 16, 1, '#4e4130'); P(g, x + ((tx * 5 + ty * 3) % 16), y, 1, 15, '#5a4b38'); if ((tx * 3 + ty) % 6 === 0) P(g, x + 6, y + 6, 4, 1, '#77654c'); },
    paddy: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, '#26332e'); for (let r = 1; r < 16; r += 5) for (let c = (r * 3 + tx) % 4; c < 16; c += 4) { P(g, x + c, y + r, 1, 3, '#4f6e34'); P(g, x + c + 1, y + r - 1, 1, 2, '#6a8a40'); } if ((tx + ty * 3) % 5 === 0) P(g, x + 3, y + 13, 5, 1, '#3e5450'); },
    dirt: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, (tx + ty) % 2 ? '#4a3e2f' : '#4f4232'); P(g, x + ((tx * 7 + ty * 3) % 14), y + ((tx + ty * 5) % 13), 2, 1, '#6a5a44'); P(g, x + ((tx * 3 + ty * 7) % 15), y + ((tx * 5 + ty) % 14), 1, 1, '#2e261c'); },
    train: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, '#3c3f47'); P(g, x, y, 16, 1, '#33363d'); if ((tx * 3 + ty) % 4 === 0) P(g, x + 5, y + 7, 2, 2, '#30323a'); },
    trainmid: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, '#3c3f47'); P(g, x, y + 7, 16, 2, '#56473a'); P(g, x, y, 16, 1, '#33363d'); }
  });
  Object.assign(WALLS, {
    apt: { face: '#6f6a60', line: '#666157', trim: '#34302b', base: '#43362c' },
    hanok: { face: '#7d7058', line: '#5a4a36', trim: '#2e2418', base: '#2e2418', boards: true },
    hedge: { face: '#1b2717', line: '#243320', trim: '#0d140b', base: '#111a0e' },
    train: { face: '#545862', line: '#4a4e58', trim: '#24262c', base: '#2c2e35', boards: true }
  });
  const def = (name, w, h, solid, draw, extra) => { T[name] = Object.assign({ w, h, solid, draw }, extra || {}); };
  // the cursed bear, drawn by hand in code until the AI art arrives: brown fur, a red stitched seam, one button eye
  function drawBearP(g, x, y, dir, t, o) {
    o = o || {};
    const sit = o.sit, mv = o.moving, rage = o.rage;
    let bx = Math.round(x) - 8, by = Math.round(y) - (sit ? 15 : 19);
    if (mv) { by -= Math.abs(Math.sin(t / 110)) * 2 | 0; bx += (Math.floor(t / 220) % 2) ? 1 : -1; }
    const tilt = rage ? (Math.floor(t / 90) % 3 - 1) : (o.tilt || 0);
    const FUR = '#7a5638', DK = '#5a3c26', LT = '#93694a', RED = '#b51d27';
    g.save(); if (o.alpha != null) g.globalAlpha = o.alpha;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(bx + 2, by + (sit ? 15 : 19), 12, 2);
    // legs and body
    if (sit) { P(g, bx + 1, by + 12, 5, 4, DK); P(g, bx + 10, by + 12, 5, 4, DK); P(g, bx + 2, by + 13, 3, 2, '#d8b48a'); P(g, bx + 11, by + 13, 3, 2, '#d8b48a'); }
    else { const s = mv ? (Math.floor(t / 160) % 2) : 0; P(g, bx + 3, by + 15 + s, 4, 4 - s, DK); P(g, bx + 9, by + 15 + (1 - s), 4, 3 + s, DK); }
    P(g, bx + 3, by + 8, 10, 8, OUT); P(g, bx + 4, by + 8, 8, 7, FUR); P(g, bx + 5, by + 9, 6, 1, LT);
    // arms (one hangs lower, as if the stuffing has gone)
    P(g, bx + 1, by + 9, 3, 5, DK); P(g, bx + 12, by + 10, 3, 6, DK);
    if (dir !== 'up') { for (let i = 0; i < 6; i += 2) P(g, bx + 7 + (i % 4 ? 1 : 0), by + 9 + i, 2, 1, RED); if (rage || o.spill) { P(g, bx + 8, by + 15, 1, 1, '#ece6d8'); P(g, bx + 6, by + 16, 1, 1, '#ece6d8'); } }
    // head
    const hx = bx + 1 + tilt, hy = by;
    P(g, hx + 1, hy - 1, 4, 4, OUT); P(g, hx + 10, hy - 1, 4, 4, OUT); P(g, hx + 2, hy, 2, 2, '#c99a7a'); P(g, hx + 11, hy, 2, 2, '#c99a7a');
    P(g, hx + 1, hy + 1, 13, 9, OUT); P(g, hx + 2, hy + 1, 11, 8, FUR); P(g, hx + 3, hy + 1, 9, 1, LT);
    if (dir !== 'up') {
      const fx = dir === 'left' ? -2 : dir === 'right' ? 2 : 0;
      P(g, hx + 5 + fx, hy + 5, 5, 3, '#d8b48a'); P(g, hx + 6 + fx, hy + 5, 3, 1, '#2a1a14');
      P(g, hx + 7 + fx, hy + 7, 1, 1, RED);
      // the left eye: a black button; the right one is torn out and sewn shut with red thread
      P(g, hx + 3 + fx, hy + 3, 2, 2, '#0d0b10'); if (Math.floor(t / 1700) % 5 !== 0) P(g, hx + 3 + fx, hy + 3, 1, 1, '#8a8a96');
      P(g, hx + 10 + fx, hy + 2, 1, 1, RED); P(g, hx + 11 + fx, hy + 3, 1, 1, RED); P(g, hx + 10 + fx, hy + 4, 1, 1, RED); P(g, hx + 11 + fx, hy + 2, 1, 1, RED); P(g, hx + 10 + fx, hy + 3, 1, 1, RED); P(g, hx + 11 + fx, hy + 4, 1, 1, RED);
      if (rage) { P(g, hx + 5 + fx, hy + 8, 5, 1, '#1a0a0c'); }
    } else { P(g, hx + 6, hy + 2, 3, 6, DK); for (let i = 0; i < 6; i += 2) P(g, hx + 7, hy + 2 + i, 1, 1, RED); }
    g.restore();
  }
  // the white thing in the rice field: thin, too tall, never still
  function drawKuneP(g, x, y, t, o) {
    o = o || {};
    const amp = o.amp == null ? 1 : o.amp, H = o.h || 30;
    g.save(); g.globalAlpha = (o.alpha == null ? 1 : o.alpha) * (0.85 + Math.sin(t / 70) * 0.08);
    const bx = Math.round(x), by = Math.round(y);
    for (let r = 0; r < H; r++) {
      const k = r / H, w = r < 5 ? 5 : r < 7 ? 3 : 3 + Math.round(Math.sin(k * 3.1) * 1.5);
      const off = Math.round(Math.sin(t / 150 + r / 3.2) * amp * (1.5 + Math.sin(k * Math.PI) * 3) + Math.sin(t / 47 + r) * amp * 0.6);
      const yy = by - H + r;
      P(g, bx - (w >> 1) + off - 1, yy, w + 2, 1, '#8f8d88'); P(g, bx - (w >> 1) + off, yy, w, 1, r < 5 ? '#fbfaf5' : '#efede6');
    }
    // arms that bend where arms do not bend
    for (const s of [-1, 1]) {
      let ax = bx + s * 2, ay = by - H + 9;
      for (let i = 0; i < 9; i++) { const a = Math.sin(t / 110 * (s > 0 ? 1.3 : 1) + i * 0.9 + s) * 1.4; ax += s * (i < 4 ? 1 : 0) + Math.round(a * amp); ay += i < 4 ? -1 : 1; P(g, ax, ay, 1, 1, '#efede6'); }
    }
    g.restore();
  }
  // the little conductors from the dream train: blue coats, caps, and monkey masks with a painted grin
  function drawSaruP(g, x, y, dir, t, o) {
    o = o || {};
    const n = o.single ? 1 : 3, pos = o.single ? [[0, 0]] : [[0, 0], [-9, -4], [8, -5]];
    g.save(); if (o.alpha != null) g.globalAlpha = o.alpha;
    pos.sort((a, z) => a[1] - z[1]);
    for (let i = 0; i < n; i++) {
      const bob = o.moving ? (Math.floor(t / 120 + i) % 2) : 0;
      const px = Math.round(x + pos[i][0]) - 4, py = Math.round(y + pos[i][1]) - 14 - bob;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px + 1, py + 14 + bob, 7, 1);
      P(g, px + 1, py + 7, 7, 7, OUT); P(g, px + 2, py + 7, 5, 6, '#1e2440'); P(g, px + 4, py + 8, 1, 4, '#c9a24a');
      P(g, px + 2, py + 13, 2, 1, '#0d0b10'); P(g, px + 5, py + 13, 2, 1, '#0d0b10');
      P(g, px, py + 1, 9, 7, OUT); P(g, px + 1, py + 2, 7, 5, '#c98a5a');
      if (dir !== 'up') { P(g, px + 2, py + 4, 5, 3, '#ecd0a8'); P(g, px + 2, py + 3, 1, 1, '#0d0b10'); P(g, px + 6, py + 3, 1, 1, '#0d0b10'); P(g, px + 2, py + 6, 5, 1, '#a0141c'); P(g, px + 1, py + 5, 1, 1, '#a0141c'); P(g, px + 7, py + 5, 1, 1, '#a0141c'); }
      P(g, px, py, 9, 2, '#1e2440'); P(g, px - 1, py + 1, 11, 1, '#141830'); P(g, px + 3, py, 3, 1, '#c9a24a');
      if (i === 0 && o.lamp) { P(g, px + 8, py + 8, 3, 4, '#c9a24a'); P(g, px + 9, py + 9, 1, 2, '#fff4c4'); }
    }
    g.restore();
  }
  // ---- the AI-drawn sprites (tales-art.js, loaded the first time the tales open) ----
  // bear.png: 14 frames of 36x36 — 0-2 facing down, 3-5 facing left, 6-7 facing up, 8-13 broken poses (head bent, twisted)
  // kune.png: 7 frames of 46x60, one wriggle. saru.png: 24x28, 5 columns (down, left, left 2, back-left, back) x 3 walk rows
  const ART = { img: {}, ready: false, loading: false, cbs: [] };
  let ENVK = 0;   // 0..1: how much the lights and the TV are acting up because something is near
  function loadArt(cb) {
    if (ART.ready) { if (cb) cb(); return; }
    if (cb) ART.cbs.push(cb);
    if (ART.loading) return;
    ART.loading = true;
    const finish = () => { ART.ready = true; const c = ART.cbs; ART.cbs = []; c.forEach(f => { try { f(); } catch (e) { console.error(e); } }); };
    const done = () => {
      const A = window.ONL_TALES_ART || {}, ks = Object.keys(A); let left = ks.length;
      if (!left) return finish();
      for (const k of ks) { const im = new Image(); im.onload = im.onerror = () => { if (--left === 0) finish(); }; im.src = A[k]; ART.img[k] = im; }
    };
    if (window.ONL_TALES_ART) return done();
    const sc = document.createElement('script'); sc.src = 'tales-art.js'; sc.onload = done; sc.onerror = finish; document.head.appendChild(sc);
  }
  const artOk = k => !!(ART.img[k] && ART.img[k].complete && ART.img[k].naturalWidth);
  const artUrl = k => (window.ONL_TALES_ART || {})[k] || '';
  const hash = n => { const v = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
  function spr(g, key, fw, fh, f, x, y, flip, alpha, sc) {
    const im = ART.img[key]; sc = sc || 1;
    const w = Math.round(fw * sc), h = Math.round(fh * sc);
    g.save(); if (alpha != null) g.globalAlpha *= alpha;
    if (flip) { g.translate(Math.round(x), 0); g.scale(-1, 1); g.drawImage(im, f * fw, 0, fw, fh, -(w >> 1), Math.round(y) - h, w, h); }
    else g.drawImage(im, f * fw, 0, fw, fh, Math.round(x) - (w >> 1), Math.round(y) - h, w, h);
    g.restore();
  }
  function shadow(g, x, y, w, a) { g.fillStyle = `rgba(0,0,0,${a || 0.35})`; g.beginPath(); g.ellipse(Math.round(x), Math.round(y), w, 2, 0, 0, 7); g.fill(); }
  // the bear: walks with a limp, now and then a frame where its head is bent the wrong way; frozen = only the head moves
  function drawBear(g, x, y, dir, t, o) {
    if (!artOk('bear')) return drawBearP(g, x, y, dir, t, o);
    o = o || {};
    const sc = o.sit ? 0.8 : 1;
    if (!o.sit) shadow(g, x, y, 8, 0.35 * (o.alpha == null ? 1 : o.alpha));
    const slot = Math.floor(t / 90) + (o.seed || 0);
    let f, flip = dir === 'right', jx = 0, jy = 0;
    const broke = !o.sit && !o.frozen && hash(slot) < (o.rage ? 0.13 : o.moving ? 0.05 : 0.025);
    if (o.sit) { f = hash(Math.floor(t / 110) + 77) < 0.025 ? 8 : 11; if (f === 8) jx = 1; }
    else if (o.frozen) { f = [9, 13, 10, 12][Math.floor(t / 230) % 4]; flip = hash(Math.floor(t / 460)) < 0.5; }
    else if (broke) { f = 8 + Math.floor(hash(slot * 7 + 1) * 6); flip = hash(slot * 3) < 0.5; jx = Math.round((hash(slot * 5) - 0.5) * 4); jy = -1; }
    else {
      const cyc = dir === 'up' ? [6, 7] : (dir === 'left' || dir === 'right') ? [3, 4, 3, 5] : [0, 1, 0, 2];
      f = o.moving ? cyc[Math.floor(t / (o.rage ? 120 : 175)) % cyc.length] : cyc[0];
      if (o.moving) jy = -(Math.floor(t / (o.rage ? 120 : 175)) % 2);
    }
    spr(g, 'bear', 36, 36, f, x + jx, y + 2 + jy, flip, o.alpha, sc);
  }
  // the white thing: one wriggle, but it skips frames and snaps sideways, and turns round now and then
  function drawKune(g, x, y, t, o) {
    if (!artOk('kune')) return drawKuneP(g, x, y, t, o);
    o = o || {};
    const sp = o.fast ? 95 : 150, slot = Math.floor(t / sp);
    let f = slot % 7, jx = 0;
    const snap = hash(slot + 31) < 0.14;
    if (snap) { f = (f + 3 + Math.floor(hash(slot) * 3)) % 7; jx = hash(slot * 9) < 0.5 ? -2 : 2; }
    const flip = hash(Math.floor(t / 2600) + 5) < 0.5;
    const a = (o.alpha == null ? 1 : o.alpha) * (0.86 + Math.sin(t / 70) * 0.08);
    const sc = o.scale || 1;
    shadow(g, x, y, 6 * sc, 0.25 * a);
    if (snap) spr(g, 'kune', 46, 60, (f + 4) % 7, x - jx * 2, y + 1, !flip, a * 0.22, sc);   // a trace where it just was
    spr(g, 'kune', 46, 60, f, x + jx, y + 2, flip, a, sc);
  }
  // the masked conductors: three of them, out of step; the two at the back always look at you
  function drawSaru(g, x, y, dir, t, o) {
    if (!artOk('saru')) return drawSaruP(g, x, y, dir, t, o);
    o = o || {};
    const pos = o.single ? [[0, 0]] : [[0, 0], [-10, -5], [9, -6]];
    const order_ = pos.map((p, i) => [p, i]).sort((a, z) => a[0][1] - z[0][1]);
    const colOf = d => d === 'up' ? [4, false] : d === 'left' ? [1, false] : d === 'right' ? [1, true] : [0, false];
    for (const [[px, py], i] of order_) {
      const d = i === 0 ? dir : (o.face || dir);
      let [col, flip] = colOf(d);
      const slot = Math.floor(t / 100) + i * 13;
      let row = o.moving ? Math.floor(t / 130 + i * 1.7) % 3 : 0, jy = 0;
      if (o.frozen) { col = Math.floor(t / 300 + i) % 2 ? 2 : 0; flip = (Math.floor(t / 600) + i) % 2 === 0; }
      else if (hash(slot) < (o.moving ? 0.06 : 0.03)) { col = 3; flip = !flip; jy = -2; }   // a head snaps round
      shadow(g, x + px, y + py, 5, 0.3 * (o.alpha == null ? 1 : o.alpha));
      spr(g, 'saru', 24, 28, row * 5 + col, x + px, y + py + 2 + jy - (o.moving ? (Math.floor(t / 130 + i) % 2) : 0), flip, o.alpha);
    }
  }
  function drawMonster(g, kind, x, y, dir, t, opt) {
    if (kind === 'bear') return drawBear(g, x, y, dir, t, opt);
    if (kind === 'kune') return drawKune(g, x, y, t, opt);
    if (kind === 'saru') return drawSaru(g, x, y, dir, t, opt);
  }
  // apartment
  def('tv', 2, 1, [1, 4, 30, 11], (g, x, y, o, t) => {
    box(g, x + 1, y + 8, 30, 8, '#3a2c24', '#4a382e'); box(g, x + 4, y - 7, 24, 16, '#2a2830', '#3a3842'); P(g, x + 6, y - 5, 17, 12, '#101216');
    if (o.on && ENVK > 0 && Math.random() < ENVK * 0.35) P(g, x + 6, y - 5, 17, 12, '#020203');
    else if (o.on) { for (let i = 0; i < 12; i++) P(g, x + 6, y - 5 + i, 17, 1, Math.random() < 0.5 ? '#9aa0a8' : '#5a6068'); for (let i = 0; i < 10; i++) P(g, x + 6 + (Math.random() * 16 | 0), y - 5 + (Math.random() * 11 | 0), 2, 1, '#e6eaf0'); }
    else P(g, x + 7, y - 4, 3, 1, '#2a2e36');
    P(g, x + 24, y - 4, 2, 2, o.on ? '#e04040' : '#4a2a2a'); P(g, x + 24, y, 2, 2, '#5a5860');
  }, { light: 40, lightIf: 'on' });
  def('sofa', 3, 1, [1, 2, 46, 13], (g, x, y) => { box(g, x + 1, y - 4, 46, 9, '#4a3a52', '#5a4a64'); box(g, x + 1, y + 4, 46, 11, '#55445e', '#66557a'); P(g, x + 16, y + 5, 1, 9, '#3a2e44'); P(g, x + 31, y + 5, 1, 9, '#3a2e44'); box(g, x - 1, y, 5, 14, '#3a2e44'); box(g, x + 44, y, 5, 14, '#3a2e44'); });
  def('teddy', 1, 1, null, (g, x, y, o, t) => drawBear(g, x + 8, y + 15, o.dir || 'down', t, { sit: true, tilt: o.tilt || 0, spill: o.spill }), { flat: false });
  def('calendar', 1, 1, null, (g, x, y, o) => { box(g, x + 3, y + 1, 10, 12, '#e8dcc2', '#f4ecda'); P(g, x + 3, y + 1, 10, 3, '#a02a30'); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) P(g, x + 4 + c * 2, y + 6 + r * 2, 1, 1, '#6a5a4a'); if (o.circle) P(g, x + 8, y + 8, 2, 2, '#c0202a'); }, { wall: true });
  def('window', 2, 1, null, (g, x, y, o, t) => { box(g, x + 3, y + 1, 26, 12, '#3a3a44', '#4a4a54'); P(g, x + 4, y + 2, 24, 10, '#0c1018'); P(g, x + 15, y + 2, 1, 10, '#3a3a44'); for (let i = 0; i < 5; i++) { const k = (t / 40 + i * 37) % 10 | 0; P(g, x + 5 + i * 5, y + 2 + k, 1, 2, 'rgba(150,170,200,.5)'); } if (o.face && Math.floor(t / 2600) % 4 === 0) { P(g, x + 20, y + 5, 4, 5, '#c9c4ba'); P(g, x + 21, y + 6, 1, 1, '#0d0b10'); P(g, x + 23, y + 6, 1, 1, '#0d0b10'); } }, { wall: true });
  def('shoerack', 2, 1, [1, 6, 30, 9], (g, x, y) => { box(g, x + 1, y + 4, 30, 11, '#4a382e', '#5a4636'); for (let i = 0; i < 3; i++) { P(g, x + 4 + i * 9, y + 6, 6, 3, ['#2a2a30', '#8a2a30', '#d8d8e0'][i]); P(g, x + 4 + i * 9, y + 10, 6, 3, ['#4a3a2a', '#2a2a30', '#5a6a8a'][i]); } });
  def('washer', 1, 1, FULL, (g, x, y, o) => { box(g, x, y - 3, 16, 18, '#d8d8e0', '#ececf2', '#a9a9b4'); P(g, x + 3, y + 1, 10, 10, '#5a5c62'); P(g, x + 4, y + 2, 8, 8, o.full ? '#7a6a8a' : '#2a2c32'); P(g, x + 2, y - 2, 4, 1, '#3a8a4a'); });
  def('kotatsu', 2, 2, [2, 6, 28, 20], (g, x, y) => { box(g, x + 2, y + 6, 28, 20, '#8a4a3a', '#a85a46', '#6a3a2e'); P(g, x + 6, y + 9, 20, 13, '#5d3b2c'); P(g, x + 6, y + 9, 20, 1, '#734a37'); });
  def('altar', 1, 1, [2, 4, 12, 11], (g, x, y, o, t) => { box(g, x + 1, y + 4, 14, 11, '#3a1c1c', '#4a2626'); P(g, x + 3, y + 1, 10, 4, '#e8dcc2'); P(g, x + 4, y + 2, 8, 1, '#c0202a'); if (o.lit) { P(g, x + 7, y - 4 + (Math.floor(t / 120) % 2), 2, 3, '#ffcf5a'); P(g, x + 7, y - 1, 2, 2, '#e8dcc2'); } }, { light: 34, lightIf: 'lit' });
  // countryside
  def('scarecrow', 1, 2, [5, 22, 6, 9], (g, x, y, o, t) => { const s = Math.sin(t / 700) > 0.6 ? 1 : 0; P(g, x + 7, y + 4, 2, 27, '#5a4230'); P(g, x, y + 10, 16, 2, '#5a4230'); box(g, x + 3, y + 9, 10, 10, '#6a5a8a', '#7a6a9a'); P(g, x + 4, y + 1 + s, 8, 8, '#c9b48a'); P(g, x + 3, y, 10, 2, '#8a6a3a'); P(g, x + 5, y + 4 + s, 1, 1, '#0d0b10'); P(g, x + 10, y + 4 + s, 1, 1, '#0d0b10'); P(g, x + 6, y + 6 + s, 4, 1, '#5a2020'); });
  def('well', 2, 2, [2, 8, 28, 20], (g, x, y) => { box(g, x + 2, y + 10, 28, 18, '#5a5660', '#6a6670'); P(g, x + 5, y + 12, 22, 8, '#0a0a10'); P(g, x + 3, y - 4, 2, 16, '#4a3428'); P(g, x + 27, y - 4, 2, 16, '#4a3428'); P(g, x + 1, y - 6, 30, 3, '#3a2a20'); P(g, x + 14, y - 3, 3, 9, '#7a6a4a'); });
  def('bigtree', 2, 2, [10, 22, 12, 9], (g, x, y, o, t) => { P(g, x + 12, y + 12, 8, 19, '#2e231c'); P(g, x + 14, y + 14, 2, 14, '#3a2c22'); for (const [cx, cy, r] of [[16, 6, 13], [7, 10, 8], [25, 10, 8], [16, -2, 9]]) { g.fillStyle = '#121c12'; g.beginPath(); g.arc(x + cx, y + cy, r, 0, 7); g.fill(); g.fillStyle = '#1a2a18'; g.beginPath(); g.arc(x + cx - 2, y + cy - 2, r - 3, 0, 7); g.fill(); } });
  def('fence', 1, 1, [0, 9, 16, 5], (g, x, y) => { P(g, x, y + 6, 16, 2, '#4a3a2c'); P(g, x, y + 11, 16, 2, '#4a3a2c'); P(g, x + 2, y + 3, 2, 12, '#3a2c22'); P(g, x + 11, y + 3, 2, 12, '#3a2c22'); });
  def('jangdok', 1, 1, [2, 5, 12, 10], (g, x, y, o) => { box(g, x + 2, y + 3, 12, 12, '#4a2c22', '#5c3a2c'); P(g, x + 4, y + 1, 8, 3, '#3a2218'); P(g, x + 3, y + 6, 10, 1, '#6a4434'); if (o.open) P(g, x + 5, y + 2, 6, 1, '#0d0b10'); });
  def('soban', 2, 1, [2, 6, 28, 8], (g, x, y, o) => { box(g, x + 2, y + 5, 28, 6, '#7a4a2a', '#8a5a36'); P(g, x + 4, y + 11, 2, 4, '#5a3420'); P(g, x + 26, y + 11, 2, 4, '#5a3420'); if (o.food) { P(g, x + 7, y + 4, 5, 3, '#e8dcc2'); P(g, x + 15, y + 4, 4, 3, '#c94a45'); P(g, x + 22, y + 4, 4, 3, '#4a6a3a'); } });
  def('futon', 2, 1, null, (g, x, y, o) => { P(g, x + 1, y + 2, 30, 13, '#2a2030'); P(g, x + 2, y + 3, 28, 11, o.c || '#6a5a8a'); P(g, x + 2, y + 3, 7, 11, '#d8d0bf'); if (o.who) { P(g, x + 3, y + 5, 5, 5, '#e0b890'); P(g, x + 3, y + 4, 5, 2, '#231a20'); } }, { flat: true });
  def('shrine', 1, 2, [1, 16, 14, 14], (g, x, y, o, t) => { for (const [dx, dy, w] of [[1, 24, 14], [2, 18, 12], [4, 12, 8], [5, 7, 6]]) box(g, x + dx, y + dy, w, 7, '#5a5660', '#6e6a74'); P(g, x + 3, y + 4, 10, 2, '#c94a45'); P(g, x + 7, y + 1, 2, 4, '#e8dcc2'); if (o.lit) P(g, x + 7, y - 3 + (Math.floor(t / 140) % 2), 2, 3, '#ffcf5a'); }, { light: 36, lightIf: 'lit' });
  def('lantern', 1, 1, [5, 10, 6, 5], (g, x, y, o, t) => { P(g, x + 7, y - 6, 2, 20, '#3a2c22'); box(g, x + 4, y - 10, 8, 9, '#8a2a24', '#a8382e'); P(g, x + 6, y - 8, 4, 5, o.out ? '#3a1a18' : '#ffcf8a'); }, { light: 54 });
  def('crop', 1, 1, [1, 4, 14, 11], (g, x, y, o, t) => { for (let i = 0; i < 4; i++) { const s = Math.round(Math.sin(t / 600 + x / 20 + i) * 1); P(g, x + 2 + i * 4 + s, y + 1, 1, 14, '#4f6e34'); P(g, x + 1 + i * 4 + s, y + 2, 2, 3, '#a89a4a'); } });
  // the dream train
  def('seat', 4, 1, [0, 4, 64, 11], (g, x, y, o) => { box(g, x, y + 2, 64, 13, '#7a2a30', '#8e3a40', '#5a1c22'); for (let i = 1; i < 4; i++) P(g, x + i * 16, y + 3, 1, 11, '#5a1c22'); P(g, x, y + 14, 64, 2, '#2a2c33'); });
  def('pole', 1, 1, [6, 10, 4, 4], (g, x, y) => { P(g, x + 7, y - 16, 2, 31, '#b9bcc4'); P(g, x + 7, y - 16, 1, 31, '#e0e2ea'); P(g, x + 6, y + 13, 4, 2, '#7a7c84'); });
  def('routemap', 2, 1, null, (g, x, y, o) => { box(g, x + 2, y + 1, 28, 11, '#e8e4d8', '#f4f0e6'); P(g, x + 4, y + 6, 24, 1, '#c0202a'); for (let i = 0; i < 6; i++) P(g, x + 4 + i * 5, y + 5, 2, 3, i === (o.at || 0) ? '#c0202a' : '#2a2a30'); }, { wall: true });
  def('rack', 4, 1, null, (g, x, y, o) => { P(g, x, y + 1, 64, 2, '#8a8c94'); for (let i = 0; i < 64; i += 6) P(g, x + i, y + 3, 1, 3, '#6a6c74'); if (o.bag) { box(g, x + 20, y - 5, 14, 7, '#4a3a2a', '#5a4a36'); P(g, x + 26, y - 6, 3, 1, '#2a2a30'); } }, { wall: true });
  def('tdoor', 1, 1, null, (g, x, y, o) => { P(g, x + 1, y, 14, 14, '#2a2c33'); P(g, x + 2, y + 1, 12, 13, o.cab ? '#3a3040' : '#4a4e58'); P(g, x + 4, y + 2, 8, 5, '#0c1018'); P(g, x + 7, y + 2, 1, 12, '#2a2c33'); if (o.cab) P(g, x + 5, y + 9, 6, 2, '#c0202a'); }, { wall: true });
  def('brake', 1, 1, [3, 6, 10, 9], (g, x, y, o) => { box(g, x + 3, y + 6, 10, 9, '#3a3c44', '#4a4c56'); P(g, x + 7, y - 4 + (o.pulled ? 6 : 0), 2, 11, '#8a8c94'); P(g, x + 5, y - 6 + (o.pulled ? 6 : 0), 6, 3, '#c0202a'); });
  def('console', 3, 1, FULL, (g, x, y, o, t) => { box(g, x, y, 48, 15, '#2a2c33', '#3a3c44'); for (let i = 0; i < 6; i++) P(g, x + 4 + i * 7, y + 4, 3, 2, Math.floor(t / 400 + i) % 3 ? '#3a8a4a' : '#c0202a'); P(g, x + 6, y + 9, 36, 3, '#14161c'); });
  def('ticket', 1, 1, null, (g, x, y) => { P(g, x + 5, y + 8, 7, 4, '#e8d8a8'); P(g, x + 6, y + 9, 3, 1, '#a02a30'); P(g, x + 10, y + 9, 1, 2, '#2a2a30'); }, { flat: true });
  def('lamp2', 1, 1, null, (g, x, y, o, t) => { P(g, x + 4, y + 2, 8, 3, '#d8d4c4'); if (!o.out && Math.random() > (o.flicker ? 0.25 : 0.01 + ENVK * 0.4)) P(g, x + 5, y + 3, 6, 1, '#fff8d8'); }, { wall: true, light: 46, lightIf: 'on' });

  // ================= the story engine =================
  const SAVE_KEY = 'onl_tales_v1', PSPEED = 70;
  const CHAPTERS = {};
  const CHMETA = [
    { id: 1, icon: '🧸', title: '나홀로 숨바꼭질', sub: '저주받은 곰인형' },
    { id: 2, icon: '🌾', title: '쿠네쿠네', sub: '논밭에서 흔들리는 하얀 것' },
    { id: 3, icon: '🚃', title: '원숭이 꿈', sub: '꿈속 열차의 안내 방송' },
    { id: 4, icon: '👺', title: '노오의 가면', sub: '오래된 가문의 저주' }
  ];
  let SV = { done: {}, runs: {} };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.done) SV = s; } catch (e) {}
  function storeSV() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) {} }
  let CH = null, ROOMS = {}, ITEMS = {}, ST = null;
  let room = null, roomId = '', solids = [], grid = null, objs = [], faces = [];
  const pl = { x: 0, y: 0, dir: 'down', moving: false, hidden: null, trail: [] };
  let mon = null, busy = 0, checkpoint = null, playStart = 0;
  let root = null, cv = null, g = null, dk = null, dkg = null, ui = {};
  let raf = 0, lastT = 0, open_ = false, onQuit = null, camX = 0, camY = 0, shake = 0, redFlash = 0, heartAt = 0, fadeA = 0, mode = 'off', cine = null;
  const keys = Object.create(null); let order = [], actQ = false, bagQ = false;
  const touch = { up: 0, down: 0, left: 0, right: 0 };
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const ME = () => (need() && O.name()) || '나';

  const has = id => ST.inv.includes(id);
  function give(id, quiet) { if (!has(id)) ST.inv.push(id); sfx('pick'); if (!quiet) note(`${ITEMS[id].i} ${ITEMS[id].n}을(를) 얻었다`); }
  function take(id) { ST.inv = ST.inv.filter(x => x !== id); }
  const ost = (rid, id) => (ST.obj[rid + ':' + id] = ST.obj[rid + ':' + id] || {});
  function herePos() { return pl.hidden ? [pl.hidden.x, pl.hidden.y] : [pl.x, pl.y]; }
  function saveNow() {
    if (!CH || !ST || ST.ended) return;
    try {
      ST.t += (now() - playStart) / 1000; playStart = now();
      const [x, y] = herePos(); ST.room = roomId || ST.room; ST.x = x; ST.y = y; ST.dir = pl.dir;
      SV.runs[CH.id] = JSON.parse(JSON.stringify(mon && !mon.gone && checkpoint ? checkpoint : ST)); storeSV();
    } catch (e) {}
  }
  function snapshot() { checkpoint = JSON.parse(JSON.stringify(ST)); const [x, y] = herePos(); checkpoint.room = roomId; checkpoint.x = x; checkpoint.y = y; checkpoint.dir = pl.dir; }
  function unstick() {
    if (!room || !blockedAt(pl.x, pl.y)) return;
    for (let r = 2; r <= 64; r += 2) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r;
      if (!blockedAt(x, y) && x > 4 && y > 4 && x < room.pw - 4 && y < room.ph - 4) { pl.x = x; pl.y = y; return; }
    }
    const [x, y] = spawnFor(roomId, Object.keys(room.doors || {})[0] || ''); pl.x = x; pl.y = y;
  }

  // ---- rooms ----
  function liveObjs(rid) {
    const R = ROOMS[rid];
    return R.objs.filter(o => (!o.showIf || ST.F[o.showIf]) && !(o.hideIf && ST.F[o.hideIf])).map(o => Object.assign({}, o, o.id ? ST.obj[rid + ':' + o.id] || {} : {}));
  }
  function doorOpen(R, ch) { const d = R.doors[ch]; if (!d || !d.to) return false; return !d.lock || !!ST.F[d.lock]; }
  function loadRoom(rid) {
    room = ROOMS[rid]; roomId = rid;
    if (!room.cv) paintRoom(room);
    objs = liveObjs(rid);
    solids = objs.map(o => solidOf(o)).filter(Boolean);
    grid = walkGrid(room, solids, () => true);
    faces = [];
    if (room.windows) for (let ty = 0; ty < room.map.length - 1; ty++) for (let tx = 0; tx < room.map[0].length; tx++) {
      const ch = room.map[ty][tx], below = tileAt(room, tx, ty + 1);
      if (ch === '#' && below !== '#' && !isDoorCh(below) && tx % 2 === 0) faces.push([tx * TS, ty * TS]);
    }
  }
  const refresh = () => loadRoom(roomId);
  function spawnFor(rid, back) {
    const R = ROOMS[rid];
    const ob = R.objs.find(o => o.id === back);
    if (ob) { const r = objRect(ob); if (ob.spawn) return [r.x + ob.spawn[0], r.y + ob.spawn[1], ob.spawn[2]]; return [r.x + r.w / 2, r.y + r.h + 10, 'down']; }
    for (let ty = 0; ty < R.map.length; ty++) for (let tx = 0; tx < R.map[0].length; tx++) if (R.map[ty][tx] === back) {
      for (const [dx, dy, dir] of [[0, 1, 'down'], [0, -1, 'up'], [1, 0, 'right'], [-1, 0, 'left']]) {
        const ch = tileAt(R, tx + dx, ty + dy);
        if (ch !== '#' && !isDoorCh(ch)) return [(tx + dx) * TS + 8, (ty + dy) * TS + (dy === 1 ? 10 : dy === -1 ? 12 : 11), dir];
      }
    }
    return [R.map[0].length * 8, R.map.length * 8, 'down'];
  }
  async function goRoom(rid, back, opt) {
    const R = ROOMS[rid];
    if (R.need && !has(R.need)) { await say([[null, R.needText || '너무 어두워서 한 발짝도 나아갈 수가 없다. 불빛이 필요해…']]); pushBack(); return; }
    busy++;
    sfx(opt && opt.quiet ? (room.step || CH.step || 'step') : (R.doorSfx || CH.doorSfx || 'door'));
    await fade(1, 160);
    const from = roomId;
    const [x, y, dir] = spawnFor(rid, back);
    loadRoom(rid); pl.x = x; pl.y = y; pl.dir = dir; pl.hidden = null; pl.trail = []; pl.auto = null; unstick();
    ST.room = rid;
    for (const n of Object.values(ST.npc || {})) if (n.follow) { n.room = rid; n.x = x; n.y = y; }
    camSnap();
    if (mon && !mon.gone && mon.mode === 'chase') monFollow(from, rid, back);
    await fade(0, 160);
    try { if (CH.onEnter) await CH.onEnter(rid, from); } catch (e) { console.error(e); }
    busy--;
    if (!mon || mon.gone) { snapshot(); saveNow(); }
  }
  function pushBack() { const d = DIRV[pl.dir]; pl.x -= d[0] * 6; pl.y -= d[1] * 6; }

  // ---- moving ----
  function feet(x, y) { return { x: x - 5, y: y - 5, w: 10, h: 5 }; }
  function blockedAt(x, y) {
    const f = feet(x, y);
    const tx0 = Math.floor(f.x / TS), tx1 = Math.floor((f.x + f.w - 0.01) / TS), ty0 = Math.floor(f.y / TS), ty1 = Math.floor((f.y + f.h - 0.01) / TS);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const ch = tileAt(room, tx, ty);
      if (ch === '#') return true;
      if (isDoorCh(ch) && !doorOpen(room, ch)) return { door: ch };
    }
    for (const s of solids) if (overlap(f, s)) return true;
    return false;
  }
  function inputDir() {
    const map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    for (let i = order.length - 1; i >= 0; i--) if (keys[order[i]] && map[order[i]]) return map[order[i]];
    for (const d of ['up', 'down', 'left', 'right']) if (touch[d]) return d;
    return null;
  }
  let stepAt = 0, bumpAt = 0;
  function movePlayer(dt, t) {
    if (!pl.hidden && blockedAt(pl.x, pl.y) === true) unstick();
    const d = (busy || pl.hidden) ? null : inputDir();
    if (d || busy || pl.hidden) pl.auto = null;
    if (!d && pl.auto) return autoStep(dt, t);
    pl.moving = !!d;
    if (!d) return;
    pl.dir = d;
    const v = DIRV[d], sp = PSPEED * dt * (ST.F.slow ? 0.7 : 1);
    let nx = pl.x + v[0] * sp, ny = pl.y + v[1] * sp;
    const b = blockedAt(nx, ny);
    if (b) {
      if (v[0] === 0) { for (const off of [3, -3, 6, -6]) if (!blockedAt(pl.x + off, ny)) { nx = pl.x + Math.sign(off) * Math.min(Math.abs(off), sp); ny = pl.y; break; } }
      else { for (const off of [3, -3, 6, -6]) if (!blockedAt(nx, pl.y + off)) { ny = pl.y + Math.sign(off) * Math.min(Math.abs(off), sp); nx = pl.x; break; } }
      if (blockedAt(nx, ny)) { if (b.door && t - bumpAt > 900) { bumpAt = t; tryDoorLetter(b.door); } pl.moving = false; return; }
    }
    pl.x = nx; pl.y = ny;
    afterStep(t);
  }
  function afterStep(t) {
    if (t - stepAt > 380) { stepAt = t; sfx(room.step || CH.step || 'step'); }
    pl.trail.unshift([pl.x, pl.y, pl.dir]); if (pl.trail.length > 90) pl.trail.length = 90;
    const tx = Math.floor(pl.x / TS), ty = Math.floor((pl.y - 3) / TS), ch = tileAt(room, tx, ty);
    if (isDoorCh(ch) && doorOpen(room, ch)) { const dd = room.doors[ch]; goRoom(dd.to, dd.back, dd.quiet ? { quiet: 1 } : null); }
  }
  // ---- tap / click to walk (and to look at what was tapped when you get there) ----
  function autoStep(dt, t) {
    const A = pl.auto, wp = A.path[0];
    if (!wp) { pl.auto = null; pl.moving = false; if (A.face) pl.dir = A.face; if (A.act) actQ = true; return; }
    const dx = wp[0] - pl.x, dy = wp[1] - pl.y, dist = Math.hypot(dx, dy);
    if (dist < 1.2) { A.path.shift(); return; }
    const sp = Math.min(dist, PSPEED * dt * (ST.F.slow ? 0.7 : 1));
    const nx = pl.x + dx / dist * sp, ny = pl.y + dy / dist * sp;
    pl.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    const b = blockedAt(nx, ny);
    if (b) {
      if (b.door) { pl.auto = null; pl.moving = false; if (t - bumpAt > 900) { bumpAt = t; tryDoorLetter(b.door); } return; }
      // try sliding along one axis
      if (Math.abs(nx - pl.x) > 0.01 && !blockedAt(nx, pl.y)) pl.x = nx; else if (Math.abs(ny - pl.y) > 0.01 && !blockedAt(pl.x, ny)) pl.y = ny;
    } else { pl.x = nx; pl.y = ny; }
    // no progress for a moment: stop (and if we were right next to the thing, look at it anyway)
    const nd = Math.hypot(wp[0] - pl.x, wp[1] - pl.y);
    if (nd < dist - 0.05) A.stuck = 0; else A.stuck = (A.stuck || 0) + dt;
    if (A.stuck > 0.35) { pl.auto = null; pl.moving = false; if (A.face && A.path.length <= 1) { pl.dir = A.face; if (A.act) actQ = true; } return; }
    pl.moving = true;
    afterStep(t);
  }
  function tapAt(ev) {
    if (dlgNext()) return;
    if (mode !== 'play' || ui.panel || busy || !room) return;
    if (pl.hidden) { leaveHide(); return; }
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const wx = (ev.clientX - r.left) / r.width * VW + camX, wy = (ev.clientY - r.top) / r.height * VH + camY;
    let face = null, act = false, goals = [];
    // a person?
    for (const [nm, q] of Object.entries(ST.npc || {})) {
      if (q.room !== roomId || q.gone || q.follow) continue;
      if (Math.abs(q.x - wx) < 10 && wy > q.y - 26 && wy < q.y + 3) { act = true; goals = [[q.x, q.y + 14, 'up'], [q.x, q.y - 13, 'down'], [q.x - 14, q.y, 'right'], [q.x + 14, q.y, 'left']]; break; }
    }
    // something to look at?
    if (!act) {
      let best = null, ba = 1e9;
      for (const o of objs) {
        if (!usable(o)) continue;
        const rr = objRect(o), d = T[o.t], h = d.wall ? rr.h + 8 : rr.h;
        if (wx >= rr.x - 3 && wx <= rr.x + rr.w + 3 && wy >= rr.y - (d.wall ? 0 : 10) && wy <= rr.y + h + 3 && rr.w * h < ba) { ba = rr.w * h; best = o; }
      }
      if (best) {
        const rr = objRect(best), cx = rr.x + rr.w / 2, wall = T[best.t].wall; act = true;
        goals = [[cx, rr.y + rr.h + 9, 'up']];
        if (!wall) goals.push([cx, rr.y - 3, 'down'], [rr.x - 6, rr.y + rr.h - 3, 'right'], [rr.x + rr.w + 6, rr.y + rr.h - 3, 'left']);
      }
    }
    if (!act) goals = [[wx, wy + 4, null]];
    // pick the goal with the shortest walk on the tile grid
    const sx = Math.floor(pl.x / TS), sy = Math.floor((pl.y - 4) / TS);
    let pick_ = null;
    for (let [gx, gy, f] of goals) {
      let tx = Math.floor(gx / TS), ty = Math.floor((gy - 4) / TS);
      const ch = tileAt(room, tx, ty);
      if (!act && (ch === '#' || !grid.grid[ty * grid.W + tx]) && !isDoorCh(ch)) {
        // tapped a wall or furniture: walk to the nearest open tile next to it
        let bd = 1e9, bt = null; for (const [ax, ay] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1]]) { const ux = tx + ax, uy = ty + ay; if (grid.grid[uy * grid.W + ux] && Math.hypot(ax, ay) < bd) { bd = Math.hypot(ax, ay); bt = [ux, uy]; } }
        if (!bt) continue; [tx, ty] = bt; gx = tx * TS + 8; gy = ty * TS + 11;
      }
      if (act && blockedAt(gx, gy)) continue;   // nowhere to stand on that side
      const path = (sx === tx && sy === ty) ? [] : bfs(grid, sx, sy, tx, ty);
      if (!path) continue;
      if (!pick_ || path.length < pick_.path.length) pick_ = { path, gx, gy, f };
    }
    if (!pick_) { if (act) note('거기까지 갈 수 없어요.'); return; }
    const pts = pick_.path.map(([cx, cy]) => [cx * TS + 8, cy * TS + 11]);
    if (pts.length) pts.pop();
    pts.push([clamp(pick_.gx, 6, room.pw - 6), clamp(pick_.gy, 8, room.ph - 4)]);
    pl.auto = { path: pts, face: pick_.f, act, mark: [pick_.gx, pick_.gy], t0: now() };
  }
  function moveFollowers() {
    let k = 0;
    for (const n of Object.values(ST.npc || {})) {
      if (!n.follow || n.room !== roomId) continue;
      k++;
      const p = pl.trail[Math.min(pl.trail.length - 1, k * 14)];
      if (!p) continue;
      n.moving = Math.hypot(p[0] - n.x, p[1] - n.y) > 0.5;
      n.x = p[0]; n.y = p[1]; n.dir = p[2];
    }
  }

  // ---- looking at things ----
  function facingPoint() { const v = DIRV[pl.dir]; return [pl.x + v[0] * 12, pl.y - 4 + v[1] * 12]; }
  function pickAt(fx, fy, ok) {
    let best = null, bd = 1e9;
    for (const o of objs) {
      if (!ok(o)) continue;
      const r = objRect(o), d = T[o.t];
      const rr = d.wall ? { x: r.x, y: r.y, w: r.w, h: r.h + 6 } : { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 };
      if (!(fx >= rr.x && fx <= rr.x + rr.w && fy >= rr.y && fy <= rr.y + rr.h)) continue;
      const dd = Math.hypot(fx - (rr.x + rr.w / 2), fy - (rr.y + rr.h / 2));
      if (dd < bd) { bd = dd; best = o; }
    }
    return best;
  }
  const usable = o => o.use || o.say || o.door;
  function npcAtPoint(fx, fy) { for (const [name, n] of Object.entries(ST.npc || {})) if (n.room === roomId && !n.gone && Math.hypot(n.x - fx, n.y - 4 - fy) < 13) return name; return null; }
  async function interact() {
    if (busy || pl.hidden) { if (pl.hidden && !busy) await leaveHide(); return; }
    if (CH.onAct && CH.onAct()) return;
    const [fx, fy] = facingPoint();
    const nm = npcAtPoint(fx, fy); if (nm) return run('talk' + nm, { name: nm });
    const best = pickAt(fx, fy, usable);
    if (best) {
      if (best.use) return run(best.use, { o: best });
      if (best.say) { busy++; try { await say((Array.isArray(best.say) ? best.say : [best.say]).map(s => [null, s])); } finally { busy--; } return; }
      if (best.door) return goRoom(best.door.to, best.door.back);
    }
    const ch = tileAt(room, Math.floor(fx / TS), Math.floor(fy / TS));
    if (isDoorCh(ch)) return tryDoorLetter(ch);
  }
  async function tryDoorLetter(ch) {
    const d = room.doors[ch]; if (!d) return;
    if (d.use) return run(d.use, {});
    if (d.lock && !ST.F[d.lock]) { if (d.lockUse) return run(d.lockUse, {}); sfx('locked'); return say([[null, d.lockText || '잠겨 있다.']]); }
  }
  const COMMON = {
    hide: ctx => hideOrLook(ctx.o, ctx.o.hideText || '안에 몸을 숨길 수 있을 것 같다.')
  };
  async function run(name, ctx) {
    const fn = CH.script[name] || COMMON[name];
    if (!fn) return say([[null, '특별한 건 없는 것 같다.']]);
    busy++;
    try { await fn(ctx || {}); } catch (e) { console.error(e); } finally { busy = Math.max(0, busy - 1); }
  }

  // ---- hiding ----
  async function hideOrLook(o, text) { const c = await choose(text, ['숨는다', '그만둔다']); if (c === 0) await enterHide(o); }
  async function enterHide(o) {
    const seen = !!(mon && !mon.gone && mon.room === roomId && mon.mode === 'chase' && Math.hypot(mon.x - pl.x, mon.y - pl.y) < 92);
    pl.hidden = { x: pl.x, y: pl.y, o, at: now(), seen };
    const r = objRect(o); pl.x = r.x + r.w / 2; pl.y = r.y + r.h - 2;
    sfx('hide'); note(o.hideNote || '숨었다… 숨을 죽이자. (확인·방향키·화면을 누르면 나와요)');
  }
  async function leaveHide() {
    if (!pl.hidden) return;
    pl.x = pl.hidden.x; pl.y = pl.hidden.y; pl.hidden = null; sfx('hide'); unstick();
  }

  // ================= the thing that looks for you =================
  // mode 'seek': it walks in and looks around; if it sees you it gives chase. mode 'chase': it comes straight for you.
  const MSPEED = { bear: 60, kune: 30, saru: 64 };
  function startChase(kind, x, y, secs, opt) {
    opt = opt || {};
    mon = { kind, room: roomId, x, y, dir: 'down', path: null, pathAt: 0, until: now() + secs * 1000, pending: null, gone: false, appearAt: now(), lostAt: 0, mode: opt.mode || 'chase', opt };
    if (opt.enterAfter) { mon.room = '(between)'; mon.pending = { room: roomId, back: opt.back, at: now() + opt.enterAfter }; }
    if (mon.mode === 'chase' && !opt.quiet) { chaseMusic(true); sfx('sting'); shake = 5; }
  }
  function endChase(quiet) {
    if (!mon) return;
    const was = mon; mon = null; chaseMusic(false);
    if (!quiet && was.mode === 'chase') note(CH.lostText || '…발소리가 멀어졌다.');
    if (was.opt.onEnd) was.opt.onEnd(was);
    snapshot(); saveNow();
  }
  function monFollow(fromRoom, toRoom, back) {
    if (!mon || mon.gone) return;
    const base = mon.pending ? 1400 : 900 + (mon.room === fromRoom ? Math.hypot(mon.x - pl.x, mon.y - pl.y) / MSPEED[mon.kind] * 1000 * 0.6 : 600);
    mon.pending = { room: toRoom, back, at: now() + clamp(base, 900, 3200) };
    mon.room = '(between)';
  }
  function fadeMon(t) { if (!mon.gone) { mon.gone = true; mon.fadeAt = t; } }
  function monStep(dt, t) {
    if (!mon) return;
    if (mon.pending && t >= mon.pending.at) {
      if (mon.pending.room === roomId) {
        const [x, y] = spawnFor(roomId, mon.pending.back);
        mon.x = x; mon.y = y; mon.room = roomId; mon.path = null; mon.appearAt = t; sfx(CH.doorSfx || 'door'); shake = 2;
        if (mon.opt.onArrive) mon.opt.onArrive();
      } else mon.room = mon.pending.room;
      mon.pending = null;
    }
    if (mon.room !== roomId) { if (t > mon.until && !mon.pending) endChase(true); return; }
    if (mon.gone) return;
    const dist = Math.hypot(mon.x - pl.x, mon.y - pl.y);
    // the white thing does not run and cannot be hidden from; it only comes closer
    if (mon.kind === 'kune') {
      if (t > mon.until) return fadeMon(t);
      if (t > (mon.humAt || 0)) { mon.humAt = t + 1700; sfx('hum', clamp(1 - dist / 200, 0.02, 1) * 0.06); }
      goToward(dt * (mon.opt.speed || 1), t, pl.x, pl.y);
      if (dist < 12) caught();
      return;
    }
    if (mon.mode === 'chase' && dist < 130 && t > heartAt) { heartAt = t + 450 + dist * 5; sfx('heart'); }
    if (mon.moving && t > (mon.stepAt || 0)) {
      const v = clamp(1 - dist / 240, 0.04, 1);
      if (mon.kind === 'bear') { mon.stepAt = t + 260 + Math.random() * 120; sfx('soft'); if (Math.random() < 0.18) sfx('squeak', v * 0.04); }
      else { mon.stepAt = t + 140 + Math.random() * 60; sfx('metal'); if (Math.random() < 0.06) sfx('giggle', v * 0.05); }
    }
    if (pl.hidden) {
      if (pl.hidden.seen) { goToward(dt, t, pl.hidden.x, pl.hidden.y); if (Math.hypot(mon.x - pl.x, mon.y - pl.y) < 20) return caught(); return; }
      if (!mon.lostAt) mon.lostAt = t;
      wander(dt, t);
      if (t - mon.lostAt > (mon.mode === 'seek' ? 4200 : 2800)) fadeMon(t);
      return;
    }
    mon.lostAt = 0;
    if (mon.mode === 'seek') {
      if (t - mon.appearAt > 700 && dist < (mon.opt.sight || 84)) {
        mon.mode = 'chase'; chaseMusic(true); sfx('sting'); shake = 5; note(mon.opt.spotted || '들켰다! 도망쳐!');
        mon.until = Math.max(mon.until, t + 15000);
      } else { if (t - mon.appearAt > 700) wander(dt, t); if (t > mon.until) fadeMon(t); return; }
    }
    if (t > mon.until && dist > 70) return fadeMon(t);
    if (t - mon.appearAt < 700) { mon.moving = false; return; }
    // now and then it stops dead for a moment and only its head moves; then it lunges to make up for it
    if (!mon.nextFreeze) mon.nextFreeze = t + 2600 + Math.random() * 2600;
    if (t > mon.nextFreeze && dist > 28) { mon.freezeUntil = t + 450 + Math.random() * 400; mon.nextFreeze = mon.freezeUntil + 3200 + Math.random() * 3200; mon.lungeUntil = mon.freezeUntil + 700; sfx('creak', 0.05); }
    if (t < (mon.freezeUntil || 0)) { mon.moving = false; return; }
    goToward(dt * (t < (mon.lungeUntil || 0) ? 1.4 : 1), t, pl.x, pl.y);
    if (Math.hypot(mon.x - pl.x, mon.y - pl.y) < 11) caught();
  }
  // which way to face the player from the monster
  const dirTo = (ax, ay, bx, by) => Math.abs(bx - ax) > Math.abs(by - ay) ? (bx > ax ? 'right' : 'left') : (by > ay ? 'down' : 'up');
  function monTrail(t) {
    if (!mon || mon.room !== roomId) return;
    mon.face = dirTo(mon.x, mon.y, pl.x, pl.y);
    mon.trail = mon.trail || [];
    if (mon.moving && t - (mon.trailAt || 0) > 70) { mon.trailAt = t; mon.trail.unshift({ x: mon.x, y: mon.y, dir: mon.dir }); if (mon.trail.length > 4) mon.trail.length = 4; }
    if (!mon.moving && mon.trail.length && t - (mon.trailAt || 0) > 200) mon.trail.pop();
  }
  function goToward(dt, t, tx, ty) {
    const sp = MSPEED[mon.kind] * dt;
    if (!mon.path || t - mon.pathAt > 280) {
      mon.pathAt = t;
      mon.path = bfs(grid, Math.floor(mon.x / TS), Math.floor((mon.y - 4) / TS), Math.floor(tx / TS), Math.floor((ty - 4) / TS)) || [];
    }
    let gx = tx, gy = ty;
    if (mon.path.length) { const [cx, cy] = mon.path[0]; gx = cx * TS + 8; gy = cy * TS + 11; if (Math.hypot(gx - mon.x, gy - mon.y) < 2) mon.path.shift(); if (mon.path.length === 0) { gx = tx; gy = ty; } }
    const dx = gx - mon.x, dy = gy - mon.y, d = Math.hypot(dx, dy);
    if (d > 0.01) { mon.x += dx / d * Math.min(sp, d); mon.y += dy / d * Math.min(sp, d); mon.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
    mon.moving = d > 0.5;
  }
  function wander(dt, t) {
    if (!mon.wto || t > mon.wtoAt) { mon.wtoAt = t + 1600; const ok = []; for (let i = 0; i < grid.grid.length; i++) if (grid.grid[i]) ok.push(i); const c = pick(ok); mon.wto = [(c % grid.W) * TS + 8, ((c / grid.W) | 0) * TS + 11]; mon.path = null; }
    goToward(dt * 0.55, t, mon.wto[0], mon.wto[1]);
  }
  // caught: no scream and no face in the screen; the light goes out slowly and the story says what happened
  async function caught(text) {
    if (busy > 50) return;
    busy += 100; pl.moving = false; if (mon) mon.caught = true;
    chaseMusic(false); sfx('soft_catch'); redFlash = 0.8;
    await fade(1, 1500);
    const msg = text || (CH.caughtText ? CH.caughtText(mon && mon.kind) : '…잡혔다.');
    const c = await choose(msg, ['마지막 저장 지점에서 다시', '챕터 목록으로'], 'over', CH.caughtArt);
    busy -= 100;
    if (c === 0) { restore(checkpoint); fade(0, 700); } else toMenu();
  }
  function restore(snap) {
    if (!snap) return;
    const played = ST.t + (now() - playStart) / 1000;
    ST = JSON.parse(JSON.stringify(snap)); ST.t = played; mon = null; chaseMusic(false); redFlash = 0;
    loadRoom(ST.room); pl.x = ST.x; pl.y = ST.y; pl.dir = ST.dir || 'down'; pl.hidden = null; pl.trail = []; pl.auto = null; unstick();
    for (const n of Object.values(ST.npc || {})) if (n.follow) { n.room = ST.room; n.x = pl.x; n.y = pl.y; }
    camSnap(); playStart = now(); if (CH.onRestore) CH.onRestore(); note('다시…');
  }

  // ================= drawing =================
  function camSnap() { const [cx, cy] = camTarget(); camX = cx; camY = cy; }
  function camTarget() {
    const W = room.pw, H = room.ph;
    const cx = W <= VW ? (W - VW) / 2 : clamp(pl.x - VW / 2, 0, W - VW);
    const cy = H <= VH ? (H - VH) / 2 : clamp(pl.y - 10 - VH / 2, 0, H - VH);
    return [cx, cy];
  }
  const lookOfNpc = name => (CH.npcLook && CH.npcLook[name]) || null;
  function draw(t) {
    if (!g || !room) return;
    const [tx, ty] = camTarget();
    camX += (tx - camX) * 0.18; camY += (ty - camY) * 0.18;
    const sx = shake ? (Math.random() * 2 - 1) * shake : 0, sy = shake ? (Math.random() * 2 - 1) * shake : 0;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#07060a'; g.fillRect(0, 0, VW, VH);
    const ox = Math.round(-camX + sx), oy = Math.round(-camY + sy);
    g.setTransform(1, 0, 0, 1, ox, oy);
    g.drawImage(room.cv, 0, 0);
    // train windows: the dark outside slides past
    for (const [fx, fy] of faces) {
      P(g, fx + 3, fy + 3, 26, 7, '#0a0e16'); P(g, fx + 2, fy + 2, 28, 1, '#2a2c33');
      const k = (t / 9 + fx * 3) % 260;
      if (k < 26) { P(g, fx + 3 + k, fy + 5, Math.min(3, 26 - k), 1, '#f4d48a'); }
      if (room.eyesOut && ((t / 37 + fx) % 900) < 40) { P(g, fx + 10, fy + 5, 1, 1, '#ff3b3b'); P(g, fx + 13, fy + 5, 1, 1, '#ff3b3b'); }
    }
    if (CH.under) CH.under(g, t);
    const list = [];
    for (const o of objs) { const d = T[o.t]; if (d.flat || d.wall) d.draw(g, o.x * TS, o.y * TS, o, t); else list.push({ y: (o.y + (o.h || d.h)) * TS - 1, o }); }
    for (const [name, n] of Object.entries(ST.npc || {})) if (n.room === roomId && !n.gone) list.push({ y: n.y, npc: name, n });
    if (!pl.hidden) list.push({ y: pl.y, me: true });
    if (mon && mon.room === roomId && !mon.pending) list.push({ y: mon.y, mon: true });
    if (CH.actors) for (const a of CH.actors(t)) list.push(a);
    list.sort((a, z) => a.y - z.y);
    for (const e of list) {
      if (e.o) T[e.o.t].draw(g, e.o.x * TS, e.o.y * TS, e.o, t);
      else if (e.me) drawPerson(g, O.lookOf(O.uid()), pl.x, pl.y, pl.dir, pl.moving, t);
      else if (e.npc) drawPerson(g, lookOfNpc(e.npc), e.n.x, e.n.y, e.n.dir || 'down', !!e.n.moving, t, e.n.ghost ? { alpha: 0.45 } : e.n.blue ? { blue: e.n.blue } : null);
      else if (e.mon) {
        let a = 1; if (mon.gone) a = clamp(1 - (t - mon.fadeAt) / 900, 0, 1); if (mon.gone && a <= 0) { endChase(); continue; }
        const dd = Math.hypot(mon.x - pl.x, mon.y - pl.y), frozen = t < (mon.freezeUntil || 0), lunge = t < (mon.lungeUntil || 0) && !frozen;
        // it keeps its face on you: when it stops, when it is searching close by
        const look = !pl.hidden && (frozen || (mon.mode === 'seek' && dd < 130)) && mon.face ? mon.face : mon.dir;
        // afterimages: a frame or two left behind where it was
        if (mon.trail && (lunge || (mon.mode === 'chase' && dd < 90))) mon.trail.slice(1, 3).forEach((p, i) => drawMonster(g, mon.kind, p.x, p.y, p.dir, t - 60 * (i + 1), { alpha: a * (i ? 0.08 : 0.17), moving: true, face: mon.face }));
        drawMonster(g, mon.kind, mon.x, mon.y, look, t, { alpha: a, moving: mon.moving, frozen, face: mon.face, rage: mon.mode === 'chase' && dd < 50, fast: mon.kind === 'kune' && dd < 80, amp: 1.4, lamp: true });
      } else if (e.draw) e.draw(g, t);
    }
    if (pl.auto && pl.auto.mark && !pl.auto.act) { const [mx, my] = pl.auto.mark, k = (now() - pl.auto.t0) / 400 % 1; g.strokeStyle = `rgba(255,240,200,${0.6 - k * 0.5})`; g.lineWidth = 1; g.beginPath(); g.ellipse(Math.round(mx), Math.round(my), 3 + k * 4, 1.5 + k * 2, 0, 0, 7); g.stroke(); }
    if (!pl.hidden && !dlg.on) drawBubbles(t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const lit = CH.lightItem && has(CH.lightItem);
    let amount = room.dark; if (room.need && !lit) amount = 0.985;
    // the lights and the TV act up while it is in the room, worse when it is close or has just come in
    const here = mon && mon.room === roomId && !mon.pending && !mon.gone;
    const near = here ? clamp(1 - Math.hypot(mon.x - pl.x, mon.y - pl.y) / (mon.kind === 'kune' ? 150 : 115), 0, 1) : 0;
    ENVK = here ? clamp(0.25 + near * 0.6 + (t - mon.appearAt < 900 ? 0.5 : 0), 0, 1) : Math.max(0, ENVK - 0.02);
    if (ENVK > 0 && Math.random() < ENVK * 0.14) amount = Math.min(0.97, amount + 0.22);
    const lights = [{ x: pl.x + ox, y: pl.y - 10 + oy, r: (lit ? 82 : 58) * (1 + Math.sin(t / 130) * 0.02 + (Math.random() < 0.01 ? -0.12 : 0)) }];
    if (lit && !pl.hidden) { const v = DIRV[pl.dir]; lights.push({ x: pl.x + v[0] * 34 + ox, y: pl.y - 10 + v[1] * 34 + oy, r: 46, a: 0.8 }); }
    for (const o of objs) { const d = T[o.t]; if (d.light && !o.out && !(d.lightIf && !o[d.lightIf])) { const r = objRect(o); lights.push({ x: r.x + r.w / 2 + ox, y: r.y + 2 + oy, r: d.light * (0.9 + Math.random() * 0.1), a: 0.85 }); } }
    if (room.lights) for (const [lx, ly, lr] of room.lights) lights.push({ x: lx + ox, y: ly + oy, r: lr, a: 0.7 });
    if (darkness(dk, dkg, amount, lights, VW, VH)) g.drawImage(dk, 0, 0);
    let red = redFlash; if (mon && mon.room === roomId && !mon.gone && mon.mode === 'chase') red = Math.max(red, clamp(1 - Math.hypot(mon.x - pl.x, mon.y - pl.y) / 120, 0, 1) * 0.3);
    if (red > 0.01) { const gr = g.createRadialGradient(VW / 2, VH / 2, 40, VW / 2, VH / 2, 170); gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(140,0,10,${red})`); g.fillStyle = gr; g.fillRect(0, 0, VW, VH); }
    if (pl.hidden) { g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, 0, VW, VH); g.fillStyle = 'rgba(0,0,0,.9)'; g.fillRect(0, 0, VW, 40); g.fillRect(0, VH - 40, VW, 40); g.fillStyle = 'rgba(255,240,200,.12)'; g.fillRect(VW / 2 - 1, 40, 2, VH - 80); }
    if (near > 0.05 && (mon.mode === 'chase' || mon.kind === 'kune')) warp(near);
    if (CH.screen) CH.screen(g, t, ox, oy);
    if (fadeA > 0) { g.fillStyle = `rgba(0,0,0,${fadeA})`; g.fillRect(0, 0, VW, VH); }
    shake = Math.max(0, shake - 0.6); redFlash = Math.max(0, redFlash - 0.01);
  }
  // the edges of the picture smear and tear as it gets close
  function warp(k) {
    g.save(); g.globalAlpha = 0.2 * k; const s = 1 + 0.06 * k; g.drawImage(cv, (VW - VW * s) / 2, (VH - VH * s) / 2, VW * s, VH * s); g.restore();
    for (let i = 0; i < Math.floor(10 * k); i++) {
      const y = Math.random() * VH | 0, h = 1 + (Math.random() * 3 | 0), w = 34 + (Math.random() * 20 | 0), dx = Math.round((Math.random() - 0.5) * 12 * k);
      if (Math.random() < 0.5) g.drawImage(cv, 0, y, w, h, dx, y, w, h); else g.drawImage(cv, VW - w, y, w, h, VW - w + dx, y, w, h);
    }
    if (k > 0.5) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (k - 0.5) * 0.25; g.drawImage(cv, 2, 0); g.restore(); }
  }
  function facingTarget() {
    const [fx, fy] = facingPoint();
    const nm = npcAtPoint(fx, fy); if (nm) return ST.npc[nm];
    return pickAt(fx, fy, usable);
  }
  function bubble(x, y, hot, t) {
    x = Math.round(x); y = Math.round(y - 9 + (Math.floor(t / 400) % 2));
    const fill = hot ? '#ffd23f' : '#f4efe4';
    P(g, x - 5, y, 11, 7, '#1a1420'); P(g, x - 4, y + 1, 9, 5, fill); P(g, x - 1, y + 7, 2, 1, '#1a1420'); P(g, x - 1, y + 6, 2, 1, fill);
    for (const k of [-2, 0, 2]) P(g, x + k, y + 3, 1, 1, '#2a2230');
  }
  function drawBubbles(t) {
    const hot = facingTarget(), R = 78;
    for (const o of objs) {
      if (!(o.use || o.say) || o.quiet) continue;
      const r = objRect(o), cx = r.x + r.w / 2;
      if (Math.hypot(cx - pl.x, r.y + r.h / 2 - pl.y) > R) continue;
      bubble(cx, r.y, o === hot, t);
    }
    for (const n of Object.values(ST.npc || {})) if (n.room === roomId && !n.gone && !n.follow && !n.mute && Math.hypot(n.x - pl.x, n.y - pl.y) < R) bubble(n.x, n.y - 22, n === hot, t);
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if (mode === 'cine') return drawCine(t);
    if (mode !== 'play' || !room) return drawIdle(t);
    if (actQ) { actQ = false; if (!dlg.on && !panelOn()) interact(); }
    if (bagQ) { bagQ = false; if (!busy) openBag(); }
    movePlayer(dt, t); moveFollowers();
    if (!dlg.on && !panelOn()) { monStep(dt, t); monTrail(t); if (CH.tick) try { CH.tick(dt, t); } catch (e) { console.error(e); } }
    draw(t);
  }
  function fade(to, ms) { return new Promise(res => { const from = fadeA, t0 = now(); const step = () => { const k = clamp((now() - t0) / ms, 0, 1); fadeA = lerp(from, to, k); if (k < 1) requestAnimationFrame(step); else res(); }; step(); }); }

  // ================= talking, choosing, notes =================
  const dlg = { on: false, resolve: null, full: '', shown: 0, timer: 0 };
  function say(lines) {
    return new Promise(async res => {
      busy++;
      for (const ln of lines) { const [name, text] = Array.isArray(ln) ? ln : [null, ln]; await sayOne(name, text); }
      busy--; res();
    });
  }
  let dlgChain = Promise.resolve();
  function sayOne(name, text) { const p = dlgChain.then(() => showLine(name, text)); dlgChain = p.catch(() => {}); return p; }
  function showLine(name, text) {
    return new Promise(res => {
      if (!open_ || !ui.dlg) return res();
      dlg.on = true; dlg.full = text; dlg.shown = 0; dlg.resolve = res;
      ui.dlg.hidden = false; ui.dlgName.hidden = !name; ui.dlgName.textContent = name || '';
      ui.dlg.classList.toggle('narr', !name);
      ui.dlgText.textContent = '';
      clearInterval(dlg.timer);
      dlg.timer = setInterval(() => { dlg.shown = Math.min(dlg.full.length, dlg.shown + 1); ui.dlgText.textContent = dlg.full.slice(0, dlg.shown); if (dlg.shown >= dlg.full.length) clearInterval(dlg.timer); }, 28);
    });
  }
  function dlgNext() {
    if (!dlg.on) return false;
    if (dlg.shown < dlg.full.length) { dlg.shown = dlg.full.length; ui.dlgText.textContent = dlg.full; clearInterval(dlg.timer); return true; }
    dlg.on = false; ui.dlg.hidden = true; const r = dlg.resolve; dlg.resolve = null; if (r) r(); return true;
  }
  function choose(text, opts, kind, img) {
    return new Promise(res => {
      busy++;
      const p = panel(kind === 'over' ? 'hr-over' : 'hr-ask');
      if (img && artUrl(img)) { const im = el('img', 'tl-cut'); im.src = artUrl(img); im.alt = ''; p.appendChild(im); }
      p.appendChild(el('p', 'hr-q', text));
      opts.forEach((o, i) => { const b = el('button', 'btn' + (i === 0 ? ' btn-gold' : ''), o); b.type = 'button'; b.addEventListener('click', () => { closePanel(); busy--; res(i); }); p.appendChild(b); });
      setTimeout(() => { const b = p.querySelector('button'); if (b) try { b.focus({ preventScroll: true }); } catch (e) {} }, 30);
    });
  }
  let noteT = 0;
  function note(text, ms) { if (!ui.note) return; ui.note.textContent = text; ui.note.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { ui.note.hidden = true; }, ms || 2600); }
  function panel(cls) { closePanel(); const p = el('div', 'hr-panel ' + (cls || '')); ui.stage.appendChild(p); ui.panel = p; return p; }
  function closePanel() { if (ui.panel) { ui.panel.remove(); ui.panel = null; } }
  const panelOn = () => !!ui.panel;
  // a still picture that fades in slowly over the story (never sudden); any key or tap goes on
  function showCG(key, caption) {
    return new Promise(res => {
      if (!artUrl(key)) return res();
      busy++;
      const p = panel('tl-cg');
      const im = el('img', 'tl-cgimg'); im.src = artUrl(key); im.alt = ''; p.appendChild(im);
      if (caption) p.appendChild(el('p', 'tl-cgcap', caption));
      let ok = false;
      const done = () => { if (!ok) return; closePanel(); busy = Math.max(0, busy - 1); res(); };
      setTimeout(() => { ok = true; p.classList.add('ready'); }, 1400);
      p.addEventListener('click', done); p._enter = done; p._close = done;
    });
  }
  function showNote(id) { sfx('page'); return say([[null, ITEMS[id].d]]); }

  // ---- the bag ----
  function openBag() {
    if (mode !== 'play') return;
    busy++;
    const p = panel('hr-bag');
    p.appendChild(el('h3', '', '🎒 가방'));
    if (!ST.inv.length) p.appendChild(el('p', 'hr-empty', '아직 아무것도 없다.'));
    const list = el('div', 'hr-items'); p.appendChild(list);
    const desc = el('p', 'hr-desc', ST.inv.length ? '물건을 누르면 자세히 볼 수 있어요.' : '');
    for (const id of ST.inv) {
      const it = ITEMS[id]; if (!it) continue;
      const b = el('button', 'hr-item', `${it.i} ${it.n}`); b.type = 'button';
      b.addEventListener('click', () => { desc.textContent = it.d; list.querySelectorAll('.hr-item').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
      list.appendChild(b);
    }
    p.appendChild(desc);
    if (CH.goal) p.appendChild(el('p', 'tl-goal', '📌 ' + CH.goal()));
    const row = el('div', 'hr-row');
    const snd = el('button', 'btn', AU.on ? '🔊 소리 끄기' : '🔇 소리 켜기'); snd.type = 'button'; snd.addEventListener('click', () => { setSound(!AU.on); snd.textContent = AU.on ? '🔊 소리 끄기' : '🔇 소리 켜기'; });
    const x = el('button', 'btn btn-gold', '닫기'); x.type = 'button'; x.addEventListener('click', () => { closePanel(); busy--; });
    const hp = el('button', 'btn', '📜 게임 방법'); hp.type = 'button'; hp.addEventListener('click', () => { closePanel(); busy--; showGuide(); });
    row.append(hp, snd, x); p.appendChild(row);
    p._close = () => { closePanel(); busy--; };
  }
  const GUIDE = [
    ['🎮', '움직이기', '방향키·WASD로 걸어요. 화면을 클릭(폰은 터치)하면 그 자리로 걸어가고, 말풍선이 뜬 물건이나 사람을 누르면 가서 살펴봐요. 폰은 왼쪽 아래 패드도 돼요.'],
    ['👀', '살펴보기', '스페이스·엔터(폰은 확인 버튼)로 바라보는 것을 살펴봐요. 「…」 말풍선이 뜬 것만 살펴볼 수 있고, 바라보는 것은 노랗게 바뀌어요.'],
    ['🎒', '가방', 'X 키(폰은 가방 버튼). 모은 단서를 다시 읽고, 지금 해야 할 일(📌)도 볼 수 있어요.'],
    ['🔎', '추리', '퍼즐의 답은 쪽지·달력·사진·방송 같은 단서 속에 있어요. 막히면 가방의 단서를 다시 읽어 보세요.'],
    ['🫣', '숨기', '옷장·침대 밑처럼 숨을 수 있는 곳에서 살펴보기를 누르면 숨어요. 들키기 전에 숨어야 해요. 다시 누르면 나와요.'],
    ['💓', '가까이 왔다는 신호', '심장 소리가 빨라지고 화면 가장자리가 붉어지면 바로 근처에 있다는 뜻이에요.'],
    ['💾', '저장', '자동으로 저장돼요. 잡히면 마지막 저장 지점부터 다시 해요. 나가도 다음에 이어할 수 있어요.']
  ];
  function showGuide(extra) {
    return new Promise(res => {
      busy++;
      const p = panel('hr-guide');
      p.appendChild(el('h3', '', '📜 게임 방법'));
      const list = el('div', 'hr-guide-list'); p.appendChild(list);
      for (const [ic, h, b] of GUIDE.concat(extra || (CH && CH.guide) || [])) { const row = el('div', 'hr-guide-row'); row.append(el('span', 'hr-guide-ic', ic), el('div', '', '')); row.lastChild.append(el('b', '', h), el('span', '', ' ' + b)); list.appendChild(row); }
      const x = el('button', 'btn btn-gold', '알겠어요'); x.type = 'button';
      const done = () => { closePanel(); busy = Math.max(0, busy - 1); res(); };
      x.addEventListener('click', done); p.appendChild(x);
      p._close = done; p._enter = done;
      setTimeout(() => { try { x.focus({ preventScroll: true }); } catch (e) {} }, 50);
    });
  }

  // ---- puzzles ----
  function dialPuzzle(title, hint, answer) {
    return new Promise(res => {
      busy++;
      const p = panel('hr-dial');
      p.appendChild(el('h3', '', title)); p.appendChild(el('p', 'hr-desc', hint));
      const row = el('div', 'hr-dials'); p.appendChild(row);
      const v = answer.split('').map(() => 0);
      v.forEach((_, i) => {
        const col = el('div', 'hr-dialcol');
        const up = el('button', 'btn', '▲'), num = el('b', 'hr-num', '0'), dn = el('button', 'btn', '▼'); up.type = dn.type = 'button';
        up.addEventListener('click', () => { v[i] = (v[i] + 1) % 10; num.textContent = v[i]; sfx('tick'); });
        dn.addEventListener('click', () => { v[i] = (v[i] + 9) % 10; num.textContent = v[i]; sfx('tick'); });
        col.append(up, num, dn); row.appendChild(col);
      });
      const r2 = el('div', 'hr-row');
      const ok = el('button', 'btn btn-gold', '확인'); ok.type = 'button';
      ok.addEventListener('click', () => { if (v.join('') === answer) { closePanel(); busy--; res(true); } else { sfx('locked'); note('…틀린 것 같다.'); } });
      const x = el('button', 'btn', '그만두기'); x.type = 'button'; x.addEventListener('click', () => { closePanel(); busy--; res(false); });
      r2.append(ok, x); p.appendChild(r2);
      p._close = () => { closePanel(); busy--; res(false); };
    });
  }
  // pick things in the right order; true = right, false = wrong, null = gave up
  function orderPuzzle(title, desc, opts, answer) {
    return new Promise(res => {
      busy++;
      const p = panel('hr-dial tl-order');
      p.appendChild(el('h3', '', title)); p.appendChild(el('p', 'hr-desc', desc));
      const shown = el('ol', 'tl-seq'); p.appendChild(shown);
      const grid_ = el('div', 'tl-opts'); p.appendChild(grid_);
      let got = [];
      const paint = () => { shown.innerHTML = ''; for (const i of got) shown.appendChild(el('li', '', opts[i])); grid_.querySelectorAll('button').forEach((b, i) => { b.disabled = got.includes(i); }); };
      opts.forEach((o, i) => { const b = el('button', 'btn', o); b.type = 'button'; b.addEventListener('click', () => { if (got.includes(i)) return; got.push(i); sfx('tick'); paint(); if (got.length === answer.length) { const ok = got.every((x, k) => x === answer[k]); setTimeout(() => { closePanel(); busy--; res(ok); }, 450); } }); grid_.appendChild(b); });
      const r2 = el('div', 'hr-row');
      const clr = el('button', 'btn', '처음부터'); clr.type = 'button'; clr.addEventListener('click', () => { got = []; paint(); });
      const x = el('button', 'btn', '그만두기'); x.type = 'button'; x.addEventListener('click', () => { closePanel(); busy--; res(null); });
      r2.append(clr, x); p.appendChild(r2);
      p._close = () => { closePanel(); busy--; res(null); };
    });
  }
  // type a word (Korean); answers compared without spaces
  function wordPuzzle(title, desc, answers) {
    return new Promise(res => {
      busy++;
      const p = panel('hr-dial');
      p.appendChild(el('h3', '', title)); p.appendChild(el('p', 'hr-desc', desc));
      const inp = el('input', 'tl-input'); inp.type = 'text'; inp.maxLength = 20; inp.placeholder = '여기에 적어요'; p.appendChild(inp);
      const r2 = el('div', 'hr-row');
      const ok = el('button', 'btn btn-gold', '확인'); ok.type = 'button';
      const check = () => { const v = inp.value.replace(/\s+/g, ''); if (answers.some(a => a.replace(/\s+/g, '') === v)) { closePanel(); busy--; res(true); } else { sfx('locked'); note('…아무 일도 일어나지 않는다.'); } };
      ok.addEventListener('click', check); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } e.stopPropagation(); });
      const x = el('button', 'btn', '그만두기'); x.type = 'button'; x.addEventListener('click', () => { closePanel(); busy--; res(false); });
      r2.append(ok, x); p.appendChild(r2);
      p._close = () => { closePanel(); busy--; res(false); };
      setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
    });
  }
  const npcAt = (name, rid, tx, ty, dir) => { const n = ST.npc[name]; n.room = rid; n.x = tx * TS + 8; n.y = ty * TS + 10; n.dir = dir || 'down'; n.follow = false; n.gone = false; };
  const npcGone = name => { const n = ST.npc[name]; n.room = '(gone)'; n.follow = false; };
  function farSpot(d) {
    let best = null, bd = 1e9;
    for (let i = 0; i < grid.grid.length; i++) {
      if (!grid.grid[i]) continue;
      const x = (i % grid.W) * TS + 8, y = ((i / grid.W) | 0) * TS + 11, e = Math.abs(Math.hypot(x - pl.x, y - pl.y) - d);
      if (e < bd) { bd = e; best = [x, y]; }
    }
    return best || [pl.x, pl.y];
  }
  // the doorway of this room farthest from you, to walk in through
  function farDoor() {
    let best = null, bd = -1;
    for (const ch of Object.keys(room.doors || {})) { if (!room.doors[ch].to) continue; const [x, y] = spawnFor(roomId, ch); const d = Math.hypot(x - pl.x, y - pl.y); if (d > bd) { bd = d; best = [x, y, ch]; } }
    return best || farSpot(120);
  }

  // =====================================================================
  // 제1장 · 나홀로 숨바꼭질 — 저주받은 곰인형
  // 새벽 3시, 낯선 아파트 303호. 1년 전 이 집의 아이가 혼자 시작한 숨바꼭질이 아직 끝나지 않았다.
  // =====================================================================
  def('thread', 6, 1, null, (g, x, y, o, t) => { for (let i = 0; i < 96; i++) P(g, x + i, y + 8 + Math.round(Math.sin(i / 7 + (o.ph || 0)) * 2), 1, 1, i % 9 === 0 ? '#ece6d8' : '#b51d27'); }, { flat: true });
  CHAPTERS[1] = (() => {
    const W = { next: 0, warnAt: 0, lastSec: -1 };
    const ch = {
      id: 1, icon: '🧸', title: '나홀로 숨바꼭질', sub: '저주받은 곰인형', music: 'apt', step: 'step', lightItem: 'phone', lostText: '…작은 발소리가 멀어졌다.',
      npcLook: {},
      guide: [['🧸', '이 장의 규칙', '솜이(곰인형)가 집 안을 돌아다니며 당신을 찾아요. 「어디 있니…」가 들리면 숫자를 세는 동안 숨을 곳으로 가세요. 눈에 띄지 않으면 그냥 지나가요.']],
      items: {
        phone: { n: '내 휴대폰', d: '배터리 13%. 신호는 없다. 손전등은 켜진다. 시계는 계속 「03:00」에서 멈춰 있다.', i: '📱' },
        rule1: { n: '규칙 쪽지 ①', d: '「① 인형의 솜을 빼고 쌀을 채운다. 손톱 조금, 그리고 붉은 실로 꿰맨다. 인형에게 이름을 지어 준다.」  — 옆에 연필로: 「이름은 솜이」', i: '📃' },
        rule2: { n: '규칙 쪽지 ②', d: '「② 새벽 3시, 물을 받은 욕조에 인형을 두고 세 번 말한다. "처음 술래는 (인형 이름)." 그리고 집 안의 불을 모두 끄고 텔레비전만 켜 둔다.」', i: '📃' },
        rule3: { n: '규칙 쪽지 ③', d: '「③ 숨을 때는 소금물을 지닐 것. 그것은 소금을 싫어한다. 숨어 있는 동안에는 절대 소리를 내지 말 것.」', i: '📃' },
        rule4: { n: '규칙 쪽지 ④ (끝내는 법)', d: '「④ 끝내는 법. 소금물을 반쯤 입에 머금고 인형을 찾는다. 찾으면 ― 남은 소금물을 인형에게 붓고, 머금은 소금물도 뿜는다. 그리고 "내가 이겼다"를 세 번 말한 뒤, 인형을 태운다. 순서를 틀리면 숨바꼭질은 끝나지 않는다.」', i: '📜' },
        diary: { n: '하린이의 일기장', d: '「11월 26일. 엄마는 오늘도 야간. 인터넷에서 혼자 하는 숨바꼭질을 봤다. 친구가 생긴대. 무섭지만… 해 볼래.」  「11월 27일. 솜이가 욕조에 없다. 솜이가 숨지 않는다. 솜이가 나를 찾는다. 소금은 부엌 서랍 상자에 있는데 비밀번호가 기억이 안 난다. 엄마 생일로 했었는데…」', i: '📔' },
        momNote: { n: '엄마의 쪽지', d: '「하린아, 엄마 오늘도 야간이야. 저녁 꼭 챙겨 먹고, 무서우면 엄마 방에서 자. 금방 올게. 사랑해. ― 엄마」 종이가 여러 번 접혔다 펴진 자국이 있다.', i: '✉️' },
        letter: { n: '하린이의 편지', d: '「이걸 읽는 사람에게. 나는 1년째 이 옷장 안에 숨어 있어. 솜이가 나를 못 찾게. 이제 나가고 싶어. 끝내는 법은 엄마 방 서랍에 넣어 뒀어. 순서 꼭 지켜. 그리고… 다 끝나면 내 이름 한 번만 불러 줘. 하린이라고.」', i: '💌' },
        anKey: { n: '안방 열쇠', d: '하트 모양 열쇠고리가 달린 작은 열쇠. 꼬리표에 「안방」.', i: '🗝️' },
        cup: { n: '빈 컵', d: '이가 조금 나간 머그컵. 곰돌이 그림이 그려져 있다.', i: '☕' },
        salt: { n: '굵은 소금', d: '비닐봉지에 든 굵은 소금. 한 줌이면 충분하다.', i: '🧂' },
        saltwater: { n: '소금물', d: '머그컵 가득 탄 진한 소금물. 쥐고 있으면 이상하게 마음이 놓인다.', i: '🥛' },
        matches: { n: '성냥갑', d: '「OO 노래방」이라고 적힌 성냥갑. 성냥이 몇 개비 남아 있다.', i: '🔥' }
      },
      fresh: () => ({ v: 1, room: 'living', x: 11 * TS, y: 5 * TS + 10, dir: 'left', F: {}, inv: [], obj: {}, t: 0, npc: {} }),
      goal: () => {
        const F = ST.F;
        if (!has('phone')) return '바닥에서 빛나는 휴대폰을 줍자.';
        if (!F.hunt) return '이 집을 둘러보자. 욕실에서 물소리가 들린다.';
        if (!has('rule4')) return '찢어진 규칙 쪽지를 모아 숨바꼭질을 끝내는 법을 알아내자. (쪽지 ' + ['rule1', 'rule2', 'rule3', 'rule4'].filter(has).length + '/4)';
        if (!has('saltwater')) return '소금물을 만들자. 컵, 소금, 그리고 물이 필요하다.';
        if (!has('matches')) return '인형을 태울 불이 필요하다. 어두운 다용도실을 찾아보자.';
        return '붉은 실을 따라가 솜이를 찾자. 쪽지 ④의 순서를 잊지 말 것.';
      },
      caughtArt: 'c1',
      caughtText: () => pick(['…작고 축축한 손이 발목을 잡았다.\n「찾 았 다.」', '바로 등 뒤에서 쌀알이 바닥에 떨어지는 소리가 났다.\n「이번엔 네가 술래야.」']),
      rooms: {
        living: { name: '거실', floor: 'lino', wall: 'apt', dark: 0.62, seed: 301,
          map: ['################', '#########N######', '#..............#', '#..............#', 'W..............#', '#..............#', '#..............#', '#..............#', '#..............#', '###F############', '################'],
          doors: { N: { to: 'hall', back: 'L' }, W: { to: 'kitchen', back: 'E' }, F: { look: 'front', use: 'frontDoor' } },
          objs: [
            { t: 'tv', x: 6, y: 2, id: 'tv', use: 'tv' }, { t: 'sofa', x: 6, y: 6, say: '꺼진 소파. 한가운데가 움푹 꺼져 있다. 누군가 매일 여기서 텔레비전을 봤던 것 같다.' },
            { t: 'table', x: 6, y: 4, say: '낮은 탁자 위에 식은 라면 그릇. 젓가락이 꽂힌 채로 굳어 있다.' },
            { t: 'window', x: 11, y: 1, face: true, say: ['빗물이 창을 타고 흐른다. 바깥은 아무것도 보이지 않는다.', '…여기는 3층인데. 방금 창밖에 누가 서 있었던 것 같다.'] },
            { t: 'calendar', x: 3, y: 1, circle: true, use: 'calendar' }, { t: 'clock', x: 13, y: 1, stopped: true, say: '벽시계. 바늘이 3시 정각에 멈춰 있다. 그런데 째깍거리는 소리는 계속 들린다.' },
            { t: 'shoerack', x: 1, y: 8, say: '신발장. 작은 운동화 한 켤레와 어른 구두 한 켤레. 운동화 앞코에 쌀알이 끼어 있다.' },
            { t: 'closet', x: 1, y: 2, use: 'hide', hideText: '신발장 옆 수납장. 몸을 웅크리면 들어갈 수 있을 것 같다.' },
            { t: 'phone', x: 8, y: 7, id: 'myphone', hideIf: 'gotPhone', use: 'myPhone' }, { t: 'plant', x: 14, y: 8, say: '말라 비틀어진 화분. 흙이 바싹 말라 있다.' }
          ] },
        kitchen: { name: '부엌', floor: 'check', wall: 'apt', dark: 0.66, seed: 302,
          map: ['############', '############', '#..........#', '#..........#', '#..........E', '#..........#', '#..........#', '#..........#', '############', '############'],
          doors: { E: { to: 'living', back: 'W' } },
          objs: [
            { t: 'counter', x: 1, y: 2, sink: true, id: 'sink', use: 'sink' }, { t: 'stove', x: 3, y: 2, say: '가스레인지 위 냄비. 뚜껑을 열 용기는 나지 않는다.' },
            { t: 'drawers', x: 4, y: 2, use: 'saltbox' }, { t: 'fridge', x: 10, y: 1, say: '냉장고 안은 텅 비어 있다. 우유 한 팩. 유통기한이… 1년 전이다.' },
            { t: 'cupboard', x: 7, y: 1, use: 'cupboard' }, { t: 'table', x: 4, y: 5, say: '식탁에 숟가락이 두 개 놓여 있다. 하나는 작은 아이용.' },
            { t: 'chair', x: 4, y: 6, face: 'up' }, { t: 'chair', x: 5, y: 4, face: 'down' }, { t: 'trashcan', x: 1, y: 7, use: 'trash' }
          ] },
        hall: { name: '복도', floor: 'lino', wall: 'apt', dark: 0.7, seed: 303,
          map: ['####################', '###B#####H#####A####', '#..................#', '#..................U', '#..................#', '#########L##########', '####################'],
          doors: { B: { to: 'bath', back: 'S' }, H: { to: 'harin', back: 'S' }, A: { to: 'anbang', back: 'S', lock: 'anOpen', lockUse: 'anDoor' }, U: { to: 'util', back: 'W' }, L: { to: 'living', back: 'N' } },
          objs: [
            { t: 'thread', x: 3, y: 3, showIf: 'ready', hideIf: 'burned', ph: 1 }, { t: 'thread', x: 9, y: 2, showIf: 'ready', hideIf: 'burned', ph: 2 },
            { t: 'closet', x: 17, y: 1, use: 'hide', hideText: '복도 붙박이장. 안쪽에 겨울 이불이 쌓여 있어 몸을 숨길 수 있다.' },
            { t: 'painting', x: 6, y: 1, art: 'family', use: 'photo' }, { t: 'plant', x: 1, y: 2 }, { t: 'painting', x: 12, y: 1, art: 'landscape', say: '바다 그림. 누군가 수평선 위에 빨간 크레파스로 작은 곰을 그려 넣었다.' }
          ] },
        bath: { name: '욕실', floor: 'tile', wall: 'cream', dark: 0.66, seed: 304,
          map: ['##########', '##########', '#........#', '#........#', '#........#', '#........#', '#........#', '####S#####', '##########'],
          doors: { S: { to: 'hall', back: 'B' } },
          objs: [
            { t: 'bathtub', x: 1, y: 2, id: 'tub', use: 'tub' }, { t: 'teddy', x: 2, y: 2, h: 2, showIf: 'ready', hideIf: 'burned', dir: 'down', tilt: 1, quiet: true },
            { t: 'toilet', x: 8, y: 2, say: '변기 뚜껑이 닫혀 있다. 안에서… 아니, 아무 소리도 안 났다.' }, { t: 'sink', x: 6, y: 2, say: '수도꼭지에서 물이 한 방울씩 떨어진다.' },
            { t: 'mirror', x: 6, y: 1, use: 'mirror' }, { t: 'washer', x: 8, y: 5, use: 'washer' }, { t: 'stain', x: 4, y: 5 }
          ] },
        harin: { name: '하린이의 방', floor: 'lino', wall: 'paper', dark: 0.66, seed: 305,
          map: ['############', '############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#####S######', '############'],
          doors: { S: { to: 'hall', back: 'H' } },
          objs: [
            { t: 'bedSmall', x: 1, y: 2, use: 'hide', hideText: '작은 침대. 침대 밑에 겨우 몸이 들어갈 것 같다.', cover: '#c86a8a' },
            { t: 'desk', x: 3, y: 2, lamp: true, paper: true, use: 'desk' }, { t: 'chair', x: 3, y: 3, face: 'up' },
            { t: 'window', x: 3, y: 1, say: '창문에 야광 별 스티커가 붙어 있다. 하나만 빨간색이다.' },
            { t: 'shelf', x: 6, y: 1, say: '동화책, 문제집, 그리고 「혼자서도 잘해요」라는 그림책. 책등이 다 해졌다.' },
            { t: 'toybox', x: 8, y: 2, use: 'toybox' }, { t: 'wardrobe', x: 10, y: 1, id: 'hward', use: 'hward' }, { t: 'stain', x: 6, y: 6 }
          ] },
        anbang: { name: '안방', floor: 'wood', wall: 'paper', dark: 0.68, seed: 306,
          map: ['##############', '##############', '#............#', '#............#', '#............#', '#............#', '#............#', '#............#', '######S#######', '##############'],
          doors: { S: { to: 'hall', back: 'A' } },
          objs: [
            { t: 'bed', x: 2, y: 2, use: 'hide', hideText: '큰 침대. 침대 밑은 깊고 어둡다. 들어갈 수 있을 것 같다.', cover: '#4a3a5a' },
            { t: 'bedside', x: 4, y: 2, say: '머리맡 탁자에 수면제 통과 가족사진. 사진 속 하린이는 곰인형을 꼭 안고 있다.' },
            { t: 'drawers', x: 6, y: 2, use: 'mdrawers' }, { t: 'vanity', x: 9, y: 1, use: 'vanity' },
            { t: 'wardrobe', x: 12, y: 1, use: 'hide', hideText: '커다란 장롱. 옷 사이로 들어가 숨을 수 있다.' }, { t: 'plant', x: 12, y: 7 }
          ] },
        util: { name: '다용도실', floor: 'stone', wall: 'stone', dark: 0.8, seed: 307, need: 'phone', needText: '불빛이 하나도 없다. 휴대폰 손전등이라도 있어야…',
          map: ['########', '########', '#......#', '#......W', '#......#', '#......#', '#......#', '########'],
          doors: { W: { to: 'hall', back: 'U' } },
          objs: [
            { t: 'shelf2', x: 1, y: 1, seed: 4, use: 'ushelf' }, { t: 'crate', x: 5, y: 5, use: 'hide', hideText: '상자 더미 뒤. 몸을 낮추면 보이지 않을 것 같다.' },
            { t: 'barrel', x: 1, y: 6, say: '쌀통이다. 뚜껑이 열려 있고… 쌀이 절반쯤 비었다. 누가 퍼 간 걸까.' }, { t: 'trashcan', x: 6, y: 2, say: '빈 페트병과 신문지 뭉치.' }
          ] }
      },
      tick(dt, t) {
        const F = ST.F;
        if (!F.hunt || F.ready || F.burned || busy || mon) { W.warnAt = 0; return; }
        if (!W.next) W.next = t + 35000 + Math.random() * 15000;
        if (!W.warnAt && t > W.next) { W.warnAt = t; W.lastSec = -1; sfx('whisper', 0.07); sfx('giggle', 0.03); }
        if (W.warnAt) {
          const left = 8 - Math.floor((t - W.warnAt) / 1000);
          if (left !== W.lastSec && left > 0) { W.lastSec = left; note(`…어디 있니? 작은 발소리가 다가온다. 숨어요! (${left})`, 1200); if (left <= 3) sfx('soft'); }
          if (left <= 0) {
            W.warnAt = 0; W.next = t + 45000 + Math.random() * 30000;
            const [x, y] = farDoor();
            startChase('bear', x, y, 11, { mode: 'seek', sight: 82, spotted: '솜이와 눈이 마주쳤다! 도망쳐서 숨어요!', onEnd: m => { if (m.mode === 'seek') note('…솜이가 다른 방으로 갔다.'); } });
            sfx('door'); note('「…어디 있니…?」');
          }
        }
      },
      onRestore() { W.warnAt = 0; W.next = now() + 20000; },
      async intro() {
        busy++;
        fadeA = 1; await wait(400); await fade(0, 1200);
        await say([[null, '…쿵.'], [null, '정신을 차려 보니, 낯선 집 거실 바닥이었다.'], [ME(), '여기… 어디지? 분명 숲에서 구멍에 빠졌는데.'], [null, '벽시계가 째깍거린다. 바늘은 새벽 3시 정각을 가리키고 있다.'], [null, '창밖에서는 비가 내리고, 집 안은 이상할 만큼 조용하다.']]);
        await wait(500);
        ost('living', 'tv').on = true; refresh(); sfx('static', 0.12); shake = 3;
        await say([[null, '지지직— 텔레비전이 저절로 켜졌다.'], [null, '모래 폭풍 같은 화면 너머로, 아이 목소리가 들린다.'], ['???', '「…처음 술래는, 솜이. 처음 술래는, 솜이. 처음 술래는…」'], [null, '목소리가 뚝 끊겼다.'], [ME(), '…술래? 무슨 소리야. 일단 휴대폰부터 찾자.']]);
        ST.F.intro = 1;
        busy--;
        await showGuide();
        snapshot(); saveNow();
      },
      async onEnter(rid) {
        const F = ST.F;
        if (rid === 'hall' && F.ready && !F.ev_thread) { F.ev_thread = 1; await say([[null, '복도 바닥에 붉은 실이 길게 늘어져 있다.'], [null, '실은 욕실 쪽으로 이어진다. 그 위로 쌀알이 띄엄띄엄 떨어져 있다.']]); }
        if (rid === 'bath' && F.ready && !F.ev_back) { F.ev_back = 1; sfx('drip', 0.08); await say([[null, '욕조 안에… 무언가 앉아 있다.']]); await showCG('tub', '물에 젖은 곰인형. 솜이다. 아까는 없었는데.'); }
        if (rid === 'harin' && F.hunt && !F.ev_harin) { F.ev_harin = 1; await wait(300); sfx('knock', 0.06); await say([[null, '…똑, 똑.'], [null, '옷장 안쪽에서 누가 아주 작게 두드린 것 같다.']]); }
      },
      script: {
        frontDoor: async () => { sfx('locked'); await say([[null, '현관문 도어락 화면에 빨간 글씨가 깜빡인다.'], [null, '「 게 임 중 」'], [null, '손잡이를 아무리 돌려도 열리지 않는다.']]); },
        myPhone: async () => { ST.F.gotPhone = 1; refresh(); give('phone'); await say([[null, '내 휴대폰이다. 배터리 13%, 신호 없음.'], [null, '손전등은 켜진다. 조금은 덜 어둡다.']]); },
        tv: async () => {
          if (ST.F.burned) return say([[null, '텔레비전은 꺼져 있다. 검은 화면에 내 얼굴만 비친다.']]);
          sfx('static', 0.06);
          await say([[null, '모래 폭풍 화면. 가끔 무언가 작고 둥근 그림자가 화면을 가로지른다.'], [null, '리모컨이 없다. 전원 버튼을 눌러도 꺼지지 않는다.']]);
        },
        calendar: async () => { sfx('page'); await say([[null, '11월 달력. 7일에 빨간 동그라미와 「엄마 생일 🎂」.'], [null, '27일 칸에는 삐뚤삐뚤한 글씨로 「솜이랑 숨바꼭질」.'], [null, '27일 다음 칸부터는… 아무것도 적혀 있지 않다.']]); },
        photo: async () => { await say([[null, '가족사진. 엄마, 아빠, 그리고 곰인형을 안은 여자아이.'], [null, '사진 아래 매직으로 「하린이 열 살 생일」.'], [null, '…모두 카메라를 보고 웃는데, 곰인형만 이쪽을 보고 있다.']]); },
        tub: async () => {
          const F = ST.F;
          if (F.burned) return say([[null, '욕조 물이 맑아졌다. 바닥에 재가 조금 가라앉아 있다.']]);
          if (F.ready) return tubFinal();
          if (!F.hunt) {
            F.hunt = 1;
            await say([[null, '물이 가득 찬 욕조. 물이 이상하게 차갑다.'], [null, '바닥에 붉은 실 한 가닥과 쌀알 몇 개가 가라앉아 있다.'], [null, '…무언가가 여기 앉아 있다가, 나간 것 같다.']]);
            await wait(400); sfx('soft'); await wait(350); sfx('soft'); await wait(350); sfx('squeak', 0.04);
            await say([[null, '타박, 타박. 어딘가에서 작고 무른 발소리가 들린다.'], ['???', '「…어디 있니?」'], [ME(), '…!'], [null, '숨어야 한다. 「어디 있니」가 들리면, 숫자를 세는 동안 숨을 곳을 찾자.']]);
            W.next = now() + 9000; W.warnAt = 0;
            return;
          }
          await say([[null, '차가운 물이 가득한 욕조. 붉은 실이 물속에서 천천히 흔들린다.']]);
        },
        mirror: async () => {
          if (ST.F.hunt && !ST.F.ev_mirror) { ST.F.ev_mirror = 1; sfx('hum', 0.04); return say([[null, '거울 속, 내 어깨 너머 문틈으로… 작은 무언가가 서 있다.'], [null, '돌아보니 아무것도 없다. 다시 거울을 봐도 아무것도 없다.']]); }
          await say([[null, '김이 서린 거울. 누군가 손가락으로 쓴 글씨 자국: 「숨어」']]);
        },
        washer: async () => {
          if (!has('rule2')) { sfx('page'); give('rule2'); return say([[null, '세탁기 안에 젖은 종이가 붙어 있다. 찢어진 쪽지다.'], [null, ITEMS.rule2.d]]); }
          await say([[null, '빈 세탁기. 물비린내가 난다.']]);
        },
        trash: async () => {
          if (!has('rule1')) { sfx('page'); give('rule1'); return say([[null, '구겨진 종이가 있다. 펴 보니 손글씨로 적은 규칙이다.'], [null, ITEMS.rule1.d], [null, '쓰레기통 바닥에 곰인형 솜이 한 뭉치 버려져 있다.']]); }
          await say([[null, '하얀 솜 뭉치. 인형에서 빼낸 것 같다.']]);
        },
        cupboard: async ctx => {
          if (!has('cup')) { give('cup'); await say([[null, '찬장에서 컵을 하나 꺼냈다. 곰돌이 그림이 그려진 머그컵.']]); }
          await hideOrLook(ctx.o, '찬장 아래 칸이 비어 있다. 몸을 구겨 넣으면 숨을 수 있을 것 같다.');
        },
        saltbox: async () => {
          if (ST.F.saltOpen) return say([[null, '열린 상자. 이제 비어 있다.']]);
          const ok = await dialPuzzle('🔒 서랍 속 상자', '작은 플라스틱 상자에 숫자 자물쇠가 달려 있다. 네 자리. 뚜껑에 스티커: 「하린이 보물 ― 만지지 마!」', '1107');
          if (!ok) return;
          ST.F.saltOpen = 1; sfx('unlock'); give('salt');
          await say([[null, '딸깍. 상자 안에 굵은 소금 봉지와 머리끈 하나.']]);
        },
        sink: async () => {
          if (has('saltwater')) return say([[null, '물이 졸졸 나온다.']]);
          if (has('cup') && has('salt')) { sfx('water'); take('cup'); take('salt'); give('saltwater'); return say([[null, '컵에 물을 받고 소금을 한 줌 녹였다.'], [null, '진한 소금물이 됐다. 손이 조금 덜 떨린다.']]); }
          if (has('cup')) return say([[null, '컵에 물을 받을 수는 있다. 하지만 맹물로는 안 될 것 같다.']]);
          await say([[null, '개수대. 수도꼭지를 틀자 녹물이 잠깐 나오다가 맑아진다.']]);
        },
        desk: async () => {
          if (!has('diary')) { sfx('page'); give('diary'); await say([[null, '책상 위에 일기장이 펼쳐져 있다.'], [null, ITEMS.diary.d]]); }
          if (!has('rule3')) { sfx('page'); give('rule3'); return say([[null, '책상 매트 밑에 찢어진 쪽지가 끼어 있다.'], [null, ITEMS.rule3.d]]); }
          await say([[null, '일기장의 마지막 장은 비어 있다. 지우개 자국만 가득하다.']]);
        },
        toybox: async () => {
          if (!has('anKey') && !ST.F.anOpen) { give('anKey'); return say([[null, '장난감 상자 안. 바비 인형, 블록, 그리고… 머리가 없는 곰인형 사진 한 장.'], [null, '맨 밑에 하트 열쇠고리가 달린 열쇠가 있다.']]); }
          await say([[null, '장난감들이 전부 한쪽 구석을 보고 있다. 원래 이렇게 놓여 있었나?']]);
        },
        hward: async ctx => {
          if (!has('letter')) { sfx('page'); give('letter'); await say([[null, '옷장 문 안쪽에 테이프로 붙여 둔 편지가 있다.'], [null, ITEMS.letter.d], [null, '…편지를 붙인 테이프가, 아직 끈적하다.']]); }
          await hideOrLook(ctx.o, '아이 옷장. 안은 생각보다 깊다. 숨을 수 있을 것 같다.');
        },
        anDoor: async () => {
          if (has('anKey')) { take('anKey'); ST.F.anOpen = 1; sfx('unlock'); refresh(); return say([[null, '안방 열쇠로 문을 열었다.']]); }
          sfx('locked'); await say([[null, '안방 문이 잠겨 있다. 문고리에 하트 모양 스티커.']]);
        },
        vanity: async () => {
          if (!has('momNote')) { sfx('page'); give('momNote'); return say([[null, '화장대 거울 틈에 쪽지가 꽂혀 있다.'], [null, ITEMS.momNote.d]]); }
          await say([[null, '화장대 거울에 비친 방이 조금 더 어둡다. 기분 탓이겠지.']]);
        },
        mdrawers: async () => {
          if (!has('rule4')) { sfx('page'); give('rule4'); await say([[null, '서랍 맨 아래 칸, 옷 사이에 접힌 종이가 숨겨져 있다.'], [null, ITEMS.rule4.d]]); return checkReady(); }
          await say([[null, '엄마 옷에서 섬유유연제 냄새가 난다.']]);
        },
        ushelf: async () => {
          if (!has('matches')) { give('matches'); await say([[null, '선반 위 공구함 사이에 성냥갑이 있다.']]); return checkReady(); }
          await say([[null, '녹슨 공구들. 손전등 불빛에 거미줄이 반짝인다.']]);
        }
      }
    };
    async function checkReady() {
      const F = ST.F;
      if (F.ready || !has('rule4') || !has('saltwater') || !has('matches')) return;
      F.ready = 1; if (mon) { mon = null; chaseMusic(false); }
      sfx('giggle', 0.04);
      await say([[null, '…집 안이 갑자기 조용해졌다. 발소리도, 텔레비전 소리도.'], [ME(), '준비는 됐어. 이제 솜이를 찾아서… 끝내자.']]);
      snapshot(); saveNow();
    }
    // the sink and the drawers both might be the last thing you needed
    const wrapSink = ch.script.sink; ch.script.sink = async () => { await wrapSink(); await checkReady(); };
    async function tubFinal() {
      const c = await choose('욕조 안에 솜이가 앉아 있다. 젖은 털 사이로 붉은 실이 비죽 나와 있다. 고개가… 천천히 이쪽으로 돌아간다.', ['소금물을 반쯤 입에 머금는다', '그냥 인형을 집어 든다', '물러난다']);
      if (c === 2) return;
      if (c === 1) {
        await say([[null, '인형을 집어 드는 순간, 젖은 솜 속에서 무언가 꿈틀했다.'], ['솜이', '「…아직 아니야.」']]);
        sfx('sting'); ST.F.ready = 1; startChase('bear', 4 * TS, 4 * TS + 10, 14, { spotted: '' });
        return;
      }
      await say([[null, '짠맛이 혀를 찌른다. 입을 꾹 다물고, 인형 앞에 섰다.']]);
      snapshot();
      const r = await orderPuzzle('🧂 끝내는 법', '쪽지 ④에 적힌 순서대로 하자. (입에는 소금물을 머금고 있다)', ['남은 소금물을 인형에게 붓는다', '머금은 소금물을 인형에게 뿜는다', '「내가 이겼다」를 세 번 말한다', '성냥으로 인형을 태운다', '인형의 이름을 부른다', '인형을 꼭 안아 준다'], [0, 1, 2, 3]);
      if (r === null) return say([[null, '…소금물을 뱉어 버렸다. 다시 머금고 와야겠다.']]);
      if (r === false) {
        await say([[null, '…인형의 단추 눈이 데구루루 굴러, 이쪽을 보았다.'], ['솜이', '「틀 렸 어.」']]);
        startChase('bear', 4 * TS, 4 * TS + 10, 16, {});
        return;
      }
      busy++;
      sfx('water'); await say([[null, '남은 소금물을 인형 머리 위로 부었다. 쉬이익— 털이 타는 듯한 소리.']]);
      sfx('water'); await say([[null, '입에 머금은 소금물을 힘껏 뿜었다.']]);
      shake = 3; await say([[ME(), '내가 이겼다.']]); shake = 5; await say([[ME(), '내가 이겼다!']]); shake = 8; await say([[ME(), '내가 이겼다!!']]);
      sfx('match'); await wait(500); sfx('fire'); redFlash = 0.35;
      ST.F.burned = 1; ost('living', 'tv').on = false; refresh();
      await say([[null, '성냥불이 젖은 털에 옮겨붙었다. 인형은 소리 없이 오그라들었다.'], [null, '마지막으로, 단추 눈 하나가 욕조 바닥으로 굴러떨어졌다.']]);
      busy--;
      if (has('letter')) {
        const c2 = await choose('편지의 마지막 부탁이 떠오른다. 「다 끝나면 내 이름 한 번만 불러 줘.」', ['「하린아!」 이름을 부른다', '그냥 나간다']);
        if (c2 === 0) { await say([[ME(), '…하린아.'], [null, '멀리서, 옷장 문이 끼익 열리는 소리가 났다.']]); return finish('true'); }
      }
      return finish('normal');
    }
    ch.endings = {
      true: { title: '진엔딩 · 찾았다', body: '이름을 부르자 하린이의 방 옷장 문이 천천히 열렸다. 안에는 아무도 없었지만, 아주 작은 목소리가 들렸다.\n「…찾았다. 고마워.」\n현관 도어락의 「게임 중」 글자가 꺼졌다. 문 너머는 또다시 끝없는 어둠. 나는 그 어둠 속으로 한 발 내디뎠다.' },
      normal: { title: '엔딩 · 숨바꼭질 끝', body: '인형은 재가 되었다. 현관 도어락이 딸깍 열렸다.\n그런데 문을 나서기 직전, 복도 붙박이장인지 아이 방 옷장인지 모를 어딘가에서 누군가 아주 작게 두드렸다. 똑, 똑.\n아직… 숨어 있는 사람이 있다.', hint: '하린이가 남긴 편지를 찾으면 다른 엔딩을 볼 수 있어요.' }
    };
    return ch;
  })();

  // =====================================================================
  // 제2장 · 쿠네쿠네 — 논밭에서 흔들리는 하얀 것
  // 장마가 막 끝난 여름 저녁, 시골 할머니 집. 논 한가운데 하얀 것이 서 있다. 보지 마라. 알려고 하지 마라.
  // =====================================================================
  def('straw', 2, 1, [2, 6, 28, 9], (g, x, y) => { for (let i = 0; i < 7; i++) P(g, x + 2 + i * 4, y + 3 - (i % 3), 4, 12 + (i % 3), i % 2 ? '#b89a4a' : '#a8883e'); P(g, x + 1, y + 13, 30, 2, '#8a7034'); for (let i = 0; i < 9; i++) P(g, x + 3 + i * 3, y + 1 + (i * 5) % 7, 1, 4, '#d8bc6a'); });
  def('binoc', 1, 1, null, (g, x, y) => { P(g, x + 3, y + 9, 4, 4, '#1a1a22'); P(g, x + 9, y + 9, 4, 4, '#1a1a22'); P(g, x + 6, y + 10, 4, 2, '#3a3a44'); P(g, x + 4, y + 10, 1, 1, '#7a8aa0'); P(g, x + 10, y + 10, 1, 1, '#7a8aa0'); }, { wall: true });
  def('bellwall', 1, 1, null, (g, x, y, o, t) => { P(g, x + 7, y + 2, 2, 2, '#5a5660'); P(g, x + 7, y + 4, 1, 3, '#8a7034'); if (!o.gone) { P(g, x + 5, y + 7, 6, 5, '#c9a24a'); P(g, x + 6, y + 8, 2, 1, '#f4e0a0'); P(g, x + 7, y + 12, 2, 1, '#5a4a2a'); } }, { wall: true });
  def('stonebox', 1, 1, [2, 6, 12, 9], (g, x, y, o) => { box(g, x + 2, y + 5, 12, 10, '#5a5660', '#6e6a74'); P(g, x + 3, y + 8, 10, 1, '#3a3640'); P(g, x + 7, y + 9, 2, 3, o.open ? '#0d0b10' : '#8a7a4a'); });
  CHAPTERS[2] = (() => {
    let gaze = 0, warned = 0, driftAt = 0;
    const KPOS = { field1: () => ST.F.infected ? [14 * TS + 8, 4 * TS + 12] : [22 * TS + 8, 3 * TS + 12], field2: () => [3 * TS + 8, 3 * TS + 10] };
    const fence = (y, x0, x1, skip) => Array.from({ length: x1 - x0 + 1 }, (_, i) => ({ t: 'fence', x: x0 + i, y })).filter(o => !(skip || []).includes(o.x));
    function gazeTarget() {
      if (mon && mon.kind === 'kune' && mon.room === roomId && !mon.pending && !mon.gone) return [mon.x, mon.y - 16];
      return KPOS[roomId] ? KPOS[roomId]() : null;
    }
    const ch = {
      id: 2, icon: '🌾', title: '쿠네쿠네', sub: '논밭에서 흔들리는 하얀 것', music: 'field', step: 'grass', lightItem: 'flash',
      npcLook: { 준호: { hair: 'twoblock', hairColor: '#231a20', top: 'tee', topColor: '#f3f0e9', bottom: 'shorts', bottomColor: '#34394b' } },
      guide: [['🌾', '이 장의 규칙', '논 한가운데 하얀 것을 오래 바라보면 안 돼요. 그쪽을 향해 서 있으면 화면이 하얗게 일그러져요. 다른 쪽을 바라보면 가라앉아요.']],
      items: {
        flash: { n: '손전등', d: '할머니 서랍에 있던 낡은 손전등. 불빛이 누렇다.', i: '🔦' },
        notebook: { n: '할머니의 수첩', d: '「올해도 장마 끝에 논에 하얀 것이 섰다. 아이들에게 단단히 일러 둘 것. 보지 마라, 알려고 하지 마라. 할아버지 쌍안경은 숨겨 둘 것.」\n「누가 그것을 알아 버리면 ― ① 서낭당에 촛불을 밝히고 ② 소금 뿌린 방울을 흔들며 ③ 그 아이의 이름을 세 번 부르며 마을 다리를 건너라. 건너는 동안 절대 뒤돌아보지 말 것. 다리 건너엔 그것이 못 온다.」\n「서낭당 돌함 번호: 우리 집 장독 수, 들판 허수아비 수, 마당 감나무 수. 할아버지가 정한 건데 나도 맨날 헷갈린다.」', i: '📒' },
        candle: { n: '초와 성냥', d: '서낭당 돌함에 있던 하얀 초와 성냥.', i: '🕯️' },
        salt: { n: '굵은 소금', d: '장독에서 한 줌 덜어 온 굵은 소금. 할머니는 나쁜 걸 쫓을 때 늘 소금을 뿌리셨다.', i: '🧂' },
        bell: { n: '놋방울', d: '헛간 못에 걸려 있던 작은 놋방울. 흔들면 맑은 소리가 멀리까지 퍼진다.', i: '🔔' }
      },
      fresh: () => ({ v: 1, room: 'yard', x: 9 * TS, y: 9 * TS + 4, dir: 'up', F: {}, inv: [], obj: {}, t: 0, npc: { 준호: { room: '(gone)', x: 0, y: 0, dir: 'down' } } }),
      goal: () => {
        const F = ST.F;
        if (!F.junGone && !has('flash')) return '할머니 집을 둘러보자. 큰방에 쓸 만한 게 있을지도.';
        if (!F.infected) return '어디선가 준호의 웃음소리가 들린다. 논 쪽으로 가 보자.';
        if (!has('notebook')) return '할머니가 뭔가 적어 둔 게 있을지도 모른다. 큰방의 반닫이를 보자.';
        if (!F.lit) return '서낭당 돌함을 열어 촛불을 밝히자. 번호는 수첩에 적힌 대로 세어 보자.';
        if (!has('salt')) return '소금이 필요하다. 마당 장독대를 보자.';
        if (!has('bell')) return '방울을 찾자. 헛간은 어둡다.';
        if (!ST.npc.준호.follow) return '준비는 끝났다. 작은방의 준호를 데리러 가자.';
        return '준호와 함께 서낭당 고개 너머 마을 다리를 건너자. 절대 뒤돌아보지 말 것.';
      },
      caughtArt: 'c2',
      caughtText: kind => kind === 'kune' ? '하얀 것이 바로 뒤에 있었다.\n돌아보지 않았는데도, 그것이 무엇인지 보였다. 히, 히히…' : '…그것이 무엇인지 알아 버렸다.',
      rooms: {
        yard: { name: '할머니 집 마당', floor: 'dirt', wall: 'hanok', dark: 0.5, seed: 401, step: 'grass',
          map: ['##################', '#######H##########', '#................#', '#................#', '#................#', 'S................E', '#................#', '#................#', '#................#', '#................#', '#................#', '##################'],
          doors: { H: { to: 'house', back: 'S' }, S: { to: 'shed', back: 'E' }, E: { to: 'field1', back: 'W' } },
          objs: [
            { t: 'bigtree', x: 2, y: 2, say: '감나무. 덜 익은 감이 주렁주렁. 할머니가 해마다 곶감을 만드시는 나무다.' }, { t: 'bigtree', x: 14, y: 8, say: '또 한 그루의 감나무. 가지에 하얀 천 조각이 걸려 펄럭인다.' },
            { t: 'jangdok', x: 11, y: 2, say: '된장 항아리.' }, { t: 'jangdok', x: 12, y: 2, say: '고추장 항아리.' }, { t: 'jangdok', x: 13, y: 2, id: 'saltjar', use: 'saltjar' }, { t: 'jangdok', x: 14, y: 2, say: '간장 항아리. 뚜껑 위에 빗물이 고여 있다.' }, { t: 'jangdok', x: 15, y: 2, say: '빈 항아리. 두드리니 둥— 하고 울린다.' },
            { t: 'well', x: 2, y: 8, say: '우물. 안을 들여다보니 아주 깊은 곳에서 하얀 게 흔들린… 아니, 달이 비친 것뿐이다.' },
            { t: 'lantern', x: 6, y: 2 }, { t: 'lantern', x: 9, y: 2 }, { t: 'straw', x: 8, y: 9, say: '짚더미. 내가 떨어진 자리가 움푹 꺼져 있다.' }
          ] },
        house: { name: '큰방', floor: 'wood', wall: 'hanok', dark: 0.56, seed: 402, step: 'soft',
          map: ['##############', '##############', '#............#', '#............E', '#............#', '#............#', '#............#', '######S#######', '##############'],
          doors: { S: { to: 'yard', back: 'H' }, E: { to: 'small', back: 'W' } },
          objs: [
            { t: 'wardrobe', x: 1, y: 1, use: 'hide', hideText: '자개 장롱. 이불 사이로 들어갈 수 있을 것 같다.' }, { t: 'trunk', x: 3, y: 2, use: 'trunk' },
            { t: 'drawers', x: 7, y: 2, use: 'hdrawers' }, { t: 'painting', x: 10, y: 1, art: 'family', say: ['할아버지 영정 사진. 목에 쌍안경을 건 채 웃고 계신다.', '…사진 속 할아버지의 눈만 웃고 있지 않다.'] },
            { t: 'soban', x: 5, y: 5, food: true, say: '할머니가 차려 두고 가신 저녁상. 상보 위에 「준호 꼭 먹여라」 쪽지.' }, { t: 'futon', x: 9, y: 5, c: '#8a5a6a' }, { t: 'clock', x: 12, y: 1, say: '괘종시계. 7시를 가리키고 있다. 해가 지려 한다.' }
          ] },
        small: { name: '작은방', floor: 'wood', wall: 'hanok', dark: 0.58, seed: 403, step: 'soft',
          map: ['##########', '##########', '#........#', 'W........#', '#........#', '#........#', '#........#', '##########'],
          doors: { W: { to: 'house', back: 'E' } },
          objs: [
            { t: 'window', x: 5, y: 1, say: '창밖으로 논이 끝없이 펼쳐져 있다. 멀리 하얀 점 하나.' }, { t: 'binoc', x: 7, y: 1, hideIf: 'junGone', use: 'binoc' },
            { t: 'futon', x: 2, y: 5, c: '#4a6a8a' }, { t: 'shelf', x: 1, y: 1, say: '만화책이 잔뜩. 전부 준호가 서울에서 들고 온 것이다.' }, { t: 'bedside', x: 8, y: 5, say: '선풍기와 모기향. 모기향 연기가 한쪽으로만 흐른다. 논 쪽으로.' }
          ] },
        shed: { name: '헛간', floor: 'dirt', wall: 'wood', dark: 0.85, seed: 404, step: 'grass', need: 'flash', needText: '헛간 안은 칠흑같이 어둡다. 불빛이 있어야 들어갈 수 있겠다.',
          map: ['##########', '##########', '#........#', '#........E', '#........#', '#........#', '#........#', '##########'],
          doors: { E: { to: 'yard', back: 'S' } },
          objs: [
            { t: 'bellwall', x: 4, y: 1, id: 'bell', use: 'bellwall' }, { t: 'crate', x: 1, y: 2, say: '농약병이 든 상자. 할머니가 절대 만지지 말라던 것.' }, { t: 'crate', x: 1, y: 5, use: 'hide', hideText: '상자 더미 뒤에 몸을 숨길 수 있다.' },
            { t: 'barrel', x: 7, y: 5, say: '빗물이 고인 통.' }, { t: 'straw', x: 5, y: 5, say: '짚단. 허수아비를 만들다 만 것 같다. 얼굴 자리가 텅 비어 있다.' }, { t: 'shelf2', x: 6, y: 1, seed: 6, say: '낫, 호미, 삽. 녹슬어 있다.' }
          ] },
        field1: { name: '논두렁 길', floor: 'paddy', floor2: 'dirt', wall: 'hedge', dark: 0.45, seed: 405, step: 'grass',
          map: ['##########################', '#........................#', '#........................#', '#........................#', '#........................#', '#........................#', '#,,,,,,,,,,,,,,,,,,,,,,,,#', 'W,,,,,,,,,,,,,,,,,,,,,,,,E', '#,,,,,,,,,,,,,,,,,,,,,,,,#', '#........................#', '#........................#', '##########################'],
          doors: { W: { to: 'yard', back: 'E' }, E: { to: 'field2', back: 'W' } },
          objs: fence(5, 1, 24).concat(fence(9, 1, 24), [{ t: 'scarecrow', x: 7, y: 1, say: '' }, { t: 'scarecrow', x: 17, y: 2 }]).map(o => o.t === 'scarecrow' ? Object.assign(o, { say: undefined }) : o) },
        field2: { name: '서낭당 고개', floor: 'paddy', floor2: 'dirt', wall: 'hedge', dark: 0.5, seed: 406, step: 'grass',
          map: ['####################', '#..................#', '#..................#', '#..................#', '#..................#', '#,,,,,,,,,,,,,,,,,,#', '#,,,,,,,,,,,,,,,,,,#', 'W,,,,,,,,,,,,,,,,,,E', '#,,,,,,,,,,,,,,,,,,#', '#,,,,,,,,,,,,,,,,,,#', '#..................#', '#..................#', '####################'],
          doors: { W: { to: 'field1', back: 'E' }, E: { to: 'bridge', back: 'W', lock: 'bridgeOpen', lockUse: 'toBridge' } },
          objs: fence(4, 1, 18).concat(fence(10, 1, 18), [
            { t: 'scarecrow', x: 15, y: 1 }, { t: 'shrine', x: 9, y: 5, id: 'shrine', use: 'shrine' }, { t: 'stonebox', x: 11, y: 6, id: 'sbox', use: 'stonebox' },
            { t: 'bigtree', x: 3, y: 5, say: '서낭나무. 가지마다 오색 천이 묶여 있다. 한 가닥만 하얗다.' }, { t: 'lantern', x: 17, y: 6, out: true, say: '꺼진 등. 「달골 마을 → 다리」라고 적힌 표지판이 걸려 있다.' }
          ]) },
        bridge: { name: '마을 다리', floor: 'paddy', floor2: 'plank', wall: 'hedge', dark: 0.62, seed: 407, step: 'soft',
          map: ['##############################', '#............................#', '#............................#', '#............................#', 'W,,,,,,,,,,,,,,,,,,,,,,,,,,,,E', '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,#', '#............................#', '#............................#', '##############################'],
          doors: { W: { to: 'field2', back: 'E', lock: 'never' , lockText: '…돌아보면 안 된다. 앞으로 가야 한다.' }, E: { use: 'bridgeEnd' } },
          objs: fence(3, 1, 28).concat(fence(6, 1, 28), [{ t: 'lantern', x: 27, y: 4 }]) }
      },
      actors: t => {
        const k = KPOS[roomId] && KPOS[roomId]();
        return k ? [{ y: k[1], draw: gg => drawKune(gg, k[0], k[1], t, { amp: 1.2 }) }] : [];
      },
      tick(dt, t) {
        const F = ST.F, tg = gazeTarget();
        if (tg && !busy && !pl.hidden) {
          const dx = tg[0] - pl.x, dy = tg[1] - (pl.y - 8), d = Math.hypot(dx, dy) || 1, v = DIRV[pl.dir];
          const dot = (dx * v[0] + dy * v[1]) / d, onscreen = Math.abs(dx) < 150 && Math.abs(dy) < 112;
          if (dot > 0.6 && onscreen) {
            gaze += dt * (d < 100 ? 0.42 : 0.2);
            if (!warned && gaze > 0.2) { warned = 1; note('…저 하얀 것을 계속 보면 안 될 것 같다. 다른 쪽을 보자!', 3200); }
            if (t > (ch._wAt || 0) && gaze > 0.45) { ch._wAt = t + 1400; sfx('whisper', gaze * 0.08); note(pick(['…알 것 같아…', '저건… 저건 말이야…', '조금만 더 보면…', '히, 히히…']), 1300); }
          } else gaze -= dt * 0.32;
          gaze = clamp(gaze, 0, 1);
          if (gaze >= 1) { gaze = 0; return caught('…너무 오래 바라보았다.\n그것이 무엇인지 알 것 같다. 알면 안 되는데. 히, 히히…'); }
        } else gaze = Math.max(0, gaze - dt * 0.5);
        // on the bridge: Junho keeps stopping and turning back toward it; the bell calls him back
        const n = ST.npc.준호;
        if (F.bridge && !F.alone && n.room === roomId) {
          if (n.follow && t > driftAt) { driftAt = t + 3600 + Math.random() * 2200; n.follow = false; n.drift = true; sfx('giggle', 0.05); note('준호가 멈춰 섰다! 「…저기 가고 싶어」 (확인 버튼: 🔔 방울 흔들기)', 2600); }
          if (n.drift && mon) { const dx = mon.x - n.x, dy = mon.y - n.y, d = Math.hypot(dx, dy) || 1; n.x += dx / d * 24 * dt; n.y += dy / d * 24 * dt; n.dir = 'left'; n.moving = true; if (d < 14) { n.drift = false; return caught('준호가 하얀 것에게 걸어가 버렸다.\n하얀 것이 준호를 안듯이 감쌌다. 그리고 천천히, 이쪽을 향했다.'); } }
          if (n.back) { const dx = pl.x - n.x, dy = pl.y - n.y, d = Math.hypot(dx, dy) || 1; n.x += dx / d * 95 * dt; n.y += dy / d * 95 * dt; n.dir = dx > 0 ? 'right' : 'left'; n.moving = true; if (d < 16) { n.back = false; n.follow = true; pl.trail = []; } }
        }
      },
      onAct() {
        if (!ST.F.bridge) return false;
        sfx('bell', 0.12);
        const n = ST.npc.준호;
        if (n.drift) { n.drift = false; n.back = true; note('딸랑— 준호가 정신을 차리고 돌아온다!'); }
        return true;
      },
      screen(g, t) {
        if (gaze < 0.03) return;
        const k = gaze;
        for (let i = 0; i < k * 240; i++) P(g, Math.random() * VW | 0, Math.random() * VH | 0, 1, 1, `rgba(255,255,255,${0.3 + Math.random() * 0.5})`);
        for (let i = 0; i < k * 6; i++) { const y = Math.random() * VH | 0; g.drawImage(cv, 0, y, VW, 2, (Math.random() - 0.5) * 14 * k, y, VW, 2); }
        const gr = g.createRadialGradient(VW / 2, VH / 2, 30, VW / 2, VH / 2, 170); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(240,240,232,${k * 0.75})`); g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
      },
      onRestore() { gaze = 0; const n = ST.npc.준호; n.drift = false; n.back = false; ST.F.bridge = 0; if (roomId === 'bridge') setTimeout(() => { if (CH === ch && mode === 'play') ch.onEnter('bridge'); }, 80); },
      async intro() {
        busy++;
        fadeA = 1; await wait(400); await fade(0, 1200);
        await say([[null, '…털썩.'], [null, '정신을 차려 보니 짚더미 위였다. 비 갠 하늘이 붉게 저물고 있다.'], [null, '개굴, 개굴… 사방이 개구리 소리다.']]);
        npcAt('준호', 'yard', 7, 3, 'down'); sfx('door');
        await wait(300);
        await say([['???', '으악! 뭐, 뭐야. 너 하늘에서 떨어졌어?'], [ME(), '…여기가 어디야?'], ['준호', '어디긴, 달골 마을 우리 할머니 집이지. …뭐, 아무렴 어때. 반가워. 난 준호야.'], ['준호', '할머니는 옆 마을 장례식 가셔서 내일 오신대. 그런데 가시면서 이상한 말을 하셨어.'], ['준호', '「해 지기 전에 논 쪽은 쳐다보지 마라. 특히 하얀 거. 절대로.」'], ['준호', '하얀 게 뭔데? 허수아비? 히히, 할머니도 참.'], ['준호', '난 작은방에서 만화책 볼게. 심심하면 집 구경해.']]);
        npcAt('준호', 'small', 4, 4, 'up');
        ST.F.intro = 1;
        busy--;
        await showGuide();
        snapshot(); saveNow();
      },
      async onEnter(rid) {
        const F = ST.F, n = ST.npc.준호;
        if (rid === 'yard' && has('flash') && !F.junGone) {
          F.junGone = 1; npcAt('준호', 'field1', 11, 6, 'up'); n.mute = false; refresh();
          await wait(400); sfx('giggle', 0.06);
          await say([[null, '…히히. 히히히.'], [null, '논 쪽에서 웃음소리가 들린다. 준호 목소리다.'], [ME(), '(작은방 창틀의 쌍안경… 설마.)']]);
        }
        if (rid === 'field1' && F.junGone && !F.infected) {
          F.infected = 1;
          await say([[null, '준호가 논두렁 끝에 서 있다. 할아버지의 쌍안경을 눈에 댄 채로.']]);
          await showCG('t2', '저 멀리 논 한가운데, 무언가 하얀 것이 흔들리고 있다.');
          await say([[ME(), '준호야! 보지 마!'], ['준호', '…쉿. 조금만 더. 저게 뭔지… 거의… 알 것 같아.'], [null, '쌍안경이 툭, 진흙에 떨어졌다.']]);
          sfx('hum', 0.08); n.blue = 0.28; shake = 3;
          await say([['준호', '……알았다.'], ['준호', '히, 히히. 알았어. 저건… 저건 말이야… 히히히히히'], [null, '준호가 웃는다. 얼굴은 하얗게 질렸는데, 입만 웃고 있다.'], [null, '준호는 비틀비틀 집 쪽으로 걸어갔다.'], [ME(), '(할머니가 뭔가 적어 두셨을지도 몰라. 그리고… 저 하얀 걸 오래 보면 안 돼.)']]);
          npcAt('준호', 'small', 6, 3, 'up'); n.blue = 0.28;
          await checkReady();
        }
        if (rid === 'bridge' && !F.bridge) {
          busy++;
          if (!F.alone && !F.named) {
            await say([[null, '마을 다리. 건너편에 희미한 가로등 하나.'], [null, '수첩 그대로 하자. 방울에 소금을 뿌리고, 흔들면서, 이름을 세 번.']]);
            sfx('bell', 0.1);
            let ok = false;
            while (!ok) { ok = await wordPuzzle('🔔 이름을 세 번', '방울을 흔들며 누구의 이름을 불러야 할까?', ['준호', '준호야', '김준호']); if (!ok) await say([[null, '…이름을 불러야 한다. 홀린 아이의 이름을.']]); }
            await say([[ME(), '준호야.'], [ME(), '준호야!'], [ME(), '준호야!!'], [null, '등 뒤 논에서, 무언가 첨벙— 하고 움직였다.'], [null, '뒤돌아보지 마. 앞만 보고 건너.']]);
            F.named = 1;
          } else if (F.named) await say([[null, '…다시. 뒤돌아보지 말고, 앞만 보고.']]);
          else await say([[null, '혼자 다리 앞에 섰다. 등 뒤 논에서 무언가 첨벙— 하고 움직였다.']]);
          busy--;
          snapshot(); F.bridge = 1; driftAt = now() + 3000;
          startChase('kune', 0, 0, 9999, { enterAfter: 2600, back: 'W', speed: 0.95, quiet: true });
          note('뒤돌아보지 말고 오른쪽 끝까지! 준호가 멈추면 확인 버튼으로 방울을 흔들어요.', 3600);
        }
      },
      script: {
        talk준호: async () => {
          const F = ST.F, n = ST.npc.준호;
          if (!F.junGone) return say([['준호', pick(['할아버지 쌍안경이 저기 창틀에 있더라. 할머니가 숨겨 놨다던데… 히히, 안 볼 거야. 아마도.', '여기 와이파이 안 터져. 진짜 심심해.', '할머니가 그러는데, 이 마을 사람들은 여름에 논을 안 쳐다본대. 웃기지?'])]]);
          if (F.infected && !F.ready) return say([[null, '준호가 벽을 보고 선 채 중얼거린다.'], ['준호', '…알았어… 알았어… 히히… 알았어…']]);
          if (F.ready && !n.follow) { n.follow = true; n.mute = true; note('준호가 따라옵니다.'); return say([[ME(), '준호야, 가자. 집에 가자.'], ['준호', '…히히. 응. 가자. 저쪽으로…'], [null, '준호가 고개를 논 쪽으로 돌리려 한다. 손을 꽉 잡았다.']]); }
          return say([['준호', '…히히.']]);
        },
        binoc: async () => {
          const c = await choose('할아버지의 쌍안경. 창문 너머 멀리 논 한가운데에 하얀 점이 보인다…', ['쌍안경으로 논을 본다', '내려놓는다']);
          if (c !== 0) return;
          await say([[null, '렌즈 너머, 논 한가운데. 하얀 것이 몸을 비틀고 있다.'], [null, '팔이… 꺾이면 안 되는 방향으로…']]);
          return caught('…보고 말았다. 그것이 무엇인지 알아 버렸다.\n머릿속이 하얗게 비어 간다. 히, 히히…');
        },
        trunk: async () => {
          if (!has('notebook')) { sfx('page'); give('notebook'); return say([[null, '할머니의 반닫이 안에 낡은 수첩이 있다. 손때가 묻은 페이지를 넘겼다.'], [null, ITEMS.notebook.d]]); }
          await say([[null, '반닫이 안에는 한복과 사진첩. 사진 속 젊은 할머니가 논을 등지고 서 있다.']]);
        },
        hdrawers: async () => {
          if (!has('flash')) { give('flash'); return say([[null, '서랍 안에 낡은 손전등이 있다. 딸깍, 누런 불빛이 들어온다.']]); }
          await say([[null, '실, 바늘, 약봉지, 그리고 「준호 생일」이라고 적힌 봉투.']]);
        },
        saltjar: async () => {
          if (!has('salt')) { ost('yard', 'saltjar').open = true; refresh(); give('salt'); await say([[null, '세 번째 항아리는 소금 항아리다. 굵은 소금을 한 줌 덜었다.']]); return checkReady(); }
          await say([[null, '소금 항아리. 할머니 냄새가 난다.']]);
        },
        bellwall: async () => {
          if (!has('bell')) { ost('shed', 'bell').gone = true; refresh(); give('bell'); sfx('bell', 0.05); await say([[null, '못에 걸린 놋방울을 떼어 냈다. 딸랑— 맑은 소리가 헛간 안에 퍼진다.']]); return checkReady(); }
          await say([[null, '빈 못.']]);
        },
        stonebox: async () => {
          if (ST.F.boxOpen) return say([[null, '빈 돌함.']]);
          const ok = await dialPuzzle('🪨 서낭당 돌함', '돌함에 숫자 자물쇠가 세 개. 이끼 낀 뚜껑에 「집 · 들 · 마당」이라고 새겨져 있다.', '532');
          if (!ok) return;
          ST.F.boxOpen = 1; ost('field2', 'sbox').open = true; refresh(); sfx('unlock'); give('candle');
          await say([[null, '철컥. 돌함 안에 하얀 초와 성냥이 들어 있다.']]);
        },
        shrine: async () => {
          if (ST.F.lit) return say([[null, '촛불이 흔들린다. 바람이 없는데도 논 쪽으로만 기운다.']]);
          if (!has('candle')) return say([[null, '서낭당 돌무더기. 맨 위에 촛농 자국이 있다. 초를 켜 두는 자리 같다.'], [null, '옆에 작은 돌함이 있다.']]);
          take('candle'); ST.F.lit = 1; ost('field2', 'shrine').lit = true; refresh(); sfx('match');
          await say([[null, '초를 세우고 성냥을 그었다. 작은 불꽃이 피어났다.'], [null, '…개구리 소리가 잠깐 멎었다.']]);
          return checkReady();
        },
        toBridge: async () => {
          const F = ST.F;
          if (!F.ready) { sfx('locked'); return say([[null, '마을 다리로 가는 길. …아직은 갈 수 없다. 준비가 덜 됐다.']]); }
          if (!ST.npc.준호.follow) {
            const c = await choose('준호를 두고 혼자 마을을 떠날까?', ['혼자 떠난다', '돌아가서 준호를 데려온다']);
            if (c !== 0) return;
            F.alone = 1;
          }
          F.bridgeOpen = 1; refresh();
          return goRoom('bridge', 'W');
        },
        bridgeEnd: async () => { if (ST.F.bridge) return finish(ST.F.alone ? 'alone' : 'good'); }
      }
    };
    async function checkReady() {
      const F = ST.F;
      if (F.ready || !F.lit || !has('salt') || !has('bell') || !F.infected) return;
      F.ready = 1;
      await say([[ME(), '촛불, 소금, 방울. 이제 준호를 데리고 다리를 건너는 것만 남았어.']]);
      snapshot(); saveNow();
    }
    ch.endings = {
      good: { title: '엔딩 · 다리 건너', body: '다리를 건너는 순간, 개구리 소리가 한꺼번에 멎었다. 준호가 털썩 주저앉더니 엉엉 울기 시작했다.\n「…나 무슨 꿈 꿨어? 하나도 기억 안 나.」\n다음 날 아침 돌아온 할머니는 아무것도 묻지 않고, 준호의 머리를 오래오래 쓰다듬었다. 그리고 쌍안경을 우물에 던져 버렸다.\n그날 밤 툇마루 밑, 어제는 없던 구멍 속으로 나는 다시 떨어졌다.' },
      alone: { title: '엔딩 · 돌아보지 않았다', body: '혼자 다리를 건넜다. 끝까지 뒤돌아보지 않았다.\n그런데 다리 끝에서, 등 뒤 아주 가까이에서 준호가 웃었다.\n「히히… 너도 알고 싶지?」\n…나는 끝까지 돌아보지 않았다.', hint: '준호와 함께 다리를 건너면 다른 엔딩을 볼 수 있어요.' }
    };
    return ch;
  })();

  // =====================================================================
  // 제3장 · 원숭이 꿈 — 꿈속 열차의 안내 방송
  // 꿈속의 낡은 열차. 정차역이 불릴 때마다 맨 뒤의 손님이 한 명씩 사라진다. 다음은 누구 차례일까.
  // =====================================================================
  CHAPTERS[3] = (() => {
    const CAR = ['######################', '##########P###########', '#....................#', 'R....................F', '#....................#', '#....................#', '######################', '######################'];
    const CAR2 = CAR.map((r, i) => i === 1 ? '######################' : r);
    const LAMPS = Array.from({ length: 5 }, (_, i) => [24 + i * 76, 38, 64]);
    const seats = (top, bottom) => top.map(x => ({ t: 'seat', x, y: 2 })).concat(bottom.map(x => ({ t: 'seat', x, y: 5 })));
    let ghost = 0;
    const ch = {
      id: 3, icon: '🚃', title: '원숭이 꿈', sub: '꿈속 열차의 안내 방송', music: 'train', step: 'metal', doorSfx: 'door',
      npcLook: {
        할머니: { hair: 'bun', hairColor: '#9ba1ab', top: 'knit', topColor: '#7a5238', bottom: 'longskirt', bottomColor: '#4a4c55' },
        회사원: { hair: 'part', hairColor: '#231a20', top: 'shirt', topColor: '#f3f0e9', bottom: 'slacks', bottomColor: '#26242b' },
        서윤: { hair: 'pony', hairColor: '#3a2a24', top: 'jacket', topColor: '#2f416b', bottom: 'skirt', bottomColor: '#34394b' },
        엄마: { hair: 'medium', hairColor: '#553728', top: 'cardigan', topColor: '#e8dcc2', bottom: 'wide', bottomColor: '#868990' },
        아이: { hair: 'bob', hairColor: '#231a20', top: 'hood', topColor: '#f0cc55', bottom: 'shorts', bottomColor: '#5c84bd' },
        노신사: { hair: 'slick', hairColor: '#efe6cc', top: 'coat', topColor: '#4a4c56', bottom: 'slacks', bottomColor: '#26242b' }
      },
      guide: [['🚃', '이 장의 규칙', '안내 방송이 울릴 때마다 맨 뒤의 손님이 사라져요. 앞 칸으로, 맨 앞 운전실까지 가야 해요. 쫓아오면 숨을 곳은 없어요. 달려요!']],
      items: {
        gticket: { n: '할머니의 승차권', d: '「원숭이 4호 열차 · 3호차 · 실뜨기 역 하차」 구멍이 뚫려 있다. 아직 따뜻하다.', i: '🎫' },
        myticket: { n: '내 승차권', d: '주머니에 들어 있던 승차권. 「원숭이 4호 열차 · 하차역: (빈칸)」 빈칸이… 조금씩 채워지고 있다.', i: '🎟️' },
        scribble: { n: '좌석의 낙서', d: '「이건 꿈이다 이건 꿈이다 이건 꿈이다. 맨 앞 칸 비상 브레이크를 당기면서 크게 외쳐. 그러면 깬다. ― 세 번째 탑승자」', i: '✍️' },
        cabKey: { n: '운전실 열쇠', d: '노신사의 가방에 있던 무거운 열쇠. 손잡이에 원숭이 얼굴이 새겨져 있다.', i: '🗝️' }
      },
      fresh: () => ({ v: 1, room: 'platform', x: 9 * TS, y: 6 * TS + 6, dir: 'up', F: {}, inv: [], obj: {}, t: 0, npc: {
        할머니: { room: 'car3', x: 3 * TS, y: 5 * TS + 10, dir: 'up' }, 회사원: { room: 'car3', x: 14 * TS, y: 2 * TS + 10, dir: 'down' }, 서윤: { room: 'car3', x: 19 * TS, y: 5 * TS + 10, dir: 'up' },
        엄마: { room: 'car2', x: 6 * TS, y: 2 * TS + 10, dir: 'down' }, 아이: { room: 'car2', x: 7 * TS + 4, y: 2 * TS + 10, dir: 'down' }, 노신사: { room: 'car1', x: 16 * TS, y: 2 * TS + 10, dir: 'down' } } }),
      goal: () => {
        const F = ST.F;
        if (!F.departed) return '열차에 타자. 다른 길은 없다.';
        if (!F.metYun) return '3호차의 손님들에게 말을 걸어 보자.';
        if (!F.door3) return '2호차로 가는 연결문을 열자. 번호는 승차권에 있다.';
        if (!has('cabKey')) return '앞 칸으로 가자. 운전실 열쇠가 필요하다.';
        return '맨 앞 운전실의 비상 브레이크! 뭐라고 외쳐야 하는지 기억하자.';
      },
      caughtArt: 'c3',
      caughtText: () => '작은 손들이 소매를, 발목을, 옷자락을 붙잡았다.\n「손님, 내리실 역입니다.」',
      rooms: {
        platform: { name: '꿈 역 승강장', floor: 'stone', wall: 'train', windows: true, dark: 0.55, seed: 501, step: 'step',
          map: ['##################', '########D#########', '#................#', '#................#', '#................#', '#................#', '#................#', '##################'],
          doors: { D: { to: 'car3', back: 'P' } },
          objs: [{ t: 'lantern', x: 3, y: 4 }, { t: 'lantern', x: 14, y: 4 }, { t: 'seat', x: 6, y: 5, say: '승강장 벤치. 앉은 자리가 축축하다.' }, { t: 'paper', x: 12, y: 5, say: '바닥에 떨어진 시간표. 「원숭이 4호 · 출발 2시 22분 · 종점: 없음」' }, { t: 'pole', x: 1, y: 3, say: '역 이름판. 「꿈 역」. 다음 역 칸은 검게 칠해져 있다.' }] },
        car3: { name: '3호차 (맨 뒤 칸)', floor: 'train', floor2: 'trainmid', wall: 'train', windows: true, dark: 0.45, seed: 502, lights: LAMPS,
          map: CAR,
          doors: { P: { to: 'platform', back: 'D', lock: 'never', lockText: '문이 닫혔다. 창밖에는 아무것도 보이지 않는다.' }, R: { use: 'rear' }, F: { to: 'car2', back: 'R', lock: 'door3', lockUse: 'door3' } },
          objs: seats([1, 12, 16], [1, 7, 12, 17]).concat([{ t: 'pole', x: 9, y: 4 }, { t: 'routemap', x: 5, y: 1, at: 0, use: 'route' }, { t: 'ticket', x: 3, y: 5, showIf: 'ann1', hideIf: 'gotTicket', use: 'gticketPick' }]) },
        car2: { name: '2호차', floor: 'train', wall: 'train', windows: true, dark: 0.45, seed: 503, lights: LAMPS, eyesOut: true,
          map: CAR2,
          doors: { R: { to: 'car3', back: 'F' }, F: { to: 'car1', back: 'R' } },
          objs: seats([2, 6, 11, 16], [2, 8, 13]).concat([{ t: 'pole', x: 7, y: 3 }, { t: 'pole', x: 15, y: 4 }, { t: 'routemap', x: 9, y: 1, at: 1, use: 'route' }, { t: 'paper', x: 14, y: 5, use: 'scribble', hideIf: 'gotScribble' }]) },
        car1: { name: '1호차 (맨 앞 칸)', floor: 'train', wall: 'train', windows: true, dark: 0.5, seed: 504, lights: LAMPS, eyesOut: true,
          map: CAR2,
          doors: { R: { to: 'car2', back: 'F' }, F: { to: 'cab', back: 'R', lock: 'cabOpen', lockUse: 'cabDoor' } },
          objs: seats([1, 14], [1, 6, 11, 16]).concat([{ t: 'rack', x: 6, y: 1, id: 'rack', bag: true, use: 'bag' }, { t: 'pole', x: 10, y: 4 }, { t: 'routemap', x: 11, y: 1, at: 2, use: 'route' }]) },
        cab: { name: '운전실', floor: 'train', wall: 'train', windows: true, dark: 0.5, seed: 505, eyesOut: true,
          map: ['#########', '#########', '#.......#', 'R.......#', '#.......#', '#.......#', '#########', '#########'],
          doors: { R: { to: 'car1', back: 'F' } },
          objs: [{ t: 'console', x: 3, y: 2, say: '계기판의 불빛이 제멋대로 깜빡인다. 속도계 바늘은 끝까지 넘어가 있다.' }, { t: 'brake', x: 6, y: 4, id: 'brake', use: 'brake' }] }
      },
      actors: t => (roomId === 'car2' && ghost > now()) ? [{ y: 3 * TS + 12, draw: gg => drawSaru(gg, 2 * TS, 3 * TS + 12, 'right', t, { alpha: 0.35 + Math.random() * 0.4 }) }] : [],
      onRestore() { ghost = 0; },
      async intro() {
        busy++;
        fadeA = 1; await wait(400); await fade(0, 1200);
        await say([[null, '…덜컹. 덜컹.'], [null, '눈을 떠 보니 낡은 기차역 승강장이었다.'], [null, '역 이름판에는 「꿈 역」이라고만 적혀 있다.'], [ME(), '…이번엔 기차역이야?']]);
        give('myticket', true);
        await announce(['곧 열차가 출발합니다. 이 열차에 타시면… 아주 무서운 일을 겪게 됩니다.', '…그래도 타시겠지요. 다들 그러셨으니까.']);
        await say([[null, '열차 문이 저절로 열렸다. 등 뒤, 승강장 끝은 어둠에 지워져 있다.'], [null, '주머니에 언제 넣었는지 모를 승차권이 들어 있다.']]);
        ST.F.intro = 1;
        busy--;
        await showGuide();
        snapshot(); saveNow();
      },
      async onEnter(rid) {
        const F = ST.F;
        if (rid === 'car3' && !F.departed) { F.departed = 1; sfx('slam'); shake = 6; await say([[null, '쾅. 문이 닫히고, 열차가 덜컹 움직이기 시작했다.'], [null, '맨 뒤 칸. 손님이 세 명 앉아 있다. 모두 눈을 뜨고 있지만… 깜빡이지 않는다.']]); }
        if (rid === 'car2' && !F.ann2) {
          F.ann2 = 1; await wait(600);
          await announce(['다음은 「가위 역」, 가위 역입니다.', '3호차 회사원 손님, 내리실 준비를 해 주십시오.']);
          await flicker(); npcGone('회사원');
          await say([[null, '뒤쪽 칸에서 아주 짧은 비명이 들렸다가, 끊겼다.']]);
          sfx('giggle', 0.04); await showCG('t3', '…뒤 칸 끝에, 작은 차장들이 서서 이쪽을 보고 있었다.'); ghost = now() + 2600;
          await say([['아이', '엄마, 저기 원숭이 아저씨들 또 왔어.'], ['엄마', '…쉿. 보지 마. 눈 마주치면 안 돼.']]);
        }
        if (rid === 'car1' && !F.ann3) {
          F.ann3 = 1; await wait(600);
          const yun = ST.npc.서윤.follow;
          if (yun) {
            await announce(['다음은 「맷돌 역」, 맷돌 역입니다.', '2호차 엄마와 아이 손님, 내리실 준비를 해 주십시오.']);
            await flicker(); npcGone('엄마'); npcGone('아이');
            await say([['서윤', '…그 아이까지. 우리가 앞으로 와서 그런 거야?'], [ME(), '…멈추면 다음은 우리야. 계속 가자.']]);
          } else {
            await announce(['다음은 「맷돌 역」, 맷돌 역입니다.', '3호차 학생 손님, 내리실 준비를 해 주십시오.']);
            await flicker(); npcGone('서윤');
            await say([[null, '…3호차 쪽에서 누군가 내 이름을 불렀다. 서윤의 목소리였다. 그리고 조용해졌다.']]);
          }
        }
      },
      script: {
        rear: async () => { await say([[null, '맨 뒤 칸의 뒷문. 유리창 너머는 새까만 어둠뿐이다. 선로조차 보이지 않는다.'], [null, '…어둠 속에 작은 얼굴들이 둥둥 떠서 이쪽을 보고 있는 것 같다.']]); },
        route: async ctx => { sfx('page'); await say([[null, '노선도. 「꿈 역 → 실뜨기 → 가위 → 맷돌 → ○○ → ○○」'], [null, '뒤쪽 두 역의 이름은 손톱으로 긁어 지워져 있다. 빨간 점이 ' + ['꿈 역', '실뜨기 역', '가위 역'][ctx.o.at || 0] + '에 찍혀 있다.']]); },
        talk할머니: async () => { await say([['할머니', '…몇 번째 꿈이우? 나는 이제 못 깨. 너무 늦었어.'], ['할머니', '젊은이는 앞으로 가. 뒤에 있으면… 먼저 불려.']]); },
        talk회사원: async () => { await say([['회사원', '(넥타이를 꽉 쥔 채 앞만 본다) 이건 꿈이야. 이건 꿈이야. 이건…'], [null, '그는 끝내 대답하지 않았다.']]); },
        talk서윤: async () => {
          const F = ST.F, n = ST.npc.서윤;
          if (n.follow) return say([['서윤', pick(['뒤 돌아보지 마. 그냥 앞으로.', '맨 앞 칸 브레이크. 그리고 외치는 거야. 「이건 꿈이다」.', '…무서워. 그래도 같이 있으니까 괜찮아.'])]]);
          if (!F.metYun) {
            F.metYun = 1;
            await say([['서윤', '…너도 꿈이야? 처음 보는 얼굴이네.'], ['서윤', '난 서윤. 이 꿈 벌써 세 번째야. 방송이 나오면, 맨 뒤 사람부터 하나씩 없어져.'], ['서윤', '깨어나는 방법이 있대. 맨 앞 운전실에서 비상 브레이크를 당기면서 크게 외치는 거야. 「이건 꿈이다!」'], ['서윤', '근데 2호차로 가는 문이 잠겨 있어. 번호가… 승차권이랑 관계있다는 것까진 알아냈는데.']]);
            const c = await choose('서윤이 소매를 붙잡는다. 「…같이 가도 돼?」', ['같이 가자', '여기 있어. 금방 올게']);
            if (c === 0) { n.follow = true; n.mute = true; note('서윤이 따라옵니다.'); await say([['서윤', '고마워. 혼자 맨 뒤에 있기 싫었어.']]); }
            else await say([['서윤', '…응. 기다릴게.']]);
            await wait(700);
            await announce(['다음은 「실뜨기 역」, 실뜨기 역입니다.', '3호차 맨 뒤 할머니 손님, 내리실 준비를 해 주십시오.']);
            await flicker(); npcGone('할머니'); F.ann1 = 1; refresh();
            await say([[null, '불이 다시 들어왔을 때, 할머니가 앉아 있던 자리는 비어 있었다.'], [null, '좌석 위에 승차권 한 장만 남아 있다.']]);
            snapshot(); saveNow();
            return;
          }
          const c = await choose('서윤이 고개를 든다. 「…이제 같이 갈래?」', ['같이 가자', '아직이야']);
          if (c === 0) { n.follow = true; n.mute = true; note('서윤이 따라옵니다.'); }
        },
        talk엄마: async () => { await say([['엄마', '이 애가 자꾸 원숭이 탈을 쓴 아저씨들이 보인대요. …저도 보여요. 뒤 칸 문 너머에.'], ['엄마', '우리는 여기 있을게요. 이 애가 너무 지쳐서 못 걸어요.']]); },
        talk아이: async () => { sfx('giggle', 0.02); await say([['아이', '원숭이 아저씨들은 방송이 나오면 와. 그리고 맨 뒤 사람을 데려가.'], ['아이', '너는… 아직 이름이 안 불렸지? 불리면 막 뛰어야 돼.']]); },
        talk노신사: async () => { await say([['노신사', '자네도 깨어나고 싶은가. 운전실 열쇠는 내 가방에 있네. 저 선반 위.'], ['노신사', '나는… 내릴 역이 가까워서 필요 없어. 어서 가져가게.']]); },
        gticketPick: async () => { ST.F.gotTicket = 1; refresh(); give('gticket'); await say([[null, ITEMS.gticket.d]]); },
        scribble: async () => { ST.F.gotScribble = 1; refresh(); give('scribble'); sfx('page'); await say([[null, '좌석 위에 찢어진 메모지. 볼펜으로 꾹꾹 눌러 썼다.'], [null, ITEMS.scribble.d]]); },
        door3: async () => {
          if (ST.F.door3) return;
          const ok = await dialPuzzle('🚪 차량 연결문', '연결문 잠금장치에 작은 글씨: 「열차 번호 두 자리 + 지금 칸의 호차 번호 두 자리」', '0403');
          if (!ok) return;
          ST.F.door3 = 1; sfx('unlock'); refresh(); await say([[null, '치익— 연결문이 열렸다.']]);
        },
        bag: async () => {
          if (has('cabKey')) return say([[null, '빈 가방. 안쪽에 오래된 승차권이 잔뜩 들어 있다. 날짜가 전부 다르다.']]);
          snapshot();
          ost('car1', 'rack').bag = false; refresh(); give('cabKey'); ST.F.cabOpen = 1;
          await say([[null, '선반의 가방에서 묵직한 열쇠를 꺼냈다.']]);
          await announce(['다음은…', '「' + ME() + ' 역」. ' + ME() + ' 역입니다.', ME() + ' 손님, 내리실 준비를 해 주십시오.']);
          await flicker(); npcGone('노신사');
          sfx('giggle', 0.08);
          await say([[null, '뒤쪽 칸에서 작은 발소리가 다닥다닥 다가온다. 여러 개.'], [null, '뛰어! 맨 앞 운전실로!']]);
          startChase('saru', 0, 0, 9999, { enterAfter: 1700, back: 'R' });
        },
        cabDoor: async () => {
          if (has('cabKey')) { ST.F.cabOpen = 1; refresh(); return; }
          sfx('locked'); await say([[null, '「운전실 · 관계자 외 출입 금지」 열쇠 구멍에 원숭이 얼굴이 새겨져 있다.']]);
        },
        brake: async () => {
          let ok = false;
          while (!ok) {
            ok = await wordPuzzle('🚨 비상 브레이크', '빨간 손잡이를 꽉 쥐었다. 당기면서 외쳐야 한다. 뭐라고?', ['이건꿈이다', '이건꿈이야', '이것은꿈이다', '꿈이다', '이건꿈', '이건꿈이다!', '이건꿈이야!']);
            if (!ok) { const c = await choose('…아니야, 그게 아니야. 뭐라고 외쳐야 했지?', ['다시 외친다', '손을 놓는다']); if (c === 1) return; }
          }
          busy++;
          mon = null; chaseMusic(false);
          ost('cab', 'brake').pulled = true; refresh();
          sfx('brake'); shake = 14;
          await say([[ME(), '이건 꿈이다!!']]);
          if (ST.npc.서윤.follow) await say([['서윤', '이건 꿈이다!!']]);
          busy--;
          return finish(ST.npc.서윤.follow ? 'true' : 'normal');
        }
      }
    };
    async function announce(lines) {
      sfx('chime'); await wait(900);
      await say(lines.map(s => ['📢 안내 방송', '「' + s + '」']));
    }
    async function flicker() {
      sfx('static', 0.08);
      await fade(0.95, 140); await wait(250); await fade(0.4, 90); await wait(90); await fade(0.97, 90); await wait(700);
      await fade(0, 420);
    }
    ch.endings = {
      true: { title: '진엔딩 · 이건 꿈이다', body: '끼이이익— 열차가 멈추고, 모든 불이 꺼졌다.\n눈을 떴다. 숲속 구멍 아래, 차가운 흙바닥이었다.\n휴대폰이 짧게 울렸다. 모르는 번호.\n「나 서윤이야. 깼어. 고마워.」\n「…근데 너, 이번이 몇 번째야?」' },
      normal: { title: '엔딩 · 다음 역', body: '눈을 떴다. 숲속 구멍 아래, 차가운 흙바닥. 꿈이었다.\n…그런데 귓가에 아직 안내 방송이 남아 있다.\n「다음에 또 탑승해 주십시오. 그때는 놓치지 않겠습니다.」', hint: '서윤과 함께 맨 앞 칸까지 가면 다른 엔딩을 볼 수 있어요.' }
    };
    return ch;
  })();

  // ================= the way in: a short film, not played =================
  // the character walks a dark forest path, steps into a hole, falls; black; 「입장 중입니다…」
  const CINE_TREES = (() => { const R = seeded(8080), a = []; for (let x = -20; x < 640; x += 14 + R() * 18) a.push([x, R(), R()]); return a; })();
  const CINE_EYES = [[70, 104], [150, 96], [196, 112], [262, 100], [300, 92], [118, 116]];
  const HOLE = 236;
  function startCine() {
    mode = 'cine'; closePanel();
    cine = { t0: now(), stepAt: 0, fell: false, black: false, done: false };
    if (ui.cap) { ui.cap.hidden = true; }
    ui.skip.hidden = false; ui.title.textContent = '🕳️ 어두운 숲 안쪽'; ui.bag.hidden = true; ui.menuBtn.hidden = true;
    bgm('woods');
  }
  function cinePos(e) {
    // walk, stop to look back once, walk on to the hole
    const walk = e < 3400 ? e : e < 4300 ? 3400 : e - 900;
    return { x: 30 + walk * 0.034, look: e >= 3400 && e < 4300 };
  }
  function caption(text) { if (!ui.cap) return; ui.cap.textContent = text; ui.cap.hidden = !text; }
  function drawCine(t) {
    if (!g || !cine) return;
    const e = now() - cine.t0;
    g.setTransform(1, 0, 0, 1, 0, 0);
    let { x: px, look } = cinePos(e);
    let py = 140, falling = false;
    if (px >= HOLE) {
      if (!cine.fallAt) { cine.fallAt = e; sfx('fall'); caption(''); }
      falling = true; px = HOLE; const k = (e - cine.fallAt) / 1000; py = 140 + k * k * 320;
    }
    const camx = clamp(px - 110, 0, 400);
    // sky and far trees
    g.fillStyle = '#05040a'; g.fillRect(0, 0, VW, VH);
    for (const [x, r1, r2] of CINE_TREES) { const sx = Math.round(x - camx * 0.4); if (sx < -20 || sx > VW + 20) continue; P(g, sx, 20 + r1 * 30, 4 + r2 * 4, 120, '#0c0b14'); }
    for (const [x, r1, r2] of CINE_TREES) { const sx = Math.round(x * 1.3 - camx * 0.75) % 700; if (sx < -30 || sx > VW + 30) continue; P(g, sx, 10 + r2 * 20, 7 + r1 * 5, 140, '#121019'); g.fillStyle = '#100e16'; g.beginPath(); g.arc(sx + 4, 30 + r2 * 20, 16 + r1 * 8, 0, 7); g.fill(); }
    // the ground and the path
    const ox = -camx;
    P(g, 0, 128, VW, 64, '#14110f'); P(g, 0, 134, VW, 14, '#221b16'); P(g, 0, 134, VW, 1, '#2c231c');
    for (let i = 0; i < 60; i++) { const x = (i * 53) % 640 + ox; if (x > -4 && x < VW) P(g, x, 150 + (i * 7) % 30, 3, 1, '#1d2a18'); }
    // red eyes in the bushes, blinking, turning to follow you
    for (const [x, y] of CINE_EYES) {
      const sx = x * 1.1 + ox * 0.9; if (sx < -10 || sx > VW + 10) continue;
      const blink = ((t + x * 97) % 3200) < 140; if (blink) continue;
      const lk = px > x ? 1 : 0;
      g.fillStyle = '#0c0d0a'; g.beginPath(); g.arc(sx + 3, y + 2, 9, 0, 7); g.fill();
      P(g, sx + lk, y, 2, 1, '#ff2a2a'); P(g, sx + 5 + lk, y, 2, 1, '#ff2a2a');
    }
    // the hole
    const hx = HOLE + ox;
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(hx, 141, 13, 4, 0, 0, 7); g.fill();
    P(g, hx - 13, 140, 2, 1, '#3a2c22'); P(g, hx + 11, 140, 2, 1, '#3a2c22');
    // you
    if (!cine.black) {
      g.save();
      if (falling) { g.beginPath(); g.rect(0, 0, VW, 141); g.clip(); }
      drawPerson(g, O.lookOf(O.uid()), px + ox, py, look ? 'left' : 'right', !look && !falling, t);
      g.restore();
      if (falling) { g.fillStyle = '#000'; g.beginPath(); g.ellipse(hx, 141, 13, 4, 0, 0, Math.PI); g.fill(); }
    }
    // rain
    g.strokeStyle = 'rgba(160,170,200,.25)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 70; i++) { const rx = (i * 37 + t * 0.05 * (1 + (i % 3))) % (VW + 20) - 10, ry = (i * 61 + t * 0.32) % (VH + 20) - 10; g.moveTo(rx, ry); g.lineTo(rx - 2, ry + 7); }
    g.stroke();
    // dark all round, a little light on you
    const lg = g.createRadialGradient(px + ox, 128, 16, px + ox, 128, 120);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,.88)'); g.fillStyle = lg; g.fillRect(0, 0, VW, VH);
    // sound and words
    if (!falling && !look && e - cine.stepAt > 420) { cine.stepAt = e; sfx('grass'); }
    if (e > 500 && e < 3300) caption('길이 없는 숲. 빗속에서 빨간 눈들이 따라온다…');
    else if (look) { caption('…방금, 누가 이름을 불렀다.'); if (!cine.wh) { cine.wh = 1; sfx('whisper', 0.07); } }
    else if (!falling && e > 4300) caption('');
    let blackA = 0;
    if (cine.fallAt) { const k = e - cine.fallAt; if (k > 350) shake = 0; blackA = clamp((k - 500) / 500, 0, 1); if (k > 1000) cine.black = true; }
    if (blackA > 0) { g.fillStyle = `rgba(0,0,0,${blackA})`; g.fillRect(0, 0, VW, VH); }
    if (cine.fallAt) {
      const k = e - cine.fallAt;
      if (k > 1500 && k < 4800) { const dots = '.'.repeat(1 + Math.floor((k - 1500) / 400) % 3); caption(''); ui.loading.hidden = false; ui.loading.firstChild.textContent = '입장 중입니다' + dots; }
      if (k > 4800 && !cine.done) endCine();
    }
  }
  function endCine() {
    if (!cine || cine.done) return;
    cine.done = true; ui.loading.hidden = true; ui.skip.hidden = true; caption('');
    mode = 'menu'; showMenu();
  }
  // behind the menu: black, rain, a pair of eyes now and then
  function drawIdle(t) {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05040a'; g.fillRect(0, 0, VW, VH);
    g.strokeStyle = 'rgba(150,160,190,.16)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 50; i++) { const rx = (i * 37 + t * 0.04) % (VW + 20) - 10, ry = (i * 61 + t * 0.25) % (VH + 20) - 10; g.moveTo(rx, ry); g.lineTo(rx - 2, ry + 6); }
    g.stroke();
    const k = Math.floor(t / 4000), ph = (t % 4000) / 4000;
    if (ph > 0.2 && ph < 0.55) { const x = 30 + (k * 71) % 190, y = 40 + (k * 43) % 110; P(g, x, y, 2, 1, '#ff2a2a'); P(g, x + 6, y, 2, 1, '#ff2a2a'); }
    if (fadeA > 0) { g.fillStyle = `rgba(0,0,0,${fadeA})`; g.fillRect(0, 0, VW, VH); }
  }

  // ================= chapters: pick one, title card, the end =================
  const unlocked = id => id === 1 || !!SV.done[id - 1] || /[?&]debug\b/.test(location.search);
  function showMenu() {
    mode = 'menu'; CH = null; room = null; mon = null; chaseMusic(false); fadeA = 0;
    ui.title.textContent = '🕯️ 괴담 수집'; ui.bag.hidden = true; ui.menuBtn.hidden = true;
    bgm('woods');
    const p = panel('tl-menu');
    p.appendChild(el('h3', '', '🕯️ 괴담 수집'));
    p.appendChild(el('p', 'hr-desc', '구멍 아래로 떨어진 곳은, 누군가 들려주던 무서운 이야기 속이었다. 이야기를 끝까지 따라가야 다음 이야기가 열린다.'));
    const list = el('div', 'tl-chs'); p.appendChild(list);
    for (const m of CHMETA) {
      const ready = !!CHAPTERS[m.id], open = ready && unlocked(m.id), done = SV.done[m.id], run = SV.runs[m.id];
      const b = el('button', 'tl-ch' + (open ? '' : ' off') + (done ? ' done' : '')); b.type = 'button';
      const th = artUrl('t' + m.id);
      if (th) { const im = el('img', 'tl-thumb'); im.src = th; im.alt = ''; b.append(im); } else b.append(el('span', 'tl-ic', m.icon));
      b.append(el('span', 'tl-tx', ''));
      b.lastChild.append(el('b', '', `제${m.id}장 · ${m.title}`), el('small', '', !ready ? '준비 중이에요' : !open ? '앞 장을 끝내면 열려요' : run ? '이어서 하기' : done ? '✓ 완료 · ' + Object.keys(done).length + '/' + Object.keys(CHAPTERS[m.id].endings).length + ' 엔딩' : m.sub));
      if (open) b.addEventListener('click', async () => {
        if (run) { const c = await choose(`제${m.id}장 · ${m.title}`, ['이어서 하기', '처음부터', '그만두기']); if (c === 2) return showMenu(); startChapter(m.id, c === 0); }
        else startChapter(m.id, false);
      });
      else b.disabled = true;
      list.appendChild(b);
    }
    const row = el('div', 'hr-row');
    const snd = el('button', 'btn', AU.on ? '🔊 소리 끄기' : '🔇 소리 켜기'); snd.type = 'button'; snd.addEventListener('click', () => { setSound(!AU.on); snd.textContent = AU.on ? '🔊 소리 끄기' : '🔇 소리 켜기'; });
    const film = el('button', 'btn', '🎬 처음 장면 다시 보기'); film.type = 'button'; film.addEventListener('click', () => startCine());
    const out = el('button', 'btn', '숲으로 돌아가기'); out.type = 'button'; out.addEventListener('click', () => close());
    row.append(snd, film, out); p.appendChild(row);
    p.appendChild(el('p', 'tl-small', '※ 각 장은 널리 알려진 도시 괴담을 바탕으로 온라운지가 새로 쓴 이야기예요. 진행은 이 기기에만 저장돼요.'));
    p._close = () => {};
  }
  async function startChapter(id, resume) {
    const C = CHAPTERS[id]; if (!C) return;
    CH = C; ROOMS = C.rooms; ITEMS = C.items;
    closePanel(); mode = 'play'; busy = 0; mon = null; chaseMusic(false); redFlash = 0; shake = 0;
    for (const k in keys) keys[k] = false; order = []; for (const d in touch) touch[d] = 0;
    ST = resume && SV.runs[id] ? JSON.parse(JSON.stringify(SV.runs[id])) : C.fresh();
    if (!resume) { delete SV.runs[id]; storeSV(); }
    ui.title.textContent = `${C.icon} 제${id}장 · ${C.title}`; ui.bag.hidden = false; ui.menuBtn.hidden = false;
    loadRoom(ST.room); pl.x = ST.x; pl.y = ST.y; pl.dir = ST.dir || 'down'; pl.hidden = null; pl.trail = []; pl.auto = null; unstick();
    for (const n of Object.values(ST.npc || {})) if (n.follow) { n.room = ST.room; n.x = pl.x; n.y = pl.y; }
    camSnap(); snapshot(); playStart = now();
    if (C.onRestore) C.onRestore();
    bgm(C.music);
    if (!ST.F.intro) { fadeA = 1; await titleCard(C); if (CH === C && mode === 'play') C.intro(); }
    else { fadeA = 1; fade(0, 600); note(`${ROOMS[ST.room].name} · 이어서 시작해요`); }
  }
  function titleCard(C) {
    return new Promise(res => {
      busy++;
      const d = el('div', 'tl-card'); if (artUrl('t' + C.id)) { d.style.backgroundImage = `linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.78)), url(${artUrl('t' + C.id)})`; d.classList.add('art'); } d.append(el('small', '', `제${C.id}장`), el('b', '', C.title), el('span', '', C.sub));
      ui.stage.appendChild(d); sfx('hum', 0.05);
      setTimeout(() => d.classList.add('on'), 30);
      setTimeout(() => d.classList.remove('on'), 2900);
      setTimeout(() => { d.remove(); busy = Math.max(0, busy - 1); res(); }, 3700);
    });
  }
  async function finish(key) {
    busy += 100; if (mon) mon = null; chaseMusic(false); pl.moving = false;
    ST.ended = 1;
    await fade(1, 1400);
    const E = CH.endings[key], id = CH.id;
    SV.done[id] = SV.done[id] || {}; SV.done[id][key] = 1; delete SV.runs[id]; storeSV();
    const secs = Math.round(ST.t + (now() - playStart) / 1000), mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0');
    busy -= 100;
    const p = panel('tl-end');
    p.appendChild(el('small', 'tl-small', `제${id}장 · ${CH.title}`));
    p.appendChild(el('h3', '', E.title));
    p.appendChild(el('p', 'tl-endtx', E.body));
    p.appendChild(el('p', 'tl-small', `걸린 시간 ${mm}분 ${ss}초 · 찾은 엔딩 ${Object.keys(SV.done[id]).length}/${Object.keys(CH.endings).length}` + (E.hint ? ' · 💡 ' + E.hint : '')));
    const nxt = CHMETA.find(m => m.id === id + 1);
    if (nxt && CHAPTERS[nxt.id]) { const b = el('button', 'btn btn-gold', `제${nxt.id}장 · ${nxt.title}으로`); b.type = 'button'; b.addEventListener('click', () => startChapter(nxt.id, false)); p.appendChild(b); }
    else if (nxt) p.appendChild(el('p', 'tl-small', `제${nxt.id}장 「${nxt.title}」은 준비 중이에요. 곧 열려요!`));
    const m = el('button', 'btn' + (nxt && CHAPTERS[nxt.id] ? '' : ' btn-gold'), '챕터 목록'); m.type = 'button'; m.addEventListener('click', () => showMenu()); p.appendChild(m);
    const again = el('button', 'btn', '이 장 처음부터 다시'); again.type = 'button'; again.addEventListener('click', () => startChapter(id, false)); p.appendChild(again);
  }
  function toMenu() { if (CH && ST && !ST.ended) saveNow(); showMenu(); }

  // ================= the window =================
  function build() {
    root = document.getElementById('horror'); root.innerHTML = '';
    const card = el('div', 'hr-card tl-cardwrap');
    const head = el('div', 'hr-head');
    const title = el('h2', '', '🕯️ 괴담 수집'); head.appendChild(title);
    const btns = el('div', 'hr-btns');
    const bag = el('button', 'btn', '🎒 가방'); bag.type = 'button'; bag.addEventListener('click', () => { if (!busy && mode === 'play') openBag(); });
    const menuBtn = el('button', 'btn', '📖 목록'); menuBtn.type = 'button';
    menuBtn.addEventListener('click', async () => { if (mode !== 'play') return; if (busy || dlg.on || ui.panel) { note('대화나 창을 먼저 닫아 주세요.'); return; } const c = await choose('챕터 목록으로 갈까요? 진행 상황은 마지막 저장 지점에 남아요.', ['목록으로', '계속하기']); if (c === 0) toMenu(); });
    const out = el('button', 'btn', '나가기'); out.type = 'button';
    out.addEventListener('click', async () => { if (busy > 50) return; if (mode !== 'play') return close(); const c = await choose('숲으로 나갈까요? 진행 상황은 마지막 저장 지점에 남아요.', ['나가기', '계속하기']); if (c === 0) close(); });
    btns.append(bag, menuBtn, out); head.appendChild(btns); card.appendChild(head);
    const stage = el('div', 'hr-stage');
    cv = el('canvas', 'hr-cv'); cv.width = VW; cv.height = VH; g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    dk = document.createElement('canvas'); dk.width = VW; dk.height = VH; dkg = dk.getContext('2d');
    stage.appendChild(cv);
    cv.addEventListener('pointerdown', ev => { ev.preventDefault(); ac(); tapAt(ev); });
    const dlgB = el('div', 'hr-dlg'); dlgB.hidden = true;
    const nm = el('b', 'hr-name'), tx = el('p', 'hr-text'), nx = el('span', 'hr-more', '▼');
    dlgB.append(nm, tx, nx); stage.appendChild(dlgB);
    dlgB.addEventListener('click', () => dlgNext());
    const nt = el('div', 'hr-note'); nt.hidden = true; stage.appendChild(nt);
    const cap = el('div', 'tl-cap'); cap.hidden = true; stage.appendChild(cap);
    const loading = el('div', 'tl-loading'); loading.appendChild(el('b', '', '입장 중입니다')); loading.hidden = true; stage.appendChild(loading);
    const skip = el('button', 'btn tl-skip', '건너뛰기 ▶▶'); skip.type = 'button'; skip.hidden = true; skip.addEventListener('click', () => endCine()); stage.appendChild(skip);
    card.appendChild(stage);
    const pad = el('div', 'hr-pad');
    const dp = el('div', 'hr-dpad');
    for (const [d, sym] of [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']]) {
      const b = el('button', 'hr-k hr-' + d, sym); b.type = 'button'; b.setAttribute('aria-label', d);
      const set = v => ev => { ev.preventDefault(); touch[d] = v; if (v) unhideByMove(); };
      b.addEventListener('pointerdown', set(1)); b.addEventListener('pointerup', set(0)); b.addEventListener('pointerleave', set(0)); b.addEventListener('pointercancel', set(0));
      dp.appendChild(b);
    }
    const act = el('button', 'hr-k hr-act', '확인'); act.type = 'button';
    act.addEventListener('pointerdown', ev => { ev.preventDefault(); ac(); if (dlgNext()) return; if (mode === 'play') actQ = true; });
    pad.append(dp, act);
    card.appendChild(pad);
    card.appendChild(el('p', 'hr-tip', '방향키·WASD 또는 화면 클릭(터치)으로 이동 · 「…」 말풍선 물건을 클릭하면 가서 살펴봐요 · 스페이스/엔터 살펴보기·대화 넘기기 · X 가방'));
    root.appendChild(card);
    ui = { dlg: dlgB, dlgName: nm, dlgText: tx, note: nt, stage, panel: null, title, bag, menuBtn, cap, loading, skip };
  }
  function onKey(e) {
    if (!open_ || !root || root.hidden) return;
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (typing) return;
    const c = e.code, down = e.type === 'keydown';
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(c)) {
      e.preventDefault(); keys[c] = down;
      if (down) { order = order.filter(x => x !== c); order.push(c); if (!e.repeat) unhideByMove(); }
      return;
    }
    if (!down) return;
    if (c === 'Space' || c === 'Enter' || c === 'KeyZ' || c === 'NumpadEnter') {
      if (ui.panel && document.activeElement && document.activeElement.tagName === 'BUTTON' && ui.panel.contains(document.activeElement)) return;
      e.preventDefault(); ac();
      if (e.repeat) return;
      if (mode === 'cine') return;
      if (dlgNext()) return;
      if (!ui.panel) { if (mode === 'play') actQ = true; }
      else if (ui.panel._enter) ui.panel._enter();
      return;
    }
    if (c === 'KeyX' || c === 'KeyI' || c === 'Tab') { e.preventDefault(); if (ui.panel && ui.panel._close) ui.panel._close(); else if (!busy) bagQ = true; return; }
    if (c === 'Escape') { e.preventDefault(); if (mode === 'cine') return endCine(); if (ui.panel && ui.panel._close) ui.panel._close(); return; }
  }
  // pressing a direction while hidden comes out (after a short moment, so the key you hid with does not count)
  function unhideByMove() { if (mode === 'play' && pl.hidden && !busy && !dlg.on && !ui.panel && now() - pl.hidden.at > 350) leaveHide(); }
  function releaseKeys() { for (const k in keys) keys[k] = false; order = []; for (const d in touch) touch[d] = 0; }
  function fit() {
    if (!cv || !root || root.hidden) return;
    const stage = ui.stage; if (!stage) return;
    const W = stage.clientWidth, H = stage.clientHeight || W * 0.75;
    const k = Math.max(1, Math.min(W / VW, H / VH));
    cv.style.width = Math.floor(VW * k) + 'px'; cv.style.height = Math.floor(VH * k) + 'px';
  }
  function open(opt) {
    if (!need()) { console.error('ONL not ready'); return; }
    if (window.ONL_MANSION.isOpen && window.ONL_MANSION.isOpen()) window.ONL_MANSION.close();
    opt = opt || {};
    onQuit = opt.onQuit || null;
    window.ONL_MANSION.kit.loadMon && window.ONL_MANSION.kit.loadMon();
    build(); root.hidden = false; open_ = true; ac();
    busy = 0; mon = null; fadeA = 0; redFlash = 0; CH = null; room = null;
    releaseKeys();
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true); window.addEventListener('resize', fit); window.addEventListener('blur', releaseKeys);
    cancelAnimationFrame(raf); lastT = now(); raf = requestAnimationFrame(frame);
    requestAnimationFrame(fit); setTimeout(fit, 120);
    mode = 'menu';
    if (opt.menu) loadArt(() => { if (open_ && mode === 'menu' && !CH) showMenu(); }); else { loadArt(); startCine(); }
  }
  function close() {
    if (!open_) return;
    if (mode === 'play' && CH && ST && !ST.ended && ST.F.intro) saveNow();
    open_ = false; mode = 'off'; cancelAnimationFrame(raf); raf = 0; chaseMusic(false); mon = null; bgm(null); CH = null; room = null;
    window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('resize', fit); window.removeEventListener('blur', releaseKeys);
    clearInterval(dlg.timer); dlg.on = false; const r = dlg.resolve; dlg.resolve = null; if (r) r();
    if (root) { root.hidden = true; root.innerHTML = ''; }
    ui = {};
    const cb = onQuit; onQuit = null; if (cb) cb();
  }
  // how loud the lounge's rain should be while we are open (the forest film is outside; the stories are mostly not)
  function rainLevel() { if (!open_) return 1; if (mode === 'cine') return 0.8; if (mode === 'menu') return 0.35; return CH && CH.id === 1 ? 0.3 : CH && CH.id === 2 ? 0.15 : 0; }
  const api = { open, close, isOpen: () => open_, rainLevel, loadArt, artUrl, hasProgress: () => Object.keys(SV.runs).length > 0 || Object.keys(SV.done).length > 0 };
  if (/[?&]debug\b/.test(location.search)) api._dbg = () => ({ get ST() { return ST; }, get pl() { return pl; }, get mon() { return mon; }, get room() { return roomId; }, get mode() { return mode; }, get busy() { return busy; }, set busy(v) { busy = v; }, get CH() { return CH; }, get panel() { return ui.panel; }, get objs() { return objs; }, get checkpoint() { return checkpoint; }, SV: () => SV, get ROOMS() { return ROOMS; }, killMon: () => { mon = null; chaseMusic(false); }, get cam() { return [camX, camY]; }, tapAt, get grid() { return grid; }, spawnFor, blockedAt, pickAt, facingPoint, setST: v => { ST = v; }, setCH: id => { CH = CHAPTERS[id]; ROOMS = CH.rooms; ITEMS = CH.items; ST = CH.fresh(); }, goRoom, run, give, loadRoom, startChase, startChapter, showMenu, endCine, dlgNext, interact, finish, CHAPTERS });
  return api;
})();
