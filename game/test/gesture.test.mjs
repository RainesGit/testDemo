// Gesture input (src/gesture.js): the pure classifier and the streaming recognizer (docs/gameplay-v2.md 9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GESTURE, classify, keyOf, swipeCharge, holdCharge, tapCharge, towardQueue, bowlCount, createRecognizer,
} from '../src/gesture.js';

// a straight stroke from (x0, y0) by (dx, dy) over ms, sampled every 16 ms
function stroke(x0, y0, dx, dy, ms, t0 = 0) {
  const out = [];
  const n = Math.max(1, Math.round(ms / 16));
  for (let i = 0; i <= n; i++) out.push({ x: x0 + (dx * i) / n, y: y0 + (dy * i) / n, t: t0 + (ms * i) / n });
  return out;
}

test('keyOf maps the three gestures to the three keys', () => {
  assert.equal(keyOf('swipe'), 'gun');
  assert.equal(keyOf('taps'), 'shut');
  assert.equal(keyOf('hold'), 'take');
  assert.equal(keyOf('tap'), null);
  assert.equal(keyOf('none'), null);
});

test('classify: a long stroke is a swipe with direction, angle and speed', () => {
  const c = classify(stroke(100, 300, 120, 0, 100));
  assert.equal(c.kind, 'swipe');
  assert.ok(Math.abs(c.dir.x - 1) < 1e-9 && Math.abs(c.dir.y) < 1e-9);
  assert.ok(Math.abs(c.angle) < 1e-9);
  assert.ok(c.speed > 1.1 && c.speed < 1.3, String(c.speed));
  const up = classify(stroke(100, 300, 60, -60, 80));
  assert.equal(up.kind, 'swipe');
  assert.ok(Math.abs(up.angle - 45) < 1e-6, String(up.angle)); // up-right = +45°
  const left = classify(stroke(200, 300, -80, 10, 120));
  assert.equal(left.kind, 'swipe');
  assert.ok(left.dir.x < 0);
});

test('classify: a short fast flick is a swipe, a short slow wobble is not', () => {
  assert.equal(classify(stroke(100, 300, 30, 0, 40)).kind, 'swipe'); // 0.75 px/ms
  assert.equal(classify(stroke(100, 300, 8, 0, 90)).kind, 'tap');
});

test('classify: tap vs hold at ~180 ms, wandering a little is allowed', () => {
  assert.equal(classify(stroke(100, 300, 2, 1, 80)).kind, 'tap');
  assert.equal(classify(stroke(100, 300, 0, 0, GESTURE.tapMaxMs - 10)).kind, 'tap');
  const h = classify(stroke(100, 300, 5, 4, 900));
  assert.equal(h.kind, 'hold');
  assert.ok(h.holdMs >= 899);
});

test('classify: a burst of three quick taps is "taps"; a slow third tap starts a new burst', () => {
  const t1 = stroke(100, 300, 0, 0, 60, 0);
  const t2 = stroke(104, 302, 0, 0, 60, 200);
  const t3 = stroke(98, 299, 0, 0, 60, 400);
  const c = classify([t1, t2, t3]);
  assert.equal(c.kind, 'taps');
  assert.equal(c.taps, 3);
  assert.equal(classify([t1, t2]).kind, 'tap');
  assert.equal(classify([t1, t2]).taps, 2);
  const late = stroke(98, 299, 0, 0, 60, 1200);
  const d = classify([t1, t2, late]);
  assert.equal(d.kind, 'tap');
  assert.equal(d.taps, 1);
  // a swipe at the end of a burst is a swipe
  assert.equal(classify([t1, t2, stroke(100, 300, 90, 0, 80, 400)]).kind, 'swipe');
  assert.equal(classify([]).kind, 'none');
  assert.equal(classify([[]]).kind, 'none');
});

test('charge levels: swipe speed, hold time, taps past the third', () => {
  assert.equal(swipeCharge(0.5), 0);
  assert.equal(swipeCharge(GESTURE.swipeMid), 1);
  assert.equal(swipeCharge(GESTURE.swipeFast + 0.1), 2);
  assert.equal(holdCharge(299), 0);
  assert.equal(holdCharge(300), 1);
  assert.equal(holdCharge(800), 2);
  assert.deepEqual([3, 4, 5, 6].map((n) => tapCharge(n)), [0, 1, 2, 2]);
});

test('bowling: only right / up-right flings count, 1–3 heads by speed', () => {
  const sw = (angle, speed) => {
    const r = (angle * Math.PI) / 180;
    return { dir: { x: Math.cos(r), y: -Math.sin(r) }, angle, speed };
  };
  assert.equal(towardQueue(sw(30, 1)), true);
  assert.equal(towardQueue(sw(0, 1)), true);
  assert.equal(towardQueue(sw(120, 3)), false); // up-left
  assert.equal(towardQueue(sw(-90, 3)), false); // down
  assert.equal(towardQueue(sw(180, 3)), false);
  assert.equal(bowlCount(sw(30, 0.5)), 0);
  assert.equal(bowlCount(sw(30, 1)), 1);
  assert.equal(bowlCount(sw(30, 1.8)), 2);
  assert.equal(bowlCount(sw(30, 3)), 3);
  assert.equal(bowlCount(sw(160, 3)), 0);
  assert.equal(bowlCount(null), 0);
});

function rec() {
  const out = [];
  const r = createRecognizer({ onGesture: (e) => out.push(e) });
  return { r, out, types: () => out.map((e) => e.type) };
}

test('recognizer: a swipe is decided at 40 px, then streams its path', () => {
  const { r, out, types } = rec();
  r.down(1, 100, 300, 0);
  r.move(1, 120, 300, 16);
  r.tick(16);
  assert.equal(out.length, 0);
  r.move(1, 150, 290, 32);
  assert.deepEqual(types(), ['swipe', 'swipeMove']);
  assert.ok(out[0].speed > 1);
  r.move(1, 220, 280, 48);
  r.up(1, 230, 280, 56);
  assert.deepEqual(types(), ['swipe', 'swipeMove', 'swipeMove', 'swipeEnd']);
});

test('recognizer: a short fast flick is a swipe on pointer up', () => {
  const { r, types } = rec();
  r.down(1, 100, 300, 0);
  r.move(1, 115, 298, 16);
  r.up(1, 128, 296, 30);
  assert.deepEqual(types(), ['swipe', 'swipeMove', 'swipeEnd']);
});

test('recognizer: taps count up within a burst, burstEnd comes after the gap', () => {
  const { r, out, types } = rec();
  let t = 0;
  for (let i = 0; i < 4; i++) {
    r.down(1, 100, 300, t);
    r.tick(t + 30);
    r.up(1, 101, 300, t + 60);
    t += 160;
  }
  assert.deepEqual(out.map((e) => e.n), [1, 2, 3, 4]);
  r.tick(t + GESTURE.burstGapMs + 10);
  assert.equal(types().at(-1), 'burstEnd');
  assert.equal(out.at(-1).n, 4);
  r.down(1, 100, 300, t + 2000);
  r.up(1, 100, 300, t + 2050);
  assert.equal(out.at(-1).n, 1); // a new burst
});

test('recognizer: holding still starts a hold at 180 ms, levels at 300 / 800 ms, ends on up', () => {
  const { r, out, types } = rec();
  r.down(7, 100, 300, 1000);
  r.tick(1100);
  assert.equal(out.length, 0);
  r.tick(1190);
  assert.deepEqual(types(), ['holdStart']);
  r.move(7, 104, 303, 1250);
  r.tick(1310);
  r.tick(1820);
  r.tick(1900);
  assert.deepEqual(types(), ['holdStart', 'holdLevel', 'holdLevel']);
  assert.deepEqual(out.filter((e) => e.type === 'holdLevel').map((e) => e.level), [1, 2]);
  r.up(7, 104, 303, 1950);
  assert.equal(types().at(-1), 'holdEnd');
  assert.equal(out.at(-1).holdMs, 950);
  // a cancelled hold ends too
  r.down(8, 100, 300, 3000);
  r.tick(3200);
  r.cancel(8, 3300);
  assert.equal(out.at(-1).type, 'holdEnd');
  assert.equal(out.at(-1).cancelled, true);
});

test('recognizer: a hold without any frame in between still resolves on up; moving early makes a swipe, not a hold', () => {
  const { r, types } = rec();
  r.down(1, 100, 300, 0);
  r.up(1, 100, 300, 400);
  assert.deepEqual(types(), ['holdStart', 'holdEnd']);
  const b = rec();
  b.r.down(1, 100, 300, 0);
  b.r.move(1, 160, 300, 100);
  b.r.tick(300);
  assert.deepEqual(b.types(), ['swipe', 'swipeMove']);
});

test('recognizer: two pointers at once are independent (a tap with each thumb continues the burst)', () => {
  const { r, out } = rec();
  r.down(1, 100, 300, 0);
  r.down(2, 200, 300, 20);
  r.up(1, 100, 300, 60);
  r.up(2, 200, 300, 90);
  assert.deepEqual(out.map((e) => [e.type, e.n]), [['tap', 1], ['tap', 2]]);
  assert.equal(r.active, 0);
});
