// shop-engine.test.mjs — gameplay v3 pure engine (src/shop/engine.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShop, starsOf, priceMult, orderPrice, sameDrink, FAME_STARS, FAME, CUP_COST, GUIDE_STEPS, SLOT_VACANT_MS,
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
function make(shop, order) {
  const r = shop.takeCup();
  assert.ok(r.ok);
  shop.addTea(order.tea);
  for (const k of order.toppings) shop.addTopping(k);
  for (let i = 0; i < order.ice; i++) shop.tapIce();
  for (let i = 0; i < order.sugar; i++) shop.tapSugar();
  run(shop, 700);
  assert.ok(shop.seal(r.w).ok);
  run(shop, 900);
  assert.ok(shop.state.work[r.w].sealed);
  return r.w;
}

test('stars and price multiplier follow fame (★1 ×1.0 → ★5 ×2.0)', () => {
  assert.equal(starsOf(0), 1);
  assert.equal(starsOf(FAME_STARS[1]), 2);
  assert.equal(starsOf(FAME_STARS[4] + 1), 5);
  assert.equal(priceMult(1), 1);
  assert.equal(priceMult(5), 2);
});

test('sameDrink compares tea, toppings (any order), ice and sugar', () => {
  const o = { tea: 'black', toppings: ['pearl', 'pudding'], ice: 1, sugar: 2 };
  assert.ok(sameDrink({ tea: 'black', toppings: ['pudding', 'pearl'], ice: 1, sugar: 2 }, o));
  assert.ok(!sameDrink({ tea: 'green', toppings: ['pudding', 'pearl'], ice: 1, sugar: 2 }, o));
  assert.ok(!sameDrink({ tea: 'black', toppings: ['pearl'], ice: 1, sugar: 2 }, o));
  assert.ok(!sameDrink({ tea: 'black', toppings: ['pearl', 'pudding'], ice: 0, sugar: 2 }, o));
  assert.equal(orderPrice({ tea: 'jade', toppings: ['pearl'] }), 50);
});

test('cup flow: take, tea, pearls (pot scoops), seal, serve correct = pay + tip', () => {
  const shop = createShop({ day: 1, seed: 3 });
  const slot = untilSeated(shop, (c) => c.kind === 'normal');
  assert.ok(slot >= 0);
  const c = shop.state.slots[slot];
  const scoops = shop.state.pot.scoops;
  const w = make(shop, c.order);
  assert.equal(shop.state.pot.scoops, scoops - c.order.toppings.filter((k) => k === 'pearl').length);
  const r = shop.serve(w, slot);
  assert.ok(r.ok && r.correct);
  assert.ok(r.pay >= orderPrice(c.order) && r.tip > 0);
  assert.equal(shop.state.earned, r.pay + r.tip);
  assert.equal(shop.state.slots[slot], null);
  const evs = shop.drain().map((e) => e.type);
  for (const t of ['cup', 'tea', 'sealStart', 'sealed', 'serve', 'leave']) assert.ok(evs.includes(t), t);
});

test('wrong drink: half pay, no tip, the customer leaves', () => {
  const shop = createShop({ day: 1, seed: 5 });
  const slot = untilSeated(shop, (c) => c.kind === 'normal');
  const c = shop.state.slots[slot];
  const w = make(shop, { ...c.order, toppings: c.order.toppings.length ? [] : ['pearl'] });
  const r = shop.serve(w, slot);
  assert.ok(r.ok && !r.correct);
  assert.equal(r.tip, 0);
  assert.equal(r.pay, Math.round(orderPrice(c.order) / 2));
});

test('sealing needs tea, the pour done and a free sealer; trash costs the cup', () => {
  const shop = createShop({ day: 1, seed: 1 });
  const a = shop.takeCup();
  assert.equal(shop.seal(a.w).reason, 'noTea');
  shop.addTea('black');
  assert.equal(shop.seal(a.w).reason, 'pouring');
  run(shop, 700);
  assert.ok(shop.seal(a.w).ok);
  const b = shop.takeCup();
  shop.addTea('black');
  assert.equal(shop.seal(b.w).reason, 'pouring');
  run(shop, 900);
  assert.ok(shop.state.work[a.w].sealed, 'first cup sealed by now');
  assert.ok(shop.seal(b.w).ok);
  assert.ok(shop.trash(a.w).ok);
  assert.equal(shop.state.earned, -CUP_COST);
});

test('pearl pot: empty → cook → full after cookMs', () => {
  const shop = createShop({ day: 1, seed: 1 });
  for (let i = 0; i < 10; i++) { if (!shop.state.work.some((c) => c && c.toppings.length < 3)) { shop.trash(0); shop.trash(1); shop.takeCup(); } shop.addTopping('pearl'); }
  assert.equal(shop.state.pot.scoops, 0);
  if (!shop.state.work.some((c) => c && c.toppings.length < 3)) { shop.trash(0); shop.trash(1); shop.takeCup(); }
  assert.equal(shop.addTopping('pearl').reason, 'potEmpty');
  assert.ok(shop.cook().ok);
  run(shop, shop.cfg.cookMs - 100);
  assert.equal(shop.state.pot.scoops, 0);
  run(shop, 200);
  assert.equal(shop.state.pot.scoops, shop.cfg.potMax);
});

test('奧客: never leave on their own; 滾 = big fame + fans; best answer gives more', () => {
  const shop = createShop({ day: 1, seed: 2 });
  const slot = untilSeated(shop, (c) => c.kind === 'oke', 150000);
  assert.ok(slot >= 0, 'an 奧客 shows up on day 1');
  const c = shop.state.slots[slot];
  run(shop, 60000);
  assert.equal(shop.state.slots[slot] && shop.state.slots[slot].uid, c.uid, 'still there a minute later');
  const fame0 = shop.state.fame;
  const q0 = shop.state.queue.length;
  const r = shop.answer(slot, 'gun');
  assert.ok(r.ok);
  assert.equal(shop.state.fame - fame0, c.oke === 'one' ? FAME.okeBest : FAME.oke);
  assert.ok(shop.state.queue.length > q0, 'the queue outside grows');
  assert.equal(shop.state.slots[slot], null);
});

test('閉嘴 turns an 奧客 into a paying customer at double price; 收 the 250-cup customer prepays', () => {
  const shop = createShop({ day: 1, seed: 9 });
  const s = untilSeated(shop, (c) => c.oke === 'c250', 150000);
  assert.ok(s >= 0, 'the scripted 250-cup customer comes on day 1');
  const r = shop.answer(s, 'take');
  assert.ok(r.best && r.prepay === 250);
  assert.equal(shop.state.earned >= 250, true);
  const o = untilSeated(shop, (c) => c.kind === 'oke', 150000);
  if (o >= 0) {
    shop.answer(o, 'shut');
    const c = shop.state.slots[o];
    assert.ok(c.converted && c.doublePay && c.order);
    const w = make(shop, c.order);
    const res = shop.serve(w, o);
    assert.ok(res.correct && res.pay === Math.round(orderPrice(c.order) * 2 * priceMult(shop.state.stars)));
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
  const w = make(shop, { tea: 'black', toppings: [], ice: 0, sugar: 0 });
  assert.equal(shop.serve(w, o).reason, 'oke');
  assert.ok(shop.state.work[w], 'the cup stays');
});

test('patience runs out → walk-out; an unanswered 奧客 drains everyone faster', () => {
  const shop = createShop({ day: 1, seed: 4 });
  untilSeated(shop, (c) => c.kind === 'normal');
  run(shop, dayDef(1).patienceMs * 1.6);
  assert.ok(shop.state.stats.walkouts >= 1);
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
});

test('day 1 guide: cup → tea → topping → seal → serve → 奧客, then the shop opens (clock frozen meanwhile)', () => {
  const shop = createShop({ day: 1, seed: 1, guide: true });
  shop.tick(50);
  const steps = () => shop.drain().filter((e) => e.type === 'guide').map((e) => e.step);
  assert.deepEqual(steps(), ['cup']);
  const slot = shop.state.slots.findIndex(Boolean);
  run(shop, 60000);
  assert.equal(shop.state.clock, 0);
  assert.equal(shop.state.slots[slot] && shop.state.slots[slot].patience, Infinity);
  shop.takeCup(); shop.addTea('black'); shop.addTopping('pearl');
  run(shop, 700);
  shop.seal(0);
  run(shop, 900);
  shop.serve(0, slot);
  assert.deepEqual(steps(), ['tea', 'topping', 'seal', 'serve', 'oke']);
  run(shop, 1000 + SLOT_VACANT_MS);
  const o = shop.state.slots.findIndex((c) => c && c.kind === 'oke');
  assert.ok(o >= 0 && shop.state.slots[o].oke === 'one');
  shop.answer(o, 'gun');
  assert.equal(shop.state.phase, 'open');
  assert.equal(GUIDE_STEPS.length, 6);
});

test('upgrades change the tuning: 3rd work slot, 4th seat, megaphone clears every 奧客', () => {
  const shop = createShop({ day: 3, seed: 1, upgrades: ['slot3', 'seat4', 'megaphone', 'fastSeal'] });
  assert.equal(shop.state.work.length, 3);
  assert.equal(shop.state.slots.length, 4);
  assert.equal(shop.cfg.sealMs, 350);
  // seat two 奧客 by hand
  const s = shop.state;
  s.slots[0] = { uid: 901, kind: 'oke', cid: 34, oke: 'taste', converted: false, nagAt: 1e9 };
  s.slots[2] = { uid: 902, kind: 'oke', cid: 33, oke: 'bucket', converted: false, nagAt: 1e9 };
  shop.answer(0, 'gun');
  assert.equal(s.slots[0], null);
  assert.equal(s.slots[2], null);
  assert.equal(s.stats.oke.gun, 2);
});

test('deterministic with the same seed', () => {
  const a = createShop({ day: 3, seed: 42 });
  const b = createShop({ day: 3, seed: 42 });
  run(a, 30000); run(b, 30000);
  assert.deepEqual(a.state.slots.map((c) => c && c.order), b.state.slots.map((c) => c && c.order));
});
