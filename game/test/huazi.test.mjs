import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickHuazi, splitLine, stripStage, huaziTimes, huaziDuration, createHuaziTracker } from '../src/huazi.js';

const brief = (list) => list.map(({ text, style, seg }) => [text, style, seg]);

test('splitLine: stage directions removed, "|" splits setup / punch', () => {
  assert.deepEqual(splitLine('（盯他三秒，深吸一口氣）還在想？|滾！'), { setup: '還在想？', punch: '滾！' });
  assert.deepEqual(splitLine('全部。下一題。'), { setup: '', punch: '全部。下一題。' });
  assert.equal(stripStage('(checks watch) Out.'), 'Out.');
});

test('rule 100: X你媽 wins over everything and is S1', () => {
  assert.deepEqual(brief(pickHuazi('調你媽！|黃金比例最好喝！', { mode: 'opening' })), [['調你媽！', 'S1', 'setup']]);
  assert.deepEqual(brief(pickHuazi('調你媽！', { mode: 'opening' })), [['調你媽！', 'S1', 'punch']]);
});

test('rule 90: signature numbers are S2, with 杯 when it follows', () => {
  assert.deepEqual(brief(pickHuazi('250杯，', { mode: 'opening' })), [['250杯', 'S2', 'punch']]);
  assert.deepEqual(brief(pickHuazi('（突然職業）二百五十杯——什麼？')), [['二百五', 'S2', 'punch']]);
  assert.deepEqual(brief(pickHuazi('520? Fine.')), [['520', 'S2', 'punch']]);
  assert.deepEqual(brief(pickHuazi('Okay. Two-fifty. Of what?', { lang: 'en' })), [['250', 'S2', 'punch']]);
});

test('rule 80: curse word at the end of a segment; 收 is S2, 滾/閉嘴 S1; ratio from position', () => {
  const r = pickHuazi('15杯？|太少，滾！', { mode: 'opening' });
  assert.deepEqual(brief(r), [['15杯？', 'S3', 'setup'], ['滾！', 'S1', 'punch']]);
  assert.equal(r[1].ratio, 3 / 5);
  assert.deepEqual(brief(pickHuazi('（拍櫃檯）及格！今天第一個。收。')), [['收！', 'S2', 'punch']]);
  assert.deepEqual(brief(pickHuazi('你很吵。閉嘴！')), [['閉嘴！', 'S1', 'punch']]);
  assert.deepEqual(brief(pickHuazi('Still thinking?|SCRAM!', { lang: 'en' })), [['Still thinking?', 'S3', 'setup'], ['SCRAM!', 'S1', 'punch']]);
  assert.equal(pickHuazi('A hundred. Booked.', { lang: 'en' })[0].style, 'S2');
});

test('rule 75 and 70: 黃金比例(最好喝), 兩個月 (S2 small in play, S5 in opening)', () => {
  assert.deepEqual(brief(pickHuazi('黃金比例最好喝！', { mode: 'opening' })), [['黃金比例最好喝', 'S2', 'punch']]);
  assert.deepEqual(brief(pickHuazi('不能調，黃金比例。')), [['黃金比例', 'S2', 'punch']]);
  const play = pickHuazi('（按兩下）各一百。兩個月後來拿。');
  assert.deepEqual(brief(play), [['兩個月後', 'S2', 'punch']]);
  assert.equal(play[0].size, 'sm');
  assert.equal(pickHuazi('兩個月後過來拿。', { mode: 'opening' })[0].style, 'S5');
});

test('rule 50 and 40: short setup question is S3; otherwise the last short clause of the punch', () => {
  assert.deepEqual(brief(pickHuazi('還在想？|你好。')), [['還在想？', 'S3', 'setup']]);
  assert.deepEqual(brief(pickHuazi('本店推薦：你離開。第二名：你快點離開。')), []);
  assert.deepEqual(brief(pickHuazi('藏寶圖喔？就一面。下一位。')), [['下一位', 'S3', 'punch']]);
});

test('limit 1: never more than one S3 plus one big item', () => {
  const r = pickHuazi('250？|兩個月後，黃金比例，滾！', { mode: 'opening' });
  assert.ok(r.length <= 2);
  assert.ok(r.filter((x) => x.style !== 'S3').length <= 1);
});

test('limit 5: display text is capped to the matched part', () => {
  for (const it of pickHuazi('那個那個那個那個那個？|走')) assert.ok([...it.text].length <= 7);
});

test('manual hua override skips the automatic rules', () => {
  const r = pickHuazi('（看都不看）太少，滾！', { hua: [['太少', 3], ['滾！', 1]], mode: 'opening' });
  assert.deepEqual(brief(r), [['太少', 'S3', 'punch'], ['滾！', 'S1', 'punch']]);
});

test('limit 2: at most one S1 per 3 customers in normal play (extra S1 becomes subtitle emphasis)', () => {
  const t = createHuaziTracker({ mode: 'normal' });
  const styles = [];
  const lines = ['還在想？|滾！', '走開。閉嘴！', '你。走。滾！', '再來。閉嘴！'];
  for (const l of lines) { t.next(); styles.push(t.pick(l).find((x) => x.seg === 'punch').style); }
  assert.deepEqual(styles, ['S1', 'emph', 'emph', 'S1']);
  // exempt (charge 2 / revenge / rage) ignores the S1 limit
  const t2 = createHuaziTracker();
  t2.next(); t2.pick('滾！');
  t2.next();
  assert.equal(t2.pick('你給我閉嘴！', { exempt: true })[0].style, 'S1');
});

test('limit 3: the same keyword is not repeated within 5 customers; opening mode is not limited', () => {
  const t = createHuaziTracker();
  const out = [];
  for (let i = 0; i < 6; i++) { t.next(); out.push(t.pick('（拍櫃檯）收。')[0].style); }
  assert.deepEqual(out, ['S2', 'emph', 'emph', 'emph', 'emph', 'S2']);
  const o = createHuaziTracker({ mode: 'opening' });
  o.next(); o.pick('還在想？|滾！');
  o.next();
  assert.equal(o.pick('15杯？|太少，滾！')[1].style, 'S1');
});

test('limit 4 / timing: S3 at segment start, punch at start + clip × ratio, 450ms apart', () => {
  const list = pickHuazi('15杯？|太少，滾！', { mode: 'opening' });
  const times = huaziTimes(list, { setupMs: 550, punchStartMs: 1180, punchMs: 850 });
  assert.deepEqual(times, [0, 1180 + Math.round(850 * 0.6)]);
  const close = huaziTimes([{ style: 'S3', seg: 'setup' }, { style: 'S1', seg: 'punch', ratio: 0 }], { setupMs: 100, punchStartMs: 200, punchMs: 300 });
  assert.deepEqual(close, [0, 450]);
});

test('huaziDuration: fixed per style, S5 grows with its text', () => {
  assert.equal(huaziDuration({ style: 'S1' }), 1000);
  assert.equal(huaziDuration({ style: 'S2' }), 1500);
  assert.equal(huaziDuration({ style: 'S3' }), 1160);
  assert.ok(huaziDuration({ style: 'S5', text: '兩個月後', charMs: 80 }) > huaziDuration({ style: 'S5', text: '兩個', charMs: 80 }));
});
