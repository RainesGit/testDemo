import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickHuazi, splitLine, stripStage, subtitleParts, isAllowedHuazi, s4Symbol, huaziTimes, huaziDuration, createHuaziTracker, HZ_GAP_MS } from '../src/huazi.js';

const brief = (list) => list.map(({ text, style, seg }) => [text, style, seg]);

test('splitLine: stage directions removed, "|" splits setup / punch', () => {
  assert.deepEqual(splitLine('（盯他三秒，深吸一口氣）還在想？|滾！'), { setup: '還在想？', punch: '滾！' });
  assert.deepEqual(splitLine('全部。下一題。'), { setup: '', punch: '全部。下一題。' });
  assert.equal(stripStage('(checks watch) Out.'), 'Out.');
});

test('subtitleParts: the "|" cut, else the last sentence, an X你媽 clause, a short line is all punch', () => {
  assert.deepEqual(subtitleParts('（盯他三秒）還在想？|滾！'), { setup: '還在想？', punch: '滾！' });
  assert.deepEqual(subtitleParts('沒有。輪完了。下一位。'), { setup: '沒有。輪完了。', punch: '下一位。' });
  assert.deepEqual(subtitleParts('改你媽！再改，改去隔壁。'), { setup: '', punch: '改你媽！再改，改去隔壁。' });
  assert.deepEqual(subtitleParts('好。調你媽！'), { setup: '好。', punch: '調你媽！' });
  assert.deepEqual(subtitleParts('收。'), { setup: '', punch: '收。' });
  assert.deepEqual(subtitleParts('（指菜單）一個左邊一個右邊點一下就好了'), { setup: '一個左邊一個右邊點一下就好了', punch: '' });
  assert.deepEqual(subtitleParts('Still thinking?|SCRAM!'), { setup: 'Still thinking? ', punch: 'SCRAM!' });
  assert.equal(subtitleParts('（拿出水桶）').punch + subtitleParts('（拿出水桶）').setup, '', 'stage directions are never shown');
});

test('allowed: X你媽 is S1 and wins over everything', () => {
  assert.deepEqual(brief(pickHuazi('調你媽！|黃金比例最好喝！', { mode: 'opening' })), [['調你媽！', 'S1', 'setup']]);
  assert.deepEqual(brief(pickHuazi('調你媽！', { mode: 'opening' })), [['調你媽！', 'S1', 'punch']]);
  assert.deepEqual(brief(pickHuazi('ADJUST YOUR MOM!', { lang: 'en', mode: 'opening' })), [['ADJUST YOUR MOM!', 'S1', 'punch']]);
});

test('allowed: signature numbers are S2, with 杯 when it follows', () => {
  assert.deepEqual(brief(pickHuazi('250杯，', { mode: 'opening' })), [['250杯', 'S2', 'punch']]);
  assert.deepEqual(brief(pickHuazi('（突然職業）二百五十杯——什麼？')), [['二百五', 'S2', 'punch']]);
  assert.deepEqual(brief(pickHuazi('520? Fine.')), [['520', 'S2', 'punch']]);
  assert.deepEqual(brief(pickHuazi('Okay. Two-fifty. Of what?', { lang: 'en' })), [['250', 'S2', 'punch']]);
});

test('滾 / 閉嘴 / 收 are a 花字 only at the big FX level; otherwise subtitle emphasis', () => {
  assert.deepEqual(brief(pickHuazi('15杯？|太少，滾！', { mode: 'opening' })), [['滾！', 'emph', 'punch']]);
  assert.deepEqual(brief(pickHuazi('你很吵。閉嘴！')), [['閉嘴！', 'emph', 'punch']]);
  assert.deepEqual(brief(pickHuazi('你很吵。閉嘴！', { big: true })), [['閉嘴！', 'S1', 'punch']]);
  assert.deepEqual(brief(pickHuazi('（拍櫃檯）及格！今天第一個。收。', { exempt: true })), [['收！', 'S1', 'punch']], 'exempt is the old name of big');
  assert.equal(pickHuazi('Still thinking?|SCRAM!', { lang: 'en' })[0].style, 'emph');
});

test('黃金比例最好喝 is S2; plain 黃金比例 and 兩個月 in play are emphasis; 兩個月後 is S5 in the opening', () => {
  assert.deepEqual(brief(pickHuazi('黃金比例最好喝！', { mode: 'opening' })), [['黃金比例最好喝', 'S2', 'punch']]);
  assert.deepEqual(brief(pickHuazi('不能調，黃金比例。')), [['黃金比例', 'emph', 'punch']]);
  assert.deepEqual(brief(pickHuazi('（按兩下）各一百。兩個月後來拿。')), [['兩個月後', 'emph', 'punch']]);
  assert.equal(pickHuazi('兩個月後過來拿。', { mode: 'opening' })[0].style, 'S5');
  assert.equal(pickHuazi('Golden ratio. Booked.', { lang: 'en' })[0].style, 'emph');
});

test('no S3 any more: a short setup question or a tail clause gets nothing', () => {
  assert.deepEqual(pickHuazi('還在想？|你好。'), []);
  assert.deepEqual(pickHuazi('本店推薦：你離開。第二名：你快點離開。'), []);
  assert.deepEqual(pickHuazi('藏寶圖喔？就一面。下一位。'), []);
});

test('at most one item per line, and an allowed 花字 beats an emphasis', () => {
  const r = pickHuazi('250？|兩個月後，黃金比例，滾！', { mode: 'opening' });
  assert.equal(r.length, 1);
  assert.deepEqual(brief(r), [['250', 'S2', 'setup']]);
  for (const it of pickHuazi('那個那個那個那個那個？|走')) assert.ok([...it.text].length <= 7);
});

test('manual hua override: S3 dropped, a plain curse becomes emphasis unless big', () => {
  const r = pickHuazi('（看都不看）太少，滾！', { hua: [['太少', 3], ['滾！', 1]], mode: 'opening' });
  assert.deepEqual(brief(r), [['滾！', 'emph', 'punch']]);
  assert.deepEqual(brief(pickHuazi('太少，滾！', { hua: [['滾！', 1]], big: true })), [['滾！', 'S1', 'punch']]);
});

test('isAllowedHuazi: the allow list for direct ui.huazi calls', () => {
  const ok = (text, style, extra = {}) => isAllowedHuazi({ text, style, ...extra });
  assert.equal(ok('調你媽！', 'S1'), true);
  assert.equal(ok('250', 'S1'), true);
  assert.equal(ok('二百五！', 'S1'), true);
  assert.equal(ok('黃金比例最好喝', 'S2'), true);
  assert.equal(ok('第 2 天', 'S5'), true);
  assert.equal(ok('？？？', 'S4'), true);
  for (const t of ['反差！', '快嘴！', '爆氣！', '全倒！', 'STRIKE!', '狠罵！', 'CONTRAST!']) assert.equal(ok(t, 'S1'), false, t);
  assert.equal(ok('一把掃過去！', 'S3'), false);
  assert.equal(ok('氣勢沒了＝被迫營業', 3), false);
  assert.equal(ok('滾！', 'S1'), false);
  assert.equal(ok('滾！', 'S1', { big: true }), true);
});

test('s4Symbol: words become symbols', () => {
  assert.deepEqual(s4Symbol('？？？'), { text: '？？？', mark: 'q' });
  assert.equal(s4Symbol('???').text, '？？？');
  for (const w of ['（自信）', '（呆住）', '（還在調）', '（手停住）', '(frozen)', '隨便什麼']) {
    const s = s4Symbol(w).text;
    assert.ok(/^[？！…]+$/.test(s), `${w} → ${s}`);
  }
});

test('repeat limit: the same keyword is not repeated within 5 customers; the opening is not limited', () => {
  const t = createHuaziTracker();
  const out = [];
  for (let i = 0; i < 6; i++) { t.next(); out.push(t.pick('（拍櫃檯）250杯。')[0].style); }
  assert.deepEqual(out, ['S2', 'emph', 'emph', 'emph', 'emph', 'S2']);
  const o = createHuaziTracker({ mode: 'opening' });
  o.next(); o.pick('250杯');
  o.next();
  assert.equal(o.pick('250杯')[0].style, 'S2');
  // the old one-S1-per-3-customers limit is gone: 調你媽 twice in a row both show
  const c = createHuaziTracker();
  c.next(); assert.equal(c.pick('調你媽！')[0].style, 'S1');
  c.next(); assert.equal(c.pick('改你媽！')[0].style, 'S1');
});

test('timing: punch at start + clip × ratio; 花字 at least 900 ms apart', () => {
  assert.equal(HZ_GAP_MS, 900);
  const list = pickHuazi('好喔|調你媽！', { mode: 'opening' });
  assert.deepEqual(huaziTimes(list, { setupMs: 550, punchStartMs: 1180, punchMs: 850 }), [1180]);
  const close = huaziTimes([{ style: 'S4', seg: 'setup' }, { style: 'S1', seg: 'punch', ratio: 0 }], { setupMs: 100, punchStartMs: 200, punchMs: 300 });
  assert.deepEqual(close, [0, 900]);
});

test('huaziDuration: fixed per style, S5 grows with its text', () => {
  assert.equal(huaziDuration({ style: 'S1' }), 1000);
  assert.equal(huaziDuration({ style: 'S2' }), 1500);
  assert.ok(huaziDuration({ style: 'S5', text: '兩個月後', charMs: 80 }) > huaziDuration({ style: 'S5', text: '兩個', charMs: 80 }));
});
