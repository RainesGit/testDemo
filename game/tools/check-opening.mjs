// Opening routine acceptance (docs/first-minute-spec.md 1.2 A1–A13, section 3) on index.html in real time.
// Per viewport (390x844 and 360x640):
//   run "play"  first visit (empty storage): tap 开店 and play the routine. W1: one wrong key (闭嘴) 800 ms
//               after it opens, then 滚 once the quip is over. W2 and W4: the right key after 800 ms.
//               W3: two wrong keys (滚 — the brake — then 闭嘴) so the routine answers itself ("算了，我自己来。").
//               Then the first free-play customer of day 1.
//   run "skip"  a returning player (250cups.openingDone = '1') on day 1: the routine replays with "跳过 ▸";
//               tap it, the three-key recap shows, then day 1 starts with the 12 people the routine built.
//   run "perf"  (360x640 only) Chromium with 4x CPU throttling plays the routine with the right keys (A13).
// Checks (ids from 1.2; "opening" ids are section-3 details):
//   A1 first sign up ≤ 3.5 s after the tap        A2 engine 'idle' all routine long, no .sign-timer
//   A3 P4 → first answerable customer ≥ 8 s, input locked for 1.8 s from E4
//   A4 (routine part) each wrong press answered by a subtitle within 300 ms, the second wrong press on a beat
//      moves the routine on by itself
//   A8 no aura / fury bar, no clock, no combo during the routine and day 1
//   A9 360x640: text ≥ 12 px, sign main text ≥ 36 px, keys ≥ 96x88 px (sampled at W1, W3, W4, free play)
//   A10 花字 box and sign box (both grown by 2cqw) never intersect while the sign is up
//   A11 no emoji in ui.js / art.js / style.css or in the rendered DOM
//   A12 node tools/check-content.mjs passes (V2 voice coverage may fail until the voice pack is rebuilt)
//   A13 4x CPU: ≤ 5% of frames longer than 32 ms, ≤ 400 SVG nodes on screen
// Screenshots: tools/shots/opening-<viewport>-<beat>.png
// Usage: (serve game/ first, e.g. python3 -m http.server 8765) node tools/check-opening.mjs [baseUrl] [--vp=360x640]
//        [--no-perf] [--only=play|skip|perf] [--cpu=4]
import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const pw = (await import('./pw.mjs')).default;

const base = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765';
const onlyVp = (process.argv.find((a) => a.startsWith('--vp=')) || '').slice(5);
const noPerf = process.argv.includes('--no-perf');
const cpu = Number((process.argv.find((a) => a.startsWith('--cpu=')) || '--cpu=4').slice(6)) || 4; // A13 throttling rate
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7); // play | skip | perf
const out = new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const VIEWPORTS = [['390x844', 390, 844], ['360x640', 360, 640]].filter(([v]) => !onlyVp || v === onlyVp);
const KEYMAP = { gun: 'j', shut: 'k', take: 'l' };
const results = [];
const check = (vp, id, ok, detail = '') => results.push({ vp, id, ok: !!ok, detail });
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

// ------------------------------------------------------------------ in-page probe (every 100 ms)
function installProbe() {
  const P = window.__op = { phases: {}, timer: false, overlap: [], hud: [], locked: [], subs: [], svgMax: 0, skipSeen: null, beats: [] };
  const stage = document.querySelector('.stage');
  const subsEl = document.querySelector('.subs');
  const rect = (n) => n.getBoundingClientRect();
  const grow = (r, d) => ({ l: r.left - d, t: r.top - d, r: r.right + d, b: r.bottom + d });
  const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const shown = (n) => { if (!n || !n.isConnected) return false; const cs = getComputedStyle(n); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
  let lastSub = subsEl ? subsEl.textContent : '';
  const t0 = performance.now();
  const sample = () => {
    const w = window.__250 || {};
    const op = w.opening;
    const opening = !!(op && op.active);
    const g = w.game;
    const phase = g ? g.state.phase : 'none';
    const t = performance.now();
    const beat = op ? op.beat : null;
    if (beat && P.beats.at(-1)?.[0] !== beat) P.beats.push([beat, t]);
    if (opening) {
      P.phases[phase] = (P.phases[phase] || 0) + 1;
      if (document.querySelector('.sign-timer')) P.timer = true;
      const skip = document.querySelector('.skip');
      if (skip && !skip.hidden && P.skipSeen == null) P.skipSeen = t - t0;
    }
    // A10: a sign that is up (or rising) and whole vs every visible 花字 text box, both grown by 2cqw
    const cqw = stage.getBoundingClientRect().width / 100;
    const sign = document.querySelector('.sign:is([data-state=up], [data-state=rise]):not(.shatter) .sign-card');
    if (sign && (opening || (g && w.day === 1 && phase === 'playing'))) {
      const sr = grow(rect(sign), 2 * cqw);
      for (const hz of document.querySelectorAll('.hz')) {
        if (!shown(hz)) continue;
        for (const b of [...hz.querySelectorAll('text')].map(rect)) {
          const a = inter(grow(b, 2 * cqw), sr);
          if (a > 0) P.overlap.push({ beat, area: Math.round(a), text: hz.textContent.slice(0, 12) });
        }
      }
    }
    // A8: routine + day 1 show the queue only
    if (opening || (g && w.day === 1 && phase === 'playing')) {
      for (const sel of ['.bar-aura', '.bar-fury', '.hud-time']) {
        const n = document.querySelector(sel);
        if (n && shown(n) && rect(n).width > 0) P.hud.push(sel);
      }
      const cb = document.querySelector('.hud-combo');
      if (cb && shown(cb) && (!g || g.state.combo < 5)) P.hud.push('.hud-combo');
    }
    // A13: SVG nodes on screen
    const n = document.querySelectorAll('.stage svg, .stage svg *').length;
    if (n > P.svgMax) P.svgMax = n;
    P.locked.push([t, stage.dataset.locked === '1', beat]);
    const sub = subsEl ? subsEl.textContent : '';
    if (sub !== lastSub) { lastSub = sub; P.subs.push([t, sub]); }
  };
  setInterval(sample, 100);
}

// Frame timing for A13 (rAF deltas while the routine runs).
function installFrames() {
  const F = window.__frames = { n: 0, long: 0, on: false };
  let last = 0;
  const loop = (t) => {
    const w = window.__250 || {};
    const on = !!(w.opening && w.opening.active);
    if (on && F.on && last) { F.n++; if (t - last > 32) F.long++; }
    F.on = on;
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function textAudit() {
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
    if (!elx || elx.closest('.hidden, [hidden]')) continue;
    const cs = getComputedStyle(elx);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = elx.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // SVG text is drawn in viewBox units: compare its rendered height instead of the CSS font-size
    const svg = elx.closest('svg');
    let px = parseFloat(cs.fontSize);
    if (svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) {
      const k = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      px = parseFloat(elx.getAttribute('font-size') || cs.fontSize) * k;
    }
    if (px < 11.95) issues.push(`font ${px.toFixed(1)}px "${s.slice(0, 16)}" (${elx.className.baseVal ?? elx.className})`);
  }
  for (const b of document.querySelectorAll('.btn')) {
    const r = b.offsetWidth ? { w: b.offsetWidth, h: b.offsetHeight } : null; // layout size: not the tap/breath scale
    if (r && (r.w < 96 || r.h < 88)) issues.push(`.btn ${b.dataset.key} ${r.w}x${r.h}`);
  }
  for (const s of document.querySelectorAll('.sign:not(.mini)[data-state=up] :is(.sign-num, .sign-text.is-hesitant .sign-line)')) {
    const px = parseFloat(getComputedStyle(s).fontSize);
    if (px < 36) issues.push(`sign text ${px}px "${s.textContent}"`);
  }
  return issues;
}

const probe = (page) => page.evaluate(() => {
  const w = window.__250 || {};
  const op = w.opening;
  const g = w.game;
  const s = g && g.state;
  const btn = (k) => document.querySelector(`.btn-${k}`);
  return {
    opening: !!(op && op.active),
    beat: op ? op.beat : null,
    waiting: op ? op.waiting : null,
    phase: s ? s.phase : null,
    queue: s ? s.queue : null,
    day: w.day,
    current: s && s.current ? { key: s.current.customer.key, speaking: !!s.current.speaking } : null,
    signUp: !!document.querySelector('.sign[data-state=up]'),
    locked: document.querySelector('.stage').dataset.locked === '1',
    sub: document.querySelector('.subs').textContent,
    finger: !document.querySelector('.finger').hidden,
    line: !document.querySelector('.guide-line').hidden,
    glow: ['gun', 'shut', 'take'].filter((k) => btn(k).hasAttribute('data-glow')),
    dim: ['gun', 'shut', 'take'].filter((k) => btn(k).hasAttribute('data-dim')),
    covered: btn('shut').hasAttribute('data-covered'),
    recap: !document.querySelector('.recap').hidden,
    skip: !document.querySelector('.skip').hidden,
    plate: !!document.querySelector('.plate-layer .ticket'),
    letterbox: document.querySelector('.letterbox').classList.contains('on'),
    qnum: document.querySelector('.hud-qnum').textContent,
  };
});

async function open(w, h, { returning = false, throttle = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  if (returning) await context.addInitScript(() => { try { localStorage.setItem('250cups.openingDone', '1'); localStorage.setItem('250cups.day', '1'); } catch { /* ignore */ } });
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
  if (throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  await page.goto(`${base}/index.html?debug&lang=zh&seed=7`);
  await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
  await page.evaluate(installProbe);
  if (throttle) await page.evaluate(installFrames);
  await page.waitForTimeout(1300); // the start button takes taps from 1200 ms (3.2)
  return { context, page, errors };
}
const press = async (page, key) => { await page.keyboard.down(KEYMAP[key]); await page.waitForTimeout(30); await page.keyboard.up(KEYMAP[key]); };
const now = (page) => page.evaluate(() => performance.now());
async function until(page, fn, maxMs, stepMs = 40) {
  const t0 = Date.now();
  for (;;) {
    const p = await probe(page);
    if (fn(p)) return p;
    if (Date.now() - t0 > maxMs) return null;
    await page.waitForTimeout(stepMs);
  }
}

// ------------------------------------------------------------------ run "play"
async function runPlay(vp, w, h) {
  const { context, page, errors } = await open(w, h);
  const shotName = (name) => `${out}opening-${vp}-${name}.png`;
  const shot = (name) => page.screenshot({ path: shotName(name) });
  const audits = [];
  const audit = async (where) => { for (const x of await page.evaluate(textAudit)) audits.push(`${where}: ${x}`); };
  const notes = {};
  const tTap = await now(page);
  await page.click('.start-screen .start-btn', { force: true });

  // beats to photograph on the way (beat id → [file, delay after the beat starts])
  const SHOTS = { A2: ['A2-daycard', 250], A4: ['A4-ask', 350], B8: ['B8-scram', 150], C9: ['C9-too-few', 150], D4: ['D4-250', 300],
    D10: ['D10-trap', 500], E4: ['E4-tiaonima', 180], E6: ['E6-golden', 500], E10: ['E10-two-months', 600], E12: ['E12-ticket', 250],
    F1: ['F1-next', 400], F3: ['F3-recap', 300] };
  const taken = new Set();
  let firstSign = null;
  let pShut = null;
  const handled = new Set();
  const wrong = []; // { at, sub, beat }
  let w1 = null;
  let w3auto = null;
  const tEnd = Date.now() + 90000;
  let p;
  let ran = false;
  let lastBeat = null;
  while (Date.now() < tEnd) {
    p = await probe(page);
    if (p.signUp && firstSign == null) firstSign = (await now(page)) - tTap;
    if (p.opening) { ran = true; lastBeat = p.beat; }
    if (ran && !p.opening) break; // F4: main drops the routine and starts day 1
    const s = SHOTS[p.beat];
    if (s && !taken.has(p.beat)) { taken.add(p.beat); await page.waitForTimeout(s[1]); await shot(s[0]); continue; }
    if (p.waiting && !handled.has(p.beat)) {
      handled.add(p.beat);
      const beat = p.beat;
      // +0 hint rules (3.1): a new key glows alone, the others dim; the old key (W2) has no hint yet
      if (beat === 'W1') notes.w1hint = p.glow.join() === 'gun' && p.dim.sort().join() === 'shut,take';
      if (beat === 'W2') notes.w2hint = p.glow.length === 0 && p.dim.length === 0;
      if (beat === 'W4') { notes.w4uncovered = !p.covered; notes.w4hint = p.glow.join() === 'shut'; }
      if (beat === 'W3') notes.w3hint = p.glow.join() === 'take';
      await page.waitForTimeout(800);
      if (beat === 'W1') {
        await audit('W1');
        await shot('W1-wait');
        const before = await page.evaluate(() => [performance.now(), document.querySelector('.subs').textContent]);
        await press(page, 'shut');
        wrong.push({ at: before[0], sub: before[1], beat });
        await page.waitForTimeout(250);
        await shot('W1-wrong-quip');
        const during = await probe(page);
        // the quip holds the beat (no wait key) but the keys stay live: a press after 250 ms cuts it (review A4)
        notes.w1lockedDuringQuip = during.waiting == null;
        // quip over → the right key lights up with the finger and the dashed line (R3)
        const back = await until(page, (q) => q.waiting === 'gun', 4000);
        notes.w1fingerAfterQuip = !!back && back.finger && back.line && back.glow.join() === 'gun';
        await shot('W1-finger');
        await press(page, 'gun');
      } else if (beat === 'W3') {
        await audit('W3');
        await shot('W3-wait');
        let before = await page.evaluate(() => [performance.now(), document.querySelector('.subs').textContent]);
        await press(page, 'gun'); // brake: "滚——" cut after 150 ms
        wrong.push({ at: before[0], sub: before[1], beat });
        await page.waitForTimeout(200);
        await shot('W3-brake');
        await until(page, (q) => q.waiting === 'take', 8000);
        before = await page.evaluate(() => [performance.now(), document.querySelector('.subs').textContent]);
        await press(page, 'shut'); // second wrong press on the same beat → "算了，我自己来。" and the beat resolves
        wrong.push({ at: before[0], sub: before[1], beat });
        const moved = await until(page, (q) => q.beat !== 'W3', 4000);
        w3auto = !!moved && ['D7', 'D8', 'D9'].includes(moved.beat);
      } else {
        if (beat === 'W4') { await audit('W4'); await shot('W4-wait'); pShut = await now(page); }
        await press(page, p.waiting);
      }
      continue;
    }
    await page.waitForTimeout(40);
  }
  const endOpen = p;
  // first free-play customer that can be answered
  await page.waitForFunction(() => {
    const g = window.__250 && window.__250.game;
    return g && g.state.phase === 'playing' && g.state.current && document.querySelector('.sign[data-state=up]') && document.querySelector('.stage').dataset.locked !== '1';
  }, null, { timeout: 15000 }).catch(() => {});
  const firstAnswerable = await now(page);
  const afterOpen = await probe(page);
  await page.waitForTimeout(300);
  await audit('free play');
  await shot('day1-first');
  const qa = await page.evaluate(() => window.__op);

  check(vp, 'A1', firstSign != null && firstSign <= 3500, `first sign up ${Math.round(firstSign)} ms after the tap`);
  const phases = Object.keys(qa.phases);
  check(vp, 'A2', phases.length > 0 && phases.every((ph) => ph === 'idle') && !qa.timer, `engine during routine: ${phases.join(',')}; sign timer: ${qa.timer}`);
  const e4 = qa.beats.find(([b]) => b === 'E4');
  const lockE4 = e4 ? qa.locked.filter(([t]) => t >= e4[1] && t <= e4[1] + 1800) : [];
  const lockedAfterE4 = lockE4.length >= 10 && lockE4.every(([, l]) => l);
  check(vp, 'A3', pShut != null && firstAnswerable - pShut >= 8000 && lockedAfterE4,
    `P4 → first answerable customer ${Math.round(firstAnswerable - (pShut || 0))} ms; locked through E4+1800: ${lockedAfterE4} (${lockE4.length} samples)`);
  const late = wrong.filter((w0) => !qa.subs.some(([t, s]) => t > w0.at && t <= w0.at + 300 && s !== w0.sub));
  check(vp, 'A4', wrong.length === 3 && late.length === 0 && w3auto && notes.w1lockedDuringQuip,
    `${wrong.length} wrong presses, ${late.length} without a new subtitle within 300 ms; quip holds the beat: ${notes.w1lockedDuringQuip}; W3 second wrong press advanced: ${w3auto}`);
  check(vp, 'opening-hints', notes.w1hint && notes.w2hint && notes.w3hint && notes.w4hint && notes.w4uncovered && notes.w1fingerAfterQuip,
    `W1 new-key hint ${notes.w1hint}, finger+line after quip ${notes.w1fingerAfterQuip}, W2 no hint at +0 ${notes.w2hint}, W3 ${notes.w3hint}, W4 uncovered ${notes.w4uncovered} + glow ${notes.w4hint}`);
  check(vp, 'opening-carry', afterOpen.phase === 'playing' && afterOpen.day === 1 && afterOpen.queue >= 12 && !afterOpen.covered && !afterOpen.letterbox && afterOpen.glow.length === 0,
    `after F4: phase ${afterOpen.phase}, day ${afterOpen.day}, queue ${afterOpen.queue}, shut covered ${afterOpen.covered}, guides ${afterOpen.glow.join() || 'none'}`);
  check(vp, 'opening-no-skip', qa.skipSeen == null, qa.skipSeen == null ? 'no skip button on the first run' : `skip button at ${Math.round(qa.skipSeen)} ms`);
  check(vp, 'A8', qa.hud.length === 0, qa.hud.length ? `shown: ${[...new Set(qa.hud)].join(', ')}` : 'queue only');
  const a9 = audits.filter((x) => !/emoji/.test(x));
  if (vp === '360x640') check(vp, 'A9', a9.length === 0, a9.slice(0, 4).join(' | ') || 'text ≥ 12 px, signs ≥ 36 px, keys ≥ 96x88');
  check(vp, 'A10', qa.overlap.length === 0, qa.overlap.slice(0, 3).map((o) => `${o.beat || 'free'} "${o.text}" ${o.area}px²`).join(' | ') || `${qa.beats.length} beats, no overlap`);
  const a11 = audits.filter((x) => /emoji/.test(x));
  check(vp, 'A11-dom', a11.length === 0, a11.slice(0, 3).join(' | ') || 'no emoji in the DOM');
  const reached = qa.beats.map(([b]) => b);
  check(vp, 'flow', ran && !endOpen.opening && reached.includes('E4') && reached.at(-1) === 'F3' && lastBeat === 'F3',
    `routine ran ${ran}, last beat ${lastBeat}; ${reached.length} beats`);
  check(vp, 'errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ run "skip"
async function runSkip(vp, w, h) {
  const { context, page, errors } = await open(w, h, { returning: true });
  const start = await page.evaluate(() => document.querySelector('.start-btn').textContent);
  const tTap = await now(page);
  await page.click('.start-screen .start-btn', { force: true });
  await page.waitForTimeout(600);
  const early = await probe(page);
  const shown = await until(page, (q) => q.skip, 3000, 30);
  const skipAt = (await now(page)) - tTap;
  await page.screenshot({ path: `${out}opening-${vp}-skip-button.png` });
  await page.click('.skip');
  const recap = await until(page, (q) => q.recap, 1500, 30);
  await page.screenshot({ path: `${out}opening-${vp}-skip-recap.png` });
  const play = await until(page, (q) => q.phase === 'playing' && !q.opening, 5000);
  await page.waitForTimeout(400);
  const p = await probe(page);
  await page.screenshot({ path: `${out}opening-${vp}-skip-day1.png` });
  check(vp, 'opening-skip', early.opening && !early.skip && shown && skipAt >= 1150 && recap && play && p.day === 1 && p.queue >= 12
      && !p.covered && !p.plate && !p.letterbox && p.glow.length === 0 && !p.recap,
    `start "${start}"; replay ${early.opening}; skip shown at ${Math.round(skipAt)} ms; recap ${!!recap}; day ${p.day} playing ${!!play}, queue ${p.queue}, clean stage ${!p.covered && !p.plate && !p.letterbox && !p.glow.length}`);
  check(vp, 'errors-skip', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ run "perf" (A13)
async function runPerf(vp, w, h) {
  const { context, page, errors } = await open(w, h, { throttle: cpu });
  await page.click('.start-screen .start-btn', { force: true });
  const handled = new Set();
  const tEnd = Date.now() + 150000;
  let p;
  let ran = false;
  while (Date.now() < tEnd) {
    p = await probe(page);
    if (p.opening) ran = true;
    if (ran && !p.opening) break;
    if (p.waiting && !handled.has(p.beat)) { handled.add(p.beat); await page.waitForTimeout(800); await press(page, p.waiting); }
    await page.waitForTimeout(80);
  }
  const f = await page.evaluate(() => window.__frames);
  const qa = await page.evaluate(() => window.__op);
  const ratio = f.n ? f.long / f.n : 1;
  check(vp, 'A13', ran && !p.opening && f.n > 100 && ratio <= 0.05 && qa.svgMax <= 400,
    `${cpu}x CPU: ${f.long}/${f.n} frames > 32 ms (${(ratio * 100).toFixed(1)}%); max SVG nodes ${qa.svgMax}`);
  check(vp, 'errors-perf', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ static checks (A11 sources, A12)
const root = fileURLToPath(new URL('..', import.meta.url));
const EMOJI = /\p{Extended_Pictographic}/u;
const srcHits = ['src/ui.js', 'src/art.js', 'style.css'].filter((f) => EMOJI.test(readFileSync(root + f, 'utf8')));
check('-', 'A11-src', srcHits.length === 0, srcHits.length ? `emoji in ${srcHits.join(', ')}` : 'ui.js, art.js, style.css clean');
const cc = spawnSync(process.execPath, ['tools/check-content.mjs'], { cwd: root, encoding: 'utf8' });
const fails = cc.stdout.split('\n').filter((l) => l.startsWith('FAIL'));
const hard = fails.filter((l) => !/^FAIL V2-/.test(l));
check('-', 'A12', hard.length === 0, hard.length ? hard.join(' | ') : `check-content: ${fails.length ? `only ${fails.map((l) => l.split(' ')[1]).join(', ')} (voice pack not rebuilt yet)` : 'all pass'}`);

for (const [vp, w, h] of VIEWPORTS) {
  for (const [name, fn] of [['play', runPlay], ['skip', runSkip], ['perf', runPerf]]) {
    if (name === 'perf' && (vp !== '360x640' || noPerf)) continue;
    if (only && only !== name) continue;
    process.stderr.write(`[opening] ${name} ${vp}…\n`);
    try { await fn(vp, w, h); } catch (err) { check(vp, `${name}-crash`, false, err.message.split('\n')[0]); }
  }
}
await browser.close();
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.vp} ${r.id}${r.detail ? `  [${r.detail}]` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
