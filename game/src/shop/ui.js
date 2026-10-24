// ui.js — gameplay v3 shop screen, landscape (docs/gameplay-v3-shop.md 10): a 16:9 stage (design 1280×720, layout.js),
// the camera behind the counter looking out. Top: the night street (traffic and passers-by on the far side), customers
// walking in from the far corner, the line, the counter spots (order bubbles with the patience bar, gestures). Bottom:
// the work table with a fixed spot for every station (art-shop.js; spots not owned yet are covered and locked), the
// prep mat, the shelf, the cup tower, the part-timer. DOM rendering, pointer input (taps on stations, cup drags, gestures
// on customers through src/gesture.js, J/K/L keys), juice (pour streams, topping arcs, the sealer press, coins to the
// HUD), the day 1 finger guide, cards (start, day, receipt, upgrade shop, pause, voice prompt, rotate-your-phone).
// Layout and look: shop.css. No game rules here: main.js owns the engine and calls render(state) every frame and
// onEvent(ev) per event.
//
//   createShopUI(root, handlers) → ui
//     handlers: onTake(), onTea(kind), onTopping(kind), onIce(), onSugar(), onCook(), onSelect(w),
//               onDrop(ref, { type: 'sealer'|'shelf'|'seat'|'trash'|null, slot }), ref = { w } | { shelf },
//               onAnswer(slot, key, info), onKey(key), onPause(), onFirstInput(), onToggleLang()
//     ui.build(shop)            stations, locked spots, slots, shelf, seats and the upgrade props for today
//     ui.render(state)          per frame: HUD (money ticks up as coins land), walkers (interpolated from the engine's
//                               street positions), bubbles, patience bars, cups, sealers, pot, helper, cup tower, traffic
//     ui.onEvent(ev, ctx)       visuals of one engine event
//     ui.say(text, who, key)    a subtitle on the counter lip (clerk lines get the '|' punch half big in the key colour)
//     ui.guide(step, state)     the finger demo for a guide step (null hides it)
//     ui.teach(ev | null)       a first-time 奧客: spotlight on it + a finger demo of its best gesture (hold / swipe / 3 taps)
//     ui.dayCard / receipt / upgradeShop / startCard / pauseSheet / voicePrompt / endCard  (cards; resolve via callbacks)
//     ui.where(name)            viewport centre of a part (tools): 'rack' | 'tea-<k>' | 'top-<k>' | 'sealer' | 'sealer-1' |
//                               'shelfArea' | 'trash' | 'pot' | 'ice' | 'sugar' | 'cup-<w>' | 'shelf-<i>' | 'seat-<i>'
import {
  cupSVG, teaTankSVG, toppingTraySVG, iceBinSVG, syrupSVG, sealerSVG, potSVG, cupRackSVG, trashSVG, workSlotSVG,
  coinSVG, tableSVG, shelfSVG, itemsBubbleSVG, teaManifoldSVG, iceDispenserSVG, potRigSVG,
  goldenCardSVG, counterLipSVG, lockedSVG, lockBadgeSVG, patienceColor, TEA_COLORS,
} from './art-shop.js';
import { streetSVG, cornerSVG, awningSVG, walkerSVG, helperSVG, acSVG, speakerSVG, ticketMachineSVG, rotateIconSVG, vehicleSVG, pedSVG, roadLane, farWalk } from './art-street.js';
import { customerSVG, FINGER_SVG, CLERK_SVG, logoSVG, cupStackSVG, MEGAPHONE_SVG } from '../art.js';
import { createRecognizer } from '../gesture.js';
import { okeBubbleSVG, STAMP_SVG, starRowSVG } from './oke-art.js';
import { okeOf } from './oke.js';
import { STATIONS, TABS, levelOf, nextLevel, canBuy } from './upgrades.js';
import { shopText, fmt } from './text.js';
import {
  STAGE, LIP_Y, PERSON, PILLAR, BUBBLE, DECOR, streetPoint, lineU, seatPoint, seatColumn, stepPoint, bubbleWidth,
  stations as stationRects, lockedSpots,
} from './layout.js';

const TOP_ORDER = ['pearl', 'pudding', 'grass', 'coconut'];
const KEY_COLOR = { gun: 'var(--gun)', shut: 'var(--shut)', take: 'var(--lemon)' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const stripDir = (s) => String(s ?? '').replace(/（[^（）]*）/g, '').replace(/\([^()]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
const money = (n) => Math.round(n).toLocaleString('en-US');
const cq = (v) => `${(v * 100 / STAGE.w).toFixed(3)}cqw`; // design px → container units
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
// the cup tower at a fixed cup size: its svg is as wide as its bottom row (art.js cupStackSVG, at most 5 cups = 89 units)
const towerHTML = (n) => { const k = clamp(Math.floor(n), 0, 9); const w = Math.max(1, Math.ceil(k / 2)) * 17 + 4; return cupStackSVG(k).replace('<svg ', `<svg style="width:${((w / 89) * 92).toFixed(1)}%" `); };

// small UI icons (cards and HUD chrome; no words)
const ICON = {
  cal: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="7" width="32" height="29" rx="5" fill="#FFF7E6" stroke="#1B1311" stroke-width="3"/><path d="M4 12 Q4 7 9 7 H31 Q36 7 36 12 V16 H4 Z" fill="#EE4130" stroke="#1B1311" stroke-width="3" stroke-linejoin="round"/><path d="M12 3 V11 M28 3 V11" stroke="#1B1311" stroke-width="3.4" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="21" r="16" class="ht-bg"/><circle cx="20" cy="21" r="12.5" class="ht-arc" pathLength="100" stroke-dasharray="100 100" transform="rotate(-90 20 21)"/><path class="ht-hand" d="M20 21 V12" stroke-linecap="round"/><circle cx="20" cy="21" r="2.4" fill="#1B1311"/><path d="M14 3.4 H26" stroke="#1B1311" stroke-width="3.4" stroke-linecap="round"/></svg>',
  flag: '<svg viewBox="0 0 20 24" aria-hidden="true"><path d="M3 2 V23" stroke="#1B1311" stroke-width="2.6" stroke-linecap="round"/><path d="M4 3 H17 L13 8 L17 13 H4 Z" fill="#EE4130" stroke="#1B1311" stroke-width="2" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" fill="#1B1311" stroke="#1B1311" stroke-width="2" stroke-linejoin="round"/></svg>',
  resume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M3 12 H21 M12 3 Q6 12 12 21 Q18 12 12 3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9 H7 L12 5 V19 L7 15 H3 Z" fill="currentColor"/><path d="M15 9 Q17 12 15 15 M18 6 Q22 12 18 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9 H7 L12 5 V19 L7 15 H3 Z" fill="currentColor"/><path d="M16 9 L22 15 M22 9 L16 15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  shutter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4 H21 V20 H3 Z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3 8 H21 M3 12 H21 M3 16 H21" stroke="currentColor" stroke-width="1.8"/></svg>',
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 A7 7 0 1 0 8 6.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4 3 V8 H9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mic: '<svg viewBox="0 0 60 90" aria-hidden="true"><rect x="16" y="4" width="28" height="50" rx="14" fill="#BCC3CE" stroke="#1B1311" stroke-width="4"/><path d="M22 18 H38 M22 28 H38 M22 38 H38" stroke="#737C8C" stroke-width="3" stroke-linecap="round"/><path d="M8 40 Q8 66 30 66 Q52 66 52 40" fill="none" stroke="#1B1311" stroke-width="4" stroke-linecap="round"/><path d="M30 66 V82 M18 84 H42" stroke="#1B1311" stroke-width="4" stroke-linecap="round"/><path d="M20 10 Q19 20 20 30" stroke="#F2F4F7" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 L10 17 L19 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M2 8 H18 M13 3 L19 8 L13 13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// the three answer gestures as pictures (day card badges): swipe = 滾, three taps = 閉嘴, hold = 收
const GESTURE = {
  gun: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 26 Q18 12 32 10" fill="none" stroke="#FFF7E6" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="2 5"/><path d="M26 5 L34 9 L28 16" fill="none" stroke="#FFF7E6" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="28" r="5" fill="#FFF7E6"/></svg>',
  shut: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="5" fill="#FFF7E6"/><circle cx="20" cy="20" r="10" fill="none" stroke="#FFF7E6" stroke-width="2.4" opacity=".75"/><circle cx="20" cy="20" r="15.5" fill="none" stroke="#FFF7E6" stroke-width="2.2" opacity=".45"/></svg>',
  take: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="rgb(255 247 230 / .3)" stroke-width="4"/><path d="M20 6 A14 14 0 1 1 6.7 24.3" fill="none" stroke="#FFD84A" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="20" r="6" fill="#FFF7E6"/></svg>',
};

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function place(e, r, h) {
  e.style.left = cq(r.x);
  e.style.top = cq(r.y);
  e.style.width = cq(r.w);
  if (h != null) e.style.height = cq(h);
  return e;
}
const restart = (e, cls) => { if (!e) return; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };

export function createShopUI(root, h = {}) {
  const call = (k, ...a) => { try { return h[k] && h[k](...a); } catch (e) { console.error('[shop ui]', e); return undefined; } };
  let lang = 'zh';
  let T = shopText(lang);

  // ---- skeleton ----
  root.innerHTML = '';
  const app = el('div', 'app');
  const frame = el('div', 'frame');
  const stage = el('div', 'stage');
  stage.id = 'stage';
  app.append(frame);
  frame.append(stage);
  root.append(app);
  const shaker = el('div', 'shaker');
  stage.append(shaker);
  const street = el('div', 'street');
  const traffic = el('div', 'traffic');
  const walkersEl = el('div', 'walkers');
  const corner = el('div', 'corner', cornerSVG());
  const awning = el('div', 'awning', awningSVG());
  const pillar = el('div', 'pillar');
  place(pillar, PILLAR, PILLAR.h);
  const seatsEl = el('div', 'seats');
  const counter = el('div', 'counter');
  counter.innerHTML = `<div class="lip">${counterLipSVG()}</div><div class="table">${tableSVG()}</div>`;
  const cupsEl = el('div', 'cups');
  shaker.append(street, traffic, walkersEl, corner, awning, pillar, seatsEl, counter);
  counter.append(cupsEl);
  const fx = el('div', 'fx');
  const clerkCut = el('div', 'clerk-cut', `<div class="cc-burst"></div><div class="cc-clerk">${CLERK_SVG}</div>`);
  const subs = el('div', 'subs');
  const finger = el('div', 'finger', FINGER_SVG);
  finger.hidden = true;
  const spot = el('div', 'spot');
  spot.hidden = true;
  const hud = el('div', 'hud');
  hud.innerHTML = `<button class="hud-pause" aria-label="pause"><i></i><i></i></button>` +
    `<div class="hud-day">${ICON.cal}<b class="hud-dayn">1</b></div>` +
    `<div class="hud-money"><span class="hud-coin">${coinSVG()}</span><b class="hud-num">0</b><i class="hud-goal"><i></i></i><span class="hud-flag">${ICON.flag}</span></div>` +
    `<div class="hud-timer">${ICON.clock}<b class="ht-num"></b></div>` +
    `<div class="hud-stars"></div>`;
  const cards = el('div', 'cards');
  stage.append(fx, clerkCut, subs, spot, finger, hud, cards);
  const rotate = el('div', 'rotate');
  rotate.hidden = true;
  app.append(rotate);
  const hudNum = hud.querySelector('.hud-num');
  const hudGoal = hud.querySelector('.hud-goal > i');
  const hudStars = hud.querySelector('.hud-stars');
  const htArc = hud.querySelector('.ht-arc');
  const htHand = hud.querySelector('.ht-hand');
  const htNum = hud.querySelector('.ht-num');
  const hudTimer = hud.querySelector('.hud-timer');
  const hudDay = hud.querySelector('.hud-dayn');
  hud.querySelector('.hud-pause').addEventListener('click', () => call('onPause'));

  // stage scale (design px → screen px), kept current on resize
  let K = 1;
  const measure = () => { K = (stage.clientWidth || STAGE.w) / STAGE.w; };
  measure();
  try { new ResizeObserver(measure).observe(stage); } catch { window.addEventListener('resize', measure); }

  let seats = [];      // [{ el, bubble, pb, pbw, uid, key, pct }]
  let wslots = [];     // work slot elements
  let st = {};         // station elements by name
  let R = {};          // station rects (design px)
  let cupEls = new Map(); // cup id → { el, key, ref }
  const walkers = new Map(); // customer uid → { el, inner, leaving, mode }
  let lastStars = -1;
  let lastMoney = null;
  let shown = 0;       // the HUD money as displayed (ticks up when the coins land)
  let tween = null;    // { from, to, t0, dur }
  let lastTower = -1;
  let cfg = null;
  let def = null;
  let lastState = null;

  // ---- build ----
  function station(cls, html, act, arg, rect) {
    const e = el('div', `st ${cls}`, html);
    if (act) e.dataset.act = act;
    if (arg) e.dataset.arg = arg;
    if (rect) place(e, rect, rect.h);
    counter.insertBefore(e, cupsEl);
    return e;
  }
  function prop(cls, html, rect) {
    const e = el('div', `prop ${cls}`, html);
    place(e, rect, rect.h);
    counter.insertBefore(e, cupsEl);
    return e;
  }

  function build(shop) {
    const s = shop.state;
    cfg = shop.cfg;
    def = shop.def;
    counter.querySelectorAll('.st, .wslot, .prop, .lock-spot').forEach((n) => n.remove());
    pillar.innerHTML = '';
    cupsEl.innerHTML = '';
    cupEls = new Map();
    walkersEl.innerHTML = '';
    walkers.clear();
    st = {};
    const tops = TOP_ORDER.filter((k) => def.toppings.includes(k) || (k === 'coconut' && cfg.coconut));
    const spec = { teas: def.teas, toppings: tops, ice: def.ice, sugar: def.sugar, workSlots: s.work.length, shelf: s.shelf.length, sealers: cfg.sealers, helper: !!cfg.helperMs };
    R = stationRects(spec);
    stage.dataset.seats = String(s.slots.length);
    street.innerHTML = streetSVG({ neon: cfg.fameMult > 1, rail: cfg.queueBonus > 0 });
    hudDay.textContent = String(def.n || 1);
    // covered spots for everything not owned / not on the menu yet (the shelf draws its own locks)
    for (const L of lockedSpots(spec)) {
      if (L.kind === 'shelf') continue;
      const e = el('div', `lock-spot lk-${L.kind}`, lockedSVG(L.kind));
      e.dataset.name = L.name;
      place(e, L, L.h);
      counter.insertBefore(e, cupsEl);
    }
    // back row
    st.rack = station('st-rack', cupRackSVG(), 'take', null, R.rack);
    const fast = cfg.pourMs < 600;
    def.teas.forEach((k) => { st['tea-' + k] = station('st-tea', teaTankSVG(k, { fast }), 'tea', k, R['tea-' + k]); });
    if (cfg.teaAll) {
      const xs = def.teas.map((k) => R['tea-' + k]);
      const x0 = Math.min(...xs.map((r) => r.x)) - 4;
      const x1 = Math.max(...xs.map((r) => r.x + r.w)) + 4;
      const m = prop('manifold', teaManifoldSVG(def.teas.length), { x: x0, y: xs[0].y - 26, w: x1 - x0 });
      m.style.height = '';
    }
    if (def.ice) st.ice = station('st-ice', cfg.iceSmart ? iceDispenserSVG() : iceBinSVG(), 'ice', null, R.ice);
    if (def.sugar) st.sugar = station('st-syrup', syrupSVG(), 'sugar', null, R.sugar);
    st.tower = station('st-tower', '', null, null, R.tower);
    if (cfg.golden) prop('golden-card', goldenCardSVG(), DECOR.golden);
    for (let k = 0; k < cfg.sealers; k++) {
      const e = station('st-sealer', sealerSVG('idle', { turbo: cfg.sealMs < 800 }), 'sealer', String(k), R['sealer-' + k]);
      e.dataset.k = String(k);
      e.insertAdjacentHTML('beforeend', '<i class="seal-bar"><i></i></i>');
      st['sealer-' + k] = e;
    }
    st.shelf = station('st-shelf', shelfSVG(s.shelf.length, { autoSeal: cfg.autoSeal }), 'shelf', null, R.shelf);
    // front row
    if (cfg.cookMs < 8000 || cfg.autoCook) prop('pot-rig', potRigSVG(cfg.autoCook ? 4 : 3), R.pot);
    st.pot = station(`st-pot${cfg.potMax > 10 ? ' big' : ''}`, potSVG({ scoops: Math.min(10, s.pot.scoops), cookingPct: 0 }), 'cook', null, R.pot);
    tops.forEach((k) => { st['top-' + k] = station('st-top', toppingTraySVG(k, 10), 'topping', k, R['top-' + k]); st['top-' + k].dataset.kind = k; });
    wslots = s.work.map((_, w) => {
      const r = R['slot-' + w];
      const e = el('div', 'wslot', `<div class="plate">${workSlotSVG()}</div>`);
      e.dataset.w = String(w);
      place(e, r, r.h);
      counter.insertBefore(e, cupsEl);
      return e;
    });
    st.trash = station('st-trash', trashSVG(), 'trash', null, R.trash);
    if (cfg.helperMs) {
      st.helper = station('st-helper', helperSVG(cfg.helperMs < 8000 ? 2 : 1) + '<div class="helper-cup"></div><i class="helper-bar"><i></i></i>', null, null, R.helper);
    }
    // the window pillar: decoration upgrades
    pillar.innerHTML = (cfg.patienceMult > 1 ? `<div class="pp pp-ac">${acSVG()}</div>` : '') +
      (cfg.tipMult > 1 ? `<div class="pp pp-speaker">${speakerSVG()}</div>` : '') +
      (cfg.megaphone ? `<div class="pp pp-mega">${MEGAPHONE_SVG}</div>` : '') +
      (cfg.prepayMult > 1 ? `<div class="pp pp-ticket">${ticketMachineSVG()}</div>` : '');
    // counter spots: the bubble (with its patience bar) and the gesture column
    seatsEl.innerHTML = '';
    seats = s.slots.map((_, i) => {
      const col = seatColumn(i, s.slots.length);
      const e = el('div', 'seat');
      e.dataset.slot = String(i);
      place(e, { x: col.x, y: 0, w: col.w }, LIP_Y);
      e.innerHTML = '<div class="bubble"></div><div class="hit"></div>';
      seatsEl.append(e);
      return { el: e, bubble: e.querySelector('.bubble'), pb: null, pbw: 0, colW: col.w, uid: null, key: '', pct: -1 };
    });
    lastStars = -1; lastMoney = null; lastTower = -1; tween = null;
    shown = Math.round(s.earned);
    stage.dataset.helper = cfg.helperMs ? '1' : '';
    render(s);
  }

  // ---- walkers ----
  function walkerEl(c) {
    const e = el('div', 'walker');
    e.dataset.uid = String(c.uid);
    e.dataset.kind = c.kind === 'oke' ? 'oke' : 'normal';
    const tag = c.kind === 'oke' ? `<div class="wk-tag">${okeBubbleSVG(okeOf(c.oke).prop)}</div>` : '';
    e.innerHTML = `<div class="wk-inner">${walkerSVG({ cid: c.cid, visit: c.visit || 0, fixed: c.oke === 'c250' ? 'c250' : undefined, oke: c.oke, uid: c.uid })}${tag}</div>`;
    // every person blinks and sways on their own beat
    e.style.setProperty('--blink', `${(-(c.uid * 1.37) % 4).toFixed(2)}s`);
    e.style.setProperty('--sway', `${(-(c.uid * 0.71) % 3).toFixed(2)}s`);
    walkersEl.append(e);
    const w = { el: e, inner: e.querySelector('.wk-inner'), leaving: null, mode: '' };
    if (c.fan && (c.uid % 3 === 0)) e.classList.add('phone');
    walkers.set(c.uid, w);
    return w;
  }
  function setPos(w, p, far = 0) {
    const x = p.x * K - (PERSON.w * K) / 2;
    const y = p.y * K - PERSON.h * K;
    w.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${p.s.toFixed(4)})`;
    w.el.style.zIndex = String(Math.round(p.y));
    w.el.style.setProperty('--far', far.toFixed(2));
    w.pos = p;
  }
  function setMode(w, mode) {
    if (w.mode === mode) return;
    w.el.classList.remove('m-walk', 'm-run', 'm-idle', 'm-counter', 'm-swag');
    w.el.classList.add(`m-${mode}`);
    w.mode = mode;
  }
  function renderWalkers(s) {
    const seen = new Set();
    const n = s.slots.length;
    s.queue.forEach((c) => {
      seen.add(c.uid);
      const w = walkers.get(c.uid) || walkerEl(c);
      // the cut-in customer squeezes past on the road side; people in line stand a little off a straight line, spread
      // out along the sidewalk (lineU) instead of in a clump
      const lane = c.cut && c.phase === 'walk' ? 0.9 : ((c.uid % 3) - 1) * 0.16;
      const u = lineU(c.u);
      setPos(w, streetPoint(u, lane), clamp((u - 0.42) / 0.3, 0, 1));
      const moving = c.phase === 'walk';
      setMode(w, moving ? (c.run ? 'run' : c.kind === 'oke' ? 'swag' : 'walk') : 'idle');
    });
    s.incoming.forEach((inc, i) => {
      if (!inc) return;
      seen.add(inc.c.uid);
      const w = walkers.get(inc.c.uid) || walkerEl(inc.c);
      setPos(w, stepPoint(i, n, (s.t - inc.t0) / (inc.until - inc.t0)));
      setMode(w, inc.c.kind === 'oke' ? 'swag' : 'walk');
    });
    s.slots.forEach((c, i) => {
      if (!c) return;
      seen.add(c.uid);
      const w = walkers.get(c.uid) || walkerEl(c);
      if (w.leaving) return;
      setPos(w, seatPoint(i, n));
      setMode(w, 'counter');
      w.el.classList.toggle('oke-live', c.kind === 'oke' && !c.converted);
    });
    // anyone no longer in the state walks away (closing time, or a leave event already started it): a happy hop first
    // for a paying customer, then they turn round (back view) and walk off into the distance on the road-side lane
    const now = performance.now();
    for (const [uid, w] of walkers) {
      if (seen.has(uid) && !w.leaving) continue;
      if (!w.leaving) startLeave(w, 'walk');
      const L = w.leaving;
      const t = now - L.t0 - (L.hold || 0);
      if (L.kind === 'fly') { if (t > 700) { w.el.remove(); walkers.delete(uid); } continue; }
      if (t < 0) continue;
      if (!w.el.classList.contains('back')) { w.el.classList.add('back'); w.el.classList.remove('happy'); setMode(w, 'walk'); }
      const from = L.from;
      const out = streetPoint(0, 1.3);
      let p;
      if (t < 650) {
        const e = t / 650;
        p = { x: from.x + (out.x - from.x) * e, y: from.y + (out.y - from.y) * e, s: from.s + (out.s - from.s) * e };
      } else {
        const u = (t - 650) / 3000;
        p = streetPoint(u, 1.3);
        if (u > 1.1) { w.el.remove(); walkers.delete(uid); continue; }
      }
      setPos(w, p, clamp((((t - 650) / 3000) - 0.42) / 0.3, 0, 1));
      w.el.style.zIndex = String(Math.round(p.y) - 400);
    }
  }
  function startLeave(w, kind, reason) {
    const happy = reason === 'served' || reason === 'take';
    w.leaving = { kind, t0: performance.now(), from: w.pos || streetPoint(0), hold: happy && kind === 'walk' ? 420 : 0 };
    w.el.classList.remove('oke-live');
    if (reason) w.el.dataset.exit = reason;
    if (happy && kind === 'walk') restart(w.el, 'happy');
    if (kind === 'walk') { setMode(w, w.leaving.hold ? 'counter' : 'walk'); w.el.classList.add('leaving'); }
  }

  // ---- seats (bubbles, patience bars) ----
  function seatKey(c) { return c ? `${c.uid}|${c.kind}|${c.converted ? 1 : 0}|${(c.got || []).map((g) => (g ? 1 : 0)).join('')}` : ''; }
  function renderSeats(s) {
    s.slots.forEach((c, i) => {
      const se = seats[i];
      if (!se) return;
      const key = seatKey(c);
      const isOke = !!(c && c.kind === 'oke' && !c.converted);
      if (key !== se.key) {
        const fresh = !c || !se.key || se.key.split('|')[0] !== key.split('|')[0];
        se.key = key;
        se.uid = c ? c.uid : null;
        se.el.dataset.kind = !c ? '' : isOke ? 'oke' : 'normal';
        se.el.classList.toggle('double', !!(c && c.doublePay));
        const n = c && c.order ? c.order.count : 1;
        const bw = isOke ? 112 : bubbleWidth(n, se.colW);
        se.bubble.style.width = cq(bw);
        se.bubble.style.marginLeft = cq(isOke ? -bw * 0.32 : -bw / 2);
        se.bubble.innerHTML = !c ? '' : isOke ? okeBubbleSVG(okeOf(c.oke).prop) : itemsBubbleSVG(c.order, c.got);
        se.bubble.dataset.n = String(n);
        se.pb = se.bubble.querySelector('.pb-fill');
        se.pbw = se.pb ? Number(se.pb.dataset.w) : 0;
        se.pct = -1;
        if (c && fresh) restart(se.bubble, 'pop');
      }
      if (c && !isOke && se.pb) {
        const pct = Number.isFinite(c.patienceMax) ? Math.max(0, c.patience / c.patienceMax) : 1;
        const q = Math.round(pct * 60) / 60;
        if (q !== se.pct) {
          se.pct = q;
          se.pb.setAttribute('width', (se.pbw * q).toFixed(1));
          se.pb.setAttribute('fill', patienceColor(q));
          se.el.classList.toggle('hurry', q < 0.3);
        }
      } else se.el.classList.remove('hurry');
    });
  }

  // ---- cups ----
  function cupPlace(ref, cup) {
    if (ref.shelf != null) {
      const r = R['shelf-' + ref.shelf];
      const w = Math.min(54, r.w * 0.64);
      return { x: r.x + r.w / 2, y: r.y + 89, w };
    }
    if (cup.sealingUntil && !cup.sealed && cup.sealer >= 0 && R['sealer-' + cup.sealer]) {
      const r = R['sealer-' + cup.sealer];
      return { x: r.x + r.w * 0.5, y: r.y + r.h * (136 / 150) + 3, w: r.w * 0.5 };
    }
    const r = R['slot-' + ref.w];
    const w = Math.min(72, r.w * 0.72);
    return { x: r.x + r.w / 2, y: r.y + r.h - 24, w };
  }
  function renderCups(s) {
    const live = new Set();
    const put = (cup, ref) => {
      live.add(cup.id);
      let c = cupEls.get(cup.id);
      if (!c) {
        c = { el: el('div', 'cup'), key: '', ref: null };
        cupsEl.append(c.el);
        cupEls.set(cup.id, c);
        c.el.classList.add('new');
        setTimeout(() => c.el.classList.remove('new'), 30);
      }
      const sealing = !!(cup.sealingUntil && !cup.sealed);
      const key = `${cup.tea}|${cup.toppings.join(',')}|${cup.ice}|${cup.sugar}|${cup.sealed ? 1 : 0}`;
      if (key !== c.key) { c.key = key; c.el.innerHTML = cupSVG(cup); }
      const refKey = ref.shelf != null ? `s${ref.shelf}` : `w${ref.w}`;
      const pos = cupPlace(ref, cup);
      const posKey = `${refKey}|${Math.round(pos.x)}|${Math.round(pos.y)}|${Math.round(pos.w)}`;
      if (c.posKey !== posKey && !c.el.classList.contains('dragging')) {
        c.posKey = posKey;
        c.el.style.left = cq(pos.x - pos.w / 2);
        c.el.style.top = cq(pos.y - pos.w * 1.6);
        c.el.style.width = cq(pos.w);
      }
      c.pos = pos;
      c.ref = ref;
      c.el.dataset.ref = refKey;
      c.el.classList.toggle('sealing', sealing);
      c.el.classList.toggle('sealed', !!cup.sealed);
      c.el.classList.toggle('on-shelf', ref.shelf != null);
      c.el.classList.toggle('selected', ref.w != null && s.selected === ref.w && !cup.sealed && !sealing);
    };
    s.work.forEach((cup, w) => { if (cup) put(cup, { w }); });
    s.shelf.forEach((cup, i) => { if (cup) put(cup, { shelf: i }); });
    for (const [id, c] of cupEls) {
      if (live.has(id)) continue;
      cupEls.delete(id);
      if (c.gone) c.el.remove();
      else { c.el.classList.add('vanish'); setTimeout(() => c.el.remove(), 260); }
    }
  }
  const cupById = (id) => cupEls.get(id);

  // ---- traffic on the road and passers-by on the far sidewalk (decoration; never customers, never riders) ----
  let nextCar = 2500;
  let nextPed = 800;
  let lastT = 0;
  let carSeed = 1;
  function spawnCar() {
    const toward = Math.random() < 0.5;
    const scooter = Math.random() < 0.3;
    const xa = toward ? 30 : 1380;
    const xb = toward ? 1380 : 30;
    const a = roadLane(xa, !toward);
    const b = roadLane(xb, !toward);
    const sz = scooter ? 0.62 : 1;
    const e = el('div', `vehicle${toward ? ' toward' : ''}`, vehicleSVG(scooter ? 'scooter' : 'car', carSeed++));
    const W = 170 * K;
    e.style.setProperty('--x0', `${(xa * K - W / 2).toFixed(1)}px`);
    e.style.setProperty('--y0', `${(a.y * K - W * 0.45).toFixed(1)}px`);
    e.style.setProperty('--s0', (a.s * sz).toFixed(3));
    e.style.setProperty('--x1', `${(xb * K - W / 2).toFixed(1)}px`);
    e.style.setProperty('--y1', `${(b.y * K - W * 0.45).toFixed(1)}px`);
    e.style.setProperty('--s1', (b.s * sz).toFixed(3));
    e.style.animationDuration = `${(scooter ? 4.2 : 3.4) + Math.random() * 1.6}s`;
    e.addEventListener('animationend', () => e.remove());
    traffic.append(e);
  }
  function spawnPed() {
    if (traffic.querySelectorAll('.ped').length >= 3) return;
    const right = Math.random() < 0.5;
    const xa = right ? 90 : 1200;
    const xb = right ? 1200 : 90;
    const a = farWalk(xa);
    const b = farWalk(xb);
    const e = el('div', `ped${right ? ' right' : ''}`, pedSVG(carSeed++));
    const W = 24 * 3 * K;
    e.style.setProperty('--x0', `${(xa * K - W / 2).toFixed(1)}px`);
    e.style.setProperty('--y0', `${(a.y * K - W * 2.45).toFixed(1)}px`);
    e.style.setProperty('--s0', (a.s * 1.5).toFixed(3));
    e.style.setProperty('--x1', `${(xb * K - W / 2).toFixed(1)}px`);
    e.style.setProperty('--y1', `${(b.y * K - W * 2.45).toFixed(1)}px`);
    e.style.setProperty('--s1', (b.s * 1.5).toFixed(3));
    e.style.animationDuration = `${16 + Math.random() * 8}s`;
    e.addEventListener('animationend', () => e.remove());
    traffic.append(e);
  }
  function renderTraffic() {
    const now = performance.now();
    const dt = lastT ? Math.min(200, now - lastT) : 0;
    lastT = now;
    if (reduced() || document.hidden) return;
    nextCar -= dt;
    nextPed -= dt;
    if (nextCar <= 0) { spawnCar(); nextCar = 5000 + Math.random() * 7000; }
    if (nextPed <= 0) { spawnPed(); nextPed = 3500 + Math.random() * 5000; }
  }

  // ---- per frame ----
  function render(s) {
    lastState = s;
    const now = performance.now();
    const m = Math.round(s.earned);
    if (m !== lastMoney) {
      if (lastMoney == null) shown = m;
      else tween = { from: shown, to: m, t0: now + (m > shown ? 480 : 0), dur: 420 };
      lastMoney = m;
      hud.classList.toggle('goal-met', m >= s.def.goal);
    }
    if (tween && now >= tween.t0) {
      const e = clamp((now - tween.t0) / tween.dur, 0, 1);
      const v = Math.round(tween.from + (tween.to - tween.from) * e);
      if (v !== shown || e >= 1) {
        shown = v;
        if (e >= 1) tween = null;
      }
    }
    const txt = money(shown);
    if (hudNum.textContent !== txt) {
      hudNum.textContent = txt;
      hudGoal.style.width = `${clamp(shown / s.def.goal, 0, 1) * 100}%`;
    }
    if (s.stars !== lastStars) {
      hudStars.innerHTML = starRowSVG(s.stars);
      if (lastStars >= 0 && s.stars > lastStars) {
        const star = hudStars.querySelectorAll('.star')[s.stars - 1];
        if (star) star.classList.add('fill');
      }
      lastStars = s.stars;
      stage.dataset.stars = String(s.stars);
    }
    const left = Math.max(0, s.length - s.clock);
    const sec = Math.ceil(left / 1000);
    const tt = s.phase === 'guide' ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    if (htNum.textContent !== tt) htNum.textContent = tt;
    const frac = left / s.length;
    htArc.setAttribute('stroke-dasharray', `${(frac * 100).toFixed(1)} 100`);
    htHand.setAttribute('transform', `rotate(${(-360 * frac).toFixed(1)} 20 21)`);
    hudTimer.classList.toggle('late', s.phase === 'open' && left < 15000);
    hud.classList.toggle('guide', s.phase === 'guide');
    renderWalkers(s);
    renderSeats(s);
    renderCups(s);
    renderTraffic();
    // sealers
    for (let k = 0; k < (cfg ? cfg.sealers : 1); k++) {
      const e = st['sealer-' + k];
      if (!e) continue;
      const cup = s.work.find((c) => c && c.sealingUntil && !c.sealed && c.sealer === k);
      const busy = cup ? 'busy' : 'idle';
      if (e.dataset.state !== busy) { e.dataset.state = busy; e.querySelector('svg').outerHTML = sealerSVG(busy, { turbo: cfg.sealMs < 800 }); }
      e.querySelector('.seal-bar > i').style.width = cup ? `${clamp(1 - (cup.sealingUntil - s.t) / cfg.sealMs, 0, 1) * 100}%` : '0%';
    }
    if (st.shelf) st.shelf.classList.toggle('sealing', s.shelf.some((c) => c && c.sealingUntil && !c.sealed));
    // pot (the art shows up to 10 scoops; a big pot shows its share)
    if (st.pot) {
      const pct = s.pot.cookingUntil ? 1 - (s.pot.cookingUntil - s.t) / cfg.cookMs : 0;
      const shownScoops = Math.ceil((s.pot.scoops / s.pot.max) * 10);
      const key = `${shownScoops}|${Math.round(pct * 20)}`;
      if (st.pot.dataset.key !== key) {
        st.pot.dataset.key = key;
        st.pot.querySelector('svg').outerHTML = potSVG({ scoops: shownScoops, cookingPct: s.pot.cookingUntil ? Math.max(0.02, pct) : 0 });
        st.pot.classList.toggle('empty', s.pot.scoops === 0 && !s.pot.cookingUntil);
        st.pot.classList.toggle('cooking', !!s.pot.cookingUntil);
        const tray = st['top-pearl'];
        if (tray) { tray.querySelector('svg').outerHTML = toppingTraySVG('pearl', shownScoops); tray.classList.toggle('empty', s.pot.scoops === 0); }
      }
    }
    // the part-timer
    if (st.helper && s.helper) {
      const hp = s.helper.item ? clamp(1 - (s.helper.until - s.t) / cfg.helperMs, 0, 1) : 0;
      st.helper.querySelector('.helper-bar > i').style.width = `${hp * 100}%`;
      const hk = s.helper.item ? JSON.stringify(s.helper.item) : '';
      if (st.helper.dataset.key !== hk) {
        st.helper.dataset.key = hk;
        st.helper.querySelector('.helper-cup').innerHTML = s.helper.item ? cupSVG({ ...s.helper.item, sealed: false }) : '';
        st.helper.classList.toggle('busy', !!s.helper.item);
      }
    }
    // cup tower: grows with the cups sold today
    const tower = Math.min(9, Math.floor(s.stats.served / 3));
    if (tower !== lastTower && st.tower) {
      const grew = lastTower >= 0 && tower > lastTower;
      lastTower = tower;
      st.tower.innerHTML = towerHTML(tower);
      if (grew) restart(st.tower, 'grow');
    }
  }

  // ---- fx ----
  function rectIn(e) {
    const r = e.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height, cx: r.left - sr.left + r.width / 2, cy: r.top - sr.top + r.height / 2 };
  }
  function seatHeadRect(i) {
    const n = seats.length || 1;
    const p = seatPoint(i, n);
    const w = PERSON.w * p.s;
    const hh = 200 / 480 * PERSON.h * p.s;
    const top = p.y - PERSON.h * p.s;
    return { x: (p.x - w / 2) * K, y: top * K, w: w * K, h: hh * K, cx: p.x * K, cy: (top + hh / 2) * K };
  }
  function shake(px = 4) {
    if (reduced()) px = Math.round(px / 2);
    shaker.style.setProperty('--sh', `${px}px`);
    restart(shaker, 'shake');
  }
  let floatBusy = 0;
  function floatNum(text, x, y, cls = '') {
    const now = performance.now();
    const delay = Math.max(0, floatBusy - now);
    floatBusy = now + delay + 240;
    setTimeout(() => {
      const f = el('div', `float ${cls}`, esc(text));
      f.style.left = `${x}px`;
      f.style.top = `${y}px`;
      fx.append(f);
      setTimeout(() => f.remove(), 900);
    }, delay);
  }
  // coins pop out of the customer, then fly into the HUD coin; the HUD number ticks up as they land (render)
  function coinsFly(from, n = 3) {
    const to = rectIn(hud.querySelector('.hud-coin'));
    for (let i = 0; i < n; i++) {
      const c = el('div', 'coin-fly', coinSVG());
      c.style.left = `${from.cx}px`;
      c.style.top = `${from.cy}px`;
      fx.append(c);
      const px = (Math.random() - 0.5) * 70 * K;
      const py = -(40 + Math.random() * 40) * K;
      const dx = to.cx - from.cx;
      const dy = to.cy - from.cy;
      const a = c.animate ? c.animate([
        { transform: 'translate(0, 0) scale(.3)', opacity: 0 },
        { transform: `translate(${px}px, ${py}px) scale(1.15)`, opacity: 1, offset: 0.32, easing: 'cubic-bezier(.4, 0, .9, .6)' },
        { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 1 },
      ], { duration: 640 + i * 60, delay: i * 55, easing: 'linear', fill: 'both' }) : null;
      const done = () => { c.remove(); restart(hud, 'bump'); };
      if (a) a.onfinish = done; else setTimeout(done, 700);
    }
  }
  function burst(x, y, kind, n = 5) {
    for (let i = 0; i < n; i++) {
      const p = el('i', `pt pt-${kind}`);
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const d = (30 + Math.random() * 40) * K * 1.6;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      p.style.setProperty('--dy', `${Math.sin(a) * d - 20}px`);
      fx.append(p);
      setTimeout(() => p.remove(), 650);
    }
  }
  // a small arc from a station to the cup (toppings, ice, syrup)
  function arcDrop(kind, from, to, n = 3) {
    for (let i = 0; i < n; i++) {
      const o = el('div', 'arc-x');
      const inner = el('i', `pt-drop pt-${kind}`);
      o.append(inner);
      const jx = (i - (n - 1) / 2) * 7 * K;
      o.style.left = `${from.x + jx}px`;
      o.style.top = `${from.y}px`;
      o.style.setProperty('--dx', `${to.x - from.x - jx * 0.5}px`);
      inner.style.setProperty('--dy', `${to.y - from.y}px`);
      inner.style.setProperty('--up', `${-Math.max(30 * K, (from.y - to.y) * 0.25 + 46 * K)}px`);
      o.style.animationDelay = inner.style.animationDelay = `${i * 50}ms`;
      fx.append(o);
      setTimeout(() => o.remove(), 520 + i * 50);
    }
  }
  // the tea stream: a curved ribbon from the tap's spout into the cup
  function pour(kind, from, to, ms) {
    const c = TEA_COLORS[kind] ? TEA_COLORS[kind].body : '#C8915C';
    const mx = (from.x + to.x) / 2;
    const my = Math.min(from.y, to.y) - 40 * K;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const e = el('div', 'stream', `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path pathLength="100" d="M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}" stroke="#4A2C1C" stroke-width="${(9 * K).toFixed(1)}"/>` +
      `<path pathLength="100" d="M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}" stroke="${c}" stroke-width="${(6 * K).toFixed(1)}"/>` +
      `<path class="stream-glint" pathLength="100" d="M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="${(1.6 * K).toFixed(1)}"/></svg>`);
    e.style.setProperty('--ms', `${Math.max(240, ms)}ms`);
    fx.append(e);
    setTimeout(() => e.remove(), Math.max(240, ms) + 320);
    // a splash ring on the cup
    const sp = el('div', 'splash');
    sp.style.left = `${to.x}px`;
    sp.style.top = `${to.y}px`;
    sp.style.setProperty('--c', c);
    sp.style.animationDelay = '160ms';
    fx.append(sp);
    setTimeout(() => sp.remove(), 700);
  }
  const dp = (x, y) => ({ x: x * K, y: y * K });
  function cupTop(w) {
    const cup = lastState && lastState.work[w];
    const c = cup && cupById(cup.id);
    if (!c || !c.pos) return null;
    return dp(c.pos.x, c.pos.y - c.pos.w * 1.6 + c.pos.w * 0.3);
  }
  let clerkT = 0;
  function clerkPop(key) {
    const svg = clerkCut.querySelector('svg');
    clearTimeout(clerkT);
    clerkCut.className = `clerk-cut on k-${key}`;
    svg.dataset.mood = 'hit';
    clerkT = setTimeout(() => {
      svg.dataset.mood = 'perfect';
      clerkT = setTimeout(() => { clerkCut.className = `clerk-cut k-${key}`; svg.dataset.mood = 'idle'; }, 560);
    }, 640);
  }
  function stampOn(i) {
    const r = seatHeadRect(i);
    const s = el('div', 'stamp', STAMP_SVG);
    s.style.left = `${r.cx}px`;
    s.style.top = `${r.y + r.h * 0.4}px`;
    fx.append(s);
    const tk = el('div', 'ticket', T.ticket.map((x, k) => `<span class="tk${k}">${esc(x)}</span>`).join(''));
    tk.style.left = `${r.cx}px`;
    tk.style.top = `${r.y}px`;
    fx.append(tk);
    setTimeout(() => s.remove(), 1100);
    setTimeout(() => tk.remove(), 1600);
  }
  function sparkle(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const p = el('i', 'spark');
      const a = (Math.PI * 2 * i) / n;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.setProperty('--a', `${(a * 180) / Math.PI}deg`);
      fx.append(p);
      setTimeout(() => p.remove(), 520);
    }
  }

  let subT = 0;
  function say(text, who = 'clerk', key = 'gun') {
    clearTimeout(subT);
    const raw = String(text || '');
    if (!stripDir(raw.replace(/\|/g, ''))) { subs.innerHTML = ''; return; }
    if (who === 'clerk') {
      const i = raw.indexOf('|');
      const setup = i < 0 ? '' : stripDir(raw.slice(0, i));
      const punch = stripDir(i < 0 ? raw : raw.slice(i + 1).replace(/\|/g, ''));
      subs.innerHTML = `<div class="sub clerk" style="--bar:${KEY_COLOR[key] || 'var(--text)'}">${setup ? `<span class="setup">${esc(setup)}</span>` : ''}<b class="punch" style="color:${KEY_COLOR[key] || 'var(--text)'}">${esc(punch)}</b></div>`;
    } else {
      subs.innerHTML = `<div class="sub cust" style="--bar:${KEY_COLOR[key] || 'var(--paper)'}">${esc(stripDir(raw.replace(/\|/g, '')))}</div>`;
    }
    subT = setTimeout(() => { subs.innerHTML = ''; }, Math.max(1800, raw.length * 140));
  }

  function onEvent(ev, ctx = {}) {
    const t = shopText(ctx.lang || lang);
    switch (ev.type) {
      case 'leave': {
        const w = walkers.get(ev.cust.uid);
        const r = seatHeadRect(ev.slot);
        if (ev.reason === 'gun') {
          shake(8);
          burst(r.cx, r.cy, 'ice', 5);
          if (w) { startLeave(w, 'fly', 'gun'); w.el.classList.add('fly'); }
        } else if (w) {
          if (ev.reason === 'take') { stampOn(ev.slot); w.el.classList.add('has-ticket'); }
          if (ev.reason === 'timeout') w.el.classList.add('sad');
          startLeave(w, 'walk', ev.reason);
        }
        break;
      }
      case 'answer': {
        if (ev.key === 'shut' && !ev.normal) {
          const w = walkers.get(ev.cust.uid);
          if (w) restart(w.el, 'squash');
          const r = seatHeadRect(ev.slot);
          burst(r.cx, r.cy, 'pearl', 3);
          shake(4);
        }
        clerkPop(ev.key);
        const r = seatHeadRect(ev.slot);
        if (ev.prepay) { floatNum(`+${ev.prepay}`, r.cx, r.y + r.h * 0.2, 'gold'); coinsFly({ cx: r.cx, cy: r.y + r.h * 0.5 }, 5); }
        if (ev.best) restart(stage, 'laugh');
        break;
      }
      case 'fans': {
        for (const uid of ev.uids || []) {
          const w = walkers.get(uid);
          if (w && ev.why === 'star' && uid === ev.uids[0]) w.el.classList.add('sign');
        }
        restart(corner, 'surge');
        break;
      }
      case 'serve': {
        const w = walkers.get(ev.cust.uid);
        if (ev.correct) {
          if (w && !ev.done) restart(w.el, 'happy');
          if (!ev.done && seats[ev.slot]) restart(seats[ev.slot].bubble, 'tickpop');
        } else {
          if (w) restart(w.el, 'wobble');
          say(t.complaints[Math.floor(Math.random() * t.complaints.length)], 'cust', 'shut');
        }
        break;
      }
      case 'pay': {
        const r = seatHeadRect(ev.slot);
        floatNum(`+${ev.pay + ev.tip}`, r.cx, r.y + r.h * 0.1, ev.wrong ? 'dim' : '');
        coinsFly({ cx: r.cx, cy: r.y + r.h * 0.55 }, ev.tip > 0 ? 4 : 3);
        break;
      }
      case 'tea': {
        renderCupsNow();
        const c = lastState && lastState.work[ev.w] && cupById(lastState.work[ev.w].id);
        if (c) restart(c.el, 'pour');
        const tank = st['tea-' + ev.kind];
        if (tank) {
          press(tank);
          const r = R['tea-' + ev.kind];
          const to = cupTop(ev.w);
          if (to) pour(ev.kind, dp(r.x + r.w * 0.5, r.y + r.h * 0.93), to, ev.ms || 600);
        }
        break;
      }
      case 'topping': {
        const tr = st['top-' + ev.kind];
        if (tr) press(tr);
        const r = R['top-' + ev.kind];
        const to = cupTop(ev.w);
        if (r && to) arcDrop(ev.kind, dp(r.x + r.w * 0.5, r.y + r.h * 0.38), to, 3);
        bounceCup(ev.w, 300);
        break;
      }
      case 'ice': {
        if (st.ice) press(st.ice);
        const r = R.ice;
        const to = cupTop(ev.w);
        if (r && to && ev.level) arcDrop('ice', dp(r.x + r.w * 0.5, r.y + r.h * 0.3), to, 2);
        bounceCup(ev.w, 300);
        break;
      }
      case 'sugar': {
        if (st.sugar) press(st.sugar);
        const r = R.sugar;
        const to = cupTop(ev.w);
        if (r && to && ev.level) arcDrop('syrup', dp(r.x + r.w * 0.86, r.y + r.h * 0.2), to, 2);
        bounceCup(ev.w, 300);
        break;
      }
      case 'cup': press(st.rack); bounceCup(ev.w, 0); break;
      case 'sealStart': if (ev.shelf) press(st.shelf); else press(st['sealer-' + (ev.sealer || 0)]); break;
      case 'sealed': {
        shake(3);
        const e = ev.shelf != null ? st.shelf : st['sealer-' + (ev.sealer || 0)];
        const c = cupById(ev.id);
        if (c) restart(c.el, 'snap');
        if (e) {
          const r = c ? rectIn(c.el) : rectIn(e);
          floatNum('喀', r.cx, r.y - 8 * K, 'kaa');
          sparkle(r.cx, r.y + r.w * 0.24, 6);
        }
        break;
      }
      case 'helperCup': if (st.helper) press(st.helper); break;
      case 'trash': press(st.trash); break;
      case 'cookStart': press(st.pot); break;
      case 'star': {
        restart(stage, 'starup');
        const r = rectIn(hudStars);
        sparkle(r.x + r.w * ((ev.stars - 0.5) / 5), r.cy, 8);
        break;
      }
      case 'nope': {
        const target = ev.reason === 'potEmpty' ? st.pot : ev.reason === 'noCup' || ev.reason === 'noSlot' ? st.rack
          : ev.reason === 'sealerBusy' ? st['sealer-0'] : ev.reason === 'shelfFull' ? st.shelf : null;
        restart(target, 'nudge');
        break;
      }
      case 'refuse': {
        const w = walkers.get(ev.cust.uid);
        if (w) restart(w.el, 'wobble');
        break;
      }
      default: break;
    }
  }
  function renderCupsNow() { if (lastState) renderCups(lastState); }
  function press(e) { restart(e, 'press'); }
  function bounceCup(w, delay = 0) {
    renderCupsNow();
    const cup = lastState && lastState.work[w];
    const c = cup && cupById(cup.id);
    if (c) setTimeout(() => restart(c.el, 'bounce'), delay);
  }

  // ---- guide finger ----
  let guideTimer = 0;
  function guide(step, s) {
    clearInterval(guideTimer);
    finger.hidden = !step;
    finger.className = 'finger';
    if (!step) return;
    const placeF = () => {
      let a = null;
      let b = null;
      const cupOf = (pred) => {
        const all = [...s.work.map((c, w) => c && { c, ref: { w } }), ...s.shelf.map((c, i) => c && { c, ref: { shelf: i } })].filter(Boolean);
        const hit = all.find(({ c }) => pred(c));
        return hit ? cupById(hit.c.id)?.el : null;
      };
      if (step === 'cup') a = st.rack;
      else if (step === 'tea') a = st['tea-' + def.teas[0]];
      else if (step === 'topping') a = st['top-' + def.toppings[0]];
      else if (step === 'seal') { a = cupOf((c) => !c.sealed && !c.sealingUntil); b = st['sealer-0']; }
      else if (step === 'serve') { a = cupOf((c) => c.sealed); const i = seats.findIndex((x) => x.uid != null && x.el.dataset.kind === 'normal'); b = i >= 0 ? { seat: i } : null; }
      else if (step === 'oke') { const i = seats.findIndex((x) => x.el.dataset.kind === 'oke'); a = i >= 0 ? { seat: i } : null; b = a; }
      if (!a || (step !== 'oke' && step !== 'cup' && step !== 'tea' && step !== 'topping' && !b)) { finger.hidden = true; return; }
      finger.hidden = false;
      const ra = a.seat != null ? seatHeadRect(a.seat) : rectIn(a);
      const rb = b ? (b.seat != null ? seatHeadRect(b.seat) : rectIn(b)) : null;
      finger.style.setProperty('--x0', `${ra.cx}px`);
      finger.style.setProperty('--y0', `${ra.cy}px`);
      if (step === 'oke') {
        finger.style.setProperty('--x0', `${ra.x}px`);
        finger.style.setProperty('--x1', `${ra.x + ra.w * 1.1}px`);
        finger.style.setProperty('--y1', `${ra.cy - ra.h * 0.2}px`);
        finger.className = 'finger swipe';
      } else if (rb) {
        finger.style.setProperty('--x1', `${rb.cx}px`);
        finger.style.setProperty('--y1', `${step === 'serve' ? rb.y + rb.h * 0.9 : rb.cy}px`);
        finger.className = 'finger drag';
      } else finger.className = 'finger tap';
    };
    placeF();
    guideTimer = setInterval(placeF, 400);
  }

  // ---- first-time 奧客: spotlight + a finger demo of the best gesture (the engine freezes the day meanwhile) ----
  let teachTimer = 0;
  function teach(ev) {
    clearInterval(teachTimer);
    stage.classList.toggle('teaching', !!ev);
    if (!ev) { spot.hidden = true; finger.hidden = true; finger.className = 'finger'; return; }
    const cls = { take: 'hold', gun: 'swipe', shut: 'taps' }[ev.key] || 'hold';
    const placeT = () => {
      const r = seatHeadRect(ev.slot);
      spot.hidden = false;
      spot.style.setProperty('--x', `${r.cx}px`);
      spot.style.setProperty('--y', `${r.cy}px`);
      spot.style.setProperty('--r', `${Math.max(r.w, r.h) * 0.62}px`);
      finger.hidden = false;
      finger.className = `finger teach ${cls}`;
      if (cls === 'swipe') {
        finger.style.setProperty('--x0', `${r.x}px`);
        finger.style.setProperty('--y0', `${r.cy}px`);
        finger.style.setProperty('--x1', `${r.x + r.w * 1.1}px`);
        finger.style.setProperty('--y1', `${r.cy - r.h * 0.2}px`);
      } else {
        finger.style.setProperty('--x0', `${r.cx}px`);
        finger.style.setProperty('--y0', `${r.cy}px`);
      }
    };
    placeT();
    teachTimer = setInterval(placeT, 400);
  }

  // ---- input ----
  let drag = null;        // { ref, id, x0, y0, moved, el, cup }
  const gestureSeat = new Map(); // pointer id → slot
  let firstInput = false;
  let tapSeat = null;
  const rec = createRecognizer({
    onGesture(e) {
      if (e.type === 'swipe') {
        const slot = gestureSeat.get(e.id);
        if (slot != null) { call('onAnswer', slot, 'gun', { speed: e.speed, dir: e.dir }); gestureSeat.delete(e.id); }
      } else if (e.type === 'tap') {
        const slot = tapSeat;
        if (slot != null && e.n === 3) call('onAnswer', slot, 'shut', { taps: e.n });
        if (slot != null && seats[slot] && seats[slot].uid != null) { const r = seatHeadRect(slot); floatNum('啪', r.cx + (e.n - 2) * 14 * K, r.y + r.h * 0.5, 'pa'); }
      } else if (e.type === 'holdStart') {
        const slot = gestureSeat.get(e.id);
        if (slot != null && seats[slot]) restart(seats[slot].el, 'holding');
      } else if (e.type === 'holdLevel' && e.level === 1) {
        const slot = gestureSeat.get(e.id);
        if (slot != null) { if (seats[slot]) seats[slot].el.classList.remove('holding'); call('onAnswer', slot, 'take', { holdMs: 300 }); gestureSeat.delete(e.id); }
      } else if (e.type === 'holdEnd') {
        const slot = gestureSeat.get(e.id);
        if (slot != null && seats[slot]) seats[slot].el.classList.remove('holding');
        gestureSeat.delete(e.id);
      }
    },
  });
  (function loop() { rec.tick(performance.now()); requestAnimationFrame(loop); })();

  function pt(e) { const sr = stage.getBoundingClientRect(); return { x: e.clientX - sr.left, y: e.clientY - sr.top }; }
  function hitTarget(x, y, ref) {
    const sr = stage.getBoundingClientRect();
    const els = document.elementsFromPoint(x + sr.left, y + sr.top);
    for (const n of els) {
      if (!n.closest) continue;
      const se = n.closest('.st-sealer');
      if (se) return { type: 'sealer', k: Number(se.dataset.k) };
      if (n.closest('.st-trash')) return { type: 'trash' };
      if (n.closest('.st-shelf') && ref && ref.w != null) return { type: 'shelf' };
      const seat = n.closest('.seat');
      if (seat) return { type: 'seat', slot: Number(seat.dataset.slot) };
    }
    // generous: anything dropped above the counter lip goes to the nearest counter spot
    if (y < (LIP_Y + 10) * K && seats.length) {
      let best = 0;
      let bd = Infinity;
      seats.forEach((se, i) => { const r = rectIn(se.el); const d = Math.abs(r.cx - x); if (d < bd) { bd = d; best = i; } });
      return { type: 'seat', slot: best };
    }
    return { type: null };
  }
  function tryLandscape() {
    // phones only: ask for full screen + landscape; any failure is fine (the stage plays either way)
    try {
      if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) return;
      const d = document.documentElement;
      const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : null;
      const lock = () => { try { const q = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (q && q.catch) q.catch(() => {}); } catch { /* unsupported */ } };
      if (p && p.then) p.then(lock, () => {}); else lock();
    } catch { /* unsupported */ }
  }

  app.addEventListener('pointerdown', () => { if (!firstInput) { firstInput = true; call('onFirstInput'); tryLandscape(); } }, { capture: true });
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.cards, .hud')) return;
    const p = pt(e);
    const cupE = e.target.closest('.cup');
    if (cupE && !cupE.classList.contains('sealing')) {
      e.preventDefault();
      const [kind, num] = [cupE.dataset.ref[0], Number(cupE.dataset.ref.slice(1))];
      drag = { ref: kind === 's' ? { shelf: num } : { w: num }, id: e.pointerId, x0: p.x, y0: p.y, moved: false, el: cupE };
      try { stage.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      return;
    }
    const seat = e.target.closest('.seat');
    if (seat) {
      e.preventDefault();
      const slot = Number(seat.dataset.slot);
      gestureSeat.set(e.pointerId, slot);
      tapSeat = slot;
      try { stage.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      rec.down(e.pointerId, e.clientX, e.clientY, performance.now());
      return;
    }
    const s2 = e.target.closest('.st');
    if (s2) {
      const act = s2.dataset.act;
      const arg = s2.dataset.arg;
      if (act === 'tea') call('onTea', arg);
      else if (act === 'topping') call('onTopping', arg);
      else if (act === 'ice') call('onIce');
      else if (act === 'sugar') call('onSugar');
      else if (act === 'take') call('onTake');
      else if (act === 'cook') call('onCook');
      return;
    }
    const lk = e.target.closest('.lock-spot');
    if (lk) { restart(lk, 'nudge'); return; }
    const ws = e.target.closest('.wslot');
    if (ws && lastState && !lastState.work[Number(ws.dataset.w)]) call('onTake');
  });
  stage.addEventListener('pointermove', (e) => {
    if (drag && e.pointerId === drag.id) {
      const p = pt(e);
      const dx = p.x - drag.x0;
      const dy = p.y - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 8) { drag.moved = true; drag.el.classList.add('dragging'); }
      if (drag.moved) drag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.1) rotate(${clamp(dx / 40, -6, 6).toFixed(1)}deg)`;
      return;
    }
    if (gestureSeat.has(e.pointerId)) rec.move(e.pointerId, e.clientX, e.clientY, performance.now());
  });
  function endPointer(e, cancel) {
    if (drag && e.pointerId === drag.id) {
      const d = drag;
      drag = null;
      const p = pt(e);
      d.el.classList.remove('dragging');
      d.el.style.transform = '';
      if (!d.moved) { if (d.ref.w != null) call('onSelect', d.ref.w); return; }
      if (cancel) return;
      const tgt = hitTarget(p.x, p.y, d.ref);
      call('onDrop', d.ref, tgt);
      // a served / trashed cup disappears where it was dropped (no slide back)
      if (tgt.type === 'seat' || tgt.type === 'trash') {
        for (const [, c] of cupEls) if (c.el === d.el) { c.gone = true; d.el.style.transform = `translate(${p.x - d.x0}px, ${p.y - d.y0}px) scale(.7)`; d.el.classList.add('vanish'); }
      }
      return;
    }
    if (gestureSeat.has(e.pointerId) || rec.active) {
      if (cancel) rec.cancel(e.pointerId, performance.now());
      else rec.up(e.pointerId, e.clientX, e.clientY, performance.now());
    }
  }
  stage.addEventListener('pointerup', (e) => endPointer(e, false));
  stage.addEventListener('pointercancel', (e) => endPointer(e, true));
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = { j: 'gun', k: 'shut', l: 'take' }[String(e.key).toLowerCase()];
    if (k && cards.hidden) { e.preventDefault(); call('onKey', k); }
  });

  // ---- rotate-your-phone card (portrait viewport) ----
  let rotateOk = false;
  function checkRotate() {
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    rotate.hidden = rotateOk || !portrait;
    app.classList.toggle('portrait', portrait);
  }
  function drawRotate() {
    rotate.innerHTML = `<div class="rot-card panel"><div class="ribbon"><span>${esc(T.title)}</span></div><div class="rot-icon">${rotateIconSVG()}</div><p>${esc(T.rotate.line)}</p><button class="btn-gold rot-go">${ICON.play}<span>${esc(T.rotate.play)}</span></button></div>`;
    rotate.querySelector('.rot-go').addEventListener('click', () => { rotateOk = true; checkRotate(); });
  }
  window.addEventListener('resize', checkRotate);
  try { screen.orientation && screen.orientation.addEventListener && screen.orientation.addEventListener('change', checkRotate); } catch { /* old browsers */ }

  // ---- cards (art: shop.css "cards"; chunky panels with a ribbon header, gold buttons, icons) ----
  function card(cls, html) {
    cards.innerHTML = '';
    const c = el('div', `card ${cls}`, html);
    cards.append(c);
    cards.hidden = false;
    return c;
  }
  function hideCards() { cards.innerHTML = ''; cards.hidden = true; }
  const ribbon = (txt) => `<div class="ribbon"><span>${esc(txt)}</span></div>`;

  function startCard({ day, hasSave, voice }, onStart, onFresh) {
    const c = card('start-card', `<div class="rays"></div><div class="logo">${logoSVG(lang)}</div><div class="start-btns">` +
      `<button class="btn-gold big go">${ICON.play}<span>${esc(hasSave && day > 1 ? fmt(T.cont, { n: day }) : T.start)}</span></button>` +
      (hasSave && day > 1 ? `<button class="btn-2 fresh">${ICON.restart}<span>${esc(T.fresh)}</span></button>` : '') + '</div>' +
      `<button class="tog lang" aria-label="language">${lang === 'zh' ? 'EN' : '中'}</button>`);
    c.querySelector('.go').addEventListener('click', () => onStart());
    const f = c.querySelector('.fresh');
    if (f) f.addEventListener('click', () => onFresh());
    c.querySelector('.lang').addEventListener('click', () => call('onToggleLang'));
    c.dataset.voice = voice ? '1' : '';
  }

  function newIcon(k) {
    if (k === 'black' || k === 'green' || k === 'jade') return `<i class="nc tank">${teaTankSVG(k)}</i>`;
    if (TOP_ORDER.includes(k)) return `<i class="nc tray">${toppingTraySVG(k, 10)}</i>`;
    if (k === 'ice') return `<i class="nc tray">${iceBinSVG()}</i>`;
    if (k === 'sugar') return `<i class="nc syrup">${syrupSVG()}</i>`;
    const it = { tea: 'black', toppings: ['pearl'], ice: 0, sugar: 0 };
    const it2 = { tea: 'green', toppings: ['pudding'], ice: 0, sugar: 0 };
    if (k === 'two') return `<i class="nc bub">${itemsBubbleSVG({ items: [it, it2] })}</i>`;
    if (k === 'three') return `<i class="nc bub">${itemsBubbleSVG({ items: [it, it2, { tea: 'jade', toppings: [], ice: 1, sugar: 1 }] })}</i>`;
    if (k === 'big') return `<i class="nc bub">${itemsBubbleSVG({ items: [it, it2, it, it2], big: true })}</i>`;
    const o = okeOf(k);
    if (o) return `<i class="nc oke"><span class="nc-head">${customerSVG({ id: o.cid }, 0, k === 'c250' ? { fixed: 'c250' } : {})}</span><span class="nc-bub">${okeBubbleSVG(o.prop)}</span><span class="nc-gest g-${o.best}">${GESTURE[o.best]}</span></i>`;
    return '';
  }
  function dayCard(d, _opts, onOpen) {
    const icons = (d.newStuff || []).map(newIcon).join('');
    const c = card('day-card', `<div class="panel dc-board">${ribbon(fmt(T.day, { n: d.n }))}` +
      `<div class="dc-goal"><small>${esc(T.goal)}</small><span class="dc-coin">${coinSVG()}</span><b>${money(d.goal)}</b><span class="dc-flag">${ICON.flag}</span></div>` +
      (icons ? `<div class="dc-new"><small>${esc(T.newToday)}</small><div class="dc-icons">${icons}</div></div>` : '') +
      `</div><button class="btn-gold big go">${ICON.play}<span>${esc(T.open)}</span></button>`);
    c.querySelector('.go').addEventListener('click', () => { hideCards(); onOpen(); });
  }

  function receipt(sum, { wallet }, onNext) {
    const Rw = T.rows;
    const row = (k, v, cls = '') => `<li class="${cls}"><span>${esc(k)}</span><i></i><b>${esc(v)}</b></li>`;
    const sales = sum.earned - sum.tips - sum.prepay;
    const fameD = sum.fame - sum.fameStart;
    const c = card('receipt-card', `<div class="receipt"><div class="rc-top"><div class="rc-logo">${logoSVG(lang)}</div>` +
      `<div class="rc-hd"><div class="rc-head">${esc(fmt(T.day, { n: sum.day }))} · ${esc(T.receiptTitle)}</div><div class="rc-no">NO.${String(sum.day).padStart(4, '0')} · 2:30</div></div></div><hr>` +
      `<div class="rc-big"><span class="dc-coin">${coinSVG()}</span><b>${money(sum.earned)}</b></div>` +
      `<div class="rc-goal ${sum.met ? 'met' : ''}">${esc(sum.met ? T.met : fmt(T.missed, { n: money(sum.goal - sum.earned) }))} <small>/ ${money(sum.goal)}</small></div>` +
      `<div class="rc-bar"><i style="width:${(clamp(sum.earned / sum.goal, 0, 1) * 100).toFixed(1)}%"></i></div>` +
      `<div class="rc-stars">${starRowSVG(sum.stars)}</div><hr><ul>` +
      row(Rw.sales, money(sales)) + row(Rw.tips, money(sum.tips)) + row(Rw.prepay, money(sum.prepay)) +
      row(Rw.cups, String(sum.sold), 'hot') + row(Rw.served, String(sum.orders)) + row(Rw.wrong, String(sum.wrong)) + row(Rw.walkouts, String(sum.walkouts)) +
      row(Rw.oke, String(sum.okeCursed + sum.normalCursed), 'hot') + row(Rw.fans, String(sum.fans)) +
      row(Rw.fame, `${fameD >= 0 ? '+' : ''}${fameD}`, 'hot') +
      `</ul><hr><div class="rc-wallet"><span>${esc(T.wallet)}</span><b>${money(wallet)}</b></div>` +
      `<div class="rc-stamp ${sum.met ? '' : 'miss'}">${sum.met ? '★' : '…'}</div></div>` +
      `<div class="rc-side"><div class="rc-tower">${towerHTML(sum.sold / 3)}</div><button class="btn-gold big go"><span>${esc(T.toShop)}</span>${ICON.arrow}</button></div>`);
    c.querySelectorAll('.rc-stars .star.on').forEach((s, i) => { s.style.animationDelay = `${380 + i * 140}ms`; s.classList.add('fill'); });
    c.querySelector('.go').addEventListener('click', () => onNext());
  }

  // upgrade icons: the actual equipment at that level
  function upIcon(stId, lv) {
    switch (stId) {
      case 'pot': return `<span class="ui-stack">${lv >= 3 ? potRigSVG(lv) : ''}${potSVG({ scoops: lv >= 2 ? 10 : 6, cookingPct: 0 })}</span>`;
      case 'tea': return lv >= 3 ? `<span class="ui-stack">${teaTankSVG('black', { fast: true })}<span class="ui-over">${teaManifoldSVG(1)}</span></span>` : teaTankSVG('black', { fast: lv >= 2 });
      case 'seal': return lv >= 4 ? shelfSVG(6, { autoSeal: true }) : lv >= 3 ? `<span class="ui-two">${sealerSVG('idle', { turbo: true })}${sealerSVG('idle', { turbo: true })}</span>` : sealerSVG('idle', { turbo: lv >= 2 });
      case 'prep': return `<span class="ui-two">${workSlotSVG()}${cupSVG({ tea: 'black', toppings: ['pearl'] })}</span>`;
      case 'shelf': return shelfSVG(lv >= 3 ? 6 : lv >= 2 ? 5 : 4);
      case 'ice': return lv >= 2 ? iceDispenserSVG() : iceBinSVG();
      case 'menu': return lv >= 3 ? goldenCardSVG() : toppingTraySVG('coconut', 10);
      case 'staff': return helperSVG(Math.max(1, lv - 1));
      case 'ticket': return ticketMachineSVG();
      case 'mega': return MEGAPHONE_SVG;
      case 'aircon': return acSVG();
      case 'sound': return speakerSVG();
      case 'neon': return `<svg viewBox="890 20 190 120" aria-hidden="true">${streetSVG({ neon: true }).match(/<g class="st-neon">.*?<\/g>/)[0]}</svg>`;
      case 'rail': return `<svg viewBox="0 0 120 90" aria-hidden="true"><path fill="none" stroke="#B42A1E" stroke-width="6" d="M20 30 Q60 52 100 30"/><path fill="#BCC3CE" stroke="#4A2C1C" stroke-width="3" d="M16 24 h8 v58 h-8 Z M96 24 h8 v58 h-8 Z"/><path fill="#737C8C" d="M6 84 h28 v4 h-28 Z M86 84 h28 v4 h-28 Z"/></svg>`;
      case 'seat': return `<span class="ui-head">${customerSVG({ id: 12 }, 3)}</span>`;
      default: return '';
    }
  }
  let shopTab = 'equip';
  function upgradeShop(save, { nextDay, retry }, onBuy, onGo) {
    let shownWallet = save.wallet;
    const draw = (sv, justBought) => {
      const tabs = TABS.map((tb) => `<button class="sc-tab${tb === shopTab ? ' on' : ''}" data-tab="${tb}">${esc(T.tabs[tb])}</button>`).join('');
      const items = STATIONS.filter((x) => x.tab === shopTab).map((sta) => {
        const have = levelOf(sv.upgrades, sta.id);
        const nx = nextLevel(sv.upgrades, sta.id);
        const total = sta.levels.length;
        const single = total === 1;
        const pips = Array.from({ length: total + (single ? 0 : 1) }, (_, i) => `<i class="pip${i < have + (single ? 0 : 1) ? ' on' : ''}${nx && i === have + (single ? 0 : 1) ? ' next' : ''}"></i>`).join('');
        const can = nx && canBuy(nx.id, sv.upgrades, sv.wallet);
        const cur = single ? 0 : have + 1;
        const [name, eff] = nx ? T.upgrades[nx.id] : T.upgrades[sta.levels[total - 1].id];
        const lvRow = single ? '' : nx
          ? `<span class="up-lv"><em>${esc(fmt(T.lv, { n: cur }))}</em>${ICON.arrow}<em class="nx">${esc(fmt(T.lv, { n: nx.lv }))}</em></span>`
          : `<span class="up-lv"><em class="nx">${esc(fmt(T.lv, { n: total + 1 }))}</em></span>`;
        const btn = nx ? `<button class="up-buy" data-id="${nx.id}" ${can ? '' : 'disabled'}>${can ? '' : `<span class="up-lock">${lockBadgeSVG()}</span>`}<span class="dc-coin">${coinSVG()}</span>${money(nx.cost)}</button>`
          : `<span class="up-max">${ICON.check}<span>${esc(single ? T.owned : T.max)}</span></span>`;
        return `<li class="up ${!nx ? 'owned' : can ? 'can' : 'cant'}${justBought === sta.id ? ' bought' : ''}" data-station="${sta.id}"><span class="up-ic">${upIcon(sta.id, nx ? nx.lv : total + 1)}</span>` +
          `<span class="up-txt"><small class="up-st">${esc(T.stations[sta.id])}</small>${lvRow}<b>${esc(name)}</b><small class="up-eff">${esc(eff)}</small><span class="pips">${pips}</span></span>${btn}</li>`;
      }).join('');
      const c = card('shop-card', `<div class="panel sc-panel">${ribbon(T.shopTitle)}<div class="sc-head"><div class="sc-tabs">${tabs}</div><div class="sc-wallet"><span class="dc-coin">${coinSVG()}</span><b>${money(shownWallet)}</b></div></div>` +
        `<ul class="ups">${items}</ul></div><button class="btn-gold big go">${ICON.play}<span>${esc(fmt(retry ? T.retry : T.next, { n: nextDay }))}</span></button>`);
      c.querySelectorAll('.sc-tab').forEach((b) => b.addEventListener('click', () => { shopTab = b.dataset.tab; draw(sv); }));
      c.querySelectorAll('.up.can .up-buy').forEach((b) => b.addEventListener('click', () => {
        const from = rectIn(b);
        const stId = b.closest('.up').dataset.station;
        const res = onBuy(b.dataset.id);
        if (res && res.ok) {
          const before = shownWallet;
          draw(res.save, stId);
          buyFx(from, before, res.save.wallet);
          shownWallet = res.save.wallet;
        }
      }));
      c.querySelector('.go').addEventListener('click', () => { hideCards(); onGo(); });
    };
    // the purchase: coins burst out of the price button, the wallet ticks down, the bought card's icon bounces
    const buyFx = (from, a, b) => {
      for (let i = 0; i < 8; i++) {
        const p = el('div', 'coin-fly buy', coinSVG());
        p.style.left = `${from.cx}px`;
        p.style.top = `${from.cy}px`;
        cards.append(p);
        const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
        const d = (50 + Math.random() * 40) * K;
        const an = p.animate ? p.animate([
          { transform: 'translate(0,0) scale(.5)', opacity: 1 },
          { transform: `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d - 30 * K}px) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${Math.cos(ang) * d * 1.2}px, ${Math.sin(ang) * d + 40 * K}px) scale(.6)`, opacity: 0 },
        ], { duration: 620, easing: 'cubic-bezier(.2,.7,.4,1)' }) : null;
        if (an) an.onfinish = () => p.remove(); else setTimeout(() => p.remove(), 640);
      }
      const wb = cards.querySelector('.sc-wallet b');
      const t0 = performance.now();
      const tick = () => {
        const e = clamp((performance.now() - t0) / 500, 0, 1);
        if (wb && wb.isConnected) wb.textContent = money(a + (b - a) * e);
        if (e < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      restart(cards.querySelector('.sc-wallet'), 'bump');
    };
    draw(save);
  }

  function endCard(onAgain) {
    const c = card('day-card', `<div class="panel dc-board">${ribbon(T.title)}<div class="logo">${logoSVG(lang)}</div><p class="dc-end">${esc(T.end)}</p></div><button class="btn-gold big go">${ICON.play}<span>${esc(fmt(T.next, { n: 6 }))}</span></button>`);
    c.querySelector('.go').addEventListener('click', () => { hideCards(); onAgain(); });
  }

  function pauseSheet({ muted }, acts) {
    const c = card('pause-card', `<div class="panel pc-panel">${ribbon(T.pause.title)}<button class="btn-gold big resume">${ICON.resume}<span>${esc(T.pause.resume)}</span></button>` +
      `<div class="pause-row"><button class="btn-2 tog lang">${ICON.globe}<span>${esc(T.pause.lang)}</span></button><button class="btn-2 tog mute">${muted ? ICON.sound : ICON.mute}<span>${esc(muted ? T.pause.unmute : T.pause.mute)}</span></button></div>` +
      `<div class="pause-row"><button class="btn-2 close">${ICON.shutter}<span>${esc(T.pause.close)}</span></button><button class="btn-2 restart">${ICON.restart}<span>${esc(T.pause.restart)}</span></button></div></div>`);
    c.querySelector('.resume').addEventListener('click', () => { hideCards(); acts.resume(); });
    c.querySelector('.lang').addEventListener('click', () => acts.lang());
    c.querySelector('.mute').addEventListener('click', () => acts.mute());
    c.querySelector('.close').addEventListener('click', () => { hideCards(); acts.close(); });
    c.querySelector('.restart').addEventListener('click', () => { hideCards(); acts.restart(); });
  }

  function voicePrompt(onAllow, onNo) {
    const c = card('voice-card', `<div class="panel vc-panel">${ribbon(T.voice.title)}<div class="vc-body"><div class="mic">${ICON.mic}</div><div class="vc-txt"><p>${esc(T.voice.ask)}</p><p class="small">${esc(T.voice.privacy)}</p>` +
      `<div class="vc-btns"><button class="btn-gold allow">${esc(T.voice.allow)}</button><button class="btn-2 no">${esc(T.voice.no)}</button></div></div></div></div>`);
    c.querySelector('.allow').addEventListener('click', () => { hideCards(); onAllow(); });
    c.querySelector('.no').addEventListener('click', () => { hideCards(); onNo(); });
  }

  hideCards();
  drawRotate();
  checkRotate();
  return {
    stage,
    build,
    render,
    onEvent,
    say,
    guide,
    teach,
    startCard, dayCard, receipt, upgradeShop, endCard, pauseSheet, voicePrompt, hideCards,
    setLang(l) {
      lang = l === 'en' ? 'en' : 'zh';
      T = shopText(lang);
      stage.lang = lang === 'en' ? 'en' : 'zh-Hant-TW';
      document.documentElement.lang = stage.lang;
      drawRotate();
    },
    where(name) {
      let e = st[name];
      if (name === 'sealer') e = st['sealer-0'];
      if (name === 'shelfArea') e = st.shelf;
      let r = null;
      if (!e && name.startsWith('cup-') && lastState) { const cup = lastState.work[Number(name.slice(4))]; e = cup && cupById(cup.id)?.el; }
      if (!e && name.startsWith('shelf-') && lastState) { const cup = lastState.shelf[Number(name.slice(6))]; e = cup && cupById(cup.id)?.el; }
      if (!e && name.startsWith('seat-')) {
        const i = Number(name.slice(5));
        if (!seats[i]) return null;
        const hr = seatHeadRect(i);
        const sr = stage.getBoundingClientRect();
        r = { x: sr.left + hr.cx, y: sr.top + hr.cy, w: hr.w, h: hr.h };
        return r;
      }
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height };
    },
  };
}
