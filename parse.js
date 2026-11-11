// ON-Lounge text parser: monthly QT schedule text (typed or read from a photo) -> [{ day, ref }].
(function (root) {
  // ---------------- Bible books ----------------
  const BOOKS = [
    ['창세기', '창'], ['출애굽기', '출'], ['레위기', '레'], ['민수기', '민'], ['신명기', '신'], ['여호수아', '수'], ['사사기', '삿'], ['룻기', '룻'],
    ['사무엘상', '삼상'], ['사무엘하', '삼하'], ['열왕기상', '왕상'], ['열왕기하', '왕하'], ['역대상', '대상'], ['역대하', '대하'], ['에스라', '스'],
    ['느헤미야', '느'], ['에스더', '에'], ['욥기', '욥'], ['시편', '시'], ['잠언', '잠'], ['전도서', '전'], ['아가', '아'], ['이사야', '사'],
    ['예레미야애가', '애'], ['예레미야', '렘'], ['에스겔', '겔'], ['다니엘', '단'], ['호세아', '호'], ['요엘', '욜'], ['아모스', '암'], ['오바댜', '옵'],
    ['요나', '욘'], ['미가', '미'], ['나훔', '나'], ['하박국', '합'], ['스바냐', '습'], ['학개', '학'], ['스가랴', '슥'], ['말라기', '말'],
    ['마태복음', '마'], ['마가복음', '막'], ['누가복음', '눅'], ['요한복음', '요'], ['사도행전', '행'], ['로마서', '롬'], ['고린도전서', '고전'],
    ['고린도후서', '고후'], ['갈라디아서', '갈'], ['에베소서', '엡'], ['빌립보서', '빌'], ['골로새서', '골'], ['데살로니가전서', '살전'],
    ['데살로니가후서', '살후'], ['디모데전서', '딤전'], ['디모데후서', '딤후'], ['디도서', '딛'], ['빌레몬서', '몬'], ['히브리서', '히'],
    ['야고보서', '약'], ['베드로전서', '벧전'], ['베드로후서', '벧후'], ['요한일서', '요일'], ['요한이서', '요이'], ['요한삼서', '요삼'],
    ['유다서', '유'], ['요한계시록', '계']
  ];
  const ALIAS = {};
  BOOKS.forEach(([full, abbr]) => {
    ALIAS[full] = full; ALIAS[abbr] = full;
    const bare = full.replace(/(복음|서|기)$/, '');
    if (bare.length >= 2 && !ALIAS[bare]) ALIAS[bare] = full;
  });
  ALIAS['계시록'] = '요한계시록'; ALIAS['요한1서'] = '요한일서'; ALIAS['요한2서'] = '요한이서'; ALIAS['요한3서'] = '요한삼서';
  ALIAS['요1'] = '요한일서'; ALIAS['요2'] = '요한이서'; ALIAS['요3'] = '요한삼서';
  const names = Object.keys(ALIAS).sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const SEP = '[-~∼–—]';
  // book + chapter:verse(-[chapter:]verse) | book + chapter편/장(-chapter)
  const REF_RE = new RegExp(
    '(' + names.join('|') + ')\\s*(\\d{1,3})\\s*(?:(?::|：|장)\\s*(\\d{1,3})\\s*절?(?:\\s*' + SEP + '\\s*(?:(\\d{1,3})\\s*(?::|：|장)\\s*)?(\\d{1,3})\\s*절?)?|(?:편|장)(?:\\s*' + SEP + '\\s*(\\d{1,3})\\s*(?:편|장)?)?)',
    'g');

  function normalizeOcr(text) {
    return String(text || '')
      .replace(/[|｜]/g, ' ')
      .replace(/목음/g, '복음').replace(/복옴|볶음/g, '복음')
      .replace(/[；;]/g, ':')
      .replace(/(\d)\s*[Il]\s*(\d)/g, '$1:$2')      // OCR often reads ":" as "I" or "l"
      .replace(/(\d)\s*\.\s*(\d{1,3})\s*[-~∼–—]/g, '$1:$2-'); // "3.1-15" style
  }

  function dayFromPrefix(prefix) {
    let m = prefix.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
    if (m) return +m[2];
    m = prefix.match(/(\d{1,2})\s*[/.]\s*(\d{1,2})(?!\d)/);
    if (m) return +m[2];
    m = prefix.match(/(\d{1,2})\s*일/);
    if (m) return +m[1];
    const nums = prefix.match(/(?:^|[^\d:])(\d{1,2})(?![\d:])/g);
    if (nums) { const n = +nums[nums.length - 1].replace(/\D/g, ''); if (n >= 1 && n <= 31) return n; }
    return null;
  }

  function formatRef(book, c1, v1, c2, v2, chapTo) {
    if (v1 == null) return chapTo ? `${book} ${c1}-${chapTo}장` : `${book} ${c1}${book === '시편' ? '편' : '장'}`;
    if (v2 == null) return `${book} ${c1}:${v1}`;
    if (c2 != null && +c2 !== +c1) return `${book} ${c1}:${v1}-${c2}:${v2}`;
    return `${book} ${c1}:${v1}-${v2}`;
  }

  // returns [{ day, ref }] sorted by day; daysInMonth limits the range
  function parseSchedule(text, daysInMonth) {
    const lines = normalizeOcr(text).split(/\r?\n/);
    const out = new Map();
    let lastDay = 0;
    for (const line of lines) {
      REF_RE.lastIndex = 0;
      let m, cursor = 0;
      while ((m = REF_RE.exec(line))) {
        const prefix = line.slice(cursor, m.index);
        cursor = m.index + m[0].length;
        let day = dayFromPrefix(prefix);
        if (day == null || day < 1 || day > daysInMonth) day = lastDay + 1;
        if (day > daysInMonth) continue;
        const book = ALIAS[m[1]];
        const ref = formatRef(book, m[2], m[3], m[4], m[5], m[6]);
        if (!out.has(day)) out.set(day, ref);
        lastDay = day;
      }
    }
    return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([day, ref]) => ({ day, ref }));
  }

  root.ONL_PARSE = { parseSchedule, BOOKS };
})(typeof window !== 'undefined' ? window : globalThis);
