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

// no fury-triggered rage unless asked; instant next customer; beginner protection off
// (the intro bonus and free first timeout have their own tests below). The classic tests run without the
// talking phase (speakMaxMs 0 → ready right at arrive) and with the old key names (aliases: patienceStartMs/EndMs
// → windowStartMs/EndMs, gapMs → every land*), so they also cover the one-version alias mapping.
const BASE = {
  gapMs: 0, furyPerCustomer: 0, furyCorrect: 0, introMs: 0, firstTimeoutFree: false,
  speakMaxMs: 0, minAnswerMs: 0, patienceStartMs: 3000, patienceEndMs: 1200, comboTightenAt: Infinity,
};

function setup({ customers = makeCustomers(), config = {}, seed = 1 } = {}) {
  const game = createGame({ customers, rng: seeded(seed), config: { ...BASE, ...config } });
  const log = [];
  for (const ev of ['start', 'arrive', 'ready', 'step', 'resolve', 'polite', 'rageStart', 'rageHit', 'rageEnd', 'milestone', 'over', 'charge', 'bonus']) {
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

test('wrong press: no aura loss, still counts as a curse, smaller gain, no combo gain', () => {
  const { game, of } = setup();
  game.start();
  game.press(rightKey(game)); // combo 1
  const aura0 = game.state.aura;
  const q0 = game.state.queue;
  game.press(wrongKey(game));
  const r = of('resolve')[1];
  assert.equal(r.correct, false);
  assert.equal(r.perfect, false);
  assert.equal(game.state.aura, aura0);
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

test('only wrong presses survive until the round timer ends', () => {
  const { game, of } = setup({ config: { auraStart: 10 } });
  game.start();
  for (let i = 0; i < 179; i++) {
    game.tick(500);
    game.press(wrongKey(game));
  }
  assert.equal(game.state.phase, 'playing');
  assert.equal(game.state.aura, 10);
  assert.equal(game.state.stats.served, 179);
  assert.equal(game.state.stats.polite, 0);
  assert.equal(of('over').length, 0);
  game.tick(500);
  assert.equal(game.state.phase, 'over');
  assert.equal(game.state.timeLeftMs, 0);
  assert.equal(of('over').length, 1);
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

// ---------------------------------------------------------------- beginner protection

test('intro: customers arriving in the first 10s get introBonusMs on top of W', () => {
  const { game } = setup({ config: { introMs: 10000, introBonusMs: 300 } });
  game.start();
  assert.equal(game.state.current.patienceMaxMs, 3300);
  game.tick(9000);
  game.press(rightKey(game)); // spawn at 9s: still intro
  assert.equal(game.state.current.patienceMaxMs, Math.round(3000 - 1800 * (9000 / 90000)) + 300);
  game.tick(1500);
  game.press(rightKey(game)); // spawn at 10.5s: no bonus
  assert.equal(game.state.current.patienceMaxMs, Math.round(3000 + (1200 - 3000) * (10500 / 90000)));
});

test('old introPatienceMs maps to introBonusMs = introPatienceMs - windowStartMs', () => {
  const { game } = setup({ config: { introMs: 10000, introPatienceMs: 4500 } });
  assert.equal(game.config.introBonusMs, 1500);
  assert.equal(game.config.windowStartMs, 3000);
  assert.equal(game.config.landMs, 0);
  game.start();
  assert.equal(game.state.current.patienceMaxMs, 4500);
});

test('defaults follow the spec (8.1)', () => {
  const game = createGame({ customers: makeCustomers(), rng: seeded(3) });
  const c = game.config;
  assert.deepEqual(
    [c.speakMaxMs, c.minAnswerMs, c.windowStartMs, c.windowEndMs, c.introBonusMs, c.comboTightenAt, c.comboTightenMs,
      c.windowFloorMs, c.landMs, c.landBigMs, c.landWrongMs, c.landPoliteMs, c.timeoutCostsAura, c.furyEnabled, c.auraWrong],
    [1880, 280, 2400, 2400, 300, 30, 100, 1000, 650, 1100, 550, 1600, true, true, 0],
  );
  assert.equal(c.introMs, 10000);
  assert.equal(c.firstTimeoutFree, true);
  game.start();
  assert.equal(game.state.current.patienceMaxMs, 2700);
  assert.equal(game.state.current.speaking, true);
});

test('first timeout of a round is free (polite scene, no aura loss); later ones cost 20', () => {
  const { game, of } = setup({ config: { firstTimeoutFree: true } });
  for (let round = 0; round < 2; round++) {
    game.start();
    const aura0 = game.state.aura;
    game.tick(3001);
    assert.equal(of('polite').length, round * 2 + 1);
    assert.equal(of('polite').at(-1).free, true);
    assert.equal(game.state.aura, aura0, 'first timeout costs nothing');
    assert.equal(game.state.stats.polite, 1);
    game.tick(game.state.current.patienceMs + 1);
    assert.equal(of('polite').at(-1).free, false);
    assert.equal(game.state.aura, aura0 - 20, 'second timeout costs 20');
  }
});

// ---------------------------------------------------------------- charge after press

test('charge(level) upgrades the last correct answer by the chargeBonus difference', () => {
  const { game, of } = setup();
  game.start();
  game.tick(300);
  const cust = game.state.current.customer;
  const r = game.press(cust.key, 0);
  assert.equal(r.charge, 0);
  assert.equal(r.perfect, true, 'resolving on key-down keeps perfect reachable');
  const q0 = game.state.queue, s0 = game.state.score;
  game.tick(300);
  const c1 = game.charge(1);
  assert.deepEqual({ ...c1 }, { level: 1, queueDelta: 1, customer: cust });
  assert.equal(game.state.queue, q0 + 1);
  assert.equal(game.state.score, s0 + 100);
  game.tick(500);
  const c2 = game.charge(2);
  assert.equal(c2.queueDelta, 2, 'only the difference 3 - 1 is added');
  assert.equal(game.state.queue, q0 + 3);
  assert.equal(game.state.score, s0 + 300);
  assert.equal(game.charge(2), null, 'same level twice does nothing');
  assert.equal(game.charge(1), null, 'no downgrade');
  const ev = of('charge');
  assert.equal(ev.length, 2);
  assert.deepEqual(ev.map((e) => e.level), [1, 2]);
  assert.equal(ev[1].customer, cust);
});

test('charge jumping straight to level 2 adds the full bonus', () => {
  const { game } = setup();
  game.start();
  game.press(rightKey(game));
  const q0 = game.state.queue;
  game.tick(800);
  assert.equal(game.charge(2).queueDelta, 3);
  assert.equal(game.state.queue, q0 + 3);
});

test('charge is ignored after a wrong answer, outside the 1000ms window, or before any answer', () => {
  const { game, of } = setup();
  game.start();
  assert.equal(game.charge(1), null, 'nothing resolved yet');
  game.press(wrongKey(game));
  assert.equal(game.charge(1), null, 'wrong answer');
  game.press(rightKey(game));
  game.tick(1001);
  assert.equal(game.charge(1), null, 'too late');
  assert.equal(of('charge').length, 0);
});

test('charge can cross a milestone', () => {
  const { game, of } = setup();
  game.start();
  for (let i = 0; i < 7; i++) game.press(rightKey(game)); // 5 x 1 + 2 x 2 (combo bonus) = 9
  assert.equal(game.state.queue, 9);
  game.charge(2);
  assert.deepEqual(of('milestone').map((m) => m.level), [10]);
});

// ---------------------------------------------------------------- pause / resume / bonus

test('pause freezes the clock and patience and ignores input; resume continues', () => {
  const { game } = setup();
  game.start();
  game.press(rightKey(game));
  const st0 = game.state;
  game.pause();
  assert.equal(game.state.paused, true);
  game.tick(60000);
  assert.equal(game.state.timeLeftMs, st0.timeLeftMs);
  assert.equal(game.state.current.patienceMs, st0.current.patienceMs);
  assert.equal(game.press(rightKey(game)), null);
  assert.equal(game.charge(1), null);
  assert.equal(game.state.queue, st0.queue);
  game.resume();
  assert.equal(game.state.paused, false);
  game.tick(100);
  assert.equal(game.state.timeLeftMs, st0.timeLeftMs - 100);
  assert.ok(game.press(rightKey(game)));
});

test('pause during the gap keeps the next customer waiting', () => {
  const { game, of } = setup({ config: { gapMs: 250 } });
  game.start();
  game.press(rightKey(game));
  game.pause();
  game.tick(5000);
  assert.equal(of('arrive').length, 1);
  game.resume();
  game.tick(260);
  assert.equal(of('arrive').length, 2);
});

test('start clears a pause; pause is a no-op when idle', () => {
  const { game } = setup();
  game.pause();
  assert.equal(game.state.paused, false);
  game.start();
  game.pause();
  game.start();
  assert.equal(game.state.paused, false);
});

test('bonus(n) adds n to the queue and 100n to the score, with an event and milestones', () => {
  const { game, of } = setup();
  game.start();
  const s0 = game.state.score;
  const r = game.bonus(25);
  assert.deepEqual({ ...r }, { queueDelta: 25 });
  assert.equal(game.state.queue, 25);
  assert.equal(game.state.score, s0 + 2500);
  assert.equal(of('bonus')[0].queueDelta, 25);
  assert.deepEqual(of('milestone').map((m) => m.level), [10]);
  assert.equal(game.bonus(0), null);
});

// ---------------------------------------------------------------- talking phase / t0 (4.1, 8.1)

// The real timeline: talking phase on, presses ignored for the first 280 ms, landing pauses per kind.
const LIVE = { speakMaxMs: 1880, minAnswerMs: 280, gapMs: undefined, landMs: 650, landBigMs: 1100, landWrongMs: 550, landPoliteMs: 1600, landStepExtraMs: 300 };
function live(config = {}, opts = {}) {
  return setup({ ...opts, config: { ...LIVE, ...config } });
}

test('arrive → ready: patience does not move while the customer talks (A6)', () => {
  const { game, of } = live();
  game.start();
  const p0 = game.state.current.patienceMs;
  assert.equal(game.state.current.speaking, true);
  game.tick(500); game.tick(700);
  assert.equal(game.state.current.patienceMs, p0);
  assert.equal(of('ready').length, 0);
  assert.equal(game.speechDone(), true);
  assert.equal(game.speechDone(), false, 'only once');
  assert.equal(game.state.current.speaking, false);
  const r = of('ready')[0];
  assert.equal(r.customer, game.state.current.customer);
  assert.equal(r.patienceMs, p0);
  game.tick(100);
  assert.equal(game.state.current.patienceMs, p0 - 100);
});

test('speakMaxMs fallback turns talking into ready by itself, then W runs out → polite', () => {
  const { game, of } = live();
  game.start();
  const W = game.state.current.patienceMaxMs;
  game.tick(1879);
  assert.equal(of('ready').length, 0);
  game.tick(1);
  assert.equal(of('ready').length, 1);
  game.tick(W - 1);
  assert.equal(of('polite').length, 0);
  game.tick(2);
  assert.equal(of('polite').length, 1);
});

test('presses within minAnswerMs of arrive are ignored', () => {
  const { game, of } = live();
  game.start();
  game.tick(279);
  assert.equal(game.press(rightKey(game)), null);
  game.tick(1);
  assert.ok(game.press(rightKey(game)));
  assert.equal(of('resolve').length, 1);
});

test('cut-in: a press while talking counts as perfect with reactionMs 0', () => {
  const { game, of } = live();
  game.start();
  game.tick(400);
  const r = game.press(rightKey(game));
  assert.equal(r.cutIn, true);
  assert.equal(r.reactionMs, 0);
  assert.equal(r.perfect, true);
  game.tick(1000);
  game.tick(10); // next customer
  game.tick(400);
  const w = game.press(wrongKey(game));
  assert.equal(w.cutIn, true);
  assert.equal(w.perfect, false);
  assert.equal(of('resolve').length, 2);
});

test('reaction is measured from t0, not from arrive', () => {
  const { game } = live();
  game.start();
  game.tick(1500);
  game.speechDone();
  game.tick(500);
  const r = game.press(rightKey(game));
  assert.equal(r.reactionMs, 500);
  assert.equal(r.perfect, true);
});

test('landing pause by kind: normal 650, wrong 550, big 1100, polite 1600 (A7)', () => {
  const customers = [
    { id: 1, style: 'real', key: 'gun', reply: 'a' },
    { id: 2, style: 'curse', key: 'shut', reply: 'b' },
    { id: 3, style: 'cold', key: 'take', cups: 250, reply: 'c' },
  ];
  const { game, of } = live({}, { customers });
  const gapAfter = (fn) => {
    const n = of('arrive').length;
    fn();
    let t = 0;
    while (of('arrive').length === n && t < 5000) { game.tick(10); t += 10; }
    return t;
  };
  game.start();
  const answer = (correct) => () => {
    game.tick(300);
    const c = game.state.current.customer;
    const r = game.press(correct ? c.key : KEYS.find((k) => k !== c.key));
    assert.equal(r.land, !correct ? 'wrong' : (c.style === 'curse' || c.cups === 250) ? 'big' : 'normal');
  };
  for (let i = 0; i < 6; i++) {
    const c = game.state.current.customer;
    const correct = i % 2 === 0;
    const expected = !correct ? 550 : (c.style === 'curse' || c.cups === 250) ? 1100 : 650;
    assert.equal(gapAfter(answer(correct)), expected, `#${c.id} correct=${correct}`);
  }
  // timeout
  const t = gapAfter(() => { game.tick(1880); game.tick(game.state.current.patienceMs); });
  assert.equal(of('polite').length, 1);
  assert.equal(t, 1600);
});

test('a press during the landing pause is ignored', () => {
  const { game } = live();
  game.start();
  game.tick(300);
  game.press(rightKey(game));
  assert.equal(game.state.current, null);
  assert.equal(game.press('gun'), null);
  assert.ok(game.state.gapLeftMs > 0);
});

test('delayNext(ms) only lengthens the landing pause, and only when nobody is at the counter', () => {
  const { game, of } = live();
  game.start();
  assert.equal(game.delayNext(5000), false, 'customer at the counter');
  game.tick(300);
  game.press(rightKey(game));
  assert.equal(game.delayNext(100), true);
  assert.equal(game.state.gapLeftMs, 650, 'never shortens');
  game.delayNext(2000);
  game.tick(1990);
  assert.equal(of('arrive').length, 1);
  game.tick(20);
  assert.equal(of('arrive').length, 2);
});

test('delayNext called from the resolve handler is kept (the landing pause is not reset to L afterwards)', () => {
  const { game, of } = live();
  game.on('resolve', () => game.delayNext(2400));
  game.start();
  game.tick(300);
  game.press(rightKey(game));
  assert.equal(game.state.gapLeftMs, 2400, 'main.js asks for punch end + L inside the resolve event');
  game.tick(2390);
  assert.equal(of('arrive').length, 1, 'the next customer does not step on the punch line');
  game.tick(20);
  assert.equal(of('arrive').length, 2);
});

test('keyWeights draw never repeats a customer while that key still has unseen ones (day 1 pool)', () => {
  const customers = makeCustomers(21);
  const seen = [];
  const game = createGame({ customers, rng: seeded(7), config: { ...BASE, keyWeights: { gun: 0.45, take: 0.3, shut: 0.25 }, durationMs: 600000 } });
  game.on('arrive', ({ customer }) => seen.push(customer.id));
  game.start();
  for (let i = 0; i < 14; i++) game.press(game.state.current.customer.key);
  const byKey = {};
  for (const id of seen) (byKey[customers[id - 1].key] ||= []).push(id);
  for (const [k, ids] of Object.entries(byKey)) {
    const per = customers.filter((c) => c.key === k).length;
    const first = ids.slice(0, per);
    assert.equal(new Set(first).size, first.length, `${k}: no repeat before all ${per} were seen (${ids})`);
  }
});

test('charge level 2 makes the landing a big one (landBigMs from the answer)', () => {
  const { game, of } = live();
  game.start();
  game.tick(300);
  const c = game.state.current.customer;
  if (c.style === 'curse') game.tick(0);
  game.press(rightKey(game));
  game.tick(300);
  game.charge(1);
  assert.ok(game.state.gapLeftMs <= 650);
  game.tick(200);
  game.charge(2);
  assert.equal(game.state.gapLeftMs, 1100 - 500);
  game.tick(590);
  assert.equal(of('arrive').length, 1);
  game.tick(20);
  assert.equal(of('arrive').length, 2);
});

test('timeoutCostsAura false: a timeout never costs aura (day 1)', () => {
  const { game, of } = live({ timeoutCostsAura: false, firstTimeoutFree: false });
  game.start();
  const aura0 = game.state.aura;
  for (let i = 0; i < 3; i++) {
    game.tick(1880);
    game.tick(game.state.current.patienceMs + 1);
    while (!game.state.current) game.tick(50);
  }
  assert.equal(of('polite').length, 3);
  assert.ok(of('polite').every((p) => p.free));
  assert.equal(game.state.aura, aura0);
});

test('furyEnabled false: fury never fills and rage never starts', () => {
  const { game, of } = setup({ config: { furyEnabled: false, furyPerCustomer: 50, furyCorrect: 50 } });
  game.start();
  for (let i = 0; i < 10; i++) game.press(rightKey(game));
  assert.equal(game.state.fury, 0);
  assert.equal(of('rageStart').length, 0);
});

test('rage: a talking customer is never timed; ready comes when rage ends', () => {
  const { game, of } = live({ furyPerCustomer: 100 });
  game.start();
  assert.equal(game.state.phase, 'rage');
  assert.equal(game.speechDone(), true);
  assert.equal(of('ready').length, 0, 'no ready during rage');
  game.tick(8001);
  assert.equal(game.state.phase, 'playing');
  assert.equal(of('ready').length, 1);
});

test('patienceFor: window interpolates, intro bonus, combo tightening, floor', () => {
  const game = createGame({ customers: makeCustomers(), config: { windowStartMs: 2000, windowEndMs: 1000, durationMs: 10000, introMs: 2000, introBonusMs: 300, comboTightenAt: 30, comboTightenMs: 100, windowFloorMs: 1050 } });
  assert.equal(game.patienceFor(0, 0), 2300);
  assert.equal(game.patienceFor(2000, 0), 1800);
  assert.equal(game.patienceFor(5000, 0), 1500);
  assert.equal(game.patienceFor(5000, 30), 1400);
  assert.equal(game.patienceFor(10000, 0), 1050, 'floor');
});

// ---------------------------------------------------------------- two-step customer (7, 8.1 item 10)

const ORIG = { id: 'orig', style: '250', key: 'take', steps: ['take', 'shut'], cups: 250, says: '250杯！', says2: '少甜少冰！', reply: 'r1', reply1: '好，250杯什么？', reply2: '调你妈！|黄金比例最好喝！' };

test('two-step customer: take → step event, stays, talks again with a fresh window; shut → big finale', () => {
  const others = makeCustomers(6);
  const { game, of } = live({ special: { customer: ORIG, atMs: 0 } }, { customers: others });
  game.start();
  assert.equal(game.state.current.customer, ORIG);
  game.tick(1880); // ready
  game.tick(700);
  const s1 = game.press('take');
  assert.equal(s1.step, 1);
  assert.equal(of('step').length, 1);
  assert.equal(of('resolve').length, 0);
  assert.equal(game.state.queue, 0, 'no reward on the first step');
  const cur = game.state.current;
  assert.equal(cur.customer, ORIG);
  assert.equal(cur.step, 1);
  assert.equal(cur.speaking, true);
  assert.equal(cur.patienceMs, cur.patienceMaxMs);
  assert.equal(game.press('shut'), null, 'minAnswerMs applies again');
  game.tick(1000);
  game.speechDone();
  assert.equal(of('ready').at(-1).step, 1);
  game.tick(300);
  const r = game.press('shut');
  assert.equal(r.correct, true);
  assert.equal(r.land, 'step');
  assert.equal(r.line, ORIG.reply2);
  assert.equal(r.queueDelta, 1 + 10, 'normal + bonus250');
  assert.equal(game.state.gapLeftMs, 1100 + 300);
  // once per round
  for (let i = 0; i < 20; i++) { while (!game.state.current) game.tick(50); game.tick(300); game.press(rightKey(game) ?? 'gun'); }
  assert.equal(of('arrive').filter((a) => a.customer === ORIG).length, 1);
});

test('two-step customer: a wrong key at either step resolves and they leave (no penalty)', () => {
  for (const wrongAt of [0, 1]) {
    const { game, of } = live({ special: { customer: ORIG, atMs: 0 } }, { customers: makeCustomers(6) });
    game.start();
    const aura0 = game.state.aura;
    game.tick(300);
    if (wrongAt === 1) { game.press('take'); game.tick(300); }
    const r = game.press('gun');
    assert.equal(r.correct, false);
    assert.equal(r.land, 'wrong');
    assert.equal(game.state.current, null);
    assert.equal(game.state.aura, aura0);
    assert.equal(of('step').length, wrongAt);
  }
});

test('the special customer waits for atMs', () => {
  const { game, of } = setup({ config: { special: { customer: ORIG, atMs: 5000 } } });
  game.start();
  for (let i = 0; i < 5; i++) { game.tick(900); game.press(rightKey(game)); }
  assert.ok(!of('arrive').some((a) => a.customer === ORIG));
  game.tick(600);
  game.press(rightKey(game));
  assert.equal(game.state.current.customer, ORIG);
});

test('rage never swallows the special customer: deferred while their arrival would start rage, first after it', () => {
  // fury 50 per arrival, nothing per answer: the 2nd arrival fills it. The special one is due from the 2nd arrival on.
  const { game, of } = setup({ config: { furyPerCustomer: 50, furyCorrect: 0, special: { customer: ORIG, atMs: 1 } } });
  game.start();
  assert.notEqual(game.state.current.customer, ORIG, 'not due yet at 0 ms');
  game.tick(10);
  game.press(rightKey(game));
  // due now, but this arrival starts rage: a normal customer comes instead
  assert.equal(game.state.phase, 'rage');
  assert.notEqual(game.state.current.customer, ORIG);
  assert.ok(!of('arrive').some((a) => a.customer === ORIG));
  for (const k of ['take', 'shut', 'gun', 'take']) assert.equal(game.press(k).rage, true);
  game.tick(8001);
  assert.equal(game.state.phase, 'playing');
  game.press(rightKey(game)); // the customer who waited through rage
  // fury is back at 0: the special customer is the next one, outside rage, and the two steps play out
  assert.equal(game.state.current.customer, ORIG);
  assert.equal(game.state.phase, 'playing');
  assert.equal(game.state.fury, 50);
  const s1 = game.press('take');
  assert.equal(s1.step, 1);
  game.speechDone();
  const r = game.press('shut');
  assert.equal(r.correct, true);
  assert.equal(r.land, 'step');
  assert.equal(of('arrive').filter((a) => a.customer === ORIG).length, 1);
});

test('the special customer never arrives in rage, even when due during it', () => {
  // the first answer fills fury (rage starts with nobody at the counter); the special one is due from 2 s, in rage
  const { game, of } = setup({ config: { furyPerCustomer: 0, furyCorrect: 100, special: { customer: ORIG, atMs: 2000 } } });
  game.start();
  game.press(rightKey(game));
  assert.equal(game.state.phase, 'rage');
  assert.equal(game.state.current, null);
  game.tick(3000); // due now, but nobody arrives during rage
  assert.equal(game.state.current, null);
  assert.equal(game.press('gun').rage, true);
  game.tick(5001); // rage ends → the next customer is the special one
  assert.equal(game.state.phase, 'playing');
  assert.equal(game.state.current.customer, ORIG);
  assert.equal(of('arrive').filter((a) => a.customer === ORIG).length, 1);
  assert.equal(game.press('take').step, 1, 'the first press is a step, not a rage hit');
});

test('the special customer at the counter can never start rage (step and arrival add no extra fury)', () => {
  // fury 90 after the first arrival + answer: the special arrival (+6) stays below 100 and comes on time
  const { game } = setup({ config: { furyPerCustomer: 6, furyCorrect: 84, special: { customer: ORIG, atMs: 1 } } });
  game.start();
  game.tick(10);
  game.press(rightKey(game));
  assert.equal(game.state.fury, 96);
  assert.equal(game.state.current.customer, ORIG);
  assert.equal(game.state.phase, 'playing');
  game.press('take');
  assert.equal(game.state.phase, 'playing', 'a step adds no fury');
  game.speechDone();
  game.press('shut'); // the finale adds furyCorrect → rage starts only now, with nobody at the counter
  assert.equal(game.state.phase, 'rage');
  assert.equal(game.state.current, null);
});

// ---------------------------------------------------------------- order: fixedOrder / keyWeights (8.2)

test('fixedOrder: the first customers come in the given order', () => {
  const { game, of } = setup({ customers: makeCustomers(30), config: { fixedOrder: [7, 2, 9] } });
  game.start();
  for (let i = 0; i < 5; i++) game.press(rightKey(game));
  assert.deepEqual(of('arrive').slice(0, 3).map((a) => a.customer.id), [7, 2, 9]);
  assert.ok(!of('arrive').slice(3).some((a) => [7, 2, 9].includes(a.customer.id)), 'fixed ones are taken from the pool');
});

test('keyWeights: roughly the weighted mix, never the same key three times in a row', () => {
  const customers = makeCustomers(60);
  const counts = { gun: 0, shut: 0, take: 0 };
  for (const seed of [1, 2, 3, 4]) {
    const { game, of } = setup({ seed, customers, config: { keyWeights: { gun: 0.45, take: 0.30, shut: 0.25 }, auraStart: 100 } });
    game.start();
    for (let i = 0; i < 400; i++) game.press(rightKey(game));
    const keys = of('arrive').map((a) => a.customer.key);
    for (let i = 2; i < keys.length; i++) {
      assert.ok(!(keys[i] === keys[i - 1] && keys[i] === keys[i - 2]), `seed ${seed} at ${i}`);
    }
    keys.forEach((k) => counts[k]++);
  }
  const n = counts.gun + counts.shut + counts.take;
  assert.ok(counts.gun / n > 0.36 && counts.gun / n < 0.5, JSON.stringify(counts));
  assert.ok(counts.shut / n > 0.18 && counts.shut / n < 0.33, JSON.stringify(counts));
});

test('snapshot exposes speaking and step', () => {
  const { game } = live();
  game.start();
  const c = game.state.current;
  assert.equal(c.speaking, true);
  assert.equal(c.step, 0);
  assert.throws(() => { 'use strict'; c.speaking = false; });
});
