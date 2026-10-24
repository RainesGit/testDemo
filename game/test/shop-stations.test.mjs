// shop-stations.test.mjs — the 10.9 stations of the v3 shop engine (src/shop/engine.js): 鮮奶 pump, 搖杯機 (the shake rule),
// 奶蓋機, the lemon tray + cutting board, 芋圓 / 紅豆, 雞蛋糕 (the side snack), 提袋 (packing big orders), station hints,
// what each day's orders ask for, their upgrades.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createShop, sameDrink, itemPrice, orderPrice, patienceFor, hintsFor, PRICE, SNACK_PRICE, BIG_CUPS, CUP_COST, HINT_IDS, HINT_MS, GOLDEN } from '../src/shop/engine.js';
import { dayDef, DAYS } from '../src/shop/days.js';
import { applyUpgrades } from '../src/shop/upgrades.js';

const run = (shop, ms, step = 50) => { for (let t = 0; t < ms; t += step) shop.tick(step); };
const plainDay = (n, extra = {}) => ({ ...dayDef(n), script: [], okeShare: 0, arriveMs: 1e9, ...extra });
const seat = (shop, i, order, extra = {}) => {
  const c = { uid: 500 + i, kind: 'normal', cid: 5, phase: 'counter', order: { count: order.items.length, big: false, snack: false, ...order }, got: order.items.map(() => false),
    gotSnack: false, bill: 0, tipBill: 0, wrongCups: 0, patience: 1e9, patienceMax: 1e9, ...extra };
  shop.state.slots[i] = c;
  return c;
};
const item = (o) => ({ tea: 'black', milk: false, toppings: [], ice: 0, sugar: 0, foam: false, lemon: false, shake: false, ...o });
function orders(n, seeds = 12, ms = 40000) {
  const out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const shop = createShop({ day: n, seed, def: { ...dayDef(n), okeShare: 0, arriveMs: 500, script: [], patienceMs: 1e9 } });
    run(shop, ms, 100);
    for (const c of [...shop.state.queue, ...shop.state.slots]) if (c && c.order) out.push(c.order);
  }
  return out;
}

test('orders grow with the days: milk tea from day 2; shake, lemon, taro and the bag from day 3; foam and snack from day 4; red bean on day 5', () => {
  const flags = (n) => {
    const os = orders(n);
    const items = os.flatMap((o) => o.items);
    return {
      milk: items.some((it) => it.milk), foam: items.some((it) => it.foam), lemon: items.some((it) => it.lemon),
      shake: items.length > 0 && items.every((it) => it.shake), taro: items.some((it) => it.toppings.includes('taro')),
      bean: items.some((it) => it.toppings.includes('bean')), snack: os.some((o) => o.snack), big: os.some((o) => o.big),
      jadeNoLemon: items.some((it) => it.tea === 'jade' && !it.lemon), jadeMilk: items.some((it) => it.tea === 'jade' && it.milk),
    };
  };
  const d1 = flags(1);
  assert.deepEqual([d1.milk, d1.foam, d1.lemon, d1.shake, d1.taro, d1.snack], [false, false, false, false, false, false], 'day 1 stays simple');
  const d2 = flags(2);
  assert.ok(d2.milk && !d2.shake && !d2.foam && !d2.snack && !d2.lemon, 'day 2: milk tea');
  const d3 = flags(3);
  assert.ok(d3.shake && d3.lemon && d3.taro && d3.big && !d3.foam && !d3.snack && !d3.bean, 'day 3: shake, lemon, taro, big orders');
  assert.ok(!d3.jadeNoLemon && !d3.jadeMilk, 'every 翡翠 has its lemon slice and never milk');
  const d4 = flags(4);
  assert.ok(d4.foam && d4.snack && !d4.bean, 'day 4: foam and the snack');
  const d5 = flags(5);
  assert.ok(d5.bean && d5.foam && d5.snack, 'day 5: red beans');
  assert.ok(orders(4).every((o) => !(o.big && o.snack)), 'no snack on a big order');
});

test('prices: milk +10, foam +20, taro / red bean +15, a snack bag 30; sameDrink tells milk, foam and lemon apart', () => {
  assert.equal(itemPrice(item({ tea: 'black', milk: true })), PRICE.black + PRICE.milk);
  assert.equal(itemPrice(item({ tea: 'green', foam: true, toppings: ['taro', 'bean'] })), 30 + 20 + 15 + 15);
  assert.equal(orderPrice({ items: [item({})], snack: true }), 30 + SNACK_PRICE);
  const a = item({ tea: 'black', milk: true, toppings: ['pearl'] });
  assert.ok(sameDrink({ ...a, shaken: true }, a), 'shaking is a step, not a taste');
  assert.ok(!sameDrink({ ...a, milk: false }, a));
  assert.ok(!sameDrink({ ...a, foam: true }, a));
  assert.ok(!sameDrink({ ...a, tea: 'jade', lemon: true }, { ...a, tea: 'jade' }));
  assert.ok(sameDrink({ tea: 'black', toppings: [], ice: 0, sugar: 0 }, { tea: 'black', toppings: [], ice: 0, sugar: 0, milk: false }), 'old items without the new fields still match');
  assert.ok(GOLDEN.lemon && !GOLDEN.milk);
  assert.ok(patienceFor(dayDef(4), 1, {}, true) > patienceFor(dayDef(4), 1, {}), 'a snack bag adds patience');
});

test('milk pump and cheese foam: one tap each on the target cup; the pour blocks sealing until done; locked before their day', () => {
  const d1 = createShop({ day: 1, seed: 1, def: plainDay(1) });
  d1.takeCup();
  assert.equal(d1.addMilk().reason, 'locked');
  assert.equal(d1.addFoam().reason, 'locked');
  assert.equal(d1.addLemon().reason, 'locked');
  assert.equal(d1.shake().reason, 'locked');
  assert.equal(d1.cookSnack().reason, 'locked');
  assert.equal(d1.pack({ w: 0 }).reason, 'locked');

  const shop = createShop({ day: 4, seed: 1, def: plainDay(4), upgrades: ['shaker2', 'shaker3'] });
  assert.equal(shop.addMilk().reason, 'noCup');
  const { w } = shop.takeCup();
  shop.addTea('black');
  run(shop, 700);
  const m = shop.addMilk();
  assert.ok(m.ok && shop.state.work[w].milk);
  assert.equal(shop.addMilk().reason, 'hasMilk');
  assert.equal(shop.seal(w).reason, 'pouring', 'the milk pour blocks the sealer');
  run(shop, shop.cfg.milkMs + 50);
  assert.ok(shop.addFoam().ok && shop.state.work[w].foam);
  assert.equal(shop.addFoam().reason, 'hasFoam');
  run(shop, shop.cfg.foamMs + 50);
  assert.ok(shop.seal(w).ok);
  const evs = shop.drain().map((e) => e.type);
  assert.ok(evs.includes('milk') && evs.includes('foam'));
  assert.equal(applyUpgrades(['milk2']).milkMs, 200);
  assert.equal(applyUpgrades(['foam2']).foamMs, 250);
});

test('lemon: a slice per 翡翠 from the tray; the tray runs low; the board slices a new batch (sliceMs); lemon2 = 12 slices, faster', () => {
  const shop = createShop({ day: 3, seed: 1, def: plainDay(3) });
  const s = shop.state;
  assert.equal(s.lemon.slices, 6);
  assert.equal(shop.slice().reason, 'lemonFull');
  for (let i = 0; i < 6; i++) {
    const r = shop.takeCup();
    if (!r.ok) { s.work.forEach((c, k) => { if (c) shop.trash(k); }); shop.takeCup(); }
    shop.addTea('jade');
    assert.ok(shop.addLemon().ok);
    assert.equal(shop.addLemon().reason, 'hasLemon');
  }
  assert.equal(s.lemon.slices, 0);
  s.work.forEach((c, k) => { if (c) shop.trash(k); });
  shop.takeCup();
  assert.equal(shop.addLemon().reason, 'lemonEmpty');
  assert.ok(shop.drain().some((e) => e.type === 'lemonEmpty'));
  assert.ok(shop.slice().ok);
  assert.equal(shop.slice().reason, 'slicing');
  run(shop, shop.cfg.sliceMs - 100);
  assert.equal(s.lemon.slices, 0);
  run(shop, 150);
  assert.equal(s.lemon.slices, 6);
  assert.ok(shop.drain().some((e) => e.type === 'sliced'));
  const big = createShop({ day: 3, seed: 1, def: plainDay(3), upgrades: ['lemon2'] });
  assert.equal(big.state.lemon.slices, 12);
  assert.equal(big.cfg.sliceMs, 600);
});

test('the shake rule: from day 3 a cup must be shaken before it is sealed; one cup in the shaker at a time; shaker2 faster', () => {
  const shop = createShop({ day: 3, seed: 1, def: plainDay(3) });
  const a = shop.takeCup();
  assert.equal(shop.shake(a.w).reason, 'noTea');
  shop.addTea('black');
  assert.equal(shop.shake(a.w).reason, 'pouring');
  run(shop, 700);
  assert.equal(shop.seal(a.w).reason, 'notShaken');
  const sh = shop.shake(a.w);
  assert.ok(sh.ok);
  assert.equal(shop.state.work[a.w].shakingUntil > 0, true);
  assert.equal(shop.addTopping('pearl').ok, false, 'a cup in the shaker takes nothing');
  const b = shop.takeCup();
  shop.addTea('green');
  run(shop, 700);
  assert.equal(shop.shake(b.w).reason, 'shakerBusy');
  run(shop, shop.cfg.shakeMs);
  assert.ok(shop.state.work[a.w].shaken && !shop.state.work[a.w].shakingUntil);
  assert.equal(shop.shake(a.w).reason, 'shaken');
  assert.ok(shop.seal(a.w).ok, 'shaken: it seals');
  // a tap on the shaker (no cup given) shakes the selected / first ready cup
  assert.ok(shop.shake().ok && shop.state.work[b.w].shakingUntil);
  const evs = shop.drain().map((e) => e.type);
  assert.ok(evs.includes('shakeStart') && evs.includes('shaken'));
  // day 2: no shaking needed
  const d2 = createShop({ day: 2, seed: 1, def: plainDay(2) });
  const c = d2.takeCup();
  d2.addTea('black');
  run(d2, 700);
  assert.ok(d2.seal(c.w).ok);
  assert.equal(applyUpgrades(['shaker2']).shakeMs, 400);
});

test('the auto shaker (shaker3): the sealer shakes the cup itself (also on the auto-seal shelf)', () => {
  const shop = createShop({ day: 3, seed: 1, def: plainDay(3), upgrades: ['shaker2', 'shaker3', 'seal2', 'seal3', 'seal4'] });
  const a = shop.takeCup();
  shop.addTea('black');
  run(shop, 700);
  assert.ok(shop.seal(a.w).ok);
  assert.ok(shop.state.work[a.w].shaken);
  const b = shop.takeCup();
  shop.addTea('green');
  run(shop, 700);
  assert.ok(shop.seal(b.w, { toShelf: true }).ok);
  assert.ok(shop.state.shelf.some((c) => c && c.tea === 'green' && c.shaken));
  assert.ok(!hintsFor({ items: [item({ shake: true })] }, dayDef(3), shop.cfg).includes('shake'), 'no shaking hint with the auto shaker');
});

test('提袋: big orders take the carry bag only; pack ≤ 4 sealed cups (table or shelf); the bag hands them all over; trash the bag', () => {
  const shop = createShop({ day: 3, seed: 1, def: plainDay(3), upgrades: ['shaker2', 'shaker3', 'shelf2', 'shelf3'] });
  const s = shop.state;
  const its = [item({ tea: 'black', toppings: ['pearl'] }), item({ tea: 'green' }), item({ tea: 'black', milk: true }), item({ tea: 'green', toppings: ['taro'] })];
  const c = seat(shop, 0, { items: its, big: true });
  const sealed = (it) => { const { w } = shop.takeCup(); shop.addTea(it.tea); if (it.milk) shop.addMilk(); it.toppings.forEach((k) => shop.addTopping(k)); run(shop, 700); shop.seal(w); run(shop, 900); return s.shelf.findIndex((x) => x && x.sealed && x.tea === it.tea && !x._p); };
  assert.equal(shop.serveBag(0).reason, 'bagEmpty');
  const i0 = sealed(its[0]);
  assert.equal(shop.serveShelf(i0, 0).reason, 'needsBag');
  s.shelf[i0]._p = 1;
  assert.equal(shop.pack({ w: 0 }).reason, 'noCup');
  assert.ok(shop.pack({ shelf: i0 }).ok);
  assert.equal(s.bag.cups.length, 1);
  assert.equal(s.shelf[i0], null);
  for (const it of its.slice(1)) { const i = sealed(it); s.shelf[i]._p = 1; assert.ok(shop.pack({ shelf: i }).ok); }
  assert.equal(s.bag.cups.length, BIG_CUPS);
  const extra = sealed(item({ tea: 'black' }));
  assert.equal(shop.pack({ shelf: extra }).reason, 'bagFull');
  const earned = s.earned;
  const r = shop.serveBag(0);
  assert.ok(r.ok && r.done && r.n === 4 && r.correct === 4, JSON.stringify(r));
  assert.ok(s.earned > earned && s.slots[0] === null && s.bag.cups.length === 0);
  assert.equal(s.stats.bags, 1);
  // a partial bag works for a 2-cup customer; too many cups is refused; the bag can be binned
  seat(shop, 1, { items: [item({ tea: 'black' }), item({ tea: 'black' })] });
  assert.ok(shop.pack({ shelf: extra }).ok);
  const r2 = shop.serveBag(1);
  assert.ok(r2.ok && !r2.done && r2.n === 1);
  for (let k = 0; k < 2; k++) { const i = sealed(item({ tea: 'green' })); shop.pack({ shelf: i }); }
  assert.equal(shop.serveBag(1).reason, 'bagTooMany');
  const before = s.earned;
  assert.ok(shop.trashBag().ok);
  assert.equal(s.earned, before - 2 * CUP_COST);
  // day 2 has no bag: a big order would take cups one by one (no big orders there anyway)
  assert.equal(createShop({ day: 2, seed: 1 }).state.bag, null);
});

test('雞蛋糕: tap the iron → snackBatch bags after snackMs (warmer ≤ snackCap); a bag to the customer with the snack card; done = cups + snack', () => {
  const shop = createShop({ day: 4, seed: 1, def: plainDay(4), upgrades: ['shaker2', 'shaker3'] });
  const s = shop.state;
  assert.deepEqual(s.snack, { ready: 0, cookingUntil: 0 });
  assert.equal(shop.serveSnack(0).reason, 'noSnack');
  assert.ok(shop.cookSnack().ok);
  assert.equal(shop.cookSnack().reason, 'cooking');
  run(shop, shop.cfg.snackMs + 50);
  assert.equal(s.snack.ready, 2);
  assert.ok(shop.drain().some((e) => e.type === 'snackReady'));
  shop.cookSnack(); run(shop, shop.cfg.snackMs + 50);
  assert.equal(s.snack.ready, 3, 'the warmer holds 3');
  assert.equal(shop.cookSnack().reason, 'snackFull');
  const it = item({ tea: 'black' });
  const c = seat(shop, 0, { items: [it], snack: true });
  seat(shop, 1, { items: [it] });
  assert.equal(shop.serveSnack(1).reason, 'noNeed', 'no snack card, no bag');
  const r = shop.serveSnack(0);
  assert.ok(r.ok && !r.done && c.gotSnack);
  assert.equal(shop.serveSnack(0).reason, 'noNeed');
  assert.equal(s.snack.ready, 2);
  const { w } = shop.takeCup(); shop.addTea('black'); run(shop, 700); shop.seal(w); run(shop, 900);
  const done = shop.serveShelf(s.shelf.findIndex(Boolean), 0);
  assert.ok(done.done && done.pay >= Math.round(30 + SNACK_PRICE), JSON.stringify(done));
  assert.equal(s.stats.snacks, 1);
  assert.ok(shop.trashSnack().ok && s.snack.ready === 1);
  // snack2 = faster iron, snack3 = a new batch by itself when the warmer is empty
  const auto = createShop({ day: 4, seed: 1, def: plainDay(4), upgrades: ['snack2', 'snack3'] });
  assert.equal(auto.cfg.snackMs, 3000);
  auto.tick(50);
  assert.ok(auto.state.snack.cookingUntil > 0, 'the auto iron starts by itself');
});

test('station hints: the first order needing a new station gets a finger hint (no freeze) until the station is used, once', () => {
  const shop = createShop({ day: 2, seed: 1, def: plainDay(2), hints: ['milk', 'shake'] });
  const s = shop.state;
  seat(shop, 0, { items: [item({ tea: 'black', milk: true })] });
  shop.tick(50);
  const ev = shop.drain().find((e) => e.type === 'hint');
  assert.ok(ev && ev.id === 'milk' && ev.slot === 0, JSON.stringify(ev));
  assert.equal(s.hint.id, 'milk');
  const clock = s.clock;
  run(shop, 500);
  assert.ok(s.clock > clock, 'the day keeps running');
  shop.takeCup(); shop.addTea('black'); shop.addMilk();
  assert.ok(shop.drain().some((e) => e.type === 'hintDone' && e.id === 'milk' && e.why === 'used'));
  assert.equal(s.hint, null);
  seat(shop, 1, { items: [item({ tea: 'green', milk: true })] });
  run(shop, 200);
  assert.ok(!shop.drain().some((e) => e.type === 'hint'), 'never twice');
  // a hint nobody follows goes away; no hint without the list
  const t = createShop({ day: 3, seed: 1, def: plainDay(3), hints: ['shake'] });
  seat(t, 0, { items: [item({ shake: true })] });
  t.tick(50);
  assert.equal(t.state.hint.id, 'shake');
  run(t, HINT_MS + 100);
  assert.equal(t.state.hint, null);
  const none = createShop({ day: 3, seed: 1, def: plainDay(3) });
  seat(none, 0, { items: [item({ shake: true })] });
  run(none, 200);
  assert.equal(none.state.hint, null);
  assert.deepEqual(hintsFor({ items: [item({ milk: true, foam: true, toppings: ['bean', 'taro'], lemon: true, shake: true })], big: true, snack: false }, { bag: true }),
    ['milk', 'shake', 'lemon', 'top-taro', 'bag', 'foam', 'top-bean']);
  assert.ok(HINT_IDS.includes('board') && HINT_IDS.includes('snack'));
});

test('the part-timer makes the full recipe (milk, foam, lemon, shaken) and leaves it on the shelf', () => {
  const shop = createShop({ day: 4, seed: 1, upgrades: ['staff1'], def: plainDay(4) });
  const s = shop.state;
  s.nextArrival = 1e12;
  const it = item({ tea: 'green', milk: true, foam: true, toppings: ['taro'], shake: true });
  seat(shop, 0, { items: [it] });
  run(shop, 8200);
  const cup = s.shelf.find(Boolean);
  assert.ok(cup && cup.sealed && cup.shaken && sameDrink(cup, it), JSON.stringify(cup));
});

test('days 1–5 tuning keeps day 1 untouched and adds one or two new stations a day', () => {
  assert.equal(DAYS[0].milkShare, 0);
  assert.ok(!DAYS[0].shake && !DAYS[0].lemon && !DAYS[0].bag && !DAYS[0].foamShare && !DAYS[0].snackShare);
  assert.ok(DAYS[1].milkShare > 0 && !DAYS[1].shake);
  assert.ok(DAYS[2].shake && DAYS[2].lemon && DAYS[2].bag && DAYS[2].toppings.includes('taro'));
  assert.ok(DAYS[3].foamShare > 0 && DAYS[3].snackShare > 0);
  assert.ok(DAYS[4].toppings.includes('bean'));
  for (const d of DAYS) for (const k of d.newStuff) assert.equal(typeof k, 'string');
});
