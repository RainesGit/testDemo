// check-shop.mjs — gameplay v3 landscape shop page (shop.html) with real pointer input in Chromium (Playwright).
// (first-time 奧客 demos are off here, ?teach=0: tools/check-teach.mjs covers them)
//   844x390 (a phone in landscape; the full run):
//     1. the day 1 hands-on guide by doing what the finger shows (tap the cup rack → tea → pearls → drag to the sealer →
//        the sealed cup lands on the shelf → drag it to the customer → swipe the 奧客)
//     2. customers walk in from the far corner (small, then bigger), fans come running after a curse
//     3. day 1 (shortened with ?len): make and serve drinks from the order bubbles (≥ 5 correct), swipe 奧客 away,
//        stamp the 250-cup customer by holding (the number ticket, the prepay)
//     4. the receipt (cups sold), the upgrade shop: buy an upgrade; day 2 starts with it; a multi-cup order served
//   844x390 days 3–5 (?day=N): stations, play, the J key on an 奧客, frame, no Simplified; the 10.9 stations by real input:
//     milk tea (tap the pump), shaking (drag the cup onto the shaker), cheese foam, lemon slices + refilling the tray on
//     the board, a 雞蛋糕 bag (tap the iron, drag the ready bag to the customer), a big order packed into the carry bag
//     (drag each sealed cup onto the bag, then the bag to the customer); when the random orders bring no snack / big
//     order in time, one waiting customer's order is turned into one through window.__shop (setup only, the play is real)
//   640x360: the guide and a few drinks
//   1280x720: a rich save; close day 2 early from the pause sheet, buy Lv2 and automation levels in the upgrade shop
//     (pot Lv2–4: the auto-refill hopper, tea Lv2–3: the manifold, sealer Lv2–3: a second sealer, the part-timer), check
//     the stations changed and screenshot them; day 3 with the part-timer making cups
//   390x844 (portrait): the rotate-your-phone card, "play anyway", then the guide's first steps on the small stage
//   voice mode (?input=voice) with a fake microphone: a shout sends the guide's 奧客 flying
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

async function newPage(w, h, tag, { save } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'zh-TW' });
  await context.addInitScript(COLLECT);
  if (save) await context.addInitScript((sv) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('250cups.shop.v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); } } catch { /* */ } }, save);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
  return { context, page };
}

const st = (page) => page.evaluate(() => {
  const s = window.__shop.state;
  return s && JSON.parse(JSON.stringify({ phase: s.phase, clock: s.clock, t: s.t, earned: s.earned, slots: s.slots, incoming: s.incoming.map(Boolean), work: s.work, shelf: s.shelf, selected: s.selected, pot: s.pot, stats: s.stats, guide: s.guide, stars: s.stars,
    queue: s.queue.map((c) => ({ uid: c.uid, u: c.u, phase: c.phase, fan: c.fan, run: c.run, kind: c.kind })), cfg: s.cfg,
    lemon: s.lemon, snack: s.snack, bag: s.bag ? s.bag.cups.length : -1, shake: !!s.def.shake }));
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
  const step = Math.max(24, p.w * 0.45);
  await page.mouse.move(p.x - p.w * 0.4, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) { await page.mouse.move(p.x - p.w * 0.4 + i * step, p.y - i * 5); await sleep(10); }
  await page.mouse.up();
  await sleep(120);
}
async function hold(page, slot) {
  const p = await where(page, `seat-${slot}`);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await sleep(520);
  await page.mouse.up();
  await sleep(150);
}
async function waitFor(page, fn, arg, timeout = 15000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 50 });
}
const shot = (page, name) => page.screenshot({ path: `${out}shop-${name}.png` });

/** Make one item of the customer in `slot` and drag it over; returns true when the cup was served. */
async function makeOne(page, slot, flags, nth = 0) {
  let s = await st(page);
  const c = s.slots[slot];
  if (!c || !c.order) return false;
  const open = c.got.map((g, i) => (g ? -1 : i)).filter((i) => i >= 0);
  const k = open[nth] ?? open[0];
  if (k == null) return false;
  const it = c.order.items[k];
  const pearls = it.toppings.filter((x) => x === 'pearl').length;
  if (pearls && s.pot.scoops < pearls) {
    if (!s.pot.cookingUntil) await tap(page, 'pot');
    await waitFor(page, (n) => window.__shop.state.pot.scoops >= n, pearls, 12000);
  }
  const bagIt = !!(c.order.big && s.bag >= 0);
  // a cup the part-timer already put on the shelf?
  const ready = s.shelf.findIndex((cup) => cup && cup.sealed && cup.tea === it.tea && [...cup.toppings].sort().join() === [...it.toppings].sort().join() && cup.ice === it.ice && cup.sugar === it.sugar &&
    !!cup.milk === !!it.milk && !!cup.foam === !!it.foam && !!cup.lemon === !!it.lemon);
  if (ready >= 0) { await drag(page, `shelf-${ready}`, bagIt ? 'bag' : `seat-${slot}`, bagIt ? 0 : 10); return bagIt ? 'packed' : true; }
  if (s.work.every(Boolean)) { await drag(page, `cup-${s.work.findIndex(Boolean)}`, 'trash'); s = await st(page); }
  await tap(page, 'rack');
  s = await st(page);
  const w = s.selected;
  if (w == null) return false;
  const id = s.work[w].id;
  await tap(page, `tea-${it.tea}`);
  if (it.milk) { await tap(page, 'milk'); if (flags) flags.milk = (flags.milk || 0) + 1; }
  for (const x of it.toppings) await tap(page, `top-${x}`);
  if (it.lemon) {
    let lm = await page.evaluate(() => window.__shop.state.lemon);
    if (lm.slices <= 0) {
      // the tray is empty: slice a new batch on the board
      if (!lm.slicingUntil) await tap(page, 'board');
      await waitFor(page, () => window.__shop.state.lemon.slices > 0, null, 6000);
    }
    await tap(page, 'lemon');
    lm = await page.evaluate(() => window.__shop.state.lemon);
    if (flags && !flags.refilled && lm.slices < lm.max && !lm.slicingUntil) {
      await tap(page, 'board');
      await waitFor(page, () => window.__shop.state.lemon.slices === window.__shop.state.lemon.max, null, 6000).catch(() => {});
      const st2 = await page.evaluate(() => window.__shop.state.stats.sliced);
      if (st2 >= 1) { flags.refilled = st2; await shot(page, `${flags.tag}-lemon-board`); }
    }
  }
  const iceTaps = s.cfg.iceSmart ? (it.ice ? 1 : 0) : it.ice;
  for (let i = 0; i < iceTaps; i++) await tap(page, 'ice');
  for (let i = 0; i < it.sugar; i++) await tap(page, 'sugar');
  if (it.foam) { await tap(page, 'foam'); if (flags) flags.foam = (flags.foam || 0) + 1; }
  await sleep(Math.max(s.cfg.pourMs, it.milk ? s.cfg.milkMs : 0, it.foam ? s.cfg.foamMs : 0) + 80);
  if (s.shake && !s.cfg.autoShake) {
    // the shaker: drag the cup onto it, it shakes, the cup comes back frothy
    await waitFor(page, () => !window.__shop.state.work.some((x) => x && x.shakingUntil), null, 6000);
    await drag(page, `cup-${w}`, 'shaker');
    await waitFor(page, (cid) => window.__shop.state.work.some((x) => x && x.id === cid && x.shaken), id, 6000);
    if (flags) { flags.shaken = (flags.shaken || 0) + 1; if (flags.shaken === 1) await shot(page, `${flags.tag}-shaken`); }
    await sleep(260);
  }
  await waitFor(page, (n) => window.__shop.state.work.filter((x) => x && x.sealingUntil && !x.sealed && x.sealer >= 0).length < n, s.cfg.sealers, 6000);
  await drag(page, `cup-${w}`, 'sealer');
  await waitFor(page, (cid) => [...window.__shop.state.work, ...window.__shop.state.shelf].some((x) => x && x.id === cid && x.sealed), id, 6000);
  await sleep(260);
  s = await st(page);
  const now = s.slots.findIndex((x) => x && x.uid === c.uid);
  const onShelf = s.shelf.findIndex((x) => x && x.id === id);
  const from = onShelf >= 0 ? `shelf-${onShelf}` : `cup-${s.work.findIndex((x) => x && x.id === id)}`;
  if (onShelf >= 0 && flags) flags.shelved = (flags.shelved || 0) + 1;
  if (now < 0) { await drag(page, from, 'trash'); return false; }
  if (bagIt) { await drag(page, from, 'bag'); return 'packed'; }
  await drag(page, from, `seat-${now}`, 10);
  return true;
}
/** The snack bag for the customer in slot: start the iron if no bag is ready, then drag a bag over. */
async function serveSnack(page, slot, flags) {
  let s = await st(page);
  if (s.snack.ready <= 0) {
    if (!s.snack.cookingUntil) await tap(page, 'waffle');
    await waitFor(page, () => window.__shop.state.snack.ready > 0, null, 12000);
    await shot(page, `${flags.tag}-snack-ready`);
  }
  s = await st(page);
  const uid = s.slots[slot] && s.slots[slot].uid;
  const now = s.slots.findIndex((x) => x && x.uid === uid);
  if (now < 0) return false;
  await drag(page, 'snack', `seat-${now}`, 10);
  const a = await st(page);
  if (a.stats.snacks > s.stats.snacks) flags.snacks = (flags.snacks || 0) + 1;
  return true;
}
async function serveCustomer(page, slot, flags) {
  const s0 = await st(page);
  const c = s0.slots[slot];
  if (!c || !c.order) return false;
  const big = !!(c.order.big && s0.bag >= 0);
  let packed = 0;
  if (c.order.snack && !c.gotSnack && s0.snack) await serveSnack(page, slot, flags).catch(() => false);
  for (let i = 0; i < c.order.count; i++) {
    const ok = await makeOne(page, slot, flags, big ? packed : 0).catch(async (e) => {
      // closing time mid-drink is fine; anything else while the shop is open is an error
      const ph = await page.evaluate(() => window.__shop.state.phase).catch(() => 'closed');
      if (ph === 'open') errors.push(`${flags.tag} makeOne: ${e.message.split('\n')[0]}`);
      return false;
    });
    const s = await st(page);
    const still = s.slots.findIndex((x) => x && x.uid === c.uid);
    if (ok === 'packed') packed += 1;
    if (!ok || still < 0) break;
    if (big && packed === c.order.count) {
      // every cup of the big order is in the carry bag: hand the bag over
      await shot(page, `${flags.tag}-bag-packed`);
      const b0 = s.stats.bags;
      await drag(page, 'bag', `seat-${still}`, 10);
      const a = await st(page);
      if (a.stats.bags > b0) { flags.bags = (flags.bags || 0) + 1; await shot(page, `${flags.tag}-bag-served`); }
      break;
    }
    if (c.order.count >= 2 && i === 0 && !flags.tickShot) { flags.tickShot = true; await sleep(150); await shot(page, `${flags.tag}-multi-tick`); }
    slot = still;
  }
  const s = await st(page);
  if (c.order.count >= 2 && s.stats.orders > s0.stats.orders && !s.slots.some((x) => x && x.uid === c.uid)) {
    flags.multi = (flags.multi || 0) + 1;
    if (flags.multi === 1) await shot(page, `${flags.tag}-multi-paid`);
  }
  return true;
}

async function frameCheck(page, tag) {
  // a screen shake (the .shaker wrapper, ≤ 320 ms) moves the scene a few px for effect: measure once it has settled
  await page.waitForFunction(() => !document.querySelector('.shaker.shake'), null, { timeout: 1500 }).catch(() => {});
  const bad = await page.evaluate(() => {
    const fr = document.querySelector('.frame').getBoundingClientRect();
    const o = [];
    const sel = '.st, .wslot, .seat .bubble, .seat .ring, .hud > *, .card button, .card .receipt, .card .dc-board, .card .up, .sub, .pillar .pp';
    for (const e of document.querySelectorAll(sel)) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue;
      if (r.left < fr.left - 1 || r.right > fr.right + 1 || r.top < fr.top - 1 || r.bottom > fr.bottom + 1) o.push(`${e.className.baseVal ?? e.className} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    const aspect = fr.width / fr.height;
    if (Math.abs(aspect - 16 / 9) > 0.02) o.push(`frame aspect ${aspect.toFixed(3)}`);
    return o;
  });
  check(`${tag} frame (16:9, everything inside)`, bad.length === 0, bad.slice(0, 4).join(' | '));
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

async function guideRun(page, tag) {
  await clickSel(page, '.start-card .go');
  await page.waitForSelector('.day-card .go');
  await shot(page, `${tag}-day1-card`);
  await clickSel(page, '.day-card .go');
  await sleep(500);
  const walking = await st(page);
  const fingerShown = await page.evaluate(() => !document.querySelector('.finger').hidden);
  await shot(page, `${tag}-guide-1`);
  check(`${tag} guide: the first customer walks in (not at the counter yet)`, walking.queue.length === 1 && walking.queue[0].phase === 'walk' && walking.slots.every((x) => !x));
  await tap(page, 'rack');
  await tap(page, 'tea-black');
  await tap(page, 'top-pearl');
  await sleep(650);
  await waitFor(page, () => window.__shop.state.slots.some(Boolean), null, 8000);
  await drag(page, 'cup-0', 'sealer');
  await waitFor(page, () => window.__shop.state.shelf[0] && window.__shop.state.shelf[0].sealed, null, 5000);
  await sleep(250);
  await shot(page, `${tag}-guide-shelf`);
  const g = await st(page);
  check(`${tag} guide: the sealed cup moved to the shelf and freed its slot`, g.shelf[0] && g.work.every((x) => !x));
  const custSlot = g.slots.findIndex(Boolean);
  await drag(page, 'shelf-0', `seat-${custSlot}`, 10);
  await sleep(1200);
  await shot(page, `${tag}-guide-oke-walk`);
  await waitFor(page, () => window.__shop.state.slots.some((c) => c && c.kind === 'oke'), null, 12000);
  await sleep(500);
  await shot(page, `${tag}-guide-oke`);
  const s2 = await st(page);
  const okeSlot = s2.slots.findIndex((c) => c && c.kind === 'oke');
  await swipe(page, okeSlot);
  await waitFor(page, () => window.__shop.state.phase === 'open', null, 4000).catch(() => {});
  const s3 = await st(page);
  check(`${tag} guide: finger shown, drink served from the shelf, 奧客 swiped away, shop open`,
    fingerShown && s3.phase === 'open' && s3.stats.correct === 1 && s3.stats.oke.gun === 1, `phase ${s3.phase} correct ${s3.stats.correct} gun ${s3.stats.oke.gun}`);
  await sleep(500);
  const fans = s3.queue.filter((c) => c.fan && c.run).length;
  const runners = await page.evaluate(() => document.querySelectorAll('.walker.m-run').length);
  await shot(page, `${tag}-fans`);
  check(`${tag} fans come running from the corner after the curse (${fans} in the state, ${runners} running on screen)`, fans >= 4 && runners >= 2);
}

// handle every 奧客 at the counter: hold the 250-cup customer, swipe the rest (or press J)
async function handleOke(page, flags, { key = false } = {}) {
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
    } else if (key) {
      const left = s.slots.findIndex((x) => x && x.kind === 'oke' && !x.converted);
      await page.keyboard.press('j');
      await sleep(200);
      const a = await st(page);
      if (a.stats.oke.gun > s.stats.oke.gun && !a.slots[left]) flags.keyed = (flags.keyed || 0) + 1;
    } else {
      await swipe(page, i);
      const a = await st(page);
      if (a.stats.oke.gun > s.stats.oke.gun) flags.swiped += 1;
    }
    return true;
  }
  return false;
}

async function playDay(page, flags, { untilCorrect = Infinity, untilMulti = false, maxMs = Infinity, key = false } = {}) {
  const t0 = Date.now();
  for (let guard = 0; guard < 500; guard++) {
    const s = await st(page);
    if (s.phase === 'closed') break;
    if (s.stats.correct >= untilCorrect) break;
    if (untilMulti && flags.multi) break;
    if (Date.now() - t0 > maxMs) break;
    if (!flags.walkShot && s.queue.some((c) => c.phase === 'walk' && c.u > 0.55 && !c.fan)) {
      const scale = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.walker')].map((e) => Number((e.style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || 1))));
      flags.walkShot = scale;
      await shot(page, `${flags.tag}-walk-in`);
    }
    if (await handleOke(page, flags, { key })) continue;
    const want = s.slots.map((c, i) => ({ c, i })).filter(({ c }) => c && c.order && (c.kind === 'normal' || c.converted));
    // prefer a multi-cup customer when we are looking for one
    want.sort((a, b) => (untilMulti ? b.c.order.count - a.c.order.count : 0) || a.c.patience / a.c.patienceMax - b.c.patience / b.c.patienceMax);
    if (want.length) { await serveCustomer(page, want[0].i, flags); continue; }
    if (s.pot.scoops < 4 && !s.pot.cookingUntil) await tap(page, 'pot');
    await sleep(200);
  }
}

// ---------- 844x390: the full run ----------
{
  const tag = '844';
  const { context, page } = await newPage(844, 390, tag);
  await page.goto(`${base}/shop.html?teach=0&reset=1&seed=7&lang=zh&mute=1&len=95000`);
  await page.waitForSelector('.start-card .go');
  await shot(page, `${tag}-start`);
  await frameCheck(page, `${tag} start`);
  const rot = await page.evaluate(() => document.querySelector('.rotate').hidden);
  check(`${tag} no rotate card in landscape`, rot === true);
  await guideRun(page, tag);
  await frameCheck(page, `${tag} play`);
  const flags = { tag, stamped: 0, swiped: 1 };
  await playDay(page, flags, { untilCorrect: 6 });
  const mid = await st(page);
  check(`${tag} day 1: ≥ 5 drinks made and served correctly after the guide`, mid.stats.correct - 1 >= 5, `correct ${mid.stats.correct - 1}, wrong ${mid.stats.wrong}`);
  check(`${tag} customers walk in from afar (smallest walker scale ${flags.walkShot ? flags.walkShot.toFixed(2) : '–'})`, flags.walkShot && flags.walkShot < 0.45);
  await shot(page, `${tag}-day1-play`);
  await playDay(page, flags);
  const end = await st(page);
  check(`${tag} day 1: 奧客 cursed away by swiping`, flags.swiped >= 1 && end.stats.oke.gun >= 1, `swipes ${flags.swiped}, gun ${end.stats.oke.gun}`);
  check(`${tag} day 1: the 250-cup customer stamped (hold → ticket, prepay)`, flags.stamped > 0, `prepay ${flags.stamped}`);
  check(`${tag} day 1: sealed cups went through the shelf (${flags.shelved || 0})`, (flags.shelved || 0) >= 3);
  await page.waitForSelector('.receipt-card .go', { timeout: 8000 });
  await sleep(300);
  await shot(page, `${tag}-day1-receipt`);
  await frameCheck(page, `${tag} receipt`);
  const cupsRow = await page.evaluate(() => [...document.querySelectorAll('.receipt li')].map((li) => li.textContent).find((t) => t.includes('今天賣出')));
  check(`${tag} receipt shows the cups sold today (${cupsRow})`, !!cupsRow && /\d/.test(cupsRow));
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
    bought = await page.evaluate(() => document.querySelector('.up.can .up-buy').dataset.id);
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
  check(`${tag} day 2 starts with the upgrade`, d2.phase === 'open' && (await page.evaluate(() => window.__shop.state.day)) === 2, `cfg ${JSON.stringify(d2.cfg).slice(0, 60)}`);
  const f2 = { tag: `${tag}-d2`, stamped: 0, swiped: 0 };
  await playDay(page, f2, { untilMulti: true, maxMs: 80000 });
  const s2 = await st(page);
  check(`${tag} day 2: a multi-cup order served cup by cup and paid (${f2.multi || 0})`, (f2.multi || 0) >= 1, `orders ${s2.stats.orders}, cups ${s2.stats.served}`);
  await shot(page, `${tag}-day2-play`);
  await frameCheck(page, `${tag} day 2`);
  await hantCheck(page, tag);
  await context.close();
}

// ---------- days 3–5 at 844x390 (stations, play, the J key, frame; the 10.9 stations) ----------
const STATION_FLAGS = {};
for (const day of [3, 4, 5]) {
  const tag = `844-d${day}`;
  const { context, page } = await newPage(844, 390, tag);
  await page.goto(`${base}/shop.html?teach=0&reset=1&day=${day}&seed=${day}&lang=zh&mute=1`);
  await page.waitForSelector('.start-card .go');
  await clickSel(page, '.start-card .go');
  await page.waitForSelector('.day-card .go');
  await shot(page, `${tag}-card`);
  await clickSel(page, '.day-card .go');
  const flags = { tag, stamped: 0, swiped: 0 };
  await playDay(page, flags, { maxMs: 30000, key: day === 3 });
  // setup only (the play stays real input): when the random orders brought no big order (day 3) / snack (days 4–5) yet,
  // turn one waiting customer's order into one
  const want = day === 3 ? 'big' : 'snack';
  if ((want === 'big' && !flags.bags) || (want === 'snack' && !flags.snacks)) {
    await waitFor(page, () => window.__shop.state.slots.some((c) => c && c.kind === 'normal' && c.order && !c.got.some(Boolean)), null, 30000).catch(() => {});
    const slot = await page.evaluate((w) => {
      const s = window.__shop.state;
      const i = s.slots.findIndex((c) => c && c.kind === 'normal' && c.order && !c.got.some(Boolean));
      if (i < 0) return -1;
      const c = s.slots[i];
      const it = { ...c.order.items[0], toppings: [] };
      if (w === 'big') c.order = { items: [0, 1, 2, 3].map(() => ({ ...it })), count: 4, big: true, snack: false };
      else c.order = { ...c.order, snack: true };
      c.got = c.order.items.map(() => false);
      c.patience = c.patienceMax = 1e9;
      return i;
    }, want);
    if (slot >= 0) await serveCustomer(page, slot, flags);
  }
  await sleep(1200);
  await shot(page, `${tag}-play`);
  const s = await st(page);
  const all = (STATION_FLAGS[day] = { ...flags, stats: s.stats });
  void all;
  const stations = await page.evaluate(() => document.querySelectorAll('.st[data-act]').length);
  check(`${tag} plays (served ${s.stats.correct}, line ${s.queue.length}, stations: ${stations})`, s.stats.correct >= 1 && stations >= 9);
  if (day === 3) {
    if (!flags.keyed) {
      // wait for an 奧客 and answer with the keyboard
      await waitFor(page, () => window.__shop.state.slots.some((c) => c && c.kind === 'oke' && !c.converted && c.oke !== 'c250'), null, 40000).catch(() => {});
      await handleOke(page, flags, { key: true });
    }
    check(`${tag} keyboard J sends the leftmost 奧客 flying`, (flags.keyed || 0) >= 1);
  }
  await frameCheck(page, tag);
  await hantCheck(page, tag);
  await context.close();
}
{
  const F = Object.values(STATION_FLAGS);
  const sum = (k) => F.reduce((a, f) => a + (f[k] || 0), 0);
  const stat = (k) => F.reduce((a, f) => a + ((f.stats && f.stats[k]) || 0), 0);
  check(`844 days 3–5: milk tea made with the pump (${sum('milk')} taps, ${stat('milk')} in the engine)`, sum('milk') >= 1 && stat('milk') >= 1);
  check(`844 days 3–5: cups shaken by dragging them onto the shaker (${sum('shaken')})`, sum('shaken') >= 1 && stat('shaken') >= 1);
  check(`844 days 3–5: cheese foam added (${sum('foam')})`, sum('foam') >= 1 && stat('foam') >= 1);
  check(`844 days 3–5: lemon slices used and the tray refilled on the board (${stat('lemon')} slices, ${stat('sliced')} refills)`, stat('lemon') >= 1 && stat('sliced') >= 1);
  check(`844 days 4–5: a 雞蛋糕 bag cooked and handed over (${sum('snacks')})`, sum('snacks') >= 1 && stat('snacks') >= 1);
  check(`844 days 3–5: a big order packed into the carry bag and handed over as one bag (${sum('bags')})`, sum('bags') >= 1 && stat('bags') >= 1);
}

// ---------- 640x360: guide + a couple of drinks ----------
{
  const tag = '640';
  const { context, page } = await newPage(640, 360, tag);
  await page.goto(`${base}/shop.html?teach=0&reset=1&seed=11&mute=1&len=60000`);
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

// ---------- 1280x720: buy Lv2 and automation levels, see the stations change ----------
{
  const tag = '1280';
  const save = { v: 1, day: 2, wallet: 30000, fame: 320, upgrades: [], best: {}, guideDone: true };
  const { context, page } = await newPage(1280, 720, tag, { save });
  await page.goto(`${base}/shop.html?teach=0&seed=5&lang=zh&mute=1`);
  await clickSel(page, '.start-card .go');
  await clickSel(page, '.day-card .go');
  await sleep(4000);
  await shot(page, `${tag}-before`);
  const before = await page.evaluate(() => ({ rig: !!document.querySelector('.pot-rig'), manifold: !!document.querySelector('.manifold'), sealers: document.querySelectorAll('.st-sealer').length, helper: !!document.querySelector('.st-helper') }));
  await page.click('.hud-pause', { force: true });
  await clickSel(page, '.pause-card .close');
  await page.waitForSelector('.receipt-card .go', { timeout: 8000 });
  await clickSel(page, '.receipt-card .go');
  await page.waitForSelector('.shop-card');
  await shot(page, `${tag}-shop-equip`);
  const buy = async (id) => {
    const tab = await page.evaluate((i) => { const b = document.querySelector(`.up-buy[data-id="${i}"]`); return !!b; }, id);
    if (!tab) {
      for (const t of ['equip', 'menu', 'shop']) {
        await clickSel(page, `.sc-tab[data-tab="${t}"]`);
        if (await page.$(`.up-buy[data-id="${id}"]`)) break;
      }
    }
    await clickSel(page, `.up-buy[data-id="${id}"]`);
    await sleep(120);
  };
  for (const id of ['pot2', 'pot3', 'pot4', 'tea2', 'tea3', 'seal2', 'seal3', 'shelf2']) await buy(id);
  await clickSel(page, '.sc-tab[data-tab="equip"]');
  await sleep(150);
  await shot(page, `${tag}-shop-bought`);
  const pips = await page.evaluate(() => document.querySelectorAll('.up[data-station="pot"] .pip.on').length);
  await buy('staff1');
  await sleep(150);
  await shot(page, `${tag}-shop-staff`);
  const sv = await page.evaluate(() => window.__shop.save);
  check(`${tag} bought Lv2 (pot2, tea2, seal2) and automation (pot4 auto refill, tea3 manifold, staff1) levels`, ['pot2', 'pot4', 'tea2', 'tea3', 'seal2', 'seal3', 'staff1'].every((x) => sv.upgrades.includes(x)) && pips === 4, `${sv.upgrades.join(',')} · pot pips ${pips}`);
  await frameCheck(page, `${tag} shop`);
  await clickSel(page, '.shop-card .go');
  await clickSel(page, '.day-card .go');
  await sleep(600);
  const after = await page.evaluate(() => ({ rig: document.querySelector('.pot-rig svg')?.dataset.lv, big: document.querySelector('.st-pot').classList.contains('big'), manifold: !!document.querySelector('.manifold'), fast: document.querySelector('.st-tea svg')?.dataset.fast, sealers: document.querySelectorAll('.st-sealer').length, turbo: document.querySelector('.st-sealer svg')?.dataset.turbo, helper: !!document.querySelector('.st-helper'), shelf: document.querySelector('.st-shelf svg')?.dataset.n }));
  check(`${tag} the stations changed on the play screen (pot hopper, manifold, two fast sealers, part-timer, shelf 5)`,
    !before.rig && !before.manifold && before.sealers === 1 && !before.helper && after.rig === '4' && after.big && after.manifold && after.fast === '1' && after.sealers === 2 && after.turbo === '1' && after.helper && after.shelf === '5', JSON.stringify(after));
  const flags = { tag, stamped: 0, swiped: 0 };
  await playDay(page, flags, { maxMs: 25000 });
  await waitFor(page, () => window.__shop.state.stats.helperCups >= 1, null, 20000).catch(() => {});
  await shot(page, `${tag}-upgraded`);
  const s = await st(page);
  check(`${tag} the part-timer made cups and put them on the shelf (${s.stats.helperCups})`, s.stats.helperCups >= 1);
  await frameCheck(page, `${tag} play`);
  await hantCheck(page, tag);
  await context.close();
}

// ---------- 390x844 portrait: the rotate card, play anyway ----------
{
  const tag = '390p';
  const { context, page } = await newPage(390, 844, tag);
  await page.goto(`${base}/shop.html?teach=0&reset=1&seed=3&lang=zh&mute=1`);
  await page.waitForSelector('.rotate:not([hidden]) .rot-go');
  await shot(page, `${tag}-rotate`);
  const txt = await page.evaluate(() => document.querySelector('.rotate').textContent);
  const fr = await page.evaluate(() => { const r = document.querySelector('.frame').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check(`${tag} portrait: the rotate card (${txt.trim()}) over a 16:9 stage (${Math.round(fr.w)}×${Math.round(fr.h)})`, txt.includes('把手機橫過來玩') && txt.includes('直接玩') && Math.abs(fr.w / fr.h - 16 / 9) < 0.02);
  await clickSel(page, '.rot-go');
  const hidden = await page.evaluate(() => document.querySelector('.rotate').hidden);
  await clickSel(page, '.start-card .go');
  await clickSel(page, '.day-card .go');
  await waitFor(page, () => window.__shop.state.slots.some(Boolean), null, 8000);
  await tap(page, 'rack'); await tap(page, 'tea-black'); await tap(page, 'top-pearl');
  await sleep(400);
  const s = await st(page);
  await shot(page, `${tag}-play-anyway`);
  check(`${tag} "play anyway" hides the card and the small stage plays (cup ${s.work[0] ? `${s.work[0].tea}+${s.work[0].toppings}` : 'none'})`, hidden && s.work[0] && s.work[0].tea === 'black' && s.work[0].toppings.length === 1);
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
  const context = await vb.newContext({ viewport: { width: 844, height: 390 }, locale: 'zh-TW', permissions: ['microphone'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`voice pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`voice console: ${m.text()}`); });
  await page.goto(`${base}/shop.html?teach=0&reset=1&seed=7&lang=zh&input=voice`);
  await clickSel(page, '.start-card .go');
  await page.waitForSelector('.voice-card .allow');
  await shot(page, 'voice-card');
  await clickSel(page, '.voice-card .allow');
  await clickSel(page, '.day-card .go');
  await waitFor(page, () => window.__shop.state.slots.some(Boolean), null, 8000);
  await tap(page, 'rack'); await tap(page, 'tea-black'); await tap(page, 'top-pearl');
  await sleep(650);
  await drag(page, 'cup-0', 'sealer');
  await waitFor(page, () => window.__shop.state.shelf[0] && window.__shop.state.shelf[0].sealed);
  await sleep(250);
  const s = await st(page);
  await drag(page, 'shelf-0', `seat-${s.slots.findIndex(Boolean)}`, 10);
  let ok = false;
  try { await waitFor(page, () => window.__shop.state.phase === 'open' && window.__shop.state.stats.oke.gun >= 1, null, 20000); ok = true; } catch { /* no shout */ }
  await shot(page, 'voice-open');
  check('voice mode: a shout sends the 奧客 flying (滾) and the shop opens', ok);
  await vb.close();
}

check('no console errors / page errors', errors.length === 0, errors.slice(0, 6).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed; screenshots in ${out}`);
process.exit(failed.length ? 1 : 0);
