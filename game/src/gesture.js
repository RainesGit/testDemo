// gesture.js — gesture input for 《来250杯！》 ("手势" mode, docs/gameplay-v2.md 9). Pure: no DOM, no clock of its own.
// The player's hand acts on the customer directly: 甩 (swipe / flick) = 滚, 连拍 (rapid taps) = 闭嘴, 按住盖章
// (press and hold) = 收. ui.js feeds pointer samples into a recognizer and main.js maps the gestures to engine keys.
//
//   GESTURE                          thresholds (CSS px and ms)
//   classify(samples | strokes, opts) → { kind: 'swipe'|'taps'|'hold'|'tap'|'none', dir: { x, y }, angle, speed, dist,
//                                       holdMs, taps }
//       samples: [{ x, y, t }] of one pointer stroke (down first, up last). strokes: [[...], [...]] several strokes
//       (a tap burst): 'taps' when at least tapsToShut short taps follow each other within burstGapMs.
//       dir: unit vector of the stroke (screen axes, y down); angle in degrees, 0 = right, 90 = up; speed in px/ms.
//   keyOf(kind)                      'swipe' → 'gun', 'taps' → 'shut', 'hold' → 'take', else null
//   swipeCharge(speed)               0 / 1 / 2 (≥ swipeMid / ≥ swipeFast): a fast fling counts as charge level 2
//   holdCharge(ms)                   0 / 1 / 2 at 300 / 800 ms (same as the buttons' hold-to-charge)
//   tapCharge(n)                     taps past the resolving 3rd: 4th = 1, 5th+ = 2
//   towardQueue(swipe)               the fling goes right / up-right (to the queue at the right edge)
//   bowlCount(swipe)                 queue silhouettes knocked over: 0–3 (3 = STRIKE)
//   createRecognizer({ onGesture, opts }) → { down(id, x, y, t), move(id, x, y, t), up(id, x, y, t), cancel(id, t),
//                                            tick(t), reset(), active }
//       streams pointer events and emits, as soon as each gesture is unambiguous:
//         { type: 'swipe', id, x, y, x0, y0, dir, angle, speed, dist, t }   distance > swipeMinPx (or a flick on up)
//         { type: 'swipeMove', id, x, y, px, py, t }                          every move after that (path hit tests)
//         { type: 'swipeEnd', id, t }
//         { type: 'tap', id, x, y, n, t }       pointer up within tapMaxMs and moveTol; n = taps in this burst (1, 2, 3 …)
//         { type: 'burstEnd', n, t }            burstGapMs after the last tap (tick)
//         { type: 'holdStart', id, x, y, t }    held holdMs without moving (tick)
//         { type: 'holdLevel', id, level, t }   300 / 800 ms after the pointer went down (tick)
//         { type: 'holdEnd', id, holdMs, t }    pointer up (or cancel: cancelled = true)
//       Unambiguous and fast: a stroke is decided by distance (swipe), by time (hold) or on pointer up (tap, flick).

export const GESTURE = {
  tapMaxMs: 180,      // up before this and within moveTol = a tap; held longer without moving = a hold
  moveTol: 14,        // px a tap / hold may wander
  swipeMinPx: 40,     // a stroke longer than this is a swipe the moment it gets there
  flickMinPx: 22,     // a shorter stroke still counts as a swipe on up when it was this long and fast
  flickSpeed: 0.45,   // px/ms
  burstGapMs: 350,    // taps closer than this form a burst (3 taps ≈ 600 ms)
  tapsToShut: 3,      // the 3rd tap of a burst resolves 闭嘴
  swipeMid: 0.8,      // px/ms → charge 1
  swipeFast: 1.5,     // px/ms → charge 2 (big landing, mega)
  holdLevels: [300, 800],
  speedWindowMs: 90,  // speed = the faster of the whole stroke and its last speedWindowMs
  queueAngle: [-30, 75], // degrees: the queue is to the right / up-right
  bowl: [0.8, 1.5, 2.4], // px/ms: 1 / 2 / 3 heads knocked
};

const KIND_KEY = { swipe: 'gun', taps: 'shut', hold: 'take' };
export function keyOf(kind) {
  return KIND_KEY[kind] || null;
}

export function swipeCharge(speed, o = GESTURE) {
  return speed >= o.swipeFast ? 2 : speed >= o.swipeMid ? 1 : 0;
}
export function holdCharge(ms, o = GESTURE) {
  return ms >= o.holdLevels[1] ? 2 : ms >= o.holdLevels[0] ? 1 : 0;
}
export function tapCharge(n, o = GESTURE) {
  const extra = n - o.tapsToShut;
  return extra >= 2 ? 2 : extra === 1 ? 1 : 0;
}

export function towardQueue(sw, o = GESTURE) {
  if (!sw || !sw.dir || !(sw.dir.x > 0)) return false;
  const a = Number.isFinite(sw.angle) ? sw.angle : angleOf(sw.dir);
  return a >= o.queueAngle[0] && a <= o.queueAngle[1];
}
export function bowlCount(sw, o = GESTURE) {
  if (!towardQueue(sw, o)) return 0;
  const s = sw.speed || 0;
  return s >= o.bowl[2] ? 3 : s >= o.bowl[1] ? 2 : s >= o.bowl[0] ? 1 : 0;
}

function angleOf(dir) {
  return (Math.atan2(-dir.y, dir.x) * 180) / Math.PI;
}

// stroke geometry: distance, direction and speed of samples [{ x, y, t }]
function strokeInfo(samples, o) {
  const a = samples[0];
  const b = samples[samples.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const dur = Math.max(1, b.t - a.t);
  let speed = dist / dur;
  // the last speedWindowMs: a flick that starts slowly is still a fast flick
  let i = samples.length - 1;
  while (i > 0 && b.t - samples[i - 1].t <= o.speedWindowMs) i--;
  const w = samples[i];
  if (w !== b && b.t > w.t) speed = Math.max(speed, Math.hypot(b.x - w.x, b.y - w.y) / (b.t - w.t));
  // a stroke that wandered: its farthest point decides whether it stayed still
  let far = 0;
  for (const p of samples) far = Math.max(far, Math.hypot(p.x - a.x, p.y - a.y));
  const dir = dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 };
  return { dist, far, dur, speed, dir, angle: dist > 0 ? angleOf(dir) : 0 };
}

function clean(samples) {
  return (Array.isArray(samples) ? samples : []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.t));
}

/** Classifies one stroke ([{ x, y, t }]) or a burst of strokes ([[...], ...]). Pure. */
export function classify(input, opts = {}) {
  const o = { ...GESTURE, ...opts };
  const none = { kind: 'none', dir: { x: 0, y: 0 }, angle: 0, speed: 0, dist: 0, holdMs: 0, taps: 0 };
  if (!Array.isArray(input) || !input.length) return none;
  if (Array.isArray(input[0])) {
    const strokes = input.map(clean).filter((s) => s.length);
    if (!strokes.length) return none;
    if (strokes.length === 1) return classify(strokes[0], opts);
    const each = strokes.map((s) => classify(s, opts));
    // a burst: every stroke a tap, each starting within burstGapMs of the previous one's end
    let taps = 1;
    for (let i = 1; i < strokes.length; i++) {
      const gap = strokes[i][0].t - strokes[i - 1][strokes[i - 1].length - 1].t;
      if (each[i].kind === 'tap' && each[i - 1].kind === 'tap' && gap <= o.burstGapMs) taps += 1;
      else taps = each[i].kind === 'tap' ? 1 : 0;
    }
    const lastOne = each[each.length - 1];
    if (lastOne.kind !== 'tap') return lastOne;
    return { ...lastOne, kind: taps >= o.tapsToShut ? 'taps' : 'tap', taps };
  }
  const s = clean(input);
  if (!s.length) return none;
  const g = strokeInfo(s, o);
  const base = { dir: g.dir, angle: g.angle, speed: g.speed, dist: g.dist, holdMs: g.dur, taps: 0 };
  if (g.dist > o.swipeMinPx || (g.dist >= o.flickMinPx && g.speed >= o.flickSpeed)) return { ...base, kind: 'swipe' };
  if (g.far <= o.moveTol * 2 && g.dur >= o.tapMaxMs) return { ...base, kind: 'hold' };
  if (g.far <= o.swipeMinPx && g.dur < o.tapMaxMs) return { ...base, kind: 'tap', taps: 1 };
  // slow and wandering, neither a swipe nor still: a hold that drifted
  return { ...base, kind: g.dur >= o.tapMaxMs ? 'hold' : 'tap', taps: g.dur >= o.tapMaxMs ? 0 : 1 };
}

/**
 * Streaming recognizer. Feed it pointer events (any number of pointers) and call tick(t) every frame: holds, hold
 * levels and burst ends are decided by time. Every gesture is emitted once through onGesture.
 */
export function createRecognizer({ onGesture = () => {}, opts = {} } = {}) {
  const o = { ...GESTURE, ...opts };
  const strokes = new Map(); // id → { samples, state: 'pending'|'swipe'|'hold', level, t0 }
  let burst = { n: 0, lastT: -Infinity };
  const emit = (e) => { try { onGesture(e); } catch (err) { console.error('[gesture]', err); } };

  function swipeOf(st, id, t) {
    const g = strokeInfo(st.samples, o);
    const a = st.samples[0];
    const b = st.samples[st.samples.length - 1];
    return { type: 'swipe', id, x: b.x, y: b.y, x0: a.x, y0: a.y, dir: g.dir, angle: g.angle, speed: g.speed, dist: g.dist, t };
  }

  return {
    down(id, x, y, t) {
      strokes.set(id, { samples: [{ x, y, t }], state: 'pending', level: 0, t0: t });
    },
    move(id, x, y, t) {
      const st = strokes.get(id);
      if (!st) return;
      const prev = st.samples[st.samples.length - 1];
      st.samples.push({ x, y, t });
      if (st.samples.length > 64) st.samples.splice(1, st.samples.length - 64); // keep the start point
      if (st.state === 'swipe') { emit({ type: 'swipeMove', id, x, y, px: prev.x, py: prev.y, t }); return; }
      if (st.state !== 'pending') return;
      const a = st.samples[0];
      if (Math.hypot(x - a.x, y - a.y) > o.swipeMinPx) {
        st.state = 'swipe';
        const sw = swipeOf(st, id, t);
        emit(sw);
        emit({ type: 'swipeMove', id, x, y, px: a.x, py: a.y, t });
      }
    },
    up(id, x, y, t) {
      const st = strokes.get(id);
      if (!st) return;
      strokes.delete(id);
      if (Number.isFinite(x)) st.samples.push({ x, y, t });
      if (st.state === 'swipe') { emit({ type: 'swipeEnd', id, t }); return; }
      if (st.state === 'hold') { emit({ type: 'holdEnd', id, holdMs: t - st.t0, t }); return; }
      const c = classify(st.samples, o);
      if (c.kind === 'swipe') {
        const sw = swipeOf(st, id, t);
        emit(sw);
        emit({ type: 'swipeMove', id, x: sw.x, y: sw.y, px: sw.x0, py: sw.y0, t });
        emit({ type: 'swipeEnd', id, t });
        return;
      }
      if (c.kind === 'hold') {
        // a hold that tick() did not see start (no frame in between): start and end it now
        emit({ type: 'holdStart', id, x: st.samples[0].x, y: st.samples[0].y, t });
        emit({ type: 'holdEnd', id, holdMs: t - st.t0, t });
        return;
      }
      burst = { n: st.t0 - burst.lastT <= o.burstGapMs ? burst.n + 1 : 1, lastT: t };
      emit({ type: 'tap', id, x: st.samples[0].x, y: st.samples[0].y, n: burst.n, t });
    },
    cancel(id, t) {
      const st = strokes.get(id);
      if (!st) return;
      strokes.delete(id);
      if (st.state === 'hold') emit({ type: 'holdEnd', id, holdMs: t - st.t0, t, cancelled: true });
      else if (st.state === 'swipe') emit({ type: 'swipeEnd', id, t });
    },
    tick(t) {
      for (const [id, st] of strokes) {
        const ms = t - st.t0;
        if (st.state === 'pending' && ms >= o.tapMaxMs) {
          const a = st.samples[0];
          let far = 0;
          for (const p of st.samples) far = Math.max(far, Math.hypot(p.x - a.x, p.y - a.y));
          if (far <= o.moveTol * 2) {
            st.state = 'hold';
            emit({ type: 'holdStart', id, x: a.x, y: a.y, t });
          }
        }
        if (st.state === 'hold') {
          const lvl = holdCharge(ms, o);
          if (lvl > st.level) {
            st.level = lvl;
            emit({ type: 'holdLevel', id, level: lvl, t });
          }
        }
      }
      if (burst.n > 0 && t - burst.lastT > o.burstGapMs && ![...strokes.values()].some((s) => s.state === 'pending')) {
        const n = burst.n;
        burst = { n: 0, lastT: burst.lastT };
        emit({ type: 'burstEnd', n, t });
      }
    },
    reset() {
      strokes.clear();
      burst = { n: 0, lastT: -Infinity };
    },
    get active() { return strokes.size; },
  };
}
