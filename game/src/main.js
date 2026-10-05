// main.js — wires content + engine + UI + audio + the opening script together for 《来250杯！》/ "250 Cups!".
// Spec: docs/first-minute-spec.md 8.3 (this file), 4.1–4.4 (pace), 7 (one new system per day).
//
// Flow: start card → tap (unlocks audio) → first run on day 1: the opening script (src/opening.js drives
// ui/audio; the engine stays 'idle' the whole time) → day 1 free play (45 s) → closing card → day 2 … 7.
// Each day builds a fresh engine from configForDay(day) / poolForDay(day) (rebuild, no reconfigure).
//
// Per customer (4.1): arrive → head pops, sign rises (signUp) → the customer talks once the clerk is quiet
// (max(signUp, clerk end + 120)) → t0 = min(voice end − talkLeadMs, signUp + 1600), ≥ signUp + 250 →
// game.speechDone() → 'ready' starts the sign timer → press → clerk line (setup | silence | punch) with the
// three-beat face, 花字 and the customer flying out → the next head pops in the tail of the landing
// (game.delayNext(punch end + L − signUp)), so the laugh lands and the next sign is up when L ends.
// A press resolves on key-down; holding on charges it up afterwards (game.charge).
//
// Gameplay v2 stage 1 (docs/gameplay-v2.md 3–4): no dead input. A press while the answered customer flies (from
// the answer until the punch line ends + 200 ms) is a jab (game.jab: kick, shake, slam, S4 word; no clerk voice,
// the line is never cut). The first press after that is "下一位。" (SYSTEM.next, the clip of '（不抬头）下一位。')
// and game.summon() brings the next customer at once (the line always finished). A press up to 150 ms before the
// next customer is answerable is buffered by the engine. The sign corner shows the speed multiplier (×2 while the
// customer talks, ×1.5 / ×1.2 as the timer shrinks). A full fury bar glows; the next press starts rage: silent
// heads every 300 ms, each press sends the current one flying the pressed key's way, the chant follows the
// pressed key (rageLines grouped by key, RAGE_GROUPS), and rage ends with a 0.5 s pause and a polite "下一位".
// Too slow: aura 0 → 10 s of forced politeness (every reply is a service line), never an early close.
// window.__250.inputs (debug) counts press outcomes for tools/bots.mjs.
//
// Gameplay v2 stage 2 (docs/gameplay-v2.md 5–6): days 2+ show the next two customers' mini signs under the counter
// (state.upcoming) and run fast mouth (快嘴: after five correct in a row a quick customer is silent, the clerk plays only
// the punch half — audio playClerk punchOnly — or the key's shout for lines without '|', landing 250 ms, enter 180 ms).
// Each day has a rule (days.js `rule`): day 3 original customers 4–6 times, day 4 the 250 ticket meter, day 5 the
// ex-boss's phone call, day 6 group boxes and change-order customers, day 7 the ex-boss (eight steps, the last one a
// full hold on 收). One mini event mid-round (src/events.js via the engine) and the last 5 s 拉铁门 on days 2+.
// The day card (start card / in-round banner) shows the rule; the summary shows ★1–★3 (days.js evaluateDay), the rating
// (C / B / A / S / gold 250), 新纪录 and the ★3 riddle.
//
// Storage (all try/catch): 250cups.day (default 1, only goes up), 250cups.openingDone, 250cups.lang, 250cups.bleep,
// 250cups.best.N (best queue of day N), 250cups.stars.N (stars of day N ever reached: bit 1 = ★1, 2 = ★2, 4 = ★3).
// URL params: ?lang=zh|en  ?bleep=1  ?day=N  ?skipOpening=1  ?seed=N  ?debug (window.__250 for automated tests)
//
// Opening on day 1: the first run plays it without a skip button; once it was completed
// (250cups.openingDone = '1') a later day 1 (e.g. after quitting mid-day) replays it with "跳过 ▸" (3.1).
// ?skipOpening=1 starts day 1 free play directly (QA).

import { getContent } from './content.js';
import { createGame } from './engine.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { configForDay, poolForDay, dayInfo, clampDay, DAYS, evaluateDay, specialsForDay } from './days.js';
import { createHuaziTracker } from './huazi.js';
import * as art from './art.js';

const params = new URLSearchParams(location.search);
const LANG_KEY = '250cups.lang';
const BLEEP_KEY = '250cups.bleep';
const DAY_KEY = '250cups.day';
const OPENING_KEY = '250cups.openingDone';

function stored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function store(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode etc. */ }
}

const OPENING_QUEUE = 12; // the opening ends with 2 + 10 (bonus250) people in line; day 1 carries them on

// ---------------------------------------------------------------- randomness (?seed=N for QA)
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedParam = params.get('seed');
const rand = seedParam != null && seedParam !== '' ? mulberry32(Number(seedParam) || 0) : Math.random;
const pick = (arr) => (Array.isArray(arr) && arr.length ? arr[Math.floor(rand() * arr.length)] : '');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const now = () => performance.now();

// ---------------------------------------------------------------- persisted state
function initialLang() {
  const p = params.get('lang');
  if (/^zh/i.test(p || '')) return 'zh';
  if (/^en/i.test(p || '')) return 'en';
  const s = stored(LANG_KEY);
  if (s === 'zh' || s === 'en') return s;
  return /^zh\b/i.test(navigator.language || 'zh') ? 'zh' : 'en';
}
// Chinese script: Traditional for Taiwan / Hong Kong / Macau (the first markets), Simplified elsewhere.
// ?lang=zh-TW / zh-Hant / zh-HK forces Traditional, ?lang=zh-CN / zh-Hans / zh-SG Simplified. Display only:
// content, voice clip keys and the engine stay Simplified (ui.setScript converts what is drawn).
function initialScript() {
  const p = params.get('lang') || '';
  const tag = /^zh/i.test(p) ? p : (navigator.languages && navigator.languages.find((l) => /^zh/i.test(l))) || navigator.language || '';
  return /^zh[-_](tw|hk|mo|hant)/i.test(tag) ? 'hant' : 'hans';
}

let lang = initialLang();
let bleep = params.has('bleep') ? params.get('bleep') !== '0' : stored(BLEEP_KEY) === '1';
let content = getContent(lang);
let openingDone = stored(OPENING_KEY) === '1';
const skipOpening = params.get('skipOpening') === '1';
let debugDurationMs = null; // window.__250.durationMs (QA: shorter rounds)
let day = clampDay(params.get('day') ?? stored(DAY_KEY) ?? 1);
let info = dayInfo(day);

function saveDay(n) {
  const prev = clampDay(stored(DAY_KEY) ?? 1);
  if (n > prev) store(DAY_KEY, String(clampDay(n))); // only goes up
}

const script = initialScript();
const audio = createAudio();
audio.setLang(lang);
audio.setBleep(bleep);
// Pre-rendered AI voice clips (tools/voice); lines without a clip fall back to the browser's speech synthesis.
audio.loadVoicePack('voice/manifest.json');

// ---------------------------------------------------------------- content helpers
// The engine runs on the zh customers (id/style/key/cups match in both languages); text is looked up by id.
function originalCustomer() {
  const o = getContent('zh').system.originalCustomer;
  if (!o) return null;
  const steps = Array.isArray(o.steps) && o.steps.length ? o.steps : ['take', 'shut'];
  return { name: '', tag: '', style: '250', cups: 250, ...o, id: o.id ?? 'orig', steps, key: steps[0], reply: o.reply2 ?? o.reply };
}

// Day 6 change-order customer (SYSTEM.changeOrder): a red sign that flips to a gold 250杯 while they talk.
function changeCustomer() {
  const o = getContent('zh').system.changeOrder;
  if (!o) return null;
  return { id: 'change', name: o.name, cat: '数量', style: 'deadpan', key: 'gun', cups: null, says: o.says, sign: o.sign, reply: o.gun, alt: o.gun, flip: { key: 'take', cups: 250, atMs: 3200 } };
}

// Day 7 boss (SYSTEM.boss): eight steps; 3–6 are the haggling phrase, the last one wants a full hold on 收.
const BOSS_KEYS = ['take', 'shut', 'gun', 'take', 'take', 'take', 'take', 'take'];
function bossCustomer() {
  const b = getContent('zh').system.boss;
  if (!b || !Array.isArray(b.steps) || b.steps.length !== BOSS_KEYS.length) return null;
  return {
    id: 'boss', boss: true, holdLast: true, name: b.name, cat: '职场社会', style: 'cold', cups: null, steps: BOSS_KEYS.slice(),
    key: 'take', haggle: [3, 4, 5, 6], stepSpeakMs: 9000, says: b.steps[0].says, sign: b.steps[0].sign, reply: b.steps[7].full, reply2: b.steps[7].full,
  };
}

function local(customer) {
  if (!customer) return customer;
  if (customer.boss) {
    const b = content.system.boss || {};
    return { ...customer, name: b.name || customer.name, says: b.steps?.[0]?.says ?? customer.says, sign: b.steps?.[0]?.sign ?? customer.sign };
  }
  if (customer.id === 'change') {
    const o = content.system.changeOrder || {};
    return { ...customer, name: o.name || customer.name, says: o.says ?? customer.says, sign: o.sign ?? customer.sign };
  }
  if (Array.isArray(customer.group)) return { ...customer, group: customer.group.map((c) => local(c)) };
  if (Array.isArray(customer.steps)) { // the two-step original customer lives in SYSTEM, not in the 100
    const o = content.system.originalCustomer || {};
    return { ...customer, ...o, id: customer.id, key: customer.key, steps: customer.steps, style: customer.style };
  }
  return content.customers.find((c) => c.id === customer.id) || customer;
}

const sys = () => content.system;
const zh = () => lang === 'zh';

// Texts D adds to content (SYSTEM.unlock / tips / daySlow); built-in fallbacks keep main.js running without them.
function unlockText(which) {
  const u = sys().unlock;
  const order = ['aura', 'rage', 'rageTip', 'charge'];
  const fb = zh()
    ? { aura: '气势没了＝被迫营业', rage: '爆气！', rageTip: '乱按都对！', charge: '狠骂！', hold: '按住＝狠骂' }
    : { aura: 'No swagger = forced politeness', rage: 'RAGE!', rageTip: 'Mash anything!', charge: 'HARDER!', hold: 'Hold = harder' };
  if (Array.isArray(u)) return u[order.indexOf(which)] || fb[which];
  return (u && (u[which] || (which === 'rageTip' && u.rageHint))) || fb[which];
}
function tipText(key) {
  const t = sys().tips;
  const fb = zh() ? { gun: '红纸条＝滚', shut: '紫牌子＝闭嘴', take: '金牌子＝收' } : { gun: 'Red slip = SCRAM', shut: 'Purple = SHUT IT', take: 'Gold = DEAL' };
  if (Array.isArray(t)) {
    const word = { gun: /滚|scram|red/i, shut: /闭嘴|shut|purple/i, take: /收|deal|gold/i }[key];
    return t.find((s) => word.test(String(s))) || fb[key];
  }
  return (t && t[key]) || fb[key];
}
function daySlowText() {
  const d = sys().daySlow;
  return (Array.isArray(d) ? d[0] : d) || (zh() ? '太慢！被迫营业' : 'Too slow! Forced to be nice');
}
function signTextOf(spec) {
  try { return art.signText ? art.signText(spec, lang) : spec.says; } catch { return spec.says; }
}
const unpipe = (t) => String(t ?? '').replace(/\s*\|\s*/g, zh() ? '' : ' ');

// ---------------------------------------------------------------- speech + timing
// Estimate when audio gives no timing: 180 + 95 per character (4.1 step 4).
function estimateMs(text) {
  const s = unpipe(text).replace(/（[^（）]*）|\([^()]*\)/g, '');
  if (/[A-Za-z]/.test(s) && !/[一-鿿]/.test(s)) return 180 + 330 * s.split(/\s+/).filter(Boolean).length;
  return 180 + 95 * [...s].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;
}

// ui.customerReact: fly-out per pressed key (滚 520 / 闭嘴 390 / 收 600 ms) + 80 ms until the customer is cleared
const FLY_CLEAR_MS = { gun: 600, shut: 470, take: 680 };
let clerkEndAt = 0; // performance.now() when the clerk's current line ends (customers never talk over it)
let subUntil = 0;   // performance.now() until which the clerk's subtitle must stay up (review: lines were unreadable)

// Reading time of a clerk subtitle: max(1500, 140 ms per character) for Chinese, 1500 / 330 ms per word in
// English. Stage directions are not shown in free play, so they do not count.
const stripStageText = (t) => unpipe(t).replace(/（[^（）]*）|\([^()]*\)/g, '').trim();
// A line that was just heard from the voice pack is read along with the voice, so its subtitle only has to stay
// up until the voice ends + 300 ms (at least 1000 ms and 100 ms per character).
function readMs(text, voiced) {
  const s = stripStageText(text);
  if (voiced && voiced.clips && voiced.clips.punch && (voiced.clips.setup || !voiced.setupMs) && Number.isFinite(voiced.totalMs)) {
    const n = /[A-Za-z]/.test(s) && !/[一-鿿]/.test(s) ? s.split(/\s+/).filter(Boolean).length * 3 : [...s].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;
    return Math.max(1000, 100 * n, voiced.totalMs + 300);
  }
  if (/[A-Za-z]/.test(s) && !/[一-鿿]/.test(s)) return Math.max(1500, 330 * s.split(/\s+/).filter(Boolean).length + 300);
  return Math.max(1500, 140 * [...s].filter((c) => /[\p{L}\p{N}]/u.test(c)).length);
}
/** Clerk subtitle that holds the band for its reading time (customers and the closing card wait for it). */
function clerkLine(text, { voiced, ...opts } = {}) {
  ui.showLine(text, { who: 'clerk', ...opts });
  subUntil = Math.max(subUntil, now() + readMs(text, voiced));
}
let rageGen = 0;

function clerkTiming(p, line, opts) {
  if (p && Number.isFinite(p.punchMs)) {
    return { setupMs: p.setupMs || 0, punchStartMs: p.punchStartMs || 0, punchMs: p.punchMs, totalMs: p.totalMs, clips: p.clips };
  }
  if (typeof audio.voiceTimings === 'function') {
    try { const t = audio.voiceTimings(line, opts); if (t && Number.isFinite(t.punchMs)) return t; } catch { /* estimate */ }
  }
  if (opts.punchOnly) line = punchHalf(line);
  const [a, b] = String(line ?? '').includes('|') ? String(line).split('|') : ['', line];
  const setupMs = a ? estimateMs(a) : 0;
  const punchStartMs = setupMs ? setupMs + (opts.punchGapMs ?? 200) : 0;
  return { setupMs, punchStartMs, punchMs: estimateMs(b) };
}

// fast mouth: the punch half of a cut line (the whole line when it has no '|')
const punchHalf = (t) => { const s = String(t ?? ''); const i = s.indexOf('|'); return i < 0 ? s : s.slice(i + 1); };

/** Clerk line: setup | silence | punch. Returns { setupMs, punchStartMs, punchMs, done }. Cuts the previous line. */
function sayClerk(line, { style, fx = 'normal', gap, punchOnly = false } = {}) {
  rageGen++; // a clerk line also ends any running rage chant loop
  const opts = { punchGapMs: gap ?? info.punchGapMs, punchFx: fx, style, punchOnly };
  let p = null;
  try {
    if (typeof audio.playClerk === 'function') p = audio.playClerk(line, opts);
    else { audio.stopSpeech(); p = audio.speak(unpipe(line), { style }); }
  } catch { p = null; }
  const t = clerkTiming(p, line, opts);
  clerkEndAt = now() + t.punchStartMs + t.punchMs;
  return {
    setupMs: t.setupMs, punchStartMs: t.punchStartMs, punchMs: t.punchMs, totalMs: t.punchStartMs + t.punchMs, clips: t.clips,
    done: Promise.resolve(p).catch(() => {}),
  };
}

/** Customer line at the day's playbackRate. Returns its length in ms. */
function sayCustomer(text) {
  const rate = info.custRate || 1;
  try {
    if (typeof audio.playCustomer === 'function') {
      const p = audio.playCustomer(text, { rate });
      if (p && Number.isFinite(p.ms)) return p.ms;
    } else {
      audio.speak(text, { style: 'cust' });
    }
  } catch { /* estimate */ }
  return estimateMs(text) / rate;
}

function cutVoice() {
  if (typeof audio.cut === 'function') audio.cut(40);
  else audio.stopSpeech();
}

// SYSTEM.rageLines (voice-bible 4.5 SBR01–SBR36) come in key groups: 10 滚, 10 闭嘴, 10 收, then 6 general
// (same order in zh and en). The rage chant follows the key the player pressed last.
const RAGE_GROUPS = { gun: [0, 10], shut: [10, 20], take: [20, 30], any: [30, 36] };
function rageLinesFor(key) {
  const all = sys().rageLines || [];
  const [a, b] = RAGE_GROUPS[key] || RAGE_GROUPS.any;
  const group = all.length >= 36 ? all.slice(a, b) : all;
  return group.length ? group : all;
}

// "下一位。" for the jab → next beat: the SYSTEM.next line whose clip is '下一位。' / 'Next.' (the stage direction
// '（不抬头）' is not spoken), else the first one.
const noStage = (t) => String(t ?? '').replace(/（[^（）]*）|\([^()]*\)/g, '').trim();
function nextLine() {
  const list = sys().next || [];
  return list.find((t) => /^(下一位。|Next\.)$/.test(noStage(t))) || list[0] || (zh() ? '下一位。' : 'Next.');
}
// rage end: a sigh and a polite "下一位" ('（叹气）……下一位。'), the clerk is back to professional
function rageCloseLine() {
  const list = sys().next || [];
  return list.find((t) => /^……下一位。$|^…Next\.$/.test(noStage(t))) || nextLine();
}

let rageKey = 'any';
async function rageChant() {
  const g = ++rageGen;
  const lines = sys().rageLines || [];
  if ((!audio.canSpeak && !audio.hasVoicePack) || !audio.unlocked || !lines.length) return;
  while (g === rageGen && game && game.state.phase === 'rage') {
    const line = pick(rageLinesFor(rageKey));
    ui.showLine(line, { style: 'curse', who: 'clerk' });
    const t0 = now();
    await audio.speak(line, { style: 'rage' });
    // Guard against engines that resolve instantly (no tight loop).
    if (now() - t0 < 150) await wait(250);
  }
}

// ---------------------------------------------------------------- timers bound to the round
let roundTimers = [];
function later(ms, fn) {
  const t = setTimeout(() => { roundTimers = roundTimers.filter((x) => x !== t); fn(); }, Math.max(0, ms));
  roundTimers.push(t);
  return t;
}
function clearRoundTimers() {
  roundTimers.forEach(clearTimeout);
  roundTimers = [];
}

// ---------------------------------------------------------------- jab / next (gameplay-v2 3)
// Press outcomes of this round (debug: window.__250.inputs, read by tools/bots.mjs).
let inputs = {};
// The landing pause after an answer, a timeout or rage: its line ends at lineEndAt (performance.now()).
let landing = null; // { lineEndAt, kind: 'answer' | 'polite' | 'rage' }
const JAB_TO_NEXT_MS = 200; // presses until the punch end + this are jabs; the first one after it calls the next

/** A press while nobody is at the counter: a jab while the customer flies, "下一位" once the line is over. */
function landingPress(key) {
  const t = now();
  if (landing && t >= landing.lineEndAt + JAB_TO_NEXT_MS) return callNext() ? 'next' : 'dead';
  if (landing && landing.kind === 'answer' && game.jab(key)) return 'jab';
  return 'dead';
}

// ---------------------------------------------------------------- stage 2: storage, stars, timing helpers
const bestKey = (n) => `250cups.best.${n}`;
const starsKey = (n) => `250cups.stars.${n}`;
function loadBest(n) {
  const b = Number(stored(bestKey(n)));
  const m = Number(stored(starsKey(n)));
  return { best: Number.isFinite(b) && b > 0 ? b : 0, mask: Number.isFinite(m) ? m & 7 : 0 };
}
/** Saves the day's best queue and the union of stars ever reached. Returns { newRecord, best, mask }. */
function saveBest(n, queue, mask) {
  const prev = loadBest(n);
  const newRecord = queue > prev.best && prev.best > 0;
  const best = Math.max(prev.best, queue);
  if (queue > prev.best) store(bestKey(n), String(queue));
  const union = prev.mask | mask;
  if (union !== prev.mask) store(starsKey(n), String(union));
  return { newRecord, first: prev.best === 0, best, mask: union };
}
const dayText = (n) => (sys().days || {})[n] || {};
const reportText = () => sys().report || {};
const fmtN = (t, n) => String(t ?? '').replace('{n}', n);
// sign-up time of a customer: head pop + 120 ms + 160 ms sign flip
// (silent customers in fast mouth / groups: the sign rises 40 ms after the head, so sign up = enter + 200)
const signUpOf = (silent) => (silent ? (info.quickEnterMs ?? 180) + 200 : (info.enterMs ?? 300) + 280);

function callNext() {
  if (!game || game.state.current || game.state.phase !== 'playing') return false;
  const line = nextLine();
  landing = null;
  subUntil = now(); // the clerk's last subtitle has been heard; "下一位。" replaces it
  clerkLine(line, { style: 'real' });
  const t = sayClerk(line, { style: 'real' });
  // the next customer may start talking on the tail of "下一位。" (calling the next must save time, not add a line)
  clerkEndAt = now() + Math.max(0, t.totalMs - 350);
  return game.summon();
}

// ---------------------------------------------------------------- UI
const root = document.getElementById('app');
const pressOk = {}; // key → the press that started this hold resolved a customer (so charge may apply)
let game = null;
let opening = null;
const openingActive = () => !!(opening && (typeof opening.active === 'function' ? opening.active() : opening.active));

const ui = createUI(root, {
  onPress(key, holdMs) {
    if (openingActive()) { opening.press(key); return; }
    if (!game) return;
    syncClock(); // the press lands at its real time, not at the previous frame
    const before = game.state;
    const r = game.press(key, holdMs);
    let kind = 'dead';
    if (r && r.rageStart) kind = 'rageStart';
    else if (r && r.rage) kind = r.miss ? 'rageMiss' : 'rage';
    else if (r && r.event) kind = 'event';
    else if (r && r.buffered) kind = 'buffered';
    else if (r && r.tooEarly) { kind = 'late'; ui.shake?.(2, 50); audio.sfx('tap', { intensity: 0.4 }); }
    else if (r && r.holding) kind = 'holding';
    else if (r && 'land' in r) kind = r.correct ? 'answer' : 'wrong';
    else if (r && r.group) kind = 'group';
    else if (r && r.step != null) kind = 'step';
    else if (!r && before.phase === 'playing' && !before.current && !before.paused && !before.shutter) kind = landingPress(key);
    inputs[kind] = (inputs[kind] || 0) + 1;
    // a resolved answer (not a rage hit or a first step) may be charged; the boss's last step waits for the full hold
    pressOk[key] = !!r && !r.rage && ((r.correct && 'land' in r) || !!r.holding);
    if (kind === 'answer' || kind === 'wrong' || kind === 'step' || kind === 'buffered' || kind === 'group' || kind === 'holding') audio.sfx('press');
    if (kind === 'rageMiss') audio.sfx('tap', { intensity: 0.4 });
    if (kind !== 'dead' && navigator.vibrate) { try { navigator.vibrate(10); } catch { /* optional */ } }
    ui.render(game.state);
  },
  onCharge(key, level) {
    if (openingActive() || !game || !pressOk[key]) return;
    syncClock();
    game.charge(level);
    ui.render(game.state);
  },
  // stage 2: the calculator resolves on release; a release on the boss's last step before the full hold repeats it
  onRelease(key, holdMs) {
    if (openingActive() || !game) return;
    syncClock();
    const r = game.release?.(key, holdMs);
    if (r) ui.render(game.state);
  },
  onStart() {
    beginFromCard();
  },
  onToggleLang(next) {
    setLang(next);
  },
  onToggleBleep(on) {
    bleep = !!on;
    audio.setBleep(bleep);
    store(BLEEP_KEY, bleep ? '1' : '0');
    if (bleep && audio.unlocked) audio.sfx('bleep', { duration: 0.15 });
  },
});

function applyTexts() {
  ui.setTexts({ ...sys().ui, lang });
}

function startTexts() {
  // SYSTEM.start { title, subtitle, start, startDay ('{n}') }; ui.js has the spec defaults (3.2) for anything missing.
  return { title: zh() ? '来250杯！' : '250 Cups!', ...(sys().start || {}) };
}

function showStartCard() {
  const t = startTexts();
  if (day > 1 || openingDone) Object.assign(t, dayCardTexts(day));
  ui.showStart(t, { firstRun: !openingDone, day });
}

// Day card texts (stage 2): "第 N 天 · 午休潮", the rule in one line, the ★3 riddle, best queue / stars so far.
function dayCardTexts(n) {
  const d = dayText(n);
  const r = reportText();
  const { best, mask } = loadBest(n);
  return {
    dayTitle: d.name ? `${fmtN(r.day, n)} · ${d.name}` : '',
    rule: d.rule || '',
    riddle: d.riddle ? `${r.riddle || ''}：${d.riddle}`.replace(/^：/, '') : '',
    best: best ? `${r.best || ''} ${best.toLocaleString('en-US')}` : '',
    starMask: mask,
  };
}

let lastSummary = null;
let lastVerdict = '';
let lastPassed = false;
let lastEval = null;   // days.js evaluateDay() of the last finished day
let lastRecord = null; // saveBest() result
let lastDay = day;

function setLang(next) {
  lang = next === 'en' ? 'en' : 'zh';
  content = getContent(lang);
  audio.setLang(lang);
  audio.stopSpeech();
  if (audio.unlocked) audio.preloadVoice();
  store(LANG_KEY, lang);
  round.tracker?.setLang?.(lang);
  applyTexts();
  if (openingActive()) return; // opening.js re-reads content / lang every beat
  const phase = game ? game.state.phase : 'idle';
  if (phase === 'playing' || phase === 'rage') ui.relabelCustomer(local(game.state.current?.customer));
  ui.relabelMilestone();
  if (phase === 'idle') showStartCard();
  else if (phase === 'over' && lastSummary) showReport(lastSummary, true);
}

function closingTexts() {
  const c = sys().opening?.closing;
  if (c) return c;
  return zh()
    ? { title: '第一天 打烊', lines: ['嗯……／杯数太少 → 滚', '有要求的 → 闭嘴', '大单 → 收'] }
    : { title: 'Day 1 — Closed', lines: ['Ummm… / tiny orders → SCRAM', 'Special requests → SHUT IT', 'Big orders → DEAL'] };
}

function showReport(summary, relocalize = false) {
  if (lastDay === 1) {
    // 2 (review): the ticket "No.001 / 250杯 / 两个月后取餐" and the day's savagest line on top of the card
    const bestC = local(content.customers.find((c) => c.id === summary.bestLineId));
    const bestRaw = bestC ? (bestLineMeta.id === summary.bestLineId && bestLineMeta.alt ? bestC.alt : bestC.reply) : '';
    ui.showClosing(closingTexts(), {
      queue: summary.queue, stars: lastEval ? lastEval.count : lastPassed ? 1 : 0, star1: dayInfo(1).star1,
      plate: sys().opening?.plate, bestLine: bestRaw ? stripStageText(bestRaw) : '',
      bestLabel: zh() ? '今天最狠一句' : "Today's savagest line",
    }, () => beginFromCard());
    return;
  }
  if (relocalize || !lastVerdict) lastVerdict = pick(sys().closing);
  const best = local(content.customers.find((c) => c.id === summary.bestLineId));
  let line = bestLineMeta.id === summary.bestLineId && best ? (bestLineMeta.alt ? best.alt : best.reply) : best?.reply;
  if (!best && bestLineMeta.id === summary.bestLineId && bestLineMeta.line) line = bestLineMeta.line;
  // ★1 reached → the button opens the next day; otherwise this day again (7)
  const star1 = dayInfo(lastDay).star1;
  const st = sys().start || {};
  const nextLabel = st.startDay ? String(st.startDay).replace('{n}', day) : null;
  ui.showSummary(summary, {
    bestLine: line ? unpipe(line) : undefined, verdict: lastVerdict, star1,
    again: (lastPassed && day !== lastDay && nextLabel) || sys().ui.again, ...reportTexts(lastDay, summary),
  });
}

// Stars, rating, record and the ★3 riddle for the summary card (stage 2).
function reportTexts(n, summary) {
  const ev = lastEval || evaluateDay(n, summary);
  const d = dayText(n);
  const r = reportText();
  const info1 = dayInfo(n);
  const lines = [
    info1.star1 != null ? fmtN(r.star1, info1.star1.toLocaleString('en-US')) : r.star1Boss,
    `${r.star2 || '★2 '}${d.star2 || ''}`,
    `${r.star3 || '★3 '}${ev.stars[2] ? d.riddle || '' : '？？？'}`,
  ];
  const next = lastPassed && day !== n ? dayText(day) : null;
  return {
    title: d.name ? `${fmtN(r.day, n)} · ${d.name}` : undefined,
    stars: ev.stars, starLines: lines, rating: ev.rating, gold: ev.gold, ratingLabel: r.rating,
    record: lastRecord && lastRecord.newRecord ? r.newRecord : '', bestText: lastRecord ? `${r.best || ''} ${lastRecord.best.toLocaleString('en-US')}` : '',
    hint: ev.stars[2] ? (ev.count === 3 ? r.allStars : '') : `${r.toStar3 || ''}${d.riddle || ''}`,
    tomorrow: next && next.name ? `${r.tomorrow || ''}${next.name} · ${next.rule || ''}` : '',
  };
}

// ---------------------------------------------------------------- start / opening / rounds
async function unlockAudio() {
  audio.unlock();
  audio.setLang(lang);
  audio.setBleep(bleep);
  audio.preloadVoice();
}

let starting = false;
async function beginFromCard() {
  if (starting) return;
  starting = true;
  try {
    await unlockAudio();
    if (typeof ui.fontsReady === 'function') await ui.fontsReady(300);
    if (day === 1 && !skipOpening && await runOpeningScript()) return;
    startRound();
  } finally {
    starting = false;
  }
}

// Runs src/opening.js (developer D). Returns false when the module is unavailable (then day 1 starts directly).
async function runOpeningScript() {
  let mod = null;
  try { mod = await import('./opening.js'); } catch (err) { console.warn('[main] opening.js unavailable:', err && err.message); }
  if (!mod || typeof mod.runOpening !== 'function') return false;
  info = dayInfo(1);
  game = buildGame(1); // built but never started: game.state.phase stays 'idle' for the whole script (A2)
  clearRoundTimers();
  audio.crowd(0.08);
  let finished = false;
  const onDone = (result) => {
    if (finished) return;
    finished = true;
    opening = null;
    openingDone = true;
    store(OPENING_KEY, '1');
    const carry = Number.isFinite(result?.queue) ? result.queue : mod.OPENING_QUEUE ?? 12;
    startRound({ carry });
  };
  try {
    // content / lang as getters: a language switch mid-routine applies from the next line
    // skippable: only once the routine was completed before (3.1)
    opening = mod.runOpening({ ui, audio, content: () => content, lang: () => lang, onDone, skippable: openingDone });
  } catch (err) {
    console.error('[main] opening failed, starting day 1:', err);
    opening = null;
    return false;
  }
  return true;
}

// Round-scoped bookkeeping (reset by startRound).
const round = {
  arrivals: 0,
  tracker: null,
  seenKeys: new Set(),
  wrongByKey: { gun: 0, shut: 0, take: 0 },
  tipped: new Set(),
  tipsShown: 0,
  pendingTip: null,
  timeoutsInRow: 0,
  guideNext: false,
  guideActive: false,
  auraShown: false,
  rageIntroDone: false,
  chargeIntroDone: false,
  charge2Done: false,
  rageHits: 0,
  suppressMilestone: false,
  takes: 0,
};
let bestLineMeta = { id: null, alt: false, score: -Infinity };

function buildGame(n) {
  const d = dayInfo(n);
  const extra = {};
  if (d.specials && d.specials.length) {
    // stage 2: the day's specials (original / group / change-order / boss), each once at its time
    extra.specials = specialsForDay(n, { original: originalCustomer(), change: changeCustomer(), boss: bossCustomer() });
  } else if (d.original) {
    const special = originalCustomer();
    if (special) extra.special = { customer: special, atMs: d.original.atMs };
  }
  if (debugDurationMs > 0) extra.durationMs = debugDurationMs;
  // ?debug&first=78,63,47: these customer ids come first (QA: a deterministic draw)
  if (params.has('debug') && params.get('first')) extra.fixedOrder = params.get('first').split(',').map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const g = createGame({ customers: poolForDay(n, getContent('zh').customers), rng: rand, config: configForDay(n, extra) });
  wire(g);
  return g;
}

// Day 1 (and the opening) shows only the queue (7): no bars, no clock.
function hudOpts() {
  return { showAura: info.showAura === true || round.auraShown, showFury: info.showFury === true, showTime: info.day !== 1 };
}

function startRound({ carry = 0 } = {}) {
  clearRoundTimers();
  info = dayInfo(day);
  lastDay = day;
  Object.assign(round, {
    arrivals: 0, tracker: createHuaziTracker({ mode: 'normal', lang }), seenKeys: new Set(),
    wrongByKey: { gun: 0, shut: 0, take: 0 }, tipped: new Set(), tipsShown: 0, pendingTip: null,
    timeoutsInRow: 0, guideNext: false, guideActive: false, auraShown: false, rageIntroDone: false,
    chargeIntroDone: false, charge2Done: false, rageHits: 0, suppressMilestone: false, takes: 0,
  });
  subUntil = 0;
  inputs = {};
  landing = null;
  rageKey = 'any';
  ui.setSignMult?.('');
  ui.setForced?.(false);
  // stage 2 overlays from the last round
  shown = { preview: '', meter: null, quick: null, event: null };
  ui.setPreview?.([]);
  ui.setMeter?.(info.meter ? 0 : null);
  ui.setQuick?.(false, 0);
  ui.hideEvent?.();
  ui.shutter?.(false);
  // day 1 after the opening: the shut key may still be covered and guides may linger
  ui.coverKey?.('shut', false, { animate: false });
  ui.clearGuide?.();
  ui.unlockInput?.();
  ui.camera?.('WIDE', 1, 450); // the start card frames the clerk's face at 1.15
  clerkEndAt = 0;
  game = buildGame(day);
  ui.setHud?.(hudOpts());
  game.start();
  if (carry > 0) {
    round.suppressMilestone = true; // already celebrated in the opening
    game.bonus(carry);
    round.suppressMilestone = false;
  }
  audio.sfx('slam');
  audio.crowd(0.08);
  lastCrowd = -1;
  ui.render(game.state, hudOpts());
  // day card (stage 2): the day's name and rule in one line, without stopping the clock
  if (day > 1) {
    const t = dayCardTexts(day);
    if (t.dayTitle) ui.dayBanner?.(t.dayTitle, t.rule, 2200);
  }
}

// What the frame loop last drew of the stage-2 state (preview, meter, fast mouth, event panel).
let shown = { preview: '', meter: null, quick: null, event: null };
function previewSpec(c) {
  if (!c) return null;
  const loc = local(c);
  const kind = art.signKind ? art.signKind(loc) : c.key;
  return { kind, text: signTextOf(loc) };
}
function syncStage2(st) {
  // the next customers' mini signs (days 2+)
  const ids = (st.upcoming || []).map((c) => c.id).join(',');
  const prevKey = ids + ':' + lang;
  if (prevKey !== shown.preview) {
    shown.preview = prevKey;
    ui.setPreview?.((st.upcoming || []).map(previewSpec).filter(Boolean));
  }
  if (info.meter && st.meter !== shown.meter) {
    shown.meter = st.meter;
    ui.setMeter?.(st.meter);
  }
  const q = st.quick ? st.quickRun : -1;
  if (q !== shown.quick) {
    shown.quick = q;
    ui.setQuick?.(st.quick, st.quickRun);
  }
  const ev = st.event;
  if (ev) {
    const big = eventBig(ev);
    if (big !== shown.event) { shown.event = big; ui.updateEvent?.({ big }); }
  } else shown.event = null;
}
// the big number of the event panel
function eventBig(ev) {
  if (!ev) return '';
  if (ev.type === 'calculator') return ev.value == null ? '---' : String(ev.value);
  if (ev.type === 'stamp') return `${ev.value ?? 0}/${ev.target ?? 250}`;
  if (ev.type === 'phone') return ev.hungUp ? '...' : `${Math.max(0, 2 - ev.count)}`;
  if (ev.type === 'shutter') return `+${ev.count}`;
  return `+${ev.count}`;
}

// ---------------------------------------------------------------- engine events
function wire(g) {
  g.on('start', () => {
    lastSummary = null;
    lastVerdict = '';
    bestLineMeta = { id: null, alt: false, score: -Infinity };
    ui.showLine(pick(sys().next), { who: 'system' });
  });

  g.on('arrive', ({ customer, silent }) => {
    const gen = ++round.arrivals;
    round.tracker?.next();
    if (round.guideActive) { ui.clearGuide(); round.guideActive = false; }
    // review fix: nothing of the last answer (花字, the clerk's hit / ticket pose) may land on this sign. The head
    // pops in the tail of the landing (pace), so a 花字 still fading out may finish (it ends by signUp, see
    // onResolve); the new sign clears any in its way when it rises, and nothing new of the last answer starts.
    ui.clearHuazi?.({ pendingOnly: true });
    ui.resetClerk?.();
    const loc = local(customer);
    landing = null;
    const enterMs = silent ? info.quickEnterMs ?? 180 : info.enterMs;
    ui.setSignMult?.(game && game.config.speedCutIn > 1 ? '×' + game.config.speedCutIn : ''); // ×2 while they talk
    let shownC = null;
    if (Array.isArray(loc.group)) {
      // group box: 3–5 heads with the same sign colour, one big sign "×N"
      shownC = ui.showGroup?.(loc.group, { key: customer.key, enterMs, signDelayMs: 40, sign: fmtN((sys().eventUi || {}).group || '{n}', loc.group.length) });
      audio.sfx('crowdOh', { intensity: 0.6 });
    }
    const { signUpAt } = shownC || ui.showCustomer(loc, { enterMs, line: false, signDelayMs: silent ? 40 : 120 }) || { signUpAt: now() + enterMs + 280 };
    audio.sfx('pop');
    const key = customer.key;
    // 7, day 4: the first big order teaches hold-to-charge
    if (info.intro === 'charge' && !round.chargeIntroDone && key === 'take' && (customer.cups ?? 0) >= 100) {
      round.chargeIntroDone = true;
      round.guideActive = true;
      ui.guide?.({ key: 'take', dimOthers: false, glow: true, finger: true });
      ui.tip?.(unlockText('hold'), { key: 'take', ms: 1800 });
    }
    if (silent) {
      // fast mouth / group: nobody talks, the sign is the order (t0 comes from the engine: sign up + 120 ms); no ×2 tag
      // (a silent customer cannot be talked over: the sign timer shows ×1.5 / ×1.2 from t0)
      ui.setSignMult?.('');
      return;
    }
    // 4.4: the first sign of a type today → that key breathes once
    if (!round.seenKeys.has(key)) { round.seenKeys.add(key); ui.breathKey?.(key); }
    // 4.4: two timeouts in a row → a finger for the next customer only
    if (round.guideNext) {
      round.guideNext = false;
      round.guideActive = true;
      ui.guide?.({ key, finger: true, line: true });
    }
    customerTalks(gen, loc, signUpAt);
  });

  g.on('ready', ({ patienceMs, customer, step }) => {
    ui.startSignTimer?.(patienceMs, { steps: g.config.speedSteps });
    if (customer && customer.boss && customer.holdLast && step === customer.steps.length - 1) {
      ui.guide?.({ key: 'take', dimOthers: false, glow: true, finger: true });
      round.guideActive = true;
      ui.tip?.(sys().boss?.hold || '', { key: 'take', ms: 1800 });
    }
  });

  g.on('step', (e) => (e.boss ? onBossStep(e) : onStep(e)));

  // ---- stage 2 events
  g.on('quickStart', () => {
    ui.huazi([{ text: sys().quick?.start || '快嘴！', style: 'S1', seg: 'punch', ratio: 0 }]);
    audio.sfx('sparkle');
  });
  g.on('quickEnd', () => { ui.setQuick?.(false, 0); });

  g.on('groupHit', ({ hits, key }) => {
    ui.groupHit?.(hits, key);
    ui.shake?.(4, 80);
    audio.sfx('slam', { intensity: 0.7 });
    const word = rageLinesFor('any')[hits === 1 ? 1 : 2] || sys().ui?.[key];
    if (word) { ui.showLine(word, { style: 'curse', who: 'clerk' }); sayClerk(word, { style: 'rage' }); }
  });

  g.on('flip', () => {
    const o = sys().changeOrder || {};
    const gen = round.arrivals;
    ui.showSign?.({ key: 'take', sign: o.sign2, cups: 250 }, { flip: 'rotY' });
    audio.sfx('card');
    if (!o.says2) return;
    later(Math.max(0, clerkEndAt + 80 - now()), () => {
      if (gen !== round.arrivals || !game || !game.state.current?.speaking) return;
      ui.showLine(o.says2, { who: 'cust', color: 'take' });
      const ms = sayCustomer(o.says2);
      later(Math.max(250, ms), () => { if (gen === round.arrivals && game) game.speechDone(); });
    });
  });

  g.on('holding', () => { ui.setClerk?.('perfect', 900); audio.sfx('drumroll', { intensity: 0.5 }); });

  g.on('bossAgain', ({ step }) => {
    ui.stopSignTimer?.();
    if (round.guideActive) { ui.clearGuide(); round.guideActive = false; }
    const b = sys().boss || {};
    const st = (b.steps || [])[step] || {};
    const gen = round.arrivals;
    ui.huazi([{ text: b.again || '', style: 'S3', seg: 'setup', ratio: 0 }]);
    audio.sfx('boo', { intensity: 0.5 });
    later(500, () => {
      if (gen !== round.arrivals || !game || !game.state.current?.speaking) return;
      ui.showLine(st.says, { who: 'cust', color: BOSS_KEYS[step] });
      const ms = sayCustomer(st.says);
      later(Math.max(250, ms), () => { if (gen === round.arrivals && game) game.speechDone(); });
    });
  });

  g.on('meter', (e) => onMeter(g, e));

  g.on('leave', () => {
    ui.stopSignTimer?.();
    cutVoice();
    ui.customerReact?.('sink');
  });

  g.on('bonus', ({ queueDelta, event }) => { if (event && queueDelta > 0) ui.queueGain?.(queueDelta); });
  g.on('eventStart', (e) => onEventStart(g, e));
  g.on('eventCue', (e) => onEventCue(g, e));
  g.on('eventEnd', (e) => onEventEnd(g, e));

  g.on('resolve', (e) => onResolve(e));

  g.on('charge', ({ level }) => {
    ui.effect('charge', { level });
    audio.sfx('slam', { intensity: 0.8 + level * 0.15 });
    if (level >= 2) {
      audio.sfx('shake');
      if (info.intro === 'charge' && !round.charge2Done) {
        round.charge2Done = true;
        ui.huazi([{ text: unlockText('charge'), style: 'S1', seg: 'punch', ratio: 0 }]);
      }
      // v2: no shout here any more: it cut the customer's own punch line (fx 'mega' plays it in full)
    }
  });

  g.on('polite', () => {
    ui.stopSignTimer?.();
    if (round.guideActive) { ui.clearGuide(); round.guideActive = false; }
    const line = pick(sys().polite);
    clerkLine(line, { style: 'polite' });
    const boos = [...(sys().boo || [])].sort(() => rand() - 0.5).slice(0, 3);
    ui.effect('polite', { boo: boos });
    audio.sfx('boo');
    boos.slice(0, 2).forEach((b, i) => audio.announce(b, { delay: 0.2 + i * 0.5, gainValue: 0.5 }));
    const pt = sayClerk(line, { style: 'polite' });
    ui.setSignMult?.('');
    landing = { lineEndAt: now() + pt.punchStartMs + pt.punchMs, kind: 'polite' };
    g.delayNext(Math.max(pt.punchStartMs + pt.punchMs + 200, subUntil - now() - info.enterMs - 280));
    if (day === 1) ui.huazi([{ text: daySlowText(), style: 'S3', seg: 'setup', ratio: 0 }]);
    round.timeoutsInRow += 1;
    if (round.timeoutsInRow >= 2) { round.guideNext = true; round.timeoutsInRow = 0; }
    // 7, day 2: the first timeout slides the aura bar in after the polite voice
    if (info.showAura === 'intro' && !round.auraShown) later(dayInfo(day).landPoliteMs ?? 1600, showAuraIntro);
  });

  g.on('furyFull', () => {
    audio.sfx('sparkle');
    audio.sfx('rage', { intensity: 0.4 });
  });

  g.on('rageStart', () => {
    ui.stopSignTimer?.();
    ui.setSignMult?.('');
    landing = null;
    rageKey = 'any';
    ui.clearCustomer?.(); // a waiting customer steps aside (comes back after rage)
    if (info.intro === 'rage' && !round.rageIntroDone) {
      // 7, day 3: freeze 1000 ms, S1 "爆气！" + S3 "乱按都对！", then rage runs
      round.rageIntroDone = true;
      g.pause();
      ui.freeze?.(1000);
      audio.sfx('rage');
      ui.huazi([
        { text: unlockText('rage'), style: 'S1', seg: 'punch', ratio: 0, at: 0 },
        { text: unlockText('rageTip'), style: 'S3', seg: 'setup', ratio: 0, at: 450 },
      ]);
      later(1000, () => { if (game === g) { g.resume(); startRageScene(); } });
      return;
    }
    startRageScene();
  });

  // rage (gameplay-v2 4): a silent half-head with a sign every 300 ms; each hit sends it flying the pressed key's way
  g.on('rageHead', ({ customer }) => {
    ui.showCustomer(local(customer), { enterMs: 90, signDelayMs: 0, line: false });
  });

  g.on('rageHit', ({ queueDelta, key, match }) => {
    ui.customerReact?.(key);
    ui.effect('hit', { charge: match ? 2 : 1 });
    audio.sfx('slam', { intensity: match ? 1 : 0.7 });
    if (match) audio.sfx('boom', { intensity: 0.5 });
    ui.queueGain?.(queueDelta);
    round.rageHits += 1;
    rageKey = key;
    // 4.2: during rage one S1 every 5 hits
    if (round.rageHits % 5 === 0) ui.huazi([{ text: sys().ui?.[key] || '滚！', style: 'S1', seg: 'punch', ratio: 0 }]);
    else ui.showLine(pick(rageLinesFor(key)), { style: 'curse', who: 'clerk' });
  });

  g.on('rageMiss', ({ key }) => { rageKey = key; ui.shake?.(3, 60); });

  g.on('rageEnd', () => {
    rageGen++;
    round.rageHits = 0;
    ui.effect('rageEnd', {});
    if (g.state.phase === 'over' || g.state.shutter) return;
    ui.clearCustomer?.();
    audio.cut(60);
    // the third beat: 0.5 s of silence, then the clerk is professional again
    const PAUSE = 500;
    const line = rageCloseLine();
    const t = clerkTiming(null, line, { punchGapMs: info.punchGapMs, punchFx: 'normal', style: 'polite' });
    const lineMs = t.punchStartMs + t.punchMs;
    landing = { lineEndAt: now() + PAUSE + lineMs, kind: 'rage' };
    g.delayNext(PAUSE + lineMs + 150);
    later(PAUSE, () => {
      if (game !== g || g.state.phase !== 'playing') return;
      ui.setClerk?.('polite', lineMs + 200);
      clerkLine(line, { style: 'polite' });
      sayClerk(line, { style: 'polite' });
    });
  });

  // too slow (gameplay-v2 3): aura 0 → forced politeness for 10 s, then back to 40
  g.on('forcedStart', () => {
    ui.setForced?.(true);
    ui.huazi([{ text: daySlowText(), style: 'S3', seg: 'setup', ratio: 0 }]);
  });
  g.on('forcedEnd', () => {
    ui.setForced?.(false);
    audio.sfx('rage', { intensity: 0.5 });
  });

  g.on('jab', ({ key, n, queueDelta }) => {
    ui.kick?.(key, { word: sys().ui?.[key], n });
    audio.sfx('slam', { intensity: 0.5 });
    if (n === 1) audio.sfx('crowdOh', { intensity: 0.5 });
    if (queueDelta > 0) ui.queueGain?.(queueDelta);
  });

  g.on('milestone', ({ level }) => {
    if (round.suppressMilestone) return;
    const text = sys().milestones?.[level] || '';
    // Pass a getter so a queued or visible card follows a language switch (acceptance D10).
    ui.showMilestone(level, () => sys().milestones?.[level] || '');
    audio.sfx('milestone');
    audio.announce(text, { delay: 0.25, gainValue: 0.9 });
    audio.sfx('cheer', { delay: 0.4 });
  });

  g.on('over', ({ summary }) => {
    clearRoundTimers();
    rageGen++;
    ui.stopSignTimer?.();
    ui.clearGuide?.();
    lastSummary = summary;
    const finishedDay = day;
    lastDay = finishedDay;
    ui.hideEvent?.();
    ui.setPreview?.([]);
    ui.setQuick?.(false, 0);
    lastEval = evaluateDay(finishedDay, summary);
    lastPassed = lastEval.stars[0];
    lastRecord = saveBest(finishedDay, summary.queue, lastEval.mask);
    // Day 1 always moves on (U6: tap into day 2); later days need ★1, otherwise the day is replayed.
    if (finishedDay === 1 || lastPassed) {
      const next = clampDay(finishedDay + 1);
      saveDay(finishedDay + 1);
      day = next;
    }
    ui.render(g.state, hudOpts());
    lastVerdict = pick(sys().closing);
    // review fix: the day's last clerk line used to be cut after 50 ms; it keeps its reading time first
    const lastLineMs = Math.max(0, subUntil - now());
    const stillHere = () => game === g && g.state.phase === 'over' && lastSummary === summary;
    setTimeout(() => {
      if (!stillHere()) return;
      ui.clearCustomer?.(); // no half-served customer behind the card
      clerkLine(lastVerdict, { style: 'deadpan' });
      sayClerk(lastVerdict, { style: 'deadpan' });
    }, lastLineMs);
    audio.sfx('slam');
    audio.sfx('cheer', { delay: 0.3 });
    setTimeout(() => audio.crowd(0), 1500);
    // Let the last hit land and the verdict be read before the card slides in.
    setTimeout(() => { if (stillHere()) showReport(summary); }, lastLineMs + 1300);
  });
}

// 4.1 steps 3–4: talk at max(signUp, clerk end + 120); t0 = clamp(voice end, signUp + 250, signUp + 1600).
// During rage the customer only holds up the sign (no voice).
function customerTalks(gen, loc, signUpAt) {
  const says = loc.says;
  // the customer waits for the clerk's voice and for the clerk's subtitle to be read (review fix 3)
  const startAt = Math.max(signUpAt, clerkEndAt + 120, subUntil);
  later(startAt - now(), () => {
    if (gen !== round.arrivals || !game || !game.state.current?.speaking) return;
    if (says) ui.showLine(says, { who: 'cust', color: loc.key });
    const ms = game.state.phase === 'rage' ? 0 : sayCustomer(says);
    // talkLeadMs (day 1): the window opens a little before the voice ends, so a prompt answer comes right after it.
    // The boss and the change-order customer talk longer; the change-order customer's first line ends in the flip.
    const maxTalk = loc.boss || loc.flip ? 3600 : 1600;
    const t0 = clamp(now() + ms - (info.talkLeadMs || 0), signUpAt + 250, signUpAt + maxTalk);
    later(t0 - now(), () => {
      if (gen !== round.arrivals || !game) return;
      if (loc.flip) game.flip();
      else game.speechDone();
    });
  });
}

// Two-step original-film customer (7): 收 → "好，250杯什么？" → the sign flips to a purple one and the
// customer says "少甜少冰！" → a second timed wait for 闭嘴.
function onStep(e) {
  const gen = round.arrivals;
  ui.stopSignTimer?.();
  if (e.cutIn) cutVoice();
  const o = local(e.customer);
  const reply = o.reply1 || (zh() ? '好，250杯什么？' : 'Okay. 250 cups of what?');
  const says2 = o.says2 || (zh() ? '少甜少冰！' : 'Less sugar, less ice!');
  clerkLine(reply, { style: 'cold' });
  audio.sfx('bell');
  const t = sayClerk(reply, { style: 'cold' });
  const replyEnd = t.punchStartMs + t.punchMs;
  ui.setClerk?.('perfect', replyEnd + 200);
  later(replyEnd + 100, () => {
    if (gen !== round.arrivals || !game || !game.state.current?.speaking) return;
    ui.showSign?.({ key: 'shut', sign: o.sign2 || signTextOf({ says: says2, key: 'shut' }) }, { flip: 'rotY' });
    audio.sfx('card');
    const flipAt = now();
    ui.showLine(says2, { who: 'cust', color: 'shut' });
    const ms = game.state.phase === 'rage' ? 0 : sayCustomer(says2);
    const t0 = clamp(now() + ms, flipAt + 250, flipAt + 1600);
    later(t0 - now(), () => { if (gen === round.arrivals && game) game.speechDone(); });
  });
}

function onResolve(e) {
  const { customer, correct, perfect, charge, scoreDelta, key } = e;
  const gen = round.arrivals;
  ui.stopSignTimer?.();
  if (round.guideActive) { ui.clearGuide(); round.guideActive = false; }
  if (e.cutIn) { cutVoice(); audio.sfx('huh'); }
  const loc = local(customer);
  ui.setSignMult?.('');
  let line;
  let isAlt = false;
  // forced politeness (too slow, gameplay-v2 3): every reply is a service line
  if (e.forced) line = pick(sys().polite) || e.line;
  else if (customer.boss) line = sys().boss?.steps?.[7]?.full || e.line;
  else if (customer.steps) line = loc.reply2 || e.line;
  else if (customer.group) line = pick(sys().group?.[key]) || e.line;
  else if (customer.id === 'change') {
    const o = sys().changeOrder || {};
    line = (e.flipped ? o[key] : key === 'gun' ? o.early : o[key]) || e.line;
  } else {
    isAlt = !!customer.alt && e.line === customer.alt && e.line !== customer.reply;
    // "今天第一个" (100 杯) only for the round's first booked order (review: it came twice in 45 s)
    if (!isAlt && correct && round.takes > 0 && /今天第一个/.test(customer.reply || '') && customer.alt) isAlt = true;
    line = (isAlt ? loc.alt : loc.reply) || e.line;
  }
  if (correct && key === 'take') round.takes += 1;
  // the line itself is kept for the stage-2 customers that are not among the 100 (boss, group, change-order)
  if (!e.forced && scoreDelta > bestLineMeta.score) bestLineMeta = { id: customer.id, alt: isAlt, score: scoreDelta, line };

  const big = e.land === 'big' || e.land === 'step';
  const style = e.forced ? 'polite' : customer.style;
  const fx = e.forced ? 'normal' : charge === 2 || e.land === 'step' ? 'mega' : big ? 'curse' : 'normal';
  // fast mouth (stage 2): only the punch half, or the key's shout when the line has no cut point
  const quick = !!e.quick && !e.forced;
  if (quick && !String(line).includes('|')) line = sys().ui?.[key] || line;
  // fast mouth: landing L = quickLandMs after every correct answer (250s and big orders too) but a full charge
  const fastLand = correct && !!(e.inQuick || e.quick) && charge < 2 && e.land !== 'step';
  const L = fastLand ? info.quickLandMs ?? 250 : e.land === 'wrong' ? info.landWrongMs : e.land === 'step' ? info.landBigMs + 300 : big ? info.landBigMs : info.landMs;

  const t = sayClerk(line, { style, fx, punchOnly: quick });
  if (quick) {
    ui.showLine(punchHalf(line), { who: 'clerk' });
    subUntil = Math.max(subUntil, now() + t.totalMs + 150);
  } else clerkLine(line, { style, voiced: t });
  if (e.forced) ui.setClerk?.('polite', t.punchStartMs + t.punchMs + 200);
  else ui.clerkBeat?.({ setupMs: t.setupMs, punchStartMs: t.punchStartMs, punchMs: t.punchMs, landMs: L, fx });
  // jab → next: presses until the punch end + 200 ms are jabs, the first one after it calls the next customer
  const punchEnd = t.punchStartMs + t.punchMs;
  // a wrong key: the right key flashes after the line (HINT_AFTER_MS), and the next sign waits for it
  const HINT_AFTER_MS = 400;
  landing = { lineEndAt: now() + punchEnd + (correct ? 0 : HINT_AFTER_MS), kind: 'answer' };
  // 5.2: the sign leaves on the press (150 ms), so the result 花字 never lands on it. v2: a wrong key also
  // flies the customer on the punch; the 4.4 hint (right key flash) comes after the line.
  ui.signExit?.(key);
  const list = !e.forced && !quick && round.tracker ? round.tracker.pick(line, { hua: loc.hua, exempt: charge === 2 || e.land === 'step', lang }) : [];
  const hz = list.length ? ui.huazi(list, { setupStartMs: 0, setupMs: t.setupMs, punchStartMs: t.punchStartMs, punchMs: t.punchMs, minAt: 150 }) : null;
  const hzEndMs = hz && Number.isFinite(hz.endMs) ? hz.endMs : 0;
  // 3: the queue jumps where the player looks: "+N" flies from the counter into the door monitor
  if (e.queueDelta > 0) later(t.punchStartMs, () => ui.queueGain?.(e.queueDelta));

  const punchAt = t.punchStartMs / 1000;
  if (correct) {
    audio.sfx('slam', { intensity: 0.6 + charge * 0.2, delay: punchAt });
    if (big) audio.sfx('boom', { delay: punchAt });
    if (charge === 2) audio.sfx('shake', { delay: punchAt });
    const is250 = customer.style === '250' || customer.cups === 250;
    if (is250) audio.sfx('cheer', { delay: punchAt + 0.1 });
    const combo = game.state.combo;
    if (combo > 0 && combo % 10 === 0) audio.sfx('cheer', { delay: punchAt + 0.15 });
    // the customer flies on the punch (the sign leaves with them)
    later(t.punchStartMs, () => { if (gen === round.arrivals) ui.customerReact?.(key); });
    round.timeoutsInRow = 0;
  } else {
    // 4.4: no "wrong" feedback on the pressed key. v2: the customer flies the pressed key's way on the punch like any
    // curse; the right key flashes after the line (not before it: that read as an answer key)
    const right = customer.steps ? customer.steps[e.step] : customer.key;
    later(t.punchStartMs, () => { if (gen === round.arrivals) ui.customerReact?.(key); });
    later(punchEnd, () => { if (gen === round.arrivals) ui.hintCorrect?.(right); });
    round.wrongByKey[right] = (round.wrongByKey[right] || 0) + 1;
    if (round.wrongByKey[right] >= 3 && !round.tipped.has(right) && round.tipsShown < 2) {
      round.tipped.add(right);
      round.pendingTip = right;
    }
    round.timeoutsInRow = 0;
  }
  if (perfect && !e.cutIn) ui.effect('perfect', {});

  // 4.1 step 8: the landing L after the punch stays silent, but the next head pops and the sign rises in its
  // tail (pace: the entrance used to start only after L), so the sign is up when L ends: arrive at
  // punch end + L − signUp. Never before the old customer has flown off (FLY_CLEAR_MS after the punch, or
  // after the wrong-key hint), the setup has ended + 80, and the punch 花字 have played and the clerk's subtitle
  // has been read by signUp (arrive only cancels 花字 that have not started; the rising sign clears its spot).
  // in fast mouth the next customer is (most likely) silent: their sign comes up sooner, nobody has to wait for the
  // clerk's subtitle to be read (no customer line replaces it), and after a punch-only answer the next head may pop
  // while this one is still flying (300 ms of the fly-out) and the punch still plays (at most 300 ms of waiting)
  const inQuick = !!(e.inQuick || e.quick) && correct;
  const signUpMs = signUpOf(inQuick);
  const flyClear = t.punchStartMs + (quick ? 300 : FLY_CLEAR_MS[key] ?? 680);
  // a wrong key: the right key's flash after the line must not land on the next sign (its colour shows at enter + 120)
  const hintClear = correct ? 0 : punchEnd + HINT_AFTER_MS - ((info.enterMs ?? 300) + 120);
  const lineWait = t.punchStartMs + t.punchMs + L - signUpMs;
  game.delayNext(Math.max(quick ? Math.min(lineWait, 300) : lineWait, flyClear, t.setupMs + 80, inQuick ? 0 : hzEndMs - signUpMs,
    inQuick ? 0 : readMs(line, t) - signUpMs, hintClear));
  if (customer.group) ui.groupHit?.(customer.group.length, key, { all: true });
  if (e.final) {
    // the boss is down: the number ticket and a gold 250
    later(t.punchStartMs, () => {
      if (gen !== round.arrivals) return;
      ui.huazi([{ text: '250', style: 'S1', seg: 'punch', ratio: 0 }]);
      audio.sfx('cheer', { delay: 0.1 });
      ui.goldsign?.(true);
      later(2500, () => ui.goldsign?.(false));
    });
  }

  // 4.4: three wrong answers on one sign type → a small strip in this landing pause (max 2 per round)
  if (round.pendingTip) {
    const k = round.pendingTip;
    round.pendingTip = null;
    round.tipsShown += 1;
    later(Math.min(400, t.punchStartMs + 200), () => ui.tip?.(tipText(k), { key: k, ms: 1200 }));
  }
}

// The boss's step (stage 2): the clerk answers the pressed key, then he says the next step's line and his sign
// turns to it. A repeat (again) is the last step asked again after a tap or another key.
function onBossStep(e) {
  const gen = round.arrivals;
  ui.stopSignTimer?.();
  if (round.guideActive) { ui.clearGuide(); round.guideActive = false; }
  if (e.cutIn) cutVoice();
  const b = sys().boss || {};
  const steps = b.steps || [];
  const prev = steps[e.prev] || {};
  let line;
  if (e.again) line = (e.tap ? steps[7]?.take : steps[7]?.[e.key]) || steps[7]?.take;
  else line = prev[e.key] || (e.prev >= 3 && e.prev <= 6 ? b.haggleWrong?.[e.key] : null) || prev.take;
  const style = e.correct ? 'deadpan' : 'cold';
  const fx = !e.correct && e.key === 'shut' && e.prev >= 3 ? 'curse' : 'normal';
  const t = sayClerk(line, { style, fx });
  clerkLine(line, { style, voiced: t });
  ui.clerkBeat?.({ setupMs: t.setupMs, punchStartMs: t.punchStartMs, punchMs: t.punchMs, landMs: 400, fx });
  if (e.queueDelta > 0) later(t.punchStartMs, () => ui.queueGain?.(e.queueDelta));
  audio.sfx(e.correct ? 'stamp' : 'slam', { delay: t.punchStartMs / 1000 });
  later(t.punchStartMs, () => { if (gen === round.arrivals) ui.customerPose?.({ cower: true }); });
  const replyEnd = t.punchStartMs + t.punchMs;
  const next = steps[e.step] || {};
  later(replyEnd + 150, () => {
    if (gen !== round.arrivals || !game || !game.state.current?.speaking) return;
    ui.customerPose?.({ cower: false });
    ui.showSign?.({ key: BOSS_KEYS[e.step], sign: next.sign }, { flip: 'rotX' });
    audio.sfx('card');
    ui.showLine(next.says, { who: 'cust', color: BOSS_KEYS[e.step] });
    const ms = sayCustomer(next.says);
    const at = now();
    const t0 = clamp(at + ms, at + 250, at + 4000);
    later(t0 - now(), () => { if (gen === round.arrivals && game) game.speechDone(); });
  });
}

// Day 4 meter (stage 2): exactly 250 = the gold-stamp scene, over = "两个月……喔，半年。" (after the clerk's reply).
function onMeter(g, { hit, over, queueDelta, meter }) {
  ui.setMeter?.(meter, { hit, over });
  shown.meter = meter;
  if (!hit && !over) return;
  const m = sys().meter || {};
  const line = pick(hit ? m.hit : m.over);
  const at = Math.max(0, clerkEndAt - now()) + 120;
  const style = hit ? '250' : 'deadpan';
  const t = clerkTiming(null, line, { punchGapMs: info.punchGapMs, punchFx: 'normal', style });
  g.delayNext(at + t.punchStartMs + t.punchMs + 250 - signUpOf(false));
  later(at, () => {
    if (game !== g || g.state.phase !== 'playing') return;
    subUntil = now();
    clerkLine(line, { style });
    sayClerk(line, { style, fx: hit ? 'mega' : 'normal' });
    if (queueDelta) ui.queueGain?.(queueDelta);
    if (hit) {
      ui.showPlate?.(m.plate || ['No.250', '250杯', '两个月后取餐']);
      ui.huazi([{ text: '250', style: 'S1', seg: 'punch', ratio: 0 }]);
      ui.goldsign?.(true);
      later(2000, () => ui.goldsign?.(false));
      audio.sfx('stamp');
      audio.sfx('cheer', { delay: 0.2 });
    } else {
      audio.sfx('scratch');
    }
  });
}

// ---- mini events (stage 2; src/events.js runs in the engine)
const evText = (type) => (sys().eventUi || {})[type] || {};
function eventSign(spec) {
  return ui.showCustomer?.({ id: spec.id, key: spec.key || 'take', cups: spec.cups ?? null, sign: spec.sign, style: '250' }, { enterMs: info.enterMs, line: false });
}
function onEventStart(g, { type, state }) {
  ui.stopSignTimer?.();
  ui.setSignMult?.('');
  landing = null;
  if (round.guideActive) { ui.clearGuide(); round.guideActive = false; }
  const tx = evText(type);
  ui.showEvent?.({ type, title: tx.title, hint: tx.hint, big: eventBig(state) });
  shown.event = eventBig(state);
  if (type === 'megaphone') {
    ui.clearCustomer?.();
    const l = pick(sys().megaphone?.passer);
    if (l) { ui.showLine(l, { who: 'cust' }); sayCustomer(l); }
    audio.sfx('feedback');
  } else if (type === 'phone') {
    ui.clearCustomer?.();
    audio.sfx('dingdong');
    const l = sys().phone?.caller;
    later(450, () => { if (game === g && g.state.event?.type === 'phone' && l) { ui.showLine(l, { who: 'cust' }); sayCustomer(l); } });
  } else if (type === 'calculator') {
    eventSign({ id: 'calc', key: 'take', sign: sys().calculator?.sign });
    const l = sys().calculator?.start;
    if (l) { clerkLine(l, { style: 'math' }); sayClerk(l, { style: 'math' }); }
  } else if (type === 'stamp') {
    eventSign({ id: 'stamp', key: 'take', sign: sys().stamp?.sign });
    const l = sys().stamp?.cust;
    if (l) { ui.showLine(l, { who: 'cust', color: 'take' }); sayCustomer(l); }
  } else if (type === 'shutter') {
    ui.clearCustomer?.();
    rageGen++;
    ui.shutter?.(true, state.leftMs);
    audio.sfx('gate');
    const l = pick(sys().shutter);
    if (l) { subUntil = now(); clerkLine(l, { style: 'deadpan' }); sayClerk(l, { style: 'deadpan' }); }
  }
}
function onEventCue(g, e) {
  const st = g.state.event;
  if (st) { const big = eventBig(st); shown.event = big; ui.updateEvent?.({ big }); }
  if (e.cue === 'hit') {
    audio.sfx('slam', { intensity: 0.6 });
    ui.shake?.(3, 60);
    if (e.type === 'megaphone' && e.n % 3 === 1) {
      const l = pick(sys().megaphone?.shout);
      if (l) { ui.showLine(l, { style: 'curse', who: 'clerk' }); audio.speak(l, { style: 'rage' }); }
    }
  } else if (e.cue === 'capped') {
    ui.shake?.(2, 40);
  } else if (e.cue === 'press') {
    audio.sfx('tap');
    ui.shake?.(3, 60);
  } else if (e.cue === 'hangup') {
    const l = pick(sys().phone?.hangup);
    cutVoice();
    if (l) { subUntil = now(); clerkLine(l, { style: 'cold' }); sayClerk(l, { style: 'cold' }); }
    audio.sfx('slam');
  } else if (e.cue === 'hold') {
    audio.sfx('drumroll', { intensity: 0.5 });
  } else if (e.cue === 'result') {
    const c = sys().calculator || {};
    const l = e.jackpot ? c.jackpot : e.value === 249 ? c.r249 : e.value === 251 ? c.r251 : e.value >= 300 ? c.r300 : c.r0;
    if (l) { subUntil = now(); clerkLine(l, { style: 'math' }); sayClerk(l, { style: e.jackpot ? '250' : 'math', fx: e.jackpot ? 'mega' : 'normal' }); }
    if (e.jackpot) {
      ui.huazi([{ text: '250', style: 'S1', seg: 'punch', ratio: 0 }]);
      audio.sfx('coin');
      audio.sfx('cheer', { delay: 0.2 });
    } else audio.sfx('scratch');
  } else if (e.cue === 'stamp') {
    audio.sfx('stamp', { intensity: 0.6 });
    const l = e.callout != null ? sys().stamp?.callouts?.[e.callout] : null;
    if (l) { ui.showLine(l, { who: 'clerk' }); sayClerk(l, { style: 'real' }); }
  } else if (e.cue === 'stampDone') {
    const l = sys().stamp?.done;
    if (l) { subUntil = now(); clerkLine(l, { style: 'real' }); sayClerk(l, { style: 'real' }); }
    audio.sfx('cheer', { delay: 0.2 });
  }
}
function onEventEnd(g, { type, result }) {
  ui.hideEvent?.();
  shown.event = null;
  if (type === 'shutter') return;
  if (result && result.cut) return;
  if (type === 'megaphone') {
    const l = sys().megaphone?.end;
    if (l) { subUntil = now(); clerkLine(l, { style: 'deadpan' }); sayClerk(l, { style: 'deadpan' }); }
  }
  if (type === 'calculator' || type === 'stamp') later(Math.max(0, clerkEndAt - now()), () => { if (game === g) ui.customerReact?.('take'); });
  // the next customer waits for the clerk's last line
  const lineLeft = Math.max(0, clerkEndAt - now());
  landing = { lineEndAt: now() + lineLeft, kind: 'event' };
  g.delayNext(lineLeft + 250);
}

function startRageScene() {
  const line = pick(sys().rageStart);
  ui.effect('rageStart', {});
  audio.sfx('rage');
  ui.showLine(line, { style: 'curse', who: 'clerk' });
  sayClerk(line, { style: 'rage' }).done.then(() => {
    if (game && game.state.phase === 'rage') rageChant();
  });
}

// 7, day 2: the aura bar slides in with S3 "气势没了＝提早打烊" (first timeout, or 30 s in, during a landing).
function showAuraIntro() {
  if (round.auraShown || !game) return;
  round.auraShown = true;
  ui.setHud?.(hudOpts());
  ui.huazi([{ text: unlockText('aura'), style: 'S3', seg: 'setup', ratio: 0 }]);
  ui.render(game.state, hudOpts());
}

// ---------------------------------------------------------------- main loop
let lastT = now();
let lastCrowd = -1;

function crowdLevel(queue) {
  // 0 people → 0.08, 10 → ~0.25, 1000 → ~0.6, 100000 → 1
  return Math.min(1, 0.08 + Math.log10(queue + 1) / 5.5);
}

// Advance the engine to `t` (dt capped so a backgrounded tab doesn't skip the round).
function syncClock(t = now()) {
  const dt = Math.min(100, Math.max(0, t - lastT));
  lastT = t;
  const ph = game ? game.state.phase : 'idle';
  if (dt > 0 && (ph === 'playing' || ph === 'rage')) game.tick(dt);
}

function frame(t) {
  syncClock(Math.max(t, lastT));
  audio.setLite?.(!!ui.lite); // K4 lite mode also trims the voice punch chain
  const before = game ? game.state.phase : 'idle';
  if (before === 'playing' || before === 'rage') {
    const st = game.state;
    if (info.showAura === 'intro' && !round.auraShown && st.phase === 'playing' && !st.current && st.elapsedMs >= 30000) showAuraIntro();
    ui.render(st, hudOpts());
    syncStage2(st);
    const lv = Math.round(crowdLevel(st.queue) * 20) / 20;
    if (lv !== lastCrowd && st.phase !== 'over') { lastCrowd = lv; audio.crowd(lv); }
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.stopSpeech();
  lastT = now();
});

// ---------------------------------------------------------------- boot
ui.setScript?.(script); // zh-TW / zh-HK / zh-MO: Traditional characters on screen
if (params.has('lite')) ui.setLite?.(params.get('lite') !== '0'); // K4 lite mode; otherwise auto-detected
if (params.has('punchfx')) audio.setVoiceFx?.(params.get('punchfx') !== '0'); // ?punchfx=0: plain spec 8.5 chain (A/B)
applyTexts();
// The UI flips its own bleep label on click; sync the persisted state once at boot.
if (bleep) root.querySelector('.tog-bleep')?.click();
ui.setHud?.(hudOpts());
showStartCard();
requestAnimationFrame(frame);

if (params.has('debug')) {
  window.__250 = {
    get game() { return game; },
    get opening() { return opening; },
    get day() { return day; },
    set day(n) { day = clampDay(n); info = dayInfo(day); },
    get info() { return info; },
    get lang() { return lang; },
    get inputs() { return inputs; }, // press outcomes this round (answer / wrong / jab / next / rage / buffered / dead …)
    get lastEval() { return lastEval; }, // stage 2: stars / rating of the last finished day
    evaluateDay, loadBest,
    script,
    audio, ui, getContent, DAYS,
    startRound,
    startDay(n) { day = clampDay(n); startRound(); },
    get durationMs() { return debugDurationMs; },
    set durationMs(ms) { debugDurationMs = Number(ms) > 0 ? Number(ms) : null; },
  };
}
