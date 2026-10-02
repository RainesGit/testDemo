// End-to-end smoke (docs/first-minute-spec.md 8.7 item 4): open index.html at 390x844 with empty storage,
// tap "开店", play the Day 1 opening routine (each wait point answered 800 ms after it opens with the right
// key), then Day 1 free play (correct key 300 ms after each customer is ready) until the closing card (3.8),
// tap it into Day 2 (aura bar hidden until its intro, clock shown; round shortened to 25 s through
// window.__250.durationMs so the smoke stays short), play it to the report card and tap "再骂一天": the next
// round must start on day 3 when ★1 was reached, otherwise day 2 again (7), and 250cups.day must follow.
// Fails on any console error / page error / failed request, on an engine that leaves 'idle' (or a sign
// timer that appears) during the routine, and on horizontal overflow.
// Screenshots (tools/shots/integrate-*.png): start, A4, W1, B8 (S1 滚), D4 (S2 250), E4 (调你妈),
// E12 (ticket freeze), free play, closing card, day 2, day 2 report.
// Usage: (serve game/ first, e.g. python3 -m http.server 8765) node tools/play-integrate.mjs [baseUrl] [--lang=en]
import { mkdirSync } from 'node:fs';
const pw = (await import('./pw.mjs')).default;

const base = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765';
const lang = (process.argv.find((a) => a.startsWith('--lang=')) || '--lang=zh').slice(7);
const out = new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
// Google Fonts may be blocked (sandbox proxy, K3): the game falls back to system fonts, so a failed font
// request and its "Failed to load resource" console line are not errors.
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
page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`); });

const shot = (name) => page.screenshot({ path: `${out}integrate-${lang}-${name}.png` });
const KEYMAP = { gun: 'j', shut: 'k', take: 'l' };
const press = async (key) => { await page.keyboard.down(KEYMAP[key]); await page.waitForTimeout(40); await page.keyboard.up(KEYMAP[key]); };

const probe = () => page.evaluate(() => {
  const vis = (sel) => { const n = document.querySelector(sel); return !!n && getComputedStyle(n).display !== 'none' && !n.hidden; };
  const w = window.__250 || {};
  const op = w.opening;
  const g = w.game;
  const s = g && g.state;
  return {
    opening: !!(op && (typeof op.active === 'function' ? op.active() : op.active)),
    beat: op ? op.beat : null,
    waiting: op ? op.waiting : null,
    phase: s ? s.phase : null,
    current: s && s.current ? { key: s.current.customer.key, id: s.current.customer.id, speaking: !!s.current.speaking, step: s.current.step || 0, steps: s.current.customer.steps || null } : null,
    signUp: !!document.querySelector('.sign[data-state=up]'),
    timer: !!document.querySelector('.sign-timer'),
    closing: !!document.querySelector('.day-card'),
    summary: !!document.querySelector('.overlay.summary:not(.hidden)'),
    day: w.day,
    queue: s ? s.queue : null,
    aura: vis('.bar-aura'),
    clock: vis('.hud-time'),
    storedDay: (() => { try { return localStorage.getItem('250cups.day'); } catch { return null; } })(),
  };
});

await page.goto(`${base}/index.html?debug&lang=${lang}`);
await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
await page.waitForTimeout(1300); // the start button takes taps after 1200 ms (3.2)
await shot('01-start');
await page.click('.start-screen .start-btn', { force: true });
const tStart = Date.now();

// ---- opening routine ----
const SHOTS = { A4: ['02-A4', 300], W1: ['03-W1', 100], B8: ['04-B8-scram', 180], D4: ['05-D4-250', 300], E4: ['06-E4-tiaonima', 200], E12: ['07-E12-ticket', 250] };
const taken = new Set();
const report = { firstSignMs: null, beatsSeen: [], phaseDuringOpening: new Set(), timerDuringOpening: false, presses: [] };
let waitSince = null;
let lastWait = null;
let seenOpening = false;
while (Date.now() - tStart < 90000) {
  const p = await probe();
  if (p.opening) seenOpening = true;
  if (seenOpening && !p.opening) break;
  if (!seenOpening && Date.now() - tStart > 5000) break; // opening never started (already done / unavailable)
  if (p.signUp && report.firstSignMs == null) report.firstSignMs = Date.now() - tStart;
  if (p.beat && report.beatsSeen.at(-1) !== p.beat) report.beatsSeen.push(p.beat);
  report.phaseDuringOpening.add(p.phase ?? 'none');
  if (p.timer) report.timerDuringOpening = true;
  const s = SHOTS[p.beat];
  if (s && !taken.has(p.beat)) {
    taken.add(p.beat);
    await page.waitForTimeout(s[1]);
    await shot(s[0]);
    continue;
  }
  if (p.waiting !== lastWait) { lastWait = p.waiting; waitSince = Date.now(); }
  if (p.waiting && Date.now() - waitSince >= 800) {
    report.presses.push({ key: p.waiting, beat: p.beat, t: Date.now() - tStart });
    await press(p.waiting);
    lastWait = null;
  }
  await page.waitForTimeout(40);
}
report.openingMs = Date.now() - tStart;

// ---- day 1 free play ----
let freeShot = false;
let served = 0;
let readySince = null;
let lastCur = null;
const tFree = Date.now();
while (Date.now() - tFree < 75000) {
  const p = await probe();
  if (p.closing || p.summary || p.phase === 'over') break;
  const cur = p.current;
  const id = cur ? `${cur.id}:${cur.step}` : null;
  if (id !== lastCur) { lastCur = id; readySince = null; }
  if (cur && !cur.speaking && readySince == null) readySince = Date.now();
  if (cur && readySince != null && Date.now() - readySince >= 300) {
    const key = cur.steps ? cur.steps[cur.step] : cur.key;
    await press(key);
    served++;
    readySince = Infinity;
    if (!freeShot && served >= 4) { freeShot = true; await page.waitForTimeout(150); await shot('08-freeplay'); }
  }
  await page.waitForTimeout(40);
}
// the card waits for the last line's reading time + the verdict (review fix 3), then needs 1000 ms before
// its button works (review fix 4)
for (let i = 0; i < 80; i++) { const p = await probe(); if (p.closing || p.summary) break; await page.waitForTimeout(100); }
await page.waitForTimeout(300);
const end = await probe();
await shot('09-closing');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

// ---- closing card → day 2 → report → next round ----
const flow = { day2: null, report: false, next: null };
if (end.closing) {
  await page.evaluate(() => { window.__250.durationMs = 25000; });
  // the card ignores input for 1000 ms (a player still mashing must not skip it); only its button opens day 2
  await page.click('.day-card', { force: true });
  await page.waitForTimeout(150);
  flow.cardStaysOnTap = !!(await page.$('.day-card'));
  await page.waitForTimeout(900);
  await page.click('.day-card .dc-btn', { force: true });
  await page.waitForTimeout(700);
  const d2 = await probe();
  flow.day2 = { day: d2.day, phase: d2.phase, aura: d2.aura, clock: d2.clock, storedDay: d2.storedDay };
  await shot('10-day2');
  const t2 = Date.now();
  let lastId = null;
  let ready = null;
  while (Date.now() - t2 < 45000) {
    const p = await probe();
    if (p.summary) break;
    if (p.phase === 'rage') { await press('gun'); await page.waitForTimeout(60); continue; }
    const id = p.current ? `${p.current.id}:${p.current.step}` : null;
    if (id !== lastId) { lastId = id; ready = null; }
    if (p.current && !p.current.speaking && ready == null) ready = Date.now();
    if (p.current && ready != null && Date.now() - ready >= 300) { await press(p.current.steps ? p.current.steps[p.current.step] : p.current.key); ready = Infinity; }
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(900);
  const rep = await probe();
  flow.report = rep.summary;
  flow.day2Queue = rep.queue;
  await shot('11-day2-report');
  if (rep.summary) {
    const passed = rep.queue >= 35; // day 2 ★1 (4.2)
    await page.click('.overlay.summary .big-btn', { force: true });
    await page.waitForTimeout(700);
    const nx = await probe();
    flow.next = { expectDay: passed ? 3 : 2, day: nx.day, phase: nx.phase, storedDay: nx.storedDay };
  }
}

const result = {
  lang,
  opening: {
    ran: seenOpening,
    ms: report.openingMs,
    firstSignMs: report.firstSignMs,
    presses: report.presses,
    beats: report.beatsSeen.join(' '),
    enginePhases: [...report.phaseDuringOpening],
    signTimerSeen: report.timerDuringOpening,
  },
  freePlay: { served, closingCard: end.closing, summary: end.summary, phase: end.phase },
  flow,
  overflow,
  errors,
};
console.log(JSON.stringify(result, null, 1));
await browser.close();
const engineIdle = [...report.phaseDuringOpening].every((ph) => ph === 'idle' || ph === 'none');
const day2ok = !!flow.day2 && flow.day2.day === 2 && flow.day2.phase === 'playing' && !flow.day2.aura && flow.day2.clock && flow.day2.storedDay === '2';
const nextOk = !!flow.next && flow.next.day === flow.next.expectDay && flow.next.phase === 'playing' && flow.next.storedDay === String(Math.max(2, flow.next.expectDay));
const ok = !errors.length && !overflow && seenOpening && engineIdle && !report.timerDuringOpening
  && report.presses.length >= 4 && end.closing && flow.cardStaysOnTap && day2ok && flow.report && nextOk;
process.exit(ok ? 0 : 1);
