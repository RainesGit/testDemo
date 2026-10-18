// shop-data.test.mjs — gameplay v3 data: days, upgrades, the 奧客 roster and its voiced lines, the save, text, sim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAYS, dayDef, MAX_DAY } from '../src/shop/days.js';
import { UPGRADES, applyUpgrades, canBuy } from '../src/shop/upgrades.js';
import { OKE, okePool, okeLine, normalLine, customerSays } from '../src/shop/oke.js';
import { freshSave, loadSave, writeSave, afterDay, buyUpgrade, SAVE_KEY } from '../src/shop/save.js';
import { TEXT } from '../src/shop/text.js';
import { okeBubbleSVG, starRowSVG } from '../src/shop/oke-art.js';
import { getContent } from '../src/content.js';
import { clipKey, splitPunch, stripStage } from '../src/audio.js';
import { playDay } from '../tools/shop-sim.mjs';

test('days 1–5: goals rise, menus grow, each day brings its 奧客 (spec 5)', () => {
  assert.equal(DAYS.length, MAX_DAY);
  for (let i = 1; i < DAYS.length; i++) assert.ok(DAYS[i].goal > DAYS[i - 1].goal);
  assert.deepEqual(DAYS[0].teas, ['black']);
  assert.deepEqual(DAYS[0].toppings, ['pearl']);
  assert.ok(DAYS[2].teas.includes('jade') && DAYS[2].ice);
  assert.ok(DAYS[3].toppings.includes('grass') && DAYS[3].sugar);
  assert.ok(DAYS[4].twoCupShare > 0);
  assert.equal(DAYS[0].script[0].oke, 'c250');
  assert.equal(dayDef(7).n, 7);
  assert.ok(dayDef(7).goal > DAYS[4].goal);
});

test('8 奧客 types, unlocked across days 1–5, every one with a best answer', () => {
  assert.equal(OKE.length, 8);
  assert.deepEqual(okePool(1), ['one', 'c250']);
  assert.equal(okePool(5).length, 8);
  for (const o of OKE) assert.ok(['gun', 'shut', 'take'].includes(o.best));
  assert.equal(OKE.find((o) => o.type === 'c250').best, 'take');
});

test('every 奧客 answer line and what they say has an AI voice clip (zh + en)', () => {
  const manifest = JSON.parse(readFileSync(new URL('../voice/manifest.json', import.meta.url)));
  for (const lang of ['zh', 'en']) {
    const content = getContent(lang);
    const has = (t) => !stripStage(t) || !!manifest.langs[lang].clips[clipKey(lang, t)];
    for (const o of OKE) {
      for (const key of ['gun', 'shut', 'take']) {
        const line = okeLine(o.type, key, content);
        assert.ok(line, `${lang} ${o.type} ${key}`);
        const [a, b] = splitPunch(line);
        assert.ok(has(a) && has(b), `${lang} ${o.type} ${key}: ${line}`);
      }
      assert.ok(has(customerSays(o.cid, content)), `${lang} ${o.type} says`);
    }
    assert.ok(normalLine(5, content));
  }
  assert.equal(okeLine('c250', 'take', getContent('zh')), '250杯，|兩個月後過來拿。');
});

test('upgrades: 8 items, tuning and affordability', () => {
  assert.equal(UPGRADES.length, 8);
  const t = applyUpgrades(UPGRADES.map((u) => u.id));
  assert.equal(t.workSlots, 3);
  assert.equal(t.seats, 4);
  assert.equal(t.potMax, 20);
  assert.ok(t.coconut && t.megaphone && t.fameMult > 1 && t.prepayMult === 2);
  assert.ok(!canBuy('slot3', [], 10));
  assert.ok(canBuy('slot3', [], 5000));
  assert.ok(!canBuy('slot3', ['slot3'], 5000));
});

test('save: try/catch storage, fresh on broken data, afterDay and buyUpgrade', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  assert.deepEqual(loadSave(storage), freshSave());
  mem.set(SAVE_KEY, '{broken');
  assert.deepEqual(loadSave(storage), freshSave());
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadSave(throwing), freshSave());
  assert.equal(writeSave(throwing, freshSave()), false);
  let s = afterDay(freshSave(), { day: 1, earned: 900, met: true, fame: 150 });
  assert.equal(s.day, 2); assert.equal(s.wallet, 900); assert.equal(s.fame, 150); assert.ok(s.guideDone);
  const failed = afterDay(s, { day: 2, earned: 100, met: false, fame: 160 });
  assert.equal(failed.day, 2); assert.equal(failed.wallet, 1000);
  const r = buyUpgrade(s, 'bigPot');
  assert.ok(r.ok); assert.equal(r.save.wallet, 400); assert.deepEqual(r.save.upgrades, ['bigPot']);
  assert.ok(!buyUpgrade(r.save, 'seat4').ok);
  assert.ok(writeSave(storage, r.save));
  assert.deepEqual(loadSave(storage).upgrades, ['bigPot']);
  assert.ok(SAVE_KEY.startsWith('250cups.shop.'));
});

test('text: zh and en have the same keys, every upgrade named', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort();
  assert.deepEqual(keys(TEXT.zh), keys(TEXT.en));
  for (const u of UPGRADES) assert.ok(TEXT.zh.upgrades[u.id] && TEXT.en.upgrades[u.id]);
});

test('oke art: one bubble per prop, star row', () => {
  for (const o of OKE) assert.match(okeBubbleSVG(o.prop), new RegExp(`data-prop="${o.prop}"`));
  assert.equal((starRowSVG(3).match(/class="star on"/g) || []).length, 3);
});

test('balance sim: a normal player makes day 1 comfortably; day 3 is busier than day 1', () => {
  const seeds = [1, 2, 3, 4];
  const avg = (list, f) => list.reduce((a, d) => a + f(d), 0) / list.length;
  const d1 = seeds.map((seed) => playDay({ day: 1, fame: 0, upgrades: [], seed, bot: 'rookie', guide: true }));
  for (const d of d1) assert.ok(d.earned >= DAYS[0].goal * 1.2, `a first-time player earns ${d.earned} on day 1`);
  const n1 = seeds.map((seed) => playDay({ day: 1, fame: 0, upgrades: [], seed, bot: 'normal' }));
  const n3 = seeds.map((seed) => playDay({ day: 3, fame: 150, upgrades: [], seed, bot: 'normal' }));
  assert.ok(avg(n3, (d) => d.hectic) > avg(n1, (d) => d.hectic) + 0.2, 'day 3 keeps the counter full much more often');
});
