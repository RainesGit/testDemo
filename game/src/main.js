// main.js — wires content + engine + UI + audio together for 《来250杯！》/ "250 Cups!".
//
// Flow: start card → 开店 (unlocks audio) → customer arrives (bubble + voice) → player presses
// gun/shut/take → clerk line (voice + subtitle) + juice → next customer. Timeout → forced polite
// voice + boos. Fury full → rage (rapid-fire rageLines). Milestones → camera card. Over → report.
// A press resolves on key-down; holding on charges it up afterwards (game.charge). Answering the
// 250-cup customer with 收 plays the signature scene once per round (engine paused, +25 people).
//
// Speech never blocks the game: the engine runs on its own clock, every clerk line cancels the
// previous one (stopSpeech), and a customer's line is only voiced once the clerk is quiet and that
// customer is still waiting.
//
// URL params: ?lang=zh|en  ?bleep=1  ?debug (exposes window.__250 for automated tests)

import { getContent } from './content.js';
import { createGame } from './engine.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const LANG_KEY = '250cups.lang';
const BLEEP_KEY = '250cups.bleep';

function stored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function store(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode etc. */ }
}

const SIGNATURE_BONUS = 25;     // queue reward after the 250 signature scene
const SIGNATURE_LINE_MAX_MS = 4000;

const pick = (arr) => (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function initialLang() {
  const p = params.get('lang');
  if (p === 'zh' || p === 'en') return p;
  const s = stored(LANG_KEY);
  if (s === 'zh' || s === 'en') return s;
  return /^zh\b/i.test(navigator.language || 'zh') ? 'zh' : 'en';
}

let lang = initialLang();
let bleep = params.has('bleep') ? params.get('bleep') !== '0' : stored(BLEEP_KEY) === '1';
let content = getContent(lang);

// The engine only needs the language-neutral fields (id/style/key/cups are identical in zh and en);
// all displayed / spoken text is looked up by id in the current language.
// Design rule: a wrong curse is never punished, only rewarded less. The only failure is being too slow.
const game = createGame({ customers: getContent('zh').customers });
const audio = createAudio();
audio.setLang(lang);
audio.setBleep(bleep);
// Pre-rendered AI voice clips (tools/voice); lines without a clip fall back to the browser's speech synthesis.
audio.loadVoicePack('voice/manifest.json');

function local(customer) {
  if (!customer) return customer;
  return content.customers.find((c) => c.id === customer.id) || customer;
}

// ---------------------------------------------------------------- speech scheduling
let clerkGen = 0;
let clerkSpeaking = false;
let afterClerk = null; // deferred customer line
let arrivals = 0;
let rageGen = 0;

function sayClerk(text, style) {
  audio.stopSpeech();
  rageGen++; // a clerk line also ends any running rage chant loop
  afterClerk = null;
  const g = ++clerkGen;
  clerkSpeaking = true;
  return audio.speak(text, { style }).finally(() => {
    if (g !== clerkGen) return;
    clerkSpeaking = false;
    const next = afterClerk;
    afterClerk = null;
    if (next) next();
  });
}

function sayCustomer(customer) {
  const myArrival = arrivals;
  const go = () => {
    const cur = game.state.current;
    if (myArrival !== arrivals || !cur || cur.customer.id !== customer.id) return;
    if (game.state.phase !== 'playing') return;
    audio.speak(local(customer).says, { style: 'cust' });
  };
  if (clerkSpeaking) afterClerk = go;
  else { audio.stopSpeech(); go(); }
}

// Short rage lines for the level-2 charge shout (shorter half of rageLines).
function shortRageLine() {
  const lines = [...(content.system.rageLines || [])].sort((a, b) => a.length - b.length);
  return pick(lines.slice(0, Math.max(1, Math.ceil(lines.length / 2))));
}

async function rageChant() {
  const g = ++rageGen;
  const lines = content.system.rageLines || [];
  if ((!audio.canSpeak && !audio.hasVoicePack) || !audio.unlocked || !lines.length) return;
  while (g === rageGen && game.state.phase === 'rage') {
    const line = pick(content.system.rageLines);
    ui.showLine(line, { style: 'curse', who: 'clerk' });
    const t0 = performance.now();
    await audio.speak(line, { style: 'rage' });
    // Guard against engines that resolve instantly (no tight loop).
    if (performance.now() - t0 < 150) await wait(250);
  }
}

// ---------------------------------------------------------------- UI
const root = document.getElementById('app');
const pressOk = {}; // key → the press that started this hold resolved a customer (so charge may apply)
const ui = createUI(root, {
  onPress(key, holdMs) {
    if (sig.active) return;
    const r = game.press(key, holdMs);
    pressOk[key] = !!r && !r.rage && r.correct;
    ui.render(game.state);
  },
  onCharge(key, level) {
    if (sig.active || !pressOk[key]) return;
    game.charge(level);
    ui.render(game.state);
  },
  onStart() {
    audio.unlock();
    audio.setLang(lang);
    audio.setBleep(bleep);
    audio.preloadVoice();
    game.start();
    audio.sfx('slam');
    audio.crowd(0.08);
    lastCrowd = -1;
    ui.render(game.state);
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
  ui.setTexts({ ...content.system.ui, lang });
}

// Content is Simplified Chinese; override ui.js's built-in Traditional start-card defaults to match.
const START_ZH = {
  title: '来250杯！',
  subtitle: '柜台很高，态度更高。骂得越凶，排队越长。',
  hint: '按住蓄力更凶｜太慢会被迫客气，全场嘘你',
};
function startTexts() {
  return { ...(lang === 'zh' ? START_ZH : {}), start: content.system.ui.start };
}

let lastSummary = null;
let lastVerdict = '';
let bestLine = '';

function setLang(next) {
  lang = next === 'en' ? 'en' : 'zh';
  content = getContent(lang);
  audio.setLang(lang);
  audio.stopSpeech();
  if (audio.unlocked) audio.preloadVoice();
  store(LANG_KEY, lang);
  applyTexts();
  const phase = game.state.phase;
  if (phase === 'playing' || phase === 'rage') ui.relabelCustomer(local(game.state.current?.customer));
  ui.relabelMilestone();
  if (phase === 'idle') ui.showStart(startTexts());
  else if (phase === 'over' && lastSummary) showSummary(lastSummary, true);
}

function showSummary(summary, relocalize = false) {
  if (relocalize || !lastVerdict) lastVerdict = pick(content.system.closing);
  const best = local(content.customers.find((c) => c.id === summary.bestLineId));
  const line = bestLineMeta.id === summary.bestLineId && best
    ? (bestLineMeta.alt ? best.alt : best.reply)
    : best?.reply;
  bestLine = line || '';
  ui.showSummary(summary, { bestLine: bestLine || undefined, verdict: lastVerdict, again: content.system.ui.again });
}

// ---------------------------------------------------------------- 250 signature scene
// Once per round: the engine pauses, the signature250 dialogue plays line by line (clerk lines as
// subtitles, customer lines in the bubble), each voiced and awaited (max 4 s). Tap to skip.
const sig = { active: false, done: false, gen: 0, pendingRage: false, skip: null };

function lineDwell(text) {
  return Math.min(SIGNATURE_LINE_MAX_MS, 700 + String(text || '').length * 70);
}

async function playSignature(key) {
  sig.active = true;
  sig.done = true;
  sig.pendingRage = false;
  const g = ++sig.gen;
  game.pause();
  audio.stopSpeech();
  clerkGen++;
  clerkSpeaking = false;
  afterClerk = null;
  rageGen++;
  const skipped = new Promise((resolve) => { sig.skip = resolve; });
  ui.beginSignature(() => sig.skip && sig.skip());
  ui.effect('250', {});
  audio.sfx('cheer', { delay: 0.1 });
  for (let i = 0; ; i++) {
    const lines = content.system.signature250 || []; // re-read: the language may switch mid-scene
    if (g !== sig.gen || i >= lines.length) break;
    const { who, text } = lines[i];
    const isCust = who === 'cust';
    ui.showLine(text, isCust ? { who: 'cust' } : { style: 'deadpan', who: 'clerk' });
    audio.stopSpeech();
    const t0 = performance.now();
    const spoken = audio.speak(text, { style: isCust ? 'cust' : 'deadpan' }).catch(() => {});
    const r = await Promise.race([spoken.then(() => 'done'), wait(SIGNATURE_LINE_MAX_MS), skipped.then(() => 'skip')]);
    if (r === 'skip') break;
    // No voice (muted / unsupported): keep the line up long enough to read.
    const left = lineDwell(text) - (performance.now() - t0);
    if (left > 0 && (await Promise.race([wait(left), skipped.then(() => 'skip')])) === 'skip') break;
  }
  if (g === sig.gen) endSignature(key);
}

function endSignature(key) {
  sig.gen++;
  sig.skip = null;
  if (!sig.active) return;
  sig.active = false;
  audio.stopSpeech();
  ui.endSignature();
  const phase = game.state.phase;
  if (phase !== 'playing' && phase !== 'rage') return;
  game.resume();
  game.bonus(SIGNATURE_BONUS);
  ui.effect('fly', { key });
  audio.sfx('whoosh');
  audio.sfx('cheer', { delay: 0.1 });
  if (sig.pendingRage && game.state.phase === 'rage') startRageScene();
  sig.pendingRage = false;
  ui.render(game.state);
}

// ---------------------------------------------------------------- engine events
let flyTimer = 0;
let bestLineMeta = { id: null, alt: false, score: -Infinity };

game.on('start', () => {
  arrivals = 0;
  if (sig.active) { sig.gen++; sig.active = false; ui.endSignature(); }
  sig.done = false;
  sig.pendingRage = false;
  lastSummary = null;
  lastVerdict = '';
  bestLineMeta = { id: null, alt: false, score: -Infinity };
  ui.showLine(pick(content.system.next), { who: 'system' });
});

game.on('arrive', ({ customer }) => {
  arrivals++;
  ui.showCustomer(local(customer));
  audio.sfx('ding');
  sayCustomer(customer);
});

game.on('resolve', (e) => {
  const { customer, correct, perfect, charge, scoreDelta, key } = e;
  const loc = local(customer);
  const isAlt = !!customer.alt && e.line === customer.alt && e.line !== customer.reply;
  const line = (isAlt ? loc.alt : loc.reply) || e.line;
  if (scoreDelta > bestLineMeta.score) bestLineMeta = { id: customer.id, alt: isAlt, score: scoreDelta };

  if (correct && key === 'take' && customer.cups === 250 && !sig.done) {
    // Signature scene replaces the normal reply; the customer leaves when it ends.
    clearTimeout(flyTimer);
    ui.effect('hit', { charge });
    audio.sfx('pop');
    audio.sfx('slam', { intensity: 0.8 });
    playSignature(key);
    return;
  }

  ui.showLine(line, { style: customer.style, who: 'clerk' });
  sayClerk(line, customer.style);

  audio.sfx('pop');
  if (correct) {
    ui.effect('hit', { charge });
    audio.sfx('slam', { intensity: 0.6 + charge * 0.2 });
    if (charge === 2) audio.sfx('shake');
    const is250 = customer.style === '250' || customer.cups === 250;
    if (is250) {
      ui.effect('250', {});
      audio.sfx('cheer', { delay: 0.1 });
    } else if (perfect) {
      ui.effect('perfect', {});
    }
    const combo = game.state.combo;
    if (combo > 0 && combo % 10 === 0) audio.sfx('cheer', { delay: 0.15 });
  } else {
    ui.effect('miss');
  }
  // Customer gets blown out the door (or walks off with a big order on 收).
  const myArrival = arrivals;
  clearTimeout(flyTimer);
  flyTimer = setTimeout(() => {
    if (myArrival !== arrivals) return; // next customer already up — don't hide them
    ui.effect('fly', { key });
    audio.sfx('whoosh', { intensity: correct ? 1 : 0.5 });
  }, 90);
});

game.on('charge', ({ level }) => {
  ui.effect('charge', { level });
  audio.sfx('slam', { intensity: 0.8 + level * 0.15 });
  if (level >= 2) {
    audio.sfx('shake');
    const shout = shortRageLine();
    if (shout) {
      ui.showLine(shout, { style: 'curse', who: 'clerk' });
      const pending = afterClerk; // keep a waiting customer's line queued behind the shout
      sayClerk(shout, 'rage');
      afterClerk = pending;
    }
  }
});

game.on('polite', () => {
  const line = pick(content.system.polite);
  ui.showLine(line, { style: 'polite', who: 'clerk' });
  const boos = [...(content.system.boo || [])].sort(() => Math.random() - 0.5).slice(0, 3);
  ui.effect('polite', { boo: boos });
  audio.sfx('boo');
  boos.slice(0, 2).forEach((b, i) => audio.announce(b, { delay: 0.2 + i * 0.5, gainValue: 0.5 }));
  sayClerk(line, 'polite');
});

function startRageScene() {
  const line = pick(content.system.rageStart);
  ui.effect('rageStart', {});
  audio.sfx('rage');
  ui.showLine(line, { style: 'curse', who: 'clerk' });
  sayClerk(line, 'rage').then(() => {
    if (game.state.phase === 'rage') rageChant();
  });
}

game.on('rageStart', () => {
  if (sig.active) { sig.pendingRage = true; return; } // after the signature scene
  startRageScene();
});

game.on('rageHit', ({ queueDelta }) => {
  ui.effect('hit', { charge: queueDelta > 3 ? 2 : 1 });
  audio.sfx('slam', { intensity: 0.8 });
  ui.showLine(pick(content.system.rageLines), { style: 'curse', who: 'clerk' });
});

game.on('rageEnd', () => {
  rageGen++;
  ui.effect('rageEnd', {});
  if (game.state.phase === 'over') return;
  const line = pick(content.system.next);
  ui.showLine(line, { style: 'real', who: 'clerk' });
  sayClerk(line, 'real');
});

game.on('milestone', ({ level }) => {
  const text = content.system.milestones?.[level] || '';
  // Pass a getter so a queued or visible card follows a language switch (acceptance D10).
  ui.showMilestone(level, () => content.system.milestones?.[level] || '');
  audio.sfx('milestone');
  audio.announce(text, { delay: 0.25, gainValue: 0.9 });
  audio.sfx('cheer', { delay: 0.4 });
});

game.on('over', ({ summary }) => {
  clearTimeout(flyTimer);
  if (sig.active) { sig.gen++; sig.active = false; ui.endSignature(); }
  rageGen++;
  lastSummary = summary;
  ui.render(game.state);
  lastVerdict = pick(content.system.closing);
  sayClerk(lastVerdict, 'deadpan');
  audio.sfx('slam');
  audio.sfx('cheer', { delay: 0.3 });
  setTimeout(() => audio.crowd(0), 1500);
  // Let the last hit land before the report slides in.
  setTimeout(() => {
    if (game.state.phase === 'over' && lastSummary === summary) showSummary(summary);
  }, 700);
});

// ---------------------------------------------------------------- main loop
let lastT = performance.now();
let lastCrowd = -1;

function crowdLevel(queue) {
  // 0 people → 0.08, 10 → ~0.25, 1000 → ~0.6, 100000 → 1
  return Math.min(1, 0.08 + Math.log10(queue + 1) / 5.5);
}

function frame(t) {
  const dt = Math.min(100, Math.max(0, t - lastT)); // cap so a backgrounded tab doesn't skip the round
  lastT = t;
  const before = game.state.phase;
  if (before === 'playing' || before === 'rage') {
    game.tick(dt);
    const st = game.state;
    ui.render(st);
    const lv = Math.round(crowdLevel(st.queue) * 20) / 20;
    if (lv !== lastCrowd && st.phase !== 'over') { lastCrowd = lv; audio.crowd(lv); }
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.stopSpeech();
  lastT = performance.now();
});

// ---------------------------------------------------------------- boot
applyTexts();
// The UI flips its own bleep label on click; sync the persisted state once at boot.
if (bleep) root.querySelector('.tog-bleep')?.click();
ui.render(game.state);
ui.showStart(startTexts());
requestAnimationFrame(frame);

if (params.has('debug')) {
  window.__250 = { game, audio, ui, getContent, get lang() { return lang; } };
}
