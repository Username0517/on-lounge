/*
 * ON-Lounge · 광야 (1층 ROOM 4)
 *
 * A climb with no top, in the spirit of the forty years in the wilderness. One player at a time on
 * their own screen, so several people can be climbing at once without any of it going over the network;
 * only the final height is sent, through the submit_score function in wilderness.sql.
 *
 * The world is made a row at a time as you rise (genRow). Rows are kept reachable by construction:
 * the next platform is never further away than a jump can carry you, and the climb gets harder by
 * narrowing the platforms, widening the gaps and adding more of Pharaoh's army, not by cheating.
 */
window.ONL_WILD = (function () {
  'use strict';
  let O = window.ONL;
  const need = () => (O = O || window.ONL);
  const W = 240, H = 360;            // the world is drawn at this size and then scaled up
  const GRAV = 1500, JUMP = 495, RUN = 104, MAXFALL = 560;
  const PW = 9, PH = 14;             // the climber
  const ROW = 38;                    // height between platforms
  const BASE_Y = 300;                // the ground
  const CHECK_EVERY = 24;            // a resting place every so many rows
  const M_PER_PX = 0.1;              // 10 px is a metre

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.random() * a.length | 0];

  // ---- pixel drawing helpers ----
  const P = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
  const SAND = ['#e3c98d', '#d9bb79', '#c9a862'];
  const ROCK = ['#9a8470', '#857160', '#6d5c4e'];

  // ================= state =================
  let cv, g, root, hud, raf = 0, last = 0, running = false;
  let rowBy = new Map(), maxRow = -1;
  let rows, hazards, arrows, player, cam, hearts, best, highest, overAt, startedAt, checkRow, shake, wind, msg, msgAt;
  let keys = Object.create(null), touch = { l: 0, r: 0, j: 0 };
  let onQuit = null, board = [], myBest = 0, saving = false;

  const diffAt = r => clamp(r / 220, 0, 1);   // 0 at the bottom, 1 once you are properly high

  function reset() {
    rows = []; hazards = []; arrows = []; rowBy = new Map(); maxRow = -1;
    player = { x: W / 2 - PW / 2, y: BASE_Y - PH, vx: 0, vy: 0, onGround: true, face: 1, hurtUntil: 0, animT: 0 };
    cam = BASE_Y - H + 60; hearts = 3; highest = 0; overAt = 0; startedAt = performance.now();
    checkRow = 0; shake = 0; wind = 0; msg = '광야로 나아가세요'; msgAt = performance.now();
    // the ground itself
    rows.push({ i: -1, x: 0, y: BASE_Y, w: W, kind: 'ground' });
    for (let i = 0; i < 40; i++) genRow(i);
  }

  // one platform row, plus whatever is standing on it
  function genRow(i) {
    if (rowBy.has(i)) return;
    const d = diffAt(i), y = BASE_Y - (i + 1) * ROW;
    const check = i > 0 && i % CHECK_EVERY === 0;
    let w = check ? 56 : Math.round(rnd(lerp(44, 20, d), lerp(62, 30, d)));
    const prev = rowBy.get(i - 1);
    const reach = lerp(46, 64, d);
    let x;
    if (!prev) x = rnd(10, W - w - 10);
    else {
      const from = prev.x + prev.w / 2;
      x = clamp(from + rnd(-reach, reach) - w / 2, 6, W - w - 6);
    }
    const kinds = check ? ['check'] : d < 0.25 ? ['rock', 'rock', 'sand'] : d < 0.6 ? ['rock', 'sand', 'move'] : ['rock', 'sand', 'move', 'crumble'];
    const kind = pick(kinds);
    const row = { i, x, y, w, kind, t0: Math.random() * 6, dead: 0, span: kind === 'move' ? rnd(18, 40) * (d + 0.4) : 0, x0: x };
    rows.push(row); rowBy.set(i, row); if (i > maxRow) maxRow = i;
    if (check) return;   // the sign only speaks when you actually get there, not when the row is built
    // Pharaoh's army and the hazards of the road
    const roll = Math.random();
    if (i > 4 && roll < lerp(0.08, 0.42, d) && w >= 26) hazards.push({ t: 'soldier', row: i, x: x + 4, dir: 1, sp: rnd(16, 24) + d * 22 });
    else if (i > 8 && roll < lerp(0.14, 0.6, d)) hazards.push({ t: 'spike', row: i, x: x + rnd(3, Math.max(4, w - 9)), w: 6 });
    if (i > 14 && Math.random() < lerp(0.05, 0.3, d)) hazards.push({ t: 'serpent', row: i, x: x + w / 2, y0: y, amp: rnd(14, 26), t0: Math.random() * 6, sp: rnd(1.1, 2) });
    if (i > 24 && Math.random() < lerp(0.04, 0.26, d)) hazards.push({ t: 'chariot', row: i, y: y - 20, x: Math.random() < 0.5 ? -30 : W + 30, sp: rnd(52, 78) + d * 40 });
  }
  const CHECK_WORDS = ['여기까지 잘 견뎠어요', '마라의 쓴 물도 달아졌어요', '만나가 내렸어요', '반석에서 물이 났어요', '구름 기둥이 앞서 갑니다', '불 기둥이 지켜 줍니다', '아말렉을 이겼어요', '시내산이 보입니다', '놋뱀을 보세요', '요단이 멀지 않았어요'];
  function msgFor(i) { msg = CHECK_WORDS[(i / CHECK_EVERY - 1) % CHECK_WORDS.length] + ` · ${Math.round(i * ROW * M_PER_PX)}m`; msgAt = performance.now(); }

  // Build only as far as the view needs, and throw away what is far below and out of reach.
  // Building a fixed number of rows past the highest one each frame grew the world without limit,
  // which is what made the game crawl and set the sign to distances nobody had walked yet.
  function groom() {
    const cut = cam + H + 120;
    if (rows.length > 120) {
      const keep = [];
      for (const r of rows) {
      if (r.y < cam - 40 || r.y > cam + H + 40) continue;
        if (r.kind === 'ground' || r.y < cut || r.i >= checkRow - 1) keep.push(r);
        else rowBy.delete(r.i);
      }
      rows = keep;
      hazards = hazards.filter(h => rowBy.has(h.row));
    }
    const need = Math.ceil((BASE_Y - cam + 80) / ROW);
    for (let i = maxRow + 1; i <= Math.min(need, maxRow + 12); i++) genRow(i);
  }

  // ================= loop =================
  function step(dt, now) {
    const p = player;
    // controls
    const left = keys['ArrowLeft'] || keys['KeyA'] || touch.l, right = keys['ArrowRight'] || keys['KeyD'] || touch.r;
    const jump = keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || touch.j;
    let ax = (right ? 1 : 0) - (left ? 1 : 0);
    if (ax) p.face = ax;
    p.vx = ax * RUN + wind;
    if (jump && p.onGround) { p.vy = -JUMP; p.onGround = false; sfx('kick', 0.25); }
    if (!jump && p.vy < -120) p.vy += 900 * dt;             // let go early for a shorter hop
    p.vy = Math.min(MAXFALL, p.vy + GRAV * dt);

    const was = p.y;
    p.x = clamp(p.x + p.vx * dt, 0, W - PW);
    p.y += p.vy * dt;
    p.animT += dt * (ax ? 9 : 3);

    // moving platforms travel before we test against them
    for (const r of rows) if (r.kind === 'move') r.x = r.x0 + Math.sin(now / 1000 * 1.1 + r.t0) * r.span;

    // land on a platform only when coming down onto its top
    p.onGround = false;
    if (p.vy >= 0) {
      for (const r of rows) {
        if (r.dead) continue;
        const top = r.y;
        if (was + PH <= top + 1 && p.y + PH >= top && p.x + PW > r.x + 1 && p.x < r.x + r.w - 1) {
          p.y = top - PH; p.vy = 0; p.onGround = true;
          if (r.kind === 'move') p.x = clamp(p.x + (r.x - (r.px != null ? r.px : r.x)), 0, W - PW);
          if (r.kind === 'crumble' && !r.fall) { r.fall = now + 420; }
          if (r.kind === 'check' && r.i > checkRow) { checkRow = r.i; hearts = Math.min(3, hearts + 1); msgFor(r.i); sfx('ding', 0.4); }
          break;
        }
      }
    }
    for (const r of rows) { if (r.kind === 'move') r.px = r.x; if (r.fall && now > r.fall) r.dead = 1; }

    // hazards
    for (const h of hazards) {
      const r = rowBy.get(h.row); if (!r) continue;
      if (h.t === 'soldier') {
        h.x += h.dir * h.sp * dt;
        if (h.x < r.x + 1) { h.x = r.x + 1; h.dir = 1; }
        if (h.x > r.x + r.w - 9) { h.x = r.x + r.w - 9; h.dir = -1; }
        hit(h.x, r.y - 13, 8, 13, now);
      } else if (h.t === 'spike') {
        hit(r.x + (h.x - r.x), r.y - 5, h.w, 5, now);
      } else if (h.t === 'serpent') {
        h.yy = r.y - 14 - (Math.sin(now / 1000 * h.sp + h.t0) * 0.5 + 0.5) * h.amp;
        hit(h.x - 4, h.yy, 8, 10, now);
      } else if (h.t === 'chariot') {
        if (h.x < -40) h.dirx = 1; if (h.x > W + 40) h.dirx = -1;
        h.dirx = h.dirx || (h.x < 0 ? 1 : -1);
        h.x += h.dirx * h.sp * dt;
        if (h.x < -60) h.x = W + 40, h.dirx = -1;
        if (h.x > W + 60) h.x = -40, h.dirx = 1;
        hit(h.x - 9, h.y, 18, 12, now);
      }
    }
    // arrows sweep across the higher ground
    const d = diffAt(Math.max(0, Math.round((BASE_Y - p.y) / ROW)));
    if (d > 0.3 && Math.random() < d * dt * 1.6) {
      const fromLeft = Math.random() < 0.5;
      arrows.push({ x: fromLeft ? -8 : W + 8, y: p.y + rnd(-60, 30), vx: (fromLeft ? 1 : -1) * rnd(90, 150) });
    }
    for (const a of arrows) { a.x += a.vx * dt; hit(a.x - 4, a.y - 1, 8, 3, now); }
    arrows = arrows.filter(a => a.x > -30 && a.x < W + 30);

    // sandstorm pushes you about up high
    wind = d > 0.5 ? Math.sin(now / 2600) * (d - 0.5) * 70 : 0;

    // fell too far: back to the last resting place
    const floorY = checkRow ? (BASE_Y - (checkRow + 1) * ROW) : BASE_Y;
    if (p.y > floorY + 260) backToCheck(now, true);

    // camera and score
    const want = p.y - H * 0.62;
    cam += (Math.min(want, cam) - cam) * Math.min(1, dt * 6);   // follows up quickly, never drops below your best
    const m = Math.max(0, Math.round((BASE_Y - PH - p.y) * M_PER_PX));
    if (m > highest) highest = m;
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    groom();
  }
  function hit(hx, hy, hw, hh, now) {
    const p = player;
    if (now < p.hurtUntil || overAt) return;
    if (p.x + PW < hx || p.x > hx + hw || p.y + PH < hy || p.y > hy + hh) return;
    hearts--; p.hurtUntil = now + 1100; shake = 7; sfx('punch', 0.4);
    p.vy = -260; p.vx = 0; p.x = clamp(p.x - p.face * 14, 0, W - PW);
    msg = hearts > 0 ? pick(['바로의 군대가 쫓아옵니다!', '발을 헛디뎠어요', '조심하세요!']) : '여기까지…';
    msgAt = now;
    if (hearts <= 0) finish(now);
  }
  function backToCheck(now, soft) {
    const p = player;
    const r = rowBy.get(checkRow);
    p.x = r ? r.x + r.w / 2 - PW / 2 : W / 2; p.y = (r ? r.y : BASE_Y) - PH;
    p.vx = p.vy = 0; p.hurtUntil = now + 700;
    if (soft) { msg = checkRow ? '쉼터에서 다시 시작해요' : '다시 올라가 봐요'; msgAt = now; }
  }
  function finish(now) {
    overAt = now; running = false;
    sfx('whoosh', 0.5);
    save();
  }

  // ================= drawing =================
  function draw(now) {
    const sh = shake ? (Math.random() * 2 - 1) * shake * 0.25 : 0;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = diffAt(Math.max(0, Math.round((BASE_Y - player.y) / ROW)));
    // sky: warm sand low down, deep night high up
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, d > 0.6 ? '#2a2550' : d > 0.3 ? '#6a7fb5' : '#8fc3e8');
    sky.addColorStop(1, d > 0.6 ? '#7b5a8a' : d > 0.3 ? '#d6b58a' : '#f3dfae');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.save(); g.translate(sh, -cam + sh);
    // far dunes and stars
    for (let k = 0; k < 3; k++) {
      const yy = BASE_Y - 40 - k * 26, par = 0.25 + k * 0.1;
      g.globalAlpha = 0.35 - k * 0.07; g.fillStyle = k % 2 ? '#c49a62' : '#a8794a';
      for (let x = -40; x < W + 40; x += 40) {
        const bx = x + ((cam * par) % 40);
        g.beginPath(); g.moveTo(bx, cam + H); g.lineTo(bx + 20, yy + (k * 7)); g.lineTo(bx + 40, cam + H); g.fill();
      }
    }
    g.globalAlpha = 1;
    if (d > 0.45) { for (let i = 0; i < 40; i++) { const sx = (i * 61) % W, sy = cam + (i * 97) % H; P(g, sx, sy, 1, 1, 'rgba(255,255,255,.7)'); } }
    // platforms
    for (const r of rows) {
      if (r.y < cam - 30 || r.y > cam + H + 30) continue;
      if (r.dead) continue;
      if (r.kind === 'ground') {
        P(g, 0, r.y, W, 60, SAND[1]); P(g, 0, r.y, W, 2, SAND[0]);
        for (let x = 0; x < W; x += 7) P(g, x + (x * 3 % 5), r.y + 4 + (x % 11), 2, 1, SAND[2]);
        continue;
      }
      const cols = r.kind === 'sand' ? SAND : ROCK;
      P(g, r.x - 1, r.y - 1, r.w + 2, 8, '#2b2233');
      P(g, r.x, r.y, r.w, 6, cols[1]); P(g, r.x, r.y, r.w, 2, cols[0]); P(g, r.x, r.y + 5, r.w, 1, cols[2]);
      for (let x = 2; x < r.w - 2; x += 6) P(g, r.x + x, r.y + 3, 2, 1, cols[2]);
      if (r.kind === 'move') { P(g, r.x + r.w / 2 - 3, r.y + 6, 6, 2, '#6f7280'); }
      if (r.kind === 'crumble' && r.fall) { const k = Math.max(0, (r.fall - now) / 420); if (Math.floor(now / 80) % 2) P(g, r.x, r.y, r.w, 6, '#e0514a'); }
      if (r.kind === 'check') {
        // a little altar with a fire on it
        P(g, r.x + r.w / 2 - 5, r.y - 7, 10, 7, '#9a8470'); P(g, r.x + r.w / 2 - 6, r.y - 8, 12, 2, '#b3a08c');
        const f = Math.floor(now / 120) % 2;
        P(g, r.x + r.w / 2 - 2, r.y - 12 - f, 4, 5, '#f0a030'); P(g, r.x + r.w / 2 - 1, r.y - 14 - f, 2, 3, '#ffe06a');
      }
    }
    // hazards
    for (const h of hazards) {
      const r = rowBy.get(h.row); if (!r || r.dead) continue;
      if (r.y < cam - 40 || r.y > cam + H + 40) continue;
      if (h.t === 'soldier') drawSoldier(g, h.x, r.y - 13, h.dir, now);
      else if (h.t === 'spike') { for (let i = 0; i < h.w; i += 3) { P(g, h.x + i, r.y - 4, 3, 4, '#c9c9d4'); P(g, h.x + i + 1, r.y - 5, 1, 2, '#f0f0f6'); } P(g, h.x, r.y - 1, h.w, 1, '#6f452c'); }
      else if (h.t === 'serpent') drawSerpent(g, h.x, h.yy || (r.y - 20), now);
      else if (h.t === 'chariot') drawChariot(g, h.x, h.y, h.dirx || 1, now);
    }
    for (const a of arrows) { P(g, a.x - 4, a.y, 8, 1, '#8a5a3b'); P(g, a.vx > 0 ? a.x + 4 : a.x - 5, a.y - 1, 2, 3, '#c9c9d4'); }
    drawClimber(g, now);
    g.restore();
    drawHud(now, d);
  }
  function drawSoldier(g, x, y, dir, now) {
    const step = Math.floor(now / 160) % 2;
    P(g, x + 1, y, 6, 4, '#c9a24a');            // helmet
    P(g, x + 1, y + 3, 6, 1, '#8a6a22');
    P(g, x + 2, y + 4, 4, 4, '#d9b48a');        // face
    P(g, x + 3, y + 5, 1, 1, '#2b2233');
    P(g, x + 1, y + 8, 6, 4, '#4a6fb5');        // tunic
    P(g, x + 1, y + 8, 6, 1, '#6f93d6');
    P(g, dir > 0 ? x + 7 : x, y + 6, 1, 7, '#8a5a3b');   // spear
    P(g, dir > 0 ? x + 7 : x, y + 4, 1, 2, '#c9c9d4');
    P(g, x + 1 + step, y + 12, 2, 2, '#2b2233'); P(g, x + 4 - step, y + 12, 2, 2, '#2b2233');
  }
  function drawSerpent(g, x, y, now) {
    const w = Math.sin(now / 160) * 1.5;
    P(g, x - 3 + w, y, 6, 3, '#c0392b'); P(g, x - 2 + w, y + 3, 4, 4, '#a93226');
    P(g, x - 3 - w, y + 7, 6, 3, '#c0392b');
    P(g, x - 2 + w, y + 1, 1, 1, '#ffe06a'); P(g, x + 1 + w, y + 1, 1, 1, '#ffe06a');
    P(g, x - 1, y + 10, 2, 2, '#7b241c');
  }
  function drawChariot(g, x, y, dir, now) {
    const sp = Math.floor(now / 70) % 2;
    P(g, x - 9, y + 2, 10, 7, '#8a5a3b'); P(g, x - 9, y + 2, 10, 1, '#c99866');
    P(g, x - 2, y, 9, 8, '#d9b48a');            // horse
    P(g, x + 5, y - 2, 4, 4, '#d9b48a'); P(g, x + 8, y - 1, 1, 1, '#2b2233');
    P(g, x - 1, y + 8, 2, 3, '#8a5a3b'); P(g, x + 3, y + 8, 2, 3, '#8a5a3b');
    P(g, x - 8, y + 8 + sp, 3, 3, '#2b2233'); P(g, x - 4, y + 9 - sp, 3, 3, '#2b2233');
    P(g, x - 6, y - 2, 1, 5, '#c9c9d4');
  }
  function drawClimber(g, now) {
    const p = player, blink = p.hurtUntil > now && Math.floor(now / 90) % 2;
    if (blink) return;
    const av = O && O.avatar ? O.avatar(O.lookOf(O.uid()), p.vy < -30 ? 'up' : p.face > 0 ? 'right' : 'left') : null;
    if (av) {
      const sw = av.width, sh2 = av.height, sc = PH / sh2 * 1.5;
      g.drawImage(av, Math.round(p.x + PW / 2 - sw * sc / 2), Math.round(p.y + PH - sh2 * sc), Math.round(sw * sc), Math.round(sh2 * sc));
    } else { P(g, p.x, p.y, PW, PH, '#f4a261'); }
  }
  function drawHud(now, d) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    // hearts
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 11, on = i < hearts, c = on ? '#e0514a' : 'rgba(0,0,0,.25)';
      P(g, x + 1, 7, 2, 1, c); P(g, x + 4, 7, 2, 1, c); P(g, x, 8, 7, 2, c); P(g, x + 1, 10, 5, 1, c); P(g, x + 2, 11, 3, 1, c); P(g, x + 3, 12, 1, 1, c);
    }
    g.font = '700 13px "Pixelify Sans", monospace'; g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(37,28,44,.75)'; g.fillRect(W - 74, 4, 70, 32);
    g.fillStyle = '#fff8ea'; g.fillText(highest + ' m', W - 8, 7);
    g.font = '600 10px "Pixelify Sans", monospace'; g.fillStyle = '#e8d9b8';
    g.fillText('최고 ' + Math.max(myBest, highest) + ' m', W - 8, 22);
    if (now - msgAt < 3200) {
      g.textAlign = 'center'; g.font = '700 11px "Pixelify Sans", monospace';
      const a = clamp((3200 - (now - msgAt)) / 600, 0, 1);
      g.globalAlpha = a; g.fillStyle = 'rgba(37,28,44,.72)'; g.fillRect(20, H - 34, W - 40, 18);
      g.fillStyle = '#fff8ea'; g.fillText(msg, W / 2, H - 30); g.globalAlpha = 1;
    }
    if (overAt) {
      g.fillStyle = 'rgba(20,16,28,.72)'; g.fillRect(0, 0, W, H);
      g.textAlign = 'center'; g.fillStyle = '#fff8ea';
      g.font = '800 20px "Pixelify Sans", monospace'; g.fillText(highest + ' m', W / 2, H / 2 - 40);
      g.font = '700 12px "Pixelify Sans", monospace';
      g.fillText('광야의 길이 여기서 멈췄어요', W / 2, H / 2 - 12);
      g.fillText(saving ? '기록을 남기는 중…' : (highest >= myBest ? '내 최고 기록이에요!' : '내 최고 ' + myBest + ' m'), W / 2, H / 2 + 6);
    }
  }
  const sfx = (n, v) => { try { O.sfx(n, v); } catch (e) {} };

  // ================= shell =================
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (running) step(dt, now);
    draw(now);
  }
  function onKey(e) {
    if (!root || root.hidden) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) { e.preventDefault(); keys[e.code] = e.type === 'keydown'; }
    if (e.type === 'keydown' && e.code === 'Escape') close();
  }
  async function save() {
    if (saving) return; saving = true;
    try { await O.submitScore('wilderness', highest); } catch (e) {}
    try { board = await O.topScores('wilderness'); myBest = Math.max(myBest, highest); } catch (e) {}
    saving = false; renderBoard();
  }
  function renderBoard() {
    if (!hud) return;
    const list = hud.querySelector('.wd-board'); if (!list) return;
    list.innerHTML = '';
    list.appendChild(O.el('div', 'wd-bhead', '🏜️ 광야 기록판'));
    if (!board.length) { list.appendChild(O.el('p', 'wd-empty', '아직 아무도 기록을 남기지 않았어요. 첫 번째가 되어 보세요!')); return; }
    board.forEach(r => {
      const row = O.el('div', 'wd-brow' + (r.mine ? ' me' : ''));
      row.append(O.el('b', 'wd-rank', ['🥇', '🥈', '🥉'][r.rank - 1] || r.rank + '등'), O.el('span', 'wd-name', r.name), O.el('span', 'wd-score', r.score + ' m'));
      list.appendChild(row);
    });
  }
  function hudButtons() {
    const pad = O.el('div', 'wd-pad');
    const mk = (cls, label, on) => {
      const b = O.el('button', 'wd-key ' + cls, label); b.type = 'button'; b.setAttribute('aria-label', label);
      const set = v => ev => { ev.preventDefault(); touch[on] = v; };
      b.addEventListener('pointerdown', set(1)); b.addEventListener('pointerup', set(0));
      b.addEventListener('pointerleave', set(0)); b.addEventListener('pointercancel', set(0));
      return b;
    };
    pad.append(mk('wd-l', '◀', 'l'), mk('wd-r', '▶', 'r'), mk('wd-j', '점프', 'j'));
    return pad;
  }
  function build() {
    root = O.$('wild');
    root.innerHTML = '';
    const card = O.el('div', 'wd-card');
    const head = O.el('div', 'wd-head');
    head.append(O.el('h2', '', '🏜️ 광야'));
    const btns = O.el('div', 'tg-row');
    const again = O.el('button', 'btn btn-gold', '다시 도전'); again.type = 'button';
    again.addEventListener('click', () => { reset(); running = true; renderBoard(); });
    const out = O.el('button', 'btn', '나가기'); out.type = 'button'; out.addEventListener('click', close);
    btns.append(again, out); head.append(btns); card.appendChild(head);
    const main = O.el('div', 'wd-main');
    const left = O.el('div', 'wd-left');
    cv = O.el('canvas', 'wd-cv'); cv.width = W; cv.height = H; g = cv.getContext('2d');
    left.append(cv, hudButtons());
    hud = O.el('div', 'wd-side'); hud.appendChild(O.el('div', 'wd-board'));
    hud.appendChild(O.el('p', 'wd-tip', '←/→ 또는 A/D로 걷고, Space로 뛰어요. 폰은 아래 버튼을 쓰세요. 불 피운 쉼터에 닿으면 체력이 하나 차고, 떨어져도 거기서 다시 시작해요.'));
    main.append(left, hud); card.appendChild(main);
    root.appendChild(card);
    renderBoard();
  }
  function open(quitCb) {
    if (!need()) { console.error('ONL not ready'); return; }
    onQuit = quitCb || null;
    build();
    root.hidden = false;
    reset(); running = true; last = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
    O.topScores('wilderness').then(b => { board = b || []; renderBoard(); }).catch(() => {});
    O.myScore('wilderness').then(v => { myBest = v || 0; }).catch(() => {});
  }
  function close() {
    running = false; cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
    keys = Object.create(null); touch = { l: 0, r: 0, j: 0 };
    if (root) { root.hidden = true; root.innerHTML = ''; }
    if (highest > 0 && !overAt) { overAt = 1; save(); }
    if (onQuit) onQuit();
  }
  return { open, close, isOpen: () => !!root && !root.hidden, _state: () => ({ highest, hearts, rows: rows && rows.length, over: !!overAt, msg, checkRow, maxRow }) };
})();
