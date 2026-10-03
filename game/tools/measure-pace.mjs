// measure-pace.mjs — day 1 pace (docs/first-minute-spec.md 4.2: about 13 customers in the 45 s day 1).
// Opens index.html?debug&skipOpening=1&seed=N (day 1 free play, no opening) and answers every customer with the
// right key a fixed reaction time after
//   --from=t0    the answer window opens ('ready', t0: the customer has (nearly) finished talking; default), or
//   --from=sign  the sign is up (arrive + enterMs + 280; a press while the customer still talks is a cut-in).
// Voice timings come from the voice pack manifest (real clip lengths), so the numbers hold even where headless
// Chromium plays no sound. Prints, per seed: customers served, timeouts, cut-ins, queue, and the mean split of
// one customer (arrive → t0 or sign up, reaction, press → next arrive = clerk line + landing).
// Exits 1 on a page error, or when the mean served count is below --min (default 0 = report only).
// Usage: (serve game/ first) node tools/measure-pace.mjs [baseUrl] [--reaction=700] [--from=t0|sign]
//        [--seeds=1,2,3] [--lang=zh] [--min=N]
const pw = (await import('./pw.mjs')).default;

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const base = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765').replace(/\/$/, '');
const reaction = Number(arg('reaction', 700));
const from = arg('from', 't0') === 'sign' ? 'sign' : 't0';
const seeds = String(arg('seeds', '1,2,3')).split(',').map(Number);
const lang = arg('lang', 'zh');
const min = Number(arg('min', 0));

const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
const errors = [];
for (const seed of seeds) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`seed ${seed}: ${e.message}`));
  await page.goto(`${base}/index.html?debug&skipOpening=1&day=1&lite=1&seed=${seed}&lang=${lang}`);
  await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
  await page.waitForTimeout(1300); // the start button takes taps after 1200 ms
  await page.click('.start-screen .start-btn', { force: true });
  await page.waitForFunction(() => window.__250?.game?.state.phase === 'playing', null, { timeout: 10000 });
  // In-page auto player (timers in the page, so the reaction is exact).
  await page.evaluate(({ reactionMs, from }) => {
    const g = window.__250.game;
    const signUpMs = (window.__250.info.enterMs ?? 300) + 280;
    const KEY = { gun: 'j', shut: 'k', take: 'l' };
    const log = { visits: [], polite: 0, cutIns: 0, done: false, summary: null };
    window.__pace = log;
    const tap = (k) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: KEY[k], bubbles: true }));
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: KEY[k], bubbles: true })), 40);
    };
    const answer = (customer, step, v) => {
      const cur = g.state.current;
      if (!cur || cur.customer !== customer || cur.step !== step || (from === 't0' && cur.speaking)) return;
      if (cur.speaking) log.cutIns += 1;
      if (v.press == null) v.press = performance.now();
      tap(Array.isArray(customer.steps) ? customer.steps[step] : customer.key);
    };
    const visit = (customer) => {
      const v = { arrive: performance.now(), press: null };
      log.visits.push(v);
      if (from === 'sign') setTimeout(() => answer(customer, 0, v), signUpMs + reactionMs);
    };
    const cur0 = g.state.current; // the first customer arrived inside game.start()
    if (cur0) visit(cur0.customer);
    g.on('arrive', ({ customer }) => visit(customer));
    g.on('ready', ({ customer, step }) => {
      const v = log.visits[log.visits.length - 1];
      // t0 mode, and the second step of a two-step customer in both modes
      if (from === 't0' || step > 0) setTimeout(() => answer(customer, step, v), reactionMs);
    });
    g.on('polite', () => { log.polite += 1; });
    g.on('over', ({ summary }) => { log.done = true; log.summary = summary; });
  }, { reactionMs: reaction, from });
  await page.waitForFunction(() => window.__pace?.done, null, { timeout: 90000, polling: 250 });
  const log = await page.evaluate(() => window.__pace);
  // per-customer split over complete visits (arrive → press → next arrive)
  const full = log.visits.slice(0, -1).map((v, i) => ({ ...v, next: log.visits[i + 1].arrive })).filter((v) => v.press != null);
  const mean = (f) => (full.length ? Math.round(full.reduce((a, v) => a + f(v), 0) / full.length) : 0);
  const r = {
    seed,
    served: log.summary.served,
    arrivals: log.visits.length,
    timeouts: log.polite,
    cutIns: log.cutIns,
    queue: log.summary.queue,
    talkMs: mean((v) => v.press - v.arrive - reaction),
    landMs: mean((v) => v.next - v.press),
  };
  r.cycleMs = r.talkMs + reaction + r.landMs;
  results.push(r);
  console.log(`seed ${seed}: served ${r.served} (arrivals ${r.arrivals}, timeouts ${r.timeouts}, cut-ins ${r.cutIns}, queue ${r.queue}) · ` +
    `per customer ${r.cycleMs} ms = arrive→${from === 't0' ? 't0' : 'sign up'} ${r.talkMs} + reaction ${reaction} + press→next ${r.landMs}`);
  await context.close();
}
await browser.close();

const avg = results.reduce((a, r) => a + r.served, 0) / results.length;
console.log(`\nday 1 (${lang}, reaction ${reaction} ms after ${from === 't0' ? 'the window opens' : 'the sign is up'}): ` +
  `mean ${avg.toFixed(1)} customers served in 45 s (min ${Math.min(...results.map((r) => r.served))}, ` +
  `max ${Math.max(...results.map((r) => r.served))}; spec target about 13)`);
if (errors.length) { console.log('\nPage errors:\n  ' + errors.join('\n  ')); process.exit(1); }
if (min > 0 && avg < min) { console.log(`FAIL: mean below --min=${min}`); process.exit(1); }
