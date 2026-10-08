// ui.js — DOM rendering, input, camera, 花字 and guidance for 《來250杯！》.
// No game logic lives here: the UI only draws what it is told and forwards input.
// Spec: docs/first-minute-spec.md (2.3 layout, 2.6–2.8 art hooks, 2.11 camera, 3.1–3.8, 4.4, 5, 6, 8.8).
//
// createUI(root, { onPress, onCharge, onRelease, onGesture, onStart, onToggleLang, onToggleBleep, onToggleInput }) → ui
//
// Callbacks
//   onPress(key, 0)          key 'gun'|'shut'|'take'; fired on pointerdown / J K L keydown (ignored while inputLocked())
//   onCharge(key, level)     level 1 after holding 300 ms, level 2 after 800 ms (same press, still held)
//   onRelease(key, holdMs)   the key went up after holdMs (stage 2: the calculator event, the boss's last step)
//   onStart()                start card button / tap (also the default for the closing / summary cards)
//   onToggleLang(nextLang)   'zh'|'en' (UI flips its own label too)
//   onToggleBleep(nextOn)    boolean
//   onGesture(e)             gesture mode only (docs/gameplay-v2.md 9): every event of src/gesture.js createRecognizer
//                            (swipe / swipeMove / swipeEnd / tap / burstEnd / holdStart / holdLevel / holdEnd) in stage px,
//                            plus { type: 'cross', head } when a swipe crosses a rage head and e.head on a tap on one
//   onToggleInput(next)      'gesture'|'buttons'|'voice' from the start card toggle
//   onVoiceOption(name, on)  voice mode switches on the start card: 'whisper' | 'replay' | 'keywords'
//
// ---- Gesture mode (docs/gameplay-v2.md 9)
//   setInputMode('gesture'|'buttons') / inputMode   gesture: the button pad turns into a counter top, the whole play area
//                                           (scene + counter top) takes pointer gestures; J/K/L keep working in both modes
//   setGestureHints(on)                     the three tiny gesture chips on the counter top (day 1 / opening)
//   slap(n, { x, y })                       a tap on the face: squash + "啪" pop (n = taps in the burst so far)
//   stampHold(level | null)                 the gold stamp above the customer's head grows (0 / 1 / 2); null hides it
//   stampSlam(text)                         the stamp slams onto the forehead with the caption ("啪！兩個月")
//   setFling({ dir, speed } | null)         the next customerReact('gun'|'gun2') flings the customer that way (physics)
//   bowl(n, text)                           n (1–3) queue silhouettes at the right edge topple; 3 = STRIKE text
//   rageHeadAdd(customer, n, { liveMs }) / rageHeadHit(n, key) / clearRageHeads()   rage heads in a row (gesture rage)
//   gestureHint(key, text)                  the gesture chip of key pulses with a short text above it
// ---- 吼罵模式 / voice mode (docs/gameplay-v2.md 10; the gesture surface stays on, inputMode reads 'gesture')
//   setInputMode('voice')                   gestures + the voice layer (stage[data-voice=1]); the start card toggle shows 吼
//   setVoiceOptions({ whisper, replay, keywords, keywordsAvailable })   the small switches under the toggle (voice only)
//   voicePrompt(texts) → Promise<boolean>   the "這家店要你親口罵" microphone card (allow / use gestures instead)
//   karaoke({ setup, punch, key } | null)   the suggested clerk line above the subtitles: setup small, punch big
//   karaokeProgress({ setup, punch })       0..1 each: how far the player's voice has lit it up
//   voiceMeter(on) / voiceLevel(v, level, { marks })   the loudness meter at the right edge (v 0..1, level -1..2)
//   voiceStatus(text)                       a small label under the meter (calibrating …)
//   voiceToast(text, cls)                   a floating caption ("反差 +24dB", "250!")
//   showSummary / showClosing: t.loudest = { text, replay, onReplay }  "今日最大聲" row with a replay button
// ---- HUD / texts
//   render(state, hud?)                     hud = { showAura = true, showFury = true, showTime = true } (remembered)
//                                           queue number, combo (only shown at combo >= 5), bars, sign timer sync
//   setHud(hud)                             same options without a state
//   setQueue(n, { bump = true })            show a queue number while the engine is idle (opening); render() of a
//                                           non-idle state takes over again
//   setTicket(n)                            叫號器 number (000 → 001 flip); also +1 on every customerReact('take')
//   setTexts(uiTexts)                       SYSTEM.ui: { gun, shut, take, queue, aura, fury, start, again, bleep, lang? }
//                                           (also relabels the scene props: lightbox, 叫號器, counter plaque)
//   queueGain(n)                            "+n" flies from the counter into the door monitor, HUD number pops
// ---- Clerk (art.CLERK_SVG)
//   setClerk(mood, ms?)                     mood idle|hit|perfect|polite|rage|over → svg data-mood; ms: back to idle/rage
//   setClerkFlags({ squint, crack, brow, sigh, tidy, lookDown, pointSign, reach, stand })   overlay classes on the
//                                           clerk svg (aliases: headDown → look-down, pointUp → point-sign, peekTicket → reach)
//   clerkBeat({ setupMs, punchStartMs, punchMs, landMs = 650, shake, flash, fx })      three-beat frames (2.6):
//                                           idle+squint → hit at punchStartMs → perfect +300 ms (tidy) → idle after landing.
//                                           fx 'normal'|'curse'|'mega' = shake 6/10/14 px (+ flash for curse/mega)
//   clerkTap()                              finger taps the counter (class .tap, 400 ms)
//   resetClerk()                            cancel a running clerkBeat, clear overlay flags, back to idle (new customer)
// ---- Customer + sign (art.customerSVG / art.signSVG; CSS states per the art.js contract)
//   showCustomer(customer, { enter = 'pop'|'rise', enterMs = 220|400, sign = true|spec|false, signDelayMs = 120,
//                line = true, fixed, visit }) → { signUpAt, signUpInMs }
//                                           sign rises enterMs + signDelayMs later (160 ms, then data-state=up);
//                                           signUpAt is a performance.now() timestamp; line: show `says` in the subtitle
//                                           band when the sign is up (pass false when the caller shows it itself)
//   relabelCustomer(customer)               language switch: redraw sign face / customer subtitle without animation
//   showSign(spec, { flip = 'up'|'rotY'|'rotX'|'none', ms }) → Promise
//                                           spec: a customer, or { key, sign, cups, sub } for scripted signs (sub = the
//                                           shrinking scribble under a 閉嘴 sign). 'rotX' on a visible sign = page turn.
//   signFx(kind)                            'shatter' (E4, 6 shards) | 'hint' (corner badge pulse)
//   hideSign()
//   startSignTimer(ms, { steps }) / stopSignTimer()   bar on the sign's lower edge, right to left, .blink in the last
//                                           600 ms; render(state) keeps it in step with state.current.patienceMs.
//                                           steps [[ms, mult], ...] (engine speedSteps): the corner tag follows the bar
//                                           (×1.5 → ×1.2 → none) as time since t0 passes
//   setSignMult(text)                       speed multiplier tag on the sign corner ('×2' while the customer talks;
//                                           '' hides it); kept for the next sign that mounts
//   kick(face, { word, n })                 jab while the answered customer flies (gameplay-v2 3): the customer flies
//                                           40% farther (+180° for 滾), shake 4 px / 80 ms, freeze 30 ms, S4 word
//   setForced(on)                           forced politeness (too slow): service tint, polite clerk until off
//   signExit(face)                          the sign leaves now (5.2: on the press, 150 ms, before the result 花字):
//                                           'gun' crumple | 'gun2' to the monitor | 'shut' strike + sink | 'take' stamp + slide
//   customerReact(face)                     'gun'|'gun2'|'shut'|'take' (fly-out, plus signExit if the sign is still up)
//                                           | 'suck' | 'sink' | 'miss' ('take' also advances the 叫號器 number)
//   customerPose({ look, chin, talk, gray, cower }) look → .drift, chin → .proud, talk → .talk, cower → .cower (head
//                                           ducks down a third); gray re-renders the grey copy
//   showPlate(lines, { ms = 350 }) → Promise ticket flies from the clerk's hand to the forehead (E11); plateGlow(on); clearPlate()
//   clearCustomer()
// ---- Camera + screen fx (2.11)
//   camera(focus, scale, ms = 0, ease?)     focus 'FACE'|'MOUTH'|'SIGN'|'CUST'|'GOLDSIGN'|'WIDE' or [x%, y%]; ease defaults to
//                                           cubic-bezier(.2,.8,.2,1), or (.5,0,.2,1) for ms <= 120. Reduced motion: scale <= 1.10
//   flash(ms = 40)                          white flash (120 ms on the 調你媽 beat; off with reduced motion)
//   speedLines(ms = 700)                    manga focus lines over the scene (CSS conic stripes; off with reduced motion)
//   setLite(on) / lite                      K4 lite mode: camera cuts, no idle loops (auto-detected on slow devices)
//   shake(px, ms = 200)                     any px (spec uses 3 / 6 / 10 / 14; halved with reduced motion)
//   freeze(ms)                              pause every animation / transition on the stage for ms (定格)
//   letterbox(on)                           14% black bars (ref-counted; S5 uses it too)
//   gate(open, ms = 500) → Promise          gate('close') shows the shutter; gate(true) rolls it up and removes it
//   goldsign(on)                            lightbox "黃金比例" glow (.shop[data-gold])
// ---- 花字 (section 5; picking lives in src/huazi.js)
//   huazi(list, timing?) → { done: Promise, cancel() }
//                                           items { text, style: 'S1'..'S5'|1..5|'emph', seg, ratio, at?, size?: 'sm',
//                                           fontSize?, pos?: [x%, y%], break? (S1 shatters at 150 ms), charMs?, holdMs?,
//                                           onChar?(i, ch) (S5 typing hook for the tick sound) }
//                                           timing { setupStartMs, setupMs, punchStartMs, punchMs, minAt }; ≥ 450 ms apart,
//                                           none before minAt (e.g. while a sign is still showing its wrong-answer hint).
//                                           Kept ≥ 4cqw clear of the sign (push up to y 8%, then shrink to 9cqw, else the
//                                           words are emphasised in the subtitle instead). Bleep mode: X你媽 → X你嗶 (boxed).
//   clearHuazi({ pendingOnly })             removes visible and pending 花字 (pendingOnly: only those not shown yet;
//                                           a sign that rises later still clears the visible ones in its way)
// ---- Subtitles (2.3)
//   showLine(text, { who = 'clerk'|'cust'|'system', color, style })   '|' removed; customer lines get a colour bar
//                                           (color: 'gun'|'shut'|'take' or any CSS colour); long lines get .long
//   emphasize(words)                        rate-limited S1/S2: those words get .em (--hz-yellow, 1.3x)
// ---- Guidance (3.1, 4.4)
//   guide({ key, dimOthers = true, glow = true, finger = false, line = false, blink = false })   call again to escalate
//   clearGuide()
//   hintCorrect(key)                        wrong answer: sign badge pulse + key outline flash (400 ms)
//   tip(text, { key, ms = 1200 })           small strip right above a key
//   breathKey(key)                          first sign of a type today: key breathes 600 ms x 2
//   coverKey(key, covered, { animate = true })   'shut' starts covered in the opening; uncover flips in 200 ms
//   lockInput(ms?) / unlockInput() / inputLocked()   also mirrored as .stage[data-locked="1"]
// ---- Screens
//   showStart(t, { firstRun = true, day = 1 })   3.2; t = { title, subtitle, start, startDay ('{n}' or fn) }
//   fontsReady(maxMs = 300) → Promise       start-card font preloads finished, or maxMs passed (await before the opening)
//   showClosing(t, summary, onTap?)         3.8; t = SYSTEM.opening.closing { title, lines } (+ queueFmt, tap);
//                                           summary = { queue, stars?, star1 = 30 }; tap → onTap (default onStart)
//   showRecap(t, { ms = 1800 }) → Promise   F3; t = SYSTEM.opening (uses .recap) or the recap array; tap skips
//   showSkip(onSkip, { delayMs = 1200, label }) → hide()   "跳過 ▸" top right
//   showSummary(summary, texts)             report card; texts { bestLine, verdict, again, star1? } (star1 → ★1 verdict line)
//   showMilestone(level, text)              door monitor zooms up (2.8); the round is not paused; text may be a getter
//   relabelMilestone()
//   setQueue / setTicket / render / setHud  see HUD above
//   effect(name, payload)                   hit | miss | perfect (no-op) | 250 | polite | rageStart | rageEnd | fly | charge
// ---- Gameplay v2 stage 2
//   setPreview([{ kind, text }])            the next customers' mini signs under the counter ([] hides them)
//   setMeter(value | null, { hit, over })   day 4 ticket meter "已收 N/250杯" (null hides it); hit / over flash it
//   setQuick(on, n)                         fast-mouth badge "快嘴 ×n"
//   showGroup(customers, { key, enterMs, sign }) → { signUpAt }   group box: the first customer with a big sign, the
//                                           others as small heads beside them; groupHit(n, key, { all }) sends the
//                                           n-th flying (all: every one left)
//   showEvent({ type, title, hint, big }) / updateEvent({ big }) / hideEvent()   mini-event panel
//   shutter(on, ms)                         the last-seconds iron shutter comes down over ms
//   dayBanner(title, rule, ms = 2200)       day card banner at round start (does not block input)
//   showStart(t): t.dayTitle / t.rule / t.riddle / t.best / t.starMask add the day card lines
//   showSummary(s, t): t.stars [b, b, b], t.starLines, t.rating, t.gold, t.record, t.bestText, t.hint, t.tomorrow
//
// Module exports (pure, tested in test/ui.test.mjs): createFxQueue, chargeLevel, FOCUS, camTransform,
//   rectsOverlap, placeHuazi, hzFontSize.

import * as art from './art.js';
import { createRecognizer } from './gesture.js';

const KEYS = ['gun', 'shut', 'take'];
const KEYBOARD = { j: 'gun', k: 'shut', l: 'take' };
const CHARGE_MS = [300, 800];
const SVGNS = 'http://www.w3.org/2000/svg';

// Self-hosted subsets (fonts/, docs/art-direction-v2.md 3): Traditional-only fallbacks, no Simplified fonts.
const FONT_ZH = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const FONT_SIGN = '"LXGW WenKai TC",' + FONT_ZH;
const FONT_EN = '"Baloo 2","Huninn",' + FONT_ZH;
const FONT_UI = '"Huninn",' + FONT_ZH;
const KEY_COLOR = { gun: '#EE4130', shut: '#7658F2', take: '#FFC21A' };

/** Named focus points in stage percent (2.11). */
export const FOCUS = { FACE: [50, 20], MOUTH: [50, 24], SIGN: [30, 55], CUST: [29, 67], GOLDSIGN: [72, 11.5], WIDE: [50, 40] };

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const EASE_FAST = 'cubic-bezier(.5,0,.2,1)';

const DECOR = {
  zh: { rage: '爆氣！', boo: ['噓～～', '好軟喔', '退錢！'], skip: '跳過 ▸', firstStart: '點一下 開店', day: (n) => `開店（第 ${n} 天）`, sub: '囂張店員，越罵越多人排隊。', queueFmt: (t, n) => `${t} ｜ 門口排了 ${n} 人`, tap: '點一下繼續' },
  en: { rage: 'RAGE!', boo: ['Booo~', 'So soft!', 'Refund!'], skip: 'Skip ▸', firstStart: 'Tap to open', day: (n) => `Open (Day ${n})`, sub: 'Rude clerk. The ruder, the longer the line.', queueFmt: (t, n) => `${t} | ${n} in line`, tap: 'Tap to continue' },
};

// gesture mode labels (not spoken): the chip verbs, the slap / stamp captions, the start card toggle, hints
const GESTURE_TEXT = {
  zh: { verb: { gun: '甩', shut: '連拍', take: '按住' }, slap: '啪', stamp: '啪！兩個月', strike: '全倒！', input: '操作', gesture: '手勢', buttons: '按鍵',
    hint: { shut: '連拍三下！', gun: '甩出去！', take: '按住蓋章！' } },
  en: { verb: { gun: 'Flick', shut: 'Tap×3', take: 'Hold' }, slap: 'SLAP', stamp: 'SLAM! 2 months', strike: 'STRIKE!', input: 'Controls', gesture: 'Gestures', buttons: 'Buttons',
    hint: { shut: 'Tap 3 times!', gun: 'Flick them out!', take: 'Hold to stamp!' } },
};

// voice mode labels (not spoken): the toggle, the switches, the karaoke tags, the meter marks, the summary row
const VOICE_TEXT = {
  zh: { voice: '吼', whisper: '小聲模式', replay: '回放我的吼', keywords: '聽懂我罵什麼', kwNote: '瀏覽器的語音辨識可能會用雲端服務',
    setup: '小聲客氣', punch: '大聲罵！', marks: ['說', '罵', '吼'], replayBtn: '再聽一次 ▸' },
  en: { voice: 'Shout', whisper: 'Whisper mode', replay: 'Replay my shout', keywords: 'Understand my words', kwNote: "The browser's speech recognizer may use a cloud service",
    setup: 'polite, quiet', punch: 'SHOUT IT!', marks: ['talk', 'yell', 'ROAR'], replayBtn: 'Play again ▸' },
};

// UI chrome icons (art direction 7: icons instead of labels). currentColor unless the colour is part of the meaning.
const ICON = {
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.2" r="5" fill="currentColor"/><path d="M2.5 23 Q2.5 13.6 12 13.6 Q21.5 13.6 21.5 23 Z" fill="currentColor"/></svg>',
  shades: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 7.5 H22.5 V9.5 H21 L19.6 15 Q19 17 16.6 17 H15 Q12.8 17 12.6 14.6 L12.4 11.4 H11.6 L11.4 14.6 Q11.2 17 9 17 H7.4 Q5 17 4.4 15 L3 9.5 H1.5 Z" fill="currentColor"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 Q14 6.5 17.4 9.6 Q20.5 12.6 19.6 16.6 Q18.4 22.5 12 22.5 Q5.6 22.5 4.4 16.6 Q3.7 13 6.6 10.4 Q7 13.6 9.2 14.4 Q8.2 9.4 12 1.5 Z" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5 L20 12 L7 19.5 Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.2" height="15" rx="1.6" fill="currentColor"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.6" fill="currentColor"/></svg>',
  speaker: '<svg viewBox="0 0 18 16" aria-hidden="true"><path d="M1 5.5 H5 L10 1.5 V14.5 L5 10.5 H1Z" fill="currentColor"/><path class="ic-wave" d="M13 5 Q15 8 13 11 M15 3 Q18.5 8 15 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path class="ic-beep" d="M12.4 5 L17 11 M17 5 L12.4 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  hand: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 15 V7 Q5 5.5 6.3 5.5 Q7.6 5.5 7.6 7 V2.4 Q7.6 1 8.9 1 Q10.2 1 10.2 2.4 V8 L13 9 Q14.4 9.6 14 11 L12.6 15Z" fill="currentColor"/></svg>',
  keys: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="4" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 7h1M7 7h2M11 7h1M5 10h6" stroke="currentColor" stroke-width="1.6"/></svg>',
  mic: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1" width="5" height="9" rx="2.5" fill="currentColor"/><path d="M3 7.5 Q3 12 8 12 Q13 12 13 7.5 M8 12 V15" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  star: (on) => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 L25 14 L37 15 L28 23 L31 35 L20 29 L9 35 L12 23 L3 15 L15 14Z" ${on ? 'fill="#FFC21A" stroke="#1B1311" stroke-width="3"' : 'fill="none" stroke="#B9A684" stroke-width="2.5" stroke-dasharray="4 3"'} stroke-linejoin="round"/></svg>`,
};
const INPUT_ICON = { gesture: ICON.hand, buttons: ICON.keys, voice: ICON.mic };
// pause sheet / receipt labels (not spoken)
const SHEET_TEXT = {
  zh: { paused: '暫停', resume: '繼續', lang: '語言', bleep: '髒話', input: '操作', pause: '暫停', noPrefix: 'NO.', open: '開店' },
  en: { paused: 'Paused', resume: 'Resume', lang: 'Language', bleep: 'Swears', input: 'Controls', pause: 'Pause', noPrefix: 'NO.', open: 'Open' },
};

const DEFAULT_UI = {
  zh: { gun: '滾！', shut: '閉嘴！', take: '收！', queue: '排隊', aura: '氣勢', fury: '火氣', start: '開店！', again: '再罵一天', bleep: '消音', combo: '連擊', time: '秒' },
  en: { gun: 'SCRAM!', shut: 'SHUT IT!', take: 'DEAL!', queue: 'Queue', aura: 'Swagger', fury: 'Fury', start: 'OPEN SHOP!', again: 'Rant Again', bleep: 'Bleep', combo: 'Combo', time: 's' },
};

// ---------------------------------------------------------------- pure helpers (exported for tests)

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

/**
 * Camera transform for `.cam { transform-origin: 0 0 }`: keeps focus point F (stage %) fixed on screen
 * while scaling by s. Returns px offsets and the CSS string.
 */
export function camTransform(fx, fy, s, w, h) {
  const px = (fx / 100) * w;
  const py = (fy / 100) * h;
  const tx = px * (1 - s);
  const ty = py * (1 - s);
  return { tx, ty, s, css: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s})` };
}

/** Axis-aligned overlap test; each rect { x, y, w, h } is grown by pad on every side first. */
export function rectsOverlap(a, b, pad = 0) {
  if (!a || !b) return false;
  return a.x - pad < b.x + b.w + pad && b.x - pad < a.x + a.w + pad && a.y - pad < b.y + b.h + pad && b.y - pad < a.y + a.h + pad;
}

/**
 * Largest scale (≤ 2.6, ≥ 1) at which `box` (relative to its anchor (cx, cy), cqw), scaled and rotated by
 * `deg` about the anchor, stays clear of `sign` by 2cqw on each side. No sign → 2.6.
 */
export function hzMaxScale(box, cx, cy, sign, deg = 0) {
  if (!sign) return 2.6;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const at = (k) => {
    const pts = [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]].map(([x, y]) => [(x * c - y * s) * k, (x * s + y * c) * k]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: cx + Math.min(...xs), y: cy + Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  for (let k = 2.6; k > 1; k -= 0.05) if (!rectsOverlap(at(k), sign, 2)) return Math.round(k * 100) / 100;
  return 1;
}

/**
 * 花字 anti-overlap (5.2). Units are cqw (layer width = 100).
 *   box: text box relative to its anchor at size0 { x0, y0, x1, y1 }; anchor (cx, cy)
 *   sign: current sign rect or null; gap: required clearance (4cqw = 2cqw grown on each)
 *   top: highest allowed box top (8% of the stage), bottom: lowest allowed box bottom (layer bottom)
 * Push up first (to `top`), then shrink one unit at a time down to minSize. Returns { cy, size } or null.
 */
export function placeHuazi({ box, cx, cy, size0, sign = null, gap = 4, top = 0, bottom = Infinity, minSize = 9 }) {
  const sizes = [];
  for (let s = size0; s > minSize; s -= 1) sizes.push(s);
  sizes.push(Math.min(size0, minSize));
  for (const size of sizes) {
    const k = size / size0;
    const h0 = box.y0 * k, h1 = box.y1 * k;
    let y = Math.min(cy, bottom - h1);
    for (; y + h0 >= top - 1e-6; y -= 0.5) {
      const r = { x: cx + box.x0 * k, y: y + h0, w: (box.x1 - box.x0) * k, h: h1 - h0 };
      if (r.y + r.h <= bottom + 1e-6 && !rectsOverlap(r, sign, gap / 2)) return { cy: y, size };
    }
  }
  return null;
}

/** Font size (cqw) for a 花字 style and text (5.2), clamped so the text fits in 90cqw. */
export function hzFontSize(style, text, { size, fontSize, latin } = {}) {
  if (fontSize) return fontSize;
  const n = [...String(text)].length;
  let fs;
  switch (style) {
    case 'S1': fs = size === 'sm' ? 12 : n <= 3 ? 24 : n <= 5 ? 18 : 14; break;
    case 'S2': fs = size === 'sm' ? 9 : /^[\d,]+杯?$/.test(text) || /^\d+ ?cups?$/i.test(text) ? 22 : 11; break;
    case 'S3': fs = n <= 10 ? 7.5 : 6; break;
    case 'S4': fs = 9; break;
    case 'S5': fs = 13; break;
    default: fs = 10;
  }
  const em = latin ? 0.52 : 1.02; // rough advance per character
  return Math.max(4, Math.min(fs, 90 / Math.max(1, n * em)));
}



// ---------------------------------------------------------------- DOM helpers

/**
 * Start page framing (art direction 6.3): the scale and offset that show the scene (the lightbox at y 3% down to
 * the counter top at y 49% when the window is tall enough) in the shop window rect `win` ({ x, y, w, h } in stage px, stage W x H). The camera
 * keeps (50%, fy%) fixed while scaling; the shaker then moves that point to the window's top centre by (dx, dy).
 * The scene always covers the window's full width.
 */
export function startFraming(win, W, H, { top = 3, bottom = 49 } = {}) {
  // fit the stage width into the window (the whole lightbox shows); a tall window shows down to the counter, a
  // short one slides down to keep the clerk's face (y 12–33%) in view
  const scale = Math.min(1.6, Math.max(0.5, win.w / W, win.h / H));
  const shown = (win.h / (scale * H)) * 100; // stage % visible in the window
  const fy = shown >= bottom - top ? top : Math.max(top, Math.min(14, 33 - shown));
  return { scale, fy, dx: win.x + win.w / 2 - W / 2, dy: win.y - (fy / 100) * H };

}
/**
 * The logo plate (art direction 7.2; until art.js exports LOGO_SVG): a backlit acrylic sign tilted -4deg with a warm
 * halo, "來" / "杯" in Huninn, "250" in Baloo 2 800 with a gold gradient, an ink outline, a 7-step extrusion and a
 * sheen, and a red "!" sticking out past the right edge. English: "250 CUPS!" in the same build.
 */
export function logoMarkup(lang = 'zh') {
  const g = (id) => `ui-logo-${id}`;
  const extrude = (x, y, size) => Array.from({ length: 7 }, (_, i) => 6 - i)
    .map((i) => `<text x="${x + i}" y="${y + i}" text-anchor="middle" fill="#A85F00" stroke="#1B1311" stroke-width="8" stroke-linejoin="round" paint-order="stroke" style="font:800 ${size}px 'Baloo 2'">250</text>`).join('');
  const num = (x, y, size) => `${extrude(x, y, size)}<text class="lg-250" x="${x}" y="${y}" text-anchor="middle" fill="url(#${g('gold')})" stroke="#1B1311" stroke-width="8" stroke-linejoin="round" paint-order="stroke" style="font:800 ${size}px 'Baloo 2'">250</text>`;
  const bang = (x) => `<text x="${x}" y="108" text-anchor="middle" fill="#EE4130" stroke="#1B1311" stroke-width="5" stroke-linejoin="round" paint-order="stroke" style="font:800 64px 'Baloo 2'">!</text>`;
  const words = lang === 'en'
    ? `${num(118, 118, 96)}<text x="272" y="110" text-anchor="middle" fill="#1B1311" style="font:800 50px 'Baloo 2'">CUPS</text>${bang(343)}`
    : `<text x="52" y="114" text-anchor="middle" fill="#1B1311" style="font:400 60px Huninn">來</text>${num(174, 120, 102)}<text x="298" y="114" text-anchor="middle" fill="#1B1311" style="font:400 60px Huninn">杯</text>${bang(340)}`;
  return `<svg class="logo-svg" viewBox="0 0 360 170" overflow="visible" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="${g('halo')}"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".55"/><stop offset="1" stop-color="#FFE7A8" stop-opacity="0"/></radialGradient>
<linearGradient id="${g('gold')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".42" stop-color="#FFD23A"/><stop offset="1" stop-color="#F29A00"/></linearGradient>
<clipPath id="${g('clip')}"><rect x="16" y="16" width="326" height="138" rx="18"/></clipPath></defs>
<ellipse cx="180" cy="86" rx="205" ry="118" fill="url(#${g('halo')})"/>
<g transform="rotate(-4 180 85)">
<rect x="10" y="10" width="338" height="150" rx="22" fill="#1B1311"/>
<rect x="16" y="16" width="326" height="138" rx="18" fill="#FFF7E6"/>
<rect x="16" y="132" width="326" height="22" fill="#F3E3C2" clip-path="url(#${g('clip')})"/>
<rect x="16" y="16" width="326" height="138" rx="18" fill="none" stroke="#EE4130" stroke-width="4"/>
${words}
<path d="M112 48 Q134 40 156 44" fill="none" stroke="#FFFBE6" stroke-width="6" stroke-linecap="round" opacity=".9"/>
<g clip-path="url(#${g('clip')})"><path class="lg-sheen" d="M60 20 L84 20 L54 150 L30 150 Z" fill="#FFFFFF" opacity="0"/></g>
</g></svg>`;
}

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}
function svgEl(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  if (parent) parent.appendChild(n);
  return n;
}
function html(parent, markup) {
  parent.innerHTML = markup || '';
  return parent.firstElementChild;
}

// "（stage direction）spoken" → spans; "|" (voice cut mark) is never shown. dirs: false drops the stage
// directions (clerk subtitles: the face and the 花字 act them out; 12 px asides were unreadable) unless the
// line is nothing but a direction.
function fillLine(node, text, { dirs = true } = {}) {
  node.textContent = '';
  const parts = String(text ?? '').replace(/\s*\|\s*/g, (m) => (/[A-Za-z]/.test(String(text)) ? ' ' : '')).split(/([（(][^）)]*[）)])/);
  const spoken = parts.some((p) => p && !/^[（(].*[）)]$/.test(p) && p.trim());
  for (const p of parts) {
    if (!p) continue;
    if (/^[（(].*[）)]$/.test(p)) { if (dirs || !spoken) el('span', 'dir', node, p); }
    else el('span', 'say', node, dirs ? p : p.replace(/^\s+/, ''));
  }
}

function fmt(n) {
  return Math.max(0, Math.floor(n || 0)).toLocaleString('en-US');
}
const isLatin = (s) => /[A-Za-z]/.test(s) && !/[㐀-鿿]/.test(s);
const keyColor = (c) => (KEY_COLOR[c] ? `var(--${c}, ${KEY_COLOR[c]})` : c);
const normStyle = (s) => (typeof s === 'number' ? 'S' + s : /^[1-5]$/.test(String(s)) ? 'S' + s : String(s || 'S3'));


// ---------------------------------------------------------------- createUI

export function createUI(root, { onPress = () => {}, onCharge = () => {}, onRelease = () => {}, onGesture = () => {}, onStart = () => {}, onToggleLang = () => {}, onToggleBleep = () => {}, onToggleInput = () => {}, onVoiceOption = () => {}, onPause = () => {} } = {}) {
  let lang = 'zh';
  let extLocked = false; // lockInput()
  let extTimer = 0;
  let bleepOn = false;
  let texts = { ...DEFAULT_UI.zh };
  let phase = 'idle';
  let hudOpts = { showAura: true, showFury: true, showTime: true };
  const last = {};
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = new Set();
  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, Math.max(0, ms));
    timers.add(t);
    return t;
  };
  const wait = (ms) => new Promise((r) => later(r, ms));

  // ---------- DOM skeleton (2.11): .stage > .shaker > .cam > (.shop, .clerk, .counter, .cust-wrap, .sign)
  root.textContent = '';
  root.classList.add('app');
  // .frame: full-height box around the 9:16 stage; its bleed holds the HUD, subtitles and keys (art direction 4.1)
  const frame = el('div', 'frame', root);
  const stage = el('div', 'stage', frame);
  stage.dataset.phase = 'idle';
  const shaker = el('div', 'shaker', stage);
  const cam = el('div', 'cam', shaker);
  const shop = el('div', 'shop', cam);
  html(shop, art.SHOP_SVG);
  cam.insertAdjacentHTML('beforeend', art.CLERK_SVG);
  const clerk = cam.lastElementChild;
  const counter = el('div', 'counter', cam);
  html(counter, art.COUNTER_SVG);
  const monitorSlot = el('div', 'monitor-slot', cam);
  let monitor = null; // .monitor from art.monitorHTML()
  const custWrap = el('div', 'cust-wrap', cam);
  custWrap.dataset.face = '';
  const signSlot = el('div', 'sign-slot', cam);
  let sign = null; // .sign from art.signSVG(), a direct child of signSlot
  const plateLayer = el('div', 'plate-layer', cam);
  const groupRow = el('div', 'group-row', cam);   // stage 2: the other heads of a group box
  const previewEl = el('div', 'preview', cam);     // stage 2: the next customers' mini signs
  const meterEl = el('div', 'meter', cam);         // stage 2: day 4 ticket meter
  meterEl.hidden = true;

  el('div', 'tint tint-polite', shaker);
  el('div', 'tint tint-rage', shaker);
  const fx = el('div', 'fx-layer', shaker);
  const hzLayer = el('div', 'hz-layer', shaker);
  const hzDefs = svgEl('svg', { class: 'hz-defs', width: 0, height: 0, 'aria-hidden': 'true' }, hzLayer);
  const defs = svgEl('defs', {}, hzDefs);
  const grad = svgEl('linearGradient', { id: 'hzGold', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  svgEl('stop', { offset: '0%', 'stop-color': '#FFF6C2' }, grad);
  svgEl('stop', { offset: '45%', 'stop-color': '#FFD23F' }, grad);
  svgEl('stop', { offset: '100%', 'stop-color': '#F29A00' }, grad);

  const flashEl = el('div', 'flash', stage);
  const letterboxEl = el('div', 'letterbox', stage);

  // HUD (outside the camera)
  // (art direction 7.3, in the top bleed, no panel): person icon + queue number and two thin bars on the left, the
  // round's timer ring and the pause button on the right. The text labels stay in the DOM (tools) but are hidden.
  // 中/EN and 消音 (.tog) sit in .hud-toggles: in the corner on the start / summary / closing cards and before a
  // round, inside the pause sheet while a round runs.
  const hud = el('header', 'hud', stage);
  const hudTop = el('div', 'hud-row', hud);
  const qBox = el('div', 'hud-queue', hudTop);
  html(el('span', 'hud-icon', qBox), ICON.person);
  const qLabel = el('span', 'hud-label', qBox);
  const qNum = el('span', 'hud-qnum', qBox, '0');
  const bars = el('div', 'hud-bars', hudTop);
  function makeBar(cls, icon) {
    const wrap = el('div', 'bar ' + cls, bars);
    html(el('span', 'bar-icon', wrap), icon);
    const label = el('span', 'bar-label', wrap);
    const track = el('div', 'bar-track', wrap);
    const fill = el('div', 'bar-fill', track);
    return { wrap, label, fill };
  }
  const auraBar = makeBar('bar-aura', ICON.shades);
  const furyBar = makeBar('bar-fury', ICON.flame);
  const timeBox = el('div', 'hud-time', hudTop);
  const timeNum = el('span', 'hud-tnum', timeBox, '45');
  const timeUnit = el('span', 'hud-tunit', timeBox);
  const pauseBtn = el('button', 'hud-pause', hudTop);
  pauseBtn.type = 'button';
  html(pauseBtn, ICON.pause);
  hud.dataset.round = '0';
  const toggles = el('div', 'hud-toggles', hudTop);
  const langBtn = el('button', 'tog tog-lang', toggles);
  langBtn.type = 'button';
  const bleepBtn = el('button', 'tog tog-bleep', toggles);
  bleepBtn.type = 'button';
  const comboBox = el('div', 'hud-combo', hud);
  const comboNum = el('span', 'combo-num', comboBox);
  const comboLabel = el('span', 'combo-label', comboBox);
  const quickBox = el('div', 'hud-quick', hud);   // stage 2: fast mouth

  // Subtitle band (y 74–80%) and buttons (y 80–100%)
  const subs = el('section', 'subs', stage);
  // voice mode: the karaoke line sits just above the subtitle band; the loudness meter at the right edge
  const karaokeEl = el('div', 'karaoke', stage);
  karaokeEl.hidden = true;
  const vMeter = el('div', 'vmeter', stage);
  vMeter.hidden = true;
  const vTrack = el('div', 'vm-track', vMeter);
  const vFill = el('div', 'vm-fill', vTrack);
  const vMarks = [0, 1, 2].map((i) => el('span', 'vm-mark vm-mark-' + i, vTrack));
  const vStatus = el('div', 'vm-status', vMeter);
  const pad = el('footer', 'pad', stage);
  const buttons = {};
  KEYS.forEach((key, i) => {
    const b = el('button', 'btn btn-' + key, pad);
    b.type = 'button';
    b.dataset.key = key;
    const ring = el('span', 'ring', b);
    const icon = el('span', 'key-icon', b);
    html(icon, art.KEY_ICONS[key]);
    const label = el('span', 'btn-label', b);
    el('span', 'btn-hint', b, 'JKL'[i]);
    if (key === 'shut') html(el('span', 'key-lock', b), '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#FFF4DC" stroke-width="2.6" stroke-linecap="round"/><rect x="4.5" y="11" width="15" height="10" rx="2.5" fill="#FFF4DC" stroke="#1B1311" stroke-width="1.6"/><circle cx="12" cy="16" r="1.8" fill="#1B1311"/></svg>');
    buttons[key] = { b, ring, icon, label, down: 0, raf: 0, src: null, level: 0 };
  });
  // gesture mode: the pad is a counter top with three tiny gesture chips (day 1 only; guides light them up)
  const chips = {};
  const chipRow = el('div', 'gchips', pad);
  KEYS.forEach((key) => {
    const c = el('div', 'gchip gchip-' + key, chipRow);
    c.dataset.key = key;
    html(el('span', 'gchip-icon', c), art.GESTURE_ICONS[key]);
    chips[key] = { c, label: el('span', 'gchip-label', c) };
  });

  // Guidance + overlays
  const guideSvg = svgEl('svg', { class: 'guide-line', 'aria-hidden': 'true' }, stage);
  guideSvg.hidden = true;
  const fingerEl = el('div', 'finger', stage);
  fingerEl.hidden = true;
  html(fingerEl, art.FINGER_SVG);
  const tipLayer = el('div', 'tip-layer', stage);
  const gateEl = el('div', 'gate', stage);
  gateEl.hidden = true;
  const recapEl = el('div', 'recap', stage);
  recapEl.hidden = true;
  const startCard = el('div', 'overlay start-screen hidden', stage);
  const summaryCard = el('div', 'overlay summary hidden', stage);
  const eventEl = el('div', 'event-panel', stage); // stage 2: mini events
  eventEl.hidden = true;
  const shutterEl = el('div', 'shutter-fx', stage);
  shutterEl.hidden = true;
  const bannerEl = el('div', 'day-banner', stage);
  bannerEl.hidden = true;
  const skipBtn = el('button', 'skip', stage);
  skipBtn.type = 'button';
  skipBtn.hidden = true;
  // Pause sheet (art direction 7.3): resume, 中文·EN, 消音, controls. The two .tog buttons move in while it is open.
  const pauseEl = el('div', 'pause-sheet', stage);
  pauseEl.hidden = true;
  const psPanel = el('div', 'ps-panel', pauseEl);
  const psTitle = el('h2', 'ps-title', psPanel);
  const psRows = {};
  for (const k of ['lang', 'bleep', 'input']) {
    const row = el('div', 'ps-row ps-' + k, psPanel);
    psRows[k] = { label: el('span', 'ps-label', row), slot: el('div', 'ps-slot', row) };
  }
  const psModes = {};
  for (const m of ['gesture', 'buttons', 'voice']) {
    const b = el('button', 'ps-opt', psRows.input.slot);
    b.type = 'button';
    b.dataset.mode = m;
    html(el('span', 'ps-opt-icon', b), INPUT_ICON[m]);
    psModes[m] = el('span', 'ps-opt-label', b);
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (selMode === m) return;
      setInputMode(m);
      onToggleInput(m);
    });
  }
  const psResume = el('button', 'ps-resume ui-gold', psPanel);
  psResume.type = 'button';
  let paused = false;
  function syncPauseTexts() {
    const st = SHEET_TEXT[lang] || SHEET_TEXT.zh;
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    const vt = VOICE_TEXT[lang] || VOICE_TEXT.zh;
    psTitle.textContent = st.paused;
    psResume.textContent = st.resume;
    psRows.lang.label.textContent = st.lang;
    psRows.bleep.label.textContent = st.bleep;
    psRows.input.label.textContent = gt.input;
    psModes.gesture.textContent = gt.gesture;
    psModes.buttons.textContent = gt.buttons;
    psModes.voice.textContent = vt.voice;
    pauseBtn.setAttribute('aria-label', st.pause);
    for (const [m, l] of Object.entries(psModes)) l.parentElement.setAttribute('aria-pressed', String(selMode === m));
  }
  function openPause() {
    if (paused) return;
    paused = true;
    KEYS.forEach((k) => endHold(k));
    resetGestures();
    psRows.lang.slot.append(langBtn);
    psRows.bleep.slot.append(bleepBtn);
    syncPauseTexts();
    pauseEl.hidden = false;
    syncLock();
    onPause(true);
  }
  function closePause() {
    if (!paused) return;
    paused = false;
    toggles.append(langBtn, bleepBtn);
    pauseEl.hidden = true;
    syncLock();
    onPause(false);
  }
  pauseBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openPause(); });
  psResume.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closePause(); });
  pauseEl.addEventListener('pointerdown', (e) => { if (e.target === pauseEl) { e.preventDefault(); closePause(); } });

  // Stage geometry helpers
  const stageRect = () => stage.getBoundingClientRect();
  function relRect(node) {
    const s = stageRect();
    const r = node.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, sw: s.width, sh: s.height };
  }

  // ---------- Texts / toggles ----------
  function applyTexts() {
    qLabel.textContent = texts.queue;
    timeUnit.textContent = texts.time || DEFAULT_UI[lang].time;
    auraBar.label.textContent = texts.aura;
    furyBar.label.textContent = texts.fury;
    comboLabel.textContent = texts.combo || DEFAULT_UI[lang].combo;
    for (const k of KEYS) {
      const lab = buttons[k].label;
      const t = String(texts[k] ?? '');
      lab.textContent = t;
      const w = [...t].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 2 : /[A-Z]/.test(ch) ? 1.3 : 1), 0); // rough glyph width; CJK counts double
      lab.classList.toggle('long', w > 6 && w <= 9);
      lab.classList.toggle('xlong', w > 9);
    }
    // gesture chips: the key's word only (art direction 7.6: the finger shows the move, no verbs)
    for (const k of KEYS) chips[k].label.textContent = String(texts[k] ?? '').replace(/[！!]+$/, '');
    langBtn.innerHTML = lang === 'zh' ? '<b>中</b><i>/</i>EN' : '中<i>/</i><b>EN</b>';
    langBtn.setAttribute('aria-label', lang === 'zh' ? 'English' : '中文');
    bleepBtn.innerHTML = `<span class="tog-icon">${ICON.speaker}</span><span class="tog-text"></span>`;
    bleepBtn.lastElementChild.textContent = texts.bleep;
    bleepBtn.classList.toggle('on', bleepOn);
    bleepBtn.setAttribute('aria-pressed', String(bleepOn));
    root.lang = lang === 'zh' ? 'zh-Hant-TW' : 'en'; // Chinese is Traditional (Taiwan) at the source
    stage.dataset.lang = lang;
    syncPauseTexts();
    localizeProps();
  }

  // Scene props follow the language (review: the English build still showed 翡翠檸檬 / 黃金比例 / 現點現做).
  // art.SHOP_SVG menu box: .lb-1 / .lb-2 (name, price tspans), #goldsign (two lines)
  const PROPS = {
    zh: { lb1: ['翡翠檸檬', '75'], lb3: ['珍珠奶茶', '55'], lb2: ['黃金比例', '不能調'], caller: '取餐號碼', plaque: '現點現做' },
    en: { lb1: ['JADE TEA', '75'], lb3: ['BOBA TEA', '55'], lb2: ['GOLD MIX', 'NO EDITS'], caller: 'ORDER NO.', plaque: 'MADE FRESH' },
  };
  function localizeProps() {
    const P = PROPS[lang] || PROPS.zh;
    const set = (sel, vals) => shop.querySelectorAll(sel).forEach((t) => {
      const sp = t.querySelectorAll('tspan');
      vals.forEach((v, i) => { if (sp[i] && sp[i].textContent !== v) sp[i].textContent = v; });
    });
    set('.lb-1', P.lb1);
    set('.lb-2', P.lb3);
    set('.goldsign', P.lb2);
    const cl = shop.querySelector('.caller-label');
    if (cl) cl.textContent = P.caller;
    const pl = counter.querySelector('.plaque-text');
    if (pl) pl.textContent = P.plaque;
    shop.classList.toggle('latin', lang === 'en');
    counter.classList.toggle('latin', lang === 'en');
    if (monitor && monitor.dataset.lang !== lang) { monitorMarkup = ''; paintMonitor(last.queue || 0); } // 門口 / DOOR
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
  const overlayUp = () => !startCard.classList.contains('hidden') || !summaryCard.classList.contains('hidden')
    || !!closingEl || !recapEl.hidden || paused;
  function inputLocked() {
    return extLocked || phase === 'over' || overlayUp();
  }
  function syncLock() {
    stage.dataset.locked = inputLocked() ? '1' : '0';
    // a card is up (start / summary / closing): only the corner toggles of the HUD stay above it
    stage.classList.toggle('carded', !startCard.classList.contains('hidden') || !summaryCard.classList.contains('hidden') || !!closingEl);
  }
  function lockInput(ms) {
    extLocked = true;
    clearTimeout(extTimer);
    KEYS.forEach((k) => endHold(k));
    resetGestures();
    if (ms > 0) extTimer = setTimeout(unlockInput, ms);
    syncLock();
  }
  function unlockInput() {
    clearTimeout(extTimer);
    extLocked = false;
    syncLock();
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
    try { navigator.vibrate?.(10); } catch { /* optional */ }
    onPress(key, 0);
    if (!s.down || inputLocked()) return; // the press itself may have locked input
    const loop = () => {
      const ms = performance.now() - s.down;
      const p = Math.min(1, ms / CHARGE_MS[1]);
      const lvl = chargeLevel(ms);
      s.b.style.setProperty('--charge', p.toFixed(3));
      s.b.dataset.charge = String(lvl);
      if (lvl > s.level && !inputLocked()) {
        s.level = lvl;
        onCharge(key, lvl);
      }
      if (lvl >= 2 || inputLocked()) return;
      s.raf = requestAnimationFrame(loop);
    };
    s.raf = requestAnimationFrame(loop);
  }
  function endHold(key) {
    const s = buttons[key];
    if (!s.down) return;
    const heldMs = performance.now() - s.down;
    cancelAnimationFrame(s.raf);
    s.down = 0;
    s.src = null;
    s.level = 0;
    s.b.classList.remove('held');
    s.b.style.setProperty('--charge', '0');
    s.b.dataset.charge = '0';
    onRelease(key, heldMs);
  }

  for (const key of KEYS) {
    const { b } = buttons[key];
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch { /* not supported */ }
      beginHold(key, 'pointer');
    });
    b.addEventListener('pointerup', (e) => { e.preventDefault(); endHold(key); });
    b.addEventListener('pointercancel', () => endHold(key));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  let overlayTap = null; // Enter / Space handler of the visible tap-to-continue screen
  const onKeyDown = (e) => {
    const key = KEYBOARD[e.key?.toLowerCase()];
    if (key) {
      e.preventDefault();
      if (!e.repeat) beginHold(key, 'kbd');
      return;
    }
    if (e.key === 'Escape' && !e.repeat && (paused || hud.dataset.round === '1')) {
      e.preventDefault();
      if (paused) closePause(); else openPause();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && paused) {
      e.preventDefault();
      closePause();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && overlayTap) {
      e.preventDefault();
      overlayTap();
    }
  };
  const onKeyUp = (e) => {
    const key = KEYBOARD[e.key?.toLowerCase()];
    if (key && buttons[key].src === 'kbd') { e.preventDefault(); endHold(key); }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => KEYS.forEach((k) => endHold(k)));

  // ---------- Gesture input (docs/gameplay-v2.md 9) ----------
  // The surface covers the play area (scene + counter top) above the subtitles and the pad; it only takes pointers in
  // gesture mode. src/gesture.js decides each stroke (swipe at 40 px, hold at 180 ms, tap on up); ui.js adds what is
  // under the finger (rage heads) and draws the trail; main.js maps the gestures to the engine keys.
  const gsurf = el('div', 'gsurf', stage);
  const trailSvg = svgEl('svg', { class: 'g-trail', 'aria-hidden': 'true' }, gsurf);
  const stampEl = el('div', 'g-stamp', cam);
  stampEl.hidden = true;
  html(el('div', 'g-stamp-handle', stampEl), '');
  const stampFace = el('div', 'g-stamp-face', stampEl);
  const pinsEl = el('div', 'g-pins', cam);
  for (let i = 0; i < 3; i++) {
    const pin = el('div', 'g-pin', pinsEl);
    pin.style.setProperty('--i', String(i));
    html(pin, art.queueSilhouetteSVG(i)); // the queue silhouettes outside are the pins (art direction v2 §5.4)
  }
  const rageRow = el('div', 'rage-row', cam);
  const recog = createRecognizer({ onGesture: recognized });
  const swipes = new Map(); // pointer id → { pts: [[x, y]], heads: Set }
  let gLoop = 0;

  const ptOf = (e) => { const s = stageRect(); return { x: e.clientX - s.left, y: e.clientY - s.top }; };
  function liveHeads() {
    return [...rageRow.querySelectorAll('.rage-head:not(.out):not(.gone)')].map((h) => ({ n: Number(h.dataset.n), r: relRect(h) }));
  }
  const inRect = (x, y, r, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
  function headAt(x, y) {
    const hit = liveHeads().find((h) => inRect(x, y, h.r, 6));
    return hit ? hit.n : null;
  }
  // the heads a swipe segment crosses (sampled every 6 px)
  function crossHeads(px, py, x, y, seen, out) {
    const heads = liveHeads();
    if (!heads.length) return;
    const n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 6));
    for (let i = 0; i <= n; i++) {
      const sx = px + ((x - px) * i) / n;
      const sy = py + ((y - py) * i) / n;
      for (const h of heads) if (!seen.has(h.n) && inRect(sx, sy, h.r, 4)) { seen.add(h.n); out.push(h.n); }
    }
  }
  function drawTrail() {
    trailSvg.textContent = '';
    const s = stageRect();
    trailSvg.setAttribute('viewBox', `0 0 ${s.width.toFixed(0)} ${s.height.toFixed(0)}`);
    for (const sw of swipes.values()) {
      if (sw.pts.length < 2) continue;
      const d = sw.pts.slice(-14).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
      svgEl('path', { d, class: 'g-trail-path' }, trailSvg);
    }
  }
  function recognized(e) {
    if (inputMode !== 'gesture') return;
    if (e.type === 'swipe') swipes.set(e.id, { pts: [[e.x0, e.y0], [e.x, e.y]], heads: new Set() });
    if (e.type === 'tap') {
      const h = headAt(e.x, e.y);
      if (h != null) e.head = h;
    }
    onGesture(e);
    if (e.type === 'swipeMove') {
      const sw = swipes.get(e.id);
      if (!sw) return;
      sw.pts.push([e.x, e.y]);
      drawTrail();
      const crossed = [];
      crossHeads(e.px, e.py, e.x, e.y, sw.heads, crossed);
      for (const head of crossed) onGesture({ type: 'cross', head, id: e.id });
    }
    if (e.type === 'swipeEnd') {
      swipes.delete(e.id);
      const old = trailSvg.querySelectorAll('.g-trail-path');
      old.forEach((p) => p.classList.add('fade'));
      later(() => { if (!swipes.size) trailSvg.textContent = ''; }, 220);
    }
  }
  // the recognizer is ticked every frame only while it has something to decide (a pointer down, a tap burst open)
  function gTick() {
    gLoop = 0;
    if (inputMode !== 'gesture') return;
    recog.tick(performance.now());
    if (recog.pending) gLoop = requestAnimationFrame(gTick);
  }
  const wakeGestures = () => { if (!gLoop && inputMode === 'gesture') gLoop = requestAnimationFrame(gTick); };
  function resetGestures() {
    if (recog.active || stampLevel != null) onGesture({ type: 'reset' });
    recog.reset();
    swipes.clear();
    trailSvg.textContent = '';
    stampHold(null);
  }
  gsurf.addEventListener('pointerdown', (e) => {
    if (inputMode !== 'gesture') return;
    e.preventDefault();
    if (inputLocked()) return;
    try { gsurf.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const p = ptOf(e);
    recog.down(e.pointerId, p.x, p.y, performance.now());
    wakeGestures();
  });
  gsurf.addEventListener('pointermove', (e) => {
    if (inputMode !== 'gesture') return;
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const c of list.length ? list : [e]) {
      const p = ptOf(c);
      recog.move(e.pointerId, p.x, p.y, performance.now());
    }
  });
  gsurf.addEventListener('pointerup', (e) => {
    if (inputMode !== 'gesture') return;
    e.preventDefault();
    const p = ptOf(e);
    recog.tick(performance.now()); // a hold that started since the last frame starts before it ends
    recog.up(e.pointerId, p.x, p.y, performance.now());
    wakeGestures();
  });
  gsurf.addEventListener('pointercancel', (e) => recog.cancel(e.pointerId, performance.now()));
  gsurf.addEventListener('contextmenu', (e) => e.preventDefault());

  let inputMode = 'buttons';
  let selMode = 'buttons'; // what the start card toggle shows: 'gesture' | 'buttons' | 'voice' (voice keeps gestures on)
  let syncInputTog = () => {};
  function setInputMode(mode) {
    selMode = mode === 'voice' || mode === 'gesture' ? mode : 'buttons';
    inputMode = selMode === 'buttons' ? 'buttons' : 'gesture';
    stage.dataset.input = inputMode;
    stage.dataset.voice = selMode === 'voice' ? '1' : '0';
    syncInputTog();
    if (paused) syncPauseTexts();
    KEYS.forEach((k) => endHold(k));
    resetGestures();
    cancelAnimationFrame(gLoop);
    gLoop = 0;
  }
  function setGestureHints(on) {
    stage.dataset.ghints = on ? '1' : '0';
  }
  const vibe = (p) => { try { navigator.vibrate?.(p); } catch { /* optional */ } };

  // 連拍: each tap is a cartoon slap on the counter-side of the face: a squash, a "啪" pop, a tiny shake. No marks.
  function slap(n = 1, { x, y } = {}) {
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    const clip = custWrap.querySelector('.cust-clip');
    if (clip && current && !custWrap.dataset.face) {
      clip.animate([{ transform: 'scale(1,1)' }, { transform: `scale(${1.1 + n * 0.03},${0.86 - n * 0.03}) translateX(${n % 2 ? 3 : -3}%)` }, { transform: 'scale(1,1)' }],
        { duration: 160, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    }
    const p = Number.isFinite(x) ? { x, y } : (() => { const r = relRect(custWrap); return { x: r.x + r.w * 0.5, y: r.y + r.w * 0.2 }; })();
    const pa = el('div', 'g-pa', fx, gt.slap);
    pa.dataset.n = String(Math.min(5, n));
    Object.assign(pa.style, { left: p.x + 'px', top: p.y + 'px' });
    pa.style.setProperty('--rot', `${(n % 2 ? -1 : 1) * (8 + n * 3)}deg`);
    later(() => pa.remove(), 520);
    shake(2 + Math.min(4, n), 60);
    vibe(n >= 3 ? [12, 30, 12] : 8);
  }

  // 按住蓋章: the stamp grows above the head while held (charge 0 / 1 / 2); null hides it
  let stampLevel = null;
  function stampHold(level) {
    if (level == null) {
      stampLevel = null;
      stampEl.hidden = true;
      stampEl.className = 'g-stamp';
      return;
    }
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    if (stampLevel == null) {
      stampFace.textContent = texts.take ? String(texts.take).replace(/[！!]/g, '') : gt.verb.take;
      stampEl.hidden = false;
      restart(stampEl, 'in');
    }
    stampLevel = level;
    stampEl.dataset.level = String(level);
    if (level >= 2) vibe([20, 20, 20]);
    else if (level === 1) vibe(15);
  }
  function stampSlam(text) {
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    if (stampEl.hidden) { stampHold(0); }
    stampEl.classList.remove('in');
    restart(stampEl, 'slam');
    later(() => stampHold(null), 260);
    const r = relRect(custWrap);
    const pa = el('div', 'g-pa g-pa-stamp', fx, text || gt.stamp);
    Object.assign(pa.style, { left: r.x + r.w * 0.5 + 'px', top: r.y + r.w * 0.12 + 'px' });
    later(() => pa.remove(), 900);
    shake(8, 160);
    vibe([30, 40, 60]);
  }

  // 甩: the next fly-out follows the swipe (initial velocity from its speed, spin, gravity, off screen)
  let pendingFling = null;
  function setFling(sw) {
    pendingFling = sw && sw.dir ? { dir: sw.dir, speed: sw.speed || 1, at: performance.now() } : null;
  }
  function takeFling() {
    const f = pendingFling;
    pendingFling = null;
    return f && performance.now() - f.at < 4000 ? f : null;
  }
  function physics(node, { dir, speed }, onDone) {
    const v = Math.max(0.9, Math.min(2.6, speed * 0.9));
    // a 50 ms hit-stop (squashed the way of the swipe) before the flight: the hand connects, then they go
    const HIT_STOP = lite ? 0 : 50;
    const t0 = performance.now() + HIT_STOP;
    const st = { x: 0, y: 0, vx: dir.x * v, vy: dir.y * v - 0.25, r: 0, w: (dir.x >= 0 ? 1 : -1) * (0.5 + speed * 0.35), t0, last: t0 };
    if (HIT_STOP) node.style.transform = `translate(${(dir.x * 6).toFixed(1)}px, ${(dir.y * 6).toFixed(1)}px) scale(${1 + Math.abs(dir.x) * 0.12}, ${1 - Math.abs(dir.x) * 0.1})`;
    node._phys = st;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const step = (now) => {
      if (now < st.t0) { st.raf = requestAnimationFrame(step); return; }
      const dt = Math.min(40, now - st.last);
      st.last = now;
      st.vy += 0.0042 * dt;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      st.r += st.w * dt;
      node.style.transform = `translate(${st.x.toFixed(1)}px, ${st.y.toFixed(1)}px) rotate(${st.r.toFixed(1)}deg)`;
      if (now - st.t0 > 1100 || Math.abs(st.x) > W * 1.3 || st.y > H || st.y < -H) { node._phys = null; onDone?.(); return; }
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
    return st;
  }

  // the queue at the right edge: a fling that way knocks over 1–3 of them (3 = STRIKE)
  function bowl(n = 1, text) {
    const pins = [...pinsEl.querySelectorAll('.g-pin')];
    pins.slice(0, Math.max(0, Math.min(3, n))).forEach((p, i) => {
      p.style.setProperty('--d', `${120 + i * 70}ms`);
      restart(p, 'down');
      later(() => p.classList.remove('down'), 1300);
    });
    if (n >= 3) {
      const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
      later(() => huazi([{ text: text || gt.strike, style: 'S2', seg: 'punch', ratio: 0 }]), 260);
      vibe([20, 30, 20, 30, 60]);
    }
  }

  // gesture rage: half heads pop in a row; one swipe can cross several
  const RAGE_SLOTS = 4;
  function rageHeadAdd(customer, n, { liveMs = 1200 } = {}) {
    if (!customer) return;
    const h = el('div', 'rage-head', rageRow);
    h.dataset.n = String(n);
    h.dataset.key = customer.key || 'gun';
    const slot = String((n - 1) % RAGE_SLOTS);
    for (const old of rageRow.querySelectorAll(`.rage-head[data-slot="${slot}"]`)) old.remove();
    h.dataset.slot = slot;
    h.style.setProperty('--i', slot);
    h.innerHTML = `<div class="cust-clip">${art.customerSVG(customer, 1)}</div>`;
    const m = miniSign(h, art.signKind ? art.signKind(customer) : customer.key, '');
    m.classList.add('rage-mini');
    later(() => {
      if (!h.isConnected || h.classList.contains('out')) return;
      h.classList.add('gone');
      later(() => h.remove(), 260);
    }, liveMs);
  }
  function rageHeadHit(n, key, sw) {
    const h = rageRow.querySelector(`.rage-head[data-n="${n}"]`);
    if (!h || h.classList.contains('out')) return false;
    h.classList.add('out');
    h.dataset.face = key;
    if (sw && sw.dir) { h.classList.add('phys'); physics(h, sw, () => h.remove()); }
    else later(() => h.remove(), 560);
    return true;
  }
  function clearRageHeads() {
    rageRow.textContent = '';
  }

  function gestureHint(key, text) {
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    const c = chips[key]?.c;
    if (c) { restart(c, 'hint-flash'); later(() => c.classList.remove('hint-flash'), 420); }
    const t = el('div', 'g-hint', fx, text || gt.hint[key] || '');
    t.dataset.key = key;
    later(() => t.remove(), 1100);
  }

  // ---------- Lite mode (spec K4, A13) ----------
  // Slow devices get hard camera cuts instead of glides and no idle loops (clerk breathing, monitor scan /
  // blink, sign burst spin, eye drift): those were most of the long frames at 4x CPU. Detected on the start
  // card or later in play (any 30-frame window after the first with 6+ frames over 32 ms; gaps over 250 ms, e.g.
  // a hidden tab, do not count), or forced with setLite(true|false) (?lite=1|0). Once on, it stays on.
  let lite = false;
  let liteForced = false;
  function setLite(on, { auto = false } = {}) {
    if (auto && liteForced) return;
    if (!auto) liteForced = true;
    lite = !!on;
    stage.classList.toggle('lite', lite);
  }
  if (typeof requestAnimationFrame === 'function') {
    let n = 0, slow = 0, last = 0, windows = 0;
    const step = (t) => {
      const d = last ? t - last : 0;
      last = t;
      if (d > 0 && d < 250) {
        n++;
        if (d > 32) slow++;
        if (n >= 30) {
          if (windows++ > 0 && slow >= 6) setLite(true, { auto: true });
          n = 0;
          slow = 0;
        }
      }
      if (!lite) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- Camera + screen fx (2.11) ----------
  const camState = { f: FOCUS.WIDE, s: 1 };
  function camera(focus = 'WIDE', scale = 1, ms = 0, ease) {
    if (lite) ms = 0; // K4: cuts instead of glides on slow devices
    const f = Array.isArray(focus) ? focus : FOCUS[focus] || FOCUS.WIDE;
    const s = reduced ? Math.min(scale, 1.1) : scale;
    camState.f = f;
    camState.s = s;
    const t = camTransform(f[0], f[1], s, stage.clientWidth, stage.clientHeight);
    cam.style.setProperty('--cam-ms', Math.max(0, ms) + 'ms');
    cam.style.setProperty('--cam-ease', ease || (ms <= 120 ? EASE_FAST : EASE));
    cam.classList.toggle('snap', !(ms > 0));
    cam.style.transform = t.css;
    cam.dataset.focus = typeof focus === 'string' ? focus : focus.join(',');
    return t;
  }
  addEventListener('resize', () => {
    const t = camTransform(camState.f[0], camState.f[1], camState.s, stage.clientWidth, stage.clientHeight);
    cam.classList.add('snap');
    cam.style.transform = t.css;
  });

  function flash(ms = 40) {
    if (reduced) return;
    flashEl.animate([{ opacity: 0 }, { opacity: 0.85, offset: Math.min(0.4, 20 / ms) }, { opacity: 0.85, offset: ms > 60 ? 0.55 : 0.4 }, { opacity: 0 }], { duration: ms, easing: 'linear' });
  }

  // Manga focus lines behind everything on the stage (the 調你媽 beat): CSS conic stripes, no filters.
  function speedLines(ms = 700) {
    if (reduced) return;
    const n = el('div', 'speedlines', shaker);
    n.animate([{ opacity: 0, transform: 'scale(1.25)' }, { opacity: 1, transform: 'scale(1)', offset: 0.12 }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: 'scale(1.05)' }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
    later(() => n.remove(), ms);
  }

  function shake(px = 6, ms = 200) {
    const a = reduced ? px / 2 : px;
    const frames = [];
    const n = Math.max(3, Math.round(ms / 33));
    for (let i = 0; i < n; i++) {
      const k = 1 - i / n;
      const dx = (i % 2 ? -1 : 1) * a * k;
      const dy = ((i * 7) % 3 - 1) * a * 0.6 * k;
      frames.push({ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` });
    }
    frames.push({ transform: 'translate(0,0)' });
    shaker.animate(frames, { duration: ms, easing: 'linear' });
  }

  let freezeTimer = 0;
  let frozen = [];
  function freeze(ms = 60) {
    clearTimeout(freezeTimer);
    const anims = typeof stage.getAnimations === 'function' ? stage.getAnimations({ subtree: true }) : [];
    // hit-stop: the world stops, the 花字 caption keeps playing (its removal timer would cut a paused exit)
    frozen = anims.filter((a) => a.playState === 'running' && !a.effect?.target?.closest?.('.hz-layer'));
    frozen.forEach((a) => a.pause());
    stage.classList.add('freeze');
    freezeTimer = setTimeout(() => {
      stage.classList.remove('freeze');
      frozen.forEach((a) => { try { a.play(); } catch { /* finished */ } });
      frozen = [];
    }, ms);
  }

  let lbCount = 0;
  function letterbox(on) {
    lbCount = Math.max(0, lbCount + (on ? 1 : -1));
    letterboxEl.classList.toggle('on', lbCount > 0);
  }

  function gate(open = true, ms = 500) {
    if (open === 'close' || open === false) {
      html(gateEl, art.DOOR_GATE_SVG);
      gateEl.classList.remove('open');
      gateEl.hidden = false;
      return Promise.resolve();
    }
    if (gateEl.hidden) return Promise.resolve();
    gateEl.style.transitionDuration = ms + 'ms';
    void gateEl.offsetWidth;
    gateEl.classList.add('open');
    return wait(ms).then(() => { gateEl.hidden = true; gateEl.classList.remove('open'); gateEl.style.transitionDuration = ''; });
  }

  function goldsign(on) {
    shop.toggleAttribute('data-gold', !!on);
  }

  function setTicket(n) {
    last.ticket = n;
    const t = shop.querySelector('#callnum');
    if (!t) return;
    t.textContent = String(Math.max(0, n | 0)).padStart(3, '0');
    t.animate?.([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 160, easing: 'ease-out' });
  }

  // ---------- Clerk ----------
  let moodTimer = 0;
  function setClerk(mood, ms = 0) {
    clearTimeout(moodTimer);
    clerk.dataset.mood = mood;
    clerk.setAttribute('data-mood', mood);
    if (ms) moodTimer = setTimeout(() => setClerk(phase === 'rage' ? 'rage' : phase === 'over' ? 'over' : 'idle'), ms);
  }
  // art CLERK_SVG overlay classes: squint crack brow look-down sigh tidy point-sign reach stand.
  const FLAG_CLASS = { pointUp: 'point-sign', pointSign: 'point-sign', peekTicket: 'reach', reach: 'reach', headDown: 'look-down', lookDown: 'look-down' };
  function setClerkFlags(flags = {}) {
    for (const [k, v] of Object.entries(flags)) {
      const cls = FLAG_CLASS[k] || k;
      if (cls === 'crack' && v) { clerk.classList.remove('crack'); void clerk.getBoundingClientRect(); }
      clerk.classList.toggle(cls, !!v);
    }
  }
  /** Cancel a running three-beat and go back to the resting face (a new customer arrives). */
  function resetClerk() {
    beatTimers.forEach(clearTimeout);
    beatTimers = [];
    beatActive = false;
    clearTimeout(moodTimer);
    setClerkFlags({ squint: false, tidy: false, crack: false, reach: false, pointSign: false, lookDown: false, sigh: false, brow: false });
    setClerk(phase === 'rage' ? 'rage' : phase === 'over' ? 'over' : 'idle');
  }
  function clerkTap() {
    clerk.classList.remove('tap');
    void clerk.getBoundingClientRect();
    clerk.classList.add('tap');
    later(() => clerk.classList.remove('tap'), 400);
  }
  let beatTimers = [];
  let beatActive = false;
  function clerkBeat({ setupMs = 0, punchStartMs, punchMs = 600, landMs = 650, shake: sh, flash: fl, fx: kind } = {}) {
    beatTimers.forEach(clearTimeout);
    beatTimers = [];
    clearTimeout(moodTimer);
    beatActive = true;
    const ps = Math.max(0, punchStartMs ?? setupMs);
    const at = (ms, fn) => beatTimers.push(setTimeout(fn, Math.max(0, ms)));
    const px = sh ?? (kind === 'mega' ? 14 : kind === 'curse' ? 10 : kind === 'normal' ? 6 : 0);
    const doFlash = fl ?? (kind === 'curse' || kind === 'mega');
    if (ps > 0) { setClerk('idle'); setClerkFlags({ squint: true }); }
    at(ps, () => {
      setClerkFlags({ squint: false });
      setClerk('hit');
      if (px) shake(px, kind === 'mega' ? 260 : 200);
      if (doFlash) flash();
    });
    at(ps + 300, () => {
      setClerk('perfect');
      setClerkFlags({ tidy: true });
      at(80, () => setClerkFlags({ tidy: false }));
    });
    at(Math.max(ps + 300, ps + punchMs + landMs), () => {
      beatActive = false;
      setClerk(phase === 'rage' ? 'rage' : phase === 'over' ? 'over' : 'idle');
    });
  }

  // ---------- Customer + sign (art.js contract: .cust-wrap classes / data-face, .sign data-state) ----------
  let custGen = 0;
  const visits = new Map();
  let current = null; // { customer, visit, fixed, gray }
  let custLineTimer = 0;
  let custTimers = [];
  const custLater = (fn, ms) => { const t = later(fn, ms); custTimers.push(t); return t; };
  const POSE = { look: 'drift', chin: 'proud', talk: 'talk', drift: 'drift', proud: 'proud', cower: 'cower' };

  function renderCustomer() {
    if (!current) { custWrap.textContent = ''; return; }
    const markup = art.customerSVG(current.customer, current.visit, { fixed: current.fixed, gray: current.gray });
    custWrap.innerHTML = `<div class="cust-clip">${markup}</div>`;
    custWrap.classList.toggle('boss', !!(current.customer && current.customer.boss)); // 1.15x, never clipped (§5.3)
  }

  function restart(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  function showCustomer(customer, opts = {}) {
    if (!customer) return { signUpAt: performance.now(), signUpInMs: 0 };
    const { enter = 'pop', sign: withSign = true, signDelayMs = 120, line = true, fixed } = opts;
    const enterMs = opts.enterMs ?? (enter === 'rise' ? 400 : 220);
    const gen = ++custGen;
    custTimers.forEach((t) => { clearTimeout(t); timers.delete(t); });
    custTimers = [];
    const v = opts.visit ?? ((visits.get(customer.id) || 0) + 1);
    visits.set(customer.id, v);
    current = { customer, visit: v, fixed, gray: false };
    custWrap.className = 'cust-wrap';
    custWrap.dataset.face = '';
    custWrap.dataset.key = customer.key || '';
    renderCustomer();
    const svgC = custWrap.querySelector('.cust');
    if (svgC) svgC.style.animationDuration = enterMs + 'ms';
    restart(custWrap, enter === 'rise' ? 'rise' : 'enter');
    custLater(() => { if (gen === custGen) { custWrap.classList.remove('enter', 'rise'); if (svgC) svgC.style.animationDuration = ''; } }, enterMs + 20);
    stopSignTimer();
    hideSign();
    clearTimeout(custLineTimer);
    const signUpInMs = withSign ? enterMs + signDelayMs + 160 : enterMs;
    if (withSign) {
      const spec = withSign === true ? customer : withSign;
      custLater(() => { if (gen === custGen) showSign(spec, { flip: 'up' }); }, enterMs + signDelayMs);
    }
    if (line && customer.says) {
      custLineTimer = setTimeout(() => {
        if (gen === custGen) showLine(customer.says, { who: 'cust', color: customer.key });
      }, signUpInMs);
    }
    return { signUpAt: performance.now() + signUpInMs, signUpInMs };
  }

  function relabelCustomer(customer) {
    if (!customer) { subs.textContent = ''; return; }
    if (current && current.customer.id === customer.id) current.customer = customer;
    if (sign && signSpec && signSpec.id === customer.id && sign.dataset.state === 'up') {
      signSpec = customer;
      swapSignContent(customer);
    }
    if (last.lineWho === 'cust') showLine(customer.says || '', { who: 'cust', color: customer.key });
    else subs.textContent = '';
  }

  let signSpec = null;
  let signGen = 0;
  // spec: a customer, or { key, sign, cups, sub } for scripted signs (sub = scribble line under a 閉嘴 sign).
  function signMarkup(spec) {
    const kind = spec.kind || (spec.key && !spec.id ? (spec.key === 'take' || spec.key === 'shut' ? spec.key : 'gun') : undefined);
    return art.signSVG(spec, lang, { kind, text: spec.sign != null ? String(spec.sign) : undefined, scribble: spec.sub });
  }
  // gesture mode: the corner badge shows the best gesture for this sign (every gesture still works)
  function gestureBadge(node) {
    if (inputMode !== 'gesture' || !node) return;
    const b = node.querySelector('.sign-badge');
    const k = node.dataset.kind === 'trap' ? 'gun' : node.dataset.kind;
    if (b && art.GESTURE_ICONS[k]) b.innerHTML = art.GESTURE_ICONS[k];
  }
  function mountSign(spec) {
    signSlot.innerHTML = signMarkup(spec);
    sign = signSlot.firstElementChild;
    gestureBadge(sign);
    clearHuaziNear(sign);
    paintMult();
    return sign;
  }

  // Speed multiplier tag on the sign corner (gameplay-v2 3): ×2 while the customer talks, then ×1.5 / ×1.2 as the
  // timer shrinks (startSignTimer steps), none at ×1.
  let multText = '';
  function paintMult() {
    if (!sign) return;
    let tag = sign.querySelector('.sign-mult');
    if (!multText) { tag?.remove(); return; }
    if (!tag) tag = el('b', 'sign-mult', sign.querySelector('.sign-card') || sign);
    if (tag.textContent !== multText) {
      tag.textContent = multText;
      restart(tag, 'pop');
    }
  }
  function setSignMult(text) {
    multText = text ? String(text) : '';
    paintMult();
  }
  const multLabel = (m) => (m > 1 ? '×' + m : '');
  // A new sign has priority (5.2 "絕不壓在牌子上"): a 花字 still showing where it rises ends now.
  function clearHuaziNear(node) {
    if (!liveHz.size) return;
    const r = signRect(node);
    if (!r) return;
    const pad = stage.clientWidth * 0.04; // 2cqw around each box
    const box = { x: r.left, y: r.top, w: r.width, h: r.height };
    for (const svg of [...liveHz]) {
      const hit = [...svg.querySelectorAll('text')].some((t) => {
        const b = t.getBoundingClientRect();
        return b.width && rectsOverlap({ x: b.left, y: b.top, w: b.width, h: b.height }, box, pad / 2);
      });
      if (hit) svg._done?.();
    }
  }
  // Replace the face of the visible sign without re-mounting (page turn, language switch).
  function swapSignContent(spec) {
    if (!sign) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = signMarkup(spec);
    const fresh = tmp.firstElementChild;
    const keep = [...sign.classList].filter((c) => ['page', 'hint', 'flip-in'].includes(c));
    const timer = sign.querySelector('.sign-timer');
    sign.className = fresh.className;
    keep.forEach((c) => sign.classList.add(c));
    sign.dataset.kind = fresh.dataset.kind;
    sign.replaceChildren(...fresh.childNodes);
    gestureBadge(sign);
    if (timer) (sign.querySelector('.sign-card') || sign).appendChild(timer);
  }

  function showSign(spec, { flip = 'up', ms } = {}) {
    if (!spec) return Promise.resolve();
    const g = ++signGen;
    const wasUp = sign && sign.dataset.state === 'up';
    signSpec = spec;
    if (flip === 'rotX' && wasUp) {
      // Page turn (rotateX, 180 ms): swap the face at the half-way point.
      const dur = ms ?? 180;
      restart(sign, 'page');
      return wait(dur / 2).then(() => {
        if (g !== signGen) return;
        swapSignContent(spec);
        return wait(dur / 2);
      }).then(() => { if (g === signGen && sign) sign.classList.remove('page'); });
    }
    mountSign(spec);
    if (flip === 'none') { sign.dataset.state = 'up'; return Promise.resolve(); }
    if (flip === 'rotY' || flip === 'rotX') {
      sign.dataset.state = 'up';
      restart(sign, flip === 'rotY' ? 'flip-in' : 'page');
      const dur = ms ?? 200;
      return wait(dur).then(() => { if (g === signGen && sign) sign.classList.remove('flip-in', 'page'); });
    }
    sign.dataset.state = 'rise';
    return wait(ms ?? 160).then(() => { if (g === signGen && sign && sign.dataset.state === 'rise') sign.dataset.state = 'up'; });
  }

  function hideSign() {
    signGen++;
    stopSignTimer();
    signSlot.textContent = '';
    sign = null;
    signSpec = null;
  }

  // Exit the sign: 'gun' crumple, 'shut' strike + sink, 'take' stamp + slide, anything else generic 150 ms.
  // A sign that is already leaving keeps its exit.
  function signOut(face) {
    if (!sign || String(sign.dataset.state).startsWith('out') || sign.classList.contains('shatter')) return;
    const g = ++signGen;
    stopSignTimer();
    const st = face === 'gun' || face === 'gun2' ? 'out-gun' : face === 'shut' ? 'out-shut' : face === 'take' ? 'out-take' : 'out';
    sign.dataset.state = st;
    if (face === 'gun2') sign.classList.add('to-monitor');
    custLater(() => { if (g === signGen) hideSign(); }, face === 'take' ? 650 : face === 'shut' ? 500 : 560);
  }

  function signFx(kind) {
    if (!sign) return;
    if (kind === 'shatter') {
      // E4: six shards fly out (art contract: <i class="sign-shard"> with --dx --dy --r).
      const g = ++signGen;
      stopSignTimer();
      for (let i = 0; i < 6; i++) {
        const s = el('i', 'sign-shard', sign);
        s.style.setProperty('--i', String(i));
        s.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(1) + 'cqw');
        s.style.setProperty('--dy', (Math.random() * 60 - 20).toFixed(1) + 'cqw');
        s.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
      }
      sign.classList.add('shatter');
      custLater(() => { if (g === signGen) hideSign(); }, 520);
      return;
    }
    if (kind === 'hint' || kind === 'blink') {
      restart(sign, 'hint');
      const s = sign;
      later(() => s.classList.remove('hint'), 400);
    }
  }

  // Sign timer: created only when the window opens (t0) — none during the opening (A2).
  // art contract: <i class="sign-timer"> in .sign-card, style.transform = scaleX(left / total), class blink for the last 600 ms.
  let timer = null; // { el, start, ms, raf }
  function startSignTimer(ms, { steps } = {}) {
    stopSignTimer();
    if (!sign || !(ms > 0)) return;
    const node = el('i', 'sign-timer', sign.querySelector('.sign-card') || sign);
    node.style.transform = 'scaleX(1)';
    // the fast window (speed bonus, steps with mult > 1) as a gold glint on the end of the bar that runs out first
    const hotMs = Array.isArray(steps) ? Math.max(0, ...steps.filter((s) => s[1] > 1).map((s) => s[0])) : 0;
    if (hotMs > 0) el('i', 'sign-timer-hot', node).style.setProperty('--hot', `${(Math.max(0, 1 - hotMs / ms) * 100).toFixed(1)}%`);
    timer = { el: node, start: performance.now(), ms, raf: 0 };
    const tick = () => {
      if (!timer || timer.el !== node) return;
      const used = timer.ms - Math.max(0, timer.ms - (performance.now() - timer.start));
      const left = Math.max(0, timer.ms - (performance.now() - timer.start));
      node.style.transform = `scaleX(${(left / timer.ms).toFixed(4)})`;
      node.classList.toggle('blink', left <= 600);
      if (Array.isArray(steps)) {
        const st = steps.find(([t]) => used < t);
        setSignMult(multLabel(st ? st[1] : 1));
      }
      if (left > 0) timer.raf = requestAnimationFrame(tick);
    };
    timer.raf = requestAnimationFrame(tick);
  }
  function stopSignTimer() {
    if (!timer) return;
    cancelAnimationFrame(timer.raf);
    timer.el.remove();
    timer = null;
  }
  // Keep the bar in step with the engine (the engine owns time: hidden tabs, pauses).
  function syncSignTimer(cur) {
    if (!timer || !cur || !(cur.patienceMaxMs > 0)) return;
    const left = Math.max(0, cur.patienceMs);
    if (Math.abs(timer.ms - timer.ms * (left / cur.patienceMaxMs) - (performance.now() - timer.start)) > 60) {
      timer.ms = cur.patienceMaxMs;
      timer.start = performance.now() - (cur.patienceMaxMs - left);
    }
  }

  const FLY_MS = { gun: 520, gun2: 520, shut: 390, take: 600, suck: 180, sink: 600 };
  function customerReact(face) {
    if (!current) return;
    if (face === 'miss') { restart(custWrap, 'wobble'); later(() => custWrap.classList.remove('wobble'), 450); return; }
    const gen = custGen;
    clearTimeout(custLineTimer);
    if (face === 'suck' || face === 'sink') {
      restart(custWrap, face);
      signOut(face);
    } else {
      // gesture mode: a swipe flings the customer its way (physics) instead of the fixed fly-out
      const fl = inputMode === 'gesture' && (face === 'gun' || face === 'gun2') ? takeFling() : null;
      custWrap.dataset.face = FLY_MS[face] ? face : 'gun';
      const clip = custWrap.querySelector('.cust-clip');
      clip?.classList.add('flying');
      if (face === 'take') setTicket((last.ticket || 0) + 1);
      signOut(face);
      if (fl && clip) {
        custWrap.classList.add('physics');
        physics(clip, fl, () => { if (gen === custGen) clearCustomer(); });
        custLater(() => { if (gen === custGen) clearCustomer(); }, 1250);
        return;
      }
      if (face === 'gun2') custLater(starPop, FLY_MS.gun2);
    }
    custLater(() => { if (gen === custGen) clearCustomer(); }, (FLY_MS[face] || 520) + 80);
  }

  // Jab (gameplay-v2 3): the flying customer gets kicked again: 40% farther per kick (+180° for 滾), shake
  // 4 px / 80 ms, freeze 30 ms, the key's word as a small S4. A customer not flying yet (the clerk is still in the
  // setup) wobbles instead.
  const KICK = { gun: [-36, -20, -180], gun2: [-22, -34, -180], shut: [0, 14, 0], take: [32, -3, 0] };
  function kick(face, { word, n = 1 } = {}) {
    const clip = custWrap.querySelector('.cust-clip');
    const flying = current && clip && custWrap.dataset.face && KICK[custWrap.dataset.face];
    if (clip && clip._phys) {
      // a flung customer (gesture mode) gets another push the way they fly
      clip._phys.vx *= 1.35;
      clip._phys.vy -= 0.35;
      clip._phys.w *= 1.4;
    } else if (flying) {
      const k0 = clip._kicks || 0;
      const k1 = k0 + 1;
      clip._kicks = k1;
      const [dx, dy, r] = KICK[custWrap.dataset.face];
      const at = (k) => `translate(${dx * k}cqw, ${dy * k}cqw) rotate(${r * k}deg)`;
      try { clip._kickAnim?.cancel(); } catch { /* finished */ }
      clip._kickAnim = clip.animate([{ transform: at(k0) }, { transform: at(k1) }], { duration: 120, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    } else if (current) {
      restart(custWrap, 'wobble');
      later(() => custWrap.classList.remove('wobble'), 450);
    }
    shake(4, 80);
    if (!lite) freeze(30);
    if (word && n <= 2) huazi([{ text: word, style: 'S4', seg: 'setup', at: 0 }]);
  }

  function setForced(on) {
    stage.classList.toggle('forced', !!on);
    stage.classList.toggle('polite', !!on);
    setClerk(on ? 'polite' : 'idle');
  }

  function starPop() {
    const s = el('div', 'star-pop', fx);
    s.innerHTML = art.STAR_SVG;
    s.animate([{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 1, offset: 0.4 }, { transform: 'scale(0)', opacity: 0 }], { duration: 400 });
    later(() => s.remove(), 420);
  }

  function clearCustomer() {
    current = null;
    custGen++;
    groupRow.textContent = '';
    stage.classList.remove('grouping');
    clearTimeout(custLineTimer);
    custWrap.textContent = '';
    custWrap.className = 'cust-wrap';
    custWrap.dataset.face = '';
    hideSign();
    clearPlate();
  }

  function customerPose(p = {}) {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'gray') continue;
      const cls = POSE[k];
      if (cls) custWrap.classList.toggle(cls, !!v);
    }
    if ('gray' in p && current && current.gray !== !!p.gray) {
      current.gray = !!p.gray;
      const face = custWrap.dataset.face;
      renderCustomer();
      custWrap.dataset.face = face;
    }
  }

  // E11: the number ticket flies from the clerk's hand to the customer's forehead (cam %), 2 turns.
  function showPlate(lines = [], { ms = 350 } = {}) {
    plateLayer.innerHTML = art.ticketHTML(lines);
    const plate = plateLayer.firstElementChild;
    const a = plate.animate([
      { left: '70%', top: '40%', transform: 'translate(-50%,-50%) rotate(0) scale(.6)' },
      { left: '29%', top: '64%', transform: 'translate(-50%,-50%) rotate(720deg) scale(1)' },
    ], { duration: ms, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'forwards' });
    return a.finished.catch(() => {}).then(() => { plate.dataset.stuck = '1'; return plate; });
  }
  function clearPlate() { plateLayer.textContent = ''; }
  function plateGlow(on = true) { plateLayer.querySelector('.ticket')?.classList.toggle('glow', !!on); }

  // ---------- Subtitles (2.3) ----------
  function showLine(text, { style = '', who = 'clerk', color } = {}) {
    last.lineWho = who;
    const node = el('div', `sub sub-${who} st-${style || 'plain'}`);
    if (who === 'cust') node.style.setProperty('--bar', keyColor(color || 'gun'));
    fillLine(node, text, { dirs: who !== 'clerk' });
    subs.textContent = '';
    subs.appendChild(node);
    // Max 2 lines: 5.4cqw, or `.long` (4.2cqw) when that does not fit.
    if (subs.scrollHeight > subs.clientHeight + 2 || node.getClientRects().length > 2) node.classList.add('long');
    return node;
  }

  function emphasize(words = []) {
    const list = (Array.isArray(words) ? words : [words]).map((w) => String(w).replace(/[！!。？?]+$/, '')).filter(Boolean);
    if (!list.length) return;
    const re = new RegExp('(' + list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
    for (const span of subs.querySelectorAll('.say')) {
      const t = span.textContent;
      if (!re.test(t)) continue;
      re.lastIndex = 0;
      span.textContent = '';
      for (const part of t.split(re)) {
        if (!part) continue;
        if (list.includes(part)) el('span', 'em', span, part);
        else span.appendChild(document.createTextNode(part));
      }
    }
  }

  // ---------- 花字 (section 5) ----------
  let hzId = 0;
  const liveHz = new Set();

  const HZ = {
    S1: { fill: '#FFE14D', inner: ['#E8402F', 2.6], outer: ['#1B1311', 4.6], pos: [50, 38], weight: 900 },
    // S2: ink outer stroke (was brown #6B3A00): gold on the cream wall had too little contrast (review)
    S2: { fill: 'url(#hzGold)', inner: ['#FFFFFF', 2], outer: ['#1B1311', 5], pos: [50, 36], weight: 900 },
    S3: { fill: '#FFFFFF', inner: null, outer: null, pos: [4, 27], weight: 900 },
    S4: { fill: '#8FE3FF', inner: ['#FFFFFF', 1.8], outer: ['#1F4A7A', 3], pos: [75, 52], weight: 700, font: FONT_SIGN },
    S5: { fill: '#FFFFFF', inner: null, outer: ['#1B1311', 2.4], pos: [50, 42], weight: 900 }, // outline added for legibility
  };

  function layerGeom() {
    const lw = hzLayer.clientWidth || stage.clientWidth || 1;
    const lh = hzLayer.clientHeight || stage.clientHeight * 0.74;
    const sh = stage.clientHeight || lh / 0.74;
    return { H: (lh / lw) * 100, unitsPerStagePct: (sh / lw), lw };
  }

  // Client rect of a sign where it will settle: a sign still rising (translateY 40% → 0) or flipping
  // (rotateX/Y squashes it) is measured at its full size and final height.
  function signRect(node) {
    const card = node.querySelector('.sign-card') || node;
    const r = card.getBoundingClientRect();
    if (!r.width) return null;
    const settled = node.dataset.state === 'up' && !node.classList.contains('flip-in') && !node.classList.contains('page');
    if (settled) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    const w = Math.max(r.width, card.offsetWidth * camState.s);
    const h = Math.max(r.height, card.offsetHeight * camState.s);
    const cx = (r.left + r.right) / 2;
    const bottom = r.bottom;
    const top = Math.min(r.top, bottom - h) - 0.45 * h;
    return { left: cx - w / 2, top, right: cx + w / 2, bottom, width: w, height: bottom - top };
  }

  function signBoxUnits() {
    if (!sign || !sign.isConnected) return null;
    const r = signRect(sign);
    if (!r) return null;
    const L = hzLayer.getBoundingClientRect();
    const k = 100 / (L.width || 1);
    return { x: (r.left - L.left) * k, y: (r.top - L.top) * k, w: r.width * k, h: r.height * k };
  }

  function makeText(parent, text, style, fs, def, latin, anchor, id) {
    const family = latin && style !== 'S4' ? FONT_EN : def.font || FONT_ZH;
    const base = { 'font-family': family, 'font-weight': def.weight, 'font-size': fs, 'text-anchor': anchor, 'dominant-baseline': 'central', 'paint-order': 'stroke', 'stroke-linejoin': 'round', x: 0, y: 0 };
    const nodes = [];
    if (def.outer) nodes.push(svgEl('text', { ...base, fill: def.outer[0], stroke: def.outer[0], 'stroke-width': def.outer[1], class: 'hz-out' }, parent));
    nodes.push(svgEl('text', { ...base, fill: def.fill, stroke: def.inner ? def.inner[0] : 'none', 'stroke-width': def.inner ? def.inner[1] : 0, class: 'hz-in', id }, parent));
    for (const n of nodes) n.textContent = text;
    return nodes;
  }

  function hzOne(itemIn) {
    const item = { ...itemIn, style: normStyle(itemIn.style) };
    if (item.style === 'emph') { emphasize([item.text]); return Promise.resolve(); }
    const def = HZ[item.style];
    if (!def) return Promise.resolve();
    let text = String(item.text || '');
    // S4 is the customer's inner voice in a bubble: no stage-direction brackets (review: "（呆住）" read as a
    // stray caption)
    if (item.style === 'S4') text = text.replace(/^[（(]\s*|\s*[）)]$/g, '');
    let bleepIdx = -1;
    if (bleepOn && item.style === 'S1') {
      const m = /([一-龥])你媽/.exec(text);
      if (m) { text = text.replace('你媽', '你嗶'); bleepIdx = m.index + 2; }
    }
    const latin = isLatin(text);
    const id = ++hzId;
    const geo = layerGeom();
    const svg = svgEl('svg', { class: `hz ${item.style.toLowerCase()}${latin ? ' en' : ''}`, 'data-style': item.style, viewBox: `0 0 100 ${geo.H.toFixed(2)}`, overflow: 'visible', 'aria-hidden': 'true' }, hzLayer);
    const pos = item.pos || def.pos;
    const cx = pos[0];
    let cy = pos[1] * geo.unitsPerStagePct;
    const anchor = item.style === 'S3' ? 'start' : 'middle';
    let fs = hzFontSize(item.style, text, { size: item.size, fontSize: item.fontSize, latin });
    if (item.style === 'S3') fs = Math.min(fs, 52 / Math.max(1, [...text].length * (latin ? 0.55 : 1.02)));
    const g = svgEl('g', { class: 'hz-pos', transform: `translate(${cx} ${cy.toFixed(2)})` }, svg);
    const anim = svgEl('g', { class: 'hz-anim' }, g);
    const deco = svgEl('g', { class: 'hz-deco' }, anim);
    const textId = `hzt${id}`;
    const nodes = makeText(anim, text, item.style, fs, def, latin, anchor, textId);
    const inner = nodes[nodes.length - 1];

    // Measure (text box relative to the anchor at size fs), then place clear of the sign.
    let bb;
    try { bb = nodes[0].getBBox(); } catch { bb = { x: -fs, y: -fs / 2, width: fs * 2, height: fs }; }
    const strokePad = (def.outer ? def.outer[1] : 0) / 2 + 0.5;
    const extra = item.style === 'S3' ? 2 : item.style === 'S2' || item.style === 'S1' ? 2.5 : 1;
    let box = { x0: bb.x - strokePad - extra, y0: bb.y - strokePad - extra, x1: bb.x + bb.width + strokePad + extra, y1: bb.y + bb.height + strokePad + extra };
    if (item.style === 'S3') box = { x0: -2.6, y0: bb.y - 1.6, x1: bb.width + 2.4, y1: bb.y + bb.height + 1.6 };
    if (item.style === 'S4') box.x1 += 6;
    if (item.style === 'S5') box.y1 += 3;
    const placed = placeHuazi({ box, cx, cy, size0: fs, sign: signBoxUnits(), gap: 4, top: 8 * geo.unitsPerStagePct, bottom: geo.H, minSize: Math.min(9, fs) });
    if (!placed) {
      svg.remove();
      emphasize([item.text]);
      return Promise.resolve();
    }
    if (placed.size !== fs) {
      const k = placed.size / fs;
      fs = placed.size;
      nodes.forEach((n) => n.setAttribute('font-size', fs));
      box = { x0: box.x0 * k, y0: box.y0 * k, x1: box.x1 * k, y1: box.y1 * k };
    }
    cy = placed.cy;
    g.setAttribute('transform', `translate(${cx} ${cy.toFixed(2)})`);
    // Tight element box = measured box, so `.hz` rects can be checked against `.sign` (A10).
    const bx = cx + box.x0, by = cy + box.y0, bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    svg.setAttribute('viewBox', `${bx.toFixed(2)} ${by.toFixed(2)} ${bw.toFixed(2)} ${bh.toFixed(2)}`);
    Object.assign(svg.style, { left: bx + '%', top: (by / geo.H) * 100 + '%', width: bw + '%', height: (bh / geo.H) * 100 + '%' });
    svg.classList.add('placed');
    const lb = { x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1, w: bw, h: bh };

    // Bleep: black box behind 嗶 (white glyph).
    if (bleepIdx >= 0) {
      try {
        const ext = inner.getExtentOfChar(bleepIdx);
        const r = svgEl('rect', { x: ext.x - 0.6, y: ext.y, width: ext.width + 1.2, height: ext.height, fill: '#000' });
        anim.insertBefore(r, inner);
        inner.textContent = '';
        [...text].forEach((ch, i) => { const t = svgEl('tspan', i === bleepIdx ? { fill: '#FFFFFF', stroke: 'none' } : {}, inner); t.textContent = ch; });
      } catch { /* getExtentOfChar unsupported: plain text */ }
    }

    const clipId = `hzc${id}`;
    const clip = svgEl('clipPath', { id: clipId }, svg);
    svgEl('rect', { x: lb.x0, y: lb.y0, width: lb.w, height: lb.h }, clip);
    deco.setAttribute('clip-path', `url(#${clipId})`);

    liveHz.add(svg);
    // S1 slams in from scale 2.6 (rotated -7deg): cap that entry scale so even the first frames stay 4cqw clear
    // of a sign that is up (5.2 / A10).
    const maxScale = hzMaxScale(box, cx, cy, signBoxUnits(), item.style === 'S1' ? -7 : 0);
    const run = HZ_ANIM[item.style];
    const total = run ? run({ svg, anim, deco, nodes, inner, lb, fs, item, text, textId, id, maxScale }) : 1000;
    return new Promise((resolve) => {
      const t = later(() => { svg.remove(); liveHz.delete(svg); resolve(); }, total);
      svg._done = () => { clearTimeout(t); timers.delete(t); svg.remove(); liveHz.delete(svg); resolve(); };
    });
  }

  function rays(deco, n, r, fill, opacity) {
    const g = svgEl('g', { class: 'hz-rays' }, deco);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n;
      svgEl('polygon', { points: `0,0 ${(Math.cos(a0) * r).toFixed(1)},${(Math.sin(a0) * r).toFixed(1)} ${(Math.cos(a1) * r).toFixed(1)},${(Math.sin(a1) * r).toFixed(1)}`, fill, opacity }, g);
    }
    return g;
  }

  const HZ_ANIM = {
    S1({ anim, deco, lb, item, maxScale }) {
      const s0 = Math.min(2.6, maxScale).toFixed(2);
      const sOut = Math.min(1.15, maxScale).toFixed(2);
      const sPiece = Math.min(1.2, maxScale).toFixed(2);
      const r = Math.hypot(lb.w, lb.h);
      const lines = svgEl('g', { class: 'hz-speed' }, deco);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + (i % 2) * 0.08;
        const r0 = r * 0.22;
        svgEl('polygon', { points: `${(Math.cos(a - 0.03) * r0).toFixed(1)},${(Math.sin(a - 0.03) * r0).toFixed(1)} ${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)} ${(Math.cos(a + 0.03) * r0).toFixed(1)},${(Math.sin(a + 0.03) * r0).toFixed(1)}`, fill: '#FFF4DC', opacity: 0.85 }, lines);
      }
      deco.parentNode.insertBefore(deco, deco.parentNode.firstChild);
      lines.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.2)' }], { duration: 200, fill: 'forwards' });
      if (item.break) {
        anim.animate([{ transform: `rotate(-7deg) scale(${s0})`, opacity: 0 }, { transform: `rotate(-7deg) scale(${sPiece})`, opacity: 1 }], { duration: 150, easing: 'cubic-bezier(.2,1.8,.4,1)', fill: 'forwards' });
        later(() => {
          anim.style.opacity = '0';
          const svgRoot = anim.ownerSVGElement;
          const pos = anim.parentNode;
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => {
            const cid = `${anim.closest('svg').querySelector('clipPath').id}q${i}`;
            const c = svgEl('clipPath', { id: cid }, svgRoot);
            svgEl('rect', { x: sx < 0 ? lb.x0 : 0, y: sy < 0 ? lb.y0 : 0, width: sx < 0 ? -lb.x0 : lb.x1, height: sy < 0 ? -lb.y0 : lb.y1 }, c);
            const piece = svgEl('g', { class: 'hz-piece', 'clip-path': `url(#${cid})` }, pos);
            const copy = anim.cloneNode(true);
            copy.style.opacity = '1';
            copy.style.transform = `rotate(-7deg) scale(${sPiece})`;
            piece.appendChild(copy);
            piece.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${sx * 14}px, ${sy < 0 ? -12 : -4}px) rotate(${sx * 25}deg)`, opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
          });
        }, 150);
        return 460;
      }
      // item.ms lengthens the hold (the 調你媽 beat owns the screen for 1400 ms); entry, shake and exit keep
      // their absolute timing (90 / 150 / 330 ms in, 140 ms out).
      const D = Math.max(1000, item.ms || 1000);
      const o = (ms) => Math.min(1, ms / D);
      anim.animate([
        { transform: `rotate(-7deg) scale(${s0})`, opacity: 0, offset: 0, easing: 'cubic-bezier(.2,1.8,.4,1)' },
        { transform: 'rotate(-7deg) scale(.9)', opacity: 1, offset: o(90) },
        { transform: 'rotate(-7deg) scale(1)', opacity: 1, offset: o(150) },
        { transform: 'translate(1.2px,0) rotate(-7deg) scale(1)', offset: o(210) },
        { transform: 'translate(-1.2px,0) rotate(-7deg) scale(1)', offset: o(270) },
        { transform: 'translate(0,0) rotate(-7deg) scale(1)', offset: o(330) },
        { transform: 'rotate(-7deg) scale(1)', opacity: 1, offset: o(D - 140) },
        { transform: `rotate(-7deg) scale(${sOut})`, opacity: 0, offset: 1 },
      ], { duration: D, fill: 'forwards' });
      return D;
    },
    S2({ svg, anim, deco, lb, textId, id }) {
      const r = Math.hypot(lb.w, lb.h) / 2 + 2;
      const ray = rays(deco, 12, r, '#FFD23F', 0.4);
      deco.parentNode.insertBefore(deco, deco.parentNode.firstChild);
      if (!lite) ray.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 2000, iterations: Infinity });
      // White sheen sweeping across the glyphs at 300 ms.
      const sc = svgEl('clipPath', { id: `hzs${id}` }, svg);
      svgEl('use', { href: `#${textId}` }, sc);
      const sg = svgEl('g', { 'clip-path': `url(#hzs${id})` }, anim);
      const sheen = svgEl('g', { class: 'hz-sheen' }, sg);
      svgEl('rect', { x: lb.x0 - 10, y: lb.y0, width: 6, height: lb.h, fill: '#FFFFFF', opacity: 0.75, transform: `skewX(-20)` }, sheen);
      sheen.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${lb.w + 20}px)` }], { duration: 400, delay: 300, fill: 'both' });
      // Six 4-point stars twinkling around the box.
      for (let i = 0; i < 6; i++) {
        const sx = lb.x0 + (lb.w * ((i * 37) % 100)) / 100;
        const sy = i % 2 ? lb.y0 + 1.5 : lb.y1 - 1.5;
        const s = 1.6;
        const st = svgEl('path', { d: `M${sx} ${sy - s * 2}L${sx + s / 2} ${sy - s / 2}L${sx + s * 2} ${sy}L${sx + s / 2} ${sy + s / 2}L${sx} ${sy + s * 2}L${sx - s / 2} ${sy + s / 2}L${sx - s * 2} ${sy}L${sx - s / 2} ${sy - s / 2}Z`, fill: '#FFF6C2', stroke: '#6B3A00', 'stroke-width': 0.4 }, deco);
        if (!lite) st.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 120 * i, iterations: 3 });
      }
      anim.animate([
        { transform: 'translate(0,-30px)', opacity: 0, offset: 0, easing: 'cubic-bezier(.3,1.5,.5,1)' },
        { transform: 'translate(0,0)', opacity: 1, offset: 0.173 },
        { transform: 'translate(0,0)', opacity: 1, offset: 0.9 },
        { transform: 'translate(0,0) scale(1.05)', opacity: 0, offset: 1 },
      ], { duration: 1500, fill: 'forwards' });
      return 1500;
    },
    S3({ anim, nodes, lb }) {
      const bar = svgEl('g', { transform: 'skewX(-8)' });
      anim.insertBefore(bar, nodes[0]);
      svgEl('rect', { class: 'hz-bar', x: lb.x0, y: lb.y0, width: lb.w, height: lb.h, fill: '#111111', 'fill-opacity': 0.92 }, bar);
      svgEl('rect', { class: 'hz-bar-edge', x: lb.x0, y: lb.y0, width: 1.6, height: lb.h, fill: '#E8402F' }, bar);
      anim.animate([
        { transform: `translateX(${-(lb.w * 1.1 + 8).toFixed(1)}px)`, offset: 0, easing: 'ease-out' },
        { transform: 'translateX(0)', offset: 140 / 1160 },
        { transform: 'translateX(0)', offset: 1040 / 1160, easing: 'ease-in' },
        { transform: `translateX(${(lb.w + 100).toFixed(1)}px)`, offset: 1 },
      ], { duration: 1160, fill: 'forwards' });
      return 1160;
    },
    S4({ anim, deco, lb, nodes }) {
      // cream thought bubble behind the text, with two small circles trailing down-left toward the customer
      const bub = svgEl('g', { class: 'hz-bubble' });
      anim.insertBefore(bub, nodes[0]);
      svgEl('rect', { x: lb.x0 + 0.6, y: lb.y0 + 0.4, width: lb.w - 7, height: lb.h - 0.8, rx: Math.min(4, lb.h / 2), fill: '#FFF4DC', stroke: '#1B1311', 'stroke-width': 0.7 }, bub);
      svgEl('circle', { cx: lb.x0 + 3, cy: lb.y1 + 1.2, r: 1.3, fill: '#FFF4DC', stroke: '#1B1311', 'stroke-width': 0.6 }, bub);
      svgEl('circle', { cx: lb.x0 + 0.8, cy: lb.y1 + 3.2, r: 0.8, fill: '#FFF4DC', stroke: '#1B1311', 'stroke-width': 0.5 }, bub);
      const dx = lb.x1 - 4, dy = lb.y0 + 3;
      svgEl('path', { d: `M${dx} ${dy - 3} Q${dx + 2.4} ${dy + 0.6} ${dx + 1.4} ${dy + 2} Q${dx} ${dy + 3} ${dx - 1.4} ${dy + 2} Q${dx - 2.2} ${dy + 0.6} ${dx} ${dy - 3}Z`, fill: '#9ED8FF', stroke: '#1B1311', 'stroke-width': 0.6 }, anim);
      deco.remove();
      anim.animate([
        { transform: 'scale(0)', opacity: 1, offset: 0 },
        { transform: 'scale(1.1)', offset: 0.1 },
        { transform: 'scale(1) rotate(0deg)', offset: 0.154 },
        { transform: 'translateY(-1px) rotate(4deg)', offset: 0.38 },
        { transform: 'translateY(-2px) rotate(-4deg)', offset: 0.61 },
        { transform: 'translateY(-2.6px) rotate(4deg)', opacity: 1, offset: 0.88 },
        { transform: 'translateY(-3px) rotate(0deg)', opacity: 0, offset: 1 },
      ], { duration: 1300, fill: 'forwards' });
      return 1300;
    },
    S5({ anim, nodes, lb, item, text }) {
      const chars = [...text];
      const charMs = item.charMs ?? 60;
      const holdMs = item.holdMs ?? 600;
      // Type left to right from a fixed start, red underline grows with the text.
      const w = lb.w - 2;
      nodes.forEach((n) => { n.setAttribute('text-anchor', 'start'); n.setAttribute('x', (-w / 2).toFixed(2)); n.textContent = ''; });
      const line = svgEl('rect', { x: -w / 2, y: lb.y1 - 2.4, width: 0, height: 1.2, fill: '#E8402F' }, anim);
      letterbox(true);
      chars.forEach((ch, i) => later(() => {
        nodes.forEach((n) => { n.textContent = chars.slice(0, i + 1).join(''); });
        line.setAttribute('width', ((w * (i + 1)) / chars.length).toFixed(2));
        try { item.onChar?.(i, ch); } catch { /* caller's sound hook */ }
      }, 160 + i * charMs));
      const total = 160 + chars.length * charMs + holdMs + 160;
      later(() => letterbox(false), total - 160);
      return total;
    },
  };

  function huazi(list = [], timing = {}) {
    const items = (Array.isArray(list) ? list : [list]).filter((x) => x && x.text);
    const setupStart = timing.setupStartMs ?? 0;
    const setupMs = timing.setupMs ?? 0;
    const punchStart = timing.punchStartMs ?? setupStart + setupMs;
    const punchMs = timing.punchMs ?? 0;
    const minAt = timing.minAt ?? 0;
    // Start times (spec 5.3): S3/S4 at segment start, others at start + clip × ratio, ≥ 450 ms apart.
    const raw = items.map((it) => {
      if (it.at != null) return it.at;
      const st = normStyle(it.style);
      const start = it.seg === 'setup' ? setupStart : punchStart;
      if (st === 'S3' || st === 'S4') return start;
      return start + (it.seg === 'setup' ? setupMs : punchMs) * (it.ratio || 0);
    });
    let prev = -Infinity;
    const times = raw.map((t, i) => ({ t, i })).sort((a, b) => a.t - b.t).reduce((acc, { t, i }) => {
      const st = normStyle(items[i].style);
      acc[i] = st === 'emph' ? Math.max(t, minAt) : Math.max(t, prev + 450, minAt);
      if (st !== 'emph') prev = acc[i];
      return acc;
    }, []);
    let cancelled = false;
    const handles = [];
    const batch = { cancel: () => api.cancel() };
    // when the last item of this batch is gone (ms from now), so callers can keep the next customer out of it
    const DUR = { S1: 1000, S2: 1500, S3: 1160, S4: 1300, S5: 1600, emph: 0 };
    const endMs = items.reduce((m, it, i) => {
      const st = normStyle(it.style);
      const d = st === 'S1' && it.ms ? Math.max(1000, it.ms) : st === 'S5' ? 160 + [...String(it.text)].length * (it.charMs ?? 60) + (it.holdMs ?? 600) + 160 : DUR[st] ?? 1000;
      return Math.max(m, (times[i] || 0) + d);
    }, 0);
    hzBatches.add(batch);
    const promises = items.map((it, i) => new Promise((resolve) => {
      const h = later(() => { if (cancelled) return resolve(); hzOne(it).then(resolve); }, times[i] || 0);
      handles.push({ h, resolve });
    }));
    const api = {
      endMs,
      done: Promise.all(promises).then(() => { hzBatches.delete(batch); }),
      cancel() {
        cancelled = true;
        hzBatches.delete(batch);
        handles.forEach(({ h, resolve }) => { clearTimeout(h); timers.delete(h); resolve(); });
      },
    };
    return api;
  }

  const hzBatches = new Set();
  function clearHuazi({ pendingOnly = false } = {}) {
    for (const b of [...hzBatches]) b.cancel();
    if (pendingOnly) return;
    for (const s of [...liveHz]) s._done?.();
  }

  // ---------- Guidance (3.1, 4.4) ----------
  let guideKey = null;
  let lineAnim = null;
  let fingerAnim = null;
  // the element that stands for a key on screen: the button, or its gesture chip in gesture mode
  const keyEl = (key) => (inputMode === 'gesture' ? chips[key]?.c : buttons[key]?.b);
  function keyCenter(key) {
    const r = relRect(keyEl(key));
    return { x: r.x + r.w / 2, y: r.y + r.h / 2, r };
  }
  function guide({ key, dimOthers = true, glow = true, finger = false, line = false, blink = false } = {}) {
    if (!buttons[key]) return;
    guideKey = key;
    stage.dataset.guide = key;
    for (const k of KEYS) {
      for (const b of [buttons[k].b, chips[k].c]) {
        b.toggleAttribute('data-dim', dimOthers && k !== key);
        b.toggleAttribute('data-glow', glow && k === key);
        b.toggleAttribute('data-blink', blink && k === key);
      }
    }
    if (finger && inputMode === 'gesture') {
      // gesture mode: the finger shows the move on the customer (fling up-right / three taps / press and hold)
      const cr = relRect(custWrap);
      const c = { x: cr.x + cr.w * 0.55, y: cr.y + cr.w * 0.18 };
      fingerEl.dataset.g = key;
      fingerEl.hidden = false;
      Object.assign(fingerEl.style, { left: c.x + 'px', top: c.y + 'px' });
    } else if (finger) {
      delete fingerEl.dataset.g;
      const k0 = keyCenter(key);
      // fingertip on the upper right of the key (next to its icon): the hand then lies right of and below the
      // label, so "滾！" stays readable and the sleeve ends above the stage edge (review)
      const c = { x: k0.x + k0.r.w * 0.16, y: k0.y - k0.r.h * 0.2 };
      if (fingerEl.hidden) {
        fingerEl.hidden = false;
        Object.assign(fingerEl.style, { left: c.x + 'px', top: c.y + 'px' });
        fingerAnim?.cancel();
        fingerAnim = fingerEl.animate([{ translate: '40cqw 30cqw' }, { translate: '0 0' }], { duration: 220, easing: 'ease-out' });
      } else {
        Object.assign(fingerEl.style, { left: c.x + 'px', top: c.y + 'px' });
      }
    } else {
      hideFinger();
    }
    if (line) drawGuideLine(key);
    else clearGuideLine();
  }
  function hideFinger() {
    fingerAnim?.cancel();
    fingerAnim = null;
    fingerEl.hidden = true;
  }
  function drawGuideLine(key) {
    clearGuideLine();
    if (!sign) return;
    const s = relRect(sign.querySelector('.sign-card') || sign);
    const k = keyCenter(key);
    const cw = s.sw / 100;
    guideSvg.setAttribute('viewBox', `0 0 ${s.sw} ${s.sh}`);
    guideSvg.style.setProperty('--c', keyColor(key));
    guideSvg.hidden = false;
    const x0 = s.x + s.w / 2, y0 = s.y + s.h;
    const x1 = k.x, y1 = k.r.y;
    const mx = (x0 + x1) / 2 + 6 * cw, my = (y0 + y1) / 2;
    svgEl('path', { d: `M${x0.toFixed(1)} ${y0.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`, fill: 'none', stroke: KEY_COLOR[key], 'stroke-width': (0.8 * cw).toFixed(2), 'stroke-dasharray': `${(2 * cw).toFixed(2)} ${(1.5 * cw).toFixed(2)}`, 'stroke-linecap': 'round' }, guideSvg);
  }
  function clearGuideLine() {
    lineAnim?.cancel();
    lineAnim = null;
    guideSvg.textContent = '';
    guideSvg.hidden = true;
  }
  function clearGuide() {
    guideKey = null;
    delete stage.dataset.guide;
    for (const k of KEYS) ['data-dim', 'data-glow', 'data-blink'].forEach((a) => { buttons[k].b.removeAttribute(a); chips[k].c.removeAttribute(a); });
    hideFinger();
    clearGuideLine();
  }
  function hintCorrect(key) {
    signFx('hint');
    const b = keyEl(key);
    if (!b) return;
    restart(b, 'hint-flash');
    later(() => b.classList.remove('hint-flash'), 420);
  }
  function tip(text, { key, ms = 1200 } = {}) {
    const t = el('div', 'tip', tipLayer, text);
    if (key && buttons[key]) {
      const c = keyCenter(key);
      t.dataset.key = key;
      t.style.left = c.x + 'px';
      t.style.setProperty('--c', keyColor(key));
    }
    t.animate([{ opacity: 1 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
    later(() => t.remove(), ms);
    return t;
  }
  // 4.4: a sign type's first appearance of the day makes its key breathe (600 ms x 2).
  function breathKey(key) {
    const b = keyEl(key);
    if (!b) return;
    restart(b, 'breath');
    later(() => b.classList.remove('breath'), 1250);
  }
  function coverKey(key, covered, { animate = true } = {}) {
    const b = buttons[key]?.b;
    if (!b) return;
    const was = b.hasAttribute('data-covered');
    b.toggleAttribute('data-covered', !!covered);
    chips[key]?.c.toggleAttribute('data-covered', !!covered);
    if (was && !covered && animate) {
      restart(b, 'uncover');
      later(() => b.classList.remove('uncover'), 220);
    }
  }

  // ---------- Render / HUD ----------
  function setBar(bar, v, key) {
    const val = Math.max(0, Math.min(100, Math.round(v ?? 0)));
    if (last[key] === val) return;
    last[key] = val;
    bar.fill.style.width = val + '%';
    bar.wrap.classList.toggle('low', key === 'aura' && val <= 25);
    bar.wrap.classList.toggle('hot', key === 'fury' && val >= 80);
  }

  function showBar(bar, on, key) {
    const was = last['show-' + key];
    if (was === on) return;
    last['show-' + key] = on;
    hud.dataset[key] = on ? 'on' : 'off';
    if (on && was === false) { restart(bar.wrap, 'enter'); later(() => bar.wrap.classList.remove('enter'), 320); }
  }

  function setHud(opts = {}) {
    hudOpts = { ...hudOpts, ...opts };
    showBar(auraBar, hudOpts.showAura !== false, 'aura');
    showBar(furyBar, hudOpts.showFury !== false, 'fury');
    timeBox.hidden = hudOpts.showTime === false;
  }

  let queueOverride = false;
  function paintQueue(n, bump = true) {
    if (last.queue === n) return;
    const prev = last.queue ?? 0;
    last.queue = n;
    qNum.textContent = fmt(n);
    if (bump && n > prev) restart(qNum, 'bump');
    // In-store queue people (min(queue, 3)), far crowd row, "+N" capsule (art COUNTER_SVG), and the door monitor.
    counter.dataset.q = String(Math.min(3, n));
    counter.dataset.crowd = String(art.queueCrowd(n));
    const cap = art.queueCapText(n);
    const qn = counter.querySelector('text.q-num');
    if (qn) qn.textContent = cap;
    counter.classList.toggle('cap', !!cap);
    paintMonitor(n);
  }
  function setQueue(n, { bump = true } = {}) {
    queueOverride = true;
    paintQueue(Math.max(0, Math.floor(n || 0)), bump);
  }

  // Door monitor (art.monitorHTML): redrawn when the queue changes; scene follows art.monitorScene().
  // Rebuilt only when the drawing changes (the crowd grows every few people), not on every +1 (A13).
  let monitorMarkup = '';
  function paintMonitor(n) {
    const q = Math.min(n, 999999);
    const markup = art.monitorHTML(q, lang);
    if (markup === monitorMarkup && monitor) return;
    monitorMarkup = markup;
    const zoom = monitor?.dataset.zoom;
    monitorSlot.innerHTML = markup;
    monitor = monitorSlot.firstElementChild;
    monitor.dataset.lang = lang;
    if (zoom != null) monitor.dataset.zoom = zoom;
  }

  function render(state, opts) {
    if (opts) setHud(opts);
    if (!state) return;
    if (state.phase !== phase) {
      phase = state.phase;
      stage.dataset.phase = phase;
      const inRound = phase === 'playing' || phase === 'rage';
      hud.dataset.round = inRound ? '1' : '0';
      if (!inRound) closePause();
      if (phase === 'idle') last.total = 0;
      if (phase === 'over') { setClerk('over'); stopSignTimer(); clearGuide(); }
      else if (phase !== 'rage' && clerk.dataset.mood === 'rage') setClerk('idle');
    }
    if (phase !== 'idle') queueOverride = false;
    if (!queueOverride) paintQueue(Math.floor(state.queue || 0));
    setBar(auraBar, state.aura, 'aura');
    setBar(furyBar, state.fury, 'fury');
    const full = state.furyFull ? 'full' : '';
    if (stage.dataset.fury !== full) stage.dataset.fury = full;
    const leftMs = state.timeLeftMs ?? 0;
    if (!(leftMs <= (last.total || 0))) last.total = leftMs; // the round's length = the largest time left seen
    const secs = Math.max(0, Math.ceil(leftMs / 1000));
    if (last.secs !== secs) {
      last.secs = secs;
      timeNum.textContent = String(secs);
      timeBox.classList.toggle('urgent', secs <= 10 && phase !== 'idle');
      timeBox.style.setProperty('--p', last.total > 0 ? (leftMs / last.total).toFixed(3) : '1');
    }
    const combo = state.combo || 0;
    if (last.combo !== combo) {
      last.combo = combo;
      comboNum.textContent = '×' + combo;
      const show = combo >= 5;
      comboBox.classList.toggle('show', show);
      comboBox.classList.toggle('big', combo >= 10);
      if (show) restart(comboBox, 'pulse');
    }
    const cur = state.current;
    if (cur && phase !== 'rage' && !cur.speaking) syncSignTimer(cur);
    syncLock();
  }

  // "+N" flies from the counter into the door monitor, the monitor jolts and the HUD number pops (review idea 3:
  // the player should see that every insult pulls more people into the line).
  function queueGain(n) {
    if (!(n > 0) || reduced) { if (n > 0) restart(qNum, 'bump'); return; }
    const f = el('div', 'gain-fly', fx, '+' + fmt(n));
    const from = { x: 50, y: 50 }; // stage %
    const mon = monitor ? relRect(monitor) : null;
    const to = mon ? { x: ((mon.x + mon.w / 2) / mon.sw) * 100, y: ((mon.y + mon.h / 2) / mon.sh) * 100 } : { x: 85, y: 20 };
    f.animate([
      { left: from.x + '%', top: from.y + '%', transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { left: from.x + '%', top: (from.y - 4) + '%', transform: 'translate(-50%,-50%) scale(1.35)', opacity: 1, offset: 0.25 },
      { left: to.x + '%', top: to.y + '%', transform: 'translate(-50%,-50%) scale(.7)', opacity: 1, offset: 0.9 },
      { left: to.x + '%', top: to.y + '%', transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
    ], { duration: 650, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' });
    later(() => {
      f.remove();
      if (monitor) monitor.animate?.([{ scale: '1' }, { scale: '1.12' }, { scale: '1' }], { duration: 220, easing: 'ease-out' });
      qNum.classList.remove('bump', 'bump-big');
      void qNum.offsetWidth;
      qNum.classList.add('bump-big');
      later(() => qNum.classList.remove('bump-big'), 320);
    }, 600);
  }

  // ---------- Effects (legacy names, mapped onto the new staging) ----------
  function floatText(text, cls, ms = 900) {
    const n = el('div', 'float ' + cls, fx, text);
    later(() => n.remove(), ms);
    return n;
  }
  const bigFx = createFxQueue({ maxMs: 1500 });
  let lastS2At = -Infinity;

  function effect(name, payload = {}) {
    switch (name) {
      case 'hit': {
        const lvl = Math.max(0, Math.min(2, payload.charge | 0));
        if (phase !== 'rage' && !beatActive) clerkBeat({ punchStartMs: 0, punchMs: 300, landMs: 300 });
        shake([6, 10, 14][lvl], 200);
        break;
      }
      case 'charge': {
        const lvl = Math.max(1, Math.min(2, payload.charge ?? payload.level ?? 1));
        if (lvl === 2) { setClerk('rage', 700); flash(); }
        shake(lvl === 2 ? 14 : 10, 260);
        break;
      }
      case 'miss':
        customerReact('miss');
        break;
      case 'perfect':
        // The PERFECT banner is gone: 花字 rate limits (5.3) keep the screen quiet; the clerk's calm face says it.
        break;
      case '250':
        if (performance.now() - lastS2At > 1500) {
          lastS2At = performance.now();
          huazi([{ text: payload.text || '250', style: 'S2' }]);
        }
        break;
      case 'polite': {
        setClerk('polite', 1600);
        stopSignTimer();
        stage.classList.add('polite');
        later(() => stage.classList.remove('polite'), 1600);
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
        stopSignTimer();
        shake(10, 300);
        huazi([{ text: payload.text || DECOR[lang].rage, style: 'S1' }]);
        break;
      case 'rageEnd':
        stage.classList.remove('rage');
        setClerk('idle');
        break;
      case 'fly':
        customerReact(payload.key === 'gun' && payload.charge === 2 ? 'gun2' : payload.key || 'gun');
        break;
      default:
        break;
    }
  }
  // Track S2 shown by huazi() too, so effect('250') never doubles it.
  const _huazi = huazi;
  function huaziTracked(list, timing) {
    if ((Array.isArray(list) ? list : [list]).some((x) => x && normStyle(x.style) === 'S2')) lastS2At = performance.now();
    return _huazi(list, timing);
  }

  // ---------- Milestone: monitor zoom (2.8), never pauses the round ----------
  // Art direction 9: no card, the door monitor zooms in. The milestone line is not shown: the subtitle line belongs to
  // the clerk's punch at that moment (check-signature), and the monitor already says it.
  let milestoneText = null;
  const resolveText = (t) => (typeof t === 'function' ? t() : t) || '';
  function showMilestone(level, text) {
    bigFx.push(() => {
      monitorMarkup = '';
      paintMonitor(Math.max(level, last.queue || 0));
      // art contract: data-zoom on .monitor = 260 ms zoom to x 4–96% / y 8–40%, 900 ms parallax, 260 ms back.
      monitor.dataset.zoom = '1';
      monitor.setAttribute('aria-label', resolveText(text));
      milestoneText = text;
      return () => {
        if (monitor) { delete monitor.dataset.zoom; monitor.removeAttribute('aria-label'); }
        milestoneText = null;
      };
    }, 1420);
  }
  function relabelMilestone() {
    if (monitor && milestoneText != null) monitor.setAttribute('aria-label', resolveText(milestoneText));
  }
  // ---------- Screens ----------
  function hideOverlays() {
    unframeStart();
    startCard.classList.add('hidden');
    summaryCard.classList.add('hidden');
    startCard.textContent = ''; // the logo and its icons leave the DOM while the shop is open (A13: SVG nodes)
    summaryCard.textContent = '';
    overlayTap = null;
    syncLock();
  }

  let fontsPromise = Promise.resolve();
  function preloadFonts() {
    try {
      if (!document.fonts?.load) return;
      fontsPromise = Promise.all([
        document.fonts.load('400 1em "Huninn"', '來杯開店滾閉嘴收'),
        document.fonts.load('800 1em "Baloo 2"', '0123456789'),
        document.fonts.load('700 1em "Noto Sans TC"', '滾閉嘴收調你媽'),
        document.fonts.load('900 1em "Noto Sans TC"', '滾閉嘴收調你媽'),
        document.fonts.load('700 1em "LXGW WenKai TC"', '嗯杯少甜冰'),
      ]).catch(() => {});
    } catch { /* no font loading API */ }
  }
  function fontsReady(maxMs = 300) {
    return Promise.race([fontsPromise, new Promise((r) => setTimeout(r, maxMs))]);
  }

  // Start page (art direction 6.3 / 7.2, mock-start): the night street, the logo plate on top (drops in, its light
  // flickers on), the shop window showing the live scene (the clerk), the tagline, the gold 開店 button and the
  // controls toggle. From 1200 ms the whole screen is tappable. Days 2+: a wooden plank under the logo with the day's
  // name and rule, the riddle on a blackboard strip, best and stars in one small line.
  let framed = false;
  function frameStart() {
    // fit the scene's top half (lightbox y 4% to the counter top y 50%) into the shop window
    const win = startCard.querySelector('.start-window');
    if (!win || startCard.classList.contains('hidden')) return;
    const s = stageRect();
    const w = win.getBoundingClientRect();
    const f = startFraming({ x: w.left - s.left, y: w.top - s.top, w: w.width, h: w.height }, s.width, s.height);
    camera([50, f.fy], f.scale, 0);
    shaker.style.translate = `${f.dx.toFixed(1)}px ${f.dy.toFixed(1)}px`;
    framed = true;
  }
  function unframeStart() {
    if (!framed) return;
    framed = false;
    shaker.style.translate = '';
  }
  addEventListener('resize', () => { if (framed) frameStart(); });

  function showStart(t = {}, { firstRun = true, day = 1 } = {}) {
    bigFx.clear();
    clearGuide();
    clearHuazi();
    closeClosing();
    preloadFonts();
    const d = DECOR[lang];
    startCard.textContent = '';
    startCard.dataset.first = firstRun ? '1' : '0';
    startCard.classList.remove('ready');
    const title = String(t.title || (lang === 'zh' ? '來250杯！' : '250 Cups!'));
    // the logo: art.js LOGO_SVG when the scene package provides it, else the built-in plate (same layout)
    const h1 = el('h1', 'start-logo', startCard);
    h1.setAttribute('aria-label', title);
    html(h1, (typeof art.logoSVG === 'function' ? art.logoSVG(lang) : lang === 'zh' ? art.LOGO_SVG : '') || logoMarkup(lang));
    if (t.dayTitle || t.rule) {
      // the day card: a plank hanging under the logo ("第 6 天 · 晚八點人潮" + the rule), the riddle on a
      // blackboard strip, best and stars in one small line
      const dc = el('div', 'start-day', startCard);
      const plank = el('div', 'sd-plank', dc);
      if (t.dayTitle) el('div', 'sd-title', plank, t.dayTitle);
      if (t.rule) el('div', 'sd-rule', plank, t.rule);
      if (t.riddle) {
        const rd = el('div', 'sd-riddle', dc);
        html(el('span', 'sd-riddle-icon', rd), ICON.star(false));
        el('span', 'sd-riddle-text', rd, String(t.riddle).replace(/^[^：:]*[：:]\s*/, ''));
      }
      if (t.best || t.starMask) {
        const row = el('div', 'sd-best', dc);
        const st = el('span', 'sd-stars', row);
        for (let i = 0; i < 3; i++) el('i', (t.starMask >> i) & 1 ? 'on' : '', st, '★');
        if (t.best) el('span', '', row, t.best);
      }
    }
    el('div', 'start-window', startCard).setAttribute('aria-hidden', 'true');
    el('p', 'start-tag', startCard, t.subtitle || d.sub);
    const label = firstRun ? t.start || d.firstStart : typeof t.startDay === 'function' ? t.startDay(day) : t.startDay ? String(t.startDay).replace('{n}', day) : d.day(day);
    const btn = el('button', 'start-btn ui-gold', startCard, label);
    btn.type = 'button';
    // controls toggle (docs/gameplay-v2.md 9): 手勢 / 按鍵 / 吼, a segmented control; does not start the shop
    const gt = GESTURE_TEXT[lang] || GESTURE_TEXT.zh;
    const tog = el('div', 'input-tog', startCard);
    el('span', 'it-label', tog, gt.input);
    const vt = VOICE_TEXT[lang] || VOICE_TEXT.zh;
    for (const m of ['gesture', 'buttons', 'voice']) {
      const b = el('button', 'it-opt', tog);
      html(el('span', 'it-icon', b), INPUT_ICON[m]);
      el('span', 'it-text', b, m === 'voice' ? vt.voice : gt[m]);
      b.type = 'button';
      b.dataset.mode = m;
      b.setAttribute('aria-pressed', String(selMode === m));
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selMode === m) return;
        setInputMode(m);
        onToggleInput(m); // voice: main asks for the microphone and may fall back to gestures (setInputMode again)
      });
    }
    // voice mode switches (shown only while 吼 is selected)
    const vopts = el('div', 'voice-opts', startCard);
    const optBtn = (name, label) => {
      const b = el('button', 'vo-opt', vopts, label);
      b.type = 'button';
      b.dataset.opt = name;
      b.setAttribute('aria-pressed', String(!!voiceOpts[name]));
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        voiceOpts[name] = !voiceOpts[name];
        b.setAttribute('aria-pressed', String(voiceOpts[name]));
        onVoiceOption(name, voiceOpts[name]);
      });
    };
    optBtn('whisper', vt.whisper);
    optBtn('replay', vt.replay);
    if (voiceOpts.keywordsAvailable) {
      optBtn('keywords', vt.keywords);
      el('div', 'vo-note', vopts, vt.kwNote);
    }
    syncInputTog = () => {
      tog.querySelectorAll('.it-opt').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.mode === selMode)));
      vopts.hidden = selMode !== 'voice';
      if (framed) requestAnimationFrame(frameStart); // the switches change the window's height
    };
    syncInputTog();
    if (!reduced) {
      // the plate drops in (260 ms, bounce), its tube light flickers on, then a sheen runs over "250"
      h1.animate([{ translate: '0 -40cqw', rotate: '-8deg' }, { translate: '0 2cqw', rotate: '1deg', offset: 0.7 }, { translate: '0 0', rotate: '0deg' }],
        { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' });
      h1.animate([{ opacity: 0.3 }, { opacity: 1 }, { opacity: 0.6 }, { opacity: 1 }], { duration: 240, delay: 260, fill: 'backwards' });
      h1.querySelector('.lg-sheen')?.animate([{ translate: '-60px 0', opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { translate: '220px 0', opacity: 0 }],
        { duration: 700, delay: 600, easing: 'ease-in-out', fill: 'both' });
    }
    btn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 1200, fill: 'backwards' });
    const since = performance.now();
    const go = () => {
      if (startCard.classList.contains('hidden')) return;
      // a tap before the button is in (1200 ms) starts too; only a re-entry tap from the previous screen
      // (< 150 ms) is ignored
      if (performance.now() - since < 150) return;
      hideOverlays();
      onStart();
    };
    later(() => startCard.classList.add('ready'), 1200);
    startCard.onclick = (e) => { e.preventDefault(); go(); };
    btn.focus?.({ preventScroll: true });
    overlayTap = go;
    clearCustomer();
    subs.textContent = '';
    setClerk('idle');
    summaryCard.classList.add('hidden');
    startCard.classList.remove('hidden');
    frameStart();
    fontsReady(400).then(() => { if (!startCard.classList.contains('hidden')) frameStart(); });
    syncLock();
  }

  function miniSign(parent, kind, text) {
    const holder = document.createElement('div');
    holder.innerHTML = art.miniSign(kind, text, lang);
    const m = holder.firstElementChild;
    parent.appendChild(m);
    return m;
  }

  // Closing card (3.8). t = SYSTEM.opening.closing { title, lines[3] } (+ optional queueFmt, tap, keys);
  // summary = { queue, stars? , star1? }. Rows: red → 滾, purple → 閉嘴, gold → 收. Tap anywhere → onTap.
  let closingEl = null;
  function closeClosing() {
    closingEl?.remove();
    closingEl = null;
    if (overlayTap && overlayTap._closing) overlayTap = null;
    syncLock();
  }
  const MINI_TEXT = {
    zh: { gun: '嗯……', shut: '少冰', take: '250杯' },
    en: { gun: 'Ummm…', shut: 'Less ice', take: '250 cups' },
  };
  // Review fixes: the title is two lines ("第一天 打烊" / "門口排了 78 人"), the day's ticket and savagest line sit
  // on top (summary.plate / summary.bestLine), and only a big centered button opens day 2 — enabled after
  // CLOSING_LOCK_MS so a player still mashing the keys cannot skip the card.
  const CLOSING_LOCK_MS = 1000;
  function showClosing(t = {}, summary = {}, onTap) {
    bigFx.clear();
    clearGuide();
    clearHuazi();
    stopSignTimer();
    closeClosing();
    unframeStart();
    const d = DECOR[lang];
    // art direction 6.3 / 7.4: a dark panel (no border); the number ticket is the hero, big and centred; one line
    // "門口排了 88 人" under it; the three signs as mini signs with their key word in the key colour, no boxes
    closingEl = el('div', 'day-card', stage);
    const inner = el('div', 'dc-inner', closingEl);
    const title = t.title || (lang === 'zh' ? '第一天 打烊' : 'Day 1 — Closed');
    const n = fmt(summary.queue);
    const head = el('h2', 'dc-title', inner);
    el('span', 'dc-title-day', head, title);
    if (Array.isArray(summary.plate) && summary.plate.length) {
      const top = el('div', 'dc-top', inner);
      top.innerHTML = art.ticketHTML(summary.plate);
      const tk = top.firstElementChild;
      if (tk) tk.classList.add('dc-ticket');
    }
    const q = el('div', 'dc-title-q', inner);
    if (typeof t.queueFmt === 'function' || t.queueFmt) {
      q.textContent = typeof t.queueFmt === 'function' ? t.queueFmt('', n).replace(/^\s*[｜|]\s*/, '') : String(t.queueFmt).replace('{title}', '').replace('{n}', n).replace(/^\s*[｜|]\s*/, '');
      // the number in Baloo, lemon
      const txt = q.textContent;
      const at = txt.indexOf(n);
      if (at >= 0) { q.textContent = ''; q.append(txt.slice(0, at)); el('b', '', q, n); q.append(txt.slice(at + n.length)); }
    } else {
      // "門口排了 78 人" with the number in <b>
      const [pre, post] = d.queueFmt('', '\u0000').replace(/^\s*[｜|]\s*/, '').split('\u0000');
      q.append(pre);
      el('b', '', q, n);
      q.append(post);
    }
    if (summary.bestLine) {
      const b = el('div', 'dc-best', inner);
      el('div', 'dc-best-label', b, summary.bestLabel || (lang === 'zh' ? '今天最狠一句' : "Today's savagest line"));
      el('div', 'dc-best-line', b, summary.bestLine);
    }
    const lines = t.lines || [];
    const keys = el('div', 'dc-keys', inner);
    ['gun', 'shut', 'take'].forEach((k, i) => {
      const row = el('div', 'dc-row', keys);
      row.dataset.key = k;
      row.style.setProperty('--kc', keyColor(k));
      miniSign(row, k, MINI_TEXT[lang][k]);
      // "嗯……／杯數太少 → 滾": the key word in its colour, the description small under it
      const [desc, keyWord] = String(lines[i] || '').split(/\s*(?:→|->)\s*/);
      el('span', 'dc-key', row, keyWord || String(texts[k] || '').replace(/[！!]$/, ''));
      el('span', 'dc-text', row, desc || '');
    });
    loudestRow(inner, summary.loudest);
    const stars = el('div', 'dc-stars', inner);
    const got = summary.stars ?? ((summary.queue ?? 0) >= (summary.star1 ?? 30) ? 1 : 0);
    for (let i = 0; i < 3; i++) {
      const st = el('span', 'dc-star', stars);
      st.classList.toggle('on', i < got);
      st.style.animationDelay = i * 150 + 'ms';
      st.innerHTML = ICON.star(i < got);
    }
    const btn = el('button', 'dc-btn ui-gold', inner, t.next || (lang === 'zh' ? '開第二天 ▸' : 'Open day 2 ▸'));
    btn.type = 'button';
    btn.disabled = true;
    const since = performance.now();
    const go = () => {
      if (performance.now() - since < CLOSING_LOCK_MS || !closingEl) return; // still mashing from play
      closeClosing();
      (typeof onTap === 'function' ? onTap : onStart)();
    };
    later(() => { if (btn.isConnected) { btn.disabled = false; btn.classList.add('ready'); } }, CLOSING_LOCK_MS);
    btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); go(); };
    closingEl.onclick = (e) => { e.preventDefault(); }; // taps elsewhere on the card do nothing
    go._closing = true;
    overlayTap = go;
    syncLock();
  }
  // F3 recap: three mini signs float above their keys for ms (tap anywhere to skip). Resolves when gone.
  // t = SYSTEM.opening ({ recap }) or the recap array: ['嗯…… / 15杯 → 滾', '250杯 → 收', '少甜少冰 → 閉嘴'].
  function showRecap(t = {}, { ms = 1800 } = {}) {
    const lines = Array.isArray(t) ? t : t.recap || [];
    const byKey = {};
    const words = { gun: [texts.gun, '滾', 'scram'], shut: [texts.shut, '閉嘴', 'shut'], take: [texts.take, '收', 'deal', 'booked'] };
    lines.forEach((l, i) => {
      const [sign, key = ''] = String(l).split(/\s*(?:→|->)\s*/);
      const k = KEYS.find((kk) => words[kk].some((w) => w && key.toLowerCase().includes(String(w).replace(/[！!]$/, '').toLowerCase()))) || ['gun', 'take', 'shut'][i];
      byKey[k] = sign;
    });
    recapEl.textContent = '';
    recapEl.hidden = false;
    for (const k of KEYS) {
      const col = el('div', 'recap-col', recapEl);
      col.dataset.key = k;
      miniSign(col, k, byKey[k] || '');
      el('i', 'recap-arrow', col);
    }
    syncLock();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        recapEl.hidden = true;
        recapEl.textContent = '';
        stage.removeEventListener('pointerdown', finish, true);
        if (overlayTap === finish) overlayTap = null;
        syncLock();
        resolve();
      };
      later(() => { if (!done) stage.addEventListener('pointerdown', finish, true); }, 50);
      overlayTap = finish;
      later(finish, ms);
    });
  }

  let skipTimer = 0;
  function showSkip(onSkip, { delayMs = 1200, label } = {}) {
    clearTimeout(skipTimer);
    skipBtn.textContent = label || DECOR[lang].skip;
    skipBtn.hidden = true;
    const hide = () => { clearTimeout(skipTimer); skipBtn.hidden = true; skipBtn.onclick = null; };
    skipBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); hide(); onSkip?.(); };
    skipTimer = setTimeout(() => { skipBtn.hidden = false; }, delayMs);
    return hide;
  }

  function startButton(parent, label) {
    const b = el('button', 'big-btn ui-gold', parent, label);
    b.type = 'button';
    b.addEventListener('click', () => { hideOverlays(); onStart(); });
    return b;
  }

  // Summary (days 2+) = a thermal receipt in front of the rolled-down shutter (art direction 7.4, mock-summary):
  // small logo, "第 4 天 · 250湊單日", order number and round length, the queue as the big number (+ a 新紀錄 stamp),
  // three stars with their goals (★3 unsolved = ？？？), the stat rows, today's savagest line, the riddle on a
  // blackboard strip, tomorrow, and the round stamp "打烊" + rating in the corner (gold for S ending in 250).
  // The receipt scrolls inside when it is taller than the screen; the button stays pinned below it.
  const starText = (s) => String(s || '').replace(/^\s*★\s*\d\s*/, '');
  function showSummary(s = {}, t = {}) {
    bigFx.clear();
    clearGuide();
    unframeStart();
    const zh = lang === 'zh';
    summaryCard.textContent = '';
    const card = el('div', 'card report receipt', summaryCard);
    const paper = el('div', 'rc-paper', card);
    // header
    const logo = el('div', 'rc-logo', paper);
    for (const part of (zh ? '來250杯！' : '250 Cups!').split(/(250)/).filter(Boolean)) {
      if (part === '250') el('b', '', logo, part);
      else logo.append(part);
    }
    el('h2', 'card-title rc-title', paper, t.title || (zh ? '今日戰報' : "Today's Report"));
    if (t.day) el('div', 'rc-meta', paper, `NO.${String(t.day).padStart(4, '0')}${t.seconds ? ` · ${t.seconds}s` : ''}`);
    el('hr', 'rc-cut', paper);
    // the queue
    const hero = el('div', 'rc-hero', paper);
    el('small', '', hero, zh ? '門口排了' : 'In line at the door');
    const n = el('div', 'rc-num', hero);
    el('span', 'rc-n', n, fmt(s.queue));
    if (zh) el('span', 'rc-unit', n, '人');
    if (t.record) el('em', 'rc-record report-record', n, String(t.record).replace(/[！!]$/, ''));
    // stars and their goals
    if (Array.isArray(t.stars)) {
      card.classList.add('has-stars');
      const list = el('ul', 'report-stars rc-stars', paper);
      t.stars.forEach((on, i) => {
        const li = el('li', on ? 'on' : '', list);
        li.style.animationDelay = i * 150 + 'ms';
        html(el('span', 'rs-star', li), ICON.star(on));
        el('span', 'rs-text', li, starText((t.starLines || [])[i]) || (on ? '' : '？？？'));
      });
    } else if (t.star1 != null) {
      const got = (s.queue ?? 0) >= t.star1;
      el('p', 'report-star' + (got ? ' on' : ''), paper, zh ? `★1 目標 ${fmt(t.star1)} 人：${got ? '達成！' : '沒達到，再來一次'}` : `★1 goal ${fmt(t.star1)}: ${got ? 'reached!' : 'missed — try again'}`);
    }
    el('hr', 'rc-cut', paper);
    // stat rows with dotted leaders
    const rows = el('div', 'report-grid rc-rows', paper);
    const row = (label, val, unit = '', cls = '') => {
      const r = el('div', 'stat rc-row ' + cls, rows);
      el('span', 'stat-label', r, label);
      el('i', 'rc-dots', r);
      const v = el('span', 'stat-val', r);
      el('b', '', v, val);
      if (unit) v.append(' ' + unit);
    };
    row(t.cursedLabel || (zh ? '開罵' : 'Rants'), fmt(s.cursed), zh ? '次' : '', 'hot');
    row(zh ? '接待' : 'Served', fmt(s.served), zh ? '位' : '');
    row(t.comboLabel || (zh ? '最高連擊' : 'Best combo'), fmt(s.maxCombo));
    if (s.polite) row(zh ? '被迫客氣' : 'Forced polite', fmt(s.polite), zh ? '次' : '', 'pink');
    if (!Array.isArray(t.stars)) row(t.scoreLabel || (zh ? '分數' : 'Score'), fmt(s.score));
    loudestRow(rows, t.loudest);
    el('hr', 'rc-cut', paper);
    // today's savagest line, the riddle, tomorrow
    const best = el('div', 'best rc-quote', paper);
    el('div', 'best-label', best, t.bestLabel || (zh ? '今日最狠' : 'Savagest line'));
    const bl = el('div', 'best-line', best);
    fillLine(bl, t.bestLine || '……');
    const riddle = t.riddle != null ? t.riddle : '';
    if (riddle) {
      const ch = el('div', 'report-hint rc-chalk', paper);
      html(el('span', 'rc-chalk-icon', ch), ICON.star(false));
      el('span', '', ch, riddle);
    }
    if (t.tomorrow) el('p', 'report-tomorrow rc-tomorrow', paper, String(t.tomorrow).split(' · ')[0]);
    // the round stamp (top right): 打烊 + C/B/A/S; S ending in 250 = gold
    if (Array.isArray(t.stars)) {
      const rate = t.gold ? 'S' : t.rating || 'C';
      const stamp = el('div', 'rate-badge rc-stamp' + (t.gold ? ' gold' : ''), paper);
      stamp.dataset.rating = t.gold ? '250' : rate;
      el('small', '', stamp, zh ? '打烊' : 'CLOSED');
      el('b', '', stamp, rate);
    } else {
      el('div', 'report-stamp rc-stamp', paper, zh ? '打烊' : 'CLOSED');
    }
    startButton(summaryCard, t.again || texts.again);
    overlayTap = () => { hideOverlays(); onStart(); };
    startCard.classList.add('hidden');
    closeClosing();
    summaryCard.classList.remove('hidden');
    syncLock();
  }
  // ---------- 吼罵模式 / voice mode (docs/gameplay-v2.md 10) ----------
  const voiceOpts = { whisper: false, replay: true, keywords: false, keywordsAvailable: false };
  function setVoiceOptions(o = {}) {
    Object.assign(voiceOpts, o);
    startCard.querySelectorAll('.vo-opt').forEach((b) => b.setAttribute('aria-pressed', String(!!voiceOpts[b.dataset.opt])));
  }
  // "今日最大聲：98 分貝級" with a replay button (the clip lives in memory only)
  function loudestRow(parent, l) {
    if (!l || !l.text) return;
    const vt = VOICE_TEXT[lang] || VOICE_TEXT.zh;
    // a receipt row: the loudest shout, a dotted leader and a round play (triangle) replay button
    const row = el('div', 'loudest rc-row', parent);
    el('span', 'loudest-text', row, l.text);
    el('i', 'rc-dots', row);
    if (typeof l.onReplay === 'function') {
      const b = el('button', 'loudest-btn', row);
      html(b, ICON.play);
      b.setAttribute('aria-label', l.replay || vt.replayBtn);
      b.type = 'button';
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); l.onReplay(); });
    }
  }
  // the microphone card: resolves true (allow) or false (use gestures)
  let promptEl = null;
  function voicePrompt(t = {}) {
    promptEl?.remove();
    return new Promise((resolve) => {
      promptEl = el('div', 'overlay voice-prompt', stage);
      // art direction 7.4: dark panel, a microphone, the ask in one big line, the privacy note small
      const card = el('div', 'card vp-card', promptEl);
      html(el('div', 'vp-icon', card), ICON.mic);
      el('h2', 'card-title vp-title', card, t.title || '');
      const body = String(t.body || '');
      const cut = body.search(/[。！]|\.\s/);
      const lead = cut >= 0 ? body.slice(0, cut + 1).trim() : body;
      el('p', 'vp-lead', card, lead);
      if (cut >= 0 && body.slice(cut + 1).trim()) el('p', 'vp-body', card, body.slice(cut + 1).trim());
      const yes = el('button', 'ui-gold vp-yes', card, t.yes || 'OK');
      yes.type = 'button';
      const no = el('button', 'vp-no', card, t.no || 'No');
      no.type = 'button';
      const prevTap = overlayTap;
      const done = (v) => (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        if (!promptEl) return;
        promptEl.remove();
        promptEl = null;
        overlayTap = prevTap;
        resolve(v);
      };
      yes.addEventListener('click', done(true));
      no.addEventListener('click', done(false));
      promptEl.addEventListener('click', (e) => { e.stopPropagation(); });
      overlayTap = () => done(true)();
      yes.focus?.({ preventScroll: true });
    });
  }
  let kara = null; // { setupEl, punchEl }
  function karaoke(spec) {
    karaokeEl.textContent = '';
    kara = null;
    if (!spec || (!spec.setup && !spec.punch)) { karaokeEl.hidden = true; return; }
    const vt = VOICE_TEXT[lang] || VOICE_TEXT.zh;
    karaokeEl.hidden = false;
    karaokeEl.style.setProperty('--kc', keyColor(spec.key || 'gun'));
    const part = (cls, tag, text) => {
      const w = el('div', 'kk ' + cls, karaokeEl);
      el('span', 'kk-tag', w, tag);
      const t = el('span', 'kk-text', w, text);
      t.style.setProperty('--fill', '0%');
      return t;
    };
    kara = {
      setupEl: spec.setup ? part('kk-setup', vt.setup, spec.setup) : null,
      punchEl: part('kk-punch', vt.punch, spec.punch || ''),
    };
    karaokeEl.classList.remove('lit');
  }
  function karaokeProgress({ setup, punch } = {}) {
    if (!kara) return;
    const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
    if (setup != null && kara.setupEl) kara.setupEl.style.setProperty('--fill', pct(setup));
    if (punch != null) {
      kara.punchEl.style.setProperty('--fill', pct(punch));
      karaokeEl.classList.toggle('lit', punch > 0);
    }
  }
  function voiceMeter(on) {
    vMeter.hidden = !on;
    if (on) {
      const vt = VOICE_TEXT[lang] || VOICE_TEXT.zh;
      vMarks.forEach((m, i) => { m.textContent = vt.marks[i]; });
    }
  }
  function voiceLevel(v, level = -1, { marks } = {}) {
    vFill.style.height = `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
    vMeter.dataset.level = String(level);
    if (Array.isArray(marks)) marks.forEach((y, i) => { vMarks[i].style.bottom = `${Math.round(y * 100)}%`; });
  }
  function voiceStatus(text) { vStatus.textContent = text || ''; }
  function voiceToast(text, cls = '') { return floatText(text, 'vtoast ' + cls, 1300); }

  // ---------- Gameplay v2 stage 2 ----------
  function setPreview(list = []) {
    // art direction 7.8: a steel rail on the counter front with the next customers' mini signs in clips (the second
    // smaller and paler); no "後面" label, no box
    previewEl.textContent = '';
    previewEl.classList.toggle('show', list.length > 0);
    if (!list.length) return;
    el('i', 'preview-rail', previewEl);
    list.slice(0, 2).forEach((p, i) => {
      const slot = el('div', 'preview-slot', previewEl);
      slot.style.setProperty('--i', String(i));
      el('i', 'preview-clip', slot);
      const m = miniSign(slot, p.kind || 'gun', p.text || '');
      m.classList.add('preview-sign');
      m.style.setProperty('--i', String(i));
    });
  }

  // Day 4: a lemon receipt strip clipped to the left end of the preview rail (art direction 7.9): "已收", the count
  // in Baloo, "/250", a thin progress line; it trembles from 240 on
  const METER_TEXT = { zh: ['已收', '杯'], en: ['Booked', 'cups'] };
  function setMeter(value, { hit, over } = {}) {
    stage.classList.toggle('metering', value != null);
    if (value == null) { meterEl.hidden = true; return; }
    meterEl.hidden = false;
    const [lbl, unit] = texts.meter || METER_TEXT[lang] || METER_TEXT.zh;
    const v = Math.max(0, Math.floor(value));
    meterEl.innerHTML = `<i class="meter-clip"></i><span class="meter-label">${lbl}</span><span class="meter-row"><b class="meter-num">${v}</b><span class="meter-of">/250${lang === 'zh' ? unit : ' ' + unit}</span></span>` +
      `<i class="meter-bar"><i style="width:${Math.min(100, (v / 250) * 100).toFixed(1)}%"></i></i>`;
    meterEl.dataset.near = v >= 240 ? '1' : '0';
    if (hit || over) restart(meterEl, hit ? 'hit' : 'over');
  }

  function setQuick(on, n = 0) {
    quickBox.classList.toggle('show', !!on);
    stage.classList.toggle('quick', !!on);
    if (!on) return;
    quickBox.textContent = '';
    el('span', 'quick-label', quickBox, texts.quick || (lang === 'zh' ? '快嘴' : 'Fast Mouth'));
    el('b', 'quick-num', quickBox, n > 0 ? '×' + n : '');
    if (n > 0) restart(quickBox, 'pulse');
  }

  function showGroup(customers = [], { key = 'gun', enterMs = 180, signDelayMs = 40, sign: label } = {}) {
    if (!customers.length) return { signUpAt: performance.now(), signUpInMs: 0 };
    const [first, ...rest] = customers;
    const res = showCustomer({ ...first, key }, { enterMs, signDelayMs, line: false, sign: { key, sign: label || `×${customers.length}` } });
    stage.classList.add('grouping');
    groupRow.textContent = '';
    groupRow.dataset.key = key;
    stage.classList.add('grouping'); // the preview steps aside for the group
    rest.forEach((c, i) => {
      const h = el('div', 'group-head', groupRow);
      h.style.setProperty('--i', String(i));
      h.innerHTML = `<div class="cust-clip">${art.customerSVG(c, 1)}</div>`;
      const m = miniSign(h, key === 'take' || key === 'shut' ? key : 'gun', '');
      m.classList.add('group-mini');
    });
    return res;
  }
  function groupHit(n, key, { all = false } = {}) {
    const heads = [...groupRow.querySelectorAll('.group-head:not(.out)')];
    const list = all ? heads : heads.slice(0, 1);
    list.forEach((h, i) => {
      h.classList.add('out');
      h.dataset.face = key;
      h.style.setProperty('--d', `${i * 60}ms`);
      later(() => h.remove(), 700 + i * 60);
    });
  }

  // Mini events (art direction 6.3 / 9): the prop itself is the panel, and the count is written on it. Megaphone: a
  // megaphone pokes in from the left, its volume cells light up; phone: a phone slides up with the ex-boss calling;
  // calculator: a real calculator with a seven-segment screen; stamp: a stack of slips that grows; shutter: no panel
  // (the shutter itself comes down). The prop art comes from art.js EVENT_PROPS[type] (or MEGAPHONE_SVG) when the
  // scene package provides it; until then a CSS-drawn stand-in. .event-panel stays the container (tools).
  const EVENT_CELLS = 10;
  const BUILTIN_PROP = {
    megaphone: '<i class="evp-cone"></i><i class="evp-bell"></i><i class="evp-grip"></i>',
    phone: '<i class="evp-body"></i><i class="evp-cam"></i>',
    calculator: '<i class="evp-body"></i><i class="evp-keys"></i>',
    stamp: '<i class="evp-slips"></i><i class="evp-stamp"></i>',
    shutter: '',
  };
  const eventCount = (big) => { const m = /(\d+)/.exec(String(big)); return m ? Number(m[1]) : 0; };
  function paintEvent(big) {
    const type = eventEl.dataset.type;
    const b = eventEl.querySelector('.ev-big');
    if (b && big != null && b.textContent !== String(big)) {
      b.textContent = String(big);
      restart(b, 'pop');
    }
    if (type === 'megaphone') {
      const n = eventCount(big);
      const lit = Math.min(EVENT_CELLS, n);
      eventEl.querySelectorAll('.ev-cell').forEach((c, i) => c.classList.toggle('on', i < lit));
      // art.js MEGAPHONE_SVG: five volume cells, one more every two hits
      eventEl.querySelectorAll('.mg-bar').forEach((r) => r.classList.toggle('on', Number(r.dataset.i) <= Math.ceil(n / 2)));
    } else if (type === 'stamp') {
      const [v, of] = String(big).split('/').map(Number);
      const fill = of > 0 ? Math.min(1, (v || 0) / of) : 0;
      eventEl.style.setProperty('--fill', String(fill));
      // art.js SLIPS_SVG: the stack grows from one slip to six
      eventEl.querySelectorAll('.slip').forEach((s) => s.classList.toggle('on', Number(s.dataset.i) <= 1 + Math.round(fill * 5)));
    } else if (type === 'phone') {
      eventEl.classList.toggle('hung', String(big) === '...');
    } else if (type === 'calculator') {
      const num = eventEl.querySelector('.calc-num:not(.calc-ghost)');
      if (num && big != null) num.textContent = String(big).replace(/[^0-9-]/g, '').slice(-3) || '-';
    }
  }
  function showEvent({ type = '', title = '', hint = '', big = '' } = {}) {
    eventEl.hidden = false;
    stage.classList.add('eventing'); // the preview steps aside while an event owns the counter
    eventEl.dataset.type = type;
    eventEl.classList.remove('hung');
    eventEl.style.removeProperty('--fill');
    eventEl.textContent = '';
    const prop = el('div', 'ev-prop', eventEl);
    const propSvg = art.EVENT_PROP_SVG?.[type] || (type === 'megaphone' ? art.MEGAPHONE_SVG : '');
    const hasArt = typeof propSvg === 'string' && !!propSvg;
    eventEl.classList.toggle('has-art', hasArt);
    if (hasArt) { prop.classList.add('art'); html(prop, propSvg); } else html(prop, BUILTIN_PROP[type] || '');
    el('div', 'ev-title', eventEl, title);
    const screen = el('div', 'ev-screen', eventEl);
    el('div', 'ev-big', screen, big);
    if (type === 'megaphone') {
      const vol = el('div', 'ev-vol', eventEl);
      for (let i = 0; i < EVENT_CELLS; i++) el('i', 'ev-cell', vol);
    }
    // the phone and the calculator need their one instruction; mash events show none (the prop says it)
    if (hint && (type === 'phone' || type === 'calculator')) el('div', 'ev-hint', eventEl, hint);
    paintEvent(big);
    restart(eventEl, 'in');
  }
  function updateEvent({ big } = {}) {
    if (eventEl.hidden) return;
    if (big != null) paintEvent(big);
  }
  function hideEvent() {
    eventEl.hidden = true;
    stage.classList.remove('eventing');
    eventEl.textContent = '';
  }

  function shutter(on, ms = 5000) {
    shutterEl.hidden = !on;
    if (!on) return;
    shutterEl.style.setProperty('--ms', Math.max(200, ms) + 'ms');
    restart(shutterEl, 'down');
  }

  // Round start: a wooden sign drops down on two strings for 1.6 s (art direction 7.10 / 9): Huninn title + the rule
  let bannerTimer = 0;
  function dayBanner(title, rule, ms = 1600) {
    clearTimeout(bannerTimer);
    bannerEl.textContent = '';
    if (!title && !rule) { bannerEl.hidden = true; return; }
    el('i', 'db-strings', bannerEl);
    const board = el('div', 'db-board', bannerEl);
    el('div', 'db-title', board, title || '');
    if (rule) el('div', 'db-rule', board, rule);
    bannerEl.hidden = false;
    restart(bannerEl, 'in');
    bannerTimer = setTimeout(() => {
      bannerEl.classList.add('out');
      bannerTimer = setTimeout(() => { bannerEl.hidden = true; bannerEl.classList.remove('out'); }, 220);
    }, Math.max(600, Math.min(ms, 1600)));
  }
  applyTexts();
  setClerk('idle');
  setHud({});
  paintQueue(0, false);
  camera('WIDE', 1, 0);
  syncLock();

  return {
    // HUD / texts
    render, setHud, setQueue, setTicket, setTexts, queueGain,
    // clerk
    setClerk, setClerkFlags, clerkBeat, clerkTap, resetClerk,
    // customer + sign
    showCustomer, relabelCustomer, showSign, signFx, hideSign, startSignTimer, stopSignTimer, setSignMult,
    signExit: signOut, customerReact, customerPose, showPlate, plateGlow, clearPlate, clearCustomer, kick, setForced,
    // camera + fx
    camera, flash, shake, freeze, letterbox, gate, goldsign, speedLines, setLite, get lite() { return lite; },
    // 花字
    huazi: huaziTracked, clearHuazi,
    // subtitles
    showLine, emphasize,
    // guidance
    guide, clearGuide, hintCorrect, tip, breathKey, coverKey, lockInput, unlockInput, inputLocked,
    // screens
    showStart, fontsReady, showClosing, showRecap, showSkip, showSummary, showMilestone, relabelMilestone,
    // effect names shared with older callers
    effect,
    // gameplay v2 stage 2
    setPreview, setMeter, setQuick, showGroup, groupHit, showEvent, updateEvent, hideEvent, shutter, dayBanner,
    // gesture mode (docs/gameplay-v2.md 9)
    setInputMode, get inputMode() { return inputMode; }, setGestureHints, slap, stampHold, stampSlam, setFling, bowl,
    rageHeadAdd, rageHeadHit, clearRageHeads, gestureHint,
    // voice mode (docs/gameplay-v2.md 10)
    setVoiceOptions, voicePrompt, karaoke, karaokeProgress, voiceMeter, voiceLevel, voiceStatus, voiceToast,
    get selMode() { return selMode; },
  };
}
