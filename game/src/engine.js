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
//     early press, a guess: ×1, not perfect, no big-order bonus. The charge bonus (reworked in stage 3) and big orders are flat on top: 100 / 251 /
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
// Gameplay v2 stage 2 (docs/gameplay-v2.md 3, 5, 6; all off by default, days.js turns them on per day):
//   - preview: state.upcoming holds the next `preview` customers (drawn ahead, same order rules).
//   - Fast mouth (快嘴): quickAt correct answers in a row → quick (event quickStart). A quick customer is silent (sign
//     only, quickMinAnswerMs / quickCutInFromMs / quickSpeakMs) and lands in quickLandMs; main.js plays only the punch
//     half. Every quickEvery-th customer in fast mouth, 250s, big orders, specials, groups and the boss are full
//     (quick false: silent, but the clerk's full line). A silent customer is not talking, so a press between their sign
//     up and t0 counts as a cut-in for the stats but pays ×1.5 (the first speed step), not ×2. Scenes (250s, 251 / 520 orders, specials, groups) get the full
//     line too and restart that count; only the specials (two-step, change-order, boss) keep their voices. A wrong key or a timeout leaves fast mouth (quickEnd), no penalty.
//   - specials: [{ customer, atMs } | { type: 'group', atMs }]: each once per round, deferred while rage is ahead.
//   - Group box ({ type: 'group' }): 3–5 silent customers with the same key. Each press of that key sends one flying
//     (groupHit); the last sends all: ceil(n × (1 + combo bonus) × speed × groupMult), combo +n, served +n. A wrong key
//     scatters the group (a wrong answer). Window W + (n − 1) × groupExtraMs.
//   - Change-order customer (customer.flip = { key, cups, atMs }): while talking, atMs after arrival, the sign flips
//     (event flip); before it the old key is wanted, after it flip.key (and flip.cups count).
//   - Boss (customer.boss with steps): a wrong key also moves to the next step (+wrongQueueDelta, combo frozen); a
//     timeout repeats the step (bossAgain; combo 0, never aura). With customer.holdLast the last step only resolves on
//     a full hold of its key (press → holding, charge(2) → the final line); a release before that, or another key,
//     repeats the step (step event with again: true, no queue).
//   - meter (day 4): cups accepted with 收 (correct or off-key; cups null = 1) add up; exactly meterTarget = +meterHitDelta
//     and a full fury bar, over = reset +meterOverDelta (event meter). Charge 2 within chargeWindowMs doubles the cups.
//   - events ([{ type, atMs }], src/events.js): a mini event starts instead of the next customer once due; presses go to
//     it. shutterMs: the last N ms are the 拉铁门 mash (the customer at the counter leaves, rage ends).
//
// Events: start, arrive {customer, quick, silent}, ready {customer, patienceMs, step}, step {customer, step, key, cutIn, reactionMs,
//   correct, again, queueDelta}, quickStart {}, quickEnd {run}, groupHit {customer, hits, n, key}, flip {customer, key},
//   bossAgain {customer, step}, holding {customer, key}, meter {value, add, hit, over, queueDelta}, leave {customer},
//   eventStart {type, state}, eventCue {type, cue, ...}, eventEnd {type, result},
//   resolve {customer, key, correct, perfect, charge, queueDelta, scoreDelta, line, reactionMs, cutIn, early, land, step, mult,
//   forced, big}, polite {customer, free}, charge {level, queueDelta, customer}, bonus {queueDelta},
//   jab {key, n, queueDelta, customer}, summon {}, furyFull {}, rageStart {requeued}, rageHead {customer, n},
//   rageHit {queueDelta, key, customer, match, n}, rageMiss {key}, rageEnd {hits, queueDelta},
//   forcedStart {ms}, forcedEnd {aura}, milestone {level}, over {summary}

import { createEvent, dueEvent } from './events.js';

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
  chargeBonus: [0, 1, 2],  // flat (stage 1; the charge is reworked in gameplay-v2 stage 3)
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
  // gameplay v2 stage 2 (all off by default)
  specials: null,         // [{ customer, atMs } | { type: 'group', atMs }] each once per round (same deferral as special)
  preview: 0,             // state.upcoming: the next N customers
  quickAt: 0,             // N correct in a row → fast mouth (0 = never)
  quickEvery: 5,          // every Nth customer in fast mouth plays the full three beats
  quickMinAnswerMs: 220,  // silent customers in fast mouth / groups (enter 180 ms, sign 40 ms later): presses before
  quickCutInFromMs: 380,  // this are ignored; a press from quickCutInFromMs (sign up) until t0 is a cut-in;
  quickSpeakMs: 500,      // t0 fallback (sign up + 120 ms; nobody talks)
  quickLandMs: 250,
  groupMult: 1.5,
  groupExtraMs: 350,
  groupMin: 3,
  groupMax: 5,
  flipSpeakMs: 4200,      // talking fallback of a change-order customer (two lines)
  meter: false,
  meterTarget: 250,
  meterHitDelta: 25,
  meterOverDelta: 5,
  events: null,           // [{ type, atMs }] mini events (src/events.js)
  eventLateMs: 15000,
  eventEndMs: 400,        // empty counter after an event
  eventConfig: {},        // per-type overrides for src/events.js
  shutterMs: 0,           // the last N ms: 拉铁门 (0 = off)
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
const isGroup = (c) => Array.isArray(c?.group) && c.group.length > 0;
const cupsOf = (c, flipped) => (flipped && c.flip && c.flip.cups != null ? c.flip.cups : c.cups);
const is250Of = (c, flipped) => c.style === '250' || cupsOf(c, flipped) === 250;

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
      specialsDone: new Set(),
      upcoming: [],
      streak: 0,        // correct answers in a row (fast mouth)
      quick: false,
      quickN: 0,        // arrivals in this fast-mouth run (every quickEvery-th is full)
      quickRun: 0,      // correct answers in this fast-mouth run
      meter: 0,
      meterLast: null,  // { atMs, cups, reset } of the last 收 added to the meter (charge doubling)
      event: null,      // the running mini event (src/events.js)
      eventsDone: new Set(),
      shutter: false,
      groups: 0,
      st2: {            // star / rule stats (days.js evaluateDay)
        quickBest: 0, quickCutIns: 0, originals: 0, originalsFast: 0, meterHits: 0, meterOvers: 0, meter249plus1: 0,
        groupsCleared: 0, groupsSeen: 0, bossSeen: false, bossBeaten: false, bossTimeouts: 0, bossHagglePerfect: 0,
        cutInHesitant: 0, charged1cupGun: 0, phoneHungUp: 0, phoneFast: 0, calcJackpots: 0, stampDone: 0,
        megaphone: 0, shutter: 0, flips: 0, flipsWaited: 0,
      },
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

  // A group box: groupMin..groupMax silent customers who share an answer key (never two-step ones).
  function buildGroup() {
    const plain = customers.filter((c) => !isTwoStep(c) && !c.flip && !c.boss);
    const keys = KEYS.filter((k) => plain.filter((c) => keyOf(c) === k).length >= cfg.groupMin);
    if (!keys.length) return null;
    const key = keys[Math.floor(rng() * keys.length) % keys.length];
    const cands = plain.filter((c) => keyOf(c) === key);
    const n = Math.min(cands.length, cfg.groupMin + Math.floor(rng() * (cfg.groupMax - cfg.groupMin + 1)));
    const members = [];
    const left = cands.slice();
    while (members.length < n && left.length) members.push(left.splice(Math.floor(rng() * left.length) % left.length, 1)[0]);
    s.groups += 1;
    return { id: `group${s.groups}`, group: members, key, style: members[0].style, cat: members[0].cat, cups: null, says: '' };
  }

  // the next due special (each once per round), or null
  function dueSpecial() {
    const list = [];
    if (cfg.special && cfg.special.customer) list.push(cfg.special);
    if (Array.isArray(cfg.specials)) list.push(...cfg.specials);
    for (let i = 0; i < list.length; i++) {
      const sp = list[i];
      const done = sp === cfg.special ? s.specialDone : s.specialsDone.has(i);
      if (done || s.elapsedMs < (sp.atMs ?? 0)) continue;
      return { sp, mark: () => { if (sp === cfg.special) s.specialDone = true; else s.specialsDone.add(i); } };
    }
    return null;
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
    // 2. the once-per-round special customers. Never in rage, and deferred while the fury bar is full (the next
    //    press would start rage and the two-step scene would be lost): a normal customer comes instead, rage runs,
    //    and the special one is the first pick once it is over (fury is back at 0).
    if (!rageAhead()) {
      const due = dueSpecial();
      if (due) {
        due.mark();
        if (due.sp.type === 'group') {
          const g = buildGroup();
          if (g) return g;
        } else if (due.sp.customer) {
          return take(due.sp.customer);
        }
      }
    }
    // 3. preview: the customer at the head of the line (the line is refilled behind them)
    if (cfg.preview > 0) {
      refillUpcoming();
      const c = s.upcoming.shift();
      refillUpcoming();
      return c;
    }
    return drawCustomer();
  }

  function refillUpcoming() {
    while (s.upcoming.length < cfg.preview) s.upcoming.push(drawCustomer());
  }

  function drawCustomer() {
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

  // scenes keep their voices and the full three beats even in fast mouth: 250s, big orders (251 / 520), specials
  // (two-step, boss, change-order) and groups (silent, but a scene of their own)
  function isScene(c) {
    return isTwoStep(c) || isGroup(c) || !!c.flip || !!c.boss || is250Of(c) || bigBonus(c) >= 2;
  }

  function spawn() {
    if (s.shutter) return;
    // a due mini event takes the empty counter instead of the next customer
    if (cfg.events && !s.event && s.phase === 'playing') {
      const i = dueEvent(cfg.events, { elapsedMs: s.elapsedMs, timeLeftMs: s.timeLeftMs, done: s.eventsDone },
        { lateMs: cfg.eventLateMs, shutterMs: cfg.shutterMs });
      if (i >= 0) {
        s.eventsDone.add(i);
        startEvent(cfg.events[i].type);
        return;
      }
    }
    const customer = pickCustomer();
    const max = patienceFor(s.elapsedMs, s.combo) + (isGroup(customer) ? (customer.group.length - 1) * cfg.groupExtraMs : 0);
    // fast mouth: ordinary customers are silent (sign only); every quickEvery-th of them gets the clerk's full three
    // beats (quick false), the others only the punch. A scene customer keeps everything and restarts the count.
    let quick = false;
    let silent = isGroup(customer);
    if (s.quick) {
      if (isScene(customer)) {
        s.quickN = 0;
        // 250s and big orders: no voice either (the clerk's full line and the big landing are the show);
        // the specials (original, change-order, boss) keep their voices
        if (!isTwoStep(customer) && !customer.flip && !customer.boss) silent = true;
      } else {
        s.quickN += 1;
        silent = true;
        quick = s.quickN % cfg.quickEvery !== 0;
      }
    }
    const speakMs = silent ? cfg.quickSpeakMs : customer.flip ? cfg.flipSpeakMs
      : customer.boss ? (customer.stepSpeakMs ?? cfg.stepSpeakMs) : cfg.speakMaxMs;
    s.current = {
      customer, speaking: true, speakLeftMs: speakMs, sinceArriveMs: 0, step: 0, patienceMs: max, patienceMaxMs: max,
      quick, silent,
      minAnswerMs: silent ? cfg.quickMinAnswerMs : cfg.minAnswerMs,
      cutInFromMs: silent ? cfg.quickCutInFromMs : cfg.cutInFromMs,
      hits: 0, flipped: false, holding: null, allFast: true, haggleFast: 0, firstPress: null,
    };
    if (isGroup(customer)) s.st2.groupsSeen += 1;
    if (customer.boss) s.st2.bossSeen = true;
    s.gapLeftMs = 0;
    s.landKind = null;
    s.jabs = 0;
    s.buffered = null;
    s.arrivals += 1;
    emit('arrive', { customer, quick, silent });
    addFury(cfg.furyPerCustomer);
    if (speakMs <= 0) speechDone();
  }

  // ---- mini events (src/events.js)
  function applyEffects(effects) {
    for (const e of effects) {
      if (e.kind === 'queue' && e.n > 0) {
        const n = forcedScale(e.n);
        s.score += n * 100;
        emit('bonus', { queueDelta: n, event: s.event?.type });
        addQueue(n);
      } else if (e.kind === 'fury') {
        addFury(e.n);
      } else if (e.kind === 'cue') {
        emit('eventCue', { type: s.event?.type, ...e });
      } else if (e.kind === 'end') {
        endEvent(e.result);
      }
    }
  }

  function startEvent(type) {
    s.event = createEvent(type, { queue: s.queue, config: cfg.eventConfig || {} });
    s.current = null;
    s.gapLeftMs = 0;
    s.landKind = null;
    s.buffered = null;
    emit('eventStart', { type, state: s.event.state() });
  }

  function endEvent(result) {
    const ev = s.event;
    if (!ev) return;
    const st = s.st2;
    if (ev.type === 'phone' && result.hungUp) { st.phoneHungUp += 1; if (result.fast) st.phoneFast += 1; }
    if (ev.type === 'calculator' && result.jackpot) st.calcJackpots += 1;
    if (ev.type === 'stamp' && result.finished) st.stampDone += 1;
    if (ev.type === 'megaphone') st.megaphone += result.count || 0;
    if (ev.type === 'shutter') st.shutter += result.count || 0;
    s.event = null;
    emit('eventEnd', { type: ev.type, result });
    if (s.phase === 'playing' && !s.shutter) {
      s.landStartMs = s.elapsedMs;
      s.landKind = 'event';
      s.gapLeftMs = cfg.eventEndMs;
    }
  }

  // the last shutterMs: the customer at the counter leaves, rage or a running event ends, presses mash the shutter
  function startShutter() {
    s.shutter = true; // before endRage(): its 'rageEnd' handlers see the shutter coming
    if (s.phase === 'rage') endRage();
    if (s.event) { const ev = s.event; s.event = null; emit('eventEnd', { type: ev.type, result: { cut: true } }); }
    if (s.current) {
      const customer = s.current.customer;
      s.current = null;
      emit('leave', { customer });
    }
    s.shutter = true;
    s.gapLeftMs = 0;
    s.buffered = null;
    s.landKind = null;
    s.event = createEvent('shutter', { queue: s.queue, config: { shutter: { ...(cfg.eventConfig?.shutter || {}), durationMs: Math.max(1, s.timeLeftMs) } } });
    emit('eventStart', { type: 'shutter', state: s.event.state() });
  }

  // change-order customer: the sign flips to flip.key while they talk
  function flipNow() {
    const c = s.current;
    if (!c || c.flipped || !c.customer.flip) return;
    c.flipped = true;
    emit('flip', { customer: c.customer, key: c.customer.flip.key });
  }

  function speechDone() {
    const c = s.current;
    if (!c || !c.speaking) return false;
    if (s.phase !== 'playing') return false;
    if (c.customer.flip && !c.flipped) flipNow();
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
    if (kind === 'quick') return cfg.quickLandMs;
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

  function bigBonus(customer, flipped = false) {
    const cups = cupsOf(customer, flipped);
    if (cups === 250) return cfg.bonus250;
    return (cfg.bigOrders && cfg.bigOrders[cups]) || 0;
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
        perfect: s.stats.perfect,
        rageHits: s.stats.rageHits,
        ...s.st2,
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
          quick: c.quick, silent: c.silent, hits: c.hits, flipped: c.flipped, holding: !!c.holding,
          key: wantOf(c),
        })
        : null,
      upcoming: Object.freeze(s.upcoming.slice()),
      streak: s.streak,
      quick: s.quick,
      quickRun: s.quickRun,
      meter: s.meter,
      event: s.event ? Object.freeze(s.event.state()) : null,
      shutter: s.shutter,
      stats: Object.freeze({ ...s.stats }),
      st2: Object.freeze({ ...s.st2 }),
    });
  }

  // the key the customer at the counter wants now
  function wantOf(cur) {
    const c = cur.customer;
    if (isTwoStep(c)) return c.steps[Math.min(cur.step, c.steps.length - 1)];
    if (c.flip && cur.flipped) return c.flip.key;
    return c.key;
  }

  // when the press came: early (sign still rising), cut-in (while talking) or reaction after t0
  function timingOf(cur) {
    const early = cur.speaking && cur.sinceArriveMs < cur.cutInFromMs;
    const cutIn = cur.speaking && !early;
    const reactionMs = cur.speaking ? 0 : cur.patienceMaxMs - cur.patienceMs;
    return { early, cutIn, reactionMs, fast: cutIn || (!early && reactionMs < cfg.perfectMs) };
  }

  // fast mouth (快嘴): correct answers in a row
  function onCorrect(cutIn) {
    s.streak += 1;
    if (s.quick) {
      s.quickRun += 1;
      if (s.quickRun > s.st2.quickBest) s.st2.quickBest = s.quickRun;
      if (cutIn) s.st2.quickCutIns += 1;
    } else if (cfg.quickAt > 0 && s.streak >= cfg.quickAt) {
      s.quick = true;
      s.quickN = 0;
      s.quickRun = 0;
      emit('quickStart', {});
    }
  }
  function breakStreak() {
    s.streak = 0;
    if (s.quick) {
      const run = s.quickRun;
      s.quick = false;
      s.quickRun = 0;
      s.quickN = 0;
      emit('quickEnd', { run });
    }
  }

  // day 4 meter: cups accepted with 收 (null = one cup)
  function addMeter(cups) {
    const add = Math.max(1, Number(cups) || 1);
    const before = s.meter;
    const v = before + add;
    let queueDelta = 0;
    let result = 'add';
    if (v === cfg.meterTarget) {
      s.meter = 0;
      s.st2.meterHits += 1;
      if (before === cfg.meterTarget - 1 && add === 1) s.st2.meter249plus1 += 1;
      queueDelta = forcedScale(cfg.meterHitDelta);
      result = 'hit';
    } else if (v > cfg.meterTarget) {
      s.meter = 0;
      s.st2.meterOvers += 1;
      queueDelta = forcedScale(cfg.meterOverDelta);
      result = 'over';
    } else {
      s.meter = v;
    }
    s.meterLast = { atMs: s.elapsedMs, cups: add, reset: result !== 'add' };
    emit('meter', { value: v, add, hit: result === 'hit', over: result === 'over', queueDelta, meter: s.meter });
    if (queueDelta) { s.score += queueDelta * 100; addQueue(queueDelta); }
    if (result === 'hit' && cfg.furyEnabled && !s.furyFull && s.phase === 'playing') {
      s.fury = 100;
      s.furyFull = true;
      emit('furyFull', {});
    }
    return result;
  }

  function answer(key, holdMs) {
    const cur = s.current;
    const { customer } = cur;
    const t = timingOf(cur);
    const want = wantOf(cur);
    const correct = key === want;
    const steps = isTwoStep(customer) ? customer.steps : null;

    if (customer.boss) return bossStep(cur, key, correct, t, holdMs);
    if (isGroup(customer) && correct) return groupHit(cur, key, t);

    // two-step customer: a correct non-final step keeps them at the counter for the next step
    if (correct && steps && cur.step < steps.length - 1) {
      if (!t.fast) cur.allFast = false;
      cur.step += 1;
      cur.speaking = true;
      cur.speakLeftMs = cfg.stepSpeakMs;
      cur.sinceArriveMs = 0;
      const max = patienceFor(s.elapsedMs, s.combo);
      cur.patienceMs = max;
      cur.patienceMaxMs = max;
      s.lastHit = null;
      const payload = { customer, step: cur.step, key, cutIn: t.cutIn, reactionMs: t.reactionMs, correct: true };
      emit('step', payload);
      return payload;
    }
    return resolveAnswer(cur, key, correct, t, holdMs);
  }

  // A group box: each press of the right key sends one flying; the last one resolves the whole group.
  function groupHit(cur, key, t) {
    if (!cur.firstPress) cur.firstPress = t;
    cur.hits += 1;
    const n = cur.customer.group.length;
    if (cur.hits < n) {
      const payload = { customer: cur.customer, hits: cur.hits, n, key, group: true };
      emit('groupHit', payload);
      return payload;
    }
    return resolveAnswer(cur, key, true, cur.firstPress, 0);
  }

  function resolveAnswer(cur, key, correct, t, holdMs, opts = {}) {
    const { customer } = cur;
    const { early, cutIn, reactionMs } = t;
    const steps = isTwoStep(customer) ? customer.steps : null;
    const group = isGroup(customer) ? customer.group.length : 0;
    const perfect = correct && !early && reactionMs < cfg.perfectMs;
    const charge = opts.charge ?? chargeOf(Math.max(0, Number(holdMs) || 0));
    const line = steps
      ? (customer.reply2 ?? customer.reply)
      : (customer.alt && rng() < cfg.altChance ? customer.alt : customer.reply);
    const flipped = cur.flipped;
    const is250 = is250Of(customer, flipped);
    // an early press (before the customer talks, the sign still rising) is a guess: no big-order bonus either
    const bigOrder = bigBonus(customer, flipped);
    const flat = early ? 0 : bigOrder + (opts.flat || 0);
    const forced = s.forcedLeftMs > 0;
    const wasQuick = s.quick;

    let queueDelta;
    let scoreDelta;
    let mult = 1;
    let base = 0;
    if (correct) {
      // a silent customer (fast mouth, group) is not talking: a press in the cut-in window is quick (×1.5), not 抢话 ×2
      mult = early ? 1 : cur.silent && cutIn ? speedMultFor(false, 0) : speedMultFor(cutIn, reactionMs);
      base = 1 + Math.floor(Math.min(s.combo, cfg.comboCap) / cfg.comboStep);
      queueDelta = group
        ? forcedScale(Math.ceil(group * base * mult * cfg.groupMult - 1e-9) + cfg.chargeBonus[charge] + flat)
        : answerDelta(base, charge, mult, flat);
      for (let i = 0; i < Math.max(1, group); i++) bumpCombo();
      scoreDelta = queueDelta * 100 + (perfect ? 50 : 0) + Math.min(s.combo, cfg.comboCap) * 10;
    } else {
      // wrong key: still counts, the combo is frozen (no reset, no increment)
      queueDelta = forcedScale(cfg.wrongQueueDelta);
      scoreDelta = 20;
    }
    let land = 'normal';
    if (!correct) land = 'wrong';
    else if (steps) land = 'step';
    else if (cur.quick && charge < 2) land = 'quick';
    else if (group || customer.style === 'curse' || is250 || bigOrder > 0 || charge === 2) land = 'big';

    s.score += scoreDelta;
    s.stats.served += Math.max(1, group);
    s.stats.cursed += 1;
    if (perfect) s.stats.perfect += 1;
    if (scoreDelta > s.best.score) s.best = { id: customer.id ?? null, score: scoreDelta };
    const st = s.st2;
    if (correct && steps && !customer.boss) {
      st.originals += 1;
      if (cur.allFast && t.fast) st.originalsFast += 1;
    }
    if (correct && group) st.groupsCleared += 1;
    if (correct && cutIn && customer.key === 'gun' && customer.cat === '犹豫磨叽') st.cutInHesitant += 1;
    if (customer.flip) {
      st.flips += 1;
      if (flipped && correct) st.flipsWaited += 1;
    }
    s.current = null;
    s.buffered = null;
    s.lastHit = { customer, key, correct, charge, scoreDelta, atMs: s.elapsedMs, base, mult, flat, queueDelta, group };

    const payload = {
      customer, key, correct, perfect, charge, queueDelta, scoreDelta, line, reactionMs, cutIn, early, land,
      step: cur.step, mult, forced, big: flat, quick: !!cur.quick, inQuick: wasQuick, group, flipped,
      boss: !!customer.boss, final: !!opts.final,
    };
    emit('resolve', payload);
    addQueue(queueDelta);
    if (correct) addAura(perfect ? cfg.auraPerfect : cfg.auraCorrect);
    else addAura(cfg.auraWrong);
    if (s.phase === 'over') return payload;

    if (correct) {
      addFury(cutIn ? cfg.furyCutIn : perfect ? cfg.furyPerfect : cfg.furyCorrect);
      onCorrect(cutIn);
    } else {
      breakStreak();
    }
    if (cfg.meter && key === 'take' && !steps && !group) addMeter(cupsOf(customer, flipped));
    if (s.phase === 'playing') scheduleNext(land);
    return payload;
  }

  // ---- the boss (customer.boss): every press moves him on; a timeout repeats the step; the last step wants a full hold
  function restartStep(cur) {
    cur.speaking = true;
    cur.speakLeftMs = cur.customer.stepSpeakMs ?? cfg.stepSpeakMs; // the boss talks long (his own fallback)
    cur.sinceArriveMs = 0;
    cur.holding = null;
    const max = patienceFor(s.elapsedMs, s.combo);
    cur.patienceMs = max;
    cur.patienceMaxMs = max;
    s.buffered = null;
    s.lastHit = null;
  }

  function bossStep(cur, key, correct, t, holdMs) {
    const c = cur.customer;
    const last = cur.step >= c.steps.length - 1;
    if (last) {
      if (!correct) return bossRepeat(cur, key, false);
      if (!c.holdLast) return bossFinal(cur, key, t);
      cur.holding = { key, t };
      emit('holding', { customer: c, key, step: cur.step });
      if (chargeOf(Math.max(0, Number(holdMs) || 0)) >= 2) return bossFinal(cur, key, t);
      return { holding: true, key, customer: c, step: cur.step };
    }
    let queueDelta;
    if (correct) {
      const mult = t.early ? 1 : speedMultFor(t.cutIn, t.reactionMs);
      const base = 1 + Math.floor(Math.min(s.combo, cfg.comboCap) / cfg.comboStep);
      queueDelta = answerDelta(base, 0, mult, 0);
      bumpCombo();
      if (Array.isArray(c.haggle) && c.haggle.includes(cur.step) && t.fast) cur.haggleFast += 1;
      s.score += queueDelta * 100 + (t.fast ? 50 : 0);
    } else {
      queueDelta = forcedScale(cfg.wrongQueueDelta);
      s.score += 20;
      breakStreak();
    }
    s.stats.cursed += 1;
    if (correct && t.fast && !t.cutIn) s.stats.perfect += 1;
    const prev = cur.step;
    cur.step += 1;
    restartStep(cur);
    const payload = { customer: c, step: cur.step, prev, key, cutIn: t.cutIn, reactionMs: t.reactionMs, correct, queueDelta, boss: true };
    emit('step', payload);
    addQueue(queueDelta);
    if (correct) {
      addAura(t.fast ? cfg.auraPerfect : cfg.auraCorrect);
      addFury(t.cutIn ? cfg.furyCutIn : t.fast ? cfg.furyPerfect : cfg.furyCorrect);
    }
    return payload;
  }

  // the last step again: a release before the full hold (tap) or another key. Feedback only (his question comes
  // again; no queue, like a jab after a wrong key), so mashing on him never pays.
  function bossRepeat(cur, key, tap) {
    const c = cur.customer;
    s.stats.cursed += 1;
    restartStep(cur);
    const payload = { customer: c, step: cur.step, prev: cur.step, key, again: true, tap, correct: false, queueDelta: 0, boss: true };
    emit('step', payload);
    return payload;
  }

  function bossFinal(cur, key, t) {
    const c = cur.customer;
    const tt = cur.holding ? cur.holding.t : t;
    cur.holding = null;
    s.st2.bossBeaten = true;
    if (Array.isArray(c.haggle) && cur.haggleFast >= c.haggle.length) s.st2.bossHagglePerfect = 1;
    return resolveAnswer(cur, key, true, tt, 0, { charge: c.holdLast ? 2 : 0, flat: cfg.bonus250, final: true });
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
      if (cfg.shutterMs > 0 && !s.shutter && s.timeLeftMs <= cfg.shutterMs) startShutter();
      if (s.event) {
        // a mini event owns the counter (the round clock keeps running; forced politeness keeps counting down)
        if (s.forcedLeftMs > 0) {
          s.forcedLeftMs = Math.max(0, s.forcedLeftMs - dt);
          if (s.forcedLeftMs <= 0) { s.aura = clamp(cfg.auraAfterForced, 0, 100); emit('forcedEnd', { aura: s.aura }); }
        }
        applyEffects(s.event.tick(dt));
        return;
      }
      if (s.shutter) return;

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
        const fl = s.current.customer.flip;
        if (fl && !s.current.flipped && s.current.speaking && s.current.sinceArriveMs >= (fl.atMs ?? cfg.cutInFromMs + 1000)) flipNow();
        if (s.buffered && s.current.sinceArriveMs >= s.current.minAnswerMs) {
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

      if (s.current.holding) return; // the boss's last step: a held key freezes the timer
      s.current.patienceMs -= dt;
      if (s.current.patienceMs <= 0 && s.current.customer.boss) {
        // the boss never leaves: he asks again (combo 0, no aura)
        const cur = s.current;
        s.timeouts += 1;
        s.stats.polite += 1;
        s.st2.bossTimeouts += 1;
        s.combo = 0;
        breakStreak();
        restartStep(cur);
        emit('bossAgain', { customer: cur.customer, step: cur.step });
        return;
      }
      if (s.current.patienceMs <= 0) {
        const customer = s.current.customer;
        s.timeouts += 1;
        const firstFree = cfg.firstTimeoutFree && s.timeouts === 1;
        const free = firstFree || !cfg.timeoutCostsAura;
        s.stats.polite += 1;
        s.combo = 0;
        breakStreak();
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
      if (s.event) {
        const type = s.event.type;
        applyEffects(s.event.press(key, holdMs));
        return { event: type, key };
      }
      if (s.shutter) return null;
      if (s.current && s.current.holding) return null; // the boss's last step: another key while 收 is held
      if (s.furyFull && cfg.furyEnabled && !(s.current && isTwoStep(s.current.customer))) {
        startRage();
        return { rageStart: true, key };
      }
      if (!s.current) return null;
      const cur = s.current;
      if (cur.sinceArriveMs < cur.minAnswerMs) {
        if (cur.minAnswerMs - cur.sinceArriveMs <= cfg.bufferMs) {
          s.buffered = { key, holdMs };
          return { buffered: true, key };
        }
        // fast mouth: the next head pops while the last one still flies; a press in its first moment is a late jab on
        // the last one (feedback only), not an answer
        if (s.lastHit && s.elapsedMs - s.lastHit.atMs < 1000) return { tooEarly: true, key };
        return null;
      }
      return answer(key, holdMs);
    },

    // A key released after holdMs (main.js forwards every release). The boss's last step: a release before the full
    // hold repeats it (step event, again + tap). A mini event: the calculator resolves on release. Null otherwise.
    release(key, holdMs = 0) {
      if (s.paused || s.phase !== 'playing') return null;
      if (s.event) {
        const type = s.event.type;
        const fx = s.event.release(key, holdMs);
        if (!fx.length) return null;
        applyEffects(fx);
        return { event: type, key };
      }
      const cur = s.current;
      if (cur && cur.holding && cur.holding.key === key && chargeOf(Math.max(0, Number(holdMs) || 0)) < 2) {
        return bossRepeat(cur, key, true);
      }
      return null;
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
      const lvl = Math.max(0, Math.min(cfg.chargeBonus.length - 1, level | 0));
      // the boss's last step: the full hold is the answer
      if (s.current && s.current.holding && lvl >= 2 && s.phase === 'playing') {
        return bossFinal(s.current, s.current.holding.key, s.current.holding.t);
      }
      const hit = s.lastHit;
      if (!hit || !hit.correct || hit.group || s.elapsedMs - hit.atMs > cfg.chargeWindowMs || lvl <= hit.charge) return null;
      if (lvl >= 2 && hit.key === 'gun' && hit.customer.cups === 1) s.st2.charged1cupGun += 1;
      // day 4 meter: a full charge doubles the cups of that 收 (unless that 收 already hit or overflowed the meter)
      const m = s.meterLast;
      const doubleMeter = cfg.meter && lvl >= 2 && hit.key === 'take' && m && m.atMs === hit.atMs && !m.reset && !m.doubled;
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
      if (doubleMeter && s.phase === 'playing') {
        m.doubled = true;
        addMeter(m.cups);
      }
      return payload;
    },

    // t0: the customer finished talking (main.js calls this at min(voice end, signUp + 1600)).
    // Starts the answer window and emits 'ready'. No-op if not talking.
    speechDone,

    // Change-order customer: flip the sign now (main.js calls it when their first line ends; the engine flips by
    // itself at customer.flip.atMs, or at speechDone, whichever comes first).
    flip() {
      if (s.paused || s.phase !== 'playing' || !s.current || !s.current.speaking) return false;
      const before = s.current.flipped;
      flipNow();
      return !before && s.current.flipped;
    },

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
