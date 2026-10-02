// QA matrix: plays full rounds of index.html in 3 viewports × 7 scenarios and checks layout,
// console errors, hit areas, clipped text, summary card and language switching.
// Game time is fast-forwarded with game.tick() (via ?debug's window.__250) so a 90 s round
// takes a couple of seconds; key presses go through the real keyboard / pointer input path.
// Usage: (serve /home/user/testDemo/game on :8765) node tools/qa.mjs [baseUrl] [--only=scenario]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
pw = (await import('./pw.mjs')).default;

const base = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765';
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const out = new URL('./shots/', import.meta.url).pathname;
const VIEWPORTS = [['390x844', 390, 844], ['360x640', 360, 640], ['1280x800', 1280, 800]];
const SCENARIOS = ['correct', 'wrong', 'idle', 'charge', 'rage', 'english', 'bleep'];
const KEYMAP = { gun: 'j', shut: 'k', take: 'l' };
const WRONG = { gun: 'shut', shut: 'take', take: 'gun' };

const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

// ------------------------------------------------------------------ in-page checks
function layoutCheck() {
  const issues = [];
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  if (document.documentElement.scrollWidth > vw + 1) issues.push(`page h-scroll (${document.documentElement.scrollWidth}>${vw})`);
  const stage = document.querySelector('.stage');
  const shaking = /shake-|zoomout/.test(stage.className);
  const visible = (n) => {
    if (!n.isConnected || n.closest('.hidden')) return false;
    const cs = getComputedStyle(n);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const sels = ['.hud-row', '.hud-queue', '.hud-time', '.tog', '.bar', '.hud-combo', '.btn', '.btn-label', '.sub', '.bubble',
    '.bubble-text', '.cust-name', '.menu-board', '.counter-plaque', '.clerk-tag', '.queue-outside', '.card', '.card-title',
    '.card-sub', '.key-row', '.big-btn', '.stat', '.stat-val', '.stat-label', '.best-line', '.ms-text', '.ms-card'];
  for (const sel of sels) {
    for (const n of document.querySelectorAll(sel)) {
      if (!visible(n)) continue;
      const r = n.getBoundingClientRect();
      if (!shaking && (r.left < -1 || r.right > vw + 1)) issues.push(`${sel} off-screen x ${Math.round(r.left)}..${Math.round(r.right)}`);
      if (!shaking && (r.top < -1 || r.bottom > vh + 1) && !n.closest('.overlay')) issues.push(`${sel} off-screen y ${Math.round(r.top)}..${Math.round(r.bottom)}`);
      const cs = getComputedStyle(n);
      if (n.scrollWidth > n.clientWidth + 1 && cs.overflowX !== 'visible') issues.push(`${sel} clipped x "${n.textContent.slice(0, 24)}"`);
      if (n.scrollHeight > n.clientHeight + 2 && cs.overflowY === 'hidden') issues.push(`${sel} clipped y "${n.textContent.slice(0, 24)}"`);
      if (cs.textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth) issues.push(`${sel} ellipsis "${n.textContent.slice(0, 24)}"`);
    }
  }
  for (const row of document.querySelectorAll('.menu-row')) {
    const [a, b] = row.children;
    if (a && b && visible(row) && a.getBoundingClientRect().right > b.getBoundingClientRect().left - 1) issues.push(`.menu-row text overlaps price "${a.textContent}"`);
  }
  // Overlay card must be reachable: either fully on screen or its overlay scrolls.
  for (const ov of document.querySelectorAll('.overlay:not(.hidden)')) {
    const card = ov.querySelector('.card');
    if (!card) continue;
    const r = card.getBoundingClientRect();
    const btn = card.querySelector('.big-btn');
    const scrolls = ov.scrollHeight > ov.clientHeight && /auto|scroll/.test(getComputedStyle(ov).overflowY);
    if ((r.bottom > vh + 1 || r.top < -1) && !scrolls) issues.push(`overlay card cut off (${Math.round(r.top)}..${Math.round(r.bottom)} of ${vh})`);
    if (btn) {
      const b = btn.getBoundingClientRect();
      if (b.bottom > vh && !scrolls) issues.push('big-btn below fold');
    }
  }
  // Hit areas: >= 44px tall for game buttons / big buttons, >= 32 for toggles, and topmost at centre.
  const hit = (sel, minW, minH) => {
    for (const n of document.querySelectorAll(sel)) {
      if (!visible(n)) continue;
      const r = n.getBoundingClientRect();
      if (r.width < minW || r.height < minH) issues.push(`${sel} small hit area ${Math.round(r.width)}x${Math.round(r.height)}`);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue;
      const top = document.elementFromPoint(cx, cy);
      if (!top || (top !== n && !n.contains(top))) issues.push(`${sel} covered by ${top ? top.className || top.tagName : 'nothing'}`);
    }
  };
  const overlayUp = !!document.querySelector('.overlay:not(.hidden)');
  if (!overlayUp && !shaking) hit('.btn', 60, 44);
  if (!shaking) hit('.tog', 32, 24);
  hit('.overlay:not(.hidden) .big-btn', 120, 44);
  return issues;
}

function cjkTexts() {
  // Visible text nodes containing CJK (for checking the English UI). Emoji are fine.
  const res = [];
  const walker = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!el || el.closest('.hidden') || !/[㐀-鿿　-〿＀-￯]/.test(t.data)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.tog-lang')) continue; // 中/EN toggle is intentionally bilingual
    res.push(`${el.className || el.tagName}: ${t.data.trim().slice(0, 20)}`);
  }
  return res;
}

// ------------------------------------------------------------------ scenario runner
async function run(vpName, w, h, scenario) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, isMobile: false });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const issues = new Set();
  const notes = [];
  const shot = (tag) => page.screenshot({ path: `${out}qa-${vpName}-${scenario}-${tag}.png` });
  const check = async (tag) => { for (const i of await page.evaluate(layoutCheck)) issues.add(`[${tag}] ${i}`); };
  const st = () => page.evaluate(() => {
    const s = window.__250.game.state;
    return { phase: s.phase, paused: !!s.paused, queue: s.queue, combo: s.combo, aura: s.aura, fury: s.fury, t: s.timeLeftMs, stats: s.stats,
      cur: s.current && { key: s.current.customer.key, id: s.current.customer.id, cups: s.current.customer.cups } };
  });
  const tick = (ms) => page.evaluate((ms) => window.__250.game.tick(ms), ms);
  const tap = async (key, hold = 0) => {
    await page.keyboard.down(KEYMAP[key]);
    if (hold) await page.waitForTimeout(hold);
    await page.keyboard.up(KEYMAP[key]);
  };

  await page.goto(`${base}/index.html?debug&lang=zh`);
  await page.waitForSelector('.overlay.start:not(.hidden) .big-btn');
  await page.evaluate(() => {
    window.__log = [];
    for (const ev of ['arrive', 'resolve', 'polite', 'rageStart', 'rageHit', 'rageEnd', 'milestone', 'over', 'charge'])
      window.__250.game.on(ev, (p) => window.__log.push({ ev, ...(ev === 'resolve' ? { correct: p.correct, charge: p.charge, queueDelta: p.queueDelta, id: p.customer?.id } : ev === 'charge' ? { level: p.level } : {}) }));
    const a = window.__250.audio;
    window.__audio = { bleep: [], speak: [] };
    const sb = a.setBleep; a.setBleep = (on) => { window.__audio.bleep.push(on); return sb(on); };
    const sp = a.speak; a.speak = (t, o) => { window.__audio.speak.push(t); return sp(t, o); };
  });
  await page.waitForTimeout(450); // let the start card's pop-in animation finish before measuring
  await check('start');
  if (scenario === 'correct') await shot('start');

  if (scenario === 'english') {
    await page.click('.tog-lang');
    await page.waitForTimeout(450);
    const cjk = await page.evaluate(cjkTexts);
    cjk.forEach((c) => issues.add('[en-start] CJK left: ' + c));
    await check('en-start');
    await shot('start');
  }
  if (scenario === 'bleep') {
    await page.click('.tog-bleep');
    const s = await page.evaluate(() => ({ ls: localStorage.getItem('250cups.bleep'), aria: document.querySelector('.tog-bleep').getAttribute('aria-pressed'), calls: window.__audio.bleep }));
    if (s.ls !== '1' || s.aria !== 'true' || s.calls.at(-1) !== true) issues.add('[bleep] toggle on not applied ' + JSON.stringify(s));
    // persists across reload
    await page.reload();
    await page.waitForSelector('.overlay.start:not(.hidden) .big-btn');
    const aria2 = await page.$eval('.tog-bleep', (b) => b.getAttribute('aria-pressed'));
    if (aria2 !== 'true') issues.add('[bleep] not persisted after reload');
    await page.evaluate(() => {
      window.__audio = { speak: [], bleepSfx: 0 };
      const a = window.__250.audio;
      const sp = a.speak; a.speak = (t, o) => { window.__audio.speak.push(t); return sp(t, o); };
    });
  }

  await page.click('.overlay.start .big-btn', { force: true });
  await page.waitForTimeout(150);
  let s = await st();
  if (s.phase !== 'playing') issues.add('did not start: ' + s.phase);
  await check('playing');
  if (scenario !== 'idle') await shot('playing');

  let presses = 0, guard = 0, shotRage = false, shotMs = false, charged = [], sigSkips = 0, earlyResolve = [];
  const t0 = Date.now();
  while (guard++ < 3000) {
    s = await st();
    if (s.phase === 'over') break;
    if (scenario === 'idle') { await tick(100); continue; }
    // 250 signature scene (once per round, on a correct "take" for a 250-cup customer): the engine
    // pauses and input is locked. Skip it the way a player would (tap; skips are ignored for 600ms).
    if (s.paused) {
      sigSkips++;
      await page.waitForTimeout(650);
      const b = await page.locator('.sig-skip').boundingBox();
      if (!b) issues.add('[signature] paused without a skip layer');
      else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(50);
      continue;
    }
    if (s.phase === 'rage') {
      await tap('gun'); presses++;
      if (!shotRage) {
        shotRage = true;
        for (let i = 0; i < 4; i++) { await tap(['gun', 'shut', 'take'][i % 3]); presses++; }
        await page.waitForTimeout(450);
        await check('rage'); await shot('rage');
      }
      await tick(250);
      continue;
    }
    if (!s.cur) { await tick(120); continue; }
    if (await page.$('.milestone:not(.hidden)') && !shotMs && scenario === 'correct') {
      shotMs = true; await page.waitForTimeout(200); await check('milestone'); await shot('milestone');
    }
    await tick(scenario === 'correct' && presses % 3 === 0 ? 500 : 300); // reaction time (some perfect, some not)
    s = await st();
    if (!s.cur || s.phase !== 'playing') continue;
    let key = scenario === 'wrong' ? WRONG[s.cur.key] : s.cur.key;
    // A correct "take" on a 250-cup customer starts the signature scene, which locks input, so a hold
    // there cannot charge by design; only sample charge levels on other customers.
    if (scenario === 'charge' && charged.length < 4 && !(s.cur.key === 'take' && s.cur.cups === 250)) {
      // Real pointer hold on the on-screen button: 900ms (charge 2), 450ms (charge 1), tap (0).
      const hold = [900, 450, 50, 1000][charged.length];
      const box = await page.locator(`.btn-${key}`).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const before = await page.evaluate(() => window.__log.filter((e) => e.ev === 'resolve').length);
      await page.mouse.down();
      await page.waitForTimeout(40);
      // Press resolves on press-down; holding only adds force afterwards.
      earlyResolve.push((await page.evaluate(() => window.__log.filter((e) => e.ev === 'resolve').length)) > before);
      await page.waitForTimeout(Math.max(0, hold - 160));
      if (charged.length === 0) { await page.waitForTimeout(60); await shot('holding'); }
      await page.waitForTimeout(60);
      await page.mouse.up();
      charged.push(hold); presses++;
      await page.waitForTimeout(80);
      if (charged.length === 1) { await check('charge-hit'); await shot('charge-hit'); }
      continue;
    }
    await tap(key); presses++;
    if (scenario === 'wrong' && presses === 3) { await page.waitForTimeout(80); await check('miss'); await shot('miss'); }
    if (scenario === 'english' && presses === 5) {
      await page.waitForTimeout(80);
      const cjk = await page.evaluate(cjkTexts);
      cjk.forEach((c) => issues.add('[en-playing] CJK left: ' + c));
      await check('en-playing'); await shot('playing2');
    }
    if (scenario === 'bleep' && presses === 1) await page.waitForTimeout(50);
  }
  const log = await page.evaluate(() => window.__log);
  const count = (ev) => log.filter((e) => e.ev === ev).length;
  s = await st();
  if (s.phase !== 'over') issues.add('round did not end');
  if (scenario === 'idle') {
    notes.push(`polite×${count('polite')} ended at ${(90 - s.t / 1000).toFixed(1)}s game time`);
    await page.waitForTimeout(100);
    if (count('polite') === 0) issues.add('no polite');
    if (90 - s.t / 1000 > 20) issues.add('idle round not short');
  }
  if (scenario === 'charge') {
    // Charge level per press = highest 'charge' event between this resolve and the next one.
    const ch = []; let lv = -1;
    for (const e of log) {
      if (e.ev === 'resolve') { if (lv >= 0) ch.push(lv); lv = 0; }
      if (e.ev === 'charge') lv = Math.max(lv, e.level);
      if (ch.length === 4) break;
    }
    notes.push('charges ' + JSON.stringify(ch) + ' ids ' + JSON.stringify(log.filter((e) => e.ev === 'resolve').slice(0, 4).map((e) => e.id)) + ' resolvedOnDown ' + JSON.stringify(earlyResolve));
    if (earlyResolve.some((x) => !x)) issues.add('press did not resolve on press-down ' + JSON.stringify(earlyResolve));
    if (JSON.stringify(ch) !== '[2,1,0,2]') issues.add('charge levels wrong ' + JSON.stringify(ch));
  }
  if (scenario === 'rage') { notes.push(`rage×${count('rageStart')} hits ${count('rageHit')}`); if (!count('rageHit')) issues.add('no rage hits'); }
  if (scenario === 'wrong') notes.push(`wrong presses ${presses}, ended at ${(90 - s.t / 1000).toFixed(1)}s, aura ${s.aura}`);
  if (scenario === 'correct') notes.push(`queue ${s.queue} maxCombo ${log.length && (await page.evaluate(() => window.__250.game.state.maxCombo))} rage×${count('rageStart')} milestones ${count('milestone')} signatureSkips ${sigSkips}`);
  if (sigSkips > 3) issues.add(`signature scene needed ${sigSkips} skip taps`);
  // Summary card
  try { await page.waitForSelector('.overlay.summary:not(.hidden)', { timeout: 3000 }); }
  catch { issues.add('summary card missing'); }
  await page.waitForTimeout(500);
  await check('summary');
  await shot('summary');
  const summaryText = await page.$eval('.overlay.summary', (n) => n.innerText).catch(() => '');
  if (/undefined|NaN|null/.test(summaryText)) issues.add('summary shows undefined/NaN: ' + summaryText.replace(/\n/g, ' | '));
  if (scenario === 'english') {
    const cjk = await page.evaluate(cjkTexts);
    cjk.forEach((c) => issues.add('[en-summary] CJK left: ' + c));
  }
  if (scenario === 'bleep') {
    const sp = await page.evaluate(() => window.__audio.speak.length);
    notes.push(`speak calls ${sp}`);
  }
  // Play again
  await page.click('.overlay.summary .big-btn', { force: true });
  await page.waitForTimeout(150);
  if ((await st()).phase !== 'playing') issues.add('play-again failed');
  for (const e of errors) issues.add(e);
  await ctx.close();
  return { vp: vpName, scenario, presses, secs: ((Date.now() - t0) / 1000).toFixed(1), ok: issues.size === 0, issues: [...issues], notes };
}

const results = [];
for (const [name, w, h] of VIEWPORTS) {
  for (const sc of SCENARIOS) {
    if (only && sc !== only) continue;
    const r = await run(name, w, h, sc);
    results.push(r);
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${name} ${sc} presses=${r.presses} ${r.notes.join('; ')}`);
    for (const i of r.issues.slice(0, 25)) console.log('   - ' + i);
  }
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
