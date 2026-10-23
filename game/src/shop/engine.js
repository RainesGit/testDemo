// engine.js — gameplay v3 shop logic (docs/gameplay-v3-shop.md 3–5 and 10): pure, no DOM, no real clock.
// The caller advances time with tick(dt) and calls the actions; everything that happened is queued as events
// (drain()) for the UI and audio. tools/shop-sim.mjs and test/shop-*.test.mjs drive it headless.
//
// Customers walk in (10.2): a customer spawns behind the far street corner (world position u = SPAWN_U; u is the
// distance along the sidewalk, 0 = the shop door, 1 = the far corner), walks (fans run) toward their spot in the
// line (spot k at u = k × SPOT), stands there ('queued'), and when the person at the head of the line is at the
// door and a counter spot is free, steps up to it (STEP_MS, s.incoming[i]) and only then is seated (s.slots[i],
// patience starts). Rendering maps u to the screen (layout.js) and interpolates the step.
//   customer.phase: 'walk' → 'queued' → 'step' → 'counter'; customer.u, spawnT, queuedT, counterT
//
//   createShop({ day, fame, upgrades, seed, guide }) → shop
//     state            the live state (read-only by convention): see the object `s` below
//     tick(dt)         advance dt ms: timers (pour, sealers, pearl pot, helper), walking, arrivals, patience, the day's end
//     takeCup()                       a new empty cup on the first free work slot (it becomes the selected cup)
//     select(w)                       the cup the stations act on
//     addTea(kind) / addTopping(kind) / tapIce() / tapSugar()     act on the selected cup (or the first editable one)
//     seal(w, { toShelf })  drag cup w to a sealer (needs tea, the pour done, a free sealer); toShelf with the auto
//                      sealer (seal4): the cup goes to a free shelf spot and seals itself there
//     serve(w, slot) / serveShelf(i, slot)   a sealed cup to the customer in slot: one cup of the order (ticked);
//                      the customer pays when every cup is in (a wrong cup: half price, no tip, a complaint)
//     trash(w) / trashShelf(i)        drop a cup in the bin (costs CUP_COST)
//     cook()           start a fresh pot of pearls
//     answer(slot, key)  a gesture on a customer: 'gun' 滾 (swipe) | 'shut' 閉嘴 (3 taps) | 'take' 收 (hold)
//     drain() → events[]   { type, ... } (see emit() calls), oldest first
//     summary() → the day's receipt
//   Exported helpers: starsOf, priceMult, arrivalGap, orderPrice, itemPrice, sameDrink, queueCap, keyTarget, patienceFor,
//   FAME_STARS, PRICE, FANS, QUEUE_CAP, SPOT, SPAWN_U, WALK_MS, STEP_MS ...
import { fnv1a, mulberry32 } from '../art.js';
import { dayDef } from './days.js';
import { applyUpgrades } from './upgrades.js';
import { OKE_CIDS, okeOf, okePool } from './oke.js';

export const TEAS = ['black', 'green', 'jade'];
export const TOPPINGS = ['pearl', 'coconut', 'pudding', 'grass'];
export const PRICE = { black: 30, green: 30, jade: 40, pearl: 10, coconut: 15, pudding: 15, grass: 10 };
export const GOLDEN = { tea: 'jade', toppings: ['coconut', 'pudding'], ice: 0, sugar: 0, golden: true }; // 黃金比例特調
export const GOLDEN_PRICE = 150;
export const GOLDEN_SHARE = 0.15;    // share of drinks that are the golden recipe once it is on the menu (needs 翡翠 + 布丁)
export const BIG_CUPS = 4;
export const BIG_PAY = 1.3;          // a big order pays 30% more per cup
export const CUP_COST = 5;
export const MAX_TOPPINGS = 3;
export const FAME_STARS = [0, 120, 300, 600, 1000]; // fame points for ★1 … ★5
export const FAME = { okeBest: 30, oke: 15, normalCurse: 4, serveFast: 2, serve: 1, walkout: -5 };
/** People who come running after a curse (10.3): [min, max] per kind of answer; a star-up brings a wave. */
export const FANS = { best: [4, 5], oke: [2, 3], normal: [1, 1], star: [7, 8] };
export const QUEUE_CAP = [6, 8, 11, 13, 16]; // people waiting outside at ★1 … ★5 (plus the stanchions)
export const FAN_OVER = 4;           // fans may push the line this far past the cap (it runs round the corner)
export const SPOT = 0.065;           // world distance between two people in the line
export const SPAWN_U = 1.15;         // customers appear behind the far corner
export const WALK_MS = 3200;         // ms to walk one world unit (corner → door); 3.7 s from where they appear
export const RUN_MULT = 2.3;         // fans run
export const CUT_MULT = 1.5;         // the cut-in customer hurries past the line
export const STEP_MS = 900;          // from the door to a counter spot
export const SLOT_VACANT_MS = 700;   // a counter spot stays empty this long (the exit animation) before the next customer
export const NAG_MS = 7000;          // an unanswered 奧客 complains again every NAG_MS
export const OKE_DRAIN = 0.5;        // each unanswered 奧客 makes everyone else lose patience 50% faster
export const PATIENCE_PER_CUP = 0.45; // each extra cup of an order adds 45% patience
export const TIP_SHARE = 0.5;        // a perfect, instant serve tips 50% of the price
export const GUIDE_STEPS = ['cup', 'tea', 'topping', 'seal', 'serve', 'oke'];

export function starsOf(fame) {
  let s = 1;
  for (let i = 1; i < FAME_STARS.length; i++) if (fame >= FAME_STARS[i]) s = i + 1;
  return s;
}
const clampStars = (stars) => Math.max(1, Math.min(5, Math.round(stars) || 1));
/** ★1 ×1.0 → ★5 ×2.0 (spec 4.3). */
export const priceMult = (stars) => 1 + (clampStars(stars) - 1) * 0.25;
/** Mean gap between arrivals: fame brings people in faster (★5 = 1.6× the arrivals of ★1). */
export const arrivalGap = (def, stars) => def.arriveMs / (1 + 0.15 * (clampStars(stars) - 1));
/** People waiting outside at most (natural arrivals; fans may add FAN_OVER more). */
export const queueCap = (stars, bonus = 0) => QUEUE_CAP[clampStars(stars) - 1] + (bonus | 0);
export const itemPrice = (item) => (item && item.golden ? GOLDEN_PRICE
  : (PRICE[item && item.tea] || 0) + ((item && item.toppings) || []).reduce((a, k) => a + (PRICE[k] || 0), 0));
/** Base price of a whole order ({ items }) or of one drink. */
export const orderPrice = (order) => (order && Array.isArray(order.items) ? order.items.reduce((a, it) => a + itemPrice(it), 0) : itemPrice(order));
export const patienceFor = (def, cups, cfg = {}) => def.patienceMs * (1 + PATIENCE_PER_CUP * (Math.max(1, cups) - 1)) * (cfg.patienceMult || 1);
const sortKey = (arr) => [...(arr || [])].sort().join(',');
export const drinkKey = (d) => (d ? `${d.tea}|${sortKey(d.toppings)}|${d.ice | 0}|${d.sugar | 0}` : '');
export function sameDrink(cup, item) {
  return !!cup && !!item && cup.tea === item.tea && sortKey(cup.toppings) === sortKey(item.toppings) &&
    (cup.ice | 0) === (item.ice | 0) && (cup.sugar | 0) === (item.sugar | 0);
}
const wantsCups = (c) => !!c && !!c.order && (c.kind === 'normal' || c.converted);
/** Keyboard J/K/L target: the leftmost unanswered 奧客 at the counter, else the leftmost customer; -1 = nobody. */
export function keyTarget(state) {
  const slots = (state && state.slots) || [];
  const oke = slots.findIndex((c) => c && c.kind === 'oke' && !c.converted);
  return oke >= 0 ? oke : slots.findIndex(Boolean);
}

export function createShop({ day = 1, fame = 0, upgrades = [], seed = 1, guide = false, def: defIn } = {}) {
  const def = defIn || dayDef(day);
  const cfg = applyUpgrades(upgrades);
  const rnd = mulberry32(fnv1a(`shop:${def.n}:${seed}`));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const range = ([a, b]) => a + Math.floor(rnd() * (b - a + 1));
  let uid = 0;
  let cupId = 0;
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
    slots: Array(cfg.seats).fill(null),       // customers at the counter
    incoming: Array(cfg.seats).fill(null),    // { c, t0, until }: stepping up from the door to that spot
    vacantUntil: Array(cfg.seats).fill(0),
    queue: [],                                // everyone outside, in line order (walking or standing)
    work: Array(cfg.workSlots).fill(null),
    shelf: Array(cfg.shelf).fill(null),
    selected: null,
    pot: { scoops: cfg.potMax, max: cfg.potMax, cookingUntil: 0 },
    helper: cfg.helperMs ? { item: null, until: 0, idleUntil: 0 } : null,
    nextArrival: 300,
    scriptDone: [],
    okeSeen: [],
    guide: guide ? { step: 0, custUid: null, custSeated: false, okeAt: 0, okeUid: null } : null,
    stats: { served: 0, correct: 0, wrong: 0, walkouts: 0, refused: 0, trashed: 0, prepay: 0, orders: 0, bigOrders: 0,
      golden: 0, helperCups: 0, oke: { gun: 0, shut: 0, take: 0 }, okeBest: 0, normalCursed: 0, fans: 0, maxQueue: 0, spawned: 0 },
  };

  // ---- orders ----
  const menuToppings = () => def.toppings.concat(cfg.coconut ? ['coconut'] : []);
  const goldenOn = () => cfg.golden && def.teas.includes('jade') && def.toppings.includes('pudding') && menuToppings().includes('coconut');
  function genItem() {
    if (goldenOn() && rnd() < GOLDEN_SHARE) return { ...GOLDEN, toppings: [...GOLDEN.toppings] };
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
    return { tea, toppings, ice, sugar };
  }
  function genOrder({ single = false } = {}) {
    let count = 1;
    let big = false;
    if (!single) {
      const r = rnd();
      const [p2, p3] = def.cups || [0, 0];
      if (def.bigShare && r < def.bigShare) { count = BIG_CUPS; big = true; }
      else if (r < (def.bigShare || 0) + p3) count = 3;
      else if (r < (def.bigShare || 0) + p3 + p2) count = 2;
    }
    const items = Array.from({ length: count }, genItem);
    return { items, count, big };
  }
  function custBase(kind, cid, order) {
    const pm = order ? patienceFor(def, order.count, cfg) : 1;
    return { uid: ++uid, kind, cid, visit: kind === 'normal' ? uid : 0, order, got: order ? order.items.map(() => false) : [],
      bill: 0, tipBill: 0, wrongCups: 0, patience: pm, patienceMax: pm, oke: null, converted: false, doublePay: false,
      phase: 'walk', u: SPAWN_U, speed: 1 / WALK_MS, run: false, cut: false, fan: false, spawnT: s.t, queuedT: 0, counterT: 0 };
  }
  function normalCust(order) {
    let cid = 1 + Math.floor(rnd() * 100);
    while (OKE_CIDS.has(cid)) cid = 1 + Math.floor(rnd() * 100);
    return custBase('normal', cid, order || genOrder());
  }
  function okeCust(type) {
    const o = okeOf(type);
    return { ...custBase('oke', o.cid, null), oke: type, nagAt: 0 };
  }
  function pickOke() {
    const scripted = new Set((def.script || []).map((x) => x.oke)); // scripted 奧客 come once, on cue
    const fresh = (def.newOke || []).filter((t) => !s.okeSeen.includes(t) && !scripted.has(t));
    if (fresh.length) return pick(fresh);
    const pool = okePool(def.n).filter((t) => !scripted.has(t));
    return pool.length ? pick(pool) : null;
  }

  // ---- the street: spawn, walk, line, step up ----
  function spawn(c, { front = false, run = false, fan = false, u = SPAWN_U } = {}) {
    c.u = u;
    c.spawnT = s.t;
    c.run = run;
    c.fan = fan;
    c.cut = front;
    c.speed = (run ? RUN_MULT : front ? CUT_MULT : 1) / WALK_MS;
    c.phase = 'walk';
    if (front) s.queue.unshift(c); else s.queue.push(c);
    if (c.oke && !s.okeSeen.includes(c.oke)) s.okeSeen.push(c.oke);
    s.stats.spawned += 1;
    s.stats.maxQueue = Math.max(s.stats.maxQueue, s.queue.length);
    emit('spawn', { cust: c, n: s.queue.length });
    return c;
  }
  function arrive() {
    if (s.queue.length >= queueCap(s.stars, cfg.queueBonus)) return;
    if (rnd() < def.okeShare) {
      const type = pickOke();
      if (type) { spawn(okeCust(type), { front: !!okeOf(type).cutsIn }); return; }
    }
    spawn(normalCust());
  }
  function addFans(n, why = 'curse') {
    const cap = queueCap(s.stars, cfg.queueBonus) + FAN_OVER;
    const uids = [];
    for (let k = 0; k < n && s.queue.length < cap; k++) {
      const c = spawn(normalCust(), { run: true, fan: true, u: SPAWN_U + k * 0.06 });
      uids.push(c.uid);
    }
    s.stats.fans += uids.length;
    if (uids.length) emit('fans', { n: uids.length, uids, why, queue: s.queue.length });
    return uids.length;
  }
  function walk(dt) {
    for (let k = 0; k < s.queue.length; k++) {
      const c = s.queue[k];
      const target = k * SPOT;
      if (c.u > target) c.u = Math.max(target, c.u - c.speed * dt);
      if (c.phase === 'walk' && c.u <= target + 1e-9) {
        c.phase = 'queued';
        c.queuedT = s.t;
        c.run = false;
        c.cut = false;
        emit('queued', { cust: c, k });
      }
    }
  }
  function canStepUp(c) {
    if (!c || c.u > 1e-9) return false;
    if (s.phase !== 'guide') return true;
    const g = s.guide;
    return c.uid === g.custUid || GUIDE_STEPS[g.step] === 'oke'; // (a fan cursed in during the guide goes first)
  }
  function stepUps() {
    for (let i = 0; i < s.slots.length; i++) {
      if (s.slots[i] || s.incoming[i] || s.t < s.vacantUntil[i]) continue;
      if (!canStepUp(s.queue[0])) break;
      const c = s.queue.shift();
      c.phase = 'step';
      s.incoming[i] = { c, t0: s.t, until: s.t + STEP_MS };
      emit('step', { slot: i, cust: c });
    }
    for (let i = 0; i < s.incoming.length; i++) {
      const inc = s.incoming[i];
      if (inc && s.t >= inc.until) { s.incoming[i] = null; seat(i, inc.c); }
    }
  }
  function seat(i, c) {
    s.slots[i] = c;
    c.phase = 'counter';
    c.counterT = s.t;
    c.seatedAt = s.t;
    if (c.kind === 'oke') c.nagAt = s.t + NAG_MS;
    if (s.guide && c.uid === s.guide.custUid) s.guide.custSeated = true;
    emit('arrive', { slot: i, cust: c });
  }
  function leave(i, reason, extra = {}) {
    const c = s.slots[i];
    if (!c) return;
    s.slots[i] = null;
    c.phase = 'gone';
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
    if (s.stars > before) { emit('star', { stars: s.stars }); addFans(range(FANS.star), 'star'); }
    return v;
  }

  // ---- cups ----
  const newCup = () => ({ id: ++cupId, tea: null, toppings: [], ice: 0, sugar: 0, sealed: false, pourUntil: 0, sealingUntil: 0, sealer: -1 });
  const editable = (cup) => !!cup && !cup.sealed && !cup.sealingUntil;
  function target() {
    if (s.selected != null && editable(s.work[s.selected])) return s.selected;
    const i = s.work.findIndex(editable);
    return i < 0 ? null : i;
  }
  const fail = (reason, data = {}) => { emit('nope', { reason, ...data }); return { ok: false, reason }; };
  const sealingNow = () => s.work.filter((c) => c && c.sealingUntil && !c.sealed && c.sealer >= 0);

  function takeCup() {
    if (s.phase === 'closed') return fail('closed');
    const w = s.work.findIndex((c) => !c);
    if (w < 0) return fail('noSlot');
    s.work[w] = newCup();
    s.selected = w;
    emit('cup', { w, id: s.work[w].id });
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
    if (cup.tea && !cfg.teaAll) return fail('hasTea', { w });
    // the manifold (tea3): one tap fills every cup that has no tea yet
    const list = cfg.teaAll ? s.work.map((c, i) => i).filter((i) => editable(s.work[i]) && !s.work[i].tea) : [w];
    if (!list.length) return fail('hasTea', { w });
    for (const i of list) {
      s.work[i].tea = kind;
      s.work[i].pourUntil = s.t + cfg.pourMs;
      emit('tea', { w: i, kind, ms: cfg.pourMs, all: list.length > 1 });
    }
    guideCheck();
    return { ok: true, w: list[0], n: list.length };
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
    if (kind === 'pearl' && s.pot.scoops === 0) { emit('potEmpty', {}); if (cfg.autoCook) cook(true); }
    guideCheck();
    return { ok: true, w };
  }
  /** Pending drinks at the counter (not yet delivered), as items with their customer. */
  function pendingItems() {
    const out = [];
    s.slots.forEach((c, slot) => { if (wantsCups(c)) c.order.items.forEach((it, k) => { if (!c.got[k]) out.push({ it, slot, k }); }); });
    return out;
  }
  function tapLevel(field, on) {
    if (!on) return fail('locked');
    const w = target();
    if (w == null) return fail('noCup', { station: field });
    const cup = s.work[w];
    let level = (cup[field] + 1) % 3; // 0 → 1 → 2 → 0 (a third tap fixes an extra one)
    if (field === 'ice' && cfg.iceSmart) {
      // the ice dispenser (ice2): one tap gives the ice level of the first waiting drink that matches the cup so far
      const m = pendingItems().find(({ it }) => (!cup.tea || it.tea === cup.tea) && sortKey(it.toppings) === sortKey(cup.toppings) && (it.ice | 0) !== cup.ice)
        || pendingItems().find(({ it }) => (!cup.tea || it.tea === cup.tea) && (it.ice | 0) !== cup.ice);
      if (m) level = m.it.ice | 0;
    }
    cup[field] = level;
    emit(field, { w, level });
    return { ok: true, w, level };
  }
  const tapIce = () => tapLevel('ice', def.ice);
  const tapSugar = () => tapLevel('sugar', def.sugar);
  function seal(w, { toShelf = false } = {}) {
    const cup = s.work[w];
    if (!editable(cup)) return fail(cup && cup.sealed ? 'sealed' : 'noCup');
    if (!cup.tea) return fail('noTea', { w });
    if (s.t < cup.pourUntil) return fail('pouring', { w });
    if (toShelf) {
      if (!cfg.autoSeal) return fail('noAutoSeal', { w });
      const i = s.shelf.findIndex((x) => !x);
      if (i < 0) return fail('shelfFull', { w });
      s.work[w] = null;
      if (s.selected === w) s.selected = null;
      cup.sealingUntil = s.t + cfg.sealMs;
      s.shelf[i] = cup;
      emit('sealStart', { w, i, shelf: true, ms: cfg.sealMs, id: cup.id });
      return { ok: true, w, i };
    }
    const busy = sealingNow();
    if (busy.length >= cfg.sealers) return fail('sealerBusy', { w });
    const used = new Set(busy.map((c) => c.sealer));
    cup.sealer = [0, 1].find((k) => !used.has(k));
    cup.sealingUntil = s.t + cfg.sealMs;
    if (s.selected === w) s.selected = null;
    emit('sealStart', { w, sealer: cup.sealer, ms: cfg.sealMs, id: cup.id });
    return { ok: true, w, sealer: cup.sealer };
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
  function trashShelf(i) {
    if (!s.shelf[i]) return fail('noCup');
    s.shelf[i] = null;
    s.earned -= CUP_COST;
    s.stats.trashed += 1;
    emit('trash', { shelf: i, cost: CUP_COST });
    return { ok: true };
  }
  function cook(auto = false) {
    if (s.pot.cookingUntil) return fail('cooking');
    if (s.pot.scoops >= s.pot.max) return fail('potFull');
    s.pot.cookingUntil = s.t + cfg.cookMs;
    emit('cookStart', { ms: cfg.cookMs, auto: !!auto });
    return { ok: true };
  }
  function shelve() {
    // sealed cups move from their work slot to the shelf by themselves (10.4); the slot is free again
    for (let w = 0; w < s.work.length; w++) {
      const cup = s.work[w];
      if (!cup || !cup.sealed) continue;
      const i = s.shelf.findIndex((x) => !x);
      if (i < 0) return;
      s.work[w] = null;
      if (s.selected === w) s.selected = null;
      cup.sealer = -1;
      s.shelf[i] = cup;
      emit('shelve', { w, i, id: cup.id });
    }
  }

  function serveCup(cup, slot, remove, from) {
    const c = s.slots[slot];
    if (!cup || !cup.sealed) return fail('notSealed', from);
    if (!c) return fail('noCustomer');
    if (c.kind === 'oke' && !c.converted) {
      s.stats.refused += 1;
      emit('refuse', { ...from, slot, cust: c });
      return { ok: false, reason: 'oke' };
    }
    let k = c.order.items.findIndex((it, j) => !c.got[j] && sameDrink(cup, it));
    const correct = k >= 0;
    if (!correct) k = c.got.findIndex((g) => !g);
    if (k < 0) return fail('noNeed', from);
    const item = c.order.items[k];
    const frac = Number.isFinite(c.patienceMax) ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
    const price = itemPrice(item) * priceMult(s.stars) * (c.doublePay ? 2 : 1) * (c.order.big ? BIG_PAY : 1);
    const pay = Math.round(correct ? price : price / 2);
    const tip = correct ? Math.round(price * TIP_SHARE * frac * cfg.tipMult) : 0;
    remove();
    c.got[k] = true;
    c.bill += pay;
    c.tipBill += tip;
    if (!correct) c.wrongCups += 1;
    s.stats.served += 1;
    if (correct) s.stats.correct += 1; else s.stats.wrong += 1;
    if (correct && item.golden) s.stats.golden += 1;
    let fameD = 0;
    if (correct) fameD = addFame(frac > 0.6 ? FAME.serveFast : FAME.serve, 'serve');
    const done = c.got.every(Boolean);
    emit('serve', { ...from, slot, k, correct, golden: !!item.golden, fame: fameD, cust: c, frac, done, pay, tip });
    if (done) {
      s.earned += c.bill + c.tipBill;
      s.tips += c.tipBill;
      s.stats.orders += 1;
      if (c.order.big) s.stats.bigOrders += 1;
      emit('pay', { slot, pay: c.bill, tip: c.tipBill, cust: c, wrong: c.wrongCups });
      leave(slot, c.wrongCups ? 'wrong' : 'served', { pay: c.bill, tip: c.tipBill });
    }
    guideCheck();
    return { ok: true, correct, pay: done ? c.bill : 0, tip: done ? c.tipBill : 0, done, k };
  }
  const serve = (w, slot) => serveCup(s.work[w], slot, () => { s.work[w] = null; if (s.selected === w) s.selected = null; }, { w });
  const serveShelf = (i, slot) => serveCup(s.shelf[i], slot, () => { s.shelf[i] = null; }, { shelf: i });

  // ---- the part-timer (staff1/2): slowly makes the most wanted pending drink and puts it on the shelf ----
  function helperTick() {
    const h = s.helper;
    if (!h) return;
    if (h.item) {
      if (s.t < h.until) return;
      const i = s.shelf.findIndex((x) => !x);
      if (i < 0) return; // waits with the cup until there is room
      const cup = { ...newCup(), tea: h.item.tea, toppings: [...h.item.toppings], ice: h.item.ice | 0, sugar: h.item.sugar | 0, sealed: true };
      s.shelf[i] = cup;
      s.stats.helperCups += 1;
      emit('helperCup', { i, id: cup.id });
      h.item = null;
      h.idleUntil = s.t + 300;
      return;
    }
    if (s.t < h.idleUntil || s.phase !== 'open') return;
    if (!s.shelf.some((x) => !x)) return;
    // count what is wanted and not covered yet by a cup on the table, on the shelf or in the helper's hands
    const want = new Map();
    for (const { it } of pendingItems()) { const k = drinkKey(it); want.set(k, { it, n: (want.get(k)?.n || 0) + 1 }); }
    const have = [...s.work, ...s.shelf].filter(Boolean);
    for (const cup of have) { const k = drinkKey(cup); if (want.has(k)) want.get(k).n -= 1; }
    let best = null;
    for (const v of want.values()) if (v.n > 0 && (!best || v.n > best.n)) best = v;
    if (!best) { h.idleUntil = s.t + 400; return; }
    const pearls = best.it.toppings.filter((k) => k === 'pearl').length;
    if (pearls > s.pot.scoops) { h.idleUntil = s.t + 400; if (cfg.autoCook && !s.pot.cookingUntil) cook(true); return; }
    s.pot.scoops -= pearls;
    if (pearls && s.pot.scoops === 0) { emit('potEmpty', {}); if (cfg.autoCook) cook(true); }
    h.item = { ...best.it, toppings: [...best.it.toppings] };
    h.until = s.t + cfg.helperMs;
    emit('helperStart', { item: h.item, ms: cfg.helperMs });
  }

  // ---- answers ----
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
      } else if (key === 'shut') {
        c.converted = true;
        c.doublePay = true;
        c.order = genOrder({ single: true });
        c.got = [false];
        c.patience = c.patienceMax = patienceFor(def, 1, cfg);
      } else {
        prepay = Math.round(o.prepay * cfg.prepayMult * (best ? 1 : 0.5));
        s.earned += prepay;
        s.stats.prepay += prepay;
        leave(slot, 'take', { oke: c.oke, best, prepay });
      }
      const fans = addFans(range(best ? FANS.best : FANS.oke) + also.length);
      emit('answer', { slot, key, best, oke: c.oke, cid: c.cid, fame: fameD, prepay, also, cust: c, fans });
      guideCheck(c.uid);
      return { ok: true, best, fame: fameD, prepay, oke: c.oke, fans };
    }
    // everyone can be cursed: a normal customer leaves without paying, the shop still gets a little famous
    s.stats.normalCursed += 1;
    const fameD = addFame(FAME.normalCurse, 'curse');
    leave(slot, key, { normal: true });
    const fans = addFans(range(FANS.normal));
    emit('answer', { slot, key, best: false, oke: null, cid: c.cid, fame: fameD, prepay: 0, also: [], cust: c, normal: true, fans });
    guideCheck(c.uid);
    return { ok: true, best: false, fame: fameD, prepay: 0, oke: null, fans };
  }

  // ---- day 1 hands-on guide (spec 8: a new player makes a drink and curses a 奧客 inside a minute) ----
  function guideStart() {
    const c = normalCust({ items: [{ tea: def.teas[0], toppings: [def.toppings[0]], ice: 0, sugar: 0 }], count: 1, big: false });
    c.patience = c.patienceMax = Infinity;
    s.guide.custUid = c.uid;
    spawn(c, { u: 0.6 });
    emit('guide', { step: GUIDE_STEPS[0], i: 0 });
  }
  function guideCheck(answeredUid) {
    const g = s.guide;
    if (!g || s.phase !== 'guide') return;
    const before = g.step;
    for (;;) {
      const step = GUIDE_STEPS[g.step];
      const cups = [...s.work, ...s.shelf].filter(Boolean);
      const gone = g.custSeated && findSlot(g.custUid) < 0;
      let done = false;
      if (step === 'cup') done = cups.length > 0 || gone;
      else if (step === 'tea') done = cups.some((c) => c.tea) || gone;
      else if (step === 'topping') done = cups.some((c) => c.toppings.length) || gone;
      else if (step === 'seal') done = cups.some((c) => c.sealed) || gone;
      else if (step === 'serve') done = gone;
      else if (step === 'oke') done = g.okeUid != null && answeredUid === g.okeUid;
      if (!done) break;
      g.step += 1;
      if (GUIDE_STEPS[g.step] === 'serve' && g.okeUid == null) {
        // the first 奧客 starts walking in while the player serves; it waits at the door for its turn
        const o = okeCust(def.newOke && def.newOke.includes('one') ? 'one' : (def.newOke || ['one'])[0]);
        g.okeUid = o.uid;
        spawn(o);
      }
      if (g.step >= GUIDE_STEPS.length) {
        s.phase = 'open';
        s.guide = { ...g, done: true };
        s.nextArrival = 600;
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
    s.incoming.fill(null);
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
        emit('sealed', { w, sealer: cup.sealer, id: cup.id });
      }
    }
    for (let i = 0; i < s.shelf.length; i++) {
      const cup = s.shelf[i];
      if (cup && cup.sealingUntil && !cup.sealed && s.t >= cup.sealingUntil) { cup.sealed = true; emit('sealed', { shelf: i, id: cup.id }); }
    }
    shelve();
    if (s.pot.cookingUntil && s.t >= s.pot.cookingUntil) {
      s.pot.cookingUntil = 0;
      s.pot.scoops = s.pot.max;
      emit('cooked', { scoops: s.pot.scoops });
    }
    if (cfg.autoCook && s.pot.scoops === 0 && !s.pot.cookingUntil) cook(true);
    if (s.phase === 'guide') {
      if (s.guide.custUid == null) guideStart();
      walk(dt);
      stepUps();
      guideCheck();
      return;
    }
    // open
    s.clock += dt;
    for (const sc of def.script || []) {
      if (!s.scriptDone.includes(sc.at) && s.clock >= sc.at) {
        s.scriptDone.push(sc.at);
        spawn(okeCust(sc.oke), { front: true });
      }
    }
    s.nextArrival -= dt;
    if (s.nextArrival <= 0) {
      arrive();
      s.nextArrival += arrivalGap(def, s.stars) * (0.6 + rnd() * 0.8);
    }
    walk(dt);
    stepUps();
    helperTick();
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
        // a multi-cup customer who runs out of patience pays for the cups already in (no tip)
        if (c.bill > 0) { s.earned += c.bill; emit('pay', { slot: i, pay: c.bill, tip: 0, cust: c, partial: true }); }
        leave(i, 'timeout');
      }
    }
    if (s.clock >= s.length) closeDay();
  }

  function summary() {
    return {
      day: def.n, goal: def.goal, earned: Math.round(s.earned), tips: s.tips, met: s.earned >= def.goal,
      served: s.stats.served, correct: s.stats.correct, wrong: s.stats.wrong, walkouts: s.stats.walkouts,
      sold: s.stats.served, orders: s.stats.orders, bigOrders: s.stats.bigOrders, golden: s.stats.golden, helperCups: s.stats.helperCups,
      okeCursed: s.stats.oke.gun + s.stats.oke.shut + s.stats.oke.take, okeGun: s.stats.oke.gun,
      okeShut: s.stats.oke.shut, okeTake: s.stats.oke.take, okeBest: s.stats.okeBest, normalCursed: s.stats.normalCursed,
      prepay: s.stats.prepay, trashed: s.stats.trashed, fans: s.stats.fans, maxQueue: s.stats.maxQueue,
      fameStart: s.fameStart, fame: s.fame, starsStart: s.starsStart, stars: s.stars,
    };
  }

  return {
    state: s,
    get def() { return def; },
    get cfg() { return cfg; },
    tick, takeCup, select, addTea, addTopping, tapIce, tapSugar, seal, serve, serveShelf, trash, trashShelf, cook: () => cook(false), answer, summary,
    /** Shut the shop now (pause sheet "close up", tests). */
    close() { if (s.phase !== 'closed') closeDay(); },
    drain() { return events.splice(0, events.length); },
    /** The cup the stations act on right now (null = none). */
    get target() { return target(); },
    /** Pending drinks at the counter: [{ it, slot, k }] (tools, the helper). */
    pending: () => pendingItems(),
  };
}
