// 吼罵模式 (src/voice.js): loudness analysis of the player's voice (docs/gameplay-v2.md 10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE, levelFrom, loudness, contrast, tuningFor, createCalibrator, createShoutDetector, contrastBonus, splText, keywordKey, clampFloor,
} from '../src/voice.js';

const sine = (amp, n = 2048) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / 48000));

// feed a detector a list of [db, ms] parts at 20 ms frames; returns all events
function play(det, parts, t0 = 0, frame = 20) {
  const ev = [];
  let t = t0;
  for (const [db, ms] of parts) {
    for (let k = 0; k < ms; k += frame) { t += frame; ev.push(...det.feed(db, t)); }
  }
  return { ev, t };
}
const types = (ev) => ev.map((e) => e.type);

test('levelFrom: RMS in dBFS; silence is the floor', () => {
  assert.equal(levelFrom(new Float32Array(512)), VOICE.minDb);
  assert.equal(levelFrom([]), VOICE.minDb);
  // a full-scale sine is -3 dBFS RMS
  assert.ok(Math.abs(levelFrom(sine(1)) + 3.01) < 0.1, String(levelFrom(sine(1))));
  assert.ok(Math.abs(levelFrom(sine(0.1)) + 23.01) < 0.1);
  assert.ok(Math.abs(levelFrom(new Float32Array(100).fill(0.5)) + 6.02) < 0.01);
});

test('loudness: 說 / 罵 / 吼 above the floor (+12 / +22 / +30), whisper lowers them', () => {
  assert.equal(loudness(-55, -60), -1);
  assert.equal(loudness(-48, -60), 0);
  assert.equal(loudness(-38, -60), 1);
  assert.equal(loudness(-30, -60), 2);
  const w = tuningFor({ whisper: true });
  assert.equal(loudness(-52, -60, w), 0);
  assert.equal(loudness(-46, -60, w), 1);
  assert.equal(loudness(-40, -60, w), 2);
});

test('contrast: whole dB of punch over setup, never negative', () => {
  assert.equal(contrast(-44, -20), 24);
  assert.equal(contrast(-20, -30), 0);
  assert.equal(contrast(null, -20), 0);
});

test('calibrator: 20th percentile of the room, clamped', () => {
  const c = createCalibrator();
  for (let i = 0; i < 40; i++) c.feed(-58 + (i % 3));
  for (let i = 0; i < 8; i++) c.feed(-10); // a door bang
  assert.equal(c.floor(), -58);
  const dead = createCalibrator();
  for (let i = 0; i < 50; i++) dead.feed(-100);
  assert.equal(dead.floor(), VOICE.floorMin);
  assert.equal(clampFloor(-5), VOICE.floorMax);
});

test('detector: a short click is not an onset; ≥ 120 ms is', () => {
  const d = createShoutDetector({ floor: -60 });
  let r = play(d, [[-60, 200], [-30, 60], [-60, 400]]);
  assert.deepEqual(r.ev.filter((e) => e.type === 'onset'), []);
  r = play(d, [[-30, 200], [-60, 400]], r.t);
  assert.deepEqual(types(r.ev).filter((x) => x === 'onset'), ['onset']);
  assert.ok(types(r.ev).includes('end'));
});

test('detector: a shout emits onset, rise to 罵 then 吼, one peak, end with duration and peak level', () => {
  const d = createShoutDetector({ floor: -60 });
  const r = play(d, [[-60, 300], [-36, 240], [-20, 400], [-60, 500]]);
  const t = types(r.ev);
  assert.equal(t.filter((x) => x === 'onset').length, 1);
  const rises = r.ev.filter((e) => e.type === 'rise').map((e) => e.level);
  assert.deepEqual(rises, [1, 2]);
  const peaks = r.ev.filter((e) => e.type === 'peak');
  assert.equal(peaks.length, 1);
  assert.equal(peaks[0].level, 2);
  assert.ok(peaks[0].db > -22 && peaks[0].db <= -20, String(peaks[0].db));
  const end = r.ev.find((e) => e.type === 'end');
  assert.equal(end.peakLevel, 2);
  assert.ok(end.durationMs >= 620 && end.durationMs <= 950, String(end.durationMs));
  assert.ok(t.indexOf('peak') < t.indexOf('end'));
});

test('detector: soft setup, pause, shout = contrast bonus (the three beats by voice)', () => {
  const d = createShoutDetector({ floor: -60 });
  d.resetPhrase();
  const r = play(d, [[-60, 200], [-44, 400], [-60, 300], [-16, 500], [-60, 400]]);
  const peak = r.ev.find((e) => e.type === 'peak');
  assert.ok(peak, 'peak');
  assert.ok(peak.softMs >= 300, String(peak.softMs));
  assert.ok(peak.contrast >= 25 && peak.contrast <= 30, String(peak.contrast));
  assert.equal(contrastBonus(d.phrase, peak), true);
  // a new customer forgets the setup
  d.resetPhrase();
  assert.equal(d.phrase.softMs, 0);
});

test('detector: shouting without a soft setup, or a soft setup without a roar, is no contrast bonus', () => {
  const d = createShoutDetector({ floor: -60 });
  let r = play(d, [[-60, 200], [-16, 500], [-60, 400]]);
  let peak = r.ev.find((e) => e.type === 'peak');
  assert.equal(contrastBonus(d.phrase, peak), false);
  d.resetPhrase();
  r = play(d, [[-44, 500], [-60, 300], [-35, 500], [-60, 400]], r.t);
  peak = r.ev.find((e) => e.type === 'peak');
  assert.equal(peak.level, 1);
  assert.equal(contrastBonus(d.phrase, peak), false);
});

test('detector: sustained 罵 emits a sustain every 300 ms (rage sweep)', () => {
  const d = createShoutDetector({ floor: -60 });
  const r = play(d, [[-60, 100], [-34, 1300], [-60, 400]]);
  const n = r.ev.filter((e) => e.type === 'sustain').length;
  assert.ok(n >= 3 && n <= 4, String(n));
});

test('detector: syllable gaps shorter than the release stay one segment; the floor follows a quieter room', () => {
  const d = createShoutDetector({ floor: -50 });
  const r = play(d, [[-20, 300], [-60, 100], [-20, 300], [-60, 600]]);
  assert.equal(r.ev.filter((e) => e.type === 'onset').length, 1);
  play(d, [[-66, 2000]], r.t);
  assert.ok(d.floor < -60, String(d.floor));
  d.mute();
  assert.equal(d.active, false);
});

test('splText: dBFS + 110 within 40..130', () => {
  assert.equal(splText(-12), 98);
  assert.equal(splText(-100), 40);
  assert.equal(splText(30), 130);
});

test('keywordKey: Chinese (both scripts) and English curse words map to the three keys and 250', () => {
  assert.deepEqual(keywordKey('滾！'), { key: 'gun', jackpot: false });
  assert.equal(keywordKey('給我滾').key, 'gun');
  assert.equal(keywordKey('閉嘴').key, 'shut');
  assert.equal(keywordKey('閉嘴啦').key, 'shut');
  assert.equal(keywordKey('Shut up!').key, 'shut');
  assert.equal(keywordKey('兩個月後來拿').key, 'take');
  assert.equal(keywordKey('two months later').key, 'take');
  assert.equal(keywordKey('scram').key, 'gun');
  assert.deepEqual(keywordKey('你這個二百五'), { key: null, jackpot: true });
  assert.equal(keywordKey('250 cups').jackpot, true);
  assert.equal(keywordKey('你好').key, null);
});
