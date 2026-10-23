// ui.js — gameplay v3 shop screen, landscape (docs/gameplay-v3-shop.md 10): a 16:9 stage (design 1280×720, layout.js),
// the camera behind the counter looking out. Top: the night street, customers walking in from the far corner, the line,
// the counter spots (bubbles, patience rings, gestures). Bottom: the work table with every station (art-shop.js), the
// shelf, the cup tower, the part-timer. DOM rendering, pointer input (taps on stations, cup drags, gestures on customers
// through src/gesture.js, J/K/L keys), juice, the day 1 finger guide, cards (start, day, receipt, upgrade shop, pause,
// voice prompt, rotate-your-phone). Layout and look: shop.css. No game rules here: main.js owns the engine and calls
// render(state) every frame and onEvent(ev) per event.
//
//   createShopUI(root, handlers) → ui
//     handlers: onTake(), onTea(kind), onTopping(kind), onIce(), onSugar(), onCook(), onSelect(w),
//               onDrop(ref, { type: 'sealer'|'shelf'|'seat'|'trash'|null, slot }), ref = { w } | { shelf },
//               onAnswer(slot, key, info), onKey(key), onPause(), onFirstInput(), onToggleLang()
//     ui.build(shop)            stations, slots, shelf, seats and the upgrade props for today's menu / upgrades
//     ui.render(state)          per frame: HUD, walkers (interpolated from the engine's street positions), bubbles,
//                               patience rings, cups, sealers, pot, helper, cup tower
//     ui.onEvent(ev, ctx)       visuals of one engine event
//     ui.say(text, who, key)    a subtitle (clerk lines get the '|' punch half big in the key colour)
//     ui.guide(step, state)     the finger demo for a guide step (null hides it)
//     ui.dayCard / receipt / upgradeShop / startCard / pauseSheet / voicePrompt / endCard  (cards; resolve via callbacks)
//     ui.where(name)            viewport centre of a part (tools): 'rack' | 'tea-<k>' | 'top-<k>' | 'sealer' | 'sealer-1' |
//                               'shelfArea' | 'trash' | 'pot' | 'ice' | 'sugar' | 'cup-<w>' | 'shelf-<i>' | 'seat-<i>'
import {
  cupSVG, teaTankSVG, toppingTraySVG, iceBinSVG, syrupSVG, sealerSVG, potSVG, cupRackSVG, trashSVG, workSlotSVG,
  orderBubbleSVG, coinSVG, patienceRingSVG, tableSVG, shelfSVG, itemsBubbleSVG, teaManifoldSVG, iceDispenserSVG, potRigSVG,
  goldenCardSVG,
} from './art-shop.js';
import { streetSVG, cornerSVG, awningSVG, walkerSVG, helperSVG, acSVG, speakerSVG, ticketMachineSVG, rotateIconSVG } from './art-street.js';
import { customerSVG, FINGER_SVG, CLERK_SVG, logoSVG, cupStackSVG, MEGAPHONE_SVG } from '../art.js';
import { createRecognizer } from '../gesture.js';
import { okeBubbleSVG, STAMP_SVG, starRowSVG } from './oke-art.js';
import { okeOf } from './oke.js';
import { STATIONS, TABS, levelOf, nextLevel, canBuy } from './upgrades.js';
import { shopText, fmt } from './text.js';
import { STAGE, LIP_Y, PERSON, PILLAR, streetPoint, seatPoint, seatColumn, stepPoint, stations as stationRects } from './layout.js';

const TOP_ORDER = ['pearl', 'pudding', 'grass', 'coconut'];
const KEY_COLOR = { gun: 'var(--gun)', shut: 'var(--shut)', take: 'var(--lemon)' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const stripDir = (s) => String(s ?? '').replace(/（[^（）]*）/g, '').replace(/\([^()]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
const money = (n) => Math.round(n).toLocaleString('en-US');
const cq = (v) => `${(v * 100 / STAGE.w).toFixed(3)}cqw`; // design px → container units
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// the cup tower at a fixed cup size: its svg is as wide as its bottom row (art.js cupStackSVG, at most 5 cups = 89 units)
const towerHTML = (n) => { const k = clamp(Math.floor(n), 0, 9); const w = Math.max(1, Math.ceil(k / 2)) * 17 + 4; return cupStackSVG(k).replace('<svg ', `<svg style="width:${((w / 89) * 92).toFixed(1)}%" `); };

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
  const walkersEl = el('div', 'walkers');
  const corner = el('div', 'corner', cornerSVG());
  const awning = el('div', 'awning', awningSVG());
  const pillar = el('div', 'pillar');
  place(pillar, PILLAR, PILLAR.h);
  const seatsEl = el('div', 'seats');
  const counter = el('div', 'counter');
  counter.innerHTML = `<div class="lip"></div><div class="table">${tableSVG()}</div>`;
  const cupsEl = el('div', 'cups');
  shaker.append(street, walkersEl, corner, awning, pillar, seatsEl, counter);
  counter.append(cupsEl);
  const fx = el('div', 'fx');
  const clerkCut = el('div', 'clerk-cut', CLERK_SVG);
  const subs = el('div', 'subs');
  const finger = el('div', 'finger', FINGER_SVG);
  finger.hidden = true;
  const hud = el('div', 'hud');
  hud.innerHTML = `<button class="hud-pause" aria-label="pause"><i></i><i></i></button>` +
    `<div class="hud-money"><span class="hud-coin">${coinSVG()}</span><b class="hud-num">0</b><i class="hud-goal"><i></i></i></div>` +
    `<div class="hud-stars"></div><div class="hud-timer"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" class="ht-bg"/>` +
    `<circle cx="20" cy="20" r="16" class="ht-arc" pathLength="100" stroke-dasharray="100 100" transform="rotate(-90 20 20)"/></svg><b class="ht-num"></b></div>`;
  const cards = el('div', 'cards');
  stage.append(fx, clerkCut, subs, finger, hud, cards);
  const rotate = el('div', 'rotate');
  rotate.hidden = true;
  app.append(rotate);
  const hudNum = hud.querySelector('.hud-num');
  const hudGoal = hud.querySelector('.hud-goal > i');
  const hudStars = hud.querySelector('.hud-stars');
  const htArc = hud.querySelector('.ht-arc');
  const htNum = hud.querySelector('.ht-num');
  const hudTimer = hud.querySelector('.hud-timer');
  hud.querySelector('.hud-pause').addEventListener('click', () => call('onPause'));

  // stage scale (design px → screen px), kept current on resize
  let K = 1;
  const measure = () => { K = (stage.clientWidth || STAGE.w) / STAGE.w; };
  measure();
  try { new ResizeObserver(measure).observe(stage); } catch { window.addEventListener('resize', measure); }

  let seats = [];      // [{ el, bubble, ring, uid, key, pct }]
  let wslots = [];     // work slot elements
  let st = {};         // station elements by name
  let R = {};          // station rects (design px)
  let cupEls = new Map(); // cup id → { el, key, ref }
  const walkers = new Map(); // customer uid → { el, inner, kind, leaving }
  let lastStars = 0;
  let lastMoney = null;
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

  function build(shop) {
    const s = shop.state;
    cfg = shop.cfg;
    def = shop.def;
    counter.querySelectorAll('.st, .wslot, .prop').forEach((n) => n.remove());
    pillar.innerHTML = '';
    cupsEl.innerHTML = '';
    cupEls = new Map();
    walkersEl.innerHTML = '';
    walkers.clear();
    st = {};
    const tops = TOP_ORDER.filter((k) => def.toppings.includes(k) || (k === 'coconut' && cfg.coconut));
    R = stationRects({ teas: def.teas, toppings: tops, ice: def.ice, sugar: def.sugar, workSlots: s.work.length, shelf: s.shelf.length, sealers: cfg.sealers });
    stage.dataset.seats = String(s.slots.length);
    street.innerHTML = streetSVG({ neon: cfg.fameMult > 1, rail: cfg.queueBonus > 0 });
    // back row
    st.rack = station('st-rack', cupRackSVG(), 'take', null, R.rack);
    const fast = cfg.pourMs < 600;
    def.teas.forEach((k) => { st['tea-' + k] = station('st-tea', teaTankSVG(k, { fast }), 'tea', k, R['tea-' + k]); });
    if (cfg.teaAll) {
      const xs = def.teas.map((k) => R['tea-' + k]);
      const x0 = xs[0].x;
      const x1 = xs[xs.length - 1].x + xs[xs.length - 1].w;
      const m = el('div', 'prop manifold', teaManifoldSVG(def.teas.length));
      place(m, { x: x0, y: 336, w: x1 - x0 });
      counter.insertBefore(m, cupsEl);
    }
    wslots = s.work.map((_, w) => {
      const r = R['slot-' + w];
      const e = el('div', 'wslot', `<div class="plate">${workSlotSVG()}</div>`);
      e.dataset.w = String(w);
      place(e, r, r.h);
      counter.insertBefore(e, cupsEl);
      return e;
    });
    for (let k = 0; k < cfg.sealers; k++) {
      const e = station('st-sealer', sealerSVG('idle', { turbo: cfg.sealMs < 800 }), 'sealer', String(k), R['sealer-' + k]);
      e.dataset.k = String(k);
      e.insertAdjacentHTML('beforeend', '<i class="seal-bar"><i></i></i>');
      st['sealer-' + k] = e;
    }
    st.shelf = station('st-shelf', shelfSVG(s.shelf.length, { autoSeal: cfg.autoSeal }), 'shelf', null, R.shelf);
    // front row
    if (cfg.cookMs < 8000 || cfg.autoCook) {
      const rig = el('div', 'prop pot-rig', potRigSVG(cfg.autoCook ? 4 : 3));
      place(rig, R.pot);
      counter.insertBefore(rig, cupsEl);
    }
    st.pot = station(`st-pot${cfg.potMax > 10 ? ' big' : ''}`, potSVG({ scoops: Math.min(10, s.pot.scoops), cookingPct: 0 }), 'cook', null, R.pot);
    tops.forEach((k) => { st['top-' + k] = station('st-top', toppingTraySVG(k, 10), 'topping', k, R['top-' + k]); st['top-' + k].dataset.kind = k; });
    if (def.ice) st.ice = station('st-ice', cfg.iceSmart ? iceDispenserSVG() : iceBinSVG(), 'ice', null, R.ice);
    if (def.sugar) st.sugar = station('st-syrup', syrupSVG(), 'sugar', null, R.sugar);
    st.tower = station('st-tower', '', null, null, R.tower);
    if (cfg.golden) { const g = el('div', 'prop golden-card', goldenCardSVG()); place(g, { x: R.tower.x - 4, y: R.tower.y + 70, w: 66 }); counter.insertBefore(g, cupsEl); }
    st.trash = station('st-trash', trashSVG(), 'trash', null, R.trash);
    if (cfg.helperMs) {
      st.helper = station('st-helper', helperSVG(cfg.helperMs < 8000 ? 2 : 1) + '<div class="helper-cup"></div><i class="helper-bar"><i></i></i>', null, null, R.helper);
    }
    // the window pillar: decoration upgrades
    pillar.innerHTML = (cfg.patienceMult > 1 ? `<div class="pp pp-ac">${acSVG()}</div>` : '') +
      (cfg.tipMult > 1 ? `<div class="pp pp-speaker">${speakerSVG()}</div>` : '') +
      (cfg.megaphone ? `<div class="pp pp-mega">${MEGAPHONE_SVG}</div>` : '') +
      (cfg.prepayMult > 1 ? `<div class="pp pp-ticket">${ticketMachineSVG()}</div>` : '');
    // counter spots: bubble, ring, the gesture column
    seatsEl.innerHTML = '';
    seats = s.slots.map((_, i) => {
      const col = seatColumn(i, s.slots.length);
      const e = el('div', 'seat');
      e.dataset.slot = String(i);
      place(e, { x: col.x, y: 0, w: col.w }, LIP_Y);
      e.innerHTML = '<div class="bubble"></div><div class="ring"></div><div class="hit"></div>';
      seatsEl.append(e);
      return { el: e, bubble: e.querySelector('.bubble'), ring: e.querySelector('.ring'), uid: null, key: '', pct: -1 };
    });
    lastStars = 0; lastMoney = null; lastTower = -1;
    stage.dataset.helper = cfg.helperMs ? '1' : '';
    render(s);
  }

  // ---- walkers ----
  function walkerEl(c) {
    const e = el('div', 'walker');
    e.dataset.uid = String(c.uid);
    e.dataset.kind = c.kind === 'oke' ? 'oke' : 'normal';
    const tag = c.kind === 'oke' ? `<div class="wk-tag">${okeBubbleSVG(okeOf(c.oke).prop)}</div>` : '';
    e.innerHTML = `<div class="wk-inner">${walkerSVG({ cid: c.cid, visit: c.visit || 0, fixed: c.oke === 'c250' ? 'c250' : undefined, oke: c.oke })}${tag}</div>`;
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
      // the cut-in customer squeezes past on the road side; people in line stand a little off a straight line
      const lane = c.cut && c.phase === 'walk' ? 0.9 : ((c.uid % 3) - 1) * 0.14;
      setPos(w, streetPoint(c.u, lane), clamp((c.u - 0.42) / 0.3, 0, 1));
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
    // anyone no longer in the state walks away (closing time, or a leave event already started it)
    const now = performance.now();
    for (const [uid, w] of walkers) {
      if (seen.has(uid) && !w.leaving) continue;
      if (!w.leaving) startLeave(w, 'walk');
      const L = w.leaving;
      const t = now - L.t0;
      if (L.kind === 'fly') { if (t > 700) { w.el.remove(); walkers.delete(uid); } continue; }
      // walk back into the distance on the road-side lane: first out to the street, then toward the corner
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
    w.leaving = { kind, t0: performance.now(), from: w.pos || streetPoint(0) };
    w.el.classList.remove('oke-live');
    if (reason) w.el.dataset.exit = reason;
    if (kind === 'walk') { setMode(w, 'walk'); w.el.classList.add('leaving'); }
  }

  // ---- seats (bubbles, rings) ----
  function seatKey(c) { return c ? `${c.uid}|${c.kind}|${c.converted ? 1 : 0}|${(c.got || []).map((g) => (g ? 1 : 0)).join('')}` : ''; }
  function renderSeats(s) {
    s.slots.forEach((c, i) => {
      const se = seats[i];
      if (!se) return;
      const key = seatKey(c);
      if (key !== se.key) {
        const fresh = !c || !se.key || se.key.split('|')[0] !== key.split('|')[0];
        se.key = key;
        se.uid = c ? c.uid : null;
        se.el.dataset.kind = !c ? '' : c.kind === 'oke' && !c.converted ? 'oke' : 'normal';
        se.el.classList.toggle('double', !!(c && c.doublePay));
        se.bubble.innerHTML = !c ? '' : c.kind === 'oke' && !c.converted ? okeBubbleSVG(okeOf(c.oke).prop) : itemsBubbleSVG(c.order, c.got);
        se.bubble.dataset.n = c && c.order ? String(c.order.count) : '1';
        se.pct = -1;
        if (!c || (c.kind === 'oke' && !c.converted)) se.ring.innerHTML = '';
        if (c && fresh) { se.bubble.classList.remove('pop'); void se.bubble.offsetWidth; se.bubble.classList.add('pop'); }
      }
      if (c && !(c.kind === 'oke' && !c.converted)) {
        const pct = Number.isFinite(c.patienceMax) ? Math.max(0, c.patience / c.patienceMax) : 1;
        const q = Math.round(pct * 50) / 50;
        if (q !== se.pct) { se.pct = q; se.ring.innerHTML = patienceRingSVG(q); se.el.classList.toggle('hurry', q < 0.3); }
      } else se.el.classList.remove('hurry');
    });
  }

  // ---- cups ----
  function cupPlace(ref, cup) {
    if (ref.shelf != null) {
      const r = R['shelf-' + ref.shelf];
      const w = Math.min(60, r.w * 0.62);
      return { x: r.x + r.w / 2, y: r.y + 88, w };
    }
    if (cup.sealingUntil && !cup.sealed && cup.sealer >= 0 && R['sealer-' + cup.sealer]) {
      const r = R['sealer-' + cup.sealer];
      return { x: r.x + r.w * 0.5, y: r.y + r.w * (136 / 110), w: r.w * 0.52 };
    }
    const r = R['slot-' + ref.w];
    const w = Math.min(90, r.w * 0.68);
    const plateH = r.w * 0.92 * 0.5;
    return { x: r.x + r.w / 2, y: r.y + r.h - plateH * 0.42, w };
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

  // ---- per frame ----
  function render(s) {
    lastState = s;
    const m = Math.round(s.earned);
    if (m !== lastMoney) {
      hudNum.textContent = money(m);
      lastMoney = m;
      hudGoal.style.width = `${clamp(m / s.def.goal, 0, 1) * 100}%`;
      hud.classList.toggle('goal-met', m >= s.def.goal);
    }
    if (s.stars !== lastStars) { hudStars.innerHTML = starRowSVG(s.stars); lastStars = s.stars; stage.dataset.stars = String(s.stars); }
    const left = Math.max(0, s.length - s.clock);
    const sec = Math.ceil(left / 1000);
    htNum.textContent = s.phase === 'guide' ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    htArc.setAttribute('stroke-dasharray', `${(left / s.length) * 100} 100`);
    hudTimer.classList.toggle('late', s.phase === 'open' && left < 15000);
    hud.classList.toggle('guide', s.phase === 'guide');
    renderWalkers(s);
    renderSeats(s);
    renderCups(s);
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
      const shown = Math.ceil((s.pot.scoops / s.pot.max) * 10);
      const key = `${shown}|${Math.round(pct * 20)}`;
      if (st.pot.dataset.key !== key) {
        st.pot.dataset.key = key;
        st.pot.querySelector('svg').outerHTML = potSVG({ scoops: shown, cookingPct: s.pot.cookingUntil ? Math.max(0.02, pct) : 0 });
        st.pot.classList.toggle('empty', s.pot.scoops === 0 && !s.pot.cookingUntil);
        const tray = st['top-pearl'];
        if (tray) { tray.querySelector('svg').outerHTML = toppingTraySVG('pearl', shown); tray.classList.toggle('empty', s.pot.scoops === 0); }
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
      lastTower = tower;
      st.tower.innerHTML = towerHTML(tower);
      st.tower.classList.remove('grow'); void st.tower.offsetWidth; st.tower.classList.add('grow');
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
    shaker.style.setProperty('--sh', `${px}px`);
    shaker.classList.remove('shake');
    void shaker.offsetWidth;
    shaker.classList.add('shake');
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
  function coinsFly(from, n = 3) {
    const to = rectIn(hud.querySelector('.hud-coin'));
    for (let i = 0; i < n; i++) {
      const c = el('div', 'coin-fly', coinSVG());
      c.style.left = `${from.cx}px`;
      c.style.top = `${from.cy}px`;
      fx.append(c);
      const dx = to.cx - from.cx;
      const dy = to.cy - from.cy;
      setTimeout(() => { c.style.transform = `translate(${dx}px, ${dy}px) scale(.6)`; c.style.opacity = '.4'; }, 30 + i * 70);
      setTimeout(() => c.remove(), 700 + i * 70);
    }
    setTimeout(() => { hud.classList.remove('bump'); void hud.offsetWidth; hud.classList.add('bump'); }, 520);
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
  let clerkT = 0;
  function clerkPop(key) {
    const svg = clerkCut.querySelector('svg');
    clearTimeout(clerkT);
    clerkCut.className = `clerk-cut on k-${key}`;
    svg.dataset.mood = 'hit';
    clerkT = setTimeout(() => {
      svg.dataset.mood = 'perfect';
      clerkT = setTimeout(() => { clerkCut.className = 'clerk-cut'; svg.dataset.mood = 'idle'; }, 650);
    }, 700);
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

  let subT = 0;
  function say(text, who = 'clerk', key = 'gun') {
    clearTimeout(subT);
    const raw = String(text || '');
    if (!stripDir(raw.replace(/\|/g, ''))) { subs.innerHTML = ''; return; }
    if (who === 'clerk') {
      const i = raw.indexOf('|');
      const setup = i < 0 ? '' : stripDir(raw.slice(0, i));
      const punch = stripDir(i < 0 ? raw : raw.slice(i + 1).replace(/\|/g, ''));
      subs.innerHTML = `<div class="sub clerk">${setup ? `<span class="setup">${esc(setup)}</span>` : ''}<b class="punch" style="color:${KEY_COLOR[key] || 'var(--text)'}">${esc(punch)}</b></div>`;
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
          if (ev.reason === 'take') { stampOn(ev.slot); w.el.classList.add('ticket'); }
          if (ev.reason === 'timeout') w.el.classList.add('sad');
          startLeave(w, 'walk', ev.reason);
        }
        break;
      }
      case 'answer': {
        if (ev.key === 'shut' && !ev.normal) {
          const w = walkers.get(ev.cust.uid);
          if (w) { w.el.classList.remove('squash'); void w.el.offsetWidth; w.el.classList.add('squash'); }
          const r = seatHeadRect(ev.slot);
          burst(r.cx, r.cy, 'pearl', 3);
          shake(4);
        }
        clerkPop(ev.key);
        const r = seatHeadRect(ev.slot);
        if (ev.prepay) { floatNum(`+${ev.prepay}`, r.cx, r.y + r.h * 0.2, 'gold'); coinsFly({ cx: r.cx, cy: r.y + r.h * 0.4 }, 5); }
        if (ev.best) { stage.classList.remove('laugh'); void stage.offsetWidth; stage.classList.add('laugh'); }
        break;
      }
      case 'fans': {
        for (const uid of ev.uids || []) {
          const w = walkers.get(uid);
          if (w && ev.why === 'star' && uid === ev.uids[0]) w.el.classList.add('sign');
        }
        corner.classList.remove('surge'); void corner.offsetWidth; corner.classList.add('surge');
        break;
      }
      case 'serve': {
        const r = seatHeadRect(ev.slot);
        if (ev.correct) {
          if (!ev.done && seats[ev.slot]) { const b = seats[ev.slot].bubble; b.classList.remove('tickpop'); void b.offsetWidth; b.classList.add('tickpop'); }
        } else {
          const w = walkers.get(ev.cust.uid);
          if (w) { w.el.classList.remove('wobble'); void w.el.offsetWidth; w.el.classList.add('wobble'); }
          say(t.complaints[Math.floor(Math.random() * t.complaints.length)], 'cust', 'shut');
        }
        break;
      }
      case 'pay': {
        const r = seatHeadRect(ev.slot);
        floatNum(`+${ev.pay + ev.tip}`, r.cx, r.y + r.h * 0.2, ev.wrong ? 'dim' : '');
        coinsFly({ cx: r.cx, cy: r.y + r.h * 0.4 }, ev.tip > 0 ? 3 : 2);
        break;
      }
      case 'tea': {
        renderCupsNow();
        const c = lastState && lastState.work[ev.w] && cupById(lastState.work[ev.w].id);
        if (c) { c.el.classList.remove('pour'); void c.el.offsetWidth; c.el.classList.add('pour'); }
        if (st['tea-' + ev.kind]) press(st['tea-' + ev.kind]);
        break;
      }
      case 'topping': if (st['top-' + ev.kind]) press(st['top-' + ev.kind]); bounceCup(ev.w); break;
      case 'ice': if (st.ice) press(st.ice); bounceCup(ev.w); break;
      case 'sugar': if (st.sugar) press(st.sugar); bounceCup(ev.w); break;
      case 'cup': press(st.rack); break;
      case 'sealStart': if (ev.shelf) press(st.shelf); else press(st['sealer-' + (ev.sealer || 0)]); break;
      case 'sealed': {
        shake(3);
        const e = ev.shelf != null ? st.shelf : st['sealer-' + (ev.sealer || 0)];
        if (e) { const r = rectIn(e); floatNum('喀', r.cx, r.y + r.h * 0.3, 'kaa'); }
        break;
      }
      case 'helperCup': if (st.helper) press(st.helper); break;
      case 'trash': press(st.trash); break;
      case 'cookStart': press(st.pot); break;
      case 'star': {
        stage.classList.remove('starup'); void stage.offsetWidth; stage.classList.add('starup');
        break;
      }
      case 'nope': {
        const target = ev.reason === 'potEmpty' ? st.pot : ev.reason === 'noCup' || ev.reason === 'noSlot' ? st.rack
          : ev.reason === 'sealerBusy' ? st['sealer-0'] : ev.reason === 'shelfFull' ? st.shelf : null;
        if (target) { target.classList.remove('nudge'); void target.offsetWidth; target.classList.add('nudge'); }
        break;
      }
      case 'refuse': {
        const w = walkers.get(ev.cust.uid);
        if (w) { w.el.classList.remove('wobble'); void w.el.offsetWidth; w.el.classList.add('wobble'); }
        break;
      }
      default: break;
    }
  }
  function renderCupsNow() { if (lastState) renderCups(lastState); }
  function press(e) { if (!e) return; e.classList.remove('press'); void e.offsetWidth; e.classList.add('press'); }
  function bounceCup(w) {
    renderCupsNow();
    const cup = lastState && lastState.work[w];
    const c = cup && cupById(cup.id);
    if (c) { c.el.classList.remove('bounce'); void c.el.offsetWidth; c.el.classList.add('bounce'); }
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
        if (slot != null && seats[slot]) seats[slot].el.classList.add('holding');
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
    const ws = e.target.closest('.wslot');
    if (ws && lastState && !lastState.work[Number(ws.dataset.w)]) call('onTake');
  });
  stage.addEventListener('pointermove', (e) => {
    if (drag && e.pointerId === drag.id) {
      const p = pt(e);
      const dx = p.x - drag.x0;
      const dy = p.y - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 8) { drag.moved = true; drag.el.classList.add('dragging'); }
      if (drag.moved) drag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
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
      const before = lastState;
      call('onDrop', d.ref, tgt);
      // a served / trashed cup disappears where it was dropped (no slide back)
      if (tgt.type === 'seat' || tgt.type === 'trash') {
        for (const [, c] of cupEls) if (c.el === d.el) { c.gone = true; d.el.style.transform = `translate(${p.x - d.x0}px, ${p.y - d.y0}px) scale(.7)`; d.el.classList.add('vanish'); }
      }
      void before;
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
    rotate.innerHTML = `<div class="rot-card"><div class="rot-icon">${rotateIconSVG()}</div><p>${esc(T.rotate.line)}</p><button class="btn-gold rot-go">${esc(T.rotate.play)}</button></div>`;
    rotate.querySelector('.rot-go').addEventListener('click', () => { rotateOk = true; checkRotate(); });
  }
  window.addEventListener('resize', checkRotate);
  try { screen.orientation && screen.orientation.addEventListener && screen.orientation.addEventListener('change', checkRotate); } catch { /* old browsers */ }

  // ---- cards ----
  function card(cls, html) {
    cards.innerHTML = '';
    const c = el('div', `card ${cls}`, html);
    cards.append(c);
    cards.hidden = false;
    return c;
  }
  function hideCards() { cards.innerHTML = ''; cards.hidden = true; }

  function startCard({ day, hasSave, voice }, onStart, onFresh) {
    const c = card('start-card', `<div class="logo">${logoSVG(lang)}</div><div class="start-btns">` +
      `<button class="btn-gold go">${esc(hasSave && day > 1 ? fmt(T.cont, { n: day }) : T.start)}</button>` +
      (hasSave && day > 1 ? `<button class="btn-2 fresh">${esc(T.fresh)}</button>` : '') + '</div>' +
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
    if (o) return `<i class="nc oke"><span class="nc-head">${customerSVG({ id: o.cid }, 0, k === 'c250' ? { fixed: 'c250' } : {})}</span><span class="nc-bub">${okeBubbleSVG(o.prop)}</span></i>`;
    return '';
  }
  function dayCard(d, _opts, onOpen) {
    const icons = (d.newStuff || []).map(newIcon).join('');
    const c = card('day-card', `<div class="dc-board"><h2>${esc(fmt(T.day, { n: d.n }))}</h2>` +
      `<div class="dc-goal"><span class="dc-coin">${coinSVG()}</span><b>${money(d.goal)}</b></div>` +
      (icons ? `<div class="dc-new"><small>${esc(T.newToday)}</small><div class="dc-icons">${icons}</div></div>` : '') +
      `</div><button class="btn-gold go">${esc(T.open)}</button>`);
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
      `<div class="rc-stars">${starRowSVG(sum.stars)}</div><hr><ul>` +
      row(Rw.sales, money(sales)) + row(Rw.tips, money(sum.tips)) + row(Rw.prepay, money(sum.prepay)) +
      row(Rw.cups, String(sum.sold), 'hot') + row(Rw.served, String(sum.orders)) + row(Rw.wrong, String(sum.wrong)) + row(Rw.walkouts, String(sum.walkouts)) +
      row(Rw.oke, String(sum.okeCursed + sum.normalCursed), 'hot') + row(Rw.fans, String(sum.fans)) +
      row(Rw.fame, `${fameD >= 0 ? '+' : ''}${fameD}`, 'hot') +
      `</ul><hr><div class="rc-wallet"><span>${esc(T.wallet)}</span><b>${money(wallet)}</b></div>` +
      `<div class="rc-stamp ${sum.met ? '' : 'miss'}">${sum.met ? '★' : '…'}</div></div>` +
      `<div class="rc-side"><div class="rc-tower">${towerHTML(sum.sold / 3)}</div><button class="btn-gold go">${esc(T.toShop)}</button></div>`);
    c.querySelector('.go').addEventListener('click', () => onNext());
  }

  // upgrade icons: the actual equipment at that level
  function upIcon(stId, lv) {
    switch (stId) {
      case 'pot': return `<span class="ui-stack">${lv >= 3 ? potRigSVG(lv) : ''}${potSVG({ scoops: lv >= 2 ? 10 : 6, cookingPct: 0 })}</span>`;
      case 'tea': return lv >= 3 ? `<span class="ui-stack">${teaTankSVG('black', { fast: true })}<span class="ui-over">${teaManifoldSVG(1)}</span></span>` : teaTankSVG('black', { fast: lv >= 2 });
      case 'seal': return lv >= 4 ? shelfSVG(4, { autoSeal: true }) : lv >= 3 ? `<span class="ui-two">${sealerSVG('idle', { turbo: true })}${sealerSVG('idle', { turbo: true })}</span>` : sealerSVG('idle', { turbo: lv >= 2 });
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
    const draw = (sv) => {
      const tabs = TABS.map((tb) => `<button class="sc-tab${tb === shopTab ? ' on' : ''}" data-tab="${tb}">${esc(T.tabs[tb])}</button>`).join('');
      const items = STATIONS.filter((x) => x.tab === shopTab).map((sta) => {
        const have = levelOf(sv.upgrades, sta.id);
        const nx = nextLevel(sv.upgrades, sta.id);
        const total = sta.levels.length;
        const single = total === 1;
        const pips = Array.from({ length: total + (single ? 0 : 1) }, (_, i) => `<i class="pip${i < have + (single ? 0 : 1) ? ' on' : ''}"></i>`).join('');
        const can = nx && canBuy(nx.id, sv.upgrades, sv.wallet);
        const shownLv = nx ? (single ? 1 : nx.lv) : (single ? 1 : total + 1);
        const [name, eff] = nx ? T.upgrades[nx.id] : T.upgrades[sta.levels[total - 1].id];
        const btn = nx ? `<button class="up-buy" data-id="${nx.id}" ${can ? '' : 'disabled'}><span class="dc-coin">${coinSVG()}</span>${money(nx.cost)}</button>`
          : `<span class="up-max">${esc(single ? T.owned : T.max)}</span>`;
        return `<li class="up ${!nx ? 'owned' : can ? 'can' : 'cant'}" data-station="${sta.id}"><span class="up-ic">${upIcon(sta.id, nx ? nx.lv : total + 1)}</span>` +
          `<span class="up-txt"><small class="up-st">${esc(T.stations[sta.id])}${single ? '' : ` · ${esc(fmt(T.lv, { n: shownLv }))}`}</small><b>${esc(name)}</b><small class="up-eff">${esc(eff)}</small><span class="pips">${pips}</span></span>${btn}</li>`;
      }).join('');
      const c = card('shop-card', `<div class="sc-head"><h2>${esc(T.shopTitle)}</h2><div class="sc-tabs">${tabs}</div><div class="sc-wallet"><span class="dc-coin">${coinSVG()}</span><b>${money(sv.wallet)}</b></div></div>` +
        `<ul class="ups">${items}</ul><button class="btn-gold go">${esc(fmt(retry ? T.retry : T.next, { n: nextDay }))}</button>`);
      c.querySelectorAll('.sc-tab').forEach((b) => b.addEventListener('click', () => { shopTab = b.dataset.tab; draw(sv); }));
      c.querySelectorAll('.up.can .up-buy').forEach((b) => b.addEventListener('click', () => {
        const res = onBuy(b.dataset.id);
        if (res && res.ok) draw(res.save);
      }));
      c.querySelector('.go').addEventListener('click', () => { hideCards(); onGo(); });
    };
    draw(save);
  }

  function endCard(onAgain) {
    const c = card('day-card', `<div class="dc-board"><div class="logo">${logoSVG(lang)}</div><p class="dc-end">${esc(T.end)}</p></div><button class="btn-gold go">${esc(fmt(T.next, { n: 6 }))}</button>`);
    c.querySelector('.go').addEventListener('click', () => { hideCards(); onAgain(); });
  }

  function pauseSheet({ muted }, acts) {
    const c = card('pause-card', `<button class="btn-gold resume">${esc(T.pause.resume)}</button>` +
      `<div class="pause-row"><button class="btn-2 tog lang">${esc(T.pause.lang)}</button><button class="btn-2 tog mute">${esc(muted ? T.pause.unmute : T.pause.mute)}</button></div>` +
      `<div class="pause-row"><button class="btn-2 close">${esc(T.pause.close)}</button><button class="btn-2 restart">${esc(T.pause.restart)}</button></div>`);
    c.querySelector('.resume').addEventListener('click', () => { hideCards(); acts.resume(); });
    c.querySelector('.lang').addEventListener('click', () => acts.lang());
    c.querySelector('.mute').addEventListener('click', () => acts.mute());
    c.querySelector('.close').addEventListener('click', () => { hideCards(); acts.close(); });
    c.querySelector('.restart').addEventListener('click', () => { hideCards(); acts.restart(); });
  }

  function voicePrompt(onAllow, onNo) {
    const c = card('voice-card', `<div class="mic"></div><div class="vc-txt"><p>${esc(T.voice.ask)}</p><p class="small">${esc(T.voice.privacy)}</p>` +
      `<div class="vc-btns"><button class="btn-gold allow">${esc(T.voice.allow)}</button><button class="btn-2 no">${esc(T.voice.no)}</button></div></div>`);
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
