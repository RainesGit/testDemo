// 《来250杯！》/ "250 Cups!" — pure game logic. No DOM, no audio.
// Contract: createGame({ customers, rng, config }) -> { start, tick, press, on, off, state }

export const KEYS = ['gun', 'shut', 'take'];
export const MILESTONES = [10, 100, 1000, 10000, 100000];

export const DEFAULT_CONFIG = {
  durationMs: 90000,      // one round
  auraStart: 60,          // starting aura (0-100)
  auraCorrect: 8,
  auraPerfect: 12,
  auraWrong: -5,
  auraTimeout: -20,
  furyPerCustomer: 6,
  furyCorrect: 4,
  rageMs: 8000,
  patienceStartMs: 3000,  // patience at t=0
  patienceEndMs: 1200,    // patience at t=duration
  perfectMs: 600,         // reaction faster than this = perfect
  chargeMidMs: 300,       // hold >= this -> charge 1
  chargeHighMs: 800,      // hold > this -> charge 2
  chargeBonus: [0, 1, 3],
  bonus250: 10,
  gapMs: 250,             // pause between customers (for animation); 0 = instant
  altChance: 0.35,        // chance to use customer.alt instead of reply
  wrongQueueDelta: 1,     // a wrong curse still counts, just less
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createGame({ customers, rng = Math.random, config = {} } = {}) {
  if (!Array.isArray(customers) || customers.length === 0) {
    throw new Error('createGame: customers must be a non-empty array');
  }
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const handlers = new Map();
  let s; // internal mutable state
  let pool = [];
  let lastStyle = null;

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
      stats: { served: 0, cursed: 0, polite: 0, perfect: 0 },
      milestonesHit: [],
      best: { id: null, score: -Infinity },
    };
  }
  s = fresh();

  function patienceFor(elapsedMs) {
    const f = clamp(elapsedMs / cfg.durationMs, 0, 1);
    return Math.round(cfg.patienceStartMs + (cfg.patienceEndMs - cfg.patienceStartMs) * f);
  }

  function pickCustomer() {
    if (pool.length === 0) pool = customers.slice();
    let candidates = pool.filter(c => c.style !== lastStyle);
    if (candidates.length === 0) {
      // remaining pool only has lastStyle: look in full roster before giving up
      candidates = customers.filter(c => c.style !== lastStyle);
      if (candidates.length === 0) candidates = pool;
    }
    const c = candidates[Math.floor(rng() * candidates.length) % candidates.length];
    const i = pool.indexOf(c);
    if (i >= 0) pool.splice(i, 1);
    lastStyle = c.style;
    return c;
  }

  function spawn() {
    const customer = pickCustomer();
    const max = patienceFor(s.elapsedMs);
    s.current = { customer, patienceMs: max, patienceMaxMs: max };
    s.gapLeftMs = 0;
    emit('arrive', { customer });
    addFury(cfg.furyPerCustomer);
  }

  function scheduleNext() {
    s.current = null;
    if (s.phase !== 'playing') return;
    if (cfg.gapMs <= 0) spawn();
    else s.gapLeftMs = cfg.gapMs;
  }

  function addFury(n) {
    if (s.phase !== 'playing') return;
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
    // the waiting customer gets a fresh patience window
    if (s.current) {
      const max = patienceFor(s.elapsedMs);
      s.current.patienceMs = max;
      s.current.patienceMaxMs = max;
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
      queue: s.queue,
      aura: s.aura,
      fury: s.fury,
      combo: s.combo,
      maxCombo: s.maxCombo,
      score: s.score,
      rageLeftMs: s.rageLeftMs,
      current: c ? Object.freeze({ customer: c.customer, patienceMs: c.patienceMs, patienceMaxMs: c.patienceMaxMs }) : null,
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

    start() {
      s = fresh();
      pool = customers.slice();
      lastStyle = null;
      s.phase = 'playing';
      emit('start', {});
      spawn();
    },

    tick(dtMs) {
      if (s.phase !== 'playing' && s.phase !== 'rage') return;
      const dt = Math.max(0, Number(dtMs) || 0);
      s.elapsedMs += dt;
      s.timeLeftMs = Math.max(0, s.timeLeftMs - dt);
      if (s.timeLeftMs <= 0) { finish(); return; }

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

      s.current.patienceMs -= dt;
      if (s.current.patienceMs <= 0) {
        const customer = s.current.customer;
        s.stats.polite += 1;
        s.combo = 0;
        s.current = null;
        emit('polite', { customer });
        addAura(cfg.auraTimeout);
        if (s.phase === 'playing') scheduleNext();
      }
    },

    press(key, holdMs = 0) {
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

      const { customer, patienceMs, patienceMaxMs } = s.current;
      const reactionMs = patienceMaxMs - patienceMs;
      const correct = key === customer.key;
      const perfect = correct && reactionMs < cfg.perfectMs;
      const charge = chargeOf(Math.max(0, Number(holdMs) || 0));
      const line = customer.alt && rng() < cfg.altChance ? customer.alt : customer.reply;

      let queueDelta;
      let scoreDelta;
      if (correct) {
        const is250 = customer.style === '250' || customer.cups === 250;
        queueDelta = 1 + Math.floor(s.combo / 5) + cfg.chargeBonus[charge] + (is250 ? cfg.bonus250 : 0);
        bumpCombo();
        scoreDelta = queueDelta * 100 + (perfect ? 50 : 0) + s.combo * 10;
      } else {
        queueDelta = cfg.wrongQueueDelta;
        scoreDelta = 20;
      }

      s.score += scoreDelta;
      s.stats.served += 1;
      s.stats.cursed += 1;
      if (perfect) s.stats.perfect += 1;
      if (scoreDelta > s.best.score) s.best = { id: customer.id ?? null, score: scoreDelta };
      s.current = null;

      const payload = { customer, key, correct, perfect, charge, queueDelta, scoreDelta, line, reactionMs };
      emit('resolve', payload);
      addQueue(queueDelta);
      if (correct) addAura(perfect ? cfg.auraPerfect : cfg.auraCorrect);
      else addAura(cfg.auraWrong);
      if (s.phase === 'over') return payload;

      if (correct) addFury(cfg.furyCorrect);
      if (s.phase === 'playing') scheduleNext();
      // if rage started, next customer arrives after rage ends
      return payload;
    },
  };

  return game;
}
