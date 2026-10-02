import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, MILESTONES } from '../src/engine.js';

// Deterministic PRNG (mulberry32)
function seeded(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STYLES = ['real', 'curse', 'disdain', 'cold', 'deadpan', 'chuuni', 'math', 'twist'];
const KEYS = ['gun', 'shut', 'take'];
function makeCustomers(n = 30) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    cat: 'c',
    name: 'n' + i,
    tag: '',
    cups: null,
    says: 's' + i,
    reply: 'r' + i,
    alt: 'a' + i,
    style: STYLES[i % STYLES.length],
    key: KEYS[i % 3],
  }));
}

// no fury-triggered rage unless asked; instant next customer
const BASE = { gapMs: 0, furyPerCustomer: 0, furyCorrect: 0 };

function setup({ customers = makeCustomers(), config = {}, seed = 1 } = {}) {
  const game = createGame({ customers, rng: seeded(seed), config: { ...BASE, ...config } });
  const log = [];
  for (const ev of ['start', 'arrive', 'resolve', 'polite', 'rageStart', 'rageHit', 'rageEnd', 'milestone', 'over']) {
    game.on(ev, p => log.push({ ev, ...p }));
  }
  return { game, log, of: name => log.filter(e => e.ev === name) };
}

const rightKey = g => g.state.current.customer.key;
const wrongKey = g => KEYS.find(k => k !== g.state.current.customer.key);

test('initial state and start', () => {
  const { game, of } = setup();
  assert.equal(game.state.phase, 'idle');
  assert.equal(game.state.current, null);
  game.start();
  const st = game.state;
  assert.equal(st.phase, 'playing');
  assert.equal(st.timeLeftMs, 90000);
  assert.equal(st.queue, 0);
  assert.equal(st.combo, 0);
  assert.ok(st.aura > 0 && st.aura <= 100);
  assert.equal(st.current.patienceMaxMs, 3000);
  assert.equal(st.current.patienceMs, 3000);
  assert.equal(of('arrive').length, 1);
  assert.deepEqual({ ...st.stats }, { served: 0, cursed: 0, polite: 0, perfect: 0 });
});

test('state is a read-only snapshot', () => {
  const { game } = setup();
  game.start();
  const st = game.state;
  assert.throws(() => { 'use strict'; st.queue = 999; });
  assert.equal(game.state.queue, 0);
});

test('correct press: queue +1, aura +8, combo up, resolve payload', () => {
  const { game, of } = setup();
  game.start();
  const aura0 = game.state.aura;
  const cust = game.state.current.customer;
  game.tick(700); // not perfect
  game.press(cust.key);
  const r = of('resolve')[0];
  assert.equal(r.customer, cust);
  assert.equal(r.correct, true);
  assert.equal(r.perfect, false);
  assert.equal(r.charge, 0);
  assert.equal(r.queueDelta, 1);
  assert.ok(r.scoreDelta > 0);
  assert.ok(r.line === cust.reply || r.line === cust.alt);
  assert.equal(game.state.queue, 1);
  assert.equal(game.state.aura, aura0 + 8);
  assert.equal(game.state.combo, 1);
  assert.equal(game.state.stats.served, 1);
  assert.equal(game.state.stats.cursed, 1);
  assert.equal(of('arrive').length, 2, 'next customer arrives');
});

test('perfect press (<600ms): aura +12 and perfect stat', () => {
  const { game, of } = setup();
  game.start();
  const aura0 = game.state.aura;
  game.tick(300);
  game.press(rightKey(game));
  assert.equal(of('resolve')[0].perfect, true);
  assert.equal(game.state.aura, aura0 + 12);
  assert.equal(game.state.stats.perfect, 1);
});

test('wrong press: aura -5, still counts as a curse, smaller gain, no combo gain', () => {
  const { game, of } = setup();
  game.start();
  game.press(rightKey(game)); // combo 1
  const aura0 = game.state.aura;
  const q0 = game.state.queue;
  game.press(wrongKey(game));
  const r = of('resolve')[1];
  assert.equal(r.correct, false);
  assert.equal(r.perfect, false);
  assert.equal(game.state.aura, aura0 - 5);
  assert.equal(game.state.stats.cursed, 2);
  assert.ok(r.queueDelta >= 0 && r.queueDelta <= 1);
  assert.equal(game.state.queue, q0 + r.queueDelta);
  assert.ok(r.scoreDelta < of('resolve')[0].scoreDelta);
  assert.equal(game.state.combo, 1, 'wrong press does not increase combo');
  assert.equal(game.state.phase, 'playing');
});

test('timeout: polite event, aura -20, combo reset, next customer', () => {
  const { game, of } = setup();
  game.start();
  game.press(rightKey(game));
  game.press(rightKey(game));
  assert.equal(game.state.combo, 2);
  const aura0 = game.state.aura;
  const cust = game.state.current.customer;
  game.tick(2999);
  assert.equal(of('polite').length, 0);
  game.tick(2);
  assert.equal(of('polite').length, 1);
  assert.equal(of('polite')[0].customer, cust);
  assert.equal(game.state.aura, aura0 - 20);
  assert.equal(game.state.combo, 0);
  assert.equal(game.state.stats.polite, 1);
  assert.notEqual(game.state.current, null);
  assert.notEqual(game.state.current.customer, cust);
});

test('charge levels: <300 -> 0, 300-800 -> 1, >800 -> 2 with +0/+1/+3 queue', () => {
  const { game, of } = setup();
  game.start();
  const holds = [0, 299, 300, 800, 801, 2000];
  const expectCharge = [0, 0, 1, 1, 2, 2];
  for (const h of holds) {
    game.tick(700);
    game.press(rightKey(game), h);
  }
  const rs = of('resolve');
  rs.forEach((r, i) => {
    assert.equal(r.charge, expectCharge[i], `hold ${holds[i]}`);
    const comboBefore = i; // all correct, combo was i before press
    assert.equal(r.queueDelta, 1 + Math.floor(comboBefore / 5) + [0, 1, 3][expectCharge[i]]);
  });
});

test('combo bonus: floor(combo/5) added to queue', () => {
  const { game, of } = setup({ config: { auraStart: 50 } });
  game.start();
  for (let i = 0; i < 11; i++) { game.tick(700); game.press(rightKey(game)); }
  const rs = of('resolve');
  assert.equal(rs[4].queueDelta, 1);  // combo 4 before
  assert.equal(rs[5].queueDelta, 2);  // combo 5 before
  assert.equal(rs[10].queueDelta, 3); // combo 10 before
  assert.equal(game.state.maxCombo, 11);
});

test('250 bonus: style "250" or cups === 250 gives +10', () => {
  const customers = [
    { id: 1, style: '250', key: 'take', cups: null, reply: 'x' },
    { id: 2, style: 'real', key: 'take', cups: 250, reply: 'y' },
    { id: 3, style: 'cold', key: 'take', cups: 3, reply: 'z' },
  ];
  const { game, of } = setup({ customers });
  game.start();
  for (let i = 0; i < 3; i++) { game.tick(700); game.press('take'); }
  const byId = Object.fromEntries(of('resolve').map(r => [r.customer.id, r.queueDelta]));
  assert.equal(byId[1], 11);
  assert.equal(byId[2], 11);
  assert.equal(byId[3], 1);
});

test('250 bonus not given on wrong press', () => {
  const customers = [
    { id: 1, style: '250', key: 'take', cups: 250, reply: 'x' },
    { id: 2, style: 'real', key: 'gun', reply: 'y' },
  ];
  const { game, of } = setup({ customers, seed: 3 });
  game.start();
  while (game.state.current.customer.id !== 1) game.press(rightKey(game));
  game.press('gun');
  const r = of('resolve').find(e => e.customer.id === 1);
  assert.equal(r.correct, false);
  assert.ok(r.queueDelta <= 1);
});

test('rage: fury fills, 8s rage, any key counts, no timeout, then ends', () => {
  const { game, of } = setup({ config: { furyPerCustomer: 6, furyCorrect: 4 } });
  game.start();
  assert.equal(game.state.fury, 6);
  let guard = 0;
  while (game.state.phase === 'playing' && guard++ < 50) game.press(rightKey(game));
  assert.equal(game.state.phase, 'rage');
  assert.equal(of('rageStart').length, 1);
  assert.equal(game.state.fury, 100);
  // any key, even "wrong", is a rage hit
  const q0 = game.state.queue;
  const combo0 = game.state.combo;
  game.press('gun');
  game.press('shut');
  const hits = of('rageHit');
  assert.equal(hits.length, 2);
  assert.equal(hits[0].queueDelta, 2 + Math.floor((combo0 + 1) / 10));
  assert.equal(game.state.queue, q0 + hits[0].queueDelta + hits[1].queueDelta);
  assert.equal(of('resolve').length, guard, 'rage hits do not emit resolve');
  // no timeout during rage, even well beyond patience
  const politeBefore = of('polite').length;
  game.tick(7000);
  assert.equal(game.state.phase, 'rage');
  assert.equal(of('polite').length, politeBefore);
  game.tick(1001);
  assert.equal(game.state.phase, 'playing');
  assert.equal(of('rageEnd').length, 1);
  assert.equal(game.state.fury < 100, true);
  assert.notEqual(game.state.current, null, 'a customer is waiting after rage');
  assert.ok(game.state.current.patienceMs > 0);
});

test('rage hit queue scales with combo/10', () => {
  const { game, of } = setup({ config: { furyPerCustomer: 0, furyCorrect: 10, auraStart: 50 } });
  game.start();
  for (let i = 0; i < 10; i++) game.press(rightKey(game));
  assert.equal(game.state.phase, 'rage');
  assert.equal(game.state.combo, 10);
  game.press('take');
  assert.equal(of('rageHit')[0].queueDelta, 2 + Math.floor(11 / 10));
});

test('aura reaching zero ends the game early', () => {
  const { game, of } = setup({ config: { auraStart: 40 } });
  game.start();
  game.tick(3001);
  assert.equal(game.state.aura, 20);
  assert.equal(game.state.phase, 'playing');
  game.tick(game.state.current.patienceMs + 1);
  assert.equal(game.state.aura, 0);
  assert.equal(game.state.phase, 'over');
  assert.equal(of('over').length, 1);
  assert.ok(game.state.timeLeftMs > 0);
  const sum = of('over')[0].summary;
  assert.equal(sum.polite, 2);
  // further input is ignored
  assert.equal(game.press('gun'), null);
  game.tick(1000);
  assert.equal(of('over').length, 1);
});

test('wrong presses can also drain aura to zero', () => {
  const { game } = setup({ config: { auraStart: 10 } });
  game.start();
  game.press(wrongKey(game));
  game.press(wrongKey(game));
  assert.equal(game.state.phase, 'over');
});

test('round ends after 90 seconds with summary', () => {
  const { game, of } = setup({ config: { auraStart: 100, auraTimeout: 0 } });
  game.start();
  let best = null;
  game.on('resolve', r => { if (!best || r.scoreDelta > best.scoreDelta) best = r; });
  for (let t = 0; t < 89000; t += 500) {
    game.tick(500);
    if (game.state.current && (t / 500) % 3 === 0) game.press(rightKey(game), (t % 1000) ? 900 : 0);
  }
  assert.equal(game.state.phase, 'playing');
  game.tick(1000);
  assert.equal(game.state.phase, 'over');
  assert.equal(game.state.timeLeftMs, 0);
  const over = of('over');
  assert.equal(over.length, 1);
  const s = over[0].summary;
  for (const k of ['queue', 'score', 'maxCombo', 'served', 'cursed', 'polite', 'bestLineId']) assert.ok(k in s, k);
  assert.equal(s.queue, game.state.queue);
  assert.equal(s.score, game.state.score);
  assert.equal(s.bestLineId, best.customer.id);
});

test('90s timer ends even during rage', () => {
  const { game, of } = setup({ config: { durationMs: 5000, furyPerCustomer: 100 } });
  game.start();
  assert.equal(game.state.phase, 'rage');
  game.tick(5000);
  assert.equal(game.state.phase, 'over');
  assert.equal(of('rageEnd').length, 1);
  assert.equal(of('over').length, 1);
});

test('patience decays linearly from 3000ms to 1200ms', () => {
  const { game } = setup({ config: { auraStart: 100, auraTimeout: 0 } });
  game.start();
  assert.equal(game.state.current.patienceMaxMs, 3000);
  game.tick(45000 - 1); // several timeouts happen along the way
  game.tick(1);
  game.press(rightKey(game)); // spawn at 45s
  assert.equal(game.state.current.patienceMaxMs, 2100);
  game.tick(44999);
  game.press(rightKey(game) ?? 'gun');
  const p = game.state.current.patienceMaxMs;
  assert.ok(p >= 1200 && p <= 1201, String(p));
});

test('milestone events fire once per level', () => {
  const customers = [
    { id: 1, style: '250', key: 'take', cups: 250, reply: 'x' },
    { id: 2, style: 'real', key: 'take', cups: 250, reply: 'y' },
  ];
  const { game, of } = setup({ customers, config: { auraStart: 100 } });
  game.start();
  for (let i = 0; i < 12; i++) game.press('take', 1000);
  const levels = of('milestone').map(e => e.level);
  assert.deepEqual(levels, [10, 100]);
  assert.ok(game.state.queue >= 100 && game.state.queue < 1000);
  assert.deepEqual(MILESTONES, [10, 100, 1000, 10000, 100000]);
});

test('a single big jump crosses several milestones in order', () => {
  const customers = [{ id: 1, style: 'real', key: 'take', reply: 'x' }];
  const { game, of } = setup({ customers, config: { chargeBonus: [0, 0, 20000] } });
  game.start();
  game.press('take', 900);
  assert.deepEqual(of('milestone').map(e => e.level), [10, 100, 1000, 10000]);
});

test('consecutive customers never share a style', () => {
  for (const seed of [1, 2, 3, 7, 99]) {
    const { game, of } = setup({ seed, config: { auraStart: 100, auraTimeout: 0, auraWrong: 0 } });
    game.start();
    for (let i = 0; i < 300; i++) game.press(i % 4 ? rightKey(game) : wrongKey(game));
    const styles = of('arrive').map(e => e.customer.style);
    assert.ok(styles.length > 250);
    for (let i = 1; i < styles.length; i++) {
      assert.notEqual(styles[i], styles[i - 1], `seed ${seed} at ${i}`);
    }
  }
});

test('no-repeat holds with skewed pools (many same-style customers)', () => {
  const customers = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: i + 1, style: 'curse', key: 'gun', reply: 'r' })),
    { id: 11, style: 'cold', key: 'gun', reply: 'r' },
    { id: 12, style: 'math', key: 'gun', reply: 'r' },
  ];
  const { game, of } = setup({ customers, config: { auraStart: 100 } });
  game.start();
  for (let i = 0; i < 100; i++) game.press('gun');
  const styles = of('arrive').map(e => e.customer.style);
  for (let i = 1; i < styles.length; i++) assert.notEqual(styles[i], styles[i - 1]);
});

test('draws from remaining pool: every customer appears before repeats', () => {
  const customers = makeCustomers(24);
  const { game, of } = setup({ customers, config: { auraStart: 100 } });
  game.start();
  for (let i = 0; i < 23; i++) game.press(rightKey(game));
  const ids = new Set(of('arrive').map(e => e.customer.id));
  assert.equal(ids.size, 24);
});

test('same seed gives same sequence (rng injectable)', () => {
  const run = seed => {
    const { game, of } = setup({ seed });
    game.start();
    for (let i = 0; i < 20; i++) game.press(rightKey(game));
    return of('arrive').map(e => e.customer.id).join(',');
  };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

test('resolve line uses reply or alt', () => {
  const { game, of } = setup({ config: { auraStart: 100 } });
  game.start();
  for (let i = 0; i < 40; i++) game.press(rightKey(game));
  const lines = of('resolve').map(r => (r.line === r.customer.reply ? 'reply' : r.line === r.customer.alt ? 'alt' : 'bad'));
  assert.ok(!lines.includes('bad'));
  assert.ok(lines.includes('reply') && lines.includes('alt'));
});

test('gap between customers delays next arrival', () => {
  const { game, of } = setup({ config: { gapMs: 250 } });
  game.start();
  game.press(rightKey(game));
  assert.equal(game.state.current, null);
  assert.equal(game.press('gun'), null, 'press during gap is ignored');
  game.tick(200);
  assert.equal(of('arrive').length, 1);
  game.tick(60);
  assert.equal(of('arrive').length, 2);
});

test('fury increments +6 per customer and +4 per correct', () => {
  const { game } = setup({ config: { furyPerCustomer: 6, furyCorrect: 4 } });
  game.start();
  assert.equal(game.state.fury, 6);
  game.press(rightKey(game));
  assert.equal(game.state.fury, 16);
  game.press(wrongKey(game));
  assert.equal(game.state.fury, 22);
});

test('restart resets everything', () => {
  const { game } = setup();
  game.start();
  game.press(rightKey(game));
  game.start();
  assert.equal(game.state.queue, 0);
  assert.equal(game.state.score, 0);
  assert.equal(game.state.timeLeftMs, 90000);
  assert.equal(game.state.stats.served, 0);
});
