// 《来250杯！》/ "250 Cups!" — pure game logic. No DOM, no audio.
// Contract: createGame({ customers, rng, config }) ->
//   { start, tick, press, jab, summon, charge, speechDone, delayNext, pause, resume, bonus, on, off, state, config,
//     patienceFor, speedMultFor }
//
// Per-customer timeline (docs/first-minute-spec.md 4.1):
//   arrive (current.speaking = true) → the customer talks, no timing yet → speechDone() or the speakMaxMs
//   fallback → ready (the answer window W starts here, "t0") → press / timeout → landing pause → next arrive.
//   A press during speaking (after minAnswerMs) is a cut-in: reactionMs 0, perfect when correct.
//   Landing pause after an answer: landMs (normal) / landBigMs (curse, 250, big orders, charge 2, two-step finale) /
//   landWrongMs (wrong key) / landPoliteMs (timeout). main.js may lengthen it with delayNext(ms).
//   A press that comes at most bufferMs before minAnswerMs is kept and answers at minAnswerMs (not dropped).
//
// Gameplay v2 stage 1 (docs/gameplay-v2.md 3–4):
//   - jab(key): a press while the answered customer flies (landing after an answer). The first jabPaidMax jabs after
//     a correct answer add jabQueueDelta and furyJab each; later ones, and jabs after a wrong key, are feedback only
//     (like the wrong key itself: no fury, so mashing never out-earns reading the sign). summon(): "下一位" — the next
//     customer arrives at once (main.js calls it only after the clerk's punch line has ended).
//   - Speed multiplier on correct answers: cut-in ×2, < 600 ms after t0 ×1.5, < 1200 ms ×1.2, else ×1, applied to
//     (1 + combo bonus) and rounded up; combo bonus = floor(min(combo, comboCap) / 5). A cut-in is a press while the
//     customer talks (from cutInFromMs after arrive); a press before their line starts (the sign still rising) is an
//     early press: ×1, not perfect. The charge bonus (reworked in stage 3) and big orders are flat on top: 100 / 251 /
//     520 cups +1 / +2 / +5, 250 cups bonus250; big orders land big.
//   - Wrong key: +wrongQueueDelta, combo frozen (no reset, no increment), no fury, no aura change.
//   - Fury is earned by skill (cut-in / perfect / correct / paid jab); arrivals add furyPerCustomer (0 by default).
//     At 100 the bar is full ('furyFull') and the player's next press starts rage (never while a two-step
//     customer is at the counter; a waiting customer steps aside and comes back after rage).
//   - Rage (rageMs): a silent head pops every rageSpawnMs; a press sends the current head flying (+rageHitDelta,
//     +rageMatchDelta when the key matches its sign), one hit per head. The rage combo is separate from the
//     normal combo. After rage the counter stays empty for rageEndMs (pause + the clerk's polite close).
//   - Too slow: the first timeout is free, then aura (swagger) −15. Aura 0 = forced politeness for forcedMs
//     (queue gains × forcedQueueMult, rounded up; main.js plays service lines), then aura auraAfterForced.
//     The day only ends by its clock.
//
// Events: start, arrive {customer}, ready {customer, patienceMs, step}, step {customer, step, key, cutIn, reactionMs},
//   resolve {customer, key, correct, perfect, charge, queueDelta, scoreDelta, line, reactionMs, cutIn, early, land, step, mult,
//   forced, big}, polite {customer, free}, charge {level, queueDelta, customer}, bonus {queueDelta},
//   jab {key, n, queueDelta, customer}, summon {}, furyFull {}, rageStart {requeued}, rageHead {customer, n},
//   rageHit {queueDelta, key, customer, match, n}, rageMiss {key}, rageEnd {hits, queueDelta},
//   forcedStart {ms}, forcedEnd {aura}, milestone {level}, over {summary}

export const KEYS = ['gun', 'shut', 'take'];
export const MILESTONES = [10, 100, 1000, 10000, 100000];

export const DEFAULT_CONFIG = {
  durationMs: 90000,      // one round
  auraStart: 70,          // starting aura (swagger, 0-100)
  auraCorrect: 2,
  auraPerfect: 4,
  auraWrong: 0,           // a wrong curse only earns less; it never costs aura
  auraTimeout: -15,
  timeoutCostsAura: true, // false on day 1: a timeout plays the polite scene but never costs aura
  forcedMs: 10000,        // aura 0 → forced politeness this long (never an early close)
  forcedQueueMult: 0.5,   // queue gains during forced politeness (rounded up)
  auraAfterForced: 40,    // aura when forced politeness ends
  furyEnabled: true,      // false on days 1-2: fury never fills, no rage
  furyPerCustomer: 0,     // fury on arrival (v2: 0, fury is earned by skill)
  furyCorrect: 6,
  furyPerfect: 10,
  furyCutIn: 14,
  furyJab: 2,             // per paid jab
  furyMult: 1,            // scales every fury gain until furyMultUntilMs (a day may speed up its first rage)
  furyMultUntilMs: Infinity,
  rageMs: 6000,
  rageSpawnMs: 300,       // a silent head pops this often during rage (one hit each: speed is capped by it)
  rageHitDelta: 1,        // any key
  rageMatchDelta: 2,      // the key matches the head's sign
  rageEndMs: 1400,        // empty counter after rage: 500 ms pause + the clerk's polite close (main may lengthen)
  // jab / next (gameplay-v2 3)
  jabPaidMax: 2,          // the first N jabs of a landing count
  jabQueueDelta: 1,
  bufferMs: 150,          // a press this close before minAnswerMs is kept and answers at minAnswerMs
  // speed multiplier on correct answers: cut-in, then [ms after t0, mult] steps, else 1
  speedCutIn: 2,
  speedSteps: [[600, 1.5], [1200, 1.2]],
  comboCap: 50,           // combo bonus = floor(min(combo, comboCap) / comboStep)
  comboStep: 5,
  // talking phase (4.1 steps 1-4)
  speakMaxMs: 1880,       // fallback: arrive + this → ready even if speechDone() never comes; <= 0 = no talking phase
  stepSpeakMs: 3800,      // fallback for the second step of a two-step customer (clerk reply + customer line)
  minAnswerMs: 280,       // presses within this long after arrive are ignored (the sign is not up yet)
  cutInFromMs: 0,         // a press while talking counts as a cut-in only from this long after arrive (the customer's
                          // line has started; days.js: sign up). Earlier = an early press: no speed bonus, not perfect
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
  bonus250: 25,           // 250 cups
  bigOrders: { 100: 1, 251: 2, 520: 5 }, // other big orders by cups (flat, after the speed multiplier)
  altChance: 0.35,        // chance to use customer.alt instead of reply
  wrongQueueDelta: 1,     // a wrong curse still counts, just less
  // customer order
  fixedOrder: null,       // [id, ...] the first customers of the round, in this order (day 1: [41, 46, 12])
  keyWeights: null,       // { gun, shut, take } weighted draw by answer key (day 1: .45 / .25 / .30)
  keyRunMax: 2,           // with keyWeights: the same key never comes more than this many times in a row
  special: null,          // { customer, atMs }: one extra customer (e.g. the two-step original) once per round;
                          // never spawned in rage or while the fury bar is full (deferred until rage is over)
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

const isTwoStep = (c) => Array.isArray(c?.steps) && c.steps.length > 0;

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
      furyFull: false,
      combo: 0,
      maxCombo: 0,
      score: 0,
      current: null,
      rageLeftMs: 0,
      rageSpawnLeftMs: 0,
      rageHead: null,   // { customer, hit, n } the head at the counter during rage
      rageCombo: 0,     // hits in this rage (separate from the normal combo)
      rageQueue: 0,
      rageHeads: 0,
      requeue: null,    // the customer who stepped aside when rage started (comes back first)
      gapLeftMs: 0,
      landStartMs: 0,
      landKind: null,   // 'answer' | 'polite' | 'rage' | null: what the current landing pause follows
      jabs: 0,          // jabs in this landing
      buffered: null,   // { key, holdMs } a press kept until minAnswerMs
      forcedLeftMs: 0,  // forced politeness left
      stats: { served: 0, cursed: 0, polite: 0, perfect: 0, jabs: 0, rageHits: 0, rages: 0, forced: 0 },
      milestonesHit: [],
      best: { id: null, score: -Infinity },
      paused: false,
      timeouts: 0,
      arrivals: 0,
      fixedIdx: 0,
      specialDone: false,
      lastHit: null, // { customer, correct, charge, scoreDelta, atMs, base, mult, flat } of the last resolved answer
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

  /** Speed multiplier of a correct answer: cut-in, then the speedSteps by reaction from t0, else 1. */
  function speedMultFor(cutIn, reactionMs = 0) {
    if (cutIn) return cfg.speedCutIn;
    for (const [ms, m] of cfg.speedSteps || []) if (reactionMs < ms) return m;
    return 1;
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

  // true while rage runs or is waiting for the player's next press (the fury bar is full)
  function rageAhead() {
    if (s.phase === 'rage') return true;
    return !!cfg.furyEnabled && s.phase === 'playing' && (s.furyFull || s.fury + cfg.furyPerCustomer * cfg.furyMult >= 100);
  }

  function pickCustomer() {
    // 0. the customer who stepped aside for rage
    if (s.requeue) {
      const c = s.requeue;
      s.requeue = null;
      return take(c);
    }
    // 1. fixed opening order
    if (Array.isArray(cfg.fixedOrder) && s.fixedIdx < cfg.fixedOrder.length) {
      const want = cfg.fixedOrder[s.fixedIdx++];
      const c = customers.find((x) => x === want || x.id === want);
      if (c) return take(c);
    }
    // 2. the once-per-round special customer. Never in rage, and deferred while the fury bar is full (the next
    //    press would start rage and the two-step scene would be lost): a normal customer comes instead, rage runs,
    //    and the special one is the first pick once it is over (fury is back at 0).
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
    s.landKind = null;
    s.jabs = 0;
    s.buffered = null;
    s.arrivals += 1;
    emit('arrive', { customer });
    addFury(cfg.furyPerCustomer);
    if (cfg.speakMaxMs <= 0) speechDone();
  }

  function speechDone() {
    const c = s.current;
    if (!c || !c.speaking) return false;
    if (s.phase !== 'playing') return false;
    c.speaking = false;
    c.speakLeftMs = 0;
    emit('ready', { customer: c.customer, patienceMs: c.patienceMs, step: c.step });
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
    s.buffered = null;
    if (s.phase !== 'playing') return;
    // keep a longer pause that main.js asked for while handling 'resolve' / 'polite' (delayNext runs inside
    // those handlers, i.e. before this line): never shorten it back to L
    const ms = Math.max(landFor(kind), s.gapLeftMs > 0 ? s.gapLeftMs : 0);
    s.landStartMs = s.elapsedMs;
    s.landKind = kind === 'polite' ? 'polite' : 'answer';
    s.jabs = 0;
    if (ms <= 0) spawn();
    else s.gapLeftMs = ms;
  }

  function addFury(n) {
    if (s.phase !== 'playing' || !cfg.furyEnabled || !(n > 0)) return;
    if (s.furyFull) return;
    const mult = s.elapsedMs < cfg.furyMultUntilMs ? cfg.furyMult : 1;
    s.fury = clamp(s.fury + n * mult, 0, 100);
    if (s.fury >= 100) {
      s.furyFull = true;
      emit('furyFull', {});
    }
  }

  // the player's press on a full fury bar: the clerk stops holding back
  function startRage() {
    let requeued = null;
    if (s.current) {
      requeued = s.current.customer;
      s.requeue = requeued; // steps aside, comes back first after rage
      s.current = null;
    }
    s.phase = 'rage';
    s.furyFull = false;
    s.rageLeftMs = cfg.rageMs;
    s.rageCombo = 0;
    s.rageQueue = 0;
    s.rageHeads = 0;
    s.rageHead = null;
    s.gapLeftMs = 0;
    s.buffered = null;
    s.landKind = null;
    s.stats.rages += 1;
    emit('rageStart', { requeued });
    spawnHead();
    s.rageSpawnLeftMs = cfg.rageSpawnMs;
  }

  function spawnHead() {
    const cands = customers.filter((c) => !isTwoStep(c) && c !== s.rageHead?.customer);
    const list = cands.length ? cands : customers;
    const customer = list[Math.floor(rng() * list.length) % list.length];
    s.rageHeads += 1;
    s.rageHead = { customer, hit: false, n: s.rageHeads };
    emit('rageHead', { customer, n: s.rageHeads });
  }

  function endRage() {
    s.phase = 'playing';
    s.rageLeftMs = 0;
    s.fury = 0;
    s.furyFull = false;
    s.rageHead = null;
    s.current = null;
    s.landStartMs = s.elapsedMs;
    s.landKind = 'rage';
    s.jabs = 0;
    s.gapLeftMs = cfg.rageEndMs; // main.js lengthens it to the polite close in the 'rageEnd' handler
    emit('rageEnd', { hits: s.rageCombo, queueDelta: s.rageQueue });
    if (s.phase === 'playing' && !s.current && s.gapLeftMs <= 0) spawn();
  }

  function addAura(n) {
    if (s.forcedLeftMs > 0) return; // stays at 0 until forced politeness is over
    s.aura = clamp(s.aura + n, 0, 100);
    if (s.aura <= 0 && s.phase === 'playing') {
      s.forcedLeftMs = cfg.forcedMs;
      s.stats.forced += 1;
      emit('forcedStart', { ms: cfg.forcedMs });
    }
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

  const forcedScale = (n) => (s.forcedLeftMs > 0 ? Math.ceil(n * cfg.forcedQueueMult) : n);

  // queue for a correct answer: ceil((1 + combo bonus) × speed) + charge bonus + big-order bonus
  function answerDelta(base, charge, mult, flat) {
    return forcedScale(Math.ceil(base * mult - 1e-9) + cfg.chargeBonus[charge] + flat);
  }

  function bigBonus(customer) {
    if (customer.cups === 250) return cfg.bonus250;
    return (cfg.bigOrders && cfg.bigOrders[customer.cups]) || 0;
  }

  function finish() {
    if (s.phase === 'over' || s.phase === 'idle') return;
    if (s.phase === 'rage') emit('rageEnd', { hits: s.rageCombo, queueDelta: s.rageQueue });
    s.phase = 'over';
    s.current = null;
    s.rageLeftMs = 0;
    s.rageHead = null;
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
    const h = s.rageHead;
    return Object.freeze({
      phase: s.phase,
      timeLeftMs: s.timeLeftMs,
      elapsedMs: s.elapsedMs,
      queue: s.queue,
      aura: s.aura,
      fury: s.fury,
      furyFull: s.furyFull,
      combo: s.combo,
      maxCombo: s.maxCombo,
      score: s.score,
      rageLeftMs: s.rageLeftMs,
      rageCombo: s.rageCombo,
      rageHead: h ? Object.freeze({ customer: h.customer, hit: h.hit, n: h.n }) : null,
      gapLeftMs: s.gapLeftMs,
      landKind: s.landKind,
      jabs: s.jabs,
      forced: s.forcedLeftMs > 0,
      forcedLeftMs: s.forcedLeftMs,
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

  function answer(key, holdMs) {
    const cur = s.current;
    const { customer, patienceMs, patienceMaxMs } = cur;
    const early = cur.speaking && cur.sinceArriveMs < cfg.cutInFromMs;
    const cutIn = cur.speaking && !early;
    const reactionMs = cur.speaking ? 0 : patienceMaxMs - patienceMs;
    const steps = isTwoStep(customer) ? customer.steps : null;
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

    const perfect = correct && !early && reactionMs < cfg.perfectMs;
    const charge = chargeOf(Math.max(0, Number(holdMs) || 0));
    const line = steps
      ? (customer.reply2 ?? customer.reply)
      : (customer.alt && rng() < cfg.altChance ? customer.alt : customer.reply);
    const is250 = customer.style === '250' || customer.cups === 250;
    const flat = bigBonus(customer);
    const forced = s.forcedLeftMs > 0;

    let queueDelta;
    let scoreDelta;
    let mult = 1;
    let base = 0;
    if (correct) {
      mult = early ? 1 : speedMultFor(cutIn, reactionMs);
      base = 1 + Math.floor(Math.min(s.combo, cfg.comboCap) / cfg.comboStep);
      queueDelta = answerDelta(base, charge, mult, flat);
      bumpCombo();
      scoreDelta = queueDelta * 100 + (perfect ? 50 : 0) + Math.min(s.combo, cfg.comboCap) * 10;
    } else {
      // wrong key: still counts, the combo is frozen (no reset, no increment)
      queueDelta = forcedScale(cfg.wrongQueueDelta);
      scoreDelta = 20;
    }
    let land = 'normal';
    if (!correct) land = 'wrong';
    else if (steps) land = 'step';
    else if (customer.style === 'curse' || is250 || flat > 0 || charge === 2) land = 'big';

    s.score += scoreDelta;
    s.stats.served += 1;
    s.stats.cursed += 1;
    if (perfect) s.stats.perfect += 1;
    if (scoreDelta > s.best.score) s.best = { id: customer.id ?? null, score: scoreDelta };
    s.current = null;
    s.buffered = null;
    s.lastHit = { customer, correct, charge, scoreDelta, atMs: s.elapsedMs, base, mult, flat, queueDelta };

    const payload = {
      customer, key, correct, perfect, charge, queueDelta, scoreDelta, line, reactionMs, cutIn, early, land,
      step: cur.step, mult, forced, big: flat,
    };
    emit('resolve', payload);
    addQueue(queueDelta);
    if (correct) addAura(perfect ? cfg.auraPerfect : cfg.auraCorrect);
    else addAura(cfg.auraWrong);
    if (s.phase === 'over') return payload;

    if (correct) addFury(cutIn ? cfg.furyCutIn : perfect ? cfg.furyPerfect : cfg.furyCorrect);
    if (s.phase === 'playing') scheduleNext(land);
    return payload;
  }

  function rageHit(key) {
    const h = s.rageHead;
    if (!h || h.hit) {
      emit('rageMiss', { key });
      return { rage: true, miss: true, queueDelta: 0, key };
    }
    h.hit = true;
    const match = key === keyOf(h.customer);
    const queueDelta = match ? cfg.rageMatchDelta : cfg.rageHitDelta;
    s.rageCombo += 1;
    s.rageQueue += queueDelta;
    s.stats.cursed += 1;
    s.stats.rageHits += 1;
    s.score += queueDelta * 100;
    const payload = { rage: true, queueDelta, key, customer: h.customer, match, n: s.rageCombo };
    emit('rageHit', payload);
    addQueue(queueDelta);
    return payload;
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
    speedMultFor,

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

      if (s.forcedLeftMs > 0 && s.phase === 'playing') {
        s.forcedLeftMs -= dt;
        if (s.forcedLeftMs <= 0) {
          s.forcedLeftMs = 0;
          s.aura = clamp(cfg.auraAfterForced, 0, 100);
          emit('forcedEnd', { aura: s.aura });
        }
      }

      if (s.phase === 'rage') {
        s.rageLeftMs -= dt;
        if (s.rageLeftMs <= 0) { endRage(); return; }
        s.rageSpawnLeftMs -= dt;
        while (s.rageSpawnLeftMs <= 0 && s.phase === 'rage') {
          s.rageSpawnLeftMs += cfg.rageSpawnMs;
          // no new head that could not be answered before rage ends
          if (s.rageLeftMs > cfg.rageSpawnMs / 2) spawnHead();
        }
        return; // no timeouts during rage
      }

      if (s.current) {
        s.current.sinceArriveMs += dt;
        if (s.buffered && s.current.sinceArriveMs >= cfg.minAnswerMs) {
          const b = s.buffered;
          s.buffered = null;
          answer(b.key, b.holdMs);
          return;
        }
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
        s.buffered = null;
        emit('polite', { customer, free });
        if (!free) addAura(cfg.auraTimeout);
        if (s.phase === 'playing') scheduleNext('polite');
      }
    },

    // A key press. In rage: a hit on the current head (or a miss when it is already hit). On a full fury bar:
    // starts rage (not while a two-step customer is at the counter). With a customer at the counter: the answer
    // (a press up to bufferMs before minAnswerMs is kept and answers at minAnswerMs). Otherwise null — main.js
    // turns a press in the landing pause into jab() / summon().
    press(key, holdMs = 0) {
      if (s.paused) return null;
      if (s.phase === 'rage') return rageHit(key);
      if (s.phase !== 'playing') return null;
      if (s.furyFull && cfg.furyEnabled && !(s.current && isTwoStep(s.current.customer))) {
        startRage();
        return { rageStart: true, key };
      }
      if (!s.current) return null;
      const cur = s.current;
      if (cur.sinceArriveMs < cfg.minAnswerMs) {
        if (cfg.minAnswerMs - cur.sinceArriveMs <= cfg.bufferMs) {
          s.buffered = { key, holdMs };
          return { buffered: true, key };
        }
        return null;
      }
      return answer(key, holdMs);
    },

    // A press while the answered customer flies (the landing pause after an answer). The first jabPaidMax jabs
    // after a correct answer add jabQueueDelta and furyJab; later ones (and any after a wrong key) are feedback only. Null when there is no such
    // landing (a customer is at the counter, rage, after a timeout).
    jab(key) {
      if (s.paused || s.phase !== 'playing' || s.current || s.landKind !== 'answer' || !s.lastHit) return null;
      s.jabs += 1;
      s.stats.jabs += 1;
      const paid = s.jabs <= cfg.jabPaidMax && s.lastHit.correct; // after a wrong key: feedback only
      const queueDelta = paid ? forcedScale(cfg.jabQueueDelta) : 0;
      const payload = { key, n: s.jabs, queueDelta, customer: s.lastHit.customer };
      if (queueDelta) s.score += queueDelta * 100;
      emit('jab', payload);
      if (queueDelta) addQueue(queueDelta);
      if (paid) addFury(cfg.furyJab);
      return payload;
    },

    // "下一位": the next customer arrives now (main.js calls it only once the clerk's line has ended).
    summon() {
      if (s.paused || s.phase !== 'playing' || s.current || !(s.gapLeftMs > 0)) return false;
      emit('summon', {});
      if (s.phase === 'playing' && !s.current) spawn();
      return true;
    },

    // Hold-to-charge after the fact: the UI resolves on key-down (press(key, 0)) and calls
    // charge(1|2) while the key stays down. Only upgrades the last answer if it was correct and
    // resolved within chargeWindowMs; adds the difference in queue (same speed multiplier) and score.
    // Reaching level 2 makes the landing pause a big one (landBigMs from the answer).
    charge(level) {
      if (s.paused || (s.phase !== 'playing' && s.phase !== 'rage')) return null;
      const hit = s.lastHit;
      const lvl = Math.max(0, Math.min(cfg.chargeBonus.length - 1, level | 0));
      if (!hit || !hit.correct || s.elapsedMs - hit.atMs > cfg.chargeWindowMs || lvl <= hit.charge) return null;
      const total = answerDelta(hit.base, lvl, hit.mult, hit.flat);
      const queueDelta = Math.max(0, total - hit.queueDelta);
      hit.charge = lvl;
      hit.queueDelta = total;
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
