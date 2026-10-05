// shot-stage2.mjs — screenshots of the gameplay v2 stage 2 screens (docs/gameplay-v2.md 5–6) for a visual check:
// day card (start card + in-round banner), fast mouth with the preview, the day-4 meter, each mini event, a group box,
// the change-order flip, the boss (and his hold step), the shutter and the summary card with stars and rating.
// An in-page player answers every sign right (700 ms after t0, holds on the boss's last step, mashes events).
// Writes tools/shots/s2-*.png (gitignored) and reports page errors and anything sticking out of the stage.
// Usage: (serve game/ first) node tools/shot-stage2.mjs [baseUrl] [--days=2,4,5,6,7] [--lang=zh]
const pw = (await import('./pw.mjs')).default;

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const base = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765').replace(/\/$/, '');
const days = String(arg('days', '2,3,4,5,6,7')).split(',').map(Number);
const lang = arg('lang', 'zh');
const out = new URL('./shots/', import.meta.url).pathname;
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const issues = [];

async function shotDay(day) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (r) => r.abort());
  page.on('pageerror', (e) => errors.push(`day ${day}: ${e.message}`));
  await page.goto(`${base}/index.html?debug&skipOpening=1&day=${day}&lite=1&seed=2&lang=${lang}`);
  await page.waitForFunction(() => window.__250);
  await page.evaluate(() => { try { localStorage.setItem('250cups.openingDone', '1'); } catch { /* */ } });
  await page.reload();
  await page.waitForFunction(() => window.__250);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${out}s2-d${day}-start.png` });
  await page.click('.start-screen .start-btn', { force: true });
  await page.waitForFunction(() => window.__250?.game?.state.phase === 'playing');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}s2-d${day}-banner.png` });
  await page.evaluate(() => {
    const W = window.__250; const g = W.game;
    const KEY = { gun: 'j', shut: 'k', take: 'l' };
    const tap = (k, hold = 40) => { window.dispatchEvent(new KeyboardEvent('keydown', { key: KEY[k] })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: KEY[k] })), hold); };
    g.on('ready', ({ customer, step }) => setTimeout(() => {
      const c = g.state.current;
      if (c && c.customer === customer) tap(c.key, customer.boss && step === 7 ? 900 : 40);
    }, 700));
    g.on('groupHit', ({ key }) => setTimeout(() => tap(key), 220));
    const mash = () => {
      const st = g.state;
      if (st.phase === 'over') return;
      if (st.phase === 'rage' || (st.event && st.event.type !== 'calculator')) tap(st.event?.type === 'stamp' ? 'take' : 'gun');
      if (st.event && st.event.type === 'calculator' && !st.event.holding) tap('take', 380);
      setTimeout(mash, 260);
    };
    mash();
  });
  const seen = new Set();
  const want = {
    quick: (s) => s.quick && s.current && s.current.quick && !s.current.speaking,
    meter: (s) => s.meter > 0 && s.current,
    event: (s) => s.event && s.event.type !== 'shutter' && s.event.elapsedMs > 250,
    group: (s) => s.current && s.current.customer.group && !s.current.speaking,
    flip: (s) => s.current && s.current.flipped,
    boss: (s) => s.current && s.current.customer.boss && s.current.step === 3 && !s.current.speaking,
    bossHold: (s) => s.current && s.current.customer.boss && s.current.step === 7 && !s.current.speaking,
    shutter: (s) => s.shutter && s.timeLeftMs < 3500,
  };
  const t0 = Date.now();
  while (Date.now() - t0 < 100000) {
    const s = await page.evaluate(() => { const st = window.__250.game.state; return { ...st, current: st.current && { ...st.current, customer: { group: !!st.current.customer.group, boss: !!st.current.customer.boss } } }; });
    if (s.phase === 'over') break;
    for (const [name, ok] of Object.entries(want)) {
      if (!seen.has(name) && ok(s)) {
        seen.add(name);
        await page.screenshot({ path: `${out}s2-d${day}-${name}.png` });
        const bad = await page.evaluate(() => {
          const st = document.querySelector('.stage').getBoundingClientRect();
          const list = [];
          for (const sel of ['.preview', '.meter', '.event-panel', '.group-row .group-head', '.day-banner', '.hud-quick']) {
            for (const n of document.querySelectorAll(sel)) {
              if (n.hidden || !n.getClientRects().length) continue;
              const r = n.getBoundingClientRect();
              if (r.width && (r.left < st.left - 1 || r.right > st.right + 1)) list.push(`${sel} out of stage (${Math.round(r.left)}..${Math.round(r.right)})`);
            }
          }
          return list;
        });
        issues.push(...bad.map((b) => `day ${day} ${name}: ${b}`));
      }
    }
    await page.waitForTimeout(80);
  }
  await page.waitForFunction(() => !document.querySelector('.overlay.summary.hidden') && document.querySelector('.overlay.summary .report'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}s2-d${day}-summary.png` });
  const card = await page.evaluate(() => {
    const c = document.querySelector('.overlay.summary .card');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, h: innerHeight };
  });
  if (card && (card.top < 0 || card.bottom > card.h + 1)) issues.push(`day ${day} summary card overflows (${Math.round(card.top)}..${Math.round(card.bottom)} of ${card.h})`);
  console.log(`day ${day}: ${[...seen].join(', ') || '-'}`);
  await page.close();
}

for (const d of days) await shotDay(d);
await browser.close();
for (const i of issues) console.log('WARN', i);
for (const e of errors) console.log('ERROR', e);
process.exit(errors.length ? 1 : 0);
