// The "250" signature in the first-minute flow (docs/first-minute-spec.md R2, R12, R13, 3.6–3.7, 7):
//   1. opening   the 250-cup customer of the Day 1 routine: gold number ticket "250杯" + S2 "250" (D4),
//                收 → "好，250杯什么？" (D8), the trap and "调你妈！" (E4) with the purple sign shattering,
//                "黄金比例最好喝！" with the lit menu box (E6), the ticket "No.001 / 250杯 / 两个月后取餐" stuck
//                on the forehead (E12), the queue +10 (bonus250, E13), keys locked from E4 to the recap.
//   2. freeplay  a 250-cup customer in normal play (R13): 收 adds bonus250 (+10) and plays NO long scene —
//                the engine never pauses and the next customer arrives within the normal landing pause.
//   3. original  the two-step original-film customer on day 3 (7): 收 → 'step' (the sign flips to a purple
//                闭嘴 sign, "好，250杯什么？") → 闭嘴 → resolve with the big landing (land 'step', +bonus250).
// Usage: (serve game/ first, e.g. python3 -m http.server 8765) node tools/check-signature.mjs [baseUrl]
const pw = (await import('./pw.mjs')).default;

const base = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765';
const KEYMAP = { gun: 'j', shut: 'k', take: 'l' };
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
const check = (scene, id, ok, detail = '') => results.push({ scene, id, ok: !!ok, detail });

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  let fontFails = 0;
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text()) && fontFails > 0) { fontFails--; return; }
    errors.push('console: ' + m.text());
  });
  page.on('requestfailed', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) fontFails++; else errors.push('requestfailed: ' + r.url()); });
  await page.goto(`${base}/index.html?debug&lang=zh&${query}`);
  await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
  await page.waitForTimeout(1300);
  return { page, errors };
}
const press = async (page, key) => { await page.keyboard.down(KEYMAP[key]); await page.waitForTimeout(30); await page.keyboard.up(KEYMAP[key]); };
const state = (page) => page.evaluate(() => {
  const w = window.__250;
  const op = w.opening;
  const s = w.game && w.game.state;
  return {
    beat: op ? op.beat : null, opening: !!(op && op.active), waiting: op ? op.waiting : null,
    phase: s ? s.phase : null, paused: s ? !!s.paused : false, queue: s ? s.queue : null,
    cur: s && s.current ? { id: s.current.customer.id, key: s.current.customer.key, cups: s.current.customer.cups, steps: s.current.customer.steps || null, step: s.current.step || 0, speaking: !!s.current.speaking } : null,
    qnum: document.querySelector('.hud-qnum').textContent,
    locked: document.querySelector('.stage').dataset.locked === '1',
    sub: document.querySelector('.subs').textContent,
    hz: [...document.querySelectorAll('.hz.placed')].map((n) => n.dataset.style + ':' + n.querySelector('text').textContent),
    sign: (() => { const n = document.querySelector('.sign:not(.mini)'); return n ? { kind: n.dataset.kind, state: n.dataset.state, text: n.textContent.replace(/\s+/g, ''), is250: n.classList.contains('is-250') } : null; })(),
    gold: document.querySelector('.shop').hasAttribute('data-gold'),
    plate: document.querySelector('.plate-layer .ticket')?.textContent.replace(/\s+/g, ' ').trim() || '',
  };
});
function hookEvents(page) {
  return page.evaluate(() => {
    window.__ev = [];
    let hooked = null;
    setInterval(() => {
      const g = window.__250.game;
      if (!g || g === hooked) return;
      hooked = g;
      for (const ev of ['arrive', 'ready', 'step', 'resolve', 'bonus']) {
        g.on(ev, (p) => window.__ev.push({ ev, t: performance.now(), id: p.customer && p.customer.id, cups: p.customer && p.customer.cups,
          correct: p.correct, queueDelta: p.queueDelta, land: p.land, line: p.line, paused: g.state.paused }));
      }
    }, 20);
  });
}

// ------------------------------------------------------------------ 1. the routine's 250 customer
async function opening() {
  const { page, errors } = await open('seed=3');
  await page.click('.start-screen .start-btn', { force: true });
  const seen = {};
  const handled = new Set();
  let leak = null;
  const t0 = Date.now();
  let ran = false;
  while (Date.now() - t0 < 90000) {
    const s = await state(page);
    if (s.opening) ran = true;
    if (ran && !s.opening) break; // F4
    const b = s.beat;
    if (b === 'D4' && !seen.D4) {
      await page.waitForTimeout(350);
      seen.D4 = await state(page);
    } else if (b === 'D8' && !seen.D8) {
      seen.D8 = s;
    } else if (b === 'E4' && !seen.E4) {
      await page.waitForTimeout(250);
      seen.E4 = await state(page);
      // keys are dead during the punch: mash all three and make sure nothing moves
      const q = seen.E4.qnum;
      for (const k of ['gun', 'shut', 'take', 'gun']) await press(page, k);
      const after = await state(page);
      leak = after.waiting != null || after.qnum !== q || !after.locked;
    } else if (b === 'E6' && !seen.E6) {
      await page.waitForTimeout(500);
      seen.E6 = await state(page);
    } else if (b === 'E12' && !seen.E12) {
      await page.waitForTimeout(250);
      seen.E12 = await state(page);
    } else if (b === 'F1' && !seen.F1) {
      await page.waitForTimeout(300);
      seen.F1 = await state(page);
    }
    if (s.waiting && !handled.has(b)) { handled.add(b); await page.waitForTimeout(700); await press(page, s.waiting); }
    await page.waitForTimeout(40);
  }
  const d4 = seen.D4 || {};
  check('opening', 'D4 gold 250 ticket + S2', d4.sign && d4.sign.kind === 'take' && d4.sign.is250 && /250/.test(d4.sign.text) && d4.hz.some((h) => /^S2:.*250/.test(h)) && /250/.test(d4.sub),
    `sign ${JSON.stringify(d4.sign)}; 花字 ${d4.hz}; subtitle "${d4.sub}"`);
  check('opening', 'D8 take → "好，250杯什么？"', seen.D8 && /250杯什么/.test(seen.D8.sub), `subtitle "${seen.D8 && seen.D8.sub}"`);
  const e4 = seen.E4 || {};
  check('opening', 'E4 调你妈 + shatter, keys locked', /调你妈/.test(e4.sub) && e4.hz.some((h) => /^S1:调你妈/.test(h)) && leak === false,
    `subtitle "${e4.sub}"; 花字 ${e4.hz}; input leaked: ${leak}`);
  const e6 = seen.E6 || {};
  check('opening', 'E6 黄金比例最好喝 + menu box glow', /黄金比例最好喝/.test(e6.sub) && e6.gold && e6.hz.some((h) => /^S2:黄金比例/.test(h)), `subtitle "${e6.sub}"; gold ${e6.gold}; 花字 ${e6.hz}`);
  const e12 = seen.E12 || {};
  check('opening', 'E12 ticket No.001 / 250杯 / 两个月后取餐', /No\.001/.test(e12.plate) && /250杯/.test(e12.plate) && /两个月后取餐/.test(e12.plate), `ticket "${e12.plate}"`);
  const f1 = seen.F1 || {};
  check('opening', 'E13 queue 2 → 12 (bonus250)', e12.qnum === '2' && f1.qnum === '12', `queue at E12 ${e12.qnum}, at F1 ${f1.qnum}`);
  check('opening', 'errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// Answer every customer correctly (rage: mash J) until want(cur) matches; returns that customer or null.
async function playUntil(page, want, maxMs) {
  const t0 = Date.now();
  let lastId = null;
  let readyAt = null;
  while (Date.now() - t0 < maxMs) {
    const s = await state(page);
    if (s.phase === 'over') return null;
    if (s.phase === 'rage') { await press(page, 'gun'); await page.waitForTimeout(60); continue; }
    const id = s.cur ? `${s.cur.id}:${s.cur.step}` : null;
    if (id !== lastId) { lastId = id; readyAt = null; }
    if (s.cur && !s.cur.speaking && readyAt == null) readyAt = Date.now();
    if (s.cur && want(s.cur) && readyAt != null) return s.cur;
    if (s.cur && readyAt != null && Date.now() - readyAt > 250) {
      await press(page, s.cur.steps ? s.cur.steps[s.cur.step] : s.cur.key);
      readyAt = Infinity;
    }
    await page.waitForTimeout(40);
  }
  return null;
}

// ------------------------------------------------------------------ 2. a 250-cup customer in normal play (?first= puts customer 81, 250 cups, fourth)
async function freeplay() {
  const { page, errors } = await open('skipOpening=1&day=6&seed=5&first=78,63,60,81');
  await hookEvents(page);
  await page.click('.start-screen .start-btn', { force: true });
  let cur = null;
  for (let round = 0; round < 3 && !cur; round++) {
    if (round) await page.evaluate(() => window.__250.startDay(6));
    cur = await playUntil(page, (c) => c.cups === 250 && !c.steps && c.key === 'take', 95000);
  }
  if (!cur) {
    check('freeplay', '250 customer', false, 'no 250-cup customer in 3 rounds');
  } else {
    const n0 = await page.evaluate(() => window.__ev.length);
    await press(page, 'take');
    // collect the 花字 / subtitle emphasis of this answer for 2.5 s
    const seenHz = new Set();
    let em = '';
    let s1 = null;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(100);
      const si = await state(page);
      if (i === 2) s1 = si;
      si.hz.forEach((h) => seenHz.add(h));
      em += await page.evaluate(() => [...document.querySelectorAll('.subs .em')].map((n) => n.textContent).join(''));
    }
    await page.waitForFunction((n) => window.__ev.slice(n).some((e) => e.ev === 'arrive'), n0, { timeout: 8000 }).catch(() => {});
    const ev = await page.evaluate((n) => window.__ev.slice(n), n0);
    const res = ev.find((e) => e.ev === 'resolve');
    const next = ev.find((e) => e.ev === 'arrive');
    const gap = res && next ? next.t - res.t : Infinity;
    check('freeplay', '收 adds bonus250', res && res.correct && res.queueDelta >= 10 && res.land === 'big', `customer ${cur.id}: queueDelta ${res && res.queueDelta}, land ${res && res.land}`);
    check('freeplay', 'no signature scene', !s1.paused && !ev.some((e) => e.paused) && gap < 6000,
      `engine paused ${s1.paused}; next customer ${Math.round(gap)} ms after the answer`);
    // 5.3: a line with 250 / 二百五 gets the S2 gold 花字 (or, when rate-limited, the words emphasised in the subtitle)
    const has250 = /250|二百五|251|520/.test(String(res && res.line));
    const shown250 = [...seenHz].some((h) => /^S2:.*(250|二百五)/.test(h)) || /250|二百五/.test(em);
    check('freeplay', 'S2 "250" on the punch', !has250 || shown250, has250 ? `line "${res.line}"; 花字 ${[...seenHz].join(', ')}; emphasis "${em}"` : `line "${res && res.line}" has no 250 (no S2 expected); 花字 ${[...seenHz].join(', ') || 'none'}`);
  }
  check('freeplay', 'errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// ------------------------------------------------------------------ 3. the two-step original customer (day 3)
// Rage (fury fills fast on day 3) may break into the two steps — every press is then a rage hit; such a
// round is replayed (up to 3 rounds).
async function original() {
  const { page, errors } = await open('skipOpening=1&day=3&seed=9');
  await hookEvents(page);
  await page.click('.start-screen .start-btn', { force: true });
  let done = false;
  let tries = 0;
  for (let round = 0; round < 3 && !done; round++) {
    if (round) await page.evaluate(() => window.__250.startDay(3));
    const cur = await playUntil(page, (c) => Array.isArray(c.steps) && c.step === 0, 80000);
    if (!cur) continue;
    tries++;
    const s0 = await state(page);
    const n0 = await page.evaluate(() => window.__ev.length);
    await press(page, 'take');
    let s1 = null;
    let rage = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      const si = await state(page);
      if (si.phase === 'rage') { rage = true; break; }
      if (si.sign && si.sign.kind === 'shut' && si.sign.state === 'up' && !s1) s1 = si;
      if (s1 && si.cur && si.cur.step === 1 && !si.cur.speaking) break;
      await page.waitForTimeout(60);
    }
    if (rage) continue;
    await page.waitForTimeout(200);
    await press(page, 'shut');
    await page.waitForTimeout(400);
    const s2 = await state(page);
    const ev = await page.evaluate((n) => window.__ev.slice(n), n0);
    const step = ev.find((e) => e.ev === 'step');
    const res = ev.find((e) => e.ev === 'resolve');
    check('original', 'gold sign first', s0.sign && s0.sign.kind === 'take' && /250/.test(s0.sign.text), `sign ${JSON.stringify(s0.sign)}`);
    check('original', '收 → step + purple sign', step && s1 && /少甜少冰/.test(s1.sign.text) && /250杯什么|少甜少冰/.test(s1.sub),
      `step event ${!!step}; sign ${JSON.stringify(s1 && s1.sign)}; subtitle "${s1 && s1.sub}"`);
    check('original', '闭嘴 → 调你妈 big landing', res && res.correct && res.land === 'step' && res.queueDelta >= 10 && /调你妈/.test(s2.sub),
      `resolve correct ${res && res.correct}, land ${res && res.land}, queueDelta ${res && res.queueDelta}; subtitle "${s2.sub}"`);
    done = true;
  }
  if (!done) check('original', 'appears', false, `the original customer never got through both steps (${tries} tries, rage or no show)`);
  check('original', 'errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

for (const [name, fn] of [['opening', opening], ['freeplay', freeplay], ['original', original]]) {
  process.stderr.write(`[signature] ${name}…\n`);
  try { await fn(); } catch (err) { check(name, 'crash', false, err.message.split('\n')[0]); }
}
await browser.close();
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.scene}: ${r.id}${r.detail ? `  [${r.detail}]` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
