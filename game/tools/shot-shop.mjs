// shot-shop.mjs — quick screenshots of the landscape shop (shop.html) for art review: drives the page through
// window.__shop (no real input) to a busy moment of a given day and saves tools/shots/shop-look-*.png.
// Usage: (serve game/ first) node tools/shot-shop.mjs [baseUrl] [--day=3] [--w=844] [--h=390] [--up=a,b] [--t=20000]
import { mkdirSync } from 'node:fs';
const pw = (await import('./pw.mjs')).default;
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const base = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765').replace(/\/$/, '');
const day = Number(arg('day', 3));
const W = Number(arg('w', 844));
const H = Number(arg('h', 390));
const ups = arg('up', '');
const T = Number(arg('t', 20000));
const out = new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: 'zh-TW' });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript((u) => { try { localStorage.setItem('250cups.shop.v1', JSON.stringify({ v: 1, day: 1, wallet: 0, fame: 300, upgrades: u ? u.split(',') : [], best: {}, guideDone: true })); } catch { /* */ } }, ups);
await page.goto(`${base}/shop.html?day=${day}&seed=4&mute=1&lang=${arg('lang', 'zh')}`);
await page.click('.start-card .go', { force: true });
await page.waitForSelector('.day-card .go');
await page.screenshot({ path: `${out}shop-look-d${day}-card.png` });
await page.click('.day-card .go', { force: true });
// a scripted helper: make whatever is ordered via the engine (no pointer input), so the screen fills up
await page.evaluate((T) => new Promise((res) => {
  const t0 = performance.now();
  const loop = () => {
    const sh = window.__shop.shop;
    const s = sh.state;
    const p = sh.pending();
    if (s.work.filter(Boolean).length < 2 && p.length) {
      const { it } = p[Math.floor(Math.random() * p.length)];
      const r = sh.takeCup();
      if (r.ok) { sh.addTea(it.tea); it.toppings.forEach((k) => sh.addTopping(k)); }
    }
    const ready = s.work.findIndex((c) => c && c.tea && !c.sealingUntil && s.t > c.pourUntil);
    if (ready >= 0 && Math.random() < 0.1) sh.seal(ready);
    if (s.pot.scoops < 3 && !s.pot.cookingUntil) sh.cook();
    if (performance.now() - t0 > T) return res();
    setTimeout(loop, 300);
  };
  loop();
}), T);
await page.screenshot({ path: `${out}shop-look-d${day}.png` });
const slot = await page.evaluate(() => { const s = window.__shop.state.slots; const i = s.findIndex((c) => c && c.kind === 'oke'); return i >= 0 ? i : s.findIndex(Boolean); });
if (slot >= 0) {
  await page.evaluate((i) => { window.__shop.shop.answer(i, 'gun'); }, slot);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}shop-look-d${day}-fans.png` });
}
console.log(errs.length ? errs.join('\n') : 'no errors');
await browser.close();
