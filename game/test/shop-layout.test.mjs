// shop-layout.test.mjs — the landscape stage geometry (src/shop/layout.js) and its art (src/shop/art-street.js, the
// landscape parts of src/shop/art-shop.js): in bounds, no overlapping stations, perspective, well-formed SVG.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGE, LIP_Y, PERSON, PILLAR, SEAT_S, BUBBLE, HUD, streetPoint, seatPoint, seatColumn, stepPoint, stations, lockedSpots, lineU, bubbleWidth } from '../src/shop/layout.js';
import { streetSVG, cornerSVG, awningSVG, walkerSVG, walkerLook, helperSVG, acSVG, speakerSVG, ticketMachineSVG, rotateIconSVG, vehicleSVG, pedSVG, roadLane, farWalk } from '../src/shop/art-street.js';
import { tableSVG, shelfSVG, itemsBubbleSVG, teaManifoldSVG, iceDispenserSVG, potRigSVG, goldenCardSVG, teaTankSVG, sealerSVG, lockedSVG, lockBadgeSVG, counterLipSVG, patienceColor } from '../src/shop/art-shop.js';
import { GOLDEN } from '../src/shop/engine.js';
import { HANS_ONLY } from '../tools/hans-chars.mjs';

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
  assert.ok(!/NaN|undefined|Infinity/.test(s), 'no NaN/undefined in markup');
  assert.ok(!/filter|blur|<image|href=/i.test(s), 'no filters, blur or external images');
  for (const ch of s) assert.ok(!HANS_ONLY.has(ch), `Simplified character ${ch}`);
}

test('street perspective: the far corner is about 35% of the counter size, people grow as they walk in', () => {
  const far = streetPoint(1);
  const door = streetPoint(0);
  assert.ok(far.s / SEAT_S > 0.3 && far.s / SEAT_S < 0.42, `corner ${(far.s / SEAT_S).toFixed(2)}`);
  let prev = streetPoint(1.2);
  for (let u = 1.1; u >= 0; u -= 0.1) {
    const p = streetPoint(u);
    assert.ok(p.s > prev.s && p.x > prev.x && p.y > prev.y, `closer at u ${u.toFixed(1)}`);
    prev = p;
  }
  assert.ok(door.y > LIP_Y - 20 && door.x < seatColumn(0, 4).x, 'the head of the line stands at the counter, left of the spots');
  assert.ok(far.y - far.s * PERSON.h > 60, 'the far corner stays below the HUD');
  const a = stepPoint(0, 4, 0);
  const b = stepPoint(0, 4, 1);
  assert.deepEqual([Math.round(a.x), Math.round(a.s * 100)], [Math.round(door.x), Math.round(door.s * 100)]);
  assert.deepEqual(b, { ...seatPoint(0, 4), y: seatPoint(0, 4).y });
});

test('counter spots: 4 or 5 columns between the line and the pillar; heads show above the lip', () => {
  for (const n of [4, 5]) {
    for (let i = 0; i < n; i++) {
      const c = seatColumn(i, n);
      const p = seatPoint(i, n);
      assert.ok(c.x >= 480 && c.x + c.w <= PILLAR.x, `spot ${i}/${n}`);
      const top = p.y - PERSON.h * p.s;
      const head = (200 / 480) * PERSON.h * p.s;
      assert.ok(top > 120 && top + head < LIP_Y, 'the whole head is above the counter');
      assert.ok(PERSON.w * p.s <= c.w, 'customers do not overlap');
    }
  }
});

test('work table: every station inside the stage under the lip, no two stations overlap', () => {
  const cases = [
    { teas: ['black'], toppings: ['pearl'], workSlots: 3, shelf: 4 },
    { teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding', 'grass', 'coconut'], ice: true, sugar: true, workSlots: 5, shelf: 6, sealers: 2 },
    { teas: ['black', 'green'], toppings: ['pearl', 'pudding'], workSlots: 4, shelf: 5 },
  ];
  const H = { rack: 110, pot: 126, trash: 127, tower: 150, shelf: 196, helper: 148, ice: 101, sugar: 123 };
  for (const cfg of cases) {
    const r = stations(cfg);
    const boxes = Object.entries(r).filter(([k]) => k !== 'shelf' || true).map(([k, b]) => {
      const h = b.h || H[k] || (k.startsWith('tea-') ? b.w * 1.4 : k.startsWith('top-') ? b.w * 0.9 : k.startsWith('sealer') ? b.w * 1.36 : 100);
      return { k, x: b.x, y: b.y, w: b.w, h };
    }).filter((b) => !b.k.startsWith('shelf-'));
    for (const b of boxes) {
      assert.ok(b.x >= 0 && b.x + b.w <= STAGE.w + 0.5 && b.y >= LIP_Y && b.y + b.h <= STAGE.h + 0.5, `${b.k} in bounds ${JSON.stringify(b)}`);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const ov = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2;
        assert.ok(!ov, `${a.k} overlaps ${b.k}`);
      }
    }
    for (let i = 0; i < cfg.shelf; i++) assert.ok(r['shelf-' + i], `shelf spot ${i}`);
    for (let i = 0; i < cfg.workSlots; i++) assert.ok(r['slot-' + i].w >= 85, 'work slots stay big enough to drag from');
  }
});

test('landscape art: street, corner, awning, walkers (all looks, 奧客, fixed 250), staff and props are well formed', () => {
  for (const s of [streetSVG(), streetSVG({ neon: true, rail: true }), cornerSVG(), awningSVG(), helperSVG(1), helperSVG(2), acSVG(), speakerSVG(), ticketMachineSVG(), rotateIconSVG()]) wellFormed(s);
  assert.match(streetSVG({ neon: true }), /st-neon/);
  assert.match(streetSVG({ rail: true }), /st-rail/);
  assert.ok(!/st-neon|st-rail/.test(streetSVG()));
  for (let cid = 1; cid <= 100; cid += 7) {
    const w = walkerSVG({ cid, visit: cid });
    wellFormed(w);
    for (const part of ['wk-leg-l', 'wk-leg-r', 'wk-arm-l', 'wk-arm-r', 'wk-sil', 'wk-sign', 'wk-phone', 'class="cust"']) assert.ok(w.includes(part), part);
    assert.equal(w, walkerSVG({ cid, visit: cid }), 'deterministic');
  }
  wellFormed(walkerSVG({ cid: 47, fixed: 'c250', oke: 'c250' }));
});

test('landscape stations: table, shelf (4–6, auto sealer), bubbles with a tick per delivered cup, level art', () => {
  wellFormed(tableSVG());
  for (const n of [4, 5, 6]) { const s = shelfSVG(n); wellFormed(s); assert.match(s, new RegExp(`data-n="${n}"`)); }
  assert.match(shelfSVG(4, { autoSeal: true }), /as-gantry/);
  const it = (tea, toppings, ice = 0, sugar = 0) => ({ tea, toppings, ice, sugar });
  const order = { items: [it('black', ['pearl'], 1, 2), it('green', ['pudding', 'grass']), it('jade', [], 2, 0), { ...GOLDEN }], big: true };
  for (const got of [[], [true], [true, false, true], [true, true, true, true]]) {
    const s = itemsBubbleSVG(order, got);
    wellFormed(s);
    assert.equal((s.match(/class="as-item done"/g) || []).length, got.filter(Boolean).length);
    assert.equal((s.match(/class="as-item/g) || []).length, 4, 'one mini cup per item');
  }
  assert.match(itemsBubbleSVG({ items: [it('black', ['pearl'])] }), /data-count="1"/);
  wellFormed(itemsBubbleSVG({ items: [{ ...GOLDEN }] }));
  for (const s of [teaManifoldSVG(1), teaManifoldSVG(3), iceDispenserSVG(), potRigSVG(3), potRigSVG(4), goldenCardSVG(), teaTankSVG('jade', { fast: true }), sealerSVG('busy', { turbo: true })]) wellFormed(s);
  assert.match(teaTankSVG('black', { fast: true }), /data-fast="1"/);
  assert.match(sealerSVG('idle', { turbo: true }), /data-turbo="1"/);
});

test('fixed table: every spot keeps its place at every level; what is not owned is a locked spot; owned + locked = all', () => {
  const small = { teas: ['black'], toppings: ['pearl'], workSlots: 3, shelf: 4, sealers: 1 };
  const full = { teas: ['black', 'green', 'jade'], toppings: ['pearl', 'pudding', 'grass', 'coconut'], ice: true, sugar: true, workSlots: 5, shelf: 6, sealers: 2, helper: true };
  const a = stations(small);
  const b = stations(full);
  for (const k of Object.keys(a)) assert.deepEqual({ ...a[k], cols: undefined }, { ...b[k], cols: undefined }, `${k} does not move`);
  const locked = lockedSpots(small);
  assert.deepEqual(lockedSpots(full), []);
  const names = new Set([...Object.keys(a), ...locked.map((l) => l.name)]);
  assert.deepEqual([...names].sort(), Object.keys(b).sort());
  for (const l of locked) assert.ok(['tea', 'top', 'ice', 'sugar', 'slot', 'sealer', 'shelf', 'helper'].includes(l.kind), l.kind);
  assert.ok(locked.some((l) => l.name === 'slot-4') && locked.some((l) => l.name === 'sealer-1') && locked.some((l) => l.name === 'helper'));
  for (const kind of ['tea', 'top', 'ice', 'sugar', 'slot', 'sealer', 'helper']) { const s2 = lockedSVG(kind); wellFormed(s2); assert.match(s2, /class="lk"/); }
  wellFormed(lockBadgeSVG());
  wellFormed(counterLipSVG());
  assert.match(shelfSVG(4), /class="lk"/);
  assert.ok(!/class="lk"/.test(shelfSVG(6)));
});

test('the line spreads out near the door (lineU): continuous, monotonic, identity past the corner', () => {
  let prev = -1;
  for (let u = 0; u <= 1.3; u += 0.01) { const v = lineU(u); assert.ok(v > prev, `monotonic at ${u.toFixed(2)}`); prev = v; }
  assert.equal(lineU(0), 0);
  assert.equal(lineU(1), 1);
  assert.equal(lineU(1.15), 1.15);
  const gap = streetPoint(lineU(0)).x - streetPoint(lineU(0.065)).x;
  assert.ok(gap > PERSON.w * streetPoint(0).s * 0.75, `the first two people stand apart (${gap.toFixed(0)} px)`);
});

test('bubbles fit their band above the heads; the HUD stays left of the counter spots', () => {
  for (const n of [4, 5]) {
    const col = seatColumn(0, n);
    for (const k of [1, 2, 3, 4]) {
      const w = bubbleWidth(k, col.w);
      assert.ok(w >= 80 && w <= col.w * 1.2, `${k} cups at ${n} spots: ${w}`);
    }
  }
  const head = seatPoint(0, 4).y - PERSON.h * SEAT_S;
  assert.ok(BUBBLE.bottom <= head + 14 && BUBBLE.top >= 0, 'the bubble tail reaches the head');
  assert.ok(HUD.x + HUD.w <= seatColumn(0, 4).x, 'HUD left of the first spot');
  assert.equal(patienceColor(1), '#3CC98E');
  assert.equal(patienceColor(0), '#EE4130');
});

test('street life: cars, scooters and passers-by are well formed; neighbours in line never share a shirt colour', () => {
  for (let i = 1; i < 8; i++) { wellFormed(vehicleSVG('car', i)); wellFormed(vehicleSVG('scooter', i)); wellFormed(pedSVG(i)); }
  assert.ok(roadLane(1280).s > roadLane(200).s && farWalk(1000).y < LIP_Y);
  for (let uid = 1; uid < 60; uid++) {
    const a = walkerLook({ cid: 7, uid });
    const b = walkerLook({ cid: 7, uid: uid + 1 });
    assert.notEqual(a.shirt, b.shirt, `uid ${uid}`);
  }
  const w = walkerSVG({ cid: 5, uid: 3 });
  assert.match(w, /class="wk-back"/);
  assert.equal((helperSVG(1).match(/<svg/g) || []).length, 1, 'the helper head is a group, not a nested svg');
});
