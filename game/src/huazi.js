// huazi.js — automatic "花字" (variety-show caption) picker for clerk lines. Pure, no DOM.
// Spec: docs/first-minute-spec.md section 5.3.
//
// Public API
//   stripStage(text) → string                      remove （…）/(…) stage directions and the "|" cut mark is kept
//   splitLine(line) → { setup, punch }             stage directions removed; text before "|" is setup, after is punch
//                                                  (no "|": setup '' and the whole line is punch)
//   pickHuazi(line, ctx?) → Item[]                 at most 2 items: one S3 (setup) + one S1/S2/S5 (punch), see rules
//   huaziTimes(list, timing?, minGapMs = 450) → number[]   start time (ms, relative to the line start) for each item
//   huaziDuration(item) → number                   on-screen time of an item in ms
//   createHuaziTracker({ mode }) → { next(), pick(line, extra?), reset(), get index() }
//                                                  keeps the "recent" records for the rate limits (one per round)
//
// Item = { text, style: 'S1'|'S2'|'S3'|'S4'|'S5'|'emph', seg: 'setup'|'punch', ratio, key, size?, score }
//   style 'emph' = an S1/S2 that was rate-limited: the UI only highlights those words in the subtitle.
//   size  'sm'   = S2 small (9cqw) for "两个月后" during normal play.
//
// ctx = {
//   lang: 'zh'|'en',
//   mode: 'normal' | 'opening' | 'payday',   // rate limits 2 and 3 only apply in 'normal'
//   hua: [[text, styleNo], ...],             // manual override from content (customer.hua): skips auto rules
//   index: number,                           // running customer index in this round (normal mode)
//   lastS1Index: number | null,              // customer index of the last S1 shown
//   recent: { [key]: index },                // keyword → customer index it was last shown at
//   exempt: boolean,                         // charge level 2 / revenge / rage: S1 not rate-limited
// }

const SCORE = { curse: 100, num: 90, end: 80, gold: 75, months: 70, setupQ: 50, tail: 40 };
const LATIN = /[A-Za-z]/;

/** Remove stage directions in full-width （…） or half-width (…) parentheses. */
export function stripStage(text) {
  return String(text ?? '')
    .replace(/（[^（）]*）/g, ' ')
    .replace(/\([^()]*\)/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function splitLine(line) {
  const raw = String(line ?? '');
  const i = raw.indexOf('|');
  if (i < 0) return { setup: '', punch: stripStage(raw) };
  return { setup: stripStage(raw.slice(0, i)), punch: stripStage(raw.slice(i + 1)) };
}

const isLatin = (s) => LATIN.test(s) && !/[㐀-鿿]/.test(s);
const charLen = (s) => [...String(s)].length;
// Rule 5: long display text is cut to the matched part; this is the hard cap.
const capText = (s) => {
  const max = isLatin(s) ? 16 : 7;
  return charLen(s) > max ? [...s].slice(0, max).join('') : s;
};
const normKey = (s) => String(s).replace(/[！!。.？?，,…~～\s—-]/g, '').toLowerCase();
const ratioOf = (seg, idx) => (seg.length ? Math.max(0, Math.min(1, idx / seg.length)) : 0);

function find(segs, re) {
  for (const seg of ['punch', 'setup']) {
    const text = segs[seg];
    if (!text) continue;
    const m = re.exec(text);
    if (m) return { seg, text, m, idx: m.index };
  }
  return null;
}

// Each rule returns { score, style, text, seg, ratio, size? } or null.
const RULES = [
  // 100: X你妈 (the original "调你妈")
  (segs) => {
    const f = find(segs, /([一-龥])你妈/);
    return f && { score: SCORE.curse, style: 'S1', text: f.m[0] + '！', seg: f.seg, ratio: ratioOf(f.text, f.idx) };
  },
  // 90: signature numbers (zh digits, 二百五; en "two-fifty"/"quarter-wit" shown as 250)
  (segs, ctx) => {
    let f = find(segs, /250|二百五|251|520/);
    if (f) {
      const after = f.text[f.idx + f.m[0].length];
      const text = f.m[0] + (after === '杯' ? '杯' : '');
      return { score: SCORE.num, style: 'S2', text, seg: f.seg, ratio: ratioOf(f.text, f.idx) };
    }
    if (ctx.lang === 'en') {
      f = find(segs, /\btwo[- ]fifty\b|\bquarter-wit\b/i);
      if (f) return { score: SCORE.num, style: 'S2', text: '250', seg: f.seg, ratio: ratioOf(f.text, f.idx) };
    }
    return null;
  },
  // 80: the curse word that ends a segment
  (segs) => {
    for (const seg of ['punch', 'setup']) {
      const text = segs[seg];
      if (!text) continue;
      let m = /(滚|闭嘴|收)[！!。]?$/.exec(text);
      if (m) {
        const style = m[1] === '收' ? 'S2' : 'S1';
        return { score: SCORE.end, style, text: m[1] + '！', seg, ratio: ratioOf(text, m.index) };
      }
      m = /(scram|shut it|deal|get out|booked)[!.]?$/i.exec(text);
      if (m) {
        const w = m[1].toLowerCase();
        const style = w === 'deal' || w === 'booked' ? 'S2' : 'S1';
        return { score: SCORE.end, style, text: m[1].toUpperCase() + '!', seg, ratio: ratioOf(text, m.index) };
      }
    }
    return null;
  },
  // 75: 黄金比例(最好喝)
  (segs, ctx) => {
    let f = find(segs, /黄金比例/);
    if (f) {
      const best = f.text.slice(f.idx).startsWith('黄金比例最好喝');
      return { score: SCORE.gold, style: 'S2', text: best ? '黄金比例最好喝' : '黄金比例', seg: f.seg, ratio: ratioOf(f.text, f.idx) };
    }
    if (ctx.lang === 'en') {
      f = find(segs, /golden ratio/i);
      if (f) return { score: SCORE.gold, style: 'S2', text: 'GOLDEN RATIO', seg: f.seg, ratio: ratioOf(f.text, f.idx) };
    }
    return null;
  },
  // 70: 两个月 → S2 small in normal play, S5 in the opening / pay day
  (segs, ctx) => {
    const zh = find(segs, /两个月/);
    const f = zh || (ctx.lang === 'en' ? find(segs, /two months/i) : null);
    if (!f) return null;
    const text = zh ? '两个月后' : 'TWO MONTHS';
    const big = ctx.mode === 'opening' || ctx.mode === 'payday';
    return { score: SCORE.months, style: big ? 'S5' : 'S2', size: big ? undefined : 'sm', text, seg: f.seg, ratio: ratioOf(f.text, f.idx) };
  },
];

function setupQuestion(segs) {
  const s = segs.setup;
  if (!s) return null;
  const limit = isLatin(s) ? 16 : 5;
  if (charLen(s) <= limit && /[？?]$/.test(s)) return { score: SCORE.setupQ, style: 'S3', text: s, seg: 'setup', ratio: 0 };
  return null;
}

function tailClause(segs) {
  const p = segs.punch;
  if (!p) return null;
  const parts = p.split(/[，,。.！!？?；;…]+/).map((x) => x.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;
  const limit = isLatin(last) ? 16 : 6;
  if (charLen(last) > limit) return null;
  const idx = p.lastIndexOf(last);
  return { score: SCORE.tail, style: 'S3', text: last, seg: 'punch', ratio: ratioOf(p, idx) };
}

function manual(line, hua) {
  const segs = splitLine(line);
  const out = [];
  for (const [text, n] of hua) {
    const style = 'S' + Math.max(1, Math.min(5, n | 0));
    const t = String(text);
    const probe = t.replace(/[！!]$/, '');
    let seg = 'punch';
    let idx = segs.punch.indexOf(probe);
    if (idx < 0 && segs.setup.includes(probe)) { seg = 'setup'; idx = segs.setup.indexOf(probe); }
    out.push({ score: 0, style, text: t, seg, ratio: ratioOf(segs[seg], Math.max(0, idx)) });
  }
  // Limit 1 still holds: one S3 + one big at most.
  const s3 = out.find((x) => x.style === 'S3');
  const big = out.find((x) => x.style !== 'S3');
  return [s3, big].filter(Boolean);
}

/**
 * Pick at most two 花字 for one clerk line. Pure: ctx is read, never written.
 */
export function pickHuazi(line, ctx = {}) {
  const c = { lang: 'zh', mode: 'normal', recent: {}, index: 0, lastS1Index: null, exempt: false, ...ctx };
  let list;
  if (Array.isArray(c.hua) && c.hua.length) {
    list = manual(line, c.hua);
  } else {
    const segs = splitLine(line);
    let big = null;
    for (const rule of RULES) {
      const r = rule(segs, c);
      if (r && (!big || r.score > big.score)) big = r;
    }
    const q = setupQuestion(segs);
    list = [q, big].filter(Boolean);
    if (!list.length) {
      const t = tailClause(segs);
      if (t) list = [t];
    }
  }
  return list
    .map((it) => ({ ...it, text: capText(it.text), key: normKey(it.text) }))
    .map((it) => limit(it, c))
    .sort((a, b) => (a.seg === b.seg ? 0 : a.seg === 'setup' ? -1 : 1));
}

// Rate limits 2 (one S1 per 3 customers) and 3 (same keyword not within 5 customers), normal play only.
function limit(it, c) {
  if (c.mode !== 'normal' || it.style === 'S3' || it.style === 'S4') return it;
  const seen = c.recent[it.key];
  if (seen != null && c.index - seen < 5) return { ...it, style: 'emph', limited: 'repeat' };
  if (it.style === 'S1' && !c.exempt && c.lastS1Index != null && c.index - c.lastS1Index < 3) {
    return { ...it, style: 'emph', limited: 's1' };
  }
  return it;
}

const DUR = { S1: 1000, S2: 1500, S3: 1160, S4: 1300, emph: 0 };

/** On-screen time of one item (S5 depends on its length and typing speed). */
export function huaziDuration(it = {}) {
  if (it.style === 'S5') {
    const n = charLen(it.text || '');
    return 160 + n * (it.charMs ?? 60) + (it.holdMs ?? 600) + 160;
  }
  return DUR[it.style] ?? 1000;
}

/**
 * Start times (ms after the line starts) for each item.
 * timing = { setupStartMs = 0, setupMs = 0, punchStartMs, punchMs }; S3 appears at its segment start, the
 * others at segment start + clip length × ratio. Items are kept at least minGapMs apart (rule 4).
 */
export function huaziTimes(list, timing = {}, minGapMs = 450) {
  const setupStart = timing.setupStartMs ?? 0;
  const setupMs = timing.setupMs ?? 0;
  const punchStart = timing.punchStartMs ?? setupStart + setupMs;
  const punchMs = timing.punchMs ?? 0;
  const raw = list.map((it) => {
    if (it.at != null) return it.at;
    const start = it.seg === 'setup' ? setupStart : punchStart;
    const len = it.seg === 'setup' ? setupMs : punchMs;
    if (it.style === 'S3' || it.style === 'S4') return start;
    return start + len * (it.ratio || 0);
  });
  const order = raw.map((t, i) => i).sort((a, b) => raw[a] - raw[b]);
  const out = raw.slice();
  let prev = -Infinity;
  for (const i of order) {
    if (list[i].style === 'emph') { out[i] = raw[i]; continue; }
    out[i] = Math.max(raw[i], prev + minGapMs);
    prev = out[i];
  }
  return out.map((t) => Math.max(0, Math.round(t)));
}

/**
 * Keeps the recent-history records needed by the rate limits. One tracker per round.
 *   next()                 call once per new customer (normal play)
 *   pick(line, extra)      pickHuazi with the tracker's records; records what was actually shown
 */
export function createHuaziTracker({ mode = 'normal', lang = 'zh' } = {}) {
  let index = -1;
  let lastS1Index = null;
  let recent = {};
  return {
    next() { index++; return index; },
    pick(line, extra = {}) {
      const ctx = { lang, mode, ...extra, index: Math.max(0, index), lastS1Index, recent };
      const list = pickHuazi(line, ctx);
      for (const it of list) {
        if (it.style === 'emph' || it.style === 'S3' || it.style === 'S4') continue;
        recent = { ...recent, [it.key]: ctx.index };
        if (it.style === 'S1') lastS1Index = ctx.index;
      }
      return list;
    },
    reset() { index = -1; lastS1Index = null; recent = {}; },
    setLang(l) { lang = l === 'en' ? 'en' : 'zh'; },
    get index() { return index; },
  };
}
