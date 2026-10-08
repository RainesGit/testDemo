// events.js — mini events of a day (docs/gameplay-v2.md 5, "小事件"; stage 2). Pure logic, no DOM, no audio.
// The engine (src/engine.js) owns the clock and the queue: it starts an event when the counter is empty, forwards
// tick / press / release to it and applies the effects it returns. main.js turns the cues into lines and pictures.
//
//   EVENTS                         default tuning per event type
//   createEvent(type, { queue, config }) → event
//       event.type, event.durationMs
//       event.tick(dtMs)           → effects (the event ends by itself after durationMs, or earlier when finished)
//       event.press(key, holdMs)   → effects
//       event.release(key, holdMs) → effects (calculator: the release decides)
//       event.state()              → plain snapshot for the UI ({ type, leftMs, count, value, ... })
//       event.done                 true once it has ended (an { kind: 'end' } effect was returned)
//   dueEvent(list, { elapsedMs, timeLeftMs, done }, { lateMs, shutterMs })  index of the event that may start now, or -1
//   calcValue(holdMs, cfg?)        the calculator display while 收 is held (0 → 249 → 250 → 251 → 300, looping)
//   shutterCap(queue, cfg?)        the most the last-5-s shutter mash can add: min(capMax, ceil(capShare × queue)), >= 1
//
// Effects: { kind: 'queue', n } | { kind: 'fury', n } | { kind: 'cue', cue, ... } | { kind: 'end', result }
//
// Event types
//   megaphone   a passer-by with a loudspeaker ("這家店——店員很兇喔——！"); 5 s, any key +1 (cap 20), the clerk shouts back
//   phone       the ex-boss calls (day 5); press any key twice to hang up: fury +20 (+furyFast when within fastMs of the
//               ring: he had not finished his sentence). No penalty for letting it ring out.
//   calculator  a 250-cup order and the calculator slot: hold 收, the display cycles 0 / 249 / 250 / 251 / 300, release on
//               250 = JACKPOT +25; any other number +2 and its own line. Other keys do nothing. Up to 3 tries in 7 s.
//   stamp       "250杯！每杯都要蓋章喔！": 8 s of mashing 收; every press stamps 10 (the last one 240 → 249 → 250);
//               each press +1 (cap 20), all 250 stamped = +25 more. Other keys: feedback only.
//   shutter     the last 5 s (拉鐵捲門): any key +1, cap min(300, 10% of the queue).

export const EVENTS = {
  megaphone: { durationMs: 5000, cap: 20, perPress: 1 },
  phone: { durationMs: 5000, presses: 2, fury: 20, fastMs: 1200, queue: 2 },
  calculator: { durationMs: 7000, seq: [0, 249, 250, 251, 300], stepMs: 180, jackpot: 25, other: 2, tries: 3 },
  stamp: { durationMs: 8000, step: 10, target: 250, cap: 20, finish: 25 },
  shutter: { durationMs: 5000, capShare: 0.1, capMax: 300 },
};

export const EVENT_TYPES = Object.keys(EVENTS);

/** The calculator number shown after holding 收 for holdMs. */
export function calcValue(holdMs, cfg = EVENTS.calculator) {
  const seq = cfg.seq || EVENTS.calculator.seq;
  const i = Math.floor(Math.max(0, Number(holdMs) || 0) / (cfg.stepMs || 180)) % seq.length;
  return seq[i];
}

/** Most the shutter mash can add (at least 1 so the last seconds always respond). */
export function shutterCap(queue, cfg = EVENTS.shutter) {
  return Math.max(1, Math.min(cfg.capMax, Math.ceil(Math.max(0, queue) * cfg.capShare)));
}

/**
 * Which of the day's events (list of { type, atMs }) may start now: due (elapsed >= atMs), not done, not later than
 * lateMs after atMs, and finished before the shutter (timeLeft > its duration + shutterMs). -1 when none.
 */
export function dueEvent(list, { elapsedMs = 0, timeLeftMs = Infinity, done = new Set() } = {}, { lateMs = 15000, shutterMs = 0 } = {}) {
  if (!Array.isArray(list)) return -1;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || done.has(i) || !EVENTS[e.type] || e.type === 'shutter') continue;
    const dur = EVENTS[e.type].durationMs;
    if (elapsedMs >= (e.atMs ?? 0) && elapsedMs <= (e.atMs ?? 0) + lateMs && timeLeftMs > dur + shutterMs) return i;
  }
  return -1;
}

export function createEvent(type, { queue = 0, config = {} } = {}) {
  if (!EVENTS[type]) throw new Error(`createEvent: unknown event type ${type}`);
  const cfg = { ...EVENTS[type], ...(config[type] || {}) };
  let elapsed = 0;
  let done = false;
  let count = 0;      // presses that counted
  let gained = 0;     // queue gained
  let value = null;   // calculator: last released number; stamp: stamps
  let holdFrom = null; // calculator: elapsed when 收 went down
  let tries = 0;
  let jackpot = false;
  let hungUp = false;
  const cap = type === 'shutter' ? shutterCap(queue, cfg) : cfg.cap;
  const durationMs = cfg.durationMs;

  const end = (out, result) => {
    if (done) return out;
    done = true;
    out.push({ kind: 'end', result: { type, count, gained, value, jackpot, hungUp, ...result } });
    return out;
  };
  const gain = (out, n) => {
    if (n > 0) { gained += n; out.push({ kind: 'queue', n }); }
  };

  const ev = {
    type,
    durationMs,
    get done() { return done; },
    state() {
      return {
        type, leftMs: Math.max(0, durationMs - elapsed), elapsedMs: elapsed, count, gained, cap: cap ?? null,
        value: type === 'calculator' && holdFrom != null ? calcValue(elapsed - holdFrom, cfg) : value,
        holding: holdFrom != null, tries, jackpot, hungUp, target: cfg.target ?? null,
      };
    },
    tick(dtMs) {
      const out = [];
      if (done) return out;
      elapsed += Math.max(0, Number(dtMs) || 0);
      if (elapsed >= durationMs) {
        // the calculator: a hold still running at the end is released for the player
        if (type === 'calculator' && holdFrom != null) ev.release('take', elapsed - holdFrom).forEach((e) => out.push(e));
        end(out, { timeout: true });
      }
      return out;
    },
    press(key, holdMs = 0) {
      const out = [];
      if (done) return out;
      if (type === 'megaphone' || type === 'shutter') {
        if (count < cap) {
          count += 1;
          gain(out, cfg.perPress ?? 1);
          out.push({ kind: 'cue', cue: 'hit', n: count, key, capped: count >= cap });
        } else out.push({ kind: 'cue', cue: 'capped', n: count, key });
        return out;
      }
      if (type === 'phone') {
        count += 1;
        out.push({ kind: 'cue', cue: 'press', n: count, key });
        if (count >= cfg.presses) {
          hungUp = true;
          const fast = elapsed <= cfg.fastMs;
          out.push({ kind: 'fury', n: cfg.fury });
          gain(out, cfg.queue);
          out.push({ kind: 'cue', cue: 'hangup', fast });
          end(out, { fast });
        }
        return out;
      }
      if (type === 'calculator') {
        if (key !== 'take') { out.push({ kind: 'cue', cue: 'ignored', key }); return out; }
        if (holdFrom == null) {
          holdFrom = elapsed - Math.max(0, Number(holdMs) || 0);
          out.push({ kind: 'cue', cue: 'hold' });
        }
        return out;
      }
      if (type === 'stamp') {
        if (key !== 'take') { out.push({ kind: 'cue', cue: 'ignored', key }); return out; }
        const before = value ?? 0;
        const next = before >= cfg.target - cfg.step ? (before < cfg.target - 1 ? cfg.target - 1 : cfg.target) : before + cfg.step;
        value = next;
        count += 1;
        if (count <= cfg.cap) gain(out, 1);
        const callout = [50, 100, 200, cfg.target - 1].find((v) => before < v && next >= v) ?? null;
        out.push({ kind: 'cue', cue: 'stamp', stamps: next, n: count, callout });
        if (next >= cfg.target) {
          gain(out, cfg.finish);
          out.push({ kind: 'cue', cue: 'stampDone' });
          end(out, { finished: true });
        }
        return out;
      }
      return out;
    },
    release(key, holdMs) {
      const out = [];
      if (done || type !== 'calculator' || key !== 'take' || holdFrom == null) return out;
      const held = holdMs != null && Number.isFinite(Number(holdMs)) ? Number(holdMs) : elapsed - holdFrom;
      const v = calcValue(held, cfg);
      holdFrom = null;
      tries += 1;
      value = v;
      if (v === 250) {
        jackpot = true;
        gain(out, cfg.jackpot);
        out.push({ kind: 'cue', cue: 'result', value: v, jackpot: true });
        return end(out, { jackpot: true });
      }
      gain(out, cfg.other);
      out.push({ kind: 'cue', cue: 'result', value: v, jackpot: false });
      if (tries >= cfg.tries) end(out, {});
      return out;
    },
  };
  return ev;
}
