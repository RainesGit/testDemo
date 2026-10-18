// engine.js — gameplay v3 shop logic (docs/gameplay-v3-shop.md 3–5): pure, no DOM, no real clock.
// The caller advances time with tick(dt) and calls the actions; everything that happened is queued as events
// (drain()) for the UI and audio. tools/shop-sim.mjs and test/shop-*.test.mjs drive it headless.
//
//   createShop({ day, fame, upgrades, seed, guide }) → shop
//     state            the live state (read-only by convention): see newState() below
//     tick(dt)         advance dt ms: timers (pour, sealer, pearl pot), arrivals, patience, nags, the day's end
//     takeCup()                       a new empty cup on the first free work slot (it becomes the selected cup)
//     select(w)                       the cup the stations act on
//     addTea(kind) / addTopping(kind) / tapIce() / tapSugar()     act on the selected cup (or the first editable one)
//     seal(w)          drag cup w to the sealer (needs tea, the pour done, a free sealer)
//     serve(w, slot)   drag sealed cup w to the customer in slot: pay + tip, or half pay and a complaint
//     trash(w)         drop cup w in the bin (costs CUP_COST)
//     cook()           start a fresh pot of pearls
//     answer(slot, key)  a gesture on a customer: 'gun' 滾 (swipe) | 'shut' 閉嘴 (3 taps) | 'take' 收 (hold)
//     drain() → events[]   { type, ... } (see emit() calls), oldest first
//     summary() → the day's receipt
//   Exported helpers: starsOf, priceMult, arrivalGap, orderPrice, sameDrink, queueCap, FAME_STARS, PRICE ...
import { fnv1a, mulberry32 } from '../art.js';
import { dayDef } from './days.js';
import { applyUpgrades } from './upgrades.js';
import { OKE_CIDS, okeOf, okePool } from './oke.js';

export const TEAS = ['black', 'green', 'jade'];
export const TOPPINGS = ['pearl', 'coconut', 'pudding', 'grass'];
export const PRICE = { black: 30, green: 30, jade: 40, pearl: 10, coconut: 15, pudding: 15, grass: 10 };
export const CUP_COST = 5;
export const MAX_TOPPINGS = 3;
export const FAME_STARS = [0, 120, 300, 600, 1000]; // fame points for ★1 … ★5
export const FAME = { okeBest: 30, oke: 15, normalCurse: 4, serveFast: 2, serve: 1, walkout: -5 };
export const FANS = { best: 4, oke: 2, normal: 1 }; // customers who join the queue after a curse
export const SLOT_VACANT_MS = 700;   // a seat stays empty this long (the exit animation) before the next customer
export const NAG_MS = 7000;          // an unanswered 奧客 complains again every NAG_MS
export const OKE_DRAIN = 0.5;        // each unanswered 奧客 makes everyone else lose patience 50% faster
export const TWO_CUP_PATIENCE = 1.4;
export const TIP_SHARE = 0.5;        // a perfect, instant serve tips 50% of the price
export const GUIDE_STEPS = ['cup', 'tea', 'topping', 'seal', 'serve', 'oke'];

export function starsOf(fame) {
  let s = 1;
  for (let i = 1; i < FAME_STARS.length; i++) if (fame >= FAME_STARS[i]) s = i + 1;
  return s;
}
/** ★1 ×1.0 → ★5 ×2.0 (spec 4.3). */
export const priceMult = (stars) => 1 + (Math.max(1, Math.min(5, stars)) - 1) * 0.25;
/** Mean gap between arrivals: fame brings people in faster (★5 = 1.6× the arrivals of ★1). */
export const arrivalGap = (def, stars) => def.arriveMs / (1 + 0.15 * (Math.max(1, stars) - 1));
/** People waiting outside at most (the rest walk on). */
export const queueCap = (stars) => 4 + 2 * Math.max(1, stars);
export const orderPrice = (order) => (PRICE[order.tea] || 0) + (order.toppings || []).reduce((a, k) => a + (PRICE[k] || 0), 0);
const sortKey = (arr) => [...(arr || [])].sort().join(',');
export function sameDrink(cup, order) {
  return !!cup && !!order && cup.tea === order.tea && sortKey(cup.toppings) === sortKey(order.toppings) &&
    (cup.ice | 0) === (order.ice | 0) && (cup.sugar | 0) === (order.sugar | 0);
}

export function createShop({ day = 1, fame = 0, upgrades = [], seed = 1, guide = false, def: defIn } = {}) {
  const def = defIn || dayDef(day);
  const cfg = applyUpgrades(upgrades);
  const rnd = mulberry32(fnv1a(`shop:${def.n}:${seed}`));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  let uid = 0;
  const events = [];
  const emit = (type, data = {}) => { events.push({ type, t: s.t, ...data }); };

  const s = {
    day: def.n, def, cfg,
    phase: guide ? 'guide' : 'open',  // guide → open → closed
    t: 0,          // ms since the page started this day (timers)
    clock: 0,      // ms the shop has been open (the 2:30 day)
    length: def.lengthMs,
    earned: 0, tips: 0,
    fame, fameStart: fame, stars: starsOf(fame), starsStart: starsOf(fame),
    slots: Array(cfg.seats).fill(null),
    vacantUntil: Array(cfg.seats).fill(0),
    queue: [],
    work: Array(cfg.workSlots).fill(null),
    selected: null,
    pot: { scoops: cfg.potMax, max: cfg.potMax, cookingUntil: 0 },
    nextArrival: 1500,
    scriptDone: [],
    okeSeen: [],
    guide: guide ? { step: 0, custUid: null, okeAt: 0, okeUid: null } : null,
    stats: { served: 0, correct: 0, wrong: 0, walkouts: 0, refused: 0, trashed: 0, prepay: 0,
      oke: { gun: 0, shut: 0, take: 0 }, okeBest: 0, normalCursed: 0, fans: 0 },
  };

  // ---- customers ----
  const menuToppings = () => def.toppings.concat(cfg.coconut ? ['coconut'] : []);
  function genOrder({ single = false } = {}) {
    const tea = pick(def.teas);
    const pool = menuToppings();
    let toppings = [];
    const r = rnd();
    if (r < def.plainShare) toppings = [];
    else if (r < def.plainShare + def.twoTopShare && pool.length >= 2) {
      const a = pick(pool);
      let b = pick(pool);
      while (b === a) b = pick(pool);
      toppings = [a, b];
    } else toppings = [pick(pool)];
    const ice = def.ice ? Math.floor(rnd() * 3) : 0;
    const sugar = def.sugar ? Math.floor(rnd() * 3) : 0;
    const count = !single && def.twoCupShare && rnd() < def.twoCupShare ? 2 : 1;
    return { tea, toppings, ice, sugar, count };
  }
  function normalCust(order) {
    let cid = 1 + Math.floor(rnd() * 100);
    while (OKE_CIDS.has(cid)) cid = 1 + Math.floor(rnd() * 100);
    const o = order || genOrder();
    const pm = def.patienceMs * (o.count > 1 ? TWO_CUP_PATIENCE : 1);
    return { uid: ++uid, kind: 'normal', cid, visit: uid, order: o, delivered: 0, patience: pm, patienceMax: pm, oke: null, converted: false, doublePay: false };
  }
  function okeCust(type) {
    const o = okeOf(type);
    return { uid: ++uid, kind: 'oke', cid: o.cid, visit: 0, order: null, delivered: 0, patience: 1, patienceMax: 1, oke: type, converted: false, doublePay: false, nagAt: 0 };
  }
  function pickOke() {
    const scripted = new Set((def.script || []).map((x) => x.oke)); // scripted 奧客 come once, on cue
    const fresh = (def.newOke || []).filter((t) => !s.okeSeen.includes(t) && !scripted.has(t));
    if (fresh.length) return pick(fresh);
    const pool = okePool(def.n).filter((t) => !scripted.has(t));
    return pool.length ? pick(pool) : null;
  }
  function enqueue(c, { front = false } = {}) {
    if (front) s.queue.unshift(c); else s.queue.push(c);
    if (c.oke && !s.okeSeen.includes(c.oke)) s.okeSeen.push(c.oke);
    emit('queue', { n: s.queue.length });
  }
  function arrive() {
    if (s.queue.length >= queueCap(s.stars)) return;
    if (rnd() < def.okeShare) {
      const type = pickOke();
      if (type) { enqueue(okeCust(type), { front: !!okeOf(type).cutsIn }); return; }
    }
    enqueue(normalCust());
  }
  function addFans(n) {
    const cap = queueCap(s.stars) + 4;
    let k = 0;
    while (k < n && s.queue.length < cap) { s.queue.push(normalCust()); k++; }
    s.stats.fans += k;
    if (k) emit('fans', { n: k, queue: s.queue.length });
  }
  function seat(i, c) {
    s.slots[i] = c;
    c.seatedAt = s.t;
    if (c.kind === 'oke') c.nagAt = s.t + NAG_MS;
    emit('arrive', { slot: i, cust: c });
  }
  function leave(i, reason, extra = {}) {
    const c = s.slots[i];
    if (!c) return;
    s.slots[i] = null;
    s.vacantUntil[i] = s.t + SLOT_VACANT_MS;
    emit('leave', { slot: i, reason, cust: c, ...extra });
  }
  const angryOke = () => s.slots.filter((c) => c && c.kind === 'oke' && !c.converted).length;
  const findSlot = (uidN) => s.slots.findIndex((c) => c && c.uid === uidN);

  // ---- fame ----
  function addFame(n, why) {
    const before = s.stars;
    const v = n > 0 ? Math.round(n * cfg.fameMult) : n;
    s.fame = Math.max(0, s.fame + v);
    s.stars = starsOf(s.fame);
    emit('fame', { delta: v, fame: s.fame, why });
    if (s.stars > before) emit('star', { stars: s.stars });
    return v;
  }

  // ---- cups ----
  const editable = (cup) => !!cup && !cup.sealed && !cup.sealingUntil;
  function target() {
    if (s.selected != null && editable(s.work[s.selected])) return s.selected;
    const i = s.work.findIndex(editable);
    return i < 0 ? null : i;
  }
  const fail = (reason, data = {}) => { emit('nope', { reason, ...data }); return { ok: false, reason }; };

  function takeCup() {
    if (s.phase === 'closed') return fail('closed');
    const w = s.work.findIndex((c) => !c);
    if (w < 0) return fail('noSlot');
    s.work[w] = { tea: null, toppings: [], ice: 0, sugar: 0, sealed: false, pourUntil: 0, sealingUntil: 0 };
    s.selected = w;
    emit('cup', { w });
    guideCheck();
    return { ok: true, w };
  }
  function select(w) {
    if (!s.work[w]) return { ok: false };
    s.selected = w;
    emit('select', { w });
    return { ok: true, w };
  }
  function addTea(kind) {
    if (!def.teas.includes(kind)) return fail('locked');
    const w = target();
    if (w == null) return fail('noCup', { station: 'tea' });
    const cup = s.work[w];
    if (cup.tea) return fail('hasTea', { w });
    cup.tea = kind;
    cup.pourUntil = s.t + cfg.pourMs;
    emit('tea', { w, kind, ms: cfg.pourMs });
    guideCheck();
    return { ok: true, w };
  }
  function addTopping(kind) {
    if (!menuToppings().includes(kind)) return fail('locked');
    const w = target();
    if (w == null) return fail('noCup', { station: kind });
    const cup = s.work[w];
    if (cup.toppings.length >= MAX_TOPPINGS) return fail('full', { w });
    if (kind === 'pearl') {
      if (s.pot.scoops <= 0) return fail('potEmpty');
      s.pot.scoops -= 1;
    }
    cup.toppings.push(kind);
    emit('topping', { w, kind, scoops: s.pot.scoops });
    if (kind === 'pearl' && s.pot.scoops === 0) emit('potEmpty', {});
    guideCheck();
    return { ok: true, w };
  }
  function tapLevel(field, on) {
    if (!on) return fail('locked');
    const w = target();
    if (w == null) return fail('noCup', { station: field });
    const cup = s.work[w];
    cup[field] = (cup[field] + 1) % 3; // 0 → 1 → 2 → 0 (a third tap fixes an extra one)
    emit(field, { w, level: cup[field] });
    return { ok: true, w, level: cup[field] };
  }
  const tapIce = () => tapLevel('ice', def.ice);
  const tapSugar = () => tapLevel('sugar', def.sugar);
  function seal(w) {
    const cup = s.work[w];
    if (!editable(cup)) return fail(cup && cup.sealed ? 'sealed' : 'noCup');
    if (!cup.tea) return fail('noTea', { w });
    if (s.t < cup.pourUntil) return fail('pouring', { w });
    if (s.work.some((c) => c && c.sealingUntil && !c.sealed)) return fail('sealerBusy', { w });
    cup.sealingUntil = s.t + cfg.sealMs;
    if (s.selected === w) s.selected = null;
    emit('sealStart', { w, ms: cfg.sealMs });
    return { ok: true, w };
  }
  function trash(w) {
    if (!s.work[w]) return fail('noCup');
    s.work[w] = null;
    if (s.selected === w) s.selected = null;
    s.earned -= CUP_COST;
    s.stats.trashed += 1;
    emit('trash', { w, cost: CUP_COST });
    return { ok: true };
  }
  function cook() {
    if (s.pot.cookingUntil) return fail('cooking');
    if (s.pot.scoops >= s.pot.max) return fail('potFull');
    s.pot.cookingUntil = s.t + cfg.cookMs;
    emit('cookStart', { ms: cfg.cookMs });
    return { ok: true };
  }

  function serve(w, slot) {
    const cup = s.work[w];
    const c = s.slots[slot];
    if (!cup || !cup.sealed) return fail('notSealed', { w });
    if (!c) return fail('noCustomer');
    if (c.kind === 'oke' && !c.converted) {
      s.stats.refused += 1;
      emit('refuse', { w, slot, cust: c });
      return { ok: false, reason: 'oke' };
    }
    const correct = sameDrink(cup, c.order);
    const frac = Number.isFinite(c.patienceMax) ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
    const price = orderPrice(c.order) * priceMult(s.stars) * (c.doublePay ? 2 : 1);
    const pay = Math.round(correct ? price : price / 2);
    const tip = correct ? Math.round(price * TIP_SHARE * frac) : 0;
    s.work[w] = null;
    if (s.selected === w) s.selected = null;
    s.earned += pay + tip;
    s.tips += tip;
    s.stats.served += 1;
    if (correct) s.stats.correct += 1; else s.stats.wrong += 1;
    c.delivered += 1;
    let fameD = 0;
    if (correct) fameD = addFame(frac > 0.6 ? FAME.serveFast : FAME.serve, 'serve');
    emit('serve', { w, slot, correct, pay, tip, fame: fameD, cust: c, frac });
    if (c.delivered >= c.order.count) leave(slot, correct ? 'served' : 'wrong');
    guideCheck();
    return { ok: true, correct, pay, tip };
  }

  function answer(slot, key) {
    const c = s.slots[slot];
    if (!c || !['gun', 'shut', 'take'].includes(key)) return { ok: false, reason: 'noCustomer' };
    if (c.kind === 'oke' && !c.converted) {
      const o = okeOf(c.oke);
      const best = key === o.best;
      s.stats.oke[key] += 1;
      if (best) s.stats.okeBest += 1;
      const fameD = addFame(best ? FAME.okeBest : FAME.oke, 'oke');
      let prepay = 0;
      const also = [];
      if (key === 'gun') {
        leave(slot, 'gun', { oke: c.oke, best });
        if (cfg.megaphone) {
          s.slots.forEach((x, i) => {
            if (x && x.kind === 'oke' && !x.converted) {
              s.stats.oke.gun += 1;
              addFame(FAME.oke, 'oke');
              also.push(i);
              leave(i, 'gun', { oke: x.oke, best: false, megaphone: true });
            }
          });
        }
        addFans(best ? FANS.best : FANS.oke);
      } else if (key === 'shut') {
        c.converted = true;
        c.doublePay = true;
        c.order = genOrder({ single: true });
        c.patience = c.patienceMax = def.patienceMs;
      } else {
        prepay = Math.round(o.prepay * cfg.prepayMult * (best ? 1 : 0.5));
        s.earned += prepay;
        s.stats.prepay += prepay;
        leave(slot, 'take', { oke: c.oke, best, prepay });
        addFans(best ? FANS.oke : 0);
      }
      emit('answer', { slot, key, best, oke: c.oke, cid: c.cid, fame: fameD, prepay, also, cust: c });
      guideCheck(c.uid);
      return { ok: true, best, fame: fameD, prepay, oke: c.oke };
    }
    // everyone can be cursed: a normal customer leaves without paying, the shop still gets a little famous
    s.stats.normalCursed += 1;
    const fameD = addFame(FAME.normalCurse, 'curse');
    leave(slot, key, { normal: true });
    addFans(FANS.normal);
    emit('answer', { slot, key, best: false, oke: null, cid: c.cid, fame: fameD, prepay: 0, also: [], cust: c, normal: true });
    guideCheck(c.uid);
    return { ok: true, best: false, fame: fameD, prepay: 0, oke: null };
  }

  // ---- day 1 hands-on guide (spec 8: a new player makes a drink and curses a 奧客 inside a minute) ----
  function guideStart() {
    const c = normalCust({ tea: def.teas[0], toppings: [def.toppings[0]], ice: 0, sugar: 0, count: 1 });
    c.patience = c.patienceMax = Infinity;
    s.guide.custUid = c.uid;
    seat(Math.min(1, s.slots.length - 1), c);
    emit('guide', { step: GUIDE_STEPS[0], i: 0 });
  }
  function guideCheck(answeredUid) {
    const g = s.guide;
    if (!g || s.phase !== 'guide') return;
    const before = g.step;
    for (;;) {
      const step = GUIDE_STEPS[g.step];
      const cups = s.work.filter(Boolean);
      let done = false;
      if (step === 'cup') done = cups.length > 0 || findSlot(g.custUid) < 0;
      else if (step === 'tea') done = cups.some((c) => c.tea) || findSlot(g.custUid) < 0;
      else if (step === 'topping') done = cups.some((c) => c.toppings.length) || findSlot(g.custUid) < 0;
      else if (step === 'seal') done = cups.some((c) => c.sealed) || findSlot(g.custUid) < 0;
      else if (step === 'serve') {
        done = findSlot(g.custUid) < 0;
        if (done) g.okeAt = s.t + 900;
      } else if (step === 'oke') done = g.okeUid != null && answeredUid === g.okeUid;
      if (!done) break;
      g.step += 1;
      if (g.step >= GUIDE_STEPS.length) {
        s.phase = 'open';
        s.guide = { ...g, done: true };
        s.nextArrival = 1200;
        emit('guideDone', {});
        emit('open', { day: def.n });
        return;
      }
    }
    if (g.step !== before) emit('guide', { step: GUIDE_STEPS[g.step], i: g.step });
  }

  // ---- time ----
  function closeDay() {
    s.phase = 'closed';
    s.slots.forEach((c, i) => { if (c) leave(i, 'close'); });
    s.queue.length = 0;
    emit('close', { summary: summary() });
  }

  function tick(dt) {
    if (s.phase === 'closed' || !(dt > 0)) return;
    s.t += dt;
    for (let w = 0; w < s.work.length; w++) {
      const cup = s.work[w];
      if (cup && cup.sealingUntil && !cup.sealed && s.t >= cup.sealingUntil) {
        cup.sealed = true;
        emit('sealed', { w });
        guideCheck();
      }
    }
    if (s.pot.cookingUntil && s.t >= s.pot.cookingUntil) {
      s.pot.cookingUntil = 0;
      s.pot.scoops = s.pot.max;
      emit('cooked', { scoops: s.pot.scoops });
    }
    if (s.phase === 'guide') {
      const g = s.guide;
      if (g.custUid == null) guideStart();
      if (GUIDE_STEPS[g.step] === 'oke' && g.okeUid == null && s.t >= g.okeAt) {
        const free = s.slots.findIndex((c, i) => !c && s.t >= s.vacantUntil[i]);
        if (free >= 0) {
          const o = okeCust(def.newOke && def.newOke.includes('one') ? 'one' : (def.newOke || ['one'])[0]);
          g.okeUid = o.uid;
          if (!s.okeSeen.includes(o.oke)) s.okeSeen.push(o.oke);
          seat(free, o);
        }
      }
      return;
    }
    // open
    s.clock += dt;
    for (const sc of def.script || []) {
      if (!s.scriptDone.includes(sc.at) && s.clock >= sc.at) {
        s.scriptDone.push(sc.at);
        enqueue(okeCust(sc.oke), { front: true });
      }
    }
    s.nextArrival -= dt;
    if (s.nextArrival <= 0) {
      arrive();
      s.nextArrival += arrivalGap(def, s.stars) * (0.6 + rnd() * 0.8);
    }
    for (let i = 0; i < s.slots.length; i++) {
      if (!s.slots[i] && s.t >= s.vacantUntil[i] && s.queue.length) seat(i, s.queue.shift());
    }
    const drain = 1 + OKE_DRAIN * angryOke();
    for (let i = 0; i < s.slots.length; i++) {
      const c = s.slots[i];
      if (!c) continue;
      if (c.kind === 'oke' && !c.converted) {
        if (s.t >= c.nagAt) { c.nagAt = s.t + NAG_MS; emit('nag', { slot: i, cust: c }); }
        continue;
      }
      c.patience -= dt * (c.kind === 'oke' ? 1 : drain);
      if (c.patience <= 0) {
        s.stats.walkouts += 1;
        addFame(FAME.walkout, 'walkout');
        leave(i, 'timeout');
      }
    }
    if (s.clock >= s.length) closeDay();
  }

  function summary() {
    return {
      day: def.n, goal: def.goal, earned: Math.round(s.earned), tips: s.tips, met: s.earned >= def.goal,
      served: s.stats.served, correct: s.stats.correct, wrong: s.stats.wrong, walkouts: s.stats.walkouts,
      okeCursed: s.stats.oke.gun + s.stats.oke.shut + s.stats.oke.take, okeGun: s.stats.oke.gun,
      okeShut: s.stats.oke.shut, okeTake: s.stats.oke.take, okeBest: s.stats.okeBest, normalCursed: s.stats.normalCursed,
      prepay: s.stats.prepay, trashed: s.stats.trashed, fans: s.stats.fans,
      fameStart: s.fameStart, fame: s.fame, starsStart: s.starsStart, stars: s.stars,
    };
  }

  return {
    state: s,
    get def() { return def; },
    get cfg() { return cfg; },
    tick, takeCup, select, addTea, addTopping, tapIce, tapSugar, seal, serve, trash, cook, answer, summary,
    /** Shut the shop now (pause sheet "close up", tests). */
    close() { if (s.phase !== 'closed') closeDay(); },
    drain() { return events.splice(0, events.length); },
    /** The cup the stations act on right now (null = none). */
    get target() { return target(); },
  };
}
