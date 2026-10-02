// Screenshot every ui-demo.html state at 390x844 and check for layout overflow.
// Usage: (serve /home/user/testDemo/game on :8765) node tools/shot-ui.mjs [baseUrl]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
pw = (await import('./pw.mjs')).default;

const base = process.argv[2] || 'http://127.0.0.1:8765';
const out = new URL('./shots/', import.meta.url).pathname;
const states = ['start', 'playing', 'hit', 'fly', 'perfect', 'miss', 'g250', 'polite', 'rage', 'milestone', 'chuuni', 'summary', 'en', 'enSummary'];
const viewports = [[390, 844], [360, 640], [1280, 800]];

const browser = await pw.chromium.launch();
let problems = 0;
for (const [w, h] of viewports) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const s of states) {
    if (w !== 390 && !['playing', 'rage', 'summary', 'start'].includes(s)) continue;
    await page.goto(`${base}/ui-demo.html?clean&state=${s}`);
    await page.waitForTimeout(s === 'fly' ? 330 : s === 'milestone' ? 350 : 250);
    const report = await page.evaluate(() => {
      const st = document.querySelector('.stage');
      const shaking = /shake-/.test(st.className); // shake intentionally moves content for 0.4s
      const stage = st.getBoundingClientRect();
      const issues = [];
      if (document.documentElement.scrollWidth > innerWidth) issues.push('page horizontal scroll');
      if (stage.right > innerWidth + 1 || stage.bottom > innerHeight + 1) issues.push('stage exceeds viewport');
      for (const sel of ['.hud', '.hud-row', '.pad', '.btn', '.btn-label', '.subs', '.queue-strip', '.bubble', '.counter-plaque', '.card', '.tog']) {
        for (const n of document.querySelectorAll(sel)) {
          if (!n.offsetParent) continue;
          const r = n.getBoundingClientRect();
          if (!shaking && (r.left < stage.left - 1 || r.right > stage.right + 1)) issues.push(`${sel} out of stage x (${Math.round(r.left)}..${Math.round(r.right)})`);
          if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible') issues.push(`${sel} clipped content`);
        }
      }
      return issues;
    });
    const file = `${out}${w}x${h}-${s}.png`;
    await page.screenshot({ path: file });
    const all = [...report, ...errors.splice(0)];
    if (all.length) problems++;
    console.log(`${all.length ? 'WARN' : 'ok  '} ${w}x${h} ${s}${all.length ? ' -> ' + all.join('; ') : ''}`);
  }
  await page.close();
}
await browser.close();
process.exit(problems ? 1 : 0);
