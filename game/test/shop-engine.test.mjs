// shop-engine.test.mjs — gameplay v3 pure engine (src/shop/engine.js): walking in, the line, the counter, cups, shelf,
// multi-cup orders, 奧客, fans, the guide, upgrades.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShop, starsOf, priceMult, orderPrice, itemPrice, sameDrink, keyTarget, queueCap, FAME_STARS, FAME, FANS, CUP_COST,
  GUIDE_STEPS, SPAWN_U, SPOT, WALK_MS, STEP_MS, QUEUE_CAP, FAN_OVER, GOLDEN, GOLDEN_PRICE, BIG_PAY, patienceFor,
} from '../src/shop/engine.js';
import { dayDef } from '../src/shop/days.js';

const run = (shop, ms, step = 50) => { for (let t = 0; t < ms; t += step) shop.tick(step); };
function untilSeated(shop, pred = () => true, max = 60000) {
  for (let t = 0; t < max; t += 50) {
    const i = shop.state.slots.findIndex((c) => c && pred(c));
    if (i >= 0) return i;
    shop.tick(50);
  }
  return -1;
}
/** Make one drink and leave it sealed (on the shelf when there is room); returns { shelf } or { w }. */
function make(shop, item) {
  const r = shop.takeCup();
  assert.ok(r.ok, 'a free work slot');
  shop.addTea(item.tea);
  for (const k of item.toppings) shop.addTopping(k);
  for (let i = 0; i < item.ice; i++) shop.tapIce();
  for (let i = 0; i < item.sugar; i++) shop.tapSugar();
  run(shop, 700);
  assert.ok(shop.seal(r.w).ok);
  run(shop, 900);
  const i = shop.state.shelf.findIndex((c) => c && c.sealed && !c._seen);
  if (i >= 0) { shop.state.shelf[i]._seen = true; return { shelf: i }; }
  assert.ok(shop.state.work[r.w].sealed);
  return { w: r.w };
}
const give = (shop, ref, slot) => (ref.shelf != null ? shop.serveShelf(ref.shelf, slot) : shop.serve(ref.w, slot));
const plainDay = (n, extra = {}) => ({ ...dayDef(n), script: [], okeShare: 0, ...extra });

test('stars, price multiplier and queue cap follow fame (★1 6 people → ★5 16)', () => {
  assert.equal(starsOf(0), 1);
  assert.equal(starsOf(FAME_STARS[1]), 2);
  assert.equal(starsOf(FAME_STARS[4] + 1), 5);
  assert.equal(priceMult(1), 1);
  assert.equal(priceMult(5), 2);
  assert.equal(queueCap(1), 6);
  assert.equal(queueCap(5), 16);
  for (let i = 1; i < QUEUE_CAP.length; i++) assert.ok(QUEUE_CAP[i] > QUEUE_CAP[i - 1]);
  assert.equal(queueCap(3, 4), QUEUE_CAP[2] + 4, 'the stanchions add 4');
});

test('sameDrink compares tea, toppings (any order), ice and sugar; prices', () => {
  const o = { tea: 'black', toppings: ['pearl', 'pudding'], ice: 1, sugar: 2 };
  assert.ok(sameDrink({ tea: 'black', toppings: ['pudding', 'pearl'], ice: 1, sugar: 2 }, o));
  assert.ok(!sameDrink({ tea: 'green', toppings: ['pudding', 'pearl'], ice: 1, sugar: 2 }, o));
  assert.ok(!sameDrink({ tea: 'black', toppings: ['pearl'], ice: 1, sugar: 2 }, o));
  assert.ok(!sameDrink({ tea: 'black', toppings: ['pearl', 'pudding'], ice: 0, sugar: 2 }, o));
  assert.equal(itemPrice({ tea: 'jade', toppings: ['pearl'] }), 50);
  assert.equal(orderPrice({ items: [{ tea: 'jade', toppings: ['pearl'] }, { tea: 'black', toppings: [] }] }), 80);
  assert.equal(itemPrice(GOLDEN), GOLDEN_PRICE);
});

test('customers walk in from the far corner, join the line, step up to the counter; patience starts only there', () => {
  const shop = createShop({ day: 1, seed: 3, def: plainDay(1) });
  const s = shop.state;
  run(shop, 400);
  assert.equal(s.queue.length, 1, 'the first customer has spawned');
  const c = s.queue[0];
  assert.equal(c.phase, 'walk');
  assert.ok(c.u > 1 && c.u <= SPAWN_U, 'behind the far corner');
  const p0 = c.patience;
  run(shop, 1500);
  assert.ok(c.u < SPAWN_U - 0.3 && c.u > 0, 'walking closer');
  assert.equal(c.patience, p0, 'no patience lost while walking');
  run(shop, 3000);
  assert.ok(c.phase === 'step' || c.phase === 'counter', `reached the door (${c.phase})`);
  assert.ok(c.queuedT - c.spawnT >= WALK_MS && c.queuedT - c.spawnT <= WALK_MS * SPAWN_U + 100, 'about 3.7 s of walking');
  run(shop, STEP_MS + 100);
  const slot = s.slots.indexOf(c);
  assert.equal(slot, 0, 'the leftmost free counter spot');
  assert.equal(c.phase, 'counter');
  assert.ok(c.counterT - c.queuedT >= STEP_MS);
  run(shop, 1000);
  assert.ok(c.patience < p0, 'patience runs at the counter');
  const evs = shop.drain().map((e) => e.type);
  for (const t of ['spawn', 'queued', 'step', 'arrive']) assert.ok(evs.includes(t), t);
});

test('the line: spots SPOT apart, people stand still when the counter is full, then move up', () => {
  const def = plainDay(3, { arriveMs: 400, patienceMs: 1e9 });
  const shop = createShop({ day: 3, seed: 1, def });
  const s = shop.state;
  run(shop, 20000);
  assert.ok(s.slots.every(Boolean), 'the counter is full');
  assert.equal(s.queue.length, queueCap(s.stars), 'the line stops at the cap');
  const queued = s.queue.filter((c) => c.phase === 'queued');
  assert.ok(queued.length >= 3);
  s.queue.forEach((c, k) => { if (c.phase === 'queued') assert.ok(Math.abs(c.u - k * SPOT) < 1e-6, `spot ${k}`); });
  const head = s.queue[0];
  shop.answer(0, 'gun');
  run(shop, 3000);
  assert.ok(s.slots.includes(head) || s.incoming.some((x) => x && x.c === head), 'the head of the line took the free spot');
  assert.ok(Math.abs(s.queue[0].u) < 1e-6, 'the next one moved up to the door');
});

test('cup flow: take, tea, pearls, seal → the shelf frees the slot; serve from the shelf = pay + tip', () => {
  const shop = createShop({ day: 1, seed: 3, def: plainDay(1) });
  const slot = untilSeated(shop, (c) => c.kind === 'normal');
  assert.ok(slot >= 0);
  const c = shop.state.slots[slot];
  const scoops = shop.state.pot.scoops;
  const ref = make(shop, c.order.items[0]);
  assert.ok(ref.shelf != null, 'the sealed cup moved to the shelf');
  assert.ok(shop.state.work.every((x) => !x), 'its work slot is free again');
  assert.equal(shop.state.pot.scoops, scoops - c.order.items[0].toppings.filter((k) => k === 'pearl').length);
  const r = give(shop, ref, slot);
  assert.ok(r.ok && r.correct && r.done);
  assert.ok(r.pay >= itemPrice(c.order.items[0]) && r.tip > 0);
  assert.equal(shop.state.earned, r.pay + r.tip);
  assert.equal(shop.state.slots[slot], null);
  assert.equal(shop.summary().sold, 1);
  const evs = shop.drain().map((e) => e.type);
  for (const t of ['cup', 'tea', 'sealStart', 'sealed', 'shelve', 'serve', 'pay', 'leave']) assert.ok(evs.includes(t), t);
});

test('a full shelf keeps sealed cups on the table; they move as soon as a spot frees', () => {
  const shop = createShop({ day: 1, seed: 1, def: plainDay(1) });
  const s = shop.state;
  s.shelf.fill({ id: 99, tea: 'black', toppings: [], ice: 0, sugar: 0, sealed: true });
  const a = shop.takeCup();
  shop.addTea('black');
  run(shop, 700);
  shop.seal(a.w);
  run(shop, 900);
  assert.ok(s.work[a.w] && s.work[a.w].sealed, 'still on the table');
  shop.trashShelf(2);
  shop.tick(50);
  assert.equal(s.work[a.w], null);
  assert.equal(s.shelf[2].tea, 'black');
  assert.equal(s.shelf.length, 4);
});

test('wrong drink: half pay, no tip, the customer leaves; a 2-cup order pays when both are in', () => {
  const shop = createShop({ day: 1, seed: 5, def: plainDay(1) });
  const slot = untilSeated(shop, (c) => c.kind === 'normal');
  const c = shop.state.slots[slot];
  const it = c.order.items[0];
  const ref = make(shop, { ...it, toppings: it.toppings.length ? [] : ['pearl'] });
  const r = give(shop, ref, slot);
  assert.ok(r.ok && !r.correct && r.done);
  assert.equal(r.tip, 0);
  assert.equal(r.pay, Math.round(itemPrice(it) / 2));

  const two = createShop({ day: 2, seed: 2, def: plainDay(2, { cups: [1, 0] }) });
  const k = untilSeated(two, (x) => x.kind === 'normal');
  const cu = two.state.slots[k];
  assert.equal(cu.order.count, 2);
  assert.equal(cu.patienceMax, patienceFor(dayDef(2), 2));
  const r1 = give(two, make(two, cu.order.items[1]), k);
  assert.ok(r1.correct && !r1.done && r1.pay === 0, 'no pay yet');
  assert.deepEqual(cu.got, [false, true], 'the second cup is ticked (any order)');
  assert.equal(two.state.earned, 0);
  const r2 = give(two, make(two, cu.order.items[0]), k);
  assert.ok(r2.done && r2.pay > 0);
  assert.equal(two.state.earned, r2.pay + r2.tip);
  assert.equal(two.state.slots[k], null);
});

test('multi-cup orders by day: none on day 1, 2 cups from day 2, 3 from day 4, big 4-cup orders from day 3', () => {
  const sizes = (n) => {
    const out = new Set();
    for (let seed = 1; seed < 30; seed++) {
      const shop = createShop({ day: n, seed, def: { ...dayDef(n), okeShare: 0, arriveMs: 500, script: [] } });
      run(shop, 30000, 100);
      for (const c of [...shop.state.queue, ...shop.state.slots]) if (c && c.order) out.add(c.order.big ? 'big' : c.order.count);
    }
    return out;
  };
  assert.deepEqual([...sizes(1)], [1]);
  const d2 = sizes(2); assert.ok(d2.has(2) && !d2.has(3) && !d2.has('big'));
  const d3 = sizes(3); assert.ok(d3.has('big') && !d3.has(3));
  const d4 = sizes(4); assert.ok(d4.has(3) && d4.has('big'));
  // big orders pay more per cup
  const shop = createShop({ day: 3, seed: 4, def: plainDay(3, { bigShare: 1 }) });
  const k = untilSeated(shop, (x) => x.kind === 'normal');
  const c = shop.state.slots[k];
  assert.equal(c.order.count, 4);
  assert.ok(c.order.items.every((it) => it.tea));
  let last = null;
  for (const it of c.order.items) last = give(shop, make(shop, it), k);
  assert.ok(last.done);
  assert.equal(last.pay, c.order.items.reduce((a, it) => a + Math.round(itemPrice(it) * BIG_PAY), 0));
});

test('sealing needs tea, the pour done and a free sealer; trash costs the cup', () => {
  const shop = createShop({ day: 1, seed: 1, def: plainDay(1) });
  const a = shop.takeCup();
  assert.equal(shop.seal(a.w).reason, 'noTea');
  shop.addTea('black');
  assert.equal(shop.seal(a.w).reason, 'pouring');
  run(shop, 700);
  assert.ok(shop.seal(a.w).ok);
  const b = shop.takeCup();
  shop.addTea('black');
  run(shop, 700);
  assert.equal(shop.seal(b.w).reason, 'sealerBusy');
  run(shop, 200);
  assert.ok(shop.seal(b.w).ok);
  const c = shop.takeCup();
  assert.ok(shop.trash(c.w).ok);
  assert.equal(shop.state.earned, -CUP_COST);
});

test('pearl pot: empty → cook → full after cookMs', () => {
  const shop = createShop({ day: 1, seed: 1, def: plainDay(1) });
  const fresh = () => { shop.state.work.forEach((c, i) => { if (c) shop.trash(i); }); shop.takeCup(); };
  for (let i = 0; i < 10; i++) { if (!shop.state.work.some((c) => c && c.toppings.length < 3)) fresh(); shop.addTopping('pearl'); }
  assert.equal(shop.state.pot.scoops, 0);
  if (!shop.state.work.some((c) => c && c.toppings.length < 3)) fresh();
  assert.equal(shop.addTopping('pearl').reason, 'potEmpty');
  assert.ok(shop.cook().ok);
  run(shop, shop.cfg.cookMs - 100);
  assert.equal(shop.state.pot.scoops, 0);
  run(shop, 200);
  assert.equal(shop.state.pot.scoops, shop.cfg.potMax);
});

test('奧客: never leave on their own; 滾 = big fame + a running crowd; best answer brings 4–5, others 2–3, a normal customer 1', () => {
  const shop = createShop({ day: 1, seed: 2 });
  const slot = untilSeated(shop, (c) => c.kind === 'oke' && c.oke === 'one', 150000);
  assert.ok(slot >= 0, 'an 奧客 shows up on day 1');
  const c = shop.state.slots[slot];
  run(shop, 30000);
  assert.equal(shop.state.slots[slot] && shop.state.slots[slot].uid, c.uid, 'still there later');
  const fame0 = shop.state.fame;
  const q0 = shop.state.queue.length;
  const r = shop.answer(slot, 'gun');
  assert.ok(r.ok && r.best);
  assert.ok(shop.state.fame - fame0 >= FAME.okeBest);
  assert.ok(r.fans >= FANS.best[0] && r.fans <= FANS.best[1] + FANS.star[1], `fans ${r.fans}`);
  assert.ok(shop.state.queue.length >= q0 + Math.min(r.fans, 4), 'the line grows');
  const fans = shop.state.queue.filter((x) => x.fan);
  assert.ok(fans.length && fans.every((x) => x.run && x.phase === 'walk' && x.u >= SPAWN_U), 'they come running from the corner');
  const t0 = shop.state.t;
  const f = fans[fans.length - 1];
  const u0 = f.u;
  run(shop, 500);
  assert.ok(u0 - f.u > 0.3, 'running: faster than walking');
  assert.ok(!shop.state.slots.some((x) => x && x.uid === c.uid), 'the 奧客 is gone');
  void t0;

  // other answers 2–3, a normal customer 1
  const counts = { oke: [], normal: [] };
  for (let seed = 1; seed < 12; seed++) {
    const sh = createShop({ day: 2, seed, def: { ...dayDef(2), script: [], okeShare: 0.5 } });
    const i = untilSeated(sh, (x) => x.kind === 'oke', 80000);
    if (i >= 0) { const best = sh.state.slots[i].oke === 'lessIce' ? 'shut' : 'gun'; const key = best === 'gun' ? 'shut' : 'gun'; const before = sh.state.stars; const rr = sh.answer(i, key); if (sh.state.stars === before) counts.oke.push(rr.fans); }
    const j = untilSeated(sh, (x) => x.kind === 'normal', 80000);
    if (j >= 0) { const before = sh.state.stars; const rr = sh.answer(j, 'gun'); if (sh.state.stars === before) counts.normal.push(rr.fans); }
  }
  assert.ok(counts.oke.length >= 3 && counts.oke.every((n) => n >= FANS.oke[0] && n <= FANS.oke[1]), JSON.stringify(counts.oke));
  assert.ok(counts.normal.length >= 3 && counts.normal.every((n) => n === 1), JSON.stringify(counts.normal));
});

test('fans may push the line past the cap (round the corner), never past cap + FAN_OVER; a star-up brings a wave', () => {
  const shop = createShop({ day: 3, seed: 1, def: plainDay(3, { arriveMs: 300, patienceMs: 1e9 }) });
  const s = shop.state;
  run(shop, 15000);
  const cap = queueCap(s.stars);
  assert.equal(s.queue.length, cap);
  s.slots[0] = { ...s.slots[0], kind: 'oke', oke: 'taste', converted: false, nagAt: 1e12, order: null };
  shop.answer(0, 'gun');
  assert.ok(s.queue.length > cap && s.queue.length <= cap + FAN_OVER);
  const before = s.queue.length;
  const star = createShop({ day: 1, seed: 1, fame: FAME_STARS[1] - 5, def: plainDay(1) });
  star.state.slots[0] = { uid: 999, kind: 'oke', cid: 41, oke: 'one', converted: false, nagAt: 1e12, order: null, got: [] };
  star.answer(0, 'gun');
  const evs = star.drain();
  assert.ok(evs.some((e) => e.type === 'star'));
  const wave = evs.filter((e) => e.type === 'fans').reduce((a, e) => a + e.n, 0);
  assert.ok(wave >= FANS.star[0] + FANS.best[0] - 4 && wave <= queueCap(2) + FAN_OVER, `wave ${wave}`);
  void before;
});

test('閉嘴 turns an 奧客 into a paying one-cup customer at double price; 收 the 250-cup customer prepays', () => {
  const shop = createShop({ day: 1, seed: 9 });
  const s = untilSeated(shop, (c) => c.oke === 'c250', 150000);
  assert.ok(s >= 0, 'the scripted 250-cup customer comes on day 1');
  const r = shop.answer(s, 'take');
  assert.ok(r.best && r.prepay === 250);
  assert.ok(shop.state.earned >= 250);
  const o = untilSeated(shop, (c) => c.kind === 'oke', 150000);
  if (o >= 0) {
    shop.answer(o, 'shut');
    const c = shop.state.slots[o];
    assert.ok(c.converted && c.doublePay && c.order.count === 1);
    const res = give(shop, make(shop, c.order.items[0]), o);
    assert.ok(res.correct && res.pay === Math.round(itemPrice(c.order.items[0]) * 2 * priceMult(shop.state.stars)));
  }
});

test('serving a drink to an unanswered 奧客 is refused; normal customers can be cursed (no pay, small fame)', () => {
  const shop = createShop({ day: 1, seed: 2 });
  const n = untilSeated(shop, (c) => c.kind === 'normal');
  const f0 = shop.state.fame;
  shop.answer(n, 'shut');
  assert.equal(shop.state.slots[n], null);
  assert.equal(shop.state.fame - f0, FAME.normalCurse);
  assert.equal(shop.state.earned, 0);
  const o = untilSeated(shop, (c) => c.kind === 'oke', 150000);
  const ref = make(shop, { tea: 'black', toppings: [], ice: 0, sugar: 0 });
  assert.equal(give(shop, ref, o).reason, 'oke');
  assert.ok(shop.state.shelf[ref.shelf], 'the cup stays on the shelf');
});

test('patience runs out → walk-out; keyboard target = leftmost unanswered 奧客, else the leftmost customer', () => {
  const shop = createShop({ day: 1, seed: 4, def: plainDay(1) });
  untilSeated(shop, (c) => c.kind === 'normal');
  run(shop, dayDef(1).patienceMs * 1.3);
  assert.ok(shop.state.stats.walkouts >= 1);
  const st = { slots: [null, { kind: 'normal' }, { kind: 'oke', converted: false }, { kind: 'oke', converted: false }] };
  assert.equal(keyTarget(st), 2);
  assert.equal(keyTarget({ slots: [null, { kind: 'normal' }, null] }), 1);
  assert.equal(keyTarget({ slots: [null, null] }), -1);
});

test('the day closes after its length with a summary; goal met when earned ≥ goal', () => {
  const def = { ...dayDef(1), lengthMs: 5000, script: [] };
  const shop = createShop({ day: 1, seed: 1, def });
  run(shop, 5100);
  const evs = shop.drain();
  const close = evs.find((e) => e.type === 'close');
  assert.ok(close);
  assert.equal(shop.state.phase, 'closed');
  assert.equal(close.summary.met, false);
  assert.equal(close.summary.goal, dayDef(1).goal);
  assert.ok('sold' in close.summary && 'maxQueue' in close.summary);
});

test('day 1 guide: the customer walks in; cup → tea → topping → seal → serve → 奧客, then the shop opens', () => {
  const shop = createShop({ day: 1, seed: 1, guide: true });
  shop.tick(50);
  const steps = () => shop.drain().filter((e) => e.type === 'guide').map((e) => e.step);
  assert.deepEqual(steps(), ['cup']);
  assert.equal(shop.state.queue[0].phase, 'walk');
  run(shop, 60000);
  assert.equal(shop.state.clock, 0, 'the clock waits');
  const slot = shop.state.slots.findIndex(Boolean);
  assert.ok(slot >= 0 && shop.state.slots[slot].patience === Infinity);
  shop.takeCup(); shop.addTea('black'); shop.addTopping('pearl');
  run(shop, 700);
  shop.seal(0);
  run(shop, 900);
  assert.ok(shop.state.queue.some((c) => c.kind === 'oke'), 'the 奧客 is already walking in');
  shop.serveShelf(0, slot);
  assert.deepEqual(steps(), ['tea', 'topping', 'seal', 'serve', 'oke']);
  run(shop, 6000);
  const o = shop.state.slots.findIndex((c) => c && c.kind === 'oke');
  assert.ok(o >= 0 && shop.state.slots[o].oke === 'one');
  shop.answer(o, 'gun');
  assert.equal(shop.state.phase, 'open');
  assert.equal(GUIDE_STEPS.length, 6);
});

test('upgrades change the shop: work slots, counter spots, shelf, megaphone clears every 奧客', () => {
  const shop = createShop({ day: 3, seed: 1, upgrades: ['prep2', 'prep3', 'seat5', 'shelf2', 'shelf3', 'mega', 'seal2'] });
  const s = shop.state;
  assert.equal(s.work.length, 5);
  assert.equal(s.slots.length, 5);
  assert.equal(s.shelf.length, 6);
  assert.equal(shop.cfg.sealMs, 350);
  s.slots[0] = { uid: 901, kind: 'oke', cid: 34, oke: 'taste', converted: false, nagAt: 1e9, got: [] };
  s.slots[2] = { uid: 902, kind: 'oke', cid: 33, oke: 'bucket', converted: false, nagAt: 1e9, got: [] };
  shop.answer(0, 'gun');
  assert.equal(s.slots[0], null);
  assert.equal(s.slots[2], null);
  assert.equal(s.stats.oke.gun, 2);
});

test('station automation: second sealer, auto-seal on the shelf, tea manifold, ice dispenser, auto pot', () => {
  const shop = createShop({ day: 4, seed: 1, upgrades: ['seal2', 'seal3', 'seal4', 'tea2', 'tea3', 'ice2', 'pot2', 'pot3', 'pot4'], def: plainDay(4) });
  const s = shop.state;
  // tea manifold: one tap fills every empty cup
  shop.takeCup(); shop.takeCup(); shop.takeCup();
  const r = shop.addTea('green');
  assert.equal(r.n, 3);
  assert.ok(s.work.every((c) => c && c.tea === 'green'));
  run(shop, 300);
  // two sealers at once, the third cup seals itself on the shelf
  assert.ok(shop.seal(0).ok && shop.seal(1).ok);
  assert.equal(shop.seal(2).reason, 'sealerBusy');
  assert.ok(shop.seal(2, { toShelf: true }).ok);
  assert.equal(s.work[2], null);
  run(shop, 400);
  assert.equal(s.shelf.filter((c) => c && c.sealed).length, 3);
  // ice dispenser: one tap = the ice level a waiting drink asks for
  s.slots[1] = { uid: 77, kind: 'normal', cid: 5, order: { items: [{ tea: 'black', toppings: ['pearl'], ice: 2, sugar: 0 }], count: 1 }, got: [false], patience: 1e9, patienceMax: 1e9 };
  shop.takeCup(); shop.addTea('black'); shop.addTopping('pearl');
  assert.equal(shop.tapIce().level, 2);
  // auto pot
  s.pot.scoops = 1;
  shop.trash(0); shop.takeCup(); shop.addTopping('pearl');
  shop.tick(50);
  assert.ok(s.pot.cookingUntil > 0, 'a new pot started by itself');
  assert.equal(shop.cfg.cookMs, 4000);
  assert.equal(shop.cfg.potMax, 20);
});

test('the part-timer makes the most wanted drink and puts it on the shelf (≈ one cup per helperMs)', () => {
  const shop = createShop({ day: 2, seed: 1, upgrades: ['staff1'], def: plainDay(2, { arriveMs: 1e9 }) });
  const s = shop.state;
  s.nextArrival = 1e12;
  const item = { tea: 'green', toppings: ['pudding'], ice: 0, sugar: 0 };
  s.slots[0] = { uid: 70, kind: 'normal', cid: 5, order: { items: [item, item], count: 2 }, got: [false, false], patience: 1e9, patienceMax: 1e9 };
  s.slots[1] = { uid: 71, kind: 'normal', cid: 6, order: { items: [{ tea: 'black', toppings: [], ice: 0, sugar: 0 }], count: 1 }, got: [false], patience: 1e9, patienceMax: 1e9 };
  run(shop, 8100);
  const cups = s.shelf.filter(Boolean);
  assert.equal(cups.length, 1, 'one cup after 8 s');
  assert.ok(sameDrink(cups[0], item) && cups[0].sealed, 'the drink two people still want');
  run(shop, 8400);
  assert.equal(s.shelf.filter(Boolean).length, 2);
  run(shop, 8400);
  assert.equal(s.shelf.filter(Boolean).length, 3, 'black tea next; nothing more is wanted');
  run(shop, 9000);
  assert.equal(s.shelf.filter(Boolean).length, 3);
  assert.equal(s.stats.helperCups, 3);
  const fast = createShop({ day: 2, seed: 1, upgrades: ['staff1', 'staff2'] });
  assert.equal(fast.cfg.helperMs, 5000);
});

test('the golden recipe (menu3) shows up once 翡翠 + 布丁 + 椰果 are on the menu and pays the most', () => {
  const shop = createShop({ day: 3, seed: 2, upgrades: ['menu2', 'menu3'], def: plainDay(3, { arriveMs: 400, cups: [0, 0], bigShare: 0 }) });
  run(shop, 60000, 100);
  const items = [...shop.state.queue, ...shop.state.slots].filter((c) => c && c.order).flatMap((c) => c.order.items);
  assert.ok(items.some((it) => it.golden && sameDrink(it, GOLDEN)));
  const none = createShop({ day: 3, seed: 2, upgrades: ['menu2'], def: plainDay(3, { arriveMs: 400 }) });
  run(none, 60000, 100);
  assert.ok(![...none.state.queue, ...none.state.slots].some((c) => c && c.order && c.order.items.some((it) => it.golden)));
});

test('deterministic with the same seed', () => {
  const a = createShop({ day: 3, seed: 42 });
  const b = createShop({ day: 3, seed: 42 });
  run(a, 30000); run(b, 30000);
  assert.deepEqual(a.state.slots.map((c) => c && c.order), b.state.slots.map((c) => c && c.order));
  assert.deepEqual(a.state.queue.map((c) => c.u), b.state.queue.map((c) => c.u));
});
