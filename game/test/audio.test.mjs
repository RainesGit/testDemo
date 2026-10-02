import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitForBleep, stripStage, styleParams, chuuniSplit, buildSpeechPlan,
  DEFAULT_BLEEP_WORDS, STYLE_VOICE, createAudio,
} from '../src/audio.js';

test('splitForBleep: no words → single text segment', () => {
  assert.deepEqual(splitForBleep('来250杯！', []), [{ type: 'text', value: '来250杯！' }]);
  assert.deepEqual(splitForBleep('', ['x']), []);
});

test('splitForBleep: bleeps Chinese curse words in the middle, start and end', () => {
  assert.deepEqual(splitForBleep('你妈的，滚！', DEFAULT_BLEEP_WORDS), [
    { type: 'bleep', value: '你妈的' },
    { type: 'text', value: '，滚！' },
  ]);
  assert.deepEqual(splitForBleep('点个奶茶要十分钟，靠北', DEFAULT_BLEEP_WORDS), [
    { type: 'text', value: '点个奶茶要十分钟，' },
    { type: 'bleep', value: '靠北' },
  ]);
  assert.deepEqual(splitForBleep('滚！他妈的闭嘴！', ['他妈的', '他妈']), [
    { type: 'text', value: '滚！' },
    { type: 'bleep', value: '他妈的' },
    { type: 'text', value: '闭嘴！' },
  ]);
});

test('splitForBleep: longest match wins regardless of list order', () => {
  assert.deepEqual(splitForBleep('你妈的', ['你妈', '你妈的']), [{ type: 'bleep', value: '你妈的' }]);
});

test('splitForBleep: adjacent bleeps stay separate, text is preserved exactly', () => {
  const segs = splitForBleep('靠北靠北！', ['靠北']);
  assert.deepEqual(segs, [
    { type: 'bleep', value: '靠北' },
    { type: 'bleep', value: '靠北' },
    { type: 'text', value: '！' },
  ]);
  const s = '干！你妈在等你，靠北喔';
  assert.equal(splitForBleep(s).map((x) => x.value).join(''), s);
});

test('splitForBleep: English is case-insensitive and respects word boundaries', () => {
  assert.deepEqual(splitForBleep('Ask YOUR MOM, then get out.', DEFAULT_BLEEP_WORDS), [
    { type: 'text', value: 'Ask ' },
    { type: 'bleep', value: 'YOUR MOM' },
    { type: 'text', value: ', then get out.' },
  ]);
  assert.deepEqual(splitForBleep('Hello, shell company', ['hell']), [
    { type: 'text', value: 'Hello, shell company' },
  ]);
  assert.deepEqual(splitForBleep('What the hell?', ['hell']), [
    { type: 'text', value: 'What the ' },
    { type: 'bleep', value: 'hell' },
    { type: 'text', value: '?' },
  ]);
});

test('splitForBleep: default list does not bleep innocent 干 (干杯/饼干/干嘛)', () => {
  for (const s of ['干杯！', '吃饼干', '你干嘛？', '不干了', '干净一点']) {
    assert.deepEqual(splitForBleep(s), [{ type: 'text', value: s }], s);
  }
  assert.deepEqual(splitForBleep('干！'), [{ type: 'bleep', value: '干' }, { type: 'text', value: '！' }]);
  assert.deepEqual(splitForBleep('幹！'), [{ type: 'bleep', value: '幹' }, { type: 'text', value: '！' }]);
});

test('splitForBleep: regex metacharacters in words are literal', () => {
  assert.deepEqual(splitForBleep('a.b axb', ['a.b']), [
    { type: 'bleep', value: 'a.b' },
    { type: 'text', value: ' axb' },
  ]);
});

test('stripStage removes full-width and half-width stage directions', () => {
  assert.equal(stripStage('（盯他三秒，深吸一口气）……还在想？滚！'), '……还在想？滚！');
  assert.equal(stripStage('(slams counter) Next!'), 'Next!');
  assert.equal(stripStage('收！（敲杯）两百五十杯（冷笑）'), '收！ 两百五十杯');
  assert.equal(stripStage(null), '');
});

test('styleParams maps styles and lets explicit opts override', () => {
  const curse = styleParams('curse');
  const cold = styleParams('cold');
  assert.ok(curse.rate > 1 && curse.pitch > 1, 'curse is fast and high');
  assert.ok(cold.rate < 1 && cold.pitch < 1, 'cold is slow and low');
  assert.deepEqual(styleParams('nope'), { rate: STYLE_VOICE.real.rate, pitch: STYLE_VOICE.real.pitch });
  assert.deepEqual(styleParams('curse', { rate: 2, pitch: 0.5 }), { rate: 2, pitch: 0.5 });
  assert.deepEqual(styleParams('curse', { rate: 99, pitch: -1 }), { rate: 10, pitch: 0 });
});

test('chuuniSplit splits at the first pause, else at one third', () => {
  assert.deepEqual(chuuniSplit('吾之右手……已经封印不住了！滚！'), ['吾之右手……', '已经封印不住了！滚！']);
  const [a, b] = chuuniSplit('abcdefghi');
  assert.equal(a + b, 'abcdefghi');
  assert.ok(a.length >= 2 && b.length > 0);
});

test('buildSpeechPlan: strips stage directions, applies style, inserts bleeps', () => {
  const plan = buildSpeechPlan('（拍桌）你妈的，滚！', { style: 'curse', bleep: true });
  assert.equal(plan.length, 2);
  assert.deepEqual(plan[0], { type: 'bleep', value: '你妈的' });
  assert.equal(plan[1].type, 'say');
  assert.equal(plan[1].text, '，滚！');
  assert.equal(plan[1].rate, STYLE_VOICE.curse.rate);

  const noBleep = buildSpeechPlan('你妈的，滚！', { style: 'cold', bleep: false });
  assert.deepEqual(noBleep, [{ type: 'say', text: '你妈的，滚！', rate: STYLE_VOICE.cold.rate, pitch: STYLE_VOICE.cold.pitch }]);

  assert.deepEqual(buildSpeechPlan('（沉默）', {}), []);
});

test('buildSpeechPlan: chuuni starts slow then speeds up', () => {
  const plan = buildSpeechPlan('觉醒吧，我的封印之手！', { style: 'chuuni' });
  assert.equal(plan.length, 2);
  assert.ok(plan[0].rate < plan[1].rate);
});

test('createAudio degrades silently without browser APIs', async () => {
  const a = createAudio();
  for (const k of ['unlock', 'setLang', 'setBleep', 'speak', 'sfx', 'crowd', 'stopSpeech']) {
    assert.equal(typeof a[k], 'function', k);
  }
  a.unlock();
  a.setLang('en');
  a.setBleep(true);
  assert.equal(a.sfx('slam'), 0);
  a.crowd(0.5);
  await a.speak('Your mom! (slams counter) Next!', { style: 'curse' });
  a.stopSpeech();
});
