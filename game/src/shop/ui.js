// ui.js — gameplay v3 shop screen (docs/gameplay-v3-shop.md 2): DOM rendering, pointer input (taps on stations,
// cup drags, gestures on customers through src/gesture.js), juice (coins, cup fill, sealer, stamp, fly), the day 1
// finger guide, cards (day card, receipt, upgrade shop, start, pause, voice prompt). Layout and look: shop.css.
// No game rules here: main.js owns the engine and calls render(state) every frame and onEvent(ev) per event.
//
//   createShopUI(root, handlers) → ui
//     handlers: onTake(), onTea(kind), onTopping(kind), onIce(), onSugar(), onCook(), onSelect(w),
//               onDrop(w, { type: 'sealer'|'seat'|'trash'|null, slot }), onAnswer(slot, key, info),
//               onPause(), onFirstInput()
//     ui.build(shop)            the stations, work slots and seats for today's menu / upgrades
//     ui.render(state)          per frame: HUD, patience rings, pot, sealer, queue
//     ui.onEvent(ev, ctx)       visuals of one engine event (ctx: { lang, line, says, content })
//     ui.say(text, who, key)    a subtitle (clerk lines get the '|' punch half big in the key colour)
//     ui.guide(step, state)     the finger demo for a guide step (null hides it)
//     ui.dayCard / receipt / upgradeShop / startCard / pauseSheet / voicePrompt  (cards; resolve via callbacks)
import {
  cupSVG, teaTankSVG, toppingTraySVG, iceBinSVG, syrupSVG, sealerSVG, potSVG, cupRackSVG, trashSVG, workSlotSVG,
  orderBubbleSVG, coinSVG, patienceRingSVG, counterBackdropSVG,
} from './art-shop.js';
import { customerSVG, FINGER_SVG, CLERK_SVG, logoSVG } from '../art.js';
import { createRecognizer } from '../gesture.js';
import { okeBubbleSVG, STAMP_SVG, starRowSVG } from './oke-art.js';
import { okeOf } from './oke.js';
import { UPGRADES } from './upgrades.js';
import { shopText, fmt } from './text.js';

const TOP_ORDER = ['pearl', 'pudding', 'grass', 'coconut'];
const KEY_COLOR = { gun: 'var(--gun)', shut: 'var(--shut)', take: 'var(--lemon)' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const stripDir = (s) => String(s ?? '').replace(/（[^（）]*）/g, '').replace(/\([^()]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
const money = (n) => Math.round(n).toLocaleString('en-US');

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// queue silhouettes outside (cool, backlit, no outline: art direction 5.4)
function queuePersonSVG(i) {
  const hues = ['#2D3466', '#34407A', '#283058', '#3B2F5E', '#2A3A6A'];
  const c = hues[i % hues.length];
  return `<svg viewBox="0 0 40 60" aria-hidden="true"><path fill="${c}" d="M2 60 Q2 34 12 31 Q20 28 28 31 Q38 34 38 60 Z"/>` +
    `<circle cx="20" cy="17" r="11" fill="${c}"/><path fill="none" stroke="#7FD4FF" stroke-width="1.6" opacity=".7" d="M10 12 Q14 6 22 6"/></svg>`;
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
  const queueEl = el('div', 'queue');
  const fanSign = el('div', 'fan-sign');
  street.append(queueEl, fanSign);
  const seatsEl = el('div', 'seats');
  const lip = el('div', 'lip');
  const work = el('div', 'work');
  work.innerHTML = `<div class="backdrop">${counterBackdropSVG()}</div>`;
  shaker.append(street, seatsEl, lip, work);
  const fx = el('div', 'fx');
  const clerkCut = el('div', 'clerk-cut', CLERK_SVG);
  const subs = el('div', 'subs');
  const finger = el('div', 'finger', FINGER_SVG);
  finger.hidden = true;
  const hud = el('div', 'hud');
  hud.innerHTML = `<div class="hud-money"><span class="hud-coin">${coinSVG()}</span><b class="hud-num">0</b><i class="hud-goal"><i></i></i></div>` +
    `<div class="hud-stars"></div><div class="hud-right"><div class="hud-timer"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" class="ht-bg"/>` +
    `<circle cx="20" cy="20" r="16" class="ht-arc" pathLength="100" stroke-dasharray="100 100" transform="rotate(-90 20 20)"/></svg><b class="ht-num"></b></div>` +
    `<button class="hud-pause" aria-label="pause"><i></i><i></i></button></div>`;
  const cards = el('div', 'cards');
  stage.append(fx, clerkCut, subs, finger, hud, cards);
  const hudNum = hud.querySelector('.hud-num');
  const hudGoal = hud.querySelector('.hud-goal > i');
  const hudStars = hud.querySelector('.hud-stars');
  const htArc = hud.querySelector('.ht-arc');
  const htNum = hud.querySelector('.ht-num');
  const hudTimer = hud.querySelector('.hud-timer');
  hud.querySelector('.hud-pause').addEventListener('click', () => call('onPause'));

  let seats = [];   // [{ el, wrap, bubble, ring, uid, kind }]
  let wslots = [];  // [{ el, cupEl, key }]
  let stations = {};
  let lastStars = 0;
  let lastMoney = null;
  let lastQueue = -1;
  let cfg = null;
  let def = null;

  // ---- build ----
  function station(cls, html, act, arg) {
    const e = el('div', `st ${cls}`, html);
    e.dataset.act = act;
    if (arg) e.dataset.arg = arg;
    work.append(e);
    return e;
  }

  function build(shop) {
    const s = shop.state;
    cfg = shop.cfg;
    def = shop.def;
    work.querySelectorAll('.st, .wslot').forEach((n) => n.remove());
    stations = {};
    stage.dataset.seats = String(s.slots.length);
    stage.dataset.slots = String(s.work.length);
    // teas, left to right in their fixed order
    def.teas.forEach((k, i) => { stations['tea-' + k] = station(`st-tea t${i}`, teaTankSVG(k), 'tea', k); });
    stations.sealer = station('st-sealer', sealerSVG('idle'), 'sealer');
    stations.sealer.insertAdjacentHTML('beforeend', '<i class="seal-bar"><i></i></i>');
    const tops = TOP_ORDER.filter((k) => def.toppings.includes(k) || (k === 'coconut' && cfg.coconut));
    tops.forEach((k, i) => { stations['top-' + k] = station(`st-top p${i}`, toppingTraySVG(k, 10), 'topping', k); stations['top-' + k].dataset.kind = k; });
    if (def.ice) stations.ice = station('st-ice', iceBinSVG(), 'ice');
    if (def.sugar) stations.sugar = station('st-syrup', syrupSVG(), 'sugar');
    stations.rack = station('st-rack', cupRackSVG(), 'take');
    stations.pot = station('st-pot', potSVG({ scoops: s.pot.scoops, cookingPct: 0 }), 'cook');
    stations.trash = station('st-trash', trashSVG(), 'trash');
    stations.rack.dataset.kind = 'rack';
    wslots = s.work.map((_, w) => {
      const e = el('div', `wslot w${w}`, `<div class="plate">${workSlotSVG()}</div>`);
      e.dataset.w = String(w);
      work.append(e);
      return { el: e, cupEl: null, key: '' };
    });
    seatsEl.innerHTML = '';
    seats = s.slots.map((_, i) => {
      const e = el('div', 'seat');
      e.dataset.slot = String(i);
      e.innerHTML = '<div class="bubble"></div><div class="ring"></div><div class="head"></div>';
      seatsEl.append(e);
      return { el: e, bubble: e.querySelector('.bubble'), ring: e.querySelector('.ring'), head: e.querySelector('.head'), uid: null, pct: -1 };
    });
    for (let i = 0; i < s.slots.length; i++) if (s.slots[i]) seatCustomer(i, s.slots[i], false);
    lastStars = 0; lastMoney = null; lastQueue = -1;
    renderCups(s, true);
  }

  // ---- seats ----
  function bubbleFor(c) {
    if (c.kind === 'oke' && !c.converted) return okeBubbleSVG(okeOf(c.oke).prop);
    return orderBubbleSVG(c.order);
  }
  function seatCustomer(i, c, animate = true) {
    const st = seats[i];
    if (!st) return;
    st.uid = c.uid;
    st.el.dataset.kind = c.kind === 'oke' && !c.converted ? 'oke' : 'normal';
    st.el.dataset.oke = c.oke || '';
    st.el.classList.toggle('double', !!c.doublePay);
    st.bubble.innerHTML = bubbleFor(c);
    st.ring.innerHTML = c.kind === 'oke' && !c.converted ? '' : patienceRingSVG(1);
    st.pct = -1;
    st.head.innerHTML = `<div class="cust-wrap${animate ? ' enter' : ''}"><div class="cust-clip">${customerSVG({ id: c.cid }, c.visit || 0, c.oke === 'c250' ? { fixed: 'c250' } : {})}</div></div>`;
    if (animate) st.bubble.classList.remove('pop'), void st.bubble.offsetWidth, st.bubble.classList.add('pop');
  }
  function clearSeat(i, reason) {
    const st = seats[i];
    if (!st) return;
    st.uid = null;
    const wrap = st.head.querySelector('.cust-wrap');
    st.bubble.innerHTML = '';
    st.ring.innerHTML = '';
    st.el.dataset.kind = '';
    if (!wrap) return;
    wrap.classList.remove('enter');
    if (reason === 'gun') wrap.dataset.face = 'gun';
    else if (reason === 'take') wrap.dataset.face = 'take';
    else if (reason === 'shut') wrap.dataset.face = 'shut';
    else wrap.classList.add('sink');
    const old = wrap;
    setTimeout(() => { if (old.parentNode && seats[i] && seats[i].uid == null) old.remove(); }, 650);
  }

  // ---- cups ----
  function cupKey(c, sealing) { return c ? `${c.tea}|${c.toppings.join(',')}|${c.ice}|${c.sugar}|${c.sealed ? 1 : 0}|${sealing ? 1 : 0}` : ''; }
  function renderCups(s, force = false) {
    s.work.forEach((c, w) => {
      const ws = wslots[w];
      if (!ws) return;
      const sealing = !!(c && c.sealingUntil && !c.sealed);
      const key = cupKey(c, sealing);
      ws.el.classList.toggle('selected', c != null && s.selected === w && !c.sealed && !sealing);
      if (key === ws.key && !force) return;
      ws.key = key;
      if (!c) { if (ws.cupEl) ws.cupEl.remove(); ws.cupEl = null; ws.el.classList.remove('selected'); return; }
      if (!ws.cupEl) {
        ws.cupEl = el('div', 'wcup');
        ws.cupEl.dataset.w = String(w);
        ws.el.append(ws.cupEl);
      }
      const parent = sealing && stations.sealer ? stations.sealer : ws.el;
      if (ws.cupEl.parentNode !== parent) parent.append(ws.cupEl);
      ws.cupEl.innerHTML = cupSVG({ tea: c.tea, toppings: c.toppings, ice: c.ice, sugar: c.sugar, sealed: c.sealed });
      ws.cupEl.classList.toggle('sealing', sealing);
      ws.cupEl.classList.toggle('sealed', !!c.sealed);
    });
  }

  // ---- per frame ----
  function render(s) {
    // money + goal
    const m = Math.round(s.earned);
    if (m !== lastMoney) {
      hudNum.textContent = money(m);
      lastMoney = m;
      const g = Math.max(0, Math.min(1, m / s.def.goal));
      hudGoal.style.width = `${g * 100}%`;
      hud.classList.toggle('goal-met', m >= s.def.goal);
    }
    if (s.stars !== lastStars) { hudStars.innerHTML = starRowSVG(s.stars); lastStars = s.stars; stage.dataset.stars = String(s.stars); }
    const left = Math.max(0, s.length - s.clock);
    const sec = Math.ceil(left / 1000);
    htNum.textContent = s.phase === 'guide' ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    htArc.setAttribute('stroke-dasharray', `${(left / s.length) * 100} 100`);
    hudTimer.classList.toggle('late', s.phase === 'open' && left < 15000);
    hud.classList.toggle('guide', s.phase === 'guide');
    // patience
    s.slots.forEach((c, i) => {
      const st = seats[i];
      if (!st || !c || st.uid !== c.uid) return;
      if (c.kind === 'oke' && !c.converted) return;
      const pct = Number.isFinite(c.patienceMax) ? Math.max(0, c.patience / c.patienceMax) : 1;
      const q = Math.round(pct * 50) / 50;
      if (q !== st.pct) { st.pct = q; st.ring.innerHTML = patienceRingSVG(q); st.el.classList.toggle('hurry', q < 0.3); }
    });
    renderCups(s);
    // sealer + pot
    const sealingCup = s.work.find((c) => c && c.sealingUntil && !c.sealed);
    const busy = !!sealingCup;
    if (stations.sealer) {
      if (stations.sealer.dataset.state !== (busy ? 'busy' : 'idle')) {
        stations.sealer.dataset.state = busy ? 'busy' : 'idle';
        stations.sealer.querySelector('svg').outerHTML = sealerSVG(busy ? 'busy' : 'idle');
      }
      const bar = stations.sealer.querySelector('.seal-bar > i');
      bar.style.width = busy ? `${Math.min(100, (1 - (sealingCup.sealingUntil - s.t) / s.cfg.sealMs) * 100)}%` : '0%';
    }
    if (stations.pot) {
      const pct = s.pot.cookingUntil ? 1 - (s.pot.cookingUntil - s.t) / s.cfg.cookMs : 0;
      const key = `${s.pot.scoops}|${Math.round(pct * 20)}`;
      if (stations.pot.dataset.key !== key) {
        stations.pot.dataset.key = key;
        stations.pot.querySelector('svg').outerHTML = potSVG({ scoops: s.pot.scoops, cookingPct: s.pot.cookingUntil ? Math.max(0.02, pct) : 0 });
        stations.pot.classList.toggle('empty', s.pot.scoops === 0 && !s.pot.cookingUntil);
        const tray = stations['top-pearl'];
        if (tray) { tray.querySelector('svg').outerHTML = toppingTraySVG('pearl', s.pot.scoops); tray.classList.toggle('empty', s.pot.scoops === 0); }
      }
    }
    // the queue outside: real people waiting + the fame crowd
    const q = Math.min(18, s.queue.length + (s.stars - 1) * 2);
    if (q !== lastQueue) {
      lastQueue = q;
      let html = '';
      for (let i = 0; i < q; i++) html += `<i style="--i:${i};left:${4 + ((i * 37) % 86)}%;z-index:${20 - i}">${queuePersonSVG(i)}</i>`;
      queueEl.innerHTML = html;
      queueEl.dataset.n = String(q);
    }
  }

  // ---- fx ----
  function rectIn(e) {
    const r = e.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height, cx: r.left - sr.left + r.width / 2, cy: r.top - sr.top + r.height / 2 };
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
    floatBusy = now + delay + 260;
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
      const d = 30 + Math.random() * 40;
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
    const st = seats[i];
    if (!st) return;
    const r = rectIn(st.head);
    const s = el('div', 'stamp', STAMP_SVG);
    s.style.left = `${r.cx}px`;
    s.style.top = `${r.y + r.h * 0.35}px`;
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
      case 'arrive': seatCustomer(ev.slot, ev.cust, true); break;
      case 'leave': {
        const r = seats[ev.slot] ? rectIn(seats[ev.slot].head) : null;
        if (ev.reason === 'gun') { shake(8); if (r) burst(r.cx, r.cy, 'ice', 5); }
        if (ev.reason === 'take' && r) stampOn(ev.slot);
        if (ev.reason === 'shut') shake(4);
        clearSeat(ev.slot, ev.reason);
        break;
      }
      case 'answer': {
        if (ev.key === 'shut' && !ev.normal) {
          const st = seats[ev.slot];
          const wrap = st && st.head.querySelector('.cust-wrap');
          if (wrap) { wrap.dataset.face = 'shut-z'; }
          const r = st ? rectIn(st.head) : null;
          if (r) burst(r.cx, r.cy, 'pearl', 3);
          shake(4);
          setTimeout(() => { if (st && st.uid === ev.cust.uid) seatCustomer(ev.slot, ev.cust, false); }, 520);
        }
        clerkPop(ev.key);
        const r = seats[ev.slot] ? rectIn(seats[ev.slot].el) : { cx: 100, y: 80 };
        if (ev.prepay) { floatNum(`+${ev.prepay}`, r.cx, r.y + 40, 'gold'); coinsFly({ cx: r.cx, cy: r.y + 60 }, 5); }
        if (ev.best) stage.classList.remove('laugh'), void stage.offsetWidth, stage.classList.add('laugh');
        break;
      }
      case 'fans': {
        queueEl.classList.remove('surge'); void queueEl.offsetWidth; queueEl.classList.add('surge');
        break;
      }
      case 'serve': {
        const st = seats[ev.slot];
        const r = st ? rectIn(st.el) : { cx: 100, y: 80 };
        if (ev.correct) {
          floatNum(`+${ev.pay + ev.tip}`, r.cx, r.y + 30);
          coinsFly({ cx: r.cx, cy: r.y + 50 }, ev.tip > 0 ? 3 : 2);
        } else {
          floatNum(`+${ev.pay}`, r.cx, r.y + 30, 'dim');
          const wrap = st && st.head.querySelector('.cust-wrap');
          if (wrap) { wrap.classList.remove('wobble'); void wrap.offsetWidth; wrap.classList.add('wobble'); }
          say(t.complaints[Math.floor(Math.random() * t.complaints.length)], 'cust', 'shut');
        }
        break;
      }
      case 'tea': {
        const ws = wslots[ev.w];
        if (ws) { renderCupsNow(); const c = ws.cupEl; if (c) { c.classList.remove('pour'); void c.offsetWidth; c.classList.add('pour'); } }
        const tank = stations['tea-' + ev.kind];
        if (tank) press(tank);
        break;
      }
      case 'topping': { const s2 = stations['top-' + ev.kind]; if (s2) press(s2); bounceCup(ev.w); break; }
      case 'ice': if (stations.ice) press(stations.ice); bounceCup(ev.w); break;
      case 'sugar': if (stations.sugar) press(stations.sugar); bounceCup(ev.w); break;
      case 'cup': press(stations.rack); break;
      case 'sealStart': press(stations.sealer); break;
      case 'sealed': {
        shake(3);
        const r = rectIn(stations.sealer);
        floatNum('喀', r.cx, r.y + r.h * 0.35, 'kaa');
        break;
      }
      case 'trash': press(stations.trash); break;
      case 'cookStart': press(stations.pot); break;
      case 'star': {
        stage.classList.remove('starup'); void stage.offsetWidth; stage.classList.add('starup');
        fanSign.textContent = t.fanSign;
        fanSign.classList.remove('show'); void fanSign.offsetWidth; fanSign.classList.add('show');
        break;
      }
      case 'nope': {
        const target = ev.reason === 'potEmpty' ? stations.pot : ev.reason === 'noCup' ? stations.rack : ev.reason === 'sealerBusy' ? stations.sealer : null;
        if (target) { target.classList.remove('nudge'); void target.offsetWidth; target.classList.add('nudge'); }
        break;
      }
      case 'refuse': {
        const wrap = seats[ev.slot] && seats[ev.slot].head.querySelector('.cust-wrap');
        if (wrap) { wrap.classList.remove('wobble'); void wrap.offsetWidth; wrap.classList.add('wobble'); }
        break;
      }
      default: break;
    }
  }
  let lastState = null;
  function renderCupsNow() { if (lastState) renderCups(lastState); }
  function press(e) { if (!e) return; e.classList.remove('press'); void e.offsetWidth; e.classList.add('press'); }
  function bounceCup(w) { renderCupsNow(); const c = wslots[w] && wslots[w].cupEl; if (c) { c.classList.remove('bounce'); void c.offsetWidth; c.classList.add('bounce'); } }

  // ---- guide finger ----
  let guideTimer = 0;
  function guide(step, s) {
    clearInterval(guideTimer);
    finger.hidden = !step;
    finger.className = 'finger';
    if (!step) return;
    const place = () => {
      let a = null;
      let b = null;
      const cupW = s.work.findIndex((c) => c && (step === 'seal' ? !c.sealed : c.sealed));
      const cupEl = cupW >= 0 && wslots[cupW] ? wslots[cupW].cupEl : null;
      if (step === 'cup') a = stations.rack;
      else if (step === 'tea') a = stations['tea-' + def.teas[0]];
      else if (step === 'topping') a = stations['top-' + def.toppings[0]];
      else if (step === 'seal') { a = cupEl; b = stations.sealer; }
      else if (step === 'serve') { a = cupEl; b = seats.find((x) => x.uid != null && x.el.dataset.kind === 'normal')?.el; }
      else if (step === 'oke') { const st = seats.find((x) => x.el.dataset.kind === 'oke'); a = st && st.head; b = a; }
      if (!a) { finger.hidden = true; return; }
      finger.hidden = false;
      const ra = rectIn(a);
      const rb = b ? rectIn(b) : null;
      finger.style.setProperty('--x0', `${ra.cx}px`);
      finger.style.setProperty('--y0', `${ra.cy}px`);
      if (step === 'oke') {
        finger.style.setProperty('--x0', `${ra.x + ra.w * 0.15}px`);
        finger.style.setProperty('--x1', `${ra.x + ra.w * 1.1}px`);
        finger.style.setProperty('--y1', `${ra.cy - ra.h * 0.25}px`);
        finger.className = 'finger swipe';
      } else if (rb) {
        finger.style.setProperty('--x1', `${rb.cx}px`);
        finger.style.setProperty('--y1', `${step === 'serve' ? rb.y + rb.h * 0.7 : rb.cy}px`);
        finger.className = 'finger drag';
      } else finger.className = 'finger tap';
    };
    place();
    guideTimer = setInterval(place, 400);
  }

  // ---- input ----
  let drag = null;        // { w, id, x0, y0, moved, el }
  const gestureSeat = new Map(); // pointer id → slot
  let firstInput = false;
  const rec = createRecognizer({
    onGesture(e) {
      if (e.type === 'swipe') {
        const slot = gestureSeat.get(e.id);
        if (slot != null) { call('onAnswer', slot, 'gun', { speed: e.speed, dir: e.dir }); gestureSeat.delete(e.id); }
      } else if (e.type === 'tap') {
        const slot = tapSeat;
        if (slot != null && e.n === 3) call('onAnswer', slot, 'shut', { taps: e.n });
        if (slot != null && seats[slot]) { const r = rectIn(seats[slot].head); floatNum('啪', r.cx + (e.n - 2) * 14, r.y + r.h * 0.45, 'pa'); }
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
  let tapSeat = null;
  (function loop() { rec.tick(performance.now()); requestAnimationFrame(loop); })();

  function pt(e) { const sr = stage.getBoundingClientRect(); return { x: e.clientX - sr.left, y: e.clientY - sr.top }; }
  function hitTarget(x, y) {
    const sr = stage.getBoundingClientRect();
    const els = document.elementsFromPoint(x + sr.left, y + sr.top);
    for (const n of els) {
      if (n.closest && n.closest('.st-sealer')) return { type: 'sealer' };
      if (n.closest && n.closest('.st-trash')) return { type: 'trash' };
      const seat = n.closest && n.closest('.seat');
      if (seat) return { type: 'seat', slot: Number(seat.dataset.slot) };
    }
    // generous: anything dropped above the counter lip goes to the nearest seat
    const lr = rectIn(lip);
    if (y < lr.y + lr.h && seats.length) {
      const i = Math.max(0, Math.min(seats.length - 1, Math.floor((x / sr.width) * seats.length)));
      return { type: 'seat', slot: i };
    }
    return { type: null };
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.cards, .hud, .pause-sheet')) return;
    if (!firstInput) { firstInput = true; call('onFirstInput'); }
    const p = pt(e);
    const cup = e.target.closest('.wcup');
    if (cup && !cup.classList.contains('sealing')) {
      e.preventDefault();
      drag = { w: Number(cup.dataset.w), id: e.pointerId, x0: p.x, y0: p.y, moved: false, el: cup };
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
    const st = e.target.closest('.st');
    if (st) {
      const act = st.dataset.act;
      const arg = st.dataset.arg;
      if (act === 'tea') call('onTea', arg);
      else if (act === 'topping') call('onTopping', arg);
      else if (act === 'ice') call('onIce');
      else if (act === 'sugar') call('onSugar');
      else if (act === 'take') call('onTake');
      else if (act === 'cook') call('onCook');
      return;
    }
    const ws = e.target.closest('.wslot');
    if (ws && !ws.querySelector('.wcup')) call('onTake');
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
      if (!d.moved) { call('onSelect', d.w); return; }
      if (cancel) return;
      call('onDrop', d.w, hitTarget(p.x, p.y));
      return;
    }
    if (gestureSeat.has(e.pointerId) || rec.active) {
      if (cancel) rec.cancel(e.pointerId, performance.now());
      else rec.up(e.pointerId, e.clientX, e.clientY, performance.now());
    }
  }
  stage.addEventListener('pointerup', (e) => endPointer(e, false));
  stage.addEventListener('pointercancel', (e) => endPointer(e, true));

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
    const c = card('start-card', `<div class="logo">${logoSVG(lang)}</div>` +
      `<button class="btn-gold go">${esc(hasSave && day > 1 ? fmt(T.cont, { n: day }) : T.start)}</button>` +
      (hasSave && day > 1 ? `<button class="btn-2 fresh">${esc(T.fresh)}</button>` : '') +
      `<button class="tog lang" aria-label="language">${lang === 'zh' ? 'EN' : '中'}</button>`);
    c.querySelector('.go').addEventListener('click', () => onStart());
    const f = c.querySelector('.fresh');
    if (f) f.addEventListener('click', () => onFresh());
    c.querySelector('.lang').addEventListener('click', () => call('onToggleLang'));
    c.dataset.voice = voice ? '1' : '';
  }

  function dayCard(d, { cfg: tuning }, onOpen) {
    const icons = (d.newStuff || []).map((k) => {
      if (k === 'black' || k === 'green' || k === 'jade') return `<i class="nc tank">${teaTankSVG(k)}</i>`;
      if (['pearl', 'pudding', 'grass', 'coconut'].includes(k)) return `<i class="nc tray">${toppingTraySVG(k, 10)}</i>`;
      if (k === 'ice') return `<i class="nc tray">${iceBinSVG()}</i>`;
      if (k === 'sugar') return `<i class="nc syrup">${syrupSVG()}</i>`;
      if (k === 'two') return `<i class="nc bub">${orderBubbleSVG({ tea: 'black', toppings: ['pearl'], ice: 0, sugar: 0, count: 2 })}</i>`;
      const o = okeOf(k);
      if (o) return `<i class="nc oke"><span class="nc-head">${customerSVG({ id: o.cid }, 0, k === 'c250' ? { fixed: 'c250' } : {})}</span><span class="nc-bub">${okeBubbleSVG(o.prop)}</span></i>`;
      return '';
    }).join('');
    const c = card('day-card', `<div class="dc-board"><h2>${esc(fmt(T.day, { n: d.n }))}</h2>` +
      `<div class="dc-goal"><span class="dc-coin">${coinSVG()}</span><b>${money(d.goal)}</b></div>` +
      (icons ? `<div class="dc-new"><small>${esc(T.newToday)}</small><div class="dc-icons">${icons}</div></div>` : '') +
      `</div><button class="btn-gold go">${esc(T.open)}</button>`);
    void tuning;
    c.querySelector('.go').addEventListener('click', () => { hideCards(); onOpen(); });
  }

  function receipt(sum, { wallet }, onNext) {
    const R = T.rows;
    const row = (k, v, cls = '') => `<li class="${cls}"><span>${esc(k)}</span><i></i><b>${esc(v)}</b></li>`;
    const sales = sum.earned - sum.tips - sum.prepay;
    const fameD = sum.fame - sum.fameStart;
    const c = card('receipt-card', `<div class="receipt"><div class="rc-logo">${logoSVG(lang)}</div>` +
      `<div class="rc-head">${esc(fmt(T.day, { n: sum.day }))} · ${esc(T.receiptTitle)}</div><div class="rc-no">NO.${String(sum.day).padStart(4, '0')} · 2:30</div><hr>` +
      `<div class="rc-big"><span class="dc-coin">${coinSVG()}</span><b>${money(sum.earned)}</b></div>` +
      `<div class="rc-goal ${sum.met ? 'met' : ''}">${esc(sum.met ? T.met : fmt(T.missed, { n: money(sum.goal - sum.earned) }))} <small>/ ${money(sum.goal)}</small></div>` +
      `<div class="rc-stars">${starRowSVG(sum.stars)}</div><hr><ul>` +
      row(R.sales, money(sales)) + row(R.tips, money(sum.tips)) + row(R.prepay, money(sum.prepay)) +
      row(R.served, String(sum.correct)) + row(R.wrong, String(sum.wrong)) + row(R.walkouts, String(sum.walkouts)) +
      row(R.oke, String(sum.okeCursed + sum.normalCursed), 'hot') + row(R.fans, String(sum.fans)) +
      row(R.fame, `${fameD >= 0 ? '+' : ''}${fameD}`, 'hot') +
      `</ul><hr><div class="rc-wallet"><span>${esc(T.wallet)}</span><b>${money(wallet)}</b></div>` +
      `<div class="rc-stamp ${sum.met ? '' : 'miss'}">${sum.met ? '★' : '…'}</div></div>` +
      `<button class="btn-gold go">${esc(T.toShop)}</button>`);
    c.querySelector('.go').addEventListener('click', () => onNext());
  }

  function upgradeShop(save, { nextDay, retry }, onBuy, onGo) {
    const draw = (sv) => {
      const items = UPGRADES.map((u) => {
        const [name, blurb] = T.upgrades[u.id];
        const owned = sv.upgrades.includes(u.id);
        const can = !owned && sv.wallet >= u.cost;
        return `<li class="up ${owned ? 'owned' : can ? 'can' : 'cant'}" data-id="${u.id}"><span class="up-ic up-${u.id}"></span>` +
          `<span class="up-txt"><b>${esc(name)}</b><small>${esc(blurb)}</small></span>` +
          `<button class="up-buy" ${can ? '' : 'disabled'}>${owned ? esc(T.owned) : `<span class="dc-coin">${coinSVG()}</span>${money(u.cost)}`}</button></li>`;
      }).join('');
      const c = card('shop-card', `<div class="sc-head"><h2>${esc(T.shopTitle)}</h2><div class="sc-wallet"><span class="dc-coin">${coinSVG()}</span><b>${money(sv.wallet)}</b></div></div>` +
        `<ul class="ups">${items}</ul><button class="btn-gold go">${esc(fmt(retry ? T.retry : T.next, { n: nextDay }))}</button>`);
      c.querySelectorAll('.up.can .up-buy').forEach((b) => b.addEventListener('click', () => {
        const id = b.closest('.up').dataset.id;
        const res = onBuy(id);
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
      `<button class="btn-2 tog lang">${esc(T.pause.lang)}</button><button class="btn-2 tog mute">${esc(muted ? T.pause.unmute : T.pause.mute)}</button>` +
      `<button class="btn-2 close">${esc(T.pause.close)}</button><button class="btn-2 restart">${esc(T.pause.restart)}</button>`);
    c.querySelector('.resume').addEventListener('click', () => { hideCards(); acts.resume(); });
    c.querySelector('.lang').addEventListener('click', () => acts.lang());
    c.querySelector('.mute').addEventListener('click', () => acts.mute());
    c.querySelector('.close').addEventListener('click', () => { hideCards(); acts.close(); });
    c.querySelector('.restart').addEventListener('click', () => { hideCards(); acts.restart(); });
  }

  function voicePrompt(onAllow, onNo) {
    const c = card('voice-card', `<div class="mic"></div><p>${esc(T.voice.ask)}</p><p class="small">${esc(T.voice.privacy)}</p>` +
      `<button class="btn-gold allow">${esc(T.voice.allow)}</button><button class="btn-2 no">${esc(T.voice.no)}</button>`);
    c.querySelector('.allow').addEventListener('click', () => { hideCards(); onAllow(); });
    c.querySelector('.no').addEventListener('click', () => { hideCards(); onNo(); });
  }

  hideCards();
  return {
    stage,
    build,
    render(s) { lastState = s; render(s); },
    onEvent,
    say,
    guide,
    startCard, dayCard, receipt, upgradeShop, endCard, pauseSheet, voicePrompt, hideCards,
    setLang(l) { lang = l === 'en' ? 'en' : 'zh'; T = shopText(lang); stage.lang = lang === 'en' ? 'en' : 'zh-Hant-TW'; document.documentElement.lang = stage.lang; },
    /** stage-relative centre of a part (tools): 'rack' | 'tea-black' | 'top-pearl' | 'sealer' | 'trash' | 'pot' | 'ice' | 'sugar' | 'cup-<w>' | 'seat-<i>' */
    where(name) {
      let e = stations[name];
      if (!e && name.startsWith('cup-')) e = wslots[Number(name.slice(4))]?.cupEl;
      if (!e && name.startsWith('seat-')) e = seats[Number(name.slice(5))]?.head;
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    },
  };
}
