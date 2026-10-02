import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFxQueue, chargeLevel } from '../src/ui.js';

// Manual clock for the queue's scheduler.
function fakeClock() {
  let now = 0;
  let timers = [];
  return {
    schedule(fn, ms) { const t = { fn, at: now + ms }; timers.push(t); return t; },
    cancel(t) { timers = timers.filter((x) => x !== t); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const t = timers[0];
        if (!t || t.at > end) break;
        timers.shift();
        now = t.at;
        t.fn();
      }
      now = end;
    },
  };
}

test('chargeLevel: 0 below 300ms, 1 from 300ms, 2 from 800ms', () => {
  assert.deepEqual([0, 299, 300, 799, 800, 5000].map(chargeLevel), [0, 0, 1, 1, 2, 2]);
});

test('fx queue shows one big effect at a time, each for at most 900ms', () => {
  const clock = fakeClock();
  const q = createFxQueue({ maxMs: 900, schedule: clock.schedule, cancel: clock.cancel });
  const onScreen = new Set();
  const log = [];
  const item = (name) => () => {
    onScreen.add(name);
    log.push(['show', name, onScreen.size]);
    return () => { onScreen.delete(name); log.push(['hide', name]); };
  };
  q.push(item('perfect'), 900);
  q.push(item('250'), 1400); // capped at 900
  q.push(item('milestone'), 600);
  assert.deepEqual([...onScreen], ['perfect']);
  assert.equal(q.size, 3);
  clock.advance(899);
  assert.deepEqual([...onScreen], ['perfect']);
  clock.advance(1);
  assert.deepEqual([...onScreen], ['250']);
  clock.advance(900);
  assert.deepEqual([...onScreen], ['milestone']);
  clock.advance(600);
  assert.equal(onScreen.size, 0);
  assert.equal(q.size, 0);
  assert.ok(log.filter((e) => e[0] === 'show').every((e) => e[2] === 1), 'never two at once');
  // idle queue plays the next push immediately
  q.push(item('rage'));
  assert.deepEqual([...onScreen], ['rage']);
});

test('fx queue drops the oldest pending items beyond maxPending and clear() stops everything', () => {
  const clock = fakeClock();
  const q = createFxQueue({ maxMs: 900, maxPending: 2, schedule: clock.schedule, cancel: clock.cancel });
  const shown = [];
  let visible = 0;
  const item = (n) => () => { shown.push(n); visible++; return () => { visible--; }; };
  for (let i = 0; i < 6; i++) q.push(item(i));
  assert.equal(q.size, 3); // 1 playing + 2 pending
  clock.advance(5000);
  assert.deepEqual(shown, [0, 4, 5]);
  q.push(item('a'));
  q.push(item('b'));
  q.clear();
  assert.equal(visible, 0);
  assert.equal(q.size, 0);
  clock.advance(5000);
  assert.deepEqual(shown, [0, 4, 5, 'a']);
});
