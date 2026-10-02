// Browser check for the 250 signature scene: start a ?debug round, answer every customer correctly
// with the real keyboard until a 250-cup customer arrives, press "take" (L), then verify that
//   1. the scene starts (engine paused, skip layer visible, first signature250 line on screen),
//   2. J/K/L and the on-screen buttons do nothing while it plays (no resolve/charge, queue unchanged),
//   3. when it ends the queue grows by exactly SIGNATURE_BONUS (25) and play resumes,
//   4. it plays only once per round.
// Runs twice: once letting the scene finish on its own, once skipping it with a tap.
// Usage: (serve game/ on :8765) node tools/check-signature.mjs [baseUrl]
const pw = (await import('./pw.mjs')).default;

const base = process.argv[2] || 'http://127.0.0.1:8765';
const BONUS = 25;
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const KEYMAP = { gun: 'j', shut: 'k', take: 'l' };
const results = [];

async function run(mode) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const fail = [];
  const st = () => page.evaluate(() => {
    const s = window.__250.game.state;
    return { phase: s.phase, paused: !!s.paused, queue: s.queue, cur: s.current && { id: s.current.customer.id, key: s.current.customer.key, cups: s.current.customer.cups } };
  });
  await page.goto(`${base}/index.html?debug&lang=zh`);
  await page.waitForSelector('.overlay.start:not(.hidden) .big-btn');
  await page.evaluate(() => {
    window.__log = [];
    for (const ev of ['resolve', 'charge', 'bonus']) window.__250.game.on(ev, (p) => window.__log.push({ ev, q: p.queueDelta }));
  });
  await page.click('.overlay.start .big-btn', { force: true });

  // Answer correctly until a 250-cup customer is at the counter (rage is played through with J).
  let s, guard = 0;
  while (guard++ < 2000) {
    s = await st();
    if (s.phase === 'over') { fail.push('round ended before a 250-cup customer'); break; }
    if (s.phase === 'rage') { await page.keyboard.press('j'); await page.waitForTimeout(60); continue; }
    if (!s.cur) { await page.waitForTimeout(40); continue; }
    if (s.cur.cups === 250 && s.cur.key === 'take') break;
    await page.keyboard.press(KEYMAP[s.cur.key]);
    await page.waitForTimeout(40);
  }
  const target = s.cur;
  let info = { mode, customer: target?.id };
  if (target && !fail.length) {
    await page.keyboard.press('l');
    await page.waitForTimeout(250);
    s = await st();
    const firstLine = await page.evaluate(() => window.__250.getContent('zh').system.signature250[0].text.replace(/（[^）]*）/g, ''));
    const scene = await page.evaluate(() => ({
      layer: !!document.querySelector('.sig-skip:not(.hidden)'),
      subs: document.querySelector('.subs').innerText,
    }));
    if (!s.paused) fail.push('engine not paused after the 250 take');
    if (!scene.layer) fail.push('skip layer not visible');
    if (!scene.subs.includes(firstLine)) fail.push(`first signature line not shown (subs: ${scene.subs})`);
    const qDuring = s.queue;
    const logLen = await page.evaluate(() => window.__log.length);

    // Input is locked: keys and on-screen buttons do nothing.
    for (const k of ['j', 'k', 'l', 'j']) { await page.keyboard.press(k); await page.waitForTimeout(30); }
    for (const b of ['gun', 'shut', 'take']) await page.locator(`.btn-${b}`).dispatchEvent('pointerdown').catch(() => {});
    await page.waitForTimeout(100);
    s = await st();
    const leaked = await page.evaluate((n) => window.__log.slice(n).filter((e) => e.ev !== 'bonus'), logLen);
    if (leaked.length) fail.push('input leaked during the scene: ' + JSON.stringify(leaked));
    if (s.queue !== qDuring) fail.push(`queue changed during the scene ${qDuring} -> ${s.queue}`);
    if (!s.paused) fail.push('J/K/L or buttons ended the scene');

    const t0 = Date.now();
    if (mode === 'skip') {
      await page.waitForTimeout(700); // skips are ignored for the first 600ms
      await page.locator('.sig-skip').click();
    }
    await page.waitForFunction(() => !window.__250.game.state.paused, null, { timeout: 90000 }).catch(() => fail.push('scene never ended'));
    await page.waitForTimeout(100);
    s = await st();
    const ms = Date.now() - t0;
    const bonus = await page.evaluate(() => window.__log.filter((e) => e.ev === 'bonus').map((e) => e.q));
    if (s.queue !== qDuring + BONUS) fail.push(`queue after scene ${s.queue}, expected ${qDuring}+${BONUS}`);
    if (JSON.stringify(bonus) !== JSON.stringify([BONUS])) fail.push('bonus events ' + JSON.stringify(bonus));
    if (await page.$('.sig-skip:not(.hidden)')) fail.push('skip layer still visible after the scene');
    info = { ...info, queueAtScene: qDuring, queueAfter: s.queue, sceneMs: ms };

    // Once per round: another 250-cup customer does not replay it.
    guard = 0;
    let replay = false;
    while (guard++ < 2000) {
      s = await st();
      if (s.phase === 'over') break;
      if (s.paused) { replay = true; break; }
      if (s.phase === 'rage') { await page.keyboard.press('j'); await page.waitForTimeout(60); continue; }
      if (!s.cur) { await page.evaluate(() => window.__250.game.tick(100)); continue; }
      await page.keyboard.press(KEYMAP[s.cur.key]);
      await page.evaluate(() => window.__250.game.tick(150));
    }
    if (replay) fail.push('signature scene played twice in one round');
  }
  fail.push(...errors);
  await page.close();
  results.push({ ...info, ok: fail.length === 0, fail });
}

await run('natural');
await run('skip');
await browser.close();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${JSON.stringify({ ...r, fail: undefined })}${r.fail.map((f) => '\n   - ' + f).join('')}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
