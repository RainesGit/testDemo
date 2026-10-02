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

test('splitForBleep: default list bleeps the English #67 line but not words containing "ass"', () => {
  assert.deepEqual(splitForBleep('Split my ASS! Whoever pays stays.'), [
    { type: 'text', value: 'Split my ' },
    { type: 'bleep', value: 'ASS' },
    { type: 'text', value: '! Whoever pays stays.' },
  ]);
  assert.deepEqual(splitForBleep('Pass the class, assistant.'), [{ type: 'text', value: 'Pass the class, assistant.' }]);
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

test('buildSpeechPlan: chuuni is one utterance (split utterances sound choppy)', () => {
  const plan = buildSpeechPlan('觉醒吧，我的封印之手！', { style: 'chuuni' });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].rate, STYLE_VOICE.chuuni.rate);
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

test('clipKey is stable, language-scoped and ignores stage directions', async () => {
  const { clipKey } = await import('../src/audio.js');
  assert.match(clipKey('zh', '调你妈！'), /^[0-9a-f]{8}$/);
  assert.equal(clipKey('zh', '（拍柜台）下一位！'), clipKey('zh', '下一位！'));
  assert.notEqual(clipKey('zh', '下一位！'), clipKey('en', '下一位！'));
  assert.equal(clipKey('zh', '下一位！'), clipKey('zh', '下一位！'));
});

// ---- first-minute additions (spec 8.5) ----
import {
  splitPunch, unpipe, ttsText, zhNumber, enNumber, estimateSpeechMs, timingsFromManifest, clipKey as ck,
} from '../src/audio.js';

test('splitPunch: "|" splits setup and punch; no "|" means the whole line is the punch', () => {
  assert.deepEqual(splitPunch('（盯他三秒）还在想？|滚！'), ['（盯他三秒）还在想？', '滚！']);
  assert.deepEqual(splitPunch('调你妈！'), ['', '调你妈！']);
  assert.deepEqual(splitPunch(''), ['', '']);
  assert.equal(unpipe('15杯？|太少，滚！'), '15杯？太少，滚！');
  // each half has its own clip key, stage directions ignored
  assert.equal(ck('zh', splitPunch('（盯他三秒）还在想？|滚！')[0]), ck('zh', '还在想？'));
});

test('zhNumber / ttsText (zh): 250 is read 二百五十, never digit by digit', () => {
  assert.equal(zhNumber(250), '二百五十');
  assert.equal(zhNumber(15), '十五');
  assert.equal(zhNumber(1), '一');
  assert.equal(zhNumber(100), '一百');
  assert.equal(zhNumber(105), '一百零五');
  assert.equal(zhNumber(251), '二百五十一');
  assert.equal(zhNumber(520), '五百二十');
  assert.equal(zhNumber(2000), '两千');
  assert.equal(zhNumber(10000), '一万');
  assert.equal(zhNumber(100000), '十万');
  assert.equal(zhNumber(10010), '一万零一十');
  assert.equal(ttsText('250杯！', 'zh'), '二百五十杯！');
  assert.equal(ttsText('15杯？|太少，滚！', 'zh'), '十五杯？太少，滚！');
  assert.equal(ttsText('251杯！甜度可以37%吗？', 'zh'), '二百五十一杯！甜度可以百分之三十七吗？');
  assert.equal(ttsText('绕过101，上新闻了。', 'zh'), '绕过一零一，上新闻了。');
  assert.equal(ttsText('没有数字', 'zh'), '没有数字');
});

test('enNumber / ttsText (en): the clerk says "two-fifty" (voice-bible 6.1)', () => {
  assert.equal(enNumber(250), 'two-fifty');
  assert.equal(enNumber(251), 'two-fifty-one');
  assert.equal(enNumber(249), 'two-forty-nine');
  assert.equal(enNumber(520), 'five-twenty');
  assert.equal(enNumber(100), 'a hundred');
  assert.equal(enNumber(101), 'one-oh-one');
  assert.equal(enNumber(15), 'fifteen');
  assert.equal(enNumber(1000), 'a thousand');
  assert.equal(ttsText('250 cups!', 'en'), 'two-fifty cups!');
  assert.equal(ttsText('15 cups?|Too small. SCRAM!', 'en'), 'fifteen cups?Too small. SCRAM!');
  assert.equal(ttsText('37% sugar', 'en'), 'thirty-seven percent sugar');
});

test('estimateSpeechMs: grows with length, ignores stage directions, 0 for nothing speakable', () => {
  assert.equal(estimateSpeechMs('（沉默）'), 0);
  assert.ok(estimateSpeechMs('你要几杯？') > estimateSpeechMs('滚！'));
  assert.equal(estimateSpeechMs('（拍桌）滚！'), estimateSpeechMs('滚！'));
  assert.ok(estimateSpeechMs('How many cups?', 'en') > 500);
  // digits are counted as their spoken form
  assert.ok(estimateSpeechMs('250杯') > estimateSpeechMs('二杯'));
});

test('timingsFromManifest: clip lengths, punch gap only between two halves, mega slows the punch', () => {
  const man = { langs: { zh: { clips: { [ck('zh', '还在想？')]: { c: 0, o: 0, d: 0.65 }, [ck('zh', '滚！')]: { c: 0, o: 1, d: 0.4, b: { c: 0, o: 2, d: 0.5 } } } } } };
  const t = timingsFromManifest(man, 'zh', '（盯他）还在想？|滚！', { punchGapMs: 200 });
  assert.deepEqual(t, { setupMs: 650, gapMs: 200, punchStartMs: 850, punchMs: 400, totalMs: 1250, clips: { setup: true, punch: true } });
  const whole = timingsFromManifest(man, 'zh', '滚！');
  assert.equal(whole.setupMs, 0);
  assert.equal(whole.gapMs, 0);
  assert.equal(whole.punchStartMs, 0);
  assert.equal(whole.punchMs, 400);
  assert.equal(timingsFromManifest(man, 'zh', '滚！', { punchFx: 'mega' }).punchMs, Math.round(400 / 0.94));
  assert.equal(timingsFromManifest(man, 'zh', '滚！', { bleep: true }).punchMs, 500);
  const est = timingsFromManifest(null, 'zh', '15杯？|太少，滚！', { punchGapMs: 630 });
  assert.equal(est.clips.setup, false);
  assert.equal(est.punchStartMs, est.setupMs + 630);
  assert.equal(timingsFromManifest(man, 'zh', '滚！', { rate: 2 }).punchMs, 200);
});

test('createAudio: first-minute methods exist and degrade silently; playClerk carries timing synchronously', async () => {
  const a = createAudio();
  for (const k of ['playClerk', 'playCustomer', 'voiceTimings', 'cut', 'hush', 'duck', 'restore', 'bed', 'loop', 'stopLoop', 'stopLoops']) {
    assert.equal(typeof a[k], 'function', k);
  }
  const p = a.playClerk('还在想？|滚！', { punchGapMs: 200 });
  assert.equal(typeof p.then, 'function');
  assert.ok(p.setupMs > 0 && p.punchMs > 0);
  assert.equal(p.punchStartMs, p.setupMs + 200);
  const r = await p;
  assert.equal(r.punchMs, p.punchMs);
  const c = a.playCustomer('250杯！', { rate: 1.08 });
  assert.ok(c.ms > 0);
  a.unlock();
  for (const n of ['gate', 'boom', 'press', 'card', 'tick', 'tap', 'coin', 'bell', 'dingdong', 'stamp', 'clock', 'sigh',
    'scratch', 'feedback', 'sparkle', 'drumroll', 'crowdOh', 'huh']) {
    assert.equal(a.sfx(n), 0, n); // no AudioContext in node → 0, no throw
  }
  const h = a.loop('musicbox');
  h.detune(-50);
  h.stop(20);
  a.cut();
  a.hush();
  a.duck(-60, 30);
  a.restore(200);
  a.bed(true);
  await a.playClerk('调你妈！', { punchFx: 'mega' });
  await a.speak('还在想？|滚！', { style: 'curse' });
});
