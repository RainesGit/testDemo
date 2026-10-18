// check-shop.mjs — gameplay v3 shop page (shop.html) with real pointer input in Chromium (Playwright).
// 390x844 (full run) and 360x640 (guide + a few drinks):
//   1. the day 1 hands-on guide completes by doing what the finger shows (tap cup rack → tea → pearls → drag to the
//      sealer → drag to the customer → swipe the 奧客)
//   2. day 1 (shortened with ?len): make and serve drinks from the order bubbles (≥ 5 correct), curse away 奧客 by
//      swiping, stamp the 250-cup customer by holding (the number ticket, the prepay)
//   3. the receipt, the upgrade shop: buy an upgrade; day 2 starts with it
//   4. days 3–5 open with their stations (?day=N) for screenshots
// Every step: no console errors / page errors, nothing outside the frame, no Simplified characters on screen
// (tools/hans-chars.mjs). Screenshots: tools/shots/shop-*.png (or --out=dir).
// Usage: (serve game/ first) node tools/check-shop.mjs [baseUrl] [--out=dir]
import { mkdirSync } from 'node:fs';
import { HANS_ONLY, SUSPECT } from './hans-chars.mjs';
const pw = (await import('./pw.mjs')).default;

const base = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765').replace(/\/$/, '');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const out = outArg ? outArg.slice(6).replace(/\/?$/, '/') : new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const results = [];
const errors = [];
const check = (id, ok, detail = '') => { results.push({ id, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COLLECT = () => {
  window.__texts = new Set();
  const add = (s) => { if (s && /[㐀-鿿]/u.test(s)) window.__texts.add(s); };
  const scan = (n) => {
    if (!n) return;
    if (n.nodeType === 3) { add(n.data); return; }
    if (n.nodeType !== 1 && n.nodeType !== 9) return;
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) add(t.data);
  };
  new MutationObserver((list) => { for (const m of list) { if (m.type === 'characterData') add(m.target.data); else m.addedNodes.forEach(scan); } })
    .observe(document, { subtree: true, childList: true, characterData: true });
  document.addEventListener('DOMContentLoaded', () => { scan(document); add(document.title); });
};

const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

async function newPage(w, h, tag) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'zh-TW' });
  await context.addInitScript(COLLECT);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
  return { context, page };
}

const st = (page) => page.evaluate(() => {
  const s = window.__shop.state;
  return s && JSON.parse(JSON.stringify({ phase: s.phase, clock: s.clock, earned: s.earned, slots: s.slots, work: s.work, selected: s.selected, pot: s.pot, stats: s.stats, guide: s.guide, stars: s.stars, queue: s.queue.length }));
});
const where = (page, name) => page.evaluate((n) => window.__shop.where(n), name);
async function tap(page, name) {
  const p = await where(page, name);
  if (!p) throw new Error(`no ${name}`);
  await page.mouse.click(p.x, p.y);
  await sleep(60);
}
async function drag(page, from, to, toDy = 0) {
  const a = await where(page, from);
  const b = typeof to === 'string' ? await where(page, to) : to;
  if (!a || !b) throw new Error(`drag ${from} → ${to}`);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y + toDy - a.y) * i) / 10); await sleep(12); }
  await page.mouse.up();
  await sleep(80);
}
async function swipe(page, slot) {
  const p = await where(page, `seat-${slot}`);
  await page.mouse.move(p.x - p.w * 0.3, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) { await page.mouse.move(p.x - p.w * 0.3 + i * 30, p.y - i * 6); await sleep(10); }
  await page.mouse.up();
  await sleep(120);
}
async function hold(page, slot) {
  const p = await where(page, `seat-${slot}`);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await sleep(500);
  await page.mouse.up();
  await sleep(150);
}
async function waitFor(page, fn, arg, timeout = 15000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 50 });
}

async function makeAndServe(page, slot) {
  let s = await st(page);
  const c = s.slots[slot];
  if (!c || !c.order) return false;
  const o = c.order;
  if (o.toppings.includes('pearl') && s.pot.scoops < o.toppings.filter((k) => k === 'pearl').length) {
    if (!s.pot.cookingUntil) await tap(page, 'pot');
    await waitFor(page, () => window.__shop.state.pot.scoops > 0, null, 12000);
  }
  await tap(page, 'rack');
  s = await st(page);
  const w = s.selected;
  if (w == null) return false;
  await tap(page, `tea-${o.tea}`);
  for (const k of o.toppings) await tap(page, `top-${k}`);
  for (let i = 0; i < o.ice; i++) await tap(page, 'ice');
  for (let i = 0; i < o.sugar; i++) await tap(page, 'sugar');
  await sleep(650);
  await waitFor(page, () => !window.__shop.state.work.some((c) => c && c.sealingUntil && !c.sealed), null, 5000);
  await drag(page, `cup-${w}`, 'sealer');
  await waitFor(page, (ww) => window.__shop.state.work[ww] && window.__shop.state.work[ww].sealed, w, 5000);
  await sleep(120);
  s = await st(page);
  const now = s.slots.findIndex((x) => x && x.uid === c.uid);
  if (now < 0) { await drag(page, `cup-${w}`, 'trash'); return false; }
  await drag(page, `cup-${w}`, `seat-${now}`, 20);
  return true;
}

async function frameCheck(page, tag) {
  const bad = await page.evaluate(() => {
    const fr = document.querySelector('.frame').getBoundingClientRect();
    const out = [];
    const sel = '.st, .wslot, .seat .bubble, .seat .ring, .hud > *, .card button, .card .receipt, .card .dc-board, .sub';
    for (const e of document.querySelectorAll(sel)) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue;
      if (r.left < fr.left - 1 || r.right > fr.right + 1 || r.top < fr.top - 1 || r.bottom > fr.bottom + 1) out.push(`${e.className.baseVal ?? e.className} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    return out;
  });
  check(`${tag} frame`, bad.length === 0, bad.slice(0, 4).join(' | '));
}
async function hantCheck(page, tag) {
  const texts = await page.evaluate(() => [...window.__texts]);
  const bad = [];
  for (const t of texts) for (const ch of t) if (HANS_ONLY.has(ch) || (SUSPECT && SUSPECT.has && SUSPECT.has(ch))) bad.push(`${ch} in "${t.slice(0, 20)}"`);
  check(`${tag} no Simplified on screen (${texts.length} strings)`, bad.length === 0, bad.slice(0, 5).join(' | '));
}
async function clickSel(page, sel) {
  await page.waitForSelector(sel);
  await page.click(sel, { force: true });
  await sleep(80);
}
const shot = (page, name) => page.screenshot({ path: `${out}shop-${name}.png` });

async function guideRun(page, tag) {
  await clickSel(page, '.start-card .go');
  await page.waitForSelector('.day-card .go');
  await shot(page, `${tag}-day1-card`);
  await clickSel(page, '.day-card .go');
  await waitFor(page, () => window.__shop.state.slots.some(Boolean));
  const t0 = Date.now();
  await sleep(300);
  const fingerShown = await page.evaluate(() => !document.querySelector('.finger').hidden);
  await shot(page, `${tag}-guide-1`);
  await tap(page, 'rack');
  await tap(page, 'tea-black');
  await tap(page, 'top-pearl');
  await sleep(650);
  await drag(page, 'cup-0', 'sealer');
  await waitFor(page, () => window.__shop.state.work[0] && window.__shop.state.work[0].sealed);
  await shot(page, `${tag}-guide-sealed`);
  const g = await st(page);
  const custSlot = g.slots.findIndex(Boolean);
  await drag(page, 'cup-0', `seat-${custSlot}`, 20);
  await waitFor(page, () => window.__shop.state.slots.some((c) => c && c.kind === 'oke'), null, 5000);
  await sleep(500);
  await shot(page, `${tag}-guide-oke`);
  const s2 = await st(page);
  const okeSlot = s2.slots.findIndex((c) => c && c.kind === 'oke');
  await swipe(page, okeSlot);
  await waitFor(page, () => window.__shop.state.phase === 'open', null, 4000).catch(() => {});
  const s3 = await st(page);
  const secs = (Date.now() - t0) / 1000;
  check(`${tag} guide: finger shown, drink served, 奧客 swiped away, shop open (${secs.toFixed(1)} s of automation)`,
    fingerShown && s3.phase === 'open' && s3.stats.correct === 1 && s3.stats.oke.gun === 1, `phase ${s3.phase} correct ${s3.stats.correct} gun ${s3.stats.oke.gun}`);
  await sleep(700);
  await shot(page, `${tag}-guide-done`);
}

// handle every 奧客 at the counter: hold the 250-cup customer, swipe the rest
async function handleOke(page, flags) {
  const s = await st(page);
  for (let i = 0; i < s.slots.length; i++) {
    const c = s.slots[i];
    if (!c || c.kind !== 'oke' || c.converted) continue;
    if (c.oke === 'c250') {
      const before = s.stats.prepay;
      await hold(page, i);
      await sleep(250);
      const a = await st(page);
      if (a.stats.oke.take > s.stats.oke.take) { flags.stamped = a.stats.prepay - before; await shot(page, `${flags.tag}-stamp-250`); }
    } else {
      await swipe(page, i);
      const a = await st(page);
      if (a.stats.oke.gun > s.stats.oke.gun) flags.swiped += 1;
    }
    return true;
  }
  return false;
}

async function playDay(page, flags, { untilCorrect = Infinity, shotsAt = [] } = {}) {
  let lastShot = 0;
  for (let guard = 0; guard < 400; guard++) {
    const s = await st(page);
    if (s.phase === 'closed') break;
    if (s.stats.correct >= untilCorrect) break;
    if (shotsAt.length && s.clock > shotsAt[0]) { await shot(page, `${flags.tag}-${shotsAt.shift() === lastShot ? 'x' : 'play'}-${Math.round(s.clock / 1000)}s`); lastShot = 1; }
    if (await handleOke(page, flags)) continue;
    const slot = s.slots.findIndex((c) => c && c.order && (c.kind === 'normal' || c.converted));
    if (slot >= 0) { await makeAndServe(page, slot).catch((e) => errors.push(`${flags.tag} makeAndServe: ${e.message}`)); continue; }
    if (s.pot.scoops < 4 && !s.pot.cookingUntil) await tap(page, 'pot');
    await sleep(200);
  }
}

// ---------- 390x844: the full run ----------
{
  const tag = '390';
  const { context, page } = await newPage(390, 844, tag);
  await page.goto(`${base}/shop.html?reset=1&seed=7&lang=zh&mute=1&len=95000`);
  await page.waitForSelector('.start-card .go');
  await shot(page, `${tag}-start`);
  await frameCheck(page, `${tag} start`);
  await guideRun(page, tag);
  await frameCheck(page, `${tag} play`);
  const flags = { tag, stamped: 0, swiped: 1 };
  await playDay(page, flags, { untilCorrect: 6, shotsAt: [] });
  const mid = await st(page);
  check(`${tag} day 1: ≥ 5 drinks made and served correctly after the guide`, mid.stats.correct - 1 >= 5, `correct ${mid.stats.correct - 1}, wrong ${mid.stats.wrong}`);
  await shot(page, `${tag}-day1-play`);
  await playDay(page, flags, { shotsAt: [] });
  const end = await st(page);
  check(`${tag} day 1: 奧客 cursed away by swiping`, flags.swiped >= 1 && end.stats.oke.gun >= 1, `swipes ${flags.swiped}, gun ${end.stats.oke.gun}`);
  check(`${tag} day 1: the 250-cup customer stamped (hold → ticket, prepay)`, flags.stamped > 0, `prepay ${flags.stamped}`);
  await page.waitForSelector('.receipt-card .go', { timeout: 8000 });
  await sleep(300);
  await shot(page, `${tag}-day1-receipt`);
  await frameCheck(page, `${tag} receipt`);
  const sv = await page.evaluate(() => window.__shop.save);
  check(`${tag} day 1 goal met, saved (wallet ${sv.wallet}, day ${sv.day})`, sv.day === 2 && sv.wallet >= 600);
  const stored = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('250cups.shop.v1')); } catch { return null; } });
  check(`${tag} save in localStorage 250cups.shop.v1`, stored && stored.day === 2 && stored.wallet === sv.wallet);
  await clickSel(page, '.receipt-card .go');
  await page.waitForSelector('.shop-card');
  await shot(page, `${tag}-shop`);
  await frameCheck(page, `${tag} shop`);
  const can = await page.$('.up.can .up-buy');
  let bought = null;
  if (can) {
    bought = await page.evaluate(() => document.querySelector('.up.can').dataset.id);
    await can.click({ force: true });
    await sleep(200);
  }
  const sv2 = await page.evaluate(() => window.__shop.save);
  check(`${tag} upgrade bought (${bought})`, !!bought && sv2.upgrades.includes(bought) && sv2.wallet < sv.wallet, `wallet ${sv.wallet} → ${sv2.wallet}`);
  await shot(page, `${tag}-shop-bought`);
  await clickSel(page, '.shop-card .go');
  await page.waitForSelector('.day-card .go');
  await shot(page, `${tag}-day2-card`);
  await clickSel(page, '.day-card .go');
  await sleep(300);
  const d2 = await st(page);
  const cfg = await page.evaluate(() => window.__shop.shop.cfg);
  check(`${tag} day 2 starts with the upgrade`, d2.phase === 'open' && (await page.evaluate(() => window.__shop.state.day)) === 2 && !!cfg, `upgrades in cfg: ${JSON.stringify(cfg).slice(0, 80)}`);
  const f2 = { tag: `${tag}-d2`, stamped: 0, swiped: 0 };
  await playDay(page, f2, { untilCorrect: 2 });
  await shot(page, `${tag}-day2-play`);
  await frameCheck(page, `${tag} day 2`);
  await hantCheck(page, tag);
  await context.close();
}

// ---------- days 3–5 at 390x844 (screenshots, stations, frame) ----------
for (const day of [3, 4, 5]) {
  const tag = `390-d${day}`;
  const { context, page } = await newPage(390, 844, tag);
  await page.goto(`${base}/shop.html?reset=1&day=${day}&seed=${day}&lang=zh&mute=1`);
  await page.waitForSelector('.start-card .go');
  await clickSel(page, '.start-card .go');
  await page.waitForSelector('.day-card .go');
  await shot(page, `${tag}-card`);
  await clickSel(page, '.day-card .go');
  const flags = { tag, stamped: 0, swiped: 0 };
  const t0 = Date.now();
  while (Date.now() - t0 < 14000) {
    const s = await st(page);
    if (await handleOke(page, flags)) continue;
    const slot = s.slots.findIndex((c) => c && c.order && (c.kind === 'normal' || c.converted));
    if (slot >= 0) await makeAndServe(page, slot).catch(() => {}); else await sleep(200);
  }
  await sleep(1500);
  await shot(page, `${tag}-play`);
  const s = await st(page);
  const stations = await page.evaluate(() => [...document.querySelectorAll('.st')].map((e) => e.className.replace('st ', '')));
  check(`${tag} plays (served ${s.stats.correct}, stations: ${stations.length})`, s.stats.correct >= 1 && stations.length >= 9);
  await frameCheck(page, tag);
  await hantCheck(page, tag);
  await context.close();
}

// ---------- 360x640: guide + a couple of drinks ----------
{
  const tag = '360';
  const { context, page } = await newPage(360, 640, tag);
  await page.goto(`${base}/shop.html?reset=1&seed=11&mute=1&len=60000`);
  await page.waitForSelector('.start-card .go');
  await shot(page, `${tag}-start`);
  await frameCheck(page, `${tag} start`);
  await guideRun(page, tag);
  const flags = { tag, stamped: 0, swiped: 1 };
  await playDay(page, flags, { untilCorrect: 3 });
  const s = await st(page);
  check(`${tag} drinks served after the guide`, s.stats.correct - 1 >= 2, `correct ${s.stats.correct - 1}`);
  await shot(page, `${tag}-play`);
  await frameCheck(page, `${tag} play`);
  await hantCheck(page, tag);
  await context.close();
}

await browser.close();

// ---------- voice mode (?input=voice): a fake microphone shouting clears the guide's 奧客 ----------
{
  const { writeVoiceWav } = await import('./voice-wav.mjs');
  const wav = `${out}shop-voice.wav`;
  writeVoiceWav(wav);
  const vb = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] });
  const context = await vb.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-TW', permissions: ['microphone'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`voice pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`voice console: ${m.text()}`); });
  await page.goto(`${base}/shop.html?reset=1&seed=7&lang=zh&input=voice`);
  await clickSel(page, '.start-card .go');
  await clickSel(page, '.voice-card .allow');
  await clickSel(page, '.day-card .go');
  await waitFor(page, () => window.__shop.state.slots.some(Boolean));
  await tap(page, 'rack'); await tap(page, 'tea-black'); await tap(page, 'top-pearl');
  await sleep(650);
  await drag(page, 'cup-0', 'sealer');
  await waitFor(page, () => window.__shop.state.work[0] && window.__shop.state.work[0].sealed);
  const s = await st(page);
  await drag(page, 'cup-0', `seat-${s.slots.findIndex(Boolean)}`, 20);
  let ok = false;
  try { await waitFor(page, () => window.__shop.state.phase === 'open' && window.__shop.state.stats.oke.gun >= 1, null, 15000); ok = true; } catch { /* no shout */ }
  await shot(page, 'voice-open');
  check('voice mode: a shout sends the 奧客 flying (滾) and the shop opens', ok);
  await vb.close();
}

check('no console errors / page errors', errors.length === 0, errors.slice(0, 6).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed; screenshots in ${out}`);
process.exit(failed.length ? 1 : 0);
