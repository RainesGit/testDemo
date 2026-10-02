// opening.js — Day 1 opening routine director for 《来250杯！》 (docs/first-minute-spec.md section 3, 8.4).
//
// The routine is a beat list played on its own clock; the engine stays 'idle' the whole time and this
// module never touches it. UI, audio, the clock and storage are injected, so test/opening.test.mjs runs
// it with fake objects and a fake clock.
//
// runOpening({ ui, audio, content, lang, onDone, now, schedule, cancel, storage, skippable }) → opening
//   ui        the createUI() object (camera, huazi, showCustomer, showSign, guide, lockInput, ...; every
//             call is optional-chained, so a partial fake works)
//   audio     the createAudio() object: playClerk / playCustomer return timing objects
//             ({ setupMs, punchStartMs, punchMs } / { ms }); without them the timing is estimated
//   content   getContent(lang) result, or a function returning it (re-read every beat, so a language
//             switch mid-routine takes effect on the next line). Lines come from content.system.opening.
//   lang      'zh' | 'en' (or a function returning it): only used for estimates and sign specs
//   onDone({ skipped, queue })  called once at F4 (queue = OPENING_QUEUE, the line the routine built), after '250cups.openingDone' = '1' is stored; main then calls game.start()
//   now / schedule / cancel   clock (default performance.now / setTimeout / clearTimeout)
//   storage   localStorage-like (default globalThis.localStorage; every access is wrapped in try/catch)
//   skippable force the skip button on/off (default: shown when the routine was completed before)
//
// opening = { press(key) → boolean, skip(), stop(), active, waiting, beat, elapsed }
//   press(key)  route every key press here while opening.active. Returns true when the routine consumed it.
//   waiting     the key the routine is waiting for ('gun' | 'shut' | 'take'), or null
//   beat        id of the last beat that ran (A1 … F4), for QA scripts
//
// Timeline: every beat starts relative to something that already happened (spec 3.1, K8):
//   at: ms                → previous beat start + ms
//   at: ['clipEnd', ms]   → end of the last spoken line + ms        ('setupEnd' / 'punch' / 'cue' likewise:
//                           end of the setup half, start of the punch half, the cue word inside the punch)
//   at: ['P', ms]         → the moment the last wait point was answered + ms
//   at: 'ready'           → customer finished speaking, clamped to [sign up + 250, sign up + 1600] (R4)
// Clip lengths come from the voice pack (audio.playClerk timing), so the routine re-times itself when the
// pack is rebuilt.
//
// Wait points (3.1): hint escalation (new key: dim others + breathe → +900 counter taps → +1500 finger and
// dashed line; old key: +1200 breathe → +2000 finger), +5000 timeout once (forced polite voice + "……刚刚那不是我。"
// then the finger), first wrong press → quip (≤ 2 s, input locked) then finger; second wrong press on the same
// beat → "算了，我自己来。" and the beat resolves as if answered. Nothing ever costs points.

import { splitPunch, stripStage, estimateSpeechMs } from './audio.js';

const KEYS = ['gun', 'shut', 'take'];
const STORE_KEY = '250cups.openingDone';
/** People in line when the routine ends: 2 scrammed customers + 10 (bonus250). main carries them into day 1. */
export const OPENING_QUEUE = 12;

/** How long "调你妈！" holds the screen alone (review: it was covered after 376 ms). */
export const CLIMAX_HZ_MS = 1400;

export const OPENING_TIMING = {
  newHint: { tap: 900, finger: 1500 },
  oldHint: { glow: 1200, finger: 2000 },
  timeoutMs: 5000,
  readyMinMs: 250,
  readyMaxMs: 1600,
  quipMaxMs: 2000,
  quipCutMs: 250, // a press this long into a quip cuts it: right key answers, wrong key = the auto answer
  recapMs: 1800,
};

// ---------------------------------------------------------------------------
// The routine (spec 3.3–3.7). Text values are keys into content.system.opening.
// ---------------------------------------------------------------------------
export const BEATS = [
  // ---- 3.3 open the shop
  { id: 'A1', at: 0, do: [
    { lock: true }, { cover: ['shut', true] }, { queue: 0 }, { mood: 'idle' }, { flags: { squint: false } },
    { cam: ['FACE', 1.30, 0] }, { gate: true }, { sfx: 'gate' }, { bed: true },
  ] },
  // Review fix (A1 3.9 s): the day card types faster (40 ms/char, 300 ms hold) and "你要几杯？" starts while it
  // is still up; the S3 copy of "你要几杯？" is gone (it repeated the subtitle, R5).
  { id: 'A2', at: 300, do: [{ hz: { style: 'S5', text: 'dayCard', charMs: 40, holdMs: 300, tick: true } }] },
  { id: 'A3', at: 500, do: [{ sfx: 'slam' }, { cam: ['WIDE', 1.0, 450] }] },
  { id: 'A4', at: 300, do: [{ say: { line: 'ask' } }] },
  { id: 'A4b', at: ['punchRatio', 0.8], do: [{ shake: [3, 100] }] },

  // ---- 3.4 customer 1 "嗯……" (teach 滚)
  { id: 'B1', at: ['clipEnd', 50], do: [{ cust: { who: 1, enter: 'pop', ms: 220 } }, { sfx: 'pop' }, { cam: ['CUST', 1.08, 300] }] },
  { id: 'B2', at: 200, do: [{ sign: { key: 'gun', text: 'signs.s1', flip: 'up' } }, { sfx: 'card' }, { signUp: 160 }] },
  { id: 'B3', at: 100, do: [{ say: { line: 'c1', who: 'cust', color: 'gun' } }, { pose: { look: true, talk: true } }] },
  { id: 'B3b', at: 400, do: [{ hz: { style: 'S4', text: 'hz.huh' } }] },
  { id: 'W1', at: 'ready', wait: { key: 'gun', isNew: true, id: 'w1', timeout: 't1' }, do: [{ pose: { talk: false } }] },
  { id: 'B5', at: ['P', 0], do: [{ freeze: 60 }, { cam: ['FACE', 1.22, 120] }, { sfx: 'press' }, { vibrate: 10 }] },
  { id: 'B6', at: ['P', 60], do: [
    { mood: 'idle' }, { flags: { squint: true } },
    { say: { line: 'r1', gap: 200, fx: 'normal', cue: 'cue.r1' } }, { hz: { style: 'S3', text: 'hz.setup1' } },
  ] },
  { id: 'B8', at: ['cue', 0], do: [
    { flags: { squint: false } }, { mood: 'hit' }, { flash: true }, { shake: [10, 200] }, { custReact: 'suck' },
    { hz: { style: 'S1', text: 'hz.punch1' } }, { sfx: 'boom' }, { sfx: 'slam' },
  ] },
  { id: 'B9', at: ['cue', 300], do: [{ mood: 'perfect' }, { flags: { tidy: true } }, { cam: ['WIDE', 1.0, 350] }, { sfx: 'crowdOh' }] },
  { id: 'B10', at: ['cue', 900], do: [{ queue: 1 }, { sfx: 'ding' }, { mood: 'idle' }, { flags: { tidy: false } }] },

  // ---- 3.5 customer 2 "15杯" (review 滚)
  { id: 'C1', at: 0, do: [{ cust: { who: 2, enter: 'pop', ms: 220 } }, { sfx: 'pop' }, { cam: ['CUST', 1.08, 300] }] },
  { id: 'C2', at: 250, do: [{ sign: { key: 'gun', text: 'signs.s2', cups: 15, flip: 'up' } }, { sfx: 'card' }, { signUp: 160 }] },
  { id: 'C3', at: 100, do: [{ say: { line: 'c2', who: 'cust', color: 'gun' } }, { pose: { chin: true, talk: true } }, { hz: { style: 'S4', text: 'hz.proud' } }] },
  { id: 'W2', at: 'ready', wait: { key: 'gun', isNew: false, id: 'w2', timeout: 't2' }, do: [{ pose: { talk: false } }] },
  { id: 'C5', at: ['P', 0], do: [{ freeze: 60 }, { cam: ['FACE', 1.22, 120] }, { sfx: 'press' }, { vibrate: 10 }] },
  { id: 'C6', at: ['P', 60], do: [
    { mood: 'idle' }, { flags: { squint: true, lookDown: true } },
    // gap = sigh 450 + silence 180 (C7, C8)
    { say: { line: 'r2', gap: 630, fx: 'normal', cue: 'cue.r2' } }, { hz: { style: 'S3', text: 'hz.setup2' } },
  ] },
  { id: 'C7', at: ['setupEnd', 0], do: [{ sfx: 'sigh' }, { flags: { lookDown: false, sigh: true } }, { hz: { style: 'S3', text: 'hz.setup2b' } }] },
  { id: 'C9', at: ['cue', 0], do: [
    { flags: { squint: false, sigh: false } }, { mood: 'hit' }, { flash: true }, { shake: [10, 200] }, { custReact: 'suck' },
    { hz: { style: 'S1', text: 'hz.punch2' } }, { sfx: 'boom' },
  ] },
  { id: 'C10', at: ['cue', 300], do: [{ mood: 'perfect' }, { flags: { tidy: true } }, { cam: ['WIDE', 1.0, 350] }, { sfx: 'crowdOh' }] },
  { id: 'C11', at: ['cue', 900], do: [{ queue: 2 }, { sfx: 'ding' }, { mood: 'idle' }, { flags: { tidy: false } }] },

  // ---- 3.6 customer 3 "250杯" (teach 收, then 闭嘴)
  { id: 'D1', at: 0, do: [
    { cust: { who: 3, enter: 'rise', ms: 400 } }, { cam: ['CUST', 1.12, 400] }, { duck: [-60, 120] }, { sfx: ['drumroll', { duration: 0.6 }] },
  ] },
  { id: 'D2', at: 400, do: [{ sign: { key: 'take', text: 'signs.s3', cups: 250, flip: 'rotY', ms: 200 } }, { sfx: 'card' }, { signUp: 200 }] },
  // D3: 200 ms of silence (the drum roll stops at +600)
  { id: 'D4', at: 400, do: [
    { say: { line: 'c3', who: 'cust', color: 'take' } }, { pose: { talk: true } }, { cam: ['SIGN', 1.30, 100] },
    { hz: { style: 'S2', text: 'hz.big250', pos: [50, 36] } }, { sfx: ['ding', { freq: 1320 }] }, { sfx: 'coin' },
  ] },
  { id: 'D5', at: ['clipEnd', 0], do: [{ pose: { talk: false } }, { flags: { brow: true } }, { cam: ['FACE', 1.15, 250] }] },
  { id: 'W3', at: 250, wait: { key: 'take', isNew: true, id: 'w3', timeout: 't3', blink: true, reach: true } },
  { id: 'D7', at: ['P', 0], do: [{ flags: { brow: false, reach: false } }, { cam: ['FACE', 1.10, 400] }, { sfx: 'bell' }] },
  // (the "（突然很冷静）" / "（陷阱题）" S3 cards are gone: stage directions as big captions read as clutter; the
  // perfect / polite faces and the camera play them)
  { id: 'D8', at: ['P', 150], do: [{ mood: 'perfect' }, { say: { line: 'r3', style: 'cold' } }] },
  { id: 'D9', at: ['clipEnd', 100], do: [
    { say: { line: 'c3b', who: 'cust', color: 'take' } }, { sign: { key: 'take', text: 'signs.s3b', flip: 'rotX', ms: 180 } }, { sfx: 'card' },
  ] },
  { id: 'D10', at: ['clipEnd', 100], do: [
    { mood: 'polite' }, { say: { line: 'r3b' } }, { cam: ['FACE', 1.16, 1200] }, { loop: 'musicbox' },
  ] },
  { id: 'D11', at: ['clipEnd', 100], do: [
    { say: { line: 'c3c', who: 'cust', color: 'shut' } },
    { sign: { key: 'shut', text: 'signs.s3c', sub: 'signs.s3cSub', flip: 'rotX', ms: 180 } }, { sfx: 'card' },
  ] },
  // the bubble is placed once the page turn has swapped in the (wider) purple sign, so it clears it (A10)
  { id: 'D11b', at: 200, do: [{ hz: { style: 'S4', text: 'hz.adjusting' } }] },
  { id: 'W4', at: ['clipEnd', 0], wait: { key: 'shut', isNew: true, id: 'w4', timeout: 't4', uncover: true, crack: true } },

  // ---- 3.7 the punch "调你妈！" and the close
  { id: 'E1', at: ['P', 0], do: [{ hush: 20 }, { freeze: 100 }, { loop: 'hum' }, { clearGuide: true }] },
  { id: 'E2', at: ['P', 120], do: [{ flags: { crack: true } }] },
  // MOUTH at 1.34 (spec 1.40): at 1.40 the left crop cut 取餐号码 so that 取 read as 收 (review)
  { id: 'E3', at: ['P', 220], do: [{ cam: ['MOUTH', 1.34, 80] }, { sfx: ['whoosh', { duration: 0.08 }] }] },
  // Review fix 1 + idea 1: "调你妈！" owns the screen for 1400 ms (S1 hold), 120 ms white flash, focus lines,
  // the customer's half head ducks, a 150 ms freeze once the slam has landed. "黄金比例最好喝！" waits until the
  // S1 is gone and lands lower, on the counter (sign already shattered), so the two never overlap.
  { id: 'E4', at: ['P', 300], do: [
    { flags: { crack: false } }, { mood: 'hit' }, { say: { line: 'r4', fx: 'mega', cue: 'cue.r4' } },
    { flash: 120 }, { speedLines: 900 }, { shake: [14, 260] }, { vibrate: 50 }, { signFx: 'shatter' }, { pose: { cower: true } },
    { hz: { style: 'S1', text: 'hz.punch4', fontSize: 18, ms: CLIMAX_HZ_MS } }, { sfx: 'boom' }, { sfx: 'feedback' }, { sfx: 'slam' },
  ] },
  { id: 'E4b', at: 160, do: [{ freeze: 150 }] },
  { id: 'E6', at: ['max', ['clipEnd', 150], ['beat', 'E4', CLIMAX_HZ_MS + 150]], do: [
    { say: { line: 'r4b' } }, { flags: { pointSign: true } }, { goldsign: true }, { cam: [[61, 16], 1.20, 400] },
    { hz: { style: 'S2', text: 'hz.gold', pos: [50, 52] } }, { sfx: 'sparkle' },
  ] },
  { id: 'E7', at: ['clipEnd', 150], do: [
    { mood: 'perfect' }, { flags: { pointSign: false, tidy: true } }, { say: { line: 'r4c' } },
    { cam: ['WIDE', 1.05, 600] }, { hz: { style: 'S3', text: 'hz.fresh' } },
  ] },
  { id: 'E8', at: ['clipEnd', 100], do: [{ say: { line: 'r4d' } }, { hz: { style: 'S2', text: 'hz.cups250', size: 'sm', pos: [50, 52] } }] },
  { id: 'E9', at: ['clipEnd', 0], do: [{ letterbox: true }] },
  { id: 'E10', at: 250, do: [
    { say: { line: 'r4e' } }, { pose: { cower: false } }, { hz: { style: 'S5', text: 'hz.twoMonths', charMs: 80, tick: false } }, { sfx: ['clock', { count: 4, interval: 0.25 }] },
  ] },
  { id: 'E11', at: ['clipEnd', 100], do: [{ say: { line: 'r4f' } }, { letterbox: false }, { plate: 350 }] },
  { id: 'E11b', at: 350, do: [{ sfx: 'stamp' }] },
  { id: 'E12', at: 100, do: [
    { freeze: 700 }, { pose: { gray: true } }, { plateGlow: true }, { hz: { style: 'S4', text: 'hz.stunned' } },
    { sfx: ['crowdOh', { duration: 0.7, peak: 0.6 }] },
  ] },
  { id: 'E13', at: 700, do: [{ plateGlow: false }, { custReact: 'sink' }, { coins: 10 }, { queue: 12 }] },
  { id: 'F1', at: 700, do: [
    { say: { line: 'next' } }, { cam: ['WIDE', 0.88, 700] }, { hz: { style: 'S1', text: 'hz.next', size: 'sm', fontSize: 12 } },
    { ticket: 1 }, { sfx: 'dingdong' }, { stopLoop: 'hum' }, { restore: 300 }, { goldsign: false },
  ] },
  { id: 'F2', at: 900, do: [{ hz: { style: 'S2', text: 'hz.logo', fontSize: 16, pos: [50, 50] } }, { cam: ['WIDE', 1.0, 400] }, { sfx: 'boom' }, { mood: 'idle' }, { flags: { tidy: false } }] },
  { id: 'F3', at: 1400, recap: true },
];

// Per wait point: the quip for each wrong key, the brake variant for W3 (3.6).
const WRONG = {
  w1: { shut: 'wrong.w1shut', take: 'wrong.w1take' },
  w2: { shut: 'wrong.w2shut', take: 'wrong.w2take' },
  w3: { gun: { brake: 'wrong.w3gun', after: 'wrong.w3gunAfter' }, shut: { brake: 'wrong.w3shut', after: 'wrong.w3shutAfter' } },
  w4: { gun: 'wrong.w4gun', take: 'wrong.w4take' },
};

// The three scripted customers (2.7 fixed looks) and what they say first.
const CUSTOMERS = {
  1: { id: 'op1', key: 'gun', cups: null, says: 'c1', fixed: 'hesitant' },
  2: { id: 'op2', key: 'gun', cups: 15, says: 'c2', fixed: 'fifteen' },
  3: { id: 'op3', key: 'take', cups: 250, says: 'c3', fixed: 'c250' },
};

const safe = (fn) => { try { return fn(); } catch { return undefined; } };

export function runOpening({
  ui = {}, audio = {}, content, lang = 'zh', onDone,
  now = () => globalThis.performance.now(), schedule = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id),
  storage = safe(() => globalThis.localStorage), skippable,
} = {}) {
  const L = () => (typeof lang === 'function' ? lang() : lang) === 'en' ? 'en' : 'zh';
  const sys = () => {
    const c = typeof content === 'function' ? content() : content;
    return (c && c.system) || {};
  };
  const op = () => sys().opening || {};
  const get = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), op());
  // A key into the opening content, or the literal text when it is not one.
  const txt = (k) => {
    if (k == null) return '';
    const v = get(String(k));
    return typeof v === 'string' ? v : String(k);
  };
  const call = (name, ...args) => {
    const f = ui && ui[name];
    if (typeof f !== 'function') return undefined;
    try { return f.apply(ui, args); } catch (err) { console.warn('[opening] ui.' + name, err); return undefined; }
  };
  const acall = (name, ...args) => {
    const f = audio && audio[name];
    if (typeof f !== 'function') return undefined;
    try { return f.apply(audio, args); } catch (err) { console.warn('[opening] audio.' + name, err); return undefined; }
  };

  const t0 = now();
  const T = () => now() - t0;
  const timers = new Set();
  const later = (ms, fn) => {
    const id = schedule(() => { timers.delete(id); if (active) fn(); }, Math.max(0, ms));
    timers.add(id);
    return id;
  };
  const clearTimers = () => { timers.forEach((id) => safe(() => cancel(id))); timers.clear(); };

  let active = true;
  let finished = false;
  let beatId = null;
  let index = -1;
  // Marks on the routine's own time axis (ms since start).
  const m = { prev: 0, clipEnd: 0, setupEnd: 0, punch: 0, punchMs: 0, cue: 0, P: 0, signUp: 0, beat: {} };
  let timeouts = 0; // how many wait points timed out (the "……刚刚那不是我。" variants rotate)
  let wait = null; // { spec, start, wrong, timedOut, locked, hintTimers }
  let skipHide = null;
  let letterboxOn = 0;
  let musicbox = null;

  // ---- speaking ----
  function timingOf(res, text, who, gap) {
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    if (who === 'cust') {
      const ms = num(res && res.ms) ?? num(res && res.totalMs) ?? estimateSpeechMs(text, L());
      return { setupMs: 0, punchStartMs: 0, punchMs: ms };
    }
    if (res && num(res.punchMs) != null) {
      return { setupMs: num(res.setupMs) || 0, punchStartMs: num(res.punchStartMs) ?? num(res.setupMs) ?? 0, punchMs: res.punchMs };
    }
    const [setup, punch] = splitPunch(text);
    const s = stripStage(setup) ? estimateSpeechMs(setup, L()) : 0;
    const p = estimateSpeechMs(punch, L());
    return { setupMs: s, punchStartMs: s ? s + (gap ?? 200) : 0, punchMs: p };
  }

  // Speak a line at `start` (routine time). Returns the timing and moves the marks.
  function say(a, start) {
    const text = txt(a.line);
    const who = a.who || 'clerk';
    let res;
    if (who === 'cust') res = acall('playCustomer', text, { rate: 1 });
    else res = acall('playClerk', text, { punchGapMs: a.gap ?? 200, punchFx: a.fx || 'normal', bedBackMs: a.bedBackMs, style: a.style });
    if (res && typeof res.catch === 'function') res.catch(() => {});
    const tm = timingOf(res, text, who, a.gap);
    call('showLine', text, { who, color: a.color });
    m.setupEnd = start + tm.setupMs;
    m.punch = start + tm.punchStartMs;
    m.punchMs = tm.punchMs;
    m.clipEnd = m.punch + tm.punchMs;
    m.cue = m.punch;
    if (a.cue) {
      const punch = stripStage(splitPunch(text)[1]);
      const word = txt(a.cue);
      const i = word ? punch.indexOf(word) : -1;
      if (i > 0 && punch.length) m.cue = m.punch + Math.round(tm.punchMs * (i / punch.length));
    }
    return tm;
  }

  // ---- actions ----
  function customerOf(who) {
    const c = CUSTOMERS[who];
    return { id: c.id, key: c.key, cups: c.cups, says: txt(c.says) };
  }
  function signSpec(s) {
    return { key: s.key, sign: txt(s.text), cups: s.cups ?? null, sub: s.sub ? txt(s.sub) : undefined };
  }
  function hzItem(h) {
    const item = { style: h.style, text: stripStage(txt(h.text)) || txt(h.text) };
    for (const k of ['pos', 'size', 'fontSize', 'charMs', 'holdMs', 'break', 'ms']) if (h[k] != null) item[k] = h[k];
    if (h.style === 'S5' && h.tick !== false) item.onChar = () => acall('sfx', 'tick');
    return item;
  }
  function huazi(h) { call('huazi', [hzItem(h)]); }

  const ACTIONS = {
    lock: (v) => (v ? call('lockInput') : call('unlockInput')),
    cover: ([key, on]) => call('coverKey', key, on, { animate: !on }),
    queue: (n) => call('setQueue', n, { bump: n > 0 }),
    ticket: (n) => call('setTicket', n),
    mood: (v) => call('setClerk', v),
    flags: (v) => call('setClerkFlags', v),
    cam: ([focus, scale, ms, ease]) => call('camera', focus, scale, ms, ease),
    gate: (v) => call('gate', v, 500),
    goldsign: (v) => call('goldsign', v),
    flash: (v) => call('flash', typeof v === 'number' ? v : undefined),
    speedLines: (ms) => call('speedLines', ms),
    shake: ([px, ms]) => call('shake', px, ms),
    freeze: (ms) => call('freeze', ms),
    letterbox: (on) => {
      if (on) { letterboxOn++; call('letterbox', true); } else if (letterboxOn > 0) { letterboxOn--; call('letterbox', false); }
    },
    vibrate: (ms) => safe(() => globalThis.navigator?.vibrate?.(ms)),
    sfx: (v) => (Array.isArray(v) ? acall('sfx', v[0], v[1] || {}) : acall('sfx', v)),
    bed: (on) => acall('bed', on),
    duck: ([db, ms]) => acall('duck', db, ms),
    restore: (ms) => acall('restore', ms),
    hush: (ms) => { acall('hush', ms); musicbox = null; },
    loop: (name) => { const h = acall('loop', name); if (name === 'musicbox') musicbox = h; },
    stopLoop: (name) => acall('stopLoop', name, 200),
    hz: (h) => huazi(h),
    cust: (c) => {
      const spec = CUSTOMERS[c.who];
      call('showCustomer', customerOf(c.who), { enter: c.enter, enterMs: c.ms, sign: false, line: false, fixed: spec.fixed });
    },
    custReact: (face) => call('customerReact', face),
    pose: (p) => call('customerPose', p),
    sign: (s) => call('showSign', signSpec(s), { flip: s.flip || 'up', ms: s.ms }),
    signFx: (k) => call('signFx', k),
    plate: (ms) => call('showPlate', op().plate || [], { ms }),
    plateGlow: (on) => call('plateGlow', on),
    clearGuide: () => call('clearGuide'),
    coins: (n) => {
      // 10 coins, gaps shrinking from 90 ms to 40 ms (E13)
      let at = 0;
      for (let i = 0; i < n; i++) {
        acall('sfx', 'coin', { delay: at / 1000, pitch: 1 + i * 0.03 });
        at += Math.round(90 - (50 * i) / Math.max(1, n - 1));
      }
    },
  };

  function runActions(list, start) {
    for (const a of list || []) {
      for (const [k, v] of Object.entries(a)) {
        if (k === 'say') say(v, start);
        else if (k === 'signUp') m.signUp = start + v;
        else if (ACTIONS[k]) ACTIONS[k](v);
      }
    }
  }

  // ---- sequencing ----
  function startOf(at) {
    if (typeof at === 'number') return m.prev + at;
    if (at === 'ready') {
      const lo = m.signUp + OPENING_TIMING.readyMinMs;
      const hi = m.signUp + OPENING_TIMING.readyMaxMs;
      return Math.min(Math.max(m.clipEnd, lo), hi);
    }
    const [ref, off = 0] = Array.isArray(at) ? at : [at, 0];
    if (ref === 'max') return Math.max(...at.slice(1).map(startOf));
    if (ref === 'beat') return (m.beat[off] ?? m.prev) + (at[2] || 0);
    if (ref === 'punchRatio') return m.punch + Math.round(m.punchMs * off);
    const base = { clipEnd: m.clipEnd, setupEnd: m.setupEnd, punch: m.punch, cue: m.cue, P: m.P }[ref];
    return (base ?? m.prev) + off;
  }

  function next() {
    if (!active) return;
    index++;
    const beat = BEATS[index];
    if (!beat) return finish(false);
    const start = Math.max(startOf(beat.at), 0);
    later(start - T(), () => exec(beat, start));
  }

  function exec(beat, start) {
    beatId = beat.id;
    m.prev = start;
    m.beat[beat.id] = start;
    if (beat.recap) return recap();
    runActions(beat.do, start);
    if (beat.wait) return enterWait(beat.wait, start);
    next();
  }

  // ---- wait points ----
  function enterWait(spec, start) {
    wait = { spec, start, wrong: 0, timedOut: false, locked: false, hint: new Set() };
    if (spec.uncover) call('coverKey', 'shut', false, { animate: true });
    call('unlockInput');
    if (spec.isNew) call('guide', { key: spec.key, dimOthers: true, glow: true, blink: !!spec.blink });
    armHints();
  }
  const waitLater = (ms, fn) => { const id = later(ms, fn); wait.hint.add(id); return id; };
  function clearHints() {
    if (!wait) return;
    wait.hint.forEach((id) => { safe(() => cancel(id)); timers.delete(id); });
    wait.hint.clear();
  }
  function showFinger() {
    call('guide', { key: wait.spec.key, dimOthers: true, glow: true, finger: true, line: true, blink: !!wait.spec.blink });
  }
  function armHints() {
    const { spec } = wait;
    const H = spec.isNew ? OPENING_TIMING.newHint : OPENING_TIMING.oldHint;
    if (spec.isNew) {
      waitLater(H.tap, () => {
        if (spec.reach) call('setClerkFlags', { reach: true });
        else if (spec.crack) {
          // W4 +900: the smile twitches once and the music box goes out of tune
          call('setClerkFlags', { crack: true });
          later(260, () => call('setClerkFlags', { crack: false }));
          safe(() => musicbox && musicbox.detune && musicbox.detune(-50));
        } else {
          call('clerkTap');
          acall('sfx', 'tap', { count: 3, interval: 0.12 });
        }
      });
    } else {
      waitLater(H.glow, () => call('guide', { key: spec.key, dimOthers: false, glow: true }));
    }
    waitLater(H.finger, showFinger);
    armTimeout(OPENING_TIMING.timeoutMs);
  }
  function armTimeout(ms) {
    if (wait.timedOut) return;
    waitLater(ms, timeout);
  }

  function lockFor() { wait.locked = true; call('lockInput'); }
  function unlockAfter() {
    if (!wait) return;
    wait.locked = false;
    call('unlockInput');
    call('setClerkFlags', { squint: false });
    showFinger();
  }

  // Review (A5): five timeouts all said "……刚刚那不是我。"; later ones use timeout.notMeAlt[] when present.
  function notMeLine(i) {
    const alts = get('timeout.notMeAlt');
    if (i === 0 || !Array.isArray(alts) || !alts.length) return 'timeout.notMe';
    return 'timeout.notMeAlt.' + ((i - 1) % alts.length);
  }

  // +5000: forced service voice once, then back to the same customer with the finger (no second timeout).
  function timeout() {
    if (!wait || wait.timedOut) return;
    wait.timedOut = true;
    clearHints();
    lockFor();
    call('clearGuide');
    const start = T();
    call('setClerk', 'polite');
    say({ line: 'timeout.' + wait.spec.timeout, style: 'polite' }, start);
    acall('sfx', 'boo');
    const notMe = notMeLine(timeouts++);
    later(m.clipEnd - T(), () => {
      call('setClerk', 'idle');
      if (wait.spec.crack) call('setClerkFlags', { crack: true });
      say({ line: notMe, style: 'cold' }, T());
      later(m.clipEnd - T(), () => {
        if (wait.spec.crack) call('setClerkFlags', { crack: false });
        unlockAfter();
      });
    });
  }

  // First wrong press: the quip plays at once (subtitle only: the S3 copy repeated it, R5). The keys stay live:
  // a press after quipCutMs cuts the quip — the right key answers, a wrong one is the second wrong press
  // ("算了，我自己来。" right away instead of after the quip, review A4).
  function wrongPress(key) {
    wait.wrong++;
    clearHints();
    if (wait.wrong >= 2) { lockFor(); return autoAnswer(); }
    const entry = (WRONG[wait.spec.id] || {})[key];
    wait.locked = 'quip';
    wait.quipAt = T();
    call('setClerk', 'idle');
    call('setClerkFlags', { squint: true });
    const done = () => { unlockAfter(); armTimeout(OPENING_TIMING.timeoutMs); };
    if (entry && typeof entry === 'object') return brake(entry, done);
    const line = entry || 'wrong.auto';
    if (wait.spec.id === 'w2' && key === 'take') {
      call('setClerkFlags', { reach: true });
      waitLater(200, () => call('setClerkFlags', { reach: false }));
    }
    const tm = say({ line }, T());
    waitLater(Math.min(tm.punchStartMs + tm.punchMs, OPENING_TIMING.quipMaxMs + 600), done);
  }
  function cutQuip(key) {
    clearHints();
    acall('cut', 40);
    call('setClerkFlags', { squint: false });
    call('customerPose', { talk: false });
    if (key === wait.spec.key) return resolve(T());
    wait.wrong++;
    lockFor();
    autoAnswer();
  }

  // W3 wrong key: the curse starts, is cut after 150 ms, the S1 shatters, record scratch, 300 ms of
  // silence, "（手停住）", the clerk backtracks and the customer repeats the order.
  function brake(entry, done) {
    const start = T();
    say({ line: entry.brake, fx: 'curse' }, start);
    call('setClerk', 'hit');
    huazi({ style: 'S1', text: stripStage(txt(entry.brake)).replace(/[—–-]+$/, ''), break: true });
    waitLater(150, () => {
      acall('cut', 40);
      acall('sfx', 'scratch');
      call('setClerk', 'idle');
    });
    waitLater(450, () => {
      huazi({ style: 'S4', text: 'hz.handStop' });
      say({ line: entry.after }, T());
      waitLater(m.clipEnd - T() + 100, () => {
        call('customerPose', { talk: true });
        say({ line: 'c3', who: 'cust', color: 'take' }, T());
        waitLater(m.clipEnd - T(), () => { call('customerPose', { talk: false }); done(); });
      });
    });
  }

  // Second wrong press on the same beat: "算了，我自己来。", then the beat resolves (P = end of that line).
  function autoAnswer() {
    call('setClerk', 'idle');
    call('setClerkFlags', { squint: false });
    say({ line: 'wrong.auto' }, T());
    later(m.clipEnd - T(), () => resolve(m.clipEnd));
  }

  function resolve(at) {
    if (!wait) return;
    clearHints();
    call('clearGuide');
    call('lockInput');
    wait = null;
    m.P = at;
    next();
  }

  function press(key) {
    if (!active) return false;
    if (!KEYS.includes(key)) return true;
    if (!wait) return true;
    if (wait.locked === 'quip') {
      if (T() - wait.quipAt >= OPENING_TIMING.quipCutMs) cutQuip(key);
      return true;
    }
    if (wait.locked) return true;
    if (key === wait.spec.key) resolve(T());
    else wrongPress(key);
    return true;
  }

  // ---- end ----
  function recap() {
    beatId = 'F3';
    clearSkip();
    const p = call('showRecap', op(), { ms: OPENING_TIMING.recapMs });
    let done = false;
    const go = () => { if (!done) { done = true; finish(false); } };
    if (p && typeof p.then === 'function') p.then(go, go);
    later(OPENING_TIMING.recapMs + 400, go);
  }

  function clearSkip() {
    if (typeof skipHide === 'function') safe(skipHide);
    skipHide = null;
  }

  function finish(skipped) {
    if (finished) return;
    finished = true;
    beatId = 'F4';
    clearTimers();
    wait = null;
    active = false;
    clearSkip();
    while (letterboxOn > 0) { letterboxOn--; call('letterbox', false); }
    call('clearGuide');
    call('coverKey', 'shut', false, { animate: false });
    call('unlockInput');
    safe(() => storage && storage.setItem(STORE_KEY, '1'));
    if (typeof onDone === 'function') safe(() => onDone({ skipped, queue: OPENING_QUEUE }));
  }

  /** Jump straight to F3 (the three-key recap), then F4. */
  function skip() {
    if (!active || finished || beatId === 'F3') return;
    clearTimers();
    wait = null;
    acall('hush', 60);
    acall('restore', 300);
    acall('stopLoops', 60);
    call('clearHuazi');
    call('clearGuide');
    call('clearPlate');
    call('clearCustomer');
    call('goldsign', false);
    call('setClerk', 'idle');
    call('setClerkFlags', { squint: false, crack: false, brow: false, sigh: false, tidy: false, lookDown: false, pointSign: false, reach: false });
    while (letterboxOn > 0) { letterboxOn--; call('letterbox', false); }
    call('coverKey', 'shut', false, { animate: false });
    call('camera', 'WIDE', 1, 200);
    call('lockInput');
    index = BEATS.length - 1;
    recap();
    beatId = 'F3';
    return true;
  }

  function stop() {
    if (finished) return;
    finished = true;
    active = false;
    clearTimers();
    clearSkip();
    wait = null;
  }

  // Skip button only after the routine was completed once (3.1).
  const seen = safe(() => storage && storage.getItem(STORE_KEY) === '1');
  if (skippable ?? seen) {
    const hide = call('showSkip', () => skip(), { delayMs: 1200, label: (sys().start || {}).skip });
    skipHide = typeof hide === 'function' ? hide : null;
  }

  next();

  return {
    press,
    skip,
    stop,
    get active() { return active; },
    get waiting() { return wait && !wait.locked ? wait.spec.key : null; },
    get beat() { return beatId; },
    get elapsed() { return T(); },
  };
}
