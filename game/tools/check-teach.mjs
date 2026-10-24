// check-teach.mjs — first-time 奧客 demos in the v3 shop (shop.html): the day freezes on a new pest with a spotlight and a
// finger demo of its best gesture; the 250-cup customer is taught with a hold (gold ring) and a real press-and-hold
// stamps it, ends the demo and the day runs on. A second visit with the type already taught is not frozen.
//   node tools/check-teach.mjs [base] [--out=dir]   (server running; screenshots teach-*.png)
import { mkdirSync } from 'node:fs';
const pw = (await import('./pw.mjs')).default;
const base = (process.argv.find((a) => /^https?:/.test(a)) || 'http://localhost:8765').replace(/\/$/, '');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const out = outArg ? outArg.slice(6).replace(/\/?$/, '/') : new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) fails++; };

const browser = await pw.chromium.launch();
const errors = [];
async function open(save) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: false });
  await ctx.addInitScript((sv) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('250cups.shop.v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); } } catch { /* */ } }, save);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/shop.html?lang=zh&mute=1&seed=3&speed=3`);
  await page.waitForSelector('.start-card .go'); await page.$eval('.start-card .go', (b) => b.click());
  await page.waitForSelector('.day-card .go'); await page.$eval('.day-card .go', (b) => b.click());
  return { ctx, page };
}
const save = { v: 1, day: 1, wallet: 0, fame: 0, upgrades: [], best: {}, guideDone: true, taught: ['one'] };

{
  const { ctx, page } = await open(save);
  await page.waitForFunction(() => window.__shop.state && window.__shop.state.teach, null, { timeout: 60000 });
  const t = await page.evaluate(() => ({ ...window.__shop.state.teach, clock: window.__shop.state.clock }));
  check('the 250-cup customer is taught on its first visit', t.oke === 'c250' && t.key === 'take', JSON.stringify(t));
  await sleep(700);
  const spot = await page.evaluate(() => { const s = document.querySelector('.spot'); const f = document.querySelector('.finger'); return { spot: !s.hidden, finger: !f.hidden && f.classList.contains('hold') }; });
  check('spotlight on the customer and a press-and-hold finger demo', spot.spot && spot.finger, JSON.stringify(spot));
  await page.screenshot({ path: `${out}teach-250-demo.png` });
  const clock2 = await page.evaluate(() => window.__shop.state.clock);
  check('the day is frozen while the demo runs', clock2 === t.clock, `${t.clock} → ${clock2}`);
  // a stray tap on a station does nothing while teaching
  const before = await page.evaluate(() => window.__shop.state.work.filter(Boolean).length);
  const rack = await page.evaluate(() => window.__shop.where('rack'));
  await page.mouse.click(rack.x, rack.y);
  await sleep(200);
  check('other actions wait until the new 奧客 is answered', (await page.evaluate(() => window.__shop.state.work.filter(Boolean).length)) === before);
  // the real gesture: press and hold on the customer
  const p = await page.evaluate((i) => window.__shop.where(`seat-${i}`), t.slot);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await sleep(260);
  await page.screenshot({ path: `${out}teach-250-holding.png` });
  await sleep(240);
  await page.mouse.up();
  await sleep(350);
  const after = await page.evaluate(() => ({ teach: window.__shop.state.teach, take: window.__shop.state.stats.oke.take, prepay: window.__shop.state.stats.prepay, taught: window.__shop.save.taught }));
  check('holding stamps the 250-cup customer: prepay, the demo ends', !after.teach && after.take === 1 && after.prepay > 0, JSON.stringify(after));
  await page.screenshot({ path: `${out}teach-250-stamped.png` });
  check('the type is saved as taught', after.taught.includes('c250'));
  await sleep(1500);
  const clock3 = await page.evaluate(() => window.__shop.state.clock);
  check('the day runs again', clock3 > clock2, `${clock2} → ${clock3}`);
  await ctx.close();
}
{
  const { ctx, page } = await open({ ...save, taught: ['one', 'c250'] });
  await page.waitForFunction(() => window.__shop.state.slots.some((c) => c && c.oke === 'c250'), null, { timeout: 60000 });
  await sleep(300);
  check('already taught: no freeze on the next visit', (await page.evaluate(() => window.__shop.state.teach)) === null);
  await ctx.close();
}
{
  // the day card shows each new 奧客 with its gesture badge
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${base}/shop.html?reset=1&day=1&lang=zh&mute=1`);
  await page.waitForSelector('.start-card .go'); await page.$eval('.start-card .go', (b) => b.click());
  await page.waitForSelector('.day-card');
  await sleep(600);
  const n = await page.evaluate(() => document.querySelectorAll('.day-card .nc-gest').length);
  check('day card: a gesture badge on every new 奧客', n >= 2, `${n} badges`);
  await page.screenshot({ path: `${out}teach-daycard.png` });
  await ctx.close();
}
check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(fails ? `${fails} check(s) failed` : 'all teach checks passed');
process.exit(fails ? 1 : 0);
