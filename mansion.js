/*
 * ON-Lounge · 숲속의 저택
 *
 * 1) 이야기 모드: 혼자 하는 탈출 추리 공포 게임. 친구 철수·훈이·유리와 저택에 갇히고,
 *    방을 뒤져 단서와 열쇠를 모으고, 퍼즐을 풀고, 괴물에게서 도망치거나 숨어요.
 *    진행은 이 기기(localStorage)에만 저장되고, 서버로는 아무것도 보내지 않아요.
 * 2) 술래잡기(hunt.js)가 같이 쓰는 그림·소리·충돌 도구도 여기 있어요 (ONL_MANSION.kit).
 *
 * The world is tiles of 16 px. Each room is a little ASCII map plus furniture. The view is 256×192
 * game pixels scaled up crisply. Dialogue and puzzles are plain HTML on top, so Korean text stays sharp.
 */
window.ONL_MANSION = (function () {
  'use strict';
  let O = window.ONL;
  const need = () => (O = O || window.ONL);
  const TS = 16, VW = 256, VH = 192;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.random() * a.length | 0];
  const P = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
  const now = () => performance.now();
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // 괴물 4종 (사용자가 직접 그린 그림을 원래 픽셀 크기로 되돌린 것)
  const MON_SRC = {
    blue: 'data:image/png;base64,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',
    grin: 'data:image/png;base64,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',
    scream: 'data:image/png;base64,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',
    crawl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAeCAYAAACWsbYLAAALp0lEQVR4Xs1YWXNU1xH+zrnLrBpJo2W0jARIGGNLgF22WbwBAduxHSeOl8KuVMUPyR9w5T/kJe+pvPnRZSepciUxZRvKNl7BILAxICGQNGIkzabZ95l770l1jwQIBNgxSaVLKmnm3nvO+bq//rr7CvwXTQqpFBQEBCQ02LCglBIrWyr6VsHh6/QDhdZf+vfafT/Z9J+8wm1MColf7n0BpumG1+vGibOnEF2aV4VqQQghMDI4gl3jO+F1++D1uFGtVpEr5PHPz/6BmlW/a0eTd22lFRMCyjRMZRiGen7vswgGOjES3oBQZw9GwhuxY/wBSClVf88ggm0dMKSGvp5utPn86O3ugRQCjz34OHSpK03TKbY/2e56JKXQ8PpTh2CaLvT39cFteuD3+SEcOq9Eo1mDtCRs5WDj4DDC/WGE+8ItIAJwbAcjYgQ+jx+np77FYvIKUX6V4v+R/ahImqapBISiXDOkoSSkEkJe9bYuDfXygVfRsJoo1ypILqdgWU0ox0Z7sB3dHV0IdYewZ8dOuFwuijosuwnbtiE0QGoCTbpfOdANHa8+9RJee/p1aFJXhvQqXZi0F/8aBv//g+yOHpJCU7qu8WH7ewbwxI7HMDo0CtM0UK/XMDk7jcNfHYatFF7d/woe3L4NhUIJ2UIOmVwO7e0dCHh8GOwfgMttQkLA5XEhvpjCsTNfYiEexc927sX9W7aiUWvg7ff/BqlLeFxujI3cxyxI57L4/PRXqNerGO4bhsfjwcdfH0XdqUM5DrHitjjuSFchgWf3HMCmwREYhgmf14f2QAdq1RqEEti+dZwpp5TCp6c+wwPbtrOvA/4ACqUidCkgJWA7douRUqLZsNC0m/C4PDANFzuwWq6hXq9joLcfxUqRI0riRPS17SYCfj/KQsDtdcPn8WL/rr04NXka8XT8jtG8Lcih0JAyNRMj4S3o7+2D2+uCrutQtoJyFB9CSIHlXBaNRgPJ5SSi0Sg2hDfAdJkIdfUiGotiMRmD3+OH23BBmhKarsMhijLzgGh8Ce3+DkAKDPT0oV7vxLmZSVyMTGPL8GZomkRPZzdcpsls7e/pg+jqhcftRyqXxrGJj5WhGWhYjXUjui5Iyjt66MmHnkDAG0C4fxChUIjzhCLrWA57ulwsoVgswedyw+/xYN/OvYhlEujs6IRP+TjvQsFe5Ep5jlalVoWsCRTLRXZSmy+A/p5+SE2iUq9yLgYC7UzBjbUNOD9zAcVKCVs33QuvxwdN05ErZHF26nsMDQxi0+AwC5pLd8NBiynr2U3INU1Tb77xJto8fvT19qJaqaK3rxealHDslehRnaBlmxYWo0ucf9LQSIYwFZnBdxfP4oV9z7KDuM4LB5Ztw1GK6UqbZvI5/i2UC0jn0xjsHkRvVzc6/AF2Jt20nM3g2Mkv4PP40N7WzjQtlPNIpJKYi0Xw5IOP496RezA5cxlHvvmAU0YDSB/W4LpJXR3HwZbhUfT19HJu0WfKa6Uon1rPUhdD0STQGoHTJW9gORZK1SJyxSx/Fho9R1G3GBh1NnQIx1FoNBuwbfpeoFKpoNqo8l4OFxoJ23K4maBctpWFptXgCOuaDkrySq2IUq2MdDZDgcHu7Y9SbYXb5aGd1ijvTSAN3YBt2SwOlPRdwS4Uc3nYTbuVgwBy6RwK+QKSiSSDtm0C3KJLZ1sHcpUMDn9xGLHUEmrNGnKFHN9DJYPKpW1ZSKZTWM5nkS/mGFyhlEcul8PclTksJBZRqZQRCvZg30OP48zUBOaW5pDKpliNJ2fPsoZ9c+44jh4/CqvZQIevHW/84rfY++A+PifFQl9pJtbkJFHV6/JCkRo2bSzEF6FLieHwEArFIoPQdAnLspDKJDlaygGCbZ2QmoZkJgnD0DnfLs5Po697EOHeQVTrNbQHOrkUkJti6TiLTya/jNkrMxge2MQRmo1FUCqXmDE+rxdjI2MIBbtx6MAhvP/lYSwmFriuuqSOurKIDSKeiSM1kVJ+lw+7tj2Kjf1DeG7Pc/jw5IetCNpYC5IOTYX80uwlHD52FNPRC6x/f/rDH+HztFHXDBsKlWoZb7//V8SWY3CZLhx69lUMhsJoNputUt0qFrxeqVJm4KVSGdHEIl8xTZPbN11qXErml2ahaZuxnEmhTHQvZXkZu2Hh508+g56uHnS2d6IQy2Pb5h24OD9F6ne1ndeEhmK1hI9OfIB7N2zF7h178OjYbnz27ecc0TV0pUMREDrQpcVJzj06yOffHGeqkbhQuYvGFjGzNINirXWgP7/7F+TyrYOVqhUIIWFCZyYksknEMwnEl+OIpRJIpFO8j8/tx/joOJ5//DluKi7PT2NpeQHZFkBO4YnpCZz8foLzkvKaci+yNIdw7zBT0mu2uh4qHc5KQ7AQncGVWBQ+fzvu3zjOC60BKaXGdbDebLAyErVIRcnrhJ/+lmslzEYjECwR14p8Kr2M5XwGseUE56ctFCsqTRVUPxPZVKvGQuHU+TNIZpdZqIaHN+CZJ59BqVaEQ9y/OmyBQR05cQSFYgH7H9kLTUgUKwUk0kvYMrQVDbt1hutMlJ0mPjl5FIVCHoZusjPWgDSlhmBbEFORKbx08GW8cvAVvLjvJdw3eu9K96HgMd144L5tOPT0b1pCJCQeGt8Ny3G48GcLWZBGOspGIh1DtVYhWUYyk0K+VGTQ0XgEZy6cRtNpIJlKIhQM4ZHxXcya6822yVUO5pfmWbgO7DzIlxvNOi4vTiPgb6cz3NjDsjrSfslMgsvWVeGhhnvT4Ch7cyY6i13bd3KRpwLOYLSWNOqaAZfphsd04bWnD/HmNC+ahgHbVqg3qJ9s7Vu3qihXSlznaI1qtcKlgxyQL+VwdvIstmxqObC/qw+n1+lXTN2F4+e+xn7vAXaooVEeW3xnuVpWRPtStXjduN0qVaVaCfHs0krpWrH9uw+qcHcYk3OTLNm/f/F3MDSd57yB0GBLMDw6bxSPJzhPao06UukUCqUC5yJFaeLCSYoQH0LXDGU7/Dbg6uC/ykfuS6l4Sw2/2vdreD0eyi28++E7XB9Xc4zvF0JtHtqMsdFt+Ndn78GyrzXk1J1RClxP85VJZdWoSQPligr62jF16TxOnT/BRfqt997iBE7lM4BUWEosIRKJYHZ2BplsGulcBpMzF/mgiVQK87EoZhdnmYKrRnLfMu5SW/1Aq1ILp9WVCHLWe5/8nVW5KxCEy/BA09fSVpNUugyUKkUCuIbSKwBvtKt7MT6G7SgWjtOXTrMc28oWttLVsdOfYHRoK7ymB9H4Ah+RBGN89D52TyR2BcVSERStqcg56q/X3e0WB+GtVyN65OsjOLD7AHaO7caX3326Gg1eUUgdVqOJWq22uv719LzjuEgg1T3D9/BYRDpkqSY/ZDsVUapK9d30GWwOj3J/SiKSzmfhNd1Ms8uz0/jeLrHyclTWGWMHusNYSEVvRr9iXLYAkconFcmg6TKw75GDrJAr16j+issLl1RXoAsP3/8wJi5M3M5xN5kk/vtdAZyLfA/LWaVXy2zHERQlGnVIMJRUaNg1jmi1WUXFYoCr1FhjmtTU1o1jcLupl1zfVtovNppEqI2k6Yb2vNZUrJrA3GKE3j78KIBkOqnpZOQ8hkMbcCUW4dp1o73z0dutCYJzi0YbD3KlHE/v1LLdaIamq6HQRm7/Li9M3ymKbFbTwuyVOe6gGiRWNzxFNTxTSiFsD91yvVsZCY+oNWo8t1FNWseuigS9UKLOh9q0rvYgD8rrmeXY3OjPLl2iy+tGesWuXiP6E8BKo4YTZ7+6QSBpcrGEZdtiZn72R4O8RoZWUb3jyyEpoAxdV2Mbt6mRwXtIKNc8Q+ts6BtRHpeH5POO6zFVhVRBf5d64oF9il6GmZpxu+d+0Jp3w/itXQvkTZuqYKDrBzls1QjkzrE9ym262YF344B3zQjoLRb7USDJUX3BgR8c+f+13S2vK13SO9y7tt7/s92SGT/J/g1NON1zDib3rQAAAABJRU5ErkJggg==',
  };
  const MON_INFO = {
    blue: { name: '물끄러미', foot: [12, 6] },
    grin: { name: '히죽이', foot: [14, 6] },
    scream: { name: '아우성', foot: [12, 6] },
    crawl: { name: '거미손', foot: [26, 6] }
  };
  const MON = {};
  function loadMon() {
    for (const k in MON_SRC) {
      if (MON[k]) continue;
      const img = new Image(); MON[k] = { img, ready: false };
      img.onload = () => { MON[k].ready = true; MON[k].w = img.width; MON[k].h = img.height; };
      img.src = MON_SRC[k];
    }
  }
  // feet at (x, y). The crawler's art faces left, so it is mirrored when it goes right.
  function drawMon(g, kind, x, y, dir, t, opt) {
    const m = MON[kind]; if (!m || !m.ready) return;
    opt = opt || {};
    const moving = opt.moving !== false;
    const bob = moving ? (Math.floor(t / 140) % 2) : 0;
    const shake = opt.rage ? (Math.random() * 2 - 1) : 0;
    const w = m.w, h = m.h;
    g.save();
    if (opt.alpha != null) g.globalAlpha = opt.alpha;
    // a dark, soft shadow under its feet
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y, Math.min(w * 0.45, 18), 3, 0, 0, Math.PI * 2); g.fill();
    const flip = kind === 'crawl' ? dir === 'right' : false;
    g.translate(Math.round(x + shake), Math.round(y - bob));
    if (flip) g.scale(-1, 1);
    // humanoids lean a pixel toward where they walk
    const lean = kind !== 'crawl' && moving ? (dir === 'left' ? -1 : dir === 'right' ? 1 : 0) : 0;
    g.drawImage(m.img, Math.round(-w / 2 + lean), -h);
    g.restore();
  }

  // ================= sound (made on the spot; no files to load) =================
  const AU = { ctx: null, on: true, master: null, chase: null, heartAt: 0 };
  try { AU.on = localStorage.getItem('onl_mn_sound') !== '0'; } catch (e) {}
  function ac() {
    if (!AU.on) return null;
    if (!AU.ctx) {
      try { AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.55; AU.master.connect(AU.ctx.destination); } catch (e) { AU.on = false; return null; }
    }
    if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {});
    return AU.ctx;
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), gn = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn); gn.connect(AU.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, freq, q, delay) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 800; f.Q.value = q || 1;
    const gn = c.createGain(); gn.gain.setValueAtTime(vol || 0.2, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(gn); gn.connect(AU.master); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  const SFX = {
    // a dress shoe on old floorboards: 또 (heel) … 각 (sole)
    step: () => { const k = (AU.alt = !AU.alt) ? 1.04 : 0.96; noise(0.02, 0.3, 3300 * k, 4); tone(2100 * k, 0.04, 'sine', 0.08, 1750 * k); tone(480 * k, 0.06, 'triangle', 0.2, 260 * k); noise(0.025, 0.14, 2300 * k, 3, 0.075); tone(360 * k, 0.04, 'triangle', 0.08, 240 * k, 0.075); },
    tick: () => { noise(0.012, 0.2, 4200, 5); tone(1800, 0.02, 'square', 0.03); },
    door: () => { noise(0.35, 0.12, 500, 3); tone(180, 0.35, 'sawtooth', 0.03, 120); },
    creak: () => { tone(320, 0.6, 'sawtooth', 0.025, 210); tone(410, 0.5, 'triangle', 0.02, 260, 0.1); },
    locked: () => { noise(0.08, 0.15, 1800, 4); noise(0.08, 0.12, 1500, 4, 0.1); },
    unlock: () => { noise(0.06, 0.15, 2400, 6); tone(880, 0.12, 'square', 0.04, 0, 0.08); },
    pick: () => { tone(660, 0.12, 'triangle', 0.12); tone(990, 0.2, 'triangle', 0.1, 0, 0.08); },
    slam: () => { noise(0.5, 0.5, 120, 0.7); tone(60, 0.5, 'sine', 0.4, 35); },
    sting: () => { tone(220, 1.1, 'sawtooth', 0.09, 110); tone(233, 1.1, 'sawtooth', 0.08, 116); noise(0.8, 0.18, 2600, 0.6); },
    catch: () => { noise(1.2, 0.5, 400, 0.4); tone(90, 1.2, 'sawtooth', 0.25, 40); },
    heart: () => { tone(58, 0.14, 'sine', 0.35); tone(52, 0.16, 'sine', 0.3, 0, 0.18); },
    hide: () => { noise(0.25, 0.08, 700, 2); },
    water: () => { for (let i = 0; i < 6; i++) noise(0.15, 0.05, 900 + Math.random() * 600, 3, i * 0.12); },
    box: () => tone(1046, 0.5, 'sine', 0.06),
    bad: () => { tone(150, 0.25, 'square', 0.06, 110); },
    shoot: () => { noise(0.12, 0.2, 2000, 1.5); tone(500, 0.12, 'triangle', 0.06, 180); },
    hit: () => { noise(0.15, 0.25, 600, 1); tone(140, 0.15, 'square', 0.08, 80); }
  };
  const NOTE_HZ = { 도: 261.63, 레: 293.66, 미: 329.63, 파: 349.23, 솔: 392.0, 라: 440.0, 시: 493.88, '높은도': 523.25 };
  function pianoNote(n) { const f = NOTE_HZ[n]; if (!f) return; tone(f, 1.1, 'triangle', 0.16); tone(f * 2, 0.6, 'sine', 0.04); }
  function sfx(n) { try { if (SFX[n]) SFX[n](); } catch (e) {} }
  // the chase: a low drone with a pulse that speeds up when it is close
  function chaseMusic(on) {
    const c = on ? ac() : AU.ctx;
    if (!on) { if (AU.bgm && AU.ctx) AU.bgm.g.gain.setTargetAtTime(0.16, AU.ctx.currentTime, 1.5); if (AU.chase) { try { AU.chase.g.gain.setTargetAtTime(0.0001, AU.ctx.currentTime, 0.3); const ch = AU.chase; setTimeout(() => { try { ch.o1.stop(); ch.o2.stop(); } catch (e) {} }, 1500); } catch (e) {} AU.chase = null; } return; }
    if (!c || AU.chase) return;
    const g = c.createGain(); g.gain.value = 0.0001; g.connect(AU.master);
    const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 58.3;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    o1.connect(f); o2.connect(f); f.connect(g); o1.start(); o2.start();
    g.gain.setTargetAtTime(0.09, c.currentTime, 0.4);
    AU.chase = { g, o1, o2 };
    if (AU.bgm) AU.bgm.g.gain.setTargetAtTime(0.04, c.currentTime, 0.4);
  }
  // the house itself: a low uneasy drone, wind through the cracks, and a broken music box now and then.
  // It sinks under the chase music while something is after you.
  function bgm(on) {
    if (!on) {
      if (AU.bgm) { const b = AU.bgm; AU.bgm = null; clearTimeout(b.timer); try { b.g.gain.setTargetAtTime(0.0001, AU.ctx.currentTime, 0.5); } catch (e) {} setTimeout(() => { for (const n of b.nodes) try { n.stop(); } catch (e) {} }, 2500); }
      return;
    }
    const c = ac(); if (!c || AU.bgm) return;
    const g = c.createGain(); g.gain.value = 0.0001; g.connect(AU.master);
    const nodes = [], t = c.currentTime;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(g);
    for (const [f, ty, v] of [[55, 'triangle', 0.32], [55.4, 'sine', 0.22], [77.8, 'sine', 0.12], [110.6, 'triangle', 0.05]]) {   // A and a sour tritone
      const o = c.createOscillator(), og = c.createGain(); o.type = ty; o.frequency.value = f; og.gain.value = v;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.05 + Math.random() * 0.08; lg.gain.value = v * 0.6; lfo.connect(lg); lg.connect(og.gain);
      o.connect(og); og.connect(lp); o.start(t); lfo.start(t); nodes.push(o, lfo);
    }
    // wind
    const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let br = 0;
    for (let i = 0; i < len; i++) { br = (br + (Math.random() * 2 - 1) * 0.02) * 0.998; d[i] = br * 6; }
    const ws = c.createBufferSource(); ws.buffer = buf; ws.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.8;
    const wl = c.createOscillator(), wlg = c.createGain(); wl.frequency.value = 0.07; wlg.gain.value = 260; wl.connect(wlg); wlg.connect(wf.frequency);
    const wg = c.createGain(); wg.gain.value = 0.5; ws.connect(wf); wf.connect(wg); wg.connect(g); ws.start(t); wl.start(t); nodes.push(ws, wl);
    g.gain.setTargetAtTime(0.16, t, 2.5);
    const B = AU.bgm = { g, nodes, timer: 0 };
    // the music box: a few slow notes from a minor scale with a flat second, slightly out of tune, with an echo
    const SC = [880, 932.3, 1046.5, 1174.7, 1244.5, 1396.9, 1318.5, 1760];
    const box = () => {
      if (AU.bgm !== B) return;
      const cc = AU.ctx; if (cc && !AU.chase) {
        const n = 2 + Math.floor(Math.random() * 3); let at = cc.currentTime + 0.05;
        for (let i = 0; i < n; i++) {
          const f = SC[Math.floor(Math.random() * SC.length)] * (1 + (Math.random() - 0.5) * 0.012);
          for (const [dl, vv] of [[0, 0.05], [0.33, 0.02], [0.66, 0.008]]) {
            const o = cc.createOscillator(), og = cc.createGain(); o.type = 'sine'; o.frequency.value = f;
            og.gain.setValueAtTime(0.0001, at + dl); og.gain.exponentialRampToValueAtTime(vv, at + dl + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, at + dl + 1.8);
            o.connect(og); og.connect(AU.master); o.start(at + dl); o.stop(at + dl + 1.9);
          }
          at += 0.45 + Math.random() * 0.5;
        }
        if (Math.random() < 0.18) tone(41, 1.6, 'sine', 0.12, 36, 0.3);   // a deep thud somewhere upstairs
      }
      B.timer = setTimeout(box, 6000 + Math.random() * 9000);
    };
    B.timer = setTimeout(box, 3500);
  }
  function setSound(on) {
    AU.on = on; try { localStorage.setItem('onl_mn_sound', on ? '1' : '0'); } catch (e) {}
    if (!on) { chaseMusic(false); bgm(false); if (AU.ctx) AU.ctx.suspend().catch(() => {}); }
    else if (open_) setTimeout(() => bgm(true), 50);
    else ac();
  }

  // ================= tiles, walls and floors =================
  const FLOORS = {
    wood: (g, x, y, tx, ty) => { const row = ty % 2; P(g, x, y, 16, 16, row ? '#5a4032' : '#614536'); P(g, x, y + 15, 16, 1, '#3e2a21'); P(g, x + ((tx * 7 + ty * 5) % 16), y, 1, 15, '#4a3328'); if ((tx + ty) % 5 === 0) P(g, x + 4, y + 6, 3, 1, '#6d4f3e'); },
    dark: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, ty % 2 ? '#3e2e27' : '#43322a'); P(g, x, y + 15, 16, 1, '#2a1e19'); P(g, x + ((tx * 7 + ty * 5) % 16), y, 1, 15, '#33251f'); },
    tile: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, (tx + ty) % 2 ? '#7d7f84' : '#8f9196'); P(g, x, y, 16, 1, '#6a6c71'); P(g, x, y, 1, 16, '#6a6c71'); if ((tx * 3 + ty) % 7 === 0) P(g, x + 5, y + 9, 4, 1, '#5c5e63'); },
    check: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, (tx + ty) % 2 ? '#2f2c33' : '#b9b3a6'); P(g, x, y, 16, 1, 'rgba(0,0,0,.18)'); },
    carpet: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, '#5a2329'); P(g, x + 2, y + 2, 1, 1, '#6e2c33'); P(g, x + 10, y + 9, 1, 1, '#6e2c33'); P(g, x + 6, y + 13, 1, 1, '#4a1c21'); },
    stone: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, '#45424a'); P(g, x + (ty % 2) * 8, y, 1, 8, '#2f2d33'); P(g, x + 8 - (ty % 2) * 8, y + 8, 1, 8, '#2f2d33'); P(g, x, y + 7, 16, 1, '#2f2d33'); P(g, x, y + 15, 16, 1, '#2f2d33'); if ((tx * 5 + ty * 3) % 7 === 0) P(g, x + 3, y + 3, 2, 1, '#55525a'); },
    plank: (g, x, y, tx, ty) => { P(g, x, y, 16, 16, '#3a2c24'); for (let i = 0; i < 16; i += 4) P(g, x, y + i, 16, 1, '#2b2019'); if ((tx + ty * 3) % 4 === 0) P(g, x + 6, y + 2, 1, 1, '#1a1410'); }
  };
  const WALLS = {
    paper: { face: '#5b4a55', line: '#4f404a', trim: '#2c2229', base: '#3a2a26' },
    green: { face: '#3f5048', line: '#36443d', trim: '#212a25', base: '#2e2621' },
    cream: { face: '#8b8172', line: '#7d7365', trim: '#4a4239', base: '#3a2a26' },
    stone: { face: '#4c4952', line: '#3c3a42', trim: '#26242a', base: '#2a282e', stone: true },
    wood: { face: '#5a3e2e', line: '#4a3226', trim: '#2b1d16', base: '#2b1d16', boards: true }
  };
  const CEIL = '#120f15';
  const isWallCh = ch => ch === '#';
  const isDoorCh = ch => ch >= 'A' && ch <= 'Z';
  function tileAt(room, tx, ty) { if (ty < 0 || ty >= room.map.length || tx < 0 || tx >= room.map[0].length) return '#'; return room.map[ty][tx]; }
  const floorLike = ch => ch !== '#' && ch !== undefined;
  // paint walls, floors and flat decorations once per room
  function paintRoom(room) {
    const W = room.map[0].length * TS, H = room.map.length * TS;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const F = FLOORS[room.floor] || FLOORS.wood, WS = WALLS[room.wall] || WALLS.paper;
    const R = seeded(room.seed || 7);
    for (let ty = 0; ty < room.map.length; ty++) for (let tx = 0; tx < room.map[0].length; tx++) {
      const ch = room.map[ty][tx], x = tx * TS, y = ty * TS;
      if (ch === '#' || isDoorCh(ch)) {
        const below = tileAt(room, tx, ty + 1), above = tileAt(room, tx, ty - 1);
        const left = tileAt(room, tx - 1, ty), right = tileAt(room, tx + 1, ty);
        const faceDown = below !== '#' && !isDoorCh(below);
        if (faceDown) {
          // the visible face of a north wall
          P(g, x, y, 16, 16, WS.face);
          if (WS.stone) { for (let j = 0; j < 16; j += 5) P(g, x, y + j, 16, 1, WS.line); P(g, x + ((ty + tx) % 2) * 8, y, 1, 16, WS.line); }
          else if (WS.boards) { for (let i = 0; i < 16; i += 4) P(g, x + i, y, 1, 16, WS.line); }
          else { for (let i = 2; i < 16; i += 5) P(g, x + i, y, 1, 13, WS.line); }
          P(g, x, y, 16, 2, WS.trim); P(g, x, y + 13, 16, 3, WS.base); P(g, x, y + 12, 16, 1, 'rgba(0,0,0,.25)');
          if (R() < 0.08) { P(g, x + 3 + (R() * 8 | 0), y + 4 + (R() * 5 | 0), 3, 4, 'rgba(20,10,10,.22)'); }   // stains
        } else {
          P(g, x, y, 16, 16, CEIL);
          if (floorLike(left) && !isWallCh(left) && !isDoorCh(left)) P(g, x, y, 2, 16, '#2a2230');
          if (floorLike(right) && !isWallCh(right) && !isDoorCh(right)) P(g, x + 14, y, 2, 16, '#2a2230');
          if (below !== '#' && isDoorCh(below)) {}
          if (above !== '#' && !isDoorCh(above)) P(g, x, y, 16, 2, '#2a2230');
        }
        if (isDoorCh(ch)) paintDoorTile(g, room, tx, ty, ch);
      } else {
        const alt = ch === ',' && room.floor2 ? FLOORS[room.floor2] : null;
        (alt || F)(g, x, y, tx, ty);
        // soft shadow under north walls
        if (tileAt(room, tx, ty - 1) === '#') P(g, x, y, 16, 3, 'rgba(0,0,0,.28)');
      }
    }
    // cobwebs in the corners of dark rooms
    if (room.webs) for (const [wx, wy, fl] of room.webs) web(g, wx * TS, wy * TS, fl);
    room.cv = cv; room.pw = W; room.ph = H;
  }
  function web(g, x, y, flip) {
    g.strokeStyle = 'rgba(220,220,230,.35)'; g.lineWidth = 1; g.beginPath();
    const sx = flip ? -1 : 1;
    for (let i = 0; i < 4; i++) { g.moveTo(x, y); g.lineTo(x + sx * (14 - i * 2), y + i * 5); }
    for (let r = 4; r < 14; r += 4) { g.moveTo(x + sx * r, y); g.lineTo(x + sx * r * 0.7, y + r * 0.7); g.lineTo(x, y + r); }
    g.stroke();
  }
  // a door drawn into a wall tile; its look depends on which side the room is
  function paintDoorTile(g, room, tx, ty, ch) {
    const d = room.doors[ch] || {}, x = tx * TS, y = ty * TS;
    const below = tileAt(room, tx, ty + 1), left = tileAt(room, tx - 1, ty), right = tileAt(room, tx + 1, ty), above = tileAt(room, tx, ty - 1);
    const open = d.look === 'arch';
    if (below !== '#' && !isDoorCh(below)) {
      // north wall door
      P(g, x, y, 16, 16, '#1a1418');
      if (open) { P(g, x + 2, y + 1, 12, 15, '#07060a'); return; }
      P(g, x + 2, y + 1, 12, 15, d.look === 'iron' ? '#3a3a44' : '#4a2f24'); P(g, x + 3, y + 2, 10, 13, d.look === 'iron' ? '#4a4a56' : '#5d3b2c');
      P(g, x + 4, y + 3, 8, 4, 'rgba(0,0,0,.18)'); P(g, x + 4, y + 9, 8, 5, 'rgba(0,0,0,.18)');
      P(g, x + 11, y + 9, 1, 2, '#b08a3a');
      if (d.look === 'chain') { for (let i = 0; i < 12; i += 2) { P(g, x + 2 + i, y + 6 + (i % 4 ? 1 : 0), 2, 1, '#8a8a92'); } P(g, x + 6, y + 8, 4, 4, '#b08a3a'); }
    } else if (above !== '#' && !isDoorCh(above)) {
      // south wall opening: a dark gap you walk down into
      P(g, x, y, 16, 16, '#0a080c'); P(g, x, y, 1, 16, '#2a2230'); P(g, x + 15, y, 1, 16, '#2a2230');
      if (d.look === 'front') { P(g, x - 2, y, 20, 4, '#3b2620'); P(g, x, y + 4, 16, 12, '#2b1a15'); P(g, x + 7, y + 6, 2, 3, '#b08a3a'); }
    } else {
      // side wall door: a passage of floor that fades into the dark, with a frame either side
      const onLeft = right !== '#' && !isDoorCh(right);
      (FLOORS[room.floor] || FLOORS.wood)(g, x, y, tx, ty);
      for (let i = 0; i < 16; i++) { const k = onLeft ? 16 - i : i + 1; P(g, x + i, y, 1, 16, `rgba(6,4,10,${Math.min(0.95, k / 16 * 0.95)})`); }
      P(g, x, y - 3, 16, 4, '#4a2f24'); P(g, x, y - 3, 16, 1, '#5d3b2c'); P(g, x, y + 14, 16, 2, '#2b1d16');
    }
  }

  // ================= furniture =================
  // Every piece: size in tiles, a solid box (px, relative to its top-left) and a painter.
  const OUT = '#1a1418';
  function box(g, x, y, w, h, fill, hi, sh) { P(g, x, y, w, h, OUT); P(g, x + 1, y + 1, w - 2, h - 2, fill); if (hi) P(g, x + 1, y + 1, w - 2, 1, hi); if (sh) P(g, x + 1, y + h - 2, w - 2, 1, sh); }
  const BOOK = ['#6e2a30', '#2f4a6b', '#4a6b3a', '#8a6a2a', '#5a3a6b', '#2a2a2e', '#7a4a2a'];
  const T = {};   // type -> { w, h, solid: [x, y, w, h] | null, flat, wall, draw(g, x, y, o, t) }
  const def = (name, w, h, solid, draw, extra) => { T[name] = Object.assign({ w, h, solid, draw }, extra || {}); };
  const FULL = 'full', BASE = 'base';
  def('shelf', 1, 2, BASE, (g, x, y, o) => {
    box(g, x, y, 16, 30, '#4a2f24', '#5d3b2c');
    for (let r = 0; r < 3; r++) { const yy = y + 3 + r * 9; P(g, x + 2, yy + 7, 12, 1, '#2b1d16'); for (let i = 0; i < 6; i++) { const c = BOOK[(i * 3 + r * 5 + (o.seed || 0)) % BOOK.length]; P(g, x + 2 + i * 2, yy + (i % 3 === 0 ? 1 : 0), 2, 7 - (i % 3 === 0 ? 1 : 0), c); } }
    if (o.gap) P(g, x + 8, y + 12, 3, 7, '#1a1418');
  });
  def('shelf2', 2, 2, BASE, (g, x, y, o) => { T.shelf.draw(g, x, y, o); T.shelf.draw(g, x + 16, y, { seed: (o.seed || 0) + 2 }); });
  def('jars', 1, 2, BASE, (g, x, y) => {
    box(g, x, y, 16, 30, '#3a2e28', '#4a3a32');
    for (let r = 0; r < 3; r++) { const yy = y + 3 + r * 9; P(g, x + 2, yy + 7, 12, 1, '#1d1612'); for (let i = 0; i < 3; i++) { P(g, x + 2 + i * 4, yy + 1, 3, 6, ['#5a7a5a', '#6a5a7a', '#7a6a3a'][(i + r) % 3]); P(g, x + 2 + i * 4, yy, 3, 1, '#c9c9d4'); } }
  });
  def('desk', 2, 1, FULL, (g, x, y, o) => {
    box(g, x, y + 2, 32, 13, '#5d3b2c', '#734a37', '#3e2a21'); P(g, x + 2, y + 14, 3, 2, OUT); P(g, x + 27, y + 14, 3, 2, OUT);
    if (o.lamp) { P(g, x + 4, y - 4, 2, 7, '#2b2233'); P(g, x + 1, y - 7, 8, 4, '#c9a24a'); }
    if (o.paper) { P(g, x + 14, y + 4, 8, 6, '#e8dcc2'); P(g, x + 15, y + 6, 6, 1, '#8a7a6a'); P(g, x + 15, y + 8, 4, 1, '#8a7a6a'); }
  });
  def('table', 2, 1, FULL, (g, x, y) => { box(g, x, y + 2, 32, 12, '#5d3b2c', '#734a37', '#3e2a21'); P(g, x + 2, y + 13, 2, 3, OUT); P(g, x + 28, y + 13, 2, 3, OUT); });
  def('longtable', 6, 2, [2, 4, 92, 24], (g, x, y, o) => {
    box(g, x + 2, y + 4, 92, 24, '#4f3226', '#634030', '#3a251c'); P(g, x + 6, y + 8, 84, 16, '#d8d0bf'); P(g, x + 6, y + 8, 84, 1, '#ece6d8');   // a white cloth gone grey
    for (let i = 0; i < 4; i++) { P(g, x + 14 + i * 22, y + 12, 6, 6, '#c9c9d4'); P(g, x + 15 + i * 22, y + 13, 4, 4, '#a9a9b4'); }   // plates
    P(g, x + 46, y + 4, 4, 8, '#c9a24a'); P(g, x + 47, y + 1, 2, 3, '#e8dcc2');   // candlestick
  });
  def('chair', 1, 1, [3, 6, 10, 9], (g, x, y, o) => {
    if (o.face === 'up') { box(g, x + 3, y + 1, 10, 6, '#4a2f24', '#5d3b2c'); box(g, x + 3, y + 7, 10, 7, '#5d3b2c', '#734a37'); }
    else { box(g, x + 3, y + 5, 10, 8, '#5d3b2c', '#734a37'); box(g, x + 3, y - 2, 10, 8, '#4a2f24', '#5d3b2c'); }
    P(g, x + 4, y + 13, 1, 3, OUT); P(g, x + 11, y + 13, 1, 3, OUT);
  });
  def('armchair', 1, 1, [1, 4, 14, 11], (g, x, y) => { box(g, x + 1, y + 2, 14, 13, '#5a2329', '#6e2c33'); box(g, x + 1, y - 4, 14, 8, '#4a1c21', '#5a2329'); });
  def('clock', 1, 2, BASE, (g, x, y, o, t) => {
    box(g, x + 1, y - 2, 14, 33, '#4a2f24', '#5d3b2c'); P(g, x + 3, y + 1, 10, 10, '#e8dcc2'); P(g, x + 4, y + 2, 8, 8, '#d8ccb2');
    P(g, x + 7, y + 3, 2, 3, OUT); P(g, x + 8, y + 6, 3, 1, OUT);   // stopped at 3 o'clock-ish
    P(g, x + 5, y + 14, 6, 12, '#2b1d16'); const sw = o.stopped ? 0 : Math.round(Math.sin(t / 500) * 2); P(g, x + 7 + sw, y + 15, 2, 8, '#b08a3a'); P(g, x + 6 + sw, y + 22, 4, 3, '#c9a24a');
  });
  def('painting', 1, 1, null, (g, x, y, o) => {
    box(g, x + 1, y + 2, 14, 10, '#8a6a2a', '#a8843a');
    const c = o.art || 'family';
    if (c === 'family') { P(g, x + 3, y + 4, 10, 6, '#3a3040'); for (let i = 0; i < 3; i++) { P(g, x + 4 + i * 3, y + 5, 2, 2, '#d9b48a'); P(g, x + 4 + i * 3, y + 7, 2, 3, ['#2f416b', '#6e2a30', '#4a6b3a'][i]); } P(g, x + 13, y + 5, 1, 4, '#1a1418'); }
    else if (c === 'girl') { P(g, x + 3, y + 4, 10, 6, '#2c2a3a'); P(g, x + 6, y + 5, 4, 3, '#d9b48a'); P(g, x + 5, y + 4, 6, 2, '#231a20'); P(g, x + 6, y + 6, 1, 1, '#000'); P(g, x + 9, y + 6, 1, 1, '#000'); P(g, x + 5, y + 8, 6, 2, '#e8dcc2'); }
    else if (c === 'sheet') { P(g, x + 3, y + 4, 10, 6, '#ece6d8'); for (let i = 0; i < 4; i++) P(g, x + 3, y + 5 + i, 10, 1, '#b9b3a6'); for (let i = 0; i < 4; i++) P(g, x + 4 + i * 2, y + 5 + (i % 3), 1, 2, '#1a1418'); }
    else if (c === 'drawing') { P(g, x + 2, y + 3, 12, 9, '#ece6d8'); P(g, x + 4, y + 7, 2, 4, '#c94a45'); P(g, x + 7, y + 6, 2, 5, '#4f7ec4'); P(g, x + 10, y + 8, 2, 3, '#f0cc55'); P(g, x + 3, y + 4, 4, 1, '#e8894a'); P(g, x + 9, y + 4, 4, 2, '#c94a45'); }
    else if (c === 'landscape') { P(g, x + 3, y + 4, 10, 3, '#4a5a7a'); P(g, x + 3, y + 7, 10, 3, '#3a5a3a'); P(g, x + 9, y + 5, 2, 2, '#e8dcc2'); }
    else if (c === 'photo') { P(g, x + 3, y + 4, 10, 6, '#7a6a5a'); for (let i = 0; i < 4; i++) P(g, x + 4 + i * 2, y + 6, 1, 3, '#2a2228'); }
  }, { wall: true });
  def('mirror', 1, 1, null, (g, x, y, o) => { box(g, x + 3, y + 1, 10, 12, '#8a8a92', '#a9a9b4'); P(g, x + 4, y + 2, 8, 10, o.broken ? '#2a2d40' : '#6a7a92'); P(g, x + 5, y + 3, 2, 4, 'rgba(255,255,255,.4)'); if (o.broken) { P(g, x + 6, y + 4, 1, 6, '#c9c9d4'); P(g, x + 7, y + 6, 3, 1, '#c9c9d4'); } if (o.writing) { P(g, x + 4, y + 6, 8, 1, '#8a1f24'); P(g, x + 5, y + 8, 5, 1, '#8a1f24'); } }, { wall: true });
  def('candle', 1, 1, [5, 10, 6, 5], (g, x, y, o, t) => {
    P(g, x + 7, y - 6, 2, 20, '#8a6a2a'); P(g, x + 4, y + 12, 8, 3, '#8a6a2a'); P(g, x + 3, y - 6, 10, 2, '#a8843a');
    for (const cx of [4, 7, 11]) { P(g, x + cx, y - 10, 2, 4, '#ece6d8'); if (!o.out) { const f = Math.floor(t / 110 + cx) % 2; P(g, x + cx, y - 13 - f, 2, 3, '#f0a030'); P(g, x + cx, y - 12 - f, 1, 1, '#ffe08a'); } }
  }, { light: 46 });
  def('lamp', 1, 1, [5, 11, 6, 4], (g, x, y, o) => { P(g, x + 7, y - 4, 2, 18, '#2b2233'); P(g, x + 4, y + 13, 8, 2, '#2b2233'); P(g, x + 3, y - 10, 10, 7, o.out ? '#5a5048' : '#d9c48a'); P(g, x + 3, y - 10, 10, 1, o.out ? '#6a6058' : '#f0e0a8'); }, { light: 40 });
  def('plant', 1, 1, [4, 9, 8, 6], (g, x, y) => { box(g, x + 4, y + 8, 8, 7, '#5a3e2e', '#6b4a32'); for (let i = 0; i < 5; i++) { P(g, x + 5 + i, y + 1 + (i % 2) * 3, 1, 8, '#4a3a2a'); } P(g, x + 3, y + 2, 2, 1, '#5a4a32'); P(g, x + 10, y + 4, 2, 1, '#5a4a32'); });
  def('vase', 1, 1, [4, 8, 8, 7], (g, x, y) => { box(g, x + 4, y + 3, 8, 12, '#2f416b', '#4f6e9a'); P(g, x + 5, y + 1, 6, 3, '#2f416b'); P(g, x + 6, y + 7, 4, 2, '#c9a24a'); });
  def('rug', 4, 2, null, (g, x, y, o) => { const w = (o.w || 4) * 16, h = (o.h || 2) * 16; P(g, x + 2, y + 2, w - 4, h - 4, o.c || '#4a1c2a'); P(g, x + 4, y + 4, w - 8, h - 8, o.c2 || '#5e2434'); P(g, x + 6, y + 6, w - 12, h - 12, o.c || '#4a1c2a'); }, { flat: true });
  def('stain', 1, 1, null, (g, x, y) => { P(g, x + 3, y + 6, 10, 5, 'rgba(30,10,14,.55)'); P(g, x + 5, y + 5, 6, 7, 'rgba(30,10,14,.55)'); P(g, x + 12, y + 9, 2, 2, 'rgba(30,10,14,.5)'); }, { flat: true });
  def('paper', 1, 1, null, (g, x, y) => { P(g, x + 4, y + 6, 8, 6, '#e8dcc2'); P(g, x + 5, y + 8, 6, 1, '#8a7a6a'); P(g, x + 5, y + 10, 4, 1, '#8a7a6a'); }, { flat: true, glint: true });
  def('phone', 1, 1, null, (g, x, y, o, t) => { P(g, x + 5, y + 6, 6, 9, '#1a1a22'); P(g, x + 6, y + 7, 4, 6, Math.floor(t / 500) % 2 ? '#4f7ec4' : '#9cc6e8'); }, { flat: true, glint: true });
  def('bed', 2, 2, [1, 2, 30, 29], (g, x, y, o) => {
    box(g, x + 1, y - 2, 30, 6, '#3e2a21', '#4f3528'); box(g, x + 1, y + 3, 30, 28, '#4a2f24');
    P(g, x + 3, y + 4, 26, 25, o.sheet || '#b9b3a6'); P(g, x + 5, y + 5, 9, 6, '#ece6d8'); P(g, x + 18, y + 5, 9, 6, '#ece6d8');
    P(g, x + 3, y + 14, 26, 15, o.cover || '#6e2a30'); P(g, x + 3, y + 14, 26, 1, '#8a3a40');
  });
  def('bedSmall', 1, 2, [1, 2, 14, 29], (g, x, y, o) => { box(g, x + 1, y - 2, 14, 6, '#3e2a21', '#4f3528'); box(g, x + 1, y + 3, 14, 28, '#4a2f24'); P(g, x + 3, y + 4, 10, 25, '#b9b3a6'); P(g, x + 4, y + 5, 8, 5, '#ece6d8'); P(g, x + 3, y + 13, 10, 16, o.cover || '#3a5a7a'); });
  def('wardrobe', 1, 2, BASE, (g, x, y, o, t) => {
    const sh = o.shake && Math.floor(t / 60) % 2 ? 1 : 0;
    box(g, x + sh, y - 4, 16, 35, '#3e2a21', '#4f3528'); P(g, x + 7 + sh, y - 2, 1, 31, OUT); P(g, x + 5 + sh, y + 10, 1, 3, '#b08a3a'); P(g, x + 9 + sh, y + 10, 1, 3, '#b08a3a');
    if (o.ajar) P(g, x + 8, y - 2, 6, 31, '#0a080c');
  }, { hide: true });
  def('cupboard', 2, 2, BASE, (g, x, y) => {
    box(g, x, y - 2, 32, 33, '#4a2f24', '#5d3b2c'); P(g, x + 15, y, 1, 29, OUT); P(g, x + 3, y + 2, 10, 10, '#2a2a3a'); P(g, x + 18, y + 2, 10, 10, '#2a2a3a');
    for (let i = 0; i < 3; i++) { P(g, x + 4 + i * 3, y + 5, 2, 6, '#c9c9d4'); P(g, x + 19 + i * 3, y + 5, 2, 6, '#c9c9d4'); } P(g, x + 13, y + 18, 1, 3, '#b08a3a'); P(g, x + 18, y + 18, 1, 3, '#b08a3a');
  }, { hide: true });
  def('closet', 1, 2, BASE, (g, x, y, o, t) => { T.wardrobe.draw(g, x, y, o, t); P(g, x + 2, y, 4, 2, '#8a8a92'); }, { hide: true });
  def('piano', 3, 2, [0, 6, 48, 24], (g, x, y, o) => {
    box(g, x, y + 2, 48, 18, '#141218', '#22202a'); P(g, x + 2, y + 4, 44, 2, '#3a3846');   // body
    P(g, x + 2, y + 20, 44, 7, '#ece6d8'); for (let i = 0; i < 11; i++) P(g, x + 4 + i * 4, y + 20, 1, 7, '#9a948a'); for (let i = 0; i < 10; i++) if (i % 7 !== 2 && i % 7 !== 6) P(g, x + 5 + i * 4, y + 20, 2, 4, '#141218');
    P(g, x + 2, y + 27, 3, 5, '#141218'); P(g, x + 43, y + 27, 3, 5, '#141218');
    if (o.open) { P(g, x + 18, y - 4, 14, 8, '#0a080c'); P(g, x + 22, y - 2, 6, 3, '#b08a3a'); }
  });
  def('stool', 1, 1, [4, 6, 8, 8], (g, x, y) => { box(g, x + 3, y + 5, 10, 5, '#141218', '#2a2832'); P(g, x + 4, y + 10, 1, 5, OUT); P(g, x + 11, y + 10, 1, 5, OUT); });
  def('bathtub', 3, 2, [1, 4, 46, 24], (g, x, y, o, t) => {
    box(g, x + 1, y + 2, 46, 26, '#c9c9d4', '#e6e6ec', '#9a9aa6'); P(g, x + 4, y + 5, 40, 20, o.drained ? '#8a8a96' : '#0d0b10');
    if (!o.drained) { const r = Math.floor(t / 400) % 3; P(g, x + 10 + r * 8, y + 12, 6, 1, 'rgba(120,120,140,.35)'); P(g, x + 28 - r * 4, y + 18, 5, 1, 'rgba(120,120,140,.25)'); }
    else { P(g, x + 22, y + 15, 3, 3, '#2a2a30'); }
    P(g, x + 40, y + 1, 3, 4, '#a9a9b4'); P(g, x + 4, y + 28, 3, 3, '#9a9aa6'); P(g, x + 41, y + 28, 3, 3, '#9a9aa6');
  });
  def('toilet', 1, 1, [3, 3, 10, 12], (g, x, y) => { box(g, x + 4, y - 4, 8, 7, '#d8d8e0', '#ececf2'); box(g, x + 3, y + 3, 10, 11, '#d8d8e0', '#ececf2'); P(g, x + 5, y + 5, 6, 6, '#8a8a96'); });
  def('sink', 1, 1, [2, 4, 12, 10], (g, x, y) => { box(g, x + 2, y + 2, 12, 9, '#d8d8e0', '#ececf2'); P(g, x + 4, y + 4, 8, 4, '#8a8a96'); P(g, x + 7, y, 2, 4, '#a9a9b4'); P(g, x + 6, y + 11, 4, 4, '#a9a9b4'); });
  def('counter', 2, 1, FULL, (g, x, y, o) => {
    box(g, x, y - 2, 32, 17, '#6a6c72', '#8a8d92', '#4a4c52'); P(g, x + 2, y + 6, 28, 8, '#4f3226');
    for (let i = 0; i < 3; i++) P(g, x + 4 + i * 9, y + 9, 6, 1, '#b08a3a');
    if (o.sink) { P(g, x + 6, y - 1, 12, 6, '#5a5c62'); P(g, x + 11, y - 5, 2, 5, '#a9a9b4'); }
    if (o.gloves) { P(g, x + 20, y - 1, 5, 4, '#e8c044'); P(g, x + 24, y, 3, 2, '#e8c044'); }
  });
  def('stove', 1, 1, FULL, (g, x, y) => { box(g, x, y - 2, 16, 17, '#2a2832', '#3a3846'); P(g, x + 3, y, 4, 3, '#141218'); P(g, x + 9, y, 4, 3, '#141218'); P(g, x + 2, y + 6, 12, 7, '#141218'); P(g, x + 4, y + 8, 8, 1, '#5a5848'); });
  def('fridge', 1, 2, BASE, (g, x, y) => { box(g, x, y - 4, 16, 35, '#c9c9b9', '#e0e0d0', '#9a9a8a'); P(g, x + 1, y + 8, 14, 1, OUT); P(g, x + 12, y, 1, 5, '#7a7a6a'); P(g, x + 12, y + 12, 1, 6, '#7a7a6a'); P(g, x + 3, y + 20, 4, 3, 'rgba(90,70,40,.45)'); });
  def('drawers', 2, 1, FULL, (g, x, y) => { box(g, x, y - 2, 32, 17, '#4a2f24', '#5d3b2c'); for (let r = 0; r < 2; r++) { P(g, x + 2, y + 1 + r * 7, 28, 6, '#5d3b2c'); P(g, x + 14, y + 3 + r * 7, 4, 1, '#b08a3a'); } });
  def('trashcan', 1, 1, [4, 8, 8, 7], (g, x, y) => { box(g, x + 4, y + 4, 8, 11, '#5a5c62', '#7a7c82'); P(g, x + 3, y + 3, 10, 2, '#4a4c52'); });
  def('toybox', 1, 1, [1, 3, 14, 12], (g, x, y) => { box(g, x + 1, y + 1, 14, 14, '#8a5a2a', '#a8743a'); P(g, x + 1, y + 6, 14, 1, OUT); P(g, x + 3, y + 3, 3, 2, '#c94a45'); P(g, x + 9, y + 9, 3, 3, '#4f7ec4'); P(g, x + 7, y, 4, 2, '#e8dcc2'); }, { hide: true });
  def('dollhouse', 1, 1, [1, 2, 14, 13], (g, x, y) => { box(g, x + 1, y - 2, 14, 17, '#e8dcc2', '#f4ecd8'); for (let i = 0; i < 6; i++) P(g, x + 1 + i, y - 2 - i, 14 - i * 2, 1, '#8a3a40'); P(g, x + 3, y + 2, 4, 4, '#3a3040'); P(g, x + 9, y + 2, 4, 4, '#3a3040'); P(g, x + 6, y + 8, 4, 7, '#5d3b2c'); P(g, x + 10, y + 3, 1, 2, '#d9b48a'); });
  def('horse', 1, 1, [2, 6, 12, 9], (g, x, y) => { P(g, x + 2, y + 12, 12, 2, '#5d3b2c'); P(g, x + 4, y + 4, 8, 6, '#c99866'); P(g, x + 10, y, 4, 6, '#c99866'); P(g, x + 12, y + 1, 1, 1, OUT); P(g, x + 5, y + 10, 1, 3, '#8a5a3b'); P(g, x + 10, y + 10, 1, 3, '#8a5a3b'); P(g, x + 3, y + 4, 2, 4, '#8a5a3b'); });
  def('musicbox', 1, 1, [3, 6, 10, 8], (g, x, y) => { box(g, x + 3, y + 5, 10, 9, '#6e2a30', '#8a3a40'); P(g, x + 3, y + 3, 10, 3, '#5a2329'); P(g, x + 7, y + 8, 2, 2, '#c9a24a'); P(g, x + 12, y + 8, 3, 1, '#c9a24a'); });
  def('bedside', 1, 1, [2, 4, 12, 11], (g, x, y, o) => { box(g, x + 2, y + 2, 12, 13, '#4a2f24', '#5d3b2c'); P(g, x + 6, y + 7, 4, 1, '#b08a3a'); if (o.paper) { P(g, x + 4, y + 2, 8, 4, '#e8dcc2'); } });
  def('vanity', 1, 2, BASE, (g, x, y, o) => { box(g, x + 1, y + 14, 14, 15, '#4a2f24', '#5d3b2c'); box(g, x + 3, y - 2, 10, 15, '#8a6a2a', '#a8843a'); P(g, x + 4, y - 1, 8, 13, o.broken ? '#2a2d40' : '#5a6a82'); if (o.broken) { P(g, x + 6, y + 1, 1, 8, '#c9c9d4'); P(g, x + 7, y + 4, 4, 1, '#c9c9d4'); } });
  def('fireplace', 2, 1, FULL, (g, x, y, o, t) => {
    box(g, x, y - 12, 32, 27, '#6a6268', '#8a8288'); P(g, x + 6, y - 4, 20, 19, '#0d0b10'); P(g, x - 1, y - 13, 34, 3, '#4a4248');
    if (o.lit) { const f = Math.floor(t / 100) % 2; P(g, x + 10, y + 6 - f, 12, 8, '#e0602a'); P(g, x + 13, y + 3 - f, 6, 6, '#f0a030'); P(g, x + 15, y + 6, 2, 4, '#ffe08a'); }
    else { P(g, x + 9, y + 11, 14, 3, '#3a3438'); }
  }, { lightIf: 'lit', light: 50 });
  def('safe', 1, 1, [1, 2, 14, 13], (g, x, y, o) => { box(g, x + 1, y - 2, 14, 17, '#3a3a44', '#5a5a66', '#26262e'); P(g, x + 5, y + 2, 7, 7, '#26262e'); P(g, x + 7, y + 4, 3, 3, o.open ? '#3fb5a3' : '#c9a24a'); P(g, x + 3, y + 12, 10, 1, '#26262e'); if (o.open) P(g, x + 2, y - 1, 3, 15, '#0d0b10'); });
  def('chalk', 2, 1, null, (g, x, y) => { box(g, x + 1, y + 1, 30, 12, '#4a3a2a', '#5a4a3a'); P(g, x + 3, y + 3, 26, 8, '#26302a'); P(g, x + 5, y + 5, 8, 1, '#c9d6c4'); P(g, x + 15, y + 4, 10, 1, '#c9d6c4'); P(g, x + 6, y + 8, 14, 1, '#c9d6c4'); P(g, x + 22, y + 7, 4, 3, '#c9d6c4'); }, { wall: true });
  def('labtable', 2, 1, FULL, (g, x, y) => { box(g, x, y + 1, 32, 13, '#4a4c52', '#6a6c72', '#3a3c42'); P(g, x + 4, y - 3, 3, 6, '#7aa07a'); P(g, x + 9, y - 2, 4, 5, '#a07aa0'); P(g, x + 20, y - 4, 2, 7, '#c9c9d4'); P(g, x + 18, y, 6, 3, '#5a7a9a'); });
  def('trunk', 2, 1, FULL, (g, x, y, o) => { box(g, x + 1, y + 1, 30, 14, '#5d3b2c', '#734a37'); P(g, x + 1, y + 6, 30, 2, '#3e2a21'); P(g, x + 6, y + 1, 2, 14, '#8a6a2a'); P(g, x + 24, y + 1, 2, 14, '#8a6a2a'); P(g, x + 14, y + 6, 4, 4, '#c9a24a'); if (o.open) P(g, x + 3, y - 3, 26, 5, '#3e2a21'); });
  def('crate', 1, 1, FULL, (g, x, y) => { box(g, x, y - 2, 16, 17, '#6b4a32', '#8a6040', '#4a3022'); P(g, x + 1, y + 1, 14, 1, '#4a3022'); P(g, x + 1, y + 8, 14, 1, '#4a3022'); for (let i = 0; i < 14; i++) P(g, x + 1 + i, y + 1 + i * 0.9 | 0, 1, 1, '#4a3022'); }, { hide: true });
  def('barrel', 1, 1, FULL, (g, x, y) => { box(g, x + 1, y - 2, 14, 17, '#5d3b2c', '#734a37'); P(g, x + 1, y + 1, 14, 1, '#2b2233'); P(g, x + 1, y + 10, 14, 1, '#2b2233'); P(g, x + 3, y - 1, 10, 2, '#3e2a21'); }, { hide: true });
  def('rocker', 1, 1, [2, 4, 12, 11], (g, x, y, o, t) => { const r = o.rock ? Math.round(Math.sin(t / 300) * 1.5) : 0; P(g, x + 2, y + 13 + r, 12, 2, '#3e2a21'); box(g, x + 3, y + 4, 10, 9, '#4a2f24', '#5d3b2c'); box(g, x + 3, y - 4 + r, 10, 9, '#3e2a21', '#4a2f24'); });
  def('stairsUp', 2, 2, null, (g, x, y, o) => {
    for (let i = 0; i < 6; i++) { P(g, x, y + i * 5, 32, 5, i % 2 ? '#4a3328' : '#563c2f'); P(g, x, y + i * 5 + 4, 32, 1, '#2b1d16'); }
    P(g, x, y, 2, 30, '#2b1d16'); P(g, x + 30, y, 2, 30, '#2b1d16'); P(g, x, y, 32, 4, 'rgba(0,0,0,.45)');
    if (o.gate) { for (let i = 0; i < 32; i += 4) P(g, x + i, y + 4, 2, 26, '#26242a'); P(g, x, y + 8, 32, 2, '#26242a'); P(g, x, y + 22, 32, 2, '#26242a'); P(g, x + 13, y + 12, 6, 6, '#b08a3a'); P(g, x + 15, y + 14, 2, 2, '#26242a'); }
  }, { flat: true });
  def('stairsDown', 2, 2, null, (g, x, y) => { for (let i = 0; i < 6; i++) P(g, x + 1, y + i * 5, 30, 5, ['#2a2230', '#231d29', '#1c1722', '#16121b', '#100d14', '#0a080d'][i]); P(g, x, y, 1, 32, '#3a3440'); P(g, x + 31, y, 1, 32, '#3a3440'); }, { flat: true });
  def('hatch', 1, 1, null, (g, x, y, o) => { box(g, x + 2, y + 1, 12, 12, '#4a3a2a', '#5a4a3a'); P(g, x + 7, y + 10, 2, 3, '#26242a'); if (o.open) { P(g, x + 3, y + 2, 10, 10, '#07060a'); } }, { wall: true });
  def('ladder', 1, 2, null, (g, x, y) => { P(g, x + 3, y - 14, 2, 46, '#6b4a32'); P(g, x + 11, y - 14, 2, 46, '#6b4a32'); for (let i = -12; i < 30; i += 5) P(g, x + 3, y + i, 10, 2, '#8a6040'); }, { flat: true });
  def('bars', 1, 1, FULL, (g, x, y, o) => { P(g, x, y + 12, 16, 3, '#26242a'); P(g, x, y - 12, 16, 3, '#26242a'); for (let i = 1; i < 16; i += 4) { P(g, x + i, y - 12, 2, 27, '#3a3a44'); P(g, x + i, y - 12, 1, 27, '#5a5a66'); } if (o.door) { P(g, x + 6, y, 4, 5, '#b08a3a'); } if (o.open) { P(g, x, y - 12, 16, 27, 'rgba(0,0,0,0)'); } });
  def('levers', 2, 1, null, (g, x, y, o) => {
    box(g, x + 1, y + 1, 30, 13, '#3a3a44', '#4a4a56');
    const st = o.state || [0, 0, 0];
    for (let i = 0; i < 3; i++) { const cx = x + 6 + i * 10; P(g, cx - 2, y + 4, 5, 8, '#26242a'); P(g, cx, y + 6 + (st[i] === 1 ? -3 : st[i] === 2 ? 3 : 0), 1, 4, '#c9c9d4'); P(g, cx - 1, y + 5 + (st[i] === 1 ? -3 : st[i] === 2 ? 3 : 0), 3, 2, ['#e0b84a', '#c9c9d4', '#f0e08a'][st[i] || 0]); }
  }, { wall: true });
  def('guarddesk', 2, 1, FULL, (g, x, y, o) => { box(g, x, y + 2, 32, 12, '#4a3e36', '#5a4e46', '#2e2620'); P(g, x + 2, y + 13, 2, 3, OUT); P(g, x + 28, y + 13, 2, 3, OUT); if (!o.empty) { P(g, x + 18, y + 4, 9, 4, '#7a6a5a'); P(g, x + 20, y + 5, 5, 2, '#a8843a'); } P(g, x + 5, y + 4, 7, 5, '#e8dcc2'); });
  def('chains', 1, 1, null, (g, x, y) => { for (let i = 0; i < 12; i += 2) { P(g, x + 4, y + 1 + i, 2, 1, '#8a8a92'); P(g, x + 11, y + 2 + i, 2, 1, '#8a8a92'); } P(g, x + 3, y + 13, 4, 2, '#6a6a72'); P(g, x + 10, y + 13, 4, 2, '#6a6a72'); }, { wall: true });
  def('irondoor', 1, 1, null, (g, x, y, o) => { box(g, x + 1, y + 1, 14, 15, '#3a3a44', '#5a5a66'); for (let i = 3; i < 15; i += 4) P(g, x + 2, y + i, 12, 1, '#26262e'); P(g, x + 6, y + 7, 4, 4, o.handle ? '#b08a3a' : '#26262e'); P(g, x + 7, y + 8, 2, 2, '#14121a'); }, { wall: true });
  def('coatrack', 1, 1, [6, 12, 4, 3], (g, x, y) => { P(g, x + 7, y - 10, 2, 24, '#3e2a21'); P(g, x + 4, y + 13, 8, 2, '#3e2a21'); P(g, x + 3, y - 10, 10, 1, '#3e2a21'); P(g, x + 2, y - 9, 4, 9, '#3a3040'); P(g, x + 10, y - 9, 3, 6, '#5a2329'); });
  def('statue', 1, 2, BASE, (g, x, y) => { box(g, x + 2, y + 22, 12, 9, '#4a4648', '#5a5658'); P(g, x + 5, y + 2, 6, 20, '#6b6668'); P(g, x + 5, y - 3, 6, 6, '#6b6668'); P(g, x + 6, y - 1, 1, 1, OUT); P(g, x + 9, y - 1, 1, 1, OUT); P(g, x + 3, y + 6, 2, 8, '#6b6668'); });
  def('pipes', 3, 1, null, (g, x, y) => { P(g, x, y + 3, 48, 3, '#5a5a62'); P(g, x, y + 3, 48, 1, '#7a7a82'); P(g, x, y + 8, 48, 2, '#4a4a52'); P(g, x + 14, y + 2, 4, 5, '#4a4a52'); P(g, x + 34, y + 7, 4, 4, '#4a4a52'); P(g, x + 22, y + 10, 1, 4, 'rgba(120,140,160,.6)'); }, { wall: true });
  def('exitLadder', 1, 2, null, (g, x, y, o, t) => {
    P(g, x - 4, y - 18, 24, 8, `rgba(200,210,255,${0.25 + Math.sin(t / 400) * 0.08})`);
    P(g, x + 3, y - 14, 2, 46, '#8a8a92'); P(g, x + 11, y - 14, 2, 46, '#8a8a92'); for (let i = -12; i < 30; i += 5) P(g, x + 3, y + i, 10, 2, '#a9a9b4');
  }, { flat: true, light: 40 });
  def('cobweb', 1, 1, null, (g, x, y, o) => web(g, x + (o.flip ? 16 : 0), y, o.flip), { flat: true });
  def('npcSpot', 1, 1, null, () => {}, { flat: true });
  def('fallenShelf', 2, 1, FULL, (g, x, y) => { box(g, x, y + 4, 32, 10, '#4a2f24', '#5d3b2c'); for (let i = 0; i < 8; i++) P(g, x + 3 + i * 3, y + 1 + (i % 2), 2, 4, BOOK[i % BOOK.length]); });
  def('leverStand', 1, 1, [2, 6, 12, 9], (g, x, y, o) => { P(g, x + 7, y + 6, 2, 9, '#26242a'); T.levers.draw(g, x - 8, y - 8, o); });

  // ================= the house =================
  // '#' wall · '.' floor · ',' second floor texture · capital letters are doors (see doors)
  // Objects sit on tiles: { t: type, x, y, ... }. `use` names the script that runs when you examine it.
  const ROOMS = {
    hall: { name: '현관 홀', floor: 'wood', floor2: 'carpet', wall: 'paper', dark: 0.42, seed: 11,
      map: ['################', '######N#########', '#..............#', '#..............#', 'W..............E', '#..............#', '#.....,,,,.....#', '#.....,,,,.....#', '#.....,,,,.....#', '#..............#', '#######F########', '################'],
      doors: { N: { to: 'corridor1', back: 'H' }, W: { to: 'library', back: 'E' }, E: { to: 'dining', back: 'W' }, F: { look: 'front', use: 'frontDoor' } },
      objs: [
        { t: 'stairsUp', x: 1, y: 2, id: 'stairs', use: 'stairs', door: { to: 'corridor2', back: 'down' }, gateFlag: 'gateOpen', gate: true },
        { t: 'phone', x: 8, y: 6, id: 'hunphone', showIf: 'chase1Done', hideIf: 'gotPhone', use: 'hunPhone' },
        { t: 'candle', x: 4, y: 2 }, { t: 'candle', x: 11, y: 2 },
        { t: 'painting', x: 9, y: 1, art: 'landscape', use: 'hallPainting' },
        { t: 'coatrack', x: 13, y: 2, use: 'coatrack' }, { t: 'vase', x: 14, y: 9, use: 'vase' }, { t: 'plant', x: 1, y: 9 }
      ] },
    library: { name: '서재', floor: 'dark', wall: 'green', dark: 0.5, seed: 12, webs: [[1, 2, 0], [13, 2, 1]],
      map: ['##############', '##############', '#............#', '#............#', '#............#', '#............E', '#............#', '#............#', '#............#', '##############', '##############'],
      doors: { E: { to: 'hall', back: 'W' } },
      objs: [].concat(Array.from({ length: 12 }, (_, i) => ({ t: 'shelf', x: 1 + i, y: 1, seed: i, gap: i === 6, use: i === 6 ? 'gapShelf' : 'books' })), [
        { t: 'desk', x: 2, y: 5, lamp: true, paper: true, use: 'diary1' }, { t: 'chair', x: 2, y: 6, face: 'up' },
        { t: 'armchair', x: 9, y: 7, use: 'armchair' }, { t: 'lamp', x: 11, y: 7, out: true },
        { t: 'shelf2', x: 1, y: 8, seed: 3, use: 'books' }, { t: 'stain', x: 7, y: 6 }
      ]) },
    dining: { name: '식당', floor: 'wood', wall: 'cream', dark: 0.45, seed: 13,
      map: ['################', '################', '#..............#', '#..............#', 'W..............#', '#..............#', '#..............#', '#..............#', '#..............#', '################', '################'],
      doors: { W: { to: 'hall', back: 'E' } },
      objs: [
        { t: 'longtable', x: 5, y: 4, use: 'table' },
        { t: 'chair', x: 6, y: 3, face: 'down' }, { t: 'chair', x: 8, y: 3, face: 'down' }, { t: 'chair', x: 10, y: 3, face: 'down' },
        { t: 'chair', x: 6, y: 6, face: 'up' }, { t: 'chair', x: 8, y: 6, face: 'up' }, { t: 'chair', x: 10, y: 6, face: 'up' },
        { t: 'clock', x: 14, y: 1, stopped: true, use: 'clock' },
        { t: 'painting', x: 7, y: 1, art: 'family', use: 'familyPainting' }, { t: 'painting', x: 11, y: 1, art: 'sheet', use: 'sheetMusic' },
        { t: 'cupboard', x: 1, y: 1, use: 'cupboard', hide: true }, { t: 'candle', x: 13, y: 7 }, { t: 'plant', x: 1, y: 8 }
      ] },
    corridor1: { name: '1층 복도', floor: 'wood', wall: 'paper', dark: 0.5, seed: 14,
      map: ['######################', '###K####B####P########', '#....................#', '#....................E', '#....................#', '##H###################', '######################'],
      doors: { K: { to: 'kitchen', back: 'S' }, B: { to: 'bath', back: 'S' }, P: { to: 'piano', back: 'S', lock: 'pianoOpen', lockUse: 'pianoDoor' }, H: { to: 'hall', back: 'N' },
        E: { to: 'b1hall', back: 'up', look: 'chain', lock: 'basementOpen', lockUse: 'basementDoor' } },
      objs: [
        { t: 'wardrobe', x: 17, y: 1, use: 'hideSpot', hide: true }, { t: 'painting', x: 10, y: 1, art: 'girl', use: 'girlPainting' },
        { t: 'plant', x: 20, y: 2 }, { t: 'vase', x: 6, y: 2 }, { t: 'stain', x: 15, y: 3 }, { t: 'candle', x: 1, y: 2, out: true }
      ] },
    kitchen: { name: '부엌', floor: 'check', wall: 'cream', dark: 0.5, seed: 15,
      map: ['############', '############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#####S######', '############'],
      doors: { S: { to: 'corridor1', back: 'K' } },
      objs: [
        { t: 'counter', x: 1, y: 2, sink: true, gloves: true, id: 'sink', use: 'sink' }, { t: 'stove', x: 3, y: 2, use: 'stove' },
        { t: 'drawers', x: 5, y: 2, use: 'drawers' }, { t: 'fridge', x: 10, y: 1, use: 'fridge' },
        { t: 'table', x: 5, y: 5, use: 'kTable' }, { t: 'chair', x: 5, y: 6, face: 'up' }, { t: 'chair', x: 6, y: 4, face: 'down' },
        { t: 'trashcan', x: 1, y: 7, use: 'trash' }, { t: 'stain', x: 8, y: 6 }
      ] },
    bath: { name: '욕실', floor: 'tile', wall: 'cream', dark: 0.55, seed: 16,
      map: ['##########', '##########', '#........#', '#........#', '#........#', '#........#', '#........#', '####S#####', '##########'],
      doors: { S: { to: 'corridor1', back: 'B' } },
      objs: [
        { t: 'bathtub', x: 1, y: 2, id: 'tub', use: 'tub' }, { t: 'toilet', x: 8, y: 2, use: 'toilet' },
        { t: 'sink', x: 6, y: 2, use: 'bathSink' }, { t: 'mirror', x: 6, y: 1, id: 'mirror', use: 'mirror' },
        { t: 'closet', x: 8, y: 4, id: 'closet', use: 'bathCloset' }, { t: 'stain', x: 5, y: 5 }
      ] },
    piano: { name: '피아노 방', floor: 'wood', wall: 'paper', dark: 0.5, seed: 17,
      map: ['############', '############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '######S#####', '############'],
      doors: { S: { to: 'corridor1', back: 'P' } },
      objs: [
        { t: 'rug', x: 3, y: 2, w: 5, h: 4, c: '#2a2240', c2: '#3a2e58' },
        { t: 'piano', x: 4, y: 2, id: 'piano', use: 'piano' }, { t: 'stool', x: 5, y: 4 },
        { t: 'painting', x: 9, y: 1, art: 'girl', use: 'pianoPortrait' }, { t: 'armchair', x: 9, y: 6 }, { t: 'candle', x: 1, y: 2, out: true },
        { t: 'chair', x: 2, y: 6, face: 'up' }, { t: 'vase', x: 10, y: 2 }
      ] },
    corridor2: { name: '2층 복도', floor: 'carpet', wall: 'paper', dark: 0.55, seed: 18,
      map: ['######################', '###C####B#####S#######', '#....................#', '#....................#', '#....................#', '######################', '######################'],
      doors: { C: { to: 'child', back: 'S' }, B: { to: 'bedroom', back: 'S' }, S: { to: 'study', back: 'S' } },
      objs: [
        { t: 'stairsDown', x: 1, y: 3, id: 'down', use: 'stairsDown', door: { to: 'hall', back: 'stairs' }, spawn: [40, 22, 'right'] },
        { t: 'hatch', x: 18, y: 1, id: 'hatch', use: 'hatch' },
        { t: 'ladder', x: 18, y: 2, id: 'ladder', showIf: 'hatchOpen', door: { to: 'attic', back: 'hole' } },
        { t: 'painting', x: 11, y: 1, art: 'photo', use: 'photo2f' }, { t: 'plant', x: 20, y: 2 }, { t: 'stain', x: 12, y: 3 }, { t: 'candle', x: 6, y: 2 }
      ] },
    child: { name: '아이 방', floor: 'wood', floor2: 'carpet', wall: 'cream', dark: 0.5, seed: 19,
      map: ['############', '############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '######S#####', '############'],
      doors: { S: { to: 'corridor2', back: 'C' } },
      objs: [
        { t: 'rug', x: 4, y: 4, w: 4, h: 3, c: '#3a5a7a', c2: '#4f7ec4' },
        { t: 'bedSmall', x: 1, y: 2, use: 'childBed' }, { t: 'toybox', x: 3, y: 2, use: 'hideSpot', hide: true },
        { t: 'dollhouse', x: 9, y: 2, use: 'dollhouse' }, { t: 'horse', x: 10, y: 5, use: 'horse' },
        { t: 'painting', x: 6, y: 1, art: 'drawing', use: 'birthdayDrawing' }, { t: 'painting', x: 8, y: 1, art: 'drawing', use: 'scaryDrawing' },
        { t: 'musicbox', x: 7, y: 2, use: 'musicbox' }
      ] },
    bedroom: { name: '안방', floor: 'carpet', wall: 'paper', dark: 0.55, seed: 20,
      map: ['##############', '##############', '#............#', '#............#', '#............#', '#............#', '#............#', '#............#', '#######S######', '##############'],
      doors: { S: { to: 'corridor2', back: 'B' } },
      objs: [
        { t: 'bed', x: 5, y: 2, use: 'bigBed' }, { t: 'bedside', x: 4, y: 2, paper: true, use: 'diary2' }, { t: 'bedside', x: 7, y: 2 },
        { t: 'wardrobe', x: 12, y: 1, id: 'wardrobe', use: 'cheolWardrobe', hide: true }, { t: 'vanity', x: 1, y: 1, broken: true, use: 'vanity' },
        { t: 'fireplace', x: 9, y: 2, use: 'fireplace' }, { t: 'rug', x: 4, y: 5, w: 6, h: 2 }, { t: 'armchair', x: 11, y: 5 }
      ] },
    study: { name: '연구실', floor: 'dark', wall: 'wood', dark: 0.55, seed: 21, webs: [[1, 2, 0]],
      map: ['############', '############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '######S#####', '############'],
      doors: { S: { to: 'corridor2', back: 'S' } },
      objs: [
        { t: 'jars', x: 1, y: 1, use: 'jars' }, { t: 'jars', x: 2, y: 1, use: 'jars' }, { t: 'chalk', x: 5, y: 1, use: 'chalk' },
        { t: 'safe', x: 10, y: 2, id: 'safe', use: 'safe' }, { t: 'shelf', x: 9, y: 1, seed: 5, use: 'books' },
        { t: 'desk', x: 4, y: 4, lamp: true, paper: true, use: 'labNotes' }, { t: 'chair', x: 4, y: 5, face: 'up' },
        { t: 'labtable', x: 8, y: 6, use: 'labtable' }, { t: 'stain', x: 2, y: 6 }
      ] },
    attic: { name: '다락방', floor: 'plank', wall: 'wood', dark: 0.93, need: 'flashlight', seed: 22, webs: [[1, 2, 0], [13, 2, 1], [6, 2, 0]],
      map: ['##############', '##############', '#............#', '#............#', '#............#', '#............#', '#............#', '##############', '##############'],
      doors: {},
      objs: [
        { t: 'stairsDown', x: 6, y: 5, id: 'hole', use: 'atticHole', door: { to: 'corridor2', back: 'ladder' }, spawn: [16, -6, 'up'] },
        { t: 'trunk', x: 10, y: 2, id: 'trunk', use: 'trunk' }, { t: 'trunk', x: 1, y: 2, use: 'oldTrunk' },
        { t: 'rocker', x: 4, y: 2, rock: true, use: 'rocker' }, { t: 'crate', x: 12, y: 5 }, { t: 'crate', x: 11, y: 5 },
        { t: 'paper', x: 8, y: 3, id: 'photo', use: 'oldPhoto' }, { t: 'stain', x: 9, y: 5 }
      ] },
    b1hall: { name: '지하 복도', floor: 'stone', wall: 'stone', dark: 0.9, need: 'flashlight', seed: 23, webs: [[1, 2, 0], [16, 2, 1]],
      map: ['##################', '##################', '#................#', '#................#', 'W................E', '#................#', '#................#', '#................#', '#................#', '#................#', '##################', '##################'],
      doors: { W: { to: 'storage', back: 'E' }, E: { to: 'jail', back: 'W' } },
      objs: [
        { t: 'stairsUp', x: 8, y: 2, id: 'up', use: 'b1Up', door: { to: 'corridor1', back: 'E' } },
        { t: 'barrel', x: 2, y: 8, use: 'hideSpot', hide: true }, { t: 'barrel', x: 15, y: 8, use: 'hideSpot', hide: true }, { t: 'crate', x: 3, y: 8 },
        { t: 'pipes', x: 3, y: 1 }, { t: 'pipes', x: 12, y: 1 }, { t: 'chains', x: 15, y: 1 }, { t: 'stain', x: 10, y: 6 }, { t: 'stain', x: 5, y: 4 }
      ] },
    storage: { name: '지하 창고', floor: 'stone', wall: 'stone', dark: 0.9, need: 'flashlight', seed: 24, webs: [[1, 2, 0]],
      map: ['##############', '######X#######', '#............#', '#............#', '#............E', '#............#', '#............#', '#............#', '##############', '##############'],
      doors: { E: { to: 'b1hall', back: 'W' }, X: { to: 'tunnel', back: 'W', look: 'iron', lock: 'tunnelOpen', lockUse: 'ironDoor' } },
      objs: [
        { t: 'crate', x: 1, y: 2 }, { t: 'crate', x: 2, y: 2 }, { t: 'crate', x: 1, y: 3 }, { t: 'shelf2', x: 9, y: 1, seed: 6, use: 'storeShelf' },
        { t: 'barrel', x: 5, y: 6, use: 'hideSpot', hide: true }, { t: 'barrel', x: 9, y: 6, use: 'hideSpot', hide: true }, { t: 'crate', x: 11, y: 6 },
        { t: 'pipes', x: 2, y: 1 }
      ] },
    jail: { name: '지하 감옥', floor: 'stone', wall: 'stone', dark: 0.9, need: 'flashlight', seed: 25, webs: [[14, 5, 1]],
      map: ['################', '################', '#....#....#....#', '#....#....#....#', '#..............#', 'W..............#', '#..............#', '#..............#', '#..............#', '################', '################'],
      doors: { W: { to: 'b1hall', back: 'E' } },
      objs: [].concat(Array.from({ length: 14 }, (_, i) => ({ t: 'bars', x: 1 + i, y: 4, door: i === 1 || i === 6 || i === 11, hideIf: i === 1 || i === 6 || i === 11 ? 'freed' : undefined, cell: i < 4 ? 0 : i < 9 ? 1 : 2, id: 'bar' + (1 + i), use: 'cellBars' })), [
        { t: 'guarddesk', x: 6, y: 7, id: 'gdesk', use: 'guardDesk' }, { t: 'chair', x: 6, y: 8, face: 'up' },
        { t: 'leverStand', x: 13, y: 7, id: 'levers', use: 'levers' }, { t: 'chains', x: 14, y: 5 }, { t: 'stain', x: 3, y: 6 }
      ]) },
    tunnel: { name: '비밀 통로', floor: 'stone', wall: 'stone', dark: 0.92, need: 'flashlight', seed: 26,
      map: ['##########################', '##########################', '#........................#', 'W........................#', '#........................#', '##########################', '##########################'],
      doors: { W: { to: 'storage', back: 'X' } },
      objs: [{ t: 'pipes', x: 4, y: 1 }, { t: 'pipes', x: 11, y: 1 }, { t: 'pipes', x: 18, y: 1 }, { t: 'exitLadder', x: 24, y: 2, id: 'exit', use: 'exit' }, { t: 'stain', x: 9, y: 3 }, { t: 'stain', x: 16, y: 2 }] }
  };
  // ================= geometry shared by both modes =================
  function objRect(o) {
    const d = T[o.t]; if (!d) return null;
    const w = (o.w || d.w) * TS, h = (o.h || d.h) * TS, x = o.x * TS, y = o.y * TS;
    return { x, y, w, h };
  }
  function solidOf(o) {
    const d = T[o.t]; if (!d || !d.solid || d.flat || d.wall) return null;
    const r = objRect(o);
    if (d.solid === FULL) return { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 };
    if (d.solid === BASE) return { x: r.x + 1, y: r.y + r.h - TS + 1, w: r.w - 2, h: TS - 2 };
    const [sx, sy, sw, sh] = d.solid; return { x: r.x + sx, y: r.y + sy, w: sw, h: sh };
  }
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  // tile grid for path finding: 1 = can walk
  function walkGrid(room, solids, doorOk) {
    const W = room.map[0].length, H = room.map.length, grid = new Uint8Array(W * H);
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const ch = room.map[ty][tx];
      let ok = ch !== '#' && (!isDoorCh(ch) || (doorOk && doorOk(ch)));
      if (ok) { const c = { x: tx * TS + 4, y: tx * 0 + ty * TS + 4, w: 8, h: 8 }; for (const s of solids) if (overlap(c, s)) { ok = false; break; } }
      grid[ty * W + tx] = ok ? 1 : 0;
    }
    return { W, H, grid };
  }
  function bfs(G, sx, sy, gx, gy) {
    const { W, H, grid } = G;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H || gx < 0 || gy < 0 || gx >= W || gy >= H) return null;
    const start = sy * W + sx, goal = gy * W + gx;
    if (start === goal) return [];
    const prev = new Int32Array(W * H).fill(-1); prev[start] = start;
    const q = [start]; let qi = 0;
    while (qi < q.length) {
      const c = q[qi++]; if (c === goal) break;
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx; if (prev[n] !== -1) continue;
        if (!grid[n] && n !== goal) continue;
        prev[n] = c; q.push(n);
      }
    }
    if (prev[goal] === -1) return null;
    const path = []; for (let c = goal; c !== start; c = prev[c]) path.push(c);
    return path.reverse().map(c => [c % W, (c / W) | 0]);
  }
  // light: a black layer with soft holes where there is light
  function darkness(dk, dkg, amount, lights, vw, vh) {
    dkg.globalCompositeOperation = 'source-over';
    dkg.clearRect(0, 0, vw, vh);
    if (amount <= 0.01) return false;
    dkg.fillStyle = `rgba(4,3,8,${amount})`; dkg.fillRect(0, 0, vw, vh);
    dkg.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const gr = dkg.createRadialGradient(L.x, L.y, L.r * 0.15, L.x, L.y, L.r);
      gr.addColorStop(0, `rgba(0,0,0,${L.a == null ? 1 : L.a})`); gr.addColorStop(0.6, `rgba(0,0,0,${(L.a == null ? 1 : L.a) * 0.55})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dkg.fillStyle = gr; dkg.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    dkg.globalCompositeOperation = 'source-over';
    return true;
  }
  // the lounge character, walking
  function drawPerson(g, look, x, y, dir, moving, t, opt) {
    if (!need() || !O.avatarWalk) return;
    const frame = moving ? (1 + (Math.floor(t / 150) % 2)) : 0;
    const sp = O.avatarWalk(look, dir, frame);
    if (!sp) return;
    g.save(); if (opt && opt.alpha != null) g.globalAlpha = opt.alpha;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(Math.round(x - 5), Math.round(y - 1), 10, 2);
    g.drawImage(sp, Math.round(x - sp.width / 2), Math.round(y - sp.height + 3));
    g.restore();
  }

  // ================= 이야기 모드 =================
  const SAVE_KEY = 'onl_mansion_story_v1', DONE_KEY = 'onl_mansion_endings';
  const PSPEED = 70;
  const ITEMS = {
    flashlight: { n: '손전등', d: '부엌 서랍 깊숙이 있던 손전등. 배터리가 반쯤 남았다. 어두운 곳도 갈 수 있다.', i: '🔦' },
    gloves: { n: '고무장갑', d: '노란 고무장갑. 손에 무언가 닿는 건 싫으니까.', i: '🧤' },
    silverKey: { n: '은열쇠', d: '작은 은색 열쇠. 손잡이에 음표가 새겨져 있다.', i: '🗝️' },
    stairKey: { n: '계단 열쇠', d: '녹슨 쇠 열쇠. 꼬리표에 「계단」이라고 적혀 있다.', i: '🔑' },
    hook: { n: '갈고리 막대', d: '끝이 구부러진 긴 쇠막대. 높은 곳에 있는 무언가를 당길 수 있을 것 같다.', i: '🪝' },
    basementKey: { n: '지하실 열쇠', d: '무겁고 차가운 열쇠. 손잡이에 쇠사슬 무늬가 있다.', i: '🗝️' },
    handle: { n: '녹슨 핸들', d: '철문에 끼우는 둥근 손잡이. 녹이 손에 묻어난다.', i: '⚙️' },
    hunPhone: { n: '훈이의 휴대폰', d: '화면에 금이 갔다. 마지막 사진은… 흔들려서 알아볼 수 없는 파란 얼굴.', i: '📱' },
    diary1: { n: '일기 (1)', d: '「1987년 10월 3일. 아내가 떠난 뒤로 이 집은 너무 조용하다. 아이들만이 나의 빛이다. 막내의 기침이 멈추질 않는다. 나는 그 약을 완성해야만 한다.」', i: '📄' },
    labNotes: { n: '실험 일지', d: '「41번째 시도. 쥐가 눈을 감지 않는다. 깜빡이지도 않는다. 크고, 푸르게 변했다…」 「그것들은 빛을 피하지 않는다. 소리를 따라온다. 숨으면, 모른다.」', i: '📓' },
    diary2: { n: '일기 (2)', d: '「아이들이 사라졌다. 아니, 아이들은 여기 있다. 밤마다 지하에서 우리를 부른다. ― 금고 번호는 막내가 태어난 날. 잊지 말 것.」', i: '📄' },
    photo: { n: '오래된 사진', d: '세 아이가 웃고 있는 사진. 뒷면: 「별처럼 반짝이던 첫째, 해처럼 웃던 둘째, 달처럼 조용하던 막내. ― 1986년 봄」', i: '🖼️' },
    guardNote: { n: '간수의 쪽지', d: '「그것들은 밤마다 철창을 긁는다. 레버는 아이들 사진 뒤에 적힌 순서대로. 통로 철문 핸들은 내 서랍에.」', i: '📝' }
  };
  const NPC_LOOK = {
    철수: { hair: 'spiky', hairColor: '#231a20', top: 'hood', topColor: '#c94a45', bottom: 'jogger', bottomColor: '#26242b' },
    훈이: { hair: 'curly', hairColor: '#553728', top: 'padding', topColor: '#f0cc55', bottom: 'jeans', bottomColor: '#5c84bd' },
    유리: { hair: 'long', hairColor: '#231a20', top: 'cardigan', topColor: '#b8a6dc', bottom: 'longskirt', bottomColor: '#2f3d63' }
  };
  let ST = null;               // the story: flags, items, where everyone is
  let room = null, roomId = '', solids = [], grid = null, objs = [];
  const pl = { x: 0, y: 0, dir: 'up', moving: false, hidden: null, trail: [] };
  let mon = null, busy = 0, checkpoint = null, playStart = 0, chaseCount = 0;
  let root = null, cv = null, g = null, dk = null, dkg = null, ui = {};
  let raf = 0, lastT = 0, open_ = false, onQuit = null, camX = 0, camY = 0, shake = 0, redFlash = 0, heartAt = 0, fadeA = 0;
  const keys = Object.create(null); let order = [], actQ = false, bagQ = false;
  const touch = { up: 0, down: 0, left: 0, right: 0 };

  function fresh() {
    return { v: 1, room: 'hall', x: 7.5 * TS, y: 9 * TS + 6, dir: 'up', F: {}, inv: [], obj: {}, t: 0,
      npc: { 훈이: { room: 'hall', x: 7 * TS + 8, y: 5 * TS + 10, dir: 'down' }, 유리: { room: 'library', x: 8 * TS + 8, y: 4 * TS + 10, dir: 'down' }, 철수: { room: 'dining', x: 12 * TS + 8, y: 3 * TS + 10, dir: 'left' } } };
  }
  const has = id => ST.inv.includes(id);
  function give(id, quiet) { if (!has(id)) ST.inv.push(id); sfx('pick'); if (!quiet) note(`${ITEMS[id].i} ${ITEMS[id].n}을(를) 얻었다`); }
  function take(id) { ST.inv = ST.inv.filter(x => x !== id); }
  const F = () => ST.F;
  const ost = (rid, id) => (ST.obj[rid + ':' + id] = ST.obj[rid + ':' + id] || {});
  function saveNow() { try { ST.t += (now() - playStart) / 1000; playStart = now(); localStorage.setItem(SAVE_KEY, JSON.stringify(ST)); } catch (e) {} }
  function snapshot() { checkpoint = JSON.parse(JSON.stringify(ST)); checkpoint.room = roomId; checkpoint.x = pl.x; checkpoint.y = pl.y; checkpoint.dir = pl.dir; }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

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
    solids = objs.map(o => {
      const s = solidOf(o);
      // a locked gate over the stairs is a wall until it opens
      if (!s && o.gateFlag && !ST.F[o.gateFlag]) { const r = objRect(o); return { x: r.x, y: r.y, w: r.w, h: r.h }; }
      return s;
    }).filter(Boolean);
    grid = walkGrid(room, solids, () => true);
  }
  function spawnFor(rid, back) {
    const R = ROOMS[rid];
    // an object door (stairs, ladder, hole)
    const ob = R.objs.find(o => o.id === back);
    if (ob) {
      const r = objRect(ob);
      if (ob.spawn) return [r.x + ob.spawn[0], r.y + ob.spawn[1], ob.spawn[2]];
      return [r.x + r.w / 2, r.y + r.h + 10, 'down'];
    }
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
    if (R.need && !has(R.need)) { await say([[null, '너무 어두워서 한 발짝도 나아갈 수가 없다. 불빛이 필요해…']]); pushBack(); return; }
    busy++;
    sfx(opt && opt.quiet ? 'step' : 'door');
    await fade(1, 160);
    const from = roomId;
    const [x, y, dir] = spawnFor(rid, back);
    loadRoom(rid); pl.x = x; pl.y = y; pl.dir = dir; pl.hidden = null; pl.trail = [];
    ST.room = rid;
    // friends who follow you come along
    for (const [name, n] of Object.entries(ST.npc)) if (n.follow) { n.room = rid; n.x = x; n.y = y; }
    camSnap();
    if (mon && !mon.gone) monFollow(from, rid, back);
    await fade(0, 160);
    try { await onEnter(rid, from); } catch (e) { console.error(e); }
    busy--;
    if (!mon || mon.gone) { snapshot(); saveNow(); }
  }
  function pushBack() { const d = DIRV[pl.dir]; pl.x -= d[0] * 6; pl.y -= d[1] * 6; }
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

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
    const d = (busy || pl.hidden) ? null : inputDir();
    pl.moving = !!d;
    if (!d) return;
    pl.dir = d;
    const v = DIRV[d], sp = PSPEED * dt;
    let nx = pl.x + v[0] * sp, ny = pl.y + v[1] * sp;
    const b = blockedAt(nx, ny);
    if (b) {
      // slide around corners a little so doors are easy to walk through
      if (v[0] === 0) { for (const off of [3, -3, 6, -6]) if (!blockedAt(pl.x + off, ny)) { nx = pl.x + Math.sign(off) * Math.min(Math.abs(off), sp); ny = pl.y; break; } }
      else { for (const off of [3, -3, 6, -6]) if (!blockedAt(nx, pl.y + off)) { ny = pl.y + Math.sign(off) * Math.min(Math.abs(off), sp); nx = pl.x; break; } }
      if (blockedAt(nx, ny)) { if (b.door && t - bumpAt > 900) { bumpAt = t; tryDoorLetter(b.door); } pl.moving = false; return; }
    }
    pl.x = nx; pl.y = ny;
    if (t - stepAt > 380) { stepAt = t; sfx('step'); }
    pl.trail.unshift([pl.x, pl.y, pl.dir]); if (pl.trail.length > 90) pl.trail.length = 90;
    // walked into a doorway?
    const tx = Math.floor(pl.x / TS), ty = Math.floor((pl.y - 3) / TS), ch = tileAt(room, tx, ty);
    if (isDoorCh(ch) && doorOpen(room, ch)) { const dd = room.doors[ch]; goRoom(dd.to, dd.back); return; }
    for (const o of objs) if (o.door && T[o.t].flat && (o.walk !== false) && (o.t === 'stairsUp' || o.t === 'stairsDown') && !(o.gateFlag && !ST.F[o.gateFlag])) {
      const r = objRect(o); if (pl.x > r.x + 4 && pl.x < r.x + r.w - 4 && pl.y - 3 > r.y + 2 && pl.y - 3 < r.y + r.h - 4) { goRoom(o.door.to, o.door.back); return; }
    }
  }
  function moveFollowers() {
    let k = 0;
    for (const [name, n] of Object.entries(ST.npc)) {
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
  // when two things touch (a hatch above its ladder, shelves side by side) take the one whose middle is closest
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
  async function interact() {
    if (busy || pl.hidden) { if (pl.hidden && !busy) await leaveHide(); return; }
    const [fx, fy] = facingPoint();
    for (const [name, n] of Object.entries(ST.npc)) if (n.room === roomId && !n.gone && Math.hypot(n.x - fx, n.y - 4 - fy) < 13) return run('talk' + name, { name });
    const best = pickAt(fx, fy, o => o.use || o.door);
    if (best) {
      if (best.use) return run(best.use, { o: best });
      if (best.door) return goRoom(best.door.to, best.door.back);
    }
    const ch = tileAt(room, Math.floor(fx / TS), Math.floor(fy / TS));
    if (isDoorCh(ch)) return tryDoorLetter(ch);
  }
  async function tryDoorLetter(ch) {
    const d = room.doors[ch]; if (!d) return;
    if (d.use) return run(d.use, {});
    if (d.lock && !ST.F[d.lock]) { if (d.lockUse) return run(d.lockUse, {}); sfx('locked'); return say([[null, '잠겨 있다.']]); }
  }
  async function run(name, ctx) {
    const fn = SCRIPT[name];
    if (!fn) return say([[null, '특별한 건 없는 것 같다.']]);
    busy++;
    try { await fn(ctx || {}); } catch (e) { console.error(e); } finally { busy = Math.max(0, busy - 1); }
  }

  // ---- hiding ----
  async function enterHide(o) {
    pl.hidden = { x: pl.x, y: pl.y, o, at: now(), seen: !!(mon && !mon.gone && mon.room === roomId && Math.hypot(mon.x - pl.x, mon.y - pl.y) < 92) };
    const r = objRect(o); pl.x = r.x + r.w / 2; pl.y = r.y + r.h - 2;
    sfx('hide'); note('숨었다… 숨을 죽이자. (확인 버튼을 누르면 나와요)');
  }
  async function leaveHide() {
    if (!pl.hidden) return;
    pl.x = pl.hidden.x; pl.y = pl.hidden.y; pl.hidden = null; sfx('hide');
  }
  // ================= the thing that chases you =================
  const MSPEED = { blue: 60, grin: 63, crawl: 70, scream: 66 };
  function startChase(kind, x, y, secs, opt) {
    mon = { kind, room: roomId, x, y, dir: 'down', path: null, pathAt: 0, until: now() + secs * 1000, pending: null, gone: false, appearAt: now(), lostAt: 0, sniffAt: now() + 3500, opt: opt || {} };
    if (opt && opt.enterAfter) { mon.room = '(between)'; mon.pending = { room: roomId, back: opt.back, at: now() + opt.enterAfter }; }
    chaseCount++; chaseMusic(true); sfx('sting'); shake = 6;
  }
  function endChase(quiet) {
    if (!mon) return;
    const was = mon; mon = null; chaseMusic(false);
    if (!quiet) note('…발소리가 멀어졌다.');
    if (was.opt.onEnd) was.opt.onEnd();
    snapshot(); saveNow();
  }
  // you went through a door: it comes after you, a little later, through the same door
  function monFollow(fromRoom, toRoom, back) {
    if (!mon || mon.gone) return;
    const base = mon.pending ? 1400 : 900 + (mon.room === fromRoom ? Math.hypot(mon.x - pl.x, mon.y - pl.y) / MSPEED[mon.kind] * 1000 * 0.6 : 600);
    mon.pending = { room: toRoom, back, at: now() + clamp(base, 900, 3200) };
    mon.room = '(between)';
  }
  function monStep(dt, t) {
    if (!mon) return;
    if (mon.pending && t >= mon.pending.at) {
      if (mon.pending.room === roomId) {
        const [x, y] = spawnFor(roomId, mon.pending.back);
        mon.x = x; mon.y = y; mon.room = roomId; mon.path = null; mon.appearAt = t; sfx('door'); shake = 3;
      } else mon.room = mon.pending.room;
      mon.pending = null;
    }
    if (mon.room !== roomId) { if (t > mon.until && !mon.pending) endChase(); return; }
    const dist = Math.hypot(mon.x - pl.x, mon.y - pl.y);
    // heartbeat when it is close
    if (dist < 130 && t > heartAt) { heartAt = t + 450 + dist * 5; sfx('heart'); }
    // hiding: if it did not see you go in, it gives up
    if (pl.hidden) {
      if (pl.hidden.seen) { goToward(dt, t, pl.hidden.x, pl.hidden.y); if (Math.hypot(mon.x - pl.x, mon.y - pl.y) < 20) return caught(); return; }
      if (!mon.lostAt) mon.lostAt = t;
      wander(dt, t);
      if (t - mon.lostAt > 2800 && !mon.gone) { mon.gone = true; mon.fadeAt = t; }
      return;
    }
    mon.lostAt = 0;
    if (mon.gone) return;
    if (t > mon.until && dist > 70) { mon.gone = true; mon.fadeAt = t; return; }
    // the crawler stops now and then to feel the air
    if (mon.kind === 'crawl' && t > mon.sniffAt) { if (t < mon.sniffAt + 650) return; mon.sniffAt = t + 3200 + Math.random() * 1500; }
    if (t - mon.appearAt < 500) return;   // a beat to see it before it moves
    goToward(dt, t, pl.x, pl.y);
    if (Math.hypot(mon.x - pl.x, mon.y - pl.y) < 11) caught();
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
    if (!mon.wto || t > mon.wtoAt) { mon.wtoAt = t + 1200; const ok = []; for (let i = 0; i < grid.grid.length; i++) if (grid.grid[i]) ok.push(i); const c = pick(ok); mon.wto = [(c % grid.W) * TS + 8, ((c / grid.W) | 0) * TS + 11]; mon.path = null; }
    goToward(dt * 0.6, t, mon.wto[0], mon.wto[1]);
  }
  async function caught() {
    if (busy > 50) return;
    busy += 100; pl.moving = false; mon.caught = true;
    sfx('catch'); redFlash = 1; shake = 10; chaseMusic(false);
    await wait(900);
    const ch = await choose('그것에게 잡혔다…', ['마지막 저장 지점에서 다시', '저택 밖으로 나가기'], 'over');
    busy -= 100;
    if (ch === 0) restore(checkpoint); else close();
  }
  function restore(snap) {
    if (!snap) return;
    const played = ST.t + (now() - playStart) / 1000;
    ST = JSON.parse(JSON.stringify(snap)); ST.t = played; mon = null; chaseMusic(false); redFlash = 0;
    loadRoom(ST.room); pl.x = ST.x; pl.y = ST.y; pl.dir = ST.dir || 'down'; pl.hidden = null; pl.trail = [];
    for (const n of Object.values(ST.npc)) if (n.follow) { n.room = ST.room; n.x = pl.x; n.y = pl.y; }
    camSnap(); playStart = now(); note('다시…');
  }

  // ================= drawing =================
  function camSnap() { const [cx, cy] = camTarget(); camX = cx; camY = cy; }
  function camTarget() {
    const W = room.pw, H = room.ph;
    const cx = W <= VW ? (W - VW) / 2 : clamp(pl.x - VW / 2, 0, W - VW);
    const cy = H <= VH ? (H - VH) / 2 : clamp(pl.y - 10 - VH / 2, 0, H - VH);
    return [cx, cy];
  }
  function draw(t) {
    if (!g || !room) return;
    const [tx, ty] = camTarget();
    camX += (tx - camX) * 0.18; camY += (ty - camY) * 0.18;
    const sx = shake ? (Math.random() * 2 - 1) * shake : 0, sy = shake ? (Math.random() * 2 - 1) * shake : 0;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#07060a'; g.fillRect(0, 0, VW, VH);
    const ox = Math.round(-camX + sx), oy = Math.round(-camY + sy);
    g.setTransform(1, 0, 0, 1, ox, oy);
    g.drawImage(room.cv, 0, 0);
    // flat things first, then everything that stands, nearest last
    const list = [];
    for (const o of objs) { const d = T[o.t]; if (d.flat || d.wall) { d.draw(g, o.x * TS, o.y * TS, o, t); if (d.glint && Math.floor(t / 600) % 3 === 0) P(g, o.x * TS + 10, o.y * TS + 5, 1, 1, '#fff8d0'); } else list.push({ y: (o.y + (o.h || d.h)) * TS - 1, o }); }
    for (const [name, n] of Object.entries(ST.npc)) if (n.room === roomId && !n.gone) list.push({ y: n.y, npc: name, n });
    if (!pl.hidden) list.push({ y: pl.y, me: true });
    if (mon && mon.room === roomId && !mon.pending) list.push({ y: mon.y, mon: true });
    list.sort((a, z) => a.y - z.y);
    for (const e of list) {
      if (e.o) T[e.o.t].draw(g, e.o.x * TS, e.o.y * TS, e.o, t);
      else if (e.me) drawPerson(g, O.lookOf(O.uid()), pl.x, pl.y, pl.dir, pl.moving, t);
      else if (e.npc) drawPerson(g, NPC_LOOK[e.npc], e.n.x, e.n.y, e.n.dir || 'down', !!e.n.moving, t, e.n.ghost ? { alpha: 0.5 } : null);
      else if (e.mon) {
        let a = 1; if (mon.gone) a = clamp(1 - (t - mon.fadeAt) / 900, 0, 1); if (mon.gone && a <= 0) { endChase(); continue; }
        drawMon(g, mon.kind, mon.x, mon.y, mon.dir, t, { alpha: a, moving: mon.moving, rage: !mon.gone && Math.hypot(mon.x - pl.x, mon.y - pl.y) < 50 });
      }
    }
    if (!pl.hidden && !dlg.on) drawBubbles(t);
    // the dark, with your torch and any candles
    g.setTransform(1, 0, 0, 1, 0, 0);
    const lit = has('flashlight');
    let amount = room.dark; if (room.need && !lit) amount = 0.985;
    const lights = [{ x: pl.x + ox, y: pl.y - 10 + oy, r: (lit ? 82 : 58) * (1 + Math.sin(t / 130) * 0.02 + (Math.random() < 0.01 ? -0.12 : 0)) }];
    if (lit && !pl.hidden) { const v = DIRV[pl.dir]; lights.push({ x: pl.x + v[0] * 34 + ox, y: pl.y - 10 + v[1] * 34 + oy, r: 46, a: 0.8 }); }
    for (const o of objs) { const d = T[o.t]; if (d.light && !o.out && !(d.lightIf && !o[d.lightIf])) { const r = objRect(o); lights.push({ x: r.x + r.w / 2 + ox, y: r.y + 2 + oy, r: d.light * (0.9 + Math.random() * 0.1), a: 0.85 }); } }
    if (darkness(dk, dkg, amount, lights, VW, VH)) g.drawImage(dk, 0, 0);
    // red when it is near or has you
    let red = redFlash; if (mon && mon.room === roomId && !mon.gone) red = Math.max(red, clamp(1 - Math.hypot(mon.x - pl.x, mon.y - pl.y) / 120, 0, 1) * 0.35);
    if (red > 0.01) { const gr = g.createRadialGradient(VW / 2, VH / 2, 40, VW / 2, VH / 2, 170); gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(140,0,10,${red})`); g.fillStyle = gr; g.fillRect(0, 0, VW, VH); }
    if (pl.hidden) { g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, 0, VW, VH); g.fillStyle = 'rgba(0,0,0,.9)'; g.fillRect(0, 0, VW, 40); g.fillRect(0, VH - 40, VW, 40); g.fillStyle = 'rgba(255,240,200,.12)'; g.fillRect(VW / 2 - 1, 40, 2, VH - 80); }
    if (fadeA > 0) { g.fillStyle = `rgba(0,0,0,${fadeA})`; g.fillRect(0, 0, VW, VH); }
    shake = Math.max(0, shake - 0.6); redFlash = Math.max(0, redFlash - 0.01);
  }
  // "…" bubbles over everything you can look at, like in the lounge; the one you are facing turns yellow
  function facingTarget() {
    const [fx, fy] = facingPoint();
    for (const [name, n] of Object.entries(ST.npc)) if (n.room === roomId && !n.gone && Math.hypot(n.x - fx, n.y - 4 - fy) < 13) return n;
    return pickAt(fx, fy, o => o.use || o.door);
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
      if (!o.use || (o.t === 'bars' && !o.door)) continue;
      const r = objRect(o), cx = r.x + r.w / 2;
      if (Math.hypot(cx - pl.x, r.y + r.h / 2 - pl.y) > R) continue;
      bubble(cx, r.y, o === hot, t);
    }
    for (const n of Object.values(ST.npc)) if (n.room === roomId && !n.gone && !n.follow && Math.hypot(n.x - pl.x, n.y - pl.y) < R) bubble(n.x, n.y - 22, n === hot, t);
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if (!room) return;
    if (actQ) { actQ = false; if (!dlg.on && !panelOn()) interact(); }
    if (bagQ) { bagQ = false; if (!busy) openBag(); }
    movePlayer(dt, t); moveFollowers(); if (!dlg.on && !panelOn()) monStep(dt, t);
    draw(t);
  }
  function fade(to, ms) { return new Promise(res => { const from = fadeA, t0 = now(); const step = () => { const k = clamp((now() - t0) / ms, 0, 1); fadeA = lerp(from, to, k); if (k < 1) requestAnimationFrame(step); else res(); }; step(); }); }

  // ================= talking, choosing, notes =================
  const dlg = { on: false, resolve: null, full: '', shown: 0, timer: 0 };
  function say(lines) {
    return new Promise(async res => {
      busy++;
      for (const ln of lines) {
        const [name, text] = Array.isArray(ln) ? ln : [null, ln];
        await sayOne(name, text);
      }
      busy--; res();
    });
  }
  // lines always come one at a time, even if two scenes ask to talk at once
  let dlgChain = Promise.resolve();
  function sayOne(name, text) { const p = dlgChain.then(() => showLine(name, text)); dlgChain = p.catch(() => {}); return p; }
  function showLine(name, text) {
    return new Promise(res => {
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
  function choose(text, opts, kind) {
    return new Promise(res => {
      busy++;
      const p = panel(kind === 'over' ? 'hr-over' : 'hr-ask');
      p.appendChild(el('p', 'hr-q', text));
      opts.forEach((o, i) => { const b = el('button', 'btn' + (i === 0 ? ' btn-gold' : ''), o); b.type = 'button'; b.addEventListener('click', () => { closePanel(); busy--; res(i); }); p.appendChild(b); });
      setTimeout(() => { const b = p.querySelector('button'); if (b) b.focus(); }, 30);
    });
  }
  let noteT = 0;
  function note(text) { ui.note.textContent = text; ui.note.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { ui.note.hidden = true; }, 2600); }
  function panel(cls) { closePanel(); const p = el('div', 'hr-panel ' + (cls || '')); ui.stage.appendChild(p); ui.panel = p; return p; }
  function closePanel() { if (ui.panel) { ui.panel.remove(); ui.panel = null; } }
  const panelOn = () => !!ui.panel;

  // ---- the bag ----
  function openBag() {
    busy++;
    const p = panel('hr-bag');
    p.appendChild(el('h3', '', '🎒 가방'));
    if (!ST.inv.length) p.appendChild(el('p', 'hr-empty', '아직 아무것도 없다.'));
    const list = el('div', 'hr-items'); p.appendChild(list);
    const desc = el('p', 'hr-desc', ST.inv.length ? '물건을 누르면 자세히 볼 수 있어요.' : '');
    for (const id of ST.inv) {
      const it = ITEMS[id]; const b = el('button', 'hr-item', `${it.i} ${it.n}`); b.type = 'button';
      b.addEventListener('click', () => { desc.textContent = it.d; list.querySelectorAll('.hr-item').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
      list.appendChild(b);
    }
    p.appendChild(desc);
    const row = el('div', 'hr-row');
    const snd = el('button', 'btn', AU.on ? '🔊 소리 끄기' : '🔇 소리 켜기'); snd.type = 'button'; snd.addEventListener('click', () => { setSound(!AU.on); snd.textContent = AU.on ? '🔊 소리 끄기' : '🔇 소리 켜기'; });
    const x = el('button', 'btn btn-gold', '닫기'); x.type = 'button'; x.addEventListener('click', () => { closePanel(); busy--; });
    row.append(snd, x); p.appendChild(row);
    p._close = () => { closePanel(); busy--; };
  }

  // ---- puzzles ----
  function pianoPuzzle() {
    return new Promise(res => {
      busy++;
      const p = panel('hr-piano');
      p.appendChild(el('h3', '', '🎹 피아노'));
      p.appendChild(el('p', 'hr-desc', '건반을 눌러 연주해 보세요. 어딘가에서 본 악보가 있었는데…'));
      const keysRow = el('div', 'hr-keys'); p.appendChild(keysRow);
      const shown = el('p', 'hr-played', ''); p.appendChild(shown);
      const want = ['도', '도', '솔', '솔', '라', '라', '솔']; let got = [];
      for (const n of ['도', '레', '미', '파', '솔', '라', '시', '높은도']) {
        const k = el('button', 'hr-key', n === '높은도' ? '도' : n); k.type = 'button';
        k.addEventListener('click', () => {
          pianoNote(n); got.push(n); if (got.length > 7) got.shift(); shown.textContent = got.join(' · ');
          if (got.length === 7 && got.every((x, i) => x === want[i])) { setTimeout(() => { closePanel(); busy--; res(true); }, 500); }
        });
        keysRow.appendChild(k);
      }
      const row = el('div', 'hr-row');
      const clr = el('button', 'btn', '처음부터'); clr.type = 'button'; clr.addEventListener('click', () => { got = []; shown.textContent = ''; });
      const x = el('button', 'btn', '그만두기'); x.type = 'button'; x.addEventListener('click', () => { closePanel(); busy--; res(false); });
      row.append(clr, x); p.appendChild(row);
      p._close = () => { closePanel(); busy--; res(false); };
    });
  }
  function dialPuzzle(title, hint, answer) {
    return new Promise(res => {
      busy++;
      const p = panel('hr-dial');
      p.appendChild(el('h3', '', title)); p.appendChild(el('p', 'hr-desc', hint));
      const row = el('div', 'hr-dials'); p.appendChild(row);
      const v = [0, 0, 0, 0];
      v.forEach((_, i) => {
        const col = el('div', 'hr-dialcol');
        const up = el('button', 'btn', '▲'), num = el('b', 'hr-num', '0'), dn = el('button', 'btn', '▼'); up.type = dn.type = 'button';
        up.addEventListener('click', () => { v[i] = (v[i] + 1) % 10; num.textContent = v[i]; sfx('tick'); });
        dn.addEventListener('click', () => { v[i] = (v[i] + 9) % 10; num.textContent = v[i]; sfx('tick'); });
        col.append(up, num, dn); row.appendChild(col);
      });
      const r2 = el('div', 'hr-row');
      const ok = el('button', 'btn btn-gold', '돌려 보기'); ok.type = 'button';
      ok.addEventListener('click', () => { if (v.join('') === answer) { closePanel(); busy--; res(true); } else { sfx('locked'); note('철컥… 열리지 않는다.'); } });
      const x = el('button', 'btn', '그만두기'); x.type = 'button'; x.addEventListener('click', () => { closePanel(); busy--; res(false); });
      r2.append(ok, x); p.appendChild(r2);
      p._close = () => { closePanel(); busy--; res(false); };
    });
  }
  function leverPuzzle(answer) {
    return new Promise(res => {
      busy++;
      const p = panel('hr-lever');
      p.appendChild(el('h3', '', '⚙️ 레버 세 개'));
      p.appendChild(el('p', 'hr-desc', '레버마다 해·달·별 무늬가 돌아가며 맞춰져요. 철창 위에 1·2·3 번호가 있다.'));
      const SYM = ['☀️ 해', '🌙 달', '⭐ 별'];
      const st = (ost('jail', 'levers').state || [0, 0, 0]).slice();
      const row = el('div', 'hr-dials'); p.appendChild(row);
      st.forEach((_, i) => {
        const col = el('div', 'hr-dialcol'); col.appendChild(el('span', 'hr-small', (i + 1) + '번'));
        const b = el('button', 'btn hr-lv', SYM[st[i]]); b.type = 'button';
        b.addEventListener('click', () => { st[i] = (st[i] + 1) % 3; b.textContent = SYM[st[i]]; ost('jail', 'levers').state = st.slice(); sfx('unlock'); });
        col.appendChild(b); row.appendChild(col);
      });
      const r2 = el('div', 'hr-row');
      const ok = el('button', 'btn btn-gold', '당기기'); ok.type = 'button';
      ok.addEventListener('click', () => { if (st.join('') === answer) { closePanel(); busy--; res(true); } else { sfx('locked'); shake = 3; note('끼익… 아무 일도 일어나지 않는다.'); } });
      const x = el('button', 'btn', '그만두기'); x.type = 'button'; x.addEventListener('click', () => { closePanel(); busy--; res(false); });
      r2.append(ok, x); p.appendChild(r2);
      p._close = () => { closePanel(); busy--; res(false); };
    });
  }
  function showNote(id) { return say([[null, ITEMS[id].d]]); }
  // ================= the story =================
  const ME = () => (need() && O.name()) || '나';
  const npcAt = (name, rid, tx, ty, dir) => { const n = ST.npc[name]; n.room = rid; n.x = tx * TS + 8; n.y = ty * TS + 10; n.dir = dir || 'down'; n.follow = false; n.gone = false; };
  const npcGone = name => { const n = ST.npc[name]; n.room = '(gone)'; n.follow = false; };
  async function intro() {
    busy++;
    fadeA = 1;
    npcAt('철수', 'hall', 9, 7, 'up'); npcAt('유리', 'hall', 5, 7, 'up'); npcAt('훈이', 'hall', 7, 6, 'up');
    await wait(300);
    await fade(0, 900);
    await say([['철수', '와… 진짜 있네. 소문으로만 듣던 그 저택.'], ['훈이', '야, 사진만 찍고 가자. 여기 진짜 이상하다니까…'], ['유리', '숲에 들어올 때부터 새소리가 하나도 안 들렸어. 다들 눈치챘어?']]);
    sfx('slam'); shake = 12; await wait(700);
    await say([['훈이', '뭐, 뭐야?! 문이 닫혔어!'], [null, '철수가 문고리를 잡아당겼다. 꿈쩍도 하지 않는다.'], ['철수', '…밖에서 잠긴 것 같은데? 이거 장난 아니다.'], ['유리', '흩어져서 다른 출구를 찾아보자. 난 서재를 볼게.'], ['철수', '그럼 난 식당 쪽! ' + ME() + ', 넌 복도 쪽 좀 봐 줘.'], ['훈이', '나, 난 여기 있을게… 문 지키는 사람도 필요하잖아. 그렇지?']]);
    await fade(1, 400);
    npcAt('유리', 'library', 8, 4, 'down'); npcAt('철수', 'dining', 12, 3, 'left'); npcAt('훈이', 'hall', 7, 5, 'down');
    await fade(0, 400);
    ST.F.intro = 1;
    note('방향키로 움직이고, 스페이스(확인)로 살펴보세요. 가방은 X 키.');
    busy--;
    snapshot(); saveNow();
  }
  // things that happen the first time you walk into a room
  async function onEnter(rid, from) {
    const Fl = ST.F;
    if (rid === 'corridor1' && Fl.chase1Done && !Fl.ev_piano) { Fl.ev_piano = 1; await wait(400); pianoNote('미'); await wait(380); pianoNote('레'); await wait(380); pianoNote('도'); await say([[null, '…피아노 소리? 저 방은 분명 잠겨 있었는데.']]); }
    if (rid === 'hall' && Fl.chase1Done && !Fl.ev_hun) { Fl.ev_hun = 1; await say([[null, '훈이가 보이지 않는다.'], [null, '바닥에 훈이의 휴대폰이 떨어져 있다…']]); }
    if (rid === 'bath' && Fl.chase1Done && !Fl.ev_mirror) { Fl.ev_mirror = 1; ost('bath', 'mirror').writing = true; loadRoom('bath'); sfx('sting'); await say([[null, '거울에… 붉은 글씨가 생겼다.'], [null, '「 보 고 있 어 」']]); }
    if (rid === 'bedroom' && Fl.gateOpen && !Fl.metCheol) {
      Fl.metCheol = 1; ost('bedroom', 'wardrobe').shake = true; loadRoom('bedroom');
      await say([[null, '옷장이… 덜컹거린다.']]);
    }
    if (rid === 'corridor2' && from === 'attic' && Fl.gotBasementKey && !Fl.yuriJoined) {
      Fl.yuriJoined = 1; npcAt('유리', 'corridor2', 15, 3, 'left');
      await say([['유리', ME() + '! 찾았다… 너까지 사라진 줄 알았어.'], ['유리', '훈이도, 철수도 없어. 그런데 아까부터… 바닥 아래에서 누가 우는 소리가 들려.'], [ME(), '지하실 열쇠를 찾았어. 1층 복도 끝 쇠사슬 문이야.'], ['유리', '같이 가. 이번엔 혼자 안 둬.']]);
      ST.npc.유리.follow = true; note('유리가 따라옵니다.');
    }
    if (rid === 'b1hall' && Fl.yuriJoined && !Fl.chase3Done && !Fl.chase3Start) {
      Fl.chase3Start = 1;
      await wait(500);
      await say([['유리', '…방금, 저쪽 어둠에서 뭔가 움직였어.'], [null, '사각, 사각— 돌바닥을 긁는 소리가 다가온다.']]);
      const n = ST.npc.유리; sfx('sting'); shake = 10; redFlash = 0.6;
      await say([['유리', '꺄악—!!'], [null, '무언가가 유리를 어둠 속으로 끌고 갔다.']]);
      npcGone('유리');
      startChase('crawl', 2 * TS + 8, 6 * TS + 10, 28, { onEnd: () => { ST.F.chase3Done = 1; npcAt('유리', 'jail', 12, 3, 'down'); note('유리를 찾아야 해…'); } });
    }
    if (rid === 'tunnel' && Fl.freed && !Fl.finalStart) {
      Fl.finalStart = 1;
      await say([['철수', '저 끝! 사다리야! 빛이 보여!'], [null, '등 뒤에서, 귀를 찢는 비명이 터져 나왔다.']]);
      startChase('scream', 1 * TS + 8, 3 * TS + 10, 999, { enterAfter: 1600, back: 'W' });
      note('뛰어요! 사다리까지!');
    }
  }
  const SCRIPT = {
    // ---- 현관 홀 ----
    frontDoor: async () => { sfx('locked'); await say([[null, '정문이다. 아무리 밀고 당겨도 열리지 않는다.'], [null, '열쇠 구멍은 녹으로 꽉 막혀 있다.']]); },
    stairs: async () => {
      if (ST.F.gateOpen) return;
      if (has('stairKey')) {
        sfx('unlock'); take('stairKey'); ST.F.gateOpen = 1; ost('hall', 'stairs').gate = false; loadRoom('hall');
        await say([[null, '계단 열쇠로 철문을 열었다. 끼이익—'], [null, '2층으로 올라갈 수 있다.']]);
        if (ST.npc.철수.room === 'dining') { await say([[null, '식당 쪽에서 철수가 뛰어나왔다.'], ['철수', '열었어?! 나이스! 내가 먼저 올라가 볼게!'], [ME(), '야, 같이 가!']]); ST.npc.철수.room = '(upstairs)'; }
        return;
      }
      sfx('locked'); await say([[null, '2층으로 가는 계단이다. 쇠창살 문이 막고 있다.'], [null, '자물쇠에 「계단」이라고 새겨져 있다.']]);
    },
    hallPainting: async () => { await say([[null, '어두운 숲을 그린 그림. 숲 한가운데 이 저택이 있다.'], [null, '창문 하나에… 누군가 서 있는 것처럼 그려져 있다.']]); },
    coatrack: async () => { await say([[null, '낡은 외투가 걸려 있다. 주머니는 비어 있다.']]); },
    vase: async () => { await say([[null, '마른 꽃이 꽂힌 꽃병. 손대자 꽃잎이 바스러진다.']]); },
    talk훈이: async () => {
      if (await talkCommon('훈이')) return;
      if (!ST.F.chase1Done) {
        const L = has('silverKey') ? [['훈이', '그 소리 뭐였어?! 너 뭐 본 거 아니지? 아니지?!']] :
          ST.F.tubDrained ? [['훈이', '욕실 물 뺐어? 으… 무슨 냄새 안 났어?']] :
          [['훈이', '나 여기서 문 지킨다. 진짜야. 무서워서 그러는 거 아니고.'], ['훈이', '근데… 2층에서 자꾸 누가 걷는 소리 나지 않아?']];
        return say(L);
      }
    },
    // ---- 서재 ----
    books: async () => { await say([[null, pick(['먼지 쌓인 책들. 제목이 다 지워져 있다.', '「약초학」, 「영원에 관하여」… 어려운 책들뿐이다.', '책장 사이에 마른 꽃잎이 끼워져 있다.'])]]); },
    gapShelf: async () => { await say([[null, '책 한 권이 빠진 자리. 그 안쪽 벽에 손톱으로 긁은 자국이 있다.']]); },
    diary1: async () => { if (!has('diary1')) give('diary1', true); await say([[null, '책상 위에 일기장 한 장이 펼쳐져 있다.']]); await showNote('diary1'); },
    armchair: async () => { await say([[null, '푹신한 안락의자. 방금까지 누가 앉아 있었던 것처럼… 따뜻하다.']]); },
    talk유리: async () => {
      if (await talkCommon('유리')) return;
      const F_ = ST.F;
      if (F_.yuriJoined) return say([['유리', pick(['붙어 다니자. 절대 혼자 가지 마.', '지하에서 나는 소리… 사람 목소리 같아.'])]]);
      if (!F_.chase1Done) return say([['유리', '이 집 주인 일기 같아. 「그 약을 완성해야만 한다」… 무슨 약일까.'], ['유리', '그리고 식당에 악보가 걸려 있었어. 피아노 방이 있다면… 뭔가 있을지도.']]);
      if (!F_.gateOpen) return say([['유리', '훈이가 없어졌다고?! …흩어진 게 실수였어.'], ['유리', '2층 계단 열쇠를 찾아야 해. 피아노 방이 수상해. 식당 악보 기억나?']]);
      return say([['유리', '난 여기서 책을 더 찾아볼게. 이 집이 왜 이렇게 됐는지 알아야 나갈 방법도 보일 것 같아.'], ['유리', '2층 조심해. 정말로.']]);
    },
    // ---- 식당 ----
    table: async () => { await say([[null, '긴 식탁. 접시마다 먼지가 소복하다. 여덟 명분이 차려져 있다.']]); },
    clock: async () => { await say([[null, '멈춘 괘종시계. 바늘이 3시 14분을 가리키고 있다.']]); },
    familyPainting: async () => { await say([[null, '가족 초상화. 아버지, 그리고 세 아이.'], [null, '막내 아이의 얼굴만… 검게 칠해져 있다.']]); },
    sheetMusic: async () => { await say([[null, '액자에 든 악보. 「작은 별」.'], [null, '음표 아래에 누군가 연필로 적어 놓았다: 「도 도 솔 솔 라 라 솔」']]); ST.F.sawSheet = 1; },
    cupboard: async ctx => hideOrLook(ctx.o, '그릇장. 안이 넓어서 사람 하나는 들어갈 수 있을 것 같다.'),
    talk철수: async () => {
      if (await talkCommon('철수')) return;
      const F_ = ST.F;
      if (!F_.chase1Done) return say([['철수', '식당엔 별거 없어. 근데 저 시계, 멈춰 있는 시간이 좀 기분 나쁘지 않냐?'], ['철수', '2층 계단은 쇠창살로 막혀 있더라. 열쇠가 어딘가 있을 거야.']]);
      if (!F_.gateOpen) return say([['철수', '훈이가 사라졌다고? …장난이겠지. 그 겁쟁이가 숨은 거라고.'], ['철수', '빨리 계단 열쇠 찾자. 위층에 출구가 있을지도 몰라.']]);
      if (F_.metCheol && !F_.cheolGone) return say([['철수', '쉿… 목소리 낮춰. 그거, 아직 이 층 어딘가에 있어.'], ['철수', '연구실에 금고가 있었어. 번호를 모르겠더라.']]);
      return say([['철수', '…']]);
    },
    // ---- 복도 ----
    hideSpot: async ctx => hideOrLook(ctx.o, '안에 몸을 숨길 수 있을 것 같다.'),
    cheolWardrobe: async ctx => {
      if (ST.F.metCheol && !ST.F.cheolOut) {
        ST.F.cheolOut = 1; ost('bedroom', 'wardrobe').shake = false; loadRoom('bedroom'); sfx('creak');
        npcAt('철수', 'bedroom', 11, 3, 'left');
        return say([[null, '옷장 문을 열자—'], ['철수', '으아악! …아, 너구나. 놀래라.'], ['철수', '봤어…? 파랗고, 커다란… 그게 계단에서 올라왔어. 눈을 한 번도 안 깜빡이더라.'], ['철수', '연구실에 금고가 있었어. 뭔가 중요한 게 들어 있을 거야. 번호만 알면…']]);
      }
      return hideOrLook(ctx.o, '큰 옷장. 안에 몸을 숨길 수 있을 것 같다.');
    },
    hunPhone: async () => { ST.F.gotPhone = 1; loadRoom('hall'); give('hunPhone'); return showNote('hunPhone'); },
    girlPainting: async () => { await say([[null, '피아노 앞에 앉은 소녀의 초상화. 눈이 계속 나를 따라오는 것 같다.']]); },
    pianoDoor: async () => {
      if (has('silverKey')) { sfx('unlock'); take('silverKey'); ST.F.pianoOpen = 1; return say([[null, '은열쇠가 딱 맞는다. 철컥.']]); }
      sfx('locked'); return say([[null, '잠겨 있다. 문에 음표 모양의 작은 열쇠 구멍이 있다.']]);
    },
    basementDoor: async () => {
      if (has('basementKey')) { sfx('unlock'); take('basementKey'); ST.F.basementOpen = 1; return say([[null, '지하실 열쇠로 쇠사슬 자물쇠를 풀었다. 차가운 공기가 올라온다.']]); }
      sfx('locked'); return say([[null, '두꺼운 쇠사슬이 감긴 문. 아래로 내려가는 계단이 있는 것 같다.'], [null, '문틈에서… 누군가 흐느끼는 소리가 들린다.']]);
    },
    // ---- 부엌 ----
    sink: async ctx => {
      if (!has('gloves')) { ost('kitchen', 'sink').gloves = false; loadRoom('kitchen'); give('gloves'); return say([[null, '싱크대 옆에 노란 고무장갑이 있다. 챙겨 두자.']]); }
      return say([[null, '싱크대 배수구에서 검은 물이 꾸르륵 올라온다.']]);
    },
    stove: async () => say([[null, '냄비 안에 뭔가 끓이다 만 것이 굳어 있다. 냄새는… 맡지 않기로 했다.']]),
    drawers: async () => {
      if (!has('flashlight')) { give('flashlight'); return say([[null, '서랍 깊숙한 곳에서 손전등을 찾았다!'], [null, '이제 어두운 곳도 갈 수 있다.']]); }
      return say([[null, '숟가락, 포크, 녹슨 칼… 쓸 만한 건 없다.']]);
    },
    fridge: async () => say([[null, '냉장고 문을 살짝 열었다가 바로 닫았다.'], [null, '…아무것도 못 본 거다.']]),
    kTable: async () => say([[null, '식탁 위에 먹다 남은 빵. 곰팡이가 피었다.']]),
    trash: async () => say([[null, '찢어진 쪽지가 버려져 있다. 「…약을 먹은 쥐가 사라졌다. 우리 밖으로…」']]),
    // ---- 욕실 ----
    tub: async () => {
      const s = ost('bath', 'tub');
      if (!s.drained) {
        if (!has('gloves')) return say([[null, '욕조에 시커먼 물이 가득하다. 바닥이 보이지 않는다.'], [null, '맨손으로 넣기는… 싫다. 장갑이라도 있었으면.']]);
        const c = await choose('고무장갑을 끼고 욕조 마개를 뽑을까?', ['뽑는다', '그만둔다']);
        if (c !== 0) return;
        sfx('water'); s.drained = true; loadRoom('bath'); ST.F.tubDrained = 1;
        await say([[null, '꾸르륵… 검은 물이 천천히 빠져나간다.'], [null, '바닥에 무언가 반짝인다.']]);
        return;
      }
      if (!ST.F.gotSilverKey) {
        ST.F.gotSilverKey = 1; give('silverKey');
        await say([[null, '작은 은열쇠를 주웠다. 손잡이에 음표가 새겨져 있다.']]);
        // the closet bursts open
        await wait(300); sfx('creak'); ost('bath', 'closet').ajar = true; loadRoom('bath'); shake = 4;
        await say([[null, '…등 뒤에서 벽장 문이 끼익 열렸다.']]);
        startChase('blue', 8 * TS + 8, 6 * TS + 10, 32, { onEnd: () => { ST.F.chase1Done = 1; npcGone('훈이'); npcAt('훈이', 'jail', 2, 3, 'down'); } });
        note('도망쳐요! 방을 나가거나 숨으세요!');
        return;
      }
      return say([[null, '물이 빠진 욕조. 바닥에 긁힌 자국이 길게 나 있다.']]);
    },
    toilet: async () => say([[null, '변기 뚜껑을 열어 볼까… 아니, 그만두자.']]),
    bathSink: async () => say([[null, '수도꼭지를 돌리자 붉은 녹물이 한참 흘러나왔다.']]),
    mirror: async ctx => { if (ctx.o.writing) return say([[null, '「 보 고 있 어 」'], [null, '글씨가… 안쪽에서 쓴 것처럼 거꾸로 되어 있다.']]); return say([[null, '뿌연 거울. 내 얼굴 뒤로… 아니, 아무것도 없다.']]); },
    bathCloset: async ctx => { if (ST.F.gotSilverKey) return hideOrLook(ctx.o, '그것이 튀어나온 벽장이다. 지금은 비어 있다.'); return say([[null, '벽장 문이 꽉 닫혀 있다. 안에서… 숨소리 같은 게 들리는 건 기분 탓이겠지.']]); },
    // ---- 피아노 방 ----
    piano: async () => {
      if (ST.F.pianoSolved) return say([[null, '피아노 뚜껑 속 비밀 칸은 비어 있다.']]);
      const okd = await pianoPuzzle();
      if (!okd) return;
      ST.F.pianoSolved = 1; ost('piano', 'piano').open = true; loadRoom('piano'); sfx('unlock');
      give('stairKey');
      await say([[null, '마지막 음을 누르자, 피아노 덮개 안쪽에서 딸깍 소리가 났다.'], [null, '비밀 칸 안에서 「계단」 꼬리표가 달린 열쇠를 찾았다!']]);
    },
    pianoPortrait: async () => say([[null, '소녀의 초상화. 아래에 작은 글씨: 「노래를 좋아하던 우리 첫째」']]),
    // ---- 2층 ----
    hatch: async () => {
      if (ST.F.hatchOpen) return goRoom('attic', 'hole');   // the ladder is down: looking up at the hatch means climbing
      if (has('hook')) { take('hook'); ST.F.hatchOpen = 1; ost('corridor2', 'hatch').open = true; sfx('creak'); loadRoom('corridor2'); return say([[null, '갈고리 막대로 천장 문을 당겼다. 접이식 사다리가 덜컹 내려왔다.'], [null, '다락방으로 올라갈 수 있다.']]); }
      return say([[null, '천장에 작은 문이 있다. 손이 닿지 않는다.'], [null, '긴 막대 같은 게 있으면 당길 수 있을 텐데.']]);
    },
    photo2f: async () => say([[null, '가족사진. 아버지와 세 아이. 아이들은 웃고 있지만, 아버지는 웃지 않는다.']]),
    childBed: async () => say([[null, '작은 침대. 베개 밑에 그림 일기장이 있다. 「아빠가 약을 먹으면 안 아프대. 근데 무서워.」']]),
    dollhouse: async () => say([[null, '인형의 집. 2층 창문에 작은 인형이… 이쪽을 보고 있다.'], [null, '아까는 분명 뒤를 보고 있었던 것 같은데.']]),
    horse: async () => say([[null, '흔들목마. 손을 대지도 않았는데 천천히 흔들린다.']]),
    birthdayDrawing: async () => { ST.F.sawBirthday = 1; return say([[null, '크레파스 그림. 케이크 위에 촛불이 꽂혀 있다.'], [null, '「막내 생일 ― 3월 14일 🎂」']]); },
    scaryDrawing: async () => say([[null, '같은 아이가 그린 그림. 크고 파란 사람이 아이들을 내려다보고 있다.'], [null, '그 아래: 「아빠」']]),
    musicbox: async () => { sfx('box'); for (const [n, d] of [['솔', 0], ['미', 400], ['미', 800], ['파', 1200], ['레', 1600], ['레', 2000]]) setTimeout(() => pianoNote(n), d); return say([[null, '오르골을 열자 느린 자장가가 흘러나왔다.']]); },
    bigBed: async () => say([[null, '큰 침대. 이불이 사람 모양으로 불룩하다…'], [null, '…들춰 보니 베개였다. 휴.']]),
    diary2: async () => { if (!has('diary2')) give('diary2', true); await say([[null, '협탁 위에 또 한 장의 일기.']]); await showNote('diary2'); },
    vanity: async () => say([[null, '금 간 화장대 거울. 금 사이로 비친 내 모습이 조각조각 다르게 움직인다.']]),
    fireplace: async () => say([[null, '차갑게 식은 벽난로. 재 속에 타다 만 사진 조각이 있다. 아이 셋…']]),
    // ---- 연구실 ----
    jars: async () => say([[null, '병마다 탁한 액체. 이름표에 숫자만 적혀 있다. 38… 39… 40…']]),
    chalk: async () => say([[null, '칠판 가득 알 수 없는 수식. 맨 아래에 크게: 「눈을 감지 않는 자는 죽지 않는다」']]),
    labNotes: async () => { if (!has('labNotes')) give('labNotes', true); await say([[null, '실험 일지가 펼쳐져 있다.']]); await showNote('labNotes'); },
    labtable: async () => say([[null, '실험대. 깨진 시험관에서 파란 얼룩이 번져 있다.']]),
    safe: async () => {
      if (ST.F.safeOpen) return say([[null, '빈 금고.']]);
      const hint = ST.F.sawBirthday ? '네 자리 숫자. 「막내가 태어난 날」…?' : '네 자리 숫자 자물쇠가 달린 금고.';
      const okd = await dialPuzzle('🔒 금고', hint, '0314');
      if (!okd) return;
      ST.F.safeOpen = 1; ost('study', 'safe').open = true; loadRoom('study'); sfx('unlock'); give('hook');
      await say([[null, '철컥— 금고가 열렸다! 안에는 끝이 구부러진 긴 쇠막대가 있다.']]);
      // and then something grins at the door
      await wait(300); sfx('creak');
      await say([[null, '…문 쪽에서 낄낄거리는 소리가 들린다.']]);
      startChase('grin', 6 * TS + 8, 7 * TS + 10, 34, { onEnd: () => { ST.F.chase2Done = 1; ST.F.cheolGone = 1; npcGone('철수'); npcAt('철수', 'jail', 7, 3, 'down'); note('철수가 있던 옷장이 비어 있다…'); } });
      note('도망쳐요!');
    },
    // ---- 다락방 ----
    trunk: async () => {
      if (ST.F.gotBasementKey) return say([[null, '빈 트렁크.']]);
      ST.F.gotBasementKey = 1; ost('attic', 'trunk').open = true; loadRoom('attic'); give('basementKey');
      return say([[null, '트렁크 안, 아이 옷가지 밑에서 무거운 열쇠를 찾았다.'], [null, '손잡이에 쇠사슬 무늬. 지하실 열쇠다!']]);
    },
    oldTrunk: async () => say([[null, '낡은 드레스와 작은 구두. 모두 아이 것이다.']]),
    rocker: async () => say([[null, '흔들의자가 혼자 흔들리고 있다. 삐걱… 삐걱…']]),
    oldPhoto: async () => { if (!has('photo')) give('photo', true); await say([[null, '바닥에 떨어진 오래된 사진.']]); await showNote('photo'); },
    atticHole: async () => goRoom('corridor2', 'ladder'),
    stairsDown: async () => goRoom('hall', 'stairs'),
    // ---- 지하 ----
    b1Up: async () => goRoom('corridor1', 'E'),
    storeShelf: async () => say([[null, '선반 가득 빈 병과 녹슨 공구. 쓸 만한 건 없다.']]),
    cellBars: async ctx => {
      const c = ctx.o.cell, who = c === 0 ? '훈이' : c === 1 ? '철수' : '유리';
      const n = ST.npc[who];
      if (ST.F.freed) return say([[null, '열린 감옥.']]);
      if (n.room === 'jail') {
        const L = { 훈이: [['훈이', ME() + '!! 살았다… 아니 아직 안 살았구나. 여기서 꺼내 줘!'], ['훈이', '레버! 저기 레버로 철창이 열리는 것 같아!']],
          철수: [['철수', '미안… 내가 먼저 도망쳤어. 그거, 옷장 문을 그냥 열더라.'], ['철수', '간수 책상에 뭔가 있을 거야.']],
          유리: [['유리', '괜찮아… 다친 데는 없어. 레버 순서는 그 사진 뒤에 있었을 거야.']] }[who];
        return say(L);
      }
      return say([[null, '빈 감옥. 벽에 수없이 긁힌 자국.']]);
    },
    guardDesk: async () => {
      if (!has('guardNote')) give('guardNote', true);
      if (!ST.F.gotHandle) { ST.F.gotHandle = 1; give('handle'); ost('jail', 'gdesk').empty = true; loadRoom('jail'); await say([[null, '책상 서랍에서 녹슨 핸들을 찾았다!']]); }
      return showNote('guardNote');
    },
    levers: async () => {
      if (ST.F.freed) return say([[null, '레버는 이제 꿈쩍도 하지 않는다.']]);
      const okd = await leverPuzzle('201');
      if (!okd) return;
      sfx('slam'); shake = 8; ST.F.freed = 1;
      loadRoom('jail');
      const here = ['훈이', '철수', '유리'].filter(n => ST.npc[n].room === 'jail');
      await say([[null, '철커덩—! 세 개의 철창 문이 한꺼번에 열렸다!'], ['훈이', '나왔다아…! 진짜 나왔다!'], ['철수', '여기서 나가자. 창고 쪽에 철문 있었어. 통로 같아.'], ['유리', '다 같이 붙어서 가자.']].filter(l => !l[0] || here.includes(l[0]) || l[0] === null));
      for (const n of here) { ST.npc[n].follow = true; ST.npc[n].room = 'jail'; ST.npc[n].x = pl.x; ST.npc[n].y = pl.y; }
      note('친구들이 따라옵니다!');
    },
    ironDoor: async () => {
      if (has('handle')) { take('handle'); ST.F.tunnelOpen = 1; sfx('unlock'); sfx('creak'); return say([[null, '녹슨 핸들을 끼우고 힘껏 돌렸다. 끼기기긱— 철문이 열렸다.']]); }
      sfx('locked'); return say([[null, '육중한 철문. 손잡이가 빠져 있다. 끼울 핸들이 있으면 열 수 있을 것 같다.']]);
    },
    exit: async () => {
      const friends = ['훈이', '철수', '유리'].filter(n => ST.npc[n].follow);
      if (friends.length < 3) {
        const c = await choose('친구들을 두고… 혼자 나갈까?', ['혼자 나간다', '아직 안 돼']);
        if (c !== 0) return;
        return ending(false);
      }
      return ending(true);
    }
  };
  // in a cell, or following you: the same few lines whoever it is
  async function talkCommon(name) {
    const n = ST.npc[name];
    if (n.room === 'jail' && !ST.F.freed) { await SCRIPT.cellBars({ o: { cell: name === '훈이' ? 0 : name === '철수' ? 1 : 2 } }); return true; }
    if (n.follow) { await say([[name, pick({ 훈이: ['나 진짜 다시는 너 말 안 들을 거야…', '뛰어! 뛰라고!', '배고프다… 아니 지금 그게 문제가 아니지.'], 철수: ['뒤는 내가 볼게. 앞만 봐.', '사다리… 출구가 있을 거야.', '미안하다, 아까 먼저 도망쳐서.'], 유리: ['붙어 다니자. 절대 혼자 가지 마.', '지하에서 나는 소리… 사람 목소리 같아.', '괜찮아. 거의 다 왔어.'] }[name])]]); return true; }
    return false;
  }
  async function hideOrLook(o, text) {
    const c = await choose(text, ['숨는다', '그만둔다']);
    if (c === 0) await enterHide(o);
  }
  async function ending(good) {
    busy += 100; mon = null; chaseMusic(false);
    await fade(1, 900);
    const secs = Math.round(ST.t + (now() - playStart) / 1000), mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0');
    try { const e = JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); e[good ? 'good' : 'alone'] = Math.min(e[good ? 'good' : 'alone'] || 1e9, secs); localStorage.setItem(DONE_KEY, JSON.stringify(e)); } catch (e) {}
    clearSave(); ST.ended = 1;
    const p = panel('hr-end ' + (good ? 'good' : 'bad'));
    if (good) {
      p.append(el('p', 'hr-endsub', '사다리 끝, 맨홀 뚜껑을 밀어 올리자 차가운 새벽 공기가 쏟아졌다.'),
        el('p', 'hr-line', '훈이: 나 다시는 이런 데 안 와. 진짜로.'),
        el('p', 'hr-line', '철수: …근데 솔직히 좀 재밌지 않았냐?'),
        el('p', 'hr-line', '유리: 다음엔 사진만 찍고 가자. 약속해.'),
        el('h2', '', '— 넷이 함께 맞이한 새벽 —'), el('p', 'hr-endtag', '진엔딩 · ' + mm + '분 ' + ss + '초'));
    } else {
      p.append(el('p', 'hr-endsub', '숲을 빠져나와 뒤를 돌아보았다.'),
        el('p', 'hr-line', '저택의 모든 창문에서, 무언가가 나를 보고 있었다.'),
        el('p', 'hr-line', '…친구들은 아직 저 안에 있다.'),
        el('h2', '', '— 혼자 남은 새벽 —'), el('p', 'hr-endtag', '엔딩 B · ' + mm + '분 ' + ss + '초 · 친구들을 모두 구하면 다른 결말을 볼 수 있어요'));
    }
    const b = el('button', 'btn btn-gold', '저택 밖으로'); b.type = 'button'; b.addEventListener('click', () => { busy = 0; close(); }); p.appendChild(b);
  }
  // ================= the window =================
  function build() {
    root = document.getElementById('horror'); root.innerHTML = '';
    const card = el('div', 'hr-card');
    const head = el('div', 'hr-head');
    head.appendChild(el('h2', '', '🏚️ 숲속의 저택'));
    const btns = el('div', 'hr-btns');
    const bag = el('button', 'btn', '🎒 가방'); bag.type = 'button'; bag.addEventListener('click', () => { if (!busy) openBag(); });
    const out = el('button', 'btn', '나가기'); out.type = 'button';
    out.addEventListener('click', async () => {
      if (busy > 50) return;
      const c = await choose('저택에서 나갈까요? 진행 상황은 마지막 저장 지점에 남아요.', ['나가기', '계속하기']);
      if (c === 0) close();
    });
    btns.append(bag, out); head.appendChild(btns); card.appendChild(head);
    const stage = el('div', 'hr-stage');
    cv = el('canvas', 'hr-cv'); cv.width = VW; cv.height = VH; g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    dk = document.createElement('canvas'); dk.width = VW; dk.height = VH; dkg = dk.getContext('2d');
    stage.appendChild(cv);
    const dlgB = el('div', 'hr-dlg'); dlgB.hidden = true;
    const nm = el('b', 'hr-name'), tx = el('p', 'hr-text'), nx = el('span', 'hr-more', '▼');
    dlgB.append(nm, tx, nx); stage.appendChild(dlgB);
    dlgB.addEventListener('click', () => dlgNext());
    const nt = el('div', 'hr-note'); nt.hidden = true; stage.appendChild(nt);
    card.appendChild(stage);
    // the touch pad
    const pad = el('div', 'hr-pad');
    const dp = el('div', 'hr-dpad');
    for (const [d, sym] of [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']]) {
      const b = el('button', 'hr-k hr-' + d, sym); b.type = 'button'; b.setAttribute('aria-label', d);
      const set = v => ev => { ev.preventDefault(); touch[d] = v; };
      b.addEventListener('pointerdown', set(1)); b.addEventListener('pointerup', set(0)); b.addEventListener('pointerleave', set(0)); b.addEventListener('pointercancel', set(0));
      dp.appendChild(b);
    }
    const act = el('button', 'hr-k hr-act', '확인'); act.type = 'button';
    act.addEventListener('pointerdown', ev => { ev.preventDefault(); ac(); if (dlgNext()) return; actQ = true; });
    pad.append(dp, act);
    card.appendChild(pad);
    card.appendChild(el('p', 'hr-tip', '방향키·WASD 이동 · 스페이스/엔터 살펴보기·대화 넘기기 · X 가방 · 숨은 곳에서 확인을 누르면 나와요'));
    root.appendChild(card);
    ui = { dlg: dlgB, dlgName: nm, dlgText: tx, note: nt, stage, panel: null };
  }
  function onKey(e) {
    if (!open_ || !root || root.hidden) return;
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (typing) return;
    const c = e.code, down = e.type === 'keydown';
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(c)) {
      e.preventDefault(); keys[c] = down;
      if (down) { order = order.filter(x => x !== c); order.push(c); }
      return;
    }
    if (!down) return;
    if (c === 'Space' || c === 'Enter' || c === 'KeyZ' || c === 'NumpadEnter') {
      if (ui.panel && document.activeElement && document.activeElement.tagName === 'BUTTON' && ui.panel.contains(document.activeElement)) return;   // let the focused button take it
      e.preventDefault(); ac();
      if (e.repeat) return;
      if (dlgNext()) return;
      if (!ui.panel) actQ = true;
      return;
    }
    if (c === 'KeyX' || c === 'KeyI' || c === 'Tab') { e.preventDefault(); if (ui.panel && ui.panel._close) ui.panel._close(); else if (!busy) bagQ = true; return; }
    if (c === 'Escape') { e.preventDefault(); if (ui.panel && ui.panel._close) ui.panel._close(); return; }
  }
  function fit() {
    if (!cv || !root || root.hidden) return;
    const stage = ui.stage; if (!stage) return;
    const W = stage.clientWidth, H = stage.clientHeight || W * 0.75;
    const k = Math.max(1, Math.min(W / VW, H / VH));
    cv.style.width = Math.floor(VW * k) + 'px'; cv.style.height = Math.floor(VH * k) + 'px';
  }
  async function openStory(opt) {
    if (!need()) { console.error('ONL not ready'); return; }
    opt = opt || {};
    loadMon();
    onQuit = opt.onQuit || null;
    build(); root.hidden = false; open_ = true;
    let saved = null;
    if (opt.resume) { try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {} }
    ST = saved && saved.v === 1 ? saved : fresh();
    playStart = now(); busy = 0; mon = null; chaseCount = 0; fadeA = 0; redFlash = 0;
    for (const k in keys) keys[k] = false; order = []; for (const d in touch) touch[d] = 0;
    loadRoom(ST.room); pl.x = ST.x; pl.y = ST.y; pl.dir = ST.dir || 'up'; pl.hidden = null; pl.trail = [];
    for (const n of Object.values(ST.npc)) if (n.follow) { n.room = ST.room; n.x = pl.x; n.y = pl.y; }
    camSnap(); snapshot();
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true); window.addEventListener('resize', fit);
    cancelAnimationFrame(raf); lastT = now(); raf = requestAnimationFrame(frame);
    requestAnimationFrame(fit); setTimeout(fit, 120);
    bgm(true);
    if (!ST.F.intro) intro();
    else note(`${ROOMS[ST.room].name} · 이어서 시작해요`);
  }
  function close() {
    if (!open_) return;
    if (ST && !ST.ended && !(mon && !mon.gone) && checkpoint) { try { const c = JSON.parse(JSON.stringify(checkpoint)); c.t = ST.t + (now() - playStart) / 1000; if (ST.F.intro) localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch (e) {} }
    else if (ST && mon && checkpoint) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(checkpoint)); } catch (e) {} }
    open_ = false; cancelAnimationFrame(raf); raf = 0; chaseMusic(false); mon = null; bgm(false);
    window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('resize', fit);
    clearInterval(dlg.timer); dlg.on = false;
    if (root) { root.hidden = true; root.innerHTML = ''; }
    const cb = onQuit; onQuit = null; if (cb) cb();
  }
  loadMon();
  const api = {
    openStory, close, isOpen: () => open_, hasSave, clearSave,
    // drawing, sound and collision pieces the tag game (hunt.js) shares
    kit: { TS, T, FLOORS, WALLS, paintRoom, objRect, solidOf, overlap, walkGrid, bfs, darkness, drawMon, drawPerson, loadMon, MON, MON_INFO, sfx, chaseMusic, ac, setSound, AU, tileAt, isDoorCh, P, seeded, el }
  };
  if (/[?&]debug\b/.test(location.search)) api._dbg = () => ({ get ST() { return ST; }, get pl() { return pl; }, get mon() { return mon; }, get room() { return roomId; }, get busy() { return busy; }, set busy(v) { busy = v; }, goRoom, run, give, loadRoom, startChase, SCRIPT, ROOMS, dlgNext, interact, get panel() { return ui.panel; }, get objs() { return objs; }, get checkpoint() { return checkpoint; } });
  return api;
})();
