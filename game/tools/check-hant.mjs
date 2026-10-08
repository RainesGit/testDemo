// check-hant.mjs — no Simplified Chinese on screen (producer: Traditional Chinese with Taiwan wording and English only).
// Opens the game at 390x844 and records every piece of text the page ever shows (text nodes, SVG text, aria-label /
// title / placeholder / alt, document.title) through a MutationObserver, then fails on any Simplified-only character
// or non-Taiwan variant (tools/hans-chars.mjs, generated from OpenCC; plus 后 / 干 / 里, see check-content T1).
// Runs:
//   1. a mainland-Chinese browser (locale zh-CN, no ?lang): must still get Chinese = Traditional. Start card, the day 1
//      opening (each wait point answered with its key), day 1 free play to the closing card.
//   2. locale zh-TW, days 3–7 (?day=N&skipOpening=1, rounds shortened to 30 s): customers, rage, daily rules, mini
//      events, boss, shutter, the summary card. Day 5 with ?input=buttons (the key pad), day 6 with the start card's
//      voice option visible.
// Screenshots: tools/shots/hant-*.png (or --out=dir).
// Usage: (serve game/ first) node tools/check-hant.mjs [baseUrl] [--out=dir]
import { mkdirSync } from 'node:fs';
import { HANS_ONLY, SUSPECT } from './hans-chars.mjs';
const pw = (await import('./pw.mjs')).default;

const base = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765';
const outArg = process.argv.find((a) => a.startsWith('--out='));
const out = outArg ? outArg.slice(6).replace(/\/?$/, '/') : new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const KEYMAP = { gun: 'j', shut: 'k', take: 'l' };

const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
const errors = [];
const seen = new Map(); // text -> where

const COLLECT = () => {
  window.__texts = new Set();
  const add = (s) => { if (s && /[㐀-鿿\u{20000}-\u{3134f}]/u.test(s)) window.__texts.add(s); };
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  const scan = (n) => {
    if (!n) return;
    if (n.nodeType === 3) { add(n.data); return; }
    if (n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) return;
    if (n.nodeType === 1) for (const a of ATTRS) add(n.getAttribute(a));
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (t.nodeType === 3) add(t.data);
      else for (const a of ATTRS) add(t.getAttribute(a));
    }
  };
  window.__scanTexts = () => { scan(document); add(document.title); };
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') add(m.target.data);
      else if (m.type === 'attributes') add(m.target.getAttribute(m.attributeName));
      else m.addedNodes.forEach(scan);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder', 'alt'] });
  document.addEventListener('DOMContentLoaded', () => window.__scanTexts());
};

async function newPage(locale, tag) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale });
  await context.addInitScript(COLLECT);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  return { context, page };
}
async function harvest(page, tag) {
  const texts = await page.evaluate(() => { window.__scanTexts(); return [...window.__texts]; });
  for (const t of texts) if (!seen.has(t)) seen.set(t, tag);
  return texts.length;
}
const press = async (page, key) => { await page.keyboard.down(KEYMAP[key]); await page.waitForTimeout(40); await page.keyboard.up(KEYMAP[key]); };
const probe = (page) => page.evaluate(() => {
  const w = window.__250 || {};
  const op = w.opening;
  const s = w.game && w.game.state;
  return {
    opening: !!(op && (typeof op.active === 'function' ? op.active() : op.active)),
    waiting: op ? op.waiting : null,
    phase: s ? s.phase : null,
    current: s && s.current ? { key: s.current.customer.key, id: s.current.customer.id, speaking: !!s.current.speaking, step: s.current.step || 0, steps: s.current.customer.steps || null } : null,
    closing: !!document.querySelector('.day-card'),
    summary: !!document.querySelector('.overlay.summary:not(.hidden)'),
    lang: w.lang,
    rootLang: document.querySelector('#app')?.lang || document.querySelector('[lang]:not(html)')?.lang || '',
  };
});
// Plays until the closing card / summary (or maxMs): answers each customer 300 ms after it is ready, mashes rage.
async function play(page, maxMs) {
  const t0 = Date.now();
  let lastId = null;
  let ready = null;
  while (Date.now() - t0 < maxMs) {
    const p = await probe(page);
    if (p.closing || p.summary || p.phase === 'over') return p;
    if (p.opening) {
      if (p.waiting) { await page.waitForTimeout(500); await press(page, p.waiting); }
      await page.waitForTimeout(80);
      continue;
    }
    if (p.phase === 'rage') { await press(page, ['gun', 'shut', 'take'][Math.floor(Math.random() * 3)]); await page.waitForTimeout(90); continue; }
    if (p.phase && p.phase !== 'playing') { await press(page, 'take'); await page.waitForTimeout(120); continue; } // mini events: mash
    const id = p.current ? `${p.current.id}:${p.current.step}` : null;
    if (id !== lastId) { lastId = id; ready = null; }
    if (p.current && !p.current.speaking && ready == null) ready = Date.now();
    if (p.current && ready != null && Date.now() - ready >= 300) { await press(page, p.current.steps ? p.current.steps[p.current.step] : p.current.key); ready = Infinity; }
    await page.waitForTimeout(50);
  }
  return probe(page);
}

// ---- run 1: mainland locale, no ?lang → Traditional anyway; opening + day 1 ----
{
  const { context, page } = await newPage('zh-CN', 'zh-CN day1');
  await page.goto(`${base}/index.html?debug`);
  await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${out}hant-01-start.png` });
  const p0 = await probe(page);
  results.push({ id: 'locale', ok: p0.lang === 'zh', detail: `zh-CN browser → lang ${p0.lang}` });
  const htmlLang = await page.evaluate(() => [document.documentElement.lang, ...[...document.querySelectorAll('[lang]')].map((n) => n.lang)]);
  results.push({ id: 'lang-attr', ok: htmlLang.every((l) => !/hans|zh-cn/i.test(l)) && htmlLang.some((l) => /zh-Hant/i.test(l)), detail: htmlLang.join(',') });
  await page.click('.start-screen .start-btn', { force: true });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}hant-02-opening.png` });
  await page.evaluate(() => { if (window.__250) window.__250.durationMs = 30000; });
  await play(page, 150000);
  // the closing card comes after the day's last line has been read (lastLineMs + 1300 ms in main.js): wait for it
  await page.waitForSelector('.day-card, .overlay.summary:not(.hidden)', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const end = await probe(page);
  await page.screenshot({ path: `${out}hant-03-day1-end.png` });
  results.push({ id: 'day1', ok: end.closing || end.summary, detail: `closing ${end.closing} summary ${end.summary}` });
  await harvest(page, 'zh-CN day1');
  await context.close();
}

// ---- run 2: days 3–7 ----
for (const d of [3, 4, 5, 6, 7]) {
  const { context, page } = await newPage('zh-TW', `day${d}`);
  const extra = d === 5 ? '&input=buttons' : '';
  await page.goto(`${base}/index.html?debug&day=${d}&skipOpening=1${extra}`);
  await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
  await page.waitForTimeout(1300);
  await page.evaluate(() => { window.__250.durationMs = 30000; });
  await page.click('.start-screen .start-btn', { force: true });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}hant-day${d}-play.png` });
  await play(page, 70000);
  await page.waitForTimeout(2500);
  const end = await probe(page);
  await page.screenshot({ path: `${out}hant-day${d}-end.png` });
  results.push({ id: `day${d}`, ok: end.summary || end.closing, detail: `summary ${end.summary}` });
  await harvest(page, `day${d}`);
  await context.close();
}
await browser.close();

// ---- verdict ----
const bad = [];
for (const [t, where] of seen) {
  const chars = [...t].filter((c) => HANS_ONLY.has(c) || SUSPECT.has(c));
  if (chars.length) bad.push(`${where}: [${[...new Set(chars)].join('')}] "${t.replace(/\s+/g, ' ').slice(0, 40)}"`);
}
results.push({ id: 'T-screen', ok: bad.length === 0 && seen.size > 50, detail: `${seen.size} Chinese texts seen; ${bad.length} with Simplified characters${bad.length ? ': ' + bad.slice(0, 8).join(' | ') : ''}` });
results.push({ id: 'errors', ok: errors.length === 0, detail: errors.slice(0, 3).join(' | ') });
let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id}  ${r.detail}`); }
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
