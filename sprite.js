// ON-Lounge character sprites: small chunky RPG-style pixel people.
// Layers (back to front): back hair, legs/shoes, bottom, top + arms, head + eyes, front hair.
// Face and skin are the same for everyone (eyes only, warm Asian skin tone); people differ by hair and clothes.
(function (root) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f >= 1) { const t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
    else { r *= f; g *= f; b *= f; }
    const c = v => clamp(Math.round(v), 0, 255);
    return '#' + ((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1);
  }

  // ---------------- options ----------------
  const HAIRS = [
    { id: 'buzz', label: '반삭', g: 'm', p: { top: 'buzz', fringe: 'line', len: 5 } },
    { id: 'crop', label: '짧은 머리', g: 'm', p: { fringe: 'short', len: 5 } },
    { id: 'twoblock', label: '투블럭', g: 'm', p: { fringe: 'full', len: 5, shaved: true } },
    { id: 'dandy', label: '댄디컷', g: 'm', p: { fringe: 'full', len: 7 } },
    { id: 'part', label: '가르마', g: 'm', p: { fringe: 'center', len: 7 } },
    { id: 'comma', label: '쉼표머리', g: 'm', p: { fringe: 'comma', len: 6 } },
    { id: 'slick', label: '올백', g: 'm', p: { fringe: 'none', len: 6, top: 'flat' } },
    { id: 'spiky', label: '뾰족머리', g: 'm', p: { fringe: 'spiky', len: 6, top: 'spiky' } },
    { id: 'curly', label: '곱슬펌', g: 'm', p: { fringe: 'curly', len: 7, top: 'curly' } },
    { id: 'mlong', label: '남자 장발', g: 'm', p: { fringe: 'center', len: 10 } },
    { id: 'pixie', label: '숏컷', g: 'f', p: { fringe: 'side', len: 8 } },
    { id: 'bob', label: '단발', g: 'f', p: { fringe: 'full', len: 10 } },
    { id: 'medium', label: '중단발', g: 'f', p: { fringe: 'side', len: 12 } },
    { id: 'long', label: '긴 생머리', g: 'f', p: { fringe: 'center', len: 16 } },
    { id: 'banglong', label: '앞머리 긴머리', g: 'f', p: { fringe: 'full', len: 16 } },
    { id: 'wave', label: '웨이브', g: 'f', p: { fringe: 'side', len: 15, wave: true, top: 'puffy' } },
    { id: 'pony', label: '포니테일', g: 'f', p: { fringe: 'side', len: 7, extra: 'pony' } },
    { id: 'twin', label: '양갈래', g: 'f', p: { fringe: 'full', len: 7, extra: 'twin' } },
    { id: 'bun', label: '똥머리', g: 'f', p: { fringe: 'side', len: 7, extra: 'bun' } },
    { id: 'half', label: '반묶음', g: 'f', p: { fringe: 'center', len: 13, extra: 'half' } }
  ];
  const HAIR_COLORS = [
    { c: '#231a20', n: '흑발' }, { c: '#3a2a24', n: '자연 갈흑' }, { c: '#553728', n: '진갈색' }, { c: '#7a4e30', n: '갈색' },
    { c: '#a36c43', n: '밝은 갈색' }, { c: '#7d6b5e', n: '애쉬 브라운' }, { c: '#c9a37b', n: '밀크티' }, { c: '#e3c37c', n: '금발' },
    { c: '#efe6cc', n: '백금' }, { c: '#9ba1ab', n: '애쉬 그레이' }, { c: '#e693a8', n: '핑크' }, { c: '#7d3141', n: '와인' },
    { c: '#d9783b', n: '오렌지' }, { c: '#3f5f9e', n: '블루' }, { c: '#6a4f9e', n: '보라' }, { c: '#5fae9b', n: '민트' }
  ];
  const TOPS = [
    { id: 'tee', label: '반팔티' }, { id: 'longtee', label: '긴팔티' }, { id: 'stripe', label: '줄무늬티' }, { id: 'polo', label: '카라티' },
    { id: 'shirt', label: '셔츠' }, { id: 'hood', label: '후드티' }, { id: 'mtm', label: '맨투맨' }, { id: 'knit', label: '니트' },
    { id: 'cardigan', label: '가디건' }, { id: 'jacket', label: '자켓' }, { id: 'coat', label: '코트' }, { id: 'padding', label: '패딩' }
  ];
  const TOP_COLORS = [
    { c: '#f3f0e9', n: '흰색' }, { c: '#e8dcc2', n: '아이보리' }, { c: '#c6c9cf', n: '연회색' }, { c: '#868b95', n: '회색' },
    { c: '#4a4c56', n: '차콜' }, { c: '#27262c', n: '검정' }, { c: '#2f416b', n: '남색' }, { c: '#4f7ec4', n: '파랑' },
    { c: '#9cc6e8', n: '하늘' }, { c: '#9dd6c1', n: '민트' }, { c: '#5f8a55', n: '초록' }, { c: '#8a8456', n: '카키' },
    { c: '#f0cc55', n: '노랑' }, { c: '#e8894a', n: '주황' }, { c: '#c94a45', n: '빨강' }, { c: '#f0a9bb', n: '분홍' },
    { c: '#b8a6dc', n: '라벤더' }, { c: '#7a5238', n: '갈색' }
  ];
  const BOTTOMS = [
    { id: 'jeans', label: '긴바지' }, { id: 'slacks', label: '슬랙스' }, { id: 'wide', label: '와이드 팬츠' }, { id: 'jogger', label: '조거 팬츠' },
    { id: 'shorts', label: '반바지' }, { id: 'skirt', label: '치마' }, { id: 'longskirt', label: '롱스커트' }
  ];
  const BOTTOM_COLORS = [
    { c: '#9dbbe0', n: '연청' }, { c: '#5c84bd', n: '중청' }, { c: '#2f4a7a', n: '진청' }, { c: '#34394b', n: '흑청' },
    { c: '#26242b', n: '검정' }, { c: '#ece9e1', n: '흰색' }, { c: '#868990', n: '회색' }, { c: '#4a4c55', n: '차콜' },
    { c: '#d8c3a0', n: '베이지' }, { c: '#8a8456', n: '카키' }, { c: '#6e4a33', n: '갈색' }, { c: '#2f3d63', n: '남색' },
    { c: '#6e2f3d', n: '와인' }, { c: '#e8a6b6', n: '분홍' }
  ];
  const SKIN = '#f5cda6', SKIN_D = '#e0a97f', EYE = '#2a1d2b', OUT = '#21181f', SHOE = '#2b2430', SHOE_L = '#4a3f4d';
  const DEFAULT_LOOK = { hair: 'dandy', hairColor: '#3a2a24', top: 'hood', topColor: '#868b95', bottom: 'jeans', bottomColor: '#5c84bd' };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function randomLook() {
    return { hair: pick(HAIRS).id, hairColor: pick(HAIR_COLORS.slice(0, 8)).c, top: pick(TOPS).id, topColor: pick(TOP_COLORS).c, bottom: pick(BOTTOMS).id, bottomColor: pick(BOTTOM_COLORS).c };
  }
  function validLook(l) {
    if (!l || typeof l !== 'object') return null;
    const ok = HAIRS.some(h => h.id === l.hair) && HAIR_COLORS.some(x => x.c === l.hairColor) && TOPS.some(t => t.id === l.top) &&
      TOP_COLORS.some(x => x.c === l.topColor) && BOTTOMS.some(b => b.id === l.bottom) && BOTTOM_COLORS.some(x => x.c === l.bottomColor);
    return ok ? { hair: l.hair, hairColor: l.hairColor, top: l.top, topColor: l.topColor, bottom: l.bottom, bottomColor: l.bottomColor } : null;
  }

  // ---------------- sprite builder ----------------
  // drawing coords: x 0..15, y -3..19 (feet on y 18). Grid adds a 1px outline margin.
  const SW = 18, SH = 25, OX = 1, OY = 4;
  const cache = new Map();

  function sprite(look, dir, legs, arms, frame) {
    const key = [look.hair, look.hairColor, look.top, look.topColor, look.bottom, look.bottomColor, dir, legs, arms, frame].join('|');
    const hit = cache.get(key); if (hit) return hit;
    const view = dir === 'left' || dir === 'right' ? 'side' : dir;
    let g = Array.from({ length: SH }, () => Array(SW).fill(null));
    const set = (x, y, c) => { x += OX; y += OY; if (x >= 0 && x < SW && y >= 0 && y < SH) g[y][x] = c; };
    const get = (x, y) => { x += OX; y += OY; return x >= 0 && x < SW && y >= 0 && y < SH ? g[y][x] : null; };
    const r = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    const pts = (a, c) => a.forEach(([x, y]) => set(x, y, c));

    const hp = (HAIRS.find(h => h.id === look.hair) || HAIRS[0]).p;
    const H = look.hairColor, HL = shade(H, H === '#231a20' || H === '#3a2a24' ? 1.35 : 1.22), HD = shade(H, 0.7);
    const T = look.topColor, TD = shade(T, 0.78), TL = shade(T, 1.14), TDD = shade(T, 0.62);
    const B = look.bottomColor, BD = shade(B, 0.78), BL = shade(B, 1.12);
    const top = look.top, bot = look.bottom;
    const shortSleeve = top === 'tee' || top === 'polo' || top === 'stripe';
    const longTop = top === 'coat';
    const skirt = bot === 'skirt' || bot === 'longskirt';
    const sit = legs === 'sit';
    const wf = legs === 'walk' ? frame : 0;
    const len = hp.len;

    // ---- back hair (behind everything) ----
    if (view === 'down') {
      if (len >= 10) { const bl = hp.wave ? len : len; r(3, 9, 10, bl - 8, H); for (let y = 9; y <= bl; y++) { set(3, y, HD); set(12, y, HD); } }
      if (hp.extra === 'pony') { r(13, 4, 2, 6, H); set(14, 9, HD); set(13, 10, HD); }
    } else if (view === 'up') {
      // drawn after body (covers back), see below
    } else {
      if (hp.extra === 'pony') { r(1, 3, 3, 3, H); r(1, 6, 2, 5, H); set(1, 11, HD); set(2, 4, HL); }
    }

    // ---- legs / shoes ----
    if (!sit) {
      if (view !== 'side') {
        const L1 = wf === 1, R1 = wf === 2;
        const legC = (bot === 'shorts' || bot === 'skirt') ? SKIN : B;
        const leg = (x, lift) => {
          if (lift) { r(x, 16, 2, 1, legC); r(x - (x < 8 ? 1 : 0), 17, 3, 1, SHOE); }
          else { r(x, 16, 2, 2, legC); r(x - (x < 8 ? 1 : 0), 18, 3, 1, SHOE); set(x - (x < 8 ? 1 : 0) + (x < 8 ? 0 : 2), 18, SHOE_L); }
        };
        leg(5, L1); leg(9, R1);
        if (bot === 'wide') { r(4, 16, 3, L1 ? 1 : 2, B); r(9, 16, 3, R1 ? 1 : 2, B); }
        if (bot === 'jogger') { if (!L1) r(5, 17, 2, 1, BD); if (!R1) r(9, 17, 2, 1, BD); }
        if (bot === 'jeans' || bot === 'slacks') { if (!L1) set(5, 17, bot === 'slacks' ? BL : BD); if (!R1) set(10, 17, bot === 'slacks' ? BL : BD); }
      } else {
        const legC = (bot === 'shorts' || bot === 'skirt') ? SKIN : B;
        if (wf) { r(5, 16, 2, 2, legC); r(9, 16, 2, 2, legC); r(4, 18, 3, 1, SHOE); r(9, 18, 3, 1, SHOE); set(6, 16, wf === 1 ? BD : legC); }
        else { r(7, 16, 2, 2, legC); r(7, 18, 4, 1, SHOE); set(10, 18, SHOE_L); }
        if (bot === 'wide' && !wf) r(6, 16, 3, 2, B);
      }
    }

    // ---- bottom garment (hips) ----
    const hipW = view === 'side' ? [6, 4] : [4, 8];
    if (!sit || true) {
      r(hipW[0], 15, hipW[1], 1, B); set(hipW[0] + hipW[1] - 1, 15, BD);
      if (bot === 'shorts' && !sit) { if (view !== 'side') { r(4, 16, 3, 1, B); r(9, 16, 3, 1, B); } else r(6, 16, 4, 1, B); }
      if (bot === 'skirt' && !sit) { if (view !== 'side') { r(3, 16, 10, 1, B); set(3, 16, BD); set(12, 16, BD); pts([[5, 16], [8, 16], [11, 16]], BD); } else r(5, 16, 6, 1, B); }
      if (bot === 'longskirt' && !sit) {
        if (view !== 'side') { r(3, 16, 10, 2, B); pts([[5, 16], [5, 17], [8, 16], [8, 17], [11, 16], [11, 17]], BD); r(4, 18, 3, 1, SHOE); r(9, 18, 3, 1, SHOE); }
        else { r(5, 16, 6, 2, B); set(6, 17, BD); }
      }
      if (bot === 'slacks' && view !== 'side') { set(6, 15, BL); set(9, 15, BL); }
      if (view !== 'side' && !skirt) { set(7, 15, BD); set(8, 15, BD); }
    }

    // ---- torso ----
    const tx = view === 'side' ? 5 : 4, tw = view === 'side' ? 6 : 8;
    const tBottom = longTop ? 16 : 14;
    r(tx, 10, tw, tBottom - 9, T);
    r(tx, tBottom, tw, 1, TD); set(tx + tw - 1, 11, TD); set(tx + tw - 1, 12, TD); set(tx + tw - 1, 13, TD);
    if (top === 'padding') { r(tx - 1, 10, tw + 2, 5, T); for (const y of [11, 13]) r(tx - 1, y, tw + 2, 1, TD); r(tx - 1, 14, tw + 2, 1, TD); }
    if (view === 'down') {
      set(7, 10, TL); set(8, 10, TL); set(5, 11, TL);
      if (top === 'tee' || top === 'longtee' || top === 'stripe') { set(7, 10, SKIN); set(8, 10, SKIN); }
      if (top === 'stripe') { const sc = shade(T, T === '#f3f0e9' ? 0.55 : 1.55); r(4, 11, 8, 1, sc); r(4, 13, 8, 1, sc); }
      if (top === 'polo') { pts([[6, 10], [9, 10]], '#f6f3ec'); set(7, 10, SKIN); set(8, 10, SKIN); set(7, 11, TD); set(7, 12, TD); }
      if (top === 'shirt') { pts([[6, 10], [9, 10]], TL); set(7, 10, SKIN); set(8, 10, TD); for (const y of [11, 12, 13]) set(7, y, y % 2 ? TD : TL); }
      if (top === 'hood') { r(4, 10, 8, 1, TD); set(7, 10, TDD); set(8, 10, TDD); pts([[6, 11], [9, 11], [6, 12], [9, 12]], '#f2eee4'); r(5, 13, 6, 1, TD); }
      if (top === 'mtm') { set(7, 10, TD); set(8, 10, TD); r(4, 14, 8, 1, TDD); }
      if (top === 'knit') { for (let y = 11; y <= 13; y++) for (let x = 4; x <= 11; x++) if ((x + y) % 2 === 0) set(x, y, TD); r(4, 14, 8, 1, TDD); set(7, 10, TD); set(8, 10, TD); }
      if (top === 'cardigan') { r(7, 10, 2, 5, '#f3f0e9'); set(6, 10, TD); set(9, 10, TD); for (let y = 11; y <= 13; y++) { set(6, y, TD); set(9, y, TD); } set(6, 12, '#d8c49a'); }
      if (top === 'jacket') { r(7, 10, 2, 3, '#f3f0e9'); set(7, 12, '#9aa3b5'); pts([[6, 10], [6, 11], [9, 10], [9, 11], [6, 12]], TD); r(7, 13, 2, 1, TD); set(8, 13, TDD); }
      if (top === 'coat') { pts([[6, 10], [6, 11], [9, 10], [9, 11]], TD); set(7, 10, SKIN); set(8, 10, SKIN); r(7, 11, 1, 6, TD); set(6, 13, TDD); set(6, 15, TDD); r(4, 14, 8, 1, TDD); }
      if (top === 'padding') { set(7, 10, TDD); set(8, 10, TDD); r(7, 11, 1, 4, TD); }
    } else if (view === 'up') {
      if (top === 'hood') { r(5, 10, 6, 2, TD); r(6, 10, 4, 1, TDD); }
      if (top === 'polo' || top === 'shirt' || top === 'jacket' || top === 'coat') r(5, 10, 6, 1, TD);
      if (top === 'stripe') { const sc = shade(T, T === '#f3f0e9' ? 0.55 : 1.55); r(4, 11, 8, 1, sc); r(4, 13, 8, 1, sc); }
      if (top === 'coat') r(7, 13, 2, 4, TD);
      if (top === 'mtm' || top === 'knit') r(4, 14, 8, 1, TDD);
    } else {
      if (top === 'hood') r(4, 10, 2, 3, TD);
      if (top === 'polo' || top === 'shirt') set(10, 10, '#f6f3ec');
      if (top === 'stripe') { const sc = shade(T, T === '#f3f0e9' ? 0.55 : 1.55); r(5, 11, 6, 1, sc); r(5, 13, 6, 1, sc); }
      if (top === 'jacket' || top === 'cardigan' || top === 'coat') { set(10, 10, '#f3f0e9'); set(10, 11, TD); }
    }

    // ---- arms ----
    const sleeve = (i) => shortSleeve && i > 0 ? SKIN : (top === 'padding' ? T : shade(T, 0.92));
    const arm = (list) => list.forEach(([x, y], i) => set(x, y, i === list.length - 1 ? SKIN : sleeve(i)));
    if (view === 'side') {
      if (arms === 'wave') { const hx = frame % 2 ? 9 : 8; arm([[hx, 11], [hx, 10], [hx, 9], [hx, 8]]); }
      else if (arms === 'none') { const ax = legs === 'walk' ? (wf === 1 ? 8 : wf === 2 ? 6 : 7) : 7; arm([[ax, 10], [ax, 11], [ax, 12], [ax, 13], [ax, 14]]); set(ax + 1, 11, shade(T, 0.85)); }
      else { const yy = (arms === 'play' || arms === 'clap') && frame % 2 ? 13 : 12; arm([[8, yy - 1], [9, yy], [10, yy], [11, yy]]); }
    } else {
      const L = [[3, 10], [3, 11], [3, 12], [3, 13], [3, 14]], R = [[12, 10], [12, 11], [12, 12], [12, 13], [12, 14]];
      if (top === 'padding') { L.forEach(p => p[0]--); R.forEach(p => p[0]++); }
      const back = view === 'up';
      if (arms === 'wave') { arm(L); arm(frame % 2 ? [[12, 10], [13, 9], [14, 8], [14, 7]] : [[12, 10], [13, 9], [13, 8], [13, 7]]); }
      else if (arms === 'clap') {
        if (back || !(frame % 2)) { arm([[3, 10], [3, 11], [3, 12], [4, 13]]); arm([[12, 10], [12, 11], [12, 12], [11, 13]]); }
        else { arm([[3, 10], [4, 11], [5, 12], [6, 12], [7, 12]]); arm([[12, 10], [11, 11], [10, 12], [9, 12], [8, 12]]); }
      } else if (arms === 'pray') {
        if (back) { arm([[3, 10], [3, 11], [3, 12], [3, 13]]); arm([[12, 10], [12, 11], [12, 12], [12, 13]]); }
        else { arm([[3, 10], [4, 11], [5, 12], [6, 12]]); arm([[12, 10], [11, 11], [10, 12], [9, 12]]); r(7, 11, 2, 2, SKIN); }
      } else if (arms === 'play') {
        arm(frame % 2 ? [[3, 10], [3, 11], [4, 12]] : [[3, 10], [3, 11], [3, 12], [3, 13]]);
        arm(frame % 2 ? [[12, 10], [12, 11], [12, 12], [12, 13]] : [[12, 10], [12, 11], [11, 12]]);
      } else { arm(L); arm(R); }
    }

    // ---- head (same for everyone: skin + eyes only) ----
    const closed = arms === 'pray';
    if (view === 'down') {
      r(4, 3, 8, 6, SKIN); r(5, 9, 6, 1, SKIN); set(4, 8, SKIN_D); set(11, 8, SKIN_D); r(6, 9, 4, 1, SKIN);
      if (closed) { r(5, 7, 2, 1, EYE); r(9, 7, 2, 1, EYE); }
      else { r(6, 6, 1, 2, EYE); r(9, 6, 1, 2, EYE); }
    } else if (view === 'side') {
      r(5, 3, 8, 6, SKIN); r(6, 9, 6, 1, SKIN); set(13, 7, SKIN); set(12, 8, SKIN_D);
      if (closed) r(10, 7, 2, 1, EYE); else r(11, 6, 1, 2, EYE);
    } else {
      r(4, 3, 8, 6, SKIN); r(5, 9, 6, 1, SKIN);
    }

    // ---- hair ----
    const bumpy = hp.top === 'curly';
    if (view === 'down' || view === 'up') {
      // crown
      if (hp.top === 'buzz') {
        r(5, 1, 6, 1, H); r(4, 2, 8, 1, H); r(3, 3, 1, 2, H); r(12, 3, 1, 2, H); set(6, 1, HL); set(7, 1, HL);
      } else {
        const puff = hp.top === 'puffy' || bumpy;
        r(5, puff ? -1 : 0, 6, 1, H); r(4, puff ? 0 : 1, 8, puff ? 2 : 1, H); r(3, 2, 10, 1, H); r(3, 3, 10, 1, H);
        if (puff) { r(3, 1, 10, 1, H); }
        set(6, puff ? -1 : 0, HL); set(5, puff ? 0 : 1, HL); set(6, puff ? 0 : 1, HL);
        if (hp.top === 'flat') { r(4, 0, 8, 1, H); set(5, 0, HL); set(6, 0, HL); set(7, 0, HL); }
        if (hp.top === 'spiky') { pts([[4, -1], [6, -2], [7, -1], [9, -2], [10, -1], [12, 0], [3, 0], [5, -1], [8, -1], [11, -1]], H); pts([[6, -2], [9, -2]], HL); }
        if (bumpy) { pts([[3, 0], [12, 0], [2, 2], [13, 2], [4, -1], [7, -2], [8, -2], [11, -1]], H); pts([[7, -2], [4, -1]], HL); }
      }
      // sides (front and back views)
      if (hp.top !== 'buzz') {
        const sideLen = view === 'up' ? Math.max(len, 9) : len;
        for (let y = 3; y <= sideLen; y++) {
          const wob = hp.wave && y > 9 ? ((y >> 1) % 2) : 0;
          set(3 - wob, y, H); set(12 + wob, y, H);
          if (len >= 9 && y >= 4) { set(2 - wob, y, H); set(13 + wob, y, H); }
          if (hp.shaved && y >= 4) { set(3, y, HD); set(12, y, HD); }
        }
        if (len >= 9) { set(2, len, HD); set(13, len, HD); }
        set(3, sideLen, HD); set(12, sideLen, HD);
        if (bumpy) pts([[2, 4], [13, 4], [2, 6], [13, 6]], H);
      }
    }
    if (view === 'down') {
      const f = hp.fringe;
      if (f === 'full') { r(4, 3, 8, 2, H); pts([[4, 5], [5, 5], [7, 5], [8, 5], [10, 5], [11, 5]], H); pts([[5, 5], [8, 5], [11, 5]], HD); set(9, 3, HL); }
      else if (f === 'side') { r(4, 3, 8, 1, H); r(4, 4, 6, 1, H); r(4, 5, 3, 1, H); set(10, 4, H); set(4, 6, H); pts([[6, 5], [9, 4]], HD); set(5, 3, HL); }
      else if (f === 'center') { r(4, 3, 3, 1, H); r(9, 3, 3, 1, H); pts([[4, 4], [5, 4], [10, 4], [11, 4], [4, 5], [11, 5]], H); pts([[6, 3], [9, 3]], HD); }
      else if (f === 'comma') { r(4, 3, 8, 1, H); r(4, 4, 5, 1, H); pts([[4, 5], [5, 5], [7, 5], [4, 6]], H); set(7, 5, HD); set(8, 4, HD); }
      else if (f === 'spiky') { r(4, 3, 8, 1, H); pts([[4, 4], [5, 4], [7, 4], [8, 4], [10, 4], [11, 4], [5, 5], [8, 5], [11, 5]], H); }
      else if (f === 'short') { r(4, 3, 8, 1, H); pts([[4, 4], [6, 4], [7, 4], [9, 4], [11, 4]], H); set(7, 4, HD); }
      else if (f === 'curly') { r(4, 3, 8, 1, H); pts([[4, 4], [5, 4], [7, 4], [8, 4], [10, 4], [11, 4], [6, 5], [9, 5]], H); pts([[5, 4], [10, 4]], HD); }
      else if (f === 'line') { /* buzz hairline only */ }
      else if (f === 'none') { set(4, 3, H); set(11, 3, H); }
      if (hp.extra === 'twin') { r(1, 5, 2, 6, H); r(13, 5, 2, 6, H); set(1, 10, HD); set(14, 10, HD); set(2, 5, '#c94a5c'); set(13, 5, '#c94a5c'); }
      if (hp.extra === 'bun') { r(6, -3, 4, 3, H); set(6, -3, null); set(9, -3, null); set(7, -2, HL); }
      if (hp.extra === 'half') { set(7, 0, '#c94a5c'); }
    }
    if (view === 'up') {
      r(3, 3, 10, 7, H); r(4, 9, 8, 1, H);
      for (let y = 4; y <= 9; y++) { set(3, y, HD); set(12, y, HD); }
      set(5, 1, HL); set(6, 1, HL); set(5, 2, HL);
      if (hp.top === 'buzz') { r(4, 3, 8, 6, H); set(3, 3, H); set(12, 3, H); }
      if (len >= 10) { const bl = len; r(3, 10, 10, bl - 9, H); for (let y = 10; y <= bl; y++) { if (hp.wave && (y % 3 === 0)) { set(2, y, H); set(13, y, H); } } r(4, bl, 8, 1, HD); for (let y = 10; y < bl; y++) { set(3, y, HD); set(12, y, HD); } }
      if (hp.extra === 'pony') { r(6, 5, 4, 1, '#c94a5c'); r(6, 6, 4, 6, H); r(7, 12, 2, 2, H); set(7, 13, HD); set(8, 8, HD); }
      if (hp.extra === 'twin') { r(1, 5, 2, 6, H); r(13, 5, 2, 6, H); set(1, 10, HD); set(14, 10, HD); set(2, 5, '#c94a5c'); set(13, 5, '#c94a5c'); }
      if (hp.extra === 'bun') { r(6, -3, 4, 3, H); set(6, -3, null); set(9, -3, null); set(7, -2, HL); }
      if (hp.extra === 'half') { r(6, 5, 4, 1, '#c94a5c'); r(7, 6, 2, 3, HD); }
      if (hp.shaved) { r(3, 6, 10, 4, HD); }
    }
    if (view === 'side') {
      const puff = hp.top === 'puffy' || bumpy;
      if (hp.top === 'buzz') { r(5, 1, 6, 1, H); r(4, 2, 8, 1, H); r(4, 3, 3, 5, H); set(7, 3, H); set(6, 1, HL); }
      else {
        r(5, puff ? -1 : 0, 6, 1, H); r(4, puff ? 0 : 1, 8, puff ? 2 : 1, H); r(3, 2, 10, 2, H); r(3, 4, 4, 5, H); set(7, 4, H);
        set(6, puff ? -1 : 0, HL); set(5, puff ? 0 : 1, HL); set(7, puff ? 0 : 1, HL);
        if (hp.top === 'flat') { r(5, 0, 7, 1, H); set(12, 2, H); }
        if (hp.top === 'spiky') { pts([[5, -1], [7, -2], [8, -1], [10, -2], [11, -1], [12, 0], [13, 1], [6, -1], [9, -1]], H); pts([[7, -2], [10, -2]], HL); }
        if (bumpy) pts([[3, 1], [2, 3], [2, 5], [4, -1], [8, -2], [11, -1], [12, 0]], H);
        // fringe on the forehead side
        const f = hp.fringe;
        if (f === 'full' || f === 'side' || f === 'comma' || f === 'curly') { r(10, 4, 3, 1, H); set(12, 5, H); set(11, 5, f === 'comma' ? H : null); }
        else if (f === 'center' || f === 'short' || f === 'spiky') { r(11, 4, 2, 1, H); if (f === 'spiky') set(13, 3, H); }
        else if (f === 'none') { /* forehead clear */ }
        for (let y = 4; y <= Math.max(len, 8); y++) { set(3, y, H); set(4, y, H); set(5, y, H); if (len >= 9 && y >= 9) { set(6, y, H); set(2, y, hp.wave && y % 3 === 0 ? H : get(2, y)); } }
        if (len >= 9) set(4, len, HD);
        set(7, 5, HD); set(3, 4, HD);
        if (hp.shaved) { set(5, 6, HD); set(6, 6, HD); set(5, 7, HD); set(7, 5, HD); }
        if (hp.extra === 'twin') { r(4, 5, 2, 7, H); set(5, 5, '#c94a5c'); set(4, 11, HD); }
        if (hp.extra === 'bun') { r(2, -2, 4, 3, H); set(2, -2, null); set(3, -1, HL); }
        if (hp.extra === 'half') set(3, 3, '#c94a5c');
        if (hp.extra === 'pony') set(3, 4, '#c94a5c');
      }
    }

    if (sit) for (let y = 16 + OY; y < SH; y++) g[y].fill(null);
    if (dir === 'left') g = g.map(row => row.slice().reverse());
    // outline
    const out = g.map(row => row.slice());
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      if (g[y][x]) continue;
      if ((g[y - 1] && g[y - 1][x]) || (g[y + 1] && g[y + 1][x]) || g[y][x - 1] || g[y][x + 1]) out[y][x] = OUT;
    }
    const cv = (typeof document !== 'undefined' ? document.createElement('canvas') : root.__mkCanvas());
    cv.width = SW; cv.height = SH;
    const c = cv.getContext('2d');
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (out[y][x]) { c.fillStyle = out[y][x]; c.fillRect(x, y, 1, 1); }
    cache.set(key, cv);
    return cv;
  }

  root.ONL_SPRITE = { HAIRS, HAIR_COLORS, TOPS, TOP_COLORS, BOTTOMS, BOTTOM_COLORS, DEFAULT_LOOK, randomLook, validLook, sprite, shade, SW, SH, FOOT_Y: 18 + OY };
})(typeof window !== 'undefined' ? window : globalThis);
