// Gameplay v2 stage 2 in the engine and days.js: preview, fast mouth, specials, group box, change-order customer,
// the boss, the day-4 meter, mini events, the shutter, stars and rating (docs/gameplay-v2.md 3, 5, 6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import { DAYS, dayInfo, configForDay, evaluateDay, meets, specialsForDay, poolForDay } from '../src/days.js';
import { getContent } from '../src/content.js';

const C = (id, key, extra = {}) => ({ id, key, style: ['real', 'cold', 'deadpan', 'disdain'][id % 4], cups: null, reply: `r${id}|p${id}`, alt: `a${id}`, ...extra });
const ROSTER = [C(1, 'gun'), C(2, 'shut'), C(3, 'take'), C(4, 'gun'), C(5, 'shut'), C(6, 'take'), C(7, 'gun'), C(8, 'shut'), C(9, 'take'),
  C(10, 'gun', { cups: 1 }), C(11, 'take', { cups: 100 }), C(12, 'gun', { cups: 15 })];
const PLAIN = ROSTER.filter((c) => c.cups == null);
const BASE = { minAnswerMs: 100, cutInFromMs: 200, speakMaxMs: 400, quickMinAnswerMs: 60, quickCutInFromMs: 100, quickSpeakMs: 150, landMs: 300, landBigMs: 300, landWrongMs: 300, landPoliteMs: 300, furyEnabled: false, altChance: 0 };

function make(config = {}, customers = PLAIN) {
  return createGame({ customers, rng: () => 0.42, config: { ...BASE, ...config } });
}
function log(g, names) {
  const out = [];
  for (const n of names) g.on(n, (p) => out.push({ ev: n, ...p }));
  return out;
}
// answer the customer at the counter with key(cur) after t0 + reactMs; returns the press result
function answerNow(g, key, reactMs = 50) {
  let guard = 0;
  while (!g.state.current && guard++ < 400) g.tick(10);
  while (g.state.current && g.state.current.speaking && guard++ < 800) g.tick(10);
  g.tick(reactMs);
  const cur = g.state.current;
  return g.press(typeof key === 'function' ? key(cur) : key ?? cur.key, 0);
}

test('preview: state.upcoming shows the next customers, and they come in that order', () => {
  const g = make({ preview: 2 });
  g.start();
  for (let i = 0; i < 6; i++) {
    const next = g.state.upcoming.slice();
    assert.equal(next.length, 2);
    answerNow(g);
    while (!g.state.current) g.tick(10);
    assert.equal(g.state.current.customer, next[0], `customer ${i + 2} was previewed`);
  }
});

test('fast mouth: five correct in a row → quick; quick customers are silent, land fast; every 5th is full; a wrong key ends it', () => {
  const g = make({ quickAt: 5, quickEvery: 5, quickLandMs: 50, quickSpeakMs: 150, quickMinAnswerMs: 60, quickCutInFromMs: 100 });
  const ev = log(g, ['quickStart', 'quickEnd', 'arrive', 'resolve']);
  g.start();
  for (let i = 0; i < 5; i++) answerNow(g);
  assert.equal(ev.filter((e) => e.ev === 'quickStart').length, 1);
  assert.equal(g.state.quick, true);
  for (let i = 0; i < 10; i++) answerNow(g);
  const arr = ev.filter((e) => e.ev === 'arrive').slice(5, 15);
  assert.deepEqual(arr.map((a) => a.quick), [true, true, true, true, false, true, true, true, true, false], 'every 5th is full');
  assert.ok(arr.every((a) => a.silent), 'nobody talks in fast mouth');
  const res = ev.filter((e) => e.ev === 'resolve').slice(5, 15);
  assert.ok(res.filter((r) => r.quick).every((r) => r.land === 'quick'));
  assert.equal(g.state.st2.quickBest, 10);
  answerNow(g, (cur) => (cur.key === 'gun' ? 'shut' : 'gun'));
  assert.equal(g.state.quick, false);
  assert.equal(ev.filter((e) => e.ev === 'quickEnd')[0].run, 10);
  assert.equal(g.state.st2.quickBest, 10, 'the best run stays');
});

test('fast mouth: a timeout also ends it, without any extra penalty', () => {
  const g = make({ quickAt: 2, quickSpeakMs: 150, windowStartMs: 500, windowEndMs: 500, introBonusMs: 0, firstTimeoutFree: true });
  g.start();
  answerNow(g); answerNow(g);
  assert.equal(g.state.quick, true);
  const aura = g.state.aura;
  while (!g.state.current) g.tick(10);
  for (let i = 0; i < 120 && g.state.current; i++) g.tick(10);
  assert.equal(g.state.quick, false);
  assert.equal(g.state.aura, aura, 'first timeout free as before');
});

test('fast mouth: 250s and big orders are full scenes (silent, full line) and restart the every-5th count', () => {
  const big = C(20, 'take', { cups: 250, style: '250' });
  const g = make({ quickAt: 1, quickSpeakMs: 150, fixedOrder: [1, 2, 20, 3] }, [...PLAIN, big]);
  const ev = log(g, ['arrive']);
  g.start();
  for (let i = 0; i < 4; i++) answerNow(g);
  const a = ev.map((e) => [e.customer.id, e.quick, e.silent]);
  assert.deepEqual(a.slice(1, 4), [[2, true, true], [20, false, true], [3, true, true]]);
});

test('specials: each once at its time; a group box needs N presses of its key and pays ×1.5', () => {
  const g = make({ specials: [{ type: 'group', atMs: 0 }], groupMin: 3, groupMax: 3, quickSpeakMs: 150 });
  const ev = log(g, ['groupHit', 'resolve']);
  g.start();
  const cur = g.state.current;
  assert.ok(Array.isArray(cur.customer.group) && cur.customer.group.length === 3);
  assert.ok(cur.customer.group.every((c) => c.key === cur.customer.key));
  assert.ok(cur.silent);
  answerNow(g, cur.customer.key);
  assert.equal(g.state.current.hits, 1);
  g.press(cur.customer.key);
  assert.equal(ev.filter((e) => e.ev === 'groupHit').length, 2);
  const r = g.press(cur.customer.key);
  assert.equal(r.group, 3);
  assert.equal(r.correct, true);
  // 3 × (1 + 0 combo) × speed × 1.5, rounded up; served +3, combo +3
  assert.equal(r.queueDelta, Math.ceil(3 * r.mult * 1.5 - 1e-9));
  assert.equal(g.state.stats.served, 3);
  assert.equal(g.state.combo, 3);
  assert.equal(g.state.st2.groupsCleared, 1);
});

test('group box: a wrong key scatters the group (a wrong answer, +1)', () => {
  const g = make({ specials: [{ type: 'group', atMs: 0 }], quickSpeakMs: 150 });
  g.start();
  const k = g.state.current.customer.key;
  const r = answerNow(g, k === 'gun' ? 'shut' : 'gun');
  assert.equal(r.correct, false);
  assert.equal(r.queueDelta, 1);
  assert.equal(g.state.st2.groupsCleared, 0);
});

test('change-order customer: the old key is right before the flip, the new key (250 cups, +25) after it', () => {
  const change = { id: 'change', key: 'gun', style: 'deadpan', cups: null, reply: 'x', flip: { key: 'take', cups: 250, atMs: 300 } };
  const early = make({ specials: [{ customer: change, atMs: 0 }], flipSpeakMs: 900 });
  early.start();
  early.tick(250); // talking, before the flip: a cut-in
  const r1 = early.press('gun');
  assert.equal(r1.correct, true);
  assert.equal(r1.flipped, false);
  assert.equal(r1.big, 0, 'no 250 bonus when you do not wait');
  const late = make({ specials: [{ customer: change, atMs: 0 }], flipSpeakMs: 900 });
  const ev = log(late, ['flip']);
  late.start();
  late.tick(350);
  assert.equal(ev.length, 1);
  assert.equal(late.state.current.key, 'take');
  const r2 = late.press('take');
  assert.equal(r2.correct, true);
  assert.equal(r2.flipped, true);
  assert.equal(r2.big, 25);
  assert.equal(late.state.st2.flipsWaited, 1);
  // game.flip(): main.js flips when the first line ends
  const m = make({ specials: [{ customer: { ...change, flip: { key: 'take', cups: 250, atMs: 5000 } }, atMs: 0 }], flipSpeakMs: 9000 });
  m.start();
  m.tick(200);
  assert.equal(m.flip(), true);
  assert.equal(m.state.current.key, 'take');
});

const BOSS = { id: 'boss', boss: true, holdLast: true, style: 'cold', cups: null, steps: ['take', 'shut', 'gun', 'take', 'take', 'take', 'take', 'take'], key: 'take', haggle: [3, 4, 5, 6], stepSpeakMs: 300, reply: 'f', reply2: 'f' };

test('boss: every press moves him to the next step; a wrong key too (+1, combo frozen)', () => {
  const g = make({ specials: [{ customer: BOSS, atMs: 0 }], stepSpeakMs: 300 });
  const ev = log(g, ['step', 'resolve']);
  g.start();
  answerNow(g, 'take');
  answerNow(g, 'gun'); // wrong on 调甜 (shut)
  const steps = ev.filter((e) => e.ev === 'step');
  assert.deepEqual(steps.map((s) => [s.prev, s.step, s.correct]), [[0, 1, true], [1, 2, false]]);
  assert.equal(steps[1].queueDelta, 1);
  assert.equal(g.state.combo, 1, 'frozen');
  assert.equal(ev.filter((e) => e.ev === 'resolve').length, 0, 'he is still there');
});

test('boss: a timeout repeats the step (bossAgain), never ends the day and never costs aura', () => {
  const g = make({ specials: [{ customer: BOSS, atMs: 0 }], windowStartMs: 400, windowEndMs: 400, introBonusMs: 0, firstTimeoutFree: false });
  const ev = log(g, ['bossAgain', 'polite']);
  g.start();
  const aura = g.state.aura;
  for (let i = 0; i < 300; i++) g.tick(10);
  assert.ok(ev.filter((e) => e.ev === 'bossAgain').length >= 2);
  assert.equal(ev.filter((e) => e.ev === 'polite').length, 0);
  assert.equal(g.state.current.customer, BOSS);
  assert.equal(g.state.current.step, 0, 'the same step again');
  assert.equal(g.state.aura, aura);
  assert.ok(g.state.st2.bossTimeouts >= 2);
});

test('boss: the last step needs a full hold on 收; a tap or another key makes him ask again; the hold beats him', () => {
  const g = make({ specials: [{ customer: BOSS, atMs: 0 }] });
  const ev = log(g, ['step', 'resolve', 'holding']);
  g.start();
  for (const k of BOSS.steps.slice(0, 7)) answerNow(g, k, 20);
  assert.equal(g.state.current.step, 7);
  assert.equal(g.state.st2.bossHagglePerfect, 0, 'not beaten yet');
  // a tap: press, then release after 100 ms
  const r = answerNow(g, 'take');
  assert.equal(r.holding, true);
  g.tick(100);
  assert.equal(g.state.current.holding, true, 'the timer is frozen while held');
  const again = g.release('take', 100);
  assert.equal(again.again, true);
  assert.equal(again.tap, true);
  assert.equal(g.state.current.step, 7);
  // another key
  const w = answerNow(g, 'gun');
  assert.equal(w.again, true);
  // the full hold
  answerNow(g, 'take');
  const fin = g.charge(2);
  assert.equal(fin.correct, true);
  assert.equal(fin.final, true);
  assert.equal(fin.land, 'step');
  assert.ok(fin.big >= 25, 'the 250 bonus');
  assert.equal(g.state.st2.bossBeaten, true);
  assert.equal(g.state.st2.bossHagglePerfect, 1, 'every haggling step within 600 ms');
  assert.equal(ev.filter((e) => e.ev === 'resolve').length, 1);
});

test('meter: 收 adds cups (correct or off-key, null = 1); exactly 250 = +25 and full fury; over = reset +5', () => {
  const r250 = C(30, 'take', { cups: 250 });
  const r100 = C(31, 'take', { cups: 100 });
  const g = make({ meter: true, furyEnabled: true, fixedOrder: [31, 31, 1, 30, 31, 31, 31] }, [...PLAIN, r250, r100]);
  const ev = log(g, ['meter', 'furyFull']);
  g.start();
  answerNow(g, 'take'); // 100
  answerNow(g, 'take'); // 200
  answerNow(g, 'take'); // customer 1 (gun) booked anyway: 201
  assert.equal(g.state.meter, 201);
  answerNow(g, 'take'); // 250 cups → 451: over
  const over = ev.filter((e) => e.ev === 'meter').at(-1);
  assert.equal(over.over, true);
  assert.equal(over.queueDelta, 5);
  assert.equal(g.state.meter, 0);
  answerNow(g, 'take'); // 100
  answerNow(g, 'gun'); // a 滚 adds nothing
  assert.equal(g.state.meter, 100);
  const g2 = make({ meter: true, furyEnabled: true, fixedOrder: [30] }, [...PLAIN, r250]);
  const ev2 = log(g2, ['meter', 'furyFull']);
  g2.start();
  answerNow(g2, 'take');
  assert.equal(ev2.find((e) => e.ev === 'meter').hit, true);
  assert.equal(ev2.filter((e) => e.ev === 'furyFull').length, 1);
  assert.equal(g2.state.st2.meterHits, 1);
});

test('meter: a full charge doubles the cups of that 收; 249 + a one-cup order is the riddle', () => {
  const r100 = C(31, 'take', { cups: 100 });
  const one = C(32, 'gun', { cups: 1 });
  const g = make({ meter: true, chargeBonus: [0, 1, 2], fixedOrder: [31] }, [...PLAIN, r100, one]);
  g.start();
  answerNow(g, 'take');
  assert.equal(g.state.meter, 100);
  g.charge(2);
  assert.equal(g.state.meter, 200);
  // the 249 trap booked off-key, then a one-cup order booked: exactly 250 (day 4's riddle)
  const trap = C(33, 'gun', { cups: 249 });
  const h = make({ meter: true, fixedOrder: [33, 32] }, [...PLAIN, one, trap]);
  h.start();
  answerNow(h, 'take');
  assert.equal(h.state.meter, 249);
  answerNow(h, 'take');
  assert.equal(h.state.meter, 0);
  assert.equal(h.state.st2.meterHits, 1);
  assert.equal(h.state.st2.meter249plus1, 1);
});

test('mini events: start instead of the next customer when due; presses go to the event; the shutter ends the day', () => {
  const g = make({ events: [{ type: 'megaphone', atMs: 1000 }], shutterMs: 2000, durationMs: 12000 });
  const ev = log(g, ['eventStart', 'eventEnd', 'leave', 'arrive', 'over']);
  g.start();
  for (let i = 0; i < 150 && !g.state.event; i++) {
    if (g.state.current && !g.state.current.speaking) g.press(g.state.current.key);
    g.tick(20);
  }
  assert.equal(g.state.event.type, 'megaphone');
  assert.equal(g.state.current, null);
  const q = g.state.queue;
  for (let i = 0; i < 5; i++) assert.equal(g.press('gun').event, 'megaphone');
  assert.equal(g.state.queue, q + 5);
  for (let i = 0; i < 300 && g.state.event; i++) g.tick(20);
  assert.equal(ev.filter((e) => e.ev === 'eventEnd')[0].type, 'megaphone');
  // run to the shutter
  while (g.state.timeLeftMs > 2000) g.tick(20);
  g.tick(20);
  assert.equal(g.state.shutter, true);
  assert.equal(g.state.event.type, 'shutter');
  const q2 = g.state.queue;
  g.press('take');
  assert.equal(g.state.queue, q2 + 1);
  const arrivals = ev.filter((e) => e.ev === 'arrive').length;
  while (g.state.phase !== 'over') g.tick(50);
  assert.equal(ev.filter((e) => e.ev === 'arrive').length, arrivals, 'nobody comes during the shutter');
  assert.equal(ev.filter((e) => e.ev === 'over').length, 1);
});

test('days.js: days 2+ turn on preview, fast mouth, the shutter and one mini event; day 1 stays as it was', () => {
  const d1 = dayInfo(1);
  assert.deepEqual([d1.preview, d1.quickAt, d1.shutterMs, d1.events.length, d1.specials.length], [0, 0, 0, 0, 0]);
  for (const d of DAYS.slice(1)) {
    assert.equal(d.preview, 2);
    assert.equal(d.quickAt, 5);
    assert.equal(d.shutterMs, 5000);
    assert.equal(d.events.length, 1, `day ${d.day} has one mini event`);
    assert.ok(d.star2 && d.star3, `day ${d.day} has ★2 / ★3`);
  }
  assert.deepEqual(DAYS.map((d) => d.rule), ['open', 'quick', 'original', 'meter', 'phone', 'crowd', 'boss']);
  assert.equal(dayInfo(4).meter, true);
  assert.equal(dayInfo(5).events[0].type, 'phone');
  const d3 = dayInfo(3).specials.filter((s) => s.type === 'original').length;
  assert.ok(d3 >= 4 && d3 <= 6, 'original day: 4–6 originals');
  assert.ok(dayInfo(6).specials.filter((s) => s.type === 'group').length >= 3);
  assert.ok(dayInfo(6).specials.some((s) => s.type === 'change'));
  assert.deepEqual(dayInfo(7).specials.map((s) => s.type), ['boss']);
  const cfg = configForDay(2);
  assert.equal(cfg.preview, 2);
  assert.equal(cfg.quickCutInFromMs, dayInfo(2).quickEnterMs + 200);
  // specialsForDay maps content customers; groups need none
  const orig = { id: 'orig', steps: ['take', 'shut'] };
  assert.equal(specialsForDay(3, { original: orig }).every((s) => s.customer === orig), true);
  assert.equal(specialsForDay(6, {}).every((s) => s.type === 'group'), true);
  assert.equal(specialsForDay(2, {}), null);
});

test('stars: ★1 queue (boss day: the boss beaten), ★2 the rule goal, ★3 the riddle; rating C/B/A/S and gold 250', () => {
  assert.equal(meets({ stat: 'x', min: 2 }, { x: 2 }), true);
  assert.equal(meets({ all: [{ stat: 'bossBeaten', min: 1 }, { stat: 'bossTimeouts', max: 0 }] }, { bossBeaten: true, bossTimeouts: 1 }), false);
  const s1 = dayInfo(2).star1;
  assert.equal(evaluateDay(2, { queue: s1 - 1 }).rating, 'C');
  assert.deepEqual(evaluateDay(2, { queue: s1 }).stars, [true, false, false]);
  assert.equal(evaluateDay(2, { queue: s1 }).rating, 'B');
  assert.equal(evaluateDay(2, { queue: Math.ceil(s1 * 1.5) }).rating, 'B');
  assert.equal(evaluateDay(2, { queue: Math.ceil(s1 * 1.5), quickBest: 15 }).rating, 'A');
  const top = evaluateDay(2, { queue: s1 * 2, quickBest: 20, quickCutIns: 3 });
  assert.deepEqual([top.stars, top.count, top.rating, top.mask], [[true, true, true], 3, 'S', 7]);
  assert.equal(evaluateDay(2, { queue: 1250, quickBest: 20, quickCutIns: 3 }).gold, true);
  assert.equal(evaluateDay(2, { queue: 1251, quickBest: 20, quickCutIns: 3 }).gold, false);
  assert.equal(evaluateDay(7, { queue: 999 }).stars[0], false, 'boss day: ★1 is beating him');
  const boss = evaluateDay(7, { queue: 300, bossBeaten: true, bossTimeouts: 0, bossHagglePerfect: 1 });
  assert.deepEqual(boss.stars, [true, true, true]);
  assert.equal(evaluateDay(7, { queue: 300, bossBeaten: true, bossTimeouts: 2 }).stars[1], false);
});

test('content: every day has a name, rule, ★2 and riddle; the boss has eight steps (zh and en)', () => {
  for (const lang of ['zh', 'en']) {
    const sys = getContent(lang).system;
    for (let n = 1; n <= 7; n++) assert.ok(sys.days[n].name && sys.days[n].rule && sys.days[n].riddle, `${lang} day ${n}`);
    assert.equal(sys.boss.steps.length, 8);
    assert.ok(sys.unlock.aura.includes(lang === 'zh' ? '被迫营业' : 'forced'), 'no early close any more');
  }
});

test('integration: day 6 with real content builds groups and the change-order customer; day 7 brings the boss', () => {
  const { customers } = getContent('zh');
  for (const n of [6, 7]) {
    const change = { id: 'change', key: 'gun', style: 'deadpan', cups: null, reply: 'x', flip: { key: 'take', cups: 250, atMs: 2500 } };
    const boss = { ...BOSS, stepSpeakMs: 2000 };
    const g = createGame({ customers: poolForDay(n, customers), rng: () => 0.3, config: configForDay(n, { specials: specialsForDay(n, { change, boss }) }) });
    const seen = new Set();
    g.on('arrive', ({ customer }) => seen.add(customer.group ? 'group' : customer.id));
    g.start();
    let t = 0;
    while (g.state.phase !== 'over' && t < 100000) {
      g.tick(20); t += 20;
      const cur = g.state.current;
      if (g.state.phase === 'rage') { g.press('gun'); continue; }
      if (g.state.event) { if (t % 200 === 0) g.press('take'); continue; }
      if (!cur) continue;
      if (!cur.speaking && cur.patienceMaxMs - cur.patienceMs >= 300) {
        if (cur.customer.boss && cur.step === 7) { g.press('take'); g.charge(2); } else g.press(cur.key);
      }
    }
    if (n === 6) { assert.ok(seen.has('group')); assert.ok(seen.has('change')); }
    if (n === 7) { assert.ok(seen.has('boss')); assert.equal(g.state.phase, 'over'); }
  }
});
