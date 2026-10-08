// Opening routine director (src/opening.js) on a fake clock with fake ui / audio (spec 8.4, A3–A5, K8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runOpening, BEATS, OPENING_TIMING } from '../src/opening.js';
import { getContent } from '../src/content.js';
import { timingsFromManifest } from '../src/audio.js';

// ---- fake clock ----
function fakeClock() {
  let t = 0;
  let seq = 0;
  const q = new Map();
  return {
    now: () => t,
    schedule: (fn, ms) => { const id = ++seq; q.set(id, { at: t + Math.max(0, ms || 0), fn, id }); return id; },
    cancel: (id) => q.delete(id),
    // advance to `to`, running due timers in time order
    runUntil(to) {
      for (;;) {
        let nx = null;
        for (const e of q.values()) if (e.at <= to && (!nx || e.at < nx.at || (e.at === nx.at && e.id < nx.id))) nx = e;
        if (!nx) break;
        q.delete(nx.id);
        t = nx.at;
        nx.fn();
      }
      t = to;
    },
    get t() { return t; },
    get pending() { return q.size; },
  };
}

// ---- fakes ----
function fakeUI() {
  const log = [];
  let locked = false;
  const ui = new Proxy({}, {
    get(_, name) {
      if (name === 'then') return undefined;
      if (name === 'log') return log;
      if (name === 'locked') return locked;
      return (...args) => {
        log.push({ name, args });
        if (name === 'lockInput') locked = true;
        if (name === 'unlockInput') locked = false;
        if (name === 'showSkip') return () => log.push({ name: 'hideSkip', args: [] });
        return undefined;
      };
    },
  });
  return ui;
}

function fakeAudio({ manifest = null, lang = 'zh' } = {}) {
  const log = [];
  const timing = (text, o = {}) => timingsFromManifest(manifest, lang, text, o);
  return {
    log,
    playClerk(text, o = {}) { log.push({ name: 'playClerk', text, o }); return Object.assign(Promise.resolve(), timing(text, o)); },
    playCustomer(text, o = {}) { log.push({ name: 'playCustomer', text, o }); return Object.assign(Promise.resolve(), { ms: timing(text, o).totalMs }); },
    sfx(name, o) { log.push({ name: 'sfx', sfx: name, o }); return 0; },
    loop(name) { log.push({ name: 'loop', loop: name }); return { stop() {}, detune: (c) => log.push({ name: 'detune', c }) }; },
    stopLoop() {}, stopLoops() {}, hush(ms) { log.push({ name: 'hush', ms }); }, cut(ms) { log.push({ name: 'cut', ms }); },
    duck() {}, restore() {}, bed() {},
  };
}

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

const zh = getContent('zh');
const en = getContent('en');
const flat = (o) => (typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(flat) : o && typeof o === 'object' ? Object.values(o).flatMap(flat) : []);

function setup({ content = zh, lang = 'zh', storage = memStorage(), manifest = null, skippable } = {}) {
  const clock = fakeClock();
  const ui = fakeUI();
  const audio = fakeAudio({ manifest, lang });
  let done = null;
  const op = runOpening({
    ui, audio, content, lang, storage, skippable,
    now: clock.now, schedule: clock.schedule, cancel: clock.cancel,
    onDone: (info) => { done = { t: clock.t, ...info }; },
  });
  return { clock, ui, audio, op, storage, get done() { return done; } };
}

// Drive the routine with a strategy: (key, sinceWaitMs, ctx) → key to press or null; steps every `dt` ms.
function drive(s, strategy, { dt = 50, maxMs = 180000 } = {}) {
  let waitKey = null;
  let waitSince = 0;
  const events = [];
  while (!s.done && s.clock.t < maxMs) {
    s.clock.runUntil(s.clock.t + dt);
    const w = s.op.waiting;
    if (w !== waitKey) { waitKey = w; waitSince = s.clock.t; if (w) events.push({ wait: w, t: s.clock.t, beat: s.op.beat }); }
    if (!w) continue;
    const k = strategy(w, s.clock.t - waitSince, s);
    if (k) {
      events.push({ press: k, t: s.clock.t, beat: s.op.beat });
      s.op.press(k);
      waitKey = s.op.waiting;
      waitSince = s.clock.t;
    }
  }
  return events;
}

test('BEATS: ids are unique, waits teach 滾 → 滾 → 收 → 閉嘴, and only W1/W3/W4 are new keys', () => {
  const ids = BEATS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  const waits = BEATS.filter((b) => b.wait).map((b) => [b.id, b.wait.key, b.wait.isNew]);
  assert.deepEqual(waits, [['W1', 'gun', true], ['W2', 'gun', false], ['W3', 'take', true], ['W4', 'shut', true]]);
  assert.equal(BEATS.at(-1).id, 'F3');
});

test('every line key the routine speaks or shows exists in zh and en content', () => {
  const keys = new Set();
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'line' || k === 'text' || k === 'cue' || k === 'sub') && typeof v === 'string') keys.add(v);
      else walk(v);
    }
  };
  walk(BEATS);
  for (const w of ['wrong.w1shut', 'wrong.w1take', 'wrong.w2shut', 'wrong.w2take', 'wrong.w3gun', 'wrong.w3gunAfter',
    'wrong.w3shut', 'wrong.w3shutAfter', 'wrong.w4gun', 'wrong.w4take', 'wrong.auto',
    'timeout.t1', 'timeout.t2', 'timeout.t3', 'timeout.t4', 'timeout.notMe', 'hz.handStop']) keys.add(w);
  for (const c of [zh, en]) {
    const op = c.system.opening;
    for (const k of keys) {
      const v = k.split('.').reduce((o, p) => o?.[p], op);
      assert.equal(typeof v, 'string', `opening.${k}`);
      assert.ok(v.length > 0, `opening.${k}`);
    }
  }
});

test('route 1: answering every wait point after 800 ms plays the whole routine and stores openingDone', () => {
  const s = setup();
  const ev = drive(s, (k, since) => (since >= 800 ? k : null));
  assert.ok(s.done, 'onDone called');
  assert.equal(s.done.skipped, false);
  assert.equal(s.storage.getItem('250cups.openingDone'), '1');
  assert.equal(s.op.active, false);
  assert.deepEqual(ev.filter((e) => e.press).map((e) => e.press), ['gun', 'gun', 'take', 'shut']);
  // first sign is up within 3.5 s of "open shop" (A1)
  const signAt = s.ui.log.findIndex((e) => e.name === 'showSign');
  assert.ok(signAt >= 0);
  assert.ok(ev[0].t <= 6000, `W1 at ${ev[0].t}`);
  // every line came from the zh content
  const said = s.audio.log.filter((e) => e.name === 'playClerk' || e.name === 'playCustomer').map((e) => e.text);
  const o = zh.system.opening;
  for (const k of ['ask', 'c1', 'r1', 'c2', 'r2', 'c3', 'r3', 'c3b', 'r3b', 'c3c', 'r4', 'r4b', 'r4c', 'r4d', 'r4e', 'r4f', 'next']) {
    assert.ok(said.includes(o[k]), k);
  }
  // no quips, no timeouts on the clean route
  assert.ok(!said.some((t) => flat(o.wrong).includes(t) || flat(o.timeout).includes(t)));
  // input ends unlocked, shut key uncovered, guide cleared
  assert.equal(s.ui.locked, false);
  assert.ok(s.ui.log.some((e) => e.name === 'coverKey' && e.args[0] === 'shut' && e.args[1] === false));
});

test('route 1 timing: F4 lands within the 28–40 s band with estimated clip lengths (K8, medium reaction 800 ms)', () => {
  const s = setup();
  drive(s, (k, since) => (since >= 800 ? k : null));
  assert.ok(s.done.t >= 20000 && s.done.t <= 40000, `F4 at ${s.done.t} ms`);
});

test('route 1 timing with the shipped voice-pack manifest (falls back to estimates for missing clips)', () => {
  let manifest = null;
  try { manifest = JSON.parse(readFileSync(new URL('../voice/manifest.json', import.meta.url), 'utf8')); } catch { /* no pack */ }
  for (const [content, lang] of [[zh, 'zh'], [en, 'en']]) {
    const s = setup({ content, lang, manifest });
    drive(s, (k, since) => (since >= 800 ? k : null));
    assert.ok(s.done, lang);
    assert.ok(s.done.t >= 20000 && s.done.t <= 40000, `${lang}: F4 at ${s.done.t} ms`);
  }
});

test('A3: from the 閉嘴 press to the end is >= 8 s and input stays locked throughout', () => {
  const s = setup();
  let pShut = null;
  drive(s, (k, since) => {
    if (since < 800) return null;
    if (k === 'shut') pShut = s.clock.t;
    return k;
  }, { dt: 20 });
  // after the W4 press, no unlockInput until finish()
  const log = s.ui.log;
  const lastLock = log.map((e) => e.name).lastIndexOf('lockInput');
  const unlocks = log.map((e, i) => (e.name === 'unlockInput' ? i : -1)).filter((i) => i > lastLock);
  assert.ok(pShut != null);
  assert.ok(s.done.t - pShut >= 8000, `P4 → F4 = ${s.done.t - pShut}`);
  assert.ok(unlocks.length <= 1, 'only finish() unlocks input after the 閉嘴 press');
});

test('route 2: mashing a random key every 300 ms still finishes within 120 s; quips start within 300 ms', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let run = 0; run < 5; run++) {
    const s = setup();
    const quipsAt = [];
    let lastPress = -1e9;
    const keys = ['gun', 'shut', 'take'];
    while (!s.done && s.clock.t < 120000) {
      s.clock.runUntil(s.clock.t + 10);
      if (s.clock.t - lastPress >= 300) {
        lastPress = s.clock.t;
        const k = keys[Math.floor(rnd() * 3)];
        const expected = s.op.waiting;
        const before = s.audio.log.length;
        s.op.press(k);
        if (expected && k !== expected) {
          // the quip (or the auto line, or the brake) is requested synchronously → well within 300 ms
          const after = s.audio.log.slice(before).filter((e) => e.name === 'playClerk');
          quipsAt.push(after.length);
        }
      }
    }
    assert.ok(s.done, `run ${run}: finished`);
    assert.ok(s.done.t <= 120000, `run ${run}: ${s.done.t}`);
    assert.ok(quipsAt.every((n) => n >= 1), `run ${run}: every wrong press answered by a line`);
  }
});

// length of the last "……剛剛那不是我。" line, so the press lands 1 s after the finger reappears
const NOT_ME = [zh.system.opening.timeout.notMe, ...(zh.system.opening.timeout.notMeAlt || [])];
const notMeMs = (text) => timingsFromManifest(null, 'zh', text).totalMs;

test('route 3: waiting out every timeout (then pressing 1 s after the finger) finishes within 70 s, one timeout per wait', () => {
  const s = setup();
  let timeouts = 0;
  // press 1000 ms after the timeout scene has ended and the finger is showing again
  let readyAt = null;
  let lastTimeoutCount = 0;
  drive(s, (k) => {
    const said = s.audio.log.filter((e) => e.name === 'playClerk').map((e) => e.text);
    const notMe = said.filter((t) => NOT_ME.includes(t));
    if (notMe.length > lastTimeoutCount) { lastTimeoutCount = notMe.length; readyAt = s.clock.t + notMeMs(notMe.at(-1)); }
    if (readyAt != null && s.clock.t - readyAt >= 1000) { readyAt = null; return k; }
    return null;
  }, { dt: 20 });
  timeouts = lastTimeoutCount;
  assert.ok(s.done, 'finished');
  assert.equal(timeouts, 4, 'one timeout per wait point');
  assert.ok(s.done.t <= 70000, `F4 at ${s.done.t}`);
  const polite = s.audio.log.filter((e) => e.name === 'playClerk' && flat(zh.system.opening.timeout).includes(e.text));
  assert.equal(polite.length, 8);
  // review A5: the "not me" line rotates instead of repeating four times
  const notMes = s.audio.log.filter((e) => e.name === 'playClerk' && NOT_ME.includes(e.text)).map((e) => e.text);
  assert.equal(new Set(notMes).size, 4, notMes.join(' / '));
});

test('route 4: first wrong press → quip, then finger; second wrong press → "算了，我自己來。" and the beat resolves', () => {
  const s = setup();
  // reach W1
  while (s.op.waiting !== 'gun') s.clock.runUntil(s.clock.t + 10);
  assert.equal(s.op.beat, 'W1');
  s.op.press('shut');
  const quip = s.audio.log.filter((e) => e.name === 'playClerk').at(-1).text;
  assert.equal(quip, zh.system.opening.wrong.w1shut);
  assert.equal(s.op.waiting, null, 'no wait key while the quip plays');
  s.op.press('take'); // < quipCutMs: ignored (no spam)
  assert.equal(s.audio.log.filter((e) => e.name === 'playClerk').at(-1).text, zh.system.opening.wrong.w1shut);
  s.clock.runUntil(s.clock.t + 2700);
  assert.equal(s.op.waiting, 'gun', 'unlocked after the quip');
  const g = s.ui.log.filter((e) => e.name === 'guide').at(-1);
  assert.equal(g.args[0].key, 'gun');
  assert.equal(g.args[0].finger, true);
  s.op.press('take');
  assert.equal(s.audio.log.filter((e) => e.name === 'playClerk').at(-1).text, zh.system.opening.wrong.auto);
  s.clock.runUntil(s.clock.t + 2000);
  // the beat resolved without a correct press: the punch line played and the routine moved on
  assert.notEqual(s.op.beat, 'W1');
  assert.ok(s.audio.log.some((e) => e.name === 'playClerk' && e.text === zh.system.opening.r1), 'r1 played after auto');
});

test('review A4: a second wrong press during the quip cuts it and auto-answers at once; the right key answers', () => {
  for (const second of ['take', 'gun']) {
    const s = setup();
    while (s.op.waiting !== 'gun') s.clock.runUntil(s.clock.t + 10);
    s.op.press('shut');
    s.clock.runUntil(s.clock.t + OPENING_TIMING.quipCutMs + 50);
    const before = s.audio.log.length;
    s.op.press(second);
    const after = s.audio.log.slice(before);
    assert.ok(after.some((e) => e.name === 'cut'), 'the quip is cut');
    if (second === 'take') {
      assert.equal(after.filter((e) => e.name === 'playClerk').at(-1).text, zh.system.opening.wrong.auto);
    } else {
      s.clock.runUntil(s.clock.t + 200);
      assert.ok(s.audio.log.some((e) => e.name === 'playClerk' && e.text === zh.system.opening.r1), 'answered: r1');
    }
    s.clock.runUntil(s.clock.t + 2500);
    assert.notEqual(s.op.beat, 'W1');
  }
});

test('review fix 1: "調你媽！" holds 1400 ms alone; "黃金比例最好喝！" starts after it, lower on the screen', () => {
  const s = setup();
  const at = {};
  let seen = 0;
  let waitSince = null;
  while (!s.done && s.clock.t < 60000) {
    s.clock.runUntil(s.clock.t + 10);
    for (; seen < s.ui.log.length; seen++) {
      const e = s.ui.log[seen];
      if (e.name === 'huazi') at[e.args[0][0].text] ??= { t: s.clock.t, h: e.args[0][0] };
    }
    const w = s.op.waiting;
    if (!w) { waitSince = null; continue; }
    waitSince ??= s.clock.t;
    if (s.clock.t - waitSince >= 800) s.op.press(w);
  }
  const punch = at[zh.system.opening.hz.punch4];
  const gold = at[zh.system.opening.hz.gold];
  assert.ok(punch && punch.h.ms >= 1200, 'S1 hold');
  assert.ok(gold && gold.h.pos[1] >= 48, 'gold S2 on the counter, not over the S1');
  assert.ok(gold.t - punch.t >= punch.h.ms + 100, `gold ${gold.t - punch.t} ms after the punch`);
  assert.ok(s.ui.log.some((e) => e.name === 'speedLines') && s.ui.log.some((e) => e.name === 'flash' && e.args[0] >= 120));
});

test('W3 wrong key brakes: curse cut after 150 ms, scratch, backtrack line, customer repeats 250杯', () => {
  const s = setup();
  drive(s, (k, since, st) => (st.op.beat === 'W3' ? null : since >= 300 ? k : null), { maxMs: 40000 });
  while (s.op.waiting !== 'take') s.clock.runUntil(s.clock.t + 10);
  s.op.press('gun');
  const o = zh.system.opening;
  assert.equal(s.audio.log.filter((e) => e.name === 'playClerk').at(-1).text, o.wrong.w3gun);
  s.clock.runUntil(s.clock.t + 160);
  assert.ok(s.audio.log.some((e) => e.name === 'cut'));
  assert.ok(s.audio.log.some((e) => e.name === 'sfx' && e.sfx === 'scratch'));
  s.clock.runUntil(s.clock.t + 6000);
  const texts = s.audio.log.map((e) => e.text).filter(Boolean);
  assert.ok(texts.includes(o.wrong.w3gunAfter));
  assert.equal(texts.filter((t) => t === o.c3).length, 2, 'customer repeats the order');
  assert.equal(s.op.waiting, 'take');
  const hz = s.ui.log.filter((e) => e.name === 'huazi').map((e) => e.args[0][0]);
  assert.ok(hz.some((h) => h.style === 'S1' && h.break === true && h.text === '滾'));
});

test('the engine is never touched and no timer bar exists: the routine gets no game object', () => {
  const s = setup();
  drive(s, (k, since) => (since >= 500 ? k : null));
  const names = new Set(s.ui.log.map((e) => e.name));
  assert.ok(!names.has('startSignTimer'));
  assert.ok(!names.has('render'));
});

test('skip: offered only after a full run; skip() jumps to the recap and finishes', () => {
  const first = setup();
  first.clock.runUntil(3000);
  assert.ok(!first.ui.log.some((e) => e.name === 'showSkip'), 'no skip on the first run');
  first.op.stop();

  const s = setup({ storage: memStorage({ '250cups.openingDone': '1' }) });
  assert.ok(s.ui.log.some((e) => e.name === 'showSkip' && e.args[1].delayMs === 1200));
  s.clock.runUntil(2000);
  s.op.skip();
  assert.ok(s.ui.log.some((e) => e.name === 'showRecap'));
  s.clock.runUntil(s.clock.t + OPENING_TIMING.recapMs + 500);
  assert.ok(s.done);
  assert.equal(s.op.active, false);
  assert.ok(s.ui.log.some((e) => e.name === 'hideSkip'));
});

test('English content drives the same routine (lines read from content.system.opening)', () => {
  const s = setup({ content: en, lang: 'en' });
  drive(s, (k, since) => (since >= 800 ? k : null));
  assert.ok(s.done);
  const said = s.audio.log.filter((e) => e.text).map((e) => e.text);
  assert.ok(said.includes(en.system.opening.r1));
  assert.ok(said.includes(en.system.opening.r4));
  assert.ok(!said.includes(zh.system.opening.r1));
});

test('press() outside the routine or while locked is consumed but ignored; non-keys are ignored', () => {
  const s = setup();
  assert.equal(s.op.press('gun'), true);
  assert.equal(s.op.waiting, null);
  assert.equal(s.op.press('nope'), true);
  s.op.stop();
  assert.equal(s.op.press('gun'), false);
});
