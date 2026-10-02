// ui.js — DOM rendering, input and juice effects for 《来250杯！》.
// No game logic lives here: the UI only draws what it is told and forwards input.
//
// createUI(root, { onPress, onCharge, onStart, onToggleLang, onToggleBleep }) → {
//   render(state), showCustomer(customer), relabelCustomer(customer), relabelMilestone(), showLine(text, { style, who }),
//   effect(name, payload), showMilestone(level, text), showStart(texts),
//   showSummary(summary, texts), setTexts(uiTexts), beginSignature(onSkip, hint?), endSignature()
// }
//
// Callbacks:
//   onPress(key, 0)             key: 'gun'|'shut'|'take'; fired immediately on pointerdown / J/K/L keydown
//   onCharge(key, level)        level 1 after holding 300 ms, level 2 after 800 ms (same press, still held)
//   onStart()                   start / play-again button
//   onToggleLang(nextLang)      nextLang: 'zh'|'en' (UI flips its own label too)
//   onToggleBleep(nextOn)       nextOn: boolean
//
// showStart(texts)   texts: { title?, subtitle?, hint?, start? }
// showSummary(summary, texts)
//   summary: { queue, score, maxCombo, served, cursed, polite, bestLineId }
//   texts:   { title?, cursedLabel?, queueLabel?, scoreLabel?, comboLabel?,
//              bestLabel?, bestLine?, again?, verdict? }
// setTexts(uiTexts)  SYSTEM.ui shape: { gun, shut, take, queue, aura, fury, start, again, bleep, lang? }
// effect payloads (all optional):
//   hit { charge }, miss {}, perfect { text }, '250' { text }, polite { boo: string[] },
//   rageStart { text }, rageEnd {}, fly { key }, charge { level }
// 'perfect', '250', the rageStart banner and milestone cards share one queue: only one big
// banner is on screen at a time, each for at most 900 ms. hit/miss/fly/polite/charge play at once.
//
// beginSignature(onSkip, hint) locks the buttons and lays a transparent tap-to-skip layer over the
// stage (onSkip fires once, after a short grace period); endSignature() removes it.

const KEYS = ['gun', 'shut', 'take'];
const KEYBOARD = { j: 'gun', k: 'shut', l: 'take' };
const CHARGE_MS = [300, 800];

const HEADS = ['👨', '👩', '🧔', '👴', '👵', '🧑', '👱', '👨‍🦲', '👩‍🦱', '🧓', '👱‍♀️', '👨‍🦳', '👩‍🦰', '🧑‍🦱'];
const QUEUE_PEOPLE = ['🧍', '🧍‍♀️', '🧍‍♂️', '🚶', '🚶‍♀️', '🚶‍♂️', '🧑‍🦯', '🧍', '🙋', '🙋‍♂️'];
const CLERK_FACE = { idle: '😏', hit: '😤', rage: '🤬', polite: '🙂', perfect: '😎', over: '😌' };

// Scene decor + floating effect texts, per language (zh is Simplified to match content.zh.js).
const DECOR = {
  zh: {
    menuTitle: '🧋 本店饮品',
    menu: [['珍珠奶茶', 55], ['四季春', 30], ['多多绿', 45], ['杨枝甘露', 75], ['250杯', '?']],
    menuFoot: '甜度冰块 自己讲清楚',
    clerkTag: '店长',
    plaque: '点 餐 处',
    slam: ['砰!', '砰砰!!', '轰!!!'],
    rage: '爆气！！',
    boo: ['嘘～～', '好软喔', '退钱！'],
  },
  en: {
    menuTitle: '🧋 MENU',
    menu: [['Boba Tea', 55], ['Oolong', 30], ['Yakult Green', 45], ['Mango Ice', 75], ['250 Cups', '?']],
    menuFoot: 'Sugar & ice? SPEAK UP.',
    clerkTag: 'BOSS',
    plaque: 'ORDER HERE',
    slam: ['BAM!', 'BAM BAM!!', 'KABOOM!!!'],
    rage: 'RAGE!!',
    boo: ['Booo~', 'So soft!', 'Refund!'],
  },
};

const DEFAULT_UI = {
  zh: { gun: '滚！', shut: '闭嘴！', take: '收！', queue: '排队', aura: '气势', fury: '火气', start: '开店！', again: '再骂一天', bleep: '消音', combo: '连击', time: '秒' },
  en: { gun: 'SCRAM!', shut: 'SHUT IT!', take: 'DEAL!', queue: 'Queue', aura: 'Swagger', fury: 'Fury', start: 'OPEN SHOP!', again: 'Rant Again', bleep: 'Bleep', combo: 'Combo', time: 's' },
};

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

// Split "（stage direction）spoken" into DOM: directions small italic, never parsed as HTML.
function fillLine(node, text) {
  node.textContent = '';
  const parts = String(text ?? '').split(/([（(][^）)]*[）)])/);
  for (const p of parts) {
    if (!p) continue;
    if (/^[（(].*[）)]$/.test(p)) el('span', 'dir', node, p);
    else el('span', 'say', node, p);
  }
}

function fmt(n) {
  return Math.max(0, Math.floor(n || 0)).toLocaleString('en-US');
}

function pick(arr, i) {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

export function chargeLevel(ms) {
  return ms >= CHARGE_MS[1] ? 2 : ms >= CHARGE_MS[0] ? 1 : 0;
}

// Plays "big" effects one after another. push(play, ms): play() starts the effect and may return a
// cleanup function, which runs when its slot (min(ms, maxMs)) ends, right before the next one starts.
export function createFxQueue({ maxMs = 900, maxPending = 4, schedule = setTimeout, cancel = clearTimeout } = {}) {
  const pending = [];
  let busy = false;
  let timer = 0;
  let cleanup = null;
  function finishCurrent() {
    const c = cleanup;
    cleanup = null;
    if (typeof c === 'function') c();
  }
  function next() {
    finishCurrent();
    const item = pending.shift();
    if (!item) { busy = false; return; }
    busy = true;
    cleanup = item.play() || null;
    timer = schedule(next, Math.min(maxMs, item.ms ?? maxMs));
  }
  return {
    push(play, ms) {
      pending.push({ play, ms });
      while (pending.length > maxPending) pending.shift(); // never build a long backlog
      if (!busy) next();
    },
    clear() {
      cancel(timer);
      pending.length = 0;
      finishCurrent();
      busy = false;
    },
    get size() { return pending.length + (busy ? 1 : 0); },
  };
}

export function createUI(root, { onPress = () => {}, onCharge = () => {}, onStart = () => {}, onToggleLang = () => {}, onToggleBleep = () => {} } = {}) {
  let lang = 'zh';
  let locked = false; // signature scene: buttons do nothing
  let bleepOn = false;
  let texts = { ...DEFAULT_UI.zh };
  let phase = 'idle';
  const last = {};

  // ---------- DOM skeleton ----------
  root.textContent = '';
  root.classList.add('app');
  const stage = el('div', 'stage', root);
  stage.dataset.phase = 'idle';
  const shaker = el('div', 'shaker', stage);

  // HUD
  const hud = el('header', 'hud', shaker);
  const hudTop = el('div', 'hud-row', hud);
  const qBox = el('div', 'hud-queue', hudTop);
  const qLabel = el('span', 'hud-label', qBox);
  const qNum = el('span', 'hud-qnum', qBox, '0');
  const timeBox = el('div', 'hud-time', hudTop);
  const timeNum = el('span', 'hud-tnum', timeBox, '90');
  const toggles = el('div', 'hud-toggles', hudTop);
  const langBtn = el('button', 'tog tog-lang', toggles);
  langBtn.type = 'button';
  const bleepBtn = el('button', 'tog tog-bleep', toggles);
  bleepBtn.type = 'button';

  const bars = el('div', 'hud-bars', hud);
  function makeBar(cls) {
    const wrap = el('div', 'bar ' + cls, bars);
    const label = el('span', 'bar-label', wrap);
    const track = el('div', 'bar-track', wrap);
    const fill = el('div', 'bar-fill', track);
    return { wrap, label, fill };
  }
  const auraBar = makeBar('bar-aura');
  const furyBar = makeBar('bar-fury');
  const comboBox = el('div', 'hud-combo', hud);
  const comboNum = el('span', 'combo-num', comboBox);
  const comboLabel = el('span', 'combo-label', comboBox);

  // Scene: shop wall, clerk on the judge-bench counter, customer head below
  const scene = el('main', 'scene', shaker);
  const wall = el('div', 'wall', scene);
  const menu = el('div', 'menu-board', wall);
  function renderMenu() {
    const d = DECOR[lang];
    menu.textContent = '';
    el('div', 'menu-title', menu, d.menuTitle);
    for (const [n, p] of d.menu) {
      const row = el('div', 'menu-row', menu);
      el('span', '', row, n);
      el('span', '', row, String(p));
    }
    el('div', 'menu-foot', menu, d.menuFoot);
  }
  const numberSign = el('div', 'number-sign', wall);
  el('span', 'ns-label', numberSign, 'NO.');
  const numberVal = el('span', 'ns-val', numberSign, '000');
  el('div', 'fan', wall, '🌀');

  const clerk = el('div', 'clerk', scene);
  const clerkHead = el('div', 'clerk-head', clerk, CLERK_FACE.idle);
  const clerkBody = el('div', 'clerk-body', clerk);
  const clerkTag = el('span', 'clerk-tag', clerkBody);
  el('div', 'clerk-legs', clerk);
  el('div', 'clerk-cup', clerk, '🧋');

  const counter = el('div', 'counter', scene);
  el('div', 'counter-top', counter);
  const counterFront = el('div', 'counter-front', counter);
  const plaque = el('div', 'counter-plaque', counterFront);
  el('div', 'counter-rail', counterFront);

  const custWrap = el('div', 'cust-wrap', scene);
  const custClip = el('div', 'cust-clip', custWrap);
  const custHead = el('div', 'cust-head', custClip);
  const custTag = el('div', 'cust-tag', custWrap);
  const custName = el('div', 'cust-name', custWrap);
  const bubble = el('div', 'bubble', scene);
  const bubbleText = el('div', 'bubble-text', bubble);
  const patience = el('div', 'patience', bubble);
  const patienceFill = el('div', 'patience-fill', patience);

  // Tints live inside the scene so HUD, subtitles and buttons stay readable.
  el('div', 'tint tint-polite', scene);
  el('div', 'tint tint-rage', scene);
  const fx = el('div', 'fx-layer', scene);

  // Queue strip: from counter to the door and beyond
  const floor = el('section', 'queue-strip', shaker);
  const line = el('div', 'queue-line', floor);
  const door = el('div', 'door', floor);
  el('span', 'door-icon', door, '🚪');
  const outside = el('div', 'queue-outside', floor);
  const outsideNum = el('span', 'out-num', outside);
  const outsideLabel = el('span', 'out-label', outside);

  // Subtitles
  const subs = el('section', 'subs', shaker);

  // Buttons
  const pad = el('footer', 'pad', shaker);
  const buttons = {};
  KEYS.forEach((key, i) => {
    const b = el('button', 'btn btn-' + key, pad);
    b.type = 'button';
    b.dataset.key = key;
    const ring = el('span', 'ring', b);
    const label = el('span', 'btn-label', b);
    el('span', 'btn-hint', b, 'JKL'[i]);
    buttons[key] = { b, ring, label, down: 0, raf: 0, src: null, level: 0 };
  });

  // Overlays
  const milestoneCard = el('div', 'milestone hidden', stage);
  const startCard = el('div', 'overlay start hidden', stage);
  const summaryCard = el('div', 'overlay summary hidden', stage);
  const sigLayer = el('div', 'sig-skip hidden', stage);
  const sigHint = el('div', 'sig-hint', sigLayer);

  // ---------- Texts / toggles ----------
  function applyTexts() {
    qLabel.textContent = texts.queue;
    auraBar.label.textContent = texts.aura;
    furyBar.label.textContent = texts.fury;
    comboLabel.textContent = texts.combo || DEFAULT_UI[lang].combo;
    outsideLabel.textContent = texts.queue;
    for (const k of KEYS) {
      const lab = buttons[k].label;
      const t = String(texts[k] ?? '');
      lab.textContent = t;
      const w = [...t].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 2 : /[A-Z]/.test(ch) ? 1.3 : 1), 0); // rough glyph width; CJK counts double
      lab.classList.toggle('long', w > 6 && w <= 9);
      lab.classList.toggle('xlong', w > 9);
    }
    langBtn.innerHTML = lang === 'zh' ? '<b>中</b>/EN' : '中/<b>EN</b>';
    bleepBtn.textContent = (bleepOn ? '🔇 ' : '🔊 ') + texts.bleep;
    bleepBtn.classList.toggle('on', bleepOn);
    bleepBtn.setAttribute('aria-pressed', String(bleepOn));
    root.lang = lang === 'zh' ? 'zh-Hans' : 'en';
    renderMenu();
    clerkTag.textContent = DECOR[lang].clerkTag;
    plaque.textContent = DECOR[lang].plaque;
    plaque.classList.toggle('latin', lang === 'en');
  }

  function setTexts(uiTexts = {}) {
    if (uiTexts.lang === 'zh' || uiTexts.lang === 'en') lang = uiTexts.lang;
    texts = { ...DEFAULT_UI[lang], ...uiTexts };
    applyTexts();
  }

  langBtn.addEventListener('click', () => {
    lang = lang === 'zh' ? 'en' : 'zh';
    texts = { ...DEFAULT_UI[lang] }; // main normally follows up with setTexts(SYSTEM.ui)
    applyTexts();
    onToggleLang(lang);
  });
  bleepBtn.addEventListener('click', () => {
    bleepOn = !bleepOn;
    applyTexts();
    onToggleBleep(bleepOn);
  });

  // ---------- Input: press resolves at once, holding on upgrades the charge ----------
  function inputLocked() {
    return locked || phase === 'idle' || phase === 'over' || !startCard.classList.contains('hidden') || !summaryCard.classList.contains('hidden');
  }
  function beginHold(key, src) {
    const s = buttons[key];
    if (s.down || inputLocked()) return;
    s.down = performance.now();
    s.src = src;
    s.level = 0;
    s.b.classList.add('held');
    s.b.classList.remove('tap');
    void s.b.offsetWidth;
    s.b.classList.add('tap');
    onPress(key, 0);
    if (!s.down || locked) return; // the press itself may have locked input (signature scene)
    const loop = () => {
      const ms = performance.now() - s.down;
      const p = Math.min(1, ms / CHARGE_MS[1]);
      const lvl = chargeLevel(ms);
      s.b.style.setProperty('--charge', p.toFixed(3));
      s.b.dataset.charge = String(lvl);
      if (lvl > s.level && !locked) {
        s.level = lvl;
        onCharge(key, lvl);
      }
      if (lvl >= 2 || locked) return; // fully charged: nothing more to track until release
      s.raf = requestAnimationFrame(loop);
    };
    s.raf = requestAnimationFrame(loop);
  }
  function endHold(key) {
    const s = buttons[key];
    if (!s.down) return;
    cancelAnimationFrame(s.raf);
    s.down = 0;
    s.src = null;
    s.level = 0;
    s.b.classList.remove('held');
    s.b.style.setProperty('--charge', '0');
    s.b.dataset.charge = '0';
  }

  for (const key of KEYS) {
    const { b } = buttons[key];
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch {}
      beginHold(key, 'pointer');
    });
    b.addEventListener('pointerup', (e) => { e.preventDefault(); endHold(key); });
    b.addEventListener('pointercancel', () => endHold(key));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  const onKeyDown = (e) => {
    if (sigSkip && ['Enter', ' ', 'Escape'].includes(e.key)) {
      e.preventDefault();
      if (!e.repeat) trySkip();
      return;
    }
    const key = KEYBOARD[e.key?.toLowerCase()];
    if (key) {
      e.preventDefault();
      if (!e.repeat) beginHold(key, 'kbd');
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      if (!startCard.classList.contains('hidden') || !summaryCard.classList.contains('hidden')) {
        e.preventDefault();
        hideOverlays();
        onStart();
      }
    }
  };
  const onKeyUp = (e) => {
    const key = KEYBOARD[e.key?.toLowerCase()];
    if (key && buttons[key].src === 'kbd') { e.preventDefault(); endHold(key); }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => KEYS.forEach((k) => endHold(k)));

  // ---------- Signature scene: input lock + tap anywhere to skip ----------
  let sigSkip = null;
  let sigSince = 0;
  const SKIP_GRACE_MS = 600; // a player still hammering buttons must not skip by accident
  function trySkip() {
    if (!sigSkip || performance.now() - sigSince < SKIP_GRACE_MS) return;
    const f = sigSkip;
    sigSkip = null;
    f();
  }
  sigLayer.addEventListener('pointerdown', (e) => { e.preventDefault(); trySkip(); });
  sigLayer.addEventListener('contextmenu', (e) => e.preventDefault());
  function beginSignature(onSkip, hint) {
    locked = true;
    KEYS.forEach((k) => endHold(k));
    sigSkip = typeof onSkip === 'function' ? onSkip : null;
    sigSince = performance.now();
    sigHint.textContent = hint || (lang === 'zh' ? '点击屏幕跳过 ▸▸' : 'Tap to skip ▸▸');
    sigLayer.classList.remove('hidden');
    stage.classList.add('signature');
  }
  function endSignature() {
    sigSkip = null;
    locked = false;
    sigLayer.classList.add('hidden');
    stage.classList.remove('signature');
  }

  // ---------- Render ----------
  function setBar(bar, v, key) {
    const val = Math.max(0, Math.min(100, Math.round(v ?? 0)));
    if (last[key] === val) return;
    last[key] = val;
    bar.fill.style.width = val + '%';
    bar.wrap.classList.toggle('low', key === 'aura' && val <= 25);
    bar.wrap.classList.toggle('hot', key === 'fury' && val >= 80);
  }

  function renderQueue(n) {
    if (last.queue === n) return;
    const prev = last.queue ?? 0;
    last.queue = n;
    qNum.textContent = fmt(n);
    outsideNum.textContent = fmt(n);
    if (n > prev) {
      qNum.classList.remove('bump');
      void qNum.offsetWidth;
      qNum.classList.add('bump');
    }
    const want = Math.min(n, 9);
    while (line.children.length < want) {
      const i = line.children.length;
      const p = el('span', 'qp', line, pick(QUEUE_PEOPLE, i * 7 + 3));
      p.style.setProperty('--i', i);
    }
    while (line.children.length > want) line.lastChild.remove();
    floor.dataset.tier = n >= 100000 ? '5' : n >= 10000 ? '4' : n >= 1000 ? '3' : n >= 100 ? '2' : n >= 10 ? '1' : '0';
  }

  function render(state) {
    if (!state) return;
    if (state.phase !== phase) {
      phase = state.phase;
      stage.dataset.phase = phase;
      if (phase === 'over') setClerk('over');
      else if (phase !== 'rage' && clerk.dataset.mood === 'rage') setClerk('idle');
    }
    renderQueue(Math.floor(state.queue || 0));
    setBar(auraBar, state.aura, 'aura');
    setBar(furyBar, state.fury, 'fury');
    const secs = Math.max(0, Math.ceil((state.timeLeftMs ?? 0) / 1000));
    if (last.secs !== secs) {
      last.secs = secs;
      timeNum.textContent = String(secs);
      timeBox.classList.toggle('urgent', secs <= 10 && phase !== 'idle');
    }
    const combo = state.combo || 0;
    if (last.combo !== combo) {
      last.combo = combo;
      comboNum.textContent = '×' + combo;
      comboBox.classList.toggle('show', combo >= 2);
      comboBox.classList.toggle('big', combo >= 10);
      if (combo >= 2) { comboBox.classList.remove('pulse'); void comboBox.offsetWidth; comboBox.classList.add('pulse'); }
    }
    const cur = state.current;
    if (cur && cur.patienceMaxMs > 0 && phase !== 'rage') {
      const p = Math.max(0, Math.min(1, cur.patienceMs / cur.patienceMaxMs));
      patienceFill.style.transform = `scaleX(${p.toFixed(3)})`;
      patience.classList.toggle('low', p < 0.33);
      patience.hidden = false;
    } else {
      patience.hidden = true;
    }
    for (const k of KEYS) buttons[k].b.disabled = phase === 'idle' || phase === 'over';
  }

  // ---------- Clerk / customer ----------
  let moodTimer = 0;
  function setClerk(mood, ms = 0) {
    clearTimeout(moodTimer);
    clerk.dataset.mood = mood;
    clerkHead.textContent = CLERK_FACE[mood] || CLERK_FACE.idle;
    if (ms) moodTimer = setTimeout(() => setClerk(phase === 'rage' ? 'rage' : 'idle'), ms);
  }

  let custCount = 0;
  // Long lines (mostly English) would overflow the 3-line bubble: step the font down until it fits.
  function fillBubble(text) {
    fillLine(bubbleText, text);
    bubbleText.classList.remove('long', 'longer');
    if (bubbleText.scrollHeight > bubbleText.clientHeight + 2) bubbleText.classList.add('long');
    if (bubbleText.scrollHeight > bubbleText.clientHeight + 2) bubbleText.classList.replace('long', 'longer');
  }

  function showCustomer(customer) {
    if (!customer) return;
    custCount++;
    numberVal.textContent = String(custCount).padStart(3, '0');
    custHead.textContent = pick(HEADS, (customer.id ?? custCount) * 5 + 1);
    custTag.textContent = customer.tag || '';
    custName.textContent = customer.name || '';
    custWrap.dataset.style = customer.style || '';
    fillBubble(customer.says || '');
    custWrap.classList.remove('gone', 'enter');
    bubble.classList.remove('gone', 'enter');
    void custWrap.offsetWidth;
    custWrap.classList.add('enter');
    bubble.classList.add('enter');
    patience.hidden = false;
    patienceFill.style.transform = 'scaleX(1)';
  }

  // Re-label the customer at the counter in place (language switch mid-round): no animation, no new ticket number.
  function relabelCustomer(customer) {
    subs.textContent = '';
    if (!customer) return;
    custTag.textContent = customer.tag || '';
    custName.textContent = customer.name || '';
    fillBubble(customer.says || '');
  }

  // ---------- Subtitles ----------
  function showLine(text, { style = '', who = 'clerk' } = {}) {
    if (who === 'cust') {
      fillBubble(text);
      bubble.classList.remove('gone', 'enter');
      void bubble.offsetWidth;
      bubble.classList.add('enter');
      return;
    }
    const node = el('div', `sub sub-${who} st-${style || 'plain'}`);
    fillLine(node, text);
    if (phase === 'rage') {
      subs.appendChild(node);
      while (subs.children.length > 3) subs.firstChild.remove();
    } else {
      subs.textContent = '';
      subs.appendChild(node);
    }
    // Long lines shrink so the subtitle never overflows.
    const len = String(text || '').length;
    let scale = len > 60 ? 0.62 : len > 36 ? 0.78 : 1;
    node.style.setProperty('--len-scale', String(scale));
    // Wide CJK text and several stage directions can still overflow: step down until it fits.
    while (scale > 0.5 && subs.scrollHeight > subs.clientHeight + 2) {
      scale = Math.round((scale - 0.08) * 100) / 100;
      node.style.setProperty('--len-scale', String(scale));
    }
  }

  // ---------- Effects ----------
  function restartClass(node, cls, ms) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    if (ms) setTimeout(() => node.classList.remove(cls), ms);
  }

  function floatText(text, cls, ms = 900) {
    const n = el('div', 'float ' + cls, fx, text);
    setTimeout(() => n.remove(), ms);
    return n;
  }

  const bigFx = createFxQueue({ maxMs: 900 });
  // A queued banner: created when its turn comes, removed when its slot ends.
  function queueBanner(text, cls, ms = 900, extra) {
    bigFx.push(() => {
      const n = el('div', 'float ' + cls, fx, text);
      const undo = extra ? extra() : null;
      return () => { n.remove(); if (undo) undo(); };
    }, ms);
  }
  let lastSlam = null;

  function hitstop(then) {
    stage.classList.add('freeze');
    setTimeout(() => { stage.classList.remove('freeze'); then && then(); }, 100);
  }

  function fly(payload = {}) {
    const sRect = stage.getBoundingClientRect();
    const hRect = custHead.getBoundingClientRect();
    const dRect = door.getBoundingClientRect();
    const clone = el('div', 'flyer', stage, custHead.textContent);
    const scale = sRect.width / (stage.offsetWidth || sRect.width) || 1;
    const x0 = (hRect.left - sRect.left) / scale, y0 = (hRect.top - sRect.top) / scale;
    const x1 = (dRect.left - sRect.left + dRect.width / 2) / scale, y1 = (dRect.top - sRect.top) / scale;
    clone.style.left = x0 + 'px';
    clone.style.top = y0 + 'px';
    custWrap.classList.add('gone');
    bubble.classList.add('gone');
    const dx = x1 - x0, dy = y1 - y0;
    const spin = payload.key === 'take' ? 360 : 1080;
    const anim = clone.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.2 - 160}px) rotate(${spin / 2}deg) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(0.25)`, opacity: 0.2 },
    ], { duration: 620, easing: 'cubic-bezier(.3,.1,.5,1)' });
    anim.onfinish = () => clone.remove();
    setTimeout(() => clone.remove(), 900);
  }

  function effect(name, payload = {}) {
    switch (name) {
      case 'hit': {
        const lvl = Math.max(0, Math.min(2, payload.charge | 0));
        setClerk('hit', 700);
        hitstop(() => restartClass(stage, 'shake-' + lvl, 400));
        restartClass(counter, 'slam', 300);
        lastSlam = floatText(DECOR[lang].slam[lvl], 'slam-text lvl' + lvl, 600);
        break;
      }
      case 'charge': {
        // Held on after the hit: bigger shake, the slam word upgrades in place.
        const lvl = Math.max(1, Math.min(2, payload.charge ?? payload.level ?? 1));
        setClerk(lvl === 2 ? 'rage' : 'hit', 700);
        restartClass(stage, 'shake-' + (lvl + 1), 500);
        restartClass(counter, 'slam', 300);
        if (lvl === 2) restartClass(stage, 'charge-flash', 300);
        if (lastSlam) lastSlam.remove();
        lastSlam = floatText(DECOR[lang].slam[lvl], 'slam-text up lvl' + lvl, 700);
        break;
      }
      case 'miss':
        restartClass(custWrap, 'wobble', 500);
        floatText('…?', 'miss-text', 700);
        break;
      case 'perfect':
        setClerk('perfect', 700);
        queueBanner(payload.text || 'PERFECT', 'perfect-text');
        break;
      case '250':
        queueBanner(payload.text || '250', 'gold-text', 900, () => {
          restartClass(stage, 'gold');
          return () => stage.classList.remove('gold');
        });
        break;
      case 'polite': {
        setClerk('polite', 1600);
        restartClass(stage, 'polite', 1600);
        const boos = (payload.boo && payload.boo.length ? payload.boo : DECOR[lang].boo).slice(0, 5);
        boos.forEach((t, i) => {
          const n = floatText(t, 'boo-text', 1600);
          n.style.setProperty('--row', String(i));
          n.style.animationDelay = i * 120 + 'ms';
        });
        break;
      }
      case 'rageStart':
        stage.classList.add('rage');
        setClerk('rage');
        restartClass(stage, 'shake-2', 400);
        queueBanner(payload.text || DECOR[lang].rage, 'rage-text');
        break;
      case 'rageEnd':
        stage.classList.remove('rage');
        setClerk('idle');
        subs.textContent = '';
        break;
      case 'fly':
        fly(payload);
        break;
      default:
        break;
    }
  }

  // ---------- Milestone card ----------
  // `text` may be a string or a function returning the text in the current language; a function
  // is resolved when the card is shown (it may wait in the fx queue) and again on relabelMilestone().
  let milestoneText = null;
  let milestoneTextEl = null;
  const resolveText = (t) => (typeof t === 'function' ? t() : t) || '';
  function showMilestone(level, text) {
    bigFx.push(() => {
      milestoneCard.textContent = '';
      const card = el('div', 'ms-card', milestoneCard);
      el('div', 'ms-crowd', card, '🧍🧍‍♀️🚶🧍‍♂️🙋🧍🚶‍♀️🧍🧍‍♀️🚶‍♂️🧍🙋‍♂️');
      el('div', 'ms-level', card, fmt(level) + '+');
      milestoneText = text;
      milestoneTextEl = el('div', 'ms-text', card, resolveText(text));
      milestoneCard.classList.remove('hidden');
      restartClass(stage, 'zoomout');
      return () => {
        milestoneCard.classList.add('hidden');
        stage.classList.remove('zoomout');
        milestoneText = null;
        milestoneTextEl = null;
      };
    }, 900);
  }

  /** Re-render the visible milestone card's text (after a language switch). */
  function relabelMilestone() {
    if (milestoneTextEl && milestoneText != null) milestoneTextEl.textContent = resolveText(milestoneText);
  }

  // ---------- Start / summary ----------
  function hideOverlays() {
    startCard.classList.add('hidden');
    summaryCard.classList.add('hidden');
  }
  function startButton(parent, label) {
    const b = el('button', 'big-btn', parent, label);
    b.type = 'button';
    b.addEventListener('click', () => { hideOverlays(); onStart(); });
    return b;
  }

  function showStart(t = {}) {
    bigFx.clear();
    endSignature();
    const zh = lang === 'zh';
    startCard.textContent = '';
    const card = el('div', 'card', startCard);
    el('div', 'card-cups', card, '🧋🧋🧋');
    el('h1', 'card-title', card, t.title || (zh ? '来250杯！' : '250 Cups!'));
    el('p', 'card-sub', card, t.subtitle || (zh ? '柜台很高，态度更高。骂得越凶，排队越长。' : 'High counter. Higher attitude. The ruder you are, the longer the line.'));
    const keys = el('div', 'card-keys', card);
    KEYS.forEach((k, i) => {
      const r = el('div', 'key-row key-' + k, keys);
      el('kbd', '', r, 'JKL'[i]);
      el('span', '', r, texts[k]);
    });
    el('p', 'card-hint', card, t.hint || (zh ? '按住蓄力更凶｜太慢会被迫客气，全场嘘你' : 'Hold to charge | Too slow and you must be polite. Everyone boos.'));
    startButton(card, t.start || texts.start).focus?.({ preventScroll: true });
    summaryCard.classList.add('hidden');
    startCard.classList.remove('hidden');
  }

  function showSummary(s = {}, t = {}) {
    bigFx.clear();
    endSignature();
    const zh = lang === 'zh';
    summaryCard.textContent = '';
    const card = el('div', 'card report', summaryCard);
    el('div', 'report-stamp', card, zh ? '打烊' : 'CLOSED');
    el('h2', 'card-title', card, t.title || (zh ? '今日战报' : "Today's Report"));
    const grid = el('div', 'report-grid', card);
    const stat = (label, val, cls = '') => {
      const c = el('div', 'stat ' + cls, grid);
      el('div', 'stat-val', c, val);
      el('div', 'stat-label', c, label);
    };
    stat(t.cursedLabel || (zh ? '开骂' : 'Rants'), fmt(s.cursed) + (zh ? ' 次' : ''), 'hot');
    stat(t.queueLabel || (zh ? '排队' : 'In line'), fmt(s.queue) + (zh ? ' 人' : ''), 'gold');
    stat(t.comboLabel || (zh ? '最高连击' : 'Best combo'), '×' + fmt(s.maxCombo));
    stat(t.scoreLabel || (zh ? '分数' : 'Score'), fmt(s.score));
    if (s.polite) stat(zh ? '被迫客气' : 'Forced polite', fmt(s.polite) + (zh ? ' 次' : ''), 'pink');
    stat(zh ? '接客' : 'Served', fmt(s.served));
    const best = el('div', 'best', card);
    el('div', 'best-label', best, t.bestLabel || (zh ? '最狠一句' : 'Savagest line'));
    const bl = el('div', 'best-line', best);
    fillLine(bl, t.bestLine || '……');
    if (t.verdict) el('p', 'card-sub', card, t.verdict);
    startButton(card, t.again || texts.again);
    startCard.classList.add('hidden');
    summaryCard.classList.remove('hidden');
  }

  applyTexts();
  setClerk('idle');

  return { render, showCustomer, relabelCustomer, showLine, effect, showMilestone, relabelMilestone, showStart, showSummary, setTexts, beginSignature, endSignature };
}
