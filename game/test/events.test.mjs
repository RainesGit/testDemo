// Mini events (src/events.js): pure state machines driven by the engine (gameplay-v2 5, stage 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEvent, dueEvent, calcValue, shutterCap, EVENTS, EVENT_TYPES } from '../src/events.js';

const kinds = (fx, kind) => fx.filter((e) => e.kind === kind);
const queueOf = (fx) => kinds(fx, 'queue').reduce((t, e) => t + e.n, 0);

test('every event type has a duration; unknown types throw', () => {
  assert.deepEqual(EVENT_TYPES.sort(), ['calculator', 'megaphone', 'phone', 'shutter', 'stamp']);
  for (const t of EVENT_TYPES) assert.ok(EVENTS[t].durationMs >= 5000 && EVENTS[t].durationMs <= 8000, t);
  assert.throws(() => createEvent('rider'));
});

test('megaphone: any key +1 up to the cap of 20, then feedback only; ends after 5 s', () => {
  const ev = createEvent('megaphone');
  let q = 0;
  for (let i = 0; i < 30; i++) q += queueOf(ev.press(['gun', 'shut', 'take'][i % 3]));
  assert.equal(q, 20);
  assert.equal(ev.state().count, 20);
  assert.equal(kinds(ev.press('gun'), 'cue')[0].cue, 'capped');
  assert.equal(ev.done, false);
  const fx = ev.tick(5000);
  assert.equal(ev.done, true);
  assert.equal(kinds(fx, 'end')[0].result.gained, 20);
  assert.deepEqual(ev.press('gun'), [], 'nothing after the end');
});

test('phone: two presses hang up (fury +20, fast when within 1.2 s); letting it ring costs nothing', () => {
  const ev = createEvent('phone');
  ev.tick(500);
  assert.equal(kinds(ev.press('gun'), 'end').length, 0);
  const fx = ev.press('take');
  assert.equal(kinds(fx, 'fury')[0].n, 20);
  assert.equal(kinds(fx, 'cue').find((c) => c.cue === 'hangup').fast, true);
  assert.equal(kinds(fx, 'end')[0].result.hungUp, true);
  const slow = createEvent('phone');
  slow.tick(2000);
  slow.press('gun');
  assert.equal(kinds(slow.press('gun'), 'cue').find((c) => c.cue === 'hangup').fast, false);
  const ring = createEvent('phone');
  const end = ring.tick(5000);
  assert.equal(kinds(end, 'end')[0].result.hungUp, false);
  assert.equal(queueOf(end), 0);
});

test('calculator: the display cycles 0 / 249 / 250 / 251 / 300; release on 250 = jackpot +25', () => {
  const seq = [0, 180, 360, 540, 720, 900].map((ms) => calcValue(ms));
  assert.deepEqual(seq, [0, 249, 250, 251, 300, 0]);
  const ev = createEvent('calculator');
  assert.equal(kinds(ev.press('gun'), 'cue')[0].cue, 'ignored', 'only 收 counts');
  ev.press('take');
  ev.tick(400);
  assert.equal(ev.state().value, 250);
  const fx = ev.release('take', 400);
  assert.equal(queueOf(fx), 25);
  assert.equal(kinds(fx, 'cue')[0].jackpot, true);
  assert.equal(ev.done, true);
});

test('calculator: a miss is +2 with its number; three tries, a hold running at the end is released', () => {
  const ev = createEvent('calculator');
  ev.press('take');
  const miss = ev.release('take', 200); // 249
  assert.equal(queueOf(miss), 2);
  assert.equal(kinds(miss, 'cue')[0].value, 249);
  ev.press('take');
  ev.release('take', 20); // 0
  ev.press('take');
  const third = ev.release('take', 600); // 251
  assert.equal(kinds(third, 'end').length, 1);
  const late = createEvent('calculator');
  late.tick(6500);
  late.press('take');
  const end = late.tick(1000); // still held when the 7 s run out: released for the player (held 1000 ms → 0)
  assert.equal(kinds(end, 'cue')[0].value, calcValue(1000));
  assert.equal(late.done, true);
});

test('stamp: 收 stamps 10 each, 240 → 249 → 250; +1 per press (cap 20) and +25 when all 250 are stamped', () => {
  const ev = createEvent('stamp');
  let q = 0;
  const callouts = [];
  let n = 0;
  while (!ev.done && n < 40) {
    const fx = ev.press('take');
    q += queueOf(fx);
    for (const c of kinds(fx, 'cue')) if (c.callout) callouts.push(c.callout);
    n++;
  }
  assert.equal(n, 26);
  assert.deepEqual(callouts, [50, 100, 200, 249]);
  assert.equal(ev.state().value, 250);
  assert.equal(q, 20 + 25);
  assert.equal(kinds(createEvent('stamp').press('gun'), 'cue')[0].cue, 'ignored');
});

test('shutter: cap = min(300, ceil(10% of the queue)), at least 1', () => {
  assert.equal(shutterCap(0), 1);
  assert.equal(shutterCap(95), 10);
  assert.equal(shutterCap(2500), 250);
  assert.equal(shutterCap(99999), 300);
  const ev = createEvent('shutter', { queue: 40 });
  let q = 0;
  for (let i = 0; i < 10; i++) q += queueOf(ev.press('gun'));
  assert.equal(q, 4);
});

test('dueEvent: due, not done, not too late, and finished before the shutter', () => {
  const list = [{ type: 'megaphone', atMs: 45000 }, { type: 'phone', atMs: 60000 }];
  assert.equal(dueEvent(list, { elapsedMs: 44000, timeLeftMs: 46000 }), -1);
  assert.equal(dueEvent(list, { elapsedMs: 45500, timeLeftMs: 44500 }), 0);
  assert.equal(dueEvent(list, { elapsedMs: 61000, timeLeftMs: 29000, done: new Set([0]) }), 1);
  assert.equal(dueEvent(list, { elapsedMs: 80000, timeLeftMs: 10000, done: new Set([0]) }, { lateMs: 15000 }), -1, 'too late');
  assert.equal(dueEvent(list, { elapsedMs: 46000, timeLeftMs: 9000 }, { shutterMs: 5000 }), -1, 'would run into the shutter');
  assert.equal(dueEvent([{ type: 'shutter', atMs: 0 }], { elapsedMs: 1 }), -1, 'the shutter is not a mid-round event');
});
