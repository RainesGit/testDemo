// 《来250杯！》/ "250 Cups!" — pure game logic. No DOM, no audio.
// Contract: createGame({ customers, rng, config }) ->
//   { start, tick, press, charge, speechDone, delayNext, pause, resume, bonus, on, off, state, config }
//
// Per-customer timeline (docs/first-minute-spec.md 4.1):
//   arrive (current.speaking = true) → the customer talks, no timing yet → speechDone() or the speakMaxMs
//   fallback → ready (the answer window W starts here, "t0") → press / timeout → landing pause → next arrive.
//   A press during speaking (after minAnswerMs) is a cut-in: reactionMs 0, perfect when correct.
//   Landing pause after an answer: landMs (normal) / landBigMs (curse, 250, charge 2, two-step finale) /
//   landWrongMs (wrong key) / landPoliteMs (timeout). main.js may lengthen it with delayNext(ms).
//
// Events: start, arrive {customer}, ready {customer, patienceMs, step}, step {customer, step, key, cutIn, reactionMs},
//   resolve {customer, key, correct, perfect, charge, queueDelta, scoreDelta, line, reactionMs, cutIn, land, steps},
//   polite {customer, free}, charge {level, queueDelta, customer}, bonus {queueDelta}, rageStart, rageHit {queueDelta, key},
//   rageEnd, milestone {level}, over {summary}

export const KEYS = ['gun', 'shut', 'take'];
export const MILESTONES = [10, 100, 1000, 10000, 100000];

export const DEFAULT_CONFIG = {
  durationMs: 90000,      // one round
  auraStart: 60,          // starting aura (0-100)
  auraCorrect: 8,
  auraPerfect: 12,
  auraWrong: 0,           // a wrong curse only earns less; it never costs aura
  auraTimeout: -20,
  timeoutCostsAura: true, // false on day 1: a timeout plays the polite scene but never costs aura
  furyEnabled: true,      // false on days 1-2: fury never fills, no rage
  furyPerCustomer: 6,
  furyCorrect: 4,
  rageMs: 8000,
  // talking phase (4.1 steps 1-4)
  speakMaxMs: 1880,       // fallback: arrive + this → ready even if speechDone() never comes; <= 0 = no talking phase
  stepSpeakMs: 3800,      // fallback for the second step of a two-step customer (clerk reply + customer line)
  minAnswerMs: 280,       // presses within this long after arrive are ignored (the sign is not up yet)
  // answer window W, measured from t0 (ready)
  windowStartMs: 2400,    // W at the start of the round
  windowEndMs: 2400,      // W at the end of the round (linear in between)
  introMs: 10000,         // customers arriving in the first introMs ...
  introBonusMs: 300,      // ... get this much extra
  comboTightenAt: 30,     // combo >= this → W - comboTightenMs
  comboTightenMs: 100,
  windowFloorMs: 1000,
  perfectMs: 600,         // reaction (from t0) faster than this = perfect
  // landing pause before the next customer
  landMs: 650,
  landBigMs: 1100,
  landWrongMs: 550,
  landPoliteMs: 1600,
  landStepExtraMs: 300,   // the two-step "original customer" finale lands L+ + this
  // charge
  chargeMidMs: 300,       // hold >= this -> charge 1
  chargeHighMs: 800,      // hold > this -> charge 2
  chargeBonus: [0, 1, 3],
  chargeWindowMs: 1000,   // charge(level) upgrades a correct answer resolved within this window
  firstTimeoutFree: true, // the first timeout of a round plays the polite scene but costs no aura
  bonus250: 10,
  altChance: 0.35,        // chance to use customer.alt instead of reply
  wrongQueueDelta: 1,     // a wrong curse still counts, just less
  // customer order
  fixedOrder: null,       // [id, ...] the first customers of the round, in this order (day 1: [41, 46, 12])
  keyWeights: null,       // { gun, shut, take } weighted draw by answer key (day 1: .45 / .25 / .30)
  keyRunMax: 2,           // with keyWeights: the same key never comes more than this many times in a row
  special: null,          // { customer, atMs }: one extra customer (e.g. the two-step original) once per round;
                          // never spawned in rage or when their arrival would start rage (deferred until it ends)
};

// Old key names (one version): patienceStartMs/EndMs → windowStartMs/EndMs; gapMs → every land*;
// introPatienceMs (a fixed intro patience) → introBonusMs = introPatienceMs - windowStartMs.
function resolveConfig(config) {
  const c = { ...config };
  if (c.patienceStartMs != null && c.windowStartMs == null) c.windowStartMs = c.patienceStartMs;
  if (c.patienceEndMs != null && c.windowEndMs == null) c.windowEndMs = c.patienceEndMs;
  if (c.gapMs != null) {
    for (const k of ['landMs', 'landBigMs', 'landWrongMs', 'landPoliteMs']) if (c[k] == null) c[k] = c.gapMs;
    if (c.landStepExtraMs == null) c.landStepExtraMs = 0;
  }
  const cfg = { ...DEFAULT_CONFIG, ...c };
  if (c.introPatienceMs != null && c.introBonusMs == null) cfg.introBonusMs = c.introPatienceMs - cfg.windowStartMs;
  return cfg;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const keyOf = (c) => (Array.isArray(c.steps) && c.steps.length ? c.steps[0] : c.key);

export function createGame({ customers, rng = Math.random, config = {} } = {}) {
  if (!Array.isArray(customers) || customers.length === 0) {
    throw new Error('createGame: customers must be a non-empty array');
  }
  const cfg = resolveConfig(config);
  const handlers = new Map();
  let s; // internal mutable state
  let pool = [];
  let lastStyle = null;
  let runKey = null;
  let runLen = 0;

  function emit(name, payload = {}) {
    const list = handlers.get(name);
    if (!list) return;
    for (const h of [...list]) h(payload);
  }

  function fresh() {
    return {
      phase: 'idle',
      timeLeftMs: cfg.durationMs,
      elapsedMs: 0,
      queue: 0,
      aura: clamp(cfg.auraStart, 0, 100),
      fury: 0,
      combo: 0,
      maxCombo: 0,
      score: 0,
      current: null,
      rageLeftMs: 0,
      gapLeftMs: 0,
      landStartMs: 0,
      stats: { served: 0, cursed: 0, polite: 0, perfect: 0 },
      milestonesHit: [],
      best: { id: null, score: -Infinity },
      paused: false,
      timeouts: 0,
      arrivals: 0,
      fixedIdx: 0,
      specialDone: false,
      lastHit: null, // { customer, correct, charge, scoreDelta, atMs } of the last resolved answer
    };
  }
  s = fresh();

  function patienceFor(elapsedMs, combo = 0) {
    const f = clamp(elapsedMs / cfg.durationMs, 0, 1);
    let w = cfg.windowStartMs + (cfg.windowEndMs - cfg.windowStartMs) * f;
    if (elapsedMs < cfg.introMs) w += cfg.introBonusMs;
    if (combo >= cfg.comboTightenAt) w -= cfg.comboTightenMs;
    return Math.round(Math.max(cfg.windowFloorMs, w));
  }

  function take(c) {
    const i = pool.indexOf(c);
    if (i >= 0) pool.splice(i, 1);
    lastStyle = c.style;
    const k = keyOf(c);
    if (k === runKey) runLen += 1;
    else { runKey = k; runLen = 1; }
    return c;
  }

  function weightedKey(keys) {
    const w = cfg.keyWeights;
    const total = keys.reduce((t, k) => t + Math.max(0, w[k] ?? 0), 0);
    if (total <= 0) return keys[Math.floor(rng() * keys.length) % keys.length];
    let r = rng() * total;
    for (const k of keys) {
      r -= Math.max(0, w[k] ?? 0);
      if (r < 0) return k;
    }
    return keys[keys.length - 1];
  }

  // true when the next arrival would be in rage or would start it (spawn adds furyPerCustomer)
  function rageAhead() {
    if (s.phase === 'rage') return true;
    return !!cfg.furyEnabled && s.phase === 'playing' && s.fury + cfg.furyPerCustomer >= 100;
  }

  function pickCustomer() {
    // 1. fixed opening order
    if (Array.isArray(cfg.fixedOrder) && s.fixedIdx < cfg.fixedOrder.length) {
      const want = cfg.fixedOrder[s.fixedIdx++];
      const c = customers.find((x) => x === want || x.id === want);
      if (c) return take(c);
    }
    // 2. the once-per-round special customer. Never in rage, and deferred while their own arrival would start it
    //    (during rage every press is a rage hit, so the two-step scene would be lost): a normal customer comes
    //    instead, rage runs, and the special one is the first pick once it is over (fury is back at 0).
    if (cfg.special && cfg.special.customer && !s.specialDone && s.elapsedMs >= (cfg.special.atMs ?? 0) && !rageAhead()) {
      s.specialDone = true;
      return take(cfg.special.customer);
    }
    // 3. weighted by answer key (each key keeps its own no-repeat pool, so the mix follows the weights)
    if (pool.length === 0) pool = customers.slice();
    if (cfg.keyWeights) {
      const banned = runLen >= cfg.keyRunMax ? runKey : null;
      const fits = (c, k) => keyOf(c) === k && c.style !== lastStyle;
      const keys = KEYS.filter(k => k !== banned && customers.some(c => fits(c, k)));
      if (keys.length) {
        const k = weightedKey(keys);
        let cands = pool.filter(c => fits(c, k));
        // the style rule only picks among the unused ones: a used customer comes back only when every
        // customer of this key has been seen (no repeats within a round while the pool lasts)
        if (!cands.length) cands = pool.filter(c => keyOf(c) === k);
        if (!cands.length) {
          // this key's share of the pool is used up: put that key's customers back
          for (const c of customers) if (keyOf(c) === k && !pool.includes(c)) pool.push(c);
          cands = pool.filter(c => fits(c, k));
        }
        if (cands.length) return take(cands[Math.floor(rng() * cands.length) % cands.length]);
      }
    }
    // 4. remaining pool, never the same style twice in a row
    let candidates = pool.filter(c => c.style !== lastStyle);
    if (candidates.length === 0) {
      // remaining pool only has lastStyle: look in full roster before giving up
      candidates = customers.filter(c => c.style !== lastStyle);
      if (candidates.length === 0) candidates = pool;
    }
    const c = candidates[Math.floor(rng() * candidates.length) % candidates.length];
    return take(c);
  }

  function spawn() {
    const customer = pickCustomer();
    const max = patienceFor(s.elapsedMs, s.combo);
    s.current = { customer, speaking: true, speakLeftMs: cfg.speakMaxMs, sinceArriveMs: 0, step: 0, patienceMs: max, patienceMaxMs: max };
    s.gapLeftMs = 0;
    s.arrivals += 1;
    emit('arrive', { customer });
    addFury(cfg.furyPerCustomer);
    if (cfg.speakMaxMs <= 0) speechDone();
  }

  function speechDone() {
    const c = s.current;
    if (!c || !c.speaking) return false;
    if (s.phase !== 'playing' && s.phase !== 'rage') return false;
    c.speaking = false;
    c.speakLeftMs = 0;
    // during rage nobody is timed: 'ready' is emitted when rage ends (endRage)
    if (s.phase === 'playing') emit('ready', { customer: c.customer, patienceMs: c.patienceMs, step: c.step });
    return true;
  }

  function landFor(kind) {
    if (kind === 'big') return cfg.landBigMs;
    if (kind === 'wrong') return cfg.landWrongMs;
    if (kind === 'polite') return cfg.landPoliteMs;
    if (kind === 'step') return cfg.landBigMs + cfg.landStepExtraMs;
    return cfg.landMs;
  }

  function scheduleNext(kind = 'normal') {
    s.current = null;
    if (s.phase !== 'playing') return;
    // keep a longer pause that main.js asked for while handling 'resolve' / 'polite' (delayNext runs inside
    // those handlers, i.e. before this line): never shorten it back to L
    const ms = Math.max(landFor(kind), s.gapLeftMs > 0 ? s.gapLeftMs : 0);
    s.landStartMs = s.elapsedMs;
    if (ms <= 0) spawn();
    else s.gapLeftMs = ms;
  }

  function addFury(n) {
    if (s.phase !== 'playing' || !cfg.furyEnabled) return;
    s.fury = clamp(s.fury + n, 0, 100);
    if (s.fury >= 100) startRage();
  }

  function startRage() {
    s.phase = 'rage';
    s.rageLeftMs = cfg.rageMs;
    emit('rageStart', {});
  }

  function endRage() {
    s.phase = 'playing';
    s.rageLeftMs = 0;
    s.fury = 0;
    emit('rageEnd', {});
    // the waiting customer gets a fresh answer window
    if (s.current) {
      const max = patienceFor(s.elapsedMs, s.combo);
      s.current.patienceMs = max;
      s.current.patienceMaxMs = max;
      if (!s.current.speaking) emit('ready', { customer: s.current.customer, patienceMs: max, step: s.current.step });
    } else if (s.gapLeftMs <= 0) {
      spawn();
    }
  }

  function addAura(n) {
    s.aura = clamp(s.aura + n, 0, 100);
    if (s.aura <= 0) finish();
  }

  function addQueue(n) {
    const before = s.queue;
    s.queue += n;
    for (const level of MILESTONES) {
      if (before < level && s.queue >= level && !s.milestonesHit.includes(level)) {
        s.milestonesHit.push(level);
        emit('milestone', { level });
      }
    }
  }

  function bumpCombo() {
    s.combo += 1;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;
  }

  function chargeOf(holdMs) {
    if (holdMs > cfg.chargeHighMs) return 2;
    if (holdMs >= cfg.chargeMidMs) return 1;
    return 0;
  }

  function finish() {
    if (s.phase === 'over' || s.phase === 'idle') return;
    if (s.phase === 'rage') emit('rageEnd', {});
    s.phase = 'over';
    s.current = null;
    s.rageLeftMs = 0;
    s.gapLeftMs = 0;
    emit('over', {
      summary: {
        queue: s.queue,
        score: s.score,
        maxCombo: s.maxCombo,
        served: s.stats.served,
        cursed: s.stats.cursed,
        polite: s.stats.polite,
        bestLineId: s.best.id,
      },
    });
  }

  function snapshot() {
    const c = s.current;
    return Object.freeze({
      phase: s.phase,
      timeLeftMs: s.timeLeftMs,
      elapsedMs: s.elapsedMs,
      queue: s.queue,
      aura: s.aura,
      fury: s.fury,
      combo: s.combo,
      maxCombo: s.maxCombo,
      score: s.score,
      rageLeftMs: s.rageLeftMs,
      gapLeftMs: s.gapLeftMs,
      paused: s.paused,
      current: c
        ? Object.freeze({
          customer: c.customer, patienceMs: c.patienceMs, patienceMaxMs: c.patienceMaxMs,
          speaking: c.speaking, step: c.step, sinceArriveMs: c.sinceArriveMs,
        })
        : null,
      stats: Object.freeze({ ...s.stats }),
    });
  }

  const game = {
    on(name, handler) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(handler);
      return () => game.off(name, handler);
    },
    off(name, handler) {
      const list = handlers.get(name);
      if (list) {
        const i = list.indexOf(handler);
        if (i >= 0) list.splice(i, 1);
      }
    },
    get state() {
      return snapshot();
    },
    config: Object.freeze({ ...cfg }),
    patienceFor,

    start() {
      s = fresh();
      pool = customers.slice();
      lastStyle = null;
      runKey = null;
      runLen = 0;
      s.phase = 'playing';
      emit('start', {});
      spawn();
    },

    tick(dtMs) {
      if (s.phase !== 'playing' && s.phase !== 'rage') return;
      if (s.paused) return; // paused: neither the round clock nor patience advances
      const dt = Math.max(0, Number(dtMs) || 0);
      s.elapsedMs += dt;
      s.timeLeftMs = Math.max(0, s.timeLeftMs - dt);
      if (s.timeLeftMs <= 0) { finish(); return; }
      if (s.current) s.current.sinceArriveMs += dt;

      if (s.phase === 'rage') {
        s.rageLeftMs -= dt;
        if (s.rageLeftMs <= 0) endRage();
        return; // no timeouts during rage
      }

      if (!s.current) {
        if (s.gapLeftMs > 0) {
          s.gapLeftMs -= dt;
          if (s.gapLeftMs <= 0) spawn();
        } else {
          spawn();
        }
        return;
      }

      if (s.current.speaking) {
        // nobody is timed while the customer is still talking (t0 = speech end)
        s.current.speakLeftMs -= dt;
        if (s.current.speakLeftMs <= 0) speechDone();
        return;
      }

      s.current.patienceMs -= dt;
      if (s.current.patienceMs <= 0) {
        const customer = s.current.customer;
        s.timeouts += 1;
        const firstFree = cfg.firstTimeoutFree && s.timeouts === 1;
        const free = firstFree || !cfg.timeoutCostsAura;
        s.stats.polite += 1;
        s.combo = 0;
        s.current = null;
        emit('polite', { customer, free });
        if (!free) addAura(cfg.auraTimeout);
        if (s.phase === 'playing') scheduleNext('polite');
      }
    },

    press(key, holdMs = 0) {
      if (s.paused) return null;
      if (s.phase === 'rage') {
        bumpCombo();
        const queueDelta = 2 + Math.floor(s.combo / 10);
        s.stats.cursed += 1;
        s.score += queueDelta * 50;
        addQueue(queueDelta);
        emit('rageHit', { queueDelta, key });
        return { rage: true, queueDelta };
      }
      if (s.phase !== 'playing' || !s.current) return null;
      const cur = s.current;
      if (cur.sinceArriveMs < cfg.minAnswerMs) return null;

      const { customer, patienceMs, patienceMaxMs } = cur;
      const cutIn = cur.speaking;
      const reactionMs = cutIn ? 0 : patienceMaxMs - patienceMs;
      const steps = Array.isArray(customer.steps) && customer.steps.length ? customer.steps : null;
      const want = steps ? steps[cur.step] : customer.key;
      const correct = key === want;

      // two-step customer: a correct non-final step keeps them at the counter for the next step
      if (correct && steps && cur.step < steps.length - 1) {
        cur.step += 1;
        cur.speaking = true;
        cur.speakLeftMs = cfg.stepSpeakMs;
        cur.sinceArriveMs = 0;
        const max = patienceFor(s.elapsedMs, s.combo);
        cur.patienceMs = max;
        cur.patienceMaxMs = max;
        s.lastHit = null;
        const payload = { customer, step: cur.step, key, cutIn, reactionMs, correct: true };
        emit('step', payload);
        return payload;
      }

      const perfect = correct && reactionMs < cfg.perfectMs;
      const charge = chargeOf(Math.max(0, Number(holdMs) || 0));
      const line = steps
        ? (customer.reply2 ?? customer.reply)
        : (customer.alt && rng() < cfg.altChance ? customer.alt : customer.reply);
      const is250 = customer.style === '250' || customer.cups === 250;

      let queueDelta;
      let scoreDelta;
      if (correct) {
        queueDelta = 1 + Math.floor(s.combo / 5) + cfg.chargeBonus[charge] + (is250 ? cfg.bonus250 : 0);
        bumpCombo();
        scoreDelta = queueDelta * 100 + (perfect ? 50 : 0) + s.combo * 10;
      } else {
        queueDelta = cfg.wrongQueueDelta;
        scoreDelta = 20;
      }
      let land = 'normal';
      if (!correct) land = 'wrong';
      else if (steps) land = 'step';
      else if (customer.style === 'curse' || is250 || charge === 2) land = 'big';

      s.score += scoreDelta;
      s.stats.served += 1;
      s.stats.cursed += 1;
      if (perfect) s.stats.perfect += 1;
      if (scoreDelta > s.best.score) s.best = { id: customer.id ?? null, score: scoreDelta };
      s.current = null;
      s.lastHit = { customer, correct, charge, scoreDelta, atMs: s.elapsedMs };

      const payload = {
        customer, key, correct, perfect, charge, queueDelta, scoreDelta, line, reactionMs, cutIn, land,
        step: cur.step,
      };
      emit('resolve', payload);
      addQueue(queueDelta);
      if (correct) addAura(perfect ? cfg.auraPerfect : cfg.auraCorrect);
      else addAura(cfg.auraWrong);
      if (s.phase === 'over') return payload;

      if (correct) addFury(cfg.furyCorrect);
      if (s.phase === 'playing') scheduleNext(land);
      // if rage started, next customer arrives after rage ends
      return payload;
    },

    // Hold-to-charge after the fact: the UI resolves on key-down (press(key, 0)) and calls
    // charge(1|2) while the key stays down. Only upgrades the last answer if it was correct and
    // resolved within chargeWindowMs; adds just the difference in chargeBonus to queue and score.
    // Reaching level 2 makes the landing pause a big one (landBigMs from the answer).
    charge(level) {
      if (s.paused || (s.phase !== 'playing' && s.phase !== 'rage')) return null;
      const hit = s.lastHit;
      const lvl = Math.max(0, Math.min(cfg.chargeBonus.length - 1, level | 0));
      if (!hit || !hit.correct || s.elapsedMs - hit.atMs > cfg.chargeWindowMs || lvl <= hit.charge) return null;
      const queueDelta = cfg.chargeBonus[lvl] - cfg.chargeBonus[hit.charge];
      hit.charge = lvl;
      const scoreDelta = queueDelta * 100;
      hit.scoreDelta += scoreDelta;
      s.score += scoreDelta;
      if (hit.scoreDelta > s.best.score) s.best = { id: hit.customer.id ?? null, score: hit.scoreDelta };
      if (lvl >= 2 && !s.current && s.gapLeftMs > 0) {
        s.gapLeftMs = Math.max(s.gapLeftMs, cfg.landBigMs - (s.elapsedMs - s.landStartMs));
      }
      const payload = { level: lvl, queueDelta, customer: hit.customer };
      emit('charge', payload);
      addQueue(queueDelta);
      return payload;
    },

    // t0: the customer finished talking (main.js calls this at min(voice end, signUp + 1600)).
    // Starts the answer window and emits 'ready'. No-op if not talking.
    speechDone,

    // Lengthen the current landing pause to at least ms (main.js: the clerk's punch line + L).
    // Only while nobody is at the counter. Returns true when applied.
    delayNext(ms) {
      if (s.current || s.phase !== 'playing') return false;
      const v = Math.max(0, Number(ms) || 0);
      if (v > s.gapLeftMs) s.gapLeftMs = v;
      return true;
    },

    // Freeze the round (cutscenes): tick() does nothing and press()/charge() are ignored.
    pause() {
      if (s.phase === 'playing' || s.phase === 'rage') s.paused = true;
    },
    resume() {
      s.paused = false;
    },

    // Flat reward outside an answer: queue +n, score +100n.
    bonus(n) {
      const queueDelta = Math.max(0, Math.floor(Number(n) || 0));
      if (!queueDelta || (s.phase !== 'playing' && s.phase !== 'rage')) return null;
      s.score += queueDelta * 100;
      emit('bonus', { queueDelta });
      addQueue(queueDelta);
      return { queueDelta };
    },
  };

  return game;
}
