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
// Storage (all try/catch): 250cups.day (default 1, only goes up), 250cups.openingDone, 250cups.lang, 250cups.bleep.
// URL params: ?lang=zh|en  ?bleep=1  ?day=N  ?skipOpening=1  ?seed=N  ?debug (window.__250 for automated tests)
//
// Opening on day 1: the first run plays it without a skip button; once it was completed
// (250cups.openingDone = '1') a later day 1 (e.g. after quitting mid-day) replays it with "跳过 ▸" (3.1).
// ?skipOpening=1 starts day 1 free play directly (QA).

import { getContent } from './content.js';
import { createGame } from './engine.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { configForDay, poolForDay, dayInfo, clampDay, DAYS } from './days.js';
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

function local(customer) {
  if (!customer) return customer;
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
  // v2: no early close any more; the content text ('气势没了＝提早打烊') is replaced here until the stage 2 content pass
  if (which === 'aura') return zh() ? '气势没了＝被迫营业' : 'No swagger = forced politeness';
  const u = sys().unlock;
  const order = ['aura', 'rage', 'rageTip', 'charge'];
  const fb = zh()
    ? { aura: '气势没了＝提早打烊', rage: '爆气！', rageTip: '乱按都对！', charge: '狠骂！', hold: '按住＝狠骂' }
    : { aura: 'No swagger = early closing', rage: 'RAGE!', rageTip: 'Mash anything!', charge: 'HARDER!', hold: 'Hold = harder' };
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
  const [a, b] = String(line ?? '').includes('|') ? String(line).split('|') : ['', line];
  const setupMs = a ? estimateMs(a) : 0;
  const punchStartMs = setupMs ? setupMs + (opts.punchGapMs ?? 200) : 0;
  return { setupMs, punchStartMs, punchMs: estimateMs(b) };
}

/** Clerk line: setup | silence | punch. Returns { setupMs, punchStartMs, punchMs, done }. Cuts the previous line. */
function sayClerk(line, { style, fx = 'normal', gap } = {}) {
  rageGen++; // a clerk line also ends any running rage chant loop
  const opts = { punchGapMs: gap ?? info.punchGapMs, punchFx: fx, style };
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
    else if (r && r.buffered) kind = 'buffered';
    else if (r && 'land' in r) kind = r.correct ? 'answer' : 'wrong';
    else if (r && r.step != null) kind = 'step';
    else if (!r && before.phase === 'playing' && !before.current && !before.paused) kind = landingPress(key);
    inputs[kind] = (inputs[kind] || 0) + 1;
    pressOk[key] = !!r && !r.rage && r.correct && 'land' in r; // a resolved answer (not a rage hit or a first step)
    if (kind === 'answer' || kind === 'wrong' || kind === 'step' || kind === 'buffered') audio.sfx('press');
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
  ui.showStart(startTexts(), { firstRun: !openingDone, day });
}

let lastSummary = null;
let lastVerdict = '';
let lastPassed = false;
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
      queue: summary.queue, stars: lastPassed ? 1 : 0, star1: dayInfo(1).star1,
      plate: sys().opening?.plate, bestLine: bestRaw ? stripStageText(bestRaw) : '',
      bestLabel: zh() ? '今天最狠一句' : "Today's savagest line",
    }, () => beginFromCard());
    return;
  }
  if (relocalize || !lastVerdict) lastVerdict = pick(sys().closing);
  const best = local(content.customers.find((c) => c.id === summary.bestLineId));
  const line = bestLineMeta.id === summary.bestLineId && best ? (bestLineMeta.alt ? best.alt : best.reply) : best?.reply;
  // ★1 reached → the button opens the next day; otherwise this day again (7)
  const star1 = dayInfo(lastDay).star1;
  const st = sys().start || {};
  const nextLabel = st.startDay ? String(st.startDay).replace('{n}', day) : null;
  ui.showSummary(summary, { bestLine: line ? unpipe(line) : undefined, verdict: lastVerdict, star1, again: (lastPassed && day !== lastDay && nextLabel) || sys().ui.again });
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
  const special = dayInfo(n).original ? originalCustomer() : null;
  const extra = special ? { special: { customer: special, atMs: dayInfo(n).original.atMs } } : {};
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
}

// ---------------------------------------------------------------- engine events
function wire(g) {
  g.on('start', () => {
    lastSummary = null;
    lastVerdict = '';
    bestLineMeta = { id: null, alt: false, score: -Infinity };
    ui.showLine(pick(sys().next), { who: 'system' });
  });

  g.on('arrive', ({ customer }) => {
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
    ui.setSignMult?.(game && game.config.speedCutIn > 1 ? '×' + game.config.speedCutIn : ''); // ×2 while they talk
    const { signUpAt } = ui.showCustomer(loc, { enterMs: info.enterMs, line: false }) || { signUpAt: now() + info.enterMs + 280 };
    audio.sfx('pop');
    const key = customer.key;
    // 4.4: the first sign of a type today → that key breathes once
    if (!round.seenKeys.has(key)) { round.seenKeys.add(key); ui.breathKey?.(key); }
    // 4.4: two timeouts in a row → a finger for the next customer only
    if (round.guideNext) {
      round.guideNext = false;
      round.guideActive = true;
      ui.guide?.({ key, finger: true, line: true });
    }
    // 7, day 4: the first big order teaches hold-to-charge
    if (info.intro === 'charge' && !round.chargeIntroDone && key === 'take' && (customer.cups ?? 0) >= 100) {
      round.chargeIntroDone = true;
      round.guideActive = true;
      ui.guide?.({ key: 'take', dimOthers: false, glow: true, finger: true });
      ui.tip?.(unlockText('hold'), { key: 'take', ms: 1800 });
    }
    customerTalks(gen, loc, signUpAt);
  });

  g.on('ready', ({ patienceMs }) => {
    ui.startSignTimer?.(patienceMs, { steps: g.config.speedSteps });
  });

  g.on('step', (e) => onStep(e));

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
    if (g.state.phase === 'over') return;
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
    const star1 = dayInfo(finishedDay).star1;
    lastPassed = star1 == null ? true : summary.queue >= star1;
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
    // talkLeadMs (day 1): the window opens a little before the voice ends, so a prompt answer comes right after it
    const t0 = clamp(now() + ms - (info.talkLeadMs || 0), signUpAt + 250, signUpAt + 1600);
    later(t0 - now(), () => { if (gen === round.arrivals && game) game.speechDone(); });
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
  else if (customer.steps) line = loc.reply2 || e.line;
  else {
    isAlt = !!customer.alt && e.line === customer.alt && e.line !== customer.reply;
    // "今天第一个" (100 杯) only for the round's first booked order (review: it came twice in 45 s)
    if (!isAlt && correct && round.takes > 0 && /今天第一个/.test(customer.reply || '') && customer.alt) isAlt = true;
    line = (isAlt ? loc.alt : loc.reply) || e.line;
  }
  if (correct && key === 'take') round.takes += 1;
  if (!e.forced && scoreDelta > bestLineMeta.score) bestLineMeta = { id: customer.id, alt: isAlt, score: scoreDelta };

  const big = e.land === 'big' || e.land === 'step';
  const style = e.forced ? 'polite' : customer.style;
  const fx = e.forced ? 'normal' : charge === 2 || e.land === 'step' ? 'mega' : big ? 'curse' : 'normal';
  const L = e.land === 'wrong' ? info.landWrongMs : e.land === 'step' ? info.landBigMs + 300 : big ? info.landBigMs : info.landMs;

  const t = sayClerk(line, { style, fx });
  clerkLine(line, { style, voiced: t });
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
  const list = !e.forced && round.tracker ? round.tracker.pick(line, { hua: loc.hua, exempt: charge === 2 || e.land === 'step', lang }) : [];
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
  const signUpMs = (info.enterMs ?? 300) + 280;
  const flyClear = t.punchStartMs + (FLY_CLEAR_MS[key] ?? 680);
  // a wrong key: the right key's flash after the line must not land on the next sign (its colour shows at enter + 120)
  const hintClear = correct ? 0 : punchEnd + HINT_AFTER_MS - ((info.enterMs ?? 300) + 120);
  game.delayNext(Math.max(t.punchStartMs + t.punchMs + L - signUpMs, flyClear, t.setupMs + 80, hzEndMs - signUpMs,
    readMs(line, t) - signUpMs, hintClear));

  // 4.4: three wrong answers on one sign type → a small strip in this landing pause (max 2 per round)
  if (round.pendingTip) {
    const k = round.pendingTip;
    round.pendingTip = null;
    round.tipsShown += 1;
    later(Math.min(400, t.punchStartMs + 200), () => ui.tip?.(tipText(k), { key: k, ms: 1200 }));
  }
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
    script,
    audio, ui, getContent, DAYS,
    startRound,
    startDay(n) { day = clampDay(n); startRound(); },
    get durationMs() { return debugDurationMs; },
    set durationMs(ms) { debugDurationMs = Number(ms) > 0 ? Number(ms) : null; },
  };
}
