// main.js — gameplay v3 shop page (shop.html): wires the pure engine (engine.js), the screen (ui.js), audio
// (../audio.js: synthesized SFX, the AI voice pack, playClerk with '|' cut points), the save (save.js) and voice
// mode (../voice.js + ../mic.js, ?input=voice: a shout at a 奧客 = 滾; the microphone is analysed on the device only).
//
// URL parameters: ?lang=zh|en  ?day=N (jump to day N, no guide)  ?reset=1 (clear the save)  ?seed=N  ?len=ms (day
// length, tools)  ?speed=K (game clock ×K, tools)  ?input=voice  ?mute=1  ?teach=0|1 (first-time 奧客 demos and the station
// hints; off by default with ?day so tools are not frozen)  ?pics=0 (drawn art only) | ?pics=<dir> (another picture set
// than art/shop/, docs/art-ai-brief.md)
// window.__shop (tools): { state, phase, save, where(name), shop }. Keys J / K / L answer the leftmost 奧客 (engine.keyTarget).
import { createShop, keyTarget, HINT_IDS } from './engine.js';
import { dayDef, MAX_DAY } from './days.js';
import { okeLine, normalLine, customerSays, okeOf, okePool, OKE } from './oke.js';
import { loadSave, writeSave, clearSave, afterDay, buyUpgrade, freshSave } from './save.js';
import { createShopUI } from './ui.js';
import { loadPics } from './pics.js';
import { getContent } from '../content.js';
import { createAudio } from '../audio.js';
import { createShoutDetector, createCalibrator } from '../voice.js';
import { createMic } from '../mic.js';

const params = new URLSearchParams(location.search);
// the pictures have to be known before the screen is built (the clerk panel is made once)
const picDir = params.get('pics');
if (picDir !== '0') await loadPics(`${picDir && /^[\w-][\w./-]*$/.test(picDir) && !picDir.includes('..') ? picDir.replace(/\/?$/, '/') : 'art/shop/'}manifest.json`);
const store = (() => { try { return window.localStorage; } catch { return null; } })();
if (params.get('reset') === '1') clearSave(store);
let save = loadSave(store);
if (params.get('day')) {
  const n = Math.max(1, Number(params.get('day')) || 1);
  save = { ...save, day: n, guideDone: true };
}
const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'zh';
let lang = params.get('lang') === 'en' || params.get('lang') === 'zh' ? params.get('lang') : (/^zh/i.test(nav) ? 'zh' : 'en');
let content = getContent(lang);
const voiceMode = params.get('input') === 'voice';
// first-time 奧客 demos (the day freezes on a new pest until the player answers it with its gesture)
const teachOn = params.get('teach') ? params.get('teach') !== '0' : !params.get('day');
const lenOverride = Number(params.get('len')) || 0;
const speed = Math.max(0.1, Number(params.get('speed')) || 1);
let seed = Number(params.get('seed')) || (Date.now() % 100000);

const audio = createAudio({});
audio.setLang(lang);
// The voice sprites download while the start card is up (its bar shows how far); Start waits for them (a few MB), at
// most START_WAIT_MS, so the first curse of the day already has its voice.
const START_WAIT_MS = 7000;
let voiceLoaded = false;
const voiceLoad = audio.loadVoicePack('voice/manifest.json')
  .then(() => audio.fetchVoiceFiles(lang, (done, total) => ui.setLoad(done / total)))
  .catch(() => {})
  .then(() => { voiceLoaded = true; ui.setLoad(1); });
let muted = params.get('mute') === '1';
if (muted) audio.setVolume(0);

let shop = null;
let phase = 'start'; // start | card | play | paused | closing | receipt | shop
let lastT = 0;
let voicedAnswer = false;
let crowdT = 0;

const pick = (arr) => (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');

const ui = createShopUI(document.getElementById('root'), {
  onTake: () => act(() => shop.takeCup()),
  onTea: (k) => act(() => shop.addTea(k)),
  onTopping: (k) => act(() => shop.addTopping(k)),
  onIce: () => act(() => shop.tapIce()),
  onSugar: () => act(() => shop.tapSugar()),
  onCook: () => act(() => shop.cook()),
  onMilk: () => act(() => shop.addMilk()),
  onFoam: () => act(() => shop.addFoam()),
  onLemon: () => act(() => { const r = shop.addLemon(); return r.ok || r.reason !== 'lemonEmpty' ? r : shop.slice(); }), // an empty tray: slice
  onSlice: () => act(() => shop.slice()),
  onShake: () => act(() => shop.shake()),
  onCookSnack: () => act(() => shop.cookSnack()),
  onSelect: (w) => act(() => shop.select(w)),
  onDrop: (ref, tgt) => act(() => {
    if (ref.bag) {
      if (tgt.type === 'seat') return shop.serveBag(tgt.slot);
      if (tgt.type === 'trash') return shop.trashBag();
      return null;
    }
    if (ref.snack) {
      if (tgt.type === 'seat') return shop.serveSnack(tgt.slot);
      if (tgt.type === 'trash') return shop.trashSnack();
      return null;
    }
    if (ref.shelf != null) {
      if (tgt.type === 'trash') return shop.trashShelf(ref.shelf);
      if (tgt.type === 'seat') return shop.serveShelf(ref.shelf, tgt.slot);
      if (tgt.type === 'bag') return shop.pack({ shelf: ref.shelf });
      return null;
    }
    const w = ref.w;
    if (tgt.type === 'sealer') return shop.seal(w);
    if (tgt.type === 'shelf') return shop.seal(w, { toShelf: true });
    if (tgt.type === 'shaker') return shop.shake(w);
    if (tgt.type === 'bag') return shop.pack({ w });
    if (tgt.type === 'trash') return shop.trash(w);
    if (tgt.type === 'seat') return shop.serve(w, tgt.slot);
    return null;
  }),
  // keyboard J / K / L = 滾 / 閉嘴 / 收 on the leftmost unanswered 奧客 at the counter (else the leftmost customer)
  onKey: (key) => act(() => { const slot = shop.state.teach ? shop.state.teach.slot : keyTarget(shop.state); return slot >= 0 ? shop.answer(slot, key) : null; }, true),
  onAnswer: (slot, key) => act(() => shop.answer(slot, key), true),
  onPause: () => pause(),
  onToggleLang: () => { setLang(lang === 'zh' ? 'en' : 'zh'); showStart(); },
  onFirstInput: () => audio.unlock(),
});
ui.setLang(lang);

function act(fn, answering = false) {
  if (!shop || phase !== 'play') return;
  if (shop.state.teach && !answering) return; // while a new 奧客 is being taught, only answering it does anything
  fn();
  pump();
}

function setLang(l) {
  lang = l;
  content = getContent(lang);
  ui.setLang(lang);
  audio.setLang(lang);
  audio.fetchVoiceFiles(lang);
}

// ---- the clerk's voice: heard, and right away ----
// Cursing fast used to cut every line after a syllable; making every curse wait for the line before it made the voice
// lag behind the kick. Now a curse that comes while the clerk is still talking waits only if the line ends within
// CLERK_MAX_WAIT_MS, then plays its hit (the half after '|'); otherwise it cuts the line and plays its hit at once. Only
// the newest waiting line is kept (dropped ones take their subtitles with them: the screen shows what is heard).
// Customers do not talk over the clerk.
const CLERK_GAP_MS = 90;
const CLERK_MAX_WAIT_MS = 600;
let clerkFreeAt = 0;
let clerkWaiting = null;
const clerkTalking = () => performance.now() < clerkFreeAt;
// How a curse line will be voiced if asked for now (pure look-ahead, used for the kick's timing and by clerkSay):
//   { wait, punchOnly, hitMs }  wait: ms until it starts; punchOnly: only the hit half plays; hitMs: ms from now until
//   the hit (the half after '|') lands, or 0 when the voice cannot be on time (its sprites are not decoded yet).
// A line whose set-up half is longer than HIT_HOLD_MAX_MS plays its hit only, so the kick never waits long.
const HIT_HOLD_MAX_MS = 950;
function clerkPlan(line, opts = {}) {
  const w = clerkFreeAt - performance.now();
  const busy = w > 0;
  const wait = busy && w <= CLERK_MAX_WAIT_MS ? w : 0;
  const t = audio.voiceTimings(line, opts);
  const punchOnly = busy || t.punchStartMs > HIT_HOLD_MAX_MS;
  const lead = punchOnly ? audio.voiceTimings(line, { ...opts, punchOnly: true }).punchStartMs : t.punchStartMs;
  return { wait, punchOnly, hitMs: audio.unlocked && !muted && audio.lineReady(line) ? Math.min(HIT_HOLD_MAX_MS, wait + lead) : 0 };
}
function clerkSay(line, key, opts = {}, { voice = true, plan = null } = {}) {
  const go = (o) => {
    ui.say(line, 'clerk', key);
    if (!voice) return;
    const p = audio.playClerk(line, o);
    clerkFreeAt = performance.now() + (p.totalMs || 0) + CLERK_GAP_MS;
  };
  if (!voice) { go(opts); return; }
  const pl = plan || clerkPlan(line, opts);
  if (clerkWaiting) clearTimeout(clerkWaiting);
  clerkWaiting = null;
  const o = pl.punchOnly ? { ...opts, punchOnly: true } : opts;
  if (pl.wait <= 0) { go(o); return; } // playClerk cuts a line that is still playing
  clerkFreeAt = Math.max(clerkFreeAt, performance.now() + pl.wait); // the slot is taken: the next curse plans after it
  clerkWaiting = setTimeout(() => { clerkWaiting = null; go(o); }, pl.wait);
}
function clerkHush() {
  if (clerkWaiting) clearTimeout(clerkWaiting);
  clerkWaiting = null;
  clerkFreeAt = 0;
}

// ---- audio + subtitles per event ----
let kickPlan = null; // the plan made when a 滾 sends someone flying, used by the 'answer' that follows in the same batch
const curseLine = (ev) => (ev.cust && ev.cust.kind === 'oke' && !ev.normal ? okeLine(ev.cust.oke, 'gun', content) : normalLine(ev.cust.cid, content));
function handle(ev) {
  const s = shop.state;
  // 滾: the customer flies when the clerk's hit lands, not before it (they brace, wide-eyed, through the set-up half)
  if (ev.type === 'leave' && ev.reason === 'gun' && ev.cust) {
    kickPlan = voicedAnswer ? null : clerkPlan(curseLine(ev), { punchFx: 'curse' });
    ui.onEvent(ev, { lang, hitMs: kickPlan ? kickPlan.hitMs : 0 });
  } else ui.onEvent(ev, { lang });
  switch (ev.type) {
    case 'arrive':
      // decode now what the clerk may answer, so the voice comes with the kick (not after a sprite download)
      if (ev.cust.kind === 'oke') for (const k of ['gun', 'shut', 'take']) audio.prefetchLine(okeLine(ev.cust.oke, k, content));
      else audio.prefetchLine(normalLine(ev.cust.cid, content));
      if (ev.cust.kind === 'oke') {
        const says = customerSays(ev.cust.cid, content);
        if (!clerkTalking()) { ui.say(says, 'cust', okeOf(ev.cust.oke).best); audio.playCustomer(says, { rate: 1.05 }); }
        audio.sfx('dingdong');
      } else audio.sfx('pop');
      break;
    case 'nag': {
      if (clerkTalking()) break;
      const says = customerSays(ev.cust.cid, content);
      ui.say(says, 'cust', okeOf(ev.cust.oke).best);
      audio.playCustomer(says, { rate: 1.12 });
      break;
    }
    case 'answer': {
      const line = ev.oke ? okeLine(ev.oke, ev.key, content) : normalLine(ev.cid, content);
      // the fly-off sounds sit under the voice: softer while the clerk is still talking
      const quiet = clerkTalking() ? 0.6 : 1;
      clerkSay(line, ev.key, { punchFx: 'curse', maxLateMs: 900 }, { voice: !voicedAnswer, plan: ev.key === 'gun' ? kickPlan : null }); // late = silent, never behind the kick
      kickPlan = null;
      voicedAnswer = false;
      if (ev.key === 'gun') { audio.sfx('whoosh', { duration: 0.2, intensity: 0.9 * quiet }); audio.sfx('boom', { intensity: 0.5 * quiet * quiet, delay: 0.05 }); }
      if (ev.key === 'shut') audio.sfx('slap', { intensity: 0.8 });
      if (ev.key === 'take') { audio.sfx('stamp'); if (ev.prepay) audio.sfx('coin', { delay: 0.2 }); }
      if (ev.best) audio.sfx('cheer', { delay: 0.25 });
      break;
    }
    case 'serveBag': audio.sfx('slap', { intensity: 0.5 }); break;
    case 'serveSnack': if (!ev.done) audio.sfx('ding', { intensity: 0.5 }); break;
    case 'serve':
      if (ev.bag) break;
      if (!ev.correct) audio.sfx('huh');
      else if (!ev.done) audio.sfx('ding', { intensity: 0.5 });
      if (ev.correct && ev.golden) { const line = content.system.opening && content.system.opening.r4b; if (line) clerkSay(line, 'take'); }
      break;
    case 'pay': audio.sfx('coin'); if (ev.tip > 0) audio.sfx('ding', { delay: 0.12 }); break;
    case 'fans': if (ev.why === 'star') audio.sfx('cheer', { delay: 0.1 }); break;
    case 'helperCup': audio.sfx('slap', { intensity: 0.35 }); break;
    case 'refuse': {
      const says = customerSays(ev.cust.cid, content);
      ui.say(says, 'cust', okeOf(ev.cust.oke).best);
      audio.sfx('huh');
      break;
    }
    case 'leave': if (ev.reason === 'timeout') audio.sfx('sigh'); break;
    case 'cup': audio.sfx('tap', { intensity: 0.5 }); break;
    case 'tea': audio.sfx('whoosh', { duration: 0.5, intensity: 0.25 }); break;
    case 'topping': audio.sfx('pop'); break;
    case 'ice': audio.sfx('ding', { intensity: 0.4 }); break;
    case 'sugar': audio.sfx('press'); break;
    case 'sealStart': audio.sfx('press'); break;
    case 'sealed': audio.sfx('slap', { intensity: 0.45 }); break;
    case 'trash': audio.sfx('scratch'); break;
    case 'cookStart': audio.sfx('tick'); break;
    case 'milk': audio.sfx('whoosh', { duration: 0.4, intensity: 0.2 }); break;
    case 'foam': audio.sfx('whoosh', { duration: 0.5, intensity: 0.18 }); break;
    case 'lemon': audio.sfx('pop'); break;
    case 'sliceStart': audio.sfx('scratch', { intensity: 0.5 }); break;
    case 'sliced': audio.sfx('ding', { intensity: 0.35 }); break;
    case 'shakeStart': audio.sfx('scratch', { intensity: 0.35 }); break;
    case 'shaken': audio.sfx('tap', { intensity: 0.6 }); break;
    case 'snackStart': audio.sfx('press'); break;
    case 'snackReady': audio.sfx('bell'); break;
    case 'pack': audio.sfx('tap', { intensity: 0.55 }); break;
    case 'hint': ui.hint(ev, s); break;
    case 'hintDone': ui.hint(null); if (ev.why !== 'gone' && ev.why !== 'close') { save = { ...save, hinted: [...new Set([...(save.hinted || []), ev.id])] }; writeSave(store, save); } break;
    case 'cooked': audio.sfx('bell'); break;
    case 'potEmpty': audio.sfx('tick', { intensity: 0.6 }); break;
    case 'nope': audio.sfx('tap', { intensity: 0.25 }); break;
    case 'star': audio.sfx('milestone'); audio.sfx('cheer', { delay: 0.2 }); break;
    case 'guide': ui.guide(ev.step, s); break;
    case 'guideDone': ui.guide(null); save = { ...save, guideDone: true, taught: [...new Set([...(save.taught || []), 'one'])] }; writeSave(store, save); break;
    case 'teach': ui.teach(ev); audio.sfx('dingdong'); break;
    case 'teachDone': ui.teach(null); save = { ...save, taught: [...new Set([...(save.taught || []), ev.oke])] }; writeSave(store, save); break;
    case 'close': onClose(ev.summary); break;
    default: break;
  }
}

function pump() {
  if (!shop) return;
  for (const ev of shop.drain()) handle(ev);
}

function frame(now) {
  const dt = Math.min(100, now - (lastT || now));
  lastT = now;
  if (shop && phase === 'play') {
    shop.tick(dt * speed);
    pump();
    crowdT -= dt;
    if (crowdT <= 0) { crowdT = 1000; audio.crowd(Math.min(0.6, 0.08 + shop.state.queue.length * 0.04)); }
  }
  if (shop) ui.render(shop.state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- days ----
function beginDay(n) {
  // decode what today's 奧客 can be answered with while the day card is up
  for (const t of okePool(n)) for (const k of ['gun', 'shut', 'take']) audio.prefetchLine(okeLine(t, k, content));
  const def = { ...dayDef(n) };
  if (lenOverride) {
    const k = lenOverride / def.lengthMs;
    def.lengthMs = lenOverride;
    def.script = (def.script || []).map((x) => ({ ...x, at: Math.min(x.at, Math.max(2000, x.at * k)) }));
  }
  seed += 1;
  const guide = n === 1 && !save.guideDone;
  const taught = new Set([...(save.taught || []), ...(guide ? ['one'] : [])]); // the day 1 guide teaches 一杯就好 itself
  const teach = teachOn ? OKE.map((o) => o.type).filter((t) => !taught.has(t)) : [];
  const hinted = new Set(save.hinted || []);
  const hints = teachOn ? HINT_IDS.filter((h) => !hinted.has(h)) : [];
  shop = createShop({ day: n, fame: save.fame, upgrades: save.upgrades, seed, guide, teach, hints, def });
  ui.build(shop);
  ui.render(shop.state);
  phase = 'card';
  ui.dayCard(def, { cfg: shop.cfg }, () => {
    audio.unlock();
    audio.sfx('card');
    phase = 'play';
    lastT = 0;
    pump();
  });
}

function onClose(sum) {
  phase = 'closing';
  ui.guide(null);
  ui.teach(null);
  ui.hint(null);
  const line = pick(content.system.closing);
  clerkHush(); // the shutter line always plays, right away
  clerkSay(line, 'take');
  audio.sfx('gate');
  save = afterDay(save, sum);
  writeSave(store, save);
  setTimeout(() => {
    phase = 'receipt';
    ui.receipt(sum, { wallet: save.wallet }, () => openShop(sum));
  }, 1400);
}

function openShop(sum) {
  phase = 'shop';
  const next = sum.met ? sum.day + 1 : sum.day;
  ui.upgradeShop(save, { nextDay: next, retry: !sum.met }, (id) => {
    const r = buyUpgrade(save, id);
    if (r.ok) { save = r.save; writeSave(store, save); audio.sfx('coin'); audio.sfx('sparkle', { delay: 0.1 }); }
    return r;
  }, () => {
    if (sum.met && sum.day === MAX_DAY) ui.endCard(() => beginDay(next));
    else beginDay(next);
  });
}

function pause() {
  if (phase !== 'play') return;
  phase = 'paused';
  ui.pauseSheet({ muted }, {
    resume: () => { phase = 'play'; lastT = 0; },
    lang: () => { setLang(lang === 'zh' ? 'en' : 'zh'); phase = 'play'; pause(); },
    mute: () => { muted = !muted; audio.setVolume(muted ? 0 : 0.85); phase = 'play'; pause(); },
    close: () => { phase = 'play'; shop.close(); pump(); },
    restart: () => { clearSave(store); save = freshSave(); beginDay(1); },
  });
}

// ---- voice mode (吼罵模式): a shout at a 奧客 = 滾 ----
let mic = null;
function startVoice() {
  const det = createShoutDetector({ floor: -60 });
  const cal = createCalibrator();
  let calibrated = false;
  let coolUntil = 0;
  mic = createMic({
    getContext: () => audio.context,
    onFrame: (db, t) => {
      if (!calibrated) { cal.feed(db); if (cal.frames >= 40) { det.setFloor(cal.floor()); calibrated = true; } return; }
      for (const e of det.feed(db, t)) {
        if (e.type === 'rise' && e.level >= 1 && t >= coolUntil && shop && phase === 'play') {
          const slot = shop.state.slots.findIndex((c) => c && c.kind === 'oke' && !c.converted);
          if (slot >= 0) { coolUntil = t + 700; voicedAnswer = true; act(() => shop.answer(slot, 'gun')); voicedAnswer = false; }
        }
      }
    },
  });
  return mic.start();
}

function showStart() {
  phase = 'start';
  let going = false;
  // unlock inside the tap, then wait for the voice (not when muted), then go
  const ready = (fn) => () => {
    if (going) return;
    going = true;
    audio.unlock();
    if (voiceLoaded || muted) { fn(); return; }
    ui.setLoad(null, true);
    Promise.race([voiceLoad, new Promise((r) => setTimeout(r, START_WAIT_MS))]).then(fn);
  };
  ui.startCard({ day: save.day, hasSave: save.day > 1 || save.wallet > 0, voice: voiceMode }, ready(() => {
    if (voiceMode) ui.voicePrompt(() => { startVoice().then(() => beginDay(save.day)); }, () => beginDay(save.day));
    else beginDay(save.day);
  }), ready(() => { clearSave(store); save = freshSave(); beginDay(1); }));
  if (voiceLoaded) ui.setLoad(1);
}
showStart();

window.__shop = {
  get state() { return shop && shop.state; },
  get phase() { return phase; },
  get save() { return save; },
  get lang() { return lang; },
  where: (name) => ui.where(name),
  get shop() { return shop; },
};
