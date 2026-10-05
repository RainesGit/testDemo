// Gesture mode check (docs/gameplay-v2.md 9): drives real pointer gestures (page.mouse → pointer events) at 390x844 with
// empty storage through the day 1 opening (each wait point answered with its gesture: 甩 swipe / 连拍 three taps /
// 按住盖章 hold), day 1 free play (shortened), then day 3 until a rage, where long swipes cross the row of heads.
// Reports resolves per gesture kind (window.__250.gestures), press outcomes (window.__250.inputs), rage hits per swipe,
// bowling / STRIKE, stray-tap safety (one tap on a customer answers nothing) and errors. Fails on any console / page
// error, on a gesture kind that never resolved, on the opening not finishing, on no multi-head rage swipe, and when the
// button pad is still on screen in gesture mode.
// Screenshots (390x844) of a fling, a stamp hold, a slap and a rage swipe go to tools/shots/gesture-*.png, or to
// --out=<dir>.
// --days=4,6,7 then plays those whole days by gesture too (calculator, group boxes, the boss's full stamp hold).
// Usage: (serve game/ first) node tools/check-gesture.mjs [baseUrl] [--out=dir] [--days=4,6,7]
import { mkdirSync } from 'node:fs';
const pw = (await import('./pw.mjs')).default;

const base = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765';
const outArg = process.argv.find((a) => a.startsWith('--out='));
const out = outArg ? outArg.slice(6).replace(/\/?$/, '/') : new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
let fontFails = 0;
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/Failed to load resource/.test(m.text()) && fontFails > 0) { fontFails--; return; }
  errors.push('console: ' + m.text());
});
page.on('requestfailed', (r) => {
  if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) { fontFails++; return; }
  errors.push('requestfailed: ' + r.url());
});

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const shot = (name) => page.screenshot({ path: `${out}gesture-${name}.png` });
const wait = (ms) => page.waitForTimeout(ms);

const probe = () => page.evaluate(() => {
  const w = window.__250 || {};
  const op = w.opening;
  const g = w.game;
  const s = g && g.state;
  const r = (sel) => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); return b.width ? { x: b.x, y: b.y, w: b.width, h: b.height } : null; };
  return {
    opening: !!(op && (typeof op.active === 'function' ? op.active() : op.active)),
    waiting: op ? op.waiting : null,
    beat: op ? op.beat : null,
    phase: s ? s.phase : null,
    day: w.day,
    queue: s ? s.queue : 0,
    furyFull: s ? s.furyFull : false,
    event: s && s.event ? s.event.type : null,
    shutter: s ? s.shutter : false,
    current: s && s.current ? {
      id: s.current.customer.id, key: s.current.key, step: s.current.step || 0, speaking: !!s.current.speaking,
      since: s.current.sinceArriveMs, group: s.current.customer.group ? s.current.customer.group.length : 0, hits: s.current.hits || 0,
    } : null,
    cust: r('.cust-wrap'),
    signUp: !!document.querySelector('.sign[data-state=up]'),
    heads: [...document.querySelectorAll('.rage-head:not(.out):not(.gone)')].map((h) => { const b = h.getBoundingClientRect(); return { n: +h.dataset.n, x: b.x, y: b.y, w: b.width, h: b.height }; }),
    padButtons: [...document.querySelectorAll('.pad .btn')].filter((b) => b.getBoundingClientRect().width > 0).length,
    input: document.querySelector('.stage')?.dataset.input,
    locked: document.querySelector('.stage')?.dataset.locked === '1',
    closing: !!document.querySelector('.day-card'),
    summary: !!document.querySelector('.overlay.summary:not(.hidden)'),
  };
});

// ---- real pointer gestures (mouse → pointerdown / pointermove / pointerup on the gesture surface)
async function swipe(x0, y0, x1, y1, ms = 90, { midway = null } = {}) {
  const steps = Math.max(3, Math.round(ms / 12));
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await wait(ms / steps);
    if (midway && i === Math.round(steps * 0.6)) await midway();
  }
  await page.mouse.up();
}
async function taps(x, y, n = 3, gap = 110, onTap = null) {
  for (let i = 0; i < n; i++) {
    await page.mouse.move(x + (i % 2 ? 3 : -2), y + (i % 2 ? -2 : 2));
    await page.mouse.down();
    await wait(45);
    await page.mouse.up();
    if (onTap) await onTap(i + 1);
    if (i < n - 1) await wait(gap);
  }
}
async function hold(x, y, ms = 500, onHold = null) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (onHold) { await wait(Math.min(ms, 900)); await onHold(); await wait(Math.max(0, ms - 900)); } else await wait(ms);
  await page.mouse.up();
}
const face = (p) => (p.cust ? { x: p.cust.x + p.cust.w * 0.5, y: p.cust.y + p.cust.w * 0.22 } : { x: 120, y: 540 });
let flingShot = false;
let holdShot = false;
let slapShot = false;
async function gesture(key, p, { fast = false } = {}) {
  const f = face(p);
  if (key === 'gun') {
    // fling: up-left normally, a fast up-right fling into the queue now and then (bowling)
    if (fast) await swipe(f.x - 40, f.y + 10, f.x + 170, f.y - 120, 60);
    else {
      // the fling starts the moment the swipe passes 40 px: the first one is photographed mid-flight
      const snap = !flingShot && p.day === 1 && !p.opening;
      if (snap) flingShot = true;
      await swipe(f.x + 20, f.y, f.x - 110, f.y - 70, 110, { midway: snap ? async () => { await wait(60); await shot('fling'); } : null });
    }
  } else if (key === 'shut') {
    await taps(f.x, f.y, 3, 110, async (n) => { if (n === 2 && !slapShot && !p.opening) { slapShot = true; await wait(30); await shot('slap'); } });
  } else {
    await hold(f.x, f.y, holdShot ? 420 : 1000, holdShot || p.opening ? null : async () => { holdShot = true; await shot('stamp-hold'); });
  }
}

// ---- start
await page.goto(`${base}/index.html?debug&lang=zh`);
await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
await page.goto(`${base}/index.html?debug&lang=zh`);
await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
await wait(1300);
const startInput = await page.evaluate(() => ({ mode: window.__250.inputMode, tog: [...document.querySelectorAll('.input-tog .it-opt')].map((b) => `${b.dataset.mode}:${b.getAttribute('aria-pressed')}`) }));
await page.evaluate(() => { window.__250.durationMs = 22000; });
await page.click('.start-screen .start-btn', { force: true });
const t0 = Date.now();

// ---- opening: each wait point answered with its gesture 700 ms after it opens; one stray single tap first
const op = { answered: [], stray: null, seen: false };
let lastWait = null;
let waitSince = 0;
while (Date.now() - t0 < 100000) {
  const p = await probe();
  if (p.opening) op.seen = true;
  if (op.seen && !p.opening) break;
  if (!op.seen && Date.now() - t0 > 6000) break;
  if (p.waiting !== lastWait) { lastWait = p.waiting; waitSince = Date.now(); }
  if (p.waiting && !p.locked && Date.now() - waitSince >= 700) {
    if (!op.stray) {
      // a single stray tap on the customer: a slap, no answer (the routine keeps waiting, no quip)
      const f = face(p);
      await taps(f.x, f.y, 1);
      await wait(500);
      const q = await probe();
      op.stray = { before: p.waiting, after: q.waiting, beat: q.beat };
    }
    op.answered.push(`${p.beat}:${p.waiting}`);
    await gesture(p.waiting, p);
    lastWait = null;
    await wait(250);
  }
  await wait(40);
}
const afterOpen = await probe();
check('opening-gestures', op.seen && !afterOpen.opening && afterOpen.phase === 'playing' && op.answered.length >= 4,
  `wait points answered by gesture: ${op.answered.join(' ')}; phase after ${afterOpen.phase}, queue ${afterOpen.queue}`);
check('stray-tap-safe', op.stray && op.stray.after === op.stray.before,
  `one tap while waiting for ${op.stray?.before}: still waiting for ${op.stray?.after}`);
check('pad-hidden', afterOpen.input === 'gesture' && afterOpen.padButtons === 0 && startInput.mode === 'gesture',
  `default ${startInput.mode} (toggle ${startInput.tog.join(' ')}), data-input ${afterOpen.input}, visible pad buttons ${afterOpen.padButtons}`);

// ---- free play: answer each customer with the gesture its sign shows (300 ms after it is answerable)
let gunN = 0;
async function play(untilFn, maxMs, opts = {}) {
  const tt = Date.now();
  let lastId = null;
  let n = 0;
  while (Date.now() - tt < maxMs) {
    const p = await probe();
    if (untilFn(p)) return p;
    if (p.phase === 'over' || p.closing || p.summary) return p;
    if (p.event || p.shutter) {
      const f = { x: 195, y: 420 };
      if (p.event === 'calculator') await hold(f.x, f.y, 400);
      else if (p.event === 'phone') await swipe(150, 450, 330, 380, 80);
      else await taps(f.x, f.y, 4, 70);
      continue;
    }
    const cur = p.current;
    const id = cur ? `${cur.id}:${cur.step}:${cur.hits}` : null;
    if (cur && id !== lastId && p.signUp && cur.since > 420) {
      lastId = id;
      await wait(opts.reactMs ?? 150);
      if (cur.group) {
        const q = await probe();
        if (cur.key === 'gun') await swipe(40, face(q).y, 380, face(q).y - 30, 120);
        else if (cur.key === 'shut') await taps(face(q).x, face(q).y, cur.group, 90);
        else for (let i = 0; i < cur.group; i++) await hold(face(q).x, face(q).y, 230);
      } else {
        n += 1;
        if (cur.id === 'boss' && cur.step === 7) { const q = await probe(); await hold(face(q).x, face(q).y, 1000); } // the full stamp
        else {
          if (cur.key === 'gun') gunN += 1;
          await gesture(cur.key, await probe(), { fast: cur.key === 'gun' && gunN % 2 === 0 }); // every other 滚: a hard fling into the queue
        }
      }
    }
    await wait(40);
  }
  return probe();
}
await play(() => false, 30000);
const g1 = await page.evaluate(() => ({ g: { ...window.__250.gestures }, inputs: { ...window.__250.inputs } }));

// ---- day 3 until rage, then long swipes across the row of heads
await page.evaluate(() => { window.__250.durationMs = 60000; window.__250.startDay(3); });
await wait(300);
const pre = await play((p) => p.furyFull || p.phase === 'rage', 55000, { reactMs: 60 });
const rage = { started: false, swipes: 0, hitsBefore: 0, hits: 0, multi: 0, maxPerSwipe: 0, shot: false };
if (pre.furyFull || pre.phase === 'rage') {
  if (pre.phase !== 'rage') { await swipe(260, 450, 120, 380, 90); await wait(80); }
  let p = await probe();
  for (let i = 0; i < 30 && p.phase !== 'rage'; i++) { await wait(100); p = await probe(); }
  rage.started = p.phase === 'rage';
  // the rage intro (day 3) freezes 1 s; then sweep across the row every ~700 ms
  await wait(1000);
  const tt = Date.now();
  while (Date.now() - tt < 6500) {
    p = await probe();
    if (p.phase !== 'rage') break;
    if (p.heads.length < 2) { await wait(80); continue; }
    const ys = p.heads.map((h) => h.y + h.h * 0.45);
    const y = ys.reduce((a, b) => a + b, 0) / ys.length;
    const before = await page.evaluate(() => window.__250.game.state.rageCombo);
    const dir = rage.swipes % 2 ? -1 : 1;
    await swipe(dir > 0 ? 8 : 382, y, dir > 0 ? 382 : 8, y - 10, 160, {
      midway: !rage.shot && p.heads.length >= 2 ? async () => { rage.shot = true; await shot('rage-swipe'); } : null,
    });
    const after = await page.evaluate(() => window.__250.game.state.rageCombo);
    const got = after - before;
    rage.swipes += 1;
    rage.hits += got;
    if (got >= 2) rage.multi += 1;
    rage.maxPerSwipe = Math.max(rage.maxPerSwipe, got);
    await wait(380);
  }
}
check('rage-swipe', rage.started && rage.multi >= 1, `rage ${rage.started}; ${rage.swipes} swipes, ${rage.hits} heads, ${rage.multi} multi-head swipes (max ${rage.maxPerSwipe} in one)`);
await play((p) => p.phase === 'over', 12000, { reactMs: 60 });
const g3 = await page.evaluate(() => ({ g: { ...window.__250.gestures }, inputs: { ...window.__250.inputs } }));

// ---- optional: whole days by gesture (--days=4,6,7: calculator, group boxes, the boss)
const daysArg = process.argv.find((a) => a.startsWith('--days='));
for (const n of daysArg ? daysArg.slice(7).split(',').map(Number).filter(Boolean) : []) {
  await page.evaluate((d) => { window.__250.durationMs = null; window.__250.startDay(d); }, n);
  await wait(300);
  const end = await play((p) => p.phase === 'over', 100000, { reactMs: 200 });
  const st = await page.evaluate(() => { const s = window.__250.game.state; return { queue: s.queue, st2: s.st2, stats: s.stats, inputs: window.__250.inputs, eval: window.__250.lastEval }; });
  check(`day-${n}`, end.phase === 'over' && (n !== 7 || st.st2.bossBeaten),
    `queue ${st.queue}, stars ${st.eval ? st.eval.stars.map((x) => (x ? '★' : '☆')).join('') : '?'} ${st.eval?.rating || ''}, served ${st.stats.served}, timeouts ${st.stats.polite}, groups ${st.st2.groupsCleared}, meter hits ${st.st2.meterHits ?? 0}, boss ${st.st2.bossBeaten ? 'beaten' : '-'}; inputs ${JSON.stringify(st.inputs)}`);
}

const sum = (g, re) => Object.entries(g).filter(([k]) => re.test(k)).reduce((a, [, v]) => a + v, 0);
const all = await page.evaluate(() => ({ ...window.__250.gestures })); // counted for the whole session
const byKind = { swipe: sum(all, /^swipe:(answer|wrong|step|group)$/), taps: sum(all, /^taps:(answer|wrong|step|group)$/), hold: sum(all, /^hold:(answer|wrong|step|group)$/) };
check('resolves-per-gesture', byKind.swipe > 0 && byKind.taps > 0 && byKind.hold > 0,
  `answers by gesture: swipe ${byKind.swipe}, taps ${byKind.taps}, hold ${byKind.hold}; all ${JSON.stringify(all)}`);
check('inputs', true, `day 1 inputs ${JSON.stringify(g1.inputs)}; day 3 inputs ${JSON.stringify(g3.inputs)}`);
check('bowling', (all['swipe:bowl'] || 0) + (all['swipe:strike'] || 0) > 0, `bowl ${all['swipe:bowl'] || 0}, strike ${all['swipe:strike'] || 0}`);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
check('no-errors', errors.length === 0 && !overflow, errors.length ? errors.slice(0, 5).join(' | ') : `no errors, overflow ${overflow}`);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed; screenshots in ${out}gesture-*.png`);
process.exit(failed.length ? 1 : 0);
