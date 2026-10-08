// check-content.mjs — automated design-rule and content checks for acceptance (see docs/acceptance-checklist.md).
// Run from game/:  node tools/check-content.mjs
// Prints one PASS/FAIL line per check and exits 1 if any check fails.

import { readFileSync, readdirSync } from 'node:fs';
import { CUSTOMERS_ZH, SYSTEM_ZH } from '../src/content.zh.js';
import { CUSTOMERS_EN, SYSTEM_EN } from '../src/content.en.js';
import { createGame, DEFAULT_CONFIG } from '../src/engine.js';
import { stripStage, splitPunch, clipKey } from '../src/audio.js';
import { exportJobs } from './voice/export-lines.mjs';
import { HANS_ONLY, SUSPECT } from './hans-chars.mjs';

const STYLES = new Set(['real', 'curse', 'disdain', 'cold', 'deadpan', 'chuuni', 'math', '250', 'twist']);
const KEYS = new Set(['gun', 'shut', 'take']);
const results = [];
const check = (id, name, ok, detail = '') => results.push({ id, name, ok: !!ok, detail });

// Every string inside a value (nested objects and arrays included).
const strings = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings)
  : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
// All player-facing text in one language (the customer `tag` field is not displayed any more).
function texts(customers, system) {
  const out = [];
  for (const c of customers) out.push(c.name, c.says, c.reply, c.alt, c.sign, ...strings(c.hua || []));
  out.push(...strings(system));
  return out.filter(Boolean).map(String);
}
const ZH = texts(CUSTOMERS_ZH, SYSTEM_ZH);
const EN = texts(CUSTOMERS_EN, SYSTEM_EN);
const hits = (list, re) => list.filter((t) => re.test(t));

// B. Content completeness
for (const [lang, list] of [['zh', CUSTOMERS_ZH], ['en', CUSTOMERS_EN]]) {
  const ids = list.map((c) => c.id).sort((a, b) => a - b);
  check(`B1-${lang}`, `${lang}: exactly 100 customers with ids 1..100`,
    list.length === 100 && ids.every((id, i) => id === i + 1), `count=${list.length}`);
  const bad = list.filter((c) => !c.name || !c.says || !c.reply || !c.alt || !STYLES.has(c.style) || !KEYS.has(c.key));
  check(`B2-${lang}`, `${lang}: every customer has name/says/reply/alt and a valid style and key`,
    bad.length === 0, bad.map((c) => c.id).join(','));
}
const enById = new Map(CUSTOMERS_EN.map((c) => [c.id, c]));
const mismatch = CUSTOMERS_ZH.filter((z) => {
  const e = enById.get(z.id);
  return !e || e.style !== z.style || e.key !== z.key || (e.cups ?? null) !== (z.cups ?? null);
});
check('B3', 'zh and en share style, key and cups for every id', mismatch.length === 0, mismatch.map((c) => c.id).join(','));
for (const [lang, sys] of [['zh', SYSTEM_ZH], ['en', SYSTEM_EN]]) {
  const ok = sys.next?.length >= 5 && sys.polite?.length >= 4 && sys.boo?.length >= 3 && sys.rageStart?.length >= 2
    && sys.rageLines?.length >= 24 && sys.closing?.length >= 3 && sys.opening && typeof sys.opening === 'object'
    && [10, 100, 1000, 10000, 100000].every((k) => sys.milestones?.[k])
    && ['gun', 'shut', 'take', 'queue', 'aura', 'fury', 'start', 'again', 'bleep'].every((k) => sys.ui?.[k])
    && ['gun', 'shut', 'take'].every((k) => sys.tips?.[k]) && sys.daySlow
    && ['aura', 'rage', 'rageTip', 'charge'].every((k) => sys.unlock?.[k])
    && sys.originalCustomer?.steps?.join() === 'take,shut' && sys.originalCustomer.reply1 && sys.originalCustomer.reply2
    && !('signature250' in sys);
  check(`B4-${lang}`, `${lang}: system lines complete (next>=5, polite>=4, rageLines>=24, milestones, ui, opening, tips, unlock, originalCustomer; signature250 removed)`, ok);
}

// B5. Gameplay v2 stage 2 lines (days, report, quick, meter, mini events, group, change order, shutter, boss):
// present in both languages, same shape, and the same "|" structure for every spoken line.
{
  const bad = [];
  const pipes = (t) => (String(t ?? '').match(/\|/g) || []).length;
  for (const [lang, sys] of [['zh', SYSTEM_ZH], ['en', SYSTEM_EN]]) {
    for (let n = 1; n <= 7; n++) for (const k of ['name', 'rule', 'star2', 'riddle']) if (!sys.days?.[n]?.[k]) bad.push(`${lang}:days.${n}.${k}`);
    for (const k of ['day', 'rule', 'riddle', 'rating', 'newRecord', 'best', 'toStar3', 'allStars', 'star1', 'star1Boss', 'tomorrow']) if (!sys.report?.[k]) bad.push(`${lang}:report.${k}`);
    if (!sys.quick?.start || !sys.quick?.label) bad.push(`${lang}:quick`);
    if (!(sys.meter?.over?.length >= 3) || !(sys.meter?.hit?.length >= 2) || sys.meter?.plate?.length !== 3) bad.push(`${lang}:meter`);
    for (const k of ['start', 'jackpot', 'r249', 'r251', 'r300', 'r0']) if (!sys.calculator?.[k]) bad.push(`${lang}:calculator.${k}`);
    if (!(sys.megaphone?.passer?.length >= 1) || !(sys.megaphone?.shout?.length >= 3) || !sys.megaphone?.end) bad.push(`${lang}:megaphone`);
    if (!sys.phone?.caller || !(sys.phone?.hangup?.length >= 1)) bad.push(`${lang}:phone`);
    if (!sys.stamp?.cust || !sys.stamp?.done || ![50, 100, 200, 249].every((k) => sys.stamp?.callouts?.[k])) bad.push(`${lang}:stamp`);
    if (!['gun', 'shut', 'take'].every((k) => sys.group?.[k]?.length)) bad.push(`${lang}:group`);
    for (const k of ['says', 'says2', 'sign', 'sign2', 'early', 'shut', 'take', 'gun']) if (!sys.changeOrder?.[k]) bad.push(`${lang}:changeOrder.${k}`);
    if (!(sys.shutter?.length >= 1)) bad.push(`${lang}:shutter`);
    const steps = sys.boss?.steps || [];
    if (steps.length !== 8) bad.push(`${lang}:boss.steps (${steps.length})`);
    steps.forEach((st, i) => {
      if (!st.says || !st.sign || !st.take) bad.push(`${lang}:boss.steps.${i}`);
      if (i < 3 && (!st.shut || !st.gun)) bad.push(`${lang}:boss.steps.${i} keys`);
    });
    if (!steps[7]?.full || !steps[7]?.gun || !steps[7]?.shut || !sys.boss?.haggleWrong?.shut || !sys.boss?.haggleWrong?.gun) bad.push(`${lang}:boss final / haggleWrong`);
  }
  // same "|" structure per spoken line (zh vs en)
  const spoken = (sys) => [
    ...(sys.meter?.over || []), ...(sys.meter?.hit || []),
    ...['start', 'jackpot', 'r249', 'r251', 'r300', 'r0'].map((k) => sys.calculator?.[k]),
    ...(sys.megaphone?.shout || []), sys.megaphone?.end, ...(sys.phone?.hangup || []), sys.stamp?.done,
    ...['take', 'gun', 'shut'].flatMap((k) => sys.group?.[k] || []), ...['early', 'shut', 'take', 'gun'].map((k) => sys.changeOrder?.[k]),
    ...(sys.shutter || []), ...(sys.boss?.steps || []).flatMap((st) => [st.take, st.shut, st.gun, st.full]),
    sys.boss?.haggleWrong?.shut, sys.boss?.haggleWrong?.gun,
  ];
  const zs = spoken(SYSTEM_ZH);
  const es = spoken(SYSTEM_EN);
  zs.forEach((z, i) => { if (pipes(z) !== pipes(es[i])) bad.push(`| differs: ${z} / ${es[i]}`); });
  check('B5', 'stage 2 lines complete in zh and en (days, report, quick, meter, events, group, change order, shutter, boss), same "|" structure',
    bad.length === 0, bad.slice(0, 4).join(' | '));
}

// C. Design red lines (shipped game text only; docs are reviewed by hand)
const delivery = [...hits(ZH, /外送|外賣|送餐|騎手|熊貓外送|Uber ?Eats|foodpanda/i), ...hits(EN, /deliver(y|ies)|DoorDash|Uber ?Eats|Grubhub|courier|rider|delivery ?guy/i)];
check('C1', 'no delivery-rider characters or references', delivery.length === 0, delivery.slice(0, 3).join(' | '));
const fantasy = [...hits(ZH, /羊駝|草泥馬|外星|太空|魔法|巫師|龍族|惡魔/), ...hits(EN, /alpaca|llama|alien|outer space|magic|wizard|dragon|demon/i)];
check('C2', 'no fantasy elements (alpaca, aliens, space, magic)', fantasy.length === 0, fantasy.slice(0, 3).join(' | '));
const curse = CUSTOMERS_ZH.filter((c) => c.style === 'curse').length;
check('C3', 'explicit-curse style is a heavy hitter, about 10% of customers (8-14)', curse >= 8 && curse <= 14, `curse=${curse}`);
const has250 = CUSTOMERS_ZH.some((c) => c.cups === 250) && CUSTOMERS_ZH.filter((c) => c.style === '250').length >= 5;
check('C4', '250 is present as a signature (a 250-cup customer and >=5 "250" style lines)', has250);
const sig = ZH.join('\n');
check('C5', 'signature lines present: 黃金比例最好喝, 兩個月, 下一位', /黃金比例最好喝/.test(sig) && /兩個月/.test(sig) && /下一位/.test(sig));

// Only failure is being slow: wrong presses must not cost aura in the shipped config.
const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const mainOverride = /auraWrong:\s*(-?[\d.]+)/.exec(mainSrc);
check('C6', 'engine default auraWrong is 0 and main.js does not override it with a penalty',
  DEFAULT_CONFIG.auraWrong === 0 && (!mainOverride || Number(mainOverride[1]) >= 0),
  `default=${DEFAULT_CONFIG.auraWrong}${mainOverride ? `, main.js=${mainOverride[1]}` : ''}`);
{
  const customers = [{ id: 1, style: 'real', key: 'gun', reply: 'r', alt: 'a' }, { id: 2, style: 'cold', key: 'shut', reply: 'r', alt: 'a' }];
  const g = createGame({ customers, rng: () => 0.5 });
  g.start();
  g.tick(500); // past minAnswerMs (presses in the first 280 ms after arrival are ignored)
  const before = g.state.aura;
  const cur = g.state.current.customer;
  g.press(cur.key === 'gun' ? 'shut' : 'gun', 0);
  check('C7', 'with the default config a wrong press leaves aura unchanged and still grows the queue',
    g.state.aura === before && g.state.queue >= 1, `aura ${before} -> ${g.state.aura}, queue=${g.state.queue}`);
}

// H. First-minute content (docs/first-minute-spec.md 8.7)
{
  const OPENING_FIELDS = [
    'dayCard', 'ask', 'c1', 'r1', 'c2', 'r2', 'c3', 'r3', 'c3b', 'r3b', 'c3c',
    'r4', 'r4b', 'r4c', 'r4d', 'r4e', 'r4f', 'next',
    'signs.s1', 'signs.s2', 'signs.s3', 'signs.s3b', 'signs.s3c', 'signs.s3cSub', 'cue.r1', 'cue.r2', 'cue.r4',
    'wrong.w1shut', 'wrong.w1take', 'wrong.w2shut', 'wrong.w2take', 'wrong.w3gun', 'wrong.w3gunAfter',
    'wrong.w3shut', 'wrong.w3shutAfter', 'wrong.w4gun', 'wrong.w4take', 'wrong.auto',
    'timeout.t1', 'timeout.t2', 'timeout.t3', 'timeout.t4', 'timeout.notMe',
    'hz.setup1', 'hz.punch1', 'hz.setup2', 'hz.setup2b', 'hz.punch2', 'hz.huh', 'hz.proud', 'hz.big250', 'hz.calm',
    'hz.trap', 'hz.adjusting', 'hz.handStop', 'hz.punch4', 'hz.gold', 'hz.fresh', 'hz.cups250', 'hz.twoMonths',
    'hz.stunned', 'hz.next', 'hz.logo', 'closing.title',
  ];
  const at = (o, path) => path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  const pipes = (t) => (String(t).match(/\|/g) || []).length;
  const missing = [];
  for (const [lang, sys] of [['zh', SYSTEM_ZH], ['en', SYSTEM_EN]]) {
    const o = sys.opening || {};
    for (const f of OPENING_FIELDS) if (typeof at(o, f) !== 'string' || !at(o, f).trim()) missing.push(`${lang}:${f}`);
    for (const [f, n] of [['recap', 3], ['plate', 3], ['closing.lines', 3]]) {
      const v = at(o, f);
      if (!Array.isArray(v) || v.length !== n || v.some((x) => !String(x).trim())) missing.push(`${lang}:${f}`);
    }
    // the cue word must be inside the punch half of its line
    for (const k of ['r1', 'r2', 'r4']) {
      if (o[k] && o.cue?.[k] && !splitPunch(o[k])[1].includes(o.cue[k])) missing.push(`${lang}:cue.${k} not in punch`);
    }
  }
  const structure = ['ask', 'r1', 'r2', 'r3', 'r3b', 'r4', 'r4b', 'r4c', 'r4d', 'r4e', 'r4f', 'next']
    .filter((k) => pipes(SYSTEM_ZH.opening?.[k] ?? '') !== pipes(SYSTEM_EN.opening?.[k] ?? ''));
  check('H1', 'SYSTEM.opening complete in zh and en, same "|" structure (ask, r1, r2, ...)',
    missing.length === 0 && structure.length === 0, [...missing.slice(0, 4), ...structure.map((k) => `| differs: ${k}`)].join(' | '));

  const badHua = [];
  for (const [lang, list] of [['zh', CUSTOMERS_ZH], ['en', CUSTOMERS_EN]]) {
    for (const c of list) {
      if (c.hua == null) continue;
      const src = [c.reply, c.alt].map((t) => stripStage(String(t).replace(/\|/g, '')));
      const ok = Array.isArray(c.hua) && c.hua.every((h) => Array.isArray(h) && typeof h[0] === 'string' && h[0]
        && Number.isInteger(h[1]) && h[1] >= 1 && h[1] <= 5
        && src.some((t) => t.toLowerCase().includes(h[0].replace(/[！!？?。.]+$/, '').toLowerCase())));
      if (!ok) badHua.push(`${lang}#${c.id}`);
    }
  }
  check('H2', 'customer hua overrides: each text is in reply/alt, style 1-5', badHua.length === 0, badHua.join(','));

  // H3: '|' at most once, both halves speakable, never inside a stage direction.
  const badPipe = [];
  const pipeOk = (t) => {
    const s = String(t);
    if (!s.includes('|')) return true;
    if (pipes(s) !== 1) return false;
    const [a, b] = splitPunch(s);
    if (!stripStage(a).trim() || !stripStage(b).trim()) return false;
    const i = s.indexOf('|');
    const before = s.slice(0, i);
    const openFull = (before.match(/（/g) || []).length - (before.match(/）/g) || []).length;
    const openHalf = (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
    return openFull <= 0 && openHalf <= 0;
  };
  let piped = 0;
  for (const [lang, list, sys] of [['zh', CUSTOMERS_ZH, SYSTEM_ZH], ['en', CUSTOMERS_EN, SYSTEM_EN]]) {
    for (const c of list) for (const f of ['says', 'reply', 'alt']) {
      if (String(c[f]).includes('|')) piped++;
      if (!pipeOk(c[f])) badPipe.push(`${lang}#${c.id}.${f}`);
    }
    for (const t of strings(sys)) if (!pipeOk(t)) badPipe.push(`${lang}:${t}`);
  }
  check('H3', '"|" cut points: once per line, both halves non-empty, outside stage directions',
    badPipe.length === 0 && piped > 0, `${piped} customer lines cut${badPipe.length ? '; bad: ' + badPipe.slice(0, 3).join(' | ') : ''}`);

  // H4: sign text (art.signText) fits the order sign.
  let signText = null;
  try { ({ signText } = await import('../src/art.js')); } catch { /* art.js missing */ }
  const badSign = [];
  if (signText) {
    for (const [lang, list] of [['zh', CUSTOMERS_ZH], ['en', CUSTOMERS_EN]]) {
      for (const c of list) {
        const merged = lang === 'en' ? { ...CUSTOMERS_ZH[c.id - 1], ...c } : c;
        const t = String(signText(merged, lang) ?? '');
        const lines = t.split('\n');
        const width = (l) => (lang === 'en' ? l.length : [...l].filter((ch) => /[\u3400-\u9fff]/.test(ch)).length);
        if (!t.trim() || lines.length > 2 || lines.some((l) => width(l) > (lang === 'en' ? 18 : 7))) badSign.push(`${lang}#${c.id}:${t.replace('\n', '/')}`);
      }
    }
  }
  check('H4', 'every customer sign text is non-empty, <= 2 lines, <= 7 hanzi (en <= 18 chars) per line',
    !!signText && badSign.length === 0, signText ? badSign.slice(0, 4).join(' | ') : 'src/art.js signText not found');

  // C8: no emoji in the UI sources or in displayed content (customer `tag` is not displayed).
  const EMOJI = /\p{Extended_Pictographic}/u;
  const emojiHits = [];
  for (const f of ['../src/ui.js', '../src/art.js', '../style.css']) {
    let src = '';
    try { src = readFileSync(new URL(f, import.meta.url), 'utf8'); } catch { continue; }
    src.split('\n').forEach((line, i) => { if (EMOJI.test(line)) emojiHits.push(`${f.replace('../', '')}:${i + 1}`); });
  }
  for (const [lang, list] of [['zh', ZH], ['en', EN]]) list.forEach((t) => { if (EMOJI.test(t)) emojiHits.push(`${lang}:${t}`); });
  check('C8', 'no emoji (Extended_Pictographic) in ui.js, art.js, style.css or displayed content (tag excepted)',
    emojiHits.length === 0, emojiHits.slice(0, 4).join(' | '));
}

// T. Traditional Chinese only (producer: Traditional Chinese with Taiwan wording and English, no Simplified build).
// Every file the player's browser loads (src/*.js, index.html, style.css; content and comments alike) is scanned for
// Simplified-only characters and non-Taiwan variants (tools/hans-chars.mjs, generated from OpenCC), plus 后 / 干 / 里,
// which are valid Traditional but here only ever a missed conversion (allow a word in T1_ALLOW if one is meant).
{
  const T1_ALLOW = []; // e.g. '皇后', '公里'
  const files = [...readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `../src/${f}`),
    '../index.html', '../style.css'];
  const bad = [];
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    src.split('\n').forEach((line, i) => {
      let rest = line;
      for (const w of T1_ALLOW) rest = rest.split(w).join('');
      for (const ch of rest) if (HANS_ONLY.has(ch) || SUSPECT.has(ch)) bad.push(`${f.replace('../', '')}:${i + 1} ${ch}`);
    });
  }
  for (const [lang, list] of [['zh', ZH], ['en', EN]]) {
    for (const t of list) for (const ch of t) if (HANS_ONLY.has(ch) || SUSPECT.has(ch)) bad.push(`${lang}: ${ch} in ${t.slice(0, 20)}`);
  }
  check('T1', 'no Simplified characters: src/*.js, index.html, style.css and all content are Traditional (Taiwan)',
    bad.length === 0, bad.slice(0, 6).join(' | '));
}

// V. AI voice pack covers every spoken line (rebuild with tools/voice when lines change).
// The spoken set is exactly what tools/voice/export-lines.mjs exports: lines with a '|' cut point need
// both halves' clips (keys of the two halves), the opening routine and the original customer included.
{
  let manifest = null;
  try { manifest = JSON.parse(readFileSync(new URL('../voice/manifest.json', import.meta.url), 'utf8')); } catch { /* missing */ }
  check('V1', 'voice/manifest.json exists', !!manifest);
  const jobs = exportJobs();
  for (const lang of ['zh', 'en']) {
    const clips = manifest?.langs?.[lang]?.clips || {};
    const want = jobs.filter((j) => j.lang === lang);
    const missing = want.filter((j) => !clips[j.key]);
    const halves = want.filter((j) => j.part).length;
    check(`V2-${lang}`, `${lang}: every spoken line has a voice clip (both halves of "|" lines)`, manifest && missing.length === 0,
      `${want.length - missing.length}/${want.length} (${halves} half-lines)${missing.length ? ' missing e.g. ' + missing.slice(0, 2).map((j) => j.text).join(' | ') : ''}`);
  }
  // sanity: the key of each half is what audio.js looks up at runtime
  const sample = CUSTOMERS_ZH.find((c) => String(c.reply).includes('|'));
  const keys = new Set(jobs.map((j) => j.key));
  check('V3', 'export keys match runtime lookups for cut-point halves',
    !sample || splitPunch(sample.reply).every((h) => keys.has(clipKey('zh', h))));
}

// Report
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
