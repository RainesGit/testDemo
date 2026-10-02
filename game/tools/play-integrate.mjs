// End-to-end smoke: open index.html at 390x844, start the shop, play ~20s with J/K/L,
// screenshot along the way, fail on any console error / page error.
// Usage: (serve /home/user/testDemo/game on :8765) node tools/play-integrate.mjs [baseUrl]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const base = process.argv[2] || 'http://127.0.0.1:8765';
const out = new URL('./shots/', import.meta.url).pathname;
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`); });

const shot = (name) => page.screenshot({ path: `${out}integrate-${name}.png` });
const st = () => page.evaluate(() => { const s = window.__250.game.state; return { phase: s.phase, queue: s.queue, combo: s.combo, aura: s.aura, fury: s.fury, t: s.timeLeftMs, cur: s.current && { key: s.current.customer.key, id: s.current.customer.id, waited: s.current.patienceMaxMs - s.current.patienceMs } }; });
const KEYMAP = { gun: 'j', shut: 'k', take: 'l' };

await page.goto(`${base}/index.html?debug&lang=zh`);
await page.waitForSelector('.overlay.start:not(.hidden) .big-btn');
await shot('01-start');
await page.click('.overlay.start .big-btn', { force: true });
await page.waitForTimeout(500);
await shot('02-playing');

const t0 = Date.now();
let n = 0, taken = new Set(), stats = { presses: 0, wrong: 0, polite: 0, rage: false, milestone: false };
const snapAt = { hit: false, rage: false, polite: false, milestone: false };
let letTimeout = true;
while (Date.now() - t0 < 20000) {
  const s = await st();
  if (s.phase === 'over') break;
  if (s.phase === 'rage') {
    stats.rage = true;
    await page.keyboard.down('j'); await page.keyboard.up('j'); stats.presses++;
    if (!snapAt.rage) { snapAt.rage = true; await page.waitForTimeout(150); await shot('05-rage'); }
    await page.waitForTimeout(120);
    continue;
  }
  if (s.cur && !taken.has(s.cur.id + ':' + n)) {
    // Let exactly one customer time out to see the forced-polite state.
    if (letTimeout && n === 6) {
      letTimeout = false;
      await page.waitForFunction(() => window.__250.game.state.stats.polite > 0, null, { timeout: 5000 });
      stats.polite++;
      await page.waitForTimeout(150);
      await shot('04-polite');
      n++;
      continue;
    }
    if (s.cur.waited < 250) { await page.waitForTimeout(60); continue; }
    taken.add(s.cur.id + ':' + n);
    const wrong = n % 7 === 3;
    const key = wrong ? (s.cur.key === 'gun' ? 'shut' : 'gun') : s.cur.key;
    const hold = n % 4 === 0 ? 900 : n % 4 === 1 ? 400 : 60;
    await page.keyboard.down(KEYMAP[key]);
    await page.waitForTimeout(hold);
    await page.keyboard.up(KEYMAP[key]);
    stats.presses++; if (wrong) stats.wrong++;
    n++;
    if (!snapAt.hit && n >= 2) { snapAt.hit = true; await page.waitForTimeout(60); await shot('03-hit'); }
    const after = await st();
    if (!snapAt.milestone && after.queue >= 10) {
      const shown = await page.$('.milestone:not(.hidden)');
      if (shown) { snapAt.milestone = true; stats.milestone = true; await shot('06-milestone'); }
    }
  }
  await page.waitForTimeout(40);
}
const mid = await st();
await shot('07-after20s');

// Switch to English mid-game, toggle bleep, then fast-forward to the end of the round.
await page.click('.tog-lang');
await page.click('.tog-bleep');
await page.waitForTimeout(300);
await shot('08-en-playing');
await page.evaluate(() => { const g = window.__250.game; for (let i = 0; i < 2000 && g.state.phase !== 'over'; i++) g.tick(100); });
await page.waitForSelector('.overlay.summary:not(.hidden)', { timeout: 5000 });
await page.waitForTimeout(300);
await shot('09-en-summary');
await page.click('.tog-lang');
await page.waitForTimeout(200);
await shot('10-zh-summary');
// Play again works
await page.click('.overlay.summary .big-btn', { force: true });
await page.waitForTimeout(300);
const again = await st();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

console.log(JSON.stringify({ stats, mid, againPhase: again.phase, overflow, errors }, null, 1));
await browser.close();
if (errors.length || overflow || again.phase !== 'playing') process.exit(1);
