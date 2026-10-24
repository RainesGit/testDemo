// shop-data.test.mjs — gameplay v3 data: days, upgrades, the 奧客 roster and its voiced lines, the save, text, sim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAYS, dayDef, MAX_DAY } from '../src/shop/days.js';
import { UPGRADES, LEVELS, STATIONS, TABS, OLD_IDS, applyUpgrades, canBuy, levelOf, nextLevel, BASE_TUNING } from '../src/shop/upgrades.js';
import { OKE, okePool, okeLine, normalLine, customerSays } from '../src/shop/oke.js';
import { freshSave, loadSave, writeSave, afterDay, buyUpgrade, migrateUpgrades, SAVE_KEY } from '../src/shop/save.js';
import { TEXT } from '../src/shop/text.js';
import { okeBubbleSVG, starRowSVG } from '../src/shop/oke-art.js';
import { getContent } from '../src/content.js';
import { clipKey, splitPunch, stripStage } from '../src/audio.js';
import { playDay, runCareer } from '../tools/shop-sim.mjs';

test('days 1–5: goals rise, menus grow, each day brings its 奧客 (spec 5)', () => {
  assert.equal(DAYS.length, MAX_DAY);
  for (let i = 1; i < DAYS.length; i++) assert.ok(DAYS[i].goal > DAYS[i - 1].goal);
  assert.deepEqual(DAYS[0].teas, ['black']);
  assert.deepEqual(DAYS[0].toppings, ['pearl']);
  assert.ok(DAYS[2].teas.includes('jade') && DAYS[2].ice);
  assert.ok(DAYS[3].toppings.includes('grass') && DAYS[3].sugar);
  assert.deepEqual(DAYS[0].cups, [0, 0]);
  assert.ok(DAYS[1].cups[0] > 0 && DAYS[1].cups[1] === 0 && !DAYS[1].bigShare, 'two cups from day 2');
  assert.ok(DAYS[2].bigShare > 0, 'big orders from day 3');
  assert.ok(DAYS[3].cups[1] > 0, 'three cups from day 4');
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

test('upgrade tree: every station Lv1 → Lv2/3/4, capacity → speed → automation, prices rise within a station', () => {
  assert.ok(LEVELS.length >= 20 && STATIONS.length >= 12);
  for (const st of STATIONS) {
    assert.ok(TABS.includes(st.tab), st.id);
    for (let i = 1; i < st.levels.length; i++) assert.ok(st.levels[i].cost > st.levels[i - 1].cost, `${st.id} prices rise`);
  }
  const lv = (id) => STATIONS.find((s) => s.id === id).levels.length + 1;
  assert.equal(lv('pot'), 4); assert.equal(lv('tea'), 3); assert.equal(lv('seal'), 4); assert.equal(lv('prep'), 3); assert.equal(lv('shelf'), 3);
  assert.equal(lv('ice'), 2); assert.equal(lv('menu'), 3); assert.equal(lv('staff'), 3);
  assert.deepEqual(applyUpgrades([]), BASE_TUNING);
  assert.equal(BASE_TUNING.workSlots, 3); assert.equal(BASE_TUNING.seats, 4); assert.equal(BASE_TUNING.shelf, 4);
  const all = applyUpgrades(UPGRADES.map((u) => u.id));
  assert.equal(all.workSlots, 5); assert.equal(all.seats, 5); assert.equal(all.shelf, 6);
  assert.equal(all.potMax, 20); assert.equal(all.cookMs, 4000); assert.ok(all.autoCook);
  assert.equal(all.pourMs, 250); assert.ok(all.teaAll);
  assert.equal(all.sealMs, 350); assert.equal(all.sealers, 2); assert.ok(all.autoSeal);
  assert.ok(all.iceSmart && all.coconut && all.golden && all.megaphone);
  assert.equal(all.helperMs, 5000); assert.equal(all.prepayMult, 2); assert.equal(all.fameMult, 1.5);
  assert.equal(all.patienceMult, 1.2); assert.equal(all.tipMult, 1.5); assert.equal(all.queueBonus, 4);
  // levels in order: Lv3 needs Lv2; a skipped level does nothing
  assert.ok(!canBuy('pot3', [], 1e6), 'Lv3 needs Lv2');
  assert.ok(canBuy('pot2', [], 1e6));
  assert.ok(canBuy('pot3', ['pot2'], 1e6));
  assert.ok(!canBuy('pot2', [], 10), 'too expensive');
  assert.ok(!canBuy('pot2', ['pot2'], 1e6), 'owned');
  assert.equal(applyUpgrades(['pot3']).cookMs, BASE_TUNING.cookMs, 'pot3 without pot2 counts as nothing');
  assert.equal(levelOf(['pot2', 'pot3'], 'pot'), 2);
  assert.equal(nextLevel(['pot2', 'pot3'], 'pot').id, 'pot4');
  assert.equal(nextLevel(['ice2'], 'ice'), null);
  // cheap Lv2s early, automation late
  const cost = (id) => LEVELS.find((l) => l.id === id).cost;
  for (const auto of ['pot4', 'tea3', 'seal4', 'staff1']) for (const early of ['pot2', 'tea2', 'seal2', 'shelf2']) assert.ok(cost(auto) > 2 * cost(early));
});

test('old saves keep what they bought: the first version ids map to the closest tree level', () => {
  for (const [old, now] of Object.entries(OLD_IDS)) assert.ok(LEVELS.some((l) => l.id === now), `${old} → ${now}`);
  assert.deepEqual(migrateUpgrades(['slot3', 'fastSeal', 'bigPot', 'coconut', 'neon', 'ticket', 'megaphone', 'seat4', 'bogus', 'neon']),
    ['prep2', 'seal2', 'pot2', 'menu2', 'neon', 'ticket', 'mega', 'seat5']);
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  mem.set(SAVE_KEY, JSON.stringify({ v: 1, day: 3, wallet: 1234, fame: 200, upgrades: ['slot3', 'seat4', 'whatever'], best: { 1: 900 }, guideDone: true }));
  const sv = loadSave(storage);
  assert.equal(sv.wallet, 1234);
  assert.equal(sv.day, 3);
  assert.deepEqual(sv.upgrades, ['prep2', 'seat5']);
  const cfg = applyUpgrades(sv.upgrades);
  assert.equal(cfg.workSlots, 4); assert.equal(cfg.seats, 5);
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
  const r = buyUpgrade(s, 'pot2');
  const pot2 = LEVELS.find((l) => l.id === 'pot2').cost;
  assert.ok(r.ok); assert.equal(r.save.wallet, 900 - pot2); assert.deepEqual(r.save.upgrades, ['pot2']);
  assert.ok(!buyUpgrade(r.save, 'seat5').ok, 'not enough money');
  assert.ok(!buyUpgrade({ ...r.save, wallet: 1e6 }, 'pot4').ok, 'pot4 needs pot3');
  assert.ok(writeSave(storage, r.save));
  assert.deepEqual(loadSave(storage).upgrades, ['pot2']);
  assert.ok(SAVE_KEY.startsWith('250cups.shop.'));
});

test('text: zh and en have the same keys, every upgrade named', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort();
  assert.deepEqual(keys(TEXT.zh), keys(TEXT.en));
  for (const u of UPGRADES) assert.ok(TEXT.zh.upgrades[u.id] && TEXT.en.upgrades[u.id], u.id);
  for (const st of STATIONS) assert.ok(TEXT.zh.stations[st.id] && TEXT.en.stations[st.id], st.id);
  for (const t of TABS) assert.ok(TEXT.zh.tabs[t] && TEXT.en.tabs[t]);
});

test('oke art: one bubble per prop, star row', () => {
  for (const o of OKE) assert.match(okeBubbleSVG(o.prop), new RegExp(`data-prop="${o.prop}"`));
  assert.equal((starRowSVG(3).match(/class="star on"/g) || []).length, 3);
});

test('balance sim: a first-time player makes day 1 comfortably; day 3 is busier; cursing well brings a longer line and more money; 1–2 upgrades a day', () => {
  const seeds = [1, 2, 3, 4];
  const avg = (list, f) => list.reduce((a, d) => a + f(d), 0) / list.length;
  const d1 = seeds.map((seed) => playDay({ day: 1, fame: 0, upgrades: [], seed, bot: 'rookie', guide: true }));
  for (const d of d1) assert.ok(d.earned >= DAYS[0].goal * 1.3, `a first-time player earns ${d.earned} on day 1`);
  const n1 = seeds.map((seed) => playDay({ day: 1, fame: 0, upgrades: [], seed, bot: 'new' }));
  const n3 = seeds.map((seed) => playDay({ day: 3, fame: 150, upgrades: [], seed, bot: 'new' }));
  assert.ok(avg(n3, (d) => d.hectic) > avg(n1, (d) => d.hectic) + 0.15, 'day 3 keeps the counter full much more often');
  const best = seeds.map((seed) => playDay({ day: 2, fame: 150, upgrades: [], seed, bot: 'normal', bestP: 1 }));
  const worst = seeds.map((seed) => playDay({ day: 2, fame: 150, upgrades: [], seed, bot: 'normal', bestP: 0 }));
  assert.ok(avg(best, (d) => d.fans) > avg(worst, (d) => d.fans) + 4, 'the best answers bring more fans');
  assert.ok(avg(best, (d) => d.meanLine) > avg(worst, (d) => d.meanLine), 'a longer line');
  assert.ok(avg(best, (d) => d.earned) > avg(worst, (d) => d.earned), 'and more money');
  const career = runCareer('new', 1, { days: 5 });
  const bought = career.map((d) => d.bought.length);
  assert.ok(bought.reduce((a, b) => a + b, 0) >= 5 && bought.reduce((a, b) => a + b, 0) <= 14, `upgrades per day ${bought}`);
});

test('save: the taught 奧客 list survives a round trip and junk is dropped', async () => {
  const { loadSave, writeSave, freshSave } = await import('../src/shop/save.js');
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  assert.deepEqual(freshSave().taught, []);
  writeSave(store, { ...freshSave(), taught: ['c250', 'one', 'c250', 3, null] });
  assert.deepEqual(loadSave(store).taught, ['c250', 'one']);
});

test('save v2: a v1 save (no hinted list) loads with nothing hinted and keeps its upgrades; the new levels survive a round trip', async () => {
  const { loadSave, writeSave, SAVE_V } = await import('../src/shop/save.js');
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  mem.set(SAVE_KEY, JSON.stringify({ v: 1, day: 4, wallet: 2500, fame: 400, upgrades: ['pot2', 'bigPot', 'seat4'], best: { 3: 1500 }, guideDone: true, taught: ['one', 'c250'] }));
  const sv = loadSave(store);
  assert.equal(sv.v, SAVE_V);
  assert.deepEqual(sv.hinted, []);
  assert.deepEqual(sv.upgrades, ['pot2', 'seat5']);
  assert.deepEqual(sv.taught, ['one', 'c250']);
  writeSave(store, { ...sv, upgrades: [...sv.upgrades, 'milk2', 'shaker2', 'shaker3', 'snack2', 'lemon2', 'foam2', 'snack3'], hinted: ['milk', 'shake', 'milk', 7] });
  const back = loadSave(store);
  assert.deepEqual(back.hinted, ['milk', 'shake']);
  assert.ok(['milk2', 'shaker3', 'snack3', 'lemon2', 'foam2'].every((id) => back.upgrades.includes(id)));
  const cfg = applyUpgrades(back.upgrades);
  assert.ok(cfg.autoShake && cfg.autoSnack && cfg.lemonMax === 12 && cfg.milkMs === 200 && cfg.foamMs === 250);
  assert.ok(!canBuy('shaker3', [], 1e6) && canBuy('shaker3', ['shaker2'], 1e6), 'the auto shaker needs the fast one first');
  assert.equal(STATIONS.filter((st) => st.tab === 'bar').map((st) => st.id).join(), 'milk,shaker,foam,lemon,snack');
});
