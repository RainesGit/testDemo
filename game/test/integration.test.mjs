// Cross-module checks: content shapes match what engine / ui / main.js expect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getContent } from '../src/content.js';
import { createGame, MILESTONES } from '../src/engine.js';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clipKey } from '../src/audio.js';
import { configForDay, poolForDay, dayInfo, specialsForDay } from '../src/days.js';

const STYLES = ['real', 'curse', 'disdain', 'cold', 'deadpan', 'chuuni', 'math', '250', 'twist'];
const KEYS = ['gun', 'shut', 'take'];

for (const lang of ['zh', 'en']) {
  test(`content ${lang}: 100 customers with all fields`, () => {
    const { customers, system } = getContent(lang);
    assert.equal(customers.length, 100);
    assert.equal(new Set(customers.map((c) => c.id)).size, 100);
    for (const c of customers) {
      for (const f of ['name', 'says', 'reply']) assert.ok(c[f], `${lang} #${c.id} missing ${f}`);
      assert.ok(STYLES.includes(c.style), `#${c.id} style ${c.style}`);
      assert.ok(KEYS.includes(c.key), `#${c.id} key ${c.key}`);
    }
    for (const f of ['next', 'polite', 'boo', 'rageStart', 'rageLines', 'closing']) {
      assert.ok(Array.isArray(system[f]) && system[f].length, `${lang} SYSTEM.${f}`);
    }
    for (const lv of MILESTONES) assert.ok(system.milestones[lv], `${lang} milestone ${lv}`);
    for (const k of ['gun', 'shut', 'take', 'queue', 'aura', 'fury', 'start', 'again', 'bleep']) assert.ok(system.ui[k], `${lang} ui.${k}`);
  });
}

test('zh and en share the gameplay fields (engine runs on zh, text is looked up by id)', () => {
  const zh = getContent('zh').customers;
  const en = new Map(getContent('en').customers.map((c) => [c.id, c]));
  for (const c of zh) {
    const e = en.get(c.id);
    assert.deepEqual([e.style, e.key, e.cups], [c.style, c.key, c.cups], `#${c.id}`);
  }
});

test('a full 90s round with real content ends with a summary whose bestLineId resolves', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const { customers } = getContent('zh');
  const game = createGame({ customers, rng });
  let summary = null;
  game.on('over', (e) => { summary = e.summary; });
  game.start();
  let t = 0;
  while (game.state.phase !== 'over' && t < 120000) {
    game.tick(50); t += 50;
    const cur = game.state.current;
    if (cur && cur.speaking && cur.sinceArriveMs >= 900) game.speechDone(); // main.js: t0 at the voice end
    if (game.state.phase === 'rage' && rng() < 0.3) game.press('gun');
    else if (cur && !cur.speaking && cur.patienceMaxMs - cur.patienceMs > 400) {
      // UI model: resolve on key-down, then upgrade while the key stays held
      const r = game.press(rng() < 0.8 ? cur.customer.key : 'gun', 0);
      const held = rng() * 1000;
      if (r && r.correct && held >= 300) { game.tick(300); game.charge(held >= 800 ? 2 : 1); }
    }
  }
  assert.ok(summary, 'game ended');
  assert.ok(summary.queue > 0);
  assert.ok(customers.some((c) => c.id === summary.bestLineId));
});

// Plays day n the way main.js does: t0 at a fixed talk length, answers after reactMs, delayNext(punch + L).
function playDay(n, { reactMs = 600, correctRate = 0.85, seed = 3, extra = {}, onEvent } = {}) {
  let s = seed;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const { customers, system } = getContent('zh');
  const info = dayInfo(n);
  const o = system.originalCustomer;
  const orig = o ? { ...o, key: o.steps[0], reply: o.reply2 } : null;
  // stage 2: the day's specials (day 3: the original customer 4–6 times); older days: one original
  const specials = info.specials?.length ? specialsForDay(n, { original: orig }) : null;
  const special = !specials && info.original && orig ? { customer: orig, atMs: info.original.atMs } : null;
  const base = specials ? { specials } : special ? { special } : {};
  const game = createGame({ customers: poolForDay(n, customers), rng, config: configForDay(n, { ...base, ...extra }) });
  const log = [];
  for (const ev of ['arrive', 'ready', 'step', 'resolve', 'polite', 'rageStart', 'over']) {
    game.on(ev, (p) => { log.push({ ev, t: game.state.elapsedMs, ...p }); onEvent?.(ev, p, game); });
  }
  game.on('resolve', () => game.delayNext(1200)); // a clerk line of ~550 ms + L
  game.start();
  let t = 0;
  while (game.state.phase !== 'over' && t < 200000) {
    game.tick(20); t += 20;
    const cur = game.state.current;
    if (!cur) continue;
    if (game.state.phase === 'rage') { if (rng() < 0.1) game.press('gun'); continue; }
    if (cur.speaking && cur.sinceArriveMs >= info.enterMs + 280 + 800) game.speechDone();
    else if (!cur.speaking && cur.patienceMaxMs - cur.patienceMs >= reactMs) {
      const want = cur.customer.steps ? cur.customer.steps[cur.step] : cur.customer.key;
      game.press(rng() < correctRate ? want : 'gun');
    }
  }
  return { game, log, of: (name) => log.filter((e) => e.ev === name) };
}

test('day 1 free play: fixed trio, about 13 customers in 45 s, star 1 (30) reachable with the opening carry-over', () => {
  const { game, of } = playDay(1, { correctRate: 1 });
  const ids = of('arrive').map((e) => e.customer.id);
  assert.deepEqual(ids.slice(0, 3), [41, 46, 12]);
  assert.ok(ids.length >= 10 && ids.length <= 18, `customers: ${ids.length}`);
  assert.ok(ids.every((id) => poolForDay(1, getContent('zh').customers).some((c) => c.id === id)));
  assert.equal(game.state.fury, 0, 'no fury on day 1');
  assert.ok(game.state.queue + 12 >= dayInfo(1).star1, `queue ${game.state.queue} + 12`);
});

test('A6/A7 with real content: patience frozen arrive→ready; next arrive ≥ L after a correct answer', () => {
  const frozen = [];
  const { of } = playDay(2, {
    onEvent(ev, p, game) {
      if (ev === 'arrive') frozen.push(game.state.current.patienceMs);
      if (ev === 'ready') assert.equal(p.patienceMs, frozen.at(-1));
    },
  });
  const log = [...of('resolve'), ...of('arrive')].sort((a, b) => a.t - b.t);
  for (let i = 0; i < log.length - 1; i++) {
    if (log[i].ev === 'resolve' && log[i + 1].ev === 'arrive') {
      const r = log[i];
      const L = r.land === 'wrong' ? 450 : r.land === 'big' ? 950 : 550;
      assert.ok(log[i + 1].t - r.t >= Math.min(L, 1200) - 20, `gap ${log[i + 1].t - r.t} after ${r.land}`);
    }
  }
});

test('day 3 (原片日): the original customer comes 4–6 times (take → step → shut), and the first rage comes within the first half', () => {
  const { of } = playDay(3, { correctRate: 1 });
  const origArrivals = of('arrive').filter((e) => e.customer.id === 'orig');
  assert.ok(origArrivals.length >= 4 && origArrivals.length <= 6, `originals: ${origArrivals.length}`);
  assert.equal(of('step').length, origArrivals.length);
  const fin = of('resolve').find((e) => e.customer.id === 'orig');
  assert.equal(fin.correct, true);
  assert.equal(fin.land, 'step');
  assert.match(fin.line, /\|/, 'reply2 has a cut point');
  const rage = of('rageStart')[0];
  // 12/8 fury (spec 7): five customers fill it; the real cadence (voice + delayNext) is about 3–3.8 s each
  assert.ok(rage && rage.t > 9000 && rage.t < 45000, `first rage at ${rage && rage.t}`);
});

test('day 2: timeouts cost aura, no rage; day 1: timeouts are free', () => {
  const d2 = playDay(2, { reactMs: 99999 });
  assert.ok(d2.of('polite').length > 1);
  assert.ok(d2.of('polite').slice(1).some((p) => !p.free));
  assert.equal(d2.of('rageStart').length, 0);
  const d1 = playDay(1, { reactMs: 99999 });
  assert.ok(d1.of('polite').every((p) => p.free));
});

test('SYSTEM.opening / originalCustomer shapes match what main.js and opening.js read', () => {
  for (const lang of ['zh', 'en']) {
    const { system } = getContent(lang);
    const op = system.opening;
    assert.ok(op, `${lang} opening`);
    assert.ok(op.closing && op.closing.title && op.closing.lines.length === 3, `${lang} closing`);
    const o = system.originalCustomer;
    assert.ok(o && o.says && o.says2 && o.reply1 && o.reply2, `${lang} originalCustomer`);
    assert.equal((o.reply2.match(/\|/g) || []).length, 1, `${lang} reply2 cut point`);
  }
  const o = getContent('zh').system.originalCustomer;
  assert.deepEqual(o.steps, ['take', 'shut']);
  assert.ok(!getContent('zh').customers.some((c) => c.id === o.id), 'not in the 100');
});
