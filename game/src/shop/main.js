// main.js — gameplay v3 shop page (shop.html): wires the pure engine (engine.js), the screen (ui.js), audio
// (../audio.js: synthesized SFX, the AI voice pack, playClerk with '|' cut points), the save (save.js) and voice
// mode (../voice.js + ../mic.js, ?input=voice: a shout at a 奧客 = 滾; the microphone is analysed on the device only).
//
// URL parameters: ?lang=zh|en  ?day=N (jump to day N, no guide)  ?reset=1 (clear the save)  ?seed=N  ?len=ms (day
// length, tools)  ?speed=K (game clock ×K, tools)  ?input=voice  ?mute=1
// window.__shop (tools): { state, phase, save, where(name), shop }. Keys J / K / L answer the leftmost 奧客 (engine.keyTarget).
import { createShop, keyTarget } from './engine.js';
import { dayDef, MAX_DAY } from './days.js';
import { okeLine, normalLine, customerSays, okeOf } from './oke.js';
import { loadSave, writeSave, clearSave, afterDay, buyUpgrade, freshSave } from './save.js';
import { createShopUI } from './ui.js';
import { getContent } from '../content.js';
import { createAudio } from '../audio.js';
import { createShoutDetector, createCalibrator } from '../voice.js';
import { createMic } from '../mic.js';

const params = new URLSearchParams(location.search);
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
const lenOverride = Number(params.get('len')) || 0;
const speed = Math.max(0.1, Number(params.get('speed')) || 1);
let seed = Number(params.get('seed')) || (Date.now() % 100000);

const audio = createAudio({});
audio.setLang(lang);
audio.loadVoicePack('voice/manifest.json');
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
  onSelect: (w) => act(() => shop.select(w)),
  onDrop: (ref, tgt) => act(() => {
    if (ref.shelf != null) {
      if (tgt.type === 'trash') return shop.trashShelf(ref.shelf);
      if (tgt.type === 'seat') return shop.serveShelf(ref.shelf, tgt.slot);
      return null;
    }
    const w = ref.w;
    if (tgt.type === 'sealer') return shop.seal(w);
    if (tgt.type === 'shelf') return shop.seal(w, { toShelf: true });
    if (tgt.type === 'trash') return shop.trash(w);
    if (tgt.type === 'seat') return shop.serve(w, tgt.slot);
    return null;
  }),
  // keyboard J / K / L = 滾 / 閉嘴 / 收 on the leftmost unanswered 奧客 at the counter (else the leftmost customer)
  onKey: (key) => act(() => { const slot = keyTarget(shop.state); return slot >= 0 ? shop.answer(slot, key) : null; }),
  onAnswer: (slot, key) => act(() => shop.answer(slot, key)),
  onPause: () => pause(),
  onToggleLang: () => { setLang(lang === 'zh' ? 'en' : 'zh'); showStart(); },
  onFirstInput: () => audio.unlock(),
});
ui.setLang(lang);

function act(fn) {
  if (!shop || phase !== 'play') return;
  fn();
  pump();
}

function setLang(l) {
  lang = l;
  content = getContent(lang);
  ui.setLang(lang);
  audio.setLang(lang);
}

// ---- audio + subtitles per event ----
function handle(ev) {
  const s = shop.state;
  ui.onEvent(ev, { lang });
  switch (ev.type) {
    case 'arrive':
      if (ev.cust.kind === 'oke') {
        const says = customerSays(ev.cust.cid, content);
        ui.say(says, 'cust', okeOf(ev.cust.oke).best);
        audio.playCustomer(says, { rate: 1.05 });
        audio.sfx('dingdong');
      } else audio.sfx('pop');
      break;
    case 'nag': {
      const says = customerSays(ev.cust.cid, content);
      ui.say(says, 'cust', okeOf(ev.cust.oke).best);
      audio.playCustomer(says, { rate: 1.12 });
      break;
    }
    case 'answer': {
      const line = ev.oke ? okeLine(ev.oke, ev.key, content) : normalLine(ev.cid, content);
      ui.say(line, 'clerk', ev.key);
      if (!voicedAnswer) audio.playClerk(line, { punchFx: 'curse' });
      voicedAnswer = false;
      if (ev.key === 'gun') { audio.sfx('whoosh', { duration: 0.2, intensity: 0.9 }); audio.sfx('boom', { intensity: 0.5, delay: 0.05 }); }
      if (ev.key === 'shut') audio.sfx('slap', { intensity: 0.8 });
      if (ev.key === 'take') { audio.sfx('stamp'); if (ev.prepay) audio.sfx('coin', { delay: 0.2 }); }
      if (ev.best) audio.sfx('cheer', { delay: 0.25 });
      break;
    }
    case 'serve':
      if (!ev.correct) audio.sfx('huh');
      else if (!ev.done) audio.sfx('ding', { intensity: 0.5 });
      if (ev.correct && ev.golden) { const line = content.system.opening && content.system.opening.r4b; if (line) { ui.say(line, 'clerk', 'take'); audio.playClerk(line, {}); } }
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
    case 'cooked': audio.sfx('bell'); break;
    case 'potEmpty': audio.sfx('tick', { intensity: 0.6 }); break;
    case 'nope': audio.sfx('tap', { intensity: 0.25 }); break;
    case 'star': audio.sfx('milestone'); audio.sfx('cheer', { delay: 0.2 }); break;
    case 'guide': ui.guide(ev.step, s); break;
    case 'guideDone': ui.guide(null); save = { ...save, guideDone: true }; writeSave(store, save); break;
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
  const def = { ...dayDef(n) };
  if (lenOverride) {
    const k = lenOverride / def.lengthMs;
    def.lengthMs = lenOverride;
    def.script = (def.script || []).map((x) => ({ ...x, at: Math.min(x.at, Math.max(2000, x.at * k)) }));
  }
  seed += 1;
  shop = createShop({ day: n, fame: save.fame, upgrades: save.upgrades, seed, guide: n === 1 && !save.guideDone, def });
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
  const line = pick(content.system.closing);
  ui.say(line, 'clerk', 'take');
  audio.playClerk(line, {});
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
  ui.startCard({ day: save.day, hasSave: save.day > 1 || save.wallet > 0, voice: voiceMode }, () => {
    audio.unlock();
    if (voiceMode) ui.voicePrompt(() => { startVoice().then(() => beginDay(save.day)); }, () => beginDay(save.day));
    else beginDay(save.day);
  }, () => { clearSave(store); save = freshSave(); beginDay(1); });
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
