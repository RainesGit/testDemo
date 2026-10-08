import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFxQueue, chargeLevel, camTransform, FOCUS, rectsOverlap, placeHuazi, hzFontSize, hzMaxScale } from '../src/ui.js';

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

test('camTransform keeps the focus point fixed on screen', () => {
  const W = 360, H = 640;
  for (const [name, [fx, fy]] of Object.entries(FOCUS)) {
    for (const s of [0.88, 1, 1.15, 1.4]) {
      const t = camTransform(fx, fy, s, W, H);
      const px = (fx / 100) * W, py = (fy / 100) * H;
      assert.ok(Math.abs(px * s + t.tx - px) < 1e-9 && Math.abs(py * s + t.ty - py) < 1e-9, name + ' ' + s);
    }
  }
  assert.equal(camTransform(50, 40, 1, W, H).css, 'translate(0.00px, 0.00px) scale(1)');
  assert.deepEqual(FOCUS.SIGN, [30, 55]);
});

test('rectsOverlap grows both rects by pad', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(rectsOverlap(a, { x: 12, y: 0, w: 5, h: 5 }), false);
  assert.equal(rectsOverlap(a, { x: 12, y: 0, w: 5, h: 5 }, 1.01), true);
  assert.equal(rectsOverlap(a, null, 5), false);
});

test('placeHuazi: pushes up first, then shrinks, never overlaps the sign, else null', () => {
  const box = { x0: -20, y0: -12, x1: 20, y1: 12 }; // 40 x 24 at size 24
  const sign = { x: 10, y: 80, w: 40, h: 26 };
  const free = placeHuazi({ box, cx: 50, cy: 40, size0: 24, sign, top: 14, bottom: 131 });
  assert.deepEqual(free, { cy: 40, size: 24 });
  const pushed = placeHuazi({ box, cx: 50, cy: 70, size0: 24, sign, top: 14, bottom: 131 });
  assert.equal(pushed.size, 24);
  assert.ok(pushed.cy + 12 <= sign.y - 4 + 1e-6, 'clears the sign by 4cqw');
  // Not enough room above: shrink (min 9) after reaching the top limit.
  const tight = placeHuazi({ box, cx: 30, cy: 40, size0: 24, sign: { x: 0, y: 40, w: 100, h: 30 }, top: 14, bottom: 131 });
  assert.ok(tight && tight.size < 24 && tight.size >= 9);
  const r = { x: 30 + box.x0 * tight.size / 24, y: tight.cy + box.y0 * tight.size / 24, w: 40 * tight.size / 24, h: 24 * tight.size / 24 };
  assert.equal(rectsOverlap(r, { x: 0, y: 40, w: 100, h: 30 }, 2), false);
  assert.ok(r.y >= 14 - 1e-6);
  // Impossible: sign covers the whole layer.
  assert.equal(placeHuazi({ box, cx: 50, cy: 60, size0: 24, sign: { x: 0, y: 0, w: 100, h: 140 }, top: 14, bottom: 131 }), null);
  // Never below the layer bottom (the button area).
  const low = placeHuazi({ box, cx: 50, cy: 128, size0: 24, sign: null, top: 14, bottom: 131 });
  assert.ok(low.cy + 12 <= 131);
});

test('hzFontSize follows the 5.2 table and fits in 90cqw', () => {
  assert.equal(hzFontSize('S1', '滾！'), 24);
  assert.equal(hzFontSize('S1', '調你媽！'), 18);
  assert.equal(hzFontSize('S1', '下一位！', { size: 'sm' }), 12);
  assert.equal(hzFontSize('S2', '250'), 22);
  assert.equal(hzFontSize('S2', '黃金比例最好喝'), 11);
  assert.equal(hzFontSize('S2', '250杯', { size: 'sm' }), 9);
  assert.equal(hzFontSize('S3', '還在想？'), 7.5);
  assert.equal(hzFontSize('S3', '一二三四五六七八九十一'), 6);
  assert.equal(hzFontSize('S4', '？？？'), 9);
  assert.equal(hzFontSize('S5', '兩個月後'), 13);
  assert.equal(hzFontSize('S1', 'x', { fontSize: 16 }), 16);
  assert.ok(hzFontSize('S1', 'GET OUT OF HERE!', { latin: true }) * 16 * 0.52 <= 90.01);
});

test('hzMaxScale caps the S1 entry scale so the scaled, rotated box stays 4cqw clear of the sign', () => {
  const box = { x0: -10, y0: -6, x1: 10, y1: 6 };
  const sign = { x: 13, y: 87, w: 34, h: 22 };
  assert.equal(hzMaxScale(box, 50, 67, null), 2.6);
  const k = hzMaxScale(box, 50, 67, sign, -7);
  assert.ok(k >= 1 && k < 2.6);
  // at k the rotated box is clear, a bit more is not
  const aabb = (kk) => {
    const r = (-7 * Math.PI) / 180;
    const pts = [[-10, -6], [10, -6], [-10, 6], [10, 6]].map(([x, y]) => [(x * Math.cos(r) - y * Math.sin(r)) * kk, (x * Math.sin(r) + y * Math.cos(r)) * kk]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: 50 + Math.min(...xs), y: 67 + Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  assert.equal(rectsOverlap(aabb(k), sign, 2), false);
  assert.equal(rectsOverlap(aabb(k + 0.1), sign, 2), true);
  // a sign right under the anchor: no room to grow at all
  assert.equal(hzMaxScale(box, 50, 67, { x: 40, y: 75, w: 20, h: 10 }, 0), 1);
});
