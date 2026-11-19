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
  const CHECK_EVERY = 20;            // a resting place every so many rows (76m)
  const MAX_HEARTS = 5;              // 3으로 시작, 만나를 먹으면 5까지
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
  let items, sinceItem, rows, hazards, arrows, player, cam, hearts, best, highest, overAt, startedAt, checkRow, shake, wind, msg, msgAt;
  let keys = Object.create(null), touch = { l: 0, r: 0, j: 0 };
  let onQuit = null, board = [], myBest = 0, saving = false;

  // 0에서 시작해 천천히 올라가고, 끝없이 조금씩 더 어려워져요 (1에는 닿지 않음).
  // 300m ≈ 0.21, 450m ≈ 0.29, 1000m ≈ 0.54, 1500m ≈ 0.69. 예전엔 450m에서 이미 0.54였어요.
  const diffAt = r => 1 - Math.exp(-Math.max(0, r) / 340);

  function reset() {
    rows = []; hazards = []; arrows = []; items = []; sinceItem = 0; rowBy = new Map(); maxRow = -1;
    player = { x: W / 2 - PW / 2, y: BASE_Y - PH, vx: 0, vy: 0, onGround: true, face: 1, hurtUntil: 0, animT: 0, safeUntil: 0, boostUntil: 0, lift: null };
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
    maybeItem(row, d);
  }

  // ---- 도움 아이템 ----
  // 방해만 있으면 지치니까, 올라갈수록 조금씩 더 자주 도움도 나와요.
  // 평균 약 45m마다 하나, 너무 오래 안 나오면(20줄 ≈ 76m) 반드시 하나 나오게 해요.
  const ITEM_INFO = {
    manna: { name: '만나' },
    water: { name: '반석의 생수' },
    fire:  { name: '불 기둥' },
    cloud: { name: '구름 기둥' },
    eagle: { name: '독수리 날개' },
  };
  function itemKind(i) {
    const bag = [['manna', 40], ['water', 22], ['fire', 16]];
    if (i > 10) bag.push(['cloud', 20]);
    if (i > 30) bag.push(['eagle', 8]);
    let sum = 0; for (const b of bag) sum += b[1];
    let k = Math.random() * sum;
    for (const b of bag) { k -= b[1]; if (k <= 0) return b[0]; }
    return 'manna';
  }
  function maybeItem(row, d) {
    sinceItem++;
    if (row.i < 6 || row.kind === 'crumble' || row.w < 20) return;
    if (sinceItem < 20 && Math.random() > lerp(0.055, 0.075, d)) return;
    // 가시와 겹치지 않는 자리에 놓기
    const spikes = hazards.filter(h => h.row === row.i && h.t === 'spike').map(h => h.x - row.x);
    let dx = 0;
    for (let n = 0; n < 6; n++) { dx = rnd(5, row.w - 5); if (!spikes.some(sx => Math.abs(sx + 3 - dx) < 9)) break; }
    items.push({ t: itemKind(row.i), row: row.i, dx, t0: Math.random() * 6 });
    sinceItem = 0;
  }
  function takeItem(it, now) {
    const p = player;
    it.taken = true; sfx('ding', 0.5);
    if (it.t === 'manna') {
      if (hearts < MAX_HEARTS) { hearts++; say(`만나를 먹었어요 · 체력 +1`, now); }
      else say('만나로 배부르게 먹었어요', now);
    } else if (it.t === 'water') {
      p.boostUntil = now + 9000; say('반석의 생수! 9초 동안 높이 뛰어요', now);
    } else if (it.t === 'fire') {
      p.safeUntil = now + 3000; say('불 기둥이 지켜 줍니다 · 3초 무적', now);
    } else {
      const n = it.t === 'eagle' ? Math.round(rnd(22, 28)) : Math.round(rnd(10, 14));
      startLift(it.row + n, it.t, now);
      say(it.t === 'eagle' ? `독수리 날개로 업어 주셨어요! +${Math.round(n * ROW * M_PER_PX)}m` : `구름 기둥이 들어 올려요! +${Math.round(n * ROW * M_PER_PX)}m`, now);
    }
  }
  function say(text, now) { msg = text; msgAt = now; }

  // ---- 들어 올리기 (구름 기둥 · 독수리 날개) ----
  function startLift(to, kind, now) {
    for (let i = maxRow + 1; i <= to + 3; i++) genRow(i);
    const r = rowBy.get(to); if (!r) return;
    // 내릴 자리는 안전하게: 넓고, 움직이지 않고, 무너지지 않고, 위험한 것도 없게
    if (r.kind !== 'check') { r.kind = 'rock'; r.span = 0; r.x = r.x0; }
    if (r.w < 40) { const cx = r.x + r.w / 2; r.w = 40; r.x = r.x0 = clamp(cx - 20, 6, W - 46); }
    hazards = hazards.filter(h => h.row < to - 1 || h.row > to + 1);
    const p = player;
    p.lift = { to, kind, startAt: now }; p.vx = 0; p.vy = 0; p.onGround = false;
  }
  function liftStep(dt, now) {
    const p = player, L = p.lift, r = rowBy.get(L.to);
    if (!r) { p.lift = null; return; }
    p.safeUntil = Math.max(p.safeUntil, now + 1200);
    const speed = L.kind === 'eagle' ? 340 : 270;
    const tx = r.x + r.w / 2 - PW / 2;
    p.x += (tx - p.x) * Math.min(1, dt * 3.2);
    p.y -= speed * dt; p.vy = -speed; p.animT += dt * 4;
    // 지나가는 쉼터도 챙겨 줘요 (떨어지면 거기서 다시 시작)
    for (let i = checkRow + CHECK_EVERY; i <= L.to; i += CHECK_EVERY) {
      const cr = rowBy.get(i);
      if (cr && p.y + PH <= cr.y && i > checkRow) reachCheck(i, now, true);
    }
    if (p.y + PH <= r.y) {
      p.y = r.y - PH; p.x = clamp(tx, 0, W - PW); p.vy = 0; p.onGround = true; p.lift = null;
      if (r.kind === 'check' && r.i > checkRow) reachCheck(r.i, now);
    }
  }
  function reachCheck(i, now, quiet) {
    checkRow = i;   // 이제는 높이를 알려주는 이정표예요 (떨어지면 맨 밑부터)
    if (!quiet) { msgFor(i); sfx('ding', 0.4); }
  }
  const CHECK_WORDS = ['여기까지 잘 견뎠어요', '마라의 쓴 물도 달아졌어요', '만나가 내렸어요', '반석에서 물이 났어요', '구름 기둥이 앞서 갑니다', '불 기둥이 지켜 줍니다', '아말렉을 이겼어요', '시내산이 보입니다', '놋뱀을 보세요', '요단이 멀지 않았어요'];
  function msgFor(i) { msg = CHECK_WORDS[(i / CHECK_EVERY - 1) % CHECK_WORDS.length] + ` · ${Math.round(i * ROW * M_PER_PX)}m`; msgAt = performance.now(); }

  // Build only as far as the view needs, and throw away what is far below and out of reach.
  // Building a fixed number of rows past the highest one each frame grew the world without limit,
  // which is what made the game crawl and set the sign to distances nobody had walked yet.
  function groom() {
    const cut = cam + H + 120;
    // 화면보다 한참 아래에 있고, 마지막 쉼터보다도 아래인 발판만 버려요.
    // (예전엔 화면 위쪽 발판까지 버려서 약 450m에서 올라갈 발판이 사라졌어요)
    if (rows.length > 120) {
      const keep = [];
      for (const r of rows) {
        if (r.kind === 'ground' || r.y < cut || r.i >= checkRow - 1) keep.push(r);
        else rowBy.delete(r.i);
      }
      rows = keep;
      hazards = hazards.filter(h => rowBy.has(h.row));
      items = items.filter(it => rowBy.has(it.row) && !it.taken);
    }
    const need = Math.ceil((BASE_Y - cam + 80) / ROW);
    for (let i = maxRow + 1; i <= Math.min(need, maxRow + 12); i++) genRow(i);
  }

  // ================= loop =================
  function step(dt, now) {
    const p = player;
    if (p.lift) { liftStep(dt, now); follow(dt); groom(); return; }
    // controls
    const left = keys['ArrowLeft'] || keys['KeyA'] || touch.l, right = keys['ArrowRight'] || keys['KeyD'] || touch.r;
    const jump = keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || touch.j;
    let ax = (right ? 1 : 0) - (left ? 1 : 0);
    if (ax) p.face = ax;
    p.vx = ax * RUN + wind;
    if (jump && p.onGround) { p.vy = -(now < p.boostUntil ? JUMP * 1.32 : JUMP); p.onGround = false; sfx('kick', 0.25); }
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
          if (r.kind === 'check' && r.i > checkRow) reachCheck(r.i, now);
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
    // 아이템 줍기
    for (const it of items) {
      if (it.taken) continue;
      const r = rowBy.get(it.row); if (!r || r.dead) continue;
      const ix = r.x + it.dx, iy = r.y - 13;
      if (p.x + PW > ix - 5 && p.x < ix + 5 && p.y + PH > iy - 5 && p.y < iy + 6) { takeItem(it, now); if (p.lift) return; }
    }
    // arrows sweep across the higher ground (서서히 늘어나요)
    const d = diffAt(Math.max(0, Math.round((BASE_Y - p.y) / ROW)));
    if (d > 0.25 && Math.random() < (d - 0.25) * dt * 1.8) {
      const fromLeft = Math.random() < 0.5;
      arrows.push({ x: fromLeft ? -8 : W + 8, y: p.y + rnd(-60, 30), vx: (fromLeft ? 1 : -1) * rnd(90, 150) });
    }
    for (const a of arrows) { a.x += a.vx * dt; hit(a.x - 4, a.y - 1, 8, 3, now); }
    arrows = arrows.filter(a => a.x > -30 && a.x < W + 30);

    // sandstorm pushes you about up high
    wind = d > 0.5 ? Math.sin(now / 2600) * (d - 0.5) * 70 : 0;

    // 화면 아래로 떨어지면 광야 맨 밑에서 다시 (체력과 이번 판 최고 높이는 그대로)
    if (p.y > cam + H + 8) { fallToBottom(now); return; }

    follow(dt);
    groom();
  }
  // camera and score
  function follow(dt) {
    const p = player;
    const want = p.y - H * 0.62;
    cam += (Math.min(want, cam) - cam) * Math.min(1, dt * 6);   // follows up quickly, never drops below your best
    const m = Math.max(0, Math.round((BASE_Y - PH - p.y) * M_PER_PX));
    if (m > highest) highest = m;
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
  }
  function hit(hx, hy, hw, hh, now) {
    const p = player;
    if (now < p.hurtUntil || now < p.safeUntil || p.lift || overAt) return;
    if (p.x + PW < hx || p.x > hx + hw || p.y + PH < hy || p.y > hy + hh) return;
    hearts--; p.hurtUntil = now + 1100; shake = 7; sfx('punch', 0.4);
    p.vy = -260; p.vx = 0; p.x = clamp(p.x - p.face * 14, 0, W - PW);
    msg = hearts > 0 ? pick(['바로의 군대가 쫓아옵니다!', '발을 헛디뎠어요', '조심하세요!']) : '여기까지…';
    msgAt = now;
    if (hearts <= 0) finish(now);
  }
  function fallToBottom(now) {
    const keepHearts = hearts, keepHigh = highest;
    reset();
    hearts = keepHearts; highest = keepHigh;
    player.hurtUntil = now + 900;
    shake = 6; sfx('whoosh', 0.4);
    say(highest > 30 ? `떨어졌어요… 처음부터 다시! (이번 판 최고 ${highest}m)` : '떨어졌어요… 처음부터 다시!', now);
  }
  function backToCheck(now, soft) {
    const p = player;
    const r = rowBy.get(checkRow);
    p.x = r ? r.x + r.w / 2 - PW / 2 : W / 2; p.y = (r ? r.y : BASE_Y) - PH;
    p.vx = p.vy = 0; p.hurtUntil = now + 700; p.lift = null;
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
    // 도움 아이템: 둥실둥실 떠 있고 은은하게 빛나요 (방해물과 헷갈리지 않게)
    for (const it of items) {
      if (it.taken) continue;
      const r = rowBy.get(it.row); if (!r || r.dead) continue;
      if (r.y < cam - 30 || r.y > cam + H + 30) continue;
      const bob = Math.sin(now / 300 + it.t0) * 2;
      drawItem(g, it.t, r.x + it.dx, r.y - 13 + bob, now, true);
    }
    drawAura(g, now);
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
  // ---- 아이템 그림 (가운데가 x, y) ----
  function drawItem(g, t, x, y, now, glow) {
    x = Math.round(x); y = Math.round(y);
    if (glow) {
      const a = 0.28 + Math.sin(now / 250) * 0.1;
      g.fillStyle = `rgba(255,236,150,${a})`; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
    }
    if (t === 'manna') {            // 동그란 만나 빵
      P(g, x - 4, y - 2, 8, 5, '#c9a862'); P(g, x - 3, y - 3, 6, 7, '#c9a862');
      P(g, x - 3, y - 2, 6, 4, '#f6ecd0'); P(g, x - 2, y - 3, 4, 6, '#f6ecd0');
      P(g, x - 2, y - 1, 1, 1, '#d9bb79'); P(g, x + 1, y, 1, 1, '#d9bb79'); P(g, x - 1, y + 1, 1, 1, '#d9bb79');
    } else if (t === 'water') {     // 물방울
      P(g, x, y - 5, 1, 2, '#2f7fd8'); P(g, x - 1, y - 3, 3, 2, '#2f7fd8'); P(g, x - 2, y - 1, 5, 4, '#2f7fd8'); P(g, x - 1, y + 3, 3, 1, '#2f7fd8');
      P(g, x - 1, y - 1, 3, 3, '#6fb6ff'); P(g, x - 1, y - 1, 1, 1, '#e8f4ff');
    } else if (t === 'fire') {      // 불꽃
      const f = Math.floor(now / 110) % 2;
      P(g, x - 3, y - 1, 6, 5, '#e0514a'); P(g, x - 2, y - 3 - f, 4, 3, '#e0514a'); P(g, x - 1, y - 5 - f, 2, 2, '#e0514a');
      P(g, x - 2, y, 4, 3, '#f0a030'); P(g, x - 1, y - 2 - f, 2, 3, '#f0a030'); P(g, x - 1, y + 1, 2, 2, '#ffe06a');
    } else if (t === 'cloud') {     // 구름 기둥
      P(g, x - 2, y - 1, 4, 6, '#dfe6f2'); P(g, x - 1, y + 4, 2, 2, '#dfe6f2');
      P(g, x - 5, y - 4, 10, 4, '#ffffff'); P(g, x - 3, y - 6, 6, 2, '#ffffff'); P(g, x - 5, y - 1, 10, 1, '#c4cfdf');
      P(g, x + 3, y - 3, 1, 1, '#c4cfdf');
    } else if (t === 'eagle') {     // 독수리 날개
      const fl = Math.floor(now / 140) % 2;
      P(g, x - 6, y - 3 + fl, 5, 2, '#8a5a3b'); P(g, x + 1, y - 3 + fl, 5, 2, '#8a5a3b');
      P(g, x - 5, y - 1 + fl, 4, 2, '#c99866'); P(g, x + 1, y - 1 + fl, 4, 2, '#c99866');
      P(g, x - 1, y - 3, 2, 6, '#5b3a24'); P(g, x - 1, y - 5, 2, 2, '#f4ead0'); P(g, x, y - 4, 1, 1, '#f0a030');
    }
  }
  // 무적·들어 올림·점프력 효과를 캐릭터 둘레에 보여줘요
  function drawAura(g, now) {
    const p = player, cx = p.x + PW / 2, cy = p.y + PH / 2;
    if (p.lift) {
      const eagle = p.lift.kind === 'eagle';
      for (let k = 0; k < 6; k++) {
        const yy = p.y + PH + 4 + ((now / 40 + k * 9) % 40);
        P(g, cx - 6 + (k * 5) % 12, yy, 3, 2, eagle ? 'rgba(201,152,102,.8)' : 'rgba(255,255,255,.85)');
      }
      if (eagle) drawItem(g, 'eagle', cx, p.y - 3, now, false);
      else { P(g, cx - 8, p.y + PH, 16, 4, '#ffffff'); P(g, cx - 6, p.y + PH + 3, 12, 3, '#dfe6f2'); }
    } else if (now < p.safeUntil) {
      const a = (p.safeUntil - now < 900 && Math.floor(now / 120) % 2) ? 0.12 : 0.32;
      g.fillStyle = `rgba(255,170,60,${a})`; g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fill();
    }
    if (now < p.boostUntil && !p.lift) { P(g, cx - 4, p.y + PH, 2, 1, '#6fb6ff'); P(g, cx + 2, p.y + PH, 2, 1, '#6fb6ff'); }
  }
  function drawClimber(g, now) {
    const p = player, blink = p.hurtUntil > now && !p.lift && now > p.safeUntil && Math.floor(now / 90) % 2;
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
    const slots = Math.max(3, hearts);
    for (let i = 0; i < slots; i++) {
      const x = 6 + i * 11, on = i < hearts, c = on ? (i >= 3 ? '#f0a030' : '#e0514a') : 'rgba(0,0,0,.25)';
      P(g, x + 1, 7, 2, 1, c); P(g, x + 4, 7, 2, 1, c); P(g, x, 8, 7, 2, c); P(g, x + 1, 10, 5, 1, c); P(g, x + 2, 11, 3, 1, c); P(g, x + 3, 12, 1, 1, c);
    }
    // 지금 켜져 있는 도움 효과와 남은 시간
    const buffs = [];
    if (now < player.safeUntil && !player.lift) buffs.push(['fire', player.safeUntil - now, 3000]);
    if (now < player.boostUntil) buffs.push(['water', player.boostUntil - now, 9000]);
    buffs.forEach(([t, left, all], k) => {
      const y = 22 + k * 13;
      g.fillStyle = 'rgba(37,28,44,.6)'; g.fillRect(4, y - 6, 44, 12);
      drawItem(g, t, 11, y, now, false);
      P(g, 19, y - 1, 26, 3, 'rgba(255,255,255,.25)');
      P(g, 19, y - 1, Math.round(26 * left / all), 3, t === 'fire' ? '#f0a030' : '#6fb6ff');
    });
    g.font = '700 13px "Pixelify Sans", "Silkscreen", monospace'; g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(37,28,44,.75)'; g.fillRect(W - 74, 4, 70, 32);
    g.fillStyle = '#fff8ea'; g.fillText(highest + ' m', W - 8, 7);
    g.font = '600 10px "Pixelify Sans", "Silkscreen", monospace'; g.fillStyle = '#e8d9b8';
    g.fillText('최고 ' + Math.max(myBest, highest) + ' m', W - 8, 22);
    if (now - msgAt < 3200) {
      g.textAlign = 'center'; g.font = '700 11px "Pixelify Sans", "Silkscreen", monospace';
      const a = clamp((3200 - (now - msgAt)) / 600, 0, 1);
      g.globalAlpha = a; g.fillStyle = 'rgba(37,28,44,.72)'; g.fillRect(20, H - 34, W - 40, 18);
      g.fillStyle = '#fff8ea'; g.fillText(msg, W / 2, H - 30); g.globalAlpha = 1;
    }
    if (overAt) {
      g.fillStyle = 'rgba(20,16,28,.72)'; g.fillRect(0, 0, W, H);
      g.textAlign = 'center'; g.fillStyle = '#fff8ea';
      g.font = '800 20px "Pixelify Sans", "Silkscreen", monospace'; g.fillText(highest + ' m', W / 2, H / 2 - 40);
      g.font = '700 12px "Pixelify Sans", "Silkscreen", monospace';
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
  // 반짝이는 도움 아이템 설명 (게임 화면에 그리는 그림을 그대로 써요)
  const GUIDE = [
    ['manna', '만나', '체력 +1 (최대 5칸)'],
    ['water', '반석의 생수', '9초 동안 훨씬 높이 점프'],
    ['fire', '불 기둥', '3초 동안 무적'],
    ['cloud', '구름 기둥', '한 번에 약 40~50m 상승'],
    ['eagle', '독수리 날개', '한 번에 약 85~105m 상승 · 드물게 나와요'],
  ];
  function itemGuide() {
    const box = O.el('div', 'wd-guide');
    box.style.cssText = 'background:var(--cream-2);border-radius:7px;padding:8px 10px;display:grid;gap:6px;';
    const h = O.el('div', '', '✨ 도움 아이템');
    h.style.cssText = 'font-weight:700;font-size:13px;';
    box.appendChild(h);
    for (const [t, name, what] of GUIDE) {
      const row = O.el('div', '');
      row.style.cssText = 'display:flex;align-items:center;gap:9px;font-size:12.5px;line-height:1.35;';
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      c.style.cssText = 'width:30px;height:30px;flex:none;image-rendering:pixelated;background:#9cc7ea;border:2px solid #2b2233;border-radius:999px;box-sizing:border-box;';
      drawItem(c.getContext('2d'), t, 8, 8, 0, false);
      const txt = O.el('span', '');
      const b = O.el('b', '', name); b.style.marginRight = '6px';
      txt.append(b, document.createTextNode(what));
      row.append(c, txt); box.appendChild(row);
    }
    return box;
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
    hud.appendChild(O.el('p', 'wd-tip', '←/→ 또는 A/D로 걷고, Space로 뛰어요. 폰은 아래 버튼을 쓰세요. 화면 아래로 떨어지면 맨 밑에서 다시 시작해요! 기록은 이번 판에서 가장 높이 올라간 높이로 남아요. 체력은 만나로만 채울 수 있어요.'));
    hud.appendChild(itemGuide());
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
  return { open, close, isOpen: () => !!root && !root.hidden, _state: () => ({ highest, hearts, rows: rows && rows.length, over: !!overAt, msg, checkRow, maxRow }),
    // 테스트용 (주소에 ?debug 있을 때만)
    _dbg: /[?&]debug/.test(location.search) ? () => ({ get player() { return player; }, get rows() { return rows; }, get rowBy() { return rowBy; }, get cam() { return cam; }, get maxRow() { return maxRow; }, get checkRow() { return checkRow; }, get hazards() { return hazards; }, get hearts() { return hearts; }, set hearts(v) { hearts = v; }, get highest() { return highest; }, get items() { return items; }, take: (it, now) => takeItem(it, now), step: (dt, now) => step(dt, now) }) : undefined };
})();
