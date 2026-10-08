import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitForBleep, stripStage, styleParams, chuuniSplit, buildSpeechPlan,
  DEFAULT_BLEEP_WORDS, STYLE_VOICE, createAudio,
} from '../src/audio.js';

test('splitForBleep: no words → single text segment', () => {
  assert.deepEqual(splitForBleep('來250杯！', []), [{ type: 'text', value: '來250杯！' }]);
  assert.deepEqual(splitForBleep('', ['x']), []);
});

test('splitForBleep: bleeps Chinese curse words in the middle, start and end', () => {
  assert.deepEqual(splitForBleep('你媽的，滾！', DEFAULT_BLEEP_WORDS), [
    { type: 'bleep', value: '你媽的' },
    { type: 'text', value: '，滾！' },
  ]);
  assert.deepEqual(splitForBleep('點個奶茶要十分鐘，靠北', DEFAULT_BLEEP_WORDS), [
    { type: 'text', value: '點個奶茶要十分鐘，' },
    { type: 'bleep', value: '靠北' },
  ]);
  assert.deepEqual(splitForBleep('滾！他媽的閉嘴！', ['他媽的', '他媽']), [
    { type: 'text', value: '滾！' },
    { type: 'bleep', value: '他媽的' },
    { type: 'text', value: '閉嘴！' },
  ]);
});

test('splitForBleep: longest match wins regardless of list order', () => {
  assert.deepEqual(splitForBleep('你媽的', ['你媽', '你媽的']), [{ type: 'bleep', value: '你媽的' }]);
});

test('splitForBleep: adjacent bleeps stay separate, text is preserved exactly', () => {
  const segs = splitForBleep('靠北靠北！', ['靠北']);
  assert.deepEqual(segs, [
    { type: 'bleep', value: '靠北' },
    { type: 'bleep', value: '靠北' },
    { type: 'text', value: '！' },
  ]);
  const s = '幹！你媽在等你，靠北喔';
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

test('splitForBleep: default list does not bleep innocent 幹 (乾杯/餅乾/幹嘛)', () => {
  for (const s of ['乾杯！', '吃餅乾', '你幹嘛？', '不幹了', '乾淨一點']) {
    assert.deepEqual(splitForBleep(s), [{ type: 'text', value: s }], s);
  }
  assert.deepEqual(splitForBleep('幹！'), [{ type: 'bleep', value: '幹' }, { type: 'text', value: '！' }]);
  assert.deepEqual(splitForBleep('幹！'), [{ type: 'bleep', value: '幹' }, { type: 'text', value: '！' }]);
});

test('splitForBleep: regex metacharacters in words are literal', () => {
  assert.deepEqual(splitForBleep('a.b axb', ['a.b']), [
    { type: 'bleep', value: 'a.b' },
    { type: 'text', value: ' axb' },
  ]);
});

test('stripStage removes full-width and half-width stage directions', () => {
  assert.equal(stripStage('（盯他三秒，深吸一口氣）……還在想？滾！'), '……還在想？滾！');
  assert.equal(stripStage('(slams counter) Next!'), 'Next!');
  assert.equal(stripStage('收！（敲杯）兩百五十杯（冷笑）'), '收！ 兩百五十杯');
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
  assert.deepEqual(chuuniSplit('吾之右手……已經封印不住了！滾！'), ['吾之右手……', '已經封印不住了！滾！']);
  const [a, b] = chuuniSplit('abcdefghi');
  assert.equal(a + b, 'abcdefghi');
  assert.ok(a.length >= 2 && b.length > 0);
});

test('buildSpeechPlan: strips stage directions, applies style, inserts bleeps', () => {
  const plan = buildSpeechPlan('（拍桌）你媽的，滾！', { style: 'curse', bleep: true });
  assert.equal(plan.length, 2);
  assert.deepEqual(plan[0], { type: 'bleep', value: '你媽的' });
  assert.equal(plan[1].type, 'say');
  assert.equal(plan[1].text, '，滾！');
  assert.equal(plan[1].rate, STYLE_VOICE.curse.rate);

  const noBleep = buildSpeechPlan('你媽的，滾！', { style: 'cold', bleep: false });
  assert.deepEqual(noBleep, [{ type: 'say', text: '你媽的，滾！', rate: STYLE_VOICE.cold.rate, pitch: STYLE_VOICE.cold.pitch }]);

  assert.deepEqual(buildSpeechPlan('（沉默）', {}), []);
});

test('buildSpeechPlan: chuuni is one utterance (split utterances sound choppy)', () => {
  const plan = buildSpeechPlan('覺醒吧，我的封印之手！', { style: 'chuuni' });
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
  assert.match(clipKey('zh', '調你媽！'), /^[0-9a-f]{8}$/);
  assert.equal(clipKey('zh', '（拍櫃檯）下一位！'), clipKey('zh', '下一位！'));
  assert.notEqual(clipKey('zh', '下一位！'), clipKey('en', '下一位！'));
  assert.equal(clipKey('zh', '下一位！'), clipKey('zh', '下一位！'));
});

// ---- first-minute additions (spec 8.5) ----
import {
  splitPunch, unpipe, ttsText, zhNumber, enNumber, estimateSpeechMs, timingsFromManifest, clipKey as ck,
} from '../src/audio.js';

test('splitPunch: "|" splits setup and punch; no "|" means the whole line is the punch', () => {
  assert.deepEqual(splitPunch('（盯他三秒）還在想？|滾！'), ['（盯他三秒）還在想？', '滾！']);
  assert.deepEqual(splitPunch('調你媽！'), ['', '調你媽！']);
  assert.deepEqual(splitPunch(''), ['', '']);
  assert.equal(unpipe('15杯？|太少，滾！'), '15杯？太少，滾！');
  // each half has its own clip key, stage directions ignored
  assert.equal(ck('zh', splitPunch('（盯他三秒）還在想？|滾！')[0]), ck('zh', '還在想？'));
});

test('zhNumber / ttsText (zh): 250 is read 二百五十, never digit by digit', () => {
  assert.equal(zhNumber(250), '二百五十');
  assert.equal(zhNumber(15), '十五');
  assert.equal(zhNumber(1), '一');
  assert.equal(zhNumber(100), '一百');
  assert.equal(zhNumber(105), '一百零五');
  assert.equal(zhNumber(251), '二百五十一');
  assert.equal(zhNumber(520), '五百二十');
  assert.equal(zhNumber(2000), '兩千');
  assert.equal(zhNumber(10000), '一萬');
  assert.equal(zhNumber(100000), '十萬');
  assert.equal(zhNumber(10010), '一萬零一十');
  assert.equal(ttsText('250杯！', 'zh'), '二百五十杯！');
  assert.equal(ttsText('15杯？|太少，滾！', 'zh'), '十五杯？太少，滾！');
  assert.equal(ttsText('251杯！甜度可以37%嗎？', 'zh'), '二百五十一杯！甜度可以百分之三十七嗎？');
  assert.equal(ttsText('繞過101，上新聞了。', 'zh'), '繞過一零一，上新聞了。');
  assert.equal(ttsText('沒有數字', 'zh'), '沒有數字');
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
  assert.ok(estimateSpeechMs('你要幾杯？') > estimateSpeechMs('滾！'));
  assert.equal(estimateSpeechMs('（拍桌）滾！'), estimateSpeechMs('滾！'));
  assert.ok(estimateSpeechMs('How many cups?', 'en') > 500);
  // digits are counted as their spoken form
  assert.ok(estimateSpeechMs('250杯') > estimateSpeechMs('二杯'));
});

test('timingsFromManifest: clip lengths, punch gap only between two halves, mega slows the punch', () => {
  const man = { langs: { zh: { clips: { [ck('zh', '還在想？')]: { c: 0, o: 0, d: 0.65 }, [ck('zh', '滾！')]: { c: 0, o: 1, d: 0.4, b: { c: 0, o: 2, d: 0.5 } } } } } };
  const t = timingsFromManifest(man, 'zh', '（盯他）還在想？|滾！', { punchGapMs: 200 });
  assert.deepEqual(t, { setupMs: 650, gapMs: 200, punchStartMs: 850, punchMs: 400, totalMs: 1250, clips: { setup: true, punch: true } });
  const whole = timingsFromManifest(man, 'zh', '滾！');
  assert.equal(whole.setupMs, 0);
  assert.equal(whole.gapMs, 0);
  assert.equal(whole.punchStartMs, 0);
  assert.equal(whole.punchMs, 400);
  assert.equal(timingsFromManifest(man, 'zh', '滾！', { punchFx: 'mega' }).punchMs, Math.round(400 / 0.94));
  assert.equal(timingsFromManifest(man, 'zh', '滾！', { bleep: true }).punchMs, 500);
  const est = timingsFromManifest(null, 'zh', '15杯？|太少，滾！', { punchGapMs: 630 });
  assert.equal(est.clips.setup, false);
  assert.equal(est.punchStartMs, est.setupMs + 630);
  assert.equal(timingsFromManifest(man, 'zh', '滾！', { rate: 2 }).punchMs, 200);
});

test('createAudio: first-minute methods exist and degrade silently; playClerk carries timing synchronously', async () => {
  const a = createAudio();
  for (const k of ['playClerk', 'playCustomer', 'voiceTimings', 'cut', 'hush', 'duck', 'restore', 'bed', 'loop', 'stopLoop', 'stopLoops']) {
    assert.equal(typeof a[k], 'function', k);
  }
  const p = a.playClerk('還在想？|滾！', { punchGapMs: 200 });
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
  await a.playClerk('調你媽！', { punchFx: 'mega' });
  await a.speak('還在想？|滾！', { style: 'curse' });
});

// ---- runtime voice punch (VOICE_FX / voicePlan) ----
import { voicePlan, VOICE_FX, PUNCH_RATE, CLIP_RATE, hasCurse, dbToGain } from '../src/audio.js';

test('voicePlan: off (legacy) keeps the spec 8.5 chain exactly', () => {
  const p = voicePlan('還在想？|滾！', { fx: 'curse' });
  assert.equal(p.hit, null);
  assert.deepEqual(p.setup, { rate: 1, gainDb: 0, chain: null });
  assert.deepEqual(p.punch, { rate: 1, gainDb: 0, chain: 'legacy', fx: 'curse' });
  assert.equal(voicePlan('調你媽！', { fx: 'mega' }).punch.rate, PUNCH_RATE.mega);
  assert.equal(voicePlan('滾！', { style: 'rage', via: 'speak' }).punch.chain, null); // speak(): no chain
  assert.equal(voicePlan('滾！', { style: 'rage', voiceFx: { enabled: false } }).punch.chain, 'legacy');
});

test('voicePlan: the punch half of a cut-point line gets the punch chain, the polite setup stays clean and softer', () => {
  const p = voicePlan('（盯他三秒）還在想？|滾！', { voiceFx: true });
  assert.equal(p.hit, 'punch');
  assert.equal(p.breathMs, 0); // the punchGapMs silence is the breath
  assert.deepEqual(p.setup, { rate: 1, gainDb: VOICE_FX.setupDb, chain: null });
  assert.equal(p.punch.chain, 'punch');
  assert.equal(p.punch.rate, VOICE_FX.punchRate);
  assert.ok(p.punch.rate >= 1.04 && p.punch.rate <= 1.08);
  assert.ok(p.punch.driveDb >= 4 && p.punch.driveDb <= 6);
  assert.equal(p.punch.compress, true);
  assert.equal(p.punch.saturation, VOICE_FX.gentleK);
  assert.equal(p.punch.impact, true);
  assert.equal(p.punch.megaphone, false);
  // curse / big landing: hotter (spec k = 8 curve, +1 dB)
  const c = voicePlan('15杯？|太少，滾！', { fx: 'curse', voiceFx: true });
  assert.equal(c.punch.saturation, 'hot');
  assert.equal(c.punch.driveDb, VOICE_FX.driveDb + 1);
  // English lines work the same way
  assert.equal(voicePlan('Still thinking?|SCRAM!', { voiceFx: true }).hit, 'punch');
});

test('voicePlan: when the curse comes first, the curse half is the hit and the professional half stays clean', () => {
  for (const line of ['調你媽！|黃金比例最好喝！', 'ADJUST your MOM!|The golden ratio is PERFECT!']) {
    const p = voicePlan(line, { fx: 'mega', voiceFx: true });
    assert.equal(p.hit, 'setup', line);
    assert.equal(p.setup.chain, 'punch');
    assert.equal(p.setup.rate, PUNCH_RATE.mega);
    assert.equal(p.setup.echo, true);
    assert.equal(p.setup.impact, true);
    assert.deepEqual(p.punch, { rate: 1, gainDb: 0, chain: null });
  }
  assert.equal(hasCurse('調你媽！'), true);
  assert.equal(hasCurse('黃金比例最好喝！'), false);
});

test('voicePlan: 調你媽 climax, rage lines, polite voice and plain lines', () => {
  const mega = voicePlan('調你媽！', { fx: 'mega', voiceFx: true });
  assert.equal(mega.hit, 'punch');
  assert.equal(mega.setup, null);
  assert.equal(mega.breathMs, VOICE_FX.breathMs);
  assert.equal(mega.punch.rate, PUNCH_RATE.mega); // spec 8.5: the climax keeps its slow motion
  assert.equal(mega.punch.echo, true);
  assert.equal(mega.punch.impactGain, 1);
  // rage chant (speak) and rage start (playClerk): megaphone flavour, never slower than the rage clip rate
  for (const via of ['speak', 'clerk']) {
    const r = voicePlan('滾滾滾！', { style: 'rage', voiceFx: true, via });
    assert.equal(r.punch.chain, 'punch', via);
    assert.equal(r.punch.megaphone, true);
    assert.equal(r.punch.rate, Math.max(CLIP_RATE.rage, VOICE_FX.punchRate));
    assert.equal(r.breathMs, VOICE_FX.breathMs);
  }
  // forced polite voice: never punched
  const pol = voicePlan('您好～請問要幾杯？', { style: 'polite', voiceFx: true });
  assert.equal(pol.punch.chain, 'legacy');
  assert.equal(pol.punch.rate, CLIP_RATE.polite);
  // a whole line that is not a hit keeps the old treatment; a whole curse-landing line gets the chain without
  // an impact (its first word is not necessarily the curse) and without a breath
  assert.equal(voicePlan('兩個月後過來拿。', { voiceFx: true }).punch.chain, 'legacy');
  assert.equal(voicePlan('兩個月後過來拿。', { voiceFx: true, via: 'speak' }).punch.chain, null);
  const big = voicePlan('全糖，下一位！', { fx: 'curse', voiceFx: true });
  assert.equal(big.punch.chain, 'punch');
  assert.equal(big.punch.impact, false);
  assert.equal(big.breathMs, 0);
});

test('voicePlan: lite mode drops the costly nodes but keeps rate, impact and breath (same timing)', () => {
  const full = voicePlan('滾！', { style: 'rage', voiceFx: true });
  const lite = voicePlan('滾！', { style: 'rage', voiceFx: true, lite: true });
  assert.equal(lite.punch.compress, false);
  assert.equal(lite.punch.saturation, 0);
  assert.equal(lite.punch.megaphone, false);
  for (const k of ['rate', 'impact', 'echo']) assert.equal(lite.punch[k], full.punch[k], k);
  assert.equal(lite.breathMs, full.breathMs);
  // tuning merges over VOICE_FX
  assert.equal(voicePlan('還在想？|滾！', { voiceFx: { punchRate: 1.08, impact: false } }).punch.rate, 1.08);
  assert.equal(voicePlan('還在想？|滾！', { voiceFx: { impact: false } }).punch.impact, false);
  assert.ok(Math.abs(dbToGain(6) - 1.995) < 0.01);
});

test('timingsFromManifest: durations follow the voice punch playbackRate and breath', () => {
  const man = { langs: { zh: { clips: {
    [ck('zh', '還在想？')]: { c: 0, o: 0, d: 0.65 },
    [ck('zh', '滾！')]: { c: 0, o: 1, d: 0.4, b: { c: 0, o: 2, d: 0.5 } },
    [ck('zh', '調你媽！')]: { c: 0, o: 3, d: 0.6, b: { c: 0, o: 4, d: 0.7 } },
    [ck('zh', '黃金比例最好喝！')]: { c: 0, o: 5, d: 1.1 },
  } } } };
  const on = { voiceFx: true };
  const t = timingsFromManifest(man, 'zh', '還在想？|滾！', { punchGapMs: 200, ...on });
  assert.deepEqual(t, { setupMs: 650, gapMs: 200, punchStartMs: 850, punchMs: Math.round(400 / 1.06), totalMs: 850 + Math.round(400 / 1.06), clips: { setup: true, punch: true } });
  // bleep clip, customer-style rate multiplier and tuning all compose
  assert.equal(timingsFromManifest(man, 'zh', '還在想？|滾！', { bleep: true, ...on }).punchMs, Math.round(500 / 1.06));
  assert.equal(timingsFromManifest(man, 'zh', '還在想？|滾！', { rate: 2, ...on }).punchMs, Math.round(400 / 2.12));
  assert.equal(timingsFromManifest(man, 'zh', '還在想？|滾！', { voiceFx: { punchRate: 1.08 } }).punchMs, Math.round(400 / 1.08));
  // 調你媽 climax: breath before it, slow-motion rate
  const m = timingsFromManifest(man, 'zh', '調你媽！', { punchFx: 'mega', ...on });
  assert.equal(m.setupMs, 0);
  assert.equal(m.gapMs, VOICE_FX.breathMs);
  assert.equal(m.punchStartMs, VOICE_FX.breathMs);
  assert.equal(m.punchMs, Math.round(600 / 0.94));
  assert.equal(m.totalMs, VOICE_FX.breathMs + Math.round(600 / 0.94));
  // curse first: the setup is the hit and its length scales, the professional half does not
  const o = timingsFromManifest(man, 'zh', '調你媽！|黃金比例最好喝！', { punchFx: 'mega', ...on });
  assert.equal(o.setupMs, Math.round(600 / 0.94));
  assert.equal(o.punchMs, 1100);
  assert.equal(o.punchStartMs, o.setupMs + 200);
  // rage style: the timing matches the rate actually played (lite or not)
  const r = timingsFromManifest(man, 'zh', '滾！', { style: 'rage', ...on });
  assert.equal(r.punchMs, Math.round(400 / 1.06));
  assert.deepEqual(timingsFromManifest(man, 'zh', '滾！', { style: 'rage', lite: true, ...on }), r);
  // polite: unchanged by the voice punch, but its 1.08 clip rate is now counted
  assert.equal(timingsFromManifest(man, 'zh', '滾！', { style: 'polite', ...on }).punchMs, Math.round(400 / 1.08));
  // estimates (no clip) scale too
  const e = timingsFromManifest(null, 'zh', '還在想？|滾！', on);
  assert.equal(e.punchMs, Math.round(estimateSpeechMs('滾！') / 1.06));
});

test('createAudio: voice punch is on by default, configurable, and degrades silently without WebAudio', async () => {
  const a = createAudio();
  assert.equal(a.voiceFx.enabled, true);
  const est = estimateSpeechMs('滾！');
  assert.equal(a.voiceTimings('還在想？|滾！').punchMs, Math.round(est / VOICE_FX.punchRate));
  const p = a.playClerk('調你媽！', { punchFx: 'mega' });
  assert.equal(p.punchStartMs, VOICE_FX.breathMs);
  assert.equal(p.punchMs, Math.round(estimateSpeechMs('調你媽！') / PUNCH_RATE.mega));
  a.setVoiceFx({ punchRate: 1.04 });
  assert.equal(a.voiceTimings('還在想？|滾！').punchMs, Math.round(est / 1.04));
  a.setVoiceFx(false);
  assert.equal(a.voiceFx, null);
  assert.equal(a.voiceTimings('還在想？|滾！').punchMs, est);
  assert.equal(a.playClerk('調你媽！', { punchFx: 'mega' }).punchStartMs, 0);
  a.setVoiceFx(true);
  a.setLite(true);
  assert.equal(a.voiceTimings('還在想？|滾！').punchMs, Math.round(est / VOICE_FX.punchRate));
  assert.equal(createAudio({ voiceFx: false }).voiceFx, null);
  // unlocked without WebAudio / Web Speech: rage, curse and bleeped lines resolve without throwing
  a.unlock();
  a.setBleep(true);
  await a.speak('滾滾滾！', { style: 'rage' });
  await a.speak('調你媽！|黃金比例最好喝！', { style: 'curse' });
  await a.playClerk('還在想？|滾！', { punchGapMs: 10 });
});

test('voice builder: the punchy render profile sets per-segment speed and post; spec stays as shipped', async () => {
  const { exportJobs } = await import('../tools/voice/export-lines.mjs');
  const find = (jobs, text, part) => jobs.find((j) => j.lang === 'zh' && j.text === text && j.part === part);
  const spec = exportJobs();
  assert.equal(find(spec, '滾！', 'punch').speed, 0.9);
  assert.equal(find(spec, '還在想？', 'setup').speed, 1.1);
  assert.ok(spec.every((j) => !j.post));
  const punchy = exportJobs({ profile: 'punchy' });
  assert.equal(punchy.length, spec.length);
  assert.deepEqual(find(punchy, '滾！', 'punch').post, { gainDb: 6, ceiling: 0.95 });
  assert.equal(find(punchy, '滾！', 'punch').speed, 1.1);
  assert.equal(find(punchy, '還在想？', 'setup').speed, 0.95);
  assert.equal(find(punchy, '還在想？', 'setup').post, undefined);
  assert.equal(find(punchy, '調你媽！', 'punch').speed, 1.1); // opening r4 climax
  assert.ok(punchy.filter((j) => j.style === 'rage').every((j) => j.post));
  assert.deepEqual(exportJobs(), spec); // the profile does not leak into later calls
  assert.throws(() => exportJobs({ profile: 'nope' }));
});
