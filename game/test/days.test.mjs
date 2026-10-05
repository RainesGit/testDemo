import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAYS, DAY_COUNT, dayInfo, configForDay, poolForDay, clampDay } from '../src/days.js';
import { createGame, DEFAULT_CONFIG } from '../src/engine.js';
import { getContent } from '../src/content.js';

const customers = getContent('zh').customers;

test('seven days, numbered 1..7', () => {
  assert.equal(DAYS.length, DAY_COUNT);
  DAYS.forEach((d, i) => assert.equal(d.day, i + 1));
  assert.equal(clampDay(0), 1);
  assert.equal(clampDay(99), 7);
  assert.equal(clampDay('3'), 3);
  assert.equal(dayInfo(42).day, 7);
});

test('pace never gets slower: W, bonus, L, L+, wrong landing, entrance and punch gap do not increase', () => {
  const fields = ['windowStartMs', 'windowEndMs', 'introBonusMs', 'landMs', 'landBigMs', 'landWrongMs', 'enterMs', 'punchGapMs'];
  for (let i = 1; i < DAYS.length; i++) {
    for (const f of fields) assert.ok(DAYS[i][f] <= DAYS[i - 1][f], `day ${i + 1} ${f}`);
    assert.ok(DAYS[i].custRate >= DAYS[i - 1].custRate, `day ${i + 1} custRate`);
  }
  for (const d of DAYS) assert.ok(d.windowEndMs >= DEFAULT_CONFIG.windowFloorMs, `day ${d.day} W floor`);
});

test('talkLeadMs: only day 1 opens the window before the customer has finished (pace), and by less than W', () => {
  assert.equal(dayInfo(1).talkLeadMs, 400);
  for (const d of DAYS.slice(1)) assert.equal(d.talkLeadMs, 0, `day ${d.day}`);
  for (const d of DAYS) assert.ok(d.talkLeadMs < d.windowEndMs / 4, `day ${d.day}`);
});

test('4.2 table values', () => {
  const row = (n) => { const d = dayInfo(n); return [d.durationMs, d.windowStartMs, d.introBonusMs, d.landMs, d.landBigMs, d.landWrongMs, d.enterMs, d.custRate, d.punchGapMs]; };
  assert.deepEqual(row(1), [45000, 2400, 300, 650, 1100, 550, 300, 1.0, 200]);
  assert.deepEqual(row(2), [90000, 2100, 300, 550, 950, 450, 260, 1.0, 200]);
  assert.deepEqual(row(3), [90000, 1850, 200, 450, 850, 380, 230, 1.04, 180]);
  assert.deepEqual(row(4), [90000, 1650, 200, 380, 750, 320, 200, 1.06, 160]);
  assert.deepEqual(row(5), [90000, 1450, 200, 320, 650, 280, 180, 1.08, 140]);
  assert.deepEqual(row(7).slice(1), [1400, 200, 320, 650, 280, 180, 1.08, 140]);
  assert.deepEqual(DAYS.map((d) => d.star1), [30, 35, 40, 45, 50, 55, null]);
});

test('system unlock order (7): day 1 hides aura/fury and timeouts are free; day 2 aura; day 3 rage; day 4 charge', () => {
  const d1 = dayInfo(1), d2 = dayInfo(2), d3 = dayInfo(3), d4 = dayInfo(4);
  assert.deepEqual([d1.showAura, d1.showFury, d1.timeoutCostsAura, d1.furyEnabled], [false, false, false, false]);
  assert.deepEqual([d2.showAura, d2.showFury, d2.timeoutCostsAura, d2.furyEnabled], ['intro', false, true, false]);
  // gameplay-v2 4: fury is earned by skill (no fury on arrival); day 3 doubles every gain in its first 30 s (the first rage)
  assert.deepEqual([d3.showFury, d3.furyEnabled, d3.furyPerCustomer, d3.furyCorrect, d3.furyPerfect, d3.furyCutIn, d3.furyJab, d3.furyMult],
    [true, true, 0, 6, 10, 14, 2, 2]);
  assert.deepEqual(DAYS.slice(0, 4).map((d) => d.intro), ['opening', 'aura', 'rage', 'charge']);
  assert.equal(d1.original, null);
  assert.equal(d2.original, null);
  assert.ok(d3.original && d3.original.atMs > 0);
  assert.deepEqual([d4.furyPerCustomer, d4.furyMult], [0, 1]);
});

test('day 1 pool: exactly the 21 listed customers, fixed trio first, weights 45/30/25', () => {
  const pool = poolForDay(1, customers);
  const ids = pool.map((c) => c.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [1, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 18, 41, 42, 43, 44, 45, 46, 47, 49, 50]);
  const byKey = (k) => pool.filter((c) => c.key === k).map((c) => c.id).sort((a, b) => a - b);
  assert.deepEqual(byKey('gun'), [1, 6, 7, 8, 41, 42, 43, 44, 45]);
  assert.deepEqual(byKey('take'), [5, 15, 46, 47, 49, 50]);
  assert.deepEqual(byKey('shut'), [11, 12, 13, 14, 16, 18]);
  assert.deepEqual(dayInfo(1).fixedFirst, [41, 46, 12]);
  const w = dayInfo(1).weights;
  assert.deepEqual([w.gun, w.take, w.shut], [0.45, 0.30, 0.25]);
});

test('pools grow day by day, 48 (249 trap) only from day 6', () => {
  let prev = new Set();
  for (let n = 1; n <= 7; n++) {
    const ids = new Set(poolForDay(n, customers).map((c) => c.id));
    for (const id of prev) assert.ok(ids.has(id), `day ${n} keeps #${id}`);
    assert.equal(ids.has(48), n >= 6, `day ${n} #48`);
    prev = ids;
  }
  assert.equal(prev.size, 100);
  const d2 = poolForDay(2, customers);
  assert.ok(d2.every((c) => ['犹豫磨叽', '数量', '甜度冰块'].includes(c.cat)));
});

test('configForDay feeds createGame: day 1 opening trio, then weighted draw, no aura loss on timeout, no fury', () => {
  const cfg = configForDay(1);
  assert.equal(cfg.durationMs, 45000);
  assert.equal(cfg.minAnswerMs, 300 + 120);
  assert.equal(cfg.speakMaxMs, 300 + 280 + 1600);
  let seed = 11;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const game = createGame({ customers: poolForDay(1, customers), rng, config: cfg });
  const arrivals = [];
  const polite = [];
  game.on('arrive', (e) => arrivals.push(e.customer));
  game.on('polite', (e) => polite.push(e));
  game.start();
  assert.equal(game.state.current.patienceMaxMs, 2700, 'W 2400 + 300 in the first 10 s');
  const aura0 = game.state.aura;
  let t = 0;
  while (game.state.phase !== 'over' && t < 60000) {
    game.tick(50); t += 50;
    const cur = game.state.current;
    // answer every other customer; let the rest time out
    if (cur && !cur.speaking && arrivals.length % 2 === 0 && cur.patienceMaxMs - cur.patienceMs >= 400) game.press(cur.customer.key);
  }
  assert.equal(game.state.phase, 'over');
  assert.ok(t >= 45000 && t <= 45050, String(t));
  assert.deepEqual(arrivals.slice(0, 3).map((c) => c.id), [41, 46, 12]);
  assert.ok(polite.length > 0);
  assert.equal(game.state.aura >= aura0, true, 'timeouts never cost aura on day 1');
  assert.equal(game.state.fury, 0);
  assert.ok(arrivals.length >= 9 && arrivals.length <= 20, `about 13 customers, got ${arrivals.length}`);
});

test('configForDay(n, extra) merges extra (e.g. the special customer)', () => {
  const special = { customer: { id: 'orig' }, atMs: 1 };
  assert.equal(configForDay(3, { special }).special, special);
  assert.equal(configForDay(2).furyEnabled, false);
  assert.deepEqual([configForDay(3).furyPerCustomer, configForDay(3).furyCutIn, configForDay(3).furyMult], [0, 14, 2]);
});
