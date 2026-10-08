// huazi.js — "花字" (variety-show caption) rules for clerk lines, and the subtitle setup / punch split. Pure, no DOM.
// Spec: docs/art-direction-v2.md 8.3 (replaces docs/first-minute-spec.md 5.3): show, don't tell. Only the signature
// moments get a 花字; every other answer is acted out by the subtitle's punch words growing in the key colour (7.7).
//
// Public API
//   stripStage(text) → string                      remove （…）/(…) stage directions; the "|" cut mark is kept
//   splitLine(line) → { setup, punch }             stage directions removed; text before "|" is setup, after is punch
//                                                  (no "|": setup '' and the whole line is punch)
//   subtitleParts(line) → { setup, punch }         the subtitle split (7.7): the "|" cut, else the last sentence of a
//                                                  multi-sentence line (or an X你媽 clause), else a short line is all punch
//   pickHuazi(line, ctx?) → Item[]                 at most ONE item (the allowed list below); others become 'emph'
//   isAllowedHuazi(item) → boolean                 the same allow list for direct ui.huazi() calls (S3 never)
//   s4Symbol(text) → { text, mark }                S4 inner voice: symbols only ('？？？', '！', '！？', '…')
//   huaziTimes(list, timing?, minGapMs = 900) → number[]   start time (ms, relative to the line start) for each item
//   huaziDuration(item) → number                   on-screen time of an item in ms
//   createHuaziTracker({ mode }) → { next(), pick(line, extra?), reset(), get index() }
//                                                  keeps the "recent" records for the repeat limit (one per round)
//   HZ_GAP_MS = 900                                min time between two 花字; never more than one on screen
//
// Allowed (8.3): S1 X你媽 (調你媽); S2 250 / 二百五 / 251 / 520 and 黃金比例最好喝; S1 滾 / 閉嘴 / 收 only at the big
// FX level (ctx.big: charge 2, the boss's last step); S5 day cards and 兩個月後 in the opening / pay day.
// S3 (black OS bar) is gone; S4 is symbols only.
//
// Item = { text, style: 'S1'|'S2'|'S5'|'emph', seg: 'setup'|'punch', ratio, key, score }
//   style 'emph' = not allowed as a 花字 here (or rate-limited): the UI only highlights those words in the subtitle.
//
// ctx = {
//   lang: 'zh'|'en',
//   mode: 'normal' | 'opening' | 'payday',   // the repeat limit only applies in 'normal'
//   hua: [[text, styleNo], ...],             // manual override from content (customer.hua): skips auto rules
//   index: number,                           // running customer index in this round (normal mode)
//   recent: { [key]: index },                // keyword → customer index it was last shown at
//   big: boolean,                            // big FX level (charge 2 / boss's last step); `exempt` is an old alias
// }

export const HZ_GAP_MS = 900;

const SCORE = { curse: 100, num: 90, end: 80, gold: 75, months: 70 };
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

/**
 * Subtitle split (7.7): the punch is what grows in the key colour. With a "|" it is the voice cut; without one the
 * last sentence of a line with two or more sentences (an X你媽 / "your mom" clause wins), a short single sentence
 * (≤ 8 chars / 18 latin chars) is all punch, a longer one has no punch (plain line).
 */
export function subtitleParts(line) {
  const raw = String(line ?? '');
  if (raw.includes('|')) {
    const s = splitLine(raw);
    const latin = isLatin(s.setup + s.punch);
    return { setup: latin && s.setup ? s.setup + ' ' : s.setup, punch: s.punch };
  }
  const t = stripStage(raw);
  if (!t) return { setup: '', punch: '' };
  const latin = isLatin(t);
  // sentences keep their closing punctuation (and any closing quote / ellipsis right after it)
  const parts = t.match(latin ? /[^.!?…]+(?:[.!?…]+["”']?\s*|$)/g : /[^。！？!?…]+(?:[。！？!?…]+[」』”]?|$)/g) || [t];
  const clean = parts.filter((p) => p.trim());
  const curse = clean.findIndex((p) => /[一-龥]你媽|your mom/i.test(p));
  if (curse >= 0 && clean.length > 1) {
    return { setup: clean.slice(0, curse).join(''), punch: clean.slice(curse).join('') };
  }
  if (clean.length > 1) {
    const last = clean[clean.length - 1];
    return { setup: clean.slice(0, -1).join(''), punch: last.trim() };
  }
  if (charLen(t) <= (latin ? 18 : 8)) return { setup: '', punch: t };
  return { setup: t, punch: '' };
}

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

// Each rule returns { score, style, text, seg, ratio } or null. style 'emph' = subtitle emphasis only.
const RULES = [
  // 100: X你媽 (the original "調你媽")
  (segs) => {
    const f = find(segs, /([一-龥])你媽/) || find(segs, /\b[a-z]+ your mom\b/i);
    if (!f) return null;
    const text = /[一-龥]/.test(f.m[0]) ? f.m[0] + '！' : f.m[0].toUpperCase() + '!';
    return { score: SCORE.curse, style: 'S1', text, seg: f.seg, ratio: ratioOf(f.text, f.idx) };
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
  // 80: the curse word that ends a segment: a 花字 only at the big FX level, else subtitle emphasis
  (segs, ctx) => {
    for (const seg of ['punch', 'setup']) {
      const text = segs[seg];
      if (!text) continue;
      let m = /(滾|閉嘴|收)[！!。]?$/.exec(text);
      if (m) return { score: SCORE.end, style: ctx.big ? 'S1' : 'emph', text: m[1] + '！', seg, ratio: ratioOf(text, m.index) };
      m = /(scram|shut it|deal|get out|booked)[!.]?$/i.exec(text);
      if (m) return { score: SCORE.end, style: ctx.big ? 'S1' : 'emph', text: m[1].toUpperCase() + '!', seg, ratio: ratioOf(text, m.index) };
    }
    return null;
  },
  // 75: 黃金比例最好喝 (plain 黃金比例 is subtitle emphasis); en "golden ratio" only in the opening (its E6 line)
  (segs, ctx) => {
    let f = find(segs, /黃金比例/);
    if (f) {
      const best = f.text.slice(f.idx).startsWith('黃金比例最好喝');
      return { score: SCORE.gold, style: best ? 'S2' : 'emph', text: best ? '黃金比例最好喝' : '黃金比例', seg: f.seg, ratio: ratioOf(f.text, f.idx) };
    }
    if (ctx.lang === 'en') {
      f = find(segs, /golden ratio/i);
      if (f) return { score: SCORE.gold, style: ctx.mode === 'opening' ? 'S2' : 'emph', text: 'GOLDEN RATIO', seg: f.seg, ratio: ratioOf(f.text, f.idx) };
    }
    return null;
  },
  // 70: 兩個月 → S5 in the opening / pay day, subtitle emphasis in normal play
  (segs, ctx) => {
    const zh = find(segs, /兩個月/);
    const f = zh || (ctx.lang === 'en' ? find(segs, /two months/i) : null);
    if (!f) return null;
    const big = ctx.mode === 'opening' || ctx.mode === 'payday';
    return { score: SCORE.months, style: big ? 'S5' : 'emph', text: zh ? '兩個月後' : 'TWO MONTHS', seg: f.seg, ratio: ratioOf(f.text, f.idx) };
  },
];

const SIGNATURE = /[一-龥]你媽|你嗶|your mom|250|二百五|251|520|黃金比例最好喝|golden ratio/i;

/** Direct ui.huazi() calls go through the same list: S5 / S4 (symbols) / emph always, S1 / S2 only signature words
 * or items marked big (charge 2, the boss's last step), S3 never. */
export function isAllowedHuazi(item = {}) {
  const st = typeof item.style === 'number' || /^[1-5]$/.test(String(item.style)) ? 'S' + item.style : String(item.style || '');
  if (!item.text) return false;
  if (st === 'S5' || st === 'S4' || st === 'emph') return true;
  if (st === 'S1' || st === 'S2') return !!item.big || SIGNATURE.test(String(item.text));
  return false;
}

/** S4 (a customer's inner voice): symbols only (8.3). Words map to a symbol; a mark names the drawn extra. */
export function s4Symbol(text) {
  const t = stripStage(text) || String(text ?? '');
  const sym = t.replace(/[^？?！!…。.～~]/g, '').replace(/\?/g, '？').replace(/!/g, '！').replace(/\.{2,}|。{2,}/g, '…');
  if (sym && sym.length === t.replace(/\s/g, '').length) return { text: [...sym].slice(0, 3).join(''), mark: /！/.test(sym) && !/？/.test(sym) ? 'bang' : 'q' };
  const s = String(text ?? '');
  if (/自信|得意|confident|proud/i.test(s)) return { text: '！', mark: 'sparkle' };
  if (/呆|frozen|stunned/i.test(s)) return { text: '…', mark: 'sweat' };
  if (/調|adjust/i.test(s)) return { text: '…', mark: 'sweat' };
  if (/停|freeze|stop/i.test(s)) return { text: '！？', mark: 'bang' };
  return { text: '？？？', mark: 'q' };
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
  return out;
}

/**
 * Pick the 花字 for one clerk line: at most one item. Pure: ctx is read, never written.
 */
export function pickHuazi(line, ctx = {}) {
  const c = { lang: 'zh', mode: 'normal', recent: {}, index: 0, ...ctx };
  c.big = !!(ctx.big ?? ctx.exempt);
  let list;
  if (Array.isArray(c.hua) && c.hua.length) {
    list = manual(line, c.hua).map((it) => (isAllowedHuazi({ ...it, big: c.big }) && it.style !== 'S4' ? it : { ...it, style: it.style === 'S3' ? null : 'emph' }))
      .filter((it) => it.style);
  } else {
    const segs = splitLine(line);
    let best = null;
    for (const rule of RULES) {
      const r = rule(segs, c);
      if (!r) continue;
      // an allowed 花字 always beats a subtitle emphasis
      const rank = (x) => (x.style === 'emph' ? 0 : 1000) + x.score;
      if (!best || rank(r) > rank(best)) best = r;
    }
    list = best ? [best] : [];
  }
  const big = list.find((it) => it.style !== 'emph');
  const one = big ? [big] : list.slice(0, 1);
  return one.map((it) => ({ ...it, text: capText(it.text), key: normKey(it.text) })).map((it) => limit(it, c));
}

// Repeat limit: the same keyword is not a 花字 again within 5 customers (normal play only).
function limit(it, c) {
  if (c.mode !== 'normal' || it.style === 'emph') return it;
  const seen = c.recent[it.key];
  if (seen != null && c.index - seen < 5) return { ...it, style: 'emph', limited: 'repeat' };
  return it;
}

const DUR = { S1: 1000, S2: 1500, S4: 1300, emph: 0 };

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
 * timing = { setupStartMs = 0, setupMs = 0, punchStartMs, punchMs }; S4 appears at its segment start, the
 * others at segment start + clip length × ratio. Items are kept at least minGapMs apart.
 */
export function huaziTimes(list, timing = {}, minGapMs = HZ_GAP_MS) {
  const setupStart = timing.setupStartMs ?? 0;
  const setupMs = timing.setupMs ?? 0;
  const punchStart = timing.punchStartMs ?? setupStart + setupMs;
  const punchMs = timing.punchMs ?? 0;
  const raw = list.map((it) => {
    if (it.at != null) return it.at;
    const start = it.seg === 'setup' ? setupStart : punchStart;
    const len = it.seg === 'setup' ? setupMs : punchMs;
    if (it.style === 'S4') return start;
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
 * Keeps the recent-history records needed by the repeat limit. One tracker per round.
 *   next()                 call once per new customer (normal play)
 *   pick(line, extra)      pickHuazi with the tracker's records; records what was actually shown
 */
export function createHuaziTracker({ mode = 'normal', lang = 'zh' } = {}) {
  let index = -1;
  let recent = {};
  return {
    next() { index++; return index; },
    pick(line, extra = {}) {
      const ctx = { lang, mode, ...extra, index: Math.max(0, index), recent };
      const list = pickHuazi(line, ctx);
      for (const it of list) {
        if (it.style === 'emph') continue;
        recent = { ...recent, [it.key]: ctx.index };
      }
      return list;
    },
    reset() { index = -1; recent = {}; },
    setLang(l) { lang = l === 'en' ? 'en' : 'zh'; },
    get index() { return index; },
  };
}
