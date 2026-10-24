// art-shop.test.mjs — pure checks for src/shop/art-shop.js (gameplay v3 work area art, docs/gameplay-v3-shop.md §2–3).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cupSVG, teaTankSVG, toppingTraySVG, iceBinSVG, syrupSVG, sealerSVG, potSVG, cupRackSVG, trashSVG, workSlotSVG,
  orderBubbleSVG, coinSVG, patienceRingSVG, counterBackdropSVG, TEA_KINDS, TOPPING_KINDS, TEA_COLORS, ART_SHOP_VERSION,
} from '../src/shop/art-shop.js';
import { HANS_ONLY } from '../tools/hans-chars.mjs';

const nodes = (s) => (s.match(/<(?!\/|!)[a-zA-Z][^>]*>/g) || []).length;

// Well-formed: one root <svg>, every opening tag closed in order (self-closing tags allowed).
function wellFormed(s) {
  assert.match(s, /^<svg [^>]*viewBox="[-\d. ]+"[^>]*>/);
  assert.ok(s.endsWith('</svg>'));
  const stack = [];
  for (const m of s.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) assert.equal(stack.pop(), name, `unbalanced </${name}>`);
    else stack.push(name);
  }
  assert.equal(stack.length, 0, `unclosed ${stack.join(',')}`);
  assert.ok(!/NaN|undefined|null|Infinity/.test(s.replace(/data-tea=""/g, '')), 'no NaN/undefined in markup');
  assert.ok(!/filter|blur|<image|href=/i.test(s), 'no filters, blur or external images');
  for (const ch of s) assert.ok(!HANS_ONLY.has(ch), `Simplified character ${ch}`);
}

const cups = [];
for (const tea of [null, ...TEA_KINDS]) {
  for (const toppings of [[], ['pearl'], ['coconut', 'grass'], ['pearl', 'pudding', 'grass'], ['taro', 'bean'], ['grass', 'coconut', 'pearl', 'pudding']]) {
    for (const ice of [0, 1, 2]) for (const sugar of [0, 2]) for (const sealed of [false, true]) cups.push({ tea, toppings, ice, sugar, sealed });
    for (const extra of [{ milk: true }, { foam: true }, { lemon: true }, { shaken: true }, { milk: true, foam: true, shaken: true, lemon: true }]) cups.push({ tea, toppings, ice: 1, sugar: 1, ...extra });
  }
}

test('cupSVG: every combination is well formed, 1:1.5 (three-quarter view), ≤ 60 nodes, deterministic', () => {
  let max = 0;
  for (const c of cups) {
    const s = cupSVG(c);
    wellFormed(s);
    assert.match(s, /viewBox="0 0 100 150"/);
    assert.match(s, /url\(#gkGlass\)/, 'clear plastic shading');
    max = Math.max(max, nodes(s));
    assert.equal(s, cupSVG(c));
  }
  assert.ok(max <= 60, `cup nodes ${max}`);
  assert.ok(cupSVG({}).length > 0 && cupSVG().length > 0);
});

test('cupSVG: tea colours, toppings, lid show up', () => {
  for (const t of TEA_KINDS) assert.ok(cupSVG({ tea: t }).includes(TEA_COLORS[t].body), t);
  assert.ok(!cupSVG({}).includes(TEA_COLORS.black.body));
  assert.ok(cupSVG({ tea: 'black', sealed: true }).includes('>250</text>'));
  assert.ok(!cupSVG({ tea: 'black' }).includes('250'));
  assert.match(cupSVG({ tea: 'jade', sealed: true }), /data-tea="jade" data-sealed="1"/);
  assert.notEqual(cupSVG({ tea: 'black', ice: 0 }), cupSVG({ tea: 'black', ice: 2 }));
  assert.notEqual(cupSVG({ tea: 'black', sugar: 0 }), cupSVG({ tea: 'black', sugar: 1 }));
  assert.notEqual(cupSVG({ tea: 'black', toppings: ['pearl', 'coconut'] }), cupSVG({ tea: 'black', toppings: ['coconut', 'pearl'] }));
  // the 10.9 specs show on the cup: milk tea colour, the foam cap, the lemon wheel, froth after shaking
  assert.ok(cupSVG({ tea: 'black', milk: true }).includes(TEA_COLORS.black.milk));
  assert.notEqual(cupSVG({ tea: 'black', foam: true }), cupSVG({ tea: 'black' }));
  assert.notEqual(cupSVG({ tea: 'jade', lemon: true }), cupSVG({ tea: 'jade' }));
  assert.notEqual(cupSVG({ tea: 'green', shaken: true }), cupSVG({ tea: 'green' }));
  assert.notEqual(cupSVG({ tea: 'green', toppings: ['taro'] }), cupSVG({ tea: 'green', toppings: ['bean'] }));
  // at most three scoops are drawn
  assert.equal(cupSVG({ toppings: ['pearl', 'pearl', 'pearl', 'pudding'] }), cupSVG({ toppings: ['pearl', 'pearl', 'pearl'] }));
});

test('stations: well formed, ≤ 40 nodes, Traditional labels', () => {
  const all = [
    ...TEA_KINDS.map((k) => teaTankSVG(k)),
    ...TOPPING_KINDS.flatMap((k) => [0, 1, 5, 10].map((n) => toppingTraySVG(k, n))),
    toppingTraySVG('pearl'), iceBinSVG(), syrupSVG(), sealerSVG('idle'), sealerSVG('busy'),
    ...[0, 4, 10].flatMap((scoops) => [0, 0.5, 1].map((cookingPct) => potSVG({ scoops, cookingPct }))),
    potSVG(), cupRackSVG(), trashSVG(), workSlotSVG(), coinSVG(),
    ...[0, 0.25, 0.5, 1].map((p) => patienceRingSVG(p)), counterBackdropSVG(),
  ];
  for (const s of all) {
    wellFormed(s);
    assert.ok(nodes(s) <= 40, `${s.slice(0, 50)}: ${nodes(s)} nodes`);
  }
  for (const [k, name] of [['black', '紅茶'], ['green', '綠茶'], ['jade', '翡翠檸檬']]) assert.ok(teaTankSVG(k).includes(name), name);
  for (const [k, name] of [['pearl', '珍珠'], ['coconut', '椰果'], ['pudding', '布丁'], ['grass', '仙草'], ['taro', '芋圓'], ['bean', '紅豆']]) assert.ok(toppingTraySVG(k).includes(name), name);
  assert.ok(syrupSVG().includes('果糖'));
  assert.match(sealerSVG('busy'), /data-state="busy"/);
  assert.match(sealerSVG(), /data-state="idle"/);
  assert.match(toppingTraySVG('pudding', 3), /data-left="3"/);
  assert.notEqual(toppingTraySVG('pearl', 10), toppingTraySVG('pearl', 2));
  assert.ok(potSVG({ scoops: 10, cookingPct: 0.3 }).includes('as-pot-timer'));
  assert.ok(!potSVG({ scoops: 10, cookingPct: 1 }).includes('as-pot-timer'));
});

test('orderBubbleSVG: icons only, ×N badge for count > 1', () => {
  const orders = [];
  for (const tea of TEA_KINDS) for (const toppings of [[], ['pearl'], ['pudding', 'grass', 'coconut']]) for (const ice of [0, 2]) for (const sugar of [0, 1]) for (const count of [1, 2]) orders.push({ tea, toppings, ice, sugar, count });
  for (const o of orders) {
    const s = orderBubbleSVG(o);
    wellFormed(s);
    assert.ok(nodes(s) <= 40, `${nodes(s)} nodes`);
    assert.ok(!/\p{Script=Han}/u.test(s), 'no words');
    assert.equal(s.includes('×'), o.count > 1);
  }
  assert.ok(orderBubbleSVG({ tea: 'black', count: 3 }).includes('×3'));
});

test('patience ring colour runs green → yellow → red', () => {
  const col = (p) => patienceRingSVG(p).match(/class="as-pr-arc"[^>]*stroke="(#[0-9A-F]{6})"/)[1];
  assert.equal(col(1), '#3CC98E');
  assert.equal(col(0.5), '#FFC21A');
  assert.equal(col(0), '#EE4130');
  assert.match(patienceRingSVG(2), /data-pct="1"/);
});

test('version export', () => {
  assert.equal(typeof ART_SHOP_VERSION, 'number');
});

test('depth kit: one shared defs block (no filters), every prop shaded with it and given a soft contact shadow', async () => {
  const { SHOP_DEFS, G } = await import('../src/shop/art-kit.js');
  assert.ok(!/filter|blur|<image|href=/i.test(SHOP_DEFS));
  for (const ref of Object.values(G)) assert.ok(SHOP_DEFS.includes(`id="${ref.slice(5, -1)}"`), ref);
  for (const s of [teaTankSVG('black'), toppingTraySVG('pearl'), syrupSVG(), sealerSVG(), potSVG(), cupRackSVG(), trashSVG(), workSlotSVG(), cupSVG({ tea: 'black' })]) {
    assert.match(s, /url\(#gkAO\)/, 'a soft radial contact shadow');
    assert.match(s, /url\(#gk(Cyl|CylSoft|Steel|SteelTop|Top|Front|Glass|Inner|Liquid|Box|Chrome)\)/, 'body shading');
  }
});

test('bar stations and table dressing (art-bar.js): well formed, pictures only, states change the art', async () => {
  const bar = await import('../src/shop/art-bar.js');
  const all = [bar.milkPumpSVG(), bar.milkPumpSVG({ fast: true }), bar.foamSVG(), bar.foamSVG({ fast: true }), bar.shakerSVG(), bar.shakerSVG('busy', { fast: true, auto: true }),
    bar.boardSVG(), bar.boardSVG({ slicing: true }), bar.waffleSVG(), bar.waffleSVG({ cookingPct: 0.4 }), bar.waffleSVG({ ready: 3, fast: true }), bar.snackBagSVG(),
    ...[0, 1, 2, 3].map((n) => bar.snackSpotSVG(n)), ...[0, 1, 4].map((n) => bar.carryBagSVG(n)), bar.fridgeSVG(), bar.lightBoxSVG(), bar.fanSVG(), bar.registerSVG(),
    bar.cashTraySVG(), bar.tipJarSVG(), bar.towerStandSVG()];
  for (const s of all) {
    wellFormed(s);
    assert.ok(!/\p{Script=Han}/u.test(s), 'no words on the bar art');
    assert.ok(nodes(s) <= 70, `${s.slice(0, 40)}: ${nodes(s)} nodes`);
  }
  assert.match(bar.shakerSVG('busy'), /data-state="busy"/);
  assert.match(bar.waffleSVG({ cookingPct: 0.5 }), /as-waffle-timer/);
  assert.ok(!bar.waffleSVG({ ready: 2 }).includes('as-waffle-timer'));
  assert.match(bar.carryBagSVG(3), /data-n="3"/);
  assert.notEqual(bar.boardSVG(), bar.boardSVG({ slicing: true }));
});
