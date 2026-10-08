// First-minute QA (docs/first-minute-spec.md 1.2 A1–A11, 8.7 item 5) on index.html in real time.
// Scenarios:
//   correct  (every viewport) the routine answered 800 ms after each wait point, then Day 1 free play with the
//            right key 300 ms after each customer is ready. Checks A1 A2 A3 A6 A7 A8 A9 A10 A11 + layout.
//   mash     (390x844) a random key every 300 ms from "開店" on. Checks A4: closing card within 120 s, every
//            wrong press in the routine answered by a new subtitle within 300 ms.
//   timeout  (390x844) every wait point left to time out, then the right key 1 s after the finger is back.
//            Checks A5: the routine ends (F4) within 70 s.
// Usage: (serve game/ first) node tools/qa.mjs [baseUrl] [--only=correct|mash|timeout] [--vp=360x640]
// Screenshots: tools/shots/qa-<scenario>-<viewport>-*.png. Exit code 1 on any failed check.
import { mkdirSync } from 'node:fs';
const pw = (await import('./pw.mjs')).default;

const base = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765';
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const onlyVp = (process.argv.find((a) => a.startsWith('--vp=')) || '').slice(5);
const out = new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const VIEWPORTS = [['360x640', 360, 640], ['390x844', 390, 844]];
const KEYMAP = { gun: 'j', shut: 'k', take: 'l' };
const KEYS = ['gun', 'shut', 'take'];
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
const check = (scenario, vp, id, ok, detail = '') => results.push({ scenario, vp, id, ok: !!ok, detail });

// ------------------------------------------------------------------ in-page probes
// Installed once per page: samples every 100 ms (A2, A8, A10) and records engine events (A6, A7).
function installProbe() {
  const P = window.__qa = {
    samples: 0, phases: {}, timer: false, overlap: [], bars: [], combo: [], locked: [], events: [], hooked: null,
    subs: [], emoji: [],
  };
  const stage = document.querySelector('.stage');
  const rect = (n) => n.getBoundingClientRect();
  const grow = (r, d) => ({ l: r.left - d, t: r.top - d, r: r.right + d, b: r.bottom + d });
  const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const shown = (n) => { if (!n || !n.isConnected) return false; const cs = getComputedStyle(n); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
  let lastSub = '';
  const subsEl = document.querySelector('.subs');
  setInterval(() => {
    const w = window.__250 || {};
    const op = w.opening;
    const opening = !!(op && (typeof op.active === 'function' ? op.active() : op.active));
    const g = w.game;
    const phase = g ? g.state.phase : 'none';
    P.samples++;
    const t = performance.now();
    if (opening) {
      P.phases[phase] = (P.phases[phase] || 0) + 1;
      if (document.querySelector('.sign-timer')) P.timer = true;
    }
    // A10: 花字 never on the sign (both boxes grown by 2cqw)
    // a shattering (E4) or flying sign is already leaving; a sign that is rising or up and whole counts
    const sign = document.querySelector('.sign:is([data-state=up], [data-state=rise]):not(.shatter) .sign-card');
    const cqw = stage.getBoundingClientRect().width / 100;
    if (sign && (opening || (g && w.day === 1))) {
      const sr = grow(rect(sign), 2 * cqw);
      for (const hz of document.querySelectorAll('.hz')) {
        if (!shown(hz)) continue;
        // the visible ink of an SVG 花字 is its text, not the full-width svg box
        const texts = hz.querySelectorAll('text');
        const boxes = texts.length ? [...texts].map(rect) : [rect(hz)];
        for (const b of boxes) {
          const a = inter(grow(b, 2 * cqw), sr);
          if (a > 0) P.overlap.push({ t, area: Math.round(a), text: hz.textContent.slice(0, 12), beat: op && op.beat });
        }
      }
    }
    // A8: Day 1 hides aura / fury bars and the combo under 5
    if (g && w.day === 1 && phase === 'playing') {
      for (const sel of ['.bar-aura', '.bar-fury']) {
        const n = document.querySelector(sel);
        if (n && getComputedStyle(n).display !== 'none') P.bars.push(sel);
      }
      const cb = document.querySelector('.hud-combo');
      if (cb && g.state.combo < 5 && shown(cb) && cb.getBoundingClientRect().width > 0) P.combo.push(g.state.combo);
    }
    P.locked.push([t, stage.dataset.locked === '1', op ? op.beat : null]);
    if (P.locked.length > 4000) P.locked.shift();
    const sub = subsEl ? subsEl.textContent : '';
    if (sub !== lastSub) { lastSub = sub; P.subs.push([t, sub]); }
    // A6 / A7: hook the engine once it exists
    if (g && P.hooked !== g) {
      P.hooked = g;
      // e = the engine clock (elapsedMs): main's own handlers run first and may take a few ms, so the
      // listener's performance.now() is late for 'resolve'; the engine clock is exact (A7).
      g.on('arrive', ({ customer }) => P.events.push({ ev: 'arrive', t: performance.now(), e: g.state.elapsedMs, id: customer.id, p: g.state.current && g.state.current.patienceMs }));
      g.on('ready', ({ customer }) => P.events.push({ ev: 'ready', t: performance.now(), e: g.state.elapsedMs, id: customer.id, p: g.state.current && g.state.current.patienceMs }));
      g.on('resolve', (e) => P.events.push({ ev: 'resolve', t: performance.now(), e: g.state.elapsedMs, id: e.customer.id, correct: e.correct, line: e.line, key: e.key, land: e.land }));
    }
  }, 100);
}

function textAudit() {
  // A9 (text sizes, button sizes, sign main text) + A11 (no emoji in the rendered DOM) + overflow
  const issues = [];
  const EMOJI = /\p{Extended_Pictographic}/u;
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) issues.push(`page h-scroll ${document.documentElement.scrollWidth}>${vw}`);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.nodeValue.trim();
    if (!s) continue;
    if (EMOJI.test(s)) issues.push(`emoji "${s.slice(0, 16)}"`);
    const elx = n.parentElement;
    if (!elx || elx.closest('svg') || elx.closest('.hidden')) continue;
    const cs = getComputedStyle(elx);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = elx.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (parseFloat(cs.fontSize) < 12 && !elx.closest('[aria-hidden="true"]')) issues.push(`font ${cs.fontSize} "${s.slice(0, 16)}" (${elx.className})`);
  }
  for (const b of document.querySelectorAll('.btn')) {
    const r = b.getBoundingClientRect();
    if (r.width && (r.width < 96 || r.height < 88)) issues.push(`.btn ${b.dataset.key} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const sign = document.querySelector('.sign[data-state=up] .sign-num, .sign[data-state=up] .sign-line');
  if (sign && parseFloat(getComputedStyle(sign).fontSize) < 36 && !sign.closest('.sign-shut')) issues.push(`sign text ${getComputedStyle(sign).fontSize}`);
  return issues;
}

const probe = (page) => page.evaluate(() => {
  const w = window.__250 || {};
  const op = w.opening;
  const g = w.game;
  const s = g && g.state;
  return {
    opening: !!(op && (typeof op.active === 'function' ? op.active() : op.active)),
    beat: op ? op.beat : null,
    waiting: op ? op.waiting : null,
    phase: s ? s.phase : null,
    day: w.day,
    current: s && s.current ? { key: s.current.customer.key, id: s.current.customer.id, speaking: !!s.current.speaking, step: s.current.step || 0, steps: s.current.customer.steps || null } : null,
    signUp: !!document.querySelector('.sign[data-state=up]'),
    locked: document.querySelector('.stage')?.dataset.locked === '1',
    closing: !!document.querySelector('.day-card'),
    sub: document.querySelector('.subs')?.textContent || '',
  };
});

async function open(vpW, vpH) {
  const context = await browser.newContext({ viewport: { width: vpW, height: vpH }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  let fontFails = 0;
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text()) && fontFails > 0) { fontFails--; return; }
    errors.push('console: ' + m.text());
  });
  page.on('requestfailed', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) fontFails++; else errors.push('requestfailed: ' + r.url()); });
  await page.goto(`${base}/index.html?debug&lang=zh&seed=7`);
  await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
  await page.evaluate(installProbe);
  await page.waitForTimeout(1300);
  return { context, page, errors };
}
const press = async (page, key) => { await page.keyboard.down(KEYMAP[key]); await page.waitForTimeout(30); await page.keyboard.up(KEYMAP[key]); };

// Generic driver: strategy(probe, ctx) → key | null, called every ~40 ms until stop(probe) is true.
async function run(page, strategy, stop, maxMs) {
  const t0 = Date.now();
  const ctx = { t0, waitKey: null, waitSince: 0, lastCur: null, readySince: null };
  let p;
  for (;;) {
    p = await probe(page);
    ctx.now = Date.now() - t0;
    if (stop(p, ctx) || ctx.now > maxMs) break;
    if (p.waiting !== ctx.waitKey) { ctx.waitKey = p.waiting; ctx.waitSince = Date.now(); }
    const id = p.current ? `${p.current.id}:${p.current.step}` : null;
    if (id !== ctx.lastCur) { ctx.lastCur = id; ctx.readySince = null; }
    if (p.current && !p.current.speaking && ctx.readySince == null) ctx.readySince = Date.now();
    const k = await strategy(p, ctx);
    if (k) await press(page, k);
    await page.waitForTimeout(40);
  }
  return { p, ms: Date.now() - t0 };
}
const freeKey = (p, ctx) => {
  if (!p.current || ctx.readySince == null || Date.now() - ctx.readySince < 300) return null;
  ctx.readySince = Infinity;
  return p.current.steps ? p.current.steps[p.current.step] : p.current.key;
};

// ------------------------------------------------------------------ scenarios
async function scenarioCorrect(vp, w, h) {
  const { context, page, errors } = await open(w, h);
  const tClick = Date.now();
  await page.click('.start-screen .start-btn', { force: true });
  let firstSign = null;
  let pShut = null;
  let auditDone = false;
  const audits = [];
  const { p: endOpen, ms: openMs } = await run(page, async (p, ctx) => {
    if (p.signUp && firstSign == null) firstSign = Date.now() - tClick;
    if (p.beat === 'W1' && !auditDone && p.waiting) { auditDone = true; audits.push(...await page.evaluate(textAudit)); await page.screenshot({ path: `${out}qa-correct-${vp}-W1.png` }); }
    if (p.waiting && Date.now() - ctx.waitSince >= 800) {
      if (p.waiting === 'shut') pShut = await page.evaluate(() => performance.now());
      return p.waiting;
    }
    return null;
  }, (p, ctx) => ctx.now > 3000 && !p.opening, 90000);
  // first free-play customer that can be answered (sign up, input unlocked)
  await page.waitForFunction(() => {
    const g = window.__250 && window.__250.game;
    return g && g.state.current && document.querySelector('.sign[data-state=up]') && document.querySelector('.stage').dataset.locked !== '1';
  }, null, { timeout: 15000 }).catch(() => {});
  const firstAnswerable = await page.evaluate(() => performance.now());
  let freeAudit = false;
  const { p: endDay } = await run(page, async (p, ctx) => {
    if (!freeAudit && p.current && p.signUp && !p.current.speaking) {
      freeAudit = true;
      audits.push(...await page.evaluate(textAudit));
      await page.screenshot({ path: `${out}qa-correct-${vp}-freeplay.png` });
    }
    return freeKey(p, ctx);
  }, (p) => p.closing || p.phase === 'over', 70000);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}qa-correct-${vp}-closing.png` });
  const qa = await page.evaluate(() => window.__qa);

  check('correct', vp, 'A1', firstSign != null && firstSign <= 3500, `first sign up after ${firstSign} ms`);
  const phases = Object.keys(qa.phases);
  check('correct', vp, 'A2', phases.every((ph) => ph === 'idle' || ph === 'none') && !qa.timer, `engine during routine: ${phases.join(',')}; sign timer ${qa.timer}`);
  // A3: P4 → first answerable free-play customer >= 8000 ms; locked for 1800 ms after E4 starts
  const e4 = qa.locked.find(([, , beat]) => beat === 'E4');
  const lockedAfterE4 = e4 ? qa.locked.filter(([t]) => t >= e4[0] && t <= e4[0] + 1800).every(([, l]) => l) : false;
  check('correct', vp, 'A3', pShut != null && firstAnswerable - pShut >= 8000 && lockedAfterE4,
    `P4 → answerable ${Math.round(firstAnswerable - (pShut || 0))} ms; locked through E4+1800: ${lockedAfterE4}`);
  // A6: patience unchanged between arrive and ready; A7: correct answer → next arrive >= L (day 1: 650 ms,
  // big punch 1100 ms), on the engine clock
  const ev = qa.events;
  let a6bad = 0;
  let a7min = Infinity;
  let a7bigMin = Infinity;
  for (let i = 0; i < ev.length; i++) {
    if (ev[i].ev === 'arrive') {
      const r = ev.slice(i + 1).find((e) => e.ev === 'ready' && e.id === ev[i].id);
      if (r && r.p !== ev[i].p) a6bad++;
    }
    if (ev[i].ev === 'resolve' && ev[i].correct) {
      const nx = ev.slice(i + 1).find((e) => e.ev === 'arrive');
      if (nx && ev[i].land === 'big') a7bigMin = Math.min(a7bigMin, nx.e - ev[i].e);
      else if (nx) a7min = Math.min(a7min, nx.e - ev[i].e);
    }
  }
  check('correct', vp, 'A6', ev.some((e) => e.ev === 'ready') && a6bad === 0, `${ev.filter((e) => e.ev === 'arrive').length} arrivals, ${a6bad} with patience moving before ready`);
  check('correct', vp, 'A7', a7min >= 650 && a7min < Infinity && a7bigMin >= 1100,
    `min correct → next arrive ${Math.round(a7min)} ms (normal), ${a7bigMin === Infinity ? 'no big punch' : Math.round(a7bigMin) + ' ms (big)'}`);
  check('correct', vp, 'A8', qa.bars.length === 0 && qa.combo.length === 0, `bars shown ${qa.bars.length}x, combo<5 shown ${qa.combo.length}x`);
  const a9 = audits.filter((x) => !/^emoji/.test(x));
  check('correct', vp, 'A9', a9.length === 0, a9.slice(0, 4).join(' | '));
  check('correct', vp, 'A10', qa.overlap.length === 0, qa.overlap.slice(0, 3).map((o) => `${o.beat || 'free'} "${o.text}" ${o.area}px²`).join(' | '));
  const a11 = audits.filter((x) => /^emoji/.test(x));
  check('correct', vp, 'A11', a11.length === 0, a11.slice(0, 3).join(' | '));
  check('correct', vp, 'flow', !endOpen.opening && (endDay.closing || endDay.phase === 'over'), `routine ${openMs} ms; closing card ${endDay.closing}`);
  check('correct', vp, 'errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

async function scenarioMash(vp, w, h) {
  const { context, page, errors } = await open(w, h);
  await page.click('.start-screen .start-btn', { force: true });
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let last = 0;
  const wrongs = [];
  const t0 = Date.now();
  const { p } = await run(page, async (pr) => {
    if (Date.now() - last < 300) return null;
    last = Date.now();
    const k = KEYS[Math.floor(rnd() * 3)];
    if (pr.opening && pr.waiting && k !== pr.waiting) {
      const before = await page.evaluate(() => [performance.now(), document.querySelector('.subs')?.textContent || '']);
      wrongs.push({ at: before[0], sub: before[1] });
    }
    return k;
  }, (pr) => pr.closing, 125000);
  const ms = Date.now() - t0;
  const qa = await page.evaluate(() => window.__qa);
  // each wrong press: a different subtitle within 300 ms
  const late = wrongs.filter((w0) => !qa.subs.some(([t, s]) => t > w0.at && t <= w0.at + 300 && s !== w0.sub));
  await page.screenshot({ path: `${out}qa-mash-${vp}-end.png` });
  check('mash', vp, 'A4', p.closing && ms <= 120000 && late.length === 0, `closing card after ${ms} ms; ${wrongs.length} wrong presses in the routine, ${late.length} without a quip within 300 ms`);
  check('mash', vp, 'errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

async function scenarioTimeout(vp, w, h) {
  const { context, page, errors } = await open(w, h);
  await page.click('.start-screen .start-btn', { force: true });
  const t0 = Date.now();
  // Per wait point: never press until the timeout scene has played (input locks, waiting → null) and the
  // routine waits again (finger back); then press 1 s later.
  const seen = new Set();
  let armedBeat = null; // beat whose timeout scene we saw start
  let readyAt = null;
  const { p, ms } = await run(page, async (pr) => {
    if (pr.beat && /^W\d$/.test(pr.beat) && !pr.waiting && pr.locked && !seen.has(pr.beat) && armedBeat !== pr.beat) {
      armedBeat = pr.beat; // locked inside a wait beat = the timeout scene
    }
    if (!pr.waiting) return null;
    if (armedBeat === pr.beat && !seen.has(pr.beat)) { seen.add(pr.beat); readyAt = Date.now(); }
    if (seen.has(pr.beat) && readyAt != null && Date.now() - readyAt >= 1000) { readyAt = null; return pr.waiting; }
    return null;
  }, (pr, ctx) => ctx.now > 3000 && !pr.opening, 90000);
  await page.screenshot({ path: `${out}qa-timeout-${vp}-end.png` });
  check('timeout', vp, 'A5', !p.opening && ms <= 70000 && seen.size === 4, `F4 after ${Date.now() - t0} ms, timeouts at ${[...seen].join(',')}`);
  check('timeout', vp, 'errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

const PLAN = [
  ['correct', VIEWPORTS],
  ['mash', [VIEWPORTS[1]]],
  ['timeout', [VIEWPORTS[1]]],
];
const FN = { correct: scenarioCorrect, mash: scenarioMash, timeout: scenarioTimeout };
for (const [sc, vps] of PLAN) {
  if (only && only !== sc) continue;
  for (const [vp, w, h] of vps) {
    if (onlyVp && onlyVp !== vp) continue;
    process.stderr.write(`[qa] ${sc} ${vp}…\n`);
    try { await FN[sc](vp, w, h); } catch (err) { check(sc, vp, 'crash', false, err.message); }
  }
}
await browser.close();
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.scenario} ${r.vp} ${r.id}${r.detail ? `  [${r.detail}]` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
