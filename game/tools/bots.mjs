// bots.mjs — four scripted players for balance checks (docs/gameplay-v2.md 8, acceptance metrics).
// Opens index.html?debug&skipOpening=1&day=N&lite=1&seed=S and plays the whole day in real time with an in-page
// bot (timers in the page, so reactions are exact). Profiles:
//   expert  cuts in (sign up + 300 ms) with the right key, holds it 900 ms (charge 2), jabs twice while the
//           customer flies, then presses every 120 ms until the next customer is called; mashes every 90 ms in rage
//   normal  answers the right key 700 ms after t0 (tap), jabs 300 and 600 ms later, then a press every 300 ms from
//           1.2 s after the answer until the next customer comes ("下一位"); mashes every 220 ms in rage
//   sloppy  answers 300–2700 ms after t0, 25 % with a wrong key; a press every 600 ms from 1.5 s after the
//           answer while nobody is at the counter; mashes every 400 ms in rage
//   masher  never looks: a random key every 300 ms, all the time
// Bot randomness is seeded (seed, profile), so a run is repeatable up to browser timer jitter.
//
// Per run (one JSON line): queue, ★1 threshold and pass, served, served per 90 s, presses, dead presses (no
// response at all: the engine ignored them), feedback presses per 10 s, rage count, queue gained in rage and its
// share, max combo, timeouts, early close (the day ended before its clock ran out).
// Input outcomes come from window.__250.inputs when main.js exposes it (answer / wrong / jab / next / rage /
// buffered / dead …); otherwise the bot wraps game.press (null = dead), which is how the old build is measured.
// Then a summary per profile × day (means over the seeds), the expert / normal ratio and the masher vs ★1.
//
// Usage: (serve game/ first) node tools/bots.mjs [baseUrl] [--profiles=expert,normal,sloppy,masher]
//        [--days=1,2,3,4,5,6,7] [--seeds=1,2,3] [--par=7] [--out=file.jsonl] [--duration=ms]
// Exits 1 on a page error. Runs take the day's real length (45 s / 90 s); --par runs that many pages at once.
const pw = (await import('./pw.mjs')).default;
import { writeFileSync } from 'node:fs';

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const base = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8765').replace(/\/$/, '');
const profiles = String(arg('profiles', 'expert,normal,sloppy,masher')).split(',');
const days = String(arg('days', '1,2,3,4,5,6,7')).split(',').map(Number);
const seeds = String(arg('seeds', '1,2,3')).split(',').map(Number);
const par = Math.max(1, Number(arg('par', 7)));
const out = arg('out', '');
const duration = Number(arg('duration', 0));

const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function run({ profile, day, seed }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (r) => r.abort());
  page.on('pageerror', (e) => errors.push(`${profile} day ${day} seed ${seed}: ${e.message}`));
  await page.goto(`${base}/index.html?debug&skipOpening=1&day=${day}&lite=1&seed=${seed}`);
  await page.waitForFunction(() => window.__250);
  if (duration) await page.evaluate((d) => { window.__250.durationMs = d; }, duration);
  await page.waitForSelector('.start-screen:not(.hidden) .start-btn');
  await page.waitForTimeout(1300);
  await page.click('.start-screen .start-btn', { force: true });
  await page.waitForFunction(() => window.__250?.game?.state.phase === 'playing', null, { timeout: 10000 });
  await page.evaluate(({ profile, seed }) => {
    const W = window.__250;
    const g = W.game;
    const info = W.info;
    const signUpMs = (info.enterMs ?? 300) + 280;
    const KEY = { gun: 'j', shut: 'k', take: 'l' };
    const KS = ['gun', 'shut', 'take'];
    let a = (seed * 7919 + ['expert', 'normal', 'sloppy', 'masher'].indexOf(profile) * 104729) >>> 0;
    const rnd = () => { // mulberry32
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const L = {
      presses: 0, dead: 0, arrivals: 0, correct: 0, wrong: 0, cutIns: 0, polite: 0, rage: 0, rageHits: 0, rageQ: 0,
      done: false, startedAt: performance.now(), wrapped: false,
    };
    window.__bot = L;
    // Old builds (no W.inputs): count a press as dead when the engine returned null.
    if (!W.inputs) {
      L.wrapped = true;
      const orig = g.press.bind(g);
      g.press = (k, h) => { const r = orig(k, h); L.presses += 1; if (r == null) L.dead += 1; return r; };
    }
    const tap = (k, hold = 40) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: KEY[k], bubbles: true }));
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: KEY[k], bubbles: true })), hold);
    };
    const anyKey = () => KS[Math.floor(rnd() * 3)];
    const want = (c, step) => (Array.isArray(c.steps) ? c.steps[step] : c.key);
    const answer = (customer, step) => {
      const cur = g.state.current;
      if (!cur || cur.customer !== customer || cur.step !== step || g.state.phase !== 'playing') return;
      if (cur.speaking) L.cutIns++;
      let k = want(customer, step);
      if (profile === 'sloppy' && rnd() < 0.25) k = KS.filter((x) => x !== k)[Math.floor(rnd() * 2)];
      tap(k, profile === 'expert' ? 900 : 40);
    };
    // after an answer: jabs while the customer flies, then "next" presses until somebody is at the counter
    const follow = () => {
      const plan = {
        expert: { jabs: [150, 300], from: 600, every: 120 },
        normal: { jabs: [300, 600], from: 1200, every: 300 },
        sloppy: { jabs: [], from: 1500, every: 600 },
      }[profile];
      if (!plan) return;
      const n0 = L.arrivals;
      plan.jabs.forEach((ms) => setTimeout(() => { if (L.arrivals === n0 && !g.state.current && g.state.phase === 'playing') tap(anyKey()); }, ms));
      const poll = () => {
        if (L.done || L.arrivals !== n0 || g.state.phase !== 'playing') return;
        if (!g.state.current) tap(anyKey());
        setTimeout(poll, plan.every);
      };
      setTimeout(poll, plan.from);
    };
    const visit = (customer) => {
      L.arrivals++;
      if (profile === 'expert') setTimeout(() => answer(customer, 0), signUpMs + 300);
    };
    g.on('arrive', ({ customer }) => { if (g.state.phase === 'playing') visit(customer); });
    if (g.state.current) visit(g.state.current.customer);
    g.on('ready', ({ customer, step }) => {
      if (profile === 'expert') { if (step > 0) setTimeout(() => answer(customer, step), 300); return; }
      if (profile === 'normal') setTimeout(() => answer(customer, step), 700);
      if (profile === 'sloppy') setTimeout(() => answer(customer, step), 300 + rnd() * 2400);
    });
    g.on('resolve', (e) => { e.correct ? L.correct++ : L.wrong++; follow(); });
    g.on('polite', () => { L.polite++; });
    g.on('rageStart', () => L.rage++);
    g.on('rageHit', (e) => { L.rageHits++; L.rageQ += e.queueDelta || 0; });
    g.on('rageBonus', (e) => { L.rageQ += e.queueDelta || 0; });
    g.on('over', ({ summary }) => {
      L.done = true; L.summary = summary; L.timeLeft = g.state.timeLeftMs; L.elapsed = g.state.elapsedMs;
      L.inputs = W.inputs ? { ...W.inputs } : null;
    });
    const mashMs = { expert: 90, normal: 220, sloppy: 400, masher: 300 }[profile];
    const mash = () => {
      if (L.done) return;
      if (g.state.phase === 'rage' || profile === 'masher') tap(anyKey());
      setTimeout(mash, mashMs);
    };
    setTimeout(mash, mashMs);
  }, { profile, seed });
  await page.waitForFunction(() => window.__bot?.done, null, { timeout: 240000, polling: 500 });
  const L = await page.evaluate(() => window.__bot);
  const star1 = await page.evaluate((d) => window.__250.DAYS[d - 1].star1, day);
  await ctx.close();
  let presses = L.presses;
  let dead = L.dead;
  if (L.inputs) {
    presses = Object.values(L.inputs).reduce((t, n) => t + n, 0);
    dead = L.inputs.dead || 0;
  }
  const s = L.summary;
  const ms = L.elapsed || 90000;
  return {
    profile, day, seed, star1, queue: s.queue, pass: star1 == null ? null : s.queue >= star1, served: s.served,
    servedPer90: +(s.served * 90000 / ms).toFixed(1), presses, dead, deadShare: presses ? +(dead / presses).toFixed(3) : 0,
    feedbackPer10s: +((presses - dead) * 10000 / ms).toFixed(1), correct: L.correct, wrong: L.wrong, cutIns: L.cutIns,
    timeouts: L.polite, rage: L.rage, rageHits: L.rageHits, rageQ: L.rageQ, rageShare: s.queue ? +(L.rageQ / s.queue).toFixed(3) : 0,
    maxCombo: s.maxCombo, earlyClose: L.timeLeft > 0, inputs: L.inputs, measuredBy: L.wrapped ? 'press-wrap' : 'inputs',
  };
}

const jobs = [];
for (const seed of seeds) for (const profile of profiles) for (const day of days) jobs.push({ profile, day, seed });
const results = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    try {
      const r = await run(job);
      results.push(r);
      console.log(JSON.stringify(r));
    } catch (err) {
      errors.push(`${job.profile} day ${job.day} seed ${job.seed}: ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(par, jobs.length) }, worker));
await browser.close();
if (out) writeFileSync(out, results.map((r) => JSON.stringify(r)).join('\n') + '\n');

// ---- summary
const mean = (xs) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0);
const f1 = (x) => (Math.round(x * 10) / 10).toString();
console.log('\nprofile day  queue  ★1  pass  served/90s  dead%  fb/10s  rage%  timeouts early');
for (const profile of profiles) {
  for (const day of days) {
    const rs = results.filter((r) => r.profile === profile && r.day === day);
    if (!rs.length) continue;
    const pass = rs.filter((r) => r.pass).length;
    console.log([
      profile.padEnd(7), String(day).padStart(3), f1(mean(rs.map((r) => r.queue))).padStart(6), String(rs[0].star1 ?? '-').padStart(3),
      `${pass}/${rs.length}`.padStart(5), f1(mean(rs.map((r) => r.servedPer90))).padStart(10), f1(100 * mean(rs.map((r) => r.deadShare))).padStart(6),
      f1(mean(rs.map((r) => r.feedbackPer10s))).padStart(7), f1(100 * mean(rs.map((r) => r.rageShare))).padStart(6),
      f1(mean(rs.map((r) => r.timeouts))).padStart(8), String(rs.filter((r) => r.earlyClose).length).padStart(5),
    ].join(' '));
  }
}
const ratio = days.map((day) => {
  const e = mean(results.filter((r) => r.profile === 'expert' && r.day === day).map((r) => r.queue));
  const n = mean(results.filter((r) => r.profile === 'normal' && r.day === day).map((r) => r.queue));
  return n ? `${day}:${f1(e / n)}` : null;
}).filter(Boolean);
if (ratio.length) console.log(`expert/normal queue ratio by day: ${ratio.join('  ')}`);
const mash = results.filter((r) => r.profile === 'masher' && r.day >= 2 && r.star1 != null);
if (mash.length) console.log(`masher ★1 on days 2–7: ${mash.filter((r) => r.pass).length}/${mash.length}`);
const early = results.filter((r) => r.earlyClose).length;
console.log(`early closes: ${early}/${results.length}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):\n${errors.slice(0, 20).join('\n')}`);
  process.exit(1);
}
